<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/usuarios.php';

// POST senha_atual, nova_senha, confirmar_senha: troca a senha do usuário logado.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$atual     = (string) ($_POST['senha_atual'] ?? '');
$nova      = (string) ($_POST['nova_senha'] ?? '');
$confirmar = (string) ($_POST['confirmar_senha'] ?? '');

if ($atual === '' || $nova === '' || $confirmar === '') {
    responder(422, ['sucesso' => false, 'mensagem' => 'Preencha os três campos.']);
}

if ($nova !== $confirmar) {
    responder(422, ['sucesso' => false, 'mensagem' => 'A nova senha e a confirmação não são iguais.']);
}

if (strlen($nova) < SENHA_TAMANHO_MINIMO) {
    responder(422, ['sucesso' => false, 'mensagem' => 'A nova senha deve ter no mínimo ' . SENHA_TAMANHO_MINIMO . ' caracteres.']);
}

if ($nova === $atual) {
    responder(422, ['sucesso' => false, 'mensagem' => 'A nova senha precisa ser diferente da atual.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    if (!senha_confere($pdo, $usuarioId, $atual)) {
        responder(403, ['sucesso' => false, 'mensagem' => 'A senha atual está incorreta.']);
    }

    $stmt = $pdo->prepare('UPDATE usuarios SET senha_hash = :hash WHERE id = :id');
    $stmt->execute([':hash' => password_hash($nova, PASSWORD_DEFAULT), ':id' => $usuarioId]);

    // Nova identificação de sessão depois de trocar a senha.
    session_regenerate_id(true);

    responder(200, ['sucesso' => true, 'mensagem' => 'Senha atualizada com sucesso!']);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_SENHA] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível atualizar a senha. Tente novamente.']);
}
