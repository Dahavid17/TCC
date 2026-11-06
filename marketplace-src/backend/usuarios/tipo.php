<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// POST: tipo = produtor | comprador — o usuário altera o tipo da própria conta.
// Administradores não são alterados por aqui. O tipo só controla o acesso à Gestão da Fazenda;
// comprar e vender continuam liberados para qualquer conta.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$tipo = (string) ($_POST['tipo'] ?? '');

if (!in_array($tipo, ['produtor', 'comprador'], true)) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Tipo de conta inválido.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare('SELECT tipo_acesso FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);
    $atual = $stmt->fetchColumn();

    if ($atual === false) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Usuário não encontrado.']);
    }

    if ($atual === 'admin') {
        responder(403, ['sucesso' => false, 'mensagem' => 'O tipo de uma conta administradora não pode ser alterado aqui.']);
    }

    $pdo->prepare('UPDATE usuarios SET tipo_acesso = :tipo WHERE id = :id')
        ->execute([':tipo' => $tipo, ':id' => $usuarioId]);

    $_SESSION['usuario_tipo'] = $tipo;

    responder(200, ['sucesso' => true, 'mensagem' => 'Tipo de conta atualizado.', 'tipo_acesso' => $tipo]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_USUARIOS_TIPO] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível alterar o tipo de conta.']);
}
