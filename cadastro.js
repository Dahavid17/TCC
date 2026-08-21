document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formCadastro");
  const temaBtn = document.getElementById("temaBtn");
  const tipoConta = document.getElementById("tipoConta");
  const campos = {
    nome: document.getElementById("nome"),
    email: document.getElementById("email"),
    telefone: document.getElementById("telefone"),
    endereco: document.getElementById("endereco"),
    senha: document.getElementById("senha"),
    confirmarSenha: document.getElementById("confirmarSenha")
  };
  const mensagens = {
    nome: document.getElementById("mensagemNome"),
    email: document.getElementById("mensagemEmail"),
    telefone: document.getElementById("mensagemTelefone"),
    endereco: document.getElementById("mensagemEndereco"),
    senha: document.getElementById("mensagemSenha"),
    confirmarSenha: document.getElementById("mensagemConfirmar"),
    geral: document.getElementById("mensagemCadastrar")
  };
  const cadastrar = document.getElementById("cadastrar");
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const telefoneValido = /^\(\d{2}\) \d{4,5}-\d{4}$/;

  function setMsg(elemento, texto, tipo = "erro") {
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.className = texto ? (tipo === "ok" ? "msg-sucesso" : tipo === "aviso" ? "msg-aviso" : "msg-erro") : "";
  }

  const temaSalvo = localStorage.getItem("marketplace:tema");
  if (temaSalvo === "dark") {
    document.body.classList.add("dark");
    temaBtn?.querySelector("i")?.classList.replace("bi-moon-stars-fill", "bi-sun-fill");
  }
  temaBtn?.addEventListener("click", () => {
    const dark = document.body.classList.toggle("dark");
    temaBtn.querySelector("i").className = dark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
    localStorage.setItem("marketplace:tema", dark ? "dark" : "light");
  });

  document.querySelectorAll(".tipo-btn").forEach((botao) => {
    botao.addEventListener("click", () => {
      document.querySelectorAll(".tipo-btn").forEach((item) => item.classList.remove("ativo"));
      botao.classList.add("ativo");
      tipoConta.value = botao.textContent.trim();
    });
  });

  function validarCampo(nome) {
    const valor = campos[nome].value.trim();
    let erro = "";
    if (!valor) erro = "Campo obrigatório.";
    else if (nome === "email" && !emailValido.test(valor)) erro = "E-mail inválido. Ex.: nome@email.com";
    else if (nome === "telefone" && !telefoneValido.test(valor)) erro = "Telefone inválido. Ex.: (11) 99999-0000";
    else if (nome === "senha" && campos.senha.value.length < 6) erro = "A senha precisa ter pelo menos 6 caracteres.";
    else if (nome === "confirmarSenha" && campos.confirmarSenha.value !== campos.senha.value) erro = "As senhas não são iguais.";
    setMsg(mensagens[nome], erro, "erro");
    return !erro;
  }

  campos.telefone.addEventListener("input", () => {
    let numeros = campos.telefone.value.replace(/\D/g, "").slice(0, 11);
    if (numeros.length > 10) numeros = numeros.replace(/^(\d{2})(\d{5})(\d{0,4})$/, "($1) $2-$3");
    else numeros = numeros.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    campos.telefone.value = numeros.replace(/-$/, "");
  });
  Object.keys(campos).forEach((nome) => campos[nome].addEventListener("blur", () => validarCampo(nome)));
  campos.senha.addEventListener("input", () => {
    if (campos.senha.value && campos.senha.value.length >= 6) setMsg(mensagens.senha, "Senha válida", "ok");
    if (campos.confirmarSenha.value) validarCampo("confirmarSenha");
  });

  function alternarSenha(inputId, botaoId) {
    const input = document.getElementById(inputId);
    const botao = document.getElementById(botaoId);
    botao?.addEventListener("click", () => {
      const mostrar = input.type === "password";
      input.type = mostrar ? "text" : "password";
      botao.querySelector("i").className = mostrar ? "bi bi-eye-slash" : "bi bi-eye";
    });
  }
  alternarSenha("senha", "botaoSenha");
  alternarSenha("confirmarSenha", "botaoConfirmar");

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const valido = Object.keys(campos).every(validarCampo);
    if (!valido) {
      setMsg(mensagens.geral, "Preencha todos os campos corretamente.");
      return;
    }
    const dados = new FormData(form);
    dados.set("tipo", tipoConta.value.toLowerCase());
    cadastrar.disabled = true;
    cadastrar.textContent = "Cadastrando...";
    setMsg(mensagens.geral, "");
    try {
      const resposta = await fetch(form.action, { method: "POST", body: dados, headers: { Accept: "application/json" } });
      const resultado = await resposta.json();
      if (!resposta.ok || !resultado.sucesso) throw new Error(resultado.mensagem || "Não foi possível concluir o cadastro.");
      setMsg(mensagens.geral, "Cadastro realizado com sucesso! Redirecionando...", "ok");
      window.setTimeout(() => { window.location.href = "inicio.html"; }, 700);
    } catch (erro) {
      setMsg(mensagens.geral, erro.message || "Erro de comunicação com o servidor.");
      cadastrar.disabled = false;
      cadastrar.textContent = "Cadastrar";
    }
  });
});
