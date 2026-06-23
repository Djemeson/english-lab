// ================================================================
// MANUAL ADD
// ================================================================
function setManualSource(el_) {
  document.querySelectorAll('#m-source-chips .src-chip').forEach(c => c.classList.remove('active'))
  el_.classList.add('active')
  const isManual = el_.dataset.val === 'manual'
  const wrap = el('m-title-wrap')
  if (wrap) { wrap.style.display = isManual ? 'none' : 'block' }
  if (!isManual) el('m-title')?.focus()
}

function checkManualDup(val) {
  const w = val.trim().toLowerCase()
  const warn = el('m-dup-warn')
  if (!warn) return
  if (w.length < 2) { warn.style.display = 'none'; return }
  const match = words.find(x => (x.word || '').toLowerCase() === w)
  if (match) {
    warn.style.display = 'flex'
    const wd = el('m-dup-word'); if (wd) wd.textContent = val.trim()
  } else {
    warn.style.display = 'none'
  }
}

function addManual() {
  const word = el('m-word').value.trim()
  const ctx = el('m-ctx').value.trim()
  if (!word && !ctx) { toast('Preencha a palavra ou a frase', 'warning'); return }
  const srcType = document.querySelector('#m-source-chips .src-chip.active')?.dataset.val || 'manual'
  const srcTitle = (el('m-title')?.value || '').trim()
  createWord({ word, context: ctx, source_type: srcType, source_title: srcTitle })
  el('m-word').value = ''; el('m-ctx').value = ''
  if (el('m-title')) el('m-title').value = ''
  el('m-word')?.focus()
  const warn = el('m-dup-warn'); if (warn) warn.style.display = 'none'
  renderDashboard()
  toast('Adicionado à fila de revisão!', 'success')
}


// ================================================================
// KINDLE PARSER — HTML/TXT/CSV
// ================================================================
// Hash simples para identificar um highlight (baseado no texto)
function kindleHighlightHash(text) {
  let h = 0
  for (let i = 0; i < Math.min(text.length, 200); i++)
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

function loadKindleSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SK.kindleSeen) || '[]')) } catch { return new Set() }
}

function saveKindleSeen(seen) {
  localStorage.setItem(SK.kindleSeen, JSON.stringify([...seen]))
}

function markKindleItemsAsSeen(items) {
  const seen = loadKindleSeen()
  items.forEach(item => seen.add(kindleHighlightHash(item.context || item.word)))
  saveKindleSeen(seen)
}

function handleKindleFile(input) {
  const file = input.files[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = async e => {
    const text = e.target.result
    const name = file.name.toLowerCase()
    let allItems
    // Detecta formato por conteúdo (mais confiável que extensão)
    if (name.endsWith('.html') || name.endsWith('.htm') || text.includes("class='noteText'") || text.includes('class="noteText"')) {
      allItems = parseKindleHTML(text)
    } else if (name.endsWith('.csv') && text.split('\n')[0]?.match(/word|usage|stem/i)) {
      allItems = parseKindleCSV(text)
    } else if (/PÁGINA\s+\d+\s*[•·]\s*(DESTAQUE|MARCAÇÃO)/i.test(text) || /PAGE\s+\d+\s*[•·]\s*HIGHLIGHT/i.test(text)) {
      allItems = parseKindleAndroidExport(text)
    } else if (/={5,}/.test(text)) {
      allItems = parseKindleClippings(text)
    } else {
      // Tenta Android export como fallback para .txt não reconhecido
      allItems = parseKindleAndroidExport(text)
      if (!allItems.length) allItems = parseKindleClippings(text)
    }

    // Filtrar highlights já processados
    const seen = loadKindleSeen()
    const newItems = allItems.filter(item => {
      const hash = kindleHighlightHash(item.context || item.word)
      return !seen.has(hash)
    })
    const skipped = allItems.length - newItems.length

    kindleItems = newItems
    // Mostra loading enquanto processa em lote
    el('kindle-drop').classList.add('hidden')
    el('kindle-result').classList.remove('hidden')
    el('kindle-count').textContent = `⏳ Traduzindo ${kindleItems.length} destaques...`
    el('kindle-list').innerHTML = `<div style="padding:32px;text-align:center;color:var(--text3)">
      <div style="font-size:1.5rem;margin-bottom:12px">🔄</div>
      <div>Processando todos os destaques com IA...</div>
      <div style="font-size:0.82rem;margin-top:8px;color:var(--text3)">Isso pode levar alguns segundos</div>
    </div>`
    // Processa em lote e depois salva + renderiza
    await analyzeKindleItems()
    saveKindleQueue()
    renderKindleList(skipped, allItems.length)
  }
  reader.readAsText(file, 'utf-8')
  input.value = ''
}

// Persistência da fila Kindle
function saveKindleQueue() {
  localStorage.setItem(SK.kindleQueue, JSON.stringify(kindleItems))
  autoSyncAfterChange()
}

function loadKindleQueue() {
  try {
    const saved = JSON.parse(localStorage.getItem(SK.kindleQueue) || '[]')
    if (saved.length > 0) {
      const seen = loadKindleSeen()
      kindleItems = saved.filter(item => !seen.has(kindleHighlightHash(item.context || item.word)))
      if (kindleItems.length < saved.length) localStorage.setItem(SK.kindleQueue, JSON.stringify(kindleItems))
      return kindleItems.length > 0
    }
  } catch {}
  return false
}

function clearKindleQueue() {
  kindleItems = []
  localStorage.removeItem(SK.kindleQueue)
  autoSyncAfterChange()
}

function parseKindleHTML(html) {
  // Extrai book title
  const titleMatch = html.match(/class='bookTitle'>([^<]+)/)
  const bookTitle = titleMatch ? titleMatch[1].replace(/\n/g,' ').trim() : 'Kindle'

  // Extrai chapters e highlights em ordem de posição no documento
  const events = []
  const chapRe = /class='sectionHeading'>([^<]+)<\/h2>/g
  const noteRe = /class='noteText'>([^<]+)/g
  let m
  while ((m = chapRe.exec(html)) !== null) events.push({ t: 'ch', text: m[1].trim(), pos: m.index })
  while ((m = noteRe.exec(html)) !== null) {
    const text = m[1].trim()
    if (text && text.length >= 2) events.push({ t: 'note', text, pos: m.index })
  }
  events.sort((a,b) => a.pos - b.pos)

  const items = []
  let chapter = ''
  events.forEach(ev => {
    if (ev.t === 'ch') { chapter = ev.text }
    else { items.push({ word:'', context: ev.text, source_type:'kindle', source_title: bookTitle, chapter }) }
  })
  return items
}

function parseKindleClippings(text) {
  const bookTitle = 'My Clippings'
  return text.split(/={10,}/).map(s => s.trim()).filter(Boolean).reduce((acc, entry) => {
    const lines = entry.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return acc
    const meta = lines[1]
    if (!meta.startsWith('-')) return acc
    if (/bookmark|note/i.test(meta)) return acc
    const content = lines.slice(2).join(' ').trim()
    if (content.length >= 2)
      acc.push({ word:'', context: content, source_type:'kindle', source_title: lines[0].replace(/\(.*?\)$/, '').trim() })
    return acc
  }, [])
}

function parseKindleAndroidExport(text) {
  // Formato do Kindle Android: "PÁGINA X • DESTAQUE (COR)" + texto
  // Também suporta versão em inglês: "PAGE X • HIGHLIGHT (COLOR)"
  const lines = text.split('\n').map(l => l.trim())

  // Tenta extrair título (primeiras linhas não-vazias antes do primeiro PÁGINA/PAGE)
  let bookTitle = 'Kindle'
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    if (lines[i] && !/^(PÁGINA|PAGE|LOCATION|\d)/i.test(lines[i])) {
      bookTitle = lines[i]
      break
    }
  }

  const items = []
  const headerRe = /^(PÁGINA|PAGE)\s+\d+\s*[•·•]\s*(DESTAQUE|HIGHLIGHT|MARCAÇÃO)/i
  const noteRe   = /^(NOTA|NOTE)\s*[:\-]/i
  const citationRe = /["""]\s*\(([^)]+,\s*\d{4}[^)]*|[^)]+,\s*p\.\s*\d+[^)]*)\)\s*$/ // remove APA/MLA/Chicago

  let i = 0
  while (i < lines.length) {
    if (headerRe.test(lines[i])) {
      i++
      // Coleta linhas de texto até o próximo header ou nota
      const textParts = []
      while (i < lines.length && !headerRe.test(lines[i]) && !noteRe.test(lines[i])) {
        if (lines[i]) textParts.push(lines[i])
        i++
      }
      let ctx = textParts.join(' ')
        .replace(/^["""']+|["""']+$/g, '')           // remove aspas envolventes
        .replace(citationRe, '')                      // remove citação APA/MLA/Chicago
        .replace(/\s*\([A-Z][^)]+,\s*\d{4}[^)]*\)\s*$/, '') // mais padrões de citação
        .replace(/[,;.]+$/, '')                       // remove pontuação final
        .trim()
      if (ctx && ctx.length > 2) {
        items.push({ word: '', context: ctx, source_type: 'kindle', source_title: bookTitle })
      }
    } else if (noteRe.test(lines[i])) {
      // Pula notas do usuário
      i++
      while (i < lines.length && !headerRe.test(lines[i])) i++
    } else {
      i++
    }
  }
  return items
}

