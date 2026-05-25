# English Lab — Guia de Configuração

## Passo 1 — Abrir a plataforma

Abra o arquivo `plataforma-ingles.html` no seu navegador (Chrome recomendado). A plataforma funciona localmente, sem servidor.

---

## Passo 2 — Configurar o n8n (Hostinger)

### 2.1 Importar os workflows

No seu n8n (Hostinger), importe os 3 arquivos da pasta `n8n/`:

1. `processar-palavra.json` — processamento com IA + áudio
2. `extrair-website.json` — extração de vocabulário de sites
3. `gerenciar-fila.json` — atualização de status + ping de teste

Para importar: no n8n, clique em **Workflows → Import from file**.

### 2.2 Configurar credenciais

#### Anthropic (Claude) — para o workflow `processar-palavra`
1. No n8n: **Settings → Credentials → New → HTTP Header Auth**
2. Name: `x-api-key`
3. Value: sua chave da Anthropic (https://console.anthropic.com)
4. Vincule ao node "Claude AI — Analisar"

> Alternativamente, você pode colar a chave diretamente no campo `x-api-key` do node HTTP Request (menos seguro).

#### OpenAI (TTS) — para o workflow `processar-palavra`
1. No n8n: **Settings → Credentials → New → HTTP Header Auth**
2. Name: `Authorization`
3. Value: `Bearer SUA_CHAVE_OPENAI` (https://platform.openai.com)
4. Vincule ao node "OpenAI TTS — Áudio"

> Se não quiser usar OpenAI TTS, desconecte o node de TTS. O áudio virá do browser (Web Speech API).

#### Google Sheets — para os workflows `processar-palavra` e `gerenciar-fila`
1. No n8n: **Settings → Credentials → New → Google Sheets OAuth2**
2. Siga o fluxo de autenticação com sua conta Google
3. Crie uma planilha com as colunas abaixo e copie o ID da URL

### 2.3 Criar a planilha Google Sheets

Crie uma nova planilha no Google Drive com aba chamada **Vocabulário** e estas colunas na linha 1:

```
id | word | type | ipa | meaning_pt | examples | level | context | source_type | source_title | status | tags | has_audio | anki_id | created_at | updated_at
```

O ID da planilha está na URL:  
`https://docs.google.com/spreadsheets/d/**ID_AQUI**/edit`

Cole esse ID nos nodes "Salvar Google Sheets" e "Atualizar Sheets" (campo `documentId`).

### 2.4 Ativar os workflows

Após configurar as credenciais, ative cada workflow clicando no toggle no canto superior direito.

---

## Passo 3 — Configurar AnkiConnect

1. Instale o Anki desktop: https://apps.ankiweb.net
2. Instale o plugin AnkiConnect: Anki → Ferramentas → Complementos → Código: `2055492159`
3. Reinicie o Anki
4. O AnkiConnect fica disponível em `http://localhost:8765`

### Criar o modelo de nota (Note Type)

No Anki: **Ferramentas → Gerenciar tipos de nota → Adicionar → Básico**

Renomeie para **"Inglês Básico"** e adicione estes campos:
- `Frente` (obrigatório)
- `Verso` (obrigatório)
- `Contexto`
- `IPA`
- `Exemplos`
- `Áudio`

Template sugerido para **Frente**:
```html
<div class="word">{{Frente}}</div>
{{#IPA}}<div class="ipa">{{IPA}}</div>{{/IPA}}
{{#Contexto}}<div class="context">{{Contexto}}</div>{{/Contexto}}
```

Template sugerido para **Verso**:
```html
{{FrontSide}}
<hr>
<div class="meaning">{{Verso}}</div>
{{#Exemplos}}<div class="examples">{{Exemplos}}</div>{{/Exemplos}}
{{#Áudio}}{{Áudio}}{{/Áudio}}
```

---

## Passo 4 — Configurar a plataforma

Abra `plataforma-ingles.html` e vá em **Configurações**:

1. **URL base do n8n**: `https://seu-n8n.hostinger.com` (sem barra no final)
2. **Deck padrão**: `Inglês` (ou o nome do seu deck)
3. **Modelo de nota**: `Inglês Básico`
4. Mapeie os campos conforme os nomes que você usou
5. Clique **Testar conexão** para verificar n8n e AnkiConnect
6. **Salvar configurações**

---

## Uso diário

### Fluxo Kindle
1. No Kindle, exporte `My Clippings.txt` (copie do Kindle via USB)
2. Na plataforma → Adicionar → Kindle → arraste o arquivo
3. Clique na palavra alvo dentro de cada frase destacada
4. Selecione os itens e clique **Processar com IA**

### Fluxo Language Reactor
1. Enquanto assiste, anote palavras desconhecidas em TXT: `palavra :: frase onde apareceu`
2. Na plataforma → Adicionar → Language Reactor → cole ou arraste o arquivo
3. Processe os selecionados

### Fluxo Website
1. Na plataforma → Adicionar → Website → cole a URL
2. O n8n busca e o Claude identifica vocabulário B2+
3. Selecione o que quer estudar

### Revisar e enviar ao Anki
1. Vá para **Revisar**
2. Confira cada card — edite se necessário
3. Clique **Enviar ao Anki** (o Anki precisa estar aberto)

---

## Dicas

- O áudio é gerado pelo OpenAI (voz "nova") e fica como arquivo MP3 no Anki
- Se o n8n não estiver configurado, você pode usar a plataforma offline: adiciona palavras sem IA e preenche o significado manualmente na revisão
- Faça backup periodicamente: Configurações → Exportar JSON
- O badge vermelho na aba "Revisar" mostra quantas palavras estão aguardando
