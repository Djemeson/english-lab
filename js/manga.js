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

// Páginas com leitura em voo. ⚠️ DECLARADO AQUI EM CIMA de propósito:
// `mangaLerPagina` usa este conjunto e fica bem antes, no arquivo, de onde
// ele naturalmente seria escrito. `let` tem zona morta temporal, e este
// projeto já perdeu duas rodadas para exatamente esse tropeço (`_tituloVisto`
// e `popHist`, na extensão). Perto do topo, não há como cair nele.
const _mgLendo = new Set()

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
    return `<span class="mg-balao" style="${est}" data-b="${n}" onclick="mangaTocarBalao(this, event)">${esc(b.t || '')}</span>`
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
// ⚠️ O REALCE TEM DE TER A LARGURA DA LETRA DESENHADA, NÃO A DA FONTE.
// A faixa recebe a largura medida no pixel, mas o texto invisível dentro dela
// é escrito na fonte do navegador — e "IT GALLS" em Inter não mede o mesmo
// que "IT GALLS" desenhado à mão pelo letrista. O realce ficava mais curto
// que a linha e deslocado dentro dela: pegava "GALLS" onde a linha é "IT
// GALLS", "ALONG-" onde é "WORK ALONG-".
//
// Esticar horizontalmente resolve sem tocar na altura: o texto continua
// invisível, e o realce passa a cobrir exatamente as letras que estão ali.
// Medido uma vez por linha, quando a página entra na tela.
function mangaAjustarLinhas(raiz) {
  const alvo = raiz || document.getElementById('ler-conteudo')
  if (!alvo) return 0
  const linhas = alvo.querySelectorAll('.mg-linha:not([data-ok]) > .mg-t')
  let n = 0
  for (const t of linhas) {
    const pai = t.parentElement
    const largura = pai.clientWidth
    // Sem layout ainda (página fora da tela): fica para a próxima passada.
    if (!largura) continue
    t.style.transform = ''
    const propria = t.offsetWidth
    if (!propria) continue
    // ⚠️ O PISO PRECISA SER BAIXO. Medido: uma linha longa ("THE DREADED BIG
    // MOM PIRATES") batia no piso de 0,3 e ainda transbordava 39% da faixa —
    // e texto que transborda invade o realce da linha vizinha, que é o defeito
    // que se está corrigindo. Encolher muito só deixa o texto invisível mais
    // apertado; ele continua invisível. Transbordar, não: aparece na seleção.
    const fator = Math.max(0.08, Math.min(4, largura / propria))
    t.style.transform = 'scaleX(' + fator.toFixed(4) + ')'
    pai.dataset.ok = '1'
    n++
  }
  return n
}

// ⚠️ ARRASTOU? ENTÃO NÃO FOI TOQUE. O `click` dispara também no fim de um
// arraste — e o toque, ao selecionar o balão inteiro, DESTRUÍA a seleção que
// a pessoa acabara de fazer com o dedo. Ela marcava uma palavra e recebia a
// fala toda, sem entender por quê.
//
// A distância entre onde o dedo desceu e onde subiu separa as duas intenções:
// abaixo de 6 px é toque (pega a fala inteira), acima é arraste (é dele).
let _mgDesceuEm = null

function _mgPointerDown(ev) {
  _mgDesceuEm = { x: ev.clientX, y: ev.clientY }
}

function _mgArrastou(ev) {
  if (!_mgDesceuEm) return false
  const dx = (ev.clientX || 0) - _mgDesceuEm.x
  const dy = (ev.clientY || 0) - _mgDesceuEm.y
  return Math.hypot(dx, dy) > 6
}

