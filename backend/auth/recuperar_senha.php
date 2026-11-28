<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// POST: email — envia por e-mail um link para criar uma nova senha (vale 1 hora, 1 uso).
// Responde sempre a mesma mensagem, exista ou não a conta, para não revelar quais
// e-mails estão cadastrados. No máximo 3 pedidos por conta por hora.
// Ambiente local (dev/router.php define MARKETPLACE_DEV=1): o link também volta na resposta,
// porque o PHP embutido não envia e-mails.
exigir_metodo('POST');

$email = filter_var(trim((string) ($_POST['email'] ?? '')), FILTER_VALIDATE_EMAIL);
if (!$email) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Informe um e-mail válido.']);
}

$mensagem = 'Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha em alguns minutos. Confira também a caixa de spam.';

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare('SELECT id, nome, email FROM usuarios WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $usuario = $stmt->fetch();

    if (!$usuario) {
        responder(200, ['sucesso' => true, 'mensagem' => $mensagem]);
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM senha_recuperacao WHERE usuario_id = :id AND data_criacao >= DATE_SUB(NOW(), INTERVAL 1 HOUR)');
    $stmt->execute([':id' => $usuario['id']]);
    if ((int) $stmt->fetchColumn() >= 3) {
        responder(200, ['sucesso' => true, 'mensagem' => $mensagem]);
    }

    $token = bin2hex(random_bytes(32));
    $pdo->prepare('UPDATE senha_recuperacao SET usado_em = NOW() WHERE usuario_id = :id AND usado_em IS NULL')->execute([':id' => $usuario['id']]);
    $pdo->prepare('INSERT INTO senha_recuperacao (usuario_id, token_hash, expira_em) VALUES (:id, :hash, DATE_ADD(NOW(), INTERVAL 1 HOUR))')
        ->execute([':id' => $usuario['id'], ':hash' => hash('sha256', $token)]);

    // E-mails do servidor: backend/lib/email.php (remetente avisos@buzzcodex.com.br, HTML + texto).
    if (is_file(__DIR__ . '/../lib/email.php')) {
        require_once __DIR__ . '/../lib/email.php';
    }

    // O link usa sempre o endereço oficial do site (nunca o cabeçalho Host, que pode ser forjado
    // para mandar o token a outro domínio). Só no ambiente local usa o endereço do teste.
    if (getenv('MARKETPLACE_DEV') === '1') {
        $base = 'http://' . preg_replace('/[^a-zA-Z0-9.:\-]/', '', (string) ($_SERVER['HTTP_HOST'] ?? '127.0.0.1:8080'));
    } else {
        $base = defined('EMAIL_SITE') ? EMAIL_SITE : 'https://buzzcodex.com.br';
    }
    $link = $base . '/frontend/pages/redefinir-senha.html?token=' . $token;

    $titulo = 'Criar uma nova senha';
    $texto = 'Recebemos um pedido para criar uma nova senha da sua conta no MarketPlace Rural. '
        . 'O link vale por 1 hora. Se não foi você, ignore este e-mail: sua senha atual continua valendo.';

    if (function_exists('enviar_email_agora')) {
        // O email.php do servidor monta o endereço: EMAIL_SITE . '/frontend/pages/' . $link.
        $enviado = enviar_email_agora($usuario['email'], $usuario['nome'], 'MarketPlace Rural — redefinir senha', $titulo, $texto,
            'redefinir-senha.html?token=' . $token);
    } else {
        $assunto = '=?UTF-8?B?' . base64_encode('MarketPlace Rural — redefinir senha') . '?=';
        $enviado = @mail($usuario['email'], $assunto, "Olá, {$usuario['nome']}!\n\n{$texto}\n\n{$link}\n",
            "Content-Type: text/plain; charset=UTF-8\r\nFrom: MarketPlace Rural <avisos@buzzcodex.com.br>");
    }

    if (!$enviado) {
        error_log('[MARKETPLACE_RECUPERAR_SENHA] e-mail não enviado para o usuário ' . $usuario['id']);
    }

    $resposta = ['sucesso' => true, 'mensagem' => $mensagem];
    if (getenv('MARKETPLACE_DEV') === '1') {
        $resposta['link_dev'] = $link;
    }
    responder(200, $resposta);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_RECUPERAR_SENHA] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível processar o pedido. Tente novamente.']);
}
