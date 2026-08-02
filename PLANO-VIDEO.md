# Plano Vídeo — estudar com séries e filmes dentro do Language Lab

> Criado em 2026-08-01. Estudo de escopo feito a pedido do Djemeson: adicionar um vídeo
> (série/filme), trabalhar a legenda, quebrar em pedaços e levar cortes exatos para o estudo.
> **Nenhuma linha de código foi escrita ainda** — este documento é a análise, a proposta e as
> perguntas em aberto. As decisões do Djemeson entram na seção 1 quando ele responder.

---

## 1. Decisões tomadas

| Decisão | Escolha |
|---|---|
| (demais — aguardando respostas, ver seção 9) | |
| Desktop | O Djemeson topa um app desktop **se o navegador não der conta**, desde que a sincronização continue. Análise na seção 7: o navegador dá conta do núcleo; desktop fica como fase opcional. |
| Vídeo é descartável | Confirmado pelo Djemeson (2026-08-01): o vídeo pode ser apagado depois de extrair o que importa. Casa com a arquitetura: o vídeo **nunca** vai para o Firebase — o app extrai legenda + cortes + áudios (KBs) e o arquivo grande pode sumir. Único efeito de apagar: o botão "rever a cena" deixa de funcionar; cards, áudios reais e legenda continuam íntegros e sincronizados. A UI deve dizer isso ("já extraí tudo — pode apagar o arquivo"). |

---

## 2. Restrições que moldam tudo (a arquitetura atual)

1. **O app é 100% navegador** (HTML/JS puro, sem build): GitHub Pages + Vercel servem arquivos
   estáticos; OpenAI e Firebase são chamados direto do browser. Não existe backend próprio
   (o n8n foi removido em 2026-07-30 exatamente para zerar serviços a manter).
2. **Vídeo é grande e a nuvem do projeto é pequena.** Um episódio tem 300 MB–2 GB. Firestore
   limita cada documento a 1 MB (os áudios TTS de hoje vivem como base64 em docs). Conclusão
   estrutural: **o arquivo de vídeo nunca sobe** — ele fica no aparelho; o que sincroniza são
   metadados (legenda, clipes, cards) e **áudios pequenos** dos cortes (dezenas de KB, como os
   TTS de hoje).
3. **Custo**: a IA já é paga por uso (chave do Djemeson). Transcrição Whisper custa
   US$ 0,006/min → um episódio de 45 min ≈ US$ 0,27 (~R$ 1,40). Barato o bastante para ser
   um botão, caro o bastante para passar pelo `aiConfirmBatch`.
4. **CORS**: sites de legenda (OpenSubtitles etc.) exigem chave de API e, tipicamente, não
   aceitam chamadas de navegador. Qualquer busca automática precisa de um intermediário
   (função serverless na própria Vercel — ver seção 5.2) OU de um passo manual do usuário.
5. **Celular**: estudar cards funciona em qualquer lugar (já funciona hoje). Assistir vídeo
   local no celular é possível (`<input type="file">` + `<video>`), mas a API que "lembra" do
   arquivo entre visitas (File System Access) só existe em Chrome/Edge desktop — no celular o
   arquivo teria de ser re-escolhido a cada sessão.

---

## 3. As 4 perguntas do Djemeson — viabilidade real

### 3.1 "Criar uma legenda do zero pelo site, independente do vídeo?" — SIM, dois modos
- **Automático (Whisper)**: o site extrai o áudio do vídeo no navegador, manda para a API de
  transcrição da OpenAI (`whisper-1`, `response_format: 'srt'`) e volta uma legenda completa
  **com timestamps**. Limite de 25 MB por chamada → o áudio precisa ser extraído/comprimido e
  fatiado antes (ver 5.4 — é o ponto tecnicamente mais delicado do plano inteiro).
- **Manual (editor)**: uma lista de falas `tempo → texto` com o vídeo do lado; botão/tecla
  "marcar agora" cria um cue no timestamp corrente; arrastar bordas ajusta início/fim. Serve
  também para **corrigir** uma legenda importada ou transcrita.
