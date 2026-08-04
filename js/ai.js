// ================================================================
// GATEWAY DE IA — todas as chamadas à OpenAI passam por aqui.
//
// Por que existe (2026-07-31): o projeto tinha 16 pontos de chamada em
// 6 arquivos, com 5 implementações duplicadas do mesmo fetch e TRÊS
// defeitos sistêmicos que este arquivo corrige de uma vez:
//   1. NENHUMA chamada tinha timeout — uma rede pendurada deixava o
//      spinner girando para sempre;
//   2. NENHUMA tinha retry — um 429 (limite de taxa) no meio de um lote
//      (Kindle 25 itens, enriquecimento de documento, pool de áudio)
//      perdia itens em silêncio;
//   3. o erro subia como "HTTP 401" sem a mensagem real da OpenAI
//      ("Incorrect API key…", "You exceeded your quota…").
//
// NÃO-lazy (carregado logo após lang.js): audio.js e review.js, que são
// não-lazy, dependem dele — ver armadilha nº 1 no ESTADO-DO-PROJETO.
// O streaming do Assistente (consulta.js) fica FORA por desenho: SSE tem
// ciclo de vida próprio e retry automático duplicaria respostas.
// ================================================================

const AI_DEFAULT_MODEL = 'gpt-4o-mini'

// ================================================================
// FORNECEDORES DE IA (análise, traduções e chat).
// Todos falam o "dialeto" OpenAI (chat/completions + Bearer), o que
// permite trocar de fornecedor sem tocar no resto do app.
// ÁUDIO (TTS), IMAGENS e TRANSCRIÇÃO (Whisper) usam SEMPRE a OpenAI —
// os outros não têm equivalente compatível no navegador.
// Faixas de custo: rótulos curados (ordem de grandeza, não fatura).
// ================================================================
const AI_PROVIDERS = {
  openai: {
    nome: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    modelsUrl: 'https://api.openai.com/v1/models',
    keyCfg: 'openaiKey',
    placeholder: 'sk-proj-...',
    // `preco`: US$ por 1 MILHÃO de tokens (entrada/saída), preço de tabela do
    // fornecedor (conferido em ago/2026). É daqui que sai a estimativa em reais.
    modelos: [
      { id: 'gpt-4o-mini',  tier: 'baixo', nota: 'rápido e barato (padrão do app)', preco: { in: 0.15, out: 0.60 } },
      { id: 'gpt-4.1-mini', tier: 'baixo', nota: 'melhor texto, preço próximo',     preco: { in: 0.40, out: 1.60 } },
      { id: 'gpt-4o',       tier: 'médio', nota: 'equilibrado',                     preco: { in: 2.50, out: 10.00 } },
      { id: 'gpt-5-mini',   tier: 'médio', nota: 'nova geração',                    preco: { in: 0.25, out: 2.00 } },
      { id: 'gpt-5',        tier: 'alto',  nota: 'mais capaz',                      preco: { in: 1.25, out: 10.00 } },
    ]
  },
  gemini: {
    nome: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    keyCfg: 'geminiKey',
    placeholder: 'AIza...',
    modelos: [
      { id: 'gemini-2.5-flash-lite', tier: 'baixo', nota: 'o mais barato da casa',  preco: { in: 0.10, out: 0.40 } },
      { id: 'gemini-2.5-flash',      tier: 'baixo', nota: 'ótimo custo-benefício',  preco: { in: 0.30, out: 2.50 } },
      { id: 'gemini-2.5-pro',        tier: 'alto',  nota: 'mais capaz',             preco: { in: 1.25, out: 10.00 } },
    ]
  },
  deepseek: {
    nome: 'DeepSeek',
    url: 'https://api.deepseek.com/chat/completions',
    modelsUrl: 'https://api.deepseek.com/models',
    keyCfg: 'deepseekKey',
    placeholder: 'sk-...',
    // IDs V4 confirmados na doc oficial (2026-08): os aliases antigos
    // deepseek-chat/reasoner foram DESCONTINUADOS em 2026-07-24 — quem os
    // tinha salvo cai no primeiro da lista via validação do aiModel().
    // Atenção ao preço dinâmico: 2× no horário de pico da China.
    modelos: [
      { id: 'deepseek-v4-flash', tier: 'baixo', nota: 'V4 — muito barato, cache quase grátis', preco: { in: 0.14,  out: 0.28 } },
      { id: 'deepseek-v4-pro',   tier: 'médio', nota: 'V4 — mais capaz',                       preco: { in: 0.435, out: 0.87 } },
    ]
  },
  groq: {
    nome: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    modelsUrl: 'https://api.groq.com/openai/v1/models',
    keyCfg: 'groqKey',
    placeholder: 'gsk_...',
    modelos: [
      { id: 'llama-3.1-8b-instant',    tier: 'baixo', nota: 'muito rápido, quase grátis',    preco: { in: 0.05, out: 0.08 } },
      { id: 'llama-3.3-70b-versatile', tier: 'baixo', nota: 'mais qualidade, ainda barato',  preco: { in: 0.59, out: 0.79 } },
      { id: 'openai/gpt-oss-120b',     tier: 'médio', nota: 'modelo aberto grande',          preco: { in: 0.15, out: 0.75 } },
    ]
  }
}

