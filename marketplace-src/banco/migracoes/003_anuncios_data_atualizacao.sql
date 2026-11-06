-- Migração 003 — data da última atualização dos anúncios
--
-- A tela Estoque mostra "Última atualização". A tabela `anuncios` só tem
-- `data_criacao`, então esta coluna passa a ser mantida pelo próprio MySQL.
--
-- ANTES DE EXECUTAR: faça backup. Execute UMA vez no phpMyAdmin.
-- Alteração apenas aditiva. Os registros existentes recebem a data/hora da execução.

ALTER TABLE `anuncios`
  ADD COLUMN `data_atualizacao` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
