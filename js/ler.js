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
  largura: 34, modo: 'pag', pintar: 'minhas',
  // `traduzir`: o que acontece no instante em que a seleção termina.
  //   'auto' — a frase inteira já vem traduzida dentro do popup (padrão)
  //   'menu' — só o menu de sempre, tradução nenhuma (para quem não quer gastar)
  traduzir: 'auto',
  // `arrumar`: a faxina do texto do livro (ver `_lerArrumar`). Nasce LIGADA
  // porque o livro torto é a regra, não a exceção — mas é desligável, e
  // desligada mostra o arquivo como ele veio, para comparar.
  arrumar: 'sim'
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
  const hdr = el('ler-header'); if (hdr) hdr.style.display = ''

  // A ESTANTE MUDOU DE CASA (2026-08-20). Deixou de ser uma grade de capas e
  // virou o gerenciador do acervo — busca, filtros, ficha, cadastro de livro
  // sem arquivo, calendário de leitura. Tudo isso mora em `js/estante.js`,
  // que carrega no mesmo pacote lazy desta seção e ANTES deste arquivo.
  if (typeof estanteRender === 'function') { estanteRender(); return }
  area.innerHTML = `<div class="est-nada"><p>A estante não carregou.
    Recarregue a página — se insistir, o arquivo <code>js/estante.js</code> não chegou.</p></div>`
}

function lerEscolherArquivo() {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = '.epub,.cbz,.txt,.html,.htm,application/epub+zip,application/vnd.comicbook+zip,text/plain,text/html'
  inp.multiple = true
  inp.onchange = () => lerImportar(inp.files)
  inp.click()
}

async function lerImportar(files) {
  const lista = [...(files || [])]
  if (!lista.length) return
  const novos = []
  for (const f of lista) {
    try { const id = await _lerImportarUm(f); if (id) novos.push(id) }
    catch (e) {
      console.warn('[ler] importação falhou:', e)
      toast(`"${f.name}": ${e.message}`, 'error')
    }
  }
  saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  renderLerSection()
  // O CATÁLOGO COMPLETA O QUE O ARQUIVO NÃO TROUXE (ano, editora, páginas,
  // gênero, sinopse e, quando não há capa, a capa). Em segundo plano: a
  // estante já está na tela e ninguém espera pela rede.
  if (typeof estAutoCompletar === 'function' && novos.length) estAutoCompletar(novos)
}

