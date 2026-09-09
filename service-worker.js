/* ===================== Service Worker — Checklist de Trator Digital (Agrohama) =====================
   Objetivo: o app funciona offline no campo (dados continuam salvos no aparelho via localStorage,
   isso aqui só cacheia os arquivos do próprio app), e busca sozinho a versão mais nova sempre que
   houver internet — sem precisar desinstalar/reinstalar nada no celular.

   Ao publicar uma correção: basta subir os arquivos atualizados no GitHub Pages. Troque o número da
   versão abaixo (CACHE_VERSION) sempre que fizer uma alteração — isso garante que o cache antigo seja
   descartado e a versão nova seja usada em todos os aparelhos assim que eles tiverem internet. */
const CACHE_VERSION = 'v1';
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
