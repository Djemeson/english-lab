// ================================================================
// IA — DIRETO NO SITE (OpenAI) + FALLBACK N8N
// ================================================================

// A IA marca o equivalente da palavra em <b> nas traduções (é o padrão do
// projeto nos exemplos), e a tradução da frase veio com ele também. Escapado
// inteiro, o leitor via "<b>adiciona</b>" cru na tela. Aqui o texto é
// escapado normalmente e SÓ o <b> volta a valer como marcação.
function _ptComNegrito(txt) {
  if (!txt) return ''
  return esc(String(txt))
    .replace(/&lt;b&gt;/gi, '<b>')
    .replace(/&lt;\/b&gt;/gi, '</b>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')   // modelo barato às vezes usa markdown
}

// ================================================================
// REDE DE SEGURANÇA GRAMATICAL — o código conferindo o modelo
// ================================================================
// A regra no prompt (GRAMMAR BEFORE DICTIONARY) reduz o erro; esta rede pega
// o que passar. Se o alvo é uma palavra-função do inglês (does/have/to/that…)
// COM frase de contexto e a resposta não trouxe NENHUM significado marcado
// como função gramatical, a análise repete UMA vez com a correção como
// system — e, se ainda vier errada, segue com aviso no console (nunca
// bloqueia o aluno; melhor um card imperfeito que nenhum).
const _FUNC_EN = new Set(['do', 'does', 'did', 'have', 'has', 'had', 'am', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'will', 'would', 'shall', 'should', 'can', 'could', 'may',
  'might', 'must', 'to', 'that', 'it', 'there'])

async function _redeGramatical(target, ctx, PROMPT, result) {
  const t = String(target || '').toLowerCase().trim()
  if (!ctx || /\s/.test(t) || !_FUNC_EN.has(t)) return result
  const temGram = (result.meanings || []).some(m => _ehSim(m.gramatical))
  if (temGram) return result
  console.warn(`[ia] "${t}" é palavra-função e a análise veio sem significado gramatical — repetindo com correção`)
  try {
    const r2 = await aiJSON([
      { role: 'system', content: `Your previous analysis of "${target}" was WRONG: in the context sentence it works as a GRAMMATICAL FUNCTION (auxiliary/marker), and you returned only lexical dictionary senses. Redo the analysis now. The FIRST meaning MUST describe the grammatical function used in the context (with "gramatical": true and "context_match": true) and its examples MUST show that function. Follow the original instructions below.` },
      { role: 'user', content: PROMPT }
    ], { maxTokens: 5000 })
    if ((r2.meanings || []).some(m => _ehSim(m.gramatical))) return r2
  } catch (e) { /* fica com a primeira resposta */ }
  console.warn(`[ia] a repetição também veio sem função gramatical — mantendo a resposta original`)
  return result
}

// Booleano vindo de modelo barato em modo texto livre: aceita as formas que
// eles realmente devolvem. `=== true` sozinho descartaria "true" (string).
function _ehSim(v) {
  if (v === true || v === 1) return true
  return /^(true|sim|yes|1)$/i.test(String(v || '').trim())
}

