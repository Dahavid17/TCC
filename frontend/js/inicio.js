document.addEventListener("DOMContentLoaded", async () => {

    const API = "../../backend/";
    const DESTAQUES = 8;

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
       DADOS REAIS: destaques, catálogo (para a pesquisa) e meus produtos
    ========================================================== */

    let destaques = [];
    let catalogo = [];
    let categoriaAtiva = "";

    const favoritosIds = new Set();
    const tituloProdutos = document.querySelector(".produtos .section-header h2");

    // Cartões, favoritos e "Fazer pedido" ficam em vitrine.js (também usado na aba Produtos).
    const vitrine = Vitrine.criar({
        lista: listaProdutos,
        usuarioId: usuarioLogado.id,
        favoritosIds,
        aoComprar: async () => {
            await carregarDados();
            renderizarProdutos();
        }
    });

    async function carregarDados() {

        try {

            const [dadosDestaques, dadosCatalogo, dadosMeus, dadosPedidos, dadosFavoritos] = await Promise.all([
                chamarApi("produtos/listar.php?escopo=destaques"),
                chamarApi("produtos/listar.php?escopo=catalogo"),
                chamarApi("produtos/listar.php"),
                chamarApi("pedidos/listar.php"),
                chamarApi("favoritos/listar.php")
            ]);

            destaques = dadosDestaques.produtos;
            catalogo = dadosCatalogo.produtos;

            favoritosIds.clear();
            dadosFavoritos.produtos.forEach(p => favoritosIds.add(p.id));

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
       Sem pesquisa: só os destaques (promoções e mais vendidos).
       Com pesquisa ou categoria: procura em todos os produtos.
       A lista completa fica na aba Produtos (produtos.html).
    ========================================================== */

    function renderizarProdutos() {

        const termo = campoBusca.value.trim().toLowerCase();
        const filtrando = termo !== "" || categoriaAtiva !== "";

        if (!filtrando) {
            tituloProdutos.textContent = "Produtos em destaque";
            vitrine.mostrar(destaques.slice(0, DESTAQUES), "Ainda não há produtos em destaque.");
            return;
        }

        tituloProdutos.textContent = "Produtos encontrados";
        vitrine.mostrar(
            catalogo.filter(p =>
                p.nome.toLowerCase().includes(termo) &&
                (!categoriaAtiva || p.categoria === categoriaAtiva)
            ),
            "Nenhum produto encontrado."
        );
    }

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
