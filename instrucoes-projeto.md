# Language Lab — Referência técnica rápida

> **Este arquivo é um complemento.** A documentação principal é
> [`ESTADO-DO-PROJETO.md`](./ESTADO-DO-PROJETO.md) (arquitetura, modelo de dados, sincronização,
> SRS, histórico e pendências) — leia-a primeiro. Aqui ficam só as informações de
> infraestrutura que não mudam de sessão para sessão.
>
> Atualizado em 2026-07-30. A versão anterior descrevia uma arquitetura que não existe mais
> (um `index.html` único de ~220KB com toda a lógica num só `<script>`, envio de cards para o
> Anki via AnkiConnect e um modelo de dados antigo). O código está dividido em `js/*.js` desde
> meados de 2026 e a integração com o Anki foi removida.

## Stack

```
[Kindle · Mídia · Documento · Website · Assistente]
                    ↓
        index.html + js/*.js  (site estático, GitHub Pages)
             ↓                          ↓
   api.openai.com              Firebase Firestore
   (análise, TTS, imagens)     (words, cards, cfg, áudio/imagem em base64)
             ↓
   IndexedDB local (cache de áudio, imagem, cards e backup da cfg)
```

- **Frontend**: HTML/CSS/JS puros, **sem build**. Um arquivo JS por área (ver
  `ESTADO-DO-PROJETO.md`, seção 2 — e a armadilha do *lazy-loading* descrita lá).
- **Branches**: `dev` para trabalhar, `main` publica. O workflow
  `.github/workflows/deploy.yml` valida a sintaxe do JS e publica no GitHub Pages.
- **IA**: OpenAI direto do navegador (gpt-4o-mini como padrão).
- **TTS**: OpenAI `tts-1`, voz aleatória, pré-gerado ao salvar o card. Fallback: Web Speech API.
- **Imagens**: `gpt-image-1` (o DALL·E 3 foi descontinuado em maio/2026).
- **SRS**: SM-2 nativo (`js/srs.js`). Sem Anki.
- **Sync**: Firestore em tempo real (`onSnapshot`), nuvem = fonte da verdade.

## REGRA CRÍTICA — n8n

**Não modificar os arquivos JSON em `n8n/`.** As regras manuais do nó Switch se perdem ao
reimportar. Mudança no n8n = instrução manual pela interface. O site funciona por completo sem
o n8n; ele só existe para a aba **Website**.

## Persistência

**localStorage**

```javascript
englab_cfg              // cfg (chave OpenAI, URL n8n, tema, provider, idioma ativo)
englab_words            // words[]
el-srs-cards            // srsCards[]  (fonte primária é o IndexedDB CardsDB)
el-srs-cfg              // parâmetros SM-2
el-srs-log              // log diário {date, reviewed, correct, newSeen}
el-srs-decks            // árvore de baralhos
el-kindle-seen          // hashes de destaques já processados
el-kindle-queue         // fila do Kindle pendente (cross-device)
el-consulta-conversas   // histórico do Assistente
el-ui-prefs             // sidebar/histórico recolhidos
```

**IndexedDB**

- `CardsDB` — cards (fonte local primária)
- `AudioDB` — áudio em base64, indexado por hash do texto
- `ImageDB` — imagens em base64, chave `img_{wordId}_{meaningIdx}`
- `SettingsDB` — backup da `cfg` (sobrevive à limpeza do localStorage)

**Firestore**

```
users/{uid}/
  data/{words, srsCards, srsCfg, srsLog, srsDecks, cfg, kindleQueue, conversas}
  audio/{hash}   → { data: "base64...", updatedAt }
  images/{key}   → { data: "base64...", updatedAt }
```

Firebase **Storage não é usado** (exigiria o plano Blaze) — os binários vão para o Firestore.

## Firebase

Config em `js/firebase.js`. Auth via Google (`signInWithPopup`), `setPersistence(LOCAL)`.
Domínios autorizados: `djemeson.github.io` e `localhost`.

> A `apiKey` do Firebase web é pública por natureza (vai no bundle de qualquer app web). Quem
> protege os dados são as **regras de segurança do Firestore** — cada usuário só pode ler e
> escrever em `users/{seu_uid}/`. Confira isso no console antes de assumir que está seguro.

## Baralhos

```
dk-root (Inglês)                     ← ids legados; outros idiomas usam dk-root-<código>
  dk-vocab    (Vocabulary)           ← padrão
  dk-phrasal  (Phrasal Verbs)        ← type === 'phrasal_verb' (expressão verbal do idioma)
  dk-idioms   (Idioms)               ← type === 'idiom'
  dk-colloc   (Collocations)         ← type === 'collocation'
```

Os baralhos de outros idiomas são criados sob demanda por `ensureLangDecks()` em `js/lang.js`.

## Fluxo de git

```bash
git checkout dev
git add -A
git commit -m "feat: descrição"
git push origin dev
# Publicar: merge dev → main (o Actions publica sozinho)
```

## Problemas conhecidos

- `file://` não suporta Firebase Auth — use um servidor HTTP.
- O service worker cacheia o shell: depois de um deploy pode ser preciso um *hard refresh*.
  Ao mudar arquivos do shell, **bumpe a constante `CACHE` em `sw.js`**.
- Os caminhos do `sw.js` e do registro em `js/init.js` são **relativos** de propósito: o app
  roda na raiz em desenvolvimento e em `/english-lab/` no GitHub Pages. Não troque por
  caminhos absolutos.
- `index.lock`: no Windows, apagar `.git/index.lock` manualmente se o git travar.
- `response_format: 'b64_json'` não existe na API `gpt-image-1` — usar URL + `blobToBase64`.
- O shell (bash) pode enxergar cópias desatualizadas dos arquivos por causa da sincronização
  do OneDrive; valide com a ferramenta de leitura ou com o app rodando ao vivo.
