<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// GET: estoque dos produtos do usuário.
// POST: id, quantidade — define a nova quantidade em estoque de um produto do usuário.
// Usa a mesma coluna (anuncios.quantidade_estoque) de Meus Produtos e Início.
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    responder(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

$usuarioId = exigir_sessao();

const SQL_ESTOQUE = "SELECT id, titulo AS nome, categoria, quantidade_estoque AS estoque, data_atualizacao
    FROM anuncios";

function normalizar_estoque(array $l): array
{
    return [
        'id'         => (int) $l['id'],
        'nome'       => $l['nome'],
        'categoria'  => $l['categoria'],
        'estoque'    => (int) $l['estoque'],
        'atualizado' => $l['data_atualizacao'] ? substr((string) $l['data_atualizacao'], 0, 10) : null,
    ];
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare(SQL_ESTOQUE . " WHERE vendedor_id = :usuario AND status <> 'inativo' ORDER BY titulo");
        $stmt->execute([':usuario' => $usuarioId]);

        responder(200, ['sucesso' => true, 'itens' => array_map('normalizar_estoque', $stmt->fetchAll())]);
    }

    $produtoId  = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $quantidade = filter_var($_POST['quantidade'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 1000000000]]);

    if ($produtoId === false || $quantidade === false) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Informe uma quantidade válida (número inteiro, zero ou mais).']);
    }

    $stmt = $pdo->prepare("UPDATE anuncios SET quantidade_estoque = :qtd WHERE id = :id AND vendedor_id = :usuario AND status <> 'inativo'");
    $stmt->execute([':qtd' => $quantidade, ':id' => $produtoId, ':usuario' => $usuarioId]);

    // rowCount() é 0 quando o valor não muda; por isso confirma a existência separadamente.
    $stmt = $pdo->prepare(SQL_ESTOQUE . " WHERE id = :id AND vendedor_id = :usuario AND status <> 'inativo'");
    $stmt->execute([':id' => $produtoId, ':usuario' => $usuarioId]);
    $linha = $stmt->fetch();

    if (!$linha) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Produto não encontrado.']);
    }

    responder(200, ['sucesso' => true, 'mensagem' => 'Estoque atualizado.', 'item' => normalizar_estoque($linha)]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_ESTOQUE] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível processar o estoque.']);
}
