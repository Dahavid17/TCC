<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';
require_once __DIR__ . '/../lib/lembretes.php';

// GET: gera os lembretes da Agenda, de documentos e de silos que venceram desde a última visita
// (os avisos aparecem no sino). Chamado pelo frontend/js/modulos.js ao abrir as páginas
// internas, só para produtores. O Cron Job (backend/cron/lembretes.php) faz o mesmo todo dia.
exigir_metodo('GET');

try {
    [$pdo, $usuarioId] = inicio_gestao();
    session_write_close();

    responder(200, ['sucesso' => true, 'novos' => count(gerar_lembretes($pdo, $usuarioId))]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_GESTAO_LEMBRETES] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível gerar os lembretes.']);
}
