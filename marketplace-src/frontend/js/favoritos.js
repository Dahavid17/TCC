document.addEventListener("DOMContentLoaded", async () => {

    const API = "../../backend/";

    const NOMES_CATEGORIA = {
        hortalicas: "Hortaliças",
        frutas: "Frutas",
        graos: "Grãos",
        laticinios: "Laticínios",
        carnes: "Carnes",
        flores: "Flores"
    };

    /* ======================================================
       TEMA
    ====================================================== */

    const temaBtn = document.getElementById("temaBtn");

    if (localStorage.getItem("marketplace:tema") === "dark") {
        document.body.classList.add("dark");
        temaBtn.querySelector("i").className = "bi bi-sun-fill";
    }

    temaBtn.addEventListener("click", () => {

        document.body.classList.toggle("dark");

        const dark = document.body.classList.contains("dark");

        temaBtn.querySelector("i").className =
            dark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";

        localStorage.setItem("marketplace:tema", dark ? "dark" : "light");

    });

    /* ======================================================
       API
    ====================================================== */

    async function chamarApi(caminho, opcoes = {}) {

        const resposta = await fetch(API + caminho, opcoes);

        let dados = {};

        try {
            dados = await resposta.json();
        } catch (erro) {
            dados = { sucesso: false, mensagem: "Resposta inválida do servidor." };
        }

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

    function urlImagem(caminho) {

        return caminho
            ? "../../" + caminho
            : "../../assets/img/produtos/produto-placeholder.jpg";
    }

    function dinheiro(valor) {

        return "R$ " + valor.toFixed(2).replace(".", ",");
    }

    function nomeCategoria(slug) {

        return NOMES_CATEGORIA[slug] || slug;
    }

    /* ======================================================
       USUÁRIO (sessão do servidor)
    ====================================================== */

    try {

        const { usuario } = await chamarApi("auth/sessao.php");

        const tipo = usuario.tipo_acesso || "";

        document.getElementById("nomeUsuario").textContent = usuario.nome;
        document.getElementById("tipoUsuario").textContent =
            tipo.charAt(0).toUpperCase() + tipo.slice(1);
        document.getElementById("avatarUsuario").textContent =
            usuario.nome.charAt(0).toUpperCase();

    } catch (erro) {

        console.error("Erro ao verificar sessão:", erro);
        return;
    }

    /* ======================================================
       ESTADO E ELEMENTOS
    ====================================================== */

    let favoritos = [];
    let favoritoAtual = null;

    const listaFavoritos = document.getElementById("listaFavoritos");
    const semFavoritos = document.getElementById("semFavoritos");
    const modal = document.getElementById("modalFavorito");

    /* ======================================================
       CARDS
    ====================================================== */

    function atualizarCards() {

        document.getElementById("totalFavoritos").textContent = favoritos.length;

        document.getElementById("produtoresFavoritos").textContent =
            new Set(favoritos.map(f => f.vendedor_id)).size;

        document.getElementById("categoriasFavoritas").textContent =
            new Set(favoritos.map(f => f.categoria)).size;

        document.getElementById("disponiveisFavoritos").textContent =
            favoritos.filter(f => f.disponivel).length;

    }

    /* ======================================================
       RENDER
    ====================================================== */

    function render(lista) {

        atualizarCards();

        if (lista.length === 0) {

            listaFavoritos.innerHTML = "";
            semFavoritos.classList.remove("hidden");

            return;
        }

        semFavoritos.classList.add("hidden");

        listaFavoritos.innerHTML = lista.map(produto => `
            <article class="produto-card">

                <img src="${escapeHtml(urlImagem(produto.imagem))}"
                     alt="${escapeHtml(produto.nome)}">

                <div class="produto-info">

                    <span class="categoria">${escapeHtml(nomeCategoria(produto.categoria))}</span>

                    <h3>${escapeHtml(produto.nome)}</h3>

                    <p>${escapeHtml(produto.vendedor_nome)}</p>

                    <strong>${dinheiro(produto.preco)}</strong>

                    <div class="produto-meta">

                        <span class="status ${produto.disponivel ? "disponivel" : "indisponivel"}">
                            ${produto.disponivel ? "Disponível" : "Indisponível"}
                        </span>

                    </div>

                    <div class="produto-acoes">

                        <button class="btn-ver" data-id="${produto.id}" type="button">
                            <i class="bi bi-eye"></i>
                        </button>

                        <button class="btn-remover" data-id="${produto.id}" type="button">
                            <i class="bi bi-heart-fill"></i>
                        </button>

                    </div>

                </div>

            </article>
        `).join("");

    }

    // Pesquisa e filtros funcionam juntos.
    function aplicarFiltros() {

        const termo = document.getElementById("pesquisaFavorito").value.trim().toLowerCase();
        const categoria = document.getElementById("filtroCategoria").value;
        const disponibilidade = document.getElementById("filtroDisponibilidade").value;

        let lista = favoritos.filter(f =>
            f.nome.toLowerCase().includes(termo) ||
            f.vendedor_nome.toLowerCase().includes(termo)
        );

        if (categoria) {
            lista = lista.filter(f => f.categoria === categoria);
        }

        if (disponibilidade === "disponivel") {
            lista = lista.filter(f => f.disponivel);
        }

        if (disponibilidade === "indisponivel") {
            lista = lista.filter(f => !f.disponivel);
        }

        render(lista);

    }

    async function carregarFavoritos() {

        try {

            favoritos = (await chamarApi("favoritos/listar.php")).produtos;

        } catch (erro) {

            favoritos = [];
            alert(erro.message);
        }

        aplicarFiltros();
    }

    await carregarFavoritos();

    /* ======================================================
       MODAL
    ====================================================== */

    function abrirModal(id) {

        favoritoAtual = favoritos.find(f => f.id === Number(id));

        if (!favoritoAtual) return;

        document.getElementById("modalImagem").src = urlImagem(favoritoAtual.imagem);
        document.getElementById("modalCategoria").textContent = nomeCategoria(favoritoAtual.categoria);
        document.getElementById("modalNome").textContent = favoritoAtual.nome;
        document.getElementById("modalProdutor").textContent = favoritoAtual.vendedor_nome;
        document.getElementById("modalPreco").textContent = dinheiro(favoritoAtual.preco);
        document.getElementById("modalDescricao").textContent =
            favoritoAtual.descricao || "Sem descrição.";

        modal.classList.add("ativo");

    }

    function fecharModal() {

        modal.classList.remove("ativo");

    }

    document.getElementById("fecharModalFavorito")
        .addEventListener("click", fecharModal);

    modal.addEventListener("click", e => {

        if (e.target === modal) {
            fecharModal();
        }

    });

    listaFavoritos.addEventListener("click", e => {

        const btnVer = e.target.closest(".btn-ver");
        const btnRemover = e.target.closest(".btn-remover");

        if (btnVer) {
            abrirModal(btnVer.dataset.id);
        }

        if (btnRemover) {
            removerFavorito(Number(btnRemover.dataset.id));
        }

    });

    /* ======================================================
       REMOVER E LIMPAR (gravam no banco)
    ====================================================== */

    async function atualizarFavoritos(dados) {

        try {

            await chamarApi("favoritos/atualizar.php", { method: "POST", body: dados });

            fecharModal();

            await carregarFavoritos();

        } catch (erro) {

            alert(erro.message);
        }
    }

    function removerFavorito(id) {

        const dados = new FormData();
        dados.append("acao", "remover");
        dados.append("anuncio_id", id);

        return atualizarFavoritos(dados);
    }

    document.getElementById("removerFavorito")
        .addEventListener("click", () => {

            if (favoritoAtual) {
                removerFavorito(favoritoAtual.id);
            }

        });

    document.getElementById("btnLimparFavoritos")
        .addEventListener("click", () => {

            if (!favoritos.length) return;

            if (!confirm("Deseja remover todos os favoritos?")) return;

            const dados = new FormData();
            dados.append("acao", "limpar");

            atualizarFavoritos(dados);

        });

    /* ======================================================
       PESQUISA E FILTROS
    ====================================================== */

    document.getElementById("pesquisaFavorito")
        .addEventListener("input", aplicarFiltros);

    document.getElementById("filtroCategoria")
        .addEventListener("change", aplicarFiltros);

    document.getElementById("filtroDisponibilidade")
        .addEventListener("change", aplicarFiltros);

    /* ======================================================
       NEGOCIAÇÃO (demonstração)
    ====================================================== */

    document.getElementById("irNegociacao")
        .addEventListener("click", () => {

            window.location.href = "negociacoes.html";

        });

    document.getElementById("btnMensagens")
        .addEventListener("click", () => {

            window.location.href = "negociacoes.html";

        });

});
