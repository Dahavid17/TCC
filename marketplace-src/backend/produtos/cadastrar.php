<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// POST multipart: nome, categoria, preco, estoque, descricao, imagem (opcional)
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$dados = validar_dados_produto();
$imagem = validar_imagem_produto();
$caminhoImagem = null;

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare('SELECT COALESCE(NULLIF(cidade, \'\'), endereco) FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);
    $localizacao = $stmt->fetchColumn() ?: null;

    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        'INSERT INTO anuncios (vendedor_id, titulo, descricao, categoria, preco, quantidade_estoque, localizacao, status)
         VALUES (:vendedor, :titulo, :descricao, :categoria, :preco, :estoque, :localizacao, \'ativo\')'
    );
    $stmt->execute([
        ':vendedor'    => $usuarioId,
        ':titulo'      => $dados['titulo'],
        ':descricao'   => $dados['descricao'],
        ':categoria'   => $dados['categoria'],
        ':preco'       => $dados['preco'],
        ':estoque'     => $dados['estoque'],
        ':localizacao' => $localizacao,
    ]);
    $produtoId = (int) $pdo->lastInsertId();

    if ($imagem !== null) {
        $caminhoImagem = mover_imagem_produto($imagem);
        $pdo->prepare('INSERT INTO anuncios_fotos (anuncio_id, url_imagem, ordem) VALUES (:id, :url, 1)')
            ->execute([':id' => $produtoId, ':url' => $caminhoImagem]);
    }

    $pdo->commit();

    responder(201, [
        'sucesso'  => true,
        'mensagem' => 'Produto cadastrado com sucesso!',
        'produto'  => buscar_produto($pdo, $produtoId),
    ]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($caminhoImagem !== null) {
        remover_arquivo_produto($caminhoImagem);
    }

    error_log('[MARKETPLACE_PRODUTOS_CADASTRAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível cadastrar o produto.']);
}
