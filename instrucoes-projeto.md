# English Lab — Instruções do Projeto

## O que é este projeto

Plataforma pessoal de estudo de inglês do Djemeson. Captura vocabulário de múltiplas fontes, processa com IA, gera flashcards com SRS nativo (SM-2), áudio TTS e imagens geradas por IA. Funciona como site estático no GitHub Pages com sincronização via Firebase.

## Stack atual

```
[Fontes de Input] → [index.html (GitHub Pages)] → [OpenAI API direto]
                                 ↓                        ↓
                          [Firebase Firestore]      [IndexedDB local]
                          (cards, words, config,    (cache áudio/imagem)
                           áudio base64, imagens)
                                 ↓
                          [AnkiConnect local - opcional]
                          (http://localhost:8765)
```

- **Frontend**: `index.html` único — GitHub Pages (branch `main`)
- **Dev branch**: `dev` → merge para `main` para publicar
- **IA**: OpenAI API direto do browser (GPT-4o-mini padrão, configurável)
- **Áudio TTS**: OpenAI TTS-1, voz aleatória, pré-gerado ao salvar card
- **Imagens**: gpt-image-1 (DALL-E descontinuado em maio 2026), "digital illustration, editorial style"
- **SRS**: algoritmo SM-2 nativo
- **Sync**: Firebase Firestore (Google Auth) — cards, words, config, áudio base64, imagens base64
- **Flashcards Anki**: opcional, via AnkiConnect local

## REGRA CRÍTICA — n8n

**NÃO modificar os arquivos JSON do n8n**. As regras manuais do Switch node seriam perdidas ao reimportar. Mudanças no n8n = instrução manual de UI apenas. O site funciona completamente independente do n8n.

## REGRA CRÍTICA — Edição de index.html

**NUNCA usar o Edit tool no index.html** — arquivo >220KB, Edit trunca o arquivo. Sempre usar Python script com str.replace(). Testar sintaxe com `node --check` após cada mudança.

## Arquitetura do index.html

Arquivo único ~220KB, ~4500 linhas. Toda lógica em um único `<script>` no final.

### Chaves de localStorage (SK)
```javascript
const SK = {
  settings:    'englab_cfg',
  words:       'englab_words',
  srsCards:    'el-srs-cards',
  srsCfg:      'el-srs-cfg',
  srsLog:      'el-srs-log',
  srsDecks:    'el-srs-decks',
  kindleSeen:  'el-kindle-seen',   // hashes de highlights já processados
  kindleQueue: 'el-kindle-queue',  // fila Kindle pendente (cross-device)
}
```

### IndexedDB
- `english-lab-audio` (store `audio`): áudio base64 por hash de texto
- `english-lab-images` (store `images`): imagem base64 por chave `img_{wordId}_{meaningIdx}`

### Firebase (Firestore)
```
users/{uid}/
  data/words        → { list: [...], updatedAt }
  data/srsCards     → { list: [...], updatedAt }
  data/srsCfg       → { ...config, updatedAt }
  data/srsLog       → { list: [...], updatedAt }
  data/srsDecks     → { list: [...], updatedAt }
  data/kindleQueue  → { list: [...], updatedAt }
  audio/{hash}      → { data: "base64...", updatedAt }
  images/{key}      → { data: "base64...", updatedAt }
```

## Firebase Config (hardcoded no index.html)
```javascript
const FB_CONFIG = {
  apiKey: "AIzaSyCwMSwO27_UKQiOhnvhxvTQ7-ykD31mLEw",
  authDomain: "english-lab-726e7.firebaseapp.com",
  projectId: "english-lab-726e7",
  storageBucket: "english-lab-726e7.firebasestorage.app",
  messagingSenderId: "181422619156",
  appId: "1:181422619156:web:7bb0bedbe6dd106dfe4501"
}
```
- Auth: Google login (signInWithPopup)
- Domínios autorizados: `djemeson.github.io`, `localhost`
- Sync automático: debounce 2s após mudança → fbPush()
- Firebase Storage NÃO usado (requer plano pago) — binários ficam no Firestore

## Seções do site

### Dashboard
- 8 métricas: total capturado, no SRS, no Anki, para processar | para hoje, amanhã, taxa acerto, sequência
- Tabela de decks estilo Anki (Novo/Aprender/Revisar/Amanhã) — clicável, abre painel de foco com "Estudar agora"
- Adição rápida + lista recente

