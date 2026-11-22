<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// GET ?escopo=meus (padrão) | catalogo | destaques  [&categoria=...] [&busca=...]
// destaques = produtos marcados como destaque ou em promoção (promoção primeiro, depois os mais vendidos).
exigir_metodo('GET');
$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    $escopo = $_GET['escopo'] ?? 'meus';
    $categoria = $_GET['categoria'] ?? '';
    $busca = trim((string) ($_GET['busca'] ?? ''));

    $ordem = 'a.data_criacao DESC, a.id DESC';

    if ($escopo === 'catalogo') {
        $where = ["a.status = 'ativo'"];
        $params = [];
    } elseif ($escopo === 'destaques') {
        $where = ["a.status = 'ativo'", '(a.destaque = 1 OR (a.preco_promocional IS NOT NULL AND a.preco_promocional < a.preco))'];
        $params = [];
        $ordem = '(a.preco_promocional IS NOT NULL AND a.preco_promocional < a.preco) DESC, vendidos DESC, a.id DESC';
    } else {
        $where = ['a.vendedor_id = :usuario', "a.status <> 'inativo'"];
        $params = [':usuario' => $usuarioId];
    }

    if ($categoria !== '') {
        if (!in_array($categoria, CATEGORIAS_PRODUTO, true)) {
            responder(422, ['sucesso' => false, 'mensagem' => 'Categoria inválida.']);
        }
        $where[] = 'a.categoria = :categoria';
        $params[':categoria'] = $categoria;
    }

    if ($busca !== '') {
        $where[] = 'a.titulo LIKE :busca';
        $params[':busca'] = '%' . $busca . '%';
    }

    $stmt = $pdo->prepare(
        SQL_PRODUTO . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY ' . $ordem
    );
    $stmt->execute($params);

    responder(200, [
        'sucesso'  => true,
        'produtos' => array_map('normalizar_produto', $stmt->fetchAll()),
    ]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_PRODUTOS_LISTAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar os produtos.']);
}
