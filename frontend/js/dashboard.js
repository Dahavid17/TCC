/* =============================================================
   DASHBOARD.JS — Início | MarketPlace Rural

   Visual novo (dashboard.css / painel.css) ligado ao backend real:
     auth/sessao.php                    → usuário logado
     produtos/listar.php?escopo=...     → destaques, catálogo e meus produtos
     favoritos/listar.php               → corações da vitrine
     pedidos/listar.php                 → resumo e atividade recente
     negociacoes/listar.php             → resumo, atividade e contador de mensagens

   Os cartões de produto, o favoritar e a janela "Fazer pedido" ficam no
   vitrine.js (o mesmo da aba Produtos). Sino: notificacoes.js. Foto: menu.js.
   ============================================================= */

const API = "../../backend/";
const LIMITE_BAIXO_ESTOQUE = 10;   // o mesmo da página Estoque
const DESTAQUES = 8;               // "Produtos em destaque"
const GERAIS = 12;                 // "Mais produtos" (o resto fica na aba Produtos)

const CATEGORIAS = [
    { id: "hortalicas", nome: "Hortaliças", icone: "bi-flower2" },
    { id: "frutas", nome: "Frutas", icone: "bi-apple" },
    { id: "graos", nome: "Grãos", icone: "bi-basket" },
    { id: "laticinios", nome: "Laticínios", icone: "bi-cup-straw" },
    { id: "carnes", nome: "Carnes", icone: "bi-egg-fried" },
    { id: "flores", nome: "Flores", icone: "bi-flower1" }
];

const NOME_CATEGORIA = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.nome]));

const NOME_STATUS = {
    recebido: "recebido",
    negociacao: "em negociação",
    preparo: "em preparo",
    entregue: "entregue",
    cancelado: "cancelado"
};

/* ─────────────────────────────────────────────
   ESTADO
───────────────────────────────────────────── */

const estado = {
    usuario: null,
    perfil: "Comprador",           // "Produtor" | "Comprador" (admin conta como Produtor)
    destaques: [],
    catalogo: [],
    favoritos: new Set(),          // compartilhado com o vitrine.js
    categoriaAtiva: null,
    termoBusca: ""
};

let vitrineDestaques = null;
let vitrineGerais = null;

/* ─────────────────────────────────────────────
   CAMADA DE DADOS
───────────────────────────────────────────── */

