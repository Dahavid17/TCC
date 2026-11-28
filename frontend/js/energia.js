/* =====================================================================
   BUZZ CODEX — ENERGIA NOS CIRCUITOS (Canvas)

   Gera uma placa de circuito (grafo de trilhas a 30°, como na logo) e
   faz pulsos de energia percorrerem as trilhas nó a nó, seguindo curvas
   e ramificações reais. Reage ao mouse (campo de energia, pulsos e ondas
   que se propagam pelas conexões) e à rolagem (aceleração e rajadas
   quando novas seções entram na tela).
   ===================================================================== */
(() => {
  "use strict";

  const canvas = document.querySelector("canvas.energia-circuito");
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  document.documentElement.classList.add("energia");

  // Celular/aparelho fraco: placa estática (sem loop de animação contínuo), só reage ao toque.
  const aparelhoLeve = !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.innerWidth < 900 || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const reduzMovimento = aparelhoLeve || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ponteiroFino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const RAD = Math.PI / 180;
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  const sortear = (a, b) => a + Math.random() * (b - a);
  const escolher = (lista) => lista[(Math.random() * lista.length) | 0];

  let W = 0;
  let H = 0;
  let DPR = 1;
  let compacto = false;

  let nos = [];
  let arestas = [];
  let entradas = [];        // nós de ponta (onde a energia nasce)
  let gradeNos = new Map(); // índice espacial para achar nós perto do cursor

  const camadaBase = document.createElement("canvas");   // trilhas apagadas
  const camadaBrilho = document.createElement("canvas"); // trilhas acesas (campo do mouse)
  const camadaCampo = document.createElement("canvas");  // recorte do campo do mouse
  const ctxBase = camadaBase.getContext("2d");
  const ctxBrilho = camadaBrilho.getContext("2d");
  const ctxCampo = camadaCampo.getContext("2d");

  /* -------------------------------------------------------------------
     TEMA (cores da marca)
     ------------------------------------------------------------------- */
  let tema = null;
  const sprites = {};

  function lerTema() {
    const claro = document.body.classList.contains("claro");
    tema = claro
      ? {
          claro: true,
          trilha: "rgba(163, 4, 211, 0.15)",
          no: "rgba(163, 4, 211, 0.28)",
          trilhaAcesa: "rgba(163, 4, 211, 0.85)",
          fundoNo: "#f6f4fb",
          modo: "source-over",
          cores: { roxo: [163, 4, 211], violeta: [124, 58, 237], verde: [37, 160, 0] },
          forcaBrilho: 0.55,
        }
      : {
          claro: false,
          trilha: "rgba(139, 92, 246, 0.24)",
          no: "rgba(139, 92, 246, 0.42)",
          trilhaAcesa: "rgba(196, 160, 255, 0.95)",
          fundoNo: "#07060b",
          modo: "lighter",
          cores: { roxo: [200, 110, 255], violeta: [150, 120, 255], verde: [110, 255, 60] },
          forcaBrilho: 1,
        };
    // Sprites de brilho pré-renderizados (muito mais leve que shadowBlur)
    Object.entries(tema.cores).forEach(([nome, [r, g, b]]) => {
      const s = document.createElement("canvas");
      s.width = s.height = 64;
      const c = s.getContext("2d");
      const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(255,255,255,${tema.claro ? 0.5 : 0.95})`);
      grad.addColorStop(0.18, `rgba(${r},${g},${b},0.85)`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},0.22)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = grad;
      c.fillRect(0, 0, 64, 64);
      sprites[nome] = s;
    });
  }

  /* -------------------------------------------------------------------
     GERAÇÃO DA PLACA (grafo de trilhas)
     ------------------------------------------------------------------- */
  function deslocar(pts, off) {
    return pts.map((p, i) => {
      const normal = (a, b) => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        return [-dy / l, dx / l];
      };
      const n1 = pts[i - 1] ? normal(pts[i - 1], p) : null;
      const n2 = pts[i + 1] ? normal(p, pts[i + 1]) : null;
      let n = n1 || n2;
      if (n1 && n2) {
        const mx = n1[0] + n2[0];
        const my = n1[1] + n2[1];
        const ml = Math.hypot(mx, my) || 1;
        n = [mx / ml, my / ml];
        const cos = n[0] * n1[0] + n[1] * n1[1] || 1;
        n = [n[0] / cos, n[1] / cos];
      }
      return [p[0] + n[0] * off, p[1] + n[1] * off];
    });
  }

  function gerarPlaca() {
    nos = [];
    arestas = [];
    gradeNos = new Map();
    const ocupacao = new Map(); // célula → id do barramento
    const CEL = 12;
    let proxBarramento = 0;

    const celula = (x, y) => ((x / CEL) | 0) + ":" + ((y / CEL) | 0);

    const segmentoLivre = (x1, y1, x2, y2, bus) => {
      const passos = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6);
      let colisoes = 0;
      for (let i = 1; i <= passos; i++) {
        const t = i / passos;
        const dono = ocupacao.get(celula(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t));
        if (dono !== undefined && dono !== bus) colisoes++;
      }
      return colisoes === 0;
    };

    const marcar = (x1, y1, x2, y2, bus) => {
      const passos = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6);
      for (let i = 0; i <= passos; i++) {
        const t = i / passos;
        const c = celula(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
        if (!ocupacao.has(c)) ocupacao.set(c, bus);
      }
    };

    const novoNo = (x, y) => {
      const no = { x, y, adj: [], brilho: 0, id: nos.length };
      nos.push(no);
      return no;
    };

    const ligar = (a, b) => {
      const aresta = { a, b, len: Math.hypot(b.x - a.x, b.y - a.y), brilho: 0, id: arestas.length };
      arestas.push(aresta);
      a.adj.push(aresta);
      b.adj.push(aresta);
      return aresta;
    };

    const foraDaTela = (x, y) => x < -70 || x > W + 70 || y < -70 || y > H + 70;

    // Caminho base: alterna entre a direção principal e um desvio de ±30°
    function caminhoBase(x, y, ang, passos, min, max) {
      const pts = [[x, y]];
      let a = ang;
      for (let i = 0; i < passos; i++) {
        const L = sortear(min, max);
        x += Math.cos(a * RAD) * L;
        y += Math.sin(a * RAD) * L;
        if (foraDaTela(x, y)) break;
        pts.push([x, y]);
        a = a === ang ? ang + (Math.random() < 0.5 ? -30 : 30) : ang;
      }
      return pts;
    }

    // Cria uma cadeia de nós a partir de uma polilinha (para no 1º bloqueio)
    function cadeia(pts, bus, noInicial) {
      let atual = noInicial || novoNo(pts[0][0], pts[0][1]);
      const criados = [atual];
      for (let i = 1; i < pts.length; i++) {
        const [x, y] = pts[i];
        if (!segmentoLivre(atual.x, atual.y, x, y, bus)) break;
        marcar(atual.x, atual.y, x, y, bus);
        const n = novoNo(x, y);
        ligar(atual, n);
        criados.push(n);
        atual = n;
      }
      return criados;
    }

    // Barramento: trilhas paralelas + ramificações
    function barramento(x, y, ang, linhas, passos, profundidade = 0) {
      const bus = proxBarramento++;
      const base = caminhoBase(x, y, ang, passos, 55, 150);
      if (base.length < 2) return;
      const espaco = 13;

      for (let k = 0; k < linhas; k++) {
        const pts = deslocar(base, (k - (linhas - 1) / 2) * espaco);
        // escalonar o final de cada trilha
        if (pts.length > 2 && Math.random() < 0.6) {
          const u = pts[pts.length - 1];
          const p = pts[pts.length - 2];
          const corte = Math.random() * 0.5;
          u[0] -= (u[0] - p[0]) * corte;
          u[1] -= (u[1] - p[1]) * corte;
        }
        const criados = cadeia(pts, bus);

        // Ramificações saindo das trilhas externas
        const externa = k === 0 || k === linhas - 1;
        if (externa && profundidade < 2 && criados.length > 2) {
          criados.slice(1, -1).forEach((no) => {
            if (Math.random() > 0.32) return;
            const lado = k === 0 ? -1 : 1;
            const giro = (Math.random() < 0.5 ? 30 : 60) * lado * (linhas === 1 ? (Math.random() < 0.5 ? -1 : 1) : 1);
            const subBus = proxBarramento++;
            const subBase = caminhoBase(no.x, no.y, ang + giro, 2 + ((Math.random() * 3) | 0), 40, 120);
            if (subBase.length > 1) cadeia(subBase, subBus, no);
          });
        }
      }
    }

    // Sementes: principalmente pelas laterais (como as trilhas da logo)
    const densidade = compacto ? 1.4 : 1;
    const linhas = () => 1 + ((Math.random() * 3) | 0);
    for (let y = sortear(30, 90); y < H + 40; y += sortear(105, 170) * densidade) {
      barramento(-50, y, escolher([0, 0, 30, -30]), linhas(), 4 + ((Math.random() * 5) | 0));
    }
    for (let y = sortear(50, 120); y < H + 40; y += sortear(105, 170) * densidade) {
      barramento(W + 50, y, escolher([180, 180, 150, 210]), linhas(), 4 + ((Math.random() * 5) | 0));
    }
    for (let x = sortear(80, 220); x < W - 40; x += sortear(190, 300) * densidade) {
      barramento(x, -50, 90, linhas(), 3 + ((Math.random() * 3) | 0));
      if (Math.random() < 0.8) barramento(x + sortear(-80, 80), H + 50, -90, linhas(), 3 + ((Math.random() * 3) | 0));
    }
    // Sementes internas: completam a placa nas áreas vazias
    const internas = Math.round((W * H) / (compacto ? 140000 : 85000));
    for (let i = 0; i < internas; i++) {
      barramento(sortear(40, W - 40), sortear(40, H - 40), escolher([0, 30, -30, 180, 150, 210, 90, -90]), linhas(), 3 + ((Math.random() * 4) | 0));
    }

    // Índices auxiliares
    entradas = nos.filter((n) => n.adj.length === 1);
    nos.forEach((n) => {
      const chave = ((n.x / 120) | 0) + ":" + ((n.y / 120) | 0);
      if (!gradeNos.has(chave)) gradeNos.set(chave, []);
      gradeNos.get(chave).push(n);
    });
  }

  /* -------------------------------------------------------------------
     CAMADAS ESTÁTICAS (desenhadas só ao gerar / trocar tema)
     ------------------------------------------------------------------- */
  function desenharTrilhas(c, corTrilha, corNo, largura) {
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, W, H);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = corTrilha;
    c.lineWidth = largura;
    c.beginPath();
    arestas.forEach((e) => {
      c.moveTo(e.a.x, e.a.y);
      c.lineTo(e.b.x, e.b.y);
    });
    c.stroke();

    // Pontas = anéis (como os da logo); junções = pequenos pontos
    c.lineWidth = 1.5;
    nos.forEach((n) => {
      if (n.adj.length === 1) {
        if (n.x < 0 || n.x > W || n.y < 0 || n.y > H) return;
        c.beginPath();
        c.arc(n.x, n.y, 3.6, 0, Math.PI * 2);
        c.fillStyle = tema.fundoNo;
        c.fill();
        c.strokeStyle = corNo;
        c.stroke();
      } else if (n.adj.length > 2) {
        c.beginPath();
        c.arc(n.x, n.y, 2.2, 0, Math.PI * 2);
        c.fillStyle = corNo;
        c.fill();
      }
    });
  }

  function redesenharCamadas() {
    desenharTrilhas(ctxBase, tema.trilha, tema.no, 1.2);
    desenharTrilhas(ctxBrilho, tema.trilhaAcesa, tema.trilhaAcesa, 1.6);
  }

  function dimensionar() {
    W = window.innerWidth;
    H = window.innerHeight;
    compacto = W < 760;
    DPR = Math.min(window.devicePixelRatio || 1, compacto ? 1.25 : 1.5);
    [canvas, camadaBase, camadaBrilho].forEach((c) => {
      c.width = Math.round(W * DPR);
      c.height = Math.round(H * DPR);
    });
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    gerarPlaca();
    redesenharCamadas();
    pulsos = [];
  }

  /* -------------------------------------------------------------------
     PULSOS DE ENERGIA
     ------------------------------------------------------------------- */
  let pulsos = [];
  const TIPOS = [
    // centelha rápida, rastro curto
    { vel: [260, 420], rastro: [40, 70], forca: [0.6, 0.9], tam: 9 },
    // pacote médio
    { vel: [140, 240], rastro: [70, 120], forca: [0.75, 1], tam: 12 },
    // feixe lento e intenso, rastro longo
    { vel: [80, 140], rastro: [110, 180], forca: [0.9, 1], tam: 15 },
  ];
  const CORES = ["roxo", "violeta", "verde", "roxo", "violeta"];

  const limitePulsos = () => {
    const base = Math.round((W * H) / (compacto ? 70000 : 52000));
    return limitar(base, 6, 30);
  };

  function emitir(no, opcoes = {}) {
    if (!no || !no.adj.length) return null;
    if (pulsos.length >= limitePulsos() + (opcoes.extra ? 16 : 0)) return null;
    const tipo = opcoes.tipo ?? TIPOS[(Math.random() * TIPOS.length) | 0];
    const aresta = escolher(no.adj);
    const p = {
      aresta,
      de: no,
      t: 0,
      vel: sortear(tipo.vel[0], tipo.vel[1]) * (opcoes.vel || 1),
      maxRastro: sortear(tipo.rastro[0], tipo.rastro[1]),
      forca: sortear(tipo.forca[0], tipo.forca[1]) * (opcoes.forca || 1),
      tam: tipo.tam,
      cor: opcoes.cor || escolher(CORES),
      rastro: [[no.x, no.y]],
      morrendo: false,
      vida: 1,
    };
    pulsos.push(p);
    return p;
  }

  const outraPonta = (aresta, no) => (aresta.a === no ? aresta.b : aresta.a);

  function proximaAresta(p, no) {
    const opcoes = no.adj.filter((e) => e !== p.aresta);
    if (!opcoes.length) return null;
    if (opcoes.length === 1) return opcoes[0];
    // tende a seguir reto, mas às vezes pega a ramificação
    const veio = p.de;
    const dx = no.x - veio.x;
    const dy = no.y - veio.y;
    const l = Math.hypot(dx, dy) || 1;
    let melhor = opcoes[0];
    let melhorDot = -2;
    opcoes.forEach((e) => {
      const o = outraPonta(e, no);
      const ex = o.x - no.x;
      const ey = o.y - no.y;
      const el = Math.hypot(ex, ey) || 1;
      const dot = (dx * ex + dy * ey) / (l * el);
      if (dot > melhorDot) { melhorDot = dot; melhor = e; }
    });
    return Math.random() < 0.55 ? melhor : escolher(opcoes);
  }

  function aparar(p) {
    // mantém o rastro com comprimento máximo (em px), cortando a cauda
    let total = 0;
    for (let i = p.rastro.length - 1; i > 0; i--) {
      const [x1, y1] = p.rastro[i];
      const [x0, y0] = p.rastro[i - 1];
      const seg = Math.hypot(x1 - x0, y1 - y0);
      if (total + seg > p.maxRastro) {
        const resto = (p.maxRastro - total) / (seg || 1);
        p.rastro[i - 1] = [x1 + (x0 - x1) * resto, y1 + (y0 - y1) * resto];
        p.rastro.splice(0, i - 1);
        return;
      }
      total += seg;
    }
  }

  function atualizarPulso(p, dt) {
    if (p.morrendo) {
      p.maxRastro -= p.vel * dt * 1.4;
      p.vida -= dt * 2.5;
      if (p.maxRastro <= 2) return false;
      aparar(p);
      return true;
    }

    let avanco = p.vel * velocidadeGlobal * dt;
    while (avanco > 0) {
      const restante = p.aresta.len - p.t;
      if (avanco < restante) {
        p.t += avanco;
        avanco = 0;
      } else {
        avanco -= restante;
        const chegada = outraPonta(p.aresta, p.de);
        p.rastro.push([chegada.x, chegada.y]);
        chegada.brilho = Math.max(chegada.brilho, p.forca);
        p.aresta.brilho = Math.max(p.aresta.brilho, p.forca * 0.35);
        const prox = proximaAresta(p, chegada);
        if (!prox) {
          // chegou numa ponta: o anel acende forte e o pulso se dissipa
          chegada.brilho = 1;
          p.morrendo = true;
          aparar(p);
          return true;
        }
        p.de = chegada;
        p.aresta = prox;
        p.t = 0;
      }
    }

    const o = outraPonta(p.aresta, p.de);
    const k = p.t / (p.aresta.len || 1);
    p.rastro.push([p.de.x + (o.x - p.de.x) * k, p.de.y + (o.y - p.de.y) * k]);
    aparar(p);
    return true;
  }

  /* -------------------------------------------------------------------
     ONDAS (propagação pelas conexões a partir de um nó)
     ------------------------------------------------------------------- */
  let ondas = [];

  function propagarOnda(origem, profundidadeMax = 6, forca = 1) {
    if (!origem) return;
    const agora = performance.now();
    const visitados = new Set([origem]);
    let fronteira = [origem];
    for (let d = 0; d <= profundidadeMax && fronteira.length; d++) {
      const proxima = [];
      fronteira.forEach((no) => {
        ondas.push({ no, em: agora + d * 75, forca: forca * (1 - d / (profundidadeMax + 1)) });
        no.adj.forEach((e) => {
          const o = outraPonta(e, no);
          if (visitados.has(o)) return;
          visitados.add(o);
          ondas.push({ aresta: e, em: agora + d * 75 + 35, forca: forca * (1 - d / (profundidadeMax + 1)) });
          proxima.push(o);
        });
      });
      fronteira = proxima;
    }
  }

  function noMaisProximo(x, y, raio) {
    const cx = (x / 120) | 0;
    const cy = (y / 120) | 0;
    let melhor = null;
    let menor = raio * raio;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const lista = gradeNos.get(cx + i + ":" + (cy + j));
        if (!lista) continue;
        lista.forEach((n) => {
          const d = (n.x - x) ** 2 + (n.y - y) ** 2;
          if (d < menor) { menor = d; melhor = n; }
        });
      }
    }
    return melhor;
  }

  function nosNoRaio(x, y, raio) {
    const r2 = raio * raio;
    const res = [];
    const cx = (x / 120) | 0;
    const cy = (y / 120) | 0;
    const alcance = Math.ceil(raio / 120);
    for (let i = -alcance; i <= alcance; i++) {
      for (let j = -alcance; j <= alcance; j++) {
        gradeNos.get(cx + i + ":" + (cy + j))?.forEach((n) => {
          const d = (n.x - x) ** 2 + (n.y - y) ** 2;
          if (d < r2) res.push([n, d]);
        });
      }
    }
    return res;
  }

  /* -------------------------------------------------------------------
     INTERAÇÃO: MOUSE
     ------------------------------------------------------------------- */
  const RAIO_CAMPO = 190;
  const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999, ativo: false, forca: 0 };
  let ultimoPulsoMouse = 0;
  let ultimaOnda = 0;
  let ultimoMovimento = 0;

  function aoMoverMouse(e) {
    const agora = performance.now();
    const dist = Math.hypot(e.clientX - mouse.x, e.clientY - mouse.y);
    if (!mouse.ativo) {
      mouse.sx = e.clientX;
      mouse.sy = e.clientY;
    }
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.ativo = true;
    ultimoMovimento = agora;
    if (reduzMovimento) {
      pedirQuadro();
      return;
    }

    // Trilhas próximas acendem e disparam pulsos
    if (agora - ultimoPulsoMouse > 110 && dist > 2) {
      ultimoPulsoMouse = agora;
      const no = noMaisProximo(mouse.x, mouse.y, 130);
      if (no) {
        no.brilho = 1;
        emitir(no, { extra: true, vel: 1.4, forca: 1, tipo: TIPOS[0], cor: Math.random() < 0.5 ? "verde" : "violeta" });
      }
    }

    // Ondas de iluminação quando o mouse se move com mais energia
    if (agora - ultimaOnda > 700 && dist > 14) {
      ultimaOnda = agora;
      propagarOnda(noMaisProximo(mouse.x, mouse.y, 160), 5, 0.85);
    }
  }

  function aoClicar(e) {
    if (reduzMovimento) return;
    const no = noMaisProximo(e.clientX, e.clientY, 220);
    if (!no) return;
    propagarOnda(no, 8, 1);
    for (let i = 0; i < 3; i++) emitir(no, { extra: true, vel: 1.2, tipo: TIPOS[1] });
  }

  if (ponteiroFino) {
    window.addEventListener("pointermove", aoMoverMouse, { passive: true });
    document.addEventListener("pointerleave", () => { mouse.ativo = false; pedirQuadro(); });
    window.addEventListener("blur", () => { mouse.ativo = false; });
  }
  window.addEventListener("pointerdown", aoClicar, { passive: true });

  /* -------------------------------------------------------------------
     INTERAÇÃO: ROLAGEM
     ------------------------------------------------------------------- */
  let velocidadeGlobal = 1;
  let impulso = 0;
  let ultimoScroll = window.scrollY;
  let acumuladoScroll = 0;

  window.addEventListener("scroll", () => {
    if (reduzMovimento) return;
    const y = window.scrollY;
    const delta = y - ultimoScroll;
    ultimoScroll = y;
    // acelera temporariamente a energia
    impulso = Math.min(impulso + Math.abs(delta) / 180, 2.6);
    // a cada trecho rolado, novos pulsos entram pela direção do movimento
    acumuladoScroll += Math.abs(delta);
    if (acumuladoScroll > 160) {
      acumuladoScroll = 0;
      const descendo = delta > 0;
      const candidatas = entradas.filter((n) => (descendo ? n.y > H * 0.45 : n.y < H * 0.55));
      emitir(escolher(candidatas.length ? candidatas : entradas), { extra: true, vel: 1.15 });
    }
  }, { passive: true });

  // Rajada de energia quando uma nova seção entra na tela
  function rajada() {
    if (reduzMovimento) return;
    const esquerda = entradas.filter((n) => n.x < 0);
    const direita = entradas.filter((n) => n.x > W);
    for (let i = 0; i < 4; i++) {
      emitir(escolher(esquerda.length ? esquerda : entradas), { extra: true, vel: 1.3, tipo: TIPOS[i % 3] });
      emitir(escolher(direita.length ? direita : entradas), { extra: true, vel: 1.3, tipo: TIPOS[(i + 1) % 3] });
    }
    impulso = Math.min(impulso + 1.2, 2.6);
  }

  if ("IntersectionObserver" in window) {
    const vistas = new WeakSet();
    const obs = new IntersectionObserver((itens) => {
      itens.forEach((it) => {
        if (it.isIntersecting && !vistas.has(it.target)) {
          vistas.add(it.target);
          rajada();
        } else if (!it.isIntersecting) {
          vistas.delete(it.target); // permite nova rajada ao voltar
        }
      });
    }, { threshold: 0.2 });
    document.querySelectorAll(".hero, main > section, .rodape").forEach((s) => obs.observe(s));
  }

  /* -------------------------------------------------------------------
     RENDERIZAÇÃO
     ------------------------------------------------------------------- */
  function desenharCampoMouse() {
    if (!mouse.ativo || !ponteiroFino) return;
    const R = RAIO_CAMPO;
    const lado = Math.round(R * 2 * DPR);
    if (camadaCampo.width !== lado) {
      camadaCampo.width = lado;
      camadaCampo.height = lado;
    }
    const x = mouse.sx;
    const y = mouse.sy;
    ctxCampo.globalCompositeOperation = "source-over";
    ctxCampo.clearRect(0, 0, lado, lado);
    ctxCampo.drawImage(camadaBrilho, (x - R) * DPR, (y - R) * DPR, lado, lado, 0, 0, lado, lado);
    // recorta em círculo suave = "campo de energia"
    ctxCampo.globalCompositeOperation = "destination-in";
    const grad = ctxCampo.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
    grad.addColorStop(0, `rgba(0,0,0,${0.95 * mouse.forca})`);
    grad.addColorStop(0.45, `rgba(0,0,0,${0.5 * mouse.forca})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctxCampo.fillStyle = grad;
    ctxCampo.fillRect(0, 0, lado, lado);
    ctx.drawImage(camadaCampo, x - R, y - R, R * 2, R * 2);
  }

  function corRGBA(nome, a) {
    const [r, g, b] = tema.cores[nome];
    return `rgba(${r},${g},${b},${a})`;
  }

  function desenharArestasAcesas() {
    ctx.lineCap = "round";
    arestas.forEach((e) => {
      if (e.brilho < 0.03) return;
      const a = e.brilho * tema.forcaBrilho;
      ctx.strokeStyle = corRGBA("violeta", a * 0.22);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
      ctx.strokeStyle = corRGBA("violeta", a * 0.85);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  function desenharNosAcesos() {
    nos.forEach((n) => {
      if (n.brilho < 0.04) return;
      const a = n.brilho * tema.forcaBrilho;
      const s = 10 + n.brilho * 22;
      ctx.globalAlpha = a;
      ctx.drawImage(n.adj.length === 1 ? sprites.verde : sprites.violeta, n.x - s / 2, n.y - s / 2, s, s);
      ctx.globalAlpha = 1;
      if (n.adj.length === 1) {
        ctx.strokeStyle = corRGBA("verde", a);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 3.6 + n.brilho * 1.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  function desenharPulso(p) {
    const pts = p.rastro;
    if (pts.length < 2) return;
    const n = pts.length - 1;
    const vida = Math.max(0, p.vida);
    ctx.lineCap = "round";
    // rastro: camada larga (brilho) + núcleo fino, com alfa crescente até a cabeça
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const alfa = f * f * p.forca * vida * tema.forcaBrilho;
      ctx.strokeStyle = corRGBA(p.cor, alfa * 0.28);
      ctx.lineWidth = 2 + f * 5;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.strokeStyle = corRGBA(p.cor, alfa);
      ctx.lineWidth = 1 + f * 1.4;
      ctx.stroke();
    }
    // cabeça luminosa
    const [hx, hy] = pts[n];
    const s = p.tam * (1.6 + p.forca) * (0.4 + 0.6 * vida);
    ctx.globalAlpha = p.forca * vida;
    ctx.drawImage(sprites[p.cor], hx - s / 2, hy - s / 2, s, s);
    ctx.globalAlpha = 1;
  }

  let ultimoTempo = performance.now();
  let quadroPendente = false;

  function quadro(agora) {
    quadroPendente = false;
    const dt = Math.min((agora - ultimoTempo) / 1000, 0.05);
    ultimoTempo = agora;

    // velocidade global: base + impulso da rolagem (decai suavemente)
    impulso *= Math.pow(0.12, dt);
    velocidadeGlobal = 1 + impulso;

    // campo do mouse: suaviza posição e intensidade
    const seguir = 1 - Math.pow(0.0005, dt);
    mouse.sx += (mouse.x - mouse.sx) * seguir;
    mouse.sy += (mouse.y - mouse.sy) * seguir;
    const parado = agora - ultimoMovimento > 1600;
    const alvoForca = mouse.ativo ? (parado ? 0.55 : 1) : 0;
    mouse.forca += (alvoForca - mouse.forca) * (1 - Math.pow(0.02, dt));

    // ondas agendadas
    if (ondas.length) {
      ondas = ondas.filter((o) => {
        if (o.em > agora) return true;
        if (o.no) o.no.brilho = Math.max(o.no.brilho, o.forca);
        if (o.aresta) o.aresta.brilho = Math.max(o.aresta.brilho, o.forca * 0.9);
        return false;
      });
    }

    // nós próximos ao cursor pulsam levemente
    if (mouse.ativo && mouse.forca > 0.05) {
      nosNoRaio(mouse.sx, mouse.sy, RAIO_CAMPO * 0.7).forEach(([n, d]) => {
        const proximidade = 1 - Math.sqrt(d) / (RAIO_CAMPO * 0.7);
        const pulsar = 0.35 + 0.25 * Math.sin(agora / 260 + n.id);
        n.brilho = Math.max(n.brilho, proximidade * pulsar * mouse.forca);
      });
    }

    // decaimento dos brilhos
    const decai = Math.pow(0.045, dt);
    nos.forEach((n) => { if (n.brilho > 0) n.brilho *= decai; });
    arestas.forEach((e) => { if (e.brilho > 0) e.brilho *= decai; });

    // pulsos contínuos
    if (pulsos.length < limitePulsos() && Math.random() < dt * 11) emitir(escolher(entradas));
    pulsos = pulsos.filter((p) => atualizarPulso(p, dt));

    // desenho
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(camadaBase, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    desenharCampoMouse();
    ctx.globalCompositeOperation = tema.modo;
    desenharArestasAcesas();
    desenharNosAcesos();
    pulsos.forEach(desenharPulso);
    ctx.globalCompositeOperation = "source-over";

    if (!reduzMovimento && !document.hidden) pedirQuadro();
  }

  function pedirQuadro() {
    if (quadroPendente) return;
    quadroPendente = true;
    requestAnimationFrame(reduzMovimento ? quadroEstatico : quadro);
  }

  // Movimento reduzido: placa estática; só o campo do mouse reage (sem loop contínuo)
  function quadroEstatico() {
    quadroPendente = false;
    mouse.sx = mouse.x;
    mouse.sy = mouse.y;
    mouse.forca = mouse.ativo ? 0.8 : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(camadaBase, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    desenharCampoMouse();
  }

  /* -------------------------------------------------------------------
     INICIALIZAÇÃO E CICLO DE VIDA
     ------------------------------------------------------------------- */
  lerTema();
  dimensionar();

  // Pulsos iniciais (a placa já "liga" com energia)
  if (!reduzMovimento) {
    for (let i = 0; i < Math.ceil(limitePulsos() * 0.6); i++) emitir(escolher(entradas));
  }
  pedirQuadro();

  // Troca de tema → redesenha as camadas com as novas cores
  new MutationObserver(() => {
    lerTema();
    redesenharCamadas();
    pedirQuadro();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // Redimensionamento (ignora variação pequena de altura da barra do celular)
  let timerResize = null;
  let larguraAnterior = W;
  let alturaAnterior = H;
  window.addEventListener("resize", () => {
    clearTimeout(timerResize);
    timerResize = setTimeout(() => {
      const mudouLargura = window.innerWidth !== larguraAnterior;
      const mudouAltura = Math.abs(window.innerHeight - alturaAnterior) > 140;
      if (!mudouLargura && !mudouAltura) return;
      larguraAnterior = window.innerWidth;
      alturaAnterior = window.innerHeight;
      dimensionar();
      pedirQuadro();
    }, 180);
  });

  // Retoma ao voltar para a aba
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      ultimoTempo = performance.now();
      pedirQuadro();
    }
  });
})();
