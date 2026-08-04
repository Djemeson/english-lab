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

// Vozes da OpenAI TTS (usado por ensureSrsAudio — fica aqui, arquivo não-lazy)
const OPENAI_VOICES = ['alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer']
function randomVoice() {
  return OPENAI_VOICES[Math.floor(Math.random() * OPENAI_VOICES.length)]
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
    const b64 = await aiTTS(text)
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
  if (label) label.textContent = `${done} / ${total}${saved ? ` · ${saved} salvos` : ''}`
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
      : `${generated}/${total} áudio${generated!==1?'s':''} gerados e salvos`,
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

// fetchAudioBase64 removida (2026-07-31): nenhum chamador — código morto.


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

// Descreve a CENA antes de desenhar.
//
// Por que existe (2026-07-31): o prompt mandava a palavra estrangeira em
// destaque e o significado em PORTUGUÊS para um modelo de imagem que só
// entende cena. Resultado: ele ancorava no sentido MAIS COMUM da palavra e
// ignorava o sentido do card. O caso que expôs isso foi "tally" — o card era
// o sentido 2 ("bater, concordar com"), e as duas tentativas desenharam
// marcas de contagem (o sentido 1), ainda por cima com marcas na imagem,
// violando o "no text".
//
// A correção é dar ao modelo de imagem só o que ele sabe usar: uma cena
// concreta em inglês. Um modelo de texto barato (~US$ 0,001 = 2% do custo
// da imagem) traduz o sentido em cena, recebendo os OUTROS sentidos da
// mesma palavra como lista de proibições. A palavra em si não vai para o
// modelo de imagem — é justamente ela que puxava para o sentido errado.
async function buildImageScene(card) {
  const w = words.find(x => x.id === card.wordId)
  const sense = w?.meanings?.[card.meaningIdx] || {}
  const significado = card.meaning_pt || sense.meaning_pt || ''
  const definicao   = sense.definition_pt || card.definition_pt || ''
  const frase       = (card.example_en || '').replace(/<[^>]*>/g, '')
  const outros = (w?.meanings || [])
    .map((m, i) => i === card.meaningIdx ? null : (m.meaning_pt || '').trim())
    .filter(Boolean)

  const r = await aiJSON([
    { role: 'system', content: 'Você descreve cenas para ilustrações de flashcards de vocabulário. Responda sempre em JSON.' },
    { role: 'user', content:
`Palavra (${promptLangName(cardLang(card))}): "${card.word}"
Sentido a ilustrar (PT-BR): "${significado}"${definicao ? '\nDefinição: ' + definicao : ''}
Frase de exemplo: "${frase}"
${outros.length ? 'OUTROS sentidos da MESMA palavra, que NÃO podem aparecer na cena: ' + outros.map(o => `"${o}"`).join(', ') : ''}

Descreva UMA cena concreta, em INGLÊS, que faça alguém entender ESSE sentido só de olhar.
Regras:
- Mostre o sentido acontecendo, não a palavra. Nada de texto, letras, números, símbolos, marcas de contagem, placas ou legendas.
- Se a palavra tiver outros sentidos, a cena precisa ser INCOMPATÍVEL com eles.
- Sentido abstrato vira situação humana concreta (gesto, reação, comparação entre duas coisas).
- Pessoas e animais anatomicamente corretos.
- 1 a 3 frases, sem nomear a palavra.
Responda: {"scene": "..."}` }
  ], { maxTokens: 300 })

  const s = (r.scene || '').trim()
  return s.length > 15 ? s : ''
}

// Gera imagem via DALL-E 3 para o significado do card
// Propaga automaticamente para todos os cards que compartilham o mesmo significado
// force=true (botão individual) regenera por cima; force=false (lote) pula
// quem já tem imagem — antes o lote re-gerava e re-PAGAVA imagens existentes.
async function generateCardImage(cardId, callerEl, force = true) {
  if (!aiImgKey()) { toast(`Configure a chave da ${AI_IMG[aiImgProvider()].nome} para gerar imagens (Configurações → IA)`, 'warning'); return }
  const card = srsCards.find(c => c.id === cardId)
  if (!card) return

  const key = imageKey(card)
  if (!force && await ImageDB.get(key)) return 'skip'

  // Spinner no botão chamador
  if (callerEl) { callerEl.disabled = true; callerEl.innerHTML = '<span class="gen-spinner"></span> Gerando...' }

  // Sem "verify before finalizing / reject and redo": modelo de imagem não
  // itera sobre a própria saída — instrução impossível só gastava prompt.
  // Restrições anatômicas valem como descrição POSITIVA da cena.
  const PROIBIDO = 'No text, letters, numbers, symbols, tally marks, signs or captions anywhere in the image.'
  const ESTILO   = 'Anatomically correct people and animals. Detailed, artistic, vivid colors, clean composition.'

  let scene = ''
  try {
    if (callerEl) callerEl.innerHTML = '<span class="gen-spinner"></span> Descrevendo...'
    scene = await buildImageScene(card)
  } catch (e) {
    console.warn('[imagem] cena não descrita, usando prompt direto:', e.message)
  }
  if (callerEl) callerEl.innerHTML = '<span class="gen-spinner"></span> Gerando...'

  // Fallback (a descrição falhou): prompt antigo, com a palavra — pior para
  // palavras polissêmicas, mas melhor que não gerar nada.
  const word    = card.word || ''
  const meaning = card.meaning_pt || card.definition_pt || ''
  const context = (card.example_en || '').replace(/<[^>]*>/g, '')
  const prompt = scene
    ? `Digital illustration, editorial style. ${scene} ${PROIBIDO} ${ESTILO}`
    : `Digital illustration, editorial style. ${promptLangName(cardLang(card))} vocabulary flashcard image for the word "${word}". Meaning: "${meaning}". ${context ? 'Example sentence: "' + context + '".' : ''} ${PROIBIDO} ${ESTILO}`

  try {
    const b64 = await aiImage(prompt)
    await ImageDB.set(key, b64)
    if (!_imageKeyCache) _imageKeyCache = new Set()
    _imageKeyCache.add(key)
    autoSyncAfterChange()

    // Conta cards irmãos (mesmo significado)
    const siblings = srsCards.filter(c => c.wordId === card.wordId && c.meaningIdx === card.meaningIdx).length
    toast(`Imagem gerada${siblings > 1 ? ` · aplicada a ${siblings} cards` : ''}`, 'success')

    // Atualiza visualizações ativas
    if (window._srsCurrentCard?.id === cardId) renderSrsCardBack()
    if (_browserPreviewCardId === cardId || srsCards.find(c=>c.id===_browserPreviewCardId && imageKey(c)===key)) {
      showBrowserCardPreview(_browserPreviewCardId)
    }
    if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck, el('srs-browser-search')?.value||'')
  } catch(e) {
    toast('Erro ao gerar imagem: ' + e.message, 'error')
  } finally {
    if (callerEl) { callerEl.disabled = false; callerEl.innerHTML = ic('image','ic-sm') + ' Gerar imagem' }
  }
}

