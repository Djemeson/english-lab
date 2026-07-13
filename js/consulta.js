// ================================================================
// ASSISTENTE — Consulta de inglês com IA (estilo Claude)
// ----------------------------------------------------------------
// • Histórico de conversas persistido (localStorage) + sync (firebase.js).
//   Estado `conversas`/`activeConversaId` + load/save vivem em core.js
//   (não-lazy), para o sync poder referenciá-los.
// • Respostas em STREAMING (SSE da OpenAI).
// • VÁRIOS itens de estudo por resposta, cada um com botão "Adicionar"
//   e detecção de duplicado (mostra "já no estudo").
// ================================================================

// ── Helpers de conversa ───────────────────────────────────────────
function getActiveConversa() {
  return conversas.find(c => c.id === activeConversaId) || null
}

function touchConversa(c) {
  c.updated_at = Date.now()
  // mantém a lista ordenada pela mais recente
  conversas.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
  saveConversas()
  autoSyncAfterChange()
}

function conversaTitleFrom(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return 'Nova conversa'
  return t.length > 44 ? t.slice(0, 44).trim() + '…' : t
}

function relTime(ts) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'agora'
  const m = Math.floor(s / 60); if (m < 60) return `${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `${h} h`
  const d = Math.floor(h / 24); if (d < 7) return `${d} d`
  const w = Math.floor(d / 7); if (w < 5) return `${w} sem`
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function isWordInStudy(word) {
  const w = String(word || '').trim().toLowerCase()
  if (!w) return false
  return words.some(x => (x.word || '').toLowerCase() === w)
}

// ── Render principal da seção ─────────────────────────────────────
function renderAssistente() {
  // Aplica a preferência de histórico recolhido (desktop)
  const lay = document.querySelector('.asst-layout')
  if (lay && typeof loadUiPrefs === 'function') {
    lay.classList.toggle('hist-collapsed', !!loadUiPrefs().histCollapsed)
  }
  // Se não há conversa ativa e existem conversas, abre a mais recente
  if (!activeConversaId && conversas.length) {
    activeConversaId = conversas[0].id
  }
  renderConversaList()
  renderActiveConversa()
}

function renderConversaList() {
  const list = el('asst-conv-list'); if (!list) return
  const q = (el('asst-search-input')?.value || '').trim().toLowerCase()
  let items = conversas.slice().sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
  if (q) {
    items = items.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.messages || []).some(m => (m.content || '').toLowerCase().includes(q)))
  }
  if (!items.length) {
    list.innerHTML = `<div class="asst-conv-empty">${q ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.'}</div>`
    return
  }
  list.innerHTML = items.map(c => `
    <div class="asst-conv-item ${c.id === activeConversaId ? 'active' : ''}" onclick="selectConversa('${c.id}')">
      <div class="asst-conv-main">
        <div class="asst-conv-title">${esc(c.title || 'Conversa')}</div>
        <div class="asst-conv-time">${esc(relTime(c.updated_at))}</div>
      </div>
      <div class="asst-conv-actions">
        <button class="asst-conv-act" onclick="event.stopPropagation();renameConversa('${c.id}')" title="Renomear">${ic('pencil','ic-sm')}</button>
        <button class="asst-conv-act" onclick="event.stopPropagation();deleteConversa('${c.id}')" title="Excluir">${ic('trash','ic-sm')}</button>
      </div>
    </div>`).join('')
}

