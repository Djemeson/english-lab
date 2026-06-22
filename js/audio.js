// ================================================================
// AUDIO SYSTEM — IndexedDB cache + OpenAI TTS pre-generation
// ================================================================

// IndexedDB wrapper — sem limite de tamanho, persiste localmente
const AudioDB = {
  _db: null,
  async open() {
    if (this._db) return this._db
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('english-lab-audio', 1)
      req.onupgradeneeded = e => e.target.result.createObjectStore('audio')
      req.onsuccess = e => { this._db = e.target.result; resolve(this._db) }
      req.onerror = () => reject(req.error)
    })
  },
  async get(key) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const req = db.transaction('audio', 'readonly').objectStore('audio').get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  },
  async set(key, value) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio', 'readwrite')
      tx.objectStore('audio').put(value, key)
      tx.oncomplete = resolve
      tx.onerror = () => resolve()
    })
  },
  async getAll() {
    const db = await this.open()
    return new Promise((resolve) => {
      const result = {}
      const req = db.transaction('audio', 'readonly').objectStore('audio').openCursor()
      req.onsuccess = e => {
        const cursor = e.target.result
        if (cursor) { result[cursor.key] = cursor.value; cursor.continue() }
        else resolve(result)
      }
      req.onerror = () => resolve({})
    })
  },
  async setAll(data) {
    if (!data || typeof data !== 'object') return
    const db = await this.open()
    return new Promise((resolve) => {
      const tx = db.transaction('audio', 'readwrite')
      const store = tx.objectStore('audio')
      store.clear()
      for (const [k, v] of Object.entries(data)) store.put(v, k)
      tx.oncomplete = resolve
      tx.onerror = resolve
    })
  },
  async count() {
    const db = await this.open()
    return new Promise(resolve => {
      const req = db.transaction('audio', 'readonly').objectStore('audio').count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(0)
    })
  }
}

// Gera chave de cache baseada no texto (hash simples)
function audioKey(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0
  return 'a' + Math.abs(h).toString(36)
}

// Converte Blob para data URL base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Gera áudio via OpenAI TTS e armazena no IndexedDB
// Retorna data URL base64 ou null se falhar
async function ensureSrsAudio(text) {
  if (!text || !cfg.openaiKey) return null
  const key = audioKey(text)
  // Verifica cache local
  const cached = await AudioDB.get(key)
  if (cached) return cached
  // Gera via OpenAI TTS
  try {
    const voice = randomVoice()
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', input: text, voice, speed: 0.9 })
    })
    if (!res.ok) throw new Error(`TTS ${res.status}`)
    const blob = await res.blob()
    const b64 = await blobToBase64(blob)
    await AudioDB.set(key, b64)
    return b64
  } catch(e) {
    console.warn('[SRS Audio]', e.message)
    return null
  }
}

// Pré-gera áudio para uma lista de cards recém-criados (chamado ao salvar no SRS)
let _audioGenAbort = false

function cancelAudioGen() {
  _audioGenAbort = true
  el('audio-gen-banner')?.classList.add('hidden')
  // Áudios já gerados estão salvos no IndexedDB — sincroniza o que foi feito
  autoSyncAfterChange()
  toast('Geração cancelada — áudios gerados até aqui foram salvos', 'info')
}

function _updateAudioBanner(done, total, saved) {
  const banner = el('audio-gen-banner')
  const bar    = el('audio-gen-bar')
  const label  = el('audio-gen-label')
  if (!banner) return
  if (total === 0) { banner.classList.add('hidden'); return }
  banner.classList.remove('hidden')
  const pct = Math.round((done / total) * 100)
  if (bar)   bar.style.width = pct + '%'
  if (label) label.textContent = `${done} / ${total}${saved ? ` · ✓ ${saved} salvos` : ''}`
}

async function preGenerateAudio(cards) {
  if (!cfg.openaiKey || !cards || !cards.length) return
  const toGenerate = cards.map(c => c.example_en || c.word).filter(Boolean)
  const unique = [...new Set(toGenerate)]
  if (!unique.length) return

  _audioGenAbort = false
  const total = unique.length
  let done = 0, generated = 0
  _updateAudioBanner(0, total, 0)

  const SYNC_EVERY = 5 // sincroniza Firebase a cada N áudios gerados

  for (const text of unique) {
    if (_audioGenAbort) break
    const result = await ensureSrsAudio(text) // salva no IndexedDB imediatamente
    if (result) {
      generated++
      // Sincroniza Firebase a cada SYNC_EVERY — debounced, não sobrecarrega
      if (generated % SYNC_EVERY === 0) autoSyncAfterChange()
    }
    done++
    _updateAudioBanner(done, total, generated)
    await new Promise(r => setTimeout(r, 100))
  }

  // Sync final: dados agora, áudio após 30s (não sobrecarrega a cota)
  if (generated > 0) {
    autoSyncAfterChange()       // sincroniza dados estruturais imediatamente
    autoSyncAudioAfterChange()  // sincroniza áudios novos após estabilizar
  }

  el('audio-gen-banner')?.classList.add('hidden')
  toast(
    _audioGenAbort
      ? `Cancelado — ${generated} áudio${generated!==1?'s':''} salvos`
      : `✅ ${generated}/${total} áudio${generated!==1?'s':''} gerados e salvos`,
    generated > 0 ? 'success' : 'info'
  )
}


