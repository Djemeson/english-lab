# English Lab — Estado do Projeto e Guia de Continuidade

> Documento vivo. **Sempre leia este arquivo antes de iniciar qualquer tarefa** e
> **atualize-o ao finalizar cada tarefa** (instrução fixada no `CLAUDE.md`).
>
> Última atualização: 2026-06-23 — análise sensível à fonte + importação de documentos na Mídia.

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
js/firebase.js    — sincronização Firestore (TEMPO REAL)
js/audio.js       — IndexedDB (AudioDB/CardsDB/ImageDB), TTS, Biblioteca (browser de cards), reanálise
js/srs.js         — MOTOR SM-2 (estado srsCards/srsCfg/srsLog/srsSession)
js/dashboard.js   — render do Dashboard
js/review.js      — fila de Revisar + análise de IA (prompt principal)
js/settings.js    — Configurações (cfg, temas, AI_MODELS, limpar dados)
js/init.js        — bootstrap (initApp) + service worker
js/add.js         — aba Adicionar + Consulta  (CARREGADO LAZY)
js/study.js       — UI/sessão do SRS          (CARREGADO LAZY)
```

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
  source_context, status, ipa, type, meanings[], created_at, updated_at}`. `status`: `pending_ai` →
  `pending_review` → `in_srs` (ou `skipped`).
  - `source_context`: nota opcional de gênero/contexto da fonte (ex.: "reality de sobrevivência").
    Usada pela IA para desambiguar (resolve o caso "snuff" → "apagar a tocha" no Survivor).
  - `meanings[]`: `{meaning_pt, definition_pt, variety, register, level, examples[], ...}`
  - `examples[]`: `{en, pt}` (en com a palavra-alvo em `<b>`).
- **`srsCards[]`** — um card por (wordId, meaningIdx, exampleIdx). Guarda *snapshot*
  do conteúdo + estado SM-2: `{id, wordId, meaningIdx, exampleIdx, deckId, state, due,
  interval, ease, lapses, stepIdx, variety, register, word, meaning_pt, example_en,
  example_pt, leech?}`. `state`: `new|learning|review|relearning`.
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

- **Dashboard** — ação principal (estudar hoje) + cards de métrica com ícone.
- **Adicionar** — abas Manual / Kindle / Mídia / Website / **Consulta** (chat com IA que gera
  card com 3 exemplos → 3 cards).
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

### Sessão 2026-06-23 — contexto da fonte + importação de documentos
17. **Análise sensível à fonte** (`review.js` → `analyzeWordDirect`): o prompt agora recebe
    `source_type`/`source_title`/`source_context` e instrui a IA a inferir o GÊNERO da fonte e
    eleger como `context_match` (primeiro da lista) o sentido usado naquele contexto, mantendo os
    demais sentidos gerais. Corrige "snuff" (Survivor) = "apagar a tocha" em vez de "rapé".
18. **Campo opcional de contexto/gênero** na aba Mídia (`#midia-context-new`) + novo campo
    `source_context` em `createWord` (dashboard.js), propagado em todo o fluxo de Mídia.
19. **Importação de documento na Mídia** (.md/.txt/.pdf), por clique ou arrastar
    (`#midia-drop`/`#midia-file` → `handleMidiaFile`). PDF lido com **pdf.js** carregado do CDN sob
    demanda (`loadExtScript`/`readPdfTextMidia`). `extractMidiaDoc` faz UMA chamada à IA que lê o
    documento inteiro (limite ~14k chars), infere o gênero e extrai objetos de estudo ricos
    (termo, tipo, IPA, nível, registro, significado no contexto, exemplo en/pt). Preview rico
    (`renderMidiaDocItem`); ao adicionar, `createDocWord` cria a palavra em `pending_review`
    preservando o significado/exemplo do doc como `context_match`. Reaproveita a lista/seleção
    existente de Mídia (`midiaProcessed` com flag `doc:true`).

---

## 9. Pendências / a verificar

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
- [ ] (Opcional) Enriquecimento em lote dos itens importados: hoje cada item vem com 1 sentido +
      1 exemplo do doc; o botão "Re-analisar" (já sensível à fonte) expande para todos os sentidos
      + 3 exemplos. Avaliar se vale um "Enriquecer todos" automático na Mídia.

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
