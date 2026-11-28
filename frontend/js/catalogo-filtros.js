/* =============================================================
   CATALOGO-FILTROS.JS — Catálogo com filtros (página catalogo.html)
   (o catalogo.js do servidor é outro arquivo: o da vitrine produtos.html)
   Filtros por categoria, cultura, localização e faixa de preço;
   galeria de fotos; reputação do vendedor; favoritos; pedido;
   alerta de preço. O dono do anúncio gerencia as fotos e a cultura
   no próprio detalhe. Requer modulos.js.
   ============================================================= */

(() => {
  const CULTURAS = {
    soja: "Soja", milho: "Milho", cafe: "Café", feijao: "Feijão", trigo: "Trigo", arroz: "Arroz", cana: "Cana-de-açúcar",
    algodao: "Algodão", sorgo: "Sorgo", mandioca: "Mandioca", laranja: "Laranja", banana: "Banana", tomate: "Tomate",
    batata: "Batata", hortalicas: "Hortaliças", pastagem: "Pastagem", eucalipto: "Eucalipto", outra: "Outra",
  };
  const CATEGORIAS = { hortalicas: "Hortaliças", frutas: "Frutas", graos: "Grãos", laticinios: "Laticínios", carnes: "Carnes", flores: "Flores" };

  const { esc, moeda, num } = MR;
  const $ = (s, el = document) => el.querySelector(s);
  const st = { produtos: [], favoritos: new Set(), usuario: null, detalhe: null, foto: 0 };

  const img = (url) => url ? "../../" + url : "";
  const estrelas = (nota, total) => nota === null || nota === undefined
    ? '<span class="mr-ajuda">Sem avaliações</span>'
    : `<span class="mr-estrelas" title="${num(nota, 1)} de 5">${"★".repeat(Math.round(nota))}${"☆".repeat(5 - Math.round(nota))}<small>${num(nota, 1)} (${total})</small></span>`;

  async function carregar() {
    const filtros = new URLSearchParams(new FormData($("#formFiltros")));
    [...filtros.keys()].forEach((k) => { if (!filtros.get(k)) filtros.delete(k); });
    filtros.set("escopo", "catalogo");
    history.replaceState(null, "", "?" + new URLSearchParams([...filtros].filter(([k]) => k !== "escopo")).toString());

    $("#listaCatalogo").innerHTML = '<p class="mr-ajuda">Carregando…</p>';
    try {
      const d = await MR.api("produtos/listar.php?" + filtros);
      st.produtos = d.produtos;
      renderizar();
      const regioes = [...new Set(d.produtos.map((p) => p.localizacao).filter(Boolean))];
      $("#listaRegioes").innerHTML = regioes.map((r) => `<option value="${esc(r)}">`).join("");
    } catch (e) {
      $("#listaCatalogo").innerHTML = "";
      MR.toast(e.message, "erro");
    }
  }

  function renderizar() {
    const n = st.produtos.length;
    $("#resumoBusca").textContent = n ? `${n} produto(s) encontrado(s).` : "Nenhum produto com esses filtros.";
    $("#listaCatalogo").innerHTML = n ? st.produtos.map((p) => `
      <article class="produto-card mr-produto-card" data-abrir="${p.id}" tabindex="0" aria-label="${esc(p.nome)}">
        ${p.vendedor_id !== st.usuario.id ? `<button type="button" class="mr-fav ${st.favoritos.has(p.id) ? "ativo" : ""}" data-fav="${p.id}" aria-label="Favoritar"><i class="bi bi-heart"></i></button>` : ""}
        ${p.total_fotos > 1 ? `<span class="mr-n-fotos"><i class="bi bi-images"></i> ${p.total_fotos}</span>` : ""}
        ${p.imagem ? `<img src="${esc(img(p.imagem))}" alt="${esc(p.nome)}" loading="lazy">` : '<div class="img-vazia"><i class="bi bi-image"></i></div>'}
        <div class="produto-info">
          <span class="categoria">${esc(CATEGORIAS[p.categoria] || p.categoria)}${p.cultura ? " · " + esc(CULTURAS[p.cultura] || p.cultura) : ""}</span>
          <h3>${esc(p.nome)}</h3>
          <p><i class="bi bi-geo-alt"></i> ${esc(p.localizacao || "Local não informado")} · ${esc(p.vendedor_nome)}</p>
          <p>${estrelas(p.vendedor_nota, p.vendedor_avaliacoes)}</p>
          <strong>${moeda(p.preco)}${p.unidade ? ` <small>/ ${esc(p.unidade)}</small>` : ""}${p.em_promocao ? ` <small class="mr-ajuda"><s>${moeda(p.preco_base)}</s> -${p.desconto}%</small>` : ""}</strong>
          <p class="mr-ajuda">${p.estoque > 0 ? num(p.estoque) + " em estoque" : "Esgotado"}</p>
        </div>
      </article>`).join("") : `<div class="mr-vazio" style="grid-column:1/-1"><i class="bi bi-search"></i>Nenhum produto encontrado. Tente outros filtros ou <button type="button" class="btn-sec" data-alerta-busca>crie um alerta</button> para ser avisado.</div>`;
  }

  /* ── Detalhe com galeria ─────────────────────────────────── */
  async function abrirDetalhe(id) {
    try {
      const d = await MR.api("produtos/detalhe.php?id=" + id);
      st.detalhe = d;
      st.foto = 0;
      renderDetalhe();
      MR.modal.abrir("modalProduto");
      history.replaceState(null, "", location.pathname + "?produto=" + id);
    } catch (e) {
      MR.toast(e.message, "erro");
    }
  }

  function renderDetalhe() {
    const { produto: p, vendedor: v, historico_precos: h, favorito, alerta, proprio } = st.detalhe;
    const fotos = p.fotos;
    $("#detalheTitulo").textContent = proprio ? "Seu anúncio" : "Detalhes do produto";
    const variacao = h.length > 1 ? (h[h.length - 1].preco - h[0].preco) / h[0].preco * 100 : null;

    $("#conteudoProduto").innerHTML = `
      <div class="mr-detalhe">
        <div class="mr-galeria">
          <div class="mr-galeria-principal">
            ${fotos.length ? `<img src="${esc(img(fotos[st.foto].url))}" alt="Foto ${st.foto + 1} de ${esc(p.nome)}">` : '<div class="img-vazia" style="height:100%"><i class="bi bi-image"></i></div>'}
            ${fotos.length > 1 ? '<button type="button" class="ant" data-foto="-1" aria-label="Foto anterior"><i class="bi bi-chevron-left"></i></button><button type="button" class="prox" data-foto="1" aria-label="Próxima foto"><i class="bi bi-chevron-right"></i></button>' : ""}
          </div>
          ${fotos.length > 1 ? `<div class="mr-miniaturas">${fotos.map((f, i) => `<button type="button" class="${i === st.foto ? "ativo" : ""}" data-ir-foto="${i}" aria-label="Foto ${i + 1}"><img src="${esc(img(f.url))}" alt=""></button>`).join("")}</div>` : ""}
          ${proprio ? gestorFotos(p) : ""}
        </div>
        <div>
          <span class="mr-tag">${esc(CATEGORIAS[p.categoria] || p.categoria)}</span>
          ${p.cultura ? `<span class="mr-tag terra">${esc(CULTURAS[p.cultura] || p.cultura)}</span>` : ""}
          <h3 id="detalheNome" style="margin-top:8px">${esc(p.nome)}</h3>
          <div class="mr-preco">${moeda(p.preco)}${p.unidade ? ` <small>/ ${esc(p.unidade)}</small>` : ""}
            ${p.em_promocao ? ` <small class="mr-ajuda"><s>${moeda(p.preco_base)}</s> <span class="mr-tag ok">-${p.desconto}%</span></small>` : ""}</div>
          ${variacao !== null && Math.abs(variacao) >= .5 ? `<p class="mr-ajuda">Preço médio de ${esc(CULTURAS[p.cultura] || CATEGORIAS[p.categoria] || "")} na plataforma nos últimos 90 dias: ${variacao > 0 ? '<span class="mr-alta">subiu' : '<span class="mr-baixa">caiu'} ${num(Math.abs(variacao), 1)}%</span>.</p>` : ""}
          <p class="mr-ajuda"><i class="bi bi-geo-alt"></i> ${esc(p.localizacao || "Local não informado")} · ${p.estoque > 0 ? num(p.estoque) + " em estoque" : "<strong>Esgotado</strong>"}</p>
          <p style="margin-top:10px">${esc(p.descricao || "Sem descrição.")}</p>
          <div class="mr-acoes">
            ${proprio ? `<a class="btn-principal" href="meus-produtos.html"><i class="bi bi-pencil"></i> Editar em Meus Produtos</a>` : `
              <button type="button" class="btn-principal" data-pedido="${p.id}" ${p.estoque > 0 ? "" : "disabled"}><i class="bi bi-bag"></i> Fazer pedido</button>
              <a class="btn-sec" href="negociacoes.html?anuncio=${p.id}"><i class="bi bi-chat-dots"></i> Negociar</a>
              <button type="button" class="btn-sec" data-fav="${p.id}"><i class="bi ${favorito ? "bi-heart-fill" : "bi-heart"}"></i> ${favorito ? "Favorito" : "Favoritar"}</button>
              <button type="button" class="btn-sec" data-alerta="${p.id}"><i class="bi ${alerta ? "bi-bell-fill" : "bi-bell"}"></i> ${alerta ? "Alerta ativo" : "Alerta de preço"}</button>`}
          </div>
          ${proprio ? `<div class="campo" style="margin-top:14px"><label for="culturaProprio">Cultura do anúncio (filtro do catálogo)</label>
            <select id="culturaProprio"><option value="">Não se aplica</option>${Object.entries(CULTURAS).map(([k, n]) => `<option value="${k}" ${p.cultura === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>` : ""}
          <div class="mr-vendedor">
            <strong><i class="bi bi-person-badge"></i> ${esc(v.nome)}</strong> ${estrelas(v.nota, v.total_avaliacoes)}
            <p class="mr-ajuda">${esc(v.cidade || "")}${v.membro_desde ? " · no MarketPlace desde " + MR.data(v.membro_desde) : ""} · ${v.vendas_concluidas} venda(s) entregue(s)</p>
            ${v.avaliacoes.map((a) => `<blockquote>${"★".repeat(a.nota)} — ${esc(a.comentario || "sem comentário")} <br><small>${esc(a.avaliador)}, ${MR.data(a.data_avaliacao)}</small></blockquote>`).join("")}
          </div>
        </div>
      </div>`;
  }

  function gestorFotos(p) {
    return `<div class="mr-card" style="padding:14px">
      <strong>Fotos do anúncio (${p.fotos.length}/8)</strong>
      <p class="mr-ajuda">A primeira é a capa. JPG, PNG ou WEBP de até 3 MB.</p>
      <div class="mr-gestor-fotos" style="margin:10px 0">
        ${p.fotos.map((f, i) => `<figure class="${i === 0 ? "capa" : ""}"><img src="${esc(img(f.url))}" alt="">
          <figcaption>${i ? `<button type="button" data-capa="${f.id}" title="Usar como capa" aria-label="Usar como capa"><i class="bi bi-star"></i></button>` : "<span></span>"}
          <button type="button" data-remover-foto="${f.id}" title="Remover" aria-label="Remover foto"><i class="bi bi-trash"></i></button></figcaption></figure>`).join("")}
      </div>
      ${p.fotos.length < 8 ? `<label class="btn-sec" style="cursor:pointer"><i class="bi bi-images"></i> Adicionar fotos<input type="file" id="novasFotos" accept="image/jpeg,image/png,image/webp" multiple hidden></label>` : ""}
    </div>`;
  }

  async function fotosAcao(dados) {
    const fd = new FormData();
    fd.set("id", st.detalhe.produto.id);
    Object.entries(dados).forEach(([k, v]) => Array.isArray(v) ? v.forEach((x) => fd.append(k, x)) : fd.set(k, v));
    try {
      const r = await MR.api("produtos/fotos.php", { form: fd });
      st.detalhe.produto.fotos = r.fotos;
      st.foto = 0;
      renderDetalhe();
      MR.toast(r.mensagem);
      carregar();
    } catch (e) {
      MR.toast(e.message, "erro");
    }
  }

  async function salvarCultura(cultura) {
    const p = st.detalhe.produto;
    const fd = new FormData();
    Object.entries({ id: p.id, nome: p.nome, categoria: p.categoria, preco: p.preco, estoque: p.estoque, descricao: p.descricao, cultura }).forEach(([k, v]) => fd.set(k, v ?? ""));
    try {
      await MR.api("produtos/editar.php", { form: fd });
      p.cultura = cultura || null;
      MR.toast("Cultura do anúncio atualizada.");
      carregar();
    } catch (e) {
      MR.toast(e.message, "erro");
    }
  }

  /* ── Favoritos, pedido e alerta ──────────────────────────── */
  async function favoritar(id) {
    const ativo = st.favoritos.has(id);
    try {
      await MR.api("favoritos/atualizar.php", { form: { acao: ativo ? "remover" : "adicionar", anuncio_id: id } });
      ativo ? st.favoritos.delete(id) : st.favoritos.add(id);
      if (st.detalhe?.produto.id === id) { st.detalhe.favorito = !ativo; renderDetalhe(); }
      renderizar();
      MR.toast(ativo ? "Removido dos favoritos." : "Adicionado aos favoritos.");
    } catch (e) {
      MR.toast(e.message, "erro");
    }
  }

  function abrirPedido(id) {
    const p = st.detalhe?.produto.id === id ? st.detalhe.produto : st.produtos.find((x) => x.id === id);
    const f = $("#formPedido");
    f.anuncio_id.value = id;
    f.quantidade.max = p.estoque;
    f.quantidade.value = 1;
    $("#pedidoNome").textContent = p.nome;
    $("#pedidoInfo").textContent = `${moeda(p.preco)} por unidade · ${num(p.estoque)} disponível(is) · vendedor: ${p.vendedor_nome}`;
    const total = () => { $("#pedidoTotal").textContent = moeda(p.preco * Math.max(1, Number(f.quantidade.value) || 1)); };
    f.quantidade.oninput = total;
    total();
    MR.modal.abrir("modalPedido");
  }

  function abrirAlerta(id) {
    const f = $("#formAlerta");
    f.reset();
    f.anuncio_id.value = id || "";
    $("#campoTermo").classList.toggle("hidden", Boolean(id));
    if (id) {
      const p = st.detalhe.produto;
      $("#alertaInfo").textContent = `${p.nome}: preço atual ${moeda(p.preco)}. Você recebe uma notificação quando o vendedor mudar o preço.`;
      f.preco_alvo.value = (p.preco * 0.95).toFixed(2);
    } else {
      $("#alertaInfo").textContent = "Vale para qualquer anúncio novo ou alterado com esse nome ou cultura.";
      f.termo.value = $("#formFiltros").busca.value || CULTURAS[$("#formFiltros").cultura.value] || "";
    }
    atualizarCondicao();
    MR.modal.abrir("modalAlerta");
  }

  async function carregarMeusAlertas() {
    const lista = $("#listaMeusAlertas");
    lista.innerHTML = '<li><span class="mr-ajuda">Carregando…</span></li>';
    try {
      const d = await MR.api("mercado/alertas.php");
      lista.innerHTML = d.alertas.length ? d.alertas.map((a) => {
        const alvo = a.anuncio_id ? esc(a.anuncio_titulo || "Anúncio removido") : `"${esc(a.categoria_produto)}"`;
        const regra = a.condicao === "variacao" ? `variar ${num(a.variacao_percentual)}% ou mais` : `${a.condicao === "abaixo" ? "ficar até" : "passar de"} ${moeda(a.preco_alvo)}`;
        return `<li class="${a.ativo == 1 ? "" : "lida"}"><i class="bi ${a.ativo == 1 ? "bi-bell-fill" : "bi-bell-slash"}"></i>
          <div><strong>${alvo}</strong><small>Avisar quando o preço ${regra}${a.preco_atual ? " · agora: " + moeda(a.preco_atual) : ""}</small></div>
          <div class="mr-acoes">
            ${a.anuncio_id ? `<a class="btn-icone" href="catalogo.html?produto=${a.anuncio_id}" aria-label="Ver produto"><i class="bi bi-box-arrow-up-right"></i></a>` : ""}
            <button type="button" class="btn-icone" data-alerta-acao="alternar" data-id="${a.id}" aria-label="${a.ativo == 1 ? "Pausar" : "Ativar"}"><i class="bi ${a.ativo == 1 ? "bi-pause" : "bi-play"}"></i></button>
            <button type="button" class="btn-icone perigo" data-alerta-acao="excluir" data-id="${a.id}" aria-label="Excluir"><i class="bi bi-trash"></i></button>
          </div></li>`;
      }).join("") : '<li><div class="mr-vazio"><i class="bi bi-bell"></i>Nenhum alerta ainda.</div></li>';
    } catch (e) {
      lista.innerHTML = "";
      MR.toast(e.message, "erro");
    }
  }

  function atualizarCondicao() {
    const variacao = $("#formAlerta").condicao.value === "variacao";
    $("#campoVariacao").classList.toggle("hidden", !variacao);
    $("#campoAlvo").classList.toggle("hidden", variacao);
  }

  /* ── Eventos ─────────────────────────────────────────────── */
  document.addEventListener("click", (e) => {
    const alvo = e.target.closest("[data-fav],[data-pedido],[data-alerta],[data-alerta-busca],[data-foto],[data-ir-foto],[data-capa],[data-remover-foto],[data-abrir]");
    if (!alvo) return;
    const d = alvo.dataset;
    if (d.fav) { e.stopPropagation(); return favoritar(Number(d.fav)); }
    if (d.pedido) return abrirPedido(Number(d.pedido));
    if (d.alerta) return abrirAlerta(Number(d.alerta));
    if (d.alertaBusca !== undefined) return abrirAlerta(null);
    if (d.foto) { const n = st.detalhe.produto.fotos.length; st.foto = (st.foto + Number(d.foto) + n) % n; return renderDetalhe(); }
    if (d.irFoto) { st.foto = Number(d.irFoto); return renderDetalhe(); }
    if (d.capa) return fotosAcao({ acao: "principal", foto_id: d.capa });
    if (d.removerFoto) return MR.confirmar("Remover esta foto do anúncio?", "Remover").then((ok) => ok && fotosAcao({ acao: "remover", foto_id: d.removerFoto }));
    if (d.abrir) return abrirDetalhe(Number(d.abrir));
  });

  document.addEventListener("keydown", (e) => {
    const card = e.target.closest?.("[data-abrir]");
    if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrirDetalhe(Number(card.dataset.abrir)); }
    if (document.getElementById("modalProduto").classList.contains("ativo") && st.detalhe?.produto.fotos.length > 1 && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
      const n = st.detalhe.produto.fotos.length;
      st.foto = (st.foto + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
      renderDetalhe();
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id === "novasFotos" && e.target.files.length) fotosAcao({ acao: "adicionar", "imagens[]": [...e.target.files] });
    if (e.target.id === "culturaProprio") salvarCultura(e.target.value);
  });

  async function iniciar() {
    st.usuario = await MR.sessao();
    $("#filtroCultura").innerHTML += Object.entries(CULTURAS).map(([k, n]) => `<option value="${k}">${n}</option>`).join("");

    const params = new URLSearchParams(location.search);
    const form = $("#formFiltros");
    ["busca", "categoria", "cultura", "localizacao", "preco_min", "preco_max", "ordenar"].forEach((k) => { if (params.get(k)) form.elements[k].value = params.get(k); });

    try {
      st.favoritos = new Set((await MR.api("favoritos/listar.php")).produtos.map((p) => p.id));
    } catch (e) { /* segue sem favoritos */ }

    let espera;
    form.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(carregar, 400); });
    form.addEventListener("submit", (e) => { e.preventDefault(); carregar(); });
    $("#btnLimparFiltros").addEventListener("click", () => { form.reset(); carregar(); });
    $("#btnMeusAlertas").addEventListener("click", () => { carregarMeusAlertas(); MR.modal.abrir("modalMeusAlertas"); });
    $("#listaMeusAlertas").addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-alerta-acao]");
      if (!b) return;
      if (b.dataset.alertaAcao === "excluir" && !(await MR.confirmar("Excluir este alerta de preço?", "Excluir"))) return;
      try {
        await MR.api("mercado/alertas.php", { json: { acao: b.dataset.alertaAcao, id: b.dataset.id } });
        carregarMeusAlertas();
      } catch (er) {
        MR.toast(er.message, "erro");
      }
    });
    $("#formAlerta").condicao.addEventListener("change", atualizarCondicao);

    $("#formPedido").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const r = await MR.api("pedidos/criar.php", { form: new FormData(e.target) });
        MR.modal.fechar("modalPedido");
        MR.modal.fechar("modalProduto");
        MR.toast((r.mensagem || "Pedido realizado!") + " Acompanhe em Pedidos.");
        carregar();
      } catch (er) {
        MR.toast(er.message, "erro");
      }
    });

    $("#formAlerta").addEventListener("submit", async (e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(e.target));
      try {
        const r = await MR.api("mercado/alertas.php", { json: { acao: "salvar", ...dados } });
        MR.modal.fechar("modalAlerta");
        MR.toast(r.mensagem);
        if (dados.anuncio_id && st.detalhe) { st.detalhe.alerta = { id: r.id }; renderDetalhe(); }
      } catch (er) {
        MR.toast(er.message, "erro");
      }
    });

    await carregar();
    if (params.get("produto")) abrirDetalhe(Number(params.get("produto")));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
