// ================================================================
// VÍDEO — estudar com séries e filmes (fase 1 do PLANO-VIDEO.md)
// CARREGADO LAZY (só ao abrir a seção). Regras da casa:
//   - O ESTADO videos[]/clips[] vive em core.js (não-lazy) — firebase.js
//     sincroniza os dois e não pode depender deste arquivo (armadilha nº 1).
//   - O ARQUIVO de vídeo nunca sai do aparelho: aqui só entram metadados,
//     legenda (IndexedDB local), cortes e o áudio capturado da cena (KBs).
//   - O áudio real da cena é salvo sob audioKey(texto da fala): o player do
//     estudo (study.js) o encontra sozinho, sem nenhuma mudança lá.
// ================================================================

// ---- Estado do módulo (só UI; nada disto persiste) ----
let _videoView = 'lib'          // lib | player | prepare
let _vidCur = null              // entrada de videos[] aberta no player
let _vidFile = null             // File do vídeo aberto (runtime)
let _vidURL = null              // object URL corrente
let _vidCues = []               // cues da legenda [{s,e,t,pt?}]
let _vidCueIdx = -1             // cue atual (karaokê)
let _vidSel = null              // seleção {ci,cj,s,e} (índices de cue + tempos)
let _vidSelWords = new Set()    // índices das palavras marcadas na seleção
let _vidLoop = false            // loop A–B
let _vidPlayStop = null         // fim do trecho em reprodução
let _vidAutoScroll = true
let _vidShowPT = false          // mostrar traduções cacheadas (modo recall)
let _vidCapturing = false

// ---- IndexedDB próprio: handles de arquivo + legendas ----
const VideoDB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db)
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('el-video-db', 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles')
        if (!db.objectStoreNames.contains('subs'))    db.createObjectStore('subs')
      }
      req.onsuccess = () => { this._db = req.result; resolve(this._db) }
      req.onerror = () => reject(req.error)
    })
  },
  async get(store, key) {
    const db = await this.open()
    return new Promise(resolve => {
      const req = db.transaction(store).objectStore(store).get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    })
  },
  async set(store, key, val) {
    const db = await this.open()
    return new Promise(resolve => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(val, key)
      tx.oncomplete = resolve; tx.onerror = resolve
    })
  },
  async del(store, key) {
    const db = await this.open()
    return new Promise(resolve => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).delete(key)
      tx.oncomplete = resolve; tx.onerror = resolve
    })
  }
}

// ================================================================
// RENDER RAIZ — decide a visão. Guard importante: se o player está de
// pé (o usuário só trocou de aba e voltou, ou um snapshot da nuvem
// chegou), NÃO reconstruímos o DOM — destruiria o <video> tocando.
// ================================================================
function renderVideoSection() {
  if (_pendingClipPlay) { _vidConsumePendingClip(); return }
  if (_videoView === 'player' && el('vid-player')) { _vidRenderLibBadgeOnly(); return }
  _videoView = 'lib'
  renderVideoLib()
}

function _vidRenderLibBadgeOnly() { /* player ativo: nada a fazer */ }

// ================================================================
// BIBLIOTECA DE VÍDEOS
// ================================================================
function renderVideoLib() {
  _videoView = 'lib'
  const acts = el('video-ph-actions')
  if (acts) acts.innerHTML = `
    <button class="btn btn-primary btn-sm" onclick="videoPickFile()">${ic('plus')}Abrir vídeo</button>`
  const area = el('video-area'); if (!area) return

  if (!videos.length) {
    area.innerHTML = `
      <div class="srs-empty">
        ${ic('film','ic-xl')}
        <p style="font-size:var(--fs-base);font-weight:600;margin-bottom:8px">Nenhum vídeo ainda</p>
        <p style="font-size:var(--fs-md);margin-bottom:6px">Abra um episódio ou filme do seu computador, importe a legenda (.srt)
        e transforme as cenas em cards — com o áudio real dos atores.</p>
        <p style="font-size:var(--fs-sm);color:var(--text3);margin-bottom:20px">O arquivo nunca sai do seu aparelho e pode ser apagado depois:
        o app guarda só a legenda, os cortes e os áudios extraídos.</p>
        <button class="btn btn-primary" onclick="videoPickFile()">${ic('plus')}Abrir vídeo</button>
      </div>`
    return
  }

  area.innerHTML = `
    <div class="vid-lib">
      ${videos.map(v => {
        const nClips = clips.filter(c => c.videoId === v.id).length
        const dur = v.duration ? _vidFmtTime(v.duration) : '—'
        return `
        <div class="vid-lib-row" onclick="videoOpen('${v.id}')">
          <div class="vid-lib-icon">${srcIcon(v.source_type || 'series')}</div>
          <div class="vid-lib-body">
            <div class="vid-lib-title">${esc(v.title)}</div>
            <div class="vid-lib-meta">
              <span>${dur}</span>
              <span>${v.cueCount ? v.cueCount + ' falas' : 'sem legenda'}</span>
              ${nClips ? `<span>${nClips} corte${nClips !== 1 ? 's' : ''}</span>` : ''}
              ${v.coverage != null ? `<span class="vid-cov">${v.coverage}% conhecido</span>` : ''}
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();videoDelete('${v.id}')" data-tip="Remover da lista (não apaga o arquivo nem os cards)">${ic('trash','ic-sm')}</button>
        </div>`
      }).join('')}
    </div>`
}

