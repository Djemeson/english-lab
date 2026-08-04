// ================================================================
// VÍDEO / LEGENDAS — parser, busca (addons Stremio), aplicação, trilha
// PT alinhada, traduções, export .srt e transcrição de episódio (IA).
// Carregado LAZY depois de js/video.js (o estado vive lá).
// ================================================================
function videoImportSubPick() {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = '.srt,.vtt,text/*'
  inp.onchange = () => { if (inp.files[0]) _vidReadSubFile(inp.files[0]) }
  inp.click()
}
function videoDropSub(ev) {
  ev.preventDefault()
  const f = ev.dataTransfer?.files?.[0]
  if (f) _vidReadSubFile(f)
}
function _vidReadSubFile(file) {
  const reader = new FileReader()
  reader.onload = async e => {
    const cues = parseSubtitle(String(e.target.result || ''))
    if (!cues.length) { toast('Não reconheci falas nesse arquivo — é um .srt/.vtt válido?', 'error'); return }
    _vidCues = cues
    await VideoDB.set('subs', _vidCur.id, { cues })
    _vidCur.cueCount = cues.length; _vidCur.updated_at = new Date().toISOString()
    saveVideos(); autoSyncAfterChange()
    renderVidTranscript()
    const cc = el('vid-cue-count'); if (cc) cc.textContent = cues.length + ' falas'
    toast(`Legenda importada: ${cues.length} falas`, 'success')
  }
  reader.readAsText(file)
}

// Parser tolerante: SRT e VTT, CRLF/BOM, tags <i>/{...} removidas.
function parseSubtitle(text) {
  text = text.replace(/^﻿/, '').replace(/\r/g, '')
  const cues = []
  const tc = str => {
    const p = str.replace(',', '.').split(':').map(parseFloat)
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
  }
  text.split(/\n{2,}/).forEach(block => {
    const lines = block.split('\n').filter(l => l.trim() !== '')
    const ti = lines.findIndex(l => l.includes('-->'))
    if (ti < 0) return
    const m = lines[ti].match(/(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/g)
    if (!m || m.length < 2) return
    const t = lines.slice(ti + 1).join(' ')
      .replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '')
      .replace(/\s+/g, ' ').trim()
    if (t) cues.push({ s: tc(m[0]), e: tc(m[1]), t })
  })
  cues.sort((a, b) => a.s - b.s)
  return cues
}

// ================================================================
// TRANSCRIPT
// ================================================================
async function videoCuePT(i) {
  const c = _vidCues[i]; if (!c) return
  if (!_vidPTof(c)) {
    if (!cfg.openaiKey) { toast('Sem legenda PT alinhada nem chave OpenAI', 'warning'); return }
    const row = el('vid-cue-pt-' + i)
    if (row) { row.classList.remove('hid'); row.textContent = '…' }
    try { await _vidEnsurePT(i, 1, true) } catch (e) { toast('Erro ao traduzir: ' + e.message, 'error'); return }
  }
  c._rev = true
  const row = el('vid-cue-pt-' + i)
  if (row) { row.textContent = _vidPTof(c); row.classList.remove('hid'); row.classList.add('show') }
}

// Toca só o intervalo de uma fala
async function videoTranslateSel() {
  if (!_vidSel) return
  try {
    let precisouIA = false
    for (let i = _vidSel.ci; i <= _vidSel.cj; i++) {
      if (!_vidPTof(_vidCues[i])) precisouIA = true
      _vidCues[i]._rev = true
    }
    if (precisouIA) {
      if (!cfg.openaiKey) { toast('Sem legenda PT alinhada — configure a chave OpenAI ou busque a legenda PT', 'warning'); return }
      await _vidEnsurePT(_vidSel.ci, _vidSel.cj - _vidSel.ci + 1, true)
    }
    _vidSel.pt = _vidCues.slice(_vidSel.ci, _vidSel.cj + 1).map(c => _vidPTof(c))
      .filter((t, i, a) => t && t !== a[i - 1]).join(' ')
    renderVidTranscript()
    renderVidSelPanel()
  } catch (e) { toast('Erro ao traduzir: ' + e.message, 'error') }
}

// ================================================================
// ÁUDIO REAL DA CENA — captureStream + MediaRecorder.
// O trecho é TOCADO durante a captura (tempo real): 8s de cena = 8s de
// gravação. Salvo sob audioKey(texto limpo) — o estudo acha sozinho.
// ================================================================
const VID_SUB_ADDONS_DEF = ['https://opensubtitles-v3.strem.io']
const VID_LANGS = { eng: 'Inglês', pob: 'Português (BR)', por: 'Português (PT)', spa: 'Espanhol',
  fre: 'Francês', ger: 'Alemão', ita: 'Italiano', jpn: 'Japonês', kor: 'Coreano', rus: 'Russo',
  dut: 'Holandês', nld: 'Holandês', tur: 'Turco', pol: 'Polonês', swe: 'Sueco' }

