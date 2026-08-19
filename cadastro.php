<?php

require_once "conexao.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Location: cadastro.html");
    exit;
}


/* ==========================================
   RECEBER DADOS
========================================== */

$nome = trim($_POST["nome"] ?? "");
$email = trim($_POST["email"] ?? "");
$telefone = trim($_POST["telefone"] ?? "");
$senha = $_POST["senha"] ?? "";
$confirmarSenha = $_POST["confirmarSenha"] ?? "";
$tipo = $_POST["tipo"] ?? "";


/* ==========================================
   VERIFICAR CAMPOS
========================================== */

if (
    empty($nome) ||
    empty($email) ||
    empty($telefone) ||
    empty($senha) ||
    empty($confirmarSenha) ||
    empty($tipo)
) {
    die("Preencha todos os campos.");
}


/* ==========================================
   VERIFICAR EMAIL
========================================== */

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    die("Digite um e-mail válido.");
}


/* ==========================================
   VERIFICAR SENHAS
========================================== */

if ($senha !== $confirmarSenha) {
    die("As senhas não são iguais.");
}


/* ==========================================
   VERIFICAR TIPO
========================================== */

if ($tipo !== "produtor" && $tipo !== "comprador") {
    die("Tipo de conta inválido.");
}


/* ==========================================
   VERIFICAR EMAIL EXISTENTE
========================================== */

$sql = "SELECT id FROM usuarios WHERE email = ?";

$stmt = $conexao->prepare($sql);

$stmt->bind_param("s", $email);

$stmt->execute();

$resultado = $stmt->get_result();

if ($resultado->num_rows > 0) {
    die("Este e-mail já está cadastrado.");
}


/* ==========================================
   PROTEGER SENHA
========================================== */

$senhaHash = password_hash($senha, PASSWORD_DEFAULT);


/* ==========================================
   CADASTRAR
========================================== */

$sql = "INSERT INTO usuarios
        (nome, email, telefone, senha, tipo)
        VALUES (?, ?, ?, ?, ?)";

$stmt = $conexao->prepare($sql);

$stmt->bind_param(
    "sssss",
    $nome,
    $email,
    $telefone,
    $senhaHash,
    $tipo
);


/* ==========================================
   RESULTADO
========================================== */

if ($stmt->execute()) {

?>

<!DOCTYPE html>

<html lang="pt-BR">

<head>

    <meta charset="UTF-8">

    <meta name="viewport"
          content="width=device-width, initial-scale=1.0">

    <title>Cadastro realizado</title>

    <style>

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            min-height: 100vh;

            display: flex;
            align-items: center;
            justify-content: center;

            background: #eef5e8;

            font-family: Arial, sans-serif;
        }

        .caixa {
            width: 420px;
            max-width: 90%;

            padding: 40px;

            background: white;

            border-radius: 20px;

            text-align: center;

            box-shadow: 0 10px 30px rgba(0,0,0,.12);
        }

        .icone {
            width: 70px;
            height: 70px;

            margin: 0 auto 20px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 50%;

            background: #31572c;
            color: white;

            font-size: 36px;
        }

        h1 {
            color: #31572c;
            margin-bottom: 12px;
        }

        p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 25px;
        }

        .botao {
            display: inline-block;

            padding: 13px 25px;

            background: #31572c;
            color: white;

            text-decoration: none;

            border-radius: 10px;

            font-weight: bold;
        }

        .botao:hover {
            background: #3f6d38;
        }

    </style>

</head>

<body>

    <div class="caixa">

        <div class="icone">
            ✓
        </div>

        <h1>
            Cadastro realizado!
        </h1>

        <p>
            Sua conta foi criada com sucesso.
            Agora você já pode acessar o Marketplace Rural.
        </p>

        <a
            href="login-marketplace.html"
            class="botao">

            Fazer login

        </a>

    </div>

</body>

</html>

<?php

} else {

    echo "Erro ao cadastrar usuário: " . $stmt->error;

}

?>