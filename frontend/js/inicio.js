document.addEventListener("DOMContentLoaded", async () => {

    const API = "../../backend/";
    const DESTAQUES = 6;
    const NOMES_CATEGORIA = {
        hortalicas: "Hortaliças",
        frutas: "Frutas",
        graos: "Grãos",
        laticinios: "Laticínios",
        carnes: "Carnes",
        flores: "Flores"
    };

    /* ==========================================================
       API
    ========================================================== */

    async function chamarApi(caminho) {

        const resposta = await fetch(API + caminho);
        const dados = await resposta.json();

        if (resposta.status === 401) {
            window.location.href = "login-marketplace.html";
            throw new Error("Sessão expirada");
        }

        if (!resposta.ok || !dados.sucesso) {
            throw new Error(dados.mensagem || "Erro ao comunicar com o servidor.");
        }

        return dados;
    }

    function escapeHtml(texto) {

        const div = document.createElement("div");
        div.textContent = texto ?? "";

        return div.innerHTML.replace(/"/g, "&quot;");
    }

    /* ==========================================================
       VERIFICAÇÃO DE SESSÃO
    ========================================================== */

    let usuarioLogado = null;

    try {

        usuarioLogado = (await chamarApi("auth/sessao.php")).usuario; // { sucesso, usuario }

    } catch (error) {

        console.error("Erro ao verificar sessão:", error);
        return;
    }

    /* ==========================================================
       ELEMENTOS
    ========================================================== */

    const temaBtn = document.getElementById("temaBtn");
    const campoBusca = document.getElementById("pesquisa");
    const botoesCategoria = document.querySelectorAll(".lista-categorias button");
    const listaProdutos = document.getElementById("listaProdutos");
    const linkVerMais = document.querySelector(".produtos .section-header a");
    const linkVerTodas = document.querySelector(".categorias .section-header a");

    /* ==========================================================
       MODO ESCURO
    ========================================================== */

    if (localStorage.getItem("marketplace:tema") === "dark") {
        document.body.classList.add("dark");
        temaBtn?.querySelector("i")?.classList.replace("bi-moon-stars-fill", "bi-sun-fill");
    }

    temaBtn?.addEventListener("click", () => {
        const dark = document.body.classList.toggle("dark");

        temaBtn.querySelector("i").className =
            dark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";

        localStorage.setItem("marketplace:tema", dark ? "dark" : "light");
    });

    /* ==========================================================
       SAUDAÇÃO, NOME E AVATAR (dados da sessão)
    ========================================================== */

    const primeiroNome = usuarioLogado.nome.split(" ")[0];
    const hora = new Date().getHours();
    const saudacao = hora >= 5 && hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

    const titulo = document.querySelector(".hero-content h1");
    if (titulo) {
        titulo.textContent = `${saudacao}, ${primeiroNome}! 👋`;
    }

    document.getElementById("nome-usuario").textContent = primeiroNome;
    document.getElementById("letra-avatar").textContent = primeiroNome.charAt(0).toUpperCase();

    const tipo = usuarioLogado.tipo_acesso || "";
    document.getElementById("tipo-usuario").textContent =
        tipo.charAt(0).toUpperCase() + tipo.slice(1);

    /* ==========================================================
       DADOS REAIS: catálogo (todos) e meus produtos
    ========================================================== */

    let catalogo = [];
    let favoritosIds = new Set();
    let categoriaAtiva = "";
    let mostrarTodos = false;

    async function carregarDados() {

        try {

            const [dadosCatalogo, dadosMeus, dadosPedidos, dadosFavoritos] = await Promise.all([
                chamarApi("produtos/listar.php?escopo=catalogo"),
                chamarApi("produtos/listar.php"),
                chamarApi("pedidos/listar.php"),
                chamarApi("favoritos/listar.php")
            ]);

            catalogo = dadosCatalogo.produtos;
            favoritosIds = new Set(dadosFavoritos.produtos.map(p => p.id));

            document.getElementById("totalProdutos").textContent = dadosMeus.produtos.length;
            document.getElementById("totalEstoque").textContent =
                dadosMeus.produtos.reduce((soma, p) => soma + p.estoque, 0);

            // Mesma fonte e mesma contagem da página Pedidos.
            const pedidos = dadosPedidos.pedidos;
            const contar = status => pedidos.filter(p => p.status === status).length;

            document.getElementById("totalPedidos").textContent = pedidos.length;
            document.getElementById("pedidosRecebidos").textContent = contar("recebido");
            document.getElementById("pedidosNegociacao").textContent = contar("negociacao");
            document.getElementById("pedidosPreparacao").textContent = contar("preparo");
            document.getElementById("pedidosEntregues").textContent = contar("entregue");

        } catch (error) {

            console.error("Erro ao carregar dados:", error);
            listaProdutos.innerHTML = `<p class="estado-vazio">Não foi possível carregar os produtos.</p>`;
        }
    }

    await carregarDados();

    // Contador de negociações; se falhar, o restante da página continua funcionando.
    chamarApi("negociacoes/listar.php")
        .then(dados => {
            document.getElementById("totalNegociacoes").textContent = dados.conversas.length;
        })
        .catch(error => console.error("Erro ao carregar negociações:", error));

    /* ==========================================================
       PRODUTOS EM DESTAQUE
    ========================================================== */

    function renderizarProdutos() {

        const termo = campoBusca.value.trim().toLowerCase();
        const filtrando = termo !== "" || categoriaAtiva !== "";

        let lista = catalogo.filter(p =>
            p.nome.toLowerCase().includes(termo) &&
            (!categoriaAtiva || p.categoria === categoriaAtiva)
        );

        if (!filtrando && !mostrarTodos) {
            lista = lista.slice(0, DESTAQUES);
        }

        if (lista.length === 0) {

            listaProdutos.innerHTML = `<p class="estado-vazio">${
                catalogo.length === 0
                    ? "Ainda não há produtos cadastrados."
                    : "Nenhum produto encontrado."
            }</p>`;

            return;
        }

        listaProdutos.innerHTML = lista.map(produto => {

            const imagem = produto.imagem
                ? "../../" + produto.imagem
                : "../../assets/img/produtos/produto-placeholder.jpg";

            const meu = produto.vendedor_id === usuarioLogado.id;
            const favorito = favoritosIds.has(produto.id);

            return `
                <article class="produto-card">
                    <button type="button" class="btn-favorito" data-favoritar="${produto.id}"
                            aria-label="${favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}">
                        <i class="bi ${favorito ? "bi-heart-fill" : "bi-heart"}"></i>
                    </button>
                    <img src="${escapeHtml(imagem)}" alt="${escapeHtml(produto.nome)}">
                    <div class="produto-info">
                        <h3>${escapeHtml(produto.nome)}</h3>
                        <p>${escapeHtml(NOMES_CATEGORIA[produto.categoria] || produto.categoria)} · ${escapeHtml(produto.vendedor_nome)}</p>
                        <strong>R$ ${produto.preco.toFixed(2).replace(".", ",")}</strong>
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
                </article>
            `;

        }).join("");
    }

    /* ==========================================================
       PEDIDO (compra)
    ========================================================== */

    const modalCompra = document.getElementById("modalCompra");
    const inputQuantidade = document.getElementById("compraQuantidade");
    const btnConfirmar = document.getElementById("compraConfirmar");
    let produtoCompra = null;

    function dinheiro(valor) {
        return "R$ " + valor.toFixed(2).replace(".", ",");
    }

    function atualizarTotalCompra() {
        const qtd = Number(inputQuantidade.value);
        document.getElementById("compraTotal").textContent =
            dinheiro(Number.isInteger(qtd) && qtd > 0 ? qtd * produtoCompra.preco : 0);
    }

    function fecharCompra() {
        modalCompra.classList.remove("ativo");
        produtoCompra = null;
    }

    // Grava no banco e só então atualiza o coração na tela.
    async function alternarFavorito(id, botao) {

        const adicionar = !favoritosIds.has(id);
        const dados = new FormData();

        dados.append("acao", adicionar ? "adicionar" : "remover");
        dados.append("anuncio_id", id);

        botao.disabled = true;

        try {

            const resposta = await fetch(API + "favoritos/atualizar.php", { method: "POST", body: dados });
            const resultado = await resposta.json();

            if (resposta.status === 401) {
                window.location.href = "login-marketplace.html";
                return;
            }

            if (!resposta.ok || !resultado.sucesso) {
                throw new Error(resultado.mensagem || "Não foi possível atualizar os favoritos.");
            }

            if (adicionar) {
                favoritosIds.add(id);
            } else {
                favoritosIds.delete(id);
            }

            renderizarProdutos();

        } catch (error) {

            alert(error.message);
            botao.disabled = false;
        }
    }

    listaProdutos.addEventListener("click", e => {

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

        if (comprar) {
            produtoCompra = catalogo.find(p => p.id === Number(comprar.dataset.comprar));

            if (!produtoCompra) return;

            document.getElementById("compraNome").textContent = produtoCompra.nome;
            document.getElementById("compraInfo").textContent =
                `${dinheiro(produtoCompra.preco)} por unidade · ${produtoCompra.estoque} em estoque · Vendedor: ${produtoCompra.vendedor_nome}`;
            inputQuantidade.max = produtoCompra.estoque;
            inputQuantidade.value = 1;
            atualizarTotalCompra();

            modalCompra.classList.add("ativo");
        }
    });

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

            const resposta = await fetch(API + "pedidos/criar.php", { method: "POST", body: dados });
            const resultado = await resposta.json();

            if (resposta.status === 401) {
                window.location.href = "login-marketplace.html";
                return;
            }

            if (!resposta.ok || !resultado.sucesso) {
                throw new Error(resultado.mensagem || "Não foi possível fazer o pedido.");
            }

            fecharCompra();
            await carregarDados();
            renderizarProdutos();
            alert(resultado.mensagem);

        } catch (error) {

            alert(error.message);

        } finally {

            btnConfirmar.disabled = false;
        }
    });

    /* ==========================================================
       CATEGORIAS E PESQUISA
    ========================================================== */

    botoesCategoria.forEach(botao => {

        botao.addEventListener("click", () => {

            const mesma = botao.dataset.categoria === categoriaAtiva;

            botoesCategoria.forEach(b => b.classList.remove("ativa"));

            categoriaAtiva = mesma ? "" : botao.dataset.categoria;

            if (!mesma) {
                botao.classList.add("ativa");
            }

            renderizarProdutos();
        });
    });

    linkVerTodas?.addEventListener("click", e => {

        e.preventDefault();

        botoesCategoria.forEach(b => b.classList.remove("ativa"));
        categoriaAtiva = "";
        campoBusca.value = "";
        mostrarTodos = true;

        renderizarProdutos();
    });

    linkVerMais?.addEventListener("click", e => {

        e.preventDefault();

        mostrarTodos = !mostrarTodos;
        linkVerMais.textContent = mostrarTodos ? "Ver menos" : "Ver mais";

        renderizarProdutos();
    });

    campoBusca.addEventListener("input", renderizarProdutos);

    campoBusca.closest("form")?.addEventListener("submit", e => e.preventDefault());

    renderizarProdutos();

    /* ==========================================================
       AÇÕES RÁPIDAS E BOTÕES
    ========================================================== */

    const destinos = {
        cardProdutos: "meus-produtos.html",
        cardPedidos: "pedidos.html",
        cardNegociacoes: "negociacoes.html",
        cardEstoque: "estoque.html",
        btnNovoProduto: "meus-produtos.html",
        btnMensagens: "negociacoes.html"
    };

    Object.entries(destinos).forEach(([id, destino]) => {
        document.getElementById(id)?.addEventListener("click", () => {
            window.location.href = destino;
        });
    });

    document.getElementById("btnExplorar")?.addEventListener("click", () => {
        document.querySelector(".produtos").scrollIntoView({ behavior: "smooth" });
    });

    /* ==========================================================
       ONBOARDING (primeiro acesso)
    ========================================================== */

    window.iniciarOnboarding?.(usuarioLogado);

});
