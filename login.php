<?php

session_start();

require_once("conexao.php");

if ($_SERVER["REQUEST_METHOD"] != "POST") {
    header("Location: login-marketplace.html");
    exit();
}

$email = trim($_POST["email"]);
$senha = trim($_POST["senha"]);

if (empty($email) || empty($senha)) {
    die("Preencha todos os campos.");
}

$stmt = $conexao->prepare(
    "SELECT * FROM usuarios WHERE email = ?"
);

$stmt->bind_param("s", $email);

$stmt->execute();

$resultado = $stmt->get_result();

if ($resultado->num_rows == 0) {
    die("E-mail não encontrado no banco de dados.");
}

$usuario = $resultado->fetch_assoc();

if ($senha !== $usuario["senha"]) {
    die("Senha incorreta.");
}

/* ================================
   LOGIN CORRETO
================================ */

$_SESSION["id"] = $usuario["id"];
$_SESSION["nome"] = $usuario["nome"];
$_SESSION["email"] = $usuario["email"];
$_SESSION["tipo"] = $usuario["tipo"];

/* Vai para a tela de teste */
header("Location: teste-login.html");
exit();

?>