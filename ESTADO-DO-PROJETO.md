# English Lab — Estado do Projeto e Guia de Continuidade

> Documento vivo. **Sempre leia este arquivo antes de iniciar qualquer tarefa** e
> **atualize-o ao finalizar cada tarefa** (instrução fixada no `CLAUDE.md`).
>
> Última atualização: 2026-07-05 — **Suporte MULTI-IDIOMA implementado** (qualquer idioma na
> entrada; PT-BR continua sendo a saída). Novo `js/lang.js` (NÃO-lazy, logo após core.js) com o
> registro `LANGS` (en/es/fr/de + fallback genérico), seletor de idioma ativo (Adicionar +
> Assistente), decks por idioma sob demanda, auto-detecção e supertipos universais + `type_label`.
> Ver `PLANO-MULTI-IDIOMA.md`. ⚠️ Ainda NÃO testado ao vivo.

---

## 1. O que é o projeto

**English Lab** é uma plataforma pessoal (web, HTML/CSS/JS puro, sem build) para o
Djemeson estudar inglês por leitura progressiva. Captura vocabulário de várias fontes,
analisa com IA (OpenAI), gera áudio (TTS) e estuda com **repetição espaçada (SRS) nativa**
(algoritmo SM-2 estilo Anki). Sincroniza entre dispositivos via **Firebase/Firestore**.

- **Hospedagem:** GitHub Pages → `https://djemeson.github.io/english-lab/`
- **Deploy:** AUTOMÁTICO. A pasta é um reppositório git sincronizado; qualquer edição
  salva já é enviada ao GitHub e publicada. **Não é preciso commitar manualmente.**
- **IA:** OpenAI (chave fica em `cfg.openaiKey`). Análise e TTS rodam direto no browser.
- **n8n:** usado APENAS para extrair vocabulário de páginas web (única coisa que o
  browser não faz sozinho). URL em `cfg.n8nBase`.

---

## 2. Estrutura de arquivos

```
index.html        — markup de todas as seções + modais
css/styles.css    — todo o CSS (tokens/temas no topo, camadas premium no fim)
sw.js             — service worker (cache do shell)
js/core.js        — estado, storage, temas, ÍCONES, toast, inputModal, tooltips, navegação
js/lang.js        — MULTI-IDIOMA: registro LANGS, idioma ativo, prompts, decks/idioma, migração (NÃO-lazy)
js/firebase.js    — sincronização Firestore (TEMPO REAL)
js/audio.js       — IndexedDB (AudioDB/CardsDB/ImageDB), TTS, Biblioteca (browser de cards), reanálise
js/srs.js         — MOTOR SM-2 (estado srsCards/srsCfg/srsLog/srsSession)
js/dashboard.js   — render do Dashboard
js/review.js      — fila de Revisar + análise de IA (prompt principal)
js/settings.js    — Configurações (cfg, temas, AI_MODELS, limpar dados)
js/init.js        — bootstrap (initApp) + service worker
js/add.js         — aba Adicionar (manual/Kindle/Mídia/Website)  (CARREGADO LAZY)
js/consulta.js    — seção Assistente (chat IA, histórico, streaming, SRS múltiplo)  (NÃO-lazy)
js/study.js       — UI/sessão do SRS          (CARREGADO LAZY)
```

> ⚠️ **`consulta.js` é NÃO-lazy** (incluído sempre no index.html). Motivo: o `firebase.js`
> precisa de `conversas`/`saveConversas` no sync e re-renderiza o Assistente no snapshot.
> O ESTADO `conversas`/`activeConversaId` + `loadConversas`/`saveConversas` ficam em `core.js`
> (não-lazy); só a UI/lógica do chat vive em `consulta.js`.

### ⚠️ Lazy-loading — a armadilha nº 1 do projeto
`add.js` e `study.js` são carregados **sob demanda** (só ao abrir "Adicionar"/"Estudar"),
via `_LAZY` em `core.js`. **Funções/variáveis definidas neles NÃO podem ser usadas por
arquivos não-lazy** (core, firebase, audio, srs, dashboard, review, settings, init),
senão quebra com `X is not defined` quando o usuário não passou por aquela aba.

Já corrigimos vários casos assim (movendo para arquivos não-lazy):
- `srcIcon` → core.js
- `AI_MODELS` / `updateModelOptions` → settings.js
- `OPENAI_VOICES` / `randomVoice` → audio.js
- `srsSession` → srs.js
**Ao criar algo novo, verifique quem usa antes de decidir onde declarar.**

---

## 3. Modelo de dados

- **`words[]`** — itens capturados. Cada um: `{id, word, context, source_type, source_title,
  source_context, lang, status, ipa, type, type_label, meanings[], created_at, updated_at}`.
  `status`: `pending_ai` → `pending_review` → `in_srs` (ou `skipped`).
  - `lang`: código ISO do idioma do item ('en' padrão/legado). `type` é supertipo universal
    (`word|phrasal_verb|idiom|collocation`; `phrasal_verb` = expressão verbal do idioma);
    `type_label` = nome local da categoria em PT (ex.: "verbo separável"). Ver `js/lang.js`.
  - `source_context`: nota opcional de gênero/contexto da fonte (ex.: "reality de sobrevivência").
    Usada pela IA para desambiguar (resolve o caso "snuff" → "apagar a tocha" no Survivor).
  - `meanings[]`: `{meaning_pt, definition_pt, origin_pt, variety, register, level, examples[], ...}`
    - `origin_pt`: origem/história da expressão (só quando há etimologia/imagem interessante;
      vazio para palavras comuns). Vai para o snapshot do card e aparece no estudo e na revisão.
  - `examples[]`: `{en, pt}` (en com a palavra-alvo em `<b>`).
