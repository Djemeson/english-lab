// ================================================================
// GLOSSÁRIO — o dicionário instantâneo sobre o texto (CAMADA 0)
//
// POR QUE ISTO EXISTE E O QUE ELE NÃO É
// -------------------------------------
// Passar o mouse numa palavra e ver o significado (o que o Language Reactor
// faz) só é possível se a resposta chegar em ~50ms. Foi medido em 06/08/2026,
// do próprio app, e é o que decide toda a arquitetura:
//
//   Wiktionary REST .... 772–1234 ms   (funciona, CORS ok, mas é lento demais)
//   MediaWiki action ... 2817 ms       (e devolve HTML sujo)
//   dictionaryapi.dev .. HTTP 200 com CORPO VAZIO — quebrado
//   pt.wiktionary ...... HTTP 501 — o endpoint de definições NÃO existe
//
// Ou seja: nenhuma API serve para hover, e não há rota gratuita de inglês→
// português. Logo o dado tem de estar NO APARELHO. Esta é a camada 0 — a que
// não baixa nada: o dicionário aqui é o QUE O PRÓPRIO ALUNO JÁ ESCREVEU (os
// cards analisados, o knownWords, o ignoredWords). Cobre só o que ele já
// encontrou, mas é instantânea, de graça, e a tradução é a CERTA porque já foi
// validada no contexto em que ele a viu.
//
// ⚠️ O QUE ESTE ARQUIVO NUNCA PODE VIRAR: um dicionário cego ao contexto. Foi
// exatamente essa classe de erro que custou as rodadas 163–167 ("barrel"→barril
// em vez de cano; "tire of" partido em pneu+cansar; "does"→fazer). Por isso:
//   · a glosa mostrada é a do significado marcado `context_match` — a que a IA
//     escolheu PARA AQUELA FRASE, não a primeira do verbete;
//   · antes de responder por uma palavra, o glossário testa se ela é o começo
//     de uma EXPRESSÃO que já existe como card ("tire of"), e a expressão ganha;
//   · o balão sempre oferece a Lexa a um clique, e se apresenta como espiada,
//     nunca como resposta final.
//
// SEM TOCAR NO DOM: a palavra sob o cursor é lida com caretPositionFromPoint /
// caretRangeFromPoint. Envolver cada palavra num <span> quebraria a paginação
// por colunas do leitor (e encheria o DOM de um capítulo inteiro à toa).
//
// NO CELULAR não existe hover, e o leitor JÁ tem três gestos (toque na borda
// vira página, arrasto vira página, toque longo abre Explicar). Um quarto gesto
// quebraria o virar-página. Então no toque a glosa não ganha gesto nenhum:
// ela entra dentro do painel que cada tela já abre, via glossLinhaHTML().
// ================================================================

