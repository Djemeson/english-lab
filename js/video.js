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
let _vidShowPT = false          // mostrar TODAS as traduções no transcript
let _vidCapturing = false
let _vidOverlayOn = true        // legenda em tempo real sobre o vídeo
let _vidLivePT = false          // tradução simultânea (legenda PT alinhada ou IA)
let _vidCuesPT = []             // trilha PT-BR baixada dos addons (alinhada por tempo)
let _vidFocus = null            // estudo focado de um trecho {ci,cj,revEN,revPT}
let _vidSubsSaveTimer = null

// ---- IndexedDB próprio: handles de arquivo + legendas ----
const VideoDB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db)
    return new Promise((resolve, reject) => {
      // v2: store 'media' — áudio consertado (m4a extraído pelo ffmpeg.wasm)
      const req = indexedDB.open('el-video-db', 2)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles')
        if (!db.objectStoreNames.contains('subs'))    db.createObjectStore('subs')
        if (!db.objectStoreNames.contains('media'))   db.createObjectStore('media')
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
  _vidCuesPT = (stored && stored.cuesPT) || []
  _vidFocus = null

  if (_vidURL) { URL.revokeObjectURL(_vidURL); _vidURL = null }
  _vidURL = URL.createObjectURL(_vidFile)

  const acts = el('video-ph-actions')
  if (acts) acts.innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="videoSubSearchOpen()" data-tip="Buscar legenda online (addons do Stremio — OpenSubtitles e outros)">${ic('search')}Buscar legenda</button>
    <button class="btn btn-ghost btn-sm" onclick="videoImportSubPick()" data-tip="Importar arquivo .srt/.vtt do computador">${ic('upload')}Importar</button>
    <button class="btn btn-secondary btn-sm" onclick="videoPrepare()" data-tip="Cruza a legenda com seu vocabulário: o que você ainda não conhece neste episódio">${ic('sparkles')}Preparar para assistir</button>
    <button class="btn btn-ghost btn-sm" onclick="videoBackToLib()">${ic('undo')}Biblioteca</button>`

  const area = el('video-area'); if (!area) return
  area.innerHTML = `
    <div class="vid-layout">
      <div class="vid-main">
        <div class="vid-stage">
          <video id="vid-player" src="${_vidURL}" controls preload="metadata"></video>
          <div class="vid-ov" id="vid-ov">
            <span class="vid-ov-en" id="vid-ov-en"></span>
            <span class="vid-ov-pt" id="vid-ov-pt"></span>
          </div>
        </div>
        <div id="vid-audiofix-banner"></div>
        <div class="vid-toolbar">
          <span class="vid-title" data-tip="${escA(v.fileName)}">${esc(v.title)}</span>
          <span style="flex:1"></span>
          <button class="btn btn-ghost btn-sm" onclick="videoAddMarker()" data-tip="Marcar este momento para estudar depois (tecla M)">${ic('flame','ic-sm')}Marcar</button>
          <button class="btn btn-ghost btn-sm ${_vidOverlayOn ? 'vid-on' : ''}" id="vid-ov-toggle" onclick="videoToggleOverlay()" data-tip="Legenda sobre o vídeo, em tempo real">${ic('message','ic-sm')}Legenda</button>
          <button class="btn btn-ghost btn-sm ${_vidLivePT ? 'vid-on' : ''}" id="vid-pt-toggle" onclick="videoToggleLivePT()" data-tip="Tradução SIMULTÂNEA: traduz cada fala enquanto o vídeo toca (IA, centavos por episódio) e mostra sob a legenda">PT ao vivo</button>
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

  // Áudio consertado de sessão anterior? Reanexa. Senão, arma o detector de
  // áudio mudo (MKV com Dolby/DTS: o Chrome toca o vídeo e cala o áudio).
  _vidFixAudio = null
  const fixedBlob = await VideoDB.get('media', v.id)
  if (fixedBlob) _vidAttachFixedAudio(fixedBlob)
  else _vidArmSilentDetector(player)

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

  // Áudio consertado: corrige deriva além de 300ms
  if (_vidFixAudio && !p.paused && Math.abs(_vidFixAudio.currentTime - t) > 0.3) {
    _vidFixAudio.currentTime = t
  }

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
    // Tradução simultânea via IA: garante a fala atual + as 3 próximas
    if (_vidLivePT) _vidEnsurePT(idx, 4)
  }
  _vidUpdateOverlay()
}

