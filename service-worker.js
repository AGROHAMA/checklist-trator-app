/* ===================== Service Worker — Checklist de Trator Digital (Agrohama) =====================
   Objetivo: o app funciona offline no campo (dados continuam salvos no aparelho via localStorage,
   isso aqui só cacheia os arquivos do próprio app), e busca sozinho a versão mais nova sempre que
   houver internet — sem precisar desinstalar/reinstalar nada no celular.

   Ao publicar uma correção: basta subir os arquivos atualizados no GitHub Pages. Troque o número da
   versão abaixo (CACHE_VERSION) sempre que fizer uma alteração — isso garante que o cache antigo seja
   descartado e a versão nova seja usada em todos os aparelhos assim que eles tiverem internet. */
const CACHE_VERSION = 'v11';
const CACHE_NAME = `agrohama-checklist-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.ico',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => { /* segue mesmo se algum item falhar ao cachear na instalação */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ===================== Envio em segundo plano (Background Sync) =====================
   O app espelha tudo que está pendente numa "caixa de saída" no IndexedDB ("agrohama-outbox",
   store "outbox"). Quando o navegador detecta que a conexão voltou, ele acorda este service worker
   com o evento "sync" (tag "outbox-sync") MESMO COM O APP FECHADO, e aqui mandamos cada item direto
   pro webhook do Power Automate. O que deu certo vai pro store "sent"; o app lê isso na próxima
   abertura e marca os registros como sincronizados (sem reenviar). */
function obOpen(){
  return new Promise((resolve, reject) => {
    const q = indexedDB.open('agrohama-outbox', 1);
    q.onupgradeneeded = () => {
      const db = q.result;
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('sent')) db.createObjectStore('sent', { keyPath: 'key' });
    };
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
function obAll(db) {
  return new Promise((resolve, reject) => {
    const r = db.transaction('outbox', 'readonly').objectStore('outbox').getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}
// Marca como enviado SOMENTE se o item na caixa de saída ainda for exatamente o que foi enviado
// (se o operador alterou o registro nesse meio tempo, o item novo continua na fila).
function obMarkSent(db, item) {
  return new Promise((resolve) => {
    let igual = false;
    const tx = db.transaction(['outbox', 'sent'], 'readwrite');
    const out = tx.objectStore('outbox');
    out.get(item.key).onsuccess = (ev) => {
      const atual = ev.target.result;
      if (atual && atual.body === item.body) {
        igual = true;
        out.delete(item.key);
        tx.objectStore('sent').put({ key: item.key, t: Date.now() });
      }
    };
    tx.oncomplete = () => resolve(igual);
    tx.onerror = tx.onabort = () => resolve(false);
  });
}
async function flushOutbox() {
  const db = await obOpen();
  let falhou = false;
  try {
    const itens = await obAll(db);
    for (const item of itens) {
      try {
        const resp = await fetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: item.body
        });
        if (resp.ok) {
          const igual = await obMarkSent(db, item);
          if (!igual) falhou = true; // o registro mudou durante o envio: manda a versão nova na próxima volta
        } else {
          falhou = true;
        }
      } catch (e) {
        falhou = true;
      }
    }
  } finally {
    db.close();
  }
  try {
    const clientes = await self.clients.matchAll({ includeUncontrolled: true });
    clientes.forEach((c) => c.postMessage({ type: 'outbox-flushed' }));
  } catch (e) { /* sem janelas abertas: tudo bem */ }
  // Lançar erro faz o navegador reagendar o "sync" automaticamente (com intervalo crescente).
  if (falhou) throw new Error('outbox: ainda há itens pendentes');
}
self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox-sync') event.waitUntil(flushOutbox());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // não mexe em chamadas externas (webhook do Teams etc.)

  const isNavigation = req.mode === 'navigate' || req.destination === 'document';

  if (isNavigation) {
    // Tela principal: tenta sempre pegar a versão mais nova da internet primeiro (é isso que faz
    // a atualização acontecer sozinha). Se não tiver internet, usa a última versão salva no aparelho.
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Demais arquivos do próprio app (ícones, manifest etc.): responde rápido com o que já está salvo
  // e, em paralelo, busca uma versão atualizada para a próxima vez (stale-while-revalidate).
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
