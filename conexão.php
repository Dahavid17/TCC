<?php

$host = "10.140.169.9";
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
    die("Erro na conexão com o banco: " . $conexao->connect_error);
}

$conexao->set_charset("utf8mb4");

?>
