<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/lembretes.php';

// POST multipart: id, nome, categoria, preco, preco_promocional (opcional), estoque, descricao,
//                 cultura (opcional; sem o campo, a cultura atual é mantida),
//                 imagem (opcional: substitui TODAS as fotos atuais pela nova)
// Fotos da galeria uma a uma: produtos/fotos.php.
// Mudança no preço cobrado atualiza a cotação e dispara os alertas de preço dos compradores.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$produtoId = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

if ($produtoId === false) {
    responder(422, ['sucesso' => false, 'mensagem' => 'Produto inválido.']);
}

$dados = validar_dados_produto();
$imagem = validar_imagem_produto();
$cultura = validar_cultura_produto();
$caminhoImagem = null;
$fotosAntigas = [];

try {
    require_once __DIR__ . '/../config/conexao.php';

    // Só o dono do anúncio pode alterá-lo.
    $stmt = $pdo->prepare(
        "SELECT " . SQL_PRECO_VENDA . " AS preco_atual FROM anuncios a
          WHERE a.id = :id AND a.vendedor_id = :usuario AND a.status <> 'inativo'"
    );
    $stmt->execute([':id' => $produtoId, ':usuario' => $usuarioId]);
    $precoAntigo = $stmt->fetchColumn();

    if ($precoAntigo === false) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Produto não encontrado.']);
    }

    $pdo->beginTransaction();

    $pdo->prepare(
        'UPDATE anuncios
            SET titulo = :titulo, descricao = :descricao, categoria = :categoria,
                cultura = IF(:mudar_cultura = 1, :cultura, cultura),
                preco = :preco, preco_promocional = :promo, quantidade_estoque = :estoque
          WHERE id = :id AND vendedor_id = :usuario'
    )->execute([
        ':titulo'        => $dados['titulo'],
        ':descricao'     => $dados['descricao'],
        ':categoria'     => $dados['categoria'],
        ':mudar_cultura' => array_key_exists('cultura', $_POST) ? 1 : 0,
        ':cultura'       => $cultura,
        ':preco'         => $dados['preco'],
        ':promo'         => $dados['preco_promocional'],
        ':estoque'       => $dados['estoque'],
        ':id'            => $produtoId,
        ':usuario'       => $usuarioId,
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

    // Cotação e alertas nunca desfazem a edição.
    try {
        registrar_preco($pdo, $produtoId, (float) $precoAntigo, preco_efetivo($dados));
    } catch (Throwable $e) {
        error_log('[MARKETPLACE_PRODUTOS_PRECO] ' . $e->getMessage());
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
