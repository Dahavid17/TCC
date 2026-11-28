<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// GET ?escopo=meus (padrão) | catalogo | destaques
//     [&categoria=...] [&busca=...] [&cultura=...] [&localizacao=...]
//     [&preco_min=...] [&preco_max=...] [&ordenar=recentes|menor_preco|maior_preco|reputacao]
// destaques = produtos marcados como destaque ou em promoção (promoção primeiro, depois os mais vendidos).
// Os filtros de preço usam o valor cobrado (promoção, se houver).
// No catálogo, cada busca por texto é registrada (ranking "mais pesquisados" do mercado).
exigir_metodo('GET');
$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    $escopo = $_GET['escopo'] ?? 'meus';
    $categoria = $_GET['categoria'] ?? '';
    $busca = trim((string) ($_GET['busca'] ?? ''));
    $cultura = trim((string) ($_GET['cultura'] ?? ''));
    $localizacao = trim((string) ($_GET['localizacao'] ?? ''));

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

    if ($cultura !== '') {
        if (!in_array($cultura, CULTURAS_ANUNCIO, true)) {
            responder(422, ['sucesso' => false, 'mensagem' => 'Cultura inválida.']);
        }
        $where[] = 'a.cultura = :cultura';
        $params[':cultura'] = $cultura;
    }

    if ($localizacao !== '') {
        $where[] = 'a.localizacao LIKE :localizacao';
        $params[':localizacao'] = '%' . mb_substr($localizacao, 0, 100) . '%';
    }

    foreach (['preco_min' => '>=', 'preco_max' => '<='] as $campo => $operador) {
        $valor = str_replace(',', '.', trim((string) ($_GET[$campo] ?? '')));
        if ($valor === '') {
            continue;
        }
        if (!is_numeric($valor) || (float) $valor < 0) {
            responder(422, ['sucesso' => false, 'mensagem' => 'Faixa de preço inválida.']);
        }
        $where[] = '(' . SQL_PRECO_VENDA . ") $operador :$campo";
        $params[":$campo"] = (float) $valor;
    }

    if ($busca !== '') {
        $where[] = '(a.titulo LIKE :busca OR a.descricao LIKE :busca2)';
        $params[':busca'] = $params[':busca2'] = '%' . $busca . '%';
    }

    $ordem = match ($_GET['ordenar'] ?? '') {
        'menor_preco' => SQL_PRECO_VENDA . ' ASC, a.id DESC',
        'maior_preco' => SQL_PRECO_VENDA . ' DESC, a.id DESC',
        'reputacao'   => 'vendedor_nota IS NULL, vendedor_nota DESC, a.id DESC',
        default       => $ordem,
    };

    $stmt = $pdo->prepare(
        SQL_PRODUTO . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY ' . $ordem
    );
    $stmt->execute($params);
    $produtos = array_map('normalizar_produto', $stmt->fetchAll());

    if ($escopo === 'catalogo' && $busca !== '' && mb_strlen($busca) >= 2) {
        try {
            $pdo->prepare('INSERT INTO buscas_registro (usuario_id, termo) VALUES (:usuario, :termo)')
                ->execute([':usuario' => $usuarioId, ':termo' => mb_strtolower(mb_substr($busca, 0, 100))]);
        } catch (Throwable $e) {
            error_log('[MARKETPLACE_BUSCAS] ' . $e->getMessage()); // não impede a listagem
        }
    }

    responder(200, [
        'sucesso'  => true,
        'produtos' => $produtos,
    ]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_PRODUTOS_LISTAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar os produtos.']);
}
