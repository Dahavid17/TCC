<?php
declare(strict_types=1);

// Confere o código de 6 números. Se estiver certo, o e-mail fica confirmado e a pessoa já entra no painel.

session_start();

header('Content-Type: application/json; charset=utf-8');

function responder(int $status, array $dados): never
{
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    responder(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

$usuarioId = (int) ($_SESSION['verificar_usuario_id'] ?? 0);

if ($usuarioId <= 0) {
    responder(401, ['sucesso' => false, 'mensagem' => 'Entre com seu e-mail e senha de novo para confirmar.']);
}

require_once __DIR__ . '/../config/conexao.php';
require_once __DIR__ . '/../lib/verificacao_email.php';

try {
    [$ok, $mensagem] = confirmar_codigo_verificacao($pdo, $usuarioId, (string) ($_POST['codigo'] ?? ''));

    if (!$ok) {
        responder(422, ['sucesso' => false, 'mensagem' => $mensagem]);
    }

    $stmt = $pdo->prepare('SELECT id, nome, email, tipo_acesso FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);
    $usuario = $stmt->fetch();

    // E-mail confirmado: completa o login (o mesmo que backend/auth/login.php faz).
    session_regenerate_id(true);
    unset($_SESSION['verificar_usuario_id']);

    $_SESSION['usuario_id']    = (int) $usuario['id'];
    $_SESSION['usuario_nome']  = $usuario['nome'];
    $_SESSION['usuario_email'] = $usuario['email'];
    $_SESSION['usuario_tipo']  = $usuario['tipo_acesso'];

    responder(200, ['sucesso' => true, 'mensagem' => $mensagem, 'redirect' => 'inicio.html']);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_CONFIRMAR_EMAIL] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Erro no servidor. Tente novamente.']);
}
