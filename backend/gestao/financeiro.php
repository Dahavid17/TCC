<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';
require_once __DIR__ . '/../lib/consolidacao.php';

// Gestão financeira (DER: transacoes_financeiras).
//   GET [?fazenda_id&safra_id&talhao_id&de&ate&tipo&categoria]
//        -> lançamentos + indicadores calculados automaticamente (custo R$/ha, R$/saca,
//           R$/tonelada, receita bruta, lucro líquido, margem, composição e fluxo de caixa)
//   POST acao=salvar   id?, fazenda_id, talhao_id?, safra_id?, tipo, categoria, descricao, valor,
//                      data_lancamento, quantidade?, unidade?
//   POST acao=excluir&id=N
try {
    [$pdo, $usuarioId] = inicio_gestao();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $filtro = ['fazenda_id' => filtro_fazenda($pdo, $usuarioId)];
        if (!empty($_GET['safra_id'])) {
            $filtro['safra_id'] = exigir_safra($pdo, $usuarioId, (int) $_GET['safra_id'])['id'];
        }
        if (!empty($_GET['talhao_id'])) {
            $filtro['talhao_id'] = exigir_talhao($pdo, $usuarioId, (int) $_GET['talhao_id'])['id'];
        }
        $filtro['de'] = data_valida($_GET, 'de');
        $filtro['ate'] = data_valida($_GET, 'ate');

        $where = ['f.usuario_id = :usuario'];
        $params = [':usuario' => $usuarioId];
        foreach (['fazenda_id', 'safra_id', 'talhao_id'] as $campo) {
            if (!empty($filtro[$campo])) {
                $where[] = "l.$campo = :$campo";
                $params[":$campo"] = $filtro[$campo];
            }
        }
        if ($filtro['de']) { $where[] = 'l.data_competencia >= :de'; $params[':de'] = $filtro['de']; }
        if ($filtro['ate']) { $where[] = 'l.data_competencia <= :ate'; $params[':ate'] = $filtro['ate']; }
        if (in_array($_GET['tipo'] ?? '', ['despesa', 'receita'], true)) {
            $where[] = 'l.tipo = :tipo';
            $params[':tipo'] = $_GET['tipo'];
        }
        if (!empty($_GET['categoria'])) {
            $where[] = 'l.categoria = :categoria';
            $params[':categoria'] = (string) $_GET['categoria'];
        }

        $stmt = $pdo->prepare(
            'SELECT l.id, l.fazenda_id, f.nome AS fazenda_nome, l.talhao_id, t.nome_identificacao AS talhao_nome, l.safra_id,
                    s.ano_periodo AS safra_nome, l.tipo, l.categoria, l.descricao, l.valor, l.data_competencia AS data_lancamento,
                    l.quantidade, l.unidade_medida AS unidade, l.operacao_id
               FROM transacoes_financeiras l
               JOIN fazendas f ON f.id = l.fazenda_id
               LEFT JOIN talhoes t ON t.id = l.talhao_id
               LEFT JOIN safras s ON s.id = l.safra_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY l.data_competencia DESC, l.id DESC LIMIT 1000'
        );
        $stmt->execute($params);

        responder(200, [
            'sucesso'     => true,
            'lancamentos' => $stmt->fetchAll(),
            'indicadores' => resumo_financeiro($pdo, $usuarioId, array_filter($filtro)),
            'categorias'  => ['despesa' => CATEGORIAS_DESPESA, 'receita' => CATEGORIAS_RECEITA],
        ]);
    }

    exigir_metodo('POST');
    $d = entrada();
    $acao = (string) ($d['acao'] ?? '');

    // Lançamento do usuário (pela fazenda); devolve o id ou responde 404.
    $exigirLancamento = function (?int $id) use ($pdo, $usuarioId): int {
        $stmt = $pdo->prepare('SELECT l.id FROM transacoes_financeiras l JOIN fazendas f ON f.id = l.fazenda_id WHERE l.id = :id AND f.usuario_id = :usuario');
        $stmt->execute([':id' => (int) $id, ':usuario' => $usuarioId]);
        if (!$stmt->fetchColumn()) {
            falha('Lançamento não encontrado.', 404);
        }
        return (int) $id;
    };

    if ($acao === 'excluir') {
        $pdo->prepare('DELETE FROM transacoes_financeiras WHERE id = :id')->execute([':id' => $exigirLancamento(inteiro_id($d, 'id', true))]);
        responder(200, ['sucesso' => true, 'mensagem' => 'Lançamento excluído.']);
    }

    if ($acao !== 'salvar') {
        falha('Ação inválida.');
    }

    $id = inteiro_id($d, 'id');
    $tipo = opcao($d, 'tipo', ['despesa', 'receita'], null, 'tipo');
    $categorias = $tipo === 'despesa' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;
    $categoria = opcao($d, 'categoria', array_keys($categorias), null, 'categoria');

    $fazenda = exigir_fazenda($pdo, $usuarioId, inteiro_id($d, 'fazenda_id', true));
    $talhaoId = inteiro_id($d, 'talhao_id');
    $safraId = inteiro_id($d, 'safra_id');
    if ($talhaoId && (int) exigir_talhao($pdo, $usuarioId, $talhaoId)['fazenda_id'] !== (int) $fazenda['id']) {
        falha('O talhão não pertence a esta propriedade.');
    }
    if ($safraId && (int) exigir_safra($pdo, $usuarioId, $safraId)['fazenda_id'] !== (int) $fazenda['id']) {
        falha('A safra não pertence a esta propriedade.');
    }

    $dados = [
        ':fazenda'   => $fazenda['id'],
        ':talhao'    => $talhaoId,
        ':safra'     => $safraId,
        ':tipo'      => $tipo,
        ':categoria' => $categoria,
        ':descricao' => texto($d, 'descricao', 255, true, 'descrição'),
        ':valor'     => decimal($d, 'valor', 0.01, 999999999999, true, 'o valor'),
        ':data'      => data_valida($d, 'data_lancamento', true, 'lançamento'),
        ':qtd'       => decimal($d, 'quantidade', 0, 999999999999, false, 'a quantidade'),
        ':unidade'   => texto($d, 'unidade', 50),
    ];

    if ($id) {
        $exigirLancamento($id);
        $pdo->prepare(
            'UPDATE transacoes_financeiras SET fazenda_id = :fazenda, talhao_id = :talhao, safra_id = :safra, tipo = :tipo,
                    categoria = :categoria, descricao = :descricao, valor = :valor, data_competencia = :data,
                    quantidade = :qtd, unidade_medida = :unidade
              WHERE id = :id'
        )->execute($dados + [':id' => $id]);
    } else {
        $pdo->prepare(
            'INSERT INTO transacoes_financeiras (fazenda_id, talhao_id, safra_id, tipo, categoria, descricao, valor,
                    data_competencia, quantidade, unidade_medida)
             VALUES (:fazenda, :talhao, :safra, :tipo, :categoria, :descricao, :valor, :data, :qtd, :unidade)'
        )->execute($dados);
        $id = (int) $pdo->lastInsertId();
    }

    responder(200, ['sucesso' => true, 'mensagem' => 'Lançamento salvo.', 'id' => $id]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_GESTAO_FINANCEIRO] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível processar o lançamento.']);
}
