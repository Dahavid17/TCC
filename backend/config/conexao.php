<?php

$host = "10.140.169.23";
$usuario = "root";
$senha = "123456";
$banco = "marketplace_rural";

$conexao = new mysqli(
    $host,
    $usuario,
    $senha,
    $banco
);

if ($conexao->connect_error) {
    throw new RuntimeException("Erro na conexão com o banco.");
}

$conexao->set_charset("utf8mb4");

?>
