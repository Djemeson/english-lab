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
// ================================================================
// V2 — POR QUE A PRIMEIRA VERSÃO QUEBROU EM *CARRIE* (rodada 78)
// ================================================================
// A v1 assumia **1 capítulo do áudio = 1 capítulo do livro**. O acervo dele
// desmentiu: o áudio de *Carrie* tem **60 capítulos de ~10 min**; o EPUB tem
// **3 seções de ~30 mil palavras**. E o "Chapter 1" do áudio começa com
// *"This is Audible…"* + a introdução do autor — um texto que **não existe**
// no EPUB (melhor casamento medido: 6,5%, contra o corte de 25%). Resultado:
// transcrição paga, erro seco, beco sem saída.
// É a mesma tríade que reprova pares no Whispersync da Amazon (documentado):
// front matter que só existe num formato, fronteiras de capítulo diferentes,
// e texto normalizado diferente. A resposta deles — e a nossa — é a mesma:
// **ancorar pelo TEXTO, ignorar a estrutura de arquivos.**
//
// O QUE MUDOU NA V2:
//   1. O tempo das âncoras é ABSOLUTO no arquivo de áudio (não relativo ao
//      capítulo). Vários capítulos do áudio se emendam num mapa contínuo por
//      seção do livro, e o realce atravessa a fronteira de faixa sem costura.
//   2. O mapa de uma seção é PARCIAL e MESCLÁVEL: cada transcrição nova
//      estende o que já existe (`trechos[]` registra o que cobre o quê).
//   3. Capítulo do áudio que não casa com nada vira **`capMapa[cap] = -1`**
//      ("fora do livro": créditos, introdução da gravação) — informação, não
//      erro. O fluxo pula para o próximo em vez de morrer.
//   4. Quem escolhe O QUE transcrever é um MODELO DE TEMPO global: posição no
//      livro → segundo estimado no arquivo (interpola pelas âncoras que já
//      existem; sem nenhuma, proporção palavras/duração). O palpite erra no
//      máximo um capítulo de áudio e se corrige sozinho com o primeiro
//      alinhamento — porque todo alinhamento DIZ onde caiu.
//   5. A cobertura que valida um alinhamento é medida do lado da TRANSCRIÇÃO
//      (quantas falas ancoraram), não do lado do livro — senão 10 min de
//      áudio dentro de uma seção de 30 mil palavras nunca passariam.
//   6. Âncoras monotônicas por LIS (maior subsequência crescente), não pelo
//      guloso "primeiro que vier": um 5-grama repetido no começo não arrasta
//      mais o alinhamento inteiro para o lugar errado.
//
// ⚠️ NADA DISTO USA IA. É contagem e comparação de texto — de graça, no
// aparelho, em milissegundos. A IA já foi paga uma vez, na transcrição.
// ================================================================

const SINC_K = 5              // tamanho do n-grama que vira âncora
const SINC_PASSO = 8          // guarda uma âncora a cada N palavras (o resto interpola)
const SINC_FOLGA = 400        // palavras de folga para dizer que o mapa "cobre" um ponto

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
// PASSO 1 — em qual seção do livro está esta transcrição?
// ---------------------------------------------------------------
// ⚠️ NÃO DÁ PARA CASAR PELO TÍTULO, e o acervo dele mostra por quê: o áudio
// tem "Prologue", "Bran I"; o EPUB tem seções sem título legível ("Parte 1",
// "Title Page"), e *Carrie* chama duas seções de "Part One". Quem identifica
// uma seção é o TEXTO dela.
// A nota é a fração dos trigramas da transcrição que aparecem na seção.
// ⚠️ V2: os cortes mudaram com o caso real na mão. Nota < 0,22 é "fora do
// livro" (a introdução do narrador mediu 6,5%). E a margem sobre o segundo
// colocado só derruba quando a nota do campeão é MEDIANA: com nota alta
// (≥ 0,5), dois candidatos colados significam conteúdo duplicado no EPUB
// (acontece — sumário que repete a seção), e qualquer um dos dois serve.
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
  if (campeao.nota < 0.22) return null
  if (campeao.nota - segundo.nota < 0.08 && campeao.nota < 0.5) return null
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

// ⚠️ AS ÂNCORAS TÊM DE SER CRESCENTES DOS DOIS LADOS, e a v1 filtrava no
// guloso: mantinha a primeira que viesse e descartava quem a contradissesse.
// Uma âncora ERRADA no começo (frase repetida em outro ponto da seção)
// derrubava todas as certas depois dela. A LIS (maior subsequência crescente)
// decide pelo conjunto: fica o maior time que concorda entre si.
function _sincLIS(pares) {
  // pares ordenados por posição no livro; busca a maior subsequência com a
  // posição na transcrição estritamente crescente. O(n log n).
  const topo = []          // topo[k] = índice do par que fecha a subseq. de tamanho k+1 com menor j
  const antes = new Array(pares.length).fill(-1)
  for (let x = 0; x < pares.length; x++) {
    const j = pares[x][1]
    let lo = 0, hi = topo.length
    while (lo < hi) {
      const m = (lo + hi) >> 1
      if (pares[topo[m]][1] < j) lo = m + 1; else hi = m
    }
    if (lo > 0) antes[x] = topo[lo - 1]
    topo[lo] = x
  }
  const out = []
  let x = topo.length ? topo[topo.length - 1] : -1
  while (x >= 0) { out.push(pares[x]); x = antes[x] }
  return out.reverse()
}