- **`srsCards[]`** — um card por (wordId, meaningIdx, exampleIdx). Guarda *snapshot*
  do conteúdo + estado SM-2: `{id, wordId, meaningIdx, exampleIdx, deckId, state, due,
  interval, ease, lapses, stepIdx, variety, register, word, lang, type_label, meaning_pt,
  example_en, example_pt, leech?}`. `state`: `new|learning|review|relearning`.
- **`srsDecks[]`** — baralhos (árvore). Padrão em `DEFAULT_DECKS` (core.js).
- **`srsLog[]`** — `{date, reviewed, correct, newSeen}` por dia.
- **`srsCfg`** — parâmetros SM-2 (ver seção SRS).
- **`cfg`** — `{openaiKey, n8nBase, theme, aiProvider, aiModel, ttsProvider}`.

### Onde cada coisa é persistida
- **localStorage:** `cfg` (`englab_cfg`), `words`, `srsCfg`, `srsLog`, `srsDecks`, filas Kindle.
- **IndexedDB:** `CardsDB` (cards — fonte local primária), `AudioDB` (áudios b64),
  `ImageDB` (imagens b64), `SettingsDB` (**backup da cfg** — sobrevive à limpeza do localStorage).
- **Firestore (`users/{uid}/`):** `data/{words,srsCards,srsCfg,srsLog,srsDecks,cfg,kindleQueue}`,
  `audio/*`, `images/*`.

---

## 4. Sincronização (Firebase) — MODELO ATUAL: tempo real, nuvem = fonte da verdade

`js/firebase.js`:
- **Login** (`onAuthStateChanged`) → `attachRealtimeSync()`: listener `onSnapshot` na
  coleção `data`. Qualquer mudança/exclusão em qualquer dispositivo reflete na hora.
- **`applyCloudDocs(docs)`**: adota o estado da nuvem (SUBSTITUI o local, **sem merge**).
  - Doc presente (mesmo com lista vazia) → adota → **exclusões propagam**.
  - Doc ausente → ignora (não apaga dispositivo que ainda não sincronizou).
  - `cfg`: só sobrescreve campos não-vazios (preserva chave/URL locais).
  - Durante **sessão de estudo ativa**, cards da nuvem ficam em `_pendingCloudCards` e são
    aplicados ao encerrar a sessão (`flushPendingCloudCards`, chamado em `endSrsSession`).
  - Ignora o "eco" das próprias escritas (`metadata.hasPendingWrites`).
- **Mudança local** → `autoSyncAfterChange()` (debounce ~1.2s) → `fbPushData()` grava os
  docs na nuvem → propaga para os outros via snapshot.
- **`fbPushData`**: grava words/srsCards/srsCfg/srsLog/srsDecks + `cfg` (com `merge:true`,
  **omitindo openaiKey/n8nBase vazios** para nunca apagar a chave na nuvem).
- **Áudio/imagens:** `fbPullMedia()` (uma vez ao conectar). Push de áudio via
  `autoSyncAudioAfterChange` (debounce longo).
- **`setPersistence(LOCAL)`** garante que o login sobreviva a refresh.

Trade-off aceito: edição simultânea do mesmo item em 2 lugares = vence o último a salvar.

⚠️ **Ainda não testado em 2 dispositivos ao vivo.** Antes de mexer em sync, **exportar JSON**
(Configurações → Exportar) como backup.

---

## 5. Motor SRS (SM-2 estilo Anki) — `js/srs.js`

`SRS_DEF_CFG` espelha o preset do Anki do usuário:
```
newPerDay, revPerDay, steps[] (aprendizagem, min), relearnSteps[] (reaprendizagem, min),
graduateInterval (1d), easyInterval (4d), easeStart (2.5), easeMin (1.3), easyBonus (1.3),
hardInterval (1.2), intervalModifier (1.0), lapseNewInterval (0), minInterval (1),
maxInterval (36500), leechThreshold (50)
```
- **Card novo + "Bom"** → avança UMA etapa de aprendizagem (ex.: 10m) e **reaparece na
  sessão**; só gradua (vira `review`, 1 dia) ao concluir todas as etapas. **"Fácil"** pula
  o aprendizado e vai direto p/ revisão (4 dias). (Era o bug "estudado só uma vez" — corrigido.)
- **Lapso (errar em review)** → `relearning` com etapas próprias; intervalo reduzido por
  `lapseNewInterval`; ao atingir `leechThreshold` falhas, marca `card.leech` (selo, sem suspender).