// ---- FLEXÃO ----------------------------------------------------
// Sem isto o recurso morre no primeiro parágrafo: o texto real traz "began",
// "running", "children" — e o card foi salvo como "begin", "run", "child".
// A tabela cobre o que regra de sufixo NÃO alcança (verbo irregular é
// justamente o vocabulário mais frequente do inglês).
const GLOSS_IRREG = {
  // ser/ter/fazer/ir — os quatro que aparecem em toda página
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have', having: 'have',
  does: 'do', did: 'do', done: 'do', doing: 'do',
  goes: 'go', went: 'go', gone: 'go', going: 'go',
  // verbos irregulares de alta frequência (forma → base)
  began: 'begin', begun: 'begin', broke: 'break', broken: 'break',
  brought: 'bring', built: 'build', bought: 'buy', caught: 'catch',
  chose: 'choose', chosen: 'choose', came: 'come', cost: 'cost', cut: 'cut',
  dealt: 'deal', drew: 'draw', drawn: 'draw', drank: 'drink', drunk: 'drink',
  drove: 'drive', driven: 'drive', ate: 'eat', eaten: 'eat', fell: 'fall',
  fallen: 'fall', fed: 'feed', felt: 'feel', fought: 'fight', found: 'find',
  flew: 'fly', flown: 'fly', forgot: 'forget', forgotten: 'forget',
  froze: 'freeze', frozen: 'freeze', got: 'get', gotten: 'get', gave: 'give',
  given: 'give', grew: 'grow', grown: 'grow', heard: 'hear', hid: 'hide',
  hidden: 'hide', hit: 'hit', held: 'hold', hurt: 'hurt', kept: 'keep',
  knew: 'know', known: 'know', laid: 'lay', led: 'lead', left: 'leave',
  lent: 'lend', let: 'let', lay: 'lie', lain: 'lie', lost: 'lose',
  made: 'make', meant: 'mean', met: 'meet', paid: 'pay', put: 'put',
  read: 'read', rode: 'ride', ridden: 'ride', rang: 'ring', rung: 'ring',
  rose: 'rise', risen: 'rise', ran: 'run', said: 'say', saw: 'see',
  seen: 'see', sold: 'sell', sent: 'send', set: 'set', shook: 'shake',
  shaken: 'shake', shone: 'shine', shot: 'shoot', shut: 'shut', sang: 'sing',
  sung: 'sing', sank: 'sink', sunk: 'sink', sat: 'sit', slept: 'sleep',
  slid: 'slide', spoke: 'speak', spoken: 'speak', spent: 'spend',
  stood: 'stand', stole: 'steal', stolen: 'steal', stuck: 'stick',
  struck: 'strike', swore: 'swear', sworn: 'swear', swam: 'swim',
  swum: 'swim', took: 'take', taken: 'take', taught: 'teach', tore: 'tear',
  torn: 'tear', told: 'tell', thought: 'think', threw: 'throw',
  thrown: 'throw', understood: 'understand', woke: 'wake', woken: 'wake',
  wore: 'wear', worn: 'wear', won: 'win', wrote: 'write', written: 'write',
  bled: 'bleed', bound: 'bind', bit: 'bite', bitten: 'bite', burnt: 'burn',
  crept: 'creep', dug: 'dig', dreamt: 'dream', dwelt: 'dwell', fled: 'flee',
  forbade: 'forbid', forgave: 'forgive', ground: 'grind', hung: 'hang',
  knelt: 'kneel', leapt: 'leap', lit: 'light', meant_: 'mean', mistook: 'mistake',
  overcame: 'overcome', rebuilt: 'rebuild', rid: 'rid', sought: 'seek',
  sewn: 'sew', shed: 'shed', shrank: 'shrink', slain: 'slay', slew: 'slay',
  smelt: 'smell', sowed: 'sow', spat: 'spit', split: 'split', spread: 'spread',
  sprang: 'spring', stung: 'sting', stank: 'stink', strove: 'strive',
  swept: 'sweep', swelled: 'swell', swung: 'swing', wept: 'weep', wound: 'wind',
  withdrew: 'withdraw', woven: 'weave', wrung: 'wring',
  // plurais irregulares
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth',
  geese: 'goose', mice: 'mouse', lice: 'louse', people: 'person', oxen: 'ox',
  knives: 'knife', wives: 'wife', lives: 'life', leaves: 'leaf',
  halves: 'half', wolves: 'wolf', shelves: 'shelf', thieves: 'thief',
  loaves: 'loaf', calves: 'calf', selves: 'self', scarves: 'scarf',
  criteria: 'criterion', phenomena: 'phenomenon', data: 'datum',
  analyses: 'analysis', crises: 'crisis', theses: 'thesis', bases: 'basis',
  indices: 'index', appendices: 'appendix', matrices: 'matrix',
  cacti: 'cactus', fungi: 'fungus', nuclei: 'nucleus', radii: 'radius',
  alumni: 'alumnus', stimuli: 'stimulus', syllabi: 'syllabus',
  bacteria: 'bacterium', media: 'medium', curricula: 'curriculum',
  memoranda: 'memorandum',
  // comparativos e superlativos irregulares
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
  more: 'much', most: 'much', less: 'little', least: 'little',
  further: 'far', furthest: 'far', farther: 'far', farthest: 'far',
  elder: 'old', eldest: 'old'
}

