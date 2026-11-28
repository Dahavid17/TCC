<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';
require_once __DIR__ . '/../lib/consolidacao.php';

// Safras e as culturas de cada safra.
//   GET [?fazenda_id=N] -> safras com as culturas e a consolidação automática:
//                          área cultivada/colhida, produção, custos, receita, lucro, margem e
//                          produtividade (base do painel comparativo entre safras)
//   POST acao=salvar           fazenda_id, nome, ano_periodo, data_inicio, data_encerramento, status, observacoes
//   POST acao=encerrar&id=N    marca como concluída na data de hoje
//   POST acao=excluir&id=N
//   POST acao=salvar_cultura   id?, safra_id, talhao_id, cultura, variedade, area_plantada_ha, area_colhida_ha,
//                              unidade_producao, producao_estimada, producao_total, preco_venda_unitario,
//                              data_plantio, data_colheita, status
//   POST acao=excluir_cultura&id=N
try {
    [$pdo, $usuarioId] = inicio_gestao();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $fazendaId = filtro_fazenda($pdo, $usuarioId);
        responder(200, ['sucesso' => true, 'safras' => consolidar_safras($pdo, $usuarioId, $fazendaId), 'culturas' => NOMES_CULTURA]);
    }

    exigir_metodo('POST');
    $d = entrada();
    $acao = (string) ($d['acao'] ?? '');

    switch ($acao) {
        case 'salvar':
            $id = inteiro_id($d, 'id');
            $fazenda = exigir_fazenda($pdo, $usuarioId, inteiro_id($d, 'fazenda_id', true));
            $inicio = data_valida($d, 'data_inicio', true, 'início');
            $fim = data_valida($d, 'data_encerramento', false, 'encerramento');
            if ($fim !== null && $fim < $inicio) {
                falha('A data de encerramento não pode ser anterior ao início.');
            }
            $dados = [
                ':fazenda' => $fazenda['id'],
                ':nome'    => texto($d, 'nome', 100, false, 'nome'),
                ':periodo' => texto($d, 'ano_periodo', 50, true, 'ano/período (ex.: 2025/2026)'),
                ':inicio'  => $inicio,
                ':fim'     => $fim,
                ':status'  => opcao($d, 'status', ['em_andamento', 'concluida', 'cancelada'], 'em_andamento', 'status'),
                ':obs'     => texto($d, 'observacoes', 500),
            ];
            if ($id) {
                exigir_safra($pdo, $usuarioId, $id);
                $pdo->prepare(
                    'UPDATE safras SET fazenda_id = :fazenda, nome = :nome, ano_periodo = :periodo, data_inicio = :inicio,
                            data_encerramento = :fim, status = :status, observacoes = :obs WHERE id = :id'
                )->execute($dados + [':id' => $id]);
            } else {
                $pdo->prepare(
                    'INSERT INTO safras (fazenda_id, nome, ano_periodo, data_inicio, data_encerramento, status, observacoes)
                     VALUES (:fazenda, :nome, :periodo, :inicio, :fim, :status, :obs)'
                )->execute($dados);
                $id = (int) $pdo->lastInsertId();
            }
            responder(200, ['sucesso' => true, 'mensagem' => 'Safra salva.', 'id' => $id]);

        case 'encerrar':
            $safra = exigir_safra($pdo, $usuarioId, inteiro_id($d, 'id', true));
            $pdo->prepare("UPDATE safras SET status = 'concluida', data_encerramento = COALESCE(data_encerramento, CURDATE()) WHERE id = :id")
                ->execute([':id' => $safra['id']]);
            responder(200, ['sucesso' => true, 'mensagem' => 'Safra encerrada.']);

        case 'excluir':
            $safra = exigir_safra($pdo, $usuarioId, inteiro_id($d, 'id', true));
            $pdo->prepare('DELETE FROM safras WHERE id = :id')->execute([':id' => $safra['id']]);
            responder(200, ['sucesso' => true, 'mensagem' => 'Safra excluída.']);

        case 'salvar_cultura':
            $id = inteiro_id($d, 'id');
            $safra = exigir_safra($pdo, $usuarioId, inteiro_id($d, 'safra_id', true));
            $talhao = exigir_talhao($pdo, $usuarioId, inteiro_id($d, 'talhao_id', true));
            if ((int) $talhao['fazenda_id'] !== (int) $safra['fazenda_id']) {
                falha('O talhão precisa ser da mesma propriedade da safra.');
            }
            $cultura = opcao($d, 'cultura', CULTURAS, null, 'cultura');
            $areaPlantada = decimal($d, 'area_plantada_ha', 0.01, 9999999, true, 'a área plantada (ha)');
            if ($areaPlantada > (float) $talhao['area_ha'] + 0.001) {
                falha('A área plantada passa da área do talhão (' . f2($talhao['area_ha']) . ' ha).');
            }
            $areaColhida = decimal($d, 'area_colhida_ha', 0, 9999999, false, 'a área colhida');
            if ($areaColhida !== null && $areaColhida > $areaPlantada + 0.001) {
                falha('A área colhida não pode ser maior que a plantada.');
            }
            // DER: produtividade_esperada e produtividade_real são por hectare (na unidade escolhida).
            $estimada = decimal($d, 'producao_estimada', 0, 999999999999, false, 'a produção estimada');
            $total = decimal($d, 'producao_total', 0, 999999999999, false, 'a produção total');
            $baseColheita = $areaColhida ?: $areaPlantada;
            $dados = [
                ':safra'     => $safra['id'],
                ':talhao'    => $talhao['id'],
                ':cultura'   => $cultura,
                ':variedade' => texto($d, 'variedade', 100),
                ':plantada'  => $areaPlantada,
                ':colhida'   => $areaColhida,
                ':unidade'   => opcao($d, 'unidade_producao', array_keys(KG_POR_UNIDADE), 'saca', 'unidade'),
                ':esperada'  => $estimada === null ? null : round($estimada / $areaPlantada, 2),
                ':real'      => $total === null || $baseColheita <= 0 ? null : round($total / $baseColheita, 2),
                ':total'     => $total,
                ':preco'     => decimal($d, 'preco_venda_unitario', 0, 9999999999, false, 'o preço de venda'),
                ':plantio'   => data_valida($d, 'data_plantio', false, 'plantio'),
                ':colheita'  => data_valida($d, 'data_colheita', false, 'colheita'),
                ':status'    => opcao($d, 'status', ['planejada', 'plantada', 'colhida', 'perdida'], 'plantada', 'status'),
            ];
            if ($id) {
                exigir_cultura($pdo, $usuarioId, $id);
                $pdo->prepare(
                    'UPDATE culturas_talhao SET safra_id = :safra, talhao_id = :talhao, tipo_cultura = :cultura, variedade = :variedade,
                            area_cultivada = :plantada, area_colhida = :colhida, unidade_producao = :unidade,
                            produtividade_esperada = :esperada, produtividade_real = :real, producao_total = :total,
                            preco_venda_unitario = :preco, data_plantio = :plantio, data_colheita = :colheita, status = :status
                      WHERE id = :id'
                )->execute($dados + [':id' => $id]);
            } else {
                $pdo->prepare(
                    'INSERT INTO culturas_talhao (safra_id, talhao_id, tipo_cultura, variedade, area_cultivada, area_colhida,
                            unidade_producao, produtividade_esperada, produtividade_real, producao_total, preco_venda_unitario,
                            data_plantio, data_colheita, status)
                     VALUES (:safra, :talhao, :cultura, :variedade, :plantada, :colhida, :unidade, :esperada, :real,
                            :total, :preco, :plantio, :colheita, :status)'
                )->execute($dados);
                $id = (int) $pdo->lastInsertId();
            }
            // A cultura da safra em andamento passa a ser a cultura atual do talhão.
            if ($safra['status'] === 'em_andamento') {
                $pdo->prepare('UPDATE talhoes SET cultura_atual = :cultura WHERE id = :id')
                    ->execute([':cultura' => $cultura, ':id' => $talhao['id']]);
            }
            responder(200, ['sucesso' => true, 'mensagem' => 'Cultura salva na safra.', 'id' => $id]);

        case 'excluir_cultura':
            $id = exigir_cultura($pdo, $usuarioId, inteiro_id($d, 'id', true));
            $pdo->prepare('DELETE FROM culturas_talhao WHERE id = :id')->execute([':id' => $id]);
            responder(200, ['sucesso' => true, 'mensagem' => 'Cultura removida da safra.']);
    }

    falha('Ação inválida.');
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_GESTAO_SAFRAS] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível processar a safra.']);
}

// A cultura pertence ao usuário se a safra dela é de uma fazenda dele.
function exigir_cultura(PDO $pdo, int $usuarioId, int $id): int
{
    $stmt = $pdo->prepare(
        'SELECT c.id FROM culturas_talhao c JOIN safras s ON s.id = c.safra_id JOIN fazendas f ON f.id = s.fazenda_id
          WHERE c.id = :id AND f.usuario_id = :usuario'
    );
    $stmt->execute([':id' => $id, ':usuario' => $usuarioId]);
    if (!$stmt->fetchColumn()) {
        falha('Cultura não encontrada.', 404);
    }

    return $id;
}
