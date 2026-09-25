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
        tipo: "Produtor"
    };

    document.getElementById("nomeUsuario").textContent = usuario.nome;
    document.getElementById("tipoUsuario").textContent = usuario.tipo;
    document.getElementById("avatarUsuario").textContent =
        usuario.nome.charAt(0).toUpperCase();

    /* ======================================================
       DADOS TEMPORÁRIOS
       Depois virão do banco de dados.
    ====================================================== */

    let estoque = JSON.parse(localStorage.getItem("marketplace:estoque")) || [

        {
            id: 1,
            produto: "Tomate Orgânico",
            categoria: "hortalicas",
            quantidade: 50,
            atualizado: "11/09/2026"
        },

        {
            id: 2,
            produto: "Alface Americana",
            categoria: "hortalicas",
            quantidade: 8,
            atualizado: "10/09/2026"
        },

        {
            id: 3,
            produto: "Leite Integral",
            categoria: "laticinios",
            quantidade: 0,
            atualizado: "09/09/2026"
        }

    ];

    let produtoAtual = null;

    const listaEstoque = document.getElementById("listaEstoque");
    const semProdutos = document.getElementById("semProdutos");

    /* ======================================================
       STATUS
    ====================================================== */

    function obterStatus(qtd) {

        if (qtd === 0) {
            return {
                texto: "Sem estoque",
                classe: "esgotado"
            };
        }

        if (qtd <= 10) {
            return {
                texto: "Baixo estoque",
                classe: "baixo"
            };
        }

        return {
            texto: "Normal",
            classe: "normal"
        };
    }

    /* ======================================================
       DASHBOARD
    ====================================================== */

    function atualizarCards() {

        document.getElementById("totalItens").textContent =
            estoque.length;

        document.getElementById("estoqueNormal").textContent =
            estoque.filter(p => p.quantidade > 10).length;

        document.getElementById("baixoEstoque").textContent =
            estoque.filter(p => p.quantidade > 0 && p.quantidade <= 10).length;

        document.getElementById("semEstoque").textContent =
            estoque.filter(p => p.quantidade === 0).length;

    }

    /* ======================================================
       RENDER
    ====================================================== */

    function render(lista = estoque) {

        listaEstoque.innerHTML = "";

        if (lista.length === 0) {

            semProdutos.classList.remove("hidden");

            atualizarCards();

            return;
        }

        semProdutos.classList.add("hidden");

        lista.forEach(item => {

            const status = obterStatus(item.quantidade);

            listaEstoque.innerHTML += `
                <tr>

                    <td>${item.produto}</td>

                    <td>${item.categoria}</td>

                    <td>${item.quantidade}</td>

                    <td>

                        <span class="badge ${status.classe}">
                            ${status.texto}
                        </span>

                    </td>

                    <td>${item.atualizado}</td>

                    <td>

                        <button
                            class="btn-editar"
                            data-id="${item.id}"
                            type="button">

                            <i class="bi bi-pencil"></i>

                        </button>

                    </td>

                </tr>
            `;

        });

        atualizarCards();

    }

    render();

    /* ======================================================
       MODAL
    ====================================================== */

    const modal = document.getElementById("modalEstoque");

    function abrirModal(id) {

        produtoAtual = estoque.find(p => p.id == id);

        document.getElementById("nomeProdutoModal").value =
            produtoAtual.produto;

        document.getElementById("quantidadeEstoque").value =
            produtoAtual.quantidade;

        modal.classList.add("ativo");

    }

    function fecharModal() {

        modal.classList.remove("ativo");

        document.getElementById("formEstoque").reset();

    }

    document.getElementById("fecharModalEstoque")
        .addEventListener("click", fecharModal);

    document.getElementById("cancelarEstoque")
        .addEventListener("click", fecharModal);

    modal.addEventListener("click", e => {

        if (e.target === modal) {

            fecharModal();

        }

    });

    listaEstoque.addEventListener("click", e => {

        const btn = e.target.closest(".btn-editar");

        if (!btn) return;

        abrirModal(btn.dataset.id);

    });

    /* ======================================================
       SALVAR ALTERAÇÃO
    ====================================================== */

    document.getElementById("formEstoque")
        .addEventListener("submit", e => {

            e.preventDefault();

            if (!produtoAtual) return;

            produtoAtual.quantidade =
                Number(document.getElementById("quantidadeEstoque").value);

            produtoAtual.atualizado =
                new Date().toLocaleDateString("pt-BR");

            localStorage.setItem(
                "marketplace:estoque",
                JSON.stringify(estoque)
            );

            render();

            fecharModal();

        });

    /* ======================================================
       PESQUISA
    ====================================================== */

    document.getElementById("pesquisaEstoque")
        .addEventListener("input", e => {

            const termo = e.target.value.toLowerCase();

            render(

                estoque.filter(p =>
                    p.produto.toLowerCase().includes(termo)
                )

            );

        });

    /* ======================================================
       FILTROS
    ====================================================== */

    document.getElementById("filtroCategoria")
        .addEventListener("change", aplicarFiltros);

    document.getElementById("filtroStatus")
        .addEventListener("change", aplicarFiltros);

    function aplicarFiltros() {

        let lista = [...estoque];

        const categoria =
            document.getElementById("filtroCategoria").value;

        const status =
            document.getElementById("filtroStatus").value;

        if (categoria) {

            lista = lista.filter(p => p.categoria === categoria);

        }

        if (status === "normal") {

            lista = lista.filter(p => p.quantidade > 10);

        }

        if (status === "baixo") {

            lista = lista.filter(p =>
                p.quantidade > 0 && p.quantidade <= 10
            );

        }

        if (status === "esgotado") {

            lista = lista.filter(p => p.quantidade === 0);

        }

        render(lista);

    }

    /* ======================================================
       BOTÃO ATUALIZAR
    ====================================================== */

    document.getElementById("btnAtualizarEstoque")
        .addEventListener("click", () => {

            render();

        });

    /* ======================================================
       NAVEGAÇÃO
    ====================================================== */

    document.getElementById("btnMensagens")
        .addEventListener("click", () => {

            window.location.href = "negociacoes.html";

        });

});