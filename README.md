# Language Lab

Plataforma pessoal de estudo de idiomas por leitura progressiva. Captura vocabulário de várias
fontes (Kindle, séries/filmes, documentos, sites), analisa com IA, gera áudio (TTS) e estuda com
**repetição espaçada nativa** (SM-2, estilo Anki). Sincroniza entre dispositivos via Firebase.

> **Documentação de verdade:** [`ESTADO-DO-PROJETO.md`](./ESTADO-DO-PROJETO.md) — arquitetura,
> modelo de dados, sincronização, SRS, histórico e pendências. Leia antes de mexer em qualquer
> coisa. Este README é só o resumo de entrada.

- **No ar (dois destinos):**
  - GitHub Pages → https://djemeson.github.io/english-lab/
  - Vercel → https://english-lab-seven.vercel.app/
- **Deploy:** um `git push origin main` publica nos **dois**. O GitHub Actions valida a
  sintaxe do JS, procura marcador de conflito e publica no Pages
  (`.github/workflows/deploy.yml`); a Vercel republica pela integração Git, como site
  estático (`vercel.json`).

## Como é feito

Site **estático**: HTML, CSS e JavaScript puros, sem build e sem framework. Não há backend
próprio — o navegador fala direto com a OpenAI e o Firebase.

```
index.html             markup de todas as seções + modais
css/styles.css         todo o CSS (tokens/temas no topo, camadas novas no fim)
sw.js                  service worker (cache do shell)
manifest.webmanifest   PWA (instalável no celular)
js/                    um arquivo por área — ver ESTADO-DO-PROJETO.md, seção 2
n8n/                   workflows do n8n (usado só para extrair vocabulário de sites)
```

## Rodar localmente

Firebase Auth não funciona em `file://` — é preciso um servidor HTTP. Qualquer um serve:

```bash
python -m http.server 8765
```

Ou, se preferir Node (instala o Express):

```bash
npm install && npm run dev
```

Depois abra `http://localhost:8765` (ou `:3000` no caso do Node).

## Configuração

Não existe arquivo de configuração nem variável de ambiente. Tudo é feito pela própria
interface, em **Configurações**:

1. **Chave da OpenAI** — usada direto pelo navegador para análise de vocabulário, TTS e imagens.
   Fica no `localStorage`/IndexedDB do aparelho e é enviada apenas para `api.openai.com`.
2. **Sincronização em nuvem** — login com Google (Firebase). Sincroniza palavras, cards, áudios
   e progresso em tempo real entre dispositivos.
3. **URL do n8n** *(opcional)* — só é necessária para a aba **Website**, a única operação que o
   navegador não consegue fazer sozinho.

Faça backup de vez em quando: **Configurações → Exportar JSON**.