function mangaTocarBalao(elemento, ev) {
  // Só o clique real traz evento; chamadas internas (e os testes) continuam
  // pegando a fala inteira, que é o comportamento pedido.
  if (ev && _mgArrastou(ev)) return
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
{"balloons":[{"text":"...","box_2d":[ymin,xmin,ymax,xmax],
  "lines":[{"text":"...","box_2d":[ymin,xmin,ymax,xmax]}]}],"sfx":["..."]}

Rules:
- One entry per SPEECH BALLOON (also thought balloons and caption boxes).
- "text": the dialogue exactly as printed. Join broken lines into one sentence
  with single spaces. Keep punctuation and apostrophes. NEVER translate.
- "box_2d": bounding box of the balloon's TEXT as [ymin, xmin, ymax, xmax],
  normalized to 0-1000.
- "lines": one entry per PRINTED LINE of that balloon, in reading order, each
  with a TIGHT box around that line's glyphs only — no balloon padding.
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

  // ⚠️ TRAVA POR PÁGINA. Sem ela a mesma página é pedida duas vezes: a
  // leitura automática dispara ao chegar nela, o adiantamento já tinha
  // disparado segundos antes, e nenhuma das duas terminou — a checagem
  // acima só pega quem JÁ acabou. Seriam duas imagens pagas pelo mesmo
  // resultado, e no volume inteiro isso dobra a conta.
  if (_mgLendo.has(i)) return true
  _mgLendo.add(i)

  const { key } = aiChatCfg()
  if (!key) {
    _mgLendo.delete(i)
    if (!silencioso) toast('Configure a chave da IA para ler os balões', 'warning')
    return false
  }

  const bytes = await mg.zip.bytes(c.href)
  // ⚠️ ARQUIVO VAZIO DENTRO DO CBZ. Medido no volume dele: `022.jpg` tem ZERO
  // byte — o empacotador falhou naquela página. Mandar isso para a IA devolve
  // HTTP 400 para sempre, e o selo ficava eternamente em "tentar de novo"
  // numa página que nunca vai ler. Marcada como lida-sem-fala: some do
  // caminho e não gasta mais chamada nenhuma.
  if (!bytes || bytes.length < 512) {
    _mgLendo.delete(i)
    c.baloes = []
    c.sfx = []
    saveLivros()
    _mgSeloEstado(i, true)
    console.warn('[mangá] página ' + (i + 1) + ' está vazia no arquivo (' +
                 (bytes ? bytes.length : 0) + ' bytes) — não há o que ler')
    return true
  }
  const b64 = await _mgBase64(bytes)

  if (!silencioso) _mgAviso(i, 'lendo a página…')
  const selo = document.querySelector('.mg-selo[data-selo="' + i + '"]')
  if (selo) { selo.disabled = true; selo.innerHTML = '<span class="spinner"></span> lendo…' }
  try {
    // ⚠️ TETO DOBRADO PORQUE EU TRIPLIQUEI A RESPOSTA. Pedir as LINHAS de cada
    // balão, cada uma com texto e caixa, faz o JSON crescer umas três vezes.
    // Numa página densa isso estourava os 8.000 e a resposta chegava cortada
    // no meio — o app dizia "veio, mas não era JSON válido" e a página ficava
    // sem texto, sem que nada indicasse a causa. O teto é LIMITE, não reserva:
    // quem responde curto não paga a folga.
    const resp = await aiVisaoJSON(MG_PEDIDO, b64, { maxTokens: 24000 })
    const brutos = Array.isArray(resp && resp.balloons) ? resp.balloons : []
    _mgAplicar(livro, i, brutos, resp && resp.sfx)
    // A posição vem da IMAGEM, não do modelo — ver `_mgAfinarPorPixel`.
    await _mgAfinarPorPixel(bytes, livro.chapters[i].baloes)
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
  } finally {
    _mgLendo.delete(i)
    const lida = Array.isArray(livro.chapters[i].baloes)
    _mgSeloEstado(i, lida, !lida)
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
    // As LINHAS são o que dá precisão ao realce: sem elas o texto invisível é
    // um bloco só e a seleção pinta a caixa inteira do balão. Com uma faixa
    // por linha, o realce cai onde estão as letras.
    const linhas = []
    for (const l of (Array.isArray(b.lines) ? b.lines : [])) {
      const lt = String((l && l.text) || (l && l.t) || '').replace(/\s+/g, ' ').trim()
      const lc = _mgCaixa(l, escala)
      if (!lt || !lc) continue
      const lx = preso(lc.x, 0, 1), ly = preso(lc.y, 0, 1)
      const lw = Math.min(1 - lx, Math.max(0, lc.w)), lh = Math.min(1 - ly, Math.max(0, lc.h))
      if (lw < 0.008 || lh < 0.004) continue
      linhas.push({ t: lt, x: +lx.toFixed(4), y: +ly.toFixed(4), w: +lw.toFixed(4), h: +lh.toFixed(4) })
    }
    const item = { t, x: +x.toFixed(4), y: +y.toFixed(4), w: +w.toFixed(4), h: +h.toFixed(4) }
    // Só aceita as linhas se elas cobrirem o balão de verdade: um punhado de
    // linhas soltas seria pior que a caixa única, porque parte da fala ficaria
    // sem alvo nenhum e o toque simplesmente não pegaria.
    if (linhas.length) {
      const juntas = linhas.map(l => l.t).join(' ').replace(/\s+/g, ' ').toUpperCase()
      const inteiro = t.replace(/\s+/g, ' ').toUpperCase()
      if (juntas.length >= inteiro.length * 0.7) {
        item.ls = linhas
        // ⚠️ A CAIXA DO BALÃO PASSA A SER A UNIÃO DAS LINHAS. O modelo não
        // garante coerência entre as duas medidas: MEDIDO, um balão veio com
        // caixa de 53 px de altura e DUAS linhas de 37 px cada dentro — 74 px
        // em 53. Como as linhas são posicionadas em porcentagem do balão,
        // elas transbordavam e o realce voltava a ser um bloco.
        // Envolvendo, as duas medidas passam a contar a mesma história.
        const x1 = Math.min(...linhas.map(l => l.x))
        const y1 = Math.min(...linhas.map(l => l.y))
        const x2 = Math.max(...linhas.map(l => l.x + l.w))
        const y2 = Math.max(...linhas.map(l => l.y + l.h))
        item.x = +x1.toFixed(4)
        item.y = +y1.toFixed(4)
        item.w = +(x2 - x1).toFixed(4)
        item.h = +(y2 - y1).toFixed(4)
      }
    }
    bons.push(item)
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
// ⚠️ A CAIXA VEM ÀS VEZES DENTRO DE OUTRO ARRAY. Medido: o mesmo modelo
// devolveu `box_2d: [[264,796,375,934]]` — uma lista de uma caixa — em vez de
// `[264,796,375,934]`. Sem achatar, a validação recusa tudo e a página fica
// sem nenhum balão, calada. Um `.flat()` resolve os dois formatos.
function _mgAchatar(v) {
  return Array.isArray(v) ? v.flat(2) : null
}

function _mgCaixa(b, escala) {
  const cx = _mgAchatar(b && b.box_2d) || _mgAchatar(b && b.box)
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
    const cx = _mgAchatar(b && b.box_2d) || _mgAchatar(b && b.box)
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
// A leitura ADIANTADA
// ---------------------------------------------------------------
// Ler ao chegar na página é tarde: são ~6 s olhando um balão mudo. Aqui a
// página seguinte é lida enquanto você ainda está na atual, e quando você
// vira, o texto já está lá.
//
// ⚠️ DUAS PÁGINAS À FRENTE, NÃO DEZ. O adiantamento gasta de verdade: se
// você fechar o volume, o que foi lido além do seu olho foi dinheiro no
// lixo. Duas páginas é meio centavo de risco e cobre a virada mais rápida
// que um leitor faz. Dez seriam 3 centavos jogados fora a cada parada — e,
// pior, disputariam o limite de requisições com a página que você está
// tentando ler AGORA.
const MG_ADIANTE = 2

let _mgFilaAdiante = null

// Em SEQUÊNCIA, nunca em paralelo: o adiantamento é trabalho de fundo e não
// pode roubar a vez da página aberta. Em paralelo, três pedidos simultâneos
// batem no limite de taxa do fornecedor e TODOS ficam mais lentos — inclusive
// aquele que você está esperando ver.
async function mangaAdiantar(i) {
  if (!mangaAuto() || _mgFilaAdiante) return
  const livro = _lerLivro
  if (!livro || livro.format !== 'manga') return
  const alvos = []
  for (let n = i; n <= i + MG_ADIANTE && n < livro.chapters.length; n++) {
    if (!Array.isArray(livro.chapters[n].baloes) && !_mgLendo.has(n)) alvos.push(n)
  }
  if (!alvos.length) return
  _mgFilaAdiante = (async () => {
    for (const n of alvos) {
      // A cada volta, confere se você ainda está por perto: virar 20 páginas
      // de uma vez torna esta fila obsoleta, e insistir nela seria pagar por
      // páginas que você já passou.
      if (!_lerLivro || _lerLivro.id !== livro.id) break
      if (Math.abs(n - _lerCap) > MG_ADIANTE + 1) break
      await mangaLerPagina(n, true)
    }
  })()
  try { await _mgFilaAdiante } finally { _mgFilaAdiante = null }
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
let _mgAoRolar = null    // ouvinte que diz em que página você está
let _mgRaf = 0           // trava de quadro, para não recalcular 60x por segundo
let _mgPulso = 0         // rede de segurança: ver comentário em mangaLigarFluxo
let _mgMontado = null    // id do livro cujo fluxo já está na tela

// A página que ocupa o meio da tela. O meio, e não o topo: rolando devagar,
// o topo pertence à página que está SAINDO, e a barra ficaria sempre uma
// atrás do que os olhos estão lendo.
function _mgPaginaNoCentro() {
  const vp = el('ler-viewport'), cont = el('ler-conteudo')
  if (!vp || !cont) return -1
  const meio = vp.getBoundingClientRect().top + vp.clientHeight / 2
  const pgs = cont.querySelectorAll('.mg-pagina')
  for (const d of pgs) {
    const r = d.getBoundingClientRect()
    if (r.top <= meio && r.bottom >= meio) return +d.dataset.pg
  }
  return -1
}

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
        _mgSeloHtml(livro.chapters[i], i) +
        '<div class="mg-num">' + (i + 1) + '</div>' +
      '</div>'
    )
  }
  return '<div class="mg-fluxo" data-modo="' + escA(mangaZoom().modo) + '">' + paginas.join('') + '</div>'
}

// ⚠️ UMA FAIXA POR LINHA IMPRESSA, NÃO UM BLOCO POR BALÃO — e é isto que dá
// precisão ao realce. Com um bloco só, o texto invisível se espalha pela
// caixa inteira e a seleção pinta um retângulo do tamanho do balão desenhado
// (ou maior), cobrindo a arte. Com uma faixa por linha, o realce cai sobre as
// letras, como num livro.
//
// As linhas são posicionadas RELATIVAS AO BALÃO, não à página, para que o
// contêiner continue sendo um elemento só: é ele que o toque seleciona, e é
// dele que sai a fala inteira para a Lexa.
function _mgCamadaHtml(c) {
  const baloes = Array.isArray(c && c.baloes) ? c.baloes : []
  return baloes.map((b, n) => {
    const est = 'left:' + (b.x * 100).toFixed(3) + '%;top:' + (b.y * 100).toFixed(3) + '%;' +
                'width:' + (b.w * 100).toFixed(3) + '%;height:' + (b.h * 100).toFixed(3) + '%'
    const abre = '<span class="mg-balao' + (b.ls && b.ls.length ? ' mg-linhado' : '') +
                 '" style="' + est + '" data-b="' + n + '" onclick="mangaTocarBalao(this, event)">'
    if (!b.ls || !b.ls.length) return abre + esc(b.t || '') + '</span>'
    const corpo = b.ls.map(l => {
      const lx = b.w ? (l.x - b.x) / b.w : 0
      const ly = b.h ? (l.y - b.y) / b.h : 0
      const lw = b.w ? l.w / b.w : 1
      const lh = b.h ? l.h / b.h : 1
      // A fonte sai da ALTURA REAL da linha na folha: `--mg-alt` é a altura da
      // página em px e `l.h` a fração que a linha ocupa. Assim a faixa de
      // realce tem a espessura da linha impressa, em qualquer zoom.
      const estL = 'left:' + (lx * 100).toFixed(3) + '%;top:' + (ly * 100).toFixed(3) + '%;' +
                   'width:' + (lw * 100).toFixed(3) + '%;height:' + (lh * 100).toFixed(3) + '%;' +
                   'font-size:calc(var(--mg-alt, 1600px) * ' + l.h.toFixed(4) + ')'
      // ⚠️ O ESPAÇO VAI DENTRO DA LINHA, e isto custou duas tentativas.
      // Sem separador nenhum, a fala saía "CALL NICOROBIN!!!" — duas linhas
      // viram uma palavra que não existe, e é isso que chegava à Lexa.
      // Um espaço ENTRE os spans não resolve: ele fica no DOM (o
      // `textContent` mostra 25 caracteres) mas some da SELEÇÃO (24), porque
      // um nó de texto entre elementos posicionados não gera caixa de layout
      // e a serialização da seleção ignora o que não é renderizado.
      // Dentro do span, o espaço é texto de verdade e vem junto.
      const sep = (l === b.ls[b.ls.length - 1]) ? '' : ' '
      // O texto vai num filho próprio para poder ser ESTICADO até a largura da
      // linha impressa — ver `mangaAjustarLinhas`.
      return '<span class="mg-linha" style="' + estL + '"><i class="mg-t">' +
             esc(l.t) + sep + '</i></span>'
    }).join('')
    return abre + corpo + '</span>'
  }).join('\n')
}

// ⚠️ PÁGINA NÃO LIDA PRECISA DIZER QUE NÃO FOI LIDA. No fluxo contínuo eu
// perdi o aviso que a versão de página única tinha, e o resultado foi o pior
// silêncio possível: ele rolou o volume, achou páginas onde nada selecionava
// e não tinha como saber por quê nem como pedir a leitura daquela página.
// Com a leitura automática desligada, então, o volume simplesmente parava de
// ganhar texto sem avisar.
//
// O selo fica no canto e some assim que a página é lida.
function _mgSeloHtml(c, i) {
  if (Array.isArray(c.baloes)) return ''
  return '<button class="mg-selo" data-selo="' + i + '" onclick="mangaLerPagina(' + i + ')">' +
         ic('sparkles', 'ic-sm') + ' ler os balões</button>'
}

// O selo volta ao estado certo sozinho. Sem isto, uma leitura que falha deixa
// "lendo…" para sempre numa página que ninguém está lendo — e o botão fica
// desabilitado, tirando do usuário a única forma de tentar de novo.
function _mgSeloEstado(i, lida, erro) {
  const s = document.querySelector('.mg-selo[data-selo="' + i + '"]')
  if (!s) return
  if (lida) { s.remove(); return }
  s.disabled = false
  s.innerHTML = erro
    ? ic('alert', 'ic-sm') + ' tentar de novo'
    : ic('sparkles', 'ic-sm') + ' ler os balões'
  s.classList.toggle('mg-selo-erro', !!erro)
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
  const selo = div.querySelector('.mg-selo')
  if (selo && Array.isArray(livro.chapters[i].baloes)) selo.remove()
  mangaAjustarLinhas(div)
  return true
}

// ⚠️ CONSERTA O QUE JÁ ESTÁ SALVO, SEM GASTAR UMA LEITURA. As páginas lidas
// antes de a caixa passar a envolver as linhas ficaram com as duas medidas
// discordando — e como as linhas são posicionadas em porcentagem do balão,
// o realce aparecia DESLOCADO sobre a arte. Foi o que ele viu na tela.
//
// A união é conta pura, não precisa da IA: dá para arrumar o acervo inteiro
// na abertura, de graça. Sem isto, a única saída seria reler o volume — 15
// centavos e alguns minutos por algo que o aparelho resolve sozinho.
function mangaCorrigirCaixas(livro) {
  if (!livro || livro.format !== 'manga') return 0
  let mexeu = 0
  for (const c of livro.chapters || []) {
    if (!Array.isArray(c.baloes)) continue
    for (const b of c.baloes) {
      if (!b.ls || !b.ls.length) continue
      const x1 = Math.min(...b.ls.map(l => l.x))
      const y1 = Math.min(...b.ls.map(l => l.y))
      const x2 = Math.max(...b.ls.map(l => l.x + l.w))
      const y2 = Math.max(...b.ls.map(l => l.y + l.h))
      const nx = +x1.toFixed(4), ny = +y1.toFixed(4)
      const nw = +(x2 - x1).toFixed(4), nh = +(y2 - y1).toFixed(4)
      // 0,3% de tolerância: arredondamento não é motivo para reescrever tudo.
      if (Math.abs(b.x - nx) > 0.003 || Math.abs(b.y - ny) > 0.003 ||
          Math.abs(b.w - nw) > 0.003 || Math.abs(b.h - nh) > 0.003) {
        b.x = nx; b.y = ny; b.w = nw; b.h = nh
        mexeu++
      }
    }
  }
  if (mexeu) {
    saveLivros()
    console.info('[mangá] ' + mexeu + ' balões realinhados (caixa antiga, sem custo de releitura)')
  }
  return mexeu
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
    // A barra também sai daqui. ⚠️ MEDIDO: o evento `scroll` da viewport do
    // leitor NÃO chega — zero disparos com a rolagem mudando de posição na
    // mesma medição. Este observador, por outro lado, dispara sempre, e com
    // a granularidade certa: uma vez por página que entra ou sai.
    _mgAtualizarBarra(livro)
  }, { root: raiz, rootMargin: '600px 0px' })

  // ⚠️ A PÁGINA CORRENTE SAI DA ROLAGEM, NÃO DE OBSERVADOR. A primeira versão
  // usava um IntersectionObserver com limiares e a barra dizia "Página 14"
  // com a rolagem em ZERO: com 28 elementos observados de uma vez, os
  // disparos chegam fora de ordem e o "melhor" de um lote parcial não é o
  // melhor da tela. Uma conta sobre `scrollTop` não tem esse problema — ela
  // sempre descreve o AGORA.
  // O ouvinte de rolagem entra como REFORÇO, no `document` em fase de captura
  // — rolagem de elemento não borbulha, e no elemento ela não chegava. Se
  // funcionar, a barra fica mais fluida; se não, o observador acima cobre.
  _mgAoRolar = () => {
    if (_mgRaf) return
    _mgRaf = requestAnimationFrame(() => { _mgRaf = 0; _mgAtualizarBarra(livro) })
  }
  document.addEventListener('scroll', _mgAoRolar, { passive: true, capture: true })

  cont.querySelectorAll('.mg-pagina').forEach(d => _mgObs.observe(d))
  mangaAplicarZoom()
  // Duas passadas: a primeira pega o que já está na tela; a segunda cobre o
  // caso de o layout ainda estar assentando (imagem que chega muda alturas).
  mangaGarantirVisiveis(mg, livro)
  setTimeout(() => mangaGarantirVisiveis(mg, livro), 350)
  setTimeout(() => mangaGarantirVisiveis(mg, livro), 1200)

  // ⚠️ A REDE DE ÚLTIMO RECURSO. Observador e evento de rolagem dependem de o
  // navegador estar COMPONDO QUADROS: numa aba em segundo plano os dois
  // param, e ao voltar a barra pode estar mentindo sobre a página. Este pulso
  // é uma varredura de retângulos a cada 700 ms — custo desprezível perto de
  // uma barra que diz "Página 21" com a 4 na tela.
  //
  // Ele também é o que garante o comportamento em navegador que trate o
  // observador de forma diferente: a página corrente nunca depende de UM
  // mecanismo só.
  mangaPincaLigar()
  // Antes de qualquer coisa: endireita o que ficou torto de versões antigas.
  mangaCorrigirCaixas(livro)
  // Sem isto, a primeira página só começaria a ser lida no primeiro rolar.
  mangaAdiantar(typeof _lerCap === 'number' ? _lerCap : 0).catch(() => {})
  clearInterval(_mgPulso)
  _mgPulso = setInterval(() => {
    if (!_mgMontado) { clearInterval(_mgPulso); _mgPulso = 0; return }
    _mgAtualizarBarra(livro)
    mangaGarantirVisiveis(mg, livro)
    mangaAjustarLinhas()
  }, 700)
}