// Legenda em tempo real sobre o vídeo (EN + PT quando ligado)
function _vidUpdateOverlay() {
  const en = el('vid-ov-en'), pt = el('vid-ov-pt')
  if (!en || !pt) return
  const cue = _vidCueIdx >= 0 ? _vidCues[_vidCueIdx] : null
  const showEN = _vidOverlayOn && cue
  en.textContent = showEN ? cue.t : ''
  en.style.display = showEN ? '' : 'none'
  const ptTxt = (showEN && _vidLivePT) ? _vidPTof(cue) : ''
  pt.textContent = ptTxt
  pt.style.display = ptTxt ? '' : 'none'
}

// Tradução de uma fala, na ordem de preferência:
// pt (IA, pedida explicitamente) > pts (legenda PT-BR oficial alinhada)
function _vidPTof(cue) { return (cue && (cue.pt || cue.pts)) || '' }

function videoToggleScroll() {
  _vidAutoScroll = !_vidAutoScroll
  el('vid-scroll-toggle')?.classList.toggle('vid-on', _vidAutoScroll)
}
function videoToggleOverlay() {
  _vidOverlayOn = !_vidOverlayOn
  el('vid-ov-toggle')?.classList.toggle('vid-on', _vidOverlayOn)
  _vidUpdateOverlay()
}
function videoToggleLivePT() {
  if (!_vidCues.length) { toast('Importe ou busque a legenda primeiro', 'warning'); return }
  _vidLivePT = !_vidLivePT
  el('vid-pt-toggle')?.classList.toggle('vid-on', _vidLivePT)
  if (_vidLivePT) {
    const temTrilha = _vidCues.some(c => c.pts)
    if (temTrilha) toast('Tradução simultânea ligada — usando a legenda PT-BR alinhada', 'success')
    else if (cfg.openaiKey) { toast('Tradução simultânea ligada — traduzindo com IA enquanto toca (centavos por episódio)', 'info'); if (_vidCueIdx >= 0) _vidEnsurePT(_vidCueIdx, 4) }
    else toast('Sem legenda PT nem chave OpenAI — busque a legenda PT em "Buscar legenda" ou configure a chave', 'warning')
  }
  _vidShowPT = _vidLivePT
  renderVidTranscript()
  _vidUpdateOverlay()
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
  box.innerHTML = _vidCues.map((c, i) => {
    const pt = _vidPTof(c)
    return `
    <div class="vid-cue${_vidSel && i >= _vidSel.ci && i <= _vidSel.cj ? ' insel' : ''}" data-i="${i}">
      <button class="vid-cue-time" onclick="videoPlayCue(${i})" data-tip="Tocar esta fala">${_vidFmtTime(c.s)}</button>
      <div class="vid-cue-body">
        <div class="vid-cue-text" onclick="videoSelectCue(${i})">${esc(c.t)}</div>
        <div class="vid-cue-pt${_vidShowPT || c._rev ? '' : ' hid'}" id="vid-cue-pt-${i}">${esc(pt)}</div>
      </div>
      <button class="vid-cue-ptbtn" onclick="videoCuePT(${i})" data-tip="Traduzir esta fala">pt</button>
    </div>`}).join('')
}

// Tradução de UMA fala do transcript: usa a trilha PT alinhada se houver;
// senão traduz com IA. Revela só a linha pedida (as outras seguem no recall).
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
  if (row) { row.textContent = _vidPTof(c); row.classList.remove('hid') }
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
  _vidFocus = null                    // sai do estudo focado, se estava nele
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
  if (_vidFocus) { _vidRenderFocus(panel); return }
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
        <button class="btn btn-ghost btn-sm" onclick="videoTranslateSel()" data-tip="Traduzir esta(s) fala(s) — aparece no transcript">PT</button>
        <button class="btn btn-secondary btn-sm" onclick="videoFocusStart(_vidSel.ci,_vidSel.cj)" data-tip="Estudo focado: escuta às cegas, revela a fala, revela a tradução, salva palavras">${ic('target','ic-sm')}Estudo focado</button>
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

