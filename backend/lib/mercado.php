<?php
declare(strict_types=1);

// Inteligência de Mercado: estatísticas com os anúncios, pedidos e cotações da plataforma.
// Requer backend/lib/gestao.php (NOMES_CULTURA).
//
// "Produto de mercado" (commodity_insumo) = a cultura do anúncio (soja, milho, café...) quando
// informada; sem cultura, a categoria (hortaliças, frutas...). Preço = o cobrado de fato
// (promoção, se houver). O histórico vem de cotacoes_mercado (DER), que recebe o preço médio
// do dia sempre que um anúncio é cadastrado ou tem o preço alterado (lib/lembretes.php).

require_once __DIR__ . '/lembretes.php'; // SQL_PRECO_EFETIVO, SQL_CHAVE_MERCADO

const NOMES_CATEGORIA = [
    'hortalicas' => 'Hortaliças', 'frutas' => 'Frutas', 'graos' => 'Grãos',
    'laticinios' => 'Laticínios', 'carnes' => 'Carnes', 'flores' => 'Flores',
];

function nome_produto_mercado(string $chave): string
{
    return NOMES_CULTURA[$chave] ?? NOMES_CATEGORIA[$chave] ?? ucfirst($chave);
}

// Preço médio, menor e maior de cada produto (anúncios ativos) e a tendência: média das
// cotações dos últimos 30 dias contra os 30 anteriores.
function precos_de_mercado(PDO $pdo, ?string $regiao = null): array
{
    $where = "a.status = 'ativo'";
    $params = [];
    if ($regiao !== null && $regiao !== '') {
        $where .= ' AND a.localizacao LIKE :regiao';
        $params[':regiao'] = '%' . $regiao . '%';
    }

    $stmt = $pdo->prepare(
        'SELECT ' . SQL_CHAVE_MERCADO . ' AS chave, COUNT(*) AS anuncios,
                AVG(' . SQL_PRECO_EFETIVO . ') AS media, MIN(' . SQL_PRECO_EFETIVO . ') AS minimo, MAX(' . SQL_PRECO_EFETIVO . ")
                AS maximo
           FROM anuncios a WHERE $where GROUP BY chave ORDER BY anuncios DESC, chave"
    );
    $stmt->execute($params);
    $linhas = $stmt->fetchAll();

    $tend = $pdo->query(
        'SELECT commodity_insumo AS chave,
                AVG(CASE WHEN data_registro >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN preco_medio END) AS atual,
                AVG(CASE WHEN data_registro < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN preco_medio END) AS anterior
           FROM cotacoes_mercado
          WHERE regiao IS NULL AND data_registro >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
          GROUP BY commodity_insumo'
    );
    $tendencias = [];
    foreach ($tend->fetchAll() as $t) {
        $tendencias[$t['chave']] = $t;
    }

    $extremo = function (string $chave, string $ordem) use ($pdo, $regiao): ?array {
        $stmt = $pdo->prepare(
            'SELECT a.localizacao FROM anuncios a WHERE a.status = \'ativo\' AND ' . SQL_CHAVE_MERCADO . ' = :chave'
            . ($regiao ? ' AND a.localizacao LIKE :regiao' : '') . ' ORDER BY ' . SQL_PRECO_EFETIVO . " $ordem LIMIT 1"
        );
        $stmt->execute([':chave' => $chave] + ($regiao ? [':regiao' => '%' . $regiao . '%'] : []));
        return $stmt->fetch() ?: null;
    };

    return array_map(function (array $l) use ($tendencias, $extremo): array {
        $t = $tendencias[$l['chave']] ?? null;
        $variacao = null;
        if ($t && $t['atual'] !== null && $t['anterior'] !== null && (float) $t['anterior'] > 0) {
            $variacao = round(((float) $t['atual'] - (float) $t['anterior']) / (float) $t['anterior'] * 100, 2);
        }

        return [
            'chave'        => $l['chave'],
            'produto'      => nome_produto_mercado($l['chave']),
            'unidade'      => null,
            'anuncios'     => (int) $l['anuncios'],
            'preco_medio'  => round((float) $l['media'], 2),
            'menor_preco'  => round((float) $l['minimo'], 2),
            'maior_preco'  => round((float) $l['maximo'], 2),
            'onde_menor'   => $extremo($l['chave'], 'ASC')['localizacao'] ?? null,
            'onde_maior'   => $extremo($l['chave'], 'DESC')['localizacao'] ?? null,
            'variacao_30d' => $variacao,
            'tendencia'    => $variacao === null ? 'estavel' : ($variacao > 1 ? 'alta' : ($variacao < -1 ? 'baixa' : 'estavel')),
        ];
    }, $linhas);
}

// Média mensal das cotações (histórico de evolução) de um produto ou de todos; com região,
// usa as cotações daquela região.
function historico_precos(PDO $pdo, ?string $chave, int $meses = 12, ?string $regiao = null): array
{
    $meses = max(1, min(36, $meses));
    $where = 'data_registro >= DATE_SUB(CURDATE(), INTERVAL ' . $meses . ' MONTH)';
    $params = [];
    if ($chave) {
        $where .= ' AND commodity_insumo = :chave';
        $params[':chave'] = $chave;
    }
    if ($regiao) {
        $where .= ' AND regiao LIKE :regiao';
        $params[':regiao'] = '%' . $regiao . '%';
    } else {
        $where .= ' AND regiao IS NULL';
    }

    $stmt = $pdo->prepare(
        "SELECT commodity_insumo AS chave, DATE_FORMAT(data_registro, '%Y-%m') AS mes,
                AVG(preco_medio) AS media, MIN(preco_medio) AS minimo, MAX(preco_medio) AS maximo
           FROM cotacoes_mercado WHERE $where
          GROUP BY chave, mes ORDER BY mes, chave"
    );
    $stmt->execute($params);

    $series = [];
    foreach ($stmt->fetchAll() as $l) {
        $series[$l['chave']]['produto'] = nome_produto_mercado($l['chave']);
        $series[$l['chave']]['pontos'][] = [
            'mes' => $l['mes'], 'media' => round((float) $l['media'], 2),
            'minimo' => round((float) $l['minimo'], 2), 'maximo' => round((float) $l['maximo'], 2),
        ];
    }

    return $series;
}

function mais_pesquisados(PDO $pdo, int $dias = 30, int $limite = 10): array
{
    $stmt = $pdo->query(
        'SELECT termo, COUNT(*) AS buscas FROM buscas_registro
          WHERE data_busca >= DATE_SUB(NOW(), INTERVAL ' . max(1, $dias) . ' DAY)
          GROUP BY termo ORDER BY buscas DESC, termo LIMIT ' . max(1, $limite)
    );

    return array_map(fn($l) => ['termo' => $l['termo'], 'buscas' => (int) $l['buscas']], $stmt->fetchAll());
}

function mais_vendidos(PDO $pdo, int $dias = 90, int $limite = 10): array
{
    $stmt = $pdo->query(
        'SELECT ' . SQL_CHAVE_MERCADO . " AS chave, SUM(i.quantidade) AS quantidade, SUM(i.quantidade * i.preco_unitario) AS faturamento,
                COUNT(DISTINCT p.id) AS pedidos
           FROM pedido_itens i
           JOIN pedidos p ON p.id = i.pedido_id
           JOIN anuncios a ON a.id = i.anuncio_id
          WHERE p.status <> 'cancelado' AND p.data_criacao >= DATE_SUB(NOW(), INTERVAL " . max(1, $dias) . ' DAY)
          GROUP BY chave ORDER BY quantidade DESC LIMIT ' . max(1, $limite)
    );

    return array_map(fn($l) => [
        'chave' => $l['chave'], 'produto' => nome_produto_mercado($l['chave']),
        'quantidade' => (int) $l['quantidade'], 'pedidos' => (int) $l['pedidos'],
        'faturamento' => round((float) $l['faturamento'], 2),
    ], $stmt->fetchAll());
}

// Menor e maior preço por região (cidade do anúncio) para um produto.
function precos_por_regiao(PDO $pdo, string $chave): array
{
    $stmt = $pdo->prepare(
        "SELECT COALESCE(NULLIF(a.localizacao, ''), 'Não informada') AS regiao, COUNT(*) AS anuncios,
                AVG(" . SQL_PRECO_EFETIVO . ') AS media, MIN(' . SQL_PRECO_EFETIVO . ') AS minimo, MAX(' . SQL_PRECO_EFETIVO . ") AS maximo
           FROM anuncios a
          WHERE a.status = 'ativo' AND " . SQL_CHAVE_MERCADO . ' = :chave
          GROUP BY regiao ORDER BY media'
    );
    $stmt->execute([':chave' => $chave]);

    return array_map(fn($l) => [
        'regiao' => $l['regiao'], 'anuncios' => (int) $l['anuncios'], 'preco_medio' => round((float) $l['media'], 2),
        'menor_preco' => round((float) $l['minimo'], 2), 'maior_preco' => round((float) $l['maximo'], 2),
    ], $stmt->fetchAll());
}
