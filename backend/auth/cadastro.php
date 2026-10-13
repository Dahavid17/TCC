<?php
require_once 'conexao.php';

// Dados vindos de um formulário (ex: $_POST)
$nome = $_POST['nome'];
$email = $_POST['email'];
$senha_hash = password_hash($_POST['senha'], PASSWORD_DEFAULT); // Criptografa a senha
$tipo = 'produtor';

$sql = "INSERT INTO usuarios (nome, email, senha_hash, tipo_acesso) VALUES (:nome, :email, :senha, :tipo)";
$stmt = $pdo->prepare($sql);

$sucesso = $stmt->execute([
    'nome'  => $nome,
    'email' => $email,
    'senha' => $senha_hash,
    'tipo'  => $tipo
]);

if ($sucesso) {
    echo "Usuário cadastrado com sucesso! ID: " . $pdo->lastInsertId();
}
?>