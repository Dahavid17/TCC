<?php
// Roteador do servidor embutido do PHP para rodar o marketplace localmente:
//   php -S 127.0.0.1:8080 -t . dev/router.php   (a partir da raiz do projeto)
// Aponta a conexão para o banco local e bloqueia pastas que o .htaccess protege no servidor.

putenv('MARKETPLACE_CONFIG=' . __DIR__ . '/config.dev.php');

$caminho = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));

if (preg_match('#^/(dev|backend/config|banco|database|iot/ponte-wokwi)(/|$)#', $caminho) === 1) {
    http_response_code(403);
    echo 'Acesso negado.';
    return true;
}

return false; // o servidor embutido entrega o arquivo pedido (e executa .php)
