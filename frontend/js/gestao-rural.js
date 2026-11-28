/* =============================================================
   GESTAO-RURAL.JS — Gestão da Fazenda, Safras, Diário de Campo,
   Agenda, Financeiro, Documentos, Silos (IoT), Dashboard e Relatórios.
   Backend: backend/gestao/*.php e backend/relatorios/gerar.php.
   Requer modulos.js e exportar.js.
   ============================================================= */

(() => {
  const CHART = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
  const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  const CHAVE_PENDENTES = "mr:diarioPendentes";
  const CHAVE_BASE = "mr:gestaoBase";

  const TIPOS_OPERACAO = { plantio: "Plantio", pulverizacao: "Pulverização", adubacao: "Adubação", irrigacao: "Irrigação", colheita: "Colheita", preparo_solo: "Preparo do solo", outro: "Outra" };
  const ICONES_OPERACAO = { plantio: "bi-flower1", pulverizacao: "bi-droplet-half", adubacao: "bi-basket", irrigacao: "bi-water", colheita: "bi-truck", preparo_solo: "bi-tools", outro: "bi-three-dots" };
  const TIPOS_AGENDA = { atividade: "Atividade de campo", manejo: "Manejo agrícola", licenca: "Licença", contrato: "Contrato", documento: "Documento", pagamento: "Pagamento", outros: "Outro" };
  const ICONES_AGENDA = { atividade: "bi-person-workspace", manejo: "bi-flower2", licenca: "bi-patch-check", contrato: "bi-file-earmark-text", documento: "bi-file-earmark", pagamento: "bi-cash", outros: "bi-calendar" };
  const TIPOS_DOCUMENTO = { nota_fiscal: "Nota fiscal", receita_agronomica: "Receita agronômica", contrato: "Contrato", laudo_solo: "Laudo de análise de solo", licenca: "Licença / autorização", outro: "Outro" };
  const STATUS_SAFRA = { em_andamento: ["Em andamento", "ok"], concluida: ["Concluída", "info"], cancelada: ["Cancelada", "erro"] };
  const UNIDADES = { saca: "sc", tonelada: "t", kg: "kg", caixa: "cx", litro: "L" };

  const st = {
    fazendas: [], talhoes: [], safras: [], culturas: {}, categorias: { despesa: {}, receita: {} },
    filtroFazenda: "", aba: "dashboard", recursos: [], graficos: {}, operacoes: [], lancamentos: [], documentos: [], silos: [], eventos: [],
    pastaDocs: {}, mapa: null, mapaDesenho: null, desenho: [], camadaDesenho: null,
  };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const { esc, moeda, num, data } = MR;
  const qs = (obj) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== "" && v !== null && v !== undefined)).toString();
  const nomeCultura = (c) => st.culturas[c] || c || "—";
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  }));
  const vazio = (texto, icone = "bi-inbox") => `<div class="mr-vazio"><i class="bi ${icone}"></i>${texto}</div>`;
  const linhaVazia = (colunas, texto) => `<tr><td colspan="${colunas}">${vazio(texto)}</td></tr>`;

  /* ── Gráficos ───────────────────────────────────────────── */
  function cores() {
    const css = getComputedStyle(document.body);
    return {
      texto: css.getPropertyValue("--mp-suave").trim() || "#5b6657",
      linha: css.getPropertyValue("--mp-linha").trim() || "#e8dfcf",
      verde: "#4f772d", claro: "#90a955", terra: "#c49a6c", erro: "#c0392b", info: "#2f5f8a", trigo: "#d9b979",
      paleta: ["#4f772d", "#c49a6c", "#2f5f8a", "#90a955", "#d68910", "#7a5230", "#8e44ad", "#16a085", "#c0392b", "#7f8c8d"],
    };
  }

  async function grafico(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    try { await MR.carregarScript(CHART); } catch (e) { canvas.parentElement.innerHTML = vazio("Gráficos indisponíveis sem internet.", "bi-wifi-off"); return; }
    const c = cores();
    Chart.defaults.color = c.texto;
    Chart.defaults.borderColor = c.linha;
    Chart.defaults.font.family = "Inter, Arial, sans-serif";
    st.graficos[id]?.destroy();
    config.options = Object.assign({ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } }, config.options || {});
    st.graficos[id] = new Chart(canvas, config);
  }
  const eixoMoeda = { ticks: { callback: (v) => "R$ " + Number(v).toLocaleString("pt-BR", { notation: "compact" }) } };
  const tooltipMoeda = { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${moeda(ctx.parsed.y ?? ctx.parsed)}` } };

  document.addEventListener("mr:tema", () => { if (Object.keys(st.graficos).length && liberada(st.aba)) renderizarAba(st.aba, true); });

  /* ── Listas dos selects ─────────────────────────────────── */
  function opcoes(lista) {
    switch (lista) {
      case "fazendas": return st.fazendas.map((f) => [f.id, f.nome]);
      case "talhoes": return st.talhoes.map((t) => [t.id, `${t.nome}${st.fazendas.length > 1 ? " — " + t.fazenda_nome : ""} (${num(t.area_ha)} ha)`]);
      case "safras": return st.safras.map((s) => [s.id, `${s.nome}${s.status === "em_andamento" ? " (atual)" : ""}`]);
      case "culturas": return Object.entries(st.culturas);
      case "tiposOperacao": return Object.entries(TIPOS_OPERACAO);
      case "tiposAgenda": return Object.entries(TIPOS_AGENDA);
      case "tiposDocumento": return Object.entries(TIPOS_DOCUMENTO);
      default: return [];
    }
  }

  function preencherSelect(select, itens, rotuloVazio) {
    const atual = select.value;
    select.innerHTML = (rotuloVazio !== undefined ? `<option value="">${esc(rotuloVazio)}</option>` : "")
      + itens.map(([v, r]) => `<option value="${esc(v)}">${esc(r)}</option>`).join("");
    if ([...select.options].some((o) => o.value === atual)) select.value = atual;
  }

  function preencherListas(raiz = document) {
    $$("select[data-lista]", raiz).forEach((s) => preencherSelect(s, opcoes(s.dataset.lista), s.dataset.vazio ?? (s.required ? undefined : "")));
  }

  function preencherForm(form, dados) {
    form.reset();
    preencherListas(form);
    Object.entries(dados || {}).forEach(([k, v]) => {
      const campo = form.elements[k];
      if (!campo || campo.type === "file") return;
      if (k === "coordenadas") { campo.value = v ? JSON.stringify(v) : ""; return; }
      campo.value = v === null || v === undefined ? "" : (k === "hora_evento" ? String(v).slice(0, 5) : v);
    });
  }

  function lerForm(form) {
    const d = {};
    new FormData(form).forEach((v, k) => { if (!(v instanceof File)) d[k] = typeof v === "string" ? v.trim() : v; });
    return d;
  }

  /* ── Dados básicos (propriedades, talhões, safras) ──────── */
  async function carregarBase() {
    const filtro = st.filtroFazenda ? "?fazenda_id=" + st.filtroFazenda : "";
    try {
      const [f, t, s] = await Promise.all([
        MR.api("gestao/fazendas.php"),
        MR.api("gestao/talhoes.php" + filtro),
        MR.api("gestao/safras.php" + filtro),
      ]);
      st.fazendas = f.fazendas;
      st.talhoes = t.talhoes;
      st.safras = s.safras;
      st.culturas = t.culturas;
      try { localStorage.setItem(CHAVE_BASE, JSON.stringify({ fazendas: st.fazendas, talhoes: st.talhoes, safras: st.safras, culturas: st.culturas })); } catch (e) { /* cheio */ }
    } catch (erro) {
      if (!erro.offline) throw erro;
      const cache = JSON.parse(localStorage.getItem(CHAVE_BASE) || "null");
      if (!cache) throw erro;
      Object.assign(st, cache);
      MR.toast("Sem internet: usando os dados salvos neste aparelho.", "aviso");
    }

    const filtroSel = $("#filtroFazenda");
    preencherSelect(filtroSel, st.fazendas.map((f) => [f.id, f.nome]), "Todas as propriedades");
    filtroSel.value = st.filtroFazenda;
    preencherSelect($("#diarioTalhao"), opcoes("talhoes"), "Todos");
    preencherSelect($("#finTalhao"), opcoes("talhoes"), "Todos");
    preencherSelect($("#finSafra"), opcoes("safras"), "Todas");
    preencherSelect($("#relSafra"), opcoes("safras"), "Todas");
    preencherSelect($("#diarioTipo"), Object.entries(TIPOS_OPERACAO), "Todas");
    preencherSelect($("#agendaTipo"), Object.entries(TIPOS_AGENDA), "Todos");
    preencherSelect($("#docTipo"), Object.entries(TIPOS_DOCUMENTO), "Todos");
  }

  /* ── Abas ───────────────────────────────────────────────── */
  // Abas que dependem do plano (mesmo mapa de RECURSOS_POR_PLANO no backend). As outras usam "gestao".
  const RECURSO_ABA = { dashboard: "dashboard_gestao", documentos: "documentos", silos: "silos", relatorios: "relatorios" };
  const NOME_ABA = { dashboard: "Dashboard da gestão", documentos: "Documentos", silos: "Silos, bags e reservatórios", relatorios: "Relatórios em PDF e Excel" };
  const liberada = (aba) => st.recursos.includes(RECURSO_ABA[aba] || "gestao");

  function mostrarAba(aba, atualizarHash = true) {
    if (!document.getElementById("aba-" + aba) || aba === "bloqueada") aba = liberada("dashboard") ? "dashboard" : "propriedades";
    st.aba = aba;
    $$(".mr-abas button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.aba === aba)));
    const ok = liberada(aba);
    $$(".mr-painel").forEach((p) => { p.hidden = p.id !== (ok ? "aba-" + aba : "aba-bloqueada"); });
    if (atualizarHash) history.replaceState(null, "", location.pathname + "#" + aba);
    if (!ok) {
      $("#bloqueadaTitulo").textContent = `${NOME_ABA[aba]} — Plano Pro`;
      $("#bloqueadaTexto").textContent = `Você está no Plano Essencial. ${NOME_ABA[aba]} e as outras funções abaixo vêm no Plano Pro.`;
      return;
    }
    renderizarAba(aba);
  }

  async function renderizarAba(aba, soGraficos = false) {
    try {
      switch (aba) {
        case "dashboard": return await abaDashboard();
        case "propriedades": return soGraficos ? null : await abaPropriedades();
        case "safras": return abaSafras();
        case "diario": return soGraficos ? null : await abaDiario();
        case "agenda": return soGraficos ? null : await abaAgenda();
        case "financeiro": return await abaFinanceiro();
        case "documentos": return soGraficos ? null : await abaDocumentos();
        case "silos": return soGraficos ? null : await abaSilos();
        case "relatorios": return abaRelatorios();
      }
    } catch (erro) {
      MR.toast(erro.offline ? "Sem internet. Esta parte precisa de conexão." : erro.message, erro.offline ? "aviso" : "erro");
    }
  }

  /* ═══════════ DASHBOARD ═══════════ */
  async function abaDashboard() {
    const d = await MR.api("gestao/dashboard.php?" + qs({ fazenda_id: st.filtroFazenda, periodo: $("#dashPeriodo").value }));
    const p = d.producao, f = d.financeiro;
    const kpi = (rotulo, valor, extra = "", classe = "") => `<div class="mr-kpi ${classe}"><span>${rotulo}</span><strong>${valor}</strong>${extra ? `<small>${extra}</small>` : ""}</div>`;

    $("#dashProducao").innerHTML =
      kpi("Área total", num(p.area_total_ha) + " ha", `${p.propriedades} propriedade(s)`) +
      kpi("Área plantada", num(p.area_plantada_ha) + " ha", p.safras.length ? esc(p.safras.join(", ")) : "Nenhuma safra ativa") +
      kpi("Área colhida", num(p.area_colhida_ha) + " ha", esc(p.referencia_colheita || "")) +
      kpi("Produtividade", p.produtividade_sc_ha ? num(p.produtividade_sc_ha) + " sc/ha" : "—", p.produtividade_kg_ha ? num(p.produtividade_kg_ha) + " kg/ha" : "Registre a produção colhida") +
      kpi("Produção", num(p.producao_sacas) + " sc", num(p.producao_kg / 1000) + " t");

    const lucroClasse = f.lucro_liquido >= 0 ? "positivo" : "negativo";
    $("#dashFinanceiro").innerHTML =
      kpi("Receita bruta", moeda(f.receita_bruta), { estimada: "Estimada pela produção", sem_dados: "Sem receitas no período" }[f.receita_origem] || "Lançamentos") +
      kpi("Despesas", moeda(f.despesas)) +
      kpi("Lucro líquido", moeda(f.lucro_liquido), "", lucroClasse) +
      kpi("Margem", f.margem_pct === null ? "—" : num(f.margem_pct, 1) + "%", "", lucroClasse) +
      kpi("Custo por hectare", moeda(f.custo_por_ha), f.custo_por_saca ? moeda(f.custo_por_saca) + " por saca" : "");

    grafico("graficoDashFinanceiro", {
      type: "bar",
      data: {
        labels: f.fluxo_caixa.length ? f.fluxo_caixa.map((m) => mesCurto(m.mes)) : ["Sem lançamentos"],
        datasets: [
          { label: "Receita", data: f.fluxo_caixa.map((m) => m.entradas), backgroundColor: cores().claro, borderRadius: 6 },
          { label: "Despesa", data: f.fluxo_caixa.map((m) => m.saidas), backgroundColor: cores().terra, borderRadius: 6 },
          { label: "Lucro", data: f.fluxo_caixa.map((m) => m.resultado), type: "line", borderColor: cores().verde, backgroundColor: cores().verde, tension: .3 },
        ],
      },
      options: { scales: { y: eixoMoeda }, plugins: { tooltip: tooltipMoeda, legend: { position: "bottom" } } },
    });

    const r = d.ranking;
    if (!r.length) {
      $("#dashRanking").innerHTML = vazio("Informe a produção colhida nas safras para ver o ranking.", "bi-trophy");
    } else {
      const max = Math.max(...r.map((x) => x.produtividade_sc_ha)) || 1;
      $("#dashRanking").innerHTML = r.map((t, i) => `
        <div class="mr-ranking-item ${i === r.length - 1 && r.length > 1 ? "pior" : ""}">
          <b>${i + 1}º</b>
          <div><strong>${esc(t.nome)}</strong> <small>${esc(t.culturas.join(", "))} · ${moeda(t.lucro_por_ha)}/ha de lucro</small>
            <div class="mr-barra-prog"><span style="width:${(t.produtividade_sc_ha / max) * 100}%"></span></div></div>
          <strong>${num(t.produtividade_sc_ha)} sc/ha</strong>
        </div>`).join("");
    }

    $("#dashAgenda").innerHTML = d.agenda.length ? d.agenda.map((e) => itemAgenda(e, false)).join("") : `<li>${vazio("Nada marcado para os próximos 30 dias.", "bi-calendar-check")}</li>`;
    $("#dashAlertas").innerHTML = d.alertas.length ? d.alertas.map((n) => `
      <li class="${n.tipo.includes("atras") || n.tipo === "silo" ? "atrasado" : "aviso"}"><i class="bi bi-bell"></i>
        <div><strong>${esc(n.titulo)}</strong><small>${esc(n.mensagem)}</small></div>
        ${n.link ? `<a class="btn-icone" href="${esc(n.link)}" aria-label="Abrir"><i class="bi bi-arrow-right"></i></a>` : ""}</li>`).join("")
      : `<li>${vazio("Nenhum alerta pendente.", "bi-check2-circle")}</li>`;

    $("#dashCotacoes").innerHTML = d.cotacoes.length ? d.cotacoes.map((c) => `
      <tr><td>${esc(c.produto)}</td><td class="num">${moeda(c.preco_medio)}</td>
      <td class="num">${tendencia(c)}</td></tr>`).join("") : linhaVazia(3, "Sem anúncios ativos.");
  }

  function tendencia(c) {
    if (c.variacao_30d === null) return '<span class="mr-tag">estável</span>';
    const seta = c.variacao_30d > 0 ? "bi-arrow-up-right" : c.variacao_30d < 0 ? "bi-arrow-down-right" : "bi-dash";
    return `<span class="${c.variacao_30d > 0 ? "mr-alta" : c.variacao_30d < 0 ? "mr-baixa" : ""}"><i class="bi ${seta}"></i> ${num(c.variacao_30d, 1)}%</span>`;
  }

  function mesCurto(mes) {
    const [a, m] = mes.split("-");
    return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m) - 1] + "/" + a.slice(2);
  }

  /* ═══════════ PROPRIEDADES E TALHÕES ═══════════ */
  async function abaPropriedades() {
    $("#listaFazendas").innerHTML = st.fazendas.length ? st.fazendas.map((f) => `
      <div class="mr-card">
        <h3><i class="bi bi-house-door"></i> ${esc(f.nome)}</h3>
        <p class="mr-ajuda">${esc(f.localizacao || "Localização não informada")}${f.cadastro_estadual ? " · " + esc(f.cadastro_estadual) : ""}</p>
        <div class="mr-mini-kpis" style="margin-top:12px">
          <div><span>Área total</span><strong>${num(f.area_total)} ha</strong></div>
          <div><span>Talhões</span><strong>${f.talhoes} (${num(f.area_talhoes)} ha)</strong></div>
          <div><span>Safras ativas</span><strong>${f.safras_ativas}</strong></div>
        </div>
        <div class="mr-acoes" style="display:flex;gap:8px">
          <button type="button" class="btn-sec" data-editar="fazenda" data-id="${f.id}"><i class="bi bi-pencil"></i> Editar</button>
          <button type="button" class="btn-icone perigo" data-excluir="fazenda" data-id="${f.id}" aria-label="Excluir propriedade"><i class="bi bi-trash"></i></button>
        </div>
      </div>`).join("") : vazio("Cadastre a sua primeira propriedade para começar.", "bi-house-add");

    const t = st.talhoes;
    $("#tabelaTalhoes").innerHTML = t.length ? t.map((x) => `
      <tr>
        <td><strong>${esc(x.nome)}</strong>${x.coordenadas ? ' <i class="bi bi-geo-alt-fill" title="Mapeado" style="color:var(--mp-destaque)"></i>' : ""}</td>
        <td>${esc(x.fazenda_nome)}</td>
        <td class="num">${num(x.area_ha)}</td>
        <td>${x.cultura_atual ? `<span class="mr-tag">${esc(nomeCultura(x.cultura_atual))}</span>` : "—"}${x.safra_atual ? ` <small class="mr-ajuda">${esc(x.safra_atual)}</small>` : ""}</td>
        <td class="num">${moeda(x.custos_acumulados)}</td>
        <td class="num">${moeda(x.custo_por_ha)}</td>
        <td class="num">${x.produtividade_ultima !== null ? num(x.produtividade_ultima) + " " + (UNIDADES[x.ultima_unidade] || "") + "/ha" : x.produtividade_kg_ha ? num(x.produtividade_kg_ha / 60) + " sc/ha" : "—"}</td>
        <td class="num">${moeda(x.lucro)}</td>
        <td class="acoes">
          <button type="button" class="btn-icone" data-historico="${x.id}" aria-label="Histórico de uso"><i class="bi bi-clock-history"></i></button>
          <button type="button" class="btn-icone" data-editar="talhao" data-id="${x.id}" aria-label="Editar"><i class="bi bi-pencil"></i></button>
          <button type="button" class="btn-icone perigo" data-excluir="talhao" data-id="${x.id}" aria-label="Excluir"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`).join("") : linhaVazia(9, "Nenhum talhão cadastrado.");

    const soma = (k) => t.reduce((a, x) => a + Number(x[k] || 0), 0);
    $("#rodapeTalhoes").innerHTML = t.length ? `<tr><td colspan="2">Total</td><td class="num">${num(soma("area_ha"))}</td><td></td><td class="num">${moeda(soma("custos_acumulados"))}</td><td class="num">${soma("area_ha") ? moeda(soma("custos_acumulados") / soma("area_ha")) : "—"}</td><td></td><td class="num">${moeda(soma("lucro"))}</td><td></td></tr>` : "";

    await desenharMapaGeral();
  }

  async function carregarLeaflet() {
    MR.carregarCss(LEAFLET_CSS);
    await MR.carregarScript(LEAFLET_JS);
  }

  function camadaSatelite() {
    return L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, attribution: "Imagens © Esri, Maxar, Earthstar Geographics",
    });
  }

  function centroPadrao() {
    const f = st.fazendas.find((x) => x.latitude !== null && (!st.filtroFazenda || String(x.id) === st.filtroFazenda));
    return f ? [[f.latitude, f.longitude], 14] : [[-15.8, -47.9], 4];
  }

  async function desenharMapaGeral() {
    try { await carregarLeaflet(); } catch (e) { $("#mapaTalhoes").innerHTML = vazio("Mapa indisponível sem internet.", "bi-wifi-off"); return; }
    if (!st.mapa) {
      st.mapa = L.map("mapaTalhoes", { scrollWheelZoom: false });
      camadaSatelite().addTo(st.mapa);
      st.camadaTalhoes = L.featureGroup().addTo(st.mapa);
    }
    st.camadaTalhoes.clearLayers();
    st.talhoes.filter((t) => t.coordenadas).forEach((t, i) => {
      L.polygon(t.coordenadas, { color: cores().paleta[i % 10], weight: 2, fillOpacity: .35 })
        .bindPopup(`<strong>${esc(t.nome)}</strong><br>${num(t.area_ha)} ha · ${esc(nomeCultura(t.cultura_atual))}<br>Custos: ${moeda(t.custos_acumulados)}`)
        .bindTooltip(esc(t.nome), { permanent: true, direction: "center", className: "mr-rotulo-talhao" })
        .addTo(st.camadaTalhoes);
    });
    setTimeout(() => {
      st.mapa.invalidateSize();
      if (st.camadaTalhoes.getLayers().length) st.mapa.fitBounds(st.camadaTalhoes.getBounds(), { padding: [20, 20] });
      else st.mapa.setView(...centroPadrao());
    }, 50);
  }

  // Área de um polígono [lat,lng] em hectares (fórmula esférica).
  function areaHa(pontos) {
    if (pontos.length < 3) return 0;
    const R = 6378137, rad = Math.PI / 180;
    let soma = 0;
    for (let i = 0; i < pontos.length; i++) {
      const [lat1, lng1] = pontos[i], [lat2, lng2] = pontos[(i + 1) % pontos.length];
      soma += (lng2 - lng1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
    }
    return Math.abs(soma * R * R / 2) / 10000;
  }

  async function abrirMapaDesenho(coordenadas) {
    st.desenho = Array.isArray(coordenadas) ? coordenadas.map((p) => [...p]) : [];
    try { await carregarLeaflet(); } catch (e) { $("#mapaDesenho").innerHTML = vazio("Mapa indisponível sem internet. A área pode ser digitada.", "bi-wifi-off"); return; }
    if (!st.mapaDesenho) {
      st.mapaDesenho = L.map("mapaDesenho");
      camadaSatelite().addTo(st.mapaDesenho);
      st.mapaDesenho.on("click", (e) => { st.desenho.push([+e.latlng.lat.toFixed(7), +e.latlng.lng.toFixed(7)]); atualizarDesenho(); });
    }
    setTimeout(() => {
      st.mapaDesenho.invalidateSize();
      atualizarDesenho();
      if (st.desenho.length >= 3) st.mapaDesenho.fitBounds(L.polygon(st.desenho).getBounds(), { padding: [30, 30] });
      else {
        const fazenda = st.fazendas.find((f) => String(f.id) === $("#modalTalhao [name=fazenda_id]").value && f.latitude !== null);
        st.mapaDesenho.setView(fazenda ? [fazenda.latitude, fazenda.longitude] : centroPadrao()[0], fazenda ? 15 : centroPadrao()[1]);
      }
    }, 80);
  }

  function atualizarDesenho() {
    st.camadaDesenho?.remove();
    if (st.desenho.length) {
      st.camadaDesenho = (st.desenho.length >= 3 ? L.polygon(st.desenho, { color: "#ead9b6", fillOpacity: .35 }) : L.polyline(st.desenho, { color: "#ead9b6" })).addTo(st.mapaDesenho);
    }
    const area = areaHa(st.desenho);
    $("#areaDesenho").textContent = st.desenho.length >= 3 ? `Área desenhada: ${num(area, 2)} ha (${st.desenho.length} pontos).` : `${st.desenho.length} ponto(s) marcados.`;
    $("#modalTalhao [name=coordenadas]").value = st.desenho.length >= 3 ? JSON.stringify(st.desenho) : "";
  }

  async function abrirHistorico(id) {
    const d = await MR.api(`gestao/talhoes.php?id=${id}&historico=1`);
    const t = st.talhoes.find((x) => x.id === Number(id)) || d.talhao;
    $("#tituloHistorico").textContent = "Histórico — " + (t.nome || "Talhão");
    $("#conteudoHistorico").innerHTML = `
      <div class="mr-mini-kpis">
        <div><span>Área</span><strong>${num(t.area_ha)} ha</strong></div>
        <div><span>Custos acumulados</span><strong>${moeda(t.custos_acumulados)}</strong></div>
        <div><span>Custo por ha</span><strong>${moeda(t.custo_por_ha)}</strong></div>
        <div><span>Produtividade média</span><strong>${t.produtividade_kg_ha ? num(t.produtividade_kg_ha / 60) + " sc/ha" : "—"}</strong></div>
      </div>
      <h3 style="margin:10px 0">Culturas por safra</h3>
      <div class="mr-tabela"><table><thead><tr><th>Safra</th><th>Cultura</th><th class="num">Área</th><th class="num">Produção</th><th class="num">Produtividade</th><th>Plantio / colheita</th></tr></thead><tbody>
      ${d.culturas.length ? d.culturas.map((c) => {
        const area = Number(c.area_colhida_ha || c.area_plantada_ha);
        return `<tr><td>${esc(c.safra_nome || c.ano_periodo)}</td><td>${esc(nomeCultura(c.cultura))}${c.variedade ? " · " + esc(c.variedade) : ""}</td><td class="num">${num(c.area_plantada_ha)} ha</td>
        <td class="num">${c.producao_total ? num(c.producao_total) + " " + UNIDADES[c.unidade_producao] : "—"}</td>
        <td class="num">${c.producao_total && area ? num(c.producao_total / area) + " " + UNIDADES[c.unidade_producao] + "/ha" : "—"}</td>
        <td>${data(c.data_plantio)} → ${data(c.data_colheita)}</td></tr>`;
      }).join("") : linhaVazia(6, "Nenhuma cultura registrada neste talhão.")}
      </tbody></table></div>
      <h3 style="margin:16px 0 10px">Operações do diário</h3>
      <ul class="mr-lista">${d.operacoes.length ? d.operacoes.map((o) => `<li><i class="bi ${ICONES_OPERACAO[o.tipo]}"></i><div><strong>${data(o.data_operacao)} · ${TIPOS_OPERACAO[o.tipo]}</strong>
        <small>${esc(o.produto || "")}${o.dosagem ? " · " + esc(o.dosagem) : ""}${o.responsavel ? " · " + esc(o.responsavel) : ""}${o.custo ? " · " + moeda(o.custo) : ""}</small></div></li>`).join("") : `<li>${vazio("Nenhuma operação registrada.")}</li>`}</ul>
      <h3 style="margin:16px 0 10px">Lançamentos financeiros</h3>
      <div class="mr-tabela"><table><tbody>${d.lancamentos.length ? d.lancamentos.map((l) => `<tr><td>${data(l.data_lancamento)}</td><td>${esc(l.descricao)}</td><td class="num ${l.tipo === "despesa" ? "mr-alta" : "mr-baixa"}">${l.tipo === "despesa" ? "−" : "+"} ${moeda(l.valor)}</td></tr>`).join("") : linhaVazia(3, "Sem lançamentos ligados a este talhão.")}</tbody></table></div>`;
    MR.modal.abrir("modalHistoricoTalhao");
  }

  /* ═══════════ SAFRAS ═══════════ */
  function abaSafras() {
    const lista = st.safras;
    $("#listaSafras").innerHTML = lista.length ? lista.map((s) => {
      const c = s.consolidado;
      const [rotulo, classe] = STATUS_SAFRA[s.status] || [s.status, ""];
      return `<article class="mr-card">
        <div class="mr-safra-topo">
          <h3>${esc(s.nome)}</h3>
          <span class="mr-tag ${classe}">${rotulo}</span>
          <span class="mr-ajuda">${esc(s.fazenda_nome)} · ${data(s.data_inicio)} → ${s.data_encerramento ? data(s.data_encerramento) : "em aberto"}</span>
          <div class="mr-acoes" style="display:flex;gap:6px">
            <button type="button" class="btn-sec" data-nova-cultura="${s.id}"><i class="bi bi-plus-lg"></i> Cultura</button>
            ${s.status === "em_andamento" ? `<button type="button" class="btn-sec" data-encerrar="${s.id}"><i class="bi bi-flag"></i> Encerrar</button>` : ""}
            <button type="button" class="btn-icone" data-editar="safra" data-id="${s.id}" aria-label="Editar safra"><i class="bi bi-pencil"></i></button>
            <button type="button" class="btn-icone perigo" data-excluir="safra" data-id="${s.id}" aria-label="Excluir safra"><i class="bi bi-trash"></i></button>
          </div>
        </div>
        <div class="mr-mini-kpis">
          <div><span>Área cultivada</span><strong>${num(c.area_cultivada_ha)} ha</strong></div>
          <div><span>Área colhida</span><strong>${num(c.area_colhida_ha)} ha</strong></div>
          <div><span>Produção</span><strong>${Object.entries(c.producao_por_unidade).map(([u, v]) => num(v) + " " + UNIDADES[u]).join(" + ") || "—"}</strong></div>
          <div><span>Produtividade</span><strong>${c.produtividade_sc_ha ? num(c.produtividade_sc_ha) + " sc/ha" : "—"}</strong></div>
          <div><span>Custos</span><strong>${moeda(c.custos)}</strong></div>
          <div><span>Receita ${c.receita_origem === "estimada" ? "(estim.)" : ""}</span><strong>${moeda(c.receita)}</strong></div>
          <div><span>Lucro</span><strong class="${c.lucro >= 0 ? "mr-baixa" : "mr-alta"}">${moeda(c.lucro)}</strong></div>
          <div><span>Margem</span><strong>${c.margem_pct === null ? "—" : num(c.margem_pct, 1) + "%"}</strong></div>
        </div>
        <div class="mr-tabela"><table>
          <thead><tr><th>Talhão</th><th>Cultura</th><th class="num">Plantada</th><th class="num">Colhida</th><th class="num">Estimada</th><th class="num">Produção</th><th class="num">Produtividade</th><th class="num">Preço/un.</th><th>Situação</th><th></th></tr></thead>
          <tbody>${s.culturas.length ? s.culturas.map((x) => `<tr>
            <td>${esc(x.talhao_nome)}</td><td><span class="mr-tag">${esc(nomeCultura(x.cultura))}</span>${x.variedade ? " " + esc(x.variedade) : ""}</td>
            <td class="num">${num(x.area_plantada_ha)} ha</td><td class="num">${x.area_colhida_ha === null ? "—" : num(x.area_colhida_ha) + " ha"}</td>
            <td class="num">${x.producao_estimada === null ? "—" : num(x.producao_estimada) + " " + UNIDADES[x.unidade_producao]}</td>
            <td class="num">${x.producao_total === null ? "—" : num(x.producao_total) + " " + UNIDADES[x.unidade_producao]}</td>
            <td class="num">${x.produtividade === null ? "—" : num(x.produtividade) + " " + UNIDADES[x.unidade_producao] + "/ha"}</td>
            <td class="num">${moeda(x.preco_venda_unitario)}</td><td>${esc(x.status)}</td>
            <td class="acoes"><button type="button" class="btn-icone" data-editar-cultura="${s.id}:${x.id}" aria-label="Editar"><i class="bi bi-pencil"></i></button>
            <button type="button" class="btn-icone perigo" data-excluir="cultura" data-id="${x.id}" aria-label="Remover"><i class="bi bi-trash"></i></button></td></tr>`).join("")
            : linhaVazia(10, "Adicione as culturas plantadas em cada talhão nesta safra.")}</tbody>
        </table></div>
      </article>`;
    }).join("") : vazio("Cadastre uma safra (ex.: 2025/2026) e vincule as culturas aos talhões.", "bi-flower3");

    const ordem = [...lista].reverse();
    const c = cores();
    grafico("graficoSafrasProdutividade", {
      type: "bar",
      data: { labels: ordem.map((s) => s.nome), datasets: [{ label: "Produtividade (sc/ha)", data: ordem.map((s) => s.consolidado.produtividade_sc_ha || 0), backgroundColor: c.claro, borderRadius: 8 }] },
      options: { plugins: { legend: { position: "bottom" } } },
    });
    grafico("graficoSafrasFinanceiro", {
      type: "bar",
      data: {
        labels: ordem.map((s) => s.nome),
        datasets: [
          { label: "Custos", data: ordem.map((s) => s.consolidado.custos), backgroundColor: c.terra, borderRadius: 6 },
          { label: "Receita", data: ordem.map((s) => s.consolidado.receita), backgroundColor: c.info, borderRadius: 6 },
          { label: "Lucro", data: ordem.map((s) => s.consolidado.lucro), backgroundColor: c.verde, borderRadius: 6 },
        ],
      },
      options: { scales: { y: eixoMoeda }, plugins: { tooltip: tooltipMoeda, legend: { position: "bottom" } } },
    });
  }

  function abrirCultura(safraId, culturaId) {
    const safra = st.safras.find((s) => s.id === Number(safraId));
    const form = $("#modalCultura form");
    const cultura = culturaId ? safra.culturas.find((c) => c.id === Number(culturaId)) : null;
    preencherForm(form, cultura ? { ...cultura, safra_id: safra.id } : { safra_id: safra.id, unidade_producao: "saca", status: "plantada" });
    preencherSelect(form.elements.talhao_id, st.talhoes.filter((t) => t.fazenda_id === safra.fazenda_id).map((t) => [t.id, `${t.nome} (${num(t.area_ha)} ha)`]));
    if (cultura) form.elements.talhao_id.value = cultura.talhao_id;
    $("#tituloCultura").textContent = (cultura ? "Editar cultura — " : "Nova cultura — ") + safra.nome;
    if (!form.elements.talhao_id.options.length) { MR.toast("Cadastre talhões nesta propriedade antes.", "aviso"); return; }
    MR.modal.abrir("modalCultura");
  }

  /* ═══════════ DIÁRIO DE CAMPO (com modo offline) ═══════════ */
  const pendentes = {
    ler() { try { return JSON.parse(localStorage.getItem(CHAVE_PENDENTES) || "[]"); } catch (e) { return []; } },
    salvar(lista) { localStorage.setItem(CHAVE_PENDENTES, JSON.stringify(lista)); atualizarPendentes(); },
  };

  function atualizarPendentes() {
    const n = pendentes.ler().length;
    $("#qtdPendentes").textContent = n;
    $("#btnSincronizar").classList.toggle("hidden", n === 0);
  }

  async function sincronizar(silencioso = false) {
    const lista = pendentes.ler();
    if (!lista.length || !navigator.onLine) return;
    try {
      const d = await MR.api("gestao/operacoes.php", { json: { acao: "sincronizar", registros: lista } });
      const ok = new Set(d.resultado.filter((r) => r.ok).map((r) => r.uuid_cliente));
      const falhas = d.resultado.filter((r) => !r.ok);
      pendentes.salvar(lista.filter((r) => !ok.has(r.uuid_cliente) && !falhas.some((f) => f.uuid_cliente === r.uuid_cliente)));
      if (ok.size) MR.toast(`${ok.size} registro(s) do diário feitos offline foram enviados.`);
      falhas.forEach((f) => MR.toast("Registro offline recusado: " + f.mensagem, "erro"));
      if (st.aba === "diario") abaDiario();
    } catch (e) {
      if (!silencioso) MR.toast(e.message, "erro");
    }
  }

  async function abaDiario() {
    atualizarPendentes();
    const d = await MR.api("gestao/operacoes.php?" + qs({
      fazenda_id: st.filtroFazenda, talhao_id: $("#diarioTalhao").value, tipo: $("#diarioTipo").value, de: $("#diarioDe").value, ate: $("#diarioAte").value,
    }));
    st.operacoes = d.operacoes;
    const offline = pendentes.ler().map((o) => ({ ...o, offline: true, talhao_nome: st.talhoes.find((t) => t.id === Number(o.talhao_id))?.nome }));
    const linhas = [...offline, ...d.operacoes];
    $("#tabelaOperacoes").innerHTML = linhas.length ? linhas.map((o) => `<tr>
      <td>${data(o.data_operacao)}</td>
      <td><i class="bi ${ICONES_OPERACAO[o.tipo]}"></i> ${TIPOS_OPERACAO[o.tipo]}${o.offline ? ' <span class="mr-tag alerta"><i class="bi bi-cloud-slash"></i> aguardando envio</span>' : o.sincronizado_offline == 1 ? ' <span class="mr-tag info" title="Registrado sem internet">offline</span>' : ""}</td>
      <td>${esc(o.talhao_nome || "")}</td>
      <td>${esc(o.produto || "—")}</td>
      <td class="num">${esc(o.dosagem || "—")}</td>
      <td class="num">${o.area_aplicada_ha ? num(o.area_aplicada_ha) : "—"}</td>
      <td>${esc(o.responsavel || "—")}</td>
      <td class="num">${o.custo ? moeda(o.custo) : "—"}</td>
      <td class="acoes">${o.offline ? `<button type="button" class="btn-icone perigo" data-descartar="${o.uuid_cliente}" aria-label="Descartar"><i class="bi bi-x-lg"></i></button>` :
        `<button type="button" class="btn-icone" data-editar="operacao" data-id="${o.id}" aria-label="Editar"><i class="bi bi-pencil"></i></button>
         <button type="button" class="btn-icone perigo" data-excluir="operacao" data-id="${o.id}" aria-label="Excluir"><i class="bi bi-trash"></i></button>`}</td>
    </tr>`).join("") : linhaVazia(9, "Nenhuma operação registrada com esses filtros.");
  }

  async function salvarOperacao(e) {
    e.preventDefault();
    const form = e.target;
    const dados = lerForm(form);
    if (!dados.id) dados.uuid_cliente = uuid();

    const guardarOffline = () => {
      const lista = pendentes.ler();
      lista.push(dados);
      pendentes.salvar(lista);
      MR.modal.fechar("modalOperacao");
      MR.toast("Sem internet: registro salvo neste aparelho e será enviado automaticamente.", "aviso");
      if (st.aba === "diario") abaDiario().catch(() => renderOffline());
    };

    if (!navigator.onLine && !dados.id) return guardarOffline();
    try {
      await MR.api("gestao/operacoes.php", { json: { acao: "salvar", ...dados } });
      MR.modal.fechar("modalOperacao");
      MR.toast("Operação registrada no diário de campo.");
      await carregarBase();
      renderizarAba(st.aba);
    } catch (erro) {
      if (erro.offline && !dados.id) return guardarOffline();
      MR.toast(erro.message, "erro");
    }
  }

  function renderOffline() {
    const offline = pendentes.ler();
    $("#tabelaOperacoes").innerHTML = offline.map((o) => `<tr><td>${data(o.data_operacao)}</td><td>${TIPOS_OPERACAO[o.tipo]} <span class="mr-tag alerta">aguardando envio</span></td>
      <td>${esc(st.talhoes.find((t) => t.id === Number(o.talhao_id))?.nome || "")}</td><td>${esc(o.produto || "—")}</td><td class="num">${esc(o.dosagem || "—")}</td><td class="num">${o.area_aplicada_ha || "—"}</td><td>${esc(o.responsavel || "—")}</td><td class="num">${o.custo ? moeda(o.custo) : "—"}</td><td></td></tr>`).join("")
      || linhaVazia(9, "Sem internet. Novos registros ficam salvos neste aparelho.");
  }

  function atualizarConexao() {
    const off = !navigator.onLine;
    $("#avisoOffline").classList.toggle("hidden", !off);
    if (!off) sincronizar(true);
  }

  /* ═══════════ AGENDA ═══════════ */
  function itemAgenda(e, comAcoes = true) {
    const dias = Number(e.dias_restantes ?? e.dias);
    const vencimento = ["licenca", "contrato", "documento", "pagamento"].includes(e.tipo);
    const quando = e.status === "concluido" ? "Concluído" : dias < 0 ? `${vencimento ? "Venceu" : "Atrasado"} há ${-dias} dia(s)` : dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : `Em ${dias} dias`;
    const classe = e.status === "concluido" ? "lida" : dias < 0 ? "atrasado" : dias <= 3 ? "aviso" : "";
    return `<li class="${classe}"><i class="bi ${ICONES_AGENDA[e.tipo] || "bi-calendar"}"></i>
      <div><strong>${esc(e.titulo)}</strong>
      <small>${data(e.data_evento)}${e.hora_evento ? " às " + String(e.hora_evento).slice(0, 5) : ""} · ${quando} · ${TIPOS_AGENDA[e.tipo] || e.tipo}${e.talhao_nome ? " · " + esc(e.talhao_nome) : e.fazenda_nome ? " · " + esc(e.fazenda_nome) : ""}</small>
      ${e.descricao && comAcoes ? `<small>${esc(e.descricao)}</small>` : ""}</div>
      ${comAcoes ? `<div class="mr-acoes">
        ${e.status === "pendente" ? `<button type="button" class="btn-icone" data-concluir="${e.id}" aria-label="Concluir"><i class="bi bi-check2"></i></button>` : `<button type="button" class="btn-icone" data-reabrir="${e.id}" aria-label="Reabrir"><i class="bi bi-arrow-counterclockwise"></i></button>`}
        <button type="button" class="btn-icone" data-editar="evento" data-id="${e.id}" aria-label="Editar"><i class="bi bi-pencil"></i></button>
        <button type="button" class="btn-icone perigo" data-excluir="evento" data-id="${e.id}" aria-label="Excluir"><i class="bi bi-trash"></i></button></div>` : ""}
    </li>`;
  }

  async function abaAgenda() {
    const d = await MR.api("gestao/agenda.php?" + qs({ status: $("#agendaStatus").value, tipo: $("#agendaTipo").value }));
    st.eventos = d.eventos;
    const r = d.resumo || {};
    $("#agendaResumo").innerHTML = `
      <div class="mr-kpi ${r.atrasados ? "negativo" : ""}"><span>Atrasados / vencidos</span><strong>${r.atrasados || 0}</strong></div>
      <div class="mr-kpi"><span>Próximos 7 dias</span><strong>${r.proximos_7_dias || 0}</strong></div>
      <div class="mr-kpi"><span>Vencimentos em 30 dias</span><strong>${r.vencimentos_30_dias || 0}</strong><small>Licenças, contratos, documentos e pagamentos</small></div>`;
    $("#listaAgenda").innerHTML = d.eventos.length ? d.eventos.map((e) => itemAgenda(e)).join("") : `<li>${vazio("Nenhum compromisso com esses filtros.", "bi-calendar-check")}</li>`;
    atualizarBotaoNotificacoes();
  }

  function atualizarBotaoNotificacoes() {
    const b = $("#btnPermitirNotificacoes");
    if (!("Notification" in window)) { b.classList.add("hidden"); return; }
    b.disabled = Notification.permission !== "default";
    b.innerHTML = Notification.permission === "granted" ? '<i class="bi bi-bell-fill"></i> Avisos ativados' : Notification.permission === "denied" ? '<i class="bi bi-bell-slash"></i> Avisos bloqueados no navegador' : '<i class="bi bi-bell"></i> Avisar neste aparelho';
  }

  /* ═══════════ FINANCEIRO ═══════════ */
  async function abaFinanceiro() {
    const d = await MR.api("gestao/financeiro.php?" + qs({
      fazenda_id: st.filtroFazenda, safra_id: $("#finSafra").value, talhao_id: $("#finTalhao").value, de: $("#finDe").value, ate: $("#finAte").value,
    }));
    st.lancamentos = d.lancamentos;
    st.categorias = d.categorias;
    const i = d.indicadores;
    const kpi = (r, v, extra = "", cls = "") => `<div class="mr-kpi ${cls}"><span>${r}</span><strong>${v}</strong>${extra ? `<small>${extra}</small>` : ""}</div>`;
    const cls = i.lucro_liquido >= 0 ? "positivo" : "negativo";
    $("#finIndicadores").innerHTML =
      kpi("Receita bruta", moeda(i.receita_bruta), i.receita_origem === "estimada" ? "Estimada: produção × preço" : i.receita_origem === "sem_dados" ? "Sem receitas" : "Lançamentos") +
      kpi("Despesas", moeda(i.despesas)) +
      kpi("Lucro líquido", moeda(i.lucro_liquido), "", cls) +
      kpi("Margem de lucro", i.margem_pct === null ? "—" : num(i.margem_pct, 1) + "%", "", cls) +
      kpi("Custo por hectare", moeda(i.custo_por_ha), num(i.area_ha) + " ha considerados") +
      kpi("Custo por saca", moeda(i.custo_por_saca), num(i.producao_sacas) + " sacas de 60 kg") +
      kpi("Custo por tonelada", moeda(i.custo_por_tonelada), num(i.producao_toneladas) + " t produzidas");

    const c = cores();
    grafico("graficoFluxo", {
      type: "bar",
      data: {
        labels: i.fluxo_caixa.map((m) => mesCurto(m.mes)),
        datasets: [
          { label: "Entradas", data: i.fluxo_caixa.map((m) => m.entradas), backgroundColor: c.claro, borderRadius: 6 },
          { label: "Saídas", data: i.fluxo_caixa.map((m) => -m.saidas), backgroundColor: c.terra, borderRadius: 6 },
          { label: "Saldo acumulado", data: i.fluxo_caixa.map((m) => m.saldo_acumulado), type: "line", borderColor: c.info, backgroundColor: c.info, tension: .3 },
        ],
      },
      options: { scales: { y: eixoMoeda, x: { stacked: true } }, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${moeda(Math.abs(ctx.parsed.y))}` } }, legend: { position: "bottom" } } },
    });
    grafico("graficoComposicao", {
      type: "doughnut",
      data: { labels: i.composicao_custos.map((x) => x.nome), datasets: [{ data: i.composicao_custos.map((x) => x.valor), backgroundColor: c.paleta, borderWidth: 0 }] },
      options: { cutout: "58%", plugins: { legend: { position: "right" }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${moeda(ctx.parsed)} (${i.composicao_custos[ctx.dataIndex].percentual}%)` } } } },
    });

    const nomeCat = (l) => (st.categorias[l.tipo] || {})[l.categoria] || l.categoria;
    $("#tabelaLancamentos").innerHTML = d.lancamentos.length ? d.lancamentos.map((l) => `<tr>
      <td>${data(l.data_lancamento)}</td>
      <td><span class="mr-tag ${l.tipo === "despesa" ? "terra" : "ok"}">${l.tipo === "despesa" ? "Despesa" : "Receita"}</span></td>
      <td>${esc(nomeCat(l))}</td>
      <td>${esc(l.descricao)}${l.operacao_id ? ' <span class="mr-tag info" title="Gerado pelo diário de campo">diário</span>' : ""}</td>
      <td>${esc(l.talhao_nome || "Geral")}${l.safra_nome ? " · " + esc(l.safra_nome) : ""}</td>
      <td class="num ${l.tipo === "despesa" ? "mr-alta" : "mr-baixa"}">${l.tipo === "despesa" ? "−" : "+"} ${moeda(l.valor)}</td>
      <td class="acoes">${l.operacao_id ? "" : `<button type="button" class="btn-icone" data-editar="lancamento" data-id="${l.id}" aria-label="Editar"><i class="bi bi-pencil"></i></button>`}
        <button type="button" class="btn-icone perigo" data-excluir="lancamento" data-id="${l.id}" aria-label="Excluir"><i class="bi bi-trash"></i></button></td>
    </tr>`).join("") : linhaVazia(7, "Nenhum lançamento. Registre despesas (sementes, defensivos, fertilizantes...) e receitas.");
  }

  async function abrirLancamento(tipo, lancamento) {
    if (!Object.keys(st.categorias.despesa).length) {
      try { st.categorias = (await MR.api("gestao/financeiro.php?de=" + MR.hoje() + "&ate=" + MR.hoje())).categorias; } catch (e) { /* segue */ }
    }
    const form = $("#modalLancamento form");
    preencherForm(form, lancamento || { tipo, data_lancamento: MR.hoje(), fazenda_id: st.filtroFazenda || st.fazendas[0]?.id });
    form.elements.tipo.value = tipo;
    preencherSelect(form.elements.categoria, Object.entries(st.categorias[tipo] || {}));
    if (lancamento) form.elements.categoria.value = lancamento.categoria;
    $("#tituloLancamento").textContent = (lancamento ? "Editar " : "Nova ") + (tipo === "despesa" ? "despesa" : "receita");
    MR.modal.abrir("modalLancamento");
  }

  /* ═══════════ DOCUMENTOS ═══════════ */
  async function abaDocumentos() {
    const d = await MR.api("gestao/documentos.php?" + qs({ ...st.pastaDocs, tipo: $("#docTipo").value, busca: $("#docBusca").value }));
    st.documentos = d.documentos;

    // Árvore: Fazenda > Talhão > Safra
    const arvore = {};
    d.pastas.forEach((p) => {
      const f = (arvore[p.fazenda_id || 0] ??= { nome: p.fazenda, id: p.fazenda_id, total: 0, talhoes: {} });
      f.total += Number(p.total);
      const t = (f.talhoes[p.talhao_id || 0] ??= { nome: p.talhao, id: p.talhao_id, total: 0, safras: {} });
      t.total += Number(p.total);
      t.safras[p.safra_id || 0] = { nome: p.safra, id: p.safra_id, total: Number(p.total) };
    });
    const ativo = (o) => JSON.stringify(o) === JSON.stringify(st.pastaDocs) ? "ativo" : "";
    const total = d.pastas.reduce((a, p) => a + Number(p.total), 0);
    let html = `<button type="button" class="${ativo({})}" data-pasta="{}"><i class="bi bi-folder2-open"></i> Todos os documentos <small>${total}</small></button>`;
    Object.values(arvore).forEach((f) => {
      const pf = f.id ? { fazenda_id: f.id } : null;
      html += `<button type="button" class="${pf ? ativo(pf) : ""}" ${pf ? `data-pasta='${JSON.stringify(pf)}'` : "disabled"}><i class="bi bi-folder"></i> ${esc(f.nome)} <small>${f.total}</small></button>`;
      Object.values(f.talhoes).forEach((t) => {
        const pt = t.id ? { talhao_id: t.id } : pf;
        html += `<button type="button" class="n2 ${t.id ? ativo(pt) : ""}" data-pasta='${JSON.stringify(pt || {})}'><i class="bi bi-folder"></i> ${esc(t.nome)} <small>${t.total}</small></button>`;
        Object.values(t.safras).forEach((s) => {
          if (!s.id) return;
          const ps = t.id ? { talhao_id: t.id, safra_id: s.id } : { ...(pf || {}), safra_id: s.id };
          html += `<button type="button" class="n3 ${ativo(ps)}" data-pasta='${JSON.stringify(ps)}'><i class="bi bi-folder"></i> Safra ${esc(s.nome)} <small>${s.total}</small></button>`;
        });
      });
    });
    $("#arvorePastas").innerHTML = html;

    const icone = (m) => m === "application/pdf" ? "bi-file-earmark-pdf" : m.startsWith("image/") ? "bi-file-earmark-image" : m.includes("sheet") || m.includes("excel") || m.includes("csv") ? "bi-file-earmark-spreadsheet" : m.includes("word") ? "bi-file-earmark-word" : "bi-file-earmark";
    const tamanho = (b) => b > 1048576 ? num(b / 1048576, 1) + " MB" : num(Math.ceil(b / 1024)) + " KB";
    $("#tabelaDocumentos").innerHTML = d.documentos.length ? d.documentos.map((x) => {
      const dias = x.dias_validade === null ? null : Number(x.dias_validade);
      const validade = dias === null ? "—" : `${data(x.data_validade)} ${dias < 0 ? '<span class="mr-tag erro">vencido</span>' : dias <= 30 ? `<span class="mr-tag alerta">${dias} dia(s)</span>` : ""}`;
      return `<tr>
        <td><i class="bi ${icone(x.mime)}"></i> <strong>${esc(x.titulo)}</strong><br><small class="mr-ajuda">${esc(x.nome_original)} · ${MR.dataHora(x.data_criacao)}</small></td>
        <td>${esc(TIPOS_DOCUMENTO[x.tipo] || x.tipo)}</td>
        <td><small>${esc([x.fazenda_nome, x.talhao_nome, x.safra_nome && "Safra " + x.safra_nome].filter(Boolean).join(" › ") || "—")}</small></td>
        <td>${validade}</td>
        <td class="num">${tamanho(x.tamanho)}</td>
        <td class="acoes">
          ${/pdf|image/.test(x.mime) ? `<a class="btn-icone" href="../../backend/gestao/documento_baixar.php?id=${x.id}&inline=1" target="_blank" rel="noopener" aria-label="Abrir"><i class="bi bi-eye"></i></a>` : ""}
          <a class="btn-icone" href="../../backend/gestao/documento_baixar.php?id=${x.id}" aria-label="Baixar"><i class="bi bi-download"></i></a>
          <button type="button" class="btn-icone perigo" data-excluir="documento" data-id="${x.id}" aria-label="Excluir"><i class="bi bi-trash"></i></button>
        </td></tr>`;
    }).join("") : linhaVazia(6, "Nenhum documento nesta pasta.");
  }

  async function enviarDocumento(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    fd.set("acao", "enviar");
    const botao = form.querySelector("[type=submit]");
    botao.disabled = true;
    try {
      await MR.api("gestao/documentos.php", { form: fd });
      MR.modal.fechar("modalDocumento");
      MR.toast("Documento enviado.");
      abaDocumentos();
    } catch (erro) {
      MR.toast(erro.message, "erro");
    } finally {
      botao.disabled = false;
    }
  }

  /* ═══════════ SILOS ═══════════ */
  async function abaSilos() {
    const d = await MR.api("gestao/armazenamentos.php" + (st.filtroFazenda ? "?fazenda_id=" + st.filtroFazenda : ""));
    st.silos = d.armazenamentos;
    const unid = { tonelada: "t", m3: "m³", litro: "L", saca: "sc" };
    $("#listaSilos").innerHTML = d.armazenamentos.length ? d.armazenamentos.map((a) => {
      const u = a.ultima;
      const nivel = u && u.nivel_pct !== null ? Number(u.nivel_pct) : null;
      const estado = nivel === null ? "" : nivel <= Number(a.alerta_minimo_pct) ? "baixo" : nivel >= Number(a.alerta_maximo_pct) ? "alto" : "";
      const segundos = u ? Number(u.segundos) : null;
      const recente = segundos !== null && segundos < 120;
      return `<article class="mr-card">
        <div class="mr-silo">
          <div class="mr-silo-tanque ${estado}"><span style="height:${nivel ?? 0}%"></span><b>${nivel === null ? "—" : num(nivel, 0) + "%"}</b></div>
          <div>
            <h4>${esc(a.nome)} <small class="mr-ajuda">${esc(a.codigo)}</small></h4>
            <span class="mr-tag">${esc({ silo: "Silo", bag: "Silo bag", graneleiro: "Graneleiro", reservatorio: "Reservatório" }[a.tipo])}</span>
            ${estado === "baixo" ? '<span class="mr-tag erro">nível baixo</span>' : estado === "alto" ? '<span class="mr-tag alerta">quase cheio</span>' : ""}
            ${a.dispositivo_codigo ? `<span class="mr-tag ${recente ? "ok" : "info"}"><i class="bi bi-cpu"></i> ${recente ? "ao vivo" : esc(a.dispositivo_codigo)}</span>` : ""}
            <dl>
              <dt>Produto</dt><dd>${esc(a.produto || "—")}</dd>
              <dt>Volume</dt><dd>${u && u.volume !== null ? num(u.volume) : "—"} / ${num(a.capacidade)} ${unid[a.unidade_capacidade]}</dd>
              <dt>Peso</dt><dd>${u && u.peso_kg !== null ? num(u.peso_kg / 1000, 2) + " t" : "—"}</dd>
              <dt>Temperatura</dt><dd>${u && u.temperatura !== null ? num(u.temperatura, 1) + " °C" : "—"}</dd>
              <dt>Umid. grãos</dt><dd>${u && u.umidade_graos !== null ? num(u.umidade_graos, 1) + "%" : "—"}</dd>
              <dt>Leitura</dt><dd>${u ? MR.dataHora(u.data_hora) + " (" + u.origem + ")" : "sem leituras"}</dd>
            </dl>
          </div>
        </div>
        <div class="mr-grafico baixo" style="height:90px;margin:8px 0"><canvas id="graficoSilo${a.id}"></canvas></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn-sec" data-leitura="${a.id}"><i class="bi bi-pencil-square"></i> Leitura</button>
          <button type="button" class="btn-sec" data-simular="${a.id}" title="Gera uma leitura de demonstração"><i class="bi bi-magic"></i> Simular</button>
          <button type="button" class="btn-icone" data-editar="silo" data-id="${a.id}" aria-label="Editar"><i class="bi bi-pencil"></i></button>
          <button type="button" class="btn-icone perigo" data-excluir="silo" data-id="${a.id}" aria-label="Excluir"><i class="bi bi-trash"></i></button>
        </div>
      </article>`;
    }).join("") : vazio("Cadastre silos, bags ou reservatórios para acompanhar nível, volume e peso.", "bi-database-add");

    d.armazenamentos.forEach((a) => {
      if (!a.historico.length) return;
      grafico("graficoSilo" + a.id, {
        type: "line",
        data: { labels: a.historico.map((_, i) => i + 1), datasets: [{ data: a.historico, borderColor: cores().verde, backgroundColor: "rgba(144,169,85,.25)", fill: true, tension: .35, pointRadius: 0 }] },
        options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => num(ctx.parsed.y, 1) + "%" } } }, scales: { x: { display: false }, y: { min: 0, max: 100, ticks: { stepSize: 50 } } } },
      });
    });
  }

  /* ═══════════ RELATÓRIOS ═══════════ */
  const RELATORIOS = [
    ["financeiro", "bi-cash-stack", "Financeiro", "Todos os lançamentos com receita bruta, lucro, margem e custos por ha, saca e tonelada."],
    ["custos", "bi-pie-chart", "Composição de custos", "Quanto cada categoria (sementes, defensivos, fertilizantes...) pesa no custo de produção."],
    ["safras", "bi-flower3", "Comparativo de safras", "Área, produção, produtividade, custos, receita, lucro e margem de cada safra."],
    ["talhoes", "bi-bounding-box", "Talhões", "Área, cultura atual, custos acumulados, R$/ha e produtividade por talhão."],
    ["operacoes", "bi-journal-text", "Diário de campo", "Operações com data, talhão, produto, dosagem, responsável e custo."],
    ["agenda", "bi-calendar-check", "Agenda e prazos", "Atividades de campo e vencimentos de licenças, contratos e documentos."],
    ["silos", "bi-database", "Silos e reservatórios", "Nível, volume, peso, temperatura e umidade atuais de cada armazenamento."],
    ["documentos", "bi-folder2-open", "Documentos", "Lista de documentos por propriedade, talhão e safra com validade."],
    ["vendas", "bi-receipt", "Vendas no marketplace", "Pedidos recebidos no marketplace com itens, valores e status."],
  ];

  function abaRelatorios() {
    $("#listaRelatorios").innerHTML = RELATORIOS.map(([tipo, icone, titulo, texto]) => `
      <div class="mr-card">
        <h3><i class="bi ${icone}"></i> ${titulo}</h3>
        <p class="mr-ajuda" style="min-height:42px">${texto}</p>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button type="button" class="btn-sec" data-exportar="${tipo}" data-formato="pdf"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
          <button type="button" class="btn-sec" data-exportar="${tipo}" data-formato="xlsx"><i class="bi bi-file-earmark-excel"></i> Excel</button>
        </div>
      </div>`).join("");
  }

  /* ═══════════ Ações (cliques) ═══════════ */
  const ENDPOINTS = {
    fazenda: "gestao/fazendas.php", talhao: "gestao/talhoes.php", safra: "gestao/safras.php", cultura: "gestao/safras.php",
    operacao: "gestao/operacoes.php", evento: "gestao/agenda.php", lancamento: "gestao/financeiro.php", documento: "gestao/documentos.php", silo: "gestao/armazenamentos.php",
  };
  const NOMES = { fazenda: "a propriedade (e todos os talhões, safras e registros dela)", talhao: "o talhão (e as operações dele)", safra: "a safra", cultura: "esta cultura da safra", operacao: "a operação", evento: "o compromisso", lancamento: "o lançamento", documento: "o documento", silo: "o armazenamento e as leituras" };

  function abrirNovo(tipo) {
    const padraoFazenda = st.filtroFazenda || st.fazendas[0]?.id || "";
    if (tipo !== "fazenda" && !st.fazendas.length) {
      MR.toast("Cadastre uma propriedade primeiro.", "aviso");
      return mostrarAba("propriedades");
    }
    switch (tipo) {
      case "fazenda": preencherForm($("#modalFazenda form"), {}); $("#tituloFazenda").textContent = "Nova propriedade"; return MR.modal.abrir("modalFazenda");
      case "talhao": preencherForm($("#modalTalhao form"), { fazenda_id: padraoFazenda }); $("#tituloTalhao").textContent = "Novo talhão"; MR.modal.abrir("modalTalhao"); return abrirMapaDesenho(null);
      case "safra": {
        const ano = new Date().getFullYear();
        preencherForm($("#modalSafra form"), { fazenda_id: padraoFazenda, ano_periodo: `${ano}/${ano + 1}`, data_inicio: MR.hoje(), status: "em_andamento" });
        $("#tituloSafra").textContent = "Nova safra";
        return MR.modal.abrir("modalSafra");
      }
      case "operacao": {
        if (!st.talhoes.length) { MR.toast("Cadastre um talhão primeiro.", "aviso"); return; }
        if (!st.safras.length) { MR.toast("Cadastre uma safra primeiro: toda operação do diário pertence a uma safra.", "aviso"); return mostrarAba("safras"); }
        const atual = st.safras.find((s) => s.status === "em_andamento");
        preencherForm($("#formOperacao"), { data_operacao: MR.hoje(), tipo: "pulverizacao", safra_id: atual?.id || "" });
        $("#tituloOperacao").textContent = "Registrar operação";
        return MR.modal.abrir("modalOperacao");
      }
      case "evento": preencherForm($("#modalEvento form"), { data_evento: MR.hoje(), tipo: "atividade", lembrar_dias_antes: 1, fazenda_id: padraoFazenda }); $("#tituloEvento").textContent = "Novo compromisso"; return MR.modal.abrir("modalEvento");
      case "despesa": case "receita": return abrirLancamento(tipo);
      case "documento": preencherForm($("#formDocumento"), { tipo: "nota_fiscal", fazenda_id: padraoFazenda, ...st.pastaDocs }); return MR.modal.abrir("modalDocumento");
      case "silo": preencherForm($("#modalSilo form"), { fazenda_id: padraoFazenda, tipo: "silo", unidade_capacidade: "tonelada", alerta_minimo_pct: 15, alerta_maximo_pct: 95 }); $("#tituloSilo").textContent = "Novo armazenamento"; return MR.modal.abrir("modalSilo");
    }
  }

  function abrirEdicao(tipo, id) {
    id = Number(id);
    switch (tipo) {
      case "fazenda": preencherForm($("#modalFazenda form"), st.fazendas.find((x) => x.id === id)); $("#tituloFazenda").textContent = "Editar propriedade"; return MR.modal.abrir("modalFazenda");
      case "talhao": {
        const t = st.talhoes.find((x) => x.id === id);
        preencherForm($("#modalTalhao form"), t);
        $("#tituloTalhao").textContent = "Editar talhão";
        MR.modal.abrir("modalTalhao");
        return abrirMapaDesenho(t.coordenadas);
      }
      case "safra": preencherForm($("#modalSafra form"), st.safras.find((x) => x.id === id)); $("#tituloSafra").textContent = "Editar safra"; return MR.modal.abrir("modalSafra");
      case "operacao": preencherForm($("#formOperacao"), st.operacoes.find((x) => Number(x.id) === id)); $("#tituloOperacao").textContent = "Editar operação"; return MR.modal.abrir("modalOperacao");
      case "evento": preencherForm($("#modalEvento form"), st.eventos.find((x) => Number(x.id) === id)); $("#tituloEvento").textContent = "Editar compromisso"; return MR.modal.abrir("modalEvento");
      case "lancamento": { const l = st.lancamentos.find((x) => Number(x.id) === id); return abrirLancamento(l.tipo, l); }
      case "silo": preencherForm($("#modalSilo form"), st.silos.find((x) => Number(x.id) === id)); $("#tituloSilo").textContent = "Editar armazenamento"; return MR.modal.abrir("modalSilo");
    }
  }

  async function excluir(tipo, id) {
    if (!(await MR.confirmar(`Excluir ${NOMES[tipo]}? Esta ação não pode ser desfeita.`, "Excluir"))) return;
    try {
      await MR.api(ENDPOINTS[tipo], { json: { acao: tipo === "cultura" ? "excluir_cultura" : "excluir", id } });
      MR.toast("Excluído.");
      await recarregar();
    } catch (erro) {
      MR.toast(erro.message, "erro");
    }
  }

  async function recarregar() {
    await carregarBase();
    await renderizarAba(st.aba);
  }

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button, a");
    if (!b) return;
    const ds = b.dataset;
    try {
      if (ds.aba) return mostrarAba(ds.aba);
      if (ds.novo) return abrirNovo(ds.novo);
      if (ds.editar) return abrirEdicao(ds.editar, ds.id);
      if (ds.excluir) return excluir(ds.excluir, ds.id);
      if (ds.historico) return abrirHistorico(ds.historico);
      if (ds.novaCultura) return abrirCultura(ds.novaCultura);
      if (ds.editarCultura) { const [s, c] = ds.editarCultura.split(":"); return abrirCultura(s, c); }
      if (ds.encerrar) {
        if (!(await MR.confirmar("Encerrar a safra hoje? Ela passa a contar como concluída nos comparativos.", "Encerrar"))) return;
        await MR.api("gestao/safras.php", { json: { acao: "encerrar", id: ds.encerrar } });
        MR.toast("Safra encerrada.");
        return recarregar();
      }
      if (ds.concluir || ds.reabrir) {
        await MR.api("gestao/agenda.php", { json: { acao: ds.concluir ? "concluir" : "reabrir", id: ds.concluir || ds.reabrir } });
        return abaAgenda();
      }
      if (ds.descartar) {
        if (!(await MR.confirmar("Descartar este registro que ainda não foi enviado?", "Descartar"))) return;
        pendentes.salvar(pendentes.ler().filter((r) => r.uuid_cliente !== ds.descartar));
        return abaDiario().catch(renderOffline);
      }
      if (ds.pasta) { st.pastaDocs = JSON.parse(ds.pasta); return abaDocumentos(); }
      if (ds.leitura) { preencherForm($("#modalLeitura form"), { id: ds.leitura }); return MR.modal.abrir("modalLeitura"); }
      if (ds.simular) { await MR.api("gestao/armazenamentos.php", { json: { acao: "simular", id: ds.simular } }); return abaSilos(); }
      if (ds.exportar) {
        b.disabled = true;
        await MR.exportar(ds.exportar, { fazenda_id: st.filtroFazenda, safra_id: $("#relSafra").value, de: $("#relDe").value, ate: $("#relAte").value }, ds.formato);
        b.disabled = false;
      }
    } catch (erro) {
      MR.toast(erro.message, "erro");
    }
  });

  // Formulários genéricos (data-endpoint): JSON com acao=salvar (ou data-acao).
  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (!form.dataset.endpoint) return;
    e.preventDefault();
    const botao = form.querySelector("[type=submit]");
    botao.disabled = true;
    try {
      const r = await MR.api(form.dataset.endpoint, { json: { acao: form.dataset.acao || "salvar", ...lerForm(form) } });
      MR.modal.fechar(form.dataset.modal);
      MR.toast(r.mensagem || "Salvo.");
      await recarregar();
    } catch (erro) {
      MR.toast(erro.message, "erro");
    } finally {
      botao.disabled = false;
    }
  });

  /* ── Inicialização ──────────────────────────────────────── */
  async function iniciar() {
    $("#formOperacao").addEventListener("submit", salvarOperacao);
    $("#formDocumento").addEventListener("submit", enviarDocumento);

    $("#filtroFazenda").addEventListener("change", async (e) => { st.filtroFazenda = e.target.value; st.pastaDocs = {}; await recarregar(); });
    $("#dashPeriodo").addEventListener("change", abaDashboard);
    ["#diarioTalhao", "#diarioTipo", "#diarioDe", "#diarioAte"].forEach((s) => $(s).addEventListener("change", () => abaDiario().catch((er) => MR.toast(er.message, "erro"))));
    ["#agendaStatus", "#agendaTipo"].forEach((s) => $(s).addEventListener("change", abaAgenda));
    ["#finSafra", "#finTalhao", "#finDe", "#finAte"].forEach((s) => $(s).addEventListener("change", () => abaFinanceiro().catch((er) => MR.toast(er.message, "erro"))));
    $("#docTipo").addEventListener("change", abaDocumentos);
    let espera;
    $("#docBusca").addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(abaDocumentos, 350); });
    $("#btnAtualizarTudo").addEventListener("click", () => recarregar().then(() => MR.toast("Dados atualizados.")).catch((er) => MR.toast(er.message, "erro")));
    $("#btnSincronizar").addEventListener("click", () => sincronizar());
    $("#btnLimparDesenho").addEventListener("click", () => { st.desenho = []; if (st.mapaDesenho) atualizarDesenho(); });
    $("#btnUsarArea").addEventListener("click", () => {
      const a = areaHa(st.desenho);
      if (a > 0) $("#modalTalhao [name=area_ha]").value = a.toFixed(2);
      else MR.toast("Marque pelo menos 3 pontos no mapa.", "aviso");
    });
    $("#btnMinhaLocalizacao").addEventListener("click", () => {
      if (!navigator.geolocation) return MR.toast("Seu navegador não informa a localização.", "aviso");
      navigator.geolocation.getCurrentPosition(
        (p) => { const f = $("#modalFazenda form"); f.elements.latitude.value = p.coords.latitude.toFixed(7); f.elements.longitude.value = p.coords.longitude.toFixed(7); },
        () => MR.toast("Não foi possível obter a localização.", "erro"),
      );
    });
    $("#btnPermitirNotificacoes").addEventListener("click", async () => {
      const p = await Notification.requestPermission();
      atualizarBotaoNotificacoes();
      if (p === "granted") new Notification("Avisos ativados", { body: "Você receberá os lembretes da agenda neste aparelho." });
    });
    // Ao trocar a propriedade no lançamento/evento, o talhão sugerido acompanha.
    $("#modalTalhao [name=fazenda_id]").addEventListener("change", () => { if (st.desenho.length < 3) abrirMapaDesenho(st.desenho); });

    window.addEventListener("online", atualizarConexao);
    window.addEventListener("offline", atualizarConexao);
    window.addEventListener("hashchange", () => mostrarAba(location.hash.slice(1), false));

    // Página disponível offline (diário de campo no celular, no meio da lavoura).
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "127.0.0.1" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("sw-gestao.js").catch(() => { /* sem offline */ });
    }

    atualizarConexao();

    // Plano da Gestão da Fazenda: sem plano, primeiro a página de planos (igual à gestao-fazenda.html).
    try {
      const usuario = await MR.sessao();
      if (!["produtor", "admin"].includes(usuario.tipo_acesso)) {
        $("main.conteudo").innerHTML = '<section class="page-header"><div><h1>Gestão da Fazenda</h1><p>A Gestão da Fazenda é exclusiva para produtores.</p></div></section>';
        return;
      }
      const p = await MR.plano();
      if (!p.plano) { location.replace("planos.html"); return; }
      st.recursos = p.recursos;
      const aviso = $("#planoAtual");
      aviso.innerHTML = p.plano === "pro"
        ? '<i class="bi bi-stars"></i> Plano Pro: todas as funções liberadas.'
        : '<i class="bi bi-flower1"></i> Plano Essencial. Dashboard, documentos, silos e relatórios vêm no <a href="planos.html">Plano Pro</a>.';
      aviso.classList.remove("hidden");
    } catch (erro) {
      if (!erro.offline) { MR.toast(erro.message, "erro"); return; }
      st.recursos = MR.RECURSOS_PLANO.pro; // sem internet: o diário offline continua funcionando
    }

    try {
      await carregarBase();
    } catch (erro) {
      MR.toast(erro.message, "erro");
      if (erro.status === 403) { $("main.conteudo").innerHTML = `<section class="page-header"><div><h1>Gestão da Fazenda</h1><p>${esc(erro.message)}</p></div></section>`; return; }
    }
    mostrarAba(new URLSearchParams(location.search).get("aba") || location.hash.slice(1) || (liberada("dashboard") ? "dashboard" : "propriedades"), false);
    sincronizar(true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
