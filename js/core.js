// ================================================================
// STATE & STORAGE
// ================================================================
const SK = { settings: 'englab_cfg', words: 'englab_words', srsCards: 'el-srs-cards', srsCfg: 'el-srs-cfg', srsLog: 'el-srs-log', srsDecks: 'el-srs-decks', kindleSeen: 'el-kindle-seen', kindleQueue: 'el-kindle-queue', deletedWords: 'el-deleted-words' }

function loadDeletedIds() { try { return new Set(JSON.parse(localStorage.getItem(SK.deletedWords) || '[]')) } catch { return new Set() } }
function saveDeletedIds(ids) { localStorage.setItem(SK.deletedWords, JSON.stringify([...ids])) }
function markDeleted(id) { const ids = loadDeletedIds(); ids.add(id); saveDeletedIds(ids) }

const DEF_CFG = {
  aiProvider: 'openai', aiModel: 'gpt-4o-mini', ttsProvider: 'openai',
  openaiKey: '',
  ankiUrl: 'http://localhost:8765', ankiDeck: 'Inglês', ankiModel: 'Inglês Básico',
  n8nBase: '',
  gistToken: '', gistId: '',
  fields: { word: 'Frente', meaning: 'Verso', context: 'Contexto', ipa: 'IPA', examples: 'Exemplos', audio: 'Áudio' }
}

let cfg = {}
let words = []
let activeWordId = null
const collapsedGroups = new Set()
let kindleItems = [], midiaItems = [], siteItems = []

function loadCfg() {
  try { cfg = { ...DEF_CFG, ...JSON.parse(localStorage.getItem(SK.settings) || '{}') }
        if (!cfg.fields) cfg.fields = DEF_CFG.fields
  } catch { cfg = { ...DEF_CFG } }
}
function saveCfg() { localStorage.setItem(SK.settings, JSON.stringify(cfg)) }
function loadWords() {
  try { words = JSON.parse(localStorage.getItem(SK.words) || '[]') } catch { words = [] }
}
function saveWords() { localStorage.setItem(SK.words, JSON.stringify(words)) }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7) }


// ================================================================
// NAVIGATION
// ================================================================
const SECTIONS = ['dashboard','adicionar','revisar','estudar','configuracoes']
// Lazy-load map: section → arquivo JS carregado só na 1ª visita
const _LAZY = { adicionar: 'js/add.js', estudar: 'js/study.js' }
const _loadedModules = new Set()

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    if (_loadedModules.has(src)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => { _loadedModules.add(src); resolve() }
    s.onerror = () => reject(new Error('Falha ao carregar ' + src))
    document.body.appendChild(s)
  })
}

function showSection(name) {
  const lazy = _LAZY[name]
  if (lazy && !_loadedModules.has(lazy)) {
    _loadScript(lazy).then(() => _activateSection(name)).catch(e => { console.error(e); _activateSection(name) })
  } else {
    _activateSection(name)
  }
}

function _activateSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'))
  const navEl = document.getElementById(`nav-${name}`)
  if (navEl) navEl.classList.add('active')
  document.getElementById(`section-${name}`).classList.add('active')
  if (name === 'dashboard') renderDashboard()
  if (name === 'adicionar') { if (loadKindleQueue()) renderKindleList() }
  if (name === 'revisar') renderReview()
  if (name === 'configuracoes') fillSettings()
  if (name === 'estudar') renderSrsSection()
}
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
  document.getElementById(`panel-${name}`).classList.add('active')
  event.currentTarget.classList.add('active')
}


