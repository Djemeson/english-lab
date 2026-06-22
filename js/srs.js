// ================================================================
// SRS ENGINE — SM-2 ALGORITHM
// ================================================================

// ---- Storage ----
let srsCards = []  // array of card objects
let srsCfg = {}
let srsLog = []    // [{date:'YYYY-MM-DD', reviewed:N, correct:N}]
// Estado da sessão de estudo. Declarado aqui (arquivo não-lazy) porque o srs.js
// referencia srsSession; o study.js (lazy) só atribui valores a ele.
let srsSession = null

// Padrões espelhando o preset do Anki fornecido
const SRS_DEF_CFG = {
  newPerDay: 20,            // limite diário de cards novos (Anki: 999)
  revPerDay: 200,           // limite diário de revisões (Anki: 9999)
  steps: [1, 10],           // etapas de aprendizagem (min) — Novos Cartões
  relearnSteps: [1, 5, 10], // etapas de reaprendizagem (min) — Falhas
  graduateInterval: 1,      // intervalo de graduação (dias) — "Bom" conclui aprendizado
  easyInterval: 4,          // intervalo fácil (dias) — "Fácil" pula o aprendizado
  easeStart: 2.5,           // facilidade inicial
  easeMin: 1.3,             // facilidade mínima
  easyBonus: 1.3,           // bônus por ser fácil
  hardInterval: 1.2,        // multiplicador de "Difícil" na revisão (intervalo árduo)
  intervalModifier: 1.0,    // modificador de intervalo
  lapseNewInterval: 0.0,    // % do intervalo mantido ao errar (Anki "Novo intervalo")
  minInterval: 1,           // intervalo mínimo (dias) após erro
  maxInterval: 36500,       // intervalo máximo (dias)
  leechThreshold: 50        // limite de falhas para marcar "sanguessuga" (leech)
}
// Compat: configs antigas usavam graduateEasyInterval
function _easyInterval() { return srsCfg.easyInterval ?? srsCfg.graduateEasyInterval ?? 4 }

// loadSrs — carrega srsCfg, srsLog e decks (srsCards vem do IDB via initApp)
// Mantido para compatibilidade mas NÃO recarrega srsCards do storage
function loadSrs() {
  try { srsCfg = { ...SRS_DEF_CFG, ...JSON.parse(localStorage.getItem(SK.srsCfg) || '{}') } } catch { srsCfg = { ...SRS_DEF_CFG } }
  try { srsLog = JSON.parse(localStorage.getItem(SK.srsLog) || '[]') } catch { srsLog = [] }
  loadSrsDecks()
}

// Carrega srsCards do IDB na inicialização; migra do localStorage se necessário
async function loadSrsAsync() {
  try {
    let cards = await CardsDB.getAll()
    if (!cards.length) {
      // Migração única: dados antigos no localStorage
      try {
        const old = JSON.parse(localStorage.getItem(SK.srsCards) || '[]')
        if (old.length) {
          cards = old
          CardsDB.save(cards) // persiste no IDB
          localStorage.removeItem(SK.srsCards) // limpa localStorage
          console.log(`[CardsDB] Migrated ${cards.length} cards from localStorage to IndexedDB`)
        }
      } catch {}
    }
    srsCards = cards
  } catch(e) {
    console.warn('[CardsDB] loadSrsAsync failed, falling back to localStorage', e)
    try { srsCards = JSON.parse(localStorage.getItem(SK.srsCards) || '[]') } catch { srsCards = [] }
  }
  // Aplica backup de sessão abandonada — o IDB pode não ter salvo antes do close
  _applySessionBackup()
}

// ---- Backup síncrono de sessão ----
// O IndexedDB é fire-and-forget: se o browser fechar antes da transação
// commitar, os estados se perdem. O beforeunload salva no localStorage
// (síncrono) como fallback; loadSrsAsync() aplica na próxima abertura.
const SK_BACKUP = 'el-srs-backup'

