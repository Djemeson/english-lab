// ================================================================
// SINCRONIA — o texto do autor e a voz do narrador, no mesmo instante
// ================================================================
// ⚠️ O PEDIDO NASCEU DE UMA FALTA REAL: *"a transcrição é excelente, mas ela
// não pega as nuances de um livro, a escrita de um autor"*. E ele tinha razão
// com prova na tela: no áudio de *A Game of Thrones* o Whisper escreveu
// **"Garrod"** e **"Sir Waymar"**; o Martin escreveu **"Gared"** e **"Ser
// Waymar"** — e o "Ser" é escolha do autor, não erro. Ler pela transcrição é
// ler um livro que ninguém escreveu.
//
// A SAÍDA NÃO É TRANSCREVER MELHOR, É CASAR. O EPUB tem o texto exato; a
// transcrição tem o RELÓGIO (cada fala com início e fim). Casar os dois dá o
// texto do autor com o instante do narrador — que é o que o EPUB 3 chamaria de
// "Media Overlay" e que nenhuma editora entrega.
//
// ⚠️ POR QUE NÃO O CAMINHO OFICIAL: o padrão existe (Media Overlays, SMIL),
// mas conferido nos 10 EPUBs dele em 2026-08-22: **nenhum** traz `.smil` nem
// áudio embutido. Editora comercial não publica assim; publica no formato
// fechado da Amazon.
//
// COMO FUNCIONA, EM TRÊS PASSOS
//   1. Casar CAPÍTULO: a transcrição de um capítulo do áudio é comparada com
//      todos os capítulos do livro por trigramas de palavras. Medido com o
//      acervo real: o Prologue do áudio casou com o PROLOGUE do EPUB a
//      **88,7% contra 2,5%** do segundo colocado.
//   2. Casar PALAVRA: 5-gramas que aparecem uma única vez dos dois lados viram
//      âncoras. No mesmo capítulo real: **3.168 âncoras**, todas em ordem, uma
//      a cada 1,2 palavras, em 37 ms.
//   3. Entre duas âncoras, interpola. É o que dá instante a QUALQUER ponto do
//      texto, inclusive palavra que a transcrição errou.
//
// ⚠️ NADA DISTO USA IA. É contagem e comparação de texto — de graça, no
// aparelho, em milissegundos. A IA já foi paga uma vez, na transcrição.
// ================================================================

const SINC_K = 5              // tamanho do n-grama que vira âncora
const SINC_PASSO = 8          // guarda uma âncora a cada N palavras (o resto interpola)