function asstEmptyState() {
  const L = getLangDef(activeLang())
  const SUGG = {
    en: ['O que significa "breaking bad"?', 'Como usar "nevertheless"?', 'Diferença entre "speak" e "talk"', 'Me explica o phrasal verb "put up with"'],
    es: ['O que significa "echar de menos"?', 'Como usar "sin embargo"?', 'Diferença entre "ser" e "estar" em espanhol', 'Me explica o verbo pronominal "ponerse"'],
    fr: ['O que significa "poser un lapin"?', 'Como usar "quand même"?', 'Diferença entre "savoir" e "connaître"', 'Me explica o verbo pronominal "se débrouiller"'],
    de: ['O que significa "die Daumen drücken"?', 'Como usar "doch"?', 'Diferença entre "kennen" e "wissen"', 'Me explica o verbo separável "aufgeben"'],
  }
  const sugg = SUGG[L.code] || [
    `O que significa uma expressão comum em ${L.name.toLowerCase()}?`,
    `Como se diz "sentir falta" em ${L.name.toLowerCase()}?`,
    `Quais expressões idiomáticas básicas de ${L.name.toLowerCase()}?`,
    `Me explica uma expressão verbal de ${L.name.toLowerCase()}`
  ]
  return `<div class="consulta-empty" id="consulta-empty">
    ${ic('sparkles','ic-xl')}
    <p style="font-weight:700;font-size:1.05rem">Pergunte qualquer coisa em ${esc(L.name.toLowerCase())}</p>
    <p style="font-size:0.86rem;max-width:440px">Significados, pronúncia, diferenças de uso, gírias, origem de expressões — e mande os termos direto para o seu estudo.</p>
    <div class="asst-suggestions">
      ${sugg.map(s => `<button class="asst-sugg" onclick="askSuggestion(${escA(JSON.stringify(s))})">${esc(s)}</button>`).join('')}
    </div>
  </div>`
}

function renderActiveConversa() {
  const msgs = el('consulta-messages'); if (!msgs) return
  const c = getActiveConversa()
  const titleEl = el('asst-mobile-title')
  if (titleEl) titleEl.textContent = c ? (c.title || 'Conversa') : 'Assistente'
  if (!c || !c.messages.length) { msgs.innerHTML = asstEmptyState(); return }
  msgs.innerHTML = c.messages.map((m, i) => renderMsgHTML(m, i)).join('')
  msgs.scrollTop = msgs.scrollHeight
}

function renderMsgHTML(m, idx) {
  if (m.role === 'user') {
    return `<div class="consulta-msg user">${esc(m.content)}</div>`
  }
  return `<div class="consulta-msg ai" id="cmsg-${idx}">${formatConsultaReply(m.content || '')}${renderSrsItemsHTML(m.srsItems, idx)}</div>`
}

function renderSrsItemsHTML(items, msgIdx) {
  if (!Array.isArray(items) || !items.length) return ''
  const valid = items.filter(it => it && it.word)
  if (!valid.length) return ''
  const chips = valid.map((it, i) => {
    const inStudy = isWordInStudy(it.word)
    const _tl = it.type_label || (it.type && it.type !== 'word' ? String(it.type).replace('_',' ') : '')
    const typeLbl = _tl ? ` <span class="asst-srs-type">${esc(_tl)}</span>` : ''
    if (inStudy) {
      return `<span class="asst-srs-added">${ic('check','ic-sm')}<span>${esc(it.word)} <em>já no estudo</em></span></span>`
    }
    return `<button class="asst-srs-btn" onclick="addConsultaItemToSrs(${msgIdx},${i})">${ic('plus','ic-sm')}<span>${esc(it.word)}${typeLbl}</span></button>`
  }).join('')
  const pending = valid.filter(it => !isWordInStudy(it.word)).length
  const head = `<div class="asst-srs-head"><span>${valid.length} termo${valid.length !== 1 ? 's' : ''} desta resposta</span>${pending > 1 ? `<button class="asst-srs-all" onclick="addAllConsultaItems(${msgIdx})">Adicionar todos (${pending})</button>` : ''}</div>`
  return `<div class="asst-srs-items">${head}<div class="asst-srs-chips">${chips}</div></div>`
}

// ── Ações de conversa ─────────────────────────────────────────────
function newConversa() {
  activeConversaId = null
  closeAsstSidebar()
  renderConversaList()
  renderActiveConversa()
  setTimeout(() => el('consulta-input')?.focus(), 50)
}

