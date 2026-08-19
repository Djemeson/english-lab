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

// Quanto se espera por UMA página antes de desistir. Dois minutos é folgado
// para uma leitura que normalmente leva 7 segundos, e curto o bastante para
// não parecer que o app morreu.
const MG_TETO_MS = 120000

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
// Menor tamanho em que o texto aceso ainda se lê. Abaixo disso, quem cede é
// a caixa — ver `_mgCrescerCaixa`.
const MG_FONTE_MIN = 12
// A folga invisível que cada faixa ganha na tela, para o texto do navegador
// não encostar nas bordas da linha medida. Entra no HTML e SAI da conta do
// tamanho da fonte — senão a letra digital nasce menor que a desenhada.
const MG_FOLGA_V = 0.12
const MG_FOLGA_H = 0.03

// ⚠️ `font-size` NÃO É A ALTURA DA LETRA. Numa fonte comum a maiúscula ocupa
// uns 72% do corpo — então uma faixa de 20 px de letra impressa precisa de
// fonte de ~28 px para casar, e não de 20. Era por isso que o texto aceso
// aparecia visivelmente menor que o desenhado, mesmo com a faixa certa.
//
// A proporção é MEDIDA na fonte que está valendo, não chutada: o mesmo
// cálculo serve se um dia a fonte do mangá mudar.
let _mgCaps = 0
function _mgRazaoCaps(amostra) {
  if (_mgCaps) return _mgCaps
  _mgCaps = 0.72
  try {
    const cs = getComputedStyle(amostra)
    const ctx = document.createElement('canvas').getContext('2d')
    ctx.font = (cs.fontWeight || '400') + ' 100px ' + (cs.fontFamily || 'sans-serif')
    const m = ctx.measureText('HEMX')
    const alt = (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0)
    if (alt > 40 && alt < 110) _mgCaps = alt / 100
  } catch (e) { /* fica o valor típico */ }
  return _mgCaps
}

// ⚠️ O ENTRELINHA VEM DO ORIGINAL, NÃO DA CAIXA. Repartir as linhas por igual
// dentro do balão parece certo e não é: a caixa é a UNIÃO das linhas medidas,
// e basta uma medição folgada para ela inflar — aí as linhas se afastam e o
// bloco fica espalhado, sem relação com o desenho. Ele mostrou os dois lado a
// lado: num balão o encaixe é perfeito, no outro o texto está esparramado.
//
// O passo entre as linhas impressas já está nos dados: é a distância entre os
// topos que a projeção mediu. Tomando a MEDIANA dessas distâncias, o
// espaçamento fica regular E igual ao do balão desenhado — regularidade sem
// perder o encaixe. Mediana, e não média, porque uma linha medida torta não
// pode arrastar as outras.
function _mgRegularizar(b) {
  const ls = b.ls
  if (!ls || ls.length < 2) return
  const ord = [...ls].sort((a, c) => a.y - c.y)
  const passos = []
  for (let k = 1; k < ord.length; k++) passos.push(ord[k].y - ord[k - 1].y)
  const mediana = arr => {
    const a = [...arr].sort((x, y) => x - y)
    const m = a.length >> 1
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
  }
  const passo = mediana(passos)
  if (!(passo > 0)) return

  // ⚠️ PASSO DOBRADO NÃO É ERRO DE MEDIÇÃO — É UMA LINHA QUE VALE POR DUAS.
  // Medido no balão que ele fotografou: passos de 0,0356 / 0,0175 / 0,0175. A
  // IA leu "YOU KNOW HE'S NOT THE KIND" como UMA linha, mas no desenho são
  // duas, e a projeção mediu a faixa inteira — daí a primeira distância ser o
  // dobro das outras.
  //
  // Forçar tudo ao passo mediano (o conserto óbvio) comprimiria o bloco e
  // jogaria o texto para fora do balão. O certo é o contrário: reconhecer que
  // aquela faixa comporta mais de uma linha e deixar o texto QUEBRAR dentro
  // dela. Assim a posição continua sendo a medida — que é o que dá o encaixe
  // — e a aparência fica a do original.
  // ⚠️ O SINAL É O VÃO ATÉ A PRÓXIMA, NÃO A ALTURA DA FAIXA. Quando a IA
  // junta duas linhas impressas numa leitura só, a projeção mede a faixa da
  // PRIMEIRA — altura normal — e o que denuncia é a distância até a linha
  // seguinte, que fica o dobro. Medido no balão dele: alturas 0,0112 / 0,0119
  // / 0,0119, todas normais, mas o primeiro vão é 0,035 contra 0,0175 dos
  // outros. O desenho tem CINCO linhas; a leitura trouxe quatro.
  //
  // Reconhecendo isso, a faixa é esticada para cobrir as duas linhas e o
  // texto quebra dentro dela — fica onde está impresso, com a forma que está
  // impressa.
  for (let k = 0; k < ord.length; k++) {
    const l = ord[k]
    const vao = (k + 1 < ord.length) ? (ord[k + 1].y - l.y) : passo
    const quantas = Math.max(1, Math.round(vao / passo))
    l.n = quantas
    if (quantas > 1) l.h = +Math.min(vao, quantas * passo).toFixed(4)
  }

  // A caixa do balão é a união do que ficou.
  // ⚠️ UMA LINHA SEM COORDENADA ENVENENA A CAIXA INTEIRA. `Math.min` com um
  // `undefined` devolve NaN, e o balão terminava com `x: null, w: null` — na
  // tela, largura ZERO. É por isso que vários balões não acendiam ao passar o
  // mouse: não havia área para o ponteiro alcançar. Só entram na conta as
  // linhas com os quatro números.
  const boas = ls.filter(l => [l.x, l.y, l.w, l.h].every(v => typeof v === 'number' && isFinite(v)))
  if (!boas.length) return
  const x0 = Math.min(...boas.map(l => l.x))
  const y0 = Math.min(...boas.map(l => l.y))
  const x1 = Math.max(...boas.map(l => l.x + l.w))
  const y1 = Math.max(...boas.map(l => l.y + l.h))
  if (![x0, y0, x1, y1].every(v => isFinite(v))) return
  b.x = +x0.toFixed(4); b.y = +y0.toFixed(4)
  b.w = +(x1 - x0).toFixed(4); b.h = +(y1 - y0).toFixed(4)
}

// ⚠️ A CAIXA CRESCE, O TEXTO NÃO ENCOLHE MAIS. A varredura mostrou 92 textos
// transbordando e 40 blocos com fonte ilegível, e os dois eram o MESMO
// problema: caixa pequena demais para o que a IA leu. Encolher a fonte tem
// limite — passado ele, o texto acende e continua sem se ler.
//
// A caixa é um alvo INVISÍVEL sobre a arte: aumentá-la não estraga nada, só
// dá mais área para o dedo. Cresce a partir do CENTRO, para o texto continuar
// sobre a linha impressa, e no máximo 2,2x — acima disso a caixa começaria a
// cobrir a fala vizinha e o toque pegaria a errada.
// Cresce o balão inteiro, mantendo o centro no lugar. As linhas, sendo
// porcentagem dele, se esticam juntas e o entrelinha continua uniforme.
function _mgCrescerBalao(cont, aumentoPx) {
  const alturaAtual = cont.clientHeight
  if (!alturaAtual || aumentoPx < 1) return
  const nova = Math.min(alturaAtual + aumentoPx, alturaAtual * 2.4)
  const cresceu = nova - alturaAtual
  if (cresceu < 1) return
  const ref = cont.offsetParent ? cont.offsetParent.clientHeight : 0
  if (!ref) return
  cont.style.height = ((nova / ref) * 100).toFixed(3) + '%'
  cont.style.top = Math.max(0, (cont.offsetTop - cresceu / 2) / ref * 100).toFixed(3) + '%'
}

function _mgCrescerCaixa(pai, t, largura, aumentoImposto) {
  const alturaAtual = pai.clientHeight
  if (!alturaAtual) return
  // Quando vem imposto, TODAS as linhas do balão crescem o mesmo tanto — é o
  // que mantém o entrelinha uniforme.
  const precisa = (typeof aumentoImposto === 'number')
    ? alturaAtual + aumentoImposto
    : t.scrollHeight
  if (precisa <= alturaAtual + 1) return
  const nova = Math.min(precisa + 2, alturaAtual * 2.4)
  const cresceu = nova - alturaAtual
  if (cresceu < 1) return
  // ⚠️ EM PORCENTAGEM, COMO A CAIXA NASCEU. Escrevendo `height` em px sobre um
  // elemento cujo `top` e `height` estão em % da página, a caixa deixa de
  // acompanhar o zoom: ao ampliar, o texto cresce e a caixa fica do mesmo
  // tamanho. Medido: o `style.height` das linhas continuava "18.308%" mesmo
  // depois de mandar crescer — o valor em px não vingava contra o layout
  // percentual do pai.
  const refAltura = pai.offsetParent ? pai.offsetParent.clientHeight : 0
  if (!refAltura) return
  const novaPct = (nova / refAltura) * 100
  const topoPct = (pai.offsetTop - cresceu / 2) / refAltura * 100
  pai.style.height = novaPct.toFixed(3) + '%'
  pai.style.top = Math.max(0, topoPct).toFixed(3) + '%'
}

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
// A altura de uma linha SIMPLES do balão — referência para saber quantas
// linhas impressas cabem numa faixa marcada como dupla.
function alturaLinhaTipica(linhas) {
  const simples = [...linhas].filter(l => !l.classList.contains('mg-multi')).map(l => l.clientHeight).filter(Boolean)
  if (!simples.length) return 0
  simples.sort((a, b) => a - b)
  return simples[simples.length >> 1]
}

