document.addEventListener("DOMContentLoaded", async () => {

    const API = "../../backend/";
    const INTERVALO_MENSAGENS = 4000;
    const INTERVALO_CONVERSAS = 15000;

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

    // As conversas de exemplo antigas ficavam no navegador; não são mais usadas.
    localStorage.removeItem("marketplace:conversas");

    /* ======================================================
       API
    ====================================================== */

    async function chamarApi(caminho, dados) {

        const resposta = await fetch(API + caminho, dados ? { method: "POST", body: dados } : undefined);

        let resultado;

        try {
            resultado = await resposta.json();
        } catch {
            resultado = { sucesso: false, mensagem: "Resposta inválida do servidor." };
        }

        if (resposta.status === 401) {
            window.location.href = "login-marketplace.html";
            throw new Error("Sessão expirada");
        }

        if (!resposta.ok || !resultado.sucesso) {
            throw new Error(resultado.mensagem || "Erro ao comunicar com o servidor.");
        }

        return resultado;
    }

    function escapeHtml(texto) {

        const div = document.createElement("div");
        div.textContent = texto ?? "";

        return div.innerHTML.replace(/"/g, "&quot;");
    }

    function dinheiro(valor) {
        return "R$ " + Number(valor).toFixed(2).replace(".", ",");
    }

    function inicial(nome) {
        return escapeHtml((nome || "?").trim().charAt(0).toUpperCase());
    }

    // "em" chega em segundos (Unix); mostra só a hora quando é de hoje.
    function horario(em, completo = false) {

        const data = new Date(em * 1000);
        const hoje = new Date();
        const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        if (data.toDateString() === hoje.toDateString()) return hora;

        const dia = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

        return completo ? `${dia} ${hora}` : dia;
    }

    /* ======================================================
       USUÁRIO
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

    let conversas = [];
    let atual = null;          // { anuncio_id, comprador_id, ...dados da conversa }
    let ultimoId = 0;          // cursor da busca de mensagens novas
    let mensagensAtuais = [];  // mensagens exibidas da conversa aberta
    let carregandoMensagens = false;

    const listaConversas = document.getElementById("listaConversas");
    const semConversas = document.getElementById("semConversas");
    const chatMensagens = document.getElementById("chatMensagens");
    const formMensagem = document.getElementById("formMensagem");
    const inputMensagem = document.getElementById("mensagemInput");
    const btnEnviar = document.getElementById("btnEnviar");
    const btnProposta = document.getElementById("btnProposta");
    const campoPesquisa = document.getElementById("pesquisaConversa");

    const mesmaConversa = (c, anuncioId, compradorId) =>
        c.anuncio_id === anuncioId && c.comprador_id === compradorId;

    function habilitarEnvio(ativo) {

        inputMensagem.disabled = !ativo;
        btnEnviar.disabled = !ativo;
        btnProposta.disabled = !ativo;
    }

    habilitarEnvio(false);

    /* ======================================================
       RESUMO (cards)
    ====================================================== */

    function atualizarCards() {

        document.getElementById("totalConversas").textContent = conversas.length;

        document.getElementById("aguardandoResposta").textContent =
            conversas.filter(c => c.aguardando_resposta).length;

        document.getElementById("negociacoesConcluidas").textContent =
            conversas.filter(c => c.concluida).length;

        document.getElementById("propostasEnviadas").textContent =
            conversas.reduce((total, c) => total + c.propostas_enviadas, 0);
    }

    /* ======================================================
       LISTA DE CONVERSAS
    ====================================================== */

    function previa(ultima) {

        const texto = ultima.tipo === "proposta"
            ? `Proposta: ${dinheiro(ultima.valor)}`
            : ultima.texto;

        return (ultima.minha ? "Você: " : "") + texto;
    }

    function renderizarConversas() {

        const termo = campoPesquisa.value.trim().toLowerCase();

        const lista = conversas.filter(c =>
            c.contraparte.nome.toLowerCase().includes(termo) ||
            c.produto.nome.toLowerCase().includes(termo)
        );

        atualizarCards();

        semConversas.querySelector("p").textContent = conversas.length
            ? "Nenhuma conversa encontrada."
            : "Você ainda não tem negociações. Use o botão Negociar em um produto para conversar com o vendedor.";

        semConversas.classList.toggle("hidden", lista.length > 0);

        listaConversas.innerHTML = lista.map(c => {

            const ativa = atual && mesmaConversa(c, atual.anuncio_id, atual.comprador_id);

            return `
                <button class="conversa-item${ativa ? " ativa" : ""}" type="button"
                        data-anuncio="${c.anuncio_id}" data-comprador="${c.comprador_id}">

                    <div class="avatar">${inicial(c.contraparte.nome)}</div>

                    <div class="conversa-info">
                        <div class="conversa-topo">
                            <strong>${escapeHtml(c.contraparte.nome)}</strong>
                            <time>${horario(c.ultima.em)}</time>
                        </div>
                        <small class="conversa-produto">
                            ${c.papel === "vendedor" ? "Comprador" : "Vendedor"} · ${escapeHtml(c.produto.nome)}
                            ${c.concluida ? '<span class="tag-concluida">Concluída</span>' : ""}
                        </small>
                        <div class="conversa-rodape">
                            <small class="conversa-previa">${escapeHtml(previa(c.ultima))}</small>
                            ${c.nao_lidas ? `<span class="badge-nao-lidas">${c.nao_lidas}</span>` : ""}
                        </div>
                    </div>

                </button>
            `;

        }).join("");
    }

    async function carregarConversas() {

        try {

            conversas = (await chamarApi("negociacoes/listar.php")).conversas;
            renderizarConversas();

        } catch (erro) {

            if (erro.message === "Sessão expirada") return;

            console.error("Erro ao carregar negociações:", erro);
            semConversas.querySelector("p").textContent = erro.message;
            semConversas.classList.remove("hidden");
        }
    }

    /* ======================================================
       CHAT
    ====================================================== */

    function htmlMensagem(msg) {

        const conteudo = msg.tipo === "proposta"
            ? `<div class="proposta">
                   <small><i class="bi bi-currency-dollar"></i> Proposta</small>
                   <strong>${dinheiro(msg.valor)}</strong>
               </div>
               ${msg.texto ? `<p>${escapeHtml(msg.texto)}</p>` : ""}`
            : `<p>${escapeHtml(msg.texto)}</p>`;

        return `
            <div class="mensagem ${msg.minha ? "enviada" : "recebida"}" data-id="${msg.id}">
                ${conteudo}
                <span>${horario(msg.em, true)}</span>
            </div>
        `;
    }

    // "doServidor" = resultado completo de mensagens.php: só ele avança o cursor da busca,
    // para que a mensagem que eu envio não faça pular uma recebida no mesmo instante.
    function adicionarMensagens(mensagens, doServidor = false) {

        if (doServidor && mensagens.length) {
            ultimoId = Math.max(ultimoId, ...mensagens.map(m => m.id));
        }

        const exibidas = new Set(mensagensAtuais.map(m => m.id));
        const novas = mensagens.filter(m => !exibidas.has(m.id));

        if (!novas.length) return;

        const maiorAnterior = mensagensAtuais.length ? mensagensAtuais[mensagensAtuais.length - 1].id : 0;
        const noFim = chatMensagens.scrollHeight - chatMensagens.scrollTop - chatMensagens.clientHeight < 80;

        mensagensAtuais = mensagensAtuais.concat(novas).sort((a, b) => a.id - b.id);

        chatMensagens.querySelector(".empty-chat")?.remove();

        if (novas.every(m => m.id > maiorAnterior)) {
            chatMensagens.insertAdjacentHTML("beforeend",
                novas.sort((a, b) => a.id - b.id).map(htmlMensagem).join(""));
        } else {
            chatMensagens.innerHTML = mensagensAtuais.map(htmlMensagem).join("");
        }

        if (noFim || novas.some(m => m.minha)) {
            chatMensagens.scrollTop = chatMensagens.scrollHeight;
        }
    }

    function mostrarAvisoChat(icone, titulo, texto) {

        chatMensagens.innerHTML = `
            <div class="empty-chat">
                <i class="bi ${icone}"></i>
                <h2>${escapeHtml(titulo)}</h2>
                <p>${escapeHtml(texto)}</p>
            </div>
        `;
    }

    function preencherCabecalho(conversa) {

        const produto = conversa.produto;
        const papel = conversa.papel === "vendedor" ? "Você está vendendo" : "Você está comprando";
        const situacao = conversa.concluida
            ? " · Negociação concluída"
            : produto.status === "inativo" ? " · Produto indisponível" : "";

        document.getElementById("nomeConversa").textContent = conversa.contraparte.nome;
        document.getElementById("statusConversa").textContent =
            `${papel}: ${produto.nome} · ${dinheiro(produto.preco)}${situacao}`;
        document.getElementById("avatarConversa").textContent =
            (conversa.contraparte.nome || "?").charAt(0).toUpperCase();
    }

    async function abrirConversa(anuncioId, compradorId = null) {

        let parametros = `anuncio_id=${anuncioId}`;

        if (compradorId) parametros += `&comprador_id=${compradorId}`;

        ultimoId = 0;
        mensagensAtuais = [];
        atual = null;
        habilitarEnvio(false);
        mostrarAvisoChat("bi-hourglass-split", "Carregando conversa...", "");

        try {

            const dados = await chamarApi("negociacoes/mensagens.php?" + parametros);

            atual = dados.conversa;
            preencherCabecalho(atual);

            chatMensagens.innerHTML = "";

            if (dados.mensagens.length) {
                adicionarMensagens(dados.mensagens, true);
                chatMensagens.scrollTop = chatMensagens.scrollHeight;
            } else {
                mostrarAvisoChat("bi-chat-left-dots", "Comece a negociação",
                    `Envie a primeira mensagem ou uma proposta para ${atual.contraparte.nome} sobre ${atual.produto.nome}.`);
            }

            habilitarEnvio(atual.pode_enviar);

            if (!atual.pode_enviar) {
                inputMensagem.placeholder = "Este produto não está mais disponível.";
            } else {
                inputMensagem.placeholder = "Digite uma mensagem...";
                inputMensagem.focus({ preventScroll: true });
            }

            // Mantém a conversa aberta na URL para poder recarregar a página.
            const url = new URL(window.location.href);
            url.search = "";
            url.searchParams.set("anuncio", atual.anuncio_id);
            if (atual.papel === "vendedor") url.searchParams.set("comprador", atual.comprador_id);
            history.replaceState(null, "", url);

            // Ao abrir, as mensagens recebidas passam a contar como lidas.
            const naLista = conversas.find(c => mesmaConversa(c, atual.anuncio_id, atual.comprador_id));
            if (naLista) naLista.nao_lidas = 0;

            renderizarConversas();

            if (window.matchMedia("(max-width: 900px)").matches) {
                document.querySelector(".chat-box").scrollIntoView({ behavior: "smooth" });
            }

        } catch (erro) {

            if (erro.message === "Sessão expirada") return;

            document.getElementById("nomeConversa").textContent = "Conversa indisponível";
            document.getElementById("statusConversa").textContent = "";
            document.getElementById("avatarConversa").textContent = "-";
            mostrarAvisoChat("bi-exclamation-circle", "Não foi possível abrir a conversa", erro.message);
        }
    }

    // Busca só as mensagens novas da conversa aberta.
    async function buscarNovasMensagens() {

        if (!atual || !atual.existe || carregandoMensagens || document.hidden) return;

        carregandoMensagens = true;

        const conversa = atual;
        let parametros = `anuncio_id=${conversa.anuncio_id}&depois=${ultimoId}`;

        if (conversa.papel === "vendedor") parametros += `&comprador_id=${conversa.comprador_id}`;

        try {

            const dados = await chamarApi("negociacoes/mensagens.php?" + parametros);

            if (atual !== conversa) return;

            if (dados.conversa.concluida !== atual.concluida) {
                atual.concluida = dados.conversa.concluida;
                preencherCabecalho(atual);
            }

            const antes = mensagensAtuais.length;

            adicionarMensagens(dados.mensagens, true);

            if (mensagensAtuais.length !== antes) carregarConversas();

        } catch (erro) {

            console.error("Erro ao buscar mensagens:", erro);

        } finally {

            carregandoMensagens = false;
        }
    }

    listaConversas.addEventListener("click", e => {

        const item = e.target.closest(".conversa-item");

        if (!item) return;

        abrirConversa(Number(item.dataset.anuncio), Number(item.dataset.comprador));
    });

    /* ======================================================
       ENVIAR MENSAGEM / PROPOSTA
    ====================================================== */

    async function enviar(campos) {

        if (!atual) return false;

        const dados = new FormData();

        dados.append("anuncio_id", atual.anuncio_id);

        if (atual.papel === "vendedor") dados.append("comprador_id", atual.comprador_id);

        Object.entries(campos).forEach(([chave, valor]) => dados.append(chave, valor));

        try {

            const resultado = await chamarApi("negociacoes/enviar.php", dados);

            atual.existe = true;
            adicionarMensagens([resultado.enviada]);
            await carregarConversas();

            return true;

        } catch (erro) {

            if (erro.message !== "Sessão expirada") alert(erro.message);

            return false;
        }
    }

    formMensagem.addEventListener("submit", async e => {

        e.preventDefault();

        const texto = inputMensagem.value.trim();

        if (!texto || !atual) return;

        btnEnviar.disabled = true;

        if (await enviar({ tipo: "texto", mensagem: texto })) {
            inputMensagem.value = "";
        }

        btnEnviar.disabled = false;
        inputMensagem.focus();
    });

    const modal = document.getElementById("modalProposta");
    const formProposta = document.getElementById("formProposta");

    function fecharModal() {

        modal.classList.remove("ativo");
        formProposta.reset();
    }

    btnProposta.addEventListener("click", () => {

        if (!atual) return;

        document.getElementById("produtoProposta").textContent =
            `${atual.produto.nome} · preço anunciado ${dinheiro(atual.produto.preco)} por unidade`;

        modal.classList.add("ativo");
        document.getElementById("valorProposta").focus();
    });

    document.getElementById("fecharModalProposta").addEventListener("click", fecharModal);
    document.getElementById("cancelarProposta").addEventListener("click", fecharModal);

    modal.addEventListener("click", e => {
        if (e.target === modal) fecharModal();
    });

    formProposta.addEventListener("submit", async e => {

        e.preventDefault();

        const botao = document.getElementById("enviarProposta");

        botao.disabled = true;

        const enviada = await enviar({
            tipo: "proposta",
            valor: document.getElementById("valorProposta").value,
            mensagem: document.getElementById("observacaoProposta").value.trim()
        });

        botao.disabled = false;

        if (enviada) fecharModal();
    });

    /* ======================================================
       PESQUISA
    ====================================================== */

    campoPesquisa.addEventListener("input", renderizarConversas);

    document.getElementById("formPesquisaConversa")
        .addEventListener("submit", e => e.preventDefault());

    /* ======================================================
       INÍCIO E ATUALIZAÇÃO AUTOMÁTICA
    ====================================================== */

    await carregarConversas();

    // ?anuncio=ID abre (ou começa) a conversa sobre o produto; ?comprador=ID é usado pelo vendedor.
    const parametrosUrl = new URLSearchParams(window.location.search);
    const anuncioUrl = Number(parametrosUrl.get("anuncio"));

    if (anuncioUrl > 0) {
        await abrirConversa(anuncioUrl, Number(parametrosUrl.get("comprador")) || null);
    }

    setInterval(buscarNovasMensagens, INTERVALO_MENSAGENS);
    setInterval(() => { if (!document.hidden) carregarConversas(); }, INTERVALO_CONVERSAS);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            carregarConversas();
            buscarNovasMensagens();
        }
    });

});
