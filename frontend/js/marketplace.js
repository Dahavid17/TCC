/* =============================================================
   MARKETPLACE.JS — Página de apresentação do MarketPlace Rural
   - Tema claro/escuro persistente (chave compartilhada com as
     páginas internas: "marketplace:tema")
   - Menu responsivo com painel mobile acessível
   - Header que ganha fundo ao rolar e link ativo por seção
   - Revelação suave ao rolar (IntersectionObserver),
     respeitando prefers-reduced-motion
   ============================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const raiz = document.documentElement;
  const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ── Armazenamento seguro ──────────────────────────────── */
  const armazenamento = {
    ler(chave) {
      try { return localStorage.getItem(chave); } catch (e) { return null; }
    },
    salvar(chave, valor) {
      try { localStorage.setItem(chave, valor); } catch (e) { /* sem persistência */ }
    }
  };

  /* ── Tema ──────────────────────────────────────────────── */
  const temaBtn = document.getElementById("temaBtn");
  const metaTema = document.querySelector('meta[name="theme-color"]');

  function aplicarTema(escuro) {
    raiz.classList.toggle("tema-escuro", escuro);
    if (temaBtn) {
      temaBtn.querySelector("i").className = escuro ? "bi bi-sun" : "bi bi-moon-stars";
      temaBtn.setAttribute("aria-pressed", String(escuro));
      temaBtn.setAttribute("aria-label", escuro ? "Ativar tema claro" : "Ativar tema escuro");
    }
    if (metaTema) metaTema.setAttribute("content", escuro ? "#111710" : "#1f3a1d");
  }

  aplicarTema(armazenamento.ler("marketplace:tema") === "dark");

  temaBtn?.addEventListener("click", () => {
    const escuro = !raiz.classList.contains("tema-escuro");
    aplicarTema(escuro);
    armazenamento.salvar("marketplace:tema", escuro ? "dark" : "light");
  });

  /* ── Menu mobile ───────────────────────────────────────── */
  const header = document.getElementById("topo");
  const menuBtn = document.getElementById("menuBtn");
  const menu = document.getElementById("menu");
  const menuFundo = document.getElementById("menuFundo");
  const mobile = window.matchMedia("(max-width: 1080px)");

  function definirMenu(aberto, devolverFoco = false) {
    if (!menu || !menuBtn) return;
    menu.classList.toggle("aberto", aberto);
    header?.classList.toggle("menu-aberto", aberto);
    document.body.classList.toggle("menu-travado", aberto);
    menuBtn.setAttribute("aria-expanded", String(aberto));
    menuBtn.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    if (mobile.matches) menu.toggleAttribute("inert", !aberto);

    if (menuFundo) {
      if (aberto) {
        menuFundo.hidden = false;
        requestAnimationFrame(() => menuFundo.classList.add("visivel"));
      } else {
        menuFundo.classList.remove("visivel");
        setTimeout(() => {
          if (!menu.classList.contains("aberto")) menuFundo.hidden = true;
        }, 300);
      }
    }

    if (aberto) {
      // Aguarda o painel ficar visível antes de mover o foco
      setTimeout(() => menu.querySelector("a")?.focus({ preventScroll: true }), 60);
    } else if (devolverFoco) {
      menuBtn.focus();
    }
  }

  // No celular o painel fechado fica fora da ordem de tabulação
  function sincronizarMenu() {
    if (!menu) return;
    if (mobile.matches) {
      menu.toggleAttribute("inert", !menu.classList.contains("aberto"));
    } else {
      definirMenu(false);
      menu.removeAttribute("inert");
    }
  }

  menuBtn?.addEventListener("click", () => {
    definirMenu(!menu.classList.contains("aberto"));
  });

  menu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (menu.classList.contains("aberto")) {
        definirMenu(false);
      }
    });
  });

  menuFundo?.addEventListener("click", () => {
    definirMenu(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu?.classList.contains("aberto")) {
      definirMenu(false, true);
    }
  });

  mobile.addEventListener("change", sincronizarMenu);
  sincronizarMenu();

  /* ── Header ao rolar ───────────────────────────────────── */
  let agendado = false;
  function atualizarHeader() {
    header?.classList.toggle("rolado", window.scrollY > 12);
    agendado = false;
  }
  window.addEventListener("scroll", () => {
    if (!agendado) {
      agendado = true;
      requestAnimationFrame(atualizarHeader);
    }
  }, { passive: true });
  atualizarHeader();

  /* ── Link ativo conforme a seção visível ───────────────── */
  const linksMenu = [...document.querySelectorAll('.menu-links a[href^="#"]')];
  const secoes = linksMenu
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window && secoes.length) {
    const observadorSecoes = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        const id = "#" + entrada.target.id;
        linksMenu.forEach((link) => {
          const ativo = link.getAttribute("href") === id;
          link.classList.toggle("ativo", ativo);
          if (ativo) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });

    secoes.forEach((secao) => observadorSecoes.observe(secao));

    // Limpa o destaque quando o topo (hero) volta a aparecer
    const hero = document.getElementById("inicio");
    if (hero) {
      new IntersectionObserver(([entrada]) => {
        if (entrada.isIntersecting) {
          linksMenu.forEach((link) => {
            link.classList.remove("ativo");
            link.removeAttribute("aria-current");
          });
        }
      }, { rootMargin: "-45% 0px -50% 0px" }).observe(hero);
    }
  }

  /* ── Revelação ao rolar ────────────────────────────────── */
  const revelaveis = [...document.querySelectorAll("[data-reveal]")];

  // Ao terminar, remove o atributo para que os efeitos de hover
  // do próprio elemento voltem a valer normalmente.
  function finalizar(el) {
    el.removeAttribute("data-reveal");
    el.classList.remove("visivel");
    el.style.removeProperty("--atraso");
  }

  function revelar(el) {
    el.classList.add("visivel");
    let concluido = false;
    const concluir = () => {
      if (concluido) return;
      concluido = true;
      finalizar(el);
    };
    el.addEventListener("transitionend", function aoTerminar(e) {
      if (e.target !== el || e.propertyName !== "transform") return;
      el.removeEventListener("transitionend", aoTerminar);
      concluir();
    });
    setTimeout(concluir, 1800);
  }

  if (movimentoReduzido.matches || !("IntersectionObserver" in window)) {
    revelaveis.forEach(finalizar);
  } else {
    // Escalonamento entre irmãos que entram juntos
    revelaveis.forEach((el) => {
      const irmaos = [...el.parentElement.children].filter((c) => c.hasAttribute("data-reveal"));
      const indice = irmaos.indexOf(el);
      el.style.setProperty("--atraso", Math.min(indice * 90, 450) + "ms");
    });

    const observador = new IntersectionObserver((entradas, obs) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        obs.unobserve(entrada.target);
        revelar(entrada.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

    revelaveis.forEach((el) => observador.observe(el));
  }
});