function mangaAjustarLinhas(raiz) {
  const alvo = raiz || document.getElementById('ler-conteudo')
  if (!alvo) return 0
  let n = 0

  // ⚠️ A FONTE É DO BALÃO, NÃO DA LINHA. Calculando linha por linha, cada uma
  // recebia o tamanho que casava a SUA largura — e o balão saía com "IN THE"
  // grande e "GREAT BANQUET" pequeno, cada linha com um espaçamento diferente.
  // Era o que ele descreveu: sem organização, sem padronização, texto maior e
  // outro menor.
  //
  // Um balão é um bloco de texto: as letras têm o mesmo corpo em todas as
  // linhas. Aqui o tamanho é o MENOR que serve para todas — o que cabe na
  // linha mais apertada manda no balão inteiro.
  for (const cont of alvo.querySelectorAll('.mg-balao:not([data-ok])')) {
    // ⚠️ SÓ MEDE COM A IMAGEM PRONTA. A altura da página vem da imagem; antes
    // de ela carregar, a caixa de cada linha ainda está no tamanho reservado
    // pelo `aspect-ratio` e as contas saem de um layout que vai mudar. O
    // resultado ficava carimbado como definitivo e nunca mais era revisto —
    // eram os 6 balões com entrelinha irregular, que sumiam ao remedir à mão.
    const pagina = cont.closest('.mg-pagina')
    const imgPg = pagina && pagina.querySelector('.mg-img')
    if (!imgPg || !imgPg.complete || !imgPg.naturalWidth) continue

    const linhas = [...cont.querySelectorAll('.mg-linha')]

    // Balão sem linhas separadas: um bloco só, que quebra e se ajusta pela
    // altura da caixa.
    if (!linhas.length) {
      const t = cont.querySelector('.mg-t-solo')
      if (!t) continue
      const larg = cont.clientWidth, alt = cont.clientHeight
      if (!larg || !alt) continue
      _mgAjustarBloco(cont, t, larg, alt)
      cont.dataset.ok = '1'
      n++
      continue
    }

    // Mede cada linha com uma fonte de referência para descobrir, sem
    // tentativa e erro, qual tamanho ela suportaria.
    const REF = 20
    let tamanho = Infinity
    const medidas = []
    let semLayout = false
    for (const l of linhas) {
      const t = l.querySelector('.mg-t')
      if (!t) continue
      const largura = l.clientWidth
      const altura = l.clientHeight
      if (!largura || !altura) { semLayout = true; break }
      t.style.letterSpacing = ''
      t.style.transform = ''
      t.style.fontSize = REF + 'px'
      const naturalRef = t.offsetWidth || 1
      // ⚠️ FAIXA QUE VALE POR VÁRIAS LINHAS PRECISA DE FONTE MAIOR, NÃO MENOR.
      // Marcar a faixa como dupla não bastava: o texto continuava cabendo numa
      // linha só e ficava boiando no meio de uma caixa de 59 px. Para ele
      // quebrar em `n` linhas, a fonte tem de ser a que faria o texto ocupar
      // `n` vezes a largura da faixa — aí a quebra acontece sozinha, onde o
      // letrista quebrou.
      // ⚠️ A FONTE CONTINUA UNIFORME; QUEM FORÇA A QUEBRA É A LARGURA. Pedir
      // fonte maior para a faixa dupla não funciona: o tamanho final é o MENOR
      // de todas as linhas (é isso que mantém o balão parelho), então a multi
      // acabava com a mesma fonte das outras e cabia numa linha só — texto de
      // 23 px boiando numa caixa de 59. Estreitando o espaço disponível para
      // 1/n da largura natural, ela quebra exatamente em n linhas, com a
      // mesma letra das vizinhas.
      const multi = l.classList.contains('mg-multi')
      // Teto de 3: acima disso a conta veio de uma medida torta, e estreitar
      // tanto o texto produz aquela coluna de uma palavra por linha.
      const vezes = multi
        ? Math.min(3, Math.max(2, Math.round(altura / Math.max(1, alturaLinhaTipica(linhas)))))
        : 1
      const porLargura = REF * (largura / naturalRef)
      // A altura ÚTIL é a da letra impressa: tira a folga invisível da faixa
      // e converte de "altura de maiúscula" para "corpo da fonte".
      const util = (altura / (1 + 2 * MG_FOLGA_V)) / _mgRazaoCaps(t)
      const porAltura = (multi ? util / vezes : util) * 0.98
      medidas.push({ l, t, largura, altura, multi, vezes, naturalRef })
      tamanho = Math.min(tamanho, porLargura, porAltura)
    }
    if (semLayout || !medidas.length) continue

    // Piso: abaixo disso o texto acende e continua sem se ler. Quando o piso
    // manda, é a CAIXA que cede depois (ver `_mgCrescerCaixa`).
    // Teto alto de propósito: o grito de meia página é uma linha impressa
    // legítima, e prendê-lo em 44 px fazia o texto aceso sair menor que o
    // desenhado justamente onde a diferença mais aparece.
    tamanho = Math.max(MG_FONTE_MIN, Math.min(tamanho, 96))

    // ⚠️ SE UMA LINHA CRESCE, TODAS CRESCEM. O crescimento por linha
    // desigualava o parágrafo de novo: uma faixa ficava 41 px e a vizinha 58,
    // e o passo voltava a ser irregular em 6 balões. Num bloco de texto, o
    // entrelinha é o mesmo do começo ao fim — se uma linha precisa de mais
    // espaço, é o bloco inteiro que abre.
    let precisaDeMais = 0
    for (const m of medidas) {
      m.t.style.fontSize = tamanho.toFixed(2) + 'px'
      // Faixa dupla: estreita o espaço para o texto quebrar em `vezes` linhas.
      if (m.multi && m.vezes > 1) {
        // ⚠️ NUNCA MAIS ESTREITO QUE A MAIOR PALAVRA. O limite calculado
        // (largura ÷ nº de linhas) pode ficar menor que uma palavra sozinha, e
        // aí o navegador quebra DENTRO dela: ele fotografou "NEA / R / DE /
        // ENTWANCE...". `min-content` é exatamente a largura da maior palavra;
        // com `max()`, o limite nunca desce abaixo dela.
        const natural = m.t.scrollWidth || m.largura
        const alvo = Math.max(24, Math.ceil(natural / m.vezes) + 2)
        m.t.style.maxWidth = 'max(' + alvo + 'px, min-content)'
      } else {
        m.t.style.maxWidth = ''
      }
      const falta = m.t.scrollHeight - m.l.clientHeight
      if (falta > precisaDeMais) precisaDeMais = falta
    }
    // ⚠️ QUEM CRESCE É O BALÃO, NÃO CADA LINHA. Crescer linha a linha —
    // mesmo com o mesmo aumento — desiguala: cada caixa tem altura levemente
    // diferente por arredondamento de porcentagem, e `altura + aumento` gera
    // valores diferentes, além de deslocar cada uma por metade de um número
    // diferente. Era o entrelinha irregular que sobrava em 6 balões.
    //
    // As linhas são frações do balão (1/n cada). Crescendo o balão, elas
    // acompanham juntas e o passo continua idêntico — de graça.
    // ⚠️ BALÃO MEDIDO NA IMAGEM NÃO CRESCE. Crescer a caixa era a saída certa
    // quando ela vinha do modelo e podia estar apertada demais — aumentar um
    // alvo invisível não estragava nada. Agora a caixa É o balão desenhado, e
    // qualquer crescimento empurra o fundo aceso para cima do traço: o
    // remendo que este trabalho inteiro existe para eliminar. Aqui quem cede
    // é a fonte, não o balão.
    if (precisaDeMais > 1 && !cont.classList.contains('mg-forma')) {
      _mgCrescerBalao(cont, precisaDeMais * medidas.length)
    }

    for (const m of medidas) {
      m.t.style.fontSize = tamanho.toFixed(2) + 'px'
      // ⚠️ SEM ESTICAR E SEM ESPAÇAR. Forçar cada linha a preencher a largura
      // exata era o que produzia "I N   T H E". Centralizado na própria caixa,
      // o bloco fica alinhado como o original — e o realce continua sobre as
      // letras, porque a caixa é a da linha impressa.
      m.t.style.letterSpacing = ''
      m.t.style.transform = ''
      // Só o excesso que sobrar depois disso é encolhido — deformar um pouco
      // é melhor que vazar para a fala vizinha.
      const sobra = m.t.scrollWidth
      if (sobra > m.l.clientWidth + 1) {
        m.t.style.transform = 'scaleX(' + Math.max(0.35, m.l.clientWidth / sobra).toFixed(4) + ')'
      }
    }
    cont.dataset.ok = '1'
    n++
  }
  return n
}

