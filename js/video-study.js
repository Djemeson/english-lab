// ================================================================
// VÍDEO / ESTUDO — seleção, estudo focado, marcadores em ciclo, card
// com áudio real, "Preparar para assistir", ditado e shadowing.
// Carregado LAZY depois de js/video-sync.js.
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
    if (!aiChatCfg().key) { toast('Sem legenda PT alinhada nem chave de IA configurada', 'warning'); return }
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
  const ptTexto = _vidCues.slice(f.ci, f.cj + 1).map(c => _vidPTof(c))
    .filter((t, i, a) => t && t !== a[i - 1]).join(' ')

  // ---- blocos condicionais ----
  let ditadoHtml = ''
  if (f.dit && !f.dit.res) {
    ditadoHtml = `
      <div class="vid-dit">
        <div class="vid-dit-hint">Ouça o trecho e escreva o que entendeu — sem olhar. Depois eu corrijo.</div>
        <textarea id="vid-dit-ta" rows="2" placeholder="Escreva aqui o que você ouviu...">${esc(f.dit.user || '')}</textarea>
        <button class="btn btn-primary btn-sm" onclick="videoFocusDitadoCheck()">${ic('check','ic-sm')}Corrigir</button>
      </div>`
  } else if (f.dit && f.dit.res) {
    const r = f.dit.res
    ditadoHtml = `
      <div class="vid-dit-res">
        <div class="vid-dit-score">Ditado: <b>${r.pct}%</b> do trecho reconhecido de ouvido</div>
        <div class="vid-dit-marks">${r.ref.map((w, k) =>
          `<span class="vid-word ${r.okRef[k] ? 'dit-ok' : 'dit-bad'}"${r.okRef[k] ? '' : ` onclick="videoDitAddRevisar('${escA(w)}')" data-tip="Não pegou de ouvido — clique para mandar ao Revisar"`}>${esc(w)}</span>`).join(' ')}</div>
        ${r.extras.length ? `<div class="vid-dit-extras">Você escreveu a mais: ${r.extras.map(esc).join(', ')}</div>` : ''}
      </div>`
  }

  let shadowHtml = ''
  if (f.revEN) {
    if (f.sh && f.sh.gravando) {
      shadowHtml = `<div class="vid-sh"><button class="btn btn-danger btn-sm" onclick="videoShadowToggle()">${ic('pause','ic-sm')}Parar gravação</button>
        <span class="vid-sh-hint">Gravando... imite a fala do ator e pare.</span></div>`
    } else if (f.sh && f.sh.url) {
      shadowHtml = `
      <div class="vid-sh">
        <button class="btn btn-ghost btn-sm" onclick="videoShadowPlay()">${ic('play','ic-sm')}Ouvir você</button>
        <button class="btn btn-ghost btn-sm" onclick="videoPlaySel()">${ic('play','ic-sm')}Ouvir a cena</button>
        <button class="btn btn-ghost btn-sm" onclick="videoShadowToggle()">${ic('mic','ic-sm')}Gravar de novo</button>
        ${f.sh.transcrevendo ? `<span class="vid-sh-hint"><span class="gen-spinner"></span> a IA está ouvindo você...</span>` :
          f.sh.res ? `<span class="vid-sh-score">Shadowing: <b>${f.sh.res.pct}%</b> das palavras saíram claras${f.sh.res.pct >= 85 ? ' — mandou bem' : ''}</span>` : ''}
      </div>
      ${f.sh.res && f.sh.res.erradas.length ? `<div class="vid-dit-extras">A IA não reconheceu na sua voz: ${f.sh.res.erradas.map(esc).join(', ')}</div>` : ''}`
    } else {
      shadowHtml = `<div class="vid-sh"><button class="btn btn-ghost btn-sm" onclick="videoShadowToggle()" data-tip="Grave-se imitando a fala; a IA avalia o que saiu claro (centavos por tentativa)">${ic('mic','ic-sm')}Shadowing</button></div>`
    }
  }

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
        ${!f.revEN && !f.dit ? `<button class="btn btn-secondary btn-sm" onclick="videoFocusDitado()" data-tip="Escreva o que ouviu; a correção mostra o que o ouvido perdeu">${ic('pencil','ic-sm')}Ditado</button>` : ''}
        ${!f.revEN ? `<button class="btn btn-secondary btn-sm" onclick="videoFocusRevealEN()">${ic('eye','ic-sm')}Mostrar a fala</button>` : ''}
        ${f.revEN && !f.revPT ? `<button class="btn btn-secondary btn-sm" onclick="videoFocusRevealPT()">${ic('eye','ic-sm')}Mostrar a tradução</button>` : ''}
      </div>
      ${ditadoHtml}
      ${f.revEN ? `
        <div class="vid-sel-words">${words.map((w, i) =>
          `<span class="vid-word${_vidSelWords.has(i) ? ' on' : ''}" onclick="videoToggleWord(${i})">${esc(w)}</span>`).join(' ')}</div>
        ${f.revPT ? `<div class="vid-focus-pt">${esc(ptTexto || '—')}</div>` : ''}
        ${shadowHtml}
        <div class="vid-sel-row2">
          <span class="vid-sel-alvo">${alvo ? `Alvo: <b>${esc(alvo)}</b>` : 'Clique na(s) palavra(s) que quer estudar'}</span>
          <button class="btn btn-primary btn-sm" id="vid-card-btn" ${alvo && !_vidCapturing ? '' : 'disabled'} onclick="videoCreateCard()">
            ${ic('zap','ic-sm')}Salvar no estudo com áudio da cena</button>
        </div>` : (f.dit ? '' : `
        <div class="vid-focus-blind">Ouça sem ler. Entendeu? Tente repetir. Depois revele a fala — ou prove no Ditado.</div>`)}
    </div>`
}

// ================================================================
// DITADO — escreva o que ouviu; a correção compara palavra a palavra
// com a legenda real. Custo ZERO (a resposta certa já está na legenda).
// ================================================================
function _vidTokens(t) {
  return String(t).toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean)
}
// Alinhamento por maior subsequência comum: marca o que casou, lista o
// que faltou (ouvido perdeu) e o que sobrou (inventado).
function _vidTokDiff(refTexto, userTexto) {
  const ref = _vidTokens(refTexto), user = _vidTokens(userTexto)
  const n = ref.length, m = user.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = ref[i] === user[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const okRef = new Array(n).fill(false)
  const okUser = new Array(m).fill(false)
  let i = 0, j = 0
  while (i < n && j < m) {
    if (ref[i] === user[j]) { okRef[i] = true; okUser[j] = true; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return {
    ref, okRef,
    erradas: [...new Set(ref.filter((w, k) => !okRef[k]))],
    extras: [...new Set(user.filter((w, k) => !okUser[k]))],
    pct: n ? Math.round(okRef.filter(Boolean).length / n * 100) : 0
  }
}
function videoFocusDitado() {
  if (!_vidFocus) return
  _vidFocus.dit = { user: '' }
  renderVidSelPanel()
  el('vid-dit-ta')?.focus()
}
function videoFocusDitadoCheck() {
  const f = _vidFocus; if (!f || !f.dit) return
  f.dit.user = el('vid-dit-ta')?.value || ''
  f.dit.res = _vidTokDiff(_vidSelText(), f.dit.user)
  f.revEN = true              // corrigiu = a fala se revela
  renderVidSelPanel()
}
function videoDitAddRevisar(palavra) {
  if (!_vidCur) return
  createWord({ word: palavra, context: _vidSelText(), source_type: _vidCur.source_type || 'series', source_title: _vidCur.title, lang: _vidCur.lang })
  renderDashboard()
  toast(`"${palavra}" enviada para Revisar`, 'success')
}

// ================================================================
// SHADOWING — grave-se imitando a fala; a IA transcreve a SUA voz e
// compara com a legenda: o que ela não reconheceu é o que a boca ainda
// não faz direito. Centavos por tentativa.
// ================================================================
let _vidShRec = null
async function videoShadowToggle() {
  const f = _vidFocus; if (!f) return
  if (f.sh && f.sh.gravando) { try { _vidShRec?.stop() } catch (e) {} ; return }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime })
    const parts = []
    rec.ondataavailable = e => { if (e.data.size) parts.push(e.data) }
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(parts, { type: mime })
      if (f.sh && f.sh.url) URL.revokeObjectURL(f.sh.url)
      f.sh = { url: URL.createObjectURL(blob), blob }
      renderVidSelPanel()
      if (aiSttCfg()) videoShadowScore()
    }
    _vidShRec = rec
    f.sh = { gravando: true }
    renderVidSelPanel()
    rec.start(250)
  } catch (e) { toast('Microfone indisponível: ' + e.message, 'warning') }
}
async function videoShadowScore() {
  const f = _vidFocus; if (!f || !f.sh || !f.sh.blob) return
  f.sh.transcrevendo = true; renderVidSelPanel()
  try {
    const data = await aiTranscribe(f.sh.blob, {
      nome: 'imitacao.webm', granular: false,
      lang: (_vidCur.lang || 'en') === 'en' ? 'en' : undefined
    })
    f.sh.res = _vidTokDiff(_vidSelText(), data.text || '')
  } catch (e) { toast('Não consegui avaliar a gravação: ' + e.message, 'error') }
  f.sh.transcrevendo = false
  renderVidSelPanel()
}
function videoShadowPlay() { const f = _vidFocus; if (f && f.sh && f.sh.url) new Audio(f.sh.url).play() }


// ================================================================
// SINCRONIZAÇÃO DA LEGENDA
// Manual: desloca a legenda inteira em passos de ±0,1s / ±0,5s.
// Automática (IA): grava ~45s do áudio REAL, transcreve com Whisper
// (timestamps por segmento), casa cada segmento transcrito com a fala
// mais parecida da legenda e aplica a MEDIANA dos desvios. Custo:
// ~R$ 0,03 por sincronização. É "a IA escuta e alinha".
// ================================================================
function _vidOvBind() {
  const pop = el('vid-ov-pop')
  if (pop && !pop._bound) {
    pop._bound = true
    pop.addEventListener('mousedown', ev => ev.preventDefault())   // não colapsa a seleção
    document.addEventListener('mousedown', ev => {
      if (!pop.classList.contains('hidden') && !pop.contains(ev.target) && ev.target !== el('vid-ov-en')) pop.classList.add('hidden')
    })
  }
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
    <div class="vid-ov-row">
      <b>"${esc(txt)}"</b>
      <button class="btn btn-secondary btn-sm" onclick="videoOvExplain()" data-tip="Mini-explicação da IA aqui mesmo — sentido na fala, gíria, referência cultural">${ic('sparkles','ic-sm')}Explicar</button>
      <button class="btn btn-primary btn-sm" onclick="videoOvStudy(true)" data-tip="Cria o card já com o áudio real desta cena">${ic('zap','ic-sm')}Estudar com áudio</button>
      <button class="btn btn-ghost btn-sm" onclick="videoOvStudy(false)" data-tip="Manda para a fila do Revisar (a IA analisa lá)">${ic('eye','ic-sm')}Revisar</button>
    </div>`
  pop.classList.remove('hidden')
}