// Gera imagens para os cards selecionados na biblioteca (respeita a regra de significado compartilhado)
async function browserGenerateImagesSelected() {
  if (!_browserSelected.size) return
  if (!aiImgKey()) { toast(`Configure a chave da ${AI_IMG[aiImgProvider()].nome} para gerar imagens (Configurações → IA)`, 'warning'); return }
  const ids = [..._browserSelected]
  const cards = srsCards.filter(c => ids.includes(c.id))
  // Deduplica por chave de imagem (evita gerar a mesma imagem duas vezes)
  const seen = new Set()
  const toGenerate = cards.filter(c => { const k = imageKey(c); if (seen.has(k)) return false; seen.add(k); return true })
  if (!(await aiConfirmBatch('image', toGenerate.length, 'Gerar imagens'))) return
  toast(`Gerando imagens para ${toGenerate.length} significado(s)...`, 'info')
  let feitos = 0, pulados = 0
  for (const card of toGenerate) {
    const r = await generateCardImage(card.id, null, false)
    if (r === 'skip') pulados++; else feitos++
  }
  if (pulados) toast(`${feitos} gerada${feitos!==1?'s':''} · ${pulados} já existia${pulados!==1?'m':''} (não re-cobradas)`, 'info')
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
          style="padding:5px 10px;font-size:var(--fs-sm);width:220px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);outline:none">
        <button class="btn btn-ghost btn-sm" onclick="addRootDeck()" data-tip="Criar um novo baralho na raiz">${ic('plus')}Deck</button>
      </div>
    </div>
    <div class="srs-browser-grid">
      <div class="srs-browser-decks">
        <div id="srs-deck-tree">${treeHtml}</div>
      </div>
      <div class="srs-browser-main">
        <!-- Toolbar de seleção (aparece quando há selecionados) -->
        <div class="browser-toolbar hidden" id="browser-sel-toolbar">
          <span id="browser-sel-count" style="font-size:var(--fs-sm);font-weight:600;color:var(--primary)"></span>
          <button class="btn btn-ghost btn-sm" onclick="browserSelectAll()">Selecionar tudo</button>
          <button class="btn btn-ghost btn-sm" onclick="browserDeselectAll()">Desmarcar tudo</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="browserDeleteSelected()" data-tip="Excluir os cards selecionados">${ic('trash')}Excluir</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--primary)" onclick="browserGenerateAudioSelected()" data-tip="Gerar áudio (TTS) para os cards selecionados">${ic('volume')}Gerar áudio</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--purple)" onclick="browserGenerateImagesSelected()" data-tip="Gerar imagens ilustrativas com IA para os significados">${ic('palette')}Gerar imagens</button>
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
        <div id="srs-browser-cards" class="srs-browser-cardlist">
          <div style="padding:32px;text-align:center;color:var(--text3);font-size:var(--fs-md)">Clique em um deck para ver os cards</div>
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
let _libMode = 'cards'             // 'cards' (browser por baralho) | 'words' (glossário)
let _pendingGlossFocus = null      // wordId para destacar ao abrir o glossário
let _glossSearchFocused = false    // true enquanto o usuário digita na busca do glossário
let _libLang = 'all'               // filtro de idioma do glossário ('all' = todos)

// Idiomas realmente presentes no estudo, com a contagem de palavras de cada um.
// Deriva de srsCards — nenhum estado novo persistido.
function libLangCounts() {
  const porIdioma = new Map()
  const vistos = new Set()
  for (const c of srsCards) {
    const chave = c.wordId + '|' + cardLang(c)
    if (vistos.has(chave)) continue
    vistos.add(chave)
    const l = cardLang(c)
    porIdioma.set(l, (porIdioma.get(l) || 0) + 1)
  }
  return [...porIdioma.entries()]
    .map(([code, n]) => ({ code, n, nome: getLangDef(code).name }))
    .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, 'pt-BR'))
}

// Só faz sentido oferecer o filtro quando há mais de um idioma em estudo —
// no modo Cards ele nem aparece, porque lá os baralhos (dk-root-<código>) já
// separam os idiomas na própria árvore.
function libLangChipsHtml() {
  const idiomas = libLangCounts()
  if (idiomas.length < 2) return ''
  const total = idiomas.reduce((s, i) => s + i.n, 0)
  const chip = (code, rotulo, n) => `<button class="gloss-lang-chip${_libLang === code ? ' active' : ''}"
    onclick="setLibLang('${code}')">${esc(rotulo)}<span class="glc-n">${n}</span></button>`
  return `<div class="gloss-lang-filter" role="group" aria-label="Filtrar por idioma">
    ${chip('all', 'Todos', total)}${idiomas.map(i => chip(i.code, i.nome, i.n)).join('')}
  </div>`
}

function setLibLang(code) {
  if (_libLang === code) return
  _libLang = code
  _glossSearchFocused = false
  renderWordsGlossary()
}

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
  _glossSearchFocused = false
  _applyLibModeUI()
  if (_libMode === 'words') {
    clearLibraryFilterUI()
    renderWordsGlossary()
    return
  }
  renderSrsAllCards()
  if (_pendingLibraryFilter) {
    const f = _pendingLibraryFilter; _pendingLibraryFilter = null
    fillLibraryByState(f.type, f.deckId)
  } else {
    clearLibraryFilterUI()
  }
}

// Sincroniza o estado visual do toggle Cards|Palavras e oculta os botões
// específicos de cards (reanalisar/origem) no modo glossário.
function _applyLibModeUI() {
  document.querySelectorAll('#lib-mode-toggle .lmt-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === _libMode))
  const wordsMode = _libMode === 'words'
  // Botões só fazem sentido no modo Cards — sumem no glossário e voltam nos Cards
  // As operações de manutenção vivem num menu — esconde o gatilho inteiro
  const mb = el('lib-maint-btn'); if (mb) mb.style.display = wordsMode ? 'none' : ''
  toggleLibMaint(null, true)
  // O "Limpar filtro" tem lógica própria; no glossário fica sempre oculto
  if (wordsMode) { const fc = el('lib-filter-clear'); if (fc) fc.style.display = 'none' }
}

function setLibMode(mode) {
  if (_libMode === mode) return
  _libMode = mode
  openBiblioteca()
}

// Abre o glossário (modo Palavras) já focado num termo específico.
function openWordGlossary(wordId) {
  _libMode = 'words'
  _pendingGlossFocus = wordId || null
  showSection('biblioteca')
}

// ---- Glossário: cada objeto de estudo UMA vez, com todos os seus sentidos ----
function renderWordsGlossary(query) {
  const area = el('srs-all-cards-area'); if (!area) return
  const q = (query != null ? query : (el('gloss-search')?.value || '')).toLowerCase().trim()

  // Agrupa por palavra → sentidos (meaningIdx) → exemplos (deduplicados)
  const byWord = new Map()
  for (const c of srsCards) {
    let g = byWord.get(c.wordId)
    if (!g) {
      g = { wordId: c.wordId, word: c.word || '', ipa: c.ipa || '', type: c.type || '',
            type_label: c.type_label || '', lang: cardLang(c),
            source_type: c.source_type || '', senses: new Map() }
      byWord.set(c.wordId, g)
    }
    let s = g.senses.get(c.meaningIdx)
    if (!s) {
      s = { idx: c.meaningIdx, meaning_pt: c.meaning_pt || '', definition_pt: c.definition_pt || '',
            origin_pt: c.origin_pt || '', variety: c.variety, register: c.register, examples: [], _seen: new Set() }
      g.senses.set(c.meaningIdx, s)
    }
    if (c.example_en && !s._seen.has(c.example_en)) {
      s._seen.add(c.example_en)
      s.examples.push({ en: c.example_en, pt: c.example_pt || '' })
    }
  }

  let groups = [...byWord.values()].sort((a, b) =>
    (a.word || '').localeCompare(b.word || '', 'en', { sensitivity: 'base' }))

  // Filtro de idioma ANTES da contagem: os totais no topo devem refletir o
  // escopo escolhido. A busca, que é passageira, não mexe nesses números.
  if (_libLang !== 'all') groups = groups.filter(g => g.lang === _libLang)

  const totalWords = groups.length
  const totalSenses = groups.reduce((n, g) => n + g.senses.size, 0)

  if (q) {
    groups = groups.filter(g => (g.word || '').toLowerCase().includes(q) ||
      [...g.senses.values()].some(s =>
        (s.meaning_pt || '').toLowerCase().includes(q) || (s.definition_pt || '').toLowerCase().includes(q)))
  }

  const cards = groups.map(g => glossWordHtml(g, {
    word: 'vocabulário',
    phrasal_verb: typeLabel('phrasal_verb', g.lang, g.type_label),
    idiom: typeLabel('idiom', g.lang),
    collocation: 'collocation'
  })).join('')

  area.innerHTML = `
  <div class="card-box gloss-box" style="margin-bottom:0">
    <div class="card-box-header gloss-header">
      <div class="gloss-head-info">
        <h3>${totalWords} palavra${totalWords !== 1 ? 's' : ''}</h3>
        <span class="gloss-head-sub">${totalSenses} sentido${totalSenses !== 1 ? 's' : ''} em estudo${
          _libLang !== 'all' ? ' · ' + esc(getLangDef(_libLang).name) : ''}</span>
      </div>
      ${libLangChipsHtml()}
      <input type="text" id="gloss-search" placeholder="Buscar palavra ou significado..."
        value="${escA(q)}" oninput="renderWordsGlossaryDebounced(this.value)"
        class="gloss-search-input">
    </div>
    <div class="gloss-list">
      ${cards || `<div style="padding:40px;text-align:center;color:var(--text3)">Nenhuma palavra encontrada${q ? ' para "' + esc(q) + '"' : ''}.</div>`}
    </div>
  </div>`

  // Mantém o foco do input após o re-render da busca (só quando o usuário está buscando)
  if (_glossSearchFocused) { const inp = el('gloss-search'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length) } }

  // Destaca/rola até o termo focado (vindo do chip "sentido X de Y")
  if (_pendingGlossFocus) {
    const wid = _pendingGlossFocus; _pendingGlossFocus = null
    requestAnimationFrame(() => {
      const node = el('gloss-w-' + wid)
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' })
        node.classList.add('gloss-flash')
        setTimeout(() => node.classList.remove('gloss-flash'), 1800)
      }
    })
  }
}

