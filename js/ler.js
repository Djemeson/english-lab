// ================================================================
// SEÇÃO LER — o leitor de ebooks nativo
// ================================================================
// Por que existir: a ponte com o Kindle sempre terminava numa exportação
// manual. Se o ganho do aparelho era só a tela, o leitor melhor é o que já
// está do lado das ferramentas — aqui a palavra que você não conhece vira
// card no mesmo segundo, com a frase do livro, sem exportar nada.
//
// Duas telas: ESTANTE (grade de capas) e LEITOR. O arquivo do livro mora no
// IndexedDB (BookDB, em core.js); só metadados, posição e destaques viajam
// para a nuvem.
//
// Lazy: este arquivo e o epub.js só carregam quando a seção abre. Nada aqui
// pode ser chamado por arquivo não-lazy (armadilha nº 1 do projeto).
// ================================================================
'use strict'

let _lerLivro = null      // livro aberto (referência a um item de `livros`)
let _lerEpub = null       // { zip, capitulos, ... } — só enquanto está aberto
let _lerCap = 0           // índice do capítulo atual
let _lerBlobs = []        // URLs de objeto das imagens (revogadas ao fechar)
let _lerSalvarTimer = null
let _lerIgnoraSel = false // suprime o popup logo após um duplo-clique
let _lerInicioLeitura = 0

// A Lexa mora em js/ai.js, que é do SHELL (cache-first). Este arquivo é lazy
// (network-first) e pode chegar ANTES dele numa visita logo após o deploy —
// por isso nunca falamos direto com o símbolo de lá.
const lexaNome = () => (typeof LEXA_NOME === 'string' ? LEXA_NOME : 'Lexa')
const lexaPrompt = () => (typeof lexaExplicar === 'function' ? lexaExplicar()
  : 'Você é a Lexa, tutora de inglês do Language Lab. Responda em PT-BR, 2 a 4 frases, sem introduções, traduzindo o SENTIDO e nunca palavra por palavra.')

const LER_DEF = {
  tema: 'papel', fonte: 'serif', tamanho: 19, entrelinha: 1.7,
  largura: 34, modo: 'pag', pintar: 'minhas'
}
function lerCfg() { return { ...LER_DEF, ...(cfg.ler || {}) } }
function lerSetCfg(chave, valor) {
  cfg.ler = { ...lerCfg(), [chave]: valor }
  saveCfg()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}

// ================================================================
// ESTANTE
// ================================================================
function renderLerSection() {
  if (_lerLivro) {
    // Voltar de outra seção RECONSTRÓI a moldura (innerHTML novo) — e o
    // capítulo tem de voltar junto, no ponto em que estava. Sem isto o leitor
    // reaparecia com a barra, o rodapé… e a página em branco.
    renderLeitor()
    const pos = _lerLivro.pos || {}
    lerIrParaCapitulo(_lerCap, pos.cap === _lerCap ? (pos.frac || 0) : 0)
    return
  }
  document.body.classList.remove('lendo')
  const area = el('ler-area'); if (!area) return
  const acoes = el('ler-ph-actions')
  if (acoes) {
    acoes.innerHTML = livros.length
      ? `<button class="btn btn-primary btn-sm" onclick="lerEscolherArquivo()">${ic('plus','ic-sm')} Adicionar livro</button>`
      : ''
  }
  const hdr = el('ler-header'); if (hdr) hdr.style.display = ''

  if (!livros.length) {
    area.innerHTML = `
      <div class="upload-area ler-drop" id="ler-drop"
           ondragover="event.preventDefault();this.classList.add('drag')"
           ondragleave="this.classList.remove('drag')"
           ondrop="this.classList.remove('drag');lerImportar(event.dataTransfer.files)"
           onclick="lerEscolherArquivo()">
        <div class="upload-icon">${ic('book','ic-xl')}</div>
        <p><strong>Clique</strong> ou arraste um livro aqui</p>
        <p>.epub · .txt · .html — o arquivo fica neste aparelho, não sobe para a nuvem</p>
      </div>
      <div class="ler-vazio-dica">
        <b>De onde tirar livros em inglês, de graça e legalmente:</b>
        Project Gutenberg (domínio público, 70 mil títulos), Standard Ebooks (os mesmos
        clássicos, bem diagramados) e qualquer <i>.epub</i> que você já tenha comprado sem DRM.
      </div>`
    return
  }

  const cards = livros
    .slice().sort((a, b) => (b.lastOpen || b.addedAt || 0) - (a.lastOpen || a.addedAt || 0))
    .map(l => {
      const pct = Math.round((l.progress || 0) * 100)
      const capa = l.cover
        ? `<img class="ler-capa-img" src="${l.cover}" alt="">`
        : `<div class="ler-capa-fake"><span>${esc((l.title || '?').slice(0, 28))}</span></div>`
      return `
      <div class="ler-card" onclick="lerAbrir('${l.id}')" data-tip="${escA(l.author || '')}">
        <div class="ler-capa">${capa}
          ${pct > 0 ? `<span class="ler-capa-pct">${pct}%</span>` : ''}
        </div>
        <div class="ler-card-nome">${esc(l.title || 'Sem título')}</div>
        <div class="ler-card-autor">${esc(l.author || '')}</div>
        <div class="ler-card-barra"><i style="width:${pct}%"></i></div>
        <button class="ler-card-x" title="Remover da estante"
                onclick="event.stopPropagation();lerExcluir('${l.id}')">${ic('trash','ic-sm')}</button>
      </div>`
    }).join('')

  area.innerHTML = `<div class="ler-estante">${cards}</div>`
}

function lerEscolherArquivo() {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = '.epub,.txt,.html,.htm,application/epub+zip,text/plain,text/html'
  inp.multiple = true
  inp.onchange = () => lerImportar(inp.files)
  inp.click()
}

async function lerImportar(files) {
  const lista = [...(files || [])]
  if (!lista.length) return
  for (const f of lista) {
    try { await _lerImportarUm(f) }
    catch (e) {
      console.warn('[ler] importação falhou:', e)
      toast(`"${f.name}": ${e.message}`, 'error')
    }
  }
  saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  renderLerSection()
}

async function _lerImportarUm(file) {
  const buf = await file.arrayBuffer()
  const u8 = new Uint8Array(buf.slice(0, 4))
  const ehZip = u8[0] === 0x50 && u8[1] === 0x4b   // "PK"
  const id = uid()
  toast(`Lendo "${file.name}"…`, 'info')

  let meta
  if (ehZip) {
    const ep = await epubAbrir(buf)
    // Contagem por capítulo AGORA: é ela que dá progresso honesto depois
    // (capítulo não tem tamanho igual — 1/12 não é 8% do livro).
    const caps = []
    for (const c of ep.capitulos) {
      const html = await ep.zip.texto(c.href)
      const txt = html ? epubTextoLimpo(html) : ''
      caps.push({ id: c.id, href: c.href, titulo: c.titulo, chars: txt.length, words: _lerContaPalavras(txt) })
    }
    meta = {
      title: ep.titulo, author: ep.autor, lang: ep.idioma, format: 'epub',
      chapters: caps, cover: await _lerCapaMiniatura(ep)
    }
  } else {
    const txt = new TextDecoder('utf-8').decode(buf)
    const ehHtml = /^\s*(<!doctype html|<html)/i.test(txt)
    const puro = ehHtml ? epubTextoLimpo(txt) : txt
    const caps = textoParaCapitulos(puro, file.name)
    meta = {
      title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Sem título',
      author: '', lang: 'en', format: 'txt',
      chapters: caps.map(c => ({
        id: c.id, href: '', titulo: c.titulo,
        chars: c.html.length, words: _lerContaPalavras(c.html)
      })),
      cover: ''
    }
  }

  if (!meta.chapters.length) throw new Error('não achei texto legível nesse arquivo')

  await BookDB.set(id, new Blob([buf]))
  livros.push({
    id, ...meta,
    totalWords: meta.chapters.reduce((s, c) => s + (c.words || 0), 0),
    totalChars: meta.chapters.reduce((s, c) => s + (c.chars || 0), 0),
    pos: { cap: 0, frac: 0 }, progress: 0, notes: [],
    minutos: 0, addedAt: Date.now(), updatedAt: Date.now(), lastOpen: 0
  })
  toast(`"${meta.title}" entrou na estante`, 'success')
}

function _lerContaPalavras(t) {
  const m = String(t || '').match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*/g)
  return m ? m.length : 0
}

// Capa: reduzida a ~180px e virada JPEG. Precisa caber no localStorage E no
// documento do Firestore (1 MB) junto com o resto — capa crua de 1,5 MB não cabe.
async function _lerCapaMiniatura(ep) {
  if (!ep.capaHref) return ''
  try {
    const bytes = await ep.zip.bytes(ep.capaHref)
    if (!bytes) return ''
    const url = URL.createObjectURL(new Blob([bytes]))
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i); i.onerror = () => rej(new Error('imagem inválida'))
      i.src = url
    })
    const L = 180
    const cv = document.createElement('canvas')
    cv.width = L; cv.height = Math.round(L * (img.height / img.width) || L * 1.5)
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
    URL.revokeObjectURL(url)
    const dataUrl = cv.toDataURL('image/jpeg', 0.72)
    return dataUrl.length > 120000 ? '' : dataUrl
  } catch (e) { return '' }
}