// Explicar ALI MESMO, sobre o vídeo — mesma mecânica do Revisar (34ª rodada):
// clique no popup não colapsa a seleção nem o fecha; cache compartilhado.
async function videoOvExplain() {
  const txt = window._vidOvSelText
  const pop = el('vid-ov-pop')
  if (!txt || !pop) return
  const p = el('vid-player')
  if (p && !p.paused) p.pause()   // vai ler a explicação: congela a cena (e a fala não troca por baixo)
  const i = _vidCueIdx >= 0 ? _vidCueIdx : _vidCueAt(p ? p.currentTime : 0)
  const contexto = (_vidCues[i] && _vidCues[i].t) || ''
  let corpo = pop.querySelector('.sel-pop-exp')
  if (!corpo) { corpo = document.createElement('div'); corpo.className = 'sel-pop-exp'; pop.appendChild(corpo) }
  const chave = 'vid|' + contexto + '|' + txt
  if (typeof _revExplainCache !== 'undefined' && _revExplainCache.has(chave)) { corpo.innerHTML = _revExplainCache.get(chave); return }
  if (!aiChatCfg().key) { toast('Configure uma chave de IA em Configurações', 'warning'); return }
  corpo.innerHTML = '<span class="gen-spinner"></span> a IA está explicando...'
  try {
    const resp = await aiTextSeguro([
      { role: 'system', content: 'Tutor de inglês de um brasileiro. Responda em PT-BR, direto ao ponto, 2 a 4 frases, sem introduções.' },
      { role: 'user', content:
`Na cena de "${_vidCur ? _vidCur.title : ''}", a fala é: "${contexto}". O aluno selecionou: "${txt}".
Explique o que "${txt}" significa AQUI. Se for gíria, marca, referência cultural ou nome próprio, diga o que é no mundo real. Se tiver sentido figurado, explique a imagem.` }
    ], { maxTokens: 600 })   // teto folgado: 220 cortava a resposta no meio (só paga o que gerar)
    // resposta vazia (DeepSeek faz isso às vezes) NÃO pode virar cache — senão
    // a seleção fica muda para sempre; trata como erro e oferece re-tentar
    if (!resp || !resp.trim()) throw new Error('a IA devolveu uma resposta vazia')
    const html = esc(resp).replace(/\n+/g, '<br>')
    if (typeof _revExplainCache !== 'undefined') _revExplainCache.set(chave, html)
    corpo.innerHTML = html
  } catch (e) {
    // erro DENTRO do popup (um toast some antes de o aluno entender o que houve)
    corpo.innerHTML = `<span style="color:var(--error)">Não deu: ${esc(e.message)} — clique em Explicar para tentar de novo.</span>`
  }
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
