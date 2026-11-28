<?php
declare(strict_types=1);

// Disparo AUTOMÁTICO de lembretes (sem o usuário abrir o site).
// Configure no cPanel > Cron Jobs, por exemplo todo dia às 6h:
//   0 6 * * * /usr/local/bin/php /home2/buzzcodexcom/public_html/backend/cron/lembretes.php
// Gera os avisos de agenda, vencimentos de documentos e silos de todos os produtores (sino) e
// manda um e-mail com os avisos NOVOS de cada um, pelo envio do servidor (backend/lib/email.php),
// que respeita a preferência "E-mails" e só manda para e-mail confirmado.
// Só roda pela linha de comando.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';
require_once __DIR__ . '/../lib/lembretes.php';
require_once __DIR__ . '/../config/conexao.php';
if (is_file(__DIR__ . '/../lib/email.php')) {
    require_once __DIR__ . '/../lib/email.php';
}

$usuarios = $pdo->query(
    "SELECT DISTINCT f.usuario_id AS id
       FROM fazendas f
      WHERE EXISTS (SELECT 1 FROM agenda_rural e WHERE e.fazenda_id = f.id AND COALESCE(e.status_conclusao, 0) = 0)
         OR EXISTS (SELECT 1 FROM documentos d WHERE d.fazenda_id = f.id AND d.data_validade IS NOT NULL)
         OR EXISTS (SELECT 1 FROM armazenamentos a WHERE a.fazenda_id = f.id)"
)->fetchAll(PDO::FETCH_COLUMN);

$total = 0;
foreach ($usuarios as $usuarioId) {
    $novos = gerar_lembretes($pdo, (int) $usuarioId);
    $total += count($novos);

    if (!$novos || !function_exists('enviar_email_aviso')) {
        continue;
    }

    $titulo = count($novos) === 1 ? $novos[0][0] : count($novos) . ' lembretes da sua fazenda';
    $mensagem = implode("\n", array_map(fn($n) => '• ' . $n[0] . ' — ' . $n[1], $novos));
    enviar_email_aviso($pdo, (int) $usuarioId, $titulo, $mensagem, 'gestao-rural.html?aba=agenda');
}

echo date('c') . " lembretes gerados: {$total}\n";