// Candidatos a lema, do mais provável para o menos. Devolve SEMPRE a própria
// palavra primeiro — a forma flexionada pode ser um card por direito (o aluno
// pode ter salvo "began" com a frase do livro).
//
// `estrito` corta as regras DERIVACIONAIS (-er/-est), que mudam a palavra em
// vez de só flexioná-la: "teacher" não é "teach", "driver" não é "drive". No
// balão elas passam, porque ele mostra `de "teach"` e o aluno vê a ponte; para
// decidir se uma palavra já é CONHECIDA elas não passam, senão "teacher" some
// da lista de estudo por causa de um card de "teach".
//
// A regra de -ly foi deliberadamente DEIXADA DE FORA das duas: "hardly" não é
// "hard", "barely" não é "bare". É a mesma família de erro que "barrel"→barril
// — significado trocado com cara de acerto.
function glossLemas(palavra, { estrito = false } = {}) {
  const w = String(palavra || '').toLowerCase().trim()
  if (!w || w.length < 2) return w ? [w] : []
  const out = [w]
  const põe = c => { if (c && c.length >= 2 && !out.includes(c)) out.push(c) }

  if (GLOSS_IRREG[w]) põe(GLOSS_IRREG[w])

  // -ies/-ied/-ier/-iest → y  (studies→study, happiest→happy)
  if (/ies$/.test(w) && w.length > 4) põe(w.slice(0, -3) + 'y')
  if (/ied$/.test(w) && w.length > 4) põe(w.slice(0, -3) + 'y')
  if (/i(er|est)$/.test(w) && w.length > 5) põe(w.replace(/i(er|est)$/, 'y'))

  // plural / 3ª pessoa
  if (/(ches|shes|sses|xes|zes)$/.test(w)) põe(w.slice(0, -2))
  if (/es$/.test(w) && w.length > 4) põe(w.slice(0, -2))
  if (/[^s]s$/.test(w) && w.length > 3) põe(w.slice(0, -1))

  // -ed / -ing / -er / -est: as três formas possíveis do radical.
  // A consoante dobrada é o caso que mais aparece e o que regra ingênua perde:
  // "stopped"→stop, "running"→run, "bigger"→big.
  for (const suf of (estrito ? ['ed', 'ing'] : ['ed', 'ing', 'er', 'est'])) {
    if (!w.endsWith(suf) || w.length <= suf.length + 2) continue
    const base = w.slice(0, -suf.length)
    põe(base)                                        // walked → walk
    põe(base + 'e')                                  // loved → love, making → make
    if (/([bdfglmnprtz])\1$/.test(base)) põe(base.slice(0, -1))  // stopped → stop
  }
  return out
}

// ---- ÍNDICE ----------------------------------------------------
// Construído sob demanda a partir do que já está na memória. `_glossVersao`
// é o que impede o pior bug possível aqui: mostrar para sempre uma tradução
// velha depois de o card ser corrigido, apagado ou trocado por sync da nuvem.
let _glossIndice = null
let _glossVersao = -1
let _glossSelo = 0

function glossInvalidar() { _glossSelo++; _glossIndice = null }

// Escolhe a MELHOR glosa de um card. Preferência absoluta para o significado
// marcado `context_match` — é o que a IA escolheu para a frase real, e é o que
// separa esta camada de um dicionário cego (ver o caso "barrel"→cano).
function _glossDoCard(w) {
  // `moved_to`: sentido que virou item próprio (ex.: "apaixonar-se" saiu de
  // "fall" e virou "fall in love"). Continua no array só para não mover o
  // índice dos cards já criados — mas não é mais sentido DESTA palavra.
  const ms = Array.isArray(w.meanings) ? w.meanings.filter(m => m && m.meaning_pt && !m.moved_to) : []
  if (!ms.length) return null
  const m = ms.find(x => x.context_match && x.selected !== false)
      || ms.find(x => x.context_match)
      || ms.find(x => x.selected !== false)
      || ms[0]
  return {
    pt: String(m.meaning_pt || '').trim(),
    def: String(m.definition_pt || '').trim(),
    tipo: String(m.type_label || '').trim(),
    gramatical: !!m.gramatical,
    doContexto: !!m.context_match,
    outros: ms.length - 1
  }
}