let _glossDebounce = null
function renderWordsGlossaryDebounced(v) {
  _glossSearchFocused = true
  clearTimeout(_glossDebounce)
  _glossDebounce = setTimeout(() => renderWordsGlossary(v), 160)
}

function glossWordHtml(g, TYPE) {
  const senses = [...g.senses.values()].sort((a, b) => a.idx - b.idx)
  const typeLabel = TYPE[g.type] || ''
  const sensesHtml = senses.map((s, i) => {
    // Renderizadores em js/lang.js (não-lazy) — este arquivo não pode depender
    // do study.js, que só carrega ao abrir Estudar/Biblioteca.
    const chips = varietyChip(s.variety, g.lang) + registerChip(s.register)
    const ex = s.examples[0]
    const exHtml = ex ? `<div class="gloss-ex">
        <span class="gloss-ex-en">${buildSrsFrente({ example_en: ex.en, word: g.word })}</span>
        ${ex.pt ? `<span class="gloss-ex-pt">${escB(ex.pt)}</span>` : ''}
      </div>` : ''
    const originHtml = s.origin_pt ? `<div class="gloss-origin">${ic('sparkles', 'ic-sm')} ${esc(String(s.origin_pt).replace(/<[^>]*>/g, ''))}</div>` : ''
    return `<div class="gloss-sense">
      <span class="gloss-sense-no">${i + 1}</span>
      <div class="gloss-sense-body">
        <div class="gloss-sense-meaning">${esc(s.meaning_pt || '—')}</div>
        ${s.definition_pt ? `<div class="gloss-sense-def">${esc(String(s.definition_pt).replace(/<[^>]*>/g, ''))}</div>` : ''}
        ${chips ? `<div class="gloss-sense-chips">${chips}</div>` : ''}
        ${exHtml}
        ${originHtml}
      </div>
    </div>`
  }).join('')

  return `<div class="gloss-word" id="gloss-w-${g.wordId}">
    <div class="gloss-word-head">
      <div class="gloss-word-title">
        <span class="gloss-word-en">${esc(g.word)}</span>
        ${g.ipa ? `<span class="gloss-word-ipa">${esc(g.ipa)}</span>` : ''}
        <button class="btn btn-ghost btn-xs gloss-word-audio" title="Ouvir"
          onclick="playSrsTTS('${escA(g.word).replace(/'/g, "\\'")}')">${ic('volume', 'ic-sm')}</button>
      </div>
      <div class="gloss-word-meta">
        ${typeLabel ? `<span class="gloss-type-chip">${typeLabel}</span>` : ''}
        <span class="gloss-count-chip">${ic('layers', 'ic-sm')} ${senses.length} sentido${senses.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
    <div class="gloss-senses">${sensesHtml}</div>
  </div>`
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

// ---- Reprocessar variedade/registro em massa (IA) ----
const _REGISTERS = ['neutral','formal','informal','colloquial','slang','technical','literary','archaic','vulgar']
// Multi-idioma: valida a variedade contra a lista do idioma do item (LANGS)
function _normVariety(v, langCode) {
  v = String(v||'').toLowerCase().trim()
  const ok = getLangDef(langCode || 'en').varieties.map(x => x.v)
  return ok.includes(v) ? v : (v && !LANGS[(langCode||'en')] ? v : 'general')
}
function _normRegister(r) { r = String(r||'').toLowerCase().trim(); return _REGISTERS.includes(r) ? r : 'neutral' }

async function classifyMetaBatch(items) {
  const langs = [...new Set(items.map(it => it.lang || 'en'))]
  const varietyRules = langs.map(lc => `- ${promptLangName(lc)} ("lang":"${lc}"): variety is one of ${promptVarietyEnum(lc)}. ${getLangDef(lc).varietyRule}`).join('\n')
  const PROMPT = `Classify each vocabulary item by VARIETY and REGISTER. Each item has a "lang" (ISO code of its language). Return ONLY valid JSON.
- variety: "general" (standard across all varieties of that language — this is the case for MOST words) OR a specific variety of the item's language:
${varietyRules}
- register: exactly one of "neutral","formal","informal","colloquial","slang","technical","literary","archaic","vulgar". Use "neutral" for everyday standard words.
Always fill BOTH for every item. Match each result to the item "id".
Return: {"results":[{"id":0,"variety":"general","register":"neutral"}]}
Items: ${JSON.stringify(items)}`
  const parsed = await aiJSON(PROMPT, { model: AI_DEFAULT_MODEL, maxTokens: 2200 })
  return Array.isArray(parsed.results) ? parsed.results : []
}

// Executa tarefas async com concorrência limitada (acelera sem estourar rate limit)
async function runPool(tasks, concurrency, onProgress) {
  let idx = 0, done = 0
  const worker = async () => {
    while (idx < tasks.length) {
      const my = idx++
      try { await tasks[my]() } catch (e) { /* tarefa já trata */ }
      done++; if (onProgress) onProgress(done)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
}

// Reanalisa UM significado: gera frases que batem com o sentido + variedade + registro
async function regenerateMeaning(it) {
  const n = Math.max(1, Math.min(it.cards.length, 6))
  const _rL = getLangDef(it.lang || 'en')
  const PROMPT = `You are fixing flashcards for a Brazilian learner of ${_rL.nameEn}. Return ONLY valid JSON.
Word/expression (${_rL.nameEn}): "${it.word}"${it.type ? ` (type: ${it.type})` : ''}
This SPECIFIC meaning (in Portuguese): "${it.meaning_pt || '(use the most common sense)'}"
${it.definition_pt ? `Definition of this sense: "${it.definition_pt}"` : ''}

Generate ${n} example sentence(s) that ALL clearly illustrate THIS specific meaning of "${it.word}" — never any other sense. Also classify variety and register for THIS sense.

Return ONLY this JSON:
{
  "variety": "${promptVarietyEnum(it.lang || 'en')}",
  "register": "neutral|formal|informal|colloquial|slang|technical|literary|archaic|vulgar",
  "origin_pt": "Brazilian-Portuguese note (1-2 sentences) explaining the ORIGIN / why this expression came to mean this. Fill ONLY for idioms, multi-word verbal expressions, metaphors and words with a genuinely interesting or non-obvious etymology (e.g. 'sitting duck', 'on the chopping block', 'flagship', 'throw under the bus'). Leave it as an EMPTY STRING for ordinary words with no notable story. NEVER invent folk etymology — if unsure, leave empty.",
  "examples": [
    {"en": "Natural ${_rL.nameEn} sentence using <b>${it.word}</b> (inflected as needed) in THIS sense.", "pt": "Tradução natural em PT-BR com o <b>equivalente</b> em negrito."}
  ]
}
Rules — follow exactly:
- Return EXACTLY ${n} example object(s).
- Every example MUST match the meaning "${it.meaning_pt}". If "${it.word}" has other senses, IGNORE them — an example must not make sense under a different meaning.
- The Portuguese bold in every example MUST be interchangeable with "${it.meaning_pt}" in that sentence — never a word from a different sense.
- Each example: a different subject and a different real-world situation; natural like a novel/news/conversation, never formulaic.
- Tense order when generating 3 or more: #1 PRESENT, #2 PAST, #3 a construction where the word CHANGES FORM the most (continuous/future/conditional/passive) — the learner must see the word inflected differently in each.
- Rules for bold — CRITICAL, on BOTH sides of every example:
  - ${_rL.nameEn}: wrap the target in <b></b> exactly as it appears conjugated/inflected in that sentence (e.g. "ran" for "run"). For a multi-word or separable expression wrap ALL its parts even when another word sits between them; for an idiom wrap the whole expression.
  - Portuguese: wrap the word or short phrase that is the Portuguese equivalent of the target IN THAT SENTENCE in <b></b>.
  - If the target appears more than once in a sentence, bold ONLY the main occurrence.
  - Exactly ONE bold span per side. Do not bold anything else.
- Translate the Portuguese naturally (not word-for-word). LITERAL-TRANSLATION TRAP — avoid it explicitly: translate what the sentence DOES, the way a Brazilian would say it ("we'll get you in" → "a gente te encaixa", never "colocar você dentro"). If a translation reads like word-by-word substitution, redo it.`
  return aiJSON(PROMPT, { model: AI_DEFAULT_MODEL, maxTokens: 900 })
}

// Botão universal da Biblioteca: corrige frases (que não batiam com o significado)
// + preenche variedade/registro de TODOS os cards. Preserva o agendamento SRS.
async function reanalyzeAll() {
  if (!aiChatCfg().key) { toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error'); return }
  if (!srsCards.length) { toast('Nenhum card na biblioteca', 'info'); return }

  const groups = new Map()
  for (const c of srsCards) {
    const key = `${c.wordId}|${c.meaningIdx}`
    if (!groups.has(key)) groups.set(key, {
      word: c.word || '', type: c.type || 'word', lang: cardLang(c),
      meaning_pt: c.meaning_pt || '', definition_pt: c.definition_pt || '', cards: []
    })
    groups.get(key).cards.push(c)
  }
  const items = [...groups.values()].filter(g => g.word)
  if (!items.length) { toast('Nada para reanalisar', 'info'); return }


  const btn = document.getElementById('lib-reprocess-btn')
  const origHtml = btn ? btn.innerHTML : ''
  if (btn) btn.disabled = true
  const total = items.length
  let updated = 0, failed = 0, audioGen = 0
  const genAudio = cfg.ttsProvider !== 'none' && !!cfg.openaiKey

  const tasks = items.map(it => async () => {
  if (!(await aiConfirmBatch('chat', tasks.length, 'Reanalisar tudo (corrigir)', { sempre: true, detalhe: ['Corrige as frases para baterem com o significado', 'Preenche variedade e registro', 'Gera o áudio das novas frases', 'Mantém o agendamento de estudo intacto'] }))) return
    try {
      const r = await regenerateMeaning(it)
      const variety = _normVariety(r && r.variety, it.lang)
      const register = _normRegister(r && r.register)
      const origin = String((r && r.origin_pt) || '').trim()
      const exs = (r && Array.isArray(r.examples)) ? r.examples.filter(e => e && e.en) : []
      const audioTexts = new Set()
      it.cards.forEach((c, i) => {
        c.variety = variety; c.register = register
        c.origin_pt = origin
        if (exs.length) {
          const ex = exs[i % exs.length]
          if (ex.en) c.example_en = ex.en
          if (ex.pt) c.example_pt = ex.pt
        }
        if (c.example_en) audioTexts.add(c.example_en)
        updated++
      })
      // Gera o áudio das novas frases (mesma string usada na reprodução → chave bate)
      if (genAudio) {
        for (const txt of audioTexts) {
          const made = await ensureSrsAudio(txt)
          if (made) audioGen++
        }
      }
    } catch (e) {
      console.warn('[reanalyzeAll] falhou:', it.word, e.message)
      failed += it.cards.length
    }
  })

  await runPool(tasks, 4, d => { if (btn) btn.innerHTML = `<span class="spinner"></span> ${d}/${total}` })

  saveSrsCards(); autoSyncAfterChange()
  try { await refreshAudioKeyCache() } catch {}
  if (typeof autoSyncAudioAfterChange === 'function') autoSyncAudioAfterChange()
  if (btn) { btn.disabled = false; btn.innerHTML = origHtml }
  if (_browserPreviewCardId) showBrowserCardPreview(_browserPreviewCardId)
  if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck, el('srs-browser-search')?.value || '')
  toast(`${updated} card(s) corrigidos${audioGen ? ` · ${audioGen} áudio(s) gerado(s)` : ''}${failed ? ` · ${failed} falharam (rode de novo)` : ''}`, updated ? 'success' : 'warning')
}

// Botão TEMPORÁRIO da Biblioteca: passada leve que só COMPLETA metadados que ainda
// estão vazios em cada significado já salvo no SRS — IPA, categoria local
// (type_label), nível e origem/história. NUNCA toca em significado, definição,
// frases (exemplos), variedade/registro nem no agendamento SRS. Serve para destravar
// o uso da IA sobre itens JÁ ADICIONADOS (ex.: uma leva de estudo importada de
// documento) sem risco de perder as frases curadas daquela fonte. Pula significados
// que já têm tudo preenchido. (Generaliza o antigo "Preencher origem" — mesmo botão.)
async function fillMissingAll() {
  if (!aiChatCfg().key) { toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error'); return }
  if (!srsCards.length) { toast('Nenhum card na biblioteca', 'info'); return }

  // Agrupa por significado (wordId|meaningIdx); junta o que já está preenchido
  const groups = new Map()
  for (const c of srsCards) {
    const key = `${c.wordId}|${c.meaningIdx}`
    if (!groups.has(key)) groups.set(key, {
      wordId: c.wordId, meaningIdx: c.meaningIdx,
      word: c.word || '', type: c.type || 'word', lang: cardLang(c),
      meaning_pt: c.meaning_pt || '', definition_pt: c.definition_pt || '',
      ipa: '', type_label: '', origin_pt: '', level: '', cards: []
    })
    const g = groups.get(key)
    g.cards.push(c)
    if (c.ipa && c.ipa.trim()) g.ipa = c.ipa
    if (c.type_label && c.type_label.trim()) g.type_label = c.type_label
    if (c.origin_pt && c.origin_pt.trim()) g.origin_pt = c.origin_pt
  }
  // "level" só existe no significado da palavra (não é snapshotado no card)
  for (const g of groups.values()) {
    const w = words.find(x => x.id === g.wordId)
    g.wordRef = w
    const wm = w && Array.isArray(w.meanings) ? w.meanings[g.meaningIdx] : null
    if (wm && wm.level && wm.level.trim()) g.level = wm.level
  }

  const items = [...groups.values()].filter(g =>
    g.word && (!g.ipa.trim() || !g.type_label.trim() || !g.origin_pt.trim() || !g.level.trim())
  )
  if (!items.length) { toast('Todos os significados já têm IPA, categoria, nível e origem preenchidos', 'info'); return }


  const btn = document.getElementById('lib-fill-origin-btn')
  const origHtml = btn ? btn.innerHTML : ''
  if (btn) btn.disabled = true
  const total = items.length
  let updated = 0, skipped = 0, failed = 0, wordsTouched = false

  const tasks = items.map(it => async () => {
  if (!(await aiConfirmBatch('chat', tasks.length, 'Completar dados (IA)', { detalhe: ['Só preenche o que estiver vazio: IPA, categoria, nível, origem', 'Não mexe em significado, frases nem agendamento'] }))) return
    const PROMPT = `You fill in MISSING metadata for a ${promptLangName(it.lang)} vocabulary flashcard, for a Brazilian learner. Return ONLY valid JSON.
Word/expression (${promptLangName(it.lang)}): "${it.word}"${it.type ? ` (type: ${it.type})` : ''}
Meaning (PT): "${it.meaning_pt || '(most common sense)'}"
${it.definition_pt ? `Definition of this sense: "${it.definition_pt}"` : ''}

Return ONLY this JSON:
{
  "ipa": ${promptIpaRule(it.lang)},
  "type_label": "precise local category in Brazilian Portuguese for this kind of word/expression, or empty string for a plain word",
  "level": "A2|B1|B2|C1|C2",
  "origin_pt": "1-2 sentences in PT-BR on the ORIGIN/history behind this expression — the image, metaphor or etymology. Fill ONLY for idioms, multi-word verbal expressions, metaphors and words with a genuinely interesting or non-obvious etymology (e.g. 'sitting duck', 'on the chopping block', 'flagship'). Empty string for ordinary words with no notable story. NEVER invent folk etymology — if unsure, return empty."
}`
    try {
      const r = await aiJSON(PROMPT, { model: AI_DEFAULT_MODEL, maxTokens: 260 })

      // Monta o "patch" só com os campos que estavam VAZIOS — nunca sobrescreve o
      // que já existia (mesmo que a IA tenha devolvido algo diferente pra esse campo).
      const patch = {}
      if (!it.ipa.trim()        && r.ipa)        patch.ipa        = String(r.ipa).trim()
      if (!it.type_label.trim() && r.type_label) patch.type_label = String(r.type_label).trim()
      if (!it.origin_pt.trim())                  patch.origin_pt  = String(r.origin_pt || '').trim() // aceita "" (sem história notável)
      const levelPatch = (!it.level.trim() && r.level) ? String(r.level).trim() : null

      if (Object.keys(patch).length) it.cards.forEach(c => Object.assign(c, patch))
      const w = it.wordRef
      if (w) {
        if (patch.ipa) w.ipa = patch.ipa
        if (Array.isArray(w.meanings) && w.meanings[it.meaningIdx]) {
          const wm = w.meanings[it.meaningIdx]
          if (patch.type_label) wm.type_label = patch.type_label
          if ('origin_pt' in patch) wm.origin_pt = patch.origin_pt
          if (levelPatch) wm.level = levelPatch
        }
      }
      if (Object.keys(patch).length || levelPatch) { updated++; wordsTouched = true } else skipped++
    } catch (e) {
      console.warn('[fillMissingAll] falhou:', it.word, e.message)
      failed++
    }
  })

  await runPool(tasks, 4, d => { if (btn) btn.innerHTML = `<span class="spinner"></span> ${d}/${total}` })

  saveSrsCards()
  if (wordsTouched && typeof saveWords === 'function') saveWords()
  autoSyncAfterChange()
  if (btn) { btn.disabled = false; btn.innerHTML = origHtml }
  if (_browserPreviewCardId) showBrowserCardPreview(_browserPreviewCardId)
  if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck, el('srs-browser-search')?.value || '')
  toast(`${updated} significado(s) completados${skipped ? ` · ${skipped} sem nada novo` : ''}${failed ? ` · ${failed} falharam (rode de novo)` : ''}`, updated ? 'success' : 'info')
}

// ---- Negrito perfeito (IA): marca o objeto de estudo em <b> no EN e no PT ----
// Pega as frases sem negrito OU com negrito malformado (nenhum span, mais de um,
// span vazio, ou span cobrindo quase a frase toda) — no inglês ou no português —,
// pede à IA para envolver o termo (inflexão/expressão) e o equivalente em PT.
// Preserva o agendamento SRS; também escreve de volta nos significados da palavra
// de origem.
// Verifica se `s` tem EXATAMENTE um span <b>...</b> bem formado (não vazio, não a
// frase inteira) — usado tanto pra decidir o que precisa de correção quanto pra
// validar a resposta da IA antes de aceitar como "corrigido".
function boldSpanOk(s) {
  if (!s) return false
  const opens = (s.match(/<b>/gi) || []).length
  const closes = (s.match(/<\/b>/gi) || []).length
  if (opens !== 1 || closes !== 1) return false
  const m = s.match(/<b>([\s\S]*?)<\/b>/i)
  if (!m || !m[1].trim()) return false
  const plain = s.replace(/<\/?b>/gi, '')
  return m[1].length < plain.length * 0.85
}
async function markBoldOne(it) {
  const _bL = getLangDef(it.lang || 'en')
  const PROMPT = `You mark the STUDY TARGET in bold inside example sentences for a Brazilian learner of ${_bL.nameEn}. Return ONLY valid JSON.

Study target (${_bL.nameEn} word/expression): "${it.word}"
${_bL.nameEn} sentence: ${JSON.stringify(it.en)}
Portuguese translation: ${JSON.stringify(it.pt)}

Return the SAME two sentences, byte-for-byte identical EXCEPT that the study target is wrapped in <b></b>:
- ${_bL.nameEn}: wrap the target exactly as it appears, inflected/conjugated (e.g. "ran" for "run"; for a multi-word verbal expression wrap all its parts even if separated — e.g. a German separable verb "rufe ... an" gets <b> on both parts; for an idiom wrap the whole expression). Wrap the main occurrence.
- Portuguese: wrap the word or short phrase that TRANSLATES the target in THIS sentence (its Portuguese equivalent).
- Do NOT change, add, remove or translate anything else. No extra <b>. Keep punctuation and spacing identical.
- If the Portuguese sentence is empty, return "pt":"".

Return: {"en":"...","pt":"..."}`
  return aiJSON(PROMPT, { model: AI_DEFAULT_MODEL, maxTokens: 400 })
}

async function markBoldAll() {
  if (!aiChatCfg().key) { toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error'); return }
  if (!srsCards.length) { toast('Nenhum card na biblioteca', 'info'); return }

  // Frases que precisam de negrito: EN ou PT (quando existente) sem span <b> preciso
  const need = srsCards.filter(c =>
    (c.example_en && !boldSpanOk(c.example_en)) ||
    (c.example_pt && !boldSpanOk(c.example_pt)))
  if (!need.length) { toast('Todos os cards já estão com o negrito marcado', 'info'); return }

  // Deduplica por par exato (palavra + frase EN + frase PT)
  const map = new Map()
  for (const c of need) {
    const key = (c.word || '') + '|||' + (c.example_en || '') + '|||' + (c.example_pt || '')
    if (!map.has(key)) map.set(key, { word: c.word || '', lang: cardLang(c), en: c.example_en || '', pt: c.example_pt || '', cards: [] })
    map.get(key).cards.push(c)
  }
  const items = [...map.values()]


  const btn = el('lib-bold-btn'); const orig = btn ? btn.innerHTML : ''
  if (btn) btn.disabled = true
  const total = items.length
  let ok = 0, fail = 0
  const wordsTouched = new Set()

  const tasks = items.map(it => async () => {
  if (!(await aiConfirmBatch('chat', tasks.length, 'Negrito perfeito (IA)', { sempre: true, detalhe: ['Negrito do objeto de estudo nos dois idiomas', 'Não altera significados nem o progresso'] }))) return
    try {
      const r = await markBoldOne(it)
      const en = (r && r.en && boldSpanOk(r.en)) ? r.en : it.en
      const pt = (r && typeof r.pt === 'string' && (boldSpanOk(r.pt) || (r.pt === '' && !it.pt))) ? r.pt : it.pt
      it.cards.forEach(c => {
        if (en) c.example_en = en
        if (pt) c.example_pt = pt
        const w = words.find(x => x.id === c.wordId)
        if (w && Array.isArray(w.meanings) && w.meanings[c.meaningIdx]) {
          const m = w.meanings[c.meaningIdx]
          const ei = c.exampleIdx >= 0 ? c.exampleIdx : 0
          if (Array.isArray(m.examples) && m.examples[ei]) {
            if (en) m.examples[ei].en = en
            if (pt) m.examples[ei].pt = pt
          }
          if (en) m.example_en = en
          if (pt) m.example_pt = pt
          wordsTouched.add(w.id)
        }
      })
      ok++
    } catch (e) {
      console.warn('[markBoldAll] falhou:', it.word, e.message); fail++
    }
  })

  await runPool(tasks, 4, d => { if (btn) btn.innerHTML = `<span class="spinner"></span> ${d}/${total}` })

  saveSrsCards()
  if (wordsTouched.size && typeof saveWords === 'function') saveWords()
  autoSyncAfterChange()
  if (btn) { btn.disabled = false; btn.innerHTML = orig }
  if (_libMode === 'words') renderWordsGlossary()
  else {
    if (_browserPreviewCardId) showBrowserCardPreview(_browserPreviewCardId)
    if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck, el('srs-browser-search')?.value || '')
  }
  toast(`Negrito marcado em ${ok} frase(s)${fail ? ` · ${fail} falharam (rode de novo)` : ''}`, ok ? 'success' : 'warning')
}

async function reprocessMetaBulk() {
  if (!aiChatCfg().key) { toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error'); return }
  if (!srsCards.length) { toast('Nenhum card na biblioteca', 'info'); return }

  // Agrupa por significado (wordId|meaningIdx) — todos os cards do mesmo significado
  // compartilham variedade/registro, então classificamos só 1 vez por significado.
  const groups = new Map()
  for (const c of srsCards) {
    const key = `${c.wordId}|${c.meaningIdx}`
    if (!groups.has(key)) groups.set(key, { word: c.word || '', meaning: c.meaning_pt || '', example: c.example_en || '', lang: cardLang(c), cards: [] })
    groups.get(key).cards.push(c)
  }
  const items = [...groups.values()].filter(g => g.word)
  if (!items.length) { toast('Nenhum significado para processar', 'info'); return }

  if (!(await aiConfirmBatch('chat', items.length, 'Reprocessar variedade e registro', { sempre: true, detalhe: ['Reclassifica variedade (AmE/BrE…) e registro (formal, gíria…)', 'Não altera frases nem agendamento'] }))) return

  const btn = document.getElementById('lib-reprocess-btn')
  const origHtml = btn ? btn.innerHTML : ''
  if (btn) btn.disabled = true

  const BATCH = 25
  let done = 0, updated = 0, failed = 0
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    if (btn) btn.innerHTML = `<span class="spinner"></span> ${done}/${items.length}`
    try {
      const payload = batch.map((it, j) => ({
        id: j,
        word: it.word,
        lang: it.lang || 'en',
        meaning: it.meaning,
        example: (it.example || '').replace(/<[^>]+>/g, '').slice(0, 160)
      }))
      const results = await classifyMetaBatch(payload)
      const byId = {}; results.forEach(r => { byId[r.id] = r })
      batch.forEach((it, j) => {
        const r = byId[j]; if (!r) return
        const variety = _normVariety(r.variety, it.lang)
        const register = _normRegister(r.register)
        it.cards.forEach(c => { c.variety = variety; c.register = register })
        updated += it.cards.length
      })
    } catch (e) {
      console.warn('[reprocessMeta] batch falhou:', e.message)
      failed += batch.length
    }
    done += batch.length
    await sleep(350)
  }

  saveSrsCards(); autoSyncAfterChange()
  if (btn) { btn.disabled = false; btn.innerHTML = origHtml }
  if (_browserPreviewCardId) showBrowserCardPreview(_browserPreviewCardId)
  if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck, el('srs-browser-search')?.value || '')
  toast(`${updated} card(s) atualizados${failed ? ` · ${failed} falharam` : ''}`, updated ? 'success' : 'warning')
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
  if (!(await confirmModal({ title: 'Excluir cards', icon: 'trash', danger: true, confirmText: 'Excluir',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Excluir <b>${_browserSelected.size} card${_browserSelected.size !== 1 ? 's' : ''}</b> do estudo? O progresso deles se perde.</p>` }))) return
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
  toast(`Gerando áudio para ${cards.length} card(s)...`, 'info')
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
    toast(`Áudio gerado para ${generated} card(s)`, 'success')
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
      <div style="font-weight:600;font-size:var(--fs-md)">${esc(c.word)}</div>
      <div style="font-size:var(--fs-sm);color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.meaning_pt||'')}</div>
    </div>
    <span style="font-size:var(--fs-2xs);color:${SC[c.state]};font-weight:600;white-space:nowrap;width:75px;text-align:center">${SL[c.state]}</span>
    <span style="font-size:var(--fs-2xs);color:var(--text3);white-space:nowrap;width:60px;text-align:center">${dueTxt}</span>
    <span style="font-size:var(--fs-2xs);color:var(--text3);white-space:nowrap;width:50px;text-align:center">ease ${c.ease.toFixed(1)}</span>
    <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();moveSrsCardDeck('${c.id}')" title="Mover">${ic('folder','ic-sm')}</button>
    <button class="btn btn-ghost btn-xs" style="color:var(--error)" onclick="event.stopPropagation();deleteSrsCard('${c.id}')">${ic('x','ic-sm')}</button>
  </div>`
}

let _browserRenderedCount = 0

async function renderBrowserCardList(deckId, query) {
  const panel = el('srs-browser-cards'); if (!panel) return
  panel.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text3);font-size:var(--fs-md)">Carregando...</div>`
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
      <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:var(--fs-md)">${esc(c.word)}</div>
      <div style="font-size:var(--fs-sm);color:var(--text2)">${esc(c.meaning_pt||'')}</div></div>
      <span style="font-size:var(--fs-2xs);color:${SC[c.state]};font-weight:600;margin-right:8px">${SL[c.state]}</span>
      <span style="margin-right:4px">${hasAudio?'<span class="audio-badge-ok">'+ic('volume','ic-sm')+'</span>':'<span class="audio-badge-no">'+ic('alert','ic-sm')+'</span>'}</span>
      <button class="btn btn-ghost btn-xs" style="color:var(--error)" onclick="event.stopPropagation();deleteSrsCard('${c.id}')">${ic('x','ic-sm')}</button>
    </div>`
  }).join('')
  updateBrowserToolbar()
}
async function deleteSrsCard(cardId) {
  if (!(await confirmModal({ title: 'Excluir card', icon: 'trash', danger: true, confirmText: 'Excluir',
    html: '<p style="font-size:var(--fs-sm);color:var(--text2)">Excluir este card do estudo? O progresso dele se perde.</p>' }))) return
  srsCards = srsCards.filter(c => c.id !== cardId)
  _browserSelected.delete(cardId)
  saveSrsCards(); autoSyncAfterChange()
  if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck)
  renderSrsSection(); toast('Card excluído','info')
}
function closeMoveModal() { document.getElementById('srs-move-overlay')?.remove() }
function moveSrsCardDeck(cardId) {
  const card = srsCards.find(c => c.id === cardId); if (!card) return
  closeMoveModal()
  const modal = document.createElement('div')
  modal.id = 'srs-move-overlay'
  modal.className = 'srs-modal-overlay'
  // Clicar no fundo (fora da caixa) fecha
  modal.addEventListener('click', e => { if (e.target === modal) closeMoveModal() })
  modal.innerHTML = `<div class="srs-modal-box">
    <h4 style="margin-bottom:12px">Mover card para deck</h4>
    <select id="move-deck-sel" class="srs-modal-select"></select>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" onclick="closeMoveModal()">Cancelar</button>
      <button class="btn btn-primary btn-sm" onclick="confirmMoveDeck('${cardId}',document.getElementById('move-deck-sel').value);closeMoveModal()">Mover</button>
    </div></div>`
  document.body.appendChild(modal)
  populateDeckSelect(document.getElementById('move-deck-sel'), card.deckId)
}
function confirmMoveDeck(cardId, newDeckId) {
  const card = srsCards.find(c => c.id === cardId)
  if (card && newDeckId) { card.deckId = newDeckId; saveSrsCards(); autoSyncAfterChange() }
  if (_activeBrowserDeck) renderBrowserCardList(_activeBrowserDeck)
  renderSrsSection()
  toast('Card movido', 'success')
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
  const verso   = buildSrsVerso(card, imgData, true)

  const SC = {new:'var(--success)', learning:'var(--warning)', review:'var(--primary)', relearning:'var(--error)'}
  const SL = {new:'Novo', learning:'Aprendendo', review:'Revisão', relearning:'Reaprendendo'}

  panel.innerHTML = `
    <div>
      <div style="font-size:var(--fs-2xs);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:6px">
        <span style="color:${SC[card.state]}">${SL[card.state]}</span>
        · ease ${card.ease.toFixed(1)}
      </div>
      ${buildMetaChips(card)}
      <div class="bpp-card-front">
        <div class="bpp-label">Frente</div>
        <div style="font-size:var(--fs-lg);font-weight:700;margin-bottom:6px">${esc(card.word)}</div>
        ${frente ? `<div style="font-size:var(--fs-md);color:var(--text2)">${frente}</div>` : ''}
        <button class="btn btn-ghost btn-xs" style="margin-top:8px"
          onclick="playSrsTTS('${(card.example_en||card.word||'').replace(/'/g,"\'")}')">${ic('volume','ic-sm')}</button>
      </div>
      <div class="bpp-card-back" style="margin-top:10px">
        <div class="bpp-label">Verso</div>
        <div class="srs-card-back-body" style="font-size:var(--fs-md)">${verso}</div>
      </div>
    </div>`
}

function addRootDeck() {
  inputModal({ title:'Novo baralho', label:'Dê um nome ao novo baralho', placeholder:'ex: Negócios, Viagem...', confirmText:'Criar',
    onConfirm:n => { addDeck(n, null); renderSrsAllCards(); toast('Baralho criado', 'success') } })
}
function addChildDeck(pid) {
  inputModal({ title:'Novo sub-baralho', label:'Nome do sub-baralho', placeholder:'ex: Verbos irregulares', confirmText:'Criar',
    onConfirm:n => { addDeck(n, pid); renderSrsAllCards(); toast('Sub-baralho criado', 'success') } })
}
function editDeckName(deckId) {
  const d = getDeckById(deckId); if (!d) return
  inputModal({ title:'Renomear baralho', label:'Novo nome do baralho', value:d.name, confirmText:'Salvar',
    onConfirm:n => { renameDeck(deckId, n); renderSrsAllCards(); toast('Baralho renomeado', 'success') } })
}
async function deleteDeckUI(deckId) {
  const d = getDeckById(deckId); if (!d) return
  const cnt = getDeckCardCount(deckId)
  const corpo = cnt > 0 ? `Os <b>${cnt} cards</b> serão movidos para o baralho pai — nada se perde.` : 'O baralho está vazio.'
  if (!(await confirmModal({ title: `Excluir "${d.name}"`, icon: 'trash', danger: true, confirmText: 'Excluir',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">${corpo}</p>` }))) return
  deleteDeck(deckId); renderSrsAllCards(); renderSrsSection()
}