function applyAiResult(w, result) {
  w.word = result.word || w.word
  // Campos de nível-palavra: preserva o que já existir (não apaga dado curado de uma
  // importação anterior — ex.: doc/leva) — a IA só PREENCHE o que estiver vazio.
  w.type       = w.type       || result.type       || 'word'
  w.type_label = w.type_label || result.type_label  || ''
  w.ipa        = w.ipa        || result.ipa         || ''
  // Auto-detecção de idioma: se a IA detectou outro idioma, adota (seletor manda, detecção corrige)
  const det = (result.detected_lang || '').toLowerCase().slice(0, 5)
  if (det && det !== wordLang(w)) {
    w.lang = det
    ensureLangDecks(det)
    toast(`Idioma detectado: ${getLangDef(det).name}`, 'info')
  }
  if (result.audio_base64 && !w.audio_base64) w.audio_base64 = result.audio_base64
  // Tradução da frase de contexto: vem de graça na mesma resposta da análise
  // (é um campo, não uma chamada) e preenche o card de palavra, que não passa
  // pela triagem. Nunca sobrescreve uma tradução já existente.
  if (!w.context_pt && result.context_pt) w.context_pt = String(result.context_pt).trim().slice(0, 400)
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
  // --- Sentido que já virou item próprio não volta ---
  // Sem isto o conserto se desfaz sozinho: separar "apaixonar-se" de "fall" e
  // depois clicar em "Re-analisar" traria o sentido de volta, porque a IA vai
  // continuar (com razão) achando que "fall in love" existe. É o espelho da
  // lição da 51ª rodada — lá o fóssil antigo vencia a análise nova; aqui é a
  // análise nova que não pode desfazer uma decisão do aluno.
  // A lista mora em `w.spun_off` e não dentro de `meanings` porque este array é
  // RECONSTRUÍDO a cada análise: marca posta ali não sobreviveria.
  // Autocura: se o item filho foi apagado, o bloqueio cai junto e o sentido
  // pode voltar — a decisão deixou de existir.
  const bloqueados = (Array.isArray(w.spun_off) ? w.spun_off : [])
    .filter(s => s && words.some(x => x.id === s.wordId))
  const rawFiltradas = !bloqueados.length ? rawMeanings : rawMeanings.filter(m => {
    const nm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    const fora = bloqueados.some(s => nm(s.meaning_pt) === nm(m.meaning_pt) ||
      (m.unit && nm(m.unit) === nm(s.word)))
    if (fora) console.log(`[unidade] sentido "${m.meaning_pt}" ignorado: já é o item "${bloqueados.find(s => nm(s.meaning_pt) === nm(m.meaning_pt) || (m.unit && nm(m.unit) === nm(s.word))).word}"`)
    return !fora
  })
  const freshMeanings = rawFiltradas.map((m, i) => ({
    id: uid(), selected: true, idx: i,
    meaning_pt:    m.meaning_pt    || '',
    definition_pt: m.definition_pt || '',
    origin_pt:     m.origin_pt     || '',
    type_label:    m.type_label    || result.type_label || '',
    variety:       m.variety       || 'general',
    register:      m.register      || 'neutral',
    level:         m.level         || '',
    // Marca o significado que descreve uma FUNÇÃO gramatical (auxiliar
    // enfático, marcador de infinitivo…) em vez de um sentido lexical. É o que
    // impede o merge de preservação de trocar um pelo outro.
    // Leitura TOLERANTE de propósito: com DeepSeek o JSON vem por texto livre
    // (o `response_format` não é usado — ver ai.js), então booleano volta como
    // `true`, `"true"`, `"sim"` ou `1` conforme o humor do modelo.
    gramatical:    _ehSim(m.gramatical),
    // Declaração da própria IA de que este sentido só existe com material fixo
    // ("in love"). É a fonte primária; o detector do código (unidadeFixaDoSentido)
    // é o suspensório para quando o modelo barato ignora a regra.
    requires:      String(m.requires || '').trim(),
    unit:          String(m.unit || '').trim(),
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

  // --- Preserva significados já curados com exemplos preenchidos ---
  // Regra pedida pelo Djemeson: se um significado JÁ TEM frases de exemplo (veio de uma
  // importação de documento/leva, de uma "Re-analisar" anterior, ou de edição manual), o
  // botão de IA NUNCA sobrescreve o significado/definição/frases dele — só COMPLETA o que
  // estiver faltando (origem, categoria local, variedade/registro ainda genéricos, nível,
  // sinônimos/antônimos). Sentidos novos que a palavra ainda não tinha entram do jeito que
  // a IA devolveu, exemplos inclusos (nada a preservar ali).
  const oldMeanings = Array.isArray(w.meanings) ? w.meanings : []
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const curated = w._refazer ? [] : oldMeanings.filter(om => Array.isArray(om.examples) && om.examples.length > 0)
  const usedOld = new Set()
  w.meanings = freshMeanings.map(nm => {
    // FASE 3 — `same_as` primeiro: é a IA dizendo "este é aquele sentido que
    // ele já tem", olhando o SENTIDO e não a grafia. O casamento por texto
    // normalizado continua logo abaixo, como rede: modelo que ignora o campo
    // (ou fornecedor que devolve texto livre) cai no comportamento antigo.
    let match = nm.same_as
      ? curated.find(om => !usedOld.has(om.id) && om.id === nm.same_as)
      : null
    if (!match) match = curated.find(om => !usedOld.has(om.id) && norm(om.meaning_pt) === norm(nm.meaning_pt))
    // Casamento POR CONTEXTO (sem título igual) é o último recurso e vinha
    // sendo cego: bastava os dois serem "o do contexto" para o significado
    // antigo voltar por cima do novo. Foi ele que fez "Re-analisar" devolver
    // "fazer, executar" para o `does` de "the boat ride DOES add time" mesmo
    // depois de a IA acertar o auxiliar enfático — a correção era descartada
    // pela própria preservação. Agora só vale entre significados da MESMA
    // natureza: função gramatical não se funde com sentido lexical.
    if (!match && nm.context_match) {
      match = curated.find(om => !usedOld.has(om.id) && om.context_match &&
        !!om.gramatical === !!nm.gramatical)
    }
    if (!match) return nm
    usedOld.add(match.id)
    // --- Resolução de contradição entre sentidos ---
    // Caso real (emasculating): o título preservado dizia "desvirilizador,
    // castrador, debilitante", mas a nova análise moveu "debilitante" para
    // OUTRO sentido ("que esvazia"). Manter os dois deixaria o MESMO termo em
    // dois sentidos — erro objetivo, não curadoria. O termo conflitante sai
    // do título preservado e os exemplos que o usavam no negrito PT são
    // trocados pelos novos da IA. Todo o resto da curadoria permanece.
    const radical = s => { s = norm(s); s = s.replace(/s$/, ''); return s.replace(/[aoe]$/, '') }
    const termosOutros = freshMeanings.filter(x => x !== nm)
      .flatMap(x => String(x.meaning_pt || '').split(',')).map(radical).filter(Boolean)
    const termosPres = String(match.meaning_pt || '').split(',').map(t => t.trim()).filter(Boolean)
    const conflitantes = termosPres.filter(t => termosOutros.includes(radical(t)))
    let tituloFinal = match.meaning_pt, exemplosFinais = match.examples
    if (conflitantes.length && conflitantes.length < termosPres.length) {
      tituloFinal = termosPres.filter(t => !conflitantes.includes(t)).join(', ')
      const confRad = conflitantes.map(radical)
      exemplosFinais = (match.examples || []).map((ex, j) => {
        const b = /<b>([^<]+)<\/b>/.exec(String(ex.pt || ''))
        return (b && confRad.includes(radical(b[1])) && nm.examples[j]) ? nm.examples[j] : ex
      })
    }
    return {
      ...nm,
      id: match.id,
      meaning_pt:    tituloFinal,
      definition_pt: match.definition_pt || nm.definition_pt,
      examples:      exemplosFinais,
      example_en:    (exemplosFinais[0] && exemplosFinais[0].en) || match.example_en,
      example_pt:    (exemplosFinais[0] && exemplosFinais[0].pt) || match.example_pt,
      origin_pt:     (match.origin_pt && match.origin_pt.trim()) ? match.origin_pt : nm.origin_pt,
      type_label:    match.type_label || nm.type_label,
      variety:       (match.variety  && match.variety  !== 'general') ? match.variety  : nm.variety,
      register:      (match.register && match.register !== 'neutral') ? match.register : nm.register,
      level:         match.level || nm.level,
      synonyms:      (match.synonyms && match.synonyms.length) ? match.synonyms : nm.synonyms,
      antonyms:      (match.antonyms && match.antonyms.length) ? match.antonyms : nm.antonyms,
      selected:      match.selected !== false,
      // FASE 2 — o que o sentido CONQUISTOU não pode morrer numa re-análise:
      // o estado (já estudado? já enviado?), quando foi estudado e a origem
      // dele. Sem isto, "Re-analisar" jogaria fora o progresso de estudo e a
      // cena de onde o sentido veio, que é o que o dossiê usa para agrupar.
      estado:        match.estado,
      estudadoEm:    match.estudadoEm,
      context:       match.context,
      context_pt:    match.context_pt,
      source_type:   match.source_type,
      source_title:  match.source_title,
      source_context: match.source_context
    }
  })
  w.ai_processed = true
  w.updated_at = new Date().toISOString()
  // Sentido novo nasce sem `estado` (= 'pronto'), então o item cai sozinho em
  // `pending_review`; os já estudados mantêm o deles.
  sincronizarStatusItem(w)
}

async function analyzeWordDirect(wordId) {
  const w = words.find(x => x.id === wordId)
  if (!w || !aiChatCfg().key) return false

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
- You MUST still ALSO return the other common general senses with "context_match": false, exactly as usual — never drop them.`
  }

  // A SEMENTE VIVE FORA DO BLOCO DE FONTE, de propósito. Enquanto morava lá
  // dentro, ela só chegava ao prompt quando o item tinha título de fonte — um
  // item manual, ou nascido de uma separação de sentido, perdia a semente em
  // silêncio, que é justamente o caso em que ela mais importa.
  const seedBlock = w._seedMeaning ? `
CURATED MEANING — ALREADY DECIDED, DO NOT DROP IT:
- The learner already has a meaning for this item: "${w._seedMeaning}". Keep THIS as the primary sense ("context_match": true, first in the array); refine its Portuguese only if it is clearly wrong, and make sure its examples illustrate it.${w._seedFrom ? `
- This item was split out of "${w._seedFrom}": the learner decided that this meaning belongs to the whole expression "${target}", not to "${w._seedFrom}" alone. Every example MUST contain the complete expression "${target}", and the <b> bold MUST wrap ALL of its words, not just the verb.` : ''}` : ''

  // RECONHECIMENTO DO REENCONTRO (Fase 3). Custo: ZERO chamada nova — os
  // sentidos que ele já tem entram na análise que já ia acontecer, e voltam
  // com um id. Casar contra LISTA FECHADA é tarefa muito mais fácil que
  // geração aberta, que é onde o modelo errou nas rodadas 163–167; por isso dá
  // para confiar aqui e não dava lá.
  const jaTem = (typeof sentidosDe === 'function' ? sentidosDe(w) : [])
    .filter(m => m.id && m.meaning_pt)
  const reencontroBlock = jaTem.length ? `
SENSES THE LEARNER ALREADY HAS FOR THIS ITEM (do not lose them, do not duplicate them):
${jaTem.map(m => `- id "${m.id}": ${m.meaning_pt}${m.definition_pt ? ` (${m.definition_pt})` : ''}`).join('\n')}
- For EVERY meaning you return, add "same_as": "<id>" when it is the SAME sense as one listed above (even if you word the Portuguese differently), or "same_as": null when it is a genuinely NEW sense.
- Judge by the SENSE, not by the wording: "cair" and "cair em desgraça" describing the same use are the SAME sense.
- The context sentence decides which sense is "context_match": true — it may well be one the learner already has.` : ''

  const L = getLangDef(wordLang(w))
  const PROMPT = `Analyze this ${L.nameEn} vocabulary item for a Brazilian Portuguese-speaking learner and return ONLY valid JSON.

Item: "${target}"

LANGUAGE CHECK:
- The learner expects this item to be ${L.nameEn}. Set "detected_lang" to the ISO 639-1 code of the language the item is ACTUALLY in.
- If the item is valid in ${L.nameEn} (even if it also exists in other languages), keep "detected_lang": "${L.code}". Only return a different code when the item clearly belongs to another language (use the context sentence to decide). In that case, analyze it in ITS language.
${ctx ? `Context sentence: "${ctx}"` : ''}
${sourceBlock}
${seedBlock}
${reencontroBlock}

${promptRegrasLexicais(wordLang(w), 'analise')}

Rules for examples — CRITICAL, follow exactly:
- Write EXACTLY 3 examples per meaning, in this FIXED order of tenses (so the learner sees the word morph):
  - #1 PRESENT (simple present)
  - #2 PAST (simple past or present perfect)
  - #3 a construction where the target word CHANGES FORM the most: continuous (-ing), future, conditional, passive or imperative — pick the one that inflects "${target}" differently from #1 and #2. If the word is invariable (an adverb, a fixed idiom), pick any third construction, still different from #1 and #2.
- The target word must appear INFLECTED accordingly in each example (e.g. run → runs / ran / running) — that morphological variation is the point.
- Each example MUST have a different subject (mix: he/she/they/I/we/you/a proper name/a noun phrase)
- Each example MUST describe a genuinely different real-world situation or context (work, relationships, sports, travel, news, etc.)
- NEVER use formulaic sentence patterns — sentences should feel natural, like they come from a novel, news article, or real conversation
- BAD (avoid): "#1 He backs down. #2 She backed down. #3 They are backing down." — same pattern, different pronouns
- GOOD: "#1 The senator backed down after facing criticism from his own party. #2 Don't back down just because the situation gets uncomfortable. #3 She never backs down from a challenge, even when the odds are against her."

Rules for bold — CRITICAL, follow exactly on BOTH sides of every example:
- ${L.nameEn}: wrap the target word/expression in <b></b> exactly as it appears conjugated/inflected in that sentence (e.g. "ran" for "run", not the base form). For a multi-word or separable expression (phrasal verb, separable verb), wrap ALL its parts even when another word sits between them. For an idiom, wrap the whole expression.
- Portuguese: wrap the word or short phrase that is the Portuguese equivalent of the target IN THAT SENTENCE (its translation there, not a dictionary gloss) in <b></b>.
- If the target word/expression appears more than once in a sentence, bold ONLY the main occurrence — never bold it twice.
- Exactly ONE bold span per side per example. Do not bold anything else.

For Portuguese translations of examples:
- Translate naturally — don't translate word-for-word
- LITERAL-TRANSLATION TRAP — avoid it explicitly: FIRST work out what the sentence DOES (the speech act, the scene), THEN translate that function into how a Brazilian would actually say it. "We'll get you in for that" (scheduling) → "a gente te encaixa", NEVER "colocar você dentro"; "How are you holding up?" → "como você está se segurando?" is WRONG, use "como você está aguentando?". If a translation reads like word-by-word substitution, redo it before returning.
- Vary the Portuguese synonyms across the 3 examples (e.g. for "thunderstruck": "atordoado", "estarrecido", "pasmado" — not "atordoado" × 3)
- HARD LIMIT on that variation: every synonym you use must still belong to THAT meaning's sense (see the substitution test below). Reaching for a word that expresses a DIFFERENT idea is not variety — it is a missing sense.
- Each Portuguese translation should read like natural Brazilian Portuguese, not like a translation

SENSE SPLITTING vs TRANSLATION SYNONYMS — the single most important decision:
A learner needs ONE meaning object per SENSE, not per Portuguese word. Two Portuguese words for the SAME idea belong to the SAME object; two different ideas MUST become separate objects. Run these three tests before deciding:
- TEST 1 (SUBSTITUTION): put the candidate translations into the same sentence. If they can be swapped without changing what is being said, they are synonyms of ONE sense → list them together in "meaning_pt". If swapping changes the claim, narrows it, or sounds wrong, they are DIFFERENT senses → split into separate objects.
- TEST 2 (WHAT IT COMBINES WITH): different senses take different subjects/objects/domains. A sense that applies to people is not the same as one that applies to laws, objects or abstractions — even when both are figurative.
- TEST 3 (OPPOSITE): if the natural antonym changes, the sense changed.

WORKED EXAMPLE — "emasculating":
- "desvirilizador" and "castrador" survive Test 1 (interchangeable when talking about a man's pride) → SAME object.
- "que esvazia / enfraquece" (an emasculated bill, emasculating the regulations) fails Test 2 — it applies to laws and rules, not to a man's masculinity → SEPARATE object.
- the literal veterinary sense "castrar (remover os testículos)" is another domain → SEPARATE object.
So "emasculating" must return 2–3 meaning objects. Returning ONE object whose meaning_pt reads "desvirilizador, castrador, debilitante" is WRONG: "debilitante" is a different sense smuggled in as if it were a synonym.

${promptUnidadeDoSentido(target, 'analise')}

Rules for meanings — CRITICAL:
- The context sentence is ONLY used to identify the word correctly and to mark which sense appeared there. It does NOT limit which meanings you return.
- ALWAYS return ALL distinct senses the word has in common ${L.nameEn} usage — not just the one from the context.
- Think of yourself as a dictionary: if the word has 3 senses, return 3 meaning objects. If it has 2, return 2. Never collapse them into one.
- NEVER merge two different senses into one meaning — not with semicolons ("decolar; ter sucesso" is WRONG) and not with commas pretending they are synonyms.
- NEVER omit a common sense just because it doesn't appear in the context sentence
- Each meaning MUST have its own 3 examples that illustrate that specific sense
- CRITICAL: every example placed under a meaning MUST unambiguously illustrate THAT meaning's sense — never another sense of the word. If "${target}" has multiple senses, an example for sense A must NOT make sense if read with sense B. Double-check each example matches its meaning before returning.
- COHERENCE CHECK (do this for every meaning before returning): the bolded Portuguese in each of its 3 examples must be interchangeable with the translations listed in that meaning's "meaning_pt". If one example needed a Portuguese word that is NOT interchangeable with them, that is proof a sense is missing — create the extra meaning object for it.
- BEFORE RETURNING A SINGLE MEANING: run tests 1–3 once more. One sense is a legitimate answer for concrete words ("spoon"), but most C1/C2 adjectives, phrasal verbs and idioms carry 2 or more.
- Set "context_match": true ONLY for the meaning that matches the context sentence; all others get false
- The context_match meaning must reflect how the expression is USED in that scene — its function there — never its most literal dictionary reading (cheap-model trap: for "get you in" at a hotel desk, the context sense is "encaixar (na agenda)", not "colocar dentro")
- Put the context-matching meaning FIRST in the array (so the learner sees their original context first)

Example of CORRECT behavior for "take off" with context "his startup took off overnight":
meanings: [
  { meaning_pt: "ter sucesso repentino", ..., context_match: true,  examples: [...] },  ← matches context, comes first
  { meaning_pt: "decolar",              ..., context_match: false, examples: [...] },  ← different sense, still included
  { meaning_pt: "tirar, remover",       ..., context_match: false, examples: [...] }   ← different sense, still included
]

Rules for "variety" and "register" — ALWAYS fill BOTH for every meaning, never leave blank:
${promptVarietyRules(wordLang(w))}
- "register": the style level of THIS sense. Pick the single best fit: "neutral" (everyday standard — the default for most words), "formal", "informal", "colloquial", "slang", "technical", "literary", "archaic", or "vulgar".

Rules for "type" and "type_label":
${promptTypeRules(wordLang(w))}

Return ONLY this JSON (no markdown, no explanation):
{
  "word": "exact word or expression to study",
  "detected_lang": "${L.code}",
  "context_pt": "the CONTEXT SENTENCE translated into natural Brazilian Portuguese — what it SAYS in that scene, never word by word. Empty string if there is no context sentence. This must agree with the meaning marked context_match: if the translation contradicts it, one of the two is wrong.",
  "type": "word|phrasal_verb|idiom|collocation",
  "type_label": "precise local category in Brazilian Portuguese, or empty string",
  "ipa": ${promptIpaRule(wordLang(w))},
  "level": "A2|B1|B2|C1|C2",
  "sense_audit": ["FILL THIS FIRST, before writing meanings. One short line per candidate sense you considered, each ending with SPLIT or MERGED and the test that decided it. Max 12 words per line. Example for 'emasculating': ['pessoa: desvirilizador/castrador — MERGED, test 1 ok', 'lei/regra: esvazia, enfraquece — SPLIT, test 2', 'veterinária: castrar literal — SPLIT, domain']"],
  "meanings": [
    {
      "meaning_pt": "Portuguese translation in NEUTRAL CITATION FORM (lemma), preserving word class: verbs in the INFINITIVE ('esvaziar', never 'esvazia'), adjectives in the MASCULINE SINGULAR ('castrador', never 'castradora'), nouns in the singular. NEVER a conjugated or inflected form here. Use only Portuguese words that actually exist and sound natural — if the derived adjective would sound invented (e.g. 'esvaziador'), use a natural periphrase with the same class function: 'que esvazia, que enfraquece'. List 2–3 variants separated by commas ONLY when they pass the SUBSTITUTION test with each other (e.g. 'séquito, comitiva, cortejo' for 'retinue'). If a candidate word does not survive that test, it belongs to another meaning object — do not list it here. Max 8 words total. ONE sense only — no semicolons.",
      "definition_pt": "Full definition in Portuguese for THIS specific sense (1-2 sentences)",
      "origin_pt": "Brazilian-Portuguese note (1-2 sentences) explaining the ORIGIN / why this expression came to mean this — the image or history behind it. Fill ONLY for idioms, phrasal verbs, metaphors and words with a genuinely interesting or non-obvious etymology (e.g. 'sitting duck' = a duck floating still is an easy target for a hunter; 'on the chopping block' = the block where animals/heads were cut; 'flagship' = the ship that carried the fleet commander's flag; 'throw under the bus' = sacrifice someone for your own safety). Leave it as an EMPTY STRING \"\" for ordinary words with no notable story. NEVER invent folk etymology — if you are not reasonably sure, leave it empty.",
      "variety": "${promptVarietyEnum(wordLang(w))}",
      "register": "neutral|formal|informal|colloquial|slang|technical|literary|archaic|vulgar",
      "level": "A2|B1|B2|C1|C2",
      "gramatical": "true if this meaning is a GRAMMATICAL FUNCTION (see GRAMMAR BEFORE DICTIONARY above), false if it is a lexical sense",
      "requires": "the FIXED words this meaning cannot exist without (deletion test, case b) — e.g. \\"in love\\". EMPTY STRING when the meaning belongs to the item alone (case a) or takes an open class of complements (case c).",
      "unit": "the full expression to study when \\"requires\\" is filled — e.g. \\"fall in love\\". EMPTY STRING otherwise.",
      "context_match": true,
      "synonyms": ["syn1", "syn2", "syn3"],
      "antonyms": ["ant1", "ant2"],
      "examples": [
        {"en": "Sentence with <b>word</b> in present tense.", "pt": "Tradução natural com o <b>equivalente</b> em português."},
        {"en": "Sentence with <b>word</b> in past tense.", "pt": "Tradução natural com o <b>equivalente</b> em português."},
        {"en": "Sentence with <b>word</b> in continuous or other tense.", "pt": "Tradução natural com o <b>equivalente</b> em português."}
      ]
    }
  ]
}`

  try {
    // Teto maior: com 2–3 sentidos × 3 exemplos, 2800 truncava a resposta
    // (e resposta truncada volta como 1 sentido só — o bug que o Djemeson viu)
    let result = await aiJSON(PROMPT, { maxTokens: 5000 })
    // Rede de segurança: prompt não é garantia com modelo barato — o código
    // confere a classe de erro conhecida e repete UMA vez quando a resposta
    // vem errada (padrão da 49ª rodada).
    result = await _redeGramatical(target, ctx, PROMPT, result)
    // A auditoria de sentidos não vai para a tela — serve para conferir a
    // decisão da IA quando um card volta com menos sentidos do que devia.
    if (Array.isArray(result.sense_audit) && result.sense_audit.length) {
      console.log(`[ia] sentidos de "${target}":`, result.sense_audit)
    }
    applyAiResult(w, result)
    w.ai_provider = aiChatCfg().prov
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

// Saída de emergência para quando a IA errou o card inteiro.
// "Re-analisar" PRESERVA o que já tem exemplos (regra pedida em 2026-07-05) —
// ótimo para completar dados, péssimo quando o que está lá é justamente o
// erro: a correção da IA era descartada pela própria preservação. Aqui o
// aluno diz explicitamente "joga fora e faz de novo".
async function refazerAnalise(wordId) {
  const w = words.find(x => x.id === wordId); if (!w) return
  const n = (w.meanings || []).filter(m => !m.moved_to && !m.fundido_em).length
  const nSep = (Array.isArray(w.spun_off) ? w.spun_off : []).filter(s => words.some(x => x.id === s.wordId)).length
  if (!(await confirmModal({
    title: 'Refazer a análise do zero', icon: 'refresh', confirmText: 'Refazer',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Descarta ${n} significado${n !== 1 ? 's' : ''} e exemplos deste item e pede uma análise nova.
      Use quando a IA <b>errou o sentido</b> — o "Re-analisar" normal preserva o que já existe e devolveria o mesmo erro.
      Os cards já salvos no estudo <b>não são afetados</b>.</p>${nSep ? `
      <p style="font-size:var(--fs-sm);color:var(--text2);margin-top:8px">${nSep} sentido${nSep !== 1 ? 's' : ''} que você separou em item próprio <b>não volta${nSep !== 1 ? 'm' : ''}</b> — a expressão já existe sozinha.</p>` : ''}` }))) return
  w._refazer = true
  try { await analyzeWord(wordId) } finally { delete w._refazer }
}