function _glossConstruir() {
  const ix = new Map()
  const põe = (chave, entrada) => {
    const k = (typeof knownNorm === 'function' ? knownNorm(chave) : String(chave || '').toLowerCase().trim())
    if (!k) return
    const velho = ix.get(k)
    // Card com glosa sempre ganha de marcação sem glosa; entre dois cards,
    // ganha o que tem significado do contexto (mais específico e mais confiável).
    if (velho) {
      const melhor = (!velho.pt && entrada.pt) ||
                     (entrada.pt && entrada.doContexto && !velho.doContexto)
      if (!melhor) return
    }
    ix.set(k, entrada)
  }

  const lista = Array.isArray(typeof words !== 'undefined' ? words : null) ? words : []
  for (const w of lista) {
    const alvo = String(w.word || '').trim()
    if (!alvo) continue
    const g = _glossDoCard(w)
    põe(alvo, {
      termo: alvo, fonte: 'card', id: w.id,
      pt: g ? g.pt : '', def: g ? g.def : '', tipo: g ? g.tipo : '',
      gramatical: g ? g.gramatical : false,
      doContexto: g ? g.doContexto : false,
      outros: g ? g.outros : 0,
      contexto: String(w.context || '').trim(),
      contexto_pt: String(w.context_pt || '').trim()
    })
  }
  // Marcações sem tradução salva: não dão verbete, mas dizem algo útil
  // ("você já marcou esta como conhecida") e evitam o balão vazio.
  const kw = (typeof knownWords === 'object' && knownWords) ? knownWords : {}
  for (const k of Object.keys(kw)) põe(k, { termo: k, fonte: 'known', pt: '' })
  const iw = (typeof ignoredWords === 'object' && ignoredWords) ? ignoredWords : {}
  for (const k of Object.keys(iw)) põe(k, { termo: k, fonte: 'ignored', pt: '' })

  _glossIndice = ix
  _glossVersao = _glossSelo
  return ix
}

function _glossIx() {
  const n = Array.isArray(typeof words !== 'undefined' ? words : null) ? words.length : 0
  // Reconstrói quando o selo mudou OU quando a quantidade de cards mudou sem
  // ninguém avisar (importação em lote, snapshot da nuvem, undo). Sai barato:
  // é um Map sobre dado que já está na memória.
  if (!_glossIndice || _glossVersao !== _glossSelo || _glossIndice._n !== n) {
    _glossConstruir()
    _glossIndice._n = n
  }
  return _glossIndice
}

// ---- CAMADA 1: A PRÉ-ANÁLISE DO CAPÍTULO -----------------------
// Por que NÃO existe aqui um dicionário inglês→português embarcado, apesar de
// ele caber folgado. Medido em 06/08/2026 sobre o extrato do Wikcionário
// português (kaikki.org/ptwiktionary/Inglês, 18.044 verbetes):
//
//   tamanho ..... 0,86 MB em JSON, 0,26 MB comprimido — caberia sem dor
//   cobertura ... 91,5% do texto corrido (top 20 mil, com o lematizador)
//   QUALIDADE ... reprovada, e é o que decidiu
//
// As palavras do livro que o Djemeson está lendo:
//   barrel → "barril"      (no romance é o CANO do fuzil)
//   bore   → "chateação"   (é o passado de bear: "não NUTRI rancor")
//   yank   → "puxão"       (é Billy Yank, o soldado da União)
//   tire, animus → sem verbete nenhum
// E não é escolha ruim de sentido: `barrel` tem três acepções lá e NENHUMA é o
// cano; `bore` tem quatro e nenhuma é o passado de bear. O sentido certo não
// existe no dado. Embarcar aquilo seria reintroduzir, por 0,26 MB, exatamente
// o erro que as rodadas 163–167 gastaram para eliminar.
//
// A camada 1 é outra coisa: ele não lê "inglês em geral", lê UM LIVRO, e o app
// tem o livro na mão. A pré-análise manda as palavras novas do capítulo COM A
// FRASE DE CADA UMA para a IA, de uma vez, e guarda. O resultado é uma glosa
// presa ao contexto — o oposto do verbete cego. Quem produz esse mapa é
// `lerPreAnalisar()` em ler.js; aqui só se consulta.
let _glossPre = null          // Map(palavra normalizada -> entrada)
let _glossPreChave = ''       // que capítulo está carregado

function glossPreCarregar(chave, itens) {
  if (!itens || !itens.length) { glossPreLimpar(); return 0 }
  const norm = s => (typeof knownNorm === 'function' ? knownNorm(s) : String(s || '').toLowerCase().trim())
  const m = new Map()
  for (const it of itens) {
    // `expr` (quando existe) é a EXPRESSÃO que a palavra formava na frase —
    // phrasal, idiom, colocação. A chave é ela, não a palavra solta: guardar
    // "cansar-se de" sob "tire" faria o balão dar o sentido do phrasal para um
    // "tire" que ali era pneu. A sonda de 2 e 3 palavras do glossBuscar é quem
    // reencontra a expressão no texto.
    const termo = String(it.expr || it.w || '').trim()
    const k = norm(termo)
    if (!k || !it.pt) continue
    m.set(k, { termo, pt: String(it.pt).trim(), def: String(it.nota || '').trim(),
               tipo: String(it.tipo || '').trim(), gramatical: !!it.g,
               doContexto: true, outros: 0, fonte: 'pre' })
  }
  _glossPre = m; _glossPreChave = chave
  return m.size
}
function glossPreLimpar() { _glossPre = null; _glossPreChave = '' }
function glossPreChave() { return _glossPreChave }

