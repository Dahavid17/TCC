<?php
declare(strict_types=1);

// Lembretes automáticos, alertas de preço e cotações de mercado.
// Os avisos vão para o sino (backend/lib/notificacoes.php → notificar()).
// notificacoes_geradas guarda a "chave" de cada aviso já dado, para o mesmo lembrete não
// voltar depois de lido.
//
// gerar_lembretes() roda ao abrir a Agenda/Dashboard (backend/gestao/lembretes.php, chamado
// pelo menu dos produtores) e todo dia pelo Cron Job (backend/cron/lembretes.php).

require_once __DIR__ . '/notificacoes.php';

// Preço cobrado de fato (promoção, se houver) — mesma regra de SQL_PRECO_VENDA (lib/api.php).
const SQL_PRECO_EFETIVO = 'CASE WHEN a.preco_promocional IS NOT NULL AND a.preco_promocional < a.preco THEN a.preco_promocional ELSE a.preco END';
const SQL_CHAVE_MERCADO = "COALESCE(NULLIF(a.cultura, ''), a.categoria)";

// Notifica só se esta chave ainda não foi avisada para o usuário. Devolve true se avisou.
function avisar_uma_vez(PDO $pdo, int $usuarioId, string $chave, string $tipo, string $titulo, string $mensagem, ?string $link = null): bool
{
    $stmt = $pdo->prepare('INSERT IGNORE INTO notificacoes_geradas (usuario_id, chave) VALUES (:usuario, :chave)');
    $stmt->execute([':usuario' => $usuarioId, ':chave' => mb_substr($chave, 0, 120)]);

    if ($stmt->rowCount() === 0) {
        return false;
    }

    notificar($pdo, $usuarioId, $tipo, $titulo, $mensagem, $link);

    return true;
}

