// ================================================================
// PODCASTS — agregador dentro do módulo Vídeo.
// Carregado LAZY depois de js/video.js (o estado vive lá).
//
// A ideia: escolher um episódio de qualquer podcast do mundo e cair no
// MESMO player de sempre — legenda, régua de falas, tradução PT/IA,
// névoa, Explicar, ditado, shadowing, estudo focado, card com o áudio
// real. Nada de pipeline paralelo.
//
// Como funciona (100% no navegador, sem servidor nosso):
//   1. BUSCA  → API pública do Apple Podcasts (itunes.apple.com/search).
//               Sem chave, com CORS liberado.
//   2. EPISÓDIOS → o RSS do próprio programa (DOMParser). Quase todo host
//               de podcast serve o feed com Access-Control-Allow-Origin: *
//               (verificado em BBC, Megaphone, Simplecast, Libsyn, Fireside,
//               RedCircle, Blubrry). Se o feed recusar, cai no /lookup da
//               Apple, que devolve os últimos episódios com o link do áudio.
//   3. IMPORTAR → baixa o mp3 para o aparelho (IndexedDB, store 'files') e
//               entrega ao player como um File comum. A partir daí TUDO o
//               que já existia funciona sem saber que veio de um podcast:
//               ffmpeg, Whisper, captureStream do áudio da cena.
//               Se o CDN do episódio bloquear CORS, o player toca por
//               streaming (modo limitado — ver _vidStream em video.js).
//   4. LEGENDA → se o feed publicar <podcast:transcript> (Podcasting 2.0),
//               a transcrição entra de GRAÇA, sem gastar Whisper.
// ================================================================

// O ESTADO dos programas (podShows) vive em core.js e é SINCRONIZADO —
// aqui só a UI. Ver "armadilha nº 1" no ESTADO-DO-PROJETO.md.
const POD_SUGESTOES = ['All Ears English', 'BBC Learning English', 'ESL Podcast',
  'TED Talks Daily', 'Lex Fridman', 'Freakonomics Radio']

let _podSt = null                     // estado do modal
let _podAbort = null                  // download em andamento

// Loja da Apple conforme o idioma que está sendo estudado — catálogo de
// podcast é regional, e procurar "ESL" na loja brasileira devolve pouco.
function _podStore() {
  const L = { en: 'US', es: 'ES', fr: 'FR', de: 'DE', it: 'IT', pt: 'BR',
    ja: 'JP', ko: 'KR', ru: 'RU', zh: 'CN', nl: 'NL', sv: 'SE' }
  const l = (typeof activeLang === 'function' ? activeLang() : 'en')
  return L[l] || 'US'
}

function _podLoadShows() { return podShows }
function _podSaveShow(show) {
  const antigo = podShows.find(s => s.feedUrl === show.feedUrl)
  podShows = podShows.filter(s => s.feedUrl !== show.feedUrl)
  // addedAt preservado: é o critério de desempate no merge da nuvem, e revisitar
  // um programa não pode "envelhecer" o registro do outro aparelho.
  podShows.unshift({ ...show, addedAt: (antigo && antigo.addedAt) || new Date().toISOString() })
  podShows = podShows.slice(0, 24)
  savePodShows(); autoSyncAfterChange()
}
function podcastForgetShow(feedUrl) {
  podShows = podShows.filter(s => s.feedUrl !== feedUrl)
  savePodShows(); autoSyncAfterChange()
  _podRender()
}

// ================================================================
// MODAL
// ================================================================
function podcastOpen() {
  _podSt = { passo: 'busca', q: '', resultados: [], buscou: false, buscando: false,
    show: null, episodios: [], filtro: '', erro: '', baixando: null }
  let ov = el('pod-modal')
  if (!ov) {
    ov = document.createElement('div')
    ov.id = 'pod-modal'
    ov.className = 'srs-modal-overlay'
    ov.addEventListener('click', ev => { if (ev.target === ov) podcastClose() })
    document.body.appendChild(ov)
  }
  ov.classList.remove('hidden')
  _podRender()
}