// ================================================================
// CARDS DB — IndexedDB para srsCards (substitui localStorage)
// Índices: deckId, state, due — queries sem carregar tudo na memória
// ================================================================
const CardsDB = {
  _db: null,
  async open() {
    if (this._db) return this._db
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('english-lab-cards', 1)
      req.onupgradeneeded = e => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('cards')) {
          const store = db.createObjectStore('cards', { keyPath: 'id' })
          store.createIndex('deckId', 'deckId', { unique: false })
          store.createIndex('state',  'state',  { unique: false })
          store.createIndex('due',    'due',    { unique: false })
          store.createIndex('wordId', 'wordId', { unique: false })
        }
      }
      req.onsuccess = e => { this._db = e.target.result; resolve(this._db) }
      req.onerror = () => reject(req.error)
    })
  },
  async getAll() {
    const db = await this.open()
    return new Promise(resolve => {
      const req = db.transaction('cards','readonly').objectStore('cards').getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror  = () => resolve([])
    })
  },
  async getByDecks(deckIds) {
    const db = await this.open()
    const index = db.transaction('cards','readonly').objectStore('cards').index('deckId')
    const results = await Promise.all([...new Set(deckIds)].map(id =>
      new Promise(resolve => {
        const req = index.getAll(id)
        req.onsuccess = () => resolve(req.result || [])
        req.onerror  = () => resolve([])
      })
    ))
    return results.flat()
  },
  // Fire-and-forget — não bloqueia a UI
  // SEGURANÇA: nunca apaga tudo com array vazio (evita wipe acidental do IDB).
  // Para limpar de fato, use CardsDB.clear(). Remoções individuais: deleteCard().
  save(cards, opts = {}) {
    if ((!cards || !cards.length) && !opts.allowEmpty) {
      console.warn('[CardsDB] save() ignorado: array vazio (use clear() para apagar de propósito)')
      return
    }
    this.open().then(db => {
      const tx = db.transaction('cards','readwrite')
      const store = tx.objectStore('cards')
      store.clear()
      for (const c of cards) store.put(c)
    }).catch(console.warn)
  },
  saveOne(card) {
    this.open().then(db => {
      db.transaction('cards','readwrite').objectStore('cards').put(card)
    }).catch(console.warn)
  },
  deleteCard(id) {
    this.open().then(db => {
      db.transaction('cards','readwrite').objectStore('cards').delete(id)
    }).catch(console.warn)
  },
  async clear() {
    const db = await this.open()
    return new Promise(resolve => {
      const req = db.transaction('cards','readwrite').objectStore('cards').clear()
      req.onsuccess = resolve
      req.onerror  = () => resolve()
    })
  }
}

// Reproduz áudio do card — usa cache IndexedDB, fallback Web Speech
let _srsAudio = null
async function playSrsTTS(text) {
  if (!text) return
  if (_srsAudio) { try { _srsAudio.pause() } catch{} ; _srsAudio = null }

  // Tenta cache local (IndexedDB)
  const key = audioKey(text)
  const cached = await AudioDB.get(key)
  if (cached) {
    _srsAudio = new Audio(cached)
    _srsAudio.play()
    return
  }

  // Não tem cache — gera agora (caso card antigo sem áudio pré-gerado)
  if (cfg.openaiKey) {
    const b64 = await ensureSrsAudio(text)
    if (b64) {
      _srsAudio = new Audio(b64)
      _srsAudio.play()
      autoSyncAfterChange()
      return
    }
  }

  // Fallback: Web Speech API (sem chave OpenAI ou erro)
  if (window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.82
    speechSynthesis.cancel(); speechSynthesis.speak(u)
  }
}

// Busca áudio diretamente da OpenAI TTS (fallback quando n8n não entrega base64)
async function fetchAudioBase64(word) {
  const key = cfg.openaiKey || ''
  if (!key || !word) return null
  try {
    const voice = randomVoice()
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', input: word, voice })
    })
    if (!res.ok) { console.warn('[TTS Direto] Erro HTTP', res.status); return null }
    const buffer = await res.arrayBuffer()
    // Converte ArrayBuffer para base64
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  } catch(e) {
    console.warn('[TTS Direto] Falha:', e.message)
    return null
  }
}