// Gera os lembretes vencidos do produtor. Devolve [ [titulo, mensagem, link], ... ] dos novos.
function gerar_lembretes(PDO $pdo, int $usuarioId): array
{
    $novos = [];
    $avisar = function (string $chave, string $tipo, string $titulo, string $mensagem, string $link) use ($pdo, $usuarioId, &$novos): void {
        if (avisar_uma_vez($pdo, $usuarioId, $chave, $tipo, $titulo, $mensagem, $link)) {
            $novos[] = [$titulo, $mensagem, $link];
        }
    };

    // 1. Agenda: atividades e vencimentos dentro da janela de lembrete.
    $stmt = $pdo->prepare(
        "SELECT e.id, e.tipo_alerta, e.titulo, e.data_vencimento, e.hora_evento, DATEDIFF(e.data_vencimento, CURDATE()) AS dias
           FROM agenda_rural e JOIN fazendas f ON f.id = e.fazenda_id
          WHERE f.usuario_id = :usuario AND COALESCE(e.status_conclusao, 0) = 0
            AND DATE_SUB(e.data_vencimento, INTERVAL e.lembrar_dias_antes DAY) <= CURDATE()"
    );
    $stmt->execute([':usuario' => $usuarioId]);
    foreach ($stmt->fetchAll() as $e) {
        $dias = (int) $e['dias'];
        $data = date('d/m/Y', strtotime($e['data_vencimento']));
        $vencimento = in_array($e['tipo_alerta'], ['licenca', 'contrato', 'documento', 'pagamento'], true);

        if ($dias < 0) {
            $avisar("agenda-atraso:{$e['id']}:{$e['data_vencimento']}", $vencimento ? 'vencimento' : 'agenda',
                ($vencimento ? 'Vencido: ' : 'Atrasado: ') . $e['titulo'],
                ($vencimento ? 'Venceu em ' : 'Estava marcado para ') . "{$data}. Atualize a agenda.", 'gestao-rural.html?aba=agenda');
        } else {
            $quando = $dias === 0 ? 'hoje' : ($dias === 1 ? 'amanhã' : "em {$dias} dias");
            $avisar("agenda:{$e['id']}:{$e['data_vencimento']}", $vencimento ? 'vencimento' : 'agenda',
                ($vencimento ? 'Vence ' : 'Lembrete ') . $quando . ': ' . $e['titulo'],
                ($vencimento ? 'Prazo: ' : 'Marcado para ') . $data . ($e['hora_evento'] ? ' às ' . substr($e['hora_evento'], 0, 5) : '') . '.',
                'gestao-rural.html?aba=agenda');
        }
    }

    // 2. Documentos (licenças, laudos, contratos) vencendo em até 30 dias.
    $stmt = $pdo->prepare(
        "SELECT d.id, d.titulo, d.tipo_documento, d.data_validade, DATEDIFF(d.data_validade, CURDATE()) AS dias
           FROM documentos d JOIN fazendas f ON f.id = d.fazenda_id
          WHERE f.usuario_id = :usuario AND d.data_validade IS NOT NULL
            AND d.data_validade <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)"
    );
    $stmt->execute([':usuario' => $usuarioId]);
    foreach ($stmt->fetchAll() as $doc) {
        $dias = (int) $doc['dias'];
        $nome = $doc['titulo'] ?: $doc['tipo_documento'];
        $avisar('doc:' . $doc['id'] . ':' . ($dias < 0 ? 'vencido' : 'aviso'), 'documento',
            ($dias < 0 ? 'Documento vencido: ' : "Documento vence em {$dias} dia(s): ") . $nome,
            'Validade: ' . date('d/m/Y', strtotime($doc['data_validade'])) . '. Envie a versão renovada em Documentos.',
            'gestao-rural.html?aba=documentos');
    }

    // 3. Silos/reservatórios abaixo do mínimo ou acima do máximo (última leitura, uma vez por dia).
    $stmt = $pdo->prepare(
        'SELECT a.id, a.nome, a.alerta_minimo_pct, a.alerta_maximo_pct, l.nivel_pct
           FROM armazenamentos a
           JOIN fazendas f ON f.id = a.fazenda_id
           JOIN leituras_armazenamento l ON l.id = (SELECT l2.id FROM leituras_armazenamento l2
                                                     WHERE l2.armazenamento_id = a.id ORDER BY l2.data_hora DESC, l2.id DESC LIMIT 1)
          WHERE f.usuario_id = :usuario AND l.nivel_pct IS NOT NULL'
    );
    $stmt->execute([':usuario' => $usuarioId]);
    foreach ($stmt->fetchAll() as $s) {
        $nivel = (float) $s['nivel_pct'];
        if ($nivel <= (float) $s['alerta_minimo_pct']) {
            $avisar('silo-baixo:' . $s['id'] . ':' . date('Y-m-d'), 'silo', "Nível baixo: {$s['nome']}",
                "Nível em {$nivel}% (mínimo configurado: {$s['alerta_minimo_pct']}%).", 'gestao-rural.html?aba=silos');
        } elseif ($nivel >= (float) $s['alerta_maximo_pct']) {
            $avisar('silo-alto:' . $s['id'] . ':' . date('Y-m-d'), 'silo', "Nível alto: {$s['nome']}",
                "Nível em {$nivel}% (máximo configurado: {$s['alerta_maximo_pct']}%).", 'gestao-rural.html?aba=silos');
        }
    }

    return $novos;
}

// ── Mercado ─────────────────────────────────────────────────────────────────

// Grava em cotacoes_mercado o preço médio de hoje da commodity (geral e por região).
function registrar_cotacao(PDO $pdo, string $chave): void
{
    $pdo->prepare('DELETE FROM cotacoes_mercado WHERE commodity_insumo = :chave AND data_registro = CURDATE()')
        ->execute([':chave' => $chave]);

    $pdo->prepare(
        'INSERT INTO cotacoes_mercado (commodity_insumo, preco_medio, regiao, data_registro)
         SELECT :chave1, ROUND(AVG(' . SQL_PRECO_EFETIVO . '), 2), NULL, CURDATE()
           FROM anuncios a WHERE a.status = \'ativo\' AND ' . SQL_CHAVE_MERCADO . ' = :chave2
         HAVING COUNT(*) > 0'
    )->execute([':chave1' => $chave, ':chave2' => $chave]);

    $pdo->prepare(
        "INSERT INTO cotacoes_mercado (commodity_insumo, preco_medio, regiao, data_registro)
         SELECT :chave1, ROUND(AVG(" . SQL_PRECO_EFETIVO . "), 2), LEFT(a.localizacao, 100), CURDATE()
           FROM anuncios a WHERE a.status = 'ativo' AND " . SQL_CHAVE_MERCADO . " = :chave2
            AND a.localizacao IS NOT NULL AND a.localizacao <> ''
          GROUP BY LEFT(a.localizacao, 100)"
    )->execute([':chave1' => $chave, ':chave2' => $chave]);
}

