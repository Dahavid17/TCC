-- Banco do ambiente LOCAL de desenvolvimento (MySQL de testes na porta 3307).
-- Recria só o necessário para login + Gestão da Fazenda + IoT. A tabela
-- `usuarios` segue a estrutura do servidor (dump de 28/10/2026).
-- As tabelas da Gestão/IoT vêm de banco/migracoes/004_iot_sensores.sql,
-- importado em seguida pelo dev/iniciar-local.ps1.

CREATE DATABASE IF NOT EXISTS marketplace_rural_dev
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE marketplace_rural_dev;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `nome` varchar(150) COLLATE utf8_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8_unicode_ci NOT NULL,
  `senha_hash` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `telefone` varchar(20) COLLATE utf8_unicode_ci DEFAULT NULL,
  `cidade` varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL,
  `tipo_acesso` enum('produtor','comprador','admin') COLLATE utf8_unicode_ci NOT NULL,
  `nota_reputacao` decimal(3,2) DEFAULT '5.00',
  `data_criacao` datetime DEFAULT CURRENT_TIMESTAMP,
  `endereco` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
