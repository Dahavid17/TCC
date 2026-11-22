// Aba "Produtos" (produtos.html): todos os produtos à venda, com filtro por categoria,
// filtro de promoções e pesquisa. Os cartões vêm do vitrine.js.

document.addEventListener("DOMContentLoaded", async () => {

    const API = "../../backend/";

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

    const campoBusca = document.getElementById("pesquisa");
    const lista = document.getElementById("listaProdutos");
    const contagem = document.getElementById("contagemProdutos");
    const botoesFiltro = document.querySelectorAll("#filtrosProdutos button");
    const temaBtn = document.getElementById("temaBtn");

    /* ---------- Modo escuro (mesma chave das outras páginas) ---------- */

    if (localStorage.getItem("marketplace:tema") === "dark") {
        document.body.classList.add("dark");
        temaBtn?.querySelector("i")?.classList.replace("bi-moon-stars-fill", "bi-sun-fill");
    }

    temaBtn?.addEventListener("click", () => {
        const dark = document.body.classList.toggle("dark");
        temaBtn.querySelector("i").className = dark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
        localStorage.setItem("marketplace:tema", dark ? "dark" : "light");
    });

    document.getElementById("btnMensagens")?.addEventListener("click", () => {
        window.location.href = "negociacoes.html";
    });

    /* ---------- Sessão e topo ---------- */

    let usuario;

    try {
        usuario = (await chamarApi("auth/sessao.php")).usuario;
    } catch (error) {
        console.error("Erro ao verificar sessão:", error);
        return;
    }

    const primeiroNome = usuario.nome.split(" ")[0];
    const tipo = usuario.tipo_acesso || "";
    document.getElementById("nomeUsuario").textContent = primeiroNome;
    document.getElementById("tipoUsuario").textContent = tipo.charAt(0).toUpperCase() + tipo.slice(1);
    const avatar = document.getElementById("avatarUsuario");
    avatar.textContent = primeiroNome.charAt(0).toUpperCase(); // menu.js troca pela foto, se houver

    /* ---------- Produtos ---------- */

    let produtos = [];
    let filtro = "";
    const favoritosIds = new Set();

    const vitrine = Vitrine.criar({
        lista,
        usuarioId: usuario.id,
        favoritosIds,
        aoComprar: async () => {
            await carregar();
            mostrar();
        }
    });

    // Filtro e pesquisa podem vir na URL: produtos.html?categoria=frutas ou ?categoria=promocao
    const daUrl = new URLSearchParams(location.search).get("categoria");
    if (daUrl && [...botoesFiltro].some(b => b.dataset.categoria === daUrl)) filtro = daUrl;

    async function carregar() {
        try {
            const [dadosCatalogo, dadosFavoritos] = await Promise.all([
                chamarApi("produtos/listar.php?escopo=catalogo"),
                chamarApi("favoritos/listar.php")
            ]);

            produtos = dadosCatalogo.produtos;
            favoritosIds.clear();
            dadosFavoritos.produtos.forEach(p => favoritosIds.add(p.id));
        } catch (error) {
            console.error("Erro ao carregar produtos:", error);
            contagem.textContent = "";
            lista.innerHTML = `<p class="estado-vazio">Não foi possível carregar os produtos.</p>`;
            throw error;
        }
    }

    function mostrar() {
        const termo = campoBusca.value.trim().toLowerCase();

        const visiveis = produtos.filter(p =>
            p.nome.toLowerCase().includes(termo) &&
            (filtro === "" || (filtro === "promocao" ? p.em_promocao : p.categoria === filtro))
        );

        botoesFiltro.forEach(b => b.classList.toggle("ativa", b.dataset.categoria === filtro));

        contagem.textContent = visiveis.length === 1
            ? "1 produto"
            : `${visiveis.length} produtos`;

        vitrine.mostrar(
            visiveis,
            produtos.length === 0 ? "Ainda não há produtos cadastrados." : "Nenhum produto encontrado."
        );
    }

    botoesFiltro.forEach(botao => {
        botao.addEventListener("click", () => {
            filtro = botao.dataset.categoria;
            mostrar();
        });
    });

    campoBusca.addEventListener("input", mostrar);
    campoBusca.closest("form")?.addEventListener("submit", e => e.preventDefault());

    try {
        await carregar();
        mostrar();
    } catch {
        // mensagem de erro já está na tela
    }
});
