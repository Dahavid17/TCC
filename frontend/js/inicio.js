document.addEventListener("DOMContentLoaded", () => {

    const temaBtn = document.getElementById("temaBtn");
    const campoBusca = document.getElementById("buscarProduto");

    const categorias = document.querySelectorAll(".category-card");
    const navItens = document.querySelectorAll(".nav-item");

    /* ==========================================================
       MODO ESCURO
    ========================================================== */

    const temaSalvo = localStorage.getItem("marketplace:tema");

    if (temaSalvo === "dark") {
        document.body.classList.add("dark");

        temaBtn
            ?.querySelector("i")
            ?.classList.replace("bi-moon-stars-fill", "bi-sun-fill");
    }

    temaBtn?.addEventListener("click", () => {

        const dark = document.body.classList.toggle("dark");

        temaBtn.querySelector("i").className =
            dark
                ? "bi bi-sun-fill"
                : "bi bi-moon-stars-fill";

        localStorage.setItem(
            "marketplace:tema",
            dark ? "dark" : "light"
        );

    });

    /* ==========================================================
       CATEGORIAS
    ========================================================== */

    categorias.forEach((categoria) => {

        categoria.addEventListener("click", () => {

            categorias.forEach((item) =>
                item.classList.remove("ativa")
            );

            categoria.classList.add("ativa");

            const nomeCategoria =
                categoria.querySelector("span").textContent;

            console.log("Categoria selecionada:", nomeCategoria);

            // Futuramente:
            // window.location.href = `produtos.php?categoria=${nomeCategoria}`;

        });

    });

    /* ==========================================================
       BARRA DE PESQUISA
    ========================================================== */

    campoBusca?.addEventListener("input", () => {

        const texto = campoBusca.value.trim().toLowerCase();

        console.log("Pesquisar:", texto);

        // Futuramente aqui será feito o filtro dos produtos.

    });

    campoBusca?.addEventListener("keydown", (evento) => {

        if (evento.key === "Enter") {

            evento.preventDefault();

            console.log("Buscar:", campoBusca.value);

        }

    });

    /* ==========================================================
       NAVEGAÇÃO INFERIOR
    ========================================================== */

    navItens.forEach((item) => {

        item.addEventListener("click", () => {

            navItens.forEach((botao) =>
                botao.classList.remove("ativo")
            );

            item.classList.add("ativo");

        });

    });

    /* ==========================================================
       ANIMAÇÃO DOS CARDS
    ========================================================== */

    const elementos = document.querySelectorAll(
        ".category-card, .suggestion-card, .empty-state"
    );

    elementos.forEach((elemento, indice) => {

        elemento.style.opacity = "0";
        elemento.style.transform = "translateY(20px)";

        setTimeout(() => {

            elemento.style.transition =
                "opacity .45s ease, transform .45s ease";

            elemento.style.opacity = "1";
            elemento.style.transform = "translateY(0)";

        }, indice * 80);

    });

    /* ==========================================================
       SAUDAÇÃO DINÂMICA
    ========================================================== */

    const titulo = document.querySelector(".hero-content h1");

    if (titulo) {

        const hora = new Date().getHours();

        let saudacao = "Olá";

        if (hora >= 5 && hora < 12) {
            saudacao = "Bom dia";
        }

        else if (hora >= 12 && hora < 18) {
            saudacao = "Boa tarde";
        }

        else {
            saudacao = "Boa noite";
        }

        titulo.textContent = `${saudacao}, Maria! 👋`;

        // Futuramente:
        // titulo.textContent = `${saudacao}, ${usuario.nome}! 👋`;

    }

});