function parseKindleCSV(text) {
  const lines = text.split('\n')
  const hasHeader = /word|usage/i.test(lines[0])
  return lines.slice(hasHeader ? 1 : 0).reduce((acc, line) => {
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim())
    const word = cols[0] || ''; const context = cols.find((c,i) => i>0 && c.length>10) || ''
    if (word || context) acc.push({ word, context, source_type:'kindle', source_title: cols[4] || 'Kindle' })
    return acc
  }, [])
}

function resetKindleUpload(clearQueue = true) {
  kindleItems = []
  if (clearQueue) clearKindleQueue()
  el('kindle-result').classList.add('hidden')
  el('kindle-drop').classList.remove('hidden')
  el('kindle-file').value = ''
}

function renderKindleList(skipped, total) {
  const list = el('kindle-list')
  const skipInfo = skipped > 0 ? ` · ${skipped} já processados ignorados` : ''
  const totalInfo = total && total !== kindleItems.length ? ` (${total} no arquivo)` : ''
  el('kindle-count').textContent = `${kindleItems.length} novos destaques${skipInfo}${totalInfo}`
  el('kindle-drop').classList.add('hidden')
  el('kindle-result').classList.remove('hidden')
  list.innerHTML = kindleItems.map((item, i) => {
    const hasContext = !!item.context
    const iwords = getItemWords(item)
    const chipContent = iwords.length
      ? `<div id="ke-wrap-${i}" style="display:flex;gap:5px;flex-wrap:wrap">${iwords.map((w,wi)=>`<span class="kindle-expr-chip" style="display:inline-flex;align-items:center;gap:4px">${esc(w)}<span onclick="removeKindleWord(${i},${wi})" style="cursor:pointer;opacity:.55;margin-left:2px;font-size:1rem;line-height:1">×</span></span>`).join('')}</div>`
      : (cfg.openaiKey
          ? `<div id="ke-wrap-${i}"><span style="font-size:0.75rem;color:var(--text3);font-style:italic">⏳ analisando...</span></div>`
          : `<div id="ke-wrap-${i}"><span style="font-size:0.75rem;color:var(--text3);font-style:italic">selecione com o mouse</span></div>`)
    const sentenceHTML = hasContext ? esc(item.context) : esc(item.word || '')
    const vocabRefHTML = item.vocab_ref?.length
      ? `<div style="font-size:0.78rem;color:var(--text2);margin-top:5px;display:flex;flex-wrap:wrap;gap:8px">`
        + item.vocab_ref.map(v => v.expr
          ? `<span>📌 ${v.expr}${v.type ? ` <span style="font-size:0.65rem;background:rgba(59,130,246,.15);color:var(--primary);border-radius:3px;padding:1px 4px">${v.type}</span>` : ''}</span>`
          : '').filter(Boolean).join(' ')
        + '</div>'
      : ''
    return `
    <div class="parsed-item" id="ki-${i}">
      <input type="checkbox" class="kindle-check" data-i="${i}" checked>
      <div class="parsed-item-body">
        <div class="kindle-sentence selectable-sentence" id="ks-${i}" onmouseup="handleSentenceMouseUp(event,${i},'kindle')" title="Selecione com o mouse para adicionar ao estudo">${sentenceHTML}</div>
        <div class="kindle-sentence-pt" id="ks-pt-${i}">${esc(item.context_pt || '')}</div>
        ${vocabRefHTML}
        <div class="kindle-expr-row" style="flex-wrap:wrap;gap:5px;margin-top:6px">
          ${chipContent}
        </div>
        <div class="parsed-meta">📖 ${esc(item.source_title)}${item.chapter ? ' · ' + esc(item.chapter) : ''}</div>
      </div>
    </div>`
  }).join('')
  analyzeKindleItems()
}

