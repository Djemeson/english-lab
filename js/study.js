// ================================================================
// SRS SECTION RENDERING
// ================================================================
// srsSession é declarado em srs.js (não-lazy); aqui apenas o usamos/atribuímos.

function renderSrsSection() {
  loadSrs()
  updateSrsBadge()

  const due = srsDueCount()
  const newRem = srsNewTodayRemaining()   // novos que ainda faltam hoje (min(newPerDay − vistos, estoque))
  const streak = srsStreak()

  el('srs-due-count').textContent = due
  el('srs-new-count').textContent = newRem
  el('srs-streak').textContent = streak

  renderDeckStatsTable()

  const startArea = el('srs-start-area')
  const total = due + newRem

  if (srsCards.length === 0) {
    startArea.innerHTML = `
    <div class="srs-empty">
      ${ic('book','ic-xl')}
      <p style="font-size:var(--fs-base);font-weight:600;margin-bottom:8px">Nenhum card ainda</p>
      <p style="font-size:var(--fs-md);margin-bottom:20px">Revise suas palavras e clique em <strong>"Salvar para estudo"</strong></p>
      <button class="btn btn-primary" onclick="showSection('revisar')">${ic('arrowRight')}Ir para Revisar</button>
    </div>`
  } else if (total === 0) {
    startArea.innerHTML = `
    <div class="srs-empty">
      ${ic('checkCircle','ic-xl')}
      <p style="font-size:var(--fs-base);font-weight:600;margin-bottom:8px">Fila zerada!</p>
      <p style="font-size:var(--fs-md);color:var(--text2)">Volte amanhã — o algoritmo já agendou a próxima revisão.</p>
    </div>`
  } else {
    startArea.innerHTML = `
    <div style="text-align:center;padding:24px 0">
      <p style="color:var(--text2);margin-bottom:16px;font-size:var(--fs-base)">
        ${due > 0 ? `<strong style="color:var(--success)">${due}</strong> para revisar` : ''}
        ${due > 0 && newRem > 0 ? ' · ' : ''}
        ${newRem > 0 ? `<strong style="color:var(--primary)">${newRem}</strong> novos` : ''}
      </p>
      <button class="btn btn-primary btn-lg" onclick="startSrsSession()">
        ${ic('play')}Começar sessão
      </button>
    </div>`
  }
}

let _focusDeckId = null

function showDeckFocus(deckId) {
  // Toggle: clicar no mesmo deck fecha o painel
  if (_focusDeckId === deckId) {
    _focusDeckId = null
    renderDeckStatsTable()
    return
  }
  _focusDeckId = deckId
  renderDeckStatsTable()
}

function renderDeckStatsTable() {
  const area = el('srs-deck-stats'); if (!area) return
  if (!srsCards.length) { area.innerHTML = ''; return }

  const now = nowTs()
  const tomorrow = now + 864e5

  function countForDeck(deckId) {
    const ids = [deckId, ...getAllDescendantIds(deckId)]
    const cards = srsCards.filter(c => ids.includes(c.deckId))
    const novo     = cards.filter(c => c.state === 'new').length
    const aprender = cards.filter(c => c.state === 'learning' || c.state === 'relearning').length
    const revisar  = cards.filter(c => c.state === 'review' && c.due <= now).length
    const amanha   = cards.filter(c =>
      (c.state === 'review' || c.state === 'relearning' || c.state === 'learning') &&
      c.due > now && c.due <= tomorrow
    ).length
    return { novo, aprender, revisar, amanha, total: cards.length }
  }

  function numCell(n, cls, type, deckId) {
    if (n > 0 && type) {
      return `<td class="${cls} sdt-clickable" onclick="event.stopPropagation();openLibraryFiltered('${type}','${deckId}')" title="Abrir na biblioteca">${n}</td>`
    }
    return n > 0 ? `<td class="${cls}">${n}</td>` : `<td class="sdt-zero">0</td>`
  }

  function deckRows(deckId, depth) {
    const deck = getDeckById(deckId); if (!deck) return ''
    const counts = countForDeck(deckId)
    if (counts.total === 0 && depth > 0) return ''
    const indent = depth * 18
    const isSelected = _focusDeckId === deckId
    let rows = `<tr class="deck-row-clickable${isSelected ? ' deck-row-selected' : ''}"
      onclick="showDeckFocus('${deckId}')">
      <td class="sdt-name${depth===0?' root':''}" style="--indent:${indent}px">${esc(deck.name)}</td>
      ${numCell(counts.novo,     'sdt-new',    'new',      deckId)}
      ${numCell(counts.aprender, 'sdt-learn',  'learning', deckId)}
      ${numCell(counts.revisar,  'sdt-review', 'due',      deckId)}
      ${numCell(counts.amanha,   'sdt-zero')}
    </tr>`
    for (const child of getDeckChildren(deckId)) rows += deckRows(child.id, depth + 1)
    return rows
  }

  const roots = getRootDecks()
  if (!roots.length) { area.innerHTML = ''; return }

  const tableRows = roots.map(d => deckRows(d.id, 0)).join('')

  // Painel de foco (se houver deck selecionado)
  let focusPanel = ''
  if (_focusDeckId) {
    const deck = getDeckById(_focusDeckId)
    if (deck) {
      const counts = countForDeck(_focusDeckId)
      const path = getSrsDeckPath(_focusDeckId)
      const queueSize = buildSessionQueue(_focusDeckId).length
      const hasCards = queueSize > 0
      focusPanel = `
      <div class="deck-focus-panel">
        <div class="deck-focus-title">${ic('layers')} ${esc(path)}</div>
        <div class="deck-focus-stats">
          <div class="dfs-item"><span class="dfs-value sdt-new">${counts.novo}</span><span class="dfs-label">Novo</span></div>
          <div class="dfs-item"><span class="dfs-value sdt-learn">${counts.aprender}</span><span class="dfs-label">Aprender</span></div>
          <div class="dfs-item"><span class="dfs-value sdt-review">${counts.revisar}</span><span class="dfs-label">Revisar</span></div>
          <div class="dfs-item"><span class="dfs-value" style="color:var(--text2)">${counts.amanha}</span><span class="dfs-label">Amanhã</span></div>
        </div>
        ${hasCards
          ? `<button class="btn btn-primary btn-sm" onclick="startSrsSession('${_focusDeckId}')">${ic('play')}Estudar agora (${queueSize} cards)</button>`
          : `<p style="color:var(--text3);font-size:var(--fs-md);margin:0">Nenhum card para estudar agora neste baralho.</p>`
        }
      </div>`
    }
  }

  area.innerHTML = `
  <div class="srs-deck-table-wrap panel-group" style="margin-top:14px">
    <div class="panel-eyebrow">Baralhos</div>
    <table class="srs-deck-table">
      <thead>
        <tr>
          <th>Baralho</th>
          <th>Novo</th>
          <th>Aprender</th>
          <th>Revisar</th>
          <th>Amanhã</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    ${focusPanel}
  </div>`
}