async function analyzeWord(wordId) {
  const w = words.find(x => x.id === wordId)
  if (!w) return
  if (!aiChatCfg().key) {
    toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error')
    showSection('configuracoes')
    return
  }
  await analyzeWordDirect(wordId)
}

async function analyzeAll() {
  if (!aiChatCfg().key) {
    toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error')
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
  if (btn) { btn.innerHTML = 'Salvar todos no site'; updateSendAllBtn() }
  toast(`${ok} palavra${ok !== 1 ? 's' : ''} (${totalCards} cards) salvas no site`, ok > 0 ? 'success' : 'info')
  renderReview(); renderDashboard(); renderSidebar(); updateSrsBadge()
}

// Os cards que o sentido separado já tinha na Revisão. Eles continuam válidos
// como frase, mas ensinam a palavra ERRADA na frente ("fall", quando o que se
// aprende ali é "fall in love"). Avisar e não oferecer saída seria empurrar o
// problema; apagar sem perguntar destruiria agendamento (ease, intervalo,
// lapsos) que ele levou semanas para construir. Então: pergunta, com o preço
// escrito.
async function _separarCuidarDosCards(w, mi, nome) {
  if (typeof srsCards === 'undefined') return
  const alvos = srsCards.filter(c => c.wordId === w.id && c.meaningIdx === mi)
  if (!alvos.length) return
  const n = alvos.length
  const ok = await confirmModal({
    title: n === 1 ? 'E o card que já está na Revisão?' : `E os ${n} cards que já estão na Revisão?`, icon: 'alert', danger: true,
    confirmText: `Excluir ${n} card${n !== 1 ? 's' : ''}`, cancelText: 'Deixar como estão',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Esse sentido já tinha <b>${n} card${n !== 1 ? 's' : ''}</b> na repetição espaçada, com <b>${esc(w.word)}</b> na frente — a palavra que acabou de deixar de ser a certa para ele.</p>
      <p style="font-size:var(--fs-sm);color:var(--text2);margin-top:8px">Excluir perde o agendamento (intervalo, facilidade, lapsos) dess${n !== 1 ? 'es' : 'e'} card${n !== 1 ? 's' : ''}. <b>${esc(nome)}</b> entra do zero de qualquer jeito, quando você enviá-lo.</p>` })
  if (!ok) return
  const ids = new Set(alvos.map(c => c.id))
  srsCards = srsCards.filter(c => !ids.has(c.id))
  saveSrsCards()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  renderDashboard()
  if (typeof renderSrsSection === 'function' && document.getElementById('section-revisar')?.classList.contains('active')) renderSrsSection()
  toast(`${n} card${n !== 1 ? 's' : ''} de "${w.word}" excluído${n !== 1 ? 's' : ''}`, 'info')
}

// ================================================================
// VARREDURA DA BASE — o prompt novo não conserta o que já está salvo
// ================================================================
// Lição literal da 50ª rodada: "cards antigos não se corrigem sozinhos".
// A base foi montada com um prompt que nunca perguntou de quem era o sentido,
// então ela está cheia de "fall/apaixonar-se" — e caçá-los item a item não
// aconteceria nunca. A varredura é de graça: roda o detector local sobre
// `words` inteiro, sem uma chamada de IA sequer. A IA só entra depois, na
// expressão que ELE decidir separar.
function varrerUnidades() {
  const achados = []
  for (const w of (words || [])) {
    if (!Array.isArray(w.meanings)) continue
    w.meanings.forEach((m, mi) => {
      if (!m || m.moved_to) return
      const un = unidadeDoSentido(w, m)
      if (un) achados.push({ wordId: w.id, mi, palavra: w.word || '', status: w.status, meaning_pt: m.meaning_pt || '', un })
    })
  }
  return achados
}

function _varreduraRefresh() {
  if (document.getElementById('el-varredura-modal')) abrirVarreduraUnidades(true)
}

function abrirVarreduraUnidades(reabrindo) {
  const achados = varrerUnidades()
  document.getElementById('el-varredura-modal')?.remove()
  const overlay = document.createElement('div')
  overlay.id = 'el-varredura-modal'
  overlay.className = 'srs-modal-overlay'
  const fechar = () => { overlay.remove(); document.removeEventListener('keydown', teclas) }
  const teclas = e => { if (e.key === 'Escape') fechar() }
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar() })
  // Lista vazia depois de separar tudo é uma boa notícia e precisa dizer isso —
  // modal em branco parece defeito.
  const corpo = achados.length ? `
    <div class="vru-lista">
      ${achados.map(a => `
        <div class="vru-item">
          <div class="vru-txt">
            <div class="vru-top"><b>${esc(a.palavra)}</b><span class="vru-seta">${ic('arrowRight','ic-sm')}</span><b class="vru-alvo">${esc(a.un.unidade)}</b>
              ${a.status === 'in_srs' ? `<span class="chip" data-tip="Este item já está na repetição espaçada">na Revisão</span>` : ''}</div>
            <div class="vru-sub">${esc(a.meaning_pt)} — só existe com <b>${esc(a.un.extra)}</b>${a.un.fonte === 'ia' ? ' (apontado pela própria IA)' : ''}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="separarSentido('${a.wordId}',${a.mi})">${ic('layers','ic-sm')}Separar</button>
        </div>`).join('')}
    </div>` : `
    <p class="vru-vazio">${ic('checkCircle')} Nenhum sentido preso a uma expressão maior. ${reabrindo ? 'Acabou a fila.' : ''}</p>`
  overlay.innerHTML = `<div class="srs-modal-box vru-box" role="dialog" aria-labelledby="vru-title">
    <h4 id="vru-title" style="font-size:var(--fs-base);font-weight:700;margin-bottom:4px">Sentidos que são de outra expressão</h4>
    <p style="font-size:var(--fs-sm);color:var(--text2);margin-bottom:14px">${achados.length
      ? `${achados.length} sentido${achados.length !== 1 ? 's' : ''} da sua base parece${achados.length !== 1 ? 'm' : ''} pertencer a uma expressão inteira, não à palavra sozinha. Separar cria a expressão como item próprio.`
      : 'Varredura de toda a base — nada a fazer aqui.'}</p>
    ${corpo}
    <div style="display:flex;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-ghost btn-sm" id="vru-fechar">Fechar</button>
    </div>
  </div>`
  document.body.appendChild(overlay)
  document.getElementById('vru-fechar').onclick = fechar
  document.addEventListener('keydown', teclas)
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

// O subtítulo conta a fila, então TODO caminho que tira item dela precisa
// chamá-lo. Ficava só dentro do renderReview(), e quem saía pelo "pular" (ou,
// agora, pelo "enviar") deixava para trás um cabeçalho dizendo um número que
// já não era verdade.
function _prepAtualizarCabecalho() {
  const sub = el('review-header-sub')
  if (!sub) return
  const fila = words.filter(w => ['pending_ai','pending_review'].includes(w.status))
  const pending = fila.filter(w => w.status === 'pending_ai').length
  const ready   = fila.filter(w => w.status === 'pending_review').length
  const parts = []
  if (pending) parts.push(`${pending} pendente${pending!==1?'s':''} de IA`)
  if (ready)   parts.push(`${ready} pronta${ready!==1?'s':''} para enviar`)
  sub.textContent = parts.join(' · ') || 'Tudo em dia!'
  // O botão da varredura só existe quando há o que separar: botão permanente
  // dizendo "0" é ruído, e a varredura roda sobre a base inteira, não sobre
  // esta fila — por isso ele mora no cabeçalho e não na barra de ações.
  const slot = el('prep-unidades-slot')
  if (slot) {
    const n = varrerUnidades().length
    slot.innerHTML = n ? `<button class="btn btn-ghost btn-sm" onclick="abrirVarreduraUnidades()"
      data-tip="Sentidos que parecem pertencer a uma expressão inteira (como 'apaixonar-se' em 'fall'), e não à palavra sozinha">
      ${ic('layers')}Expressões presas <span class="badge">${n}</span></button>` : ''
  }
}

function renderReview() {
  const reviewable = words.filter(w => ['pending_ai','pending_review'].includes(w.status))
  el('review-empty').classList.toggle('hidden', reviewable.length > 0)
  el('review-content').classList.toggle('hidden', reviewable.length === 0)
  _prepAtualizarCabecalho()
  if (!reviewable.length) return
  renderSidebar()
  // O item ativo tem de continuar SENDO desta fila. Antes bastava existir em
  // `words`, e com o envio isso passou a deixar na tela o card de um item que
  // já saiu daqui — inclusive quando quem chamou foi o snapshot da nuvem.
  if (!activeWordId || !reviewable.some(w => w.id === activeWordId)) {
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
    // SEM MATERIAL DA IA, NÃO EXISTE ENVIO. Item em `pending_ai` é só a palavra
    // e a frase de onde ela saiu — mandá-lo ao dossiê seria oferecer para
    // estudar uma página em branco. A função de envio já recusava, mas a barra
    // continuava OFERECENDO: oferecer o que não pode acontecer é o erro, mesmo
    // quando o dado está a salvo. Agora a barra mostra só o que cabe agora.
    const sels = [...selectedWordIds].map(id => words.find(x => x.id === id)).filter(Boolean)
    const prontas = sels.filter(_prepPodeEnviar).length
    const semMaterial = sels.length - prontas
    const parcial = prontas > 0 && semMaterial > 0
    leftEl.innerHTML = `
      <span style="font-size:var(--fs-sm);font-weight:600;color:var(--primary);white-space:nowrap">${selCount} selecionada${selCount!==1?'s':''}</span>
      ${semMaterial ? `<span class="wct-aviso" data-tip="Item sem análise não tem significado, exemplo nem nível — não há o que estudar nele ainda.">${ic('info','ic-sm')}${semMaterial} sem material da IA</span>` : ''}
      <button class="btn ${prontas ? 'btn-secondary' : 'btn-srs'} btn-sm" onclick="analyzeSelected()" data-tip="Gera significados, exemplos e nível com IA para as selecionadas">${ic('sparkles')}Analisar</button>
      ${prontas ? `
      <button class="btn btn-srs btn-sm" onclick="enviarSelecionadasParaEstudo()" data-tip="Tira daqui e põe no dossiê da obra, em Estudar. É lá que você lê o material — e marcar 'Estudei' é o que manda o item para a Revisão.">${ic('book')}Enviar ${parcial ? prontas + ' ' : ''}para o Estudo</button>
      <button class="btn btn-ghost btn-sm wct-atalho" onclick="saveSelectedToSrs()" data-tip="Atalho: pula a leitura do dossiê e joga direto na repetição espaçada">${ic('arrowRight')}Pular para a Revisão</button>` : ''}
      <button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="deleteSelected()" data-tip="Remove as palavras selecionadas da fila">${ic('trash')}Excluir</button>`
  } else if (w) {
    if (w.status === 'pending_review' && w.meanings?.length > 0) {
      const selM = w.meanings.filter(m => m.selected !== false)
      const totalCards = selM.reduce((sum, m) => sum + ((m.examples?.length) || 1), 0)
      // A AÇÃO PRINCIPAL DAQUI É PASSAR A FILA ADIANTE. O item preparado SAI
      // do Preparar: some da lista e passa a viver no dossiê da obra, em
      // Estudar. Anunciar a Revisão aqui ensinava a pular a leitura, que é o
      // motivo de a seção Estudar existir. O atalho continua ali, como atalho.
      // Sem nenhum significado marcado não há o que enviar: o botão fica
      // desabilitado dizendo o porquê, em vez de aceitar o clique e recusar
      // depois com um aviso.
      const podeEnviar = _prepPodeEnviar(w)
      leftEl.innerHTML = `
        <button class="btn btn-srs btn-sm"${podeEnviar ? '' : ' disabled'} onclick="enviarParaEstudo('${w.id}')" data-tip="${podeEnviar
          ? 'Tira daqui e põe no dossiê desta obra, em Estudar. É lá que você lê o material — e marcar \'Estudei\' é o que manda o item para a Revisão.'
          : 'Marque ao menos um significado abaixo para poder enviar.'}">${ic('book')}Enviar para o Estudo</button>
        <button class="btn btn-secondary btn-sm" onclick="analyzeWord('${w.id}')" data-tip="Roda a IA de novo PRESERVANDO o que já tem exemplos — completa o que falta">${ic('refresh')}Re-analisar</button>
        <button class="btn btn-ghost btn-sm" onclick="refazerAnalise('${w.id}')" data-tip="A análise está errada? Descarta os significados atuais e refaz do zero">${ic('undo')}Refazer do zero</button>
        ${podeEnviar ? `<button class="btn btn-ghost btn-sm wct-atalho" onclick="saveToSrs('${w.id}')" data-tip="Atalho: pula a leitura do dossiê e joga os ${totalCards} card${totalCards!==1?'s':''} direto na repetição espaçada">${ic('arrowRight')}Pular para a Revisão</button>` : ''}`
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
        const nMean = (w.meanings || []).filter(m => !m.moved_to && !m.fundido_em).length
        // Marie Kondo: o chip "Pendente IA" repetido em toda linha era ruído —
        // virou um ponto discreto (âmbar = aguardando; nº = significados prontos)
        const statusHtml = w.status === 'pending_ai'
          ? `<span class="rw-dot wait" data-tip="Aguardando análise da IA"></span>`
          : `<span class="rw-mean" data-tip="${nMean} significado${nMean !== 1 ? 's' : ''} prontos">${nMean}</span>`
        html += `<div class="rw-item ${isActive ? 'active' : ''} ${isChecked ? 'checked' : ''}" onclick="selectWord('${w.id}')">
          <input type="checkbox" class="rw-cb" ${isChecked ? 'checked' : ''} onclick="toggleWordSelect(event,'${w.id}')" title="Selecionar esta palavra" aria-label="Selecionar ${escA(w.word || 'esta frase')}">
          <div class="rw-word">${esc(w.word || '(frase)')}</div>
          <div class="rw-right">${!showGroups ? `<span class="rw-src" title="Fonte">${icon}</span>` : ''}${statusHtml}</div>
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
  if (!aiChatCfg().key) { toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error'); return }
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
  toast(`${ok} palavra${ok!==1?'s':''} (${totalCards} cards) salvas`, ok > 0 ? 'success' : 'info')
  selectedWordIds.clear()
  renderReview(); renderDashboard(); updateSrsBadge()
}

async function deleteSelected() {
  const ids = [...selectedWordIds]
  if (!ids.length) return
  if (!(await confirmModal({ title: 'Excluir itens', icon: 'trash', danger: true, confirmText: 'Excluir',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Excluir <b>${ids.length} item${ids.length !== 1 ? 's' : ''}</b> da revisão?</p>` }))) return
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

  const typeMap = { word:'word', phrasal_verb: typeLabel('phrasal_verb', wordLang(w), w.type_label), idiom:'idiom', collocation:'collocation' }

  // Sentido que virou item próprio continua NO ARRAY (o `meaningIdx` dos cards
  // já criados é posicional — ver ESTADO, seção 9), mas está fora desta tela e
  // fora de qualquer contagem. Quem o exclui do SRS é o `selected:false`.
  const vivos = (w.meanings || []).filter(m => !m.moved_to && !m.fundido_em)
  const selMeanings = vivos.filter(m => m.selected !== false)
  const selCount = selMeanings.length
  const totalCards = selMeanings.reduce((sum, m) => sum + ((m.examples && m.examples.length) || 1), 0)
  let bodyHtml

  if (w.status === 'pending_ai') {
    // Frase com 3+ palavras: oferece o RAIO-X antes da análise — decompõe em
    // palavras/phrasals/expressões/estruturas para o aluno separar o que já
    // sabe do que precisa estudar (pedido do Djemeson: "não sei exatamente o
    // que não entendi").
    const alvoBrk = (w.word || w.context || '').trim()
    const ehFrase = alvoBrk.split(/\s+/).length >= 3
    // Uma palavra só, capturada de dentro de uma frase: é AQUI que nasce o
    // "fall" que devia ter sido "fall in love" — e nesse caso não há sentido
    // para separar depois, porque o item já nasceu errado.
    const ehPalavraNaFrase = alvoBrk.split(/\s+/).length === 1 &&
      (w.context || '').trim().split(/\s+/).length >= 3
    const jaEstudada = ehPalavraNaFrase ? unidadeJaEstudada(w) : null
    // KonMari: cada estado mostra SÓ o que serve àquele momento.
    // Com a triagem pronta, ela é a protagonista e "analisar tudo" recua a
    // ação secundária; sem triagem, o botão de análise é o destaque.
    const temTriagem = _revBreakCache.has(w.id)
    bodyHtml = `
    <div class="wc-pending-ai">
      ${jaEstudada ? `
      <div class="mi-unidade" style="margin:0 0 var(--sp-3)">
        <div class="miu-txt">${ic('info','ic-sm')}<span>A frase contém <b>${esc(jaEstudada.word)}</b>, que você já estuda — talvez seja ele o item certo aqui, e não <b>${esc(w.word)}</b> sozinho.</span></div>
        <button class="btn btn-secondary btn-sm" onclick="irParaItem('${jaEstudada.id}')">${ic('arrowRight','ic-sm')}Abrir ${esc(jaEstudada.word)}</button>
      </div>` : ''}
      <div id="rev-expr-area"></div>
      <div id="rev-break-area"></div>
      <div class="wc-pend-acts">
        <button class="btn ${temTriagem ? 'btn-ghost btn-sm' : 'btn-primary big-btn'}" onclick="analyzeWord('${w.id}')"
          data-tip="Analisa o item inteiro: significados, exemplos, nível e registro">
          ${ic('sparkles', temTriagem ? 'ic-sm' : '')}Analisar ${ehFrase ? 'a frase inteira' : 'com IA'}
        </button>
        ${ehFrase && !temTriagem ? `
        <button class="btn btn-secondary" onclick="revBreakdown('${w.id}')"
          data-tip="A IA separa a frase em palavras, phrasal verbs, expressões e estruturas — você marca o que NÃO conhece">
          ${ic('layers')}Separar em partes
        </button>` : ''}
        ${ehPalavraNaFrase && !_revExprCache.has(w.id) ? `
        <button class="btn btn-ghost btn-sm" onclick="revExprBuscar('${w.id}')"
          data-tip="A IA lê a frase e diz se esta palavra faz parte de uma expressão maior (como 'fall' em 'fall in love')">
          ${ic('search','ic-sm')}Faz parte de uma expressão?
        </button>` : ''}
      </div>
    </div>`
    if (ehPalavraNaFrase) setTimeout(() => {
      if (activeWordId === w.id && _revExprCache.has(w.id)) _revExprRender(w.id)
    }, 0)
    // Triagem automática: se já rodou em segundo plano, mostra os chips ao
    // abrir; se está rodando, mostra o aviso; se nem começou, dispara agora.
    if (ehFrase) setTimeout(() => {
      if (activeWordId !== w.id) return
      const area = el('rev-break-area'); if (!area) return
      if (_revBreakCache.has(w.id)) _revBreakRender(w.id)
      else if (_revBreakBusy.has(w.id)) area.innerHTML = `<div class="rvb-loading"><span class="gen-spinner"></span> separando a frase...</div>`
      else _revBreakPrefetch(w)   // ele mesmo re-renderiza o card ao terminar
    }, 0)
  } else {
    bodyHtml = `
    <div class="wc-meanings">
      <div class="meanings-toolbar">
        <div class="meanings-toolbar-left">
          <span class="meanings-count">${vivos.length} significado${vivos.length !== 1 ? 's'  : ''}</span>
          <span>·</span>
          <span>${selCount} selecionado${selCount !== 1 ? 's' : ''} · ${totalCards} card${totalCards !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="selectAllMeanings('${w.id}',true)">Todos</button>
          <button class="btn btn-ghost btn-sm" onclick="selectAllMeanings('${w.id}',false)">Nenhum</button>
        </div>
      </div>
      ${w.meanings.map((m, mi) => m.moved_to ? '' : renderMeaningItem(w.id, m, mi)).join('')}
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
        <input type="text" id="wc-word-input-${w.id}" value="${escA(w.word || '')}" aria-label="Editar a palavra" style="display:none;font-size:var(--fs-lg);font-weight:700;background:var(--surface2);border:1px solid var(--primary);border-radius:var(--radius-xs);padding:2px 8px;color:var(--text);width:200px" onkeydown="handleEditWordKey(event,'${w.id}')" onblur="confirmEditWord('${w.id}')">
      </div>
      <div class="wc-meta">
        ${langChip(wordLang(w))}
        ${w.type ? `<span class="chip">${typeMap[w.type] || w.type}</span>` : ''}
        ${w.ipa ? `<span class="wc-ipa">${esc(w.ipa)}</span>` : ''}
        <span class="wc-source">${srcIcon(w.source_type)} ${esc(w.source_title || w.source_type)}</span>
      </div>
      ${_familiaHtml(w)}
      ${ctxHtml ? `<div class="wc-context">"${ctxHtml}"</div>` : ''}
      ${ctxHtml ? `<div class="wc-context-pt" id="wc-ctx-pt-${w.id}">${_ptComNegrito(w.context_pt)}</div>` : ''}
      ${_fraseAlheiaHtml(w)}
    </div>
    ${bodyHtml}
  </div>`
  renderWcToolbarLeft()
  // Glossário também aqui: a frase de contexto e os exemplos estão cheios de
  // OUTRAS palavras que ele já estudou, e reencontrá-las é metade do reforço.
  // O container é o mesmo a cada card (innerHTML só troca o miolo), então a
  // guarda `_glossOn` dentro de glossAtivar impede listener duplicado.
  if (typeof glossAtivar === 'function') glossAtivar(main, {})
}

// Quem decide se o sentido é de uma unidade maior: a IA (campo `requires`) OU
// o detector local. Os dois, nesta ordem — o prompt é a regra, o detector é o
// suspensório para quando o modelo barato a ignora (padrão da 49ª rodada).
// Devolve {extra, unidade, fonte} ou null.
function unidadeDoSentido(w, m) {
  if (!w || !m || m.moved_to) return null
  const base = (w.word || '').trim()
  if (!base) return null
  let achado = null
  if (m.requires) {
    const extra = String(m.requires).trim()
    achado = { extra, unidade: (m.unit || `${base} ${extra}`).trim(), fonte: 'ia' }
  } else {
    const a = unidadeFixaDoSentido(m, base)
    achado = a ? { ...a, fonte: 'detector' } : null
  }
  if (!achado) return null
  // ⚠️ O ITEM PODE JÁ SER A UNIDADE. Depois de separar, "fall in love" é um
  // item — e ao ser analisado a IA responde, com toda a razão, que aquele
  // sentido exige "in love". Sem esta guarda o app avisava o item contra ele
  // mesmo ("não fall in love sozinho") e oferecia separar o que já está
  // separado. A pergunta do teste do apagamento é sobre o ITEM COMO ELE É,
  // não sobre a primeira palavra dele.
  const baseN = ' ' + _ufNormTxt(base) + ' '
  if (_ufNormTxt(achado.unidade) === _ufNormTxt(base)) return null
  if (achado.extra && baseN.includes(' ' + _ufNormTxt(achado.extra) + ' ')) return null
  return achado
}

// A FRASE QUE NÃO É DESTE ITEM. Conserto de código não limpa dado já gravado
// (a lição da 50ª, de novo): as expressões separadas ANTES da guarda acima já
// nasceram com a frase do pai colada nelas. Em vez de apagar por conta
// própria — a frase pode ser a única pista de onde ele viu aquilo —, o app
// mostra o que está errado e deixa a tesoura na mão dele.
function _fraseAlheiaHtml(w) {
  if (!w || !w.from || !(w.context || '').trim()) return ''
  if (typeof _fraseServeParaExpressao !== 'function') return ''
  if (_fraseServeParaExpressao(w.context, w.word)) return ''
  return `<div class="mi-unidade" style="margin-top:var(--sp-3)">
    <div class="miu-txt">${ic('alert','ic-sm')}<span>Esta frase veio de <b>${esc(w.from.word || 'outro item')}</b> e não usa <b>${esc(w.word)}</b> — ela ilustra outro sentido.</span></div>
    <button class="btn btn-secondary btn-sm" onclick="removerFraseAlheia('${w.id}')"
      data-tip="Tira a frase deste item. Os exemplos que a IA gerou continuam intactos.">${ic('trash','ic-sm')}Remover a frase</button>
  </div>`
}

function removerFraseAlheia(id) {
  const w = words.find(x => x.id === id); if (!w) return
  delete w.context; delete w.context_pt
  w.updated_at = new Date().toISOString()
  saveWords()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  renderWordCard(w.id)
  toast('Frase removida', 'info')
}

// A FAMÍLIA NA TELA. Sem isto, separar um sentido faz o material sumir sem
// explicação: o aluno abre "fall" no dia seguinte e não sabe para onde foi o
// "apaixonar-se". A fileira só aparece quando existe parentesco — item comum
// não ganha rótulo nenhum.
const _FAM_ESTADO = { pending_ai:'aguardando IA', pending_review:'no Preparar', in_study:'no Estudo', in_srs:'na Revisão', skipped:'pulada' }
function _famChip(item, papel) {
  return `<button class="wcf-chip" onclick="irParaItem('${item.id}')"
    data-tip="${papel} · ${_FAM_ESTADO[item.status] || item.status} — clique para abrir">
    ${ic(papel === 'veio de' ? 'chevronLeft' : 'chevronRight','ic-sm')}${esc(item.word || '(frase)')}</button>`
}
function _familiaHtml(w) {
  if (typeof familiaDoItem !== 'function') return ''
  const { pai, filhos } = familiaDoItem(w)
  if (!pai && !filhos.length) return ''
  return `<div class="wc-familia">
    <span class="wcf-lbl">${ic('layers','ic-sm')}Família</span>
    ${pai ? _famChip(pai, 'veio de') : ''}
    ${filhos.map(f => _famChip(f, 'saiu daqui')).join('')}
  </div>`
}

function renderMeaningItem(wordId, m, mi) {
  const sel = m.selected !== false
  const isMatch = m.context_match === true
  const w = words.find(x => x.id === wordId)
  const un = unidadeDoSentido(w, m)
  // O aviso nomeia a unidade e oferece a saída em um clique. Sem nomear, viraria
  // "algo está errado aqui" — que é o tipo de aviso que se aprende a ignorar.
  const avisoUnidade = un ? `
      <div class="mi-unidade" onclick="event.stopPropagation()">
        <div class="miu-txt">${ic('alert','ic-sm')}<span>Este sentido só existe com <b>${esc(un.extra)}</b> — parece ser a expressão <b>${esc(un.unidade)}</b>, não ${esc(w.word)} sozinho.</span></div>
        <button class="btn btn-secondary btn-sm" onclick="separarSentido('${wordId}',${mi})"
          data-tip="Cria um item próprio para a expressão, com baralho e agendamento dele — e tira este sentido daqui">${ic('layers','ic-sm')}Separar em item próprio</button>
      </div>` : ''
  // FASE 2 — o sentido tem estado próprio. Já enviado ou já estudado não pode
  // ser reenviado nem desmarcado aqui: ele saiu desta fila. Mostrar onde ele
  // está é o que evita a pergunta "por que este não vai?".
  const estado = typeof sentidoEstado === 'function' ? sentidoEstado(m) : 'pronto'
  const naFila = estado === 'pronto'
  const selo = estado === 'estudo'  ? `<span class="mi-estado">${ic('bookOpen','ic-sm')} em Estudar</span>`
             : estado === 'revisao' ? `<span class="mi-estado feito">${ic('check','ic-sm')} na Revisão</span>`
             : estado === 'saber'   ? `<span class="mi-estado saber">${ic('eye','ic-sm')} só consulta</span>` : ''
  return `
  <div class="meaning-item ${sel && naFila ? 'selected' : ''} ${isMatch ? 'context-match' : ''} ${naFila ? '' : 'mi-fora'}"
       ${naFila ? `onclick="toggleMeaning('${wordId}',${mi})"` : ''} id="mi-${wordId}-${mi}">
    <div class="mi-checkbox"></div>
    <div class="mi-body">
      <div class="mi-top">
        <div class="mi-meaning">${esc(m.meaning_pt)}</div>
        <div class="mi-chips">
          ${selo}
          ${isMatch ? `<span class="context-match-badge">${ic('check','ic-sm')} contexto</span>` : ''}
          ${m.register ? `<span class="chip register-${m.register}">${m.register}</span>` : ''}
          ${m.level ? `<span class="chip level-${m.level.toLowerCase()}">${m.level}</span>` : ''}
          ${un ? '' : `<button class="btn btn-ghost btn-xs mi-sep" title="Separar em item próprio"
            data-tip="Se este sentido pertence a uma expressão maior, separe: vira item próprio, com baralho e agendamento dele"
            onclick="event.stopPropagation();separarSentido('${wordId}',${mi})">${ic('layers','ic-sm')}</button>`}
          ${(typeof sentidosDe === 'function' && sentidosDe(w).length > 1) ? `<button class="btn btn-ghost btn-xs mi-sep" title="Fundir com outro sentido"
            data-tip="Este sentido é o mesmo que outro daqui? Funda os dois: os exemplos e os cards, com o agendamento, passam para o que ficar"
            onclick="event.stopPropagation();fundirSentidoPerguntar('${wordId}',${mi})">${ic('shrink','ic-sm')}</button>` : ''}
        </div>
      </div>
      ${avisoUnidade}
      ${m.definition_pt ?`<div class="mi-note" style="font-style:italic;opacity:0.8;margin-top:4px">${esc(m.definition_pt)}</div>` : ''}
      ${m.origin_pt ? `<div class="mi-note" style="margin-top:6px;padding:7px 10px;border-radius:var(--radius-sm);background:rgba(var(--primary-rgb),.07);border-left:3px solid rgba(var(--primary-rgb),.5);font-size:var(--fs-sm)"><b>Origem:</b> ${esc(m.origin_pt)}</div>` : ''}
      ${m.context_note ? `<div class="mi-note">${esc(m.context_note)}</div>` : ''}
      ${m.synonyms && m.synonyms.length ? `<div class="mi-note" style="font-size:var(--fs-sm);color:var(--text3)">↔ ${m.synonyms.slice(0,4).map(esc).join(', ')}</div>` : ''}
      ${(m.examples && m.examples.length ? m.examples : (m.example_en ? [{en:m.example_en, pt:m.example_pt||''}] : [])).map((ex, ei) => ex.en ? `
      <div class="mi-example">
        <div style="display:flex;gap:8px;align-items:baseline">
          <span style="font-size:var(--fs-2xs);color:var(--text3);flex-shrink:0;font-weight:600">#${ei+1}</span>
          <div style="flex:1">
            <div class="en">"${allowBold(ex.en)}"</div>
            ${ex.pt ? `<div class="pt">"${allowBold(ex.pt)}"</div>` : ''}
          </div>
        </div>
      </div>` : '').join('')}
    </div>
  </div>`
}

function toggleMeaning(wordId, mi) {
  const w = words.find(x => x.id === wordId); if (!w) return
  // Sentido que já saiu desta fila não se desmarca aqui: ele está em Estudar
  // ou na Revisão, e o desfazer daquele estado mora lá.
  if (sentidoEstado(w.meanings[mi]) !== 'pronto') return
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
  w.meanings.forEach(m => { if (!m.moved_to) m.selected = val })
  saveWords()
  renderWordCard(wordId)
}

// ================================================================
// SEPARAR O SENTIDO QUE NÃO ERA DO ITEM
// ================================================================
// "fall" voltou com o sentido "apaixonar-se" e os três exemplos diziam
// "fall in love": o sentido é da expressão, não da palavra. Separar aqui é
// criar a expressão como ITEM PRÓPRIO — baralho certo (expressões, não
// vocabulário), card próprio, agendamento próprio — e tirar o sentido do pai.
//
// O nome passa pelo aluno antes de virar item: o detector acerta muito, mas
// "fall to the ground" e "fall in love" chegam aqui pelo mesmo caminho e só
// ele sabe qual das duas vale um item.
// ================================================================
// FUNDIR — o desfazer que faltava (Fase 3)
// ================================================================
// O par do "separar". O reconhecimento do reencontro erra nas duas direções, e
// sem os dois desfazeres o primeiro erro vira dado torto para sempre: aqui a
// IA achou que era sentido novo e não era, então dois sentidos iguais passaram
// a disputar a mesma revisão.
//
// O sentido de origem NÃO é removido do array — ganha `fundido_em`, do mesmo
// jeito que o `moved_to` faz com quem virou item próprio. Remover deslocaria os
// índices e os cards antigos passariam a apontar para o sentido errado.
function fundirSentidos(wordId, miOrigem, idDestino) {
  const w = words.find(x => x.id === wordId); if (!w) return
  const origem = w.meanings && w.meanings[miOrigem]
  const destino = (w.meanings || []).find(m => m && m.id === idDestino)
  if (!origem || !destino || origem === destino) return

  // 1) Exemplos que o destino ainda não tem entram nele — material curado não
  //    se joga fora numa fusão.
  const tem = new Set((destino.examples || []).map(e => String(e.en || '').trim()))
  for (const ex of (origem.examples || [])) {
    const k = String(ex.en || '').trim()
    if (k && !tem.has(k)) { (destino.examples = destino.examples || []).push(ex); tem.add(k) }
  }

  // 2) Os cards da origem passam a ser do destino. O que decide a identidade do
  //    card é `meaningId`; o `meaningIdx` vai junto porque ainda é a chave da
  //    imagem e do agrupamento de irmãos.
  const idxDest = w.meanings.indexOf(destino)
  const cards = (typeof srsCards !== 'undefined' ? srsCards : [])
  let movidos = 0
  for (const c of cards) {
    if (c.wordId !== w.id) continue
    if (c.meaningId !== origem.id && c.meaningIdx !== miOrigem) continue
    c.meaningId = destino.id; c.meaningIdx = idxDest
    c.meaning_pt = destino.meaning_pt || c.meaning_pt
    movidos++
  }

  // 3) Card repetido depois da mudança: fica o que tem MAIS história. Jogar
  //    fora o agendamento real por causa de uma fusão seria o mesmo erro que o
  //    "não estudei ainda" evita ao não apagar cards.
  const porFrente = new Map()
  const peso = c => (c.state === 'new' ? 0 : 1) * 1e6 + (c.interval || 0) * 1e3 + (c.lapses || 0)
  let removidos = 0
  for (const c of cards.filter(x => x.wordId === w.id && x.meaningId === destino.id)) {
    const k = String(c.example_en || '')
    const velho = porFrente.get(k)
    if (!velho) { porFrente.set(k, c); continue }
    const perdedor = peso(c) > peso(velho) ? velho : c
    if (peso(c) > peso(velho)) porFrente.set(k, c)
    perdedor._remover = true; removidos++
  }
  if (removidos) {
    const restantes = cards.filter(c => !c._remover)
    srsCards.length = 0; srsCards.push(...restantes)
  }

  // 4) A origem some da vista, sem sair do array.
  origem.fundido_em = destino.id
  destino.estado = (sentidoEstado(destino) === 'pronto' && sentidoEstado(origem) !== 'pronto')
    ? sentidoEstado(origem) : sentidoEstado(destino)
  if (!destino.estudadoEm && origem.estudadoEm) destino.estudadoEm = origem.estudadoEm
  if (origem.context_match) destino.context_match = true

  sincronizarStatusItem(w)
  w.updated_at = new Date().toISOString()
  saveWords(); saveSrsCards()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  if (typeof updateSrsBadge === 'function') updateSrsBadge()
  if (typeof updateDossieBadge === 'function') updateDossieBadge()
  renderWordCard(wordId); renderSidebar(); renderDashboard()
  toast(`Sentidos fundidos${movidos ? ` — ${movidos} card${movidos !== 1 ? 's' : ''} passaram para "${destino.meaning_pt}"` : ''}${
    removidos ? `, ${removidos} duplicado${removidos !== 1 ? 's' : ''} removido${removidos !== 1 ? 's' : ''}` : ''}`, 'success')
}

// Pergunta COM QUAL sentido fundir. Só faz sentido com dois ou mais.
// Com exatamente dois, não há o que perguntar: o destino é o outro, e a
// pergunta viraria um clique a mais para responder o óbvio.
let _fundirEscolha = null
async function fundirSentidoPerguntar(wordId, mi) {
  const w = words.find(x => x.id === wordId); if (!w) return
  const origem = w.meanings && w.meanings[mi]; if (!origem) return
  const outros = sentidosDe(w).filter(m => m !== origem)
  if (!outros.length) { toast('Não há outro sentido para fundir', 'info'); return }

  const aviso = `<p style="font-size:var(--fs-sm);color:var(--text2)">
      "<b>${esc(origem.meaning_pt)}</b>" deixa de existir por conta própria: os exemplos e os cards dele
      — com o agendamento que já têm — passam para o outro sentido.</p>`

  if (outros.length === 1) {
    const ok = await confirmModal({
      title: 'Fundir sentidos', icon: 'layers', confirmText: 'Fundir',
      html: aviso + `<p style="font-size:var(--fs-sm);margin-top:8px">Vai para: <b>${esc(outros[0].meaning_pt)}</b>.</p>`
    })
    if (ok) fundirSentidos(wordId, mi, outros[0].id)
    return
  }

  // Três ou mais: o rádio escolhe o destino, e o botão do modal confirma.
  _fundirEscolha = outros[0].id
  const ok = await confirmModal({
    title: 'Fundir com qual sentido?', icon: 'layers', confirmText: 'Fundir',
    html: aviso + `<div class="fundir-opcoes">${outros.map((m, i) => `
      <label class="fundir-op">
        <input type="radio" name="fundir-dest" value="${escA(m.id)}" ${i === 0 ? 'checked' : ''}
          onchange="_fundirEscolha=this.value">
        <span>${esc(m.meaning_pt)}</span>
      </label>`).join('')}</div>`
  })
  if (ok && _fundirEscolha) fundirSentidos(wordId, mi, _fundirEscolha)
  _fundirEscolha = null
}

function separarSentido(wordId, mi) {
  const w = words.find(x => x.id === wordId); if (!w) return
  const m = w.meanings && w.meanings[mi]; if (!m || m.moved_to) return
  const un = unidadeDoSentido(w, m)
  const nCards = (typeof srsCards !== 'undefined' ? srsCards : [])
    .filter(c => c.wordId === w.id && c.meaningIdx === mi).length
  const aviso = nCards
    ? ` Atenção: ${nCards} card${nCards !== 1 ? 's' : ''} deste sentido já está${nCards !== 1 ? 'ão' : ''} na Revisão com a palavra antiga — remova-o${nCards !== 1 ? 's' : ''} pela Biblioteca se quiser.`
    : ''
  inputModal({
    title: 'Separar em item próprio',
    label: `O sentido "${m.meaning_pt}" sai de "${w.word}" e vira um item novo, que a IA vai analisar do zero. Confira o nome da expressão:${aviso}`,
    value: un ? un.unidade : (w.word || ''),
    placeholder: 'ex.: fall in love',
    confirmText: 'Separar e analisar',
    onConfirm: nome => _separarSentidoExec(wordId, mi, nome)
  })
}

function _separarSentidoExec(wordId, mi, nomeRaw) {
  const w = words.find(x => x.id === wordId); if (!w) return
  const m = w.meanings && w.meanings[mi]; if (!m || m.moved_to) return
  const nome = String(nomeRaw || '').trim()
  const igual = s => String(s || '').trim().toLowerCase()
  if (!nome) return
  if (igual(nome) === igual(w.word)) {
    toast('A expressão precisa ser diferente do item atual', 'warning')
    return
  }
  // Já existe? Então não se cria outro: liga-se a este e o sentido sai do pai
  // do mesmo jeito. Duplicar "fall in love" seria criar duas filas de revisão
  // para a mesma expressão.
  const ja = words.find(x => x.id !== w.id && igual(x.word) === igual(nome))
  // ⚠️ A FRASE DO PAI SÓ VEM JUNTO SE FOR MESMO DESTA EXPRESSÃO. O item "fall"
  // pode ter sido capturado de uma frase sobre o OUTONO ("in the late fall,
  // the sky is a clear blue…") e um dos sentidos que a IA listou ser
  // "apaixonar-se": herdar a frase às cegas deixava o card de "fall in love"
  // ilustrado por uma citação sobre patos e musgo-espanhol. O teste é o mesmo
  // do aviso de captura: a frase contém o material da expressão?
  const ctxServe = _fraseServeParaExpressao(w.context, nome)
  const alvo = ja || createWord({
    word: nome,
    context: ctxServe ? (w.context || '') : '',
    context_pt: ctxServe ? (w.context_pt || '') : '',
    source_type: w.source_type || 'manual',
    source_title: w.source_title || '',
    source_context: w.source_context || '',
    lang: wordLang(w),
    no_break: true
  })
  if (!ja) {
    // A semente garante que o sentido do aluno sobreviva à análise nova; o
    // `_seedFrom` é o que faz a IA marcar a expressão INTEIRA em negrito, em
    // vez de repetir o negrito só no verbo, como estava no exemplo herdado.
    alvo._seedMeaning = m.meaning_pt
    alvo._seedFrom = w.word
    // O tipo fica em branco de propósito: `applyAiResult` só preenche o que
    // está vazio, então quem decide entre phrasal verb e expressão idiomática
    // (e portanto o baralho) é a análise, não um chute do detector.
    alvo.from = { id: w.id, word: w.word, rel: 'mwe', meaning_pt: m.meaning_pt }
  }
  m.selected = false
  m.moved_to = alvo.id
  m.moved_word = nome
  w.spun_off = [...(Array.isArray(w.spun_off) ? w.spun_off : []),
    { meaning_pt: m.meaning_pt, word: nome, wordId: alvo.id, at: Date.now() }]
  w.updated_at = new Date().toISOString()
  saveWords()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  // O card só é redesenhado se for ELE que está na tela: a separação também
  // sai da varredura, onde o item pode estar em `in_srs` e nem ter card aberto.
  renderSidebar()
  if (activeWordId === w.id && el('review-main')) renderWordCard(w.id)
  renderDashboard(); _prepAtualizarCabecalho(); _varreduraRefresh()
  _separarCuidarDosCards(w, mi, nome)
  if (ja) {
    toast(`"${nome}" já existia — o sentido saiu de "${w.word}" e ficou com ele`, 'success')
    return
  }
  toast(`"${nome}" criado — analisando com IA...`, 'success')
  // `analyzeWordDirect` já avisa quando termina (e quando falha) — aqui só
  // resta atualizar a lista, que passou a ter um item a mais.
  analyzeWordDirect(alvo.id).then(() => { renderSidebar(); _prepAtualizarCabecalho() })
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

// ================================================================
// REENCONTRO — o mesmo item, um sentido novo
// ================================================================
// O caso: você lê `fall` num livro, estuda "cair". Uma semana depois esbarra
// em `fall` de novo, e ali é "fracassar". Até aqui o app dizia "já está na sua
// fila" e fechava a porta — a palavra era conhecida, então o SENTIDO era dado
// como conhecido. São coisas diferentes, e essa confusão custava justamente o
// encontro mais valioso: o segundo.
//
// Agora o novo sentido entra NO MESMO item. A progressão do item passa a ser
// natural: ele cresce conforme você esbarra nele, em vez de virar itens
// soltos que não conversam.

// MIGRAÇÃO PREGUIÇOSA E ADITIVA — roda no instante em que passa a ser
// necessária, item por item, como a costura do legado no dossiê.
// O item guarda UMA frase e UMA fonte. A partir do reencontro ele passa a ter
// sentidos de origens diferentes, então cada sentido precisa levar a SUA.
// Sem isto, a frase nova sobrescreveria a antiga e a origem do primeiro
// sentido se perderia para sempre — no exato instante do segundo encontro.
// Aditiva de propósito: os campos do item continuam onde estavam, e todo
// código que lê `w.context` segue funcionando igual.
function _prepDescerContexto(w) {
  let n = 0
  for (const m of (w.meanings || [])) {
    if (!m || m.context) continue
    m.context       = w.context || ''
    m.context_pt    = w.context_pt || ''
    m.source_type   = w.source_type || ''
    m.source_title  = w.source_title || ''
    m.source_context = w.source_context || ''
    n++
  }
  return n
}

// ================================================================
// O ESTADO É DO SENTIDO, NÃO DO ITEM (Fase 2)
// ================================================================
// A unidade de estudo desceu de ITEM para SENTIDO. O card já era assim (um por
// `meaningIdx`); era o resto que estava desalinhado — e essa costura torta era
// a origem de metade da confusão: um item podia estar estudado e ter um
// sentido novo esperando análise ao mesmo tempo, e `w.status` só sabia dizer
// uma das duas coisas.
//
//   'pronto'  — material montado, esperando envio     → aparece no Preparar
//   'estudo'  — enviado ao dossiê                     → aparece em Estudar
//   'revisao' — estudado, virou card                  → Revisão (segue legível no dossiê)
//   'saber'   — só consulta: verbete e glossário, nunca fila nenhuma
const SENT_ESTADOS = ['pronto', 'estudo', 'revisao', 'saber']

function sentidoEstado(m) {
  return (m && SENT_ESTADOS.includes(m.estado)) ? m.estado : 'pronto'
}
// Sentidos que contam. Dois campos tiram um sentido de circulação sem removê-lo
// do array — remover deslocaria os índices e os cards antigos passariam a
// apontar para o sentido errado:
//   `moved_to`   — virou item próprio (o "separar")
//   `fundido_em` — virou o mesmo que outro sentido daqui (o "fundir")
function sentidosDe(w) {
  return (w && Array.isArray(w.meanings) ? w.meanings : [])
    .filter(m => m && m.meaning_pt && !m.moved_to && !m.fundido_em)
}

// O status do ITEM passa a ser DERIVADO. É isto que permite trocar o modelo
// sem reescrever o app: a lista do Preparar, os contadores do Dashboard, os
// badges e o glossário continuam lendo `w.status` e continuam certos.
function sincronizarStatusItem(w) {
  if (!w || w.status === 'skipped') return w && w.status
  const ms = sentidosDe(w)
  if (!ms.length) { w.status = 'pending_ai'; return w.status }
  const est = ms.map(sentidoEstado)
  w.status = est.includes('pronto')  ? 'pending_review'
           : est.includes('estudo')  ? 'in_study'
           : 'in_srs'
  return w.status
}

// MIGRAÇÃO — derivável, sem chute nenhum:
//   tem card                          ⇒ 'revisao'
//   item marcado in_study             ⇒ 'estudo'
//   item já no SRS, sentido sem card  ⇒ 'saber'  (era o 90% que só enchia fila)
//   resto                             ⇒ 'pronto'
// Idempotente: só toca em sentido que ainda não tem estado. Roda no boot e de
// novo na abertura do dossiê, então também cura aparelho que receber dado
// antigo pela nuvem.
function migrarEstadosDeSentido() {
  if (!Array.isArray(words)) return 0
  const comCard = new Set()
  if (Array.isArray(typeof srsCards !== 'undefined' ? srsCards : null)) {
    for (const c of srsCards) if (c && c.wordId) comCard.add(c.wordId + '|' + (c.meaningId || c.meaningIdx))
  }
  let n = 0
  for (const w of words) {
    let mudou = false
    ;(w.meanings || []).forEach((m, mi) => {
      if (!m || m.estado) return
      const temCard = comCard.has(w.id + '|' + (m.id || mi)) || comCard.has(w.id + '|' + mi)
      m.estado = temCard ? 'revisao'
               : w.status === 'in_study' ? 'estudo'
               : w.status === 'in_srs'   ? 'saber'
               : 'pronto'
      if (m.estado === 'revisao' && !m.estudadoEm) m.estudadoEm = w.estudadoEm || Date.now()
      mudou = true; n++
    })
    if (mudou) { _prepDescerContexto(w); sincronizarStatusItem(w) }
  }
  if (n) {
    saveWords()
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  }
  return n
}

// Chamada por quem captura (leitor, e depois vídeo/legenda) quando a palavra
// JÁ existe. `glosa` é a leitura da pré-análise para esta passagem: entra como
// semente, então a análise nasce sabendo qual sentido procurar em vez de
// redescobri-lo com menos contexto do que quem o descobriu.
function prepararNovoSentido(wordId, dados = {}) {
  const w = words.find(x => x.id === wordId)
  if (!w) return false
  _prepDescerContexto(w)
  w.context    = String(dados.contexto || '').replace(/\s+/g, ' ').trim().slice(0, 400)
  w.context_pt = ''
  if (dados.source_type)  w.source_type  = dados.source_type
  if (dados.source_title) w.source_title = dados.source_title
  w.source_context = dados.source_context || ''
  if (dados.glosa) w._seedMeaning = String(dados.glosa).trim()
  // FASE 2: o item NÃO volta inteiro para a fila. Os sentidos já estudados
  // continuam com o estado deles ('revisao'/'estudo') e seguem no dossiê e na
  // Revisão; só o sentido novo nasce 'pronto'. Era esta a limitação declarada
  // da Fase 1 — o reencontro puxava o item todo para trás.
  // O merge da análise preserva os sentidos curados, e os cards nem são
  // tocados: card se liga ao sentido pelo `meaningId`, não pela posição.
  w.updated_at = new Date().toISOString()
  sincronizarStatusItem(w)
  saveWords()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  if (typeof updateDossieBadge === 'function') updateDossieBadge()
  if (typeof renderSidebar === 'function') { try { renderSidebar(); _prepAtualizarCabecalho() } catch (e) {} }
  if (typeof renderDashboard === 'function') { try { renderDashboard() } catch (e) {} }
  toast(`"${w.word || '(frase)'}" — sentido novo foi para o Preparar`, 'success')
  analyzeWordDirect(w.id)
    .then(() => { try { renderSidebar(); _prepAtualizarCabecalho() } catch (e) {} })
    .catch(e => console.warn('[reencontro] análise:', e.message))
  return true
}

// Acha o item existente de uma palavra, aceitando FLEXÃO: quem lê "fell" está
// reencontrando o "fall" que já estuda. Reusa o lematizador do glossário, que
// já foi medido (a cobertura de 91,5% da 83ª rodada foi medida com ele) e já
// cobre irregular por tabela.
function prepAcharItem(palavra, lang) {
  const alvo = String(palavra || '').trim()
  if (!alvo) return null
  const norm = s => (typeof knownNorm === 'function' ? knownNorm(s) : String(s || '').toLowerCase().trim())
  const formas = [alvo]
  if (typeof glossLemas === 'function') {
    for (const l of glossLemas(alvo, { estrito: true })) if (!formas.includes(l)) formas.push(l)
  }
  const mesmoIdioma = w => !lang || !w.lang || w.lang === lang
  for (const f of formas) {
    const k = norm(f)
    const achado = words.find(w => mesmoIdioma(w) && norm(w.word || '') === k)
    if (achado) return achado
  }
  return null
}

// ================================================================
// ENVIAR PARA O ESTUDO — o item SAI daqui
// ================================================================
// A fila do Preparar é uma fila: ela tem de esvaziar. Enquanto o item
// preparado continuava aqui E aparecia no dossiê, as duas telas mostravam a
// mesma coisa e nenhuma das duas dizia onde ele estava de verdade — foi o que
// o Djemeson viu na tela ("o material precisa sair daqui e viver só no
// Estudar"). Agora o caminho é uma passagem de estado, não uma navegação:
//   pending_ai → pending_review → IN_STUDY (dossiê) → in_srs (repetição)
// Volta existe (`voltarParaPreparar`): análise errada não pode virar beco.
// Só pode enviar quem tem sentido PRONTO E MARCADO: desmarcar tudo e mandar
// não é envio, é decidir que nada vale a pena — e isso precisa de clique
// próprio, não pode acontecer de raspão pelo botão de enviar.
function _prepPodeEnviar(w) {
  return !!(w && sentidosDe(w).some(m => sentidoEstado(m) === 'pronto' && m.selected !== false))
}

// O ENVIO É POR SENTIDO. E a caixinha de seleção, que já existia, ganha o
// sentido exato que faltava a ela: marcada = vai estudar; desmarcada = você
// conhece, mas não quer drilar — vira 'saber', continua no verbete e no
// glossário e nunca mais pede tempo de revisão. É o que resolve os ~90% de um
// livro que não são o sentido daquela obra.
function _prepMarcarEnviado(w) {
  let n = 0
  for (const m of sentidosDe(w)) {
    if (sentidoEstado(m) !== 'pronto') continue
    if (m.selected === false) { m.estado = 'saber'; continue }
    m.estado = 'estudo'
    m.enviadoEm = Date.now()
    n++
  }
  w.enviadoEm = Date.now()
  w.updated_at = new Date().toISOString()   // bump p/ vencer o merge do fbPull
  sincronizarStatusItem(w)
  return n
}

function enviarParaEstudo(id) {
  const w = words.find(x => x.id === id)
  if (!w) return
  if (!_prepPodeEnviar(w)) {
    toast('Selecione ao menos um significado com material antes de enviar', 'warning')
    return
  }
  const n = _prepMarcarEnviado(w)
  if (!n) { toast('Nenhum significado marcado — nada foi enviado', 'warning'); sincronizarStatusItem(w); saveWords(); return }
  saveWords()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast(`"${w.word || '(frase)'}" foi para o Estudo`, 'success')
  // Avança para o próximo, como o "pular" já fazia: quem envia está passando
  // a fila, e voltar para a tela vazia a cada envio seria atrito puro.
  renderSidebar()
  _prepAtualizarCabecalho()
  const next = words.find(x => ['pending_ai','pending_review'].includes(x.status) && x.id !== id)
  if (next) { activeWordId = next.id; renderWordCard(next.id) }
  else { activeWordId = null; renderReview() }
  renderDashboard()
  if (typeof updateDossieBadge === 'function') updateDossieBadge()
}

function enviarSelecionadasParaEstudo() {
  const alvos = [...selectedWordIds].map(id => words.find(x => x.id === id)).filter(_prepPodeEnviar)
  if (!alvos.length) { toast('Nenhuma das selecionadas está pronta para enviar', 'warning'); return }
  alvos.forEach(_prepMarcarEnviado)
  saveWords()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  selectedWordIds.clear()
  activeWordId = null
  toast(`${alvos.length} ${alvos.length !== 1 ? 'itens foram' : 'item foi'} para o Estudo`, 'success')
  renderReview(); renderDashboard()
  if (typeof updateDossieBadge === 'function') updateDossieBadge()
}

// A volta. Chamada pelo dossiê (js/dossie.js, lazy) quando a análise saiu
// errada: sem ela, enviar seria uma porta de mão única e o item ficaria preso
// com material ruim — o mesmo beco que o "Não lembro" resolveu no glossário.
function voltarParaPreparar(id) {
  const w = words.find(x => x.id === id)
  if (!w) return
  w.status = 'pending_review'
  delete w.enviadoEm
  w.updated_at = new Date().toISOString()
  saveWords()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  if (typeof updateDossieBadge === 'function') updateDossieBadge()
  activeWordId = w.id
  showSection('preparar')
  setTimeout(() => { try { selectWord(w.id) } catch (e) {} }, 80)
  toast(`"${w.word || '(frase)'}" voltou para o Preparar`, 'info')
}

function skipWord(id) {
  const w = words.find(x => x.id === id); if (!w) return
  w.status = 'skipped'; w.updated_at = new Date().toISOString(); saveWords()
  toast(`"${w.word || '(frase)'}" pulada`, 'info')
  renderSidebar()
  _prepAtualizarCabecalho()
  const next = words.find(x => ['pending_ai','pending_review'].includes(x.status) && x.id !== id)
  if (next) { activeWordId = next.id; renderWordCard(next.id) }
  else renderReview()
  renderDashboard()
}

async function deleteWord(id) {
  const w = words.find(x => x.id === id)
  if (!(await confirmModal({ title: 'Remover palavra', icon: 'trash', danger: true, confirmText: 'Remover',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Remover <b>"${esc(w?.word || '(frase)')}"</b> permanentemente?</p>` }))) return
  markDeleted(id)
  words = words.filter(x => x.id !== id); saveWords()
  toast('Removida', 'info')
  const next = words.find(x => ['pending_ai','pending_review'].includes(x.status) && x.id !== id)
  if (next) { activeWordId = next.id }
  else activeWordId = null
  renderReview()
  renderDashboard()
}

// ================================================================
// DÚVIDA DENTRO DA DÚVIDA — seleção no card do Preparar.
// Caso real (closet Adderall snorter): a análise explica a expressão,
// mas "o que é Adderall?" ficava para outra aba. Agora: selecione
// qualquer palavra/trecho no card → popup com "Explicar" (mini-gloss
// da IA ali mesmo, cobrindo referência cultural) e "Preparar" (vira um
// item novo da fila). Sem sair do flow.
// ================================================================
// ================================================================
// RAIO-X DA FRASE — decompõe um item multi-palavra em unidades de
// estudo (palavras / phrasal verbs / expressões / estruturas) para o
// aluno marcar o que NÃO conhece e mandar SÓ isso para a análise.
// ================================================================
const _revBreakCache = new Map()   // wordId → { items, sel:Set, done:Set }

const _RVB_CATS = [
  ['phrasal_verb', 'Phrasal verbs'],
  ['idiom',        'Expressões idiomáticas'],
  ['collocation',  'Colocações'],
  ['chunk',        'Estruturas / blocos fixos'],
  ['word',         'Palavras']
]

const _revBreakBusy = new Set()

// Triagem AUTOMÁTICA: dispara em segundo plano assim que um item multi-palavra
// entra na revisão (chamado por createWord) — leve de propósito (mini-glosas,
// sem levantamento profundo). Quando o aluno abrir o card, os chips já estão lá.
// Vale também para itens criados PELA triagem ("get you in" pode ter uma
// palavra que o aluno não conhece): o filtro do _revBreakFetch garante que os
// chips saem SÓ de dentro do objeto de estudo — nunca da frase original.
async function _revBreakPrefetch(w) {
  if (!w || !w.id) return
  const alvo = (w.word || w.context || '').trim()
  if (alvo.split(/\s+/).length < 3) return
  if (!aiChatCfg().key || _revBreakCache.has(w.id) || _revBreakBusy.has(w.id)) return
  _revBreakBusy.add(w.id)
  try {
    const { items, trad } = await _revBreakFetch(w)
    _revGuardarTrad(w, trad)
    _revBreakCache.set(w.id, { items, sel: new Set(), done: new Set() })
    // card aberto: re-renderiza inteiro para o layout assumir o estado
    // "com triagem" (a triagem vira protagonista, o resto recua)
    if (activeWordId === w.id) renderWordCard(w.id)
  } catch (e) { console.warn('[raio-x] triagem em segundo plano:', e.message) }
  finally { _revBreakBusy.delete(w.id) }
}

async function revBreakdown(wordId) {
  const w = words.find(x => x.id === wordId); if (!w) return
  const area = el('rev-break-area'); if (!area) return
  if (!aiChatCfg().key) { toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'warning'); return }
  if (_revBreakCache.has(wordId)) { _revBreakRender(wordId); return }
  area.innerHTML = `<div style="margin-top:14px"><span class="gen-spinner"></span> a IA está separando a frase...</div>`
  try {
    const { items, trad } = await _revBreakFetch(w)
    _revGuardarTrad(w, trad)
    _revBreakCache.set(wordId, { items, sel: new Set(), done: new Set() })
    renderWordCard(wordId)
  } catch (e) {
    area.innerHTML = `<div style="margin-top:14px;color:var(--error);font-size:var(--fs-sm)">Não deu: ${esc(e.message)} — clique de novo para tentar.</div>`
  }
}

// A tradução da frase vem NA MESMA chamada da triagem, de propósito: uma
// segunda chamada custaria o dobro e — pior — poderia contradizer as glosas,
// que é exatamente o defeito que estamos combatendo. Mesma leitura, mesma
// frase, mesma resposta.
function _revGuardarTrad(w, trad) {
  if (!w || !trad || w.context_pt) return
  const alvo = words.find(x => x.id === w.id) || w
  alvo.context_pt = trad.slice(0, 400)
  saveWords()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}

// A chamada em si — UMA, curta (triagem, não análise): glosas de até 6
// palavras por unidade. O levantamento profundo só acontece depois, para as
// unidades que o aluno marcar.
async function _revBreakFetch(w) {
  const alvo = (w.word || w.context || '').trim()
  const ctx = (w.context || '').trim()
  const L = getLangDef(wordLang(w))
  const r = await aiJSON(`Break down this ${L.nameEn} snippet for a Brazilian learner who is deciding WHAT to study in it. This is a quick TRIAGE, not a deep analysis. Return ONLY JSON.

Snippet to break down (ONLY this): "${alvo}"${ctx && ctx !== alvo ? `\nSurrounding sentence (context to understand the MEANING only — NEVER take units from it): "${ctx}"` : ''}${w.source_title ? `\nSource: "${w.source_title}"` : ''}

{"trad":"the whole snippet translated into natural Brazilian Portuguese — what it SAYS, never word by word","items":[{"expr":"exact text as it appears in the snippet","type":"word|phrasal_verb|idiom|collocation|chunk","gloss":"what it means IN THIS context, Brazilian Portuguese, max 6 words","nivel":"A1|A2|B1|B2|C1|C2"}]}

Rules:
- FIRST identify multi-word units: phrasal verbs (e.g. "get you in" in "we'll get you in for that"), idioms, collocations and fixed conversational chunks worth learning as a block ("chunk").
- THEN list the remaining notable single words NOT already inside a unit.
- Every "expr" MUST be text that appears INSIDE the snippet — never from the surrounding sentence. Units that are not part of the snippet are discarded.
- NEVER return the whole snippet itself as one unit — only its PARTS (smaller units inside it).
- A free adjective+noun combination is NOT a collocation: if the pair is compositional, return the notable WORD alone ("Japanese ethos" → return "ethos" as a word, C1 — NOT the pair). Only return a pair when it is genuinely fixed ("heavy rain", "make a difference").
- NEVER return trivial contractions or fillers as units ("it's", "I'm", "don't", "you know").
- SKIP trivial function words (articles, pronouns, auxiliaries, basic prepositions) unless they belong to a unit.
- SKIP A1 words the learner certainly knows ("began", "day", "house", "good") UNLESS they carry a non-obvious meaning right here.
- "gloss" is the meaning HERE, not a dictionary list.

${promptRegrasLexicais(wordLang(w), 'glosa')}
- LITERAL-TRANSLATION TRAP — avoid it explicitly: FIRST work out what the unit DOES in this scene, THEN write the gloss for that function. "We'll get you in for that" said at a hotel desk → gloss "a gente te encaixa (na agenda)", NEVER "colocar você dentro". If a gloss reads like word-by-word substitution, redo it before returning.
- "nivel" is the CEFR difficulty of that unit for a learner.
- "trad" must AGREE with the glosses: it is the same reading of the same sentence. If your translation of the whole snippet contradicts a gloss, one of them is wrong — fix it before returning.
- Typically 1–8 items. Cover everything a learner might not know.`, { maxTokens: 800 })
  // Cinto e suspensório: modelo barato ignora a regra e devolve pedaços da
  // frase de CONTEXTO ("Okay.", "Great.") — só passa o que está literalmente
  // dentro do objeto de estudo (comparação sem caixa/pontuação).
  const normB = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,!?;:"""''()\[\]…]/g, ' ').replace(/\s+/g, ' ').trim()
  const alvoNorm = ' ' + normB(alvo) + ' '
  const items = (Array.isArray(r.items) ? r.items : [])
    .map(it => ({ expr: String(it.expr || '').trim(), type: _RVB_CATS.some(c => c[0] === it.type) ? it.type : 'word',
                  gloss: String(it.gloss || '').trim(), nivel: String(it.nivel || '').trim() }))
    // dentro do objeto de estudo, mas nunca o objeto INTEIRO repetido como chip
    .filter(it => it.expr && alvoNorm.includes(' ' + normB(it.expr) + ' ') && normB(it.expr) !== normB(alvo))
    // Segundo cinto: "the mud" chegou como COLOCAÇÃO mesmo com a regra no
    // prompt. Determinante + substantivo é gramática, não vocabulário — o
    // modelo barato não segura isso sozinho, então o código descarta.
    .filter(it => !_RVB_DET.test(it.expr))
    .map(it => {
      // "the mud" → às vezes vem como unidade só para carregar o substantivo;
      // se sobrou o artigo colado num par, fica o substantivo sozinho.
      const m = it.expr.match(_RVB_DET_PAR)
      return m ? { ...it, expr: m[1], type: 'word' } : it
    })
  if (!items.length) throw new Error('a IA não encontrou unidades de estudo')
  return { items, trad: String(r.trad || '').trim() }
}
// Determinantes que nunca formam unidade de estudo com o substantivo seguinte.
const _RVB_DET_LISTA = 'the|a|an|this|that|these|those|my|your|his|her|its|our|their|some|any|no'
const _RVB_DET = new RegExp(`^\\s*(${_RVB_DET_LISTA})\\s*$`, 'i')
const _RVB_DET_PAR = new RegExp(`^\\s*(?:${_RVB_DET_LISTA})\\s+([\\p{L}'-]+)\\s*$`, 'iu')

function _revBreakRender(wordId) {
  const area = el('rev-break-area'); if (!area) return
  const st = _revBreakCache.get(wordId); if (!st) return
  const grupos = _RVB_CATS
    .map(([tipo, rotulo]) => ({ rotulo, idxs: st.items.map((it, i) => it.type === tipo ? i : -1).filter(i => i >= 0) }))
    .filter(g => g.idxs.length)
  // Rodapé só existe quando há o que fazer: nada de botão desabilitado
  // ocupando espaço à espera de uma seleção.
  const rodape = (st.sel.size || st.done.size) ? `
      <div class="rvb-foot">
        ${st.sel.size ? `<button class="btn btn-primary btn-sm" onclick="revBreakStudy('${wordId}')">
          ${ic('arrowRight','ic-sm')}Preparar ${st.sel.size}</button>` : ''}
        ${st.done.size ? `<button class="btn btn-ghost btn-sm" onclick="deleteWord('${wordId}')"
          data-tip="As partes escolhidas já viraram itens próprios — a frase original pode sair da fila">${ic('trash','ic-sm')}Dispensar a frase</button>` : ''}
      </div>` : ''
  area.innerHTML = `
    <div class="rvb">
      <p class="rvb-hint">Marque o que você não conhece</p>
      ${grupos.map(g => `
        <div class="rvb-cat">${esc(g.rotulo)}</div>
        <div class="rvb-row">${g.idxs.map(i => {
          const it = st.items[i]
          const done = st.done.has(i)
          return `<button class="rvb-chip${st.sel.has(i) ? ' on' : ''}${done ? ' done' : ''}"
            ${done ? 'disabled' : `onclick="revBreakToggle('${wordId}',${i})"`}>
            <b>${esc(it.expr)}</b><span>${esc(it.gloss)}${it.nivel ? ' · ' + esc(it.nivel) : ''}</span>
            ${done ? ic('checkCircle','ic-sm') : ''}</button>`
        }).join('')}</div>`).join('')}
      ${rodape}
    </div>`
}

function revBreakToggle(wordId, i) {
  const st = _revBreakCache.get(wordId); if (!st) return
  st.sel.has(i) ? st.sel.delete(i) : st.sel.add(i)
  _revBreakRender(wordId)
}

function revBreakStudy(wordId) {
  const w = words.find(x => x.id === wordId)
  const st = _revBreakCache.get(wordId)
  if (!w || !st || !st.sel.size) return
  const criadas = []
  for (const i of st.sel) {
    const it = st.items[i]
    // O item criado PODE ser triado de novo (um phrasal pode conter uma
    // palavra desconhecida) — mas o filtro do fetch limita os chips ao que
    // está DENTRO dele, nunca à frase original.
    const nova = createWord({
      word: it.expr,
      context: w.context || '',
      source_type: w.source_type || 'manual',
      source_title: w.source_title || '',
      source_context: w.source_context || '',
      lang: wordLang(w)
    })
    if (it.type !== 'word') nova.type = it.type === 'chunk' ? 'collocation' : it.type
    // De onde esta parte saiu. Ganho retroativo da 93ª rodada: o raio-X já
    // criava itens a partir de uma frase e não guardava origem nenhuma — agora
    // guarda, pelo mesmo campo que a separação de sentido usa.
    nova.from = { id: w.id, word: w.word || w.context || '', rel: 'part' }
    criadas.push(nova)
    st.done.add(i)
  }
  // O que o aluno NAO marcou ele declarou conhecer — alimenta o modulo de
  // palavras conhecidas (cobertura de episodios, triagens futuras)
  st.items.forEach((it, i) => { if (!st.sel.has(i) && !st.done.has(i)) markKnownWord(it.expr) })
  st.sel.clear()
  saveWords()
  renderSidebar(); renderDashboard()
  toast(criadas.length > 1 ? `${criadas.length} itens criados — analisando com IA...` : `"${criadas[0].word}" criado — analisando com IA...`, 'success')
  _revBreakRender(wordId)
  // Da triagem direto para a ANÁLISE COMPLETA (pedido: "mas analise") — em
  // sequência para não estourar o fornecedor; cada item avisa quando termina.
  ;(async () => {
    for (const nw of criadas) {
      try { await analyzeWordDirect(nw.id) } catch (e) { console.warn('[raio-x] análise:', e.message) }
    }
    renderSidebar()
  })()
}

// ================================================================
// A PALAVRA QUE NASCEU DENTRO DE UMA EXPRESSÃO
// ================================================================
// O sentido inverso do "fall/apaixonar-se": lá o item existia e o sentido
// estava no lugar errado; aqui o ITEM já nasce errado — clicar em "fall" numa
// frase que diz "fell in love" cria um item que nunca vai poder ser
// consertado por separação, porque o material certo nunca chegou a existir.
//
// Duas camadas, na ordem de custo: primeiro o que é de graça (uma expressão
// que ele JÁ estuda e que está nesta frase), depois, só se ele pedir, a IA.

// De graça. Casa pela CAUDA da expressão ("in love"), não pelo verbo: a frase
// traz o verbo flexionado ("fell", "falling") e comparar forma com forma
// erraria em todo verbo irregular — o mesmo motivo pelo qual o negrito da IA
// é a âncora do detector.
function unidadeJaEstudada(w) {
  const palavra = (w.word || '').trim()
  if (!palavra || palavra.split(/\s+/).length > 1) return null
  const frase = ' ' + _ufNormTxt(w.context) + ' '
  if (frase.trim().length < 3) return null
  const alvo = _ufNormTxt(palavra)
  return (words || []).find(x => {
    if (x.id === w.id) return false
    const partes = String(x.word || '').trim().split(/\s+/)
    if (partes.length < 2) return false
    if (_ufNormTxt(partes[0]) !== alvo) return false           // a expressão começa por esta palavra
    const resto = _ufNormTxt(partes.slice(1).join(' '))
    return !!resto && frase.includes(' ' + resto + ' ')        // e o resto dela está na frase
  }) || null
}
function _ufNormTxt(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z'’\- ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// A frase ilustra esta expressão? Olha o RESTO dela ("in love"), nunca a
// primeira palavra: a frase traz o verbo flexionado ("fell", "falling") e
// comparar forma com forma erra em todo verbo irregular. Item de uma palavra
// só não tem resto — qualquer frase serve.
function _fraseServeParaExpressao(frase, expressao) {
  const txt = String(frase || '').trim()
  if (!txt) return false
  const resto = String(expressao || '').trim().split(/\s+/).slice(1).join(' ')
  if (!resto) return true
  return (' ' + _ufNormTxt(txt) + ' ').includes(' ' + _ufNormTxt(resto) + ' ')
}

const _revExprCache = new Map()   // wordId → [{expr, gloss, type}]
const _revExprBusy = new Set()

async function revExprBuscar(wordId) {
  const w = words.find(x => x.id === wordId); if (!w) return
  if (!aiChatCfg().key) { toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'warning'); return }
  if (_revExprBusy.has(wordId)) return
  const area = el('rev-expr-area')
  if (area) area.innerHTML = `<div class="rvb-loading"><span class="gen-spinner"></span> lendo a frase...</div>`
  _revExprBusy.add(wordId)
  try {
    const L = getLangDef(wordLang(w))
    const r = await aiJSON(`In this ${L.nameEn} sentence, is the word "${w.word}" part of a larger FIXED expression? Return ONLY JSON.

Sentence: "${(w.context || '').trim()}"
Word the learner captured: "${w.word}"

{"items":[{"expr":"the full expression in CITATION form (bare verb + particle(s), e.g. \\"fall in love\\" — never the inflected form \\"fell in love\\")","gloss":"what it means, Brazilian Portuguese, max 6 words","type":"phrasal_verb|idiom|collocation"}]}

Rules:
- Apply the DELETION TEST: only return an expression when removing its other words DESTROYS the meaning it has here. "fell in love" → "fall in love" (delete "in love" and "apaixonar-se" is gone) → RETURN it.
- If "${w.word}" is used in its own plain meaning here and the surrounding words are free, return an EMPTY list. "She fell on the ice" is just "fall" → {"items":[]}.
- Every "expr" MUST contain "${w.word}" (in its base form) and MUST correspond to words actually present in the sentence.
- A verb + a free preposition phrase is NOT an expression: "fall on the ice", "fall from the tree" → empty list.
- At most 2 items. Prefer the single best one.

${promptRegrasLexicais(wordLang(w), 'glosa')}`, { maxTokens: 300 })
    const alvo = _ufNormTxt(w.word)
    const items = (Array.isArray(r.items) ? r.items : [])
      .map(it => ({ expr: String(it.expr || '').trim(), gloss: String(it.gloss || '').trim(),
                    type: ['phrasal_verb','idiom','collocation'].includes(it.type) ? it.type : 'collocation' }))
      // Cinto e suspensório: o modelo barato devolve a expressão sem a palavra,
      // ou devolve a própria palavra como "expressão".
      .filter(it => it.expr && it.expr.split(/\s+/).length > 1 &&
        (' ' + _ufNormTxt(it.expr) + ' ').includes(' ' + alvo + ' '))
      .slice(0, 2)
    _revExprCache.set(wordId, items)
    _revExprRender(wordId)
  } catch (e) {
    if (area) area.innerHTML = `<div style="margin-top:14px;color:var(--error);font-size:var(--fs-sm)">Não deu: ${esc(e.message)} — clique de novo para tentar.</div>`
  } finally { _revExprBusy.delete(wordId) }
}

function _revExprRender(wordId) {
  const area = el('rev-expr-area'); if (!area) return
  const w = words.find(x => x.id === wordId); if (!w) return
  const items = _revExprCache.get(wordId) || []
  // Resposta vazia é resposta: dizer "não, é a palavra mesmo" evita que ele
  // clique de novo achando que falhou.
  if (!items.length) {
    area.innerHTML = `<div class="rvb-hint" style="margin-bottom:var(--sp-3)">${ic('checkCircle','ic-sm')} Aqui <b>${esc(w.word)}</b> está no sentido dela mesma — não faz parte de expressão nenhuma.</div>`
    return
  }
  area.innerHTML = `
    <div class="rvb" style="margin-bottom:var(--sp-3)">
      <p class="rvb-hint">Nesta frase, <b>${esc(w.word)}</b> faz parte de:</p>
      <div class="rvb-row">${items.map((it, i) => `
        <button class="rvb-chip" onclick="revExprAdotar('${wordId}',${i})"
          data-tip="Cria a expressão como item próprio, com a mesma frase e fonte">
          <b>${esc(it.expr)}</b><span>${esc(it.gloss)}</span></button>`).join('')}
      </div>
    </div>`
}

// Adotar a expressão: ela vira o item, e a palavra solta deixa de fazer
// sentido como item — mas quem apaga é ele, não o app.
async function revExprAdotar(wordId, i) {
  const w = words.find(x => x.id === wordId); if (!w) return
  const it = (_revExprCache.get(wordId) || [])[i]; if (!it) return
  const igual = s => String(s || '').trim().toLowerCase()
  const ja = words.find(x => x.id !== w.id && igual(x.word) === igual(it.expr))
  const alvo = ja || createWord({
    word: it.expr,
    context: w.context || '', context_pt: w.context_pt || '',
    source_type: w.source_type || 'manual', source_title: w.source_title || '',
    source_context: w.source_context || '', lang: wordLang(w), no_break: true
  })
  if (!ja) {
    alvo.type = it.type
    alvo._seedMeaning = it.gloss
    alvo.from = { id: w.id, word: w.word, rel: 'mwe' }
    saveWords()
  }
  renderSidebar(); _prepAtualizarCabecalho(); renderDashboard()
  toast(ja ? `"${it.expr}" já estava na fila` : `"${it.expr}" criado — analisando com IA...`, 'success')
  if (!ja) analyzeWordDirect(alvo.id).then(() => { renderSidebar(); _prepAtualizarCabecalho() })
  const ok = await confirmModal({
    title: `Dispensar "${w.word}"?`, icon: 'trash', danger: true,
    confirmText: 'Dispensar', cancelText: 'Manter as duas',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">A expressão <b>${esc(it.expr)}</b> é o que essa frase ensina. Manter <b>${esc(w.word)}</b> sozinho na fila só faz sentido se você quiser estudar a palavra por conta própria também.</p>` })
  if (!ok) { activeWordId = alvo.id; renderReview(); return }
  // A remoção é feita aqui, e não pelo `deleteWord`, porque ele abre a PRÓPRIA
  // confirmação — e perguntar duas vezes a mesma coisa ensina a clicar sem ler.
  // `markDeleted` é o que faz a exclusão propagar para os outros aparelhos.
  if (typeof markDeleted === 'function') markDeleted(w.id)
  words = words.filter(x => x.id !== w.id)
  saveWords()
  activeWordId = alvo.id
  renderReview(); renderDashboard()
  toast(`"${w.word}" dispensada`, 'info')
}

const _revExplainCache = new Map()

if (!window._revSelBound) {
  window._revSelBound = true
  document.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      const pop = el('rev-sel-pop')
      // Clique DENTRO do popup (Explicar/Preparar) não pode fechá-lo: o
      // mousedown no botão colapsa a seleção e este handler via "seleção
      // vazia" e escondia o popup ANTES da explicação aparecer — o bug do
      // "cliquei em Explicar e nada aconteceu".
      if (pop && !pop.classList.contains('hidden') && e.target && pop.contains(e.target)) return
      const sec = document.getElementById('section-preparar')
      if (!sec || !sec.classList.contains('active')) { pop && pop.classList.add('hidden'); return }
      const card = sec.querySelector('.word-card')
      const sel = window.getSelection()
      const bruto = (sel && sel.toString()) || ''
      const txt = bruto.replace(/\s+/g, ' ').trim()
        .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
      if (!txt || txt.length < 2 || txt.length > 80 || !sel.anchorNode || !card || !card.contains(sel.anchorNode)) {
        pop && pop.classList.add('hidden'); return
      }
      _revShowSelPop(txt, sel)
    }, 10)
  })
  // clicar fora fecha
  document.addEventListener('mousedown', e => {
    const pop = el('rev-sel-pop')
    if (pop && !pop.classList.contains('hidden') && !pop.contains(e.target)) pop.classList.add('hidden')
  })
}

function _revShowSelPop(txt, sel) {
  let pop = el('rev-sel-pop')
  if (!pop) {
    pop = document.createElement('div')
    pop.id = 'rev-sel-pop'
    pop.className = 'sel-pop hidden'
    // preventDefault no mousedown: clicar nos botões NÃO colapsa a seleção
    // do card (padrão de toolbar-sobre-seleção)
    pop.addEventListener('mousedown', ev => ev.preventDefault())
    document.body.appendChild(pop)
  }
  window._revSelText = txt
  // frase-contexto: o bloco de texto mais próximo de onde a seleção começou
  const blocoEl = sel.anchorNode.parentElement && sel.anchorNode.parentElement.closest('div, p, blockquote, li, h1, h2, h3, span')
  window._revSelCtx = (blocoEl ? blocoEl.textContent : '').replace(/\s+/g, ' ').trim().slice(0, 220)
  pop.innerHTML = `
    <b>"${esc(txt)}"</b>
    <button class="btn btn-secondary btn-sm" onclick="revSelExplain()" data-tip="Mini-explicação da IA aqui mesmo — sentido, e o que é se for marca/gíria/referência">${ic('sparkles','ic-sm')}Explicar</button>
    <button class="btn btn-ghost btn-sm" onclick="revSelMine()" data-tip="Vira um item novo na fila do Preparar">${ic('eye','ic-sm')}Preparar</button>`
  pop.classList.remove('hidden')
  const r = sel.getRangeAt(0).getBoundingClientRect()
  const acima = r.top > 64
  pop.style.left = Math.max(8, Math.min(window.innerWidth - 360, r.left + r.width / 2 - 170)) + 'px'
  pop.style.top = (acima ? r.top - 52 : r.bottom + 10) + 'px'
}

async function revSelExplain() {
  const txt = window._revSelText
  const pop = el('rev-sel-pop')
  if (!txt || !pop) return
  const w = (typeof activeWordId !== 'undefined' && activeWordId) ? words.find(x => x.id === activeWordId) : null
  const chave = (w ? w.word : '') + '|' + txt
  let corpo = pop.querySelector('.sel-pop-exp')
  if (!corpo) {
    corpo = document.createElement('div')
    corpo.className = 'sel-pop-exp'
    pop.appendChild(corpo)
  }
  if (_revExplainCache.has(chave)) { corpo.innerHTML = _revExplainCache.get(chave); return }
  if (!aiChatCfg().key) { toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'warning'); return }
  corpo.innerHTML = '<span class="gen-spinner"></span> a Lexa está explicando...'
  // Mesma ilustração do leitor, mesma regra: só entra quando o verbete da
  // Wikipédia é REALMENTE do que foi selecionado (ver wikiIlustracao).
  let figura = ''
  const pFig = (typeof wikiIlustracao === 'function')
    ? wikiIlustracao(txt, (w && w.lang) || 'en').then(i => { figura = wikiFiguraHTML(i) }).catch(() => {})
    : Promise.resolve()
  try {
    const resp = await aiTextSeguro([
      { role: 'system', content: lexaExplicar() },
      { role: 'user', content:
`No item de estudo "${w ? w.word : ''}" (contexto: "${window._revSelCtx || (w && w.context) || ''}"), o aluno selecionou: "${txt}".
Explique o que "${txt}" significa AQUI. Se for marca, gíria, referência cultural ou nome próprio, diga o que é no mundo real. Se tiver sentido figurado nesta expressão, explique a imagem.` }
    ], { maxTokens: 600 })   // teto folgado: 220 cortava a resposta no meio (só paga o que gerar)
    await pFig   // a figura já veio (é mais rápida que a IA); só junta
    const html = figura + esc(resp).replace(/\n+/g, '<br>')
    _revExplainCache.set(chave, html)   // aiTextSeguro nunca devolve vazio: não cacheia silêncio
    corpo.innerHTML = html
  } catch (e) {
    corpo.innerHTML = `<span style="color:var(--error)">Não deu: ${esc(e.message)} — clique em Explicar para tentar de novo.</span>`
  }
}

function revSelMine() {
  const txt = window._revSelText
  if (!txt) return
  el('rev-sel-pop')?.classList.add('hidden')
  try { window.getSelection().removeAllRanges() } catch (e) {}
  const w = (typeof activeWordId !== 'undefined' && activeWordId) ? words.find(x => x.id === activeWordId) : null
  createWord({
    word: txt,
    context: window._revSelCtx || (w && w.context) || '',
    source_type: (w && w.source_type) || 'manual',
    source_title: (w && w.source_title) || '',
    lang: (w && w.lang) || undefined
  })
  // Sidebar e badges atualizam; o card aberto NÃO re-renderiza — o flow continua
  if (typeof renderSidebar === 'function') renderSidebar()
  renderDashboard()
  toast(`"${txt}" virou um item novo na fila do Preparar`, 'success')
}
