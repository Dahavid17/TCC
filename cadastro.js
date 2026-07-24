/* =============================================================
   CADASTRO.JS
   Corrigido/Refatorado:
   - Validação via classes CSS (msg-erro / msg-sucesso / msg-aviso)
   - forcaSenha resetada ao limpar campo
   - Máscara de telefone suporta fixo E celular
   - Persistência real via localStorage
   - Redirecionamento para login após cadastro
   - onclick inline substituído por addEventListener
   - Tema persistente via localStorage
   - Validação em blur (além do submit)
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

  /* ── HELPER: exibir mensagem com classe semântica ──────── */
  function setMsg(el, texto, tipo) {
    if (!el) return;
    el.textContent = texto;
    // Usa classes do tokens.css — sem style inline
    el.className = tipo === "ok"    ? "msg-sucesso"
                 : tipo === "aviso" ? "msg-aviso"
                 :                   "msg-erro";
  }

  /* ── SELEÇÃO DE TIPO DE CONTA ──────────────────────────── */
  // CORRIGIDO: era onclick inline → addEventListener
  const tipoConta = document.getElementById("tipoConta");

  document.querySelectorAll(".tipo-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tipo-btn")
        .forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      tipoConta.value = btn.innerText.trim();
    });
  });

  /* ── CAMPOS ────────────────────────────────────────────── */
  const nome           = document.getElementById("nome");
  const email          = document.getElementById("email");
  const telefone       = document.getElementById("telefone");
  const endereco       = document.getElementById("endereco");
  const senha          = document.getElementById("senha");
  const confirmarSenha = document.getElementById("confirmarSenha");
  const cadastrar      = document.getElementById("cadastrar");

  const mensagemNome      = document.getElementById("mensagemNome");
  const mensagemEmail     = document.getElementById("mensagemEmail");
  const mensagemTelefone  = document.getElementById("mensagemTelefone");
  const mensagemEndereco  = document.getElementById("mensagemEndereco");
  const mensagemSenha     = document.getElementById("mensagemSenha");
  const mensagemConfirmar = document.getElementById("mensagemConfirmar");
  const mensagemCadastrar = document.getElementById("mensagemCadastrar");

  const mascaraEmail    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mascaraTelefone = /^\(\d{2}\) \d{4,5}-\d{4}$/;

  let forcaSenha = "";

  /* ── FORÇA DE SENHA ────────────────────────────────────── */
  // CORRIGIDO: resetar forcaSenha quando campo fica vazio
  senha.addEventListener("keyup", () => {
    if (!senha.value) {
      forcaSenha = "";
      setMsg(mensagemSenha, "", "ok");
      return;
    }

    if (senha.value.length < 6) {
      setMsg(mensagemSenha, "Senha fraca (mínimo 6 caracteres)", "erro");
      forcaSenha = "fraca";
    } else if (senha.value.length < 10) {
      setMsg(mensagemSenha, "Senha aceitável", "aviso");
      forcaSenha = "media";
    } else {
      setMsg(mensagemSenha, "Senha forte", "ok");
      forcaSenha = "forte";
    }
  });

  /* ── CONFIRMAR SENHA ───────────────────────────────────── */
  confirmarSenha.addEventListener("keyup", () => {
    if (!confirmarSenha.value) {
      setMsg(mensagemConfirmar, "", "ok");
      return;
    }
    const iguais = confirmarSenha.value === senha.value;
    setMsg(mensagemConfirmar, iguais ? "Senhas iguais" : "As senhas não são iguais", iguais ? "ok" : "erro");
  });

  /* ── TOGGLE SENHAS ─────────────────────────────────────── */
  function toggleSenha(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn   = document.getElementById(btnId);
    if (!input || !btn) return;

    btn.addEventListener("click", () => {
      const visivel = input.type === "text";
      input.type = visivel ? "password" : "text";
      btn.querySelector("i").className =
        visivel ? "bi bi-eye" : "bi bi-eye-slash";
    });
  }

  toggleSenha("senha", "botaoSenha");
  toggleSenha("confirmarSenha", "botaoConfirmar");

  /* ── MÁSCARA DE TELEFONE ───────────────────────────────── */
  // CORRIGIDO: suporta fixo (8 dígitos) E celular (9 dígitos)
  telefone.addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "").slice(0, 11);

    if (v.length <= 10) {
      // Telefone fixo: (XX) XXXX-XXXX
      v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, (_, ddd, p1, p2) =>
        p2 ? `(${ddd}) ${p1}-${p2}` : ddd ? `(${ddd}) ${p1}` : ddd
      );
    } else {
      // Celular: (XX) XXXXX-XXXX
      v = v.replace(/^(\d{2})(\d{5})(\d{0,4})/, (_, ddd, p1, p2) =>
        p2 ? `(${ddd}) ${p1}-${p2}` : `(${ddd}) ${p1}`
      );
    }

    this.value = v;
  });

  /* ── VALIDAÇÃO EM BLUR ─────────────────────────────────── */
  nome.addEventListener("blur", () => {
    if (!nome.value.trim()) setMsg(mensagemNome, "Campo obrigatório.", "erro");
    else setMsg(mensagemNome, "Nome válido", "ok");
  });

  email.addEventListener("blur", () => {
    if (!email.value.trim()) setMsg(mensagemEmail, "Campo obrigatório.", "erro");
    else if (!mascaraEmail.test(email.value)) setMsg(mensagemEmail, "E-mail inválido. Ex: texto@email.com", "erro");
    else setMsg(mensagemEmail, "E-mail válido", "ok");
  });

  telefone.addEventListener("blur", () => {
    if (!telefone.value.trim()) setMsg(mensagemTelefone, "Campo obrigatório.", "erro");
    else if (!mascaraTelefone.test(telefone.value)) setMsg(mensagemTelefone, "Telefone inválido. Ex: (11) 99999-0000", "erro");
    else setMsg(mensagemTelefone, "Telefone válido", "ok");
  });

  endereco.addEventListener("blur", () => {
    if (!endereco.value.trim()) setMsg(mensagemEndereco, "Campo obrigatório.", "erro");
    else setMsg(mensagemEndereco, "Endereço válido", "ok");
  });

  /* ── SUBMIT ────────────────────────────────────────────── */
  cadastrar.addEventListener("click", () => {
    let valido = true;

    // Nome
    if (!nome.value.trim()) {
      setMsg(mensagemNome, "O campo nome é obrigatório.", "erro");
      valido = false;
    } else {
      setMsg(mensagemNome, "Nome válido", "ok");
    }

    // Email
    if (!email.value.trim()) {
      setMsg(mensagemEmail, "O campo e-mail é obrigatório.", "erro");
      valido = false;
    } else if (!mascaraEmail.test(email.value)) {
      setMsg(mensagemEmail, "E-mail inválido. Ex: texto@email.com", "erro");
      valido = false;
    } else {
      setMsg(mensagemEmail, "E-mail válido", "ok");
    }

    // Telefone
    if (!telefone.value.trim()) {
      setMsg(mensagemTelefone, "O campo telefone é obrigatório.", "erro");
      valido = false;
    } else if (!mascaraTelefone.test(telefone.value)) {
      setMsg(mensagemTelefone, "Telefone inválido. Ex: (11) 99999-0000", "erro");
      valido = false;
    } else {
      setMsg(mensagemTelefone, "Telefone válido", "ok");
    }

    // Endereço
    if (!endereco.value.trim()) {
      setMsg(mensagemEndereco, "O campo endereço é obrigatório.", "erro");
      valido = false;
    } else {
      setMsg(mensagemEndereco, "Endereço válido", "ok");
    }

    // Senha
    if (!senha.value) {
      setMsg(mensagemSenha, "Preencha a senha.", "erro");
      valido = false;
    } else if (forcaSenha === "fraca") {
      setMsg(mensagemSenha, "A senha precisa ter pelo menos 6 caracteres.", "erro");
      valido = false;
    }

    // Confirmar senha
    if (!confirmarSenha.value.trim()) {
      setMsg(mensagemConfirmar, "Confirme sua senha.", "erro");
      valido = false;
    } else if (confirmarSenha.value !== senha.value) {
      setMsg(mensagemConfirmar, "As senhas não são iguais.", "erro");
      valido = false;
    } else {
      setMsg(mensagemConfirmar, "Senhas iguais", "ok");
    }

    if (!valido) {
      setMsg(mensagemCadastrar, "Preencha todos os campos corretamente.", "erro");
      return;
    }

    /* ── VERIFICAR E-MAIL DUPLICADO ────────────────────── */
    const usuarios = JSON.parse(localStorage.getItem("marketplace:usuarios") || "[]");
    const jaExiste = usuarios.some(u => u.email === email.value.trim());

    if (jaExiste) {
      setMsg(mensagemCadastrar, "Este e-mail já está cadastrado. Faça login.", "erro");
      return;
    }

    /* ── FEEDBACK DE LOADING ───────────────────────────── */
    cadastrar.textContent = "Cadastrando...";
    cadastrar.disabled    = true;

    setTimeout(() => {
      /* ── PERSISTIR USUÁRIO ───────────────────────────── */
      usuarios.push({
        nome:     nome.value.trim(),
        email:    email.value.trim(),
        senha:    senha.value,
        telefone: telefone.value,
        endereco: endereco.value.trim(),
        tipo:     tipoConta.value
      });

      localStorage.setItem("marketplace:usuarios", JSON.stringify(usuarios));

      setMsg(
        mensagemCadastrar,
        `Cadastro realizado como ${tipoConta.value}! Bem-vindo(a), ${nome.value.trim()}! Redirecionando...`,
        "ok"
      );

      // Limpar campos
      [nome, email, senha, confirmarSenha, telefone, endereco].forEach(c => c.value = "");
      [mensagemNome, mensagemEmail, mensagemSenha, mensagemConfirmar,
       mensagemTelefone, mensagemEndereco].forEach(m => { m.textContent = ""; m.className = ""; });
      forcaSenha = "";

      // Redireciona para login
      setTimeout(() => window.location.href = "login-marketplace.html", 1800);

    }, 800);
  });

});