// Devolve o alinhamento de uma transcrição contra o texto de UMA seção,
// com o tempo já ABSOLUTO no arquivo (`desloc` = início do capítulo do áudio
// dentro do arquivo). `null` quando o casamento não se sustenta.
function sincAlinhar(textoLivro, segs, desloc) {
  desloc = desloc || 0
  const lw = sincNorm(textoLivro)
  const tw = _sincPalavrasComTempo(segs)
  if (lw.length < 50 || tw.length < 30) return null

  const A = _sincIndice(lw), B = _sincIndice(tw.map(x => x.w))
  const brutas = []
  for (const [g, i] of A) {
    if (i < 0) continue
    const j = B.get(g)
    if (j !== undefined && j >= 0) brutas.push([i, j])
  }
  if (brutas.length < 12) return null
  brutas.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const mono = _sincLIS(brutas)

  // ⚠️ A COBERTURA É DO LADO DO ÁUDIO (v2). A v1 dividia pelo tamanho da
  // seção do livro — e 10 minutos de áudio dentro de "Part One" de *Carrie*
  // (30 mil palavras) davam 5%, reprovados para sempre. O que valida um
  // alinhamento é quanto DA TRANSCRIÇÃO ancorou no texto.
  const cobertura = mono.length / Math.max(1, tw.length - SINC_K + 1)
  if (mono.length < 12 || cobertura < 0.08) return null

  // ⚠️ GUARDAR TODAS AS ÂNCORAS SERIA GUARDAR O QUE A INTERPOLAÇÃO REFAZ. Uma
  // a cada 8 palavras mantém o erro dentro de meio segundo e derruba o tamanho
  // do mapa em 8× — e ele viaja para a nuvem, onde cada documento tem teto.
  const ancoras = []
  let proxima = -1
  for (const [i, j] of mono) {
    if (i < proxima) continue
    ancoras.push([i, Math.round((tw[Math.min(tw.length - 1, j)].t + desloc) * 100) / 100])
    proxima = i + SINC_PASSO
  }
  const ultimaMono = mono[mono.length - 1]
  const tFim = tw[Math.min(tw.length - 1, ultimaMono[1])].t + desloc
  if (!ancoras.length || ancoras[ancoras.length - 1][0] < ultimaMono[0]) {
    ancoras.push([ultimaMono[0], Math.round(tFim * 100) / 100])
  }
  return {
    ancoras,
    pos0: mono[0][0], pos1: ultimaMono[0],          // onde caiu, na seção
    jMin: mono[0][1], jMax: ultimaMono[1],          // o que da transcrição foi usado
    palavrasLivro: lw.length, palavrasAudio: tw.length,
    casadas: mono.length, cobertura
  }
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

// O mapa "cobre" um ponto quando o ponto cai dentro das âncoras, com uma
// folga de algumas centenas de palavras (2–3 min de narração) em cada borda.
function _sincCobre(mapa, pos) {
  const A = (mapa && mapa.ancoras) || []
  if (!A.length) return false
  return pos >= A[0][0] - SINC_FOLGA && pos <= A[A.length - 1][0] + SINC_FOLGA
}

// ---------------------------------------------------------------
// ONDE O MAPA MORA
// ---------------------------------------------------------------
// Mesmo caminho do raio-X e do pré-estudo (§8.71): guardado no aparelho E na
// nuvem, sob demanda. Alinhar de novo é barato, mas transcrever não é.
//
// FORMATO V2 (`v: 2`): âncoras com tempo ABSOLUTO no arquivo, e `trechos[]`
// registrando qual capítulo do áudio contribuiu com o quê — é o que permite
// mesclar transcrições novas sem perder as antigas.
// Mapa V1 (sem `v`) é convertido NA LEITURA, somando o início do capítulo que
// o gerou — o guardado não é reescrito, para não quebrar um aparelho que
// ainda rode a versão anterior do app.
function sincChave(livroId, capLivro) { return `sinc:${livroId}:${capLivro}` }

function _sincV1paraV2(m, capLivro, audio) {
  const cap = (audio && audio.capitulos || [])[m.capAudio] || {}
  const d = cap.ini || 0
  const anc = (m.ancoras || []).map(([p, t]) => [p, Math.round((t + d) * 100) / 100])
  return {
    v: 2, capLivro,
    ancoras: anc,
    trechos: [{ cap: m.capAudio, pos0: anc.length ? anc[0][0] : 0, pos1: anc.length ? anc[anc.length - 1][0] : 0, nota: m.nota, casadas: m.casadas, em: m.em || 0 }],
    em: m.em || 0
  }
}

async function sincMapaLer(livroId, capLivro, audio) {
  try {
    const bruto = typeof geradoLer === 'function'
      ? await geradoLer(sincChave(livroId, capLivro))
      : await BookDB.get(sincChave(livroId, capLivro))
    if (!bruto) return null
    const m = typeof bruto === 'string' ? JSON.parse(bruto) : bruto
    return m.v === 2 ? m : _sincV1paraV2(m, capLivro, audio)
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

// Mescla um alinhamento novo num mapa existente da mesma seção. Onde os dois
// cobrem o mesmo trecho, o novo vence (foi feito com a transcrição mais
// recente); a ordem no tempo é reimposta no fim — âncora que voltaria no
// relógio é descartada.
function _sincMesclar(velho, novo) {
  const n0 = novo.ancoras[0][0], n1 = novo.ancoras[novo.ancoras.length - 1][0]
  const fora = (velho.ancoras || []).filter(([p]) => p < n0 || p > n1)
  const juntas = fora.concat(novo.ancoras).sort((a, b) => a[0] - b[0])
  const ancoras = []
  for (const a of juntas) {
    if (ancoras.length && a[1] <= ancoras[ancoras.length - 1][1]) continue
    ancoras.push(a)
  }
  const trechos = (velho.trechos || []).filter(t => !(novo.trechos || []).some(n => n.cap === t.cap))
    .concat(novo.trechos || [])
    .sort((a, b) => (a.pos0 || 0) - (b.pos0 || 0))
  return { ...velho, ...novo, ancoras, trechos, em: Date.now() }
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
  _sincModeloCache = { id: null }
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}

function sincDesligar(livro, audio) {
  if (livro) { delete livro.audioId; livro.updatedAt = Date.now() }
  if (audio) { delete audio.livroId; delete audio.capMapa; audio.updatedAt = Date.now() }
  saveLivros(); saveAudiolivros()
  _sincModeloCache = { id: null }
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}

// ⚠️ O PAR TEM UM DONO SÓ, E É O AUDIOLIVRO. A primeira versão guardava dos
// dois lados por segurança — e a segurança virou o problema: no teste, o
// `audioId` do livro sumiu num merge da nuvem (o objeto do livro veio de lá
// sem o campo novo) enquanto o `livroId` do áudio ficou. Dois lugares para a
// mesma verdade é um lugar para ela se perder.
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
// O TEXTO DAS SEÇÕES DO LIVRO, uma vez por sessão
// ---------------------------------------------------------------
// Abrir o EPUB e extrair as seções custa segundos; fazer isso a cada pergunta
// seria inviável. O cache vive na memória — cai sozinho ao recarregar.
let _sincTextoCache = { id: null, caps: null, offsets: null, total: 0 }
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
  // A régua global: em que palavra (contando o livro inteiro) cada seção
  // começa. É o que deixa o modelo de tempo enxergar o livro como UM texto.
  const offsets = []
  let soma = 0
  for (const t of caps) { offsets.push(soma); soma += sincNorm(t).length }
  _sincTextoCache = { id: livro.id, caps, offsets, total: soma }
  return caps
}

// ---------------------------------------------------------------
// O MODELO DE TEMPO — que segundo do arquivo é esta palavra do livro?
// ---------------------------------------------------------------
// ⚠️ ESTA É A PEÇA QUE SUBSTITUI O "PALPITE PELA ORDEM" DA V1 — que assumia
// capítulos 1:1 e, em *Carrie* (60 faixas × 3 seções), transcrevia a
// introdução do narrador achando que era "Part One".
// O modelo junta TODAS as âncoras já conquistadas (de qualquer seção) numa
// régua global posição→tempo. Dentro dela, interpola; fora, extrapola pela
// velocidade real do narrador; sem nenhuma âncora, proporção simples
// palavra/duração. O primeiro alinhamento que chegar corrige o resto.
let _sincModeloCache = { id: null }
async function _sincModelo(livro, audio) {
  const marca = livro.id + ':' + JSON.stringify(audio.capMapa || {})
  if (_sincModeloCache.id === marca) return _sincModeloCache.m
  await sincTextosDoLivro(livro)
  const { offsets, total } = _sincTextoCache
  const secoes = [...new Set(Object.values(audio.capMapa || {}).filter(s => s >= 0))]
  let pares = []
  for (const s of secoes) {
    const m = await sincMapaLer(livro.id, s, audio)
    for (const [p, t] of ((m && m.ancoras) || [])) pares.push([offsets[s] + p, t])
  }
  pares.sort((a, b) => a[0] - b[0])
  pares = _sincLIS(pares)           // seções alinhadas fora de ordem não podem torcer a régua
  const caps = audio.capitulos || []
  const duracao = audio.duracao || (caps.length ? caps[caps.length - 1].fim : 0) || 0
  const m = { offsets, total, pares, duracao }
  _sincModeloCache = { id: marca, m }
  return m
}

function _sincEstimarTempo(modelo, gPos) {
  const P = modelo.pares
  if (P.length >= 2) {
    const g0 = P[0], g1 = P[P.length - 1]
    if (gPos >= g0[0] && gPos <= g1[0]) {
      let lo = 0, hi = P.length - 1
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= gPos) lo = m; else hi = m }
      const [p0, t0] = P[lo], [p1, t1] = P[hi]
      return t0 + (t1 - t0) * ((gPos - p0) / Math.max(1, p1 - p0))
    }
    // Fora da régua conhecida: extrapola pela velocidade média já MEDIDA.
    const vel = (g1[0] - g0[0]) / Math.max(30, g1[1] - g0[1])    // palavras por segundo
    const wps = vel > 0.5 ? vel : (modelo.total / Math.max(60, modelo.duracao))
    return gPos < g0[0] ? Math.max(0, g0[1] - (g0[0] - gPos) / wps)
                        : Math.min(modelo.duracao, g1[1] + (gPos - g1[0]) / wps)
  }
  // Nenhuma âncora ainda: proporção honesta. Erra pouco (a narração tem
  // velocidade quase constante) e o primeiro alinhamento corrige.
  return modelo.duracao * (gPos / Math.max(1, modelo.total))
}