### Adicionar (tabs)
- **Manual**: palavra + contexto + fonte
- **Kindle**: upload → batch translation (lotes de 25, tudo antes de mostrar) → fila persistida Firebase → classificação cross-device
- **Mídia**: Language Reactor / séries / filmes
- **Website**: URL → extração via n8n
- **Consulta AI**: chat GPT-4o-mini, extrai srs_item JSON, botão "Adicionar ao SRS"

### Revisar
- Fila pendente de processamento IA → seleciona significados → "Salvar no site" cria cards SRS → envio Anki opcional

### Estudar (SRS)
- Frente: palavra + frase EN + chips variedade/registro + áudio automático
- Verso: frase EN topo → tradução PT → palavra + IPA + áudio + tipo → significado → imagem lateral direita (220px grid, mobile: empilha)
- Botões: Errei/Difícil/Bom/Fácil com previsão de intervalo
- Atalho teclado: Espaço = revelar / Espaço = Bom
- Desfazer: reverte última avaliação e estado SM-2
- Histórico: ← Anterior (somente leitura, botões desabilitados)
- Biblioteca: árvore decks + lista com sort/filtro/seleção múltipla + ações em lote (áudio/imagem/excluir) + preview lateral
- Lightbox: clicar em imagem abre fullscreen, ESC fecha

### Configurações
- IA (provider/modelo), OpenAI key, TTS, AnkiConnect, n8n
- Firebase: login/logout Google, forçar push/pull
- Dados: exportar/importar JSON, resetar histórico Kindle, limpar tudo
- Botão reset sutil no rodapé (quase invisível)

## Modelo de dados

### Word
```javascript
{ id, word, type, context, source_type, source_title, ipa, variety, status, ai_processed, created_at,
  meanings: [{ meaning_pt, definition_pt, examples:[{en,pt}], variety, register, selected }] }
```

### SRS Card (snapshot do significado)
```javascript
{ id, wordId, meaningIdx, exampleIdx, deckId,
  state, due, interval, ease, lapses, stepIdx, addedDate,
  word, ipa, type, source_type, variety, register,
  meaning_pt, definition_pt, example_en, example_pt }
```

## Chips de variedade e registro
- **Variedade**: 🇺🇸 AmE · 🇬🇧 BrE · 🇦🇺 AuE · 🇨🇦 CanE · 🌍 Other
- **Registro**: 💬 slang · 👥 informal · 🎩 formal · 🗣 coloquial · 📜 arcaico · 📖 literário · ⚙️ técnico · ⚠️ vulgar
- Mostrado na frente (sutil) e verso (junto com type chip)
- Editável via "⚙ configurações" no verso → propaga para todos os cards do mesmo significado

## Sistema de áudio
1. `preGenerateAudio(cards)` ao salvar: gera MP3 para `example_en` E `word` via OpenAI TTS-1
2. Armazenado em IndexedDB por hash do texto + sincronizado no Firebase
3. Fallback: Web Speech API (sem chave OpenAI)

## Sistema de imagens
1. `generateCardImage(cardId)` via gpt-image-1
2. Chave: `img_{wordId}_{meaningIdx}` — compartilhada entre cards do mesmo significado
3. Propaga automaticamente para todos os cards irmãos
4. Armazenado em IndexedDB + Firebase

## Fluxo Kindle
1. Upload → parser → filtra hashes vistos → loading "Traduzindo X destaques..."
2. `analyzeKindleItems()`: lotes de 25 → GPT-4o-mini → extrai palavra-alvo + tradução PT
3. Salva fila no Firebase (kindleQueue)
4. Renderiza com tudo pronto
5. Usuário seleciona → "Adicionar" → itens ficam no SRS, fila atualizada
6. Fila persiste para classificação em outro dispositivo
7. "Descartar tudo" limpa a fila

## Hierarquia de decks SRS
```
dk-root (Inglês)
  dk-vocab    (Vocabulary)     ← padrão
  dk-phrasal  (Phrasal Verbs)  ← type === 'phrasal_verb'
  dk-idioms   (Idioms)         ← type === 'idiom'
  dk-colloc   (Collocations)   ← type === 'collocation'
```

## Git workflow
```bash
git checkout dev
git add index.html
git commit -m "feat: descrição"
git push origin dev
# Publicar: merge dev → main no GitHub Desktop → Push origin
```

## Problemas conhecidos
- `index.lock`: deletar `.git/index.lock` manualmente no Windows se travar
- Firebase Storage requer plano Blaze (pago) — NÃO usar
- DALL-E 3 descontinuado em maio 2026 — usar `gpt-image-1`
- `file://` não suporta Firebase Auth — usar servidor HTTP ou GitHub Pages
- `response_format: 'b64_json'` não existe na API gpt-image-1 — usar URL padrão + blobToBase64