async function videoDelete(id) {
  const v = videos.find(x => x.id === id); if (!v) return
  if (!(await confirmModal({ title: 'Remover vídeo da lista', icon: 'trash', danger: true, confirmText: 'Remover',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Remove <b>${esc(v.title)}</b> da lista, com a legenda e os marcadores.
      <b>Nada de estudo é apagado</b>: cards, cortes e áudios extraídos continuam.</p>` }))) return
  videos = videos.filter(x => x.id !== id); saveVideos()
  VideoDB.del('handles', id); VideoDB.del('subs', id)
  autoSyncAfterChange()
  renderVideoLib()
}

// ================================================================
// ABRIR ARQUIVO
// ================================================================
async function videoPickFile() {
  // File System Access (Chrome/Edge desktop): o handle é persistível e o
  // app "lembra" do arquivo nas próximas visitas.
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Vídeo', accept: { 'video/*': ['.mp4', '.mkv', '.webm', '.mov', '.avi'] } }]
      })
      const file = await handle.getFile()
      await videoAcceptFile(file, handle)
      return
    } catch (e) { if (e.name === 'AbortError') return }
  }
  // Fallback universal
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = 'video/*,.mkv'
  inp.onchange = () => { if (inp.files[0]) videoAcceptFile(inp.files[0], null) }
  inp.click()
}

// Entrada única (picker, fallback e testes): registra/reencontra o vídeo
// pelo par nome+tamanho e abre o player.
async function videoAcceptFile(file, handle) {
  let v = videos.find(x => x.fileName === file.name && x.fileSize === file.size)
  if (!v) {
    v = {
      id: uid(),
      title: file.name.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ').trim(),
      source_type: 'series',
      lang: (typeof activeLang === 'function' ? activeLang() : 'en'),
      fileName: file.name, fileSize: file.size,
      duration: 0, cueCount: 0, coverage: null, markers: [],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }
    videos.unshift(v); saveVideos(); autoSyncAfterChange()
  }
  if (handle) VideoDB.set('handles', v.id, handle)
  _vidFile = file
  await videoOpenPlayer(v)
}

// Reabre um vídeo da biblioteca (tenta o handle persistido primeiro)
async function videoOpen(id) {
  const v = videos.find(x => x.id === id); if (!v) return
  const handle = await VideoDB.get('handles', id)
  if (handle) {
    try {
      let perm = await handle.queryPermission({ mode: 'read' })
      if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'read' })
      if (perm === 'granted') {
        _vidFile = await handle.getFile()
        await videoOpenPlayer(v)
        return
      }
    } catch (e) { console.warn('[video] handle inválido:', e.message) }
  }
  toast('Escolha o arquivo do vídeo (o navegador não o guarda — só o atalho)', 'info')
  if (window.showOpenFilePicker) {
    try {
      const [h] = await window.showOpenFilePicker({ types: [{ description: 'Vídeo', accept: { 'video/*': ['.mp4', '.mkv', '.webm', '.mov', '.avi'] } }] })
      const file = await h.getFile()
      // Reaponta o registro existente para o arquivo escolhido
      v.fileName = file.name; v.fileSize = file.size; v.updated_at = new Date().toISOString()
      saveVideos(); VideoDB.set('handles', v.id, h)
      _vidFile = file
      await videoOpenPlayer(v)
    } catch (e) { if (e.name !== 'AbortError') console.warn(e) }
  } else {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = 'video/*,.mkv'
    inp.onchange = async () => {
      if (!inp.files[0]) return
      _vidFile = inp.files[0]
      v.fileName = _vidFile.name; v.fileSize = _vidFile.size; saveVideos()
      await videoOpenPlayer(v)
    }
    inp.click()
  }
}

// ================================================================
// PLAYER + TRANSCRIPT
// ================================================================
async function videoOpenPlayer(v) {
  _vidCur = v
  _videoView = 'player'
  _vidSel = null; _vidSelWords = new Set(); _vidLoop = false; _vidPlayStop = null; _vidCueIdx = -1

  const stored = await VideoDB.get('subs', v.id)
  _vidCues = (stored && stored.cues) || []

  if (_vidURL) { URL.revokeObjectURL(_vidURL); _vidURL = null }
  _vidURL = URL.createObjectURL(_vidFile)

  const acts = el('video-ph-actions')
  if (acts) acts.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="videoImportSubPick()" data-tip="Importar legenda .srt/.vtt">${ic('upload')}Legenda</button>
    <button class="btn btn-secondary btn-sm" onclick="videoPrepare()" data-tip="Cruza a legenda com seu vocabulário: o que você ainda não conhece neste episódio">${ic('sparkles')}Preparar para assistir</button>
    <button class="btn btn-ghost btn-sm" onclick="videoBackToLib()">${ic('undo')}Biblioteca</button>`

  const area = el('video-area'); if (!area) return
  area.innerHTML = `
    <div class="vid-layout">
      <div class="vid-main">
        <video id="vid-player" src="${_vidURL}" controls preload="metadata"></video>
        <div class="vid-toolbar">
          <span class="vid-title" data-tip="${escA(v.fileName)}">${esc(v.title)}</span>
          <span style="flex:1"></span>
          <button class="btn btn-ghost btn-sm" onclick="videoAddMarker()" data-tip="Marcar este momento para estudar depois (tecla M)">${ic('flame','ic-sm')}Marcar</button>
          <button class="btn btn-ghost btn-sm ${_vidShowPT ? 'vid-on' : ''}" id="vid-pt-toggle" onclick="videoTogglePT()" data-tip="Mostrar traduções já geradas (ficam borradas até passar o mouse — recall)">PT</button>
          <button class="btn btn-ghost btn-sm ${_vidAutoScroll ? 'vid-on' : ''}" id="vid-scroll-toggle" onclick="videoToggleScroll()" data-tip="Rolagem automática do transcript">${ic('arrowRight','ic-sm')}Seguir</button>
        </div>
        <div id="vid-sel-panel"></div>
        <div id="vid-markers"></div>
      </div>
      <div class="vid-transcript-wrap">
        <div class="vid-transcript-head">
          <span>Transcript</span>
          <span id="vid-cue-count">${_vidCues.length ? _vidCues.length + ' falas' : ''}</span>
        </div>
        <div class="vid-transcript" id="vid-transcript" ondragover="event.preventDefault()" ondrop="videoDropSub(event)"></div>
      </div>
    </div>`

  const player = el('vid-player')
  player.addEventListener('loadedmetadata', () => {
    // isFinite: webm gravado por MediaRecorder reporta duração Infinity
    if (isFinite(player.duration) && player.duration && Math.abs((v.duration || 0) - player.duration) > 1) {
      v.duration = Math.round(player.duration); v.updated_at = new Date().toISOString()
      saveVideos(); autoSyncAfterChange()
    }
  })
  player.addEventListener('timeupdate', _vidOnTime)

  renderVidTranscript()
  renderVidMarkers()
  renderVidSelPanel()

  // Tecla M marca o momento (só com a seção ativa e fora de inputs)
  if (!window._vidKeysBound) {
    window._vidKeysBound = true
    document.addEventListener('keydown', e => {
      if (e.key.toLowerCase() !== 'm' || e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return
      if (!document.getElementById('section-video')?.classList.contains('active')) return
      if (_videoView !== 'player' || !el('vid-player')) return
      videoAddMarker()
    })
  }
}

function videoBackToLib() {
  const p = el('vid-player'); if (p) p.pause()
  if (_vidURL) { URL.revokeObjectURL(_vidURL); _vidURL = null }
  _vidCur = null; _vidFile = null
  renderVideoLib()
}

function _vidFmtTime(sec) {
  if (!isFinite(sec)) return '—'
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0')
}

// ---- Karaokê: destaca a fala corrente e segue a reprodução ----
function _vidOnTime() {
  const p = el('vid-player'); if (!p) return
  const t = p.currentTime

  // Fim de trecho selecionado: para (ou loopa)
  if (_vidPlayStop != null && t >= _vidPlayStop) {
    if (_vidLoop && _vidSel) { p.currentTime = _vidSel.s; return }
    p.pause(); _vidPlayStop = null
  }

  if (!_vidCues.length) return
  let idx = _vidCueIdx
  const inCue = i => i >= 0 && i < _vidCues.length && t >= _vidCues[i].s && t <= _vidCues[i].e
  if (!inCue(idx)) {
    idx = -1
    for (let i = 0; i < _vidCues.length; i++) { if (inCue(i)) { idx = i; break } if (_vidCues[i].s > t) break }
  }
  if (idx === _vidCueIdx) return
  const old = document.querySelector('.vid-cue.cur')
  if (old) old.classList.remove('cur')
  _vidCueIdx = idx
  if (idx >= 0) {
    const elCue = document.querySelector(`.vid-cue[data-i="${idx}"]`)
    if (elCue) {
      elCue.classList.add('cur')
      if (_vidAutoScroll) elCue.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }
}

function videoToggleScroll() {
  _vidAutoScroll = !_vidAutoScroll
  el('vid-scroll-toggle')?.classList.toggle('vid-on', _vidAutoScroll)
}
function videoTogglePT() {
  _vidShowPT = !_vidShowPT
  el('vid-pt-toggle')?.classList.toggle('vid-on', _vidShowPT)
  renderVidTranscript()
}

// ================================================================
// LEGENDA — importar e parsear (.srt/.vtt)
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
function renderVidTranscript() {
  const box = el('vid-transcript'); if (!box) return
  if (!_vidCues.length) {
    box.innerHTML = `
      <div class="vid-transcript-empty">
        ${ic('upload','ic-lg')}
        <p><b>Sem legenda ainda.</b></p>
        <p>Arraste um arquivo <b>.srt</b>/<b>.vtt</b> aqui, ou use o botão "Legenda" acima.</p>
        <p style="color:var(--text3)">Dica: baixe a legenda exata do episódio no OpenSubtitles.</p>
      </div>`
    return
  }
  box.innerHTML = _vidCues.map((c, i) => `
    <div class="vid-cue${_vidSel && i >= _vidSel.ci && i <= _vidSel.cj ? ' insel' : ''}" data-i="${i}">
      <button class="vid-cue-time" onclick="videoPlayCue(${i})" data-tip="Tocar esta fala">${_vidFmtTime(c.s)}</button>
      <div class="vid-cue-body">
        <div class="vid-cue-text" onclick="videoSelectCue(${i})">${esc(c.t)}</div>
        ${c.pt ? `<div class="vid-cue-pt${_vidShowPT ? '' : ' hid'}">${esc(c.pt)}</div>` : ''}
      </div>
    </div>`).join('')
}

// Toca só o intervalo de uma fala
function videoPlayCue(i) {
  const p = el('vid-player'); const c = _vidCues[i]
  if (!p || !c) return
  p.currentTime = Math.max(0, c.s - 0.15)
  _vidPlayStop = c.e + 0.15
  p.play()
}

// Clique na fala = vira a seleção de estudo
function videoSelectCue(i) {
  const c = _vidCues[i]; if (!c) return
  _vidSel = { ci: i, cj: i, s: c.s, e: c.e }
  _vidSelWords = new Set()
  renderVidTranscript()
  renderVidSelPanel()
}

// ================================================================
// SELEÇÃO — ajuste fino, loop A–B, palavra-alvo e card
// ================================================================
function _vidSelText() {
  if (!_vidSel) return ''
  return _vidCues.slice(_vidSel.ci, _vidSel.cj + 1).map(c => c.t).join(' ')
}

function renderVidSelPanel() {
  const panel = el('vid-sel-panel'); if (!panel) return
  if (!_vidSel) {
    panel.innerHTML = `<div class="vid-sel-hint">Clique numa fala do transcript para escolher o trecho de estudo.</div>`
    return
  }
  const words = _vidSelText().split(/\s+/)
  const alvo = _vidTargetPhrase()
  panel.innerHTML = `
    <div class="vid-sel">
      <div class="vid-sel-row1">
        <span class="vid-sel-time">${_vidFmtTime(_vidSel.s)} → ${_vidFmtTime(_vidSel.e)} <i>(${(_vidSel.e - _vidSel.s).toFixed(1)}s)</i></span>
        <div class="vid-sel-adj">
          <button onclick="videoAdj('s',-0.5)" data-tip="Início −0,5s">−.5</button>
          <button onclick="videoAdj('s',0.5)" data-tip="Início +0,5s">+.5</button>
          <span>início</span>
          <span class="vid-adj-sep"></span>
          <span>fim</span>
          <button onclick="videoAdj('e',-0.5)" data-tip="Fim −0,5s">−.5</button>
          <button onclick="videoAdj('e',0.5)" data-tip="Fim +0,5s">+.5</button>
        </div>
        <div class="vid-sel-adj">
          <button onclick="videoExtend(-1)" data-tip="Incluir a fala anterior">${ic('undo','ic-sm')}fala</button>
          <button onclick="videoExtend(1)" data-tip="Incluir a próxima fala">fala${ic('arrowRight','ic-sm')}</button>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="videoPlaySel()">${ic('play','ic-sm')}Ouvir</button>
        <button class="btn btn-ghost btn-sm ${_vidLoop ? 'vid-on' : ''}" onclick="videoToggleLoop()" data-tip="Repetir o trecho em loop">${ic('refresh','ic-sm')}Loop</button>
        <button class="btn btn-ghost btn-sm" onclick="videoTranslateSel()" data-tip="Traduzir esta(s) fala(s) — fica no transcript, borrada, para treino de recall">PT</button>
      </div>
      <div class="vid-sel-words">${words.map((w, i) =>
        `<span class="vid-word${_vidSelWords.has(i) ? ' on' : ''}" onclick="videoToggleWord(${i})">${esc(w)}</span>`).join(' ')}
      </div>
      <div class="vid-sel-row2">
        <span class="vid-sel-alvo">${alvo
          ? `Alvo: <b>${esc(alvo)}</b>`
          : `Clique na(s) palavra(s) que quer estudar`}</span>
        <button class="btn btn-primary btn-sm" id="vid-card-btn" ${alvo && !_vidCapturing ? '' : 'disabled'} onclick="videoCreateCard()">
          ${ic('zap','ic-sm')}Salvar no estudo com áudio da cena</button>
      </div>
    </div>`
}

function videoAdj(which, d) {
  if (!_vidSel) return
  if (which === 's') _vidSel.s = Math.max(0, Math.min(_vidSel.s + d, _vidSel.e - 0.3))
  else _vidSel.e = Math.max(_vidSel.s + 0.3, _vidSel.e + d)
  renderVidSelPanel()
}
function videoExtend(dir) {
  if (!_vidSel) return
  if (dir < 0 && _vidSel.ci > 0) { _vidSel.ci--; _vidSel.s = _vidCues[_vidSel.ci].s }
  if (dir > 0 && _vidSel.cj < _vidCues.length - 1) { _vidSel.cj++; _vidSel.e = _vidCues[_vidSel.cj].e }
  _vidSelWords = new Set()   // texto mudou — remarcar
  renderVidTranscript(); renderVidSelPanel()
}
function videoPlaySel() {
  const p = el('vid-player'); if (!p || !_vidSel) return
  p.currentTime = _vidSel.s; _vidPlayStop = _vidSel.e; p.play()
}
function videoToggleLoop() {
  _vidLoop = !_vidLoop
  renderVidSelPanel()
  if (_vidLoop) videoPlaySel()
}
function videoToggleWord(i) {
  if (_vidSelWords.has(i)) _vidSelWords.delete(i); else _vidSelWords.add(i)
  renderVidSelPanel()
}
// Palavras marcadas (contíguas ou não) viram a expressão-alvo, limpa de pontuação
function _vidTargetPhrase() {
  if (!_vidSelWords.size) return ''
  const words = _vidSelText().split(/\s+/)
  return [..._vidSelWords].sort((a, b) => a - b).map(i => words[i] || '')
    .join(' ').replace(/[^\p{L}\p{N}' -]/gu, '').trim()
}

// ---- Tradução da fala (idea "dupla legenda com recall") ----
async function videoTranslateSel() {
  if (!_vidSel) return
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'warning'); return }
  try {
    for (let i = _vidSel.ci; i <= _vidSel.cj; i++) {
      if (_vidCues[i].pt) continue
      const pt = await aiText([
        { role: 'system', content: 'Traduza a fala de série/filme para português do Brasil, natural e curta. Responda SÓ a tradução.' },
        { role: 'user', content: _vidCues[i].t }
      ], { maxTokens: 200 })
      _vidCues[i].pt = pt
    }
    await VideoDB.set('subs', _vidCur.id, { cues: _vidCues })
    renderVidTranscript()
    toast('Tradução salva no transcript (borrada — passe o mouse para revelar)', 'success')
  } catch (e) { toast('Erro ao traduzir: ' + e.message, 'error') }
}

// ================================================================
// ÁUDIO REAL DA CENA — captureStream + MediaRecorder.
// O trecho é TOCADO durante a captura (tempo real): 8s de cena = 8s de
// gravação. Salvo sob audioKey(texto limpo) — o estudo acha sozinho.
// ================================================================
function captureClipAudio(start, end) {
  return new Promise((resolve, reject) => {
    const p = el('vid-player')
    if (!p || !p.captureStream) { reject(new Error('captureStream indisponível neste navegador')); return }
    const full = p.captureStream()
    const tracks = full.getAudioTracks()
    if (!tracks.length) { reject(new Error('o vídeo não expôs faixa de áudio')); return }
    const stream = new MediaStream(tracks)
    let mime = 'audio/webm;codecs=opus'
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'audio/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 48000 })
    const parts = []
    rec.ondataavailable = e => { if (e.data.size) parts.push(e.data) }
    rec.onerror = e => reject(e.error || new Error('MediaRecorder falhou'))
    rec.onstop = async () => {
      p.pause()
      try { resolve(await blobToBase64(new Blob(parts, { type: mime }))) }
      catch (err) { reject(err) }
    }
    const onTime = () => {
      if (p.currentTime >= end) { p.removeEventListener('timeupdate', onTime); if (rec.state !== 'inactive') rec.stop() }
    }
    p.addEventListener('timeupdate', onTime)
    p.currentTime = start
    _vidPlayStop = null           // o guarda do onTime local decide o fim
    p.play().then(() => rec.start(250)).catch(reject)
    // Rede de segurança: 5s além do previsto, encerra de qualquer jeito
    setTimeout(() => { if (rec.state === 'recording') { p.removeEventListener('timeupdate', onTime); rec.stop() } },
      (end - start + 5) * 1000)
  })
}

// ================================================================
// CARD A PARTIR DA CENA
// 1 chamada de chat (centavos) + captura local do áudio (grátis).
// O exemplo do card É a fala da cena — por isso o áudio real casa com
// o card sem tocar em study.js (mesma chave audioKey do texto).
// ================================================================
async function videoCreateCard() {
  if (_vidCapturing) return
  const alvo = _vidTargetPhrase()
  if (!alvo || !_vidSel) return
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'warning'); return }

  const frase = _vidSelText().replace(/\s+/g, ' ').trim()
  const jaExiste = words.find(w => (w.word || '').toLowerCase() === alvo.toLowerCase())
  if (jaExiste && !(await confirmModal({ title: 'Palavra já existe', icon: 'info', confirmText: 'Criar mesmo assim',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)"><b>${esc(alvo)}</b> já está no seu vocabulário. Criar um novo sentido a partir desta cena?</p>` }))) return

  const btn = el('vid-card-btn')
  _vidCapturing = true
  try {
    // 1) Captura o áudio real (o trecho toca — você vai ouvi-lo)
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="gen-spinner"></span> Gravando a cena...' }
    let b64 = null
    try { b64 = await captureClipAudio(_vidSel.s, _vidSel.e) }
    catch (e) { console.warn('[video] captura falhou, card sai com TTS:', e.message); toast('Não capturei o áudio da cena (' + e.message + ') — o card usará TTS', 'warning') }

    // 2) Análise rápida da IA (sentido NA CENA, não o mais comum)
    if (btn) btn.innerHTML = '<span class="gen-spinner"></span> Analisando...'
    const langName = (typeof promptLangName === 'function') ? promptLangName(_vidCur.lang || 'en') : 'English'
    const r = await aiJSON([
      { role: 'system', content: 'Você é um lexicógrafo que prepara flashcards para um brasileiro. Responda sempre em JSON.' },
      { role: 'user', content:
`Termo (${langName}): "${alvo}"
Fala da cena (fonte: ${_vidCur.title}): "${frase}"

Analise o termo NO SENTIDO USADO NESTA FALA (não o sentido mais comum).
Responda:
{"meaning_pt":"tradução curta do termo neste sentido",
 "definition_pt":"definição em 1 frase, PT-BR",
 "ipa":"pronúncia do termo entre barras simples, ex: /ˈwɔːtər/",
 "type":"word|phrasal_verb|idiom|collocation",
 "type_label":"nome da categoria em PT",
 "level":"A1|A2|B1|B2|C1|C2",
 "frase_pt":"tradução natural da fala inteira, com o equivalente do termo entre <b></b>"}` }
    ], { maxTokens: 400 })

    // 3) Monta a palavra no formato do app e salva no SRS
    const boldEn = frase.replace(new RegExp(`(${escR(alvo)})`, 'i'), '<b>$1</b>')
    const w = createWord({ word: alvo, context: frase, source_type: _vidCur.source_type || 'series', source_title: _vidCur.title, lang: _vidCur.lang })
    w.status = 'pending_review'
    w.ipa = r.ipa || ''
    w.type = r.type || 'word'
    w.type_label = r.type_label || ''
    w.ai_processed = true
    w.meanings = [{
      meaning_pt: r.meaning_pt || alvo, definition_pt: r.definition_pt || '',
      level: r.level || '', selected: true,
      examples: [{ en: boldEn, pt: r.frase_pt || '' }]
    }]
    w.updated_at = new Date().toISOString()
    saveWords()

    // 4) Áudio da cena sob a chave que o estudo REALMENTE usa: o example_en
    //    COM as tags <b> (playSrsTTS/preGenerateAudio passam o texto cru —
    //    verificado; a chave do texto limpo nunca seria encontrada).
    if (b64) {
      await AudioDB.set(audioKey(boldEn), b64)
      if (typeof autoSyncAudioAfterChange === 'function') autoSyncAudioAfterChange()
    } else {
      ensureSrsAudio(boldEn).catch(() => {})
    }
    ensureSrsAudio(alvo).catch(() => {})

    saveToSrs(w.id)

    // 5) Registra o corte e liga os cards à cena ("rever a cena")
    const clip = { id: uid(), videoId: _vidCur.id, start: +_vidSel.s.toFixed(2), end: +_vidSel.e.toFixed(2), text: frase, wordId: w.id, created_at: new Date().toISOString() }
    clips.push(clip); saveClips()
    srsCards.forEach(c => { if (c.wordId === w.id) c.clipId = clip.id })
    saveSrsCards(); autoSyncAfterChange()

    toast(`"${alvo}" salvo no estudo com o áudio da cena`, 'success')
    _vidSel = null; _vidSelWords = new Set()
    renderVidTranscript(); renderVidSelPanel()
  } catch (e) {
    toast('Erro ao criar o card: ' + e.message, 'error')
  } finally {
    _vidCapturing = false
    renderVidSelPanel()
  }
}

// ================================================================
// MARCADORES — assiste primeiro, estuda depois (tecla M)
// ================================================================
function videoAddMarker() {
  const p = el('vid-player'); if (!p || !_vidCur) return
  const t = +p.currentTime.toFixed(1)
  _vidCur.markers = _vidCur.markers || []
  if (_vidCur.markers.some(m => Math.abs(m - t) < 1)) return   // anti-duplo-clique
  _vidCur.markers.push(t); _vidCur.markers.sort((a, b) => a - b)
  _vidCur.updated_at = new Date().toISOString()
  saveVideos(); autoSyncAfterChange()
  renderVidMarkers()
  toast(`Momento ${_vidFmtTime(t)} marcado`, 'info')
}

function renderVidMarkers() {
  const box = el('vid-markers'); if (!box) return
  const ms = (_vidCur && _vidCur.markers) || []
  if (!ms.length) { box.innerHTML = ''; return }
  box.innerHTML = `
    <div class="vid-markers">
      <div class="vid-markers-head">Momentos marcados <span>${ms.length}</span></div>
      ${ms.map((t, i) => {
        const cue = _vidCues.find(c => t >= c.s - 1 && t <= c.e + 1)
        return `<div class="vid-marker-row">
          <button class="vid-cue-time" onclick="videoSeekMarker(${t})">${_vidFmtTime(t)}</button>
          <span class="vid-marker-text" ${cue ? `onclick="videoSelectCue(${_vidCues.indexOf(cue)})" style="cursor:pointer"` : ''}>${cue ? esc(cue.t) : '(sem fala na legenda neste ponto)'}</span>
          <button class="vid-marker-del" onclick="videoDelMarker(${i})" aria-label="Remover">${ic('x','ic-sm')}</button>
        </div>`
      }).join('')}
    </div>`
}
function videoSeekMarker(t) { const p = el('vid-player'); if (p) { p.currentTime = Math.max(0, t - 2); p.play() } }
function videoDelMarker(i) {
  if (!_vidCur?.markers) return
  _vidCur.markers.splice(i, 1); saveVideos(); autoSyncAfterChange(); renderVidMarkers()
}

// ================================================================
// PREPARAR PARA ASSISTIR — cruza a legenda com o vocabulário
// ================================================================
const _VID_STOP = new Set(('the a an and or but if of to in on at by for with from as is are was were be been being ' +
  'am do does did done have has had having will would can could shall should may might must not no nor so than then ' +
  'too very just also only even still yet again once here there when where why how what which who whom whose this that ' +
  'these those it its they them their theirs he him his she her hers we us our ours you your yours i me my mine ' +
  'all any both each few more most other some such own same s t don now up down out off over under about into onto ' +
  'through during before after above below between because while until against oh yeah yes hey well okay ok right ' +
  'gonna gotta wanna got get go going come came went let lets like know think see look one two three im dont didnt ' +
  'cant wont youre hes shes were theyre ive youve weve thats whats isnt arent wasnt werent id youd hed shed wed ' +
  'theyd ill youll hell shell well theyll mr mrs ms sir madam').split(/\s+/))

function _vidKnownSet() {
  const known = new Set()
  words.forEach(w => { if (w.word) known.add(w.word.toLowerCase().trim()) })
  return known
}
function _vidIsKnown(tok, known) {
  if (known.has(tok)) return true
  // Flexões triviais: plural e passado/gerúndio simples
  for (const suf of ['s', 'es', 'ed', 'd', 'ing']) {
    if (tok.length > suf.length + 2 && tok.endsWith(suf) && known.has(tok.slice(0, -suf.length))) return true
  }
  if (tok.endsWith('ing') && known.has(tok.slice(0, -3) + 'e')) return true
  return false
}

function videoPrepare() {
  if (!_vidCues.length) { toast('Importe a legenda primeiro — é ela que o app analisa', 'warning'); return }
  _videoView = 'prepare'
  const p = el('vid-player'); if (p) p.pause()

  const known = _vidKnownSet()
  const isEn = (_vidCur.lang || 'en') === 'en'
  const freq = {}, firstCue = {}
  let totalTok = 0, knownTok = 0
  _vidCues.forEach(c => {
    const toks = (c.t.toLowerCase().match(/[\p{L}']+/gu) || [])
    toks.forEach(tk => {
      const tok = tk.replace(/^'+|'+$/g, '')
      if (tok.length < 3) return
      totalTok++
      const conhecida = _vidIsKnown(tok, known) || (isEn && _VID_STOP.has(tok))
      if (conhecida) { knownTok++; return }
      freq[tok] = (freq[tok] || 0) + 1
      if (!firstCue[tok]) firstCue[tok] = c.t
    })
  })
  const coverage = totalTok ? Math.round(knownTok / totalTok * 100) : 0
  _vidCur.coverage = coverage; _vidCur.updated_at = new Date().toISOString()
  saveVideos(); autoSyncAfterChange()

  const list = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 60)
  const area = el('video-area'); if (!area) return
  area.innerHTML = `
    <div class="vid-prep">
      <div class="vid-prep-head">
        <div>
          <div class="dash-eyebrow">Preparar para assistir</div>
          <h3>${esc(_vidCur.title)}</h3>
          <p class="vid-prep-sub">Você conhece <b>${coverage}%</b> das palavras deste episódio.
          ${list.length ? `Estas são as que ainda não conhece, por frequência — estude antes, assista entendendo.` : `Nada novo relevante — pode dar o play tranquilo.`}</p>
        </div>
        <div class="vid-prep-acts">
          <button class="btn btn-ghost btn-sm" onclick="videoPrepToggleAll(true)">Marcar todas</button>
          <button class="btn btn-ghost btn-sm" onclick="videoPrepToggleAll(false)">Nenhuma</button>
          <button class="btn btn-primary btn-sm" onclick="videoPrepAdd()">${ic('plus','ic-sm')}Adicionar selecionadas</button>
          <button class="btn btn-ghost btn-sm" onclick="videoOpenPlayerBack()">${ic('undo','ic-sm')}Voltar ao vídeo</button>
        </div>
      </div>
      <div class="vid-prep-list">
        ${list.map(([tok, n]) => `
          <label class="vid-prep-row">
            <input type="checkbox" class="vid-prep-chk" value="${escA(tok)}" ${n >= 3 ? 'checked' : ''}>
            <span class="vid-prep-word">${esc(tok)}</span>
            <span class="vid-prep-n">${n}×</span>
            <span class="vid-prep-ctx" title="${escA(firstCue[tok])}">${esc(firstCue[tok])}</span>
          </label>`).join('')}
      </div>
    </div>`
}

function videoPrepToggleAll(on) {
  document.querySelectorAll('.vid-prep-chk').forEach(c => c.checked = on)
}
function videoPrepAdd() {
  const sel = [...document.querySelectorAll('.vid-prep-chk:checked')].map(c => c.value)
  if (!sel.length) { toast('Nenhuma palavra selecionada', 'warning'); return }
  const known = _vidKnownSet()
  let added = 0
  const freqCue = {}
  _vidCues.forEach(c => sel.forEach(tok => {
    if (!freqCue[tok] && c.t.toLowerCase().includes(tok)) freqCue[tok] = c.t
  }))
  sel.forEach(tok => {
    if (known.has(tok)) return
    createWord({ word: tok, context: freqCue[tok] || '', source_type: _vidCur.source_type || 'series', source_title: _vidCur.title, lang: _vidCur.lang })
    added++
  })
  renderDashboard()
  toast(`${added} palavra${added !== 1 ? 's' : ''} enviada${added !== 1 ? 's' : ''} para Revisar (a IA analisa lá)`, 'success')
  showSection('revisar')
}
async function videoOpenPlayerBack() {
  if (_vidFile && _vidCur) await videoOpenPlayer(_vidCur)
  else renderVideoLib()
}

// ================================================================
// "REVER A CENA" — chega do estudo via core (_pendingClipPlay)
// ================================================================
async function _vidConsumePendingClip() {
  const clipId = _pendingClipPlay; _pendingClipPlay = null
  const clip = clips.find(c => c.id === clipId)
  if (!clip) { renderVideoLib(); return }
  const v = videos.find(x => x.id === clip.videoId)
  if (!v) { toast('O vídeo desta cena não está mais na lista', 'warning'); renderVideoLib(); return }
  // Player de pé? Só toca. Arquivo ainda na memória (veio do "Preparar",
  // p.ex.)? Remonta o player sem pedir o arquivo. Senão, reabre pelo handle.
  if (_vidCur?.id === v.id && el('vid-player')) {
    _vidSeekClip(clip)
    return
  }
  if (_vidCur?.id === v.id && _vidFile) await videoOpenPlayer(v)
  else await videoOpen(v.id)
  const p = el('vid-player')
  if (p) {
    if (p.readyState >= 1) _vidSeekClip(clip)
    else p.addEventListener('loadedmetadata', () => _vidSeekClip(clip), { once: true })
  }
}
function _vidSeekClip(clip) {
  const p = el('vid-player'); if (!p) return
  p.currentTime = Math.max(0, clip.start - 0.3)
  _vidPlayStop = clip.end + 0.3
  p.play()
}
