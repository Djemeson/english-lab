// ================================================================
// MANGÁ — CBZ com o texto dos balões selecionável POR CIMA da imagem
// ================================================================
// ⚠️ LAZY, no pacote de `ler` (ver `_LAZY` em core.js). Vem DEPOIS de
// epub.js, porque usa `zipAbrir()` dele, e ANTES de ler.js, que chama as
// funções daqui. Nada neste arquivo pode ser usado por arquivo do shell.
//
// A ideia inteira em uma frase: **a página continua sendo a imagem original**;
// por cima dela vai o texto de cada balão, transparente e alinhado. O leitor
// já usa a seleção NATIVA do navegador, então selecionar uma fala do mangá
// cai no mesmo caminho de selecionar uma frase do livro — a Lexa, o card, a
// procedência e os destaques vêm de graça, sem uma linha a mais.
//
// Por que não OCR comum: em página inteira de quadrinho ele erra mais de 70%
// (balão torto, letra desenhada, onomatopeia no meio do rosto). O modelo de
// visão acerta — medido: 7 balões em 7, pelo modelo MAIS BARATO da casa, a
// R$ 0,0053 a página (~R$ 0,96 o volume de 180). Ver ESTADO §8.19.
// ================================================================
'use strict'

// Extensões de imagem que aparecem dentro de um CBZ no mundo real.
const MG_IMG = /\.(jpe?g|png|webp|gif|avif|bmp)$/i

// ---------------------------------------------------------------
// Detecção e abertura
// ---------------------------------------------------------------

// CBZ e EPUB são os dois ZIP: "PK" no começo. O que separa é o conteúdo —
// EPUB tem `META-INF/container.xml`, CBZ tem imagens soltas. Decidir pelo
// NOME do arquivo falharia com quem renomeia .cbz para .zip, que é comum.
function mangaEhCbz(zip) {
  if (zip.arquivos.has('META-INF/container.xml')) return false
  return mangaPaginas(zip).length > 0
}

