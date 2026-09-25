// Fallback JS para scroll horizontal em navegadores sem suporte a animation-timeline
if (!CSS.supports('animation-timeline', '--equipe-scroll')) {
  const section = document.querySelector('#integrantes');
  const cards = document.querySelector('#integrantes .cards');

  window.addEventListener('scroll', () => {
    if (!section || !cards) return;
    const rect = section.getBoundingClientRect();
    const sectionHeight = section.offsetHeight - window.innerHeight;
    if (sectionHeight <= 0) return;

    let progress = -rect.top / sectionHeight;
    progress = Math.max(0, Math.min(1, progress));

    const maxTranslate = cards.scrollWidth - window.innerWidth;
    cards.style.transform = `translateX(-${progress * maxTranslate}px)`;
  });
}

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

  function updateScroll() {
    const rect = section.getBoundingClientRect();
    const totalScrollable = section.offsetHeight - window.innerHeight;

    if (totalScrollable <= 0) return;

    // Calcula o progresso de 0 (início) a 1 (fim da secção)
    let progress = -rect.top / totalScrollable;
    progress = Math.max(0, Math.min(1, progress));

    // Calcula a distância exata até ao último card alinhar com a margem direita
    const maxTranslate = cards.scrollWidth - window.innerWidth;

    cards.style.transform = `translateX(-${progress * maxTranslate}px)`;
  }

  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', updateScroll);
  updateScroll();
}

document.addEventListener('DOMContentLoaded', initEquipeScroll);

// Animação de Scroll Horizontal da Equipe
const sectionIntegrantes = document.querySelector('#integrantes');
const cardsContainer = document.querySelector('#integrantes .cards');

if (sectionIntegrantes && cardsContainer) {
  window.addEventListener('scroll', () => {
    const sectionTop = sectionIntegrantes.offsetTop;
    const sectionHeight = sectionIntegrantes.offsetHeight;
    const windowHeight = window.innerHeight;
    const scrollY = window.scrollY;

    const startScroll = sectionTop;
    const endScroll = sectionTop + sectionHeight - windowHeight;

    if (scrollY >= startScroll && scrollY <= endScroll) {
      const progress = (scrollY - startScroll) / (endScroll - startScroll);
      const maxTranslate = cardsContainer.scrollWidth - window.innerWidth + (window.innerWidth * 0.1);
      
      cardsContainer.style.transform = `translateX(-${progress * maxTranslate}px)`;
    } else if (scrollY < startScroll) {
      cardsContainer.style.transform = 'translateX(0px)';
    }
  });
}