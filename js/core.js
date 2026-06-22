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
  n8nBase: '',
  theme: 'midnight'
}

let cfg = {}
let words = []
let activeWordId = null
const collapsedGroups = new Set()
let kindleItems = [], midiaItems = [], siteItems = []

function loadCfg() {
  try { cfg = { ...DEF_CFG, ...JSON.parse(localStorage.getItem(SK.settings) || '{}') } }
  catch { cfg = { ...DEF_CFG } }
}
function saveCfg() { localStorage.setItem(SK.settings, JSON.stringify(cfg)) }

// ================================================================
// THEMES
// ================================================================
const THEMES = [
  { id: 'midnight', name: 'Midnight',  dark: true,  swatch: ['#06091A', '#3B82F6'] },
  { id: 'light',    name: 'Light',     dark: false, swatch: ['#F4F6FB', '#2563EB'] },
  { id: 'sepia',    name: 'Sepia',     dark: false, swatch: ['#F3EAD8', '#B45309'] },
  { id: 'emerald',  name: 'Emerald',   dark: true,  swatch: ['#07130F', '#10B981'] },
  { id: 'violet',   name: 'Violet',    dark: true,  swatch: ['#0E0A1C', '#8B5CF6'] },
]
function applyTheme(id) {
  const valid = THEMES.find(t => t.id === id) ? id : 'midnight'
  document.documentElement.setAttribute('data-theme', valid)
  cfg.theme = valid
}
// Aplica o tema o mais cedo possível (antes mesmo do initApp) p/ evitar flash
try {
  const _stored = JSON.parse(localStorage.getItem('englab_cfg') || '{}')
  document.documentElement.setAttribute('data-theme', _stored.theme || 'midnight')
} catch { document.documentElement.setAttribute('data-theme', 'midnight') }

// ================================================================
// ÍCONES — conjunto de linha (estilo Lucide), inline SVG.
// Uso: ic('plus')  ou  ic('plus','ic-lg')  → string SVG p/ innerHTML
// ================================================================
const ICONS = {
  home:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  bookOpen:'<path d="M12 6.5C10 5 7 4.5 3 5v14c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5z"/><path d="M12 6.5V20"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sparkles:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7z"/>',
  palette:'<path d="M12 2a10 10 0 1 0 0 20 2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2h1a4 4 0 0 0 4-4 9 9 0 0 0-9-9z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.3-.6-.6-2.3z"/>',
  cloud:'<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 7 19z"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6a8 3 0 0 0 16 0V5"/><path d="M4 11v6a8 3 0 0 0 16 0v-6"/>',
  volume:'<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/>',
  pencil:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  film:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 12h18M3 7.5h4M3 16.5h4M17 7.5h4M17 16.5h4"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
  message:'<path d="M21 11.5a8.5 8.5 0 0 1-12 7.7L3 21l1.8-6A8.5 8.5 0 1 1 21 11.5z"/>',
  trash:'<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  download:'<path d="M12 3v12"/><path d="m7 12 5 5 5-5"/><path d="M5 21h14"/>',
  upload:'<path d="M12 21V9"/><path d="m7 12 5-5 5 5"/><path d="M5 3h14"/>',
  layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  flame:'<path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1.6 1-3 1-3s2 1.5 2 3c1.5 0 2-2 2-3 0-3-2-6-2-6z"/>',
  play:'<path d="M6 4l14 8-14 8z"/>',
  playCircle:'<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>',
  arrowRight:'<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  zap:'<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a6 6 0 0 1 0 12h-3"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  alert:'<path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  checkCircle:'<circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  tv:'<rect x="2" y="7" width="20" height="13" rx="2"/><path d="m7 2 5 5 5-5"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/>',
  clipboard:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  google:'<path d="M21 12.2c0-.6-.05-1.2-.15-1.7H12v3.4h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-7z"/><path d="M12 21c2.4 0 4.5-.8 6-2.2l-3.1-2.4c-.8.6-2 .9-2.9.9-2.3 0-4.2-1.5-4.9-3.6H3.9v2.4A9 9 0 0 0 12 21z"/><path d="M7.1 13.7a5.4 5.4 0 0 1 0-3.4V7.9H3.9a9 9 0 0 0 0 8.2z"/><path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 3.9 7.9l3.2 2.4C7.8 8.1 9.7 6.6 12 6.6z"/>',
}
function ic(name, extra) {
  const inner = ICONS[name]; if (!inner) return ''
  return `<svg class="ic${extra ? ' ' + extra : ''}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`
}
// Ícone por tipo de fonte (série, filme, etc.) — usado em Revisar, Adicionar e Estudar
function srcIcon(t) {
  const m = { series:'tv', movie:'film', youtube:'playCircle', kindle:'book', podcast:'mic', website:'globe', manual:'pencil' }
  return ic(m[t] || 'bookOpen', 'ic-sm')
}
function loadWords() {
  try { words = JSON.parse(localStorage.getItem(SK.words) || '[]') } catch { words = [] }
}
function saveWords() { localStorage.setItem(SK.words, JSON.stringify(words)) }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7) }


// ================================================================
// NAVIGATION
// ================================================================
const SECTIONS = ['dashboard','adicionar','revisar','estudar','biblioteca','configuracoes']
// Lazy-load map: section → arquivo JS carregado só na 1ª visita
// biblioteca usa funções de study.js (buildSrsFrente/Verso/MetaChips/fmtDays)
const _LAZY = { adicionar: 'js/add.js', estudar: 'js/study.js', biblioteca: 'js/study.js' }
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
  if (name === 'biblioteca') openBiblioteca()
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
  const icons = { success:'checkCircle', error:'x', warning:'alert', info:'info' }
  const t = document.createElement('div')
  t.className = `toast ${type}`
  t.innerHTML = `${ic(icons[type] || 'info')}<span>${esc(msg)}</span>`
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