function _applySessionBackup() {
  try {
    const raw = localStorage.getItem(SK_BACKUP)
    if (!raw) return
    const backup = JSON.parse(raw)
    if (!backup.states) return
    const byId = {}
    srsCards.forEach(c => { byId[c.id] = c })
    // Aplica apenas estados mais avançados (não-'new') sobre o IDB
    Object.entries(backup.states).forEach(([id, s]) => {
      if (byId[id] && s.state !== 'new') Object.assign(byId[id], s)
    })
    srsCards = Object.values(byId)
    // Aplica log parcial se houver
    if (backup.log) {
      const today = todayStr()
      const entry = backup.log
      if (entry.date === today) {
        let log = srsLog.find(l => l.date === today)
        if (!log) { log = { date: today, reviewed: 0, correct: 0, newSeen: 0 }; srsLog.push(log) }
        if ((entry.reviewed || 0) > (log.reviewed || 0)) {
          log.reviewed = entry.reviewed
          log.correct  = entry.correct
          log.newSeen  = entry.newSeen
          saveSrsLog()
        }
      }
    }
    // Repersiste no IDB com os estados corrigidos (nunca com array vazio)
    if (srsCards.length) CardsDB.save(srsCards)
    // Backup já foi aplicado e persistido — limpa para não reaplicar estados
    // velhos em recarregamentos futuros. O beforeunload o reescreve a cada fecho.
    _clearSessionBackup()
    console.log('[SRS] Session backup applied from localStorage')
  } catch(e) { console.warn('[SRS] Failed to apply session backup', e) }
}

function _clearSessionBackup() {
  localStorage.removeItem(SK_BACKUP)
}

// Salva estados e log parcial no localStorage antes de fechar
window.addEventListener('beforeunload', () => {
  try {
    const states = {}
    srsCards.forEach(c => {
      if (c.state !== 'new') {
        states[c.id] = {
          state: c.state, due: c.due, interval: c.interval,
          ease: c.ease, stepIdx: c.stepIdx, lapses: c.lapses
        }
      }
    })
    if (!Object.keys(states).length && !srsSession) return
    const backup = { states }
    if (srsSession) {
      const today = todayStr()
      const todayLog = srsLog.find(l => l.date === today)
      backup.log = {
        date:     today,
        reviewed: (todayLog?.reviewed || 0) + srsSession.done,
        correct:  (todayLog?.correct  || 0) + srsSession.correct,
        newSeen:  (todayLog?.newSeen  || 0) + srsSession.newSeen
      }
    }
    localStorage.setItem(SK_BACKUP, JSON.stringify(backup))
  } catch(e) {}
})

// saveSrsCards — grava no IDB (fire-and-forget, não bloqueia UI)
function saveSrsCards() { CardsDB.save(srsCards) }
function persistSrsCfg(){ localStorage.setItem(SK.srsCfg, JSON.stringify(srsCfg)) }
function saveSrsLog()   { localStorage.setItem(SK.srsLog, JSON.stringify(srsLog)) }

function todayStr() { return new Date().toISOString().slice(0,10) }
function nowTs()    { return Date.now() }

