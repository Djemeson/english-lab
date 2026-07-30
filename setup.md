# Language Lab — Guia de Configuração

> Atualizado em 2026-07-30. A versão anterior deste arquivo descrevia um app que não existe
> mais (arquivo `plataforma-ingles.html`, envio de cards para o Anki via AnkiConnect e planilha
> do Google Sheets). Tudo isso foi removido do projeto — o SRS hoje é **nativo** e os dados
> ficam no navegador + Firebase.

## Passo 1 — Abrir a plataforma

- **No ar:** https://djemeson.github.io/english-lab/
- **Local:** o login do Google não funciona em `file://`. Suba um servidor:

```bash
python -m http.server 8765
```

E abra `http://localhost:8765`.

## Passo 2 — Chave da OpenAI (obrigatória para a IA e o áudio)

**Configurações → Inteligência Artificial → OpenAI API Key** (chave em
https://platform.openai.com). É ela que faz:

- análise de vocabulário (significados, definições, IPA, nível, frases de exemplo);
- áudio das frases e das palavras (TTS);
- imagens de auxílio visual dos cards.

A chave fica só no seu aparelho (localStorage + backup no IndexedDB) e é enviada apenas para
`api.openai.com`. Sem chave, o app continua funcionando: você preenche os significados à mão e
o áudio cai no sintetizador do próprio navegador.

Clique em **Salvar todas as alterações** ao terminar.

## Passo 3 — Sincronização em nuvem (opcional, mas recomendada)

**Configurações → Sincronização em Nuvem → Fazer Login com o Google.**

A partir daí, palavras, cards, áudios, imagens e progresso de estudo sincronizam **em tempo
real** entre todos os aparelhos logados na mesma conta.

> A nuvem é a fonte da verdade: uma exclusão feita em um aparelho se propaga para os outros.
> Antes de testar qualquer coisa relacionada a sync, faça um backup em
> **Configurações → Exportar JSON**.

## Uso diário

| Fluxo | Como |
|---|---|
| **Kindle** | Copie o `My Clippings.txt` do Kindle → Adicionar → Kindle → arraste o arquivo → clique na palavra-alvo dentro de cada frase → selecione e processe. |
| **Mídia / séries** | Adicionar → Mídia. Cole linha a linha (`palavra :: frase`), cole um artigo inteiro, ou arraste um `.md`/`.txt`/`.pdf`. O campo de contexto ("reality de sobrevivência") ajuda a IA a escolher o sentido certo. |
| **Assistente** | Pergunte em português ou no idioma estudado; os termos citados viram botões "Adicionar". |
| **Revisar** | Confira os significados, escolha quais quer estudar e clique em "Salvar para estudo" — isso cria os cards do SRS. |
| **Estudar** | Sessão de flashcards. Atalhos: `Espaço` revela / avalia "Bom", `1`–`4` avaliam, `R` repete o áudio, `Z` desfaz. |
| **Biblioteca** | Todos os cards por baralho, glossário por palavra e o player "Ouvir playlist" (listening passivo). |

## Dicas

- Faça backup periodicamente: **Configurações → Exportar JSON**.
- O badge vermelho em "Revisar" mostra quantas palavras estão aguardando.
- O app é instalável (PWA): no celular, use "Adicionar à tela de início".
- Depois de um deploy, pode ser preciso um *hard refresh* para o service worker pegar a
  versão nova.
