// ================================================================
// SERVICE WORKER — English Lab
// Estratégia: Cache-first para assets estáticos (shell da app).
// Firebase e OpenAI ficam sempre na rede.
// ================================================================

const CACHE = 'englab-v15'

// Assets que nunca mudam entre visitas (shell da app).
// RELATIVOS de propósito: resolvidos contra o scope do SW, então funcionam tanto
// na raiz (dev local) quanto em subpasta (GitHub Pages → /english-lab/).
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/core.js',
  './js/lang.js',
  './js/firebase.js',
  './js/audio.js',
  './js/srs.js',
  './js/dashboard.js',
  './js/review.js',
  './js/settings.js',
  './js/consulta.js',
  './js/init.js',
  './manifest.webmanifest',
]

// URLs que sempre precisam da rede (nunca cachear)
const NETWORK_ONLY = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'api.openai.com',
  'gistusercontent.com',
  'api.github.com',
]

// ── Install: pré-cacheia o shell ────────────────────────────────
// Cacheia um por um em vez de addAll(): com addAll, UM único 404 rejeita a Promise
// inteira e o service worker nunca instala (era o que acontecia no GitHub Pages).
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(
      SHELL.map(url => c.add(url).catch(err => console.warn('[SW] não cacheou', url, err)))
    )).then(() => self.skipWaiting())
  )
})

// ── Activate: limpa caches antigos ─────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: cache-first para shell, network-only para APIs ───────
self.addEventListener('fetch', e => {
  const url = e.request.url

  // Sempre rede para APIs externas
  if (NETWORK_ONLY.some(domain => url.includes(domain))) return

  // Apenas GET é cacheado
  if (e.request.method !== 'GET') return

  // add.js e study.js: network-first (lazy, pode mudar mais)
  if (url.includes('/js/add.js') || url.includes('/js/study.js')) {
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r })
        .catch(() => caches.match(e.request))
    )
    return
  }

  // Shell: cache-first, atualiza em background (stale-while-revalidate)
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request)
      const networkFetch = fetch(e.request).then(r => {
        if (r.ok) cache.put(e.request, r.clone())
        return r
      }).catch(() => null)
      return cached || networkFetch
    })
  )
})
