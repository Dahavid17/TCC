-- Migração 004 — Monitoramento IoT (ESP32) na Gestão da Fazenda
--
-- Liga as leituras dos sensores (DHT22, LDR e umidade do solo) enviadas pelo ESP32
-- ao perfil do produtor:
--
--   usuarios (produtor) 1─N fazendas 1─N sensores_iot 1─N leituras_iot
--   usuarios (produtor) 1─N dispositivos_iot (a placa ESP32, com token próprio)
--
-- sensores_iot.codigo_esp32 é UNIQUE: cada sensor da placa usa "<código da placa>:<tipo>"
-- (ex.: ESP32-MR-88CDA7:temperatura).
--
-- PRODUÇÃO (buzzcode_marketplace_rural, verificado em 06/11/2026): fazendas, talhoes,
-- safras, sensores_iot e leituras_iot JÁ EXISTEM com a estrutura abaixo; lá só foi
-- preciso criar `dispositivos_iot`. Os CREATE TABLE IF NOT EXISTS das outras tabelas
-- servem para montar o banco local (dev/iniciar-local.ps1) igual ao servidor.
--
-- ANTES DE EXECUTAR em um servidor: faça backup do banco. Execute UMA vez.

CREATE TABLE IF NOT EXISTS `fazendas` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `usuario_id` bigint(20) NOT NULL,
  `nome` varchar(150) COLLATE utf8_unicode_ci NOT NULL,
  `localizacao` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `area_total` decimal(10,2) NOT NULL,
  `cadastro_estadual` varchar(50) COLLATE utf8_unicode_ci DEFAULT NULL,
  `data_criacao` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fazendas_usuario` (`usuario_id`),
  CONSTRAINT `fk_fazendas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `talhoes` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `fazenda_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_talhoes_fazenda` (`fazenda_id`),
  CONSTRAINT `fk_talhoes_fazenda` FOREIGN KEY (`fazenda_id`) REFERENCES `fazendas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `safras` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `fazenda_id` bigint(20) NOT NULL,
  `ano_periodo` varchar(50) COLLATE utf8_unicode_ci NOT NULL,
  `data_inicio` date NOT NULL,
  `data_encerramento` date DEFAULT NULL,
  `status` enum('em_andamento','concluida','cancelada') COLLATE utf8_unicode_ci DEFAULT 'em_andamento',
  PRIMARY KEY (`id`),
  KEY `idx_safras_fazenda` (`fazenda_id`),
  CONSTRAINT `fk_safras_fazenda` FOREIGN KEY (`fazenda_id`) REFERENCES `fazendas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `sensores_iot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `fazenda_id` bigint(20) NOT NULL,
  `localizacao_id` bigint(20) DEFAULT NULL,
  `tipo_sensor` varchar(50) COLLATE utf8_unicode_ci NOT NULL,
  `codigo_esp32` varchar(100) COLLATE utf8_unicode_ci NOT NULL,
  `status` enum('ativo','inativo','manutencao') COLLATE utf8_unicode_ci DEFAULT 'ativo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo_esp32` (`codigo_esp32`),
  KEY `idx_sensores_fazenda` (`fazenda_id`),
  CONSTRAINT `fk_sensores_fazenda` FOREIGN KEY (`fazenda_id`) REFERENCES `fazendas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `leituras_iot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `sensor_id` bigint(20) NOT NULL,
  `valor_leitura` decimal(10,2) NOT NULL,
  `data_hora` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_leituras_sensor_data` (`sensor_id`, `data_hora`),
  CONSTRAINT `fk_leituras_sensor` FOREIGN KEY (`sensor_id`) REFERENCES `sensores_iot` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- Nova: a placa ESP32. O token em texto puro só é mostrado ao produtor uma vez;
-- aqui fica apenas o SHA-256 dele.
CREATE TABLE IF NOT EXISTS `dispositivos_iot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `usuario_id` bigint(20) NOT NULL,
  `fazenda_id` bigint(20) NOT NULL,
  `codigo` varchar(40) COLLATE utf8_unicode_ci NOT NULL,
  `nome` varchar(120) COLLATE utf8_unicode_ci NOT NULL,
  `token_hash` char(64) COLLATE utf8_unicode_ci NOT NULL,
  `ultima_comunicacao` datetime DEFAULT NULL,
  `data_criacao` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dispositivos_codigo` (`codigo`),
  KEY `idx_dispositivos_usuario` (`usuario_id`),
  KEY `idx_dispositivos_fazenda` (`fazenda_id`),
  CONSTRAINT `fk_dispositivos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_dispositivos_fazenda` FOREIGN KEY (`fazenda_id`) REFERENCES `fazendas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
