document.addEventListener("DOMContentLoaded", () => {

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
       USUÁRIO TEMPORÁRIO
    ====================================================== */

    const usuario = JSON.parse(localStorage.getItem("usuarioLogado")) || {
        nome: "Usuário",
        tipo: "Comprador"
    };

    document.getElementById("nomeUsuario").textContent = usuario.nome;
    document.getElementById("tipoUsuario").textContent = usuario.tipo;
    document.getElementById("avatarUsuario").textContent =
        usuario.nome.charAt(0).toUpperCase();

    /* ======================================================
       DADOS TEMPORÁRIOS
       Depois virão do banco.
    ====================================================== */

    let favoritos = JSON.parse(localStorage.getItem("marketplace:favoritos")) || [

        {
            id: 1,
            nome: "Tomate Orgânico",
            categoria: "hortalicas",
            produtor: "Fazenda Santa Luzia",
            preco: 8.90,
            descricao: "Tomate cultivado sem agrotóxicos.",
            imagem: "img/produto-placeholder.jpg",
            disponivel: true
        },

        {
            id: 2,
            nome: "Leite Integral",
            categoria: "laticinios",
            produtor: "Sítio Boa Esperança",
            preco: 5.50,
            descricao: "Leite fresco produzido diariamente.",
            imagem: "img/produto-placeholder.jpg",
            disponivel: false
        }

    ];

    let favoritoAtual = null;

    const listaFavoritos = document.getElementById("listaFavoritos");
    const semFavoritos = document.getElementById("semFavoritos");

    /* ======================================================
       DASHBOARD
    ====================================================== */

    function atualizarCards() {

        document.getElementById("totalFavoritos").textContent =
            favoritos.length;

        const produtores = [...new Set(favoritos.map(f => f.produtor))];

        document.getElementById("produtoresFavoritos").textContent =
            produtores.length;

        const categorias = [...new Set(favoritos.map(f => f.categoria))];

        document.getElementById("categoriasFavoritas").textContent =
            categorias.length;

        document.getElementById("disponiveisFavoritos").textContent =
            favoritos.filter(f => f.disponivel).length;

    }

    /* ======================================================
       RENDER
    ====================================================== */

    function render(lista = favoritos) {

        listaFavoritos.innerHTML = "";

        if (lista.length === 0) {

            semFavoritos.classList.remove("hidden");

            atualizarCards();

            return;
        }

        semFavoritos.classList.add("hidden");

        lista.forEach(produto => {

            listaFavoritos.innerHTML += `
                <article class="produto-card">

                    <img src="${produto.imagem}" alt="${produto.nome}">

                    <div class="produto-info">

                        <span class="categoria">${produto.categoria}</span>

                        <h3>${produto.nome}</h3>

                        <p>${produto.produtor}</p>

                        <strong>R$ ${produto.preco.toFixed(2)}</strong>

                        <div class="produto-meta">

                            <span class="status ${produto.disponivel ? "disponivel" : "indisponivel"}">

                                ${produto.disponivel ? "Disponível" : "Indisponível"}

                            </span>

                        </div>

                        <div class="produto-acoes">

                            <button
                                class="btn-ver"
                                data-id="${produto.id}"
                                type="button">

                                <i class="bi bi-eye"></i>

                            </button>

                            <button
                                class="btn-remover"
                                data-id="${produto.id}"
                                type="button">

                                <i class="bi bi-heart-fill"></i>

                            </button>

                        </div>

                    </div>

                </article>
            `;

        });

        atualizarCards();

    }

    render();

    /* ======================================================
       MODAL
    ====================================================== */

    const modal = document.getElementById("modalFavorito");

    function abrirModal(id) {

        favoritoAtual = favoritos.find(f => f.id == id);

        document.getElementById("modalImagem").src =
            favoritoAtual.imagem;

        document.getElementById("modalCategoria").textContent =
            favoritoAtual.categoria;

        document.getElementById("modalNome").textContent =
            favoritoAtual.nome;

        document.getElementById("modalProdutor").textContent =
            favoritoAtual.produtor;

        document.getElementById("modalPreco").textContent =
            `R$ ${favoritoAtual.preco.toFixed(2)}`;

        document.getElementById("modalDescricao").textContent =
            favoritoAtual.descricao;

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
       REMOVER
    ====================================================== */

    function removerFavorito(id) {

        favoritos = favoritos.filter(f => f.id !== id);

        localStorage.setItem(
            "marketplace:favoritos",
            JSON.stringify(favoritos)
        );

        render();

        fecharModal();

    }

    document.getElementById("removerFavorito")
        .addEventListener("click", () => {

            if (!favoritoAtual) return;

            removerFavorito(favoritoAtual.id);

        });

    /* ======================================================
       LIMPAR TODOS
    ====================================================== */

    document.getElementById("btnLimparFavoritos")
        .addEventListener("click", () => {

            if (!favoritos.length) return;

            if (!confirm("Deseja remover todos os favoritos?"))
                return;

            favoritos = [];

            localStorage.setItem(
                "marketplace:favoritos",
                JSON.stringify(favoritos)
            );

            render();

        });

    /* ======================================================
       PESQUISA
    ====================================================== */

    document.getElementById("pesquisaFavorito")
        .addEventListener("input", e => {

            const termo = e.target.value.toLowerCase();

            render(

                favoritos.filter(f =>
                    f.nome.toLowerCase().includes(termo) ||
                    f.produtor.toLowerCase().includes(termo)
                )

            );

        });

    /* ======================================================
       FILTROS
    ====================================================== */

    document.getElementById("filtroCategoria")
        .addEventListener("change", aplicarFiltros);

    document.getElementById("filtroDisponibilidade")
        .addEventListener("change", aplicarFiltros);

    function aplicarFiltros() {

        let lista = [...favoritos];

        const categoria =
            document.getElementById("filtroCategoria").value;

        const disponibilidade =
            document.getElementById("filtroDisponibilidade").value;

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

    /* ======================================================
       NEGOCIAÇÃO
    ====================================================== */

    document.getElementById("irNegociacao")
        .addEventListener("click", () => {

            if (!favoritoAtual) return;

            // Futuramente enviará o ID do produto.
            window.location.href = "negociacoes.html";

        });

    document.getElementById("btnMensagens")
        .addEventListener("click", () => {

            window.location.href = "negociacoes.html";

        });

});