// Busca principal. `seguinte` é a palavra à direita no texto — é o que permite
// "tire of" ganhar de "tire", e é a defesa contra o erro que mais dói aqui.
function glossBuscar(palavra, seguinte, seguinte2) {
  const ix = _glossIx()
  const pre = _glossPre
  if (!ix.size && !(pre && pre.size)) return null
  const norm = s => (typeof knownNorm === 'function' ? knownNorm(s) : String(s || '').toLowerCase().trim())

  // 1) EXPRESSÃO primeiro, sempre — e da MAIOR para a menor. "look forward to"
  // tem de ganhar de "look forward", que por sua vez ganha de "look": a unidade
  // maior é a mais específica, e responder pela menor seria dizer ao aluno que
  // ele está diante de outra coisa. Vale nas duas camadas (card e pré-análise).
  const combos = []
  if (seguinte && seguinte2) combos.push(palavra + ' ' + seguinte + ' ' + seguinte2)
  if (seguinte) combos.push(palavra + ' ' + seguinte)
  for (const c of combos) {
    const k = norm(c)
    const hit = k && (ix.get(k) || (pre && pre.get(k)))
    if (hit && hit.pt) return { ...hit, casou: c, original: palavra, viaLema: false, frase: true }
  }
  // 2) e 3) cada forma candidata — a palavra como está e depois os lemas —
  // consultada nas DUAS camadas, o card antes da pré-análise.
  // A ordem importa e é deliberada: o card é material que ELE curou e corrigiu,
  // a pré-análise é uma leitura automática. Quando as duas têm resposta, vale a
  // dele. `original` guarda a forma que está NO TEXTO — é ela que o balão
  // mostra em "você viu …"; sem isso ele repetia o próprio verbete
  // ('begin | de "begin"'), que não informa nada. O que ensina é ver que o
  // "began" da página é o "begin" do card.
  for (const l of [palavra, ...glossLemas(palavra)]) {
    const k = norm(l)
    const h = ix.get(k) || (pre && pre.get(k))
    if (h) return { ...h, casou: l, original: palavra, viaLema: k !== norm(palavra) }
  }
  return null
}

// ---- LEITURA DA PALAVRA SOB O PONTO ----------------------------
// Sem envolver nada em <span>: pergunta ao navegador qual nó de texto e qual
// posição estão naquele pixel e expande até as bordas da palavra.
const _GLOSS_LETRA = /[\p{L}\p{M}'’-]/u
function glossPalavraNoPonto(x, y) {
  const d = document
  let no, off
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y); if (!p) return null
    no = p.offsetNode; off = p.offset
  } else if (d.caretRangeFromPoint) {
    const g = d.caretRangeFromPoint(x, y); if (!g) return null
    no = g.startContainer; off = g.startOffset
  } else return null
  if (!no || no.nodeType !== 3) return null
  const t = no.textContent || ''
  if (off > t.length) return null
  let a = off, b = off
  while (a > 0 && _GLOSS_LETRA.test(t[a - 1])) a--
  while (b < t.length && _GLOSS_LETRA.test(t[b])) b++
  const palavra = t.slice(a, b).replace(/^['’-]+|['’-]+$/g, '')
  if (!palavra || palavra.length < 2) return null
  // As DUAS palavras seguintes, para a sonda de expressão. Duas e não uma
  // porque phrasal de três partes é comum e é justamente o que o aluno não
  // decompõe sozinho: "get away with", "look forward to", "put up with".
  const resto = t.slice(b, b + 60)
  const m = /^\s+([\p{L}\p{M}'’-]{1,})(?:\s+([\p{L}\p{M}'’-]{1,}))?/u.exec(resto)
  return { palavra, seguinte: (m && m[1]) || '', seguinte2: (m && m[2]) || '', no, a, b }
}

