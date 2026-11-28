/* =============================================================
   HISTORICO.JS — Histórico completo de compras e vendas,
   avaliações (reputação) e exportação. Requer modulos.js e exportar.js.
   ============================================================= */

(() => {
  const CHART = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
  const STATUS = { recebido: ["Recebido", "info"], negociacao: ["Em negociação", "alerta"], preparo: ["Em preparo", "terra"], entregue: ["Entregue", "ok"], cancelado: ["Cancelado", "erro"] };
  const { esc, moeda, num } = MR;
  const $ = (s) => document.querySelector(s);
  let grafico = null;
  let pedidos = [];

  const estrelas = (n) => `<span class="mr-estrelas">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`;

  async function carregar() {
    const params = new URLSearchParams({ papel: $("#hPapel").value, status: $("#hStatus").value, de: $("#hDe").value, ate: $("#hAte").value });
    [...params.keys()].forEach((k) => { if (!params.get(k)) params.delete(k); });
    try {
      const d = await MR.api("pedidos/historico.php?" + params);
      pedidos = d.pedidos;
      const t = d.totais;
      const pendentes = d.pedidos.filter((p) => p.pode_avaliar).length;
      $("#resumoHistorico").innerHTML = `
        <div class="mr-kpi"><span>Compras</span><strong>${moeda(t.compras.valor)}</strong><small>${t.compras.pedidos} pedido(s) não cancelado(s)</small></div>
        <div class="mr-kpi positivo"><span>Vendas</span><strong>${moeda(t.vendas.valor)}</strong><small>${t.vendas.pedidos} pedido(s) não cancelado(s)</small></div>
        <div class="mr-kpi"><span>Pedidos listados</span><strong>${d.pedidos.length}</strong></div>
        <div class="mr-kpi ${pendentes ? "negativo" : ""}"><span>Avaliações pendentes</span><strong>${pendentes}</strong><small>Pedidos entregues sem a sua nota</small></div>`;

      $("#tabelaHistorico").innerHTML = d.pedidos.length ? d.pedidos.map((p) => {
        const [rotulo, cls] = STATUS[p.status] || [p.status, ""];
        const venda = p.papel === "vendedor";
        return `<tr>
          <td><strong>#${p.id}</strong></td>
          <td>${MR.dataHora(p.data)}</td>
          <td><span class="mr-tag ${venda ? "ok" : "info"}"><i class="bi ${venda ? "bi-arrow-up-right" : "bi-arrow-down-left"}"></i> ${venda ? "Venda" : "Compra"}</span></td>
          <td>${esc(p.contraparte)}</td>
          <td><small>${p.itens.map((i) => `${num(i.quantidade)}× ${esc(i.nome)} (${moeda(i.preco_unitario)})`).join("<br>")}</small></td>
          <td class="num"><strong>${moeda(p.total)}</strong></td>
          <td><span class="mr-tag ${cls}">${rotulo}</span></td>
          <td>${p.minha_nota ? `Sua nota: ${estrelas(p.minha_nota)}` : p.pode_avaliar ? `<button type="button" class="btn-sec" data-avaliar="${p.id}"><i class="bi bi-star"></i> Avaliar</button>` : '<span class="mr-ajuda">Após a entrega</span>'}
            ${p.nota_recebida ? `<br><small class="mr-ajuda">Recebeu: ${estrelas(p.nota_recebida)}</small>` : ""}</td>
        </tr>`;
      }).join("") : `<tr><td colspan="8"><div class="mr-vazio"><i class="bi bi-receipt"></i>Nenhum pedido encontrado. <a href="catalogo.html">Explore o catálogo</a>.</div></td></tr>`;

      await MR.carregarScript(CHART).catch(() => null);
      if (window.Chart) {
        const meses = d.por_mes;
        grafico?.destroy();
        grafico = new Chart($("#graficoHistorico"), {
          type: "bar",
          data: {
            labels: meses.map((m) => m.mes.split("-").reverse().join("/")),
            datasets: [
              { label: "Compras", data: meses.map((m) => m.compras), backgroundColor: "#2f5f8a", borderRadius: 6 },
              { label: "Vendas", data: meses.map((m) => m.vendas), backgroundColor: "#90a955", borderRadius: 6 },
            ],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${moeda(c.parsed.y)}` } } } },
        });
      }
    } catch (e) {
      MR.toast(e.message, "erro");
    }
  }

  function abrirAvaliacao(id) {
    const p = pedidos.find((x) => x.id === id);
    const f = $("#formAvaliar");
    f.reset();
    f.pedido_id.value = id;
    f.nota.value = "";
    marcarNota(0);
    $("#avaliarTitulo").textContent = `Avaliar ${p.papel === "vendedor" ? "o comprador" : "o vendedor"}`;
    $("#avaliarInfo").textContent = `Pedido #${p.id} com ${p.contraparte} — ${moeda(p.total)}. A nota entra na reputação pública dele.`;
    MR.modal.abrir("modalAvaliar");
  }

  function marcarNota(n) {
    document.querySelectorAll("#seletorNota button").forEach((b) => {
      b.classList.toggle("on", Number(b.dataset.nota) <= n);
      b.setAttribute("aria-pressed", String(Number(b.dataset.nota) === n));
    });
  }

  async function abrirReputacao() {
    try {
      const d = await MR.api("avaliacoes/listar.php");
      const max = Math.max(1, ...Object.values(d.distribuicao));
      $("#conteudoReputacao").innerHTML = `
        <div class="mr-kpis"><div class="mr-kpi"><span>Nota média</span><strong>${d.nota === null ? "—" : num(d.nota, 1) + " ★"}</strong><small>${d.total} avaliação(ões)</small></div></div>
        <div class="mr-ranking" style="margin:16px 0">${[5, 4, 3, 2, 1].map((n) => `
          <div class="mr-ranking-item"><b>${n}★</b><div class="mr-barra-prog"><span style="width:${d.distribuicao[n] / max * 100}%"></span></div><strong>${d.distribuicao[n]}</strong></div>`).join("")}</div>
        <ul class="mr-lista">${d.avaliacoes.length ? d.avaliacoes.map((a) => `<li><i class="bi bi-chat-quote"></i><div><strong>${estrelas(a.nota)} ${esc(a.avaliador)}</strong><small>${esc(a.comentario || "Sem comentário")} · pedido #${a.pedido_id} · ${MR.data(a.data_avaliacao)}</small></div></li>`).join("") : `<li><div class="mr-vazio">Você ainda não recebeu avaliações.</div></li>`}</ul>`;
      MR.modal.abrir("modalReputacao");
    } catch (e) {
      MR.toast(e.message, "erro");
    }
  }

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.avaliar) abrirAvaliacao(Number(b.dataset.avaliar));
    if (b.dataset.nota) { $("#formAvaliar").nota.value = b.dataset.nota; marcarNota(Number(b.dataset.nota)); }
    if (b.dataset.exportar) {
      const papel = $("#hPapel").value;
      const tipos = papel ? [papel] : ["compras", "vendas"];
      for (const t of tipos) await MR.exportar(t, { de: $("#hDe").value, ate: $("#hAte").value }, b.dataset.exportar);
    }
  });

  async function iniciar() {
    ["#hPapel", "#hStatus", "#hDe", "#hAte"].forEach((s) => $(s).addEventListener("change", carregar));
    $("#btnReputacao").addEventListener("click", abrirReputacao);
    $("#formAvaliar").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!e.target.nota.value) return MR.toast("Escolha de 1 a 5 estrelas.", "aviso");
      try {
        const r = await MR.api("avaliacoes/avaliar.php", { form: new FormData(e.target) });
        MR.modal.fechar("modalAvaliar");
        MR.toast(r.mensagem);
        carregar();
      } catch (er) {
        MR.toast(er.message, "erro");
      }
    });
    carregar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
