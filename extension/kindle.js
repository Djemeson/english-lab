// ================================================================
// KINDLE CLOUD READER (read.amazon.com) — captura ao vivo
// ================================================================
// A ponte com o aparelho físico é por arquivo (vocab.db / My Clippings.txt):
// o Kindle não fala com a rede em tempo real. Quem lê no NAVEGADOR, porém,
// pode ter o "marcou → caiu no Revisar" de verdade — é o que este script faz.
//
// Vale para livro comprado E para documento pessoal (Enviar para Kindle):
// aqui não existe a restrição do Vocabulary Builder do aparelho, porque a
// captura é nossa, não da Amazon.
//
// Roda em TODOS os frames: o leitor desenha o livro dentro de um iframe.
// Mesma disciplina de netflix.js: nada de callback do chrome.* solto —
// promessa + catch, senão recarregar a extensão derruba a página.
// ================================================================
'use strict'

let aposentado = false
function pedirExt(fn) {
  if (aposentado) return Promise.resolve(null)
  let p
  try {
    if (!(chrome && chrome.runtime && chrome.runtime.id)) { aposentado = true; return Promise.resolve(null) }
    p = fn()
  } catch (e) { aposentado = true; return Promise.resolve(null) }
  return Promise.resolve(p).catch(() => { aposentado = true; return null })
}

const ehTopo = window.top === window
let cfgK = { auto: false }
pedirExt(() => chrome.storage.local.get({ llkindle: null })).then(r => {
  if (r && r.llkindle) cfgK = { ...cfgK, ...r.llkindle }
}).catch(() => {})
const salvarCfgK = () => pedirExt(() => chrome.storage.local.set({ llkindle: cfgK }))

// ---- título do livro ----------------------------------------------------
// Só o frame de cima enxerga o cabeçalho do leitor; ele publica o título e
// os frames internos leem dali (o iframe pode ser de outra origem).
const SELETORES_TITULO = [
  '#top-chrome .book-title', '[data-testid="book-title"]', '.kr-header-title',
  'header h1', '#kindleReader_header_title'
]
function tituloLocal() {
  for (const s of SELETORES_TITULO) {
    try {
      const e = document.querySelector(s)
      const t = e && e.textContent.trim().replace(/\s+/g, ' ')
      if (t && t.length > 1 && t.length < 160) return t
    } catch (e) {}
  }
  const d = String(document.title || '')
    .replace(/\s*[-–|]\s*(Kindle Cloud Reader|Amazon Kindle|Kindle|Amazon\.com).*$/i, '')
    .replace(/^\s*(Kindle Cloud Reader|Amazon Kindle)\s*$/i, '')
    .trim()
  return d && d.length > 1 ? d : ''
}
let tituloPub = ''
function publicarTitulo() {
  if (!ehTopo) return
  const t = tituloLocal()
  if (!t || t === tituloPub) return
  tituloPub = t
  pedirExt(() => chrome.storage.local.set({ llkindlelivro: t }))
}
if (ehTopo) {
  publicarTitulo()
  setInterval(publicarTitulo, 4000)   // troca de livro sem recarregar a página
}
let tituloCache = ''
pedirExt(() => chrome.storage.local.get({ llkindlelivro: '' })).then(r => {
  if (r) tituloCache = r.llkindlelivro || ''
}).catch(() => {})
try {
  chrome.storage.onChanged.addListener(ch => {
    if (aposentado) return
    try { if (ch && ch.llkindlelivro) tituloCache = ch.llkindlelivro.newValue || '' } catch (e) { aposentado = true }
  })
} catch (e) {}
const tituloLivro = () => tituloLocal() || tituloCache || 'Kindle'

// ---- frase em volta da seleção -----------------------------------------
// O leitor quebra o parágrafo em dezenas de <span> (um por linha desenhada),
// então o "elemento pai" da seleção quase nunca é a frase inteira. Subimos
// até juntar texto suficiente e recortamos a frase que contém o alvo.
function blocoDaSelecao(sel) {
  let no = sel.anchorNode
  if (!no) return ''
  if (no.nodeType === 3) no = no.parentElement
  let melhor = ''
  for (let i = 0; i < 7 && no; i++) {
    const t = (no.textContent || '').replace(/\s+/g, ' ').trim()
    if (t.length > melhor.length) melhor = t
    if (melhor.length > 400) break
    no = no.parentElement
  }
  return melhor.slice(0, 2000)
}
function fraseComAlvo(bloco, alvo) {
  if (!bloco) return ''
  const i = bloco.toLowerCase().indexOf(String(alvo || '').toLowerCase())
  if (i < 0) return bloco.length > 400 ? bloco.slice(0, 400) : bloco
  // Fronteira de frase: ponto/!/? seguido de espaço. Aspas e "Mr." estragam
  // a regra fina — para estudo, um pedaço um pouco maior não atrapalha.
  let ini = 0
  for (let p = i; p > 0; p--) {
    if (/[.!?…]/.test(bloco[p - 1]) && /\s/.test(bloco[p] || ' ')) { ini = p; break }
  }
  let fim = bloco.length
  for (let p = i + alvo.length; p < bloco.length; p++) {
    if (/[.!?…]/.test(bloco[p])) { fim = p + 1; break }
  }
  const frase = bloco.slice(ini, fim).trim()
  return (frase.length < 6 ? bloco : frase).slice(0, 400)
}