async function analyzeKindleItems() {
  if (!cfg.openaiKey || !kindleItems.length) return

  const BATCH = 20  // menor para mais precisão e menos falhas

  const SYSTEM_PROMPT = `Analyze each numbered English sentence. Your job:
1. Find ALL phrasal verbs, idioms, collocations, and slang present. Be exhaustive — do not skip subtle ones.

Examples of what to catch:
- Phrasal verbs: "give up", "trailed off", "lifted it off", "take off", "put up with"
- Idioms: "grit his teeth", "break the ice", "take the black", "blood ran cold"
- Collocations: "lick his lips", "blood matted", "raise an eyebrow", "heart sank"
- Slang: "freaked out", "bail", "crash"

Do NOT include plain difficult words (e.g. "ephemeral", "gorget"). Only multi-word expressions or set phrases.
If none found, return empty vocab [].

2. Translate the full sentence naturally to Brazilian Portuguese.
For short inputs (1-3 words), return vocab [] and word meaning as trans.

Return ONLY valid JSON:
{"items":[{"i":<n>,"vocab":["expression1","expression2"],"trans":"<full Portuguese translation>"}]}`

  for (let start = 0; start < kindleItems.length; start += BATCH) {
    const batch = kindleItems.slice(start, start + BATCH)

    // Separa itens com frase de itens com só palavra
    const lines = batch.map((item, j) => {
      const idx = start + j
      const ctx = (item.context || '').replace(/"/g, "'").trim()
      const hasWord = item.word && item.word !== ctx
      if (ctx.split(/\s+/).length <= 2) {
        // Highlight de palavra única ou dupla — não tem frase
        return `${idx}. WORD: "${ctx}"`
      }
      return `${idx}. "${ctx}"${hasWord ? ` [known: ${item.word}]` : ''}`
    }).join('\n')

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: Math.max(800, batch.length * 60),
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `${lines}\n\nReturn JSON for ALL ${batch.length} items.` }
          ]
        })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      let raw = (data.choices?.[0]?.message?.content || '{}')
        .replace(/```(?:json)?\n?|\n?```/g, '').trim()
      const result = JSON.parse(raw)
      if (Array.isArray(result.items)) {
        result.items.forEach(({ i, item, trans }) => {
          const idx = Number(i)
          if (isNaN(idx) || idx < 0 || idx >= kindleItems.length) return
          const ptStr = String(trans || '').trim()
          const isInstructionLeak = /global.?index|cada item|utiliza|return|json|vocabulary/i.test(ptStr)
          if (ptStr && !isInstructionLeak) {
            kindleItems[idx].context_pt = ptStr
            const ptEl = document.getElementById(`ks-pt-${idx}`)
            if (ptEl) ptEl.textContent = ptStr
          }
          if (!item) return
          const clean = String(item).toLowerCase()
            .replace(/[.,!?;:"""\''()\n\[\]]/g, '').trim()
          if (clean && clean.length > 0) {
            if (!Array.isArray(kindleItems[idx].words)) kindleItems[idx].words = []
            if (!kindleItems[idx].words.includes(clean)) kindleItems[idx].words = [clean]
            kindleItems[idx].word = clean // compat
          }
        })
      }
    } catch(e) {
      console.warn(`[Kindle] Lote ${start}-${start+BATCH} falhou:`, e.message)
    }
  }
}

function buildPicker(text, idx) {
  return text.split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok)) return tok
    const w = tok.replace(/[.,!?;:"""''()[\]]/g, '')
    return `<span class="wp-tok" data-i="${idx}" data-w="${escA(w)}">${esc(tok)}</span>`
  }).join('')
}

function highlightExpression(container, expression) {
  const tokens = [...container.querySelectorAll('.wp-tok')]
  tokens.forEach(t => t.classList.remove('sel', 'sel-multi'))
  const words = expression.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 1) {
    const tok = tokens.find(t => t.dataset.w?.toLowerCase() === words[0])
    if (tok) tok.classList.add('sel')
    return
  }
  // Tenta encontrar a sequência exata no texto
  for (let i = 0; i <= tokens.length - words.length; i++) {
    if (words.every((w, j) => tokens[i + j]?.dataset.w?.toLowerCase() === w)) {
      words.forEach((_, j) => tokens[i + j].classList.add('sel-multi'))
      return
    }
  }
  // Fallback: destaca tokens individuais que fazem parte da expressão
  tokens.forEach(t => { if (words.includes(t.dataset.w?.toLowerCase())) t.classList.add('sel-multi') })
}

function highlightExprInSentence(sentence, expression) {
  if (!expression || !sentence) return esc(sentence || '')
  try {
    const exprPattern = expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = sentence.split(new RegExp(`(${exprPattern})`, 'gi'))
    return parts.map(p =>
      p.toLowerCase() === expression.toLowerCase()
        ? `<mark class="expr-highlight">${esc(p)}</mark>`
        : esc(p)
    ).join('')
  } catch { return esc(sentence) }
}

function highlightMultipleExprs(sentence, words) {
  if (!words?.length || !sentence) return esc(sentence || '')
  let result = esc(sentence)
  words.filter(Boolean).forEach(w => {
    try {
      const pat = esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(new RegExp('(' + pat + ')', 'gi'), '<mark class="expr-highlight">$1</mark>')
    } catch {}
  })
  return result
}

function getItemWords(item) {
  if (Array.isArray(item.words) && item.words.length) return item.words
  if (item.word) return [item.word]
  return []
}

function updateKindleDisplay(i, expression) {
  const item = kindleItems[i]
  if (!item) return
  // Atualiza frase com highlight inline
  const sentEl = el(`ks-${i}`)
  if (sentEl) {
    sentEl.innerHTML = item.context
      ? highlightExprInSentence(item.context, expression)
      : esc(expression || '')
  }
  // Atualiza chip
  const chipEl = el(`ke-${i}`)
  if (chipEl) {
    chipEl.textContent = expression || '—'
    chipEl.classList.remove('loading')
  }
  // Atualiza input de texto oculto
  const inp = el(`kt-${i}`)
  if (inp && inp.value !== expression) inp.value = expression || ''
  // Atualiza destaque no picker (se visível)
  const picker = el(`kp-${i}`)
  if (picker) highlightExpression(picker, expression || '')
}

function toggleKindlePicker(i) {
  const ko = el(`ko-${i}`)
  if (ko) ko.classList.toggle('hidden')
}