// Depois de cadastrar/editar um anúncio: atualiza a cotação e dispara os alertas de preço.
// $precoAntigo = null no cadastro. Preços já são os efetivos (com promoção).
function registrar_preco(PDO $pdo, int $anuncioId, ?float $precoAntigo, float $precoNovo): void
{
    $stmt = $pdo->prepare(
        'SELECT a.id, a.titulo, a.categoria, a.cultura, a.vendedor_id, ' . SQL_CHAVE_MERCADO . ' AS chave
           FROM anuncios a WHERE a.id = :id AND a.status = \'ativo\''
    );
    $stmt->execute([':id' => $anuncioId]);
    $anuncio = $stmt->fetch();
    if (!$anuncio) {
        return;
    }

    try {
        registrar_cotacao($pdo, $anuncio['chave']);
    } catch (Throwable $e) {
        error_log('[MARKETPLACE_COTACAO] ' . $e->getMessage());
    }

    if ($precoAntigo !== null && abs($precoAntigo - $precoNovo) < 0.005) {
        return;
    }

    $stmt = $pdo->prepare(
        "SELECT * FROM alertas_precos
          WHERE ativo = 1 AND usuario_id <> :vendedor
            AND (anuncio_id = :anuncio
                 OR (anuncio_id IS NULL AND (:titulo LIKE CONCAT('%', categoria_produto, '%')
                                             OR categoria_produto = :cultura OR categoria_produto = :categoria)))"
    );
    $stmt->execute([
        ':vendedor'  => $anuncio['vendedor_id'],
        ':anuncio'   => $anuncioId,
        ':titulo'    => $anuncio['titulo'],
        ':cultura'   => (string) $anuncio['cultura'],
        ':categoria' => $anuncio['categoria'],
    ]);

    $fmt = fn(float $v): string => 'R$ ' . number_format($v, 2, ',', '.');
    $referencia = $precoAntigo ?? $precoNovo;

    foreach ($stmt->fetchAll() as $alerta) {
        $texto = null;
        $alvo = (float) $alerta['preco_alvo'];
        if ($alerta['condicao'] === 'abaixo' && $precoNovo <= $alvo) {
            $texto = 'chegou a ' . $fmt($precoNovo) . ' (seu alvo: até ' . $fmt($alvo) . ').';
        } elseif ($alerta['condicao'] === 'acima' && $precoNovo >= $alvo) {
            $texto = 'subiu para ' . $fmt($precoNovo) . ' (seu alvo: a partir de ' . $fmt($alvo) . ').';
        } elseif ($alerta['condicao'] === 'variacao' && $referencia > 0) {
            $variacao = ($precoNovo - $referencia) / $referencia * 100;
            if (abs($variacao) >= (float) $alerta['variacao_percentual']) {
                $texto = ($variacao > 0 ? 'subiu ' : 'caiu ') . number_format(abs($variacao), 1, ',', '.') . '% e agora custa ' . $fmt($precoNovo) . '.';
            }
        }

        if ($texto !== null && avisar_uma_vez($pdo, (int) $alerta['usuario_id'],
                'preco:' . $alerta['id'] . ':' . $anuncioId . ':' . number_format($precoNovo, 2, '.', ''),
                'alerta_preco', 'Alerta de preço: ' . $anuncio['titulo'], 'O preço ' . $texto, 'catalogo.html?produto=' . $anuncioId)) {
            $pdo->prepare('UPDATE alertas_precos SET ultimo_disparo = NOW() WHERE id = :id')->execute([':id' => $alerta['id']]);
        }
    }
}
