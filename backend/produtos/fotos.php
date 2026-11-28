<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// Galeria de fotos do produto (só o dono do anúncio).
//   POST multipart acao=adicionar: id, imagens[] (até completar MAX_FOTOS_PRODUTO)
//   POST acao=remover: id, foto_id
//   POST acao=principal: id, foto_id   (a foto passa a ser a capa)
// Resposta: { sucesso, fotos: [{id, url, ordem}] }
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$produtoId = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$acao = (string) ($_POST['acao'] ?? '');

if ($produtoId === false || !in_array($acao, ['adicionar', 'remover', 'principal'], true)) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Requisição inválida.']);
}

$novos = [];

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare("SELECT id FROM anuncios WHERE id = :id AND vendedor_id = :usuario AND status <> 'inativo'");
    $stmt->execute([':id' => $produtoId, ':usuario' => $usuarioId]);
    if (!$stmt->fetchColumn()) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Produto não encontrado.']);
    }

    $listar = function () use ($pdo, $produtoId): array {
        $stmt = $pdo->prepare('SELECT id, url_imagem, ordem FROM anuncios_fotos WHERE anuncio_id = :id ORDER BY ordem, id');
        $stmt->execute([':id' => $produtoId]);
        return array_map(fn($f) => ['id' => (int) $f['id'], 'url' => $f['url_imagem'], 'ordem' => (int) $f['ordem']], $stmt->fetchAll());
    };
    $atuais = $listar();

    if ($acao === 'adicionar') {
        $imagens = validar_imagens_produto(MAX_FOTOS_PRODUTO - count($atuais));
        if (!$imagens) {
            responder(422, ['sucesso' => false, 'mensagem' => 'Escolha ao menos uma imagem.']);
        }
        $ordem = $atuais ? max(array_column($atuais, 'ordem')) + 1 : 1;
        $pdo->beginTransaction();
        foreach ($imagens as $imagem) {
            $caminho = mover_imagem_produto($imagem);
            $novos[] = $caminho;
            $pdo->prepare('INSERT INTO anuncios_fotos (anuncio_id, url_imagem, ordem) VALUES (:id, :url, :ordem)')
                ->execute([':id' => $produtoId, ':url' => $caminho, ':ordem' => $ordem++]);
        }
        $pdo->commit();
        responder(201, ['sucesso' => true, 'mensagem' => 'Fotos adicionadas.', 'fotos' => $listar()]);
    }

    $fotoId = filter_var($_POST['foto_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $foto = null;
    foreach ($atuais as $f) {
        if ($f['id'] === $fotoId) {
            $foto = $f;
        }
    }
    if (!$foto) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Foto não encontrada.']);
    }

    if ($acao === 'remover') {
        $pdo->prepare('DELETE FROM anuncios_fotos WHERE id = :foto AND anuncio_id = :id')->execute([':foto' => $fotoId, ':id' => $produtoId]);
        remover_arquivo_produto($foto['url']);
        responder(200, ['sucesso' => true, 'mensagem' => 'Foto removida.', 'fotos' => $listar()]);
    }

    // principal: a escolhida vai para a ordem 0 e as outras seguem na ordem atual.
    $pdo->beginTransaction();
    $ordem = 1;
    foreach ($atuais as $f) {
        $pdo->prepare('UPDATE anuncios_fotos SET ordem = :ordem WHERE id = :foto')
            ->execute([':ordem' => $f['id'] === $fotoId ? 0 : $ordem++, ':foto' => $f['id']]);
    }
    $pdo->commit();
    responder(200, ['sucesso' => true, 'mensagem' => 'Foto de capa definida.', 'fotos' => $listar()]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    foreach ($novos as $caminho) {
        remover_arquivo_produto($caminho);
    }
    error_log('[MARKETPLACE_PRODUTOS_FOTOS] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível atualizar as fotos.']);
}
