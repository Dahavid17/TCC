<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';
require_once __DIR__ . '/../lib/mercado.php';

// GET [?produto=chave&regiao=cidade&meses=12]: Inteligência de Mercado — só produtores
// (e administradores). Compradores recebem 403.
//   precos        -> preço médio, menor e maior de cada insumo/commodity da plataforma (+ tendência 30d)
//   historico     -> evolução mensal dos preços (todos os produtos ou o escolhido)
//   pesquisados   -> ranking dos termos mais pesquisados (30 dias)
//   vendidos      -> ranking dos produtos mais vendidos (90 dias)
//   regioes       -> menor/maior preço por região do produto escolhido
exigir_metodo('GET');
$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    $stmt = $pdo->prepare('SELECT tipo_acesso FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);
    if (!in_array($stmt->fetchColumn(), ['produtor', 'admin'], true)) {
        responder(403, ['sucesso' => false, 'mensagem' => 'A Inteligência de Mercado é exclusiva para produtores.']);
    }

    $produto = trim((string) ($_GET['produto'] ?? ''));
    $produto = preg_match('/^[a-z_]{2,60}$/', $produto) === 1 ? $produto : null;
    $regiao = mb_substr(trim((string) ($_GET['regiao'] ?? '')), 0, 100) ?: null;
    $meses = (int) ($_GET['meses'] ?? 12);

    $stmt = $pdo->query("SELECT DISTINCT COALESCE(NULLIF(localizacao, ''), NULL) AS r FROM anuncios WHERE status = 'ativo' AND localizacao IS NOT NULL ORDER BY r");

    responder(200, [
        'sucesso'     => true,
        'precos'      => precos_de_mercado($pdo, $regiao),
        'historico'   => historico_precos($pdo, $produto, $meses, $regiao),
        'pesquisados' => mais_pesquisados($pdo, 30, 10),
        'vendidos'    => mais_vendidos($pdo, 90, 10),
        'regioes'     => $produto ? precos_por_regiao($pdo, $produto) : [],
        'lista_regioes' => array_values(array_filter($stmt->fetchAll(PDO::FETCH_COLUMN))),
    ]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_MERCADO] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível carregar a inteligência de mercado.']);
}