// Seleciona no documento a palavra que o balão está mostrando. É assim que o
// "Ver com a Lexa" reaproveita o painel que a tela JÁ tem (no leitor: o popup
// com Explicar/Estudar/Ouvir/Imagens/Wikipédia) em vez de o glossário
// reimplementar esse fluxo por fora e ele passar a divergir.
// A frase inteira em volta da palavra, tirada do próprio nó de texto. É o que
// permite mandar a palavra para o Preparar JÁ COM O CONTEXTO do livro, sem
// obrigar o aluno a selecionar a frase na mão — e contexto é o que separa um
// card que ensina de uma palavra solta numa lista.
function glossFraseEmVolta(pos, max = 300) {
  if (!pos || !pos.no) return ''
  const t = pos.no.textContent || ''
  let a = pos.a, b = pos.b
  while (a > 0 && !/[.!?…]/.test(t[a - 1]) && pos.a - a < max) a--
  while (b < t.length && !/[.!?…]/.test(t[b]) && b - pos.b < max) b++
  if (b < t.length) b++                       // leva o ponto final junto
  return t.slice(a, b).replace(/\s+/g, ' ').trim()
}

function glossSelecionar(pos) {
  if (!pos || !pos.no) return false
  try {
    const r = document.createRange()
    r.setStart(pos.no, pos.a); r.setEnd(pos.no, pos.b)
    const s = window.getSelection()
    s.removeAllRanges(); s.addRange(r)
    return true
  } catch (e) { return false }
}

// ---- BALÃO -----------------------------------------------------
let _glossBalao = null
let _glossTimer = 0
let _glossUltima = ''
let _glossUltimoMove = 0
let _glossFecharTimer = 0

// O balão nasce ACIMA da palavra. Subir o mouse para alcançá-lo é sair da
// palavra — e fechar nesse instante tornava o "Ver com a Lexa" impossível de
// clicar: o botão sumia no caminho até ele. Sair da palavra agora só AGENDA o
// fechamento; entrar no balão cancela o agendamento.
const GLOSS_GRACA = 280   // ms de trégua para a mão atravessar o vão

function _glossAgendarFechar() {
  if (!_glossBalao) { glossFechar(); return }
  clearTimeout(_glossFecharTimer)
  _glossFecharTimer = setTimeout(glossFechar, GLOSS_GRACA)
}

function glossFechar() {
  clearTimeout(_glossFecharTimer)
  clearTimeout(_glossTimer)
  if (_glossBalao) { _glossBalao.remove(); _glossBalao = null }
  _glossUltima = ''
}

// A linha do verbete, reaproveitada em DOIS lugares: no balão do hover e
// dentro dos painéis que já existem (o caminho do celular, sem gesto novo).
function glossLinhaHTML(achado, opts = {}) {
  if (!achado) return ''
  const e = s => (typeof esc === 'function' ? esc(s) : String(s || ''))
  const icone = n => (typeof ic === 'function' ? ic(n, 'ic-sm') : '')
  if (!achado.pt) {
    // TRÊS estados sem glosa, e confundi-los mente para o aluno. O caso do
    // meio é o que aparecia errado: palavra que ele MANDOU para o Preparar mas
    // que a IA ainda não analisou entrava aqui e recebia "você marcou como
    // conhecida" — exatamente o contrário do que ele fez com ela.
    const rotulo = achado.fonte === 'ignored' ? 'você marcou como ignorada'
                 : achado.fonte === 'card'    ? 'já está no Preparar, ainda sem análise'
                 : 'você marcou como conhecida'
    const icn = achado.fonte === 'card' ? 'clock' : 'check'
    return `<div class="gloss-corpo"><div class="gloss-vazio">${icone(icn)} ${rotulo}</div></div>`
  }
  const cabeca = achado.frase
    ? `<b class="gloss-termo">${e(achado.casou)}</b><span class="gloss-sel">expressão</span>`
    : `<b class="gloss-termo">${e(achado.termo)}</b>${
        achado.viaLema && achado.original ? `<span class="gloss-sel">você viu "${e(achado.original)}"</span>` : ''}`
  return `
    <div class="gloss-corpo">
      <div class="gloss-cab">${cabeca}${
        achado.tipo ? `<span class="gloss-tipo">${e(achado.tipo)}</span>` : ''}</div>
      <div class="gloss-pt">${e(achado.pt)}</div>
      ${achado.def && !opts.curto ? `<div class="gloss-def">${e(achado.def)}</div>` : ''}
      ${achado.fonte === 'pre'
        ? `<div class="gloss-rodape">${icone('sparkles')} lido nesta passagem — ainda não é um card seu</div>`
        : achado.doContexto ? `<div class="gloss-rodape">${icone('check')} sentido da frase em que você a encontrou</div>` : ''}
      ${achado.outros > 0 ? `<div class="gloss-rodape">+${achado.outros} outro${achado.outros > 1 ? 's' : ''} significado${achado.outros > 1 ? 's' : ''} no card</div>` : ''}
    </div>`
}