// ---- Tradução do trecho selecionado (legenda PT alinhada > IA) ----
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
    renderVidTranscript()
    toast('Tradução no transcript (borrada — passe o mouse para revelar)', 'success')
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
    // Com áudio consertado, a fonte sonora é o <audio> paralelo (o vídeo está
    // mudo) — capturamos DELE; a sincronização o mantém colado no vídeo.
    const srcEl = _vidFixAudio || p
    const full = srcEl.captureStream()
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
    _vidSelWords = new Set()
    if (!_vidFocus) { _vidSel = null }   // no estudo focado, o trecho continua aberto
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
          ${cue ? `<button class="btn btn-ghost btn-sm" onclick="videoFocusFromMarker(${t})" data-tip="Estudo focado deste trecho">${ic('target','ic-sm')}estudar</button>` : ''}
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

// ================================================================
// CONSERTAR ÁUDIO — MKVs com Dolby (AC3/EAC3) ou DTS tocam MUDOS no
// Chrome (codecs sem licença no navegador). O ffmpeg.wasm (hospedado no
// próprio site, ~31 MB baixados 1× e cacheados) extrai a faixa e a
// converte para AAC; o m4a fica no IndexedDB e toca num <audio>
// paralelo, sincronizado ao vídeo mudo. Caso real que motivou isto:
// House.of.the.Dragon S03E02 x265-MeGusta (EAC3) — vídeo ok, som nenhum.
// WORKERFS: o arquivo é LIDO sob demanda, nunca copiado para a heap —
// sem isso, um MKV de 2 GB estouraria a memória do wasm.
// ================================================================
let _vidFixAudio = null      // <audio> paralelo com a faixa consertada
let _vidFFmpeg = null        // instância carregada (1× por sessão)
let _vidFixando = false

async function _vidLoadFFmpeg(onProgress) {
  if (_vidFFmpeg) return _vidFFmpeg
  const { FFmpeg } = await import('./vendor/ffmpeg/index.js')
  const ff = new FFmpeg()
  if (onProgress) ff.on('progress', ({ progress }) => onProgress(Math.min(1, progress)))
  const base = new URL('js/vendor/ffmpeg/', document.baseURI).href
  await ff.load({ coreURL: base + 'ffmpeg-core.js', wasmURL: base + 'ffmpeg-core.wasm' })
  _vidFFmpeg = ff
  return ff
}

// Detector: o Chrome expõe webkitAudioDecodedByteCount — se depois de 1,5s
// tocando nada foi decodificado, a faixa existe mas o codec não é suportado.
function _vidArmSilentDetector(player) {
  if (!('webkitAudioDecodedByteCount' in player)) return
  let checado = false
  player.addEventListener('playing', () => {
    if (checado) return
    checado = true
    setTimeout(() => {
      if (!el('vid-player') || _vidFixAudio) return
      if (player.muted || player.volume === 0) { checado = false; return }
      if (player.webkitAudioDecodedByteCount === 0 && player.currentTime > 0.8) {
        _vidShowFixBanner()
      }
    }, 1500)
  })
}

function _vidShowFixBanner() {
  const box = el('vid-audiofix-banner'); if (!box || box.innerHTML) return
  box.innerHTML = `
    <div class="vid-fix-banner">
      <div>
        <b>Este arquivo está sem som?</b>
        <span>O áudio deve ser Dolby/DTS, que o navegador não decodifica. Dá para converter aqui mesmo —
        uma vez só, fica salvo neste aparelho (na primeira vez baixa o conversor, ~31&nbsp;MB).</span>
      </div>
      <button class="btn btn-primary btn-sm" onclick="videoFixAudio()">${ic('volume','ic-sm')}Consertar áudio</button>
      <button class="vid-fix-close" onclick="el('vid-audiofix-banner').innerHTML=''" aria-label="Fechar">${ic('x','ic-sm')}</button>
    </div>`
}