function mangaDesligarFluxo() {
  if (typeof mangaPincaDesligar === 'function') mangaPincaDesligar()
  if (_mgObs) { _mgObs.disconnect(); _mgObs = null }
  if (_mgAoRolar) document.removeEventListener('scroll', _mgAoRolar, { capture: true })
  _mgAoRolar = null
  if (_mgRaf) { cancelAnimationFrame(_mgRaf); _mgRaf = 0 }
  if (_mgPulso) { clearInterval(_mgPulso); _mgPulso = 0 }
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
    // A página acabou de ser decodificada de qualquer forma: é a hora mais
    // barata de medir os pixels das que foram lidas antes deste conserto.
    // Uma vez por página, marcada com o carimbo `px`.
    // A largura só existe depois que a imagem define a altura da página.
    img.addEventListener('load', () => mangaAjustarLinhas(div), { once: true })
    mangaAjustarLinhas(div)
    const precisa = Array.isArray(c.baloes) && c.baloes.some(b => b.ls && b.ls.length && !b.px)
    if (precisa) {
      _mgAfinarPorPixel(bytes, c.baloes).then(n => {
        if (!n) return
        saveLivros()
        mangaRepintarPagina(livro, i)
      }).catch(() => {})
    }
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
  // ⚠️ SOLTAR TEM FOLGA MAIOR QUE CARREGAR, de propósito. Com o mesmo limite,
  // uma página parada exatamente na borda entraria e sairia a cada varredura
  // — carrega, solta, carrega — e o leitor piscaria sem parar. A margem de
  // 1200 px cria a zona morta que impede esse vaivém.
  const folgaSolta = 1200
  let n = 0
  for (const div of cont.querySelectorAll('.mg-pagina')) {
    const r = div.getBoundingClientRect()
    const temImg = !!div.querySelector('img')
    if (r.bottom > rv.top - folga && r.top < rv.bottom + folga) {
      if (!temImg) { _mgCarregarPagina(mg, livro, div); n++ }
    } else if (temImg && (r.bottom < rv.top - folgaSolta || r.top > rv.bottom + folgaSolta)) {
      // A memória volta aqui mesmo que o observador não tenha rodado — e ele
      // não roda em aba de segundo plano.
      _mgSoltarPagina(div)
    }
  }
  return n
}