function attachPicker(idx) {
  const c = el(`kp-${idx}`); if (!c) return
  c.querySelectorAll('.wp-tok').forEach(tok => tok.addEventListener('click', async function() {
    const clickedWord = this.dataset.w
    const i = parseInt(this.dataset.i)

    // Feedback imediato: seleciona token e atualiza chip/frase
    c.querySelectorAll('.wp-tok').forEach(t => t.classList.remove('sel', 'sel-multi'))
    this.classList.add('sel')
    setKindleWord(i, clickedWord)

    // Sem API key: usa apenas a palavra clicada
    if (!cfg.openaiKey) return

    // Detecta se é phrasal verb / idiom / expressão multi-palavra
    this.classList.add('wp-loading')
    try {
      const context = kindleItems[i]?.context || ''
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 15,
          messages: [{
            role: 'user',
            content: `Sentence: "${context}"\nThe user clicked on the word: "${clickedWord}"\n\nIs "${clickedWord}" part of a phrasal verb, idiom, or fixed multi-word expression in this sentence? If yes, return the complete expression as it appears in the sentence. If no, return just "${clickedWord}". Return ONLY the word or expression, lowercase, no punctuation, no explanation.`
          }]
        })
      })
      if (!res.ok) return
      const data = await res.json()
      const detected = (data.choices?.[0]?.message?.content || '').trim().toLowerCase().replace(/[.,!?;:"""''()\n]/g, '').trim()
      if (detected && detected !== clickedWord) {
        setKindleWord(i, detected)
      }
    } catch(e) {
      console.warn('Detecção de expressão falhou:', e.message)
    } finally {
      this.classList.remove('wp-loading')
    }
  }))
}

function setKindleWord(i, word) { addKindleWord(i, word) } // compat

function addKindleWord(i, word) {
  if (!kindleItems[i] || !word) return
  if (!Array.isArray(kindleItems[i].words)) kindleItems[i].words = kindleItems[i].word ? [kindleItems[i].word] : []
  if (!kindleItems[i].words.map(w=>w.toLowerCase()).includes(word.toLowerCase())) {
    kindleItems[i].words.push(word)
  }
  kindleItems[i].word = kindleItems[i].words[0] // compat
  updateKindleWordsDisplay(i)
}

function removeKindleWord(i, wi) {
  if (!kindleItems[i]) return
  if (!Array.isArray(kindleItems[i].words)) return
  kindleItems[i].words.splice(wi, 1)
  kindleItems[i].word = kindleItems[i].words[0] || ''
  updateKindleWordsDisplay(i)
}

function updateKindleWordsDisplay(i) {
  const item = kindleItems[i]; if (!item) return
  const iwords = getItemWords(item)
  // Sentence highlight
  const sentEl = el(`ks-${i}`)
  if (sentEl) sentEl.innerHTML = item.context ? (iwords.length ? highlightMultipleExprs(item.context, iwords) : esc(item.context)) : esc(iwords[0]||'')
  // Chips
  const wrap = el(`ke-wrap-${i}`)
  if (wrap) {
    if (iwords.length) {
      wrap.innerHTML = iwords.map((w,wi)=>`<span class="kindle-expr-chip" style="display:inline-flex;align-items:center;gap:4px">${esc(w)}<span onclick="removeKindleWord(${i},${wi})" style="cursor:pointer;opacity:.55;margin-left:2px;font-size:1rem;line-height:1">×</span></span>`).join('')
    } else {
      wrap.innerHTML = `<span class="kindle-expr-chip loading" style="color:var(--text3);font-size:0.75rem">Selecione com o mouse</span>`
    }
  }
}

async function detectKindleWord(i) {
  if (!cfg.openaiKey) { toast('Configure a OpenAI API Key nas configurações para usar a detecção automática', 'warning'); return }
  const item = kindleItems[i]
  if (!item.context) { toast('Sem contexto para analisar', 'warning'); return }
  const btn = el(`kb-${i}`)
  if (btn) { btn.disabled = true; btn.textContent = '⏳' }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 30,
        messages: [{
          role: 'user',
          content: `Context: "${item.context}"\n\nIdentify the single most interesting vocabulary item to study from this sentence. It can be a word, phrasal verb, idiom, or multi-word expression. Return ONLY the vocabulary item itself, nothing else, no punctuation, no explanation.`
        }]
      })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const detected = (data.choices?.[0]?.message?.content || '').trim().toLowerCase().replace(/[.,!?;:"""''()]/g, '')
    if (detected) {
      setKindleWord(i, detected)
      // Tenta selecionar o token correspondente no picker
      const picker = el(`kp-${i}`)
      if (picker) {
        picker.querySelectorAll('.wp-tok').forEach(tok => {
          tok.classList.toggle('sel', tok.dataset.w?.toLowerCase() === detected)
        })
      }
      toast(`Detectado: "${detected}"`, 'success')
    }
  } catch(e) {
    toast(`Erro na detecção: ${e.message}`, 'error')
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🤖' }
  }
}

function discardKindleSelected() {
  const sel = [...document.querySelectorAll('.kindle-check')].filter(c => c.checked).map(c => kindleItems[+c.dataset.i])
  if (!sel.length) { toast('Selecione ao menos um item', 'warning'); return }
  // Marca como vistos (não aparecerão em importações futuras)
  markKindleItemsAsSeen(sel)
  // Remove da fila atual
  const discardedHashes = new Set(sel.map(item => kindleHighlightHash(item.context || item.word)))
  kindleItems = kindleItems.filter(item => !discardedHashes.has(kindleHighlightHash(item.context || item.word)))
  if (kindleItems.length > 0) {
    saveKindleQueue()
    renderKindleList()
    toast(`${sel.length} descartado${sel.length !== 1 ? 's' : ''} · ${kindleItems.length} restante${kindleItems.length !== 1 ? 's' : ''}`, 'info')
  } else {
    resetKindleUpload(true)
    toast(`${sel.length} descartado${sel.length !== 1 ? 's' : ''}. Fila vazia.`, 'info')
  }
}

function addKindleSelected() {
  const sel = [...document.querySelectorAll('.kindle-check')].filter(c => c.checked).map(c => kindleItems[+c.dataset.i])
  if (!sel.length) { toast('Selecione pelo menos um item', 'warning'); return }
  sel.forEach(item => {
    const iwords = getItemWords(item)
    if (iwords.length <= 1) {
      createWord({ ...item, word: iwords[0] || item.word || item.context })
    } else {
      iwords.forEach(w => createWord({ word: w, context: item.context, context_pt: item.context_pt, source_type: item.source_type, source_title: item.source_title }))
    }
  })
  saveWords(); renderDashboard()
  // Marca os itens adicionados como processados para futuras importações
  markKindleItemsAsSeen(sel)
  toast(`${sel.length} itens adicionados à fila!`, 'success')
  // Remove itens adicionados da queue e salva o restante
  const addedHashes = new Set(sel.map(item => kindleHighlightHash(item.context || item.word)))
  kindleItems = kindleItems.filter(item => !addedHashes.has(kindleHighlightHash(item.context || item.word)))
  if (kindleItems.length > 0) {
    saveKindleQueue()
    renderKindleList()
    toast(`${kindleItems.length} destaques restantes na fila`, 'info')
  } else {
    resetKindleUpload(true)
  }
}


// ================================================================
// MÍDIA — novo fluxo com análise IA
// ================================================================
let midiaProcessed = []

function setMidiaType(el_) {
  document.querySelectorAll('.midia-type-chip').forEach(c => c.classList.remove('active'))
  el_.classList.add('active')
}

async function analyzeMidiaText() {
  const text = (el('midia-text-new')?.value || '').trim()
  if (!text) { toast('Digite ao menos uma palavra ou frase', 'warning'); return }
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'warning'); showSection('configuracoes'); return }
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (!lines.length) return
  const srcType = document.querySelector('.midia-type-chip.active')?.dataset.val || 'series'
  const srcTitle = (el('midia-title-new')?.value || '').trim()
  const srcContext = (el('midia-context-new')?.value || '').trim()
  const btn = el('midia-analyze-btn')
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Analisando...' }
  el('midia-proc-results')?.classList.add('hidden')
  midiaProcessed = []

  const SYSTEM = `For each numbered English sentence, find ONLY phrasal verbs, idioms, collocations, and slang. Do NOT include plain difficult words (e.g. "startup", "setback", "deal", "awesome" alone). Only multi-word expressions or fixed set phrases that fit one of these four categories.

Categories:
- phrasal verb: verb + particle(s), e.g. "put up with", "take off", "back down"
- idiom: fixed expression with non-literal meaning, e.g. "hit the jackpot", "on the same page", "make a killing"
- collocation: words that naturally go together, e.g. "make a huge difference", "heavy rain"
- slang: informal/colloquial expression, e.g. "like crazy", "bail", "freak out"

Also translate the full sentence to Brazilian Portuguese.

For short inputs (1-3 words), return that input in vocab with its type and its meaning as trans.

Return ONLY valid JSON:
{"items":[{"i":<n>,"vocab":[{"expr":"expression","type":"phrasal verb|idiom|collocation|slang"}],"trans":"<full Portuguese translation>"}]}`

  const numbered = lines.map((l, i) => `${i}. ${l}`).join('\n')
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: Math.max(800, lines.length * 80),
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `${numbered}\n\nReturn JSON for ALL ${lines.length} items.` }]
      })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const result = JSON.parse((data.choices?.[0]?.message?.content || '{}').trim())
    midiaProcessed = lines.map((line, i) => {
      const ai = result.items?.find(x => Number(x.i) === i)
      const isShort = line.trim().split(/\s+/).length <= 3
      const vocabArr = Array.isArray(ai?.vocab) ? ai.vocab : []
      const vocab_ref = vocabArr.map(v => {
        if (typeof v === 'object' && v !== null && v.expr) {
          const expr = String(v.expr).toLowerCase().replace(/[.,!?;:"""\'()\[\]]/g,'').trim()
          return expr ? { expr, type: v.type || '' } : null
        }
        // fallback: string sem tipo
        const expr = String(v).toLowerCase().replace(/[.,!?;:"""\'()\[\]]/g,'').trim()
        return expr ? { expr, type: '' } : null
      }).filter(Boolean)
      return {
        words: [],
        word: '',
        vocab_ref,
        context: isShort ? '' : line.trim(),
        context_pt: ai?.trans || '',
        source_type: srcType,
        source_title: srcTitle,
        source_context: srcContext
      }
    })
    renderMidiaProcessed()
    el('midia-proc-results')?.classList.remove('hidden')
  } catch(e) {
    toast(`Erro na análise: ${e.message}`, 'error')
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '⚡ Analisar com IA' }
  }
}

