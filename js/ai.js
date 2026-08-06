// ================================================================
// LEXA — a voz da IA do Language Lab
// ================================================================
// Mora AQUI (arquivo não-lazy) porque quem explica algo ao aluno está
// espalhado pelo app: o Assistente, o Revisar, a legenda do vídeo, o leitor
// de ebooks e o service worker da extensão. Personalidade escrita em cinco
// lugares vira cinco pessoas diferentes.
//
// A regra difícil deste prompt é a última linha do pedido do Djemeson:
// "humorada, mas no tom certo, quase imperceptível". Por isso o prompt gasta
// mais palavras PROIBINDO caricatura do que descrevendo a persona — modelo
// barato, se você disser só "paraense e bem-humorada", devolve "égua,
// maninho!" em toda resposta. O sotaque dela é temperamento, não fantasia.
const LEXA_NOME = 'Lexa'

function lexaSistema(extra) {
  const nome = (typeof getLangDef === 'function' && typeof activeLang === 'function')
    ? getLangDef(activeLang()).name.toLowerCase() : 'inglês'
  return `Você é a Lexa, tutora de ${nome} do Language Lab. Mulher, paraense de Belém, jovem, muito inteligente e prática — aprendeu ${nome} na marra, assistindo série e lendo, então sabe exatamente onde dói.

COMO ELA SOA (isto pesa mais que o conteúdo):
- Calorosa e direta ao mesmo tempo. Fala como gente: "olha", "repara", "na prática".
- Bom humor em dose homeopática: no máximo uma piscadela por resposta, e só quando cabe sozinha. Se a explicação já está boa, não force graça nenhuma.
- Ser paraense é JEITO, não vocabulário: acolhedora, sem cerimônia, resolve rápido. NUNCA escreva "égua", "maninho", "maninha", "pai d'égua", "arre", "vixe" nem qualquer marca regional. Nada de sotaque escrito, nada de personagem.
- Nunca se apresenta, nunca fala de si mesma, nunca usa emoji, nunca abre com "Claro!", "Ótima pergunta" ou "Vamos lá".
- Trata o aluno por você, sem diminutivos condescendentes.
${extra || ''}`
}

// Explicação curta (Revisar, vídeo, leitor, extensão): a mesma voz, com o
// formato que essas telas comportam — 2 a 4 frases, sem introdução.
function lexaExplicar() {
  return lexaSistema(`
TAREFA AGORA: explicar um trecho para o aluno, em português do Brasil.
- 2 a 4 frases. Sem introdução, sem repetir a pergunta, sem despedida.
- Traduza o SENTIDO na cena, nunca palavra por palavra.
- Decida O QUE a coisa É nesta cena e use a palavra portuguesa DAQUILO ("barrel" de fuzil é "cano", nunca "barril") — sem ficar em cima do muro entre dois domínios.
- Gíria, marca, referência cultural ou nome próprio: diga o que é no mundo real.`)
}

// ================================================================
// ILUSTRAÇÃO DA WIKIPÉDIA — a foto que acompanha a explicação
// ================================================================
// De graça, sem chave e sem CORS: a API da Wikipédia responde a qualquer
// origem com `origin=*`. Uma chamada devolve título, miniatura e resumo.
//
// A parte que importa é o PORTÃO. A busca "fuzzy" (generator=search) parece
// ótima e é uma armadilha: "seethed" devolve a banda Seether — com foto — e
// "grand experience" devolve Grand Theft Auto V. Uma imagem errada ao lado de
// uma explicação certa é pior que imagem nenhuma, porque o aluno acredita.
// Então aqui é busca por TÍTULO EXATO (com redirecionamento) e o resultado
// ainda precisa passar por três testes. Quando não passa, não vem nada.
const _wikiCache = new Map()

function _wikiNorm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

