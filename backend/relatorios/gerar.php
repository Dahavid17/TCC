<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';
require_once __DIR__ . '/../lib/consolidacao.php';

// GET ?tipo=...&fazenda_id&safra_id&de&ate
// Relatórios automáticos em formato tabular. O navegador converte o mesmo JSON em PDF
// (jsPDF) ou Excel (SheetJS) com um clique — frontend/js/relatorios.js.
//
// Gerenciais:  financeiro, safras, talhoes, custos
// Operacionais: operacoes (diário de campo), agenda, silos, documentos
// Marketplace (qualquer usuário): vendas, compras
//
// Resposta: { titulo, subtitulo, gerado_em, colunas:[{chave,rotulo,tipo}], linhas:[{...}], resumo:[{rotulo,valor}] }
// tipo de coluna: texto | numero | moeda | data | percentual
exigir_metodo('GET');
$usuarioId = exigir_sessao();

const RELATORIOS_MARKETPLACE = ['vendas', 'compras'];

try {
    require_once __DIR__ . '/../config/conexao.php';

    $tipo = (string) ($_GET['tipo'] ?? '');
    if (!in_array($tipo, RELATORIOS_MARKETPLACE, true)) {
        exigir_produtor($pdo, $usuarioId);
        exigir_recurso($pdo, $usuarioId, 'relatorios'); // relatórios da gestão: Plano Pro
    }

    $fazendaId = in_array($tipo, RELATORIOS_MARKETPLACE, true) ? null : filtro_fazenda($pdo, $usuarioId);
    $safraId = !empty($_GET['safra_id']) ? (int) exigir_safra($pdo, $usuarioId, (int) $_GET['safra_id'])['id'] : null;
    $de = data_valida($_GET, 'de');
    $ate = data_valida($_GET, 'ate');
    $periodo = ($de || $ate) ? ('Período: ' . ($de ? date('d/m/Y', strtotime($de)) : 'início') . ' a ' . ($ate ? date('d/m/Y', strtotime($ate)) : 'hoje')) : 'Todo o período';

    $nomeFazenda = 'Todas as propriedades';
    if ($fazendaId) {
        $nomeFazenda = exigir_fazenda($pdo, $usuarioId, $fazendaId)['nome'];
    }

    $base = ['subtitulo' => $nomeFazenda . ' — ' . $periodo, 'gerado_em' => date('d/m/Y H:i')];
    $filtroData = function (string $coluna) use ($de, $ate, &$params): string {
        $sql = '';
        if ($de) { $sql .= " AND $coluna >= :de"; $params[':de'] = $de; }
        if ($ate) { $sql .= " AND $coluna <= :ate"; $params[':ate'] = $ate; }
        return $sql;
    };
    $params = [':usuario' => $usuarioId];
    $filtroFazenda = function (string $coluna) use ($fazendaId, &$params): string {
        if (!$fazendaId) {
            return '';
        }
        $params[':fazenda'] = $fazendaId;
        return " AND $coluna = :fazenda";
    };

    switch ($tipo) {
        case 'financeiro':
            $sql = 'SELECT l.data_competencia AS data_lancamento, l.tipo, l.categoria, l.descricao, f.nome AS fazenda,
                           t.nome_identificacao AS talhao, s.ano_periodo AS safra, l.valor
                      FROM transacoes_financeiras l JOIN fazendas f ON f.id = l.fazenda_id
                      LEFT JOIN talhoes t ON t.id = l.talhao_id LEFT JOIN safras s ON s.id = l.safra_id
                     WHERE f.usuario_id = :usuario' . $filtroFazenda('l.fazenda_id') . $filtroData('l.data_competencia')
                 . ($safraId ? ' AND l.safra_id = ' . $safraId : '') . ' ORDER BY l.data_competencia, l.id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $linhas = array_map(function ($l) {
                $l['categoria'] = CATEGORIAS_DESPESA[$l['categoria']] ?? CATEGORIAS_RECEITA[$l['categoria']] ?? $l['categoria'];
                $l['tipo'] = $l['tipo'] === 'despesa' ? 'Despesa' : 'Receita';
                $l['valor'] = (float) $l['valor'];
                return $l;
            }, $stmt->fetchAll());
            $ind = resumo_financeiro($pdo, $usuarioId, array_filter(['fazenda_id' => $fazendaId, 'safra_id' => $safraId, 'de' => $de, 'ate' => $ate]));
            responder(200, $base + [
                'sucesso' => true,
                'titulo'  => 'Relatório financeiro',
                'colunas' => [
                    ['chave' => 'data_lancamento', 'rotulo' => 'Data', 'tipo' => 'data'],
                    ['chave' => 'tipo', 'rotulo' => 'Tipo', 'tipo' => 'texto'],
                    ['chave' => 'categoria', 'rotulo' => 'Categoria', 'tipo' => 'texto'],
                    ['chave' => 'descricao', 'rotulo' => 'Descrição', 'tipo' => 'texto'],
                    ['chave' => 'fazenda', 'rotulo' => 'Propriedade', 'tipo' => 'texto'],
                    ['chave' => 'talhao', 'rotulo' => 'Talhão', 'tipo' => 'texto'],
                    ['chave' => 'safra', 'rotulo' => 'Safra', 'tipo' => 'texto'],
                    ['chave' => 'valor', 'rotulo' => 'Valor (R$)', 'tipo' => 'moeda'],
                ],
                'linhas'  => $linhas,
                'resumo'  => [
                    ['rotulo' => 'Receita bruta', 'valor' => $ind['receita_bruta'], 'tipo' => 'moeda'],
                    ['rotulo' => 'Despesas', 'valor' => $ind['despesas'], 'tipo' => 'moeda'],
                    ['rotulo' => 'Lucro líquido', 'valor' => $ind['lucro_liquido'], 'tipo' => 'moeda'],
                    ['rotulo' => 'Margem de lucro', 'valor' => $ind['margem_pct'], 'tipo' => 'percentual'],
                    ['rotulo' => 'Custo por hectare', 'valor' => $ind['custo_por_ha'], 'tipo' => 'moeda'],
                    ['rotulo' => 'Custo por saca', 'valor' => $ind['custo_por_saca'], 'tipo' => 'moeda'],
                    ['rotulo' => 'Custo por tonelada', 'valor' => $ind['custo_por_tonelada'], 'tipo' => 'moeda'],
                ],
            ]);

        case 'custos':
            $ind = resumo_financeiro($pdo, $usuarioId, array_filter(['fazenda_id' => $fazendaId, 'safra_id' => $safraId, 'de' => $de, 'ate' => $ate]));
            responder(200, $base + [
                'sucesso' => true,
                'titulo'  => 'Composição de custos de produção',
                'colunas' => [
                    ['chave' => 'nome', 'rotulo' => 'Categoria', 'tipo' => 'texto'],
                    ['chave' => 'valor', 'rotulo' => 'Valor (R$)', 'tipo' => 'moeda'],
                    ['chave' => 'percentual', 'rotulo' => '% do custo', 'tipo' => 'percentual'],
                ],
                'linhas'  => $ind['composicao_custos'],
                'resumo'  => [
                    ['rotulo' => 'Custo total', 'valor' => $ind['despesas'], 'tipo' => 'moeda'],
                    ['rotulo' => 'Área considerada (ha)', 'valor' => $ind['area_ha'], 'tipo' => 'numero'],
                    ['rotulo' => 'Custo por hectare', 'valor' => $ind['custo_por_ha'], 'tipo' => 'moeda'],
                    ['rotulo' => 'Custo por saca (60 kg)', 'valor' => $ind['custo_por_saca'], 'tipo' => 'moeda'],
                    ['rotulo' => 'Custo por tonelada', 'valor' => $ind['custo_por_tonelada'], 'tipo' => 'moeda'],
                ],
            ]);

        case 'safras':
            $safras = consolidar_safras($pdo, $usuarioId, $fazendaId);
            $linhas = [];
            foreach ($safras as $s) {
                $c = $s['consolidado'];
                $linhas[] = [
                    'safra' => $s['nome'], 'periodo' => $s['ano_periodo'], 'fazenda' => $s['fazenda_nome'],
                    'inicio' => $s['data_inicio'], 'fim' => $s['data_encerramento'],
                    'status' => ['em_andamento' => 'Em andamento', 'concluida' => 'Concluída', 'cancelada' => 'Cancelada'][$s['status']] ?? $s['status'],
                    'culturas' => implode(', ', array_unique(array_map(fn($x) => NOMES_CULTURA[$x['cultura']] ?? $x['cultura'], $s['culturas']))),
                    'area' => $c['area_cultivada_ha'], 'producao_sacas' => $c['producao_sacas'], 'produtividade' => $c['produtividade_sc_ha'],
                    'custos' => $c['custos'], 'receita' => $c['receita'], 'lucro' => $c['lucro'], 'margem' => $c['margem_pct'],
                ];
            }
            responder(200, $base + [
                'sucesso' => true,
                'titulo'  => 'Comparativo de safras',
                'colunas' => [
                    ['chave' => 'safra', 'rotulo' => 'Safra', 'tipo' => 'texto'],
                    ['chave' => 'fazenda', 'rotulo' => 'Propriedade', 'tipo' => 'texto'],
                    ['chave' => 'inicio', 'rotulo' => 'Início', 'tipo' => 'data'],
                    ['chave' => 'fim', 'rotulo' => 'Encerramento', 'tipo' => 'data'],
                    ['chave' => 'status', 'rotulo' => 'Status', 'tipo' => 'texto'],
                    ['chave' => 'culturas', 'rotulo' => 'Culturas', 'tipo' => 'texto'],
                    ['chave' => 'area', 'rotulo' => 'Área (ha)', 'tipo' => 'numero'],
                    ['chave' => 'producao_sacas', 'rotulo' => 'Produção (sc)', 'tipo' => 'numero'],
                    ['chave' => 'produtividade', 'rotulo' => 'sc/ha', 'tipo' => 'numero'],
                    ['chave' => 'custos', 'rotulo' => 'Custos (R$)', 'tipo' => 'moeda'],
                    ['chave' => 'receita', 'rotulo' => 'Receita (R$)', 'tipo' => 'moeda'],
                    ['chave' => 'lucro', 'rotulo' => 'Lucro (R$)', 'tipo' => 'moeda'],
                    ['chave' => 'margem', 'rotulo' => 'Margem', 'tipo' => 'percentual'],
                ],
                'linhas'  => $linhas,
                'resumo'  => [
                    ['rotulo' => 'Safras', 'valor' => count($linhas), 'tipo' => 'numero'],
                    ['rotulo' => 'Lucro somado', 'valor' => f2(array_sum(array_column($linhas, 'lucro'))), 'tipo' => 'moeda'],
                ],
            ]);

        case 'talhoes':
            $sql = "SELECT t.nome_identificacao AS nome, f.nome AS fazenda, t.area_hectares AS area_ha, t.cultura_atual, t.tipo_solo,
                           (SELECT COALESCE(SUM(l.valor), 0) FROM transacoes_financeiras l WHERE l.talhao_id = t.id AND l.tipo = 'despesa') AS custos,
                           (SELECT COUNT(*) FROM operacoes_diario o WHERE o.talhao_id = t.id) AS operacoes,
                           (SELECT SUM(sc.producao_total * CASE sc.unidade_producao WHEN 'saca' THEN 60 WHEN 'tonelada' THEN 1000 WHEN 'caixa' THEN 20 ELSE 1 END)
                                   / NULLIF(SUM(COALESCE(sc.area_colhida, sc.area_cultivada)), 0) / 60
                              FROM culturas_talhao sc WHERE sc.talhao_id = t.id AND sc.producao_total IS NOT NULL) AS produtividade
                      FROM talhoes t JOIN fazendas f ON f.id = t.fazenda_id
                     WHERE f.usuario_id = :usuario AND t.ativo = 1" . $filtroFazenda('t.fazenda_id') . ' ORDER BY f.nome, t.nome_identificacao';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $linhas = array_map(function ($t) {
                $t['cultura_atual'] = NOMES_CULTURA[$t['cultura_atual']] ?? $t['cultura_atual'];
                $t['custo_ha'] = (float) $t['area_ha'] > 0 ? f2((float) $t['custos'] / (float) $t['area_ha']) : null;
                $t['produtividade'] = $t['produtividade'] === null ? null : f2($t['produtividade']);
                return $t;
            }, $stmt->fetchAll());
            responder(200, $base + [
                'sucesso' => true,
                'titulo'  => 'Talhões: área, custos e produtividade',
                'colunas' => [
                    ['chave' => 'nome', 'rotulo' => 'Talhão', 'tipo' => 'texto'],
                    ['chave' => 'fazenda', 'rotulo' => 'Propriedade', 'tipo' => 'texto'],
                    ['chave' => 'area_ha', 'rotulo' => 'Área (ha)', 'tipo' => 'numero'],
                    ['chave' => 'cultura_atual', 'rotulo' => 'Cultura atual', 'tipo' => 'texto'],
                    ['chave' => 'tipo_solo', 'rotulo' => 'Solo', 'tipo' => 'texto'],
                    ['chave' => 'operacoes', 'rotulo' => 'Operações', 'tipo' => 'numero'],
                    ['chave' => 'custos', 'rotulo' => 'Custos acumulados (R$)', 'tipo' => 'moeda'],
                    ['chave' => 'custo_ha', 'rotulo' => 'R$/ha', 'tipo' => 'moeda'],
                    ['chave' => 'produtividade', 'rotulo' => 'Produtividade (sc/ha)', 'tipo' => 'numero'],
                ],
                'linhas'  => $linhas,
                'resumo'  => [
                    ['rotulo' => 'Talhões', 'valor' => count($linhas), 'tipo' => 'numero'],
                    ['rotulo' => 'Área total (ha)', 'valor' => f2(array_sum(array_column($linhas, 'area_ha'))), 'tipo' => 'numero'],
                    ['rotulo' => 'Custos acumulados', 'valor' => f2(array_sum(array_column($linhas, 'custos'))), 'tipo' => 'moeda'],
                ],
            ]);

        case 'operacoes':
            $sql = 'SELECT o.data_operacao, o.tipo_operacao AS tipo, t.nome_identificacao AS talhao, f.nome AS fazenda,
                           o.produto_insumo AS produto, o.dosagem, o.area_aplicada_ha, o.responsavel, o.custo
                      FROM operacoes_diario o JOIN talhoes t ON t.id = o.talhao_id JOIN fazendas f ON f.id = t.fazenda_id
                     WHERE f.usuario_id = :usuario' . $filtroFazenda('t.fazenda_id') . $filtroData('o.data_operacao')
                 . ($safraId ? ' AND o.safra_id = ' . $safraId : '') . ' ORDER BY o.data_operacao, o.id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $nomes = ['plantio' => 'Plantio', 'pulverizacao' => 'Pulverização', 'adubacao' => 'Adubação', 'irrigacao' => 'Irrigação', 'colheita' => 'Colheita', 'preparo_solo' => 'Preparo do solo', 'outro' => 'Outra'];
            $linhas = array_map(function ($o) use ($nomes) {
                $o['tipo'] = $nomes[$o['tipo']] ?? $o['tipo'];
                return $o;
            }, $stmt->fetchAll());
            responder(200, $base + [
                'sucesso' => true,
                'titulo'  => 'Diário de campo — operações realizadas',
                'colunas' => [
                    ['chave' => 'data_operacao', 'rotulo' => 'Data', 'tipo' => 'data'],
                    ['chave' => 'tipo', 'rotulo' => 'Operação', 'tipo' => 'texto'],
                    ['chave' => 'fazenda', 'rotulo' => 'Propriedade', 'tipo' => 'texto'],
                    ['chave' => 'talhao', 'rotulo' => 'Talhão', 'tipo' => 'texto'],
                    ['chave' => 'produto', 'rotulo' => 'Produto/insumo', 'tipo' => 'texto'],
                    ['chave' => 'dosagem', 'rotulo' => 'Dosagem', 'tipo' => 'texto'],
                    ['chave' => 'area_aplicada_ha', 'rotulo' => 'Área (ha)', 'tipo' => 'numero'],
                    ['chave' => 'responsavel', 'rotulo' => 'Responsável', 'tipo' => 'texto'],
                    ['chave' => 'custo', 'rotulo' => 'Custo (R$)', 'tipo' => 'moeda'],
                ],
                'linhas'  => $linhas,
                'resumo'  => [
                    ['rotulo' => 'Operações', 'valor' => count($linhas), 'tipo' => 'numero'],
                    ['rotulo' => 'Custo total', 'valor' => f2(array_sum(array_map(fn($l) => (float) $l['custo'], $linhas))), 'tipo' => 'moeda'],
                ],
            ]);

        case 'agenda':
            $sql = "SELECT e.data_vencimento AS data_evento, e.hora_evento, COALESCE(e.tipo_alerta, 'outros') AS tipo, e.titulo,
                           f.nome AS fazenda, t.nome_identificacao AS talhao,
                           CASE WHEN e.status_conclusao = 1 THEN 'concluido' ELSE 'pendente' END AS status
                      FROM agenda_rural e JOIN fazendas f ON f.id = e.fazenda_id LEFT JOIN talhoes t ON t.id = e.talhao_id
                     WHERE f.usuario_id = :usuario" . $filtroFazenda('e.fazenda_id') . $filtroData('e.data_vencimento') . ' ORDER BY e.data_vencimento, e.hora_evento';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $linhas = array_map(function ($e) {
                $e['hora_evento'] = $e['hora_evento'] ? substr($e['hora_evento'], 0, 5) : null;
                $e['status'] = ['pendente' => 'Pendente', 'concluido' => 'Concluído', 'cancelado' => 'Cancelado'][$e['status']] ?? $e['status'];
                $e['tipo'] = ucfirst($e['tipo']);
                return $e;
            }, $stmt->fetchAll());
            responder(200, $base + [
                'sucesso' => true,
                'titulo'  => 'Agenda rural — atividades e prazos',
                'colunas' => [
                    ['chave' => 'data_evento', 'rotulo' => 'Data', 'tipo' => 'data'],
                    ['chave' => 'hora_evento', 'rotulo' => 'Hora', 'tipo' => 'texto'],
                    ['chave' => 'tipo', 'rotulo' => 'Tipo', 'tipo' => 'texto'],
                    ['chave' => 'titulo', 'rotulo' => 'Atividade / prazo', 'tipo' => 'texto'],
                    ['chave' => 'fazenda', 'rotulo' => 'Propriedade', 'tipo' => 'texto'],
                    ['chave' => 'talhao', 'rotulo' => 'Talhão', 'tipo' => 'texto'],
                    ['chave' => 'status', 'rotulo' => 'Status', 'tipo' => 'texto'],
                ],
                'linhas'  => $linhas,
                'resumo'  => [
                    ['rotulo' => 'Eventos', 'valor' => count($linhas), 'tipo' => 'numero'],
                    ['rotulo' => 'Pendentes', 'valor' => count(array_filter($linhas, fn($l) => $l['status'] === 'Pendente')), 'tipo' => 'numero'],
                ],
            ]);

        case 'silos':
            $sql = 'SELECT a.codigo, a.nome, a.tipo, a.produto, f.nome AS fazenda, a.capacidade, a.unidade_capacidade,
                           l.nivel_pct, l.volume, l.peso_kg, l.temperatura, l.umidade_graos, l.data_hora
                      FROM armazenamentos a JOIN fazendas f ON f.id = a.fazenda_id
                      LEFT JOIN leituras_armazenamento l ON l.id = (SELECT l2.id FROM leituras_armazenamento l2 WHERE l2.armazenamento_id = a.id ORDER BY l2.data_hora DESC, l2.id DESC LIMIT 1)
                     WHERE f.usuario_id = :usuario' . $filtroFazenda('a.fazenda_id') . ' ORDER BY f.nome, a.nome';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $linhas = $stmt->fetchAll();
            responder(200, $base + [
                'sucesso' => true,
                'titulo'  => 'Silos, bags e reservatórios — situação atual',
                'colunas' => [
                    ['chave' => 'codigo', 'rotulo' => 'Código', 'tipo' => 'texto'],
                    ['chave' => 'nome', 'rotulo' => 'Nome', 'tipo' => 'texto'],
                    ['chave' => 'tipo', 'rotulo' => 'Tipo', 'tipo' => 'texto'],
                    ['chave' => 'produto', 'rotulo' => 'Produto', 'tipo' => 'texto'],
                    ['chave' => 'fazenda', 'rotulo' => 'Propriedade', 'tipo' => 'texto'],
                    ['chave' => 'capacidade', 'rotulo' => 'Capacidade', 'tipo' => 'numero'],
                    ['chave' => 'unidade_capacidade', 'rotulo' => 'Unidade', 'tipo' => 'texto'],
                    ['chave' => 'nivel_pct', 'rotulo' => 'Nível', 'tipo' => 'percentual'],
                    ['chave' => 'volume', 'rotulo' => 'Volume atual', 'tipo' => 'numero'],
                    ['chave' => 'peso_kg', 'rotulo' => 'Peso (kg)', 'tipo' => 'numero'],
                    ['chave' => 'temperatura', 'rotulo' => 'Temp. (°C)', 'tipo' => 'numero'],
                    ['chave' => 'umidade_graos', 'rotulo' => 'Umid. grãos (%)', 'tipo' => 'numero'],
                    ['chave' => 'data_hora', 'rotulo' => 'Última leitura', 'tipo' => 'texto'],
                ],
                'linhas'  => $linhas,
                'resumo'  => [['rotulo' => 'Armazenamentos', 'valor' => count($linhas), 'tipo' => 'numero']],
            ]);

        case 'documentos':
            $sql = 'SELECT d.titulo, d.tipo_documento AS tipo, f.nome AS fazenda, t.nome_identificacao AS talhao, s.ano_periodo AS safra,
                           d.nome_original, d.data_validade, d.data_upload AS data_criacao
                      FROM documentos d JOIN fazendas f ON f.id = d.fazenda_id LEFT JOIN talhoes t ON t.id = d.talhao_id
                      LEFT JOIN safras s ON s.id = d.safra_id
                     WHERE f.usuario_id = :usuario' . $filtroFazenda('d.fazenda_id') . ' ORDER BY f.nome, t.nome_identificacao, d.data_upload DESC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            responder(200, $base + [
                'sucesso' => true,
                'titulo'  => 'Documentos da fazenda',
                'colunas' => [
                    ['chave' => 'titulo', 'rotulo' => 'Documento', 'tipo' => 'texto'],
                    ['chave' => 'tipo', 'rotulo' => 'Tipo', 'tipo' => 'texto'],
                    ['chave' => 'fazenda', 'rotulo' => 'Propriedade', 'tipo' => 'texto'],
                    ['chave' => 'talhao', 'rotulo' => 'Talhão', 'tipo' => 'texto'],
                    ['chave' => 'safra', 'rotulo' => 'Safra', 'tipo' => 'texto'],
                    ['chave' => 'nome_original', 'rotulo' => 'Arquivo', 'tipo' => 'texto'],
                    ['chave' => 'data_validade', 'rotulo' => 'Validade', 'tipo' => 'data'],
                    ['chave' => 'data_criacao', 'rotulo' => 'Enviado em', 'tipo' => 'texto'],
                ],
                'linhas'  => $stmt->fetchAll(),
                'resumo'  => [],
            ]);

        case 'vendas':
        case 'compras':
            $coluna = $tipo === 'vendas' ? 'p.vendedor_id' : 'p.comprador_id';
            $outra = $tipo === 'vendas' ? 'p.comprador_id' : 'p.vendedor_id';
            $params = [':usuario' => $usuarioId];
            $sql = "SELECT p.id AS pedido, DATE(p.data_criacao) AS data, u.nome AS contraparte, i.nome_produto, i.quantidade,
                           i.preco_unitario, (i.quantidade * i.preco_unitario) AS subtotal, p.status
                      FROM pedidos p JOIN pedido_itens i ON i.pedido_id = p.id JOIN usuarios u ON u.id = $outra
                     WHERE $coluna = :usuario" . $filtroData('DATE(p.data_criacao)') . ' ORDER BY p.data_criacao, p.id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $linhas = $stmt->fetchAll();
            $validas = array_filter($linhas, fn($l) => $l['status'] !== 'cancelado');
            $base['subtitulo'] = $periodo;
            responder(200, $base + [
                'sucesso' => true,
                'titulo'  => $tipo === 'vendas' ? 'Histórico de vendas' : 'Histórico de compras',
                'colunas' => [
                    ['chave' => 'pedido', 'rotulo' => 'Pedido', 'tipo' => 'numero'],
                    ['chave' => 'data', 'rotulo' => 'Data', 'tipo' => 'data'],
                    ['chave' => 'contraparte', 'rotulo' => $tipo === 'vendas' ? 'Comprador' : 'Vendedor', 'tipo' => 'texto'],
                    ['chave' => 'nome_produto', 'rotulo' => 'Produto', 'tipo' => 'texto'],
                    ['chave' => 'quantidade', 'rotulo' => 'Qtd.', 'tipo' => 'numero'],
                    ['chave' => 'preco_unitario', 'rotulo' => 'Preço unit. (R$)', 'tipo' => 'moeda'],
                    ['chave' => 'subtotal', 'rotulo' => 'Subtotal (R$)', 'tipo' => 'moeda'],
                    ['chave' => 'status', 'rotulo' => 'Status', 'tipo' => 'texto'],
                ],
                'linhas'  => $linhas,
                'resumo'  => [
                    ['rotulo' => 'Pedidos', 'valor' => count(array_unique(array_column($linhas, 'pedido'))), 'tipo' => 'numero'],
                    ['rotulo' => 'Total (sem cancelados)', 'valor' => f2(array_sum(array_column($validas, 'subtotal'))), 'tipo' => 'moeda'],
                ],
            ]);
    }

    falha('Tipo de relatório inválido.');
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_RELATORIOS] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível gerar o relatório.']);
}
