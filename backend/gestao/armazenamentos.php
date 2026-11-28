<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';
require_once __DIR__ . '/../lib/armazenamento.php';

// Monitoramento volumétrico e de peso de silos, bags e reservatórios.
//   GET [?fazenda_id]          -> armazenamentos com a última leitura e o histórico recente
//   POST acao=salvar           id?, fazenda_id, codigo, nome, tipo, produto, capacidade, unidade_capacidade,
//                              altura_util_cm, dispositivo_codigo?, alerta_minimo_pct, alerta_maximo_pct
//   POST acao=leitura          id, distancia_cm?, peso_kg?, temperatura?, umidade_graos?  (leitura manual)
//   POST acao=simular&id=N     gera uma leitura de demonstração (sem ESP32)
//   POST acao=excluir&id=N
// Leituras do ESP32: backend/iot/armazenamento_receber.php (autenticado pelo token da placa).
try {
    [$pdo, $usuarioId] = inicio_gestao('silos');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $where = 'f.usuario_id = :usuario';
        $params = [':usuario' => $usuarioId];
        if ($fazendaId = filtro_fazenda($pdo, $usuarioId)) {
            $where .= ' AND a.fazenda_id = :fazenda';
            $params[':fazenda'] = $fazendaId;
        }
        $stmt = $pdo->prepare("SELECT a.*, f.nome AS fazenda_nome FROM armazenamentos a JOIN fazendas f ON f.id = a.fazenda_id WHERE $where ORDER BY f.nome, a.nome");
        $stmt->execute($params);
        $lista = $stmt->fetchAll();

        $historico = $pdo->prepare(
            'SELECT nivel_pct, volume, peso_kg, temperatura, umidade_graos, origem, data_hora,
                    TIMESTAMPDIFF(SECOND, data_hora, NOW()) AS segundos
               FROM leituras_armazenamento WHERE armazenamento_id = :id ORDER BY data_hora DESC, id DESC LIMIT 30'
        );
        foreach ($lista as &$a) {
            $historico->execute([':id' => $a['id']]);
            $leituras = $historico->fetchAll();
            $a['ultima'] = $leituras[0] ?? null;
            $a['historico'] = array_reverse(array_map(fn($l) => $l['nivel_pct'] === null ? null : (float) $l['nivel_pct'], $leituras));
            $a['capacidade'] = f2($a['capacidade']);
        }
        unset($a);

        responder(200, ['sucesso' => true, 'armazenamentos' => $lista]);
    }

    exigir_metodo('POST');
    $d = entrada();
    $acao = (string) ($d['acao'] ?? '');

    $buscar = function (?int $id) use ($pdo, $usuarioId): array {
        $stmt = $pdo->prepare('SELECT a.* FROM armazenamentos a JOIN fazendas f ON f.id = a.fazenda_id WHERE a.id = :id AND f.usuario_id = :usuario');
        $stmt->execute([':id' => (int) $id, ':usuario' => $usuarioId]);
        $arm = $stmt->fetch();
        if (!$arm) {
            falha('Armazenamento não encontrado.', 404);
        }
        return $arm;
    };

    switch ($acao) {
        case 'excluir':
            $arm = $buscar(inteiro_id($d, 'id', true));
            $pdo->prepare('DELETE FROM armazenamentos WHERE id = :id')->execute([':id' => $arm['id']]);
            responder(200, ['sucesso' => true, 'mensagem' => 'Armazenamento excluído.']);

        case 'leitura':
            $arm = $buscar(inteiro_id($d, 'id', true));
            $leitura = gravar_leitura_armazenamento($pdo, $arm, $d, 'manual');
            responder(201, ['sucesso' => true, 'mensagem' => 'Leitura registrada.', 'leitura' => $leitura]);

        case 'simular':
            // Demonstração: parte da última leitura e varia um pouco (carga/descarga).
            $arm = $buscar(inteiro_id($d, 'id', true));
            $stmt = $pdo->prepare('SELECT nivel_pct FROM leituras_armazenamento WHERE armazenamento_id = :id AND nivel_pct IS NOT NULL ORDER BY data_hora DESC, id DESC LIMIT 1');
            $stmt->execute([':id' => $arm['id']]);
            $nivel = (float) ($stmt->fetchColumn() ?: random_int(35, 80));
            $nivel = max(3, min(99, $nivel + random_int(-60, 40) / 10));
            $dados = ['temperatura' => round(18 + random_int(0, 120) / 10, 1), 'umidade_graos' => round(11 + random_int(0, 40) / 10, 1)];
            if ((float) $arm['altura_util_cm'] > 0) {
                $dados['distancia_cm'] = round((float) $arm['altura_util_cm'] * (1 - $nivel / 100), 1);
            } else {
                $mult = $arm['unidade_capacidade'] === 'saca' ? 60 : 1000;
                $dados['peso_kg'] = round((float) $arm['capacidade'] * $nivel / 100 * $mult, 1);
            }
            $leitura = gravar_leitura_armazenamento($pdo, $arm, $dados, 'simulacao');
            responder(201, ['sucesso' => true, 'mensagem' => 'Leitura simulada registrada.', 'leitura' => $leitura]);

        case 'salvar':
            $id = inteiro_id($d, 'id');
            $fazenda = exigir_fazenda($pdo, $usuarioId, inteiro_id($d, 'fazenda_id', true));
            $codigo = strtoupper(texto($d, 'codigo', 40, true, 'código'));
            if (preg_match('/^[A-Z0-9][A-Z0-9_-]{1,39}$/', $codigo) !== 1) {
                falha('Código inválido: use letras, números, "-" ou "_" (ex.: SILO-01).');
            }
            $dispositivo = texto($d, 'dispositivo_codigo', 40);
            if ($dispositivo !== null) {
                $dispositivo = strtoupper($dispositivo);
                $stmt = $pdo->prepare('SELECT id FROM dispositivos_iot WHERE codigo = :codigo AND usuario_id = :usuario');
                $stmt->execute([':codigo' => $dispositivo, ':usuario' => $usuarioId]);
                if (!$stmt->fetchColumn()) {
                    falha('Placa ESP32 não encontrada. Conecte a placa em Gestão da Fazenda antes de vinculá-la.');
                }
            }
            $min = decimal($d, 'alerta_minimo_pct', 0, 100, false, 'o alerta mínimo') ?? 15;
            $max = decimal($d, 'alerta_maximo_pct', 0, 100, false, 'o alerta máximo') ?? 95;
            if ($min >= $max) {
                falha('O alerta mínimo precisa ser menor que o máximo.');
            }
            $dados = [
                ':fazenda'  => $fazenda['id'],
                ':codigo'   => $codigo,
                ':nome'     => texto($d, 'nome', 100, true, 'nome'),
                ':tipo'     => opcao($d, 'tipo', ['silo', 'bag', 'reservatorio', 'graneleiro'], 'silo', 'tipo'),
                ':produto'  => texto($d, 'produto', 60),
                ':cap'      => decimal($d, 'capacidade', 0.01, 999999999, true, 'a capacidade'),
                ':unidade'  => opcao($d, 'unidade_capacidade', ['tonelada', 'm3', 'litro', 'saca'], 'tonelada', 'unidade'),
                ':altura'   => decimal($d, 'altura_util_cm', 1, 10000, false, 'a altura útil (cm)'),
                ':disp'     => $dispositivo,
                ':min'      => $min,
                ':max'      => $max,
            ];
            $stmt = $pdo->prepare('SELECT a.id FROM armazenamentos a JOIN fazendas f ON f.id = a.fazenda_id WHERE f.usuario_id = :usuario AND a.codigo = :codigo AND a.id <> :id');
            $stmt->execute([':usuario' => $usuarioId, ':codigo' => $codigo, ':id' => (int) $id]);
            if ($stmt->fetchColumn()) {
                falha('Você já tem um armazenamento com este código.');
            }
            if ($id) {
                $buscar($id);
                $pdo->prepare(
                    'UPDATE armazenamentos SET fazenda_id = :fazenda, codigo = :codigo, nome = :nome, tipo = :tipo, produto = :produto,
                            capacidade = :cap, unidade_capacidade = :unidade, altura_util_cm = :altura, dispositivo_codigo = :disp,
                            alerta_minimo_pct = :min, alerta_maximo_pct = :max
                      WHERE id = :id'
                )->execute($dados + [':id' => $id]);
            } else {
                $pdo->prepare(
                    'INSERT INTO armazenamentos (fazenda_id, codigo, nome, tipo, produto, capacidade, unidade_capacidade,
                            altura_util_cm, dispositivo_codigo, alerta_minimo_pct, alerta_maximo_pct)
                     VALUES (:fazenda, :codigo, :nome, :tipo, :produto, :cap, :unidade, :altura, :disp, :min, :max)'
                )->execute($dados);
                $id = (int) $pdo->lastInsertId();
            }
            responder(200, ['sucesso' => true, 'mensagem' => 'Armazenamento salvo.', 'id' => $id]);
    }

    falha('Ação inválida.');
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_GESTAO_ARMAZENAMENTOS] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível processar o armazenamento.']);
}
