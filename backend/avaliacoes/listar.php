<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// GET ?usuario_id=N (padrão: o próprio usuário): reputação e avaliações recebidas.
exigir_metodo('GET');
$usuarioId = exigir_sessao();

$alvo = filter_var($_GET['usuario_id'] ?? $usuarioId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) ?: $usuarioId;

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare('SELECT id, nome, cidade, tipo_acesso FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $alvo]);
    $usuario = $stmt->fetch();
    if (!$usuario) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Usuário não encontrado.']);
    }

    $stmt = $pdo->prepare('SELECT nota, COUNT(*) AS total FROM avaliacoes WHERE avaliado_id = :id GROUP BY nota');
    $stmt->execute([':id' => $alvo]);
    $distribuicao = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0];
    $soma = 0; $total = 0;
    foreach ($stmt->fetchAll() as $l) {
        $distribuicao[(int) $l['nota']] = (int) $l['total'];
        $soma += (int) $l['nota'] * (int) $l['total'];
        $total += (int) $l['total'];
    }

    $stmt = $pdo->prepare(
        'SELECT av.nota, av.comentario, av.data_criacao AS data_avaliacao, h.pedido_id, u.nome AS avaliador
           FROM avaliacoes av JOIN usuarios u ON u.id = av.avaliador_id LEFT JOIN historico_transacoes h ON h.id = av.transacao_id
          WHERE av.avaliado_id = :id ORDER BY av.data_criacao DESC, av.id DESC LIMIT 50'
    );
    $stmt->execute([':id' => $alvo]);

    responder(200, [
        'sucesso'      => true,
        'usuario'      => ['id' => (int) $usuario['id'], 'nome' => $usuario['nome'], 'cidade' => $usuario['cidade'], 'tipo' => $usuario['tipo_acesso']],
        'nota'         => $total ? round($soma / $total, 1) : null,
        'total'        => $total,
        'distribuicao' => $distribuicao,
        'avaliacoes'   => $stmt->fetchAll(),
    ]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_AVALIACOES_LISTAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar as avaliações.']);
}