function renderMidiaProcessed() {
  const list = el('midia-proc-list'); if (!list) return
  el('midia-proc-count').textContent = `${midiaProcessed.length} item${midiaProcessed.length !== 1 ? 's' : ''}`
  list.innerHTML = midiaProcessed.map((item, i) => {
    if (item.doc) return renderMidiaDocItem(item, i)
    const hasCtx = !!item.context
    const iwords = getItemWords(item)
    const sentHTML = hasCtx
      ? (iwords.length ? highlightMultipleExprs(item.context, iwords) : esc(item.context))
      : esc(iwords[0] || '')
    const chipsHTML = iwords.length
      ? iwords.map((w,wi) => `<span class="kindle-expr-chip" style="display:inline-flex;align-items:center;gap:4px">${esc(w)}<span onclick="removeMidiaWord(${i},${wi})" style="cursor:pointer;opacity:.55;margin-left:2px;font-size:1rem;line-height:1" title="remover">×</span></span>`).join('')
      : `<span style="font-size:0.75rem;color:var(--text3);font-style:italic">selecione com o mouse</span>`
    const vocabRefHTML = item.vocab_ref?.length
      ? `<div style="font-size:0.78rem;color:var(--text2);margin-top:5px;display:flex;flex-wrap:wrap;gap:8px">`
        + item.vocab_ref.map(v => v.expr
          ? `<span>📌 ${v.expr}${v.type ? ` <span style="font-size:0.65rem;background:rgba(59,130,246,.15);color:var(--primary);border-radius:3px;padding:1px 4px">${v.type}</span>` : ''}</span>`
          : '').filter(Boolean).join(' ')
        + '</div>'
      : ''
    return `
    <div class="parsed-item" id="mi-proc-${i}">
      <input type="checkbox" class="midia-proc-check" data-i="${i}" checked>
      <div class="parsed-item-body">
        <div class="kindle-sentence selectable-sentence" id="ms-${i}" onmouseup="handleSentenceMouseUp(event,${i},'midia')" title="Selecione com o mouse para adicionar ao estudo">${sentHTML}</div>
        ${item.context_pt ? `<div class="kindle-sentence-pt">${esc(item.context_pt)}</div>` : ''}
        ${vocabRefHTML}
        <div class="kindle-expr-row" id="me-wrap-${i}" style="flex-wrap:wrap;gap:5px;margin-top:4px">${chipsHTML}</div>
        <div class="parsed-meta">${srcIcon(item.source_type)} ${esc(item.source_title || item.source_type)}</div>
      </div>
    </div>`
  }).join('')
}

function addMidiaWord(idx, word) {
  if (!midiaProcessed[idx] || !word) return
  if (!Array.isArray(midiaProcessed[idx].words)) midiaProcessed[idx].words = midiaProcessed[idx].word ? [midiaProcessed[idx].word] : []
  if (!midiaProcessed[idx].words.map(w=>w.toLowerCase()).includes(word.toLowerCase())) {
    midiaProcessed[idx].words.push(word)
  }
  midiaProcessed[idx].word = midiaProcessed[idx].words[0]
  updateMidiaWordsDisplay(idx)
}

function removeMidiaWord(idx, wi) {
  if (!midiaProcessed[idx]) return
  if (!Array.isArray(midiaProcessed[idx].words)) return
  midiaProcessed[idx].words.splice(wi, 1)
  midiaProcessed[idx].word = midiaProcessed[idx].words[0] || ''
  updateMidiaWordsDisplay(idx)
}

function updateMidiaWordsDisplay(idx) {
  const item = midiaProcessed[idx]; if (!item) return
  const iwords = getItemWords(item)
  const sentEl = el(`ms-${idx}`)
  if (sentEl) sentEl.innerHTML = item.context ? (iwords.length ? highlightMultipleExprs(item.context, iwords) : esc(item.context)) : esc(iwords[0]||'')
  const wrap = el(`me-wrap-${idx}`)
  if (wrap) {
    wrap.innerHTML = iwords.length
      ? iwords.map((w,wi)=>`<span class="kindle-expr-chip" style="display:inline-flex;align-items:center;gap:4px">${esc(w)}<span onclick="removeMidiaWord(${idx},${wi})" style="cursor:pointer;opacity:.55;margin-left:2px;font-size:1rem;line-height:1">×</span></span>`).join('')
      : `<span class="kindle-expr-chip loading" style="color:var(--text3);font-size:0.75rem">Selecione com o mouse</span>`
  }
}

function setMidiaProcessedWord(idx, word) { addMidiaWord(idx, word) } // compat

function discardMidiaSelected() {
  const checked = [...document.querySelectorAll('.midia-proc-check')].filter(c => c.checked).map(c => +c.dataset.i)
  if (!checked.length) { toast('Selecione ao menos um item', 'warning'); return }
  checked.sort((a,b) => b-a).forEach(i => midiaProcessed.splice(i, 1))
  if (!midiaProcessed.length) { el('midia-proc-results')?.classList.add('hidden'); return }
  renderMidiaProcessed()
  toast(`${checked.length} item${checked.length!==1?'s':''} descartado${checked.length!==1?'s':''}`, 'info')
}

function addMidiaProcessed() {
  const sel = [...document.querySelectorAll('.midia-proc-check')].filter(c => c.checked).map(c => midiaProcessed[+c.dataset.i]).filter(Boolean)
  if (!sel.length) { toast('Selecione ao menos um item', 'warning'); return }
  sel.forEach(item => {
    if (item.doc) { createDocWord(item); return }
    const iwords = getItemWords(item)
    if (iwords.length <= 1) {
      createWord({ word: iwords[0]||item.word, context: item.context, source_type: item.source_type, source_title: item.source_title, source_context: item.source_context })
    } else {
      iwords.forEach(w => createWord({ word: w, context: item.context, source_type: item.source_type, source_title: item.source_title, source_context: item.source_context }))
    }
  })
  saveWords(); renderDashboard(); updateSrsBadge()
  const selSet = new Set(sel)
  midiaProcessed = midiaProcessed.filter(x => !selSet.has(x))
  toast(`${sel.length} item${sel.length!==1?'s':''} adicionado${sel.length!==1?'s':''}!`, 'success')
  if (!midiaProcessed.length) {
    el('midia-proc-results')?.classList.add('hidden')
    if (el('midia-text-new')) el('midia-text-new').value = ''
  } else { renderMidiaProcessed() }
}