// ---- fila de capturas ---------------------------------------------------
function salvarCaptura(word, context) {
  const item = {
    word: String(word || '').trim().toLowerCase(),
    context: String(context || '').trim(),
    title: tituloLivro(),
    source_type: 'kindle',
    lang: 'en',
    ts: Date.now()
  }
  return pedirExt(() => chrome.storage.local.get({ pend: [] })).then(r => {
    if (!r) return false
    const pend = r.pend || []
    // A mesma palavra na mesma frase não entra duas vezes (clique nervoso,
    // seleção que o navegador dispara de novo ao soltar o botão).
    if (pend.some(p => p.word === item.word && p.context === item.context)) return true
    pend.push(item)
    return pedirExt(() => chrome.storage.local.set({ pend })).then(() => true)
  }).catch(() => false)
}
function desfazerUltima() {
  return pedirExt(() => chrome.storage.local.get({ pend: [] })).then(r => {
    if (!r) return
    const pend = r.pend || []
    pend.pop()
    return pedirExt(() => chrome.storage.local.set({ pend }))
  }).catch(() => {})
}

// ---- aviso curto --------------------------------------------------------
function avisar(msg, comDesfazer) {
  let t = document.getElementById('englab-k-toast')
  if (!t) { t = document.createElement('div'); t.id = 'englab-k-toast'; document.body.appendChild(t) }
  t.textContent = ''
  const s = document.createElement('span'); s.textContent = msg; t.appendChild(s)
  if (comDesfazer) {
    const b = document.createElement('button')
    b.textContent = 'desfazer'
    b.onclick = () => { desfazerUltima(); t.classList.remove('on') }
    t.appendChild(b)
  }
  t.classList.add('on')
  clearTimeout(t._id); t._id = setTimeout(() => t.classList.remove('on'), comDesfazer ? 4200 : 2600)
}

// ---- pílula de seleção --------------------------------------------------
const IC_ADD = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
let pilula = null
let alvoAtual = ''      // texto selecionado, congelado no instante da seleção
let ctxAtual = ''       // frase de origem, congelada junto
let abertaEm = 0

function fecharPilula() {
  if (pilula) { pilula.remove(); pilula = null }
  alvoAtual = ctxAtual = ''
}
// Selecionar arrastando gera scroll — fechar por causa dele mataria a pílula
// no instante em que ela nasce. Só rolagem DEPOIS de a poeira baixar conta.
function fecharSeRolou() {
  if (pilula && Date.now() - abertaEm > 500) fecharPilula()
}

