<?php
// Configurações do Banco de Dados
$host    = 'localhost';
$dbname  = 'buzzcode_marketplace_rural';
$usuario = 'root'; // Usuário padrão do XAMPP/WAMP/Laragon
$senha   = 'SF_65241390078';     // Senha padrão é vazia (deixe '' se não configurou senha)
$charset = 'utf8mb4';

// Data Source Name (DSN)
$dsn = "mysql:host={$host};dbname={$dbname};charset={$charset}";

// Opções de configuração do PDO
$opcoes = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // Trata erros como exceções
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,     // Retorna dados como array associativo
    PDO::ATTR_EMULATE_PREPARES   => false,                 // Desativa emulação de prepared statements por segurança
];

try {
    // Cria a conexão PDO
    $pdo = new PDO($dsn, $usuario, $senha, $opcoes);
} catch (PDOException $e) {
    // Exibe mensagem amigável em caso de erro na conexão
    die("Erro ao conectar com o banco de dados: " . $e->getMessage());
}

echo "Conectado com sucesso!";
?>