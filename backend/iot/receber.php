<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/iot.php';

// POST (JSON): grava as leituras enviadas por um ESP32 — direto da placa ou pela
// ponte iot/ponte-wokwi (MQTT -> HTTP).
//
// Quem autentica é o dispositivo, não a sessão: cabeçalho X-Token-Dispositivo com o
// token gerado em Gestão da Fazenda > Conectar ESP32. As leituras ficam na fazenda
// do produtor dono da placa.
//
// Corpo (o mesmo JSON que a placa publica):
//   {"dispositivo":"ESP32-MR-88CDA7","temperatura":26.5,"umidade_ar":62,
//    "luminosidade":800,"umidade_solo":41.3}
// Campos de sensor ausentes são ignorados; pelo menos um precisa vir.
// Só grava tipos com sensor cadastrado (criados ao conectar a placa): um sensor que o
// produtor apagou não volta sozinho — para recriá-lo, conecte a placa de novo.
exigir_metodo('POST');

$corpo  = ler_corpo_json();
$codigo = normalizar_codigo_dispositivo($corpo['dispositivo'] ?? '');
$token  = (string) ($_SERVER['HTTP_X_TOKEN_DISPOSITIVO'] ?? '');

if (preg_match(PADRAO_CODIGO_DISPOSITIVO, $codigo) !== 1 || $token === '') {
    responder(401, ['sucesso' => false, 'mensagem' => 'Dispositivo não autenticado.']);
}

$leituras = [];

foreach (SENSORES_ESTACAO as $tipo => $sensor) {
    if (!array_key_exists($tipo, $corpo)) {
        continue;
    }

    $valor = $corpo[$tipo];

    if ((!is_int($valor) && !is_float($valor)) || $valor < $sensor['min'] || $valor > $sensor['max']) {
        responder(422, ['sucesso' => false, 'mensagem' => "Leitura inválida para {$tipo}."]);
    }

    $leituras[$tipo] = round((float) $valor, 2);
}

if (!$leituras) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Nenhuma leitura de sensor reconhecida.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare('SELECT id, fazenda_id, token_hash FROM dispositivos_iot WHERE codigo = :codigo LIMIT 1');
    $stmt->execute([':codigo' => $codigo]);
    $dispositivo = $stmt->fetch();

    if (!$dispositivo || !hash_equals($dispositivo['token_hash'], hash_token_dispositivo($token))) {
        responder(401, ['sucesso' => false, 'mensagem' => 'Dispositivo não autenticado.']);
    }

    $buscarSensor = $pdo->prepare(
        'SELECT id FROM sensores_iot WHERE codigo_esp32 = :codigo LIMIT 1'
    );
    $gravarLeitura = $pdo->prepare(
        'INSERT INTO leituras_iot (sensor_id, valor_leitura, data_hora) VALUES (:sensor, :valor, NOW())'
    );

    $gravadas = 0;
    $ignoradas = [];

    $pdo->beginTransaction();

    foreach ($leituras as $tipo => $valor) {
        $buscarSensor->execute([':codigo' => codigo_sensor($codigo, $tipo)]);
        $sensorId = $buscarSensor->fetchColumn();

        if ($sensorId === false) {
            $ignoradas[] = $tipo; // sensor apagado pelo produtor
            continue;
        }

        $gravarLeitura->execute([':sensor' => $sensorId, ':valor' => $valor]);
        $gravadas++;
    }

    // A placa está se comunicando mesmo que todos os sensores tenham sido apagados.
    $pdo->prepare('UPDATE dispositivos_iot SET ultima_comunicacao = NOW() WHERE id = :id')
        ->execute([':id' => $dispositivo['id']]);

    $pdo->commit();

    responder($gravadas ? 201 : 200, ['sucesso' => true, 'gravadas' => $gravadas, 'ignoradas' => $ignoradas]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[MARKETPLACE_IOT_RECEBER] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível gravar as leituras.']);
}