// ================================================================
// HELPERS
// ================================================================
function el(id) { return document.getElementById(id) }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function escA(s) { return String(s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }
function escR(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function selectAll(cls, val) {
  document.querySelectorAll(`.${cls}`).forEach(c => c.checked = val)
}

function speakWord(word) {
  if (!window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(word); u.lang = 'en-US'; u.rate = 0.85
  speechSynthesis.speak(u)
}

function toast(msg, type = 'info') {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' }
  const t = document.createElement('div')
  t.className = `toast ${type}`
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${esc(msg)}</span>`
  el('toasts').appendChild(t)
  setTimeout(() => t.remove(), 4500)
}

// Drag & drop upload
function setupDrop(areaId, handler) {
  const area = el(areaId); if (!area) return
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag') })
  area.addEventListener('dragleave', () => area.classList.remove('drag'))
  area.addEventListener('drop', e => {
    e.preventDefault(); area.classList.remove('drag')
    const file = e.dataTransfer.files[0]
    if (file) { const dt = new DataTransfer(); dt.items.add(file); handler({ files: dt.files }) }
  })
}




// ================================================================
// SRS DECK SYSTEM
// ================================================================
let srsDecks = []

const DEFAULT_DECKS = [
  { id: 'dk-root',    name: 'Inglês', parentId: null },
  { id: 'dk-vocab',   name: 'Vocabulary',    parentId: 'dk-root' },
  { id: 'dk-phrasal', name: 'Phrasal Verbs', parentId: 'dk-root' },
  { id: 'dk-idioms',  name: 'Idioms',        parentId: 'dk-root' },
  { id: 'dk-colloc',  name: 'Collocations',  parentId: 'dk-root' },
]

function loadSrsDecks() {
  try {
    const stored = JSON.parse(localStorage.getItem(SK.srsDecks) || '[]')
    srsDecks = stored.length ? stored : JSON.parse(JSON.stringify(DEFAULT_DECKS))
  } catch { srsDecks = JSON.parse(JSON.stringify(DEFAULT_DECKS)) }
  if (!srsDecks.length) srsDecks = JSON.parse(JSON.stringify(DEFAULT_DECKS))
  saveSrsDecks()
}
function saveSrsDecks() { localStorage.setItem(SK.srsDecks, JSON.stringify(srsDecks)) }
function getDeckById(id) { return srsDecks.find(d => d.id === id) }
function getSrsDeckPath(id) {
  const deck = getDeckById(id); if (!deck) return ''
  if (!deck.parentId) return deck.name
  return getSrsDeckPath(deck.parentId) + '::' + deck.name
}
function getDeckChildren(parentId) { return srsDecks.filter(d => d.parentId === parentId) }
function getRootDecks() { return srsDecks.filter(d => !d.parentId) }
function getAllDescendantIds(deckId) {
  const children = getDeckChildren(deckId)
  let ids = children.map(c => c.id)
  children.forEach(c => { ids = ids.concat(getAllDescendantIds(c.id)) })
  return ids
}
function getDeckCardCount(deckId) {
  const allIds = [deckId, ...getAllDescendantIds(deckId)]
  return srsCards.filter(c => allIds.includes(c.deckId)).length
}
function getWordDeckId(wordType) {
  const m = { phrasal_verb:'dk-phrasal', idiom:'dk-idioms', collocation:'dk-colloc' }
  return m[(wordType||'').toLowerCase()] || 'dk-vocab'
}
function addDeck(name, parentId) {
  const id = 'dk-' + uid(); srsDecks.push({ id, name: name.trim(), parentId: parentId||null }); saveSrsDecks(); return id
}
function renameDeck(id, newName) { const d = getDeckById(id); if (d) { d.name = newName.trim(); saveSrsDecks() } }
function deleteDeck(id) {
  const deck = getDeckById(id); const fallback = deck?.parentId || 'dk-vocab'
  srsCards.forEach(c => { if (c.deckId === id) c.deckId = fallback })
  const toRemove = [id, ...getAllDescendantIds(id)]
  srsDecks = srsDecks.filter(d => !toRemove.includes(d.id))
  saveSrsDecks(); saveSrsCards()
}
function populateDeckSelect(selectEl, selectedId) {
  if (!selectEl) return; selectEl.innerHTML = ''
  function addOpts(parentId, depth) {
    srsDecks.filter(d => d.parentId === parentId).forEach(d => {
      const opt = document.createElement('option')
      opt.value = d.id; opt.textContent = '  '.repeat(depth) + (depth > 0 ? '› ' : '') + d.name
      if (d.id === selectedId) opt.selected = true
      selectEl.appendChild(opt); addOpts(d.id, depth + 1)
    })
  }
  addOpts(null, 0)
}