async function chamarApi(caminho) {
    const resposta = await fetch(API + caminho, { credentials: "same-origin" });

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

/* ─────────────────────────────────────────────
   UTILITÁRIOS
───────────────────────────────────────────── */

function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function normalizar(texto) {
    return String(texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function formatarPreco(valor) {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function obterPeriodo() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Bom dia";
    if (hora >= 12 && hora < 18) return "Boa tarde";
    return "Boa noite";
}

// "Há 15 min", "Há 3 h", "Ontem", "12/11"
function tempoRelativo(data) {
    const diff = (Date.now() - data.getTime()) / 1000;
    if (diff < 60) return "Agora";
    if (diff < 3600) return `Há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Há ${Math.floor(diff / 3600)} h`;
    if (diff < 172800) return "Ontem";
    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

let temporizadorToast;
function mostrarToast(mensagem) {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        toast.setAttribute("role", "status");
        document.body.appendChild(toast);
    }
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => toast.classList.remove("visivel"), 2600);
}

/* ─────────────────────────────────────────────
   RENDERIZAÇÃO
───────────────────────────────────────────── */

function renderizarUsuario(usuario) {
    const nomeCompleto = (usuario.nome || "").trim();
    const primeiroNome = nomeCompleto.split(" ")[0];
    const tipo = usuario.tipo_acesso || "";

    document.getElementById("nomeUsuario").textContent = nomeCompleto;
    document.getElementById("tipoUsuario").textContent = tipo.charAt(0).toUpperCase() + tipo.slice(1);
    document.getElementById("nomeHero").textContent = primeiroNome;
    document.getElementById("saudacaoPeriodo").textContent = obterPeriodo();
    document.getElementById("avatarUsuario").textContent = primeiroNome.charAt(0).toUpperCase(); // menu.js troca pela foto

    // Elementos exclusivos de um perfil: <... data-perfil="Produtor">
    document.querySelectorAll("[data-perfil]").forEach(el => {
        el.hidden = el.dataset.perfil !== estado.perfil;
    });
}

function renderizarResumo(itens) {
    document.getElementById("resumoUsuario").innerHTML = itens.map(item => `
        <a href="${escaparHtml(item.destino)}" class="card-acao" data-resumo="${escaparHtml(item.chave)}">
            <div class="icone"><i class="bi ${escaparHtml(item.icone)}"></i></div>
            <div>
                <strong>${escaparHtml(item.valor)}</strong>
                <span class="rotulo">${escaparHtml(item.rotulo)}</span>
            </div>
        </a>`).join("");
}

function renderizarCategorias() {
    document.getElementById("listaCategorias").innerHTML = CATEGORIAS.map(c => `
        <button type="button" data-categoria="${escaparHtml(c.id)}">
            <i class="bi ${escaparHtml(c.icone)}"></i>
            <span>${escaparHtml(c.nome)}</span>
        </button>`).join("");
}

function marcarCategoriaAtiva() {
    document.querySelectorAll("#listaCategorias button").forEach(btn => {
        btn.classList.toggle("ativo", btn.dataset.categoria === estado.categoriaAtiva);
    });
}

function renderizarAtividades(atividades) {
    const lista = document.getElementById("listaAtividades");

    if (!atividades.length) {
        lista.innerHTML = `
            <li class="atividade">
                <div class="atividade-icone"><i class="bi bi-hourglass"></i></div>
                <div class="atividade-texto">
                    <strong>Nenhuma movimentação ainda</strong>
                    <span>Seus pedidos e negociações aparecem aqui.</span>
                </div>
            </li>`;
        return;
    }

    lista.innerHTML = atividades.map(a => `
        <li class="atividade ${a.alerta ? "alerta" : ""}">
            <div class="atividade-icone"><i class="bi ${escaparHtml(a.icone)}"></i></div>
            <div class="atividade-texto">
                <strong>${escaparHtml(a.titulo)}</strong>
                <span>${escaparHtml(a.detalhe)}</span>
            </div>
            <time>${escaparHtml(a.tempo)}</time>
        </li>`).join("");
}

function renderizarContadorMensagens(total) {
    const el = document.getElementById("contadorMensagens");
    if (!el) return;
    el.textContent = total;
    el.hidden = !total;
}

/* ─────────────────────────────────────────────
   MONTAGEM DOS DADOS DO PAINEL
───────────────────────────────────────────── */

function montarResumo({ meusProdutos, pedidos, conversas }) {
    const ativas = conversas.filter(c => !c.concluida).length;

    if (estado.perfil === "Produtor") {
        const recebidos = pedidos.filter(p => p.papel === "vendedor");
        const baixo = meusProdutos.filter(p => p.estoque <= LIMITE_BAIXO_ESTOQUE).length;

        return [
            { chave: "produtos", rotulo: "Produtos cadastrados", valor: meusProdutos.length, icone: "bi-box-seam", destino: "meus-produtos.html" },
            { chave: "pedidos", rotulo: "Pedidos recebidos", valor: recebidos.length, icone: "bi-cart-check", destino: "pedidos.html" },
            { chave: "negociacoes", rotulo: "Negociações ativas", valor: ativas, icone: "bi-chat-dots", destino: "negociacoes.html" },
            { chave: "estoqueBaixo", rotulo: "Estoque baixo ou esgotado", valor: baixo, icone: "bi-clipboard-data", destino: "estoque.html" }
        ];
    }

    const feitos = pedidos.filter(p => p.papel === "comprador");
    const andamento = feitos.filter(p => !["entregue", "cancelado"].includes(p.status)).length;

    return [
        { chave: "pedidos", rotulo: "Pedidos realizados", valor: feitos.length, icone: "bi-cart-check", destino: "pedidos.html" },
        { chave: "negociacoes", rotulo: "Negociações ativas", valor: ativas, icone: "bi-chat-dots", destino: "negociacoes.html" },
        { chave: "favoritos", rotulo: "Favoritos", valor: estado.favoritos.size, icone: "bi-heart", destino: "favoritos.html" },
        { chave: "emAndamento", rotulo: "Pedidos em andamento", valor: andamento, icone: "bi-truck", destino: "pedidos.html" }
    ];
}

function montarAtividades({ meusProdutos, pedidos, conversas }) {
    const itens = [];

    pedidos.forEach(p => {
        const produtos = p.itens.map(i => `${i.quantidade}× ${i.nome}`).join(", ");
        const vendedor = p.papel === "vendedor";
        const data = new Date(p.data + "T12:00:00");

        itens.push({
            data,
            titulo: vendedor ? `Pedido #${p.id} de ${p.contraparte}` : `Seu pedido #${p.id}`,
            detalhe: `${produtos} — ${NOME_STATUS[p.status] || p.status}`,
            icone: p.status === "entregue" ? "bi-bag-check" : p.status === "cancelado" ? "bi-x-circle" : "bi-truck",
            tempo: data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
        });
    });

    conversas.forEach(c => {
        const quando = new Date(c.ultima.em * 1000);
        const texto = c.ultima.tipo === "proposta"
            ? `Proposta de ${formatarPreco(c.ultima.valor)}`
            : (c.ultima.texto || "");

        itens.push({
            data: quando,
            titulo: `${c.contraparte.nome} · ${c.produto.nome}`,
            detalhe: (c.ultima.minha ? "Você: " : "") + texto,
            icone: c.ultima.tipo === "proposta" ? "bi-currency-dollar" : "bi-chat-left-text",
            tempo: tempoRelativo(quando),
            alerta: c.nao_lidas > 0
        });
    });

    if (estado.perfil === "Produtor") {
        meusProdutos
            .filter(p => p.estoque <= LIMITE_BAIXO_ESTOQUE)
            .slice(0, 2)
            .forEach(p => itens.push({
                data: new Date(0),          // alertas vão para o fim da lista
                titulo: p.estoque === 0 ? "Produto esgotado" : "Estoque baixo",
                detalhe: `${p.nome} está com ${p.estoque} em estoque`,
                icone: "bi-exclamation-triangle",
                tempo: "Estoque",
                alerta: true
            }));
    }

    return itens.sort((a, b) => b.data - a.data).slice(0, 5);
}

/* ─────────────────────────────────────────────
   VITRINE: destaques + mais produtos, ou resultado da busca
───────────────────────────────────────────── */

function aplicarFiltros() {
    const termo = normalizar(estado.termoBusca).trim();
    const filtrando = termo !== "" || estado.categoriaAtiva !== null;
    const secaoGerais = document.getElementById("secaoProdutosGerais");
    const titulo = document.getElementById("tituloDestaques");

    secaoGerais.hidden = filtrando;
    marcarCategoriaAtiva();

    if (!filtrando) {
        const mostrados = estado.destaques.slice(0, DESTAQUES);
        const idsDestaque = new Set(mostrados.map(p => p.id));

        titulo.textContent = "Produtos em destaque";
        vitrineDestaques.mostrar(mostrados, estado.catalogo.length
            ? "Ainda não há produtos em promoção ou em destaque."
            : "Ainda não há produtos cadastrados.");
        vitrineGerais.mostrar(
            estado.catalogo.filter(p => !idsDestaque.has(p.id)).slice(0, GERAIS),
            "Os outros produtos aparecem aqui assim que forem cadastrados."
        );
        return;
    }

    titulo.textContent = "Produtos encontrados";
    vitrineDestaques.mostrar(
        estado.catalogo.filter(p =>
            (!estado.categoriaAtiva || p.categoria === estado.categoriaAtiva) &&
            (!termo || normalizar(`${p.nome} ${NOME_CATEGORIA[p.categoria] || ""} ${p.vendedor_nome}`).includes(termo))
        ),
        "Nenhum produto encontrado."
    );
}

/* ─────────────────────────────────────────────
   EVENTOS
───────────────────────────────────────────── */

function configurarTema() {
    const temaBtn = document.getElementById("temaBtn");
    if (!temaBtn) return;

    const icone = temaBtn.querySelector("i");
    const aplicar = escuro => {
        document.body.classList.toggle("dark", escuro);
        icone.className = escuro ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
    };

    aplicar(localStorage.getItem("marketplace:tema") === "dark");

    temaBtn.addEventListener("click", () => {
        const escuro = !document.body.classList.contains("dark");
        aplicar(escuro);
        localStorage.setItem("marketplace:tema", escuro ? "dark" : "light");
    });
}

function configurarMenu() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const botao = document.getElementById("btnMenu");

    const alternar = abrir => {
        sidebar.classList.toggle("aberta", abrir);
        overlay.hidden = !abrir;
        botao?.setAttribute("aria-expanded", String(abrir));
    };

    botao?.addEventListener("click", () => alternar(!sidebar.classList.contains("aberta")));
    overlay?.addEventListener("click", () => alternar(false));

    // Links do menu (inclusive o "Gestão da Fazenda", que o menu.js insere depois) fecham a gaveta
    sidebar?.addEventListener("click", e => {
        if (e.target.closest("a")) alternar(false);
    });

    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && sidebar.classList.contains("aberta")) alternar(false);
    });
}

