// ================================================================
// IA — DIRETO NO SITE (OpenAI) + FALLBACK N8N
// ================================================================

function applyAiResult(w, result) {
  w.word = result.word || w.word
  w.type = result.type || 'word'
  w.ipa = result.ipa || ''
  if (result.audio_base64) w.audio_base64 = result.audio_base64
  const rawMeanings = Array.isArray(result.meanings) && result.meanings.length > 0
    ? result.meanings
    : [{
        meaning_pt: result.meaning_pt || '', definition_pt: '', variety: 'general', register: 'neutral',
        level: result.level || '', synonyms: [], antonyms: [],
        examples: (result.examples || []).map((e,i) => typeof e === 'string'
          ? (i % 2 === 0 ? { en: e, pt: (result.examples||[])[i+1] || '' } : null)
          : e).filter(Boolean),
        context_match: true, tags: result.tags || []
      }]
  w.meanings = rawMeanings.map((m, i) => ({
    id: uid(), selected: true, idx: i,
    meaning_pt:    m.meaning_pt    || '',
    definition_pt: m.definition_pt || '',
    origin_pt:     m.origin_pt     || '',
    variety:       m.variety       || 'general',
    register:      m.register      || 'neutral',
    level:         m.level         || '',
    examples:      Array.isArray(m.examples) && m.examples.length > 0
                     ? m.examples
                     : (m.example_en ? [{ en: m.example_en, pt: m.example_pt || '' }] : []),
    example_en:    m.example_en    || (Array.isArray(m.examples) && m.examples[0] ? m.examples[0].en : '') || '',
    example_pt:    m.example_pt    || (Array.isArray(m.examples) && m.examples[0] ? m.examples[0].pt : '') || '',
    notes:         m.notes         || [],
    word_family:   m.word_family   || [],
    synonyms:      m.synonyms      || [],
    antonyms:      m.antonyms      || [],
    grammar:       m.grammar       || '',
    context_note:  m.context_note  || '',
    tags:          m.tags          || [],
    context_match: m.context_match !== false
  }))
  w.status = 'pending_review'
  w.ai_processed = true
  w.updated_at = new Date().toISOString()
}

