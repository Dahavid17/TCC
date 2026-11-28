<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// POST: token, senha, confirmar — troca a senha usando o link enviado por e-mail.
// GET ?token=...: só confere se o link ainda é válido (a tela mostra o aviso certo).
$token = (string) ($_POST['token'] ?? $_GET['token'] ?? '');

if (preg_match('/^[a-f0-9]{64}$/', $token) !== 1) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Link inválido. Peça um novo em "Esqueci minha senha".']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare('SELECT id, usuario_id FROM senha_recuperacao WHERE token_hash = :hash AND usado_em IS NULL AND expira_em > NOW() LIMIT 1');
    $stmt->execute([':hash' => hash('sha256', $token)]);
    $pedido = $stmt->fetch();

    if (!$pedido) {
        responder(410, ['sucesso' => false, 'mensagem' => 'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".']);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        responder(200, ['sucesso' => true]);
    }
    exigir_metodo('POST');

    $senha = (string) ($_POST['senha'] ?? '');
    // Mesmo mínimo do cadastro e da troca de senha do servidor (SENHA_TAMANHO_MINIMO = 6).
    if (mb_strlen($senha) < 6) {
        responder(422, ['sucesso' => false, 'mensagem' => 'A senha precisa ter pelo menos 6 caracteres.']);
    }
    if ($senha !== (string) ($_POST['confirmar'] ?? '')) {
        responder(422, ['sucesso' => false, 'mensagem' => 'As senhas não conferem.']);
    }

    $pdo->beginTransaction();
    $pdo->prepare('UPDATE usuarios SET senha_hash = :hash WHERE id = :id')
        ->execute([':hash' => password_hash($senha, PASSWORD_DEFAULT), ':id' => $pedido['usuario_id']]);
    $pdo->prepare('UPDATE senha_recuperacao SET usado_em = NOW() WHERE usuario_id = :id AND usado_em IS NULL')
        ->execute([':id' => $pedido['usuario_id']]);
    $pdo->commit();

    responder(200, ['sucesso' => true, 'mensagem' => 'Senha alterada! Entre com a nova senha.']);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[MARKETPLACE_REDEFINIR_SENHA] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível alterar a senha. Tente novamente.']);
}
