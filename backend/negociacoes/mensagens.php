<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/negociacoes.php';

// GET: anuncio_id, comprador_id (só o vendedor informa), depois (id da última mensagem já exibida).
// Devolve os dados da conversa e as mensagens; as recebidas passam a contar como lidas.
exigir_metodo('GET');
$usuarioId = exigir_sessao();

$anuncioId   = filter_var($_GET['anuncio_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$compradorId = filter_var($_GET['comprador_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$depois      = filter_var($_GET['depois'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);

if ($anuncioId === false) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Conversa inválida.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $conversa = identificar_conversa($pdo, $usuarioId, $anuncioId, $compradorId === false ? null : $compradorId);
    $chave = [':anuncio' => $conversa['anuncio_id'], ':comprador' => $conversa['comprador_id']];
    $linhas = [];

    if ($conversa['existe']) {
        if ($depois) {
            $stmt = $pdo->prepare(SQL_MENSAGEM . ' WHERE anuncio_id = :anuncio AND comprador_id = :comprador AND id > :depois ORDER BY id LIMIT 200');
            $stmt->execute($chave + [':depois' => $depois]);
            $linhas = $stmt->fetchAll();
        } else {
            // Primeira carga: as 300 mais recentes, em ordem cronológica.
            $stmt = $pdo->prepare(SQL_MENSAGEM . ' WHERE anuncio_id = :anuncio AND comprador_id = :comprador ORDER BY id DESC LIMIT 300');
            $stmt->execute($chave);
            $linhas = array_reverse($stmt->fetchAll());
        }

        $pdo->prepare('UPDATE chats SET lida_em = NOW() WHERE anuncio_id = :anuncio AND comprador_id = :comprador AND remetente_id <> :eu AND lida_em IS NULL')
            ->execute($chave + [':eu' => $usuarioId]);
    }

    $conversa['concluida'] = negociacao_concluida($pdo, $conversa['anuncio_id'], $conversa['comprador_id'], $conversa['vendedor_id']);
    $conversa['pode_enviar'] = $conversa['existe'] || $conversa['produto']['status'] !== 'inativo';

    responder(200, [
        'sucesso'   => true,
        'conversa'  => $conversa,
        'mensagens' => array_map(fn(array $m): array => formatar_mensagem($m, $usuarioId), $linhas),
    ]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_NEGOCIACOES_MENSAGENS] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar as mensagens.']);
}