// ================================================================
// CONTINUOUS AUDIO PLAYLIST PLAYER (Modo Listening Passivo)
// ================================================================
let _playlistCards = [];
let _playlistIndex = 0;
let _playlistPlaying = false;
let _playlistTimer = null;
let _playlistMode = 'completo'; // 'completo' | 'desafio' | 'ingles'
let _playlistInterval = 3;      // segundos de intervalo de fixação
let _playlistLoop = false;
// Token de geração: toda ação do usuário (play/pause/próximo/anterior/fechar) incrementa.
// A cadeia async de reprodução guarda o token do momento em que começou e desiste
// assim que ele muda — sem isso, um `await` antigo terminava depois e chamava
// playlistNext() de novo, pulando cards.
let _playlistGen = 0;
let _playlistRejectDelay = null;

// Promisified version of TTS play to wait until audio ends
async function playSrsTTSPromise(text) {
  if (!text) return;
  return new Promise(async (resolve) => {
    // Para qualquer reprodução anterior
    if (_srsAudio) { try { _srsAudio.pause() } catch(e){} ; _srsAudio = null }

    const key = audioKey(text)
    const cached = await AudioDB.get(key)
    if (cached) {
      _srsAudio = new Audio(cached)
      _srsAudio.onended = () => resolve();
      _srsAudio.onerror = () => resolve();
      _srsAudio.play().catch(() => resolve());
      return
    }

    if (cfg.openaiKey) {
      const b64 = await ensureSrsAudio(text)
      if (b64) {
        _srsAudio = new Audio(b64)
        _srsAudio.onended = () => resolve();
        _srsAudio.onerror = () => resolve();
        _srsAudio.play().catch(() => resolve());
        autoSyncAfterChange()
        return
      }
    }

    // Fallback: Web Speech API
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.85
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.cancel(); speechSynthesis.speak(u)
    } else {
      resolve();
    }
  });
}

