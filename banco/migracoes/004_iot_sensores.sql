-- Migração 004 — Monitoramento IoT (ESP32) na Gestão da Fazenda
--
-- Cria a estrutura que recebe as leituras dos sensores (DHT22, LDR e umidade
-- do solo) enviadas pelo ESP32 e as vincula ao perfil do produtor:
--
--   usuarios (produtor) 1─N fazendas 1─N sensores_iot 1─N leituras_iot
--   usuarios (produtor) 1─N dispositivos_iot (o ESP32, com token próprio)
--
-- sensores_iot.codigo_esp32 = dispositivos_iot.codigo liga cada sensor à placa.
--
-- ANTES DE EXECUTAR: faça backup do banco. Execute UMA vez no phpMyAdmin.
-- Tudo é "CREATE TABLE IF NOT EXISTS": tabelas que já existirem no servidor
-- (fazendas, talhoes, safras, sensores_iot, leituras_iot) NÃO são alteradas.
-- Nesse caso, confira antes de usar:
--   SHOW COLUMNS FROM sensores_iot LIKE 'tipo_sensor';
--     -> precisa aceitar 'temperatura', 'umidade_ar', 'luminosidade' e 'umidade_solo'
--        (se for ENUM sem esses valores, troque por VARCHAR(40)).
--   SHOW COLUMNS FROM leituras_iot LIKE 'valor_leitura';
--     -> luminosidade chega a 100000 lux; use DECIMAL(12,2) ou maior.

CREATE TABLE IF NOT EXISTS `fazendas` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `usuario_id` bigint(20) NOT NULL,
  `nome` varchar(150) COLLATE utf8_unicode_ci NOT NULL,
  `localizacao` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `area_total` decimal(10,2) DEFAULT NULL,
  `data_criacao` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fazendas_usuario` (`usuario_id`),
  CONSTRAINT `fk_fazendas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `talhoes` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `fazenda_id` bigint(20) NOT NULL,
  `nome` varchar(120) COLLATE utf8_unicode_ci NOT NULL,
  `area` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_talhoes_fazenda` (`fazenda_id`),
  CONSTRAINT `fk_talhoes_fazenda` FOREIGN KEY (`fazenda_id`) REFERENCES `fazendas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `safras` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `fazenda_id` bigint(20) NOT NULL,
  `cultura` varchar(120) COLLATE utf8_unicode_ci NOT NULL,
  `status` enum('planejada','em_andamento','colhida') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'planejada',
  `data_inicio` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_safras_fazenda` (`fazenda_id`),
  CONSTRAINT `fk_safras_fazenda` FOREIGN KEY (`fazenda_id`) REFERENCES `fazendas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- A placa ESP32. O token em texto puro só é mostrado ao produtor uma vez;
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
  CONSTRAINT `fk_dispositivos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_dispositivos_fazenda` FOREIGN KEY (`fazenda_id`) REFERENCES `fazendas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `sensores_iot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `fazenda_id` bigint(20) NOT NULL,
  `tipo_sensor` varchar(40) COLLATE utf8_unicode_ci NOT NULL,
  `codigo_esp32` varchar(40) COLLATE utf8_unicode_ci NOT NULL,
  `status` enum('ativo','inativo','manutencao') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'ativo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sensor_placa_tipo` (`codigo_esp32`, `tipo_sensor`),
  KEY `idx_sensores_fazenda` (`fazenda_id`),
  CONSTRAINT `fk_sensores_fazenda` FOREIGN KEY (`fazenda_id`) REFERENCES `fazendas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `leituras_iot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `sensor_id` bigint(20) NOT NULL,
  `valor_leitura` decimal(12,2) NOT NULL,
  `data_hora` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_leituras_sensor_data` (`sensor_id`, `data_hora`),
  CONSTRAINT `fk_leituras_sensor` FOREIGN KEY (`sensor_id`) REFERENCES `sensores_iot` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
