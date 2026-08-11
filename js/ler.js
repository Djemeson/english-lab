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

// `lexaNome()` MUDOU DE CASA: vive em `core.js`, o primeiro arquivo a carregar,
// porque telas do shell (o painel da Lexa, o menu de seleção, o Preparar)
// passaram a chamá-la e daqui elas não a alcançavam. Redeclarar aqui seria
// pior que inútil: um `const` sobre a função global do core estoura com
// "already been declared" e derruba o leitor inteiro.
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
        : `<div class="ler-capa-fake"><span>${esc((obraNome(l.title) || '?').slice(0, 28))}</span></div>`
      return `
      <div class="ler-card" onclick="lerAbrir('${l.id}')" data-tip="${escA(l.author || '')}">
        <div class="ler-capa">${capa}
          ${pct > 0 ? `<span class="ler-capa-pct">${pct}%</span>` : ''}
        </div>
        <div class="ler-card-nome">${esc(obraNome(l.title) || 'Sem título')}</div>
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
  // Sobe em segundo plano: importar um livro não pode ficar esperando rede, e
  // se falhar ele continua com o arquivo aqui — a próxima abertura tenta de novo.
  if (typeof livroGarantirNaNuvem === 'function') livroGarantirNaNuvem(id)
  livros.push({
    id, ...meta,
    totalWords: meta.chapters.reduce((s, c) => s + (c.words || 0), 0),
    totalChars: meta.chapters.reduce((s, c) => s + (c.chars || 0), 0),
    pos: { cap: 0, frac: 0 }, progress: 0, notes: [],
    minutos: 0, addedAt: Date.now(), updatedAt: Date.now(), lastOpen: 0
  })
  toast(`"${meta.title}" entrou na estante`, 'success')
  // O NOME LIMPO SE RESOLVE NA ENTRADA, não num botão lá adiante.
  // O metadado do EPUB traz "(US Edition)", "Unabridged", o nome do arquivo —
  // e a captura carimba esse título em CADA item. Resolvendo aqui, tudo que
  // sair deste livro já nasce com o nome certo na tela, e a estante também.
  // Uma chamada por LIVRO, não por item, e em segundo plano: a estante já
  // apareceu, e nada na tela espera por isto.
  if (typeof resolverNomesDeObra === 'function' && aiChatCfg().key) {
    resolverNomesDeObra([meta.title])
      .then(n => { if (n) renderLerSection() })
      .catch(e => console.warn('[obra] não resolvi o título:', e && e.message))
  }
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
           Os <b>cards que você já criou continuam</b> — eles vivem em Estudar/Revisar, não aqui.</p>`
  }))) return
  await BookDB.del(id)
  // A cópia da nuvem vai junto. Apagar só a daqui deixaria o livro voltando
  // sozinho na próxima abertura — ele mandou tirar da estante, não esconder.
  if (typeof livroApagarDaNuvem === 'function') await livroApagarDaNuvem(id)
  // Tudo que é derivado do livro morre com ele: as leituras de capítulo
  // (`pre:`), a classificação por nível (`niv:`) e as marcas da triagem
  // (`nivmarca:`). Sem isto ficariam órfãs no IndexedDB para sempre — ninguém
  // mais teria como alcançá-las, porque a chave depende de um livro que já não
  // existe.
  try {
    const chaves = await BookDB.keys()
    const meus = ['pre:', 'niv:', 'nivmarca:'].map(p => p + id + ':')
    for (const k of chaves) {
      if (typeof k === 'string' && meus.some(p => k.startsWith(p))) await BookDB.del(k)
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
  // ⚠️ ANTES DE DESISTIR, PROCURA NA NUVEM. Este era o buraco que fazia o livro
  // não acompanhar o usuário: em aparelho novo o arquivo não existe, e o app
  // mandava "importe o .epub de novo" mesmo tendo uma cópia guardada.
  let blob = await BookDB.get(id)
  if (!blob && typeof livroGarantirLocal === 'function') {
    toast('Buscando o arquivo na sua nuvem…', 'info')
    blob = await livroGarantirLocal(id)
    if (blob) toast(`"${l.title}" baixado para este aparelho`, 'success')
  }
  if (!blob) {
    toast('O arquivo deste livro não está neste aparelho nem na sua nuvem. Importe o .epub de novo.', 'warning')
    return
  }
  // Guarda a subida para o caso do livro ter entrado antes de existir nuvem.
  if (typeof livroGarantirNaNuvem === 'function') livroGarantirNaNuvem(id)
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
  // apareceriam sobre o texto do Preparar e do Assistente, que usam o mesmo
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
      },
      // "Estudar" no balão: a glosa da pré-análise é APOIO DE LEITURA e vive só
      // neste aparelho. Card é o que persiste, entra no SRS e sincroniza — é
      // esta a resposta para "tem como salvar essas palavras". Vai com a frase
      // do livro, então a análise nasce com o contexto certo.
      // O TERCEIRO ARGUMENTO era descartado, e nele vinha a glosa que a
      // pré-análise já pagou para descobrir: sem ela, o Preparar redescobria o
      // sentido vendo só uma frase, quando aqui ele foi decidido vendo o
      // capítulo. Agora ela viaja junto, como semente.
      aoEstudar: (alvo, ctx, achado) => { _lerCapturar(alvo, ctx || '', null, achado) },
      // "Não lembro" numa palavra que ele já marcara como conhecida. O leitor
      // só descreve DE ONDE se veio e COMO se volta; desmarcar, criar o card e
      // navegar é do mecanismo compartilhado, que serve a vídeo, podcast e
      // qualquer tela futura. A posição não precisa de `restaurar` próprio:
      // `renderLerSection()` já reabre o livro no capítulo e no ponto salvos.
      aoNaoLembro: (alvo, ctx) => {
        if (typeof _lerSalvarPos === 'function') _lerSalvarPos(true)
        estudoNaoLembro(alvo, ctx, {
          secao: 'ler',
          rotulo: _lerLivro ? _lerLivro.title : 'a leitura',
          source_type: 'kindle',
          source_title: _lerLivro ? _lerLivro.title : '',
          lang: (_lerLivro && _lerLivro.lang) || 'en'
        })
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
    <div class="ler-tip-nota">Dica: <b>duplo-clique</b> numa palavra manda ela para o Preparar com a frase.
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
// precisamos ler a seleção, achar a frase em volta e mandar para o Preparar.
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

// O PARÁGRAFO em volta da seleção. A frase sozinha não basta para a IA:
// pronome responde ao que veio ANTES dele, e cortar na fronteira da frase joga
// fora justamente o antecedente. Caso real: "Macintosh holds out his hand.
// Billy rises and shakes it." — mandando só a segunda frase, o "it" fica sem
// referente e a explicação virou "começa a dançar".
// A FRASE continua sendo o que vai para o card (contexto enxuto, do tamanho
// certo para virar exemplo); o parágrafo é só para a IA entender.
// ⚠️ ELE SOBE ATRÁS DO PARÁGRAFO, NÃO DO MAIOR TEXTO.
// A primeira versão subia seis níveis e ficava com o texto MAIS LONGO que
// achasse — e num EPUB o pai do parágrafo costuma ser o `<div>` do capítulo
// inteiro. Resultado: qualquer palavra do meio do capítulo vinha com "CHAPTER
// 11 Billy Summers sits in the hotel lobby…" por contexto. Aí o `indexOf` da
// palavra falhava dentro desses 700 caracteres, e a frase virava a ABERTURA DO
// CAPÍTULO — sempre a mesma, para toda palavra. Foi o que ele viu: selecionou
// "fancy" e a Lexa respondeu *"fancy não aparece no trecho enviado"*;
// selecionou "drive" e ela negou que fosse "dirigir".
// ⚠️ O estrago não era só da explicação: `_lerDuploClique` usa a MESMA peça, e
// então TODA palavra capturada no leitor guardava a abertura do capítulo como
// contexto — e ia assim para o card, para os exemplos e para a análise.
const LER_BLOCOS = 'p, li, blockquote, h1, h2, h3, h4, h5, h6, td, dd, figcaption, pre'

function _lerBlocoEmVolta(sel) {
  let no = sel && sel.anchorNode
  if (no && no.nodeType === 3) no = no.parentElement
  if (!no) return ''
  const limpo = e => ((e && e.textContent) || '').replace(/\s+/g, ' ').trim()
  // O parágrafo de verdade, quando o EPUB o marca — que é o caso normal.
  const p = no.closest ? no.closest(LER_BLOCOS) : null
  if (p) return limpo(p).slice(0, 700)
  // Sem marcação de parágrafo (EPUB que quebra tudo em `<div>`): sobe UM DE
  // CADA VEZ e para no PRIMEIRO que já tem texto de parágrafo. Nunca aceita um
  // ancestral gigante: isso é capítulo, não contexto.
  let melhor = ''
  for (let i = 0; i < 6 && no && no.id !== 'ler-conteudo'; i++) {
    const t = limpo(no)
    if (t.length > 1200) break
    if (t.length >= 40) return t.slice(0, 700)
    if (t.length > melhor.length) melhor = t
    no = no.parentElement
  }
  return melhor.slice(0, 700)
}

function _lerFraseEmVolta(sel, alvo) {
  const bloco = _lerBlocoEmVolta(sel)
  if (!bloco) return ''
  // O alvo é normalizado como o bloco: uma seleção que atravessa quebra de
  // linha traz "\n" no meio e o `indexOf` falhava por causa disso — o mesmo
  // desfecho do bug do capítulo, só que sem parecer bug.
  alvo = String(alvo || '').replace(/\s+/g, ' ').trim()
  const i = bloco.toLowerCase().indexOf(alvo.toLowerCase())
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
// de card, e quem quebra em itens é o Raio-X da triagem, no Preparar.
const LER_MAX_ALVO = 4

// `async` por causa do aviso da unidade, que pergunta antes de criar. Quem
// chama nao usa o retorno, entao virar Promise nao muda nada la fora.
async function _lerCapturar(selecao, frase, alvoDOM, achado) {
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
    toast('Trecho salvo no Preparar — a triagem quebra em itens lá', 'success')
    return
  }

  const limpa = bruto.replace(/^[^A-Za-zÀ-ÿ']+|[^A-Za-zÀ-ÿ']+$/g, '')
  if (!limpa) return

  // A leitura DESTA passagem, paga pela pré-análise do capítulo. Vai como
  // semente do sentido — tanto para item novo quanto para reencontro.
  const glosa = achado ? (achado.aqui ? achado.aqui.pt : (achado.fonte === 'pre' ? achado.pt : '')) : ''
  const lang = _lerLivro.lang || 'en'
  const fonte = {
    source_type: 'kindle',
    source_title: _lerLivro.title,
    source_context: _lerLivro.chapters[_lerCap]?.titulo || ''
  }

  // ⚠️ A EXPRESSÃO INTEIRA TEM PREFERÊNCIA, e a pergunta é AQUI — com a frase
  // ainda na tela. Capturando "fall" de uma frase que traz "fall in love", que
  // ele já estuda, nasceria um item competindo com a expressão no verbete.
  // Antes o app percebia isso, mas só avisava quando ele abrisse o item no
  // Preparar: tarde demais para lembrar por que capturou.
  if (typeof unidadeNaCaptura === 'function') {
    const expr = await unidadeNaCaptura(limpa, frase)
    if (expr && typeof prepararNovoSentido === 'function') {
      prepararNovoSentido(expr.id, { contexto: frase, glosa, ...fonte })
      ;(_lerLivro.notes = _lerLivro.notes || []).push({
        id: uid(), cap: _lerCap, word: expr.word, text: frase, wordId: expr.id, created_at: Date.now()
      })
      _lerPersistirCaptura()
      toast(`Esta cena entrou em "${expr.word}"`, 'success')
      return
    }
  }

  // REENCONTRO: a palavra já existe (inclusive flexionada — "fell" acha
  // "fall"). Antes isto era recusado com "já está na sua fila", e era aí que o
  // segundo sentido morria. Agora ele entra NO MESMO item.
  const ja = typeof prepAcharItem === 'function' ? prepAcharItem(limpa, lang) : null
  if (ja) {
    if (typeof prepararNovoSentido !== 'function') { toast(`"${limpa}" já está na sua fila`, 'info'); return }
    prepararNovoSentido(ja.id, { contexto: frase, glosa, ...fonte })
    ;(_lerLivro.notes = _lerLivro.notes || []).push({
      id: uid(), cap: _lerCap, word: limpa, text: frase, wordId: ja.id, created_at: Date.now()
    })
    _lerPersistirCaptura()
    return
  }

  const w = createWord({ word: limpa, context: frase, lang, ...fonte })
  if (glosa) w._seedMeaning = glosa
  // O tipo vem junto quando a checagem "o que é aqui?" descobriu que a unidade
  // é uma expressão. Sem ele, `cover for` nasceria classificado como palavra e
  // o lema/verbete o poriam no lugar errado até a análise corrigir.
  if (achado && achado.tipo && achado.tipo !== 'word') w.type = achado.tipo
  ;(_lerLivro.notes = _lerLivro.notes || []).push({
    id: uid(), cap: _lerCap, word: limpa, text: frase, wordId: w && w.id, created_at: Date.now()
  })
  _lerPersistirCaptura()
  toast(`"${limpa}" foi para o Preparar`, 'success')
}

function _lerPersistirCaptura() {
  saveWords(); saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  if (typeof renderSidebar === 'function') { try { renderSidebar() } catch (e) {} }
  _lerRepintar()
}

// ---- popup de seleção: Explicar / Estudar / Ouvir ----
let _lerPopAlvo = '', _lerPopCtx = '', _lerPopTrecho = ''
// A EXPLICACAO DO LEITOR, agora com nome proprio.
// Era um `onclick` anonimo, e por isso o botao "procurar na internet" nao
// tinha como refazer a MESMA explicacao: nao havia o que chamar de novo.
// Com nome, o refazer e uma chamada com `forcarWeb`.
// ⚠️ `de` carrega o que REFAZER precisa. Os `_lerPop*` são zerados por
// `_lerFecharPopup()` logo abaixo — refazer lendo deles pediria explicação de
// uma seleção que já não existe, e a Lexa responderia sobre o vazio.
async function lerExplicarSelecao(pop, de) {
  const alvo = (de && de.alvo) || _lerPopAlvo
  const ctx  = (de && de.ctx)  || _lerPopCtx
  const emVolta = (de && de.trecho !== undefined) ? de.trecho : _lerPopTrecho
  // A EXPLICAÇÃO SAI DO BALÃOZINHO DE SELEÇÃO e vai para o BALÃO SUSPENSO da
  // Lexa (`lexaBalaoAbrir`), que é o mesmo em todo o projeto. Ele cabe o que
  // o popup não cabia — explicação + chips de todas as unidades + a conversa
  // — sem cobrir a página, que é o ponto: a frase que gerou a dúvida continua
  // ali atrás. O popup de seleção fecha, e com ele some toda a briga do vigia
  // de seleção com o campo de texto da conversa.
  // O balão nasce ANCORADO no popup: aparece onde a mão dele já estava.
  // Refazendo não há popup: o balão fica onde já estava, para o texto não
  // saltar de lugar embaixo dos olhos dele.
  const antigo = document.getElementById('sel-menu')
  const onde = pop ? pop.getBoundingClientRect() : (antigo ? antigo.getBoundingClientRect() : null)
  _lerFecharPopup()
  const corpo = lexaBalaoAbrir({
    titulo: alvo,
    frase: ctx,
    fonte: [_lerLivro.title, (_lerLivro.chapters[_lerCap] || {}).titulo].filter(Boolean).join(' · '),
    alvo: onde,
    // Refazendo pela web: o MESMO balão, só com texto novo.
    reusar: !!(de && de.web)
  })
  corpo.innerHTML = `<div class="ler-pop-txt">${esc(lexaNome())} está lendo o trecho…</div>`
  const vivo = () => lexaBalaoVivo(corpo)

  // A figura vai em PARALELO com a IA e entra assim que chegar: a Wikipédia
  // responde em ~0,6s e a explicação leva alguns segundos — fazer o texto
  // esperar a foto seria trocar o essencial pelo acessório.
  if (typeof wikiIlustracao === 'function') {
    wikiIlustracao(alvo, (_lerLivro && _lerLivro.lang) || 'en').then(info => {
    if (!info || !vivo()) return
    if (!corpo.querySelector('.ll-wiki-fig')) corpo.insertAdjacentHTML('afterbegin', wikiFiguraHTML(info))
    }).catch(() => {})
  }

  // ⚠️ A BUSCA NA OBRA ACONTECE ANTES DA IA, e é por isso que ela vale a pena:
  // não é um bloco decorativo embaixo da resposta, é INFORMAÇÃO QUE ENTRA na
  // pergunta. Assim a Lexa pode dizer "aqui é o mesmo sentido do capítulo 4" —
  // coisa que só quem leu o livro inteiro consegue responder, e agora o app
  // leu. Custa zero de IA: o livro já está no aparelho.
  let eco = null
  try { eco = await obraMontarEco(null, { livro: _lerLivro, termo: alvo, atual: ctx }) } catch (e) {}

  try {
    const sistema = lexaPrompt()
    // O TRECHO INTEIRO vai primeiro, e a frase depois. Sem o parágrafo, um
    // pronome no começo da seleção fica órfão e a IA inventa o referente.
    const trecho = (emVolta && emVolta.length > ctx.length) ? emVolta : ''
    const pergunta = `O aluno está lendo "${_lerLivro.title}"${_lerLivro.author ? ', de ' + _lerLivro.author : ''}.${
    trecho ? `\nTrecho em volta (use para resolver pronomes e referências): "${trecho}"` : ''}\nA frase é: "${ctx}". Ele selecionou: "${alvo}".\nExplique o que "${alvo}" significa AQUI, nesta passagem.${
    (typeof obraContextoParaIA === 'function' ? obraContextoParaIA(eco) : '')}`
    // A WEB VALE AQUI TAMBÉM. O leitor é onde nome próprio e referência
    // cultural mais aparecem — "Archie's Pals 'n' Gals" saiu daqui —, e a
    // primeira versão da busca só valia no menu de seleção. Uma peça só
    // (`lexaExplicarTexto`) decide se vai à rede, nos quatro caminhos.
    const forcar = !!(de && de.web)
    const r = await lexaExplicarTexto({ sistema, pergunta, termo: alvo, frase: ctx,
                                  forcarWeb: forcar, maxTokens: 600 })
    const t = r.texto
    // Fechou o painel enquanto a IA respondia: não há mais onde escrever, e
    // reabrir por conta própria seria o app decidindo por ele.
    if (!vivo()) return
    const txtEl = corpo.querySelector('.ler-pop-txt')
    // innerHTML com `lexaFormatar`, não textContent: a resposta vem em
    // markdown e o `textContent` a mostrava crua — `**pals** = "amigos"`,
    // com os asteriscos na cara do aluno.
    if (txtEl) txtEl.innerHTML = t ? lexaFormatar(t) : esc(`${lexaNome()} devolveu uma resposta vazia`)
    // O ECO na tela, logo abaixo da explicação: os trechos com o capítulo, e um
    // clique que leva até lá.
    if (txtEl && eco && eco.trechos && eco.trechos.length) {
      txtEl.insertAdjacentHTML('beforeend', obraBlocoHTML(eco, { noLeitor: true }))
    }
    if (typeof lexaWebRodape === 'function' && txtEl) {
      lexaWebRodape(txtEl, { ...r,
        refazer: () => lerExplicarSelecao(null, { alvo, ctx, trecho: emVolta, web: true }) })
    }
    // OS CHIPS SÃO DO QUE ELE MARCOU. Já foram da frase inteira, e ele pegou:
    // marcou "looks lower middle-class to Billy" e vieram "two miles",
    // "downtown", "enter" — palavras da frase que ele não tinha marcado. A
    // frase entra como CONTEXTO, para a IA desambiguar, e não como fonte de
    // chip.
    if (t && !corpo.querySelector('.lexa-chips-slot') && typeof lexaChipsMontar === 'function') {
    lexaChipsMontar(corpo, {
      trecho: alvo, contexto: [ctx, trecho].filter(Boolean).join(' ').slice(0, 700),
      lang: _lerLivro.lang || 'en', fonte: _lerLivro.title,
      origem: { source_type: 'kindle', source_title: _lerLivro.title,
            source_context: (_lerLivro.chapters[_lerCap] || {}).titulo || '' }
    })
    }
    // A conversa continua daqui: a explicação vira a primeira mensagem, então
    // a pergunta seguinte já sabe o livro, a frase e o termo.
    if (t && !corpo.querySelector('.lexa-chat') && typeof lexaChatMontar === 'function') {
    lexaChatMontar(corpo, { sistema, primeira: pergunta, resposta: t })
    }
  } catch (e) {
    const txtEl = vivo() && corpo.querySelector('.ler-pop-txt')
    if (txtEl) txtEl.textContent = 'Não deu: ' + e.message
  }
}

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
  // O parágrafo vai junto, só para a IA: é ele que carrega o antecedente dos
  // pronomes. O card continua recebendo a frase.
  _lerPopTrecho = _lerBlocoEmVolta(sel)

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
      // Entra mesmo SEM glosa: "já está no Preparar" evita que ele mande a
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
        ? 'Salva a frase no Preparar — a triagem por IA quebra em palavras, phrasals e expressões'
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
  pop.querySelector('[data-p="exp"]').onclick = () => lerExplicarSelecao(pop)
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
// Palavras que JÁ SÃO CARD — não são "novas" e não podem voltar para a
// triagem nem para o classificador.
//
// ⚠️ O conjunto guarda o card E OS LEMAS DELE. Sem isso a comparação era
// literal e divergiu do `isKnownWord`, que ganhou lematização na 82ª rodada:
// quem estudava "begin" recebia "began" como novidade, "run" não cobria
// "running", "child" não cobria "children". Num capítulo isso são dezenas de
// falsas novas — inflam a contagem, estragam a cobertura e fazem o
// classificador gastar dinheiro com palavra que já está na fila de estudo.
//
// Os lemas entram nos DOIS sentidos: aqui, para o card "began" cobrir o texto
// "begin"; e em `_lerEhEmEstudo`, para o card "begin" cobrir o texto "began".
function _lerConjuntoEmEstudo() {
  const s = new Set()
  for (const w of words) {
    const k = knownNorm(w.word || '')
    if (!k || k.length < 2 || /\s/.test(k)) continue
    s.add(k)
    if (typeof glossLemas === 'function') {
      for (const l of glossLemas(k, { estrito: true })) s.add(l)
    }
  }
  return s
}

// `estrito` de propósito, aqui e no conjunto: -er/-est derivam palavra nova
// ("teacher" não é "teach"), e sumir com item legítimo da lista de estudo é
// pior que mostrá-lo de novo.
function _lerEhEmEstudo(conjunto, token) {
  if (conjunto.has(token)) return true
  if (typeof glossLemas !== 'function') return false
  for (const l of glossLemas(token, { estrito: true })) if (conjunto.has(l)) return true
  return false
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
        <textarea id="ler-conversa-input" rows="1" aria-label="Perguntar sobre o livro" placeholder="Perguntar sobre o livro…"
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
    if (_lerEhEmEstudo(emEstudo, t)) { conhecidas++; continue }
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
      <button class="btn btn-primary btn-sm" onclick="lerMandarNovas(10)">${ic('plus','ic-sm')} As 10 mais frequentes para o Preparar</button>
      ${_lerDesfazer.length ? `<button class="btn btn-secondary btn-sm" onclick="lerDesfazerTriagem()">${ic('undo','ic-sm')} Desfazer (${_lerDesfazer.length})</button>` : ''}
    </div>
    ${_lerNivBlocoHTML()}
    ${_lerPreBlocoHTML()}
    <div class="ler-fer-triagem" onclick="_lerCliqueTriagem(event)">
      ${topo.map(x => `
        <span class="ler-tri" data-w="${escA(x.w)}">
          <button class="ler-tri-w" data-a="estudo" data-tip="Não conheço — mandar para o Preparar com a frase do livro">
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
// única saída era mandar lixo para o Preparar. Marcar o que você já sabe é o
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
  toast(`${n} palavra${n > 1 ? 's' : ''} ${n > 1 ? 'foram' : 'foi'} para o Preparar`, 'success')
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

const LER_PRE_MAX = 500   // teto por capítulo. Era 120, escolhido antes de eu
                          // saber o preço real; com o custo agora MEDIDO (e não
                          // estimado no escuro), 500 cobre o capítulo de verdade
                          // — num de 647 palavras novas, passa de 19% para 77%.
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
  // Mesmo cuidado do fluxo de nível: avisar ANTES do primeiro await. Ler o
  // cache no IndexedDB não é instantâneo, e clique sem resposta é o defeito
  // que o Djemeson relatou — vale para todo botão que dispara trabalho longo.
  _lerPreProgresso('procurando leitura já feita…', 0, 0, 0)
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
    'ANTES de traduzir, veja se a palavra faz parte de uma UNIDADE MAIOR naquela frase:',
    'phrasal verb ("tire of", "look forward to"), expressão idiomática ("bear the mark of Cain"),',
    'ou colocação fixa ("shed blood", "arm myself"). Se fizer, glose a UNIDADE INTEIRA — é ela que',
    'tem o significado; traduzir a palavra solta ali é o erro mais caro que existe neste app.',
    '',
    'Responda SÓ com JSON: {"itens":[{"w":"a palavra EXATAMENTE como veio","expr":"a unidade inteira, se houver","tipo":"phrasal|idiom|colocação","pt":"tradução em forma de citação","g":false}]}',
    '- "w": copie a palavra recebida, letra por letra. É por ela que a resposta é casada com a pergunta — NUNCA a altere.',
    '- "expr": só quando houver unidade maior, copiada da frase, no máximo 3 palavras e CONTENDO o "w". Se a palavra vale sozinha ali, deixe "" e não invente expressão.',
    '- "tipo": só quando houver "expr".',
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
        // A EXPRESSÃO só vale se for real: até 3 palavras, contendo a palavra
        // perguntada, e presente na frase que eu mandei. Sem essas três travas,
        // um modelo inventivo devolve "unidades" que não existem no texto e o
        // balão passa a ensinar expressão imaginária — pior que não ter nada.
        let expr = String(r.expr || '').trim().replace(/\s+/g, ' ')
        if (expr) {
          const pe = knownNorm(expr).split(' ').filter(Boolean)
          const pf = knownNorm(orig.f).split(' ').filter(Boolean)
          const contemAlvo = pe.includes(knownNorm(orig.w))
          // Presença EM ORDEM, com folga — não substring literal. A trava
          // literal parecia mais segura e rejeitava expressão legítima: a frase
          // diz "shed THE blood" e a forma de citação é "shed blood"; pior, todo
          // phrasal separável ("picked the book UP") morria. Agora as palavras
          // precisam aparecer na ordem e dentro de uma janela curta — invenção
          // ("shed a tear" numa frase sem "tear") continua barrada.
          let i = 0, ini = -1, fim = -1
          for (let k = 0; k < pf.length && i < pe.length; k++) {
            if (pf[k] === pe[i]) { if (i === 0) ini = k; fim = k; i++ }
          }
          const naFrase = i === pe.length && (fim - ini) <= 5
          if (pe.length < 2 || pe.length > 3 || !contemAlvo || !naFrase) expr = ''
        }
        saida.push({
          w: orig.w, expr, tipo: expr ? String(r.tipo || '').slice(0, 14) : '',
          pt: String(r.pt).trim().slice(0, 60), g: r.g === true || r.g === 'true'
        })
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
// O ALVO é parâmetro. Antes era fixo em `#ler-pre-area`, que pertence só ao
// bloco da GLOSA — então "Classificar por nível" desenhava o progresso no
// bloco errado e, quando aquele bloco estava no estado "já foi lido" (que não
// tem esse id), a função saía em silêncio e o clique não fazia nada visível.
// Cada fluxo longo agora tem a sua própria área e escreve nela.
function _lerProgresso(areaId, texto, feito, total, sub) {
  const a = el(areaId)
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
      (sub ? '<div class="ler-pre-prog-sub">' + esc(sub) + '</div>' : '') +
    '</div>'
}

// Atalhos por fluxo — cada um sabe a sua área. Assim nenhum ponto de chamada
// precisa lembrar o id, que foi exatamente como o bug nasceu.
function _lerPreProgresso(texto, feito, total, glosas) {
  _lerProgresso('ler-pre-area', texto, feito, total,
    glosas ? glosas + ' palavras lidas até agora' : '')
}
function _lerNivProgresso(texto, feito, total, n) {
  _lerProgresso('ler-niv-area', texto, feito, total,
    n ? n + ' palavras classificadas até agora' : '')
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

// ================================================================
// TRIAGEM POR NÍVEL — "marque o que está abaixo de mim, eu desmarco o resto"
// ================================================================
// O problema que isto resolve: um capítulo traz 647 palavras "novas", mas a
// maioria só é nova para o APP — o aluno já as conhece; elas nunca passaram
// pelo `knownWords` porque marcá-las uma a uma é trabalho de horas. O efeito
// era duplo e ruim: a cobertura mentia para baixo (67% quando o real é ~90%) e
// a leitura com IA gastava dinheiro glosando palavra que ele sabe.
//
// A inversão: a IA classifica cada palavra no QECR (A1…C2) numa chamada
// barata, tudo ABAIXO do nível dele já vem MARCADO como conhecido, e ele só
// desmarca a exceção. Marcar 300 palavras vira desmarcar 8.
//
// POR QUE É UM PASSO SEPARADO DA LEITURA COM IA, e nesta ordem:
//   1. classificar (barato: ~3 tokens de saída por palavra, cobre TODAS)
//   2. marcar as conhecidas
//   3. só então glosar o que sobrou (caro, e agora sobre um conjunto menor)
// Fazer o contrário seria pagar glosa de palavra que ele ia marcar como
// conhecida no minuto seguinte.
//
// O QUE ELE NUNCA FAZ: marcar sozinho. A tela mostra a proposta, ele confirma,
// e há desfazer — `knownWords` alimenta a cobertura, a triagem e o próprio
// glossário, então marcação errada em massa contamina tudo.

// Versão do formato gravado. SUBIR sempre que mudar O QUE a classificação
// produz — não só quando o formato quebra.
//   v1 → v2: mandava a palavra NUA e por isso nunca achava phrasal verb,
//            idiom nem colocação. Classificação v1 é incompleta por
//            construção e é descartada para ser refeita com a frase junto.
// ⚠️ Esqueci este bump ao adicionar as expressões, e o efeito foi o pior
// possível: clicar em "Classificar" achava o cache velho, carregava, avisava
// "classificação carregada" e NUNCA chamava a IA — parecia que o recurso novo
// não funcionava. Mesma armadilha que o LER_PRE_VER cobriu no glossário uma
// rodada antes.
const LER_NIV_VER = 2
const LER_NIV_LOTE = 80        // saída curtíssima (palavra + 2 letras), então
                               // cabe lote maior que o da glosa

let _lerNiv = null             // { chave, itens:[{w,n,freq}], sel:Set, feitas:Set }
let _lerNivDesfazer = null     // últimas marcadas, para reverter em um clique

function _lerChaveNiv(cap) { return 'niv:' + (_lerLivro ? _lerLivro.id : '?') + ':' + cap }

// ================================================================
// AS MARCAS SOBREVIVEM AO RECARREGAMENTO
// ================================================================
// A CLASSIFICAÇÃO já era gravada (é cara, uma chamada de IA por capítulo);
// as MARCAS dele, não. Um capítulo de 400 palavras não se resolve numa
// sentada — e recarregar a página jogava fora o trabalho de triagem inteiro,
// devolvendo a tela ao palpite inicial. Ele descreveu exatamente isso: "posso
// não finalizar tudo na primeira vez".
//
// Ficam em chave PRÓPRIA, ao lado da classificação. Junto seria reescrever o
// blob dos 400 itens a cada clique; separada, o que se grava é só o mapa.
// E a gravação é ADIADA: numa varredura são dezenas de cliques por segundo, e
// gravar em cada um faria a tela esperar o disco.
function _lerChaveNivMarca(chave) { return String(chave).replace(/^niv:/, 'nivmarca:') }

let _lerNivGravando = null
function _lerNivSalvarMarcas() {
  if (!_lerNiv) return
  clearTimeout(_lerNivGravando)
  const chave = _lerChaveNivMarca(_lerNiv.chave)
  const marca = [..._lerNiv.marca]
  _lerNivGravando = setTimeout(() => {
    BookDB.set(chave, new Blob([JSON.stringify({ v: LER_NIV_VER, marca, at: Date.now() })]))
      .catch(e => console.warn('[niv] não gravei as marcas:', e && e.message))
  }, 400)
}

// ⚠️ O REGISTRO GRAVADO É A VERDADE INTEIRA, não um complemento ao palpite.
// Se fosse complemento, DESMARCAR não sobreviveria: tirar "house" (A1, que
// nasce pré-marcada) some do mapa, e no recarregamento a pré-marcação a
// devolveria como conhecida — o app desfazendo a decisão dele em silêncio.
// Existindo registro, ele substitui o mapa; o que não estiver nele é "sem
// olhar", que é justamente o que desmarcar quer dizer.
async function _lerNivCarregarMarcas() {
  if (!_lerNiv) return
  try {
    const b = await BookDB.get(_lerChaveNivMarca(_lerNiv.chave))
    if (!b) return
    const d = JSON.parse(typeof b.text === 'function' ? await b.text() : String(b))
    if (!d || !Array.isArray(d.marca) || Number(d.v || 0) < LER_NIV_VER) return
    const vivas = new Set(_lerNiv.itens.map(it => it.w))
    const novo = new Map()
    for (const [w, v] of d.marca) if (vivas.has(w) && (v === 'sim' || v === 'nao')) novo.set(w, v)
    _lerNiv.marca = novo
  } catch (e) { console.warn('[niv] marcas gravadas ilegíveis:', e && e.message) }
}

async function _lerNivDoCache(cap) {
  try {
    const b = await BookDB.get(_lerChaveNiv(cap))
    if (!b) return null
    const d = JSON.parse(typeof b.text === 'function' ? await b.text() : String(b))
    if (!d || !Array.isArray(d.itens) || Number(d.v || 0) < LER_NIV_VER) return null
    return d
  } catch (e) { return null }
}

// Monta o estado a partir do cache, já descartando o que deixou de ser novo
// (ele pode ter marcado palavras por outro caminho desde a classificação).
function _lerNivMontar(chave, itens) {
  const nivel = cefrIdx(cefrNivelAluno())
  const emEstudo = _lerConjuntoEmEstudo()
  // `_lerConjuntoEmEstudo` só guarda palavra de uma peça, então expressão que
  // JÁ é card escapava dele e voltava a aparecer na triagem. Aqui a checagem
  // é contra a lista de cards inteira.
  const cards = new Set(words.map(w => knownNorm(w.word || '')).filter(Boolean))
  const vivos = itens.filter(it =>
    it && it.w && cefrIdx(it.n) >= 0 &&
    !isKnownWord(it.w) && !_lerEhEmEstudo(emEstudo, knownNorm(it.w)) && !cards.has(knownNorm(it.w)) &&
    !(typeof ignoredWords === 'object' && ignoredWords[knownNorm(it.w)]))
  // Pré-marcado = está ABAIXO do nível dele. O nível dele mesmo NÃO entra:
  // "B1" para quem é B1 é exatamente a faixa onde ele ainda tem buracos, e
  // marcá-la em massa esconderia o que ele precisa estudar.
  // ⚠️ Isto define só o ESTADO INICIAL. TODA palavra, de qualquer faixa, é
  // clicável, e todo grupo tem "marcar todas" — inclusive C1 e C2. Ninguém
  // conhece vocabulário em blocos perfeitamente alinhados com a escala: quem
  // é B1 sabe "bayonet" se leu sobre guerra. A escala é um palpite útil para
  // poupar cliques, não um teto.
  // O estado é um MAPA de três valores, não mais um Set de marcados: ver o
  // bloco "AS DUAS FERRAMENTAS". A pré-marcação continua a mesma — tudo
  // abaixo do nível dele nasce como 'sim'.
  const marca = new Map()
  for (const it of vivos) if (cefrIdx(it.n) < nivel) marca.set(it.w, 'sim')
  _lerNiv = { chave, itens: vivos, marca }
  return vivos.length
}

async function lerNivAplicar(cap) {
  const d = await _lerNivDoCache(cap)
  if (_lerCap !== cap) return 0
  if (!d) { _lerNiv = null; return 0 }
  const n = _lerNivMontar(_lerChaveNiv(cap), d.itens)
  // Depois de montar: o palpite inicial entra primeiro e as marcas gravadas
  // passam por cima. Quem chama já é assíncrono e repinta ao terminar.
  await _lerNivCarregarMarcas()
  return n
}

async function lerClassificar(cap, refazer) {
  if (cap === undefined) cap = _lerCap
  if (!_lerLivro) return
  // FEEDBACK ANTES DO PRIMEIRO await. Ler o cache no IndexedDB e abrir o
  // capítulo do EPUB levam tempo, e sem isto o clique não produzia nada
  // visível — o usuário não tem como saber se está rodando ou se travou.
  _lerNivProgresso('procurando classificação já feita…', 0, 0, 0)
  if (!refazer && await lerNivAplicar(cap)) {
    // Faltava redesenhar: com a classificação já em cache, a função saía
    // calada e o clique parecia não fazer nada pela SEGUNDA razão.
    _lerRenderFerramentas()
    toast('classificação deste capítulo carregada', 'info')
    return
  }

  _lerNivProgresso('abrindo o capítulo…', 0, 0, 0)
  const txt = await _lerTextoDoCapitulo(cap)
  if (!txt) { toast('capítulo vazio', 'warning'); _lerRenderFerramentas(); return }
  _lerNivProgresso('separando as palavras novas…', 0, 0, 0)
  // SEM teto aqui, ao contrário da glosa: a saída é de 2 letras por palavra, e
  // classificar só metade do capítulo deixaria a outra metade inflando a
  // contagem de "novas" para sempre.
  const nov = lerAnalisar(txt).novas.filter(x => x.w.length > 2)
  if (!nov.length) { toast('nenhuma palavra nova neste capítulo', 'info'); _lerRenderFerramentas(); return }

  // A FRASE VAI JUNTO — e é isto que permite achar phrasal verb, idiom e
  // colocação. A primeira versão mandava a palavra nua, e por construção não
  // tinha como enxergar unidade nenhuma: "tire" e "of" chegavam separados e
  // sem vizinhança, então "tire of" jamais apareceria. Palavra sem contexto
  // não é classificável em expressão — é o mesmo motivo pelo qual recusamos o
  // dicionário embarcado.
  // Custa pouco: a frase pesa na ENTRADA, que é o lado barato (US$ 0,20/1M
  // contra 1,20 da saída).
  _lerNivProgresso('casando cada palavra com a frase dela…', 0, 0, 0)
  const frasesN = _lerFrasesPara(txt, nov.map(x => x.w))
  const comFrase = nov.map(x => ({ w: x.w, freq: x.n, f: frasesN.get(x.w) || '' }))

  const lang = (_lerLivro.lang || 'en').slice(0, 2)
  const lotes = []
  for (let i = 0; i < comFrase.length; i += LER_NIV_LOTE) lotes.push(comFrase.slice(i, i + LER_NIV_LOTE))

  const sistema = [
    'Você classifica vocabulário de ' + (lang === 'en' ? 'inglês' : lang) + ' na escala QECR/CEFR.',
    'Para cada palavra recebida, devolva o nível em que um aprendiz TÍPICO já a reconheceria ao ler.',
    'A1 = as ~500 palavras mais comuns. A2 = dia a dia. B1 = notícia e diálogo comum.',
    'B2 = romance e texto técnico. C1 = literário, formal, irônico. C2 = raro, arcaico, técnico especializado.',
    'Classifique a palavra em si, não o assunto do texto. Nome próprio, topônimo e marca: C1.',
    'Forma flexionada herda o nível do lema ("began" tem o nível de "begin").',
    '',
    '',
    'Cada item vem como "palavra :: frase do livro". Olhe a frase por DOIS motivos:',
    '(a) desambiguar a palavra; (b) ver se ali ela forma uma UNIDADE MAIOR — phrasal verb',
    '("tire of", "look forward to"), expressão idiomática ("bear the mark of Cain") ou colocação',
    'fixa ("shed blood"). Quando formar, devolva a unidade em "expr" com o nível DELA em "nx".',
    'A unidade quase sempre é mais difícil que a palavra: quem sabe "look" pode não saber',
    '"look forward to". Por isso ela é classificada à parte, e não herda o nível da palavra.',
    '',
    'Responda SÓ com JSON: {"itens":[{"w":"a palavra EXATAMENTE como veio","n":"B1","expr":"","nx":""}]}',
    '- "w": copie letra por letra. É por ela que a resposta é casada com a pergunta.',
    '- "n": nível da PALAVRA. Um de A1, A2, B1, B2, C1, C2. Nada além disso.',
    '- "expr": a unidade inteira, copiada da frase, 2 ou 3 palavras, CONTENDO o "w". Se a palavra vale sozinha ali, deixe "" — não invente expressão.',
    '- "nx": nível da unidade, na mesma escala. Só quando houver "expr".',
    '- Um objeto por palavra. Se estiver em dúvida, escolha o nível MAIS ALTO — errar para cima só faz a palavra aparecer para ele conferir; errar para baixo a esconde.'
  ].join('\n')

  const tokensIn = Math.ceil((sistema.length * lotes.length +
    comFrase.reduce((a, x) => a + x.w.length + x.f.length + 6, 0)) / 4)
  const tokensVis = nov.length * 22   // agora cabe expr + nx na resposta
  const rac = _lerRacPrevisto(aiModel(), nov.length, tokensVis)
  const p = aiPrecoModelo()
  const usd = (tokensIn * p.in + (tokensVis + rac.tokens) * p.out) / 1e6
  const brl = usd * (await aiUsdBrl())
  const ok = await confirmModal({
    title: 'Classificar o vocabulário por nível',
    icon: 'layers',
    confirmText: 'Classificar — ' + _brl(brl),
    html: '<div class="cost-rows">' +
      '<div class="cost-row"><span>Palavras</span><b>' + nov.length + ' (todas as novas) + as expressões que elas formarem</b></div>' +
      '<div class="cost-row"><span>Chamadas</span><b>' + lotes.length + '</b></div>' +
      '<div class="cost-row"><span>Modelo</span><b>' + esc(aiChatCfg().P.nome + ' · ' + aiModel()) + '</b></div>' +
      '<div class="cost-row"><span>Seu nível</span><b>' + esc(cefrNivelAluno()) + ' (Configurações → IA)</b></div>' +
      '<div class="cost-row total"><span>Custo estimado</span><b>' + _brl(brl) + '</b></div>' +
      '</div><ul class="cost-bullets">' +
      '<li>Tudo <b>abaixo de ' + esc(cefrNivelAluno()) + '</b> vem marcado como conhecido. Você só <b>desmarca</b> o que não souber.</li>' +
      '<li>Nada é marcado sem você confirmar, e dá para desfazer.</li>' +
      '<li>Cada palavra vai com a <b>frase do livro</b>, então entram também <b>phrasal verbs, expressões e colocações</b> — classificados à parte, porque quem sabe "look" pode não saber "look forward to".</li>' +
      '<li>Depois disto a leitura com IA fica mais barata: sobra menos palavra para glosar.</li>' +
      '</ul>'
  })
  if (!ok) { _lerRenderFerramentas(); return }

  try {
    if (typeof aiUsoZerar === 'function') aiUsoZerar()
    const saida = []
    const vistas = new Set()   // expressões já colhidas, para não repetir
    let ignorados = 0
    for (let n = 0; n < lotes.length; n++) {
      _lerNivProgresso('classificando… (lote ' + (n + 1) + ' de ' + lotes.length + ')', n, lotes.length, saida.length)
      const j = await aiJSON([
        { role: 'system', content: sistema },
        { role: 'user', content: lotes[n].map(x => x.w + (x.f ? ' :: ' + x.f : '')).join('\n') }
      ], { maxTokens: Math.min(4000, lotes[n].length * 14 + 300) })

      // Casamento PELA PALAVRA, como na glosa — nunca por índice/ordem.
      const pedidas = new Map(lotes[n].map(x => [knownNorm(x.w), x]))
      for (const r of (Array.isArray(j) ? j : (j.itens || j.items || []))) {
        if (!r) continue
        const orig = pedidas.get(knownNorm(r.w || r.word || ''))
        const niv = String(r.n || r.nivel || r.level || '').toUpperCase().trim()
        if (!orig || cefrIdx(niv) < 0) { ignorados++; continue }
        saida.push({ w: orig.w, n: niv, freq: orig.freq })

        // A EXPRESSÃO vira item PRÓPRIO, com o nível dela — não substitui a
        // palavra. Ele pode saber "tire" e não saber "tire of", e são duas
        // decisões diferentes de "eu conheço". As mesmas três travas da glosa
        // contra unidade inventada: 2–3 palavras, contém a palavra perguntada,
        // e aparece na frase em ordem, dentro de uma janela curta.
        const ex = String(r.expr || '').trim().replace(/\s+/g, ' ')
        const nx = String(r.nx || r.nivelExpr || '').toUpperCase().trim()
        if (!ex || cefrIdx(nx) < 0 || !orig.f) continue
        const pe = knownNorm(ex).split(' ').filter(Boolean)
        const pf = knownNorm(orig.f).split(' ').filter(Boolean)
        if (pe.length < 2 || pe.length > 3) continue
        if (!pe.includes(knownNorm(orig.w))) continue
        let i2 = 0, iniE = -1, fimE = -1
        for (let k = 0; k < pf.length && i2 < pe.length; k++) {
          if (pf[k] === pe[i2]) { if (i2 === 0) iniE = k; fimE = k; i2++ }
        }
        if (i2 !== pe.length || (fimE - iniE) > 5) continue
        if (vistas.has(knownNorm(ex))) continue      // a mesma unidade volta em várias frases
        vistas.add(knownNorm(ex))
        saida.push({ w: ex, n: nx, freq: orig.freq, ex: true })
      }
      _lerNivProgresso('classificando…', n + 1, lotes.length, saida.length)
    }
    if (!saida.length) throw new Error('a IA não devolveu nenhuma classificação reconhecível')

    await BookDB.set(_lerChaveNiv(cap), new Blob([JSON.stringify({ v: LER_NIV_VER, itens: saida, at: Date.now() })]))
    // Classificação nova = triagem nova. Marcas de uma classificação anterior
    // apontam para uma lista que não existe mais, e ressuscitá-las daria a
    // pior impressão possível: palavra marcada como conhecida sem ele ter
    // olhado. "Refazer" recomeça do palpite.
    await BookDB.del(_lerChaveNivMarca(_lerChaveNiv(cap)))
    if (_lerCap === cap) _lerNivMontar(_lerChaveNiv(cap), saida)

    let extra = ''
    if (typeof aiUsoAcumulado === 'function') {
      const uso = aiUsoAcumulado()
      if (uso.chamadas) {
        const brlReal = aiCustoDeUso(uso, aiModel()) * (await aiUsdBrl())
        extra = ' · custou ' + _brl(brlReal)
        if (uso.raciocinio > 0) _lerRacGuardar(aiModel(), uso.raciocinio / nov.length)
        console.info('[nivel] medido:', uso, '→', _brl(brlReal), '· estimado', _brl(brl))
      }
    }
    if (ignorados) console.warn('[nivel] ' + ignorados + ' resposta(s) descartadas (palavra fora do lote ou nível inválido)')
    toast(saida.length + ' palavras classificadas' + extra, 'success')
  } catch (e) {
    toast('não deu para classificar: ' + e.message, 'error')
  }
  _lerRenderFerramentas()
}

// ---- A TELA ----------------------------------------------------
// ================================================================
// AS DUAS FERRAMENTAS — pincel de "conheço" e pincel de "não conheço"
// ================================================================
// A tela nasceu binária: marcado = conheço, não marcado = vai estudar. Isso
// funciona enquanto a proposta da IA está quase certa e ele só desmarca a
// exceção. Não funciona quando a exceção é a maioria — e foi o que ele
// descreveu: às vezes é mais rápido marcar SÓ o que não conhece e varrer o
// resto de uma vez.
//
// O que faltava para isso era um TERCEIRO estado. Com dois, "não marcado"
// significa duas coisas ao mesmo tempo — "ainda não olhei" e "olhei e não
// sei" — e nenhuma varredura em massa é segura, porque ela atropela as duas.
//   (vazio)  = ainda não olhei
//   'sim'    = conheço
//   'nao'    = não conheço  ← protege da varredura
//
// A FERRAMENTA ATIVA decide o que o clique pinta. Ele sugeriu como alternativa
// um ciclo de três estados no mesmo clique (1 clique = conheço, 2 = não
// conheço); ficou de fora porque a ferramenta já resolve, e as duas juntas
// brigariam: com o pincel de "não conheço" na mão, o primeiro clique teria de
// pintar "conheço" para respeitar o ciclo. Clicar de novo com o MESMO pincel
// apaga a marca — é o comportamento normal de pincel e não precisa ser
// aprendido.
//
// E é isto que faz o fluxo dele fechar: **"todas as restantes" pinta só o que
// está SEM MARCA.** Marcar as 8 que não conhece e varrer as outras 300 como
// conhecidas passa a ser uma varredura só, sem risco de apagar as 8.
let _lerNivFerr = 'sim'        // pincel ativo: 'sim' (conheço) | 'nao'

function lerNivFerramenta(qual) {
  _lerNivFerr = (qual === 'nao') ? 'nao' : 'sim'
  _lerNivRepintar()
}

function _lerNivMarca(w) { return (_lerNiv && _lerNiv.marca.get(w)) || '' }

function lerNivToggle(w, nivel) {
  if (!_lerNiv) return
  // Mesmo pincel duas vezes = apaga. Pincel diferente = repinta por cima, sem
  // precisar limpar antes.
  if (_lerNiv.marca.get(w) === _lerNivFerr) _lerNiv.marca.delete(w)
  else _lerNiv.marca.set(w, _lerNivFerr)
  _lerNivSalvarMarcas()
  _lerNivRepintarGrupo(nivel)
}

// `modo`: 'restantes' pinta só quem está sem marca (o varrer seguro),
//         'todas' pinta tudo da faixa, 'limpar' devolve a faixa ao zero.
function lerNivGrupo(nivel, modo) {
  if (!_lerNiv) return
  for (const it of _lerNiv.itens) {
    if (it.n !== nivel) continue
    if (modo === 'limpar') { _lerNiv.marca.delete(it.w); continue }
    if (modo === 'restantes' && _lerNiv.marca.has(it.w)) continue
    _lerNiv.marca.set(it.w, _lerNivFerr)
  }
  _lerNivSalvarMarcas()
  _lerNivRepintarGrupo(nivel)
}

// Confirma as CONHECIDAS. Sem `nivel`, vale para a triagem inteira (a barra
// do topo); com `nivel`, só para aquela faixa — que é o pedido dele: resolver
// uma faixa, tirá-la da frente, e seguir verificando as outras.
function lerNivConfirmar(nivel) {
  if (!_lerNiv) return
  const alvo = _lerNiv.itens.filter(it =>
    _lerNiv.marca.get(it.w) === 'sim' && (!nivel || it.n === nivel))
  if (!alvo.length) return
  // Guarda ANTES de marcar: só o que não era conhecido é que precisa voltar
  // no desfazer, senão reverter apagaria marcação legítima antiga.
  const marcadas = alvo.map(it => it.w).filter(w => !isKnownWord(w))
  for (const w of marcadas) markKnownWord(w, true)
  _lerNivDesfazer = marcadas
  const fora = new Set(alvo.map(it => it.w))
  _lerNiv.itens = _lerNiv.itens.filter(it => !fora.has(it.w))
  for (const w of fora) _lerNiv.marca.delete(w)
  _lerNivSalvarMarcas()
  toast(marcadas.length + (marcadas.length === 1 ? ' palavra marcada' : ' palavras marcadas') +
    ' como ' + (marcadas.length === 1 ? 'conhecida' : 'conhecidas') +
    (nivel ? ' em ' + nivel : ''), 'success')
  _lerRenderFerramentas()
}

function lerNivDesfazerMarcacao() {
  if (!_lerNivDesfazer || !_lerNivDesfazer.length) return
  for (const w of _lerNivDesfazer) markKnownWord(w, false)
  const voltando = _lerNivDesfazer
  const n = voltando.length
  _lerNivDesfazer = null
  toast(n + ' marcações desfeitas', 'info')
  lerNivAplicar(_lerCap).then(() => {
    // Voltam MARCADAS como conhecidas, que é o estado em que estavam um
    // instante antes de ele confirmar. Voltar como "sem olhar" faria o
    // desfazer apagar duas decisões em vez de uma — a de gravar e a de marcar.
    if (_lerNiv) {
      const vivas = new Set(_lerNiv.itens.map(it => it.w))
      for (const w of voltando) if (vivas.has(w)) _lerNiv.marca.set(w, 'sim')
      _lerNivSalvarMarcas()
    }
    _lerRenderFerramentas()
  })
}

// Manda para o Preparar SÓ as palavras NÃO MARCADAS de uma faixa. A semântica
// da tela é "marcado = eu conheço", então o que vale estudar é justamente o
// que sobrou desmarcado — mandar as marcadas seria criar card do que ele
// acabou de dizer que já sabe.
// Reusa `_lerCapturarSemFrase`, que já acha a frase de cada palavra no
// capítulo: card sem contexto é o que produz "barrel = barril".
async function lerNivEstudarGrupo(nivel) {
  if (!_lerNiv) return
  // Vai quem NÃO é 'conheço' — o explicitamente "não conheço" e o que ele
  // ainda não olhou. Continua a mesma semântica de antes; o estado novo só
  // deixou de esconder um dentro do outro.
  const lista = _lerNiv.itens.filter(it => it.n === nivel && _lerNiv.marca.get(it.w) !== 'sim').map(it => it.w)
  if (!lista.length) { toast('nada a estudar em ' + nivel + ' — está tudo marcado como conhecido', 'info'); return }
  const c = CEFR.find(x => x.id === nivel)
  const ok = await confirmModal({
    title: 'Mandar ' + nivel + ' para o Preparar',
    icon: 'plus',
    confirmText: 'Mandar ' + lista.length,
    html: '<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.55">' +
      'Vai' + (lista.length > 1 ? 'o <b>' + lista.length + ' palavras</b>' : ' <b>1 palavra</b>') + ' da faixa <b>' + esc(nivel) + '</b>' +
      (c ? ' (' + esc(c.dica) + ')' : '') +
      (lista.length > 1 ? ' — as que <b>não</b> estão marcadas como conhecidas.<br><br>'
                        : ' — a que <b>não</b> está marcada como conhecida.<br><br>') +
      'Cada uma vai com a <b>frase do capítulo</b> em que aparece. ' +
      'A análise com IA continua sendo escolha sua, lá no Preparar.</p>'
  })
  if (!ok) return
  _lerNivProgresso('mandando ' + lista.length + ' palavras de ' + nivel + '…', 0, 0, 0)
  const n = await _lerCapturarSemFrase(lista)
  // Some da triagem: virou item de estudo, não é mais candidata a "conheço".
  const foi = new Set(lista)
  _lerNiv.itens = _lerNiv.itens.filter(it => !foi.has(it.w))
  for (const w of foi) _lerNiv.marca.delete(w)
  _lerNivSalvarMarcas()
  _lerRenderFerramentas()
  if (n) toast(n + ' palavras de ' + nivel + ' foram para o Preparar', 'success')
}

function _lerNivRepintar() {
  const c = el('ler-niv-corpo')
  if (c) c.innerHTML = _lerNivCorpoHTML()
}

// REPINTURA POR FAIXA, não da tela inteira.
// Um capítulo traz 400+ chips, e `innerHTML` no corpo todo a cada clique
// significa reconstruir 400 nós para mudar um. Numa varredura de dezenas de
// cliques isso é a diferença entre a tela responder e a tela travar. A faixa
// tem algumas dezenas — e é o único bloco que um clique pode mudar.
function _lerNivRepintarGrupo(nivel) {
  // Busca DENTRO do painel, não no documento: `document.querySelector` pega o
  // primeiro que achar em qualquer lugar da página, e no teste isso já pegou
  // um nó de outra árvore — a faixa certa ficava sem repintar e a tela mentia
  // em silêncio. O painel é o escopo natural.
  const corpo = el('ler-niv-corpo')
  const sec = corpo && nivel && corpo.querySelector(`.ler-niv-grupo[data-nivel="${nivel}"]`)
  if (!sec) { _lerNivRepintar(); return }
  const meu = cefrIdx(cefrNivelAluno())
  const c = CEFR.find(x => x.id === nivel)
  const lista = _lerNiv.itens.filter(it => it.n === nivel)
    .sort((a, b) => (b.freq || 0) - (a.freq || 0) || a.w.localeCompare(b.w))
  if (!c || !lista.length) { _lerNivRepintar(); return }
  sec.outerHTML = _lerNivGrupoHTML(c, lista, meu)
  const barra = corpo.querySelector('.ler-niv-barra')
  if (barra) barra.outerHTML = _lerNivBarraHTML()
}

function _lerNivCorpoHTML() {
  if (!_lerNiv || !_lerNiv.itens.length) {
    return '<p class="ler-fer-nota">Tudo desta classificação já foi resolvido. ' +
           'Use <b>Refazer</b> se quiser classificar o capítulo de novo.</p>'
  }
  const meu = cefrIdx(cefrNivelAluno())
  const porNivel = new Map(CEFR.map(c => [c.id, []]))
  for (const it of _lerNiv.itens) (porNivel.get(it.n) || []).push(it)

  const grupos = CEFR.map(c => {
    const lista = (porNivel.get(c.id) || [])
      .sort((a, b) => (b.freq || 0) - (a.freq || 0) || a.w.localeCompare(b.w))
    return lista.length ? _lerNivGrupoHTML(c, lista, meu) : ''
  }).join('')

  return _lerNivBarraHTML() + `<div class="ler-niv-rolo">${grupos}</div>`
}

function _lerNivGrupoHTML(c, lista, meu) {
  const sim = lista.filter(it => _lerNivMarca(it.w) === 'sim').length
  const nao = lista.filter(it => _lerNivMarca(it.w) === 'nao').length
  const virgens = lista.length - sim - nao
  const restam = lista.length - sim
  const abaixo = c.i < meu
  const meuNivel = c.i === meu
  const pincel = _lerNivFerr === 'sim' ? 'conheço' : 'não conheço'
  return `
    <section class="ler-niv-grupo${abaixo ? ' abaixo' : ''}${meuNivel ? ' meu' : ''}" data-nivel="${c.id}">
      <header class="ler-niv-cab">
        <b class="ler-niv-tag">${c.id}</b>
        <span class="ler-niv-desc">${esc(c.dica)}</span>
        ${meuNivel ? '<em class="ler-niv-marca">seu nível</em>' : ''}
        <span class="ler-niv-cont"><b>${sim}</b> conheço${nao ? ` · <b class="nao">${nao}</b> não` : ''}${
          virgens ? ` · ${virgens} sem olhar` : ''}</span>
      </header>
      <div class="ler-niv-acoes">
        ${virgens ? `<button class="btn btn-ghost btn-sm" onclick="lerNivGrupo('${c.id}','restantes')"
          data-tip="Pinta só o que ainda está sem marca — o que você já marcou fica como está">
          ${ic(_lerNivFerr === 'sim' ? 'check' : 'x','ic-sm')} ${virgens} sem olhar: ${pincel}</button>`
        : `<button class="btn btn-ghost btn-sm" onclick="lerNivGrupo('${c.id}','todas')"
          data-tip="Repinta a faixa inteira com a ferramenta ativa, inclusive o que já está marcado">
          ${ic(_lerNivFerr === 'sim' ? 'check' : 'x','ic-sm')} toda a faixa: ${pincel}</button>`}
        ${(sim || nao) ? `<button class="btn btn-ghost btn-sm" onclick="lerNivGrupo('${c.id}','limpar')"
          data-tip="Tira todas as marcas desta faixa">${ic('undo','ic-sm')} limpar faixa</button>` : ''}
        ${sim ? `<button class="btn btn-secondary btn-sm" onclick="lerNivConfirmar('${c.id}')"
          data-tip="Grava como conhecidas e tira da triagem — o resto da faixa continua aqui">
          ${ic('checkCircle','ic-sm')} resolver ${sim} conhecida${sim !== 1 ? 's' : ''}</button>` : ''}
        <button class="btn btn-ghost btn-sm${restam ? '' : ' hidden'}" onclick="lerNivEstudarGrupo('${c.id}')">
          ${ic('plus','ic-sm')} estudar ${restam === 1 ? 'a 1 restante' : 'as ' + restam + ' restantes'}</button>
      </div>
      <div class="ler-niv-lista">
        ${lista.map(it => {
          const m = _lerNivMarca(it.w)
          return `<button class="ler-niv-chip${m === 'sim' ? ' on' : m === 'nao' ? ' nao' : ''}"
            onclick="lerNivToggle(${escA(JSON.stringify(it.w))},'${c.id}')"
            data-tip="${(it.freq || 1) > 1 ? 'aparece ' + it.freq + ' vezes neste capítulo' : 'aparece 1 vez'}">
            ${m === 'sim' ? ic('check','ic-sm') : m === 'nao' ? ic('x','ic-sm') : ''}${esc(it.w)}${
              it.ex ? '<u>expr</u>' : ''}${
              (it.freq || 1) > 2 ? `<i>${it.freq}</i>` : ''}</button>`
        }).join('')}
      </div>
    </section>`
}

function _lerNivBarraHTML() {
  const itens = (_lerNiv && _lerNiv.itens) || []
  const sim = itens.filter(it => _lerNivMarca(it.w) === 'sim').length
  const nao = itens.filter(it => _lerNivMarca(it.w) === 'nao').length
  const virgens = itens.length - sim - nao
  return `
    <div class="ler-niv-barra">
      <div class="ler-niv-ferr" role="group" aria-label="Ferramenta de marcação">
        <button class="ler-niv-f${_lerNivFerr === 'sim' ? ' on' : ''}" onclick="lerNivFerramenta('sim')"
          data-tip="Com esta na mão, clicar numa palavra diz: eu conheço">${ic('check','ic-sm')} conheço</button>
        <button class="ler-niv-f nao${_lerNivFerr === 'nao' ? ' on' : ''}" onclick="lerNivFerramenta('nao')"
          data-tip="Com esta na mão, clicar numa palavra diz: não conheço — e ela fica protegida das varreduras">${ic('x','ic-sm')} não conheço</button>
      </div>
      <div class="ler-niv-resumo">
        <b>${sim}</b> conheço · <b class="nao">${nao}</b> não · <b>${virgens}</b> sem olhar
      </div>
      ${sim ? `<button class="btn btn-primary btn-sm" onclick="lerNivConfirmar()">
        ${ic('check','ic-sm')} Resolver ${sim} conhecida${sim !== 1 ? 's' : ''}</button>` : ''}
      ${_lerNivDesfazer && _lerNivDesfazer.length
        ? `<button class="btn btn-ghost btn-sm" onclick="lerNivDesfazerMarcacao()">${ic('undo','ic-sm')} Desfazer (${_lerNivDesfazer.length})</button>` : ''}
    </div>`
}

function _lerNivBlocoHTML() {
  const temEstado = _lerNiv && _lerNiv.chave === _lerChaveNiv(_lerCap) && _lerNiv.itens.length
  if (!temEstado) {
    return '<div class="ler-pre" id="ler-niv-area">' +
      '<button class="btn btn-secondary btn-sm" onclick="lerClassificar()">' +
      ic('layers', 'ic-sm') + ' Classificar por nível (você é ' + esc(cefrNivelAluno()) + ')</button>' +
      '<p class="ler-fer-nota">A IA põe cada palavra nova numa faixa do QECR. Tudo <b>abaixo do seu nível</b> ' +
      'já vem marcado como conhecido, e você só <b>desmarca</b> o que não souber. ' +
      '<b>As faixas acima também são marcáveis</b> — clique na palavra ou em "marcar todas". ' +
      'Isso conserta a cobertura e <b>barateia a leitura com IA</b>, que passa a glosar só o que sobra.</p></div>'
  }
  return '<div class="ler-pre ler-niv" id="ler-niv-area">' +
    '<div class="ler-niv-topo">' +
      '<b>Triagem por nível</b>' +
      '<span class="ler-niv-sub">escolha a ferramenta e clique nas palavras — clicar de novo com a mesma apaga a marca</span>' +
      '<button class="btn btn-ghost btn-sm" onclick="lerClassificar(undefined,true)">' + ic('refresh','ic-sm') + ' Refazer</button>' +
    '</div>' +
    '<div id="ler-niv-corpo">' + _lerNivCorpoHTML() + '</div></div>'
}

// ================================================================
// REPARO — a abertura do capítulo que usurpou toda frase
// ================================================================
// Enquanto `_lerBlocoEmVolta` subia atrás do MAIOR texto (e não do parágrafo),
// toda palavra pescada no leitor guardava a abertura do capítulo como contexto.
// A regra foi consertada em 2026-08-08, mas só vale dali para a frente: o que
// já está salvo continua errado — e esse contexto virou o exemplo do card, a
// base da análise e a frase que a Lexa lê.
//
// Este reparo desfaz o estrago SEM IA e SEM adivinhar datas: o livro está no
// `BookDB`, então dá para procurar a palavra no capítulo gravado e devolver a
// frase de verdade.

function _repNorm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ').trim()
}
// O texto do capítulo só tem os espaços normalizados: acento e caixa PRECISAM
// sobreviver, senão a frase devolvida ao item viria descaracterizada.
function _repEspacos(s) { return String(s || '').replace(/\s+/g, ' ').trim() }

// ⚠️ AQUI COMPARA-SE POR CONJUNTO DE CANDIDATOS, não pelo lema "escolhido".
// O redutor da casa coroa não-palavra em consoante dobrada e 'e' mudo
// (`breezed` → `breez`, `running` → `runn`) — está registrado como pendência
// própria, porque consertá-lo exige remigrar o acervo. Só que a lista de
// candidatos SEMPRE contém a forma boa (`breezed` → [breezed, breez, breeze]);
// o defeito é só na hora de eleger UMA. Para COMPARAR, então, não é preciso
// eleger: basta as duas listas se cruzarem. O caso real: "breeze through"
// contra "she breezed right through" falhava por causa disso.
function _repLemas(p) {
  if (typeof glossLemas !== 'function') return [p]
  const c = glossLemas(p, { estrito: true })
  return (c && c.length) ? c : [p]
}
function _repIgualTok(cands, tok) {
  return cands.includes(tok) || _repLemas(tok).some(x => cands.includes(x))
}

// O DETECTOR, e ele é exato: a palavra aparece na própria frase dela?
// Não depende de saber quando o defeito começou nem de olhar o carimbo do
// item — se o contexto não contém a palavra, o contexto não é dela.
// Tolerante à flexão pelos lemas, senão um item "fell in love" pareceria
// quebrado numa frase que diz "fall in love" e seria "consertado" à toa.
// ⚠️ O PHRASAL VERB SE PARTE, E ISSO QUASE CUSTOU UM ITEM CERTO.
// A primeira versão exigia as palavras COLADAS e na ordem. Aí ele rodou com o
// acervo de verdade e o relatório propôs "consertar" o `tuck into`, cuja cena
// era *"Billy tucks his digest into his back pocket"* — onde a expressão está
// inteira, só com o objeto no meio. É a sintaxe NORMAL do phrasal separável
// (tuck sth into, pick sth up, put sth on): exigir contiguidade é declarar
// quebrado justamente o uso mais comum da língua.
// O estrago seria real: o item perderia uma cena legítima do livro e viraria
// "Do seu estudo". Por isso a folga entre os termos — e por isso ela é
// generosa: aqui, errar para o lado de NÃO MEXER é sempre o lado certo.
const _REP_FOLGA = 3   // palavras que podem se meter entre os termos
function _repCasa(alvo, texto) {
  const a = _repNorm(alvo), t = _repNorm(texto)
  if (!a || !t) return false
  if ((' ' + t + ' ').includes(' ' + a + ' ')) return true
  const al = a.split(' ').filter(Boolean).map(_repLemas), tl = t.split(' ').filter(Boolean)
  if (!al.length) return false
  // Os termos na ORDEM, cada um até `_REP_FOLGA` palavras depois do anterior.
  // A ordem continua obrigatória: sem ela, "let the cat out of the bag" casaria
  // com qualquer frase que espalhasse essas palavras por acaso.
  for (let i = 0; i < tl.length; i++) {
    if (!_repIgualTok(al[0], tl[i])) continue
    let pos = i, ok = true
    for (let k = 1; k < al.length; k++) {
      let achou = -1
      for (let j = pos + 1; j <= Math.min(pos + 1 + _REP_FOLGA, tl.length - 1); j++) {
        if (_repIgualTok(al[k], tl[j])) { achou = j; break }
      }
      if (achou < 0) { ok = false; break }
      pos = achou
    }
    if (ok) return true
  }
  return false
}

// Corta o capítulo em frases: pontuação, espaço e maiúscula.
// ⚠️ SÓ ISSO NÃO BASTA, e o teste pegou: "Mr. Summers sits in the lobby"
// casa a regra perfeitamente e virava duas frases, entregando ao item uma
// frase decapitada. Num romance, "Mr." e "Dr." estão em toda página.
// As abreviações e as iniciais soltas ("J. R. R. Tolkien") têm o ponto
// escondido antes do corte e devolvido depois — assim a regra continua
// simples e elas não a acionam.
const _REP_ABREV = /\b(mr|mrs|ms|dr|prof|st|sr|jr|vs|etc|inc|ltd|approx|e\.g|i\.e)\.\s/gi
function _repFrases(texto) {
  const OCULTO = ''
  return _repEspacos(texto)
    .replace(_REP_ABREV, m => m.replace(/\./g, OCULTO))
    .replace(/\b([A-Z])\.\s/g, '$1' + OCULTO + ' ')
    .split(/(?<=[.!?…])\s+(?=["“'(]?[A-Z])/)
    .map(s => s.split(OCULTO).join('.').trim())
    .filter(s => s.length >= 12)
}

// ---- 1. O DIAGNÓSTICO: de graça, sem abrir livro nenhum ---------
// Varre item por item E sentido por sentido: um item pode ter a cena do topo
// certa e a de um sentido errada. Desde a Fase 2 a cena mora no sentido, e a
// do item é herança dos que vieram antes.
function reparoDiagnostico() {
  const alvos = []
  for (const w of (typeof words !== 'undefined' ? words : [])) {
    const palavra = String(w.word || '').trim()
    if (!palavra) continue
    const cenas = [{ dono: w }]
    for (const m of (w.meanings || [])) if (m && m.context) cenas.push({ dono: m, m })
    for (const c of cenas) {
      const ctx = String(c.dono.context || '').trim()
      if (!ctx) continue
      if (_repCasa(palavra, ctx)) continue     // a palavra está lá: nada a fazer
      alvos.push({
        w, m: c.m || null, palavra, contextoAtual: ctx,
        obra: String((c.m && c.m.source_title) || w.source_title || '').trim(),
        cap:  String((c.m && c.m.source_context) || w.source_context || '').trim(),
        tipo: String((c.m && c.m.source_type) || w.source_type || '').trim()
      })
    }
  }
  const porObra = new Map()
  for (const a of alvos) {
    const k = a.obra || '(sem obra)'
    if (!porObra.has(k)) porObra.set(k, [])
    porObra.get(k).push(a)
  }
  return { alvos, porObra, total: alvos.length }
}

// O PARENTE QUE LEGOU A CENA.
// Procura, em todo o acervo, um item cuja cena seja EXATAMENTE esta e cuja
// palavra esteja dentro dela. A igualdade exata é o ponto: parecido não prova
// herança, idêntico prova — duas capturas independentes não produzem a mesma
// frase caractere a caractere.
// É assim que "tuck into" (sem `tuck into` na frase) encontra o "tuck" que lhe
// emprestou a passagem, e com ele o nome que vira o "capítulo" da procedência.
// ⚠️ E PARENTESCO LÉXICO É EXIGÊNCIA, não desempate — o teste mostrou por quê:
// com uma cena compartilhada, um "zebra" qualquer era atribuído ao "tuck" só
// por dividir a frase. Exigir lema em comum não é rigor decorativo, é o
// mecanismo: quem herda cena SEM ter a palavra nela vem da FAMÍLIA de outro
// item, e membro de família sempre divide o núcleo com a cabeça ("tuck into" ←
// "tuck", "breeze through" ← "breeze").
// Os chips não caem aqui: a unidade sai de dentro da frase, então a palavra
// ESTÁ na cena e o detector nem a acusa.
// Sem parente léxico, a história de herança não se sustenta — e aí é mais
// honesto dizer "não achei no livro" do que inventar uma procedência.
function _repAncestral(a) {
  const ctx = _repEspacos(a.contextoAtual)
  if (!ctx || typeof words === 'undefined') return null
  // Mesma lógica de conjunto do `_repCasa`: "breeze through" tem de reconhecer
  // "breeze" como parente mesmo quando o redutor erra a forma eleita.
  const meus = new Set()
  for (const tok of _repNorm(a.palavra).split(' ').filter(Boolean)) _repLemas(tok).forEach(x => meus.add(x))
  let melhor = null, melhorTam = Infinity
  for (const w of words) {
    if (w === a.w) continue
    const palavra = String(w.word || '').trim()
    if (!palavra) continue
    const cenas = [w.context, ...(w.meanings || []).map(m => m && m.context)]
    if (!cenas.some(c => _repEspacos(c) === ctx)) continue
    if (!_repCasa(palavra, ctx)) continue
    const toks = _repNorm(palavra).split(' ').filter(Boolean)
    if (!toks.some(tok => _repLemas(tok).some(x => meus.has(x)))) continue
    const dele = toks
    // A CABEÇA da família é a mais curta: `expandirFamilia` é chamada NUM item
    // e gera os que orbitam em volta, então o gerador é o mais enxuto.
    if (dele.length < melhorTam) { melhor = w; melhorTam = dele.length }
  }
  return melhor
}

// Acha o livro na estante pelo título BRUTO guardado no item. `obraNome` entra
// porque o título pode ter sido limpo com IA depois da captura.
function _repLivroDe(obra) {
  if (typeof livros === 'undefined' || !obra) return null
  const alvo = _repNorm(obraNome(obra)) || _repNorm(obra)
  return livros.find(l => _repNorm(obraNome(l.title)) === alvo || _repNorm(l.title) === alvo) || null
}

// ---- 2. O REPARO ------------------------------------------------
// `simular: true` não grava nada — só devolve o relatório. É assim que ele vê
// o que ia acontecer antes de deixar acontecer.
async function reparoExecutar({ simular = true, aoAndar = null } = {}) {
  const diag = reparoDiagnostico()
  const rel = { total: diag.total, consertados: 0, unicos: 0, ambiguos: 0, ancestrais: 0,
                semLivro: 0, semCapitulo: 0, naoAchados: 0,
                amostras: [], obras: [], perdidos: [] }
  if (typeof epubAbrir !== 'function' || typeof BookDB === 'undefined') {
    rel.erro = 'o leitor de EPUB não está carregado'
    return rel
  }

  for (const [obra, itens] of diag.porObra) {
    const livro = _repLivroDe(obra)
    const blob = livro ? await BookDB.get(livro.id).catch(() => null) : null
    if (!livro || !blob) {
      rel.semLivro += itens.length
      rel.obras.push({ obra, itens: itens.length, estado: 'o arquivo não está neste aparelho' })
      for (const a of itens) rel.perdidos.push({ palavra: a.palavra, obra, motivo: 'o arquivo do livro não está neste aparelho' })
      continue
    }

    // ⚠️ NEM TODO LIVRO É EPUB. Importado como .txt ou .html, o livro não tem
    // `href` de capítulo — o arquivo INTEIRO é o texto, e os capítulos saem de
    // `textoParaCapitulos`, exatamente como o leitor faz ao abrir. Sem este
    // ramo, `href` vazio devolvia texto vazio em todo capítulo e o reparo
    // dizia "não achei" para um livro que estava ali inteiro.
    let ep = null, txtCaps = null
    try {
      const buf = await blob.arrayBuffer()
      if (livro.format === 'epub') ep = await epubAbrir(buf)
      else {
        const txt = new TextDecoder('utf-8').decode(buf)
        const ehHtml = /^\s*(<!doctype html|<html)/i.test(txt)
        txtCaps = textoParaCapitulos(ehHtml ? epubTextoLimpo(txt) : txt)
      }
    } catch (e) {
      rel.semLivro += itens.length
      rel.obras.push({ obra, itens: itens.length, estado: 'não abriu: ' + e.message })
      for (const a of itens) rel.perdidos.push({ palavra: a.palavra, obra, motivo: 'o livro não abriu: ' + e.message })
      continue
    }

    // O texto de cada capítulo é lido UMA vez e reaproveitado por todos os
    // itens dele: um livro tem dezenas de capítulos, e extrair é a parte cara.
    const cache = new Map()
    // ⚠️ ENGOLIR A FALHA DE EXTRAÇÃO era o pior tipo de silêncio: o relatório
    // dizia "a palavra não está no livro" quando a verdade era "eu não
    // consegui ler o livro". Duas causas opostas com a mesma cara.
    let falhaLeitura = ''
    const textoDoCap = async i => {
      if (cache.has(i)) return cache.get(i)
      let t = ''
      try {
        if (txtCaps) t = _repEspacos(epubTextoLimpo((txtCaps[i] || {}).html || ''))
        else {
          const c = livro.chapters[i]
          const html = c && c.href ? await ep.zip.texto(c.href) : ''
          t = html ? _repEspacos(epubTextoLimpo(html)) : ''
        }
      } catch (e) { falhaLeitura = falhaLeitura || (e.message || 'erro ao ler o capítulo') }
      cache.set(i, t)
      return t
    }
    const quantosCaps = txtCaps ? txtCaps.length : livro.chapters.length

    let feitos = 0
    for (const a of itens) {
      // Primeiro o capítulo que o item diz ser o dele; se falhar, o livro
      // inteiro. Título de capítulo muda (a limpeza com IA mexe nele), e
      // desistir por causa disso seria deixar o item errado por formalidade.
      const tituloDoCap = i => ((txtCaps ? txtCaps[i] : livro.chapters[i]) || {}).titulo || ''
      const todos = Array.from({ length: quantosCaps }, (_, i) => i)
      const iDito = todos.findIndex(i => _repNorm(tituloDoCap(i)) === _repNorm(a.cap))
      const ordem = iDito >= 0 ? [iDito, ...todos.filter(i => i !== iDito)] : todos
      if (iDito < 0) rel.semCapitulo++

      let achou = null, comTexto = 0
      for (const i of ordem) {
        const txt = await textoDoCap(i)
        if (!txt) continue
        comTexto++
        const frases = _repFrases(txt).filter(f => _repCasa(a.palavra, f))
        if (!frases.length) continue
        achou = { frase: frases[0].slice(0, 400), quantas: frases.length, cap: tituloDoCap(i) }
        break
      }
      if (!achou) {
        // A PALAVRA NÃO ESTÁ NO LIVRO. Antes de desistir: e se ela nunca
        // esteve? Até 2026-08-08 os chips e a família davam ao item novo a
        // CENA E A OBRA do item de origem — a "fonte ancestral". "tuck into",
        // nascido da família de "tuck", ficava jurando que veio de Billy
        // Summers, com a passagem onde estava o "tuck".
        // ⚠️ NÃO BASTA "não achei no livro" para concluir isso: pode ser
        // grafia partida, aspas curvas, ou uma palavra intercalada
        // ("breeze RIGHT through") que a busca não cobre. A prova é o PARENTE:
        // outro item com a cena IDÊNTICA, e cuja palavra está nela. Cena igual
        // não é coincidência — é herança.
        const pai = _repAncestral(a)
        if (pai) {
          rel.ancestrais++
          if (rel.amostras.length < 12) {
            rel.amostras.push({ palavra: a.palavra, ancestral: pai.word,
              antes: a.contextoAtual.slice(0, 70),
              depois: `procedência corrigida: ${OBRA_ESTUDO} · ${pai.word} (a cena era do "${pai.word}", não desta expressão)` })
          }
          if (!simular) {
            const dono = a.m || a.w
            // Não há cena autêntica para devolver: esta expressão não estava
            // na página. Manter a frase do parente é o que criou a mentira.
            dono.context = ''
            dono.context_pt = ''
            dono.source_type = 'manual'
            dono.source_title = OBRA_ESTUDO
            dono.source_context = pai.word || ''
          }
          rel.consertados++
          if (aoAndar) aoAndar(rel.consertados, diag.total)
          continue
        }
        rel.naoAchados++
        // O MOTIVO, e ele importa: "não achei a palavra" e "não consegui ler o
        // livro" pedem ações opostas — reimportar o arquivo, ou aceitar que o
        // item veio de outro lugar. Sem distinguir, o relatório mente por
        // omissão.
        rel.perdidos.push({ palavra: a.palavra, obra, cap: a.cap,
          motivo: falhaLeitura ? 'o livro não abriu direito: ' + falhaLeitura
                : !comTexto ? `nenhum dos ${quantosCaps} capítulos rendeu texto — reimporte o arquivo`
                : 'a palavra não aparece em lugar nenhum do livro' })
        continue
      }

      // ⚠️ QUANDO A PALAVRA APARECE VÁRIAS VEZES NO CAPÍTULO, não há como saber
      // qual delas ele marcou — a informação se perdeu junto com o contexto.
      // Fica a primeira, e o relatório diz quantas eram. Mesmo no pior caso é
      // uma frase REAL do livro contendo a palavra, contra uma abertura de
      // capítulo que não a contém: a troca vale sempre.
      if (achou.quantas === 1) rel.unicos++; else rel.ambiguos++
      if (rel.amostras.length < 12) {
        rel.amostras.push({ palavra: a.palavra, antes: a.contextoAtual.slice(0, 70),
                            depois: achou.frase.slice(0, 90), ocorrencias: achou.quantas })
      }
      if (!simular) {
        const dono = a.m || a.w
        dono.context = achou.frase
        // ⚠️ A TRADUÇÃO ERA DA FRASE ERRADA. Mantê-la seria trocar um erro
        // visível por um pior: frase certa em cima da tradução de outra coisa.
        // Vazio o app sabe tratar; incoerente, não.
        dono.context_pt = ''
        if (achou.cap && a.cap && _repNorm(achou.cap) !== _repNorm(a.cap)) dono.source_context = achou.cap
      }
      feitos++; rel.consertados++
      if (aoAndar) aoAndar(rel.consertados, diag.total)
    }
    rel.obras.push({ obra, itens: itens.length, estado: `${feitos} localizados` })
  }

  if (!simular && rel.consertados) {
    if (typeof saveWords === 'function') saveWords()
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  }
  return rel
}

// ================================================================
// A OBRA COMO MEMÓRIA — a Lexa que leu o livro
// ================================================================
// Até aqui a Lexa via UM parágrafo. Ela não sabia quem é um personagem, nem se
// a palavra já tinha aparecido antes, nem que aquele nome volta no capítulo
// seguinte. E o material para saber já é nosso: o EPUB inteiro está no
// `BookDB`, e o app não precisa pedir nada a ninguém para procurar dentro dele.
//
// Sem embeddings de propósito: eles custariam uma chamada por trecho e um
// índice para guardar. A busca por LEMA que o reparo já usa (`_repCasa`)
// resolve o caso de uso — ela acha "fell" procurando "fall" e aguenta o
// phrasal partido pelo objeto.
//
// ⚠️⚠️ A REGRA QUE MANDA AQUI É O SPOILER.
// Trazer um trecho do capítulo 30 para quem está no 11 estraga o livro — e
// estragar o livro de alguém é pior do que não ajudar. O teto não é o capítulo
// ABERTO, é o mais longe que ele já leu (`livro.pos.cap`), que fica gravado por
// livro: assim o Estudar, que não tem "capítulo atual", respeita a mesma
// fronteira. Nenhuma função daqui aceita ser chamada sem esse teto.

const _obrTexto = new Map()          // livroId|capIdx → texto limpo do capítulo
const _obrLivro = new Map()          // livroId → { ep, txtCaps, nCaps }

function obraAteOndeLeu(livro) {
  if (!livro) return -1
  const n = (livro.chapters || []).length
  const p = (livro.pos && Number(livro.pos.cap)) || 0
  return Math.max(0, Math.min(p, n - 1))
}

async function _obrAbrir(livro) {
  if (_obrLivro.has(livro.id)) return _obrLivro.get(livro.id)
  // A memória da obra também busca na nuvem: sem isto, o Estudar continuaria
  // dizendo "não está neste aparelho" mesmo com o livro guardado lá.
  let blob = await BookDB.get(livro.id)
  if (!blob && typeof livroGarantirLocal === 'function') blob = await livroGarantirLocal(livro.id)
  if (!blob) throw new Error('o arquivo do livro não está neste aparelho nem na sua nuvem')
  const buf = await blob.arrayBuffer()
  let dados
  if (livro.format === 'epub') {
    const ep = await epubAbrir(buf)
    dados = { ep, nCaps: (livro.chapters || []).length }
  } else {
    const txt = new TextDecoder('utf-8').decode(buf)
    const ehHtml = /^\s*(<!doctype html|<html)/i.test(txt)
    const caps = textoParaCapitulos(ehHtml ? epubTextoLimpo(txt) : txt)
    dados = { txtCaps: caps, nCaps: caps.length }
  }
  _obrLivro.set(livro.id, dados)
  return dados
}

async function obraTextoCap(livro, i) {
  const k = livro.id + '|' + i
  if (_obrTexto.has(k)) return _obrTexto.get(k)
  let t = ''
  try {
    const d = await _obrAbrir(livro)
    if (d.txtCaps) t = _repEspacos(epubTextoLimpo((d.txtCaps[i] || {}).html || ''))
    else {
      const c = (livro.chapters || [])[i]
      const html = c && c.href ? await d.ep.zip.texto(c.href) : ''
      t = html ? _repEspacos(epubTextoLimpo(html)) : ''
    }
  } catch (e) { throw e }
  _obrTexto.set(k, t)
  return t
}

// A BUSCA. Devolve as frases onde o termo aparece, do capítulo mais recente
// para o mais antigo — o que ele leu ontem lembra mais que o do mês passado.
async function obraBuscar(livro, termo, { ateCap, maxTrechos = 3 } = {}) {
  const vazio = { total: 0, caps: 0, trechos: [], limite: ateCap }
  if (!livro || !String(termo || '').trim()) return vazio
  const teto = Number.isInteger(ateCap) ? ateCap : obraAteOndeLeu(livro)
  if (teto < 0) return vazio
  let total = 0, caps = 0
  const trechos = []
  for (let i = teto; i >= 0; i--) {          // do mais recente para trás
    let txt = ''
    try { txt = await obraTextoCap(livro, i) } catch (e) { break }
    if (!txt) continue
    const achadas = _repFrases(txt).filter(f => _repCasa(termo, f))
    if (!achadas.length) continue
    caps++; total += achadas.length
    for (const f of achadas) {
      if (trechos.length >= maxTrechos) break
      trechos.push({ cap: i, titulo: (((livro.chapters || [])[i]) || {}).titulo || `Parte ${i + 1}`,
                     frase: f.slice(0, 300) })
    }
  }
  return { total, caps, trechos, limite: teto }
}

// ---- O que aparece na tela --------------------------------------
// Um bloco discreto, embaixo da explicação: quantas vezes já apareceu no que
// ele JÁ LEU, e os trechos. No leitor, clicar leva ao capítulo.
function obraBlocoHTML(r, { noLeitor } = {}) {
  if (!r || !r.total) return ''
  const nCap = r.caps === 1 ? 'num capítulo' : `em ${r.caps} capítulos`
  return `<div class="obra-eco">
    <div class="obra-eco-cab">${ic('bookOpen','ic-sm')} já apareceu no que você leu
      <span>${r.total}× ${nCap}</span></div>
    ${r.trechos.map(t => `<div class="obra-eco-tr">
      ${noLeitor
        ? `<button class="obra-eco-ir" onclick="obraIrAoCapitulo(${t.cap})" data-tip="Abrir este capítulo">${esc(t.titulo)}</button>`
        : `<i>${esc(t.titulo)}</i>`}
      <p>${escB(t.frase)}</p>
    </div>`).join('')}
  </div>`
}

function obraIrAoCapitulo(i) {
  if (typeof lerIrParaCapitulo !== 'function' || !_lerLivro) return
  if (typeof _selMenuFechar === 'function') _selMenuFechar()
  lerIrParaCapitulo(i, 0)
}

// Busca e pinta, sem segurar a explicação: o eco entra quando chegar.
// ⚠️ A frase ATUAL não conta como "já apareceu": ela é onde ele está agora, e
// listá-la faria o bloco dizer que a palavra tem eco quando ela é estreia.
async function obraMontarEco(corpo, { livro, termo, atual, noLeitor }) {
  if (!corpo || !livro || !termo) return null
  let r = null
  try { r = await obraBuscar(livro, termo, { maxTrechos: 4 }) } catch (e) { return null }
  const agora = _repNorm(atual || '')
  r.trechos = r.trechos.filter(t => _repNorm(t.frase) !== agora)
  if (agora && r.total > 0) r.total = Math.max(0, r.total - 1)   // a atual sai da conta
  if (!r.total || !r.trechos.length) return r
  if (corpo.isConnected) corpo.insertAdjacentHTML('beforeend', obraBlocoHTML(r, { noLeitor }))
  return r
}

// O que vai para a IA: os trechos anteriores, para a explicação poder dizer se
// o sentido de agora é o MESMO de antes ou outro. É a pergunta que só quem leu
// o livro inteiro consegue responder — e agora o app leu.
function obraContextoParaIA(r) {
  if (!r || !r.trechos || !r.trechos.length) return ''
  return `\nESTA EXPRESSÃO JÁ APARECEU no que ele leu deste livro:\n${
    r.trechos.map(t => `- (${t.titulo}) "${t.frase}"`).join('\n')}\nSe o sentido AQUI for o mesmo de antes, diga isso em meia frase. Se for OUTRO, avise — é a armadilha que faz o aluno ler a página errada.`
}

// O livro de um item, pelo título bruto que ele guardou.
function obraDoItem(w, m) {
  if (typeof livros === 'undefined' || !Array.isArray(livros)) return null
  const t = _repNorm(obraNome((m && m.source_title) || (w && w.source_title) || ''))
  if (!t) return null
  return livros.find(l => _repNorm(obraNome(l.title)) === t || _repNorm(l.title) === t) || null
}
