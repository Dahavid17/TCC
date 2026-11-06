<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// GET: conversas em que o usuário é comprador ou vendedor, da mais recente para a mais antiga.
exigir_metodo('GET');
$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare(
        "SELECT g.anuncio_id, g.comprador_id, g.vendedor_id, g.nao_lidas, g.propostas_enviadas,
                m.mensagem AS ultima_texto, m.tipo AS ultima_tipo, m.valor_proposta AS ultima_valor,
                m.remetente_id AS ultima_remetente, UNIX_TIMESTAMP(m.data_hora) AS ultima_em,
                a.titulo AS produto_nome, a.preco AS produto_preco, a.status AS produto_status,
                (SELECT f.url_imagem FROM anuncios_fotos f
                  WHERE f.anuncio_id = a.id ORDER BY f.ordem, f.id LIMIT 1) AS produto_imagem,
                uc.nome AS comprador_nome, uv.nome AS vendedor_nome,
                EXISTS (SELECT 1 FROM pedidos p
                          JOIN pedido_itens i ON i.pedido_id = p.id
                         WHERE p.comprador_id = g.comprador_id AND p.vendedor_id = g.vendedor_id
                           AND i.anuncio_id = g.anuncio_id AND p.status = 'entregue') AS concluida
           FROM (SELECT c.anuncio_id, c.comprador_id, c.vendedor_id,
                        MAX(c.id) AS ultima_id,
                        SUM(c.remetente_id <> :eu1 AND c.lida_em IS NULL) AS nao_lidas,
                        SUM(c.tipo = 'proposta' AND c.remetente_id = :eu2) AS propostas_enviadas
                   FROM chats c
                  WHERE c.comprador_id = :eu3 OR c.vendedor_id = :eu4
                  GROUP BY c.anuncio_id, c.comprador_id, c.vendedor_id) g
           JOIN chats m ON m.id = g.ultima_id
           JOIN anuncios a ON a.id = g.anuncio_id
           JOIN usuarios uc ON uc.id = g.comprador_id
           JOIN usuarios uv ON uv.id = g.vendedor_id
          ORDER BY g.ultima_id DESC"
    );
    $stmt->execute([':eu1' => $usuarioId, ':eu2' => $usuarioId, ':eu3' => $usuarioId, ':eu4' => $usuarioId]);

    $conversas = array_map(function (array $c) use ($usuarioId): array {
        $papel = (int) $c['vendedor_id'] === $usuarioId ? 'vendedor' : 'comprador';
        $minha = (int) $c['ultima_remetente'] === $usuarioId;

        return [
            'anuncio_id'          => (int) $c['anuncio_id'],
            'comprador_id'        => (int) $c['comprador_id'],
            'papel'               => $papel,
            'contraparte'         => [
                'id'   => (int) ($papel === 'vendedor' ? $c['comprador_id'] : $c['vendedor_id']),
                'nome' => $papel === 'vendedor' ? $c['comprador_nome'] : $c['vendedor_nome'],
            ],
            'produto'             => [
                'id'     => (int) $c['anuncio_id'],
                'nome'   => $c['produto_nome'],
                'preco'  => (float) $c['produto_preco'],
                'imagem' => $c['produto_imagem'],
                'status' => $c['produto_status'],
            ],
            'ultima'              => [
                'texto' => $c['ultima_texto'],
                'tipo'  => $c['ultima_tipo'],
                'valor' => $c['ultima_valor'] !== null ? (float) $c['ultima_valor'] : null,
                'minha' => $minha,
                'em'    => (int) $c['ultima_em'],
            ],
            'nao_lidas'           => (int) $c['nao_lidas'],
            'propostas_enviadas'  => (int) $c['propostas_enviadas'],
            'aguardando_resposta' => !$minha,
            'concluida'           => (bool) $c['concluida'],
        ];
    }, $stmt->fetchAll());

    responder(200, ['sucesso' => true, 'conversas' => $conversas]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_NEGOCIACOES_LISTAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar as negociações.']);
}