- Modal "Configurar SRS" expõe todos os parâmetros + botão **"Preset do Anki"**.
- `rateSrsCard` (aplica nota), `previewInterval` (mostra o próximo intervalo nos botões).

---

## 6. Identidade visual / Premium

- **Temas:** `data-theme` no `<html>`. 5 temas em `THEMES` (core.js): `midnight` (padrão),
  `light`, `sepia`, `emerald`, `violet`. Trocados em Configurações → Aparência. `applyTheme()`
  grava em `cfg.theme` (persistido + sincronizado). TODA cor usa variáveis CSS (`var(--...)`);
  acentos usam `rgba(var(--primary-rgb), …)` para seguir o tema.
- **Ícones:** SEM emojis na interface. Use `ic('nome')` (core.js, mapa `ICONS`, SVG de linha).
  `srcIcon(tipo)` para fontes (série/filme/etc.). HTML estático usa `<svg class="ic">` inline.
- **Tooltips:** sistema global em core.js — qualquer elemento com `data-tip` ou `title`
  ganha tooltip premium (flutuante, não cortado por overflow).
- **Modais:** use `inputModal({...})` (core.js) em vez de `prompt()`. Overlay `.srs-modal-overlay`.
- **Layout:** conteúdo centralizado (`.section` com max-width; Biblioteca é full-width),
  sidebar com logo + nav em pílulas + cartão de conta, page-headers com ícone + ação à direita.

---

## 7. Telas (seções)

- **Dashboard** — ação principal (estudar hoje) + cards de métrica com ícone. (Mantido como está.)
- **Assistente** — seção própria (2ª no menu), chat com IA estilo Claude. Layout de duas colunas:
  histórico de conversas à esquerda (nova/selecionar/renomear/excluir/buscar) e o chat à direita.
  - **Histórico persistido** em `conversas[]` (localStorage `el-consulta-conversas`) e **sincronizado**
    via Firebase (doc `data/conversas`, merge por `id` mantendo o `updated_at` mais recente).
  - **Streaming** (SSE da OpenAI, `stream:true`) — a resposta aparece aos poucos.
  - **Vários itens SRS por resposta**: o prompt pede um ARRAY `<srs_items>` com TODOS os termos
    falados (não só um). Cada termo vira um botão "Adicionar"; se já estiver em `words[]`, mostra
    "já no estudo" (anti-duplicado). Botão "Adicionar todos" quando há mais de um pendente.
  - Adicionar um item reusa `createWord` + `saveToSrs` (cria a palavra em `pending_review` já com
    significado/exemplos e salva direto no SRS).
- **Adicionar** — abas Manual / Kindle / Mídia / Website. (A aba **Consulta** saiu daqui e virou a
  seção **Assistente**.)
  - **Mídia** tem três entradas: (1) colar texto linha a linha → `analyzeMidiaText`; (2) campo
    opcional de **contexto/gênero** (`#midia-context-new`); (3) **upload/arrastar documento**
    (.md/.txt/.pdf) → `handleMidiaFile` → `extractMidiaDoc`. O doc é lido (PDF via pdf.js do CDN),
    a IA infere o gênero pela fonte e extrai só o que vira card, com significado **no contexto da
    fonte**. Cada item vira palavra em `pending_review` (via `createDocWord`) já com significado +
    exemplo + IPA + nível — pronto para salvar no SRS, sem perdas na revisão.
- **Revisar** — sidebar (filtros em pílula + busca + lista) e card central com significados
  selecionáveis. Ação principal: "Salvar para estudo" (cria os cards SRS). Badge de pendentes
  fica NESTE item do menu.
- **Estudar** — números clicáveis (Novos/Revisar/Aprender) abrem a Biblioteca filtrada;
  tabela de baralhos; sessão de flip card + 4 botões (Errei/Difícil/Bom/Fácil).
- **Biblioteca** — aba própria. Browser de todos os cards por baralho + preview. Botão
  **"Reanalisar tudo (corrigir)"**: regenera exemplos batendo com o significado, preenche
  variedade/registro e gera áudio das novas frases, **preservando o agendamento SRS**.
- **Configurações** — Aparência (temas), IA (provider/modelo/chave/TTS), n8n, Firebase, Dados
  locais (exportar/importar/limpar), Manutenção de áudio.

---

## 8. Histórico do que foi feito (sessão de junho/2026)

