<?php
declare(strict_types=1);

// Envia (ou reenvia) o código de confirmação de e-mail.
// Quem pode pedir: quem acabou de se cadastrar, ou quem acertou a senha no login mas ainda não
// confirmou o e-mail (fica em $_SESSION['verificar_usuario_id'], sem entrar no painel).
// POST email (opcional): troca por outro endereço; só vale depois de confirmado com o código.

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
    responder(401, ['sucesso' => false, 'mensagem' => 'Entre com seu e-mail e senha de novo para receber o código.']);
}

require_once __DIR__ . '/../config/conexao.php';
require_once __DIR__ . '/../lib/verificacao_email.php';

try {
    $email = trim((string) ($_POST['email'] ?? ''));

    if ($email === '') {
        $stmt = $pdo->prepare('SELECT email FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $usuarioId]);
        $email = (string) $stmt->fetchColumn();
    }

    [$ok, $mensagem] = enviar_codigo_verificacao($pdo, $usuarioId, $email);

    responder($ok ? 200 : 422, ['sucesso' => $ok, 'mensagem' => $mensagem, 'email' => $email]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_ENVIAR_CODIGO] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Erro no servidor. Tente novamente.']);
}
