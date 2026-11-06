document.addEventListener("DOMContentLoaded", async () => {

    const API = "../../backend/";
    const LIMITE_BAIXO_ESTOQUE = 10;

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

    // Chama o backend; redireciona ao login se a sessão expirou.
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
       ELEMENTOS
    ====================================================== */

    const modal = document.getElementById("modalProduto");
    const form = document.getElementById("formProduto");
    const listaProdutos = document.getElementById("listaProdutos");

    const previewImagem = document.getElementById("previewImagem");
    const inputImagem = document.getElementById("imagemProduto");

    const tituloModal = document.getElementById("tituloModal");
    const btnSalvar = document.getElementById("salvarProduto");

    let produtos = [];
    let editandoId = null;

    /* ======================================================
       FUNÇÕES
    ====================================================== */

    async function carregarProdutos() {

        try {

            const dados = await chamarApi("produtos/listar.php");

            produtos = dados.produtos;

        } catch (erro) {

            produtos = [];
            alert(erro.message);
        }

        aplicarFiltros();
    }

    function atualizarCards() {

        document.getElementById("totalProdutos").textContent = produtos.length;

        document.getElementById("produtosDisponiveis").textContent =
            produtos.filter(p => p.estoque > LIMITE_BAIXO_ESTOQUE).length;

        document.getElementById("baixoEstoque").textContent =
            produtos.filter(p => p.estoque > 0 && p.estoque <= LIMITE_BAIXO_ESTOQUE).length;

        document.getElementById("produtosEsgotados").textContent =
            produtos.filter(p => p.estoque === 0).length;

    }

    function obterStatus(estoque) {

        if (estoque === 0) {
            return { texto: "Esgotado", classe: "esgotado" };
        }

        if (estoque <= LIMITE_BAIXO_ESTOQUE) {
            return { texto: "Baixo estoque", classe: "baixo" };
        }

        return { texto: "Disponível", classe: "disponivel" };
    }

    function renderizar(lista) {

        atualizarCards();

        if (lista.length === 0) {

            listaProdutos.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-box-seam"></i>
                    <h2>Nenhum produto encontrado</h2>
                    <p>Clique em "Novo Produto" para começar.</p>
                </div>
            `;

            return;
        }

        listaProdutos.innerHTML = lista.map((produto) => {

            const status = obterStatus(produto.estoque);

            return `
                <article class="produto-card">

                    <img src="${escapeHtml(urlImagem(produto.imagem))}"
                         alt="${escapeHtml(produto.nome)}">

                    <div class="produto-info">

                        <span class="categoria">${escapeHtml(produto.categoria)}</span>

                        <h3>${escapeHtml(produto.nome)}</h3>

                        <p>${escapeHtml(produto.descricao) || "Sem descrição."}</p>

                        <strong>R$ ${produto.preco.toFixed(2)}</strong>

                        <div class="produto-meta">

                            <span>${produto.estoque} un.</span>

                            <span class="status ${status.classe}">
                                ${status.texto}
                            </span>

                        </div>

                        <div class="produto-acoes">

                            <button type="button" class="btn-editar" data-id="${produto.id}">
                                <i class="bi bi-pencil"></i>
                            </button>

                            <button type="button" class="btn-excluir" data-id="${produto.id}">
                                <i class="bi bi-trash"></i>
                            </button>

                        </div>

                    </div>

                </article>
            `;

        }).join("");

    }

    // Pesquisa e filtros funcionam juntos sobre a mesma lista.
    function aplicarFiltros() {

        const termo = document.getElementById("pesquisaProduto").value.trim().toLowerCase();
        const categoria = document.getElementById("filtroCategoria").value;
        const estoque = document.getElementById("filtroEstoque").value;

        let lista = produtos.filter(p => p.nome.toLowerCase().includes(termo));

        if (categoria) {
            lista = lista.filter(p => p.categoria === categoria);
        }

        if (estoque === "disponivel") {
            lista = lista.filter(p => p.estoque > LIMITE_BAIXO_ESTOQUE);
        }

        if (estoque === "baixo") {
            lista = lista.filter(p => p.estoque > 0 && p.estoque <= LIMITE_BAIXO_ESTOQUE);
        }

        if (estoque === "esgotado") {
            lista = lista.filter(p => p.estoque === 0);
        }

        renderizar(lista);
    }

    function abrirModal() {

        modal.classList.add("ativo");

    }

    function fecharModal() {

        modal.classList.remove("ativo");

        form.reset();

        previewImagem.src = "";
        previewImagem.style.display = "none";

        editandoId = null;

        tituloModal.textContent = "Novo Produto";

    }

    await carregarProdutos();

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
       PREVIEW (apenas visual; a imagem é enviada ao salvar)
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

    form.addEventListener("submit", async e => {

        e.preventDefault();

        const nome = document.getElementById("nomeProduto").value.trim();

        if (!nome) {

            alert("Digite o nome do produto.");

            return;
        }

        const dados = new FormData();

        dados.append("nome", nome);
        dados.append("categoria", document.getElementById("categoriaProduto").value);
        dados.append("preco", document.getElementById("precoProduto").value);
        dados.append("estoque", document.getElementById("estoqueProduto").value);
        dados.append("descricao", document.getElementById("descricaoProduto").value.trim());

        if (inputImagem.files[0]) {
            dados.append("imagem", inputImagem.files[0]);
        }

        if (editandoId !== null) {
            dados.append("id", editandoId);
        }

        const endpoint = editandoId !== null
            ? "produtos/editar.php"
            : "produtos/cadastrar.php";

        btnSalvar.disabled = true;

        try {

            await chamarApi(endpoint, { method: "POST", body: dados });

            fecharModal();

            await carregarProdutos();

        } catch (erro) {

            alert(erro.message);

        } finally {

            btnSalvar.disabled = false;
        }

    });

    /* ======================================================
       EDITAR E EXCLUIR
    ====================================================== */

    listaProdutos.addEventListener("click", async e => {

        const btnEditar = e.target.closest(".btn-editar");
        const btnExcluir = e.target.closest(".btn-excluir");

        if (btnEditar) {

            const produto = produtos.find(p => p.id === Number(btnEditar.dataset.id));

            if (!produto) {
                return;
            }

            editandoId = produto.id;

            tituloModal.textContent = "Editar Produto";

            document.getElementById("nomeProduto").value = produto.nome;
            document.getElementById("categoriaProduto").value = produto.categoria;
            document.getElementById("precoProduto").value = produto.preco;
            document.getElementById("estoqueProduto").value = produto.estoque;
            document.getElementById("descricaoProduto").value = produto.descricao;

            if (produto.imagem) {

                previewImagem.src = urlImagem(produto.imagem);
                previewImagem.style.display = "block";

            }

            abrirModal();
        }

        if (btnExcluir) {

            const id = Number(btnExcluir.dataset.id);

            if (!confirm("Deseja excluir este produto?")) {
                return;
            }

            const dados = new FormData();
            dados.append("id", id);

            try {

                await chamarApi("produtos/excluir.php", { method: "POST", body: dados });

                await carregarProdutos();

            } catch (erro) {

                alert(erro.message);
            }
        }
    });

    /* ======================================================
       PESQUISA E FILTROS
    ====================================================== */

    document.getElementById("pesquisaProduto")
        .addEventListener("input", aplicarFiltros);

    document.getElementById("formPesquisaProdutos")
        .addEventListener("submit", e => e.preventDefault());

    document.getElementById("filtroCategoria")
        .addEventListener("change", aplicarFiltros);

    document.getElementById("filtroEstoque")
        .addEventListener("change", aplicarFiltros);

    /* ======================================================
       NAVEGAÇÃO
    ====================================================== */

    document.getElementById("btnMensagens")
        .addEventListener("click", () => {

            window.location.href = "negociacoes.html";
        });

});
