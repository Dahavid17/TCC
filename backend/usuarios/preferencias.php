<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';

// Preferências do usuário logado, guardadas no servidor para valerem em qualquer navegador.
//   GET                         -> { sucesso, preferencias: { "tour:painel": "visto", "plano": "pro", ... } }
//   POST { chave, valor }       -> grava uma preferência (só as chaves e valores abaixo)
//   POST { chave, valor: null } -> apaga a preferência (ex.: trocar de plano)
// Tabela: banco/migracoes/006_usuarios_preferencias.sql (criada aqui se ainda não existir).

const PREFERENCIAS_PERMITIDAS = [
    'tour:painel' => ['visto'],
    'tour:gestao' => ['visto'],
    'plano'       => ['essencial', 'pro'],
];

$usuarioId = exigir_sessao();

try {
    require_once __DIR__ . '/../config/conexao.php';

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS usuarios_preferencias (
            usuario_id     INT UNSIGNED NOT NULL,
            chave          VARCHAR(40)  NOT NULL,
            valor          VARCHAR(60)  NOT NULL,
            atualizado_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (usuario_id, chave)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare('SELECT chave, valor FROM usuarios_preferencias WHERE usuario_id = :id');
        $stmt->execute([':id' => $usuarioId]);

        responder(200, [
            'sucesso'      => true,
            'preferencias' => (object) $stmt->fetchAll(PDO::FETCH_KEY_PAIR),
        ]);
    }

    exigir_metodo('POST');

    $corpo = json_decode((string) file_get_contents('php://input', false, null, 0, 4096), true);
    $chave = is_array($corpo) ? (string) ($corpo['chave'] ?? '') : '';
    $valor = is_array($corpo) ? ($corpo['valor'] ?? null) : null;

    if (!isset(PREFERENCIAS_PERMITIDAS[$chave])) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Preferência desconhecida.']);
    }

    if ($valor === null) {
        $stmt = $pdo->prepare('DELETE FROM usuarios_preferencias WHERE usuario_id = :id AND chave = :chave');
        $stmt->execute([':id' => $usuarioId, ':chave' => $chave]);

        responder(200, ['sucesso' => true]);
    }

    if (!in_array($valor, PREFERENCIAS_PERMITIDAS[$chave], true)) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Valor inválido para esta preferência.']);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO usuarios_preferencias (usuario_id, chave, valor) VALUES (:id, :chave, :valor)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)'
    );
    $stmt->execute([':id' => $usuarioId, ':chave' => $chave, ':valor' => $valor]);

    responder(200, ['sucesso' => true]);

} catch (Throwable $erro) {
    error_log('[MARKETPLACE_PREFERENCIAS] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível salvar a preferência.']);
}