function _vidSubAddons() {
  const extra = (cfg.subAddons || '').split(/\n+/).map(s => s.trim().replace(/\/+$/, '')).filter(s => /^https?:\/\//.test(s))
  return [...new Set([...VID_SUB_ADDONS_DEF, ...extra])]
}

// moviehash do OpenSubtitles: u64 = tamanho + soma dos primeiros e últimos
// 64 KB lidos como uint64 little-endian. Identifica o ARQUIVO, não o título.
async function openSubtitlesHash(file) {
  const KB64 = 65536
  if (!file || file.size < KB64 * 2) return null
  const readChunk = async (start) => new DataView(await file.slice(start, start + KB64).arrayBuffer())
  const somar = (dv, acc) => {
    for (let i = 0; i + 8 <= dv.byteLength; i += 8) acc = (acc + dv.getBigUint64(i, true)) & 0xFFFFFFFFFFFFFFFFn
    return acc
  }
  let h = BigInt(file.size)
  h = somar(await readChunk(0), h)
  h = somar(await readChunk(file.size - KB64), h)
  return h.toString(16).padStart(16, '0')
}

// Tenta extrair SxxExx do nome do arquivo
function _vidGuessEpisode(name) {
  const m = /s(\d{1,2})[ ._-]*e(\d{1,2})/i.exec(name || '')
  return m ? { s: +m[1], e: +m[2] } : null
}
// Limpa o nome de release para virar busca
// ("House.of.the.Dragon.S03E02.1080p.HEVC..." vira "House of the Dragon")
function _vidCleanQuery(name) {
  let q = String(name || '').replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ')
  q = q.replace(/\[[^\]]*\]/g, ' ')
  const corte = q.search(/\b(s\d{1,2}[ ._-]*e\d{1,2}|\d{3,4}p|(19|20)\d\d\b|hevc|x26[45]|h26[45]|web[- ]?dl|webrip|bluray|hdtv|dvdrip)\b/i)
  if (corte > 2) q = q.slice(0, corte)
  return q.replace(/\s+/g, ' ').trim()
}

let _vidSubState = null
function videoSubSearchOpen() {
  if (!_vidCur) return
  const guess = _vidGuessEpisode(_vidCur.fileName)
  // auto: com título limpo + SxxExx do nome do arquivo, vai DIRETO para a
  // lista de legendas — sem escolher série, sem confirmar episódio.
  _vidSubState = { passo: 'busca', resultados: [], meta: null, temporada: guess ? guess.s : 1, episodio: guess ? guess.e : 1, subs: [], hash: null, auto: true, temGuess: !!guess }
  let overlay = el('vid-sub-modal')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'vid-sub-modal'
    overlay.className = 'srs-modal-overlay'
    overlay.addEventListener('click', ev => { if (ev.target === overlay) videoSubSearchClose() })
    document.body.appendChild(overlay)
  }
  overlay.classList.remove('hidden')
  _vidSubRender()
  videoSubSearch(_vidCleanQuery(_vidCur.fileName) || _vidCur.title)
}
function videoSubSearchClose() { const m = el('vid-sub-modal'); if (m) m.classList.add('hidden') }

function _vidSubRender() {
  const ov = el('vid-sub-modal'); if (!ov || !_vidSubState) return
  const st = _vidSubState
  let corpo = ''
  if (st.passo === 'busca') {
    corpo = `
      <div class="vid-sub-row">
        <input type="text" id="vid-sub-q" value="${escA(st.query || '')}" placeholder="Nome da série ou filme"
          onkeydown="if(event.key==='Enter')videoSubSearch(this.value)">
        <button class="btn btn-secondary btn-sm" onclick="videoSubSearch(el('vid-sub-q').value)">${ic('search','ic-sm')}Buscar</button>
      </div>
      ${st.buscando ? `<div class="vid-sub-info"><span class="gen-spinner"></span> Buscando no catálogo...</div>` :
        st.resultados.length ? `<div class="vid-sub-list">${st.resultados.map((r, i) => `
          <button class="vid-sub-item" onclick="videoSubPick(${i})">
            <span class="vid-sub-name">${esc(r.name)}</span>
            <span class="vid-sub-meta">${r.type === 'series' ? 'série' : 'filme'}${r.year ? ' · ' + esc(String(r.year)) : ''}</span>
          </button>`).join('')}</div>` :
        st.buscou ? `<div class="vid-sub-info">Nada encontrado — tente só o nome, sem números.</div>` : ''}`
  } else if (st.passo === 'episodio') {
    corpo = `
      <div class="vid-sub-picked">${esc(st.meta.name)} <span>série</span></div>
      <div class="vid-sub-row">
        <label>Temporada <input type="number" id="vid-sub-s" min="0" max="99" value="${st.temporada}"></label>
        <label>Episódio <input type="number" id="vid-sub-e" min="0" max="999" value="${st.episodio}"></label>
        <button class="btn btn-primary btn-sm" onclick="videoSubListLoad(+el('vid-sub-s').value, +el('vid-sub-e').value)">${ic('search','ic-sm')}Buscar legendas</button>
      </div>`
  } else if (st.passo === 'legendas') {
    corpo = `
      <div class="vid-sub-picked">${esc(st.meta.name)}${st.meta.type === 'series' ? ` <b>S${String(st.temporada).padStart(2,'0')}E${String(st.episodio).padStart(2,'0')}</b>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="_vidSubState.passo='busca';_vidSubRender()" style="margin-left:auto">trocar</button></div>
      ${st.carregando ? `<div class="vid-sub-info"><span class="gen-spinner"></span> Consultando addons${st.hash ? ' (com a impressão digital do arquivo)' : ''}...</div>` :
        st.subs.length ? `<div class="vid-sub-list">${st.subs.map((s, i) => `
          <button class="vid-sub-item" onclick="videoSubDownload(${i}, this)">
            <span class="vid-sub-name">${esc(VID_LANGS[s.lang] || s.lang)}</span>
            <span class="vid-sub-meta">${s.exact ? '<b class="vid-sub-exact">sincronia exata</b> · ' : ''}${esc(s.addon)}</span>
          </button>`).join('')}</div>` :
        `<div class="vid-sub-info">Nenhuma legenda nos addons configurados.</div>`}`
  }
  ov.innerHTML = `
    <div class="vid-sub-card" onclick="event.stopPropagation()">
      <div class="vid-sub-head">
        <h3>${ic('search')}Buscar legenda</h3>
        <button class="vid-fix-close" onclick="videoSubSearchClose()" aria-label="Fechar">${ic('x','ic-sm')}</button>
      </div>
      ${corpo}
      <details class="vid-sub-addons">
        <summary>Addons de legenda (${_vidSubAddons().length})</summary>
        <p>Um por linha — qualquer addon de legendas do Stremio funciona (o protocolo é aberto).</p>
        <textarea id="vid-sub-addons-ta" rows="3" placeholder="https://opensubtitles-v3.strem.io">${esc((cfg.subAddons || ''))}</textarea>
        <button class="btn btn-ghost btn-sm" onclick="cfg.subAddons=el('vid-sub-addons-ta').value.trim();saveCfg();autoSyncAfterChange();toast('Addons salvos','success')">Salvar addons</button>
      </details>
    </div>`
  const q = el('vid-sub-q'); if (q && st.passo === 'busca' && !st.buscando) q.focus()
}

async function videoSubSearch(query) {
  const st = _vidSubState; if (!st) return
  st.query = query; st.buscando = true; st.buscou = true; _vidSubRender()
  try {
    const enc = encodeURIComponent(query.trim())
    const [se, mo] = await Promise.all(['series', 'movie'].map(t =>
      fetch(`https://v3-cinemeta.strem.io/catalog/${t}/top/search=${enc}.json`)
        .then(r => r.json()).then(j => (j.metas || []).slice(0, 6)).catch(() => [])))
    st.resultados = [...se.map(m => ({ ...m, type: 'series' })), ...mo.map(m => ({ ...m, type: 'movie' }))]
      .map(m => ({ id: m.imdb_id || m.id, name: m.name, year: (m.releaseInfo || '').slice(0, 4), type: m.type }))
      .filter(m => /^tt/.test(m.id)).slice(0, 8)
  } catch (e) { st.resultados = []; toast('Busca falhou: ' + e.message, 'error') }
  st.buscando = false

  // Correspondência automática: se o 1º resultado tem o MESMO nome do que
  // buscamos (normalizado), não há o que perguntar — segue direto.
  if (st.auto) {
    st.auto = false
    const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    const alvo = norm(query)
    const top = st.resultados[0]
    if (top && norm(top.name) === alvo && (top.type === 'movie' || st.temGuess)) {
      st.meta = top
      videoSubListLoad(st.temporada, st.episodio)
      return
    }
  }
  _vidSubRender()
}

