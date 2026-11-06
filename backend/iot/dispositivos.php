<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/iot.php';

// Vincula placas ESP32 ao perfil do produtor logado.
//
// GET  -> lista as placas do produtor.
// POST (JSON) -> conecta uma placa e devolve o token dela (exibido uma única vez):
//   {"codigo":"ESP32-MR-88CDA7","nome":"Estação do talhão 1","fazenda_id":3}
//   Produtor sem propriedade cadastrada envia os dados da primeira em vez de fazenda_id:
//   {"codigo":"...","fazenda":{"nome":"Sítio Boa Vista","localizacao":"Arceburgo - MG","area_total":12.5}}
//   Reenviar o código de uma placa que já é sua gera um token novo (o anterior deixa de valer).
$metodo = $_SERVER['REQUEST_METHOD'];

if (!in_array($metodo, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    responder(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

$usuarioId = exigir_sessao();

// Só aceita JSON no POST: um formulário de outro site não consegue enviar esse tipo sem CORS.
if ($metodo === 'POST' && stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) {
    responder(415, ['sucesso' => false, 'mensagem' => 'Envie os dados em JSON.']);
}

function listar_dispositivos(PDO $pdo, int $usuarioId): array
{
    $stmt = $pdo->prepare(
        'SELECT d.codigo, d.nome, d.fazenda_id, f.nome AS fazenda_nome, d.ultima_comunicacao,
                TIMESTAMPDIFF(SECOND, d.ultima_comunicacao, NOW()) AS segundos_sem_sinal
           FROM dispositivos_iot d
           JOIN fazendas f ON f.id = d.fazenda_id
          WHERE d.usuario_id = :usuario
          ORDER BY d.nome, d.id'
    );
    $stmt->execute([':usuario' => $usuarioId]);

    return array_map(fn(array $d): array => [
        'codigo'             => $d['codigo'],
        'nome'               => $d['nome'],
        'fazenda_id'         => (int) $d['fazenda_id'],
        'fazenda_nome'       => $d['fazenda_nome'],
        'ultima_comunicacao' => $d['ultima_comunicacao'],
        'segundos_sem_sinal' => $d['segundos_sem_sinal'] === null ? null : max(0, (int) $d['segundos_sem_sinal']),
    ], $stmt->fetchAll());
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    exigir_produtor($pdo, $usuarioId);

    if ($metodo === 'GET') {
        responder(200, ['sucesso' => true, 'dispositivos' => listar_dispositivos($pdo, $usuarioId)]);
    }

    $corpo  = ler_corpo_json();
    $codigo = normalizar_codigo_dispositivo($corpo['codigo'] ?? '');
    $nome   = trim((string) ($corpo['nome'] ?? ''));

    if (preg_match(PADRAO_CODIGO_DISPOSITIVO, $codigo) !== 1) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Informe o código exibido no monitor serial do ESP32 (ex.: ESP32-MR-1A2B3C).']);
    }

    if (mb_strlen($nome) > 120) {
        responder(422, ['sucesso' => false, 'mensagem' => 'O nome da estação pode ter no máximo 120 caracteres.']);
    }

    $nome = $nome !== '' ? $nome : 'Estação ' . $codigo;

    $stmt = $pdo->prepare('SELECT id, usuario_id FROM dispositivos_iot WHERE codigo = :codigo LIMIT 1');
    $stmt->execute([':codigo' => $codigo]);
    $existente = $stmt->fetch();

    if ($existente && (int) $existente['usuario_id'] !== $usuarioId) {
        responder(409, ['sucesso' => false, 'mensagem' => 'Este ESP32 já está conectado ao perfil de outro produtor.']);
    }

    $stmt = $pdo->prepare('SELECT id FROM fazendas WHERE usuario_id = :usuario ORDER BY id');
    $stmt->execute([':usuario' => $usuarioId]);
    $minhasFazendas = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

    $fazendaId = filter_var($corpo['fazenda_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $novaFazenda = null;

    if ($fazendaId !== false) {
        if (!in_array($fazendaId, $minhasFazendas, true)) {
            responder(422, ['sucesso' => false, 'mensagem' => 'Propriedade inválida.']);
        }
    } elseif (!$minhasFazendas) {
        $dados       = is_array($corpo['fazenda'] ?? null) ? $corpo['fazenda'] : [];
        $fazendaNome = trim((string) ($dados['nome'] ?? ''));
        $localizacao = trim((string) ($dados['localizacao'] ?? ''));
        $area        = str_replace(',', '.', trim((string) ($dados['area_total'] ?? '')));

        if ($fazendaNome === '' || mb_strlen($fazendaNome) > 150) {
            responder(422, ['sucesso' => false, 'mensagem' => 'Informe o nome da propriedade (até 150 caracteres).']);
        }

        if (mb_strlen($localizacao) > 255) {
            responder(422, ['sucesso' => false, 'mensagem' => 'A localização pode ter no máximo 255 caracteres.']);
        }

        if ($area !== '' && (!is_numeric($area) || (float) $area < 0 || (float) $area > 99999999)) {
            responder(422, ['sucesso' => false, 'mensagem' => 'Informe a área em hectares (número).']);
        }

        $novaFazenda = [
            'nome'        => $fazendaNome,
            'localizacao' => $localizacao !== '' ? $localizacao : null,
            'area_total'  => $area !== '' ? number_format((float) $area, 2, '.', '') : null,
        ];
    } else {
        responder(422, ['sucesso' => false, 'mensagem' => 'Escolha a propriedade onde o ESP32 está instalado.']);
    }

    $token = gerar_token_dispositivo();

    $pdo->beginTransaction();

    if ($novaFazenda) {
        $pdo->prepare('INSERT INTO fazendas (usuario_id, nome, localizacao, area_total) VALUES (:usuario, :nome, :localizacao, :area)')
            ->execute([
                ':usuario'     => $usuarioId,
                ':nome'        => $novaFazenda['nome'],
                ':localizacao' => $novaFazenda['localizacao'],
                ':area'        => $novaFazenda['area_total'],
            ]);
        $fazendaId = (int) $pdo->lastInsertId();
    }

    if ($existente) {
        $pdo->prepare('UPDATE dispositivos_iot SET nome = :nome, fazenda_id = :fazenda, token_hash = :hash WHERE id = :id')
            ->execute([':nome' => $nome, ':fazenda' => $fazendaId, ':hash' => hash_token_dispositivo($token), ':id' => $existente['id']]);
    } else {
        $pdo->prepare('INSERT INTO dispositivos_iot (usuario_id, fazenda_id, codigo, nome, token_hash) VALUES (:usuario, :fazenda, :codigo, :nome, :hash)')
            ->execute([':usuario' => $usuarioId, ':fazenda' => $fazendaId, ':codigo' => $codigo, ':nome' => $nome, ':hash' => hash_token_dispositivo($token)]);
    }

    // Os cards aparecem já na conexão ("aguardando primeira leitura") e acompanham a placa se ela mudar de propriedade.
    $pdo->prepare('UPDATE sensores_iot SET fazenda_id = :fazenda WHERE codigo_esp32 = :codigo')
        ->execute([':fazenda' => $fazendaId, ':codigo' => $codigo]);

    $buscarSensor = $pdo->prepare('SELECT id FROM sensores_iot WHERE codigo_esp32 = :codigo AND tipo_sensor = :tipo LIMIT 1');
    $criarSensor  = $pdo->prepare("INSERT INTO sensores_iot (fazenda_id, tipo_sensor, codigo_esp32, status) VALUES (:fazenda, :tipo, :codigo, 'ativo')");

    foreach (array_keys(SENSORES_ESTACAO) as $tipo) {
        $buscarSensor->execute([':codigo' => $codigo, ':tipo' => $tipo]);

        if ($buscarSensor->fetchColumn() === false) {
            $criarSensor->execute([':fazenda' => $fazendaId, ':tipo' => $tipo, ':codigo' => $codigo]);
        }
    }

    $pdo->commit();

    responder(201, [
        'sucesso'      => true,
        'mensagem'     => $existente ? 'Token do ESP32 renovado.' : 'ESP32 conectado ao seu perfil.',
        'codigo'       => $codigo,
        'token'        => $token,
        'dispositivos' => listar_dispositivos($pdo, $usuarioId),
    ]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[MARKETPLACE_IOT_DISPOSITIVOS] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível salvar o dispositivo.']);
}
