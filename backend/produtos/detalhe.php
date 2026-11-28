<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// GET ?id=N: detalhes do produto para a página/modal do catálogo:
// galeria de fotos, vendedor com reputação e últimas avaliações, histórico de preço,
// se está nos favoritos e se o usuário tem alerta de preço para ele.
exigir_metodo('GET');
$usuarioId = exigir_sessao();

$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($id === false || $id === null) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Produto inválido.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare(SQL_PRODUTO . " WHERE a.id = :id AND (a.status = 'ativo' OR a.vendedor_id = :usuario)");
    $stmt->execute([':id' => $id, ':usuario' => $usuarioId]);
    $linha = $stmt->fetch();
    if (!$linha) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Produto não encontrado.']);
    }
    $produto = normalizar_produto($linha);

    $stmt = $pdo->prepare('SELECT id, url_imagem FROM anuncios_fotos WHERE anuncio_id = :id ORDER BY ordem, id');
    $stmt->execute([':id' => $id]);
    $produto['fotos'] = array_map(fn($f) => ['id' => (int) $f['id'], 'url' => $f['url_imagem']], $stmt->fetchAll());

    $stmt = $pdo->prepare('SELECT nome, cidade, data_criacao FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $produto['vendedor_id']]);
    $vendedor = $stmt->fetch() ?: [];

    $stmt = $pdo->prepare(
        'SELECT av.nota, av.comentario, av.data_criacao AS data_avaliacao, u.nome AS avaliador
           FROM avaliacoes av JOIN usuarios u ON u.id = av.avaliador_id
          WHERE av.avaliado_id = :vendedor ORDER BY av.data_criacao DESC, av.id DESC LIMIT 5'
    );
    $stmt->execute([':vendedor' => $produto['vendedor_id']]);
    $avaliacoes = $stmt->fetchAll();

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM pedidos WHERE vendedor_id = :vendedor AND status = \'entregue\'');
    $stmt->execute([':vendedor' => $produto['vendedor_id']]);
    $vendas = (int) $stmt->fetchColumn();

    // Preço médio do produto na plataforma (cotacoes_mercado, geral) nos últimos 90 dias.
    $stmt = $pdo->prepare(
        "SELECT preco_medio, data_registro FROM cotacoes_mercado
          WHERE commodity_insumo = :chave AND regiao IS NULL AND data_registro >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
          ORDER BY data_registro"
    );
    $stmt->execute([':chave' => $produto['cultura'] ?: $produto['categoria']]);
    $historico = array_map(fn($h) => ['data' => $h['data_registro'], 'preco' => (float) $h['preco_medio']], $stmt->fetchAll());

    $stmt = $pdo->prepare('SELECT 1 FROM favoritos WHERE usuario_id = :usuario AND anuncio_id = :id');
    $stmt->execute([':usuario' => $usuarioId, ':id' => $id]);
    $favorito = (bool) $stmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT id, condicao, preco_alvo, variacao_percentual FROM alertas_precos WHERE usuario_id = :usuario AND anuncio_id = :id AND ativo = 1 LIMIT 1');
    $stmt->execute([':usuario' => $usuarioId, ':id' => $id]);
    $alerta = $stmt->fetch() ?: null;

    responder(200, [
        'sucesso'  => true,
        'produto'  => $produto,
        'vendedor' => [
            'id'              => $produto['vendedor_id'],
            'nome'            => $vendedor['nome'] ?? $produto['vendedor_nome'],
            'cidade'          => $vendedor['cidade'] ?? null,
            'membro_desde'    => isset($vendedor['data_criacao']) ? substr((string) $vendedor['data_criacao'], 0, 10) : null,
            'nota'            => $produto['vendedor_nota'],
            'total_avaliacoes' => $produto['vendedor_avaliacoes'],
            'vendas_concluidas' => $vendas,
            'avaliacoes'      => $avaliacoes,
        ],
        'historico_precos' => $historico,
        'favorito'  => $favorito,
        'alerta'    => $alerta,
        'proprio'   => $produto['vendedor_id'] === $usuarioId,
    ]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_PRODUTOS_DETALHE] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar o produto.']);
}