// ── Importação de documento (.md / .txt / .pdf) → cards prontos ───────────────
// Preview rico de um item extraído de documento (já vem com significado + exemplo)
function renderMidiaDocItem(item, i) {
  const typeLbl = ({ word:'word', phrasal_verb:'phrasal verb', idiom:'idiom', collocation:'collocation' })[item.type] || item.type || ''
  const exEn = item.example_en ? allowBold(item.example_en) : ''
  const exPt = item.example_pt ? esc(item.example_pt.replace(/<\/?b>/gi,'')) : ''
  return `
    <div class="parsed-item" id="mi-proc-${i}">
      <input type="checkbox" class="midia-proc-check" data-i="${i}" checked>
      <div class="parsed-item-body">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:1.02rem">${esc(item.word || '')}</span>
          ${typeLbl ? `<span class="chip">${esc(typeLbl)}</span>` : ''}
          ${item.level ? `<span class="chip level-${String(item.level).toLowerCase()}">${esc(item.level)}</span>` : ''}
          ${item.register ? `<span class="chip register-${esc(item.register)}">${esc(item.register)}</span>` : ''}
          ${item.ipa ? `<span class="wc-ipa">${esc(item.ipa)}</span>` : ''}
        </div>
        ${item.meaning_pt ? `<div style="margin-top:4px;font-weight:600;color:var(--text)">${esc(item.meaning_pt)}</div>` : ''}
        ${item.definition_pt ? `<div style="font-style:italic;opacity:.8;font-size:0.85rem;margin-top:2px">${esc(item.definition_pt)}</div>` : ''}
        ${exEn ? `<div class="mi-example" style="margin-top:6px"><div class="en">"${exEn}"</div>${exPt ? `<div class="pt">"${exPt}"</div>` : ''}</div>` : ''}
        <div class="parsed-meta">${srcIcon(item.source_type)} ${esc(item.source_title || item.source_type)}${item.source_context ? ` · ${esc(item.source_context)}` : ''}</div>
      </div>
    </div>`
}

// Cria a palavra já em "pending_review", preservando os dados do documento como
// sentido principal (context_match). Fica pronta para salvar no SRS sem perdas.
function createDocWord(item) {
  const w = createWord({
    word: item.word,
    context: (item.example_en || '').replace(/<\/?b>/gi,'').trim(),
    source_type: item.source_type,
    source_title: item.source_title,
    source_context: item.source_context
  })
  w.type = item.type || 'word'
  w.ipa = item.ipa || ''
  w.meanings = [{
    id: uid(), selected: true, idx: 0,
    meaning_pt: item.meaning_pt || '',
    definition_pt: item.definition_pt || '',
    variety: item.variety || 'general',
    register: item.register || 'neutral',
    level: item.level || '',
    examples: item.example_en ? [{ en: item.example_en, pt: item.example_pt || '' }] : [],
    synonyms: [], antonyms: [], notes: [], word_family: [], tags: [],
    context_match: true
  }]
  w.status = 'pending_review'
  w.ai_processed = true
  w.updated_at = new Date().toISOString()
  return w
}

// Carrega um script externo uma única vez (usado para o pdf.js sob demanda)
function loadExtScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some(s => s.src === src)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Falha ao carregar ' + src))
    document.head.appendChild(s)
  })
}

// Extrai texto de um PDF usando pdf.js (carregado do CDN na primeira vez)
async function readPdfTextMidia(file) {
  const PDFJS  = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  if (!window.pdfjsLib) {
    await loadExtScript(PDFJS)
    if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER
  }
  if (!window.pdfjsLib) throw new Error('pdf.js indisponível (sem internet?)')
  const buf = await file.arrayBuffer()
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise
  let out = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    out += tc.items.map(it => it.str).join(' ') + '\n\n'
  }
  return out
}

// Lê o arquivo (md/txt/pdf) e dispara a extração por IA
async function handleMidiaFile(input) {
  const file = (input && input.files) ? input.files[0] : null
  if (!file) return
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'warning'); showSection('configuracoes'); return }
  const name = (file.name || '').toLowerCase()
  const drop = el('midia-drop')
  let text = ''
  try {
    if (name.endsWith('.pdf')) {
      if (drop) drop.classList.add('drag')
      toast('Lendo PDF...', 'info')
      text = await readPdfTextMidia(file)
    } else {
      text = await file.text()
    }
  } catch(e) {
    toast('Erro ao ler o arquivo: ' + e.message, 'error')
    if (drop) drop.classList.remove('drag')
    return
  }
  if (input) { try { input.value = '' } catch {} }
  if (drop) drop.classList.remove('drag')
  text = (text || '').trim()
  if (!text) { toast('Arquivo vazio ou ilegível', 'warning'); return }
  await extractMidiaDoc(text, file.name)
}