// ---- Browser state ----
let _activeBrowserDeck = null
let _browserSort = { col: 'state', dir: 1 }
let _browserSelected = new Set()
let _browserCurrentCards = []
// Cache de quais chaves de áudio existem no IndexedDB
let _audioKeyCache = null
async function refreshAudioKeyCache() {
  const all = await AudioDB.getAll()
  _audioKeyCache = new Set(Object.keys(all))
}


// ================================================================
// SRS SESSION
// ================================================================
function buildSessionQueue(filterDeckId = null) {
  loadSrs()
  const now = nowTs()
  const today = todayStr()

  // Filtro por deck: inclui descendentes
  const deckIds = filterDeckId ? [filterDeckId, ...getAllDescendantIds(filterDeckId)] : null
  const inDeck = c => !deckIds || deckIds.includes(c.deckId)

  // 1. Due reviews (review + relearning)
  let reviews = srsCards.filter(c => inDeck(c) && c.due <= now && (c.state === 'review' || c.state === 'relearning'))
  reviews = reviews.slice(0, srsCfg.revPerDay)

  // 2. Due learning steps
  const learning = srsCards.filter(c => inDeck(c) && c.due <= now && c.state === 'learning')

  // 3. New cards (respecting daily limit)
  const todayLog = srsLog.find(l => l.date === today)
  const newSeen = todayLog ? (todayLog.newSeen || 0) : 0
  const newLimit = Math.max(0, srsCfg.newPerDay - newSeen)
  const newCards = srsCards.filter(c => inDeck(c) && c.state === 'new').slice(0, newLimit)

  return [...reviews, ...learning, ...newCards]
}

function startSrsSession(filterDeckId = null) {
  loadSrs()
  const queue = buildSessionQueue(filterDeckId)
  if (!queue.length) { toast('Nada para estudar agora!', 'info'); return }

  srsSession = {
    queue: queue.map(c => c.id),
    current: 0,
    total: queue.length,
    done: 0,
    correct: 0,
    newSeen: 0,
    startTime: Date.now(),
    history: []  // [{cardId, rating, ratingLabel, prevState}]
  }

  el('srs-view-dashboard').classList.add('hidden')
  el('srs-view-session').classList.remove('hidden')

  _histNavIdx = null
  renderHistoryNav()
  renderSrsCard()
}

async function renderSrsCard() {
  if (!srsSession) return
  const { queue, current, done, total } = srsSession
  if (current >= queue.length) { finishSrsSession(); return }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  el('srs-progress-bar').style.width = pct + '%'
  updateSrsSessionCounter()

  const cardId = queue[current]
  const card = srsCards.find(c => c.id === cardId)
  if (!card) { srsSession.current++; renderSrsCard(); return }

  window._srsCurrentCard = card
  const frente = buildSrsFrente(card)
  // Use async verso to load image from IndexedDB
  const verso = await buildSrsVersoAsync(card)
  _pendingMines = []  // limpa seleções ao mudar de card
  document.getElementById('srs-mine-sel-chip')?.remove()
  // Play full EN sentence via OpenAI TTS when card front is shown
  const audioText = card.example_en || card.word || ''
  if (audioText) playSrsTTS(audioText)

  const ratingBtns = [
    { cls: 'again', label: 'Errei',   r: 1 },
    { cls: 'hard',  label: 'Difícil', r: 2 },
    { cls: 'good',  label: 'Bom',     r: 3 },
    { cls: 'easy',  label: 'Fácil',   r: 4 }
  ].map(b => `
    <button class="srs-rate-btn ${b.cls}" onclick="rateSrsCardAndNext('${card.id}',${b.r})" style="position:relative;">
      <span class="srb-key">${b.r}</span>
      <span class="srb-label">${b.label}</span>
      <span class="srb-interval">${previewInterval(card, b.r)}</span>
    </button>`).join('')

  el('srs-card-area').innerHTML = `
  <div class="srs-flip-card" id="srs-flip" onclick="flipSrsCard()">
    <div class="srs-flip-inner">
      <div class="srs-card-face srs-card-front">
        <div class="srs-card-front-word">${esc(card.word)}</div>
        ${frente ? `<div class="srs-card-front-sentence srs-mine-sentence" id="srs-mine-front" onmouseup="srsCaptureSelection(event)">${frente}</div>` : ''}
        ${buildMetaChips(card)}
        <div style="display:flex;align-items:center;gap:12px;margin-top:14px">
          <div class="srs-card-front-hint">Clique para revelar · <span style="color:var(--text3);font-size:0.8em">selecione texto para adicionar à revisão</span></div>
          <button class="btn btn-ghost btn-sm" style="padding:4px 10px;font-size:var(--fs-sm)"
            onclick="event.stopPropagation();playSrsTTS(window._srsCurrentCard?.example_en||window._srsCurrentCard?.word||'')">
            ${ic('volume','ic-sm')} Repetir <span class="srb-key-inline" style="margin-left:4px">R</span>
          </button>
        </div>
      </div>
      <div class="srs-card-face srs-card-back${verso.includes('data-has-image') ? ' has-image' : ''}">
        <div class="srs-card-back-body">${verso}</div>
      </div>
    </div>
  </div>
  <div class="srs-rate-buttons hidden" id="srs-rating-area">
    ${ratingBtns}
  </div>
  <div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:14px">
    <div style="display:flex;align-items:center;gap:10px;font-size:var(--fs-sm)">
      <span style="display:flex;flex-direction:column;align-items:center;gap:1px">
        <span id="srs-cnt-new" style="color:var(--primary);font-weight:700;font-size:var(--fs-base)">0</span>
        <span style="color:var(--text3);font-size:var(--fs-3xs);text-transform:uppercase;letter-spacing:.04em">novo</span>
      </span>
      <span style="color:var(--text3)">+</span>
      <span style="display:flex;flex-direction:column;align-items:center;gap:1px">
        <span id="srs-cnt-learn" style="color:var(--error);font-weight:700;font-size:var(--fs-base)">0</span>
        <span style="color:var(--text3);font-size:var(--fs-3xs);text-transform:uppercase;letter-spacing:.04em">aprender</span>
      </span>
      <span style="color:var(--text3)">+</span>
      <span style="display:flex;flex-direction:column;align-items:center;gap:1px">
        <span id="srs-cnt-rev" style="color:var(--success);font-weight:700;font-size:var(--fs-base)">0</span>
        <span style="color:var(--text3);font-size:var(--fs-3xs);text-transform:uppercase;letter-spacing:.04em">revisar</span>
      </span>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="flipSrsCard()">
      <span id="srs-flip-hint">${ic('eye','ic-sm')} Revelar resposta <kbd class="srb-key-inline">Espaço</kbd></span>
    </button>
  </div>`
  updateSrsSessionCounter()
}

