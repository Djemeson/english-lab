// ================================================================
// LANG — suporte multi-idioma (registro, prompts, decks, migração)
// ⚠️ NÃO-LAZY: usado por review.js, audio.js, srs.js e consulta.js.
// Carregado no index.html logo após core.js.
// Ver PLANO-MULTI-IDIOMA.md para a arquitetura completa.
// ================================================================

const LANGS = {
  en: {
    code: 'en', name: 'Inglês', nameEn: 'English',
    verbCat: 'Phrasal Verbs', verbCatLabel: 'phrasal verb',
    ipaNote: 'American English',
    varieties: [
      { v: 'general',    label: 'Geral' },
      { v: 'american',   label: 'American English' },
      { v: 'british',    label: 'British English' },
      { v: 'australian', label: 'Australian English' },
      { v: 'canadian',   label: 'Canadian English' },
    ],
    varietyRule: 'Use a specific variety only when the word/spelling/sense is predominantly or exclusively used there: "british" (e.g. "lift" = elevator, "lorry", "colour"), "american" (e.g. "soccer", "elevator", "color"), "australian" (e.g. "arvo", "barbie"), "canadian".',
    typeRule: '"phrasal_verb" = verb + particle(s), e.g. "give up", "put up with", "take off". In "type_label" call it "phrasal verb".',
    variantHint: 'phrasal verbs, idioms, collocations, slang',
  },
  es: {
    code: 'es', name: 'Espanhol', nameEn: 'Spanish',
    verbCat: 'Expressões verbais', verbCatLabel: 'expressão verbal',
    ipaNote: 'neutral Latin American Spanish',
    varieties: [
      { v: 'general',     label: 'Geral' },
      { v: 'spain',       label: 'Espanha' },
      { v: 'mexico',      label: 'México' },
      { v: 'rioplatense', label: 'Rio da Prata (AR/UY)' },
      { v: 'caribbean',   label: 'Caribe' },
      { v: 'andean',      label: 'Andino' },
    ],
    varietyRule: 'Use a specific variety only when the word/sense is predominantly used there: "spain" (e.g. "coche", "vale", "vosotros" forms), "mexico" (e.g. "platicar", "chido"), "rioplatense" (e.g. "vos", "che", "laburo"), "caribbean", "andean".',
    typeRule: '"phrasal_verb" = multi-word or pronominal VERBAL EXPRESSION: pronominal verbs (e.g. "arrepentirse", "ponerse"), verbal periphrases (e.g. "echar de menos", "dejar de", "tener que") and fixed verb+preposition patterns. In "type_label" name the exact category in Portuguese (e.g. "verbo pronominal", "perífrase verbal").',
    variantHint: 'pronominal verbs, verbal periphrases, idioms (locuciones), collocations, slang (modismos/jerga)',
  },
  fr: {
    code: 'fr', name: 'Francês', nameEn: 'French',
    verbCat: 'Expressões verbais', verbCatLabel: 'expressão verbal',
    ipaNote: 'Metropolitan French (France)',
    varieties: [
      { v: 'general', label: 'Geral' },
      { v: 'france',  label: 'França' },
      { v: 'quebec',  label: 'Quebec' },
      { v: 'belgium_switzerland', label: 'Bélgica/Suíça' },
      { v: 'africa',  label: 'África francófona' },
    ],
    varietyRule: 'Use a specific variety only when the word/sense is predominantly used there: "quebec" (e.g. "char" = car, "blonde" = girlfriend, "magasiner"), "belgium_switzerland" (e.g. "septante", "nonante"), "africa". Use "france" only for France-specific slang; standard French is "general".',
    typeRule: '"phrasal_verb" = multi-word or pronominal VERBAL EXPRESSION: pronominal verbs (e.g. "se débrouiller", "s\'en aller"), locutions verbales (e.g. "avoir besoin de", "faire la queue") and fixed verb+preposition patterns. In "type_label" name the exact category in Portuguese (e.g. "verbo pronominal", "locução verbal").',
    variantHint: 'pronominal verbs, locutions verbales, idioms (expressions figées), collocations, slang (argot)',
  },
  de: {
    code: 'de', name: 'Alemão', nameEn: 'German',
    verbCat: 'Verbos separáveis', verbCatLabel: 'verbo separável',
    ipaNote: 'Standard German (Hochdeutsch)',
    varieties: [
      { v: 'general', label: 'Geral' },
      { v: 'germany', label: 'Alemanha' },
      { v: 'austria', label: 'Áustria' },
      { v: 'switzerland', label: 'Suíça' },
    ],
    varietyRule: 'Use a specific variety only when the word/sense is predominantly used there: "austria" (e.g. "Jänner", "Erdapfel"), "switzerland" (e.g. "Velo", "parkieren"), "germany" for Germany-only colloquialisms. Standard German is "general".',
    typeRule: '"phrasal_verb" = separable/prefixed or multi-word VERBAL EXPRESSION: separable verbs — trennbare Verben — (e.g. "aufgeben", "anrufen"; the closest analogue of English phrasal verbs), inseparable prefixed verbs with non-transparent meaning (e.g. "verstehen"), and Funktionsverbgefüge treated as verbal patterns (e.g. "eine Entscheidung treffen" may be "collocation"). In "type_label" name the exact category in Portuguese (e.g. "verbo separável", "verbo com prefixo").',
    variantHint: 'separable verbs (trennbare Verben), idioms (Redewendungen), collocations (incl. Funktionsverbgefüge), slang',
  },
}