// Chamada de IA que lê o documento inteiro e devolve os objetos de estudo,
// já no contexto/gênero da fonte (resolve o caso "snuff" do Survivor).
async function extractMidiaDoc(text, fileName) {
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'warning'); return }
  const srcType = document.querySelector('.midia-type-chip.active')?.dataset.val || 'series'
  const srcTitle = (el('midia-title-new')?.value || '').trim() || (fileName || '').replace(/\.[^.]+$/, '')
  const srcContext = (el('midia-context-new')?.value || '').trim()
  const SRC_LABELS = { series:'TV series', movie:'movie', youtube:'YouTube video', podcast:'podcast' }
  const srcLabel = SRC_LABELS[srcType] || srcType

  const MAX = 14000
  let docText = text, truncated = false
  if (docText.length > MAX) { docText = docText.slice(0, MAX); truncated = true }

  const results = el('midia-proc-results')
  const list = el('midia-proc-list')
  if (results) results.classList.remove('hidden')
  if (el('midia-proc-count')) el('midia-proc-count').textContent = 'Lendo documento...'
  if (list) list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text3)"><span class="spinner" style="width:28px;height:28px;border-width:3px"></span><div style="margin-top:12px">A IA está lendo o documento e extraindo os cards no contexto da fonte...</div></div>`

  const SYSTEM = `You extract English vocabulary STUDY CARDS from a document, for a Brazilian learner. The document was provided together with its source: a ${srcLabel} titled "${srcTitle || '(untitled)'}"${srcContext ? ` — extra context: ${srcContext}` : ''}.

STEP 1 — infer the GENRE / DOMAIN of the source from its title and type (e.g. "Survivor" -> reality survival competition; a police series -> law-enforcement jargon; a fantasy saga -> medieval/fantasy register). Inside a genre, common words often carry a special domain meaning — capture THAT meaning, not the generic dictionary one. Canonical example: "snuff" in Survivor = "apagar (a tocha)", NOT "rape" (tobacco).

STEP 2 — read the document and extract ONLY items genuinely useful as English study cards for a B1+ learner: meaningful single words, phrasal verbs, idioms, collocations, slang and set phrases. IGNORE titles, section headings, instructions, difficulty legends/emojis, "how to use" text, and Portuguese-only filler. Deduplicate. Do not invent items absent from the document.

For EACH item return an object:
- "word": the English term exactly as studied (lowercase, unless a proper noun or fixed ritual phrase)
- "type": "word" | "phrasal_verb" | "idiom" | "collocation"
- "ipa": American IPA between /slashes/ (best effort)
- "level": "A2"|"B1"|"B2"|"C1"|"C2"
- "register": "neutral"|"formal"|"informal"|"colloquial"|"slang"|"technical"|"literary"|"archaic"|"vulgar"
- "variety": "general"|"american"|"british"|"australian"|"canadian"
- "meaning_pt": Portuguese meaning IN THE SOURCE'S CONTEXT first (2-6 words, ONE sense, no semicolons mixing senses)
- "definition_pt": one short Portuguese sentence defining that sense
- "example_en": ONE natural English sentence using the term, with the term wrapped in <b></b>. Prefer an example already present in the document; otherwise write one that fits the source's context
- "example_pt": natural Brazilian-Portuguese translation of the example (plain text, no <b>)

If the document already gives a meaning and/or example for an item, USE and lightly refine it — never discard the curated data.

Return ONLY valid JSON: {"items":[ ... ]}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.aiModel || 'gpt-4o',
        max_tokens: 8000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `DOCUMENT${truncated ? ' (truncated to the beginning)' : ''}:\n\n${docText}` }
        ]
      })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const result = JSON.parse((data.choices?.[0]?.message?.content || '{}').trim())
    const items = Array.isArray(result.items) ? result.items : []
    if (!items.length) { toast('Nenhum item de estudo encontrado no documento', 'warning'); if (results) results.classList.add('hidden'); return }
    midiaProcessed = items.map(it => ({
      doc: true,
      word: String(it.word || '').trim(),
      type: it.type || 'word',
      ipa: it.ipa || '',
      level: it.level || '',
      register: it.register || 'neutral',
      variety: it.variety || 'general',
      meaning_pt: it.meaning_pt || '',
      definition_pt: it.definition_pt || '',
      example_en: it.example_en || '',
      example_pt: it.example_pt || '',
      source_type: srcType,
      source_title: srcTitle,
      source_context: srcContext
    })).filter(x => x.word)
    renderMidiaProcessed()
    if (results) results.classList.remove('hidden')
    toast(`${midiaProcessed.length} cards extraídos${truncated ? ' (documento longo — só o início foi lido)' : ''}`, 'success')
  } catch(e) {
    toast(`Erro ao extrair do documento: ${e.message}`, 'error')
    if (results) results.classList.add('hidden')
  }
}

// ── Mouse selection — Kindle + Mídia ──────────────────────────────────────────
function handleSentenceMouseUp(event, idx, type) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  const container = event.currentTarget
  if (!container.contains(sel.anchorNode) || !container.contains(sel.focusNode)) return
  const txt = sel.toString().trim().replace(/[.,!?;:"""\u2018\u2019()\[\]]/g, '').trim()
  if (!txt || txt.length < 1) { sel.removeAllRanges(); return }
  sel.removeAllRanges()
  if (type === 'kindle') addKindleWord(idx, txt)
  else if (type === 'midia') addMidiaWord(idx, txt)
}

// srcIcon foi movido para core.js (usado também por review.js, que carrega antes de add.js)


// ================================================================
// SITE EXTRACTOR
// ================================================================
async function extractSite() {
  const url = el('site-url').value.trim()
  if (!url) { toast('Digite uma URL', 'error'); return }
  if (!cfg.n8nBase) { toast('Configure o n8n nas Configurações para usar esta função', 'warning'); return }
  const btn = el('site-btn')
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Extraindo...'
  try {
    const res = await fetch(`${cfg.n8nBase}/webhook/en-site`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ url, ai_provider: cfg.aiProvider, ai_model: cfg.aiModel })
    })
    if (!res.ok && res.status !== 200) throw new Error(`n8n retornou status ${res.status}`)
    const data = await res.json()
    if (data && data.error) { toast(data.error, 'error'); return }
    siteItems = Array.isArray(data) ? data : (data.words || [])
    if (!siteItems.length) { toast('Nenhuma palavra encontrada nesta página', 'warning'); return }
    renderSiteList()
  } catch(e) { toast(`Erro: ${e.message}`, 'error') }
  finally { btn.disabled = false; btn.textContent = '🌐 Extrair vocabulário' }
}

function renderSiteList() {
  const list = el('site-list')
  el('site-count').textContent = `${siteItems.length} palavras`
  el('site-result').classList.remove('hidden')
  list.innerHTML = siteItems.map((item, i) => {
    const w = typeof item === 'string' ? item : (item.word || item)
    const ctx = item.context || ''
    return `<div class="parsed-item">
      <input type="checkbox" class="site-check" data-i="${i}" checked>
      <div class="parsed-item-body">
        <div class="parsed-word">${esc(w)}</div>
        ${ctx ? `<div class="parsed-context">${esc(ctx)}</div>` : ''}
        ${item.level ? `<span class="chip level-${(item.level||'').toLowerCase()}">${item.level}</span>` : ''}
      </div>
    </div>`
  }).join('')
}

function addSiteSelected() {
  const src = el('site-url').value.trim()
  const sel = [...document.querySelectorAll('.site-check')].filter(c => c.checked).map(c => {
    const item = siteItems[+c.dataset.i]
    return typeof item === 'string'
      ? { word: item, context: '', source_type:'website', source_title: src }
      : { ...item, word: item.word||item, source_type:'website', source_title: src }
  })
  if (!sel.length) { toast('Selecione ao menos um item', 'warning'); return }
  sel.forEach(i => createWord(i))
  saveWords(); renderDashboard()
  toast(`${sel.length} itens adicionados!`, 'success')
  el('site-result').classList.add('hidden')
}


// ================================================================
// MODELOS E VOZES
// ================================================================
// AI_MODELS/updateModelOptions movidos para settings.js e OPENAI_VOICES/randomVoice
// para audio.js (arquivos não-lazy), pois são usados fora do add.js (Configurações e áudio).


// ================================================================
// CONSULTA AI — chat de dúvidas pontuais de inglês
// ================================================================
let _consultaHistory = []  // {role, content}
let _consultaSrsItems = []  // guarda os itens do botão por índice (evita JSON no onclick)

async function sendConsulta() {
  const input = el('consulta-input')
  const question = input?.value.trim()
  if (!question) return
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI em Configurações', 'warning'); return }

  input.value = ''
  input.disabled = true
  el('consulta-send-btn').disabled = true

  // Esconde empty state
  const empty = el('consulta-empty')
  if (empty) empty.style.display = 'none'

  // Adiciona mensagem do usuário
  appendConsultaMsg('user', esc(question))

  // Adiciona à conversa
  _consultaHistory.push({ role: 'user', content: question })

  // Loading indicator
  const loadId = 'cload-' + Date.now()
  const msgs = el('consulta-messages')
  msgs.insertAdjacentHTML('beforeend',
    `<div class="consulta-msg ai" id="${loadId}" style="opacity:.5;font-style:italic">Analisando...</div>`)
  msgs.scrollTop = msgs.scrollHeight

  try {
    const systemPrompt = `Você é um especialista em inglês ajudando um brasileiro a aprender. 
