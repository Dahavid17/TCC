/* =============================================================
   PAGINA-MARKETPLACE.JS
   MarketPlace Rural
   Funcionalidades:
   - Tema persistente
   - Menu lateral ativo
   - Pesquisa (front-end temporário)
   - Categorias
   - Botões da hero
   - Notificações e mensagens (temporário)
   - Avatar automático
   ============================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* ─────────────────────────────────────────────
       TEMA PERSISTENTE
    ───────────────────────────────────────────── */

    const temaBtn = document.getElementById("temaBtn");
    const temaSalvo = localStorage.getItem("marketplace:tema");

    if (temaSalvo === "dark") {
        document.body.classList.add("dark");

        if (temaBtn) {
            temaBtn.querySelector("i").className = "bi bi-sun-fill";
        }
    }

    temaBtn?.addEventListener("click", () => {

        document.body.classList.toggle("dark");

        const dark = document.body.classList.contains("dark");

        temaBtn.querySelector("i").className =
            dark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";

        localStorage.setItem(
            "marketplace:tema",
            dark ? "dark" : "light"
        );

    });

    /* ─────────────────────────────────────────────
       AVATAR AUTOMÁTICO
    ───────────────────────────────────────────── */

    const nomeUsuario = document.getElementById("nomeUsuario");
    const avatar = document.getElementById("avatarUsuario");

    if (nomeUsuario && avatar) {

        const nome = nomeUsuario.textContent.trim();

        if (nome.length > 0) {
            avatar.textContent = nome.charAt(0).toUpperCase();
        }

    }

    /* ─────────────────────────────────────────────
       MENU LATERAL
    ───────────────────────────────────────────── */

    document.querySelectorAll(".sidebar a").forEach(link => {

        link.addEventListener("click", () => {

            document.querySelectorAll(".sidebar a")
                .forEach(item => item.classList.remove("ativo"));

            link.classList.add("ativo");

        });

    });

    /* ─────────────────────────────────────────────
       PESQUISA (temporária)
    ───────────────────────────────────────────── */

    const formPesquisa = document.getElementById("formPesquisa");
    const pesquisa = document.getElementById("pesquisa");

    formPesquisa?.addEventListener("submit", (e) => {

        e.preventDefault();

        const termo = pesquisa.value.trim();

        if (!termo) {

            alert("Digite algo para pesquisar.");

            return;

        }

        alert(`Pesquisa: "${termo}"`);

    });

    /* ─────────────────────────────────────────────
       FILTRO DE CATEGORIAS
    ───────────────────────────────────────────── */

    document.querySelectorAll(".lista-categorias button")
        .forEach(botao => {

            botao.addEventListener("click", () => {

                document.querySelectorAll(".lista-categorias button")
                    .forEach(btn => btn.classList.remove("ativo"));

                botao.classList.add("ativo");

                const categoria = botao.dataset.categoria;

                console.log("Categoria selecionada:", categoria);

            });

        });

    /* ─────────────────────────────────────────────
       BOTÕES DA HERO
    ───────────────────────────────────────────── */

    document.getElementById("btnNovoProduto")
        ?.addEventListener("click", () => {

            window.location.href = "meus-produtos.html";

        });

    document.getElementById("btnExplorar")
        ?.addEventListener("click", () => {

            document.querySelector(".produtos")
                ?.scrollIntoView({
                    behavior: "smooth"
                });

        });

    /* ─────────────────────────────────────────────
       NOTIFICAÇÕES
    ───────────────────────────────────────────── */

    document.getElementById("btnNotificacoes")
        ?.addEventListener("click", () => {

            alert("Suas notificações aparecerão aqui.");

        });

    /* ─────────────────────────────────────────────
       MENSAGENS
    ───────────────────────────────────────────── */

    document.getElementById("btnMensagens")
        ?.addEventListener("click", () => {

            window.location.href = "negociacoes.html";

        });

    /* ─────────────────────────────────────────────
       CARDS RÁPIDOS
    ───────────────────────────────────────────── */

    document.getElementById("cardProdutos")
        ?.addEventListener("click", () => {

            window.location.href = "meus-produtos.html";

        });

    document.getElementById("cardPedidos")
        ?.addEventListener("click", () => {

            window.location.href = "pedidos.html";

        });

    document.getElementById("cardNegociacoes")
        ?.addEventListener("click", () => {

            window.location.href = "negociacoes.html";

        });

    document.getElementById("cardEstoque")
        ?.addEventListener("click", () => {

            window.location.href = "estoque.html";

        });

    /* ─────────────────────────────────────────────
       PLACEHOLDER DOS CONTADORES
       (Depois o PHP substitui)
    ───────────────────────────────────────────── */

    const contadores = [
        "totalProdutos",
        "totalPedidos",
        "totalNegociacoes",
        "totalEstoque"
    ];

    contadores.forEach(id => {

        const elemento = document.getElementById(id);

        if (elemento && elemento.textContent.trim() === "") {

            elemento.textContent = "0";

        }

    });

});