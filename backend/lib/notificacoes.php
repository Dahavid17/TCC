<?php
declare(strict_types=1);

// Notificações dentro do site (o sino do topo). Custo zero: só banco + PHP.
//
// Uso nos endpoints, DEPOIS de concluir a ação principal:
//   notificar($pdo, $usuarioId, 'pedido_novo', 'Novo pedido!', 'Maria pediu 3 x Café', 'pedidos.html');
//
// Regras:
//  - Nunca quebra a ação principal: qualquer erro aqui só vai para o log.
//  - Respeita Configurações > Preferências > Notificações (preferência "notificacoes" = "nao").
//  - Pedido novo, mudança de status e proposta também vão por e-mail (backend/lib/email.php),
//    respeitando a preferência "E-mails".
//  - Agrupa mensagens: várias mensagens não lidas da mesma conversa viram UM aviso atualizado.
// Tabela: banco/migracoes/008_notificacoes.sql (criada aqui se ainda não existir).

const TIPOS_NOTIFICACAO = ['pedido_novo', 'pedido_status', 'mensagem', 'proposta', 'sistema'];

function garantir_tabela_notificacoes(PDO $pdo): void
{
    static $pronta = false;

    if ($pronta) return;

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS notificacoes (
            id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            usuario_id  BIGINT       NOT NULL,
            tipo        VARCHAR(20)  NOT NULL,
            titulo      VARCHAR(120) NOT NULL,
            mensagem    VARCHAR(255) NOT NULL,
            link        VARCHAR(255) NULL,
            grupo       VARCHAR(60)  NULL,
            lida        TINYINT(1)   NOT NULL DEFAULT 0,
            criada_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_notificacoes_usuario (usuario_id, lida, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pronta = true;
}

function usuario_quer_notificacoes(PDO $pdo, int $usuarioId): bool
{
    try {
        $stmt = $pdo->prepare("SELECT valor FROM usuarios_preferencias WHERE usuario_id = :id AND chave = 'notificacoes'");
        $stmt->execute([':id' => $usuarioId]);

        return $stmt->fetchColumn() !== 'nao';
    } catch (PDOException $semTabela) {
        return true; // ainda não existe preferência salva
    }
}

// Tipos que também vão por e-mail (mensagens comuns de chat ficam só no sino, para não lotar a caixa).
const TIPOS_COM_EMAIL = ['pedido_novo', 'pedido_status', 'proposta'];

// $grupo (opcional): avisos não lidos do mesmo grupo são atualizados em vez de repetidos.
function notificar(PDO $pdo, int $usuarioId, string $tipo, string $titulo, string $mensagem, ?string $link = null, ?string $grupo = null): void
{
    if (!in_array($tipo, TIPOS_NOTIFICACAO, true)) {
        return;
    }

    // E-mail: independente do sino, segue a preferência "E-mails" (ver backend/lib/email.php).
    if (in_array($tipo, TIPOS_COM_EMAIL, true)) {
        require_once __DIR__ . '/email.php';
        enviar_email_aviso($pdo, $usuarioId, $titulo, $mensagem, $link);
    }

    try {
        if (!usuario_quer_notificacoes($pdo, $usuarioId)) {
            return;
        }

        garantir_tabela_notificacoes($pdo);

        $titulo = mb_substr($titulo, 0, 120);
        $mensagem = mb_substr($mensagem, 0, 255);

        if ($grupo !== null) {
            $stmt = $pdo->prepare(
                'UPDATE notificacoes
                    SET titulo = :titulo, mensagem = :mensagem, link = :link, criada_em = NOW()
                  WHERE usuario_id = :usuario AND grupo = :grupo AND lida = 0'
            );
            $stmt->execute([':titulo' => $titulo, ':mensagem' => $mensagem, ':link' => $link, ':usuario' => $usuarioId, ':grupo' => $grupo]);

            if ($stmt->rowCount() > 0) return;
        }

        $pdo->prepare(
            'INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link, grupo)
             VALUES (:usuario, :tipo, :titulo, :mensagem, :link, :grupo)'
        )->execute([
            ':usuario'  => $usuarioId,
            ':tipo'     => $tipo,
            ':titulo'   => $titulo,
            ':mensagem' => $mensagem,
            ':link'     => $link,
            ':grupo'    => $grupo,
        ]);
    } catch (Throwable $erro) {
        error_log('[MARKETPLACE_NOTIFICAR] ' . $erro->getMessage());
    }
}

function nome_curto(PDO $pdo, int $usuarioId): string
{
    $stmt = $pdo->prepare('SELECT nome FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);

    return explode(' ', trim((string) $stmt->fetchColumn()))[0] ?: 'Alguém';
}