function configurarBusca() {
    const form = document.getElementById("formPesquisa");
    const campo = document.getElementById("pesquisa");

    form?.addEventListener("submit", e => {
        e.preventDefault();
        estado.termoBusca = campo.value;
        aplicarFiltros();
        document.getElementById("secaoProdutos")?.scrollIntoView({ behavior: "smooth" });
    });

    campo?.addEventListener("input", () => {
        estado.termoBusca = campo.value;
        aplicarFiltros();
    });
}

function configurarCategorias() {
    document.getElementById("listaCategorias")?.addEventListener("click", e => {
        const btn = e.target.closest("button[data-categoria]");
        if (!btn) return;
        // Clicar de novo na categoria ativa remove o filtro
        estado.categoriaAtiva = estado.categoriaAtiva === btn.dataset.categoria ? null : btn.dataset.categoria;
        aplicarFiltros();
    });
}

function configurarAcoesGerais() {
    document.getElementById("btnNovoProduto")?.addEventListener("click", () => {
        window.location.href = "meus-produtos.html";
    });

    document.getElementById("btnExplorar")?.addEventListener("click", () => {
        document.getElementById("secaoProdutos")?.scrollIntoView({ behavior: "smooth" });
    });
    // Mensagens e Perfil do topo: menu.js. Sino: notificacoes.js.
}

