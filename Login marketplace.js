document.addEventListener("DOMContentLoaded", () => {
  const temaBtn = document.getElementById("temaBtn");
  const form = document.getElementById("formLogin");
  const email = document.getElementById("email");
  const senha = document.getElementById("senha");
  const lembrar = document.getElementById("lembrar");
  const showPass = document.getElementById("showPass");
  const botao = form.querySelector(".btn-login");
  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function mensagem(id, referencia) {
    let elemento = document.getElementById(id);
    if (!elemento) {
      elemento = document.createElement("p");
      elemento.id = id;
      referencia.insertAdjacentElement("afterend", elemento);
    }
    return elemento;
  }
  const msgEmail = mensagem("msg-email", email.closest(".input-box"));
  const msgSenha = mensagem("msg-senha", senha.closest(".input-box"));
  const msgLogin = mensagem("msg-login", botao);
  function setMsg(elemento, texto, tipo = "erro") {
    elemento.textContent = texto;
    elemento.className = texto ? (tipo === "ok" ? "msg-sucesso" : "msg-erro") : "";
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

  document.querySelectorAll(".perfil-btn").forEach((item) => item.addEventListener("click", () => {
    document.querySelectorAll(".perfil-btn").forEach((botaoPerfil) => botaoPerfil.classList.remove("ativo"));
    item.classList.add("ativo");
  }));
  showPass?.addEventListener("click", () => {
    const mostrar = senha.type === "password";
    senha.type = mostrar ? "text" : "password";
    showPass.querySelector("i").className = mostrar ? "bi bi-eye-slash" : "bi bi-eye";
  });

  const emailSalvo = localStorage.getItem("marketplace:lembrarEmail");
  if (emailSalvo) { email.value = emailSalvo; lembrar.checked = true; }
  email.addEventListener("blur", () => setMsg(msgEmail, email.value && !regexEmail.test(email.value) ? "E-mail inválido." : ""));

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const emailInformado = email.value.trim().toLowerCase();
    let valido = true;
    if (!regexEmail.test(emailInformado)) { setMsg(msgEmail, "Informe um e-mail válido."); valido = false; } else setMsg(msgEmail, "");
    if (!senha.value) { setMsg(msgSenha, "Informe sua senha."); valido = false; } else setMsg(msgSenha, "");
    if (!valido) return;
    botao.disabled = true;
    botao.textContent = "Entrando...";
    setMsg(msgLogin, "");
    try {
      const resposta = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
      const resultado = await resposta.json();
      if (!resposta.ok || !resultado.sucesso) throw new Error(resultado.mensagem || "Não foi possível entrar.");
      if (lembrar.checked) localStorage.setItem("marketplace:lembrarEmail", emailInformado);
      else localStorage.removeItem("marketplace:lembrarEmail");
      setMsg(msgLogin, "Login realizado com sucesso! Redirecionando...", "ok");
      window.setTimeout(() => { window.location.href = "inicio.html"; }, 500);
    } catch (erro) {
      setMsg(msgLogin, erro.message || "Erro de comunicação com o servidor.");
      botao.disabled = false;
      botao.textContent = "Entrar na plataforma";
    }
  });
});