let _pendingMines = []   // array de seleções — suporta múltiplas
let _lastMineTime  = 0   // timestamp da última seleção (evita flip acidental)

// Chamado pelo mouseup na frase do card — captura e realça a seleção
function srsCaptureSelection(e) {
  e.stopPropagation()
  const sel = window.getSelection()
  if (!sel || !sel.toString().trim()) return
  const raw = sel.toString().trim().replace(/[.,!?;:"""''()\[\]<>]/g, '').trim()
  if (!raw || raw.length < 2) return
  sel.removeAllRanges()

  // Ignora duplicatas
  if (_pendingMines.map(s => s.toLowerCase()).includes(raw.toLowerCase())) return
  _pendingMines.push(raw)
  _lastMineTime = Date.now()

  // Atualizar chips
  renderMineChips()
}

function renderMineChips() {
  const sentEl = document.getElementById('srs-mine-front')
  if (!sentEl) return
  let row = document.getElementById('srs-mine-sel-chip')
  if (!row) {
    row = document.createElement('div')
    row.id = 'srs-mine-sel-chip'
    row.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:8px'
    sentEl.after(row)
  }
  row.innerHTML = _pendingMines.map((txt, i) =>
    `<span class="srs-mine-selected">${ic('target','ic-sm')} ${esc(txt)}
      <button onclick="event.stopPropagation();srsClearMine(${i})" title="Remover">×</button>
    </span>`
  ).join('')
  if (!_pendingMines.length) row.remove()
}

function srsClearMine(idx) {
  _lastMineTime = Date.now()  // impede flip acidental ao clicar ×
  _pendingMines.splice(idx, 1)
  renderMineChips()
}

function flipSrsCard() {
  // Não vira se uma seleção acabou de ser feita (mouseup → click são sequenciais)
  if (Date.now() - _lastMineTime < 300) return
  const flip = el('srs-flip')
  const rating = el('srs-rating-area')
  const hint = el('srs-flip-hint')
  if (!flip) return
  const isFlipped = flip.classList.toggle('flipped')
  if (rating) rating.classList.toggle('hidden', !isFlipped)
  if (hint) hint.innerHTML = (isFlipped ? ic('undo','ic-sm') + ' Ver frente' : ic('eye','ic-sm') + ' Revelar resposta') + ' <kbd class="srb-key-inline">Espaço</kbd>'
}

// Atalhos de teclado robustos para estudo
document.addEventListener('keydown', e => {
  if (!srsSession) return
  // Evita acionar quando está digitando em inputs
  if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return

  const flip = el('srs-flip')
  if (!flip) return
  const isFlipped = flip.classList.contains('flipped')

  // Espaço ou Enter: Revelar ou classificar como Bom (3)
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault()
    if (!isFlipped) {
      flipSrsCard()
    } else {
      const card = window._srsCurrentCard
      if (card) rateSrsCardAndNext(card.id, 3)
    }
    return
  }

  // Teclas de número 1, 2, 3, 4
  const numKeyMap = { 'Digit1': 1, 'Numpad1': 1, '1': 1,
                      'Digit2': 2, 'Numpad2': 2, '2': 2,
                      'Digit3': 3, 'Numpad3': 3, '3': 3,
                      'Digit4': 4, 'Numpad4': 4, '4': 4 }
  
  const rating = numKeyMap[e.code] || numKeyMap[e.key]
  if (rating) {
    e.preventDefault()
    if (!isFlipped) {
      // Se não estiver virado, primeiro revela o card
      flipSrsCard()
    } else {
      const card = window._srsCurrentCard
      if (card) rateSrsCardAndNext(card.id, rating)
    }
    return
  }

  // Desfazer: Z ou Backspace ou Ctrl+Z
  if (e.code === 'Backspace' || e.key === 'z' || e.key === 'Z') {
    e.preventDefault()
    undoLastCard()
    return
  }

  // Repetir Áudio: R ou S (de Speak)
  if (e.key === 'r' || e.key === 'R' || e.key === 's' || e.key === 'S') {
    e.preventDefault()
    const card = window._srsCurrentCard
    if (card) playSrsTTS(card.example_en || card.word || '')
    return
  }
})

// Re-renderiza apenas o back do card em revisão (sem resetar o flip)
async function renderSrsCardBack() {
  const card = window._srsCurrentCard; if (!card) return
  const verso = await buildSrsVersoAsync(card)
  const body = document.querySelector('.srs-card-back-body'); if (!body) return
  body.innerHTML = verso
  // Atualiza classe has-image no face do card
  const backFace = body.closest('.srs-card-back')
  if (backFace) backFace.classList.toggle('has-image', verso.includes('data-has-image'))
}

function rateSrsCardAndNext(cardId, rating) {
  const card = srsCards.find(c => c.id === cardId)
  if (!card) return
  const wasNew = card.state === 'new'

  // Snapshot do estado ANTES de avaliar (para undo)
  const prevState = JSON.parse(JSON.stringify(card))
  const ratingLabels = {1:'again',2:'hard',3:'good',4:'easy'}

  // Processar todas as seleções mineradas (pode ser mais de uma)
  if (_pendingMines.length) {
    const added = []
    _pendingMines.forEach(rawSel => {
      const raw = rawSel.replace(/[.,!?;:"""''()\[\]<>]/g, '').trim().toLowerCase()
      if (raw && raw !== (card.word || '').toLowerCase() && raw.length > 1) {
        createWord({ word: raw, context: card.example_en || '', source_type: card.source_type || 'series', source_title: card.source_title || '' })
        added.push(raw)
      }
    })
    if (added.length) {
      saveWords()
      toast(`${added.length > 1 ? added.length + ' itens adicionados' : `"${added[0]}" adicionado`} à revisão`, 'success')
    }
    _pendingMines = []
    window.getSelection()?.removeAllRanges()
  }

  rateSrsCard(cardId, rating)
  const cardAfter = srsCards.find(c => c.id === cardId)

  if (srsSession) {
    srsSession.history.push({ cardId, rating, ratingLabel: ratingLabels[rating], prevState, wasNew })
    srsSession.done++
    if (wasNew) srsSession.newSeen++
    if (rating >= 3) srsSession.correct++
    srsSession.current++
    _logRevisao(+1, wasNew, rating >= 3)   // grava JÁ no dia (ver comentário em _logRevisao)

    // Requeue: se o card ficou em 'learning'/'relearning', adiciona no final da fila
    // para reaparecer ainda nesta sessão (como o Anki faz)
    const staysInSession = cardAfter && (cardAfter.state === 'learning' || cardAfter.state === 'relearning')
    if (staysInSession) {
      srsSession.queue.push(cardId)
      srsSession.total++
    }
  }

  updateSrsBadge()
  updateSrsSessionCounter()
  _histNavIdx = null
  renderHistoryNav()
  renderSrsCard()
}

