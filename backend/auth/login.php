<?php
session_start();
require_once '../config/conexao.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
    $senha = $_POST['senha'] ?? '';

    if (!$email || empty($senha)) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Preencha e-mail e senha.']);
        exit;
    }

    try {
        $sql = "SELECT id, nome, email, senha_hash, tipo_acesso FROM usuarios WHERE email = :email";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':email' => $email]);
        $usuario = $stmt->fetch();

        if ($usuario && password_verify($senha, $usuario['senha_hash'])) {
            $_SESSION['usuario_id']    = $usuario['id'];
            $_SESSION['usuario_nome']  = $usuario['nome'];
            $_SESSION['usuario_email'] = $usuario['email'];
            $_SESSION['usuario_tipo']  = $usuario['tipo_acesso'];

            echo json_encode(['sucesso' => true, 'redirect' => 'dashboard.html']); // Ajuste a rota do painel aqui
        } else {
            echo json_encode(['sucesso' => false, 'mensagem' => 'E-mail ou senha incorretos.']);
        }
    } catch (PDOException $e) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Erro no servidor. Tente novamente.']);
    }
}
?>