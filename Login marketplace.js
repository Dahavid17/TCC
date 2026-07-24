/* =============================================================
   LOGIN-MARKETPLACE.JS
   NOVO ARQUIVO — antes não existia; a página carregava
   marketplace.js que não tinha a lógica de login.

   Corrigido:
   - selecionarPerfil() agora definida aqui (era global inline)
   - showPass implementado (antes inerte)
   - Validação e prevenção de submit
   - Login com localStorage (persistência simulada)
   - Modo escuro persistente via localStorage
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

  /* ── SELEÇÃO DE PERFIL ─────────────────────────────────── */
  // CORRIGIDO: era onclick inline sem função definida na página
  document.querySelectorAll(".perfil-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".perfil-btn")
        .forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
    });
  });

  /* ── TOGGLE SENHA ──────────────────────────────────────── */
  // CORRIGIDO: antes era completamente inerte
  const showPass = document.getElementById("showPass");
  const senhaInput = document.getElementById("senha");

  showPass?.addEventListener("click", () => {
    const visivel = senhaInput.type === "text";
    senhaInput.type = visivel ? "password" : "text";
    showPass.querySelector("i").className =
      visivel ? "bi bi-eye" : "bi bi-eye-slash";
  });

  /* ── EXIBIR MENSAGEM ───────────────────────────────────── */
  function setMsg(el, texto, tipo) {
    if (!el) return;
    el.textContent = texto;
    el.className   = tipo === "ok" ? "msg-sucesso" : "msg-erro";
  }

  /* ── FORMULÁRIO DE LOGIN ───────────────────────────────── */
  // CORRIGIDO: antes recarregava a página sem validação
  const form  = document.querySelector("form");
  const email = document.getElementById("email");
  const senha = document.getElementById("senha");

  // Adiciona elementos de feedback dinamicamente se não existirem
  function getOrCreateMsg(inputId, parentEl) {
    let msg = document.getElementById("msg-" + inputId);
    if (!msg) {
      msg = document.createElement("p");
      msg.id = "msg-" + inputId;
      parentEl.after(msg);
    }
    return msg;
  }

  const emailGroup = email?.closest(".form-group");
  const senhaGroup = senha?.closest(".form-group");
  const msgEmail   = getOrCreateMsg("email", emailGroup?.querySelector(".input-box") || email);
  const msgSenha   = getOrCreateMsg("senha", senhaGroup?.querySelector(".input-box") || senha);

  // Mensagem geral de login
  let msgGeral = document.getElementById("msg-login");
  if (!msgGeral) {
    msgGeral = document.createElement("p");
    msgGeral.id = "msg-login";
    msgGeral.style.cssText = "text-align:center;margin-top:12px;font-weight:700;font-size:14px;";
    form?.querySelector(".btn-login")?.after(msgGeral);
  }

  const mascaraEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validação em blur
  email?.addEventListener("blur", () => {
    if (!email.value) {
      setMsg(msgEmail, "Campo obrigatório.", "erro");
    } else if (!mascaraEmail.test(email.value)) {
      setMsg(msgEmail, "E-mail inválido.", "erro");
    } else {
      setMsg(msgEmail, "", "ok");
    }
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault(); // CORRIGIDO: impede reload

    let valido = true;

    if (!email.value.trim()) {
      setMsg(msgEmail, "Informe seu e-mail.", "erro");
      valido = false;
    } else if (!mascaraEmail.test(email.value)) {
      setMsg(msgEmail, "E-mail inválido.", "erro");
      valido = false;
    } else {
      setMsg(msgEmail, "", "ok");
    }

    if (!senha.value.trim()) {
      setMsg(msgSenha, "Informe sua senha.", "erro");
      valido = false;
    } else {
      setMsg(msgSenha, "", "ok");
    }

    if (!valido) {
      setMsg(msgGeral, "Preencha os campos corretamente.", "erro");
      return;
    }

    /* ── LOGIN COM LOCALSTORAGE ──────────────────────────── */
    // Busca usuários cadastrados
    const usuarios = JSON.parse(localStorage.getItem("marketplace:usuarios") || "[]");
    const user = usuarios.find(
      u => u.email === email.value.trim() && u.senha === senha.value
    );

    // Feedback visual de carregamento
    const btnLogin = form.querySelector(".btn-login");
    const textoOriginal = btnLogin.textContent;
    btnLogin.textContent = "Verificando...";
    btnLogin.disabled = true;

    setTimeout(() => {
      if (user) {
        // Salva sessão
        sessionStorage.setItem("marketplace:usuario", JSON.stringify({
          nome:  user.nome,
          email: user.email,
          tipo:  user.tipo
        }));
        setMsg(msgGeral, `Bem-vindo(a), ${user.nome}! Redirecionando...`, "ok");
        setTimeout(() => window.location.href = "marketplace.html", 1200);
      } else if (usuarios.length === 0) {
        // Nenhum usuário cadastrado ainda — orienta criar conta
        setMsg(msgGeral, "Nenhuma conta encontrada. Crie uma conta primeiro.", "erro");
        btnLogin.textContent = textoOriginal;
        btnLogin.disabled = false;
      } else {
        setMsg(msgGeral, "E-mail ou senha incorretos.", "erro");
        btnLogin.textContent = textoOriginal;
        btnLogin.disabled = false;
      }
    }, 700);
  });

});