async function analyzeWordDirect(wordId) {
  const w = words.find(x => x.id === wordId)
  if (!w || !cfg.openaiKey) return false

  const main = el('review-main')
  if (activeWordId === wordId) {
    main.innerHTML = `<div class="review-empty-main"><span class="spinner" style="width:32px;height:32px;border-width:3px"></span><p style="margin-top:16px">Analisando com IA...</p></div>`
  }

  const target = w.word || w.context
  const ctx    = w.context || ''

  // Bloco de contexto da fonte — faz a IA desambiguar pelo gênero da mídia
  // (ex.: "snuff" no Survivor = "apagar a tocha", não "rapé").
  const SRC_LABELS = { series:'TV series', movie:'movie', youtube:'YouTube video', podcast:'podcast', website:'website', kindle:'book', manual:'' }
  const srcType  = w.source_type || ''
  const srcTitle = (w.source_title || '').trim()
  const srcCtx   = (w.source_context || '').trim()
  const srcLabel = SRC_LABELS[srcType] != null ? SRC_LABELS[srcType] : srcType
  let sourceBlock = ''
  if (srcTitle || srcCtx) {
    sourceBlock = `
Source of this item${srcLabel ? ` (${srcLabel})` : ''}: ${srcTitle ? `"${srcTitle}"` : '(untitled)'}${srcCtx ? ` — extra context: ${srcCtx}` : ''}

SOURCE-AWARE DISAMBIGUATION — CRITICAL:
- First infer the GENRE / DOMAIN of this source from its title and type (e.g. "Survivor" → reality survival competition show; "Breaking Bad" → crime drama; a police procedural → law-enforcement jargon; a fantasy novel → medieval/fantasy register).
- Inside a specific genre, a common word frequently carries a special domain-specific meaning. You MUST treat the sense as it is actually used IN THIS SOURCE'S CONTEXT as the PRIMARY meaning: set its "context_match": true and place it FIRST in the array.
- Canonical example: "snuff" captured from *Survivor* means "apagar (a tocha)" — the host snuffs the eliminated player's torch — NOT "rapé" (powdered tobacco). The reality-show sense wins because of the source.
- If a context sentence is present, combine it WITH the inferred genre to choose the right primary sense.
- You MUST still ALSO return the other common general-English senses with "context_match": false, exactly as usual — never drop them.${w._seedMeaning ? `
- A curated meaning for this item was already provided from the source material: "${w._seedMeaning}". Preserve THIS as the primary (context_match:true) sense; refine its Portuguese only if it is clearly wrong, and make sure one example illustrates it.` : ''}`
  }

  const PROMPT = `Analyze this English vocabulary item for a Brazilian learner and return ONLY valid JSON.

Item: "${target}"
${ctx ? `Context sentence: "${ctx}"` : ''}
${sourceBlock}

Rules for examples — CRITICAL, follow exactly:
- Write EXACTLY 3 examples per meaning
- Each example MUST use a completely different grammatical tense or construction. Do NOT repeat the same tense. Good variety: #1 present simple, #2 past simple or past perfect, #3 present continuous or future or conditional or imperative or passive
- Each example MUST have a different subject (mix: he/she/they/I/we/you/a proper name/a noun phrase)
- Each example MUST describe a genuinely different real-world situation or context (work, relationships, sports, travel, news, etc.)
- NEVER use formulaic sentence patterns — sentences should feel natural, like they come from a novel, news article, or real conversation
- Wrap the target word/expression in <b></b> tags exactly as it appears conjugated/inflected in that English sentence
- NEVER use <b> tags in Portuguese translations — plain text only
- BAD (avoid): "#1 He backs down. #2 She backed down. #3 They are backing down." — same pattern, different pronouns
- GOOD: "#1 The senator backed down after facing criticism from his own party. #2 Don't back down just because the situation gets uncomfortable. #3 She never backs down from a challenge, even when the odds are against her."

For Portuguese translations of examples:
- Translate naturally — don't translate word-for-word
- Use DIFFERENT Portuguese words/synonyms across the 3 examples when the target word has synonyms (e.g. for "thunderstruck": use "atordoado", "estarrecido", "pasmado" — not "atordoado" × 3)
- Each Portuguese translation should read like natural Brazilian Portuguese, not like a translation

Rules for meanings — CRITICAL:
- The context sentence is ONLY used to identify the word correctly and to mark which sense appeared there. It does NOT limit which meanings you return.
- ALWAYS return ALL distinct senses the word has in common English usage — not just the one from the context.
- Think of yourself as a dictionary: if the word has 3 senses, return 3 meaning objects. If it has 2, return 2. Never collapse them into one.
- NEVER merge two different senses into one meaning using semicolons (e.g. "decolar; ter sucesso" is WRONG — those must be two separate objects)
- NEVER omit a common sense just because it doesn't appear in the context sentence
- Each meaning MUST have its own 3 examples that illustrate that specific sense
- CRITICAL: every example placed under a meaning MUST unambiguously illustrate THAT meaning's sense — never another sense of the word. If "${target}" has multiple senses, an example for sense A must NOT make sense if read with sense B. Double-check each example matches its meaning before returning.
- Set "context_match": true ONLY for the meaning that matches the context sentence; all others get false
- Put the context-matching meaning FIRST in the array (so the learner sees their original context first)

Example of CORRECT behavior for "take off" with context "his startup took off overnight":
meanings: [
  { meaning_pt: "ter sucesso repentino", ..., context_match: true,  examples: [...] },  ← matches context, comes first
  { meaning_pt: "decolar",              ..., context_match: false, examples: [...] },  ← different sense, still included
  { meaning_pt: "tirar, remover",       ..., context_match: false, examples: [...] }   ← different sense, still included
]

Rules for "variety" and "register" — ALWAYS fill BOTH for every meaning, never leave blank:
- "variety": which English variety this sense belongs to. Use "general" when the word is standard across all varieties (this is the case for MOST words). Use a specific variety only when the word/spelling/sense is predominantly or exclusively used there: "british" (e.g. "lift" = elevator, "lorry", "colour"), "american" (e.g. "soccer", "elevator", "color"), "australian" (e.g. "arvo", "barbie"), "canadian". Default to "general" when in doubt.
- "register": the style level of THIS sense. Pick the single best fit: "neutral" (everyday standard — the default for most words), "formal", "informal", "colloquial", "slang", "technical", "literary", "archaic", or "vulgar".

Return ONLY this JSON (no markdown, no explanation):
{
  "word": "exact word or expression to study",
  "type": "word|phrasal_verb|idiom|collocation",
  "ipa": "/IPA in American English/",
  "level": "A2|B1|B2|C1|C2",
  "meanings": [
    {
      "meaning_pt": "Portuguese translation preserving word class (noun→noun, verb→infinitive, adj→adjective). List 2–3 natural synonyms/variants separated by commas when they exist (e.g. 'séquito, comitiva, cortejo' for 'retinue'; 'enganar, iludir, ludibriar' for 'deceive'). Max 8 words total. ONE sense only — no semicolons.",
      "definition_pt": "Full definition in Portuguese for THIS specific sense (1-2 sentences)",
      "origin_pt": "Brazilian-Portuguese note (1-2 sentences) explaining the ORIGIN / why this expression came to mean this — the image or history behind it. Fill ONLY for idioms, phrasal verbs, metaphors and words with a genuinely interesting or non-obvious etymology (e.g. 'sitting duck' = a duck floating still is an easy target for a hunter; 'on the chopping block' = the block where animals/heads were cut; 'flagship' = the ship that carried the fleet commander's flag; 'throw under the bus' = sacrifice someone for your own safety). Leave it as an EMPTY STRING \"\" for ordinary words with no notable story. NEVER invent folk etymology — if you are not reasonably sure, leave it empty.",
      "variety": "general|american|british|australian|canadian",
      "register": "neutral|formal|informal|colloquial|slang|technical|literary|archaic|vulgar",
      "level": "A2|B1|B2|C1|C2",
      "context_match": true,
      "synonyms": ["syn1", "syn2", "syn3"],
      "antonyms": ["ant1", "ant2"],
      "examples": [
        {"en": "Sentence with <b>word</b> in present tense.", "pt": "Tradução natural em português."},
        {"en": "Sentence with <b>word</b> in past tense.", "pt": "Tradução natural em português."},
        {"en": "Sentence with <b>word</b> in continuous or other tense.", "pt": "Tradução natural em português."}
      ]
    }
  ]
}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.aiModel || 'gpt-4o',
        max_tokens: 2800,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: PROMPT }]
      })
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}`)
    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content || '{}').trim()
    const result = JSON.parse(raw)
    applyAiResult(w, result)
    w.ai_provider = 'openai'
    saveWords()
    renderSidebar()
    if (activeWordId === wordId) renderWordCard(wordId)
    renderDashboard()
    toast(`"${w.word}" analisada`, 'success')
    // TTS assíncrono — gera e cacheia no IndexedDB (não bloqueia)
    ensureSrsAudio(w.word).catch(() => {})
    return true
  } catch(e) {
    toast(`Erro na análise: ${e.message}`, 'error')
    if (activeWordId === wordId) renderWordCard(wordId)
    return false
  }
}