// A LEITURA DO ARQUIVO GANHOU FUNÇÃO PRÓPRIA (2026-08-20) porque agora ela
// serve a dois donos: a IMPORTAÇÃO (que cria um livro novo) e o ANEXO (que
// preenche um livro que já está na estante). Deixá-la dentro da importação
// obrigaria o anexo a copiar o parser inteiro — duas cópias da mesma regra,
// e uma delas envelheceria.
async function _lerMetaDoArquivo(file) {
  const buf = await file.arrayBuffer()
  const u8 = new Uint8Array(buf.slice(0, 4))
  const ehZip = u8[0] === 0x50 && u8[1] === 0x4b   // "PK"

  let meta
  if (ehZip) {
    // ⚠️ CBZ TAMBÉM COMEÇA COM "PK". Decidir só pelos 4 primeiros bytes
    // mandaria todo mangá para o parser de EPUB, que morreria procurando um
    // `container.xml` que não existe. Quem decide é o CONTEÚDO, não a extensão.
    const zipCru = await zipAbrir(buf)
    if (mangaEhCbz(zipCru)) {
      meta = await mangaMeta(zipCru, file.name)
    } else {
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
  return { ...meta, buf }
}

async function _lerImportarUm(file) {
  const id = uid()
  toast(`Lendo "${file.name}"…`, 'info')
  const meta = await _lerMetaDoArquivo(file)

  await BookDB.set(id, new Blob([meta.buf]))
  // Sobe em segundo plano: importar um livro não pode ficar esperando rede, e
  // se falhar ele continua com o arquivo aqui — a próxima abertura tenta de novo.
  if (typeof livroGarantirNaNuvem === 'function') livroGarantirNaNuvem(id)
  livros.push({
    id, title: meta.title, author: meta.author, lang: meta.lang,
    format: meta.format, chapters: meta.chapters, cover: meta.cover,
    totalWords: meta.chapters.reduce((s, c) => s + (c.words || 0), 0),
    totalChars: meta.chapters.reduce((s, c) => s + (c.chars || 0), 0),
    pos: { cap: 0, frac: 0 }, progress: 0, notes: [],
    minutos: 0, addedAt: Date.now(), updatedAt: Date.now(), lastOpen: 0,
    // Campos do gerenciador (2026-08-20). Nascem preenchidos para o livro novo
    // não depender da migração — que existe para o acervo que já estava aqui.
    kind: 'arquivo', status: 'quero', historico: [], tags: [], nota: 0,
    paginas: 0, pagAtual: 0, genero: '', editora: '', isbn: '', ano: '',
    serie: '', serieNum: '', resumo: '', coverUrl: '', inicio: null, fim: null,
    // A SÉRIE SE RESOLVE NA ENTRADA. Mangá chega em lote de dezenas de `.cbz`
    // ("One Piece v12.cbz"), e pedir que ele digite série e número quarenta
    // vezes seria transformar organização em trabalho braçal. O nome do
    // ARQUIVO é a fonte — o metadado interno do CBZ raramente traz volume.
    ...(function () {
      if (typeof estSerieDoNome !== 'function') return {}
      const d = estSerieDoNome(file.name, meta.format === 'manga')
      return d ? { serie: d.serie, serieNum: d.num } : {}
    })()
  })
  toast(`"${meta.title}" entrou na estante`, 'success')
  // O NOME LIMPO SE RESOLVE NA ENTRADA, não num botão lá adiante.
  // O metadado do EPUB traz "(US Edition)", "Unabridged", o nome do arquivo —
  // e a captura carimba esse título em CADA item. Resolvendo aqui, tudo que
  // sair deste livro já nasce com o nome certo na tela, e a estante também.
  if (typeof resolverNomesDeObra === 'function' && aiChatCfg().key) {
    resolverNomesDeObra([meta.title])
      .then(n => { if (n) renderLerSection() })
      .catch(e => console.warn('[obra] não resolvi o título:', e && e.message))
  }
  return id
}

// ================================================================
// ANEXAR O ARQUIVO A UM LIVRO QUE JÁ ESTÁ NA ESTANTE
// ================================================================
// Pedido dele: *"ter uma opção que sobe o áudio ou epub dentro do que já está
// carregado. ele só se encaixa nos metadados."* É o fluxo de quem organiza a
// estante antes de ter o arquivo: primeiro entra a ficha (pelo catálogo, com
// capa e sinopse), o EPUB chega depois.
//
// ⚠️ O QUE NÃO PODE ACONTECER É NASCER UM SEGUNDO LIVRO. Importar pelo caminho
// normal criaria um item novo, e o antigo ficaria com a nota, o histórico de
// leitura e a série apontando para lugar nenhum. Aqui o arquivo ENTRA no item
// existente: capítulos, formato e tipo mudam; título, autor, série, status,
// notas e histórico ficam como estavam.
function lerAnexarArquivo(id) {
  const l = livroPorId(id); if (!l) return
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = '.epub,.cbz,.txt,.html,.htm,application/epub+zip,application/vnd.comicbook+zip,text/plain,text/html'
  inp.onchange = () => _lerAnexar(id, inp.files && inp.files[0])
  inp.click()
}

async function _lerAnexar(id, file) {
  const l = livroPorId(id)
  if (!l || !file) return
  toast(`Lendo "${file.name}"…`, 'info')
  try {
    const meta = await _lerMetaDoArquivo(file)
    await BookDB.set(id, new Blob([meta.buf]))
    if (typeof livroGarantirNaNuvem === 'function') livroGarantirNaNuvem(id)

    l.kind = 'arquivo'
    l.format = meta.format
    l.chapters = meta.chapters
    l.totalWords = meta.chapters.reduce((s, c) => s + (c.words || 0), 0)
    l.totalChars = meta.chapters.reduce((s, c) => s + (c.chars || 0), 0)
    if (!l.cover && meta.cover) l.cover = meta.cover
    if (!l.author && meta.author) l.author = meta.author
    if (meta.lang) l.lang = meta.lang

    // A leitura que ele já registrou no papel vira o ponto de partida do
    // leitor. Zerar aqui seria punir justamente quem organizou a estante
    // antes de ter o arquivo.
    if (!l.progress && l.paginas > 0 && l.pagAtual > 0) {
      l.progress = Math.max(0, Math.min(1, l.pagAtual / l.paginas))
      const caps = l.chapters, total = l.totalChars || 1
      let acc = 0, i = 0
      for (; i < caps.length; i++) {
        const parte = (caps[i].chars || 0) / total
        if (acc + parte >= l.progress) break
        acc += parte
      }
      i = Math.min(i, caps.length - 1)
      const parte = (caps[i].chars || 0) / total
      l.pos = { cap: i, frac: parte ? Math.max(0, Math.min(1, (l.progress - acc) / parte)) : 0 }
    }
    l.updatedAt = Date.now()
    saveLivros()
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
    toast(`Arquivo anexado — ${meta.chapters.length} ${meta.chapters.length === 1 ? 'capítulo' : 'capítulos'}`, 'success')
    renderLerSection()
  } catch (e) {
    console.warn('[ler] anexo falhou:', e)
    toast('Não consegui ler esse arquivo: ' + e.message, 'error')
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
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Apagar <b>${esc(obraNome(l.title))}</b>${
             l.kind === 'fisico'
               ? ', com o histórico de leitura dele'
               : ' e o arquivo deste aparelho'}.
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
  // ⚠️ E QUANDO NÃO VEM, DIZER O MOTIVO CERTO. A frase antiga ("nem na sua
  // nuvem") era dita até quando o app estava DESLOGADO e não tinha como olhar
  // — foi o que aconteceu com o Billy Summers, cujo arquivo estava lá o tempo
  // todo. Quem sabe o motivo é o shell (`nuvemDiagnostico`), e a frase vem de
  // lá para leitor, vídeo e podcast dizerem a mesma coisa.
  const logado = typeof _fbUser !== 'undefined' && !!_fbUser
  if (!blob && typeof livroGarantirLocal === 'function' && logado) {
    toast('Buscando o arquivo na sua nuvem…', 'info')
    blob = await livroGarantirLocal(id)
    if (blob) toast(`"${l.title}" baixado para este aparelho`, 'success')
  }
  if (!blob) {
    let frase = 'O arquivo deste livro não está neste aparelho. Importe-o de novo.'
    if (typeof livroPorQueNaoVeio === 'function' && typeof nuvemFrase === 'function') {
      frase = nuvemFrase(await livroPorQueNaoVeio(id), `o arquivo de "${l.title}"`)
    }
    toast(frase, 'warning')
    return
  }
  // Guarda a subida para o caso do livro ter entrado antes de existir nuvem.
  if (typeof livroGarantirNaNuvem === 'function') livroGarantirNaNuvem(id)
  const buf = await blob.arrayBuffer()
  try {
    // ⚠️ `manga` PRECISA ESTAR AQUI. Sem ele o CBZ caía no ramo de baixo e o
    // ZIP era decodificado como UTF-8: a tela enchia de caracteres quebrados.
    // Foi o que aconteceu no primeiro volume de verdade — e não apareceu nos
    // meus testes porque eu tinha exercitado as funções soltas, nunca a
    // ABERTURA pelo app. Testar a peça não é testar o caminho.
    if (l.format === 'epub' || l.format === 'manga') {
      const zipCru = await zipAbrir(buf)
      _lerEpub = (l.format === 'manga' || mangaEhCbz(zipCru))
        ? { manga: await mangaAbrir(buf) }
        : await epubAbrir(buf)
      // A FOLHA DO LIVRO É LIDA UMA VEZ, NA ABERTURA. É dela que sai o
      // itálico que o app jogava fora a cada capítulo (ver `_lerSanitizar`).
      // Falhar aqui não pode impedir a leitura: sem mapa, o texto entra como
      // entrava antes.
      if (!_lerEpub.manga) {
        try { _lerEpub.estilos = await epubEstilos(_lerEpub) }
        catch (e) { console.warn('[ler] folha do livro:', e && e.message) }
      }
    } else {
      const txt = new TextDecoder('utf-8').decode(buf)
      const ehHtml = /^\s*(<!doctype html|<html)/i.test(txt)
      _lerEpub = { txtCaps: textoParaCapitulos(ehHtml ? epubTextoLimpo(txt) : txt) }
    }
  } catch (e) {
    toast('Não consegui abrir: ' + e.message, 'error'); return
  }
  _lerLivro = l
  // ⚠️ NOME DESCOBERTO É DE UM LIVRO SÓ. Sem zerar aqui, o "Rita Hayworth"
  // achado no capítulo 9 de um livro apareceria no capítulo 9 do próximo —
  // a chave do cache é o ÍNDICE, e índice todo livro tem.
  _lerNomesAuto = {}
  _lerVazios = new Set()
  _lerSemCabecalho = new Set()
  _lerMapaCache = null
  _lerSumarioBusca = ''
  _lerSumarioAbre = {}
  _lerCap = Math.min(l.pos?.cap || 0, l.chapters.length - 1)
  if (typeof ondeEstavaSalvar === 'function') ondeEstavaSalvar()
  _lerInicioLeitura = Date.now()
  l.lastOpen = Date.now()
  // Abrir já é começar: sem isto o livro ficaria em "quero ler" para sempre
  // em quem lê pouco por sessão (o status só mudaria ao virar página).
  if (typeof estanteAoAbrir === 'function') estanteAoAbrir(l)
  renderLeitor()
  await lerIrParaCapitulo(_lerCap, l.pos?.frac || 0)
}

function lerFechar() {
  _lerRegistrarTempo()
  _lerSalvarPos(true)
  _lerGravarPendente()
  _lerBlobs.forEach(u => { try { URL.revokeObjectURL(u) } catch (e) {} })
  _lerBlobs = []
  if (typeof mangaDesligarFluxo === 'function') mangaDesligarFluxo()
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

  // O botão só existe onde faz sentido: num mangá com página por ler. Num
  // livro comum ele seria um botão morto na barra, e a barra já está cheia.
  // ⚠️ DOIS BOTÕES COM O MESMO ÍCONE, LADO A LADO, NÃO SÃO DOIS BOTÕES — são
  // um enigma. No mangá a barra tinha o "Ferramentas" e o "Ler o volume", os
  // dois com a varinha, e nada na tela dizia qual era qual.
  //
  // Quem sai é o Ferramentas, e não por causa do ícone: ele mostra as
  // palavras do CAPÍTULO, cobertura de vocabulário e pré-estudo — feito para
  // um capítulo de livro, com milhares de palavras. No mangá o "capítulo" é
  // uma página de duas ou três falas, e cobertura sobre isso não informa
  // nada. Ele volta sozinho em qualquer livro.
  const c_ferramentas = (_lerLivro && _lerLivro.format === 'manga') ? ''
    : `<button class="ler-btn" onclick="lerToggle('ferramentas')" data-tip="Palavras deste capítulo, cobertura e pré-estudo">${ic('sparkles','ic-sm')}</button>`
  // Porta PRÓPRIA para o raio-X: ele estava escondido dentro do painel acima,
  // que abre outra coisa — e a pergunta "como é que ativa isso?" veio dele.
  const c_raiox = (_lerLivro && _lerLivro.format === 'manga') ? ''
    : `<button class="ler-btn" id="ler-raiox-btn" onclick="event.stopPropagation();lerRaioXPainel()"
         data-tip="O que é difícil aqui: acima do seu nível, phrasal verbs e expressões">${ic('eye','ic-sm')}</button>`
  // ⚠️ PORTA PRÓPRIA, PORQUE ELE PERGUNTOU TRÊS VEZES ONDE ELA FICAVA. A revisão
  // estava no topo do sumário — que é o lugar CERTO pela lógica (é ali que o
  // defeito aparece) e o lugar ERRADO na prática: ninguém abre o sumário
  // procurando conserto, abre procurando capítulo. Três "cadê o botão?" não é
  // desatenção dele, é resposta sobre o desenho. Livro já revisado mostra a
  // marca, então a barra também responde "isto aqui já foi feito".
  const c_revisar = (_lerLivro && _lerLivro.format === 'manga') ? ''
    : `<button class="ler-btn${(_lerLivro && _lerLivro.revisao) ? ' ler-btn-feito' : ''}" id="ler-revisar-btn"
         onclick="event.stopPropagation();lerRevisar()"
         data-tip="${(_lerLivro && _lerLivro.revisao)
           ? 'Livro já revisado — clique para revisar de novo'
           : 'Revisar o livro: lê tudo, mostra os defeitos que achou e conserta o sumário'}">${ic('wrench','ic-sm')}</button>`
  // OUVIR JUNTO (§8.92): só faz sentido em livro de texto, e a porta existe
  // mesmo antes de haver audiolivro ligado — é por ela que se liga.
  const c_ouvir = (_lerLivro && _lerLivro.format === 'manga') ? ''
    : `<button class="ler-btn" id="ler-btn-ouvir" onclick="event.stopPropagation();sincLeitorAlternar()"
         data-tip="Ouvir o narrador com o texto do autor acompanhando">${ic('headphones','ic-sm')}</button>`
  // A barra de zoom só no mangá: num livro ela não teria o que ajustar.
  const c_mgbarra = (_lerLivro && _lerLivro.format === 'manga' && typeof mangaBarraHtml === 'function')
    ? mangaBarraHtml() : ''
  const _mgF = (typeof mangaFaltam === 'function') ? mangaFaltam(_lerLivro) : 0
  const c_manga = _mgF
    ? `<button class="ler-btn" id="mg-lote" onclick="mangaLerVolume()" data-tip="Ler os balões das ${_mgF} páginas que faltam — dá para parar no meio, o que já foi lido fica guardado">${ic('sparkles','ic-sm')}</button>`
    : ''
  area.innerHTML = `
    <div class="ler-leitor" data-tema="${c.tema}" data-modo="${c.modo}" data-obra="${escA((_lerLivro && _lerLivro.format) || '')}">
      <div class="ler-barra">
        <button class="ler-btn" onclick="lerFechar()" data-tip="Voltar para a estante">${ic('chevronLeft','ic-sm')}</button>
        <button class="ler-btn ler-titulo" onclick="lerToggle('sumario')" data-tip="Sumário">
          <span id="ler-cap-nome"></span>${ic('chevronDown','ic-sm')}
        </button>
        <div class="ler-barra-dir">
          ${c_manga}
          <button class="ler-btn" onclick="lerToggle('conversa')" data-tip="Conversar com a ${escA(lexaNome())} sobre este livro — quem é quem, onde se passa, o que está acontecendo">${ic('message','ic-sm')}</button>
          ${c_ferramentas}${c_raiox}${c_ouvir}${c_revisar}
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

      ${c_mgbarra}

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
      // No mangá o balão da glosa não pode nascer em cima da fala: o alvo tem
      // várias linhas e o "acima do ponteiro" é o meio do próprio balão que
      // se está lendo. Entregando o retângulo, o glossário o contorna.
      evitar: () => {
        const b = document.querySelector('#ler-conteudo .mg-balao:hover')
        return b ? b.getBoundingClientRect() : null
      },
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
  // O laudo da revisão é painel como os outros: abrir qualquer um fecha ele.
  // Sem esta linha ele ficava por cima do que fosse aberto depois.
  const rev = el('ler-revisao'); if (rev) rev.classList.add('hidden')
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
    ${linha('Texto do livro', [['sim', 'Arrumado'], ['nao', 'Sem faxina']].map(([v, r]) =>
      `<button class="ler-btn ler-pill${v === c.arrumar ? ' on' : ''}" onclick="lerAjustar('arrumar','${v}')"
        data-tip="${v === 'sim'
          ? 'Fecha os buracos em branco, tira o recuo feito com espaço, junta parágrafo partido no meio e endireita a quebra de cena'
          : 'Desliga a faxina, para comparar. O itálico, o parágrafo e a centralização continuam: isso o app conserta na entrada, e não é palpite'}">${r}</button>`).join('')
      + `<span class="ler-arrumou">${_lerArrumouTexto()}</span>`)}
    ${linha('Destacar', [['nada', 'Nada'], ['minhas', 'O que estou estudando']].map(([v, r]) =>
      `<button class="ler-btn ler-pill${v === c.pintar ? ' on' : ''}" onclick="lerAjustar('pintar','${v}')">${r}</button>`).join(''))}
    ${linha('Ao selecionar', [['auto', 'Traduzir na hora'], ['menu', 'Só o menu']].map(([v, r]) =>
      `<button class="ler-btn ler-pill${v === c.traduzir ? ' on' : ''}" onclick="lerAjustar('traduzir','${v}')"
        data-tip="${v === 'auto'
          ? 'Marcou com o mouse, a frase inteira já vem traduzida — com o que você marcou em destaque'
          : 'Só o menu de sempre. Nenhuma chamada de IA sai sem você clicar'}">${r}</button>`).join(''))}
    <div class="ler-tip-nota">Dica: <b>duplo-clique</b> numa palavra manda ela para o Preparar com a frase.
      Selecione um trecho e a frase já aparece traduzida ali mesmo — o menu continua abrindo para
      explicar, ouvir em voz alta, salvar para estudo ou procurar na Wikipédia.</div>`
}

// O QUE O BOTÃO FEZ NESTE CAPÍTULO, em número. Sem isto o "Arrumado" seria um
// ato de fé: ele clica e não tem como saber se mudou alguma coisa.
function _lerArrumouTexto() {
  const r = _lerArrumouRel
  if (!r) return ''
  if (!r.ligado) return 'mostrando o original'
  const partes = []
  if (r.virados) partes.push(`${r.virados} parágrafos remontados`)
  if (r.vazios)  partes.push(`${r.vazios} buracos`)
  if (r.junta)   partes.push(`${r.junta} emendas`)
  if (r.hifen)   partes.push(`${r.hifen} palavras remendadas`)
  if (r.nbsp)    partes.push(`${r.nbsp} recuos`)
  if (r.cena)    partes.push(`${r.cena} quebras de cena`)
  if (r.br)      partes.push(`${r.br} rajadas de linha`)
  if (r.pagina)  partes.push(`${r.pagina} números de página`)
  if (r.ancora)  partes.push(`${r.ancora} marcas invisíveis`)
  return partes.length ? 'neste capítulo: ' + partes.join(', ') : 'este capítulo já estava limpo'
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
  // ⚠️ ARRUMAR NÃO É TIPOGRAFIA: não basta repintar, o capítulo tem de ser
  // MONTADO de novo — a limpeza acontece no HTML, antes de chegar à tela. Como
  // a remontagem já leva a fração junto, ela sai por aqui e não cai no
  // reposicionamento comum lá embaixo.
  if (chave === 'arrumar') {
    lerIrParaCapitulo(_lerCap, frac).then(() => _lerRenderTipografia())
    return
  }
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
  // ⚠️ NO MANGÁ O "CAPÍTULO" É O VOLUME INTEIRO. Cada página ser um capítulo
  // isolado obrigava a um clique entre páginas — 180 interrupções por volume,
  // e foi o que ele apontou. Aqui sai o fluxo completo, e navegar vira rolar.
  if (_lerEpub.manga) return mangaHtmlDoVolume(_lerEpub.manga, _lerLivro)
  if (_lerEpub.txtCaps) return _lerEpub.txtCaps[i] ? _lerEpub.txtCaps[i].html : ''
  const c = _lerLivro.chapters[i]
  if (!c || !c.href) return ''
  const html = await _lerEpub.zip.texto(c.href)
  return html ? await _lerSanitizar(html, c.href) : ''
}

// O HTML vem de um arquivo de terceiro: entra na página SEM script, sem
// folha de estilo do editor (a tipografia é NOSSA — é o ponto do módulo) e
// sem handler inline. As imagens viram blob: do próprio zip.
//
// ⚠️ MAS TIRAR A CLASSE TIRAVA O SENTIDO JUNTO, E ERA ISSO QUE DEIXAVA LIVRO
// FEIO. Relato dele: *"os livros muitas vezes vêm com a formatação muito feia
// e bagunçada"*. Medido nos 10 livros dele, não era o arquivo:
//
//   Different Seasons . 4,2 parágrafos-`<div>` por mil chars → o app não dá
//                       espaço a `div`, e o livro virava um TIJOLO de texto
//   Bag of Bones ...... 380 `<span class="txit">` = todo o itálico do King
//   A Game of Thrones .. 168 itálicos, The Green Mile 112
//   The Stand ..........  69 quebras de cena centralizadas
//
// Então são DUAS camadas, e elas são coisas diferentes:
//
//   1. RECUPERAR (sempre) — ler a folha do livro, traduzir o punhado de
//      classes que carregam sentido (itálico, negrito, centro, recuo) para
//      marcação NOSSA, e só então descartar a do editor. Conserto de entrada:
//      não tem botão porque não tem por que estar errado.
//   2. ARRUMAR (botão) — a limpeza do que é sujeira mesmo: buraco vazio,
//      rajada de <br>, recuo feito com &nbsp;, parágrafo partido no meio,
//      âncora de número de página. Isto é palpite bem-informado, não verdade,
//      então é ligável e desligável — e continua existindo depois do conserto
//      acima, porque sempre vai chegar livro torto.
async function _lerSanitizar(html, capHref) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,link,meta,title,iframe,object,embed,form,input,button,video,audio,svg').forEach(e => e.remove())
  const base = _dir(capHref)

  // ---- 1. o sentido é lido ANTES de a classe morrer ----
  const guardado = new Map()   // elemento → classes nossas
  const estilos = (_lerEpub && _lerEpub.estilos) || new Map()
  for (const e of doc.body.querySelectorAll('[class],[style]')) {
    const sem = {}
    for (const cl of (e.getAttribute('class') || '').split(/\s+/)) {
      const d = estilos.get(cl)
      if (d) Object.assign(sem, d)
    }
    const st = (e.getAttribute('style') || '').toLowerCase()
    if (st) Object.assign(sem, _cssSentido(_cssDeclaracoes(st)) || {})
    const nossas = _lerClassesDoSentido(e, sem)
    if (nossas.length) guardado.set(e, nossas)
  }

  // ---- 2. agora sim, fora tudo que veio de fora ----
  for (const e of [...doc.body.querySelectorAll('*')]) {
    for (const at of [...e.attributes]) {
      const n = at.name.toLowerCase()
      if (n.startsWith('on') || n === 'style' || n === 'class' || n === 'id') e.removeAttribute(at.name)
    }
  }
  for (const [e, cls] of guardado) if (e.isConnected) e.classList.add(...cls)

  // ---- 3. parágrafo que se disfarçou de <div> vira parágrafo ----
  // ⚠️ ESTE É O CONSERTO DO PIOR LIVRO DELE. `.ler-conteudo p` tem margem;
  // `div` não tem nenhuma — e um livro inteiro composto em `<div class="pi">`
  // (Different Seasons) chegava sem UMA linha em branco entre parágrafos.
  let virados = 0
  for (const d of [...doc.body.querySelectorAll('div')]) {
    if (d.querySelector('p,div,h1,h2,h3,h4,h5,h6,ul,ol,table,blockquote')) continue
    if (!d.textContent.trim()) continue
    const p = doc.createElement('p')
    for (const at of [...d.attributes]) p.setAttribute(at.name, at.value)
    while (d.firstChild) p.appendChild(d.firstChild)
    d.replaceWith(p)
    virados++
  }

  // ---- 4. a limpeza opcional ----
  const rel = (lerCfg().arrumar !== 'nao') ? _lerArrumar(doc) : null
  _lerArrumouRel = { virados, ...(rel || {}), ligado: lerCfg().arrumar !== 'nao' }

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

// O que o livro dizia → o que NÓS escrevemos. Duas recusas importam aqui:
// não repetir o que a etiqueta já diz (negrito num `<h2>`, itálico num `<em>`)
// e não deixar `body`/`html` empurrarem o texto inteiro para a direita — o
// `body.calibre { margin-left }` de conversão de Calibre faria exatamente isso.
const _LER_BLOCO = /^(p|div|h[1-6]|blockquote|li|td|th|section|article|figcaption)$/i
function _lerClassesDoSentido(e, sem) {
  const tag = e.tagName.toLowerCase()
  if (tag === 'body' || tag === 'html') return []
  const out = []
  const cabecalho = /^h[1-6]$/.test(tag)
  if (sem.it && !/^(i|em)$/.test(tag)) out.push('ler-it')
  if (sem.neg && !/^(b|strong)$/.test(tag) && !cabecalho) out.push('ler-neg')
  if (sem.vs) out.push('ler-vs')
  if (_LER_BLOCO.test(tag)) {
    if (sem.centro) out.push('ler-centro')
    else if (sem.dir) out.push('ler-dir')
    if (sem.rec && !cabecalho) out.push('ler-bloco')
  }
  return out
}

// ---------------------------------------------------------------
// ARRUMAR — a faxina que o botão liga e desliga
// ---------------------------------------------------------------
// Cada regra aqui é um palpite sobre INTENÇÃO, e é por isso que existe botão:
// palpite tem de poder ser desligado. Todas contam quanto mexeram, e a conta
// aparece no painel Aa — sem isso o botão seria fé.
let _lerArrumouRel = null

// O último nó de texto de um elemento — é nele que mora o hífen da margem.
function _lerUltimoTexto(e) {
  const c = (e.ownerDocument || document).createTreeWalker(e, NodeFilter.SHOW_TEXT)
  let ultimo = null, n
  while ((n = c.nextNode())) if (n.nodeValue.trim()) ultimo = n
  return ultimo
}

function _lerArrumar(doc) {
  const rel = { vazios: 0, cena: 0, br: 0, nbsp: 0, junta: 0, hifen: 0, ancora: 0, pagina: 0 }
  const corpo = doc.body

  // âncoras de número de página: `<a id="page_246"/>` já perdeu o id acima e
  // sobrou como elemento vazio no meio da frase
  for (const a of [...corpo.querySelectorAll('a')]) {
    if (a.textContent.trim() || a.querySelector('img') || a.getAttribute('href')) continue
    a.remove(); rel.ancora++
  }
  for (const s of [...corpo.querySelectorAll('span,font,small,big,u,tt')]) {
    if (!s.attributes.length && !s.textContent.trim() && !s.querySelector('img')) s.remove()
  }

  // rajada de <br>: três ou mais é alguém pedindo espaço, não quebra de linha
  for (const br of [...corpo.querySelectorAll('br')]) {
    if (!br.isConnected) continue
    let n = 1, p = br.nextSibling
    const fila = [br]
    while (p) {
      if (p.nodeType === 3 && !p.nodeValue.trim()) { p = p.nextSibling; continue }
      if (p.nodeType === 1 && p.tagName === 'BR') { fila.push(p); n++; p = p.nextSibling; continue }
      break
    }
    if (n >= 3) { fila.forEach(x => x.remove()); rel.br++ }
  }

  const blocos = () => [...corpo.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,blockquote')]

  // separador de cena escrito à mão (* * *, # # #, ~~~) ganha forma de
  // separador em vez de virar uma linha solta e torta no meio da coluna
  for (const b of blocos()) {
    const t = b.textContent.replace(/[\s\u00a0]+/g, '')
    if (!t || t.length > 12 || b.querySelector('img')) continue
    if (!/^[*#~•·°◆■□—––—•⁂✱-]+$/.test(t)) continue
    b.classList.add('ler-cena'); rel.cena++
  }

  // Linha que é só o número da página (herança de digitalização).
  // ⚠️ ESCONDIDA, NUNCA APAGADA. O "ler ouvindo" casa livro e narração
  // contando PALAVRAS, e o mapa é feito sobre o arquivo cru — apagar um "246"
  // daqui adiantaria a frase acesa em uma palavra a cada página, e o erro
  // soma. Escondido, ele some da vista e continua contando igual dos dois lados.
  for (const b of blocos()) {
    const t = b.textContent.trim()
    if (/^\d{1,4}$/.test(t) && !b.querySelector('img')) { b.classList.add('ler-oculto'); rel.pagina++ }
  }

  // recuo feito com espaço-duro no começo do parágrafo: some, porque quem dá
  // o recuo aqui é o CSS do leitor
  const cam = doc.createTreeWalker(corpo, NodeFilter.SHOW_TEXT)
  const textos = []
  for (let n = cam.nextNode(); n; n = cam.nextNode()) textos.push(n)
  for (const n of textos) {
    if (n.nodeValue.indexOf('\u00a0') < 0) continue
    const novo = n.nodeValue.replace(/\u00a0{2,}/g, ' ').replace(/^[\s\u00a0]+/, m => m.includes('\u00a0') ? '' : m)
    if (novo !== n.nodeValue) { n.nodeValue = novo; rel.nbsp++ }
  }

  // bloco vazio: buraco branco no meio da leitura. O primeiro de uma sequência
  // vira um respiro medido; os seguintes saem.
  let anterior = null
  for (const b of blocos()) {
    if (b.textContent.trim() || b.querySelector('img')) { anterior = null; continue }
    if (anterior || !b.previousElementSibling || !b.nextElementSibling) { b.remove(); rel.vazios++; continue }
    b.textContent = ''
    b.classList.add('ler-respiro')
    anterior = b; rel.vazios++
  }

  // parágrafo partido no meio da frase (dano clássico de PDF virando EPUB):
  // o anterior termina sem pontuação e o seguinte começa em minúscula
  const ps = [...corpo.querySelectorAll('p')]
  for (let i = ps.length - 1; i > 0; i--) {
    const a = ps[i - 1], b = ps[i]
    if (!a.isConnected || !b.isConnected) continue
    if (a.querySelector('img') || b.querySelector('img')) continue
    if (a.className || b.className) continue
    const ta = a.textContent.trim(), tb = b.textContent.trim()
    if (ta.length < 40 || tb.length < 2) continue
    if (!/^[a-zà-ú]/.test(tb)) continue            // o seguinte começa em minúscula
    // PALAVRA CORTADA PELA MARGEM DA PÁGINA IMPRESSA ("leva-" + "ram"). Medido
    // num livro OCR de verdade do acervo dele: 10 num capítulo só, e sem isto
    // ele lê "leva-" e "ram" como duas palavras.
    const hifenada = /[a-zà-ú]-$/.test(ta)
    if (!hifenada && !/[a-zà-ú,;]$/.test(ta)) continue
    if (hifenada) {
      // ⚠️ O HÍFEN É ESCONDIDO, NÃO APAGADO — mesma razão do número de página:
      // o "ler ouvindo" conta palavras e o mapa vem do arquivo cru, onde
      // "leva- ram" são dois pedaços. Escondido, a tela mostra "levaram" e a
      // contagem continua batendo dos dois lados.
      const ultimo = _lerUltimoTexto(a)
      if (ultimo && /-$/.test(ultimo.nodeValue)) {
        ultimo.nodeValue = ultimo.nodeValue.replace(/-$/, '')
        const h = doc.createElement('span')
        h.className = 'ler-oculto'
        h.textContent = '-'
        a.appendChild(h)
      }
      rel.hifen++
    } else {
      a.appendChild(doc.createTextNode(' '))
      rel.junta++
    }
    while (b.firstChild) a.appendChild(b.firstChild)
    b.remove()
  }
  return rel
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
  // Mangá com o fluxo já na tela: "ir para a página 40" é ROLAR até ela, não
  // remontar nada. Remontar perderia as imagens já carregadas e daria um
  // salto branco a cada navegação pelo sumário.
  if (_lerLivro.format === 'manga' && typeof mangaFluxoMontado === 'function'
      && mangaFluxoMontado(_lerLivro)) {
    _lerCap = i
    mangaIrParaPagina(i, false)
    const nm = el('ler-cap-nome')
    if (nm) nm.textContent = _lerLivro.chapters[i].titulo || `Página ${i + 1}`
    _lerAtualizarProgresso()
    return
  }
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
  if (nome) nome.textContent = lerCapNome(i)
  if (_lerEpub.manga) {
    mangaLigarFluxo(_lerEpub.manga, _lerLivro)
    if (i > 0) mangaIrParaPagina(i, false)
  }
  _lerRepintar()
  // O realce do raio-X é reaplicado aqui: o capítulo foi reconstruído do zero,
  // e sem isto o que já tinha sido analisado voltaria apagado.
  lerRaioXAplicar(i).catch(() => {})
  // ⚠️ TROCAR DE CAPÍTULO COM O MODO LIGADO É TROCAR DE MAPA. Sem isto, o
  // texto novo continuaria sendo lido com os instantes do capítulo anterior —
  // a voz falando de uma coisa e a frase acesa apontando outra.
  if (typeof sincTrocouCapitulo === 'function') sincTrocouCapitulo(i)
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
  // ⚠️ NO MANGÁ ESTA REDE VIRA ARMADILHA. Ela existe para o livro: imagem que
  // chega empurra o texto, então por 4s qualquer chegada devolve o leitor ao
  // ponto. No mangá TUDO é imagem e elas chegam o tempo todo — o leitor era
  // puxado de volta a cada página carregada, e o salto pelo sumário não
  // colava. Aqui a posição já tem dono: o número da página.
  _lerAlvoAte = (_lerLivro && _lerLivro.format === 'manga') ? 0 : Date.now() + 4000
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

// ================================================================
// O SUMÁRIO — a lista que diz ONDE ele está, não o que o arquivo tem
// ================================================================
// Relato dele: *"a seção que tem os capítulos não aparece organizada"*. E o
// acervo dele explica: a lista era o índice CRU do EPUB, com tudo que vem
// dentro dele. Medido nos 11 livros:
//
//   A Game of Thrones .. 105 entradas, 8 delas "Parte 1…Parte 8" antes do texto
//   Different Seasons .. a novela de 40 mil palavras chamada "Parte 9", e o
//                        título dela ("1. Hope Springs Eternal") numa entrada
//                        separada de 13 palavras — porque o Calibre partiu o
//                        arquivo em dois
//   The Stand .......... 98 entradas, com "Conents" (o erro de digitação do
//                        próprio editor) e sete peças de miolo editorial
//
// Três coisas resolvem isso, e nenhuma delas inventa nome:
//   1. NOME — quando o índice não deu nome, o nome vem do capítulo (o
//      cabeçalho dele) ou do arquivo (cover, copyright, dedication…).
//   2. GRUPO — antes do texto / o livro / depois do texto. O miolo editorial
//      não fica no meio dos capítulos: fica recolhido, e abre com um clique.
//   3. EMENDA — capítulo de 13 palavras que só carrega o título do seguinte
//      volta a ser uma coisa só.
// Mais a busca, que num livro de 105 capítulos é o que faz a lista servir.

const LER_PPM = 220              // palavras por minuto — leitura em língua estrangeira
let _lerNomesAuto = {}           // índice → nome descoberto lendo o capítulo
let _lerVazios = new Set()       // índice → arquivo sem uma palavra e sem imagem
let _lerSumarioBusca = ''
let _lerSumarioAbre = {}         // grupo → aberto?

// Nome sem dono é nome que o índice do EPUB não soube dar.
function _lerNomeVago(t) {
  const s = String(t || '').trim()
  if (!s) return true
  if (/^(parte|part|se[cç][aã]o|section|item)\s*\d+$/i.test(s)) return true
  if (/^(text|split|dummy|part)?\d+(\.x?html?)?$/i.test(s)) return true
  if (/\.(x?html?|htm)$/i.test(s)) return true
  return false
}

// O NOME QUE VAI PARA A TELA — um só, para as três listas que mostram
// capítulo (sumário, raio-X e o título na barra). Sem isto, arrumar numa
// deixava as outras duas com "Parte 9".
//
// ⚠️ SÃO DUAS FUNÇÕES, E A SEPARAÇÃO NÃO É ENFEITE. `_lerNomeBase` é o nome
// isolado, olhando só aquele capítulo; `lerCapNome` é o nome DEPOIS de a lista
// inteira ser lida (emenda de arquivo partido, continuação). A lista precisa
// da primeira para se montar — se ela chamasse a segunda, uma chamaria a outra
// para sempre. Quem mostra na tela usa a segunda.
function lerCapNome(i) {
  const m = _lerMapaSumario()
  if (m.porIndice[i]) return m.porIndice[i]
  return _lerNomeBase(i)
}

function _lerNomeBase(i) {
  const c = (_lerLivro && _lerLivro.chapters && _lerLivro.chapters[i]) || null
  if (!c) return `Parte ${i + 1}`
  if (_lerLivro.format === 'manga') return c.titulo || `Página ${i + 1}`
  if (!_lerNomeVago(c.titulo)) return c.titulo
  return _lerNomesAuto[i] || _lerNomePeloArquivo(c) || `Parte ${i + 1}`
}

// Miolo editorial se reconhece pelo NOME DO ARQUIVO, e isso não custa leitura
// nenhuma: `cop`, `ded`, `toc`, `tp` são convenção de quase toda editora.
const _LER_PECAS = [
  [/cover|cvi/i,                                   'Capa'],
  [/halftitle|htp/i,                               'Falsa folha de rosto'],
  [/(^|[^a-z])(title|tp)([^a-z]|$)|titlepage/i,    'Folha de rosto'],
  [/copyright|(^|[^a-z])cop([^a-z]|$)|imprint/i,   'Créditos'],
  [/dedicat|(^|[^a-z])ded([^a-z]|$)/i,             'Dedicatória'],
  [/epigraph|epig/i,                               'Epígrafe'],
  [/praise|acclaim/i,                              'Elogios da crítica'],
  [/contents|(^|[^a-z])toc([^a-z]|$)/i,            'Sumário do livro'],
  [/acknowledg|(^|[^a-z])ack([^a-z]|$)/i,          'Agradecimentos'],
  [/aboutauthor|about[-_]?the[-_]?author|(^|[^a-z])(ata|atr)([^a-z]|$)/i, 'Sobre o autor'],
  [/authorsnote|author[-_]?s?[-_]?note|(^|[^a-z])atn([^a-z]|$)/i, 'Nota do autor'],
  [/alsoby|adcard|(^|[^a-z])adc([^a-z]|$)|otherbooks/i, 'Outros livros do autor'],
  [/newsletter|signup|ebookreg|regfront/i,         'Convite da editora'],
  [/glossar/i,                                     'Glossário'],
  [/appendix|apx/i,                                'Apêndice'],
  [/(^|[^a-z])index([^a-z]|$)/i,                   'Índice remissivo'],
  [/colophon/i,                                    'Colofão'],
  [/teaser|excerpt|preview/i,                      'Trecho de outro livro'],
  [/(^|[^a-z])map/i,                               'Mapas'],
  [/prologue|prolog/i,                             'Prólogo'],
  [/epilogue|epilog/i,                             'Epílogo'],
  [/foreword/i,                                    'Prefácio'],
  [/introduc|(^|[^a-z])intro([^a-z]|$)/i,          'Introdução'],
  [/afterword/i,                                   'Posfácio']
]
function _lerNomePeloArquivo(c) {
  const alvo = ((c.href || '') + ' ' + (c.id || '')).replace(/\d{6,}/g, '')
  for (const [re, nome] of _LER_PECAS) if (re.test(alvo)) return nome
  return ''
}
// A mesma pergunta, feita ao título que o índice deu. Serve só para CLASSIFICAR
// (frente/corpo/fundo) — o nome na tela continua sendo o do livro.
function _lerPecaPeloNome(titulo) {
  const t = String(titulo || '').trim()
  if (!t || t.length > 60) return ''
  for (const [re, nome] of _LER_PECAS) if (re.test(t)) return nome
  return ''
}

// O MAPA DA LISTA — uma passada só, e as três decisões saem juntas
// (emendar, agrupar, numerar). Elas não podem ser tomadas separadas: a
// primeira leitura errou exatamente aí, e o erro apareceu na tela — a novela
// de 40 mil palavras foi parar em "antes do texto", porque o grupo foi
// decidido pelo tamanho do PEDAÇO (13 palavras) em vez do tamanho da coisa
// emendada. Quem decide grupo tem de ver o resultado da emenda.
const LER_CORPO_MIN = 300        // palavras: abaixo disto não é capítulo, é peça
const _LER_FUNDO = new Set([
  'Sobre o autor', 'Outros livros do autor', 'Agradecimentos', 'Posfácio',
  'Apêndice', 'Índice remissivo', 'Colofão', 'Glossário',
  'Trecho de outro livro', 'Convite da editora'
])
// Peça que NUNCA começa o livro. Sem esta lista, os "Elogios da crítica" de
// Bag of Bones (328 palavras — mais que o mínimo de capítulo) abriam o corpo
// no índice 1 e arrastavam folha de rosto, sumário e dedicatória para dentro
// dele. ⚠️ Prefácio, prólogo, introdução e nota do autor ficam DE FORA desta
// lista de propósito: são texto para ler, e ele lê.
const _LER_FRENTE = new Set([
  'Capa', 'Falsa folha de rosto', 'Folha de rosto', 'Créditos', 'Dedicatória',
  'Epígrafe', 'Elogios da crítica', 'Sumário do livro', 'Convite da editora',
  'Outros livros do autor', 'Mapas'
])

// O mapa é guardado: ele é lido pelo sumário, pelo raio-X e pelo nome na
// barra — a cada troca de capítulo. Refazê-lo toda vez seria varrer 105
// capítulos para escrever um título. A chave inclui o que pode mudar debaixo
// dele (os nomes descobertos lendo o livro), então nunca envelhece calado.
let _lerMapaCache = null
function _lerMapaSumario() {
  const caps = (_lerLivro && _lerLivro.chapters) || []
  const chave = (_lerLivro ? _lerLivro.id : '') + '|' + Object.keys(_lerNomesAuto).length +
                '|' + _lerVazios.size + '|' + _lerSemCabecalho.size
  if (_lerMapaCache && _lerMapaCache.chave === chave) return _lerMapaCache

  // 1. EMENDA — pedaço só com o título + pedaço só com o texto = um capítulo
  const escondidos = new Set()
  const palavras = caps.map(c => c.words || 0)
  // ⚠️ O QUE A REVISÃO JÁ DECIDIU VALE MAIS QUE O PALPITE DE AGORA. Se ele
  // apertou "Corrigir o livro", a emenda e o capítulo vazio estão GRAVADOS no
  // livro — e voltar a adivinhar por cima seria desfazer a escolha dele.
  const ocultos = new Set(_lerVazios)
  caps.forEach((c, i) => {
    if (c.oculto) ocultos.add(i)
    if (typeof c.juntoCom === 'number' && caps[c.juntoCom]) {
      escondidos.add(i)
      palavras[c.juntoCom] = (palavras[c.juntoCom] || 0) + (c.words || 0)
    }
  })
  for (let i = 0; i < caps.length - 1; i++) {
    if (escondidos.has(i + 1)) continue
    if (escondidos.has(i)) continue
    const a = caps[i], b = caps[i + 1]
    if ((a.words || 0) > 30 || _lerNomeVago(a.titulo)) continue
    if ((b.words || 0) < LER_CORPO_MIN) continue
    if (!_lerNomeVago(b.titulo) && !_lerSemCabecalho.has(i + 1)) continue
    // ⚠️ CAPA NÃO É TÍTULO DE CAPÍTULO. Sem esta linha o "Cover" de Bag of
    // Bones (zero palavras) emendou com o texto de trás e virou o capítulo 1 —
    // e, sendo o índice 0, arrastou TODO o miolo editorial para dentro do
    // livro. Peça editorial nunca dá nome a capítulo, e título de verdade tem
    // pelo menos uma palavra.
    if (!(a.words > 0) || _lerNomePeloArquivo(a)) continue
    escondidos.add(i + 1)
    palavras[i] = (a.words || 0) + (b.words || 0)
  }

  // 2. FAIXA DO CORPO — onde o livro de fato começa e acaba. Peça de trás
  // (posfácio, sobre o autor) tem corpo e enganaria a conta pelo tamanho.
  // ⚠️ O NOME TAMBÉM DENUNCIA A PEÇA. "Afterword" tem 3 mil palavras e passaria
  // por capítulo pelo tamanho; o arquivo dele (`part0007.html`) não diz nada.
  // Quem diz é o título, e ele estava sendo ignorado — o posfácio virava o
  // "capítulo 5" de um livro de quatro novelas.
  const peca = caps.map((c, i) => _lerNomePeloArquivo(c) || _lerPecaPeloNome(_lerNomeBase(i)))
  let ini = -1, fim = -1
  caps.forEach((c, i) => {
    if (escondidos.has(i) || palavras[i] < LER_CORPO_MIN) return
    if (_LER_FUNDO.has(peca[i]) || _LER_FRENTE.has(peca[i])) return
    if (ini < 0) ini = i
    fim = i
  })
  if (ini < 0) { ini = 0; fim = caps.length - 1 }

  // 3. LINHAS — nome, grupo, número e continuação
  const linhas = []
  let n = 0, ultimoNome = ''
  caps.forEach((c, i) => {
    if (escondidos.has(i) || ocultos.has(i)) return
    let grupo = i < ini ? 'frente' : (i > fim ? 'fundo' : 'corpo')
    if (grupo === 'corpo' && _LER_FUNDO.has(peca[i])) grupo = 'fundo'
    let nome = _lerNomeBase(i)
    let cont = false
    // Capítulo grande, sem nome nenhum, logo depois de outro capítulo grande:
    // é a segunda metade do mesmo texto (o Calibre corta novela comprida em
    // dois arquivos). Dizer "Parte 12" ali era o que não informava nada.
    if (grupo === 'corpo' && palavras[i] >= LER_CORPO_MIN && ultimoNome &&
        _lerNomeVago(c.titulo) && !_lerNomesAuto[i] && !peca[i]) {
      nome = `${ultimoNome} — continuação`
      cont = true
    }
    if (grupo === 'corpo' && palavras[i] >= LER_CORPO_MIN && !cont) { n++; ultimoNome = nome }
    linhas.push({ i, nome, cont, palavras: palavras[i], grupo, num: (grupo === 'corpo' && !cont && palavras[i] >= LER_CORPO_MIN) ? n : 0 })
  })

  // O NOME POR ÍNDICE INCLUI O PEDAÇO ESCONDIDO. Sem isto a barra dizia
  // "Parte 9" enquanto ele lia *Rita Hayworth*: o índice aberto é o do texto,
  // e o nome estava no pedaço de 13 palavras que a emenda recolheu.
  const porIndice = {}
  for (const l of linhas) porIndice[l.i] = l.nome
  // ONDE MORA O TEXTO DE CADA LINHA. Numa emenda, a linha visível é a PÁGINA DE
  // TÍTULO (4 palavras) e o texto está no pedaço recolhido. Quem lê segue a
  // linha; quem ANALISA precisa do texto — e o raio-X estava listando os dois,
  // com o mesmo nome, duas vezes ("Part One, Part One, Part Two, Part Two…").
  const conteudoDe = {}
  for (const l of linhas) conteudoDe[l.i] = l.i
  for (let i = 0; i < caps.length; i++) {
    if (!escondidos.has(i)) continue
    let d = i - 1
    while (d >= 0 && escondidos.has(d)) d--
    if (d >= 0 && (caps[i].words || 0) > (caps[d].words || 0)) conteudoDe[d] = i
  }
  for (let i = 0; i < caps.length; i++) {
    if (!escondidos.has(i)) continue
    let d = i - 1
    while (d >= 0 && escondidos.has(d)) d--
    if (d >= 0 && porIndice[d]) porIndice[i] = porIndice[d]
  }
  _lerMapaCache = { chave, linhas, capitulos: n, porIndice, conteudoDe }
  return _lerMapaCache
}

// ⚠️ TÍTULO QUE O ÍNDICE DEU TAMBÉM PODE SER MENTIRA. Foi o *Carrie* dele que
// mostrou: o sumário do próprio editor batiza os corpos de texto com a PRIMEIRA
// FRASE deles — *"News item from the Westover. . ."*, *"She put the dress on for
// the first. . ."*. A emenda não disparava porque ela só juntava quando o pedaço
// grande estava SEM nome, e ali ele tinha um — um nome que não é título.
//
// O que separa "Chapter 1" (título de verdade) de "News item from the
// Westover…" (frase de abertura) não é o texto do nome: é o ARQUIVO. Capítulo
// de verdade traz o próprio cabeçalho dentro; corpo de parte, não. Conferido
// nos livros dele antes de escrever: *The Green Mile* (`<h?>1</h?>`), *Bag of
// Bones* e *The Stand* (`CHAPTER n`) têm cabeçalho e **não são tocados**;
// *Carrie* e *Different Seasons* não têm, e emendam.
let _lerSemCabecalho = new Set()

async function _lerAcharCorpoSemNome() {
  const caps = (_lerLivro && _lerLivro.chapters) || []
  let achou = false
  for (let i = 0; i < caps.length - 1; i++) {
    const a = caps[i], b = caps[i + 1]
    if (_lerSemCabecalho.has(i + 1)) continue
    if (!(a.words > 0) || (a.words || 0) > 30 || _lerNomeVago(a.titulo)) continue
    if (_lerNomePeloArquivo(a)) continue
    if ((b.words || 0) < LER_CORPO_MIN || _lerNomeVago(b.titulo)) continue
    if (!b.href) continue
    let html = ''
    try { html = await _lerEpub.zip.texto(b.href) || '' } catch (e) { continue }
    if (/<h[1-6][\s>]/i.test(html)) continue        // tem cabeçalho próprio: é capítulo mesmo
    _lerSemCabecalho.add(i + 1); achou = true
  }
  return achou
}

// O nome que estava DENTRO do capítulo. Só é lido quando o índice falhou, e
// só uma vez por livro: 105 capítulos são 105 descompactações.
async function _lerNomearPeloConteudo() {
  const caps = (_lerLivro && _lerLivro.chapters) || []
  if (_lerLivro.format === 'manga' || !_lerEpub || !_lerEpub.zip) return false
  let achou = await _lerAcharCorpoSemNome() || false
  const visivel = new Set(_lerMapaSumario().linhas.map(l => l.i))
  for (let i = 0; i < caps.length; i++) {
    if (!visivel.has(i) || i in _lerNomesAuto) continue
    const c = caps[i]
    if (!_lerNomeVago(c.titulo) || !c.href) continue
    if (_lerNomePeloArquivo(c)) continue
    let html = ''
    try { html = await _lerEpub.zip.texto(c.href) || '' } catch (e) { continue }
    // ⚠️ SEM PALAVRA NENHUMA AINDA PODE SER ALGUMA COISA. O arquivo de zero
    // palavras é uma página de imagem (mapa, ilustração) ou um resto de
    // conversão que não tem nada dentro — e só olhando dá para saber qual.
    // Adivinhar aqui esconderia os mapas de A Game of Thrones.
    if (!(c.words > 0)) {
      if (/<img[\s>]/i.test(html)) { _lerNomesAuto[i] = 'Ilustração'; achou = true }
      else { _lerVazios.add(i); achou = true }
      continue
    }
    const nome = _lerNomeNoHtml(html)
    if (nome) { _lerNomesAuto[i] = nome; achou = true }
  }
  return achou
}

function _lerNomeNoHtml(html) {
  let doc
  try { doc = new DOMParser().parseFromString(html, 'text/html') } catch (e) { return '' }
  doc.querySelectorAll('script,style').forEach(e => e.remove())
  const h = doc.querySelector('h1,h2,h3,h4,h5,h6')
  if (h) {
    const t = h.textContent.replace(/\s+/g, ' ').trim()
    if (t && t.length <= 80) return t
  }
  // Título composto como parágrafo (é o que sobra em livro convertido): linha
  // curta, sem ponto final, entre as primeiras do capítulo.
  for (const b of [...doc.querySelectorAll('p,div')].slice(0, 8)) {
    const t = b.textContent.replace(/\s+/g, ' ').trim()
    if (!t) continue
    if (t.length <= 58 && !/[.!?;:,]$/.test(t) && /[a-zA-Zà-úÀ-Ú]/.test(t)) return t
    break
  }
  return ''
}

function _lerMinutos(palavras) {
  const m = Math.round((palavras || 0) / LER_PPM)
  if (!m) return ''
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

function lerSumarioBuscar(v) {
  _lerSumarioBusca = String(v || '').toLowerCase().trim()
  _lerRenderSumario(true)
}
function lerSumarioGrupo(g) {
  _lerSumarioAbre[g] = !_lerSumarioAbre[g]
  _lerRenderSumario(true)
}

function _lerRenderSumario(soRedesenha) {
  const p = el('ler-sumario'); if (!p || !_lerLivro) return
  const caps = _lerLivro.chapters || []
  const { linhas, capitulos } = _lerMapaSumario()
  const grupos = { frente: [], corpo: [], fundo: [] }
  for (const l of linhas) grupos[l.grupo].push(l)

  const busca = _lerSumarioBusca
  const casa = it => !busca || it.nome.toLowerCase().includes(busca)
  const item = it => `
    <button class="ler-sum-item${it.i === _lerCap ? ' on' : ''}${it.cont ? ' cont' : ''}" onclick="lerIrParaCapitulo(${it.i},0)">
      <span class="ler-sum-num">${it.num || ''}</span>
      <span class="ler-sum-nome">${esc(it.nome)}</span>
      <i>${it.palavras ? _lerMinutos(it.palavras) : ''}</i>
    </button>`

  // O miolo editorial nasce fechado: ele abre o sumário para achar CAPÍTULO,
  // e oito linhas de "Créditos, Dedicatória, Elogios da crítica" antes do
  // primeiro deles é exatamente o que ele chamou de desorganizado.
  const bloco = (chave, rotulo, lista) => {
    if (!lista.length) return ''
    const vis = lista.filter(casa)
    if (!vis.length) return ''
    const aberto = chave === 'corpo' || !!_lerSumarioAbre[chave] || !!busca
    return `
      <div class="ler-sum-grupo${aberto ? ' aberto' : ''}">
        ${chave === 'corpo' && !grupos.frente.length && !grupos.fundo.length ? '' : `
          <button class="ler-sum-cab" ${chave === 'corpo' ? 'disabled' : `onclick="lerSumarioGrupo('${chave}')"`}>
            <span>${rotulo}</span><i>${vis.length}</i>
            ${chave === 'corpo' ? '' : ic('chevronDown', 'ic-3xs')}
          </button>`}
        <div class="ler-sum-corpo">${vis.map(item).join('')}</div>
      </div>`
  }

  const total = capitulos
  p.innerHTML = `
    <div class="ler-sum-topo">
      <button class="ler-btn ler-pill" onclick="lerRevisar()"
        data-tip="Lê o livro inteiro, mostra os defeitos que achou e conserta o sumário — o que não der para consertar, ele diz">
        ${ic('sparkles', 'ic-sm')} Revisar o livro</button>
      ${_lerLivro.revisao ? `<i>revisado em ${esc(new Date(_lerLivro.revisao.em).toLocaleDateString('pt-BR'))}</i>` : ''}
    </div>
    ${caps.length > 20 ? `<div class="ler-sum-busca">
      <input type="search" placeholder="Procurar capítulo" value="${escA(_lerSumarioBusca)}"
        oninput="lerSumarioBuscar(this.value)" aria-label="Procurar capítulo">
    </div>` : ''}
    <div class="ler-sumario-lista">
      ${bloco('frente', 'Antes do texto', grupos.frente)}
      ${bloco('corpo', total ? `${total} capítulos` : 'O livro', grupos.corpo)}
      ${bloco('fundo', 'Depois do texto', grupos.fundo)}
    </div>`

  // Os nomes que só o conteúdo sabe chegam depois — a lista não espera por
  // eles. Uma vez por livro; a segunda abertura já nasce com tudo.
  if (!soRedesenha) {
    _lerNomearPeloConteudo().then(mudou => {
      if (mudou && !el('ler-sumario').classList.contains('hidden')) _lerRenderSumario(true)
      if (mudou) { const nm = el('ler-cap-nome'); if (nm) nm.textContent = lerCapNome(_lerCap) }
    }).catch(() => {})
  }
}

// ================================================================
// REVISAR O LIVRO — varrer, dar o laudo, consertar o que dá
// ================================================================
// Pedido dele, com todas as letras: *"um botão que processa o livro e vê os
// defeitos e corrige, igual você fez agora com a Carrie"*. E ele tinha razão
// na crítica: o que existia era faxina de CAPÍTULO, feita na hora de abrir, e
// o conserto do *Carrie* eu tinha feito na mão, no código.
//
// A diferença entre as duas coisas é o ALCANCE, e ela é real:
//
//   a faxina  vê um capítulo por vez, não guarda nada, e refaz tudo a cada
//             abertura — não tem como saber que o índice do livro inteiro é
//             mentira, porque isso só aparece comparando capítulos
//   a revisão  lê o livro TODO uma vez, compara os capítulos entre si, escreve
//             o conserto no livro (e ele sobe para a nuvem) e diz na cara o que
//             NÃO conseguiu consertar
//
// ⚠️ REGRA DE OURO DAQUI: ÍNDICE DE CAPÍTULO NUNCA MUDA. A posição de leitura
// (`pos.cap`), cada anotação (`notes[].cap`), as chaves do raio-X
// (`raiox:<id>:<n>`) e o mapa da sincronia com o audiolivro são todos pelo
// ÍNDICE. Remover ou reordenar um capítulo aqui apagaria o lugar onde ele
// parou em TODOS os livros já lidos. Então a revisão só RENOMEIA e ACRESCENTA
// campos — nunca tira, nunca troca de lugar.

const LER_REVISAO_VERSAO = 1
let _lerRevisando = false
let _lerRevisaoLaudo = null

// ---- 1. O DIAGNÓSTICO: lê o livro inteiro, uma vez ----------------
async function _lerRevisarVarrer() {
  const caps = (_lerLivro && _lerLivro.chapters) || []
  const zip = _lerEpub && _lerEpub.zip
  if (!zip) return null

  const laudo = {
    total: caps.length,
    nomes: [],            // { i, de, para, porque }
    ocultos: [],          // capítulos sem uma palavra e sem imagem
    emendas: [],          // { i, com, nome }
    texto: { virados: 0, vazios: 0, junta: 0, hifen: 0, nbsp: 0, cena: 0, br: 0, ancora: 0, pagina: 0 },
    naoDaPara: [],        // o que a revisão VIU e não sabe consertar
    lidos: 0
  }

  // Uma leitura por capítulo, guardada: as três análises abaixo usam o mesmo
  // texto, e descomprimir 105 capítulos três vezes seria desperdício puro.
  const corpo = new Array(caps.length).fill(null)
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i]
    if (!c.href) continue
    try { corpo[i] = await zip.texto(c.href) || '' } catch (e) { corpo[i] = '' }
    laudo.lidos++
    if (i % 12 === 0) await new Promise(r => setTimeout(r, 0))   // não trava a tela
  }

  // ---- nomes ----
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i]
    const html = corpo[i]
    if (!(c.words > 0) && html && !/<img[\s>]/i.test(html) && !_lerTextoDoHtml(html)) {
      if (!c.oculto) laudo.ocultos.push(i)
      continue
    }
    let novo = '', porque = ''
    if (_lerNomeVago(c.titulo)) {
      novo = _lerNomePeloArquivo(c)
      porque = novo ? 'reconhecido pelo arquivo' : ''
      if (!novo && html) {
        novo = _lerNomeNoHtml(html)
        porque = novo ? 'lido dentro do capítulo' : ''
      }
      if (!novo && html && /<img[\s>]/i.test(html)) { novo = 'Ilustração'; porque = 'só tem imagem' }
    }
    if (novo && novo !== c.titulo) laudo.nomes.push({ i, de: c.titulo, para: novo, porque })
  }

  // ---- emendas (o caso do Carrie e do Different Seasons) ----
  for (let i = 0; i < caps.length - 1; i++) {
    const a = caps[i], b = caps[i + 1]
    // ⚠️ O QUE JÁ FOI CONSERTADO NÃO VOLTA NO LAUDO. Sem isto, revisar de novo
    // um livro já corrigido acusaria os MESMOS defeitos — e ele leria isso
    // como "não funcionou", que é o oposto da verdade.
    if (typeof b.juntoCom === 'number') continue
    if (!(a.words > 0) || (a.words || 0) > 30 || _lerNomeVago(a.titulo)) continue
    if (_lerNomePeloArquivo(a)) continue
    if ((b.words || 0) < LER_CORPO_MIN) continue
    const semNome = _lerNomeVago(b.titulo)
    const semCabecalho = corpo[i + 1] && !/<h[1-6][\s>]/i.test(corpo[i + 1])
    if (!semNome && !semCabecalho) continue
    laudo.emendas.push({
      i, com: i + 1, nome: a.titulo,
      porque: semNome ? 'a segunda parte veio sem nome' : 'o índice batizou o texto com a frase de abertura'
    })
  }

  // ---- defeitos de texto: a faxina rodada no livro inteiro ----
  for (let i = 0; i < caps.length; i++) {
    if (!corpo[i]) continue
    const r = _lerMedirDefeitos(corpo[i])
    for (const k of Object.keys(laudo.texto)) laudo.texto[k] += r[k] || 0
    if (r.semParagrafo) laudo.naoDaPara.push({ i, o: 'texto sem divisão de parágrafo' })
    if (r.mojibake >= 6) laudo.naoDaPara.push({ i, o: 'acentuação quebrada no arquivo' })
    if (r.tabela) laudo.naoDaPara.push({ i, o: 'tabela usada como diagramação' })
  }
  // Livro inteiro num capítulo só: só um passe global enxerga.
  const grandes = caps.filter(c => (c.words || 0) >= 8000)
  if (grandes.length === 1 && caps.filter(c => (c.words || 0) >= LER_CORPO_MIN).length <= 2) {
    laudo.naoDaPara.push({ i: caps.indexOf(grandes[0]), o: `o livro veio inteiro num capítulo só (${grandes[0].words.toLocaleString('pt-BR')} palavras)` })
  }
  // um aviso por tipo — a lista serve para ele decidir, não para assustar
  const vistos = new Set()
  laudo.naoDaPara = laudo.naoDaPara.filter(x => (vistos.has(x.o) ? false : vistos.add(x.o)))
  return laudo
}

function _lerTextoDoHtml(html) {
  try { return epubTextoLimpo(html) } catch (e) { return '' }
}

// Conta os defeitos SEM tocar na tela — é o mesmo `_lerArrumar`, rodado sobre
// uma cópia solta. Assim o laudo diz exatamente o que a leitura já conserta.
function _lerMedirDefeitos(html) {
  let doc
  try { doc = new DOMParser().parseFromString(html, 'text/html') } catch (e) { return {} }
  doc.querySelectorAll('script,style,link,meta,title').forEach(e => e.remove())
  const r = { virados: 0, semParagrafo: false, mojibake: 0, tabela: 0 }
  for (const d of [...doc.body.querySelectorAll('div')]) {
    if (d.querySelector('p,div,h1,h2,h3,h4,h5,h6,ul,ol,table,blockquote')) continue
    if (!d.textContent.trim()) continue
    const p = doc.createElement('p')
    while (d.firstChild) p.appendChild(d.firstChild)
    d.replaceWith(p); r.virados++
  }
  const texto = doc.body.textContent || ''
  r.mojibake = (texto.match(/â€|Ã[©¡§µ£]|ï»¿/g) || []).length
  r.tabela = doc.body.querySelectorAll('table').length
  const blocos = doc.body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li')
  r.semParagrafo = texto.trim().length > 12000 && blocos.length <= 2
  return { ...r, ..._lerArrumar(doc) }
}

// ---- 2. O CONSERTO: escrito no livro, não só na tela --------------
function _lerRevisarAplicar(laudo) {
  const caps = _lerLivro.chapters
  for (const n of laudo.nomes) if (caps[n.i]) caps[n.i].titulo = n.para
  for (const i of laudo.ocultos) if (caps[i]) caps[i].oculto = 1
  for (const e of laudo.emendas) {
    if (!caps[e.com] || !caps[e.i]) continue
    // ⚠️ O ÍNDICE NÃO SAI DA LISTA. Ele é MARCADO como continuação do anterior:
    // a posição de leitura, as anotações e o raio-X apontam para ele por número.
    caps[e.com].juntoCom = e.i
    // E o nome ruim vai junto. A ESTANTE e a LISTA DE ANOTAÇÕES leem
    // `chapters[].titulo` direto, sem passar pelo resolvedor do leitor — sem
    // esta linha, uma anotação feita na Parte Um continuaria aparecendo como
    // "News item from the Westover. . ." para sempre.
    if (caps[e.i].titulo) caps[e.com].titulo = caps[e.i].titulo
  }
  _lerLivro.revisao = {
    em: Date.now(), versao: LER_REVISAO_VERSAO,
    nomes: laudo.nomes.length, emendas: laudo.emendas.length,
    ocultos: laudo.ocultos.length, texto: { ...laudo.texto },
    pendentes: laudo.naoDaPara.map(x => x.o)
  }
  _lerLivro.updatedAt = Date.now()
  saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  _lerMapaCache = null
  _lerNomesAuto = {}
  _lerVazios = new Set(laudo.ocultos)
}

// ---- 3. A TELA ----------------------------------------------------
async function lerRevisar() {
  if (_lerRevisando || !_lerLivro) return
  if (_lerLivro.format === 'manga') { toast('A revisão é para livro de texto — o mangá é imagem.', 'info'); return }
  _lerRevisando = true
  _lerRevisaoPintar('<div class="ler-carregando">lendo o livro inteiro…</div>')
  try {
    _lerRevisaoLaudo = await _lerRevisarVarrer()
  } catch (e) {
    _lerRevisando = false
    _lerRevisaoPintar(`<div class="ler-rev-msg">não consegui ler o livro: ${esc(e.message || 'erro')}</div>`)
    return
  }
  _lerRevisando = false
  _lerRevisaoRender()
}

function _lerRevisaoPintar(html) {
  let p = el('ler-revisao')
  if (!p) {
    p = document.createElement('div')
    p.id = 'ler-revisao'
    p.className = 'ler-painel ler-revisao'
    const alvo = el('ler-sumario')
    if (alvo && alvo.parentNode) alvo.parentNode.insertBefore(p, alvo.nextSibling)
    else document.body.appendChild(p)
  }
  // O laudo é uma tela por si: abrir por ele NÃO exige o sumário aberto.
  for (const k of ['sumario', 'tipografia', 'ferramentas', 'conversa']) {
    const outro = el('ler-' + k); if (outro) outro.classList.add('hidden')
  }
  p.classList.remove('hidden')
  p.innerHTML = html
}

function lerRevisaoFechar() { const p = el('ler-revisao'); if (p) p.classList.add('hidden') }

function _lerRevisaoRender() {
  const l = _lerRevisaoLaudo
  if (!l) return
  const t = l.texto
  const achados = []
  const n1 = (n, um, muitos) => (n === 1 ? um : muitos)
  const pl = (n, um, muitos) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : muitos}`
  if (l.emendas.length) achados.push([`${pl(l.emendas.length, 'capítulo partido', 'capítulos partidos')} em dois`, l.emendas.map(e => e.nome).slice(0, 3).join(', ')])
  if (l.nomes.length)   achados.push([`${pl(l.nomes.length, 'capítulo sem', 'capítulos sem')} nome de verdade`, l.nomes.slice(0, 3).map(n => `“${n.de}” → ${n.para}`).join(' · ')])
  if (l.ocultos.length) achados.push([`${pl(l.ocultos.length, 'capítulo vazio', 'capítulos vazios')}`, n1(l.ocultos.length, 'sai', 'saem') + ' da lista'])
  if (t.virados)  achados.push([`${pl(t.virados, 'parágrafo sem espaçamento', 'parágrafos sem espaçamento')}`, 'o arquivo não usou parágrafo de verdade'])
  if (t.junta)    achados.push([`${pl(t.junta, 'parágrafo partido', 'parágrafos partidos')} no meio da frase`, n1(t.junta, 'emendado', 'emendados') + ' na leitura'])
  if (t.hifen)    achados.push([`${pl(t.hifen, 'palavra cortada', 'palavras cortadas')} pela margem`, n1(t.hifen, 'remendada', 'remendadas') + ' na leitura'])
  if (t.vazios)   achados.push([`${pl(t.vazios, 'buraco em branco', 'buracos em branco')}`, n1(t.vazios, 'fechado', 'fechados') + ' na leitura'])
  if (t.nbsp)     achados.push([`${pl(t.nbsp, 'recuo falso', 'recuos falsos')}`, 'feitos com espaço duro'])
  if (t.cena)     achados.push([`${pl(t.cena, 'quebra de cena torta', 'quebras de cena tortas')}`, n1(t.cena, 'endireitada', 'endireitadas') + ' na leitura'])
  if (t.ancora + t.pagina) achados.push([`${pl(t.ancora + t.pagina, 'marca de página', 'marcas de página')}`, n1(t.ancora + t.pagina, 'escondida', 'escondidas') + ' na leitura'])

  const linha = ([o, det]) => `<li><b>${esc(o)}</b>${det ? `<span>${esc(det)}</span>` : ''}</li>`
  const jaRevisado = _lerLivro.revisao

  _lerRevisaoPintar(`
    <div class="ler-rev-topo">
      <b>${esc(_lerLivro.title)}</b>
      <span>${l.lidos} capítulos lidos</span>
      <button class="ler-btn" onclick="lerRevisaoFechar()">${ic('x', 'ic-sm')}</button>
    </div>
    ${achados.length ? `
      <p class="ler-rev-sub">O que eu encontrei</p>
      <ul class="ler-rev-lista">${achados.map(linha).join('')}</ul>` : `
      <p class="ler-rev-msg">Este livro está limpo — não achei nada para consertar.</p>`}
    ${l.naoDaPara.length ? `
      <p class="ler-rev-sub">O que eu <b>não</b> sei consertar</p>
      <ul class="ler-rev-lista ler-rev-nao">${l.naoDaPara.map(x => `<li><b>${esc(x.o)}</b></li>`).join('')}</ul>` : ''}
    ${(l.nomes.length || l.emendas.length || l.ocultos.length) ? `
      <div class="ler-rev-acao">
        <button class="btn btn-primary" onclick="lerRevisaoConfirmar()">Corrigir o livro</button>
        <i>o sumário é reescrito e vai junto para os seus outros aparelhos. A posição de
           leitura, as anotações e as análises não se mexem — nenhum capítulo muda de número.</i>
      </div>` : `
      <div class="ler-rev-acao">
        <i>Os defeitos de texto acima já são corrigidos toda vez que você abre um capítulo,
           com o botão <b>Arrumado</b> ligado — não há o que gravar.</i>
      </div>`}
    ${jaRevisado ? `<p class="ler-rev-msg">Revisado pela última vez em ${esc(new Date(jaRevisado.em).toLocaleDateString('pt-BR'))}.</p>` : ''}`)
}