async function lerExcluir(id) {
  const l = livroPorId(id); if (!l) return
  if (!(await confirmModal({
    title: 'Remover da estante', icon: 'trash', confirmText: 'Remover',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Apagar <b>${esc(l.title)}</b> e o arquivo deste aparelho.
           Os <b>cards que você já criou continuam</b> — eles vivem no Revisar/Estudar, não aqui.</p>`
  }))) return
  await BookDB.del(id)
  // As leituras de capítulo (`pre:<id>:<n>`) morrem com o livro. Sem isto elas
  // ficariam órfãs no IndexedDB para sempre — ninguém mais teria como
  // alcançá-las para apagar, porque a chave depende de um livro que não existe.
  try {
    const chaves = await BookDB.keys()
    for (const k of chaves) {
      if (typeof k === 'string' && k.startsWith('pre:' + id + ':')) await BookDB.del(k)
    }
  } catch (e) {}
  livros = livros.filter(x => x.id !== id)
  saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  renderLerSection()
  toast('Livro removido', 'info')
}

// ================================================================
// ABRIR / FECHAR
// ================================================================
async function lerAbrir(id) {
  const l = livroPorId(id); if (!l) return
  const blob = await BookDB.get(id)
  if (!blob) {
    toast('O arquivo deste livro não está neste aparelho. Importe o .epub de novo.', 'warning')
    return
  }
  const buf = await blob.arrayBuffer()
  try {
    if (l.format === 'epub') {
      _lerEpub = await epubAbrir(buf)
    } else {
      const txt = new TextDecoder('utf-8').decode(buf)
      const ehHtml = /^\s*(<!doctype html|<html)/i.test(txt)
      _lerEpub = { txtCaps: textoParaCapitulos(ehHtml ? epubTextoLimpo(txt) : txt) }
    }
  } catch (e) {
    toast('Não consegui abrir: ' + e.message, 'error'); return
  }
  _lerLivro = l
  _lerCap = Math.min(l.pos?.cap || 0, l.chapters.length - 1)
  _lerInicioLeitura = Date.now()
  l.lastOpen = Date.now()
  renderLeitor()
  await lerIrParaCapitulo(_lerCap, l.pos?.frac || 0)
}

function lerFechar() {
  _lerRegistrarTempo()
  _lerSalvarPos(true)
  _lerGravarPendente()
  _lerBlobs.forEach(u => { try { URL.revokeObjectURL(u) } catch (e) {} })
  _lerBlobs = []
  _lerLivro = null; _lerEpub = null
  _lerT = null
  // Fechar o livro derruba a leitura junto: sem isto, as glosas do romance
  // apareceriam sobre o texto do Revisar e do Assistente, que usam o mesmo
  // glossário e não têm nada a ver com aquele contexto.
  if (typeof glossPreLimpar === 'function') glossPreLimpar()
  document.body.classList.remove('lendo')
  document.removeEventListener('keydown', _lerTeclas)
  document.removeEventListener('selectionchange', _lerSelecaoMudou)
  document.removeEventListener('visibilitychange', _lerAoEsconder)
  document.removeEventListener('fullscreenchange', _lerFullMudou)
  window.removeEventListener('resize', _lerAoRedimensionar)
  document.body.classList.remove('ler-full')
  try { if (document.fullscreenElement) document.exitFullscreen() } catch (e) {}
  clearTimeout(_lerSelTimer); clearTimeout(_lerResizeTimer)
  _lerFecharPopup()
  try { speechSynthesis.cancel() } catch (e) {}
  renderLerSection()
}

// Fechar a aba / trocar de app não dispara `lerFechar`. No celular é a saída
// mais comum de todas — sem isto, os últimos minutos de leitura e a última
// página viravam pó (a gravação é debounced em 1,5s).
function _lerAoEsconder() {
  if (document.visibilityState !== 'hidden' || !_lerLivro) return
  _lerRegistrarTempo()
  _lerSalvarPos(true)
  _lerGravarPendente()   // fecha a aba antes do debounce? o pendente vai junto
}

function _lerRegistrarTempo() {
  if (!_lerLivro || !_lerInicioLeitura) return
  const min = (Date.now() - _lerInicioLeitura) / 60000
  if (min > 0.2 && min < 240) _lerLivro.minutos = Math.round((_lerLivro.minutos || 0) + min)
  _lerInicioLeitura = Date.now()
}

// ================================================================
// LEITOR — moldura
// ================================================================
function renderLeitor() {
  const area = el('ler-area'); if (!area || !_lerLivro) return
  const hdr = el('ler-header'); if (hdr) hdr.style.display = 'none'
  const acoes = el('ler-ph-actions'); if (acoes) acoes.innerHTML = ''
  document.body.classList.add('lendo')
  const c = lerCfg()

  area.innerHTML = `
    <div class="ler-leitor" data-tema="${c.tema}" data-modo="${c.modo}">
      <div class="ler-barra">
        <button class="ler-btn" onclick="lerFechar()" data-tip="Voltar para a estante">${ic('chevronLeft','ic-sm')}</button>
        <button class="ler-btn ler-titulo" onclick="lerToggle('sumario')" data-tip="Sumário">
          <span id="ler-cap-nome"></span>${ic('chevronDown','ic-sm')}
        </button>
        <div class="ler-barra-dir">
          <button class="ler-btn" onclick="lerToggle('conversa')" data-tip="Conversar com a ${escA(lexaNome())} sobre este livro — quem é quem, onde se passa, o que está acontecendo">${ic('message','ic-sm')}</button>
          <button class="ler-btn" onclick="lerToggle('ferramentas')" data-tip="Palavras deste capítulo, cobertura e pré-estudo">${ic('sparkles','ic-sm')}</button>
          <button class="ler-btn" onclick="lerToggle('tipografia')" data-tip="Tamanho, fonte, tema e largura da coluna"><b style="font-size:15px">Aa</b></button>
          <button class="ler-btn" id="ler-btn-full" onclick="lerAlternarFull()" data-tip="Modo tela cheia (F) — só o texto">${ic('expand','ic-sm')}</button>
        </div>
      </div>

      <div class="ler-painel hidden" id="ler-sumario"></div>
      <div class="ler-painel hidden" id="ler-tipografia"></div>
      <div class="ler-painel hidden" id="ler-ferramentas"></div>
      <div class="ler-painel hidden" id="ler-conversa"></div>

      <div class="ler-palco">
        <button class="ler-seta ler-seta-e" onclick="lerVoltarPagina()" aria-label="Página anterior">${ic('chevronLeft','ic-sm')}</button>
        <div class="ler-viewport" id="ler-viewport">
          <div class="ler-conteudo" id="ler-conteudo"></div>
        </div>
        <button class="ler-seta ler-seta-d" onclick="lerAvancarPagina()" aria-label="Próxima página">${ic('chevronRight','ic-sm')}</button>
      </div>

      <div class="ler-rodape">
        <button class="ler-btn ler-btn-txt" onclick="lerCapituloAnterior()">Anterior</button>
        <div class="ler-progresso"><i id="ler-prog-barra"></i></div>
        <span class="ler-prog-txt" id="ler-prog-txt"></span>
        <button class="ler-btn ler-btn-txt" onclick="lerCapituloProximo()">Próximo</button>
      </div>
    </div>`

  _lerAplicarTipografia()
  const vp = el('ler-viewport')
  vp.addEventListener('scroll', _lerAoRolar, { passive: true })
  vp.addEventListener('dblclick', _lerDuploClique)
  vp.addEventListener('mouseup', () => setTimeout(_lerAoSelecionar, 10))
  // Glossário no hover: passar o mouse numa palavra que já virou card mostra a
  // SUA glosa na hora. Só entra em ponteiro fino — no celular a mesma coisa
  // aparece dentro do popup de seleção (nenhum gesto novo; ver _lerAoSelecionar).
  if (typeof glossAtivar === 'function') {
    glossAtivar(vp, {
      // Não reimplementa Explicar: seleciona a palavra e deixa o popup normal
      // abrir. Assim o botão da Lexa no balão entrega TUDO que a seleção
      // entrega (Explicar, Estudar, Ouvir, Imagens, Wikipédia, Web).
      aoExplicar: (alvo, pos) => {
        if (typeof glossSelecionar === 'function' && glossSelecionar(pos)) _lerAoSelecionar()
      }
    })
  }
  // Toque: arrastar para virar, tocar nas bordas para virar, segurar numa
  // palavra para selecionar (o popup vem pelo selectionchange, porque no
  // celular não existe mouseup depois do toque longo).
  vp.addEventListener('touchstart', _lerToqueIni, { passive: true })
  vp.addEventListener('touchmove', _lerToqueMove, { passive: true })
  vp.addEventListener('touchend', _lerToqueFim, { passive: true })
  vp.addEventListener('touchcancel', () => { _lerT = null }, { passive: true })
  // remove antes de adicionar: renderLeitor pode rodar de novo (voltar da
  // estante para o mesmo livro) e ouvinte duplicado vira trabalho duplicado
  document.removeEventListener('selectionchange', _lerSelecaoMudou)
  document.removeEventListener('keydown', _lerTeclas)
  window.removeEventListener('resize', _lerAoRedimensionar)
  document.removeEventListener('fullscreenchange', _lerFullMudou)
  document.addEventListener('selectionchange', _lerSelecaoMudou)
  document.addEventListener('keydown', _lerTeclas)
  document.addEventListener('visibilitychange', _lerAoEsconder)
  document.addEventListener('fullscreenchange', _lerFullMudou)
  window.addEventListener('resize', _lerAoRedimensionar)
  _lerDicaDeToque()
}

// ---- gestos de toque ----------------------------------------------------
let _lerT = null
const LER_ZONA = 0.26      // 26% de cada borda vira "virar página"

function _lerToqueIni(ev) {
  if (ev.touches.length !== 1) { _lerT = null; return }
  const vp = el('ler-viewport')
  const t = ev.touches[0]
  _lerT = { x: t.clientX, y: t.clientY, t: Date.now(), sl: vp.scrollLeft, dir: null, arrastou: false }
}

function _lerToqueMove(ev) {
  if (!_lerT || ev.touches.length !== 1) return
  const t = ev.touches[0]
  const dx = t.clientX - _lerT.x
  const dy = t.clientY - _lerT.y
  if (!_lerT.dir) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
    _lerT.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
  }
  if (_lerT.dir !== 'h' || !_lerPaginado()) return
  // Selecionando texto: o dedo é do usuário, não nosso.
  if (String(window.getSelection() || '').trim()) { _lerT.dir = 'v'; return }
  // A página acompanha o dedo — é isso que faz o gesto parecer papel.
  const vp = el('ler-viewport')
  vp.scrollLeft = _lerT.sl - dx
  _lerT.arrastou = true
}

function _lerToqueFim(ev) {
  const inicio = _lerT
  _lerT = null
  if (!inicio || !_lerPaginado()) return
  const t = (ev.changedTouches && ev.changedTouches[0]) || null
  if (!t) return
  const dx = t.clientX - inicio.x
  const dy = t.clientY - inicio.y
  const dt = Date.now() - inicio.t
  const vp = el('ler-viewport')
  const passo = _lerPasso()

  if (inicio.arrastou) {
    // Solta: cai na página inteira mais próxima, com o empurrãozinho da
    // direção (arrastar 20% já vira — ninguém arrasta a tela toda).
    const pagIni = Math.round(inicio.sl / passo)
    let alvo = pagIni
    if (dx <= -passo * 0.2 || (dt < 320 && dx < -40)) alvo = pagIni + 1
    else if (dx >= passo * 0.2 || (dt < 320 && dx > 40)) alvo = pagIni - 1
    _lerIrParaPagina(alvo)
    return
  }

  // Toque seco e curto: bordas viram a página. O miolo fica livre para o
  // toque longo (selecionar palavra) e para tocar num link.
  const parado = Math.abs(dx) < 12 && Math.abs(dy) < 12
  if (!parado || dt > 400) return
  if (String(window.getSelection() || '').trim()) return
  if (ev.target && ev.target.closest && ev.target.closest('a,#ler-pop')) return
  const r = vp.getBoundingClientRect()
  const rel = (t.clientX - r.left) / (r.width || 1)
  if (rel <= LER_ZONA) lerVoltarPagina()
  else if (rel >= 1 - LER_ZONA) lerAvancarPagina()
}

// Vai para uma página inteira, atravessando o capítulo quando passa do fim.
function _lerIrParaPagina(n) {
  const vp = el('ler-viewport'); if (!vp) return
  const passo = _lerPasso()
  const max = vp.scrollWidth - vp.clientWidth
  if (n < 0) { lerCapituloAnterior(); return }
  if (n * passo > max + 4) { lerCapituloProximo(); return }
  vp.scrollLeft = Math.max(0, Math.min(max, n * passo))
  _lerAoRolar()
}

// Uma vez só: no celular ninguém adivinha que a borda vira a página.
function _lerDicaDeToque() {
  try {
    if (!matchMedia('(hover: none)').matches) return
    if (localStorage.getItem('el-ler-dica') === '1') return
    localStorage.setItem('el-ler-dica', '1')
    setTimeout(() => toast('Arraste ou toque nas bordas para virar. Segure numa palavra para estudá-la.', 'info'), 900)
  } catch (e) {}
}

// No celular a seleção nasce de um toque longo — não há mouseup para ouvir.
let _lerSelTimer = null
function _lerSelecaoMudou() {
  if (!_lerLivro) return
  clearTimeout(_lerSelTimer)
  _lerSelTimer = setTimeout(() => {
    const sel = window.getSelection()
    const txt = String(sel || '').trim()
    if (!txt) { if (!_lerIgnoraSel) _lerFecharPopup(); return }
    if (txt === _lerPopAlvo) return                 // popup já é desta seleção
    const no = sel.anchorNode
    const dentro = no && el('ler-conteudo') && el('ler-conteudo').contains(no.nodeType === 3 ? no.parentElement : no)
    if (dentro) _lerAoSelecionar()
  }, 350)
}

function lerToggle(qual) {
  const alvos = { sumario: _lerRenderSumario, tipografia: _lerRenderTipografia,
                  ferramentas: _lerRenderFerramentas, conversa: _lerRenderConversa }
  for (const k of Object.keys(alvos)) {
    const p = el('ler-' + k)
    if (!p) continue
    if (k === qual) {
      const abrindo = p.classList.contains('hidden')
      p.classList.toggle('hidden', !abrindo)
      if (abrindo) alvos[k]()
    } else p.classList.add('hidden')
  }
}

// ================================================================
// TIPOGRAFIA — o motivo de o leitor existir: ler sem cansar a vista
// ================================================================
const LER_TEMAS = [
  { id: 'papel',  nome: 'Papel',   bg: '#f7f3ea', fg: '#2b2721' },
  { id: 'sepia',  nome: 'Sépia',   bg: '#e8dcc4', fg: '#3a3125' },
  { id: 'cinza',  nome: 'Cinza',   bg: '#d8d8d4', fg: '#26262a' },
  { id: 'noite',  nome: 'Noite',   bg: '#15181d', fg: '#c8ccd2' },
  { id: 'preto',  nome: 'Preto',   bg: '#000000', fg: '#a8adb4' }
]

function _lerRenderTipografia() {
  const c = lerCfg()
  const p = el('ler-tipografia')
  const linha = (rot, html) => `<div class="ler-tip-linha"><span>${rot}</span><div>${html}</div></div>`
  const passo = (chave, delta, txt) => `<button class="ler-btn" onclick="lerAjustar('${chave}',${delta})">${txt}</button>`
  p.innerHTML = `
    ${linha('Tema', LER_TEMAS.map(t =>
      `<button class="ler-tema${t.id === c.tema ? ' on' : ''}" style="background:${t.bg};color:${t.fg}"
        onclick="lerAjustar('tema','${t.id}')" data-tip="${t.nome}">Aa</button>`).join(''))}
    ${linha('Fonte', ['serif', 'sans'].map(f =>
      `<button class="ler-btn ler-pill${f === c.fonte ? ' on' : ''}" onclick="lerAjustar('fonte','${f}')"
        style="font-family:${f === 'serif' ? 'Newsreader,Georgia,serif' : 'system-ui,sans-serif'}">${f === 'serif' ? 'Serifada' : 'Sem serifa'}</button>`).join(''))}
    ${linha('Tamanho', passo('tamanho', -1, 'A−') + `<b class="ler-val">${c.tamanho}px</b>` + passo('tamanho', 1, 'A+'))}
    ${linha('Entrelinha', passo('entrelinha', -0.1, '−') + `<b class="ler-val">${c.entrelinha.toFixed(1)}</b>` + passo('entrelinha', 0.1, '+'))}
    ${linha('Largura', passo('largura', -2, '−') + `<b class="ler-val">${c.largura}em</b>` + passo('largura', 2, '+'))}
    ${linha('Leitura', ['pag', 'rolagem'].map(m =>
      `<button class="ler-btn ler-pill${m === c.modo ? ' on' : ''}" onclick="lerAjustar('modo','${m}')">${m === 'pag' ? 'Virar página' : 'Rolagem'}</button>`).join(''))}
    ${linha('Destacar', [['nada', 'Nada'], ['minhas', 'O que estou estudando']].map(([v, r]) =>
      `<button class="ler-btn ler-pill${v === c.pintar ? ' on' : ''}" onclick="lerAjustar('pintar','${v}')">${r}</button>`).join(''))}
    <div class="ler-tip-nota">Dica: <b>duplo-clique</b> numa palavra manda ela para o Revisar com a frase.
      Selecione um trecho para a ${lexaNome()} explicar, ouvir em voz alta, salvar para estudo
      ou procurar na Wikipédia.</div>`
}

function lerAjustar(chave, valor) {
  const c = lerCfg()
  const frac = _lerFracAtual()
  if (typeof valor === 'number' && chave !== 'tamanho' && chave !== 'entrelinha' && chave !== 'largura') return
  if (chave === 'tamanho')    lerSetCfg(chave, Math.min(34, Math.max(13, c.tamanho + valor)))
  else if (chave === 'entrelinha') lerSetCfg(chave, Math.min(2.4, Math.max(1.2, Math.round((c.entrelinha + valor) * 10) / 10)))
  else if (chave === 'largura')    lerSetCfg(chave, Math.min(56, Math.max(20, c.largura + valor)))
  else lerSetCfg(chave, valor)

  const novo = lerCfg()
  const leitor = document.querySelector('.ler-leitor')
  if (leitor) { leitor.dataset.tema = novo.tema; leitor.dataset.modo = novo.modo }
  _lerAplicarTipografia()
  _lerRenderTipografia()
  if (chave === 'pintar') { _lerRepintar() }
  // Mudou o corpo do texto: a "página 12" de antes não é a mesma agora —
  // por isso a posição é guardada como FRAÇÃO e reaplicada.
  requestAnimationFrame(() => _lerIrParaFrac(frac))
}

function _lerAplicarTipografia() {
  const c = lerCfg()
  const cont = el('ler-conteudo'); if (!cont) return
  const leitor = document.querySelector('.ler-leitor')
  cont.style.setProperty('--ler-fs', c.tamanho + 'px')
  cont.style.setProperty('--ler-lh', c.entrelinha)
  cont.style.setProperty('--ler-ff', c.fonte === 'serif'
    ? "'Newsreader', Georgia, 'Times New Roman', serif"
    : "system-ui, -apple-system, 'Segoe UI', sans-serif")
  // A MEDIDA (largura da linha) em px, no elemento de fora: no modo paginado
  // é a área de rolagem que precisa ter essa largura, não só o texto — e `em`
  // ali resolveria contra a fonte do app, não contra a fonte da leitura.
  if (leitor) leitor.style.setProperty('--ler-col-px', Math.round(c.largura * c.tamanho) + 'px')
  _lerMedirPaginas()
}

// ================================================================
// CAPÍTULOS
// ================================================================
async function _lerHtmlDoCapitulo(i) {
  if (_lerEpub.txtCaps) return _lerEpub.txtCaps[i] ? _lerEpub.txtCaps[i].html : ''
  const c = _lerLivro.chapters[i]
  if (!c || !c.href) return ''
  const html = await _lerEpub.zip.texto(c.href)
  return html ? await _lerSanitizar(html, c.href) : ''
}

// O HTML vem de um arquivo de terceiro: entra na página SEM script, sem
// folha de estilo do editor (a tipografia é NOSSA — é o ponto do módulo) e
// sem handler inline. As imagens viram blob: do próprio zip.
async function _lerSanitizar(html, capHref) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,link,meta,title,iframe,object,embed,form,input,button,video,audio,svg').forEach(e => e.remove())
  const base = _dir(capHref)

  for (const e of [...doc.body.querySelectorAll('*')]) {
    for (const at of [...e.attributes]) {
      const n = at.name.toLowerCase()
      if (n.startsWith('on') || n === 'style' || n === 'class' || n === 'id') e.removeAttribute(at.name)
    }
  }
  for (const img of [...doc.body.querySelectorAll('img')]) {
    const src = img.getAttribute('src')
    const alvo = src && _resolver(base, src)
    const bytes = alvo && await _lerEpub.zip.bytes(alvo)
    if (!bytes) { img.remove(); continue }
    const url = URL.createObjectURL(new Blob([bytes]))
    _lerBlobs.push(url)
    img.setAttribute('src', url)
    img.setAttribute('loading', 'lazy')
  }
  for (const a of [...doc.body.querySelectorAll('a')]) {
    const href = a.getAttribute('href') || ''
    if (/^(https?:)?\/\//i.test(href)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); continue }
    // Link interno do livro: vira salto de capítulo (o href do zip não existe
    // como URL nenhuma nesta página).
    const alvo = _resolver(base, href)
    const idx = _lerLivro.chapters.findIndex(c => c.href === alvo)
    a.removeAttribute('href')
    if (idx >= 0) { a.setAttribute('data-cap', String(idx)); a.classList.add('ler-link-int') }
  }
  return doc.body.innerHTML
}

// Enquanto o capítulo está sendo montado e posicionado, NADA grava posição.
// Sem esta trava o bug era autodestrutivo: a restauração caía na página 0
// (layout ainda não pronto), o evento de scroll disparava, e o zero era salvo
// POR CIMA do marcador de verdade — uma reabertura apagava o lugar para sempre.
let _lerRestaurando = false
let _lerFracAlvo = 0
let _lerAlvoAte = 0

// Espera o texto realmente ter a forma final. Duas coisas mudam a paginação
// DEPOIS do innerHTML e eram a causa raiz de "não voltou onde eu parei":
// a fonte serifada (baixada do Google Fonts) e as imagens do próprio livro,
// que só ganham altura quando carregam.
async function _lerEsperarLayout(cont) {
  const teto = ms => new Promise(res => setTimeout(res, ms))
  try { await Promise.race([document.fonts.ready, teto(1200)]) } catch (e) {}
  const imgs = [...cont.querySelectorAll('img')].filter(im => !im.complete)
  if (imgs.length) {
    await Promise.race([
      Promise.all(imgs.map(im => new Promise(res => {
        im.addEventListener('load', res, { once: true })
        im.addEventListener('error', res, { once: true })
      }))),
      teto(1500)
    ])
  }
  // dois quadros para o navegador refazer as colunas (com teto: aba oculta
  // não roda requestAnimationFrame e travaria aqui para sempre)
  await Promise.race([
    new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))),
    teto(300)
  ])
}

// Enquanto o capítulo se monta e procura o ponto certo, o texto fica
// invisível: sem isto via-se a página 0 e um salto — parecia que o leitor
// tinha perdido o lugar e voltado sozinho.
function _lerMostrarTexto(mostrar) {
  const c = el('ler-conteudo')
  if (c) c.classList.toggle('ler-montando', !mostrar)
}

async function lerIrParaCapitulo(i, frac = 0) {
  if (!_lerLivro) return
  i = Math.max(0, Math.min(i, _lerLivro.chapters.length - 1))
  _lerCap = i
  const cont = el('ler-conteudo'); if (!cont) return
  _lerRestaurando = true
  _lerMostrarTexto(false)
  _lerFracAlvo = frac
  cont.innerHTML = '<p class="ler-carregando">carregando…</p>'
  const html = await _lerHtmlDoCapitulo(i)
  if (!_lerLivro || _lerCap !== i) { _lerRestaurando = false; _lerMostrarTexto(true); return }   // trocou de capítulo no meio
  cont.innerHTML = html || '<p class="ler-carregando">(capítulo vazio)</p>'
  cont.querySelectorAll('.ler-link-int').forEach(a => {
    a.onclick = () => lerIrParaCapitulo(+a.dataset.cap, 0)
  })
  const nome = el('ler-cap-nome')
  if (nome) nome.textContent = _lerLivro.chapters[i].titulo || `Parte ${i + 1}`
  _lerRepintar()
  _lerMedirPaginas()
  // A leitura do capítulo anterior NÃO pode sobrar: as glosas são presas ao
  // contexto DAQUELE capítulo, e mostrar a do capítulo 3 no capítulo 4 seria
  // pior do que não mostrar nada. Troca de capítulo zera e recarrega.
  if (typeof glossPreLimpar === 'function') glossPreLimpar()
  lerPreAplicar(i).catch(() => {})

  await _lerEsperarLayout(cont)
  if (!_lerLivro || _lerCap !== i) { _lerRestaurando = false; _lerMostrarTexto(true); return }
  _lerMedirPaginas()          // remede já com a forma final
  _lerIrParaFrac(frac)

  // Confere o pouso. Se o alvo não pegou (colunas ainda não existiam), tenta
  // de novo — é barato e cobre livro grande em máquina lenta.
  if (frac > 0.02 && _lerFracAtual() < frac * 0.6) {
    await new Promise(res => setTimeout(res, 250))
    if (_lerCap === i) { _lerMedirPaginas(); _lerIrParaFrac(frac) }
  }
  _lerAtualizarProgresso()
  // Imagem preguiçosa que carrega depois ainda empurra o texto: por alguns
  // segundos, qualquer chegada dessas devolve o leitor ao ponto certo.
  _lerAlvoAte = Date.now() + 4000
  cont.querySelectorAll('img').forEach(im => {
    if (im.complete) return
    im.addEventListener('load', () => {
      if (Date.now() > _lerAlvoAte || _lerCap !== i) return
      _lerMedirPaginas(); _lerIrParaFrac(_lerFracAlvo)
    }, { once: true })
  })
  _lerRestaurando = false
  _lerMostrarTexto(true)
  const p = el('ler-sumario'); if (p) p.classList.add('hidden')
}

function lerCapituloProximo() { if (_lerCap + 1 < _lerLivro.chapters.length) lerIrParaCapitulo(_lerCap + 1, 0) }
function lerCapituloAnterior() { if (_lerCap > 0) lerIrParaCapitulo(_lerCap - 1, 1) }

function _lerRenderSumario() {
  const p = el('ler-sumario')
  p.innerHTML = `<div class="ler-sumario-lista">` + _lerLivro.chapters.map((c, i) => `
    <button class="ler-sum-item${i === _lerCap ? ' on' : ''}" onclick="lerIrParaCapitulo(${i},0)">
      <span>${esc(c.titulo || 'Parte ' + (i + 1))}</span>
      <i>${c.words ? c.words.toLocaleString('pt-BR') + ' palavras' : ''}</i>
    </button>`).join('') + `</div>`
}

// ================================================================
// POSIÇÃO, PÁGINAS E PROGRESSO
// ================================================================
// Paginado = colunas CSS da altura da tela; "virar a página" é rolar a
// viewport na horizontal. Rolagem = scroll vertical de sempre. A posição é
// guardada como FRAÇÃO do capítulo, então sobrevive a mudar fonte/tamanho.
function _lerPaginado() { return lerCfg().modo === 'pag' }

function _lerMedirPaginas() {
  const vp = el('ler-viewport'); if (!vp) return
  const cont = el('ler-conteudo')
  if (_lerPaginado()) {
    // Cada coluna mede EXATAMENTE a largura da área de rolagem (que já está
    // limitada à medida escolhida pelo CSS). Assim "virar a página" é somar
    // clientWidth ao scrollLeft e cair sempre no início de uma página —
    // nada de meia linha cortada na borda.
    const w = vp.clientWidth
    if (w < 80) return                 // ainda sem layout (aba oculta): não mede
    cont.style.height = vp.clientHeight + 'px'
    cont.style.columnWidth = w + 'px'
    cont.style.columnGap = '0px'
    _lerMedida = { w, h: vp.clientHeight }
  } else {
    cont.style.height = ''
    cont.style.columnWidth = ''
    cont.style.columnGap = ''
  }
}

// A viewport só serve de RÉGUA quando está de fato na tela. Fora da seção ela
// continua no DOM com tamanho ZERO — e medir ali devolve 0, que é o valor mais
// destrutivo que existe aqui: vira "você parou no começo do capítulo".
function _lerMedivel() {
  const vp = el('ler-viewport')
  return !!(vp && vp.offsetParent && vp.clientWidth > 40)
}

// Largura REAL de uma página (fracionária). `clientWidth` é arredondado, e
// somar 646 numa coluna de 646,4 acumula meia linha de desvio a cada dezena
// de páginas — o texto ia "escorregando" para o lado.
function _lerPasso() {
  const vp = el('ler-viewport'); if (!vp) return 1
  return vp.getBoundingClientRect().width || vp.clientWidth || 1
}

function _lerFracAtual() {
  const vp = el('ler-viewport'); if (!vp) return 0
  if (_lerPaginado()) {
    const max = vp.scrollWidth - vp.clientWidth
    return max > 0 ? vp.scrollLeft / max : 0
  }
  const max = vp.scrollHeight - vp.clientHeight
  return max > 0 ? vp.scrollTop / max : 0
}

function _lerIrParaFrac(frac) {
  const vp = el('ler-viewport'); if (!vp) return
  frac = Math.max(0, Math.min(1, frac || 0))
  // Restaurar tem de ser INSTANTÂNEO. No modo rolagem a viewport tem
  // `scroll-behavior:smooth` (bom para virar página na mão, péssimo aqui): a
  // volta virava uma animação de ~300ms e cada quadro dela disparava `scroll`,
  // gravando posições intermediárias por cima da boa.
  // `behavior:'instant'` vence o CSS SEM alterar o elemento — a primeira
  // versão trocava `style.scrollBehavior` e devolvia num requestAnimationFrame
  // que nem sempre roda (aba em segundo plano), deixando o 'auto' grudado.
  let alvo
  if (_lerPaginado()) {
    const max = vp.scrollWidth - vp.clientWidth
    const pag = _lerPasso()
    // Cai sempre no COMEÇO de uma página: meia página cortada é o que mais
    // incomoda quem retoma a leitura.
    alvo = { left: Math.min(max, Math.round((max * frac) / pag) * pag) }
  } else {
    alvo = { top: (vp.scrollHeight - vp.clientHeight) * frac }
  }
  try { vp.scrollTo({ ...alvo, behavior: 'instant' }) }
  catch (e) { if (alvo.left != null) vp.scrollLeft = alvo.left; else vp.scrollTop = alvo.top }
  _lerAtualizarProgresso()
}

function lerAvancarPagina() {
  const vp = el('ler-viewport'); if (!vp) return
  if (_lerPaginado()) {
    const fim = vp.scrollLeft >= vp.scrollWidth - vp.clientWidth - 4
    if (fim) return lerCapituloProximo()
    const p = _lerPasso()
    vp.scrollLeft = Math.round(vp.scrollLeft / p + 1) * p
  } else {
    const fim = vp.scrollTop >= vp.scrollHeight - vp.clientHeight - 4
    if (fim) return lerCapituloProximo()
    vp.scrollTop += vp.clientHeight * 0.9
  }
  _lerAoRolar()
}
function lerVoltarPagina() {
  const vp = el('ler-viewport'); if (!vp) return
  if (_lerPaginado()) {
    if (vp.scrollLeft <= 4) return lerCapituloAnterior()
    const p = _lerPasso()
    vp.scrollLeft = Math.max(0, Math.round(vp.scrollLeft / p - 1) * p)
  } else {
    if (vp.scrollTop <= 4) return lerCapituloAnterior()
    vp.scrollTop -= vp.clientHeight * 0.9
  }
  _lerAoRolar()
}

function _lerAoRolar() { _lerAtualizarProgresso(); _lerSalvarPos() }

function _lerAtualizarProgresso() {
  if (!_lerLivro) return
  const frac = _lerFracAtual()
  const caps = _lerLivro.chapters
  const antes = caps.slice(0, _lerCap).reduce((s, c) => s + (c.chars || 0), 0)
  const total = _lerLivro.totalChars || caps.reduce((s, c) => s + (c.chars || 0), 0) || 1
  const pct = Math.max(0, Math.min(1, (antes + (caps[_lerCap]?.chars || 0) * frac) / total))
  _lerLivro.progress = pct
  const b = el('ler-prog-barra'); if (b) b.style.width = (pct * 100).toFixed(1) + '%'
  const t = el('ler-prog-txt')
  if (t) {
    const faltam = Math.round(((_lerLivro.totalWords || 0) * (1 - pct)) / 220)   // ~220 ppm
    t.textContent = `${Math.round(pct * 100)}%` + (faltam > 0 ? ` · faltam ~${_lerTempo(faltam)}` : '')
  }
}
function _lerTempo(min) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`
}

function _lerSalvarPos(agora = false) {
  if (!_lerLivro) return
  // Trava do parágrafo acima: durante a restauração, a posição na tela ainda
  // não é a posição do leitor — gravá-la apagaria o marcador.
  if (_lerRestaurando) return
  if (!_lerMedivel()) return

  // A MEDIDA é congelada AQUI, com o layout válido; o debounce só persiste.
  // Antes ela era tirada DENTRO do timer — e 1,5s depois de você trocar de
  // seção a viewport já estava com tamanho zero, então o marcador de verdade
  // era sobrescrito por `frac: 0`. Era esta linha que fazia o livro "não
  // voltar onde eu parei" ao ir para outra aba e voltar.
  _lerPosPendente = { cap: _lerCap, frac: _lerFracAtual() }
  clearTimeout(_lerSalvarTimer)
  if (agora) _lerGravarPendente()
  else _lerSalvarTimer = setTimeout(_lerGravarPendente, 1500)
}

// Como a medida já está congelada, gravar não depende mais de a seção estar
// na tela — dá para descarregar o pendente a qualquer momento (sair da seção,
// esconder a aba, fechar o livro) sem risco de gravar zero.
let _lerPosPendente = null
function _lerGravarPendente() {
  clearTimeout(_lerSalvarTimer)
  if (!_lerLivro || !_lerPosPendente) return
  _lerLivro.pos = _lerPosPendente
  _lerLivro.updatedAt = Date.now()
  _lerPosPendente = null
  saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}

// No celular, esconder a barra de endereço dispara `resize` a cada rolagem.
// Re-paginar nessas horas fazia o texto pular na mão do leitor. Só remedimos
// quando a LARGURA muda (girar a tela, redimensionar a janela) ou quando a
// altura muda muito — nunca pelos ~60px da barra do navegador.
let _lerMedida = { w: 0, h: 0 }
let _lerResizeTimer = null
function _lerAoRedimensionar() {
  if (!_lerLivro || !_lerMedivel()) return
  const vp = el('ler-viewport'); if (!vp) return
  // Teclado do celular aberto (digitando na conversa) muda a altura em
  // centenas de pixels e não tem nada a ver com paginação.
  if (/input|textarea/i.test((document.activeElement || {}).tagName || '')) return
  const w = vp.clientWidth, h = vp.clientHeight
  if (w === _lerMedida.w && Math.abs(h - _lerMedida.h) < 120) return
  clearTimeout(_lerResizeTimer)
  _lerResizeTimer = setTimeout(() => {
    if (!_lerLivro) return
    const frac = _lerFracAtual()
    _lerMedirPaginas()
    const vp2 = el('ler-viewport')
    if (vp2) _lerMedida = { w: vp2.clientWidth, h: vp2.clientHeight }
    requestAnimationFrame(() => _lerIrParaFrac(frac))
  }, 120)
}

function _lerTeclas(e) {
  if (!_lerLivro) return
  const dentroDeCampo = /input|textarea|select/i.test((e.target.tagName || ''))
  if (dentroDeCampo) return
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); lerAvancarPagina() }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); lerVoltarPagina() }
  else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); lerAlternarFull() }
  else if (e.key === 'Escape') { _lerFecharPopup(); lerToggle('') }
}

