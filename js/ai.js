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

// Modelo efetivo: o configurado, se for um modelo OpenAI plausível.
// Protege contra um cfg.aiModel antigo sincronizado da nuvem com um
// modelo de outro provedor (ex.: claude-*) — iria para a API errada.
function aiModel() {
  const m = (cfg.aiModel || '').trim()
  return /^(gpt-|o\d|chatgpt-)/.test(m) ? m : AI_DEFAULT_MODEL
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
async function _aiFetch(url, body, { timeoutMs = 90000, retries = 2 } = {}) {
  let lastErr = null
  for (let tent = 0; tent <= retries; tent++) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
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
  if (!cfg.openaiKey) throw new Error('Chave da OpenAI não configurada')
  const m = model || aiModel()
  const msgs = typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages
  const res = await _aiFetch('https://api.openai.com/v1/chat/completions', {
    model: m,
    response_format: { type: 'json_object' },
    messages: msgs,
    ..._aiTokenParam(m, maxTokens)
  }, { timeoutMs, retries })
  const data = await res.json()
  const raw = (data.choices?.[0]?.message?.content || '{}')
    .replace(/```(?:json)?\n?|\n?```/g, '').trim()
  try { return JSON.parse(raw) }
  catch { throw new Error('A IA retornou um JSON inválido') }
}

// Chat de texto puro (respostas curtas, sem JSON).
async function aiText(messages, { maxTokens, model, timeoutMs, retries } = {}) {
  if (!cfg.openaiKey) throw new Error('Chave da OpenAI não configurada')
  const m = model || aiModel()
  const msgs = typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages
  const res = await _aiFetch('https://api.openai.com/v1/chat/completions', {
    model: m, messages: msgs, ..._aiTokenParam(m, maxTokens)
  }, { timeoutMs, retries })
  const data = await res.json()
  return (data.choices?.[0]?.message?.content || '').trim()
}

// TTS — modelo e velocidade centralizados (antes 'tts-1' aparecia
// hardcoded em dois lugares com speed divergente).
const AI_TTS_MODEL = 'tts-1'
async function aiTTS(text, { voice, speed = 0.9, timeoutMs = 60000 } = {}) {
  if (!cfg.openaiKey) throw new Error('Chave da OpenAI não configurada')
  const res = await _aiFetch('https://api.openai.com/v1/audio/speech', {
    model: AI_TTS_MODEL, input: text, voice: voice || randomVoice(), speed
  }, { timeoutMs, retries: 1 })
  return blobToBase64(await res.blob())
}

// Imagem — retorna data URL base64.
async function aiImage(prompt, { size = '1024x1024', quality = 'medium', timeoutMs = 180000 } = {}) {
  if (!cfg.openaiKey) throw new Error('Chave da OpenAI não configurada')
  const res = await _aiFetch('https://api.openai.com/v1/images/generations', {
    model: 'gpt-image-1', prompt, n: 1, size, quality
  }, { timeoutMs, retries: 1 })
  const data = await res.json()
  if (data.data?.[0]?.b64_json) return 'data:image/png;base64,' + data.data[0].b64_json
  // fallback para modelos legados que retornam URL
  const blob = await (await fetch(data.data[0].url)).blob()
  return blobToBase64(blob)
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
