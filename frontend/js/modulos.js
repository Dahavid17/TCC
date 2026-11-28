/* =============================================================
   MODULOS.JS — Base compartilhada das páginas novas
   (Gestão Rural, Catálogo, Histórico, Mercado, Notificações)

   window.MR:
     api(caminho, {metodo, json, form})  -> chama o backend (JSON)
     moeda(), num(), data(), dataHora(), esc()
     toast(mensagem, tipo)               -> aviso flutuante
     modal.abrir(id) / modal.fechar(id)  -> usa .modal/.modal-box do painel.css
     confirmar(texto)                    -> Promise<boolean>
     sessao()                            -> usuário logado (cache)
     carregarScript(url)                 -> carrega uma biblioteca do CDN sob demanda
   Também cuida do tema (#temaBtn), do topo (nome/avatar), dos lembretes
   automáticos e dos links novos no menu lateral.
   ============================================================= */

(() => {
  // data-modo="menu": páginas antigas (que já cuidam do tema e do topo) só ganham os links
  // novos no menu lateral e os lembretes. Carregado assim pelo menu.js.
  const SO_MENU = document.currentScript?.dataset.modo === "menu";
  if (SO_MENU && window.MR) return;
  const API = "../../backend/";

  /* ── Formatação ─────────────────────────────────────────── */
  const fMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const fNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

  function moeda(v) { return v === null || v === undefined || v === "" || isNaN(v) ? "—" : fMoeda.format(Number(v)); }
  function num(v, casas) {
    if (v === null || v === undefined || v === "" || isNaN(v)) return "—";
    return casas === undefined ? fNum.format(Number(v)) : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }
  function data(v) {
    if (!v) return "—";
    const [a, m, d] = String(v).slice(0, 10).split("-");
    return d ? `${d}/${m}/${a}` : v;
  }
  function dataHora(v) {
    if (!v) return "—";
    return data(v) + (String(v).length > 10 ? " " + String(v).slice(11, 16) : "");
  }
  function esc(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML.replace(/"/g, "&quot;");
  }
  function hoje() { return new Date().toISOString().slice(0, 10); }

  /* ── API ────────────────────────────────────────────────── */
  async function api(caminho, opcoes = {}) {
    const init = { method: opcoes.metodo || (opcoes.json || opcoes.form ? "POST" : "GET"), headers: {} };
    if (opcoes.json) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opcoes.json);
    } else if (opcoes.form) {
      init.body = opcoes.form instanceof FormData ? opcoes.form : new URLSearchParams(opcoes.form);
    }

    let resposta;
    try {
      resposta = await fetch(API + caminho, init);
    } catch (e) {
      const erro = new Error("Sem conexão com o servidor.");
      erro.offline = true;
      throw erro;
    }

    let dados = {};
    try { dados = await resposta.json(); } catch (e) { dados = { sucesso: false, mensagem: "Resposta inválida do servidor." }; }

    if (resposta.status === 401) {
      window.location.href = "login-marketplace.html";
      throw new Error("Sessão expirada");
    }
    if (!resposta.ok || !dados.sucesso) {
      const erro = new Error(dados.mensagem || "Erro ao comunicar com o servidor.");
      erro.status = resposta.status;
      throw erro;
    }
    return dados;
  }

  /* ── Aviso flutuante ────────────────────────────────────── */
  function toast(mensagem, tipo = "ok") {
    let area = document.getElementById("mrToasts");
    if (!area) {
      area = document.createElement("div");
      area.id = "mrToasts";
      area.className = "mr-toasts";
      area.setAttribute("aria-live", "polite");
      document.body.appendChild(area);
    }
    const item = document.createElement("div");
    item.className = "mr-toast " + tipo;
    const icone = tipo === "erro" ? "bi-exclamation-octagon" : tipo === "aviso" ? "bi-exclamation-triangle" : "bi-check2-circle";
    item.innerHTML = `<i class="bi ${icone}"></i><span>${esc(mensagem)}</span>`;
    area.appendChild(item);
    setTimeout(() => item.classList.add("saindo"), 4200);
    setTimeout(() => item.remove(), 4700);
  }

  /* ── Modais ─────────────────────────────────────────────── */
  const modal = {
    abrir(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add("ativo");
      document.body.classList.add("menu-travado");
      setTimeout(() => el.querySelector("input:not([type=hidden]), select, textarea, button")?.focus(), 60);
    },
    fechar(id) {
      document.getElementById(id)?.classList.remove("ativo");
      if (!document.querySelector(".modal.ativo")) document.body.classList.remove("menu-travado");
    }
  };

  document.addEventListener("click", (e) => {
    const fechar = e.target.closest("[data-fechar]");
    if (fechar) modal.fechar(fechar.dataset.fechar);
    if (e.target.classList?.contains("modal") && e.target.classList.contains("ativo")) modal.fechar(e.target.id);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const aberto = [...document.querySelectorAll(".modal.ativo")].pop();
      if (aberto) modal.fechar(aberto.id);
    }
  });

  function confirmar(texto, rotulo = "Confirmar") {
    return new Promise((resolver) => {
      let el = document.getElementById("mrConfirmar");
      if (!el) {
        el = document.createElement("div");
        el.className = "modal";
        el.id = "mrConfirmar";
        el.innerHTML = `<div class="modal-box mr-confirmar" role="dialog" aria-modal="true" aria-labelledby="mrConfirmarTexto">
            <p id="mrConfirmarTexto"></p>
            <div class="modal-actions"><button type="button" data-r="0">Cancelar</button><button type="button" data-r="1"></button></div>
          </div>`;
        document.body.appendChild(el);
      }
      el.querySelector("#mrConfirmarTexto").textContent = texto;
      el.querySelector('[data-r="1"]').textContent = rotulo;
      const responder = (valor) => { modal.fechar("mrConfirmar"); el.onclick = null; resolver(valor); };
      el.onclick = (e) => {
        const b = e.target.closest("[data-r]");
        if (b) responder(b.dataset.r === "1");
        else if (e.target === el) responder(false);
      };
      modal.abrir("mrConfirmar");
    });
  }

  /* ── Bibliotecas sob demanda (Chart.js, Leaflet, jsPDF, SheetJS) ── */
  const carregados = {};
  function carregarScript(url) {
    if (!carregados[url]) {
      carregados[url] = new Promise((ok, falhou) => {
        const s = document.createElement("script");
        s.src = url;
        s.onload = ok;
        s.onerror = () => { delete carregados[url]; falhou(new Error("Não foi possível carregar " + url)); };
        document.head.appendChild(s);
      });
    }
    return carregados[url];
  }
  function carregarCss(url) {
    if (document.querySelector(`link[href="${url}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = url;
    document.head.appendChild(l);
  }

  /* ── Sessão e topo ──────────────────────────────────────── */
  let sessaoCache = null;
  async function sessao() {
    if (!sessaoCache) sessaoCache = api("auth/sessao.php").then((d) => d.usuario);
    return sessaoCache;
  }

  function iniciarTema() {
    const botao = document.getElementById("temaBtn");
    const aplicar = (escuro) => {
      document.body.classList.toggle("dark", escuro);
      if (botao) botao.querySelector("i").className = escuro ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
      document.dispatchEvent(new CustomEvent("mr:tema", { detail: { escuro } }));
    };
    let salvo = null;
    try { salvo = localStorage.getItem("marketplace:tema"); } catch (e) { /* sem armazenamento */ }
    aplicar(salvo === "dark");
    botao?.addEventListener("click", () => {
      const escuro = !document.body.classList.contains("dark");
      aplicar(escuro);
      try { localStorage.setItem("marketplace:tema", escuro ? "dark" : "light"); } catch (e) { /* ignora */ }
    });
  }

  async function preencherTopo() {
    try {
      const u = await sessao();
      const nome = document.getElementById("nomeUsuario");
      const tipo = document.getElementById("tipoUsuario");
      const avatar = document.getElementById("avatarUsuario");
      if (nome) nome.textContent = u.nome.split(" ")[0];
      if (tipo) tipo.textContent = { produtor: "Produtor", comprador: "Comprador", admin: "Administrador" }[u.tipo_acesso] || "";
      if (avatar) avatar.textContent = (u.nome || "U").trim().charAt(0).toUpperCase();
    } catch (e) { /* api já redireciona no 401 */ }
  }

  /* ── Lembretes automáticos (produtores) ─────────────────── */
  // O sino do topo é o do servidor (frontend/js/notificacoes.js). Aqui só pedimos ao backend
  // que gere os lembretes vencidos da Agenda, de documentos e de silos — uma vez a cada 30 min
  // por aba — e, se o usuário permitiu, mostramos um aviso do sistema quando surgem novos.
  async function gerarLembretes() {
    try {
      const u = await sessao();
      if (!["produtor", "admin"].includes(u.tipo_acesso)) return;
      const ultimo = Number(sessionStorage.getItem("mr:lembretes") || 0);
      if (Date.now() - ultimo < 30 * 60 * 1000) return;
      sessionStorage.setItem("mr:lembretes", String(Date.now()));
      const d = await api("gestao/lembretes.php");
      if (d.novos > 0 && "Notification" in window && Notification.permission === "granted") {
        new Notification("MarketPlace Rural", { body: `${d.novos} novo(s) lembrete(s) da sua fazenda. Veja no sino.`, icon: "../../assets/img/favicon/faviconMarketPlace.png" });
      }
    } catch (e) { /* silencioso */ }
  }

  /* ── Links dos módulos novos no menu lateral ────────────── */
  async function iniciarMenu() {
    const nav = document.querySelector(".sidebar nav");
    if (!nav || nav.dataset.modulos) return;
    nav.dataset.modulos = "1";

    let usuario = null;
    try { usuario = await sessao(); } catch (e) { return; }
    const produtor = ["produtor", "admin"].includes(usuario.tipo_acesso);

    const pagina = location.pathname.split("/").pop();
    const config = nav.querySelector('a[href="configuracoes.html"]');
    const favoritos = nav.querySelector('a[href="favoritos.html"]') || config;

    // Os módulos da fazenda (gestao-rural.html) ficam DENTRO de "Gestão da Fazenda":
    // nenhum link próprio no menu, e o item "Gestão da Fazenda" fica ativo nessas páginas.
    nav.querySelector('a[href="gestao-rural.html"]')?.remove();
    if (pagina === "gestao-rural.html") nav.querySelector('a[href="gestao-fazenda.html"]')?.classList.add("ativo");

    const links = [
      { href: "catalogo.html", icone: "bi-shop", texto: "Catálogo", antes: favoritos, depois: true },
      { href: "historico.html", icone: "bi-clock-history", texto: "Histórico", antes: config },
      { href: "notificacoes.html", icone: "bi-bell", texto: "Notificações", antes: config },
    ];
    // Inteligência de Mercado: só produtores (o backend também bloqueia compradores).
    if (produtor) links.splice(2, 0, { href: "mercado.html", icone: "bi-graph-up-arrow", texto: "Mercado", antes: config });

    links.forEach((l) => {
      if (nav.querySelector(`a[href="${l.href}"]`)) return;
      const a = document.createElement("a");
      a.href = l.href;
      a.innerHTML = `<i class="bi ${l.icone}"></i><span>${l.texto}</span>`;
      if (pagina === l.href) a.classList.add("ativo");
      if (l.antes && l.depois) l.antes.after(a);
      else if (l.antes) l.antes.before(a);
      else nav.appendChild(a);
    });
  }

  /* ── Planos da Gestão da Fazenda ────────────────────────── */
  // Mesmo mapa de backend/lib/gestao.php (RECURSOS_POR_PLANO). O backend é quem bloqueia de
  // verdade; aqui só mostramos o cadeado e o convite para o Plano Pro.
  const RECURSOS_PLANO = {
    essencial: ["gestao"],
    pro: ["gestao", "dashboard_gestao", "documentos", "silos", "relatorios"],
  };

  let planoCache = null;
  // { plano: "essencial" | "pro" | null, recursos: [...] }
  function plano() {
    if (!planoCache) {
      planoCache = (async () => {
        const u = await sessao();
        if (u.tipo_acesso === "admin") return { plano: "pro", recursos: RECURSOS_PLANO.pro };
        let p = null;
        try { p = (await api("usuarios/preferencias.php")).preferencias?.plano || null; } catch (e) { /* sem preferências */ }
        return { plano: RECURSOS_PLANO[p] ? p : null, recursos: RECURSOS_PLANO[p] || [] };
      })();
    }
    return planoCache;
  }

  // Elementos com data-recurso="..." ganham cadeado quando o plano não libera o recurso.
  async function marcarRecursos(raiz = document) {
    const alvos = raiz.querySelectorAll("[data-recurso]");
    if (!alvos.length) return;
    let p;
    try { p = await plano(); } catch (e) { return; }
    alvos.forEach((el) => {
      const bloqueado = !p.recursos.includes(el.dataset.recurso);
      el.classList.toggle("mr-bloqueado", bloqueado);
      el.querySelector(".mr-cadeado")?.remove();
      el.removeAttribute("aria-label");
      if (bloqueado) {
        const nome = el.textContent.trim();
        el.insertAdjacentHTML("beforeend", ' <i class="bi bi-lock-fill mr-cadeado" aria-hidden="true"></i>');
        el.title = "Disponível no Plano Pro";
        el.setAttribute("aria-label", `${nome} — disponível no Plano Pro`);
      }
    });
  }

  window.MR = { api, moeda, num, data, dataHora, esc, hoje, toast, modal, confirmar, carregarScript, carregarCss, sessao, plano, marcarRecursos, RECURSOS_PLANO };

  const iniciar = () => {
    if (!SO_MENU) {
      iniciarTema();
      preencherTopo();
    }
    gerarLembretes();
    iniciarMenu();
    marcarRecursos();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
