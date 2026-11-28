/* =============================================================
   MERCADO.JS — Inteligência de Mercado e alertas de preço.
   Backend: mercado/indicadores.php e mercado/alertas.php. Requer modulos.js.
   ============================================================= */

(() => {
  const CHART = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
  const PALETA = ["#4f772d", "#c49a6c", "#2f5f8a", "#90a955", "#d68910", "#7a5230", "#8e44ad", "#16a085"];
  const { esc, moeda, num } = MR;
  const $ = (s) => document.querySelector(s);
  let grafico = null;
  let primeiraCarga = true;

  function tendencia(c) {
    if (c.variacao_30d === null) return '<span class="mr-tag">sem histórico</span>';
    const seta = c.variacao_30d > 0 ? "bi-arrow-up-right" : c.variacao_30d < 0 ? "bi-arrow-down-right" : "bi-dash";
    return `<span class="${c.variacao_30d > 0 ? "mr-alta" : c.variacao_30d < 0 ? "mr-baixa" : ""}"><i class="bi ${seta}"></i> ${num(c.variacao_30d, 1)}%</span>`;
  }

  function ranking(el, itens, valor, rotulo) {
    if (!itens.length) { el.innerHTML = '<div class="mr-vazio"><i class="bi bi-bar-chart"></i>Ainda sem dados suficientes.</div>'; return; }
    const max = Math.max(...itens.map(valor)) || 1;
    el.innerHTML = itens.map((x, i) => `
      <div class="mr-ranking-item"><b>${i + 1}º</b>
        <div><strong>${esc(x.produto || x.termo)}</strong>${x.faturamento !== undefined ? ` <small>${moeda(x.faturamento)} · ${x.pedidos} pedido(s)</small>` : ""}
          <div class="mr-barra-prog"><span style="width:${valor(x) / max * 100}%"></span></div></div>
        <strong>${rotulo(x)}</strong></div>`).join("");
  }

  async function carregar() {
    const params = new URLSearchParams({ produto: $("#mProduto").value, regiao: $("#mRegiao").value, meses: $("#mMeses").value });
    [...params.keys()].forEach((k) => { if (!params.get(k)) params.delete(k); });
    try {
      const d = await MR.api("mercado/indicadores.php?" + params);

      if (primeiraCarga) {
        $("#mProduto").innerHTML = '<option value="">Todos</option>' + d.precos.map((p) => `<option value="${esc(p.chave)}">${esc(p.produto)}</option>`).join("");
        $("#mRegiao").innerHTML = '<option value="">Todas as regiões</option>' + d.lista_regioes.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
        primeiraCarga = false;
      }

      $("#tabelaPrecos").innerHTML = d.precos.length ? d.precos.map((p) => `<tr>
        <td><strong>${esc(p.produto)}</strong>${p.unidade ? ` <small class="mr-ajuda">/ ${esc(p.unidade)}</small>` : ""}</td>
        <td class="num">${p.anuncios}</td>
        <td class="num"><strong>${moeda(p.preco_medio)}</strong></td>
        <td class="num mr-baixa">${moeda(p.menor_preco)}</td><td><small>${esc(p.onde_menor || "—")}</small></td>
        <td class="num mr-alta">${moeda(p.maior_preco)}</td><td><small>${esc(p.onde_maior || "—")}</small></td>
        <td class="num">${tendencia(p)}</td>
        <td class="acoes"><a class="btn-icone" href="catalogo.html?${/^(hortalicas|frutas|graos|laticinios|carnes|flores)$/.test(p.chave) ? "categoria" : "cultura"}=${encodeURIComponent(p.chave)}&ordenar=menor_preco" aria-label="Ver anúncios"><i class="bi bi-shop"></i></a></td>
      </tr>`).join("") : '<tr><td colspan="9"><div class="mr-vazio">Nenhum anúncio ativo.</div></td></tr>';

      const produto = $("#mProduto").selectedOptions[0]?.textContent;
      $("#rotuloRegioes").textContent = $("#mProduto").value ? produto : "escolha um produto";
      $("#tabelaRegioes").innerHTML = !$("#mProduto").value
        ? '<tr><td colspan="5"><div class="mr-vazio"><i class="bi bi-hand-index"></i>Escolha um produto acima para comparar as regiões.</div></td></tr>'
        : d.regioes.map((r, i) => `<tr><td>${esc(r.regiao)} ${i === 0 && d.regioes.length > 1 ? '<span class="mr-tag ok">mais barato</span>' : ""}</td><td class="num">${r.anuncios}</td><td class="num">${moeda(r.preco_medio)}</td><td class="num">${moeda(r.menor_preco)}</td><td class="num">${moeda(r.maior_preco)}</td></tr>`).join("");

      ranking($("#rankingPesquisados"), d.pesquisados, (x) => x.buscas, (x) => `${x.buscas} busca(s)`);
      ranking($("#rankingVendidos"), d.vendidos, (x) => x.quantidade, (x) => `${num(x.quantidade)} un.`);

      await MR.carregarScript(CHART).catch(() => null);
      if (window.Chart) {
        const meses = [...new Set(Object.values(d.historico).flatMap((s) => s.pontos.map((p) => p.mes)))].sort();
        grafico?.destroy();
        grafico = new Chart($("#graficoPrecos"), {
          type: "line",
          data: {
            labels: meses.map((m) => m.split("-").reverse().join("/")),
            datasets: Object.values(d.historico).map((s, i) => ({
              label: s.produto,
              data: meses.map((m) => s.pontos.find((p) => p.mes === m)?.media ?? null),
              borderColor: PALETA[i % PALETA.length], backgroundColor: PALETA[i % PALETA.length], tension: .3, spanGaps: true,
            })),
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${moeda(c.parsed.y)}` } } },
            scales: { y: { ticks: { callback: (v) => moeda(v) } } },
          },
        });
      }
    } catch (e) {
      MR.toast(e.message, "erro");
    }
  }

  async function carregarAlertas() {
    try {
      const d = await MR.api("mercado/alertas.php");
      $("#listaAlertas").innerHTML = d.alertas.length ? d.alertas.map((a) => {
        const alvo = a.anuncio_id ? esc(a.anuncio_titulo || "Anúncio removido") : `"${esc(a.categoria_produto)}"`;
        const regra = a.condicao === "variacao" ? `variar ${num(a.variacao_percentual)}% ou mais` : `${a.condicao === "abaixo" ? "ficar até" : "passar de"} ${moeda(a.preco_alvo)}`;
        return `<li class="${a.ativo == 1 ? "" : "lida"}"><i class="bi ${a.ativo == 1 ? "bi-bell-fill" : "bi-bell-slash"}"></i>
          <div><strong>${alvo}</strong><small>Avisar quando o preço ${regra}${a.preco_atual ? " · agora: " + moeda(a.preco_atual) : ""}${a.ultimo_disparo ? " · último aviso " + MR.dataHora(a.ultimo_disparo) : ""}</small></div>
          <div class="mr-acoes">
            ${a.anuncio_id ? `<a class="btn-icone" href="catalogo.html?produto=${a.anuncio_id}" aria-label="Ver produto"><i class="bi bi-box-arrow-up-right"></i></a>` : ""}
            <button type="button" class="btn-icone" data-alternar="${a.id}" aria-label="${a.ativo == 1 ? "Pausar" : "Ativar"}"><i class="bi ${a.ativo == 1 ? "bi-pause" : "bi-play"}"></i></button>
            <button type="button" class="btn-icone perigo" data-excluir="${a.id}" aria-label="Excluir"><i class="bi bi-trash"></i></button>
          </div></li>`;
      }).join("") : '<li><div class="mr-vazio"><i class="bi bi-bell"></i>Nenhum alerta. Abra um produto no catálogo e clique em "Alerta de preço".</div></li>';
    } catch (e) {
      MR.toast(e.message, "erro");
    }
  }

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const acao = b.dataset.alternar ? "alternar" : b.dataset.excluir ? "excluir" : null;
    if (!acao) return;
    if (acao === "excluir" && !(await MR.confirmar("Excluir este alerta de preço?", "Excluir"))) return;
    try {
      await MR.api("mercado/alertas.php", { json: { acao, id: b.dataset.alternar || b.dataset.excluir } });
      carregarAlertas();
    } catch (er) {
      MR.toast(er.message, "erro");
    }
  });

  async function iniciar() {
    // Inteligência de Mercado: só produtores (o backend também bloqueia).
    try {
      const u = await MR.sessao();
      if (!["produtor", "admin"].includes(u.tipo_acesso)) {
        document.querySelector("main.conteudo").innerHTML = `
          <section class="page-header"><div><h1>Inteligência de mercado</h1>
          <p>Esta área é exclusiva para produtores. Seus alertas de preço ficam no catálogo, em "Meus alertas".</p></div>
          <a class="btn-principal" href="catalogo.html"><i class="bi bi-shop"></i> Ir para o catálogo</a></section>`;
        return;
      }
    } catch (e) { return; }

    ["#mProduto", "#mRegiao", "#mMeses"].forEach((s) => $(s).addEventListener("change", carregar));
    $("#btnAtualizarMercado").addEventListener("click", () => { carregar(); carregarAlertas(); });
    carregar();
    carregarAlertas();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
