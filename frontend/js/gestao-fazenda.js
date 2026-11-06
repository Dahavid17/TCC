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

    try {

        const { dados } = await chamarApi("auth/sessao.php");

        if (!dados.sucesso) {
            window.location.href = "login-marketplace.html";
            return;
        }

        const { usuario } = dados;
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
                    <i class="bi ${info.icone}" aria-hidden="true"></i>
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

            return `
                <div class="dispositivo-chip ${estado.online ? "online" : estado.classe}">
                    <i class="bi bi-cpu" aria-hidden="true"></i>
                    <span><strong>${escapeHtml(d.nome)}</strong> · ${escapeHtml(d.codigo)}</span>
                    <span class="dispositivo-estado">${escapeHtml(estado.texto)}</span>
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

    function renderizarPropriedade(fazendaId) {

        const fazenda = fazendas.find(f => f.id === Number(fazendaId)) || fazendas[0];

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

            document.getElementById("totalPropriedades").textContent = dados.resumo.propriedades;
            document.getElementById("totalTalhoes").textContent = dados.resumo.talhoes;
            document.getElementById("totalSafras").textContent = dados.resumo.safras_ativas;
            document.getElementById("totalDispositivos").textContent = dados.resumo.dispositivos;

            renderizarPropriedade(fazendaId);
            renderizarSensores(dados.sensores, dados.dispositivos || []);

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
       INÍCIO
    ====================================================== */

    await carregar();

    if (!document.getElementById("conteudoGestao").classList.contains("hidden")) {
        iniciarAtualizacao();
    }

});
