<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/iot.php';

// POST (JSON) — apaga dados de IoT do produtor logado:
//   {"sensor_id": 12}                    -> o sensor e todas as leituras dele;
//   {"dispositivo": "ESP32-MR-88CDA7"}   -> a placa, os sensores dela e todas as leituras.
// Sensor apagado deixa de gravar (receber.php ignora tipos sem sensor cadastrado).
// Placa apagada deixa de ser aceita (o token vai junto). Conectar a placa de novo recria os sensores.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) {
    responder(415, ['sucesso' => false, 'mensagem' => 'Envie os dados em JSON.']);
}

$corpo    = ler_corpo_json();
$sensorId = filter_var($corpo['sensor_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$codigo   = normalizar_codigo_dispositivo($corpo['dispositivo'] ?? '');

if ($sensorId === false && preg_match(PADRAO_CODIGO_DISPOSITIVO, $codigo) !== 1) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Informe o sensor ou a placa que deve ser apagada.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    exigir_produtor($pdo, $usuarioId);

    if ($sensorId !== false) {
        // Só sensores de propriedades do próprio usuário.
        $stmt = $pdo->prepare(
            'SELECT s.id FROM sensores_iot s JOIN fazendas f ON f.id = s.fazenda_id
              WHERE s.id = :id AND f.usuario_id = :usuario'
        );
        $stmt->execute([':id' => $sensorId, ':usuario' => $usuarioId]);

        if ($stmt->fetchColumn() === false) {
            responder(404, ['sucesso' => false, 'mensagem' => 'Sensor não encontrado.']);
        }

        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM leituras_iot WHERE sensor_id = :id')->execute([':id' => $sensorId]);
        $pdo->prepare('DELETE FROM sensores_iot WHERE id = :id')->execute([':id' => $sensorId]);
        $pdo->commit();

        responder(200, ['sucesso' => true, 'mensagem' => 'Sensor apagado.']);
    }

    $stmt = $pdo->prepare('SELECT id FROM dispositivos_iot WHERE codigo = :codigo AND usuario_id = :usuario LIMIT 1');
    $stmt->execute([':codigo' => $codigo, ':usuario' => $usuarioId]);
    $dispositivoId = $stmt->fetchColumn();

    if ($dispositivoId === false) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Placa não encontrada.']);
    }

    // Sensores da placa ("<código>:<tipo>") que estão em propriedades do usuário.
    $stmt = $pdo->prepare(
        'SELECT s.id FROM sensores_iot s JOIN fazendas f ON f.id = s.fazenda_id
          WHERE f.usuario_id = :usuario AND s.codigo_esp32 LIKE :prefixo'
    );
    $stmt->execute([':usuario' => $usuarioId, ':prefixo' => codigo_sensor($codigo, '%')]);
    $sensores = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

    $pdo->beginTransaction();

    if ($sensores) {
        $marcadores = implode(',', array_fill(0, count($sensores), '?'));
        $pdo->prepare("DELETE FROM leituras_iot WHERE sensor_id IN ($marcadores)")->execute($sensores);
        $pdo->prepare("DELETE FROM sensores_iot WHERE id IN ($marcadores)")->execute($sensores);
    }

    $pdo->prepare('DELETE FROM dispositivos_iot WHERE id = :id')->execute([':id' => $dispositivoId]);
    $pdo->commit();

    responder(200, ['sucesso' => true, 'mensagem' => 'Placa apagada.', 'sensores_apagados' => count($sensores)]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[MARKETPLACE_IOT_EXCLUIR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível apagar.']);
}
