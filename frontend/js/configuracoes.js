document.addEventListener("DOMContentLoaded", () => {

    /* ======================================================
       TEMA
    ====================================================== */

    const temaBtn = document.getElementById("temaBtn");

    if (localStorage.getItem("marketplace:tema") === "dark") {
        document.body.classList.add("dark");
        temaBtn.querySelector("i").className = "bi bi-sun-fill";
    }

    temaBtn.addEventListener("click", () => {

        document.body.classList.toggle("dark");

        const dark = document.body.classList.contains("dark");

        temaBtn.querySelector("i").className =
            dark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";

        localStorage.setItem("marketplace:tema", dark ? "dark" : "light");

    });

    /* ======================================================
       MENU INTERNO DAS ABAS
    ====================================================== */

    const menuItens = document.querySelectorAll(".menu-item");
    const tabs = document.querySelectorAll(".tab");

    menuItens.forEach(botao => {

        botao.addEventListener("click", () => {

            menuItens.forEach(item => item.classList.remove("ativo"));
            tabs.forEach(tab => tab.classList.remove("ativo"));

            botao.classList.add("ativo");

            document
                .getElementById(botao.dataset.tab)
                .classList.add("ativo");

        });

    });

    /* ======================================================
       USUÁRIO TEMPORÁRIO
       (Depois será carregado do banco)
    ====================================================== */

    let usuario = JSON.parse(localStorage.getItem("usuarioLogado")) || {

        usuario_id: 1,
        nome: "Usuário",
        email: "usuario@email.com",
        telefone: "(00) 00000-0000",
        cidade: "Mococa - SP",
        tipo: "Produtor"

    };

    carregarPerfil();

    function carregarPerfil() {

        document.getElementById("usuarioId").value = usuario.usuario_id;

        document.getElementById("nomeUsuario").textContent = usuario.nome;
        document.getElementById("tipoUsuario").textContent = usuario.tipo;

        document.getElementById("avatarUsuario").textContent =
            usuario.nome.charAt(0).toUpperCase();

        document.getElementById("avatarPerfil").textContent =
            usuario.nome.charAt(0).toUpperCase();

        document.getElementById("tituloNome").textContent = usuario.nome;
        document.getElementById("tituloTipo").textContent = usuario.tipo;

        document.getElementById("nomePerfil").value = usuario.nome;
        document.getElementById("emailPerfil").value = usuario.email;
        document.getElementById("telefonePerfil").value = usuario.telefone;
        document.getElementById("cidadePerfil").value = usuario.cidade;

    }

    /* ======================================================
       SALVAR PERFIL
    ====================================================== */

    document
        .getElementById("formPerfil")
        .addEventListener("submit", e => {

            e.preventDefault();

            usuario.nome =
                document.getElementById("nomePerfil").value.trim();

            usuario.email =
                document.getElementById("emailPerfil").value.trim();

            usuario.telefone =
                document.getElementById("telefonePerfil").value.trim();

            usuario.cidade =
                document.getElementById("cidadePerfil").value.trim();

            localStorage.setItem(
                "usuarioLogado",
                JSON.stringify(usuario)
            );

            carregarPerfil();

            alert("Perfil atualizado com sucesso!");

        });

    /* ======================================================
       TROCAR FOTO
       (Placeholder para o backend)
    ====================================================== */

    document
        .getElementById("trocarFoto")
        .addEventListener("click", () => {

            alert("A alteração da foto será integrada ao back-end.");

        });

    /* ======================================================
       ALTERAR SENHA
    ====================================================== */

    document
        .getElementById("formSenha")
        .addEventListener("submit", e => {

            e.preventDefault();

            const senhaAtual =
                document.getElementById("senhaAtual").value;

            const novaSenha =
                document.getElementById("novaSenha").value;

            const confirmar =
                document.getElementById("confirmarSenha").value;

            if (!senhaAtual || !novaSenha || !confirmar) {

                alert("Preencha todos os campos.");

                return;

            }

            if (novaSenha.length < 6) {

                alert("A nova senha deve ter pelo menos 6 caracteres.");

                return;

            }

            if (novaSenha !== confirmar) {

                alert("As senhas não coincidem.");

                return;

            }

            alert("Senha atualizada!");

            e.target.reset();

        });

    /* ======================================================
       PREFERÊNCIAS
    ====================================================== */

    let preferencias = JSON.parse(
        localStorage.getItem("marketplace:preferencias")
    ) || {

        notificacoes: true,
        emails: true,
        tema_automatico: false

    };

    carregarPreferencias();

    function carregarPreferencias() {

        document.getElementById("notificacoes").checked =
            preferencias.notificacoes;

        document.getElementById("emails").checked =
            preferencias.emails;

        document.getElementById("temaAutomatico").checked =
            preferencias.tema_automatico;

    }

    document
        .getElementById("formPreferencias")
        .addEventListener("submit", e => {

            e.preventDefault();

            preferencias.notificacoes =
                document.getElementById("notificacoes").checked;

            preferencias.emails =
                document.getElementById("emails").checked;

            preferencias.tema_automatico =
                document.getElementById("temaAutomatico").checked;

            localStorage.setItem(
                "marketplace:preferencias",
                JSON.stringify(preferencias)
            );

            alert("Preferências salvas!");

        });

    /* ======================================================
       NAVEGAÇÃO
    ====================================================== */

    document
        .getElementById("btnMensagens")
        .addEventListener("click", () => {

            window.location.href = "negociacoes.html";

        });

    document
        .getElementById("btnLogout")
        .addEventListener("click", () => {

            window.location.href = "logout.html";

        });

    /* ======================================================
       MODAL EXCLUIR CONTA
    ====================================================== */

    const modal = document.getElementById("modalExcluirConta");

    function abrirModal() {

        modal.classList.add("ativo");

    }

    function fecharModal() {

        modal.classList.remove("ativo");

    }

    document
        .getElementById("btnExcluirConta")
        .addEventListener("click", abrirModal);

    document
        .getElementById("fecharModalExcluir")
        .addEventListener("click", fecharModal);

    document
        .getElementById("cancelarExcluir")
        .addEventListener("click", fecharModal);

    modal.addEventListener("click", e => {

        if (e.target === modal) {

            fecharModal();

        }

    });

    document
        .getElementById("confirmarExcluir")
        .addEventListener("click", () => {

            alert("A exclusão da conta será realizada pelo back-end.");

            fecharModal();

        });

});