- **Terceiro modo, o mais comum**: importar `.srt`/`.vtt` pronto (arrastar o arquivo). Parser
  de SRT é trivial e roda 100% local.

### 3.2 "Buscador automático de legenda pronta?" — SIM, com um porém
- **Direto do navegador: não** (CORS + chave de API exposta).
- **Caminho A — zero infraestrutura (semi-automático)**: o site abre a busca do OpenSubtitles
  já preenchida com o título; o Djemeson baixa o `.srt` e arrasta para o app. Um clique a mais,
  nenhuma peça nova para manter.
- **Caminho B — automático de verdade**: UMA função serverless no MESMO projeto Vercel
  (`/api/subs`) que repassa a busca para a API do OpenSubtitles. Sem servidor para cuidar,
  deploy junto com o site. **Bônus técnico**: dá para calcular o *moviehash* do arquivo no
  navegador (tamanho + primeiros/últimos 64 KB, via `File.slice`) e buscar a legenda exata
  daquele arquivo — sincronia garantida, sem ajuste manual.
- Nota: legendas de séries/filmes são material com direitos autorais; uso pessoal de estudo é
  o cenário aqui, e nada é republicado — as legendas ficam no IndexedDB/Firestore do usuário.

### 3.3 "Quebrar o vídeo em pedaços menores?" — SIM, e sem cortar nada de verdade
- **Cortes virtuais**: um "clipe" é só `{início, fim}` apontando para o vídeo inteiro; o
  player pula para `currentTime = início` e para em `fim` (loop A–B opcional). Instantâneo,
  zero processamento, zero espaço duplicado.
- **A legenda é o picotador natural**: cada fala já é um pedaço com começo e fim. A UI vira
  uma lista de falas clicáveis — clicou, assistiu aquele trecho.
- **Corte físico** (gerar um arquivo .mp4 menor): possível com ffmpeg.wasm (~30 MB baixados
  sob demanda) ou nativo num app desktop — mas é desnecessário para ESTUDAR; fica como
  exportação opcional em fase futura.

### 3.4 "Escolher o corte exato pra levar pra estudar?" — SIM, e com a arma secreta
- Seleciona uma fala (ou um intervalo de falas), ajusta as bordas com precisão de 0,1s,
  confere com o loop A–B e manda para o estudo.
- O corte vira um card SRS normal (palavra/expressão + frase da legenda como contexto +
  tradução IA), **mas com o áudio REAL da cena no lugar do TTS** — capturado no navegador
  (ver 5.4). Revisar ouvindo a voz do ator, no ritmo real da fala, é o que nenhum TTS dá.
- O card guarda a referência do clipe: no aparelho onde o vídeo existe, um botão
  **"rever a cena"** reabre o trecho exato. O áudio pequeno sincroniza para todos os
  aparelhos (como os TTS de hoje); o vídeo não.

---

## 4. Ideias além do pedido (ordenadas por valor/esforço)

1. **"Preparar para assistir"** — a mais poderosa e a mais barata: ao importar a legenda, o
   app cruza TODAS as palavras do episódio com o que o Djemeson já tem em `words[]`/`srsCards[]`
   e entrega: "você conhece 91% deste episódio; estas são as 18 palavras/expressões novas mais
   frequentes nele". Estuda antes, assiste entendendo. Reusa o pipeline inteiro que já existe
   (análise IA → pending_review → SRS). Nem precisa do vídeo — só da legenda.
