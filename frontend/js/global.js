document.addEventListener("DOMContentLoaded", () => {
  // TEMA
  const temaBtn = document.getElementById("temaBtn");
  const temaSalvo = localStorage.getItem("buzzcodex:tema");

  if (temaSalvo === "claro") {
    document.body.classList.add("claro");
    if (temaBtn) {
      const icone = temaBtn.querySelector("i");
      if (icone) icone.className = "bi bi-moon-fill";
    }
  }

  temaBtn?.addEventListener("click", () => {
    document.body.classList.toggle("claro");
    const claro = document.body.classList.contains("claro");
    const icone = temaBtn.querySelector("i");
    if (icone) {
      icone.className = claro ? "bi bi-moon-fill" : "bi bi-brightness-high-fill";
    }
    localStorage.setItem("buzzcodex:tema", claro ? "claro" : "escuro");
  });

  // MENU HAMBÚRGUER
  const menuToggle = document.getElementById("menuToggle");
  const menuNav = document.querySelector("header nav");

  menuToggle?.addEventListener("click", () => {
    const aberto = menuToggle.classList.toggle("aberto");
    menuNav?.classList.toggle("aberto", aberto);
    menuToggle.setAttribute("aria-expanded", aberto ? "true" : "false");
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

  // CARDS DE EQUIPE (TOGGLE MOBILE)
  document.querySelectorAll("#integrantes .card").forEach(card => {
    card.addEventListener("click", () => card.classList.toggle("ativo"));
  });
});

function initEquipeScroll() {
  const section = document.querySelector('#integrantes');
  const cards = document.querySelector('#integrantes .cards');

  if (!section || !cards) return;

  let animationFrameId = null;

  function atualizarPosicao() {
    animationFrameId = null;

    const distanciaRolagem = section.offsetHeight - window.innerHeight;
    const distanciaHorizontal = Math.max(0, cards.scrollWidth - window.innerWidth);

    if (distanciaRolagem <= 0 || distanciaHorizontal === 0) {
      cards.style.transform = 'translate3d(0, 0, 0)';
      return;
    }

    const progresso = Math.min(
      1,
      Math.max(0, -section.getBoundingClientRect().top / distanciaRolagem)
    );

    cards.style.transform = `translate3d(${-progresso * distanciaHorizontal}px, 0, 0)`;
  }

  function agendarAtualizacao() {
    if (animationFrameId === null) {
      animationFrameId = window.requestAnimationFrame(atualizarPosicao);
    }
  }

  window.addEventListener('scroll', agendarAtualizacao, { passive: true });
  window.addEventListener('resize', agendarAtualizacao);
  agendarAtualizacao();
}

document.addEventListener('DOMContentLoaded', initEquipeScroll);

