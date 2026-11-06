<?php

header('Content-Type: text/plain; charset=utf-8');

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
    die("ERRO: " . $conexao->connect_error);
}

echo "CONEXÃO COM MYSQL OK!";
