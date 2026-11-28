<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';

// Propriedades rurais do produtor.
//   GET                       -> lista com talhões, área mapeada e safras ativas
//   POST acao=salvar          -> cria (sem id) ou edita (com id): nome, localizacao, area_total,
//                                cadastro_estadual, latitude, longitude
//   POST acao=excluir&id=N    -> exclui (apaga talhões, safras e registros ligados a ela)
try {
    [$pdo, $usuarioId] = inicio_gestao();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare(
            "SELECT f.id, f.nome, f.localizacao, f.area_total, f.cadastro_estadual, f.latitude, f.longitude,
                    (SELECT COUNT(*) FROM talhoes t WHERE t.fazenda_id = f.id AND t.ativo = 1) AS talhoes,
                    (SELECT COALESCE(SUM(t.area_hectares), 0) FROM talhoes t WHERE t.fazenda_id = f.id AND t.ativo = 1) AS area_talhoes,
                    (SELECT COUNT(*) FROM safras s WHERE s.fazenda_id = f.id AND s.status = 'em_andamento') AS safras_ativas
               FROM fazendas f
              WHERE f.usuario_id = :usuario
              ORDER BY f.nome"
        );
        $stmt->execute([':usuario' => $usuarioId]);

        responder(200, ['sucesso' => true, 'fazendas' => array_map(fn(array $f): array => [
            'id'                => (int) $f['id'],
            'nome'              => $f['nome'],
            'localizacao'       => $f['localizacao'],
            'area_total'        => f2($f['area_total']),
            'cadastro_estadual' => $f['cadastro_estadual'],
            'latitude'          => $f['latitude'] === null ? null : (float) $f['latitude'],
            'longitude'         => $f['longitude'] === null ? null : (float) $f['longitude'],
            'talhoes'           => (int) $f['talhoes'],
            'area_talhoes'      => f2($f['area_talhoes']),
            'safras_ativas'     => (int) $f['safras_ativas'],
        ], $stmt->fetchAll())]);
    }

    exigir_metodo('POST');
    $d = entrada();
    $acao = (string) ($d['acao'] ?? '');

    if ($acao === 'excluir') {
        $id = inteiro_id($d, 'id', true);
        exigir_fazenda($pdo, $usuarioId, $id);

        $pdo->beginTransaction();
        // Tabelas antigas sem ON DELETE CASCADE para fazendas: limpa antes.
        $pdo->prepare('DELETE l FROM leituras_iot l JOIN sensores_iot s ON s.id = l.sensor_id WHERE s.fazenda_id = :id')->execute([':id' => $id]);
        $pdo->prepare('DELETE FROM sensores_iot WHERE fazenda_id = :id')->execute([':id' => $id]);
        $pdo->prepare('DELETE FROM dispositivos_iot WHERE fazenda_id = :id AND usuario_id = :usuario')->execute([':id' => $id, ':usuario' => $usuarioId]);
        $pdo->prepare('DELETE FROM fazendas WHERE id = :id AND usuario_id = :usuario')->execute([':id' => $id, ':usuario' => $usuarioId]);
        $pdo->commit();

        responder(200, ['sucesso' => true, 'mensagem' => 'Propriedade excluída.']);
    }

    if ($acao !== 'salvar') {
        falha('Ação inválida.');
    }

    $id = inteiro_id($d, 'id');
    $dados = [
        ':nome'        => texto($d, 'nome', 150, true, 'nome da propriedade'),
        ':localizacao' => texto($d, 'localizacao', 255, false, 'localização'),
        ':area'        => decimal($d, 'area_total', 0.01, 99999999, true, 'a área total (ha)'),
        ':ie'          => texto($d, 'cadastro_estadual', 50, false, 'inscrição/CAR'),
        ':lat'         => decimal($d, 'latitude', -90, 90, false, 'latitude'),
        ':lng'         => decimal($d, 'longitude', -180, 180, false, 'longitude'),
        ':usuario'     => $usuarioId,
    ];

    if ($id) {
        exigir_fazenda($pdo, $usuarioId, $id);
        $pdo->prepare(
            'UPDATE fazendas SET nome = :nome, localizacao = :localizacao, area_total = :area,
                    cadastro_estadual = :ie, latitude = :lat, longitude = :lng
              WHERE id = :id AND usuario_id = :usuario'
        )->execute($dados + [':id' => $id]);
    } else {
        $pdo->prepare(
            'INSERT INTO fazendas (usuario_id, nome, localizacao, area_total, cadastro_estadual, latitude, longitude)
             VALUES (:usuario, :nome, :localizacao, :area, :ie, :lat, :lng)'
        )->execute($dados);
        $id = (int) $pdo->lastInsertId();
    }

    responder(200, ['sucesso' => true, 'mensagem' => 'Propriedade salva.', 'id' => $id]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[MARKETPLACE_GESTAO_FAZENDAS] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível processar a propriedade.']);
}
