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
let _vidMarkOpen = null         // marcador em ciclo: tempo de início aguardando o fechamento
let _vidSyncing = false
let _vidSubCandidates = []      // legendas da última busca (para a IA testar alternativas)
let _vidAppliedSubUrl = null    // URL da legenda aplicada (para não retestar a mesma)

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
              ${v.position > 15 ? `<span>parou em ${_vidFmtTime(v.position)}</span>` : ''}
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
  if (_vidSubsSaveTimer) _vidSaveSubsNow()   // flush do vídeo anterior
  _vidCur = v
  _videoView = 'player'
  _vidSel = null; _vidSelWords = new Set(); _vidLoop = false; _vidPlayStop = null; _vidCueIdx = -1

  const stored = await VideoDB.get('subs', v.id)
  _vidCues = (stored && stored.cues) || []
  _vidCuesPT = (stored && stored.cuesPT) || []
  _vidSubCandidates = (stored && stored.candidates) || []
  _vidAppliedSubUrl = (stored && stored.appliedUrl) || null
  _vidFocus = null
  // Realinha a trilha PT a cada abertura: é barato (<50ms) e corrige dados
  // salvos por versões antigas do alinhador (sem estimativa de offset).
  if (_vidCues.length && _vidCuesPT.length) { _vidAlignPTTrack(); _vidSaveSubs() }

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
            <span class="vid-ov-en" id="vid-ov-en" title="Arraste para selecionar um trecho; clique duplo seleciona a palavra"></span>
            <span class="vid-ov-pt" id="vid-ov-pt"></span>
          </div>
          <div class="vid-ov-pop hidden" id="vid-ov-pop"></div>
          <button class="vid-skipbtn left" onclick="videoSkip(-5)" data-tip="Voltar 5s (seta ←)">−5s</button>
          <button class="vid-skipbtn right" onclick="videoSkip(5)" data-tip="Avançar 5s (seta →)">+5s</button>
        </div>
        <div id="vid-audiofix-banner"></div>
        <div id="vid-sync-panel" class="hidden"></div>
        <div class="vid-toolbar">
          <span class="vid-title" data-tip="${escA(v.fileName)}">${esc(v.title)}</span>
          <span style="flex:1"></span>
          <button class="btn btn-ghost btn-sm" id="vid-mark-btn" onclick="videoAddMarker()" data-tip="Marca o INÍCIO do trecho; o 2º clique (ou tecla M) fecha e abre o estudo focado">${ic('flame','ic-sm')}Marcar</button>
          <button class="btn btn-ghost btn-sm" id="vid-sync-btn" onclick="videoSyncToggle()" data-tip="Legenda fora de sincronia? Ajuste manual ou automático com IA">${ic('clock','ic-sm')}Sync</button>
          <button class="btn btn-ghost btn-sm ${_vidOverlayOn ? 'vid-on' : ''}" id="vid-ov-toggle" onclick="videoToggleOverlay()" data-tip="Legenda sobre o vídeo, em tempo real">${ic('message','ic-sm')}Legenda</button>
          <button class="btn btn-ghost btn-sm ${_vidLivePT ? 'vid-on' : ''}" id="vid-pt-toggle" onclick="videoToggleLivePT()" data-tip="Tradução SIMULTÂNEA: traduz cada fala enquanto o vídeo toca (IA, centavos por episódio) e mostra sob a legenda">PT ao vivo</button>
          <button class="btn btn-ghost btn-sm ${_vidAutoScroll ? 'vid-on' : ''}" id="vid-scroll-toggle" onclick="videoToggleScroll()" data-tip="Rolagem automática do transcript">${ic('arrowRight','ic-sm')}Seguir</button>
          <button class="btn btn-ghost btn-sm" onclick="videoToggleFullscreen()" data-tip="Tela cheia COM a legenda interativa (o botão do player usa a legenda nativa)"><svg class="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>Tela cheia</button>
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

  // ---- Retomar de onde parou ----
  // A posição é salva a cada ~5s de reprodução (e no pause/saída). Na volta,
  // recua 2s para dar contexto. Perto do fim (<20s) não retoma; 'ended' zera.
  player.addEventListener('loadedmetadata', () => {
    const pos = v.position || 0
    if (pos > 15 && (!isFinite(player.duration) || pos < player.duration - 20)) {
      player.currentTime = Math.max(0, pos - 2)
      toast(`Retomando de ${_vidFmtTime(pos)} — de onde você parou`, 'info')
    }
  }, { once: true })
  player.addEventListener('pause', _vidSavePos)
  player.addEventListener('ended', () => { v.position = 0; saveVideos() })

  // Áudio consertado de sessão anterior? Reanexa. Senão, arma o detector de
  // áudio mudo (MKV com Dolby/DTS: o Chrome toca o vídeo e cala o áudio).
  _vidFixAudio = null
  const fixedBlob = await VideoDB.get('media', v.id)
  if (fixedBlob) _vidAttachFixedAudio(fixedBlob)
  else _vidArmSilentDetector(player)

  renderVidTranscript()
  renderVidMarkers()
  renderVidSelPanel()
  _vidOvBind()          // seleção na legenda sobre o vídeo
  if (!_vidCues.length) _vidAutoSub()   // 1ª vez: acha e aplica a legenda sozinho


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
  _vidSavePos()
  // Flush ANTES de anular _vidCur: o save debounced (1,5s) aborta sem ele —
  // sair rápido do player perdia a última mudança de legenda (bug real).
  if (_vidSubsSaveTimer) _vidSaveSubsNow()
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

  // Posição para o "continuar de onde parou" (grava a cada ~5s de avanço)
  if (_vidCur && Math.abs(t - (_vidCur.position || 0)) > 5) {
    _vidCur.position = +t.toFixed(1); saveVideos()
  }

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
  el('vid-ov-pop')?.classList.add('hidden')
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
  const pop = el('vid-ov-pop')
  if (pop && !pop.classList.contains('hidden')) return   // seleção em curso
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
    // Fusão PT (um cue PT cobrindo duas falas EN): mostra o texto só na
    // primeira; a seguinte ganha a seta de continuação em vez de repetir.
    const repetida = pt && i > 0 && _vidPTof(_vidCues[i - 1]) === pt
    const fonte = c.pt ? 'traduzido por IA' : (c.pts ? 'da legenda PT-BR (alinhada)' : '')
    return `
    <div class="vid-cue${_vidSel && i >= _vidSel.ci && i <= _vidSel.cj ? ' insel' : ''}" data-i="${i}">
      <button class="vid-cue-time" onclick="videoPlayCue(${i})" data-tip="Tocar esta fala">${_vidFmtTime(c.s)}</button>
      <div class="vid-cue-body">
        <div class="vid-cue-text" onclick="videoSelectCue(${i})">${esc(c.t)}</div>
        <div class="vid-cue-pt${_vidShowPT || c._rev ? '' : ' hid'}${c._rev ? ' show' : ''}" id="vid-cue-pt-${i}" title="${escA(fonte)}">${repetida ? '⤷ (mesma tradução da fala acima)' : esc(pt)}</div>
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
  if (row) { row.textContent = _vidPTof(c); row.classList.remove('hid'); row.classList.add('show') }
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
      ${_vidSel.pt ? `<div class="vid-focus-pt">${esc(_vidSel.pt)}</div>` : ''}
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
async function videoCreateCard(alvoOverride) {
  if (_vidCapturing) return
  const alvo = alvoOverride || _vidTargetPhrase()
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
// MARCADORES EM CICLO — o 1º M abre o trecho, o 2º M fecha e leva
// DIRETO para o estudo focado. É o fluxo "não entendi essa fala":
// marca onde começou a confusão, marca onde terminou, vai aprender.
// (Marcadores antigos, de ponto único, continuam funcionando.)
// ================================================================
function videoAddMarker() {
  const p = el('vid-player'); if (!p || !_vidCur) return
  const t = +p.currentTime.toFixed(1)

  if (_vidMarkOpen == null) {
    _vidMarkOpen = t
    _vidMarkBtnState(true)
    toast(`Início do trecho marcado em ${_vidFmtTime(t)} — aperte M de novo para fechar`, 'info')
    return
  }

  let a = _vidMarkOpen, b = t
  _vidMarkOpen = null
  _vidMarkBtnState(false)
  if (b < a) { const x = a; a = b; b = x }
  if (b - a < 0.8) { toast('Trecho curto demais — marcação cancelada', 'info'); return }

  _vidCur.markers = _vidCur.markers || []
  _vidCur.markers.push({ a: +a.toFixed(1), b: +b.toFixed(1) })
  _vidCur.updated_at = new Date().toISOString()
  saveVideos(); autoSyncAfterChange()
  renderVidMarkers()
  videoFocusRange(a, b)   // o trecho fechado vai direto para o estudo
}

// Botão "Marcar" reflete o ciclo aberto
function _vidMarkBtnState(aberto) {
  const btn = el('vid-mark-btn'); if (!btn) return
  btn.classList.toggle('vid-marking', aberto)
  btn.innerHTML = aberto ? `${ic('flame','ic-sm')}Fechar trecho` : `${ic('flame','ic-sm')}Marcar`
}

// Estudo focado a partir de um INTERVALO de tempo: acha as falas que o
// trecho toca e abre o foco nelas (bordas respeitam o que foi marcado).
function videoFocusRange(a, b) {
  if (!_vidCues.length) { toast('Importe a legenda primeiro — o estudo focado usa as falas', 'warning'); return }
  let ci = -1, cj = -1
  for (let i = 0; i < _vidCues.length; i++) {
    const c = _vidCues[i]
    if (c.e >= a && c.s <= b) { if (ci < 0) ci = i; cj = i }
    if (c.s > b) break
  }
  if (ci < 0) { toast('Sem falas na legenda dentro do trecho marcado', 'warning'); return }
  videoFocusStart(ci, cj)
  // bordas: o marcado vence quando é mais largo que as falas
  _vidSel.s = Math.min(_vidSel.s, a); _vidSel.e = Math.max(_vidSel.e, b)
  renderVidSelPanel()
}

function renderVidMarkers() {
  const box = el('vid-markers'); if (!box) return
  const ms = (_vidCur && _vidCur.markers) || []
  if (!ms.length) { box.innerHTML = ''; return }
  box.innerHTML = `
    <div class="vid-markers">
      <div class="vid-markers-head">Trechos marcados <span>${ms.length}</span></div>
      ${ms.map((m, i) => {
        const range = typeof m === 'number' ? null : m
        const t0 = range ? range.a : m
        const cue = _vidCues.find(c => t0 >= c.s - 1 && t0 <= c.e + 1) ||
                    (range ? _vidCues.find(c => c.e >= range.a && c.s <= range.b) : null)
        const rotulo = range ? `${_vidFmtTime(range.a)} → ${_vidFmtTime(range.b)} (${(range.b - range.a).toFixed(0)}s)` : _vidFmtTime(m)
        const estudar = range ? `videoFocusRange(${range.a},${range.b})` : (cue ? `videoFocusFromMarker(${m})` : '')
        return `<div class="vid-marker-row">
          <button class="vid-cue-time" onclick="videoSeekMarker(${t0})">${rotulo}</button>
          <span class="vid-marker-text">${cue ? esc(cue.t) : '(sem fala na legenda neste ponto)'}</span>
          ${estudar ? `<button class="btn btn-ghost btn-sm" onclick="${estudar}" data-tip="Estudo focado deste trecho">${ic('target','ic-sm')}estudar</button>` : ''}
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
  // Dedup consecutivo: quando um cue PT cobre DUAS falas EN (fusão comum em
  // legendas PT), o mesmo texto não pode aparecer duas vezes no trecho.
  const ptTexto = _vidCues.slice(f.ci, f.cj + 1).map(c => _vidPTof(c))
    .filter((t, i, a) => t && t !== a[i - 1]).join(' ')
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

// ================================================================
// SINCRONIZAÇÃO DA LEGENDA
// Manual: desloca a legenda inteira em passos de ±0,1s / ±0,5s.
// Automática (IA): grava ~45s do áudio REAL, transcreve com Whisper
// (timestamps por segmento), casa cada segmento transcrito com a fala
// mais parecida da legenda e aplica a MEDIANA dos desvios. Custo:
// ~R$ 0,03 por sincronização. É "a IA escuta e alinha".
// ================================================================
function videoSyncToggle() {
  const panel = el('vid-sync-panel'); if (!panel) return
  if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return }
  panel.classList.remove('hidden')
  _vidSyncRender()
}

function _vidSyncRender(msg) {
  const panel = el('vid-sync-panel'); if (!panel) return
  const shift = (_vidCur && _vidCur.subShift) || 0
  panel.innerHTML = `
    <div class="vid-sync">
      <div class="vid-sync-row">
        <span class="vid-sync-lbl">${ic('clock','ic-sm')}Sincronia da legenda</span>
        <span class="vid-sync-shift" data-tip="Deslocamento acumulado aplicado à legenda">${shift > 0 ? '+' : ''}${shift.toFixed(1)}s</span>
        <span style="flex:1"></span>
        <button class="vid-fix-close" onclick="el('vid-sync-panel').classList.add('hidden')" aria-label="Fechar">${ic('x','ic-sm')}</button>
      </div>
      <div class="vid-sync-row">
        <span class="vid-sync-hint">Legenda ATRASADA (fala vem antes do texto)? Use −. Adiantada? Use +.</span>
      </div>
      <div class="vid-sync-row">
        <button class="btn btn-ghost btn-sm" onclick="videoSubShift(-0.5)">−0,5s</button>
        <button class="btn btn-ghost btn-sm" onclick="videoSubShift(-0.1)">−0,1s</button>
        <button class="btn btn-ghost btn-sm" onclick="videoSubShift(0.1)">+0,1s</button>
        <button class="btn btn-ghost btn-sm" onclick="videoSubShift(0.5)">+0,5s</button>
        <span style="flex:1"></span>
        <button class="btn btn-ghost btn-sm" ${_vidSyncing ? 'disabled' : ''} onclick="videoSyncAutoAqui()"
          data-tip="Último recurso: leva o vídeo até um diálogo, pausa ali e a IA analisa DESSE ponto em diante">
          ${ic('play','ic-sm')}IA do ponto atual</button>
        <button class="btn btn-primary btn-sm" ${_vidSyncing ? 'disabled' : ''} onclick="videoSyncAuto()"
          data-tip="A IA acha sozinha o trecho mais falado do episódio, escuta ~45s, transcreve com timestamps e alinha a legenda (~R$ 0,03)">
          ${ic('sparkles','ic-sm')}Sincronizar com IA</button>
      </div>
      <div class="vid-sync-row">
        <span class="vid-sync-hint">Leve a sincronização com você:</span>
        <button class="btn btn-ghost btn-sm" onclick="videoSubExport()" data-tip="Baixa o .srt COM a sincronização aplicada, com o mesmo nome do vídeo — na mesma pasta, qualquer player carrega sozinho">${ic('download','ic-sm')}Baixar .srt</button>
        ${_vidCuesPT.length ? `<button class="btn btn-ghost btn-sm" onclick="videoSubExport('pt')" data-tip="Baixa a trilha PT-BR alinhada">${ic('download','ic-sm')}.srt PT-BR</button>` : ''}
      </div>
      ${msg ? `<div class="vid-sync-status">${msg}</div>` : ''}
    </div>`
}

// Acha a janela de `dur` segundos com MAIS FALA, medida pela própria
// legenda (soma da duração das falas na janela). É onde o Whisper tem
// mais material para casar — a densidade sobrevive a legendas fora de
// sincronia, porque o desvio típico é de segundos, não de minutos.
function _vidBestSampleStart(dur, deT, ateT) {
  if (!_vidCues.length) return 60
  const fimVideo = (isFinite(_vidCur?.duration) && _vidCur.duration > dur) ? _vidCur.duration : Infinity
  const lo = deT || 0, hi = Math.min(ateT != null ? ateT : Infinity, fimVideo)
  let melhor = null, melhorFala = -1
  for (let i = 0; i < _vidCues.length; i++) {
    const ini = _vidCues[i].s
    if (ini < lo) continue
    if (ini + dur > hi) break
    let fala = 0
    for (let j = i; j < _vidCues.length && _vidCues[j].s < ini + dur; j++) {
      fala += Math.min(_vidCues[j].e, ini + dur) - _vidCues[j].s
    }
    if (fala > melhorFala) { melhorFala = fala; melhor = ini }
  }
  if (melhor == null) melhor = Math.max(lo, _vidCues[0].s)
  return Math.max(0, melhor - 1)
}

// Último recurso: o usuário posiciona o vídeo num diálogo e a IA parte dali
function videoSyncAutoAqui() {
  const p = el('vid-player'); if (!p) return
  videoSyncAuto(45, p.currentTime)
}

// Desloca TODAS as falas (EN e trilha PT juntas — o desvio é do arquivo)
function videoSubShift(delta) {
  if (!_vidCues.length || !_vidCur) return
  _vidCues.forEach(c => { c.s = Math.max(0, c.s + delta); c.e = Math.max(0.3, c.e + delta) })
  _vidCuesPT.forEach(c => { c.s = Math.max(0, c.s + delta); c.e = Math.max(0.3, c.e + delta) })
  _vidCur.subShift = +(((_vidCur.subShift || 0) + delta).toFixed(2))
  _vidCur.updated_at = new Date().toISOString()
  saveVideos(); autoSyncAfterChange()
  _vidSaveSubs()
  _vidCueIdx = -1            // força recomputar a fala corrente
  renderVidTranscript(); _vidUpdateOverlay(); _vidSyncRender()
}

// ---- Automática: a IA escuta, verifica em DOIS pontos e, se a legenda
// for de outra versão (deriva no meio), testa as CANDIDATAS da última
// busca contra as MESMAS amostras (grátis) e adota a que casar.
async function videoSyncAuto(dur, t0Manual) {
  if (_vidSyncing) return
  if (!_vidCues.length) { toast('Importe a legenda primeiro', 'warning'); return }
  if (!cfg.openaiKey) { toast('A sincronização automática usa a IA — configure a chave OpenAI', 'warning'); return }
  const p = el('vid-player'); if (!p) return
  _vidSyncing = true
  dur = dur || 40
  let msgFinal = ''
  try {
    // Janelas: 2 pontos (1º e 2º terço) quando o episódio permite — é a
    // verificação de deriva; 1 ponto para vídeos curtos ou escolha manual.
    const fimLeg = _vidCues[_vidCues.length - 1].e
    let janelas
    if (t0Manual != null) janelas = [Math.max(0, t0Manual)]
    else if (fimLeg > 240) janelas = [_vidBestSampleStart(dur, 0, fimLeg * 0.45), _vidBestSampleStart(dur, fimLeg * 0.5, fimLeg)]
    else janelas = [_vidBestSampleStart(dur, 0, fimLeg)]

    const amostras = []
    for (let k = 0; k < janelas.length; k++) {
      const t0 = janelas[k]
      _vidSyncRender(`<span class="gen-spinner"></span> Gravando amostra ${k + 1}/${janelas.length} a partir de ${_vidFmtTime(t0)} (você vai ouvi-la)...`)
      const b64 = await captureClipAudio(t0, t0 + dur)
      _vidSyncRender(`<span class="gen-spinner"></span> Transcrevendo amostra ${k + 1}/${janelas.length} com a IA...`)
      const segs = await _vidWhisper(b64, t0)
      amostras.push(segs)
    }
    if (amostras.flat().length < 3) throw new Error('a amostra tem pouca fala — tente "IA do ponto atual" num diálogo')

    // Avalia a legenda ATUAL nos pontos amostrados
    const aval = _vidAvaliaLegenda(_vidCues, amostras)
    if (aval.matched >= 3 && aval.spread <= 0.7 && aval.disp <= 1.5) {
      // Offset constante: caso bom — aplica e encerra
      if (Math.abs(aval.mediana) < 0.15) {
        msgFinal = `${ic('checkCircle','ic-sm')} Em sincronia de ponta a ponta (${aval.matched} falas casadas em ${janelas.length} ponto${janelas.length > 1 ? 's' : ''}).`
      } else {
        videoSubShift(+(-aval.mediana).toFixed(2))
        msgFinal = `${ic('checkCircle','ic-sm')} Sincronizado: legenda ${aval.mediana > 0 ? 'adiantada' : 'atrasada'} ${Math.abs(aval.mediana).toFixed(1)}s — verificado em ${janelas.length} ponto${janelas.length > 1 ? 's' : ''} (${aval.matched} falas).`
        toast('Legenda sincronizada pela IA', 'success')
      }
    } else {
      // Deriva (versão diferente) ou legenda que não casa: testa TODAS as
      // candidatas da mesma língua (o Djemeson pegou o teto de 5 deixando a
      // boa de fora). O custo de cada teste é 1 download + matching local —
      // a transcrição do Whisper é reaproveitada.
      const LANG3 = { en: 'eng', es: 'spa', fr: 'fre', de: 'ger', it: 'ita', pt: 'por', ja: 'jpn', ko: 'kor', ru: 'rus' }
      const langAtual = (_vidSubCandidates.find(x => x.url === _vidAppliedSubUrl) || {}).lang
        || LANG3[_vidCur.lang || 'en'] || 'eng'
      const candidatas = _vidSubCandidates.filter(c => c.url !== _vidAppliedSubUrl && c.lang === langAtual)
      const ruindade = av => Math.max(av.spread, av.disp)
      let melhor = null, parcial = null
      for (let i = 0; i < candidatas.length; i++) {
        _vidSyncRender(`<span class="gen-spinner"></span> Esta legenda ${aval.matched < 3 ? 'não casa com o áudio' : 'deriva no meio (versão diferente)'} — testando alternativa ${i + 1}/${candidatas.length}...`)
        try {
          const r = await fetch(candidatas[i].url)
          if (!r.ok) continue
          const cues2 = parseSubtitle(_vidDecodeSubBuf(await r.arrayBuffer()))
          if (cues2.length < 20) continue
          const a2 = _vidAvaliaLegenda(cues2, amostras)
          if (a2.matched < 3) continue
          if (a2.spread <= 0.7 && a2.disp <= 1.5 && (!melhor || a2.matched > melhor.aval.matched)) {
            melhor = { cand: candidatas[i], cues: cues2, aval: a2 }
            if (a2.matched >= 8) break     // casou bem — não precisa testar o resto
          }
          // menos ruim: guarda a de menor deriva, caso nenhuma seja perfeita
          if (!parcial || ruindade(a2) < ruindade(parcial.aval)) parcial = { cand: candidatas[i], cues: cues2, aval: a2 }
        } catch (e) { console.warn('[sync] candidata falhou:', e.message) }
      }
      const derivaAtual = aval.matched >= 3 ? ruindade(aval) : Infinity
      if (melhor) {
        _vidAdoptSub(melhor.cand, melhor.cues, melhor.aval.mediana)
        msgFinal = `${ic('checkCircle','ic-sm')} A legenda anterior era de OUTRA versão do vídeo — troquei por uma que casa de ponta a ponta (${melhor.aval.matched} falas verificadas em ${candidatas.length} alternativas) e sincronizei.`
        toast('A IA trocou a legenda por uma da versão certa', 'success')
      } else if (parcial && ruindade(parcial.aval) < derivaAtual - 1) {
        // Nenhuma é perfeita, mas há uma CLARAMENTE melhor que a atual
        _vidAdoptSub(parcial.cand, parcial.cues, parcial.aval.comeco)
        msgFinal = `Nenhuma das ${candidatas.length} legendas casa de ponta a ponta, mas troquei pela MENOS derivada: ${ruindade(parcial.aval).toFixed(1)}s de deriva contra ${isFinite(derivaAtual) ? derivaAtual.toFixed(1) + 's' : 'uma que nem casava'} da anterior, com o começo ajustado. Ainda pode escorregar adiante.`
        toast('A IA trocou pela legenda menos derivada', 'info')
      } else if (aval.matched >= 3) {
        videoSubShift(+(-aval.comeco).toFixed(2))
        msgFinal = `Ajustei o COMEÇO, mas esta legenda deriva ${ruindade(aval).toFixed(1)}s ao longo do episódio (versão com cortes diferentes) e nenhuma das ${candidatas.length} alternativas testadas casou melhor. Vai dessincronizar adiante — tente outra fonte de legenda.`
      } else {
        throw new Error(`nenhuma legenda casou com o áudio (${candidatas.length} alternativas testadas) — pode ser outro episódio`)
      }
    }
  } catch (e) {
    console.warn('[video] syncAuto:', e)
    msgFinal = `Não deu: ${esc(e.message)}. Tente "IA do ponto atual" — pause o vídeo num diálogo e clique — ou os botões manuais.`
  } finally {
    // A trava SÓ libera aqui — e o painel é re-renderizado DEPOIS dela, senão
    // o botão nasce desabilitado e assim fica.
    _vidSyncing = false
    const p2 = el('vid-player'); if (p2) p2.pause()
    _vidSyncRender(msgFinal)
  }
}

// Adota uma legenda candidata: substitui a salva, realinha a trilha PT e
// aplica o ajuste fino de offset
function _vidAdoptSub(cand, cues, offset) {
  _vidCues = cues
  _vidAppliedSubUrl = cand.url
  _vidCur.subShift = 0
  if (_vidCuesPT.length) _vidAlignPTTrack()
  if (Math.abs(offset) >= 0.15) videoSubShift(+(-offset).toFixed(2))
  else { _vidSaveSubs(); _vidCueIdx = -1; renderVidTranscript(); _vidUpdateOverlay() }
  _vidCur.cueCount = _vidCues.length
  saveVideos(); autoSyncAfterChange()
}

// Whisper com timestamps: amostra (dataURL) → segmentos em tempo ABSOLUTO
async function _vidWhisper(b64, t0) {
  const blob = await (await fetch(b64)).blob()
  const fd = new FormData()
  fd.append('file', blob, 'amostra.webm')
  fd.append('model', 'whisper-1')
  fd.append('response_format', 'verbose_json')
  if ((_vidCur.lang || 'en') === 'en') fd.append('language', 'en')
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 120000)
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { 'Authorization': `Bearer ${cfg.openaiKey}` }, body: fd, signal: ctl.signal
  })
  clearTimeout(timer)
  if (!res.ok) {
    let msg = 'HTTP ' + res.status
    try { const e = await res.json(); if (e.error?.message) msg = e.error.message } catch {}
    throw new Error(msg)
  }
  const data = await res.json()
  return (data.segments || []).map(s => ({ t: s.text, abs: t0 + s.start }))
    .filter(s => (s.t || '').trim().length > 6)
}

// Casa os segmentos transcritos com as falas de UMA legenda e mede:
// mediana por amostra, mediana geral e o SPREAD entre as amostras —
// spread alto = a legenda deriva = versão diferente do vídeo.
function _vidAvaliaLegenda(cues, amostras) {
  let _c = 0
  const norm = t => String(t).toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(w => w.length > 1)
  const medianas = [], todos = []
  for (const segs of amostras) {
    const deltas = []
    for (const seg of segs) {
      const tokensSeg = new Set(norm(seg.t))
      if (tokensSeg.size < 3) continue
      let melhor = null, melhorScore = 0
      for (const c of cues) {
        if (c.s < seg.abs - 60 || c.s > seg.abs + 60) continue
        const tokensCue = norm(c.t)
        if (!tokensCue.length) continue
        let inter = 0
        for (const w of tokensCue) if (tokensSeg.has(w)) inter++
        const score = inter / Math.min(tokensSeg.size, tokensCue.length)
        if (score > melhorScore) { melhorScore = score; melhor = c }
      }
      if (melhor && melhorScore >= 0.5) deltas.push(melhor.s - seg.abs)
    }
    if (deltas.length) {
      // comeco: mediana da PRIMEIRA metade da 1a amostra (em ordem de tempo)
      // — e o que o fallback usa para ao menos acertar o inicio do episodio
      if (!medianas.length) {
        const metade = deltas.slice(0, Math.ceil(deltas.length / 2)).sort((a, b) => a - b)
        _c = metade[Math.floor(metade.length / 2)]
      }
      deltas.sort((a, b) => a - b)
      medianas.push(deltas[Math.floor(deltas.length / 2)])
      todos.push(...deltas)
    }
  }
  todos.sort((a, b) => a - b)
  // disp: dispersão DENTRO das amostras (aparada nas pontas quando há dados
  // suficientes). Pega deriva mesmo com uma janela só: numa legenda da versão
  // certa os desvios são todos parecidos; numa de versão diferente, os do
  // começo e os do fim da amostra divergem.
  let disp = 0
  if (todos.length >= 2) {
    const corte = todos.length >= 6 ? 1 : 0
    disp = todos[todos.length - 1 - corte] - todos[corte]
  }
  return {
    matched: todos.length,
    medianas,
    mediana: todos.length ? todos[Math.floor(todos.length / 2)] : 0,
    spread: medianas.length > 1 ? Math.max(...medianas) - Math.min(...medianas) : 0,
    disp,
    comeco: _c
  }
}

// Decodificação de legenda (UTF-8 × 1252 por evidência + des-mojibake)
function _vidDecodeSubBuf(buf) {
  const u8 = new TextDecoder('utf-8').decode(buf)
  const w12 = new TextDecoder('windows-1252').decode(buf)
  const ruimU8 = (u8.match(/\uFFFD/g) || []).length
  const ruimW12 = (w12.match(/Ã[©ªµ£§¡³]|â[€™"]|Â./g) || []).length
  return _vidFixMojibake(ruimU8 <= ruimW12 ? u8 : w12)
}

// ---- Baixar a legenda SINCRONIZADA como .srt ----
// Mesmo nome do arquivo de vídeo: players externos a carregam sozinhos.
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
function _vidOvBind() {
  const en = el('vid-ov-en'); if (!en || en._bound) return
  en._bound = true
  en.addEventListener('mousedown', () => { const p = el('vid-player'); if (p && !p.paused) p.pause() })
  en.addEventListener('mouseup', () => setTimeout(_vidOvSelCheck, 10))
  en.addEventListener('dblclick', () => setTimeout(_vidOvSelCheck, 10))
}

function _vidOvSelCheck() {
  const pop = el('vid-ov-pop'); const en = el('vid-ov-en')
  if (!pop || !en) return
  const sel = window.getSelection()
  const bruto = (sel && sel.toString()) || ''
  const txt = bruto.replace(/\s+/g, ' ').trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
  if (!txt || txt.length < 2 || txt.length > 80 || !sel.anchorNode || !en.contains(sel.anchorNode)) {
    pop.classList.add('hidden'); return
  }
  window._vidOvSelText = txt
  pop.innerHTML = `
    <b>"${esc(txt)}"</b>
    <button class="btn btn-primary btn-sm" onclick="videoOvStudy(true)" data-tip="Cria o card já com o áudio real desta cena">${ic('zap','ic-sm')}Estudar com áudio</button>
    <button class="btn btn-ghost btn-sm" onclick="videoOvStudy(false)" data-tip="Manda para a fila do Revisar (a IA analisa lá)">${ic('eye','ic-sm')}Revisar</button>`
  pop.classList.remove('hidden')
}

// Fala correspondente ao instante t (tolerância de 300ms)
function _vidCueAt(t) { return _vidCues.findIndex(c => t >= c.s - 0.3 && t <= c.e + 0.3) }

async function videoOvStudy(comAudio) {
  const alvo = window._vidOvSelText
  el('vid-ov-pop')?.classList.add('hidden')
  try { window.getSelection().removeAllRanges() } catch (e) {}
  if (!alvo || !_vidCur) return
  const p = el('vid-player')
  const i = _vidCueIdx >= 0 ? _vidCueIdx : _vidCueAt(p ? p.currentTime : 0)
  const c = _vidCues[i]
  if (!c) { toast('Não achei a fala correspondente na legenda', 'warning'); return }
  if (comAudio) {
    _vidFocus = null
    _vidSel = { ci: i, cj: i, s: c.s, e: c.e }
    _vidSelWords = new Set()
    renderVidTranscript(); renderVidSelPanel()
    toast('Gravando o áudio da cena e analisando — alguns segundos...', 'info')
    await videoCreateCard(alvo)
  } else {
    createWord({ word: alvo, context: c.t, source_type: _vidCur.source_type || 'series', source_title: _vidCur.title, lang: _vidCur.lang })
    renderDashboard()
    toast(`"${alvo}" enviado para Revisar`, 'success')
  }
}

// ================================================================
// CONTINUAR DE ONDE PAROU — persistência da posição + flush de saída
// ================================================================
function _vidSavePos() {
  const p = el('vid-player')
  if (!p || !_vidCur) return
  if (p.currentTime > 5) { _vidCur.position = +p.currentTime.toFixed(1); saveVideos() }
}

// Fechar a aba / trocar de app não pode perder nem a posição nem uma
// mudança de legenda que ainda estava no debounce de 1,5s.
if (!window._vidFlushBound) {
  window._vidFlushBound = true
  const _vidFlush = () => {
    _vidSavePos()
    if (_vidSubsSaveTimer) _vidSaveSubsNow()
  }
  window.addEventListener('beforeunload', _vidFlush)
  document.addEventListener('visibilitychange', () => { if (document.hidden) _vidFlush() })
}

// ================================================================
// TELA CHEIA COM LEGENDA
// Caminho 1 (botão próprio): fullscreen no .vid-stage — o overlay
// interativo vai junto (dá para selecionar palavra em tela cheia).
// Caminho 2 (botão nativo do player): o fullscreen é só do <video>,
// onde nenhum overlay entra — então injetamos uma trilha de legenda
// NATIVA (TextTrack/VTTCue), que o player renderiza em qualquer modo.
// ================================================================
// Pular alguns segundos (botões no vídeo + setas do teclado)
function videoSkip(d) {
  const p = el('vid-player'); if (!p) return
  p.currentTime = Math.max(0, p.currentTime + d)
}
if (!window._vidSkipKeysBound) {
  window._vidSkipKeysBound = true
  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const tag = (document.activeElement?.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return
    if (!document.getElementById('section-video')?.classList.contains('active')) return
    if (!el('vid-player')) return
    if (document.activeElement === el('vid-player')) return   // o player nativo já trata
    e.preventDefault()
    videoSkip(e.key === 'ArrowLeft' ? -5 : 5)
  })
}

function videoToggleFullscreen() {
  const stage = document.querySelector('.vid-stage'); if (!stage) return
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  else stage.requestFullscreen().catch(e => toast('Tela cheia bloqueada: ' + e.message, 'warning'))
}

let _vidTrack = null
function _vidFillTrack() {
  const p = el('vid-player'); if (!p) return
  if (!_vidTrack || _vidTrack._for !== p) {
    _vidTrack = p.addTextTrack('subtitles', 'Estudo', 'en')
    _vidTrack._for = p
  }
  const velhos = _vidTrack.cues ? [..._vidTrack.cues] : []
  velhos.forEach(c => { try { _vidTrack.removeCue(c) } catch (e) {} })
  for (const c of _vidCues) {
    const pt = _vidLivePT ? _vidPTof(c) : ''
    try {
      const cue = new VTTCue(c.s, c.e, pt ? c.t + '\n' + pt : c.t)
      cue.line = -3          // um pouco acima da borda, longe dos controles
      _vidTrack.addCue(cue)
    } catch (e) {}
  }
}

if (!window._vidFsBound) {
  window._vidFsBound = true
  document.addEventListener('fullscreenchange', () => {
    const p = el('vid-player')
    if (!p) return
    if (document.fullscreenElement === p) {
      // fullscreen NATIVO (só o vídeo): liga a trilha nativa
      if (_vidOverlayOn && _vidCues.length) { _vidFillTrack(); _vidTrack.mode = 'showing' }
    } else if (_vidTrack) {
      // saiu, ou é o fullscreen do stage (overlay rico cuida da legenda)
      _vidTrack.mode = 'hidden'
    }
  })
}