function lerRevisaoConfirmar() {
  if (!_lerRevisaoLaudo) return
  _lerRevisarAplicar(_lerRevisaoLaudo)
  const l = _lerRevisaoLaudo
  toast(`Livro corrigido — ${l.nomes.length + l.emendas.length + l.ocultos.length} ajustes no sumário`, 'success')
  lerRevisaoFechar()
  _lerRenderSumario()
  const nm = el('ler-cap-nome'); if (nm) nm.textContent = lerCapNome(_lerCap)
}

// ================================================================
// POSIÇÃO, PÁGINAS E PROGRESSO
// ================================================================
// Paginado = colunas CSS da altura da tela; "virar a página" é rolar a
// viewport na horizontal. Rolagem = scroll vertical de sempre. A posição é
// guardada como FRAÇÃO do capítulo, então sobrevive a mudar fonte/tamanho.
// ⚠️ MANGÁ NUNCA É PAGINADO. O modo "página" corta o capítulo em colunas da
// altura da tela; uma imagem de 1600x2400 não se deixa cortar assim — ficaria
// uma tira vertical por coluna e "virar a página" pularia meia arte. No mangá
// a página JÁ é a unidade: cada uma é um capítulo, e rolar é o gesto certo.
function _lerPaginado() {
  if (_lerLivro && _lerLivro.format === 'manga') return false
  return lerCfg().modo === 'pag'
}

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
  // No mangá a posição inteira cabe em `cap` (a página). Gravar fração aqui
  // seria gravar "onde estou dentro do volume", que na volta brigaria com a
  // página — dois donos para a mesma informação.
  if (_lerLivro && _lerLivro.format === 'manga') return 0
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
  // ⚠️ NO MANGÁ A POSIÇÃO É A PÁGINA, NÃO UMA FRAÇÃO. A fração salva vinha de
  // quando cada página era um capítulo — aplicada ao volume inteiro, um
  // `frac: 1` (fim daquela página) virava "fim do volume", e abrir o mangá
  // jogava direto na última folha. Foi o que aconteceu no primeiro teste do
  // fluxo contínuo: a página 1 estava 45.000 px acima da tela.
  if (_lerLivro && _lerLivro.format === 'manga') {
    if (typeof mangaIrParaPagina === 'function') mangaIrParaPagina(_lerCap, false)
    return
  }
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
  // O AVANÇO DO DIA SE ANOTA SOZINHO. É o que faz o calendário, a sequência e
  // a meta diária existirem sem ninguém digitar nada — e é aqui, na gravação
  // da posição, porque este é o único ponto por onde TODO avanço passa
  // (página, rolagem, troca de capítulo, fechar o livro).
  if (typeof estanteMarcarAvanco === 'function') estanteMarcarAvanco(_lerLivro)
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
      // mesma palavra de novo pelo botão Estudar logo abaixo.
      // ⚠️ MENOS UM CASO: `known`/`ignored` não entram mais. O balão dizia
      // "você marcou como conhecida" — e conhecer a palavra deixou de fazer
      // parte da leitura (ver o bloco "A LEITURA NÃO PERGUNTA MAIS SE VOCÊ
      // CONHECE"). Dentro do popup isso era pior que no hover: ele acabou de
      // marcar aquilo justamente porque NÃO entendeu, e a primeira linha da
      // resposta era o app dizendo que ele já sabia.
      if (achado && achado.fonte !== 'known' && achado.fonte !== 'ignored') {
        glosaHTML = `<div class="gloss-embutido">${glossLinhaHTML(achado, { curto: true })}</div>`
      }
    }
  }

  // A TRADUÇÃO NASCE JUNTO COM O POPUP, antes de qualquer clique. É a primeira
  // coisa que ele quer ver ao marcar um trecho, então é a primeira coisa que o
  // popup mostra — o menu vem embaixo, para quem quiser ir além.
  const tradHTML = (lerCfg().traduzir === 'auto')
    ? `<div class="ler-pop-trad" id="ler-pop-trad"><i class="ler-pop-trad-esperando">traduzindo…</i></div>`
    : ''

  const pop = document.createElement('div')
  pop.id = 'ler-pop'
  pop.innerHTML = tradHTML + glosaHTML + `
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
  // O retângulo da seleção fica GUARDADO: a tradução chega segundos depois e
  // faz o popup crescer, e sem ele não haveria como recolocar a caixa sem
  // tapar justamente a frase que ele acabou de marcar.
  _lerPopRect = { top: r.top, bottom: r.bottom, left: r.left, width: r.width }
  _lerPopPor(pop)

  pop.querySelector('[data-p="rev"]').onclick = () => {
    _lerCapturar(_lerPopAlvo, _lerPopCtx)
    _lerFecharPopup(); try { window.getSelection().removeAllRanges() } catch (e) {}
  }
  pop.querySelector('[data-p="ouv"]').onclick = () => lerFalar(_lerPopAlvo)
  pop.querySelector('[data-p="img"]').onclick = () => lerAbrirBusca('img')
  pop.querySelector('[data-p="wiki"]').onclick = () => lerAbrirBusca('wiki')
  pop.querySelector('[data-p="web"]').onclick = () => lerAbrirBusca('web')
  pop.querySelector('[data-p="exp"]').onclick = () => lerExplicarSelecao(pop)

  if (tradHTML) _lerTraduzirAuto(pop, txt, _lerPopCtx, _lerPopTrecho)
}

// Onde a caixa fica. Separado de quem a cria porque é chamado DUAS vezes: ao
// nascer e quando a tradução entra — o popup muda de altura no meio do caminho.
let _lerPopRect = null
function _lerPopPor(pop) {
  const r = _lerPopRect
  if (!pop || !r) return
  const larg = pop.offsetWidth, alt = pop.offsetHeight
  const x = Math.max(8, Math.min(r.left + r.width / 2 - larg / 2, window.innerWidth - larg - 8))
  let y = r.bottom + 8
  if (y + alt > window.innerHeight - 8) y = Math.max(8, r.top - alt - 8)
  pop.style.left = Math.round(x) + 'px'
  pop.style.top = Math.round(y) + 'px'
}

// ================================================================
// A TRADUÇÃO QUE VEM SOZINHA
// ================================================================
// O gesto é um só: marcou com o mouse, aparece em português. Sem clique, sem
// espera de aula — é a leitura seguindo em frente.
//
// ⚠️ TRADUZ O QUE ELE MARCOU, E SÓ ISSO. A primeira versão traduzia a FRASE
// INTEIRA em volta, com o pedaço marcado em negrito, e ele derrubou na
// primeira tela: marcou `ore` e recebeu "Ele está pensando que Zola estava
// apenas começando a explorar o que viria a se revelar um veio profundo e
// fabuloso de minério" — três linhas para responder uma palavra. O veredito
// dele foi certeiro: **"isso não é tradução, é explicação, e já tem um botão
// de Explicar"**. Marcou uma palavra, quer a palavra; marcou uma frase (ou
// tocou num balão do mangá, que seleciona a fala toda), quer a frase.
//
// A frase em volta não sumiu — mudou de papel: entra como CONTEXTO para
// desambiguar e nunca é traduzida. É ela que faz `ore` virar "minério" num
// livro de mineração e não "minério bruto" em outro sentido, e `barrel` virar
// "cano" quando o dono é um fuzil.
//
// A divisão do trabalho, agora sem sobreposição:
//   · Traduzir (aqui) — o equivalente do que ele marcou, naquela passagem.
//   · Explicar (menu) — a Lexa ensinando: sentido, nuance, exemplos, a obra.
//
// ⚠️ CUSTO. Isto dispara a cada seleção, sem clique nenhum — o oposto de todo
// o resto do app, onde chamada de IA se pede. Três freios, nesta ordem:
//   1. o mesmo par (frase + trecho) nunca é pago duas vezes na sessão
//   2. teto de tamanho: parágrafo gigante não vira tradução automática
//   3. o interruptor em Ajustes → "Ao selecionar: só o menu" desliga tudo
const LER_TRAD_MAX = 700          // caracteres que a IA recebe, no máximo
const LER_TRAD_CACHE_MAX = 400
const _lerTradCache = new Map()   // "frase + alvo" -> html já traduzido

function _lerTradChave(alvo, frase) {
  return String(frase || '').toLowerCase().trim() + '\u0000' + String(alvo || '').toLowerCase().trim()
}

function _lerTradGuardar(chave, html) {
  // Mapa tem ordem de inserção: o mais velho é o primeiro, e sai primeiro.
  if (_lerTradCache.size >= LER_TRAD_CACHE_MAX) {
    const velho = _lerTradCache.keys().next().value
    _lerTradCache.delete(velho)
  }
  _lerTradCache.set(chave, html)
}

// O QUE SE TRADUZ É A SELEÇÃO. Só o teto de tamanho mexe nela: marcar três
// páginas com Ctrl+A não pode virar uma tradução de três páginas.
function _lerTradTextoAlvo(alvo) {
  const base = String(alvo || '').trim()
  if (base.length <= LER_TRAD_MAX) return base
  // Corta na última fronteira de frase que couber — nunca no meio de uma
  // palavra, que faria a IA traduzir um pedaço sem sentido.
  const pedaco = base.slice(0, LER_TRAD_MAX)
  const corte = Math.max(pedaco.lastIndexOf('. '), pedaco.lastIndexOf('! '), pedaco.lastIndexOf('? '))
  return (corte > 200 ? pedaco.slice(0, corte + 1) : pedaco.slice(0, pedaco.lastIndexOf(' '))).trim()
}

async function _lerTraduzirAuto(pop, alvo, frase, bloco) {
  const caixa = pop && pop.querySelector('#ler-pop-trad')
  if (!caixa) return
  // `vivo`: ele pode ter fechado o popup (ou marcado outra coisa) enquanto a
  // IA respondia. Escrever num popup que já morreu não dá erro nenhum — só
  // some, e o silêncio é o que confunde.
  const vivo = () => document.body.contains(caixa) && el('ler-pop') === pop

  const texto = _lerTradTextoAlvo(alvo)
  if (!texto) { caixa.remove(); return }

  // CURTO OU LONGO muda o que se pede — e o tamanho da letra na tela. Até
  // quatro palavras é vocabulário: quer-se o equivalente, do tamanho de um
  // equivalente ("minério", não uma oração explicando o que é minério). Daí em
  // diante é texto, e texto se traduz inteiro.
  const curto = texto.split(/\s+/).filter(Boolean).length <= LER_MAX_ALVO
  if (curto) caixa.classList.add('curta')

  // A chave leva a frase junto: a MESMA palavra em outra passagem pode ter
  // outra tradução — é esse o ponto de traduzir dentro do contexto. Guardar só
  // por palavra faria o cache devolver o sentido do capítulo anterior.
  const chave = _lerTradChave(texto, frase)
  const guardado = _lerTradCache.get(chave)
  if (guardado) { caixa.innerHTML = guardado; _lerPopPor(pop); return }

  if (typeof aiChatCfg !== 'function' || !aiChatCfg().key) {
    // Sem chave, um aviso DISCRETO e uma vez só — nada de toast: ele viria a
    // cada palavra marcada e transformaria a leitura num campo minado.
    caixa.innerHTML = '<i class="ler-pop-trad-esperando">sem chave de IA — Configurações → IA</i>'
    _lerPopPor(pop)
    return
  }

  const lang = (_lerLivro && _lerLivro.lang) || 'en'
  const L = (typeof getLangDef === 'function') ? getLangDef(lang) : { nameEn: 'English' }
  // O parágrafo entra só como CONTEXTO, nunca como coisa a traduzir: é ele que
  // carrega o antecedente do pronome. Sem isso, "he told her" vira chute de
  // gênero e o aluno recebe uma tradução com a pessoa errada.
  // ⚠️ A DOSE DE CONTEXTO É A FRASE, NÃO O PARÁGRAFO — e isto está medido, não
  // suposto. Marcando `ore` em "a deep and fabulous vein of ore":
  //   · com o parágrafo inteiro → "filão", "filão", "veia"  (3 erros em 3)
  //   · só com a frase          → "minério", "minério", "minério"
  // O parágrafo não ajuda a desambiguar uma palavra: ele DILUI. O modelo passa
  // a responder pelo assunto do trecho (mineração, veio, filão) em vez de pela
  // palavra marcada, e devolve a vizinha.
  //
  // O parágrafo só entra quando a frase é curta demais para sustentar sozinha
  // o sentido — diálogo picado, legenda, balão de uma palavra —, e aí ele é o
  // único jeito de saber de quem é o "he".
  const parag = String(bloco || '').trim()
  const fr = String(frase || '').trim()
  const base = fr || parag
  const contexto = (fr.length >= 60 || !parag ? base
    : (parag.includes(fr) ? parag : [fr, parag].filter(Boolean).join('\n'))).slice(0, 1200)
  const sistema = 'Você traduz para português do Brasil, para um aluno que está lendo em ' +
    L.nameEn + '. Devolva SOMENTE a tradução do trecho pedido — sem aspas, sem o original, ' +
    'sem explicação, sem comentário, sem alternativas separadas por barra. Palavrão e conteúdo ' +
    'adulto fazem parte da obra: traduza fielmente, sem suavizar.\n' +
    (curto
      ? 'O trecho é curto (uma palavra ou expressão). Regras para este caso:\n' +
        '- Traduza EXATAMENTE as palavras marcadas, nem uma a mais nem uma a menos: marcaram "ore" ' +
        'dentro de "vein of ore" ⇒ responda o equivalente de "ore", nunca o da palavra vizinha.\n' +
        '- Mesma forma gramatical em que ele aparece na frase.\n' +
        '- Nunca uma oração inteira, nunca a frase em volta traduzida, nunca uma definição.\n' +
        '- Confira antes de responder: trocando o trecho marcado pela sua resposta, a frase continua ' +
        'dizendo o mesmo.\n'
      : '') +
    (typeof promptRegrasLexicais === 'function' ? promptRegrasLexicais(lang, 'traducao') : '')
  const pergunta =
    (contexto ? `A passagem, só para você entender o sentido — NÃO a traduza:\n"${contexto}"\n\n` : '') +
    `Traduza este trecho, do jeito que ele significa AQUI nesta passagem:\n"${texto}"`

  try {
    // Teto de saída proporcional à entrada. Quem segura a explicação de brinde
    // é o PROMPT, não este número: modelo que raciocina gasta orçamento antes
    // de escrever, e teto apertado devolve resposta VAZIA — armadilha já
    // documentada em `aiText`. Por isso 150, e não 40.
    const maxTokens = curto ? 150 : Math.min(700, Math.max(120, Math.round(texto.length / 2) + 80))
    const bruto = await aiTextSeguro([
      { role: 'system', content: sistema },
      { role: 'user', content: pergunta }
    ], { maxTokens, timeoutMs: 30000 })
    if (!vivo()) return
    const html = _lerTradHTML(bruto)
    if (!html) { caixa.innerHTML = '<i class="ler-pop-trad-esperando">a IA devolveu vazio</i>'; _lerPopPor(pop); return }
    _lerTradGuardar(chave, html)
    caixa.innerHTML = html
    _lerPopPor(pop)
  } catch (e) {
    if (!vivo()) return
    caixa.innerHTML = `<i class="ler-pop-trad-esperando">não deu para traduzir: ${esc(e.message || 'erro')}</i>`
    _lerPopPor(pop)
  }
}

// A resposta vem em texto puro, mas com <b> lá dentro — e é o ÚNICO HTML que
// pode passar. Escapar tudo e devolver o <b> é mais seguro que confiar: a
// resposta da IA é texto de fora, e texto de fora não vira marcação aqui.
function _lerTradHTML(bruto) {
  let t = String(bruto || '').trim()
  if (!t) return ''
  // Modelo teimoso às vezes devolve com aspas em volta, ou "Tradução: ...".
  t = t.replace(/^\s*(tradução|traducao|translation)\s*:\s*/i, '').trim()
  if (t.length > 1 && /^["“'].*["”']$/.test(t)) t = t.slice(1, -1).trim()
  return esc(t).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>')
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
  if (_lerEpub.manga) return mangaTextoDaPagina(_lerLivro, i)
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
    ${_lerPreBlocoHTML()}
    ${_lerRaioXBlocoHTML()}
    <div class="ler-fer-triagem" onclick="_lerCliqueTriagem(event)">
      ${topo.map(x => `
        <span class="ler-tri" data-w="${escA(x.w)}">
          <button class="ler-tri-w" data-a="estudo" data-tip="Mandar para o Preparar com a frase do livro">
            ${esc(x.w)}${x.n > 1 ? `<i>${x.n}×</i>` : ''}
          </button>
          <button class="ler-tri-no" data-a="ignorar" data-tip="Nome próprio ou jargão que não interessa — sai da conta">${ic('x','ic-sm')}</button>
        </span>`).join('') || '<span class="ler-fer-nota">Nenhuma palavra nova por aqui.</span>'}
    </div>
    <p class="ler-fer-nota"><b>A lista de frequência:</b> clique na palavra para estudá-la, no
      <b>×</b> se for nome próprio e não valer a conta. Nada aqui pergunta se você já conhece —
      o sentido se aprende na frase, e a frase está a um arraste de mouse de distância.</p>`
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
  if (b.dataset.a === 'ignorar') lerIgnorar(palavra)
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
// A LEITURA NÃO PERGUNTA MAIS SE VOCÊ CONHECE
// ================================================================
// O QUE SAIU DAQUI (2026-08-20), e por quê. A leitura tinha dois lugares onde
// se declarava conhecer uma palavra: o ✓ de cada palavra da lista de
// frequência e a triagem por nível do QECR, que pré-marcava tudo abaixo do
// nível do aluno para ele desmarcar as exceções.
//
// A objeção que os derrubou é sobre o que significa "conhecer": o sentido de
// uma palavra se aprende DENTRO DA FRASE, e a mesma palavra que você conhece
// numa cena não é a que aparece na outra ("barrel" do fuzil não é o do
// depósito). Declarar "conheço" no nível da palavra nua promete uma coisa que
// a leitura não cumpre — e o preço é caro: a marca vale para o app inteiro e
// esconde a palavra da triagem, da cobertura e do glossário.
//
// O QUE FICOU NO LUGAR: marcar com o mouse e receber a frase traduzida na
// hora (ver "A TRADUÇÃO QUE VEM SOZINHA"). É a mesma dúvida, respondida onde
// ela nasce, sem pedir que ele classifique nada.
//
// ⚠️ O MAPA DE CONHECIDAS CONTINUA VIVO — só não se alimenta mais por aqui.
// Ele é o que impede o Kindle de sugerir de novo o que já foi descartado, e
// segue editável em Palavras. A cobertura no topo do painel também fica: ela
// mede contra esse mapa e contra os cards maduros do SRS.
//
// ⚠️ CÓDIGO ADORMECIDO: a triagem por nível (`lerClassificar`, `lerNiv*`,
// ~400 linhas mais abaixo) continua no arquivo, sem nenhum caminho na tela.
// Foi deixada inteira de propósito — é cara de reescrever e a decisão de
// aposentá-la é dele, não minha. Se for para valer, apagar o bloco todo.
let _lerDesfazer = []      // últimas marcações, para voltar atrás sem medo

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
    // Compara os dois lados, como o raio-X: sem isto, o pré-estudo feito no
    // telefone e o feito aqui conviveriam para sempre, cada um no seu canto.
    let b = null
    if (typeof geradoLerMelhor === 'function') {
      const r = await geradoLerMelhor(_lerChavePre(cap),
        { tipo: 'pre', livroId: String(_lerLivro ? _lerLivro.id : ''), cap: Number(cap) })
      b = r.texto
    } else {
      b = typeof geradoLer === 'function' ? await geradoLer(_lerChavePre(cap)) : await BookDB.get(_lerChavePre(cap))
    }
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
    // ⚠️ O comentário acima ("o trabalho foi pago, guardar é o mínimo") estava
    // certo pela metade: guardava só NESTE aparelho, e abrir o mesmo capítulo
    // no telefone mandava pagar tudo de novo. Agora vai para a nuvem junto.
    // A ficha entra aqui pelo mesmo motivo do raio-X (§8.95): sem saber QUEM
    // leu o capítulo, duas leituras do mesmo texto são indistinguíveis, e a
    // escolha entre elas vira sorteio. `ignorados` é o análogo de "falhas" —
    // resposta que a IA devolveu fora do lote e teve de ser descartada.
    await _lerGuardar(_lerChavePre(cap),
      JSON.stringify({
        v: LER_PRE_VER, itens: saida, at: Date.now(),
        ficha: typeof aiFicha === 'function'
          ? aiFicha({ lotes: lotes.length, falhas: ignorados, pedidos: itens.length, entregues: saida.length })
          : undefined
      }), 'pre', cap, saida.length)
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
  if (typeof geradoApagar === 'function') geradoApagar(_lerChavePre(cap))
  glossPreLimpar()
  toast('leitura deste capítulo apagada', 'info')
}

