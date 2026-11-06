<?php
declare(strict_types=1);

// Regras das Negociações (tabela `chats`, uma linha por mensagem).
// Uma conversa é o par (anuncio_id, comprador_id); o vendedor é sempre o dono do anúncio.

const TAMANHO_MAX_MENSAGEM = 2000;

const SQL_MENSAGEM = 'SELECT id, remetente_id, tipo, mensagem, valor_proposta,
        UNIX_TIMESTAMP(data_hora) AS em
    FROM chats';

// Descobre a conversa pedida e o papel do usuário nela. Responde 4xx se ele não puder acessá-la.
function identificar_conversa(PDO $pdo, int $usuarioId, int $anuncioId, ?int $compradorId): array
{
    $stmt = $pdo->prepare(
        'SELECT a.id, a.titulo, a.preco, a.status, a.vendedor_id,
                (SELECT f.url_imagem FROM anuncios_fotos f
                  WHERE f.anuncio_id = a.id ORDER BY f.ordem, f.id LIMIT 1) AS imagem
           FROM anuncios a
          WHERE a.id = :id'
    );
    $stmt->execute([':id' => $anuncioId]);
    $anuncio = $stmt->fetch();

    if (!$anuncio) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Produto não encontrado.']);
    }

    $vendedorId = (int) $anuncio['vendedor_id'];

    if ($usuarioId === $vendedorId) {
        if ($compradorId === null || $compradorId === $vendedorId) {
            responder(422, ['sucesso' => false, 'mensagem' => 'Este produto é seu. A conversa começa quando um comprador enviar uma mensagem.']);
        }

        $papel = 'vendedor';
    } else {
        // Quem não é o vendedor só acessa a própria conversa, nunca a de outra conta.
        $compradorId = $usuarioId;
        $papel = 'comprador';
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM chats WHERE anuncio_id = :anuncio AND comprador_id = :comprador');
    $stmt->execute([':anuncio' => $anuncioId, ':comprador' => $compradorId]);
    $existe = (int) $stmt->fetchColumn() > 0;

    // O vendedor responde conversas; não abre uma com quem nunca escreveu.
    if ($papel === 'vendedor' && !$existe) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Conversa não encontrada.']);
    }

    $stmt = $pdo->prepare('SELECT id, nome FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $papel === 'vendedor' ? $compradorId : $vendedorId]);
    $contraparte = $stmt->fetch();

    if (!$contraparte) {
        responder(404, ['sucesso' => false, 'mensagem' => 'Usuário da conversa não encontrado.']);
    }

    return [
        'anuncio_id'   => (int) $anuncio['id'],
        'comprador_id' => $compradorId,
        'vendedor_id'  => $vendedorId,
        'papel'        => $papel,
        'existe'       => $existe,
        'contraparte'  => ['id' => (int) $contraparte['id'], 'nome' => $contraparte['nome']],
        'produto'      => [
            'id'     => (int) $anuncio['id'],
            'nome'   => $anuncio['titulo'],
            'preco'  => (float) $anuncio['preco'],
            'imagem' => $anuncio['imagem'],
            'status' => $anuncio['status'],
        ],
    ];
}

// Negociação concluída = existe um pedido ENTREGUE deste produto entre as duas partes.
function negociacao_concluida(PDO $pdo, int $anuncioId, int $compradorId, int $vendedorId): bool
{
    $stmt = $pdo->prepare(
        "SELECT 1 FROM pedidos p
           JOIN pedido_itens i ON i.pedido_id = p.id
          WHERE p.comprador_id = :comprador AND p.vendedor_id = :vendedor
            AND i.anuncio_id = :anuncio AND p.status = 'entregue'
          LIMIT 1"
    );
    $stmt->execute([':comprador' => $compradorId, ':vendedor' => $vendedorId, ':anuncio' => $anuncioId]);

    return (bool) $stmt->fetchColumn();
}

function formatar_mensagem(array $linha, int $usuarioId): array
{
    return [
        'id'    => (int) $linha['id'],
        'texto' => $linha['mensagem'],
        'tipo'  => $linha['tipo'],
        'valor' => $linha['valor_proposta'] !== null ? (float) $linha['valor_proposta'] : null,
        'minha' => (int) $linha['remetente_id'] === $usuarioId,
        'em'    => (int) $linha['em'],
    ];
}
