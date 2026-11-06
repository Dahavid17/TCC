<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// POST: acao = adicionar | remover (com anuncio_id) | limpar.
// Sempre atua sobre os favoritos do usuário da sessão, nunca de outra conta.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$acao = (string) ($_POST['acao'] ?? '');

if (!in_array($acao, ['adicionar', 'remover', 'limpar'], true)) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Ação inválida.']);
}

$anuncioId = filter_var($_POST['anuncio_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

if ($acao !== 'limpar' && $anuncioId === false) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Produto inválido.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    if ($acao === 'limpar') {
        $pdo->prepare('DELETE FROM favoritos WHERE usuario_id = :usuario')
            ->execute([':usuario' => $usuarioId]);

        responder(200, ['sucesso' => true, 'mensagem' => 'Favoritos removidos.']);
    }

    if ($acao === 'remover') {
        $pdo->prepare('DELETE FROM favoritos WHERE usuario_id = :usuario AND anuncio_id = :anuncio')
            ->execute([':usuario' => $usuarioId, ':anuncio' => $anuncioId]);

        responder(200, ['sucesso' => true, 'mensagem' => 'Favorito removido.']);
    }

    $stmt = $pdo->prepare("SELECT id FROM anuncios WHERE id = :id AND status <> 'inativo'");
    $stmt->execute([':id' => $anuncioId]);

    if (!$stmt->fetchColumn()) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Produto não encontrado.']);
    }

    // A chave primária (usuario_id, anuncio_id) impede duplicados; INSERT IGNORE torna a chamada idempotente.
    $pdo->prepare('INSERT IGNORE INTO favoritos (usuario_id, anuncio_id) VALUES (:usuario, :anuncio)')
        ->execute([':usuario' => $usuarioId, ':anuncio' => $anuncioId]);

    responder(200, ['sucesso' => true, 'mensagem' => 'Produto adicionado aos favoritos.']);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_FAVORITOS_ATUALIZAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível atualizar os favoritos.']);
}