// ================================================================
// CAPTURA — a razão de o livro morar aqui dentro
// ================================================================
// Duplo-clique numa palavra: o navegador já a seleciona sozinho, então só
// precisamos ler a seleção, achar a frase em volta e mandar para o Revisar.
function _lerDuploClique(ev) {
  const sel = window.getSelection()
  const palavra = String(sel || '').replace(/\s+/g, ' ').trim()
  if (!palavra || /\s/.test(palavra) || palavra.length < 2) return
  _lerIgnoraSel = true
  setTimeout(() => { _lerIgnoraSel = false }, 400)
  _lerCapturar(palavra, _lerFraseEmVolta(sel, palavra), ev.target)
  try { sel.removeAllRanges() } catch (e) {}
  _lerFecharPopup()
}

function _lerFraseEmVolta(sel, alvo) {
  let no = sel.anchorNode
  if (no && no.nodeType === 3) no = no.parentElement
  let bloco = ''
  for (let i = 0; i < 6 && no && no.id !== 'ler-conteudo'; i++) {
    const t = (no.textContent || '').replace(/\s+/g, ' ').trim()
    if (t.length > bloco.length) bloco = t
    if (bloco.length > 500) break
    no = no.parentElement
  }
  if (!bloco) return ''
  const i = bloco.toLowerCase().indexOf(String(alvo).toLowerCase())
  if (i < 0) return bloco.slice(0, 400)
  let ini = 0
  for (let p = i; p > 0; p--) {
    if (/[.!?…]/.test(bloco[p - 1]) && /\s/.test(bloco[p] || ' ')) { ini = p; break }
  }
  let fim = bloco.length
  for (let p = i + alvo.length; p < bloco.length; p++) {
    if (/[.!?…]/.test(bloco[p])) { fim = p + 1; break }
  }
  const frase = bloco.slice(ini, fim).trim()
  return (frase.length < 8 ? bloco : frase).slice(0, 400)
}