// ================================================================
// I+1 WORD MINING — seleção real de texto durante o estudo
// A captura acontece em rateSrsCardAndNext() ao avançar o card

function updateSrsSessionCounter() {
  if (!srsSession) return
  const { queue, current } = srsSession
  const remaining = queue.slice(current)
  let cntNew = 0, cntLearn = 0, cntRev = 0
  remaining.forEach(id => {
    const c = srsCards.find(x => x.id === id)
    if (!c) return
    if (c.state === 'new') cntNew++
    else if (c.state === 'learning' || c.state === 'relearning') cntLearn++
    else if (c.state === 'review') cntRev++
  })
  const n = el('srs-cnt-new');   if (n) n.textContent = cntNew
  const l = el('srs-cnt-learn'); if (l) l.textContent = cntLearn
  const r = el('srs-cnt-rev');   if (r) r.textContent = cntRev

  // Sublinhado no contador do card atual (como o Anki faz)
  const curState = window._srsCurrentCard?.state
  const isNew   = curState === 'new'
  const isLearn = curState === 'learning' || curState === 'relearning'
  const isRev   = curState === 'review'
  const ul = '2px solid currentColor'
  if (n) n.style.borderBottom = isNew   ? ul : 'none'
  if (l) l.style.borderBottom = isLearn ? ul : 'none'
  if (r) r.style.borderBottom = isRev   ? ul : 'none'
  if (n) n.style.paddingBottom = '2px'
  if (l) l.style.paddingBottom = '2px'
  if (r) r.style.paddingBottom = '2px'
}

let _histNavIdx = null  // null = current card; number = index in history

function renderHistoryNav() {
  const nav  = el('srs-history-nav'); if (!srsSession) return
  const prev = el('srs-hist-prev')
  const next = el('srs-hist-next')
  const info = el('srs-hist-info')
  const banner = el('srs-hist-banner')
  const undoBtn = el('srs-undo-btn')
  if (undoBtn) undoBtn.disabled = srsSession.history.length === 0

  const hasHistory = srsSession.history.length > 0
  if (nav) nav.style.display = hasHistory ? 'flex' : 'none'
  if (!hasHistory) { _histNavIdx = null; return }

  const isViewing = _histNavIdx !== null
  const idx = isViewing ? _histNavIdx : srsSession.history.length  // virtual "current" position
  if (prev) prev.disabled = idx <= 0
  if (next) next.disabled = !isViewing  // no "next" when already at current
  if (info) info.textContent = isViewing
    ? `${idx + 1} de ${srsSession.history.length} revisados`
    : `${srsSession.history.length} revisado${srsSession.history.length !== 1 ? 's' : ''}`
  if (banner) banner.style.display = isViewing ? 'block' : 'none'

  // Bloquear rating buttons no modo histórico
  const ratingArea = el('srs-rating-area')
  if (ratingArea) ratingArea.classList.toggle('history-mode', isViewing)
}

async function navigateHistory(dir) {
  if (!srsSession) return
  const maxIdx = srsSession.history.length - 1
  if (dir < 0) {
    // Ir para anterior
    if (_histNavIdx === null) _histNavIdx = maxIdx
    else _histNavIdx = Math.max(0, _histNavIdx - 1)
  } else {
    // Ir para próximo / voltar ao atual
    if (_histNavIdx === null) return
    if (_histNavIdx >= maxIdx) { _histNavIdx = null }
    else _histNavIdx++
  }
  await renderHistoryOrCurrent()
}