function podcastClose() {
  if (_podSt && _podSt.baixando) { podcastCancelDownload(); return }
  const m = el('pod-modal'); if (m) m.classList.add('hidden')
}

function _podRender() {
  const ov = el('pod-modal'); if (!ov || !_podSt) return
  const st = _podSt
  let corpo = ''

  // ---- Download em andamento: a tela vira uma barra só ----
  if (st.baixando) {
    const b = st.baixando
    const pct = b.pct == null ? null : Math.round(b.pct * 100)
    corpo = `
      <div class="pod-dl">
        <div class="pod-dl-title">${esc(b.titulo)}</div>
        <div class="pod-dl-msg">${esc(b.msg)}</div>
        <div class="pod-dl-bar${pct == null ? ' indet' : ''}"><i style="width:${pct == null ? 100 : pct}%"></i></div>
        <div class="pod-dl-meta">${pct == null ? _podMB(b.got) + ' baixados' : pct + '% · ' + _podMB(b.got) + ' de ' + _podMB(b.total)}</div>
        <button class="btn btn-ghost btn-sm" onclick="podcastCancelDownload()">${ic('x','ic-sm')}Cancelar</button>
      </div>`
    ov.innerHTML = `<div class="vid-sub-card pod-card" onclick="event.stopPropagation()">
      <div class="vid-sub-head"><h3>${ic('mic')}Trazendo o episódio</h3></div>${corpo}</div>`
    return
  }

  // ---- Passo 1: busca de programas ----
  if (st.passo === 'busca') {
    const meus = _podLoadShows()
    corpo = `
      <div class="vid-sub-row">
        <input type="text" id="pod-q" value="${escA(st.q)}" aria-label="Nome do podcast ou URL de um feed RSS" placeholder="Nome do podcast — ou cole a URL de um feed RSS"
          onkeydown="if(event.key==='Enter')podcastSearch(this.value)">
        <button class="btn btn-secondary btn-sm" onclick="podcastSearch(el('pod-q').value)">${ic('search','ic-sm')}Buscar</button>
      </div>
      ${st.buscando ? `<div class="vid-sub-info"><span class="gen-spinner"></span> Procurando no catálogo do Apple Podcasts...</div>` : ''}
      ${st.erro ? `<div class="vid-sub-info">${esc(st.erro)}</div>` : ''}
      ${!st.buscando && st.resultados.length ? `
        <div class="pod-grid">${st.resultados.map((r, i) => `
          <button class="pod-show" onclick="podcastPickShow(${i})">
            ${_podArt(r.artwork, r.title)}
            <span class="pod-show-name">${esc(r.title)}</span>
            <span class="pod-show-meta">${esc(r.artist || '')}${r.trackCount ? ' · ' + r.trackCount + ' eps' : ''}</span>
          </button>`).join('')}</div>` : ''}
      ${!st.buscando && !st.resultados.length && st.buscou && !st.erro
        ? `<div class="vid-sub-info">Nada encontrado — tente o nome exato do programa.</div>` : ''}
      ${!st.buscou && meus.length ? `
        <div class="pod-sec">Seus podcasts</div>
        <div class="pod-grid">${meus.map((s, i) => `
          <button class="pod-show" onclick="podcastOpenSaved(${i})">
            ${_podArt(s.artwork, s.title)}
            <span class="pod-show-name">${esc(s.title)}</span>
            <span class="pod-show-meta">${esc(s.artist || '')}</span>
            <span class="pod-show-x" onclick="event.stopPropagation();podcastForgetShow('${escA(s.feedUrl)}')" data-tip="Tirar da lista">${ic('x','ic-sm')}</span>
          </button>`).join('')}</div>` : ''}
      ${!st.buscou ? `
        <div class="pod-sec">Sugestões</div>
        <div class="pod-chips">${POD_SUGESTOES.map(s => `
          <button class="pod-chip" onclick="podcastSearch('${escA(s)}')">${esc(s)}</button>`).join('')}</div>` : ''}`
  }

  // ---- Passo 2: episódios do programa ----
  else if (st.passo === 'episodios') {
    const s = st.show
    const lista = st.episodios.filter(e => !st.filtro ||
      (e.title + ' ' + (e.desc || '')).toLowerCase().includes(st.filtro.toLowerCase()))
    corpo = `
      <div class="pod-head">
        ${_podArt(s.artwork, s.title, 'pod-art-lg')}
        <div class="pod-head-body">
          <div class="pod-head-name">${esc(s.title)}</div>
          <div class="pod-head-meta">${esc(s.artist || '')}${st.episodios.length ? ` · ${st.episodios.length} episódios` : ''}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="_podSt.passo='busca';_podRender()">${ic('undo','ic-sm')}Voltar</button>
      </div>
      ${st.carregando ? `<div class="vid-sub-info"><span class="gen-spinner"></span> Lendo o feed do programa...</div>` : ''}
      ${st.erro ? `<div class="vid-sub-info">${esc(st.erro)}</div>` : ''}
      ${!st.carregando && st.episodios.length ? `
        <input type="text" class="pod-filter" aria-label="Filtrar episódios" placeholder="Filtrar episódios" value="${escA(st.filtro)}"
          oninput="_podSt.filtro=this.value;_podRenderListaOnly()">
        <div class="pod-eps" id="pod-eps">${_podEpsHtml(lista)}</div>` : ''}`
  }

  ov.innerHTML = `
    <div class="vid-sub-card pod-card" onclick="event.stopPropagation()">
      <div class="vid-sub-head">
        <h3>${ic('mic')}Podcasts</h3>
        <button class="vid-fix-close" onclick="podcastClose()" aria-label="Fechar">${ic('x','ic-sm')}</button>
      </div>
      ${corpo}
      <p class="pod-note">O episódio é baixado para o seu aparelho e estudado como qualquer vídeo:
      legenda, tradução, ditado, shadowing e cards com o áudio real da fala.</p>
    </div>`
  const q = el('pod-q'); if (q && !st.buscando) q.focus()
}

