/* =============================================================
   LOGIN-VISUAL.JS — Microinterações da página de login
   Apenas apresentação. Não envia dados, não valida e não muda
   nada do que o login.js faz: só observa o estado que ele
   produz (mensagens, botão, perfil) e o reflete visualmente.
   Deve ser carregado DEPOIS do login.js.
   ============================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formLogin");
  if (!form) return;
  const botao = form.querySelector(".btn-login");

  /* ── Perfil: estado acessível e painel lateral ─────────── */
  const botoesPerfil = [...document.querySelectorAll(".perfil-btn")];
  const listas = [...document.querySelectorAll(".visual-lista[data-perfil]")];

  function mostrarPerfil(perfil) {
    listas.forEach((lista) => {
      const ativa = lista.dataset.perfil === perfil;
      if (ativa && lista.hidden) {
        lista.hidden = false;
        lista.classList.remove("trocando");
        void lista.offsetWidth; // reinicia a animação
        lista.classList.add("trocando");
      } else if (!ativa) {
        lista.hidden = true;
      }
    });
  }

  botoesPerfil.forEach((item) => {
    // Roda depois do ouvinte do login.js, que já moveu a classe "ativo"
    item.addEventListener("click", () => {
      botoesPerfil.forEach((b) => b.setAttribute("aria-pressed", String(b.classList.contains("ativo"))));
      mostrarPerfil(item.textContent.trim());
    });
  });

  /* ── Estado de erro dos campos ─────────────────────────── */
  const pares = [
    ["email", "msg-email"],
    ["senha", "msg-senha"]
  ].map(([campoId, msgId]) => {
    const campo = document.getElementById(campoId);
    const msg = document.getElementById(msgId);
    return campo && msg ? { grupo: campo.closest(".form-group"), msg } : null;
  }).filter(Boolean);

  pares.forEach(({ grupo, msg }) => {
    new MutationObserver(() => {
      const erro = msg.classList.contains("msg-erro");
      const anterior = grupo.dataset.estado === "erro";
      grupo.dataset.estado = erro ? "erro" : "";
      if (erro && !anterior) {
        grupo.classList.remove("tremer");
        void grupo.offsetWidth;
        grupo.classList.add("tremer");
      }
    }).observe(msg, { attributes: true, attributeFilter: ["class"], childList: true });
  });

  /* ── Autenticação em andamento (botão controlado pelo login.js) ── */
  if (botao) {
    new MutationObserver(() => {
      const enviando = botao.disabled;
      form.classList.toggle("enviando", enviando);
      form.setAttribute("aria-busy", String(enviando));
    }).observe(botao, { attributes: true, attributeFilter: ["disabled"] });
  }
});