async function renderHistoryOrCurrent() {
  if (_histNavIdx === null) {
    // Mostrar card atual normalmente
    await renderSrsCard()
    return
  }
  // Mostrar card histórico (direto no verso, bloqueado)
  const entry = srsSession.history[_histNavIdx]
  if (!entry) return
  const card = srsCards.find(c => c.id === entry.cardId) || entry.prevState
  if (!card) return
  window._srsCurrentCard = card
  const frente = buildSrsFrente(card)
  const verso = await buildSrsVersoAsync(card)
  const ratingBtns = [
    { cls: 'again', label: 'Errei',   r: 1 },
    { cls: 'hard',  label: 'Difícil', r: 2 },
    { cls: 'good',  label: 'Bom',     r: 3 },
    { cls: 'easy',  label: 'Fácil',   r: 4 }
  ].map(b => `<button class="srs-rate-btn ${b.cls}" disabled style="opacity:.35;cursor:default">
    <span class="srb-label">${b.label}</span></button>`).join('')

  el('srs-card-area').innerHTML = `
  <div class="srs-flip-card flipped" id="srs-flip" style="cursor:default">
    <div class="srs-flip-inner">
      <div class="srs-card-face srs-card-front" style="display:none">${frente}</div>
      <div class="srs-card-face srs-card-back${verso.includes('data-has-image') ? ' has-image' : ''}" style="display:flex;animation:none">
        <div class="srs-card-back-body">${verso}</div>
      </div>
    </div>
  </div>
  <div class="srs-rate-buttons history-mode" id="srs-rating-area" style="display:flex">
    ${ratingBtns}
  </div>
  <div style="text-align:center;margin-top:12px">
    <span style="font-size:var(--fs-sm);color:var(--text3)">avaliado como
      <strong style="color:${{1:'#F87171',2:'var(--warning)',3:'var(--success)',4:'var(--primary)'}[entry.rating]}">${{1:'Errei',2:'Difícil',3:'Bom',4:'Fácil'}[entry.rating]}</strong>
    </span>
  </div>`

  renderHistoryNav()
}

async function undoLastCard() {
  if (!srsSession || !srsSession.history.length) return
  const last = srsSession.history.pop()

  // Restaurar estado do card
  const idx = srsCards.findIndex(c => c.id === last.cardId)
  if (idx !== -1) srsCards[idx] = last.prevState

  // Reverter contadores da sessão
  srsSession.done = Math.max(0, srsSession.done - 1)
  if (last.wasNew) srsSession.newSeen = Math.max(0, srsSession.newSeen - 1)
  if (last.rating >= 3) srsSession.correct = Math.max(0, srsSession.correct - 1)
  srsSession.current = Math.max(0, srsSession.current - 1)
  _logRevisao(-1, last.wasNew, last.rating >= 3)   // desfazer também desconta do dia

  saveSrsCards()
  updateSrsBadge()
  renderHistoryNav()
  await renderSrsCard()
  // Revelar verso automaticamente para o card restaurado
  const flip = el('srs-flip')
  if (flip) {
    flip.classList.add('flipped')
    const rating = el('srs-rating-area'); if (rating) rating.classList.remove('hidden')
    const hint = el('srs-flip-hint'); if (hint) hint.innerHTML = ic('undo','ic-sm') + ' Ver frente <kbd class="srb-key-inline">Espaço</kbd>'
  }
}

// Progresso do dia gravado A CADA CARD, não no fim da sessão. Antes só o
// término natural registrava: encerrar no "X" (ou fechar a aba) jogava fora
// tudo o que já tinha sido revisado — a barra do dia voltava a zero.
// `dir` é +1 ao avaliar e −1 ao desfazer.
function _logRevisao(dir, wasNew, acertou) {
  const today = todayStr()
  let log = srsLog.find(l => l.date === today)
  if (!log) { log = { date: today, reviewed: 0, correct: 0, newSeen: 0 }; srsLog.push(log) }
  log.reviewed = Math.max(0, (log.reviewed || 0) + dir)
  if (acertou) log.correct = Math.max(0, (log.correct || 0) + dir)
  if (wasNew)  log.newSeen = Math.max(0, (log.newSeen || 0) + dir)
  saveSrsLog()
}

function finishSrsSession() {
  _clearSessionBackup()  // sessão finalizada normalmente — remove o backup
  autoSyncAfterChange()

  const done = srsSession ? srsSession.done : 0
  const correct = srsSession ? srsSession.correct : 0
  const pct = done > 0 ? Math.round((correct/done)*100) : 0

  el('srs-card-area').innerHTML = `
  <div class="srs-session-end">
    <div class="srs-end-icon">${ic(pct >= 80 ? 'target' : pct >= 50 ? 'checkCircle' : 'zap')}</div>
    <div class="srs-end-title">${pct >= 80 ? 'Excelente!' : pct >= 50 ? 'Bom trabalho!' : 'Continue praticando!'}</div>
    <div class="srs-end-sub">Sessão concluída</div>
    <div class="srs-end-stats">
      <div class="ses-stat">
        <div class="ses-stat-val" style="color:var(--primary)">${done}</div>
        <div class="ses-stat-lbl">Revisados</div>
      </div>
      <div class="ses-stat">
        <div class="ses-stat-val" style="color:var(--success)">${correct}</div>
        <div class="ses-stat-lbl">Corretos</div>
      </div>
      <div class="ses-stat">
        <div class="ses-stat-val" style="color:var(--warning)">${pct}%</div>
        <div class="ses-stat-lbl">Acerto</div>
      </div>
    </div>
    <button class="btn btn-primary" onclick="endSrsSession()">Ver dashboard</button>
  </div>`

  el('srs-progress-bar').style.width = '100%'
  el('srs-session-counter').textContent = `${done} / ${done}`
}