// Que capítulo do áudio contém este segundo do arquivo.
function sincCapDoTempo(audio, t) {
  const caps = audio.capitulos || []
  for (let i = 0; i < caps.length; i++) {
    if (t >= (caps[i].ini || 0) && t < (caps[i].fim || Infinity)) return i
  }
  return caps.length ? caps.length - 1 : 0
}

// Escolhe o capítulo do áudio a transcrever para alcançar `gPos` — pulando os
// que já se provaram "fora do livro" (créditos, introdução da gravação).
async function sincEscolherCapAudio(livro, audio, gPos) {
  const caps = audio.capitulos || []
  if (!caps.length) return null
  const modelo = await _sincModelo(livro, audio)
  const t = _sincEstimarTempo(modelo, gPos)
  let cap = sincCapDoTempo(audio, t)
  const mapa = audio.capMapa || {}
  let voltas = 0
  while (mapa[cap] === -1 && cap + 1 < caps.length && voltas++ < caps.length) cap++
  return { cap, t }
}

// ---------------------------------------------------------------
// A OPERAÇÃO COMPLETA — de uma transcrição a um mapa guardado
// ---------------------------------------------------------------
// Alinha TODAS as transcrições de um capítulo do áudio contra o livro.
// Devolve o mapa (da seção onde o áudio CAIU — que pode não ser a que se
// esperava; quem chama decide o que fazer com a resposta).
// Lança com `.fora = true` quando o trecho não existe no texto do livro.
async function sincProcessarCapitulo(livro, audio, capAudio) {
  const trs = (audio.transcricoes || []).filter(x => x.cap === capAudio)
  const segs = trs.slice().sort((a, b) => (a.ini || 0) - (b.ini || 0)).flatMap(t => t.segs || [])
  if (!segs.length) throw new Error('este capítulo ainda não foi transcrito')
  const caps = await sincTextosDoLivro(livro)
  const cap = (audio.capitulos || [])[capAudio] || {}
  const desloc = cap.ini || 0
  const textoTr = segs.map(s => s.t).join(' ')

  const escolha = sincCasarCapitulo(textoTr, caps)
  if (!escolha) {
    // ⚠️ ISTO NÃO É ERRO, É INFORMAÇÃO — e foi exatamente o buraco da rodada
    // 78: o "Chapter 1" do áudio de *Carrie* é "This is Audible" + introdução
    // do autor, que o EPUB não tem. Marcar `-1` faz todo palpite futuro pular
    // este capítulo, e a transcrição paga fica guardada (nada se perde).
    audio.capMapa = { ...(audio.capMapa || {}), [capAudio]: -1 }
    audio.updatedAt = Date.now()
    saveAudiolivros()
    _sincModeloCache = { id: null }
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
    const e = new Error('este trecho do áudio não aparece no texto do livro — deve ser introdução, créditos ou material extra da gravação')
    e.fora = true
    throw e
  }

  const alin = sincAlinhar(caps[escolha.cap], segs, desloc)
  if (!alin) throw new Error('achei a seção do livro, mas o texto e o áudio não alinharam com segurança')

  await _sincSalvarAlinhamento(livro, audio, capAudio, escolha, alin)

  // ⚠️ DERRAME: um capítulo do áudio pode ATRAVESSAR a fronteira entre duas
  // seções do EPUB (a faixa não sabe onde o arquivo XHTML termina). Quando
  // sobra um pedaço grande da transcrição sem âncora numa das pontas, ele é
  // tentado contra a seção vizinha — e vira mapa lá também.
  const tw = _sincPalavrasComTempo(segs)
  try {
    if (alin.jMin / tw.length > 0.25) {
      const viz = _sincVizinho(caps, escolha.cap, -1)
      if (viz >= 0) {
        const corte = tw[alin.jMin].t
        const sub = segs.filter(s => (s.f || 0) <= corte + 1)
        const a2 = sub.length ? sincAlinhar(caps[viz], sub, desloc) : null
        if (a2) await _sincSalvarAlinhamento(livro, audio, capAudio, { cap: viz, nota: escolha.nota }, a2, true)
      }
    }
    if ((tw.length - alin.jMax) / tw.length > 0.25) {
      const viz = _sincVizinho(caps, escolha.cap, +1)
      if (viz >= 0) {
        const corte = tw[alin.jMax].t
        const sub = segs.filter(s => (s.i || 0) >= corte - 1)
        const a2 = sub.length ? sincAlinhar(caps[viz], sub, desloc) : null
        if (a2) await _sincSalvarAlinhamento(livro, audio, capAudio, { cap: viz, nota: escolha.nota }, a2, true)
      }
    }
  } catch (e) { console.warn('[sinc] derrame:', e && e.message) }

  return await sincMapaLer(livro.id, escolha.cap, audio)
}

