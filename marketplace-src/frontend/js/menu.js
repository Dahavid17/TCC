// Comportamento compartilhado do menu lateral das páginas internas:
//  1. gaveta (botão hambúrguer) nas telas pequenas;
//  2. "Gestão da Fazenda" no menu, acima de Configurações, só para produtores/administradores.
// A autorização real fica no backend (backend/gestao/resumo.php); aqui é apenas navegação.

(function iniciarGaveta() {

    const topo = document.querySelector(".topbar");
    const menu = document.querySelector(".sidebar");

    if (!topo || !menu) return;

    const PONTO_DESKTOP = 900;

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn-menu";
    botao.setAttribute("aria-label", "Abrir menu");
    botao.setAttribute("aria-expanded", "false");
    botao.innerHTML = '<i class="bi bi-list"></i>';
    topo.prepend(botao);

    const fundo = document.createElement("div");
    fundo.className = "menu-overlay";
    document.body.append(fundo);

    function definirAberto(aberto) {
        document.body.classList.toggle("menu-aberto", aberto);
        botao.setAttribute("aria-expanded", String(aberto));
        botao.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
        botao.firstElementChild.className = aberto ? "bi bi-x-lg" : "bi bi-list";
    }

    botao.addEventListener("click", () => {
        definirAberto(!document.body.classList.contains("menu-aberto"));
    });

    fundo.addEventListener("click", () => definirAberto(false));

    menu.addEventListener("click", (e) => {
        if (e.target.closest("a")) definirAberto(false);
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") definirAberto(false);
    });

    // A altura do topo muda quando a barra de pesquisa quebra de linha: o conteúdo e a gaveta acompanham.
    function medirTopo() {
        document.documentElement.style.setProperty("--topo-h", topo.offsetHeight + "px");

        if (window.innerWidth >= PONTO_DESKTOP) definirAberto(false);
    }

    medirTopo();
    window.addEventListener("resize", medirTopo);

    if ("ResizeObserver" in window) {
        new ResizeObserver(medirTopo).observe(topo);
    }

})();

(async () => {

    const configuracoes = document.querySelector('.sidebar a[href="configuracoes.html"]');

    if (!configuracoes || document.querySelector('.sidebar a[href="gestao-fazenda.html"]')) {
        return;
    }

    try {

        const resposta = await fetch("../../backend/auth/sessao.php");
        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso || !["produtor", "admin"].includes(dados.usuario.tipo_acesso)) {
            return;
        }

        const link = document.createElement("a");
        link.href = "gestao-fazenda.html";
        link.innerHTML = '<i class="bi bi-tree"></i><span>Gestão da Fazenda</span>';

        configuracoes.before(link);

    } catch (erro) {

        console.error("Menu: não foi possível verificar o perfil", erro);
    }

})();
