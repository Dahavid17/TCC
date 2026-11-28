<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';

// Talhões (DER: talhoes.nome_identificacao, area_hectares, coordenadas_mapa).
//   GET [?fazenda_id=N]        -> lista com área, cultura/safra atual, custos acumulados,
//                                 receita, produção e produtividade de cada talhão
//   GET ?id=N&historico=1      -> histórico de uso (culturas por safra, operações do diário,
//                                 lançamentos financeiros)
//   POST acao=salvar           -> cria/edita: fazenda_id, nome, area_ha, cultura_atual,
//                                 tipo_solo, coordenadas (JSON [[lat,lng],...]), observacoes
//   POST acao=excluir&id=N
try {
    [$pdo, $usuarioId] = inicio_gestao();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $idHistorico = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

        if ($idHistorico && isset($_GET['historico'])) {
            $talhao = exigir_talhao($pdo, $usuarioId, $idHistorico);

            $stmt = $pdo->prepare(
                'SELECT c.id, c.tipo_cultura AS cultura, c.variedade, c.area_cultivada AS area_plantada_ha,
                        c.area_colhida AS area_colhida_ha, c.unidade_producao, c.producao_total, c.produtividade_real,
                        c.preco_venda_unitario, c.data_plantio, c.data_colheita, c.status,
                        s.ano_periodo, s.nome AS safra_nome, s.data_inicio, s.data_encerramento
                   FROM culturas_talhao c JOIN safras s ON s.id = c.safra_id
                  WHERE c.talhao_id = :talhao
                  ORDER BY s.data_inicio DESC, c.id DESC'
            );
            $stmt->execute([':talhao' => $talhao['id']]);
            $culturas = $stmt->fetchAll();

            $stmt = $pdo->prepare(
                'SELECT id, tipo_operacao AS tipo, data_operacao, produto_insumo AS produto, dosagem, responsavel, custo, observacoes
                   FROM operacoes_diario WHERE talhao_id = :talhao
                  ORDER BY data_operacao DESC, id DESC LIMIT 200'
            );
            $stmt->execute([':talhao' => $talhao['id']]);
            $operacoes = $stmt->fetchAll();

            $stmt = $pdo->prepare(
                'SELECT id, tipo, categoria, descricao, valor, data_competencia AS data_lancamento
                   FROM transacoes_financeiras WHERE talhao_id = :talhao
                  ORDER BY data_competencia DESC, id DESC LIMIT 200'
            );
            $stmt->execute([':talhao' => $talhao['id']]);

            responder(200, [
                'sucesso'     => true,
                'talhao'      => $talhao,
                'culturas'    => $culturas,
                'operacoes'   => $operacoes,
                'lancamentos' => $stmt->fetchAll(),
            ]);
        }

        $fazendaId = filtro_fazenda($pdo, $usuarioId);
        $where = 'f.usuario_id = :usuario AND t.ativo = 1';
        $params = [':usuario' => $usuarioId];

        if ($fazendaId) {
            $where .= ' AND t.fazenda_id = :fazenda';
            $params[':fazenda'] = $fazendaId;
        }

        $stmt = $pdo->prepare(
            "SELECT t.id, t.fazenda_id, f.nome AS fazenda_nome, t.nome_identificacao AS nome, t.area_hectares AS area_ha,
                    t.cultura_atual, t.tipo_solo, t.coordenadas_mapa AS coordenadas, t.observacoes,
                    (SELECT COALESCE(SUM(l.valor), 0) FROM transacoes_financeiras l
                      WHERE l.talhao_id = t.id AND l.tipo = 'despesa') AS custos,
                    (SELECT COALESCE(SUM(l.valor), 0) FROM transacoes_financeiras l
                      WHERE l.talhao_id = t.id AND l.tipo = 'receita') AS receitas_lancadas,
                    (SELECT MAX(o.data_operacao) FROM operacoes_diario o WHERE o.talhao_id = t.id) AS ultima_operacao
               FROM talhoes t JOIN fazendas f ON f.id = t.fazenda_id
              WHERE $where
              ORDER BY f.nome, t.nome_identificacao, t.id"
        );
        $stmt->execute($params);
        $linhas = $stmt->fetchAll();

        // Produção de todas as culturas do talhão (produtividade e receita estimada).
        $producao = [];
        if ($linhas) {
            $ids = array_map(fn($l) => (int) $l['id'], $linhas);
            $stmt = $pdo->prepare(
                'SELECT c.talhao_id, c.tipo_cultura AS cultura, c.unidade_producao, c.area_cultivada, c.area_colhida,
                        c.producao_total, c.preco_venda_unitario, s.status AS safra_status, s.ano_periodo
                   FROM culturas_talhao c JOIN safras s ON s.id = c.safra_id
                  WHERE c.talhao_id IN (' . marcadores($ids) . ')
                  ORDER BY s.data_inicio DESC, c.id DESC'
            );
            $stmt->execute($ids);
            foreach ($stmt->fetchAll() as $c) {
                $producao[(int) $c['talhao_id']][] = $c;
            }
        }

        $talhoes = array_map(function (array $t) use ($producao): array {
            $culturas = $producao[(int) $t['id']] ?? [];
            $kg = 0.0; $areaColhida = 0.0; $receitaProducao = 0.0;
            $atual = null;

            foreach ($culturas as $c) {
                if ($atual === null && $c['safra_status'] === 'em_andamento') {
                    $atual = $c;
                }
                if ($c['producao_total'] !== null) {
                    $kg += (float) $c['producao_total'] * (KG_POR_UNIDADE[$c['unidade_producao']] ?? 1);
                    $areaColhida += (float) ($c['area_colhida'] ?? $c['area_cultivada']);
                    $receitaProducao += (float) $c['producao_total'] * (float) ($c['preco_venda_unitario'] ?? 0);
                }
            }

            $ultima = $culturas[0] ?? null;
            $produtividadeUltima = null;
            if ($ultima && $ultima['producao_total'] !== null) {
                $area = (float) ($ultima['area_colhida'] ?? $ultima['area_cultivada']);
                $produtividadeUltima = $area > 0 ? round((float) $ultima['producao_total'] / $area, 2) : null;
            }

            $custos = (float) $t['custos'];
            $area = (float) $t['area_ha'];
            $receita = max($receitaProducao, (float) $t['receitas_lancadas']);

            return [
                'id'                   => (int) $t['id'],
                'fazenda_id'           => (int) $t['fazenda_id'],
                'fazenda_nome'         => $t['fazenda_nome'],
                'nome'                 => $t['nome'] ?: ('Talhão ' . $t['id']),
                'area_ha'              => f2($area),
                'cultura_atual'        => $atual['cultura'] ?? $t['cultura_atual'],
                'safra_atual'          => $atual['ano_periodo'] ?? null,
                'tipo_solo'            => $t['tipo_solo'],
                'coordenadas'          => $t['coordenadas'] ? json_decode($t['coordenadas'], true) : null,
                'observacoes'          => $t['observacoes'],
                'ultima_operacao'      => $t['ultima_operacao'],
                'custos_acumulados'    => f2($custos),
                'custo_por_ha'         => $area > 0 ? f2($custos / $area) : 0,
                'receita'              => f2($receita),
                'lucro'                => f2($receita - $custos),
                'producao_kg'          => f2($kg),
                'produtividade_kg_ha'  => $areaColhida > 0 ? f2($kg / $areaColhida) : null,
                'ultima_cultura'       => $ultima['cultura'] ?? null,
                'ultima_unidade'       => $ultima['unidade_producao'] ?? null,
                'produtividade_ultima' => $produtividadeUltima,
            ];
        }, $linhas);

        responder(200, ['sucesso' => true, 'talhoes' => $talhoes, 'culturas' => NOMES_CULTURA]);
    }

    exigir_metodo('POST');
    $d = entrada();
    $acao = (string) ($d['acao'] ?? '');

    if ($acao === 'excluir') {
        $talhao = exigir_talhao($pdo, $usuarioId, inteiro_id($d, 'id', true));
        $pdo->prepare('DELETE FROM talhoes WHERE id = :id')->execute([':id' => $talhao['id']]);
        responder(200, ['sucesso' => true, 'mensagem' => 'Talhão excluído.']);
    }

    if ($acao !== 'salvar') {
        falha('Ação inválida.');
    }

    $id = inteiro_id($d, 'id');
    $fazenda = exigir_fazenda($pdo, $usuarioId, inteiro_id($d, 'fazenda_id', true));
    $cultura = texto($d, 'cultura_atual', 60);
    if ($cultura !== null && !in_array($cultura, CULTURAS, true)) {
        falha('Cultura inválida.');
    }

    // Polígono: lista de [lat, lng] (3 a 200 pontos).
    $coordenadas = null;
    $bruto = $d['coordenadas'] ?? null;
    if (is_string($bruto) && trim($bruto) !== '') {
        $bruto = json_decode($bruto, true);
    }
    if (is_array($bruto) && $bruto) {
        if (count($bruto) < 3 || count($bruto) > 200) {
            falha('O desenho do talhão precisa de 3 a 200 pontos.');
        }
        $pontos = [];
        foreach ($bruto as $p) {
            if (!is_array($p) || count($p) !== 2 || !is_numeric($p[0]) || !is_numeric($p[1])
                || abs((float) $p[0]) > 90 || abs((float) $p[1]) > 180) {
                falha('Coordenadas do talhão inválidas.');
            }
            $pontos[] = [round((float) $p[0], 7), round((float) $p[1], 7)];
        }
        $coordenadas = json_encode($pontos);
    }

    $area = decimal($d, 'area_ha', 0.01, 9999999, true, 'a área do talhão (ha)');

    // A soma dos talhões não pode passar da área da propriedade.
    $stmt = $pdo->prepare('SELECT COALESCE(SUM(area_hectares), 0) FROM talhoes WHERE fazenda_id = :fazenda AND ativo = 1 AND id <> :id');
    $stmt->execute([':fazenda' => $fazenda['id'], ':id' => (int) $id]);
    if ((float) $stmt->fetchColumn() + $area > (float) $fazenda['area_total'] + 0.001) {
        falha('A soma das áreas dos talhões passaria da área total da propriedade (' . f2($fazenda['area_total']) . ' ha).');
    }

    $dados = [
        ':fazenda'     => $fazenda['id'],
        ':nome'        => texto($d, 'nome', 100, true, 'nome do talhão'),
        ':area'        => $area,
        ':cultura'     => $cultura,
        ':solo'        => texto($d, 'tipo_solo', 60),
        ':coordenadas' => $coordenadas,
        ':obs'         => texto($d, 'observacoes', 500),
    ];

    if ($id) {
        exigir_talhao($pdo, $usuarioId, $id);
        $pdo->prepare(
            'UPDATE talhoes SET fazenda_id = :fazenda, nome_identificacao = :nome, area_hectares = :area, cultura_atual = :cultura,
                    tipo_solo = :solo, coordenadas_mapa = :coordenadas, observacoes = :obs WHERE id = :id'
        )->execute($dados + [':id' => $id]);
    } else {
        $pdo->prepare(
            'INSERT INTO talhoes (fazenda_id, nome_identificacao, area_hectares, cultura_atual, tipo_solo, coordenadas_mapa, observacoes)
             VALUES (:fazenda, :nome, :area, :cultura, :solo, :coordenadas, :obs)'
        )->execute($dados);
        $id = (int) $pdo->lastInsertId();
    }

    responder(200, ['sucesso' => true, 'mensagem' => 'Talhão salvo.', 'id' => $id]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_GESTAO_TALHOES] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível processar o talhão.']);
}