// ================================================================
// IMAGE SYSTEM — IndexedDB cache + DALL-E 3 + Gist cloud sync
// Key: wordId_meaningIdx (uma imagem por significado, compartilhada)
// ================================================================
const ImageDB = {
  _db: null,
  async open() {
    if (this._db) return this._db
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('english-lab-images', 1)
      req.onupgradeneeded = e => e.target.result.createObjectStore('images')
      req.onsuccess = e => { this._db = e.target.result; resolve(this._db) }
      req.onerror = () => reject(req.error)
    })
  },
  async get(key) {
    const db = await this.open()
    return new Promise(resolve => {
      const req = db.transaction('images','readonly').objectStore('images').get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  },
  async set(key, value) {
    const db = await this.open()
    return new Promise(resolve => {
      const tx = db.transaction('images','readwrite')
      tx.objectStore('images').put(value, key)
      tx.oncomplete = resolve; tx.onerror = resolve
    })
  },
  async getAll() {
    const db = await this.open()
    return new Promise(resolve => {
      const result = {}
      const req = db.transaction('images','readonly').objectStore('images').openCursor()
      req.onsuccess = e => {
        const c = e.target.result
        if (c) { result[c.key] = c.value; c.continue() } else resolve(result)
      }
      req.onerror = () => resolve({})
    })
  },
  async setAll(data) {
    if (!data || typeof data !== 'object') return
    const db = await this.open()
    return new Promise(resolve => {
      const tx = db.transaction('images','readwrite')
      const store = tx.objectStore('images')
      store.clear()
      for (const [k,v] of Object.entries(data)) store.put(v, k)
      tx.oncomplete = resolve; tx.onerror = resolve
    })
  }
}

// Chave da imagem: por significado, compartilhada entre todos os cards com mesmo wordId+meaningIdx
function imageKey(card) { return `img_${card.wordId}_${card.meaningIdx}` }

let _imageKeyCache = null
async function refreshImageKeyCache() {
  const all = await ImageDB.getAll()
  _imageKeyCache = new Set(Object.keys(all))
}

// Gera imagem via DALL-E 3 para o significado do card
// Propaga automaticamente para todos os cards que compartilham o mesmo significado
async function generateCardImage(cardId, callerEl) {
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'warning'); return }
  const card = srsCards.find(c => c.id === cardId)
  if (!card) return

  const key = imageKey(card)

  // Spinner no botão chamador
  if (callerEl) { callerEl.disabled = true; callerEl.innerHTML = '<span class="gen-spinner"></span> Gerando...' }

  const word   = card.word || ''
  const meaning = card.meaning_pt || card.definition_pt || ''
  const context = card.example_en  || ''
  const prompt  = `Digital illustration, editorial style. English vocabulary flashcard image for the word "${word}". Meaning: "${meaning}". ${context ? 'Example sentence: "'+context+'".' : ''} No text in the image. Detailed, artistic, vivid colors, clean composition. IMPORTANT: Before finalizing, verify anatomical accuracy — all humans and animals must have the correct number of limbs, fingers, and facial features. Reject and redo if any body part appears duplicated, missing, or malformed.`

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size: '1024x1024', quality: 'medium' })
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || res.status) }
    const data = await res.json()
    // gpt-image-1 retorna b64_json diretamente; fallback para URL em modelos legados
    let b64
    if (data.data[0].b64_json) {
      b64 = 'data:image/png;base64,' + data.data[0].b64_json
    } else {
      const imgRes = await fetch(data.data[0].url)
      const blob = await imgRes.blob()
      b64 = await blobToBase64(blob)
    }

    await ImageDB.set(key, b64)
    if (!_imageKeyCache) _imageKeyCache = new Set()
    _imageKeyCache.add(key)
    autoSyncAfterChange()

    // Conta cards irmãos (mesmo significado)
    const siblings = srsCards.filter(c => c.wordId === card.wordId && c.meaningIdx === card.meaningIdx).length
    toast(`🖼️ Imagem gerada${siblings > 1 ? ` · aplicada a ${siblings} cards` : ''}`, 'success')

    // Atualiza visualizações ativas
    if (window._srsCurrentCard?.id === cardId) renderSrsCardBack()
    if (_browserPreviewCardId === cardId || srsCards.find(c=>c.id===_browserPreviewCardId && imageKey(c)===key)) {
      showBrowserCardPreview(_browserPreviewCardId)
    }
    if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck, el('srs-browser-search')?.value||'')
  } catch(e) {
    toast('Erro ao gerar imagem: ' + e.message, 'error')
  } finally {
    if (callerEl) { callerEl.disabled = false; callerEl.innerHTML = '🖼️ Gerar imagem' }
  }
}