// O bloco da pré-análise dentro do painel de ferramentas. Fica DEPOIS da
// triagem de propósito: primeiro ele decide o que vai estudar, e só então
// oferece a leitura do resto — que é apoio para a passagem, não material de
// estudo. O texto do botão diz o que acontece e que custa.
// ================================================================
// O RAIO-X DO CAPÍTULO — o mesmo do audiolivro, agora onde ele mais lê
// ================================================================
// A peça pensante mora em `js/ai.js` (`aiAnalisarDificuldade`), não-lazy, e é
// literalmente a mesma que o Audiobook usa: nível do aluno + todo phrasal
// verb, idiom e collocation, com o que ele já sabe filtrado POR SENTIDO.
//
// ⚠️ O QUE MUDA AQUI É A TELA, e a diferença não é cosmética. No audiolivro o
// texto é uma lista de falas e cabe um chip embaixo de cada uma. Aqui o texto
// é CORRIDO E PAGINADO por colunas CSS: inserir blocos no meio dele mudaria a
// altura, a paginação seria remedida e o leitor pularia de página sozinho no
// meio da leitura. Então o texto recebe só o REALCE (que não ocupa espaço) e
// os chips vivem no painel de ferramentas, ao lado da cobertura.
//
// ⚠️ E O RESULTADO FICA NO APARELHO (`BookDB`, chave `raiox:<livro>:<cap>`),
// como a leitura de capítulo (`pre:`): são dezenas de itens por capítulo e um
// livro tem 35 — no documento do Firestore isso estouraria o teto de 1 MB.
let _lerRaioX = null          // { cap, itens[] } do capítulo aberto
let _lerRaioXCarregando = false

