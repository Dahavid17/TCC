document.addEventListener("DOMContentLoaded", async () => { // <-- Adicionado o 'async' aqui

    /* ==========================================================
       VERIFICAÇÃO DE SESSÃO (NOVO)
    ========================================================== */
    let usuarioLogado = null;
    
    try {
        const response = await fetch('../../backend/auth/sessao.php');
        const data = await response.json();

        if (!data.logado) {
            // Se não estiver logado, redireciona para o login
            window.location.href = 'login-marketplace.html';
            return; // Para a execução do script aqui
        }
        
        usuarioLogado = data; // Guarda os dados do usuário para usar abaixo
    } catch (error) {
        console.error("Erro ao verificar sessão:", error);
    }

    /* ==========================================================
       SELEÇÃO DE ELEMENTOS DO DOM
    ========================================================== */
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
       SAUDAÇÃO DINÂMICA (ALTERADO PARA USAR O NOME DO BANCO)
    ========================================================== */
    const titulo = document.querySelector(".hero-content h1");

    // Só atualiza se achou o título e se o usuário estiver logado
    if (titulo && usuarioLogado) {
        const hora = new Date().getHours();
        let saudacao = "Olá";

        if (hora >= 5 && hora < 12) {
            saudacao = "Bom dia";
        } else if (hora >= 12 && hora < 18) {
            saudacao = "Boa tarde";
        } else {
            saudacao = "Boa noite";
        }

        // Pega apenas o primeiro nome do usuário
        const primeiroNome = usuarioLogado.nome.split(' ')[0];
        
        // Substitui "Maria" pelo nome real
        titulo.textContent = `${saudacao}, ${primeiroNome}! 👋`;
    }

    /* ==========================================================
       ATUALIZAR FOTO (AVATAR) E NOME NO TOPO (NOVO)
    ========================================================== */
    if (usuarioLogado) {
        const primeiroNome = usuarioLogado.nome.split(' ')[0];
        // Pega a primeira letra do nome e deixa maiúscula
        const inicial = primeiroNome.charAt(0).toUpperCase();

        // Atualiza o nome pequeno no canto da tela (se houver)
        const elementoNome = document.getElementById('nome-usuario');
        if (elementoNome) {
            elementoNome.textContent = primeiroNome;
        }

        // Atualiza a letra do avatar (substitui o 'U' pela inicial do usuário)
        const elementoAvatar = document.getElementById('letra-avatar');
        if (elementoAvatar) {
            elementoAvatar.textContent = inicial;
        }
    }

});