// ---------------------------------------------------------------
// NORMALIZAR — o denominador comum entre o livro e a transcrição
// ---------------------------------------------------------------
// ⚠️ TUDO O QUE DISTINGUE OS DOIS TEXTOS TEM DE MORRER AQUI. O livro traz
// aspas tipográficas, travessões, itálico e maiúscula de nome próprio; a
// transcrição traz pontuação inventada e nenhuma formatação. O que sobra —
// letras e números, em minúscula — é o que os dois têm em comum.
function sincNorm(s) {
  // O `NFD` separa o acento da letra e o filtro seguinte, que só deixa passar
  // `a-z0-9`, leva o acento embora — não é preciso uma faixa Unicode à parte.
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function _sincTrigramas(palavras) {
  const s = new Set()
  for (let i = 0; i + 2 < palavras.length; i++) s.add(palavras[i] + ' ' + palavras[i + 1] + ' ' + palavras[i + 2])
  return s
}

// ---------------------------------------------------------------
// PASSO 1 — em qual capítulo do livro está esta transcrição?
// ---------------------------------------------------------------
// ⚠️ NÃO DÁ PARA CASAR PELO TÍTULO, e o acervo dele mostra por quê: o áudio
// tem "Prologue", "Bran I", "Catelyn I"; o EPUB tem 105 seções, várias sem
// título legível ("Parte 1", "Title Page"), e o livro repete "JON" nove vezes.
// Quem identifica um capítulo é o TEXTO dele.
// A nota é a fração dos trigramas da transcrição que aparecem no capítulo —
// e o campeão ganha por uma distância que não deixa dúvida.
function sincCasarCapitulo(textoTranscrito, capitulosTexto) {
  const T = _sincTrigramas(sincNorm(textoTranscrito))
  if (!T.size) return null
  const notas = capitulosTexto.map((texto, i) => {
    const B = _sincTrigramas(sincNorm(texto))
    let n = 0
    for (const g of T) if (B.has(g)) n++
    return { i, nota: n / T.size }
  }).sort((a, b) => b.nota - a.nota)
  const campeao = notas[0], segundo = notas[1] || { nota: 0 }
  // ⚠️ DOIS CORTES, E OS DOIS SÃO NECESSÁRIOS. A nota alta sozinha não basta
  // (um capítulo enorme pode conter muita coisa); a distância sozinha também
  // não (dois capítulos ruins podem estar longe um do outro). Os números vêm
  // do caso real: 88,7% com 86 pontos de distância.
  if (campeao.nota < 0.25) return null
  if (campeao.nota - segundo.nota < 0.10) return null
  return { cap: campeao.i, nota: campeao.nota, margem: campeao.nota - segundo.nota }
}

// ---------------------------------------------------------------
// PASSO 2 e 3 — âncoras e interpolação
// ---------------------------------------------------------------
// Cada palavra da transcrição ganha um instante: o começo da fala mais a
// fração dela. É aproximação dentro de ~3 segundos de fala, e o erro que ela
// introduz é menor que o de qualquer coisa que se possa medir na tela.
function _sincPalavrasComTempo(segs) {
  const out = []
  for (const s of (segs || [])) {
    const ws = sincNorm(s.t)
    const ini = Number(s.i) || 0, fim = Number(s.f) || ini
    ws.forEach((w, k) => out.push({ w, t: ini + (fim - ini) * (k / Math.max(1, ws.length)) }))
  }
  return out
}

function _sincIndice(palavras) {
  const M = new Map()
  for (let i = 0; i + SINC_K <= palavras.length; i++) {
    const g = palavras.slice(i, i + SINC_K).join(' ')
    M.set(g, M.has(g) ? -1 : i)         // -1 marca "aparece mais de uma vez"
  }
  return M
}

// Devolve `{ ancoras: [[posNoLivro, segundos], …], palavrasLivro, cobertura }`
// ou `null` quando o casamento não se sustenta.
// ⚠️ AS ÂNCORAS TÊM DE SER CRESCENTES DOS DOIS LADOS. Um 5-grama pode casar
// fora de ordem (frase repetida em outro ponto do capítulo), e uma âncora
// invertida arrastaria o texto para trás. Quem quebra a ordem é descartado.
function sincAlinhar(textoLivro, segs) {
  const lw = sincNorm(textoLivro)
  const tw = _sincPalavrasComTempo(segs)
  if (lw.length < 50 || tw.length < 50) return null

  const A = _sincIndice(lw), B = _sincIndice(tw.map(x => x.w))
  const brutas = []
  for (const [g, i] of A) {
    if (i < 0) continue
    const j = B.get(g)
    if (j !== undefined && j >= 0) brutas.push([i, j])
  }
  if (brutas.length < 10) return null
  brutas.sort((a, b) => a[0] - b[0])

  const mono = []
  let ultimo = -1
  for (const [i, j] of brutas) if (j > ultimo) { mono.push([i, j]); ultimo = j }
  // Cobertura baixa é sinal de casamento errado — melhor não sincronizar do
  // que sincronizar torto: texto acompanhando a voz errada é pior que texto
  // parado.
  const cobertura = mono.length / Math.max(1, lw.length)
  if (cobertura < 0.15) return null

  // ⚠️ GUARDAR AS 3.168 ÂNCORAS SERIA GUARDAR O QUE A INTERPOLAÇÃO REFAZ. Uma
  // a cada 8 palavras mantém o erro dentro de meio segundo e derruba o tamanho
  // do mapa em 8× — e ele viaja para a nuvem, onde cada documento tem teto.
  const ancoras = []
  let proxima = -1
  for (const [i, j] of mono) {
    if (i < proxima) continue
    ancoras.push([i, Math.round(tw[Math.min(tw.length - 1, j)].t * 100) / 100])
    proxima = i + SINC_PASSO
  }
  // O fim do capítulo é âncora obrigatória: sem ele, a última página não teria
  // para onde interpolar.
  const ultimaMono = mono[mono.length - 1]
  const tFim = tw[Math.min(tw.length - 1, ultimaMono[1])].t
  if (!ancoras.length || ancoras[ancoras.length - 1][0] < ultimaMono[0]) {
    ancoras.push([ultimaMono[0], Math.round(tFim * 100) / 100])
  }
  return { ancoras, palavrasLivro: lw.length, palavrasAudio: tw.length, cobertura, casadas: mono.length }
}

// ---------------------------------------------------------------
// CONSULTA — as duas perguntas que a tela faz
// ---------------------------------------------------------------
// "Estou nesta palavra do livro; em que segundo o narrador está?"
function sincTempoDe(mapa, pos) {
  const A = (mapa && mapa.ancoras) || []
  if (!A.length) return null
  if (pos <= A[0][0]) return A[0][1]
  if (pos >= A[A.length - 1][0]) return A[A.length - 1][1]
  // Busca binária: o mapa tem centenas de âncoras e a tela pergunta a cada
  // quadro de áudio — varredura linear aqui apareceria como travada.
  let lo = 0, hi = A.length - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (A[m][0] <= pos) lo = m; else hi = m
  }
  const [p0, t0] = A[lo], [p1, t1] = A[hi]
  return t0 + (t1 - t0) * ((pos - p0) / Math.max(1, p1 - p0))
}

// "O narrador está neste segundo; que palavra do livro é essa?"
function sincPosicaoDe(mapa, seg) {
  const A = (mapa && mapa.ancoras) || []
  if (!A.length) return null
  if (seg <= A[0][1]) return A[0][0]
  if (seg >= A[A.length - 1][1]) return A[A.length - 1][0]
  let lo = 0, hi = A.length - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (A[m][1] <= seg) lo = m; else hi = m
  }
  const [p0, t0] = A[lo], [p1, t1] = A[hi]
  return Math.round(p0 + (p1 - p0) * ((seg - t0) / Math.max(0.001, t1 - t0)))
}

// ---------------------------------------------------------------
// ONDE O MAPA MORA
// ---------------------------------------------------------------
// Mesmo caminho do raio-X e do pré-estudo (§8.71): guardado no aparelho E na
// nuvem, sob demanda. Alinhar de novo é barato, mas transcrever não é — e o
// mapa é o que transforma a transcrição paga em leitura sincronizada nos dois
// aparelhos.
function sincChave(livroId, capLivro) { return `sinc:${livroId}:${capLivro}` }

async function sincMapaLer(livroId, capLivro) {
  try {
    const bruto = typeof geradoLer === 'function'
      ? await geradoLer(sincChave(livroId, capLivro))
      : await BookDB.get(sincChave(livroId, capLivro))
    if (!bruto) return null
    return typeof bruto === 'string' ? JSON.parse(bruto) : bruto
  } catch (e) { return null }
}

async function sincMapaGuardar(livroId, capLivro, mapa) {
  const texto = JSON.stringify(mapa)
  try {
    if (typeof geradoGuardar === 'function') {
      await geradoGuardar(sincChave(livroId, capLivro), texto, { tipo: 'sinc', livroId, cap: capLivro, n: (mapa.ancoras || []).length })
    } else {
      await BookDB.set(sincChave(livroId, capLivro), texto)
    }
  } catch (e) { console.warn('[sinc] não consegui guardar o mapa:', e && e.message) }
}