function selectConversa(id) {
  activeConversaId = id
  closeAsstSidebar()
  renderConversaList()
  renderActiveConversa()
}

function deleteConversa(id) {
  const c = conversas.find(x => x.id === id); if (!c) return
  if (!confirm(`Excluir a conversa "${c.title || 'Conversa'}"? Isso não pode ser desfeito.`)) return
  conversas = conversas.filter(x => x.id !== id)
  if (activeConversaId === id) activeConversaId = conversas.length ? conversas[0].id : null
  saveConversas()
  autoSyncAfterChange()
  renderAssistente()
  toast('Conversa excluída', 'info')
}

function renameConversa(id) {
  const c = conversas.find(x => x.id === id); if (!c) return
  inputModal({
    title: 'Renomear conversa',
    value: c.title || '',
    placeholder: 'Título da conversa',
    onConfirm: (val) => {
      const t = (val || '').trim()
      if (!t) return
      c.title = t
      touchConversa(c)
      renderConversaList()
      const titleEl = el('asst-mobile-title')
      if (titleEl && activeConversaId === id) titleEl.textContent = t
    }
  })
}

function askSuggestion(text) {
  const input = el('consulta-input')
  if (input) { input.value = text; autoGrowConsulta(input) }
  sendConsulta()
}

// ── Input: auto-grow e sidebar mobile ─────────────────────────────
function autoGrowConsulta(ta) {
  if (!ta) return
  ta.style.height = 'auto'
  ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
}
function toggleAsstSidebar() { el('asst-sidebar')?.classList.toggle('open') }
function closeAsstSidebar() { el('asst-sidebar')?.classList.remove('open') }

// Recolhe/expande a coluna de histórico (no desktop) ou abre o drawer (no mobile)
function toggleHistory() {
  if (window.matchMedia('(max-width:860px)').matches) { toggleAsstSidebar(); return }
  const lay = document.querySelector('.asst-layout'); if (!lay) return
  lay.classList.toggle('hist-collapsed')
  if (typeof saveUiPref === 'function') saveUiPref('histCollapsed', lay.classList.contains('hist-collapsed'))
}

// ── Envio com streaming ───────────────────────────────────────────
// A resposta visível é conversacional e limpa (sem JSON). Os itens de estudo
// são extraídos DEPOIS, numa chamada dedicada (garante os botões mesmo em
// perguntas PT→EN como "como se diz X em inglês").
// Multi-idioma: os prompts são funções do idioma ativo (seletor na barra do chat)
function consultaSystem() {
  const L = getLangDef(activeLang())
  const nome = L.name.toLowerCase()
  return `Você é um tutor de ${nome} especialista ajudando um brasileiro a aprender. Responda SEMPRE em português (exceto os exemplos em ${nome}), de forma clara e didática.

Quando o usuário perguntar sobre palavras/expressões em ${nome} — ou pedir "como se diz" algo em ${nome}:
1. Dê a tradução/expressão em ${nome} e explique o significado em português.
2. Mostre a pronúncia em IPA (entre barras: //).
3. Dê alguns exemplos de uso em ${nome} com tradução.
4. Acrescente contexto útil: origem/história quando interessante, registro (formal/informal), diferenças de uso, variações regionais.

FORMATO da resposta (texto que o usuário lê):
- Escreva em texto corrido e natural. Para destacar, use **negrito** (markdown).
- NÃO use títulos com # nem blocos de código com crases. NÃO mostre JSON.`
}