// Re-render só da lista (o filtro digitando não pode perder o foco do campo)
function _podRenderListaOnly() {
  const st = _podSt; if (!st) return
  const box = el('pod-eps'); if (!box) { _podRender(); return }
  const lista = st.episodios.filter(e => !st.filtro ||
    (e.title + ' ' + (e.desc || '')).toLowerCase().includes(st.filtro.toLowerCase()))
  box.innerHTML = _podEpsHtml(lista)
}

function _podEpsHtml(lista) {
  if (!lista.length) return `<div class="vid-sub-info">Nenhum episódio com esse filtro.</div>`
  return lista.map(e => {
    const i = _podSt.episodios.indexOf(e)
    const jaTem = videos.some(v => v.podcast && v.podcast.guid === e.guid)
    return `
    <button class="pod-ep${jaTem ? ' tem' : ''}" onclick="podcastImport(${i})">
      <span class="pod-ep-body">
        <span class="pod-ep-title">${esc(e.title)}</span>
        <span class="pod-ep-meta">
          ${e.date ? `<span>${esc(_podData(e.date))}</span>` : ''}
          ${e.dur ? `<span>${_vidFmtTime(e.dur)}</span>` : ''}
          ${e.size ? `<span>${_podMB(e.size)}</span>` : ''}
          ${e.transcriptUrl ? `<span class="pod-ep-tr" data-tip="O programa publica a transcrição: a legenda entra de graça, sem gastar IA">transcrição inclusa</span>` : ''}
          ${jaTem ? `<span class="pod-ep-tem">já na sua biblioteca</span>` : ''}
        </span>
      </span>
      <span class="pod-ep-go">${ic('play','ic-sm')}</span>
    </button>`
  }).join('')
}

