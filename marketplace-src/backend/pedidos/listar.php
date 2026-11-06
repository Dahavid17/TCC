<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// GET: pedidos em que o usuário é comprador ou vendedor.
exigir_metodo('GET');
$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare(
        'SELECT p.id, p.status, p.total, p.data_criacao, p.comprador_id, p.vendedor_id,
                c.nome AS comprador_nome, v.nome AS vendedor_nome
           FROM pedidos p
           JOIN usuarios c ON c.id = p.comprador_id
           JOIN usuarios v ON v.id = p.vendedor_id
          WHERE p.comprador_id = :comprador OR p.vendedor_id = :vendedor
          ORDER BY p.data_criacao DESC, p.id DESC'
    );
    $stmt->execute([':comprador' => $usuarioId, ':vendedor' => $usuarioId]);
    $linhas = $stmt->fetchAll();

    $itensPorPedido = [];

    if ($linhas) {
        $ids = array_column($linhas, 'id');
        $marcadores = implode(',', array_fill(0, count($ids), '?'));

        $stmt = $pdo->prepare("SELECT pedido_id, nome_produto, quantidade, preco_unitario FROM pedido_itens WHERE pedido_id IN ($marcadores) ORDER BY id");
        $stmt->execute($ids);

        foreach ($stmt->fetchAll() as $item) {
            $itensPorPedido[(int) $item['pedido_id']][] = [
                'nome'           => $item['nome_produto'],
                'quantidade'     => (int) $item['quantidade'],
                'preco_unitario' => (float) $item['preco_unitario'],
            ];
        }
    }

    $pedidos = array_map(function (array $p) use ($usuarioId, $itensPorPedido): array {
        $papel = (int) $p['vendedor_id'] === $usuarioId ? 'vendedor' : 'comprador';

        return [
            'id'          => (int) $p['id'],
            'status'      => $p['status'],
            'total'       => (float) $p['total'],
            'data'        => substr((string) $p['data_criacao'], 0, 10),
            'papel'       => $papel,
            'contraparte' => $papel === 'vendedor' ? $p['comprador_nome'] : $p['vendedor_nome'],
            'itens'       => $itensPorPedido[(int) $p['id']] ?? [],
            'transicoes'  => transicoes_permitidas($p['status'], $papel),
        ];
    }, $linhas);

    responder(200, ['sucesso' => true, 'pedidos' => $pedidos]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_PEDIDOS_LISTAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar os pedidos.']);
}