// Extrator dedicado de itens de estudo (roda após a resposta)
function srsExtractSystem() {
  const L = getLangDef(activeLang())
  const nome = L.name.toLowerCase()
  return `A partir de um diálogo entre um aprendiz brasileiro e um tutor de ${nome}, extraia TODOS os termos/expressões EM ${L.name.toUpperCase()} que valem virar flashcard de estudo.
Regras:
- Inclua os termos em ${nome} MESMO quando a pergunta foi em português (ex.: "como se diz X em ${nome}?" → extraia a(s) tradução(ões) em ${nome} dadas na resposta).
- Em "qual a diferença entre X e Y", inclua X e Y.
- Inclua palavras significativas e ${L.variantHint} REALMENTE presentes na resposta. Deduplique. NÃO invente termos ausentes.
- Se não houver nada que valha a pena estudar, retorne lista vazia.
- Sobre "type" (supertipos universais): ${L.typeRule}
Para CADA item retorne:
{"word":"<termo em ${nome}>","type":"word|phrasal_verb|idiom|collocation","type_label":"<categoria local precisa em PT, ou \\"\\">","variety":"${promptVarietyEnum(activeLang())}","register":"neutral|formal|informal|colloquial|slang|technical|literary|archaic|vulgar","meaning_pt":"2-6 palavras","ipa":${promptIpaRule(activeLang())},"definition_pt":"uma frase em PT","origin_pt":"origem/história em PT (1-2 frases) SÓ se houver etimologia/imagem interessante; senão \\"\\"","examples":[{"en":"Frase com <b>termo</b>.","pt":"Tradução com o <b>equivalente</b>."},{"en":"Outra frase com <b>termo</b>.","pt":"Tradução com o <b>equivalente</b>."},{"en":"Mais uma com <b>termo</b>.","pt":"Tradução com o <b>equivalente</b>."}]}
Cada item tem EXATAMENTE 3 exemplos, em tempos/construções diferentes.
Regras de negrito — CRÍTICO, nos dois lados de cada exemplo:
- Frase em ${nome}: envolva o termo em <b></b> exatamente como aparece flexionado/conjugado naquela frase (ex.: "ran" para "run", não a forma de dicionário). Para expressão de múltiplas palavras ou verbo separável, envolva TODAS as partes mesmo que haja outra palavra no meio; para idiom, envolva a expressão inteira.
- Português: envolva a palavra ou trecho curto que é o equivalente em português do termo NAQUELA frase (a tradução ali, não um significado de dicionário) em <b></b>.
- Se o termo aparecer mais de uma vez na frase, envolva só a ocorrência principal.
- Exatamente UM trecho em negrito por lado. Não envolva mais nada.
Retorne JSON: {"items":[ ... ]}`
}

async function _consultaOpenAIJSON(messages, maxTokens) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.aiModel || 'gpt-4o-mini', max_tokens: maxTokens, response_format: { type: 'json_object' }, messages })
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  return JSON.parse((data.choices?.[0]?.message?.content || '{}').trim())
}

async function extractSrsItems(question, answer) {
  try {
    const r = await _consultaOpenAIJSON([
      { role: 'system', content: srsExtractSystem() },
      { role: 'user', content: `PERGUNTA DO ALUNO:\n${question}\n\nRESPOSTA DO TUTOR:\n${answer}` }
    ], 2500)
    return Array.isArray(r.items) ? r.items.filter(it => it && it.word) : []
  } catch (e) { console.warn('[consulta] extração SRS falhou:', e.message); return [] }
}

// Loader sutil de "procurando termos" no fim da última bolha da IA
function showSrsLoading() {
  const msgs = el('consulta-messages'); if (!msgs) return
  const bubbles = msgs.querySelectorAll('.consulta-msg.ai')
  const last = bubbles[bubbles.length - 1]; if (!last) return
  if (last.querySelector('.asst-srs-loading')) return
  last.insertAdjacentHTML('beforeend', `<div class="asst-srs-loading"><span class="spinner"></span><span>Procurando termos para estudo…</span></div>`)
  msgs.scrollTop = msgs.scrollHeight
}

