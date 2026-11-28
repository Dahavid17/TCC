/* =============================================================
   TEMA-TRANSICAO.JS — Revelação circular ao alternar o tema
   Compartilhado por todas as páginas (Buzz Codex e
   MarketPlace Rural).

   Não troca o tema por conta própria: cada página continua com
   o seu handler original em #temaBtn (classes, ícones e chave
   no localStorage intactos). Este script apenas:
     1. intercepta o clique em #temaBtn na fase de captura;
     2. abre uma View Transition e, dentro dela, repassa o clique
        ao handler original da página;
     3. revela o novo tema com um círculo que se expande a partir
        do botão (clip-path: circle()).
   Sem View Transitions API: uma onda com a cor de fundo do novo
   tema se expande a partir do botão e o tema é aplicado ao fim.
   Com prefers-reduced-motion: a troca é imediata, como antes.
   ============================================================= */

(() => {
  const DURACAO = 700;
  const EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
  const raiz = document.documentElement;
  const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");

  let repassando = false; // true enquanto o clique é repassado ao handler original
  let ocupado = false;    // evita cliques sobrepostos durante a animação

  /* ── Estilos auxiliares (não alteram o visual dos temas) ── */
  const estilo = document.createElement("style");
  estilo.id = "tema-transicao-estilos";
  estilo.textContent = `
    /* Durante a troca, as transições de cor da página ficam
       desligadas para o novo tema aparecer já pronto. */
    html.tema-trocando *,
    html.tema-trocando *::before,
    html.tema-trocando *::after {
      transition: none !important;
    }

    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }

    ::view-transition-old(root) { z-index: 1; }
    ::view-transition-new(root) { z-index: 2; }

    /* Microanimação do ícone (sol/lua) após a troca */
    #temaBtn.tema-icone-troca:not(.girando) i {
      display: inline-block;
      animation: tema-icone-entrar .55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    @keyframes tema-icone-entrar {
      from { opacity: 0; transform: rotate(-120deg) scale(.4); }
      60%  { opacity: 1; }
      to   { opacity: 1; transform: rotate(0deg) scale(1); }
    }

    .tema-onda {
      position: fixed;
      z-index: 2147483646;
      border-radius: 50%;
      pointer-events: none;
      transform: translate(-50%, -50%) scale(0);
      will-change: transform, opacity;
    }

    @media (prefers-reduced-motion: reduce) {
      #temaBtn.tema-icone-troca i { animation: none !important; }
    }
  `;
  (document.head || raiz).appendChild(estilo);

  /* ── Utilidades ────────────────────────────────────────── */
  function origemDo(botao) {
    const r = botao.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const raio = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    return { x, y, raio };
  }

  // Executa o handler original da página (troca real do tema)
  function repassarClique(botao) {
    repassando = true;
    try {
      // dispatchEvent (e não click()): click() é ignorado quando já
      // existe um click() em andamento no mesmo elemento.
      botao.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    } finally {
      repassando = false;
    }
  }

  function animarIcone(botao) {
    botao.classList.remove("tema-icone-troca");
    void botao.offsetWidth;
    botao.classList.add("tema-icone-troca");
    window.setTimeout(() => botao.classList.remove("tema-icone-troca"), 600);
  }

  function feedbackClique(botao) {
    if (typeof botao.animate !== "function") return;
    try {
      // Usa a propriedade "scale" para não interferir em transforms já usados pelo botão
      botao.animate(
        [{ scale: "1" }, { scale: "0.86" }, { scale: "1" }],
        { duration: 320, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
      );
    } catch (e) { /* navegador sem suporte: segue sem o efeito */ }
  }

  // Cor de fundo efetiva da página no momento
  function corDeFundo() {
    const transparente = (c) => !c || c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);
    const corBody = document.body ? getComputedStyle(document.body).backgroundColor : "";
    if (!transparente(corBody)) return corBody;
    const corHtml = getComputedStyle(raiz).backgroundColor;
    return transparente(corHtml) ? "#808080" : corHtml;
  }

  /* ── Com View Transitions API ──────────────────────────── */
  function trocarComViewTransition(botao) {
    const { x, y, raio } = origemDo(botao);
    raiz.classList.add("tema-trocando");

    const transicao = document.startViewTransition(() => {
      repassarClique(botao);
      animarIcone(botao);
    });

    transicao.ready
      .then(() => {
        raiz.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${raio}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: DURACAO,
            easing: EASING,
            pseudoElement: "::view-transition-new(root)"
          }
        );
      })
      .catch(() => { /* transição pulada: o tema já foi trocado */ });

    transicao.finished.finally(() => {
      raiz.classList.remove("tema-trocando");
      ocupado = false;
    });
  }

  /* ── Sem View Transitions API: onda com a cor do novo tema ── */
  function trocarComOnda(botao) {
    const { x, y, raio } = origemDo(botao);

    // Descobre a cor do novo tema trocando e destrocando no mesmo
    // quadro (sem pintura intermediária, portanto sem "piscar").
    raiz.classList.add("tema-trocando");
    repassarClique(botao);
    const corNova = corDeFundo();
    repassarClique(botao);
    // Recalcula os estilos ainda sem transições; senão o fundo
    // animaria da cor medida de volta para a atual.
    void getComputedStyle(document.body).backgroundColor;
    raiz.classList.remove("tema-trocando");

    const onda = document.createElement("div");
    onda.className = "tema-onda";
    onda.setAttribute("aria-hidden", "true");
    Object.assign(onda.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${raio * 2}px`,
      height: `${raio * 2}px`,
      background: corNova
    });
    document.body.appendChild(onda);

    const expandir = onda.animate(
      [
        { transform: "translate(-50%, -50%) scale(0)" },
        { transform: "translate(-50%, -50%) scale(1)" }
      ],
      { duration: DURACAO, easing: EASING, fill: "forwards" }
    );

    expandir.finished
      .then(() => {
        raiz.classList.add("tema-trocando");
        repassarClique(botao);
        animarIcone(botao);
        void document.body.offsetWidth;
        raiz.classList.remove("tema-trocando");
        return onda.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: "ease-out", fill: "forwards" }).finished;
      })
      .catch(() => { /* animação cancelada */ })
      .finally(() => {
        onda.remove();
        ocupado = false;
      });
  }

  /* ── Interceptação do clique ───────────────────────────── */
  document.addEventListener("click", (evento) => {
    if (repassando) return;

    const botao = evento.target instanceof Element ? evento.target.closest("#temaBtn") : null;
    if (!botao) return;

    // Sem animação: deixa o handler original agir normalmente
    if (movimentoReduzido.matches) return;

    evento.stopImmediatePropagation();
    evento.preventDefault();
    if (ocupado) return;
    ocupado = true;

    feedbackClique(botao);

    try {
      if (typeof document.startViewTransition === "function") {
        trocarComViewTransition(botao);
      } else if (typeof Element.prototype.animate === "function") {
        trocarComOnda(botao);
      } else {
        repassarClique(botao);
        ocupado = false;
      }
    } catch (erro) {
      // Qualquer falha: garante que o tema ainda seja trocado
      raiz.classList.remove("tema-trocando");
      ocupado = false;
      repassarClique(botao);
    }
  }, true);
})();
