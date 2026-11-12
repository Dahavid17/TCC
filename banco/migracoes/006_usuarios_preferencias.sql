-- Preferências por usuário guardadas no servidor (valem em qualquer navegador/aparelho):
--   tour:painel / tour:gestao  -> "visto" quando o usuário já viu o tour do Broto
--   plano                      -> "essencial" ou "pro" (plano da Gestão da Fazenda; por enquanto demonstração)
-- backend/usuarios/preferencias.php também cria esta tabela sozinho se ela ainda não existir.

CREATE TABLE IF NOT EXISTS usuarios_preferencias (
  usuario_id     INT UNSIGNED NOT NULL,
  chave          VARCHAR(40)  NOT NULL,
  valor          VARCHAR(60)  NOT NULL,
  atualizado_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
