<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';

// Diário de Campo (DER: operacoes_diario).
//   GET [?fazenda_id&talhao_id&safra_id&tipo&de&ate]
//   POST acao=salvar       id?, talhao_id, safra_id, tipo, data_operacao, produto, dosagem (texto,
//                          ex.: "0,3 L/ha"), area_aplicada_ha, responsavel, custo, observacoes, uuid_cliente?
//   POST acao=sincronizar  { registros: [ {...mesmos campos, uuid_cliente obrigatório} ] }
//                          -> registros feitos OFFLINE no celular. O uuid_cliente torna o envio
//                             idempotente: reenviar o mesmo registro não duplica.
//   POST acao=excluir&id=N
//
// Uma operação com custo gera a despesa correspondente em transacoes_financeiras
// (categoria conforme o tipo), ligada pelo operacao_id.
const CATEGORIA_POR_OPERACAO = [
    'plantio' => 'sementes', 'pulverizacao' => 'defensivos', 'adubacao' => 'fertilizantes',
    'irrigacao' => 'energia', 'colheita' => 'maquinas', 'preparo_solo' => 'maquinas', 'outro' => 'outros',
];

const NOMES_OPERACAO = [
    'plantio' => 'Plantio', 'pulverizacao' => 'Pulverização', 'adubacao' => 'Adubação',
    'irrigacao' => 'Irrigação', 'colheita' => 'Colheita', 'preparo_solo' => 'Preparo do solo', 'outro' => 'Outra',
];

final class ErroValidacao extends RuntimeException {}

