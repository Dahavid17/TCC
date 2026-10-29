
document.addEventListener("DOMContentLoaded", () => {
  const formPerfil = document.getElementById("formPerfil");
  const nomePerfil = document.getElementById("nomePerfil");
  const emailPerfil = document.getElementById("emailPerfil");
  const telefonePerfil = document.getElementById("telefonePerfil");
  const cidadePerfil = document.getElementById("cidadePerfil");
  const usuarioId = document.getElementById("usuarioId");
  const btnSalvarPerfil = document.getElementById("btnSalvarPerfil");
  const mensagemPerfil = document.getElementById("mensagemPerfil");

  const URL_SESSAO = "../../backend/auth/sessao.php";
  const URL_ATUALIZAR = "../../backend/auth/atualizar_perfil.php";

  function mostrarMensagem(texto, sucesso = false) {
    if (!mensagemPerfil) return;

    mensagemPerfil.textContent = texto;
    mensagemPerfil.className = sucesso
      ? "msg-sucesso"
      : "msg-erro";
  }

  function atualizarInterface(usuario) {
    if (nomePerfil) nomePerfil.value = usuario.nome ?? "";
    if (emailPerfil) emailPerfil.value = usuario.email ?? "";
    if (telefonePerfil) telefonePerfil.value = usuario.telefone ?? "";
    if (cidadePerfil) cidadePerfil.value = usuario.cidade ?? "";
    if (usuarioId) usuarioId.value = usuario.id ?? "";

    const nome = usuario.nome || "Usuário";
    const tipo = usuario.tipo_acesso || "Conta";
    const inicial = nome.trim().charAt(0).toUpperCase() || "U";

    const nomeUsuario = document.getElementById("nomeUsuario");
    const tipoUsuario = document.getElementById("tipoUsuario");
    const avatarUsuario = document.getElementById("avatarUsuario");
    const avatarPerfil = document.getElementById("avatarPerfil");
    const tituloNome = document.getElementById("tituloNome");
    const tituloTipo = document.getElementById("tituloTipo");

    if (nomeUsuario) nomeUsuario.textContent = nome;
    if (tipoUsuario) tipoUsuario.textContent = tipo;
    if (avatarUsuario) avatarUsuario.textContent = inicial;
    if (avatarPerfil) avatarPerfil.textContent = inicial;
    if (tituloNome) tituloNome.textContent = nome;
    if (tituloTipo) tituloTipo.textContent = tipo;
  }

  async function carregarPerfil() {
    try {
      const resposta = await fetch(URL_SESSAO, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });

      const texto = await resposta.text();
      let dados;

      try {
        dados = JSON.parse(texto);
      } catch {
        console.error("Resposta da sessão:", texto);
        throw new Error("O servidor retornou uma resposta inválida.");
      }

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(
          dados.mensagem || "Não foi possível carregar o perfil."
        );
      }

      atualizarInterface(dados.usuario);

    } catch (erro) {
      console.error("Erro ao carregar perfil:", erro);
      mostrarMensagem(erro.message || "Erro ao carregar o perfil.");
    }
  }

  if (formPerfil) {
    formPerfil.addEventListener("submit", async (evento) => {
      evento.preventDefault();

      const nome = nomePerfil?.value.trim() || "";
      const telefone = telefonePerfil?.value.trim() || "";
      const cidade = cidadePerfil?.value.trim() || "";

      if (!nome || !telefone || !cidade) {
        mostrarMensagem("Preencha o nome, telefone e cidade.");
        return;
      }

      const dadosFormulario = new FormData();
      dadosFormulario.set("nome", nome);
      dadosFormulario.set("telefone", telefone);
      dadosFormulario.set("cidade", cidade);

      if (btnSalvarPerfil) {
        btnSalvarPerfil.disabled = true;
        btnSalvarPerfil.textContent = "Salvando...";
      }

      mostrarMensagem("");

      try {
        const resposta = await fetch(URL_ATUALIZAR, {
          method: "POST",
          credentials: "same-origin",
          body: dadosFormulario,
          headers: {
            Accept: "application/json"
          }
        });

        const texto = await resposta.text();
        let dados;

        try {
          dados = JSON.parse(texto);
        } catch {
          console.error("Resposta da atualização:", texto);
          throw new Error("O servidor retornou uma resposta inválida.");
        }

        if (!resposta.ok || !dados.sucesso) {
          throw new Error(
            dados.mensagem || "Não foi possível salvar as alterações."
          );
        }

        atualizarInterface(dados.usuario);
        mostrarMensagem(dados.mensagem, true);

      } catch (erro) {
        console.error("Erro ao salvar perfil:", erro);
        mostrarMensagem(erro.message || "Erro ao salvar o perfil.");

      } finally {
        if (btnSalvarPerfil) {
          btnSalvarPerfil.disabled = false;
          btnSalvarPerfil.textContent = "Salvar alterações";
        }
      }
    });
  }

  // Alternância das abas de configurações.
  document.querySelectorAll(".config-menu [data-tab]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const destino = botao.dataset.tab;

      document.querySelectorAll(".config-menu [data-tab]").forEach((item) => {
        item.classList.toggle("ativo", item === botao);
      });

      document.querySelectorAll(".config-content .tab").forEach((aba) => {
        aba.classList.toggle("ativo", aba.id === destino);
      });
    });
  });

  // Tema claro/escuro.
  const temaBtn = document.getElementById("temaBtn");
  const temaSalvo = localStorage.getItem("marketplace:tema");

  if (temaSalvo === "dark") {
    document.body.classList.add("dark");
  }

  function atualizarIconeTema() {
    const icone = temaBtn?.querySelector("i");
    if (!icone) return;

    icone.className = document.body.classList.contains("dark")
      ? "bi bi-sun-fill"
      : "bi bi-moon-stars-fill";
  }

  atualizarIconeTema();

  temaBtn?.addEventListener("click", () => {
    const escuro = document.body.classList.toggle("dark");

    localStorage.setItem(
      "marketplace:tema",
      escuro ? "dark" : "light"
    );

    atualizarIconeTema();
  });

  // Encerrar sessão.
  const btnLogout = document.getElementById("btnLogout");

  btnLogout?.addEventListener("click", () => {
    window.location.href = "../../backend/auth/logout.php";
  });

  // Modal de confirmação da exclusão.
  const modal = document.getElementById("modalExcluirConta");
  const btnExcluir = document.getElementById("btnExcluirConta");
  const fecharModal = document.getElementById("fecharModalExcluir");
  const cancelarExcluir = document.getElementById("cancelarExcluir");

  function ocultarModal() {
    modal?.classList.remove("ativo");
  }

  btnExcluir?.addEventListener("click", () => {
    modal?.classList.add("ativo");
  });

  fecharModal?.addEventListener("click", ocultarModal);
  cancelarExcluir?.addEventListener("click", ocultarModal);

  // Carrega os dados da conta ao abrir a página.
  carregarPerfil();
});
