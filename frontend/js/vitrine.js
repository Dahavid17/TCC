// Cartões de produto usados no Início (destaques) e na aba Produtos.
// Cuida do preço com promoção, do coração de favorito e da janela "Fazer pedido".
// A página precisa ter o #modalCompra (mesmo HTML do inicio.html).
//
// Uso:
//   const vitrine = Vitrine.criar({ lista: elemento, usuarioId, favoritosIds, aoComprar });
//   vitrine.mostrar(produtos, "Mensagem quando a lista está vazia");

(function () {
    const API = "../../backend/";

    const NOMES_CATEGORIA = {
        hortalicas: "Hortaliças",
        frutas: "Frutas",
        graos: "Grãos",
        laticinios: "Laticínios",
        carnes: "Carnes",
        flores: "Flores"
    };

    function dinheiro(valor) {
        return "R$ " + Number(valor).toFixed(2).replace(".", ",");
    }

    function escapeHtml(texto) {
        const div = document.createElement("div");
        div.textContent = texto ?? "";
        return div.innerHTML.replace(/"/g, "&quot;");
    }

    // Promoção: preço normal riscado de vermelho e o preço novo em destaque ao lado.
    function precoHtml(produto) {
        if (!produto.em_promocao) {
            return `<strong class="preco-atual">${dinheiro(produto.preco)}</strong>`;
        }

        return `
            <div class="precos">
                <s class="preco-antigo" aria-label="Preço normal">${dinheiro(produto.preco_base)}</s>
                <strong class="preco-atual preco-promocao" aria-label="Preço na promoção">${dinheiro(produto.preco)}</strong>
            </div>`;
    }

    function seloHtml(produto) {
        if (produto.em_promocao) {
            return `<span class="selo-produto selo-promocao"><i class="bi bi-tag-fill"></i> Promoção${produto.desconto ? ` −${produto.desconto}%` : ""}</span>`;
        }
        if (produto.vendidos > 0 && produto.destaque) {
            return `<span class="selo-produto selo-vendido"><i class="bi bi-fire"></i> Mais vendido</span>`;
        }
        return "";
    }

    function cartaoHtml(produto, usuarioId, favoritosIds) {
        const imagem = produto.imagem
            ? "../../" + produto.imagem
            : "../../assets/img/produtos/produto-placeholder.jpg";

        const meu = produto.vendedor_id === usuarioId;
        const favorito = favoritosIds.has(produto.id);

        return `
            <article class="produto-card${produto.em_promocao ? " em-promocao" : ""}">
                ${seloHtml(produto)}
                <button type="button" class="btn-favorito" data-favoritar="${produto.id}"
                        aria-label="${favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}">
                    <i class="bi ${favorito ? "bi-heart-fill" : "bi-heart"}"></i>
                </button>
                <img src="${escapeHtml(imagem)}" alt="${escapeHtml(produto.nome)}">
                <div class="produto-info">
                    <h3>${escapeHtml(produto.nome)}</h3>
                    <p>${escapeHtml(NOMES_CATEGORIA[produto.categoria] || produto.categoria)} · ${escapeHtml(produto.vendedor_nome)}</p>
                    ${precoHtml(produto)}
                    ${meu
                        ? `<button class="btn-comprar" data-ir="meus-produtos.html">Seu produto</button>`
                        : `<div class="produto-acoes">
                               ${produto.estoque === 0
                                   ? `<button class="btn-comprar" disabled>Esgotado</button>`
                                   : `<button class="btn-comprar" data-comprar="${produto.id}">Fazer pedido</button>`}
                               <button class="btn-negociar" data-ir="negociacoes.html?anuncio=${produto.id}">
                                   <i class="bi bi-chat-dots"></i> Negociar
                               </button>
                           </div>`}
                </div>
            </article>`;
    }

    function criar({ lista, usuarioId, favoritosIds, aoComprar }) {
        let produtos = [];
        let vazio = "Nenhum produto encontrado.";

        function mostrar(novos, mensagemVazia) {
            produtos = novos;
            if (mensagemVazia) vazio = mensagemVazia;

            lista.innerHTML = produtos.length === 0
                ? `<p class="estado-vazio">${escapeHtml(vazio)}</p>`
                : produtos.map(p => cartaoHtml(p, usuarioId, favoritosIds)).join("");
        }

        async function postar(caminho, dados) {
            const resposta = await fetch(API + caminho, { method: "POST", body: dados });
            const resultado = await resposta.json();

            if (resposta.status === 401) {
                window.location.href = "login-marketplace.html";
                throw new Error("Sessão expirada");
            }
            if (!resposta.ok || !resultado.sucesso) {
                throw new Error(resultado.mensagem || "Erro ao comunicar com o servidor.");
            }
            return resultado;
        }

        // Grava no banco e só então atualiza o coração na tela.
        async function alternarFavorito(id, botao) {
            const adicionar = !favoritosIds.has(id);
            const dados = new FormData();
            dados.append("acao", adicionar ? "adicionar" : "remover");
            dados.append("anuncio_id", id);

            botao.disabled = true;

            try {
                await postar("favoritos/atualizar.php", dados);
                adicionar ? favoritosIds.add(id) : favoritosIds.delete(id);
                mostrar(produtos);
            } catch (error) {
                if (error.message !== "Sessão expirada") alert(error.message);
                botao.disabled = false;
            }
        }

        /* ---------- Janela "Fazer pedido" ---------- */

        const modalCompra = document.getElementById("modalCompra");
        const inputQuantidade = document.getElementById("compraQuantidade");
        const btnConfirmar = document.getElementById("compraConfirmar");
        let produtoCompra = null;

        function atualizarTotalCompra() {
            const qtd = Number(inputQuantidade.value);
            document.getElementById("compraTotal").textContent =
                dinheiro(Number.isInteger(qtd) && qtd > 0 ? qtd * produtoCompra.preco : 0);
        }

        function fecharCompra() {
            modalCompra.classList.remove("ativo");
            produtoCompra = null;
        }

        function abrirCompra(id) {
            produtoCompra = produtos.find(p => p.id === id);
            if (!produtoCompra) return;

            const preco = produtoCompra.em_promocao
                ? `${dinheiro(produtoCompra.preco)} por unidade (promoção, antes ${dinheiro(produtoCompra.preco_base)})`
                : `${dinheiro(produtoCompra.preco)} por unidade`;

            document.getElementById("compraNome").textContent = produtoCompra.nome;
            document.getElementById("compraInfo").textContent =
                `${preco} · ${produtoCompra.estoque} em estoque · Vendedor: ${produtoCompra.vendedor_nome}`;
            inputQuantidade.max = produtoCompra.estoque;
            inputQuantidade.value = 1;
            atualizarTotalCompra();

            modalCompra.classList.add("ativo");
        }

        inputQuantidade.addEventListener("input", atualizarTotalCompra);
        document.getElementById("compraCancelar").addEventListener("click", fecharCompra);
        modalCompra.addEventListener("click", e => {
            if (e.target === modalCompra) fecharCompra();
        });

        btnConfirmar.addEventListener("click", async () => {
            if (!produtoCompra) return;

            const dados = new FormData();
            dados.append("anuncio_id", produtoCompra.id);
            dados.append("quantidade", inputQuantidade.value);

            btnConfirmar.disabled = true;

            try {
                const resultado = await postar("pedidos/criar.php", dados);
                fecharCompra();
                await aoComprar?.();
                alert(resultado.mensagem);
            } catch (error) {
                if (error.message !== "Sessão expirada") alert(error.message);
            } finally {
                btnConfirmar.disabled = false;
            }
        });

        /* ---------- Cliques nos cartões ---------- */

        lista.addEventListener("click", e => {
            const irPara = e.target.closest("[data-ir]");
            if (irPara) {
                window.location.href = irPara.dataset.ir;
                return;
            }

            const favoritar = e.target.closest("[data-favoritar]");
            if (favoritar) {
                alternarFavorito(Number(favoritar.dataset.favoritar), favoritar);
                return;
            }

            const comprar = e.target.closest("[data-comprar]");
            if (comprar) abrirCompra(Number(comprar.dataset.comprar));
        });

        return { mostrar };
    }

    window.Vitrine = { criar, dinheiro, escapeHtml, precoHtml, NOMES_CATEGORIA };
})();
