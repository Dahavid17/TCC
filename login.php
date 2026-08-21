<?php
declare(strict_types=1);
session_start();
header('Content-Type: application/json; charset=utf-8');

function responderLogin(int $status, string $mensagem): never {
    http_response_code($status);
    echo json_encode(['sucesso' => false, 'mensagem' => $mensagem], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') responderLogin(405, 'Método não permitido.');
require_once 'conexão.php';

$email = strtolower(trim($_POST['email'] ?? ''));
$senha = $_POST['senha'] ?? '';
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $senha === '') responderLogin(422, 'Informe e-mail e senha válidos.');

$consulta = $conexao->prepare('SELECT id, nome, email, senha, tipo FROM usuarios WHERE email = ? LIMIT 1');
if (!$consulta) responderLogin(500, 'Não foi possível preparar a consulta.');
$consulta->bind_param('s', $email);
$consulta->execute();
$usuario = $consulta->get_result()->fetch_assoc();
if (!$usuario || !password_verify($senha, $usuario['senha'])) responderLogin(401, 'E-mail ou senha incorretos.');

if (password_needs_rehash($usuario['senha'], PASSWORD_DEFAULT)) {
    $novoHash = password_hash($senha, PASSWORD_DEFAULT);
    if ($novoHash !== false) {
        $atualizar = $conexao->prepare('UPDATE usuarios SET senha = ? WHERE id = ?');
        if ($atualizar) { $atualizar->bind_param('si', $novoHash, $usuario['id']); $atualizar->execute(); }
    }
}

session_regenerate_id(true);
$_SESSION['id'] = (int) $usuario['id'];
$_SESSION['nome'] = $usuario['nome'];
$_SESSION['email'] = $usuario['email'];
$_SESSION['tipo'] = $usuario['tipo'];
echo json_encode(['sucesso' => true], JSON_UNESCAPED_UNICODE);