### Sessão 2026-07-05 — SUPORTE MULTI-IDIOMA (es/fr/de prioritários; genérico p/ qualquer um)
38. **Multi-idioma completo** — decisões do Djemeson: idiomas prioritários **Espanhol, Francês e
    Alemão**; **seletor de idioma ativo + auto-detecção**; **baralho raiz por idioma**; saída
    continua PT-BR. Plano completo em **`PLANO-MULTI-IDIOMA.md`**. Implementação:
    - **`js/lang.js` (novo, NÃO-lazy, carregado logo após core.js no index.html e no sw.js —
      cache bump p/ `englab-v4`)**: registro `LANGS` (en/es/fr/de + `_langFallback` genérico p/
      qualquer código ISO) com variedades, regras de prompt (`varietyRule`/`typeRule`/
      `variantHint`/`ipaNote`) e nome do subdeck de expressões verbais. Helpers: `getLangDef`,
      `activeLang`/`setActiveLang` (persistido em `cfg.activeLang`, sincronizado),
      `wordLang`/`cardLang` (fallback 'en'), `typeLabel`, `varietyLabel`, `langChip`, fragmentos
      de prompt (`promptVarietyRules`, `promptVarietyEnum`, `promptTypeRules`, `promptIpaRule`,
      `promptLangName`, `promptVariantHint`), `ensureLangDecks` (cria `dk-root-<code>` + 4
      subdecks sob demanda; inglês mantém ids legados), `deckIdForWord`, `migrateLangFields`
      (aditiva: words/cards antigos ganham `lang:'en'`; chamada no initApp), `langSelectorHtml`/
      `mountLangSelector` (seletores `#lang-selector-add` e `#lang-selector-asst`).
    - **Taxonomia**: enum `type` mantido como SUPERTIPO universal (`phrasal_verb` = "expressão
      verbal": phrasal/pronominal/separável/perífrase); novo campo **`type_label`** (nome local
      da categoria em PT, ex. "verbo separável (trennbares Verb)") na palavra, nos meanings e no
      snapshot do card. Gíria continua via `register`. Roteamento de deck pelo supertipo.
    - **Prompts parametrizados por idioma**: review.js (análise principal + `detected_lang` p/
      auto-detecção — se divergir, a palavra adota o idioma detectado, cria os decks e avisa),
      add.js (Kindle, clique-na-palavra, linha a linha, extrator de doc LIST/ENRICH; o webhook
      do site agora envia `lang`/`lang_name` ao n8n — **falta ajustar o workflow n8n**),
      audio.js (reanálise, classificação variety/register em lote c/ `lang` por item, origem,
      negrito perfeito, prompt de imagem), study.js (regenerar exemplo), consulta.js
      (`CONSULTA_SYSTEM`/`SRS_EXTRACT_SYSTEM` viraram FUNÇÕES `consultaSystem()`/
      `srsExtractSystem()` do idioma ativo; sugestões do empty state por idioma).
    - **UI**: seletor de idioma no header do Adicionar e na barra do Assistente (CSS
      `.lang-select`); chip de idioma (`.chip-lang`) no Revisar e nos cards quando ≠ inglês;
      dropdown de variedade do card dinâmico pelo idioma (`getLangDef(...).varieties`);
      `_normVariety` agora valida contra as variedades do idioma do item.
    - **Dados (aditivo, sem migração destrutiva)**: `words[]`+`lang`/`type_label`;
      `srsCards[]`+`lang`/`type_label` no snapshot; `cfg`+`activeLang`. Sync inalterado.
    - Typo pré-existente corrigido no prompt do doc ("rape"→"rapé").

### Sessão 2026-06-25 — fuso horário do "dia" do SRS (renovação da contagem)
37. **`todayStr()` passou a usar a data LOCAL (Brasília)** em vez de `toISOString()` (UTC).
    Sintoma: o Djemeson não tinha estudado nada "hoje", mas "Novos disponíveis" mostrava 26 (= 50 −
    24). Causa: o "dia" do SRS renovava às **00:00 UTC = 21:00 de Brasília**, então cards estudados
    depois das 21h eram contados no dia seguinte. Agora o dia vira à **meia-noite local**. Afeta
    `srsNewTodayRemaining`, `newLimit` da sessão, `srsStreak`, `addedDate` e o log diário (`srsLog`).
    ⚠️ Entradas de `srsLog` já gravadas antes desta correção ficaram com data UTC; a correção é só
    daqui pra frente (uma entrada mal-atribuída ao "hoje" UTC zera sozinha no dia seguinte local).
    (Possível evolução estilo Anki: "novo dia começa às 4h" configurável — não feito.)

### Sessão 2026-06-25 — cor dos novos (Estudar) + esclarecimento dos contadores
35. **"Novos disponíveis" = quantos novos ainda faltam hoje** (`study.js` → `renderSrsSection`,
    `el('srs-new-count') = newRem = srsNewTodayRemaining()` = `min(newPerDay − vistos hoje, estoque)`).
    Esse SEMPRE foi o comportamento correto/desejado (confirmado pelo Djemeson). Numa 1ª tentativa eu
    troquei por "estoque total de novos" — **revertido**. Esclarecimento que gerou a dúvida:
    **"Para revisar hoje"** (`srsDueCount()`) são as **revisões** vencidas (controladas por
    *Revisões por dia*), NÃO por *Novos por dia* — por isso nunca reflete o valor de "Novos por dia".
    Quem reage a *Novos por dia* é o card **"Novos disponíveis"** (desconta os já vistos no dia).
36. **Azul = novos** (antes azul = revisar; alinha com a tabela de baralhos, onde NOVO já é azul).
    Trocadas as cores em `css/styles.css`
    (`.srs-dash-card.new` → `--primary`/azul, `.due` → `--success`/verde) e no subtítulo da sessão
    em `study.js` (mantendo azul nos "novos" e verde no "para revisar"). Streak segue `--warning`.

