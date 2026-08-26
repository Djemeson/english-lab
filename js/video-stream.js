// ================================================================
// ASSISTIR — o Lab como CLIENTE de addons de vídeo do Stremio
// CARREGADO LAZY junto do pacote de vídeo (o player é reaproveitado
// inteiro: legenda clicável, tradução, marcar, cards com áudio real).
//
// O que este arquivo faz e o que NÃO faz:
//   - FALA o protocolo aberto de addons: {addon}/stream/{tipo}/{id}.json,
//     título via Cinemeta (o mesmo catálogo que a busca de legenda já usa).
//   - CLASSIFICA cada fonte: link direto (toca), torrent (infoHash — o
//     navegador não baixa torrent; precisa de debrid), ou externa.
//   - RESOLVE com debrid (Real-Debrid) quando há token: magnet -> link
//     HTTPS direto. ⚠️ Caminho EXPERIMENTAL — depende de a Real-Debrid
//     liberar CORS para o navegador; se bloquear, o app avisa em vez de
//     falhar mudo.
//   - TOCA o que o navegador decodifica (mp4/webm/mov...). MKV e HLS o
//     <video> não abre sozinho — a fonte é marcada como tal, sem enganar.
//
// A identidade do conteúdo (imdb + SxxExx) é ESTÁVEL e vira uma entrada em
// videos[] — então legenda, marcadores e cards persistem e sincronizam.
// A URL da fonte é TRANSITÓRIA (link de debrid expira): nunca é salva na
// nuvem; é re-resolvida ao abrir.
// ================================================================