function playTranslationTTS(text, langCode = 'pt-BR') {
  return new Promise((resolve) => {
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text); u.lang = langCode; u.rate = 0.9
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.cancel(); speechSynthesis.speak(u)
    } else {
      resolve();
    }
  });
}

function openLibraryAudioPlayer() {
  if (_libMode === 'cards' && _browserCurrentCards && _browserCurrentCards.length > 0) {
    _playlistCards = [..._browserCurrentCards];
  } else {
    _playlistCards = [...srsCards];
  }

  if (!_playlistCards.length) {
    toast('Nenhum card disponível para ouvir!', 'warning');
    return;
  }

  _playlistIndex = 0;
  _playlistPlaying = false;
  _playlistGen++;

  let overlay = el('playlist-player-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'playlist-player-overlay';
    overlay.className = 'srs-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Player de playlist de áudio');
    // Clicar fora do cartão fecha (mesmo comportamento dos outros modais)
    overlay.addEventListener('click', e => { if (e.target === overlay) closePlaylistPlayer() });
    document.body.appendChild(overlay);
  }

  renderPlaylistPlayerUI();
  overlay.style.display = 'flex';
}

function renderPlaylistPlayerUI() {
  const overlay = el('playlist-player-overlay');
  if (!overlay) return;

  const card = _playlistCards[_playlistIndex];
  if (!card) return;

  const total = _playlistCards.length;
  const currentNum = _playlistIndex + 1;

  const playPauseIcon = _playlistPlaying ? ic('pause', 'ic-lg') : ic('play', 'ic-lg');
  const lc = cardLang(card);
  const langName = lc === 'en' ? '' : getLangDef(lc).name;

  overlay.innerHTML = `
    <div class="srs-modal-box playlist-player-card" style="width:480px;max-width:95vw;padding:28px;position:relative">
      <button class="pl-close" onclick="closePlaylistPlayer()" aria-label="Fechar player"
        style="position:absolute;top:18px;right:18px;background:none;border:none;color:var(--text3);cursor:pointer">
        ${ic('x')}
      </button>

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
        <span style="color:var(--primary);display:flex;align-items:center">${ic('volume')}</span>
        <h3 style="font-size:var(--fs-lg);font-weight:700;margin:0">Playlist de áudio</h3>
      </div>

      <div class="pl-stage">
        <div class="pl-counter">Card ${currentNum} de ${total}${langName ? ' · ' + esc(langName) : ''}</div>

        <div id="playlist-status-msg" class="pl-status is-paused" role="status" aria-live="polite">
          ${ic('clock')} Pausado
        </div>

        <div class="pl-word">${esc(card.word)}</div>

        <div class="pl-sentence">${card.example_en ? '“' + escB(card.example_en) + '”' : ''}</div>

        <div id="playlist-translation" class="pl-translation"
          style="display:${_playlistMode === 'desafio' && _playlistPlaying ? 'none' : 'block'}">
          ${esc(card.meaning_pt)}
        </div>
      </div>

      <div class="pl-controls">
        <button class="btn btn-ghost pl-btn-round" onclick="playlistPrev()" aria-label="Card anterior" data-tip="Anterior">
          ${ic('skip')}
        </button>
        <button class="btn btn-primary pl-btn-play" onclick="playlistTogglePlay()"
          aria-label="${_playlistPlaying ? 'Pausar' : 'Reproduzir'}" data-tip="Reproduzir / pausar">
          ${playPauseIcon}
        </button>
        <button class="btn btn-ghost pl-btn-round" onclick="playlistNext()" aria-label="Próximo card" data-tip="Próximo">
          ${ic('skip')}
        </button>
      </div>

      <div class="pl-options">
        <div class="pl-options-grid">
          <div>
            <label class="pl-label" for="playlist-mode">Modo de estudo</label>
            <select id="playlist-mode" onchange="setPlaylistMode(this.value)" style="width:100%">
              <option value="completo" ${_playlistMode === 'completo' ? 'selected' : ''}>Completo (frase + tradução)</option>
              <option value="desafio" ${_playlistMode === 'desafio' ? 'selected' : ''}>Desafio (recall ativo)</option>
              <option value="ingles" ${_playlistMode === 'ingles' ? 'selected' : ''}>Só o idioma estudado</option>
            </select>
          </div>

          <div>
            <label class="pl-label" for="playlist-interval">
              Pausa de fixação: <span id="playlist-interval-val" style="color:var(--primary)">${_playlistInterval}s</span>
            </label>
            <input type="range" id="playlist-interval" min="1" max="10" step="1" value="${_playlistInterval}"
              oninput="setPlaylistInterval(this.value)" style="width:100%;accent-color:var(--primary)">
          </div>
        </div>

        <div class="pl-foot">
          <span class="pl-hint">Atalhos: <kbd class="srb-key-inline">Espaço</kbd> reproduzir · <kbd class="srb-key-inline">←</kbd> <kbd class="srb-key-inline">→</kbd> navegar · <kbd class="srb-key-inline">Esc</kbd> fechar</span>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" id="playlist-loop" onchange="playlistToggleLoop(this.checked)"
              style="accent-color:var(--primary)" ${_playlistLoop ? 'checked' : ''}>
            <span>Repetir playlist</span>
          </label>
        </div>
      </div>
    </div>
  `;

  // Seta do "anterior" é a mesma do "próximo", espelhada — evita um ícone novo só para isso.
  const prevIcon = overlay.querySelector('.pl-controls .pl-btn-round .ic');
  if (prevIcon) prevIcon.style.transform = 'scaleX(-1)';

  if (_playlistPlaying) playlistSetStatus('play', 'Reproduzindo...');
}

