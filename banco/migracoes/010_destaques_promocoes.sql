-- Produtos em destaque e promoções.
-- Rodar ANTES de publicar os arquivos novos (lib/api.php já lê estas colunas).
--
-- destaque = 1          -> aparece em "Produtos em destaque" no Início.
-- preco_promocional     -> preço com desconto; vazio (NULL) = sem promoção.
--                          Produto em promoção também entra nos destaques.
-- A aba "Produtos" (frontend/pages/produtos.html) mostra todos os produtos ativos.

ALTER TABLE anuncios
    ADD COLUMN destaque TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
    ADD COLUMN preco_promocional DECIMAL(12,2) NULL DEFAULT NULL AFTER preco;

-- Dados de exemplo usados no site (produtos da conta "senai", que têm fotos boas).
-- Frango, Caixa de leite e Caixa de bananas ficam só na aba Produtos.
UPDATE anuncios SET destaque = 1 WHERE id IN (10, 11, 12, 13, 14, 15);

-- Algumas promoções para demonstração:
UPDATE anuncios SET preco_promocional = 74.90 WHERE id = 10; -- Café Arábica: de 89,90 por 74,90
UPDATE anuncios SET preco_promocional = 79.00 WHERE id = 13; -- Tomate Italiano: de 98,00 por 79,00
UPDATE anuncios SET preco_promocional = 69.90 WHERE id = 14; -- Queijo Minas: de 84,00 por 69,90