function endSrsSession() {
  // Encerrar no meio não é "perder a sessão": o que já foi revisado está no
  // log do dia (gravado card a card) — só limpa o backup e sincroniza.
  if (srsSession && srsSession.done) { _clearSessionBackup(); autoSyncAfterChange() }
  srsSession = null
  // Aplica cards que chegaram da nuvem (sync em tempo real) durante a sessão
  if (typeof flushPendingCloudCards === 'function') flushPendingCloudCards()
  el('srs-view-session').classList.add('hidden')
  el('srs-view-dashboard').classList.remove('hidden')
  renderSrsSection()
}

// ---- Card content builders (for study session) ----
// VARIETY_LABELS/REGISTER_LABELS e os renderizadores de chip vivem em js/lang.js
// (não-lazy), porque o glossário da Biblioteca (audio.js) também os usa.

function buildMetaChips(card) {
  let chips = ''
  // Indicador de sentido: só aparece quando a palavra tem mais de um significado
  // em estudo — discreto, sofisticado, com link para o glossário daquele termo.
  const si = senseInfo(card)
  if (si.total > 1) {
    chips += `<span class="srs-sense-chip" data-tip="Sentido ${si.pos} de ${si.total} — esta palavra tem ${si.total} significados em estudo. Clique para ver todos."
      onclick="event.stopPropagation();openWordGlossary('${card.wordId}')">${ic('layers','ic-sm')}<span class="ssc-num">${si.pos}</span><span class="ssc-sep">/</span><span class="ssc-tot">${si.total}</span></span>`
  }
  // Chip de idioma (só quando não é inglês)
  chips += langChip(cardLang(card))
  // Um caminho só para qualquer idioma — antes o inglês tinha bandeiras e os
  // demais caíam num fallback genérico com globo.
  chips += varietyChip(card.variety, cardLang(card))
  chips += registerChip(card.register)
  if (card.leech) chips += `<span class="srs-leech-chip" title="Sanguessuga: muitas falhas neste card">leech</span>`
  return chips ? `<div class="srs-meta-chips">${chips}</div>` : ''
}

// buildSrsFrente foi movida para js/core.js (não-lazy) — ver comentário lá.

