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
       USUÁRIO (TEMPORÁRIO)
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
       Depois serão substituídos pelo back-end.
    ====================================================== */

    let conversas = JSON.parse(localStorage.getItem("marketplace:conversas")) || [

        {
            id: 1,
            nome: "Padaria Central",
            status: "Online",
            concluida: false,
            aguardando: true,
            propostas: 2,
            mensagens: [
                {
                    remetente: "Padaria Central",
                    texto: "Boa tarde! Tem tomate disponível?",
                    hora: "09:10"
                },
                {
                    remetente: "eu",
                    texto: "Tenho sim, quantos quilos precisa?",
                    hora: "09:12"
                }
            ]
        },

        {
            id: 2,
            nome: "Mercado São José",
            status: "Último acesso há 20 min",
            concluida: true,
            aguardando: false,
            propostas: 1,
            mensagens: [
                {
                    remetente: "Mercado São José",
                    texto: "Obrigado pela entrega!",
                    hora: "Ontem"
                }
            ]
        }

    ];

    let conversaAtual = null;

    const listaConversas = document.getElementById("listaConversas");
    const chatMensagens = document.getElementById("chatMensagens");
    const chatVazio = document.getElementById("chatVazio");

    /* ======================================================
       DASHBOARD
    ====================================================== */

    function atualizarCards() {

        document.getElementById("totalConversas").textContent =
            conversas.length;

        document.getElementById("aguardandoResposta").textContent =
            conversas.filter(c => c.aguardando).length;

        document.getElementById("negociacoesConcluidas").textContent =
            conversas.filter(c => c.concluida).length;

        document.getElementById("propostasEnviadas").textContent =
            conversas.reduce((t, c) => t + c.propostas, 0);

    }

    /* ======================================================
       LISTA DE CONVERSAS
    ====================================================== */

    function renderizarConversas(lista = conversas) {

        listaConversas.innerHTML = "";

        if (lista.length === 0) {

            document.getElementById("semConversas")
                .classList.remove("hidden");

            atualizarCards();

            return;
        }

        document.getElementById("semConversas")
            .classList.add("hidden");

        lista.forEach(conversa => {

            listaConversas.innerHTML += `
                <button
                    class="conversa-item"
                    data-id="${conversa.id}"
                    type="button">

                    <div class="avatar">${conversa.nome.charAt(0)}</div>

                    <div class="conversa-info">

                        <strong>${conversa.nome}</strong>

                        <small>${conversa.status}</small>

                    </div>

                </button>
            `;

        });

        atualizarCards();

    }

    renderizarConversas();

    /* ======================================================
       CHAT
    ====================================================== */

    function abrirConversa(id) {

        conversaAtual = conversas.find(c => c.id == id);

        if (!conversaAtual) return;

        document.getElementById("nomeConversa").textContent =
            conversaAtual.nome;

        document.getElementById("statusConversa").textContent =
            conversaAtual.status;

        document.getElementById("avatarConversa").textContent =
            conversaAtual.nome.charAt(0);

        chatVazio.style.display = "none";

        chatMensagens.innerHTML = "";

        conversaAtual.mensagens.forEach(msg => {

            chatMensagens.innerHTML += `
                <div class="mensagem ${msg.remetente === "eu" ? "enviada" : "recebida"}">

                    <p>${msg.texto}</p>

                    <span>${msg.hora}</span>

                </div>
            `;

        });

        chatMensagens.scrollTop = chatMensagens.scrollHeight;

    }

    listaConversas.addEventListener("click", e => {

        const item = e.target.closest(".conversa-item");

        if (!item) return;

        document.querySelectorAll(".conversa-item")
            .forEach(c => c.classList.remove("ativa"));

        item.classList.add("ativa");

        abrirConversa(item.dataset.id);

    });

    /* ======================================================
       ENVIAR MENSAGEM
    ====================================================== */

    document.getElementById("formMensagem")
        .addEventListener("submit", e => {

            e.preventDefault();

            if (!conversaAtual) return;

            const input = document.getElementById("mensagemInput");

            const texto = input.value.trim();

            if (!texto) return;

            const agora = new Date();

            const hora = agora.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
            });

            conversaAtual.mensagens.push({
                remetente: "eu",
                texto,
                hora
            });

            localStorage.setItem(
                "marketplace:conversas",
                JSON.stringify(conversas)
            );

            abrirConversa(conversaAtual.id);

            input.value = "";

        });

    /* ======================================================
       PESQUISA
    ====================================================== */

    document.getElementById("pesquisaConversa")
        .addEventListener("input", e => {

            const termo = e.target.value.toLowerCase();

            renderizarConversas(

                conversas.filter(c =>
                    c.nome.toLowerCase().includes(termo)
                )

            );

        });

    /* ======================================================
       MODAL PROPOSTA
    ====================================================== */

    const modal = document.getElementById("modalProposta");

    function fecharModal() {

        modal.classList.remove("ativo");

        document.getElementById("formProposta").reset();

    }

    document.getElementById("fecharModalProposta")
        .addEventListener("click", fecharModal);

    document.getElementById("cancelarProposta")
        .addEventListener("click", fecharModal);

    modal.addEventListener("click", e => {

        if (e.target === modal) {

            fecharModal();

        }

    });

    document.getElementById("formProposta")
        .addEventListener("submit", e => {

            e.preventDefault();

            if (!conversaAtual) return;

            conversaAtual.propostas++;

            atualizarCards();

            localStorage.setItem(
                "marketplace:conversas",
                JSON.stringify(conversas)
            );

            fecharModal();

        });

    /* ======================================================
       ANEXO (PLACEHOLDER)
    ====================================================== */

    document.getElementById("btnAnexo")
        .addEventListener("click", () => {

            alert("O envio de arquivos será integrado ao back-end.");

        });

});