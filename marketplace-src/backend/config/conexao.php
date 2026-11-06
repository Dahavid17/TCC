<?php
// As credenciais NÃO ficam neste arquivo (ele é versionado).
// Crie backend/config/config.local.php no servidor a partir de config.example.php.
// Alternativa: variáveis de ambiente DB_HOST, DB_NAME, DB_USER, DB_PASS.

$configLocal = __DIR__ . '/config.local.php';
$config = is_file($configLocal) ? require $configLocal : [];

$host    = $config['host']    ?? getenv('DB_HOST') ?: 'localhost';
$dbname  = $config['dbname']  ?? getenv('DB_NAME') ?: '';
$usuario = $config['usuario'] ?? getenv('DB_USER') ?: '';
$senha   = $config['senha']   ?? getenv('DB_PASS') ?: '';
$charset = 'utf8mb4';

$dsn = "mysql:host={$host};dbname={$dbname};charset={$charset}";

$opcoes = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $usuario, $senha, $opcoes);
} catch (PDOException $e) {
    error_log('[MARKETPLACE_CONEXAO] ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['sucesso' => false, 'mensagem' => 'Erro ao conectar com o banco de dados.']);
    exit;
}