function abrirPilula(sel) {
  let r
  try { r = sel.getRangeAt(0).getBoundingClientRect() } catch (e) { return }
  if (!r || (!r.width && !r.height)) return
  pilula = pilula || document.createElement('div')
  pilula.id = 'englab-k-pill'
  pilula.innerHTML = ''

  // Acima de 4 palavras o que você marcou É o contexto: mandar como
  // palavra-alvo criaria um card com uma frase inteira no título.
  const ehFrase = PALAVRAS(alvoAtual) > 4
  const bAdd = document.createElement('button')
  bAdd.className = 'englab-k-pri'
  bAdd.innerHTML = IC_ADD + `<span>${ehFrase ? 'Salvar frase' : 'Revisar'}</span>`
  bAdd.title = ehFrase
    ? 'Manda o trecho marcado para o Revisar — a triagem por IA quebra em itens lá'
    : 'Manda a palavra + a frase desta página para o Revisar do Language Lab'
  bAdd.onclick = () => {
    const p = alvoAtual, c = ctxAtual
    const alvo = ehFrase ? '' : p
    const ctx = ehFrase ? p : c
    salvarCaptura(alvo, ctx).then(ok => avisar(
      ok ? (ehFrase ? 'trecho salvo para o Revisar' : `"${p}" vai para o Revisar`)
         : 'recarregue a página (F5)'))
    fecharPilula()
    try { window.getSelection().removeAllRanges() } catch (e) {}
  }
  pilula.appendChild(bAdd)

  const bFrase = document.createElement('button')
  bFrase.textContent = 'frase'
  bFrase.title = 'Salva a frase inteira, sem palavra-alvo — o Raio-X do Lab tria depois'
  bFrase.onclick = () => {
    const c = ctxAtual
    salvarCaptura('', c).then(ok => avisar(ok ? 'frase salva para o Revisar' : 'recarregue a página (F5)'))
    fecharPilula()
    try { window.getSelection().removeAllRanges() } catch (e) {}
  }
  pilula.appendChild(bFrase)

  const bAuto = document.createElement('button')
  bAuto.className = 'englab-k-auto' + (cfgK.auto ? ' on' : '')
  bAuto.textContent = 'auto'
  bAuto.title = 'Automático: toda palavra que você selecionar vai direto para o Revisar, sem clicar aqui'
  bAuto.onclick = () => {
    cfgK.auto = !cfgK.auto; salvarCfgK()
    bAuto.classList.toggle('on', cfgK.auto)
    avisar(cfgK.auto ? 'automático LIGADO: selecionar uma palavra já captura'
                     : 'automático desligado')
  }
  pilula.appendChild(bAuto)

  // mousedown no próprio popup colapsaria a seleção antes do clique valer
  pilula.onmousedown = e => e.preventDefault()
  document.body.appendChild(pilula)

  const larg = pilula.offsetWidth || 210
  const alt = pilula.offsetHeight || 34
  // Abaixo da seleção; se não couber, acima. A Amazon abre o dicionário dela
  // por perto — deslocamos o suficiente para os dois conviverem.
  let x = r.left + r.width / 2 - larg / 2
  let y = r.bottom + 8
  if (y + alt > window.innerHeight - 6) y = Math.max(6, r.top - alt - 8)
  x = Math.max(6, Math.min(x, window.innerWidth - larg - 6))
  pilula.style.left = Math.round(x) + 'px'
  pilula.style.top = Math.round(y) + 'px'
  abertaEm = Date.now()
}

// ---- gatilho ------------------------------------------------------------
const PALAVRAS = t => t.split(/\s+/).filter(Boolean).length

let autoTimer = null
function aoSelecionar() {
  const sel = window.getSelection()
  const txt = String(sel || '').replace(/\s+/g, ' ').trim()
  clearTimeout(autoTimer)
  // Teto generoso: marcar a frase inteira de um livro é o uso normal. O teto
  // antigo (8 palavras / 200 caracteres) engolia a seleção em SILÊNCIO — a
  // pílula simplesmente não nascia e não havia como saber por quê.
  if (!txt || txt.length < 2 || txt.length > 1200) { fecharPilula(); return }

  // Congela alvo e contexto AGORA: o leitor repagina sozinho (carrega a
  // próxima página enquanto você lê) e a seleção pode virar outra coisa
  // entre soltar o mouse e clicar no botão.
  alvoAtual = txt
  ctxAtual = fraseComAlvo(blocoDaSelecao(sel), txt)
  abrirPilula(sel)

  // Modo automático: uma palavra só, e a seleção precisa ficar parada —
  // arrastar por cima do texto dispararia dezenas de capturas.
  if (cfgK.auto && PALAVRAS(txt) === 1) {
    autoTimer = setTimeout(() => {
      if (alvoAtual !== txt) return
      salvarCaptura(txt, ctxAtual).then(ok => { if (ok) avisar(`"${txt}" → Revisar`, true) })
      fecharPilula()
    }, 700)
  }
}

document.addEventListener('mouseup', () => setTimeout(aoSelecionar, 10), true)
document.addEventListener('keyup', e => {
  if (e.shiftKey || e.key === 'Shift') setTimeout(aoSelecionar, 10)
}, true)
document.addEventListener('mousedown', e => {
  if (pilula && !pilula.contains(e.target)) fecharPilula()
}, true)
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharPilula() }, true)
// Repaginação/rolagem tiram a seleção do lugar — a pílula não pode ficar
// flutuando sobre um texto que já mudou.
window.addEventListener('scroll', fecharSeRolou, true)
window.addEventListener('resize', fecharPilula)

// Rede de segurança: extensão recarregada com a aba viva não polui o console
window.addEventListener('error', ev => {
  const m = String((ev && ev.message) || '')
  if (m.includes('Extension context invalidated') || m.includes('Receiving end does not exist')) {
    aposentado = true; ev.preventDefault(); ev.stopImmediatePropagation()
  }
}, true)