// Status do player em um único ponto — sem emoji, com ícone e classe de cor.
function playlistSetStatus(kind, text) {
  const st = el('playlist-status-msg');
  if (!st) return;
  const map = {
    play:   ['', 'volume'],
    pause:  ['is-paused', 'clock'],
    recall: ['is-recall', 'clock'],
    reveal: ['is-reveal', 'volume'],
    wait:   ['is-paused', 'clock'],
  };
  const [cls, icon] = map[kind] || map.wait;
  st.className = 'pl-status' + (cls ? ' ' + cls : '');
  st.innerHTML = `${ic(icon)} ${esc(text)}`;
}

function playlistToggleLoop(checked) {
  _playlistLoop = checked;
}

function setPlaylistMode(val) {
  _playlistMode = val;
  const transEl = el('playlist-translation');
  if (transEl) transEl.style.display = _playlistMode === 'desafio' && _playlistPlaying ? 'none' : 'block';
}

function setPlaylistInterval(val) {
  _playlistInterval = parseInt(val);
  const valEl = el('playlist-interval-val');
  if (valEl) valEl.textContent = val + 's';
}

function playlistTogglePlay() {
  _playlistPlaying = !_playlistPlaying;
  renderPlaylistPlayerUI();
  if (_playlistPlaying) {
    playlistPlayCurrent();
  } else {
    playlistPause();
  }
}

