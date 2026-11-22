<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/notificacoes.php';

// POST id=<n>      -> marca uma notificação como lida
// POST todas=1     -> marca todas como lidas
// Só mexe nas notificações do próprio usuário.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$id = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$todas = !empty($_POST['todas']);

if (!$todas && $id === false) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Notificação inválida.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    garantir_tabela_notificacoes($pdo);

    if ($todas) {
        $pdo->prepare('UPDATE notificacoes SET lida = 1 WHERE usuario_id = :usuario AND lida = 0')
            ->execute([':usuario' => $usuarioId]);
    } else {
        $pdo->prepare('UPDATE notificacoes SET lida = 1 WHERE id = :id AND usuario_id = :usuario')
            ->execute([':id' => $id, ':usuario' => $usuarioId]);
    }

    responder(200, ['sucesso' => true]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_NOTIFICACOES_MARCAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível atualizar as notificações.']);
}