function _glossMostrar(achado, x, y, opts, pos) {
  // Remove o balão anterior SEM chamar glossFechar(): ele limparia também o
  // fechamento agendado, e aí um balão criado depois de o mouse já ter saído
  // do texto ficaria preso na tela para sempre.
  if (_glossBalao) { _glossBalao.remove(); _glossBalao = null }
  const b = document.createElement('div')
  b.className = 'gloss-balao'
  b.setAttribute('role', 'tooltip')
  const podeLexa = !!(opts && opts.aoExplicar)
  // "Estudar" só aparece quando a palavra AINDA NÃO é card: oferecê-lo para
  // algo que já está no Preparar convidaria ao item duplicado — o mesmo cuidado
  // que fez o painel do toque longo avisar "já está no Preparar".
  const podeEstudar = !!(opts && opts.aoEstudar) && achado.fonte !== 'card'
  // "NÃO LEMBRO": exclusivo de palavra que ele já declarou conhecer (ou
  // ignorou). É o beco que o balão criava — dizia "você marcou como
  // conhecida" para uma palavra que ele não reconhece, e não havia saída
  // dali. Aqui o botão desfaz a marcação, cria o card com a frase e leva até
  // ele; a volta ao ponto exato é do mecanismo compartilhado (core.js).
  const esqueceu = (achado.fonte === 'known' || achado.fonte === 'ignored')
  const podeEsqueci = esqueceu && !!(opts && opts.aoNaoLembro)
  const icn = n => (typeof ic === 'function' ? ic(n, 'ic-sm') : '')
  const botoes = (podeLexa || podeEstudar || podeEsqueci)
    ? `<div class="gloss-acoes">
        ${podeEsqueci ? `<button class="gloss-btn gloss-esqueci" type="button">${icn('undo')} Não lembro</button>` : ''}
        ${podeEstudar && !esqueceu ? `<button class="gloss-btn gloss-estudar" type="button">${icn('plus')} Estudar</button>` : ''}
        ${podeLexa ? `<button class="gloss-btn gloss-lexa" type="button">${icn('sparkles')} Lexa</button>` : ''}
       </div>`
    : ''
  b.innerHTML = glossLinhaHTML(achado) + botoes
  document.body.appendChild(b)
  if (podeEsqueci) {
    b.querySelector('.gloss-esqueci').onclick = ev => {
      ev.stopPropagation()
      const alvo = pos ? pos.palavra : achado.termo
      const ctx = glossFraseEmVolta(pos)
      glossFechar()
      try { opts.aoNaoLembro(alvo, ctx) } catch (e) {}
    }
  }
  if (podeEstudar && !esqueceu) {
    b.querySelector('.gloss-estudar').onclick = ev => {
      ev.stopPropagation()
      const alvo = achado.frase ? achado.casou : (pos ? pos.palavra : achado.termo)
      // A FRASE vai junto. Card sem contexto é o que produz "barrel = barril";
      // com a frase, a análise tem como acertar o sentido daquela cena.
      const ctx = glossFraseEmVolta(pos)
      glossFechar()
      try { opts.aoEstudar(alvo, ctx, achado) } catch (e) {}
    }
  }
  // O balão é território seguro: enquanto o mouse estiver nele, nada fecha.
  // Sair dele fecha na hora — aí a intenção é clara.
  b.addEventListener('pointerenter', () => clearTimeout(_glossFecharTimer))
  b.addEventListener('pointerleave', glossFechar)
  if (podeLexa) {
    b.querySelector('.gloss-lexa').onclick = ev => {
      ev.stopPropagation()
      const alvo = achado.frase ? achado.casou : (pos ? pos.palavra : achado.termo)
      glossFechar()
      // `pos` carrega o nó de texto e os limites da palavra. Com isso a tela
      // que chamou pode SELECIONAR a palavra e abrir o painel que ela já tem,
      // em vez de o glossário reimplementar Explicar/Estudar por fora.
      try { opts.aoExplicar(alvo, pos) } catch (e) {}
    }
  }
  // Posiciona acima da palavra; cai para baixo quando não cabe. O vão é curto
  // (6px) de propósito: é distância que a mão atravessa antes de a trégua
  // acabar. Vão grande transforma "ir até o botão" em prova de pontaria.
  const larg = b.offsetWidth, alt = b.offsetHeight
  let px = Math.max(8, Math.min(x - larg / 2, window.innerWidth - larg - 8))
  let py = y - alt - 6
  if (py < 8) py = y + 18
  b.style.left = Math.round(px) + 'px'
  b.style.top = Math.round(py) + 'px'
  _glossBalao = b
}

