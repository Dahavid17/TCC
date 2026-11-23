/* =============================================================
   MARKETPLACE.JS
   Corrigido: tema persistente via localStorage com namespace,
   menu hambúrguer funcional, backdrop-filter webkit.
   ============================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* ── TEMA PERSISTENTE ──────────────────────────────────── */
  const temaBtn  = document.getElementById("temaBtn");
  const temaSalvo = localStorage.getItem("marketplace:tema");

  if (temaSalvo === "dark") {
    document.body.classList.add("dark");
    if (temaBtn) temaBtn.querySelector("i").className = "bi bi-sun-fill";
  }

  temaBtn?.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const dark  = document.body.classList.contains("dark");
    const icone = temaBtn.querySelector("i");
    icone.className = dark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
    localStorage.setItem("marketplace:tema", dark ? "dark" : "light");
  });

  /* ── MENU HAMBÚRGUER ───────────────────────────────────── */
  const menuBtn = document.getElementById("menuBtn");
  const menu    = document.getElementById("menu");

  menuBtn?.addEventListener("click", () => {
    const aberto = menu?.classList.toggle("ativo");
    menuBtn.setAttribute("aria-expanded", aberto);
  });

  // Fecha ao clicar em link interno
  menu?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      menu.classList.remove("ativo");
      menuBtn?.setAttribute("aria-expanded", "false");
    });
  });

  // Fecha ao clicar fora
  document.addEventListener("click", (e) => {
    if (
      menu?.classList.contains("ativo") &&
      !menu.contains(e.target) &&
      !menuBtn?.contains(e.target)
    ) {
      menu.classList.remove("ativo");
      menuBtn?.setAttribute("aria-expanded", "false");
    }
  });

  /* ── VÍDEO COM LAZY LOADING ────────────────────────────── */
  // O arquivo só é solicitado quando o vídeo está perto da tela.
  const video = document.getElementById("videoApresentacao");

  if (video) {
    const carregarVideo = () => {
      video.querySelectorAll("source[data-src]").forEach(source => {
        source.src = source.dataset.src;
        source.removeAttribute("data-src");
      });
      video.preload = "metadata";
      video.load();
    };

    if ("IntersectionObserver" in window) {
      const observador = new IntersectionObserver((entradas) => {
        if (entradas.some(entrada => entrada.isIntersecting)) {
          carregarVideo();
          observador.disconnect();
        }
      }, { rootMargin: "300px" });
      observador.observe(video);
    } else {
      carregarVideo();
    }
  }

});