try {
    [$pdo, $usuarioId] = inicio_gestao();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $where = ['f.usuario_id = :usuario'];
        $params = [':usuario' => $usuarioId];
        if ($fazendaId = filtro_fazenda($pdo, $usuarioId)) {
            $where[] = 't.fazenda_id = :fazenda';
            $params[':fazenda'] = $fazendaId;
        }
        foreach (['talhao_id', 'safra_id'] as $campo) {
            $valor = filter_var($_GET[$campo] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($valor) {
                $where[] = "o.$campo = :$campo";
                $params[":$campo"] = $valor;
            }
        }
        if (in_array($_GET['tipo'] ?? '', TIPOS_OPERACAO, true)) {
            $where[] = 'o.tipo_operacao = :tipo';
            $params[':tipo'] = $_GET['tipo'];
        }
        if ($de = data_valida($_GET, 'de')) { $where[] = 'o.data_operacao >= :de'; $params[':de'] = $de; }
        if ($ate = data_valida($_GET, 'ate')) { $where[] = 'o.data_operacao <= :ate'; $params[':ate'] = $ate; }

        $stmt = $pdo->prepare(
            'SELECT o.id, o.talhao_id, o.safra_id, o.tipo_operacao AS tipo, o.data_operacao, o.produto_insumo AS produto,
                    o.dosagem, o.area_aplicada_ha, o.responsavel, o.custo, o.observacoes, o.registrado_offline,
                    t.nome_identificacao AS talhao_nome, f.nome AS fazenda_nome, s.ano_periodo AS safra_nome
               FROM operacoes_diario o
               JOIN talhoes t ON t.id = o.talhao_id
               JOIN fazendas f ON f.id = t.fazenda_id
               JOIN safras s ON s.id = o.safra_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY o.data_operacao DESC, o.id DESC LIMIT 1000'
        );
        $stmt->execute($params);

        responder(200, ['sucesso' => true, 'operacoes' => $stmt->fetchAll(), 'tipos' => NOMES_OPERACAO]);
    }

    exigir_metodo('POST');
    $d = entrada();
    $acao = (string) ($d['acao'] ?? '');

    if ($acao === 'excluir') {
        $id = inteiro_id($d, 'id', true);
        // A despesa automática some junto (FK fk_financeiro_operacao ON DELETE CASCADE).
        alterar_do_dono($pdo,
            'DELETE o FROM operacoes_diario o JOIN talhoes t ON t.id = o.talhao_id JOIN fazendas f ON f.id = t.fazenda_id
              WHERE o.id = :id AND f.usuario_id = :usuario',
            [':id' => $id, ':usuario' => $usuarioId], 'Operação não encontrada.');
        responder(200, ['sucesso' => true, 'mensagem' => 'Operação excluída.']);
    }

    if ($acao === 'sincronizar') {
        $registros = $d['registros'] ?? null;
        if (!is_array($registros) || count($registros) > 200) {
            falha('Envie de 1 a 200 registros.');
        }
        $resultado = [];
        foreach ($registros as $registro) {
            if (!is_array($registro)) {
                continue;
            }
            $uuid = (string) ($registro['uuid_cliente'] ?? '');
            try {
                $pdo->beginTransaction();
                $id = salvar_operacao($pdo, $usuarioId, $registro, true);
                $pdo->commit();
                $resultado[] = ['uuid_cliente' => $uuid, 'ok' => true, 'id' => $id];
            } catch (ErroValidacao $e) {
                $pdo->rollBack();
                $resultado[] = ['uuid_cliente' => $uuid, 'ok' => false, 'mensagem' => $e->getMessage()];
            }
        }
        responder(200, ['sucesso' => true, 'resultado' => $resultado]);
    }

    if ($acao !== 'salvar') {
        falha('Ação inválida.');
    }

    try {
        $pdo->beginTransaction();
        $id = salvar_operacao($pdo, $usuarioId, $d, false);
        $pdo->commit();
    } catch (ErroValidacao $e) {
        $pdo->rollBack();
        falha($e->getMessage(), $e->getCode() ?: 422);
    }

    responder(200, ['sucesso' => true, 'mensagem' => 'Operação registrada no diário.', 'id' => $id]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[MARKETPLACE_GESTAO_OPERACOES] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível processar a operação.']);
}

// Valida e grava uma operação (insere, atualiza ou, na sincronização, ignora repetidas).
// Lança ErroValidacao em vez de responder, para a sincronização em lote seguir adiante.
function salvar_operacao(PDO $pdo, int $usuarioId, array $d, bool $offline): int
{
    $tipo = (string) ($d['tipo'] ?? '');
    if (!in_array($tipo, TIPOS_OPERACAO, true)) {
        throw new ErroValidacao('Tipo de operação inválido.');
    }

    $data = (string) ($d['data_operacao'] ?? '');
    $dt = DateTime::createFromFormat('!Y-m-d', $data);
    if (!$dt || $dt->format('Y-m-d') !== $data) {
        throw new ErroValidacao('Data da operação inválida.');
    }

    $stmt = $pdo->prepare(
        'SELECT t.id, t.fazenda_id, t.area_hectares FROM talhoes t JOIN fazendas f ON f.id = t.fazenda_id
          WHERE t.id = :id AND f.usuario_id = :usuario'
    );
    $stmt->execute([':id' => (int) ($d['talhao_id'] ?? 0), ':usuario' => $usuarioId]);
    $talhao = $stmt->fetch();
    if (!$talhao) {
        throw new ErroValidacao('Talhão não encontrado.', 404);
    }

    // No DER toda operação pertence a uma safra da mesma propriedade do talhão.
    $safraId = (int) ($d['safra_id'] ?? 0);
    $stmt = $pdo->prepare('SELECT s.fazenda_id FROM safras s JOIN fazendas f ON f.id = s.fazenda_id WHERE s.id = :id AND f.usuario_id = :usuario');
    $stmt->execute([':id' => $safraId, ':usuario' => $usuarioId]);
    $fazendaDaSafra = $stmt->fetchColumn();
    if ($fazendaDaSafra === false) {
        throw new ErroValidacao('Escolha a safra da operação (cadastre uma em Safras, se ainda não houver).');
    }
    if ((int) $fazendaDaSafra !== (int) $talhao['fazenda_id']) {
        throw new ErroValidacao('A safra não pertence à propriedade do talhão.');
    }

    $num = function (string $campo, float $max) use ($d): ?float {
        $v = $d[$campo] ?? '';
        if ($v === '' || $v === null) {
            return null;
        }
        $v = is_string($v) ? str_replace(',', '.', $v) : $v;
        if (!is_numeric($v) || (float) $v < 0 || (float) $v > $max) {
            throw new ErroValidacao("Valor inválido em {$campo}.");
        }
        return (float) $v;
    };
    $txt = function (string $campo, int $max) use ($d): ?string {
        $v = trim((string) ($d[$campo] ?? ''));
        if (mb_strlen($v) > $max) {
            throw new ErroValidacao("O campo {$campo} aceita até {$max} caracteres.");
        }
        return $v === '' ? null : $v;
    };

    $uuid = $txt('uuid_cliente', 36);
    if ($uuid !== null && preg_match('/^[0-9a-f-]{36}$/i', $uuid) !== 1) {
        throw new ErroValidacao('Identificador do registro offline inválido.');
    }
    if ($offline && $uuid === null) {
        throw new ErroValidacao('Registro offline sem identificador.');
    }

    // Mesmo registro enviado de novo: devolve o id que já existe (só se for deste usuário).
    if ($uuid !== null) {
        $stmt = $pdo->prepare(
            'SELECT o.id, f.usuario_id FROM operacoes_diario o JOIN talhoes t ON t.id = o.talhao_id JOIN fazendas f ON f.id = t.fazenda_id
              WHERE o.uuid_cliente = :uuid'
        );
        $stmt->execute([':uuid' => $uuid]);
        if ($existente = $stmt->fetch()) {
            if ((int) $existente['usuario_id'] !== $usuarioId) {
                throw new ErroValidacao('Identificador do registro offline inválido.');
            }
            return (int) $existente['id'];
        }
    }

    $area = $num('area_aplicada_ha', 9999999);
    if ($area !== null && $area > (float) $talhao['area_hectares'] + 0.001) {
        throw new ErroValidacao('A área aplicada passa da área do talhão.');
    }
    $custo = $num('custo', 999999999999);
    $produto = $txt('produto', 150);

    $dados = [
        ':talhao'      => $talhao['id'],
        ':safra'       => $safraId,
        ':tipo'        => $tipo,
        ':data'        => $data,
        ':produto'     => $produto,
        ':dosagem'     => $txt('dosagem', 50),
        ':area'        => $area,
        ':responsavel' => $txt('responsavel', 100),
        ':custo'       => $custo,
        ':obs'         => $txt('observacoes', 1000),
    ];

    $id = (int) ($d['id'] ?? 0);
    if ($id && !$offline) {
        $stmt = $pdo->prepare(
            'SELECT o.id FROM operacoes_diario o JOIN talhoes t ON t.id = o.talhao_id JOIN fazendas f ON f.id = t.fazenda_id
              WHERE o.id = :id AND f.usuario_id = :usuario'
        );
        $stmt->execute([':id' => $id, ':usuario' => $usuarioId]);
        if (!$stmt->fetchColumn()) {
            throw new ErroValidacao('Operação não encontrada.', 404);
        }
        $pdo->prepare(
            'UPDATE operacoes_diario SET talhao_id = :talhao, safra_id = :safra, tipo_operacao = :tipo, data_operacao = :data,
                    produto_insumo = :produto, dosagem = :dosagem, area_aplicada_ha = :area, responsavel = :responsavel,
                    custo = :custo, observacoes = :obs
              WHERE id = :id'
        )->execute($dados + [':id' => $id]);
    } else {
        $pdo->prepare(
            "INSERT INTO operacoes_diario (talhao_id, safra_id, tipo_operacao, data_operacao, produto_insumo, dosagem,
                    area_aplicada_ha, responsavel, custo, observacoes, uuid_cliente, registrado_offline, sync_status)
             VALUES (:talhao, :safra, :tipo, :data, :produto, :dosagem, :area, :responsavel, :custo, :obs, :uuid, :offline, 'sincronizado')"
        )->execute($dados + [':uuid' => $uuid, ':offline' => $offline ? 1 : 0]);
        $id = (int) $pdo->lastInsertId();
    }

    // Despesa automática ligada à operação (recriada a cada edição).
    $pdo->prepare('DELETE FROM transacoes_financeiras WHERE operacao_id = :id')->execute([':id' => $id]);
    if ($custo !== null && $custo > 0) {
        $pdo->prepare(
            "INSERT INTO transacoes_financeiras (fazenda_id, safra_id, talhao_id, tipo, categoria, descricao, valor,
                    data_competencia, operacao_id)
             VALUES (:fazenda, :safra, :talhao, 'despesa', :categoria, :descricao, :valor, :data, :operacao)"
        )->execute([
            ':fazenda'   => $talhao['fazenda_id'],
            ':safra'     => $safraId,
            ':talhao'    => $talhao['id'],
            ':categoria' => CATEGORIA_POR_OPERACAO[$tipo],
            ':descricao' => mb_substr(NOMES_OPERACAO[$tipo] . ($produto ? ' — ' . $produto : '') . ' (diário de campo)', 0, 255),
            ':valor'     => round($custo, 2),
            ':data'      => $data,
            ':operacao'  => $id,
        ]);
    }

    return $id;
}