function playlistPause() {
  _playlistPlaying = false;
  _playlistGen++;                 // invalida qualquer cadeia de reprodução em curso
  playlistCancelDelay();
  if (_srsAudio) { try { _srsAudio.pause() } catch(e){} }
  if (window.speechSynthesis) speechSynthesis.cancel();
  playlistSetStatus('pause', 'Pausado');
}

async function playlistPlayCurrent() {
  if (!_playlistPlaying) return;
  playlistCancelDelay();
  if (window.speechSynthesis) speechSynthesis.cancel();

  const card = _playlistCards[_playlistIndex];
  if (!card) {
    closePlaylistPlayer();
    return;
  }

  // Cada cadeia carrega o token do momento em que começou. Se o usuário mexer
  // (próximo/anterior/pausa/fechar), o token muda e esta cadeia desiste em silêncio.
  const myGen = ++_playlistGen;
  const alive = () => _playlistPlaying && _playlistGen === myGen;

  renderPlaylistPlayerUI();

  const transEl = el('playlist-translation');
  const langNameOf = c => { const l = cardLang(c); return l === 'en' ? 'inglês' : getLangDef(l).name.toLowerCase() };

  try {
    // Passo 1: falar no idioma estudado
    playlistSetStatus('play', `Ouvindo em ${langNameOf(card)}...`);
    if (transEl) transEl.style.display = _playlistMode === 'desafio' ? 'none' : 'block';

    await playSrsTTSPromise(card.example_en || card.word || '');
    if (!alive()) return;

    if (_playlistMode === 'desafio') {
      // Pausa de recall ANTES de revelar
      playlistSetStatus('recall', `Tente lembrar... (${_playlistInterval}s)`);
      await playlistDelay(_playlistInterval * 1000);
      if (!alive()) return;

      const t = el('playlist-translation');
      if (t) t.style.display = 'block';
      playlistSetStatus('reveal', 'Revelando a tradução...');
      await playTranslationTTS(card.meaning_pt);
      if (!alive()) return;

      await playlistDelay(1500);
    } else if (_playlistMode === 'completo') {
      playlistSetStatus('reveal', 'Ouvindo a tradução...');
      await playTranslationTTS(card.meaning_pt);
      if (!alive()) return;

      playlistSetStatus('wait', `Intervalo (${_playlistInterval}s)...`);
      await playlistDelay(_playlistInterval * 1000);
    } else {
      playlistSetStatus('wait', `Intervalo (${_playlistInterval}s)...`);
      await playlistDelay(_playlistInterval * 1000);
    }

    if (!alive()) return;
    playlistNext();

  } catch (error) {
    console.error('Erro na playlist:', error);
    if (alive()) playlistNext(); // avança mesmo sob erro para não travar
  }
}

