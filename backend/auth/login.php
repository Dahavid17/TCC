<?php
declare(strict_types=1);

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

require_once __DIR__ . '/../config/conexao.php';

$email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
$senha = $_POST['senha'] ?? '';

if (!$email || $senha === '') {
    responder(422, ['sucesso' => false, 'mensagem' => 'Preencha e-mail e senha.']);
}

try {
    $stmt = $pdo->prepare(
        'SELECT id, nome, email, senha_hash, tipo_acesso FROM usuarios WHERE email = :email LIMIT 1'
    );
    $stmt->execute([':email' => $email]);
    $usuario = $stmt->fetch();

    if (!$usuario || !password_verify($senha, $usuario['senha_hash'])) {
        responder(401, ['sucesso' => false, 'mensagem' => 'E-mail ou senha incorretos.']);
    }

    session_regenerate_id(true);

    $_SESSION['usuario_id']    = (int) $usuario['id'];
    $_SESSION['usuario_nome']  = $usuario['nome'];
    $_SESSION['usuario_email'] = $usuario['email'];
    $_SESSION['usuario_tipo']  = $usuario['tipo_acesso'];

    responder(200, ['sucesso' => true, 'redirect' => 'inicio.html']);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_LOGIN] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Erro no servidor. Tente novamente.']);
}
