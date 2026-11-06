document.addEventListener("DOMContentLoaded", async () => {

    const API = "../../backend/";

    // Usados somente quando NÃO há sensores no banco. Sempre exibidos com o selo "Dado demonstrativo".
    const SENSORES_DEMONSTRATIVOS = [
        { tipo: "Umidade do solo", valor: 62, unidade: "%", icone: "bi-moisture" },
        { tipo: "Temperatura ambiente", valor: 24.5, unidade: "°C", icone: "bi-thermometer-half" },
        { tipo: "Umidade dos grãos", valor: 13.2, unidade: "%", icone: "bi-droplet-half" },
        { tipo: "Nível do silo", valor: 78, unidade: "%", icone: "bi-database" }
    ];

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

    async function chamarApi(caminho) {

        const resposta = await fetch(API + caminho);

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
       SENSORES
    ====================================================== */

    const gridSensores = document.getElementById("gridSensores");

    function infoSensor(tipo) {

        const t = (tipo || "").toLowerCase();

        if (t.includes("solo")) return { nome: "Umidade do solo", unidade: "%", icone: "bi-moisture" };
        if (t.includes("temp")) return { nome: "Temperatura ambiente", unidade: "°C", icone: "bi-thermometer-half" };
        if (t.includes("gr")) return { nome: "Umidade dos grãos", unidade: "%", icone: "bi-droplet-half" };
        if (t.includes("silo")) return { nome: "Nível do silo", unidade: "%", icone: "bi-database" };

        return { nome: tipo || "Sensor", unidade: "", icone: "bi-cpu" };
    }

    function numero(valor) {

        return valor.toFixed(1).replace(".", ",");
    }

    function dataHoraBr(texto) {

        const [data, hora] = texto.split(" ");
        const [ano, mes, dia] = data.split("-");

        return `${dia}/${mes}/${ano} ${hora.slice(0, 5)}`;
    }

    function cardSensor({ nome, icone, valor, unidade, estado, classeEstado, meta }) {

        return `
            <article class="sensor-card">
                <header>
                    <h3>${escapeHtml(nome)}</h3>
                    <i class="bi ${icone}"></i>
                </header>
                <span class="sensor-valor">${valor === null ? "—" : numero(valor)}<small> ${escapeHtml(unidade)}</small></span>
                <span class="sensor-estado ${classeEstado}">${escapeHtml(estado)}</span>
                <p class="sensor-meta">${escapeHtml(meta)}</p>
            </article>
        `;
    }

    function renderizarSensores(sensores) {

        const demonstrativo = sensores.length === 0;

        document.getElementById("seloDemo").classList.toggle("hidden", !demonstrativo);
        document.getElementById("avisoDemo").classList.toggle("hidden", !demonstrativo);

        if (demonstrativo) {

            gridSensores.innerHTML = SENSORES_DEMONSTRATIVOS.map(s => cardSensor({
                nome: s.tipo,
                icone: s.icone,
                valor: s.valor,
                unidade: s.unidade,
                estado: "Simulado",
                classeEstado: "simulado",
                meta: "Dado demonstrativo · sem dispositivo conectado"
            })).join("");

            return;
        }

        const ESTADOS = { ativo: "Ativo", inativo: "Inativo", manutencao: "Em manutenção" };

        gridSensores.innerHTML = sensores.map(s => {

            const info = infoSensor(s.tipo);

            return cardSensor({
                nome: info.nome,
                icone: info.icone,
                valor: s.valor,
                unidade: info.unidade,
                estado: ESTADOS[s.status] || s.status,
                classeEstado: s.status === "ativo" ? "" : "alerta",
                meta: s.ultima_leitura
                    ? `Dispositivo ${s.codigo} · atualizado em ${dataHoraBr(s.ultima_leitura)}`
                    : `Dispositivo ${s.codigo} · sem leituras registradas`
            });

        }).join("");
    }

    /* ======================================================
       RESUMO DA FAZENDA
    ====================================================== */

    const selectFazenda = document.getElementById("selectFazenda");
    let fazendas = [];

    function renderizarPropriedade(fazendaId) {

        const fazenda = fazendas.find(f => f.id === Number(fazendaId)) || fazendas[0];

        if (!fazenda) {

            document.getElementById("propNome").textContent = "Nenhuma propriedade cadastrada";
            document.getElementById("propDetalhe").textContent =
                "O cadastro de propriedades ainda não está disponível nesta versão.";

            return;
        }

        document.getElementById("propNome").textContent = fazenda.nome;
        document.getElementById("propDetalhe").textContent =
            `${fazenda.localizacao || "Localização não informada"} · ${fazenda.area_total.toLocaleString("pt-BR")} ha`;
    }

    async function carregar(fazendaId) {

        const consulta = fazendaId ? `?fazenda_id=${encodeURIComponent(fazendaId)}` : "";

        const { status, dados } = await chamarApi("gestao/resumo.php" + consulta);

        if (status === 403) {

            document.getElementById("mensagemAcesso").textContent = dados.mensagem;
            document.getElementById("acessoNegado").classList.remove("hidden");

            return;
        }

        if (status !== 200 || !dados.sucesso) {

            document.getElementById("mensagemAcesso").textContent =
                dados.mensagem || "Não foi possível carregar a Gestão da Fazenda.";
            document.getElementById("acessoNegado").classList.remove("hidden");

            return;
        }

        document.getElementById("conteudoGestao").classList.remove("hidden");

        fazendas = dados.fazendas;

        document.getElementById("totalPropriedades").textContent = dados.resumo.propriedades;
        document.getElementById("totalTalhoes").textContent = dados.resumo.talhoes;
        document.getElementById("totalSafras").textContent = dados.resumo.safras_ativas;
        document.getElementById("totalDispositivos").textContent = dados.resumo.dispositivos;

        if (fazendas.length > 1 && selectFazenda.classList.contains("hidden")) {

            selectFazenda.innerHTML =
                `<option value="">Todas as propriedades</option>` +
                fazendas.map(f => `<option value="${f.id}">${escapeHtml(f.nome)}</option>`).join("");

            selectFazenda.classList.remove("hidden");
        }

        renderizarPropriedade(fazendaId);
        renderizarSensores(dados.sensores);
    }

    selectFazenda.addEventListener("change", () => carregar(selectFazenda.value));

    try {

        await carregar("");

    } catch (erro) {

        console.error("Erro ao carregar a Gestão da Fazenda:", erro);
    }

});