// O bloco de texto corrido (páginas de resumo): quebra em várias linhas e
// procura o maior tamanho que cabe na caixa.
function _mgAjustarBloco(cont, t, largura, altura) {
  t.style.letterSpacing = ''
  t.style.transform = ''
  // ⚠️ O PISO VALE JÁ NO PONTO DE PARTIDA. O laço abaixo respeitava
  // `MG_FONTE_MIN` ao encolher, mas o valor INICIAL saía de `altura * 0.9` —
  // numa caixa de 11 px isso já nascia com 9,9 px, abaixo do legível, e o
  // laço nunca subia. Eram os 3 blocos que a varredura ainda pegava.
  let tam = Math.max(MG_FONTE_MIN, Math.min(altura * 0.9, 34))
  t.style.fontSize = tam.toFixed(1) + 'px'
  for (let k = 0; k < 22 && (t.scrollHeight > altura + 1 || t.scrollWidth > largura + 1); k++) {
    if (tam * 0.92 < MG_FONTE_MIN) break
    tam *= 0.92
    t.style.fontSize = tam.toFixed(1) + 'px'
  }
  // Mesma razão do balão linhado: com a caixa medida na imagem, crescer é
  // vazar para cima do desenho.
  if (!cont.classList.contains('mg-forma')) _mgCrescerCaixa(cont, t, largura)
  if (t.scrollWidth > largura + 1) {
    t.style.transform = 'scaleX(' + Math.max(0.35, largura / t.scrollWidth).toFixed(4) + ')'
  }
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

// ⚠️ NÃO PEÇA A CAIXA DE CADA LINHA. Pedia-se, e o modelo QUEBRAVA O JSON:
// capturado na resposta crua da página 28, ele escreve o texto da primeira
// linha e emenda as caixas das outras como chaves repetidas no mesmo objeto —
// `{"text":"YOU KNOW","box_2d":[...],"box_2d":[...],"box_2d":]` —, o que não
// é JSON e derruba a página inteira. Duas leituras seguidas falharam assim, e
// o app só sabia dizer "a resposta veio, mas não era JSON válido".
//
// A causa é o formato: uma lista de objetos aninhados dentro de outra lista de
// objetos é o que ele erra. E agora nem é preciso — a posição de cada linha
// sai da IMAGEM. Do modelo só se quer o que ele faz bem: LER. As linhas viram
// uma lista de textos, o JSON encolhe umas três vezes e o aninhamento some.
const MG_PEDIDO = `You are reading ONE page of an English-language manga/comic.

Return ONLY JSON, no prose:
{"balloons":[{"text":"...","box_2d":[ymin,xmin,ymax,xmax],
  "lines":["first printed line","second printed line"]}],"sfx":["..."]}

Rules:
- One entry per SPEECH BALLOON (also thought balloons and caption boxes).
- "text": the dialogue exactly as printed. Join broken lines into one sentence
  with single spaces. Keep punctuation and apostrophes. NEVER translate.
- "box_2d": bounding box of the balloon's TEXT as [ymin, xmin, ymax, xmax],
  normalized to 0-1000. Exactly four numbers, one box per balloon.
- "lines": ONE STRING per printed line of that balloon, in reading order.
  Plain strings only — no objects, no boxes, no extra keys.
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
    // ⚠️ TETO PRÓPRIO, PORQUE O DE DENTRO NÃO BASTA. Aconteceu três vezes
    // nesta série: a leitura de uma página ficava em voo indefinidamente, sem
    // retorno E SEM ERRO — a trava nunca era solta, o selo ficava eterno em
    // "lendo…" e a página nunca mais era tentada. Uma chamada que não volta é
    // pior que uma que falha: a que falha o usuário reinicia.
    //
    // A cadeia de IA já tem tempo-limite, mas ela tenta vários modos de JSON e
    // ainda cai para um fornecedor reserva — cada etapa com o seu prazo. O
    // total pode passar de muitos minutos, e qualquer promessa que não resolva
    // no meio disso trava tudo. Este teto é o único que conhece o tempo que a
    // PESSOA está disposta a esperar por uma página.
    const resp = await Promise.race([
      aiVisaoJSON(MG_PEDIDO, b64, { maxTokens: 24000 }),
      new Promise((_, falhar) => setTimeout(
        () => falhar(new Error('demorou demais (mais de 2 min)')), MG_TETO_MS))
    ])
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
    // ⚠️ PONTUAÇÃO SOZINHA NÃO É LINHA — é o fim da anterior. A IA devolve
    // "OOGH" + "..." e "ROBIN" + "!!!" como duas linhas porque VÊ dois blocos,
    // mas a página tem UMA linha impressa. Essa diferença foi a causa de quase
    // todos os balões que a medição recusava, e afrouxar limites para caber
    // esses casos só empurrava o defeito para o vizinho.
    //
    // Fundindo aqui, na entrada, o número de linhas volta a bater com o que a
    // projeção encontra — e nenhuma constante precisa ceder.
    const soSinais = t => /^[^\p{L}\p{N}]+$/u.test(t)
    // ⚠️ A LINHA PODE CHEGAR COMO TEXTO PURO — é o formato pedido hoje, e o
    // caminho normal. A caixa dela é ESTIMADA aqui, repartindo a do balão em
    // fatias iguais: serve de ponto de partida para a medição no pixel, que é
    // quem vai dizer onde a linha realmente está. O formato antigo (objeto com
    // `box_2d`) continua aceito, para uma resposta antiga não virar página em
    // branco.
    const cruas = Array.isArray(b.lines) ? b.lines : []
    const soTexto = cruas.length && cruas.every(l => typeof l === 'string')
    if (soTexto) {
      // Caminho normal: a fala já vem quebrada em textos. A caixa de cada
      // linha é uma FATIA IGUAL da caixa do balão — palpite grosseiro, e é
      // só o que precisa ser: quem diz onde a linha está é a medição no
      // pixel, e este valor serve para ela saber por onde começar.
      const textos = []
      for (const l of cruas) {
        const lt = String(l).replace(/\s+/g, ' ').trim()
        if (!lt) continue
        if (textos.length && soSinais(lt)) { textos[textos.length - 1] += ' ' + lt; continue }
        textos.push(lt)
      }
      const n = textos.length || 1
      textos.forEach((lt, k) => linhas.push({
        t: lt,
        x: +x.toFixed(4), y: +(y + h * k / n).toFixed(4),
        w: +w.toFixed(4), h: +(h / n).toFixed(4)
      }))
    } else
    for (const l of cruas) {
      const lt = String((l && l.text) || (l && l.t) || '').replace(/\s+/g, ' ').trim()
      const lc = _mgCaixa(l, escala)
      if (!lt || !lc) continue
      const lx = preso(lc.x, 0, 1), ly = preso(lc.y, 0, 1)
      const lw = Math.min(1 - lx, Math.max(0, lc.w)), lh = Math.min(1 - ly, Math.max(0, lc.h))
      if (lw < 0.008 || lh < 0.004) continue
      // Linha alta demais é caixa errada, não letra grande: encolhida para 4%
      // em torno do próprio centro.
      const linha = { t: lt, x: +lx.toFixed(4), y: +ly.toFixed(4), w: +lw.toFixed(4), h: +lh.toFixed(4) }
      if (linha.h > 0.06) {
        const meio = linha.y + linha.h / 2
        linha.h = 0.04
        linha.y = +Math.max(0, meio - 0.02).toFixed(4)
      }
      const ant = linhas[linhas.length - 1]
      if (ant && soSinais(lt)) {
        const x2b = Math.max(ant.x + ant.w, linha.x + linha.w)
        const y2b = Math.max(ant.y + ant.h, linha.y + linha.h)
        ant.x = +Math.min(ant.x, linha.x).toFixed(4)
        ant.y = +Math.min(ant.y, linha.y).toFixed(4)
        ant.w = +(x2b - ant.x).toFixed(4)
        ant.h = +(y2b - ant.y).toFixed(4)
        ant.t += ' ' + lt
        continue
      }
      linhas.push(linha)
    }
    const item = { t, x: +x.toFixed(4), y: +y.toFixed(4), w: +w.toFixed(4), h: +h.toFixed(4) }
    // Nenhum balão entra no acervo com número inválido: um NaN aqui vira
    // largura zero na tela e um balão que nunca acende.
    if (![item.x, item.y, item.w, item.h].every(v => isFinite(v))) continue
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
      // Cada página já tem teto próprio; aqui o `catch` garante que uma falha
      // não derrube a fila inteira — o volume continua nas páginas seguintes.
      let ok = false
      try { ok = await mangaLerPagina(i, true) } catch (e) { ok = false }
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
let _mgReajuste = 0      // recálculo das fontes depois de mudar o zoom
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
// ⚠️ NÃO EXISTE MAIS RECORTE DE FORMA, E ISSO É UMA SIMPLIFICAÇÃO, NÃO UMA
// PERDA. A primeira versão desenhava o fundo aceso no contorno do balão, com
// um polígono de dez pontos — precisava disso porque a caixa era a do balão
// fechado e um retângulo cobriria os cantos. Com a caixa crescendo dentro do
// papel, ela JÁ é toda branca por construção: um retângulo ali é invisível, e
// o polígono virou peso sem efeito (dados a mais no banco, um risco a mais de
// alvo inalcançável se a forma saísse torta).
function _mgCamadaHtml(c) {
  const baloes = Array.isArray(c && c.baloes) ? c.baloes : []
  return baloes.map((b, n) => {
    // As cores saem da PÁGINA, não do tema: mangá escaneado tem miolo creme e
    // tinta cinza-escura, e branco puro sobre creme aparece como remendo.
    const cores = (b.bg ? '--mg-bg:' + b.bg + ';' : '') + (b.fg ? '--mg-fg:' + b.fg + ';' : '')
    const est = cores +
                'left:' + (b.x * 100).toFixed(3) + '%;top:' + (b.y * 100).toFixed(3) + '%;' +
                'width:' + (b.w * 100).toFixed(3) + '%;height:' + (b.h * 100).toFixed(3) + '%'
    // A cor medida é o carimbo de "esta caixa saiu da imagem": só ela pode
    // dispensar a aura de 3 px e proibir o crescimento da caixa.
    const abre = '<span class="mg-balao' + (b.ls && b.ls.length ? ' mg-linhado' : '') +
                 (b.bg ? ' mg-forma' : '') +
                 '" style="' + est + '" data-b="' + n + '" onclick="mangaTocarBalao(this, event)">'
    // ⚠️ BALÃO SEM LINHAS TAMBÉM PRECISA DO FILHO AJUSTÁVEL. Sem ele o texto
    // fica com a fonte fixa do CSS (min(2.6vw,15px)) — e ao acender no hover
    // aparecia uma letrinha perdida no meio do balão, ou nada visível. Foi o
    // "várias páginas não acontece nada ao passar o mouse".
    if (!b.ls || !b.ls.length) {
      return abre + '<i class="mg-t mg-t-solo">' + esc(b.t || '') + '</i></span>'
    }
    // ⚠️ AS LINHAS SÃO DISTRIBUÍDAS POR IGUAL, não coladas onde a medição as
    // achou. A projeção acerta ONDE está o bloco de texto, mas as faixas que
    // ela devolve têm alturas e vãos irregulares — uma linha com 19 px, a
    // seguinte com 49, um vão de 58 px onde os outros têm 28. Enquanto o texto
    // era invisível isso não aparecia; agora que ele ACENDE, o balão sai com
    // as falas espalhadas, exatamente o que ele fotografou.
    //
    // Um balão é um parágrafo: as linhas se empilham com o mesmo passo. Aqui
    // o bloco ocupa a mesma faixa vertical que a medição encontrou (do topo da
    // primeira ao fim da última), e as linhas se repartem por igual dentro
    // dela. A posição do bloco continua vindo do pixel; só a arrumação
    // interna passa a ser regular.
    const totalLinhas = b.ls.length
    const corpo = b.ls.map((l, k) => {
      // ⚠️ FOLGA HORIZONTAL TAMBÉM. A faixa é medida colada nas letras
      // desenhadas, e a mesma frase na fonte do navegador quase nunca mede
      // igual — sem uma casquinha de sobra, ela é encolhida à força e a linha
      // sai mais magra que a impressa. 3% de cada lado, com o CENTRO parado.
      const folgaH = (b.w ? l.w / b.w : 1) * MG_FOLGA_H
      const lx = (b.w ? (l.x - b.x) / b.w : 0) - folgaH
      const lw = (b.w ? l.w / b.w : 1) + folgaH * 2
      // ⚠️ A POSIÇÃO É A MEDIDA, não uma fatia igual do balão. Fatiar por
      // igual espalhava as linhas quando a caixa vinha folgada; a posição
      // medida (já regularizada por `_mgRegularizar`) é o que faz o texto
      // cair exatamente sobre a fala impressa.
      // ⚠️ UMA FOLGA SIMÉTRICA NA FAIXA. Medida no pixel, ela fica colada nas
      // letras — e o texto do navegador, com outra fonte, encosta ou passa 1-2
      // px. Eram 72 casos. Crescendo 12% para cada lado, o CENTRO não se move
      // (o encaixe é o mesmo) e o texto respira. A folga é invisível: a faixa
      // não desenha nada.
      const folga = (b.h ? l.h / b.h : 1 / totalLinhas) * MG_FOLGA_V
      const ly = (b.h ? (l.y - b.y) / b.h : k / totalLinhas) - folga
      const lh = (b.h ? l.h / b.h : 1 / totalLinhas) + folga * 2
      // A fonte sai da ALTURA REAL da linha na folha: `--mg-alt` é a altura da
      // página em px e `l.h` a fração que a linha ocupa. Assim a faixa de
      // realce tem a espessura da linha impressa, em qualquer zoom.
      // A fonte de partida sai da fatia, não da faixa medida — quem manda no
      // tamanho final é `mangaAjustarLinhas`, que mede todas e escolhe uma só
      // para o balão inteiro.
      const estL = 'left:' + (lx * 100).toFixed(3) + '%;top:' + (ly * 100).toFixed(3) + '%;' +
                   'width:' + (lw * 100).toFixed(3) + '%;height:' + (lh * 100).toFixed(3) + '%;' +
                   'font-size:calc(var(--mg-alt, 1600px) * ' + (b.h / totalLinhas).toFixed(4) + ')'
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
      // Faixa que comporta mais de uma linha impressa: o texto pode quebrar
      // dentro dela — ver `_mgRegularizar`.
      const cls = (l.n > 1) ? 'mg-linha mg-multi' : 'mg-linha'
      return '<span class="' + cls + '" style="' + estL + '"><i class="mg-t">' +
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

    // ⚠️ CAIXA INVÁLIDA JÁ SALVA NO APARELHO. Versões anteriores gravaram
    // balões com `x` e `w` nulos — na tela, largura ZERO: nenhum ponteiro os
    // alcança e eles nunca acendem. Consertar só no código novo não bastaria,
    // porque o dado ruim está no acervo dele e a releitura custaria dinheiro.
    // Aqui a linha sem coordenada herda o que houver por perto; se nem isso,
    // o balão é descartado — melhor um a menos que um alvo invisível que
    // parece defeito.
    for (let k = c.baloes.length - 1; k >= 0; k--) {
      const b = c.baloes[k]
      const ruim = v => typeof v !== 'number' || !isFinite(v)
      if (Array.isArray(b.ls)) {
        const refX = b.ls.find(l => !ruim(l.x))
        const refW = b.ls.find(l => !ruim(l.w))
        for (const l of b.ls) {
          if (ruim(l.x)) { l.x = ruim(b.x) ? (refX ? refX.x : NaN) : b.x; mexeu++ }
          if (ruim(l.w)) { l.w = ruim(b.w) ? (refW ? refW.w : NaN) : b.w; mexeu++ }
        }
        b.ls = b.ls.filter(l => ![l.x, l.y, l.w, l.h].some(ruim))
      }
      if ([b.x, b.y, b.w, b.h].some(ruim) || b.w < 0.004 || b.h < 0.004) {
        const bons = (b.ls || []).filter(l => ![l.x, l.y, l.w, l.h].some(ruim))
        if (!bons.length) { c.baloes.splice(k, 1); mexeu++; continue }
        const x0 = Math.min(...bons.map(l => l.x)), y0 = Math.min(...bons.map(l => l.y))
        const x1 = Math.max(...bons.map(l => l.x + l.w)), y1 = Math.max(...bons.map(l => l.y + l.h))
        b.x = +x0.toFixed(4); b.y = +y0.toFixed(4)
        b.w = +(x1 - x0).toFixed(4); b.h = +(y1 - y0).toFixed(4)
        mexeu++
      }
    }

    for (const b of c.baloes) {
      if (!b.ls || !b.ls.length) continue
      // ⚠️ BALÃO MEDIDO PELA IMAGEM NÃO ENTRA AQUI. A caixa dele é o balão
      // desenhado — maior que as linhas de texto, de propósito, porque é ela
      // que o fundo aceso preenche. Envolver as linhas encolheria a caixa de
      // volta ao texto e o encaixe no desenho se perderia na primeira
      // abertura do livro.
      if (b.px >= 3) continue
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
    // ⚠️ O CARIMBO É VERSÃO, NÃO "JÁ MEDIU". Enquanto era só um sinal de
    // presença, o acervo dele ficava preso na medição da época em que a
    // página foi lida — e ver o conserto exigiria reler o volume, que custa
    // dinheiro. Comparando VERSÕES, cada página se remede sozinha na primeira
    // vez que entra na tela, sem uma chamada de IA.
    const precisa = Array.isArray(c.baloes) && c.baloes.some(b => b && b.t && b.px !== MG_PX_V)
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
  // ⚠️ ZOOM NOVO, MEDIDAS NOVAS. O tamanho da fonte de cada balão é calculado
  // a partir da caixa EM PIXELS, e a caixa muda de tamanho junto com o zoom.
  // Sem refazer a conta, ampliar a página deixava o texto do mesmo tamanho de
  // antes — miúdo numa página grande — e reduzir deixava o texto transbordando.
  // A marca `data-ok` é o que impede recalcular à toa; aqui ela é limpa de
  // propósito, porque a premissa dela mudou.
  clearTimeout(_mgReajuste)
  _mgReajuste = setTimeout(() => {
    document.querySelectorAll('#ler-conteudo .mg-balao[data-ok]').forEach(b => { delete b.dataset.ok })
    mangaAjustarLinhas()
  }, 120)
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
  // Dois dedos na tela: o gesto é nosso. Sem isto o leitor ainda podia
  // interpretar o movimento como arrasto de página.
  if (typeof _lerT !== 'undefined') _lerT = null
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
  // Carimbo para o duplo toque se calar logo depois — ver `_mgToqueDuplo`.
  _mgFimDaPinca = Date.now()
  _mgUltimoToque = 0
  // Só agora grava e redesenha o rótulo: durante o gesto seriam dezenas de
  // gravações por segundo, e o número piscando no rodapé cansa a vista.
  saveCfg()
  _mgBarraZoom()
}

// Dois toques rápidos voltam ao ajuste — é o "desfazer" do gesto, e sem ele
// a única saída da pinça seria caçar o botão certo no rodapé.
let _mgUltimoToque = 0
let _mgFimDaPinca = 0

// ⚠️ SOLTAR A PINÇA GERA DOIS `touchend`, e eram lidos como duplo toque: o
// gesto terminava desfazendo o próprio zoom que a pessoa acabara de dar — ou,
// quando o segundo dedo saía antes, o toque solto virava virada de página.
// Foi o que ele descreveu: "deu zoom, mas ao soltar volta pro tamanho normal,
// ou pior, passava a página".
//
// Meio segundo de silêncio depois de uma pinça resolve: é mais do que a mão
// leva para tirar o segundo dedo, e menos do que alguém leva para decidir dar
// dois toques de propósito.
function _mgToqueDuplo(ev) {
  if (ev.touches && ev.touches.length > 1) return
  const agora = Date.now()
  if (agora - _mgFimDaPinca < 500) { _mgUltimoToque = 0; return }
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
  // ⚠️ BALÃO SEM LINHAS SEPARADAS TAMBÉM É MEDIDO AGORA. Antes a medição
  // dependia das linhas que a IA devolvia, e quem viesse como bloco único
  // ficava para sempre com a caixa aproximada dela. A detecção pela imagem
  // não precisa delas: acha o balão e as linhas por conta própria.
  if (!Array.isArray(baloes) || !baloes.some(b => b && b.t)) return 0
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
    if (!b || !b.t) continue
    if (_mgMedirBalao(ctx, cv, b, baloes)) afinados++
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
  // Sem folga horizontal: a janela é a do balão. Alargar convidava a moldura
  // do quadro para dentro da conta, e era ela que esticava a medição.
  const x0 = Math.max(0, b.x)
  const x1 = Math.min(1, b.x + b.w)

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

  // ⚠️ TETO DE SANIDADE NA ALTURA MÍNIMA. Ela é derivada da caixa que o
  // MODELO deu, e o modelo às vezes erra feio: MEDIDO, o balão "WHAT?!" — uma
  // palavra — veio com caixa de 30% da ALTURA DA PÁGINA. A exigência virava
  // "faixa de 95 px ou nada", nenhuma linha real chegava lá e o balão ficava
  // sem medição para sempre.
  // Nenhuma linha de mangá passa de ~2,5% da folha; acima disso a caixa está
  // errada, e a conta não pode herdar o erro dela.
  const minAltura = Math.max(3, Math.min(
    alturaMedia * cv.height * 0.20,
    cv.height * 0.025
  ))
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
      // ⚠️ E UM TETO TAMBÉM. Sem ele a projeção aceita como "linha" uma
      // mancha contínua de tinta — arte escura, cabelo preto, fundo hachurado
      // — e devolve uma faixa de 30% da página. MEDIDO: foi o que aconteceu
      // com o "WHAT?!" assim que ele passou a ser aceito: virou um alvo
      // gigante de texto invisível por cima do desenho, pior que não medir.
      const alt = fim - ini
      if (alt >= minAltura && alt <= cv.height * 0.06) faixas.push([ini, fim])
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
      // ⚠️ COPIA A LINHA INTEIRA, não só o texto. Criando `{ t }` puro, a
      // linha nascia SEM coordenadas — e se a largura medida logo abaixo
      // fosse rejeitada por implausível, ela ficava sem `x` e sem `w` para
      // sempre. Uma linha assim envenena a união e o balão termina com
      // largura ZERO: nenhum ponteiro consegue alcançá-lo, e ele nunca
      // acende. Eram 31 balões. As coordenadas da IA ficam de reserva.
      fundidas.push(Object.assign({}, b.ls[k]))
      mapa.push(escolhidas[k])
    }
  }
  b.ls = fundidas

  for (let k = 0; k < mapa.length; k++) {
    const [fy0, fy1] = faixas[mapa[k]]
    const l = b.ls[k]
    const alturaPx = fy1 - fy0 + 1
    // ⚠️ A PROJEÇÃO SÓ MEXE NA VERTICAL. Lição de cinco rodadas de conserto:
    // horizontalmente ela erra, e erra feio — pegou de uma borda do quadro à
    // outra (45% da página), colou linhas na margem esquerda (x:0), devolveu
    // faixas de 3 px. Cada erro pedia uma heurística nova, e a pilha delas
    // produziu resultados piores que o começo.
    //
    // O motivo: numa FILEIRA de pixels o texto e o desenho se misturam — a
    // moldura do quadro, o contorno do balão e a arte estão na mesma altura
    // das letras. Numa COLUNA o texto se separa sozinho: linhas são picos,
    // vãos são vales. É onde ela acerta, e agora é só o que ela faz.
    //
    // A largura vem da caixa que a IA deu ao balão — ela VÊ o balão.
    l.y = +((Y + fy0) / cv.height).toFixed(4)
    l.h = +(alturaPx / cv.height).toFixed(4)
    l.x = b.x
    l.w = b.w
  }

  // ⚠️ A REDE VEM ANTES DA UNIÃO, e essa ordem é o conserto. Ela estava depois
  // — e quando NENHUMA linha tinha coordenada horizontal, a união desistia
  // (`return false`) e a rede nunca chegava a rodar. O balão ficava com
  // largura nula para sempre, sem área nenhuma para o ponteiro: era o
  // "vários balões não acontece nada ao passar o mouse".
  //
  // Herdar a caixa da IA é impreciso, mas alvo impreciso ainda é alcançável;
  // alvo nenhum não é.
  for (const l of b.ls) {
    if (typeof l.x !== 'number' || !isFinite(l.x)) l.x = b.x
    if (typeof l.w !== 'number' || !isFinite(l.w)) l.w = b.w
    if (typeof l.y !== 'number' || !isFinite(l.y)) l.y = b.y
    if (typeof l.h !== 'number' || !isFinite(l.h)) l.h = b.h
  }

  // A caixa do balão volta a ser a união — agora das linhas MEDIDAS.
  const bons = b.ls.filter(l => [l.x, l.y, l.w, l.h].every(v => typeof v === 'number' && isFinite(v)))
  if (!bons.length) return false
  const ux0 = Math.min(...bons.map(l => l.x))
  const uy0 = Math.min(...bons.map(l => l.y))
  const ux1 = Math.max(...bons.map(l => l.x + l.w))
  const uy1 = Math.max(...bons.map(l => l.y + l.h))
  b.x = +ux0.toFixed(4); b.y = +uy0.toFixed(4)
  b.w = +(ux1 - ux0).toFixed(4); b.h = +(uy1 - uy0).toFixed(4)
  // Espaçamento regular, com o passo do próprio balão desenhado.
  _mgRegularizar(b)
  b.px = 1     // carimbo: esta caixa já foi medida no pixel
  return true
}

// ================================================================
// O BALÃO SAI DA IMAGEM — não do modelo
// ================================================================
// ⚠️ ONZE TENTATIVAS DE CONSERTAR A CAIXA DO MODELO FALHARAM, e todas pela
// mesma razão: pedir precisão de pixel a um modelo de visão é pedir a coisa
// errada a quem faz outra. Ele LÊ o texto muito bem — palavra por palavra, em
// todos os testes — e devolve uma caixa aproximada: às vezes 30% da altura da
// folha para uma palavra, às vezes começando na borda da página.
//
// A informação exata está na IMAGEM. Aqui ela é lida em três passos:
//
//   1. O PAPEL. Um preenchimento por vizinhança (o balde de tinta do editor
//      de imagem) a partir de um ponto dentro da fala marca todo o branco
//      LIGADO àquele ponto. Ele para na arte sozinho.
//
//   2. OS BURACOS VIRAM O TEXTO. Todo pixel escuro que ficou CERCADO por esse
//      branco — sem caminho até a borda — é letra, não desenho. Essa única
//      distinção separa o texto do balão da arte da página sem nenhuma
//      heurística: a arte se conecta ao resto do quadro, a letra não.
//
//   3. A CAIXA CRESCE ATÉ ENCOSTAR NA ARTE. Partindo do texto medido, ela
//      abre para os quatro lados enquanto a fileira (ou coluna) inteira for
//      papel. Num balão fechado ela para no traço; num balão ABERTO — sem
//      contorno nenhum, que é metade do One Piece — ela para no desenho mais
//      próximo. Nos dois casos o que acende é SÓ papel: por construção, o
//      fundo aceso nunca cobre um traço do original.
//
// ⚠️ O BALÃO SEM CONTORNO FOI O QUE DERRUBOU A PRIMEIRA VERSÃO DISTO. Ela
// exigia que o preenchimento fosse fechado e usava a caixa dele como caixa do
// balão: medido na página 28 do volume dele, funcionou em 3 balões de 11. Nos
// outros 8 o branco da fala é o MESMO branco do quadro — não existe contorno
// para o balde parar, e a validação "vazou" reprovava tudo. A troca de "a
// caixa é o balão fechado" por "a caixa é o texto crescendo dentro do papel"
// atende os dois desenhos com o mesmo código.

const MG_PX_V = 3          // versão da medição; `b.px` diferente disto remede

// Otsu sobre um mapa de cinza já pronto (o mesmo cálculo de
// `_mgLimiarDaJanela`, sem o passo de RGBA para cinza).
function _mgOtsu(cinza) {
  const hist = new Array(256).fill(0)
  for (let p = 0; p < cinza.length; p++) hist[cinza[p]]++
  const n = cinza.length
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
    const d = somaB / pesoB - (soma - somaB) / pesoF
    const entre = pesoB * pesoF * d * d
    if (entre > melhor) { melhor = entre; corte = t }
  }
  return corte
}

// O balde de tinta. Fila própria em vez de recursão: uma janela de 400x600
// são 240 mil pixels, e recursão nesse tamanho estoura a pilha do navegador.
function _mgPreencher(cinza, W, H, sx, sy, dentro) {
  const total = W * H
  const p0 = sy * W + sx
  if (!dentro(cinza[p0])) return null
  const masc = new Uint8Array(total)
  const fila = new Int32Array(total)
  let ini = 0, fim = 0, area = 0
  masc[p0] = 1; fila[fim++] = p0
  while (ini < fim) {
    const p = fila[ini++]
    area++
    const x = p % W
    if (x > 0 && !masc[p - 1] && dentro(cinza[p - 1])) { masc[p - 1] = 1; fila[fim++] = p - 1 }
    if (x < W - 1 && !masc[p + 1] && dentro(cinza[p + 1])) { masc[p + 1] = 1; fila[fim++] = p + 1 }
    if (p >= W && !masc[p - W] && dentro(cinza[p - W])) { masc[p - W] = 1; fila[fim++] = p - W }
    if (p < total - W && !masc[p + W] && dentro(cinza[p + W])) { masc[p + W] = 1; fila[fim++] = p + W }
  }
  return { masc, area }
}

// ⚠️ ISTO É O CORAÇÃO DA COISA. O que separa a letra do desenho não é
// tamanho, nem posição, nem contraste: é estar CERCADO. A letra flutua num
// mar de papel e não tem caminho até a borda da janela; a arte, por mais
// escura que seja, sempre tem — ela é o resto do quadro.
//
// Preenchendo o complemento a partir das bordas, o que sobrar sem marcar é
// buraco, e buraco é texto. Nenhum limiar de tamanho, nenhuma janela mágica.
function _mgBuracos(masc, W, H) {
  const total = W * H
  const fora = new Uint8Array(total)
  const fila = new Int32Array(total)
  let ini = 0, fim = 0
  const semear = p => { if (!masc[p] && !fora[p]) { fora[p] = 1; fila[fim++] = p } }
  for (let x = 0; x < W; x++) { semear(x); semear((H - 1) * W + x) }
  for (let y = 0; y < H; y++) { semear(y * W); semear(y * W + W - 1) }
  while (ini < fim) {
    const p = fila[ini++]
    const x = p % W
    if (x > 0 && !masc[p - 1] && !fora[p - 1]) { fora[p - 1] = 1; fila[fim++] = p - 1 }
    if (x < W - 1 && !masc[p + 1] && !fora[p + 1]) { fora[p + 1] = 1; fila[fim++] = p + 1 }
    if (p >= W && !masc[p - W] && !fora[p - W]) { fora[p - W] = 1; fila[fim++] = p - W }
    if (p < total - W && !masc[p + W] && !fora[p + W]) { fora[p + W] = 1; fila[fim++] = p + W }
  }
  const buraco = new Uint8Array(total)
  for (let p = 0; p < total; p++) if (!masc[p] && !fora[p]) buraco[p] = 1
  return buraco
}

// A semente tem de cair no PAPEL da fala, e o centro da caixa costuma cair em
// cima de uma letra. Busca em quadrados crescentes o ponto de papel mais
// próximo do palpite.
function _mgAchaSemente(cinza, W, H, sx, sy, dentro) {
  sx = Math.max(0, Math.min(W - 1, Math.round(sx)))
  sy = Math.max(0, Math.min(H - 1, Math.round(sy)))
  if (dentro(cinza[sy * W + sx])) return { x: sx, y: sy }
  const teto = Math.max(6, Math.round(Math.min(W, H) * 0.15))
  for (let r = 1; r <= teto; r++) {
    for (let dy = -r; dy <= r; dy++) {
      const y = sy + dy
      if (y < 0 || y >= H) continue
      const passo = (Math.abs(dy) === r) ? 1 : 2 * r
      for (let dx = -r; dx <= r; dx += passo) {
        const x = sx + dx
        if (x < 0 || x >= W) continue
        if (dentro(cinza[y * W + x])) return { x, y }
      }
    }
  }
  return null
}

// A janela de busca, o papel e o texto — tudo o que os passos seguintes usam.
function _mgDetectarBalao(ctx, cv, b) {
  // ⚠️ A BUSCA PARTE SEMPRE DA CAIXA ORIGINAL DO MODELO, NUNCA DA MEDIDA
  // ANTERIOR. Sem isto, cada nova versão da medição mede em cima do que a
  // anterior deixou, e o erro se acumula em silêncio: a caixa do balão 1
  // desta página já estava com 46% da largura da folha depois de uma rodada.
  // O palpite do modelo é ruim, mas é ESTÁVEL — e é só um ponto de partida.
  const ia = Array.isArray(b.ia) && b.ia.length === 4 && b.ia.every(v => isFinite(v))
    ? { x: b.ia[0], y: b.ia[1], w: b.ia[2], h: b.ia[3] } : b
  const cx = ia.x + ia.w / 2, cy = ia.y + ia.h / 2
  // Altura de uma linha, em pixels. Vem do que a IA leu, presa entre limites
  // sãos: ela às vezes devolve linha de 30% da folha, e essa medida alimenta
  // todas as folgas daqui para baixo.
  const ls = (b.ls || []).filter(l => typeof l.h === 'number' && isFinite(l.h))
  const alturas = ls.map(l => l.h).sort((a, c) => a - c)
  // ⚠️ TETO APERTADO, E PADRÃO BAIXO QUANDO NÃO HÁ LINHAS. Medido no teste:
  // sem linhas lidas, a estimativa saía de metade da caixa e dava 108 px onde
  // a linha impressa tem 25 — e essa medida alimenta a janela de busca, a
  // cola entre palavras e o descarte do vizinho. Uma linha de mangá não passa
  // de ~3,5% da folha nem no grito.
  // ⚠️ E NÃO PODE VIR SÓ DAS LINHAS SALVAS: elas já podem ser o resultado de
  // uma medição anterior que errou para menos. Medido no "OOGH...": a linha
  // salva tinha 0,3% da folha, a estimativa caiu para o piso de 0,8% e a
  // janela inteira nasceu apertada — o erro se realimentava a cada rodada.
  // A caixa original do modelo, dividida pelo número de linhas lidas, é o
  // contrapeso: grosseira, mas independente da medição anterior.
  const porIA = ia.h / Math.max(1, (b.ls || []).length || 1)
  let hL = alturas.length ? Math.max(alturas[alturas.length >> 1], porIA * 0.5) : porIA
  hL = Math.max(0.008, Math.min(0.035, hL)) * cv.height

  // A janela: em volta da fala, com folga de duas linhas para cada lado e
  // teto de 32% da folha — o balde nunca pode ter a página inteira.
  const mw = Math.min(0.32, Math.max(ia.w * 0.75 + 0.03, 0.07))
  const mh = Math.min(0.32, Math.max(ia.h * 0.75 + (2.2 * hL / cv.height), 0.05))
  const X = Math.max(0, Math.round((cx - mw) * cv.width))
  const Y = Math.max(0, Math.round((cy - mh) * cv.height))
  const W = Math.min(cv.width - X, Math.round(2 * mw * cv.width))
  const H = Math.min(cv.height - Y, Math.round(2 * mh * cv.height))
  if (W < 16 || H < 16) return null

  let dados
  try { dados = ctx.getImageData(X, Y, W, H).data } catch (e) { return null }
  const cinza = new Uint8Array(W * H)
  for (let p = 0, i = 0; p < cinza.length; p++, i += 4) {
    cinza[p] = (dados[i] + dados[i + 1] + dados[i + 2]) / 3
  }
  const corte = _mgOtsu(cinza)

  // ⚠️ QUEM DIZ SE O PAPEL É CLARO OU ESCURO É O PAPEL, NÃO UM PALPITE. Balão
  // preto com letra branca existe — é a página de resumo do volume. A conta é
  // simples: no retângulo da fala, o que houver EM MAIOR QUANTIDADE é o
  // fundo; o resto é letra.
  // ⚠️ A CONTA OLHA AS LINHAS, NÃO A CAIXA. A caixa do modelo às vezes é o
  // dobro do balão e pega arte escura ao redor — e aí um balão branco comum
  // seria julgado "de fundo preto", invertendo tudo. As linhas erram muito
  // menos, porque cercam as letras.
  let claros = 0, escuros = 0
  const cxs = ls.length ? ls.map(l => l.x + l.w / 2).sort((a, c) => a - c) : []
  const ancoraFr = cxs.length ? cxs[cxs.length >> 1] : cx
  const rx0 = Math.max(0, Math.round((ls.length ? Math.min(...ls.map(l => l.x)) : ia.x) * cv.width) - X)
  const rx1 = Math.min(W - 1, Math.round((ls.length ? Math.max(...ls.map(l => l.x + l.w)) : ia.x + ia.w) * cv.width) - X)
  const ry0 = Math.max(0, Math.round((ls.length ? Math.min(...ls.map(l => l.y)) : ia.y) * cv.height) - Y)
  const ry1 = Math.min(H - 1, Math.round((ls.length ? Math.max(...ls.map(l => l.y + l.h)) : ia.y + ia.h) * cv.height) - Y)
  for (let y = ry0; y <= ry1; y++) {
    for (let x = rx0; x <= rx1; x++) {
      if (cinza[y * W + x] > corte) claros++; else escuros++
    }
  }
  const claro = claros >= escuros
  const dentro = claro ? (v => v > corte) : (v => v < corte)

  // Sementes: o centro de cada linha lida e o centro do balão. Basta uma cair
  // no papel da fala. Fica a de maior área — é a que pegou o corpo do balão,
  // e não uma ilha branca entre duas letras.
  const pontos = []
  for (const l of ls) pontos.push([l.x + l.w / 2, l.y + l.h / 2])
  pontos.push([cx, cy], [cx - ia.w * 0.25, cy], [cx + ia.w * 0.25, cy])
  let masc = null, area = 0
  for (const pt of pontos) {
    const sx = (pt[0] * cv.width) - X, sy = (pt[1] * cv.height) - Y
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue
    const s = _mgAchaSemente(cinza, W, H, sx, sy, dentro)
    if (!s) continue
    if (masc && masc[s.y * W + s.x]) continue          // já coberto
    const r = _mgPreencher(cinza, W, H, s.x, s.y, dentro)
    if (!r) continue
    if (r.area > area) { masc = r.masc; area = r.area }
  }
  // Papel de menos: a fala não tem onde caber, e o que vier daqui seria ruído.
  if (!masc || area < hL * hL * 1.5) return null

  const buraco = _mgBuracos(masc, W, H)
  return { masc, buraco, cinza, dados, W, H, X, Y, claro, hL, cx, cy, corte, ancoraFr, ia }
}

// As linhas impressas, medidas nos buracos — que são o texto e nada além.
//
// ⚠️ DUAS PASSADAS, E A SEGUNDA É QUE ACERTA. Medir a altura das linhas exige
// saber QUAIS COLUNAS olhar; saber as colunas exige já ter as linhas. Na
// primeira passada a janela horizontal é larga e as linhas saem grosseiras —
// e num balão colado noutra fala o vale entre duas linhas vem preenchido pelo
// texto do vizinho, que cai na mesma altura. MEDIDO na página 28: um balão de
// quatro linhas impressas virou UMA faixa só, e a fala inteira foi para uma
// linha de 30% da folha. A segunda passada refaz o perfil já dentro da coluna
// da fala, e aí os vales aparecem.
function _mgLinhasDoBalao(det, b, cv) {
  const buraco = det.buraco, W = det.W, H = det.H, X = det.X, Y = det.Y, hL = det.hL
  const ia = det.ia
  const ancora = Math.round((det.ancoraFr || det.cx) * cv.width) - X

  // ⚠️ A JANELA VERTICAL COBRE A CAIXA DO MODELO INTEIRA, e não só as linhas
  // que ele separou. Ele frequentemente lê cinco linhas impressas como duas —
  // e mirando só nelas a busca cortava o balão pela metade: 5 linhas viravam
  // 2, com a caixa na altura errada. A caixa dele é grosseira, mas cobre a
  // fala toda, que é o que se precisa aqui.
  const ls = (b.ls || []).filter(l => typeof l.y === 'number' && isFinite(l.y))
  let topo = ia.y * cv.height, base = (ia.y + ia.h) * cv.height
  if (ls.length) {
    topo = Math.min(topo, Math.min(...ls.map(l => l.y)) * cv.height)
    base = Math.max(base, Math.max(...ls.map(l => l.y + l.h)) * cv.height)
  }
  // ⚠️ FOLGA DE TRÊS LINHAS, E NÃO DE UMA. A caixa de partida nem sempre é a
  // do modelo: no acervo já medido por uma versão anterior, ela pode estar
  // APERTADA no texto que aquela versão achou — e medido na página 28, um
  // balão de quatro linhas impressas tinha ficado com a caixa de UMA. Com
  // folga curta a busca nunca alcançaria as outras três. Folga generosa não
  // custa nada aqui, porque quem separa uma fala da vizinha é o vão entre
  // linhas (`_mgBlocoContinuo`), não o tamanho da janela.
  topo = topo - Y - hL * 3
  base = base - Y + hL * 3
  const y0 = Math.max(0, Math.floor(topo)), y1 = Math.min(H - 1, Math.ceil(base))
  if (y1 - y0 < 3) return []

  const jx0 = Math.max(0, Math.round(ia.x * cv.width) - X - Math.round(hL * 2))
  const jx1 = Math.min(W - 1, Math.round((ia.x + ia.w) * cv.width) - X + Math.round(hL * 2))
  if (jx1 - jx0 < 3) return []

  // --- as três etapas, cada uma usando o resultado da anterior ------------
  const faixasA = _mgFaixasEm(buraco, W, y0, y1, jx0, jx1)
  if (!faixasA.length) return []
  const larguraA = _mgLarguraDasFaixas(buraco, W, faixasA, jx0, jx1, ancora)
  if (!larguraA.length) return []

  // ⚠️ A COLUNA DA SEGUNDA PASSADA VEM DA CAIXA DO MODELO, NÃO DAS FAIXAS DA
  // PRIMEIRA. Elas já podem ter esticado até a fala vizinha — e foi o que
  // aconteceu, visto no pixel: na altura de "WE CAN'T"/"LAST ANY" havia o
  // "...BEHIND" do balão ao lado, a faixa da primeira passada engoliu os dois,
  // e a coluna tirada dela continuava larga demais para o vale entre as duas
  // linhas aparecer. Elas viravam UMA.
  //
  // A caixa do modelo é ruim para desenhar, mas boa para dizer "a fala está
  // nesta coluna" — e é só isso que se pede a ela aqui. As larguras finais
  // continuam saindo da janela larga, medidas no pixel.
  const ax0 = Math.min(...larguraA.map(f => f.x0)), ax1 = Math.max(...larguraA.map(f => f.x1))
  let cx0 = Math.max(jx0, Math.round(ia.x * cv.width) - X - Math.round(hL * 0.3))
  let cx1 = Math.min(jx1, Math.round((ia.x + ia.w) * cv.width) - X + Math.round(hL * 0.3))
  // Caixa do modelo estreita ou fora do lugar: volta o que a primeira passada
  // achou — melhor uma coluna larga que uma coluna vazia.
  if (cx1 - cx0 < hL * 2 || ancora < cx0 || ancora > cx1) {
    cx0 = Math.max(jx0, ax0 - 2); cx1 = Math.min(jx1, ax1 + 2)
  }
  const faixasB = _mgFaixasEm(buraco, W, y0, y1, cx0, cx1)
  const usar = faixasB.length >= faixasA.length ? faixasB : faixasA
  const finais = _mgLarguraDasFaixas(buraco, W, usar, jx0, jx1, ancora)
  const bloco = _mgTetoDeAltura(_mgBlocoContinuo(finais, ia, cv, Y), buraco, W, hL)
  return _mgPisoDeAltura(_mgSoTexto(bloco), hL, H)
}

// ⚠️ DESENHO DENTRO DO BALÃO TAMBÉM É "BURACO". Visto na tela (página 17): o
// balão do "I HEARD SANGORO'S VOICE..." tem um rostinho desenhado embaixo,
// cercado de branco como as letras — virou uma sexta linha, e o texto se
// espalhou para preenchê-la, com "MOUSE!!" boiando longe do resto.
//
// O que separa os dois é o CORPO: dentro de um mesmo balão o letrista usa uma
// letra só, então as linhas têm altura parecida. Faixa muito mais alta que a
// mediana das outras não é linha — é desenho. (A trava do fim evita jogar
// tudo fora num balão de duas linhas, onde "mediana" não quer dizer nada.)
function _mgSoTexto(faixas) {
  if (faixas.length < 3) return faixas
  const alt = faixas.map(f => f.y1 - f.y0 + 1).sort((a, b) => a - b)
  const med = alt[alt.length >> 1]
  const fica = faixas.filter(f => (f.y1 - f.y0 + 1) <= med * 1.9)
  return fica.length >= Math.ceil(faixas.length / 2) ? fica : faixas
}

// ⚠️ ARTE CERCADA DE BRANCO TAMBÉM É "BURACO" — é o limite do método, e ele
// aparece no grito solto sobre a página. Medido na página 19: o "AAAAH!!" é
// escrito sem balão, no meio de um impacto desenhado, e os respingos pretos
// em volta são tão cercados de papel quanto as letras. A faixa saiu com 189
// px onde a letra tem pouco mais de cem.
//
// O corte é pela DENSIDADE: dentro de uma faixa alta demais, a linha de texto
// é a parte onde a tinta se espalha por toda a largura; o respingo é ralo.
// Fica só o miolo denso, e o grito legítimo — que é sólido de ponta a ponta —
// sobrevive inteiro.
function _mgTetoDeAltura(faixas, buraco, W, hL) {
  const teto = hL * 2.6
  for (const f of faixas) {
    const alt = f.y1 - f.y0 + 1
    if (alt <= teto) continue
    const perfil = []
    let pico = 0
    for (let y = f.y0; y <= f.y1; y++) {
      let n = 0
      for (let x = f.x0; x <= f.x1; x++) if (buraco[y * W + x]) n++
      perfil.push(n)
      if (n > pico) pico = n
    }
    if (pico < 2) continue
    const corte = pico * 0.35
    let a = 0, z = perfil.length - 1
    while (a < z && perfil[a] < corte) a++
    while (z > a && perfil[z] < corte) z--
    if (z - a + 1 < Math.max(2, hL * 0.4)) continue
    f.y0 += a; f.y1 = f.y0 + (z - a)
  }
  return faixas
}

// ⚠️ RETICÊNCIAS SÃO LINHA, MAS MEDEM CINCO PIXELS. Medido: o balão "OOGH..."
// da página 13 terminou com 0,3% da altura da folha — porque a única faixa
// achada foi a dos três pontos, e a caixa do balão é a união das faixas. Um
// balão de 5 px de altura não tem alvo para o ponteiro e não tem espaço para
// letra nenhuma: some da tela sem avisar.
//
// O piso é meia linha, aberto em torno do CENTRO da faixa (para o texto não
// escorregar) e limitado pela metade do vão até a vizinha (para não invadir a
// linha de cima nem a de baixo).
function _mgPisoDeAltura(faixas, hL, H) {
  const piso = hL * 0.5
  for (let k = 0; k < faixas.length; k++) {
    const f = faixas[k]
    const alt = f.y1 - f.y0 + 1
    if (alt >= piso) continue
    let folga = (piso - alt) / 2
    if (k > 0) folga = Math.min(folga, (f.y0 - faixas[k - 1].y1) / 2)
    if (k < faixas.length - 1) folga = Math.min(folga, (faixas[k + 1].y0 - f.y1) / 2)
    if (folga < 1) continue
    f.y0 = Math.max(0, Math.round(f.y0 - folga))
    f.y1 = Math.min(H - 1, Math.round(f.y1 + folga))
  }
  return faixas
}

// Perfil por fileira dentro de uma janela: as linhas viram picos, os vãos
// viram vales. Só conta buraco — letra cercada de papel —, então moldura de
// quadro e arte não entram na conta.
function _mgFaixasEm(buraco, W, y0, y1, x0, x1) {
  const perfil = new Int32Array(y1 - y0 + 1)
  for (let y = y0; y <= y1; y++) {
    let n = 0
    const base = y * W
    for (let x = x0; x <= x1; x++) if (buraco[base + x]) n++
    perfil[y - y0] = n
  }
  let pico = 0
  for (let k = 0; k < perfil.length; k++) if (perfil[k] > pico) pico = perfil[k]
  if (pico < 2) return []
  const limite = Math.max(1, pico * 0.10)

  let faixas = []
  let ini = -1
  for (let k = 0; k < perfil.length; k++) {
    const tem = perfil[k] >= limite
    if (tem && ini < 0) ini = k
    if ((!tem || k === perfil.length - 1) && ini >= 0) {
      faixas.push([y0 + ini, y0 + (tem ? k : k - 1)])
      ini = -1
    }
  }
  if (!faixas.length) return []

  // Vão pequeno demais para ser entrelinha: é a mesma linha partida pelo pé
  // de uma letra. Junta. Depois, faixa fina demais é sujeira: descarta.
  const alt = faixas.map(f => f[1] - f[0] + 1).sort((a, c) => a - c)
  const tipica = alt[alt.length >> 1]
  const juntas = []
  for (const f of faixas) {
    const ant = juntas[juntas.length - 1]
    if (ant && (f[0] - ant[1]) <= Math.max(1, tipica * 0.28)) ant[1] = f[1]
    else juntas.push([f[0], f[1]])
  }
  return juntas.filter(f => (f[1] - f[0] + 1) >= Math.max(2, tipica * 0.35))
}

// ⚠️ A LARGURA SAI DO GRUPO DE COLUNAS QUE CONTÉM A FALA, e não de todas as
// colunas com tinta. No balão aberto, a MESMA faixa de altura pega o "HUFF"
// desenhado ao lado — e a linha saía atravessando o quadro. As colunas são
// agrupadas com o espaço entre palavras como cola e fica o grupo mais perto
// do centro da fala.
function _mgLarguraDasFaixas(buraco, W, faixas, x0, x1, ancora) {
  const saida = []
  for (const f of faixas) {
    const fy0 = f[0], fy1 = f[1]
    const altura = fy1 - fy0 + 1
    const minCol = Math.max(1, Math.round(altura * 0.05))
    const grupos = []
    let aberto = false, vazias = 0
    // A cola vem da PRÓPRIA faixa: a altura medida aqui é a da linha impressa
    // de verdade, e uma cola grande demais junta a fala do vizinho.
    const cola = Math.max(3, Math.round(altura * 1.1))
    for (let x = x0; x <= x1; x++) {
      let n = 0
      for (let y = fy0; y <= fy1; y++) if (buraco[y * W + x]) n++
      if (n >= minCol) {
        if (!aberto) { grupos.push([x, x]); aberto = true }
        else grupos[grupos.length - 1][1] = x
        vazias = 0
      } else if (aberto) {
        vazias++
        if (vazias > cola) aberto = false
      }
    }
    if (!grupos.length) continue
    let melhor = grupos[0], dist = Infinity
    for (const g of grupos) {
      const d = (ancora >= g[0] && ancora <= g[1]) ? 0 : Math.min(Math.abs(g[0] - ancora), Math.abs(g[1] - ancora))
      if (d < dist) { dist = d; melhor = g }
    }
    // Grupo longe demais do centro da fala: é a fala do vizinho.
    if (dist > altura * 6) continue
    saida.push({ y0: fy0, y1: fy1, x0: melhor[0], x1: melhor[1] })
  }
  return saida
}

// ⚠️ FALAS EMPILHADAS SÃO O CASO NORMAL, NÃO A EXCEÇÃO. Com a janela vertical
// cobrindo a caixa inteira do modelo, a projeção também encontra as linhas da
// fala de cima e da de baixo — e elas entrariam no mesmo balão, com o texto
// repartido entre todas. O que separa duas falas é o VÃO: dentro de um
// parágrafo o passo é regular; entre dois balões ele é muito maior.
//
// Fica o bloco de linhas seguidas que contém a altura do meio da caixa do
// modelo, cortando onde o vão passa de 1,9 vez o passo típico.
function _mgBlocoContinuo(faixas, ia, cv, Y) {
  if (faixas.length < 2) return faixas
  faixas.sort((a, b) => a.y0 - b.y0)
  const passos = []
  for (let k = 1; k < faixas.length; k++) passos.push(faixas[k].y0 - faixas[k - 1].y0)
  const ord = [...passos].sort((a, b) => a - b)
  const passo = ord[ord.length >> 1]
  if (!(passo > 0)) return faixas

  const meio = (ia.y + ia.h / 2) * cv.height - Y
  let sem = 0, dist = Infinity
  for (let k = 0; k < faixas.length; k++) {
    const c = (faixas[k].y0 + faixas[k].y1) / 2
    const d = Math.abs(c - meio)
    if (d < dist) { dist = d; sem = k }
  }
  let a = sem, z = sem
  while (a > 0 && (faixas[a].y0 - faixas[a - 1].y0) <= passo * 1.9) a--
  while (z < faixas.length - 1 && (faixas[z + 1].y0 - faixas[z].y0) <= passo * 1.9) z++
  return faixas.slice(a, z + 1)
}

// ⚠️ A CAIXA CRESCE ATÉ ENCOSTAR NA ARTE, E É ISSO QUE A TORNA INVISÍVEL. Ela
// só avança sobre fileira (ou coluna) inteira de papel; onde houver traço,
// para. Num balão com contorno ela encosta no traço e o fundo aceso preenche
// o miolo como se fosse o próprio balão; num balão sem contorno ela abre uma
// folga de papel em volta da fala e some no branco da página.
//
// A folga de 3% tolera o serrilhado da digitalização — sem ela, um único
// pixel cinza de anti-serrilhado trava o crescimento na primeira fileira.
// As caixas das OUTRAS falas da página, em coordenadas desta janela. É o que
// impede o fundo aceso de um grito grande cobrir a fala do vizinho.
function _mgVizinhos(b, todos, det, cv) {
  if (!Array.isArray(todos)) return []
  const fora = []
  for (const o of todos) {
    if (o === b || !o) continue
    const c = Array.isArray(o.ia) && o.ia.length === 4 && o.ia.every(v => isFinite(v))
      ? { x: o.ia[0], y: o.ia[1], w: o.ia[2], h: o.ia[3] } : o
    if (!isFinite(c.x) || !isFinite(c.y) || !isFinite(c.w) || !isFinite(c.h)) continue
    fora.push({
      x0: c.x * cv.width - det.X, x1: (c.x + c.w) * cv.width - det.X,
      y0: c.y * cv.height - det.Y, y1: (c.y + c.h) * cv.height - det.Y
    })
  }
  return fora
}

function _mgCrescerNoPapel(det, caixa, vizinhos) {
  const masc = det.masc, buraco = det.buraco, W = det.W, H = det.H, hL = det.hL
  const solido = p => masc[p] || buraco[p]
  const tetoV = Math.round(hL * 1.0), tetoH = Math.round(hL * 0.8)
  const limpo = (a, z, fixo, horizontal) => {
    let bons = 0, tot = 0
    for (let v = a; v <= z; v++) {
      const p = horizontal ? (fixo * W + v) : (v * W + fixo)
      tot++
      if (solido(p)) bons++
    }
    return tot > 0 && bons >= tot * 0.97
  }
  // ⚠️ PAPEL LIVRE NÃO É PAPEL DE NINGUÉM. Visto na tela (página 19): o grito
  // "AAAAH!!" é escrito solto sobre o branco, sem balão em volta — então nada
  // no PIXEL barrava o crescimento, e a caixa dele foi engolindo o branco até
  // cobrir o balão vizinho inteiro, texto e tudo. Quem sabe que ali existe
  // outra fala não é a imagem: é a lista de balões da página.
  const vz = Array.isArray(vizinhos) ? vizinhos : []
  const invade = (x0, y0, x1, y1) => vz.some(v => x0 <= v.x1 && x1 >= v.x0 && y0 <= v.y1 && y1 >= v.y0)
  let { x0, y0, x1, y1 } = caixa
  for (let k = 0; k < tetoV && y0 > 0; k++) { if (!limpo(x0, x1, y0 - 1, true) || invade(x0, y0 - 1, x1, y0 - 1)) break; y0-- }
  for (let k = 0; k < tetoV && y1 < H - 1; k++) { if (!limpo(x0, x1, y1 + 1, true) || invade(x0, y1 + 1, x1, y1 + 1)) break; y1++ }
  for (let k = 0; k < tetoH && x0 > 0; k++) { if (!limpo(y0, y1, x0 - 1, false) || invade(x0 - 1, y0, x0 - 1, y1)) break; x0-- }
  for (let k = 0; k < tetoH && x1 < W - 1; k++) { if (!limpo(y0, y1, x1 + 1, false) || invade(x1 + 1, y0, x1 + 1, y1)) break; x1++ }
  return { x0, y0, x1, y1 }
}

// ⚠️ QUEM MANDA NO NÚMERO DE LINHAS É O DESENHO, NÃO A LEITURA. A IA junta
// duas linhas impressas numa ("YOU KNOW HE'S NOT THE KIND") e separa
// pontuação como se fosse linha ("ROBIN" + "!!!"). Enquanto o número vinha
// dela, cada divergência dessas virava uma heurística nova.
//
// Aqui a página decide: as faixas medidas são as linhas. Quando a contagem
// bate, cada texto vai para a sua; quando não bate, o texto INTEIRO do balão
// é repartido pelas faixas em proporção à largura de cada uma — que é
// exatamente o critério do letrista ao quebrar a fala.
function _mgRepartir(texto, faixas) {
  const palavras = String(texto || '').split(/\s+/).filter(Boolean)
  const n = faixas.length
  if (!palavras.length) return faixas.map(() => '')
  if (n === 1) return [palavras.join(' ')]
  const larg = faixas.map(f => Math.max(1, f.x1 - f.x0 + 1))
  const soma = larg.reduce((s, v) => s + v, 0)
  const chars = palavras.reduce((s, p) => s + p.length + 1, 0) - 1
  const saida = []
  let k = 0, usado = 0, acumLarg = 0
  for (let i = 0; i < n; i++) {
    acumLarg += larg[i]
    const alvo = (i === n - 1) ? chars : Math.round(chars * acumLarg / soma)
    const bloco = []
    // Sobram tantas palavras quantas faixas ainda faltam: cada uma leva a sua.
    while (k < palavras.length && (palavras.length - k) > (n - 1 - i)) {
      const antes = usado + bloco.join(' ').length + (bloco.length ? 1 : 0)
      const depois = antes + (bloco.length ? 1 : 0) + palavras[k].length
      if (bloco.length && Math.abs(depois - alvo) > Math.abs(antes - alvo)) break
      bloco.push(palavras[k++])
    }
    const linha = bloco.join(' ')
    usado += linha.length + (usado ? 1 : 0)
    saida.push(linha)
  }
  if (k < palavras.length) saida[n - 1] = (saida[n - 1] + ' ' + palavras.slice(k).join(' ')).trim()
  return saida
}

// As duas cores da fala, tiradas da própria página: papel e tinta. Em mangá
// digitalizado o miolo é creme e a letra é cinza-escura; branco puro sobre
// creme aparece como remendo, que é justamente o que se quer evitar.
function _mgCoresDoBalao(det, caixa) {
  const { masc, buraco, dados, W } = det
  // ⚠️ A COR É A MAIS FREQUENTE, NÃO A MÉDIA — e a diferença aparece na tela.
  // O serrilhado em volta de cada letra é cinza, e ele entra na média puxando
  // o "branco" do balão para #f9f9f9. Como o fundo aceso é um retângulo, esse
  // meio tom vira uma mancha visível sobre o branco do balão: o remendo que
  // este trabalho inteiro existe para não deixar acontecer. MEDIDO na página
  // 14, lado a lado com o original. A cor mais frequente é o papel limpo.
  const hp = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  const ht = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  let pn = 0, tn = 0
  for (let y = caixa.y0; y <= caixa.y1; y++) {
    for (let x = caixa.x0; x <= caixa.x1; x++) {
      const p = y * W + x, i = p * 4
      if (masc[p]) { hp[0][dados[i]]++; hp[1][dados[i + 1]]++; hp[2][dados[i + 2]]++; pn++ }
      else if (buraco[p]) { ht[0][dados[i]]++; ht[1][dados[i + 1]]++; ht[2][dados[i + 2]]++; tn++ }
    }
  }
  const moda = h => { let m = 0, v = 0; for (let k = 0; k < 256; k++) if (h[k] > m) { m = h[k]; v = k } return v }
  const hex = (a, b, c) => '#' + [a, b, c].map(v => v.toString(16).padStart(2, '0')).join('')
  return {
    bg: pn ? hex(moda(hp[0]), moda(hp[1]), moda(hp[2])) : (det.claro ? '#ffffff' : '#111111'),
    fg: tn > 20 ? hex(moda(ht[0]), moda(ht[1]), moda(ht[2])) : (det.claro ? '#111111' : '#ffffff')
  }
}

function _mgEscreverBalao(b, det, faixas, cv, todos) {
  const X = det.X, Y = det.Y
  const fr = (v, total) => +(v / total).toFixed(4)
  const textosIA = (b.ls || []).map(l => l.t).filter(t => t && t.trim())
  // ⚠️ MAIS FAIXAS QUE PALAVRAS É RUÍDO, NÃO LINHA. Um respingo de tinta
  // cercado de papel também é "buraco", e vira faixa. Enquanto há texto para
  // repartir isso não incomoda; quando as faixas passam do número de palavras
  // da fala, as sobrando ficam VAZIAS e ainda assim esticam a caixa do balão.
  // Medido: "OOGH..." saiu com três faixas e a caixa do tamanho das três.
  // Ficam as mais cheias — respingo é estreito, linha é larga.
  const palavras = String(b.t || '').split(/\s+/).filter(Boolean).length
  const cabem = Math.max(1, textosIA.length, palavras)
  if (faixas.length > cabem) {
    const melhores = [...faixas].sort((a, c) => (c.x1 - c.x0) - (a.x1 - a.x0)).slice(0, cabem)
    faixas = faixas.filter(f => melhores.indexOf(f) >= 0)
  }
  const textos = (textosIA.length === faixas.length)
    ? textosIA
    : _mgRepartir(b.t || textosIA.join(' '), faixas)

  const novas = faixas.map((f, k) => ({
    t: textos[k] || '',
    x: fr(X + f.x0, cv.width),
    y: fr(Y + f.y0, cv.height),
    w: fr(f.x1 - f.x0 + 1, cv.width),
    h: fr(f.y1 - f.y0 + 1, cv.height)
  })).filter(l => l.t)
  if (!novas.length) return false

  const uniao = {
    x0: Math.min(...faixas.map(f => f.x0)), x1: Math.max(...faixas.map(f => f.x1)),
    y0: Math.min(...faixas.map(f => f.y0)), y1: Math.max(...faixas.map(f => f.y1))
  }
  const caixa = _mgCrescerNoPapel(det, uniao, _mgVizinhos(b, todos, det, cv))
  const cores = _mgCoresDoBalao(det, caixa)

  b.ls = novas
  b.x = fr(X + caixa.x0, cv.width)
  b.y = fr(Y + caixa.y0, cv.height)
  b.w = fr(caixa.x1 - caixa.x0 + 1, cv.width)
  b.h = fr(caixa.y1 - caixa.y0 + 1, cv.height)
  b.bg = cores.bg
  b.fg = cores.fg
  if (det.claro) delete b.inv; else b.inv = 1
  b.px = MG_PX_V
  delete b.fm
  return true
}

// O caminho novo primeiro; o antigo continua de reserva para o que a imagem
// não entrega (fala sobre arte escura, texto sem papel em volta).
function _mgMedirBalao(ctx, cv, b, todos) {
  // O palpite do modelo, guardado uma única vez. Daqui para a frente toda
  // medição parte DELE, e não do que a medição anterior deixou — é o que
  // impede o erro de se acumular a cada versão.
  if (!Array.isArray(b.ia)) b.ia = [b.x, b.y, b.w, b.h].map(v => +(+v).toFixed(4))
  try {
    const det = _mgDetectarBalao(ctx, cv, b)
    if (det) {
      const faixas = _mgLinhasDoBalao(det, b, cv)
      if (faixas.length && _mgEscreverBalao(b, det, faixas, cv, todos)) { _mgAlvoMinimo(b); return true }
    }
  } catch (e) {
    console.warn('[mangá] detecção do balão falhou:', e && e.message)
  }
  // ⚠️ O ALVO MÍNIMO VALE ATÉ QUANDO NADA DEU CERTO. Medido: o item "Poker" da
  // página de resumo tem caixa de 0,09% da folha — veio assim do modelo, e
  // como nenhum dos dois caminhos consegue medi-lo, ele continuaria invisível
  // ao ponteiro para sempre. Uma caixa pequena e aproximada ainda é
  // alcançável; caixa nenhuma não é.
  _mgAlvoMinimo(b)
  if (!b.ls || !b.ls.length) return false
  const ok = _mgAfinarBalao(ctx, cv, b)
  // Carimbo de versão mesmo no caminho antigo: sem ele a página seria
  // remedida a cada abertura, sem ganho nenhum.
  if (ok) { b.px = MG_PX_V; delete b.fm; _mgAlvoMinimo(b) }
  return ok
}

// ⚠️ A REDE FINAL, E ELA É CONTRA UM DEFEITO ANTIGO E MUDO. Caixa de três
// pixels não é alvo: o ponteiro não alcança, o balão nunca acende e não há
// erro nenhum no console — foi assim que 31 balões sumiram numa rodada
// anterior. O caminho de reserva ainda produz isso quando a única faixa que
// ele acha são as reticências ("OOGH..." mede 0,3% da folha).
//
// O mínimo é o mesmo que a entrada já exige de qualquer balão: 1,2% de
// largura, 1% de altura. Cresce pelo centro, para o texto não escorregar.
function _mgAlvoMinimo(b) {
  const min = (v, m) => Math.max(v, m)
  if (b.w < 0.012) { const c = b.x + b.w / 2; b.w = 0.012; b.x = +Math.max(0, Math.min(1 - b.w, c - b.w / 2)).toFixed(4) }
  if (b.h < 0.010) { const c = b.y + b.h / 2; b.h = 0.010; b.y = +Math.max(0, Math.min(1 - b.h, c - b.h / 2)).toFixed(4) }
}
