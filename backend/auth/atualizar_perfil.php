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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');

    responder(405, [
        'sucesso' => false,
        'mensagem' => 'Método não permitido.'
    ]);
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
    $nome = trim($_POST['nome'] ?? '');
    $telefone = trim($_POST['telefone'] ?? '');
    $cidade = trim($_POST['cidade'] ?? '');

    if ($nome === '' || $telefone === '' || $cidade === '') {
        responder(422, [
            'sucesso' => false,
            'mensagem' => 'Preencha o nome, telefone e cidade.'
        ]);
    }

    if (mb_strlen($nome) > 150) {
        responder(422, [
            'sucesso' => false,
            'mensagem' => 'O nome pode ter no máximo 150 caracteres.'
        ]);
    }

    if (mb_strlen($telefone) > 20) {
        responder(422, [
            'sucesso' => false,
            'mensagem' => 'O telefone pode ter no máximo 20 caracteres.'
        ]);
    }

    if (mb_strlen($cidade) > 100) {
        responder(422, [
            'sucesso' => false,
            'mensagem' => 'A cidade pode ter no máximo 100 caracteres.'
        ]);
    }

    $sql = 'UPDATE usuarios
            SET nome = :nome,
                telefone = :telefone,
                cidade = :cidade
            WHERE id = :id';

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        ':nome' => $nome,
        ':telefone' => $telefone,
        ':cidade' => $cidade,
        ':id' => $id
    ]);

    $_SESSION['usuario_nome'] = $nome;

    // Devolve o perfil como está no banco (mesmo formato do sessao.php), incluindo a
    // foto de perfil: antes ela não vinha aqui e a tela achava que a foto tinha sumido.
    $consulta = 'SELECT id, nome, email, telefone, cidade, endereco, tipo_acesso, foto_perfil
                   FROM usuarios WHERE id = :id LIMIT 1';

    try {
        $stmt = $pdo->prepare($consulta);
        $stmt->execute([':id' => $id]);
    } catch (PDOException $semColunaFoto) {
        $stmt = $pdo->prepare(str_replace(', foto_perfil', '', $consulta));
        $stmt->execute([':id' => $id]);
    }

    $usuario = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $usuario['id'] = $id;
    $usuario['foto_perfil'] = $usuario['foto_perfil'] ?? null;

    responder(200, [
        'sucesso' => true,
        'mensagem' => 'Perfil atualizado com sucesso!',
        'usuario' => $usuario
    ]);

} catch (Throwable $erro) {
    error_log(
        '[MARKETPLACE_ATUALIZAR_PERFIL] ' .
        $erro->getMessage()
    );

    responder(500, [
        'sucesso' => false,
        'mensagem' => 'Não foi possível atualizar o perfil.'
    ]);
}