1. **Persistência da cfg**: backup em IndexedDB (`SettingsDB`, "pegajoso" p/ chave/URL) +
   restauração no boot; `setPersistence(LOCAL)`; cfg sincronizada (merge, omit-empty).
2. **Removida toda a integração com Anki** (AnkiConnect, envio de cards, campos, indicador).
3. **Sistema de 5 temas** + seletor em Configurações.
4. **Redesign premium completo** (tokens, gradientes, sombras, microanimações, layout centralizado,
   sidebar, headers, métricas).
5. **Sistema de ícones** `ic()` + remoção de emojis da interface.
6. **Badge de pendentes** movido de "Adicionar" para "Revisar".
7. **Biblioteca virou aba própria**; contadores do Estudar clicáveis (abrem filtrado).
8. **Tooltips globais** premium.
9. **`inputModal`** substituindo `prompt()` (criar/renomear deck).
10. **Sidebar do Revisar** reconstruída (filtros segmentados, itens em cartão, chips de status).
11. **Variedade/Registro**: IA passou a preencher; dropdowns com padrão Geral/Neutro.
12. **"Reanalisar tudo"** na Biblioteca (corrige frases que não batiam com o significado +
    variedade/registro + gera áudio; preserva SRS).
13. **Consulta**: 3 exemplos → 3 cards; corrigido vazamento de HTML/JSON e botão quebrado
    (passou a referenciar por índice, não JSON no onclick).
14. **Motor SRS estilo Anki** (correção da graduação por etapas + reaprendizagem + todos os
    parâmetros + modal expandido + preset do Anki + leech).
15. **Sync em tempo real** (onSnapshot, nuvem = verdade; "Limpar tudo" propaga o vazio).
16. Correções de bugs lazy/não-lazy (`srcIcon`, `AI_MODELS`/`updateModelOptions`,
    `randomVoice`/`OPENAI_VOICES`, `srsSession`).

### Sessão 2026-06-24 (5ª rodada) — glossário, indicador de sentido e negrito EN+PT
32. **Modo "Palavras" na Biblioteca** (toggle `Cards | Palavras` no header — `setLibMode`,
    `_libMode`, `_applyLibModeUI`). O glossário (`renderWordsGlossary`/`glossWordHtml` em audio.js)
    lista cada objeto de estudo UMA vez, com todos os seus sentidos (significado, definição,
    variedade/registro, 1 exemplo com negrito, origem), busca com debounce
    (`renderWordsGlossaryDebounced`) e contagem "N palavras · M sentidos". Resolve a dor de "na
    Biblioteca aparecem todas as frases de todas as palavras". Deriva tudo de `srsCards` (snapshot),
    agrupado por `wordId` → `meaningIdx`.
33. **Chip "sentido X de Y" nos cards** (`senseInfo` em srs.js — não-lazy; chip em `buildMetaChips`).
    Aparece SÓ quando a palavra tem mais de um sentido em estudo (discreto). Mostra posição/total e,
    ao clicar, abre o glossário focado naquele termo (`openWordGlossary` → rola e dá um flash).
34. **Negrito perfeito do objeto de estudo (EN + PT)** — resolve "muitas frases em inglês sem
    negrito". Causa raiz: `buildSrsFrente` DESCARTAVA o `<b>` que a IA já colocava e tentava refazer
    por regex, que falha em formas irregulares (run→ran, go→went) e expressões. Correções:
    - **Render (grátis, instantâneo):** `escB()` em core.js (escapa preservando `<b>`).
      `buildSrsFrente` agora CONFIA no `<b>` existente (só usa regex quando não há nenhum). O PT da
      frase passou a renderizar com `escB` (antes era `esc(strip(...))` — removia o negrito). Idem
      no Revisar e no preview da Mídia (usam `allowBold`, equivalente a `escB`).
    - **Botão IA retroativo** "Negrito perfeito (IA)" na Biblioteca (`#lib-bold-btn` → `markBoldAll`/
      `markBoldOne`, gpt-4o-mini, `runPool` concorrência 4). Pega só as frases sem `<b>` (EN ou PT),
      pede o termo em `<b>` no inglês e o equivalente em `<b>` no português, escreve nos cards e nos
      significados da palavra. Preserva o agendamento SRS. Deduplica por par exato (palavra+EN+PT).
    - **Todas as novas** já saem com PT em negrito: prompts ajustados em `review.js` (análise
      principal), `regenerateMeaning` (audio.js), `regenerateCardExample` (study.js), `consulta.js`
      (Assistente) e o doc extractor de `add.js`. Removidos os `replace(/<\/?b>/gi,'')` que
      apagavam o `<b>` do PT no add.js e no review.js.
    - CSS premium novo: `.lib-mode-toggle/.lmt-btn`, `.srs-sense-chip`, todo o bloco `.gloss-*`.

