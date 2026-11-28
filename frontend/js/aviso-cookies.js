/* =============================================================
   AVISO-COOKIES.JS — Aviso de cookies e consentimento (LGPD)

   - Cookies essenciais (sessão de login) e preferências (tema) sempre funcionam.
   - Tudo que for OPCIONAL (estatísticas/analytics, vídeos e mapas de terceiros)
     só é carregado depois que a pessoa clicar em "Aceitar opcionais".
   - A escolha fica salva em localStorage ("buzz:consentimento") por 12 meses
     e pode ser mudada a qualquer momento por qualquer botão/link com
     o atributo data-abrir-cookies (ex.: "Preferências de cookies" no rodapé).

   Para incluir um conteúdo de terceiro que dependa de consentimento:
     <iframe data-consentimento-src="https://..." title="..."></iframe>
     <script type="text/plain" data-consentimento-src="https://.../analytics.js"></script>
   Para ler a escolha via código: BuzzConsentimento.opcionaisPermitidos()
   ============================================================= */
(function () {
  "use strict";

  var CHAVE = "buzz:consentimento";
  var VERSAO = 1;
  var VALIDADE_MS = 365 * 24 * 60 * 60 * 1000;

  // Caminho da Política de Cookies relativo a este script (funciona na raiz e em frontend/pages)
  var scriptAtual = document.currentScript;
  var urlPolitica = scriptAtual
    ? new URL("../pages/cookies.html", scriptAtual.src).href
    : "/frontend/pages/cookies.html";

  function lerEscolha() {
    try {
      var salvo = JSON.parse(localStorage.getItem(CHAVE) || "null");
      if (!salvo || salvo.versao !== VERSAO) return null;
      if (Date.now() - salvo.data > VALIDADE_MS) return null;
      return salvo;
    } catch (e) {
      return null;
    }
  }

  function salvarEscolha(opcionais) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ versao: VERSAO, opcionais: !!opcionais, data: Date.now() }));
    } catch (e) { /* navegação privada: a escolha vale só nesta página */ }
  }

  function opcionaisPermitidos() {
    var escolha = lerEscolha();
    return !!(escolha && escolha.opcionais);
  }

  // Ativa conteúdos de terceiros que estavam esperando consentimento
  function ativarOpcionais() {
    if (!opcionaisPermitidos()) return;
    document.querySelectorAll("[data-consentimento-src]").forEach(function (el) {
      var src = el.getAttribute("data-consentimento-src");
      if (el.tagName === "SCRIPT") {
        var novo = document.createElement("script");
        novo.src = src;
        novo.async = true;
        el.parentNode.replaceChild(novo, el);
      } else {
        el.setAttribute("src", src);
        el.removeAttribute("data-consentimento-src");
      }
    });
    document.dispatchEvent(new CustomEvent("buzz:consentimento", { detail: { opcionais: true } }));
  }

  function injetarEstilo() {
    if (document.getElementById("aviso-cookies-estilo")) return;
    var css =
      ".aviso-cookies{position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:9999;max-width:640px;margin:0 auto;" +
      "background:#ffffff;color:#202820;border:2px solid #31572c;padding:1.25rem 1.25rem 1rem;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.25);font-family:Inter,Arial,sans-serif;font-size:1rem;line-height:1.55}" +
      ".aviso-cookies h2{font-size:1.1rem;margin:0 0 .4rem;color:#1f3a1d}" +
      ".aviso-cookies p{margin:0 0 1rem}" +
      ".aviso-cookies a{color:#31572c;font-weight:600;text-underline-offset:3px}" +
      ".aviso-cookies-botoes{display:flex;flex-wrap:wrap;gap:.6rem}" +
      ".aviso-cookies button{font:inherit;font-weight:600;cursor:pointer;border-radius:999px;padding:.7rem 1.3rem;border:2px solid #31572c}" +
      ".aviso-cookies .ac-aceitar{background:#31572c;color:#fff}" +
      ".aviso-cookies .ac-aceitar:hover{background:#1f3a1d;border-color:#1f3a1d}" +
      ".aviso-cookies .ac-essenciais{background:#fff;color:#1f3a1d}" +
      ".aviso-cookies .ac-essenciais:hover{background:#e7eddc}" +
      ".aviso-cookies button:focus-visible,.aviso-cookies a:focus-visible{outline:3px solid #d68910;outline-offset:3px}" +
      "html.tema-escuro .aviso-cookies,body.dark .aviso-cookies{background:#121712;color:#e8ece6;border-color:#90a955}" +
      "html.tema-escuro .aviso-cookies h2,body.dark .aviso-cookies h2{color:#cfe3b5}" +
      "html.tema-escuro .aviso-cookies a,body.dark .aviso-cookies a{color:#b9d98a}" +
      "html.tema-escuro .aviso-cookies .ac-essenciais,body.dark .aviso-cookies .ac-essenciais{background:transparent;color:#e8ece6;border-color:#90a955}" +
      "@media (max-width:480px){.aviso-cookies{left:.5rem;right:.5rem;bottom:.5rem;padding:.9rem;font-size:.9rem;line-height:1.45}" +
      ".aviso-cookies p{margin-bottom:.75rem}.aviso-cookies-botoes button{flex:1 1 100%;padding:.6rem 1rem}}" +
      "@media print{.aviso-cookies{display:none}}";
    var estilo = document.createElement("style");
    estilo.id = "aviso-cookies-estilo";
    estilo.textContent = css;
    document.head.appendChild(estilo);
  }

  var focoAnterior = null;

  function fecharAviso() {
    var aviso = document.getElementById("aviso-cookies");
    if (aviso) aviso.remove();
    if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
    focoAnterior = null;
  }

  function mostrarAviso(daUmBotao) {
    if (document.getElementById("aviso-cookies")) return;
    injetarEstilo();
    if (daUmBotao) focoAnterior = document.activeElement;

    var aviso = document.createElement("section");
    aviso.id = "aviso-cookies";
    aviso.className = "aviso-cookies";
    aviso.setAttribute("role", "region");
    aviso.setAttribute("aria-labelledby", "aviso-cookies-titulo");
    aviso.innerHTML =
      '<h2 id="aviso-cookies-titulo">Cookies neste site</h2>' +
      "<p>Usamos apenas o necessário para o site funcionar (manter você conectado e lembrar o tema claro/escuro). " +
      "Estatísticas de uso e conteúdos de outras empresas só são ativados se você aceitar. " +
      '<a href="' + urlPolitica + '">Ler a Política de Cookies</a></p>' +
      '<div class="aviso-cookies-botoes">' +
      '<button type="button" class="ac-aceitar">Aceitar opcionais</button>' +
      '<button type="button" class="ac-essenciais">Usar só os essenciais</button>' +
      "</div>";

    aviso.querySelector(".ac-aceitar").addEventListener("click", function () {
      salvarEscolha(true);
      fecharAviso();
      ativarOpcionais();
    });
    aviso.querySelector(".ac-essenciais").addEventListener("click", function () {
      salvarEscolha(false);
      fecharAviso();
    });
    aviso.addEventListener("keydown", function (e) {
      // Esc fecha sem decidir; o aviso volta na próxima página
      if (e.key === "Escape") fecharAviso();
    });

    document.body.appendChild(aviso);
    if (daUmBotao) aviso.querySelector(".ac-aceitar").focus();
  }

  function iniciar() {
    document.addEventListener("click", function (e) {
      var alvo = e.target.closest && e.target.closest("[data-abrir-cookies]");
      if (!alvo) return;
      e.preventDefault();
      mostrarAviso(true);
    });

    if (lerEscolha()) ativarOpcionais();
    else mostrarAviso(false);
  }

  window.BuzzConsentimento = {
    opcionaisPermitidos: opcionaisPermitidos,
    abrirPreferencias: function () { mostrarAviso(true); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
