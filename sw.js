// ================================================================
// SERVICE WORKER — English Lab
// Estratégia: Cache-first para assets estáticos (shell da app).
// Firebase e OpenAI ficam sempre na rede.
// ================================================================

// SEMPRE bumpe esta versão quando um arquivo do SHELL ganhar um símbolo novo
// que outro arquivo passa a usar. Os módulos lazy são network-first e chegam
// novos na hora; o shell é cache-first. Sem o bump, um deploy pode juntar
// ler.js NOVO com ai.js VELHO — e "LEXA_NOME is not defined" na primeira
// visita. O `activate` apaga os caches antigos, então o bump resolve.
const CACHE = 'englab-v346'
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
  './js/glossario.js',
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
  'api.groq.com',                        // Groq
  'gistusercontent.com',
  'api.github.com',
  'strem.io',            // busca de legendas (resultados mudam; não cachear)
  'itunes.apple.com',    // catálogo de podcasts (resultados mudam)
]

// O cache do shell é só para o que é NOSSO (mesma origem) e para as fontes.
// Sem esta trava, qualquer GET de terceiro caía no cache-first — inclusive o
// mp3 de um episódio de podcast (dezenas de MB) e o RSS, que precisa vir
// fresco para trazer os episódios novos.
function _cacheavel(url) {
  try {
    const u = new URL(url)
    if (u.origin === self.location.origin) return true
    return /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname)
  } catch { return false }
}

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
  if (url.includes('/js/add.js') || url.includes('/js/study.js') || url.includes('/js/dossie.js') || url.includes('/js/known.js') || url.includes('/js/kindle-db.js') || url.includes('/js/epub.js') || url.includes('/js/ler.js') || url.includes('/js/estante.js') || url.includes('/js/audiobook.js') || url.includes('/js/manga.js') || url.includes('/js/video')) {
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r })
        .catch(() => caches.match(e.request))
    )
    return
  }

  // Terceiros (áudio de podcast, capas, feeds RSS): direto para a rede.
  if (!_cacheavel(url)) return

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
