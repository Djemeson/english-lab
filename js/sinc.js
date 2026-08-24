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

// ⚠️ O PAR TEM UM DONO SÓ, E É O AUDIOLIVRO. A primeira versão guardava dos
// dois lados por segurança — e a segurança virou o problema: no teste, o
// `audioId` do livro sumiu num merge da nuvem (o objeto do livro veio de lá
// sem o campo novo) enquanto o `livroId` do áudio ficou. Dois lugares para a
// mesma verdade é um lugar para ela se perder.
// O campo no livro continua sendo escrito como atalho, mas quem responde é a
// varredura dos audiolivros — que é curta e nunca discorda de si mesma.
function sincAudioDoLivro(livro) {
  if (!livro) return null
  const lista = (typeof audiolivros !== 'undefined' ? audiolivros : [])
  const porTras = lista.find(a => a.livroId === livro.id)
  if (porTras) return porTras
  return (livro.audioId && lista.find(a => a.id === livro.audioId)) || null
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
let _sincCapLivro = -1
let _sincSeguir = true

function sincAtivo() { return _sincOn }
// Reindexa as frases quando alguma pintura reconstrói os nós de texto do
// capítulo (raio-X, pintura de estudo): os Ranges antigos ficam órfãos e o
// realce/virada de página morrem calados sem isto (rodada 44).
function sincReindexarSeAtivo() {
  if (!_sincOn) return
  _sincFrases = sincIndexarFrases()
  _sincAtual = -1
}
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
  _sincLevarAVista(f)
}