### Sessão 2026-06-24 (4ª rodada) — múltiplos sentidos por termo (doc)
31. **Sentidos múltiplos** no extrator de documento (`extractMidiaDoc`/`createDocWord`/
    `renderMidiaDocItem`). Antes, um termo virava 1 significado só — um artigo do Mairo que ensina
    "run by" em 5 sentidos (falar com alguém / apresentar ideia / repassar / dar um pulo / passar
    correndo) colapsava tudo num significado. Agora a Fase 2 retorna `senses[]` (um objeto por
    sentido que o documento realmente desenvolve), cada sentido com seus próprios
    significado/definição/registro/origem e os **exemplos reais do texto atribuídos àquele sentido**.
    `createDocWord` monta `w.meanings[]` com um significado por sentido (todos `selected`), então o
    SRS gera cards por sentido × exemplo (reaproveita `saveToSrs`/`createSrsCard`). Preview mostra os
    sentidos numerados + chip "N sentidos". Fallback de sentido único preservado; max_tokens do
    enriquecimento subiu p/ 5000. Itens só MENCIONADos continuam fora (filtro da 3ª rodada).
31b. **Correção (1ª tentativa falhou)**: a Fase 1 estava SEPARANDO as variações ("run by",
    "run something by someone", "ran by") em 3 itens — eu havia, por engano, mandado incluir as
    sub-estruturas como itens separados. Agora a Fase 1 **CANONICALIZA E MESCLA**: cada expressão
    sai UMA vez na forma base (verbo+partícula p/ phrasal), sem separar por sentido, inflexão
    ("ran by"→"run by") ou padrão estrutural ("run something by someone"→"run by"). Os sentidos são
    montados só na Fase 2. Também: exemplos por sentido voltaram a ser **EXATAMENTE 3** (prefere as
    frases reais do doc; completa com exemplos fiéis ao sentido se o texto tiver menos de 3).
31c. **Validado ao vivo (Claude in Chrome)** rodando o prompt NOVO direto na API (gpt-4o-mini)
    sobre o artigo "Pass On" (que NÃO é o exemplo do prompt — generalização honesta): retornou
    **7 sentidos**, **3 exemplos cada** (`[3,3,3,3,3,3,3]`), com as frases reais do texto. Também
    blindado: remove `<b>` da tradução PT dos exemplos (o modelo às vezes inseria). ⚠️ Deploy
    OneDrive→GitHub é assíncrono + service worker cacheia o JS; pode levar alguns minutos / um
    hard-refresh até a UI ao vivo refletir a versão nova.

### Sessão 2026-06-24 (3ª rodada) — extrator de documento: só o que é ENSINADO
30. **Filtro "ensinado vs mencionado"** na Fase 1 do `extractMidiaDoc` (`add.js` → `LIST_SYSTEM`).
    Sintoma: ao colar o artigo "Run By" do Mairo (que ensina só *run by*), o projeto gerou 15 itens —
    os 3 certos (família *run by*) + 12 phrasal verbs que o artigo só **cita de passagem** numa frase
    de efeito ("run out, run into, run off…"). A Fase 1 mandava ser EXAUSTIVA e capturava tudo;
    a Fase 2 então **inventava** exemplos (do conhecimento geral) para esses 12, perdendo a curadoria
    da fonte. Correção: o prompt agora inclui um termo **só** se o documento o desenvolve (tem
    explicação própria e/ou frase de exemplo real no texto); termos apenas listados/citados são
    descartados (com o caso "run by" como exemplo no próprio prompt). `doc_example_en` virou a "prova"
    de que o termo é ensinado.

### Sessão 2026-06-24 (2ª rodada) — robustez do Assistente + recolher + Mídia colada
27. **Extração de SRS robusta** (`consulta.js`): o botão "Adicionar" não aparecia em perguntas
    PT→EN ("como se diz X em inglês?"). Mudança de abordagem: a resposta visível agora é
    **conversacional e limpa** (sem JSON no prompt) e os termos de estudo são extraídos em uma
    **chamada dedicada** (`extractSrsItems` → `_consultaOpenAIJSON`, `response_format:json_object`)
    sobre o par pergunta/resposta — explicitamente pega o termo em inglês mesmo com pergunta em PT
    e ambos os lados em "diferença entre X e Y". Mostra loader "Procurando termos para estudo…".
    Removidos `parseSrsItems`/`extractSrsRaw` (inline); `stripSrsBlocks`/`cleanConsultaReply` ficam
    como defesa.
28. **Sidebar global recolhível** (rail só-ícones) e **coluna de histórico recolhível** —
    **independentes**, cada uma com seu toggle, ambas premium e persistidas (`el-ui-prefs`).
    - Sidebar: botão chevron no brand → `body.sb-collapsed` (largura 74px, só ícones, tooltips
      via `data-tip`). `toggleSidebar`/`applyUiPrefs`/`saveUiPref`/`loadUiPrefs` em `core.js`
      (aplicado cedo p/ evitar flash).
    - Histórico: barra superior do chat (`.asst-chat-top`, sempre visível) com toggle →
      `.asst-layout.hist-collapsed`. No mobile o mesmo botão abre o drawer. `toggleHistory` em
      `consulta.js`; preferência aplicada em `renderAssistente`.
29. **Mídia aceita material COLADO como documento** (`add.js` → `extractMidiaPasted`): novo botão
    "Extrair material colado" roda o mesmo fluxo rico do upload (`extractMidiaDoc`) sobre o texto
    do `#midia-text-new` — ideal para colar artigos do **Mairo Vergara** (formatos "Como se diz",
    "O que significa", "Qual a diferença entre", "phrasal verb", "Estruturas"). O botão antigo
    virou "Analisar linha a linha" (uma palavra/frase por linha). Ambos com legenda explicativa.