Quando o usuário perguntar sobre uma palavra ou expressão em inglês:
1. Explique o significado em português de forma clara
2. Mostre a pronúncia (IPA entre barras: //)
3. Dê 3 exemplos de uso em inglês com tradução
4. Adicione contexto útil (origem, registros formal/informal, diferenças de uso)
5. No FINAL da resposta, sempre inclua um bloco JSON assim (mesmo que o usuário pergunte sobre múltiplas coisas, escolha a mais relevante):
<srs_item>
{"word":"...","type":"word|phrasal_verb|idiom|collocation","variety":"general|american|british|australian|canadian","register":"neutral|formal|informal|colloquial|slang|technical|literary|archaic|vulgar","meaning_pt":"...","ipa":"...","definition_pt":"...","examples":[{"en":"Frase com <b>palavra</b> no presente.","pt":"Tradução natural."},{"en":"Frase com <b>palavra</b> em outro tempo verbal.","pt":"Tradução natural."},{"en":"Frase com <b>palavra</b> em outro tempo/contexto.","pt":"Tradução natural."}]}
</srs_item>
Regras do bloco JSON: inclua EXATAMENTE 3 exemplos no array "examples", cada um em um tempo verbal/construção diferente e em situações reais distintas, com a palavra-alvo envolvida em <b></b> apenas no inglês (nunca no português). Preencha variety e register com precisão (use "general" e "neutral" quando não for específico).
IMPORTANTE sobre a resposta VISÍVEL (o texto que o usuário lê):
- NÃO escreva "Bloco JSON", "JSON", crases (\`\`\`) nem mostre o JSON. O JSON deve aparecer SOMENTE dentro de <srs_item></srs_item>.
- NÃO use tags HTML como <b> na parte visível; para destacar, use **negrito** em markdown.
- NÃO use títulos com # (ex: ### Contexto). Escreva em texto corrido com **negrito** quando precisar destacar.
Responda sempre em português (exceto os exemplos em inglês). Seja claro e didático.`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.aiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ..._consultaHistory
        ],
        temperature: 0.7
      })
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || res.status) }
    const data = await res.json()
    const reply = data.choices[0].message.content

    _consultaHistory.push({ role: 'assistant', content: reply })

    // Remove loading
    el(loadId)?.remove()

    // Extrai o item SRS. Preferência: dentro de <srs_item>. Fallback: do 1º "{" ao último "}"
    // (pega o JSON inteiro mesmo com chaves aninhadas do array "examples").
    let srsItem = null, rawJson = null
    const tagMatch = reply.match(/<srs_item>\s*([\s\S]*?)\s*<\/srs_item>/)
    if (tagMatch) {
      rawJson = tagMatch[1].trim()
    } else {
      const s = reply.indexOf('{'), e = reply.lastIndexOf('}')
      if (s !== -1 && e > s) rawJson = reply.slice(s, e + 1)
    }
    if (rawJson) { try { srsItem = JSON.parse(rawJson) } catch { srsItem = null } }

    // Limpa o texto visível: remove o bloco srs_item, o JSON cru, blocos ``` e rótulos "Bloco JSON"
    let cleanReply = reply.replace(/<srs_item>[\s\S]*?<\/srs_item>/g, '')
    if (rawJson) cleanReply = cleanReply.split(rawJson).join('')
    cleanReply = cleanReply
      .replace(/```[a-z]*\s*[\s\S]*?```/gi, '')
      .replace(/^\s*(bloco\s+json|json)\s*:?.*$/gim, '')
      .replace(/\{[\s\S]*\}/g, m => /"word"\s*:/.test(m) ? '' : m)
      .trim()
    appendConsultaMsg('ai', formatConsultaReply(cleanReply), srsItem)

  } catch(e) {
    el(loadId)?.remove()
    appendConsultaMsg('ai', `❌ Erro: ${esc(e.message)}`, null)
    _consultaHistory.pop()
  } finally {
    if (input) { input.disabled = false; input.focus() }
    const btn = el('consulta-send-btn'); if (btn) btn.disabled = false
  }
}

function formatConsultaReply(text) {
  // 1) escapa tudo (segurança)
  let t = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  // 2) re-permite apenas tags de ênfase simples que a IA às vezes inclui
  t = t.replace(/&lt;(\/?(?:b|strong|i|em))&gt;/gi, '<$1>')
  // 3) cabeçalhos markdown (#, ##, ###...) → linha em destaque
  t = t.replace(/^\s*#{1,6}\s*(.+?)\s*$/gm, '<div class="cs-h">$1</div>')
  // 4) markdown inline
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/`(.+?)`/g, '<code class="cs-code">$1</code>')
  // 5) listas
  t = t.replace(/^\s*[-•]\s+(.+)$/gm, '<li>$1</li>')
  t = t.replace(/(<li>[\s\S]*?<\/li>)/, '<ul class="cs-ul">$1</ul>')
  // 6) quebras de linha (sem duplicar após cabeçalhos/listas)
  t = t.replace(/<\/div>\n/g, '</div>').replace(/<\/ul>\n/g, '</ul>')
  t = t.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>')
  return t
}

function appendConsultaMsg(role, html, srsItem) {
  const msgs = el('consulta-messages')
  let addBtn = ''
  if (srsItem && srsItem.word) {
    const idx = _consultaSrsItems.push(srsItem) - 1   // referência por índice (sem JSON no atributo)
    addBtn = `<div class="consulta-add-wrap"><button class="consulta-add-btn" onclick="addConsultaItemToSrs(${idx})">${ic('book','ic-sm')}<span>Adicionar para estudo</span></button></div>`
  }
  msgs.insertAdjacentHTML('beforeend',
    `<div class="consulta-msg ${role}">${html}${addBtn}</div>`)
  msgs.scrollTop = msgs.scrollHeight
}

function addConsultaItemToSrs(idx) {
  try {
    const item = _consultaSrsItems[idx]
    if (!item || !item.word) { toast('Item não encontrado', 'warning'); return }
    // Monta a lista de exemplos (3 do array; fallback p/ exemplo único legado)
    const exs = (Array.isArray(item.examples) && item.examples.length)
      ? item.examples.filter(e => e && e.en).map(e => ({ en: e.en, pt: e.pt || '' }))
      : (item.example_en ? [{ en: item.example_en, pt: item.example_pt || '' }] : [])
    // Cria palavra na lista
    const w = createWord({
      word: item.word,
      context: (exs[0] && exs[0].en) || item.example_en || '',
      source_type: 'manual'
    })
    // Adiciona significado pré-processado (um card por exemplo)
    w.meanings = [{
      meaning_pt: item.meaning_pt || '',
      definition_pt: item.definition_pt || '',
      examples: exs,
      variety: item.variety || 'general',
      register: (item.register && item.register !== 'standard') ? item.register : 'neutral',
      selected: true
    }]
    w.ipa = item.ipa || ''
    w.type = item.type || 'word'
    w.status = 'pending_review'
    w.ai_processed = true
    saveWords()
    renderDashboard()
    updateSrsBadge()
    // Salvar direto no SRS (o saveToSrs já mostra o toast com a contagem de cards)
    saveToSrs(w.id)
  } catch(e) { toast('Erro ao adicionar: ' + e.message, 'error') }
}

function clearConsulta() {
  _consultaHistory = []
  _consultaSrsItems = []
  const msgs = el('consulta-messages')
  if (msgs) msgs.innerHTML = `<div class="consulta-empty" id="consulta-empty">
    ${ic('message','ic-xl')}
    <p style="font-weight:600">Pergunte qualquer coisa em inglês</p>
    <p style="font-size:0.85rem">Ex: "O que significa breaking bad?", "Como usar nevertheless?", "Diferença entre speak e talk"</p>
  </div>`
}