// ---------------------------------------------------------------
// O PAR — qual audiolivro é este livro
// ---------------------------------------------------------------
// ⚠️ O TÍTULO SOZINHO NÃO FECHA, e o acervo dele mostra: o EPUB chama-se
// "A Game of Thrones Enhanced Edition" e o áudio, "A Game of Thrones  A Song
// of Ice and Fire, Book 1". Sobra o miolo do nome, e é por ele que se procura
// — mas quem confirma é ELE, no clique. Casar errado aqui gastaria transcrição
// no livro errado.
function sincTituloChave(t) {
  return sincNorm(String(t || '')
    .replace(/\b(unabridged|abridged|enhanced|edition|a novel|audiobook|book \d+|vol\.? ?\d+)\b/gi, ' ')
    .replace(/[\(\[][^\)\]]*[\)\]]/g, ' ')).join(' ')
}

function sincParecidos(alvo, lista, chaveTitulo) {
  const A = new Set(sincTituloChave(alvo).split(' ').filter(w => w.length > 2))
  if (!A.size) return []
  return lista.map(x => {
    const B = new Set(sincTituloChave(chaveTitulo(x)).split(' ').filter(w => w.length > 2))
    let n = 0
    for (const w of A) if (B.has(w)) n++
    return { item: x, nota: n / A.size }
  }).filter(x => x.nota >= 0.5).sort((a, b) => b.nota - a.nota)
}

// O par guardado, dos dois lados. Guardar em ambos evita o caso torto de o
// livro apontar para um áudio que já não aponta de volta.
function sincLigar(livro, audio) {
  if (!livro || !audio) return
  livro.audioId = audio.id
  livro.updatedAt = Date.now()
  audio.livroId = livro.id
  audio.updatedAt = Date.now()
  saveLivros(); saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}

function sincDesligar(livro, audio) {
  if (livro) { delete livro.audioId; livro.updatedAt = Date.now() }
  if (audio) { delete audio.livroId; delete audio.capMapa; audio.updatedAt = Date.now() }
  saveLivros(); saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}

function sincAudioDoLivro(livro) {
  if (!livro || !livro.audioId) return null
  return (typeof audiolivros !== 'undefined' ? audiolivros : []).find(a => a.id === livro.audioId) || null
}
function sincLivroDoAudio(audio) {
  if (!audio || !audio.livroId) return null
  return (typeof livros !== 'undefined' ? livros : []).find(l => l.id === audio.livroId) || null
}

// ---------------------------------------------------------------
// O TEXTO DOS CAPÍTULOS DO LIVRO, uma vez por sessão
// ---------------------------------------------------------------
// Abrir o EPUB e extrair 105 capítulos custa segundos; fazer isso a cada
// pergunta seria inviável. O cache vive na memória — cai sozinho ao recarregar.
let _sincTextoCache = { id: null, caps: null }
async function sincTextosDoLivro(livro) {
  if (_sincTextoCache.id === livro.id && _sincTextoCache.caps) return _sincTextoCache.caps
  const blob = await BookDB.get(livro.id)
  if (!blob) throw new Error('o arquivo deste livro não está neste aparelho')
  const ep = await epubAbrir(await blob.arrayBuffer())
  const caps = []
  for (const c of ep.capitulos) {
    const html = await ep.zip.texto(c.href)
    caps.push(epubTextoLimpo(html || ''))
  }
  _sincTextoCache = { id: livro.id, caps }
  return caps
}

// ---------------------------------------------------------------
// A OPERAÇÃO COMPLETA — de uma transcrição a um mapa guardado
// ---------------------------------------------------------------
// Devolve `{ capLivro, nota, ancoras }` ou lança com motivo em português.
async function sincProcessarCapitulo(livro, audio, capAudio) {
  const tr = (audio.transcricoes || []).find(x => x.cap === capAudio)
  if (!tr || !(tr.segs || []).length) throw new Error('este capítulo ainda não foi transcrito')
  const caps = await sincTextosDoLivro(livro)
  const textoTr = tr.segs.map(s => s.t).join(' ')

  // Se o capítulo já foi casado antes, confia no que ficou — o casamento é a
  // parte cara (varre o livro inteiro) e não muda.
  const jaCasado = (audio.capMapa || {})[capAudio]
  let escolha = jaCasado != null ? { cap: jaCasado, nota: 1, margem: 1 } : sincCasarCapitulo(textoTr, caps)
  if (!escolha) throw new Error('não achei este capítulo dentro do livro — o texto não bate')

  const mapa = sincAlinhar(caps[escolha.cap], tr.segs)
  if (!mapa) throw new Error('achei o capítulo, mas o texto e o áudio não alinharam')

  mapa.capAudio = capAudio
  mapa.capLivro = escolha.cap
  mapa.nota = Math.round(escolha.nota * 1000) / 1000
  mapa.em = Date.now()
  await sincMapaGuardar(livro.id, escolha.cap, mapa)

  audio.capMapa = { ...(audio.capMapa || {}), [capAudio]: escolha.cap }
  audio.updatedAt = Date.now()
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  return mapa
}

// Qual capítulo do ÁUDIO corresponde a este capítulo do LIVRO (o caminho
// inverso do `capMapa`, que é guardado na direção que a transcrição produz).
function sincCapAudioDoLivro(audio, capLivro) {
  const m = (audio && audio.capMapa) || {}
  for (const k of Object.keys(m)) if (Number(m[k]) === Number(capLivro)) return Number(k)
  return null
}

// ⚠️ Quando o capítulo do livro ainda não foi casado, o palpite honesto é a
// ORDEM: o audiolivro segue o livro. Comparar quantos capítulos "de verdade"
// (com texto) vieram antes resolve o descompasso entre as 105 seções do EPUB
// (capa, mapas, sumário, apêndice) e os 75 capítulos do áudio.
function sincPalpiteCapAudio(livro, audio, capLivro, textos) {
  const jaCasado = sincCapAudioDoLivro(audio, capLivro)
  if (jaCasado != null) return jaCasado
  const MIN = 400                                   // palavras: abaixo disso não é capítulo
  const comTexto = []
  ;(textos || []).forEach((t, i) => { if (sincNorm(t).length >= MIN) comTexto.push(i) })
  const pos = comTexto.indexOf(capLivro)
  if (pos < 0) return null
  const caps = (audio.capitulos || [])
  // O áudio costuma abrir com créditos; se houver, ele desloca tudo em um.
  const desloc = caps.length && /credit|opening|introduc/i.test(caps[0].titulo || '') ? 1 : 0
  const alvo = pos + desloc
  return alvo < caps.length ? alvo : null
}

