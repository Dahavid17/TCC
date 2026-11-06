-- Migração 002 — pedidos e itens do pedido
--
-- `historico_transacoes` registra uma venda já concluída (sem status nem
-- quantidade) e é referenciada por `avaliacoes`; ela NÃO é alterada.
--
-- ANTES DE EXECUTAR: faça backup do banco. Execute UMA vez no phpMyAdmin.
-- Só cria tabelas novas; nada existente é alterado ou removido.

CREATE TABLE `pedidos` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `comprador_id` bigint(20) NOT NULL,
  `vendedor_id` bigint(20) NOT NULL,
  `status` enum('recebido','negociacao','preparo','entregue','cancelado') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'recebido',
  `total` decimal(12,2) NOT NULL,
  `data_criacao` datetime DEFAULT CURRENT_TIMESTAMP,
  `data_atualizacao` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pedidos_comprador` (`comprador_id`),
  KEY `idx_pedidos_vendedor` (`vendedor_id`),
  CONSTRAINT `fk_pedidos_comprador` FOREIGN KEY (`comprador_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_pedidos_vendedor` FOREIGN KEY (`vendedor_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE `pedido_itens` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `pedido_id` bigint(20) NOT NULL,
  `anuncio_id` bigint(20) NOT NULL,
  `nome_produto` varchar(200) COLLATE utf8_unicode_ci NOT NULL,
  `quantidade` int(11) NOT NULL,
  `preco_unitario` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_itens_pedido` (`pedido_id`),
  KEY `idx_itens_anuncio` (`anuncio_id`),
  CONSTRAINT `fk_itens_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_itens_anuncio` FOREIGN KEY (`anuncio_id`) REFERENCES `anuncios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- Regras adotadas (simples, para a demonstração):
--  * O estoque do produto é reduzido ao CRIAR o pedido (reserva).
--  * Cancelar o pedido devolve a quantidade ao estoque.
--  * O preço unitário e o nome do produto são gravados no pedido (snapshot).
--  * Vendedor: recebido -> negociacao/preparo -> entregue (ou cancelado).
--  * Comprador: só pode cancelar enquanto estiver recebido ou em negociação.
