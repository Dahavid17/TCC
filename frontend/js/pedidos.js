document.addEventListener("DOMContentLoaded", () => {

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
       USUÁRIO (TEMPORÁRIO)
    ========================================================= */

    const usuario = JSON.parse(localStorage.getItem("usuarioLogado")) || {
        nome: "Usuário",
        tipo: "Produtor"
    };

    document.getElementById("nomeUsuario").textContent = usuario.nome;
    document.getElementById("tipoUsuario").textContent = usuario.tipo;
    document.getElementById("avatarUsuario").textContent =
        usuario.nome.charAt(0).toUpperCase();

    /* =========================================================
       DADOS (TEMPORÁRIO)
       Depois será substituído pelo back-end.
    ========================================================= */

    let pedidos = JSON.parse(localStorage.getItem("marketplace:pedidos")) || [

        {
            id: 1001,
            cliente: "Padaria Central",
            produtos: [
                { nome: "Tomate Orgânico", quantidade: 20 }
            ],
            valor: 178.00,
            status: "preparo",
            data: "2026-09-11"
        },

        {
            id: 1002,
            cliente: "Mercado São José",
            produtos: [
                { nome: "Alface Americana", quantidade: 50 }
            ],
            valor: 95.00,
            status: "entregue",
            data: "2026-09-09"
        }

    ];

    const listaPedidos = document.getElementById("listaPedidos");
    const semPedidos = document.getElementById("semPedidos");

    /* =========================================================
       STATUS
    ========================================================= */

    function classeStatus(status) {

        switch (status) {

            case "recebido":
                return "recebido";

            case "negociacao":
                return "negociacao";

            case "preparo":
                return "preparo";

            case "entregue":
                return "entregue";

            case "cancelado":
                return "cancelado";

            default:
                return "";

        }

    }

    function textoStatus(status) {

        switch (status) {

            case "recebido":
                return "Recebido";

            case "negociacao":
                return "Em negociação";

            case "preparo":
                return "Em preparo";

            case "entregue":
                return "Entregue";

            case "cancelado":
                return "Cancelado";

            default:
                return status;

        }

    }

    /* =========================================================
       CARDS
    ========================================================= */

    function atualizarCards() {

        document.getElementById("totalPedidos").textContent =
            pedidos.length;

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

    function render(lista = pedidos) {

        listaPedidos.innerHTML = "";

        if (lista.length === 0) {

            semPedidos.classList.remove("hidden");

            atualizarCards();

            return;
        }

        semPedidos.classList.add("hidden");

        lista.forEach(pedido => {

            listaPedidos.innerHTML += `
                <tr>

                    <td>#${pedido.id}</td>

                    <td>${pedido.cliente}</td>

                    <td>${pedido.produtos.length} item(s)</td>

                    <td>R$ ${pedido.valor.toFixed(2)}</td>

                    <td>

                        <span class="badge ${classeStatus(pedido.status)}">

                            ${textoStatus(pedido.status)}

                        </span>

                    </td>

                    <td>${pedido.data}</td>

                    <td>

                        <button
                            class="btn-detalhes"
                            data-id="${pedido.id}"
                            type="button">

                            <i class="bi bi-eye"></i>

                        </button>

                    </td>

                </tr>
            `;

        });

        atualizarCards();

    }

    render();

    /* =========================================================
       MODAL
    ========================================================= */

    const modal = document.getElementById("modalPedido");

    function fecharModal() {

        modal.classList.remove("ativo");

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

        const pedido =
            pedidos.find(p => p.id == botao.dataset.id);

        document.getElementById("modalNumeroPedido").textContent =
            "#" + pedido.id;

        document.getElementById("modalCliente").textContent =
            pedido.cliente;

        document.getElementById("modalData").textContent =
            pedido.data;

        document.getElementById("modalStatus").textContent =
            textoStatus(pedido.status);

        const produtos = document.getElementById("modalProdutos");

        produtos.innerHTML = "";

        pedido.produtos.forEach(item => {

            produtos.innerHTML += `
                <div class="item-produto">

                    <span>${item.nome}</span>

                    <strong>${item.quantidade} un.</strong>

                </div>
            `;

        });

        document.getElementById("modalTotal").textContent =
            `R$ ${pedido.valor.toFixed(2)}`;

        modal.classList.add("ativo");

    });

    /* =========================================================
       PESQUISA
    ========================================================= */

    document.getElementById("pesquisaPedido")
        .addEventListener("input", e => {

            const termo = e.target.value.toLowerCase();

            render(
                pedidos.filter(p =>
                    p.cliente.toLowerCase().includes(termo) ||
                    String(p.id).includes(termo)
                )
            );

        });

    /* =========================================================
       FILTROS
    ========================================================= */

    document.getElementById("filtroStatus")
        .addEventListener("change", aplicarFiltros);

    document.getElementById("filtroPeriodo")
        .addEventListener("change", aplicarFiltros);

    function aplicarFiltros() {

        let lista = [...pedidos];

        const status =
            document.getElementById("filtroStatus").value;

        const periodo =
            document.getElementById("filtroPeriodo").value;

        if (status) {

            lista = lista.filter(p => p.status === status);

        }

        if (periodo) {

            const hoje = new Date();

            lista = lista.filter(p => {

                const data = new Date(p.data);

                const dias =
                    (hoje - data) / (1000 * 60 * 60 * 24);

                if (periodo === "hoje")
                    return dias < 1;

                if (periodo === "semana")
                    return dias <= 7;

                if (periodo === "mes")
                    return dias <= 30;

                return true;

            });

        }

        render(lista);

    }

    /* =========================================================
       NAVEGAÇÃO
    ========================================================= */

    document.getElementById("btnMensagens")
        .addEventListener("click", () => {

            window.location.href = "negociacoes.html";

        });

});