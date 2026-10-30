<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// POST: anuncio_id, quantidade — o estoque é reservado (reduzido) na criação.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$anuncioId  = filter_var($_POST['anuncio_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$quantidade = filter_var($_POST['quantidade'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000000]]);

if ($anuncioId === false || $quantidade === false) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Informe o produto e uma quantidade válida (1 ou mais).']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $pdo->beginTransaction();

    // Trava a linha do produto para que dois pedidos simultâneos não vendam o mesmo estoque.
    $stmt = $pdo->prepare('SELECT id, vendedor_id, titulo, preco, quantidade_estoque, status FROM anuncios WHERE id = :id FOR UPDATE');
    $stmt->execute([':id' => $anuncioId]);
    $produto = $stmt->fetch();

    if (!$produto || $produto['status'] !== 'ativo') {
        $pdo->rollBack();
        responder(404, ['sucesso' => false, 'mensagem' => 'Produto indisponível.']);
    }

    if ((int) $produto['vendedor_id'] === $usuarioId) {
        $pdo->rollBack();
        responder(422, ['sucesso' => false, 'mensagem' => 'Você não pode comprar o seu próprio produto.']);
    }

    if ((int) $produto['quantidade_estoque'] < $quantidade) {
        $pdo->rollBack();
        responder(409, ['sucesso' => false, 'mensagem' => 'Estoque insuficiente. Disponível: ' . (int) $produto['quantidade_estoque'] . '.']);
    }

    $total = number_format(round((float) $produto['preco'] * $quantidade, 2), 2, '.', '');

    $pdo->prepare('UPDATE anuncios SET quantidade_estoque = quantidade_estoque - :qtd WHERE id = :id')
        ->execute([':qtd' => $quantidade, ':id' => $anuncioId]);

    $pdo->prepare("INSERT INTO pedidos (comprador_id, vendedor_id, status, total) VALUES (:comprador, :vendedor, 'recebido', :total)")
        ->execute([':comprador' => $usuarioId, ':vendedor' => $produto['vendedor_id'], ':total' => $total]);
    $pedidoId = (int) $pdo->lastInsertId();

    $pdo->prepare('INSERT INTO pedido_itens (pedido_id, anuncio_id, nome_produto, quantidade, preco_unitario) VALUES (:pedido, :anuncio, :nome, :qtd, :preco)')
        ->execute([
            ':pedido'  => $pedidoId,
            ':anuncio' => $anuncioId,
            ':nome'    => $produto['titulo'],
            ':qtd'     => $quantidade,
            ':preco'   => $produto['preco'],
        ]);

    $pdo->commit();

    responder(201, ['sucesso' => true, 'mensagem' => 'Pedido realizado com sucesso!', 'pedido_id' => $pedidoId]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[MARKETPLACE_PEDIDOS_CRIAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível registrar o pedido.']);
}
