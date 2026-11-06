# Roteiro de testes integrados — Fase 7

Execute no site publicado (buzzcodex.com.br), com **Ctrl+F5** antes de começar.
Use duas contas: **A** (vendedora) e **B** (compradora). Marque cada item como ✅ ou ❌ e anote a mensagem de erro, se houver.

## Pré-requisitos

- [ ] Migrações executadas no banco, nesta ordem: `001`, `002`, `003` (pasta `banco/migracoes/`).
- [ ] `backend/config/config.local.php` criado no servidor com a **nova** senha do banco.
- [ ] Todos os arquivos publicados (`backend/`, `frontend/`, `uploads/.htaccess`).
- [ ] Senha antiga do MySQL rotacionada no cPanel.

## 1. Autenticação

| # | Passo | Resultado esperado | OK |
|---|-------|--------------------|----|
| 1.1 | Cadastrar a conta A escolhendo **Produtor** | Mensagem de sucesso e redirecionamento ao login | |
| 1.2 | Cadastrar a conta B escolhendo **Comprador** (clicar no botão deve mudar o destaque) | Idem; no banco, `tipo_acesso = comprador` | |
| 1.3 | Cadastrar de novo o mesmo e-mail | Erro "e-mail já cadastrado" | |
| 1.4 | Login com senha errada | "E-mail ou senha incorretos" | |
| 1.5 | Login correto | Abre `inicio.html` com saudação e nome reais | |
| 1.6 | Recarregar (F5) qualquer página interna | Continua logado, sem redirecionar ao login | |
| 1.7 | Abrir `backend/auth/sessao.php` sem estar logado | Resposta 401 em JSON | |
| 1.8 | Clicar em **Sair** e voltar com o botão do navegador | Páginas internas redirecionam ao login | |
| 1.9 | Abrir `/backend/config/conexao.php` pela URL | Acesso negado (403) | |

## 2. Produtos (conta A)

| # | Passo | Resultado esperado | OK |
|---|-------|--------------------|----|
| 2.1 | Meus Produtos → Novo Produto (com imagem JPG) | Aparece na lista com a imagem | |
| 2.2 | Recarregar a página | Produto e imagem continuam | |
| 2.3 | Editar preço, descrição e quantidade | Valores novos após recarregar | |
| 2.4 | Tentar enviar um arquivo que não é imagem | Erro "Envie uma imagem JPG, PNG ou WEBP" | |
| 2.5 | Cadastrar com quantidade 0 e outro com 5 | Status "Esgotado" e "Baixo estoque" | |
| 2.6 | Pesquisar por nome + filtrar categoria | Os dois filtros funcionam juntos | |
| 2.7 | Excluir um produto | Some da lista e não volta após recarregar | |

## 3. Início

| # | Passo | Resultado esperado | OK |
|---|-------|--------------------|----|
| 3.1 | Abrir Início na conta A | Produtos reais em destaque; contador "Produtos" = quantidade em Meus Produtos | |
| 3.2 | Contador "Estoque" | Soma das quantidades dos produtos da conta A | |
| 3.3 | Clicar numa categoria / limpar clicando de novo | Filtra e volta | |
| 3.4 | Digitar na pesquisa | Filtra os produtos | |
| 3.5 | Logar na conta B | Vê os produtos da conta A com o botão **Fazer pedido** | |

## 4. Pedidos (A vende, B compra)

| # | Passo | Resultado esperado | OK |
|---|-------|--------------------|----|
| 4.1 | B: Fazer pedido de 3 unidades | Mensagem de sucesso; total correto na janela | |
| 4.2 | B: pedir mais que o estoque | Erro "Estoque insuficiente" | |
| 4.3 | A: tentar pedir o próprio produto | Botão aparece como "Seu produto" | |
| 4.4 | Estoque do produto (conta A) | Diminuiu 3 unidades | |
| 4.5 | Pedidos em A e em B | O pedido aparece nas duas contas (A como "venda", B como "compra") | |
| 4.6 | A: mudar para "Em preparo" e depois "Entregue" | Status persiste após recarregar | |
| 4.7 | B: tentar mudar status de pedido em preparo | Sem opções de alteração | |
| 4.8 | B: novo pedido e cancelar enquanto "Recebido" | Estoque volta ao valor anterior | |
| 4.9 | Resumo de pedidos no Início | Números iguais aos da página Pedidos | |

## 5. Estoque (conta A)

| # | Passo | Resultado esperado | OK |
|---|-------|--------------------|----|
| 5.1 | Estoque lista os mesmos produtos de Meus Produtos | Mesmos nomes e quantidades | |
| 5.2 | Alterar uma quantidade e recarregar | Valor persiste | |
| 5.3 | Conferir o mesmo produto em Meus Produtos e Início | Mesma quantidade | |
| 5.4 | Alterar para 0 / 5 / 50 | Status Sem estoque / Baixo / Normal; cartões atualizam | |
| 5.5 | Busca e filtros | Funcionam juntos, sem divergência | |

## 6. Favoritos

| # | Passo | Resultado esperado | OK |
|---|-------|--------------------|----|
| 6.1 | B: favoritar 2 produtos no Início | Coração preenchido | |
| 6.2 | B: abrir Favoritos | Os 2 produtos aparecem, com dados atuais | |
| 6.3 | Recarregar | Continuam | |
| 6.4 | Remover 1 e recarregar | Não reaparece | |
| 6.5 | Entrar na conta A | Lista de favoritos vazia (não compartilha com B) | |
| 6.6 | A exclui um produto favoritado por B | B abre Favoritos sem erro; o produto some | |
| 6.7 | Estoque de um favorito em 0 | Aparece como "Indisponível" | |
| 6.8 | Limpar Favoritos | Lista fica vazia e persiste | |

## 7. Negociações (demonstração)

| # | Passo | Resultado esperado | OK |
|---|-------|--------------------|----|
| 7.1 | Abrir Negociações | Aviso "Modo demonstração" visível; nome do usuário real no topo | |
| 7.2 | Abrir uma conversa e enviar mensagem | Funciona localmente (não é chat real) | |

## 8. Segurança (conta B logada)

| # | Passo | Resultado esperado | OK |
|---|-------|--------------------|----|
| 8.1 | No console, enviar `editar.php` / `excluir.php` com o `id` de um produto da conta A | Resposta 404 "Produto não encontrado" | |
| 8.2 | Enviar `estoque.php` (POST) com o `id` de um produto da conta A | 404 | |
| 8.3 | Chamar `pedidos/atualizar.php` para um pedido que não é seu | 404 | |
| 8.4 | Nome de produto com `<b>teste</b>` | Aparece como texto, sem formatar | |
| 8.5 | Abrir `/uploads/produtos/` | Sem listagem de arquivos | |

Exemplo para o console do navegador (itens 8.1 a 8.3), trocando `ID`:

```js
const f = new FormData(); f.append("id", ID);
fetch("../../backend/produtos/excluir.php", { method: "POST", body: f }).then(r => r.json()).then(console.log);
```

## Resultado

Total de itens: ___ | Aprovados: ___ | Reprovados: ___

Itens reprovados (número, mensagem de erro):