function aiProviderAtual() {
  return AI_PROVIDERS[cfg.aiProvider] ? cfg.aiProvider : 'openai'
}
// Config completa do chat corrente: fornecedor + chave + modelo
function aiChatCfg() {
  const prov = aiProviderAtual()
  const P = AI_PROVIDERS[prov]
  return { prov, P, key: (cfg[P.keyCfg] || '').trim(), model: aiModel() }
}

// Modelo efetivo: o configurado, se for um modelo OpenAI plausível.
// Protege contra um cfg.aiModel antigo sincronizado da nuvem com um
// modelo de outro provedor (ex.: claude-*) — iria para a API errada.
function aiModel() {
  const prov = aiProviderAtual()
  const lista = AI_PROVIDERS[prov].modelos
  // por fornecedor (aiModelProv); legado: cfg.aiModel vale para a OpenAI
  const salvo = ((cfg.aiModelProv || {})[prov]) || (prov === 'openai' ? (cfg.aiModel || '').trim() : '')
  return lista.some(m => m.id === salvo) ? salvo : lista[0].id
}

// A família gpt-5/o* rejeita `max_tokens` (exige `max_completion_tokens`).
function _aiTokenParam(model, maxTokens) {
  if (!maxTokens) return {}
  return /^(gpt-5|o\d)/.test(model)
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens }
}

// fetch com timeout + retry.
// Retenta em 429/5xx/queda de rede (2 vezes, backoff 1s→3s, respeitando
// Retry-After). NUNCA retenta 4xx de verdade (chave errada não melhora
// tentando de novo). O corpo do erro da OpenAI vira a mensagem do Error.
async function _aiFetch(url, body, { timeoutMs = 90000, retries = 2, key } = {}) {
  let lastErr = null
  for (let tent = 0; tent <= retries; tent++) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key || cfg.openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl.signal
      })
      clearTimeout(timer)
      if (res.ok) return res
      let msg = 'HTTP ' + res.status
      try { const e = await res.json(); if (e.error?.message) msg = e.error.message } catch {}
      const retryavel = res.status === 429 || res.status >= 500
      lastErr = new Error(msg)
      lastErr.status = res.status
      if (!retryavel || tent === retries) throw lastErr
      const after = parseFloat(res.headers.get('retry-after')) * 1000
      await new Promise(r => setTimeout(r, after > 0 ? after : (tent + 1) * 1500))
    } catch (e) {
      clearTimeout(timer)
      if (e === lastErr) throw e                       // HTTP não-retryável já decidido acima
      const eraTimeout = e.name === 'AbortError'
      lastErr = eraTimeout ? new Error(`Sem resposta da OpenAI em ${timeoutMs / 1000}s`) : e
      if (tent === retries) throw lastErr
      await new Promise(r => setTimeout(r, (tent + 1) * 1500))
    }
  }
  throw lastErr
}

