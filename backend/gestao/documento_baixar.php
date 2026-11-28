<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';

// GET ?id=N[&inline=1]: entrega o arquivo de um documento SOMENTE ao dono da propriedade.
exigir_metodo('GET');

try {
    [$pdo, $usuarioId] = inicio_gestao('documentos');

    $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $stmt = $pdo->prepare(
        'SELECT d.url_arquivo, d.nome_original, d.mime FROM documentos d JOIN fazendas f ON f.id = d.fazenda_id
          WHERE d.id = :id AND f.usuario_id = :usuario'
    );
    $stmt->execute([':id' => (int) $id, ':usuario' => $usuarioId]);
    $doc = $stmt->fetch();

    $arquivo = $doc ? (string) $doc['url_arquivo'] : '';
    $caminho = dirname(__DIR__, 2) . '/uploads/documentos/' . $arquivo;
    if (!$doc || preg_match('/^[a-f0-9]{32}\.[a-z]{2,4}$/', $arquivo) !== 1 || !is_file($caminho)) {
        falha('Documento não encontrado.', 404);
    }

    $mime = $doc['mime'] ?: 'application/octet-stream';
    // Só PDF e imagens abrem no navegador; o resto sempre baixa.
    $inline = !empty($_GET['inline']) && preg_match('#^(application/pdf|image/(jpeg|png|webp))$#', $mime) === 1;
    $nome = str_replace(['"', "\r", "\n", '\\'], '', (string) ($doc['nome_original'] ?: $arquivo));

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($caminho));
    header('X-Content-Type-Options: nosniff');
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . $nome . '"; filename*=UTF-8\'\'' . rawurlencode($nome));
    readfile($caminho);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_GESTAO_DOC_BAIXAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível abrir o documento.']);
}
