<?php
// Configurações do Banco de Dados na Hospedagem
$host    = 'localhost';
$dbname  = 'buzzcode_marketplace_rural'; // Nome do banco no cPanel
$usuario = 'ADM';              // Usuário criado na cPanel
$senha   = 'SF_6524139078';           // Senha que você definiu para esse usuário
$charset = 'utf8mb4';

$dsn = "mysql:host={$host};dbname={$dbname};charset={$charset}";

$opcoes = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $usuario, $senha, $opcoes);
    // echo "Conectado com sucesso!"; // Descomente para testar e comente novamente após o teste
} catch (PDOException $e) {
    die("Erro ao conectar com o banco de dados: " . $e->getMessage());
}
?>