// Gera imagens para os cards selecionados na biblioteca (respeita a regra de significado compartilhado)
async function browserGenerateImagesSelected() {
  if (!_browserSelected.size) return
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'warning'); return }
  const ids = [..._browserSelected]
  const cards = srsCards.filter(c => ids.includes(c.id))
  // Deduplica por chave de imagem (evita gerar a mesma imagem duas vezes)
  const seen = new Set()
  const toGenerate = cards.filter(c => { const k = imageKey(c); if (seen.has(k)) return false; seen.add(k); return true })
  toast(`🖼️ Gerando imagens para ${toGenerate.length} significado(s)...`, 'info')
  for (const card of toGenerate) await generateCardImage(card.id, null)
  await refreshImageKeyCache()
  if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck, el('srs-browser-search')?.value||'')
}

function renderSrsAllCards() {
  const area = el('srs-all-cards-area'); if (!area) return
  if (!srsCards.length) { area.innerHTML = ''; return }
  function deckNodeHtml(deckId, depth) {
    const deck = getDeckById(deckId); if (!deck) return ''
    const count = getDeckCardCount(deckId)
    const children = getDeckChildren(deckId)
    const indent = depth * 16
    let h = `<div class="srs-browser-deck" style="padding-left:${16+indent}px"
      onclick="toggleBrowserDeck('${deckId}')" id="bdk-${deckId}">
      <span class="srs-deck-toggle">${children.length ? '▾' : '·'}</span>
      <span class="srs-deck-name">${esc(deck.name)}</span>
      <span class="srs-deck-count">${count}</span>
      <span class="srs-deck-actions">
        <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();editDeckName('${deckId}')" title="Renomear">${ic('pencil','ic-sm')}</button>
        <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();addChildDeck('${deckId}')" title="Subdeck">${ic('plus','ic-sm')}</button>
        ${deckId !== 'dk-root' ? `<button class="btn btn-ghost btn-xs" style="color:var(--error)" onclick="event.stopPropagation();deleteDeckUI('${deckId}')">${ic('x','ic-sm')}</button>` : ''}
      </span></div>
    <div id="bdk-cards-${deckId}"></div>`
    children.forEach(ch => { h += deckNodeHtml(ch.id, depth + 1) }); return h
  }
  const treeHtml = getRootDecks().map(d => deckNodeHtml(d.id, 0)).join('')
  area.innerHTML = `
  <div class="card-box" style="margin-bottom:0">
    <div class="card-box-header">
      <h3>${srsCards.length} card${srsCards.length!==1?'s':''}</h3>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="text" id="srs-browser-search" placeholder="Buscar palavra ou significado..."
          oninput="filterBrowser(this.value)"
          style="padding:5px 10px;font-size:0.82rem;width:220px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);outline:none">
        <button class="btn btn-ghost btn-sm" onclick="addRootDeck()">${ic('plus')}Deck</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:220px 1fr 340px;min-height:400px">
      <div style="border-right:1px solid var(--border);overflow-y:auto;max-height:420px">
        <div id="srs-deck-tree">${treeHtml}</div>
      </div>
      <div style="display:flex;flex-direction:column;overflow:hidden;max-height:420px">
        <!-- Toolbar de seleção (aparece quando há selecionados) -->
        <div class="browser-toolbar hidden" id="browser-sel-toolbar">
          <span id="browser-sel-count" style="font-size:0.82rem;font-weight:600;color:var(--primary)"></span>
          <button class="btn btn-ghost btn-sm" onclick="browserSelectAll()">Selecionar tudo</button>
          <button class="btn btn-ghost btn-sm" onclick="browserDeselectAll()">Desmarcar tudo</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="browserDeleteSelected()">${ic('trash')}Excluir</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--primary)" onclick="browserGenerateAudioSelected()">${ic('volume')}Gerar áudio</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--purple)" onclick="browserGenerateImagesSelected()">${ic('palette')}Gerar imagens</button>
        </div>
        <!-- Header de colunas clicável -->
        <div class="browser-col-hdr" id="browser-col-hdr" style="display:none">
          <input type="checkbox" class="browser-cb" id="browser-cb-all" onchange="browserToggleAll(this.checked)" title="Selecionar tudo">
          <span style="flex:1" onclick="setBrowserSort('word')">Palavra <span id="bsort-word"></span></span>
          <span style="width:75px;text-align:center" onclick="setBrowserSort('state')">Estado <span id="bsort-state"></span></span>
          <span style="width:60px;text-align:center" onclick="setBrowserSort('due')">Prazo <span id="bsort-due"></span></span>
          <span style="width:50px;text-align:center" onclick="setBrowserSort('ease')">Ease <span id="bsort-ease"></span></span>
          <span style="width:52px"></span>
        </div>
        <div id="srs-browser-cards" style="overflow-y:auto;flex:1;min-height:0">
          <div style="padding:32px;text-align:center;color:var(--text3);font-size:0.88rem">Clique em um deck para ver os cards</div>
        </div>
      </div>
      <!-- Preview panel (3ª coluna) -->
      <div class="browser-preview-panel" id="browser-preview-panel">
        <div class="bpp-empty">Clique em um card<br>para ver o preview</div>
      </div>
    </div>
  </div>`
}


