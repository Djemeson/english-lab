// ================================================================
// LEXA — a voz da IA do Language Lab
// ================================================================
// Mora AQUI (arquivo não-lazy) porque quem explica algo ao aluno está
// espalhado pelo app: o Assistente, o Preparar, a legenda do vídeo, o leitor
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

// Explicação curta (Preparar, vídeo, leitor, extensão): a mesma voz, com o
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
// MARKDOWN DA LEXA — o modelo escreve em markdown, sempre
// ================================================================
// Pedir "não use markdown" no prompt não resolve: o modelo escorrega de volta,
// e o preço do escorregão é o aluno lendo `**pals** = "amigos"` com os
// asteriscos na cara. Então em vez de proibir, RENDERIZA — o ênfase que ele
// quis dar é informação, não sujeira, e jogá-la fora empobreceria a explicação.
//
// Ordem obrigatória: escapar SEMPRE primeiro (a resposta é texto de fora),
// depois `**` antes de `*` (senão o negrito vira dois itálicos vazios).
function lexaInline(t) {
  return String(t || '')
    // HTML que a IA às vezes manda de propósito: volta a valer, só nas tags de
    // ênfase. Tudo o mais continua escapado.
    .replace(/&lt;(\/?(?:b|strong|i|em))&gt;/gi, '<$1>')
    // O asterisco precisa COLAR no texto dos dois lados, como no markdown de
    // verdade — senão "3 * 4 * 5" vira "3 <i> 4 </i> 5". Sem lookbehind, que
    // não existe em Safari antigo: o próprio grupo proíbe espaço nas pontas.
    .replace(/\*\*([^\s*][^*\n]*?[^\s*]|[^\s*])\*\*/g, '<b>$1</b>')
    .replace(/\*([^\s*][^*\n]*?[^\s*]|[^\s*])\*/g, '<i>$1</i>')
    // Sublinhado só com fronteira de palavra: `snake_case_assim` não é itálico.
    .replace(/(^|[\s(["'])_([^_\n]+?)_(?=[\s.,;:!?)\]"']|$)/g, '$1<i>$2</i>')
    .replace(/`([^`\n]+?)`/g, '<code>$1</code>')
}

// Texto curto da Lexa (leitor, vídeo, Preparar) já pronto para innerHTML.
function lexaFormatar(txt) {
  const escapado = (typeof esc === 'function' ? esc(txt) : String(txt || ''))
  // Marcador de lista ANTES do itálico: "* item" não é ênfase, e sem isto o
  // asterisco solto engoliria o resto da linha.
  return lexaInline(escapado.replace(/^\s*\*\s+/gm, '• '))
    .replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>')
}

// ================================================================
// CONVERSA COM A LEXA DENTRO DO BALÃO
// ================================================================
// A explicação respondia UMA pergunta e fechava o assunto. Mas a dúvida real
// raramente acaba na primeira resposta — "e por que não X?", "isso é comum?",
// "me dá outro exemplo" — e para perguntar isso ele tinha de sair do livro,
// ir ao Assistente e recontar o contexto todo do zero.
//
// Aqui a linha continua: a explicação vira a PRIMEIRA MENSAGEM de uma conversa
// que já nasce sabendo o livro, a frase e o termo. Componente compartilhado de
// propósito — o leitor, o Preparar e o vídeo têm popups diferentes e a mesma
// necessidade; cada um só precisa chamar `lexaChatMontar` no corpo dele.
//
// O histórico vive NO ELEMENTO (`_lexaMsgs`), não numa variável global: dois
// popups abertos em telas diferentes não podem misturar conversa, e quando o
// popup morre a conversa morre com ele — é dúvida de passagem, não sessão.
function lexaChatHTML() {
  return `
    <div class="lexa-chat">
      <div class="lexa-chat-msgs"></div>
      <form class="lexa-chat-form" autocomplete="off">
        <input type="text" class="lexa-chat-inp" placeholder="Pergunte mais sobre isto…"
               aria-label="Pergunte mais sobre este trecho">
        <button type="submit" class="lexa-chat-env" aria-label="Enviar">${ic('send', 'ic-sm')}</button>
      </form>
    </div>`
}

// `contexto` descreve o que a conversa já sabe: {sistema, primeira, resposta}.
function lexaChatMontar(caixa, contexto) {
  if (!caixa) return
  caixa.insertAdjacentHTML('beforeend', lexaChatHTML())
  const chat = caixa.querySelector('.lexa-chat')
  const msgs = chat.querySelector('.lexa-chat-msgs')
  const form = chat.querySelector('.lexa-chat-form')
  const inp = chat.querySelector('.lexa-chat-inp')
  // A conversa nasce com a explicação já dada: sem isto a segunda pergunta
  // chegaria à IA sem o livro, sem a frase e sem o que ela mesma respondeu —
  // e ele teria de recontar tudo, que é justamente o atrito que isto remove.
  chat._lexaMsgs = [
    { role: 'system', content: contexto.sistema },
    { role: 'user', content: contexto.primeira },
    { role: 'assistant', content: contexto.resposta }
  ]
  // O clique dentro do chat não pode borbulhar: os popups que o hospedam
  // fecham ao clique de fora, e digitar fecharia a própria conversa. No leitor
  // isso também impede o `preventDefault` do popup, que existe para não
  // colapsar a seleção — e que impediria o campo de receber foco.
  chat.addEventListener('mousedown', e => e.stopPropagation())
  chat.addEventListener('click', e => e.stopPropagation())
  // Gancho para a tela se proteger enquanto ele digita. O leitor precisa dele:
  // clicar no campo desfaz a seleção de texto, e o vigia de seleção fecharia o
  // popup 350ms depois, no meio da pergunta. O componente não sabe disso — só
  // avisa que entrou e saiu do campo.
  if (typeof contexto.aoFoco === 'function') {
    inp.addEventListener('focus', () => contexto.aoFoco(true))
    inp.addEventListener('blur', () => contexto.aoFoco(false))
  }

  form.onsubmit = async e => {
    e.preventDefault(); e.stopPropagation()
    const q = String(inp.value || '').trim()
    if (!q || chat._ocupado) return
    chat._ocupado = true
    inp.value = ''
    msgs.insertAdjacentHTML('beforeend',
      `<div class="lexa-msg eu">${esc(q)}</div><div class="lexa-msg ela pensando"><span class="spinner"></span></div>`)
    msgs.scrollTop = msgs.scrollHeight
    const pendente = msgs.lastElementChild
    chat._lexaMsgs.push({ role: 'user', content: q })
    try {
      const t = await aiTextSeguro(chat._lexaMsgs, { maxTokens: 600 })
      chat._lexaMsgs.push({ role: 'assistant', content: t })
      pendente.classList.remove('pensando')
      pendente.innerHTML = lexaFormatar(t)
    } catch (err) {
      pendente.classList.remove('pensando')
      pendente.classList.add('erro')
      pendente.textContent = 'Não deu: ' + (err.message || 'erro')
      // Pergunta que não foi respondida sai do histórico: senão a próxima
      // chamada mandaria duas perguntas seguidas do aluno e a IA responderia
      // só a última, deixando a primeira sem resposta para sempre.
      chat._lexaMsgs.pop()
    }
    chat._ocupado = false
    msgs.scrollTop = msgs.scrollHeight
    inp.focus()
  }
}

// ================================================================
// "O QUE É AQUI?" — a checagem sob demanda, no CLIQUE
// ================================================================
// O buraco que isto fecha: `knownWords` guarda PALAVRA, não sentido. Marcar
// "cover" como conhecida tira a palavra da triagem, da cobertura e da
// pré-análise — para sempre e em todo livro. Aí, quando ela reaparece como
// "cobrir o turno de alguém", o balão diz "você marcou como conhecida", que é
// o app informando que você sabe uma coisa que não sabe. A detecção de
// reencontro não salva: ela compara a glosa da pré-análise com os sentidos que
// você tem, e para palavra conhecida não existe glosa nenhuma.
//
// Por que NO CLIQUE e nunca no hover: o hover tem orçamento de ~50 ms (foi por
// isso que o Wiktionary, de 772 a 1234 ms, foi recusado). Uma chamada de IA
// jamais cabe ali. No clique cabe — e só acontece quando você desconfia, que é
// a única hora em que vale pagar.
//
// A UNIDADE É O QUE IMPORTA. Perguntar "o que 'cover' significa aqui" e
// responder pela palavra solta seria repetir o erro do "tire of" partido em
// pneu + cansar. A resposta tem de vir na UNIDADE DE ESTUDO real da passagem:
// se for phrasal verb, idiom ou colocação, é ela que volta — em forma de
// citação (`cover for`, nunca `covered for`), pronta para virar item.
const _checkCache = new Map()

// `jaTem` = os sentidos que o item já tem, com id. Sem isso a checagem ficava
// FORA da conversa: perguntava do zero e podia responder "mina" para um item
// cujo sentido do contexto o app já tinha decidido ser "explorar" — duas telas
// do mesmo app dando respostas diferentes para a mesma palavra.
async function aiChecarAqui(alvo, frase, lang, jaTem) {
  const termo = String(alvo || '').trim()
  const ctx = String(frase || '').replace(/\s+/g, ' ').trim()
  if (!termo) throw new Error('sem termo')
  // SEM A FRASE NÃO HÁ O QUE CHECAR. Responder assim mesmo seria devolver o
  // sentido mais comum do dicionário — exatamente o "dicionário cego ao
  // contexto" que este projeto proíbe, e a origem do "barrel"→barril.
  if (!ctx) throw new Error('não achei a frase em volta — selecione o trecho e use Explicar')
  const lista = Array.isArray(jaTem) ? jaTem.filter(m => m && m.id && m.meaning_pt) : []
  const chave = (lang || 'en') + '|' + termo.toLowerCase() + '|' + ctx.toLowerCase() +
                '|' + lista.map(m => m.id).join(',')
  if (_checkCache.has(chave)) return _checkCache.get(chave)

  const L = (typeof getLangDef === 'function') ? getLangDef(lang || 'en') : { nameEn: 'English' }
  const PROMPT = `In the passage below, decide what the learner should actually study around "${termo}".

Passage: "${ctx || termo}"
Target word: "${termo}"

STEP 1 — FIND THE UNIT. Look at what "${termo}" is doing in this passage. It may be:
- part of a PHRASAL VERB ("cover for him", "get up his quills") — the unit is the verb + particle(s)
- part of an IDIOM ("under the weather", "fall by the wayside") — the unit is the whole idiom
- part of a fixed COLLOCATION ("take a ride", "make a decision") — the unit is the collocation
- or just the word by itself.
Always prefer the LARGEST unit that is genuinely fixed. "look forward to" beats "look forward", which beats "look".
Return the unit in CITATION form: bare verb, no inflection ("cover for", never "covered for"; "fall by the wayside", never "fell by the wayside"). Keep the learner's word inside it.

STEP 2 — SAY WHAT IT MEANS HERE. The sense IN THIS PASSAGE, in Brazilian Portuguese, max 6 words. Decide WHAT the thing IS in this scene and use the Portuguese word for THAT — "barrel" of a rifle is "cano", never "barril". Never a dictionary list, never two domains hedged together.

${lista.length ? `
STEP 3 — IS IT ONE THE LEARNER ALREADY HAS? These are the senses already recorded for this item:
${lista.map(m => `- id "${m.id}": ${m.meaning_pt}${m.definition_pt ? ` (${m.definition_pt})` : ''}`).join('\n')}
If the sense in THIS passage is one of them, set "same_as" to that id and REUSE ITS WORDING in "gloss" — the learner must not read two different answers for the same sense in two screens of the same app. Only set "same_as": null when the passage really uses a sense that is not in the list.
Judge by the SENSE, not by the wording.` : ''}

Return ONLY this JSON:
{"expr":"the study unit in citation form","tipo":"word|phrasal_verb|idiom|collocation","gloss":"o sentido nesta passagem, português do Brasil, máx 6 palavras","nivel":"A1|A2|B1|B2|C1|C2","mesma":true,"same_as":null}
"mesma": true when the unit is just the word itself, false when it is a larger expression.`

  const r = await aiJSON([
    { role: 'system', content: `You analyze ${L.nameEn} for a Brazilian Portuguese-speaking learner. Return only valid JSON.` },
    { role: 'user', content: PROMPT }
  ], { maxTokens: 300 })

  const expr = String(r && r.expr || termo).replace(/\s+/g, ' ').trim() || termo
  // COESÃO: quando a IA diz que é um sentido que ele já tem, quem manda é o
  // texto GRAVADO, não a redação nova. Duas telas do mesmo app não podem dar
  // duas respostas para a mesma coisa — foi assim que o Preparar dizia
  // "explorar" e a checagem respondia "mina".
  const casou = (r && r.same_as) ? lista.find(m => m.id === r.same_as) : null
  const out = {
    expr,
    tipo: ['word', 'phrasal_verb', 'idiom', 'collocation'].includes(r && r.tipo) ? r.tipo : 'word',
    gloss: casou ? String(casou.meaning_pt).trim() : String(r && r.gloss || '').trim(),
    nivel: String(r && r.nivel || '').trim().toUpperCase(),
    // Não confia no booleano do modelo: compara os textos. Com DeepSeek o JSON
    // vem por texto livre e booleano volta como "true"/"sim"/1 conforme o humor.
    mesma: expr.toLowerCase() === termo.toLowerCase(),
    jaEra: casou ? casou.id : null,
    def: casou ? String(casou.definition_pt || '').trim() : ''
  }
  if (!out.gloss) throw new Error('resposta sem significado')
  _checkCache.set(chave, out)
  return out
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

// Markup compartilhado (leitor e Preparar usam o mesmo) — sem estado, só HTML.
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
// (leitor, Preparar) que nascem e morrem o tempo todo; ligar handler em cada
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
    // fornecedor. É daqui que sai a estimativa em reais.
    // CONFERIDO nas páginas oficiais em 2026-08-05 (developers.openai.com/api/docs/pricing,
    // api-docs.deepseek.com, ai.google.dev/gemini-api/docs/pricing, console.groq.com/docs/models).
    // ORDEM IMPORTA: o primeiro da lista é o padrão de quem nunca escolheu
    // (settings.js → `P.modelos[0].id`). Por isso o gpt-4o-mini continua no
    // topo e o gpt-5-nano vem depois: nano é o mais barato de todos, mas
    // modelo pequeno é justamente o que solta regra em prompt longo — e o
    // prompt de análise deste app tem centenas de linhas.
    // GPT-5.6 (lançada 2026-07-09) é uma família de TRÊS níveis com nome
    // próprio: Sol (topo), Terra (equilibrado) e Luna (rápido/barato).
    // ⚠️ A ressalva que importa para este app está no MRCR (recall em contexto
    // longo): Sol 91,5% · Terra 89,6% · **Luna 41,3%**. O prompt de análise
    // daqui tem ~3.000 tokens — não é "contexto longo" no sentido do teste —,
    // mas é longo em REGRAS, e é justamente soltar regra que dói. Por isso a
    // Luna entra como candidata a testar, não como padrão.
    // Sol ficou de fora: R$ 0,32 por card analisado é desproporcional para
    // glosa de vocabulário.
    modelos: [
      { id: 'gpt-4o-mini',   tier: 'baixo', nota: 'rápido e barato (padrão do app)',          preco: { in: 0.15, out: 0.60 } },
      { id: 'gpt-5-nano',    tier: 'baixo', nota: 'o mais barato daqui — lote sim, análise não', preco: { in: 0.05, out: 0.40 } },
      { id: 'gpt-5.6-luna',  tier: 'baixo', nota: 'GPT-5.6 Luna — geração atual pelo preço de um mini', preco: { in: 0.20, out: 1.20 } },
      { id: 'gpt-4.1-mini',  tier: 'baixo', nota: 'melhor texto, preço próximo',              preco: { in: 0.40, out: 1.60 } },
      { id: 'gpt-4o',        tier: 'médio', nota: 'equilibrado (geração 2024)',               preco: { in: 2.50, out: 10.00 } },
      { id: 'gpt-5-mini',    tier: 'médio', nota: 'nova geração',                             preco: { in: 0.25, out: 2.00 } },
      { id: 'gpt-5.6-terra', tier: 'alto',  nota: 'GPT-5.6 Terra — quase o topo por 1/2,5 do preço', preco: { in: 2.00, out: 12.00 } },
      { id: 'gpt-5',         tier: 'alto',  nota: 'mais capaz',                               preco: { in: 1.25, out: 10.00 } },
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
      { id: 'openai/gpt-oss-120b',     tier: 'médio', nota: 'modelo aberto grande',          preco: { in: 0.15, out: 0.60 } },
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
function _aiRaciocina(model) { return /^(gpt-5|o\d)/.test(model || '') }

// ⚠️ ESTES MODELOS GASTAM TOKENS DE RACIOCÍNIO DENTRO DO MESMO ORÇAMENTO.
// A doc da OpenAI é explícita: se o teto acabar durante o raciocínio, volta
// `finish_reason: length` com content VAZIO — e "você paga a entrada e o
// raciocínio sem receber resposta visível". Foi o que derrubou a leitura do
// capítulo com o Luna: 1.440 tokens dimensionados para 40 glosas sumiram no
// raciocínio e não sobrou nada para o texto. A recomendação da OpenAI é
// reservar ~25.000.
// A folga é DE GRAÇA: `max_completion_tokens` é LIMITE, não reserva — só se
// paga o que for realmente gerado. Por isso vale para todas as chamadas do
// app, e não só para a pré-análise: `add.js` pedia 800, `review.js` 600,
// `ler.js` 600 — todas correndo o mesmo risco em modelo que pensa.
const AI_FOLGA_RACIOCINIO = 25000
function _aiTokenParam(model, maxTokens) {
  if (!maxTokens) return {}
  return _aiRaciocina(model)
    ? { max_completion_tokens: maxTokens + AI_FOLGA_RACIOCINIO }
    : { max_tokens: maxTokens }
}

// fetch com timeout + retry.
// Retenta em 429/5xx/queda de rede (2 vezes, backoff 1s→3s, respeitando
// Retry-After). NUNCA retenta 4xx de verdade (chave errada não melhora
// tentando de novo). O corpo do erro da OpenAI vira a mensagem do Error.
// ================================================================
// FREIO GLOBAL — não estourar o limite de requisições por minuto
// ================================================================
// O erro que motivou isto: "Rate limit reached for gpt-5.6-luna … RPM:
// Limit 500, Used 500". O `_aiFetch` JÁ tentava de novo em 429 — o problema
// era anterior: vários caminhos disparam em `Promise.all` (a sincronia de
// legenda é um deles) e mandam dezenas de chamadas de uma vez. Repetir não
// resolve, porque as tentativas colidem com a mesma rajada.
//
// Duas travas, e as duas precisam existir:
//  1. TETO DE SIMULTÂNEAS — impede a rajada nascer. `Promise.all` continua
//     escrito do mesmo jeito nos chamadores; a fila é que segura.
//  2. FREIO COMPARTILHADO — quando UMA chamada leva 429, TODAS as outras
//     esperam. Sem isso, só a que apanhou desacelera e as demais continuam
//     batendo na parede, mantendo o limite estourado.
const AI_MAX_SIMULT = 4
let _aiEmVoo = 0
const _aiFila = []
let _aiFreioAte = 0        // timestamp até quando todo mundo espera

function _aiLiberarVaga() {
  _aiEmVoo--
  const proximo = _aiFila.shift()
  if (proximo) proximo()
}

async function _aiPegarVaga() {
  if (_aiEmVoo >= AI_MAX_SIMULT) {
    await new Promise(res => _aiFila.push(res))
  }
  _aiEmVoo++
  // O freio é checado DEPOIS de pegar a vaga e em laço: um 429 que chegue
  // enquanto esta chamada esperava na fila também vale para ela.
  while (Date.now() < _aiFreioAte) {
    await new Promise(r => setTimeout(r, Math.min(2000, _aiFreioAte - Date.now() + 20)))
  }
}

// A própria mensagem da OpenAI diz quanto esperar ("Please try again in
// 120ms") — é mais preciso que qualquer palpite nosso, e às vezes vem sem o
// cabeçalho `retry-after`.
function _aiEsperaDoErro(msg, cab) {
  const h = parseFloat(cab) * 1000
  if (h > 0) return h
  const m = /try again in ([\d.]+)\s*(ms|s)\b/i.exec(String(msg || ''))
  if (m) return parseFloat(m[1]) * (m[2].toLowerCase() === 's' ? 1000 : 1)
  return 0
}

async function _aiFetch(url, body, { timeoutMs = 90000, retries = 2, key } = {}) {
  await _aiPegarVaga()
  try {
    return await _aiFetchBruto(url, body, { timeoutMs, retries, key })
  } finally {
    _aiLiberarVaga()
  }
}

async function _aiFetchBruto(url, body, { timeoutMs = 90000, retries = 2, key } = {}) {
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
      // 429 é limite de TAXA, não falha desta chamada: quem espera é o app
      // inteiro. Piso de 1,2s mesmo quando a API pede 120ms — o que ela mede
      // é a janela dela, e voltar em 120ms com a fila cheia só reestoura.
      let espera = _aiEsperaDoErro(msg, res.headers.get('retry-after')) || (tent + 1) * 1500
      if (res.status === 429) {
        espera = Math.max(espera, 1200)
        _aiFreioAte = Math.max(_aiFreioAte, Date.now() + espera)
        console.warn('[ai] limite de taxa — segurando todas as chamadas por ' + Math.round(espera) + 'ms')
      }
      await new Promise(r => setTimeout(r, espera))
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
// O fallback é SILENCIOSO por natureza — e silêncio aqui engana a conta: você
// escolhe o DeepSeek, ele falha em toda chamada, e o app cobra OpenAI sem
// você saber. Um aviso por sessão (não por chamada, senão vira spam).
let _aiFallbackAvisado = false
function _aiAvisarFallback(nome, modelo, motivo) {
  if (_aiFallbackAvisado) return
  _aiFallbackAvisado = true
  if (typeof toast !== 'function') return
  toast(`${nome} (${modelo}) não respondeu — o app seguiu pela OpenAI. Motivo: ${String(motivo).slice(0, 90)}`, 'warning')
}

// "resposta vazia ou fora do formato" era verdade e não servia para nada — as
// causas exigem ações opostas. Esta função olha o que a API DE FATO devolveu e
// diz qual delas foi. O caso `length` é o mais traiçoeiro: a chamada foi
// COBRADA (entrada + raciocínio) e não trouxe texto nenhum.
function _aiPorQueVazio(dados) {
  const c = dados?.choices?.[0]
  const fim = c?.finish_reason || c?.finishReason || ''
  const uso = dados?.usage || {}
  const rac = uso.completion_tokens_details?.reasoning_tokens
  if (fim === 'length') {
    return rac
      ? `o teto de tokens acabou durante o raciocínio (${rac} tokens pensando, nada de texto) — a chamada foi cobrada mesmo assim`
      : 'a resposta foi cortada no meio pelo teto de tokens'
  }
  if (fim === 'content_filter') return 'o filtro de conteúdo do fornecedor barrou a resposta'
  if (c?.message?.refusal) return 'o modelo recusou: ' + String(c.message.refusal).slice(0, 140)
  if (dados?.error?.message) return String(dados.error.message).slice(0, 180)
  if (c?.message?.content) return 'a resposta veio, mas não era JSON válido'
  return 'a IA devolveu uma resposta vazia ou fora do formato'
}

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
      const dados = await res.json()
      _aiGuardarUso(dados, m)
      const j = _aiParseJSON(dados)
      if (j) return j
      erro = new Error(_aiPorQueVazio(dados))
    } catch (e) { erro = e }
  }
  if (chat.prov !== 'openai' && cfg.openaiKey) {
    try {
      const res = await _aiFetch('https://api.openai.com/v1/chat/completions',
        corpo(AI_DEFAULT_MODEL, true), { timeoutMs, retries: 1, key: cfg.openaiKey })
      const j = _aiParseJSON(await res.json())
      if (j) {
        // O MOTIVO junto: sem ele, "não respondeu" some no console e não dá
        // para saber se foi chave, cota, modelo descontinuado ou JSON quebrado
        // — foi exatamente o que aconteceu no teste comparativo de 06/08.
        const motivo = (erro && erro.message) || 'resposta vazia ou fora do formato'
        console.warn(`[ai] JSON pelo fallback OpenAI — ${chat.P.nome} (${m}) não respondeu.`, 'Motivo:', motivo)
        _aiAvisarFallback(chat.P.nome, m, motivo)
        return j
      }
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
  _aiGuardarUso(data, m)
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
    // O tts-1 não conhece as vozes novas (ballad/verse/marin/cedar): mandar
    // uma delas aqui daria 400 e o card ficaria mudo. Troca por uma clássica.
    const vLegada = (typeof vozLegada === 'function') ? vozLegada(v) : v
    const res = await _aiFetch('https://api.openai.com/v1/audio/speech', {
      model: AI_TTS_FALLBACK, input: text, voice: vLegada, speed
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
      // gpt-image-2 (abr/2026). Preços POR IMAGEM em 1024×1024, da tabela
      // oficial — e aqui eles são cotados, não derivados como no gpt-image-1
      // (que publicava só US$ 40/1M e obrigava a multiplicar pelos tokens de
      // cada qualidade: 272 / 1.056 / 4.160).
      //
      // A troca vale porque o app usa 'low' por padrão, e nessa faixa o
      // image-2 é 45% MAIS BARATO (0,006 contra 0,011). Nas outras duas ele
      // é ~26% mais caro — não por tarifa (a saída caiu de US$ 40 para 30/1M)
      // mas porque emite mais tokens: são imagens maiores de verdade.
      // ⚠️ No 'low' ele emite MENOS que o image-1 (~200 contra 272 tokens),
      // então parte da economia vem de peso. Se a ilustração ficar pobre
      // demais, o caminho é subir para 'medium', não voltar ao image-1.
      low:    { model: 'gpt-image-2', quality: 'low',    usd: 0.006, rotulo: 'Econômica' },
      medium: { model: 'gpt-image-2', quality: 'medium', usd: 0.053, rotulo: 'Padrão' },
      high:   { model: 'gpt-image-2', quality: 'high',   usd: 0.211, rotulo: 'Alta' }
    }
  },
  gemini: {
    nome: 'Google Gemini', keyCfg: 'geminiKey',
    niveis: {
      // O nível barato NÃO é mais o 2.5-flash-image: o Lite (jun/2026) é ao
      // mesmo tempo mais novo E mais barato (0,0336 < 0,039). Manter o 2.5 era
      // pagar mais por uma geração anterior. O 2.5 saiu do catálogo por isso.
      // Imagen 4 Fast custa 0,02 e parece tentador — mas está DEPRECIADO e o
      // Google desliga em 17/ago/2026. Entrar nele hoje é quebrar em 11 dias.
      low:    { model: 'gemini-3.1-flash-lite-image', usd: 0.0336, rotulo: 'Nano Banana 2 Lite (3.1 Flash Lite)' },
      medium: { model: 'gemini-3.1-flash-image',      usd: 0.067,  rotulo: 'Nano Banana 2 (3.1 Flash)' },
      high:   { model: 'gemini-3-pro-image',          usd: 0.134,  rotulo: 'Nano Banana Pro (3 Pro)' }
    }
  }
}

function aiImgProvider() { return AI_IMG[cfg.imgProvider] ? cfg.imgProvider : 'openai' }
// Chave do fornecedor de IMAGENS ativo (vazia = não dá para gerar)
function aiImgKey() { return (cfg[AI_IMG[aiImgProvider()].keyCfg] || '').trim() }
function aiImgNivel(quality) {
  const P = AI_IMG[aiImgProvider()]
  // Padrão 'low' (e não 'medium'): imagem de card de vocabulário não precisa
  // de resolução alta, e o salto medium/high multiplica a conta por 1,7 e 3,4.
  const q = quality || cfg.imgQuality || 'low'
  return { prov: aiImgProvider(), P, q, ...(P.niveis[q] || P.niveis.low) }
}

// Imagem — retorna data URL base64 (contrato usado por audio.js/study).
async function aiImage(prompt, { size = '1024x1024', quality, timeoutMs = 180000 } = {}) {
  const n = aiImgNivel(quality)
  const key = (cfg[n.P.keyCfg] || '').trim()
  if (!key) throw new Error(`Chave da ${n.P.nome} não configurada (Configurações → IA)`)
  // Qual nível está REALMENTE valendo — o "gerei no baixo e veio caro" nasceu
  // de o app cair no médio em silêncio (imgQuality faltava no DEF_CFG).
  console.info(`[img] nível "${n.q}" · ${n.P.nome} · ${n.model || n.quality} · US$ ${n.usd}/imagem`)
  return n.prov === 'gemini'
    ? _aiImageGemini(prompt, n.model, key, timeoutMs, n)
    : _aiImageOpenAI(prompt, n.quality, size, timeoutMs, n.model)
}

// ⚠️ O `model` vinha HARDCODED aqui, o que tornava o campo `model` do catálogo
// OpenAI puramente decorativo: trocar lá não mudava nada, e o preço exibido
// podia divergir do modelo realmente chamado. Agora o catálogo manda.
async function _aiImageOpenAI(prompt, quality, size, timeoutMs, modelo) {
  const res = await _aiFetch('https://api.openai.com/v1/images/generations', {
    model: modelo || 'gpt-image-2', prompt, n: 1, size, quality
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
async function _aiImageGemini(prompt, model, key, timeoutMs, n2) {
  const tentativas = [
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      // 'IMAGE' MAIÚSCULO: é enum na API. 'Image' podia passar por sorte hoje
      // e virar 400 amanhã — e 400 aqui manda a geração para a outra rota.
      body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }
    },
    {
      url: 'https://generativelanguage.googleapis.com/v1beta/interactions',
      // `image_size: '1K'` EXPLÍCITO: no 3.1-flash-image o preço sobe com o
      // tamanho (0,067 em 1K → 0,101 em 2K → 0,151 em 4K). Sem fixar, um
      // padrão maior do Google viraria fatura maior sem ninguém escolher.
      body: {
        model,
        input: [{ type: 'text', text: prompt }],
        response_format: { type: 'image', mime_type: 'image/png', image_size: '1K' }
      }
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
      const rota = t.url.includes('interactions') ? 'interactions' : 'generateContent'
      const json = await res.json()
      const img = _aiGeminiImgDaResposta(json)
      if (img) { console.info(`[img] ${model} via ${rota} — US$ ${n2 ? n2.usd : '?'}`); return img }

      // 200 sem imagem tem DOIS motivos muito diferentes:
      const motivo = _aiGeminiMotivoSemImagem(json)
      if (motivo.recusa) {
        // Recusa declarada: nada foi entregue e repetir na outra rota daria a
        // mesma recusa — só gastaria de novo. Para aqui, e diz o porquê.
        throw new Error(`[Gemini] imagem não gerada: ${motivo.texto}`)
      }
      // Formato que não reconheço: aí o erro é NOSSO, e a outra rota pode
      // salvar. Loga a forma da resposta para o parser ser corrigido depois.
      console.warn(`[img] ${rota} respondeu 200 sem imagem reconhecível. Campos:`,
        Object.keys(json || {}).join(', '), json)
      ultimoErro = new Error(`[Gemini] ${motivo.texto}`)
    } catch (e) {
      ultimoErro = e.name === 'AbortError' ? new Error('[Gemini] tempo esgotado ao gerar a imagem') : e
    } finally { clearTimeout(timer) }
  }
  throw ultimoErro || new Error('[Gemini] falha ao gerar a imagem')
}

// Aceita os dois formatos de resposta (parts[].inlineData e output_image)
function _aiGeminiImgDaResposta(j) {
  // 1) rota clássica :generateContent
  const parts = j?.candidates?.[0]?.content?.parts || []
  for (const p of parts) {
    const inline = p.inlineData || p.inline_data
    if (inline?.data) return `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,` + inline.data
  }
  // 2) /interactions — atalho de conveniência
  const oi = j?.output_image || j?.outputImage
  if (oi?.data) return `data:${oi.mime_type || oi.mimeType || 'image/png'};base64,` + oi.data
  // 3) /interactions — o formato REAL do REST: um array `steps`, cada um com
  //    blocos de conteúdo. FALTAVA aqui, e era isto que fazia "algumas imagens
  //    não serem geradas": a chamada dava 200, a imagem vinha, e o parser não
  //    sabia onde procurar. `output` era chute; a doc diz `steps`.
  for (const st of (j?.steps || [])) {
    for (const c of (st?.content || st?.blocks || [])) {
      if (c?.data && (c.type === 'image' || String(c.mime_type || c.mimeType || '').startsWith('image/'))) {
        return `data:${c.mime_type || c.mimeType || 'image/png'};base64,` + c.data
      }
    }
  }
  // 4) formato antigo que já estava aqui — mantido por segurança
  for (const o of (j?.output || [])) {
    if (o?.data && (o.type === 'image' || o.mime_type?.startsWith('image/'))) {
      return `data:${o.mime_type || 'image/png'};base64,` + o.data
    }
  }
  return null
}

// Por que NÃO veio imagem: recusa de segurança tem motivo declarado e não
// adianta repetir; formato desconhecido é bug nosso e vale tentar a outra
// rota. Distinguir os dois é o que separa "explique ao usuário" de "insista".
function _aiGeminiMotivoSemImagem(j) {
  const bloqueio = j?.promptFeedback?.blockReason || j?.prompt_feedback?.block_reason
  const fim = j?.candidates?.[0]?.finishReason || j?.candidates?.[0]?.finish_reason
  const recusaFim = fim && !/^STOP$/i.test(fim)
  if (bloqueio || recusaFim) {
    const cod = bloqueio || fim
    const humano = {
      SAFETY: 'a cena foi barrada pelo filtro de segurança do Google',
      IMAGE_SAFETY: 'a imagem foi barrada pelo filtro de segurança do Google',
      PROHIBITED_CONTENT: 'o conteúdo é proibido pela política do Google',
      BLOCKLIST: 'o prompt caiu numa lista de termos bloqueados',
      RECITATION: 'a resposta foi barrada por semelhança com material protegido',
      OTHER: 'o Google recusou sem detalhar o motivo'
    }[String(cod).toUpperCase()] || `o Google recusou (${cod})`
    return { recusa: true, texto: humano }
  }
  return { recusa: false, texto: 'a resposta veio 200 mas sem imagem num formato que eu reconheça' }
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

// ---- CONSUMO REAL -----------------------------------------------
// Estimativa de custo é palpite; `usage` é fato. E para modelo que raciocina a
// diferença não é detalhe: os tokens de RACIOCÍNIO são cobrados como SAÍDA (o
// lado caro), e nenhuma estimativa baseada no texto visível os enxerga. Na
// leitura de capítulo com o Luna a conta estimada ficava entre 1,8× e 6,7×
// abaixo do real, dependendo de quanto ele pensasse.
//
// Todo caminho que fala com a API passa o `usage` por aqui. Quem quiser saber
// o preço de uma operação inteira chama `aiUsoZerar()` antes e
// `aiUsoAcumulado()` depois — vale para lote de N chamadas.
let _aiUso = { in: 0, out: 0, raciocinio: 0, cache: 0, chamadas: 0, model: '' }

function aiUsoZerar() { _aiUso = { in: 0, out: 0, raciocinio: 0, cache: 0, chamadas: 0, model: '' } }
function aiUsoAcumulado() { return { ..._aiUso } }

function _aiGuardarUso(dados, model) {
  const u = dados && dados.usage
  if (!u) return
  const rac = u.completion_tokens_details?.reasoning_tokens
           || u.output_tokens_details?.reasoning_tokens || 0
  const cache = u.prompt_tokens_details?.cached_tokens || u.prompt_cache_hit_tokens || 0
  _aiUso.in += Number(u.prompt_tokens || u.input_tokens || 0)
  _aiUso.out += Number(u.completion_tokens || u.output_tokens || 0)
  _aiUso.raciocinio += Number(rac)
  _aiUso.cache += Number(cache)
  _aiUso.chamadas++
  _aiUso.model = model || _aiUso.model
}

// Custo em dólar a partir do consumo MEDIDO. `completion_tokens` já inclui os
// de raciocínio (a OpenAI os soma ali), então não se conta duas vezes.
function aiCustoDeUso(uso, model) {
  const p = aiPrecoModelo(model || (uso && uso.model))
  if (!p || !uso) return 0
  return ((uso.in || 0) * p.in + (uso.out || 0) * p.out) / 1e6
}