// Sem addon padrão de propósito: o app não embute nenhuma fonte. Cada um
// cola o(s) addon(s) que quiser — o mesmo formato do Stremio/Nuvio.
function _streamAddons() {
  return (cfg.streamAddons || '').split(/\n+/)
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(s => /^https?:\/\//.test(s))
    .map(s => s.replace(/\/manifest\.json$/i, ''))  // aceita colar o manifest
    .filter((v, i, a) => a.indexOf(v) === i)
}

let _asState = null

// Fonte HTTP dentro de página HTTPS = bloqueio de conteúdo misto (o navegador
// recusa em silêncio). Reescreve para o nosso proxy HTTPS (mesma origem, então
// captureStream também volta a valer). Fonte já HTTPS toca direto.
function _asPreparaUrl(url) {
  if (!url) return url
  if (location.protocol === 'https:' && /^http:\/\//i.test(url)) {
    return '/api/stream?u=' + encodeURIComponent(url)
  }
  return url
}

// ================================================================
// SEÇÃO — busca de título -> episódio -> lista de fontes
// ================================================================
function renderAssistir() {
  if (!_asState) _asState = { passo: 'busca', resultados: [], meta: null, temporada: 1, episodio: 1, fontes: [] }
  _asRender()
}

function _asRender() {
  const acts = el('assistir-ph-actions')
  if (acts) acts.innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="showSection('video')" data-tip="Voltar à biblioteca de vídeo (arquivos, podcasts e o que você já assistiu por aqui)">${ic('film')}Biblioteca</button>`
  const area = el('assistir-area'); if (!area) return
  const st = _asState
  const nAdd = _streamAddons().length

  if (!nAdd) {
    area.innerHTML = `
      <div class="srs-empty">
        ${ic('film','ic-xl')}
        <p style="font-size:var(--fs-base);font-weight:600;margin:8px 0">Nenhum addon de vídeo configurado</p>
        <p style="font-size:var(--fs-md);max-width:520px;margin:0 auto 6px">Cole a URL de um ou mais addons de fonte (torrent, link direto ou debrid) —
        o mesmo endereço que você usaria no Stremio ou no Nuvio. As ferramentas de estudo do Lab entram por cima do que tocar.</p>
        <p style="font-size:var(--fs-sm);color:var(--text3);max-width:520px;margin:0 auto 18px">Para torrent tocar no navegador é preciso um serviço <b>debrid</b> (converte em link direto). Sem debrid, use um addon de link direto.</p>
        ${_asAddonsPanel(true)}
      </div>`
    return
  }

  let corpo = ''
  if (st.passo === 'busca') {
    corpo = `
      <div class="vid-sub-row">
        <input type="text" id="as-q" value="${escA(st.query || '')}" aria-label="Nome da série ou filme" placeholder="Nome da série ou filme"
          onkeydown="if(event.key==='Enter')assistirSearch(this.value)">
        <button class="btn btn-primary btn-sm" onclick="assistirSearch(el('as-q').value)">${ic('search','ic-sm')}Buscar</button>
      </div>
      ${st.buscando ? `<div class="vid-sub-info"><span class="gen-spinner"></span> Buscando no catálogo...</div>` :
        st.resultados.length ? `<div class="as-result-grid">${st.resultados.map((r, i) => `
          <button class="as-result" onclick="assistirPickTitle(${i})" title="${escA(r.name)}">
            <span class="as-result-capa">${r.poster
              ? `<img src="${escA(r.poster)}" alt="" onerror="this.parentNode.classList.add('as-sem-capa')">`
              : ''}<span class="as-result-ph">${ic('film')}</span></span>
            <span class="as-result-nome">${esc(r.name)}</span>
            <span class="as-result-meta">${r.type === 'series' ? 'série' : 'filme'}${r.year ? ' · ' + esc(String(r.year)) : ''}</span>
          </button>`).join('')}</div>` :
        st.buscou ? `<div class="vid-sub-info">Nada encontrado — tente só o nome, sem números.</div>` : ''}`
  } else if (st.passo === 'episodio') {
    corpo = `
      <button class="btn btn-ghost btn-sm" onclick="_asState.passo='busca';_asRender()">${ic('undo','ic-sm')}trocar título</button>
      <div class="vid-sub-picked" style="margin-top:8px">${esc(st.meta.name)} <span>série</span></div>
      <div class="vid-sub-row">
        <label>Temporada <input type="number" id="as-s" min="0" max="99" value="${st.temporada}"></label>
        <label>Episódio <input type="number" id="as-e" min="0" max="999" value="${st.episodio}"></label>
        <button class="btn btn-primary btn-sm" onclick="assistirLoadStreams(+el('as-s').value, +el('as-e').value)">${ic('search','ic-sm')}Ver fontes</button>
      </div>`
  } else if (st.passo === 'fontes') {
    corpo = _asFontesCorpo(st)
  }

  area.innerHTML = `
    <div class="as-wrap">
      ${corpo}
      ${_asAddonsPanel(false)}
    </div>`
  const q = el('as-q'); if (q && st.passo === 'busca' && !st.buscando) q.focus()
}

function _asFontesCorpo(st) {
  const cab = `
    <div class="vid-sub-picked">
      ${st.meta.poster ? `<img class="as-picked-capa" src="${escA(st.meta.poster)}" alt="" onerror="this.style.display='none'">` : ''}
      ${esc(st.meta.name)}${st.meta.type === 'series' ? ` <b>S${String(st.temporada).padStart(2,'0')}E${String(st.episodio).padStart(2,'0')}</b>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="_asState.passo='${st.meta.type === 'series' ? 'episodio' : 'busca'}';_asRender()" style="margin-left:auto">trocar</button></div>`
  if (st.carregando) return cab + `<div class="vid-sub-info"><span class="gen-spinner"></span> Consultando ${_streamAddons().length} addon(s)...</div>`
  if (!st.fontes.length) return cab + `<div class="vid-sub-info">Nenhuma fonte nos addons configurados para este título.</div>`

  return cab + `<div class="as-list">${st.fontes.map((f, i) => {
    const tocavel = f.kind === 'url' && (f.nativo || f.hls)
    const cls = tocavel ? 'as-ok' : (f.kind === 'url' ? 'as-warn' : (f.kind === 'magnet' && _asTemDebrid()) ? 'as-warn' : 'as-block')
    const acao = tocavel ? (f.hls ? 'toca aqui (HLS)' : 'toca aqui')
      : f.kind === 'url' ? 'formato que o navegador não abre'
      : f.kind === 'magnet' ? (_asTemDebrid() ? 'torrent · resolver com debrid' : 'torrent · precisa de debrid')
      : 'fonte externa'
    return `
      <button class="as-item ${cls}" onclick="assistirPlaySource(${i})" ${(!tocavel && !(f.kind === 'magnet' && _asTemDebrid())) ? 'data-block="1"' : ''}>
        <div class="as-item-main">
          <span class="as-badges">
            ${f.quality ? `<span class="as-b as-b-q">${esc(f.quality)}</span>` : ''}
            ${f.hdr ? `<span class="as-b">${esc(f.hdr)}</span>` : ''}
            ${f.codec ? `<span class="as-b">${esc(f.codec)}</span>` : ''}
            ${f.size ? `<span class="as-b">${esc(f.size)}</span>` : ''}
            ${f.seeders != null ? `<span class="as-b as-b-s" data-tip="Semeadores: quanto maior, mais rápido">${f.seeders}${ic('arrowRight','ic-sm')}</span>` : ''}
          </span>
          <span class="as-name">${esc(f.label)}</span>
        </div>
        <div class="as-item-side">
          <span class="as-addon">${esc(f.addon)}</span>
          <span class="as-acao">${acao}</span>
        </div>
      </button>`
  }).join('')}</div>
  <p class="as-legenda-nota">Ao escolher, a fonte abre no player do Lab: a legenda em inglês é buscada sozinha e todas as ferramentas de estudo aparecem.</p>`
}

function _asAddonsPanel(aberto) {
  return `
    <details class="vid-sub-addons" ${aberto ? 'open' : ''}>
      <summary>Addons e debrid (${_streamAddons().length} addon${_streamAddons().length !== 1 ? 's' : ''}${_asTemDebrid() ? ' · debrid ligado' : ''})</summary>
      <p>Um addon por linha — qualquer addon de fonte do Stremio funciona (o protocolo é aberto). Para debrid, o jeito mais estável é colar a URL do addon <b>já com sua chave configurada</b>.</p>
      <textarea id="as-addons-ta" rows="3" aria-label="Addons de vídeo, um por linha" placeholder="https://torrentio.strem.io/…  (cole a URL do seu addon, com debrid se tiver)">${esc(cfg.streamAddons || '')}</textarea>
      <p style="margin-top:10px">Token do <b>Real-Debrid</b> (opcional — resolve torrent solto em link direto). Experimental: pode ser barrado pela Real-Debrid no navegador.</p>
      <input type="text" id="as-rd" class="as-rd-input" aria-label="Token da API do Real-Debrid" placeholder="Token da API do Real-Debrid" value="${escA(cfg.debridRD || '')}">
      <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="assistirSaveCfg()">${ic('download','ic-sm')}Salvar</button>
    </details>`
}

function assistirSaveCfg() {
  cfg.streamAddons = (el('as-addons-ta') ? el('as-addons-ta').value : cfg.streamAddons || '').trim()
  cfg.debridRD = (el('as-rd') ? el('as-rd').value : cfg.debridRD || '').trim()
  saveCfg(); if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast('Configuração salva', 'success')
  _asRender()
}
function _asTemDebrid() { return !!(cfg.debridRD || '').trim() }

// ================================================================
// BUSCA DE TÍTULO — Cinemeta (o mesmo catálogo da busca de legenda)
// ================================================================
async function assistirSearch(query) {
  const st = _asState; if (!st) return
  query = String(query || '').trim(); if (!query) return
  st.query = query; st.buscando = true; st.buscou = true; st.passo = 'busca'; _asRender()
  try {
    const enc = encodeURIComponent(query)
    const [se, mo] = await Promise.all(['series', 'movie'].map(t =>
      fetch(`https://v3-cinemeta.strem.io/catalog/${t}/top/search=${enc}.json`)
        .then(r => r.json()).then(j => (j.metas || []).slice(0, 6)).catch(() => [])))
    st.resultados = [...se.map(m => ({ ...m, type: 'series' })), ...mo.map(m => ({ ...m, type: 'movie' }))]
      .map(m => ({ id: m.imdb_id || m.id, name: m.name, year: (m.releaseInfo || '').slice(0, 4), type: m.type, poster: m.poster || '' }))
      .filter(m => /^tt/.test(m.id)).slice(0, 10)
  } catch (e) { st.resultados = []; toast('Busca falhou: ' + e.message, 'error') }
  st.buscando = false; _asRender()
}

function assistirPickTitle(i) {
  const st = _asState; if (!st) return
  st.meta = st.resultados[i]
  if (st.meta.type === 'series') { st.passo = 'episodio'; _asRender() }
  else assistirLoadStreams()
}

async function assistirLoadStreams(temporada, episodio) {
  const st = _asState; if (!st) return
  if (temporada != null) { st.temporada = temporada; st.episodio = episodio }
  st.passo = 'fontes'; st.carregando = true; _asRender()
  st.fontes = await _asFetchStreams(st.meta, st.temporada, st.episodio)
  st.carregando = false; _asRender()
}

// Consulta todos os addons em paralelo e devolve as fontes já classificadas
// e ordenadas (tocáveis primeiro, depois por qualidade e semeadores).
async function _asFetchStreams(meta, temporada, episodio) {
  const id = meta.type === 'series' ? `${meta.id}:${temporada}:${episodio}` : meta.id
  const vistos = new Set(); const fontes = []
  await Promise.all(_streamAddons().map(async base => {
    const nome = base.replace(/^https?:\/\//, '').split('/')[0].split('.')[0]
    try {
      const r = await fetch(`${base}/stream/${meta.type}/${encodeURIComponent(id)}.json`)
      if (!r.ok) return
      const j = await r.json()
      ;(j.streams || []).forEach(sb => {
        const f = _asClassify(sb, nome)
        if (!f) return
        // dedup: por URL, ou por infoHash+arquivo
        const chave = f.playUrl || (f.infoHash && (f.infoHash + ':' + (f.fileIdx ?? '')))
        if (chave && vistos.has(chave)) return
        if (chave) vistos.add(chave)
        fontes.push(f)
      })
    } catch (e) { console.warn('[assistir] addon', base, e.message) }
  }))
  const qNum = q => ({ '2160p': 4, '4k': 4, '1080p': 3, '720p': 2, '480p': 1 }[String(q || '').toLowerCase()] || 0)
  fontes.sort((a, b) => {
    const ta = (a.kind === 'url' && (a.nativo || a.hls)) ? 0 : 1
    const tb = (b.kind === 'url' && (b.nativo || b.hls)) ? 0 : 1
    if (ta !== tb) return ta - tb
    if (qNum(b.quality) !== qNum(a.quality)) return qNum(b.quality) - qNum(a.quality)
    return (b.seeders || 0) - (a.seeders || 0)
  })
  return fontes.slice(0, 60)
}

// ================================================================
// CLASSIFICAÇÃO DE UMA FONTE
// ================================================================
const _AS_NATIVO = /\.(mp4|m4v|webm|ogv|ogg|mov)($|\?)/i   // o que o <video> abre
const _AS_HLS = /\.(m3u8)($|\?)/i

function _asClassify(sb, addon) {
  const titulo = [sb.name, sb.title, sb.description].filter(Boolean).join('\n')
  const bh = sb.behaviorHints || {}
  const nomeArq = bh.filename || sb.title || sb.name || ''
  const base = {
    addon,
    label: _asLabel(sb, nomeArq),
    quality: (/(2160p|4k|1080p|720p|480p|360p)/i.exec(titulo) || [])[1] || '',
    hdr: (/(HDR10\+|HDR|Dolby ?Vision|DV)\b/i.exec(titulo) || [])[1] || '',
    codec: (/(x265|HEVC|H\.?265|x264|H\.?264|AV1)\b/i.exec(titulo) || [])[1] || '',
    size: _asFmtTam(bh.videoSize) || (/(?:💾|Size:?)\s*([\d.]+\s*[GM]B)/i.exec(titulo) || [])[1] || '',
    seeders: _asNum((/(?:👤|Seeders?:?|Seeds?:?)\s*(\d+)/i.exec(titulo) || [])[1]),
    quality_raw: sb.name || ''
  }
  // 1) Link direto (debrid-resolvido ou addon de link direto)
  const url = sb.url || bh.proxyUrl
  if (url && /^https?:\/\//.test(url)) {
    return { ...base, kind: 'url', playUrl: url,
      nativo: _AS_NATIVO.test(url) || _AS_NATIVO.test(nomeArq) || (!/\.\w{2,4}($|\?)/.test(url) && !_AS_HLS.test(url)),
      hls: _AS_HLS.test(url) }
  }
  // 2) Torrent (infoHash) — o navegador não baixa torrent
  if (sb.infoHash) {
    return { ...base, kind: 'magnet', infoHash: String(sb.infoHash).toLowerCase(),
      fileIdx: (sb.fileIdx != null ? sb.fileIdx : null), sources: sb.sources || [], nativo: false }
  }
  // 3) Externa (YouTube, página) — não embutível aqui
  if (sb.externalUrl || sb.ytId) {
    return { ...base, kind: 'external', ext: sb.externalUrl || ('https://youtu.be/' + sb.ytId), nativo: false }
  }
  return null
}

function _asLabel(sb, nomeArq) {
  // Primeira linha "limpa" do título/nome, sem os emojis de metadados.
  let t = (sb.title || sb.name || nomeArq || 'fonte').split('\n')
    .map(s => s.trim()).find(s => s && !/^[\p{Emoji}\s]/u.test(s)) || (sb.name || 'fonte')
  return t.replace(/\.(mkv|mp4|avi|m4v|webm|mov)$/i, '').replace(/[._]+/g, ' ').slice(0, 120).trim()
}
function _asNum(x) { const n = parseInt(x, 10); return isNaN(n) ? null : n }
function _asFmtTam(bytes) {
  if (!bytes || isNaN(bytes)) return ''
  const gb = bytes / 1e9
  return gb >= 1 ? gb.toFixed(2) + ' GB' : Math.round(bytes / 1e6) + ' MB'
}

// ================================================================
// TOCAR UMA FONTE — resolve a URL e abre o player do Lab
// ================================================================
async function assistirPlaySource(i) {
  const st = _asState; if (!st) return
  const f = st.fontes[i]; if (!f) return

  if (f.kind === 'external') {
    toast('Esta fonte abre fora do app (YouTube ou página) — não dá para estudar por aqui', 'warning'); return
  }
  if (f.kind === 'url' && !f.nativo && !f.hls) {
    toast('O navegador não decodifica esse formato (provável MKV). Escolha uma fonte mp4/HLS ou use debrid com saída mp4', 'warning'); return
  }
  if (f.kind === 'magnet' && !_asTemDebrid()) {
    toast('Isto é um torrent: o navegador não baixa torrent. Configure um debrid (campo abaixo) ou use um addon de link direto', 'warning'); return
  }

  let url = _asPreparaUrl(f.playUrl)
  if (f.kind === 'magnet') {
    const btnTxt = 'resolvendo no debrid...'
    toast(btnTxt, 'info')
    try { url = await _rdResolveMagnet(f) }
    catch (e) { toast('Debrid falhou: ' + e.message, 'error'); return }
    if (!url) { toast('O debrid não devolveu um link tocável para esta fonte', 'error'); return }
    if (!_AS_NATIVO.test(url) && /\.(mkv|avi)($|\?)/i.test(url)) {
      toast('O debrid devolveu um MKV, que o navegador não abre. Tente outra fonte', 'warning'); return
    }
  }

  const v = _asEnsureVideo(st.meta, st.temporada, st.episodio, f)
  if (typeof videoOpenStream === 'function') videoOpenStream(v, url)
  else toast('Player de vídeo indisponível', 'error')
}

// Cria (ou reencontra) a entrada estável em videos[] para este conteúdo.
// A identidade é o id do conteúdo (imdb + SxxExx) — não a URL, que expira.
function _asEnsureVideo(meta, temporada, episodio, fonte) {
  const cid = meta.type === 'series' ? `${meta.id}:${temporada}:${episodio}` : meta.id
  let v = videos.find(x => x.stream && x.stream.contentId === cid)
  const titulo = meta.type === 'series'
    ? `${meta.name} S${String(temporada).padStart(2, '0')}E${String(episodio).padStart(2, '0')}`
    : meta.name
  if (!v) {
    v = {
      id: uid(), title: titulo, source_type: 'stream',
      lang: (typeof activeLang === 'function' ? activeLang() : 'en'),
      duration: 0, cueCount: 0, coverage: null, markers: [],
      stream: { contentId: cid, imdbType: meta.type, imdbId: meta.id, temporada, episodio },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }
    videos.unshift(v); saveVideos(); if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  }
  // guarda o descritor da última fonte escolhida (para reabrir/re-resolver)
  v.stream.ultimaFonte = { addon: fonte.addon, quality: fonte.quality, label: fonte.label,
    kind: fonte.kind, infoHash: fonte.infoHash || null, fileIdx: fonte.fileIdx ?? null,
    sources: fonte.sources || null, playUrl: fonte.kind === 'url' ? fonte.playUrl : null }
  v.updated_at = new Date().toISOString(); saveVideos()
  return v
}

// Reabrir uma entrada de stream vinda da Biblioteca de vídeo: a URL expira,
// então voltamos à seção Assistir e recarregamos as fontes deste conteúdo.
function assistirReabrir(v) {
  const s = v.stream || {}
  showSection('assistir')
  const start = () => {
    if (typeof renderAssistir !== 'function') { setTimeout(start, 120); return }
    _asState = { passo: 'fontes', resultados: [], fontes: [], carregando: true,
      meta: { id: s.imdbId, name: (v.title || '').replace(/\s+S\d{2}E\d{2}$/i, ''), type: s.imdbType || 'movie' },
      temporada: s.temporada || 1, episodio: s.episodio || 1 }
    assistirLoadStreams(_asState.temporada, _asState.episodio)
  }
  start()
}

// ================================================================
// REAL-DEBRID — magnet -> link direto (EXPERIMENTAL)
// Fluxo oficial: addMagnet -> selectFiles -> info(links) -> unrestrict.
// ⚠️ Depende de a Real-Debrid mandar CORS para o navegador; se não mandar,
// a chamada falha e o app avisa. Não testado com conta real.
// ================================================================
async function _rdResolveMagnet(f) {
  const token = (cfg.debridRD || '').trim()
  if (!token) throw new Error('sem token de debrid')
  const API = 'https://api.real-debrid.com/rest/1.0'
  const H = { Authorization: 'Bearer ' + token }
  const magnet = _asMagnet(f)

  const add = await _rdReq(`${API}/torrents/addMagnet`, { method: 'POST', headers: H, body: new URLSearchParams({ magnet }) })
  const tid = add.id
  // escolhe o maior arquivo de vídeo (ou o fileIdx que o addon indicou)
  const info1 = await _rdReq(`${API}/torrents/info/${tid}`, { headers: H })
  const files = info1.files || []
  let escolha
  if (f.fileIdx != null && files[f.fileIdx]) escolha = files[f.fileIdx].id
  else {
    const vids = files.filter(x => /\.(mp4|mkv|webm|m4v|avi|mov)$/i.test(x.path))
    vids.sort((a, b) => b.bytes - a.bytes)
    escolha = (vids[0] || files[0] || {}).id
  }
  if (!escolha) throw new Error('nenhum arquivo no torrent')
  await _rdReq(`${API}/torrents/selectFiles/${tid}`, { method: 'POST', headers: H, body: new URLSearchParams({ files: String(escolha) }) })
  // espera ficar pronto (cache do RD costuma ser instantâneo)
  let info2, tentativas = 0
  do {
    info2 = await _rdReq(`${API}/torrents/info/${tid}`, { headers: H })
    if (info2.status === 'downloaded') break
    if (['magnet_error', 'error', 'virus', 'dead'].includes(info2.status)) throw new Error('torrent inválido no debrid (' + info2.status + ')')
    await new Promise(r => setTimeout(r, 1500))
  } while (++tentativas < 8)
  const link = (info2.links || [])[0]
  if (!link) throw new Error('torrent ainda não está no cache do debrid — tente outra fonte')
  const un = await _rdReq(`${API}/unrestrict/link`, { method: 'POST', headers: H, body: new URLSearchParams({ link }) })
  return un.download
}

async function _rdReq(url, opt) {
  const r = await fetch(url, opt)
  if (!r.ok) {
    let msg = 'HTTP ' + r.status
    try { const j = await r.json(); if (j.error) msg = j.error } catch (e) {}
    throw new Error(msg)
  }
  return r.json().catch(() => ({}))
}

function _asMagnet(f) {
  const trackers = (f.sources || [])
    .filter(s => /^tracker:/.test(s)).map(s => '&tr=' + encodeURIComponent(s.replace(/^tracker:/, '')))
    .join('')
  return `magnet:?xt=urn:btih:${f.infoHash}` + trackers
}
