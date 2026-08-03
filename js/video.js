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
          <button class="vid-skipbtn left" onclick="videoSkip(-5)" data-tip="Voltar 5s (Shift+←)">−5s</button>
          <button class="vid-skipbtn right" onclick="videoSkip(5)" data-tip="Avançar 5s (Shift+→)">+5s</button>
          <button class="vid-skipbtn vid-cuebtn left" onclick="videoCueNav(-1)" data-tip="Fala anterior (←) — de novo no meio de uma fala volta ao início dela">‹‹</button>
          <button class="vid-skipbtn vid-cuebtn right" onclick="videoCueNav(1)" data-tip="Próxima fala (→)">››</button>
        </div>
        <div id="vid-audiofix-banner"></div>
        <div id="vid-sync-panel" class="hidden"></div>
        <div class="vid-toolbar">
          <span class="vid-title" data-tip="${escA(v.fileName)}">${esc(v.title)}</span>
          <span style="flex:1"></span>
          <button class="btn btn-ghost btn-sm" onclick="videoReplayCue()" data-tip="A frase passou? Volta ao início da fala atual/última (tecla R)">${ic('undo','ic-sm')}Repetir fala</button>
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
function renderVidTranscript() {
  const box = el('vid-transcript'); if (!box) return
  if (!_vidCues.length) {
    box.innerHTML = `
      <div class="vid-transcript-empty">
        ${ic('upload','ic-lg')}
        <p><b>Sem legenda ainda.</b></p>
        <p>Arraste um arquivo <b>.srt</b>/<b>.vtt</b> aqui, ou use o botão "Legenda" acima.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px">
          <button class="btn btn-secondary btn-sm" onclick="videoSubSearchOpen()">${ic('search','ic-sm')}Buscar legenda</button>
          <button class="btn btn-ghost btn-sm" onclick="videoTranscribeFull()" data-tip="Não existe legenda? A IA escuta o episódio inteiro e escreve uma, com os tempos certos (~R$ 1,50 por episódio de 45min)">${ic('sparkles','ic-sm')}Criar com IA</button>
        </div>
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
// Pular alguns segundos (botões no vídeo + Shift+setas)
function videoSkip(d) {
  const p = el('vid-player'); if (!p) return
  p.currentTime = Math.max(0, p.currentTime + d)
}

// ================================================================
// NAVEGAÇÃO POR FALA — "a frase passou, quero voltar NELA":
//   R          → repete a fala atual/última (do início dela)
//   ← / →      → fala anterior / próxima (← no meio de uma fala volta ao
//                início dela; apertando de novo, vai para a anterior —
//                o comportamento de "faixa anterior" dos players)
//   Shift+←/→  → ±5s (o pulo bruto continua disponível)
// ================================================================
// Índice da fala corrente, ou da ÚLTIMA que começou antes de t
function _vidCueIndexAt(t) {
  let idx = -1
  for (let i = 0; i < _vidCues.length; i++) {
    if (_vidCues[i].s <= t + 0.05) idx = i
    else break
  }
  return idx
}

function videoReplayCue() {
  const p = el('vid-player'); if (!p) return
  if (!_vidCues.length) { videoSkip(-5); return }
  const i = _vidCueIndexAt(p.currentTime)
  if (i < 0) { videoSkip(-5); return }
  p.currentTime = Math.max(0, _vidCues[i].s - 0.2)
  p.play()
}

function videoCueNav(dir) {
  const p = el('vid-player'); if (!p) return
  if (!_vidCues.length) { videoSkip(dir * 5); return }
  const t = p.currentTime
  let i = _vidCueIndexAt(t)
  if (dir < 0) {
    if (i < 0) { videoSkip(-5); return }
    // >0,8s dentro da fala = volta ao início DELA; senão, fala anterior
    if (t - _vidCues[i].s <= 0.8) i = Math.max(0, i - 1)
  } else {
    i = Math.min(_vidCues.length - 1, i + 1)
    // Aterrissamos 0,2s ANTES da fala (respiro): se o t atual já está nessa
    // entradinha da fala i, "próxima" tem que ir para a i+1 — senão o botão
    // parece travado.
    if (_vidCues[i].s - t <= 0.6 && i < _vidCues.length - 1) i++
  }
  p.currentTime = Math.max(0, _vidCues[i].s - 0.2)
  p.play()
}

if (!window._vidSkipKeysBound) {
  window._vidSkipKeysBound = true
  document.addEventListener('keydown', e => {
    const ehSeta = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
    const ehR = e.key === 'r' || e.key === 'R'
    if (!ehSeta && !ehR) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const tag = (document.activeElement?.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return
    if (!document.getElementById('section-video')?.classList.contains('active')) return
    if (!el('vid-player')) return
    if (document.activeElement === el('vid-player')) return   // o player nativo já trata
    e.preventDefault()
    if (ehR) videoReplayCue()
    else if (e.shiftKey) videoSkip(e.key === 'ArrowLeft' ? -5 : 5)
    else videoCueNav(e.key === 'ArrowLeft' ? -1 : 1)
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