2. **Cobertura por série** — o mesmo cálculo, virado ao contrário: "% de vocabulário conhecido"
   por episódio/série vira um medidor de dificuldade pessoal ("Friends: 94% · Better Call Saul:
   82%") e um critério para escolher a próxima série.
3. **Transcript karaokê** — legenda rolando sincronizada com o vídeo; clique numa palavra →
   mini-gloss da IA; clique na fala → replay do trecho.
4. **Marcadores durante a exibição** — assiste normal; quando não entender, uma tecla marca o
   momento. No fim, a lista de marcas vira fila de estudo (cada marca já sabe a fala da
   legenda). É o fluxo "assistir primeiro, estudar depois" sem interromper o episódio.
5. **Dupla legenda com recall** — original em cima, tradução PT (gerada por IA, cacheada)
   embaixo; modo recall esconde a PT e revela após pausa, como o flashcard.
6. **Modo ditado** — esconde a legenda, toca a fala, o Djemeson digita o que ouviu; diff
   palavra a palavra contra a legenda real.
7. **Shadowing** — grava a imitação pelo microfone e transcreve com Whisper; compara com a
   fala original (nota de similaridade). Custo por tentativa: centavos.
8. **Cloze da cena** — card lacunado gerado da fala ("His story does not ___ with the
   evidence"), com o áudio real como dica.
9. **"Rever a cena" no leech** — card travando na memória (leech) ganha o atalho para a cena
   de origem: memória episódica como âncora.

---

## 5. Arquitetura proposta

### 5.1 Entidades novas
- `videos[]` (metadado, sincroniza): `{id, title, source_type: series|movie, lang, duration,
  subId, created_at}` — SEM o arquivo.
- Handle do arquivo (LOCAL, por aparelho): `FileSystemFileHandle` persistido no IndexedDB
  (Chrome/Edge desktop); fallback universal: re-escolher o arquivo com `<input type="file">`.
- `subs` (IndexedDB local + doc comprimido no Firestore se couber em 1 MB — um SRT de 45min
  tem ~60–120 KB, cabe): cues `[{start, end, text}]`.
- `clips[]` (sincroniza): `{id, videoId, start, end, cueIds, wordId?}` + áudio do corte no
  `AudioDB`/coleção `audio` (o mecanismo de sync de áudio JÁ EXISTE).
- `srsCards` ganham `clipId?` opcional — nada muda para cards antigos.

### 5.2 Peças de plataforma
- **Player**: `<video>` nativo + transcript ao lado; cortes virtuais via `currentTime`.
- **Novo `js/video.js` LAZY** (como `add.js`/`study.js`) — a armadilha nº 1 do projeto exige:
  nada de função de `video.js` usada por arquivos não-lazy; o que o SRS/estudo precisar
  (ex.: "rever a cena") entra por referência de dados, não por chamada de função.
- **Busca de legenda (se Caminho B)**: `api/subs.js` no repositório — a Vercel converte em
  função automaticamente; o GitHub Pages simplesmente não a serve (a busca só funcionaria na
  URL da Vercel — mais um motivo para ela ser o destino principal).

### 5.3 Custos por episódio (45 min, ordem de grandeza)
| Operação | Custo |
|---|---|
| Importar .srt | R$ 0 |
| "Preparar para assistir" (análise das novas) | ~R$ 0,01/palavra analisada (chat mini) |
| Transcrever com Whisper | ~R$ 1,40 |
| Tradução PT da legenda inteira | ~R$ 0,30–0,60 |
| Áudio real dos cortes | R$ 0 (captura local) |

### 5.4 O ponto tecnicamente delicado: áudio a partir do vídeo, no navegador
- **Clipe curto (5–30s)** — resolvido sem truque: toca o trecho no `<video>` (pode ser mudo
  para o usuário) capturando com `captureStream()` + `MediaRecorder` → Opus/WebM de ~40–100 KB.
  Tempo de captura = duração do clipe (15s de cena = 15s de espera, com barra de progresso).
  É o caminho do MVP.
- **Episódio inteiro (para o Whisper)** — capturar em tempo real levaria 45 min; inaceitável.
  Opções, da mais robusta à mais experimental:
  1. **ffmpeg.wasm** sob demanda (~30 MB na primeira vez, depois cacheado): extrai/comprime o
     áudio em 1–3 min e fatia nos 25 MB do Whisper. Funciona no Chrome desktop; pesado no
     celular.
  2. Captura acelerada (`playbackRate 3–4×` com `preservesPitch`) e timestamps re-escalados —
     45 min viram ~12 min de espera. Frágil; só como experimento.
  3. **App desktop** (ver seção 7) — ffmpeg nativo, segundos. É o único requisito da lista
     inteira que o navegador atende só "com esforço".

---

## 6. Fases propostas

| Fase | Entrega | Peças | Esforço |
|---|---|---|---|
| **1 (MVP)** | Nova seção "Vídeo": abrir vídeo local + importar .srt/.vtt + transcript clicável + cortes virtuais com A–B + card com áudio REAL da cena + "Preparar para assistir" | `video.js` lazy, parser SRT, captureStream, cruzamento com `words[]` | ~1 sessão longa |
| **2** | Editor/ajuste de legenda (offset ±, editar cue, "marcar agora") + dupla legenda PT com recall + marcadores durante a exibição | editor de cues, tradução em lote cacheada | ~1 sessão |
| **3** | Transcrição Whisper de episódio inteiro (ffmpeg.wasm) + busca automática de legenda (função Vercel + moviehash) | ffmpeg.wasm, `api/subs.js` | ~1 sessão |
| **4 (opcional)** | Ditado, shadowing, cloze da cena, exportar corte físico | Whisper por tentativa, ffmpeg | conforme uso |

---

## 7. Navegador × app desktop (a mensagem do Djemeson de 2026-08-01)

> "Se ele precisar rodar na máquina e não no browser pra isso, então vamos criar um app
> desktop, mas que mantenha a sincronização."

Análise honesta do que o desktop compraria:

| Capacidade | Navegador | Desktop (Tauri/Electron) |
|---|---|---|
| Assistir vídeo local + cortes virtuais | ✅ pleno | ✅ |
| Áudio real de clipes curtos | ✅ (espera = duração do clipe) | ✅ instantâneo |
| Lembrar do arquivo entre sessões | ✅ Chrome/Edge desktop; ❌ celular | ✅ |
| Whisper de episódio inteiro | ⚠️ ffmpeg.wasm (pesado, 1–3 min) | ✅ ffmpeg nativo (segundos) |
| Busca automática de legenda | ⚠️ precisa da função Vercel | ✅ direto (sem CORS) |
| Assistir pastas inteiras/biblioteca | ❌ manual | ✅ vigia a pasta de downloads |
| Sincronização Firebase | ✅ já existe | ✅ (Tauri/Electron rodam o MESMO código web — o app seria uma casca em volta do site atual, mesma base, mesmo Firestore) |
| Custo de manutenção | zero novo | nova superfície: build, updates, assinatura de binário |

**Recomendação**: começar no navegador — as fases 1 e 2 (o coração da funcionalidade) rodam
plenas nele, e o celular continua atendido para ESTUDAR os cards gerados. O desktop entra como
fase própria SE (a) o Whisper de episódio inteiro virar rotina e o ffmpeg.wasm incomodar, ou
(b) a experiência "biblioteca de episódios" ficar importante. Se entrar, a escolha certa é
**Tauri** com o mesmo código do site dentro (uma casca, não um segundo app para manter) — a
sincronização vem de graça porque o código é o mesmo.

---

## 8. Riscos e armadilhas conhecidas
- **Lazy-loading** (armadilha nº 1 do projeto): `video.js` será lazy; nenhum arquivo não-lazy
  pode chamar funções dele.
- **Firestore 1 MB/doc**: legendas grandes comprimidas (LZ) ou fatiadas; clipes de áudio como
  docs individuais (padrão atual do `audio/*`).
- **iOS/Safari**: `captureStream` de `<video>` tem suporte irregular — o áudio real de clipe
  pode ficar indisponível no iPhone (fallback: TTS, como hoje). Djemeson usa Android/Windows,
  então impacto baixo.
- **Direitos autorais**: tudo é uso pessoal e local/na conta do usuário; o app não distribui
  nem vídeo nem legenda.
- **OneDrive**: vídeos na pasta sincronizada do OneDrive podem estar "na nuvem" (placeholder)
  — o handle abre, mas a leitura dispara download. Avisar na UI quando a leitura for lenta.

## 9. Perguntas em aberto (aguardando o Djemeson)
1. De onde vêm os vídeos — só arquivos locais, ou YouTube também importa?
2. Em qual aparelho isso vai rodar de verdade (notebook? celular também?)
3. Busca de legenda: vale UMA função serverless na Vercel (zero manutenção) ou 100% sem servidor?
4. Por onde começar o MVP?