// A próxima seção com texto de verdade, pulando páginas de abertura.
function _sincVizinho(caps, i, passo) {
  for (let k = i + passo; k >= 0 && k < caps.length; k += passo) {
    if (sincNorm(caps[k]).length >= 200) return k
  }
  return -1
}

async function _sincSalvarAlinhamento(livro, audio, capAudio, escolha, alin, derrame) {
  const novo = {
    v: 2, capLivro: escolha.cap,
    ancoras: alin.ancoras,
    trechos: [{
      cap: capAudio, pos0: alin.pos0, pos1: alin.pos1,
      nota: Math.round((escolha.nota || 0) * 1000) / 1000,
      casadas: alin.casadas,
      cobertura: Math.round(alin.cobertura * 1000) / 1000,
      em: Date.now()
    }],
    palavrasLivro: alin.palavrasLivro,
    em: Date.now()
  }
  const velho = await sincMapaLer(livro.id, escolha.cap, audio)
  const final = velho && (velho.ancoras || []).length ? _sincMesclar(velho, novo) : novo
  await sincMapaGuardar(livro.id, escolha.cap, final)
  if (!derrame) {
    audio.capMapa = { ...(audio.capMapa || {}), [capAudio]: escolha.cap }
    audio.updatedAt = Date.now()
    saveAudiolivros()
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  }
  _sincModeloCache = { id: null }
  _sincCacheAudio = { audioId: null, capAudio: -1, mapa: null, frases: null, cap: null }
}

