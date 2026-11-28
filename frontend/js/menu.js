// Comportamento compartilhado do menu lateral das páginas internas:
//  1. a gaveta (botão hambúrguer) nas telas pequenas fica com o painel.js;
//  2. "Gestão da Fazenda" no menu, acima de Configurações, só para produtores/administradores;
//  3. foto de perfil no avatar do topo e modo escuro automático (Configurações).
// A autorização real fica no backend (backend/gestao/resumo.php); aqui é apenas navegação.

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

// Atalhos do topo: Mensagens abre as negociações e o perfil abre as configurações da conta.
(function iniciarAtalhosTopo() {

    const atalhos = { btnMensagens: "negociacoes.html", btnPerfil: "configuracoes.html" };

    Object.entries(atalhos).forEach(([id, destino]) => {
        document.getElementById(id)?.addEventListener("click", () => {
            if (!location.pathname.endsWith("/" + destino)) window.location.href = destino;
        });
    });

})();

// Módulos novos (Catálogo, Histórico, Mercado, Notificações e, para produtores, Gestão Rural):
// links no menu lateral e lembretes automáticos, via modulos.js em modo "só menu".
// As páginas novas já carregam o modulos.js completo; nelas este bloco não faz nada.
document.addEventListener("DOMContentLoaded", () => {

    if (document.querySelector('script[src*="modulos.js"]')) return;

    const script = document.createElement("script");
    script.src = "../js/modulos.js?v=2";
    script.dataset.modo = "menu";
    document.body.appendChild(script);

});