async function sendConsulta() {
  const input = el('consulta-input')
  const question = input?.value.trim()
  if (!question) return
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'warning'); return }

  // Garante uma conversa ativa (cria na 1ª mensagem)
  let c = getActiveConversa()
  if (!c) {
    c = { id: uid(), title: conversaTitleFrom(question), created_at: Date.now(), updated_at: Date.now(), messages: [] }
    conversas.unshift(c)
    activeConversaId = c.id
  } else if (!c.messages.length || c.title === 'Nova conversa') {
    c.title = conversaTitleFrom(question)
  }

  input.value = ''
  autoGrowConsulta(input)
  input.disabled = true
  const sendBtn = el('consulta-send-btn'); if (sendBtn) sendBtn.disabled = true

  // Mensagem do usuário
  c.messages.push({ role: 'user', content: question })
  touchConversa(c)
  renderConversaList()
  renderActiveConversa()

  // Bolha de resposta em streaming
  const msgs = el('consulta-messages')
  const streamId = 'cstream-' + Date.now()
  msgs.insertAdjacentHTML('beforeend',
    `<div class="consulta-msg ai" id="${streamId}"><span class="asst-typing"><span></span><span></span><span></span></span></div>`)
  msgs.scrollTop = msgs.scrollHeight

  // Histórico para a API (texto visível, enxuto)
  const apiHistory = c.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }))

  let full = ''
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.aiModel || 'gpt-4o-mini',
        messages: [{ role: 'system', content: consultaSystem() }, ...apiHistory],
        temperature: 0.7,
        stream: true
      })
    })
    if (!res.ok) { let e = {}; try { e = await res.json() } catch {} throw new Error(e.error?.message || ('HTTP ' + res.status)) }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const bubble = el(streamId)
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const payload = t.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const j = JSON.parse(payload)
          const delta = j.choices?.[0]?.delta?.content
          if (delta) {
            full += delta
            if (bubble) {
              bubble.innerHTML = formatConsultaReply(stripSrsBlocks(full))
              msgs.scrollTop = msgs.scrollHeight
            }
          }
        } catch {}
      }
    }

    // Limpeza do texto visível
    const cleanReply = cleanConsultaReply(full)

    // Persiste a mensagem do assistente (itens vêm logo a seguir)
    const aiMsg = { role: 'assistant', content: cleanReply, srsItems: [] }
    c.messages.push(aiMsg)
    touchConversa(c)
    renderConversaList()
    renderActiveConversa()

    // Extração dedicada dos termos de estudo (garante os botões, inclusive PT→EN)
    showSrsLoading()
    aiMsg.srsItems = await extractSrsItems(question, cleanReply)
    touchConversa(c)
    renderActiveConversa()

  } catch (e) {
    el(streamId)?.remove()
    // Remove a pergunta órfã do histórico de API? Mantemos a pergunta visível e mostramos erro.
    msgs.insertAdjacentHTML('beforeend',
      `<div class="consulta-msg ai">${ic('alert','ic-sm')} Erro: ${esc(e.message)}</div>`)
    msgs.scrollTop = msgs.scrollHeight
  } finally {
    if (input) { input.disabled = false; input.focus() }
    if (sendBtn) sendBtn.disabled = false
  }
}

// ── Limpeza da resposta ───────────────────────────────────────────
// Remove os blocos srs (mesmo incompletos, durante o streaming) — defensivo,
// caso o modelo ainda emita algum JSON apesar do prompt pedir texto limpo.
function stripSrsBlocks(text) {
  let t = text.replace(/<srs_items>[\s\S]*?<\/srs_items>/g, '')
              .replace(/<srs_item>[\s\S]*?<\/srs_item>/g, '')
  // bloco aberto mas ainda não fechado (streaming): corta a partir da abertura
  t = t.replace(/<srs_items>[\s\S]*$/g, '').replace(/<srs_item>[\s\S]*$/g, '')
  return t.trim()
}

function cleanConsultaReply(reply) {
  let t = stripSrsBlocks(reply)
  t = t.replace(/```[a-z]*\s*[\s\S]*?```/gi, '')
       .replace(/^\s*(bloco\s+json|json)\s*:?.*$/gim, '')
       // remove array/objeto JSON cru que tenha vazado com "word":
       .replace(/\[[\s\S]*?"word"[\s\S]*?\]/g, '')
       .replace(/\{[\s\S]*?"word"[\s\S]*?\}/g, '')
       .trim()
  return t
}

