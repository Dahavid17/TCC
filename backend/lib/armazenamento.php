<?php
declare(strict_types=1);

// Conversão das leituras dos silos/bags/reservatórios.
// O ESP32 envia a DISTÂNCIA (cm) medida pelo sensor ultrassônico no topo até a superfície do
// produto e/ou o PESO (kg) da célula de carga. Com a altura útil e a capacidade cadastradas:
//   nivel % = (altura_util - distancia) / altura_util * 100
//   volume  = capacidade * nivel %
// Se só vier o peso e a capacidade estiver em toneladas, o nível sai do peso.

function calcular_leitura_armazenamento(array $arm, ?float $distanciaCm, ?float $pesoKg): array
{
    $nivel = null;
    $altura = (float) ($arm['altura_util_cm'] ?? 0);
    $capacidade = (float) $arm['capacidade'];

    if ($distanciaCm !== null && $altura > 0) {
        $nivel = max(0.0, min(100.0, ($altura - $distanciaCm) / $altura * 100));
    } elseif ($pesoKg !== null && $arm['unidade_capacidade'] === 'tonelada' && $capacidade > 0) {
        $nivel = max(0.0, min(100.0, ($pesoKg / 1000) / $capacidade * 100));
    } elseif ($pesoKg !== null && $arm['unidade_capacidade'] === 'saca' && $capacidade > 0) {
        $nivel = max(0.0, min(100.0, ($pesoKg / 60) / $capacidade * 100));
    }

    $volume = $nivel === null ? null : round($capacidade * $nivel / 100, 2);

    // Peso estimado pelo volume quando não há célula de carga (grãos: capacidade em t/sacas).
    if ($pesoKg === null && $volume !== null) {
        if ($arm['unidade_capacidade'] === 'tonelada') {
            $pesoKg = $volume * 1000;
        } elseif ($arm['unidade_capacidade'] === 'saca') {
            $pesoKg = $volume * 60;
        }
    }

    return [
        'nivel_pct' => $nivel === null ? null : round($nivel, 2),
        'volume'    => $volume,
        'peso_kg'   => $pesoKg === null ? null : round($pesoKg, 2),
    ];
}

function gravar_leitura_armazenamento(PDO $pdo, array $arm, array $dados, string $origem): array
{
    $distancia = isset($dados['distancia_cm']) && is_numeric($dados['distancia_cm']) ? (float) $dados['distancia_cm'] : null;
    $peso = isset($dados['peso_kg']) && is_numeric($dados['peso_kg']) ? (float) $dados['peso_kg'] : null;
    $temperatura = isset($dados['temperatura']) && is_numeric($dados['temperatura']) ? (float) $dados['temperatura'] : null;
    $umidade = isset($dados['umidade_graos']) && is_numeric($dados['umidade_graos']) ? (float) $dados['umidade_graos'] : null;

    if ($distancia === null && $peso === null && $temperatura === null && $umidade === null) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Envie distancia_cm, peso_kg, temperatura ou umidade_graos.']);
    }
    if (($distancia !== null && ($distancia < 0 || $distancia > 10000))
        || ($peso !== null && ($peso < 0 || $peso > 100000000))
        || ($temperatura !== null && ($temperatura < -40 || $temperatura > 125))
        || ($umidade !== null && ($umidade < 0 || $umidade > 100))) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Leitura fora da faixa válida.']);
    }

    $calc = calcular_leitura_armazenamento($arm, $distancia, $peso);

    $pdo->prepare(
        'INSERT INTO leituras_armazenamento (armazenamento_id, distancia_cm, nivel_pct, volume, peso_kg, temperatura, umidade_graos, origem)
         VALUES (:arm, :dist, :nivel, :volume, :peso, :temp, :umid, :origem)'
    )->execute([
        ':arm' => $arm['id'], ':dist' => $distancia, ':nivel' => $calc['nivel_pct'], ':volume' => $calc['volume'],
        ':peso' => $calc['peso_kg'], ':temp' => $temperatura, ':umid' => $umidade, ':origem' => $origem,
    ]);

    return $calc + ['distancia_cm' => $distancia, 'temperatura' => $temperatura, 'umidade_graos' => $umidade];
}
