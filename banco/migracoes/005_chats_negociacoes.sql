-- Migração 005 — Negociações com mensagens reais entre comprador e vendedor
--
-- Reaproveita a tabela `chats`, que já existe no servidor (criada em 13/10/2026):
-- cada linha é UMA mensagem. Uma conversa é identificada pelo par
-- (anuncio_id, comprador_id); o vendedor é sempre o dono do anúncio.
--
-- Colunas acrescentadas:
--   remetente_id    quem escreveu a mensagem (comprador ou vendedor)
--   tipo            'texto' ou 'proposta'
--   valor_proposta  valor oferecido quando tipo = 'proposta'
--   lida_em         quando o destinatário abriu a conversa (NULL = não lida)
-- A coluna `mensagem` passa para utf8mb4 (aceita emojis).
--
-- ANTES DE EXECUTAR: faça backup do banco. Execute UMA vez no phpMyAdmin.
-- Nenhuma tabela é apagada; mensagens antigas (se houver) ficam com o
-- comprador como remetente.

ALTER TABLE `chats`
  ADD COLUMN `remetente_id` bigint(20) NULL AFTER `anuncio_id`,
  ADD COLUMN `tipo` enum('texto','proposta') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'texto' AFTER `remetente_id`,
  ADD COLUMN `valor_proposta` decimal(12,2) DEFAULT NULL AFTER `mensagem`,
  ADD COLUMN `lida_em` datetime DEFAULT NULL AFTER `data_hora`,
  MODIFY `mensagem` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

UPDATE `chats` SET `remetente_id` = `comprador_id` WHERE `remetente_id` IS NULL;

ALTER TABLE `chats`
  MODIFY `remetente_id` bigint(20) NOT NULL,
  ADD KEY `idx_chats_conversa` (`anuncio_id`, `comprador_id`, `id`),
  ADD CONSTRAINT `fk_chats_remetente` FOREIGN KEY (`remetente_id`) REFERENCES `usuarios` (`id`);
