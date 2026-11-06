document.addEventListener("DOMContentLoaded", async () => {

    const API = "../../backend/";

    /* =========================================================
       TEMA
    ========================================================= */

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

    /* =========================================================
       API
    ========================================================= */

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

    function dinheiro(valor) {

        return "R$ " + valor.toFixed(2).replace(".", ",");
    }

    function dataBr(iso) {

        const [ano, mes, dia] = iso.split("-");

        return `${dia}/${mes}/${ano}`;
    }

    /* =========================================================
       USUÁRIO (sessão do servidor)
    ========================================================= */

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

    /* =========================================================
       ELEMENTOS E ESTADO
    ========================================================= */

    const listaPedidos = document.getElementById("listaPedidos");
    const semPedidos = document.getElementById("semPedidos");
    const modal = document.getElementById("modalPedido");
    const acoesStatus = document.getElementById("acoesStatus");
    const selectNovoStatus = document.getElementById("novoStatus");
    const btnAtualizarStatus = document.getElementById("btnAtualizarStatus");

    let pedidos = [];
    let pedidoAberto = null;

    /* =========================================================
       STATUS
    ========================================================= */

    const TEXTOS_STATUS = {
        recebido: "Recebido",
        negociacao: "Em negociação",
        preparo: "Em preparo",
        entregue: "Entregue",
        cancelado: "Cancelado"
    };

    function textoStatus(status) {

        return TEXTOS_STATUS[status] || status;
    }

    /* =========================================================
       CARDS
    ========================================================= */

    function atualizarCards() {

        document.getElementById("totalPedidos").textContent = pedidos.length;

        document.getElementById("pedidosNegociacao").textContent =
            pedidos.filter(p => p.status === "negociacao").length;

        document.getElementById("pedidosPreparacao").textContent =
            pedidos.filter(p => p.status === "preparo").length;

        document.getElementById("pedidosEntregues").textContent =
            pedidos.filter(p => p.status === "entregue").length;

    }

    /* =========================================================
       RENDER
    ========================================================= */

    function render(lista) {

        atualizarCards();

        if (lista.length === 0) {

            listaPedidos.innerHTML = "";
            semPedidos.classList.remove("hidden");

            return;
        }

        semPedidos.classList.add("hidden");

        listaPedidos.innerHTML = lista.map(pedido => `
            <tr>

                <td data-label="Pedido">#${pedido.id}</td>

                <td data-label="Cliente">
                    ${escapeHtml(pedido.contraparte)}
                    <small>(${pedido.papel === "vendedor" ? "venda" : "compra"})</small>
                </td>

                <td data-label="Produtos">${pedido.itens.length} item(s)</td>

                <td data-label="Valor">${dinheiro(pedido.total)}</td>

                <td data-label="Status">
                    <span class="badge ${escapeHtml(pedido.status)}">
                        ${textoStatus(pedido.status)}
                    </span>
                </td>

                <td data-label="Data">${dataBr(pedido.data)}</td>

                <td data-label="">
                    <button class="btn-detalhes" data-id="${pedido.id}" type="button">
                        <i class="bi bi-eye"></i>
                    </button>
                </td>

            </tr>
        `).join("");

    }

    // Pesquisa e filtros funcionam juntos.
    function aplicarFiltros() {

        const termo = document.getElementById("pesquisaPedido").value.trim().toLowerCase();
        const status = document.getElementById("filtroStatus").value;
        const periodo = document.getElementById("filtroPeriodo").value;

        const limites = { hoje: 1, semana: 7, mes: 30 };

        const lista = pedidos.filter(p => {

            if (termo &&
                !p.contraparte.toLowerCase().includes(termo) &&
                !String(p.id).includes(termo)) {
                return false;
            }

            if (status && p.status !== status) {
                return false;
            }

            if (periodo) {
                const dias = (Date.now() - new Date(p.data + "T00:00:00")) / 86400000;
                return dias <= limites[periodo];
            }

            return true;
        });

        render(lista);
    }

    async function carregarPedidos() {

        try {

            pedidos = (await chamarApi("pedidos/listar.php")).pedidos;

        } catch (erro) {

            pedidos = [];
            alert(erro.message);
        }

        aplicarFiltros();
    }

    await carregarPedidos();

    /* =========================================================
       MODAL
    ========================================================= */

    function fecharModal() {

        modal.classList.remove("ativo");
        pedidoAberto = null;

    }

    document.getElementById("fecharModalPedido")
        .addEventListener("click", fecharModal);

    document.getElementById("btnFecharPedido")
        .addEventListener("click", fecharModal);

    modal.addEventListener("click", e => {

        if (e.target === modal) {
            fecharModal();
        }

    });

    listaPedidos.addEventListener("click", e => {

        const botao = e.target.closest(".btn-detalhes");

        if (!botao) return;

        const pedido = pedidos.find(p => p.id === Number(botao.dataset.id));

        if (!pedido) return;

        pedidoAberto = pedido;

        document.getElementById("modalNumeroPedido").textContent = "#" + pedido.id;
        document.getElementById("modalCliente").textContent = pedido.contraparte;
        document.getElementById("modalData").textContent = dataBr(pedido.data);
        document.getElementById("modalStatus").textContent = textoStatus(pedido.status);

        document.getElementById("modalProdutos").innerHTML = pedido.itens.map(item => `
            <div class="item-produto">
                <span>${escapeHtml(item.nome)}</span>
                <strong>${item.quantidade} un. × ${dinheiro(item.preco_unitario)}</strong>
            </div>
        `).join("");

        document.getElementById("modalTotal").textContent = dinheiro(pedido.total);

        // Só mostra a troca de status quando o usuário tem uma transição permitida.
        if (pedido.transicoes.length > 0) {

            selectNovoStatus.innerHTML = pedido.transicoes
                .map(s => `<option value="${s}">${textoStatus(s)}</option>`)
                .join("");

            acoesStatus.classList.remove("hidden");

        } else {

            acoesStatus.classList.add("hidden");
        }

        modal.classList.add("ativo");

    });

    btnAtualizarStatus.addEventListener("click", async () => {

        if (!pedidoAberto) return;

        const novoStatus = selectNovoStatus.value;

        if (novoStatus === "cancelado" && !confirm("Cancelar este pedido? O estoque será devolvido.")) {
            return;
        }

        const dados = new FormData();
        dados.append("id", pedidoAberto.id);
        dados.append("status", novoStatus);

        btnAtualizarStatus.disabled = true;

        try {

            await chamarApi("pedidos/atualizar.php", { method: "POST", body: dados });

            fecharModal();

            await carregarPedidos();

        } catch (erro) {

            alert(erro.message);

        } finally {

            btnAtualizarStatus.disabled = false;
        }

    });

    /* =========================================================
       PESQUISA E FILTROS
    ========================================================= */

    document.getElementById("pesquisaPedido")
        .addEventListener("input", aplicarFiltros);

    document.getElementById("filtroStatus")
        .addEventListener("change", aplicarFiltros);

    document.getElementById("filtroPeriodo")
        .addEventListener("change", aplicarFiltros);

    /* =========================================================
       NAVEGAÇÃO
    ========================================================= */

    document.getElementById("btnMensagens")
        .addEventListener("click", () => {

            window.location.href = "negociacoes.html";

        });

});
