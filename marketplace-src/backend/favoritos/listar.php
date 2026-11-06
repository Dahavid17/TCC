<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// GET: produtos favoritados pelo usuário autenticado (mais recentes primeiro).
// Produtos excluídos (status 'inativo') deixam de aparecer sem quebrar a listagem.
exigir_metodo('GET');
$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare(
        SQL_PRODUTO . " JOIN favoritos fav ON fav.anuncio_id = a.id
         WHERE fav.usuario_id = :usuario AND a.status <> 'inativo'
         ORDER BY fav.data_adicionado DESC, a.id DESC"
    );
    $stmt->execute([':usuario' => $usuarioId]);

    $produtos = array_map(function (array $linha): array {
        $produto = normalizar_produto($linha);
        $produto['disponivel'] = $produto['status'] === 'ativo' && $produto['estoque'] > 0;

        return $produto;
    }, $stmt->fetchAll());

    responder(200, ['sucesso' => true, 'produtos' => $produtos]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_FAVORITOS_LISTAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar os favoritos.']);
}
