<?php
session_start();
require_once '../conexao.php'; // Ajuste o caminho da conexão se necessário

header('Content-Type: application/json'); // Define o retorno como JSON

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nome           = trim($_POST['nome'] ?? '');
    $email          = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
    $telefone       = trim($_POST['telefone'] ?? '');
    $endereco       = trim($_POST['endereco'] ?? ''); // Novo campo
    $tipo_acesso    = $_POST['tipoConta'] ?? 'Produtor'; // Pego do input hidden
    $senha          = $_POST['senha'] ?? '';
    $confirmar_senha = $_POST['confirmarSenha'] ?? '';

    // Validações
    if (empty($nome) || !$email || empty($senha)) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Preencha todos os campos obrigatórios.']);
        exit;
    } elseif ($senha !== $confirmar_senha) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'As senhas não coincidem.']);
        exit;
    } elseif (strlen($senha) < 6) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'A senha deve ter no mínimo 6 caracteres.']);
        exit;
    }

    try {
        $senha_hash = password_hash($senha, PASSWORD_DEFAULT);

        // Inserção no banco (incluindo o endereço)
        $sql = "INSERT INTO usuarios (nome, email, telefone, endereco, senha_hash, tipo_acesso) 
                VALUES (:nome, :email, :telefone, :endereco, :senha_hash, :tipo_acesso)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':nome'        => $nome,
            ':email'       => $email,
            ':telefone'    => $telefone,
            ':endereco'    => $endereco,
            ':senha_hash'  => $senha_hash,
            ':tipo_acesso' => $tipo_acesso
        ]);

        echo json_encode(['sucesso' => true, 'mensagem' => 'Cadastro realizado com sucesso!']);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            echo json_encode(['sucesso' => false, 'mensagem' => 'Este e-mail já está cadastrado.']);
        } else {
            echo json_encode(['sucesso' => false, 'mensagem' => 'Erro no servidor. Tente novamente.']);
        }
    }
} else {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Método inválido.']);
}
?>