// Async version checks ImageDB; sync version used for browser preview (no image check)
async function buildSrsVersoAsync(card) {
  const img = await ImageDB.get(imageKey(card))
  return buildSrsVerso(card, img)
}
function buildSrsVerso(card, imgData, imageBelow) {
  const _cl = cardLang(card)
  const TYPE = {
    word: 'vocabulário',
    phrasal_verb: typeLabel('phrasal_verb', _cl, card.type_label),
    idiom: typeLabel('idiom', _cl, card.type === 'idiom' ? card.type_label : ''),
    collocation: 'collocation'
  }
  const strip = s => String(s||'').replace(/<[^>]*>/g,'')

  // Coluna de texto (sempre presente)
  let text = ''
  // 1. Frase EN no topo
  if (card.example_en) {
    text += `<div class="srs-back-example">"${buildSrsFrente(card)}"</div>`
    text += `<div style="display:flex;align-items:center;gap:6px;margin:4px 0 10px">
      <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();playSrsTTS(window._srsCurrentCard?.example_en||window._srsCurrentCard?.word||'')">${ic('volume','ic-sm')} Repetir frase</button>
      <button class="btn btn-ghost btn-sm" title="Gerar nova frase que reflita melhor a definição" style="opacity:0.45;padding:4px 7px;font-size:var(--fs-sm)"
        onclick="event.stopPropagation();regenerateCardExample('${card.id}',this)">${ic('refresh','ic-sm')}</button>
      ${card.clipId ? `<button class="btn btn-ghost btn-sm" title="Rever a cena de origem (no aparelho que tem o vídeo)"
        onclick="event.stopPropagation();reverCena('${card.clipId}')">${ic('film','ic-sm')} Rever a cena</button>` : ''}
    </div>`
  }
  // 2. Tradução PT da frase logo abaixo (preserva o <b> do termo, se houver)
  if (card.example_pt) text += `<div class="srs-back-translation">"${escB(card.example_pt)}"</div>`
  // 3. Palavra + IPA + áudio + tipo
  text += `<div class="srs-back-word" style="margin-top:${card.example_en||card.example_pt?'14px':'0'}">${esc(card.word)}</div>`
  if (card.ipa) text += `<div class="srs-back-ipa">${esc(card.ipa)}</div>`
  text += `<button class="btn btn-ghost btn-sm" style="margin:4px 0 10px" onclick="event.stopPropagation();playSrsTTS(window._srsCurrentCard?.word||'')">${ic('volume','ic-sm')} Pronúncia</button>`
  // Type + variety + register chips na mesma linha
  let metaRow = ''
  if (card.type && TYPE[card.type]) metaRow += `<span class="srs-back-type-chip">${TYPE[card.type]}</span>`
  const metaChips = buildMetaChips(card)
  if (metaChips) metaRow += metaChips
  if (metaRow) text += `<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-bottom:12px">${metaRow}</div>`
  // 4. Significado + definição
  text += `<div class="srs-back-meaning">${esc(strip(card.meaning_pt))}</div>`
  if (card.definition_pt) text += `<div class="srs-back-def">${esc(strip(card.definition_pt))}</div>`
  // 4b. Origem / história da expressão (só quando existe)
  if (card.origin_pt) text += `<div class="srs-back-origin" style="margin-top:10px;padding:9px 12px;border-radius:var(--radius-sm);background:rgba(var(--primary-rgb),.07);border-left:3px solid rgba(var(--primary-rgb),.5);font-size:var(--fs-md);line-height:1.45;color:var(--text2)"><span style="display:inline-flex;align-items:center;gap:5px;font-weight:600;color:var(--text);font-size:var(--fs-sm);margin-bottom:3px">${ic('sparkles','ic-sm')} Origem</span><div>${esc(strip(card.origin_pt))}</div></div>`
  // Footer + configurações (sempre na coluna de texto)
  const SRC = {series:'série', movie:'filme', youtube:'YouTube', kindle:'Kindle', podcast:'podcast', website:'site', manual:'manual'}
  const deckLabel = card.deckId ? getSrsDeckPath(card.deckId) : ''
  text += `<div class="srs-back-footer">${esc(SRC[card.source_type]||card.source_type||'')}${deckLabel ? ' · ' + esc(deckLabel) : ''}</div>`
  text += `<details class="srs-card-settings" onclick="event.stopPropagation()">
    <summary>${ic('pencil','ic-sm')} Editar card</summary>
    <div class="srs-card-settings-body" style="flex-direction:column;gap:10px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <label style="font-size:var(--fs-xs);color:var(--text3);min-width:70px">Variedade</label>
        <select style="font-size:var(--fs-sm);padding:3px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)"
          onchange="event.stopPropagation();updateCardMeta('${card.id}','variety',this.value)">
          ${getLangDef(_cl).varieties.map(x => `<option value="${x.v}" ${((card.variety || 'general') === x.v) ? 'selected' : ''}>${x.v === 'general' ? 'Geral (todas as variedades)' : esc(x.label)}</option>`).join('')}
          <option value="other" ${card.variety==='other'?'selected':''}>Outra</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <label style="font-size:var(--fs-xs);color:var(--text3);min-width:70px">Registro</label>
        <select style="font-size:var(--fs-sm);padding:3px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)"
          onchange="event.stopPropagation();updateCardMeta('${card.id}','register',this.value)">
          <option value="neutral" ${(!card.register||card.register==='neutral')?'selected':''}>Neutro / padrão</option>
          <option value="informal" ${card.register==='informal'?'selected':''}>Informal</option>
          <option value="colloquial" ${card.register==='colloquial'?'selected':''}>Coloquial</option>
          <option value="slang" ${card.register==='slang'?'selected':''}>Gíria (slang)</option>
          <option value="formal" ${card.register==='formal'?'selected':''}>Formal</option>
          <option value="technical" ${card.register==='technical'?'selected':''}>Técnico</option>
          <option value="literary" ${card.register==='literary'?'selected':''}>Literário</option>
          <option value="archaic" ${card.register==='archaic'?'selected':''}>Arcaico</option>
          <option value="vulgar" ${card.register==='vulgar'?'selected':''}>Vulgar</option>
        </select>
      </div>
      <button class="btn btn-ghost btn-sm" style="font-size:var(--fs-sm)"
        id="img-gen-btn-${card.id}"
        onclick="event.stopPropagation();generateCardImage('${card.id}',this)">
        ${ic('palette','ic-sm')} ${imgData ? 'Regenerar imagem' : 'Gerar imagem'}
      </button>
    </div>
  </details>`

  // Imagem dentro do card: grid texto|imagem. Sem imagem: só texto.
  // Preview da biblioteca (imageBelow): imagem como faixa abaixo do texto — não espreme o texto.
  if (imgData && imageBelow) {
    return `${text}<img class="srs-verso-image-below" src="${imgData}" alt="${esc(card.word)}">`
  }
  // Sessão de estudo: grid texto|imagem (lado a lado em telas largas; empilha no mobile via CSS).
  if (imgData) {
    return `<div class="srs-back-with-image" data-has-image="1">
      <div class="srs-back-text-col">${text}</div>
      <div class="srs-back-image-col">
        <img src="${imgData}" alt="${esc(card.word)}">
      </div>
    </div>`
  }
  // Sem imagem: o card pode ser largo, mas o texto fica centrado em medida legível
  return `<div class="srs-back-text-solo">${text}</div>`
}

// ---- SRS Config Modal ----
function showSrsCfgModal() {
  loadSrs()
  _fillSrsCfgForm(srsCfg)
  el('srs-cfg-modal').classList.remove('hidden')
  el('srs-cfg-modal').style.display = 'flex'
}
function _fillSrsCfgForm(c) {
  el('srs-cfg-new-day').value   = c.newPerDay ?? 20
  el('srs-cfg-rev-day').value   = c.revPerDay ?? 200
  el('srs-cfg-steps').value     = (c.steps || [1,10]).join(' ')
  el('srs-cfg-grad-int').value  = c.graduateInterval ?? 1
  el('srs-cfg-easy-int').value  = c.easyInterval ?? c.graduateEasyInterval ?? 4
  el('srs-cfg-relearn').value   = (c.relearnSteps || [1,5,10]).join(' ')
  el('srs-cfg-lapse-int').value = c.lapseNewInterval ?? 0
  el('srs-cfg-min-int').value   = c.minInterval ?? 1
  el('srs-cfg-leech').value     = c.leechThreshold ?? 50
  el('srs-cfg-ease').value      = c.easeStart ?? 2.5
  el('srs-cfg-easy-bonus').value= c.easyBonus ?? 1.3
  el('srs-cfg-hard-int').value  = c.hardInterval ?? 1.2
  el('srs-cfg-int-mod').value   = c.intervalModifier ?? 1.0
  el('srs-cfg-max-int').value   = c.maxInterval ?? 36500
}
function hideSrsCfgModal() {
  el('srs-cfg-modal').classList.add('hidden')
  el('srs-cfg-modal').style.display = ''
}
// Preenche o formulário com o preset padrão do Anki (não salva — o usuário revisa e Salva)
function applyAnkiPreset() {
  _fillSrsCfgForm({
    newPerDay: 999, revPerDay: 9999, steps: [1,10], graduateInterval: 1, easyInterval: 4,
    relearnSteps: [1,5,10], lapseNewInterval: 0, minInterval: 1, leechThreshold: 50,
    easeStart: 2.5, easyBonus: 1.3, hardInterval: 1.2, intervalModifier: 1.0, maxInterval: 36500
  })
  toast('Preset do Anki carregado — clique em Salvar para aplicar', 'info')
}
function _parseSteps(str, fallback) {
  const arr = (str || '').split(/\s+/).map(Number).filter(n => n > 0)
  return arr.length ? arr : fallback
}
function saveSrsCfg() {
  loadSrs()
  srsCfg.newPerDay        = parseInt(el('srs-cfg-new-day').value) || 0
  srsCfg.revPerDay        = parseInt(el('srs-cfg-rev-day').value) || 0
  srsCfg.steps            = _parseSteps(el('srs-cfg-steps').value, [1,10])
  srsCfg.graduateInterval = parseInt(el('srs-cfg-grad-int').value) || 1
  srsCfg.easyInterval     = parseInt(el('srs-cfg-easy-int').value) || 4
  srsCfg.relearnSteps     = _parseSteps(el('srs-cfg-relearn').value, [1,5,10])
  srsCfg.lapseNewInterval = Math.max(0, Math.min(1, parseFloat(el('srs-cfg-lapse-int').value) || 0))
  srsCfg.minInterval      = parseInt(el('srs-cfg-min-int').value) || 1
  srsCfg.leechThreshold   = parseInt(el('srs-cfg-leech').value) || 50
  srsCfg.easeStart        = parseFloat(el('srs-cfg-ease').value) || 2.5
  srsCfg.easyBonus        = parseFloat(el('srs-cfg-easy-bonus').value) || 1.3
  srsCfg.hardInterval     = parseFloat(el('srs-cfg-hard-int').value) || 1.2
  srsCfg.intervalModifier = parseFloat(el('srs-cfg-int-mod').value) || 1.0
  srsCfg.maxInterval      = parseInt(el('srs-cfg-max-int').value) || 36500
  delete srsCfg.graduateEasyInterval  // campo legado substituído por easyInterval
  persistSrsCfg()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  hideSrsCfgModal()
  renderSrsSection()
  toast('Configurações do SRS salvas', 'success')
}


