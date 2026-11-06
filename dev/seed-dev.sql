-- Dados de TESTE do ambiente local (não use em produção).
-- Conta de produtor para testar a Gestão da Fazenda:
--   e-mail: produtor.teste@marketplace.local
--   senha:  teste-b49b3733
INSERT INTO usuarios (nome, email, senha_hash, telefone, cidade, tipo_acesso, endereco)
VALUES ('Produtor Teste', 'produtor.teste@marketplace.local', '$2y$10$tQ1M1OrBayYkXsN1QEDyvuvW2nrA/ttdSIWcCqvi5k9FiBBiX0nKS', '(35) 90000-0000', 'Arceburgo', 'produtor', 'Sítio de testes')
ON DUPLICATE KEY UPDATE senha_hash = VALUES(senha_hash), endereco = VALUES(endereco);
