<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function responder(int $status, array $dados): never
{
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    responder(405, ['sucesso' => false, 'mensagem' => 'Método inválido.']);
}

require_once __DIR__ . '/../config/conexao.php';

$nome            = trim($_POST['nome'] ?? '');
$email           = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
$telefone        = trim($_POST['telefone'] ?? '');
$endereco        = trim($_POST['endereco'] ?? '');
$tipoAcesso      = strtolower(trim($_POST['tipoConta'] ?? 'produtor'));
$senha           = $_POST['senha'] ?? '';
$confirmarSenha  = $_POST['confirmarSenha'] ?? '';

// Auto-cadastro só cria produtor ou comprador; 'admin' nunca vem do formulário.
if (!in_array($tipoAcesso, ['produtor', 'comprador'], true)) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Tipo de conta inválido.']);
}

if ($nome === '' || !$email || $senha === '') {
    responder(422, ['sucesso' => false, 'mensagem' => 'Preencha todos os campos obrigatórios.']);
}

if ($senha !== $confirmarSenha) {
    responder(422, ['sucesso' => false, 'mensagem' => 'As senhas não coincidem.']);
}

if (strlen($senha) < 6) {
    responder(422, ['sucesso' => false, 'mensagem' => 'A senha deve ter no mínimo 6 caracteres.']);
}

if (mb_strlen($nome) > 150 || mb_strlen($email) > 150 || mb_strlen($telefone) > 20 || mb_strlen($endereco) > 255) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Algum campo excede o tamanho permitido.']);
}

try {
    $stmt = $pdo->prepare(
        'INSERT INTO usuarios (nome, email, telefone, endereco, senha_hash, tipo_acesso)
         VALUES (:nome, :email, :telefone, :endereco, :senha_hash, :tipo_acesso)'
    );
    $stmt->execute([
        ':nome'        => $nome,
        ':email'       => $email,
        ':telefone'    => $telefone,
        ':endereco'    => $endereco,
        ':senha_hash'  => password_hash($senha, PASSWORD_DEFAULT),
        ':tipo_acesso' => $tipoAcesso,
    ]);

    responder(201, ['sucesso' => true, 'mensagem' => 'Cadastro realizado com sucesso!']);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        responder(409, ['sucesso' => false, 'mensagem' => 'Este e-mail já está cadastrado.']);
    }

    error_log('[MARKETPLACE_CADASTRO] ' . $e->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Erro no servidor. Tente novamente.']);
}
