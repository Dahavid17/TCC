/* =====================================================================
   BUZZ CODEX — INTERAÇÕES E ANIMAÇÕES
   ===================================================================== */
(() => {
  "use strict";

  const raiz = document.documentElement;
  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ponteiroFino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

  raiz.classList.add("js");
  if (reduzMovimento) raiz.classList.add("sem-capa");

  /* -------------------------------------------------------------------
     CARREGAMENTO
     ------------------------------------------------------------------- */
  const barraCarregamento = document.querySelector(".carregamento");
  const finalizarCarregamento = () => barraCarregamento?.classList.add("ok");
  if (document.readyState === "complete") finalizarCarregamento();
  else window.addEventListener("load", finalizarCarregamento);

  // Imagens dos projetos: skeleton até carregar
  document.querySelectorAll(".proj-mockup").forEach((box) => {
    const img = box.querySelector("img");
    if (!img) return;
    const pronto = () => box.classList.add("carregada");
    if (img.complete && img.naturalWidth) pronto();
    else {
      img.addEventListener("load", pronto, { once: true });
      img.addEventListener("error", pronto, { once: true });
    }
  });

  /* -------------------------------------------------------------------
     TEMA (mesma chave de armazenamento original)
     ------------------------------------------------------------------- */
  const temaBtn = document.getElementById("temaBtn");
  let temaSalvo = null;
  try { temaSalvo = localStorage.getItem("buzzcodex:tema"); } catch (e) { /* sem storage */ }

  if (temaSalvo === "claro") {
    document.body.classList.add("claro");
    const icone = temaBtn?.querySelector("i");
    if (icone) icone.className = "bi bi-moon-fill";
  }

  temaBtn?.addEventListener("click", () => {
    document.body.classList.toggle("claro");
    const claro = document.body.classList.contains("claro");
    const icone = temaBtn.querySelector("i");
    if (icone) icone.className = claro ? "bi bi-moon-fill" : "bi bi-brightness-high-fill";
    try { localStorage.setItem("buzzcodex:tema", claro ? "claro" : "escuro"); } catch (e) { /* sem storage */ }
    temaBtn.classList.remove("girando");
    void temaBtn.offsetWidth;
    temaBtn.classList.add("girando");
  });

  /* -------------------------------------------------------------------
     MENU HAMBÚRGUER
     ------------------------------------------------------------------- */
  const menuToggle = document.getElementById("menuToggle");
  const menuNav = document.querySelector("header nav");

  const fecharMenu = () => {
    menuToggle?.classList.remove("aberto");
    menuNav?.classList.remove("aberto");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Abrir Menu");
  };

  menuToggle?.addEventListener("click", () => {
    const aberto = menuToggle.classList.toggle("aberto");
    menuNav?.classList.toggle("aberto", aberto);
    menuToggle.setAttribute("aria-expanded", aberto ? "true" : "false");
    menuToggle.setAttribute("aria-label", aberto ? "Fechar Menu" : "Abrir Menu");
  });

  // Fecha menu ao clicar em qualquer link interno
  document.querySelectorAll("header nav a").forEach((link) => link.addEventListener("click", fecharMenu));

  // Fecha menu ao clicar fora
  document.addEventListener("click", (e) => {
    if (menuNav?.classList.contains("aberto") && !menuNav.contains(e.target) && !menuToggle?.contains(e.target)) {
      fecharMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuNav?.classList.contains("aberto")) {
      fecharMenu();
      menuToggle?.focus();
    }
  });

  /* -------------------------------------------------------------------
     CARDS DE EQUIPE (TOGGLE MOBILE)
     ------------------------------------------------------------------- */
  document.querySelectorAll("#integrantes .eq-card:not(.eq-intro)").forEach((card) => {
    card.addEventListener("click", () => card.classList.toggle("ativo"));
  });

  /* -------------------------------------------------------------------
     GERADOR DE CIRCUITOS (trilhas a 30°, como na logo)
     ------------------------------------------------------------------- */
  const SVGNS = "http://www.w3.org/2000/svg";
  const criar = (tag, attrs) => {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  const aleatorio = (semente) => {
    let s = semente >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  // Linha base: alterna entre a direção principal e um desvio de ±30°
  function polilinha(r, x, y, ang, passos, min, max) {
    const pts = [[x, y]];
    let a = ang;
    for (let i = 0; i < passos; i++) {
      const L = min + r() * (max - min);
      const rad = (a * Math.PI) / 180;
      x += Math.cos(rad) * L;
      y += Math.sin(rad) * L;
      pts.push([x, y]);
      a = a === ang ? ang + (r() < 0.5 ? -30 : 30) : ang;
    }
    return pts;
  }

  // Desloca a polilinha em paralelo (barramento de várias trilhas)
  function deslocar(pts, off) {
    return pts.map((p, i) => {
      const ant = pts[i - 1];
      const prox = pts[i + 1];
      const normal = (a, b) => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        return [-dy / l, dx / l];
      };
      const n1 = ant ? normal(ant, p) : null;
      const n2 = prox ? normal(p, prox) : null;
      let n;
      if (n1 && n2) {
        const mx = n1[0] + n2[0];
        const my = n1[1] + n2[1];
        const ml = Math.hypot(mx, my) || 1;
        n = [mx / ml, my / ml];
        const cos = n[0] * n1[0] + n[1] * n1[1] || 1;
        n = [n[0] / cos, n[1] / cos];
      } else n = n1 || n2;
      return [p[0] + n[0] * off, p[1] + n[1] * off];
    });
  }

  const comprimento = (pts) => pts.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  const caminho = (pts) => "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L");

  function desenharCircuito(svg, cfg) {
    const r = aleatorio(cfg.semente);
    svg.setAttribute("viewBox", `0 0 ${cfg.w} ${cfg.h}`);
    svg.setAttribute("preserveAspectRatio", cfg.proporcao || "xMidYMid slice");
    const gT = criar("g", { class: "trilhas" });
    const gP = criar("g", { class: "pulsos" });
    const gN = criar("g", { class: "nos" });
    svg.append(gT, gP, gN);

    const compacto = window.innerWidth < 700;
    let idx = 0;

    cfg.barramentos.forEach((b, bi) => {
      if (compacto && b.opcional) return;
      const base = polilinha(r, b.x, b.y, b.ang, b.passos || 3, b.min || 70, b.max || 200);
      const linhas = b.linhas || 3;

      for (let i = 0; i < linhas; i++) {
        const pts = deslocar(base, (i - (linhas - 1) / 2) * (cfg.espaco || 15));
        // encurta o final de cada trilha de forma escalonada
        const ult = pts[pts.length - 1];
        const pen = pts[pts.length - 2];
        const dx = ult[0] - pen[0];
        const dy = ult[1] - pen[1];
        const l = Math.hypot(dx, dy) || 1;
        const corte = r() * Math.min(l * 0.55, 70);
        ult[0] -= (dx / l) * corte;
        ult[1] -= (dy / l) * corte;

        const d = caminho(pts);
        const len = comprimento(pts);
        const atraso = (cfg.atrasoBase || 0) + idx * 0.05;

        const trilha = criar("path", { d, class: "trilha" });
        trilha.style.setProperty("--len", len.toFixed(0));
        trilha.style.setProperty("--d", atraso.toFixed(2) + "s");
        gT.append(trilha);

        if (!reduzMovimento && r() < (cfg.pulsos ?? 0.5)) {
          const cor = (bi + i) % 2 ? "pulso--verde" : "pulso--roxo";
          const dur = (len / (110 + r() * 120)).toFixed(2) + "s";
          const atrasoPulso = (atraso + 1.6 + r() * 3).toFixed(2) + "s";
          const camadas = cfg.halo ? ["pulso halo " + cor, "pulso " + cor] : ["pulso " + cor];
          camadas.forEach((classe) => {
            const p = criar("path", { d, class: classe });
            p.style.setProperty("--len", len.toFixed(0));
            p.style.setProperty("--fim", (-len).toFixed(0));
            p.style.setProperty("--dur", dur);
            p.style.setProperty("--d", atrasoPulso);
            gP.append(p);
          });
        }

        const no = criar("circle", {
          cx: ult[0].toFixed(1),
          cy: ult[1].toFixed(1),
          r: cfg.raioNo || 4.5,
          class: "no" + (r() < 0.28 ? " no--pulsa" : ""),
        });
        no.style.setProperty("--d", atraso.toFixed(2) + "s");
        gN.append(no);
        idx++;
      }
    });
  }

  // Configurações de cada circuito
  const centroCapa = { x: 800, y: 500 };
  const raioCapa = 205;
  const capaBarramentos = [0, 30, -30, 180, 150, 210, 90, -90].map((ang, i) => ({
    x: centroCapa.x + Math.cos((ang * Math.PI) / 180) * raioCapa,
    y: centroCapa.y + Math.sin((ang * Math.PI) / 180) * raioCapa * 0.95,
    ang,
    linhas: [3, 2, 3, 3, 2, 3, 2, 2][i],
    passos: 3,
    min: 90,
    max: 230,
    opcional: i > 5,
  }));

  const circuitos = {
    capa: { w: 1600, h: 1000, semente: 7, espaco: 16, pulsos: 0.7, halo: true, barramentos: capaBarramentos },
    contato: {
      w: 1200, h: 520, semente: 33, espaco: 14, pulsos: 0.6, raioNo: 4,
      barramentos: [
        { x: -20, y: 110, ang: 0, linhas: 3, min: 70, max: 170 },
        { x: -20, y: 400, ang: 0, linhas: 3, min: 60, max: 160 },
        { x: 1220, y: 130, ang: 180, linhas: 3, min: 70, max: 170 },
        { x: 1220, y: 410, ang: 180, linhas: 2, min: 60, max: 160 },
        { x: 600, y: 560, ang: -90, linhas: 2, min: 20, max: 50, passos: 2, opcional: true },
      ],
    },
  };

  const svgsCircuito = document.querySelectorAll("svg[data-circuito]");
  svgsCircuito.forEach((svg) => {
    const cfg = circuitos[svg.dataset.circuito];
    if (cfg) desenharCircuito(svg, cfg);
  });

  // Liga/desliga as animações dos circuitos conforme visibilidade (desempenho)
  if ("IntersectionObserver" in window) {
    const obsCircuito = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => en.target.classList.toggle("ligado", en.isIntersecting));
    }, { threshold: 0 });
    svgsCircuito.forEach((svg) => {
      if (svg.dataset.circuito === "capa") svg.classList.add("ligado");
      else obsCircuito.observe(svg);
    });
  } else {
    svgsCircuito.forEach((svg) => svg.classList.add("ligado"));
  }

  /* -------------------------------------------------------------------
     TÍTULO DO HERO: revelação palavra por palavra
     ------------------------------------------------------------------- */
  const tituloHero = document.querySelector("[data-palavras]");
  if (tituloHero) {
    let w = 0;
    const dividir = (no, dentroGrad) => {
      Array.from(no.childNodes).forEach((filho) => {
        if (filho.nodeType === Node.TEXT_NODE) {
          const partes = filho.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          partes.forEach((parte) => {
            if (!parte) return;
            if (/^\s+$/.test(parte)) {
              frag.append(document.createTextNode(" "));
              return;
            }
            const externo = document.createElement("span");
            externo.className = "palavra";
            const interno = document.createElement("span");
            interno.textContent = parte;
            interno.style.setProperty("--w", w++);
            externo.append(interno);
            frag.append(externo);
          });
          filho.replaceWith(frag);
        } else if (filho.nodeType === Node.ELEMENT_NODE) {
          filho.classList.add("grad");
          dividir(filho, true);
        }
      });
    };
    tituloHero.setAttribute("aria-label", tituloHero.textContent.replace(/\s+/g, " ").trim());
    dividir(tituloHero, false);

    // Gradiente contínuo atravessando as palavras destacadas
    const ajustarGradiente = () => {
      tituloHero.querySelectorAll(".grad").forEach((grad) => {
        // soma as larguras na ordem de leitura → gradiente contínuo mesmo quebrando linha
        const palavras = Array.from(grad.querySelectorAll(".palavra > span"));
        const larguras = palavras.map((p) => p.offsetWidth);
        const total = larguras.reduce((a, b) => a + b, 0) || 1;
        let acumulado = 0;
        palavras.forEach((palavra, i) => {
          palavra.style.setProperty("--gw", total + "px");
          palavra.style.setProperty("--gx", -acumulado + "px");
          acumulado += larguras[i];
        });
      });
    };
    ajustarGradiente();
    document.fonts?.ready.then(ajustarGradiente);
    window.addEventListener("resize", ajustarGradiente);
  }

  /* -------------------------------------------------------------------
     BARRAS DE PROGRESSO (porcentagem real lida do HTML)
     ------------------------------------------------------------------- */
  const barras = Array.from(document.querySelectorAll(".progress-box")).map((box) => {
    const span = box.querySelector("div > span");
    const rotulo = box.querySelector("p");
    const alvo = span?.style.width || "0%";
    if (rotulo && !rotulo.querySelector("em")) {
      const em = document.createElement("em");
      em.textContent = alvo;
      rotulo.append(em);
    }
    if (span && !reduzMovimento) span.style.width = "0%";
    return { span, alvo };
  });

  /* -------------------------------------------------------------------
     CONTADORES DO HERO (+12, 98%, 100%)
     ------------------------------------------------------------------- */
  function contar(el) {
    const original = el.textContent.trim();
    const m = original.match(/^(\D*)(\d+)(\D*)$/);
    if (!m || reduzMovimento) return;
    const [, pre, num, suf] = m;
    const alvo = parseInt(num, 10);
    const dur = 1600;
    const inicio = performance.now();
    const passo = (agora) => {
      const t = limitar((agora - inicio) / dur, 0, 1);
      const e = 1 - Math.pow(1 - t, 4);
      el.textContent = pre + Math.round(alvo * e) + suf;
      if (t < 1) requestAnimationFrame(passo);
      else el.textContent = original;
    };
    el.textContent = pre + "0" + suf;
    requestAnimationFrame(passo);
  }

  /* -------------------------------------------------------------------
     ATIVAÇÃO DO HERO (quando a capa abre)
     ------------------------------------------------------------------- */
  const hero = document.querySelector(".hero");
  let heroAtivo = false;
  function ativarHero() {
    if (heroAtivo || !hero) return;
    heroAtivo = true;
    hero.classList.add("ativo");
    setTimeout(() => {
      barras.forEach(({ span, alvo }) => { if (span) span.style.width = alvo; });
    }, 900);
    setTimeout(() => {
      hero.querySelectorAll(".hero-dados strong").forEach(contar);
    }, 850);
  }

  /* -------------------------------------------------------------------
     RÓTULOS DE SEÇÃO: efeito "decodificação"
     ------------------------------------------------------------------- */
  const SIMBOLOS = "01<>/{}[]#$%&*+=_ABCDEFXZ";
  function decodificar(el) {
    if (reduzMovimento || el.dataset.decodificado) return;
    el.dataset.decodificado = "1";
    const final = el.textContent;
    el.setAttribute("aria-label", final);
    const total = 22;
    let quadro = 0;
    const tick = () => {
      quadro++;
      const revelados = Math.floor((quadro / total) * final.length);
      el.textContent = final
        .split("")
        .map((c, i) => (i < revelados || c === " " ? c : SIMBOLOS[(Math.random() * SIMBOLOS.length) | 0]))
        .join("");
      if (quadro < total) setTimeout(tick, 32);
      else el.textContent = final;
    };
    tick();
  }

  /* -------------------------------------------------------------------
     SCROLL REVEAL (entrada e saída)
     ------------------------------------------------------------------- */
  const grupos = [
    { sel: ".section-title", tipo: "", passo: 0 },
    { sel: "#sobre > p", tipo: "", passo: 0, atraso: 0.15 },
    { sel: ".mvv-item", tipo: "", passo: 0.12 },
    { sel: ".servicos-grid > div", tipo: "", passo: 0.1 },
    { sel: ".plano", tipo: "escala", passo: 0.12 },
    { sel: ".proj-card", tipo: "", passo: 0.12 },
    { sel: ".contatos", tipo: "escala", passo: 0 },
    { sel: ".contatos-conteudo > *", tipo: "", passo: 0.1, atraso: 0.25 },
    { sel: ".divisor-circuito", tipo: "", passo: 0 },
    { sel: ".rodape-conteudo > *", tipo: "", passo: 0.1 },
    { sel: "#integrantes .eq-intro > *", tipo: "esquerda", passo: 0.12 },
  ];

  const revelaveis = [];
  grupos.forEach((g) => {
    document.querySelectorAll(g.sel).forEach((el, i) => {
      el.dataset.reveal = g.tipo;
      el.style.setProperty("--rd", ((g.atraso || 0) + i * g.passo).toFixed(2) + "s");
      revelaveis.push(el);
    });
  });

  if ("IntersectionObserver" in window && !reduzMovimento) {
    const obsReveal = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        const el = en.target;
        if (en.isIntersecting) {
          el.classList.add("visivel");
          if (el.classList.contains("section-title")) {
            const rotulo = el.querySelector(":scope > span");
            if (rotulo) setTimeout(() => decodificar(rotulo), 200);
          }
        } else if (en.boundingClientRect.top > 0) {
          // saiu pela parte de baixo → reinicia para animar de novo
          el.classList.remove("visivel");
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revelaveis.forEach((el) => obsReveal.observe(el));
  } else {
    revelaveis.forEach((el) => el.classList.add("visivel"));
  }

  /* -------------------------------------------------------------------
     CARDS: borda luminosa + luz no cursor + tilt 3D
     ------------------------------------------------------------------- */
  const seletoresFx = [
    ".dashboard-card",
    ".hero-dados > div",
    ".mvv-item",
    ".servicos-grid > div",
    ".plano",
    ".proj-card",
  ];

  document.querySelectorAll(seletoresFx.join(",")).forEach((card) => {
    card.classList.add("fx");
    if (card.matches(".mvv-item, .servicos-grid > div, .plano, .proj-card")) card.classList.add("hud");
    if (!ponteiroFino) return;

    const intensidade = card.classList.contains("dashboard-card") ? 9 : card.matches(".hero-dados > div") ? 10 : 6;
    let quadro = null;

    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (quadro) cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        card.style.setProperty("--mx", x + "px");
        card.style.setProperty("--my", y + "px");
        if (!reduzMovimento) {
          const px = x / r.width - 0.5;
          const py = y / r.height - 0.5;
          card.style.setProperty("--ry", (px * intensidade).toFixed(2) + "deg");
          card.style.setProperty("--rx", (-py * intensidade).toFixed(2) + "deg");
        }
      });
    });

    card.addEventListener("pointerleave", () => {
      if (quadro) cancelAnimationFrame(quadro);
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });

  /* -------------------------------------------------------------------
     BOTÕES: efeito magnético + ondulação de energia
     ------------------------------------------------------------------- */
  const botoes = document.querySelectorAll(".btn-principal, .btn-secundario, .plano > a, #temaBtn");
  botoes.forEach((btn) => {
    if (ponteiroFino && !reduzMovimento) {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) / r.width;
        const y = (e.clientY - r.top - r.height / 2) / r.height;
        btn.style.setProperty("--mag-x", (x * 10).toFixed(1) + "px");
        btn.style.setProperty("--mag-y", (y * 8).toFixed(1) + "px");
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.setProperty("--mag-x", "0px");
        btn.style.setProperty("--mag-y", "0px");
      });
    }
    if (btn.matches(".btn-principal, .btn-secundario") && !reduzMovimento) {
      btn.addEventListener("pointerdown", (e) => {
        const r = btn.getBoundingClientRect();
        const onda = document.createElement("span");
        onda.className = "onda";
        onda.style.left = e.clientX - r.left + "px";
        onda.style.top = e.clientY - r.top + "px";
        btn.append(onda);
        onda.addEventListener("animationend", () => onda.remove(), { once: true });
      });
    }
  });

  /* -------------------------------------------------------------------
     LUZ QUE ACOMPANHA O CURSOR
     ------------------------------------------------------------------- */
  const luz = document.querySelector(".cursor-luz");
  if (luz && ponteiroFino && !reduzMovimento) {
    let alvoX = innerWidth / 2;
    let alvoY = innerHeight / 2;
    let atualX = alvoX;
    let atualY = alvoY;
    let animando = false;
    const mover = () => {
      atualX += (alvoX - atualX) * 0.14;
      atualY += (alvoY - atualY) * 0.14;
      luz.style.transform = `translate3d(${atualX.toFixed(1)}px, ${atualY.toFixed(1)}px, 0)`;
      if (Math.abs(alvoX - atualX) > 0.5 || Math.abs(alvoY - atualY) > 0.5) requestAnimationFrame(mover);
      else animando = false;
    };
    window.addEventListener("pointermove", (e) => {
      alvoX = e.clientX;
      alvoY = e.clientY;
      luz.classList.add("ativa");
      if (!animando) {
        animando = true;
        requestAnimationFrame(mover);
      }
    }, { passive: true });
    document.addEventListener("pointerleave", () => luz.classList.remove("ativa"));
  }

  /* -------------------------------------------------------------------
     NAVEGAÇÃO: indicador deslizante + seção ativa (scroll spy)
     ------------------------------------------------------------------- */
  const listaNav = document.querySelector(".header nav ul");
  const linksNav = Array.from(document.querySelectorAll(".header nav a[href^='#']"));
  let linkAtivo = null;
  let indicador = null;

  if (listaNav) {
    indicador = document.createElement("span");
    indicador.className = "nav-indicador";
    indicador.setAttribute("aria-hidden", "true");
    listaNav.prepend(indicador);
  }

  function moverIndicador(link) {
    if (!indicador) return;
    if (!link) {
      indicador.style.opacity = "0";
      return;
    }
    const li = link.parentElement;
    indicador.style.opacity = "1";
    indicador.style.width = li.offsetWidth + "px";
    indicador.style.transform = `translateX(${li.offsetLeft}px)`;
  }

  linksNav.forEach((link) => {
    link.addEventListener("pointerenter", () => moverIndicador(link));
    link.addEventListener("focus", () => moverIndicador(link));
  });
  listaNav?.addEventListener("pointerleave", () => moverIndicador(linkAtivo));

  function definirAtivo(id) {
    const novo = linksNav.find((l) => l.getAttribute("href") === "#" + id) || null;
    if (novo === linkAtivo) return;
    linksNav.forEach((l) => {
      l.classList.toggle("ativo", l === novo);
      if (l === novo) l.setAttribute("aria-current", "true");
      else l.removeAttribute("aria-current");
    });
    linkAtivo = novo;
    moverIndicador(linkAtivo);
  }

  const secoesSpy = linksNav
    .map((l) => document.querySelector(l.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window && secoesSpy.length) {
    const visiveis = new Map();
    const obsSpy = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (en.isIntersecting) visiveis.set(en.target.id, en.target);
        else visiveis.delete(en.target.id);
      });
      const atual = secoesSpy.find((s) => visiveis.has(s.id));
      definirAtivo(atual ? atual.id : null);
    }, { rootMargin: "-45% 0px -50% 0px" });
    secoesSpy.forEach((s) => obsSpy.observe(s));
  }

  window.addEventListener("resize", () => moverIndicador(linkAtivo));

  /* -------------------------------------------------------------------
     CAPA DE ABERTURA: logo do centro → header
     ------------------------------------------------------------------- */
  const header = document.querySelector(".header");
  const logoArea = document.querySelector(".header .logo-area");
  const logoCover = document.querySelector(".logo-cover");
  const capaFundo = logoCover?.querySelector(".capa-fundo");
  const capaCircuito = logoCover?.querySelector(".capa-circuito");
  const capaHex = logoCover?.querySelector(".capa-hex");
  const capaTexto = logoCover?.querySelector(".capa-texto");
  const headerNav = document.querySelector(".header nav");
  const semCapa = raiz.classList.contains("sem-capa") || !logoArea || !logoCover;

  let logoBaseX = 0;
  let logoBaseY = 0;
  let logoWidth = 0;
  let logoHeight = 0;
  let escalaMax = 2.3;

  function medirLogo() {
    if (!logoArea) return;
    logoArea.style.transform = "none";
    const rect = logoArea.getBoundingClientRect();
    logoWidth = rect.width;
    logoHeight = rect.height;
    logoBaseX = rect.left;
    logoBaseY = rect.top;
    escalaMax = limitar((window.innerWidth * 0.8) / (logoWidth || 1), 1.2, 2.3);
    if (logoCover) {
      logoCover.style.setProperty("--tag-offset", (logoHeight * escalaMax) / 2 + 70 + "px");
      logoCover.style.setProperty("--hex-size", Math.min(logoHeight * escalaMax * 3.6, window.innerWidth * 0.9) + "px");
    }
  }

  function atualizarCapa() {
    if (semCapa) {
      header?.classList.add("fixo");
      if (headerNav) { headerNav.style.opacity = 1; headerNav.style.pointerEvents = "auto"; }
      if (menuToggle) { menuToggle.style.opacity = 1; menuToggle.style.pointerEvents = "auto"; }
      ativarHero();
      return;
    }

    const maxScroll = window.innerHeight * 0.6; // 60vh
    const progresso = limitar(window.scrollY / maxScroll, 0, 1);

    // 1. Encolhe a capa de fundo e dissolve os elementos dela
    if (capaFundo) capaFundo.style.transform = `scaleY(${1 - progresso})`;
    if (capaCircuito) {
      capaCircuito.style.opacity = Math.max(0, 1 - progresso * 1.5);
      capaCircuito.style.transform = `translate3d(0, ${-progresso * 120}px, 0) scale(${1 + progresso * 0.15})`;
    }
    if (capaHex) {
      capaHex.style.opacity = Math.max(0, 1 - progresso * 2);
      capaHex.style.transform = `scale(${1 - progresso * 0.5})`;
    }
    if (capaTexto) {
      capaTexto.style.opacity = Math.max(0, 1 - progresso * 3);
      capaTexto.style.transform = `translate3d(0, ${progresso * 40}px, 0)`;
    }
    logoCover.style.visibility = progresso >= 1 ? "hidden" : "visible";
    capaCircuito?.classList.toggle("ligado", progresso < 1);

    // 2. Aparição do Menu (visível apenas nos últimos 30% do scroll)
    const opacidadeMenu = Math.max(0, (progresso - 0.7) / 0.3);
    const interativo = progresso >= 0.9 ? "auto" : "none";
    if (headerNav) {
      headerNav.style.opacity = opacidadeMenu;
      headerNav.style.pointerEvents = interativo;
    }
    if (menuToggle) {
      menuToggle.style.opacity = opacidadeMenu;
      menuToggle.style.pointerEvents = interativo;
    }
    header?.classList.toggle("fixo", progresso >= 0.98);

    // 3. Movimento da Logo do Centro para o Header
    const centroX = window.innerWidth / 2 - logoWidth / 2 - logoBaseX;
    const centroY = window.innerHeight / 2 - logoHeight / 2 - logoBaseY;
    const restante = 1 - progresso;
    const escala = 1 + restante * (escalaMax - 1);
    logoArea.style.transform = `translate3d(${restante * centroX}px, ${restante * centroY}px, 0) scale(${escala})`;

    if (progresso >= 0.5) ativarHero();
  }

  /* -------------------------------------------------------------------
     EQUIPE: rolagem horizontal fixada (implementação única)
     ------------------------------------------------------------------- */
  const secaoEquipe = document.querySelector("#integrantes");
  const trilhoEquipe = document.querySelector("#integrantes .cards");
  const barraEquipe = document.querySelector(".eq-progresso span");
  const cardsEquipe = Array.from(document.querySelectorAll("#integrantes .eq-card:not(.eq-intro)"));
  let cardFoco = null;

  function atualizarEquipe() {
    if (!secaoEquipe || !trilhoEquipe) return;
    const rect = secaoEquipe.getBoundingClientRect();
    if (rect.bottom < -50 || rect.top > window.innerHeight + 50) return;
    const total = secaoEquipe.offsetHeight - window.innerHeight;
    if (total <= 0) return;

    const progresso = limitar(-rect.top / total, 0, 1);
    const maxTranslate = Math.max(0, trilhoEquipe.scrollWidth - window.innerWidth);
    trilhoEquipe.style.transform = `translate3d(${-progresso * maxTranslate}px, 0, 0)`;
    if (barraEquipe) barraEquipe.style.transform = `scaleX(${progresso})`;

    // Destaca o card mais próximo do centro da tela
    const meio = window.innerWidth / 2;
    let melhor = null;
    let menor = Infinity;
    cardsEquipe.forEach((card) => {
      const r = card.getBoundingClientRect();
      const dist = Math.abs(r.left + r.width / 2 - meio);
      if (dist < menor) { menor = dist; melhor = card; }
    });
    if (melhor !== cardFoco) {
      cardFoco?.classList.remove("foco");
      if (menor < window.innerWidth * 0.35) {
        melhor.classList.add("foco");
        cardFoco = melhor;
      } else cardFoco = null;
    }
  }

  /* -------------------------------------------------------------------
     PROGRESSO DA PÁGINA
     ------------------------------------------------------------------- */
  const barraScroll = document.querySelector(".scroll-progresso span");
  function atualizarProgresso() {
    if (!barraScroll) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    barraScroll.style.transform = `scaleX(${max > 0 ? limitar(window.scrollY / max, 0, 1) : 0})`;
  }

  /* -------------------------------------------------------------------
     LAÇO ÚNICO DE ROLAGEM (rAF)
     ------------------------------------------------------------------- */
  let agendado = false;
  function quadroRolagem() {
    agendado = false;
    atualizarCapa();
    atualizarEquipe();
    atualizarProgresso();
  }
  function aoRolar() {
    if (!agendado) {
      agendado = true;
      requestAnimationFrame(quadroRolagem);
    }
  }

  window.addEventListener("scroll", aoRolar, { passive: true });
  window.addEventListener("resize", () => {
    medirLogo();
    aoRolar();
  });

  medirLogo();
  quadroRolagem();
  document.fonts?.ready.then(() => {
    medirLogo();
    quadroRolagem();
  });
})();