function _lerChaveRaioX(cap) { return `raiox:${_lerLivro.id}:${cap}` }

// TUDO O QUE ESTE LEITOR GERA PASSA POR AQUI. Guardar só no aparelho era o
// defeito que ele pegou — *"a análise que fiz no telefone não apareceu aqui"* —
// e ele valia para três coisas pagas com IA (raio-X, pré-estudo, quebra) mais
// a triagem de nível, que é trabalho manual dele. As marcas (`tipo`, `cap`, `n`)
// existem para o painel saber o que já foi feito sem baixar nada.
async function _lerGuardar(chave, valor, tipo, cap, n) {
  const marcas = { tipo, livroId: String(_lerLivro ? _lerLivro.id : ''), cap: Number(cap), n }
  if (typeof geradoGuardar === 'function') return geradoGuardar(chave, valor, marcas)
  try { await BookDB.set(chave, valor) } catch (e) {}
  return false
}

// A PROCEDÊNCIA DESTE CAPÍTULO, do jeito que o acervo a guarda. É o que deixa
// o raio-X reconhecer que um item do Preparar saiu DAQUI — e, portanto, que
// não existe "outro sentido" a anunciar.
function _lerOrigemDoCap(cap) {
  if (!_lerLivro) return null
  const i = cap == null ? _lerCap : cap
  return { source_title: _lerLivro.title || '',
           source_context: (_lerLivro.chapters[i] || {}).titulo || '' }
}

