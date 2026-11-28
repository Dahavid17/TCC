<?php
declare(strict_types=1);

// Cálculos consolidados compartilhados por safras, dashboard e relatórios.
// Requer backend/lib/gestao.php. Tabelas do DER: safras, culturas_talhao, transacoes_financeiras.

// Consolidação automática de cada safra: área cultivada/colhida, produção, custos, receita,
// lucro, margem e produtividade (base do comparativo entre safras).
function consolidar_safras(PDO $pdo, int $usuarioId, ?int $fazendaId): array
{
    $where = 'f.usuario_id = :usuario';
    $params = [':usuario' => $usuarioId];
    if ($fazendaId) {
        $where .= ' AND s.fazenda_id = :fazenda';
        $params[':fazenda'] = $fazendaId;
    }

    $stmt = $pdo->prepare(
        "SELECT s.id, s.fazenda_id, f.nome AS fazenda_nome, s.nome, s.ano_periodo, s.data_inicio, s.data_encerramento,
                s.status, s.observacoes,
                (SELECT COALESCE(SUM(l.valor), 0) FROM transacoes_financeiras l WHERE l.safra_id = s.id AND l.tipo = 'despesa') AS custos,
                (SELECT COALESCE(SUM(l.valor), 0) FROM transacoes_financeiras l WHERE l.safra_id = s.id AND l.tipo = 'receita') AS receitas
           FROM safras s JOIN fazendas f ON f.id = s.fazenda_id
          WHERE $where
          ORDER BY s.data_inicio DESC, s.id DESC"
    );
    $stmt->execute($params);
    $safras = $stmt->fetchAll();

    if (!$safras) {
        return [];
    }

    $ids = array_map(fn($s) => (int) $s['id'], $safras);
    $stmt = $pdo->prepare(
        'SELECT c.*, t.nome_identificacao AS talhao_nome FROM culturas_talhao c JOIN talhoes t ON t.id = c.talhao_id
          WHERE c.safra_id IN (' . marcadores($ids) . ') ORDER BY c.id'
    );
    $stmt->execute($ids);
    $porSafra = [];
    foreach ($stmt->fetchAll() as $c) {
        $porSafra[(int) $c['safra_id']][] = $c;
    }

    return array_map(function (array $s) use ($porSafra): array {
        $culturas = $porSafra[(int) $s['id']] ?? [];
        $areaPlantada = 0.0; $areaColhida = 0.0; $kg = 0.0; $receitaEstimada = 0.0;
        $porUnidade = [];

        $lista = array_map(function (array $c) use (&$areaPlantada, &$areaColhida, &$kg, &$receitaEstimada, &$porUnidade): array {
            $plantada = (float) $c['area_cultivada'];
            $colhida = $c['area_colhida'] !== null ? (float) $c['area_colhida'] : null;
            $total = $c['producao_total'] !== null ? (float) $c['producao_total'] : null;
            $areaPlantada += $plantada;
            if ($total !== null) {
                $areaColhida += $colhida ?? $plantada;
                $kg += $total * (KG_POR_UNIDADE[$c['unidade_producao']] ?? 1);
                $receitaEstimada += $total * (float) ($c['preco_venda_unitario'] ?? 0);
                $porUnidade[$c['unidade_producao']] = ($porUnidade[$c['unidade_producao']] ?? 0) + $total;
            }

            return [
                'id'                     => (int) $c['id'],
                'talhao_id'              => (int) $c['talhao_id'],
                'talhao_nome'            => $c['talhao_nome'] ?: ('Talhão ' . $c['talhao_id']),
                'cultura'                => $c['tipo_cultura'],
                'variedade'              => $c['variedade'],
                'area_plantada_ha'       => f2($plantada),
                'area_colhida_ha'        => $colhida === null ? null : f2($colhida),
                'unidade_producao'       => $c['unidade_producao'],
                'produtividade_esperada' => $c['produtividade_esperada'] === null ? null : f2($c['produtividade_esperada']),
                'producao_estimada'      => $c['produtividade_esperada'] === null ? null : f2((float) $c['produtividade_esperada'] * $plantada),
                'producao_total'         => $total === null ? null : f2($total),
                'preco_venda_unitario'   => $c['preco_venda_unitario'] === null ? null : f2($c['preco_venda_unitario']),
                'produtividade'          => $c['produtividade_real'] === null ? null : f2($c['produtividade_real']),
                'data_plantio'           => $c['data_plantio'],
                'data_colheita'          => $c['data_colheita'],
                'status'                 => $c['status'],
            ];
        }, $culturas);

        $custos = (float) $s['custos'];
        $receita = (float) $s['receitas'] > 0 ? (float) $s['receitas'] : $receitaEstimada;
        $lucro = $receita - $custos;
        $sacas = $kg / 60;

        return [
            'id'                => (int) $s['id'],
            'fazenda_id'        => (int) $s['fazenda_id'],
            'fazenda_nome'      => $s['fazenda_nome'],
            'nome'              => $s['nome'] ?: ('Safra ' . $s['ano_periodo']),
            'ano_periodo'       => $s['ano_periodo'],
            'data_inicio'       => $s['data_inicio'],
            'data_encerramento' => $s['data_encerramento'],
            'status'            => $s['status'],
            'observacoes'       => $s['observacoes'],
            'culturas'          => $lista,
            'consolidado'       => [
                'area_cultivada_ha'    => f2($areaPlantada),
                'area_colhida_ha'      => f2($areaColhida),
                'producao_por_unidade' => array_map('f2', $porUnidade),
                'producao_kg'          => f2($kg),
                'producao_sacas'       => f2($sacas),
                'custos'               => f2($custos),
                'receita'              => f2($receita),
                'receita_origem'       => (float) $s['receitas'] > 0 ? 'lancamentos' : 'estimada',
                'lucro'                => f2($lucro),
                'margem_pct'           => $receita > 0 ? f2($lucro / $receita * 100) : null,
                'produtividade_kg_ha'  => $areaColhida > 0 ? f2($kg / $areaColhida) : null,
                'produtividade_sc_ha'  => $areaColhida > 0 ? f2($sacas / $areaColhida) : null,
                'custo_por_ha'         => $areaPlantada > 0 ? f2($custos / $areaPlantada) : null,
                'custo_por_saca'       => $sacas > 0 ? f2($custos / $sacas) : null,
            ],
        ];
    }, $safras);
}