// Chat que retorna JSON (response_format json_object).
// Aceita string única (vira mensagem de user) ou array de mensagens.
async function aiJSON(messages, { maxTokens, model, timeoutMs, retries } = {}) {
  const chat = aiChatCfg()
  if (!chat.key) throw new Error('Chave da ' + chat.P.nome + ' não configurada (Configurações → IA)')
  const m = model || chat.model
  const msgs = typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages
  const res = await _aiFetch(chat.P.url, {
    model: m,
    response_format: { type: 'json_object' },
    messages: msgs,
    ..._aiTokenParam(m, maxTokens)
  }, { timeoutMs, retries, key: chat.key })
  const data = await res.json()
  const raw = (data.choices?.[0]?.message?.content || '{}')
    .replace(/```(?:json)?\n?|\n?```/g, '').trim()
  try { return JSON.parse(raw) }
  catch { throw new Error('A IA retornou um JSON inválido') }
}

// Chat de texto puro (respostas curtas, sem JSON).
async function aiText(messages, { maxTokens, model, timeoutMs, retries } = {}) {
  const chat = aiChatCfg()
  if (!chat.key) throw new Error('Chave da ' + chat.P.nome + ' não configurada (Configurações → IA)')
  const m = model || chat.model
  const msgs = typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages
  const res = await _aiFetch(chat.P.url, {
    model: m, messages: msgs, ..._aiTokenParam(m, maxTokens)
  }, { timeoutMs, retries, key: chat.key })
  const data = await res.json()
  const msg = data.choices?.[0]?.message || {}
  // `reasoning_content`: modelos que "pensam" às vezes gastam todo o orçamento
  // no raciocínio e devolvem content vazio — melhor mostrar o que veio.
  return String(msg.content || msg.reasoning_content || '').trim()
}

// Texto com REDE DE SEGURANÇA: se o fornecedor ativo devolver vazio (o
// DeepSeek faz isso em certas frases) ou falhar, repete na OpenAI quando há
// chave. É o que garante que "Explicar" nunca fique mudo.
async function aiTextSeguro(messages, opts = {}) {
  let erro = null
  try {
    const r = await aiText(messages, opts)
    if (r) return r
  } catch (e) { erro = e }
  if (aiProviderAtual() !== 'openai' && cfg.openaiKey) {
    try {
      const res = await _aiFetch('https://api.openai.com/v1/chat/completions', {
        model: AI_DEFAULT_MODEL,
        messages: typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages,
        ..._aiTokenParam(AI_DEFAULT_MODEL, opts.maxTokens)
      }, { timeoutMs: opts.timeoutMs, retries: 1, key: cfg.openaiKey })
      const data = await res.json()
      const t = String(data.choices?.[0]?.message?.content || '').trim()
      if (t) return t
    } catch (e) { erro = erro || e }
  }
  throw erro || new Error('a IA devolveu uma resposta vazia')
}

// TTS — tenta o gpt-4o-mini-tts (mais barato, aceita instrução de estilo);
// se a conta/modelo recusar, cai no tts-1 clássico na mesma chamada.
// O resultado é cacheado por texto no AudioDB, então o fallback custa
// no máximo uma tentativa extra por frase nova.
const AI_TTS_MODEL = 'gpt-4o-mini-tts'
const AI_TTS_FALLBACK = 'tts-1'
async function aiTTS(text, { voice, speed = 0.9, timeoutMs = 60000 } = {}) {
  if (!cfg.openaiKey) throw new Error('Chave da OpenAI não configurada')
  const v = voice || randomVoice()
  try {
    const res = await _aiFetch('https://api.openai.com/v1/audio/speech', {
      model: AI_TTS_MODEL, input: text, voice: v,
      instructions: 'Speak clearly at a slightly slow pace, for a language learner.'
    }, { timeoutMs, retries: 0 })
    return blobToBase64(await res.blob())
  } catch (e) {
    const res = await _aiFetch('https://api.openai.com/v1/audio/speech', {
      model: AI_TTS_FALLBACK, input: text, voice: v, speed
    }, { timeoutMs, retries: 1 })
    return blobToBase64(await res.blob())
  }
}

