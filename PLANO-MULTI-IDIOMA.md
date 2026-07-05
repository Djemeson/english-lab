# Plano Multi-idioma — English Lab → Language Lab

> Criado em 2026-07-05. Análise + plano de implementação para o app aceitar **qualquer idioma**
> na entrada, mantendo o português (BR) como idioma-base do aprendiz na saída.
> Idiomas prioritários definidos pelo Djemeson: **Espanhol, Francês e Alemão** (além do inglês).

---

## 1. Decisões tomadas (com o Djemeson, 2026-07-05)

| Decisão | Escolha |
|---|---|
| Idiomas prioritários | Espanhol, Francês, Alemão (sistema segue genérico p/ qualquer outro) |
| Definição do idioma na entrada | **Seletor de idioma ativo** + auto-detecção pela IA (avisa/corrige se divergir) |
| Organização de baralhos | **Raiz por idioma** (Inglês, Espanhol...) com subdecks por tipo, criados sob demanda |
| Idioma-base (saída) | Português (BR) — significados, definições, origens e traduções continuam em PT |
| Branding/infra | Nome "English Lab", repo, URL e Firebase **não mudam** (só o conteúdo fica multi-idioma) |

---

## 2. Análise — onde o inglês estava "hardcoded"

1. **Prompts de IA** (todos assumiam "English … for a Brazilian learner"):
   - `review.js` → `analyzeWordDirect` (análise principal): "English vocabulary item", variety
     só com variedades do inglês, `ipa` fixo em "American English", `type` com `phrasal_verb`.
   - `add.js` → Kindle (`SYSTEM_PROMPT`), clique-na-palavra (detecção de expressão), Website
     (n8n `SYSTEM`), extrator de documento (`LIST_SYSTEM` / `ENRICH_SYSTEM`).
   - `audio.js` → reanálise (`reanalyzeAll`), classificação variety/register, origem
     (`fillOriginsAll`), negrito perfeito (`markBoldAll`), prompt de imagem.
   - `study.js` → `regenerateCardExample`.
   - `consulta.js` → `CONSULTA_SYSTEM` ("tutor de inglês") e `SRS_EXTRACT_SYSTEM`.
2. **Modelo de dados**: `words[]` e `srsCards[]` sem campo de idioma; `variety` com enum do
   inglês; `type` com enum `word|phrasal_verb|idiom|collocation`.
3. **Baralhos**: `DEFAULT_DECKS` com raiz "Inglês" fixa; `getWordDeckId` roteando só p/ os 4
   subdecks do inglês.
4. **UI**: dropdown de variedade (study.js) com American/British/...; mapas `TYPE` com rótulos
   do inglês; textos ("Pergunte qualquer coisa em inglês").
5. **TTS/áudio**: OK — o `tts-1` da OpenAI é multilíngue e lê o texto no idioma em que está
   escrito. Nenhuma mudança necessária.

---

## 3. Estudo — equivalentes de phrasal verbs / idioms em outros idiomas

A conclusão central: **as categorias do app já são quase universais**. Todo idioma tem
*palavras*, *expressões idiomáticas* e *colocações*. O que varia é a categoria "verbo
multi-palavra" — cada idioma tem seu análogo do phrasal verb:

| Idioma | Análogo do phrasal verb | Exemplos | Outras categorias notáveis |
|---|---|---|---|
| **Inglês** | phrasal verbs (verbo+partícula) | give up, put up with | idioms, collocations, slang |
| **Espanhol** | verbos pronominais + perífrases verbais | ponerse, arrepentirse; echar de menos, tener que | locuciones ("estar en las nubes"), colocaciones ("tomar una decisión"), modismos/jerga por país |
| **Francês** | verbes pronominaux + locutions verbales | se débrouiller, s'en aller; avoir besoin de | expressions figées ("poser un lapin"), collocations, argot/verlan |
| **Alemão** | **trennbare Verben** (verbos separáveis) — o análogo mais direto | aufgeben, anrufen ("ich rufe dich an") | Funktionsverbgefüge ("eine Entscheidung treffen" = collocation), Redewendungen (idioms), compostos |
| Italiano | verbi sintagmatici + verbi pronominali | mettere su; cavarsela, andarsene | espressioni idiomatiche, collocazioni |
| Russo | verbos prefixados (prefixo ≈ partícula) | выходить/выйти | idioms, aspecto verbal |
| Japonês | verbos compostos | 取り出す | yojijukugo (idioms de 4 kanji), onomatopeias (giongo/gitaigo) |
| Chinês | 离合词 (liheci, verbos separáveis!) | 见面, 帮忙 | chengyu (成语 = idioms de 4 caracteres) |

### Solução de design: supertipos universais + rótulo local

- O enum `type` atual (`word | phrasal_verb | idiom | collocation`) **é mantido como supertipo
  universal** — nada de migração de dados:
  - `phrasal_verb` passa a significar "**expressão verbal**" (verbo multi-palavra/partícula/
    pronominal/separável/perífrase — o que o idioma tiver);
  - `idiom` = expressão idiomática; `collocation` = colocação; `word` = palavra.
  - gíria/slang continua sendo capturada pelo `register` (que já existe e é universal).
- Novo campo opcional **`type_label`** (por sentido/palavra), preenchido pela IA com o **nome
  local da categoria** — ex.: "phrasal verb", "verbo separável (trennbares Verb)", "verbo
  pronominal", "perífrase verbal", "expression figée". A UI mostra `type_label` quando existir;
  senão, cai no rótulo genérico do supertipo.