// Quantas palavras ainda são "um objeto de estudo" e não uma frase inteira.
// Acima disso, o que você marcou É o contexto — não faz sentido virar título
// de card, e quem quebra em itens é o Raio-X da triagem, no Revisar.
const LER_MAX_ALVO = 4

function _lerCapturar(selecao, frase, alvoDOM) {
  const bruto = String(selecao || '').replace(/\s+/g, ' ').trim()
  if (!bruto) return
  const nPalavras = bruto.split(' ').filter(Boolean).length

  if (nPalavras > LER_MAX_ALVO) {
    // Trecho longo: entra como FRASE (sem palavra-alvo). É o mesmo caminho
    // dos destaques do Kindle — o Raio-X tria os itens dela depois.
    const jaTem = words.some(w => (w.context || '') === bruto)
    if (jaTem) { toast('Esse trecho já está na sua fila', 'info'); return }
    const w = createWord({
      word: '', context: bruto,
      source_type: 'kindle',
      source_title: _lerLivro.title,
      source_context: _lerLivro.chapters[_lerCap]?.titulo || '',
      lang: _lerLivro.lang || 'en'
    })
    ;(_lerLivro.notes = _lerLivro.notes || []).push({
      id: uid(), cap: _lerCap, word: '', text: bruto, wordId: w && w.id, created_at: Date.now()
    })
    _lerPersistirCaptura()
    toast('Trecho salvo no Revisar — a triagem quebra em itens lá', 'success')
    return
  }

  const limpa = bruto.replace(/^[^A-Za-zÀ-ÿ']+|[^A-Za-zÀ-ÿ']+$/g, '')
  if (!limpa) return
  const jaTem = words.some(w => (w.word || '').toLowerCase() === limpa.toLowerCase())
  if (jaTem) { toast(`"${limpa}" já está na sua fila`, 'info'); return }
  const w = createWord({
    word: limpa, context: frase,
    source_type: 'kindle',
    source_title: _lerLivro.title,
    source_context: _lerLivro.chapters[_lerCap]?.titulo || '',
    lang: _lerLivro.lang || 'en'
  })
  ;(_lerLivro.notes = _lerLivro.notes || []).push({
    id: uid(), cap: _lerCap, word: limpa, text: frase, wordId: w && w.id, created_at: Date.now()
  })
  _lerPersistirCaptura()
  toast(`"${limpa}" foi para o Revisar`, 'success')
}

function _lerPersistirCaptura() {
  saveWords(); saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  if (typeof renderSidebar === 'function') { try { renderSidebar() } catch (e) {} }
  _lerRepintar()
}

// ---- popup de seleção: Explicar / Estudar / Ouvir ----
let _lerPopAlvo = '', _lerPopCtx = ''
function _lerFecharPopup() { const p = el('ler-pop'); if (p) p.remove(); _lerPopAlvo = '' }