// ---- ATIVAÇÃO --------------------------------------------------
// Um só componente para TODAS as telas (leitor, legenda, Preparar, Assistente).
// Se cada uma tivesse a sua cópia, o mesmo defeito seria consertado quatro
// vezes — foi o que aconteceu com as regras lexicais até a 80ª rodada.
const GLOSS_ESPERA = 220   // ms parado antes de aparecer: menos que isso pisca
                           // a cada palavra enquanto os olhos correm a linha

function glossAtivar(container, opts = {}) {
  if (!container || container._glossOn) return
  container._glossOn = true

  // Só ponteiro fino (mouse). No toque o balão não entra: o dedo tapa a
  // palavra e o leitor já usa toque para virar página e para Explicar.
  const temMouse = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches
  if (!temMouse) return

  container.addEventListener('pointermove', ev => {
    if (ev.pointerType !== 'mouse') return
    if (ev.buttons) { glossFechar(); return }         // arrastando: está selecionando

    // Estrangulamento por TEMPO, não por requestAnimationFrame. O rAF parece
    // a escolha natural, mas ele é SUSPENSO em aba de fundo: uma chamada
    // pendente na hora de trocar de aba nunca devolve, e a trava ficaria presa
    // — o hover morria em silêncio até a aba voltar. Carimbo de tempo não tem
    // esse estado, e alinhar com o quadro não serve para nada aqui: quem manda
    // no ritmo é a mão, não o compositor de tela.
    const agora = Date.now()
    if (agora - _glossUltimoMove < 40) return
    _glossUltimoMove = agora

    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) { glossFechar(); return }
    // Sair da palavra AGENDA o fechamento em vez de fechar: é o espaço entre
    // as linhas que o mouse cruza a caminho do balão.
    const p = glossPalavraNoPonto(ev.clientX, ev.clientY)
    if (!p) { _glossAgendarFechar(); return }
    const chave = p.palavra + '|' + p.seguinte + '|' + p.seguinte2
    if (chave === _glossUltima) {
      clearTimeout(_glossFecharTimer)                  // voltou para a mesma palavra: fica
      return
    }
    _glossUltima = chave
    clearTimeout(_glossTimer)
    clearTimeout(_glossFecharTimer)
    if (_glossBalao) { _glossBalao.remove(); _glossBalao = null }
    const achado = glossBuscar(p.palavra, p.seguinte, p.seguinte2)
    if (!achado) return
    const x = ev.clientX, y = ev.clientY
    _glossTimer = setTimeout(() => _glossMostrar(achado, x, y, opts, p), GLOSS_ESPERA)
  }, { passive: true })

  // Sair do container inteiro também usa a trégua: o balão pode estar FORA
  // dele (ele vive no body), então fechar na hora mataria o caminho até o
  // botão sempre que a palavra estivesse na primeira linha do texto.
  container.addEventListener('pointerleave', _glossAgendarFechar, { passive: true })
  // Rolagem e tecla fecham: um balão preso na tela depois que o texto andou
  // aponta para a palavra errada — pior que não ter balão nenhum.
  container.addEventListener('scroll', glossFechar, { passive: true, capture: true })
}

window.addEventListener('keydown', e => { if (e.key === 'Escape') glossFechar() })
window.addEventListener('scroll', glossFechar, { passive: true, capture: true })