// ---- Biblioteca: aba própria + deep-links filtrados ----
let _pendingLibraryFilter = null   // { type, deckId } aplicado após render

function openBiblioteca() {
  const emptyEl = el('biblioteca-empty')
  const area = el('srs-all-cards-area')
  if (!srsCards.length) {
    if (area) area.innerHTML = ''
    if (emptyEl) emptyEl.style.display = ''
    clearLibraryFilterUI()
    return
  }
  if (emptyEl) emptyEl.style.display = 'none'
  renderSrsAllCards()
  if (_pendingLibraryFilter) {
    const f = _pendingLibraryFilter; _pendingLibraryFilter = null
    fillLibraryByState(f.type, f.deckId)
  } else {
    clearLibraryFilterUI()
  }
}

// Chamado pelos contadores do Estudar (números clicáveis)
function openLibraryFiltered(type, deckId) {
  _pendingLibraryFilter = { type, deckId: deckId || null }
  showSection('biblioteca')
}

function libraryFilterLabel(type) {
  return { new:'Novos', due:'Para revisar', learning:'Aprendendo', all:'Todos' }[type] || 'Todos'
}

function fillLibraryByState(type, deckId) {
  const now = nowTs()
  let cards = srsCards.slice()
  if (deckId) {
    const ids = [deckId, ...getAllDescendantIds(deckId)]
    cards = cards.filter(c => ids.includes(c.deckId))
  }
  if (type === 'new')           cards = cards.filter(c => c.state === 'new')
  else if (type === 'due')      cards = cards.filter(c => c.state === 'review' && c.due <= now)
  else if (type === 'learning') cards = cards.filter(c => c.state === 'learning' || c.state === 'relearning')
  const so = { review:0, relearning:1, learning:2, new:3 }
  cards.sort((a,b) => ((so[a.state]??9)-(so[b.state]??9)) || (a.word||'').localeCompare(b.word||''))
  _activeBrowserDeck = null
  _browserSelected.clear()
  _browserCurrentCards = cards
  document.querySelectorAll('.srs-browser-deck').forEach(d => d.classList.remove('active'))
  const hdr = el('browser-col-hdr'); if (hdr) hdr.style.display = cards.length ? 'flex' : 'none'
  const panel = el('srs-browser-cards')
  if (panel) {
    panel.innerHTML = cards.length
      ? cards.map(c => buildBrowserRow(c, now)).join('')
      : `<div style="padding:32px;text-align:center;color:var(--text3)">Nenhum card "${libraryFilterLabel(type)}"</div>`
  }
  updateBrowserToolbar()
  const deckName = deckId ? (getDeckById(deckId)?.name || '') : ''
  const banner = el('lib-filter-banner')
  if (banner) {
    banner.style.display = 'flex'
    banner.className = 'lib-filter-banner'
    banner.innerHTML = `<span><strong>${libraryFilterLabel(type)}</strong>${deckName ? ' · ' + esc(deckName) : ''} — ${cards.length} card${cards.length!==1?'s':''}</span>`
  }
  const clr = el('lib-filter-clear'); if (clr) clr.style.display = 'inline-flex'
}

function clearLibraryFilterUI() {
  const banner = el('lib-filter-banner'); if (banner) banner.style.display = 'none'
  const clr = el('lib-filter-clear'); if (clr) clr.style.display = 'none'
}

function clearLibraryFilter() {
  clearLibraryFilterUI()
  _pendingLibraryFilter = null
  renderSrsAllCards()
}

function toggleBrowserDeck(deckId) {
  _activeBrowserDeck = deckId
  clearLibraryFilterUI()
  _browserSelected.clear()
  document.querySelectorAll('.srs-browser-deck').forEach(d => d.classList.remove('active'))
  const bd = el('bdk-' + deckId); if (bd) bd.classList.add('active')
  const hdr = el('browser-col-hdr'); if (hdr) hdr.style.display = 'flex'
  renderBrowserCardList(deckId)
}

function refreshSortIndicators() {
  ;['word','state','due','ease'].forEach(c => {
    const s = el('bsort-' + c)
    if (!s) return
    s.textContent = _browserSort.col === c ? (_browserSort.dir === 1 ? ' ▲' : ' ▼') : ''
    s.className   = _browserSort.col === c ? 'sort-active' : ''
  })
}