// Renderiza markdown leve da resposta da IA (mesma lógica do projeto)
function formatConsultaReply(text) {
  let t = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  t = t.replace(/&lt;(\/?(?:b|strong|i|em))&gt;/gi, '<$1>')
  t = t.replace(/^\s*#{1,6}\s*(.+?)\s*$/gm, '<div class="cs-h">$1</div>')
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/`(.+?)`/g, '<code class="cs-code">$1</code>')
  t = t.replace(/^\s*[-•]\s+(.+)$/gm, '<li>$1</li>')
  t = t.replace(/(<li>[\s\S]*?<\/li>)/, '<ul class="cs-ul">$1</ul>')
  t = t.replace(/<\/div>\n/g, '</div>').replace(/<\/ul>\n/g, '</ul>')
  t = t.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>')
  return t
}

// ── Adicionar itens ao estudo (SRS) ───────────────────────────────
function _consultaItemToWord(item) {
  const exs = (Array.isArray(item.examples) && item.examples.length)
    ? item.examples.filter(e => e && e.en).map(e => ({ en: e.en, pt: e.pt || '' }))
    : (item.example_en ? [{ en: item.example_en, pt: item.example_pt || '' }] : [])
  const w = createWord({
    word: item.word,
    context: (exs[0] && exs[0].en ? exs[0].en : item.example_en || '').replace(/<\/?b>/gi, '').trim(),
    source_type: 'manual',
    lang: item.lang || activeLang()
  })
  w.meanings = [{
    meaning_pt: item.meaning_pt || '',
    definition_pt: item.definition_pt || '',
    origin_pt: item.origin_pt || '',
    type_label: item.type_label || '',
    examples: exs,
    variety: item.variety || 'general',
    register: (item.register && item.register !== 'standard') ? item.register : 'neutral',
    selected: true
  }]
  w.ipa = item.ipa || ''
  w.type = item.type || 'word'
  w.type_label = item.type_label || ''
  w.status = 'pending_review'
  w.ai_processed = true
  w.updated_at = new Date().toISOString()
  return w
}

function addConsultaItemToSrs(msgIdx, itemIdx) {
  try {
    const c = getActiveConversa(); if (!c) return
    const msg = c.messages[msgIdx]; if (!msg || !Array.isArray(msg.srsItems)) return
    const item = msg.srsItems[itemIdx]
    if (!item || !item.word) { toast('Item não encontrado', 'warning'); return }
    if (isWordInStudy(item.word)) { toast(`"${item.word}" já está no estudo`, 'info'); renderActiveConversa(); return }
    const w = _consultaItemToWord(item)
    saveWords()
    renderDashboard()
    updateSrsBadge()
    saveToSrs(w.id)   // mostra o toast com a contagem de cards
    renderActiveConversa()
  } catch (e) { toast('Erro ao adicionar: ' + e.message, 'error') }
}

function addAllConsultaItems(msgIdx) {
  try {
    const c = getActiveConversa(); if (!c) return
    const msg = c.messages[msgIdx]; if (!msg || !Array.isArray(msg.srsItems)) return
    const pending = msg.srsItems.filter(it => it && it.word && !isWordInStudy(it.word))
    if (!pending.length) { toast('Todos já estão no estudo', 'info'); return }
    let n = 0
    pending.forEach(item => { const w = _consultaItemToWord(item); saveToSrs(w.id); n++ })
    saveWords()
    renderDashboard()
    updateSrsBadge()
    renderActiveConversa()
    toast(`${n} termo${n !== 1 ? 's' : ''} adicionado${n !== 1 ? 's' : ''} ao estudo`, 'success')
  } catch (e) { toast('Erro ao adicionar: ' + e.message, 'error') }
}
