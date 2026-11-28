<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// GET [?papel=compras|vendas] [&status=...] [&de=Y-m-d] [&ate=Y-m-d]
// Histórico completo de compras e vendas do usuário, com itens, se já avaliou a outra parte,
// totais por papel e por mês (sem pedidos cancelados).
exigir_metodo('GET');
$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    $where = ['(p.comprador_id = :u1 OR p.vendedor_id = :u2)'];
    $params = [':u1' => $usuarioId, ':u2' => $usuarioId];

    if (($_GET['papel'] ?? '') === 'compras') {
        $where = ['p.comprador_id = :u1'];
        unset($params[':u2']);
    } elseif (($_GET['papel'] ?? '') === 'vendas') {
        $where = ['p.vendedor_id = :u2'];
        unset($params[':u1']);
    }
    if (in_array($_GET['status'] ?? '', STATUS_PEDIDO, true)) {
        $where[] = 'p.status = :status';
        $params[':status'] = $_GET['status'];
    }
    foreach (['de' => '>=', 'ate' => '<='] as $campo => $op) {
        $valor = (string) ($_GET[$campo] ?? '');
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $valor) === 1) {
            $where[] = "DATE(p.data_criacao) $op :$campo";
            $params[":$campo"] = $valor;
        }
    }

    $stmt = $pdo->prepare(
        'SELECT p.id, p.status, p.total, p.data_criacao, p.data_atualizacao, p.comprador_id, p.vendedor_id,
                c.nome AS comprador_nome, v.nome AS vendedor_nome,
                (SELECT av.nota FROM avaliacoes av JOIN historico_transacoes h ON h.id = av.transacao_id WHERE h.pedido_id = p.id AND av.avaliador_id = :eu1) AS minha_nota,
                (SELECT av.nota FROM avaliacoes av JOIN historico_transacoes h ON h.id = av.transacao_id WHERE h.pedido_id = p.id AND av.avaliador_id <> :eu2) AS nota_recebida
           FROM pedidos p
           JOIN usuarios c ON c.id = p.comprador_id
           JOIN usuarios v ON v.id = p.vendedor_id
          WHERE ' . implode(' AND ', $where) . '
          ORDER BY p.data_criacao DESC, p.id DESC'
    );
    $stmt->execute($params + [':eu1' => $usuarioId, ':eu2' => $usuarioId]);
    $linhas = $stmt->fetchAll();

    $itens = [];
    if ($linhas) {
        $ids = array_map(fn($l) => (int) $l['id'], $linhas);
        $stmt = $pdo->prepare('SELECT pedido_id, anuncio_id, nome_produto, quantidade, preco_unitario FROM pedido_itens WHERE pedido_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') ORDER BY id');
        $stmt->execute($ids);
        foreach ($stmt->fetchAll() as $i) {
            $itens[(int) $i['pedido_id']][] = [
                'anuncio_id' => (int) $i['anuncio_id'], 'nome' => $i['nome_produto'],
                'quantidade' => (int) $i['quantidade'], 'preco_unitario' => (float) $i['preco_unitario'],
            ];
        }
    }

    $totais = ['compras' => ['pedidos' => 0, 'valor' => 0.0], 'vendas' => ['pedidos' => 0, 'valor' => 0.0]];
    $porMes = [];

    $pedidos = array_map(function (array $p) use ($usuarioId, $itens, &$totais, &$porMes): array {
        $papel = (int) $p['vendedor_id'] === $usuarioId ? 'vendedor' : 'comprador';
        $chave = $papel === 'vendedor' ? 'vendas' : 'compras';
        if ($p['status'] !== 'cancelado') {
            $totais[$chave]['pedidos']++;
            $totais[$chave]['valor'] += (float) $p['total'];
            $mes = substr((string) $p['data_criacao'], 0, 7);
            $porMes[$mes][$chave] = ($porMes[$mes][$chave] ?? 0) + (float) $p['total'];
        }

        return [
            'id'            => (int) $p['id'],
            'status'        => $p['status'],
            'total'         => (float) $p['total'],
            'data'          => $p['data_criacao'],
            'atualizado'    => $p['data_atualizacao'],
            'papel'         => $papel,
            'contraparte'   => $papel === 'vendedor' ? $p['comprador_nome'] : $p['vendedor_nome'],
            'contraparte_id' => (int) ($papel === 'vendedor' ? $p['comprador_id'] : $p['vendedor_id']),
            'itens'         => $itens[(int) $p['id']] ?? [],
            'minha_nota'    => $p['minha_nota'] === null ? null : (int) $p['minha_nota'],
            'nota_recebida' => $p['nota_recebida'] === null ? null : (int) $p['nota_recebida'],
            'pode_avaliar'  => $p['status'] === 'entregue' && $p['minha_nota'] === null,
        ];
    }, $linhas);

    ksort($porMes);
    $totais['compras']['valor'] = round($totais['compras']['valor'], 2);
    $totais['vendas']['valor'] = round($totais['vendas']['valor'], 2);

    responder(200, [
        'sucesso' => true,
        'pedidos' => $pedidos,
        'totais'  => $totais,
        'por_mes' => array_map(fn($m, $v) => ['mes' => $m, 'compras' => round($v['compras'] ?? 0, 2), 'vendas' => round($v['vendas'] ?? 0, 2)], array_keys($porMes), $porMes),
    ]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_PEDIDOS_HISTORICO] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar o histórico.']);
}
