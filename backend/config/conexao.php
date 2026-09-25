<?php

$host = "10.140.169.34";
$usuario = "root";
$senha = "123456";
$banco = "marketplace_rural";

// --- LINHA QUE ESTAVA FALTANDO ---
$conexao = new mysqli($host, $usuario, $senha, $banco);

// Verifica se ocorreu algum erro ao tentar conectar
if ($conexao->connect_error) {
    throw new RuntimeException("Erro na conexão com o banco: " . $conexao->connect_error);
}

$conexao->set_charset("utf8mb4");

?>