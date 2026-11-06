<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// POST: id, status — aplica uma transição permitida ao papel do usuário. Cancelar devolve o estoque.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$pedidoId = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$novoStatus = (string) ($_POST['status'] ?? '');

if ($pedidoId === false || !in_array($novoStatus, STATUS_PEDIDO, true)) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Pedido ou status inválido.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT id, comprador_id, vendedor_id, status FROM pedidos WHERE id = :id FOR UPDATE');
    $stmt->execute([':id' => $pedidoId]);
    $pedido = $stmt->fetch();

    $participa = $pedido && ((int) $pedido['comprador_id'] === $usuarioId || (int) $pedido['vendedor_id'] === $usuarioId);

    if (!$participa) {
        $pdo->rollBack();
        responder(404, ['sucesso' => false, 'mensagem' => 'Pedido não encontrado.']);
    }

    $papel = (int) $pedido['vendedor_id'] === $usuarioId ? 'vendedor' : 'comprador';

    if (!in_array($novoStatus, transicoes_permitidas($pedido['status'], $papel), true)) {
        $pdo->rollBack();
        responder(403, ['sucesso' => false, 'mensagem' => 'Você não pode alterar este pedido para esse status.']);
    }

    if ($novoStatus === 'cancelado') {
        $pdo->prepare(
            'UPDATE anuncios a
               JOIN pedido_itens i ON i.anuncio_id = a.id
                SET a.quantidade_estoque = a.quantidade_estoque + i.quantidade
              WHERE i.pedido_id = :id'
        )->execute([':id' => $pedidoId]);
    }

    $pdo->prepare('UPDATE pedidos SET status = :status WHERE id = :id')
        ->execute([':status' => $novoStatus, ':id' => $pedidoId]);

    $pdo->commit();

    responder(200, ['sucesso' => true, 'mensagem' => 'Pedido atualizado.']);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[MARKETPLACE_PEDIDOS_ATUALIZAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível atualizar o pedido.']);
}