function setBrowserSort(col) {
  if (_browserSort.col === col) _browserSort.dir *= -1
  else { _browserSort.col = col; _browserSort.dir = 1 }
  refreshSortIndicators()
  if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck, el('srs-browser-search')?.value || '')
}

function browserToggleAll(checked) {
  _browserCurrentCards.forEach(c => {
    if (checked) _browserSelected.add(c.id)
    else _browserSelected.delete(c.id)
  })
  updateBrowserToolbar()
  // Re-render to update row highlights
  document.querySelectorAll('.srs-browser-row').forEach(row => {
    const id = row.dataset.id
    if (id) row.classList.toggle('selected', _browserSelected.has(id))
    const cb = row.querySelector('.browser-cb')
    if (cb) cb.checked = _browserSelected.has(id)
  })
}

function browserToggleCard(cardId, checked) {
  if (checked) _browserSelected.add(cardId)
  else _browserSelected.delete(cardId)
  updateBrowserToolbar()
  const cbAll = el('browser-cb-all')
  if (cbAll) cbAll.checked = _browserCurrentCards.length > 0 && _browserSelected.size === _browserCurrentCards.length
  const row = document.querySelector(`.srs-browser-row[data-id="${cardId}"]`)
  if (row) row.classList.toggle('selected', checked)
}

function browserSelectAll()   { browserToggleAll(true)  }
function browserDeselectAll() { browserToggleAll(false) }

function updateBrowserToolbar() {
  const toolbar = el('browser-sel-toolbar'); if (!toolbar) return
  const n = _browserSelected.size
  toolbar.classList.toggle('hidden', n === 0)
  const countEl = el('browser-sel-count')
  if (countEl) countEl.textContent = n + ' selecionado' + (n !== 1 ? 's' : '')
}

async function browserDeleteSelected() {
  if (!_browserSelected.size) return
  if (!confirm(`Excluir ${_browserSelected.size} card(s)?`)) return
  srsCards = srsCards.filter(c => !_browserSelected.has(c.id))
  _browserSelected.clear()
  saveSrsCards(); autoSyncAfterChange()
  updateBrowserToolbar()
  if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck)
  renderSrsSection()
  toast('Cards excluídos', 'info')
}

async function browserGenerateAudioSelected() {
  if (!_browserSelected.size) return
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'warning'); return }
  const ids = [..._browserSelected]
  const cards = srsCards.filter(c => ids.includes(c.id))
  toast(`🎵 Gerando áudio para ${cards.length} card(s)...`, 'info')
  let generated = 0
  const textsToGenerate = new Set()
  for (const card of cards) {
    if (card.example_en) textsToGenerate.add(card.example_en)  // frase
    if (card.word)       textsToGenerate.add(card.word)         // palavra isolada
  }
  for (const text of textsToGenerate) {
    const exists = await AudioDB.get(audioKey(text))
    if (exists) continue
    const result = await ensureSrsAudio(text)
    if (result) generated++
  }
  await refreshAudioKeyCache()
  if (generated > 0) {
    autoSyncAfterChange()
    toast(`✅ Áudio gerado para ${generated} card(s)`, 'success')
    if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck)
  } else {
    toast('Todos os cards selecionados já têm áudio', 'info')
  }
}

const BROWSER_PAGE_SIZE = 80

function buildBrowserRow(c, now) {
  const SC = {new:'var(--success)', learning:'var(--warning)', review:'var(--primary)', relearning:'var(--error)'}
  const SL = {new:'Novo', learning:'Aprendendo', review:'Revisão', relearning:'Reaprendendo'}
  const dueTxt = c.due <= now ? `<span style="color:var(--primary)">Agora</span>` : fmtDays(Math.round((c.due-now)/86400000))
  const isSel  = _browserSelected.has(c.id)
  return `<div class="srs-browser-row${isSel?' selected':''}" data-id="${c.id}" onclick="showBrowserCardPreview('${c.id}')">
    <input type="checkbox" class="browser-cb" ${isSel?'checked':''} onchange="event.stopPropagation();browserToggleCard('${c.id}',this.checked)">
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:0.88rem">${esc(c.word)}</div>
      <div style="font-size:0.78rem;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.meaning_pt||'')}</div>
    </div>
    <span style="font-size:0.72rem;color:${SC[c.state]};font-weight:600;white-space:nowrap;width:75px;text-align:center">${SL[c.state]}</span>
    <span style="font-size:0.72rem;color:var(--text3);white-space:nowrap;width:60px;text-align:center">${dueTxt}</span>
    <span style="font-size:0.72rem;color:var(--text3);white-space:nowrap;width:50px;text-align:center">ease ${c.ease.toFixed(1)}</span>
    <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();moveSrsCardDeck('${c.id}')" title="Mover">${ic('folder','ic-sm')}</button>
    <button class="btn btn-ghost btn-xs" style="color:var(--error)" onclick="event.stopPropagation();deleteSrsCard('${c.id}')">${ic('x','ic-sm')}</button>
  </div>`
}