// A barra de cima, o progresso e a leitura automática — tudo o que depende de
// "em que página estou". Sai de uma conta sobre a geometria, nunca de estado
// acumulado: assim nenhum disparo perdido deixa a barra mentindo.
function _mgAtualizarBarra(livro) {
  if (typeof _lerRestaurando !== 'undefined' && _lerRestaurando) return
  const i = _mgPaginaNoCentro()
  if (i < 0) return
  if (i !== _lerCap) {
    _lerCap = i
    const nome = el('ler-cap-nome')
    if (nome) nome.textContent = (livro.chapters[i] && livro.chapters[i].titulo) || ('Página ' + (i + 1))
    if (typeof _lerAtualizarProgresso === 'function') _lerAtualizarProgresso()
  }
  // ⚠️ FORA DO `if`, e isto é o conserto. Com o adiantamento pendurado na
  // TROCA de página ele nunca acontecia: parado na 1, nada era pedido, e ao
  // virar para a 2 a leitura começava do zero — exatamente o que o
  // adiantamento existia para evitar. MEDIDO: 17 s na página 1 e só ela
  // lida; ao virar, a 2 ainda estava em branco.
  //
  // Chamar a cada passada do pulso não custa: `mangaAdiantar` sai na hora se
  // já houver fila em voo ou se não faltar nada por perto.
  mangaAdiantar(i).catch(() => {})
}

