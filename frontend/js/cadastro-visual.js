/* =============================================================
   CADASTRO-VISUAL.JS — Microinterações da página de cadastro
   Apenas apresentação. Não envia dados, não valida e não altera
   nada do que o cadastro.js faz: ele só observa o estado que o
   cadastro.js produz (mensagens, botão, tipo de conta) e reflete
   isso visualmente. Deve ser carregado DEPOIS do cadastro.js,
   para que estes ouvintes rodem após os originais.
   ============================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formCadastro");
  const tipoConta = document.getElementById("tipoConta");
  const botaoEnviar = document.getElementById("cadastrar");
  const mensagemGeral = document.getElementById("mensagemCadastrar");
  if (!form) return;

  const ids = ["nome", "email", "telefone", "endereco", "senha", "confirmarSenha"];
  const mensagensIds = {
    nome: "mensagemNome",
    email: "mensagemEmail",
    telefone: "mensagemTelefone",
    endereco: "mensagemEndereco",
    senha: "mensagemSenha",
    confirmarSenha: "mensagemConfirmar"
  };

  const campos = ids
    .map((id) => {
      const input = document.getElementById(id);
      const mensagem = document.getElementById(mensagensIds[id]);
      if (!input || !mensagem) return null;
      return { id, input, mensagem, grupo: input.closest(".form-group"), tocado: false };
    })
    .filter(Boolean);

  /* ── Tipo de conta: estado acessível e painel lateral ──── */
  const botoesTipo = [...document.querySelectorAll(".tipo-btn")];
  const listasPerfil = [...document.querySelectorAll(".intro-lista[data-perfil]")];

  function mostrarPerfil(perfil) {
    listasPerfil.forEach((lista) => {
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

  botoesTipo.forEach((botao) => {
    // Roda depois do ouvinte do cadastro.js, que já atualizou
    // a classe "ativo" e o valor de #tipoConta.
    botao.addEventListener("click", () => {
      botoesTipo.forEach((b) => b.setAttribute("aria-pressed", String(b.classList.contains("ativo"))));
      if (tipoConta) mostrarPerfil(tipoConta.value);
    });
  });

  /* ── Estado visual de cada campo ───────────────────────── */
  const grupos = [...form.querySelectorAll(".grupo")];
  const contagem = document.getElementById("progressoContagem");
  const barra = document.querySelector(".progresso-barra");
  const requisitoTamanho = document.querySelector('[data-requisito="tamanho"]');
  const requisitoIguais = document.querySelector('[data-requisito="iguais"]');

  function estadoDe(campo) {
    if (campo.mensagem.classList.contains("msg-erro")) return "erro";
    if (campo.input.value.trim() && (campo.tocado || campo.mensagem.classList.contains("msg-sucesso"))) return "ok";
    return "";
  }

  function marcarRequisito(item, cumprido) {
    if (!item) return;
    item.classList.toggle("cumprido", cumprido);
    const icone = item.querySelector("i");
    if (icone) icone.className = cumprido ? "bi bi-check-circle-fill" : "bi bi-circle";
  }

  function atualizar() {
    let preenchidos = 0;

    campos.forEach((campo) => {
      const anterior = campo.grupo.dataset.estado || "";
      const estado = estadoDe(campo);
      campo.grupo.dataset.estado = estado;

      if (estado === "erro" && anterior !== "erro") {
        campo.grupo.classList.remove("tremer");
        void campo.grupo.offsetWidth;
        campo.grupo.classList.add("tremer");
      }

      if (campo.input.value.trim() && estado !== "erro") preenchidos++;
    });

    // Progresso
    const total = campos.length;
    if (contagem) contagem.textContent = `${preenchidos} de ${total} campos`;
    if (barra) {
      barra.setAttribute("aria-valuenow", String(preenchidos));
      barra.style.setProperty("--progresso", `${(preenchidos / total) * 100}%`);
    }

    // Requisitos de senha (mesmas regras do cadastro.js: 6+ caracteres e iguais)
    const senha = document.getElementById("senha")?.value || "";
    const confirmar = document.getElementById("confirmarSenha")?.value || "";
    marcarRequisito(requisitoTamanho, senha.length >= 6);
    marcarRequisito(requisitoIguais, confirmar.length > 0 && senha === confirmar);

    // Etapas concluídas
    grupos.forEach((grupo, indice) => {
      if (indice === 0) {
        grupo.classList.toggle("completo", botoesTipo.some((b) => b.classList.contains("ativo")));
        return;
      }
      const internos = campos.filter((c) => grupo.contains(c.input));
      const completo = internos.length > 0 && internos.every((c) => c.input.value.trim() && estadoDe(c) !== "erro");
      grupo.classList.toggle("completo", completo);
    });
  }

  campos.forEach((campo) => {
    campo.input.addEventListener("input", atualizar);
    campo.input.addEventListener("blur", () => {
      campo.tocado = true;
      atualizar();
    });

    // Reage quando o cadastro.js escreve ou limpa a mensagem do campo
    new MutationObserver(atualizar).observe(campo.mensagem, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      characterData: true,
      subtree: true
    });
  });

  /* ── Envio: reflete o estado do botão controlado pelo cadastro.js ── */
  if (botaoEnviar) {
    new MutationObserver(() => {
      const enviando = botaoEnviar.disabled;
      form.classList.toggle("enviando", enviando);
      form.setAttribute("aria-busy", String(enviando));
    }).observe(botaoEnviar, { attributes: true, attributeFilter: ["disabled"] });
  }

  // Após o submit, o cadastro.js valida tudo: marca os campos como tocados
  // e leva o foco ao primeiro campo com erro, se houver.
  form.addEventListener("submit", () => {
    campos.forEach((campo) => { campo.tocado = true; });
    atualizar();
    const primeiroErro = campos.find((c) => c.mensagem.classList.contains("msg-erro"));
    if (primeiroErro) primeiroErro.input.focus({ preventScroll: false });
  });

  if (mensagemGeral) {
    new MutationObserver(() => {
      if (mensagemGeral.textContent.trim() && window.innerWidth < 900) {
        mensagemGeral.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }).observe(mensagemGeral, { childList: true });
  }

  atualizar();
});