function _lerAoSelecionar() {
  if (_lerIgnoraSel) return
  const sel = window.getSelection()
  const txt = String(sel || '').replace(/\s+/g, ' ').trim()
  // Teto GENEROSO de propósito: num livro, marcar a frase inteira (ou o
  // parágrafo) é o uso normal. O teto antigo era de 12 palavras e engolia a
  // seleção em silêncio — o pior tipo de falha, porque nada acontecia e não
  // dava para saber por quê. Aqui ele só existe para o caso extremo
  // (Ctrl+A, arrastar por páginas), e mesmo assim o usuário é avisado.
  if (!txt || txt.length < 2) { _lerFecharPopup(); return }
  if (txt.length > 1200) {
    _lerFecharPopup()
    toast('Trecho grande demais para virar item de estudo — marque no máximo um parágrafo', 'warning')
    return
  }
  let r
  try { r = sel.getRangeAt(0).getBoundingClientRect() } catch (e) { return }
  if (!r || (!r.width && !r.height)) return
  _lerFecharPopup()
  _lerPopAlvo = txt
  _lerPopCtx = _lerFraseEmVolta(sel, txt)

  // O botão diz o que VAI acontecer: palavra/expressão vira item de estudo;
  // trecho longo entra como frase, para a triagem quebrar depois.
  const ehFrase = txt.split(' ').filter(Boolean).length > LER_MAX_ALVO
  // A GLOSA NO TOQUE. No celular não existe hover, e o leitor já tem três
  // gestos (borda vira página, arrasto vira página, toque longo seleciona) —
  // um quarto quebraria o virar-página. Então a espiada não ganha gesto: ela
  // entra no topo do popup que o toque longo JÁ abre. No desktop ela também
  // aparece, e não incomoda: quem chegou aqui soltou o mouse de propósito.
  let glosaHTML = ''
  if (typeof glossBuscar === 'function') {
    const partes = txt.split(/\s+/).filter(Boolean)
    if (partes.length <= 3) {
      const achado = partes.length > 1
        ? (glossBuscar(partes[0], partes[1]) || glossBuscar(txt))
        : glossBuscar(txt)
      // Entra mesmo SEM glosa: "já está no Revisar" evita que ele mande a
      // mesma palavra de novo pelo botão Estudar logo abaixo, e "você marcou
      // como conhecida" explica por que ela não aparece mais para estudar.
      if (achado) {
        glosaHTML = `<div class="gloss-embutido">${glossLinhaHTML(achado, { curto: true })}</div>`
      }
    }
  }

  const pop = document.createElement('div')
  pop.id = 'ler-pop'
  pop.innerHTML = glosaHTML + `
    <div class="ler-pop-linha">
      <b>"${esc(txt.length > 34 ? txt.slice(0, 34) + '…' : txt)}"</b>
      <button data-p="exp">Explicar</button>
      <button data-p="rev" data-tip="${ehFrase
        ? 'Salva a frase no Revisar — a triagem por IA quebra em palavras, phrasals e expressões'
        : 'Cria o item de estudo com a frase do livro como contexto'}">${ehFrase ? 'Salvar frase' : 'Estudar'}</button>
    </div>
    <div class="ler-pop-extras">
      <button data-p="ouv" data-tip="Ouvir em voz alta (voz do navegador, custo zero)">${ic('volume','ic-sm')} Ouvir</button>
      <button data-p="img" data-tip="Ver imagens do que está escrito — para objeto, planta, roupa, arma, bicho: a foto ensina o que a definição não ensina">${ic('image','ic-sm')} Imagens</button>
      <button data-p="wiki" data-tip="Abrir na Wikipédia em outra aba — o caminho para nome próprio, lugar, guerra, marca">${ic('bookOpen','ic-sm')} Wikipédia</button>
      <button data-p="web" data-tip="Pesquisar na web em outra aba">${ic('globe','ic-sm')} Web</button>
    </div>
    <div class="ler-pop-corpo hidden" id="ler-pop-corpo"></div>`
  pop.onmousedown = e => e.preventDefault()
  document.body.appendChild(pop)
  const larg = pop.offsetWidth, alt = pop.offsetHeight
  let x = Math.max(8, Math.min(r.left + r.width / 2 - larg / 2, window.innerWidth - larg - 8))
  let y = r.bottom + 8
  if (y + alt > window.innerHeight - 8) y = Math.max(8, r.top - alt - 8)
  pop.style.left = Math.round(x) + 'px'
  pop.style.top = Math.round(y) + 'px'

  pop.querySelector('[data-p="rev"]').onclick = () => {
    _lerCapturar(_lerPopAlvo, _lerPopCtx)
    _lerFecharPopup(); try { window.getSelection().removeAllRanges() } catch (e) {}
  }
  pop.querySelector('[data-p="ouv"]').onclick = () => lerFalar(_lerPopAlvo)
  pop.querySelector('[data-p="img"]').onclick = () => lerAbrirBusca('img')
  pop.querySelector('[data-p="wiki"]').onclick = () => lerAbrirBusca('wiki')
  pop.querySelector('[data-p="web"]').onclick = () => lerAbrirBusca('web')
  pop.querySelector('[data-p="exp"]').onclick = async () => {
    const corpo = el('ler-pop-corpo')
    const alvo = _lerPopAlvo, ctx = _lerPopCtx
    corpo.classList.remove('hidden')
    corpo.innerHTML = `<div class="ler-pop-txt">${esc(lexaNome())} está lendo o trecho…</div>`

    // A figura vai em PARALELO com a IA e entra assim que chegar: a Wikipédia
    // responde em ~0,6s e a explicação leva alguns segundos — fazer o texto
    // esperar a foto seria trocar o essencial pelo acessório.
    if (typeof wikiIlustracao === 'function') {
      wikiIlustracao(alvo, (_lerLivro && _lerLivro.lang) || 'en').then(info => {
        if (!info || alvo !== _lerPopAlvo) return
        const c = el('ler-pop-corpo')
        if (c && !c.querySelector('.ll-wiki-fig')) c.insertAdjacentHTML('afterbegin', wikiFiguraHTML(info))
      }).catch(() => {})
    }

    try {
      const t = await aiTextSeguro([
        { role: 'system', content: lexaPrompt() },
        { role: 'user', content: `O aluno está lendo "${_lerLivro.title}"${_lerLivro.author ? ', de ' + _lerLivro.author : ''}. A frase é: "${ctx}". Ele selecionou: "${alvo}".\nExplique o que "${alvo}" significa AQUI, nesta passagem.` }
      ], { maxTokens: 600 })
      const txtEl = el('ler-pop-corpo') && el('ler-pop-corpo').querySelector('.ler-pop-txt')
      if (txtEl) txtEl.textContent = t || `${lexaNome()} devolveu uma resposta vazia`
    } catch (e) {
      const txtEl = el('ler-pop-corpo') && el('ler-pop-corpo').querySelector('.ler-pop-txt')
      if (txtEl) txtEl.textContent = 'Não deu: ' + e.message
    }
  }
}

// Wikipédia e web: o que a IA não resolve bem. Nome de lugar, batalha, arma,
// marca ou pessoa real pede FONTE, não paráfrase — e sai de graça, sem token.
// Abre em outra aba: a leitura (e a posição) fica intacta aqui.
function lerAbrirBusca(onde) {
  const termo = String(_lerPopAlvo || '').trim()
  if (!termo) return
  // A busca sai no idioma do LIVRO: quem lê em inglês procura "Minie ball",
  // não "bala Minié" — e o resultado de lá é o que casa com o texto na tela.
  const idioma = (_lerLivro && _lerLivro.lang) || 'en'
  const q = encodeURIComponent(termo)
  let url
  if (onde === 'wiki') {
    url = `https://${idioma}.wikipedia.org/wiki/Special:Search?search=${q}`
  } else if (onde === 'img') {
    // `tbm=isch` abre direto na aba de imagens; `hl` mantém a interface no
    // idioma do livro para não misturar resultado traduzido no meio.
    url = `https://www.google.com/search?tbm=isch&hl=${encodeURIComponent(idioma)}&q=${q}`
  } else {
    url = `https://www.google.com/search?q=${q}`
  }
  window.open(url, '_blank', 'noopener,noreferrer')
  _lerFecharPopup()
}

// Voz do navegador: qualidade menor que a do TTS pago, mas custo ZERO e
// serve para o que importa aqui — ouvir como a frase soa.
function lerFalar(txt) {
  try {
    if (!('speechSynthesis' in window)) { toast('Este navegador não tem voz embutida', 'warning'); return }
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(String(txt).slice(0, 400))
    u.lang = (_lerLivro && _lerLivro.lang === 'en') ? 'en-US' : (_lerLivro?.lang || 'en')
    u.rate = 0.95
    speechSynthesis.speak(u)
  } catch (e) { toast('Não consegui falar: ' + e.message, 'error') }
}

// ================================================================
// PINTURA — marca no texto o que você já está estudando
// ================================================================
function _lerConjuntoEmEstudo() {
  const s = new Set()
  for (const w of words) {
    const k = knownNorm(w.word || '')
    if (k && k.length > 1 && !/\s/.test(k)) s.add(k)
  }
  return s
}

