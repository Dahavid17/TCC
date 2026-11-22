<?php
declare(strict_types=1);

// Regras compartilhadas da conta do usuário (foto de perfil, senha).
// Requer backend/lib/api.php (responder).

const PASTA_FOTOS_PERFIL = 'uploads/perfis/';
const TAMANHO_MAX_FOTO_PERFIL = 3 * 1024 * 1024;
const SENHA_TAMANHO_MINIMO = 6; // mesmo mínimo do cadastro (backend/auth/cadastro.php)

// A coluna usuarios.foto_perfil vem de banco/migracoes/007_usuarios_foto_perfil.sql.
// Se a migração ainda não foi rodada no servidor, cria a coluna aqui.
function garantir_coluna_foto(PDO $pdo): void
{
    $existe = $pdo->query("SHOW COLUMNS FROM usuarios LIKE 'foto_perfil'")->fetch();

    if (!$existe) {
        $pdo->exec('ALTER TABLE usuarios ADD COLUMN foto_perfil VARCHAR(255) NULL DEFAULT NULL');
    }
}

// Valida a foto enviada no campo "foto" (JPG, PNG ou WEBP de até 3 MB).
function validar_foto_perfil(): array
{
    $arquivo = $_FILES['foto'] ?? null;

    if (!$arquivo || $arquivo['error'] === UPLOAD_ERR_NO_FILE) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Escolha uma foto.']);
    }

    if (in_array($arquivo['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || $arquivo['size'] > TAMANHO_MAX_FOTO_PERFIL) {
        responder(422, ['sucesso' => false, 'mensagem' => 'A foto deve ter no máximo 3 MB.']);
    }

    if ($arquivo['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($arquivo['tmp_name'])) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Não foi possível receber a foto. Tente outra.']);
    }

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($arquivo['tmp_name']);
    $extensoes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    if (!isset($extensoes[$mime]) || @getimagesize($arquivo['tmp_name']) === false) {
        responder(422, ['sucesso' => false, 'mensagem' => 'Envie uma foto JPG, PNG ou WEBP.']);
    }

    return ['tmp' => $arquivo['tmp_name'], 'ext' => $extensoes[$mime]];
}

// Move a foto validada para uploads/perfis/ e devolve o caminho relativo à raiz do site.
function mover_foto_perfil(array $foto): string
{
    $raiz = dirname(__DIR__, 2) . '/';
    $pasta = $raiz . PASTA_FOTOS_PERFIL;

    if (!is_dir($pasta) && !mkdir($pasta, 0755, true)) {
        throw new RuntimeException('Não foi possível criar a pasta de fotos de perfil.');
    }

    $nome = bin2hex(random_bytes(16)) . '.' . $foto['ext'];

    if (!move_uploaded_file($foto['tmp'], $pasta . $nome)) {
        throw new RuntimeException('Não foi possível salvar a foto de perfil.');
    }

    return PASTA_FOTOS_PERFIL . $nome;
}

// Apaga uma foto de perfil do disco; ignora qualquer caminho fora da pasta de perfis.
function remover_foto_perfil(?string $caminho): void
{
    if ($caminho !== null
        && preg_match('#^' . preg_quote(PASTA_FOTOS_PERFIL, '#') . '[a-f0-9]{32}\.(jpg|png|webp)$#', $caminho) === 1) {
        @unlink(dirname(__DIR__, 2) . '/' . $caminho);
    }
}

// Confere a senha atual do usuário logado.
function senha_confere(PDO $pdo, int $usuarioId, string $senha): bool
{
    $stmt = $pdo->prepare('SELECT senha_hash FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);
    $hash = $stmt->fetchColumn();

    return is_string($hash) && $senha !== '' && password_verify($senha, $hash);
}