// ⚠️ SEGUIR A VOZ TEM DE IR PARA OS DOIS LADOS, e a primeira versão só ia para
// a frente. Foi o que ele viu: a barra dizia *"Gared said with iron
// certainty"*, que é do começo do prólogo, e a página na tela estava lá
// adiante — o destaque existia numa coluna que ninguém estava olhando.
// Acontece o tempo todo: ele lê até certo ponto, o áudio começa do princípio
// do capítulo, e acompanhar significa **voltar**.
// ⚠️ E não é `scrollIntoView`: no modo paginado o leitor rola por COLUNAS de
// largura exata, e um scroll arbitrário deixaria meia linha cortada na borda —
// por isso o deslocamento é sempre um número inteiro de páginas.
function _sincLevarAVista(f) {
  try {
    const vp = document.getElementById('ler-viewport')
    if (!vp || !f) return
    const r = f.range.getClientRects()[0] || f.range.getBoundingClientRect()
    if (!r || (!r.width && !r.height)) return
    const cx = vp.getBoundingClientRect()
    // ⚠️ ATRIBUIR `scrollTop` NÃO FUNCIONA AQUI, e isto já mordeu o projeto uma
    // vez (o mesmo comentário está em `_abCentralizar`): a viewport do leitor
    // tem `scroll-behavior:smooth`, e rolagem animada depende de o navegador
    // estar compondo quadros. Medido: `vp.scrollTop = x + 300` deixou o valor
    // em 4545, parado. `scrollTo` com `behavior` explícito vence o CSS sem
    // alterar o elemento — e acompanhar a voz quer o pulo pronto, não uma
    // animação que ainda está a caminho quando a frase seguinte começa.
    const suave = document.visibilityState === 'visible'
    const paginado = typeof _lerPaginado === 'function' ? _lerPaginado() : false
    if (paginado) {
      if (r.left >= cx.left - 2 && r.right <= cx.right + 2) return
      const largura = vp.clientWidth || 1
      // Quantas páginas inteiras separam a frase da coluna visível. Negativo =
      // ela ficou para trás.
      const paginas = Math.round((r.left - cx.left) / largura)
      if (!paginas) return
      const alvo = Math.max(0, Math.min(vp.scrollWidth - largura, vp.scrollLeft + paginas * largura))
      vp.scrollTo({ left: alvo, behavior: suave ? 'smooth' : 'instant' })
    } else {
      if (r.top >= cx.top && r.bottom <= cx.bottom) return
      // No modo rolagem a frase para a um terço do alto: acompanhar de olho no
      // meio da tela cansa menos que colada no topo.
      const alvo = Math.max(0, vp.scrollTop + (r.top - cx.top) - vp.clientHeight * 0.33)
      vp.scrollTo({ top: alvo, behavior: suave ? 'smooth' : 'instant' })
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
// O ÁUDIO É UM SÓ — o do reprodutor
// ---------------------------------------------------------------
// ⚠️ A PRIMEIRA VERSÃO CRIOU UM SEGUNDO `<audio>`, E ELE OUVIU OS DOIS AO MESMO
// TEMPO. O relato foi direto: *"ao clicar, um segundo áudio do mesmo audiobook
// começou a rodar"*. O argumento de separar (o reprodutor tem estado próprio:
// marcadores, timer de sono, Media Session) estava certo sobre o CÓDIGO e
// errado sobre o USUÁRIO — para quem ouve, existe uma narração só.
// Agora o leitor pilota o mesmo `#ab-audio` do reprodutor, pelo caminho normal
// dele. Sair do leitor e ir ao reprodutor continua a MESMA escuta.
function _sincAudio() { return document.getElementById('ab-audio') }

// ⚠️ E OS INSTANTES NÃO ESTÃO NA MESMA RÉGUA. A transcrição guarda o tempo
// RELATIVO ao capítulo (começa em 0); o `<audio>` toca o ARQUIVO INTEIRO, onde
// o mesmo capítulo começa em `cap.ini`. Medido no acervo dele: o Prologue
// começa aos **16 s** do arquivo, e a transcrição dele vai de 0 a 1491.
// Somar errado aqui é o que fazia o áudio pular para o lugar errado — e num
// capítulo adiantado o erro seria de HORAS, não de segundos.
function _sincParaAudio(cap, t) { return (cap && cap.ini ? cap.ini : 0) + (t || 0) }
function _sincDoAudio(cap, t) { return (t || 0) - (cap && cap.ini ? cap.ini : 0) }

let _sincLigadoNoAudio = false
function _sincLigarEventos(el) {
  if (!el || _sincLigadoNoAudio) return
  _sincLigadoNoAudio = true
  el.addEventListener('timeupdate', () => {
    if (!_sincOn || !_sincMapa) return
    const ix = _sincFraseDoTempo(_sincDoAudio(_sincMapa.cap, el.currentTime))
    if (ix >= 0) _sincPintarFrase(ix)
  })
  el.addEventListener('play', _sincPintarBarra)
  el.addEventListener('pause', _sincPintarBarra)
}

// Põe o reprodutor no capítulo certo, sem trocar de seção. É o caminho normal
// do audiolivro — o que garante que o player e o leitor nunca discordem sobre
// o que está tocando.
async function _sincCarregarAudio(audio, capAudio) {
  const cap = (audio.capitulos || [])[capAudio]
  if (!cap) throw new Error('capítulo do áudio não encontrado')
  if (typeof abAbrir !== 'function' && typeof _loadScript === 'function') await _loadScript('js/audiobook.js')
  if (typeof abAbrir !== 'function') throw new Error('não consegui carregar o reprodutor')
  if (typeof _abLivro === 'undefined' || !_abLivro || _abLivro.id !== audio.id) await abAbrir(audio.id)
  if (typeof _abCap === 'undefined' || _abCap !== capAudio) await _abCarregarCapitulo(capAudio, 0)
  const el = _sincAudio()
  if (!el) throw new Error('o reprodutor não está pronto')
  _sincLigarEventos(el)
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
    const { el, cap } = await _sincCarregarAudio(audio, _sincMapa.capAudio)
    _sincMapa.cap = cap
    // Começa de onde ele está LENDO — é isso que "ouvir daqui" quer dizer.
    const pos = _sincPosicaoVisivel()
    const t = sincTempoDe(_sincMapa, pos)
    if (t != null) el.currentTime = _sincParaAudio(cap, t)
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
  const _el = _sincAudio(); if (_el) _el.pause()
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
  const el = _sincAudio()
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
  const el = _sincAudio(); if (!el) return
  if (el.paused) el.play().catch(() => {}); else el.pause()
  _sincPintarBarra()
}
function sincSeguirAlternar() { _sincSeguir = !_sincSeguir; _sincPintarBarra() }

function sincPular(d) {
  const el = _sincAudio()
  if (!_sincFrases || !_sincMapa || !el) return
  const ix = Math.max(0, Math.min(_sincFrases.length - 1, (_sincAtual < 0 ? 0 : _sincAtual) + d))
  const t = sincTempoDe(_sincMapa, _sincFrases[ix].pos)
  if (t != null) { el.currentTime = _sincParaAudio(_sincMapa.cap, t); _sincPintarFrase(ix) }
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
        const el = _sincAudio()
        if (t != null && el) {
          el.currentTime = _sincParaAudio(_sincMapa.cap, t)
          _sincPintarFrase(i)
          if (el.paused) el.play().catch(() => {})
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
  const _p = _sincAudio(); if (_p) _p.pause()
  _sincLimparRealce(); _sincAtual = -1
  try {
    _sincBarraMsg('Procurando este capítulo no audiolivro…')
    const ok = await sincPrepararCapitulo(_lerLivro, audio, capLivro)
    if (!ok) return sincLeitorSair()
    _sincCapLivro = capLivro
    _sincFrases = sincIndexarFrases()
    // ⚠️ IGUAL AO LIGAR (rodada 44): o `cap` volta junto e o tempo passa por
    // `_sincParaAudio`. Este caminho descartava o cap (o realce e o clique
    // ficavam sem o deslocamento) e cravava o tempo RELATIVO direto no
    // arquivo — num m4b de arquivo único, o capítulo 12 começa milhares de
    // segundos adentro, e virar a página mandava o áudio para outro lugar
    // do livro. Em faixas soltas (ini=0) nada aparecia, e foi por isso que o
    // teste passou.
    const { el, cap } = await _sincCarregarAudio(audio, _sincMapa.capAudio)
    _sincMapa.cap = cap
    const t = sincTempoDe(_sincMapa, 0)
    if (t != null) el.currentTime = _sincParaAudio(cap, t)
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

// ---------------------------------------------------------------
// O TEXTO DO LIVRO NO FORMATO DAS FALAS
// ---------------------------------------------------------------
// ⚠️ ESTA É A PEÇA QUE ELE PEDIU DEPOIS DE VER A PRIMEIRA VERSÃO: *"o que eu
// queria era que o texto do livro viesse pra cá"*. Devolvendo as frases no
// MESMO formato das falas transcritas (`{i, f, t}`, em segundos relativos ao
// capítulo), a aba de texto do reprodutor passa a mostrar o autor sem que nada
// mais mude — o acompanhamento, a rolagem que centraliza, a tela cheia, a
// seleção que traduz e a captura já sabem trabalhar com isso.
// Devolve `null` quando não há mapa: aí a transcrição continua sendo mostrada,
// como sempre foi.
function sincFalasDoLivro(audio, capAudio) {
  const c = _sincCacheAudio
  if (!c.mapa || !c.frases || c.audioId !== (audio && audio.id) || c.capAudio !== capAudio) return null
  const fim = (c.mapa.ancoras[c.mapa.ancoras.length - 1] || [0, 0])[1]
  const out = []
  for (let k = 0; k < c.frases.length; k++) {
    const f = c.frases[k], prox = c.frases[k + 1]
    const i = sincTempoDe(c.mapa, f.pos)
    const ff = prox ? sincTempoDe(c.mapa, prox.pos) : fim
    if (i == null) continue
    out.push({ i, f: Math.max(i + 0.3, ff == null ? i + 3 : ff), t: f.texto })
  }
  return out.length ? out : null
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
// O TEXTO DO AUTOR, AQUI MESMO
// ---------------------------------------------------------------
// ⚠️ A PRIMEIRA VERSÃO MANDAVA ELE PARA OUTRA SEÇÃO, e o relato foi que ficou
// *"muito esquisito"*: ele estava ouvindo, apertou o botão e o app trocou de
// tela. Quem ouve quer o texto ONDE está ouvindo. Trocar de seção agora é uma
// escolha à parte (`sincAbrirNoLeitor`), não a resposta padrão.
async function sincTextoAqui(audio, capAudio) {
  if (!audio) return
  const livro = sincLivroDoAudio(audio)
  if (!livro) return sincLigarModalAudio(audio)
  try {
    if ((audio.capMapa || {})[capAudio] == null) {
      toast('Procurando este capítulo dentro do livro…', 'info')
      const textos = await sincTextosDoLivro(livro)
      const temTr = (audio.transcricoes || []).some(x => x.cap === capAudio)
      if (!temTr) {
        const nome = ((audio.capitulos || [])[capAudio] || {}).titulo || `capítulo ${capAudio + 1}`
        const ok = await confirmModal({
          title: 'Falta a transcrição deste capítulo', icon: 'sparkles', confirmText: 'Transcrever agora',
          html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
            Para casar o texto do autor com a voz, preciso do que o narrador diz em
            <b>${esc(nome)}</b>. É pago uma vez só, e depois vale nos seus dois aparelhos.</p>`
        })
        if (!ok) return
        await _abTranscreverTrecho(audio, capAudio, _abAlvoInteiro(audio, capAudio),
          m => { const b = el('ab-aba'); if (b) b.innerHTML = `<div class="est-nada"><p>${esc(m)}</p></div>` })
      }
      await sincProcessarCapitulo(livro, audio, capAudio)
    }
    const ok = await sincPrepararParaAudio(audio, capAudio)
    if (!ok) { toast('Não consegui casar este capítulo com o livro.', 'warning'); return }
    if (typeof abAba === 'function') abAba('texto')
    toast('Este é o texto do autor — a frase acende conforme ele lê', 'success')
  } catch (e) {
    toast(String(e.message || e), 'error')
  }
}

// ⚠️ "ABRIR NO LEITOR" NÃO É ABRIR NO COMEÇO. Quem está no minuto 12 quer o
// parágrafo do minuto 12 — abrir na primeira página devolveria o trabalho de
// procurar, que é o que esta peça existe para evitar.
async function sincAbrirNoLeitor(audio, capAudio, seg) {
  if (!audio) return
  const livro = sincLivroDoAudio(audio)
  if (!livro) return sincLigarModalAudio(audio)
  try {
    let capLivro = (audio.capMapa || {})[capAudio]
    if (capLivro == null) { await sincTextoAqui(audio, capAudio); capLivro = (audio.capMapa || {})[capAudio] }
    if (capLivro == null) return
    const mapa = await sincMapaLer(livro.id, capLivro)
    const textos = await sincTextosDoLivro(livro)
    const total = Math.max(1, sincNorm(textos[capLivro]).length)
    const cap = (audio.capitulos || [])[capAudio]
    const rel = _sincDoAudio(cap, seg)
    const pos = mapa ? sincPosicaoDe(mapa, rel) : 0
    const frac = Math.max(0, Math.min(0.98, (pos || 0) / total))
    // O reprodutor continua tocando: sair da seção nunca parou o áudio (§8.72).
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
