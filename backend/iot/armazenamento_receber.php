<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/iot.php';
require_once __DIR__ . '/../lib/armazenamento.php';

// POST (JSON): leituras de silos/bags/reservatórios enviadas por um ESP32 (ou pela ponte
// MQTT -> HTTP). Autenticação igual a receber.php: cabeçalho X-Token-Dispositivo.
//
// Corpo:
//   {"dispositivo":"ESP32-MR-88CDA7",
//    "armazenamentos":[{"codigo":"SILO-01","distancia_cm":182.5,"peso_kg":null,
//                       "temperatura":24.1,"umidade_graos":13.2}]}
// Também aceita um único armazenamento no corpo: {"dispositivo":..., "codigo":"SILO-01", ...}.
// Só grava em armazenamentos do mesmo dono da placa e vinculados a ela (dispositivo_codigo).
exigir_metodo('POST');

$corpo  = ler_corpo_json();
$codigo = normalizar_codigo_dispositivo($corpo['dispositivo'] ?? '');
$token  = (string) ($_SERVER['HTTP_X_TOKEN_DISPOSITIVO'] ?? '');

if (preg_match(PADRAO_CODIGO_DISPOSITIVO, $codigo) !== 1 || $token === '') {
    responder(401, ['sucesso' => false, 'mensagem' => 'Dispositivo não autenticado.']);
}

$itens = $corpo['armazenamentos'] ?? (isset($corpo['codigo']) ? [$corpo] : null);
if (!is_array($itens) || !$itens || count($itens) > 20) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Envie de 1 a 20 leituras de armazenamento.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare('SELECT id, usuario_id, token_hash FROM dispositivos_iot WHERE codigo = :codigo LIMIT 1');
    $stmt->execute([':codigo' => $codigo]);
    $dispositivo = $stmt->fetch();

    if (!$dispositivo || !hash_equals($dispositivo['token_hash'], hash_token_dispositivo($token))) {
        responder(401, ['sucesso' => false, 'mensagem' => 'Dispositivo não autenticado.']);
    }

    // Silos fazem parte do Plano Pro do dono da placa.
    require_once __DIR__ . '/../lib/gestao.php';
    exigir_recurso($pdo, (int) $dispositivo['usuario_id'], 'silos');

    $buscar = $pdo->prepare(
        'SELECT a.* FROM armazenamentos a JOIN fazendas f ON f.id = a.fazenda_id
          WHERE f.usuario_id = :usuario AND a.codigo = :codigo AND a.dispositivo_codigo = :placa LIMIT 1'
    );

    $gravadas = 0;
    $ignoradas = [];
    $pdo->beginTransaction();

    foreach ($itens as $item) {
        $codigoArm = strtoupper(trim((string) ($item['codigo'] ?? '')));
        $buscar->execute([':usuario' => $dispositivo['usuario_id'], ':codigo' => $codigoArm, ':placa' => $codigo]);
        $arm = $buscar->fetch();
        if (!$arm) {
            $ignoradas[] = $codigoArm;
            continue;
        }
        gravar_leitura_armazenamento($pdo, $arm, $item, 'esp32');
        $gravadas++;
    }

    $pdo->prepare('UPDATE dispositivos_iot SET ultima_comunicacao = NOW() WHERE id = :id')->execute([':id' => $dispositivo['id']]);
    $pdo->commit();

    responder($gravadas ? 201 : 200, ['sucesso' => true, 'gravadas' => $gravadas, 'ignoradas' => $ignoradas]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[MARKETPLACE_IOT_ARMAZENAMENTO] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível gravar as leituras.']);
}