async function analyzeWord(wordId) {
  const w = words.find(x => x.id === wordId)
  if (!w) return
  if (!cfg.openaiKey) {
    toast('Configure a chave OpenAI em Configurações', 'error')
    showSection('configuracoes')
    return
  }
  await analyzeWordDirect(wordId)
}

async function analyzeAll() {
  if (!cfg.openaiKey) {
    toast('Configure a chave OpenAI em Configurações', 'error')
    showSection('configuracoes')
    return
  }
  const pending = words.filter(w => w.status === 'pending_ai')
  if (!pending.length) { toast('Nenhuma palavra pendente de análise', 'info'); return }
  toast(`Analisando ${pending.length} palavras...`)
  for (const w of pending) {
    await analyzeWord(w.id)
    await sleep(300)
  }
  toast('Análise concluída!', 'success')
}

function updateSendAllBtn() { /* kept for compatibility — buttons moved to sidebar action bar */ }

async function saveAllToSrs() {
  const ready = words.filter(w => w.status === 'pending_review' && w.meanings?.some(m => m.selected !== false))
  if (!ready.length) { toast('Nenhuma palavra analisada pronta para salvar', 'warning'); return }
  const btn = el('btn-save-all-srs')
  if (btn) { btn.disabled = true; btn.style.opacity = '.45'; btn.innerHTML = `<span class="spinner"></span> Salvando...` }
  // Suprime toasts individuais durante o batch
  const _toast = window._batchMode = true
  let ok = 0, totalCards = 0
  for (const w of ready) {
    if (!w.meanings?.length) continue
    const selected = w.meanings.filter(m => m.selected !== false)
    if (!selected.length) continue
    let added = 0
    selected.forEach(m => {
      const mi = w.meanings.indexOf(m)
      const examples = m.examples?.length ? m.examples : [null]
      examples.forEach((ex, ei) => {
        const exIdx = ex ? ei : -1
        const exists = srsCards.find(c => c.wordId === w.id && c.meaningIdx === mi && c.exampleIdx === exIdx)
        if (exists) return
        const card = createSrsCard(w.id, mi, exIdx < 0 ? 0 : exIdx)
        if (card) { srsCards.push(card); added++; totalCards++ }
      })
    })
    if (added > 0) { w.status = 'in_srs'; w.updated_at = new Date().toISOString(); ok++ }
  }
  window._batchMode = false
  saveSrsCards(); saveWords(); autoSyncAfterChange()
  if (btn) { btn.innerHTML = '📚 Salvar todos no site'; updateSendAllBtn() }
  toast(`📚 ${ok} palavra${ok !== 1 ? 's' : ''} (${totalCards} cards) salvas no site`, ok > 0 ? 'success' : 'info')
  renderReview(); renderDashboard(); renderSidebar(); updateSrsBadge()
}