// As páginas em ordem de leitura. `numeric: true` é o ponto: sem ele
// "pagina-10" vem antes de "pagina-2", e o volume inteiro fica embaralhado.
// O `__MACOSX` é a pasta-fantasma que o Finder enfia em todo ZIP feito no Mac;
// dentro dela há uma cópia de cada imagem, e sem o filtro o volume dobra de
// tamanho e cada página aparece duas vezes.
function mangaPaginas(zip) {
  return [...zip.arquivos.keys()]
    .filter(n => MG_IMG.test(n) && !n.includes('__MACOSX') && !n.split('/').pop().startsWith('.'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

async function mangaAbrir(buf) {
  const zip = await zipAbrir(buf)
  const paginas = mangaPaginas(zip)
  if (!paginas.length) throw new Error('não achei nenhuma imagem nesse arquivo')
  return { zip, paginas, blobs: [] }
}

// Metadados para a estante. Cada página vira um "capítulo" do leitor: é o que
// faz o progresso ser honesto (você está na 40 de 180) e o sumário virar um
// índice de páginas, sem inventar estrutura que o CBZ não tem.
async function mangaMeta(zip, nomeArquivo) {
  const paginas = mangaPaginas(zip)
  return {
    // ⚠️ O `.replace(/\s+/g,' ')` no fim NÃO é enfeite: "One Piece - Vol 100"
    // vira "One Piece   Vol 100" com três espaços quando o hífen cercado de
    // espaços é trocado por mais um espaço. Foi o que apareceu no volume dele.
    title: String(nomeArquivo || '').replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Sem título',
    author: '', lang: 'en', format: 'manga',
    chapters: paginas.map((href, i) => ({
      id: 'p' + i, href, titulo: `Página ${i + 1}`,
      // Sem os balões lidos ainda não há texto; a contagem se corrige sozinha
      // quando a página é lida (ver `_mgAplicar`). Zero aqui seria "livro
      // vazio" para o progresso — 1 mantém a barra sã até a leitura chegar.
      chars: 1, words: 1, baloes: null,
    })),
    cover: await _mgCapa(zip, paginas[0]),
  }
}

async function _mgCapa(zip, primeira) {
  try {
    const bytes = await zip.bytes(primeira)
    if (!bytes) return ''
    const url = URL.createObjectURL(new Blob([bytes]))
    const img = new Image()
    await new Promise((ok, erro) => { img.onload = ok; img.onerror = erro; img.src = url })
    const L = 220
    const cv = document.createElement('canvas')
    cv.width = L
    cv.height = Math.round(L * (img.naturalHeight / img.naturalWidth)) || L
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
    URL.revokeObjectURL(url)
    return cv.toDataURL('image/jpeg', 0.7)
  } catch { return '' }
}

// ---------------------------------------------------------------
// A página na tela
// ---------------------------------------------------------------

// Cada balão é um <span> de texto REAL, transparente, esticado sobre o balão
// desenhado. Tudo em PORCENTAGEM: a imagem responde ao zoom e à largura da
// tela, e o texto acompanha sozinho — nada de recalcular posição no resize.
//
// ⚠️ O texto é transparente, não `display:none` nem `visibility:hidden`:
// esses dois tiram o elemento da seleção, e a seleção é o ponto do módulo.
async function mangaHtmlDaPagina(mg, livro, i) {
  const c = livro.chapters[i]
  if (!c) return ''
  const bytes = await mg.zip.bytes(c.href)
  if (!bytes) return '<p class="ler-carregando">(página não encontrada no arquivo)</p>'
  const url = URL.createObjectURL(new Blob([bytes]))
  mg.blobs.push(url)

  const baloes = Array.isArray(c.baloes) ? c.baloes : []
  const camada = baloes.map((b, n) => {
    const est = `left:${(b.x * 100).toFixed(3)}%;top:${(b.y * 100).toFixed(3)}%;` +
                `width:${(b.w * 100).toFixed(3)}%;height:${(b.h * 100).toFixed(3)}%`
    return `<span class="mg-balao" style="${est}" data-b="${n}" onclick="mangaTocarBalao(this)">${esc(b.t || '')}</span>`
  // ⚠️ A QUEBRA ENTRE OS BALÕES NÃO É ENFEITE. Sem ela os spans são irmãos
  // colados, e o contexto que vai para a Lexa sai grudado: "CALL HER
  // HERE!!CALL NICO ROBIN!!!" — duas falas viram uma palavra impossível.
  // Com a quebra, o contexto continua sendo a PÁGINA inteira (que é o que
  // ela precisa para entender a cena), só que legível.
  }).join('\n')

  const aviso = baloes.length ? '' :
    (c.baloes === null
      ? `<div class="mg-aviso" data-pg="${i}">${ic('sparkles')} <span>Esta página ainda não foi lida.</span>
           <button class="btn btn-primary btn-sm" onclick="mangaLerPagina(${i})">Ler os balões</button></div>`
      : `<div class="mg-aviso mg-aviso-vazio">${ic('info')} <span>Nenhum balão de fala nesta página.</span></div>`)

  return `<div class="mg-pagina">
    <img class="mg-img" src="${url}" alt="Página ${i + 1}">
    <div class="mg-camada">${camada}</div>
  </div>${aviso}`
}

// ⚠️ UM TOQUE PEGA A FALA INTEIRA — e isto é o que torna a imprecisão da
// caixa irrelevante. MEDIDO: o texto sai 7/7 em toda chamada, mas a caixa
// OSCILA entre chamadas (7 centros certos numa, 5 na seguinte, com o mesmo
// código e a mesma página). Se a leitura dependesse de arrastar o dedo com
// precisão sobre um texto que não se vê, esse tremor viraria "às vezes não
// funciona" — o pior defeito que existe, porque não dá para reproduzir.
//
// Tocando, basta o balão estar mais ou menos onde está. E é o gesto que a
// pessoa já faria: no mangá se lê balão a balão, não palavra a palavra.
// Arrastar continua funcionando para quem quer só uma expressão.
function mangaTocarBalao(elemento) {
  try {
    const sel = window.getSelection()
    sel.removeAllRanges()
    const r = document.createRange()
    r.selectNodeContents(elemento)
    sel.addRange(r)
    // O leitor ouve `mouseup` e lê a seleção 10ms depois. O clique chega antes
    // desse prazo, então a seleção que ele encontra já é esta — nada a
    // disparar à mão, e o caminho continua sendo o mesmo do livro.
  } catch (e) { console.warn('[mangá] não consegui selecionar o balão:', e.message) }
}

// ---------------------------------------------------------------
// A leitura dos balões
// ---------------------------------------------------------------

const MG_PEDIDO = `You are reading ONE page of an English-language manga/comic.

Return ONLY JSON, no prose:
{"balloons":[{"text":"...","box_2d":[ymin,xmin,ymax,xmax]}],"sfx":["..."]}

Rules:
- One entry per SPEECH BALLOON (also thought balloons and caption boxes).
- "text": the dialogue exactly as printed. Join broken lines into one sentence
  with single spaces. Keep punctuation and apostrophes. NEVER translate.
- "box_2d": bounding box of the balloon's TEXT as [ymin, xmin, ymax, xmax],
  normalized to 0-1000.
- Order: natural reading order for this page.
- "sfx": sound effects drawn OUTSIDE balloons. Text only, no boxes.
- If the page has no dialogue at all, return {"balloons":[],"sfx":[]}.`

// Uma chamada por página, de propósito. Um volume são ~180 páginas: mandar
// tudo de uma vez seria uma requisição gigante que, ao falhar no meio,
// perderia tudo. Página a página, o que já foi lido está guardado e a
// retomada custa só o que falta — e o custo total é o mesmo.
async function mangaLerPagina(i, silencioso) {
  const livro = _lerLivro
  const mg = _lerEpub && _lerEpub.manga
  if (!livro || !mg) return false
  const c = livro.chapters[i]
  if (!c) return false
  if (Array.isArray(c.baloes)) return true          // já lida

  const { key } = aiChatCfg()
  if (!key) { toast('Configure a chave da IA para ler os balões', 'warning'); return false }

  const bytes = await mg.zip.bytes(c.href)
  if (!bytes) return false
  const b64 = await _mgBase64(bytes)

  if (!silencioso) _mgAviso(i, 'lendo a página…')
  try {
    const resp = await aiVisaoJSON(MG_PEDIDO, b64)
    const brutos = Array.isArray(resp && resp.balloons) ? resp.balloons : []
    _mgAplicar(livro, i, brutos, resp && resp.sfx)
    saveLivros()
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
    // Só redesenha se ainda for esta a página aberta — numa leitura em lote o
    // usuário continua virando páginas, e repintar por baixo dele seria pior
    // que não mostrar nada.
    // ⚠️ NÃO remontar o leitor aqui. No fluxo contínuo, `lerIrParaCapitulo`
    // reconstruiria o volume inteiro e jogaria você para o começo — justo no
    // momento em que está lendo aquela página. Repinta só a camada dela.
    if (!mangaRepintarPagina(livro, i) && !silencioso && _lerCap === i) {
      await lerIrParaCapitulo(i, 0)
    }
    return true
  } catch (e) {
    console.warn('[mangá] não li a página', i + 1, e && e.message)
    if (!silencioso) _mgAviso(i, 'não consegui ler: ' + (e.message || 'erro'), true)
    return false
  }
}

// ⚠️ A CAIXA QUE O MODELO DEVOLVE PRECISA SER CONFERIDA. Se vier torta ou
// fora da página, o texto invisível fica longe do balão e a seleção parece
// quebrada sem nenhum erro no console — é o pior tipo de defeito, o mudo.
// Aqui: descarta o que não é número, prende tudo dentro da página, joga fora
// caixa de área ridícula e balão sem texto.
function _mgAplicar(livro, i, brutos, sfx) {
  const num = (v, padrao) => (typeof v === 'number' && isFinite(v)) ? v : padrao
  const preso = (v, min, max) => Math.max(min, Math.min(max, v))
  const escala = _mgEscala(brutos)
  const bons = []
  for (const b of brutos) {
    const t = String((b && b.t) || (b && b.text) || '').replace(/\s+/g, ' ').trim()
    if (!t) continue
    const cx = _mgCaixa(b, escala)
    if (!cx) continue
    let { x, y, w, h } = cx
    x = preso(x, 0, 1); y = preso(y, 0, 1); w = preso(w, 0, 1); h = preso(h, 0, 1)
    // Uma folga pequena em volta: a caixa do modelo é justa no TEXTO, e um
    // alvo colado nas letras é difícil de pegar com o dedo. 1,5% de cada lado
    // cobre a borda do balão sem chegar no vizinho.
    const fx = Math.min(0.015, w * 0.12), fy = Math.min(0.015, h * 0.18)
    x = Math.max(0, x - fx); y = Math.max(0, y - fy)
    w = Math.min(1 - x, w + fx * 2); h = Math.min(1 - y, h + fy * 2)
    if (x + w > 1) w = 1 - x
    if (y + h > 1) h = 1 - y
    // Caixa degenerada: o texto ficaria espremido num ponto e impossível de
    // acertar com o dedo. 1,2% de cada lado é o menor alvo de toque decente.
    if (w < 0.012 || h < 0.012) continue
    bons.push({ t, x: +x.toFixed(4), y: +y.toFixed(4), w: +w.toFixed(4), h: +h.toFixed(4) })
  }
  const c = livro.chapters[i]
  c.baloes = bons
  c.sfx = Array.isArray(sfx) ? sfx.filter(s => typeof s === 'string').slice(0, 12) : []
  // Agora dá para contar de verdade — e é isto que faz o progresso do volume
  // deixar de ser "180 páginas de peso 1" e virar peso pelo que há para ler.
  const texto = bons.map(b => b.t).join(' ')
  c.chars = texto.length || 1
  c.words = _lerContaPalavras(texto) || 1
  livro.totalChars = livro.chapters.reduce((s, x) => s + (x.chars || 0), 0)
  livro.totalWords = livro.chapters.reduce((s, x) => s + (x.words || 0), 0)
  livro.updatedAt = Date.now()
}

// A caixa, venha ela no formato que vier.
//
// ⚠️ PEDIR `x, y, w, h` FOI ERRO MEU. Medido: com esse formato a altura vinha
// entre 2x e **5x** a real (h 0,424 onde o certo era 0,079) — o modelo mistura
// largura/altura com as bordas e o resultado oscila balão a balão. Trocado por
// `box_2d: [ymin, xmin, ymax, xmax]` em 0–1000, que é a convenção NATIVA do
// Gemini para caixa, o centro passou a cair dentro do balão em **7 de 7**.
//
// A lição: não é o formato mais legível que ganha, é aquele que o modelo foi
// treinado a produzir. `x/y/w/h` continua aceito porque outros fornecedores o
// usam — mas é o caminho alternativo, não o principal.
function _mgCaixa(b, escala) {
  const cx = Array.isArray(b && b.box_2d) ? b.box_2d : (Array.isArray(b && b.box) ? b.box : null)
  if (cx && cx.length === 4 && cx.every(v => typeof v === 'number' && isFinite(v))) {
    const [y1, x1, y2, x2] = cx.map(v => v / escala)
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
  }
  if (typeof b.x === 'number' && typeof b.w === 'number') {
    return { x: b.x / escala, y: (b.y || 0) / escala, w: b.w / escala, h: (b.h || 0) / escala }
  }
  return null
}

// ⚠️ O MODELO NÃO USA A ESCALA QUE VOCÊ PEDIR. Pedi caixa em fração (0 a 1) e
// o Gemini devolveu `x:211, y:95, w:341, h:80` — a escala 0–1000, que é a
// convenção interna dele para caixas. O texto vinha 7/7 CERTO e as caixas com
// **0% de sobreposição**: o texto invisível caía fora do balão e a seleção
// parecia quebrada sem um único erro no console. O defeito mudo que eu tinha
// mapeado como risco, acontecendo de verdade no primeiro teste.
//
// Por isso a escala é DEDUZIDA dos números, não combinada: o prompt pede
// 0–1000 (o que o Gemini já faz sozinho), e isto aqui é a rede — se um dia
// outro fornecedor devolver fração, funciona igual, sem tocar em nada.
//
// A dedução olha as BORDAS (x+w, y+h), não só os cantos: uma página com um
// balão pequeno no alto à esquerda tem cantos pequenos em qualquer escala, e
// só a borda distingue 0,3 de 300.
function _mgEscala(brutos) {
  let maior = 0
  for (const b of brutos || []) {
    const cx = Array.isArray(b && b.box_2d) ? b.box_2d : (Array.isArray(b && b.box) ? b.box : null)
    const vals = cx ? cx : [b.x, b.y, b.w, b.h, (b.x || 0) + (b.w || 0), (b.y || 0) + (b.h || 0)]
    for (const v of vals) {
      if (typeof v === 'number' && isFinite(v) && v > maior) maior = v
    }
  }
  if (maior <= 1.5) return 1        // fração (0 a 1)
  if (maior <= 110) return 100      // porcentagem
  return 1000                       // a convenção do Gemini
}

// Base64 sem passar por canvas: a imagem vai para a IA EXATAMENTE como está no
// arquivo. Redesenhar num canvas custaria qualidade justo no que se quer ler.
function _mgBase64(bytes) {
  return new Promise((ok, erro) => {
    const fr = new FileReader()
    fr.onload = () => ok(String(fr.result).split(',')[1])
    fr.onerror = erro
    fr.readAsDataURL(new Blob([bytes]))
  })
}

function _mgAviso(i, texto, ehErro) {
  const av = document.querySelector(`.mg-aviso[data-pg="${i}"]`)
  if (!av) return
  av.classList.toggle('mg-aviso-erro', !!ehErro)
  av.innerHTML = ehErro
    ? `${ic('alert')} <span>${esc(texto)}</span>
       <button class="btn btn-sm" onclick="mangaLerPagina(${i})">Tentar de novo</button>`
    : `<span class="spinner"></span> <span>${esc(texto)}</span>`
}

// ---------------------------------------------------------------
// O volume inteiro, de uma vez
// ---------------------------------------------------------------

let _mgLote = null   // { parar: false } enquanto roda

// Duas de cada vez. Uma só demora ~7 min num volume; dez de uma vez estoura o
// limite de requisições do provedor e derruba a sequência inteira. Duas é o
// meio-termo que aguenta sem irritar a API.
async function mangaLerVolume() {
  const livro = _lerLivro
  if (!livro || livro.format !== 'manga') return
  if (_mgLote) { _mgLote.parar = true; return }      // segundo clique = parar

  const faltam = livro.chapters.map((c, i) => i).filter(i => !Array.isArray(livro.chapters[i].baloes))
  if (!faltam.length) { toast('Todas as páginas já foram lidas', 'info'); return }

  const { key } = aiChatCfg()
  if (!key) { toast('Configure a chave da IA para ler os balões', 'warning'); return }

  _mgLote = { parar: false }
  _mgBotaoLote()
  let feitas = 0, erros = 0
  const fila = [...faltam]
  const trabalhador = async () => {
    while (fila.length && !_mgLote.parar) {
      const i = fila.shift()
      const ok = await mangaLerPagina(i, true)
      ok ? feitas++ : erros++
      _mgBotaoLote(feitas + erros, faltam.length)
    }
  }
  await Promise.all([trabalhador(), trabalhador()])
  const parado = _mgLote.parar
  _mgLote = null
  _mgBotaoLote()
  saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  if (_lerLivro === livro && typeof lerIrParaCapitulo === 'function') await lerIrParaCapitulo(_lerCap, 0)
  toast(parado
    ? `Parei em ${feitas} páginas — o que já foi lido está guardado`
    : (erros ? `${feitas} páginas lidas, ${erros} falharam` : `${feitas} páginas lidas`),
    erros && !parado ? 'warning' : 'success')
}

function _mgBotaoLote(feitas, total) {
  const b = el('mg-lote')
  if (!b) return
  if (_mgLote) {
    b.innerHTML = `<span class="spinner"></span> ${feitas || 0}/${total || '…'} — parar`
    b.classList.add('mg-lendo')
  } else {
    b.innerHTML = `${ic('sparkles')} Ler o volume`
    b.classList.remove('mg-lendo')
  }
}

// Quantas páginas ainda não foram lidas — para a barra do leitor dizer se
// vale apertar "Ler o volume".
function mangaFaltam(livro) {
  if (!livro || livro.format !== 'manga') return 0
  return livro.chapters.filter(c => !Array.isArray(c.baloes)).length
}

// O texto de uma página, para as ferramentas do leitor (resumo, glossário)
// que esperam texto corrido e não sabem nada de balão.
function mangaTextoDaPagina(livro, i) {
  const c = livro && livro.chapters && livro.chapters[i]
  if (!c || !Array.isArray(c.baloes)) return ''
  return c.baloes.map(b => b.t).join('\n')
}

// ================================================================
// O LEITOR DE MANGÁ — rolagem contínua e zoom
// ================================================================
// ⚠️ MANGÁ NÃO SE LÊ PÁGINA A PÁGINA COM UM CLIQUE ENTRE ELAS. A primeira
// versão tratava cada página como um capítulo isolado: rolava DENTRO da
// página e parava na borda, exigindo um clique para a seguinte. Ler um
// volume assim são 180 interrupções — foi o que ele apontou.
//
// Aqui o volume inteiro é UM fluxo. O que era "trocar de capítulo" virou
// "rolar até a página", e a barra de cima acompanha sozinha onde você está.
//
// O custo disso seria a memória: 180 páginas de 800 KB viram 140 MB se todas
// forem imagem ao mesmo tempo. Por isso a imagem de cada página só nasce
// quando ela se APROXIMA da tela e é devolvida quando fica longe — o DOM tem
// o volume todo, a memória tem meia dúzia de páginas.

let _mgObs = null        // observador que carrega/descarrega as imagens
let _mgObsPos = null     // observador que diz em que página você está
let _mgMontado = null    // id do livro cujo fluxo já está na tela

// Quanto a página ocupa. Guardado no livro na primeira medição: sem isto,
// cada imagem que chega muda a altura do fluxo e a rolagem "pula" debaixo do
// dedo — o defeito mais irritante que um leitor de imagem pode ter.
function _mgProporcao(livro) {
  return (livro && livro.mgProp) || '2 / 3'
}

async function mangaHtmlDoVolume(mg, livro) {
  const paginas = []
  for (let i = 0; i < livro.chapters.length; i++) {
    paginas.push(
      '<div class="mg-pagina" data-pg="' + i + '" style="aspect-ratio:' + _mgProporcao(livro) + '">' +
        '<div class="mg-camada">' + _mgCamadaHtml(livro.chapters[i]) + '</div>' +
        '<div class="mg-num">' + (i + 1) + '</div>' +
      '</div>'
    )
  }
  return '<div class="mg-fluxo" data-modo="' + escA(mangaZoom().modo) + '">' + paginas.join('') + '</div>'
}

function _mgCamadaHtml(c) {
  const baloes = Array.isArray(c && c.baloes) ? c.baloes : []
  return baloes.map((b, n) => {
    const est = 'left:' + (b.x * 100).toFixed(3) + '%;top:' + (b.y * 100).toFixed(3) + '%;' +
                'width:' + (b.w * 100).toFixed(3) + '%;height:' + (b.h * 100).toFixed(3) + '%'
    return '<span class="mg-balao" style="' + est + '" data-b="' + n +
           '" onclick="mangaTocarBalao(this)">' + esc(b.t || '') + '</span>'
  }).join('\n')
}

// Redesenha a camada de UMA página, sem tocar na imagem nem na rolagem.
// Depois de ler os balões, remontar o fluxo inteiro jogaria você para o
// começo do volume — e é exatamente o momento em que você está lendo ali.
function mangaRepintarPagina(livro, i) {
  const div = document.querySelector('#ler-conteudo .mg-pagina[data-pg="' + i + '"]')
  if (!div) return false
  const camada = div.querySelector('.mg-camada')
  if (!camada) return false
  camada.innerHTML = _mgCamadaHtml(livro.chapters[i])
  const av = div.querySelector('.mg-aviso')
  if (av) av.remove()
  return true
}

// Liga o fluxo: imagens sob demanda e a página corrente na barra.
function mangaLigarFluxo(mg, livro) {
  const cont = el('ler-conteudo'); if (!cont) return
  mangaDesligarFluxo()
  _mgMontado = livro.id
  const raiz = el('ler-viewport') || null

  // 600px de folga dos dois lados: a imagem chega antes de aparecer e só some
  // depois de sair de vista. Sem folga, rolar rápido mostra buraco branco.
  _mgObs = new IntersectionObserver(entradas => {
    for (const e of entradas) {
      if (e.isIntersecting) _mgCarregarPagina(mg, livro, e.target)
      else _mgSoltarPagina(e.target)
    }
  }, { root: raiz, rootMargin: '600px 0px' })

  // Qual página está mais no meio da tela — é ela que a barra deve nomear.
  _mgObsPos = new IntersectionObserver(entradas => {
    if (_lerRestaurando) return
    let melhor = null
    for (const e of entradas) {
      if (!e.isIntersecting) continue
      if (!melhor || e.intersectionRatio > melhor.intersectionRatio) melhor = e
    }
    if (!melhor) return
    const i = +melhor.target.dataset.pg
    if (i === _lerCap) return
    _lerCap = i
    const nome = el('ler-cap-nome')
    if (nome) nome.textContent = (livro.chapters[i] && livro.chapters[i].titulo) || ('Página ' + (i + 1))
    if (typeof _lerAtualizarProgresso === 'function') _lerAtualizarProgresso()
    if (mangaAuto()) mangaLerPagina(i, true).catch(() => {})
  }, { root: raiz, threshold: [0.25, 0.6] })

  cont.querySelectorAll('.mg-pagina').forEach(d => { _mgObs.observe(d); _mgObsPos.observe(d) })
  mangaAplicarZoom()
  // Duas passadas: a primeira pega o que já está na tela; a segunda cobre o
  // caso de o layout ainda estar assentando (imagem que chega muda alturas).
  mangaGarantirVisiveis(mg, livro)
  setTimeout(() => mangaGarantirVisiveis(mg, livro), 350)
  setTimeout(() => mangaGarantirVisiveis(mg, livro), 1200)
}

function mangaDesligarFluxo() {
  if (_mgObs) { _mgObs.disconnect(); _mgObs = null }
  if (_mgObsPos) { _mgObsPos.disconnect(); _mgObsPos = null }
  // Os blobs das páginas que ficaram carregadas precisam voltar, senão fechar
  // o volume não devolve a memória.
  document.querySelectorAll('#ler-conteudo .mg-pagina').forEach(_mgSoltarPagina)
  _mgMontado = null
}

async function _mgCarregarPagina(mg, livro, div) {
  if (div.dataset.carregando || div.querySelector('img')) return
  div.dataset.carregando = '1'
  try {
    const i = +div.dataset.pg
    const c = livro.chapters[i]
    const bytes = await mg.zip.bytes(c.href)
    if (!bytes) return
    const url = URL.createObjectURL(new Blob([bytes]))
    const img = new Image()
    img.className = 'mg-img'
    img.alt = 'Página ' + (i + 1)
    img.onload = () => {
      // A proporção REAL da primeira página vira a estimativa das demais.
      if (!livro.mgProp && img.naturalWidth) {
        livro.mgProp = img.naturalWidth + ' / ' + img.naturalHeight
        saveLivros()
      }
      if (img.naturalWidth) div.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight
    }
    img.src = url
    div.insertBefore(img, div.firstChild)
    div._mgUrl = url
  } catch (e) {
    console.warn('[mangá] página não carregou:', e.message)
  } finally {
    delete div.dataset.carregando
  }
}

// ⚠️ `revokeObjectURL` NÃO É OPCIONAL. Sem ele, cada página visitada deixa o
// blob preso até a aba fechar: um volume de 180 páginas terminaria com mais
// de 100 MB pendurados, e no celular o sistema mata a aba antes disso.
function _mgSoltarPagina(div) {
  const img = div.querySelector('img')
  if (img) img.remove()
  if (div._mgUrl) { URL.revokeObjectURL(div._mgUrl); div._mgUrl = null }
}

// ⚠️ O OBSERVADOR NÃO ACORDA SOZINHO NO PRIMEIRO QUADRO. Medido: com o volume
// recém-montado e a página 1 no topo, ele reportava ZERO interseções — a tela
// ficava em branco até o primeiro toque de rolagem, e só então as imagens
// apareciam. É o comportamento dele quando os elementos são observados no
// mesmo quadro em que entram no DOM, antes do layout final existir.
//
// Esta varredura é a rede: percorre as páginas uma vez e carrega o que está
// perto da tela, sem depender de evento nenhum. Roda ao montar e depois de
// cada salto de página — barato, porque só olha retângulos.
function mangaGarantirVisiveis(mg, livro) {
  const cont = el('ler-conteudo'); const vp = el('ler-viewport')
  if (!cont || !vp) return 0
  const rv = vp.getBoundingClientRect()
  if (!rv.height) return 0                 // aba oculta: medir aqui daria 0
  const folga = 600
  let n = 0
  for (const div of cont.querySelectorAll('.mg-pagina')) {
    const r = div.getBoundingClientRect()
    const perto = r.bottom > rv.top - folga && r.top < rv.bottom + folga
    if (perto && !div.querySelector('img')) { _mgCarregarPagina(mg, livro, div); n++ }
  }
  return n
}

// Rola até uma página — o que "ir para o capítulo" virou no mangá.
function mangaIrParaPagina(i, suave) {
  const cont = el('ler-conteudo'); if (!cont) return false
  const alvo = cont.querySelector('.mg-pagina[data-pg="' + i + '"]')
  if (!alvo) return false
  alvo.scrollIntoView({ block: 'start', behavior: suave ? 'smooth' : 'auto' })
  // Saltar 40 páginas de uma vez não dá tempo ao observador: sem isto, o
  // sumário levava a uma tela vazia que só se enchia ao mexer na rolagem.
  if (typeof _lerEpub !== 'undefined' && _lerEpub && _lerEpub.manga) {
    mangaGarantirVisiveis(_lerEpub.manga, _lerLivro)
    setTimeout(() => mangaGarantirVisiveis(_lerEpub.manga, _lerLivro), 300)
  }
  return true
}

function mangaFluxoMontado(livro) {
  return !!(livro && _mgMontado === livro.id &&
            document.querySelector('#ler-conteudo .mg-fluxo'))
}

// ---------------------------------------------------------------
// Zoom e ajuste
// ---------------------------------------------------------------
// Três modos, porque três são as intenções reais: **largura** para ler
// rolando (o padrão), **página** para ver a folha inteira de uma vez (a
// página dupla, o painel grande), e **livre** para chegar perto de um balão
// pequeno. O fator só vale no modo livre — nos outros ele brigaria com o
// ajuste e o resultado seria imprevisível.
function mangaZoom() {
  const z = (typeof cfg !== 'undefined' && cfg && cfg.mgZoom) || {}
  return { modo: z.modo || 'largura', fator: +z.fator || 1 }
}

function mangaDefinirZoom(modo, fator) {
  cfg.mgZoom = { modo, fator: Math.max(0.4, Math.min(4, +fator || 1)) }
  saveCfg()
  mangaAplicarZoom()
  _mgBarraZoom()
}

function mangaZoomPasso(d) {
  const z = mangaZoom()
  mangaDefinirZoom('livre', (z.modo === 'livre' ? z.fator : 1) + d)
}

function mangaAplicarZoom() {
  const fluxo = document.querySelector('#ler-conteudo .mg-fluxo')
  const vp = el('ler-viewport')
  if (!fluxo || !vp) return
  const z = mangaZoom()
  fluxo.dataset.modo = z.modo
  const larguraVp = vp.clientWidth || 0
  if (!larguraVp) return              // aba oculta: medir aqui daria 0
  let larg
  if (z.modo === 'altura') {
    const prop = String(_mgProporcao(typeof _lerLivro !== 'undefined' ? _lerLivro : null)).split('/').map(parseFloat)
    const razao = (prop[0] && prop[1]) ? prop[0] / prop[1] : 2 / 3
    larg = Math.min(larguraVp, (vp.clientHeight || 800) * razao)
  } else if (z.modo === 'livre') {
    larg = larguraVp * z.fator
  } else {
    larg = larguraVp
  }
  fluxo.style.setProperty('--mg-larg', Math.round(larg) + 'px')
}

// Ler sozinho a página em que você chegou. Ligado por padrão: o contrário é
// alcançar a página e ter de pedir a leitura toda vez. Como a leitura começa
// quando a página se aproxima, ela costuma estar pronta quando você chega.
function mangaAuto() { return !(typeof cfg !== 'undefined' && cfg && cfg.mgAuto === false) }

function mangaAlternarAuto() {
  cfg.mgAuto = !mangaAuto()
  saveCfg()
  _mgBarraZoom()
  toast(mangaAuto() ? 'Vou lendo os balões conforme você avança' : 'Leitura automática desligada', 'info')
  if (mangaAuto() && typeof _lerCap === 'number') mangaLerPagina(_lerCap, true).catch(() => {})
}

// A barra do mangá. Só existe quando há mangá aberto.
function mangaBarraHtml() {
  const z = mangaZoom()
  const bt = (m, rot, dica) =>
    '<button class="mg-zb' + (z.modo === m ? ' on' : '') + '" onclick="mangaDefinirZoom(\'' + m + '\', 1)"' +
    ' data-tip="' + escA(dica) + '">' + rot + '</button>'
  return '<div class="mg-barra" id="mg-barra">' +
    bt('largura', ic('expand', 'ic-sm') + ' Largura', 'A página ocupa a largura da tela — o modo de rolar lendo') +
    bt('altura', ic('image', 'ic-sm') + ' Página', 'A folha inteira cabe na tela — para a arte e a página dupla') +
    '<span class="mg-zsep"></span>' +
    '<button class="mg-zb" onclick="mangaZoomPasso(-0.2)" data-tip="Afastar">&minus;</button>' +
    '<b class="mg-zval">' + (z.modo === 'livre' ? Math.round(z.fator * 100) + '%' : 'ajuste') + '</b>' +
    '<button class="mg-zb" onclick="mangaZoomPasso(0.2)" data-tip="Aproximar">+</button>' +
    '<span class="mg-zsep"></span>' +
    '<button class="mg-zb' + (mangaAuto() ? ' on' : '') + '" onclick="mangaAlternarAuto()"' +
    ' data-tip="Ler os balões sozinho conforme você avança">' + ic('sparkles', 'ic-sm') + ' Auto</button>' +
  '</div>'
}

function _mgBarraZoom() {
  const b = el('mg-barra')
  if (b) b.outerHTML = mangaBarraHtml()
}
