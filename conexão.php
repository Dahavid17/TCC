<?php

$host = "localhost";
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

?>