<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';

// Alertas de variação de preço (DER: alertas_precos) — qualquer usuário logado.
//   GET                         -> alertas do usuário (com o preço atual do anúncio, se houver)
//   POST acao=salvar            id?, anuncio_id? | termo? | categoria?, condicao (abaixo|acima|variacao),
//                               preco_alvo (abaixo/acima) ou variacao_percentual (variacao)
//   POST acao=alternar&id=N     liga/desliga
//   POST acao=excluir&id=N
// categoria_produto guarda o que é vigiado: o termo/cultura (ex.: "soja") ou a categoria; num
// alerta de um anúncio específico, o título do anúncio.
// O disparo acontece quando um vendedor cadastra/altera o preço (lib/lembretes.php).
$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare(
            'SELECT al.id, al.anuncio_id, al.categoria_produto, al.condicao, al.preco_alvo, al.variacao_percentual,
                    al.ativo, al.ultimo_disparo, al.data_criacao,
                    a.titulo AS anuncio_titulo, ' . SQL_PRECO_VENDA . ' AS preco_atual, a.status AS anuncio_status
               FROM alertas_precos al LEFT JOIN anuncios a ON a.id = al.anuncio_id
              WHERE al.usuario_id = :usuario ORDER BY al.ativo DESC, al.data_criacao DESC'
        );
        $stmt->execute([':usuario' => $usuarioId]);
        responder(200, ['sucesso' => true, 'alertas' => $stmt->fetchAll()]);
    }

    exigir_metodo('POST');
    $d = entrada();
    $acao = (string) ($d['acao'] ?? '');

    if ($acao === 'excluir' || $acao === 'alternar') {
        $sql = $acao === 'excluir'
            ? 'DELETE FROM alertas_precos WHERE id = :id AND usuario_id = :usuario'
            : 'UPDATE alertas_precos SET ativo = 1 - ativo WHERE id = :id AND usuario_id = :usuario';
        alterar_do_dono($pdo, $sql, [':id' => inteiro_id($d, 'id', true), ':usuario' => $usuarioId], 'Alerta não encontrado.');
        responder(200, ['sucesso' => true, 'mensagem' => $acao === 'excluir' ? 'Alerta excluído.' : 'Alerta atualizado.']);
    }

    if ($acao !== 'salvar') {
        falha('Ação inválida.');
    }

    $id = inteiro_id($d, 'id');
    $anuncioId = inteiro_id($d, 'anuncio_id');
    $termo = texto($d, 'termo', 100, false, 'termo');
    $categoria = texto($d, 'categoria', 100);
    if ($categoria !== null && !in_array($categoria, CATEGORIAS_PRODUTO, true)) {
        falha('Categoria inválida.');
    }
    if (!$anuncioId && $termo === null && $categoria === null) {
        falha('Escolha um produto, uma categoria ou digite um termo (ex.: soja, café).');
    }

    $precoReferencia = null;
    $vigiado = $termo !== null ? mb_strtolower($termo) : $categoria;
    if ($anuncioId) {
        $stmt = $pdo->prepare("SELECT a.titulo, a.vendedor_id, " . SQL_PRECO_VENDA . " AS preco FROM anuncios a WHERE a.id = :id AND a.status = 'ativo'");
        $stmt->execute([':id' => $anuncioId]);
        $anuncio = $stmt->fetch();
        if (!$anuncio) {
            falha('Produto não encontrado.', 404);
        }
        if ((int) $anuncio['vendedor_id'] === $usuarioId) {
            falha('Não é possível criar alerta para o seu próprio anúncio.');
        }
        $precoReferencia = (float) $anuncio['preco'];
        $vigiado = mb_substr($anuncio['titulo'], 0, 100);
    }

    $condicao = opcao($d, 'condicao', ['abaixo', 'acima', 'variacao'], 'abaixo', 'condição');
    $precoAlvo = 0.0; // NOT NULL no DER: zero quando o alerta é por variação
    $variacao = null;
    if ($condicao === 'variacao') {
        $variacao = decimal($d, 'variacao_percentual', 1, 100, true, 'a variação (%)');
    } else {
        $precoAlvo = decimal($d, 'preco_alvo', 0.01, 9999999999, true, 'o preço-alvo');
    }

    $dados = [
        ':usuario' => $usuarioId, ':anuncio' => $anuncioId, ':vigiado' => $vigiado, ':condicao' => $condicao,
        ':alvo' => $precoAlvo, ':variacao' => $variacao, ':referencia' => $precoReferencia,
    ];

    if ($id) {
        alterar_do_dono($pdo,
            'UPDATE alertas_precos SET anuncio_id = :anuncio, categoria_produto = :vigiado, condicao = :condicao,
                    preco_alvo = :alvo, variacao_percentual = :variacao, preco_referencia = :referencia, ativo = 1
              WHERE id = :id AND usuario_id = :usuario',
            $dados + [':id' => $id], 'Alerta não encontrado.');
    } else {
        // Um alerta por produto: recriar substitui o anterior.
        if ($anuncioId) {
            $pdo->prepare('DELETE FROM alertas_precos WHERE usuario_id = :usuario AND anuncio_id = :anuncio')
                ->execute([':usuario' => $usuarioId, ':anuncio' => $anuncioId]);
        }
        $pdo->prepare(
            'INSERT INTO alertas_precos (usuario_id, anuncio_id, categoria_produto, condicao, preco_alvo, variacao_percentual, preco_referencia)
             VALUES (:usuario, :anuncio, :vigiado, :condicao, :alvo, :variacao, :referencia)'
        )->execute($dados);
        $id = (int) $pdo->lastInsertId();
    }

    responder(200, ['sucesso' => true, 'mensagem' => 'Alerta de preço salvo. Avisaremos quando o preço mudar.', 'id' => $id]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_ALERTAS] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível processar o alerta.']);
}