async function videoFixAudio() {
  if (_vidFixando || !_vidFile || !_vidCur) return
  _vidFixando = true
  const box = el('vid-audiofix-banner')
  const setMsg = (m, pct) => { if (box) box.innerHTML = `
    <div class="vid-fix-banner"><div><b>${m}</b>${pct != null ? `
      <span class="vid-fix-bar"><i style="width:${Math.round(pct*100)}%"></i></span>` : ''}</div></div>` }
  try {
    const p = el('vid-player'); if (p) p.pause()
    setMsg('Baixando o conversor (1ª vez)...')
    const ff = await _vidLoadFFmpeg(prog => setMsg('Convertendo o áudio...', prog))
    setMsg('Preparando o arquivo...')
    try { await ff.unmount('/mnt') } catch (e) {}
    try { await ff.createDir('/mnt') } catch (e) {}
    await ff.mount('WORKERFS', { files: [_vidFile] }, '/mnt')
    setMsg('Convertendo o áudio...', 0)
    // -vn ignora o vídeo (HEVC nem é tocado); AAC nativo do ffmpeg
    const code = await ff.exec(['-i', '/mnt/' + _vidFile.name, '-vn', '-c:a', 'aac', '-b:a', '128k', 'out.m4a'])
    if (code !== 0) throw new Error('a conversão retornou código ' + code)
    const data = await ff.readFile('out.m4a')
    try { await ff.deleteFile('out.m4a') } catch (e) {}
    try { await ff.unmount('/mnt') } catch (e) {}
    const blob = new Blob([data.buffer], { type: 'audio/mp4' })
    if (blob.size < 10000) throw new Error('saída vazia — o arquivo tem faixa de áudio?')
    await VideoDB.set('media', _vidCur.id, blob)
    _vidAttachFixedAudio(blob)
    if (box) box.innerHTML = ''
    toast('Áudio consertado — salvo neste aparelho, não precisa repetir', 'success')
  } catch (e) {
    console.warn('[video] fixAudio:', e)
    if (box) box.innerHTML = ''
    _vidShowFixBanner()
    toast('Não consegui converter: ' + e.message, 'error')
  } finally { _vidFixando = false }
}

// Anexa o m4a num <audio> escondido e cola nele os eventos do vídeo.
function _vidAttachFixedAudio(blob) {
  const p = el('vid-player'); if (!p) return
  if (_vidFixAudio) { try { _vidFixAudio.pause() } catch (e) {}; _vidFixAudio.remove() }
  const a = document.createElement('audio')
  a.id = 'vid-fixaudio'
  a.src = URL.createObjectURL(blob)
  a.preload = 'auto'
  document.body.appendChild(a)
  _vidFixAudio = a
  p.muted = true
  const sync = () => { a.currentTime = p.currentTime }
  p.addEventListener('play',  () => { sync(); a.play().catch(() => {}) })
  p.addEventListener('pause', () => a.pause())
  p.addEventListener('seeked', sync)
  p.addEventListener('ratechange', () => { a.playbackRate = p.playbackRate })
  // Chip informativo no toolbar
  const tb = document.querySelector('.vid-toolbar')
  if (tb && !el('vid-fix-chip')) {
    const chip = document.createElement('span')
    chip.id = 'vid-fix-chip'
    chip.className = 'vid-fix-chip'
    chip.title = 'A faixa original (Dolby/DTS) foi convertida para AAC e toca em paralelo'
    chip.innerHTML = `${ic('volume','ic-sm')} áudio consertado`
    tb.insertBefore(chip, tb.children[1])
  }
}

// ================================================================
// BUSCAR LEGENDA — protocolo de ADDONS do Stremio (aberto, com CORS):
//   {addon}/manifest.json e {addon}/subtitles/{tipo}/{imdbId}.json
// A busca de título usa o Cinemeta (catálogo público do Stremio) e o
// moviehash do OpenSubtitles (tamanho + primeiros/últimos 64 KB) acha a
// legenda EXATA do arquivo quando ela existe. Tudo direto do navegador.
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

