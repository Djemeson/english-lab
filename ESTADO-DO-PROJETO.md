# English Lab — Estado do Projeto e Guia de Continuidade

> Documento vivo. **Sempre leia este arquivo antes de iniciar qualquer tarefa** e
> **atualize-o ao finalizar cada tarefa** (instrução fixada no `CLAUDE.md`).
>
> Última atualização: 2026-07-31 — **Sidebar reformada (7ª rodada)**: os 254px de vazio (35% da
> altura) viraram um bloco **"Hoje"** ancorado no fim do menu (progresso do dia + sequência),
> o rótulo "MENU" virou dois grupos ("Geral" e "Vocabulário"), o item ativo trocou gradiente +
> anel por tinta chapada + marca de 3px no vinco da barra, os contadores viraram pílulas tintas
> e o cartão de conta (3 linhas com moldura) virou uma linha só com o ponto de nuvem no avatar.
> Ver seção 8 (sessão 2026-07-31, 7ª rodada).
>
> Última atualização anterior: 2026-07-30 — **Sessão de infraestrutura + correções + melhorias na cópia
> `english-lab-2.0`**: repositório git configurado apontando para `Djemeson/english-lab`,
> service worker consertado para GitHub Pages, PWA instalável, variáveis CSS que não existiam,
> corrida de cards no player de playlist, viewport que bloqueava zoom, emojis residuais e
> documentação obsoleta. Ver seção 8 (sessão 2026-07-30).
>
> Última atualização anterior: 2026-07-14 — **Dashboard implementado a partir do mockup Claude
> Design** ("Dashboard.dc.html", projeto "Redesign da aba"): 7 seções novas com DADOS REAIS
> (nenhuma mockada) — atividade (heatmap 12 meses), tendência de acerto (14 dias), progresso por
> baralho/idioma, "travando na memória" (leeches), palavra em destaque do dia, fontes do
> vocabulário e conquistas (6 marcos calculados). Na mesma data, **correção do bug de
> pluralização** no hero do Dashboard ("0 revisãoões"). Ver seção 8 (sessão 2026-07-14).
>
> Última atualização anterior: 2026-07-13 (2ª rodada) — **Precisão do negrito do objeto de estudo**
> revisada em todos os 7 pontos que geram frases (review.js, audio.js × 2, study.js,
> consulta.js, add.js × 2): prompts padronizados/reforçados (flexão, expressão de várias
> palavras/separável, idiom, ocorrência repetida), mismatch entre a regra e o exemplo de
> schema JSON corrigido em review.js/audio.js, rede de segurança adicionada na Fase 1 do
> extrator de documento, e o botão "Negrito perfeito (IA)" da Biblioteca passou a validar
> com precisão (exatamente 1 span, não vazio, não a frase inteira) em vez de só checar se
> existe algum `<b>`. Ver seção 8 (sessão 2026-07-13, 2ª rodada).
>
> Última atualização anterior: 2026-07-13 — **Reskin visual "Papel"** (app renomeado para "Language
> Lab" na interface; novo 6º tema `papel` claro com paleta azul-tinta; fonte serifada
> Newsreader nos títulos/palavras/números grandes; cantos mais arredondados e sombras mais
> quentes nos 6 temas; hero card do Dashboard em gradiente; chips/tabs em pílula). Mudança
> só de CSS/tokens — nenhum id/classe usado pelo JS foi tocado. Ver seção 8 (sessão
> 2026-07-13).
>
> Última atualização anterior: 2026-07-05 — **Botão de IA passou a PRESERVAR exemplos já curados**
> ("Analisar com IA"/"Re-analisar" no Revisar não sobrescreve mais significado/frases de um
> sentido que já tinha exemplos — só completa o que falta). Botão temporário da Biblioteca
> generalizado: `fillOriginsAll` → `fillMissingAll` ("Completar dados (IA)"), preenche IPA/
> categoria/nível/origem vazios sem tocar em frases. Ver seção 8 (sessão 2026-07-05, 2ª rodada).
>
> **Suporte MULTI-IDIOMA implementado** (qualquer idioma na
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

- **Hospedagem (DOIS destinos, desde 2026-07-30):**
  - GitHub Pages → `https://djemeson.github.io/english-lab/`
  - Vercel → `https://english-lab-seven.vercel.app/` (projeto `english-lab`, time
    `djemeson's projects`, importado do GitHub em 2026-07-30)
- **Deploy:** `git push origin main` publica nos **dois** (Actions do Pages + integração Git da
  Vercel). Decisão do Djemeson: **toda alteração vai para os dois destinos**. Confirme o
  Actions (`gh run list --branch main --limit 1`) antes de dar a tarefa por concluída.
  ⚠️ Ao contrário do que este arquivo dizia antes, a pasta **não** faz deploy sozinha: é
  preciso commitar e dar push de verdade.
- **Firebase e domínios:** o login Google só funciona em domínios autorizados
  (Console → Authentication → Settings → Authorized domains). URL nova = login quebrado até
  adicionar. Precisam estar lá: `djemeson.github.io`, `localhost` e o domínio da Vercel.
- **IA:** OpenAI (chave fica em `cfg.openaiKey`). Análise e TTS rodam direto no browser.
- **n8n:** REMOVIDO em 2026-07-30. O app não depende de nenhum serviço externo próprio —
  é só navegador + OpenAI + Firebase.

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
- `VARIETY_LABELS` / `REGISTER_LABELS` + `varietyChip`/`registerChip` → **lang.js** (2026-07-30)
- `buildSrsFrente` → **core.js** (2026-07-30)
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

- **Temas:** `data-theme` no `<html>`. 6 temas em `THEMES` (core.js): `midnight` (padrão),
  `light`, `sepia`, `emerald`, `violet`, `papel` (novo, sessão 2026-07-13 — claro, acento
  azul-tinta `#2E4BC6`, estética "paper"). Trocados em Configurações → Aparência. `applyTheme()`
  grava em `cfg.theme` (persistido + sincronizado). TODA cor usa variáveis CSS (`var(--...)`);
  acentos usam `rgba(var(--primary-rgb), …)` para seguir o tema. `--radius`/`--radius-sm`
  (16px/11px) e as sombras (`--shadow*`) são compartilhados pelos 6 temas com tom mais quente
  desde o reskin "Papel".
- **Fonte:** Inter (corpo/UI) + **Newsreader** (serifada, só em `.page-header h1`, palavra do
  card de Revisar `.wc-word`, palavra da flashcard `.srs-card-front-word`/`.srs-back-word` e
  números grandes `.mc-val`/`.sdc-value`/`.dash-num`) — carregada via Google Fonts em
  `index.html`. Regras do reskin ficam numa seção nova no FIM de `css/styles.css` (depois do
  bloco "Biblioteca Cards|Palavras"), para vencer a cascata sem editar as regras antigas.
- **Ícones:** SEM emojis na interface. Use `ic('nome')` (core.js, mapa `ICONS`, SVG de linha).
  `srcIcon(tipo)` para fontes (série/filme/etc.). HTML estático usa `<svg class="ic">` inline.
- **Tooltips:** sistema global em core.js — qualquer elemento com `data-tip` ou `title`
  ganha tooltip premium (flutuante, não cortado por overflow).
- **Modais:** use `inputModal({...})` (core.js) em vez de `prompt()`. Overlay `.srs-modal-overlay`.
- **Layout:** conteúdo centralizado (`.section` com max-width; Biblioteca é full-width),
  sidebar com logo + nav em pílulas agrupada ("Geral"/"Vocabulário") + bloco "Hoje" ancorado no
  fim do menu + linha de conta no rodapé, page-headers com ícone + ação à direita.

---

## 7. Telas (seções)

- **Dashboard** — ação principal (estudar hoje, com chip de sequência quando streak > 0) + 4
  cards de métrica + grade de 2 colunas com: atividade (heatmap 12 meses), tendência de acerto
  (14 dias), progresso por baralho/idioma, "travando na memória" (leeches); coluna direita:
  palavra em destaque do dia + fontes do vocabulário. Abaixo: card de conquistas (6 marcos) +
  recentes. Tudo com dados reais, sem estado novo persistido (deriva de `srsLog`/`srsCards`/
  `words` já existentes). Ver `js/dashboard.js` (funções `dash*`) e seção 8 (sessão 2026-07-14).
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
- **Adicionar** — abas Manual / Kindle / Mídia. (A aba **Consulta** virou a seção **Assistente**;
  a aba **Website** saiu junto com o n8n em 2026-07-30.)
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

### Sessão 2026-07-31 (7ª rodada) — Sidebar: o vazio vira informação
58. **Pedido**: "essa barra lateral realmente está boa? ela deve ser aqui mesmo? podemos
    melhorar? deixar mais sofisticado?" — a partir de um print. Cada mudança saiu de uma
    medição, não de gosto:
    - **254px de vazio (35% da altura a 1280×720)** entre "Biblioteca" e "Configurações". Espaço
      morto no FIM de uma lista lê como menu inacabado; entre dois blocos ancorados, lê como
      respiro. Novo bloco **"Hoje"** (`#sb-today`) com `margin-top:auto` ancora o fim do menu:
      barra de progresso do dia, "N feitas / N restantes", chama + sequência quando streak > 0,
      estado **"Dia concluído"** (barra verde + check) e clique levando a Estudar.
      Renderizado por **`renderSbToday()` em `js/srs.js`** (não-lazy), chamado dentro do
      `updateSrsBadge()` — herda os 8 call sites que já existiam, então acompanha a sessão de
      estudo em tempo real (usa `srsSession.done`, porque o `srsLog` só é gravado no fim).
      Sem dado nenhum (total 0) o bloco some em vez de mostrar zeros.
    - **"MENU" virou dois grupos**: "Geral" (Dashboard, Assistente) e "Vocabulário" (Adicionar,
      Revisar, Estudar, Biblioteca). Um rótulo que só diz "menu" não informa nada; a ordem dos
      itens **não mudou** (nada de muscle memory quebrada).
    - **Item ativo**: gradiente de 135° + anel interno (o mesmo desenho de template dos
      gradientes já removidos no item 54) → **tinta chapada + marca de 3px encostada na borda
      da barra** (`::before` em `left:-12px`, `-8px` no rail). Escopado em `.sidebar` para não
      vazar para a barra inferior do celular, que usa as mesmas classes `.nav-item`.
    - ⚠️ **Contraste medido derrubou a primeira escolha**: acento como cor do rótulo ativo dava
      **3,28:1 no sepia** e 4,33:1 no violet — reprova AA. O rótulo passou para `--text`
      (8,52–15,32:1) e a cor ficou com o **ícone e a marca**, que são gráfico (alvo 3:1;
      medidos 3,28–7,84). Mesmo problema no contador (acento puro reprovava com 3,12:1 no
      sepia): o texto virou `color-mix(--primary 62%, --text)` → **4,53–8,58:1**. E no número
      da sequência (`--warning` sobre superfície clara = 3,19:1): número em `--text2`
      (5,82–7,58:1), chama em `--warning` como gráfico.
    - **Contadores**: pílula tinta com números tabulares no lugar do sólido com brilho — o
      "183" verde chapado gritava mais alto que o próprio item de menu.
    - **Conta**: o cartão com moldura, sombra e 3 linhas (indicador "Nuvem" + avatar/nome +
      botão "sair" sempre visível) virou **uma linha de 40px sem moldura** — o ponto de
      sincronização mudou para o canto do avatar (mesmo sinal, sem linha própria) e "sair"
      aparece no hover/foco. O avatar ganhou círculo de fundo, então conta sem foto não quebra.
    - **Rail recolhido**: o bloco "Hoje" some inteiro (reduzido a uma barra sem rótulo, virava
      enfeite ambíguo); o badge de Estudar continua dando o sinal do dia.
    - **A barra continua à esquerda**, e essa é a resposta certa: 7 destinos, dois deles com
      contador permanente, e paridade com a barra inferior do celular. Topo custaria os
      contadores e o bloco ambiente.
    - **Validado ao vivo** (servidor local, 6 temas com transições desligadas — a medição de
      cor durante transição é inválida): contraste AA em todos os itens acima, 7 seções sem
      erro de console, estados vazio/normal/concluído, deslogado, rail recolhido (74px, sem
      overflow) e mobile 375px (sidebar oculta, barra inferior intacta, sem scroll horizontal).
      `CACHE`: `englab-v29` → **`englab-v30`**.

### Sessão 2026-07-31 (6ª rodada) — Assistente auditado pelo print + fim dos confirm() nativos
57. **Pedido**: migrar os `confirm()` restantes e auditar o print do Assistente (melhorias,
    correções, layout, design).
    - **IPA com barras duplas (`//ˈbɛtər...//`) — causa raiz no PRÓPRIO prompt**: o
      `consultaSystem()` pedia a pronúncia "entre barras: //" e o modelo obedecia ao pé da
      letra. Agora pede barras SIMPLES com exemplo (`/ˈwɔːtər/`), e `formatConsultaReply`
      normaliza as mensagens **antigas** no render (`//…//` → `/…/`, regex de span curto que
      não encosta em URLs — verificado com `https://example.com/path` intacta).
    - **Exemplos repetidos** (a mesma frase 3× no print): o prompt agora exige exemplos
      genuinamente diferentes (tempos verbais, sujeitos e situações distintas), na linha do que
      o `review.js` já fazia.
    - **Layout do chat**: a bolha da IA esticava a 90+ caracteres por linha — medida travada em
      `min(70ch, 92%)`, line-height 1.65. **Placeholder acompanha o idioma ativo** (dizia
      "em inglês" fixo mesmo com o seletor em espanhol). **Botão copiar** em cada resposta da
      IA (hover, feedback de check, `navigator.clipboard`).
    - **ZERO `confirm()` nativos no app** (eram 15):
      - Os 4 dos lotes de IA eram **confirmação dupla** com o modal de custo — fundidos:
        `aiConfirmBatch` ganhou `opts.detalhe` (os tópicos entram no próprio modal de custo)
        e `opts.sempre` (operações que REESCREVEM conteúdo confirmam mesmo custando centavos:
        reanalisar, negrito, reprocessar variedade).
      - Os 11 restantes viraram `confirmModal`: excluir cards/card/baralho/conversa/itens/
        palavra (danger), sair da conta (copy melhorada: "nada é apagado"), importar backup,
        resetar Kindle, e **"apagar todos os dados" — que era um confirm DUPLO** e virou um
        único modal danger com a lista do que será apagado (inclui o aviso de nuvem quando
        logado) e o lembrete de backup.
      - Funções que eram síncronas viraram async (`deleteSrsCard`, `deleteDeckUI`,
        `deleteConversa`, `deleteSelected`, `deleteWord`, `clearKindleSeen`, callback do
        `importData`).
    - **Validado ao vivo** (Vercel, v29): IPA antigo normalizado e URL preservada, prompt novo
      com as duas regras, bolha em 70ch com copiar no hover, modal "Sair da conta" e "Apagar
      todos os dados" (danger, 4 itens, botão "Apagar tudo"), lote com custo+detalhe no mesmo
      modal, 0 erros de console.



### Sessão 2026-07-31 (5ª rodada) — Custos em reais + modal de confirmação de verdade
56. **Pedido**: os custos estavam em dólar (a OpenAI cobra em dólar) e a janela era o
    `confirm()` nativo — "aquela de quando a pessoa aprende a programar".
    - **Conversão para reais**: `aiUsdBrl()` busca a cotação comercial USD→BRL do dia na
      **AwesomeAPI** (gratuita, sem chave, timeout 3,5s), cacheia 24h no localStorage
      (`el-usd-brl`); se a consulta falhar usa a última cotação conhecida mesmo vencida e, em
      último caso, câmbio fixo 5,50. `aiEstimate`/`aiConfirmBatch` viraram **async** — os 6
      call sites receberam `await`.
    - **`confirmModal()` genérico em core.js** (Promise<boolean>): overlay com blur no padrão
      do `inputModal`, cartão do tema, `role="alertdialog"`, Enter confirma, Esc/clique-fora
      cancelam, foco inicial no botão de ação. Disponível para substituir os demais
      `confirm()` nativos do app no futuro (sair da conta, limpar dados, excluir deck…).
    - **O diálogo de lote virou informativo de verdade**: linhas Operação / Chamadas à OpenAI /
      Modelo (com a qualidade da imagem por extenso) / **Custo estimado em destaque**
      (Newsreader, cor do acento), nota com a cotação usada, e o botão de confirmar carrega o
      valor: **"Continuar — R$ 6,41"**. Limiar de não-interromper mantido (~R$ 0,12).
    - **Validado ao vivo na Vercel**: cotação real da API (R$ 5,08 em 189ms), cache 24h
      funcionando (2ª chamada 0ms), modal com todas as linhas, Cancelar→false, Continuar→true,
      Esc→false, lote barato passa sem modal, 0 erros de console. `CACHE`: **`englab-v28`**.



### Sessão 2026-07-31 (4ª rodada) — Kindle e Mídia a partir de prints de produção
55. **Pedido**: analisar dois prints reais (Kindle com 41 destaques em tradução; aba Mídia
    "cheia de campos") e corrigir/empoderar. Cada mudança nasceu de um defeito visível no print:
    - **BUG de entidades HTML no Kindle**: `&quot;Your fault, Gaius` aparecia CRU na tela — o
      export do Kindle é HTML e o parser (`parseKindleHTML`) nunca decodificava entidades, que
      vazavam para a interface **e para os prompts de IA**. Novo `decodeEntities()` (textarea
      trick) no título/capítulo/texto + **migração leve em `loadKindleQueue`** para consertar
      itens já persistidos na fila. Títulos-nome-de-arquivo ("Emperor_ The Gates of Rome_ A N")
      normalizados por `cleanSourceTitle()` (underscores → espaço).
    - **Kindle — progresso real**: "Traduzindo 41 destaques..." (estático) virou
      "Traduzindo 20/41..." por lote, com rótulo final "tradução concluída".
    - **Kindle — contador vivo**: "Adicionar selecionados (N)" atualiza a cada checkbox
      (delegação de `change`).
    - **Kindle — empoderamento**: botão **"Sugerir alvos (IA)"** — para cada destaque
      selecionado ainda sem palavra-alvo, a IA aponta o melhor item de estudo da frase
      (pool de 4, custo confirmado via `aiConfirmBatch`, reusa `detectKindleWord`). Antes a
      única via era clicar palavra por palavra em 41 frases.
    - **Mídia — estrutura**: a pilha de campos soltos virou **dois passos com moldura**
      ("1 · Fonte": chips + título/contexto lado a lado com placeholders completos — antes
      truncavam sem fechar parêntese; "2 · Material": dropzone compacta AO LADO do textarea).
    - **Mídia — botão único inteligente**: "Extrair material colado" × "Analisar linha a
      linha" exigiam saber a diferença. Agora `midiaDetectMode()` classifica pelo formato
      (mediana de palavras por linha ≤ 8 = lista), o hint anuncia o modo **antes** de rodar e o
      rótulo do botão muda junto ("Analisar 3 linhas" / "Extrair material completo"). As duas
      funções originais continuam por trás — zero mudança de lógica de análise.
    - **Validado ao vivo** (Vercel, v27): parser decodificando (`"Your fault, Gaius," he said
      & laughed.`), fila migrada, 2 grupos na Mídia, detecção lista/artigo/vazio trocando hint
      e rótulo, botões novos no lugar, 0 erros de console.



### Sessão 2026-07-31 (3ª rodada) — Reforma visual "profissional + personalizável" + 4 propostas de IA
54. **Pedido**: "visualmente parece brincadeira de criança — deixe profissional, comercial e
    personalizável" + aplicar as 4 propostas de IA do item 53. O que fazia parecer amador tinha
    nome e contagem:
    - **Acentos néon crus do Tailwind** nos 3 temas escuros (`#34D399`, `#FBBF24`, `#F87171`,
      `#A78BFA` — a assinatura de template) → versões refinadas de **mesma luminância**
      (`#4CC39A`, `#E7BA53`, `#ED7A74`, `#A896E4`; violet `#C4B5FD`→`#BCAAE9`), preservando o
      contraste AA medido nas sessões anteriores (spot-check: warning novo 10.87:1 no fundo).
      Temas claros não mudaram (já usavam tons próprios).
    - **3 gradientes EM TEXTO** (wordmark da sidebar, do header mobile e do login) — o marcador
      nº 1 de template — viraram cor sólida (`Language` em `--text`, `Lab` em `--primary`).
    - **3 glows** (`drop-shadow` atrás de ícones) removidos; glow radial do hero `.45`→`.22`.
    - **`font-weight` 800 → 700** nos 9 pontos (Newsreader em 800 lê como panfleto).
    - **PERSONALIZÁVEL — seletor de cor de destaque** (Configurações → Aparência): 8 acentos
      (padrão do tema, Índigo, Petróleo, Esmeralda, Terracota, Framboesa, Ametista, Dourado)
      aplicáveis por cima de QUALQUER tema. `applyAccent()` em `core.js` sobrepõe só
      `--primary`/`--primary-rgb`/`--primary-d`/`--accent-bright`/`--primary-grad`/
      `--primary-glow` via style do `<html>` — success/warning/error são semânticos e ficam
      com o tema. `cfg.accent` persiste, **sincroniza via Firebase** (push + 2 pontos de pull;
      string vazia é valor legítimo = "padrão") e restaura do backup IDB. Verificado: acento
      sobrevive à troca de tema e o "padrão do tema" limpa as propriedades inline.
    - **As 4 propostas de IA aplicadas**:
      1. **Custo antes de lotes** — `aiConfirmBatch(tipo, n, rótulo)` em Reanalisar tudo,
         Completar dados, Negrito perfeito, Gerar imagens em lote e Gerar áudio ausente.
         Lotes abaixo de ~US$ 0,02 não interrompem (confirmar centavos é atrito).
         `aiEstimate` documenta ordens de grandeza (chat US$0,001/item; TTS US$0,008/frase;
         imagem low/medium/high US$0,011/0,042/0,167).
      2. **TTS `gpt-4o-mini-tts`** com instrução de estilo ("ritmo de aprendiz") e **fallback
         automático para `tts-1`** na mesma chamada (validado com stub: 400 no novo → tts-1 →
         áudio ok). Cache por texto no AudioDB limita o custo do fallback a 1 tentativa extra
         por frase nova.
      3. **Timeout de conexão no streaming** do Assistente: 45s **só até o primeiro byte** —
         aberto o stream, o timer desliga (retry automático em SSE duplicaria a resposta,
         continua sendo o que NÃO fazemos). O streaming também passou a usar `aiModel()`.
      4. **Qualidade de imagem configurável** (aba IA: Econômica/Padrão/Alta) em
         `cfg.imgQuality`, sincronizada, consumida por `aiImage()`.
    - **Validado ao vivo (Vercel, cache v26)**: cores novas aplicadas, 0 gradientes-em-texto
      no DOM, 8 bolinhas de acento funcionando (Terracota → `--primary` muda, grad recalculado,
      sobrevive à troca de tema, padrão limpa), select de qualidade com os 3 níveis, estimador
      coerente (30 imagens: US$1,26 medium / US$0,33 low), fallback de TTS comprovado, 7 telas
      sem erro de console.



### Sessão 2026-07-31 (2ª rodada) — Reestruturação da camada de IA (gateway único)
53. **Pedido**: auditar tudo que a IA faz (análise, TTS, imagens, cards, lotes) e aplicar
    melhorias/correções/reestruturação. Inventário: **16 pontos de chamada em 6 arquivos**,
    com **5 implementações duplicadas** do mesmo fetch JSON e três defeitos sistêmicos:
    nenhuma chamada tinha **timeout** (rede pendurada = spinner infinito), nenhuma tinha
    **retry** (um 429 no meio de um lote — Kindle 25 itens, enriquecimento, pool de áudio —
    perdia itens em silêncio) e os erros subiam como "HTTP 401" **sem a mensagem real** da
    OpenAI.
    - **Novo `js/ai.js`** (NÃO-lazy, carregado após `lang.js`; incluído no SHELL do sw.js):
      `aiJSON` / `aiText` / `aiTTS` / `aiImage` / `aiTestKey` / `aiModel()`. Timeout por
      AbortController (90s chat, 60s TTS, 180s imagem), retry 2× em 429/5xx/queda de rede com
      backoff e respeito a `Retry-After`, 4xx real nunca retenta, mensagem de erro da API
      exposta ao usuário, e `max_completion_tokens` automático para gpt-5/o* (rejeitam
      `max_tokens`). **Streaming do Assistente fica FORA por desenho** — retry automático em
      SSE duplicaria a resposta na tela.
    - **Correções achadas na auditoria**:
      - Lote do Kindle e análise linha-a-linha usavam **`gpt-4o` hardcoded** (≈30× o preço do
        mini) e `_openaiJSON` caía em gpt-4o com cfg vazia — o resto do app usa gpt-4o-mini.
        Unificado via `aiModel()`.
      - `AI_MODELS` listava **Anthropic/Google, mas TODAS as chamadas vão para api.openai.com**
        — selecionar outro provider mandaria `claude-*` para a API errada e quebraria toda a
        IA. Catálogo agora é só OpenAI (4o-mini padrão, 4.1-mini, 4o, 5-mini, 5) e `aiModel()`
        ignora um `cfg.aiModel` não-OpenAI vindo da nuvem.
      - **"Gerar imagens" em lote re-gerava (e re-PAGAVA) imagens existentes** — a deduplicação
        era só dentro da seleção. `generateCardImage(id, el, force)`: lote passa `force=false`
        e pula quem já tem (reportando quantas economizou); botão individual mantém regeneração.
      - Prompt de imagem pedia *"verify before finalizing, reject and redo"* — modelo de imagem
        não itera; instrução impossível. E o `example_en` ia com `<b></b>` cru para o prompt.
      - `fetchAudioBase64`: **zero chamadores**, removida.
    - **UI nova (aba IA)**: o **seletor de modelo voltou** (a reforma do AI Studio tinha
      removido o `<select>` e deixado o modelo inescolhível) e botão **"Testar chave"** via
      `GET /v1/models` (não consome token), com resultado inline.
    - **Validado ao vivo na Vercel com fetch stubado**: retry 429→500→200 em 3 tentativas;
      401 não retenta e expõe "Incorrect API key provided"; sem chave → mensagem amigável;
      `claude-*` na cfg → cai no default; análise ponta-a-ponta via gateway populando
      meanings/ipa; lote de imagem pulando existente (`skip`, 0 chamadas) e force regenerando;
      seletor com os 5 modelos; 7 telas sem erro de console. `CACHE`: **`englab-v25`**.
    - **Propostas ANOTADAS, não aplicadas** (decidir com o Djemeson): estimativa de custo antes
      de lotes grandes; TTS `gpt-4o-mini-tts` (mais barato e com instruções de estilo) no lugar
      do `tts-1`; timeout+retry de conexão para o streaming do Assistente; `quality`/`size`
      configuráveis na geração de imagem.



### Sessão 2026-07-31 — Abas: informação solta vira informação organizada
52. **Pedido**: "aplique abas sofisticadas e inteligentes onde for necessário — na dashboard tem
    muita informação solta". A decisão de ONDE foi medida, não achada:

    | Tela | Rolagem | Blocos | Recebeu aba? |
    |---|---|---|---|
    | Dashboard | **2,2×** | **13** | sim |
    | Configurações | 1,2× | 5 | sim |
    | Biblioteca / Estudar / Revisar / Assistente / Adicionar | ≤ 0,8× | 0–1 | **não** |

    Só duas telas justificavam. As outras **não ganharam aba** — pôr aba onde não há acúmulo
    troca rolagem por clique, o que é pior.
    - **Dashboard → 3 painéis**, agrupados pela PERGUNTA que cada bloco responde, não por tipo
      de gráfico: **Progresso** (como estou indo no tempo — heatmap, volume semanal, acerto),
      **Vocabulário** (o que eu tenho e de onde veio — idiomas, fontes, leeches, palavra em
      destaque, adicionadas recentemente) e **Conquistas** (os 6 marcos).
      **Hero e as 4 métricas ficam SEMPRE visíveis acima das abas** — esconder a ação principal
      atrás de uma aba seria trocar bagunça por fricção.
      Resultado: 1980px → **1191/1085/692px** por aba.
    - **Configurações → 4 painéis**, agrupados por INTENÇÃO (quem entra ali quer resolver UMA
      coisa): **Conta**, **IA e áudio** (a chave e a manutenção de TTS vivem juntas porque a
      chave é o que alimenta o áudio), **Aparência**, **Dados**. 1085px → **324px**.
      O botão de salvar saiu do rodapé da página e foi para a aba de IA, a única com campo
      editável — solto no fim, ele sugeria que salvava tudo.
    - **O que faz as abas serem "inteligentes" e não só abas**: só o painel ativo é renderizado
      (os gráficos são SVG montado em string — não vale construir três telas para esconder
      duas); a aba escolhida **persiste** em `el-ui-prefs`, então voltar devolve onde você
      estava; e **as abas avisam o que têm dentro** — Conquistas mostra `2/6` e Vocabulário
      ganha um sinal âmbar com a contagem de cards travando na memória.
    - **Acessibilidade**: `role="tablist"/"tab"/"tabpanel"`, `aria-selected`, `aria-controls`,
      roving `tabindex` e setas ←/→ · Home/End percorrendo as abas, com o foco acompanhando.
    - **Componente compartilhado**: em vez de duplicar, as abas viraram `.seg-tabs`/`.seg-tab`
      e as duas telas usam o mesmo visual, a mesma semântica e o mesmo comportamento.
    - ⚠️ **Dois bugs meus, achados por medição e corrigidos**:
      1. A cirurgia nas Configurações deixou **um `</div>` sobrando** (192 aberturas × 193
         fechamentos). O navegador corrige sozinho, então a tela "funcionava" — mas a árvore
         ficava aninhada errado. Achado por contagem de profundidade, não a olho.
      2. Anexei o estado das abas no **fim** do `settings.js`, mas `fillSettings()` usa
         `_settingsTab` e roda assim que a seção abre → `Cannot access '_settingsTab' before
         initialization` (zona morta temporal do `let`), e a tela de Configurações parava de
         abrir. As declarações foram para o topo dos dois arquivos.
         > Lição registrada: **função que roda no boot não pode depender de `let`/`const`
         > declarado depois no mesmo arquivo** — o hoisting salva a função, não a variável.
    - **Validado**: 42 combinações tema × tela sem problema, teclado e persistência conferidos,
      todos os controles críticos (chave, 6 temas, os 4 botões de dados, login) alcançáveis.
      `CACHE`: `v21` → **`v24`**.



### Sessão 2026-07-30 (4ª rodada) — Auditoria de design do projeto inteiro
46. **Motivo**: o Djemeson reportou um incômodo difuso ("não sei se as cores, ou a bagunça
    visual, o blob, a falta de sofisticação em embutir certas coisas") e pediu uma auditoria por
    ÁREAS, no projeto todo — não só na tela que mostrou. A abordagem foi **medir, não opinar**.
    - **Causa raiz: dispersão de valores.** O que faz uma interface parecer bagunçada quase nunca
      é uma escolha ruim isolada — são muitos valores diferentes fazendo o mesmo trabalho.
      Medido no CSS: **77 tamanhos de fonte distintos** (treze deles espremidos entre 0.7 e
      0.95rem — diferenças invisíveis uma a uma que somadas destroem o ritmo), **36 raios**,
      **47 sombras**, **46 hex + 61 rgba fixos** fora dos blocos de tema, **137 `!important`**,
      **129 `style=` inline no index.html** (374 declarações) e **209 nos templates JS**.
    - **Escala tipográfica** (`--fs-3xs` … `--fs-3xl`, 10 degraus): 255 substituições no CSS +
      101 nos estilos inline. Renderizado no app: 77 → **escala + 8px/9px**, que são atributos
      de SVG do gráfico semanal, não CSS.
    - **Raios** (`--radius-xs/-sm/base/-lg/-pill`): 73 substituições. Sobram só 2–4px em
      detalhes micro, 50% em círculos e os tokens.
    - **Cor**: 44 `rgba()` fixos viraram `color-mix()` sobre `--success`/`--error`/`--purple`/
      `--primary`, então acompanham os 6 temas. Os 22 restantes são `rgba(0,0,0)`/
      `rgba(255,255,255)` em sombras e overlays, onde preto/branco literal é correto.
    - **`--text3` reprovava contraste nos 6 temas** (2.36:1 no midnight, 2.37 no light, 3.11 no
      papel). É o cinza de TODOS os rótulos pequenos do app — sozinho, deixava de 25 a 45
      elementos ilegíveis por tema. Cada tema recebeu um valor calculado caminhando do valor
      antigo na direção do `--text2` do próprio tema até cruzar 4.6:1 contra `--surface` E
      `--bg`. Continua sendo o tom mais leve da hierarquia. **Agora passa AA nos 6.**
    - **Dashboard (o "blob")**: o hero era um retângulo azul chapado de 1120px com **663px de
      vazio** entre o número e o botão, num sistema onde todo o resto é cartão claro com borda.
      Virou cartão da mesma família, com acento no número e numa faixa lateral; o "183" ganhou
      rótulo (antes era um número sem legenda) e a quebra revisões/novos/sequência passou a
      ocupar a folga. **Vão: 663px → 28px.**
    - **Cor sem significado**: os 4 ícones de métrica usavam azul/roxo/verde/âmbar em hex fixo
      sem codificar nada ("96%" era verde tanto a 96% quanto a 12%). Cor que não carrega
      informação é ruído — ficaram neutros.
    - **Dois defeitos de precisão no heatmap**: os rótulos Seg/Qua/Sex ficavam **12px abaixo**
      das linhas correspondentes (medido: 503,517,531 contra 491,505,519 → agora 0px), e o
      primeiro rótulo de mês era cortado ao meio por um `translateX(-50%)` — era o "ul" no lugar
      de "Jul" na tela do Djemeson.
    - ⚠️ **Regressão que eu mesmo causei e corrigi na sequência**: o script da escala tratou
      `html{font-size:16px}` como mais um tamanho de texto e o trocou por `var(--fs-base)`
      (0.95rem). Como `rem` é relativo à raiz, isso virou uma raiz de 15.2px e **encolheu a
      interface inteira em 5%**. Pego ao medir os tamanhos renderizados (apareciam 10.64,
      10.944, 11.248… em vez dos tokens). Restaurado para 16px, com comentário no CSS.
    - **Validado**: 7 telas × 6 temas, 0 erros de console, 0 telas quebradas, raiz em 16px.
    - **Aberto para a próxima rodada** (medido, não corrigido): 47 sombras distintas,
      137 `!important`, 338 `style=` inline restantes (a maioria layout, não tipografia),
      o heatmap com **97% das células vazias** ocupando 344px, e o estado vazio geral do
      Dashboard quando há pouco histórico.
    - `CACHE` do `sw.js`: `englab-v11` → **`v16`** (5 deploys nesta rodada).

### Sessão 2026-07-30 (5ª rodada) — Fecha o que a auditoria tinha deixado aberto
47. **Sombras** — correção do que eu havia afirmado: das 47 "distintas", **32 são brilhos
    coloridos semânticos** (verde no sucesso, azul no primário), variedade legítima, não
    desleixo. Soltas mesmo eram **9 neutras**, agora todas em `--shadow-sm`/`--shadow-card`/
    `--shadow`, mais um token novo **`--shadow-up`** para a barra inferior do mobile (sombra
    ascendente não existia na paleta). Restam **0** sombras neutras literais.
48. **Heatmap** — 97% das células ficam vazias e o `--surface3` dava peso visual próprio ao
    "nada", transformando o cartão num retângulo cinza. O vazio virou textura (13% do
    `--text3`) e os níveis de atividade ficaram mais separados, então os dias estudados saltam.
49. **`!important`: 137 → 19.** Os 118 do bloco `@media (max-width: 768px)` (herança do AI
    Studio) foram removidos com **verificação empírica**: capturei os estilos computados de 17
    seletores-chave a 375px antes e depois. **16 computaram idênticos.**
50. **O 17º revelou um bug real**: o `!important` não protegia nada — estava **atropelando a
    indentação da árvore de baralhos** no celular (todos os subdecks apareciam alinhados com a
    raiz). A indentação passou de `padding-left` inline para a variável `--indent`, que o CSS
    **soma** ao padding, e a regra ganhou especificidade `(0,2,1)` para vencer
    `.srs-deck-table td` do bloco responsivo. Verificado no mobile: raiz 14px, filhos 32px.
    > Lição registrada: `!important` num bloco responsivo costuma esconder um conflito de
    > propriedade, não resolver um. Vale checar o que ele está calando antes de mantê-lo.
51. **Estado final medido** (1440px, 42 combinações tema × tela): **0 problemas**, 0 erros de
    console, 13 tamanhos de fonte (10 da escala + 8px/9px de atributos SVG + 16px da raiz),
    9 raios (5 tokens + 2–4px micro + 50% + pill), 10 formas de sombra.
    `CACHE`: `v17` → **`v20`**.
    - **Ainda aberto**: ~338 `style=` inline de LAYOUT (display/gap/align — os de tipografia e
      raio já saíram), e o estado vazio do Dashboard quando há pouco histórico.



### Sessão 2026-07-30 (3ª rodada) — Fim do n8n, tela de login, filtro de idioma
45. **Pedidos do Djemeson**: remover o n8n ("não vai mais ser preciso mandar link"), filtro de
    idioma na Biblioteca, uma tela de login "linda e sofisticada", e entender por que a chave da
    OpenAI configurada no notebook não aparecia no telefone.
    - **n8n removido por completo**: o n8n existia para UMA coisa — extrair vocabulário de uma
      URL, a única operação que o navegador não faz sozinho (CORS). Saíram: a aba **Website** e
      seu painel (`index.html`), o cartão de configuração, `extractSite`/`renderSiteList`/
      `addSiteSelected` (`add.js`), `testN8nAI` (`settings.js`), o campo `n8nBase` da `cfg`
      (`core.js`) e do sync (`firebase.js`), a variável `siteItems` e a pasta `n8n/`.
      **O app agora é 100% navegador + OpenAI + Firebase**, sem nenhum serviço externo próprio
      para manter. ⚠️ `cfg.n8nBase` pode sobrar no localStorage de quem já usava — é dado morto,
      ninguém lê, não vale migração.
    - **Chave da OpenAI que "não aparecia no telefone" — NÃO era bug.** Li o caminho inteiro
      (`fbPushData` grava a chave com `merge:true` e omite quando vazia; `applyCloudDocs`
      adota campos não-vazios e chama `fillSettings()` se a tela estiver aberta) e testei os 3
      cenários ao vivo, inclusive "a nuvem chega enquanto o usuário está em outra tela": todos
      passaram. A causa é operacional — **é preciso estar logado nos dois aparelhos**, e até
      2026-07-30 o login no domínio da Vercel estava bloqueado no Firebase. Nada na interface
      deixava isso óbvio, o que motivou a tela de login abaixo.
    - **Tela de login — 1ª versão REJEITADA e refeita**: a primeira tentativa era um cartão de
      marketing genérico (marca, título, 3 bullets de benefício, botão). O Djemeson devolveu:
      *"queria uma tela com design lindo e vc só me deu uma tela de informações"* — e estava
      certo, trocando o texto aquilo serviria para qualquer SaaS, não tinha nada de idiomas.
      **Conceito da versão final: a tela É o produto acontecendo.** Um flashcard vivo cicla por
      quatro palavras que só existem em outra língua (`Fernweh`, `dépaysement`, `estrenar`,
      `serendipity`) — aparece a palavra com o IPA, há uma **pausa de recall de ~2,5s**, e o
      significado se revela em verde. É exatamente o gesto que o app ensina, e mostra os 4
      idiomas suportados sem precisar dizer. Ao fundo, o vocabulário como textura: palavras em
      Newsreader itálico derivando a 5% de opacidade. Os 3 bullets sumiram; o texto ficou curto
      e específico. Animação 100% CSS (ciclo de 22s, 4 cards com delay escalonado), sem timer JS.
    - **Tela de login (comportamento)**: aparece na primeira visita de quem não está logado. Entrar é
      **opcional** — o app funciona inteiro sem conta, só não sincroniza — então há sempre
      "Usar só neste aparelho", que grava `el-login-skipped` e não volta a perguntar; sair da
      conta limpa essa flag. Identidade do projeto: título em **Newsreader**, marca do livro
      sobre `--primary-grad`, brilho de fundo no mesmo vocabulário do `--bg-grad`, **tudo em
      variáveis de tema** (funciona nos 6). `role="dialog"`, foco inicial no botão principal,
      trava o scroll do fundo, responsiva (338×614 em 375px, sem rolar) e respeita
      `prefers-reduced-motion` (mostra o 1º card estático já com o significado à vista).
      **Contraste medido nos 6 temas, sobre o fundo do palco**: na 1ª medição o significado —
      a linha mais importante da tela — ficava em **3.77:1** no tema light, o IPA reprovava em
      **todos** (2.36–3.41) e o rótulo do idioma raspava em 4.36 no violet. Corrigido com a
      mesma técnica dos chips (puxar o acento em direção ao `--text` do tema, preservando o
      matiz): **0 reprovações, pior caso 5.70:1**. A única cor fixa é a do botão do Google,
      por exigência da identidade deles.
    - **Filtro de idioma na Biblioteca**: chips com contagem (`Todos 11 · Inglês 6 · Espanhol 3`)
      no **glossário (modo Palavras)**, renderizados só quando há **2+ idiomas** em estudo.
      **Não foi para o modo Cards de propósito**: lá os baralhos (`dk-root-<código>`, criados por
      `ensureLangDecks`) já separam os idiomas na própria árvore — seria redundante. Os totais do
      topo respeitam o filtro; a busca, que é passageira, não mexe neles. Deriva de `srsCards`,
      sem estado novo persistido. Novos: `_libLang`, `libLangCounts()`, `libLangChipsHtml()`,
      `setLibLang()` em `audio.js` e o bloco `.gloss-lang-*` no CSS.
    - **Auto-update do service worker**: o `sw.js` já fazia `skipWaiting()`+`clients.claim()`,
      mas o HTML/JS **já carregado** continuava sendo o antigo até um hard-refresh. Isso me
      enganou **quatro vezes** nesta sessão (cheguei a diagnosticar como bug de código o que era
      `fillSettings` velho em cache) e enganaria o Djemeson a cada deploy, ainda mais no celular.
      Agora `init.js` escuta `controllerchange` e recarrega **uma vez** (guard contra laço).
    - `CACHE` do `sw.js`: `englab-v7` → `v8` → **`v9`**.
    - **Validado ao vivo na Vercel** (cache limpo): tela de login nos 6 temas e em 375px sem
      estouro, "Usar só neste aparelho" fechando e não voltando, filtro de idioma narrando
      11→3→2→11 com os totais certos, chips somindo com 1 idioma só e no modo Cards, as 3 abas
      restantes do Adicionar abrindo, as 7 telas navegando, 0 erros de console.

### Sessão 2026-07-30 (2ª rodada) — Chips de variedade/registro: emoji, contraste e lazy
44. **Pedido**: aplicar o item que ficou de fora da 1ª rodada (os chips de variedade/registro,
    únicos emojis restantes na interface). Ao abrir o código, o que era "trocar 13 emojis" virou
    um bolo de quatro problemas — os três últimos descobertos durante a análise:
    - **(a) Emoji na interface**: bandeiras 🇺🇸🇬🇧🇦🇺🇨🇦🌍 nas variedades e 💬👥🎩🗣📜📖⚙️⚠️ nos
      registros. Em todos os casos **o rótulo de texto ao lado já dizia a mesma coisa**
      ("🇺🇸 AmE", "💬 slang") — o emoji era redundante, não informativo.
    - **(b) Armadilha nº 1 (lazy)**: `VARIETY_LABELS`/`REGISTER_LABELS` eram declarados em
      `js/study.js` (**lazy**) e consumidos por `js/audio.js` (**não-lazy**, glossário da
      Biblioteca). Idem `buildSrsFrente`. Comprovado no console: fora do caminho que carrega o
      study.js, ambos lançam `ReferenceError`. Hoje é **latente** — `_LAZY.biblioteca` aponta
      para `study.js`, então na prática não quebra — mas basta mexer nesse mapa para virar crash.
    - **(c) Cor fixa em hex**, violando "toda cor via variável CSS": 14 regras com `#1d4ed8`,
      `#be185d`, `#0f766e`… iguais nos 6 temas.
    - **(d) Contraste reprovado**, consequência de (c). Medido com um verificador WCAG rodando
      nos 6 temas: **3 a 7 dos 9 chips abaixo de 4.5:1 em cada tema**, pior caso **1.90:1**
      ("arcaico" no midnight) — praticamente ilegível.
    - **Correções aplicadas**:
      - `VARIETY_LABELS`/`REGISTER_LABELS` + os novos `varietyChip()`/`registerChip()`/
        `varietyShort()` foram para **`js/lang.js` (não-lazy)** — que já era a casa de
        `varietyLabel`/`typeLabel`/`langChip`. `study.js` e `audio.js` agora chamam os mesmos
        helpers, o que também **eliminou a duplicação** do bloco de 2 linhas que existia nos dois.
      - `buildSrsFrente` foi para **`js/core.js`** (ao lado do `escB`, que ela usa). Na mudança
        passou a reaproveitar o `escR()` que já existia no core — a versão antiga reimplementava
        o escape de regex inline **três vezes**. **E ganhou escape**: o ramo que insere o `<b>`
        por regex devolvia a frase **crua** para o `innerHTML`; agora sai por `escB()`. Verificado:
        `a <script>x</script> & "b" run by` → `a &lt;script&gt;… &amp; &quot;b&quot; <b>run by</b>`.
      - **Variedade ficou neutra e multi-idioma**: um só caminho para todos os idiomas. Antes o
        inglês tinha bandeiras e espanhol/francês/alemão caíam num fallback com 🌍. Agora usa
        `varietyShort()` — "AmE"/"BrE" no inglês (campo `short` novo em `LANGS.en`) e o rótulo
        próprio nos demais ("Rio da Prata (AR/UY)", "Áustria"). Cor uniforme: são dezenas de
        variedades somando 4 idiomas, pintar cada uma seria arbitrário e não escalaria.
      - **Registro passou a ter cor semântica por FAMÍLIA**, toda vinda do tema: vulgar→`--error`,
        gíria→`--warning`, informal/coloquial→`--purple`, formal/técnico→`--primary`,
        arcaico/literário→`--text2`. A cor diz a família; o texto diz o termo exato.
        "slang" virou "gíria" (a interface é toda em PT).
      - **Fórmula de contraste**: o texto não usa o acento puro — puxa 45% na direção do `--text`
        do tema (`color-mix(… 55%, var(--text))`), com fundo a 12%. Como `--text` é escuro nos
        temas claros e claro nos escuros, a mistura empurra para o lado certo **dos dois lados**,
        sem `if` por tema. Fallback neutro antes das linhas de `color-mix` para navegador antigo.
    - **Resultado medido (mesmo verificador, antes × depois)**: reprovações por tema
      `midnight 7→0, light 3→0, sepia 6→0, emerald 7→0, violet 7→0, papel 3→0`; pior caso
      global **1.90:1 → 4.68:1**. Matizes seguem distinguíveis (vermelho/âmbar/violeta/azul/neutro).
    - ⚠️ **Nota sobre a medição**: a primeira versão do meu verificador lia o fundo via
      `getComputedStyle(body).backgroundColor` — mas o `body` tem `transition:background-color
      .35s`, então eu lia o valor **em transição** e media 5 dos 6 temas contra o fundo errado.
      Corrigido lendo `--bg` direto. Os números acima são os do verificador corrigido.
    - **Validado ao vivo**: helpers disponíveis **sem** o study.js carregado (a correção de (b)),
      glossário com 8/8 chips de registro e 7 de variedade incluindo espanhol e alemão,
      flashcard com chips na frente e no verso, `general` e registro inexistente devolvendo
      vazio, 0 emojis em nós de texto no DOM inteiro, 0 erros de console.
      `CACHE` do `sw.js`: `englab-v5` → **`englab-v6`**.
    - **Armadilha de desenvolvimento encontrada**: o `python -m http.server` não manda
      `Cache-Control`, e o Chrome segurou `styles.css`/`lang.js` antigos por várias recargas —
      inclusive depois de desregistrar o service worker. Truque que resolve: abrir por
      **`127.0.0.1` em vez de `localhost`** (origem diferente = cache separado).

### Sessão 2026-07-30 — Cópia `english-lab-2.0`: git, correções e melhorias transversais
43. **Contexto**: o Djemeson trouxe a pasta `english-lab-2.0` — uma cópia do repositório que
    passou pelo **Google AI Studio** e voltou com trabalho novo (uma camada mobile completa e um
    player de playlist de áudio), mas **sem `.git`** e com o boilerplate do AI Studio por cima.
    Pedido: configurar o controle remoto, achar e corrigir erros, aplicar ajustes e melhorias.
    - **Git configurado**: `git init` + `origin` → `https://github.com/Djemeson/english-lab.git`,
      branch `main` adotando `origin/main` **sem tocar na árvore de trabalho** (`git branch main
      origin/main` + `symbolic-ref` + `reset`, nunca `checkout` — que teria sobrescrito o
      trabalho local). O diff local × remoto era de ~1.400 linhas: mobile header + bottom nav,
      redesenho da tela de Configurações, atalhos de teclado do SRS, estatísticas e gráfico
      semanal no Dashboard, e o player de playlist. **Nada foi enviado ao GitHub** — commit
      local numa branch, push fica a critério do Djemeson.
    - **`.gitignore` criado** (não existia): `node_modules/`, `dist/`, `.env*`, backups JSON
      exportados pelo app, lixo de SO/editor.
    - **Service worker consertado (erro que quebrava o GitHub Pages)**: `js/init.js` registrava
      `/sw.js` com escopo `/` — inexistente em `djemeson.github.io/english-lab/`; e o `SHELL` do
      `sw.js` usava caminhos de raiz (`/index.html`, `/css/...`), o que fazia o `addAll()`
      rejeitar inteiro num 404 e o SW **nunca instalar** em produção. Agora tudo é **relativo**
      (`new URL('sw.js', document.baseURI)`, escopo `./`, `'./index.html'`…), funciona na raiz
      e em subpasta; o install cacheia **um por um** (um 404 não derruba mais o resto);
      `js/consulta.js` (não-lazy, faltava) entrou no shell; `CACHE` foi para `englab-v5`.
    - **PWA**: novos `manifest.webmanifest` e `icon.svg`; `<link rel=manifest>`, `theme-color`,
      `apple-touch-icon` e `color-scheme` no `<head>`. O app já tinha service worker mas não era
      instalável.
    - **Viewport duplicado + zoom bloqueado**: o `<head>` tinha **duas** tags `viewport`, a
      primeira com `maximum-scale=1.0` (impede pinch-zoom — falha de acessibilidade). Sobrou uma,
      sem `maximum-scale`, com `viewport-fit=cover`. Removido também um `<script type="module">`
      vazio.
    - **Variáveis CSS que não existiam** (confirmado ao vivo por `getComputedStyle`): o código do
      AI Studio usava `--surface-hover`, `--font-mono` e `--font-display`, nenhuma definida — o
      painel do player ficava **sem fundo** e as fontes caíam no padrão. `--font-display` e
      `--font-mono` agora são tokens de `:root` (compartilhados pelos 6 temas) e o
      `--surface-hover` virou `--surface2`. `.hm-stat-num` deixou de repetir a família de fonte
      na mão.
    - **`.srb-key` / `.srb-key-inline` sem CSS**: as dicas de atalho (`1`–`4`, `Espaço`) eram
      texto solto. Agora são chips estilo `<kbd>`, e somem em telas de toque (`hover: none`).
    - **Player de playlist (`js/audio.js`) — 5 correções**: (1) **corrida de cards** — pular/voltar
      durante a fala deixava a cadeia `async` antiga terminar depois e chamar `playlistNext()` de
      novo, **pulando um card**; resolvido com token de geração (`_playlistGen`) que invalida
      cadeias órfãs (validado com TTS falso: pular durante a fala avança exatamente 1);
      (2) `playlistDelay` agora é **cancelável** (antes o `clearTimeout` deixava a Promise pendente
      para sempre); (3) a frase era injetada **sem escape** — passou a usar `escB()` como o resto
      do app; (4) bloco de **IPA morto** (o snapshot de `srsCards` não tem `ipa`) removido;
      (5) fecha ao clicar fora, `role="dialog"`/`aria-label`, e as setas/espaço deixaram de
      sequestrar o slider e o checkbox.
    - **Dashboard**: rótulos do heatmap passaram a cobrir o **nº real de colunas** (era fixo em 53,
      e as células de padding do começo deixavam a última coluna sem rótulo); a largura da linha
      de meses agora vem do JS e bate exatamente com a grade (753px = 753px). A legenda do gráfico
      semanal dizia "Erros / Lapso" para a barra que representa o **total revisado** — corrigido
      para "Acertos" / "Total revisado".
    - **Emojis removidos da interface** (pendência antiga, seção 9): varredura em `index.html` e
      em 8 arquivos JS trocando emoji por `ic()` ou removendo quando era redundante (o `toast()`
      já desenha o próprio ícone). Confirmado ao vivo: **0 emojis em nós de texto do DOM** nas
      7 telas. **Exceção deliberada**: o mapa de chips de variedade/registro em `js/study.js`
      (linhas ~694-721) — são 8 símbolos que formam um vocabulário visual próprio; trocar exige
      desenhar 8 ícones e uma passada de design, não um find/replace.
    - **CSS morto removido**: `.tab span{display:none}` no mobile não casava com nada (os rótulos
      das tabs são nós de texto, não `<span>`) e viraria uma armadilha se alguém envolvesse.
    - **Documentação**: `README.md`, `metadata.json` e `.env.example` eram **boilerplate do Google
      AI Studio** (falavam de Gemini, `GEMINI_API_KEY`, `.env.local` — nada disso existe aqui).
      Reescritos. `setup.md` descrevia um app extinto (`plataforma-ingles.html`, AnkiConnect,
      Google Sheets) e `instrucoes-projeto.md` afirmava que o projeto é "um `index.html` único de
      ~220KB com toda a lógica num `<script>`" (falso desde a divisão em `js/*.js`) — ambos
      reescritos. `package.json` ganhou um script `check` (`node --check` em todos os JS) no lugar
      de um `build` morto que nem rodava no Windows.
    - **Marcadores de conflito de merge** (`<<<<<<< HEAD` … `>>>>>>> claude/youthful-thompson-8f87f3`)
      estavam **commitados** no `ESTADO-DO-PROJETO.md`, em dois pontos — inclusive no `main` do
      GitHub. Resolvidos (as duas versões eram complementares, ambas ficaram) e o
      **CI ganhou um guarda** que falha o build se algum marcador voltar, além de uma checagem
      de JSON válido (`.github/workflows/deploy.yml`).
    - **Validado ao vivo** (servidor local + Claude Browser): 0 erros de console nas 7 telas,
      0 IDs duplicados, 0 handlers `onclick` apontando para função inexistente, SW instalando com
      os 14 arquivos do shell, `manifest` carregado, layout mobile (375px) sem estouro horizontal,
      e `node --check` limpo em todos os JS. ⚠️ A ferramenta de **screenshot continua indisponível**
      (timeout) — a validação visual foi por `getComputedStyle`/DOM, como nas sessões anteriores.

### Sessão 2026-07-14 — Dashboard implementado a partir do mockup Claude Design
42. **Contexto**: o Djemeson trouxe o mockup "Dashboard.dc.html" do projeto Claude Design
    "Redesign da aba" (mesmo projeto do reskin "Papel" de 2026-07-13; projectId
    `18938966-2928-4595-80ed-382898ddf0a5`, tem também `Adicionar - Mídia.dc.html`,
    `Canvas.dc.html`, `Estudar.dc.html` e `Gamificação.dc.html` — ainda não implementados).
    Pedido: "implementar" o mockup do Dashboard. Diferente do reskin "Papel" (só CSS), este
    mockup tinha 7 seções **novas** que não existiam (heatmap, tendência, idiomas, leeches,
    palavra do dia, fontes, conquistas) — perguntei ao Djemeson o escopo antes de mexer; ele
    escolheu **"tudo, com dados reais"** (não mockado) em vez de reskin visual só ou pular
    conquistas.
    - **`js/dashboard.js`**: novas funções `dashHeatCells` (371 dias a partir de `srsLog`,
      alinhado p/ começar num domingo), `dashAccuracyTrend` (14 dias, `correct/reviewed` do
      `srsLog`, SVG polyline), `dashLangRows` (agrupa `srsCards` por `lang`/`state`),
      `dashLeeches` (cards com `card.leech`, um chip por palavra), `dashWordOfDay` (escolha
      determinística pelo hash da data — mesma palavra o dia todo — entre cards com
      `origin_pt`, senão qualquer card com `meaning_pt`), `dashSources` (agrupa `words` por
      `source_title`/`source_type`), `dashAchievements` (6 marcos calculados: 1ª palavra,
      50 cards maduros — `state==='review' && interval>=21` —, streak 7 dias, 2+ idiomas,
      100 idioms, 500 palavras — **sem sistema de gamificação novo por trás**, só thresholds
      sobre dados existentes). `renderDashboardGrid`/`renderDashboardAchievements` chamadas
      no fim de `renderDashboard()`. Chip de sequência (🔥 N dias) adicionado ao hero
      existente (`dash-action-card`) só quando `streak > 0` — hero em si NÃO foi tocado
      (já estava bom, gradiente do reskin "Papel").
    - **`index.html`**: `section-dashboard` ganhou `page-header` (padrão das outras seções)
      e dois containers novos — `dash-grid-area` (grade 2 colunas) e `dash-achv-area`
      (conquistas) — preenchidos via JS; `dash-main-action`/`dash-stats-area`/
      `dash-recent-area` (existentes) intocados.
    - **`css/styles.css`**: bloco novo no fim do arquivo (`.dash-hero-streak*`, `.dash-grid`,
      `.dash-card*`, `.dash-hm-*`, `.dash-trend-*`, `.dash-lang-*`/`.dash-lr-*`,
      `.dash-leech-*`, `.dash-wod-*`, `.dash-src-*`, `.dash-badge*`), todo via variáveis de
      tema (`--primary`, `--surface`, `--success`, `--warning`, `--error` etc.) — funciona
      nos 6 temas sem hardcode de cor. Responsivo: grade vira 1 coluna e badges 3→2 colunas
      em telas estreitas.
    - **`js/core.js`**: 2 ícones novos em `ICONS` (`lock`, `heart`) — faltavam para as
      conquistas "Poliglota" e "100 idioms" (os outros 4 ícones do mockup já existiam:
      `pencil`, `sparkles`, `clock`, `book`).
    - **Empty states**: cada seção nova trata a ausência de dados sem quebrar (heatmap todo
      cinza, tendência com mensagem, idiomas/fontes/palavra-do-dia com texto neutro, card de
      leech só aparece se houver algum). Testado ao vivo (servidor HTTP local + Claude
      Browser) com o app **zerado** (sem erro) e com **dados sintéticos injetados via
      console** (`words`/`srsCards`/`srsLog` em memória) cobrindo os 6 temas via
      `getComputedStyle` — grade 2 colunas (1.7fr/1fr), cor do heatmap/badges seguindo
      `--primary` de cada tema, badges bloqueados com opacidade reduzida, chip de sequência
      branco sobre o gradiente do hero. ⚠️ Ferramenta de screenshot do Claude Browser
      indisponível (timeout) nesta sessão também — validação por `getComputedStyle`/
      `get_page_text`, não por captura visual.
    - **Achado (fora do escopo, não corrigido aqui)**: bug pré-existente de pluralização no
      hero (`js/dashboard.js`) — quando `dueToday` é 0, o template gera "0 revisãoões" (o
      sufixo condicional "ões" é concatenado a "revisão", que já não termina em "revis").
      Sinalizado como tarefa separada (`task_36f52dbd`), não uma regressão desta sessão.
    - **Não tocado**: `Adicionar - Mídia.dc.html`, `Canvas.dc.html`, `Estudar.dc.html` e
      `Gamificação.dc.html` do mesmo projeto Claude Design — ficam para sessões futuras se o
      Djemeson pedir.
### Sessão 2026-07-14 (mesma data) — Correção de bug de pluralização no Dashboard
42b. **Motivo**: bug encontrado ao validar a implementação do Dashboard.dc.html (pré-existente,
    não introduzido na sessão). Em [js/dashboard.js](js/dashboard.js:31), `renderDashboard()`,
    a linha do hero (`dash-action-card`) montava a pluralização de "revisão" concatenando um
    sufixo (`'revisão' + (dueToday!==1?'ões':'')`), o que produzia "revisãoões" para qualquer
    `dueToday !== 1` (inclusive 0), já que o singular não termina em "revis".
    **Correção**: trocado para escolher entre duas strings completas —
    `` `${dueToday} ${dueToday!==1?'revisões':'revisão'}` ``. Mudança isolada, sem impacto em
    sync/SRS/dados.

### Sessão 2026-07-13 (2ª rodada) — Precisão do negrito do objeto de estudo (EN + PT)
41. **Motivo**: o Djemeson reportou que o negrito do objeto de estudo (a palavra/expressão
    sendo estudada) está inconsistente e impreciso, tanto na frase em inglês quanto na
    tradução em português. Investigação (agente Explore) mapeou os 7 pontos que geram frases
    com negrito e achou 3 causas raiz reais (nenhuma era bug de renderização — `escB`/
    `allowBold` já preservam `<b>` corretamente em todo lugar; o problema é 100% na geração):
    - **Mismatch schema × regra** em `review.js` (`analyzeWordDirect`) e `audio.js`
      (`regenerateMeaning`): a regra em prosa pedia negrito também no lado PT, mas o EXEMPLO
      de JSON do prompt (o que o modelo mais "copia") mostrava `"pt"` **sem** `<b>` nenhum —
      contradição direta que plausivelmente fazia o negrito do PT sumir nesses dois fluxos.
      Corrigido: os exemplos de schema agora mostram `<b>equivalente</b>` no PT também.
    - **Fase 1 do extrator de documento** (`add.js` → `LIST_SYSTEM`) não tinha NENHUMA
      instrução de negrito pro `doc_example_en` (a frase-semente tirada do documento), e essa
      semente **fica permanente** se a Fase 2 (enriquecimento) falhar pra aquele lote — um
      caminho real e reproduzível pra um card ficar pra sempre com a frase em inglês sem
      negrito nenhum e a tradução vazia. Corrigido: Fase 1 agora pede o negrito na semente
      também (rede de segurança), e a instrução de negrito da Fase 2 (`ENRICH_SYSTEM`), que
      antes estava escondida no meio de um parágrafo denso, virou um bloco de regras próprio
      e explícito.
    - **Validação fraca no botão "Negrito perfeito (IA)"** (`audio.js` → `markBoldAll`/
      `markBoldOne`): tanto o filtro de "quais cards precisam de correção" quanto a checagem
      de aceitação da resposta da IA usavam só `/<b>/i.test(...)` — ou seja, só checavam se
      existia ALGUM `<b>` em algum lugar, não se o negrito estava no lugar certo, era um span
      só, ou não cobria a frase inteira. Um negrito errado (palavra errada, duplicado, ou a
      frase toda em negrito) passava como "corrigido" e ficava assim pra sempre.
      **Corrigido**: nova função `boldSpanOk(s)` (audio.js) exige EXATAMENTE um par
      `<b>...</b>`, não vazio, e cobrindo menos de 85% do texto puro — usada tanto pra decidir
      o que precisa de correção (agora pega negrito ausente E malformado, não só ausente)
      quanto pra validar a resposta da IA antes de aceitar como corrigido.
    - **Prompts padronizados**: os 7 pontos que pedem negrito (review.js, audio.js ×2 —
      `regenerateMeaning` e `markBoldOne`, study.js `regenerateCardExample`, consulta.js
      `srsExtractSystem`, add.js ×2 — `LIST_SYSTEM` e `ENRICH_SYSTEM`) agora seguem a mesma
      regra completa (a de `markBoldOne`, que já era a mais precisa): negrito na forma
      flexionada/conjugada como aparece na frase (não a forma de dicionário), todas as partes
      de uma expressão de várias palavras/verbo separável mesmo com outra palavra no meio,
      idiom inteiro, só a ocorrência principal se o termo repetir, exatamente um span por lado.
    - **Não tocado**: renderização (`escB`/`allowBold`/`buildSrsFrente`) já estava correta;
      `fillMissingAll` (não mexe em exemplos, por desenho); Kindle (não gera frases próprias,
      depende do `review.js` na hora de analisar).
    - ⚠️ **Não testado ao vivo com a API real** (só validação sintática/lógica local — `node`
      não roda no bash deste ambiente conforme já documentado; `boldSpanOk` foi testado direto
      no browser com casos sintéticos). Recomenda-se: (1) analisar uma palavra nova em Revisar
      e conferir o negrito nos dois lados; (2) rodar "Negrito perfeito (IA)" na Biblioteca uma
      vez (ele agora vai pegar bem mais cards que antes, incluindo os com negrito malformado —
      **fazer backup/Exportar JSON antes**, já que reescreve frases); (3) importar um documento
      novo na Mídia e conferir o negrito da semente da Fase 1 se a Fase 2 falhar algum lote.

### Sessão 2026-07-13 — Reskin visual "Papel" + rename para "Language Lab"
40. **Contexto**: o Djemeson trouxe um mockup do Claude Design ("App Redesign.dc.html", projeto
    "Landing page para línguas") com uma linguagem visual nova (fundo "papel" cremoso, azul-tinta
    como acento, tipografia serifada Newsreader nos títulos, cantos mais arredondados, sombras
    mais quentes, hero card em gradiente, chips em pílula). Pedido: "implementar" o mockup.
    - **Decisão de estratégia (validada com o usuário)**: em vez de reescrever o HTML/CSS/classes
      1:1 com o mockup (que exigiria também atualizar as classes hard-coded nas strings de
      template de 7 arquivos JS — dashboard/revisar/estudar/biblioteca/configurações/assistente/
      adicionar — sem suíte de testes, alto risco de quebrar `onclick`/ids ao vivo), foi feito um
      **reskin**: só `css/styles.css` (tokens + restilização de classes já existentes),
      `index.html` (fonte + texto da marca) e `js/core.js` (1 entrada nova em `THEMES`) foram
      tocados. Nenhum id, classe usada por JS ou handler `onclick` mudou de nome.
    - **Tokens globais**: `--radius`/`--radius-sm` 14px/9px → **16px/11px** (`:root`).
      `--shadow`/`--shadow-sm`/`--shadow-card` dos 5 temas existentes recoloridos de preto puro
      para um tom mais quente (mesma opacidade/blur, só a cor muda); `sepia` já era quente, não
      mexido; `hue` de cada tema (`--primary`/`--surface`/`--bg`/etc.) preservado 100%.
    - **Novo 6º tema `papel`** (`[data-theme="papel"]`, claro): paleta literal do mockup mapeada
      para os nomes de variável já existentes (`--bg:#F6F4EF`, `--primary:#2E4BC6`, etc., com
      `--success`/`--warning` dessaturados para não ficarem berrantes em fundo branco). Entrada
      correspondente em `THEMES` (`js/core.js`) — `js/settings.js` já renderiza o seletor de
      temas genericamente a partir do array, **nenhuma mudança nele foi necessária**.
    - **Fonte**: adicionada **Newsreader** (Google Fonts) ao lado de Inter em `index.html`,
      aplicada só em títulos/palavra-chave/números grandes (ver seção 6 acima); todo o resto
      (botões, nav, chips, inputs) continua Inter.
    - **Restilização de componentes** (regras novas no fim de `styles.css`, não edições nas
      regras antigas — vencem a cascata por ordem de origem): hero card do Dashboard
      (`.dash-action-card`) ganhou gradiente sólido + texto branco, mas **só quando o elemento
      não tem `style` inline** (`:not([style])`) — o estado "nada para revisar hoje" usa um
      `style` inline próprio em `dashboard.js` e continua neutro, sem ficar azul por engano.
      Chips/tabs viraram pílula total (`border-radius:999px`); `.btn-primary` ganhou sombra mais
      forte; `.wc-word`/`.srs-card-front-word` (palavra da flashcard) aumentaram de tamanho;
      `.srs-rate-btn` ganhou borda tintada em repouso (não só no hover).
    - **Rename "English Lab" → "Language Lab"** (só texto, na sidebar e no `<title>`) — resolve a
      pendência opcional que já estava registrada na seção 9 por causa do suporte multi-idioma.
      Infraestrutura (repo, URL do GitHub Pages, Firebase) continua `english-lab`.
    - **Validado ao vivo** (servidor HTTP local + Claude Browser, já que `file://` é bloqueado):
      `getComputedStyle` confirmou os 6 temas no seletor, o tema `papel` aplicando os tokens
      certos, o hero card em gradiente com texto branco só no estado populado (o estado vazio
      manteve `--surface` e o ícone verde inline intactos), fonte Newsreader nos seletores certos,
      chips/tabs em pílula (999px), navegação entre as 7 telas (inclusive `adicionar`/`estudar`/
      `biblioteca`, que são lazy-loaded) sem nenhum erro no console, e ausência de qualquer texto
      "English Lab" residual no DOM. ⚠️ A ferramenta de screenshot do Claude Browser ficou
      indisponível (timeout) nesta sessão — a validação visual foi feita via `getComputedStyle`/
      leitura de página, não por captura de tela; vale um hard-refresh + olhada visual manual
      depois do deploy (ver pendências, seção 9).

### Sessão 2026-07-05 (2ª rodada) — botão de IA passou a PRESERVAR exemplos já curados
39. **Motivo**: o Djemeson importou uma leva de estudo de espanhol (`A1.1-leva-01.md`, material
    com exemplos cuidadosamente ordenados por tempo verbal/pessoa) e ficou com medo de clicar em
    "Analisar com IA"/"Re-analisar" (Revisar) por essas palavras já terem exemplo — o `applyAiResult`
    **substituía `w.meanings` por inteiro**, então a IA reescrevia até os significados que já tinham
    frases boas (o prompt só "pedia com jeitinho" pra IA preservar o `_seedMeaning`, sem garantia).
    - **`js/review.js` → `applyAiResult`**: agora faz um MERGE. Significados que já têm
      `examples.length > 0` (vindos de import de doc, de uma análise anterior ou de edição manual)
      são casados com o retorno da IA (por `meaning_pt` normalizado ou por `context_match`) e têm
      `meaning_pt/definition_pt/examples` **preservados** — só completa o que estava vazio (`origin_pt`,
      `type_label`, `variety`/`register` ainda genéricos, `level`, `synonyms`/`antonyms`). Sentidos
      NOVOS que a IA trouxe (que a palavra ainda não tinha) entram do jeito que vieram, exemplos
      inclusos — não há nada pra preservar ali. Campos de nível-palavra (`type`, `type_label`, `ipa`)
      também passaram a só preencher se estavam vazios, em vez de sobrescrever sempre.
      Afeta TODOS os botões que passam por `analyzeWordDirect` (Analisar com IA, Re-analisar,
      Analisar selecionadas, Analisar todas) — correção única no ponto central.
    - **Biblioteca — botão temporário generalizado**: `fillOriginsAll` (`#lib-fill-origin-btn`) virou
      `fillMissingAll` (`js/audio.js`) — em vez de só completar `origin_pt`, agora completa IPA,
      `type_label`, nível E origem, sempre só o que estiver VAZIO (nunca mexe em significado, frases,
      variedade/registro nem agendamento). Botão renomeado para "Completar dados (IA)" — serve pra
      rodar a IA com segurança sobre itens JÁ ADICIONADOS (qualquer leva/import antigo), sem risco de
      perder frases curadas. Ainda um botão TEMPORÁRIO (mesmo ciclo de vida do antigo "Preencher
      origem" — ver pendências).

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

- [ ] **Olhar a sidebar nova com dados reais** (7ª rodada, 2026-07-31): o bloco "Hoje" foi
      validado com `srsLog` sintético (12 feitas / 183 restantes / 5 dias). Com uso real,
      conferir se a proporção da barra faz sentido durante uma sessão (o número de "feitas"
      conta cada nota dada, inclusive repetições das etapas de aprendizagem — então pode passar
      do que parecia o total do dia) e se "Dia concluído" aparece na hora certa.

- [x] **Publicado no GitHub** em 2026-07-30 (`main` = `5e4a32f`, Actions verde, service worker
      confirmado ao vivo em `/english-lab/` com o cache `englab-v5` e 14 arquivos).
- [x] **Repositório importado na Vercel** em 2026-07-30 → `https://english-lab-seven.vercel.app/`.
      Verificado ao vivo: 0 erros de console, service worker registrado no escopo `/` com o
      cache `englab-v5` e 14 arquivos, `manifest.webmanifest` servido como
      `application/manifest+json`, `sw.js` com `must-revalidate`, as 7 telas navegando e
      servido como **estático** (`server: Vercel`, sem função Node). Os caminhos relativos do
      SW provaram seu valor: o mesmo código funciona em `/english-lab/` no Pages e em `/` na
      Vercel, sem condicional.
- [x] **`english-lab-seven.vercel.app` autorizado no Firebase** (2026-07-30, feito pelo
      Djemeson) — login Google e sync funcionam na Vercel. Na mesma passada ele removeu as
      três sobras do Google AI Studio (`aistudio.google.com`, `ais-dev-…`, `ais-pre-…`), que
      davam a páginas de terceiros a capacidade de iniciar o login do projeto.
      Lista atual: `localhost`, `english-lab-726e7.firebaseapp.com`,
      `english-lab-726e7.web.app`, `djemeson.github.io`, `english-lab-seven.vercel.app`.
      ⚠️ `*.vercel.app` não funciona como curinga: cada **preview deploy** tem URL própria e
      **não autentica**. Para estudar de verdade, sempre a URL de produção.
- [ ] **Hard-refresh + backup depois de abrir a versão nova** (Exportar JSON antes): o service
      worker mudou de `englab-v4` para `englab-v5`.
- [ ] **Testar o player "Ouvir playlist" com áudio real** (a validação desta sessão usou TTS
      falso para provar que pular durante a fala não pula card): abrir a Biblioteca, tocar nos
      3 modos (Completo / Desafio / Só o idioma), pular e voltar durante a fala, e conferir que
      a tradução em PT sai no modo Desafio só depois da pausa de recall.
- [ ] **Conferir o app instalado como PWA** (manifest + `icon.svg` novos): "Adicionar à tela de
      início" no celular, ver o ícone e se abre em `standalone` sem a barra do navegador.
- [ ] **Confirmar o service worker no GitHub Pages** depois do deploy (era o erro que o impedia
      de instalar em `/english-lab/`): DevTools → Application → Service Workers deve mostrar
      escopo `https://djemeson.github.io/english-lab/` e o cache `englab-v5` com 14 entradas.
- [x] **Chips de variedade/registro** — feito na 2ª rodada de 2026-07-30 (item 44): emoji
      removido, movidos para `js/lang.js` (não-lazy), cor pelas variáveis do tema e contraste
      WCAG AA nos 6 temas. A interface está **100% sem emoji** agora.
- [ ] **Conferir visualmente o novo Dashboard ao vivo** (após deploy + hard-refresh; a
      validação desta sessão foi só por `getComputedStyle`/dados sintéticos, sem screenshot):
      com dados reais de uso, olhar o heatmap (cores fazem sentido com o histórico real de
      `srsLog`?), a tendência de acerto, o card de "travando na memória" (só aparece se
      houver leech de verdade), a palavra em destaque (troca a cada dia?) e o card de
      conquistas nos 6 temas — inclusive em mobile (grade 2 colunas deve virar 1 coluna,
      badges 6→3→2 por linha).
- [x] **Bug de pluralização "0 revisãoões"** no hero do Dashboard — corrigido em 2026-07-14
      (confirmado no código em 2026-07-30: `js/dashboard.js` usa duas strings completas).
- [ ] (Opcional) Avaliar implementar os outros mockups do mesmo projeto Claude Design
      ("Redesign da aba"): `Adicionar - Mídia.dc.html`, `Canvas.dc.html`, `Estudar.dc.html`
      e `Gamificação.dc.html` (este último provavelmente cobre um sistema de conquistas mais
      rico que os 6 marcos simples do Dashboard).
- [ ] **Testar o MULTI-IDIOMA ao vivo** (após deploy + hard-refresh; backup — Exportar JSON —
      antes): (1) trocar o seletor p/ Espanhol no Adicionar, adicionar "echar de menos" e
      analisar — conferir type=phrasal_verb c/ type_label "perífrase verbal", IPA, variedades
      es no dropdown do card e deck "Espanhol" criado; (2) auto-detecção: com seletor em Inglês,
      adicionar "se débrouiller" com frase de contexto em francês → deve avisar "Idioma
      detectado: Francês" e ir p/ o deck certo; (3) Assistente: trocar o idioma na barra do chat
      e conferir sugestões + resposta como tutor do idioma + termos extraídos no idioma;
      (4) TTS de uma frase em espanhol/alemão (tts-1 é multilíngue); (5) conferir chip de idioma
      nos cards não-ingleses e o glossário.
- [x] ~~Ajustar o workflow do n8n~~ — a integração inteira foi removida em 2026-07-30.
- [x] Nome exibido do app trocado para "Language Lab" (sessão 2026-07-13) — infra
      (repo/URL/Firebase) continua `english-lab` como já era a decisão.
- [x] Filtro por idioma no glossário da Biblioteca — feito em 2026-07-30 (item 45).
- [ ] **Testar a precisão do negrito ao vivo** (sessão 2026-07-13, 2ª rodada — fazer backup/
      Exportar JSON antes do passo 2, que reescreve frases): (1) analisar uma palavra nova em
      Revisar/Assistente e conferir negrito nos dois lados; (2) rodar "Negrito perfeito (IA)"
      na Biblioteca — deve pegar mais cards que antes (agora detecta negrito malformado, não só
      ausente); (3) importar um documento na Mídia e, se algum lote da Fase 2 falhar, conferir
      se a semente da Fase 1 ainda saiu com negrito no inglês.
- [ ] **Conferir visualmente o reskin "Papel" ao vivo** (após deploy + hard-refresh): a
      ferramenta de screenshot não funcionou nesta sessão, então a validação foi só por
      `getComputedStyle`/DOM — olhar as 7 telas nos 6 temas (principalmente o hero card do
      Dashboard com dados reais/`paraHoje > 0`, a flashcard de Estudar com a palavra maior em
      Newsreader, e o tema `papel` novo) e ajustar valores a olho se algo parecer errado
      (radius/sombra/contraste). Conferir também em mobile (o `.srs-card-front-word` maior pode
      cortar em telas estreitas — ver checklist de risco do plano desta sessão).
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
- [x] Emojis residuais trocados por ícones `ic()` em 2026-07-30 (tela de fim de sessão, toasts,
      botões de Kindle/Mídia/Website, banner de áudio, avisos). Sobra só o mapa de chips de
      variedade/registro em `study.js` — ver item opcional acima.
- [ ] (Opcional) varredura final para mover qualquer símbolo restante de arquivos lazy
      usado fora deles.
- [ ] **Testar ao vivo a importação de documento** (subir o `survivor-vocabulario-ingles.md`):
      confirmar que extrai os termos, que "snuff" sai como "apagar a tocha" e que os cards entram
      em "pendente de revisão" já com significado/exemplo. Fazer backup (Exportar JSON) antes.
- [ ] **Testar PDF** (pdf.js do CDN) — precisa de internet na primeira leitura; depois cacheia.
- [ ] **REMOVER o botão temporário "Completar dados (IA)"** (`#lib-fill-origin-btn` no index.html +
      função `fillMissingAll` em audio.js — sucessora do antigo "Preencher origem"/`fillOriginsAll`)
      depois de rodar o backfill de IPA/categoria/nível/origem nos cards antigos.
- [ ] **Testar ao vivo a preservação de exemplos curados** (após deploy + hard-refresh; backup —
      Exportar JSON — antes): (1) com a leva `A1.1-leva-01.md` já importada em Revisar, clicar
      "Re-analisar" numa palavra (ex.: "hablar") e conferir que as frases/significado curados NÃO
      mudam, só campos vazios (origem etc.) são completados; (2) na Biblioteca, rodar "Completar
      dados (IA)" e conferir que só preenche o que faltava, sem tocar em frases nem no agendamento.
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
- **Caminhos do service worker são RELATIVOS de propósito** (`js/init.js` e o `SHELL` do
  `sw.js`). O app roda na raiz em desenvolvimento e em `/english-lab/` no GitHub Pages;
  caminho absoluto quebra um dos dois. **Ao mudar qualquer arquivo do shell, bumpe a constante
  `CACHE` em `sw.js`** e lembre-se de incluir arquivos novos no `SHELL`.
- **Antes de usar `var(--alguma-coisa)`, confirme que a variável existe** em `css/styles.css`.
  Variável inexistente não dá erro: some silenciosamente (foi assim que o painel do player
  ficou sem fundo). Vale o mesmo para classes CSS referenciadas pelo JS.
- **Nunca use `git checkout` para "adotar" uma pasta como cópia de trabalho** — sobrescreve os
  arquivos locais. O caminho seguro é `git branch <b> origin/<b>` + `git symbolic-ref HEAD` +
  `git reset` (mixed), que só mexe no índice.
- **O CI falha se houver marcador de conflito de merge** (`<<<<<<<`/`=======`/`>>>>>>>`) em
  qualquer `.js`/`.css`/`.html`/`.md`/`.json`/`.yml` — guarda adicionado em 2026-07-30 depois de
  encontrar marcadores commitados no `main`.
