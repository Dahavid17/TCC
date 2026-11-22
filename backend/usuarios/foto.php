<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/usuarios.php';

// Foto de perfil do usuário logado.
//   POST multipart  foto=<arquivo>  -> troca a foto (JPG, PNG ou WEBP de até 3 MB)
//   POST            acao=remover    -> volta para a inicial do nome
// Resposta: { sucesso, mensagem, foto_perfil: "uploads/perfis/....jpg" | null }
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$remover = ($_POST['acao'] ?? '') === 'remover';
$foto = $remover ? null : validar_foto_perfil();
$caminhoNovo = null;

try {
    require_once __DIR__ . '/../config/conexao.php';

    garantir_coluna_foto($pdo);

    $stmt = $pdo->prepare('SELECT foto_perfil FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);
    $fotoAntiga = $stmt->fetchColumn() ?: null;

    if ($foto !== null) {
        $caminhoNovo = mover_foto_perfil($foto);
    }

    $stmt = $pdo->prepare('UPDATE usuarios SET foto_perfil = :foto WHERE id = :id');
    $stmt->execute([':foto' => $caminhoNovo, ':id' => $usuarioId]);

    remover_foto_perfil($fotoAntiga);

    responder(200, [
        'sucesso'     => true,
        'mensagem'    => $remover ? 'Foto removida.' : 'Foto de perfil atualizada!',
        'foto_perfil' => $caminhoNovo,
    ]);
} catch (Throwable $erro) {
    remover_foto_perfil($caminhoNovo);

    error_log('[MARKETPLACE_FOTO_PERFIL] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível salvar a foto. Tente novamente.']);
}