### Sessão 2026-06-24 — Assistente (Consulta promovida a seção própria)
22. **Consulta saiu da aba Adicionar e virou a seção "Assistente"** (2º item do menu). Dashboard
    mantido como estava. Novo arquivo `js/consulta.js` (NÃO-lazy) com toda a UI/lógica; estado
    `conversas`/`activeConversaId` + `loadConversas`/`saveConversas` em `core.js`; `'assistente'`
    adicionado a `SECTIONS` e ao `_activateSection`; `loadConversas()` no boot (`init.js`).
23. **Histórico de conversas persistido + sincronizado**: `conversas[]` no localStorage e no
    Firebase. `firebase.js`: `fbPushData` grava `data/conversas`; `fbPull` e `applyCloudDocs`
    leem (merge por `id` pelo `updated_at` mais recente — não apaga conversa local recém-criada);
    `_refreshActiveViews` re-renderiza o Assistente no snapshot. Conversa criada na 1ª mensagem
    (sem conversas vazias); título automático a partir da primeira pergunta.
24. **Respostas em streaming** (SSE `stream:true`): texto renderizado aos poucos com markdown leve;
    blocos `<srs_items>` ficam ocultos durante o streaming (`stripSrsBlocks`).
25. **Vários itens SRS por resposta + anti-duplicado**: prompt agora pede ARRAY `<srs_items>` com
    TODOS os termos da resposta. Cada um vira botão "Adicionar"; `isWordInStudy` mostra "já no
    estudo" para os que existem em `words[]`; botão "Adicionar todos". Fallback de parse aceita o
    `<srs_item>` único legado.
26. **CSS estilo Claude** (`styles.css`): `.asst-layout` (grid 2 colunas), sidebar de conversas,
    bolhas, "typing dots", sugestões no empty state, chips de termos SRS e responsivo (sidebar vira
    drawer em telas estreitas; `#section-assistente{max-width:none}`).

### Sessão 2026-06-23 — contexto da fonte + importação de documentos
17. **Análise sensível à fonte** (`review.js` → `analyzeWordDirect`): o prompt agora recebe
    `source_type`/`source_title`/`source_context` e instrui a IA a inferir o GÊNERO da fonte e
    eleger como `context_match` (primeiro da lista) o sentido usado naquele contexto, mantendo os
    demais sentidos gerais. Corrige "snuff" (Survivor) = "apagar a tocha" em vez de "rapé".
18. **Campo opcional de contexto/gênero** na aba Mídia (`#midia-context-new`) + novo campo
    `source_context` em `createWord` (dashboard.js), propagado em todo o fluxo de Mídia.
19. **Importação de documento na Mídia** (.md/.txt/.pdf), por clique ou arrastar
    (`#midia-drop`/`#midia-file` → `handleMidiaFile`). PDF lido com **pdf.js** carregado do CDN sob
    demanda (`loadExtScript`/`readPdfTextMidia`). `extractMidiaDoc` roda em **DUAS FASES** (helper
    `_openaiJSON`): (1) listagem leve e exaustiva de TODOS os termos (output pequeno → não corta
    itens); (2) enriquecimento em **lotes de 6** (IPA, nível, registro, definição, **3 exemplos**
    en/pt → 3 cards), com progresso visível. Lote que falha mantém o significado/exemplo do doc
    (nada se perde). Antes era 1 chamada só, que estourava o teto de tokens e cortava itens
    (ex.: doc com 31 → só 20). Preview rico
    (`renderMidiaDocItem`); ao adicionar, `createDocWord` cria a palavra em `pending_review`
    preservando o significado/exemplo do doc como `context_match`. Reaproveita a lista/seleção
    existente de Mídia (`midiaProcessed` com flag `doc:true`).
