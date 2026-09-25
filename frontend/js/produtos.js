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

    if (usuario.tipo === "Comprador") {

        document.getElementById("areaProdutor").classList.add("hidden");
        document.getElementById("areaComprador").classList.remove("hidden");

        return;
    }

    /* ======================================================
       ELEMENTOS
    ====================================================== */

    const modal = document.getElementById("modalProduto");
    const form = document.getElementById("formProduto");
    const listaProdutos = document.getElementById("listaProdutos");

    const previewImagem = document.getElementById("previewImagem");
    const inputImagem = document.getElementById("imagemProduto");

    const tituloModal = document.getElementById("tituloModal");

    let produtos = JSON.parse(localStorage.getItem("marketplace:produtos")) || [];
    let editando = null;

    /* ======================================================
       FUNÇÕES
    ====================================================== */

    function salvarProdutos() {

        localStorage.setItem(
            "marketplace:produtos",
            JSON.stringify(produtos)
        );

    }

    function atualizarCards() {

        document.getElementById("totalProdutos").textContent = produtos.length;

        document.getElementById("produtosDisponiveis").textContent =
            produtos.filter(p => p.estoque > 10).length;

        document.getElementById("baixoEstoque").textContent =
            produtos.filter(p => p.estoque > 0 && p.estoque <= 10).length;

        document.getElementById("produtosEsgotados").textContent =
            produtos.filter(p => p.estoque === 0).length;

    }

    function obterStatus(estoque) {

        if (estoque === 0) {
            return {
                texto: "Esgotado",
                classe: "esgotado"
            };
        }

        if (estoque <= 10) {
            return {
                texto: "Baixo estoque",
                classe: "baixo"
            };
        }

        return {
            texto: "Disponível",
            classe: "disponivel"
        };
    }

    function renderizar(lista = produtos) {

        listaProdutos.innerHTML = "";

        if (lista.length === 0) {

            listaProdutos.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-box-seam"></i>
                    <h2>Nenhum produto cadastrado</h2>
                    <p>Clique em "Novo Produto" para começar.</p>
                </div>
            `;

            atualizarCards();

            return;
        }

        lista.forEach((produto) => {

            const indiceReal = produtos.findIndex(p => p.id === produto.id);

            const status = obterStatus(produto.estoque);

            listaProdutos.innerHTML += `
                <article class="produto-card">

                    <img src="${produto.imagem || "../../assets/img/produtos/produto-placeholder.jpg"}"
                         alt="${produto.nome}">

                    <div class="produto-info">

                        <span class="categoria">${produto.categoria}</span>

                        <h3>${produto.nome}</h3>

                        <p>${produto.descricao || "Sem descrição."}</p>

                        <strong>R$ ${produto.preco.toFixed(2)}</strong>

                        <div class="produto-meta">

                            <span>${produto.estoque} un.</span>

                            <span class="status ${status.classe}">
                                ${status.texto}
                            </span>

                        </div>

                        <div class="produto-acoes">

                            <button
                                type="button"
                                class="btn-editar"
                                data-id="${indiceReal}">

                                <i class="bi bi-pencil"></i>

                            </button>

                            <button
                                type="button"
                                class="btn-excluir"
                                data-id="${indiceReal}">

                                <i class="bi bi-trash"></i>

                            </button>

                        </div>

                    </div>

                </article>
            `;
        });

        atualizarCards();

    }

    function abrirModal() {

        modal.classList.add("ativo");

    }

    function fecharModal() {

        modal.classList.remove("ativo");

        form.reset();

        previewImagem.src = "";
        previewImagem.style.display = "none";

        editando = null;

        tituloModal.textContent = "Novo Produto";

    }

    renderizar();

    /* ======================================================
       MODAL
    ====================================================== */

    document.getElementById("btnAbrirModalProduto")
        .addEventListener("click", abrirModal);

    document.getElementById("fecharModal")
        .addEventListener("click", fecharModal);

    document.getElementById("cancelarProduto")
        .addEventListener("click", fecharModal);

    modal.addEventListener("click", e => {

        if (e.target === modal) {
            fecharModal();
        }

    });

    /* ======================================================
       PREVIEW
    ====================================================== */

    inputImagem.addEventListener("change", () => {

        const arquivo = inputImagem.files[0];

        if (!arquivo) {

            previewImagem.style.display = "none";

            return;
        }

        previewImagem.src = URL.createObjectURL(arquivo);
        previewImagem.style.display = "block";

    });

    /* ======================================================
       SALVAR
    ====================================================== */

    form.addEventListener("submit", e => {

        e.preventDefault();

        const produto = {

            id: editando !== null
                ? produtos[editando].id
                : Date.now(),

            nome: document.getElementById("nomeProduto").value.trim(),

            categoria: document.getElementById("categoriaProduto").value,

            preco: Number(document.getElementById("precoProduto").value),

            estoque: Number(document.getElementById("estoqueProduto").value),

            descricao: document.getElementById("descricaoProduto").value.trim(),

            imagem:
                previewImagem.style.display === "block"
                    ? previewImagem.src
                    : ""

        };

        if (!produto.nome) {

            alert("Digite o nome do produto.");

            return;
        }

        if (editando !== null) {

            produtos[editando] = produto;

        } else {

            produtos.push(produto);

        }

        salvarProdutos();

        renderizar();

        fecharModal();

    });

    /* ======================================================
       EDITAR E EXCLUIR
    ====================================================== */

    listaProdutos.addEventListener("click", e => {

        const btnEditar = e.target.closest(".btn-editar");
        const btnExcluir = e.target.closest(".btn-excluir");

        if (btnEditar) {

            editando = Number(btnEditar.dataset.id);

            const produto = produtos[editando];

            tituloModal.textContent = "Editar Produto";

            document.getElementById("nomeProduto").value = produto.nome;
            document.getElementById("categoriaProduto").value = produto.categoria;
            document.getElementById("precoProduto").value = produto.preco;
            document.getElementById("estoqueProduto").value = produto.estoque;
            document.getElementById("descricaoProduto").value = produto.descricao;

            if (produto.imagem) {

                previewImagem.src = produto.imagem;
                previewImagem.style.display = "block";

            }

            abrirModal();
        }

        if (btnExcluir) {

            const id = Number(btnExcluir.dataset.id);

            if (confirm("Deseja excluir este produto?")) {

                produtos.splice(id, 1);

                salvarProdutos();

                renderizar();

            }
        }
    });

    /* ======================================================
       PESQUISA
    ====================================================== */

    document.getElementById("pesquisaProduto")
        .addEventListener("input", e => {

            const termo = e.target.value.toLowerCase();

            renderizar(
                produtos.filter(p =>
                    p.nome.toLowerCase().includes(termo)
                )
            );
        });

    /* ======================================================
       FILTROS
    ====================================================== */

    document.getElementById("filtroCategoria")
        .addEventListener("change", aplicarFiltros);

    document.getElementById("filtroEstoque")
        .addEventListener("change", aplicarFiltros);

    function aplicarFiltros() {

        let lista = [...produtos];

        const categoria =
            document.getElementById("filtroCategoria").value;

        const estoque =
            document.getElementById("filtroEstoque").value;

        if (categoria) {

            lista = lista.filter(p => p.categoria === categoria);
        }

        if (estoque === "disponivel") {

            lista = lista.filter(p => p.estoque > 10);
        }

        if (estoque === "baixo") {

            lista = lista.filter(p => p.estoque > 0 && p.estoque <= 10);
        }

        if (estoque === "esgotado") {

            lista = lista.filter(p => p.estoque === 0);
        }

        renderizar(lista);
    }

    /* ======================================================
       NAVEGAÇÃO
    ====================================================== */

    document.getElementById("btnMensagens")
        .addEventListener("click", () => {

            window.location.href = "negociacoes.html";
        });

});