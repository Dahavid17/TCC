/* Service worker da Gestão Rural: deixa a página e os scripts disponíveis sem internet,
   para o produtor registrar operações do diário de campo na lavoura. Os registros feitos
   offline ficam no localStorage (gestao-rural.js) e são enviados quando a conexão volta.
   Estratégia: rede primeiro; sem rede, a última cópia salva. O backend nunca é guardado. */

const CACHE = "mr-gestao-v3";
const ARQUIVOS = [
  "gestao-rural.html",
  "../css/tokens.css?v=20261125",
  "../css/painel.css?v=20261125",
  "../css/modulos.css?v=2",
  "../js/painel.js?v=20261125",
  "../js/tema-transicao.js?v=20261125",
  "../js/menu.js?v=20261125",
  "../js/modulos.js?v=2",
  "../js/exportar.js?v=1",
  "../js/gestao-rural.js?v=2",
  "../js/notificacoes.js?v=1",
  "../css/notificacoes.css?v=1",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(ARQUIVOS.map((a) => c.add(a)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.includes("/backend/")) return;

  e.respondWith(
    fetch(e.request)
      .then((resposta) => {
        if (resposta.ok && (url.origin === location.origin || url.hostname.endsWith("jsdelivr.net"))) {
          const copia = resposta.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: url.pathname.endsWith(".html") }))
  );
});
