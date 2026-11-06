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
