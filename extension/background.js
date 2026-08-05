// ================================================================
// SERVICE WORKER — o único que fala com as APIs de IA.
// Motivo: chamada feita daqui não sofre CORS da origem netflix.com e as
// chaves nunca entram no contexto da página. As chaves são espelhadas do
// próprio Language Lab pela ponte (bridge.js) — a extensão não pede nada.
// ================================================================
'use strict'

const PROV = {
  openai:   { url: 'https://api.openai.com/v1/chat/completions', key: 'openaiKey', model: 'gpt-4o-mini' },
  deepseek: { url: 'https://api.deepseek.com/chat/completions', key: 'deepseekKey', model: 'deepseek-v4-flash' },
  gemini:   { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: 'geminiKey', model: 'gemini-2.5-flash-lite' },
  groq:     { url: 'https://api.groq.com/openai/v1/chat/completions', key: 'groqKey', model: 'llama-3.3-70b-versatile' }
}

async function cfgAtual() {
  const { llcfg } = await chrome.storage.local.get({ llcfg: null })
  const c = llcfg || {}
  const prov = PROV[c.aiProvider] ? c.aiProvider : 'openai'
  const chave = (c[PROV[prov].key] || '').trim()
  if (chave) {
    const modelo = (c.aiModelProv && c.aiModelProv[prov]) || PROV[prov].model
    return { url: PROV[prov].url, chave, modelo, nome: prov }
  }
  // sem chave do fornecedor ativo: usa a primeira disponível
  for (const [p, d] of Object.entries(PROV)) {
    const k = (c[d.key] || '').trim()
    if (k) return { url: d.url, chave: k, modelo: (c.aiModelProv && c.aiModelProv[p]) || d.model, nome: p }
  }
  return null
}

async function chamar(messages, maxTokens = 300) {
  const cfg = await cfgAtual()
  if (!cfg) throw new Error('Abra o Language Lab uma vez para a extensão receber sua chave de IA')
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 30000)
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.modelo, messages, max_tokens: maxTokens }),
      signal: ctl.signal
    })
    if (!res.ok) {
      let m = 'HTTP ' + res.status
      try { const e = await res.json(); if (e.error?.message) m = e.error.message } catch {}
      throw new Error(`[${cfg.nome}] ${m}`)
    }
    const data = await res.json()
    const msg = data.choices?.[0]?.message || {}
    return String(msg.content || msg.reasoning_content || '').trim()
  } finally { clearTimeout(timer) }
}

// Mesma âncora anti-literal do app (não traduzir palavra por palavra)
const SIS_TRAD = 'Você traduz legendas de séries/filmes para estudo de inglês. Traduza cada fala numerada para português do Brasil, natural e curto. Expressões idiomáticas e phrasal verbs: traduza o SENTIDO na cena, nunca palavra por palavra ("we\'ll get you in" = "a gente te encaixa", não "colocar você dentro"). Palavrões fazem parte do diálogo: traduza fielmente. Responda SÓ as traduções, uma por linha, mantendo o número: "1. tradução". Nada além disso.'

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  ;(async () => {
    try {
      if (msg.type === 'ai-traduzir') {
        const linhas = msg.falas.map((t, i) => `${i + 1}. ${t}`).join('\n')
        const resp = await chamar([
          { role: 'system', content: SIS_TRAD },
          { role: 'user', content: linhas }
        ], 140 * msg.falas.length + 200)
        const mapa = {}
        for (const ln of resp.split('\n')) {
          const m = ln.match(/^\s*\**\s*(\d+)\s*[.):\-]+\**\s*(.+)$/)
          if (m) mapa[+m[1]] = m[2].trim().replace(/^\*+|\*+$/g, '')
        }
        sendResponse({ ok: true, pt: msg.falas.map((_, i) => mapa[i + 1] || '') })
      } else if (msg.type === 'ai-explicar') {
        const resp = await chamar([
          { role: 'system', content: 'Tutor de inglês de um brasileiro. Responda em PT-BR, direto ao ponto, 2 a 4 frases, sem introduções.' },
          { role: 'user', content: `Na cena de "${msg.titulo || ''}", a fala é: "${msg.contexto}". O aluno selecionou: "${msg.alvo}".\nExplique o que "${msg.alvo}" significa AQUI. Se for gíria, marca, referência cultural ou nome próprio, diga o que é no mundo real. Traduza o SENTIDO, nunca palavra por palavra.` }
        ], 600)
        if (!resp) throw new Error('a IA devolveu uma resposta vazia')
        sendResponse({ ok: true, texto: resp })
      } else {
        sendResponse({ ok: false, erro: 'tipo desconhecido' })
      }
    } catch (e) { sendResponse({ ok: false, erro: e.message }) }
  })()
  return true   // resposta assíncrona
})