// Rola até uma página — o que "ir para o capítulo" virou no mangá.
function mangaIrParaPagina(i, suave) {
  const cont = el('ler-conteudo'); if (!cont) return false
  const alvo = cont.querySelector('.mg-pagina[data-pg="' + i + '"]')
  const vp = el('ler-viewport')
  if (!alvo || !vp) return false
  // ⚠️ `scrollIntoView` NÃO SERVE AQUI. Medido: o salto para a página 20
  // deixava a rolagem em 0 — ele escolhe sozinho qual ancestral rolar e, com
  // imagens chegando e mudando alturas no mesmo instante, o resultado é
  // imprevisível. `scrollTop` diz exatamente qual caixa rola e para onde.
  const y = alvo.offsetTop - (cont.offsetTop || 0)
  // ⚠️ `scrollTop = y` NÃO É INSTANTÂNEO AQUI. A viewport tem
  // `scroll-behavior:smooth` no CSS (ótimo para virar página na mão), e sob
  // ele a atribuição vira uma ANIMAÇÃO: ler `scrollTop` logo depois devolve o
  // valor antigo, e um segundo salto no meio do caminho cancela o primeiro.
  // Foi o que fez o salto para a página 20 "não colar". `behavior:'instant'`
  // vence o CSS sem alterar o elemento — mesmo caminho que `_lerIrParaFrac`
  // já usa para restaurar a posição de um livro.
  if (vp.scrollTo) vp.scrollTo({ top: y, behavior: suave ? 'smooth' : 'instant' })
  else vp.scrollTop = y
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

// ⚠️ BOTÃO QUE ACENDE PRECISA PODER APAGAR. Ele apertou "Largura" estando já
// em largura e nada aconteceu: um botão aceso e inerte parece travado, e não
// havia caminho de volta para o ajuste anterior. Agora tocar no que já está
// ativo DESFAZ — volta ao zoom de antes (o de 140% que a pinça deixou, por
// exemplo). Sem estado anterior, cai no outro ajuste, para o toque nunca ser
// em vão.
let _mgZoomAnterior = null

function mangaDefinirZoom(modo, fator) {
  const atual = mangaZoom()
  if (atual.modo === modo && modo !== 'livre') {
    const volta = _mgZoomAnterior && _mgZoomAnterior.modo !== modo
      ? _mgZoomAnterior
      : { modo: modo === 'largura' ? 'altura' : 'largura', fator: 1 }
    _mgZoomAnterior = atual
    cfg.mgZoom = { modo: volta.modo, fator: Math.max(0.4, Math.min(4, +volta.fator || 1)) }
  } else {
    _mgZoomAnterior = atual
    cfg.mgZoom = { modo, fator: Math.max(0.4, Math.min(4, +fator || 1)) }
  }
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
  // A altura da folha — é ela que dimensiona a fonte de cada linha, para a
  // faixa de realce ter a espessura do texto impresso em qualquer zoom.
  const propA = String(_mgProporcao(typeof _lerLivro !== 'undefined' ? _lerLivro : null)).split('/').map(parseFloat)
  const razaoA = (propA[0] && propA[1]) ? propA[0] / propA[1] : 2 / 3
  fluxo.style.setProperty('--mg-alt', Math.round(larg / razaoA) + 'px')
  // ⚠️ AMPLIAR SEM ROLAGEM LATERAL SERIA CORTAR A PÁGINA. A viewport do
  // leitor esconde o transbordo horizontal (é o que faz o modo paginado
  // funcionar); no mangá ampliado ela precisa deixar arrastar para o lado,
  // senão as bordas do desenho ficam inalcançáveis.
  vp.style.overflowX = (larg > larguraVp + 2) ? 'auto' : ''
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
  if (mangaAuto() && typeof _lerCap === 'number') mangaAdiantar(_lerCap).catch(() => {})
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

// ⚠️ NÃO TROCAR O ELEMENTO. `outerHTML = …` destrói o nó no meio do próprio
// clique que o disparou — o botão que você acabou de apertar deixa de existir
// enquanto o navegador ainda está tratando o evento dele. Foi o que fez o
// "Auto" sumir da tela ao ser desligado. Trocando só o CONTEÚDO, o elemento
// (e o clique em andamento) sobrevivem.
function _mgBarraZoom() {
  const b = el('mg-barra')
  if (!b) return
  const molde = document.createElement('div')
  molde.innerHTML = mangaBarraHtml()
  const nova = molde.firstElementChild
  if (nova) b.innerHTML = nova.innerHTML
}

// ---------------------------------------------------------------
// PINÇA — dois dedos para aproximar, no celular
// ---------------------------------------------------------------
// ⚠️ POR QUE NÃO DEIXAR A PINÇA DO NAVEGADOR RESOLVER: ela amplia a PÁGINA
// inteira — barra, rodapé e menu junto —, e ao soltar você fica com a
// interface gigante e o texto do balão do mesmo tamanho relativo. Aqui a
// pinça mexe só na LARGURA DO FLUXO, que é o mesmo controle dos botões: o
// resto da tela fica onde está, e a camada de texto acompanha a arte porque
// está posicionada em porcentagem.
//
// O gesto de um dedo continua sendo rolar — o leitor já tem gestos próprios,
// mas eles só agem no modo paginado, e mangá nunca é paginado. Sem conflito.

let _mgPinca = null      // estado enquanto os dois dedos estão na tela
let _mgPincaLigada = false

function _mgDistancia(t) {
  const dx = t[0].clientX - t[1].clientX
  const dy = t[0].clientY - t[1].clientY
  return Math.hypot(dx, dy)
}

function _mgPincaIni(ev) {
  if (ev.touches.length !== 2) { _mgPinca = null; return }
  const vp = el('ler-viewport')
  const fluxo = document.querySelector('#ler-conteudo .mg-fluxo')
  if (!vp || !fluxo) return
  const z = mangaZoom()
  const rv = vp.getBoundingClientRect()
  _mgPinca = {
    d0: _mgDistancia(ev.touches),
    // O fator de partida: nos modos de ajuste o zoom vale 1 por definição, e
    // é a largura ATUAL que serve de base — assim a pinça começa exatamente
    // de onde a página está, sem salto no primeiro milímetro de gesto.
    f0: z.modo === 'livre' ? z.fator : (fluxo.getBoundingClientRect().width / (vp.clientWidth || 1)),
    cx: (ev.touches[0].clientX + ev.touches[1].clientX) / 2 - rv.left,
    cy: (ev.touches[0].clientY + ev.touches[1].clientY) / 2 - rv.top,
  }
  // Uma seleção viva atrapalha: o navegador tentaria arrastar as alças dela.
  try { window.getSelection().removeAllRanges() } catch (e) {}
  ev.preventDefault()
}

function _mgPincaMove(ev) {
  if (!_mgPinca || ev.touches.length !== 2) return
  ev.preventDefault()
  const vp = el('ler-viewport')
  const fluxo = document.querySelector('#ler-conteudo .mg-fluxo')
  if (!vp || !fluxo) return
  const d = _mgDistancia(ev.touches)
  if (!_mgPinca.d0) return
  const fator = Math.max(0.4, Math.min(4, _mgPinca.f0 * (d / _mgPinca.d0)))

  const larg0 = fluxo.getBoundingClientRect().width
  cfg.mgZoom = { modo: 'livre', fator }
  mangaAplicarZoom()
  const larg1 = fluxo.getBoundingClientRect().width
  if (!larg0 || !larg1) return

  // ⚠️ O PONTO ENTRE OS DEDOS PRECISA FICAR PARADO. Sem esta correção o
  // conteúdo cresce a partir do topo e a cena que você estava olhando
  // escapa da tela — a sensação é a de que o leitor "fugiu" do dedo.
  const k = larg1 / larg0
  // ⚠️ `scrollTop = …` DE NOVO NÃO SERVE. A viewport tem `scroll-behavior:
  // smooth`, e sob ele cada atribuição vira uma animação — durante a pinça
  // são dezenas por segundo, cada uma cancelando a anterior, e a rolagem
  // simplesmente não sai do lugar. MEDIDO: o conteúdo dobrava de tamanho e o
  // `scrollTop` continuava exatamente em 4000, com o ponto sob os dedos
  // escorregando 4,5% da página. `behavior:'instant'` é o que vence o CSS.
  const alvoY = (vp.scrollTop + _mgPinca.cy) * k - _mgPinca.cy
  const alvoX = (vp.scrollLeft + _mgPinca.cx) * k - _mgPinca.cx
  if (vp.scrollTo) vp.scrollTo({ top: alvoY, left: alvoX, behavior: 'instant' })
  else { vp.scrollTop = alvoY; vp.scrollLeft = alvoX }
}

function _mgPincaFim(ev) {
  if (!_mgPinca) return
  if (ev.touches && ev.touches.length >= 2) return
  _mgPinca = null
  // Só agora grava e redesenha o rótulo: durante o gesto seriam dezenas de
  // gravações por segundo, e o número piscando no rodapé cansa a vista.
  saveCfg()
  _mgBarraZoom()
}

// Dois toques rápidos voltam ao ajuste — é o "desfazer" do gesto, e sem ele
// a única saída da pinça seria caçar o botão certo no rodapé.
let _mgUltimoToque = 0
function _mgToqueDuplo(ev) {
  if (ev.touches && ev.touches.length > 1) return
  const agora = Date.now()
  const rapido = agora - _mgUltimoToque < 300
  _mgUltimoToque = agora
  if (!rapido) return
  ev.preventDefault()
  mangaDefinirZoom(mangaZoom().modo === 'livre' ? 'largura' : 'altura', 1)
}

function mangaPincaLigar() {
  const fluxo = document.querySelector('#ler-conteudo .mg-fluxo')
  if (!fluxo || _mgPincaLigada) return
  // `passive:false` é obrigatório: sem ele o `preventDefault` é ignorado e o
  // navegador amplia a página inteira por baixo do nosso gesto.
  fluxo.addEventListener('pointerdown', _mgPointerDown, { passive: true })
  fluxo.addEventListener('touchstart', _mgPincaIni, { passive: false })
  fluxo.addEventListener('touchmove', _mgPincaMove, { passive: false })
  fluxo.addEventListener('touchend', _mgPincaFim, { passive: true })
  fluxo.addEventListener('touchcancel', _mgPincaFim, { passive: true })
  fluxo.addEventListener('touchend', _mgToqueDuplo, { passive: false })
  _mgPincaLigada = true
}

function mangaPincaDesligar() {
  const fluxo = document.querySelector('#ler-conteudo .mg-fluxo')
  if (fluxo) {
    fluxo.removeEventListener('pointerdown', _mgPointerDown)
    fluxo.removeEventListener('touchstart', _mgPincaIni)
    fluxo.removeEventListener('touchmove', _mgPincaMove)
    fluxo.removeEventListener('touchend', _mgPincaFim)
    fluxo.removeEventListener('touchcancel', _mgPincaFim)
    fluxo.removeEventListener('touchend', _mgToqueDuplo)
  }
  _mgPinca = null
  _mgPincaLigada = false
}

// ---------------------------------------------------------------
// AFINAR AS LINHAS PELO PIXEL
// ---------------------------------------------------------------
// ⚠️ O MODELO DÁ O TEXTO; A IMAGEM DÁ A POSIÇÃO. Pedir precisão de pixel a um
// modelo de visão é pedir a coisa errada a quem faz outra: as caixas dele
// vinham **meia linha acima** do texto, de forma consistente. Um teste de
// "tem tinta embaixo?" não pega isso — uma caixa deslocada meia linha ainda
// acerta parte das letras e passa. Só o olho pegou, no print dele.
//
// A tinta, porém, está ali para ser medida. Aqui a página é lida como pixels
// e cada linha impressa é encontrada por PROJEÇÃO HORIZONTAL: somando os
// pixels escuros de cada fileira, as linhas de texto viram picos e os vãos
// entre elas viram vales. É determinístico, não custa chamada nenhuma e
// acerta o alinhamento no pixel.
//
// O texto continua vindo da IA — ela lê o que está escrito, que é o que a
// projeção não sabe fazer. Cada um no que é bom.

// Ponto de partida para "isto é tinta". ⚠️ NÃO É O VALOR FINAL: em página
// digital o texto é preto puro sobre branco puro e qualquer corte serve, mas
// mangá DIGITALIZADO DE PAPEL não tem nem preto nem branco — o fundo é
// creme ou cinza, a tinta é cinza-escura, e o papel velho fecha ainda mais
// essa distância. Com corte fixo, ou o fundo inteiro vira "tinta" (e a página
// vira uma faixa só) ou a tinta clara some (e não há faixa nenhuma).
// `_mgLimiarDaJanela` calcula o corte de cada balão a partir do que há ali.
const MG_ESCURO = 110

async function _mgAfinarPorPixel(bytes, baloes) {
  if (!Array.isArray(baloes) || !baloes.some(b => b.ls && b.ls.length)) return 0
  let img
  try {
    img = await _mgCarregarImagem(bytes)
  } catch (e) {
    console.warn('[mangá] não consegui medir os pixels:', e.message)
    return 0
  }
  const cv = document.createElement('canvas')
  cv.width = img.naturalWidth || img.width
  cv.height = img.naturalHeight || img.height
  if (!cv.width || !cv.height) return 0
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src)

  let afinados = 0
  for (const b of baloes) {
    if (!b.ls || b.ls.length < 1) continue
    if (_mgAfinarBalao(ctx, cv, b)) afinados++
  }
  return afinados
}

function _mgCarregarImagem(bytes) {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(new Blob([bytes]))
    const im = new Image()
    im.onload = () => ok(im)
    im.onerror = () => { URL.revokeObjectURL(url); erro(new Error('imagem inválida')) }
    im.src = url
  })
}