let _browserRenderedCount = 0

async function renderBrowserCardList(deckId, query) {
  const panel = el('srs-browser-cards'); if (!panel) return
  panel.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text3);font-size:0.85rem">Carregando...</div>`
  const allIds = [deckId, ...getAllDescendantIds(deckId)]
  // Query indexada por deckId — não filtra o array inteiro em memória
  let cards = await CardsDB.getByDecks(allIds)
  if (query) { const q = query.toLowerCase(); cards = cards.filter(c => (c.word||'').toLowerCase().includes(q) || (c.meaning_pt||'').toLowerCase().includes(q)) }
  if (!cards.length) { panel.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text3)">Nenhum card neste deck</div>`; return }

  const sortFns = {
    word:  (a,b) => (a.word||'').localeCompare(b.word||'') * _browserSort.dir,
    state: (a,b) => { const so={review:0,relearning:1,learning:2,new:3}; return ((so[a.state]??9)-(so[b.state]??9)) * _browserSort.dir },
    due:   (a,b) => (a.due - b.due) * _browserSort.dir,
    ease:  (a,b) => (a.ease - b.ease) * _browserSort.dir
  }
  cards.sort(sortFns[_browserSort.col] || sortFns.state)
  _browserCurrentCards = cards
  _browserRenderedCount = Math.min(BROWSER_PAGE_SIZE, cards.length)
  refreshSortIndicators()

  const now = nowTs()
  const visible = cards.slice(0, _browserRenderedCount)
  const hasMore = cards.length > _browserRenderedCount

  panel.innerHTML = visible.map(c => buildBrowserRow(c, now)).join('') +
    (hasMore ? `<div id="browser-load-more" style="padding:12px;text-align:center">
      <button class="btn btn-ghost btn-sm" onclick="browserLoadMore()">Carregar mais (${cards.length - _browserRenderedCount} restantes)</button>
    </div>` : '')

  const cbAll = el('browser-cb-all')
  if (cbAll) cbAll.checked = cards.length > 0 && _browserSelected.size === cards.length
  updateBrowserToolbar()
}

function browserLoadMore() {
  const panel = el('srs-browser-cards'); if (!panel) return
  const cards = _browserCurrentCards; if (!cards) return
  const now = nowTs()
  const next = Math.min(_browserRenderedCount + BROWSER_PAGE_SIZE, cards.length)
  const newRows = cards.slice(_browserRenderedCount, next).map(c => buildBrowserRow(c, now)).join('')
  const btn = el('browser-load-more')
  if (btn) btn.outerHTML = newRows + (next < cards.length
    ? `<div id="browser-load-more" style="padding:12px;text-align:center">
        <button class="btn btn-ghost btn-sm" onclick="browserLoadMore()">Carregar mais (${cards.length - next} restantes)</button>
      </div>` : '')
  _browserRenderedCount = next
}