// Imagem quebrada → placeholder verde com ícone
function configurarFallbackImagens() {
    document.addEventListener("error", e => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;

        const icone = img.dataset.fallback === "banner" ? "bi-tree" : "bi-basket3";
        const vazio = document.createElement("div");
        vazio.className = "img-vazia";
        vazio.innerHTML = `<i class="bi ${icone}"></i>`;
        img.replaceWith(vazio);
    }, true);
}

/* ─────────────────────────────────────────────
   INICIALIZAÇÃO
───────────────────────────────────────────── */

async function carregarPainel() {
    const vende = estado.perfil === "Produtor";

    const [destaques, catalogo, favoritos, pedidos, meus] = await Promise.all([
        chamarApi("produtos/listar.php?escopo=destaques"),
        chamarApi("produtos/listar.php?escopo=catalogo"),
        chamarApi("favoritos/listar.php"),
        chamarApi("pedidos/listar.php"),
        vende ? chamarApi("produtos/listar.php") : Promise.resolve({ produtos: [] })
    ]);

    // Se as negociações falharem, o restante do painel continua funcionando.
    const conversas = await chamarApi("negociacoes/listar.php")
        .then(d => d.conversas)
        .catch(erro => { console.error("Erro ao carregar negociações:", erro); return []; });

    estado.destaques = destaques.produtos;
    estado.catalogo = catalogo.produtos;
    estado.favoritos.clear();
    favoritos.produtos.forEach(p => estado.favoritos.add(p.id));

    const dados = { meusProdutos: meus.produtos, pedidos: pedidos.pedidos, conversas };

    renderizarResumo(montarResumo(dados));
    renderizarAtividades(montarAtividades(dados));
    renderizarContadorMensagens(conversas.reduce((total, c) => total + c.nao_lidas, 0));
    aplicarFiltros();
}

async function iniciarPagina() {
    configurarTema();
    configurarMenu();
    configurarBusca();
    configurarCategorias();
    configurarAcoesGerais();
    configurarFallbackImagens();
    renderizarCategorias();

    try {
        estado.usuario = (await chamarApi("auth/sessao.php")).usuario;
    } catch (erro) {
        console.error("Erro ao verificar sessão:", erro);
        return;
    }

    estado.perfil = ["produtor", "admin"].includes(estado.usuario.tipo_acesso) ? "Produtor" : "Comprador";
    renderizarUsuario(estado.usuario);

    // Cartões, favoritos e "Fazer pedido" (vitrine.js). Depois de um pedido, o painel recarrega.
    const recarregar = () => carregarPainel().catch(erro => console.error(erro));
    vitrineDestaques = Vitrine.criar({
        lista: document.getElementById("listaProdutos"),
        usuarioId: estado.usuario.id,
        favoritosIds: estado.favoritos,
        aoComprar: recarregar
    });
    vitrineGerais = Vitrine.criar({
        lista: document.getElementById("listaProdutosGerais"),
        usuarioId: estado.usuario.id,
        favoritosIds: estado.favoritos,
        aoComprar: recarregar
    });

    try {
        await carregarPainel();
    } catch (erro) {
        console.error("Erro ao carregar a página inicial:", erro);
        mostrarToast("Não foi possível carregar os dados.");
        document.getElementById("listaProdutos").innerHTML =
            `<p class="estado-vazio">Não foi possível carregar os produtos.</p>`;
    }

    // Tour de primeiro acesso (onboarding.js)
    window.iniciarOnboarding?.(estado.usuario);
}

document.addEventListener("DOMContentLoaded", iniciarPagina);
