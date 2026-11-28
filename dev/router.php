<?php
// Roteador do servidor embutido do PHP para rodar o marketplace localmente:
//   php -S 127.0.0.1:8080 -t . dev/router.php   (a partir da raiz do projeto)
// Aponta a conexão para o banco local e bloqueia pastas que o .htaccess protege no servidor.

putenv('MARKETPLACE_CONFIG=' . __DIR__ . '/config.dev.php');

$caminho = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));

// Mostra a página de erro personalizada de /erros (igual ao ErrorDocument do .htaccess).
$mostrarErro = static function (int $codigo): bool {
    http_response_code($codigo);
    $pagina = dirname(__DIR__) . "/erros/{$codigo}.html";
    if (is_file($pagina)) {
        header('Content-Type: text/html; charset=UTF-8');
        readfile($pagina);
    } else {
        echo "Erro {$codigo}";
    }
    return true;
};

if (preg_match('#^/(dev|backend/config|banco|database|iot/ponte-wokwi)(/|$)#', $caminho) === 1) {
    return $mostrarErro(403);
}

// Arquivo ou pasta que não existe → página 404 personalizada.
$arquivo = $_SERVER['DOCUMENT_ROOT'] . $caminho;
if (!file_exists($arquivo)) {
    return $mostrarErro(404);
}

return false; // o servidor embutido entrega o arquivo pedido (e executa .php)
