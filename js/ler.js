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
  if (_lerLivro) { renderLeitor(); return }
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
  _lerBlobs.forEach(u => { try { URL.revokeObjectURL(u) } catch (e) {} })
  _lerBlobs = []
  _lerLivro = null; _lerEpub = null
  _lerT = null
  document.body.classList.remove('lendo')
  document.removeEventListener('keydown', _lerTeclas)
  document.removeEventListener('selectionchange', _lerSelecaoMudou)
  document.removeEventListener('visibilitychange', _lerAoEsconder)
  window.removeEventListener('resize', _lerAoRedimensionar)
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
          <button class="ler-btn" onclick="lerToggle('ferramentas')" data-tip="Palavras deste capítulo, cobertura e pré-estudo">${ic('sparkles','ic-sm')}</button>
          <button class="ler-btn" onclick="lerToggle('tipografia')" data-tip="Tamanho, fonte, tema e largura da coluna"><b style="font-size:15px">Aa</b></button>
        </div>
      </div>

      <div class="ler-painel hidden" id="ler-sumario"></div>
      <div class="ler-painel hidden" id="ler-tipografia"></div>
      <div class="ler-painel hidden" id="ler-ferramentas"></div>

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
  document.addEventListener('selectionchange', _lerSelecaoMudou)
  document.addEventListener('keydown', _lerTeclas)
  document.addEventListener('visibilitychange', _lerAoEsconder)
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
  const alvos = { sumario: _lerRenderSumario, tipografia: _lerRenderTipografia, ferramentas: _lerRenderFerramentas }
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

async function lerIrParaCapitulo(i, frac = 0) {
  if (!_lerLivro) return
  i = Math.max(0, Math.min(i, _lerLivro.chapters.length - 1))
  _lerCap = i
  const cont = el('ler-conteudo'); if (!cont) return
  _lerRestaurando = true
  _lerFracAlvo = frac
  cont.innerHTML = '<p class="ler-carregando">carregando…</p>'
  const html = await _lerHtmlDoCapitulo(i)
  if (!_lerLivro || _lerCap !== i) { _lerRestaurando = false; return }   // trocou de capítulo no meio
  cont.innerHTML = html || '<p class="ler-carregando">(capítulo vazio)</p>'
  cont.querySelectorAll('.ler-link-int').forEach(a => {
    a.onclick = () => lerIrParaCapitulo(+a.dataset.cap, 0)
  })
  const nome = el('ler-cap-nome')
  if (nome) nome.textContent = _lerLivro.chapters[i].titulo || `Parte ${i + 1}`
  _lerRepintar()
  _lerMedirPaginas()

  await _lerEsperarLayout(cont)
  if (!_lerLivro || _lerCap !== i) { _lerRestaurando = false; return }
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
  if (_lerPaginado()) {
    const max = vp.scrollWidth - vp.clientWidth
    const pag = _lerPasso()
    // Cai sempre no COMEÇO de uma página: meia página cortada é o que mais
    // incomoda quem retoma a leitura.
    vp.scrollLeft = Math.min(max, Math.round((max * frac) / pag) * pag)
  } else {
    vp.scrollTop = (vp.scrollHeight - vp.clientHeight) * frac
  }
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
  clearTimeout(_lerSalvarTimer)
  const gravar = () => {
    if (!_lerLivro) return
    _lerLivro.pos = { cap: _lerCap, frac: _lerFracAtual() }
    _lerLivro.updatedAt = Date.now()
    saveLivros()
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  }
  if (agora) gravar(); else _lerSalvarTimer = setTimeout(gravar, 1500)
}

// No celular, esconder a barra de endereço dispara `resize` a cada rolagem.
// Re-paginar nessas horas fazia o texto pular na mão do leitor. Só remedimos
// quando a LARGURA muda (girar a tela, redimensionar a janela) ou quando a
// altura muda muito — nunca pelos ~60px da barra do navegador.
let _lerMedida = { w: 0, h: 0 }
let _lerResizeTimer = null
function _lerAoRedimensionar() {
  if (!_lerLivro) return
  const vp = el('ler-viewport'); if (!vp) return
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
  const pop = document.createElement('div')
  pop.id = 'ler-pop'
  pop.innerHTML = `
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
  const a = lerAnalisar(txt)
  _lerUltimaAnalise = a
  const topo = a.novas.slice(0, 40)
  const repetidas = a.novas.filter(x => x.n > 1).length

  p.innerHTML = `
    <div class="ler-fer-abas">
      <button class="ler-btn ler-pill${alvo === 'capitulo' ? ' on' : ''}" onclick="_lerRenderFerramentas('capitulo')">Este capítulo</button>
      <button class="ler-btn ler-pill${alvo === 'livro' ? ' on' : ''}" onclick="_lerRenderFerramentas('livro')">O livro inteiro</button>
    </div>
    <div class="ler-fer-num">
      <div><b>${Math.round(a.cobertura * 100)}%</b><span>você já conhece</span></div>
      <div><b>${a.novas.length.toLocaleString('pt-BR')}</b><span>palavras novas</span></div>
      <div><b>${repetidas}</b><span>voltam mais de uma vez</span></div>
      <div><b>${a.total.toLocaleString('pt-BR')}</b><span>palavras no total</span></div>
    </div>
    <p class="ler-fer-nota">${_lerLeituraDaCobertura(a.cobertura)}</p>
    <div class="ler-fer-acoes">
      <button class="btn btn-primary btn-sm" onclick="lerMandarNovas(10)">${ic('plus','ic-sm')} As 10 mais frequentes para o Revisar</button>
      <button class="btn btn-secondary btn-sm" onclick="lerMandarNovas(25)">As 25 mais</button>
    </div>
    <div class="ler-fer-chips">
      ${topo.map(x => `<button class="ler-chip" onclick="lerMandarUma('${escA(x.w)}')" data-tip="Mandar para o Revisar">
        ${esc(x.w)}${x.n > 1 ? `<i>${x.n}×</i>` : ''}</button>`).join('') || '<span class="ler-fer-nota">Nenhuma palavra nova por aqui.</span>'}
    </div>
    <p class="ler-fer-nota">Clique numa palavra para mandá-la sozinha. O que já está no seu
      vocabulário conhecido e as palavras gramaticais (the, of, and…) ficam de fora da conta.</p>`
}

function _lerLeituraDaCobertura(c) {
  const p = Math.round(c * 100)
  if (p >= 98) return 'Leitura fluida: quase tudo aqui já é seu — dá para ler sem parar.'
  if (p >= 95) return 'Zona boa de leitura extensiva: você entende o texto e ainda tira palavras novas.'
  if (p >= 90) return 'Dá para ler com esforço. Estudar as mais frequentes ANTES rende muito.'
  return 'Texto acima do seu nível agora. Vale pré-estudar as mais frequentes ou escolher algo mais leve.'
}

function lerMandarUma(palavra) { return _lerCapturarSemFrase([palavra]) }
function lerMandarNovas(n) {
  if (!_lerUltimaAnalise) return Promise.resolve()
  return _lerCapturarSemFrase(_lerUltimaAnalise.novas.slice(0, n).map(x => x.w))
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