async function lerRaioXCarregar(cap) {
  if (!_lerLivro) return null
  try {
    // ⚠️ AQUI OS DOIS LADOS SÃO COMPARADOS, e não só o daqui. Era esta linha
    // que mantinha *"uma versão no telefone e outra no navegador"*: `geradoLer`
    // devolvia o local e nunca perguntava à nuvem se havia coisa melhor.
    // `geradoLerMelhor` escolhe pela ficha (inteira > nível de hoje > modelo
    // mais forte) e corrige o lado perdedor na hora.
    let g = null
    if (typeof geradoLerMelhor === 'function') {
      const r = await geradoLerMelhor(_lerChaveRaioX(cap),
        { tipo: 'raiox', livroId: String(_lerLivro.id), cap: Number(cap) })
      g = r.texto
      if (r.trocou && r.ficha) {
        // ⚠️ ANÁLISE ANTIGA NÃO TEM MODELO PARA CITAR — e inventar um nome
        // ali seria pior que não dizer nada. Nesse caso o aviso fala do que
        // dá para afirmar: ela tem mais pontos que a daqui.
        const nome = r.ficha.modelo && typeof aiNomeDoModelo === 'function'
          ? aiNomeDoModelo(r.ficha.prov, r.ficha.modelo) : ''
        toast(nome
          ? `Usei a análise do outro aparelho — feita com ${nome}`
          : `Usei a análise do outro aparelho — ${r.ficha.itens} pontos, contra ${(r.antes || {}).itens || 0} daqui`, 'info')
      }
    } else {
      g = typeof geradoLer === 'function' ? await geradoLer(_lerChaveRaioX(cap)) : await BookDB.get(_lerChaveRaioX(cap))
    }
    if (!g) return null
    const dados = typeof g === 'string' ? JSON.parse(g) : (g instanceof Blob ? JSON.parse(await g.text()) : g)
    const itens = Array.isArray(dados) ? dados : (dados.itens || null)
    // ⚠️ O rótulo guardado envelhece: entre uma leitura e outra ele estuda a
    // palavra, marca "já sei", ou a análise do Preparar termina. Sem esta
    // passada, o capítulo repetiria "outro sentido" até ser reanalisado — e
    // ninguém reanalisa 35 capítulos à mão.
    return itens && typeof aiRevalidarAchados === 'function'
      ? aiRevalidarAchados(itens, _lerOrigemDoCap(cap))
      : itens
  } catch (e) { return null }
}