// ================================================================
// LIGHTBOX — zoom de imagem ao clicar
// ================================================================
function openImageLightbox(src, alt) {
  if (document.getElementById('img-lightbox')) return  // já aberto
  const lb = document.createElement('div')
  lb.className = 'img-lightbox'
  lb.id = 'img-lightbox'
  lb.onclick = () => lb.remove()
  lb.innerHTML = `<img src="${src}" alt="${alt || ''}" onclick="event.stopPropagation()">`
  document.body.appendChild(lb)
}

// Delegar clique em imagens do card (usando event delegation no body)
document.addEventListener('click', e => {
  const img = e.target.closest('.srs-back-image-col img, .bpp-card-image, .srs-card-image')
  if (img) { e.stopPropagation(); openImageLightbox(img.src, img.alt) }
})
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { document.getElementById('img-lightbox')?.remove() }
})

// ================================================================
// REGENERATE EXAMPLE SENTENCE via AI
// ================================================================
async function regenerateCardExample(cardId, btnEl) {
  if (!aiChatCfg().key) { toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'warning'); return }
  const card = srsCards.find(c => c.id === cardId)
  if (!card) return

  btnEl.disabled = true
  const origHTML = btnEl.innerHTML
  btnEl.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;vertical-align:middle"></span>'

  try {
    const _gL = getLangDef(cardLang(card))
    const prompt = `Generate ONE example sentence in ${_gL.nameEn} for a Brazilian learner of ${_gL.nameEn}, illustrating exactly this meaning of the word.

Word (${_gL.nameEn}): "${card.word}"
Meaning (Portuguese): "${card.meaning_pt}"
Definition (Portuguese): "${card.definition_pt || card.meaning_pt}"

Rules:
- The sentence MUST clearly and naturally illustrate the specific meaning above
- The Portuguese bold MUST be interchangeable with "${card.meaning_pt}" in that sentence — never a word that belongs to a DIFFERENT sense of "${card.word}"
- Translate what the sentence DOES, the way a Brazilian would say it — never word-by-word ("we'll get you in" → "a gente te encaixa", not "colocar você dentro")
- Write like a native speaker — feel free to use a novel, news article or real conversation style
- Keep it 10-20 words long
- Rules for bold — CRITICAL, on BOTH sides:
  - ${_gL.nameEn}: wrap the target in <b></b> exactly as it appears conjugated/inflected in the sentence. For a multi-word or separable expression wrap ALL its parts even when another word sits between them; for an idiom wrap the whole expression.
  - Portuguese: wrap the word or short phrase that is the Portuguese equivalent of the target IN THAT SENTENCE in <b></b>.
  - Exactly ONE bold span per side. Do not bold anything else.
- Return ONLY valid JSON (no markdown): {"en": "${_gL.nameEn} sentence with <b>word</b>.", "pt": "Tradução com a <b>palavra</b> em negrito."}`

    const result = await aiJSON(prompt, { maxTokens: 200 })
    if (!result.en) throw new Error('Resposta inválida da IA')

    // Update card snapshot
    card.example_en = result.en
    card.example_pt = result.pt || ''
    saveSrsCards()
    autoSyncAfterChange()

    // Also update original word data so future cards reflect the change
    const w = words && words.find(x => x.id === card.wordId)
    if (w && w.meanings && w.meanings[card.meaningIdx]) {
      const m = w.meanings[card.meaningIdx]
      const ei = card.exampleIdx >= 0 ? card.exampleIdx : 0
      if (m.examples && m.examples[ei]) {
        m.examples[ei].en = result.en
        m.examples[ei].pt = result.pt || ''
      }
      m.example_en = result.en
      m.example_pt = result.pt || ''
      saveWords()
    }

    // Re-render card back without resetting flip state
    await renderSrsCardBack()
    toast('Frase de exemplo atualizada', 'success')
  } catch(e) {
    toast(`Erro ao gerar frase: ${e.message}`, 'error')
    btnEl.disabled = false
    btnEl.innerHTML = origHTML
  }
}

// Bootstrap is handled by initApp() defined above