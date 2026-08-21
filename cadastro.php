<?php
declare(strict_types=1);
session_start();
header('Content-Type: application/json; charset=utf-8');

function responder(int $status, string $mensagem): never {
    http_response_code($status);
    echo json_encode(['sucesso' => false, 'mensagem' => $mensagem], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') responder(405, 'Método não permitido.');
require_once 'conexão.php';

$nome = trim($_POST['nome'] ?? '');
$email = strtolower(trim($_POST['email'] ?? ''));
$telefone = trim($_POST['telefone'] ?? '');
$endereco = trim($_POST['endereco'] ?? '');
$senha = $_POST['senha'] ?? '';
$confirmarSenha = $_POST['confirmarSenha'] ?? '';
$tipo = strtolower(trim($_POST['tipo'] ?? ''));

if ($nome === '' || $email === '' || $telefone === '' || $endereco === '' || $senha === '' || $confirmarSenha === '' || $tipo === '') responder(422, 'Preencha todos os campos.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) responder(422, 'Digite um e-mail válido.');
if (!preg_match('/^\(\d{2}\) \d{4,5}-\d{4}$/', $telefone)) responder(422, 'Digite um telefone válido.');
if (strlen($senha) < 6) responder(422, 'A senha precisa ter pelo menos 6 caracteres.');
if ($senha !== $confirmarSenha) responder(422, 'As senhas não são iguais.');
if (!in_array($tipo, ['produtor', 'comprador'], true)) responder(422, 'Tipo de conta inválido.');

$consulta = $conexao->prepare('SELECT id FROM usuarios WHERE email = ? LIMIT 1');
if (!$consulta) responder(500, 'Não foi possível preparar a consulta.');
$consulta->bind_param('s', $email);
$consulta->execute();
if ($consulta->get_result()->num_rows > 0) responder(409, 'Este e-mail já está cadastrado.');

$senhaHash = password_hash($senha, PASSWORD_DEFAULT);
if ($senhaHash === false) responder(500, 'Não foi possível proteger a senha.');
$inserir = $conexao->prepare('INSERT INTO usuarios (nome, email, telefone, senha, tipo) VALUES (?, ?, ?, ?, ?)');
if (!$inserir) responder(500, 'Não foi possível preparar o cadastro.');
$inserir->bind_param('sssss', $nome, $email, $telefone, $senhaHash, $tipo);
if (!$inserir->execute()) responder(500, 'Não foi possível concluir o cadastro.');

$_SESSION['id'] = $conexao->insert_id;
$_SESSION['nome'] = $nome;
$_SESSION['email'] = $email;
$_SESSION['tipo'] = $tipo;
echo json_encode(['sucesso' => true], JSON_UNESCAPED_UNICODE);