// ---- IMAGENS ---------------------------------------------------
// Dois fornecedores, três níveis cada (cfg.imgProvider + cfg.imgQuality).
// Preços por imagem 1024×1024, tabela de ago/2026. O Gemini NÃO entra pela
// camada compatível com a OpenAI — tem endpoint e formato próprios.
const AI_IMG = {
  openai: {
    nome: 'OpenAI', keyCfg: 'openaiKey',
    niveis: {
      low:    { model: 'gpt-image-1', quality: 'low',    usd: 0.011, rotulo: 'Econômica' },
      medium: { model: 'gpt-image-1', quality: 'medium', usd: 0.042, rotulo: 'Padrão' },
      high:   { model: 'gpt-image-1', quality: 'high',   usd: 0.167, rotulo: 'Alta' }
    }
  },
  gemini: {
    nome: 'Google Gemini', keyCfg: 'geminiKey',
    niveis: {
      low:    { model: 'gemini-2.5-flash-image', usd: 0.039, rotulo: 'Nano Banana (2.5 Flash)' },
      medium: { model: 'gemini-3.1-flash-image', usd: 0.067, rotulo: 'Nano Banana 2 (3.1 Flash)' },
      high:   { model: 'gemini-3-pro-image',     usd: 0.134, rotulo: 'Nano Banana Pro (3 Pro)' }
    }
  }
}

function aiImgProvider() { return AI_IMG[cfg.imgProvider] ? cfg.imgProvider : 'openai' }
function aiImgNivel(quality) {
  const P = AI_IMG[aiImgProvider()]
  const q = quality || cfg.imgQuality || 'medium'
  return { prov: aiImgProvider(), P, q, ...(P.niveis[q] || P.niveis.medium) }
}

// Imagem — retorna data URL base64 (contrato usado por audio.js/study).
async function aiImage(prompt, { size = '1024x1024', quality, timeoutMs = 180000 } = {}) {
  const n = aiImgNivel(quality)
  const key = (cfg[n.P.keyCfg] || '').trim()
  if (!key) throw new Error(`Chave da ${n.P.nome} não configurada (Configurações → IA)`)
  return n.prov === 'gemini'
    ? _aiImageGemini(prompt, n.model, key, timeoutMs)
    : _aiImageOpenAI(prompt, n.quality, size, timeoutMs)
}

async function _aiImageOpenAI(prompt, quality, size, timeoutMs) {
  const res = await _aiFetch('https://api.openai.com/v1/images/generations', {
    model: 'gpt-image-1', prompt, n: 1, size, quality
  }, { timeoutMs, retries: 1 })
  const data = await res.json()
  if (data.data?.[0]?.b64_json) return 'data:image/png;base64,' + data.data[0].b64_json
  // fallback para modelos legados que retornam URL
  const blob = await (await fetch(data.data[0].url)).blob()
  return blobToBase64(blob)
}

