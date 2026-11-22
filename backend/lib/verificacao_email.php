<?php
declare(strict_types=1);

// Verificação de e-mail real. Custo zero: sem API paga, usa só DNS + o envio de e-mail da hospedagem.
//
// Como funciona:
//  1. O domínio precisa aceitar e-mail (registro MX). Ex.: "gmail.com.br" declara que NÃO recebe
//     e-mail (MX nulo) e é recusado na hora.
//  2. Enviamos um código de 6 números para o endereço. Só quem abre a caixa de entrada consegue
//     digitar o código: é a prova de que o e-mail existe e é da pessoa.
//  3. Enquanto o e-mail não for confirmado, a conta não entra no painel e não recebe avisos.
//
// Contas antigas (criadas antes disso) também precisam confirmar no próximo login; quem usou um
// e-mail inventado pode trocar por um real na mesma tela, sem perder produtos e pedidos.
// Tabela/colunas: banco/migracoes/009_verificacao_email.sql (criadas aqui se ainda não existirem).

require_once __DIR__ . '/email.php';

const CODIGO_MAX_TENTATIVAS = 5;
const CODIGO_INTERVALO_REENVIO = 60;   // segundos entre um envio e outro
const CODIGO_MAX_ENVIOS_HORA = 5;

function garantir_verificacao_email(PDO $pdo): void
{
    static $pronta = false;

    if ($pronta) return;

    $coluna = $pdo->query("SHOW COLUMNS FROM usuarios LIKE 'email_verificado'")->fetch();

    if (!$coluna) {
        $pdo->exec('ALTER TABLE usuarios ADD COLUMN email_verificado TINYINT(1) NOT NULL DEFAULT 0');
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS codigos_email (
            id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            usuario_id   BIGINT       NOT NULL,
            email        VARCHAR(150) NOT NULL,
            codigo_hash  VARCHAR(255) NOT NULL,
            tentativas   TINYINT      NOT NULL DEFAULT 0,
            usado        TINYINT(1)   NOT NULL DEFAULT 0,
            expira_em    DATETIME     NOT NULL,
            criado_em    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_codigos_usuario (usuario_id, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pronta = true;
}

function email_verificado(PDO $pdo, int $usuarioId): bool
{
    try {
        $stmt = $pdo->prepare('SELECT email_verificado FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $usuarioId]);

        return (int) $stmt->fetchColumn() === 1;
    } catch (PDOException $semColuna) {
        return false; // coluna ainda não criada: ninguém confirmou ainda
    }
}

// O domínio recebe e-mail? Recusa domínio inexistente ou com "MX nulo" (RFC 7505).
// Se a consulta de DNS falhar (instabilidade), não bloqueia: o código por e-mail continua sendo a prova.
function dominio_recebe_email(string $email): bool
{
    $dominio = strtolower(substr(strrchr($email, '@') ?: '', 1));

    if ($dominio === '' || !str_contains($dominio, '.')) return false;

    $mx = @dns_get_record($dominio . '.', DNS_MX);

    if ($mx === false) return true;

    $servidores = array_filter(array_map(fn($r) => trim((string) ($r['target'] ?? ''), '.'), $mx));

    if ($mx && !$servidores) return false;           // MX nulo: o domínio avisa que não recebe e-mail
    if ($servidores) return true;

    // Sem MX: o e-mail ainda pode ir para o próprio domínio (registro A), como manda a regra.
    return (bool) (@dns_get_record($dominio . '.', DNS_A) ?: @dns_get_record($dominio . '.', DNS_AAAA));
}

// Valida formato + domínio. Devolve a mensagem de erro, ou null se estiver tudo certo.
function problema_no_email(string $email): ?string
{
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 150) {
        return 'Digite um e-mail válido, como nome@gmail.com.';
    }

    if (!dominio_recebe_email($email)) {
        $dominio = substr(strrchr($email, '@'), 1);

        return "O endereço \"{$dominio}\" não recebe e-mails. Confira se digitou certo (por exemplo, gmail.com e não gmail.com.br).";
    }

    return null;
}

// Gera e envia um código novo. Devolve [ok, mensagem].
function enviar_codigo_verificacao(PDO $pdo, int $usuarioId, string $email): array
{
    garantir_verificacao_email($pdo);

    $email = trim($email);
    $erro = problema_no_email($email);

    if ($erro !== null) return [false, $erro];

    // O e-mail não pode ser de outra conta.
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE email = :email AND id <> :id LIMIT 1');
    $stmt->execute([':email' => $email, ':id' => $usuarioId]);

    if ($stmt->fetch()) {
        return [false, 'Este e-mail já é usado por outra conta.'];
    }

    // Limites de envio: evita lotar a caixa da pessoa e o servidor.
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) AS total, MAX(criado_em) AS ultimo, NOW() AS agora
           FROM codigos_email
          WHERE usuario_id = :id AND criado_em > NOW() - INTERVAL 1 HOUR'
    );
    $stmt->execute([':id' => $usuarioId]);
    $envios = $stmt->fetch();

    if ((int) $envios['total'] >= CODIGO_MAX_ENVIOS_HORA) {
        return [false, 'Você já pediu muitos códigos. Espere um pouco e tente de novo mais tarde.'];
    }

    if ($envios['ultimo'] !== null) {
        $espera = CODIGO_INTERVALO_REENVIO - (strtotime($envios['agora']) - strtotime($envios['ultimo']));

        if ($espera > 0) {
            return [false, "Aguarde {$espera} segundos para pedir outro código."];
        }
    }

    $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

    // Um código novo invalida os anteriores.
    $pdo->prepare('UPDATE codigos_email SET usado = 1 WHERE usuario_id = :id AND usado = 0')
        ->execute([':id' => $usuarioId]);

    $pdo->prepare(
        'INSERT INTO codigos_email (usuario_id, email, codigo_hash, expira_em)
         VALUES (:id, :email, :hash, NOW() + INTERVAL ' . CODIGO_EMAIL_VALIDADE_MINUTOS . ' MINUTE)'
    )->execute([':id' => $usuarioId, ':email' => $email, ':hash' => password_hash($codigo, PASSWORD_DEFAULT)]);

    $stmt = $pdo->prepare('SELECT nome FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);
    $nome = explode(' ', trim((string) $stmt->fetchColumn()))[0] ?: 'produtor';

    if (!enviar_email_codigo($email, $nome, $codigo)) {
        error_log('[MARKETPLACE_VERIFICACAO] O servidor recusou o envio do código.');

        return [false, 'Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos.'];
    }

    return [true, 'Enviamos um código de 6 números para ' . $email . '.'];
}

// Confere o código. Se estiver certo, grava o e-mail (pode ser um novo) como confirmado.
// Devolve [ok, mensagem, email_confirmado|null].
function confirmar_codigo_verificacao(PDO $pdo, int $usuarioId, string $codigo): array
{
    garantir_verificacao_email($pdo);

    $codigo = preg_replace('/\D/', '', $codigo);

    if (strlen($codigo) !== 6) {
        return [false, 'O código tem 6 números. Confira o e-mail que enviamos.', null];
    }

    $stmt = $pdo->prepare(
        'SELECT id, email, codigo_hash, tentativas, expira_em < NOW() AS expirado
           FROM codigos_email
          WHERE usuario_id = :id AND usado = 0
          ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([':id' => $usuarioId]);
    $registro = $stmt->fetch();

    if (!$registro) {
        return [false, 'Peça um código novo no botão "Reenviar código".', null];
    }

    if ((int) $registro['expirado'] === 1) {
        return [false, 'Este código venceu. Peça um código novo no botão "Reenviar código".', null];
    }

    if ((int) $registro['tentativas'] >= CODIGO_MAX_TENTATIVAS) {
        return [false, 'Muitas tentativas erradas. Peça um código novo no botão "Reenviar código".', null];
    }

    if (!password_verify($codigo, $registro['codigo_hash'])) {
        $pdo->prepare('UPDATE codigos_email SET tentativas = tentativas + 1 WHERE id = :id')
            ->execute([':id' => $registro['id']]);

        $restantes = CODIGO_MAX_TENTATIVAS - (int) $registro['tentativas'] - 1;

        return [false, $restantes > 0
            ? "Código errado. Você ainda tem {$restantes} tentativa(s)."
            : 'Código errado. Peça um código novo no botão "Reenviar código".', null];
    }

    // O mesmo e-mail pode ter sido pego por outra conta enquanto o código estava aberto.
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE email = :email AND id <> :id LIMIT 1');
    $stmt->execute([':email' => $registro['email'], ':id' => $usuarioId]);

    if ($stmt->fetch()) {
        return [false, 'Este e-mail já é usado por outra conta.', null];
    }

    $pdo->beginTransaction();
    $pdo->prepare('UPDATE codigos_email SET usado = 1 WHERE usuario_id = :id')->execute([':id' => $usuarioId]);
    $pdo->prepare('UPDATE usuarios SET email = :email, email_verificado = 1 WHERE id = :id')
        ->execute([':email' => $registro['email'], ':id' => $usuarioId]);
    $pdo->commit();

    return [true, 'E-mail confirmado!', $registro['email']];
}
