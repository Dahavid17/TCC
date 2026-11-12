// Página de planos da Gestão da Fazenda (DEMONSTRAÇÃO: nenhum pagamento é feito).
// Escolher um plano grava a preferência "plano" do usuário e abre a Gestão da Fazenda,
// que passa a mostrar os recursos do plano escolhido.

document.addEventListener("DOMContentLoaded", async () => {

    const API = "../../backend/";
    const PLANOS = window.PLANOS_FAZENDA;
    const VERSAO_CENA_3D = "5";

    /* ---------- TEMA ---------- */

    const temaBtn = document.getElementById("temaBtn");

    if (localStorage.getItem("marketplace:tema") === "dark") {
        document.body.classList.add("dark");
        temaBtn.querySelector("i").className = "bi bi-sun-fill";
    }

    temaBtn.addEventListener("click", () => {
        const dark = document.body.classList.toggle("dark");
        temaBtn.querySelector("i").className = dark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
        localStorage.setItem("marketplace:tema", dark ? "dark" : "light");
    });

    document.getElementById("btnMensagens").addEventListener("click", () => {
        window.location.href = "negociacoes.html";
    });

    /* ---------- SESSÃO ---------- */

    let usuario = null;

    try {
        const resposta = await fetch(API + "auth/sessao.php");
        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            window.location.href = "login-marketplace.html";
            return;
        }

        usuario = dados.usuario;

        if (!["produtor", "admin"].includes(usuario.tipo_acesso)) {
            window.location.href = "gestao-fazenda.html"; // lá aparece o aviso de área exclusiva
            return;
        }

        const tipo = usuario.tipo_acesso || "";
        document.getElementById("nomeUsuario").textContent = usuario.nome;
        document.getElementById("tipoUsuario").textContent = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        document.getElementById("avatarUsuario").textContent = usuario.nome.charAt(0).toUpperCase();

    } catch (erro) {
        console.error("Planos: erro ao verificar a sessão", erro);
        return;
    }

    await PreferenciasUsuario.carregar(usuario);
    const planoAtual = PreferenciasUsuario.obter("plano");

    /* ---------- ESCOLHER ---------- */

    async function escolher(id, botao) {

        if (botao) {
            botao.disabled = true;
            botao.innerHTML = '<i class="bi bi-arrow-repeat girando" aria-hidden="true"></i> Abrindo a Gestão da Fazenda…';
        }

        pararNarracao();
        await PreferenciasUsuario.definir("plano", id);
        window.location.href = "gestao-fazenda.html?plano=novo";
    }

    function rotuloEscolher(plano) {
        return planoAtual === plano.id
            ? `<i class="bi bi-arrow-right-circle-fill" aria-hidden="true"></i> Continuar no ${plano.nome}`
            : `<i class="bi bi-check-circle-fill" aria-hidden="true"></i> Quero o ${plano.nome}`;
    }

    /* ---------- CARTÕES ---------- */

    const grade = document.getElementById("gradePlanos");

    grade.innerHTML = Object.values(PLANOS).map(plano => `
        <article class="plano-card ${plano.id === "pro" ? "plano-pro" : ""} ${planoAtual === plano.id ? "plano-atual" : ""}"
            aria-labelledby="nome-${plano.id}">

            ${plano.destaque ? `<span class="plano-selo"><i class="bi bi-award-fill" aria-hidden="true"></i> ${plano.destaque}</span>` : ""}
            ${planoAtual === plano.id ? `<span class="plano-selo plano-selo-atual"><i class="bi bi-check-lg" aria-hidden="true"></i> Seu plano atual</span>` : ""}

            <div class="plano-cabeca">
                <span class="plano-icone" aria-hidden="true"><i class="bi ${plano.icone}"></i></span>
                <h2 id="nome-${plano.id}">${plano.nome}</h2>
            </div>

            <p class="plano-preco">
                <strong>${plano.preco}</strong> <span>${plano.periodo}</span>
                <small>valor ilustrativo</small>
            </p>

            <p class="plano-chamada">${plano.chamada}</p>

            <ul class="plano-itens">
                ${plano.itens.map(item => `
                    <li><i class="bi ${item.icone}" aria-hidden="true"></i><span>${item.texto}</span></li>
                `).join("")}
            </ul>

            <div class="plano-botoes">
                <button type="button" class="btn-escolher" data-escolher="${plano.id}">${rotuloEscolher(plano)}</button>
                <button type="button" class="btn-ver-3d" data-ver="${plano.id}">
                    <i class="bi bi-box" aria-hidden="true"></i> Ver como funciona em 3D
                </button>
            </div>

        </article>
    `).join("");

    grade.addEventListener("click", (e) => {

        const escolha = e.target.closest("[data-escolher]");
        if (escolha) return escolher(escolha.dataset.escolher, escolha);

        const ver = e.target.closest("[data-ver]");
        if (ver) {
            selecionarAba(ver.dataset.ver);
            document.getElementById("comoFunciona").scrollIntoView({ behavior: "smooth" });
        }
    });

    /* ---------- TABELA DE COMPARAÇÃO ---------- */

    const LINHAS = [
        ["sensores", "bi-cpu", "Sensores de solo, temperatura, umidade e luz"],
        ["automacao", "bi-gear-wide-connected", "Irrigação, ventilação e luz automáticas"],
        ["dashboard", "bi-graph-up-arrow", "Painel completo com gráficos em tempo real"],
        ["maquinario", "bi-truck", "Acompanhamento do trator (GPS, combustível, motor)"],
        ["suporte", "bi-tools", "Instalação e manutenção grátis pela equipe"]
    ];

    const marca = (sim) => sim
        ? '<span class="marca sim"><i class="bi bi-check-circle-fill" aria-hidden="true"></i> Sim</span>'
        : '<span class="marca nao"><i class="bi bi-x-circle" aria-hidden="true"></i> Não</span>';

    document.getElementById("tabelaComparar").innerHTML = LINHAS.map(([chave, icone, texto]) => `
        <tr>
            <th scope="row"><i class="bi ${icone}" aria-hidden="true"></i> ${texto}</th>
            <td>${marca(PLANOS.essencial.recursos[chave])}</td>
            <td>${marca(PLANOS.pro.recursos[chave])}</td>
        </tr>
    `).join("");

    /* ---------- NARRAÇÃO (ouvir a explicação) ---------- */

    const btnOuvir = document.getElementById("btnOuvir");
    const podeFalar = "speechSynthesis" in window;

    if (!podeFalar) btnOuvir.hidden = true;

    function pararNarracao() {
        if (podeFalar) window.speechSynthesis.cancel();
        btnOuvir.classList.remove("falando");
        btnOuvir.querySelector("span").textContent = "Ouvir explicação";
        btnOuvir.querySelector("i").className = "bi bi-volume-up-fill";
    }

    btnOuvir.addEventListener("click", () => {

        if (btnOuvir.classList.contains("falando")) return pararNarracao();

        const fala = new SpeechSynthesisUtterance(PLANOS[abaAtual].narracao);
        fala.lang = "pt-BR";
        fala.rate = 0.9;
        const voz = window.speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith("pt"));
        if (voz) fala.voice = voz;
        fala.addEventListener("end", pararNarracao);
        fala.addEventListener("error", pararNarracao);

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(fala);

        btnOuvir.classList.add("falando");
        btnOuvir.querySelector("span").textContent = "Parar explicação";
        btnOuvir.querySelector("i").className = "bi bi-stop-circle-fill";
    });

    /* ---------- ABAS: 3D + DESCRIÇÃO ---------- */

    const palco = document.getElementById("palcoPlano");
    const estado = document.getElementById("estadoPlano");
    const btnEscolherAba = document.getElementById("btnEscolherAba");
    let abaAtual = planoAtual && PLANOS[planoAtual] ? planoAtual : "pro";
    let cena = null;
    let pacote3d = null;

    function carregarPacote3d() {

        if (pacote3d) return pacote3d;

        pacote3d = new Promise((resolver, rejeitar) => {
            const estilo = document.createElement("link");
            estilo.rel = "stylesheet";
            estilo.href = `../vendor/fazenda-3d/fazenda-3d.css?v=${VERSAO_CENA_3D}`;
            document.head.append(estilo);

            const script = document.createElement("script");
            script.src = `../vendor/fazenda-3d/fazenda-3d.js?v=${VERSAO_CENA_3D}`;
            script.async = true;
            script.addEventListener("load", resolver);
            script.addEventListener("error", rejeitar);
            document.body.append(script);
        });

        return pacote3d;
    }

    async function montarCena(plano) {

        try {
            await carregarPacote3d();
            if (plano.id !== abaAtual) return; // trocou de aba enquanto carregava

            const opcoes = { titulo: `Fazenda no ${plano.nome}`, grupos: plano.grupos3d };

            // Uma cena só: trocar de aba só muda os sensores mostrados (recriar perde o WebGL).
            if (cena) {
                cena.configurar(opcoes);
                return;
            }

            estado.remove();

            const alvo = document.createElement("div");
            alvo.className = "fazenda-palco-plano";
            palco.append(alvo);

            cena = window.FazendaInteligente3D.montar(alvo, opcoes);

        } catch (erro) {
            console.error("Planos: visão 3D", erro);
            estado.innerHTML = "Não foi possível carregar a fazenda em 3D. Recarregue a página para tentar de novo.";
        }
    }

    function selecionarAba(id) {

        abaAtual = id;
        const plano = PLANOS[id];

        pararNarracao();

        document.querySelectorAll(".planos-abas [role=tab]").forEach(aba => {
            const ativa = aba.dataset.plano === id;
            aba.setAttribute("aria-selected", String(ativa));
            aba.tabIndex = ativa ? 0 : -1;
        });

        document.getElementById("painelPlano").setAttribute("aria-labelledby", `aba-${id}`);
        document.getElementById("descTitulo").innerHTML =
            `<i class="bi ${plano.icone}" aria-hidden="true"></i> ${plano.nome}`;
        document.getElementById("descChamada").textContent = plano.chamada;

        document.getElementById("descPassos").innerHTML = plano.passos.map((passo, i) => `
            <li>
                <span class="passo-icone" aria-hidden="true"><i class="bi ${passo.icone}"></i></span>
                <div>
                    <strong>${i + 1}. ${passo.titulo}</strong>
                    <p>${passo.texto}</p>
                </div>
            </li>
        `).join("");

        btnEscolherAba.innerHTML = rotuloEscolher(plano);
        btnEscolherAba.dataset.escolher = id;
        btnEscolherAba.disabled = false;

        montarCena(plano);
    }

    btnEscolherAba.addEventListener("click", () => escolher(btnEscolherAba.dataset.escolher, btnEscolherAba));

    const abas = [...document.querySelectorAll(".planos-abas [role=tab]")];

    abas.forEach((aba, i) => {
        aba.addEventListener("click", () => selecionarAba(aba.dataset.plano));
        aba.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const proxima = abas[(i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length];
            proxima.focus();
            selecionarAba(proxima.dataset.plano);
        });
    });

    selecionarAba(abaAtual);

    window.addEventListener("pagehide", pararNarracao);
});
