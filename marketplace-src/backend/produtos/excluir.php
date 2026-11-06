<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// POST: id — exclusão lógica (status = 'inativo'); chats e histórico continuam referenciando o anúncio.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$produtoId = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

if ($produtoId === false) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Produto inválido.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare("SELECT id FROM anuncios WHERE id = :id AND vendedor_id = :usuario AND status <> 'inativo'");
    $stmt->execute([':id' => $produtoId, ':usuario' => $usuarioId]);

    if (!$stmt->fetchColumn()) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Produto não encontrado.']);
    }

    $pdo->prepare("UPDATE anuncios SET status = 'inativo' WHERE id = :id AND vendedor_id = :usuario")
        ->execute([':id' => $produtoId, ':usuario' => $usuarioId]);

    responder(200, ['sucesso' => true, 'mensagem' => 'Produto excluído.']);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_PRODUTOS_EXCLUIR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível excluir o produto.']);
}
