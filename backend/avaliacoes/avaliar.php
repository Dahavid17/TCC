<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/notificacoes.php';

// POST: pedido_id, nota (1 a 5), comentario (opcional, até 500 caracteres)
// Só depois do pedido ENTREGUE e só por quem participou dele: o comprador avalia o vendedor
// e o vendedor avalia o comprador, uma vez cada.
//
// DER: a avaliação aponta para historico_transacoes (a venda concluída). Na primeira avaliação
// de um pedido entregue, o registro da venda é criado (um por pedido, pela coluna pedido_id).
// A nota de reputação (usuarios.nota_reputacao) é recalculada pela média das avaliações.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$pedidoId = filter_var($_POST['pedido_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$nota = filter_var($_POST['nota'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 5]]);
$comentario = trim((string) ($_POST['comentario'] ?? ''));

if ($pedidoId === false || $nota === false) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Escolha uma nota de 1 a 5 estrelas.']);
}
if (mb_strlen($comentario) > 500) {
    responder(422, ['sucesso' => false, 'mensagem' => 'O comentário pode ter no máximo 500 caracteres.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare(
        'SELECT p.id, p.comprador_id, p.vendedor_id, p.status, p.total, p.data_atualizacao,
                (SELECT i.anuncio_id FROM pedido_itens i WHERE i.pedido_id = p.id ORDER BY i.id LIMIT 1) AS anuncio_id
           FROM pedidos p WHERE p.id = :id AND (p.comprador_id = :u1 OR p.vendedor_id = :u2)'
    );
    $stmt->execute([':id' => $pedidoId, ':u1' => $usuarioId, ':u2' => $usuarioId]);
    $pedido = $stmt->fetch();

    if (!$pedido) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Pedido não encontrado.']);
    }
    if ($pedido['status'] !== 'entregue') {
        responder(422, ['sucesso' => false, 'mensagem' => 'A avaliação fica disponível depois que o pedido é entregue.']);
    }

    $avaliado = (int) $pedido['comprador_id'] === $usuarioId ? (int) $pedido['vendedor_id'] : (int) $pedido['comprador_id'];

    $pdo->beginTransaction();

    // Venda concluída (historico_transacoes) deste pedido.
    $pdo->prepare(
        'INSERT IGNORE INTO historico_transacoes (comprador_id, vendedor_id, anuncio_id, valor_final, data_venda, pedido_id)
         VALUES (:comprador, :vendedor, :anuncio, :valor, :data, :pedido)'
    )->execute([
        ':comprador' => $pedido['comprador_id'], ':vendedor' => $pedido['vendedor_id'], ':anuncio' => $pedido['anuncio_id'],
        ':valor' => $pedido['total'], ':data' => $pedido['data_atualizacao'] ?: date('Y-m-d H:i:s'), ':pedido' => $pedidoId,
    ]);
    $stmt = $pdo->prepare('SELECT id FROM historico_transacoes WHERE pedido_id = :pedido');
    $stmt->execute([':pedido' => $pedidoId]);
    $transacaoId = (int) $stmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT id FROM avaliacoes WHERE transacao_id = :transacao AND avaliador_id = :usuario');
    $stmt->execute([':transacao' => $transacaoId, ':usuario' => $usuarioId]);
    if ($stmt->fetchColumn()) {
        $pdo->rollBack();
        responder(409, ['sucesso' => false, 'mensagem' => 'Você já avaliou este pedido.']);
    }

    $pdo->prepare(
        'INSERT INTO avaliacoes (avaliador_id, avaliado_id, transacao_id, nota, comentario)
         VALUES (:avaliador, :avaliado, :transacao, :nota, :comentario)'
    )->execute([
        ':avaliador' => $usuarioId, ':avaliado' => $avaliado, ':transacao' => $transacaoId,
        ':nota' => $nota, ':comentario' => $comentario === '' ? null : $comentario,
    ]);

    $stmt = $pdo->prepare('SELECT AVG(nota) FROM avaliacoes WHERE avaliado_id = :id');
    $stmt->execute([':id' => $avaliado]);
    $media = round((float) $stmt->fetchColumn(), 2);
    $pdo->prepare('UPDATE usuarios SET nota_reputacao = :media WHERE id = :id')->execute([':media' => $media, ':id' => $avaliado]);

    $pdo->commit();

    notificar($pdo, $avaliado, 'avaliacao', 'Você recebeu uma avaliação de ' . $nota . ' estrela(s)',
        'Pedido #' . $pedidoId . ($comentario !== '' ? ': "' . mb_substr($comentario, 0, 180) . '"' : '.'), 'historico.html');

    responder(201, ['sucesso' => true, 'mensagem' => 'Obrigado pela avaliação!', 'nova_media' => $media]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[MARKETPLACE_AVALIAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível registrar a avaliação.']);
}
