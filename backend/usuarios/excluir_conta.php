<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/usuarios.php';

// POST senha: exclui a conta do usuário logado (pede a senha para confirmar).
//
// Pedidos, negociações e dispositivos apontam para o usuário (chaves estrangeiras), então a
// linha não é apagada: a conta é DESATIVADA e ANONIMIZADA. Nome, e-mail, telefone, endereço,
// foto e preferências são removidos, a senha vira um valor aleatório (ninguém mais entra) e os
// anúncios saem da vitrine. O histórico de pedidos da outra parte continua consistente.
exigir_metodo('POST');
$usuarioId = exigir_sessao();

$senha = (string) ($_POST['senha'] ?? '');

if ($senha === '') {
    responder(422, ['sucesso' => false, 'mensagem' => 'Digite sua senha para confirmar.']);
}

try {
    require_once __DIR__ . '/../config/conexao.php';

    if (!senha_confere($pdo, $usuarioId, $senha)) {
        responder(403, ['sucesso' => false, 'mensagem' => 'Senha incorreta. A conta não foi excluída.']);
    }

    garantir_coluna_foto($pdo);

    $stmt = $pdo->prepare('SELECT foto_perfil FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);
    $foto = $stmt->fetchColumn() ?: null;

    $pdo->beginTransaction();

    $pdo->prepare("UPDATE anuncios SET status = 'inativo' WHERE vendedor_id = :id")
        ->execute([':id' => $usuarioId]);

    $pdo->prepare(
        "UPDATE usuarios
            SET nome = 'Conta excluída',
                email = :email,
                senha_hash = :hash,
                telefone = NULL,
                cidade = NULL,
                endereco = NULL,
                foto_perfil = NULL
          WHERE id = :id"
    )->execute([
        ':email' => 'excluida-' . $usuarioId . '-' . bin2hex(random_bytes(4)) . '@contas.invalid',
        ':hash'  => password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT),
        ':id'    => $usuarioId,
    ]);

    // A tabela de preferências pode não existir em bancos antigos.
    try {
        $pdo->prepare('DELETE FROM usuarios_preferencias WHERE usuario_id = :id')->execute([':id' => $usuarioId]);
    } catch (PDOException $semTabela) {
        // nada a apagar
    }

    $pdo->commit();

    remover_foto_perfil($foto);

    $_SESSION = [];
    session_destroy();

    responder(200, ['sucesso' => true, 'mensagem' => 'Sua conta foi excluída.']);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[MARKETPLACE_EXCLUIR_CONTA] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível excluir a conta. Tente novamente.']);
}
