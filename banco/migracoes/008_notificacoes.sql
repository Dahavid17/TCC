-- Notificações dentro do site (sino do topo).
-- backend/lib/notificacoes.php também cria esta tabela sozinho se ela ainda não existir.
--   grupo: avisos não lidos do mesmo grupo (ex.: "chat:12:31" = conversa) são atualizados, não repetidos.

CREATE TABLE IF NOT EXISTS notificacoes (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id  BIGINT       NOT NULL,
  tipo        VARCHAR(20)  NOT NULL,            -- pedido_novo | pedido_status | mensagem | proposta | sistema
  titulo      VARCHAR(120) NOT NULL,
  mensagem    VARCHAR(255) NOT NULL,
  link        VARCHAR(255) NULL,                -- página interna, ex.: pedidos.html
  grupo       VARCHAR(60)  NULL,
  lida        TINYINT(1)   NOT NULL DEFAULT 0,
  criada_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notificacoes_usuario (usuario_id, lida, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