// Indicadores financeiros: receita bruta, custos, lucro líquido, margem, custo por hectare,
// por saca e por tonelada, composição de custos e fluxo de caixa mensal.
// Filtros opcionais: fazenda_id, safra_id, talhao_id, de, ate (Y-m-d).
function resumo_financeiro(PDO $pdo, int $usuarioId, array $filtro = []): array
{
    $where = ['f.usuario_id = :usuario'];
    $params = [':usuario' => $usuarioId];

    foreach (['fazenda_id', 'safra_id', 'talhao_id'] as $campo) {
        if (!empty($filtro[$campo])) {
            $where[] = "l.$campo = :$campo";
            $params[":$campo"] = (int) $filtro[$campo];
        }
    }
    if (!empty($filtro['de'])) { $where[] = 'l.data_competencia >= :de'; $params[':de'] = $filtro['de']; }
    if (!empty($filtro['ate'])) { $where[] = 'l.data_competencia <= :ate'; $params[':ate'] = $filtro['ate']; }
    $sqlWhere = implode(' AND ', $where);
    $de = 'transacoes_financeiras l JOIN fazendas f ON f.id = l.fazenda_id';

    $stmt = $pdo->prepare("SELECT l.tipo, l.categoria, SUM(l.valor) AS total FROM $de WHERE $sqlWhere GROUP BY l.tipo, l.categoria");
    $stmt->execute($params);

    $despesas = 0.0; $receitas = 0.0; $composicao = []; $receitasPorCategoria = [];
    foreach ($stmt->fetchAll() as $linha) {
        $valor = (float) $linha['total'];
        if ($linha['tipo'] === 'despesa') {
            $despesas += $valor;
            $composicao[] = ['categoria' => $linha['categoria'], 'nome' => CATEGORIAS_DESPESA[$linha['categoria']] ?? $linha['categoria'], 'valor' => f2($valor)];
        } else {
            $receitas += $valor;
            $receitasPorCategoria[] = ['categoria' => $linha['categoria'], 'nome' => CATEGORIAS_RECEITA[$linha['categoria']] ?? $linha['categoria'], 'valor' => f2($valor)];
        }
    }
    usort($composicao, fn($a, $b) => $b['valor'] <=> $a['valor']);
    foreach ($composicao as &$c) {
        $c['percentual'] = $despesas > 0 ? f2($c['valor'] / $despesas * 100) : 0;
    }
    unset($c);

    $stmt = $pdo->prepare(
        "SELECT DATE_FORMAT(l.data_competencia, '%Y-%m') AS mes,
                SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END) AS entradas,
                SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END) AS saidas
           FROM $de WHERE $sqlWhere
          GROUP BY mes ORDER BY mes"
    );
    $stmt->execute($params);
    $saldo = 0.0;
    $fluxo = array_map(function (array $m) use (&$saldo): array {
        $saldo += (float) $m['entradas'] - (float) $m['saidas'];
        return ['mes' => $m['mes'], 'entradas' => f2($m['entradas']), 'saidas' => f2($m['saidas']),
                'resultado' => f2((float) $m['entradas'] - (float) $m['saidas']), 'saldo_acumulado' => f2($saldo)];
    }, $stmt->fetchAll());

    // Base física (área e produção) para os custos unitários.
    $areaHa = 0.0; $kg = 0.0; $receitaEstimada = 0.0;
    $wc = ['f.usuario_id = :usuario'];
    $pc = [':usuario' => $usuarioId];
    if (!empty($filtro['safra_id'])) { $wc[] = 'c.safra_id = :safra'; $pc[':safra'] = (int) $filtro['safra_id']; }
    if (!empty($filtro['talhao_id'])) { $wc[] = 'c.talhao_id = :talhao'; $pc[':talhao'] = (int) $filtro['talhao_id']; }
    if (!empty($filtro['fazenda_id'])) { $wc[] = 's.fazenda_id = :fazenda'; $pc[':fazenda'] = (int) $filtro['fazenda_id']; }
    if (!empty($filtro['de'])) { $wc[] = 'COALESCE(s.data_encerramento, CURDATE()) >= :de'; $pc[':de'] = $filtro['de']; }
    if (!empty($filtro['ate'])) { $wc[] = 's.data_inicio <= :ate'; $pc[':ate'] = $filtro['ate']; }

    $stmt = $pdo->prepare(
        'SELECT c.area_cultivada, c.producao_total, c.unidade_producao, c.preco_venda_unitario
           FROM culturas_talhao c JOIN safras s ON s.id = c.safra_id JOIN fazendas f ON f.id = s.fazenda_id
          WHERE ' . implode(' AND ', $wc)
    );
    $stmt->execute($pc);
    foreach ($stmt->fetchAll() as $c) {
        $areaHa += (float) $c['area_cultivada'];
        if ($c['producao_total'] !== null) {
            $kg += (float) $c['producao_total'] * (KG_POR_UNIDADE[$c['unidade_producao']] ?? 1);
            $receitaEstimada += (float) $c['producao_total'] * (float) ($c['preco_venda_unitario'] ?? 0);
        }
    }

    // Sem culturas lançadas: usa a área dos talhões (ou da propriedade) como base.
    if ($areaHa <= 0) {
        $somaTalhoes = '(SELECT SUM(t.area_hectares) FROM talhoes t WHERE t.fazenda_id = f.id AND t.ativo = 1)';
        if (!empty($filtro['talhao_id'])) {
            $stmt = $pdo->prepare('SELECT area_hectares FROM talhoes WHERE id = :id');
            $stmt->execute([':id' => (int) $filtro['talhao_id']]);
        } elseif (!empty($filtro['fazenda_id'])) {
            $stmt = $pdo->prepare("SELECT COALESCE(NULLIF($somaTalhoes, 0), f.area_total) FROM fazendas f WHERE f.id = :id");
            $stmt->execute([':id' => (int) $filtro['fazenda_id']]);
        } else {
            $stmt = $pdo->prepare("SELECT SUM(COALESCE(NULLIF($somaTalhoes, 0), f.area_total)) FROM fazendas f WHERE f.usuario_id = :usuario");
            $stmt->execute([':usuario' => $usuarioId]);
        }
        $areaHa = (float) $stmt->fetchColumn();
    }

    $receitaBruta = $receitas > 0 ? $receitas : $receitaEstimada;
    $lucro = $receitaBruta - $despesas;
    $sacas = $kg / 60;
    $toneladas = $kg / 1000;

    return [
        'receita_bruta'       => f2($receitaBruta),
        'receita_origem'      => $receitas > 0 ? 'lancamentos' : ($receitaEstimada > 0 ? 'estimada' : 'sem_dados'),
        'receitas_lancadas'   => f2($receitas),
        'receita_estimada'    => f2($receitaEstimada),
        'despesas'            => f2($despesas),
        'lucro_liquido'       => f2($lucro),
        'margem_pct'          => $receitaBruta > 0 ? f2($lucro / $receitaBruta * 100) : null,
        'area_ha'             => f2($areaHa),
        'producao_kg'         => f2($kg),
        'producao_sacas'      => f2($sacas),
        'producao_toneladas'  => f2($toneladas),
        'custo_por_ha'        => $areaHa > 0 ? f2($despesas / $areaHa) : null,
        'custo_por_saca'      => $sacas > 0 ? f2($despesas / $sacas) : null,
        'custo_por_tonelada'  => $toneladas > 0 ? f2($despesas / $toneladas) : null,
        'composicao_custos'   => $composicao,
        'receitas_categorias' => $receitasPorCategoria,
        'fluxo_caixa'         => $fluxo,
    ];
}
