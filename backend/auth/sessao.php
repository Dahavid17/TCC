
<?php
declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

function responder(int $status, array $dados): never
{
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

if (empty($_SESSION['usuario_id'])) {
    responder(401, [
        'sucesso' => false,
        'mensagem' => 'Sua sessão expirou. Entre novamente.'
    ]);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $id = (int) $_SESSION['usuario_id'];

    $sql = 'SELECT id, nome, email, telefone, cidade, tipo_acesso
            FROM usuarios
            WHERE id = :id
            LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $id]);

    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$usuario) {
        session_unset();
        session_destroy();

        responder(401, [
            'sucesso' => false,
            'mensagem' => 'Usuário não encontrado. Entre novamente.'
        ]);
    }

    $_SESSION['usuario_nome'] = $usuario['nome'];
    $_SESSION['usuario_email'] = $usuario['email'];
    $_SESSION['usuario_tipo'] = $usuario['tipo_acesso'];

    responder(200, [
        'sucesso' => true,
        'usuario' => $usuario
    ]);

} catch (Throwable $erro) {
    error_log('[MARKETPLACE_SESSAO] ' . $erro->getMessage());

    responder(500, [
        'sucesso' => false,
        'mensagem' => 'Não foi possível carregar os dados do perfil.'
    ]);
}
