/* =============================================================
   PAINEL.JS — Comportamentos de interface das páginas internas
   Apenas apresentação: não lê nem grava dados, não faz
   requisições e não altera a lógica dos scripts das páginas.

   1. Aplica o tema escuro salvo antes da primeira pintura
      (evita "piscar" claro); o script de cada página continua
      sendo quem aplica body.dark e quem troca o tema.
   2. Menu lateral em gaveta no celular/tablet para as páginas
      que não têm botão de menu próprio (Início usa o do
      dashboard.js, #btnMenu).
   Carregar no <head>, sem defer.
   ============================================================= */

(() => {
  const raiz = document.documentElement;

  /* ── 1. Tema antes da pintura ──────────────────────────── */
  try {
    if (localStorage.getItem("marketplace:tema") === "dark") {
      raiz.classList.add("tema-escuro-pre");
    }
  } catch (e) { /* sem acesso ao armazenamento */ }

  const removerTemaProvisorio = () => raiz.classList.remove("tema-escuro-pre");

  document.addEventListener("DOMContentLoaded", () => {
    // Os scripts das páginas aplicam body.dark neste mesmo evento;
    // a classe provisória sai logo depois, sem mudança visível.
    setTimeout(removerTemaProvisorio, 0);

    configurarMenuMobile();
  });

  // Garantia: antes de qualquer troca de tema, a classe provisória já saiu
  window.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("#temaBtn")) removerTemaProvisorio();
  }, true);

  /* ── 3. Imagem que não carregou → marcador visual ──────── */
  // Só adiciona uma classe; o src e os dados não são alterados.
  // Imagens com data-fallback já são tratadas pelo dashboard.js.
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && !img.dataset.fallback) {
      img.classList.add("img-quebrada");
    }
  }, true);

  /* ── 2. Menu em gaveta ─────────────────────────────────── */
  function configurarMenuMobile() {
    const topo = document.querySelector(".topbar");
    const menu = document.querySelector(".sidebar");
    if (!topo || !menu) return;

    // Início já tem botão e overlay controlados pelo dashboard.js
    if (document.getElementById("btnMenu")) return;

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "icon-btn menu-toggle";
    botao.id = "btnMenuPainel";
    botao.setAttribute("aria-label", "Abrir menu");
    botao.setAttribute("aria-expanded", "false");
    botao.innerHTML = '<i class="bi bi-list" aria-hidden="true"></i>';
    topo.insertBefore(botao, topo.firstChild);

    if (!menu.id) menu.id = "menuLateral";
    botao.setAttribute("aria-controls", menu.id);

    let fundo = null;

    function definir(aberto) {
      menu.classList.toggle("aberta", aberto);
      document.body.classList.toggle("menu-travado", aberto);
      botao.setAttribute("aria-expanded", String(aberto));
      botao.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
      botao.querySelector("i").className = aberto ? "bi bi-x-lg" : "bi bi-list";

      if (aberto && !fundo) {
        fundo = document.createElement("div");
        fundo.className = "painel-overlay";
        fundo.addEventListener("click", () => definir(false));
        document.body.appendChild(fundo);
      } else if (!aberto && fundo) {
        fundo.remove();
        fundo = null;
      }
    }

    botao.addEventListener("click", () => definir(!menu.classList.contains("aberta")));

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => definir(false));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("aberta")) {
        definir(false);
        botao.focus();
      }
    });

    window.matchMedia("(min-width: 1025px)").addEventListener("change", (e) => {
      if (e.matches) definir(false);
    });
  }
})();