// ⚠️ O CORTE ENTRE TINTA E PAPEL SAI DA PRÓPRIA JANELA. Otsu: monta o
// histograma dos tons e escolhe o valor que melhor SEPARA as duas populações
// (papel e tinta), maximizando a distância entre as médias delas. Numa página
// digital ele cai perto de 110 e nada muda; num escaneado de papel creme com
// tinta cinza ele acompanha, e as linhas continuam sendo achadas.
//
// A trava do fim é o que impede o desastre silencioso: se as duas populações
// quase se tocam (`separacao` baixa), não há texto ali — é fundo uniforme, e
// insistir produziria faixas de ruído. Nesse caso volta o corte fixo, que ao
// menos falha de forma previsível.
function _mgLimiarDaJanela(dados) {
  const hist = new Array(256).fill(0)
  let n = 0
  for (let i = 0; i < dados.length; i += 4) {
    const v = (dados[i] + dados[i + 1] + dados[i + 2]) / 3 | 0
    hist[v]++; n++
  }
  if (!n) return MG_ESCURO
  let soma = 0
  for (let t = 0; t < 256; t++) soma += t * hist[t]
  let somaB = 0, pesoB = 0, melhor = -1, corte = MG_ESCURO
  for (let t = 0; t < 256; t++) {
    pesoB += hist[t]
    if (!pesoB) continue
    const pesoF = n - pesoB
    if (!pesoF) break
    somaB += t * hist[t]
    const mediaB = somaB / pesoB
    const mediaF = (soma - somaB) / pesoF
    const entre = pesoB * pesoF * (mediaB - mediaF) * (mediaB - mediaF)
    if (entre > melhor) { melhor = entre; corte = t }
  }
  // Fundo quase uniforme: o "melhor corte" seria arbitrário. Fica o fixo.
  const media = soma / n
  if (corte < 30 || corte > 225 || Math.abs(corte - media) < 8) return MG_ESCURO
  return corte
}