// O Gemini tem DUAS rotas para gerar imagem: a clássica `:generateContent` e
// a nova `/interactions`. Tenta a clássica e cai na nova se o modelo só
// existir lá — assim um modelo novo não quebra a geração.
async function _aiImageGemini(prompt, model, key, timeoutMs) {
  const tentativas = [
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['Image'] } }
    },
    {
      url: 'https://generativelanguage.googleapis.com/v1beta/interactions',
      body: { model, input: [{ type: 'text', text: prompt }], response_format: { type: 'image', mime_type: 'image/png' } }
    }
  ]
  let ultimoErro = null
  for (const t of tentativas) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      const res = await fetch(t.url, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(t.body), signal: ctl.signal
      })
      if (!res.ok) {
        let m = 'HTTP ' + res.status
        try { const e = await res.json(); if (e.error?.message) m = e.error.message } catch {}
        ultimoErro = new Error(`[Gemini] ${m}`)
        if (res.status === 404 || res.status === 400) continue   // rota/modelo não existe aqui: tenta a outra
        throw ultimoErro
      }
      const img = _aiGeminiImgDaResposta(await res.json())
      if (img) return img
      ultimoErro = new Error('[Gemini] a resposta não trouxe imagem (o prompt pode ter sido recusado)')
    } catch (e) {
      ultimoErro = e.name === 'AbortError' ? new Error('[Gemini] tempo esgotado ao gerar a imagem') : e
    } finally { clearTimeout(timer) }
  }
  throw ultimoErro || new Error('[Gemini] falha ao gerar a imagem')
}

// Aceita os dois formatos de resposta (parts[].inlineData e output_image)
function _aiGeminiImgDaResposta(j) {
  const parts = j?.candidates?.[0]?.content?.parts || []
  for (const p of parts) {
    const inline = p.inlineData || p.inline_data
    if (inline?.data) return `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,` + inline.data
  }
  const oi = j?.output_image || j?.outputImage
  if (oi?.data) return `data:${oi.mime_type || oi.mimeType || 'image/png'};base64,` + oi.data
  for (const o of (j?.output || [])) {
    if (o?.data && (o.type === 'image' || o.mime_type?.startsWith('image/'))) {
      return `data:${o.mime_type || 'image/png'};base64,` + o.data
    }
  }
  return null
}

// Teste de chave POR FORNECEDOR: GET /models não consome token nenhum.
async function aiTestKeyProv(prov, key) {
  const P = AI_PROVIDERS[prov]
  if (!P) return { ok: false, msg: 'fornecedor desconhecido' }
  try {
    const res = await fetch(P.modelsUrl, { headers: { 'Authorization': `Bearer ${key}` } })
    if (res.ok) return { ok: true }
    let msg = 'HTTP ' + res.status
    try { const e = await res.json(); if (e.error?.message) msg = e.error.message } catch {}
    return { ok: false, msg }
  } catch (e) { return { ok: false, msg: e.message } }
}

