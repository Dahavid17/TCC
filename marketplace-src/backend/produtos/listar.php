<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// GET ?escopo=meus (padrão) | catalogo  [&categoria=...] [&busca=...]
exigir_metodo('GET');
$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    $escopo = $_GET['escopo'] ?? 'meus';
    $categoria = $_GET['categoria'] ?? '';
    $busca = trim((string) ($_GET['busca'] ?? ''));

    if ($escopo === 'catalogo') {
        $where = ["a.status = 'ativo'"];
        $params = [];
    } else {
        $where = ['a.vendedor_id = :usuario', "a.status <> 'inativo'"];
        $params = [':usuario' => $usuarioId];
    }

    if ($categoria !== '') {
        if (!in_array($categoria, CATEGORIAS_PRODUTO, true)) {
            responder(422, ['sucesso' => false, 'mensagem' => 'Categoria inválida.']);
        }
        $where[] = 'a.categoria = :categoria';
        $params[':categoria'] = $categoria;
    }

    if ($busca !== '') {
        $where[] = 'a.titulo LIKE :busca';
        $params[':busca'] = '%' . $busca . '%';
    }

    $stmt = $pdo->prepare(
        SQL_PRODUTO . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY a.data_criacao DESC, a.id DESC'
    );
    $stmt->execute($params);

    responder(200, [
        'sucesso'  => true,
        'produtos' => array_map('normalizar_produto', $stmt->fetchAll()),
    ]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_PRODUTOS_LISTAR] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar os produtos.']);
}
