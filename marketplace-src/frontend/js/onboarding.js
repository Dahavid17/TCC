// Onboarding do primeiro acesso: o mascote Broto apresenta o painel em poucos passos.
// O inicio.js chama window.iniciarOnboarding(usuario) depois de carregar a sessão.
// "Já viu o tour" fica guardado no navegador, por usuário; inicio.html?tour=1 abre de novo.

(function () {

    const MASCOTE = "../../assets/img/mascote/broto.svg";
    const CELULAR = 600;
    const DESKTOP = 900;
    const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function chave(usuario) {
        return "marketplace:onboarding:" + usuario.id;
    }

    function jaViu(usuario) {
        try {
            return localStorage.getItem(chave(usuario)) === "visto";
        } catch (erro) {
            return false;
        }
    }

    function marcarVisto(usuario) {
        try {
            localStorage.setItem(chave(usuario), "visto");
        } catch (erro) {
            // Sem armazenamento (aba anônima): o tour só volta a aparecer.
        }
    }

    function montarPassos(usuario) {

        const nome = (usuario.nome || "").split(" ")[0];
        const vende = ["produtor", "admin"].includes(usuario.tipo_acesso);

        return [
            {
                titulo: `Oi, ${nome}! Eu sou o Broto 🌱`,
                texto: "Vou te mostrar o MarketPlace Rural em poucos passos. Leva menos de um minuto.",
                mascote: "acenando"
            },
            vende
                ? {
                    alvo: () => [document.getElementById("btnNovoProduto")],
                    titulo: "Cadastre seus produtos",
                    texto: "Comece por aqui: informe o que você produz, com preço, foto e estoque. Os compradores já veem tudo na vitrine."
                }
                : {
                    alvo: () => [document.querySelector(".categorias")],
                    titulo: "Encontre o que precisa",
                    texto: "Explore os produtos do campo por categoria ou pesquise pelo nome na barra do topo."
                },
            {
                alvo: () => [document.querySelector(".acoes-rapidas")],
                titulo: "Seu resumo em um só lugar",
                texto: "Aqui você acompanha produtos, pedidos, negociações e estoque. Toque em um cartão para abrir a página."
            },
            {
                alvo: () => window.innerWidth < DESKTOP
                    ? [document.querySelector(".btn-menu")]
                    : [
                        document.querySelector('.sidebar a[href="pedidos.html"]'),
                        document.querySelector('.sidebar a[href="negociacoes.html"]')
                    ],
                fixo: true,
                titulo: "Pedidos e negociações",
                texto: () => window.innerWidth < DESKTOP
                    ? "No menu você encontra Pedidos e Negociações: converse direto com a outra parte e acompanhe cada pedido até a entrega."
                    : "Converse direto com compradores e vendedores e acompanhe cada pedido até a entrega."
            },
            {
                titulo: "Tudo pronto!",
                texto: "Quando quiser rever este tour, é só ir em Configurações, na aba Preferências.",
                mascote: "comemorando",
                acao: vende
                    ? { rotulo: "Cadastrar primeiro produto", destino: "meus-produtos.html" }
                    : { rotulo: "Explorar produtos", rolarAte: ".produtos" }
            }
        ];
    }

    async function carregarMascote() {
        try {
            const resposta = await fetch(MASCOTE);
            if (!resposta.ok) throw new Error(resposta.status);
            return await resposta.text();
        } catch (erro) {
            return `<img src="${MASCOTE}" alt="">`;
        }
    }

    async function abrir(usuario) {

        const passos = montarPassos(usuario);
        const svg = await carregarMascote();
        let atual = 0;
        let alvos = [];

        const tour = document.createElement("div");
        tour.className = "tour";
        tour.innerHTML = `
            <div class="tour-foco"></div>
            <div class="tour-balao" role="dialog" aria-modal="true" aria-labelledby="tourTitulo" aria-describedby="tourTexto">
                <div class="tour-topo">
                    <div class="tour-mascote" aria-hidden="true">${svg}</div>
                    <div aria-live="polite">
                        <div class="tour-cabeca">
                            <span class="tour-passo" id="tourPasso"></span>
                            <div class="tour-pontos" aria-hidden="true">${passos.map(() => "<span></span>").join("")}</div>
                        </div>
                        <h2 id="tourTitulo"></h2>
                        <p id="tourTexto"></p>
                    </div>
                </div>
                <div class="tour-rodape">
                    <button type="button" class="tour-pular">Pular tour</button>
                    <div class="modal-acoes">
                        <button type="button" data-tour="voltar">Voltar</button>
                        <button type="button" data-tour="proximo">Próximo</button>
                    </div>
                </div>
            </div>
        `;

        const foco = tour.querySelector(".tour-foco");
        const balao = tour.querySelector(".tour-balao");
        const mascote = tour.querySelector(".tour-mascote");
        const btnVoltar = tour.querySelector('[data-tour="voltar"]');
        const btnProximo = tour.querySelector('[data-tour="proximo"]');
        const btnPular = tour.querySelector(".tour-pular");
        const pontos = tour.querySelectorAll(".tour-pontos span");

        // O resto da página fica inacessível enquanto o tour está aberto.
        const fundo = [...document.body.children].filter(el => !el.hidden && el.tagName !== "SCRIPT");
        fundo.forEach(el => el.inert = true);
        document.body.append(tour);

        function retanguloAlvo() {

            const caixas = alvos.map(el => el.getBoundingClientRect()).filter(r => r.width && r.height);
            if (!caixas.length) return null;

            const margem = 8;
            const topo = Math.min(...caixas.map(r => r.top)) - margem;
            const esquerda = Math.min(...caixas.map(r => r.left)) - margem;

            return {
                top: topo,
                left: esquerda,
                width: Math.max(...caixas.map(r => r.right)) + margem - esquerda,
                height: Math.max(...caixas.map(r => r.bottom)) + margem - topo
            };
        }

        function posicionar() {

            const r = retanguloAlvo();
            tour.classList.toggle("sem-alvo", !r);

            if (!r) {
                balao.style.top = balao.style.left = "";
                return;
            }

            Object.assign(foco.style, {
                top: r.top + "px",
                left: r.left + "px",
                width: r.width + "px",
                height: r.height + "px"
            });

            if (window.innerWidth < CELULAR) {
                balao.style.top = balao.style.left = "";
                return;
            }

            const espaco = 16;
            const alturaBalao = balao.offsetHeight;
            const larguraBalao = balao.offsetWidth;
            let top;
            let left = r.left;

            if (r.left + r.width + espaco + larguraBalao < window.innerWidth && r.width < 320) {
                // Alvo estreito (menu lateral, botão): balão ao lado.
                left = r.left + r.width + espaco;
                top = r.top;
            } else if (r.top + r.height + espaco + alturaBalao < window.innerHeight) {
                top = r.top + r.height + espaco;
            } else {
                top = r.top - espaco - alturaBalao;
            }

            balao.style.top = Math.max(espaco, Math.min(top, window.innerHeight - alturaBalao - espaco)) + "px";
            balao.style.left = Math.max(espaco, Math.min(left, window.innerWidth - larguraBalao - espaco)) + "px";
        }

        function rolarParaAlvo(passo) {

            if (!alvos.length || passo.fixo) return;

            const r = alvos[0].getBoundingClientRect();
            const topoFixo = document.querySelector(".topbar")?.offsetHeight || 0;
            const livre = window.innerWidth < CELULAR
                ? topoFixo + 16                               // balão ocupa a parte de baixo
                : topoFixo + Math.max(16, (window.innerHeight - topoFixo - r.height) / 3);

            window.scrollTo({
                top: window.scrollY + r.top - livre,
                behavior: reduzirMovimento ? "auto" : "smooth"
            });
        }

        function mostrar(indice) {

            atual = indice;
            const passo = passos[indice];
            const ultimo = indice === passos.length - 1;

            alvos = passo.alvo ? passo.alvo().filter(Boolean) : [];

            tour.querySelector("#tourPasso").textContent = `Passo ${indice + 1} de ${passos.length}`;
            tour.querySelector("#tourTitulo").textContent = passo.titulo;
            tour.querySelector("#tourTexto").textContent =
                typeof passo.texto === "function" ? passo.texto() : passo.texto;

            pontos.forEach((p, i) => p.classList.toggle("ativo", i === indice));

            mascote.classList.remove("acenando", "comemorando");
            void mascote.offsetWidth; // reinicia a animação
            if (passo.mascote) mascote.classList.add(passo.mascote);

            btnVoltar.hidden = indice === 0 && !ultimo;
            btnVoltar.textContent = ultimo ? "Agora não" : "Voltar";
            btnProximo.textContent = ultimo ? passo.acao.rotulo : "Próximo";
            btnPular.hidden = ultimo;

            // Reapresenta o balão com a animação de entrada.
            balao.style.animation = "none";
            void balao.offsetWidth;
            balao.style.animation = "";

            rolarParaAlvo(passo);
            posicionar();
            btnProximo.focus();
        }

        let quadro = 0;
        function acompanhar() {
            cancelAnimationFrame(quadro);
            quadro = requestAnimationFrame(posicionar);
        }

        function fechar() {
            marcarVisto(usuario);
            window.removeEventListener("scroll", acompanhar);
            window.removeEventListener("resize", acompanhar);
            document.removeEventListener("keydown", teclado, true);
            fundo.forEach(el => el.inert = false);
            tour.remove();
        }

        function teclado(e) {

            if (e.key === "Escape") {
                e.stopPropagation();
                fechar();
                return;
            }

            if (e.key === "Tab") {
                const botoes = [...balao.querySelectorAll("button:not([hidden])")];
                const primeiro = botoes[0];
                const ultimoBotao = botoes[botoes.length - 1];

                if (e.shiftKey && document.activeElement === primeiro) {
                    e.preventDefault();
                    ultimoBotao.focus();
                } else if (!e.shiftKey && document.activeElement === ultimoBotao) {
                    e.preventDefault();
                    primeiro.focus();
                }
            }
        }

        btnProximo.addEventListener("click", () => {

            if (atual < passos.length - 1) {
                mostrar(atual + 1);
                return;
            }

            const { destino, rolarAte } = passos[atual].acao;
            fechar();

            if (destino) {
                window.location.href = destino;
            } else {
                document.querySelector(rolarAte)?.scrollIntoView({ behavior: reduzirMovimento ? "auto" : "smooth" });
            }
        });

        btnVoltar.addEventListener("click", () => {
            if (atual === passos.length - 1) {
                fechar();
            } else {
                mostrar(atual - 1);
            }
        });

        btnPular.addEventListener("click", fechar);
        window.addEventListener("scroll", acompanhar, { passive: true });
        window.addEventListener("resize", acompanhar);
        document.addEventListener("keydown", teclado, true);

        mostrar(0);
    }

    window.iniciarOnboarding = function (usuario) {

        if (!usuario || !usuario.id) return;

        const url = new URL(window.location.href);
        const pedido = url.searchParams.get("tour") === "1";

        if (pedido) {
            url.searchParams.delete("tour");
            history.replaceState(null, "", url);
        }

        if (pedido || !jaViu(usuario)) {
            abrir(usuario);
        }
    };

})();
