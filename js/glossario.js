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
  const ms = Array.isArray(w.meanings) ? w.meanings.filter(m => m && m.meaning_pt) : []
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

// Busca principal. `seguinte` é a palavra à direita no texto — é o que permite
// "tire of" ganhar de "tire", e é a defesa contra o erro que mais dói aqui.
function glossBuscar(palavra, seguinte) {
  const ix = _glossIx()
  if (!ix.size) return null
  const norm = s => (typeof knownNorm === 'function' ? knownNorm(s) : String(s || '').toLowerCase().trim())

  // 1) EXPRESSÃO primeiro, sempre. Duas e depois três palavras.
  if (seguinte) {
    const par = norm(palavra + ' ' + seguinte)
    const hit = par && ix.get(par)
    if (hit && hit.pt) return { ...hit, casou: palavra + ' ' + seguinte, viaLema: false, frase: true }
  }
  // 2) a palavra como está
  const direto = ix.get(norm(palavra))
  if (direto) return { ...direto, casou: palavra, original: palavra, viaLema: false }
  // 3) os lemas, do mais provável ao menos.
  // `original` guarda a forma que está NO TEXTO — é ela que o balão mostra em
  // "de …". Sem isso ele repetia o próprio verbete ('begin | de "begin"'), que
  // não informa nada; o que ensina é ver que o "began" da página é o "begin"
  // do card.
  for (const l of glossLemas(palavra)) {
    const h = ix.get(norm(l))
    if (h) return { ...h, casou: l, original: palavra, viaLema: norm(l) !== norm(palavra) }
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
  // a palavra seguinte, para a sonda de expressão
  const resto = t.slice(b, b + 40)
  const m = /^[\s]+([\p{L}\p{M}'’-]{2,})/u.exec(resto)
  return { palavra, seguinte: m ? m[1] : '', no, a, b }
}

// Seleciona no documento a palavra que o balão está mostrando. É assim que o
// "Ver com a Lexa" reaproveita o painel que a tela JÁ tem (no leitor: o popup
// com Explicar/Estudar/Ouvir/Imagens/Wikipédia) em vez de o glossário
// reimplementar esse fluxo por fora e ele passar a divergir.
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

function glossFechar() {
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
    const rotulo = achado.fonte === 'ignored' ? 'você marcou como ignorada' : 'você marcou como conhecida'
    return `<div class="gloss-corpo"><div class="gloss-vazio">${icone('check')} ${rotulo}</div></div>`
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
      ${achado.doContexto ? `<div class="gloss-rodape">${icone('check')} sentido da frase em que você a encontrou</div>` : ''}
      ${achado.outros > 0 ? `<div class="gloss-rodape">+${achado.outros} outro${achado.outros > 1 ? 's' : ''} significado${achado.outros > 1 ? 's' : ''} no card</div>` : ''}
    </div>`
}

function _glossMostrar(achado, x, y, opts, pos) {
  glossFechar()
  const b = document.createElement('div')
  b.className = 'gloss-balao'
  b.setAttribute('role', 'tooltip')
  const podeLexa = !!(opts && opts.aoExplicar)
  b.innerHTML = glossLinhaHTML(achado) + (podeLexa
    ? `<button class="gloss-lexa" type="button">${typeof ic === 'function' ? ic('sparkles', 'ic-sm') : ''} Ver com a Lexa</button>`
    : '')
  document.body.appendChild(b)
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
  // Posiciona acima da palavra; cai para baixo quando não cabe.
  const larg = b.offsetWidth, alt = b.offsetHeight
  let px = Math.max(8, Math.min(x - larg / 2, window.innerWidth - larg - 8))
  let py = y - alt - 12
  if (py < 8) py = y + 20
  b.style.left = Math.round(px) + 'px'
  b.style.top = Math.round(py) + 'px'
  _glossBalao = b
}

// ---- ATIVAÇÃO --------------------------------------------------
// Um só componente para TODAS as telas (leitor, legenda, Revisar, Assistente).
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
    const p = glossPalavraNoPonto(ev.clientX, ev.clientY)
    if (!p) { glossFechar(); return }
    const chave = p.palavra + '|' + p.seguinte
    if (chave === _glossUltima) return                 // mesma palavra: nada a refazer
    _glossUltima = chave
    clearTimeout(_glossTimer)
    if (_glossBalao) { _glossBalao.remove(); _glossBalao = null }
    const achado = glossBuscar(p.palavra, p.seguinte)
    if (!achado) return
    const x = ev.clientX, y = ev.clientY
    _glossTimer = setTimeout(() => _glossMostrar(achado, x, y, opts, p), GLOSS_ESPERA)
  }, { passive: true })

  container.addEventListener('pointerleave', glossFechar, { passive: true })
  // Rolagem e tecla fecham: um balão preso na tela depois que o texto andou
  // aponta para a palavra errada — pior que não ter balão nenhum.
  container.addEventListener('scroll', glossFechar, { passive: true, capture: true })
}

window.addEventListener('keydown', e => { if (e.key === 'Escape') glossFechar() })
window.addEventListener('scroll', glossFechar, { passive: true, capture: true })
