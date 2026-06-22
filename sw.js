// ================================================================
// SERVICE WORKER — English Lab
// Estratégia: Cache-first para assets estáticos (shell da app).
// Firebase e OpenAI ficam sempre na rede.
// ================================================================

const CACHE = 'englab-v3'

// Assets que nunca mudam entre visitas (shell da app)
const SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/core.js',
  '/js/firebase.js',
  '/js/audio.js',
  '/js/srs.js',
  '/js/dashboard.js',
  '/js/review.js',
  '/js/settings.js',
  '/js/init.js',
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
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
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