function videoSubPick(i) {
  const st = _vidSubState; if (!st) return
  st.meta = st.resultados[i]
  if (st.meta.type === 'series') { st.passo = 'episodio'; _vidSubRender() }
  else videoSubListLoad()
}

// Consulta os addons e devolve a lista de legendas de um título/episódio.
// Também atualiza as CANDIDATAS persistidas (usadas pelo sync com IA).
async function _vidFetchSubs(meta, temporada, episodio) {
  const hash = await openSubtitlesHash(_vidFile).catch(() => null)
  const id = meta.type === 'series' ? `${meta.id}:${temporada}:${episodio}` : meta.id
  const extra = hash && _vidFile ? `/videoHash=${hash}&videoSize=${_vidFile.size}` : ''
  const vistos = new Set(); const subs = []
  await Promise.all(_vidSubAddons().map(async base => {
    const nome = base.replace(/^https?:\/\//, '').split('/')[0].split('.')[0]
    for (const ex of extra ? [extra, ''] : ['']) {
      try {
        const r = await fetch(`${base}/subtitles/${meta.type}/${encodeURIComponent(id)}${ex}.json`)
        if (!r.ok) continue
        const j = await r.json()
        ;(j.subtitles || []).forEach(sb => {
          if (!sb.url || vistos.has(sb.url)) return
          vistos.add(sb.url)
          subs.push({ lang: sb.lang || '?', url: sb.url, addon: nome, exact: false })
        })
      } catch (e) { console.warn('[subs]', base, e.message) }
    }
  }))
  const peso = l => l === 'eng' ? 0 : l === 'pob' ? 1 : l === 'por' ? 2 : 3
  subs.sort((a, b) => peso(a.lang) - peso(b.lang))
  const lista = subs.slice(0, 40)
  _vidSubCandidates = lista.map(sb => ({ lang: sb.lang, url: sb.url, addon: sb.addon }))
  _vidSaveSubs()
  return lista
}

async function videoSubListLoad(temporada, episodio) {
  const st = _vidSubState; if (!st) return
  if (temporada != null) { st.temporada = temporada; st.episodio = episodio }
  st.passo = 'legendas'; st.carregando = true
  st.hash = st.hash || await openSubtitlesHash(_vidFile).catch(() => null)
  _vidSubRender()
  st.subs = await _vidFetchSubs(st.meta, st.temporada, st.episodio)
  st.carregando = false; _vidSubRender()
}

// Baixa uma legenda (da lista dos addons), aplica e busca a trilha PT.
async function _vidApplySubUrl(sub) {
  const r = await fetch(sub.url)
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const cues = parseSubtitle(_vidDecodeSubBuf(await r.arrayBuffer()))
  if (!cues.length) throw new Error('arquivo não parece uma legenda válida')
  _vidAppliedSubUrl = sub.url
  _vidCur.subShift = 0
  await _vidApplyCues(cues, `online (${VID_LANGS[sub.lang] || sub.lang})`)
  if (sub.lang !== 'pob' && sub.lang !== 'por') _vidAutoFetchPT()
}

async function videoSubDownload(i, btnEl) {
  const st = _vidSubState; if (!st) return
  const sub = st.subs[i]; if (!sub) return
  if (btnEl) btnEl.innerHTML = '<span class="gen-spinner"></span> baixando...'
  try {
    await _vidApplySubUrl(sub)
    videoSubSearchClose()
  } catch (e) {
    toast('Falha ao baixar a legenda: ' + e.message, 'error')
    _vidSubRender()
  }
}

// ================================================================
// LEGENDA AUTOMÁTICA NA ABERTURA — vídeo sem legenda entra, legenda
// certa sai, zero cliques: título limpo + SxxExx do nome do arquivo →
// Cinemeta confirma → addons listam → melhor da língua do vídeo →
// aplica (e a trilha PT vem atrás sozinha, como sempre).
// Qualquer incerteza = para e aponta o botão manual, sem adivinhar.
// ================================================================
const VID_LANG3 = { en: 'eng', es: 'spa', fr: 'fre', de: 'ger', it: 'ita', pt: 'por', ja: 'jpn', ko: 'kor', ru: 'rus' }

async function _vidAutoSub() {
  if (!_vidCur || _vidCues.length) return
  const query = _vidCleanQuery(_vidCur.fileName)
  if (!query || query.length < 3) return
  const guess = _vidGuessEpisode(_vidCur.fileName)
  toast('Procurando a legenda deste vídeo...', 'info')
  try {
    const enc = encodeURIComponent(query)
    const [se, mo] = await Promise.all(['series', 'movie'].map(t =>
      fetch(`https://v3-cinemeta.strem.io/catalog/${t}/top/search=${enc}.json`)
        .then(r => r.json()).then(j => (j.metas || []).slice(0, 4)).catch(() => [])))
    const results = [...se.map(m => ({ ...m, type: 'series' })), ...mo.map(m => ({ ...m, type: 'movie' }))]
      .map(m => ({ id: m.imdb_id || m.id, name: m.name, type: m.type }))
      .filter(m => /^tt/.test(m.id))
    const norm = x => String(x || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    const top = results[0]
    if (!top || norm(top.name) !== norm(query)) {
      toast('Não reconheci o título com certeza — use "Buscar legenda"', 'info'); return
    }
    if (top.type === 'series' && !guess) {
      toast('Não deduzi o episódio pelo nome do arquivo — use "Buscar legenda"', 'info'); return
    }
    const subs = await _vidFetchSubs(top, guess ? guess.s : 1, guess ? guess.e : 1)
    if (_vidCues.length) return          // usuário importou algo enquanto buscava
    const alvoLang = VID_LANG3[_vidCur.lang || 'en'] || 'eng'
    const sub = subs.find(sb => sb.lang === alvoLang) || subs[0]
    if (!sub) { toast('Nenhuma legenda nos addons para este episódio', 'info'); return }
    await _vidApplySubUrl(sub)
    toast(`Legenda encontrada sozinha: ${top.name}${top.type === 'series' ? ` S${String(guess.s).padStart(2,'0')}E${String(guess.e).padStart(2,'0')}` : ''} — se escorregar, use o Sync`, 'success')
  } catch (e) {
    console.warn('[video] autoSub:', e)
    toast('Busca automática de legenda falhou — use "Buscar legenda"', 'warning')
  }
}

// Des-mojibake: legendas chegam DUPLAMENTE encodadas da origem (bytes UTF-8
// que soletram "â™ª" em vez de ♪ — visto ao vivo no OpenSubtitles). Reverte
// re-serializando como windows-1252 e relendo como UTF-8; se o resultado
// piorar (muitos U+FFFD), mantém o original.
function _vidFixMojibake(txt) {
  if (!/Ã.|â€.|â„¢|â™ª|Â[ª°º©®´¨]/.test(txt)) return txt
  // Reverso da windows-1252 para os pontos que não são latin-1 direto
  const R = { 8364:128, 8218:130, 402:131, 8222:132, 8230:133, 8224:134, 8225:135, 710:136,
    8240:137, 352:138, 8249:139, 338:140, 381:142, 8216:145, 8217:146, 8220:147, 8221:148,
    8226:149, 8211:150, 8212:151, 732:152, 8482:153, 353:154, 8250:155, 339:156, 382:158, 376:159 }
  const bytes = new Uint8Array(txt.length)
  for (let i = 0; i < txt.length; i++) {
    const c = txt.charCodeAt(i)
    bytes[i] = c <= 255 ? c : (R[c] !== undefined ? R[c] : 63)
  }
  const out = new TextDecoder('utf-8').decode(bytes)
  return (out.match(/�/g) || []).length <= 2 ? out : txt
}

// Caminho único de gravação de legenda (arquivo local e busca online)
async function _vidApplyCues(cues, origem) {
  _vidCues = cues
  if (_vidCuesPT.length) _vidAlignPTTrack()   // realinha a trilha PT à legenda nova
  _vidSaveSubs()
  _vidCur.cueCount = cues.length; _vidCur.updated_at = new Date().toISOString()
  saveVideos(); autoSyncAfterChange()
  renderVidTranscript()
  _vidUpdateOverlay()
  const cc = el('vid-cue-count'); if (cc) cc.textContent = cues.length + ' falas'
  toast(`Legenda ${origem}: ${cues.length} falas`, 'success')
}

// ================================================================
// TRILHA PT ALINHADA + TRADUÇÃO SIMULTÂNEA
// A tradução "de graça" vem da PRÓPRIA legenda PT-BR do episódio,
// baixada dos addons e alinhada por tempo (cue.pts). A IA (cue.pt) é a
// camada adicional: tempo real com a chave OpenAI, só onde faltar.
// ================================================================

// Alinha a trilha PT às falas EN. Em duas passadas:
// 1) estima o DESLOCAMENTO GLOBAL entre as trilhas (a legenda PT costuma vir
//    de outra release — sem isso, a tradução cai na fala vizinha, que foi o
//    que o Djemeson viu no Marshals S01E01);
// 2) casa cada fala EN com o cue PT mais próximo do ponto médio deslocado.
// Legendas PT também FUNDEM duas falas EN numa: o mesmo texto vale para as
// duas (a deduplicação acontece na exibição do estudo focado).
function _vidAlignPTTrack() {
  if (!_vidCues.length || !_vidCuesPT.length) return 0

  // Passada 1: varredura de -15s a +15s (grossa 0,5s, fina 0,1s) maximizando
  // quantas falas EN caem DENTRO de um cue PT com o offset aplicado.
  const passo = Math.max(1, Math.floor(_vidCues.length / 200))
  const amostraEN = _vidCues.filter((_, i) => i % passo === 0)
  const score = off => {
    let hits = 0, j = 0
    for (const c of amostraEN) {
      const mid = (c.s + c.e) / 2 + off
      while (j < _vidCuesPT.length - 1 && _vidCuesPT[j].e < mid - 1) j++
      for (const p of [_vidCuesPT[j], _vidCuesPT[j + 1]]) {
        if (p && mid >= p.s - 0.4 && mid <= p.e + 0.4) { hits++; break }
      }
    }
    return hits
  }
  // Desempate por |off| menor: com poucas falas, varios offsets empatam e o
  // primeiro (-15s) vencia — a traducao ia parar na fala errada.
  let bestOff = 0, bestScore = -1
  const considera = off => {
    const sc = score(off)
    if (sc > bestScore || (sc === bestScore && Math.abs(off) < Math.abs(bestOff))) { bestScore = sc; bestOff = off }
  }
  for (let off = -15; off <= 15.01; off += 0.5) considera(+off.toFixed(1))
  const centro = bestOff
  for (let off = centro - 0.4; off <= centro + 0.41; off += 0.1) considera(+off.toFixed(1))
  // Evidencia minima: empate generalizado (legenda minuscula) = nao desloca
  if (bestScore < Math.min(3, amostraEN.length)) bestOff = 0

  // Refino: a varredura fica com o PRIMEIRO offset que empata no máximo
  // (viés para baixo). A mediana dos deltas de início dos pares contidos
  // corrige isso — e resiste ao ruído das fusões (2 falas EN → 1 cue PT).
  {
    const deltas = []
    let k = 0
    for (const c of _vidCues) {
      const mid = (c.s + c.e) / 2 + bestOff
      while (k < _vidCuesPT.length - 1 && _vidCuesPT[k].e < mid - 1) k++
      for (const p of [_vidCuesPT[k], _vidCuesPT[k + 1]]) {
        if (p && mid >= p.s - 0.4 && mid <= p.e + 0.4) { deltas.push(p.s - c.s); break }
      }
    }
    if (deltas.length >= 3) {
      deltas.sort((a, b) => a - b)
      bestOff = +deltas[Math.floor(deltas.length / 2)].toFixed(1)
    }
  }

  // Passada 2: atribuição com o offset estimado
  let j = 0, alinhadas = 0
  for (const c of _vidCues) {
    delete c.pts
    const mid = (c.s + c.e) / 2 + bestOff
    while (j < _vidCuesPT.length - 1 && _vidCuesPT[j].e < mid - 1.2) j++
    const cand = [_vidCuesPT[j - 1], _vidCuesPT[j], _vidCuesPT[j + 1]].filter(Boolean)
    let melhor = null, melhorDist = 1.2
    for (const p of cand) {
      const dist = (mid >= p.s && mid <= p.e) ? 0 : Math.min(Math.abs(p.s - mid), Math.abs(p.e - mid))
      if (dist < melhorDist) { melhor = p; melhorDist = dist }
    }
    if (melhor) { c.pts = melhor.t; alinhadas++ }
  }
  console.log(`[video] trilha PT alinhada: offset ${bestOff}s, ${alinhadas}/${_vidCues.length} falas`)
  return alinhadas
}

// Salva as legendas no IDB (debounced; limpa campos transitórios como _rev)
function _vidSaveSubs() {
  clearTimeout(_vidSubsSaveTimer)
  _vidSubsSaveTimer = setTimeout(_vidSaveSubsNow, 1500)
}
function _vidSaveSubsNow() {
  clearTimeout(_vidSubsSaveTimer); _vidSubsSaveTimer = null
  if (!_vidCur) return
  const limpa = c => { const o = { s: c.s, e: c.e, t: c.t }; if (c.pt) o.pt = c.pt; if (c.pts) o.pts = c.pts; return o }
  VideoDB.set('subs', _vidCur.id, {
    cues: _vidCues.map(limpa),
    cuesPT: _vidCuesPT.map(c => ({ s: c.s, e: c.e, t: c.t })),
    candidates: _vidSubCandidates,
    appliedUrl: _vidAppliedSubUrl
  })
}

// Garante tradução IA das falas [i .. i+n). `sinc` espera terminar.
// Em LOTE (uma chamada para a janela toda): fornecedores mais lentos que a
// OpenAI (DeepSeek no pico) não davam conta de N chamadas paralelas antes de
// a fala passar — falas ficavam sem tradução. Uma chamada só chega a tempo,
// custa menos (um prompt) e falha/retenta em bloco.
// A instrução deixa claro que é tradução FIEL de obra existente: sem isso o
// DeepSeek omite/recusa falas com conteúdo adulto (comportamento documentado)
// e "sessões inteiras" ficavam sem tradução perto dessas cenas.
const _VID_PT_SIS = 'Você traduz legendas de séries/filmes para estudo de inglês. Traduza cada fala numerada para português do Brasil, natural e curto. Palavrões e conteúdo adulto fazem parte do diálogo original: traduza fielmente, sem censurar, suavizar nem omitir. Responda SÓ as traduções, uma por linha, mantendo o número: "1. tradução". Nada além disso.'

// "1. texto" / "1) texto" / "1: texto" → { 1: 'texto', ... }
function _vidPTparse(resp) {
  const mapa = {}
  for (const ln of String(resp).split('\n')) {
    const m = ln.match(/^\s*(\d+)\s*[.):\-]\s*(.+)$/)
    if (m) mapa[+m[1]] = m[2].trim()
  }
  return mapa
}

function _vidPTaplica(k, pt) {
  const c = _vidCues[k]
  c.pt = pt
  const row = el('vid-cue-pt-' + k)
  if (row) row.textContent = pt
  if (k === _vidCueIdx) _vidUpdateOverlay()
}

async function _vidEnsurePT(i, n, sinc, forcaIA) {
  if (!aiChatCfg().key) return
  const lote = []
  for (let k = i; k < Math.min(i + n, _vidCues.length); k++) {
    const c = _vidCues[k]
    // `_ptDesisti`: fala que o fornecedor recusou repetidamente — não re-tentar
    // a cada tick (viraria loop de chamadas). Pedido manual (sinc) re-tenta.
    if (!c || c.pt || c._ptReq || (c._ptDesisti && !sinc) || (!forcaIA && c.pts)) continue
    c._ptReq = true
    c._ptTent = (c._ptTent || 0) + 1
    lote.push(k)
  }
  if (!lote.length) return
  // BLOCOS de até 4 falas, em PARALELO: a resposta é gerada token a token,
  // então o tempo cresce com o tamanho do lote — um lote grande demorava
  // tanto que as primeiras falas passavam sem tradução ("tenho que voltar").
  // Bloco pequeno fica pronto em poucos segundos; o paralelo cobre o resto.
  const blocos = []
  for (let j = 0; j < lote.length; j += 4) blocos.push(lote.slice(j, j + 4))
  const ps = blocos.map(b => _vidPTlote(b))
  if (sinc) await Promise.all(ps)
}

// Um bloco de tradução: chamada única em texto puro numerado (NÃO json_object:
// o DeepSeek nesse modo às vezes devolve vazio/truncado — limitação
// documentada). Timeout curto: travada não pode segurar a janela.
async function _vidPTlote(lote) {
  const linhas = lote.map((k, j) => `${j + 1}. ${_vidCues[k].t}`).join('\n')
  try {
    const resp = await aiText([
      { role: 'system', content: _VID_PT_SIS },
      { role: 'user', content: linhas }
    ], { maxTokens: 90 * lote.length + 120, timeoutMs: 30000, retries: 1 })
    const mapa = _vidPTparse(resp)
    const semPT = []
    lote.forEach((k, j) => {
      const c = _vidCues[k]
      delete c._ptReq
      const pt = mapa[j + 1] || ''
      if (pt) _vidPTaplica(k, pt)
      else semPT.push(k)           // recusada/omitida → o tratamento decide
    })
    _vidSaveSubs()
    if (semPT.length) _vidPTRecusadas(semPT)
  } catch (e) {
    lote.forEach(k => { const c = _vidCues[k]; if (c) delete c._ptReq })
    console.warn('[video] PT:', e.message)
  }
}

// Falas que voltaram SEM tradução no lote (recusa/omissão silenciosa do
// fornecedor — DeepSeek faz isso com conteúdo adulto). 1ª vez: deixa o fluxo
// normal re-tentar. Da 2ª em diante: manda SÓ essas falas para a OpenAI
// (fallback), que traduz legendas fielmente; sem chave OpenAI (ou se ela
// também não der), marca a fala como desistida para não virar loop.
async function _vidPTRecusadas(pend) {
  const teimosas = pend.filter(k => _vidCues[k] && (_vidCues[k]._ptTent || 0) >= 2 && !_vidCues[k]._ptReq)
  if (!teimosas.length) return
  if (aiProviderAtual() === 'openai' || !cfg.openaiKey) {
    teimosas.forEach(k => { _vidCues[k]._ptDesisti = true })
    console.warn('[video] PT: fornecedor recusou', teimosas.length, 'fala(s); sem fallback disponível')
    return
  }
  teimosas.forEach(k => { _vidCues[k]._ptReq = true })
  const linhas = teimosas.map((k, j) => `${j + 1}. ${_vidCues[k].t}`).join('\n')
  try {
    const res = await _aiFetch('https://api.openai.com/v1/chat/completions', {
      model: AI_DEFAULT_MODEL,
      messages: [{ role: 'system', content: _VID_PT_SIS }, { role: 'user', content: linhas }],
      max_tokens: 90 * teimosas.length + 120
    }, { timeoutMs: 30000, retries: 1, key: cfg.openaiKey })
    const data = await res.json()
    const mapa = _vidPTparse(data.choices?.[0]?.message?.content || '')
    teimosas.forEach((k, j) => {
      const c = _vidCues[k]
      delete c._ptReq
      const pt = mapa[j + 1] || ''
      if (pt) _vidPTaplica(k, pt)
      else c._ptDesisti = true
    })
    _vidSaveSubs()
    console.log('[video] PT: fallback OpenAI cobriu fala(s) recusada(s) pelo fornecedor ativo')
  } catch (e) {
    teimosas.forEach(k => { const c = _vidCues[k]; if (c) { delete c._ptReq; c._ptDesisti = true } })
    console.warn('[video] PT fallback:', e.message)
  }
}

// ================================================================
// LEGENDA PT-BR INTEIRA POR IA — traduz todas as falas de uma vez
// (blocos de 20, até 3 em voo), reusando o mesmo lote/parse/fallback
// do tempo real. Depois disso o modo "PT IA" mostra tudo na hora.
// ================================================================
let _vidPTfullRodando = false
async function videoTranslateFull() {
  if (_vidPTfullRodando) return
  if (!_vidCues.length) { toast('Sem legenda para traduzir', 'warning'); return }
  if (!aiChatCfg().key) { toast('Configure uma chave de IA em Configurações → IA', 'warning'); return }
  const pend = _vidCues.map((c, k) => (!c.pt ? k : -1)).filter(k => k >= 0)
  if (!pend.length) { toast('A legenda já está toda traduzida', 'info'); return }
  _vidPTfullRodando = true
  _vidSyncRender(`Traduzindo a legenda inteira… 0/${pend.length} falas`)
  try {
    const blocos = []
    for (let j = 0; j < pend.length; j += 20) blocos.push(pend.slice(j, j + 20))
    for (let g = 0; g < blocos.length; g += 3) {
      // re-filtra na hora: o tempo real pode ter traduzido algumas enquanto isso
      const grupo = blocos.slice(g, g + 3)
        .map(b => b.filter(k => { const c = _vidCues[k]; return c && !c.pt && !c._ptReq }))
        .filter(b => b.length)
      grupo.forEach(b => b.forEach(k => {
        _vidCues[k]._ptReq = true
        _vidCues[k]._ptTent = (_vidCues[k]._ptTent || 0) + 1
      }))
      await Promise.all(grupo.map(b => _vidPTlote(b)))
      const feitas = pend.filter(k => _vidCues[k].pt).length
      _vidSyncRender(`Traduzindo a legenda inteira… ${feitas}/${pend.length} falas`)
    }
    const faltam = pend.filter(k => !_vidCues[k].pt).length
    _vidSaveSubsNow()
    // liga a exibição da tradução IA se estava desligada — foi para isso que se traduziu
    if (_vidPTmode === 'off') { _vidPTmode = 'ia'; _vidShowPT = true; _vidPTButtons() }
    renderVidTranscript()
    _vidUpdateOverlay()
    toast(faltam ? `Tradução concluída — ${faltam} fala(s) ficaram pendentes` : 'Legenda inteira traduzida para PT-BR', 'success')
  } finally {
    _vidPTfullRodando = false
    _vidSyncRender(pend.some(k => !_vidCues[k].pt)
      ? 'Tradução concluída com pendências — falas recusadas tentam de novo durante a exibição.'
      : 'Legenda inteira traduzida. O modo "PT IA" agora mostra tudo na hora.')
  }
}

// Modo IA em tempo real: garante a tradução SÓ do que está na tela e do que
// começa nos próximos 30s — "vai carregando aos poucos", sem gastar tokens
// com o resto do episódio que talvez nem seja assistido. Os 30s (era 12) são
// a folga para a latência real de fornecedores lentos: a tradução do bloco
// fica pronta ANTES de a fala chegar, não depois.
function _vidEnsurePTAhead(t) {
  if (!_vidCues.length) return
  let ini = -1, fim = -1
  for (let k = 0; k < _vidCues.length; k++) {
    const c = _vidCues[k]
    if (c.e < t - 0.5) continue
    if (c.s > t + 30) break
    if (ini < 0) ini = k
    fim = k
  }
  if (ini >= 0) _vidEnsurePT(ini, fim - ini + 1, false, true)
}

// Depois de aplicar uma legenda EN, procura a PT-BR do MESMO episódio na
// lista já consultada e alinha em background — tradução oficial, custo zero.
async function _vidAutoFetchPT() {
  // Fonte: a lista do modal quando aberta; senão as candidatas persistidas —
  // o fluxo AUTOMÁTICO de legenda não passa pelo modal (vão pego no teste).
  const st = _vidSubState
  const fonte = (st && st.subs && st.subs.length) ? st.subs : _vidSubCandidates
  if (!fonte || !fonte.length) return
  const alvo = fonte.find(s => s.lang === 'pob') || fonte.find(s => s.lang === 'por')
  if (!alvo) return
  try {
    const r = await fetch(alvo.url)
    if (!r.ok) return
    const buf = await r.arrayBuffer()
    const u8 = new TextDecoder('utf-8').decode(buf)
    const w12 = new TextDecoder('windows-1252').decode(buf)
    const ruimU8 = (u8.match(/�/g) || []).length
    const ruimW12 = (w12.match(/Ã[©ªµ£§¡³]|â[€™"]|Â./g) || []).length
    const txt = _vidFixMojibake(ruimU8 <= ruimW12 ? u8 : w12)
    const cues = parseSubtitle(txt)
    if (!cues.length) return
    _vidCuesPT = cues
    const n = _vidAlignPTTrack()
    _vidSaveSubs()
    renderVidTranscript()
    _vidUpdateOverlay()
    toast(`Legenda PT-BR alinhada automaticamente (${n} falas) — "PT ao vivo" usa ela de graça`, 'success')
  } catch (e) { console.warn('[video] auto-PT:', e.message) }
}

// ================================================================
// ESTUDO FOCADO — um trecho, quatro passos: ouvir às cegas → revelar a
// fala → revelar a tradução → salvar palavras (com o áudio real).
// Entra pela seleção ("Estudo focado") ou por um marcador ("estudar").
// ================================================================
function videoSubExport(qual) {
  const cues = qual === 'pt' ? _vidCuesPT : _vidCues
  if (!cues.length) { toast('Sem legenda para baixar', 'warning'); return }
  const fmt = t => {
    t = Math.max(0, t)
    const h = String(Math.floor(t / 3600)).padStart(2, '0')
    const m = String(Math.floor(t % 3600 / 60)).padStart(2, '0')
    const sec = String(Math.floor(t % 60)).padStart(2, '0')
    const ms = String(Math.round((t % 1) * 1000)).padStart(3, '0')
    return `${h}:${m}:${sec},${ms}`
  }
  const srt = cues.map((c, i) => `${i + 1}\r\n${fmt(c.s)} --> ${fmt(c.e)}\r\n${c.t}\r\n`).join('\r\n')
  const nomeBase = (_vidCur.fileName || _vidCur.title).replace(/\.[^.]+$/, '')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\ufeff' + srt], { type: 'application/x-subrip' }))
  a.download = nomeBase + (qual === 'pt' ? '.pt-BR' : '') + '.srt'
  a.click()
  toast('Legenda .srt baixada com a sincronização aplicada — deixe na mesma pasta do vídeo', 'success')
}

// ================================================================
// SELEÇÃO NA LEGENDA SOBRE O VÍDEO — arraste para marcar um trecho
// (ou clique duplo para uma palavra) e leve direto para o estudo.
// O vídeo pausa sozinho ao começar a seleção.
// ================================================================

// ================================================================
// LEGENDA CRIADA PELA IA — para quando NÃO existe legenda em lugar
// nenhum: o ffmpeg (local) extrai o áudio do arquivo, o Whisper escuta
// o episódio inteiro e escreve a legenda com os tempos certos.
// ~R$ 1,50 por episódio de 45min, uma vez só.
// ================================================================
let _vidTranscrevendo = false
async function videoTranscribeFull() {
  if (_vidTranscrevendo) return
  if (!_vidFile || !_vidCur) { toast('Abra o vídeo primeiro', 'warning'); return }
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'warning'); return }
  const p = el('vid-player')
  const durS = (isFinite(_vidCur.duration) && _vidCur.duration) || (p && isFinite(p.duration) && p.duration) || 0
  const durMin = durS ? Math.ceil(durS / 60) : 45
  const rate = await aiUsdBrl()
  if (!(await confirmModal({ title: 'Criar legenda com IA', icon: 'sparkles',
    confirmText: `Transcrever — ${_brl(durMin * 0.006 * rate)}`,
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">A IA vai OUVIR o episódio (~${durMin} min) e escrever a legenda inteira,
      com os tempos certos. O áudio é extraído aqui no seu aparelho — só a transcrição vai para a OpenAI.
      Leva alguns minutos.</p>` }))) return

  _vidTranscrevendo = true
  const box = el('vid-audiofix-banner')
  const setMsg = (m, pct) => { if (box) box.innerHTML = `
    <div class="vid-fix-banner"><div><b>${m}</b>${pct != null ? `
      <span class="vid-fix-bar"><i style="width:${Math.round(pct * 100)}%"></i></span>` : ''}</div></div>` }
  try {
    if (p) p.pause()
    setMsg('Preparando o conversor (a 1ª vez baixa ~31 MB)...')
    const ff = await _vidLoadFFmpeg(pr => setMsg('Extraindo o áudio do arquivo...', pr))
    try { await ff.unmount('/mnt') } catch (e) {}
    try { await ff.createDir('/mnt') } catch (e) {}
    await ff.mount('WORKERFS', { files: [_vidFile] }, '/mnt')
    setMsg('Extraindo o áudio do arquivo...', 0)
    const code = await ff.exec(['-i', '/mnt/' + _vidFile.name, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', '48k', 'ep.m4a'])
    if (code !== 0) throw new Error('extração de áudio falhou (código ' + code + ')')
    const data = await ff.readFile('ep.m4a')
    try { await ff.deleteFile('ep.m4a') } catch (e) {}
    const blobTotal = new Blob([data.buffer], { type: 'audio/mp4' })

    // Fatias abaixo do limite de 25 MB da OpenAI (48kbps mono ≈ 21 MB/h:
    // um episódio normal vai inteiro numa chamada só)
    const partes = []
    if (blobTotal.size <= 23 * 1024 * 1024) {
      partes.push({ blob: blobTotal, off: 0 })
      try { await ff.unmount('/mnt') } catch (e) {}
    } else {
      const nP = Math.ceil(blobTotal.size / (20 * 1024 * 1024))
      const durTotal = durS || durMin * 60
      const passo = Math.ceil(durTotal / nP)
      for (let k = 0; k < nP; k++) {
        setMsg(`Extraindo parte ${k + 1}/${nP}...`)
        const c2 = await ff.exec(['-ss', String(k * passo), '-t', String(passo), '-i', '/mnt/' + _vidFile.name, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', '48k', 'p.m4a'])
        if (c2 !== 0) continue
        const d2 = await ff.readFile('p.m4a')
        try { await ff.deleteFile('p.m4a') } catch (e) {}
        partes.push({ blob: new Blob([d2.buffer], { type: 'audio/mp4' }), off: k * passo })
      }
      try { await ff.unmount('/mnt') } catch (e) {}
    }

    const cues = []
    for (let k = 0; k < partes.length; k++) {
      setMsg(`A IA está escutando e escrevendo (${k + 1}/${partes.length})...`)
      const fd = new FormData()
      fd.append('file', partes[k].blob, 'ep.m4a')
      fd.append('model', 'whisper-1')
      fd.append('response_format', 'verbose_json')
      if ((_vidCur.lang || 'en') === 'en') fd.append('language', 'en')
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${cfg.openaiKey}` }, body: fd
      })
      if (!res.ok) { let m = 'HTTP ' + res.status; try { const e2 = await res.json(); if (e2.error?.message) m = e2.error.message } catch (x) {} ; throw new Error(m) }
      const j = await res.json()
      for (const sg of (j.segments || [])) {
        const t = (sg.text || '').trim()
        if (t) cues.push({ s: +(partes[k].off + sg.start).toFixed(2), e: +(partes[k].off + sg.end).toFixed(2), t })
      }
    }
    if (cues.length < 5) throw new Error('a transcrição voltou quase vazia — o arquivo tem fala?')

    _vidAppliedSubUrl = null
    _vidCur.subShift = 0
    await _vidApplyCues(cues, 'criada pela IA (transcrição do áudio)')
    if (box) box.innerHTML = ''
    toast(`Legenda criada pela IA: ${cues.length} falas — já nasce sincronizada (veio do próprio áudio)`, 'success')
  } catch (e) {
    console.warn('[video] transcribeFull:', e)
    if (box) box.innerHTML = ''
    toast('Transcrição falhou: ' + e.message, 'error')
  } finally { _vidTranscrevendo = false }
}
