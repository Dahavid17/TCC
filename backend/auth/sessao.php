<?php
// Arquivo: backend/auth/sessao.php
session_start();
header('Content-Type: application/json');

// Verifica se existe um ID de usuário na sessão
if (isset($_SESSION['usuario_id'])) {
    echo json_encode([
        'logado' => true,
        'id'    => $_SESSION['usuario_id'],
        'nome'  => $_SESSION['usuario_nome'],
        'email' => $_SESSION['usuario_email'],
        'tipo'  => $_SESSION['usuario_tipo']
    ]);
} else {
    // Se não estiver logado, avisa o frontend
    echo json_encode(['logado' => false]);
}
?>