function _lerRepintar() {
  const cont = el('ler-conteudo'); if (!cont) return
  // desfaz a pintura anterior sem reconstruir o capítulo
  cont.querySelectorAll('mark.ler-w').forEach(m => {
    const t = document.createTextNode(m.textContent)
    m.replaceWith(t)
  })
  cont.normalize()
  if (lerCfg().pintar !== 'minhas') return
  const alvo = _lerConjuntoEmEstudo()
  if (!alvo.size) return
  const re = new RegExp('\\b(' + [...alvo].slice(0, 900)
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi')

  const andarilho = document.createTreeWalker(cont, NodeFilter.SHOW_TEXT)
  const nos = []
  let n
  while ((n = andarilho.nextNode())) {
    if (n.nodeValue && n.nodeValue.length > 1 && re.test(n.nodeValue)) nos.push(n)
    re.lastIndex = 0
  }
  for (const no of nos) {
    const frag = document.createDocumentFragment()
    let ultimo = 0
    let m
    re.lastIndex = 0
    while ((m = re.exec(no.nodeValue))) {
      if (m.index > ultimo) frag.appendChild(document.createTextNode(no.nodeValue.slice(ultimo, m.index)))
      const mk = document.createElement('mark')
      mk.className = 'ler-w'
      mk.textContent = m[0]
      frag.appendChild(mk)
      ultimo = m.index + m[0].length
    }
    if (ultimo < no.nodeValue.length) frag.appendChild(document.createTextNode(no.nodeValue.slice(ultimo)))
    no.replaceWith(frag)
  }
}

// ================================================================
// CONVERSA COM A LEXA — dentro do contexto do livro
// ================================================================
// O caso que pediu isto: "no livro Flags on the Bayou eu quero perguntar quem
// são os invasores do Norte e onde acontece a história".
//
// A regra que decide se presta é a de SPOILER. Um companheiro de leitura que
// entrega o final não é companheiro: a Lexa recebe em que ponto você está e
// tem ordem explícita de não passar dali. E recebe também o trecho que está
// na tela, para falar do que você tem diante dos olhos — não de um resumo
// genérico da internet.
const LER_CHAT_MAX = 12          // mensagens guardadas por livro
const LER_CHAT_CORTE = 1400      // teto por mensagem (o doc da nuvem é 1 MB)

function _lerChat() {
  if (!_lerLivro) return []
  if (!Array.isArray(_lerLivro.chat)) _lerLivro.chat = []
  return _lerLivro.chat
}

function _lerSugestoes() {
  return ['Onde e quando se passa a história?', 'Quem é quem até aqui?',
          'Me situa: o que está acontecendo?', 'Que contexto histórico eu preciso saber?']
}

function _lerRenderConversa() {
  const p = el('ler-conversa')
  const msgs = _lerChat()
  const nome = lexaNome()
  p.innerHTML = `
    <div class="ler-conversa">
      <div class="ler-conversa-topo">
        <b>${esc(nome)}</b>
        <span>conhece o livro e sabe onde você parou — não conta o que vem depois</span>
        ${msgs.length ? `<button class="ler-btn ler-conversa-limpar" onclick="lerLimparConversa()">limpar</button>` : ''}
      </div>
      <div class="ler-conversa-msgs" id="ler-conversa-msgs">
        ${msgs.length ? msgs.map(m => `<div class="ler-msg ler-msg-${m.q ? 'eu' : 'lexa'}">${esc(m.q || m.a)}</div>`).join('')
          : `<div class="ler-conversa-vazio">Pergunte o que quiser sobre <b>${esc(_lerLivro.title)}</b>.</div>`}
      </div>
      <div class="ler-conversa-sug">
        ${_lerSugestoes().map(s => `<button class="ler-chip" onclick="lerPerguntar(${escA(JSON.stringify(s))})">${esc(s)}</button>`).join('')}
      </div>
      <div class="ler-conversa-campo">
        <textarea id="ler-conversa-input" rows="1" placeholder="Perguntar sobre o livro…"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();lerPerguntar()}"></textarea>
        <button class="btn btn-primary btn-sm" onclick="lerPerguntar()" aria-label="Perguntar">${ic('send','ic-sm')}</button>
      </div>
    </div>`
  const cx = el('ler-conversa-msgs'); if (cx) cx.scrollTop = cx.scrollHeight
  setTimeout(() => { const i = el('ler-conversa-input'); if (i && window.innerWidth > 768) i.focus() }, 60)
}

function lerLimparConversa() {
  if (!_lerLivro) return
  _lerLivro.chat = []
  saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  _lerRenderConversa()
}

// Recorte do que está na tela: a janela em volta do ponto de leitura. Mandar
// o capítulo inteiro estouraria tokens à toa; mandar nada faria a Lexa falar
// do livro "em geral", que é justamente o que não se quer.
async function _lerTrechoAtual() {
  try {
    const txt = await _lerTextoDoCapitulo(_lerCap)
    if (!txt) return ''
    const frac = Math.max(0, Math.min(1, _lerFracAtual()))
    const meio = Math.floor(txt.length * frac)
    const ini = Math.max(0, meio - 1500)
    return txt.slice(ini, ini + 3000)
  } catch (e) { return '' }
}

async function lerPerguntar(textoFixo) {
  if (!_lerLivro) return
  const campo = el('ler-conversa-input')
  const pergunta = String(textoFixo || (campo && campo.value) || '').trim()
  if (!pergunta) return
  if (campo && !textoFixo) campo.value = ''

  const livro = _lerLivro
  const chat = _lerChat()
  chat.push({ q: pergunta.slice(0, LER_CHAT_CORTE) })
  _lerPintarConversa(true)

  const pct = Math.round((livro.progress || 0) * 100)
  const cap = livro.chapters[_lerCap]?.titulo || ''
  const trecho = await _lerTrechoAtual()

  const sistema = (typeof lexaSistema === 'function')
    ? lexaSistema(`
AGORA: o aluno está LENDO e quer conversar sobre o livro.
- Livro: "${livro.title}"${livro.author ? `, de ${livro.author}` : ''}. Ele está em "${cap}", a ${pct}% do livro.
- REGRA DE OURO, ACIMA DE TUDO: **não estrague a leitura**. NUNCA conte o que acontece depois do ponto em que ele está. Se a resposta honesta exigir isso, diga que aquilo ainda vem pela frente e responda só até onde ele leu.
- Se você não tiver certeza sobre um fato DESTE livro, diga que não tem certeza em vez de inventar. Você pode se apoiar no trecho abaixo, que é o que está na tela dele agora.
- Contexto histórico, geográfico e cultural é bem-vindo: é justamente o que ajuda a entender o que está lendo.
- Responda em português do Brasil, 3 a 6 frases, salvo se ele pedir mais.
${trecho ? `\nTRECHO NA TELA AGORA:\n"""${trecho}"""` : ''}`)
    : 'Você é a Lexa, tutora de inglês. Responda em português do Brasil, curto, sem estragar a leitura contando o que vem depois.'

  // Só as últimas trocas viram histórico: conversa longa em prompt caro não
  // melhora resposta, e o doc da nuvem tem teto.
  const historico = []
  for (const m of chat.slice(-7)) {
    if (m.q) historico.push({ role: 'user', content: m.q })
    else if (m.a) historico.push({ role: 'assistant', content: m.a })
  }

  try {
    const resp = await aiTextSeguro([{ role: 'system', content: sistema }, ...historico], { maxTokens: 700 })
    chat.push({ a: String(resp || '').slice(0, LER_CHAT_CORTE) })
  } catch (e) {
    chat.push({ a: 'Não deu para responder agora: ' + e.message })
  }
  if (chat.length > LER_CHAT_MAX) chat.splice(0, chat.length - LER_CHAT_MAX)
  livro.updatedAt = Date.now()
  saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  _lerPintarConversa(false)
}

function _lerPintarConversa(pensando) {
  const cx = el('ler-conversa-msgs'); if (!cx) return
  const nome = lexaNome()
  cx.innerHTML = _lerChat().map(m => `<div class="ler-msg ler-msg-${m.q ? 'eu' : 'lexa'}">${esc(m.q || m.a)}</div>`).join('') +
    (pensando ? `<div class="ler-msg ler-msg-lexa ler-msg-pensando">${esc(nome)} está pensando…</div>` : '')
  cx.scrollTop = cx.scrollHeight
  if (!pensando) {
    const p = el('ler-conversa')
    if (p && !p.querySelector('.ler-conversa-limpar')) _lerRenderConversa()
  }
}

// ================================================================
// MODO TELA CHEIA
// ================================================================
// Fullscreen de verdade (API do navegador) + uma classe que tira tudo o que
// não é texto. Sair é Esc (o próprio navegador) ou o mesmo botão.
function lerAlternarFull() {
  const alvo = document.querySelector('.ler-leitor')
  if (!alvo) return
  const estaFull = document.fullscreenElement || document.webkitFullscreenElement
  if (estaFull) {
    ;(document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document)
    return
  }
  const pedir = alvo.requestFullscreen || alvo.webkitRequestFullscreen
  if (!pedir) { toast('Este navegador não permite tela cheia aqui', 'warning'); return }
  Promise.resolve(pedir.call(alvo)).catch(e => toast('Não deu para abrir em tela cheia', 'warning'))
}

// A troca de fullscreen muda a altura da tela inteira: é preciso repaginar e
// voltar ao MESMO ponto, senão sair da tela cheia joga o leitor para longe.
function _lerFullMudou() {
  const alvo = document.querySelector('.ler-leitor')
  const full = !!(document.fullscreenElement || document.webkitFullscreenElement)
  document.body.classList.toggle('ler-full', full)
  if (alvo) alvo.classList.toggle('em-full', full)
  const btn = el('ler-btn-full')
  if (btn) {
    btn.innerHTML = ic(full ? 'shrink' : 'expand', 'ic-sm')
    btn.setAttribute('data-tip', full ? 'Sair da tela cheia (Esc)' : 'Modo tela cheia (F) — só o texto')
  }
  if (!_lerLivro) return
  const frac = _lerFracAtual()
  setTimeout(() => {
    _lerMedirPaginas()
    const vp = el('ler-viewport')
    if (vp) _lerMedida = { w: vp.clientWidth, h: vp.clientHeight }
    requestAnimationFrame(() => _lerIrParaFrac(frac))
  }, 120)
}

// ================================================================
// FERRAMENTAS — o que só é possível porque o livro está AQUI DENTRO
// ================================================================
// Palavras vazias do inglês: entram em qualquer texto e não são objeto de
// estudo. Sem esta lista, "the/of/and" ocupariam o topo de toda análise.
const LER_STOP = new Set(`a an the and or but if of to in on at by for with from as is are was were be been being am do does did doing have has had having i you he she it we they me him her us them my your his its our their this that these those there here what which who whom whose when where why how all any both each few more most other some such no nor not only own same so than too very can will just should now would could may might must shall into over under again further then once about above below up down out off between through during before after not s t don ll re ve d m o y ain aren couldn didn doesn hadn hasn haven isn ma mightn mustn needn shan shouldn wasn weren won wouldn`.split(/\s+/))

function _lerTokens(txt) {
  const m = String(txt || '').toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ'’-]{1,}/gi)
  return m ? m.map(t => t.replace(/[’']s$/, '').replace(/^[’'-]+|[’'-]+$/g, '')) : []
}

// Devolve { total, unicas, conhecidas, cobertura, novas:[{w,n}] }
function lerAnalisar(txt) {
  const toks = _lerTokens(txt)
  const freq = new Map()
  let total = 0, conhecidas = 0
  const emEstudo = _lerConjuntoEmEstudo()
  for (const t of toks) {
    if (!t || t.length < 2) continue
    total++
    if (LER_STOP.has(t)) { conhecidas++; continue }
    if (isKnownWord(t)) { conhecidas++; continue }
    if (emEstudo.has(t)) { conhecidas++; continue }
    freq.set(t, (freq.get(t) || 0) + 1)
  }
  const novas = [...freq.entries()].map(([w, n]) => ({ w, n })).sort((a, b) => b.n - a.n || a.w.localeCompare(b.w))
  return { total, unicas: new Set(toks).size, conhecidas, cobertura: total ? conhecidas / total : 0, novas }
}

async function _lerTextoDoCapitulo(i) {
  if (_lerEpub.txtCaps) return epubTextoLimpo(_lerEpub.txtCaps[i]?.html || '')
  const c = _lerLivro.chapters[i]
  if (!c || !c.href) return ''
  const html = await _lerEpub.zip.texto(c.href)
  return html ? epubTextoLimpo(html) : ''
}

let _lerUltimaAnalise = null

async function _lerRenderFerramentas(escopo) {
  const p = el('ler-ferramentas')
  p.innerHTML = `<div class="ler-carregando">medindo o vocabulário…</div>`
  const alvo = escopo || 'capitulo'
  let txt = ''
  if (alvo === 'capitulo') txt = await _lerTextoDoCapitulo(_lerCap)
  else {
    const partes = []
    for (let i = 0; i < _lerLivro.chapters.length; i++) partes.push(await _lerTextoDoCapitulo(i))
    txt = partes.join(' ')
  }
  _lerUltimaAnalise = lerAnalisar(txt)
  _lerDesfazer = []          // triagem nova, pilha de desfazer nova

  p.innerHTML = `
    <div class="ler-fer-abas">
      <button class="ler-btn ler-pill${alvo === 'capitulo' ? ' on' : ''}" onclick="_lerRenderFerramentas('capitulo')">Este capítulo</button>
      <button class="ler-btn ler-pill${alvo === 'livro' ? ' on' : ''}" onclick="_lerRenderFerramentas('livro')">O livro inteiro</button>
    </div>
    <div id="ler-fer-corpo">${_lerFerCorpoHTML()}</div>`
}

// O corpo é redesenhado a cada triagem — por isso vive separado do resto do
// painel (as abas e o cabeçalho não piscam).
function _lerFerCorpoHTML() {
  const a = _lerUltimaAnalise
  if (!a) return ''
  const repetidas = a.novas.filter(x => x.n > 1).length
  const topo = a.novas.slice(0, 40)
  const meta = _lerMetaCobertura(a)
  return `
    <div class="ler-fer-num">
      <div><b>${Math.round(a.cobertura * 100)}%</b><span>você já conhece</span></div>
      <div><b>${a.novas.length.toLocaleString('pt-BR')}</b><span>palavras novas</span></div>
      <div><b>${repetidas}</b><span>voltam mais de uma vez</span></div>
      <div><b>${a.total.toLocaleString('pt-BR')}</b><span>palavras no total</span></div>
    </div>
    <p class="ler-fer-nota">${_lerLeituraDaCobertura(a.cobertura)}</p>
    ${meta.html}
    <div class="ler-fer-acoes">
      <button class="btn btn-primary btn-sm" onclick="lerMandarNovas(10)">${ic('plus','ic-sm')} As 10 mais frequentes para o Revisar</button>
      ${_lerDesfazer.length ? `<button class="btn btn-secondary btn-sm" onclick="lerDesfazerTriagem()">${ic('undo','ic-sm')} Desfazer (${_lerDesfazer.length})</button>` : ''}
    </div>
    ${_lerPreBlocoHTML()}
    <div class="ler-fer-triagem" onclick="_lerCliqueTriagem(event)">
      ${topo.map(x => `
        <span class="ler-tri" data-w="${escA(x.w)}">
          <button class="ler-tri-w" data-a="estudo" data-tip="Não conheço — mandar para o Revisar com a frase do livro">
            ${esc(x.w)}${x.n > 1 ? `<i>${x.n}×</i>` : ''}
          </button>
          <button class="ler-tri-ok" data-a="conheco" data-tip="Já conheço — nunca mais sugerir, e a cobertura sobe">${ic('check','ic-sm')}</button>
          <button class="ler-tri-no" data-a="ignorar" data-tip="Nome próprio ou jargão que não interessa — sai da conta">${ic('x','ic-sm')}</button>
        </span>`).join('') || '<span class="ler-fer-nota">Nenhuma palavra nova por aqui.</span>'}
    </div>
    <p class="ler-fer-nota"><b>Triagem:</b> clique na palavra para estudá-la, no <b>✓</b> se já
      conhece, no <b>×</b> se for nome próprio. O que você marca aqui vale para o app inteiro —
      é o mesmo vocabulário que mede série, podcast e os outros livros.</p>`
}

// Quantas palavras faltam para chegar aos 95% — o patamar em que a leitura
// extensiva deixa de doer. Transforma a lista solta num alvo com fim.
function _lerMetaCobertura(a) {
  const ALVO = 0.95
  if (!a.total || a.cobertura >= ALVO) {
    return { n: 0, html: '' }
  }
  let conhecidas = a.conhecidas, n = 0
  for (const x of a.novas) {
    if (conhecidas / a.total >= ALVO) break
    conhecidas += x.n; n++
  }
  if (!n) return { n: 0, html: '' }
  return {
    n,
    html: `<div class="ler-fer-meta">
      <span>Estudando as <b>${n}</b> mais frequentes daqui, você sai de
        <b>${Math.round(a.cobertura * 100)}%</b> para <b>95%</b> — o patamar em que dá para ler sem travar.</span>
      <button class="btn btn-primary btn-sm" onclick="lerMandarNovas(${n})">${ic('target','ic-sm')} Mandar as ${n}</button>
    </div>`
  }
}

function _lerLeituraDaCobertura(c) {
  const p = Math.round(c * 100)
  if (p >= 98) return 'Leitura fluida: quase tudo aqui já é seu — dá para ler sem parar.'
  if (p >= 95) return 'Zona boa de leitura extensiva: você entende o texto e ainda tira palavras novas.'
  if (p >= 90) return 'Dá para ler com esforço. Estudar as mais frequentes ANTES rende muito.'
  return 'Texto acima do seu nível agora. Vale pré-estudar as mais frequentes ou escolher algo mais leve.'
}

// Delegação em vez de onclick com a palavra embutida: `don't` e `father's`
// quebravam o handler inline — o HTML decodifica `&#39;` ANTES de o JS ler, e
// a string fechava no meio. Com `data-w` o texto nunca passa pelo parser de JS.
function _lerCliqueTriagem(ev) {
  const b = ev.target.closest('button[data-a]')
  if (!b) return
  const palavra = b.closest('.ler-tri')?.dataset.w
  if (!palavra) return
  if (b.dataset.a === 'conheco') lerConheco(palavra)
  else if (b.dataset.a === 'ignorar') lerIgnorar(palavra)
  else lerMandarUma(palavra)
}

function lerMandarUma(palavra) {
  _lerTirarDaLista(palavra, 'estudo')
  return _lerCapturarSemFrase([palavra])
}
function lerMandarNovas(n) {
  if (!_lerUltimaAnalise) return Promise.resolve()
  const lista = _lerUltimaAnalise.novas.slice(0, n).map(x => x.w)
  lista.forEach(w => _lerTirarDaLista(w, 'estudo'))
  return _lerCapturarSemFrase(lista)
}

// ================================================================
// TRIAGEM — "eu já conheço" e "isso é nome próprio"
// ================================================================
// Faltava a outra metade da conta. A cobertura era medida contra o mapa de
// palavras conhecidas, mas não havia como ALIMENTAR esse mapa a partir daqui —
// então o painel mostrava "bright", "cold", "day" como palavras novas e a
// única saída era mandar lixo para o Revisar. Marcar o que você já sabe é o
// que faz o número virar verdade, e vale para o app inteiro: a mesma medida
// serve para série, podcast e para os outros livros da estante.
let _lerDesfazer = []      // últimas marcações, para voltar atrás sem medo

function lerConheco(palavra) {
  if (typeof markKnownWord !== 'function') return
  markKnownWord(palavra, true)
  _lerDesfazer.push({ w: palavra, tipo: 'conheco' })
  _lerTirarDaLista(palavra, 'conheco')
  _lerRepintar()
}

function lerIgnorar(palavra) {
  if (typeof markIgnoredWord !== 'function') return
  markIgnoredWord(palavra, true)
  _lerDesfazer.push({ w: palavra, tipo: 'ignorar' })
  _lerTirarDaLista(palavra, 'ignorar')
}

function lerDesfazerTriagem() {
  const u = _lerDesfazer.pop()
  if (!u) return
  if (u.tipo === 'conheco' && typeof markKnownWord === 'function') markKnownWord(u.w, false)
  if (u.tipo === 'ignorar' && typeof markIgnoredWord === 'function') markIgnoredWord(u.w, false)
  // devolve a palavra à lista com a contagem que ela tinha
  const a = _lerUltimaAnalise
  if (a && u.n) {
    a.novas.push({ w: u.w, n: u.n })
    a.novas.sort((x, y) => y.n - x.n || x.w.localeCompare(y.w))
    // Espelho exato do que _lerTirarDaLista fez: "conheço" mexeu em
    // `conhecidas`, "ignorar" tirou as ocorrências do total. Desfazer que só
    // devolve metade da conta deixaria a cobertura mentindo de novo.
    if (u.tipo === 'ignorar') a.total += u.n
    else a.conhecidas = Math.max(0, a.conhecidas - u.n)
    a.cobertura = a.total ? Math.min(1, a.conhecidas / a.total) : 0
  }
  _lerRepintar()
  _lerPintarFerramentas()
  toast(`"${u.w}" voltou para a lista`, 'info')
}

// Tira a palavra da análise em memória e reescreve os números NA HORA.
// Recontar o capítulo inteiro a cada clique seria lento e desnecessário: já
// sabemos quantas vezes ela aparece.
function _lerTirarDaLista(palavra, tipo) {
  const a = _lerUltimaAnalise
  if (!a) return
  const i = a.novas.findIndex(x => x.w === palavra)
  if (i < 0) return
  const [item] = a.novas.splice(i, 1)
  const ultimo = _lerDesfazer[_lerDesfazer.length - 1]
  if (ultimo && ultimo.w === palavra && !ultimo.n) ultimo.n = item.n
  // "Conheço" entra na cobertura. "Ignorar" (nome próprio) sai da conta dos
  // dois lados: não é vocabulário a aprender nem vocabulário que você sabe.
  if (tipo === 'conheco') a.conhecidas += item.n
  else if (tipo === 'ignorar') a.total = Math.max(1, a.total - item.n)
  a.cobertura = a.total ? Math.min(1, a.conhecidas / a.total) : 0
  _lerPintarFerramentas()
}

function _lerPintarFerramentas() {
  const c = el('ler-fer-corpo')
  if (c) c.innerHTML = _lerFerCorpoHTML()
}

// Palavra vinda da lista de frequência não tem frase — e frase é o que faz o
// card ensinar. Então buscamos a PRIMEIRA ocorrência dela no capítulo atual.
async function _lerCapturarSemFrase(lista) {
  // Congela livro e capítulo AGORA: ler o texto é assíncrono e o leitor pode
  // ter virado a página (ou o capítulo) no meio — sem isto o card sairia
  // carimbado com o capítulo errado.
  const livro = _lerLivro, cap = _lerCap
  if (!livro) return
  const txt = await _lerTextoDoCapitulo(cap)
  let n = 0
  for (const palavra of lista) {
    if (words.some(w => (w.word || '').toLowerCase() === palavra)) continue
    let frase = ''
    const re = new RegExp('[^.!?…]*\\b' + palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b[^.!?…]*[.!?…]?', 'i')
    const m = txt.match(re)
    if (m) frase = m[0].trim().slice(0, 400)
    const w = createWord({
      word: palavra, context: frase,
      source_type: 'kindle', source_title: livro.title,
      source_context: livro.chapters[cap]?.titulo || '',
      lang: livro.lang || 'en'
    })
    ;(livro.notes = livro.notes || []).push({
      id: uid(), cap, word: palavra, text: frase, wordId: w && w.id, created_at: Date.now()
    })
    n++
  }
  if (!n) { toast('Essas já estão na sua fila', 'info'); return 0 }
  saveWords(); saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  if (typeof renderSidebar === 'function') { try { renderSidebar() } catch (e) {} }
  _lerRepintar()
  toast(`${n} palavra${n > 1 ? 's' : ''} ${n > 1 ? 'foram' : 'foi'} para o Revisar`, 'success')
  return n
}

// ================================================================
// PRÉ-ANÁLISE DO CAPÍTULO — a camada 1 do glossário
//
// POR QUE NÃO É UM DICIONÁRIO EMBARCADO. Um extrato inglês→português do
// Wikcionário foi medido (06/08/2026) e caberia com folga: 0,26 MB comprimido,
// 91,5% do texto corrido coberto. Reprovou na QUALIDADE, que é o que importa:
//   barrel → "barril"     (no livro dele é o CANO do fuzil)
//   bore   → "chateação"  (é o passado de bear — "não NUTRI rancor")
//   yank   → "puxão"      (é Billy Yank, o soldado da União)
//   tire, animus → não existem lá
// E o sentido certo não está ausente por acaso: `barrel` tem três acepções no
// verbete e nenhuma é a arma. Seria reintroduzir, de graça, o erro que as
// rodadas 163–167 gastaram para matar.
//
// O QUE FAZEMOS EM VEZ DISSO. Ele não lê "inglês em geral" — lê UM livro, e o
// app tem o livro inteiro. Então as palavras novas do capítulo vão para a IA
// COM A FRASE EM QUE APARECEM, numa chamada só, e o resultado fica guardado.
// A glosa nasce presa ao contexto: é o oposto do verbete cego.
//
// NUNCA automático. Gasta dinheiro, e neste projeto já houve o episódio das
// imagens que rodaram no nível médio sem ninguém escolher — desde então, o que
// custa pede confirmação com o número na frente.
// ================================================================

const LER_PRE_MAX = 120   // teto por capítulo: segura o custo E o tamanho do
                          // prompt, que é onde modelo barato começa a errar
// Versão do formato gravado. SUBIR sempre que a forma de produzir as glosas
// mudar de um jeito que invalide o que já está no aparelho — o cache é local e
// ninguém mais tem como alcançá-lo para corrigir.
//   v1 → v2: casava por índice do modelo; item pulado deslocava tudo.
const LER_PRE_VER = 2
const LER_PRE_LOTE = 40   // itens por chamada. Foi 120 numa tacada só, e o Luna
                          // pulou item no meio — com casamento por índice, isso
                          // deslocou todas as glosas seguintes. Lote curto reduz
                          // o pulo; o casamento por palavra o torna inofensivo.

function _lerChavePre(cap) { return 'pre:' + (_lerLivro ? _lerLivro.id : '?') + ':' + cap }

// Para cada palavra, a frase onde ela aparece — sem isso a IA não teria como
// desambiguar e a camada 1 viraria o dicionário cego que recusamos.
function _lerFrasesPara(txt, palavras) {
  const alvo = new Map(palavras.map(w => [w, null]))
  const frases = String(txt || '').replace(/\s+/g, ' ').split(/(?<=[.!?…])\s+/)
  for (const f of frases) {
    if (f.length < 12 || f.length > 320) continue
    for (const t of _lerTokens(f)) {
      if (alvo.has(t) && !alvo.get(t)) alvo.set(t, f.trim())
    }
  }
  return alvo
}

async function _lerPreDoCache(cap) {
  try {
    const b = await BookDB.get(_lerChavePre(cap))
    if (!b) return null
    const t = typeof b.text === 'function' ? await b.text() : String(b)
    const d = JSON.parse(t)
    if (!d || !Array.isArray(d.itens)) return null
    // O que a v1 gravou está ERRADO e não dá para consertar depois: ela casava
    // resposta com pergunta pelo índice do modelo, então um item pulado
    // deslocava todas as glosas seguintes. Capítulo lido pela v1 é descartado
    // em silêncio — melhor não mostrar nada do que mostrar a glosa da palavra
    // vizinha, que é errado com cara de certo.
    if (Number(d.v || 1) < LER_PRE_VER) return null
    return d
  } catch (e) { return null }
}

// Chamada ao abrir o capítulo: carrega o que já foi lido, se houver.
// Silenciosa de propósito — não gasta nada e não pergunta nada.
async function lerPreAplicar(cap) {
  if (typeof glossPreCarregar !== 'function') return 0
  const d = await _lerPreDoCache(cap)
  // Guarda contra virada rápida de capítulo: entre pedir o cache e recebê-lo o
  // leitor pode já estar em outro capítulo, e aplicar aqui carregaria as
  // glosas do capítulo ERRADO — mesma classe do bug de posição da 79ª rodada.
  if (_lerCap !== cap) return 0
  if (d && d.itens.length) return glossPreCarregar(_lerChavePre(cap), d.itens)
  glossPreLimpar()
  return 0
}

async function lerPreAnalisar(cap, refazer) {
  if (cap === undefined) cap = _lerCap
  if (!_lerLivro) return
  if (!refazer) {
    const n = await lerPreAplicar(cap)
    if (n) { toast(n + ' palavras deste capítulo já estavam lidas', 'info'); return }
  }
  // O preparo TAMBÉM demora (ler o capítulo do EPUB, tokenizar, casar frases)
  // e acontece ANTES de qualquer pergunta de custo — então o progresso começa
  // aqui, e não só quando a IA entra.
  _lerPreProgresso('abrindo o capítulo…', 0, 0, 0)
  const txt = await _lerTextoDoCapitulo(cap)
  if (!txt) { toast('capítulo vazio', 'warning'); return }
  _lerPreProgresso('separando as frases…', 0, 0, 0)

  // As candidatas já vêm filtradas por lerAnalisar (fora: conhecidas, palavras
  // de função e as que já são card). Fica a ordem por frequência NO CAPÍTULO:
  // se o teto cortar, corta o que aparece menos.
  const nov = lerAnalisar(txt).novas.filter(x => x.w.length > 2).slice(0, LER_PRE_MAX)
  if (!nov.length) { toast('nenhuma palavra nova neste capítulo', 'info'); return }

  const frases = _lerFrasesPara(txt, nov.map(x => x.w))
  const itens = nov.map(x => ({ w: x.w, f: frases.get(x.w) || '' })).filter(x => x.f)
  if (!itens.length) { toast('não consegui isolar as frases deste capítulo', 'warning'); return }

  const lang = (_lerLivro.lang || 'en').slice(0, 2)
  const regras = typeof promptRegrasLexicais === 'function' ? promptRegrasLexicais(lang, 'glosa') : ''
  // SEM numeração. A primeira versão numerava os itens e casava a resposta pelo
  // índice que o modelo devolvia — e foi assim que "ordered" recebeu a glosa
  // "para": basta o modelo pular UM item e renumerar (comportamento comum com
  // lista longa em modelo barato) para TODAS as glosas seguintes grudarem na
  // palavra errada, em silêncio. Agora ele repete a PALAVRA, e é ela que casa.
  // Índice é bookkeeping do modelo; palavra é conteúdo. Nunca confiar no
  // bookkeeping dele — mesma lição do lote de imagens que contava falha como
  // sucesso.
  const lista = itens.map(it => it.w + ' :: ' + it.f).join('\n')
  // Lotes menores pela mesma razão: 120 itens de uma vez convidam ao pulo.
  const lotes = []
  for (let i = 0; i < itens.length; i += LER_PRE_LOTE) lotes.push(itens.slice(i, i + LER_PRE_LOTE))
  const sistema = [
    'Você glosa vocabulário para um brasileiro que está lendo um livro em ' + (lang === 'en' ? 'inglês' : lang) + '.',
    'Para CADA item você recebe a palavra e A FRASE DO LIVRO em que ela aparece.',
    'Devolva o significado que a palavra tem NAQUELA FRASE — nunca o primeiro do dicionário.',
    regras,
    'Responda SÓ com JSON: {"itens":[{"w":"a palavra EXATAMENTE como veio","pt":"tradução em forma de citação","g":false}]}',
    '- "w": copie a palavra recebida, letra por letra. É por ela que a resposta é casada com a pergunta.',
    '- "pt": 1 a 4 palavras em português, forma neutra (verbo no INFINITIVO, substantivo no SINGULAR). Sem explicação, sem frase.',
    '- "g": true apenas quando a palavra ali exerce função gramatical (auxiliar, marcador) em vez de sentido lexical.',
    '- Um objeto por palavra recebida. Se não souber alguma, omita-a — nunca invente nem desloque.'
  ].join('\n')

  // A conta sai do prompt REAL, não de uma média: ~4 caracteres por token na
  // entrada e ~14 tokens de saída por item (a glosa é curta de propósito).
  // O sistema REPETE a cada lote — contar uma vez só subestimaria a conta, e
  // aqui subestimar é pior que superestimar.
  const tokensIn = Math.ceil((sistema.length * lotes.length + lista.length) / 4)
  const tokensVis = itens.length * 14
  // O RACIOCÍNIO entra na conta. Ele é cobrado como saída, e ignorá-lo era o
  // que fazia a tela dizer R$ 0,02 numa operação que podia custar R$ 0,07.
  const rac = _lerRacPrevisto(aiModel(), itens.length, tokensVis)
  const tokensOut = tokensVis + rac.tokens
  const p = aiPrecoModelo()
  const usd = (tokensIn * p.in + tokensOut * p.out) / 1e6
  const brl = usd * (await aiUsdBrl())
  const ok = await confirmModal({
    title: 'Ler o capítulo com a IA',
    icon: 'sparkles',
    confirmText: 'Ler — ' + _brl(brl),
    html: '<div class="cost-rows">' +
      '<div class="cost-row"><span>Palavras novas</span><b>' + itens.length +
        (nov.length >= LER_PRE_MAX ? ' (teto do capítulo)' : '') + '</b></div>' +
      '<div class="cost-row"><span>Chamadas</span><b>' + lotes.length +
        (lotes.length > 1 ? ' (lotes de ' + LER_PRE_LOTE + ')' : '') + '</b></div>' +
      '<div class="cost-row"><span>Modelo</span><b>' + esc(aiChatCfg().P.nome + ' · ' + aiModel()) + '</b></div>' +
      '<div class="cost-row"><span>Entrada</span><b>~' + tokensIn + ' tokens (as palavras <b>com as frases</b>)</b></div>' +
      '<div class="cost-row"><span>Saída</span><b>~' + tokensVis + ' tokens de glosa' +
        (rac.raciocina ? ' + ~' + rac.tokens + ' de raciocínio' : '') + '</b></div>' +
      '<div class="cost-row"><span>Preço do modelo</span><b>US$ ' + p.in + ' / ' + p.out + ' por 1M</b></div>' +
      '<div class="cost-row total"><span>Custo estimado</span><b>' + _brl(brl) + '</b></div>' +
      '</div><ul class="cost-bullets">' +
      (rac.raciocina
        ? (rac.medido
            ? '<li>Este modelo <b>raciocina</b>, e a OpenAI cobra o raciocínio como saída. A conta acima usa o quanto ele <b>gastou de verdade</b> nas leituras anteriores.</li>'
            : '<li>Este modelo <b>raciocina</b>, e a OpenAI cobra o raciocínio como saída. Ainda não medi quanto ele pensa, então esta estimativa é <b>alta de propósito</b> — o valor real aparece ao terminar e calibra as próximas.</li>')
        : '') +
      '<li>Cada palavra vai com a FRASE do livro — a glosa é a daquele trecho, não a do dicionário.</li>' +
      '<li>O resultado fica guardado neste aparelho: reabrir o capítulo não cobra de novo.</li>' +
      '<li>Não vira card. É só a espiada do hover; estudar continua sendo escolha sua.</li>' +
      '</ul>'
  })
  if (!ok) return

  try {
    if (typeof aiUsoZerar === 'function') aiUsoZerar()
    const saida = []
    let ignorados = 0
    for (let n = 0; n < lotes.length; n++) {
      const lote = lotes[n]
      // ANTES da chamada também: a primeira é a mais longa, e deixar a barra
      // em zero durante ela é exatamente o silêncio que se está corrigindo.
      _lerPreProgresso('lendo com a IA…', n, lotes.length, saida.length)
      const j = await aiJSON([
        { role: 'system', content: sistema },
        { role: 'user', content: lote.map(it => it.w + ' :: ' + it.f).join('\n') }
      ], { maxTokens: Math.min(4000, lote.length * 26 + 400) })

      // O CASAMENTO É PELA PALAVRA, e só entre as palavras DESTE lote. Resposta
      // com palavra que não foi perguntada é descartada — sem isso, um modelo
      // que inventa item contamina o capítulo inteiro.
      const pedidas = new Map()
      for (const it of lote) pedidas.set(knownNorm(it.w), it)
      // Segunda porta, tolerante: o modelo às vezes devolve o LEMA em vez da
      // forma perguntada ("order" no lugar de "ordered"). Vale, desde que só
      // uma palavra do lote leve àquele lema — se duas levarem, é ambíguo e
      // adivinhar seria repetir o erro que estamos consertando.
      const porLema = new Map()
      if (typeof glossLemas === 'function') {
        for (const it of lote) {
          for (const l of glossLemas(it.w)) {
            const k = knownNorm(l)
            if (pedidas.has(k)) continue
            porLema.set(k, porLema.has(k) ? null : it)   // null = ambíguo
          }
        }
      }
      const brutos = Array.isArray(j) ? j : (j.itens || j.items || [])
      for (const r of brutos) {
        if (!r || !r.pt) continue
        const k = knownNorm(r.w || r.word || r.palavra || '')
        const orig = pedidas.get(k) || porLema.get(k)
        if (!orig) { ignorados++; continue }
        saida.push({ w: orig.w, pt: String(r.pt).trim().slice(0, 60), g: r.g === true || r.g === 'true' })
      }
      _lerPreProgresso('lendo com a IA…', n + 1, lotes.length, saida.length)
    }
    if (!saida.length) throw new Error('a IA não devolveu nenhuma glosa reconhecível')
    if (ignorados) console.warn('[pre] ' + ignorados + ' resposta(s) descartadas: palavra não estava no lote')

    // Grava SEMPRE (o trabalho foi pago, guardar é o mínimo), mas só carrega no
    // glossário se ele ainda estiver NESTE capítulo — a chamada leva segundos e
    // nesse tempo ele pode ter virado a página para outro.
    await BookDB.set(_lerChavePre(cap), new Blob([JSON.stringify({ v: LER_PRE_VER, itens: saida, at: Date.now() })]))
    if (_lerCap === cap) glossPreCarregar(_lerChavePre(cap), saida)
    const perdidos = itens.length - saida.length

    // O QUE CUSTOU DE VERDADE. `usage` é fato; tudo acima era estimativa. E é
    // esta medição que calibra a próxima — a primeira leitura de cada modelo
    // paga o preço de eu não saber quanto ele pensa, mas só a primeira.
    let extra = ''
    if (typeof aiUsoAcumulado === 'function') {
      const uso = aiUsoAcumulado()
      if (uso.chamadas) {
        const usdReal = aiCustoDeUso(uso, aiModel())
        const brlReal = usdReal * (await aiUsdBrl())
        extra = ' · custou ' + _brl(brlReal)
        if (uso.raciocinio > 0) _lerRacGuardar(aiModel(), uso.raciocinio / itens.length)
        console.info('[pre] medido:', uso.in + ' entrada · ' + uso.out + ' saída (dos quais ' +
          uso.raciocinio + ' de raciocínio) em ' + uso.chamadas + ' chamada(s) — ' + _brl(brlReal) +
          ' · estimado era ' + _brl(brl))
      }
    }
    toast(saida.length + ' palavras lidas' + (perdidos > 0 ? ' · ' + perdidos + ' a IA não devolveu' : '') + extra, 'success')
  } catch (e) {
    toast('não deu para ler o capítulo: ' + e.message, 'error')
  }
}

// Apaga a leitura deste capítulo (para refazer com outro modelo, por exemplo)
async function lerPreApagar(cap) {
  if (cap === undefined) cap = _lerCap
  await BookDB.del(_lerChavePre(cap))
  glossPreLimpar()
  toast('leitura deste capítulo apagada', 'info')
}

// O bloco da pré-análise dentro do painel de ferramentas. Fica DEPOIS da
// triagem de propósito: primeiro ele decide o que vai estudar, e só então
// oferece a leitura do resto — que é apoio para a passagem, não material de
// estudo. O texto do botão diz o que acontece e que custa.
function _lerPreBlocoHTML() {
  const carregado = typeof glossPreChave === 'function' &&
                    glossPreChave() === _lerChavePre(_lerCap)
  if (carregado) {
    return '<div class="ler-pre">' +
      '<div class="ler-pre-ok">' + ic('check', 'ic-sm') +
      ' Este capítulo já foi lido: passe o mouse em qualquer palavra nova.</div>' +
      '<button class="btn btn-ghost btn-sm" onclick="lerPreApagar().then(()=>_lerRenderFerramentas())">' +
      ic('refresh', 'ic-sm') + ' Ler de novo</button></div>'
  }
  return '<div class="ler-pre" id="ler-pre-area">' +
    '<button class="btn btn-secondary btn-sm" id="ler-pre-btn" ' +
    'onclick="lerPreAnalisar().then(()=>_lerRenderFerramentas())">' +
    ic('sparkles', 'ic-sm') + ' Ler este capítulo com a IA</button>' +
    '<p class="ler-fer-nota">Manda as palavras novas <b>com a frase em que aparecem</b> ' +
    'numa chamada só, e guarda. Depois, passar o mouse em qualquer uma delas mostra o ' +
    'sentido <b>daquela passagem</b> — não o do dicionário. Mostro o custo antes.</p></div>'
}

// PROGRESSO DA LEITURA. Sem isto o botão sumia e não acontecia nada visível
// por dezenas de segundos — e o usuário não tem como saber se está rodando,
// se travou ou se já acabou. Toast não serve aqui: ele some sozinho e some
// justamente enquanto ainda está trabalhando.
// Mostra a etapa, quantos lotes já voltaram e quantas glosas já entraram.
function _lerPreProgresso(texto, feito, total, glosas) {
  const a = el('ler-pre-area')
  if (!a) return
  const pct = total ? Math.round((feito / total) * 100) : 0
  a.innerHTML =
    '<div class="ler-pre-prog">' +
      '<div class="ler-pre-prog-topo">' +
        '<span class="gen-spinner"></span>' +
        '<b>' + esc(texto) + '</b>' +
        (total > 1 ? '<span class="ler-pre-prog-n">' + feito + '/' + total + '</span>' : '') +
      '</div>' +
      (total ? '<div class="ler-pre-barra"><i style="width:' + pct + '%"></i></div>' : '') +
      (glosas ? '<div class="ler-pre-prog-sub">' + glosas + ' palavras lidas até agora</div>' : '') +
    '</div>'
}

// ---- CALIBRAÇÃO DO RACIOCÍNIO -----------------------------------
// A estimativa de custo enxergava só as glosas visíveis (14 tokens por item) e
// ignorava os tokens de RACIOCÍNIO — que o Luna cobra como saída, no preço
// caro. Dependendo de quanto ele pensasse, o número na tela ficava entre 1,8×
// e 6,7× abaixo do real.
//
// Chutar um multiplicador seria trocar um número errado por outro. Então a
// primeira leitura de cada modelo roda com uma estimativa ALTA de propósito
// (errar para cima é o lado seguro), MEDE o consumo real e guarda quantos
// tokens de raciocínio aquele modelo gasta por item. Da segunda vez em diante
// a conta é feita com o número dele, não com palpite meu.
const SK_LER_RAC = 'el-rac-por-item'

function _lerRacMedido(model) {
  try {
    const d = JSON.parse(localStorage.getItem(SK_LER_RAC) || '{}')
    const v = Number(d[model])
    return isFinite(v) && v >= 0 ? v : null
  } catch (e) { return null }
}

function _lerRacGuardar(model, porItem) {
  if (!model || !isFinite(porItem) || porItem < 0) return
  try {
    const d = JSON.parse(localStorage.getItem(SK_LER_RAC) || '{}')
    // Média corrida com o que já havia: um capítulo atípico não deve virar a
    // régua sozinho, mas a medição nova também não pode ser ignorada.
    d[model] = d[model] != null ? Math.round((Number(d[model]) + porItem) / 2) : Math.round(porItem)
    localStorage.setItem(SK_LER_RAC, JSON.stringify(d))
  } catch (e) {}
}

// Quantos tokens de raciocínio esperar deste lote, e se isso é medida ou chute.
function _lerRacPrevisto(model, nItens, tokensVisiveis) {
  if (typeof _aiRaciocina !== 'function' || !_aiRaciocina(model)) {
    return { tokens: 0, medido: true, raciocina: false }
  }
  const m = _lerRacMedido(model)
  if (m != null) return { tokens: Math.round(m * nItens), medido: true, raciocina: true }
  // Sem medição ainda: 4× o texto visível. É deliberadamente generoso — se o
  // valor real vier menor, a surpresa é boa.
  return { tokens: tokensVisiveis * 4, medido: false, raciocina: true }
}
