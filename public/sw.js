// ============================================================
// Service worker do ERP — o que faz o PDV abrir SEM internet.
//
// A fila offline (IndexedDB) sempre guardou as vendas, mas sem service
// worker um F5 sem rede não carregava nem o aplicativo. Aqui:
//   - navegações: network-first com fallback para o shell em cache
//     (deploy novo chega na hora; sem rede, abre a última versão)
//   - /assets/*: cache-first — os nomes têm hash de conteúdo, são imutáveis
//   - chamadas ao Supabase e afins: passam direto, sem cache — dado de
//     negócio cacheado por SW viraria tela mentirosa
// ============================================================

const VERSAO = "v1";
const SHELL = `shell-${VERSAO}`;
const ASSETS = `assets-${VERSAO}`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icone.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) =>
      Promise.all(ks.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase/API: nunca cachear

  // Navegação (F5, abrir o app): rede primeiro, shell do cache como rede de segurança
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(SHELL).then((c) => c.put("/", copia));
          return resp;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Assets com hash: imutáveis — cache-first
  if (url.pathname.startsWith("/assets/") || url.pathname === "/manifest.webmanifest" || url.pathname === "/icone.svg") {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ??
        fetch(req).then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(ASSETS).then((c) => c.put(req, copia));
          }
          return resp;
        }),
      ),
    );
  }
});

// A página manda a lista de assets logo após registrar: na primeira visita
// eles foram baixados ANTES de o SW assumir, então nunca passaram pelo
// handler de fetch. O próprio SW os busca e grava — independe de a página
// já estar sob controle.
self.addEventListener("message", (e) => {
  if (e.data?.tipo !== "precache" || !Array.isArray(e.data.urls)) return;
  e.waitUntil(
    caches.open(ASSETS).then(async (c) => {
      for (const u of e.data.urls) {
        try {
          if (!(await c.match(u))) {
            const r = await fetch(u);
            if (r.ok) await c.put(u, r);
          }
        } catch { /* offline agora: tenta na próxima visita */ }
      }
    }),
  );
});
