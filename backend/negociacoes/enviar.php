<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/negociacoes.php';
require_once __DIR__ . '/../lib/notificacoes.php';

// POST: anuncio_id, comprador_id (só o vendedor informa), mensagem,
//       tipo = texto | proposta e valor (obrigatório quando tipo = proposta).
// O comprador abre a conversa ao enviar a primeira mensagem; o vendedor só responde.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$anuncioId   = filter_var($_POST['anuncio_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$compradorId = filter_var($_POST['comprador_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$tipo        = (string) ($_POST['tipo'] ?? 'texto');
$texto       = trim((string) ($_POST['mensagem'] ?? ''));
$valor       = null;

if ($anuncioId === false) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Conversa inválida.']);
}

if (!in_array($tipo, ['texto', 'proposta'], true)) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Tipo de mensagem inválido.']);
}

if (!mb_check_encoding($texto, 'UTF-8')) {
    responder(422, ['sucesso' => false, 'mensagem' => 'A mensagem contém caracteres inválidos.']);
}

if (mb_strlen($texto) > TAMANHO_MAX_MENSAGEM) {
    responder(422, ['sucesso' => false, 'mensagem' => 'A mensagem pode ter no máximo ' . TAMANHO_MAX_MENSAGEM . ' caracteres.']);
}

if ($tipo === 'proposta') {
    $bruto = str_replace(',', '.', trim((string) ($_POST['valor'] ?? '')));

    if (!is_numeric($bruto) || (float) $bruto <= 0 || (float) $bruto > 9999999999.99) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Informe um valor de proposta maior que zero.']);
    }

    $valor = number_format((float) $bruto, 2, '.', '');
} elseif ($texto === '') {
    responder(422, ['sucesso' => false, 'mensagem' => 'Escreva uma mensagem.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $conversa = identificar_conversa($pdo, $usuarioId, $anuncioId, $compradorId === false ? null : $compradorId);

    if (!$conversa['existe'] && $conversa['produto']['status'] === 'inativo') {
        responder(404, ['sucesso' => false, 'mensagem' => 'Produto indisponível.']);
    }

    $pdo->prepare(
        'INSERT INTO chats (comprador_id, vendedor_id, anuncio_id, remetente_id, tipo, mensagem, valor_proposta)
         VALUES (:comprador, :vendedor, :anuncio, :remetente, :tipo, :mensagem, :valor)'
    )->execute([
        ':comprador' => $conversa['comprador_id'],
        ':vendedor'  => $conversa['vendedor_id'],
        ':anuncio'   => $conversa['anuncio_id'],
        ':remetente' => $usuarioId,
        ':tipo'      => $tipo,
        ':mensagem'  => $texto,
        ':valor'     => $valor,
    ]);

    $stmt = $pdo->prepare(SQL_MENSAGEM . ' WHERE id = :id');
    $stmt->execute([':id' => (int) $pdo->lastInsertId()]);
    $enviada = $stmt->fetch();

    // Aviso para quem recebe. Mensagens seguidas da mesma conversa viram UM aviso (grupo).
    $destinatario = $usuarioId === (int) $conversa['vendedor_id'] ? (int) $conversa['comprador_id'] : (int) $conversa['vendedor_id'];
    $link = 'negociacoes.html?anuncio=' . (int) $conversa['anuncio_id'];

    if ($destinatario === (int) $conversa['vendedor_id']) {
        $link .= '&comprador=' . (int) $conversa['comprador_id'];
    }

    $remetente = nome_curto($pdo, $usuarioId);
    $produto = $conversa['produto']['nome'] ?? 'produto';

    if ($tipo === 'proposta') {
        notificar($pdo, $destinatario, 'proposta', 'Nova proposta de ' . $remetente,
            'R$ ' . number_format((float) $valor, 2, ',', '.') . ' por ' . $produto . '.', $link);
    } else {
        notificar($pdo, $destinatario, 'mensagem', 'Nova mensagem de ' . $remetente,
            $produto . ': "' . mb_strimwidth($texto, 0, 80, '…') . '"', $link,
            'chat:' . (int) $conversa['anuncio_id'] . ':' . (int) $conversa['comprador_id']);
    }

    responder(201, [
        'sucesso'  => true,
        'mensagem' => $tipo === 'proposta' ? 'Proposta enviada.' : 'Mensagem enviada.',
        'enviada'  => formatar_mensagem($enviada, $usuarioId),
    ]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_NEGOCIACOES_ENVIAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível enviar a mensagem.']);
}