// Chamada a cada troca de capítulo: se já foi analisado, o realce volta sem
// custo nenhum.
async function lerRaioXAplicar(cap) {
  _lerRaioX = null
  const itens = await lerRaioXCarregar(cap)
  if (!itens || _lerCap !== cap) return
  _lerRaioX = { cap, itens }
  _lerRaioXPintar()
}

async function lerRaioXAnalisar() {
  if (!_lerLivro || _lerRaioXCarregando) return
  if (!aiChatCfg().key) {
    toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error'); return
  }
  const cap = _lerCap
  const texto = await _lerTextoDoCapitulo(cap)
  if (!texto || texto.length < 40) { toast('Não achei texto neste capítulo.', 'warning'); return }
  _lerRaioXCarregando = true
  const area = () => el('ler-raiox-area')
  const pinta = m => { const a = area(); if (a) a.innerHTML = `<div class="ler-carregando">${esc(m)}</div>` }
  pinta('Lendo o capítulo…')
  try {
    const nivel = cefrNivelAluno()
    const itens = await aiAnalisarDificuldade({
      texto, lang: (_lerLivro.lang || 'en').slice(0, 2), nivel,
      origem: _lerOrigemDoCap(cap),
      aoAndar: (i, n) => pinta(n > 1 ? `Analisando ${i} de ${n}…` : 'Analisando…')
    })
    // A frase entra AGORA, uma vez, e não na hora de mandar ao Preparar: aqui
    // o texto do capítulo está em mãos; lá seria preciso lê-lo do zip de novo.
    for (const x of itens) x.frase = aiFraseDoTermo(texto, x.t)
    if (_lerCap !== cap) { _lerRaioXCarregando = false; return }   // trocou de capítulo no meio
    // ⚠️ A FICHA É COPIADA AQUI, e não pode ser esquecida: ela vem pendurada no
    // array (`itens.ficha`) e o `JSON.stringify` abaixo a deixaria para trás,
    // junto com a marca de análise incompleta. Foi assim que uma análise com
    // blocos falhados virava indistinguível de uma inteira.
    const pacote = {
      itens, nivel, at: Date.now(),
      ficha: itens.ficha || (typeof aiFicha === 'function'
        ? aiFicha({ blocos: itens.blocos, falhas: itens.falhas, nivel })
        : undefined)
    }
    // Guarda aqui E na nuvem: análise custa dinheiro, e o outro aparelho não
    // pode ser obrigado a pagar de novo pelo mesmo capítulo.
    await _lerGuardar(_lerChaveRaioX(cap), JSON.stringify(pacote), 'raiox', cap, itens.length)
    _lerRaioX = { cap, itens }
    _lerRaioXPintar()
    toast(itens.length
      ? `${itens.length} ${itens.length === 1 ? 'ponto difícil' : 'pontos difíceis'} para o seu ${nivel}`
      : (itens.incompleto ? 'Parte da análise não voltou legível — vale rodar de novo'
                          : `Nada acima do seu ${nivel} neste capítulo`),
      itens.length ? 'success' : (itens.incompleto ? 'warning' : 'info'))
  } catch (e) {
    console.warn('[ler] raio-x:', e)
    toast('Não consegui analisar: ' + e.message, 'error')
  }
  _lerRaioXCarregando = false
  _lerRenderFerramentas()
}

async function lerRaioXApagar() {
  if (!_lerLivro) return
  try { await BookDB.del(_lerChaveRaioX(_lerCap)) } catch (e) {}
  _lerRaioX = null
  _lerRaioXDespintar()
  _lerRenderFerramentas()
}

// ---- o realce no texto do capítulo ----
// Mesmo mecanismo do `_lerRepintar` (TreeWalker + fragmento), com classe
// própria: as duas pinturas convivem sem uma apagar a outra.
function _lerRaioXDespintar() {
  const cont = el('ler-conteudo'); if (!cont) return
  cont.querySelectorAll('mark.ler-dif').forEach(m => m.replaceWith(document.createTextNode(m.textContent)))
  cont.normalize()
}

// ⚠️ O REALCE PRECISA DE UMA AÇÃO, e a lição veio dele em duas frases. Primeiro
// *"não tá aparecendo chip. Como que faz pra mandar pro Preparar?"* — os chips
// estavam no painel de ferramentas, atrás de um ícone, longe do texto. Depois,
// vendo a primeira tentativa: *"ao passar o mouse, em vez de só aparecer a
// tradução, aparece o chip."*
//
// A peça vive em `js/ai.js` (`difChipLigar`) porque o Audiobook usa a mesma —
// ele pediu igual lá depois de ver aqui.
function _lerRaioXLigarClique(cont) {
  if (!cont || typeof difChipLigar !== 'function') return
  difChipLigar(cont, {
    classe: 'dif-pop-papel',
    varsDe: document.querySelector('.ler-leitor'),
    item: mk => (_lerRaioX && (_lerRaioX.itens || [])[Number(mk.dataset.i)]) || null,
    preparar: mk => lerRaioXPreparar(Number(mk.dataset.i)),
    jaSei: mk => lerRaioXJaSei(Number(mk.dataset.i))
  })
}

function _lerRaioXPintar() {
  const cont = el('ler-conteudo'); if (!cont || !_lerRaioX) return
  _lerRaioXLigarClique(cont)
  _lerRaioXDespintar()
  const itens = _lerRaioX.itens || []
  if (!itens.length) return
  // Do maior para o menor: sem isto, "put up" acenderia dentro de
  // "put up with" e a expressão inteira nunca seria marcada.
  const ordem = itens.map((x, i) => ({ ...x, i }))
    .filter(x => x.t && x.t.length > 1)
    .sort((a, b) => b.t.length - a.t.length)
  const escapa = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp('\\b(' + ordem.slice(0, 400).map(x => escapa(x.t)).join('|') + ')\\b', 'gi')
  const tipoDe = new Map(ordem.map(x => [x.t.toLowerCase(), x]))

  const andarilho = document.createTreeWalker(cont, NodeFilter.SHOW_TEXT)
  const nos = []
  let n
  while ((n = andarilho.nextNode())) {
    if (n.parentElement && n.parentElement.closest('mark.ler-dif')) continue
    if (n.nodeValue && n.nodeValue.length > 1 && re.test(n.nodeValue)) nos.push(n)
    re.lastIndex = 0
  }
  for (const no of nos) {
    const frag = document.createDocumentFragment()
    let ultimo = 0, m
    re.lastIndex = 0
    while ((m = re.exec(no.nodeValue))) {
      if (m.index > ultimo) frag.appendChild(document.createTextNode(no.nodeValue.slice(ultimo, m.index)))
      const achado = tipoDe.get(m[0].toLowerCase())
      const mk = document.createElement('mark')
      // ⚠️ O REALCE NÃO DIZIA NADA SOBRE O QUE JÁ É DELE. `cellar` está marcada
      // como conhecida desde agosto e era sublinhada EXATAMENTE como uma palavra
      // nova — ele leu isso como "voltou a ficar desconhecido", e estava certo:
      // a tela não distinguia. O esmaecido existia só no chip da lista, que nem
      // é mais a forma de ver isto. Agora o traço do que já é dele é fraco, e o
      // do que é novidade é cheio.
      mk.className = 'ler-dif ler-dif-' + ((achado && achado.tipo) || 'word') +
        (achado && (achado.ja || achado.feito) ? ' ler-dif-ja' : '')
      mk.dataset.i = achado ? achado.i : ''
      // Sem `title`: o tooltip nativo competia com o chip do hover e piscava por
      // cima dele. Quem mostra a glosa (e as ações) agora é `_lerDifAbrir`.
      mk.dataset.pt = achado && achado.pt ? achado.pt : ''
      mk.textContent = m[0]
      frag.appendChild(mk)
      ultimo = m.index + m[0].length
    }
    if (ultimo < no.nodeValue.length) frag.appendChild(document.createTextNode(no.nodeValue.slice(ultimo)))
    no.replaceWith(frag)
  }
}

// OS CAPÍTULOS QUE VALE ANALISAR — e é uma lista diferente da do sumário.
// O sumário responde "onde eu leio"; esta responde "onde há texto para a IA
// olhar". Página de rosto, dedicatória e página de parte não têm o que
// analisar, e o par emendado tem de aparecer UMA vez, apontando para o pedaço
// que carrega o texto. Sem isto o painel mostrava "Part One, Part One, Part
// Two, Part Two, Part Three, Part Three" — foi o que ele viu no Carrie.
const LER_ANALISE_MIN = 50      // palavras: abaixo disto não há o que medir
function _lerCapsAnalisaveis() {
  const caps = (_lerLivro && _lerLivro.chapters) || []
  const m = _lerMapaSumario()
  const out = []
  for (const l of m.linhas) {
    if (l.grupo !== 'corpo') continue      // créditos e "outros livros" não têm o que analisar
    const i = (m.conteudoDe && m.conteudoDe[l.i] !== undefined) ? m.conteudoDe[l.i] : l.i
    const c = caps[i]
    if (!c || (c.words || 0) < LER_ANALISE_MIN) continue
    out.push({ i, nome: l.nome })
  }
  return out
}

// ---- O PAINEL DO RAIO-X: os capítulos, e o que já foi analisado ----
// Pedido dele: *"quero que essa nova função fique bem evidente em um botão seu,
// e que ao clicar apareçam os capítulos do livro, mostre o spark nos capítulos
// já processados, e ao clicar no capítulo sem ele gere o processamento."*
//
// ⚠️ Botão PRÓPRIO, e não mais um item dentro do painel de ferramentas. A
// função estava atrás de um ícone que abre outra coisa (cobertura, frequência,
// leitura por IA) — ele mesmo perguntou "como é que ativa isso?". Coisa que se
// usa capítulo a capítulo precisa de porta própria.
//
// E a lista responde à pergunta que só ela responde: **o que já foi analisado
// e o que falta**. Sem ela, descobrir isso exigiria entrar em cada capítulo.
let _lerRaioXMapa = null      // { [cap]: quantidade }

async function lerRaioXPainel() {
  const p = el('ler-raiox-painel')
  if (p && p.classList.contains('aberto')) { p.classList.remove('aberto'); return }
  // ⚠️ O NOME BOM NÃO PODE DEPENDER DE ELE TER ABERTO O SUMÁRIO ANTES. A
  // descoberta de nome (e a emenda do arquivo partido) morava só lá — quem
  // abrisse este painel primeiro via "News item from the Westover. . ." em vez
  // de "Part One". É a mesma lista de capítulos; tem de dizer a mesma coisa.
  try { await _lerNomearPeloConteudo() } catch (e) {}
  await _lerRaioXMapear()
  _lerRaioXPainelRender()
  el('ler-raiox-painel').classList.add('aberto')
}

