// Aviso "Opa! Esse produto é seu" — aparece quando a pessoa clica em Negociar
// num produto que ela mesma anunciou. O mascote Broto explica e dá uma dica.
// Usado no Início, na aba Produtos (vitrine.js) e em Negociações (negociacoes.js).
//
// Uso: AvisoProprioProduto.abrir({ nome, preco, imagem });

(function () {
    const MASCOTE = "../../assets/img/mascote/broto.svg";

    // Uma dica diferente a cada vez, para o vendedor aproveitar o momento.
    const DICAS = [
        { icone: "bi-camera", texto: "Fotos claras e bem iluminadas fazem o produto vender mais rápido." },
        { icone: "bi-tag", texto: "Que tal uma promoção? Produtos em promoção aparecem nos destaques do Início." },
        { icone: "bi-card-text", texto: "Uma boa descrição (peso, validade, entrega) evita muitas perguntas no chat." },
        { icone: "bi-clipboard-check", texto: "Mantenha o estoque atualizado para não receber pedidos que você não consegue entregar." },
        { icone: "bi-chat-dots", texto: "Responder rápido no chat aumenta a confiança de quem está comprando." },
    ];

    let fundo = null;
    let indiceDica = Math.floor(Math.random() * DICAS.length);

    function dinheiro(valor) {
        return "R$ " + Number(valor || 0).toFixed(2).replace(".", ",");
    }

    function escapeHtml(texto) {
        const div = document.createElement("div");
        div.textContent = texto ?? "";
        return div.innerHTML.replace(/"/g, "&quot;");
    }

    function mostrarDica() {
        const dica = DICAS[indiceDica % DICAS.length];
        const caixa = fundo.querySelector(".app-dica-texto");
        caixa.innerHTML = `<i class="bi ${dica.icone}" aria-hidden="true"></i> ${escapeHtml(dica.texto)}`;
        caixa.classList.remove("app-troca");
        void caixa.offsetWidth; // reinicia a animação curta de troca
        caixa.classList.add("app-troca");
    }

    function fechar() {
        if (!fundo) return;
        fundo.remove();
        fundo = null;
        document.removeEventListener("keydown", teclas);
    }

    function teclas(e) {
        if (e.key === "Escape") fechar();
    }

    function abrir(produto = {}) {
        fechar();

        const imagem = produto.imagem
            ? "../../" + produto.imagem
            : "../../assets/img/produtos/produto-placeholder.jpg";

        fundo = document.createElement("div");
        fundo.className = "app-fundo";
        fundo.innerHTML = `
            <div class="app-caixa" role="dialog" aria-modal="true" aria-labelledby="appTitulo">
                <img class="app-mascote" src="${MASCOTE}" alt="" aria-hidden="true">
                <h2 id="appTitulo">Opa! Esse produto é seu 😄</h2>
                <p class="app-texto">
                    Você é quem vende este produto, então não dá para negociar com você mesmo.
                    Quando um comprador clicar em <b>Negociar</b>, a conversa aparece em <b>Negociações</b>.
                </p>

                <div class="app-produto">
                    <img src="${escapeHtml(imagem)}" alt="">
                    <div>
                        <strong>${escapeHtml(produto.nome || "Seu produto")}</strong>
                        <span>${dinheiro(produto.preco)} · anunciado por você</span>
                    </div>
                </div>

                <div class="app-dica">
                    <span class="app-dica-titulo">Dica do Broto</span>
                    <p class="app-dica-texto" aria-live="polite"></p>
                    <button type="button" class="app-outra-dica"><i class="bi bi-shuffle"></i> Outra dica</button>
                </div>

                <div class="app-botoes">
                    <a class="app-btn" href="meus-produtos.html"><i class="bi bi-pencil-square"></i> Melhorar meu anúncio</a>
                    <a class="app-btn secundario" href="negociacoes.html"><i class="bi bi-chat-left-text"></i> Ver minhas conversas</a>
                </div>
                <button type="button" class="app-fechar">Entendi, continuar navegando</button>
            </div>`;

        fundo.addEventListener("click", e => {
            if (e.target === fundo || e.target.closest(".app-fechar")) fechar();
        });

        fundo.querySelector(".app-outra-dica").addEventListener("click", () => {
            indiceDica++;
            mostrarDica();
        });

        document.body.appendChild(fundo);
        document.addEventListener("keydown", teclas);
        mostrarDica();
        indiceDica++;

        fundo.querySelector(".app-fechar").focus({ preventScroll: true });
    }

    window.AvisoProprioProduto = { abrir, fechar };
})();
