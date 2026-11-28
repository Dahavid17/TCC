<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';
require_once __DIR__ . '/../lib/lembretes.php';

// Agenda Rural (DER: agenda_rural): atividades de campo/manejos e prazos de licenças,
// contratos, documentos e pagamentos.
//   GET [?de&ate&status=pendente|concluido&tipo]  -> eventos (com dias restantes) e resumo
//   POST acao=salvar          id?, titulo, tipo, data_evento, hora_evento?, lembrar_dias_antes,
//                             fazenda_id, talhao_id?, descricao?
//   POST acao=concluir|reabrir|excluir&id=N
const TIPOS_AGENDA = ['atividade', 'manejo', 'licenca', 'contrato', 'documento', 'pagamento', 'outros'];

try {
    [$pdo, $usuarioId] = inicio_gestao();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        gerar_lembretes($pdo, $usuarioId);

        $where = ['f.usuario_id = :usuario'];
        $params = [':usuario' => $usuarioId];
        if ($de = data_valida($_GET, 'de')) { $where[] = 'e.data_vencimento >= :de'; $params[':de'] = $de; }
        if ($ate = data_valida($_GET, 'ate')) { $where[] = 'e.data_vencimento <= :ate'; $params[':ate'] = $ate; }
        if (($_GET['status'] ?? '') === 'pendente') { $where[] = 'COALESCE(e.status_conclusao, 0) = 0'; }
        if (($_GET['status'] ?? '') === 'concluido') { $where[] = 'e.status_conclusao = 1'; }
        if (in_array($_GET['tipo'] ?? '', TIPOS_AGENDA, true)) {
            $where[] = 'e.tipo_alerta = :tipo';
            $params[':tipo'] = $_GET['tipo'];
        }

        $stmt = $pdo->prepare(
            "SELECT e.id, e.fazenda_id, e.talhao_id, COALESCE(e.tipo_alerta, 'outros') AS tipo, e.titulo, e.descricao,
                    e.data_vencimento AS data_evento, e.hora_evento, e.lembrar_dias_antes,
                    CASE WHEN e.status_conclusao = 1 THEN 'concluido' ELSE 'pendente' END AS status, e.data_conclusao,
                    f.nome AS fazenda_nome, t.nome_identificacao AS talhao_nome,
                    DATEDIFF(e.data_vencimento, CURDATE()) AS dias_restantes
               FROM agenda_rural e
               JOIN fazendas f ON f.id = e.fazenda_id
               LEFT JOIN talhoes t ON t.id = e.talhao_id
              WHERE " . implode(' AND ', $where) . '
              ORDER BY COALESCE(e.status_conclusao, 0), e.data_vencimento, e.hora_evento, e.id
              LIMIT 1000'
        );
        $stmt->execute($params);
        $eventos = $stmt->fetchAll();

        $stmt = $pdo->prepare(
            "SELECT SUM(e.data_vencimento < CURDATE()) AS atrasados,
                    SUM(e.data_vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)) AS proximos_7_dias,
                    SUM(e.tipo_alerta IN ('licenca','contrato','documento','pagamento') AND e.data_vencimento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)) AS vencimentos_30_dias
               FROM agenda_rural e JOIN fazendas f ON f.id = e.fazenda_id
              WHERE f.usuario_id = :usuario AND COALESCE(e.status_conclusao, 0) = 0"
        );
        $stmt->execute([':usuario' => $usuarioId]);

        responder(200, [
            'sucesso' => true,
            'eventos' => $eventos,
            'resumo'  => array_map('intval', $stmt->fetch() ?: []),
        ]);
    }

    exigir_metodo('POST');
    $d = entrada();
    $acao = (string) ($d['acao'] ?? '');

    if (in_array($acao, ['concluir', 'reabrir', 'excluir'], true)) {
        $id = inteiro_id($d, 'id', true);
        $stmt = $pdo->prepare('SELECT e.id FROM agenda_rural e JOIN fazendas f ON f.id = e.fazenda_id WHERE e.id = :id AND f.usuario_id = :usuario');
        $stmt->execute([':id' => $id, ':usuario' => $usuarioId]);
        if (!$stmt->fetchColumn()) {
            falha('Evento não encontrado.', 404);
        }
        $sql = [
            'concluir' => 'UPDATE agenda_rural SET status_conclusao = 1, data_conclusao = NOW() WHERE id = :id',
            'reabrir'  => 'UPDATE agenda_rural SET status_conclusao = 0, data_conclusao = NULL WHERE id = :id',
            'excluir'  => 'DELETE FROM agenda_rural WHERE id = :id',
        ][$acao];
        $pdo->prepare($sql)->execute([':id' => $id]);
        responder(200, ['sucesso' => true, 'mensagem' => 'Agenda atualizada.']);
    }

    if ($acao !== 'salvar') {
        falha('Ação inválida.');
    }

    $id = inteiro_id($d, 'id');
    $talhaoId = inteiro_id($d, 'talhao_id');
    $fazendaId = inteiro_id($d, 'fazenda_id');
    if ($talhaoId) {
        $fazendaId = (int) exigir_talhao($pdo, $usuarioId, $talhaoId)['fazenda_id'];
    }
    if (!$fazendaId) {
        falha('Escolha a propriedade do compromisso.');
    }
    exigir_fazenda($pdo, $usuarioId, $fazendaId);

    $hora = trim((string) ($d['hora_evento'] ?? ''));
    if ($hora !== '' && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $hora) !== 1) {
        falha('Hora inválida.');
    }
    $lembrar = filter_var($d['lembrar_dias_antes'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 365]]);
    if ($lembrar === false) {
        falha('Informe com quantos dias de antecedência lembrar (0 a 365).');
    }

    $dados = [
        ':fazenda'   => $fazendaId,
        ':talhao'    => $talhaoId,
        ':tipo'      => opcao($d, 'tipo', TIPOS_AGENDA, 'atividade', 'tipo'),
        ':titulo'    => texto($d, 'titulo', 150, true, 'título'),
        ':descricao' => texto($d, 'descricao', 1000),
        ':data'      => data_valida($d, 'data_evento', true, 'data'),
        ':hora'      => $hora === '' ? null : $hora . ':00',
        ':lembrar'   => $lembrar,
    ];

    if ($id) {
        $stmt = $pdo->prepare('SELECT e.id FROM agenda_rural e JOIN fazendas f ON f.id = e.fazenda_id WHERE e.id = :id AND f.usuario_id = :usuario');
        $stmt->execute([':id' => $id, ':usuario' => $usuarioId]);
        if (!$stmt->fetchColumn()) {
            falha('Evento não encontrado.', 404);
        }
        $pdo->prepare(
            'UPDATE agenda_rural SET fazenda_id = :fazenda, talhao_id = :talhao, tipo_alerta = :tipo, titulo = :titulo,
                    descricao = :descricao, data_vencimento = :data, hora_evento = :hora, lembrar_dias_antes = :lembrar
              WHERE id = :id'
        )->execute($dados + [':id' => $id]);
    } else {
        $pdo->prepare(
            'INSERT INTO agenda_rural (fazenda_id, talhao_id, tipo_alerta, titulo, descricao, data_vencimento, hora_evento, lembrar_dias_antes, status_conclusao)
             VALUES (:fazenda, :talhao, :tipo, :titulo, :descricao, :data, :hora, :lembrar, 0)'
        )->execute($dados);
        $id = (int) $pdo->lastInsertId();
    }

    gerar_lembretes($pdo, $usuarioId);

    responder(200, ['sucesso' => true, 'mensagem' => 'Evento salvo na agenda.', 'id' => $id]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_GESTAO_AGENDA] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível processar a agenda.']);
}
