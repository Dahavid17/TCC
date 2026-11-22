// Comportamento compartilhado do menu lateral das páginas internas:
//  1. gaveta (botão hambúrguer) nas telas pequenas;
//  2. "Gestão da Fazenda" no menu, acima de Configurações, só para produtores/administradores;
//  3. foto de perfil no avatar do topo e modo escuro automático (Configurações).
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

// Modo escuro automático (Configurações > Preferências): segue o tema do aparelho.
// Roda antes dos scripts das páginas, que leem "marketplace:tema" ao carregar.
(function temaAutomatico() {

    let automatico = false;

    try {
        automatico = localStorage.getItem("marketplace:tema-auto") === "1";
    } catch (erro) {
        return;
    }

    if (!automatico || !window.matchMedia) return;

    const escuro = window.matchMedia("(prefers-color-scheme: dark)");

    function aplicar() {
        try {
            localStorage.setItem("marketplace:tema", escuro.matches ? "dark" : "light");
        } catch (erro) { /* sem armazenamento */ }

        document.body.classList.toggle("dark", escuro.matches);

        const icone = document.querySelector("#temaBtn i");
        if (icone) icone.className = escuro.matches ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
    }

    aplicar();
    escuro.addEventListener?.("change", aplicar);

})();

// Foto de perfil no avatar do topo (todas as páginas internas).
// Configurações chama window.aplicarFotoPerfil(caminho) logo depois de trocar a foto.
window.aplicarFotoPerfil = function (caminho) {

    document.querySelectorAll("#avatarUsuario, #avatarPerfil").forEach(avatar => {
        if (caminho) {
            avatar.style.backgroundImage = `url("../../${caminho}")`;
            avatar.classList.add("com-foto");
        } else {
            avatar.style.backgroundImage = "";
            avatar.classList.remove("com-foto");
        }
    });
};

(async () => {

    try {

        const resposta = await fetch("../../backend/auth/sessao.php");
        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) return;

        window.aplicarFotoPerfil(dados.usuario.foto_perfil);

        // "Gestão da Fazenda" no menu, acima de Configurações, só para produtores/administradores.
        const configuracoes = document.querySelector('.sidebar a[href="configuracoes.html"]');

        if (!configuracoes
            || document.querySelector('.sidebar a[href="gestao-fazenda.html"]')
            || !["produtor", "admin"].includes(dados.usuario.tipo_acesso)) {
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