20. **Origem/história das expressões** (`origin_pt`): novo campo no significado, preenchido pela
    IA SÓ quando há etimologia/imagem interessante (idiomas, expressões, metáforas — ex.: "sitting
    duck", "on the chopping block", "flagship"); vazio para palavras comuns; sem inventar. Gerado
    em `analyzeWordDirect` (review.js), na importação de doc (`extractMidiaDoc` fase 2), em
    `regenerateMeaning`/`reanalyzeAll` (audio.js — backfill dos cards já no SRS) e na Consulta.
    Vai ao snapshot em `createSrsCard` (srs.js) e aparece no card de estudo (`buildSrsVerso`,
    bloco "Origem") e na revisão (`renderMeaningItem`). Importação de doc grava `_seedMeaning` na
    palavra para que uma "Re-analisar" por palavra PRESERVE o significado curado (não reinventa).
21. **Botão TEMPORÁRIO "Preencher origem"** na Biblioteca (`#lib-fill-origin-btn` → `fillOriginsAll`
    em audio.js): passada leve (gpt-4o-mini) que SÓ adiciona `origin_pt` aos significados que ainda
    não têm — não toca em significado, definição, frases, variedade/registro nem agendamento. Pula
    os que já têm origem. **A REMOVER depois do backfill** (botão + função).

---

## 9. Pendências / a verificar

- [ ] **Testar o MULTI-IDIOMA ao vivo** (após deploy + hard-refresh; backup — Exportar JSON —
      antes): (1) trocar o seletor p/ Espanhol no Adicionar, adicionar "echar de menos" e
      analisar — conferir type=phrasal_verb c/ type_label "perífrase verbal", IPA, variedades
      es no dropdown do card e deck "Espanhol" criado; (2) auto-detecção: com seletor em Inglês,
      adicionar "se débrouiller" com frase de contexto em francês → deve avisar "Idioma
      detectado: Francês" e ir p/ o deck certo; (3) Assistente: trocar o idioma na barra do chat
      e conferir sugestões + resposta como tutor do idioma + termos extraídos no idioma;
      (4) TTS de uma frase em espanhol/alemão (tts-1 é multilíngue); (5) conferir chip de idioma
      nos cards não-ingleses e o glossário.
- [ ] **Ajustar o workflow do n8n** (`webhook/en-site`): o app agora envia `lang` e `lang_name`
      no payload — usar no prompt do workflow p/ extrair vocabulário do idioma certo.
- [ ] (Multi-idioma, opcional) Filtro por idioma na Biblioteca/glossário; nome exibido do app
      ("English Lab" → "Language Lab"?) — infra (repo/URL/Firebase) fica como está.
- [ ] **Testar ao vivo as melhorias da 5ª rodada** (após o deploy GitHub Pages + hard-refresh):
      (1) abrir Biblioteca → alternar **Cards/Palavras**, conferir o glossário e a busca; (2) num card
      de palavra com 2+ sentidos, ver o chip **"sentido X de Y"** e clicar (deve abrir o glossário no
      termo); (3) rodar **"Negrito perfeito (IA)"** e conferir o `<b>` no inglês e no português (cards
      antigos); (4) criar/analisar uma palavra nova e confirmar que o PT já vem em negrito. Backup
      (Exportar JSON) antes do passo 3, pois ele reescreve as frases dos cards.
- [ ] **Testar o Assistente ao vivo** (fazer backup — Exportar JSON — antes, pois o sync mudou):
      perguntar algo, ver o streaming, conferir os botões "Adicionar"/"Adicionar todos" e o
      "já no estudo"; recarregar e confirmar que a conversa persiste; checar o doc `data/conversas`
      no Firebase. Testar uma pergunta com vários termos (ex.: "diferença entre speak e talk") e
      confirmar que aparecem dois botões.
- [ ] **Testar o sync em tempo real em 2 dispositivos** (abrir em duas abas/navegadores e
      confirmar propagação e exclusão). Fazer backup (Exportar JSON) antes.
- [ ] Depois de a versão de sync estar no ar, rodar **"Limpar tudo"** uma vez para zerar a
      nuvem (que ainda guarda dados antigos), se o objetivo for recomeçar.
- [ ] Emojis residuais de baixa visibilidade (ex.: tela de fim de sessão 🏆/✅/💪, alguns
      toasts) — opcional trocar por ícones.
- [ ] (Opcional) varredura final para mover qualquer símbolo restante de arquivos lazy
      usado fora deles.
- [ ] **Testar ao vivo a importação de documento** (subir o `survivor-vocabulario-ingles.md`):
      confirmar que extrai os termos, que "snuff" sai como "apagar a tocha" e que os cards entram
      em "pendente de revisão" já com significado/exemplo. Fazer backup (Exportar JSON) antes.
- [ ] **Testar PDF** (pdf.js do CDN) — precisa de internet na primeira leitura; depois cacheia.
- [ ] **REMOVER o botão temporário "Preencher origem"** (`#lib-fill-origin-btn` no index.html +
      função `fillOriginsAll` em audio.js) depois de rodar o backfill de origem nos cards antigos.
- [ ] (Opcional) Enriquecimento em lote dos itens importados: hoje cada item vem com 1 sentido +
      3 exemplos (3 cards) do doc; o botão "Re-analisar" (já sensível à fonte) expande para TODOS
      os sentidos. Avaliar se vale um "Enriquecer todos" automático na Mídia.

---

## 10. Convenções e armadilhas ao trabalhar aqui

- **Trabalhar SEMPRE na pasta `english-lab`** (é o repo git que faz deploy automático).
- **Não precisa commitar** — o deploy é automático. Pode haver ~1 min de atraso até o
  GitHub Pages publicar.
- **O shell (bash) enxerga cópias DESATUALIZADAS/truncadas** dos arquivos (OneDrive/mount).
  NÃO confie em `node -c`/`wc` via bash para validar; use a ferramenta de leitura (Read) ou
  o Claude in Chrome para inspecionar o app ao vivo.
- **Cuidado com lazy-loading** (seção 2).
- **Toda cor via variável CSS**; acentos via `rgba(var(--primary-rgb), …)`.
- **Sem emojis na UI** — usar `ic()`.
- **Mudanças de dados/sync são de alto risco** — sugerir backup (Exportar JSON) antes de testar.