- O roteamento de baralho continua pelo supertipo (funciona igual p/ qualquer idioma).

### Pronúncia

`ipa` continua sendo IPA (funciona para es/fr/de/it/ru...). A referência por idioma fica no
registro `LANGS` (en = americano; es = latino-americano neutro; fr = França; de = alemão padrão).
Para idiomas de escrita não-latina (japonês, chinês), o mesmo campo recebe a romanização +
IPA quando útil (instrução no registro do idioma; não bloqueia nada agora).

### Variedades

`variety` vira dinâmico por idioma, definido no registro `LANGS`:
- en: general, american, british, australian, canadian (como hoje);
- es: general, espanha, méxico, rioplatense, caribe, andino;
- fr: general, frança, quebec, belgica_suica, africa;
- de: general, alemanha, austria, suiça;
- idiomas não registrados: só "general" + o que a IA devolver (aceito como string livre).

---

## 4. Arquitetura da implementação

### Novo arquivo `js/lang.js` (NÃO-lazy, carregado logo após `core.js`)

É usado por review/audio/srs/consulta (não-lazy), então **não pode ser lazy** (armadilha nº 1).
Contém:

- **`LANGS`** — registro por idioma: `{ code, name (PT), nameEn (p/ prompts), varieties[],
  ipaNote, verbCatLabel (nome do subdeck de expressões verbais), typeNotes (texto p/ a IA
  explicando o que conta como "phrasal_verb" naquele idioma), variantHint }`. Registrados:
  en, es, fr, de (+ fallback genérico p/ qualquer código ISO).
- **Helpers**: `getLangDef(code)`, `activeLang()` / `setActiveLang(code)` (persiste em
  `cfg.activeLang`, sincronizado), `wordLang(w)` / `cardLang(c)` (fallback `'en'`),
  `typeLabel(type, langCode, typeLabelField)`, `varietyLabel(v, lang)`.
- **Fragmentos de prompt**: `promptLangHeader(lang)`, `promptVarietyRules(lang)`,
  `promptTypeRules(lang)`, `promptIpaRule(lang)` — todos os prompts passam a montar a parte
  dependente de idioma por aqui (uma fonte só da verdade).
- **Decks**: `ensureLangDecks(code)` — cria sob demanda `dk-root-<code>` + subdecks
  (Vocabulário / <verbCatLabel> / Expressões idiomáticas / Colocações). Inglês mantém os ids
  legados (`dk-root`, `dk-vocab`...). `getWordDeckId(type, lang)` ganhou o parâmetro.
- **Migração**: `migrateLangFields()` — words/cards sem `lang` recebem `'en'` (aditiva,
  chamada no boot; risco baixo).
- **Seletor de idioma**: `langSelectorHtml()` + binding — pill no header do Adicionar e na
  barra do Assistente. O idioma ativo vale para: análise de novos itens, extrator de
  documentos, Kindle/Mídia/Website e o tutor do Assistente.

### Auto-detecção

`analyzeWordDirect` passa a pedir `"detected_lang"` (ISO 639-1) no JSON. Se divergir do idioma
ativo, o item é salvo com o idioma detectado (deck certo) e um toast avisa
("Idioma detectado: Espanhol"). O seletor manda; a detecção corrige distração.

### Modelo de dados (mudanças aditivas — sem migração destrutiva)

- `words[]`: + `lang` ('en' por padrão); `meanings[]`: + `type_label` opcional.
- `srsCards[]`: + `lang` no snapshot (+ `type_label`).
- `cfg`: + `activeLang`.
- Nada é renomeado/removido → dados antigos continuam válidos; sync não muda.

### Toques de UI

- Seletor de idioma ativo (Adicionar + Assistente), persistido.
- Dropdown de variedade do card (study.js) dinâmico pelo idioma do card.
- Chip do idioma no card/browser quando `lang !== 'en'`.
- Mapas `TYPE` substituídos por `typeLabel()`.
- Textos "em inglês" → "no idioma ativo" onde aplicável.

---

## 5. Fases

1. **F1 — Fundação**: `js/lang.js` + script no index.html + migração + `cfg.activeLang`. ✅
2. **F2 — Criação**: createWord/createSrsCard com `lang`; prompt principal (review.js)
   parametrizado + detected_lang + type_label; decks por idioma. ✅
3. **F3 — Entradas**: add.js (Kindle, linha a linha, extrator de doc, website) parametrizado;
   seletor no Adicionar. ✅
4. **F4 — Manutenção**: audio.js (reanálise, variety/register, origem, negrito, imagem) — os
   lotes respeitam o idioma de cada card. ✅
5. **F5 — Estudo/Assistente**: study.js (dropdown de variedade, regenerar exemplo) e
   consulta.js (tutor multi-idioma + seletor). ✅
6. **F6 — Teste ao vivo** (pendente): adicionar 1 palavra em es/fr/de, conferir análise, deck
   criado, card, áudio TTS e Assistente. Backup (Exportar JSON) antes.

---

## 6. Riscos e salvaguardas

- **Lazy-loading**: `lang.js` é não-lazy; nenhum símbolo dele pode ser definido em add/study.
- **Dados**: mudanças 100% aditivas; ainda assim, exportar JSON antes do primeiro teste.
- **Shell desatualizado**: validação via Read/app ao vivo, nunca `node -c` no bash.
- **Palavras curtas ambíguas** (ex.: "chat" existe em en e fr): o seletor de idioma ativo é a
  fonte da verdade; a auto-detecção só sobrepõe quando a IA tiver certeza pelo contexto.