async function wikiIlustracao(termo, idioma) {
  const t = String(termo || '').trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, '')
  const lang = /^[a-z]{2,3}$/.test(String(idioma || '')) ? idioma : 'en'
  // Frase não tem verbete: só palavra ou nome próprio de até 4 palavras.
  if (!t || t.length < 2 || t.length > 60 || t.split(/\s+/).length > 4) return null
  const chave = lang + '|' + t.toLowerCase()
  if (_wikiCache.has(chave)) return _wikiCache.get(chave)

  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(t)}` +
    '&redirects=1&prop=pageimages|extracts&piprop=thumbnail|original&pithumbsize=480' +
    '&exintro=1&explaintext=1&exsentences=2&format=json&origin=*'
  let dados = null
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 5000)
    const r = await fetch(url, { signal: ctl.signal })
    clearTimeout(timer)
    if (r.ok) dados = await r.json()
  } catch (e) { /* offline, bloqueio, timeout: segue sem figura */ }

  let out = null
  const p = dados && dados.query && Object.values(dados.query.pages || {})[0]
  if (p && p.missing === undefined && p.thumbnail && p.thumbnail.source) {
    const ext = String(p.extract || '')
    const ehDesambiguacao = /\bmay refer to\b|\bpode referir-se\b|\bpuede referirse\b/i.test(ext) ||
      /\(disambiguation\)|\(desambigua/i.test(p.title || '')
    const a = _wikiNorm(p.title), b = _wikiNorm(t)
    // Título tem que ser o MESMO assunto: "Minie ball"→"Minié ball" e
    // "ducks"→"Duck" passam; "quills"→"Quill (disambiguation)" não.
    const casa = a === b || a.startsWith(b) || b.startsWith(a)
    if (!ehDesambiguacao && casa) {
      // Versão grande para o zoom. A largura vai embutida na URL de thumb do
      // Wikimedia, então dá para pedir maior — mas NUNCA além do arquivo
      // original: pedir 1280 de uma imagem de 620 devolve upscale borrado.
      // E derivar um thumb em vez de usar o `original` evita baixar os 20 MB
      // que algumas fotos da Commons têm.
      const larg = Math.min(1280, (p.original && p.original.width) || 1280)
      out = {
        titulo: p.title,
        img: p.thumbnail.source,
        zoom: p.thumbnail.source.replace(/\/(\d+)px-/, '/' + larg + 'px-'),
        extrato: ext.slice(0, 300),
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}`
      }
    }
  }
  _wikiCache.set(chave, out)
  return out
}

// Markup compartilhado (leitor e Revisar usam o mesmo) — sem estado, só HTML.
// A MINIATURA abre o zoom (é o que a mão quer fazer ao ver uma foto pequena);
// o link para o verbete foi para o título, embaixo, que é onde se procura
// "quero ler mais". Antes a imagem levava para fora do app no primeiro clique.
function wikiFiguraHTML(info) {
  if (!info) return ''
  return `<figure class="ll-wiki-fig">
    <button type="button" class="ll-wiki-zoom" title="Ampliar"
      data-zoom="${escA(info.zoom || info.img)}" data-mini="${escA(info.img)}"
      data-titulo="${escA(info.titulo)}" data-fonte="${escA(info.url)}">
      <img src="${escA(info.img)}" alt="${escA(info.titulo)}" decoding="async" referrerpolicy="no-referrer">
    </button>
    <figcaption>
      <a href="${escA(info.url)}" target="_blank" rel="noopener noreferrer">${esc(info.titulo)}</a>
      <i>Wikipédia</i>
    </figcaption>
  </figure>`
}

// ---------------------------------------------------------------
// Lupa da figura — vale para qualquer tela que use wikiFiguraHTML
// ---------------------------------------------------------------
// Delegação num ouvinte só: o HTML da figura é injetado em popups diferentes
// (leitor, Revisar) que nascem e morrem o tempo todo; ligar handler em cada
// um seria ouvinte órfão garantido.
function llZoomFechar() {
  const z = document.getElementById('ll-zoom')
  if (z) z.remove()
}