// Alinha DE GRAÇA tudo o que já foi transcrito e ainda não tem veredito —
// transcrição é a parte cara; nunca se paga de novo pelo que já se tem.
async function _sincAproveitarTranscricoes(livro, audio) {
  const vistos = new Set()
  for (const t of (audio.transcricoes || [])) {
    if (vistos.has(t.cap) || (audio.capMapa || {})[t.cap] != null) continue
    vistos.add(t.cap)
    try { await sincProcessarCapitulo(livro, audio, t.cap) } catch (e) { /* fora do livro já ficou marcado */ }
  }
}

// ---------------------------------------------------------------
// TRANSCREVER O TRECHO CERTO — com o custo na mesa, antes
// ---------------------------------------------------------------
function _sincTempoTxt(s) {
  s = Math.max(0, Math.round(s || 0))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

// O alvo dentro do capítulo: inteiro quando cabe; janela em volta do ponto
// estimado quando o capítulo é gigante (m4b de capítulo único, por exemplo) —
// custo previsível em vez de uma conta de horas.
function _sincAlvo(audio, capAudio, tAlvo) {
  const cap = (audio.capitulos || [])[capAudio] || {}
  const dur = Math.max(0, (cap.fim || 0) - (cap.ini || 0))
  if (dur <= 0) return { ini: 0, fim: 0, inteiro: true, minutos: 10, estimado: true }
  if (dur <= 20 * 60) return { ini: 0, fim: dur, inteiro: true, minutos: dur / 60 }
  const rel = Math.max(0, Math.min(dur, (tAlvo || 0) - (cap.ini || 0)))
  const ini = Math.max(0, rel - 120)
  const fim = Math.min(dur, ini + 15 * 60)
  return { ini, fim, inteiro: false, minutos: (fim - ini) / 60 }
}

async function _sincConfirmarTranscricao(audio, capAudio, tAlvo) {
  const stt = typeof aiSttCfg === 'function' ? aiSttCfg() : null
  if (!stt) {
    toast('Configure a chave da Groq ou da OpenAI para transcrever (Configurações → IA)', 'error')
    return null
  }
  const alvo = _sincAlvo(audio, capAudio, tAlvo)
  const cap = (audio.capitulos || [])[capAudio] || {}
  const nome = cap.titulo || `capítulo ${capAudio + 1}`
  let custo = ''
  try {
    const brl = typeof aiUsdBrl === 'function' ? await aiUsdBrl() : 5.5
    custo = (alvo.minutos * stt.usdMin * brl).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  } catch (e) {}
  const ok = await confirmModal({
    title: 'Transcrever um trecho do áudio', icon: 'sparkles', confirmText: 'Transcrever',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
      Pela minha régua, a voz do narrador passa por este ponto perto de
      <b>${_sincTempoTxt(tAlvo)}</b> do áudio — em <b>${esc(nome)}</b>.
      Para casar o texto com a voz eu transcrevo esse trecho
      (~${Math.max(1, Math.round(alvo.minutos))} min${custo ? `, cerca de <b>${custo}</b>` : ''}).
      É pago uma vez só e vale nos seus dois aparelhos.
      Se o palpite errar por pouco, eu afino — e te pergunto de novo antes de gastar.</p>`
  })
  return ok ? alvo : null
}

async function _sincTranscrever(audio, capAudio, alvo, aoAndar) {
  if (typeof _abTranscreverTrecho !== 'function' && typeof _loadScript === 'function') await _loadScript('js/audiobook.js')
  if (typeof _abTranscreverTrecho !== 'function') throw new Error('não consegui carregar a transcrição')
  await _abTranscreverTrecho(audio, capAudio, alvo, aoAndar)
}

// ---------------------------------------------------------------
// GARANTIR MAPA para um ponto do livro — o coração do "ouvir daqui"
// ---------------------------------------------------------------
// ⚠️ A V1 recebia só a seção e adivinhava o capítulo do áudio PELA ORDEM. A
// v2 recebe também a POSIÇÃO dentro da seção — porque numa seção de 30 mil
// palavras (3h30 de narração) saber a seção não diz quase nada.
// O laço se corrige sozinho: cada alinhamento diz onde o áudio caiu, o
// modelo fica mais esperto, o próximo palpite acerta. No máximo duas
// transcrições pagas por chamada — cada uma com o custo confirmado antes.
async function sincPrepararCapitulo(livro, audio, capLivro, posDentro) {
  posDentro = Math.max(0, posDentro || 0)
  let mapa = await sincMapaLer(livro.id, capLivro, audio)
  if (_sincCobre(mapa, posDentro)) return mapa

  await sincTextosDoLivro(livro)
  await _sincAproveitarTranscricoes(livro, audio)
  mapa = await sincMapaLer(livro.id, capLivro, audio)
  if (_sincCobre(mapa, posDentro)) return mapa

  const tentados = new Set()
  let pagas = 0
  while (pagas < 2) {
    const gPos = _sincTextoCache.offsets[capLivro] + posDentro
    const esc = await sincEscolherCapAudio(livro, audio, gPos)
    if (!esc || tentados.has(esc.cap)) break
    tentados.add(esc.cap)

    if (!(audio.transcricoes || []).some(x => x.cap === esc.cap)) {
      const alvo = await _sincConfirmarTranscricao(audio, esc.cap, esc.t)
      if (!alvo) return null
      _sincBarraMsg('Transcrevendo o trecho…')
      await _sincTranscrever(audio, esc.cap, alvo, m => _sincBarraMsg(m))
      pagas++
    }
    _sincBarraMsg('Casando o texto com a voz…')
    try { await sincProcessarCapitulo(livro, audio, esc.cap) }
    catch (e) {
      if (e && e.fora) { toast(String(e.message), 'info'); continue }
      throw e
    }
    mapa = await sincMapaLer(livro.id, capLivro, audio)
    if (_sincCobre(mapa, posDentro)) return mapa
  }

  if (mapa && (mapa.ancoras || []).length) {
    toast('O áudio transcrito caiu perto, mas ainda não cobre este ponto — toque de novo para eu continuar procurando.', 'warning')
  } else {
    toast('Não consegui casar este ponto do livro com o áudio.', 'warning')
  }
  return null
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
let _sincBorda = false          // já avisei que o trecho sincronizado acabou?

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
    // estar compondo quadros. `scrollTo` com `behavior` explícito vence o CSS.
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

// Qual frase está tocando neste instante (tempo ABSOLUTO do arquivo)
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
// começou a rodar"*. Para quem ouve, existe uma narração só. O leitor pilota o
// mesmo `#ab-audio` do reprodutor, pelo caminho normal dele.
// ⚠️ V2: os tempos do mapa são ABSOLUTOS no arquivo — a mesma régua do
// `<audio>`. As conversões relativas da v1 (que já causaram pulo de horas num
// m4b) deixaram de existir: `el.currentTime` conversa direto com o mapa.
function _sincAudio() { return document.getElementById('ab-audio') }

let _sincLigadoNoAudio = false
function _sincLigarEventos(el) {
  if (!el || _sincLigadoNoAudio) return
  _sincLigadoNoAudio = true
  el.addEventListener('timeupdate', () => {
    if (!_sincOn || !_sincMapa) return
    const A = _sincMapa.ancoras || []
    // A voz passou do fim do trecho já casado: em vez de deixar o realce
    // congelar mudo na última frase, a barra oferece continuar.
    if (A.length && el.currentTime > A[A.length - 1][1] + 6) {
      if (!_sincBorda) { _sincBorda = true; _sincPintarBarra() }
      return
    }
    if (_sincBorda) { _sincBorda = false; _sincPintarBarra() }
    const ix = _sincFraseDoTempo(el.currentTime)
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
    _sincBarraMsg('Procurando a voz do narrador neste ponto…')
    _sincFrases = sincIndexarFrases()
    if (!_sincFrases) { _sincBarraFechar(); toast('Não consegui ler as frases desta página.', 'error'); return }
    // Começa de onde ele está LENDO — é isso que "ouvir daqui" quer dizer.
    // ⚠️ E a posição entra ANTES do preparo (v2): é ela que diz qual trecho
    // do áudio procurar dentro de uma seção de horas.
    const pos = _sincPosicaoVisivel()
    const mapa = await sincPrepararCapitulo(_lerLivro, audio, _lerCap, pos)
    if (!mapa) { _sincBarraFechar(); return }
    _sincOn = true
    _sincBorda = false
    _sincCapLivro = _lerCap
    _sincMapa = mapa
    _sincAtual = -1
    document.getElementById('ler-conteudo')?.addEventListener('click', sincCliqueNoTexto)
    document.getElementById('ler-btn-ouvir')?.classList.add('on')
    _sincPintarBarra()
    const t = sincTempoDe(mapa, pos)
    const { el } = await _sincCarregarAudio(audio, sincCapDoTempo(audio, t || 0))
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
  const _el = _sincAudio(); if (_el) _el.pause()
  _sincLimparRealce()
  _sincFrases = null; _sincAtual = -1; _sincBorda = false
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

// A voz chegou ao fim do que já foi casado — transcrever o que vem em
// seguida e continuar, do jeito que o Whispersync nunca deixa o leitor ver a
// emenda. Se o próximo trecho cair em OUTRA seção do livro (a narração cruzou
// de "Part One" para "Part Two"), o leitor vira junto.
async function sincContinuar() {
  if (!_lerLivro) return
  const audio = sincAudioDoLivro(_lerLivro)
  const el = _sincAudio()
  if (!audio || !el || !_sincMapa) return
  try {
    const t = el.currentTime + 2
    let cap = sincCapDoTempo(audio, t)
    const mapa = audio.capMapa || {}
    while (mapa[cap] === -1 && cap + 1 < (audio.capitulos || []).length) cap++
    if (!(audio.transcricoes || []).some(x => x.cap === cap)) {
      const alvo = await _sincConfirmarTranscricao(audio, cap, t)
      if (!alvo) return
      _sincBarraMsg('Transcrevendo o trecho…')
      await _sincTranscrever(audio, cap, alvo, m => _sincBarraMsg(m))
    }
    _sincBarraMsg('Casando o texto com a voz…')
    const novo = await sincProcessarCapitulo(_lerLivro, audio, cap)
    if (novo && novo.capLivro === _sincCapLivro) {
      _sincMapa = novo
      _sincBorda = false
      _sincAtual = -1
      _sincPintarBarra()
    } else if (novo && typeof lerIrParaCapitulo === 'function') {
      // A narração entrou na próxima seção do livro: o leitor acompanha.
      await lerIrParaCapitulo(novo.capLivro, 0)
    }
  } catch (e) {
    _sincBorda = false
    _sincPintarBarra()
    toast(String(e.message || e), 'error')
  }
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
  _sincLimparRealce(); _sincAtual = -1; _sincBorda = false
  try {
    _sincBarraMsg('Procurando este capítulo no audiolivro…')
    const mapa = await sincPrepararCapitulo(_lerLivro, audio, capLivro, 0)
    if (!mapa) return sincLeitorSair()
    _sincCapLivro = capLivro
    _sincMapa = mapa
    _sincFrases = sincIndexarFrases()
    const t = sincTempoDe(mapa, 0)
    const { el } = await _sincCarregarAudio(audio, sincCapDoTempo(audio, t || 0))
    if (t != null) el.currentTime = t
    _sincPintarBarra()
  } catch (e) {
    toast(String(e.message || e), 'error')
    sincLeitorSair()
  }
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
  if (_sincBorda) {
    b.innerHTML = `
      <span class="sinc-frase">${ic('sparkles','ic-sm')} O trecho sincronizado terminou</span>
      <button class="sinc-b sinc-play" onclick="sincContinuar()" data-tip="Transcrever o que vem agora e seguir acompanhando">
        ${ic('chevronRight','ic-sm')}</button>
      <button class="sinc-b" onclick="sincLeitorSair()" data-tip="Sair do modo ouvir junto">${ic('x','ic-sm')}</button>`
    return
  }
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
  if (t != null) { el.currentTime = t; _sincPintarFrase(ix) }
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
          el.currentTime = t
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
// **autor** escreveu, com o áudio do narrador dizendo aquilo.
// O cache existe porque quem pergunta é código SÍNCRONO (a lista de
// marcadores, a captura), e ler o mapa é assíncrono.
let _sincCacheAudio = { audioId: null, capAudio: -1, mapa: null, frases: null, cap: null }

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
    _sincCacheAudio = { audioId: audio.id, capAudio, mapa: null, frases: null, cap: null }
    const livro = sincLivroDoAudio(audio)
    if (!livro) return false
    const capLivro = (audio.capMapa || {})[capAudio]
    if (capLivro == null || capLivro < 0) return false
    const mapa = await sincMapaLer(livro.id, capLivro, audio)
    if (!mapa || !(mapa.ancoras || []).length) return false
    const textos = await sincTextosDoLivro(livro)
    _sincCacheAudio = {
      audioId: audio.id, capAudio, mapa,
      frases: _sincFrasesDoTexto(textos[capLivro]),
      cap: (audio.capitulos || [])[capAudio] || null
    }
    return true
  } catch (e) { return false }
}

// ---------------------------------------------------------------
// O TEXTO DO LIVRO NO FORMATO DAS FALAS
// ---------------------------------------------------------------
// ⚠️ ESTA É A PEÇA QUE ELE PEDIU DEPOIS DE VER A PRIMEIRA VERSÃO: *"o que eu
// queria era que o texto do livro viesse pra cá"*. Devolvendo as frases no
// MESMO formato das falas transcritas (`{i, f, t}`, em segundos relativos ao
// capítulo), a aba de texto do reprodutor mostra o autor sem que nada mude.
// ⚠️ V2: o mapa da seção cobre HORAS de áudio; aqui sai só a fatia deste
// capítulo do áudio — senão a aba mostraria "Part One" inteira com milhares
// de frases fora do relógio da faixa.
function sincFalasDoLivro(audio, capAudio) {
  const c = _sincCacheAudio
  if (!c.mapa || !c.frases || c.audioId !== (audio && audio.id) || c.capAudio !== capAudio) return null
  const cap = c.cap || {}
  const ini = cap.ini || 0
  const fim = cap.fim || Infinity
  const A = c.mapa.ancoras || []
  if (!A.length) return null
  const out = []
  for (let k = 0; k < c.frases.length; k++) {
    const f = c.frases[k], prox = c.frases[k + 1]
    // Só frases dentro da faixa coberta pelas âncoras (a borda clampada
    // empilharia dezenas de frases no mesmo instante).
    if (f.pos < A[0][0] - 30 || f.pos > A[A.length - 1][0] + 30) continue
    const i = sincTempoDe(c.mapa, f.pos)
    if (i == null || i < ini - 2 || i > fim + 2) continue
    const ff = prox ? sincTempoDe(c.mapa, prox.pos) : A[A.length - 1][1]
    out.push({ i: Math.max(0, i - ini), f: Math.max(i - ini + 0.3, (ff == null ? i + 3 : ff) - ini), t: f.texto })
  }
  return out.length ? out : null
}

// Síncrona de propósito — ver o comentário do cache acima. `seg` chega
// RELATIVO ao capítulo (é a régua dos marcadores e das falas transcritas).
function sincFraseDoInstante(audio, capAudio, seg) {
  const c = _sincCacheAudio
  if (!c.mapa || !c.frases || c.audioId !== (audio && audio.id) || c.capAudio !== capAudio) return ''
  const abs = (Number(seg) || 0) + ((c.cap && c.cap.ini) || 0)
  const pos = sincPosicaoDe(c.mapa, abs)
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
    const ja = (audio.capMapa || {})[capAudio]
    if (ja === -1) {
      toast('Este trecho do áudio não está no texto do livro — deve ser introdução ou créditos da gravação.', 'info')
      return
    }
    if (ja == null) {
      toast('Procurando este trecho dentro do livro…', 'info')
      await sincTextosDoLivro(livro)
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
        await _sincTranscrever(audio, capAudio, _sincAlvo(audio, capAudio, ((audio.capitulos || [])[capAudio] || {}).ini || 0),
          m => { const b = el('ab-aba'); if (b) b.innerHTML = `<div class="est-nada"><p>${esc(m)}</p></div>` })
      }
      await sincProcessarCapitulo(livro, audio, capAudio)
    }
    const ok = await sincPrepararParaAudio(audio, capAudio)
    if (!ok) { toast('Não consegui casar este capítulo com o livro.', 'warning'); return }
    if (typeof abAba === 'function') abAba('texto')
    toast('Este é o texto do autor — a frase acende conforme ele lê', 'success')
  } catch (e) {
    if (e && e.fora && typeof abAba === 'function') abAba('texto')
    toast(String(e.message || e), e && e.fora ? 'info' : 'error')
  }
}

// ⚠️ "ABRIR NO LEITOR" NÃO É ABRIR NO COMEÇO. Quem está no minuto 12 quer o
// parágrafo do minuto 12 — abrir na primeira página devolveria o trabalho de
// procurar, que é o que esta peça existe para evitar.
// `seg` aqui é o relógio do `<audio>` — ABSOLUTO no arquivo, a mesma régua
// das âncoras v2.
async function sincAbrirNoLeitor(audio, capAudio, seg) {
  if (!audio) return
  const livro = sincLivroDoAudio(audio)
  if (!livro) return sincLigarModalAudio(audio)
  try {
    let capLivro = (audio.capMapa || {})[capAudio]
    if (capLivro === -1) {
      toast('Este trecho do áudio não está no texto do livro — vou abrir no começo.', 'info')
      capLivro = null
    }
    if (capLivro == null) { await sincTextoAqui(audio, capAudio); capLivro = (audio.capMapa || {})[capAudio] }
    if (capLivro == null || capLivro < 0) return
    const mapa = await sincMapaLer(livro.id, capLivro, audio)
    const textos = await sincTextosDoLivro(livro)
    const total = Math.max(1, sincNorm(textos[capLivro]).length)
    const pos = mapa ? sincPosicaoDe(mapa, seg) : 0
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
