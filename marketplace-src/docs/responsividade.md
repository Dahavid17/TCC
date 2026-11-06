# Responsividade (mobile first)

O painel interno (Início, Meus Produtos, Pedidos, Negociações, Estoque, Favoritos,
Gestão da Fazenda e Configurações) é responsivo com abordagem **mobile first**.

## Como funciona

- [`frontend/css/responsivo.css`](../frontend/css/responsivo.css) é carregado **depois** do CSS de cada página.
  As regras sem `@media` descrevem o **celular**; as telas maiores recebem ajustes com `@media (min-width: …)`.
- [`frontend/js/menu.js`](../frontend/js/menu.js) cria o botão hambúrguer e a gaveta do menu lateral
  nas telas pequenas e mede a altura real do topo (`--topo-h`), para o conteúdo nunca ficar escondido.
- As páginas públicas (`index`, `home`, `marketplace`, `login`, `cadastro`) já tinham ajustes
  próprios e foram apenas verificadas.

## Pontos de quebra

| Largura | O que muda |
|---------|------------|
| base (celular) | topo em 2 linhas, menu em gaveta, cartões em 2 colunas, filtros empilhados, tabelas viram cartões, modais viram gaveta inferior |
| ≥ 600px | nome do usuário e sino no topo, cartões em 4 colunas, filtros em linha, modais centralizados |
| ≥ 900px | menu lateral fixo, topo em 1 linha com a pesquisa, espaçamentos de desktop |
| ≥ 1200px | margens maiores e cartões de produto mais largos |

## Regras adotadas

- Alvos de toque de pelo menos 44 px; campos com 16 px (evita o zoom automático do iOS).
- Sem rolagem horizontal da página em 320 px de largura.
- Tabelas (Pedidos, Estoque) viram cartões no celular; cada célula tem `data-label`.
  Ao criar uma tabela nova dentro de `.tabela-wrapper`, inclua `data-label` nas células.
- `prefers-reduced-motion` desliga as transições.

## Ao criar uma página interna nova

1. Use a mesma estrutura (`.topbar`, `.sidebar`, `.conteudo`).
2. Inclua `../css/responsivo.css` por último no `<head>` e `../js/menu.js` no fim do `<body>`.
