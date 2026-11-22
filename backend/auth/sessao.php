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
    require_once __DIR__ . '/../lib/verificacao_email.php';

    $id = (int) $_SESSION['usuario_id'];

    $sql = 'SELECT id, nome, email, telefone, cidade, endereco, tipo_acesso, foto_perfil
            FROM usuarios
            WHERE id = :id
            LIMIT 1';

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
    } catch (PDOException $semColunaFoto) {
        // Banco sem a migração 007 (coluna foto_perfil): segue sem a foto.
        $stmt = $pdo->prepare(str_replace(', foto_perfil', '', $sql));
        $stmt->execute([':id' => $id]);
    }

    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($usuario) {
        $usuario['foto_perfil'] = $usuario['foto_perfil'] ?? null;
    }

    if (!$usuario) {
        session_unset();
        session_destroy();

        responder(401, [
            'sucesso' => false,
            'mensagem' => 'Usuário não encontrado. Entre novamente.'
        ]);
    }

    // Quem já estava logado antes da verificação existir também precisa confirmar o e-mail.
    if (!email_verificado($pdo, $id)) {
        session_unset();
        $_SESSION['verificar_usuario_id'] = $id;

        responder(401, [
            'sucesso'           => false,
            'precisa_verificar' => true,
            'mensagem'          => 'Confirme seu e-mail para continuar. Entre de novo com seu e-mail e senha.'
        ]);
    }

    $_SESSION['usuario_nome'] = $usuario['nome'];
    $_SESSION['usuario_email'] = $usuario['email'];
    $_SESSION['usuario_tipo'] = $usuario['tipo_acesso'];

    // Contrato único: { sucesso, usuario: { id, nome, email, telefone, cidade, endereco, tipo_acesso, foto_perfil } }
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
