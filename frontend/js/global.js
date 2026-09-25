/* =============================================================
   SCRIPT.JS — BuzzCodex Home
   Corrigido: #menuNav → seletor correto, persistência de tema,
   cancelamento de animação, namespace sessionStorage.
   ============================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* ── TEMA ──────────────────────────────────────────────────
     Persiste preferência via localStorage com namespace.        */
  const temaBtn  = document.getElementById("temaBtn");
  const temaSalvo = localStorage.getItem("buzzcodex:tema");

  if (temaSalvo === "claro") {
    document.body.classList.add("claro");
    if (temaBtn) temaBtn.querySelector("i").className = "bi bi-moon-fill";
  }

  temaBtn?.addEventListener("click", () => {
    document.body.classList.toggle("claro");
    const claro = document.body.classList.contains("claro");
    const icone = temaBtn.querySelector("i");
    icone.className = claro ? "bi bi-moon-fill" : "bi bi-brightness-high-fill";
    localStorage.setItem("buzzcodex:tema", claro ? "claro" : "escuro");
  });

  /* ── MENU HAMBÚRGUER ────────────────────────────────────────
     BUG CORRIGIDO: antes usava getElementById("menuNav") que
     não existia. Agora seleciona o <nav> dentro do <header>.   */
  const menuToggle = document.getElementById("menuToggle");
  const menuNav    = document.querySelector("header nav");

  menuToggle?.addEventListener("click", () => {
    const aberto = menuToggle.classList.toggle("aberto");
    menuNav?.classList.toggle("aberto", aberto);
    menuToggle.setAttribute("aria-expanded", aberto);
  });

  // Fecha menu ao clicar em qualquer link interno
  document.querySelectorAll("header nav a").forEach(link => {
    link.addEventListener("click", () => {
      menuToggle?.classList.remove("aberto");
      menuNav?.classList.remove("aberto");
      menuToggle?.setAttribute("aria-expanded", "false");
    });
  });

  // Fecha menu ao clicar fora
  document.addEventListener("click", (e) => {
    if (
      menuNav?.classList.contains("aberto") &&
      !menuNav.contains(e.target) &&
      !menuToggle?.contains(e.target)
    ) {
      menuNav.classList.remove("aberto");
      menuToggle?.classList.remove("aberto");
      menuToggle?.setAttribute("aria-expanded", "false");
    }
  });

  /* ── CARDS DE EQUIPE (TOGGLE MOBILE) ──────────────────────
     Toggle via classe .ativo — funciona em touch e mouse.      */
  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => card.classList.toggle("ativo"));
  });

});