function startEditWord(wordId) {
  const textEl = document.getElementById(`wc-word-text-${wordId}`)
  const inputEl = document.getElementById(`wc-word-input-${wordId}`)
  const btnEl = document.getElementById(`wc-edit-btn-${wordId}`)
  if (!textEl || !inputEl) return
  textEl.style.display = 'none'
  btnEl.style.display = 'none'
  inputEl.style.display = 'inline-block'
  inputEl.focus()
  inputEl.select()
}

function confirmEditWord(wordId) {
  const textEl = document.getElementById(`wc-word-text-${wordId}`)
  const inputEl = document.getElementById(`wc-word-input-${wordId}`)
  const btnEl = document.getElementById(`wc-edit-btn-${wordId}`)
  if (!textEl || !inputEl) return
  const newVal = inputEl.value.trim()
  if (newVal) {
    const w = words.find(x => x.id === wordId)
    if (w) { w.word = newVal; saveWords() }
    textEl.textContent = newVal
  }
  textEl.style.display = ''
  btnEl.style.display = ''
  inputEl.style.display = 'none'
}

function handleEditWordKey(e, wordId) {
  if (e.key === 'Enter') { e.preventDefault(); confirmEditWord(wordId) }
  if (e.key === 'Escape') {
    const textEl = document.getElementById(`wc-word-text-${wordId}`)
    const inputEl = document.getElementById(`wc-word-input-${wordId}`)
    const btnEl = document.getElementById(`wc-edit-btn-${wordId}`)
    if (textEl) textEl.style.display = ''
    if (btnEl) btnEl.style.display = ''
    if (inputEl) inputEl.style.display = 'none'
  }
}

// ================================================================
// REVIEW SECTION
// ================================================================
let selectedWordIds = new Set()
let sidebarStatusFilter = 'all'

function renderReview() {
  const reviewable = words.filter(w => ['pending_ai','pending_review'].includes(w.status))
  el('review-empty').classList.toggle('hidden', reviewable.length > 0)
  el('review-content').classList.toggle('hidden', reviewable.length === 0)
  if (!reviewable.length) return
  // Update header subtitle
  const pending = reviewable.filter(w => w.status === 'pending_ai').length
  const ready   = reviewable.filter(w => w.status === 'pending_review').length
  const parts = []
  if (pending) parts.push(`${pending} pendente${pending!==1?'s':''} de IA`)
  if (ready)   parts.push(`${ready} pronta${ready!==1?'s':''} para enviar`)
  const sub = el('review-header-sub')
  if (sub) sub.textContent = parts.join(' · ') || 'Tudo em dia!'
  renderSidebar()
  if (!activeWordId || !words.find(w => w.id === activeWordId)) {
    activeWordId = reviewable[0].id
  }
  renderWordCard(activeWordId)
}

function setSidebarFilter(f) {
  sidebarStatusFilter = f
  document.querySelectorAll('.rsb-filter').forEach(el => el.classList.toggle('active', el.dataset.filter === f))
  renderSidebar(el('sidebar-search')?.value || '')
}

function toggleGroup(key) {
  if (collapsedGroups.has(key)) collapsedGroups.delete(key)
  else collapsedGroups.add(key)
  renderSidebar(el('sidebar-search').value)
}

function toggleSelectAll() {
  const reviewable = getFilteredReviewable(el('sidebar-search')?.value || '')
  const visible = reviewable.flatMap(g => g.words)
  const allSelected = visible.every(w => selectedWordIds.has(w.id))
  if (allSelected) {
    visible.forEach(w => selectedWordIds.delete(w.id))
  } else {
    visible.forEach(w => selectedWordIds.add(w.id))
  }
  renderSidebar(el('sidebar-search')?.value || '')
}

function toggleWordSelect(e, id) {
  e.stopPropagation()
  if (selectedWordIds.has(id)) selectedWordIds.delete(id)
  else selectedWordIds.add(id)
  renderSidebar(el('sidebar-search')?.value || '')
}

