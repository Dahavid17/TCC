// Sino de notificações do topo (todas as páginas internas que têm #btnNotificacoes).
//  - contador vermelho com o número de avisos não lidos (consulta leve a cada 30 s);
//  - painel com os últimos avisos ao clicar no sino; clicar num aviso abre a página certa;
//  - aviso flutuante ("toast") quando chega algo novo com a página aberta.
// Os avisos são criados no backend (backend/lib/notificacoes.php) quando acontece um pedido,
// uma mudança de status ou uma mensagem/proposta numa negociação.

(function () {

    const botao = document.getElementById("btnNotificacoes");
    if (!botao) return;

    const API = "../../backend/notificacoes/";
    const INTERVALO_MS = 30000;
    const ICONES = {
        pedido_novo: "bi-bag-check-fill",
        pedido_status: "bi-truck",
        mensagem: "bi-chat-dots-fill",
        proposta: "bi-cash-coin",
        sistema: "bi-info-circle-fill"
    };

    let naoLidas = 0;
    let primeiraConsulta = true;
    let temporizador = null;
    const tituloOriginal = document.title;

    /* ---------- Montagem ---------- */

    botao.classList.add("sino");
    botao.setAttribute("aria-label", "Notificações");
    botao.setAttribute("aria-haspopup", "true");
    botao.setAttribute("aria-expanded", "false");
    botao.setAttribute("aria-controls", "painelNotificacoes");

    const contador = document.createElement("span");
    contador.className = "sino-contador";
    contador.hidden = true;
    botao.append(contador);

    const painel = document.createElement("section");
    painel.className = "painel-notificacoes";
    painel.id = "painelNotificacoes";
    painel.hidden = true;
    painel.setAttribute("aria-label", "Notificações");
    painel.innerHTML = `
        <header class="painel-notificacoes-topo">
            <h2><i class="bi bi-bell-fill" aria-hidden="true"></i> Notificações</h2>
            <button type="button" class="btn-marcar-todas">
                <i class="bi bi-check2-all" aria-hidden="true"></i> Marcar todas como lidas
            </button>
        </header>
        <ul class="lista-notificacoes" aria-live="polite"></ul>
    `;
    document.body.append(painel);

    const lista = painel.querySelector(".lista-notificacoes");
    const btnTodas = painel.querySelector(".btn-marcar-todas");

    const toast = document.createElement("div");
    toast.className = "toast-notificacao";
    toast.setAttribute("role", "status");
    toast.hidden = true;
    document.body.append(toast);

    /* ---------- Utilidades ---------- */

    function escapar(texto) {
        const div = document.createElement("div");
        div.textContent = texto ?? "";
        return div.innerHTML;
    }

    function tempo(segundos) {
        if (segundos < 60) return "agora mesmo";
        if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;
        if (segundos < 86400) return `há ${Math.floor(segundos / 3600)} h`;
        const dias = Math.floor(segundos / 86400);
        return dias === 1 ? "ontem" : `há ${dias} dias`;
    }

    // Aceita só páginas internas (nunca um endereço externo vindo do banco).
    function linkSeguro(link) {
        return /^[a-z0-9-]+\.html(\?[a-z0-9=&_-]*)?$/i.test(link || "") ? link : null;
    }

    function mostrarContador(total) {
        naoLidas = total;
        contador.hidden = total === 0;
        contador.textContent = total > 9 ? "9+" : String(total);
        botao.setAttribute("aria-label", total ? `Notificações: ${total} não lida${total > 1 ? "s" : ""}` : "Notificações");
        document.title = total ? `(${total}) ${tituloOriginal}` : tituloOriginal;
    }

    async function chamar(caminho, opcoes) {
        const resposta = await fetch(API + caminho, { credentials: "same-origin", ...opcoes });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || "Falha nas notificações");
        return dados;
    }

    /* ---------- Lista ---------- */

    function desenhar(notificacoes) {

        btnTodas.hidden = !notificacoes.some(n => !n.lida);

        if (!notificacoes.length) {
            lista.innerHTML = `
                <li class="notificacoes-vazio">
                    <i class="bi bi-bell-slash" aria-hidden="true"></i>
                    <strong>Nenhuma notificação por enquanto</strong>
                    <span>Novos pedidos e mensagens aparecem aqui.</span>
                </li>`;
            return;
        }

        lista.innerHTML = notificacoes.map(n => `
            <li>
                <button type="button" class="item-notificacao ${n.lida ? "" : "nao-lida"}" data-id="${n.id}"
                    data-link="${escapar(linkSeguro(n.link) || "")}">
                    <span class="item-notificacao-icone tipo-${escapar(n.tipo)}" aria-hidden="true">
                        <i class="bi ${ICONES[n.tipo] || ICONES.sistema}"></i>
                    </span>
                    <span class="item-notificacao-texto">
                        <strong>${escapar(n.titulo)}</strong>
                        <span>${escapar(n.mensagem)}</span>
                        <small>${tempo(n.segundos)}${n.lida ? "" : " · <b>nova</b>"}</small>
                    </span>
                </button>
            </li>
        `).join("");
    }

    async function carregarLista() {
        try {
            const dados = await chamar("listar.php");
            mostrarContador(dados.nao_lidas);
            desenhar(dados.notificacoes);
            return dados.notificacoes;
        } catch (erro) {
            lista.innerHTML = `<li class="notificacoes-vazio"><i class="bi bi-wifi-off" aria-hidden="true"></i>
                <strong>Não foi possível carregar</strong><span>Tente de novo em instantes.</span></li>`;
            return [];
        }
    }

    /* ---------- Abrir / fechar ---------- */

    function posicionar() {
        const r = botao.getBoundingClientRect();
        painel.style.top = `${r.bottom + 10}px`;
        painel.style.right = `${Math.max(12, window.innerWidth - r.right - 8)}px`;
    }

    function abrir() {
        posicionar();
        painel.hidden = false;
        botao.setAttribute("aria-expanded", "true");
        lista.innerHTML = `<li class="notificacoes-vazio"><i class="bi bi-arrow-repeat" aria-hidden="true"></i><span>Carregando…</span></li>`;
        carregarLista().then(() => painel.querySelector("button:not([hidden])")?.focus());
    }

    function fechar(devolverFoco = false) {
        painel.hidden = true;
        botao.setAttribute("aria-expanded", "false");
        if (devolverFoco) botao.focus();
    }

    botao.addEventListener("click", (e) => {
        e.stopPropagation();
        painel.hidden ? abrir() : fechar();
    });

    document.addEventListener("click", (e) => {
        if (!painel.hidden && !painel.contains(e.target)) fechar();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !painel.hidden) fechar(true);
    });

    window.addEventListener("resize", () => { if (!painel.hidden) posicionar(); });

    lista.addEventListener("click", async (e) => {
        const item = e.target.closest(".item-notificacao");
        if (!item) return;

        if (item.classList.contains("nao-lida")) {
            const dados = new FormData();
            dados.append("id", item.dataset.id);
            try { await chamar("marcar.php", { method: "POST", body: dados }); } catch (erro) { /* segue */ }
        }

        if (item.dataset.link) {
            window.location.href = item.dataset.link;
        } else {
            carregarLista();
        }
    });

    btnTodas.addEventListener("click", async () => {
        const dados = new FormData();
        dados.append("todas", "1");
        try {
            await chamar("marcar.php", { method: "POST", body: dados });
        } catch (erro) { /* segue */ }
        carregarLista();
    });

    /* ---------- Aviso flutuante quando chega algo novo ---------- */

    let tempoToast = null;

    function mostrarToast(n) {
        const link = linkSeguro(n.link);
        toast.innerHTML = `
            <span class="item-notificacao-icone tipo-${escapar(n.tipo)}" aria-hidden="true">
                <i class="bi ${ICONES[n.tipo] || ICONES.sistema}"></i></span>
            <span class="item-notificacao-texto"><strong>${escapar(n.titulo)}</strong><span>${escapar(n.mensagem)}</span></span>
            ${link ? `<a href="${escapar(link)}" class="toast-abrir">Ver</a>` : ""}
            <button type="button" class="toast-fechar" aria-label="Fechar aviso"><i class="bi bi-x-lg"></i></button>`;
        toast.hidden = false;
        toast.querySelector(".toast-fechar").addEventListener("click", () => { toast.hidden = true; });
        clearTimeout(tempoToast);
        tempoToast = setTimeout(() => { toast.hidden = true; }, 8000);
    }

    /* ---------- Consulta periódica ---------- */

    async function consultar() {
        try {
            const { nao_lidas: total } = await chamar("listar.php?contar=1");
            const subiu = !primeiraConsulta && total > naoLidas;

            mostrarContador(total);

            if (subiu) {
                const notificacoes = painel.hidden ? (await chamar("listar.php")).notificacoes : await carregarLista();
                const nova = notificacoes.find(n => !n.lida);
                if (nova) mostrarToast(nova);
            }
        } catch (erro) {
            // Sem conexão ou sessão expirada: tenta de novo na próxima volta.
        } finally {
            primeiraConsulta = false;
        }
    }

    function iniciar() {
        clearInterval(temporizador);
        temporizador = setInterval(consultar, INTERVALO_MS);
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            clearInterval(temporizador);
        } else {
            consultar();
            iniciar();
        }
    });

    consultar();
    iniciar();

})();
