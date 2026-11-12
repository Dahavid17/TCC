document.addEventListener("DOMContentLoaded", async () => {

    const API = "../../backend/";

    // O painel consulta o resumo a cada INTERVALO_MS (pausa com a aba oculta).
    const INTERVALO_MS = 5000;

    // Sem leitura há mais que isso, o sensor/placa aparece como "sem sinal".
    const LIMITE_ONLINE_S = 90;

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

        return { status: resposta.status, dados };
    }

    function escapeHtml(texto) {

        const div = document.createElement("div");
        div.textContent = texto ?? "";

        return div.innerHTML.replace(/"/g, "&quot;");
    }

    /* ======================================================
       USUÁRIO (sessão do servidor)
    ====================================================== */

    let usuarioSessao = null;

    try {

        const { dados } = await chamarApi("auth/sessao.php");

        if (!dados.sucesso) {
            window.location.href = "login-marketplace.html";
            return;
        }

        const { usuario } = dados;
        usuarioSessao = usuario;
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

    document.getElementById("btnMensagens")
        .addEventListener("click", () => {
            window.location.href = "negociacoes.html";
        });

    /* ======================================================
       PLANO (escolhido em planos.html — por enquanto demonstração)
       Produtor sem plano vê primeiro a página de planos.
    ====================================================== */

    const PLANOS = window.PLANOS_FAZENDA;
    const ehProdutor = ["produtor", "admin"].includes(usuarioSessao.tipo_acesso);

    await window.PreferenciasUsuario?.carregar(usuarioSessao);

    const plano = PLANOS[window.PreferenciasUsuario?.obter("plano")] || null;

    if (ehProdutor && !plano) {
        window.location.replace("planos.html");
        return;
    }

    const recursos = plano?.recursos || {};

    function mostrarPlano() {

        if (!plano) return;

        document.getElementById("bannerPlanoNome").textContent = plano.nome;
        document.getElementById("bannerPlanoIcone").className = `bi ${plano.icone}`;
        document.getElementById("bannerPlanoResumo").textContent = plano.chamada;
        document.getElementById("bannerPlano").classList.toggle("plano-pro", plano.id === "pro");

        document.getElementById("secPainelPro").classList.toggle("hidden", !recursos.dashboard);
        document.getElementById("secConvitePro").classList.toggle("hidden", Boolean(recursos.dashboard));
        document.getElementById("secAutomacao").classList.toggle("hidden", !recursos.automacao);

        document.getElementById("tutorialPassos").innerHTML = plano.passos.map((passo, i) => `
            <li>
                <span class="passo-icone" aria-hidden="true"><i class="bi ${passo.icone}"></i></span>
                <div><strong>${i + 1}. ${escapeHtml(passo.titulo)}</strong><p>${escapeHtml(passo.texto)}</p></div>
            </li>
        `).join("");

        // Recém-escolhido em planos.html: confirma na tela.
        const url = new URL(window.location.href);

        if (url.searchParams.get("plano") === "novo") {
            url.searchParams.delete("plano");
            history.replaceState(null, "", url);

            const resumo = document.getElementById("bannerPlanoResumo");
            resumo.innerHTML = `<i class="bi bi-check-circle-fill" aria-hidden="true"></i> ${escapeHtml(plano.nome)} ativado! (demonstração, sem cobrança)`;
            document.getElementById("bannerPlano").classList.add("recem-ativado");
        }
    }

    mostrarPlano();

    /* Narração do plano (ouvir explicação) */

    const btnOuvirPlano = document.getElementById("btnOuvirPlano");
    const podeFalar = "speechSynthesis" in window && plano;

    if (!podeFalar) btnOuvirPlano.hidden = true;

    function pararNarracao() {
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        btnOuvirPlano.classList.remove("falando");
        btnOuvirPlano.querySelector("span").textContent = "Ouvir explicação";
        btnOuvirPlano.querySelector("i").className = "bi bi-volume-up-fill";
    }

    btnOuvirPlano.addEventListener("click", () => {

        if (btnOuvirPlano.classList.contains("falando")) return pararNarracao();

        const fala = new SpeechSynthesisUtterance(plano.narracao);
        fala.lang = "pt-BR";
        fala.rate = 0.9;
        const voz = window.speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith("pt"));
        if (voz) fala.voice = voz;
        fala.addEventListener("end", pararNarracao);
        fala.addEventListener("error", pararNarracao);

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(fala);

        btnOuvirPlano.classList.add("falando");
        btnOuvirPlano.querySelector("span").textContent = "Parar explicação";
        btnOuvirPlano.querySelector("i").className = "bi bi-stop-circle-fill";
    });

    window.addEventListener("pagehide", pararNarracao);

    /* ======================================================
       FORMATAÇÃO
    ====================================================== */

    // Ícone por tipo; nome e unidade vêm do backend (com fallback para sensores antigos).
    function infoSensor(sensor) {

        const t = (sensor.tipo || "").toLowerCase();
        let info = { nome: sensor.tipo || "Sensor", unidade: "", icone: "bi-cpu" };

        if (t.includes("solo")) info = { nome: "Umidade do solo", unidade: "%", icone: "bi-moisture" };
        else if (t.includes("temp")) info = { nome: "Temperatura do ar", unidade: "°C", icone: "bi-thermometer-half" };
        else if (t === "umidade_ar") info = { nome: "Umidade do ar", unidade: "%", icone: "bi-droplet-half" };
        else if (t.includes("lumin")) info = { nome: "Luminosidade", unidade: "lx", icone: "bi-brightness-high" };

        return {
            nome: sensor.nome || info.nome,
            unidade: sensor.unidade ?? info.unidade,
            icone: info.icone
        };
    }

    function numero(valor, unidade) {

        const casas = unidade === "lx" ? 0 : 1;

        return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
    }

    function tempoDecorrido(segundos) {

        if (segundos < 5) return "agora";
        if (segundos < 60) return `há ${segundos} s`;
        if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;
        if (segundos < 86400) return `há ${Math.floor(segundos / 3600)} h`;

        return `há ${Math.floor(segundos / 86400)} dia(s)`;
    }

    // Situação de uma placa ou sensor a partir do tempo desde a última leitura.
    function situacao(segundosSemSinal) {

        if (segundosSemSinal === null || segundosSemSinal === undefined) {
            return { texto: "Aguardando primeira leitura", classe: "aguardando", online: false };
        }

        if (segundosSemSinal <= LIMITE_ONLINE_S) {
            return { texto: "Ao vivo", classe: "", online: true };
        }

        return { texto: `Sem sinal ${tempoDecorrido(segundosSemSinal)}`, classe: "alerta", online: false };
    }

    // Minigráfico (SVG) das últimas leituras, da mais antiga para a mais recente.
    function grafico(valores) {

        if (!valores || valores.length < 2) {
            return `<div class="sensor-grafico vazio" aria-hidden="true"></div>`;
        }

        const largura = 200;
        const altura = 44;
        const min = Math.min(...valores);
        const max = Math.max(...valores);
        const faixa = max - min || 1;

        const pontos = valores.map((v, i) => {
            const x = (i / (valores.length - 1)) * largura;
            const y = altura - 4 - ((v - min) / faixa) * (altura - 8);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");

        return `
            <svg class="sensor-grafico" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="none" aria-hidden="true">
                <polyline points="${pontos}" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            </svg>
        `;
    }

    /* ======================================================
       SENSORES E DISPOSITIVOS
    ====================================================== */

    const gridSensores = document.getElementById("gridSensores");
    const listaDispositivos = document.getElementById("listaDispositivos");
    const ESTADOS = { inativo: "Inativo", manutencao: "Em manutenção" };

    function cardSensor(sensor) {

        const info = infoSensor(sensor);
        const temValor = sensor.valor !== null && sensor.valor !== undefined;

        let estado = situacao(sensor.segundos_sem_sinal);

        if (sensor.status && sensor.status !== "ativo") {
            estado = { texto: ESTADOS[sensor.status] || sensor.status, classe: "alerta" };
        }

        const historico = sensor.historico || [];
        const faixa = historico.length > 1
            ? `Mín ${numero(Math.min(...historico), info.unidade)} · Máx ${numero(Math.max(...historico), info.unidade)} (últimas ${historico.length})`
            : "";

        const quando = temValor
            ? `atualizado ${tempoDecorrido(sensor.segundos_sem_sinal)}`
            : "sem leituras ainda";

        return `
            <article class="sensor-card">
                <header>
                    <h3>${escapeHtml(info.nome)}</h3>
                    <div class="sensor-acoes">
                        <i class="bi ${info.icone} sensor-icone" aria-hidden="true"></i>
                        ${sensor.exemplo ? `<span class="etiqueta-exemplo">Exemplo</span>` : `
                        <button type="button" class="btn-apagar" data-apagar-sensor="${sensor.id}"
                            data-nome="${escapeHtml(info.nome)}" data-codigo="${escapeHtml(sensor.codigo)}"
                            aria-label="Apagar o sensor ${escapeHtml(info.nome)}" title="Apagar sensor">
                            <i class="bi bi-trash3" aria-hidden="true"></i>
                        </button>`}
                    </div>
                </header>
                <span class="sensor-valor">${temValor ? numero(sensor.valor, info.unidade) : "—"}<small> ${escapeHtml(info.unidade)}</small></span>
                ${grafico(historico)}
                <span class="sensor-estado ${estado.classe}">${escapeHtml(estado.texto)}</span>
                <p class="sensor-meta">${escapeHtml(sensor.codigo)} · ${escapeHtml(quando)}</p>
                ${faixa ? `<p class="sensor-meta">${escapeHtml(faixa)}</p>` : ""}
            </article>
        `;
    }

    function renderizarSensores(sensores, dispositivos) {

        const vazio = sensores.length === 0 && dispositivos.length === 0;

        document.getElementById("iotVazio").classList.toggle("hidden", !vazio);

        gridSensores.innerHTML = sensores.map(cardSensor).join("");

        listaDispositivos.innerHTML = dispositivos.map(d => {

            const estado = situacao(d.segundos_sem_sinal);
            const qtdSensores = sensores.filter(s => s.codigo === d.codigo).length;

            return `
                <div class="dispositivo-chip ${estado.online ? "online" : estado.classe}">
                    <i class="bi bi-cpu" aria-hidden="true"></i>
                    <span><strong>${escapeHtml(d.nome)}</strong> · ${escapeHtml(d.codigo)}</span>
                    <span class="dispositivo-estado">${escapeHtml(estado.texto)}</span>
                    ${d.exemplo ? "" : `
                    <button type="button" class="btn-apagar" data-apagar-placa="${escapeHtml(d.codigo)}"
                        data-nome="${escapeHtml(d.nome)}" data-sensores="${qtdSensores}"
                        aria-label="Apagar a placa ${escapeHtml(d.nome)}" title="Apagar placa">
                        <i class="bi bi-trash3" aria-hidden="true"></i>
                    </button>`}
                </div>
            `;

        }).join("");

        const algumOnline = dispositivos.some(d => situacao(d.segundos_sem_sinal).online)
            || sensores.some(s => situacao(s.segundos_sem_sinal).online);

        document.getElementById("seloAoVivo").classList.toggle("hidden", !algumOnline);
    }

    /* ======================================================
       RESUMO DA FAZENDA (atualização automática)
    ====================================================== */

    const selectFazenda = document.getElementById("selectFazenda");
    const iotAtualizacao = document.getElementById("iotAtualizacao");
    let fazendas = [];
    let carregando = false;
    let temporizador = null;

    // Sem nenhuma placa/sensor real ainda: mostra os dados de exemplo do plano (gestao-demo.js),
    // no mesmo formato do backend. A primeira placa real faz o exemplo sumir sozinho.
    function dadosParaExibir(dados) {

        const semDadosReais = dados.sensores.length === 0 && (dados.dispositivos || []).length === 0;

        if (!semDadosReais || !plano || !window.GestaoDemo) return dados;

        const exemplo = window.GestaoDemo.gerar(plano.id);

        if (dados.fazendas.length) {
            // Mantém as propriedades reais e usa só as leituras de exemplo.
            return { ...exemplo, fazendas: dados.fazendas, resumo: { ...dados.resumo, dispositivos: exemplo.resumo.dispositivos } };
        }

        return exemplo;
    }

    function renderizarPropriedade(fazendaId, lista = fazendas) {

        const fazenda = lista.find(f => f.id === Number(fazendaId)) || lista[0];

        if (!fazenda) {

            document.getElementById("propNome").textContent = "Nenhuma propriedade cadastrada";
            document.getElementById("propDetalhe").textContent =
                "Conecte seu primeiro ESP32 para cadastrar a propriedade onde ele está instalado.";

            return;
        }

        const area = fazenda.area_total
            ? `${fazenda.area_total.toLocaleString("pt-BR")} ha`
            : "Área não informada";

        document.getElementById("propNome").textContent = fazenda.nome;
        document.getElementById("propDetalhe").textContent =
            `${fazenda.localizacao || "Localização não informada"} · ${area}`;
    }

    function preencherSelectFazendas() {

        const atual = selectFazenda.value;

        selectFazenda.innerHTML =
            `<option value="">Todas as propriedades</option>` +
            fazendas.map(f => `<option value="${f.id}">${escapeHtml(f.nome)}</option>`).join("");

        selectFazenda.value = fazendas.some(f => String(f.id) === atual) ? atual : "";
        selectFazenda.classList.toggle("hidden", fazendas.length < 2);
    }

    async function carregar() {

        if (carregando) return;

        carregando = true;

        try {

            const fazendaId = selectFazenda.value;
            const consulta = fazendaId ? `?fazenda_id=${encodeURIComponent(fazendaId)}` : "";

            const { status, dados } = await chamarApi("gestao/resumo.php" + consulta);

            if (status !== 200 || !dados.sucesso) {

                pararAtualizacao();

                document.getElementById("conteudoGestao").classList.add("hidden");
                document.getElementById("mensagemAcesso").textContent =
                    dados.mensagem || "Não foi possível carregar a Gestão da Fazenda.";
                document.getElementById("acessoNegado").classList.remove("hidden");

                return;
            }

            document.getElementById("conteudoGestao").classList.remove("hidden");

            const idsAntes = fazendas.map(f => f.id).join(",");
            fazendas = dados.fazendas;

            if (fazendas.map(f => f.id).join(",") !== idsAntes) preencherSelectFazendas();

            const exibir = dadosParaExibir(dados);

            document.getElementById("avisoExemplo").classList.toggle("hidden", !exibir.exemplo);

            document.getElementById("totalPropriedades").textContent = exibir.resumo.propriedades;
            document.getElementById("totalTalhoes").textContent = exibir.resumo.talhoes;
            document.getElementById("totalSafras").textContent = exibir.resumo.safras_ativas;
            document.getElementById("totalDispositivos").textContent = exibir.resumo.dispositivos;

            renderizarPropriedade(fazendaId, exibir.fazendas);
            renderizarSensores(exibir.sensores, exibir.dispositivos || []);
            atualizarCena3d(exibir.sensores);

            if (recursos.automacao) atualizarAutomacao(exibir.sensores, Boolean(exibir.exemplo));
            if (recursos.dashboard) atualizarPainelPro(exibir.sensores);

            iotAtualizacao.textContent =
                `Painel atualizado às ${new Date().toLocaleTimeString("pt-BR")} · atualiza sozinho a cada ${INTERVALO_MS / 1000} s`;

        } catch (erro) {

            console.error("Erro ao carregar a Gestão da Fazenda:", erro);
            iotAtualizacao.textContent = "Sem conexão com o servidor. Tentando de novo...";

        } finally {

            carregando = false;
        }
    }

    function iniciarAtualizacao() {

        pararAtualizacao();
        temporizador = setInterval(carregar, INTERVALO_MS);
    }

    function pararAtualizacao() {

        clearInterval(temporizador);
        temporizador = null;
    }

    // Aba oculta não consulta o servidor; ao voltar, atualiza na hora.
    document.addEventListener("visibilitychange", () => {

        if (document.hidden) {
            pararAtualizacao();
        } else if (!document.getElementById("conteudoGestao").classList.contains("hidden")) {
            carregar();
            iniciarAtualizacao();
        }
    });

    selectFazenda.addEventListener("change", carregar);

    /* ======================================================
       CONECTAR ESP32
    ====================================================== */

    const modalEsp = document.getElementById("modalEsp");
    const formEsp = document.getElementById("formEsp");
    const espErro = document.getElementById("espErro");
    const salvarEsp = document.getElementById("salvarEsp");
    const espSucesso = document.getElementById("espSucesso");

    function abrirModalEsp() {

        formEsp.reset();
        espErro.textContent = "";
        formEsp.classList.remove("hidden");
        espSucesso.classList.add("hidden");

        const temFazenda = fazendas.length > 0;

        document.getElementById("campoFazenda").classList.toggle("hidden", !temFazenda);
        document.getElementById("novaFazenda").classList.toggle("hidden", temFazenda);

        document.getElementById("espFazenda").innerHTML =
            fazendas.map(f => `<option value="${f.id}">${escapeHtml(f.nome)}</option>`).join("");

        if (selectFazenda.value) {
            document.getElementById("espFazenda").value = selectFazenda.value;
        }

        modalEsp.classList.add("ativo");
        document.getElementById("espCodigo").focus();
    }

    function fecharModalEsp() {

        modalEsp.classList.remove("ativo");
        document.getElementById("espToken").textContent = "";
    }

    document.getElementById("btnConectarEsp").addEventListener("click", abrirModalEsp);
    document.getElementById("fecharModalEsp").addEventListener("click", fecharModalEsp);
    document.getElementById("cancelarEsp").addEventListener("click", fecharModalEsp);
    document.getElementById("concluirEsp").addEventListener("click", fecharModalEsp);

    modalEsp.addEventListener("click", (e) => {
        if (e.target === modalEsp) fecharModalEsp();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modalEsp.classList.contains("ativo")) fecharModalEsp();
    });

    formEsp.addEventListener("submit", async (e) => {

        e.preventDefault();
        espErro.textContent = "";

        const codigo = document.getElementById("espCodigo").value.trim().toUpperCase();

        if (!/^[A-Z0-9][A-Z0-9-]{3,39}$/.test(codigo)) {
            espErro.textContent = "Informe o código exibido no monitor serial (ex.: ESP32-MR-1A2B3C).";
            return;
        }

        const corpo = { codigo, nome: document.getElementById("espNome").value.trim() };

        if (fazendas.length > 0) {
            corpo.fazenda_id = Number(document.getElementById("espFazenda").value);
        } else {
            corpo.fazenda = {
                nome: document.getElementById("fazNome").value.trim(),
                localizacao: document.getElementById("fazLocal").value.trim(),
                area_total: document.getElementById("fazArea").value.trim()
            };

            if (!corpo.fazenda.nome) {
                espErro.textContent = "Informe o nome da propriedade.";
                return;
            }
        }

        salvarEsp.disabled = true;

        try {

            const { status, dados } = await chamarApi("iot/dispositivos.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(corpo)
            });

            if (status !== 201 || !dados.sucesso) {
                espErro.textContent = dados.mensagem || "Não foi possível conectar o ESP32.";
                return;
            }

            document.getElementById("espSucessoMsg").textContent = dados.mensagem;
            document.getElementById("espSucessoCodigo").textContent = dados.codigo;
            document.getElementById("espToken").textContent = dados.token;

            formEsp.classList.add("hidden");
            espSucesso.classList.remove("hidden");

            await carregar();

        } catch (erro) {

            console.error("Erro ao conectar ESP32:", erro);
            espErro.textContent = "Sem conexão com o servidor. Tente novamente.";

        } finally {

            salvarEsp.disabled = false;
        }
    });

    document.getElementById("copiarToken").addEventListener("click", async (e) => {

        const botao = e.currentTarget;

        try {
            await navigator.clipboard.writeText(document.getElementById("espToken").textContent);
            botao.innerHTML = '<i class="bi bi-check2"></i> Copiado';
        } catch (erro) {
            botao.innerHTML = '<i class="bi bi-x"></i> Copie manualmente';
        }

        setTimeout(() => { botao.innerHTML = '<i class="bi bi-clipboard"></i> Copiar'; }, 2500);
    });

    /* ======================================================
       APAGAR SENSOR OU PLACA
    ====================================================== */

    const modalApagar = document.getElementById("modalApagar");
    const btnConfirmarApagar = document.getElementById("confirmarApagar");
    const apagarErro = document.getElementById("apagarErro");
    let pedidoApagar = null;

    function abrirModalApagar(botao) {

        const { apagarSensor, apagarPlaca, nome, codigo, sensores } = botao.dataset;

        if (apagarSensor) {
            pedidoApagar = { corpo: { sensor_id: Number(apagarSensor) } };
            document.getElementById("tituloModalApagar").textContent = "Apagar sensor?";
            document.getElementById("textoApagar").textContent =
                `O sensor "${nome}" (${codigo}) e todas as leituras dele serão apagados. ` +
                "A placa continua conectada, mas esse tipo de leitura deixa de ser gravado. " +
                "Para voltar a gravar, conecte a placa de novo em Conectar ESP32.";
        } else {
            const qtd = Number(sensores) || 0;
            pedidoApagar = { corpo: { dispositivo: apagarPlaca } };
            document.getElementById("tituloModalApagar").textContent = "Apagar placa?";
            document.getElementById("textoApagar").textContent =
                `A placa "${nome}" (${apagarPlaca}), ${qtd === 1 ? "o sensor dela" : `os ${qtd} sensores dela`} ` +
                "e todas as leituras serão apagados, e o token usado pela ponte deixa de funcionar.";
        }

        apagarErro.textContent = "";
        btnConfirmarApagar.disabled = false;
        modalApagar.classList.add("ativo");
        document.getElementById("cancelarApagar").focus();
    }

    function fecharModalApagar() {

        modalApagar.classList.remove("ativo");
        pedidoApagar = null;
    }

    // Os cards são redesenhados a cada atualização: os cliques são tratados na lista.
    [gridSensores, listaDispositivos].forEach(lista => lista.addEventListener("click", (e) => {
        const botao = e.target.closest(".btn-apagar");
        if (botao) abrirModalApagar(botao);
    }));

    document.getElementById("cancelarApagar").addEventListener("click", fecharModalApagar);
    document.getElementById("fecharModalApagar").addEventListener("click", fecharModalApagar);

    modalApagar.addEventListener("click", (e) => {
        if (e.target === modalApagar) fecharModalApagar();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modalApagar.classList.contains("ativo")) fecharModalApagar();
    });

    btnConfirmarApagar.addEventListener("click", async () => {

        if (!pedidoApagar) return;

        btnConfirmarApagar.disabled = true;
        apagarErro.textContent = "";

        try {

            const { status, dados } = await chamarApi("iot/excluir.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pedidoApagar.corpo)
            });

            if (status !== 200 || !dados.sucesso) {
                apagarErro.textContent = dados.mensagem || "Não foi possível apagar.";
                btnConfirmarApagar.disabled = false;
                return;
            }

            fecharModalApagar();
            await carregar();
            iotAtualizacao.textContent = `${dados.mensagem} ${iotAtualizacao.textContent}`;

        } catch (erro) {

            console.error("Erro ao apagar:", erro);
            apagarErro.textContent = "Sem conexão com o servidor. Tente novamente.";
            btnConfirmarApagar.disabled = false;
        }
    });

    /* ======================================================
       AUTOMAÇÃO (todos os planos)
       Cada regra olha um tipo de sensor e liga/desliga um equipamento, com uma folga
       (histerese) para não ficar ligando e desligando. Hoje o estado só aparece na tela;
       no futuro, "ligado" vira um comando para o relé do ESP32 (ex.: rota iot/comandos.php).
    ====================================================== */

    const REGRAS = [
        {
            id: "irrigacao", nome: "Irrigação", icone: "bi-droplet-half", sensor: "umidade_solo",
            liga: v => v < 35, desliga: v => v > 55,
            texto: "Liga sozinha quando a umidade da terra fica abaixo de 35% e desliga acima de 55%."
        },
        {
            id: "ventilacao", nome: "Ventilação da estufa", icone: "bi-fan", sensor: "temperatura",
            liga: v => v > 28, desliga: v => v < 25,
            texto: "Liga sozinha quando a estufa passa de 28 °C e desliga abaixo de 25 °C."
        },
        {
            id: "luz", nome: "Iluminação da estufa", icone: "bi-lightbulb", sensor: "luminosidade",
            liga: v => v < 12000, desliga: v => v > 16000,
            texto: "Acende sozinha quando a luz fica abaixo de 12.000 lx e apaga acima de 16.000 lx."
        }
    ];

    const chaveModos = `marketplace:automacao:${usuarioSessao.id}`;
    const ligados = { irrigacao: false, ventilacao: false, luz: false };
    let modos = {};
    let ultimosSensores = [];
    let usandoExemplo = false;

    try {
        modos = JSON.parse(localStorage.getItem(chaveModos)) || {};
    } catch (erro) {
        modos = {};
    }

    const modoDe = id => modos[id] || "auto";

    function calcularAtuadores(sensores) {

        REGRAS.forEach(regra => {
            const sensor = sensores.find(s => s.tipo === regra.sensor && s.valor !== null && s.valor !== undefined);
            const modo = modoDe(regra.id);

            if (modo === "ligado") ligados[regra.id] = true;
            else if (modo === "desligado") ligados[regra.id] = false;
            else if (sensor) {
                if (!ligados[regra.id] && regra.liga(sensor.valor)) ligados[regra.id] = true;
                else if (ligados[regra.id] && regra.desliga(sensor.valor)) ligados[regra.id] = false;
            }
        });

        // Nos dados de exemplo, os equipamentos mudam as leituras (terra molhada, estufa mais fresca...).
        if (usandoExemplo) window.GestaoDemo?.definirAtuadores({ ...ligados });
    }

    function desenharAutomacao() {

        document.getElementById("gridAutomacao").innerHTML = REGRAS.map(regra => {

            const sensor = ultimosSensores.find(s => s.tipo === regra.sensor);
            const info = sensor ? infoSensor(sensor) : null;
            const temValor = sensor && sensor.valor !== null && sensor.valor !== undefined;
            const ligado = ligados[regra.id];
            const modo = modoDe(regra.id);

            const botao = (valor, rotulo, icone) => `
                <button type="button" data-regra="${regra.id}" data-modo="${valor}"
                    aria-pressed="${modo === valor}" class="${modo === valor ? "ativo" : ""}">
                    <i class="bi ${icone}" aria-hidden="true"></i> ${rotulo}
                </button>`;

            return `
                <article class="auto-card ${ligado ? "ligado" : ""}">
                    <header>
                        <span class="auto-icone" aria-hidden="true"><i class="bi ${regra.icone}"></i></span>
                        <div>
                            <h3>${regra.nome}</h3>
                            <span class="auto-estado">
                                <i class="bi ${ligado ? "bi-toggle-on" : "bi-toggle-off"}" aria-hidden="true"></i>
                                ${ligado ? "LIGADA" : "DESLIGADA"}
                            </span>
                        </div>
                    </header>
                    <p class="auto-regra">${regra.texto}</p>
                    <p class="auto-leitura">
                        ${temValor
                            ? `Agora: <strong>${numero(sensor.valor, info.unidade)} ${escapeHtml(info.unidade)}</strong> (${escapeHtml(info.nome.toLowerCase())})`
                            : "Aguardando o sensor enviar a primeira leitura."}
                    </p>
                    <div class="auto-modos" role="group" aria-label="Modo da ${regra.nome}">
                        ${botao("auto", "Automático", "bi-magic")}
                        ${botao("ligado", "Ligar", "bi-power")}
                        ${botao("desligado", "Desligar", "bi-x-octagon")}
                    </div>
                </article>
            `;
        }).join("");
    }

    function atualizarAutomacao(sensores, exemplo) {

        ultimosSensores = sensores;
        usandoExemplo = exemplo;
        calcularAtuadores(sensores);
        desenharAutomacao();
    }

    document.getElementById("gridAutomacao").addEventListener("click", (e) => {

        const botao = e.target.closest("[data-regra]");
        if (!botao) return;

        modos[botao.dataset.regra] = botao.dataset.modo;

        try {
            localStorage.setItem(chaveModos, JSON.stringify(modos));
        } catch (erro) {
            // Sem armazenamento: o modo vale só até recarregar a página.
        }

        calcularAtuadores(ultimosSensores);
        desenharAutomacao();
        document.querySelector(`[data-regra="${botao.dataset.regra}"][data-modo="${botao.dataset.modo}"]`)?.focus();
    });

    /* ======================================================
       PAINEL COMPLETO (Plano Pro)
       Indicadores, gráfico grande com a faixa ideal, alertas e trator.
    ====================================================== */

    const FAIXA_IDEAL = {
        umidade_solo: [35, 60],
        temperatura: [18, 28],
        umidade_ar: [50, 80],
        luminosidade: [10000, 30000]
    };

    let sensorGrafico = "umidade_solo";
    const alertas = [];
    const ultimoAlerta = {};

    function registrarAlertas(sensores) {

        sensores.forEach(sensor => {

            const faixa = FAIXA_IDEAL[sensor.tipo];
            if (!faixa || sensor.valor === null || sensor.valor === undefined) return;

            const info = infoSensor(sensor);
            const fora = sensor.valor < faixa[0] ? "abaixo" : sensor.valor > faixa[1] ? "acima" : null;

            // Registra só quando o sensor SAI da faixa (não a cada atualização).
            if (fora && ultimoAlerta[sensor.tipo] !== fora) {
                alertas.unshift({
                    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                    texto: `${info.nome} ${fora} do ideal: ${numero(sensor.valor, info.unidade)} ${info.unidade}`,
                    grave: Math.abs(sensor.valor - (fora === "abaixo" ? faixa[0] : faixa[1])) > (faixa[1] - faixa[0]) * 0.25
                });
                alertas.splice(8);
            }

            ultimoAlerta[sensor.tipo] = fora;
        });

        document.getElementById("listaAlertas").innerHTML = alertas.length
            ? alertas.map(a => `
                <li class="${a.grave ? "grave" : ""}">
                    <i class="bi ${a.grave ? "bi-exclamation-octagon-fill" : "bi-exclamation-triangle-fill"}" aria-hidden="true"></i>
                    <span><strong>${a.hora}</strong> · ${escapeHtml(a.texto)}</span>
                </li>`).join("")
            : `<li class="ok"><i class="bi bi-check-circle-fill" aria-hidden="true"></i><span>Tudo dentro do ideal até agora.</span></li>`;
    }

    function graficoGrande(sensor) {

        const valores = sensor.historico?.length ? sensor.historico : [sensor.valor];
        const info = infoSensor(sensor);
        const faixa = FAIXA_IDEAL[sensor.tipo];
        const L = 800, A = 260, ME = 64, MD = 16, MT = 16, MB = 30;

        let min = Math.min(...valores, ...(faixa || []));
        let max = Math.max(...valores, ...(faixa || []));
        const folga = (max - min) * 0.1 || 1;
        min -= folga;
        max += folga;

        const x = i => ME + (valores.length < 2 ? (L - ME - MD) : (i / (valores.length - 1)) * (L - ME - MD));
        const y = v => MT + (1 - (v - min) / (max - min)) * (A - MT - MB);

        const linhas = [0, 0.25, 0.5, 0.75, 1].map(t => {
            const v = min + (max - min) * (1 - t);
            const yy = MT + t * (A - MT - MB);
            return `<line x1="${ME}" x2="${L - MD}" y1="${yy}" y2="${yy}" class="g-grade"/>
                    <text x="${ME - 8}" y="${yy + 4}" text-anchor="end" class="g-texto">${numero(v, info.unidade)}</text>`;
        }).join("");

        const banda = faixa
            ? `<rect x="${ME}" width="${L - ME - MD}" y="${y(faixa[1])}" height="${y(faixa[0]) - y(faixa[1])}" class="g-faixa"/>`
            : "";

        const pontos = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
        const ult = valores.length - 1;

        return `
            <svg viewBox="0 0 ${L} ${A}" aria-hidden="true">
                ${banda}
                ${linhas}
                <polyline points="${pontos}" class="g-linha" vector-effect="non-scaling-stroke"/>
                <circle cx="${x(ult)}" cy="${y(valores[ult])}" r="6" class="g-ponto"/>
                <text x="${ME}" y="${A - 8}" class="g-texto">mais antiga</text>
                <text x="${L - MD}" y="${A - 8}" text-anchor="end" class="g-texto">agora</text>
            </svg>
        `;
    }

    let sensoresPainel = [];

    function atualizarPainelPro(sensores) {

        sensoresPainel = sensores;

        const comValor = sensores.filter(s => s.valor !== null && s.valor !== undefined);

        // Indicadores (KPIs): valor atual, média, mínima e máxima das últimas leituras.
        document.getElementById("kpisPro").innerHTML = comValor.map(sensor => {
            const info = infoSensor(sensor);
            const h = sensor.historico?.length ? sensor.historico : [sensor.valor];
            const media = h.reduce((a, b) => a + b, 0) / h.length;
            const faixa = FAIXA_IDEAL[sensor.tipo];
            const ok = !faixa || (sensor.valor >= faixa[0] && sensor.valor <= faixa[1]);

            return `
                <article class="kpi ${ok ? "" : "fora"}">
                    <span class="kpi-titulo"><i class="bi ${info.icone}" aria-hidden="true"></i> ${escapeHtml(info.nome)}</span>
                    <strong>${numero(sensor.valor, info.unidade)} <small>${escapeHtml(info.unidade)}</small></strong>
                    <span class="kpi-situacao">${ok ? "✔ Dentro do ideal" : "⚠ Fora do ideal"}</span>
                    <span class="kpi-extra">Média ${numero(media, info.unidade)} · Mín ${numero(Math.min(...h), info.unidade)} · Máx ${numero(Math.max(...h), info.unidade)}</span>
                </article>
            `;
        }).join("");

        // Abas do gráfico (uma por sensor).
        if (!comValor.some(s => s.tipo === sensorGrafico) && comValor.length) sensorGrafico = comValor[0].tipo;

        document.getElementById("abasGrafico").innerHTML = comValor.map(sensor => {
            const info = infoSensor(sensor);
            const ativa = sensor.tipo === sensorGrafico;
            return `<button type="button" role="tab" aria-selected="${ativa}" data-grafico="${escapeHtml(sensor.tipo)}">
                        <i class="bi ${info.icone}" aria-hidden="true"></i> ${escapeHtml(info.nome)}
                    </button>`;
        }).join("");

        const escolhido = comValor.find(s => s.tipo === sensorGrafico);
        const caixa = document.getElementById("graficoGrande");

        if (escolhido) {
            const info = infoSensor(escolhido);
            caixa.innerHTML = graficoGrande(escolhido);
            caixa.setAttribute("aria-label",
                `Gráfico de ${info.nome}: agora ${numero(escolhido.valor, info.unidade)} ${info.unidade}`);
        } else {
            caixa.innerHTML = `<p class="grafico-vazio">Os gráficos aparecem quando os sensores enviarem leituras.</p>`;
        }

        registrarAlertas(comValor);
        desenharTrator();
    }

    document.getElementById("abasGrafico").addEventListener("click", (e) => {
        const aba = e.target.closest("[data-grafico]");
        if (!aba) return;
        sensorGrafico = aba.dataset.grafico;
        atualizarPainelPro(sensoresPainel);
    });

    function desenharTrator() {

        const t = window.GestaoDemo?.gerarTrator();
        if (!t) return;

        const item = (icone, rotulo, valor, alerta = false) => `
            <div class="trator-item ${alerta ? "fora" : ""}">
                <i class="bi ${icone}" aria-hidden="true"></i>
                <span>${rotulo}</span>
                <strong>${valor}</strong>
            </div>`;

        document.getElementById("tratorGrid").innerHTML =
            item("bi-speedometer", "Velocidade", `${numero(t.velocidade, "")} km/h`) +
            item("bi-fuel-pump", "Combustível", `${Math.round(t.combustivel)}%`, t.combustivel < 20) +
            item("bi-gear", "Motor", `${t.rpm.toLocaleString("pt-BR")} rpm`) +
            item("bi-thermometer-half", "Temp. do motor", `${t.temperatura} °C`, t.temperatura > 98) +
            item("bi-basket", "Carga da carreta", `${Math.round(t.carga)}%`, t.carga > 90) +
            item("bi-geo-alt", "Localização", "Talhão 2");
    }

    // Visita técnica (demonstração: só mostra a confirmação na tela).
    document.getElementById("btnVisitaTecnica").addEventListener("click", (e) => {

        const data = new Date();
        data.setDate(data.getDate() + 2);

        document.getElementById("suporteStatus").innerHTML =
            `<i class="bi bi-check-circle-fill" aria-hidden="true"></i> Pedido registrado (demonstração). ` +
            `A equipe técnica entraria em contato para a visita em <strong>${data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</strong>.`;

        e.currentTarget.disabled = true;
        e.currentTarget.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i> Visita pedida';
    });

    /* ======================================================
       FAZENDA EM 3D (pacote ../vendor/fazenda-3d, ~280 KB compactado)
       Mostra os sensores do plano (tutorial). Só é baixado quando a seção chega perto da tela.
    ====================================================== */

    const VERSAO_CENA_3D = "5";
    const palco3d = document.getElementById("palco3d");
    const estado3d = document.getElementById("estado3d");
    let cena3d = null;
    let sensoresParaCena = [];

    function atualizarCena3d(sensores) {

        sensoresParaCena = sensores || [];
        cena3d?.atualizar(sensoresParaCena);
    }

    function carregarCena3d() {

        const estilo = document.createElement("link");
        estilo.rel = "stylesheet";
        estilo.href = `../vendor/fazenda-3d/fazenda-3d.css?v=${VERSAO_CENA_3D}`;
        document.head.append(estilo);

        const script = document.createElement("script");
        script.src = `../vendor/fazenda-3d/fazenda-3d.js?v=${VERSAO_CENA_3D}`;
        script.async = true;

        script.addEventListener("load", () => {
            try {
                estado3d.remove();
                cena3d = window.FazendaInteligente3D.montar(palco3d, {
                    sensoresReais: sensoresParaCena,
                    titulo: plano ? `Fazenda no ${plano.nome}` : "Fazenda em 3D",
                    grupos: plano?.grupos3d || null
                });
            } catch (erro) {
                console.error("Visão 3D:", erro);
                palco3d.innerHTML = '<p class="visao-3d-estado">Não foi possível exibir a visão 3D neste navegador.</p>';
            }
        });

        script.addEventListener("error", () => {
            estado3d.textContent = "Não foi possível carregar a visão 3D. Recarregue a página para tentar de novo.";
        });

        document.body.append(script);
    }

    if ("IntersectionObserver" in window) {

        const observador = new IntersectionObserver((entradas) => {
            if (entradas.some(e => e.isIntersecting)) {
                observador.disconnect();
                carregarCena3d();
            }
        }, { rootMargin: "300px 0px" });

        observador.observe(palco3d);

    } else {

        carregarCena3d();
    }

    /* ======================================================
       INÍCIO
    ====================================================== */

    await carregar();

    if (!document.getElementById("conteudoGestao").classList.contains("hidden")) {

        iniciarAtualizacao();

        // Primeiro acesso à aba (ou ?tour=1): o Broto apresenta a Gestão da Fazenda.
        window.iniciarOnboarding?.(usuarioSessao, "gestao");
    }

});
