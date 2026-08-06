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
      { v: 'american',   label: 'American English',   short: 'AmE'  },
      { v: 'british',    label: 'British English',    short: 'BrE'  },
      { v: 'australian', label: 'Australian English', short: 'AuE'  },
      { v: 'canadian',   label: 'Canadian English',   short: 'CanE' },
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

// ---------- chips de variedade e registro ----------
// Moram AQUI (lang.js é NÃO-lazy) de propósito: quem desenha esses chips é o
// study.js (lazy, na flashcard) E o audio.js (não-lazy, no glossário da
// Biblioteca). Enquanto os mapas viviam no study.js, o audio.js dependia de um
// arquivo lazy — a "armadilha nº 1" do projeto. Ver ESTADO-DO-PROJETO, seção 2.

// Registro agrupado por FAMÍLIA de uso: a COR do chip diz a família (ver CSS) e
// o TEXTO diz o termo exato. Sem emoji — o rótulo já carrega o significado.
const REGISTER_LABELS = {
  slang:      { label: 'gíria',      cls: 'slang'      },
  informal:   { label: 'informal',   cls: 'informal'   },
  colloquial: { label: 'coloquial',  cls: 'colloquial' },
  formal:     { label: 'formal',     cls: 'formal'     },
  technical:  { label: 'técnico',    cls: 'technical'  },
  literary:   { label: 'literário',  cls: 'literary'   },
  archaic:    { label: 'arcaico',    cls: 'archaic'    },
  vulgar:     { label: 'vulgar',     cls: 'vulgar'     },
}

// Forma curta da variedade: "AmE" em vez de "American English". Só o inglês tem
// abreviação consagrada; nos outros idiomas o próprio rótulo já é curto
// ("Quebec", "México", "Áustria"), então cai no label normal.
function varietyShort(v, langCode) {
  if (!v || v === 'general') return ''
  const found = getLangDef(langCode).varieties.find(x => x.v === v)
  return found ? (found.short || found.label) : v
}

// Variedade é NEUTRA de propósito: são dezenas de valores somando os 4 idiomas
// (AmE, BrE, Quebec, Rio da Prata, Áustria…) e pintar cada um seria arbitrário e
// não escalaria. O rótulo já é preciso; a cor fica reservada ao registro.
function varietyChip(variety, langCode) {
  const label = varietyShort(variety, langCode)
  if (!label) return ''
  const full = varietyLabel(variety, langCode)
  return `<span class="srs-variety-chip" data-tip="Variedade: ${escA(full)}">${esc(label)}</span>`
}

function registerChip(register) {
  const r = REGISTER_LABELS[register]
  if (!r) return ''
  return `<span class="srs-register-chip ${r.cls}">${r.label}</span>`
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
// ================================================================
// REGRAS LEXICAIS — a fonte ÚNICA de verdade para todo prompt que
// produz português (glosa, tradução, análise).
// ================================================================
// Por que existir (2026-08-05): as regras viviam espalhadas em 9 prompts,
// cada um com a sua cópia — e cópia diverge. Foi assim que a triagem disse
// "perder o interesse" enquanto a Lexa dizia "cansar-se", o `does` enfático
// virou "fazer a roupa" e o cano do fuzil virou "barril". Cada erro novo de
// modelo barato vira uma regra AQUI, com exemplo contrastivo (o formato que
// modelo barato respeita), e todos os prompts herdam de uma vez.
//
// Modos (o teto de atenção do modelo barato é curto — cada prompt recebe só
// o que precisa):
//   'analise'  — análise completa de um item (review.js)
//   'glosa'    — glosa curta em triagem/captura (raio-x, kindle, mídia, vídeo)
//   'traducao' — tradução de frase/legenda inteira
function promptRegrasLexicais(langCode, modo) {
  const L = getLangDef(langCode)
  // O núcleo que TODO produtor de português precisa — 4 regras, cada uma com
  // o erro real que a motivou como exemplo contrastivo:
  const nucleo = `MEANING RULES — each one exists because a cheap model actually made that mistake. Follow ALL:
1. ANTI-LITERAL: translate what the ${L.nameEn} DOES in this scene, the way a Brazilian would say it — never word by word. "we'll get you in" (hotel desk) → "a gente te encaixa", NEVER "colocar você dentro".
2. DOMAIN CHECK: decide WHAT the thing IS in this sentence, then pick the Portuguese word for THAT thing — never the most frequent dictionary equivalent. "a bayonet mounted on the tip of its barrel" → barrel is a RIFLE's barrel: "cano", NEVER "barril" (container). Never hedge between two domains ("de armas ou recipientes") — the sentence already decided.
3. SUBSTITUTION TEST: put your Portuguese back into the sentence. If the sentence stops saying what the ${L.nameEn} says, it is wrong. "we began to tire of the mud" + "perder o interesse" → "começamos a perder o interesse na lama" is NOT what it says; "cansar-se de" is.
4. SELF-CHECK: if your own examples/definition describe one domain and your Portuguese uses a word from another, the translation is WRONG — fix it before returning.`

  if (modo === 'traducao') return nucleo

  const glosa = `${nucleo}
5. CITATION FORM: verbs in the infinitive ("began" → "começar", NEVER "começamos"), nouns in the singular, adjectives masculine singular. The gloss NAMES the unit; it does not re-translate the sentence.
6. DETERMINER + NOUN IS NEVER A UNIT: "the mud", "a house", "his hand" are grammar, not vocabulary — return the noun alone or nothing.`

  if (modo === 'glosa') return glosa

  // 'analise' — tudo acima + a regra de gramática, que só faz sentido quando
  // há objeto "meanings" com context_match para apontar
  return `${glosa}
7. GRAMMAR BEFORE DICTIONARY: look at what the item is DOING in the context sentence. If it works as a STRUCTURAL element — emphatic/interrogative/negative auxiliary (do/does/did), perfect auxiliary (have/has/had), modal, copula or progressive/passive "be", infinitive marker "to", complementizer "that", dummy "it/there" — the FIRST meaning MUST describe that GRAMMATICAL FUNCTION (with "gramatical": true and "context_match": true); the lexical sense may come after, with context_match false.
   WORKED EXAMPLE — "does" in "The boat ride does add time to the trip":
   WRONG: meaning "fazer, executar", examples "She does the laundry" (lexical verb — not what "does" is doing here).
   RIGHT: first meaning "de fato, realmente (ênfase)" [gramatical:true, context_match:true], examples like "I do like it" / "She did tell me"; only then "fazer, executar" [context_match:false].
   Every example under the grammatical meaning must show the word in that FUNCTION, never in the lexical sense.`
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
