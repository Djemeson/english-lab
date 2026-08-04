# English Lab — Estado do Projeto e Guia de Continuidade

> Documento vivo. **Sempre leia este arquivo antes de iniciar qualquer tarefa** e
> **atualize-o ao finalizar cada tarefa** (instrução fixada no `CLAUDE.md`).
>
> Última atualização: 2026-08-03 — **PT IA a tempo + legenda inteira (42ª/43ª rodadas)**:
> tradução em tempo real virou blocos de 4 falas em PARALELO com janela de 30s (lote
> grande demorava e a fala passava sem tradução); Explicar com resposta vazia não é mais
> cacheado mudo; e o painel de sincronia ganhou "Traduzir legenda inteira" (IA traduz
> todas as falas de uma vez, blocos de 20). Ver seção 8.
>
> Anterior: 2026-08-03 — **DeepSeek recusa conteúdo adulto (41ª rodada)**: falas
> explícitas eram omitidas/recusadas silenciosamente pelo DeepSeek (comportamento
> documentado) e trechos ficavam sem tradução. Agora: prompt de tradução fiel, fallback
> automático para a OpenAI SÓ nas falas recusadas, e desistência controlada (sem loop de
> chamadas). Ver seção 8 (41ª rodada).
>
> Anterior: 2026-08-03 — **PT IA falhando SÓ no DeepSeek (40ª rodada)**: o lote de
> tradução usava `response_format: json_object`, que no DeepSeek às vezes volta
> vazio/truncado (limitação documentada) — trechos grandes ficavam sem tradução. O lote
> agora é texto puro com linhas numeradas (funciona em qualquer fornecedor) + timeout de
> 30s. Ver seção 8 (40ª rodada).
>
> Anterior: 2026-08-03 — **Explicar "não vai" com o vídeo tocando (39ª rodada)**:
> a troca de fala escondia o popup antes de a resposta da IA chegar. Agora Explicar PAUSA
> o vídeo, a troca de fala não fecha o popup com explicação carregando, e erro aparece
> dentro do popup. Ver seção 8 (39ª rodada).
>
> Anterior: 2026-08-03 — **Três consertos do uso real (38ª rodada)**: explicação
> vinha CORTADA (teto de 220 tokens → 600, no vídeo e no Revisar); cabeçalho do popup da
> legenda agora é linha única (seleção longa não empurra mais botão para baixo); e a
> tradução IA que pulava falas com DeepSeek virou LOTE (uma chamada por janela) com
> antecedência de 12s. Ver seção 8 (38ª rodada).
>
> Anterior: 2026-08-03 — **Explicar na legenda do vídeo (37ª rodada)**: o popup de
> seleção da legenda sobre o vídeo ganhou o botão "Explicar" (mini-glosa da IA ali mesmo,
> com a fala como contexto), com as mesmas proteções anti-colapso da 34ª rodada e cache
> compartilhado com o Revisar. Ver seção 8 (37ª rodada).
>
> Última atualização anterior: 2026-08-03 — **DeepSeek V4 (36ª rodada)**: IDs novos confirmados na doc
> oficial (v4-flash/v4-pro); os aliases V3 foram descontinuados pelo próprio DeepSeek em
> 24/07/2026 e saíram da lista — migração automática para quem os tinha salvos.
>
> Anterior a essa: 2026-08-03 — **Multi-fornecedor de IA + botões de tradução no vídeo (35ª
> rodada)**: Gemini, DeepSeek e Groq além da OpenAI (modelos curados por faixa de custo,
> chaves organizadas com teste individual, sync); TTS/imagens/Whisper seguem na OpenAI. No
> vídeo, a tradução virou dois botões com ícone (CC = legenda oficial, faíscas = IA literal),
> flutuando no vídeo e funcionando em tela cheia. Ver seção 8 (35ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Fix do Explicar (34ª rodada)**: o mousedown do clique
> colapsava a seleção e o próprio listener escondia o popup antes da explicação chegar.
> Clique dentro do popup não fecha mais + preventDefault preserva a seleção.
> Ver seção 8 (34ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Explicar/minerar por seleção no Revisar (33ª rodada)**: o
> caso "o que é Adderall?" — selecione qualquer palavra no card e escolha "Explicar" (gloss da
> IA ali mesmo, com cache) ou "Revisar" (vira item novo herdando contexto e fonte). Sem trocar
> de aba, sem perder o card aberto. Ver seção 8 (33ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Tradução em 3 posições + névoa (32ª rodada)**: um botão
> alterna off → legenda PT-BR oficial → IA literal em tempo real (traduz só o ponto atual +5s,
> economia de tokens validada); névoa borrada por padrão sobre o vídeo com hover revelando,
> desligável — tudo funcionando em fullscreen. Ver seção 8 (32ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Navegação por fala (31ª rodada)**: R repete a fala que
> acabou de passar; ←/→ pulam entre falas (com comportamento "faixa anterior"); Shift+←/→
> mantém os ±5s; segundo par de botões flutuantes no vídeo. Ver seção 8 (31ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Modularização + 3 modos novos (30ª rodada)**: video.js
> virou 4 módulos por responsabilidade (com retry no loader lazy); nasceram o DITADO (escreva o
> que ouviu, correção palavra a palavra, custo zero), o SHADOWING (grave a imitação, a IA diz o
> que saiu claro) e a LEGENDA CRIADA PELA IA (episódio sem legenda em lugar nenhum → Whisper
> escreve uma, ~R,50); fullscreen do vídeo consertado. Ver seção 8 (30ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Correção progressiva de deriva (29ª rodada)**: o caso dos
> 9s que travou o estudo — rótulo adiantada/atrasada estava invertido, a âncora do "começo"
> podia ser o minuto 20, e deriva não se conserta com shift constante. Agora a IA mede 2 pontos
> e reescreve a legenda com desvio interpolado (teste: deriva 3,5s→8,1s ficou a ≤50ms do áudio
> de ponta a ponta). Ver seção 8 (29ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Legenda automática na abertura (28ª rodada)**: abrir um
> vídeo sem legenda dispara a cadeia inteira sozinho (título+episódio do nome do arquivo →
> Cinemeta → addons → melhor da língua → aplica → trilha PT atrás). Validado com rede real:
> 1020 falas do White Lotus S01E01 aplicadas com zero cliques, PT-BR alinhada em 851.
> Ver seção 8 (28ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Candidatas sem teto + tela cheia + pular ±5s (27ª
> rodada)**: o sync com IA testa TODAS as legendas alternativas (a boa estava na posição 7 e o
> teto de 5 a deixava de fora) e adota a menos derivada quando nenhuma é perfeita; tela cheia
> com legenda por dois caminhos (botão próprio = overlay interativo; botão nativo = trilha
> VTT nativa); botões −5s/+5s no vídeo + setas do teclado. Ver seção 8 (27ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Continuar de onde parou (26ª rodada)**: reabrir o mesmo
> arquivo volta com a legenda modificada intacta e retoma a posição (com 2s de recuo; "parou
> em X" na biblioteca). O teste achou e matou um bug de perda de dados (save debounced abortado
> na saída do player) e um caso degenerado do alinhador PT. Ver seção 8 (26ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Seleção na legenda do vídeo (25ª rodada)**: arraste (ou
> clique duplo) na legenda SOBRE o vídeo e leve a palavra/trecho para o estudo — com áudio real
> da cena ou direto para o Revisar. E os botões de traduzir pararam de "não fazer nada":
> tradução pedida aparece sem blur e o PT do trecho aparece no próprio painel.
> Ver seção 8 (25ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Alinhador PT v2 (24ª rodada)**: a tradução PT caía na fala
> errada (a trilha PT vem de outra release — agora o alinhador estima o offset entre as trilhas
> com varredura + mediana) e duplicava no estudo focado (fusões de 2 falas EN num cue PT agora
> são deduplicadas na exibição). Dados antigos se corrigem sozinhos ao reabrir o vídeo.
> Ver seção 8 (24ª rodada).
>
> Última atualização anterior: 2026-08-03 — **.srt sincronizado + IA troca legenda errada (23ª rodada)**:
> "Baixar .srt" exporta a legenda com a sincronização aplicada e o mesmo nome do vídeo (players
> externos carregam sozinhos); e a sincronização agora verifica DOIS pontos do episódio — se a
> legenda deriva (versão diferente), a IA testa as candidatas da busca contra as mesmas
> transcrições (custo zero extra) e troca sozinha pela que casa. Ver seção 8 (23ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Sync com IA consertado (22ª rodada)**: a amostra agora cai
> sozinha no trecho MAIS FALADO do episódio (densidade medida pela própria legenda), o botão
> volta a habilitar após uma falha (re-render movido para depois da trava) e nasceu o último
> recurso "IA do ponto atual" — pause num diálogo e a IA analisa dali.
> Ver seção 8 (22ª rodada).
>
> Última atualização anterior: 2026-08-02 — **Marcador em ciclo + sync com IA (21ª rodada)**: M abre o
> trecho, M fecha e cai direto no estudo focado (marcador virou intervalo); e o painel "Sync"
> ajusta a legenda na mão (±0,1/±0,5s) ou sozinho — Whisper transcreve ~45s do áudio real com
> timestamps, casa com a legenda e aplica a mediana dos desvios (teste com dessincronia
> plantada de +2,0s: detectou e corrigiu exato). Ver seção 8 (21ª rodada).
>
> Última atualização anterior: 2026-08-02 — **Player de verdade (20ª rodada)**: legenda em tempo real
> sobre o vídeo, tradução simultânea em camadas (legenda PT-BR oficial alinhada por tempo —
> 614/769 falas no teste real — com IA como camada adicional), busca de legenda sem fricção
> (direto para a lista do episódio) e ESTUDO FOCADO por trecho (escuta às cegas → revelar fala
> → revelar tradução → salvar card com áudio real), acessível da seleção e dos marcadores.
> Ver seção 8 (20ª rodada).
>
> Última atualização anterior: 2026-08-02 — **Legendas via addons do Stremio + conserto de áudio Dolby
> (19ª rodada)**: botão "Buscar legenda" (protocolo aberto dos addons, com CORS — a função
> serverless ficou desnecessária; validado com 40 legendas reais de House of the Dragon S03E02)
> e "Consertar áudio" para MKV com Dolby/DTS mudo no Chrome (ffmpeg.wasm hospedado no próprio
> site, WORKERFS, m4a no IndexedDB + <audio> paralelo sincronizado).
> Ver seção 8 (19ª rodada).
>
> Última atualização anterior: 2026-08-01 — **FASE 1 DO VÍDEO NO AR (18ª rodada)**: nova seção "Vídeo"
> (lazy) com player + transcript karaokê + cortes A–B + card com o ÁUDIO REAL da cena +
> "Preparar para assistir" + marcadores + tradução com recall + "rever a cena" no estudo.
> Backup: tag git `pre-video-fase1` e Exportar JSON virou backup completo.
> Ver seção 8 (18ª rodada) e `PLANO-VIDEO.md`.
>
> Última atualização anterior: 2026-08-01 — **Estudo de escopo VÍDEO (17ª rodada)**: análise completa da
> funcionalidade de estudar com vídeo + legenda está em [`PLANO-VIDEO.md`](./PLANO-VIDEO.md)
> (viabilidade das 4 ideias do Djemeson, arquitetura, custos, fases, ideias extras). SEM código
> ainda — aguardando as decisões da seção 9 do plano. Ver seção 8 (17ª rodada).
>
> Última atualização anterior: 2026-08-01 — **Estudar no celular (16ª rodada)**: a página rolava 63px
> para o lado a 375px. Causas: `repeat(3,1fr)` que não encolhe (`1fr` = `minmax(auto,1fr)`) e a
> tabela de baralhos empurrando a página em vez de rolar dentro do cartão. Agora: 0 de scroll
> horizontal nas 7 telas a 320px e 375px. Ver seção 8 (16ª rodada).
>
> Última atualização anterior: 2026-08-01 — **Dashboard mais denso (15ª rodada)**: 443px de moldura antes
> do primeiro dado viraram 347px, a seção passou de 1180 para 1336px de largura (e o heatmap
> voltou a mostrar o ano inteiro), o hero parou de espalhar os números pelas pontas e as colunas
> do painel foram reorganizadas por altura medida (vão de 653px → ~220px).
> Ver seção 8 (sessão 2026-08-01, 15ª rodada).
>
> Última atualização anterior: 2026-08-01 — **Heatmap na coluna de sempre (14ª rodada)**: o alargamento
> da 13ª rodada foi revertido a pedido. A barra de rolagem some encolhendo o HISTÓRICO (39
> semanas a 1440px, 17 a 375px), não o layout. De quebra, o alinhamento dos rótulos
> Seg/Qua/Sex, que acumulava 5px no celular, foi para 0,01px.
> Ver seção 8 (sessão 2026-08-01, 14ª rodada).
>
> Última atualização anterior: 2026-08-01 — **Heatmap fluido (13ª rodada)**: a grade tinha largura fixa
> (795px) dentro de uma coluna de 412px e a diferença virava barra de rolagem. O cartão passou a
> ocupar a largura toda, a célula virou fluida (colunas `1fr` + `aspect-ratio`) e o número de
> semanas de histórico é escolhido pelo espaço disponível — overflow deixou de ser possível.
> Ver seção 8 (sessão 2026-08-01, 13ª rodada).
>
> Última atualização anterior: 2026-07-31 — **Heatmap com previsão (12ª rodada)**: o calendário de
> atividade passou a mostrar 28 dias à frente com os cards já agendados (célula vazada, para
> não confundir carga prevista com esforço feito), ganhou a estatística "Próx. 7 dias" e agora
> nasce rolado até o fim — antes hoje ficava fora da tela.
> Ver seção 8 (sessão 2026-07-31, 12ª rodada).
>
> Última atualização anterior: 2026-07-31 — **Imagem do card ilustra o SENTIDO (11ª rodada)**: o prompt
> mandava a palavra estrangeira + o significado em português para o modelo de imagem, que
> ancorava no sentido mais comum ("tally" 2/2 = concordar saía como marcas de contagem). Agora
> `buildImageScene()` traduz o sentido numa cena em inglês, com os outros sentidos da palavra
> como proibição, e a palavra não vai mais para o modelo de imagem.
> Ver seção 8 (sessão 2026-07-31, 11ª rodada).
>
> Última atualização anterior: 2026-07-31 — **Sidebar reformada (7ª rodada)**: os 254px de vazio (35% da
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

### Sessão 2026-08-03 (43ª rodada) — "Traduzir legenda inteira" (legenda PT-BR criada por IA)
94. **Pedido**: "adicione uma opção de criar a legenda em portugues com IA baseado na
    legenda em ingles". Botão **"Traduzir legenda inteira"** no painel de sincronia:
    - `videoTranslateFull()` (video-subs.js): traduz TODAS as falas sem `pt` em blocos de
      20 (até 3 em voo), reusando `_vidPTlote`/`_vidPTparse`/fallback de recusas da 41ª.
      Progresso no painel ("N/M falas"); re-filtra a cada grupo (o tempo real pode ter
      traduzido algumas); `_vidSaveSubsNow()` no fim; liga o modo "PT IA" sozinho se
      estava desligado. Custo: centavos no DeepSeek (~90 tokens/fala).
    - Validado ao vivo: 50 falas → tempo real cobriu ~10 (janela 30s), o botão traduziu o
      resto em blocos 20/19, modo ligou sozinho, status no painel, todas com `pt`.

### Sessão 2026-08-03 (42ª rodada) — Tradução chegando DEPOIS da fala + Explicar mudo por cache vazio
93. **Duas reclamações**: "demora muito pra carregar algumas legendas em tempo real — se
    eu voltar a frase a informação já está lá" e "algumas palavras ainda não vêm a
    explicação".
    - **Causa da demora**: a resposta da IA é gerada token a token — o tempo cresce com o
      tamanho do lote. Um lote de 8–10 falas levava 10–15s; as primeiras falas passavam
      antes de o lote ficar pronto. `_vidEnsurePT` agora fatia em **blocos de até 4 falas
      em PARALELO** (`_vidPTlote` extraído) e a janela do `_vidEnsurePTAhead` foi de 12s
      para **30s** — o bloco fica pronto ANTES de a fala chegar.
    - **Causa do Explicar mudo**: resposta VAZIA da IA (o DeepSeek faz isso às vezes) era
      renderizada como nada e **cacheada como ''** — a seleção ficava muda para sempre.
      Agora vazio vira erro visível ("resposta vazia… clique para tentar de novo") e NÃO
      entra no cache.
    - Validado ao vivo: 50 falas, janela pegou ~10 em blocos ≤4 paralelos; resposta vazia
      mostrou o erro no popup e o cache ficou limpo. `CACHE`: `v68` → **`v69`**.

### Sessão 2026-08-03 (41ª rodada) — DeepSeek recusa/omite falas de conteúdo adulto
92. **Pedido**: "verifique se o deepseek tem proibição de certas falas". Tem — e pesquisa
    confirmou: o DeepSeek aplica moderação a conteúdo sexual explícito e, em TRADUÇÃO,
    costuma **omitir/alterar silenciosamente** em vez de avisar. Nas cenas adultas do
    White Lotus, trechos inteiros ficavam sem PT. Três camadas de defesa em video-subs.js:
    - **Prompt de fidelidade** (`_VID_PT_SIS`): deixa explícito que é tradução fiel de
      legenda de obra existente para estudo — "sem censurar, suavizar nem omitir". Reduz
      a taxa de recusa (mas não zera).
    - **Fallback automático para a OpenAI** (`_vidPTRecusadas`): fala que voltar sem
      tradução 2× no fornecedor ativo vai SOZINHA para a OpenAI (`gpt-4o-mini`, direto
      via `_aiFetch` com `cfg.openaiKey`) — o resto do lote nem percebe. Contador
      `_ptTent` por fala (transitório, o `limpa` do save já o descarta).
    - **Desistência controlada** (`_ptDesisti`): sem chave OpenAI, ou se ela também não
      der, a fala para de ser re-tentada a cada tick (senão viraria loop de chamadas);
      pedido manual (`sinc`) ignora a desistência e tenta de novo.
    - Helpers extraídos: `_vidPTparse` (linhas numeradas → mapa) e `_vidPTaplica`.
    - **Validado ao vivo** (DS + OA stubados): DS omite a fala explícita → 2ª tentativa
      recusada → fallback OA recebeu SÓ ela e traduziu; depois de resolvido, zero
      chamadas extras. `CACHE`: `v67` → **`v68`**.

### Sessão 2026-08-03 (40ª rodada) — PT IA falhando só no DeepSeek (o json_object era o vilão)
91. **Pista decisiva do Djemeson**: "fiz o teste com a openai no mesmo trecho e funcionou
    perfeitamente" — a falha era específica do DeepSeek. O lote da 38ª usava `aiJSON`
    (`response_format: json_object`); o DeepSeek nesse modo às vezes devolve **conteúdo
    vazio ou truncado** (limitação admitida na doc deles) → `JSON.parse` falhava → o lote
    INTEIRO caía → retentava → caía de novo = "sessões muito grandes sem tradução, às
    vezes aparece e depois para". (O Explicar funcionava no DeepSeek porque é texto puro.)
    - `_vidEnsurePT` agora pede **texto puro com linhas numeradas** ("1. tradução") e
      parseia com regex tolerante (`1.`/`1)`/`1:`/`1-`); linha de conversa fiada do modelo
      é ignorada; número faltante = só aquela fala re-tenta no próximo tick.
    - `timeoutMs: 30000, retries: 1` no lote: uma travada não segura mais a janela por
      minutos (antes: 90s × 3 tentativas ≈ o "para de aparecer" que o Djemeson viu).
    - Validado ao vivo: resposta bagunçada de propósito (pula a 2ª, formatos mistos, lixo
      no fim) → 1ª e 3ª aplicadas, 2ª re-tentada sozinha no lote seguinte; nenhuma chamada
      com `response_format`. `CACHE`: `v66` → **`v67`**.
    - Lição de arquitetura: **`json_object` só onde a estrutura importa de verdade**; para
      listas simples, linha numerada é mais robusta entre fornecedores.

### Sessão 2026-08-03 (39ª rodada) — Explicar "não vai" quando o vídeo está tocando
90. **Reclamação**: "pedi pra explicar essa frase, e só reiki, mas não vai. e essa não foi a
    primeira vez". Causa raiz: `_vidOnTime` esconde o popup em TODA troca de fala
    (video.js:415) — com o vídeo TOCANDO, a fala trocava segundos após o clique e o popup
    sumia antes de a resposta da IA (DeepSeek, mais lento) chegar. Três mudanças:
    - **Explicar agora PAUSA o vídeo** ao clicar (vai-se ler; a cena congela e a fala não
      troca por baixo). Retomar o play é do aluno.
    - **Troca de fala não fecha o popup enquanto a explicação carrega** (guard: só esconde
      se não houver `.gen-spinner` no popup). Depois de carregada, a próxima troca fecha
      normalmente (quem retomou o play terminou de ler).
    - **Erro visível DENTRO do popup** (cor `--error`; "clique em Explicar para tentar de
      novo") — antes era `corpo=''` + toast, que some e parece "não fez nada".
    - Validado no cenário exato: vídeo tocando → Explicar pausa → troca de fala forçada
      durante o carregamento não fecha → resposta aparece → troca seguinte (pós-leitura)
      fecha → falha da API mostra o erro no popup. `CACHE`: `v65` → **`v66`**.
    - Obs.: a captura do Djemeson ainda mostrava o layout antigo (Revisar na 2ª linha) —
      o conserto da 38ª estava publicado mas o SW precisa de duas recargas para trocar.

### Sessão 2026-08-03 (38ª rodada) — Três consertos vindos do uso real (Explicar cortado, popup quebrando, PT IA pulando falas)
89. **Três reclamações do Djemeson usando de verdade** (com DeepSeek como fornecedor ativo):
    - **"As informações vêm incompletas"**: o Explicar (vídeo E Revisar) tinha teto de
      `maxTokens: 220` — cortava a resposta no meio da frase. Subiu para **600** nos dois
      (`videoOvExplain` e `revSelExplain`). O teto é só segurança: paga-se o que for gerado.
    - **"Frase longa empurrou o botão para baixo"**: o popup da legenda virou coluna com um
      cabeçalho `.vid-ov-row` (flex **nowrap**: seleção com reticências + 3 botões SEMPRE
      numa linha; botões com `flex-shrink:0`) e a explicação ocupa a linha de baixo inteira.
    - **"Algumas legendas não ganham a tradução da IA em certos trechos"**: o modo PT IA
      disparava UMA chamada POR fala em paralelo com só 5,5s de antecedência — com a
      latência do DeepSeek a resposta chegava depois de a fala passar. `_vidEnsurePT` agora
      traduz a janela em **LOTE** (uma chamada `aiJSON` com as falas numeradas →
      `{"t":[...]}`; falta na resposta = re-tenta no próximo tick; erro limpa `_ptReq` do
      lote inteiro) e `_vidEnsurePTAhead` olha **12s** à frente (era 5,5). Mais rápido,
      mais barato (um prompt) e chega a tempo.
    - **Validado ao vivo**: 3 falas → 1 chamada `json_object` com as 3 numeradas; a 4ª fala
      (fora dos 12s) NÃO traduzida; overlay com o PT; explicação com `max_tokens: 600` e
      texto completo abaixo do cabeçalho; cabeçalho nowrap com botões dentro da linha.
      Duas pegadinhas de teste registradas: o SW re-registrado no reload serviu CSS de
      cache (limpar de novo DEPOIS do reload) e o OneDrive serviu o video-subs.js velho
      (reiniciar o servidor de preview). `CACHE`: `v64` → **`v65`**.

### Sessão 2026-08-03 (37ª rodada) — Explicar também na legenda do vídeo
88. **Pedido**: "quero que exista o botão de explicar tambem nas legendas do video". O popup
    de seleção da legenda sobre o vídeo (`_vidOvSelCheck`, video-study.js) — que tinha só
    "Estudar com áudio" e "Revisar" — ganhou o **Explicar**, espelhando o do Revisar (33ª):
    - `videoOvExplain()`: mini-glosa da IA (2–4 frases PT-BR — sentido NAQUELA fala, gíria/
      marca/referência cultural, sentido figurado) renderizada dentro do próprio popup, num
      bloco `.sel-pop-exp` (classe reutilizada). O contexto enviado é a fala inteira
      (`_vidCues[_vidCueIdx]`) + título do vídeo. Usa `aiText` → fornecedor ativo (35ª).
    - **Cache compartilhado** com o Revisar (`_revExplainCache`, chave `vid|fala|seleção`) —
      review.js é não-lazy, então o Map já existe quando o módulo de vídeo carrega (sem
      violar a armadilha nº 1: o lado lazy é quem referencia o não-lazy, nunca o contrário).
    - **Proteções da 34ª aplicadas de saída**: `preventDefault` no mousedown do popup (a
      seleção não colapsa e o clique não o fecha) + fechar só em clique FORA (novo handler
      em `_vidOvBind`). CSS: `.vid-ov-pop` virou `flex-wrap:wrap` com largura mínima — a
      explicação quebra para baixo dos botões e rola a partir de 180px.
    - **Validado com a sequência REAL de eventos** (lição da 34ª): seleção → popup com 3
      botões → mousedown no Explicar com `defaultPrevented` conferido → explicação aparece
      e o popup PERMANECE aberto → 2º clique instantâneo pelo cache (1 chamada só) →
      clique fora fecha → "Estudar com áudio"/"Revisar" intactos. `CACHE`: `v63` → **`v64`**.

### Sessão 2026-08-03 (36ª rodada) — DeepSeek V4 (e a remoção da V3, decidida por fato)
87. **Pedido**: "crie a versão v4 da deepseek, analise se remove a v3". A análise foi feita na
    FONTE (doc oficial api-docs.deepseek.com via fetch), não em artigo de terceiro:
    - IDs ativos hoje: **`deepseek-v4-flash`** (US$ 0,14/0,28 por 1M tokens; cache hit a
      US$ 0,0028 — quase grátis) e **`deepseek-v4-pro`** (US$ 0,435/0,87).
    - Os aliases antigos `deepseek-chat`/`deepseek-reasoner` foram **DESCONTINUADOS em
      2026-07-24** (dez dias antes desta rodada) — remover não era opcional, era conserto.
    - **Migração suave por construção**: `aiModel()` valida o modelo salvo contra a lista
      curada — quem tinha o alias morto cai automaticamente no `v4-flash` (validado ao
      vivo). Preço dinâmico do DeepSeek (2× no pico da China) anotado no código.
    `CACHE`: `v62` → **`v63`**.

### Sessão 2026-08-03 (35ª rodada) — Multi-fornecedor de IA + botões de tradução com ícone no vídeo
86. **Dois pedidos**: dropdown de fornecedores de IA (Gemini, DeepSeek, Groq além da OpenAI)
    com modelos por faixa de custo e chaves organizadas; e (mensagem do meio) os controles de
    tradução do vídeo viraram DOIS botões com ícone, presentes no fullscreen.
    - **Gateway multi-fornecedor** (`ai.js`): `AI_PROVIDERS` (OpenAI, Gemini, DeepSeek,
      Groq — todos falam o dialeto OpenAI de chat/completions), `aiChatCfg()` decide
      URL+chave+modelo; `aiJSON`/`aiText`/Assistente (streaming) roteiam pelo fornecedor
      ativo. **TTS, imagens e Whisper continuam SEMPRE na OpenAI** (sem equivalente
      compatível) — guard com mensagem clara. Modelos CURADOS por faixa de custo
      (baixo/médio/alto + nota) e lembrados POR fornecedor (`cfg.aiModelProv`).
    - **Configurações**: dropdown de fornecedor → dropdown de modelos com faixa de custo →
      seção "Chaves de API" com 4 linhas organizadas (olho + botão Testar individual via
      GET /models, que não gasta token). Chaves novas: `geminiKey/deepseekKey/groqKey` —
      sincronizadas no Firestore (só quando não-vazias, padrão da openaiKey) e protegidas
      pelo backup pegajoso do IndexedDB. sw: domínios novos em NETWORK_ONLY.
    - **Validado ao vivo**: 4 fornecedores no dropdown, modelos por faixa, roteamento
      conferido (Groq URL+Bearer gsk+llama; Gemini URL+Bearer AIza+flash-lite), TTS
      bloqueando com mensagem certa, teste de chave por fornecedor.
    - **Tradução no vídeo: DOIS botões com ícone** (pedido: "mais sofisticado que texto"):
      CC (legenda PT-BR oficial) e faíscas (IA literal em tempo real), exclusivos entre si,
      no toolbar E como **minis flutuantes no canto do vídeo** (aparecem no hover, valem em
      tela cheia) + mini de névoa. `videoSetPT(modo)` substituiu o ciclo de 3 posições.
      A tradução por IA do vídeo agora usa o FORNECEDOR ATIVO (Groq/Gemini/DeepSeek servem).
      Validado: exclusividade, estados espelhados toolbar↔minis, overlay trocando
      oficial↔IA, fog. `CACHE`: `v61` → **`v62`**.

### Sessão 2026-08-03 (34ª rodada) — Conserto do "cliquei em Explicar e nada aconteceu"
85. **Bug do Djemeson na 33ª**: o menu aparecia, mas Explicar "não fazia nada". Causa: o
    **mousedown no botão colapsa a seleção** do navegador, e 10ms depois o próprio listener
    de mouseup via "seleção vazia" e ESCONDIA o popup — a explicação chegava num popup
    invisível. (O teste da 33ª chamou a função direto e por isso passou — lição: validar
    com a sequência de clique REAL mousedown→colapso→mouseup→click.)
    Correção dupla: (1) mouseup com alvo DENTRO do popup não fecha; (2) `preventDefault` no
    mousedown do popup — clicar nos botões nem colapsa mais a seleção (padrão
    toolbar-sobre-seleção). Revisar verificado junto: cria e fecha como deve.
    Validado com a sequência real de eventos + latência simulada da API: popup aberto
    durante e depois da resposta. `CACHE`: `v60` → **`v61`**.

### Sessão 2026-08-03 (33ª rodada) — Dúvida dentro da dúvida: Explicar/minerar por seleção no Revisar
84. **Caso real do Djemeson** (card "closet Adderall snorter"): entendeu a análise, mas ficou
    com "o que é Adderall? o que é closet?" — e não queria perguntar em outra aba, "sem
    perder o flow". E pediu: selecionar palavras/frases no título e mandar para revisão.
    - **Seleção em QUALQUER parte do card do Revisar** (título, exemplos, definição) → popup
      flutuante posicionado na seleção com duas ações:
      · **"Explicar"**: mini-gloss da IA ALI MESMO (2–4 frases, PT-BR) — o prompt pede o
        sentido NO contexto e, se for marca/gíria/referência cultural (o caso do Adderall),
        o que é no mundo real. Com **cache por seleção** (perguntar de novo é grátis).
      · **"Revisar"**: vira item novo da fila (`createWord` pending_ai) com o contexto da
        frase onde estava a seleção e **herdando a fonte** do card (série/episódio) — o
        "Adderall" minerado nasce sabendo que veio do White Lotus.
    - **O flow não quebra**: o card aberto NÃO re-renderiza (só sidebar + badges); popup
      fecha ao clicar fora e não vaza para outras seções (guard por seção ativa).
    - Implementado em `js/review.js` (não-lazy), classes `.sel-pop` genéricas.
    - Validado ao vivo com o cenário do print: seleção de "Adderall" no título → popup →
      explicação da IA no lugar → cache confirmado → minerado como pending_ai com fonte
      herdada → card intacto; 0 erros nas telas. `CACHE`: `v59` → **`v60`**.

### Sessão 2026-08-03 (32ª rodada) — Tradução em 3 posições + névoa (fog) sobre o vídeo
83. **Pedido**: separar BEM os dois canais de tradução ("a legenda PT-BR pode atrapalhar muito
    no estudo — é aí que a tradução em tempo real da API entra"), traduzir com IA só o ponto
    atual +5s ("não gastar tokens se não for assistir tudo"), névoa borrada por padrão com
    hover revelando (desligável), tudo compatível com fullscreen — "sofisticado, não cheio de
    elementos".
    - **Um botão, três posições** (`videoCyclePT`): `PT` (off) → `PT · legenda` (trilha
      PT-BR oficial alinhada — cue.pts; pula essa posição se não houver trilha) → `PT · IA`
      (tradução LITERAL em tempo real — cue.pt) → off. Fontes nunca se misturam no modo:
      `_vidPTshow()` escolhe por modo; `_vidPTmode` substituiu o antigo `_vidLivePT`.
    - **Economia de tokens**: `_vidEnsurePTAhead(t)` traduz SÓ as falas visíveis e as que
      começam nos próximos ~5s (janela [t−0,5, t+5,5]), com dedupe — validado: 10 falas no
      episódio, apenas 2 traduzidas na janela, avanço sem retraduzir. `_vidEnsurePT` ganhou
      `forcaIA` (o modo IA traduz MESMO onde existe trilha oficial — a divergência entre as
      duas é justamente o que o estudo quer evitar).
    - **Névoa (fog)**: a linha PT sobre o vídeo nasce BORRADA (blur 7px), hover revela;
      botão "Névoa" (só aparece com PT ligado) desliga o efeito. Funciona no fullscreen do
      stage (hover por CSS). Transcript mantém o recall próprio que já tinha.
    - Trilha nativa (fullscreen do player) também segue o modo.
    - Validado ao vivo: ciclo completo com rótulos/toasts, oficial × IA visivelmente
      distintas no overlay, contagem de chamadas exata, fog on/off, off limpa tudo.
      `CACHE`: `v58` → **`v59`**.

### Sessão 2026-08-03 (31ª rodada) — Navegação por FALA ("a frase passou, quero voltar nela")
82. **Pedido**: "uma frase que me interessou passou; a única forma de voltar é −5s. Quero voltar
    rapidamente na última fala, e avançar/retroceder rapidamente entre as falas."
    - **R / botão "Repetir fala"**: volta ao início da fala atual — e, no silêncio entre
      falas, da ÚLTIMA que passou (o caso exato dele). Aterrissa 0,2s antes, de respiro.
    - **← / → viraram fala anterior / próxima** (navegação de player de idioma, não de
      segundos): ← no meio de uma fala volta ao INÍCIO dela; apertando de novo, vai para a
      anterior — o comportamento "faixa anterior" dos players de música. **Shift+←/→**
      mantém os ±5s brutos; sem legenda carregada, as setas caem nos ±5s.
    - **Segundo par de botões flutuantes** no vídeo (‹‹ ››) acima dos de ±5s — valem em tela
      cheia.
    - Caso de borda pego na validação: como o pulo aterrissa na "entradinha" (−0,2s), o →
      seguinte recaía na MESMA fala e parecia travado — o avanço agora reconhece a entradinha
      e pula para a seguinte. Validado ao vivo: 6 cenários de navegação (meio da fala,
      silêncio, sequências ←←→→, começo do vídeo) todos exatos.
      `CACHE`: `v57` → **`v58`**.

### Sessão 2026-08-03 (30ª rodada) — Modularização + Ditado + Shadowing + Legenda criada pela IA
81. **Pedido**: "crie todos esses [Whisper de episódio inteiro, ditado, shadowing] seguindo as
    boas práticas que você mencionou" — ou seja, a faxina ANTES das funcionalidades.
    - **MODULARIZAÇÃO**: `js/video.js` (2.194 linhas) virou 4 módulos por responsabilidade:
      `video.js` (núcleo: estado, player, overlay, transcript, retomada, conserto de áudio),
      `video-subs.js` (parser, busca/addons, trilha PT, traduções, export, TRANSCRIÇÃO IA),
      `video-sync.js` (painel Sync, Whisper 2 pontos, correção progressiva, candidatas),
      `video-study.js` (seleção, foco, marcadores, card com áudio real, DITADO, SHADOWING).
      `_LAZY.video` virou ARRAY (carga sequencial — o estado vive no 1º); `_loadScript`
      ganhou 1 retry com cache-buster (cobre a janela de troca do service worker num deploy —
      corrida que sempre existiu para add.js/study.js). sw.js casa `/js/video` por prefixo.
      Split validado: 4 módulos carregam, todas as funções presentes, byte-total preservado.
      ⚠️ Falso-bug de dev pego no caminho: o servidor python antigo servia um core.js VELHO
      (handle do OneDrive) — a MESMA URL devolvia conteúdos diferentes; reiniciar o servidor
      resolveu. Em produção não existe: todo deploy sobe a versão do cache.
    - **DITADO** (custo zero): no estudo focado, antes de revelar a fala — "escreva o que
      ouviu" → correção por alinhamento palavra a palavra (LCS): verdes = pegou, vermelhas =
      o ouvido perdeu (CLICÁVEIS → Revisar), "escreveu a mais" listado, score %. Corrigiu =
      fala se revela. Validado: erros plantados ("torch"→"port", "spoken" omitido) foram
      exatamente os apontados (87%).
    - **SHADOWING** (centavos): após revelar a fala — grava a imitação pelo microfone,
      Whisper transcreve a SUA voz, mesmo diff → "X% das palavras saíram claras" + lista do
      que a IA não reconheceu; Ouvir você / Ouvir a cena / Gravar de novo. Validado o score
      com gravação falsa + Whisper stubado; o caminho do microfone real fica para o uso.
    - **LEGENDA CRIADA PELA IA** ("Criar com IA" no transcript vazio, ~R$ 1,50/45min, com
      confirmação de custo em reais): ffmpeg local extrai o áudio (mono 16kHz 48kbps — 1h
      cabe numa chamada; acima disso fatia por tempo), Whisper devolve segmentos com tempos,
      cues aplicadas — nasce sincronizada por construção. Validado com ffmpeg REAL no vídeo
      sintético + Whisper stubado: 5 falas aplicadas, DOM e IDB corretos (inclusive a trava
      de sanidade <5 falas disparando no stub pequeno — comportamento certo).
    - **Fullscreen consertado** (feedback do meio da rodada): o `max-height:56vh` do player
      (ID) vencia a regra de tela cheia (classe) — vídeo pequeno com vão embaixo. Regra nova
      com ID: `.vid-stage:fullscreen #vid-player` a 100vw/100vh. Legenda continua sobre o
      vídeo, como o Djemeson pediu.
    - 0 erros nas telas. `CACHE`: `v55` → **`v57`** (v56 intermediário).

### Sessão 2026-08-03 (29ª rodada) — Correção PROGRESSIVA de deriva (o caso dos 9 segundos)
80. **O Djemeson travou**: a melhor legenda tinha ~9s de atraso; o sync disse "ajustei o
    começo, vai derivar adiante" mas o começo continuou torto; ele tentou ±9s na mão e piorou.
    Três causas encontradas:
    - **Rótulo INVERTIDO**: "adiantada"/"atrasada" trocados na mensagem (mediana>0 = cue
      depois da fala = ATRASADA) — por isso o ajuste manual dele foi no sentido errado.
    - **"Ajustei o começo" mentia**: a âncora era o trecho mais falado da 1ª METADE (podia
      ser o minuto 20). Janelas reancoradas: 1ª nos primeiros 30%, 2ª nos últimos 45%.
    - **Deriva não se conserta com deslocamento constante** — nasceu a **correção
      PROGRESSIVA (linear)**: com o desvio medido em 2 pontos, a legenda inteira é reescrita
      com o desvio interpolado no tempo (framerate/versão = deriva linear na prática);
      reavaliação grátis contra as mesmas transcrições confirma, senão desfaz e cai para as
      candidatas. Validado com deriva plantada 3,5s→8,1s: legenda inteira a ≤50ms do áudio
      (início, meio e fim), 8/8 falas confirmadas.
    - Extras: botões manuais ±5s no painel Sync; mensagem conta PONTOS MEDIDOS (não janelas
      abertas — "verificado em 2 pontos" com 1 amostra vazia era desonesto).
      `CACHE`: `v54` → **`v55`**.

### Sessão 2026-08-03 (28ª rodada) — Legenda AUTOMÁTICA na abertura (zero cliques)
79. **Pedido**: "na primeira vez preciso clicar no botão de legenda e selecionar — quero que
    seja automático, sem eu fazer nada".
    - **`_vidAutoSub()`**: ao abrir um vídeo SEM legenda salva, roda sozinho: título limpo +
      SxxExx do nome do arquivo → Cinemeta confirma (nome normalizado tem que bater EXATO,
      senão para e aponta o botão manual — sem adivinhar) → `_vidFetchSubs` lista nos addons
      (com moviehash) → melhor legenda da LÍNGUA DO VÍDEO (`VID_LANG3`) → aplica → a trilha
      PT-BR vem atrás sozinha. Toasts em cada desfecho (achou / título incerto / sem episódio
      no nome / nada nos addons / falhou).
    - **Refatoração para reuso sem modal**: o miolo de `videoSubListLoad` virou
      `_vidFetchSubs(meta, temporada, episodio)` (também atualiza as candidatas persistidas)
      e o de `videoSubDownload` virou `_vidApplySubUrl(sub)` — modal e automático usam as
      mesmas peças.
    - **Vão pego no teste**: `_vidAutoFetchPT` lia a lista DO MODAL (`_vidSubState.subs`) —
      no fluxo automático o modal não existe e a trilha PT não vinha. Agora cai para as
      candidatas persistidas.
    - **Validado com rede REAL, zero stub**: arquivo novo "The.White.Lotus.S01E01...RARBG"
      aberto sem nenhuma legenda salva → **1020 falas aplicadas sozinhas** ("Hawaiian Flight
      451 to Honolulu" é a abertura real do episódio), 40 candidatas guardadas para o sync,
      e a trilha PT-BR (774 cues) alinhada em **851/1020 falas** ("Voo 451 da Hawaiian Air
      para Honolulu..."). 0 erros nas telas. `CACHE`: `v53` → **`v54`**.

### Sessão 2026-08-03 (27ª rodada) — Candidatas sem teto, tela cheia com legenda e pular ±5s
78. **Três pedidos do Djemeson na sequência** (White Lotus S01E01 como caso real):
    - **"Só 5 alternativas testadas, mas a lista tinha mais"** — certíssimo: o teto de 5 era
      arbitrário (`.slice(0,5)`) e as candidatas guardadas paravam em 15. Agora TODAS as
      candidatas da mesma língua são guardadas (até 40) e testadas — cada teste custa 1
      download + matching local (a transcrição do Whisper é reaproveitada). E nasceu o
      segundo nível que faltava: se nenhuma casa PERFEITAMENTE, a IA adota a **menos
      derivada** quando ela é ao menos 1s melhor que a atual (`parcial`, com o começo
      ajustado e aviso honesto). Validado ao vivo: a candidata boa na POSIÇÃO 7 foi
      encontrada e adotada (o teto antigo a deixava de fora). Nota: o ramo "menos ruim" usa
      o mesmo `_vidAdoptSub` do ramo validado, mas seu gatilho não foi exercitado ao vivo.
      ⚠️ Para o sync usar a lista completa num vídeo antigo, refazer "Buscar legenda" uma vez
      (atualiza as candidatas guardadas).
    - **"Em tela cheia a legenda não aparece"** — o botão nativo do player põe só o <video>
      em fullscreen, onde overlay nenhum entra. Dois caminhos: botão próprio **"Tela cheia"**
      (fullscreen no `.vid-stage` — o overlay interativo vai junto, dá para SELECIONAR
      palavra em tela cheia) e, para o botão nativo, uma **trilha de legenda nativa**
      (TextTrack/VTTCue, EN + PT quando "PT ao vivo" está ligado, `cue.line=-3`) ligada
      automaticamente no fullscreenchange. Validado: trilha com EN+PT montada; as transições
      de fullscreen em si exigem gesto do usuário (não automatizável — conferir no uso real).
    - **"Não tem botão de avançar/voltar segundos"** — botões flutuantes **−5s/+5s** sobre o
      vídeo (aparecem no hover, valem em tela cheia) + setas **←/→** do teclado (guardas:
      não em inputs, não quando o player nativo tem foco). Validado ao vivo: pulo por botão
      e por teclado.
    - `CACHE`: `v51` → **`v53`** (v52 intermediário na mesma rodada).

### Sessão 2026-08-03 (26ª rodada) — Continuar de onde parou (+2 bugs achados pelo teste)
77. **Pedido**: reabrir o mesmo arquivo deve carregar a legenda com as modificações e retomar
    exatamente de onde parou ("nem sempre vou acabar o vídeo no mesmo dia").
    - **A legenda já persistia** (IDB por vídeo, casado por nome+tamanho do arquivo) — mas o
      teste do fluxo achou um **bug de perda de dados real**: o save é debounced (1,5s) e
      `videoBackToLib`/troca de vídeo anulava `_vidCur` ANTES do timer — o guard abortava o
      save e a última mudança de legenda EVAPORAVA. Agora há flush (`_vidSaveSubsNow`) na
      saída do player, na troca de vídeo, no `beforeunload` e no `visibilitychange`.
    - **Retomar posição**: `v.position` gravada a cada ~5s de reprodução (localStorage; sem
      spam de sync) + no pause/saída; ao reabrir, retoma com **2s de recuo** para contexto e
      toast "Retomando de 12:31". Perto do fim (<20s) não retoma; 'ended' zera. A biblioteca
      mostra "parou em 12:31" em cada vídeo.
    - **Bug 2 (alinhador PT em caso degenerado)**: com pouquíssimas falas, vários offsets
      empatavam e a varredura ficava com o PRIMEIRO (−15s) — a tradução ia para a fala errada.
      Desempate por |off| menor + exigência de evidência mínima (senão off=0).
    - Validado ao vivo em duas "sessões" com o mesmo arquivo: legenda com shift −0,3s,
      tradução IA e trilha PT voltaram intactas; retomou em 14,9s (17−2); "parou em 0:17" na
      biblioteca; saída rápida do player não perde mais nada; 0 erros.
      `CACHE`: `v50` → **`v51`**.

### Sessão 2026-08-03 (25ª rodada) — Seleção na legenda do vídeo + botões de traduzir consertados
76. **Dois pedidos do Djemeson**:
    - **Selecionar palavra OU TRECHO na legenda sobre o vídeo**: a linha EN do overlay deixou
      de ser só exibição (`user-select:text`, clique pausa o vídeo). Arrastou (ou clique
      duplo) → popup com o trecho e duas saídas: **"Estudar com áudio"** (card completo com o
      áudio real da cena — `videoCreateCard` ganhou parâmetro de alvo explícito) e
      **"Revisar"** (`createWord` pending_ai com a fala como contexto, como o garimpo do
      estudo). Popup fecha quando a fala muda; overlay congela enquanto ele está aberto (a
      seleção não é destruída pelo re-render).
    - **"Botões de traduzir não funcionam todos"** — dois defeitos de percepção reais:
      (1) tradução pedida explicitamente (botão `pt` da fala, PT do trecho) aparecia
      **BORRADA** (o recall blur valia para tudo) — parecia que nada acontecia; agora pedido
      explícito = `.show`, sem blur (o blur fica só para o modo recall global);
      (2) o PT do trecho selecionado só aparecia no transcript — agora aparece **no próprio
      painel de seleção**, deduplicado.
    - Validado ao vivo: `pt` da fala visível sem blur; PT do trecho no painel; overlay
      selecionável; popup com os 2 botões; "Revisar" criou pending_ai com contexto/fonte;
      "Estudar com áudio" com trecho de 3 palavras ("tribe has spoken") → card in_srs com
      exemplo em negrito, clipId e áudio webm real; 0 erros nas telas.
      `CACHE`: `v49` → **`v50`**.

### Sessão 2026-08-03 (24ª rodada) — Alinhador PT v2: offset entre trilhas + fusões
75. **Print do Djemeson (Marshals S01E01)**: a tradução PT aparecia na fala ERRADA e duplicada
    no estudo focado. Ele perguntou se era a legenda PT-BR ou a IA — **era a legenda PT-BR
    oficial alinhada** (a IA só traduz onde é pedida); os dois defeitos eram do alinhador v1:
    - **A trilha PT vem de OUTRA release com timing deslocado** — o v1 alinhava pelo ponto
      médio SEM estimar o deslocamento entre as trilhas, então a tradução caía na vizinha.
      O v2 (`_vidAlignPTTrack`) estima o offset global em 3 passos: varredura grossa (±15s,
      passo 0,5s) + fina (0,1s) maximizando falas EN contidas em cues PT, e **refino pela
      mediana dos deltas de início** (a varredura fica com o primeiro empate — viés para
      baixo que o teste pegou: a última fala caía no cue vizinho).
    - **Legendas PT fundem 2 falas EN num cue só** — o mesmo texto vale para as duas. Na
      exibição: o estudo focado deduplica consecutivos, e o transcript mostra
      "⤷ (mesma tradução da fala acima)" na segunda em vez de repetir.
    - **Fonte visível**: a linha PT ganhou `title` dizendo se veio "da legenda PT-BR
      (alinhada)" ou "traduzido por IA".
    - **Dados antigos se corrigem sozinhos**: o realinhamento roda a cada abertura do vídeo
      (<50ms) — o Marshals dele conserta na próxima visita, sem ação manual.
    - Validado ao vivo com o cenário do print (trilha PT +3s com fusão): **6/6 falas no PT
      certo**, fusão única no foco, seta no transcript. `CACHE`: `v48` → **`v49`**.

### Sessão 2026-08-03 (23ª rodada) — .srt sincronizado para download + IA troca legenda de versão errada
74. **Dois pedidos do Djemeson**:
    - **"Baixar .srt" com a sincronização aplicada** (painel Sync): serializa as falas JÁ
      DESLOCADAS em SRT válido (CRLF + BOM) com o **mesmo nome do arquivo de vídeo** — na
      mesma pasta, qualquer player externo carrega sozinho. Botão extra para a trilha PT-BR
      alinhada (`.pt-BR.srt`). Validado: blob reparseia com 25 falas e tempos sincronizados.
    - **Legenda de VERSÃO ERRADA (deriva no meio)**: ele diagnosticou certo — offset constante
      a IA resolvia, deriva não. E pediu para ver o nome do release da legenda; **análise
      honesta: o protocolo dos addons só devolve `{id, lang, url}` — o nome NÃO existe na
      resposta** (e a página do OpenSubtitles que o teria bloqueia navegador). Então foi feito
      o que ele sugeriu como alternativa: **a IA reconhece e troca sozinha**:
      · `videoSyncAuto` agora amostra **2 pontos** do episódio (1º e 2º terço, janelas de
        maior densidade de fala em cada metade) quando o vídeo > 4min;
      · `_vidAvaliaLegenda` mede matched/mediana/**spread** (entre amostras) e **disp**
        (dispersão INTRA-amostra, aparada — pega deriva até com uma janela só; achado do
        teste: só o spread deixava passar deriva dentro da mesma janela);
      · consistente (spread ≤ 0,7s e disp ≤ 1,5s) → aplica a mediana como antes;
      · **derivou → testa as CANDIDATAS** da última busca (mesma língua, até 5, guardadas no
        IDB com a URL aplicada) contra as MESMAS transcrições — custo extra ZERO — e adota a
        primeira que casa de ponta a ponta, substituindo a legenda salva + ajuste fino;
      · nenhuma casou → ajusta só o COMEÇO (mediana da 1ª metade da 1ª amostra, não a mediana
        contaminada pela deriva) e avisa que vai dessincronizar adiante.
    - **Validado ao vivo com deriva plantada** (2 falas a +1s, 2 a +3,3s) e 3 candidatas
      (a aplicada, uma de outro episódio e uma boa a +0,8s constante): detectou a deriva,
      rejeitou o lixo, **adotou a boa, aplicou −0,8s** e a 1ª fala caiu exata no áudio;
      candidatas + URL aplicada persistidas no IDB; 0 erros de console.
      `CACHE`: `v47` → **`v48`**.

### Sessão 2026-08-03 (22ª rodada) — Sync com IA: acha sozinho o trecho falado + destrava após falha
73. **Bug relatado pelo Djemeson**: a IA amostrou um trecho com poucas falas, deu erro pedindo
    um trecho com mais fala, **o botão ficou desativado** e, ao recarregar, amostrava o MESMO
    trecho. Três causas, três correções:
    - **Ponto de amostra era fixo** (sempre a 10ª fala). Agora `_vidBestSampleStart(dur)`
      desliza uma janela pela legenda e escolhe a de **maior densidade de fala** (soma da
      duração das falas) — a densidade sobrevive a legendas fora de sincronia porque o desvio
      típico é de segundos. O status mostra onde a amostra foi tirada ("a partir de 12:31 — o
      trecho mais falado").
    - **Botão travado após falha**: o painel era re-renderizado DENTRO do catch, quando
      `_vidSyncing` ainda era true — o botão nascia desabilitado e ficava. O re-render foi
      para o `finally`, DEPOIS de liberar a trava.
    - **Último recurso — "IA do ponto atual"**: botão novo; o usuário leva o vídeo até um
      diálogo, pausa e a IA analisa dali (`videoSyncAuto(45, currentTime)`). A mensagem de
      falha agora aponta para ele.
    - **Validado ao vivo** com legenda de densidades desiguais: a janela caiu no bloco denso
      (não no "Hm." inicial); falha com Whisper stubado vazio → botões HABILITADOS + mensagem
      honesta; "do ponto atual" com desvio plantado de −1,0s → detectou e corrigiu exato
      (3 falas casadas). `CACHE`: `v46` → **`v47`**.

### Sessão 2026-08-02 (21ª rodada) — Marcador em ciclo + sincronização com IA
72. **Dois pedidos do Djemeson**:
    - **Marcador em CICLO** ("clica marca o começo, clica de novo marca o fim, e é esse trecho
      que vai pro estudo focado"): o 1º M/clique abre o trecho (botão vira "Fechar trecho" e
      pulsa em âmbar), o 2º fecha e **abre o estudo focado direto** naquele intervalo. O
      marcador agora é um INTERVALO `{a,b}` (os antigos, de ponto, seguem funcionando); a
      lista mostra `12:31 → 12:39 (8s)` com botão "estudar". `videoFocusRange(a,b)` acha as
      falas que o trecho toca e as bordas marcadas vencem quando são mais largas que as falas.
      Trecho < 0,8s = marcação cancelada (anti-clique-duplo).
    - **Sincronização da legenda** (pediu "algo mais poderoso, sincronização automática com
      IA — faça acontecer"): botão **"Sync"** no toolbar abre o painel com ajuste manual
      (±0,1s/±0,5s, indicador do deslocamento acumulado em `v.subShift`, desloca EN e trilha
      PT juntas) e **"Sincronizar com IA"**: grava ~45s do áudio REAL (captureClipAudio — usa
      o áudio consertado quando existe), transcreve com **Whisper** (`verbose_json`, timestamps
      por segmento), casa cada segmento com a fala mais parecida da legenda (tokens
      normalizados, score ≥ 0,5, janela ±60s) e aplica a **mediana** dos desvios (≥3 falas
      casadas; senão falha com mensagem honesta e aponta para o manual). Desvio < 150ms =
      "já está em sincronia". Custo ~R$ 0,03 por uso — abaixo do limiar de confirmação.
    - **Validado ao vivo**: ciclo abre/fecha → foco com 2 falas e bordas do usuário; lista de
      trechos; shift manual com indicador; auto-sync com dessincronia PLANTADA de +2,0s e
      Whisper stubado → detectou 2,0s exatos, corrigiu as 4 falas, `subShift = −2`; ciclo
      aberto sobrevive à troca de seção; 0 erros de console. `CACHE`: `v45` → **`v46`**.

### Sessão 2026-08-02 (20ª rodada) — Player de verdade: legenda no vídeo, PT simultâneo e estudo focado
71. **Feedback do Djemeson em 4 pontos** (+1 mensagem no meio da rodada), tudo construído:
    - **Busca de legenda SEM fricção**: com título limpo + SxxExx detectados do nome do
      arquivo, "Buscar legenda" vai DIRETO para a lista do episódio (auto-pick quando o 1º
      resultado do Cinemeta bate com o nome normalizado) — sem escolher série, sem confirmar
      episódio. Limite honesto documentado: o protocolo dos addons NÃO devolve o nome do
      release de cada legenda; a correspondência exata vem do moviehash na consulta.
    - **Legenda em TEMPO REAL sobre o vídeo** (`.vid-stage` + overlay): a fala corrente
      aparece sobre o vídeo (toggle "Legenda"), estilo player de verdade.
    - **Tradução simultânea em camadas** (pedido da mensagem do meio): ao aplicar uma legenda
      EN, o app busca sozinho a legenda **PT-BR do mesmo episódio** nos addons e alinha por
      tempo (`cue.pts`, ponto médio ±1,2s) — tradução OFICIAL, custo zero. Validado com dados
      reais: **614 de 769 falas alinhadas** ("What have you done?" → "O que você fez?").
      A IA (`cue.pt`) é a camada ADICIONAL: "PT ao vivo" traduz com a chave OpenAI as falas
      que não têm trilha (lookahead corrente+3), centavos por episódio. Preferência de
      exibição: pt (IA explícita) > pts (oficial).
    - **Tradução no transcript e no trecho**: botão `pt` por fala (hover; revela a alinhada ou
      traduz via IA) e o botão PT do painel de seleção agora usa a trilha alinhada primeiro.
      O antigo toggle "PT" (que parecia morto quando não havia tradução nenhuma) virou
      **"PT ao vivo"** com feedback claro em todos os estados.
    - **ESTUDO FOCADO** (o que o Djemeson esperava do marcador): trecho → escuta às cegas
      ("Ouça sem ler...") → **Mostrar a fala** (palavras clicáveis) → **Mostrar a tradução**
      (alinhada ou IA) → salvar card com áudio real — com Ouvir de novo, 0.75×, loop.
      Entradas: botão "Estudo focado" no painel de seleção e botão "estudar" em cada marcador.
      Salvar card no modo focado NÃO fecha o trecho.
    - Persistência: `subs` no IDB agora guarda `{cues (com pt/pts), cuesPT}`, com save
      debounced e limpeza de campos transitórios. `CACHE`: `v44` → **`v45`**.
    - Validado ao vivo com o episódio real: 1 clique → 40 legendas de HotD S03E02, EN aplicada,
      PT-BR alinhada em background, overlay com as duas linhas, foco completo (cego → fala →
      tradução → 4 palavras clicáveis), botão pt por fala, marcador → foco, persistência
      conferida no IDB, 0 erros de console.

### Sessão 2026-08-02 (19ª rodada) — Legenda via addons do Stremio + conserto de áudio Dolby
70. **Dois pedidos**: "o Stremio tem addons de legendas — não seria possível aceitar esses
    addons?" e "esse episódio veio sem áudio, faça funcionar:
    House.of.the.Dragon.S03E02...x265-MeGusta.mkv".
    - **Addons do Stremio: SIM, e melhor que o plano original.** O protocolo é aberto
      (`/manifest.json` + `/subtitles/{tipo}/{imdbId}.json`) e **tem CORS** (o Stremio Web roda
      em navegador) — a função serverless da fase 3 ficou DESNECESSÁRIA. Novo botão
      **"Buscar legenda"** no player: busca o título no Cinemeta (catálogo público), detecta
      SxxExx do nome do arquivo, consulta os addons (OpenSubtitles v3 por padrão + campo para
      colar QUALQUER addon de legendas do Stremio, sincronizado em `cfg.subAddons`), calcula o
      **moviehash** do arquivo (BigInt, primeiros/últimos 64 KB) para o addon priorizar a
      legenda certa, baixa e aplica. **Validado com dados reais ao vivo**: "House of the
      Dragon" achado no Cinemeta, **40 legendas do S03E02**, 769 falas importadas.
    - **Encoding na base da evidência**: além do UTF-8×1252 (menos lixo vence), as legendas
      chegam às vezes **duplamente encodadas DA ORIGEM** (bytes UTF-8 soletrando "â™ª") —
      `_vidFixMojibake()` reverte via tabela windows-1252 e mantém o original se piorar.
      Selo "sincronia exata" foi REMOVIDO: a resposta do addon não diz quais bateram no hash.
    - **MKV sem áudio (o caso MeGusta)**: áudio Dolby/DTS (EAC3) toca MUDO no Chrome (codec
      sem licença). Solução: **ffmpeg.wasm hospedado no PRÓPRIO site** (`js/vendor/ffmpeg/`,
      ~31 MB — CDN não funciona: o worker do ffmpeg tem imports relativos que quebram
      cross-origin, TESTADO e travou). Detector automático (`webkitAudioDecodedByteCount === 0`
      após 1,5s tocando) mostra o banner "Consertar áudio": monta o arquivo via **WORKERFS**
      (leitura sob demanda — um MKV de 2 GB NÃO passa pela heap do wasm), extrai a faixa
      (`-vn -c:a aac 128k`), salva o m4a no IndexedDB (store `media`, v2 do `el-video-db`) e
      toca num `<audio>` paralelo sincronizado ao vídeo mudo (deriva medida: 10–20ms; correção
      automática acima de 300ms). Feito 1×, fica salvo. `captureClipAudio` captura do áudio
      consertado quando ele existe — cards com áudio real continuam funcionando.
    - **sw.js**: cache SEPARADO e permanente `englab-ffmpeg-v1` (31 MB não podem ser reapagados
      a cada versão do shell) + `strem.io` em NETWORK_ONLY. `CACHE`: `v43` → **`v44`**.
    - Validado ao vivo: fluxo completo de legenda com episódio real, conversão de áudio
      integrada (banner → progresso → chip "áudio consertado"), reanexação automática ao
      reabrir, sincronização, 0 erros nas 8 telas.

### Sessão 2026-08-01 (18ª rodada) — FASE 1 DO VÍDEO implementada (seção nova + 6 ideias)
69. **Pedido**: "faça você um backup e logo depois execute a fase 1" + "implemente as ideias
    que você deu — o que couber na fase 1". Entregue e validado ao vivo com vídeo sintético
    (canvas + oscilador via MediaRecorder) e fetch stubado — zero dólar gasto no teste.
    - **Backup**: a extensão do Chrome não estava conectada, então os DADOS reais (browser
      logado + Firestore) ficaram fora de alcance — o que coube foi (a) tag git
      **`pre-video-fase1`** (rollback de código instantâneo) e (b) **`exportData()` virou
      backup completo**: antes só words+cfg; agora inclui srsCards/srsLog/srsDecks/srsCfg/
      conversas/videos/clips. ⚠️ Djemeson: um clique em Configurações → Exportar agora vale
      como backup de verdade.
    - **Nova seção "Vídeo"** (`js/video.js`, LAZY): biblioteca de vídeos → player + transcript.
      O ESTADO `videos[]`/`clips[]` vive em **core.js** (não-lazy) porque firebase.js os
      sincroniza (docs `data/videos` e `data/clips`) — armadilha nº 1 respeitada. Legendas
      ficam LOCAIS (IndexedDB `el-video-db`, stores `handles`+`subs`); o arquivo de vídeo
      nunca sobe e o handle (File System Access) é lembrado entre sessões no Chrome/Edge.
    - **O que funciona** (tudo verificado ao vivo):
      · abrir vídeo local (picker com handle persistido + fallback `<input type=file>`);
      · importar `.srt`/`.vtt` (parser tolerante: CRLF/BOM, tags `<i>`/`{\\an8}` removidas);
      · transcript karaokê (fala corrente destacada + rolagem automática com toggle);
      · fala clicável = seleção; estender ±fala, ajuste fino ±0,5s, loop A–B;
      · **card com o áudio REAL da cena**: captureStream+MediaRecorder grava o trecho (toca
        em tempo real), 1 chamada de chat analisa o sentido NA CENA, o exemplo do card É a
        fala com `<b>`, e o áudio entra sob `audioKey(example_en CRU — com as tags <b>)`.
        ⚠️ Descoberta da rodada: o pipeline INTEIRO (playSrsTTS/preGenerateAudio) chaveia o
        áudio pelo texto COM tags — a chave "limpa" nunca seria encontrada.
      · **"Preparar para assistir"**: cruza a legenda com words[] (stoplist EN + flexões
        triviais), lista as desconhecidas por frequência, manda as marcadas para Revisar e
        grava a **cobertura** (% conhecido) no vídeo — aparece na biblioteca;
      · **marcadores** (tecla M ou botão) → lista com a fala da legenda → vira seleção;
      · **tradução por fala** cacheada no cue, exibida BORRADA até o hover (recall);
      · **"Rever a cena"** no verso do card de estudo (`card.clipId` → `reverCena()` no core
        → video.js consome `_pendingClipPlay`); toca só o trecho e para no fim.
    - **Bugs pegos na validação**: duração `Infinity` de webm do MediaRecorder persistida
      (guard `isFinite`); "rever a cena" pedindo o arquivo mesmo com o File na memória
      (vinha da view Preparar); hot-reload de módulo lazy com `let` top-level não re-executa
      (limitação de teste, não do app).
    - **Integrações mínimas fora do módulo**: `study.js` só ganhou o botão "Rever a cena";
      sync ganhou 2 docs aditivos; `sw.js` serve video.js network-first como os outros lazy.
    - Vídeo NÃO está na barra inferior do celular (decisão: notebook); 0 overflow nas 8 telas.
      `CACHE`: `englab-v42` → **`englab-v43`**.

### Sessão 2026-08-01 (17ª rodada) — Estudo de escopo: vídeo + legendas (SEM código ainda)
68. **Pedido**: analisar uma funcionalidade nova — adicionar vídeo (série/filme) com legenda,
    criar legenda do zero, buscador automático de legenda, quebrar o vídeo em pedaços e levar
    cortes exatos para o estudo — "vá muito além do que eu disse".
    - **Entrega: [`PLANO-VIDEO.md`](./PLANO-VIDEO.md)** — análise completa de viabilidade,
      arquitetura proposta, custos, 4 fases e ideias complementares. Resumo das conclusões:
      · As 4 coisas pedidas são viáveis NO NAVEGADOR. Princípio estrutural: **o vídeo nunca
        sobe para o Firebase** (300 MB–2 GB × limite de 1 MB/doc) — sincronizam legenda,
        clipes `{início,fim}` e áudios pequenos dos cortes (mecanismo de sync de áudio já
        existe). O Djemeson confirmou: o vídeo é descartável depois da extração.
      · Cortes = **virtuais** (`currentTime`), sem processar nada; a legenda é o picotador.
      · Arma secreta: card SRS com o **áudio real da cena** (captureStream + MediaRecorder)
        no lugar do TTS.
      · Ideia de maior valor/esforço: **"Preparar para assistir"** — cruza a legenda inteira
        com `words[]` e apresenta as palavras desconhecidas ANTES do episódio.
      · Busca automática de legenda exige 1 função serverless na própria Vercel (CORS);
        alternativa zero-infra é semi-manual.
      · Whisper de episódio inteiro é o único ponto pesado no browser (ffmpeg.wasm);
        é o argumento real para um futuro app desktop (Tauri com o MESMO código web,
        sync de graça) — decisão adiada, navegador primeiro.
    - **Decisões tomadas na mesma sessão** (todas na recomendação): vídeos = arquivos locais;
      aparelho do vídeo = notebook; função serverless na Vercel = aceita (fase 3); MVP =
      player + importar .srt + transcript clicável + cortes A–B + card com áudio real da cena
      + "Preparar para assistir". Próximo passo: implementar a fase 1 do plano.

### Sessão 2026-08-01 (16ª rodada) — Estudar parava de transbordar no celular
67. **Pedido**: corrigir o transbordo horizontal que eu tinha achado (e confirmado na versão
    publicada) na tela Estudar a 375px — a página rolava **63px** para o lado.
    Duas causas, as duas do tipo "grid/tabela que não encolhe":
    1. **`.srs-dashboard` era `repeat(3,1fr)`** — e `1fr` é `minmax(AUTO,1fr)`: os rótulos
       ("PARA REVISAR HOJE", "NOVOS DISPONÍVEIS") seguravam cada coluna acima de 1/3 e as três
       somavam **373px num container de 310px**. Existia uma regra de 2 colunas no bloco mobile,
       mas era **letra morta**: a declaração de 3 colunas vem DEPOIS no arquivo com a mesma
       especificidade e vencia mesmo no celular. Agora é `minmax(0,1fr)` (o track pode encolher)
       e, abaixo de 700px, o cartão perde 24px de padding e o rótulo usa `--fs-3xs`.
       Resultado: 3 cartões de 98px a 375px e de 79px a 320px, com o texto legível.
    2. **`.srs-deck-table` tem 393px de largura mínima** (cinco colunas de números) dentro de um
       cartão de 347px, e o wrap estava com `overflow` visível — quem rolava era a **página**.
       Agora `.srs-deck-table-wrap{overflow-x:auto}`: a tabela rola dentro do próprio cartão.
    > Lição: `1fr` não é "um terço" — é "no mínimo o conteúdo". Em grade de cartão com rótulo
    > por extenso, `minmax(0,1fr)` é o que realmente divide a largura.
    - **Validado ao vivo**: **0 de scroll horizontal nas 7 telas a 320px e a 375px** (era 63px),
      tabela rolando dentro do cartão (83px de scroll interno), desktop intacto (padding 20px,
      número 40px, 3 colunas de 355px, tabela sem barra) e 0 erros de console.
      `CACHE`: `englab-v41` → **`englab-v42`**.

### Sessão 2026-08-01 (15ª rodada) — Dashboard: 443px de moldura antes do primeiro dado
66. **Pedido**: "ao entrar na dashboard tenho a impressão de que o espaço não está sendo bem
    aproveitado... informação sendo cortada, botões muito grandes e cabeçalhos grandes
    empurrando outras informações pra baixo."
    - **Medido a 1640×900**: **443px** (49% da tela) de cabeçalho + hero + métricas + abas antes
      do primeiro dado — por isso a linha de estatísticas do calendário aparecia cortada na
      dobra. E a seção parava em **1180px** com **1336px** de área útil disponível.
    - **Vertical (443 → 347px, −22%)**:
      · cabeçalho 80 → 65px (título `--fs-xl` → `--fs-lg`, margens 26/16 → 18/12);
      · hero 117 → 81px (padding 24 → 16, número `--fs-3xl` → `--fs-2xl`);
      · métricas 80 → 64px (padding 16 → 12, ícone 42 → 36, valor `--fs-xl` → `--fs-lg`);
      · abas e respiros 22/18/20 → 16/14/14.
    - **Horizontal**: `#section-dashboard` vai a **1336px** e, acima de 1280px, o `.dash-grid`
      vira **2fr 1fr** — a coluna do calendário é a que converte largura em informação. Efeito
      colateral bom: com 873px de coluna o heatmap volta a mostrar **52 semanas** (o ano
      inteiro), sem barra de rolagem, o que a 14ª rodada tinha reduzido a 39.
    - **O hero agrupava mal**: `justify-content:space-evenly` jogava "123 revisões" e "50 novos"
      para as pontas — o vazio tinha saído do meio do cartão e ido parar ENTRE os números.
      Agora os dados andam juntos e só o botão vai para a direita.
    - **Botão principal**: a sombra de 18px a 40% (brilho de template) virou 8px a 22%.
    - **Colunas do painel Progresso reorganizadas por ALTURA medida**: com [calendário + volume]
      à esquerda e só a taxa de acerto à direita, a coluna da direita terminava **653px** antes
      da outra. Trocando a taxa de acerto (cartão baixo) para junto do calendário, a diferença
      cai para ~220px.
    - **Cabeçalho de cartão em coluna estreita**: o `space-between` espremia o título contra o
      valor da direita e "Volume de Estudos" quebrava em duas linhas, empurrando o gráfico para
      baixo. Com `flex-wrap`, quem desce uma linha é o valor — o dado secundário.
    - ⚠️ **O cabeçalho compacto vale para as 7 telas**, não só para o Dashboard: um título que
      encolhe ao entrar numa aba e cresce na outra seria uma inconsistência visível a cada
      clique. As outras seis ganham os mesmos ~40px.
    - **Validado ao vivo** em 1640×900 e 1280×860: painel inteiro cabendo na tela (879px de
      página para 860px de viewport, contra 1225px antes), 0 erros de console, 0 scroll
      horizontal, heatmap sem barra, e as 6 outras telas mantendo largura e layout próprios.
      `CACHE`: `englab-v40` → **`englab-v41`**.

### Sessão 2026-08-01 (14ª rodada) — Heatmap volta para a coluna; quem encolhe é o histórico
65. **Correção do rumo da 13ª rodada**: eu tinha resolvido a barra de rolagem alargando o cartão
    para a seção inteira. O Djemeson recusou — *"vc ocupou toda a seção em que ele está. não
    quero isso. deixa como era antes. vc pode resolver o problema inicial removendo meses pra
    trás."* Correto: a barra era o problema, o layout não.
    - **Layout revertido**: o cartão voltou para a coluna `1.7fr` do `.dash-grid`, junto com
      "Volume de Estudos", e "Taxa de acerto" na coluna da direita — exatamente como era.
    - **O que resolve agora é o histórico**: a célula fluida e o `dashHmSemanas()` continuam,
      mas medindo a COLUNA (não a seção). Resultado medido: **39 semanas a 1440px, 40 a 1024px,
      17 a 375px** — em vez das 53 fixas. Perde-se de 3 a 8 meses de passado; ganha-se um
      calendário que cabe inteiro na tela, que era o pedido.
    - **`dashHmLarguraUtil()`**: mede o `.dash-hm-container` da renderização anterior (fonte
      exata); só na PRIMEIRA vez estima a coluna (`(painel-18)*1.7/2.7`, ou o painel inteiro
      abaixo de 1040px, onde o `.dash-grid` vira uma coluna só).
    - **`dashHmWrapHTML(semanas)` + `dashHmAjustar()`**: a grade foi extraída para uma função
      porque agora é montada DUAS vezes — uma com a estimativa e, se a medida real pedir outro
      número de semanas, reconstrói só o miolo da grade (não o painel).
    - ⚠️ **Bug de alinhamento que só a medição pegou**: com célula fluida, os rótulos
      Seg/Qua/Sex desciam ~0,9px por linha (**5,25px acumulados no "Sex" a 375px**). Causa: a
      coluna de rótulos era item flex e a altura MÍNIMA do texto (7 × 10,4px) inflava a linha
      para 113px enquanto a grade tinha 84px. `min-height:0` **não** resolve — o que conta para
      a altura da linha flex é o tamanho de CONTEÚDO do item, não o seu mínimo. Solução: tirar
      a coluna do fluxo (`position:absolute; top:23px; bottom:0`), onde ela não opina sobre a
      altura e fica amarrada exatamente à área da grade. Desalinhamento final: **0,01px** em
      1440/1024/375px.
    - **Validado ao vivo**: barra de rolagem = 0 nas três larguras, layout de 3 cartões idêntico
      ao original (699 + 699 + 411px a 1440), 28 células de previsão preservadas, ajuste
      sobrevivendo à troca de aba, 0 erros de console.
      `CACHE`: `englab-v39` → **`englab-v40`**.

### Sessão 2026-08-01 (13ª rodada) — Heatmap fluido: fim da barra de rolagem
64. **Pedido**: "existe uma barra pra poder arrastar pro lado e ver o restante. não quero que
    tenha a barra. analise como deixar mais funcional."
    - **Causa medida**: a grade tinha largura FIXA — 57 colunas × 14px = **795px** — dentro de
      uma coluna de **412px** (o cartão vivia no `1.7fr` do `.dash-grid`). Os 383px de diferença
      viravam barra de rolagem: metade do ano ficava atrás de um arrasto que ninguém dá. A
      previsão da 12ª rodada tinha sido remendada com `scrollLeft` no fim — remendo no sintoma.
    - **Três mudanças, nesta ordem**:
      1. **O cartão saiu da coluna e ocupa a largura toda** do painel (`dash-card-wide`);
         "Volume de Estudos" e "Taxa de acerto" continuam lado a lado embaixo. Um ano de dias
         nunca ia caber em 412px — a coluna estreita era o erro de origem.
      2. **Célula fluida**: `grid-template-columns: repeat(N, 1fr)` + `aspect-ratio: 1`.
         A grade passa a ocupar exatamente a largura disponível, qualquer que seja —
         **overflow deixa de ser possível por construção**, não por ajuste.
      3. **`dashHmSemanas()` decide quantas semanas cabem** (mede o painel, desconta padding/
         coluna de dias/gap, divide por um passo de 12–14px e limita a 53). A célula nunca
         fica menor que ~10px; o que varia é o tamanho da janela de histórico.
    - **Teto de 16px por coluna**: sem ele, poucas colunas numa tela larga viravam quadrados de
      35px (visto ao medir a 1440px antes do re-render).
    - **Rótulos de mês em `calc(% + px)`**: com célula fluida, `left` em px mentiria. A fórmula
      exata da posição da coluna i numa grade de N colunas `1fr` com gap g é
      `i/N*100% + i*g/N`.
    - **Seg/Qua/Sex acompanham a altura variável**: a coluna estica junto (`align-self:stretch`)
      e divide a altura em 7 partes iguais com o mesmo gap. Medido: **0px de desalinhamento**
      em 1440/1024/800px e 1–2px a 375px (arredondamento de subpixel).
    - **Listener de resize** (debounce 220ms) redesenha só quando o número de semanas que cabe
      muda — os `let` de estado ficam no TOPO do arquivo, pela lição do item 52 (zona morta).
    - **Validado ao vivo** em 1440 / 1024 / 800 / 375px: **barra de rolagem = 0 em todos**,
      célula 13 / 11,5 / 11,8 / 10px, janela de 53 / 40 / 24 / 17 semanas de passado + as 4 de
      previsão, última coluna dentro do container, sem scroll horizontal na página, previsão
      preservada (as últimas células continuam `fut`) e 0 erros de console.
      `CACHE`: `englab-v38` → **`englab-v39`**.

### Sessão 2026-07-31 (12ª rodada) — O heatmap passa a mostrar o que vem pela frente
63. **Pedido**: "no heatmap mostrar as previsões de cards a estudar nos dias à frente de hoje".
    O calendário terminava em hoje — era um retrovisor, e o SRS é justamente a promessa de que
    a carga de amanhã já está decidida.
    - **Janela**: 371 dias para trás + **28 dias (4 semanas) para a frente**
      (`DASH_HM_PAST` / `DASH_HM_FUT` em `js/dashboard.js`).
    - **`dashForecast(dias)`**: conta os cards já agendados por dia de vencimento.
      **Cards `new` ficam de fora de propósito** — não têm data marcada, entram pelo limite
      diário (`srsCfg.newPerDay`) no dia em que a sessão for aberta; contá-los inventaria carga
      num dia que o calendário não sabe qual é. Atrasados e o próprio hoje também não entram
      (hoje continua sendo o que foi REVISADO, e o bloco "Hoje" da sidebar já mostra o restante).
    - **Passado cheio, futuro vazado**: as células do futuro usam a mesma escala de volume
      (≤5 / ≤15 / ≤30 / +30), mas com anel em vez de preenchimento — carga prevista não pode
      ser lida como esforço já feito. Dia sem nada agendado continua na textura neutra, igual
      a um dia passado sem estudo. Medido nos 6 temas: o anel do nível 1 (1,50–1,82:1 contra o
      cartão) é **mais visível** que o preenchimento do nível 1 do passado (1,29–1,47:1), e o
      nível 4 bate exatamente com o passado (4,36–7,15:1) — as duas rampas têm o mesmo alcance.
    - **Hoje ganhou anel** (`--text2`): sem ele, a fronteira cheio|vazado sumia quando os
      últimos dias não tinham nem estudo nem previsão.
    - **Legenda** ganhou separador + "Previsto", e a linha de estatísticas ganhou a 6ª:
      **"Próx. 7 dias"** — o total que as células distribuem mas não somam.
    - ⚠️ **A grade abria pela coluna mais ANTIGA**: com ~57 colunas, hoje e a previsão nasciam
      fora da tela até alguém arrastar. Agora o painel nasce com `scrollLeft` no fim.
    - **Validado ao vivo** com `srsLog`/`srsCards` sintéticos: 399 células (371+28), previsão
      por dia batendo item a item (4→f1, 14→f2, 22→f3, 41→f4, dia vazio sem nível), os 50 cards
      `new` ignorados, atrasados e hoje fora da previsão, "Próx. 7 dias" = 81 conferido na mão,
      rótulo de mês futuro aparecendo, scroll no fim depois de trocar de aba, sem cards nenhum
      não quebra, 0 erros de console e mobile 375px (estatísticas em 3×2, sem scroll horizontal
      na página). `CACHE`: `englab-v37` → **`englab-v38`**.

### Sessão 2026-07-31 (11ª rodada) — A imagem do card passa a ilustrar O SENTIDO, não a palavra
62. **Pedido**: um print do card de "tally" no sentido **2/2** ("bater, concordar com") com uma
    imagem de **marcas de contagem** — o sentido 1. "Já foi a segunda tentativa."
    - **Causa raiz no prompt, não no modelo**: `generateCardImage` montava
      `...flashcard image for the word "tally". Meaning: "bater, concordar (com)"` — a palavra
      estrangeira em destaque e o significado em **português** para um modelo que só entende
      cena. Ele ancorava no sentido mais comum da palavra e ignorava o resto. Nada no prompt
      dizia que existia outro sentido, nem que ele era proibido; e a frase de exemplo
      ("evidence presented in court") ainda empurrava para o tribunal do print.
    - **Correção — descrever a cena antes de desenhar**: novo **`buildImageScene(card)`**
      (`js/audio.js`, não-lazy) faz uma chamada de texto barata (gpt-4o-mini, ~US$ 0,001 = 2%
      do custo da imagem) que recebe a palavra, o sentido, a definição, a frase **e a lista dos
      OUTROS sentidos como proibição explícita**, e devolve `{"scene": "..."}`: uma cena
      concreta em inglês, incompatível com os outros sentidos. **A palavra não vai mais para o
      modelo de imagem** — era justamente ela que puxava para o sentido errado.
    - **Proibições reforçadas**: o antigo "No text or lettering" virou "No text, letters,
      numbers, symbols, **tally marks**, signs or captions" — as marcas de contagem do print
      passavam pela regra antiga.
    - **Fallback**: se a descrição falhar (chave inválida, rede), o prompt antigo continua
      valendo — pior para palavra polissêmica, melhor que não gerar nada. O botão mostra
      "Descrevendo..." e depois "Gerando...".
    - **Custo**: `_aiUnitUsd('image')` passou a somar a chamada de texto, então a estimativa em
      reais dos lotes continua honesta.
    - **Validado ao vivo com `fetch` stubado** (zero dólar gasto): com "tally" sentido 2, o
      prompt de texto lista `"contagem, registro"` como proibido e o prompt de imagem sai
      **sem a palavra**, só com a cena + proibições; com a chamada de texto retornando 401, cai
      no prompt antigo e ainda gera. `CACHE`: `englab-v36` → **`englab-v37`**.

### Sessão 2026-07-31 (10ª rodada) — Sessão de estudo usa a tela inteira + mobile
61. **Pedido**: "muita margem nas laterais, sem aproveitamento — a imagem podia ser bem maior;
    ajuste para o mobile também". Causas: `.srs-session-wrap` preso em **800px** e a coluna de
    imagem **fixa em 220px**.
    - **Sessão: 800 → 1240px.** Quem protege a leitura é o limite de MEDIDA do texto (72ch no
      verso, 70ch na frase da frente) — a largura extra vai para a **imagem**, que agora cresce
      com `clamp(280px, 34%, 460px)`. Medido a 1720px com sidebar recolhida: sessão 1180px,
      imagem **389px** (era 220), texto em 564px.
    - **Verso sem imagem**: wrapper `.srs-back-text-solo` — card largo, texto centrado em
      medida legível (não vira linha de 120 caracteres).
    - **MOBILE — bug real prevenido**: a navegação inferior fixa (68px, z-index 999) ficaria
      POR CIMA da barra de notas sticky (z-index 60). Em ≤768px a barra ancora acima da nav
      (`bottom:76px`, fundo sólido; a 1ª medição a 68px ainda deixava 6px de sobreposição —
      afinado). Medido: barra em y=714, nav em y=744, sem sobreposição, botões com 63px de
      altura (alvo de toque ok).
    - `CACHE`: `v35` → **`v36`**.



### Sessão 2026-07-31 (9ª rodada) — Verso do card de estudo (print da sessão real)
60. **Pedido**: "algo que podemos fazer, melhorar, corrigir ou construir aqui?" com um print do
    verso do card em sessão. Quatro achados, quatro correções:
    1. **Os botões de avaliar caíam abaixo da dobra** — com o box de Origem + imagem o verso
       fica alto e o print mostrava as notas cortadas no rodapé; avaliar exigia rolar, o pior
       atrito possível no meio de uma sessão. A barra de notas agora é **sticky** no rodapé da
       viewport (z-index 60, gradiente para o conteúdo não vazar por baixo). Vale também para
       o modo histórico.
    2. **`série · Inglês::Vocabulary`** — o separador `::` (jargão de caminho do Anki) vazava
       na interface. `getSrsDeckPath` agora usa ` › ` (vale também para o painel de foco do
       baralho no Estudar).
    3. **O 2º botão de áudio tinha como rótulo a própria palavra** ("🔊 tally" logo abaixo da
       palavra gigante) — virou **"Pronúncia"**.
    4. **`configurações`** (minúsculo, vago) virou **"Editar card"** com ícone de lápis; o
       botão de regenerar frase trocou o glifo cru `↻` por `ic('refresh')`.
    - **Validado ao vivo** (Vercel, v34): caminho "Inglês › Vocabulary", botões "Repetir frase
      | Pronúncia | Gerar imagem", summary "Editar card", barra de notas `position:sticky`
      visível na viewport mesmo com verso alto (origem longa), 0 erros de console.



### Sessão 2026-07-31 (8ª rodada) — Revisar e Biblioteca: o que a estrutura deles pedia
59. **Pedido**: "estude o que a estrutura deles pede" — as duas telas que ficaram fora do
    padrão de grupos numerados. Conclusão do estudo: são **ferramentas de trabalho contínuo**
    (mestre-detalhe no Revisar; browser de três colunas na Biblioteca), não fluxos em passos —
    esticar o padrão da Mídia nelas seria forçado. O que a estrutura pedia era outra coisa:
    - **UM idioma de controle segmentado.** O app tinha TRÊS desenhos para o mesmo trabalho:
      `.seg-tab` (painel/configurações — ativo = cartão claro + sombra), `.rsb-filter`
      (Revisar — ativo = pílula com gradiente do acento) e `.lmt-btn` (Biblioteca — idem).
      Os três agora computam **exatamente o mesmo estilo de ativo** (verificado ao vivo:
      mesmos valores de fundo e cor nos três). Só CSS; nenhuma classe ou handler mudou.
    - **Cabeçalho da Biblioteca**: 6 controles misturando naturezas — trocar de visão
      (toggle Cards|Palavras), ação de uso diário (Ouvir playlist) e TRÊS operações pesadas de
      IA que rodam raramente e custam dinheiro (Negrito perfeito, Completar dados, Reanalisar
      tudo). As três foram para um **menu "Manutenção IA"** (popover com título + descrição
      por item, clique-fora fecha, `aria-haspopup`/`aria-expanded`). Cabeçalho final: toggle +
      playlist + menu. **Os ids originais foram preservados nos itens do menu** — o código de
      progresso (que salva/restaura `innerHTML` durante os lotes) continua funcionando sem
      mudança. No modo Palavras o gatilho some inteiro (antes 3 botões sumiam um a um).
    - **Validado ao vivo** (Vercel, v33): os 3 segmentados com estilo de ativo idêntico,
      cabeçalho da Biblioteca reduzido a "Ouvir playlist | Manutenção IA", menu abrindo com os
      3 itens, clique-fora fechando, gatilho sumindo no modo Palavras e voltando no Cards,
      0 erros de console.



### Sessão 2026-07-31 (7ª rodada) — O padrão da Mídia vira a linguagem do app + escala de tamanhos
58. **Pedido**: o Djemeson apontou a aba Mídia como referência ("organização e estrutura bem
    montada") e pediu o mesmo para todos os painéis, mais uma análise de TAMANHOS.
    - **Componente compartilhado**: `.midia-group`/`.midia-eyebrow` viraram
      **`.panel-group`/`.panel-eyebrow`** (os nomes antigos seguem como alias). O padrão:
      moldura de cartão + rótulo numerado em caixa alta + agrupamento por passo.
    - **Aplicado em**: Adicionar→Manual ("1 · Item de estudo" com palavra/frase/aviso de
      duplicata; "2 · Fonte" com chips e título; botão de ação fora das molduras);
      Adicionar→Kindle ("1 · Arquivo do Kindle" emoldurando a dropzone; "2 · Destaques
      importados" nos resultados); Estudar (cartões do dia + CTA "Começar sessão" agrupados
      sob **"Hoje"**; a tabela de baralhos virou grupo próprio com rótulo no padrão — o `<h3>`
      avulso saiu).
    - **TAMANHOS — medido ao vivo antes**: CINCO alturas de botão visíveis ao mesmo tempo
      (26, 28, 35, 36, 38px) e controles em 38/42px — o tipo de ruído que ninguém aponta mas
      tira a sofisticação. Agora:
      - **Escala oficial de botões: 44 (`.btn-lg`, ações-herói) / 38 (padrão) / 30 (`.btn-sm`)
        / 24 (`.btn-xs`)** via min-height. O CTA "Começar sessão" estava em 43px por acidente
        de padding e passou a ser grande DE DIREITO (`.btn-lg`); o enviar do chat alinhou em
        44; **exceção documentada**: "Testar chave" fica em 40px de propósito, alinhado aos
        controles de 40px ao lado.
      - **Controles de formulário numa altura única**: token `--control-h` (40px) substituindo
        os 38/42px hardcoded (medido depois: chave, modelo e qualidade todos em 40px).
    - **Validado ao vivo** (Vercel, v32): grupos e rótulos presentes nas três telas, CTA dentro
      do grupo "Hoje", ids críticos preservados (m-word, chips, kindle-drop), 0 erros nas 7
      telas. `CACHE`: `v30` → **`v32`**.



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

- [x] **Estudar transbordava a tela no celular** — corrigido em 2026-08-01 (16ª rodada, item 67).

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