function getFilteredReviewable(search = '') {
  let reviewable = words.filter(w => ['pending_ai','pending_review'].includes(w.status))
  if (sidebarStatusFilter !== 'all') reviewable = reviewable.filter(w => w.status === sidebarStatusFilter)
  if (search) reviewable = reviewable.filter(w => (w.word + (w.context||'')).toLowerCase().includes(search.toLowerCase()))
  // Group by source
  const groups = new Map()
  for (const w of reviewable) {
    const key = w.source_title || w.source_type || 'desconhecido'
    if (!groups.has(key)) groups.set(key, { words: [], source_type: w.source_type, source_title: w.source_title, key })
    groups.get(key).words.push(w)
  }
  return [...groups.values()]
}

function updateActionBar() {
  // Clean up selectedWordIds — remove words no longer in reviewable
  const reviewableIds = new Set(words.filter(w => ['pending_ai','pending_review'].includes(w.status)).map(w => w.id))
  for (const id of selectedWordIds) if (!reviewableIds.has(id)) selectedWordIds.delete(id)

  // Update "Todas" button label
  const selAllBtn = document.querySelector('.rsb-select-all')
  if (selAllBtn) {
    const reviewable = getFilteredReviewable(el('sidebar-search')?.value || '')
    const visible = reviewable.flatMap(g => g.words)
    const allSel = visible.length > 0 && visible.every(w => selectedWordIds.has(w.id))
    selAllBtn.textContent = allSel ? 'Limpar seleção' : 'Selecionar todas'
  }
  // Update toolbar above word card
  renderWcToolbarLeft()
}

