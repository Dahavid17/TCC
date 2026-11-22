<?php
declare(strict_types=1);

// Cria a conta e já envia o código de confirmação: a conta só entra no painel depois que a pessoa
// digita o código que chegou no e-mail (backend/lib/verificacao_email.php).

session_start();

header('Content-Type: application/json; charset=utf-8');

function responder(int $status, array $dados): never
{
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    responder(405, ['sucesso' => false, 'mensagem' => 'Método inválido.']);
}

require_once __DIR__ . '/../config/conexao.php';
require_once __DIR__ . '/../lib/verificacao_email.php';

$nome            = trim($_POST['nome'] ?? '');
$email           = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
$telefone        = trim($_POST['telefone'] ?? '');
$endereco        = trim($_POST['endereco'] ?? '');
$tipoAcesso      = strtolower(trim($_POST['tipoConta'] ?? 'produtor'));
$senha           = $_POST['senha'] ?? '';
$confirmarSenha  = $_POST['confirmarSenha'] ?? '';

// Auto-cadastro só cria produtor ou comprador; 'admin' nunca vem do formulário.
if (!in_array($tipoAcesso, ['produtor', 'comprador'], true)) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Tipo de conta inválido.']);
}

if ($nome === '' || !$email || $senha === '') {
    responder(422, ['sucesso' => false, 'mensagem' => 'Preencha todos os campos obrigatórios.']);
}

if ($senha !== $confirmarSenha) {
    responder(422, ['sucesso' => false, 'mensagem' => 'As senhas não coincidem.']);
}

if (strlen($senha) < 6) {
    responder(422, ['sucesso' => false, 'mensagem' => 'A senha deve ter no mínimo 6 caracteres.']);
}

if (mb_strlen($nome) > 150 || mb_strlen($email) > 150 || mb_strlen($telefone) > 20 || mb_strlen($endereco) > 255) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Algum campo excede o tamanho permitido.']);
}

// Domínio que não recebe e-mail (ex.: gmail.com.br) é recusado antes de criar a conta.
$problemaEmail = problema_no_email($email);

if ($problemaEmail !== null) {
    responder(422, ['sucesso' => false, 'mensagem' => $problemaEmail]);
}

try {
    garantir_verificacao_email($pdo);

    $stmt = $pdo->prepare(
        'INSERT INTO usuarios (nome, email, telefone, endereco, senha_hash, tipo_acesso, email_verificado)
         VALUES (:nome, :email, :telefone, :endereco, :senha_hash, :tipo_acesso, 0)'
    );
    $stmt->execute([
        ':nome'        => $nome,
        ':email'       => $email,
        ':telefone'    => $telefone,
        ':endereco'    => $endereco,
        ':senha_hash'  => password_hash($senha, PASSWORD_DEFAULT),
        ':tipo_acesso' => $tipoAcesso,
    ]);

    // Conta criada, mas ainda sem acesso: fica aguardando o código.
    $usuarioId = (int) $pdo->lastInsertId();
    session_regenerate_id(true);
    $_SESSION['verificar_usuario_id'] = $usuarioId;

    [$enviado, $mensagemCodigo] = enviar_codigo_verificacao($pdo, $usuarioId, $email);

    responder(201, [
        'sucesso'           => true,
        'precisa_verificar' => true,
        'codigo_enviado'    => $enviado,
        'email'             => $email,
        'mensagem'          => $enviado ? 'Conta criada! ' . $mensagemCodigo : 'Conta criada, mas ' . lcfirst($mensagemCodigo),
    ]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        responder(409, ['sucesso' => false, 'mensagem' => 'Este e-mail já está cadastrado.']);
    }

    error_log('[MARKETPLACE_CADASTRO] ' . $e->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Erro no servidor. Tente novamente.']);
}
