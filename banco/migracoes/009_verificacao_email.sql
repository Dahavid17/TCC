-- Verificação de e-mail real (código de 6 números enviado para a caixa de entrada).
-- Não precisa rodar à mão: backend/lib/verificacao_email.php cria tudo no primeiro uso.
-- Contas antigas ficam com email_verificado = 0 e confirmam no próximo login.

ALTER TABLE usuarios
    ADD COLUMN email_verificado TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS codigos_email (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id   BIGINT       NOT NULL,
    email        VARCHAR(150) NOT NULL,
    codigo_hash  VARCHAR(255) NOT NULL,
    tentativas   TINYINT      NOT NULL DEFAULT 0,
    usado        TINYINT(1)   NOT NULL DEFAULT 0,
    expira_em    DATETIME     NOT NULL,
    criado_em    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_codigos_usuario (usuario_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
