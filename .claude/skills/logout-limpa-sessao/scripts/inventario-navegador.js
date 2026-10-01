// Cole no console do DevTools DEPOIS de sair. Lista tudo o que ficou guardado
// neste site. O esperado: só a lista de exceções (preferência do aparelho,
// fila não enviada, chave do aparelho). Qualquer outra coisa é dado de quem saiu.
(async () => {
  const r = {};
  r.localStorage = Object.keys(localStorage).map((k) => `${k} (${(localStorage.getItem(k) || "").length} chars)`);
  r.sessionStorage = Object.keys(sessionStorage);
  r.cookiesLegiveis = document.cookie ? document.cookie.split(";").map((c) => c.split("=")[0].trim()) : [];
  r.indexedDB = {};
  if (indexedDB.databases) {
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue;
      const db = await new Promise((ok, erro) => { const q = indexedDB.open(name); q.onsuccess = () => ok(q.result); q.onerror = () => erro(q.error); });
      r.indexedDB[name] = {};
      for (const loja of db.objectStoreNames) {
        r.indexedDB[name][loja] = await new Promise((ok) => {
          const q = db.transaction(loja, "readonly").objectStore(loja).count();
          q.onsuccess = () => ok(q.result); q.onerror = () => ok("?");
        });
      }
      db.close();
    }
  }
  r.cacheStorage = {};
  if (window.caches) for (const n of await caches.keys()) {
    const ks = await (await caches.open(n)).keys();
    r.cacheStorage[n] = ks.filter((q) => !/\/assets\/|\.(js|css|png|svg|ico|woff2?)(\?|$)/.test(q.url)).map((q) => q.url);
  }
  console.log(JSON.stringify(r, null, 2));
  return r;
})();
