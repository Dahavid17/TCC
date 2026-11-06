<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// GET [?fazenda_id=N]: resumo da Gestão da Fazenda (propriedades, talhões, safras, sensores IoT).
// Acesso restrito a produtores/administradores; a regra é validada aqui, não só no menu.
// Somente leitura: devolve o que existe no banco (as tabelas podem estar vazias).
exigir_metodo('GET');
$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare('SELECT tipo_acesso FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);

    if (!in_array($stmt->fetchColumn(), ['produtor', 'admin'], true)) {
        responder(403, ['sucesso' => false, 'mensagem' => 'A Gestão da Fazenda é exclusiva para produtores.']);
    }

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

    if ($ids) {
        $marcadores = implode(',', array_fill(0, count($ids), '?'));

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM talhoes WHERE fazenda_id IN ($marcadores)");
        $stmt->execute($ids);
        $resumo['talhoes'] = (int) $stmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM safras WHERE status = 'em_andamento' AND fazenda_id IN ($marcadores)");
        $stmt->execute($ids);
        $resumo['safras_ativas'] = (int) $stmt->fetchColumn();

        $stmt = $pdo->prepare(
            "SELECT s.id, s.tipo_sensor, s.codigo_esp32, s.status,
                    (SELECT l.valor_leitura FROM leituras_iot l WHERE l.sensor_id = s.id ORDER BY l.data_hora DESC, l.id DESC LIMIT 1) AS valor,
                    (SELECT l.data_hora FROM leituras_iot l WHERE l.sensor_id = s.id ORDER BY l.data_hora DESC, l.id DESC LIMIT 1) AS ultima_leitura
               FROM sensores_iot s
              WHERE s.fazenda_id IN ($marcadores)
              ORDER BY s.tipo_sensor, s.id"
        );
        $stmt->execute($ids);

        foreach ($stmt->fetchAll() as $s) {
            $sensores[] = [
                'id'             => (int) $s['id'],
                'tipo'           => $s['tipo_sensor'],
                'codigo'         => $s['codigo_esp32'],
                'status'         => $s['status'],
                'valor'          => $s['valor'] === null ? null : (float) $s['valor'],
                'ultima_leitura' => $s['ultima_leitura'],
            ];
        }

        $resumo['dispositivos'] = count($sensores);
    }

    responder(200, ['sucesso' => true, 'fazendas' => $fazendas, 'resumo' => $resumo, 'sensores' => $sensores]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_GESTAO_RESUMO] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar a Gestão da Fazenda.']);
}
