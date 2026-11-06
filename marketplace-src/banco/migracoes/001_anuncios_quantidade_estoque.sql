-- Migração 001 — estoque nos anúncios (produtos do marketplace)
--
-- Motivo: a tabela `anuncios` não tem quantidade em estoque. Meus Produtos,
-- Estoque e Início precisam da mesma fonte de verdade (documentação, seção 4.5).
--
-- ANTES DE EXECUTAR: faça backup (phpMyAdmin > Exportar) do banco
-- `buzzcode_marketplace_rural`. Execute UMA vez, na aba SQL do phpMyAdmin.
-- A alteração é apenas aditiva: nenhuma coluna ou dado existente é removido.

ALTER TABLE `anuncios`
  ADD COLUMN `quantidade_estoque` INT NOT NULL DEFAULT 0 AFTER `preco`,
  ADD KEY `idx_anuncios_status` (`status`);

-- Regra adotada para "excluir produto": o backend marca status = 'inativo'
-- (exclusão lógica), pois `chats` e `historico_transacoes` referenciam
-- `anuncios` sem ON DELETE CASCADE e um DELETE real quebraria o histórico.