// Fallback genérico para qualquer código ISO não registrado (japonês, italiano, etc.)
function _langFallback(code) {
  return {
    code, name: code.toUpperCase(), nameEn: code.toUpperCase(),
    verbCat: 'Expressões verbais', verbCatLabel: 'expressão verbal',
    ipaNote: 'the standard variety (add romanization first for non-Latin scripts, e.g. pinyin/romaji, then IPA if useful)',
    varieties: [{ v: 'general', label: 'Geral' }],
    varietyRule: 'Use "general" unless the sense is clearly regional; if regional, return a short lowercase region keyword.',
    typeRule: '"phrasal_verb" = any multi-word, particle, pronominal or separable VERBAL EXPRESSION this language has (the analogue of English phrasal verbs). In "type_label" name the exact local category in Portuguese.',
    variantHint: 'multi-word verbal expressions, idioms, collocations, slang',
  }
}

function getLangDef(code) {
  code = (code || 'en').toLowerCase().slice(0, 5)
  return LANGS[code] || _langFallback(code)
}

// ---------- idioma ativo (persistido em cfg, sincronizado) ----------
function activeLang() { return (typeof cfg !== 'undefined' && cfg.activeLang) || 'en' }
function setActiveLang(code) {
  cfg.activeLang = (code || 'en').toLowerCase()
  saveCfg()
  document.querySelectorAll('.lang-select').forEach(s => { s.value = cfg.activeLang })
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  // Atualiza o empty state do Assistente (sugestões no idioma novo)
  if (typeof renderActiveConversa === 'function') renderActiveConversa()
  toast(`Idioma ativo: ${getLangDef(cfg.activeLang).name}`, 'info')
}

// ---------- acessores com fallback (dados antigos = inglês) ----------
function wordLang(w) { return (w && w.lang) || 'en' }
function cardLang(c) { return (c && c.lang) || 'en' }

// ---------- rótulos ----------
function typeLabel(type, langCode, typeLabelField) {
  if (typeLabelField) return typeLabelField
  const L = getLangDef(langCode)
  const map = { word: 'vocabulário', phrasal_verb: L.verbCatLabel, idiom: 'expressão idiomática', collocation: 'collocation' }
  return map[(type || '').toLowerCase()] || type || ''
}
function varietyLabel(v, langCode) {
  if (!v || v === 'general') return 'Geral'
  const L = getLangDef(langCode)
  const found = L.varieties.find(x => x.v === v)
  return found ? found.label : v
}
function langChip(langCode) {
  if (!langCode || langCode === 'en') return ''
  return `<span class="chip chip-lang">${esc(getLangDef(langCode).name)}</span>`
}