function _mgAfinarBalao(ctx, cv, b) {
  const alturaMedia = b.ls.reduce((s, l) => s + l.h, 0) / b.ls.length
  // A busca começa na região que o modelo apontou, ESTICADA: ele erra por
  // menos de uma linha, e sem folga a linha certa ficaria de fora justamente
  // no caso que se quer consertar. Uma linha inteira de margem, dos dois lados.
  // ⚠️ FOLGA CURTA. Com uma linha inteira de margem dos dois lados, a janela
  // quase DOBRAVA e engolia as falas de cima e de baixo: onde havia 2 linhas,
  // a projeção achava 4. Meia linha basta para cobrir o desvio do modelo (que
  // erra por menos de uma linha) sem convidar a vizinhança.
  const y0 = Math.max(0, b.y - alturaMedia * 0.55)
  const y1 = Math.min(1, b.y + b.h + alturaMedia * 0.55)
  const x0 = Math.max(0, b.x - b.w * 0.10)
  const x1 = Math.min(1, b.x + b.w + b.w * 0.10)

  const X = Math.round(x0 * cv.width), Y = Math.round(y0 * cv.height)
  const W = Math.round((x1 - x0) * cv.width), H = Math.round((y1 - y0) * cv.height)
  if (W < 4 || H < 4 || X + W > cv.width || Y + H > cv.height) return false

  let dados
  try { dados = ctx.getImageData(X, Y, W, H).data } catch (e) { return false }

  // O corte entre tinta e papel, medido nesta janela — é o que faz página
  // escaneada de papel funcionar como página digital.
  const escuro = _mgLimiarDaJanela(dados)

  // Quanta tinta em cada fileira de pixels.
  const perfil = new Array(H).fill(0)
  for (let y = 0; y < H; y++) {
    let n = 0
    const base = y * W * 4
    for (let x = 0; x < W; x++) {
      const i = base + x * 4
      if ((dados[i] + dados[i + 1] + dados[i + 2]) / 3 <= escuro) n++
    }
    perfil[y] = n
  }

  // Uma fileira "tem texto" quando passa de 1,5% da largura examinada. Abaixo
  // disso é contorno de balão, sujeira de digitalização ou a perna de uma
  // letra isolada — e chamar isso de linha juntaria duas linhas numa só.
  // ⚠️ LIMIAR RELATIVO AO PRÓPRIO BALÃO. Um corte fixo de 1,5% da largura
  // funciona quando o vão entre as linhas é branco limpo — e falha quando
  // elas se tocam: MEDIDO, cinco linhas viravam UMA faixa só, e aí nenhum
  // casamento é possível. Exigindo que a fileira tenha pelo menos 18% da
  // tinta da fileira MAIS CHEIA, o vão entre linhas coladas volta a ser vale,
  // porque ali a tinta cai mesmo que não chegue a zero.
  const pico = Math.max(...perfil)
  const limite = Math.max(2, Math.round(W * 0.015), Math.round(pico * 0.18))
  const faixas = []
  let ini = -1
  for (let y = 0; y < H; y++) {
    const tem = perfil[y] >= limite
    if (tem && ini < 0) ini = y
    if ((!tem || y === H - 1) && ini >= 0) {
      const fim = tem ? y : y - 1
      // Faixa fina demais para ser uma linha de texto: descarta.
      // ⚠️ 0,20 E NÃO 0,35. O último balão que resistia era "OOGH ...": os três
      // pontos são uma linha impressa de verdade, mas BAIXA — não chegavam a
      // 35% da altura média e eram descartados como ruído. Reticências,
      // vírgulas soltas e o coração do balão são linhas legítimas e todas
      // pequenas. O piso absoluto de 3 px continua barrando sujeira real.
      if (fim - ini >= Math.max(3, alturaMedia * cv.height * 0.20)) faixas.push([ini, fim])
      ini = -1
    }
  }

  if (!faixas.length) return false

  // ⚠️ CASAR POR PROXIMIDADE, NÃO POR CONTAGEM. Exigir que o número de faixas
  // batesse com o de linhas fazia o conserto desistir sempre que uma sobra da
  // vizinhança entrava na janela — e era o caso comum. Aqui cada linha lida
  // procura a faixa cujo CENTRO está mais perto do seu, sem repetir faixa e
  // sem voltar atrás na ordem: a leitura é de cima para baixo, e uma linha
  // nunca cai acima da anterior.
  const centros = faixas.map(([a, z]) => (a + z) / 2)
  const escolhidas = []
  let ultima = -1
  for (const l of b.ls) {
    const alvo = ((l.y + l.h / 2) - y0) * cv.height
    let melhor = -1, dist = Infinity
    // ⚠️ `ultima` E NÃO `ultima + 1`: uma faixa PODE receber mais de uma
    // linha. Foi o que travou os 27 casos que sobravam — e eles falhavam
    // todos pela mesma razão. A IA separa `!!!`, `...` e `♡` como linha
    // própria ("ROBIN" + "!!!"), mas na página impressa isso é UMA linha só:
    // havia 2 linhas lidas para 1 faixa, as faixas "acabavam" e o balão
    // inteiro era descartado. Deixando repetir, cada linha acha a sua.
    for (let k = Math.max(0, ultima); k < faixas.length; k++) {
      const d = Math.abs(centros[k] - alvo)
      if (d < dist) { dist = d; melhor = k }
    }
    // Longe demais para ser a mesma linha: melhor não mexer do que apontar
    // para o texto errado.
    // Teto de 2 alturas de linha: com 1,2 os balões cuja caixa o modelo errou
    // por mais de uma linha eram descartados inteiros, e é justamente neles
    // que a medição por pixel mais vale.
    // 2,6 alturas: o mesmo "OOGH ..." tinha os pontos a 40 px com teto de 37 —
    // perdia por três pixels. A fusão protege o excesso: linha que cai na
    // faixa da vizinha vira uma só, em vez de apontar para o lugar errado.
    if (melhor < 0 || dist > alturaMedia * cv.height * 2.6) return false
    escolhidas.push(melhor)
    ultima = melhor
  }

  // Linhas que caíram na MESMA faixa são a mesma linha impressa: viram uma só,
  // com os textos juntos. Sem fundir, duas faixas idênticas se sobreporiam e
  // o realce ficaria dobrado no mesmo lugar.
  const fundidas = []
  const mapa = []
  for (let k = 0; k < escolhidas.length; k++) {
    const anterior = fundidas.length - 1
    if (anterior >= 0 && mapa[anterior] === escolhidas[k]) {
      fundidas[anterior].t += ' ' + b.ls[k].t
    } else {
      fundidas.push({ t: b.ls[k].t })
      mapa.push(escolhidas[k])
    }
  }
  b.ls = fundidas

  for (let k = 0; k < mapa.length; k++) {
    const [fy0, fy1] = faixas[mapa[k]]
    // Onde a linha começa e termina na horizontal — a largura real das letras.
    let cx0 = W, cx1 = -1
    for (let y = fy0; y <= fy1; y++) {
      const base = y * W * 4
      for (let x = 0; x < W; x++) {
        const i = base + x * 4
        if ((dados[i] + dados[i + 1] + dados[i + 2]) / 3 <= escuro) {
          if (x < cx0) cx0 = x
          if (x > cx1) cx1 = x
        }
      }
    }
    if (cx1 < cx0) continue
    const l = b.ls[k]
    l.y = +((Y + fy0) / cv.height).toFixed(4)
    l.h = +((fy1 - fy0 + 1) / cv.height).toFixed(4)
    l.x = +((X + cx0) / cv.width).toFixed(4)
    l.w = +((cx1 - cx0 + 1) / cv.width).toFixed(4)
  }

  // A caixa do balão volta a ser a união — agora das linhas MEDIDAS.
  const ux0 = Math.min(...b.ls.map(l => l.x))
  const uy0 = Math.min(...b.ls.map(l => l.y))
  const ux1 = Math.max(...b.ls.map(l => l.x + l.w))
  const uy1 = Math.max(...b.ls.map(l => l.y + l.h))
  b.x = +ux0.toFixed(4); b.y = +uy0.toFixed(4)
  b.w = +(ux1 - ux0).toFixed(4); b.h = +(uy1 - uy0).toFixed(4)
  b.px = 1     // carimbo: esta caixa já foi medida no pixel
  return true
}
