<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/iot.php';

// GET [?fazenda_id=N]: resumo da Gestão da Fazenda (propriedades, talhões, safras e
// leituras reais dos sensores IoT das placas ESP32 do produtor).
// Acesso restrito a produtores/administradores; a regra é validada aqui, não só no menu.
// Somente leitura. O painel consulta esta rota a cada poucos segundos.
exigir_metodo('GET');
$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    exigir_produtor($pdo, $usuarioId);

    $stmt = $pdo->prepare('SELECT id, nome, localizacao, area_total FROM fazendas WHERE usuario_id = :usuario ORDER BY nome');
    $stmt->execute([':usuario' => $usuarioId]);
    $fazendas = array_map(fn(array $f): array => [
        'id'          => (int) $f['id'],
        'nome'        => $f['nome'],
        'localizacao' => $f['localizacao'],
        'area_total'  => (float) $f['area_total'],
    ], $stmt->fetchAll());

    $ids = array_column($fazendas, 'id');

    // Filtro opcional por propriedade (só vale se pertencer ao usuário).
    $filtro = filter_var($_GET['fazenda_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($filtro !== false && in_array($filtro, $ids, true)) {
        $ids = [$filtro];
    }

    $resumo = ['propriedades' => count($fazendas), 'talhoes' => 0, 'safras_ativas' => 0, 'dispositivos' => 0];
    $sensores = [];
    $dispositivos = [];

    if ($ids) {
        $marcadores = implode(',', array_fill(0, count($ids), '?'));

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM talhoes WHERE fazenda_id IN ($marcadores)");
        $stmt->execute($ids);
        $resumo['talhoes'] = (int) $stmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM safras WHERE status = 'em_andamento' AND fazenda_id IN ($marcadores)");
        $stmt->execute($ids);
        $resumo['safras_ativas'] = (int) $stmt->fetchColumn();

        // Sensores na ordem do catálogo (tipos desconhecidos vão para o fim).
        $tipos = array_keys(SENSORES_ESTACAO);
        $marcadoresTipo = implode(',', array_fill(0, count($tipos), '?'));

        $stmt = $pdo->prepare(
            "SELECT s.id, s.tipo_sensor, s.codigo_esp32, s.status
               FROM sensores_iot s
              WHERE s.fazenda_id IN ($marcadores)
              ORDER BY SUBSTRING_INDEX(s.codigo_esp32, ':', 1),
                       FIELD(s.tipo_sensor, $marcadoresTipo) = 0,
                       FIELD(s.tipo_sensor, $marcadoresTipo),
                       s.id"
        );
        $stmt->execute([...$ids, ...$tipos, ...$tipos]);
        $linhasSensores = $stmt->fetchAll();

        // Últimas leituras de cada sensor (a mais recente primeiro). Compatível com MySQL 5.7.
        $historico = $pdo->prepare(
            'SELECT valor_leitura, data_hora, TIMESTAMPDIFF(SECOND, data_hora, NOW()) AS segundos
               FROM leituras_iot
              WHERE sensor_id = :sensor
              ORDER BY data_hora DESC, id DESC
              LIMIT ' . IOT_LEITURAS_HISTORICO
        );

        foreach ($linhasSensores as $s) {
            $historico->execute([':sensor' => $s['id']]);
            $leituras = $historico->fetchAll();
            $ultima = $leituras[0] ?? null;
            $catalogo = SENSORES_ESTACAO[$s['tipo_sensor']] ?? null;

            $sensores[] = [
                'id'                 => (int) $s['id'],
                'tipo'               => $s['tipo_sensor'],
                'nome'               => $catalogo['nome'] ?? null,
                'unidade'            => $catalogo['unidade'] ?? null,
                'codigo'             => codigo_placa_do_sensor($s['codigo_esp32']),
                'status'             => $s['status'],
                'valor'              => $ultima ? (float) $ultima['valor_leitura'] : null,
                'ultima_leitura'     => $ultima['data_hora'] ?? null,
                'segundos_sem_sinal' => $ultima ? max(0, (int) $ultima['segundos']) : null,
                // Da mais antiga para a mais recente, para o gráfico do card.
                'historico'          => array_reverse(array_map(fn(array $l): float => (float) $l['valor_leitura'], $leituras)),
            ];
        }

        $stmt = $pdo->prepare(
            "SELECT d.codigo, d.nome, d.fazenda_id, d.ultima_comunicacao,
                    TIMESTAMPDIFF(SECOND, d.ultima_comunicacao, NOW()) AS segundos_sem_sinal
               FROM dispositivos_iot d
              WHERE d.usuario_id = ? AND d.fazenda_id IN ($marcadores)
              ORDER BY d.nome, d.id"
        );
        $stmt->execute([$usuarioId, ...$ids]);
        $dispositivos = array_map(fn(array $d): array => [
            'codigo'             => $d['codigo'],
            'nome'               => $d['nome'],
            'fazenda_id'         => (int) $d['fazenda_id'],
            'ultima_comunicacao' => $d['ultima_comunicacao'],
            'segundos_sem_sinal' => $d['segundos_sem_sinal'] === null ? null : max(0, (int) $d['segundos_sem_sinal']),
        ], $stmt->fetchAll());

        // Placas distintas (cada ESP32 traz vários sensores).
        $resumo['dispositivos'] = count(array_unique(array_merge(
            array_column($sensores, 'codigo'),
            array_column($dispositivos, 'codigo')
        )));
    }

    responder(200, [
        'sucesso'      => true,
        'fazendas'     => $fazendas,
        'resumo'       => $resumo,
        'sensores'     => $sensores,
        'dispositivos' => $dispositivos,
    ]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_GESTAO_RESUMO] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar a Gestão da Fazenda.']);
}
