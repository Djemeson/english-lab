// ================================================================
// SERVICE WORKER — English Lab
// Estratégia: Cache-first para assets estáticos (shell da app).
// Firebase e OpenAI ficam sempre na rede.
// ================================================================

const CACHE = 'englab-v78'
// Cache separado e PERMANENTE para o ffmpeg.wasm (31 MB): não pode ser
// apagado a cada versão do shell, senão cada deploy custaria 31 MB de novo.
const CACHE_FFMPEG = 'englab-ffmpeg-v1'

// Assets que nunca mudam entre visitas (shell da app).
// RELATIVOS de propósito: resolvidos contra o scope do SW, então funcionam tanto
// na raiz (dev local) quanto em subpasta (GitHub Pages → /english-lab/).
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/core.js',
  './js/lang.js',
  './js/ai.js',
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
  'generativelanguage.googleapis.com',   // Gemini
  'api.deepseek.com',                    // DeepSeek
  'api.groq.com',                        // Groq
  'gistusercontent.com',
  'api.github.com',
  'strem.io',            // busca de legendas (resultados mudam; não cachear)
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
      Promise.all(keys.filter(k => k !== CACHE && k !== CACHE_FFMPEG).map(k => caches.delete(k)))
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

  // ffmpeg.wasm: cache-first SEM revalidação em background (31 MB imutáveis —
  // o stale-while-revalidate do shell rebaixaria cada visita a um download).
  if (url.includes('/js/vendor/ffmpeg/')) {
    e.respondWith(
      caches.open(CACHE_FFMPEG).then(async cache => {
        const hit = await cache.match(e.request)
        if (hit) return hit
        const r = await fetch(e.request)
        if (r.ok) cache.put(e.request, r.clone())
        return r
      })
    )
    return
  }

  // Módulos lazy: network-first (mudam mais e não estão no shell)
  if (url.includes('/js/add.js') || url.includes('/js/study.js') || url.includes('/js/video')) {
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