async function videoSubListLoad(temporada, episodio) {
  const st = _vidSubState; if (!st) return
  if (temporada != null) { st.temporada = temporada; st.episodio = episodio }
  st.passo = 'legendas'; st.carregando = true
  st.hash = st.hash || await openSubtitlesHash(_vidFile).catch(() => null)
  _vidSubRender()
  const id = st.meta.type === 'series' ? `${st.meta.id}:${st.temporada}:${st.episodio}` : st.meta.id
  const extra = st.hash && _vidFile ? `/videoHash=${st.hash}&videoSize=${_vidFile.size}` : ''
  const vistos = new Set(); const subs = []
  await Promise.all(_vidSubAddons().map(async base => {
    const nome = base.replace(/^https?:\/\//, '').split('/')[0].split('.')[0]
    // Com hash primeiro (pode trazer a legenda exata do arquivo); sem hash como reforço
    for (const ex of extra ? [extra, ''] : ['']) {
      try {
        const r = await fetch(`${base}/subtitles/${st.meta.type}/${encodeURIComponent(id)}${ex}.json`)
        if (!r.ok) continue
        const j = await r.json()
        ;(j.subtitles || []).forEach(s => {
          if (!s.url || vistos.has(s.url)) return
          vistos.add(s.url)
          // O hash entra na CONSULTA (o addon prioriza a legenda do arquivo),
          // mas a resposta não diz quais bateram — não prometemos "exata".
          subs.push({ lang: s.lang || '?', url: s.url, addon: nome, exact: false })
        })
      } catch (e) { console.warn('[subs]', base, e.message) }
    }
  }))
  // Inglês primeiro (é o que se estuda), depois PT-BR, depois o resto
  const peso = l => l === 'eng' ? 0 : l === 'pob' ? 1 : l === 'por' ? 2 : 3
  subs.sort((a, b) => (peso(a.lang) - peso(b.lang)) || (b.exact - a.exact))
  st.subs = subs.slice(0, 40)
  st.carregando = false; _vidSubRender()
}

async function videoSubDownload(i, btnEl) {
  const st = _vidSubState; if (!st) return
  const sub = st.subs[i]; if (!sub) return
  if (btnEl) btnEl.innerHTML = '<span class="gen-spinner"></span> baixando...'
  try {
    const r = await fetch(sub.url)
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const buf = await r.arrayBuffer()
    // Encoding na base da evidência: arquivos "UTF-8 com um byte podre" são
    // comuns — o modo estrito rejeitaria o arquivo INTEIRO por causa de um
    // byte. Decodifica dos dois jeitos e fica com o que tiver menos lixo
    // (U+FFFD no UTF-8; Â/â típicos de UTF-8 lido como 1252 no outro).
    const u8 = new TextDecoder('utf-8').decode(buf)
    const w12 = new TextDecoder('windows-1252').decode(buf)
    const ruimU8 = (u8.match(/�/g) || []).length
    const ruimW12 = (w12.match(/Ã[©ªµ£§¡³]|â[€™"]|Â./g) || []).length
    const txt = _vidFixMojibake(ruimU8 <= ruimW12 ? u8 : w12)
    const cues = parseSubtitle(txt)
    if (!cues.length) throw new Error('arquivo não parece uma legenda válida')
    await _vidApplyCues(cues, `online (${VID_LANGS[sub.lang] || sub.lang})`)
    videoSubSearchClose()
    // Se a legenda aplicada NÃO é PT, busca a PT-BR do mesmo episódio em
    // background e alinha — é ela que alimenta o "PT ao vivo" de graça.
    if (sub.lang !== 'pob' && sub.lang !== 'por') _vidAutoFetchPT()
  } catch (e) {
    toast('Falha ao baixar a legenda: ' + e.message, 'error')
    _vidSubRender()
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

// Alinha a trilha PT às falas EN pelo ponto médio de cada fala.
function _vidAlignPTTrack() {
  if (!_vidCues.length || !_vidCuesPT.length) return 0
  let j = 0, alinhadas = 0
  for (const c of _vidCues) {
    const mid = (c.s + c.e) / 2
    while (j < _vidCuesPT.length - 1 && _vidCuesPT[j].e < mid - 1.2) j++
    // candidato atual ou o próximo — fica com o que cobrir/estiver mais perto
    const cand = [_vidCuesPT[j], _vidCuesPT[j + 1]].filter(Boolean)
    let melhor = null, melhorDist = 1.2
    for (const p of cand) {
      const dist = (mid >= p.s && mid <= p.e) ? 0 : Math.min(Math.abs(p.s - mid), Math.abs(p.e - mid))
      if (dist < melhorDist) { melhor = p; melhorDist = dist }
    }
    if (melhor) { c.pts = melhor.t; alinhadas++ }
  }
  return alinhadas
}

// Salva as legendas no IDB (debounced; limpa campos transitórios como _rev)
function _vidSaveSubs() {
  clearTimeout(_vidSubsSaveTimer)
  _vidSubsSaveTimer = setTimeout(() => {
    if (!_vidCur) return
    const limpa = c => { const o = { s: c.s, e: c.e, t: c.t }; if (c.pt) o.pt = c.pt; if (c.pts) o.pts = c.pts; return o }
    VideoDB.set('subs', _vidCur.id, { cues: _vidCues.map(limpa), cuesPT: _vidCuesPT.map(c => ({ s: c.s, e: c.e, t: c.t })) })
  }, 1500)
}

// Garante tradução IA das falas [i .. i+n). `sinc` espera terminar.
async function _vidEnsurePT(i, n, sinc) {
  if (!cfg.openaiKey) return
  const tarefas = []
  for (let k = i; k < Math.min(i + n, _vidCues.length); k++) {
    const c = _vidCues[k]
    if (!c || c.pt || c.pts || c._ptReq) continue
    c._ptReq = true
    const p = aiText([
      { role: 'system', content: 'Traduza a fala de série/filme para português do Brasil, natural e curta. Responda SÓ a tradução.' },
      { role: 'user', content: c.t }
    ], { maxTokens: 200 }).then(pt => {
      c.pt = pt; delete c._ptReq
      // atualiza a linha do transcript e o overlay se for a fala corrente
      const row = el('vid-cue-pt-' + k)
      if (row) row.textContent = pt
      if (k === _vidCueIdx) _vidUpdateOverlay()
      _vidSaveSubs()
    }).catch(e => { delete c._ptReq; console.warn('[video] PT:', e.message) })
    tarefas.push(p)
  }
  if (sinc) await Promise.all(tarefas)
}

// Depois de aplicar uma legenda EN, procura a PT-BR do MESMO episódio na
// lista já consultada e alinha em background — tradução oficial, custo zero.
async function _vidAutoFetchPT() {
  const st = _vidSubState
  if (!st || !st.subs) return
  const alvo = st.subs.find(s => s.lang === 'pob') || st.subs.find(s => s.lang === 'por')
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
function videoFocusStart(ci, cj) {
  if (ci == null || !_vidCues[ci]) return
  _vidFocus = { ci, cj: cj != null ? cj : ci, revEN: false, revPT: false }
  _vidSel = { ci: _vidFocus.ci, cj: _vidFocus.cj, s: _vidCues[_vidFocus.ci].s, e: _vidCues[_vidFocus.cj].e }
  _vidSelWords = new Set()
  renderVidTranscript()
  renderVidSelPanel()
  videoPlaySel()
  el('vid-sel-panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
function videoFocusFromMarker(t) {
  const i = _vidCues.findIndex(c => t >= c.s - 1 && t <= c.e + 1)
  if (i < 0) { toast('Sem fala na legenda neste ponto', 'warning'); return }
  videoFocusStart(i, i)
}
function videoFocusStop() {
  _vidFocus = null
  const p = el('vid-player'); if (p) { p.playbackRate = 1; p.pause() }
  _vidLoop = false
  renderVidSelPanel()
}
function videoFocusSpeed() {
  const p = el('vid-player'); if (!p) return
  p.playbackRate = p.playbackRate === 1 ? 0.75 : 1
  renderVidSelPanel()
}
function videoFocusRevealEN() { if (_vidFocus) { _vidFocus.revEN = true; renderVidSelPanel() } }
async function videoFocusRevealPT() {
  if (!_vidFocus) return
  const falta = []
  for (let i = _vidFocus.ci; i <= _vidFocus.cj; i++) if (!_vidPTof(_vidCues[i])) falta.push(i)
  if (falta.length) {
    if (!cfg.openaiKey) { toast('Sem legenda PT alinhada nem chave OpenAI', 'warning'); return }
    await _vidEnsurePT(_vidFocus.ci, _vidFocus.cj - _vidFocus.ci + 1, true)
  }
  _vidFocus.revPT = true
  renderVidSelPanel()
}

function _vidRenderFocus(panel) {
  const f = _vidFocus
  const p = el('vid-player')
  const dur = (_vidSel.e - _vidSel.s).toFixed(1)
  const words = _vidSelText().split(/\s+/)
  const alvo = _vidTargetPhrase()
  const ptTexto = _vidCues.slice(f.ci, f.cj + 1).map(c => _vidPTof(c)).filter(Boolean).join(' ')
  panel.innerHTML = `
    <div class="vid-sel vid-focus">
      <div class="vid-focus-head">
        <span class="vid-focus-badge">${ic('target','ic-sm')}Estudo focado</span>
        <span class="vid-sel-time">${_vidFmtTime(_vidSel.s)} → ${_vidFmtTime(_vidSel.e)} <i>(${dur}s)</i></span>
        <span style="flex:1"></span>
        <button class="vid-fix-close" onclick="videoFocusStop()" aria-label="Sair">${ic('x','ic-sm')}</button>
      </div>
      <div class="vid-focus-acts">
        <button class="btn btn-primary btn-sm" onclick="videoPlaySel()">${ic('play','ic-sm')}Ouvir de novo</button>
        <button class="btn btn-ghost btn-sm ${p && p.playbackRate !== 1 ? 'vid-on' : ''}" onclick="videoFocusSpeed()" data-tip="Alternar velocidade">${p && p.playbackRate !== 1 ? '0.75×' : '1×'}</button>
        <button class="btn btn-ghost btn-sm ${_vidLoop ? 'vid-on' : ''}" onclick="videoToggleLoop()">${ic('refresh','ic-sm')}Loop</button>
        ${!f.revEN ? `<button class="btn btn-secondary btn-sm" onclick="videoFocusRevealEN()">${ic('eye','ic-sm')}Mostrar a fala</button>` : ''}
        ${f.revEN && !f.revPT ? `<button class="btn btn-secondary btn-sm" onclick="videoFocusRevealPT()">${ic('eye','ic-sm')}Mostrar a tradução</button>` : ''}
      </div>
      ${f.revEN ? `
        <div class="vid-sel-words">${words.map((w, i) =>
          `<span class="vid-word${_vidSelWords.has(i) ? ' on' : ''}" onclick="videoToggleWord(${i})">${esc(w)}</span>`).join(' ')}</div>
        ${f.revPT ? `<div class="vid-focus-pt">${esc(ptTexto || '—')}</div>` : ''}
        <div class="vid-sel-row2">
          <span class="vid-sel-alvo">${alvo ? `Alvo: <b>${esc(alvo)}</b>` : 'Clique na(s) palavra(s) que quer estudar'}</span>
          <button class="btn btn-primary btn-sm" id="vid-card-btn" ${alvo && !_vidCapturing ? '' : 'disabled'} onclick="videoCreateCard()">
            ${ic('zap','ic-sm')}Salvar no estudo com áudio da cena</button>
        </div>` : `
        <div class="vid-focus-blind">Ouça sem ler. Entendeu? Tente repetir. Depois revele a fala.</div>`}
    </div>`
}