function llZoomAbrir(botao) {
  llZoomFechar()
  const grande = botao.dataset.zoom
  const mini = botao.dataset.mini
  const z = document.createElement('div')
  z.id = 'll-zoom'
  z.innerHTML = `
    <button type="button" class="ll-zoom-x" aria-label="Fechar">${ic('x')}</button>
    <img src="${escA(grande)}" alt="${escA(botao.dataset.titulo)}" referrerpolicy="no-referrer">
    <div class="ll-zoom-pe">
      <b>${esc(botao.dataset.titulo)}</b>
      <a href="${escA(botao.dataset.fonte)}" target="_blank" rel="noopener noreferrer">ver na Wikipédia</a>
    </div>`
  // A versão grande é derivada da URL: se o Wikimedia não servir aquele
  // tamanho, cai na miniatura em vez de mostrar imagem quebrada.
  const img = z.querySelector('img')
  img.onerror = () => { if (img.src !== mini) img.src = mini }
  // No leitor, o popup morre quando a seleção some. `preventDefault` no
  // mousedown mantém a seleção viva enquanto a lupa está aberta.
  z.addEventListener('mousedown', e => e.preventDefault())
  z.addEventListener('click', e => { if (!e.target.closest('a')) llZoomFechar() })
  document.body.appendChild(z)
}

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.ll-wiki-zoom')
  if (!b) return
  e.preventDefault(); e.stopPropagation()
  llZoomAbrir(b)
})
// Captura: o Esc precisa fechar a LUPA antes de o leitor fechar o popup dele.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !document.getElementById('ll-zoom')) return
  e.stopPropagation()
  llZoomFechar()
}, true)

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

// Extrai o objeto JSON de uma resposta: tolera cerca de ```json, texto antes
// ou depois, e o content vindo em reasoning_content.
function _aiParseJSON(data) {
  const msg = data.choices?.[0]?.message || {}
  let raw = String(msg.content || msg.reasoning_content || '')
    .replace(/```(?:json)?\n?|\n?```/g, '').trim()
  if (!raw) return null
  try { return JSON.parse(raw) } catch {}
  const i = raw.indexOf('{'), f = raw.lastIndexOf('}')
  if (i >= 0 && f > i) { try { return JSON.parse(raw.slice(i, f + 1)) } catch {} }
  return null
}

// Chat que retorna JSON. Aceita string única ou array de mensagens.
// Três camadas, porque o DeepSeek com `response_format: json_object`
// costuma devolver vazio/truncado (era o "Analisar com IA não faz nada"):
//   1) fornecedor ativo COM json_object (quando ele se dá bem com isso)
//   2) mesmo fornecedor SEM json_object, extraindo o JSON do texto
//   3) OpenAI, se houver chave — nunca deixa a análise no vácuo
async function aiJSON(messages, { maxTokens, model, timeoutMs, retries } = {}) {
  const chat = aiChatCfg()
  if (!chat.key) throw new Error('Chave da ' + chat.P.nome + ' não configurada (Configurações → IA)')
  const m = model || chat.model
  const msgs = typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages
  const corpo = (mod, comFormato) => ({
    model: mod,
    ...(comFormato ? { response_format: { type: 'json_object' } } : {}),
    messages: msgs,
    ..._aiTokenParam(mod, maxTokens)
  })
  // O DeepSeek já começa sem json_object: com ele, falha na maioria das vezes.
  const tentativas = chat.prov === 'deepseek' ? [false] : [true, false]
  let erro = null
  for (const comFormato of tentativas) {
    try {
      const res = await _aiFetch(chat.P.url, corpo(m, comFormato), { timeoutMs, retries, key: chat.key })
      const j = _aiParseJSON(await res.json())
      if (j) return j
      erro = new Error('a IA devolveu uma resposta vazia ou fora do formato')
    } catch (e) { erro = e }
  }
  if (chat.prov !== 'openai' && cfg.openaiKey) {
    try {
      const res = await _aiFetch('https://api.openai.com/v1/chat/completions',
        corpo(AI_DEFAULT_MODEL, true), { timeoutMs, retries: 1, key: cfg.openaiKey })
      const j = _aiParseJSON(await res.json())
      if (j) { console.warn('[ai] JSON pelo fallback OpenAI —', chat.P.nome, 'não respondeu'); return j }
    } catch (e) { erro = erro || e }
  }
  throw new Error(`[${chat.P.nome}] ${erro ? erro.message : 'não retornou um JSON válido'}`)
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
// Chave do fornecedor de IMAGENS ativo (vazia = não dá para gerar)
function aiImgKey() { return (cfg[AI_IMG[aiImgProvider()].keyCfg] || '').trim() }
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
