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
require_once __DIR__ . '/../lib/verificacao_email.php';

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

    // O perfil escolhido na tela de login precisa corresponder ao tipo da conta (admin entra por qualquer um).
    $perfil = strtolower(trim((string) ($_POST['perfil'] ?? '')));

    if (in_array($perfil, ['produtor', 'comprador'], true)
        && $usuario['tipo_acesso'] !== 'admin'
        && $perfil !== $usuario['tipo_acesso']) {
        responder(403, [
            'sucesso'     => false,
            'mensagem'    => 'Esta conta é de ' . $usuario['tipo_acesso'] . '. Selecionamos o perfil correto; clique em Entrar novamente.',
            'tipo_conta'  => $usuario['tipo_acesso'],
        ]);
    }

    session_regenerate_id(true);

    // Senha certa, mas o e-mail ainda não foi confirmado com o código: não entra no painel.
    // A tela de login mostra o passo "Confirme seu e-mail" (dá para trocar por um e-mail real ali).
    if (!email_verificado($pdo, (int) $usuario['id'])) {
        unset($_SESSION['usuario_id'], $_SESSION['usuario_nome'], $_SESSION['usuario_email'], $_SESSION['usuario_tipo']);
        $_SESSION['verificar_usuario_id'] = (int) $usuario['id'];

        responder(403, [
            'sucesso'           => false,
            'precisa_verificar' => true,
            'email'             => $usuario['email'],
            'mensagem'          => 'Falta confirmar seu e-mail para entrar.',
        ]);
    }

    unset($_SESSION['verificar_usuario_id']);

    $_SESSION['usuario_id']    = (int) $usuario['id'];
    $_SESSION['usuario_nome']  = $usuario['nome'];
    $_SESSION['usuario_email'] = $usuario['email'];
    $_SESSION['usuario_tipo']  = $usuario['tipo_acesso'];

    responder(200, ['sucesso' => true, 'redirect' => 'inicio.html']);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_LOGIN] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Erro no servidor. Tente novamente.']);
}
