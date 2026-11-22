<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/notificacoes.php';

// GET              -> { sucesso, nao_lidas, notificacoes: [{ id, tipo, titulo, mensagem, link, lida, segundos }] }
// GET ?contar=1    -> { sucesso, nao_lidas }   (consulta leve, usada pelo sino a cada 30 s)
exigir_metodo('GET');
$usuarioId = exigir_sessao();
session_write_close(); // não segura a sessão enquanto consulta

try {
    require_once __DIR__ . '/../config/conexao.php';

    garantir_tabela_notificacoes($pdo);

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM notificacoes WHERE usuario_id = :id AND lida = 0');
    $stmt->execute([':id' => $usuarioId]);
    $naoLidas = (int) $stmt->fetchColumn();

    if (!empty($_GET['contar'])) {
        responder(200, ['sucesso' => true, 'nao_lidas' => $naoLidas]);
    }

    $stmt = $pdo->prepare(
        'SELECT id, tipo, titulo, mensagem, link, lida,
                GREATEST(0, TIMESTAMPDIFF(SECOND, criada_em, NOW())) AS segundos
           FROM notificacoes
          WHERE usuario_id = :id
          ORDER BY id DESC
          LIMIT 20'
    );
    $stmt->execute([':id' => $usuarioId]);

    $notificacoes = array_map(fn(array $n): array => [
        'id'       => (int) $n['id'],
        'tipo'     => $n['tipo'],
        'titulo'   => $n['titulo'],
        'mensagem' => $n['mensagem'],
        'link'     => $n['link'],
        'lida'     => (bool) $n['lida'],
        'segundos' => (int) $n['segundos'],
    ], $stmt->fetchAll());

    responder(200, ['sucesso' => true, 'nao_lidas' => $naoLidas, 'notificacoes' => $notificacoes]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_NOTIFICACOES_LISTAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar as notificações.']);
}