// Teste de chave: GET /v1/models não consome token nenhum.
async function aiTestKey(key) {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${key || cfg.openaiKey}` }
  })
  if (res.ok) return { ok: true }
  let msg = 'HTTP ' + res.status
  try { const e = await res.json(); if (e.error?.message) msg = e.error.message } catch {}
  return { ok: false, msg }
}

// ================================================================
// ESTIMATIVA DE CUSTO para operações em lote — exibida em REAIS.
// A OpenAI cobra em dólar; convertemos com a cotação comercial do dia
// (AwesomeAPI, gratuita, cacheada por 24h) e caímos num câmbio fixo se
// a consulta falhar. Ordens de grandeza, não fatura.
// ================================================================
const AI_COST = {
  // gpt-4o-mini-tts cobra ~US$ 0,015 por MINUTO de áudio gerado; a frase de um
  // card tem ~5s. O valor antigo (0,008) vinha da tabela por caractere do
  // tts-1 e superestimava a conta em ~6×.
  tts:   0.015 * (5 / 60)                           // ≈ US$ 0,00125 por frase falada
  // imagens: preço por nível vive em AI_IMG (varia com o fornecedor escolhido)
}

// ---- TRANSCRIÇÃO (fala → texto) --------------------------------
// A Groq roda o MESMO Whisper num endpoint idêntico ao da OpenAI
// (api.groq.com/openai/v1/audio/transcriptions, verbose_json com
// timestamps) por US$ 0,04/h contra US$ 0,36/h — 9× mais barato.
// Por isso o padrão é "auto": usa a Groq quando há chave, senão OpenAI.
const AI_STT = {
  groq:   { nome: 'Groq', url: 'https://api.groq.com/openai/v1/audio/transcriptions',
            model: 'whisper-large-v3-turbo', keyCfg: 'groqKey', usdMin: 0.04 / 60, limiteMB: 25 },
  openai: { nome: 'OpenAI', url: 'https://api.openai.com/v1/audio/transcriptions',
            model: 'whisper-1', keyCfg: 'openaiKey', usdMin: 0.006, limiteMB: 25 }
}

// Qual fornecedor transcreve agora (cfg.sttProvider: 'auto' | 'groq' | 'openai')
function aiSttCfg() {
  const pref = cfg.sttProvider || 'auto'
  const tem = p => !!(cfg[AI_STT[p].keyCfg] || '').trim()
  const prov = (pref !== 'auto' && tem(pref)) ? pref
    : tem('groq') ? 'groq'
    : tem('openai') ? 'openai'
    : null
  return prov ? { prov, ...AI_STT[prov], key: cfg[AI_STT[prov].keyCfg].trim() } : null
}

// Transcrição única para todo o app (legenda inteira, sincronia, shadowing).
// `granular`: pede os tempos por segmento (verbose_json).
async function aiTranscribe(blob, { nome = 'audio.webm', lang, granular = true, timeoutMs = 120000 } = {}) {
  const stt = aiSttCfg()
  if (!stt) throw new Error('Configure a chave da Groq ou da OpenAI para transcrever (Configurações → IA)')
  const fd = new FormData()
  fd.append('file', blob, nome)
  fd.append('model', stt.model)
  if (granular) fd.append('response_format', 'verbose_json')
  if (lang) fd.append('language', lang)
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(stt.url, {
      method: 'POST', headers: { 'Authorization': `Bearer ${stt.key}` }, body: fd, signal: ctl.signal
    })
    if (!res.ok) {
      let m = 'HTTP ' + res.status
      try { const e = await res.json(); if (e.error?.message) m = e.error.message } catch {}
      throw new Error(`[${stt.nome}] ${m}`)
    }
    return await res.json()
  } finally { clearTimeout(timer) }
}

// Tokens médios de UMA análise de item (prompt do card + resposta), medidos
// nos lotes reais do app. Multiplicados pelo preço do MODELO ATIVO — é isso
// que faz a estimativa acompanhar a troca de modelo/fornecedor (antes o custo
// de chat era um número fixo calibrado no gpt-4o-mini).
const AI_TOKENS_ITEM = { in: 1800, out: 900 }

// Preço (US$/1M tokens) do modelo indicado, procurado em todos os fornecedores.
function aiPrecoModelo(id) {
  const alvo = id || aiModel()
  for (const P of Object.values(AI_PROVIDERS)) {
    const m = (P.modelos || []).find(x => x.id === alvo)
    if (m && m.preco) return m.preco
  }
  return { in: 0.15, out: 0.60 }        // desconhecido: assume o preço do mini
}

// Custo em dólar de `n` análises no modelo ativo.
function aiCustoChatUsd(n = 1) {
  const p = aiPrecoModelo()
  return n * (AI_TOKENS_ITEM.in * p.in + AI_TOKENS_ITEM.out * p.out) / 1e6
}
const AI_USD_BRL_FALLBACK = 5.5
const SK_USD_BRL = 'el-usd-brl'

async function aiUsdBrl() {
  try {
    const cache = JSON.parse(localStorage.getItem(SK_USD_BRL) || 'null')
    if (cache && Date.now() - cache.at < 24 * 3600e3) return cache.rate
  } catch {}
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 3500)
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', { signal: ctl.signal })
    clearTimeout(t)
    const j = await res.json()
    const rate = parseFloat(j?.USDBRL?.bid)
    if (rate > 0) {
      try { localStorage.setItem(SK_USD_BRL, JSON.stringify({ rate, at: Date.now() })) } catch {}
      return rate
    }
  } catch {}
  try {
    const velho = JSON.parse(localStorage.getItem(SK_USD_BRL) || 'null')
    if (velho?.rate > 0) return velho.rate           // cotação vencida > chute fixo
  } catch {}
  return AI_USD_BRL_FALLBACK
}

function _aiUnitUsd(tipo) {
  // Cada imagem custa também a chamada de texto que descreve a cena
  // (buildImageScene, em audio.js) — ~2% do total, mas entra na conta.
  if (tipo === 'image') return aiImgNivel().usd + aiCustoChatUsd(1)
  if (tipo === 'chat') return aiCustoChatUsd(1)
  return AI_COST[tipo] || 0.001
}

function _brl(v) { return 'R$ ' + (v < 0.01 ? '0,01' : v.toFixed(2).replace('.', ',')) }

// Mantida para exibições avulsas — agora precisa da cotação, então é async.
async function aiEstimate(tipo, n) {
  const usd = _aiUnitUsd(tipo) * n
  return _brl(usd * await aiUsdBrl())
}

// Confirmação antes de um lote que custa dinheiro — modal de verdade,
// com o detalhamento em reais. Lotes < ~R$ 0,12 não interrompem
// (confirmar centavos é atrito).
async function aiConfirmBatch(tipo, n, rotulo, opts = {}) {
  const usd = _aiUnitUsd(tipo) * n
  // "sempre": operações que REESCREVEM conteúdo confirmam mesmo custando centavos.
  if (usd < 0.022 && !opts.sempre) return true
  const rate = await aiUsdBrl()
  const total = usd * rate
  const NOMES = { chat: 'Análise com IA', tts: 'Geração de áudio (TTS)', image: 'Geração de imagens' }
  const ni = aiImgNivel()
  const detalheModelo = tipo === 'chat' ? `${aiChatCfg().P.nome} · ${aiModel()}`
    : tipo === 'tts' ? `OpenAI · ${AI_TTS_MODEL}`
    : `${ni.P.nome} · ${ni.model}${ni.quality ? ' · ' + ni.rotulo.toLowerCase() : ''}`
  // De onde sai a conta — o Djemeson pediu para entender a origem do número
  const pm = aiPrecoModelo()
  const base = tipo === 'chat'
    ? `~${AI_TOKENS_ITEM.in} tokens de entrada + ~${AI_TOKENS_ITEM.out} de saída por item, ao preço deste modelo (US$ ${pm.in}/${pm.out} por 1M)`
    : tipo === 'tts' ? 'US$ 0,015 por minuto de áudio (gpt-4o-mini-tts) × ~5s por frase'
    : `US$ ${ni.usd.toFixed(3)} por imagem 1024×1024 + a chamada de texto que descreve a cena`
  return confirmModal({
    title: rotulo || NOMES[tipo] || 'Operação com IA',
    icon: 'sparkles',
    confirmText: 'Continuar — ' + _brl(total),
    html: `
      <div class="cost-rows">
        <div class="cost-row"><span>Operação</span><b>${esc(NOMES[tipo] || tipo)}</b></div>
        <div class="cost-row"><span>Chamadas</span><b>${n}</b></div>
        <div class="cost-row"><span>Modelo</span><b>${esc(detalheModelo)}</b></div>
        <div class="cost-row"><span>Base do cálculo</span><b>${esc(base)}</b></div>
        <div class="cost-row total"><span>Custo estimado</span><b>${_brl(total)}</b></div>
      </div>
      ${opts.detalhe ? `<ul class="cost-bullets">${opts.detalhe.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      <p class="cost-note">Estimativa pela cotação de hoje (US$ 1 ≈ R$ ${rate.toFixed(2).replace('.', ',')}) — muda junto com o modelo escolhido. A cobrança real é feita pelo fornecedor, em dólar, na sua conta.</p>`
  })
}
