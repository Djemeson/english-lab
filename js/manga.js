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
    title: String(nomeArquivo || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Sem título',
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
  }).join('')

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
    if (!silencioso && _lerCap === i) await lerIrParaCapitulo(i, 0)
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
