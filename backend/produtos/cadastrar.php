<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/lembretes.php';

// POST multipart: nome, categoria, preco, preco_promocional (opcional), estoque, descricao,
//                 cultura (opcional), imagem (opcional, foto principal), imagens[] (opcional, galeria)
// Depois de gravar: atualiza a cotação do produto e dispara os alertas de preço.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$dados = validar_dados_produto();
$imagem = validar_imagem_produto();
$cultura = validar_cultura_produto();
$extras = validar_imagens_produto(MAX_FOTOS_PRODUTO - ($imagem ? 1 : 0));
$caminhoImagem = null;
$caminhosExtras = [];

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare('SELECT COALESCE(NULLIF(cidade, \'\'), endereco) FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);
    $localizacao = $stmt->fetchColumn() ?: null;

    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        'INSERT INTO anuncios (vendedor_id, titulo, descricao, categoria, cultura, preco, preco_promocional, quantidade_estoque, localizacao, status)
         VALUES (:vendedor, :titulo, :descricao, :categoria, :cultura, :preco, :promo, :estoque, :localizacao, \'ativo\')'
    );
    $stmt->execute([
        ':vendedor'    => $usuarioId,
        ':titulo'      => $dados['titulo'],
        ':descricao'   => $dados['descricao'],
        ':categoria'   => $dados['categoria'],
        ':cultura'     => $cultura,
        ':preco'       => $dados['preco'],
        ':promo'       => $dados['preco_promocional'],
        ':estoque'     => $dados['estoque'],
        ':localizacao' => $localizacao,
    ]);
    $produtoId = (int) $pdo->lastInsertId();

    if ($imagem !== null) {
        $caminhoImagem = mover_imagem_produto($imagem);
        $pdo->prepare('INSERT INTO anuncios_fotos (anuncio_id, url_imagem, ordem) VALUES (:id, :url, 1)')
            ->execute([':id' => $produtoId, ':url' => $caminhoImagem]);
    }

    // Galeria: fotos extras depois da principal.
    $ordem = $imagem !== null ? 2 : 1;
    foreach ($extras as $extra) {
        $caminho = mover_imagem_produto($extra);
        $caminhosExtras[] = $caminho;
        $pdo->prepare('INSERT INTO anuncios_fotos (anuncio_id, url_imagem, ordem) VALUES (:id, :url, :ordem)')
            ->execute([':id' => $produtoId, ':url' => $caminho, ':ordem' => $ordem++]);
    }

    $pdo->commit();

    // Cotação e alertas nunca desfazem o cadastro.
    try {
        registrar_preco($pdo, $produtoId, null, preco_efetivo($dados));
    } catch (Throwable $e) {
        error_log('[MARKETPLACE_PRODUTOS_PRECO] ' . $e->getMessage());
    }

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
    foreach ($caminhosExtras as $caminho) {
        remover_arquivo_produto($caminho);
    }

    error_log('[MARKETPLACE_PRODUTOS_CADASTRAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível cadastrar o produto.']);
}