function _podArt(url, alt, cls) {
  if (!url) return `<span class="pod-art ${cls || ''} vazio">${ic('mic')}</span>`
  return `<img class="pod-art ${cls || ''}" src="${escA(url)}" alt="${escA(alt || '')}" loading="lazy">`
}
function _podMB(b) { return b ? (b / 1048576).toFixed(b > 10485760 ? 0 : 1) + ' MB' : '—' }
function _podData(iso) {
  const d = new Date(iso); if (isNaN(d)) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ================================================================
// BUSCA (Apple Podcasts) — ou URL de feed colada
// ================================================================
async function podcastSearch(q) {
  const st = _podSt; if (!st) return
  q = String(q || '').trim()
  st.q = q; st.erro = ''
  if (!q) return

  // Colou um RSS? Vai direto para os episódios.
  if (/^https?:\/\//i.test(q)) {
    st.show = { title: q.replace(/^https?:\/\//, '').split('/')[0], artist: '', artwork: '', feedUrl: q }
    st.passo = 'episodios'; st.episodios = []; st.carregando = true; _podRender()
    await _podCarregarEpisodios(st.show)
    return
  }

  st.buscando = true; st.buscou = true; st.resultados = []; _podRender()
  try {
    const url = `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=24`
      + `&country=${_podStore()}&term=${encodeURIComponent(q)}`
    const j = await fetch(url).then(r => r.json())
    st.resultados = (j.results || [])
      .filter(r => r.feedUrl)
      .map(r => ({
        title: r.collectionName || r.trackName || '(sem nome)',
        artist: r.artistName || '',
        feedUrl: r.feedUrl,
        collectionId: r.collectionId,
        artwork: r.artworkUrl600 || r.artworkUrl100 || r.artworkUrl60 || '',
        trackCount: r.trackCount || 0
      }))
  } catch (e) {
    console.warn('[podcast] busca:', e)
    st.erro = 'A busca falhou (' + e.message + '). Sem internet? Você também pode colar a URL do feed RSS.'
  }
  st.buscando = false
  _podRender()
}

function podcastPickShow(i) {
  const st = _podSt; if (!st) return
  const show = st.resultados[i]; if (!show) return
  st.show = show; st.passo = 'episodios'; st.episodios = []; st.filtro = ''
  st.carregando = true; st.erro = ''
  _podRender()
  _podCarregarEpisodios(show)
}

function podcastOpenSaved(i) {
  const st = _podSt; if (!st) return
  const show = _podLoadShows()[i]; if (!show) return
  st.show = show; st.passo = 'episodios'; st.episodios = []; st.filtro = ''
  st.carregando = true; st.erro = ''
  _podRender()
  _podCarregarEpisodios(show)
}

// ================================================================
// EPISÓDIOS — feed RSS (preferido) com a Apple como plano B
// ================================================================
async function _podCarregarEpisodios(show) {
  const st = _podSt
  let eps = []
  try {
    eps = await _podLerFeed(show.feedUrl, show)
  } catch (e) {
    console.warn('[podcast] feed:', e)
    // Plano B: /lookup da Apple devolve os últimos episódios com episodeUrl.
    if (show.collectionId) {
      try { eps = await _podLookupApple(show.collectionId) } catch (e2) { console.warn('[podcast] lookup:', e2) }
    }
    if (!eps.length) {
      st.erro = 'Não consegui ler o feed deste programa (' + e.message + '). '
        + 'Alguns hosts bloqueiam leitura por outro site.'
    }
  }
  if (!_podSt || _podSt.show !== show) return    // usuário mudou de tela
  st.episodios = eps
  st.carregando = false
  if (eps.length) _podSaveShow({ title: show.title, artist: show.artist, artwork: show.artwork,
    feedUrl: show.feedUrl, collectionId: show.collectionId })
  _podRender()
}

async function _podLerFeed(feedUrl, show) {
  const r = await fetch(_podHttps(feedUrl))
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const doc = new DOMParser().parseFromString(await r.text(), 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('feed ilegível')

  const canal = doc.querySelector('channel') || doc.documentElement
  const artCanal = _podTagAttr(canal, 'itunes:image', 'href') || _podTag(canal, 'image > url')
  if (show && !show.artwork && artCanal) show.artwork = artCanal
  if (show && artCanal) show.artwork = show.artwork || artCanal
  if (show) {
    show.title = show.title || _podTag(canal, 'title') || show.title
    show.artist = show.artist || _podTag(canal, 'itunes:author') || ''
  }

  const itens = [...doc.querySelectorAll('item')]
  return itens.map(it => {
    const enc = it.querySelector('enclosure')
    const url = enc && enc.getAttribute('url')
    if (!url) return null
    const tr = _podTranscriptDe(it)
    return {
      title: (_podTag(it, 'title') || '(sem título)').trim(),
      desc: (_podTag(it, 'itunes:subtitle') || _podTag(it, 'description') || '').replace(/<[^>]*>/g, '').trim().slice(0, 300),
      date: _podTag(it, 'pubDate') || '',
      dur: _podDur(_podTag(it, 'itunes:duration')),
      size: +(enc.getAttribute('length') || 0) || 0,
      url: _podHttps(url),
      tipo: enc.getAttribute('type') || 'audio/mpeg',
      guid: (_podTag(it, 'guid') || url).trim(),
      pageUrl: _podTag(it, 'link') || '',
      art: _podTagAttr(it, 'itunes:image', 'href') || '',
      transcriptUrl: tr ? _podHttps(tr.url) : '',
      transcriptType: tr ? tr.type : ''
    }
  }).filter(Boolean)
}

// <podcast:transcript url="..." type="text/vtt" language="en"/> — Podcasting 2.0.
// Preferimos vtt/srt (viram cues direto); json do PodcastIndex também serve.
function _podTranscriptDe(item) {
  const tags = [...item.children].filter(c => /(^|:)transcript$/i.test(c.tagName))
  if (!tags.length) return null
  const peso = t => /vtt/i.test(t) ? 0 : /srt|subrip/i.test(t) ? 1 : /json/i.test(t) ? 2 : 9
  const bom = tags
    .map(t => ({ url: t.getAttribute('url') || '', type: t.getAttribute('type') || '', lang: t.getAttribute('language') || '' }))
    .filter(t => t.url && peso(t.type) < 9)
    .sort((a, b) => peso(a.type) - peso(b.type))[0]
  return bom || null
}

async function _podLookupApple(collectionId) {
  const url = `https://itunes.apple.com/lookup?id=${collectionId}&media=podcast`
    + `&entity=podcastEpisode&limit=200&country=${_podStore()}`
  const j = await fetch(url).then(r => r.json())
  return (j.results || [])
    .filter(r => r.wrapperType === 'podcastEpisode' && r.episodeUrl)
    .map(r => ({
      title: r.trackName || '(sem título)',
      desc: (r.shortDescription || r.description || '').replace(/<[^>]*>/g, '').slice(0, 300),
      date: r.releaseDate || '',
      dur: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : 0,
      size: 0,
      url: _podHttps(r.episodeUrl),
      tipo: 'audio/' + (r.episodeFileExtension || 'mpeg'),
      guid: r.episodeGuid || r.episodeUrl,
      pageUrl: r.trackViewUrl || '',
      art: r.artworkUrl600 || r.artworkUrl160 || '',
      transcriptUrl: '', transcriptType: ''
    }))
}

// O app roda em https: enclosure em http seria bloqueado como conteúdo misto.
// Praticamente todo host já serve https no mesmo endereço.
function _podHttps(u) { return String(u || '').replace(/^http:\/\//i, 'https://') }

function _podTag(scope, sel) {
  if (!scope) return ''
  // querySelector não aceita prefixo com dois-pontos: procura pelo tagName.
  if (sel.includes(':')) {
    const t = [...scope.children].find(c => c.tagName.toLowerCase() === sel.toLowerCase())
    return t ? (t.textContent || '').trim() : ''
  }
  const n = scope.querySelector(sel)
  return n ? (n.textContent || '').trim() : ''
}
function _podTagAttr(scope, tag, attr) {
  if (!scope) return ''
  const t = [...scope.children].find(c => c.tagName.toLowerCase() === tag.toLowerCase())
  return t ? (t.getAttribute(attr) || '') : ''
}
// "3600" | "58:12" | "1:02:03" → segundos
function _podDur(s) {
  s = String(s || '').trim(); if (!s) return 0
  if (/^\d+$/.test(s)) return +s
  const p = s.split(':').map(n => parseInt(n, 10) || 0)
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : 0
}

// ================================================================
// IMPORTAR O EPISÓDIO → vira entrada de videos[] e abre no player
// ================================================================
async function podcastImport(i) {
  const st = _podSt; if (!st) return
  const ep = st.episodios[i]; if (!ep) return
  const show = st.show

  if (ep.size > 300 * 1048576) {
    if (!(await confirmModal({ title: 'Episódio grande', icon: 'download', confirmText: 'Baixar mesmo assim',
      html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Este episódio tem
        <b>${_podMB(ep.size)}</b>. Ele fica guardado no seu aparelho (pode ser apagado depois
        no botão "Liberar espaço" dentro do player).</p>` }))) return
  }

  // Mesmo episódio já importado antes? Reaproveita a entrada (e o estudo).
  let v = videos.find(x => x.podcast && x.podcast.guid === ep.guid)
  const nomeArq = _podNomeArquivo(ep, show)
  if (!v) {
    v = {
      id: uid(),
      title: ep.title,
      source_type: 'podcast',
      lang: (typeof activeLang === 'function' ? activeLang() : 'en'),
      fileName: nomeArq, fileSize: ep.size || 0,
      duration: ep.dur || 0, cueCount: 0, coverage: null, markers: [],
      podcast: {
        showTitle: show.title || '', feedUrl: show.feedUrl || '',
        collectionId: show.collectionId || null,
        artwork: ep.art || show.artwork || '',
        guid: ep.guid, audioUrl: ep.url, pageUrl: ep.pageUrl || '',
        published: ep.date || '', sizeBytes: ep.size || 0,
        transcriptUrl: ep.transcriptUrl || '', transcriptType: ep.transcriptType || ''
      },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }
    videos.unshift(v); saveVideos(); autoSyncAfterChange()
    // Mesmo motivo do livro: o nome limpo se resolve NA ENTRADA, para que
    // tudo capturado daqui ja nasca com o nome certo na tela. Uma chamada
    // por episodio, em segundo plano.
    if (typeof resolverNomesDeObra === 'function' && aiChatCfg().key) {
      resolverNomesDeObra([v.title]).catch(e => console.warn('[obra]', e && e.message))
    }
  } else {
    // Feed pode ter trocado a URL do arquivo (CDN novo) — mantém em dia.
    v.podcast.audioUrl = ep.url
    v.podcast.transcriptUrl = ep.transcriptUrl || v.podcast.transcriptUrl
    v.podcast.transcriptType = ep.transcriptType || v.podcast.transcriptType
    saveVideos()
  }

  // ⚠️ A NUVEM ENTRA ANTES DO FEED. Ele começa num aparelho e continua em
  // outro: se o episódio já está guardado na conta dele, puxar de lá é mais
  // rápido e não depende do feed ainda ter aquele episódio no ar — episódio
  // sai do feed com o tempo, e aí a cópia dele é a única que existe.
  // Deslogado não há nuvem para procurar: `_midiaRef` devolve null e a busca
  // termina antes de começar. Anunciar a procura assim mesmo é o defeito que o
  // leitor tinha — dizer que olhou onde não dava para olhar.
  let jaBaixado = await VideoDB.get('files', v.id)
  if (!jaBaixado && typeof midiaGarantirLocal === 'function' && typeof _fbUser !== 'undefined' && _fbUser) {
    const t = toast('Procurando o episódio na sua nuvem…', 'info')
    jaBaixado = await midiaGarantirLocal(v.id)
    if (jaBaixado) toast('Episódio recuperado da sua nuvem', 'success')
  }
  if (jaBaixado) {
    _vidFile = new File([jaBaixado], v.fileName || nomeArq, { type: jaBaixado.type || 'audio/mpeg' })
  } else {
    const blob = await podcastBaixarEpisodio(v, ep.title)
    if (blob === 'cancelado') return
    _vidFile = blob ? new File([blob], v.fileName || nomeArq, { type: blob.type || 'audio/mpeg' }) : null
  }

  podcastFechaModalDeVerdade()
  await videoOpenPlayer(v)
  // Transcrição publicada pelo próprio programa: legenda de graça.
  if (!_vidCues.length && v.podcast.transcriptUrl) await podcastAplicarTranscript(v)
}

function podcastFechaModalDeVerdade() {
  const m = el('pod-modal'); if (m) m.classList.add('hidden')
  if (_podSt) _podSt.baixando = null
}

function _podNomeArquivo(ep, show) {
  const base = `${show && show.title ? show.title + ' - ' : ''}${ep.title}`
    .replace(/[^\p{L}\p{N}\-. ]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  const ext = (/\.(mp3|m4a|aac|ogg|opus|wav|flac)(\?|$)/i.exec(ep.url) || [, 'mp3'])[1].toLowerCase()
  return (base || 'episodio') + '.' + ext
}

// Baixa o mp3 com barra de progresso. Devolve o Blob, null (falhou → o
// player toca por streaming) ou 'cancelado'.
async function podcastBaixarEpisodio(v, titulo) {
  const st = _podSt
  const set = (msg, pct, got, total) => {
    if (!st) return
    st.baixando = { titulo, msg, pct, got, total }
    _podRender()
  }
  set('Conectando...', null, 0, v.podcast.sizeBytes || 0)
  _podAbort = new AbortController()
  try {
    const r = await fetch(v.podcast.audioUrl, { signal: _podAbort.signal })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const total = +(r.headers.get('content-length') || 0) || v.podcast.sizeBytes || 0
    let blob
    if (!r.body || !r.body.getReader) {
      set('Baixando...', null, 0, total)
      blob = await r.blob()
    } else {
      const reader = r.body.getReader()
      const partes = []; let got = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        partes.push(value); got += value.length
        set('Baixando o áudio para o seu aparelho...', total ? Math.min(1, got / total) : null, got, total)
      }
      blob = new Blob(partes, { type: r.headers.get('content-type') || 'audio/mpeg' })
    }
    set('Guardando...', 1, blob.size, blob.size)
    await VideoDB.set('files', v.id, blob)
    v.fileSize = blob.size
    if (!v.podcast.sizeBytes) v.podcast.sizeBytes = blob.size
    saveVideos()
    // Sobe em segundo plano, sem segurar a tela: episódio tem dezenas de MB e
    // ele quer ouvir agora. Se falhar, o arquivo continua aqui e a próxima
    // abertura tenta de novo.
    if (typeof midiaGarantirNaNuvem === 'function') midiaGarantirNaNuvem(v.id, blob)
    if (st) st.baixando = null
    return blob
  } catch (e) {
    if (st) st.baixando = null
    if (e.name === 'AbortError') { _podRender(); return 'cancelado' }
    console.warn('[podcast] download:', e)
    toast('Não deu para baixar o episódio (' + e.message + '). Vou tocar direto da internet — '
      + 'a legenda com IA e o áudio das falas ficam indisponíveis neste modo.', 'warning')
    return null
  } finally { _podAbort = null }
}

function podcastCancelDownload() {
  if (_podAbort) _podAbort.abort()
  if (_podSt) { _podSt.baixando = null; _podRender() }
}

// ================================================================
// TRANSCRIÇÃO PUBLICADA PELO PROGRAMA (Podcasting 2.0) → legenda grátis
// ================================================================
async function podcastAplicarTranscript(v) {
  const t = v.podcast && v.podcast.transcriptUrl; if (!t) return
  try {
    toast('Este programa publica a transcrição — baixando (sem custo de IA)...', 'info')
    const r = await fetch(t)
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const txt = await r.text()
    let cues = []
    if (/json/i.test(v.podcast.transcriptType) || /^\s*\{/.test(txt)) cues = _podCuesDeJson(txt)
    else cues = parseSubtitle(txt)
    if (cues.length < 5) throw new Error('transcrição vazia ou em formato não suportado')
    await _vidApplyCues(cues, 'do próprio programa (transcrição publicada)')
  } catch (e) {
    console.warn('[podcast] transcript:', e)
    toast('A transcrição publicada não deu certo — dá para criar uma com IA no transcript.', 'info')
  }
}

// Formato JSON do PodcastIndex: {segments:[{startTime,endTime,body,speaker}]}.
// Costuma vir palavra a palavra: agrupamos em falas de até ~8s, quebrando na
// pontuação (senão o transcript viraria uma lista de palavras soltas).
function _podCuesDeJson(txt) {
  let j; try { j = JSON.parse(txt) } catch { return [] }
  const segs = j.segments || j.results || []
  const cues = []
  let atual = null
  for (const s of segs) {
    const ini = +(s.startTime ?? s.start ?? 0)
    const fim = +(s.endTime ?? s.end ?? ini)
    const txt2 = String(s.body ?? s.text ?? '').trim()
    if (!txt2) continue
    if (!atual) atual = { s: ini, e: fim, t: txt2 }
    else {
      atual.t += (/^[',.!?;:]/.test(txt2) ? '' : ' ') + txt2
      atual.e = fim
    }
    const fechou = /[.!?]"?$/.test(atual.t) || (atual.e - atual.s) >= 8 || atual.t.length > 180
    if (fechou) { cues.push(atual); atual = null }
  }
  if (atual) cues.push(atual)
  return cues.map(c => ({ s: +c.s.toFixed(2), e: +c.e.toFixed(2), t: c.t.replace(/\s+/g, ' ').trim() }))
}

// ================================================================
// GARANTIR O ARQUIVO ao reabrir da biblioteca (chamado por videoOpen)
// ================================================================
async function podcastEnsureFile(v) {
  const blob = await VideoDB.get('files', v.id)
  if (blob) {
    _vidFile = new File([blob], v.fileName || 'episodio.mp3', { type: blob.type || 'audio/mpeg' })
    return true
  }
  if (!v.podcast || !v.podcast.audioUrl) return false
  // Não está no aparelho (outro dispositivo, ou o espaço foi liberado):
  // baixa de novo mostrando o progresso no mesmo modal.
  if (!_podSt) _podSt = { passo: 'busca', resultados: [], episodios: [] }
  let ov = el('pod-modal')
  if (!ov) {
    ov = document.createElement('div')
    ov.id = 'pod-modal'; ov.className = 'srs-modal-overlay'
    document.body.appendChild(ov)
  }
  ov.classList.remove('hidden')
  const blob2 = await podcastBaixarEpisodio(v, v.title)
  podcastFechaModalDeVerdade()
  if (blob2 === 'cancelado') return false
  _vidFile = blob2 ? new File([blob2], v.fileName || 'episodio.mp3', { type: blob2.type || 'audio/mpeg' }) : null
  return true
}

// Libera o espaço do episódio sem perder nada do estudo (cards, legenda,
// marcadores e cortes continuam; o áudio volta a ser baixado quando precisar).
async function podcastFreeSpace() {
  const v = _vidCur; if (!v || !v.podcast) return
  if (!(await confirmModal({ title: 'Liberar espaço', icon: 'trash', confirmText: 'Apagar o áudio baixado',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Apaga só o <b>arquivo de áudio</b>
      guardado neste aparelho (${_podMB(v.fileSize || 0)}).
      <b>Nada do estudo é perdido</b>: legenda, marcadores, cortes e cards continuam —
      e a <b>cópia na sua nuvem fica</b>, então o episódio volta na hora, sem depender do feed.</p>` }))) return
  // ⚠️ A NUVEM NÃO É TOCADA AQUI, de propósito. Este botão é "liberar espaço
  // neste aparelho" — apagar a cópia da conta transformaria uma faxina em
  // perda, e é justamente ela que faz o episódio voltar depois.
  await VideoDB.del('files', v.id)
  toast('Áudio apagado deste aparelho — a cópia na nuvem continua', 'success')
  videoBackToLib()
}
