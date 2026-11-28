<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';
require_once __DIR__ . '/../lib/consolidacao.php';
require_once __DIR__ . '/../lib/lembretes.php';
require_once __DIR__ . '/../lib/mercado.php';

// GET [?fazenda_id=N&periodo=ano|12m|tudo]: Dashboard do produtor.
//   producao      -> área plantada, área colhida e produtividade (safras em andamento; sem
//                    nenhuma ativa, a safra mais recente)
//   financeiro    -> receita x despesa x lucro do período + fluxo de caixa
//   agenda        -> próximas tarefas e atrasadas
//   alertas       -> notificações não lidas
//   cotacoes      -> monitor de preços e tendências do mercado (dados da plataforma)
//   ranking       -> talhões de maior e menor rendimento (produtividade e lucro por hectare)
try {
    [$pdo, $usuarioId] = inicio_gestao('dashboard_gestao');
    exigir_metodo('GET');

    $fazendaId = filtro_fazenda($pdo, $usuarioId);
    $periodo = (string) ($_GET['periodo'] ?? 'ano');
    $de = match ($periodo) {
        '12m'  => date('Y-m-d', strtotime('-12 months')),
        'tudo' => null,
        default => date('Y') . '-01-01',
    };

    gerar_lembretes($pdo, $usuarioId);

    // ── Produção ──
    $safras = consolidar_safras($pdo, $usuarioId, $fazendaId);
    $ativas = array_values(array_filter($safras, fn($s) => $s['status'] === 'em_andamento'));
    $base = $ativas ?: array_slice($safras, 0, 1);
    $producao = ['area_plantada_ha' => 0.0, 'area_colhida_ha' => 0.0, 'producao_kg' => 0.0, 'safras' => array_map(fn($s) => $s['nome'], $base)];
    foreach ($base as $s) {
        $producao['area_plantada_ha'] += $s['consolidado']['area_cultivada_ha'];
        $producao['area_colhida_ha'] += $s['consolidado']['area_colhida_ha'];
        $producao['producao_kg'] += $s['consolidado']['producao_kg'];
    }
    // Safra ativa ainda sem colheita: colhida/produtividade vêm da última safra colhida.
    $producao['referencia_colheita'] = implode(', ', $producao['safras']);
    if ($producao['area_colhida_ha'] <= 0) {
        foreach ($safras as $s) {
            if ($s['consolidado']['area_colhida_ha'] > 0) {
                $producao['area_colhida_ha'] = $s['consolidado']['area_colhida_ha'];
                $producao['producao_kg'] = $s['consolidado']['producao_kg'];
                $producao['referencia_colheita'] = $s['nome'];
                break;
            }
        }
    }
    $producao['produtividade_kg_ha'] = $producao['area_colhida_ha'] > 0 ? f2($producao['producao_kg'] / $producao['area_colhida_ha']) : null;
    $producao['produtividade_sc_ha'] = $producao['area_colhida_ha'] > 0 ? f2($producao['producao_kg'] / 60 / $producao['area_colhida_ha']) : null;
    $producao['area_plantada_ha'] = f2($producao['area_plantada_ha']);
    $producao['area_colhida_ha'] = f2($producao['area_colhida_ha']);
    $producao['producao_sacas'] = f2($producao['producao_kg'] / 60);
    $producao['safras_ativas'] = count($ativas);

    $stmt = $pdo->prepare('SELECT COUNT(*) AS fazendas, COALESCE(SUM(area_total), 0) AS area FROM fazendas WHERE usuario_id = :usuario' . ($fazendaId ? ' AND id = :fazenda' : ''));
    $stmt->execute([':usuario' => $usuarioId] + ($fazendaId ? [':fazenda' => $fazendaId] : []));
    $propriedades = $stmt->fetch();
    $producao['propriedades'] = (int) $propriedades['fazendas'];
    $producao['area_total_ha'] = f2($propriedades['area']);

    // ── Financeiro ──
    $financeiro = resumo_financeiro($pdo, $usuarioId, array_filter(['fazenda_id' => $fazendaId, 'de' => $de]));

    // ── Agenda e alertas ──
    $stmt = $pdo->prepare(
        "SELECT e.id, e.titulo, COALESCE(e.tipo_alerta, 'outros') AS tipo, e.data_vencimento AS data_evento, e.hora_evento,
                DATEDIFF(e.data_vencimento, CURDATE()) AS dias, 'pendente' AS status, t.nome_identificacao AS talhao_nome
           FROM agenda_rural e JOIN fazendas f ON f.id = e.fazenda_id LEFT JOIN talhoes t ON t.id = e.talhao_id
          WHERE f.usuario_id = :usuario AND COALESCE(e.status_conclusao, 0) = 0
            AND e.data_vencimento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)"
        . ($fazendaId ? ' AND e.fazenda_id = :fazenda' : '') . '
          ORDER BY e.data_vencimento, e.hora_evento LIMIT 8'
    );
    $stmt->execute([':usuario' => $usuarioId] + ($fazendaId ? [':fazenda' => $fazendaId] : []));
    $agenda = $stmt->fetchAll();

    garantir_tabela_notificacoes($pdo);
    $stmt = $pdo->prepare('SELECT id, tipo, titulo, mensagem, link, criada_em AS data_criacao FROM notificacoes WHERE usuario_id = :usuario AND lida = 0 ORDER BY id DESC LIMIT 6');
    $stmt->execute([':usuario' => $usuarioId]);
    $alertas = $stmt->fetchAll();

    // ── Monitor de cotações ──
    $cotacoes = array_slice(precos_de_mercado($pdo), 0, 8);

    // ── Ranking de talhões (rendimento) ──
    $stmt = $pdo->prepare(
        "SELECT t.id, t.nome_identificacao AS nome, t.area_hectares AS area_ha, f.nome AS fazenda_nome,
                (SELECT COALESCE(SUM(l.valor), 0) FROM transacoes_financeiras l WHERE l.talhao_id = t.id AND l.tipo = 'despesa') AS custos
           FROM talhoes t JOIN fazendas f ON f.id = t.fazenda_id
          WHERE f.usuario_id = :usuario AND t.ativo = 1" . ($fazendaId ? ' AND t.fazenda_id = :fazenda' : '')
    );
    $stmt->execute([':usuario' => $usuarioId] + ($fazendaId ? [':fazenda' => $fazendaId] : []));
    $talhoes = $stmt->fetchAll();

    $ranking = [];
    if ($talhoes) {
        $ids = array_map(fn($t) => (int) $t['id'], $talhoes);
        $stmt = $pdo->prepare(
            'SELECT talhao_id, tipo_cultura AS cultura, unidade_producao, producao_total, preco_venda_unitario,
                    COALESCE(area_colhida, area_cultivada) AS area
               FROM culturas_talhao WHERE producao_total IS NOT NULL AND talhao_id IN (' . marcadores($ids) . ')'
        );
        $stmt->execute($ids);
        $porTalhao = [];
        foreach ($stmt->fetchAll() as $c) {
            $p = &$porTalhao[(int) $c['talhao_id']];
            $p['kg'] = ($p['kg'] ?? 0) + (float) $c['producao_total'] * (KG_POR_UNIDADE[$c['unidade_producao']] ?? 1);
            $p['area'] = ($p['area'] ?? 0) + (float) $c['area'];
            $p['receita'] = ($p['receita'] ?? 0) + (float) $c['producao_total'] * (float) ($c['preco_venda_unitario'] ?? 0);
            $p['culturas'][$c['cultura']] = true;
            unset($p);
        }
        foreach ($talhoes as $t) {
            $p = $porTalhao[(int) $t['id']] ?? null;
            if (!$p || $p['area'] <= 0) {
                continue;
            }
            $area = (float) $t['area_ha'] ?: $p['area'];
            $ranking[] = [
                'id'                  => (int) $t['id'],
                'nome'                => $t['nome'] ?: ('Talhão ' . $t['id']),
                'fazenda_nome'        => $t['fazenda_nome'],
                'culturas'            => array_map(fn($c) => NOMES_CULTURA[$c] ?? $c, array_keys($p['culturas'])),
                'produtividade_kg_ha' => f2($p['kg'] / $p['area']),
                'produtividade_sc_ha' => f2($p['kg'] / 60 / $p['area']),
                'lucro_por_ha'        => f2(($p['receita'] - (float) $t['custos']) / $area),
            ];
        }
        usort($ranking, fn($a, $b) => $b['produtividade_kg_ha'] <=> $a['produtividade_kg_ha']);
    }

    responder(200, [
        'sucesso'    => true,
        'periodo'    => ['tipo' => $periodo, 'de' => $de],
        'producao'   => $producao,
        'financeiro' => $financeiro,
        'agenda'     => $agenda,
        'alertas'    => $alertas,
        'cotacoes'   => $cotacoes,
        'ranking'    => $ranking,
        'safras'     => array_map(fn($s) => ['id' => $s['id'], 'nome' => $s['nome'], 'ano_periodo' => $s['ano_periodo'], 'status' => $s['status'], 'consolidado' => $s['consolidado']], $safras),
    ]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_GESTAO_DASHBOARD] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar o dashboard.']);
}
