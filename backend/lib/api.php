<?php
declare(strict_types=1);

// Funções compartilhadas pelos endpoints JSON do marketplace.

const CATEGORIAS_PRODUTO = ['hortalicas', 'frutas', 'graos', 'laticinios', 'carnes', 'flores'];
const PASTA_FOTOS_PRODUTO = 'uploads/produtos/';
const TAMANHO_MAX_FOTO = 3 * 1024 * 1024;

const SQL_PRODUTO = "SELECT a.id, a.titulo AS nome, a.categoria, a.preco,
        a.quantidade_estoque AS estoque, a.descricao, a.status,
        a.vendedor_id, u.nome AS vendedor_nome,
        (SELECT f.url_imagem FROM anuncios_fotos f
          WHERE f.anuncio_id = a.id ORDER BY f.ordem, f.id LIMIT 1) AS imagem
    FROM anuncios a
    JOIN usuarios u ON u.id = a.vendedor_id";

function responder(int $status, array $dados): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function exigir_metodo(string $metodo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $metodo) {
        header('Allow: ' . $metodo);
        responder(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
    }
}

// Inicia a sessão e devolve o id do usuário autenticado (ou responde 401).
function exigir_sessao(): int
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    if (empty($_SESSION['usuario_id'])) {
        responder(401, ['sucesso' => false, 'mensagem' => 'Sua sessão expirou. Entre novamente.']);
    }

    return (int) $_SESSION['usuario_id'];
}

function normalizar_produto(array $linha): array
{
    return [
        'id'            => (int) $linha['id'],
        'nome'          => $linha['nome'],
        'categoria'     => $linha['categoria'],
        'preco'         => (float) $linha['preco'],
        'estoque'       => (int) $linha['estoque'],
        'descricao'     => $linha['descricao'] ?? '',
        'status'        => $linha['status'],
        'imagem'        => $linha['imagem'],
        'vendedor_id'   => (int) $linha['vendedor_id'],
        'vendedor_nome' => $linha['vendedor_nome'],
    ];
}

// Lê e valida os campos do formulário de produto; responde 422 se algo for inválido.
function validar_dados_produto(): array
{
    $nome      = trim((string) ($_POST['nome'] ?? ''));
    $categoria = (string) ($_POST['categoria'] ?? '');
    $descricao = trim((string) ($_POST['descricao'] ?? ''));
    $preco     = str_replace(',', '.', trim((string) ($_POST['preco'] ?? '')));
    $estoque   = filter_var($_POST['estoque'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 1000000000]]);

    if ($nome === '' || mb_strlen($nome) > 200) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Informe o nome do produto (até 200 caracteres).']);
    }

    if (!in_array($categoria, CATEGORIAS_PRODUTO, true)) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Categoria inválida.']);
    }

    if (!is_numeric($preco) || (float) $preco < 0 || (float) $preco > 9999999999.99) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Informe um preço válido.']);
    }

    if ($estoque === false) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Informe uma quantidade válida (número inteiro, zero ou mais).']);
    }

    if (mb_strlen($descricao) > 5000) {
        responder(422, ['sucesso' => false, 'mensagem' => 'A descrição pode ter no máximo 5000 caracteres.']);
    }

    return [
        'titulo'    => $nome,
        'categoria' => $categoria,
        'preco'     => number_format((float) $preco, 2, '.', ''),
        'estoque'   => $estoque,
        'descricao' => $descricao,
    ];
}

// Valida a imagem enviada (campo "imagem"). Devolve null se nenhuma foi enviada.
function validar_imagem_produto(): ?array
{
    $arquivo = $_FILES['imagem'] ?? null;

    if (!$arquivo || $arquivo['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    if ($arquivo['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($arquivo['tmp_name'])) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Não foi possível receber a imagem. Tente outra.']);
    }

    if ($arquivo['size'] > TAMANHO_MAX_FOTO) {
        responder(422, ['sucesso' => false, 'mensagem' => 'A imagem deve ter no máximo 3 MB.']);
    }

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($arquivo['tmp_name']);
    $extensoes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    if (!isset($extensoes[$mime]) || @getimagesize($arquivo['tmp_name']) === false) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Envie uma imagem JPG, PNG ou WEBP.']);
    }

    return ['tmp' => $arquivo['tmp_name'], 'ext' => $extensoes[$mime]];
}

// Move a imagem validada para uploads/produtos/ e devolve o caminho relativo à raiz do site.
function mover_imagem_produto(array $imagem): string
{
    $pasta = dirname(__DIR__, 2) . '/' . PASTA_FOTOS_PRODUTO;

    if (!is_dir($pasta) && !mkdir($pasta, 0755, true)) {
        throw new RuntimeException('Não foi possível criar a pasta de imagens.');
    }

    $nomeArquivo = bin2hex(random_bytes(16)) . '.' . $imagem['ext'];

    if (!move_uploaded_file($imagem['tmp'], $pasta . $nomeArquivo)) {
        throw new RuntimeException('Não foi possível salvar a imagem.');
    }

    return PASTA_FOTOS_PRODUTO . $nomeArquivo;
}

// Apaga do disco uma foto de produto; ignora qualquer caminho fora da pasta de uploads.
function remover_arquivo_produto(string $caminho): void
{
    if (preg_match('#^' . preg_quote(PASTA_FOTOS_PRODUTO, '#') . '[a-f0-9]{32}\.(jpg|png|webp)$#', $caminho) === 1) {
        @unlink(dirname(__DIR__, 2) . '/' . $caminho);
    }
}

function buscar_produto(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare(SQL_PRODUTO . ' WHERE a.id = :id');
    $stmt->execute([':id' => $id]);
    $linha = $stmt->fetch();

    return $linha ? normalizar_produto($linha) : null;
}
