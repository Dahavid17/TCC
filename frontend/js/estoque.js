document.addEventListener("DOMContentLoaded", async () => {

    const API = "../../backend/";
    const LIMITE_BAIXO_ESTOQUE = 10;

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

    function dataBr(iso) {

        if (!iso) return "—";

        const [ano, mes, dia] = iso.split("-");

        return `${dia}/${mes}/${ano}`;
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

    let estoque = [];
    let produtoAtual = null;

    const listaEstoque = document.getElementById("listaEstoque");
    const semProdutos = document.getElementById("semProdutos");
    const modal = document.getElementById("modalEstoque");
    const btnSalvar = document.getElementById("salvarEstoque");

    /* ======================================================
       STATUS E CARDS
    ====================================================== */

    function obterStatus(qtd) {

        if (qtd === 0) {
            return { texto: "Sem estoque", classe: "esgotado" };
        }

        if (qtd <= LIMITE_BAIXO_ESTOQUE) {
            return { texto: "Baixo estoque", classe: "baixo" };
        }

        return { texto: "Normal", classe: "normal" };
    }

    function atualizarCards() {

        document.getElementById("totalItens").textContent = estoque.length;

        document.getElementById("estoqueNormal").textContent =
            estoque.filter(p => p.estoque > LIMITE_BAIXO_ESTOQUE).length;

        document.getElementById("baixoEstoque").textContent =
            estoque.filter(p => p.estoque > 0 && p.estoque <= LIMITE_BAIXO_ESTOQUE).length;

        document.getElementById("semEstoque").textContent =
            estoque.filter(p => p.estoque === 0).length;
    }

    /* ======================================================
       RENDER
    ====================================================== */

    function render(lista) {

        atualizarCards();

        if (lista.length === 0) {

            listaEstoque.innerHTML = "";
            semProdutos.classList.remove("hidden");

            return;
        }

        semProdutos.classList.add("hidden");

        listaEstoque.innerHTML = lista.map(item => {

            const status = obterStatus(item.estoque);

            return `
                <tr>

                    <td>${escapeHtml(item.nome)}</td>

                    <td>${escapeHtml(NOMES_CATEGORIA[item.categoria] || item.categoria)}</td>

                    <td>${item.estoque}</td>

                    <td>
                        <span class="badge ${status.classe}">
                            ${status.texto}
                        </span>
                    </td>

                    <td>${dataBr(item.atualizado)}</td>

                    <td>
                        <button class="btn-editar" data-id="${item.id}" type="button">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </td>

                </tr>
            `;

        }).join("");
    }

    // Pesquisa e filtros funcionam juntos.
    function aplicarFiltros() {

        const termo = document.getElementById("pesquisaEstoque").value.trim().toLowerCase();
        const categoria = document.getElementById("filtroCategoria").value;
        const status = document.getElementById("filtroStatus").value;

        let lista = estoque.filter(p => p.nome.toLowerCase().includes(termo));

        if (categoria) {
            lista = lista.filter(p => p.categoria === categoria);
        }

        if (status === "normal") {
            lista = lista.filter(p => p.estoque > LIMITE_BAIXO_ESTOQUE);
        }

        if (status === "baixo") {
            lista = lista.filter(p => p.estoque > 0 && p.estoque <= LIMITE_BAIXO_ESTOQUE);
        }

        if (status === "esgotado") {
            lista = lista.filter(p => p.estoque === 0);
        }

        render(lista);
    }

    async function carregarEstoque() {

        try {

            estoque = (await chamarApi("produtos/estoque.php")).itens;

        } catch (erro) {

            estoque = [];
            alert(erro.message);
        }

        aplicarFiltros();
    }

    await carregarEstoque();

    /* ======================================================
       MODAL
    ====================================================== */

    function abrirModal(id) {

        produtoAtual = estoque.find(p => p.id === Number(id));

        if (!produtoAtual) return;

        document.getElementById("nomeProdutoModal").value = produtoAtual.nome;
        document.getElementById("quantidadeEstoque").value = produtoAtual.estoque;

        modal.classList.add("ativo");
    }

    function fecharModal() {

        modal.classList.remove("ativo");

        document.getElementById("formEstoque").reset();

        produtoAtual = null;
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

        if (btn) {
            abrirModal(btn.dataset.id);
        }
    });

    /* ======================================================
       SALVAR ALTERAÇÃO (grava no banco)
    ====================================================== */

    document.getElementById("formEstoque")
        .addEventListener("submit", async e => {

            e.preventDefault();

            if (!produtoAtual) return;

            const dados = new FormData();
            dados.append("id", produtoAtual.id);
            dados.append("quantidade", document.getElementById("quantidadeEstoque").value);

            btnSalvar.disabled = true;

            try {

                await chamarApi("produtos/estoque.php", { method: "POST", body: dados });

                fecharModal();

                await carregarEstoque();

            } catch (erro) {

                alert(erro.message);

            } finally {

                btnSalvar.disabled = false;
            }
        });

    /* ======================================================
       PESQUISA, FILTROS E ATUALIZAR
    ====================================================== */

    document.getElementById("pesquisaEstoque")
        .addEventListener("input", aplicarFiltros);

    document.getElementById("filtroCategoria")
        .addEventListener("change", aplicarFiltros);

    document.getElementById("filtroStatus")
        .addEventListener("change", aplicarFiltros);

    document.getElementById("btnAtualizarEstoque")
        .addEventListener("click", carregarEstoque);

    /* ======================================================
       NAVEGAÇÃO
    ====================================================== */

    document.getElementById("btnMensagens")
        .addEventListener("click", () => {

            window.location.href = "negociacoes.html";
        });

});