async function filterBrowser(query) {
  const hdr = el('browser-col-hdr')
  if (_activeBrowserDeck) { await renderBrowserCardList(_activeBrowserDeck, query); return }
  if (hdr) hdr.style.display = query ? 'flex' : 'none'
  const panel = el('srs-browser-cards'); if (!panel) return
  if (!query) {
    panel.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text3)">Clique num deck ou busque acima</div>`
    return
  }
  if (!_audioKeyCache) await refreshAudioKeyCache()
  const q = query.toLowerCase()
  const SC = {new:'var(--success)', learning:'var(--warning)', review:'var(--primary)', relearning:'var(--error)'}
  const SL = {new:'Novo', learning:'Aprendendo', review:'Revisão', relearning:'Reaprendendo'}
  const cards = srsCards.filter(c => (c.word||'').toLowerCase().includes(q) || (c.meaning_pt||'').toLowerCase().includes(q))
  _browserCurrentCards = cards
  if (!cards.length) { panel.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text3)">Nenhum resultado</div>`; return }
  panel.innerHTML = cards.map(c => {
    const hasAudio = _audioKeyCache.has(audioKey(c.example_en || c.word || ''))
    const isSel = _browserSelected.has(c.id)
    return `<div class="srs-browser-row${isSel?' selected':''}" data-id="${c.id}">
      <input type="checkbox" class="browser-cb" ${isSel?'checked':''} onchange="browserToggleCard('${c.id}',this.checked)">
      <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:0.88rem">${esc(c.word)}</div>
      <div style="font-size:0.78rem;color:var(--text2)">${esc(c.meaning_pt||'')}</div></div>
      <span style="font-size:0.72rem;color:${SC[c.state]};font-weight:600;margin-right:8px">${SL[c.state]}</span>
      <span style="margin-right:4px">${hasAudio?'<span class="audio-badge-ok">'+ic('volume','ic-sm')+'</span>':'<span class="audio-badge-no">'+ic('alert','ic-sm')+'</span>'}</span>
      <button class="btn btn-ghost btn-xs" style="color:var(--error)" onclick="event.stopPropagation();deleteSrsCard('${c.id}')">${ic('x','ic-sm')}</button>
    </div>`
  }).join('')
  updateBrowserToolbar()
}
function deleteSrsCard(cardId) {
  if (!confirm('Excluir este card?')) return
  srsCards = srsCards.filter(c => c.id !== cardId)
  _browserSelected.delete(cardId)
  saveSrsCards(); autoSyncAfterChange()
  if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck)
  renderSrsSection(); toast('Card excluído','info')
}
function moveSrsCardDeck(cardId) {
  const card = srsCards.find(c => c.id === cardId); if (!card) return
  const modal = document.createElement('div')
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6)'
  modal.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;width:320px;box-shadow:var(--shadow)">
    <h4 style="margin-bottom:12px">Mover card para deck</h4>
    <select id="move-deck-sel" style="width:100%;margin-bottom:16px;padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)"></select>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" onclick="this.closest('[style]').remove()">Cancelar</button>
      <button class="btn btn-primary btn-sm" onclick="confirmMoveDeck('${cardId}',document.getElementById('move-deck-sel').value);this.closest('[style]').remove()">Mover</button>
    </div></div>`
  document.body.appendChild(modal)
  populateDeckSelect(document.getElementById('move-deck-sel'), card.deckId)
}
function confirmMoveDeck(cardId, newDeckId) {
  const card = srsCards.find(c => c.id === cardId)
  if (card && newDeckId) { card.deckId = newDeckId; saveSrsCards(); autoSyncAfterChange() }
  if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck); renderSrsSection()
}
let _browserPreviewCardId = null
async function showBrowserCardPreview(cardId) {
  _browserPreviewCardId = cardId
  const panel = el('browser-preview-panel'); if (!panel) return
  const card = srsCards.find(c => c.id === cardId)
  if (!card) { panel.innerHTML = '<div class="bpp-empty">Card não encontrado</div>'; return }

  // Highlight selected row — sem tocar todos os elementos
  document.querySelector(`.srs-browser-row.preview-active`)?.classList.remove('preview-active')
  document.querySelector(`.srs-browser-row[data-id="${cardId}"]`)?.classList.add('preview-active')

  const imgData = await ImageDB.get(imageKey(card))
  const frente  = buildSrsFrente(card)
  const verso   = buildSrsVerso(card, imgData)

  const SC = {new:'var(--success)', learning:'var(--warning)', review:'var(--primary)', relearning:'var(--error)'}
  const SL = {new:'Novo', learning:'Aprendendo', review:'Revisão', relearning:'Reaprendendo'}

  panel.innerHTML = `
    <div>
      <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:6px">
        <span style="color:${SC[card.state]}">${SL[card.state]}</span>
        · ease ${card.ease.toFixed(1)}
      </div>
      ${buildMetaChips(card)}
      <div class="bpp-card-front">
        <div class="bpp-label">Frente</div>
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px">${esc(card.word)}</div>
        ${frente ? `<div style="font-size:0.85rem;color:var(--text2)">${frente}</div>` : ''}
        <button class="btn btn-ghost btn-xs" style="margin-top:8px"
          onclick="playSrsTTS('${(card.example_en||card.word||'').replace(/'/g,"\'")}')">${ic('volume','ic-sm')}</button>
      </div>
      <div class="bpp-card-back" style="margin-top:10px">
        <div class="bpp-label">Verso</div>
        <div class="srs-card-back-body" style="font-size:0.88rem">${verso}</div>
      </div>
    </div>`
}

function addRootDeck()        { const n = prompt('Nome do novo deck:'); if (n) { addDeck(n, null); renderSrsAllCards() } }
function addChildDeck(pid)    { const n = prompt('Nome do subdeck:');   if (n) { addDeck(n, pid);  renderSrsAllCards() } }
function editDeckName(deckId) {
  const d = getDeckById(deckId); if (!d) return
  const n = prompt('Novo nome:', d.name); if (n && n.trim()) { renameDeck(deckId, n); renderSrsAllCards() }
}
function deleteDeckUI(deckId) {
  const d = getDeckById(deckId); if (!d) return
  const cnt = getDeckCardCount(deckId)
  const msg = cnt > 0 ? `Excluir "${d.name}"? Os ${cnt} cards serão movidos para o deck pai.` : `Excluir "${d.name}"?`
  if (!confirm(msg)) return
  deleteDeck(deckId); renderSrsAllCards(); renderSrsSection()
}