// ================================================================
// LER OUVINDO — o texto do autor com a frase acesa
// ================================================================
// ⚠️ O DESTAQUE NÃO PODE TOCAR NO HTML DO LIVRO. O leitor pagina o capítulo em
// colunas medidas, e o raio-X já injeta marcação dentro do texto — envolver a
// frase atual num `<span>` a cada três segundos remexeria o layout e brigaria
// com o realce que já está lá. A API de realce do navegador (`CSS.highlights`)
// pinta um trecho SEM alterar o DOM: é ela que faz isto ser possível sem
// reescrever o leitor.
let _sincOn = false
let _sincMapa = null
let _sincFrases = null          // [{ini, fim, pos, range}]
let _sincAtual = -1
let _sincAudioEl = null
let _sincCapLivro = -1
let _sincSeguir = true

function sincAtivo() { return _sincOn }
function sincTemRealce() { return typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function' }

// ---------------------------------------------------------------
// As frases da TELA, com a posição que o mapa entende
// ---------------------------------------------------------------
// ⚠️ A POSIÇÃO TEM DE SER CONTADA DO MESMO JEITO DOS DOIS LADOS. O mapa foi
// feito sobre `epubTextoLimpo(html)` — texto puro, espaços colapsados. Aqui a
// contagem sai do DOM já montado. Se as duas contagens divergirem, o destaque
// anda para frente ou para trás o capítulo inteiro; por isso a normalização é
// exatamente a mesma função (`sincNorm`), e nada mais.
function sincIndexarFrases() {
  const cont = document.getElementById('ler-conteudo')
  if (!cont) return null
  const walker = document.createTreeWalker(cont, NodeFilter.SHOW_TEXT, {
    acceptNode: n => {
      const p = n.parentElement
      if (!p) return NodeFilter.FILTER_REJECT
      // Nada que o app tenha acrescentado entra na conta: balão de mangá,
      // número de nota, controle. Só o texto do livro.
      if (p.closest('.mg-balao, .ler-nota-num, .sinc-ui')) return NodeFilter.FILTER_REJECT
      return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    }
  })
  const pedacos = []
  let texto = '', no
  while ((no = walker.nextNode())) {
    const t = no.nodeValue
    pedacos.push({ no, ini: texto.length, len: t.length })
    texto += t
  }
  if (!texto.trim()) return null

  // Onde cada frase começa e termina, no texto corrido
  const cortes = []
  const re = /[.!?…”"']+[\s]+|\n{2,}/g
  let m, ultimo = 0
  while ((m = re.exec(texto))) {
    const fim = m.index + m[0].length
    if (fim - ultimo > 3) { cortes.push([ultimo, fim]); ultimo = fim }
  }
  if (ultimo < texto.length) cortes.push([ultimo, texto.length])

  const localizar = off => {
    for (const p of pedacos) if (off < p.ini + p.len) return { no: p.no, off: Math.max(0, off - p.ini) }
    const u = pedacos[pedacos.length - 1]
    return { no: u.no, off: u.len }
  }

  const frases = []
  let pos = 0
  for (const [a, b] of cortes) {
    const trecho = texto.slice(a, b)
    const n = sincNorm(trecho).length
    if (n) {
      const A = localizar(a), B = localizar(b - 1)
      const r = document.createRange()
      try {
        r.setStart(A.no, Math.min(A.off, A.no.nodeValue.length))
        r.setEnd(B.no, Math.min(B.off + 1, B.no.nodeValue.length))
        frases.push({ pos, palavras: n, range: r, texto: trecho.trim() })
      } catch (e) {}
    }
    pos += n
  }
  return frases.length ? frases : null
}

function _sincLimparRealce() {
  try { if (sincTemRealce()) CSS.highlights.delete('sinc-atual') } catch (e) {}
}

function _sincPintarFrase(ix) {
  if (ix === _sincAtual || !_sincFrases || !_sincFrases[ix]) return
  _sincAtual = ix
  const f = _sincFrases[ix]
  if (sincTemRealce()) {
    try { CSS.highlights.set('sinc-atual', new Highlight(f.range)) } catch (e) {}
  }
  // A barra mostra a frase que está tocando — quem pula sem olhar a página
  // precisa ver onde caiu.
  const alvo = document.querySelector('.sinc-frase')
  if (alvo) alvo.textContent = f.texto.slice(0, 70)
  if (!_sincSeguir) return
  // ⚠️ SEGUIR A VOZ É VIRAR A PÁGINA, não rolar. O leitor deste app é
  // paginado por colunas; um `scrollIntoView` puxaria a viewport para um lugar
  // que a paginação não reconhece e a página seguinte nasceria torta.
  try {
    const rect = f.range.getBoundingClientRect()
    const vp = document.getElementById('ler-viewport')
    if (!rect || !vp || (!rect.width && !rect.height)) return
    const cx = vp.getBoundingClientRect()
    if (rect.top >= cx.top - 4 && rect.bottom <= cx.bottom + 4 && rect.left >= cx.left - 4 && rect.right <= cx.right + 4) return
    if (typeof _lerIrParaFrac === 'function' && typeof lerAvancarPagina === 'function') {
      // Fora da página visível: avança até a frase aparecer (no máximo 3
      // páginas, para nunca entrar em laço com um texto que não cabe).
      for (let k = 0; k < 3; k++) {
        lerAvancarPagina()
        const r2 = f.range.getBoundingClientRect()
        const c2 = vp.getBoundingClientRect()
        if (r2.top >= c2.top - 4 && r2.bottom <= c2.bottom + 4) break
      }
    }
  } catch (e) {}
}

// Qual frase está tocando neste instante
function _sincFraseDoTempo(t) {
  if (!_sincFrases || !_sincMapa) return -1
  const pos = sincPosicaoDe(_sincMapa, t)
  if (pos == null) return -1
  let lo = 0, hi = _sincFrases.length - 1, r = 0
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (_sincFrases[m].pos <= pos) { r = m; lo = m + 1 } else hi = m - 1
  }
  return r
}

// ---------------------------------------------------------------
// O ÁUDIO DO MODO — separado do reprodutor de propósito
// ---------------------------------------------------------------
// ⚠️ REUSAR O PLAYER DA SEÇÃO AUDIOBOOK SERIA AMARRAR DUAS TELAS. Ele tem
// estado próprio (capítulo aberto, marcadores, timer de sono, Media Session) e
// mexer nele daqui deixaria as duas telas discordando sobre o que está
// tocando. Aqui é um `<audio>` só, com uma responsabilidade: tocar do
// instante X ao instante Y. O que os dois compartilham é o ARQUIVO.
function _sincAudio() {
  if (_sincAudioEl) return _sincAudioEl
  const el = document.createElement('audio')
  el.id = 'sinc-audio'
  el.preload = 'metadata'
  document.body.appendChild(el)
  el.addEventListener('timeupdate', () => {
    if (!_sincOn) return
    const ix = _sincFraseDoTempo(el.currentTime)
    if (ix >= 0) _sincPintarFrase(ix)
    _sincPintarBarra()
    // Fim do capítulo: para em vez de invadir o próximo, que ainda não tem
    // mapa e faria o texto e a voz falarem de coisas diferentes.
    if (_sincMapa && _sincMapa.fimAudio && el.currentTime >= _sincMapa.fimAudio) {
      el.pause(); _sincPintarBarra()
    }
  })
  el.addEventListener('play', _sincPintarBarra)
  el.addEventListener('pause', _sincPintarBarra)
  _sincAudioEl = el
  return el
}

async function _sincCarregarAudio(audio, capAudio) {
  const el = _sincAudio()
  const cap = (audio.capitulos || [])[capAudio]
  if (!cap) throw new Error('capítulo do áudio não encontrado')
  if (typeof abGarantirArquivo !== 'function' && typeof _loadScript === 'function') {
    await _loadScript('js/audiobook.js')
  }
  if (typeof abGarantirArquivo !== 'function') throw new Error('não consegui carregar o reprodutor')
  const chave = `${audio.id}:${cap.arq || 0}`
  if (el.dataset.chave !== chave) {
    const blob = await abGarantirArquivo(audio, cap.arq || 0, null)
    if (!blob) throw new Error('o áudio deste livro não está aqui nem na sua nuvem')
    if (el.src && el.src.startsWith('blob:')) URL.revokeObjectURL(el.src)
    el.src = URL.createObjectURL(blob)
    el.dataset.chave = chave
  }
  return { el, cap }
}

// ---------------------------------------------------------------
// LIGAR E DESLIGAR O MODO
// ---------------------------------------------------------------
async function sincLeitorAlternar() {
  if (_sincOn) return sincLeitorSair()
  if (!_lerLivro) return
  const audio = sincAudioDoLivro(_lerLivro)
  if (!audio) return sincLigarModal()
  try {
    _sincBarraMsg('Procurando este capítulo no audiolivro…')
    const pronto = await sincPrepararCapitulo(_lerLivro, audio, _lerCap)
    if (!pronto) return
    _sincOn = true
    _sincCapLivro = _lerCap
    _sincFrases = sincIndexarFrases()
    if (!_sincFrases) { _sincOn = false; toast('Não consegui ler as frases desta página.', 'error'); return }
    document.getElementById('ler-conteudo')?.addEventListener('click', sincCliqueNoTexto)
    document.getElementById('ler-btn-ouvir')?.classList.add('on')
    _sincPintarBarra()
    const { el } = await _sincCarregarAudio(audio, _sincMapa.capAudio)
    // Começa de onde ele está LENDO — é isso que "ouvir daqui" quer dizer.
    const pos = _sincPosicaoVisivel()
    const t = sincTempoDe(_sincMapa, pos)
    if (t != null) el.currentTime = t
    await el.play().catch(() => {})
    _sincPintarBarra()
  } catch (e) {
    _sincOn = false
    _sincBarraFechar()
    toast(String(e.message || e), 'error')
  }
}

function sincLeitorSair() {
  _sincOn = false
  if (_sincAudioEl) _sincAudioEl.pause()
  _sincLimparRealce()
  _sincFrases = null; _sincAtual = -1
  _sincBarraFechar()
  document.getElementById('ler-conteudo')?.removeEventListener('click', sincCliqueNoTexto)
  document.getElementById('ler-btn-ouvir')?.classList.remove('on')
}

// A posição de palavra do que está visível na tela agora — é o ponto de
// partida do áudio quando ele manda tocar.
function _sincPosicaoVisivel() {
  if (!_sincFrases) return 0
  const vp = document.getElementById('ler-viewport')
  if (!vp) return 0
  const cx = vp.getBoundingClientRect()
  for (const f of _sincFrases) {
    try {
      const r = f.range.getBoundingClientRect()
      if (!r.width && !r.height) continue
      if (r.bottom >= cx.top && r.top <= cx.bottom && r.right >= cx.left && r.left <= cx.right) return f.pos
    } catch (e) {}
  }
  return 0
}

// Garante mapa para o capítulo do livro: lê o guardado, e se não houver,
// alinha — pedindo a transcrição quando ela faltar.
async function sincPrepararCapitulo(livro, audio, capLivro) {
  const guardado = await sincMapaLer(livro.id, capLivro)
  if (guardado && (guardado.ancoras || []).length) {
    _sincMapa = guardado
    _sincMapa.fimAudio = _sincFimDoCap(audio, guardado.capAudio)
    return true
  }
  const textos = await sincTextosDoLivro(livro)
  const capAudio = sincPalpiteCapAudio(livro, audio, capLivro, textos)
  if (capAudio == null) { toast('Não consegui adivinhar qual capítulo do áudio é este.', 'warning'); return false }
  const temTr = (audio.transcricoes || []).some(x => x.cap === capAudio)
  if (!temTr) {
    const nome = ((audio.capitulos || [])[capAudio] || {}).titulo || `capítulo ${capAudio + 1}`
    const ok = await confirmModal({
      title: 'Falta a transcrição deste capítulo', icon: 'sparkles', confirmText: 'Transcrever agora',
      html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
        Para casar o texto com a voz, preciso do que o narrador diz em <b>${esc(nome)}</b>.
        Transcrevo agora — leva alguns minutos e é pago uma vez só; depois vale nos seus dois aparelhos.</p>`
    })
    if (!ok) return false
    _sincBarraMsg('Transcrevendo o capítulo…')
    if (typeof _abTranscreverTrecho !== 'function' && typeof _loadScript === 'function') await _loadScript('js/audiobook.js')
    if (typeof _abTranscreverTrecho !== 'function') throw new Error('não consegui carregar a transcrição')
    // O capítulo INTEIRO, como no "transcrever tudo" — meia transcrição daria
    // meio capítulo sincronizado, que é pior que nenhum.
    await _abTranscreverTrecho(audio, capAudio, _abAlvoInteiro(audio, capAudio), m => _sincBarraMsg(m))
  }
  _sincBarraMsg('Casando o texto com a voz…')
  const mapa = await sincProcessarCapitulo(livro, audio, capAudio)
  _sincMapa = mapa
  _sincMapa.fimAudio = _sincFimDoCap(audio, capAudio)
  return true
}

function _sincFimDoCap(audio, capAudio) {
  const c = (audio.capitulos || [])[capAudio]
  return c && c.fim ? c.fim : 0
}

// ---------------------------------------------------------------
// A BARRA — o único controle que este modo precisa
// ---------------------------------------------------------------
// ⚠️ NÃO É UM SEGUNDO REPRODUTOR. Quem quer velocidade, marcador e timer de
// sono vai à seção Audiobook; aqui a tarefa é uma só — ouvir o que está
// escrito. Play, voltar uma frase, avançar uma frase, e sair.
function _sincBarra() {
  let b = document.getElementById('sinc-barra')
  if (b) return b
  b = document.createElement('div')
  b.id = 'sinc-barra'
  b.className = 'sinc-barra sinc-ui'
  document.body.appendChild(b)
  return b
}
function _sincBarraFechar() { document.getElementById('sinc-barra')?.remove() }
function _sincBarraMsg(msg) {
  const b = _sincBarra()
  b.innerHTML = `<span class="sinc-msg">${ic('sparkles','ic-sm')} ${esc(msg)}</span>`
}

function _sincPintarBarra() {
  if (!_sincOn) return
  const b = _sincBarra()
  const el = _sincAudioEl
  const tocando = el && !el.paused
  const f = _sincFrases && _sincFrases[_sincAtual]
  b.innerHTML = `
    <button class="sinc-b" onclick="sincPular(-1)" data-tip="Frase anterior">${ic('chevronLeft','ic-sm')}</button>
    <button class="sinc-b sinc-play" onclick="sincPlay()" data-tip="${tocando ? 'Pausar' : 'Tocar'}">
      ${ic(tocando ? 'pause' : 'play','ic-sm')}</button>
    <button class="sinc-b" onclick="sincPular(1)" data-tip="Próxima frase">${ic('chevronRight','ic-sm')}</button>
    <span class="sinc-frase">${f ? esc(f.texto.slice(0, 70)) : 'ouvindo o texto do autor'}</span>
    <button class="sinc-b" onclick="sincSeguirAlternar()" data-tip="${_sincSeguir ? 'Parar de virar a página sozinho' : 'Virar a página acompanhando a voz'}">
      ${ic(_sincSeguir ? 'eye' : 'eyeOff','ic-sm')}</button>
    <button class="sinc-b" onclick="sincLeitorSair()" data-tip="Sair do modo ouvir junto">${ic('x','ic-sm')}</button>`
}

function sincPlay() {
  const el = _sincAudioEl; if (!el) return
  if (el.paused) el.play().catch(() => {}); else el.pause()
  _sincPintarBarra()
}
function sincSeguirAlternar() { _sincSeguir = !_sincSeguir; _sincPintarBarra() }

function sincPular(d) {
  if (!_sincFrases || !_sincMapa || !_sincAudioEl) return
  const ix = Math.max(0, Math.min(_sincFrases.length - 1, (_sincAtual < 0 ? 0 : _sincAtual) + d))
  const t = sincTempoDe(_sincMapa, _sincFrases[ix].pos)
  if (t != null) { _sincAudioEl.currentTime = t; _sincPintarFrase(ix) }
}

// ⚠️ TOCAR NUMA FRASE É O GESTO MAIS ÓBVIO DESTA TELA, e ele não pode brigar
// com a seleção de palavra (que é como se captura vocabulário aqui). Por isso
// só vale com o modo LIGADO e quando nada está selecionado.
function sincCliqueNoTexto(ev) {
  if (!_sincOn || !_sincFrases || !_sincMapa) return
  const sel = window.getSelection()
  if (sel && String(sel).trim()) return
  let no = ev.target
  const cont = document.getElementById('ler-conteudo')
  if (!cont || !cont.contains(no)) return
  const x = ev.clientX, y = ev.clientY
  for (let i = 0; i < _sincFrases.length; i++) {
    const rects = _sincFrases[i].range.getClientRects()
    for (const r of rects) {
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const t = sincTempoDe(_sincMapa, _sincFrases[i].pos)
        if (t != null && _sincAudioEl) {
          _sincAudioEl.currentTime = t
          _sincPintarFrase(i)
          if (_sincAudioEl.paused) _sincAudioEl.play().catch(() => {})
          _sincPintarBarra()
        }
        return
      }
    }
  }
}

// ---------------------------------------------------------------
// LIGAR O LIVRO AO AUDIOLIVRO
// ---------------------------------------------------------------
async function sincLigarModal() {
  if (!_lerLivro) return
  const candidatos = sincParecidos(_lerLivro.title, (audiolivros || []).filter(a => a.arquivos), a => a.title)
  const outros = (audiolivros || []).filter(a => a.arquivos && !candidatos.some(c => c.item.id === a.id))
  document.getElementById('sinc-ligar')?.remove()
  const ov = document.createElement('div')
  ov.id = 'sinc-ligar'; ov.className = 'srs-modal-overlay sinc-ui'
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove() })
  const linha = (a, sugerido) => `
    <button class="est-gb-item" onclick="sincLigarEscolher('${a.id}')">
      ${a.cover ? `<img src="${escA(a.cover)}" alt="" loading="lazy">` : `<span class="est-gb-sem">${ic('volume','ic-sm')}</span>`}
      <span class="est-gb-txt"><b>${esc(a.title)}</b>
        <i>${esc(a.author || '')}${a.duracao ? ` · ${Math.round(a.duracao / 3600)}h` : ''} · ${(a.capitulos || []).length} capítulos</i></span>
      ${sugerido ? `<span class="est-selo">parece este</span>` : ''}
    </button>`
  ov.innerHTML = `<div class="srs-modal-box" style="width:100%;max-width:620px">
    <h4 style="font-size:var(--fs-base);font-weight:700;margin-bottom:4px">Ouvir junto com o texto</h4>
    <p style="font-size:var(--fs-sm);color:var(--text2);margin-bottom:14px">
      Qual audiolivro é <b>${esc(obraNome(_lerLivro.title))}</b>? Depois de ligados, o texto do autor
      acompanha a voz do narrador — e o que você capturar leva as duas coisas.</p>
    ${candidatos.length ? `<div class="est-gb-res">${candidatos.map(c => linha(c.item, true)).join('')}</div>` : ''}
    ${outros.length ? `<p class="est-dica" style="margin:12px 0 6px">Outros da sua estante</p>
      <div class="est-gb-res">${outros.map(a => linha(a, false)).join('')}</div>` : ''}
    ${!candidatos.length && !outros.length ? `<p class="est-dica est-erro">
      Nenhum audiolivro com áudio neste aparelho. Importe o arquivo na seção Audiobook primeiro.</p>` : ''}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('sinc-ligar').remove()">Fechar</button>
    </div>
  </div>`
  document.body.appendChild(ov)
}

// Chamado pelo leitor quando o capítulo muda com o modo ligado.
async function sincTrocouCapitulo(capLivro) {
  if (!_sincOn || capLivro === _sincCapLivro) {
    if (_sincOn) { _sincFrases = sincIndexarFrases(); _sincAtual = -1 }
    return
  }
  const audio = sincAudioDoLivro(_lerLivro)
  if (!audio) return sincLeitorSair()
  if (_sincAudioEl) _sincAudioEl.pause()
  _sincLimparRealce(); _sincAtual = -1
  try {
    _sincBarraMsg('Procurando este capítulo no audiolivro…')
    const ok = await sincPrepararCapitulo(_lerLivro, audio, capLivro)
    if (!ok) return sincLeitorSair()
    _sincCapLivro = capLivro
    _sincFrases = sincIndexarFrases()
    const { el } = await _sincCarregarAudio(audio, _sincMapa.capAudio)
    const t = sincTempoDe(_sincMapa, 0)
    if (t != null) el.currentTime = t
    _sincPintarBarra()
  } catch (e) {
    toast(String(e.message || e), 'error')
    sincLeitorSair()
  }
}

async function sincLigarEscolher(audioId) {
  const audio = (audiolivros || []).find(a => a.id === audioId)
  if (!audio || !_lerLivro) return
  sincLigar(_lerLivro, audio)
  document.getElementById('sinc-ligar')?.remove()
  toast(`"${esc(obraNome(_lerLivro.title))}" ligado ao audiolivro`, 'success')
  sincLeitorAlternar()
}

// ================================================================
// O LADO DO REPRODUTOR — a frase como o AUTOR escreveu
// ================================================================
// ⚠️ ESTE É O PEDIDO INTEIRO EM UMA FRASE. Hoje o marcador guarda o que o
// Whisper ouviu: *"Garrod did not rise to the bait"*. O livro diz *"Gared did
// not rise to the bait"* — e o card que ele estuda tem de trazer o que o
// **autor** escreveu, com o áudio do narrador dizendo aquilo. É a diferença
// entre estudar um livro e estudar a transcrição de um livro.
// O cache existe porque quem pergunta é código SÍNCRONO (a lista de
// marcadores, a captura), e ler o mapa é assíncrono.
let _sincCacheAudio = { audioId: null, capAudio: -1, mapa: null, frases: null }

function _sincFrasesDoTexto(texto) {
  const partes = String(texto || '').split(/(?<=[.!?…”"])\s+/)
  const out = []
  let pos = 0
  for (const p of partes) {
    const n = sincNorm(p).length
    if (n) out.push({ pos, palavras: n, texto: p.trim() })
    pos += n
  }
  return out
}

// Carrega (uma vez por capítulo) o que é preciso para responder "que frase do
// livro é este instante?". Falha em silêncio: sem par, sem mapa ou sem o
// arquivo do livro aqui, o app segue com a transcrição, como antes.
async function sincPrepararParaAudio(audio, capAudio) {
  try {
    if (!audio || !audio.livroId) return false
    if (_sincCacheAudio.audioId === audio.id && _sincCacheAudio.capAudio === capAudio) return !!_sincCacheAudio.mapa
    _sincCacheAudio = { audioId: audio.id, capAudio, mapa: null, frases: null }
    const livro = sincLivroDoAudio(audio)
    if (!livro) return false
    const capLivro = (audio.capMapa || {})[capAudio]
    if (capLivro == null) return false
    const mapa = await sincMapaLer(livro.id, capLivro)
    if (!mapa || !(mapa.ancoras || []).length) return false
    const textos = await sincTextosDoLivro(livro)
    _sincCacheAudio = { audioId: audio.id, capAudio, mapa, frases: _sincFrasesDoTexto(textos[capLivro]) }
    return true
  } catch (e) { return false }
}

// Síncrona de propósito — ver o comentário do cache acima.
function sincFraseDoInstante(audio, capAudio, seg) {
  const c = _sincCacheAudio
  if (!c.mapa || !c.frases || c.audioId !== (audio && audio.id) || c.capAudio !== capAudio) return ''
  const pos = sincPosicaoDe(c.mapa, seg)
  if (pos == null) return ''
  let lo = 0, hi = c.frases.length - 1, r = 0
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (c.frases[m].pos <= pos) { r = m; lo = m + 1 } else hi = m - 1
  }
  return c.frases[r] ? c.frases[r].texto : ''
}

// ---------------------------------------------------------------
// OUVIR LENDO — do reprodutor para a página certa do livro
// ---------------------------------------------------------------
// ⚠️ "ABRIR O LIVRO" NÃO É ABRIR NO COMEÇO. Quem está no minuto 12 do capítulo
// quer o parágrafo do minuto 12 — abrir na primeira página seria devolver o
// trabalho de procurar, que é exatamente o que esta peça existe para evitar.
async function sincAbrirTexto(audio, capAudio, seg) {
  if (!audio) return
  const livro = sincLivroDoAudio(audio)
  if (!livro) return sincLigarModalAudio(audio)
  try {
    toast('Procurando este trecho no livro…', 'info')
    let capLivro = (audio.capMapa || {})[capAudio]
    if (capLivro == null) {
      const mapa = await sincProcessarCapitulo(livro, audio, capAudio).catch(e => { throw e })
      capLivro = mapa.capLivro
    }
    const mapa = await sincMapaLer(livro.id, capLivro)
    const textos = await sincTextosDoLivro(livro)
    const total = Math.max(1, sincNorm(textos[capLivro]).length)
    const pos = mapa ? sincPosicaoDe(mapa, seg) : 0
    const frac = Math.max(0, Math.min(0.98, (pos || 0) / total))
    // O reprodutor continua tocando: sair da seção nunca parou o áudio (§8.72),
    // e aqui isso é a graça — ele lê acompanhando o que já está no ouvido.
    showSection('ler')
    await new Promise(r => setTimeout(r, 60))
    if (typeof lerAbrir === 'function') await lerAbrir(livro.id)
    if (typeof lerIrParaCapitulo === 'function') await lerIrParaCapitulo(capLivro, frac)
    toast('Aqui está o texto do autor, no ponto em que você parou', 'success')
  } catch (e) {
    toast(String(e.message || e), 'error')
  }
}

// O mesmo modal de ligação, do lado do reprodutor.
async function sincLigarModalAudio(audio) {
  const candidatos = sincParecidos(audio.title, (livros || []).filter(l => l.kind !== 'fisico'), l => l.title)
  const outros = (livros || []).filter(l => l.kind !== 'fisico' && !candidatos.some(c => c.item.id === l.id))
  document.getElementById('sinc-ligar')?.remove()
  const ov = document.createElement('div')
  ov.id = 'sinc-ligar'; ov.className = 'srs-modal-overlay sinc-ui'
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove() })
  const linha = (l, sug) => `
    <button class="est-gb-item" onclick="sincLigarEscolherLivro('${audio.id}','${l.id}')">
      ${(l.cover || l.coverUrl) ? `<img src="${escA(l.cover || l.coverUrl)}" alt="" loading="lazy">` : `<span class="est-gb-sem">${ic('book','ic-sm')}</span>`}
      <span class="est-gb-txt"><b>${esc(obraNome(l.title))}</b>
        <i>${esc(l.author || '')} · ${(l.chapters || []).length} partes</i></span>
      ${sug ? `<span class="est-selo">parece este</span>` : ''}
    </button>`
  ov.innerHTML = `<div class="srs-modal-box" style="width:100%;max-width:620px">
    <h4 style="font-size:var(--fs-base);font-weight:700;margin-bottom:4px">Ler junto com o áudio</h4>
    <p style="font-size:var(--fs-sm);color:var(--text2);margin-bottom:14px">
      Qual livro da estante é <b>${esc(audio.title)}</b>? Com os dois ligados, o texto do autor abre
      no ponto em que o narrador está — e seus marcadores passam a guardar a frase como ela foi escrita.</p>
    ${candidatos.length ? `<div class="est-gb-res">${candidatos.map(c => linha(c.item, true)).join('')}</div>` : ''}
    ${outros.length ? `<p class="est-dica" style="margin:12px 0 6px">Outros da sua estante</p>
      <div class="est-gb-res">${outros.map(l => linha(l, false)).join('')}</div>` : ''}
    ${!candidatos.length && !outros.length ? `<p class="est-dica est-erro">
      Nenhum livro com arquivo na estante. Importe o EPUB na seção Ler primeiro.</p>` : ''}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('sinc-ligar').remove()">Fechar</button>
    </div>
  </div>`
  document.body.appendChild(ov)
}

function sincLigarEscolherLivro(audioId, livroId) {
  const audio = (audiolivros || []).find(a => a.id === audioId)
  const livro = (livros || []).find(l => l.id === livroId)
  if (!audio || !livro) return
  sincLigar(livro, audio)
  document.getElementById('sinc-ligar')?.remove()
  toast(`"${esc(audio.title)}" ligado a "${esc(obraNome(livro.title))}"`, 'success')
  if (typeof _abRenderPlayer === 'function') _abRenderPlayer()
}
