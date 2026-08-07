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

// CÓPIA DELIBERADA de `_aiTokenParam` (js/ai.js). O service worker não enxerga
// o código do app; se mudar lá, muda aqui.
//   · a família gpt-5/o* REJEITA `max_tokens` e exige `max_completion_tokens`
//     — era o erro "Unsupported parameter: 'max_tokens'" com o gpt-5.6-luna;
//   · e esses modelos gastam tokens de RACIOCÍNIO dentro do mesmo orçamento:
//     um teto dimensionado só para o texto visível some no raciocínio e volta
//     resposta VAZIA, cobrada. A OpenAI recomenda reservar ~25.000, e a folga
//     é de graça porque o teto é limite, não reserva.
const EXT_FOLGA_RACIOCINIO = 25000
function _extTeto(modelo, maxTokens) {
  if (!maxTokens) return {}
  return /^(gpt-5|o\d)/.test(String(modelo || ''))
    ? { max_completion_tokens: maxTokens + EXT_FOLGA_RACIOCINIO }
    : { max_tokens: maxTokens }
}

// FREIO DE TAXA. A extensão chamava a API direto, SEM nenhuma repetição: um
// 429 ("Rate limit reached … Limit 500, Used 500") virava erro na cara do
// aluno no meio do episódio. O app ganhou freio global na 94ª rodada; aqui vai
// o equivalente, porque este arquivo fala com a OpenAI por conta própria.
let _extFreioAte = 0
function _extEsperaDoErro(msg, cab) {
  const h = parseFloat(cab) * 1000
  if (h > 0) return h
  const m = /try again in ([\d.]+)\s*(ms|s)\b/i.exec(String(msg || ''))
  if (m) return parseFloat(m[1]) * (m[2].toLowerCase() === 's' ? 1000 : 1)
  return 0
}

async function chamar(messages, maxTokens = 300, tentativas = 2) {
  const cfg = await cfgAtual()
  if (!cfg) throw new Error('Abra o Language Lab uma vez para a extensão receber sua chave de IA')
  let ultimo = null
  for (let t = 0; t <= tentativas; t++) {
    // Um 429 anterior segura TODAS as chamadas, não só a que apanhou.
    while (Date.now() < _extFreioAte) {
      await new Promise(r => setTimeout(r, Math.min(2000, _extFreioAte - Date.now() + 20)))
    }
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 30000)
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: cfg.modelo, messages, ..._extTeto(cfg.modelo, maxTokens) }),
        signal: ctl.signal
      })
      if (!res.ok) {
        let m = 'HTTP ' + res.status
        try { const e = await res.json(); if (e.error?.message) m = e.error.message } catch {}
        ultimo = new Error(`[${cfg.nome}] ${m}`)
        const retryavel = res.status === 429 || res.status >= 500
        if (!retryavel || t === tentativas) throw ultimo
        let espera = _extEsperaDoErro(m, res.headers.get('retry-after')) || (t + 1) * 1500
        // Piso de 1,2s mesmo quando a API pede 120ms: o que ela mede é a
        // janela dela, e voltar cedo demais com a fila cheia reestoura.
        if (res.status === 429) {
          espera = Math.max(espera, 1200)
          _extFreioAte = Math.max(_extFreioAte, Date.now() + espera)
        }
        await new Promise(r => setTimeout(r, espera))
        continue
      }
      const data = await res.json()
      const msg = data.choices?.[0]?.message || {}
      const txt = String(msg.content || msg.reasoning_content || '').trim()
      if (txt) return txt
      // Vazio com finish_reason 'length' = o raciocínio comeu o orçamento.
      const fim = data.choices?.[0]?.finish_reason
      ultimo = new Error(`[${cfg.nome}] ` + (fim === 'length'
        ? 'o teto de tokens acabou durante o raciocínio — a chamada foi cobrada mesmo assim'
        : 'resposta vazia'))
      if (t === tentativas) throw ultimo
    } catch (e) {
      if (e === ultimo) { if (t === tentativas) throw e; continue }
      ultimo = e.name === 'AbortError' ? new Error(`[${cfg.nome}] sem resposta em 30s`) : e
      if (t === tentativas) throw ultimo
      await new Promise(r => setTimeout(r, (t + 1) * 1500))
    } finally { clearTimeout(timer) }
  }
  throw ultimo || new Error('falha na chamada de IA')
}

// A MESMA Lexa do app (js/ai.js → lexaSistema). Aqui é uma cópia porque o
// service worker da extensão não enxerga o código do Language Lab — se um dia
// a persona mudar lá, muda aqui também, senão viram duas pessoas.
// O grosso do texto é PROIBIÇÃO de caricatura: modelo barato, se você disser
// só "paraense e bem-humorada", devolve "égua, maninho!" em toda resposta.
const SIS_LEXA = `Você é a Lexa, tutora de inglês do Language Lab. Mulher, paraense de Belém, jovem, muito inteligente e prática — aprendeu inglês na marra, assistindo série e lendo, então sabe exatamente onde dói.

COMO ELA SOA (isto pesa mais que o conteúdo):
- Calorosa e direta ao mesmo tempo. Fala como gente: "olha", "repara", "na prática".
- Bom humor em dose homeopática: no máximo uma piscadela por resposta, e só quando cabe sozinha. Se a explicação já está boa, não force graça nenhuma.
- Ser paraense é JEITO, não vocabulário: acolhedora, sem cerimônia, resolve rápido. NUNCA escreva "égua", "maninho", "maninha", "pai d'égua", "arre", "vixe" nem qualquer marca regional. Nada de sotaque escrito, nada de personagem.
- Nunca se apresenta, nunca fala de si mesma, nunca usa emoji, nunca abre com "Claro!", "Ótima pergunta" ou "Vamos lá".
- Trata o aluno por você, sem diminutivos condescendentes.

TAREFA AGORA: explicar um trecho para o aluno, em português do Brasil.
- 2 a 4 frases. Sem introdução, sem repetir a pergunta, sem despedida.
- Traduza o SENTIDO na cena, nunca palavra por palavra.
- Decida O QUE a coisa É nesta cena e use a palavra portuguesa DAQUILO ("barrel" de fuzil é "cano", nunca "barril") — sem ficar em cima do muro entre dois domínios.
- Gíria, marca, referência cultural ou nome próprio: diga o que é no mundo real.`

// Mesma âncora anti-literal do app (não traduzir palavra por palavra)
// CÓPIA das regras lexicais do app (lang.js → promptRegrasLexicais 'traducao')
// — o service worker não enxerga o código do Language Lab. Mudou lá, muda aqui.
const SIS_TRAD = 'Você traduz legendas de séries/filmes para estudo de inglês. Traduza cada fala numerada para português do Brasil, natural e curto. Traduza o SENTIDO na cena, nunca palavra por palavra ("we\'ll get you in" = "a gente te encaixa", não "colocar você dentro"). Decida O QUE a coisa É na frase e use a palavra portuguesa DAQUILO — "barrel" de fuzil é "cano", nunca "barril"; jamais fique em cima do muro entre dois domínios. Teste: devolva sua tradução à frase — se ela parar de dizer o que o inglês diz, está errada. Palavrões fazem parte do diálogo: traduza fielmente. Responda SÓ as traduções, uma por linha, mantendo o número: "1. tradução". Nada além disso.'

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
          { role: 'system', content: SIS_LEXA },
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