// Delay cancelável: cancelar rejeita a Promise em vez de deixá-la pendente para sempre.
function playlistDelay(ms) {
  return new Promise((resolve, reject) => {
    _playlistRejectDelay = reject;
    _playlistTimer = setTimeout(() => { _playlistRejectDelay = null; resolve() }, ms);
  }).catch(() => {}); // cancelamento não é erro
}

function playlistCancelDelay() {
  if (_playlistTimer) { clearTimeout(_playlistTimer); _playlistTimer = null }
  if (_playlistRejectDelay) { const r = _playlistRejectDelay; _playlistRejectDelay = null; r(new Error('cancelado')) }
}

function playlistNext() {
  playlistCancelDelay();
  _playlistGen++;
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (_srsAudio) { try { _srsAudio.pause() } catch(e){} }

  _playlistIndex++;
  if (_playlistIndex >= _playlistCards.length) {
    if (_playlistLoop) {
      _playlistIndex = 0;
    } else {
      _playlistIndex = _playlistCards.length - 1;
      playlistPause();
      toast('Playlist finalizada', 'success');
      renderPlaylistPlayerUI();
      return;
    }
  }

  if (_playlistPlaying) {
    playlistPlayCurrent();
  } else {
    renderPlaylistPlayerUI();
  }
}

function playlistPrev() {
  playlistCancelDelay();
  _playlistGen++;
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (_srsAudio) { try { _srsAudio.pause() } catch(e){} }

  _playlistIndex = Math.max(0, _playlistIndex - 1);

  if (_playlistPlaying) {
    playlistPlayCurrent();
  } else {
    renderPlaylistPlayerUI();
  }
}

function closePlaylistPlayer() {
  playlistPause();
  const overlay = el('playlist-player-overlay');
  if (overlay) overlay.style.display = 'none';
}

// Escuta de teclado para o player de áudio contínuo
document.addEventListener('keydown', e => {
  const overlay = el('playlist-player-overlay');
  if (overlay && overlay.style.display === 'flex') {
    // Não sequestrar as setas do slider nem o espaço do checkbox/select
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && e.key !== 'Escape') return;
    if (e.code === 'Space') {
      e.preventDefault();
      playlistTogglePlay();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      playlistNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      playlistPrev();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePlaylistPlayer();
    }
  }
});



// Menu "Manutenção IA" da Biblioteca — abre/fecha; clique fora fecha.
function toggleLibMaint(ev, forceClose) {
  const menu = el('lib-maint-menu'); if (!menu) return
  const btn = el('lib-maint-btn')
  const fechar = forceClose || !menu.classList.contains('hidden')
  menu.classList.toggle('hidden', fechar)
  if (btn) btn.setAttribute('aria-expanded', fechar ? 'false' : 'true')
  if (ev) ev.stopPropagation()
}
document.addEventListener('click', e => {
  const menu = el('lib-maint-menu')
  if (menu && !menu.classList.contains('hidden') && !e.target.closest('.lib-maint-wrap')) toggleLibMaint(null, true)
})