// Renders the left side of the wc-toolbar contextually:
// — batch actions when items are selected
// — individual actions for the active word otherwise
function renderWcToolbarLeft() {
  const leftEl = document.querySelector('.wct-left')
  if (!leftEl) return
  const w = words.find(x => x.id === activeWordId)
  const selCount = selectedWordIds.size

  if (selCount > 0) {
    leftEl.innerHTML = `
      <span style="font-size:0.82rem;font-weight:600;color:var(--primary);white-space:nowrap">${selCount} selecionada${selCount!==1?'s':''}</span>
      <button class="btn btn-secondary btn-sm" onclick="analyzeSelected()" data-tip="Gera significados, exemplos e nível com IA para as selecionadas">${ic('sparkles')}Analisar</button>
      <button class="btn btn-srs btn-sm" onclick="saveSelectedToSrs()" data-tip="Cria os cards e envia para a fila de estudo (SRS)">${ic('book')}Salvar para estudo</button>
      <button class="btn btn-ghost btn-sm" style="color:#F87171" onclick="deleteSelected()" data-tip="Remove as palavras selecionadas da fila">${ic('trash')}Excluir</button>`
  } else if (w) {
    if (w.status === 'pending_review' && w.meanings?.length > 0) {
      const selM = w.meanings.filter(m => m.selected !== false)
      const totalCards = selM.reduce((sum, m) => sum + ((m.examples?.length) || 1), 0)
      leftEl.innerHTML = `
        <button class="btn btn-srs btn-sm" onclick="saveToSrs('${w.id}')" data-tip="Cria os cards e envia para a fila de estudo (SRS)">${ic('book')}Salvar ${totalCards} card${totalCards!==1?'s':''} para estudo</button>
        <button class="btn btn-secondary btn-sm" onclick="analyzeWord('${w.id}')" data-tip="Roda a IA novamente para esta palavra">${ic('refresh')}Re-analisar</button>`
    } else if (w.status === 'pending_ai') {
      leftEl.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="analyzeWord('${w.id}')" data-tip="Analisa esta palavra com IA: significados, exemplos, nível e registro">${ic('sparkles')}Analisar com IA</button>`
    } else {
      leftEl.innerHTML = ''
    }
  } else {
    leftEl.innerHTML = ''
  }
}

function renderSidebar(filter = '') {
  const all = words.filter(w => ['pending_ai','pending_review'].includes(w.status))
  el('sidebar-count').textContent = all.length

  // Update filter tab counts
  const pendingCount = all.filter(w => w.status === 'pending_ai').length
  const readyCount   = all.filter(w => w.status === 'pending_review').length
  document.querySelectorAll('.rsb-filter').forEach(f => {
    const s = f.dataset.filter
    const n   = s === 'all' ? all.length : s === 'pending_ai' ? pendingCount : readyCount
    const lbl = s === 'all' ? 'Todas'    : s === 'pending_ai' ? 'Pendentes'  : 'Prontas'
    f.innerHTML = `${lbl}${n ? ` <span class="rsb-filter-count">${n}</span>` : ''}`
  })

  const groups = getFilteredReviewable(filter)
  const showGroups = groups.length > 1

  let html = ''
  for (const group of groups) {
    const isCollapsed = collapsedGroups.has(group.key)
    const icon = srcIcon(group.source_type)
    const label = group.source_title || group.key
    const count = group.words.length

    if (showGroups) {
      html += `<div class="rw-group-header" data-key="${escA(group.key)}" onclick="toggleGroup(this.dataset.key)">
        <span>${icon} ${esc(label)} <span class="rw-group-count">${count}</span></span>
        <span class="rw-group-toggle">${isCollapsed ? '▶' : '▼'}</span>
      </div>`
    }

    if (!isCollapsed) {
      for (const w of group.words) {
        const isActive  = w.id === activeWordId
        const isChecked = selectedWordIds.has(w.id)
        const nMean = (w.meanings || []).length
        const statusHtml = w.status === 'pending_ai'
          ? `<span class="status-chip pending_ai">Pendente IA</span>`
          : `<span class="status-chip pending_review">${nMean} significado${nMean !== 1 ? 's' : ''}</span>`
        html += `<div class="rw-item ${isActive ? 'active' : ''} ${isChecked ? 'checked' : ''}" onclick="selectWord('${w.id}')">
          <input type="checkbox" class="rw-cb" ${isChecked ? 'checked' : ''} onclick="toggleWordSelect(event,'${w.id}')" title="Selecionar esta palavra">
          <div class="rw-body">
            <div class="rw-word">${esc(w.word || '(frase)')}</div>
            <div class="rw-meta">
              ${statusHtml}
              ${!showGroups ? `<span class="rw-count" title="Fonte">${icon}</span>` : ''}
            </div>
          </div>
        </div>`
      }
    }
  }

  el('review-word-list').innerHTML = html
  updateActionBar()
}

function filterSidebar(val) { renderSidebar(val) }

function selectWord(id) {
  activeWordId = id
  renderSidebar(el('sidebar-search').value)
  renderWordCard(id)
}

// ---- Batch actions on selected items ----
async function analyzeSelected() {
  const ids = [...selectedWordIds]
  if (!ids.length) return
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'error'); return }
  toast(`Analisando ${ids.length} palavra${ids.length!==1?'s':''}...`)
  for (const id of ids) {
    await analyzeWord(id)
    await sleep(250)
  }
  toast('Análise concluída!', 'success')
}

async function saveSelectedToSrs() {
  const ids = [...selectedWordIds].filter(id => {
    const w = words.find(x => x.id === id)
    return w?.status === 'pending_review' && w.meanings?.some(m => m.selected !== false)
  })
  if (!ids.length) { toast('Nenhuma das selecionadas está pronta', 'warning'); return }
  let ok = 0, totalCards = 0
  for (const id of ids) {
    const w = words.find(x => x.id === id)
    if (!w?.meanings?.length) continue
    w.meanings.filter(m => m.selected !== false).forEach((m, mi) => {
      const examples = m.examples?.length ? m.examples : [null]
      examples.forEach((ex, ei) => {
        const exIdx = ex ? ei : -1
        const exists = srsCards.find(c => c.wordId === w.id && c.meaningIdx === mi && c.exampleIdx === exIdx)
        if (exists) return
        const card = createSrsCard(w.id, mi, exIdx < 0 ? 0 : exIdx)
        if (card) { srsCards.push(card); totalCards++ }
      })
    })
    w.status = 'in_srs'; w.updated_at = new Date().toISOString(); ok++
  }
  saveSrsCards(); saveWords(); autoSyncAfterChange()
  toast(`📚 ${ok} palavra${ok!==1?'s':''} (${totalCards} cards) salvas`, ok > 0 ? 'success' : 'info')
  selectedWordIds.clear()
  renderReview(); renderDashboard(); updateSrsBadge()
}

function deleteSelected() {
  const ids = [...selectedWordIds]
  if (!ids.length) return
  if (!confirm(`Excluir ${ids.length} item${ids.length!==1?'s':''}?`)) return
  ids.forEach(id => {
    markDeleted(id)
    const idx = words.findIndex(w => w.id === id)
    if (idx !== -1) words.splice(idx, 1)
  })
  selectedWordIds.clear()
  activeWordId = null
  saveWords(); renderReview(); renderDashboard()
  toast(`${ids.length} item${ids.length!==1?'s':''} excluído${ids.length!==1?'s':''}`, 'info')
}

function renderWordCard(wordId) {
  const w = words.find(x => x.id === wordId)
  if (!w) return
  const main = el('review-main')

  // Context with word highlighted
  const ctxHtml = w.context ? (() => {
    const safeWord = w.word ? escR(w.word) : null
    const ctxEsc = esc(w.context)
    if (!safeWord) return ctxEsc
    return ctxEsc.replace(new RegExp(`(${safeWord})`, 'gi'), '<span class="ctx-word">$1</span>')
  })() : ''

  const typeMap = { word:'word', phrasal_verb:'phrasal verb', idiom:'idiom', collocation:'collocation' }

  const selMeanings = (w.meanings || []).filter(m => m.selected !== false)
  const selCount = selMeanings.length
  const totalCards = selMeanings.reduce((sum, m) => sum + ((m.examples && m.examples.length) || 1), 0)
  let bodyHtml

  if (w.status === 'pending_ai') {
    bodyHtml = `
    <div class="wc-pending-ai">
      <p>Esta palavra ainda não foi analisada pela IA.</p>
      <button class="btn btn-primary big-btn" onclick="analyzeWord('${w.id}')">
        ${ic('sparkles')}Analisar com IA agora
      </button>
      <p style="margin-top:12px;font-size:0.82rem;color:var(--text3)">
        A IA vai identificar todos os significados, exemplos, nível e registro automaticamente.
      </p>
    </div>`
  } else {
    bodyHtml = `
    <div class="wc-meanings">
      <div class="meanings-toolbar">
        <div class="meanings-toolbar-left">
          <span class="meanings-count">${w.meanings.length} significado${w.meanings.length !== 1 ? 's'  : ''}</span>
          <span>·</span>
          <span>${selCount} selecionado${selCount !== 1 ? 's' : ''} · ${totalCards} card${totalCards !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="selectAllMeanings('${w.id}',true)">Todos</button>
          <button class="btn btn-ghost btn-sm" onclick="selectAllMeanings('${w.id}',false)">Nenhum</button>
        </div>
      </div>
      ${w.meanings.map((m, mi) => renderMeaningItem(w.id, m, mi)).join('')}
    </div>`
  }

  main.innerHTML = `
  <div class="wc-toolbar">
    <div class="wct-left" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"></div>
    <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
      <button class="btn btn-ghost btn-sm" onclick="speakWord('${escA(w.word || w.context)}')" title="Ouvir">${ic('volume','ic-sm')}</button>
      <button class="btn btn-ghost btn-sm" onclick="skipWord('${w.id}')" title="Pular">${ic('arrowRight','ic-sm')}</button>
      <button class="btn btn-ghost btn-sm" onclick="deleteWord('${w.id}')" title="Excluir">${ic('trash','ic-sm')}</button>
    </div>
  </div>
  <div class="word-card">
    <div class="wc-header">
      <div class="wc-word" style="display:flex;align-items:center;gap:8px">
        <span id="wc-word-text-${w.id}">${esc(w.word || '(frase)')}</span>
        <button class="btn btn-ghost btn-xs" title="Editar" onclick="startEditWord('${w.id}')" id="wc-edit-btn-${w.id}" style="padding:2px 6px">${ic('pencil','ic-sm')}</button>
        <input type="text" id="wc-word-input-${w.id}" value="${escA(w.word || '')}" style="display:none;font-size:1.2rem;font-weight:700;background:var(--surface2);border:1px solid var(--primary);border-radius:6px;padding:2px 8px;color:var(--text);width:200px" onkeydown="handleEditWordKey(event,'${w.id}')" onblur="confirmEditWord('${w.id}')">
      </div>
      <div class="wc-meta">
        ${w.type ? `<span class="chip">${typeMap[w.type] || w.type}</span>` : ''}
        ${w.ipa ? `<span class="wc-ipa">${esc(w.ipa)}</span>` : ''}
        <span class="wc-source">${srcIcon(w.source_type)} ${esc(w.source_title || w.source_type)}</span>
      </div>
      ${ctxHtml ? `<div class="wc-context">"${ctxHtml}"</div>` : ''}
    </div>
    ${bodyHtml}
  </div>`
  renderWcToolbarLeft()
}

function renderMeaningItem(wordId, m, mi) {
  const sel = m.selected !== false
  const isMatch = m.context_match === true
  return `
  <div class="meaning-item ${sel ? 'selected' : ''} ${isMatch ? 'context-match' : ''}"
       onclick="toggleMeaning('${wordId}',${mi})" id="mi-${wordId}-${mi}">
    <div class="mi-checkbox"></div>
    <div class="mi-body">
      <div class="mi-top">
        <div class="mi-meaning">${esc(m.meaning_pt)}</div>
        <div class="mi-chips">
          ${isMatch ? `<span class="context-match-badge">✓ contexto</span>` : ''}
          ${m.register ? `<span class="chip register-${m.register}">${m.register}</span>` : ''}
          ${m.level ? `<span class="chip level-${m.level.toLowerCase()}">${m.level}</span>` : ''}
        </div>
      </div>
      ${m.definition_pt ? `<div class="mi-note" style="font-style:italic;opacity:0.8;margin-top:4px">${esc(m.definition_pt)}</div>` : ''}
      ${m.origin_pt ? `<div class="mi-note" style="margin-top:6px;padding:7px 10px;border-radius:var(--radius-sm);background:rgba(var(--primary-rgb),.07);border-left:3px solid rgba(var(--primary-rgb),.5);font-size:0.8rem"><b>Origem:</b> ${esc(m.origin_pt)}</div>` : ''}
      ${m.context_note ? `<div class="mi-note">${esc(m.context_note)}</div>` : ''}
      ${m.synonyms && m.synonyms.length ? `<div class="mi-note" style="font-size:0.78rem;color:var(--text3)">↔ ${m.synonyms.slice(0,4).map(esc).join(', ')}</div>` : ''}
      ${(m.examples && m.examples.length ? m.examples : (m.example_en ? [{en:m.example_en, pt:m.example_pt||''}] : [])).map((ex, ei) => ex.en ? `
      <div class="mi-example">
        <div style="display:flex;gap:8px;align-items:baseline">
          <span style="font-size:0.7rem;color:var(--text3);flex-shrink:0;font-weight:600">#${ei+1}</span>
          <div style="flex:1">
            <div class="en">"${allowBold(ex.en)}"</div>
            ${ex.pt ? `<div class="pt">"${esc(ex.pt.replace(/<\/?b>/gi,''))}"</div>` : ''}
          </div>
        </div>
      </div>` : '').join('')}
    </div>
  </div>`
}

function toggleMeaning(wordId, mi) {
  const w = words.find(x => x.id === wordId); if (!w) return
  w.meanings[mi].selected = !(w.meanings[mi].selected !== false)
  saveWords()
  // Update just this item and actions bar
  const item = el(`mi-${wordId}-${mi}`)
  if (item) {
    const sel = w.meanings[mi].selected !== false
    item.classList.toggle('selected', sel)
    item.querySelector('.mi-checkbox').style.cssText = ''
  }
  // Update toolbar + meanings count
  const selM = w.meanings.filter(m => m.selected !== false)
  const selCount2 = selM.length
  const totalCards = selM.reduce((sum, m) => sum + ((m.examples && m.examples.length) || 1), 0)
  renderWcToolbarLeft()
  const countEl = document.querySelector('.meanings-count')?.parentElement?.querySelector('span:nth-child(3)')
  if (countEl) countEl.textContent = `${selCount2} selecionado${selCount2 !== 1 ? 's' : ''} · ${totalCards} card${totalCards !== 1 ? 's' : ''}`
}

function selectAllMeanings(wordId, val) {
  const w = words.find(x => x.id === wordId); if (!w) return
  w.meanings.forEach(m => m.selected = val)
  saveWords()
  renderWordCard(wordId)
}


// ================================================================
// HELPERS DE FORMATAÇÃO DE TEXTO
// ================================================================
// Permite apenas <b> e </b> no texto do AI
function allowBold(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/&lt;b&gt;/gi,'<b>').replace(/&lt;\/b&gt;/gi,'</b>')
}

// Capitaliza o primeiro caractere alfabético, mesmo se estiver dentro de <b>
function capFirst(s) {
  if (!s) return s
  return s.replace(/^(<b>)?([a-záàãâéêíóôõúüç])/i, (_, tag, ch) => (tag || '') + ch.toUpperCase())
}

function skipWord(id) {
  const w = words.find(x => x.id === id); if (!w) return
  w.status = 'skipped'; w.updated_at = new Date().toISOString(); saveWords()
  toast(`"${w.word || '(frase)'}" pulada`, 'info')
  renderSidebar()
  const next = words.find(x => ['pending_ai','pending_review'].includes(x.status) && x.id !== id)
  if (next) { activeWordId = next.id; renderWordCard(next.id) }
  else renderReview()
  renderDashboard()
}

function deleteWord(id) {
  const w = words.find(x => x.id === id)
  if (!confirm(`Remover "${w?.word || '(frase)'}" permanentemente?`)) return
  markDeleted(id)
  words = words.filter(x => x.id !== id); saveWords()
  toast('Removida', 'info')
  const next = words.find(x => ['pending_ai','pending_review'].includes(x.status) && x.id !== id)
  if (next) { activeWordId = next.id }
  else activeWordId = null
  renderReview()
  renderDashboard()
}