// Uma varredura só do IndexedDB: as chaves dizem quais capítulos têm análise.
async function _lerRaioXMapear() {
  _lerRaioXMapa = {}
  if (!_lerLivro) return
  // ⚠️ A NUVEM ENTRA PRIMEIRO. Sem isto, um capítulo analisado no telefone
  // aparecia como "analisar" no computador — e o clique cobraria a análise de
  // novo. As chaves locais escrevem por cima logo abaixo, o que é o certo:
  // aqui a contagem é a que ele acabou de ver.
  try {
    if (typeof geradoDoLivro === 'function') {
      _lerRaioXMapa = await geradoDoLivro(_lerLivro.id, 'raiox')
    }
  } catch (e) {}
  try {
    const pre = `raiox:${_lerLivro.id}:`
    for (const k of await BookDB.keys()) {
      if (typeof k !== 'string' || !k.startsWith(pre)) continue
      const cap = Number(k.slice(pre.length))
      const dados = await BookDB.get(k)
      const obj = typeof dados === 'string' ? JSON.parse(dados) : dados
      const itens = Array.isArray(obj) ? obj : (obj && obj.itens) || []
      _lerRaioXMapa[cap] = itens.length
    }
  } catch (e) { console.warn('[ler] mapa do raio-x:', e && e.message) }
}

function _lerRaioXPainelRender(msg) {
  let p = el('ler-raiox-painel')
  if (!p) {
    p = document.createElement('div')
    p.id = 'ler-raiox-painel'
    p.className = 'ler-raiox-painel'
    p.addEventListener('click', e => e.stopPropagation())
    document.body.appendChild(p)
    setTimeout(() => document.addEventListener('click', () => p.classList.remove('aberto')), 0)
  }
  const caps = _lerCapsAnalisaveis()
  const feitos = caps.filter(x => (_lerRaioXMapa || {})[x.i]).length
  p.innerHTML = `
    <div class="ler-raiox-topo">
      <b>${ic('eye','ic-sm')} O que é difícil aqui</b>
      <span>${feitos} de ${caps.length} ${caps.length === 1 ? 'capítulo' : 'capítulos'} analisados · nível ${esc(cefrNivelAluno())}</span>
    </div>
    ${msg ? `<div class="ler-raiox-msg">${esc(msg)}</div>` : ''}
    <div class="ler-raiox-lista">
      ${_lerCapsAnalisaveis().map(({ i, nome }) => {
        const n = (_lerRaioXMapa || {})[i]
        return `<button class="ler-raiox-cap${i === _lerCap ? ' atual' : ''}${n ? ' feito' : ''}"
                  onclick="lerRaioXDoCapitulo(${i})">
          <span class="ler-raiox-spark">${n ? ic('sparkles','ic-sm') : ''}</span>
          <span class="ler-raiox-nome">${esc(nome)}</span>
          <span class="ler-raiox-n">${n ? n : 'analisar'}</span>
          ${n ? `<span class="ler-raiox-refaz" role="button" tabindex="0"
                   onclick="event.stopPropagation();lerRaioXRefazer(${i})"
                   data-tip="Analisar este capítulo de novo, do zero — descarta a análise atual e gasta uma chamada de IA"
                   >refazer</span>` : ''}
        </button>`
      }).join('')}
    </div>
    <p class="est-dica">Capítulo com <b>${ic('sparkles','ic-3xs')}</b> já foi analisado — o clique
      leva até ele. Sem a marca, o clique manda analisar.</p>`
  const btn = el('ler-raiox-btn')
  if (btn) {
    const r = btn.getBoundingClientRect()
    p.style.top = Math.round(r.bottom + 8) + 'px'
    p.style.left = Math.round(Math.max(8, Math.min(r.left - 120, innerWidth - 340))) + 'px'
  }
}

// REFAZER A ANÁLISE — pedido dele ao ver o painel: *"não tem a opção de
// reanalisar"*. E não tinha mesmo: capítulo com a marca só levava até ele, e a
// única saída era apagar pelo painel de ferramentas, que fica noutro lugar.
//
// ⚠️ REFAZER É ESCOLHA HUMANA, E PRECISA DE CARIMBO. `geradoLerMelhor` escolhe
// entre o daqui e o da nuvem por heurística, e **mais itens ganha**. Uma
// análise nova e melhor com MENOS apontamentos perderia para a antiga guardada
// no outro aparelho — e voltaria sozinha na próxima abertura. `geradoFixar`
// carimba "esta é a boa", e o carimbo vence a heurística por desenho.
async function lerRaioXRefazer(i) {
  if (!_lerLivro || _lerRaioXCarregando) return
  const nome = lerCapNome(i)
  if (!confirm(`Analisar "${nome}" de novo?

A análise atual é descartada e uma nova chamada de IA é feita.`)) return
  if (i !== _lerCap) await lerIrParaCapitulo(i, 0)
  try { await BookDB.del(_lerChaveRaioX(i)) } catch (e) {}
  _lerRaioX = null
  _lerRaioXDespintar()
  await lerRaioXAnalisar()
  if (typeof geradoFixar === 'function') {
    try { await geradoFixar(_lerChaveRaioX(i), { tipo: 'raiox', livroId: String(_lerLivro.id), cap: Number(i) }) } catch (e) {}
  }
  await _lerRaioXMapear()
  _lerRaioXPainelRender()
  el('ler-raiox-painel')?.classList.add('aberto')
}

// Clique num capítulo: vai até ele e, se ainda não tiver análise, manda fazer.
async function lerRaioXDoCapitulo(i) {
  const jaTem = (_lerRaioXMapa || {})[i]
  if (i !== _lerCap) await lerIrParaCapitulo(i, 0)
  if (jaTem) { el('ler-raiox-painel')?.classList.remove('aberto'); return }
  _lerRaioXPainelRender('Analisando este capítulo…')
  await lerRaioXAnalisar()
  await _lerRaioXMapear()
  _lerRaioXPainelRender()
}

// ---- o bloco no painel de ferramentas ----
function _lerRaioXBlocoHTML() {
  const nivel = cefrNivelAluno()
  if (!_lerRaioX) {
    return `<div class="ler-pre" id="ler-raiox-area">
      <button class="btn btn-secondary btn-sm" onclick="lerRaioXAnalisar()">
        ${ic('eye','ic-sm')} O que é difícil aqui</button>
      <p class="ler-fer-nota">Acende no texto o que está <b>acima do seu ${esc(nivel)}</b> e
        <b>todo phrasal verb, idiom e collocation</b> — esses independem de nível, porque o que
        trava não é a palavra rara: <i>put up with</i> são três palavras fáceis que juntas
        significam outra coisa. O que você já estuda <b>com aquele mesmo sentido</b> fica de fora.</p>
    </div>`
  }
  const itens = _lerRaioX.itens || []
  const novos = itens.filter(x => !x.ja).length
  return `<div class="ler-pre" id="ler-raiox-area">
    <div class="ler-pre-ok">${ic('check','ic-sm')} ${itens.length
      ? `${novos} ${novos === 1 ? 'ponto difícil' : 'pontos difíceis'}${itens.length - novos ? ` · ${itens.length - novos} você já tem` : ''}`
      : `Nada acima do seu ${esc(nivel)} aqui`}</div>
    ${itens.length ? `<div class="ler-dif-lista">${itens.map((x, i) => `
      <span class="ler-dif-par">
        <button class="ler-dif-chip ler-dif-${x.tipo}${x.ja ? ' ja' : ''}" onclick="lerRaioXPreparar(${i})"
                data-tip="${escA(AI_DIF_TIPOS[x.tipo].rotulo + (x.nivel ? ' · ' + x.nivel : '') + (
                  x.ja === 'outro' ? ' — você tem esta palavra com OUTRO sentido'
                  : x.ja === 'marcada' ? ' — você marcou como conhecida'
                  : x.ja === 'fila' ? ' — já está no Preparar (sem análise ainda, não dá para comparar o sentido)'
                  : x.ja === 'fila-outro' ? ' — está no Preparar, mas com OUTRO sentido'
                  : ' — clique para mandar ao Preparar'))}">
          <b>${esc(x.t)}</b>${x.pt ? `<i>${esc(x.pt)}</i>` : ''}
        </button>
        <button class="ler-dif-sei" onclick="lerRaioXJaSei(${i})"
                data-tip="Já sei esta palavra COM ESTE sentido — não aparece mais">${ic('check','ic-3xs')}</button>
      </span>`).join('')}</div>` : ''}
    <button class="btn btn-ghost btn-sm" onclick="lerRaioXApagar()">${ic('refresh','ic-sm')} Analisar de novo</button>
    <button class="btn btn-ghost btn-sm" onclick="lerRaioXFixar()"
            data-tip="Manda esta análise para a nuvem como a boa — os outros aparelhos passam a usar ela">
      ${ic('cloud','ic-sm')} Usar esta em todos os aparelhos</button>
  </div>`
}

// ⚠️ ESTE BOTÃO EXISTE PORQUE A REGRA AUTOMÁTICA TEM UM PONTO CEGO, e ele
// aparece justamente no acervo dele: entre duas análises ANTIGAS (feitas antes
// da ficha técnica), o desempate cai em "mais itens" — e mais itens não é
// sinônimo de melhor. Um modelo tagarela pode devolver quarenta apontamentos
// ruins e ganhar de quinze bons.
// Quando ELE olha as duas e sabe qual presta, a escolha humana tem de valer
// mais que qualquer heurística — mesmo desenho do status "Parado" na estante
// (§8.54), o único que o app nunca atribui sozinho.
async function lerRaioXFixar() {
  if (!_lerLivro || !_lerRaioX) return
  const chave = _lerChaveRaioX(_lerCap)
  const bruto = await BookDB.get(chave)
  if (!bruto) { toast('Não achei esta análise guardada aqui.', 'error'); return }
  if (typeof geradoFixar !== 'function') { toast('Entre na sua conta para mandar para os outros aparelhos.', 'warning'); return }
  const ok = await geradoFixar(chave, { tipo: 'raiox', livroId: String(_lerLivro.id), cap: Number(_lerCap) })
  toast(ok
    ? 'Pronto — esta é a análise que vale nos seus aparelhos'
    : 'Não consegui mandar agora. Confira a conexão e a sua conta.', ok ? 'success' : 'error')
}

// "Já sei este sentido": tira do texto, tira da lista e ensina o filtro para as
// próximas análises — em qualquer livro, porque a marca é do PAR termo+sentido.
async function lerRaioXJaSei(i) {
  const x = _lerRaioX && (_lerRaioX.itens || [])[i]
  if (!x) return
  if (typeof markKnownSense !== 'function' || !markKnownSense(x.t, x.pt)) {
    toast('Não consegui marcar este sentido.', 'error'); return
  }
  _lerRaioX.itens = _lerRaioX.itens.filter((_, k) => k !== i)
  try {
    const pacote = { itens: _lerRaioX.itens, nivel: cefrNivelAluno(), at: Date.now() }
    await _lerGuardar(_lerChaveRaioX(_lerCap), JSON.stringify(pacote), 'raiox', _lerCap, _lerRaioX.itens.length)
  } catch (e) {}
  _lerRaioXPintar()
  _lerRenderFerramentas()
  toast(`"${x.t}" (${x.pt}) marcado como conhecido`, 'success')
}

async function lerRaioXPreparar(i) {
  const x = _lerRaioX && (_lerRaioX.itens || [])[i]
  if (!x || typeof lexaChipParaPreparar !== 'function') return
  lexaChipParaPreparar(
    { expr: x.t, gloss: x.pt || '', type: x.tipo === 'word' ? 'word' : x.tipo },
    { contexto: x.frase || '', lang: (_lerLivro.lang || 'en').slice(0, 2),
      source_type: 'kindle', source_title: _lerLivro.title || '',
      source_context: lerCapNome(_lerCap) })
  // ⚠️ O TRAÇO TEM DE ESMAECER AQUI TAMBÉM. A regra "o que já é seu tem traço
  // fraco" existia só para o "Já sei" — mandar para o Preparar deixava o
  // realce CHEIO, e ele leu isso, com razão, como "não registrou". Marcar como
  // conhecido e mandar estudar são coisas diferentes, mas as duas significam
  // *já lidei com isto*, e é o que o olho precisa ver ao reler a página.
  x.feito = 1
  try {
    const pacote = { itens: _lerRaioX.itens, nivel: cefrNivelAluno(), at: Date.now() }
    await _lerGuardar(_lerChaveRaioX(_lerCap), JSON.stringify(pacote), 'raiox', _lerCap, _lerRaioX.itens.length)
  } catch (e) {}
  _lerRaioXPintar()
}

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
// 🛑 ADORMECIDO DESDE 2026-08-20. Nada nesta seção é chamado pela tela: o
// painel de ferramentas parou de renderizar `_lerNivBlocoHTML()` quando o
// "conheço / não conheço" saiu do caminho da leitura (a explicação inteira
// está no bloco "A LEITURA NÃO PERGUNTA MAIS SE VOCÊ CONHECE"). O código fica
// intacto — inclusive o que já está gravado no BookDB — para o caso de ele
// querer o recurso de volta. Se decidir que não, apague daqui até o fim de
// `_lerNivBlocoHTML`.
//
// O problema que isto resolvia: um capítulo traz 647 palavras "novas", mas a
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
    // ⚠️ ISTO É TRABALHO MANUAL DELE: sim/não em centenas de palavras. Perder
    // ao trocar de aparelho dói mais que perder uma análise de IA, porque não
    // dá para "pagar de novo" — tem de refazer no braço.
    _lerGuardar(chave, JSON.stringify({ v: LER_NIV_VER, marca, at: Date.now() }), 'nivmarca', _lerCap)
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
    const b = typeof geradoLer === 'function' ? await geradoLer(_lerChaveNivMarca(_lerNiv.chave))
                                             : await BookDB.get(_lerChaveNivMarca(_lerNiv.chave))
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
    const b = typeof geradoLer === 'function' ? await geradoLer(_lerChaveNiv(cap))
                                             : await BookDB.get(_lerChaveNiv(cap))
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

    await _lerGuardar(_lerChaveNiv(cap),
      JSON.stringify({ v: LER_NIV_VER, itens: saida, at: Date.now() }), 'niv', cap, saida.length)
    // Classificação nova = triagem nova. Marcas de uma classificação anterior
    // apontam para uma lista que não existe mais, e ressuscitá-las daria a
    // pior impressão possível: palavra marcada como conhecida sem ele ter
    // olhado. "Refazer" recomeça do palpite.
    await BookDB.del(_lerChaveNivMarca(_lerChaveNiv(cap)))
    if (typeof geradoApagar === 'function') geradoApagar(_lerChaveNivMarca(_lerChaveNiv(cap)))
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
      // Mangá: o texto de cada página são os balões já lidos, e eles já estão
      // aqui — nada de decodificar o CBZ como se fosse texto.
      if (livro.format === 'manga') {
        txtCaps = (livro.chapters || []).map((c, n) => ({ html: esc(mangaTextoDaPagina(livro, n)) }))
      }
      else if (livro.format === 'epub') ep = await epubAbrir(await blob.arrayBuffer())
      else {
        const buf = await blob.arrayBuffer()
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
  let dados
  // ⚠️ MANGÁ NÃO PASSA POR AQUI PARA LER O ARQUIVO. O texto dele já está
  // guardado nos balões de cada página — abrir o CBZ não daria texto nenhum,
  // e cair no ramo `else` decodificaria um ZIP binário como UTF-8: lixo puro,
  // que o Estudar tomaria por "o que o livro diz".
  if (livro.format === 'manga') {
    _obrLivro.set(livro.id, { manga: true, nCaps: (livro.chapters || []).length })
    return _obrLivro.get(livro.id)
  }
  const buf = await blob.arrayBuffer()
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
    if (d.manga) t = _repEspacos(mangaTextoDaPagina(livro, i))
    else if (d.txtCaps) t = _repEspacos(epubTextoLimpo((d.txtCaps[i] || {}).html || ''))
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
      trechos.push({ cap: i, titulo: lerCapNome(i),
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
