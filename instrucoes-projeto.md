# English Lab — Instruções do Projeto Cowork

## O que é este projeto

Plataforma pessoal de estudo de inglês do Djemeson. O objetivo é criar flashcards Anki a partir de vocabulário coletado de múltiplas fontes, com processamento por IA (Claude) via n8n rodando na Hostinger.

## Arquitetura geral

```
[Fontes de Input] → [plataforma-ingles.html] → [n8n Hostinger] → [Claude AI + TTS]
                                              ↓                        ↓
                                        [localStorage]          [Google Sheets]
                                              ↓
                                        [AnkiConnect local]
```

- **Frontend**: `plataforma-ingles.html` — abre no navegador local do usuário
- **Backend/Automação**: n8n rodando na Hostinger
- **IA**: Claude API (via n8n) para análise de vocabulário
- **Áudio**: OpenAI TTS (via n8n) para pronúncia
- **Storage**: localStorage (cache local) + Google Sheets (persistência)
- **Flashcards**: Anki via AnkiConnect (http://localhost:8765)

## Tipos de input suportados

### 1. Manual
O usuário digita palavra/frase + frase de contexto. Pode vir de qualquer fonte.

### 2. Kindle
- **My Clippings.txt** — arquivo de destaques do Kindle. Contém a frase inteira destacada. O usuário clica na palavra específica dentro da frase para identificar o alvo.
- **CSV do Vocabulary Builder** — exportado do vocab.db do Kindle. Já contém `word` + `usage` (contexto) separados.

### 3. Language Reactor
Arquivo TXT/TSV exportado da extensão Language Reactor (estudo via Netflix/YouTube). O usuário anota palavras desconhecidas enquanto assiste. Formato aceito:
- TSV com colunas: word, context, timestamp
- TXT simples: uma palavra por linha
- Formato `palavra :: contexto`

### 4. Website / URL
O usuário cola uma URL. O n8n busca o conteúdo e o Claude identifica vocabulário acima de nível B1 para o usuário selecionar o que quer estudar.

## Modelo de dados (cada palavra/frase)

```json
{
  "id": "uuid",
  "word": "serendipity",
  "type": "word|phrasal_verb|idiom|collocation",
  "context": "frase completa onde apareceu",
  "source_type": "kindle|language_reactor|website|manual",
  "source_title": "nome do livro/site/etc",
  "meaning_pt": "significado em português (neste contexto específico)",
  "ipa": "/ˌserənˈdɪpɪti/",
  "examples": ["exemplo 1", "exemplo 2"],
  "level": "A2|B1|B2|C1|C2",
  "audio_base64": "...",
  "anki_id": null,
  "status": "pending|in_anki|skipped",
  "tags": [],
  "processed": false,
  "created_at": "ISO date"
}
```

## Decisão de design: palavras com múltiplos significados

**Abordagem adotada: significado único no contexto.**

- Cada entrada captura o significado NAQUELE contexto específico
- Se a mesma palavra aparecer em contexto diferente, o usuário cria uma nova entrada
- O Claude identifica automaticamente se é palavra simples, phrasal verb ou idiom
- Para Kindle: a frase inteira é o contexto; o usuário seleciona a palavra alvo clicando nela
- Isso evita cards genéricos demais e garante que o usuário aprenda o uso real

## Webhooks n8n (Hostinger)

Configurar a base URL nas Configurações da plataforma. Os endpoints são:

| Endpoint | Método | Função |
|---|---|---|
| `/webhook/en-processar` | POST | Processar palavra com IA + gerar áudio |
| `/webhook/en-site` | POST | Extrair vocabulário de URL |
| `/webhook/en-fila` | POST | Buscar fila de revisão do Sheets |
| `/webhook/en-status` | POST | Atualizar status de uma palavra |

## Integração AnkiConnect

- URL padrão: `http://localhost:8765`
- AnkiConnect precisa estar rodando (plugin do Anki desktop)
- O frontend chama AnkiConnect diretamente (não passa pelo n8n)
- Model (tipo de nota) padrão: "Inglês Básico" com campos: Frente, Verso, Contexto, IPA, Exemplos, Áudio
- Deck padrão: "Inglês"

## Arquivos do projeto

```
n8n - Inglês Automatizado/
├── plataforma-ingles.html          ← Abrir no navegador para usar
├── instrucoes-projeto.md           ← Este arquivo
├── setup.md                        ← Guia de configuração
└── n8n/
    ├── processar-palavra.json      ← Importar no n8n
    ├── extrair-website.json        ← Importar no n8n
    └── gerenciar-fila.json         ← Importar no n8n
```

## Como Claude deve ajudar neste projeto

- Ajustar parsers de Kindle/Language Reactor se o formato mudar
- Melhorar o prompt do Claude API para análise de vocabulário
- Adicionar novos tipos de input
- Debugar problemas de integração n8n ↔ Sheets ↔ AnkiConnect
- Sugerir melhorias de UX na plataforma HTML
- Criar novos workflows n8n para novas automações
- Ajudar a configurar o modelo Anki (campos, template de card)