// Retorna meia-noite (horário local) do dia que contém o timestamp dado.
// Garante que cards de revisão fiquem disponíveis logo após a virada do dia,
// não no mesmo horário em que foram revisados.
function startOfDayTs(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Para cards em revisão: agenda para meia-noite do dia-alvo
function dueDays(intervalDays) {
  return startOfDayTs(Date.now() + intervalDays * 86400000)
}

// ---- SM-2 Core ----
// Card schema:
// { id, wordId, meaningIdx, exampleIdx, state:'new'|'learning'|'review'|'relearning',
//   due: timestamp_ms, interval: days, ease: float, lapses: int,
//   stepIdx: int (for learning/relearning), addedDate: 'YYYY-MM-DD',
//   frente: str, verso: str, word: str, meaning_pt: str, ipa: str, type: str }

function createSrsCard(wordId, meaningIdx, exampleIdx) {
  const w = words.find(x => x.id === wordId)
  if (!w) return null
  const m = w.meanings[meaningIdx]
  if (!m) return null
  const ex = m.examples && m.examples[exampleIdx] ? m.examples[exampleIdx] : null

  const deckId = getWordDeckId(w.type)
  return {
    id: uid(),
    wordId, meaningIdx, exampleIdx,
    deckId,
    state: 'new',
    due: nowTs(),
    interval: 0,
    ease: srsCfg.easeStart,
    lapses: 0,
    stepIdx: 0,
    addedDate: todayStr(),
    // Snapshot data (so card works even if word is deleted)
    word: w.word || '',
    ipa: w.ipa || '',
    type: w.type || '',
    source_type: w.source_type || '',
    variety: m.variety || w.variety || 'general',
    register: m.register || 'neutral',
    meaning_pt: m.meaning_pt || '',
    definition_pt: m.definition_pt || '',
    example_en: ex ? ex.en : (m.example_en || ''),
    example_pt: ex ? ex.pt : (m.example_pt || '')
  }
}

// Rating: 1=again(Errei), 2=hard(Difícil), 3=good(Bom), 4=easy(Fácil)
function rateSrsCard(cardId, rating) {
  const card = srsCards.find(c => c.id === cardId)
  if (!card) return

  const now = nowTs()
  const learnSteps   = (srsCfg.steps && srsCfg.steps.length)        ? srsCfg.steps        : [1, 10]
  const relearnSteps = (srsCfg.relearnSteps && srsCfg.relearnSteps.length) ? srsCfg.relearnSteps : [10]
  const easeMin = srsCfg.easeMin ?? 1.3
  const mod     = srsCfg.intervalModifier ?? 1.0
  const minInt  = srsCfg.minInterval ?? 1
  const maxInt  = srsCfg.maxInterval ?? 36500
  const cap = d => Math.min(maxInt, Math.max(minInt, Math.round(d)))
  if (card.ease == null) card.ease = srsCfg.easeStart ?? 2.5
  if (card.stepIdx == null) card.stepIdx = 0

  if (card.state === 'new' || card.state === 'learning') {
    const steps = learnSteps
    if (rating === 1) {                       // Errei — volta ao 1º passo
      card.state = 'learning'; card.stepIdx = 0; card.due = now + steps[0] * 60000
    } else if (rating === 2) {                // Difícil — repete o passo atual
      card.state = 'learning'
      card.due = now + steps[Math.min(card.stepIdx, steps.length - 1)] * 60000
    } else if (rating === 4) {                // Fácil — pula o aprendizado e gradua
      card.state = 'review'
      card.interval = cap(_easyInterval())
      card.ease = card.ease + 0.15
      card.due = dueDays(card.interval)
    } else {                                  // Bom — avança um passo; gradua só ao concluir
      const next = card.stepIdx + 1
      if (next >= steps.length) {
        card.state = 'review'
        card.interval = cap(srsCfg.graduateInterval ?? 1)
        card.due = dueDays(card.interval)
      } else {
        card.state = 'learning'; card.stepIdx = next; card.due = now + steps[next] * 60000
      }
    }

  } else if (card.state === 'relearning') {
    const steps = relearnSteps
    if (rating === 1) {                       // Errei — volta ao 1º passo de reaprendizagem
      card.stepIdx = 0; card.due = now + steps[0] * 60000
    } else if (rating === 2) {                // Difícil — repete o passo
      card.due = now + steps[Math.min(card.stepIdx, steps.length - 1)] * 60000
    } else {                                  // Bom/Fácil — gradua de volta para revisão
      const next = card.stepIdx + 1
      if (rating === 4 || next >= steps.length) {
        card.state = 'review'
        card.interval = cap(card.interval || minInt)   // intervalo pós-lapso já reduzido
        card.due = dueDays(card.interval)
      } else {
        card.stepIdx = next; card.due = now + steps[next] * 60000
      }
    }

  } else { // review
    if (rating === 1) {                       // Errei (lapse) → reaprendizagem
      card.lapses = (card.lapses || 0) + 1
      card.ease = Math.max(easeMin, card.ease - 0.20)
      card.interval = cap((card.interval || 1) * (srsCfg.lapseNewInterval ?? 0))
      card.state = 'relearning'; card.stepIdx = 0
      card.due = now + relearnSteps[0] * 60000
      if (srsCfg.leechThreshold && card.lapses >= srsCfg.leechThreshold) card.leech = true
    } else {
      let ni
      if (rating === 2) {                     // Difícil
        ni = (card.interval || 1) * (srsCfg.hardInterval ?? 1.2)
        card.ease = Math.max(easeMin, card.ease - 0.15)
      } else if (rating === 3) {              // Bom
        ni = (card.interval || 1) * card.ease
      } else {                                // Fácil
        ni = (card.interval || 1) * card.ease * (srsCfg.easyBonus ?? 1.3)
        card.ease = card.ease + 0.15
      }
      card.state = 'review'
      card.interval = cap(ni * mod)
      card.due = dueDays(card.interval)
    }
  }

  saveSrsCards()
  autoSyncAfterChange()
}

// ---- Preview next interval (without modifying card) ----
function previewInterval(card, rating) {
  const learnSteps   = (srsCfg.steps && srsCfg.steps.length)        ? srsCfg.steps        : [1, 10]
  const relearnSteps = (srsCfg.relearnSteps && srsCfg.relearnSteps.length) ? srsCfg.relearnSteps : [10]
  const mod    = srsCfg.intervalModifier ?? 1.0
  const minInt = srsCfg.minInterval ?? 1
  const maxInt = srsCfg.maxInterval ?? 36500
  const ease   = card.ease ?? srsCfg.easeStart ?? 2.5
  const stepIdx = card.stepIdx ?? 0
  const cap = d => Math.min(maxInt, Math.max(minInt, Math.round(d)))

  if (card.state === 'new' || card.state === 'learning') {
    const steps = learnSteps
    if (rating === 1) return fmtDur(steps[0] * 60000)
    if (rating === 2) return fmtDur(steps[Math.min(stepIdx, steps.length - 1)] * 60000)
    if (rating === 4) return fmtDays(cap(_easyInterval()))
    const next = stepIdx + 1                                   // Bom
    return next >= steps.length ? fmtDays(cap(srsCfg.graduateInterval ?? 1)) : fmtDur(steps[next] * 60000)
  }
  if (card.state === 'relearning') {
    const steps = relearnSteps
    if (rating === 1) return fmtDur(steps[0] * 60000)
    if (rating === 2) return fmtDur(steps[Math.min(stepIdx, steps.length - 1)] * 60000)
    const next = stepIdx + 1                                   // Bom/Fácil
    return (rating === 4 || next >= steps.length) ? fmtDays(cap(card.interval || minInt)) : fmtDur(steps[next] * 60000)
  }
  // review
  if (rating === 1) return fmtDur(relearnSteps[0] * 60000)
  let ni
  if (rating === 2)      ni = (card.interval || 1) * (srsCfg.hardInterval ?? 1.2)
  else if (rating === 3) ni = (card.interval || 1) * ease
  else                   ni = (card.interval || 1) * ease * (srsCfg.easyBonus ?? 1.3)
  return fmtDays(cap(ni * mod))
}

function fmtDur(ms) {
  if (ms < 3600000) return Math.round(ms/60000) + 'min'
  return Math.round(ms/3600000) + 'h'
}
function fmtDays(d) {
  if (d < 1)   return '<1d'
  if (d === 1) return '1d'
  if (d < 31)  return d + 'd'
  if (d < 365) return Math.round(d/30) + 'm'
  return Math.round(d/365) + 'a'
}

// ---- Counts ----
function srsDueCount() {
  const now = nowTs()
  return srsCards.filter(c => c.due <= now && (c.state === 'review' || c.state === 'relearning')).length
}
function srsNewTodayRemaining() {
  const today = todayStr()
  const newAdded = srsCards.filter(c => c.addedDate === today && c.state === 'new').length
  // How many NEW cards already seen today? Count from log
  const todayLog = srsLog.find(l => l.date === today)
  const newSeen = todayLog ? (todayLog.newSeen || 0) : 0
  const newAvail = srsCards.filter(c => c.state === 'new').length
  return Math.max(0, Math.min(srsCfg.newPerDay - newSeen, newAvail))
}
function srsStreak() {
  if (!srsLog.length) return 0
  let streak = 0
  const today = todayStr()
  let d = new Date()
  while (true) {
    const ds = d.toISOString().slice(0,10)
    if (ds === today && !srsLog.find(l => l.date === ds)) { d.setDate(d.getDate()-1); continue }
    if (srsLog.find(l => l.date === ds && l.reviewed > 0)) { streak++; d.setDate(d.getDate()-1) }
    else break
  }
  return streak
}

// ---- Save word to SRS ----
function saveToSrs(wordId) {
  const w = words.find(x => x.id === wordId)
  if (!w || !w.meanings || !w.meanings.length) { toast('Sem significados para salvar', 'warning'); return }
  const selected = w.meanings.filter(m => m.selected !== false)
  if (!selected.length) { toast('Selecione ao menos um significado', 'warning'); return }

  let added = 0, skipped = 0
  selected.forEach((m, _) => {
    const mi = w.meanings.indexOf(m)
    const examples = m.examples && m.examples.length ? m.examples : [null]
    examples.forEach((ex, ei) => {
      const exIdx = ex ? ei : -1
      // Check duplicate
      const exists = srsCards.find(c => c.wordId === wordId && c.meaningIdx === mi && c.exampleIdx === exIdx)
      if (exists) { skipped++; return }
      const card = createSrsCard(wordId, mi, exIdx < 0 ? 0 : exIdx)
      if (card) { srsCards.push(card); added++ }
    })
  })

  saveSrsCards()
  autoSyncAfterChange()

  // Mark word status
  if (added > 0) {
    w.status = 'in_srs'
    w.updated_at = new Date().toISOString()  // bump p/ vencer o merge do fbPull
    saveWords()
    renderSidebar()
    renderDashboard()
    updateSrsBadge()
    toast(`📚 ${added} card${added !== 1 ? 's' : ''} salvos no site SRS${skipped ? ` (${skipped} já existiam)` : ''}`, 'success')
    // Pré-gera áudio; ao final, sync automático de novos áudios para Firebase
    const newCards = srsCards.slice(-added)
    preGenerateAudio(newCards).then(() => autoSyncAudioAfterChange())
  } else {
    toast(`Todos os cards já existem no SRS (${skipped} duplicados)`, 'info')
  }
}

// ---- Update SRS badge in nav ----
function updateSrsBadge() {
  loadSrs()
  // During an active session, srsLog hasn't been updated yet with this session's
  // newSeen — account for it manually so the badge decreases as cards are rated
  const sessionNewSeen = srsSession ? srsSession.newSeen : 0
  const today = todayStr()
  const todayLog = srsLog.find(l => l.date === today)
  const logNewSeen = todayLog ? (todayLog.newSeen || 0) : 0
  const effectiveNewSeen = logNewSeen + sessionNewSeen

  const newAvail = srsCards.filter(c => c.state === 'new').length
  const newRem = Math.max(0, Math.min(srsCfg.newPerDay - effectiveNewSeen, newAvail))

  const due = srsDueCount() + newRem
  const badge = el('badge-srs')
  if (badge) {
    badge.textContent = due
    badge.classList.toggle('hidden', due === 0)
  }
}

