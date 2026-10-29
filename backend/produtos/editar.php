<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// POST multipart: id, nome, categoria, preco, estoque, descricao, imagem (opcional: substitui a atual)
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$produtoId = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

if ($produtoId === false) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Produto inválido.']);
}

$dados = validar_dados_produto();
$imagem = validar_imagem_produto();
$caminhoImagem = null;
$fotosAntigas = [];

try {
    require_once __DIR__ . '/../config/conexao.php';

    // Só o dono do anúncio pode alterá-lo.
    $stmt = $pdo->prepare("SELECT id FROM anuncios WHERE id = :id AND vendedor_id = :usuario AND status <> 'inativo'");
    $stmt->execute([':id' => $produtoId, ':usuario' => $usuarioId]);

    if (!$stmt->fetchColumn()) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Produto não encontrado.']);
    }

    $pdo->beginTransaction();

    $pdo->prepare(
        'UPDATE anuncios
            SET titulo = :titulo, descricao = :descricao, categoria = :categoria,
                preco = :preco, quantidade_estoque = :estoque
          WHERE id = :id AND vendedor_id = :usuario'
    )->execute([
        ':titulo'    => $dados['titulo'],
        ':descricao' => $dados['descricao'],
        ':categoria' => $dados['categoria'],
        ':preco'     => $dados['preco'],
        ':estoque'   => $dados['estoque'],
        ':id'        => $produtoId,
        ':usuario'   => $usuarioId,
    ]);

    if ($imagem !== null) {
        $stmt = $pdo->prepare('SELECT url_imagem FROM anuncios_fotos WHERE anuncio_id = :id');
        $stmt->execute([':id' => $produtoId]);
        $fotosAntigas = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $pdo->prepare('DELETE FROM anuncios_fotos WHERE anuncio_id = :id')->execute([':id' => $produtoId]);

        $caminhoImagem = mover_imagem_produto($imagem);
        $pdo->prepare('INSERT INTO anuncios_fotos (anuncio_id, url_imagem, ordem) VALUES (:id, :url, 1)')
            ->execute([':id' => $produtoId, ':url' => $caminhoImagem]);
    }

    $pdo->commit();

    foreach ($fotosAntigas as $foto) {
        remover_arquivo_produto($foto);
    }

    responder(200, [
        'sucesso'  => true,
        'mensagem' => 'Produto atualizado com sucesso!',
        'produto'  => buscar_produto($pdo, $produtoId),
    ]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($caminhoImagem !== null) {
        remover_arquivo_produto($caminhoImagem);
    }

    error_log('[MARKETPLACE_PRODUTOS_EDITAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível atualizar o produto.']);
}