// ---------- fragmentos de prompt (fonte única da parte dependente de idioma) ----------
function promptVarietyRules(langCode) {
  const L = getLangDef(langCode)
  const vals = L.varieties.map(x => x.v).join('|')
  return `- "variety": which ${L.nameEn} variety this sense belongs to (${vals}). Use "general" when the word is standard across all varieties (this is the case for MOST words). ${L.varietyRule} Default to "general" when in doubt.`
}
function promptVarietyEnum(langCode) {
  return getLangDef(langCode).varieties.map(x => x.v).join('|')
}
function promptTypeRules(langCode) {
  const L = getLangDef(langCode)
  return `- "type" is a universal supertype: "word" (single word), "phrasal_verb" (verbal expression), "idiom" (fixed expression with non-literal meaning), "collocation" (words that naturally go together). ${L.typeRule}
- "type_label": the precise local category name, written in Brazilian Portuguese (keep the native term in parentheses when it helps, e.g. "verbo separável (trennbares Verb)"). Empty string for plain words.`
}
function promptIpaRule(langCode) {
  return `"/pronunciation in IPA — ${getLangDef(langCode).ipaNote}/"`
}
function promptLangName(langCode) { return getLangDef(langCode).nameEn }
function promptVariantHint(langCode) { return getLangDef(langCode).variantHint }

// ---------- baralhos por idioma ----------
// Inglês mantém os ids legados (dk-root, dk-vocab, dk-phrasal, dk-idioms, dk-colloc).
function ensureLangDecks(langCode) {
  langCode = (langCode || 'en').toLowerCase()
  if (langCode === 'en') { return { root: 'dk-root', vocab: 'dk-vocab', phrasal: 'dk-phrasal', idioms: 'dk-idioms', colloc: 'dk-colloc' } }
  const L = getLangDef(langCode)
  const ids = {
    root:    `dk-root-${langCode}`,
    vocab:   `dk-vocab-${langCode}`,
    phrasal: `dk-phrasal-${langCode}`,
    idioms:  `dk-idioms-${langCode}`,
    colloc:  `dk-colloc-${langCode}`,
  }
  let changed = false
  const ensure = (id, name, parentId) => {
    if (!srsDecks.find(d => d.id === id)) { srsDecks.push({ id, name, parentId }); changed = true }
  }
  ensure(ids.root, L.name, null)
  ensure(ids.vocab, 'Vocabulário', ids.root)
  ensure(ids.phrasal, L.verbCat, ids.root)
  ensure(ids.idioms, 'Expressões idiomáticas', ids.root)
  ensure(ids.colloc, 'Colocações', ids.root)
  if (changed) { saveSrsDecks(); if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange() }
  return ids
}

// Substitui o roteamento fixo do inglês (core.js getWordDeckId delega para cá)
function deckIdForWord(wordType, langCode) {
  const ids = ensureLangDecks(langCode)
  const m = { phrasal_verb: ids.phrasal, idiom: ids.idioms, collocation: ids.colloc }
  return m[(wordType || '').toLowerCase()] || ids.vocab
}

// ---------- migração aditiva (dados antigos → 'en') ----------
function migrateLangFields() {
  let changed = false
  ;(words || []).forEach(w => { if (!w.lang) { w.lang = 'en'; changed = true } })
  ;(srsCards || []).forEach(c => { if (!c.lang) { c.lang = 'en'; changed = true } })
  if (changed) { saveWords(); saveSrsCards() }
  return changed
}

// ---------- seletor de idioma (UI) ----------
function langSelectorHtml(extraClass) {
  const cur = activeLang()
  const known = Object.values(LANGS)
  const opts = known.map(L => `<option value="${L.code}" ${L.code === cur ? 'selected' : ''}>${esc(L.name)}</option>`).join('')
  const extra = LANGS[cur] ? '' : `<option value="${esc(cur)}" selected>${esc(getLangDef(cur).name)}</option>`
  return `<select class="lang-select ${extraClass || ''}" onchange="setActiveLang(this.value)" data-tip="Idioma ativo — vale para novas capturas e para o Assistente">${opts}${extra}</select>`
}
function mountLangSelector(containerId) {
  const el = document.getElementById(containerId)
  if (el) el.innerHTML = langSelectorHtml()
}
