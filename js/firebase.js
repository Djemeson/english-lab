// ================================================================
// CLOUD SYNC — GITHUB GIST
// ================================================================
const GIST_FILENAME       = 'english-lab-srs.json'
const GIST_AUDIO_FILENAME = 'english-lab-audio.json'
const GIST_IMAGE_FILENAME = 'english-lab-images.json'

function updateSyncNav(state) {
  const ind = el('sync-indicator')
  const dot = el('sync-dot')
  const lbl = el('sync-label')
  const indMob = el('sync-indicator-mob')
  const dotMob = el('sync-dot-mob')
  if (!ind) return
  if (state === 'off') {
    ind.classList.add('hidden')
    if (indMob) indMob.classList.add('hidden')
    return
  }
  ind.classList.remove('hidden')
  if (indMob) indMob.classList.remove('hidden')
  const dotClass = 'sync-dot' + (state === 'ok' ? ' ok' : state === 'err' ? ' err' : state === 'syncing' ? ' syncing' : '')
  dot.className = dotClass
  if (dotMob) dotMob.className = dotClass
  lbl.textContent = state === 'ok' ? 'Nuvem' : state === 'err' ? 'Sync erro' : 'Sincronizando...'
}


// ================================================================
// FIREBASE SYNC — Firestore + Google Auth
// ================================================================
const FB_CONFIG = {
  apiKey: "AIzaSyCwMSwO27_UKQiOhnvhxvTQ7-ykD31mLEw",
  authDomain: "english-lab-726e7.firebaseapp.com",
  projectId: "english-lab-726e7",
  storageBucket: "english-lab-726e7.firebasestorage.app",
  messagingSenderId: "181422619156",
  appId: "1:181422619156:web:7bb0bedbe6dd106dfe4501"
}

let _fbApp = null, _fbDb = null, _fbAuth = null, _fbUser = null
let _fbStore = null
let _fbSyncTimer = null
let _fbAudioSyncTimer = null

// ================================================================
// MÍDIA NO STORAGE — áudio e imagem saíram de dentro do banco
// ================================================================
// Eles moravam em `collection('audio')` e `collection('images')`, com o base64
// no campo `data`. O Firestore tem teto de 1 MB POR DOCUMENTO e cobra por
// operação: um áudio um pouco maior simplesmente não subia, e cada sincronização
// relia tudo. O Storage é o lugar de arquivo — e a cota gratuita cobre folgado
// o acervo dele.
//
// ⚠️ O CAMINHO PRECISA CASAR COM A REGRA DE SEGURANÇA, que é
// `users/{uid}/{resto}` e compara `uid` com quem está logado. Fugir daí é
// levar "permission denied" sem explicação.
//
// A chave é o nome do arquivo, e ela vem de texto livre (o áudio é indexado
// pela frase). `encodeURIComponent` evita que uma barra no meio da frase vire
// pasta e que caractere estranho quebre o caminho.
function _mediaRef(tipo, key) {
  if (!_fbStore || !_fbUser) return null
  return _fbStore.ref(`users/${_fbUser.uid}/${tipo}/${encodeURIComponent(key)}`)
}

async function mediaSubir(tipo, key, dataUrl) {
  const r = _mediaRef(tipo, key)
  if (!r || !dataUrl) return false
  await r.putString(String(dataUrl), 'data_url')
  return true
}

// Devolve `{ chave: dataUrl }`. Baixa em paralelo com teto, porque o acervo
// dele já tem centenas de áudios e disparar tudo de uma vez trava o navegador.
async function mediaBaixarTodos(tipo, aoAndar) {
  if (!_fbStore || !_fbUser) return {}
  const pasta = _fbStore.ref(`users/${_fbUser.uid}/${tipo}`)
  let itens = []
  try { itens = (await pasta.listAll()).items } catch (e) { return {} }
  const saida = {}
  let feitos = 0
  const fila = [...itens]
  const trabalhador = async () => {
    while (fila.length) {
      const it = fila.shift()
      try {
        const url = await it.getDownloadURL()
        const blob = await (await fetch(url)).blob()
        saida[decodeURIComponent(it.name)] = await new Promise(res => {
          const fr = new FileReader(); fr.onloadend = () => res(fr.result); fr.readAsDataURL(blob)
        })
      } catch (e) { /* um arquivo perdido não derruba o resto */ }
      if (aoAndar) aoAndar(++feitos, itens.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, itens.length) }, trabalhador))
  return saida
}

// ================================================================
// O ARQUIVO DO LIVRO NA NUVEM
// ================================================================
// O EPUB morava só no IndexedDB do aparelho onde foi aberto: trocar de máquina
// ou limpar o navegador matava a memória da obra, e ela nem explicava por quê.
// Não subia junto com o resto porque o Firestore tem teto de 1 MB por documento
// e um livro tem megabytes — agora tem lugar próprio.
//
// ⚠️ Mora aqui, no SHELL, e não em `ler.js`: quem precisa do arquivo é o leitor
// (lazy) E a memória da obra, que o Estudar também usa. Símbolo de arquivo lazy
// chamado do shell é a armadilha nº 1 deste projeto.
function _livroRef(id) {
  if (!_fbStore || !_fbUser) return null
  return _fbStore.ref(`users/${_fbUser.uid}/livros/${encodeURIComponent(id)}`)
}

async function livroNaNuvem(id) {
  const r = _livroRef(id); if (!r) return false
  try { await r.getMetadata(); return true } catch (e) { return false }
}

// Sobe só se ainda não estiver lá. Silencioso de propósito: é conveniência de
// fundo, e um erro aqui não pode atrapalhar quem só quer ler o livro.
async function livroGarantirNaNuvem(id) {
  try {
    const r = _livroRef(id); if (!r) return false
    if (await livroNaNuvem(id)) return true
    const blob = await BookDB.get(id)
    if (!blob) return false
    await r.put(blob)
    console.log(`[Firebase] livro ${id} guardado na nuvem (${Math.round(blob.size / 1048576 * 10) / 10} MB)`)
    return true
  } catch (e) {
    console.warn('[Firebase] livro não subiu:', e.code || e.message)
    return false
  }
}

// Traz de volta quando o arquivo não está NESTE aparelho. Devolve o blob (já
// gravado no IndexedDB) ou null — quem chama decide o que dizer ao usuário.
async function livroGarantirLocal(id, aoAndar) {
  try {
    const jaTem = await BookDB.get(id)
    if (jaTem) return jaTem
    const r = _livroRef(id); if (!r) return null
    if (aoAndar) aoAndar('procurando na nuvem')
    const url = await r.getDownloadURL()
    if (aoAndar) aoAndar('baixando o livro')
    const blob = await (await fetch(url)).blob()
    await BookDB.set(id, blob)
    return blob
  } catch (e) { return null }
}

async function livroApagarDaNuvem(id) {
  try { const r = _livroRef(id); if (r) await r.delete() } catch (e) {}
}

// ================================================================
// O ÁUDIO DO AUDIOLIVRO NA NUVEM
// ================================================================
// Até aqui o áudio ficava só no aparelho, e o app dizia isso na cara: *"Audiolivro
// não sobe para a nuvem (são centenas de MB)"*. Ele pediu o contrário, e com
// motivo: *"quero ter a capacidade de ouvir tanto no desktop quanto no celular
// com todo material gerado"*. Transcrição, marcadores e análise já atravessavam;
// só o áudio não, e sem ele o resto não serve para nada no outro aparelho.
//
// ⚠️ ESTE É O ARQUIVO MAIS PESADO DO APP — de 100 MB a 1 GB, contra 4 MB de um
// EPUB. Por isso NADA aqui é automático: o EPUB sobe sozinho porque cabe; o
// audiolivro só sobe quando ele mandar, e a subida mostra byte a byte o que está
// acontecendo, com botão de cancelar. Subir 700 MB sem avisar seria queimar a
// franquia de dados do celular dele em segundo plano.
//
// Um audiolivro pode ser UM `.m4b` ou 40 faixas: cada arquivo tem seu lugar
// (`.../audiolivros/<id>/<n>`), e cada um sobe e desce sozinho. Assim, trocar de
// aparelho no meio do capítulo 12 baixa a faixa 12, não o livro inteiro.
function _abNuvemRef(id, n) {
  if (!_fbStore || !_fbUser) return null
  return _fbStore.ref(`users/${_fbUser.uid}/audiolivros/${encodeURIComponent(id)}/${n}`)
}

// O que já está lá, sem baixar nada. Uma listagem só, em vez de N perguntas:
// um livro em 40 faixas daria 40 idas à rede antes de mostrar a estante.
async function abNuvemListar(id) {
  const mapa = {}
  try {
    if (!_fbStore || !_fbUser) return mapa
    const pasta = _fbStore.ref(`users/${_fbUser.uid}/audiolivros/${encodeURIComponent(id)}`)
    const r = await pasta.listAll()
    for (const item of (r.items || [])) {
      const n = Number(item.name)
      if (!Number.isFinite(n)) continue
      try { const m = await item.getMetadata(); mapa[n] = Number(m.size) || 0 }
      catch (e) { mapa[n] = 0 }
    }
  } catch (e) { console.warn('[Firebase] audiolivro, listagem:', e.code || e.message) }
  return mapa
}

// A subida, com progresso e cancelamento. Uma de cada vez, de propósito: seis
// arquivos de 30 MB em paralelo entopem a subida de quem está de 4G e fazem a
// barra andar em pulos.
let _abNuvemTask = null
function abNuvemSubindo() { return !!_abNuvemTask }
function abNuvemCancelar() { try { _abNuvemTask && _abNuvemTask.cancel() } catch (e) {} }

function abNuvemSubirArquivo(id, n, blob, aoAndar) {
  return new Promise((res, rej) => {
    const r = _abNuvemRef(id, n)
    if (!r) return rej(new Error('sem-login'))
    const task = r.put(blob, { contentType: blob.type || 'audio/mpeg' })
    _abNuvemTask = task
    task.on('state_changed',
      st => { if (aoAndar) aoAndar(st.bytesTransferred, st.totalBytes) },
      e => { _abNuvemTask = null; rej(e) },
      () => { _abNuvemTask = null; res(true) })
  })
}

// A descida também precisa de barra: 40 MB numa rede ruim são dois minutos de
// tela parada, e tela parada parece travamento. `Content-Length` vem no
// cabeçalho do Storage, então dá para contar de verdade em vez de fingir.
async function abNuvemBaixarArquivo(id, n, aoAndar) {
  const r = _abNuvemRef(id, n)
  if (!r) throw new Error('sem-login')
  const url = await r.getDownloadURL()
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('download ' + resp.status)
  const total = Number(resp.headers.get('content-length')) || 0
  const tipo = resp.headers.get('content-type') || 'audio/mpeg'
  if (!resp.body || !aoAndar) return await resp.blob()
  const leitor = resp.body.getReader()
  const partes = []
  let lidos = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    partes.push(value); lidos += value.length
    aoAndar(lidos, total)
  }
  return new Blob(partes, { type: tipo })
}

async function abNuvemApagar(id, arquivos) {
  let n = 0
  for (let i = 0; i < Math.max(1, arquivos || 1); i++) {
    try { const r = _abNuvemRef(id, i); if (r) { await r.delete(); n++ } } catch (e) {}
  }
  return n
}

// Qual dos dois registros de subida sabe mais. Empate de partes desempata pela
// data: o mais novo viu o estado mais recente.
function _abNuvemMaisCompleta(a, b) {
  if (!a) return b || null
  if (!b) return a
  const na = Object.keys(a.partes || {}).length, nb = Object.keys(b.partes || {}).length
  if (na !== nb) return na > nb ? a : b
  return (a.em || 0) >= (b.em || 0) ? a : b
}

async function abNuvemPorQueNaoVeio(id, n) {
  return nuvemDiagnostico(_abNuvemRef(id, n || 0))
}

// ================================================================
// O QUE A IA GEROU VIAJA COM ELE
// ================================================================
// ⚠️ ELE PAGOU UMA ANÁLISE NO TELEFONE E ELA NÃO EXISTIA NO COMPUTADOR, e o
// pedido que veio em seguida foi maior que o caso: *"do desktop também deve ir
// pro telefone. Todo material gerado precisa ir pra todos os aparelhos."*
//
// A varredura achou TRÊS coisas presas no `BookDB` de um aparelho só, todas
// pagas com chamada de IA:
//
//   raiox:<livro>:<cap>   o raio-X do capítulo
//   pre:<livro>:<cap>     o pré-estudo (o próprio código dizia "o trabalho foi
//                         pago, guardar é o mínimo" — e guardava só aqui)
//   quebra:<lang>:<hash>  a quebra de trecho do Preparar
//
// E uma paga com trabalho MANUAL dele, que dói igual perder:
//
//   niv:<livro>:<cap> / nivmarca:…   a triagem de nível, palavra por palavra
//
// O audiolivro já atravessava (os achados moram dentro de `audiolivros`, que
// sincroniza) — duas telas irmãs com comportamentos opostos, que é o pior tipo
// de inconsistência: a que ensina uma regra errada.
//
// UMA PEÇA SÓ, e não uma função por tipo. A chave local já identifica o item
// com precisão; ela vira o nome do documento, e o resto é o mesmo desenho para
// todos.
//
// ⚠️ SOB DEMANDA, E NÃO NO SYNC GERAL. São 35 capítulos por livro vezes quatro
// tipos: arrastar tudo a cada sincronização encareceria a abertura do app para
// pagar por algo que só interessa ao capítulo aberto. Mesmo desenho do arquivo
// do livro — sobe quando termina, desce quando falta.
function _geradoId(chave) {
  // Id de documento não aceita `/`; o resto vai junto para a chave continuar
  // legível no console. `:` é permitido e é o que as nossas chaves usam.
  return String(chave).replace(/[\/\\.#$\[\]]/g, '_').slice(0, 1400)
}

function _geradoRef(chave) {
  if (!_fbDb || !_fbUser || !chave) return null
  return _fbDb.collection('users').doc(_fbUser.uid).collection('gerado').doc(_geradoId(chave))
}

// `marcas` é o que permite achar depois sem baixar tudo: {tipo, livroId, cap}.
async function geradoSubir(chave, valor, marcas) {
  try {
    const r = _geradoRef(chave); if (!r || valor == null) return false
    const texto = typeof valor === 'string' ? valor
      : (valor instanceof Blob) ? await valor.text() : JSON.stringify(valor)
    // ⚠️ Teto de 1 MB por documento no Firestore. Um pré-estudo de capítulo
    // gigante pode chegar perto; melhor não subir do que derrubar o sync
    // inteiro com um erro no meio do lote.
    if (texto.length > 900000) {
      console.warn('[Firebase] gerado grande demais para a nuvem:', chave, texto.length)
      return false
    }
    await r.set({ chave: String(chave), texto, ...(marcas || {}), updatedAt: Date.now() })
    return true
  } catch (e) { console.warn('[Firebase] gerado não subiu:', e.code || e.message); return false }
}

async function geradoBaixar(chave) {
  try {
    const r = _geradoRef(chave); if (!r) return null
    const d = await r.get()
    if (!d.exists) return null
    const v = d.data() || {}
    return typeof v.texto === 'string' ? v.texto : null
  } catch (e) { return null }
}

// Que capítulos deste livro já têm material deste tipo, em QUALQUER aparelho.
// É o que o painel do raio-X precisa para pôr a marca ✦ — sem isto, capítulo
// analisado no telefone aparecia como "analisar" no computador, e o clique
// cobraria a análise de novo.
async function geradoDoLivro(livroId, tipo) {
  const mapa = {}
  try {
    if (!_fbDb || !_fbUser) return mapa
    let q = _fbDb.collection('users').doc(_fbUser.uid).collection('gerado')
                 .where('livroId', '==', String(livroId))
    if (tipo) q = q.where('tipo', '==', tipo)
    const r = await q.get()
    r.forEach(d => {
      const v = d.data() || {}
      if (v.cap != null) mapa[Number(v.cap)] = v.n != null ? v.n : true
    })
  } catch (e) { console.warn('[Firebase] gerado, listagem:', e.code || e.message) }
  return mapa
}

async function geradoApagar(chave) {
  try { const r = _geradoRef(chave); if (r) await r.delete() } catch (e) {}
}

// ================================================================
// QUAL DAS DUAS VERSÕES VALE
// ================================================================
// ⚠️ ATÉ AQUI A REGRA ERA "O LOCAL VENCE, SEMPRE" — e era ela que mantinha uma
// análise no telefone e outra no navegador, cada aparelho lendo a própria
// cópia para sempre. A regra parecia inofensiva porque material gerado parecia
// estado; ele é ACERVO: custou dinheiro, acumula, e nunca deveria regredir.
//
// A ordem abaixo é a de quem paga a conta:
//   1. **veio inteira** ganha de veio pela metade — três blocos que falharam
//      não viram uma análise melhor por serem mais recentes;
//   2. **o nível de hoje** ganha do nível de ontem — análise feita para B1 não
//      serve a quem já está em B2;
//   3. **o modelo mais forte** ganha — foi o que ele pediu com todas as
//      letras, e é o que separava as duas versões dele (GPT-5.6 Luna contra
//      Gemini Flash-Lite);
//   4. mais itens, e por fim mais recente, só como desempate.
//
// ⚠️ MATERIAL SEM FICHA (feito antes desta versão) NÃO É TRATADO COMO RUIM. Ele
// entra com força desconhecida e perde apenas para quem tem ficha comprovada —
// senão a primeira análise feita com modelo pequeno derrubaria o acervo antigo
// inteiro, que é o oposto do que se quer.
// ================================================================
// UNIR O QUE FOI PAGO — transcrições e marcadores do audiolivro
// ================================================================
// ⚠️ A CHAVE DE UMA TRANSCRIÇÃO É `cap` + `ini`: o app permite transcrever uma
// JANELA dentro do capítulo (dez minutos em volta de onde ele está), então o
// mesmo capítulo pode ter mais de um pedaço, e cada pedaço é um trabalho pago
// à parte.
function _trChave(t) { return `${t.cap}|${Math.round(Number(t.ini) || 0)}` }

// Entre duas versões do MESMO pedaço, fica a mais completa: mais falas ganha;
// com as falas empatadas, quem tem análise ganha de quem não tem; com as duas
// analisadas, decide a ficha (modelo mais forte, análise inteira).
function _trMelhor(a, b) {
  if (!a) return b
  if (!b) return a
  // ⚠️ ESCOLHA HUMANA PRIMEIRO, igual ao material do leitor (§8.96). Aqui ela
  // vale ainda mais: a comparação automática usa "mais falas", e uma
  // transcrição pode ter mais falas por estar picotada, não por ser melhor.
  // Entre dois carimbos, o mais recente — ele mudou de ideia.
  const xa = Number(a.fixadoEm) || 0, xb = Number(b.fixadoEm) || 0
  if (xa !== xb) return xa > xb ? a : b
  const fa = (a.segs || []).length, fb = (b.segs || []).length
  if (fa !== fb) return fa > fb ? a : b
  const aa = (a.achados || []).length, ab = (b.achados || []).length
  if (!!aa !== !!ab) return aa ? a : b
  if (aa && ab) {
    const A = a.achadosFicha || {}, B = b.achadosFicha || {}
    if (!!A.falhas !== !!B.falhas) return A.falhas ? b : a
    if ((A.forca || 0) !== (B.forca || 0)) return (A.forca || 0) > (B.forca || 0) ? a : b
    if (aa !== ab) return aa > ab ? a : b
  }
  return (a.at || 0) >= (b.at || 0) ? a : b
}

function _unirTranscricoes(locais, remotas) {
  const A = Array.isArray(locais) ? locais : []
  const B = Array.isArray(remotas) ? remotas : []
  if (!A.length && !B.length) return null
  const mapa = new Map()
  for (const t of [...B, ...A]) {
    if (!t || t.cap == null) continue
    const k = _trChave(t)
    mapa.set(k, _trMelhor(mapa.get(k), t))
  }
  return [...mapa.values()].sort((x, y) => (x.cap - y.cap) || (x.ini - y.ini))
}

// Marcador é gesto humano: some só quando ELE apaga, e a marca de remoção é
// quem carrega isso — aqui, união pura.
function _unirMarcadores(locais, remotos) {
  const A = Array.isArray(locais) ? locais : []
  const B = Array.isArray(remotos) ? remotos : []
  if (!A.length && !B.length) return null
  const mapa = new Map()
  for (const m of [...B, ...A]) {
    if (!m || m.cap == null) continue
    const k = `${m.cap}|${Math.round(Number(m.seg) || 0)}`
    const ja = mapa.get(k)
    // Entre dois iguais, fica o que tem nota escrita — e, em empate, o mais novo.
    if (!ja || (!ja.nota && m.nota) || (m.at || 0) > (ja.at || 0)) mapa.set(k, m)
  }
  return [...mapa.values()].sort((x, y) => (x.cap - y.cap) || (x.seg - y.seg))
}

function _geradoPacote(bruto) {
  try {
    const o = typeof bruto === 'string' ? JSON.parse(bruto) : bruto
    if (!o || typeof o !== 'object') return null
    return o
  } catch (e) { return null }
}

function geradoNota(bruto, nivelHoje) {
  const p = _geradoPacote(bruto)
  if (!p) return null
  const f = p.ficha || {}
  // ⚠️ CADA MATERIAL CHAMA A SUA LISTA DE UM JEITO — `itens` no raio-X e no
  // pré-estudo, `items` na quebra de frase, `ancoras` no mapa de sincronia.
  // Contar só `itens` faria os outros três empatarem em zero e o desempate
  // cair inteiro na data, que é justamente o critério mais fraco.
  const lista = [p.itens, p.items, p.ancoras, Array.isArray(p) ? p : null].find(Array.isArray)
  const itens = lista ? lista.length : 0
  return {
    temFicha: !!p.ficha,
    fixado: Number(f.fixadoEm) || 0,       // quando ELE escolheu esta à mão
    inteira: f.falhas ? 0 : 1,
    nivelOk: nivelHoje && p.nivel ? (p.nivel === nivelHoje ? 1 : 0) : 1,
    forca: f.forca || 0,
    itens,
    at: p.at || f.at || 0,
    prov: f.prov || '', modelo: f.modelo || ''
  }
}

// Devolve 1 se A é melhor, -1 se B é melhor, 0 se empatam.
function geradoComparar(a, b, nivelHoje) {
  const A = geradoNota(a, nivelHoje), B = geradoNota(b, nivelHoje)
  if (!A) return B ? -1 : 0
  if (!B) return 1
  // ⚠️ ESCOLHA HUMANA VENCE HEURÍSTICA, e vem antes de tudo. Entre duas
  // análises antigas (sem ficha) o desempate cairia em "mais itens" — e mais
  // itens não é sinônimo de melhor: um modelo tagarela devolve quarenta
  // apontamentos ruins e ganha de quinze bons. Quando ele olha as duas e
  // aponta a que presta, nenhuma regra automática tem o direito de discordar.
  // Entre duas escolhas humanas, a mais recente — ele mudou de ideia.
  if (A.fixado !== B.fixado) return A.fixado > B.fixado ? 1 : -1
  // A força só entra quando os DOIS têm ficha. Sem esta guarda, o material
  // antigo (força 0, porque nasceu antes) perderia de qualquer análise nova,
  // inclusive de uma feita com o modelo mais fraco da casa.
  const comparaForca = A.temFicha && B.temFicha
  const ordem = [
    [A.inteira, B.inteira],
    [A.nivelOk, B.nivelOk],
    ...(comparaForca ? [[A.forca, B.forca]] : []),
    [A.itens, B.itens],
    [A.at, B.at]
  ]
  for (const [x, y] of ordem) {
    if (x === y) continue
    return x > y ? 1 : -1
  }
  return 0
}

// ---- os dois atalhos que quem chama realmente quer ----
// Guardar aqui E lá, numa linha. E ler daqui, caindo para a nuvem quando falta.
async function geradoGuardar(chave, valor, marcas) {
  try { await BookDB.set(chave, valor) } catch (e) {}
  return geradoSubir(chave, valor, marcas)
}

async function geradoLer(chave) {
  const local = await BookDB.get(chave)
  if (local != null) return local
  const daNuvem = await geradoBaixar(chave)
  if (daNuvem == null) return null
  // Grava aqui para a próxima abertura não custar rede.
  try { await BookDB.set(chave, daNuvem) } catch (e) {}
  return daNuvem
}

// ⚠️ A LEITURA QUE OLHA OS DOIS LADOS. `geradoLer` devolve o local e vai
// embora — é rápido e foi o que criou o problema: o aparelho nunca descobria
// que existia coisa melhor na nuvem. Aqui os dois são lidos, comparados pela
// ficha, e **o perdedor é corrigido na hora** — então a divergência morre no
// primeiro capítulo aberto em vez de durar para sempre.
// Custa um `get` de documento pequeno por capítulo aberto, e só quando há
// login. Devolve `{ texto, trocou, ficha }`.
async function geradoLerMelhor(chave, marcas) {
  const nivelHoje = typeof cefrNivelAluno === 'function' ? cefrNivelAluno() : ''
  let local = null
  try { local = await BookDB.get(chave) } catch (e) {}
  const localTxt = local == null ? null : (typeof local === 'string' ? local : (local instanceof Blob ? await local.text() : JSON.stringify(local)))
  if (!_fbDb || !_fbUser) return { texto: localTxt, trocou: false, ficha: geradoNota(localTxt, nivelHoje) }

  const nuvemTxt = await geradoBaixar(chave)
  if (nuvemTxt == null && localTxt == null) return { texto: null, trocou: false, ficha: null }

  // Só num dos lados: leva para o outro. É a recuperação acontecendo sozinha,
  // um capítulo por vez.
  if (nuvemTxt == null) { geradoSubir(chave, localTxt, marcas); return { texto: localTxt, trocou: false, ficha: geradoNota(localTxt, nivelHoje) } }
  if (localTxt == null) {
    try { await BookDB.set(chave, nuvemTxt) } catch (e) {}
    return { texto: nuvemTxt, trocou: false, ficha: geradoNota(nuvemTxt, nivelHoje) }
  }
  if (localTxt === nuvemTxt) return { texto: localTxt, trocou: false, ficha: geradoNota(localTxt, nivelHoje) }

  const cmp = geradoComparar(localTxt, nuvemTxt, nivelHoje)
  if (cmp >= 0) {
    // O daqui é melhor (ou empata): a nuvem passa a ter o bom.
    geradoSubir(chave, localTxt, marcas)
    return { texto: localTxt, trocou: false, ficha: geradoNota(localTxt, nivelHoje) }
  }
  try { await BookDB.set(chave, nuvemTxt) } catch (e) {}
  return { texto: nuvemTxt, trocou: true, ficha: geradoNota(nuvemTxt, nivelHoje), antes: geradoNota(localTxt, nivelHoje) }
}

// "Esta aqui é a boa": carimba a escolha dele no material LOCAL e manda para a
// nuvem. O carimbo é o que faz os outros aparelhos adotarem esta versão na
// próxima vez que abrirem o capítulo — sem ele, a heurística poderia preferir
// a que já estava lá.
async function geradoFixar(chave, marcas) {
  try {
    if (!_fbDb || !_fbUser) return false
    const v = await BookDB.get(chave)
    if (v == null) return false
    const txt = typeof v === 'string' ? v : (v instanceof Blob ? await v.text() : JSON.stringify(v))
    const p = _geradoPacote(txt)
    if (!p) return false
    p.ficha = { ...(p.ficha || {}), fixadoEm: Date.now() }
    const novo = JSON.stringify(p)
    try { await BookDB.set(chave, novo) } catch (e) {}
    return await geradoSubir(chave, novo, marcas)
  } catch (e) { console.warn('[gerado] fixar:', e && e.message); return false }
}

// ================================================================
// RECUPERAÇÃO — o que nunca subiu
// ================================================================
// ⚠️ MEDIDO NO APARELHO DELE: a análise do capítulo 5 de *Billy Summers*, com
// **149 itens**, existia só aqui — a nuvem tinha dois registros e nenhum era
// ela. Material gerado antes de §8.71 nunca teve para onde subir, e o que
// falhou na subida por qualquer motivo também ficou preso.
// Uma varredura, uma vez por aparelho: o que está aqui e não lá, sobe.
const SK_GERADO_RECUP = 'el-gerado-recuperado'
const GERADO_PREFIXOS = ['raiox:', 'pre:', 'niv:', 'nivmarca:', 'quebra:', 'sinc:']

async function geradoRecuperar(forcar) {
  try {
    if (!_fbDb || !_fbUser) return { subiu: 0, olhou: 0 }
    if (!forcar && localStorage.getItem(SK_GERADO_RECUP)) return { subiu: 0, olhou: 0, jaFeito: true }
    const chaves = (await BookDB.keys()).map(String).filter(k => GERADO_PREFIXOS.some(p => k.startsWith(p)))
    let subiu = 0
    for (const k of chaves) {
      const d = _geradoRef(k)
      if (!d) continue
      const doc = await d.get()
      if (doc.exists) continue
      const v = await BookDB.get(k)
      const txt = v == null ? null : (typeof v === 'string' ? v : (v instanceof Blob ? await v.text() : JSON.stringify(v)))
      if (!txt) continue
      // As marcas saem da própria chave: `tipo:livroId:cap`.
      const p = k.split(':')
      const marcas = { tipo: p[0], livroId: p[1] || '', cap: Number(p[2]) }
      if (await geradoSubir(k, txt, marcas)) subiu++
    }
    try { localStorage.setItem(SK_GERADO_RECUP, String(Date.now())) } catch (e) {}
    if (subiu) console.log('[gerado] recuperados para a nuvem:', subiu)
    return { subiu, olhou: chaves.length }
  } catch (e) { return { subiu: 0, olhou: 0, erro: e.message } }
}

// ================================================================
// POR QUE O ARQUIVO NÃO VEIO
// ================================================================
// ⚠️ A MENSAGEM AFIRMAVA UM FATO QUE O APP NUNCA VERIFICOU. "O arquivo deste
// livro não está neste aparelho nem na sua nuvem" saía IGUAL quando não havia
// login nenhum — e deslogado não existe nuvem para olhar: `_livroRef` devolve
// null e a busca nem começa. Saía igual também quando o download falhava por
// rede. Três situações completamente diferentes, uma frase só, e a pior delas
// ("importe o .epub de novo") mandando o usuário refazer trabalho que talvez
// não fosse preciso.
//
// Aconteceu de verdade em 2026-08-20, com o Billy Summers: o arquivo tinha
// subido e voltado em 2026-08-11 (3,92 MB, medido nos dois sentidos) e ainda
// assim a tela dizia que ele não existia na nuvem.
//
// `getMetadata` responde a pergunta sem baixar nada: existe / não existe /
// não deu para perguntar. Devolve `{ estado, bytes?, code? }`.
async function nuvemDiagnostico(ref) {
  if (typeof firebase === 'undefined' || !_fbStore) return { estado: 'sem-storage' }
  if (!_fbUser) return { estado: 'sem-login' }
  if (!ref) return { estado: 'sem-storage' }
  try {
    const m = await ref.getMetadata()
    return { estado: 'existe', bytes: Number(m && m.size) || 0 }
  } catch (e) {
    const c = String(e.code || e.message || '')
    if (c.includes('object-not-found')) return { estado: 'ausente' }
    if (c.includes('unauthorized') || c.includes('unauthenticated')) return { estado: 'sem-permissao', code: c }
    return { estado: 'erro', code: c }
  }
}

async function livroPorQueNaoVeio(id) {
  return nuvemDiagnostico(_livroRef(id))
}

async function midiaPorQueNaoVeio(id) {
  return nuvemDiagnostico(_midiaRef('midia', id))
}

// A frase que o usuário lê, montada do diagnóstico. Fica aqui, junto de quem
// sabe o motivo, para leitor, vídeo e podcast dizerem a MESMA coisa.
function nuvemFrase(d, oQue = 'o arquivo') {
  // Vírgula, não ponto: o número é lido em português.
  const mb = b => (b ? ` (${String(Math.round(b / 1048576 * 10) / 10).replace('.', ',')} MB)` : '')
  switch (d && d.estado) {
    case 'sem-login':
      return `Você não está conectado — entre com o Google para procurar ${oQue} na sua nuvem. Deslogado, o app só enxerga este aparelho.`
    case 'sem-storage':
      return `A parte da nuvem que guarda arquivos não carregou agora. Recarregue a página e tente de novo.`
    case 'ausente':
      return `${oQue[0].toUpperCase() + oQue.slice(1)} não está na sua nuvem — ou nunca subiu, ou foi removido de lá. Importe o arquivo de novo neste aparelho.`
    case 'existe':
      return `${oQue[0].toUpperCase() + oQue.slice(1)} ESTÁ na sua nuvem${mb(d.bytes)}, mas o download falhou agora. Tente de novo em instantes.`
    case 'sem-permissao':
      return `${oQue[0].toUpperCase() + oQue.slice(1)}: sua nuvem recusou o acesso. Saia e entre de novo com o Google.`
    default:
      return `Não consegui falar com a sua nuvem agora${d && d.code ? ` (${d.code})` : ''}. Tente de novo em instantes.`
  }
}

// ================================================================
// O EPISÓDIO E A LEGENDA NA NUVEM
// ================================================================
// ⚠️ A LEGENDA IMPORTA MAIS QUE O ÁUDIO, e não é óbvio. O mp3 dá para baixar
// de novo do feed; a transcrição **custou Whisper** — dinheiro dele. Sem ela,
// continuar num segundo aparelho significaria pagar a mesma transcrição outra
// vez. Por isso as duas sobem, e a legenda sobe primeiro por ser leve.
//
// A POSIÇÃO de onde ele parou já viajava: mora em `videos`, que sincroniza
// pelo banco. Era o arquivo e a legenda que ficavam presos.
//
// O uso dele é "um episódio por vez: baixa, estuda, apaga" — então não há
// varredura nem migração em massa. Sobe o que ele está usando, e sai da nuvem
// quando ele apaga daqui.
function _midiaRef(tipo, id) {
  if (!_fbStore || !_fbUser) return null
  return _fbStore.ref(`users/${_fbUser.uid}/${tipo}/${encodeURIComponent(id)}`)
}

async function midiaNaNuvem(id) {
  const r = _midiaRef('midia', id); if (!r) return false
  try { await r.getMetadata(); return true } catch (e) { return false }
}

// ⚠️ `VideoDB` mora em `video.js`, que é LAZY — este arquivo é do shell. As
// chamadas reais vêm de dentro do módulo de vídeo e já trazem o blob na mão;
// o `typeof` cobre quem chamar de fora dele. Armadilha nº 1, e eu caí nela
// escrevendo isto: o teste morreu com "VideoDB is not defined".
async function midiaGarantirNaNuvem(id, blob, aoAndar) {
  try {
    const r = _midiaRef('midia', id); if (!r) return false
    if (await midiaNaNuvem(id)) return true
    const b = blob || (typeof VideoDB !== 'undefined' ? await VideoDB.get('files', id) : null)
    if (!b) return false
    if (aoAndar) aoAndar('enviando o episódio')
    await r.put(b)
    console.log(`[Firebase] episódio ${id} na nuvem (${Math.round(b.size / 1048576)} MB)`)
    return true
  } catch (e) { console.warn('[Firebase] episódio não subiu:', e.code || e.message); return false }
}

// Mesma nota da de cima: `VideoDB` é lazy. Aqui a guarda é dupla — sem o
// módulo, nem faz sentido baixar, porque não haveria onde guardar.
//
// `aoBytes(lidos, total)` é opcional e existe por causa do VÍDEO: um episódio
// de podcast tem 30 MB e desce sem ninguém sentir; um episódio de série tem
// 400 MB, e 400 MB numa rede comum são minutos de tela parada — que parecem
// travamento. Sem o callback o caminho é o de sempre (`resp.blob()`), então o
// podcast não muda em nada.
async function midiaGarantirLocal(id, aoAndar, aoBytes, sinal) {
  if (typeof VideoDB === 'undefined') return null
  try {
    const jaTem = await VideoDB.get('files', id)
    if (jaTem) return jaTem
    const r = _midiaRef('midia', id); if (!r) return null
    if (aoAndar) aoAndar('baixando o episódio da sua nuvem')
    const url = await r.getDownloadURL()
    const blob = await _midiaBaixarBlob(url, aoBytes, sinal)
    if (!blob) return null
    await VideoDB.set('files', id, blob)
    return blob
  } catch (e) { return null }
}

// `Content-Length` vem no cabeçalho do Storage, então dá para contar de
// verdade em vez de fingir uma barra. Mesma peça do audiolivro.
// `sinal` é um AbortSignal opcional: desistir de 400 MB no meio precisa
// interromper a REDE, e não só parar de pintar a barra.
async function _midiaBaixarBlob(url, aoBytes, sinal) {
  const resp = await fetch(url, sinal ? { signal: sinal } : undefined)
  if (!resp.ok) throw new Error('download ' + resp.status)
  if (!resp.body || !aoBytes) return await resp.blob()
  const total = Number(resp.headers.get('content-length')) || 0
  const tipo = resp.headers.get('content-type') || 'application/octet-stream'
  const leitor = resp.body.getReader()
  const partes = []
  let lidos = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    partes.push(value); lidos += value.length
    aoBytes(lidos, total)
  }
  return new Blob(partes, { type: tipo })
}

// ---- SUBIR UM ARQUIVO GRANDE COM BARRA E CANCELAMENTO ----
// ⚠️ `midiaGarantirNaNuvem` acima usa `r.put(b)` e ESPERA calado. Serve para o
// podcast (30 MB, em segundo plano, ninguém está olhando) e é péssimo para o
// vídeo: 400 MB sem barra e sem botão de desistir é o app parecendo travado
// com a franquia de dados dele indo embora. Aqui o mesmo `put` devolve a
// tarefa, que reporta byte a byte e aceita `cancel()`.
let _midiaTask = null
function midiaSubindo() { return !!_midiaTask }
function midiaCancelarEnvio() { try { _midiaTask && _midiaTask.cancel() } catch (e) {} }

function midiaSubirArquivo(id, blob, aoAndar) {
  return new Promise((res, rej) => {
    const r = _midiaRef('midia', id)
    if (!r) return rej(new Error('sem-login'))
    const task = r.put(blob, { contentType: blob.type || 'application/octet-stream' })
    _midiaTask = task
    task.on('state_changed',
      st => { if (aoAndar) aoAndar(st.bytesTransferred, st.totalBytes) },
      e => { _midiaTask = null; rej(e) },
      () => { _midiaTask = null; res(true) })
  })
}

// Quanto o arquivo ocupa lá, sem baixar nada. Devolve 0 quando não existe —
// quem chama trata "0" como "não está na nuvem".
async function midiaBytesNaNuvem(id) {
  const d = await nuvemDiagnostico(_midiaRef('midia', id))
  return d.estado === 'existe' ? (d.bytes || 0) : 0
}

// A legenda é JSON de alguns KB — sobe sempre que muda, sem checar antes.
async function legendaSubir(id, dados) {
  try {
    const r = _midiaRef('subs', id); if (!r || !dados) return false
    await r.putString(JSON.stringify(dados), 'raw', { contentType: 'application/json' })
    return true
  } catch (e) { return false }
}

async function legendaBaixar(id) {
  try {
    const r = _midiaRef('subs', id); if (!r) return null
    const url = await r.getDownloadURL()
    return await (await fetch(url)).json()
  } catch (e) { return null }
}

async function midiaApagarDaNuvem(id) {
  for (const tipo of ['midia', 'subs']) {
    try { const r = _midiaRef(tipo, id); if (r) await r.delete() } catch (e) {}
  }
}

// Só os NOMES, para saber o que já está lá sem baixar nada.
async function mediaChavesNaNuvem(tipo) {
  if (!_fbStore || !_fbUser) return new Set()
  try {
    const r = await _fbStore.ref(`users/${_fbUser.uid}/${tipo}`).listAll()
    return new Set(r.items.map(i => decodeURIComponent(i.name)))
  } catch (e) { return new Set() }
}

// Sincroniza APENAS áudios novos — roda após um delay longo para acumular mudanças
async function autoSyncAudioAfterChange() {
  if (!_fbUser || !_fbDb) return
  clearTimeout(_fbAudioSyncTimer)
  _fbAudioSyncTimer = setTimeout(async () => {
    try {
      if (!_fbStore) return                    // sem arquivos, não força pelo banco
      const audioData = await AudioDB.getAll()
      const jaNaNuvem = await mediaChavesNaNuvem('audio')
      const novos = Object.entries(audioData).filter(([k]) => !jaNaNuvem.has(k))
      if (!novos.length) return
      for (const [key, val] of novos) await mediaSubir('audio', key, val)
      console.log(`[Firebase] Audio sync: ${novos.length} novos áudios enviados`)
    } catch(e) {
      console.warn('[Firebase] audio sync error:', e.code || e.message)
    }
  }, 30000) // 30s — deixa acumular antes de sincronizar
}

function initFirebase() {
  if (_fbApp) return
  try {
    _fbApp  = firebase.initializeApp(FB_CONFIG)
    _fbAuth = firebase.auth()
    _fbDb   = firebase.firestore()
    // Tolerante de propósito: se o script de arquivos não carregar (rede ruim,
    // versão velha em cache), o app continua inteiro — só a mídia deixa de
    // sincronizar, e o caminho antigo pelo banco continua sendo lido.
    try { _fbStore = firebase.storage ? firebase.storage() : null }
    catch (e) { _fbStore = null; console.warn('[Firebase] storage indisponível:', e.message) }
    // Garante que a sessão de login sobreviva a refresh / fechar e reabrir a aba
    _fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e =>
      console.warn('[Firebase] setPersistence falhou:', e.message))
    _fbAuth.onAuthStateChanged(user => {
      _fbUser = user
      updateFirebaseUI(user)
      if (user) {
        hideLoginScreen()
        // Sincronização em tempo real (a nuvem é a fonte da verdade)
        attachRealtimeSync()
      } else {
        detachRealtimeSync()
        maybeShowLoginScreen()
        // Só mostra "desconectado" após a resolução inicial do auth
        // (evita piscar "off" antes do Firebase confirmar o usuário logado)
        setTimeout(() => { if (!_fbUser) updateSyncNav('off') }, 1500)
      }
    })
  } catch(e) { console.warn('[Firebase] init error:', e.message) }
}

function updateFirebaseUI(user) {
  const loginBtn   = el('fb-login-btn')
  const userChip   = el('fb-user-chip')
  const loginBtnMob = el('fb-login-btn-mob')
  const userChipMob = el('fb-user-chip-mob')
  const loggedOut  = el('fb-settings-logged-out')
  const loggedIn   = el('fb-settings-logged-in')

  if (user) {
    if (loginBtn)  loginBtn.style.display  = 'none'
    if (userChip)  userChip.style.display  = 'flex'
    if (loginBtnMob) loginBtnMob.style.display = 'none'
    if (userChipMob) userChipMob.style.display = 'flex'
    const photo = el('fb-user-photo')
    const name  = el('fb-user-name')
    if (photo && user.photoURL) { photo.src = user.photoURL; photo.style.display = 'block' }
    // PRIMEIRO NOME na barra lateral (rodada 76): a coluna tem ~150px e o nome
    // completo virava "Djemeson Tava…" — reticências não identificam ninguém,
    // e o sobrenome não é o que distingue a conta de quem usa o app sozinho.
    // O nome inteiro continua nas Configurações, logo abaixo. Sem espaço no
    // displayName (ou só e-mail), cai no valor original.
    if (name) {
      const completo = user.displayName || user.email || ''
      name.textContent = (user.displayName || '').trim().split(/\s+/)[0] || completo
      name.title = completo
    }

    const photoMob = el('fb-user-photo-mob')
    if (photoMob && user.photoURL) { photoMob.src = user.photoURL }

    if (loggedOut) loggedOut.style.display = 'none'
    if (loggedIn)  loggedIn.style.display  = 'block'
    const emailEl = el('fb-settings-email')
    if (emailEl) emailEl.textContent = user.displayName || user.email
  } else {
    if (loginBtn)  loginBtn.style.display  = 'block'
    if (userChip)  { userChip.style.display = 'none'; userChip.style.cssText += ';display:none' }
    if (loginBtnMob) loginBtnMob.style.display = 'block'
    if (userChipMob) userChipMob.style.display = 'none'
    if (loggedOut) loggedOut.style.display = 'block'
    if (loggedIn)  loggedIn.style.display  = 'none'
  }
}

async function firebaseSignIn() {
  if (!_fbAuth) { initFirebase(); await new Promise(r => setTimeout(r, 500)) }
  try {
    const provider = new firebase.auth.GoogleAuthProvider()
    await _fbAuth.signInWithPopup(provider)
  } catch(e) { toast('Erro ao entrar: ' + e.message, 'error') }
}

async function firebaseSignOut() {
  if (!(await confirmModal({ title: 'Sair da conta', icon: 'cloud', confirmText: 'Sair',
    html: '<p style="font-size:var(--fs-sm);color:var(--text2)">Este aparelho para de sincronizar, mas <b>nada é apagado</b> — os dados locais e os da nuvem ficam onde estão.</p>' }))) return
  await _fbAuth?.signOut()
  updateSyncNav('off')
  // Sair é uma decisão explícita: a tela de login volta a fazer sentido,
  // então limpamos o "usar só neste aparelho" de antes.
  try { localStorage.removeItem(SK_LOGIN_SKIP) } catch {}
  toast('Saiu da conta.', 'info')
}

// ================================================================
// TELA DE LOGIN
// Aparece na primeira visita de quem não está logado. Entrar é OPCIONAL —
// o app funciona inteiro sem conta, só não sincroniza. Quem dispensa uma vez
// não vê de novo (a porta de entrada continua em Configurações → Nuvem).
// ================================================================
const SK_LOGIN_SKIP = 'el-login-skipped'

function maybeShowLoginScreen() {
  const tela = el('login-screen')
  if (!tela || _fbUser) return
  let dispensou = false
  try { dispensou = localStorage.getItem(SK_LOGIN_SKIP) === '1' } catch {}
  if (dispensou) return
  tela.hidden = false
  document.body.style.overflow = 'hidden'
  // Foco no botão principal, para teclado e leitor de tela
  setTimeout(() => tela.querySelector('.login-google')?.focus(), 60)
}

function hideLoginScreen() {
  const tela = el('login-screen')
  if (!tela || tela.hidden) return
  tela.hidden = true
  document.body.style.overflow = ''
}

// "Usar só neste aparelho" — fecha e não volta a perguntar.
function dismissLoginScreen() {
  try { localStorage.setItem(SK_LOGIN_SKIP, '1') } catch {}
  hideLoginScreen()
}

function userRef(path) {
  if (!_fbDb || !_fbUser) return null
  return _fbDb.collection('users').doc(_fbUser.uid).collection(path)
}

// ---- PUSH: local → Firestore ----
// Push rápido: só words/cards/cfg/log/decks — sem áudio/imagem
// Usado pelo autoSyncAfterChange (frequente)
// ================================================================
// A SUBIDA NÃO PODE APAGAR O QUE OUTRA ABA ACABOU DE FAZER
// ================================================================
// ⚠️ ISTO JÁ CUSTOU UM DADO. `batch.set(doc, {list: audiolivros})` grava a
// lista INTEIRA: quem escreve por último vence, e uma aba com estado carregado
// antes some com o que a outra tinha acabado de gravar. Aconteceu com uma
// transcrição recém-feita — sumiu do aparelho e da nuvem, e não foi hipótese.
//
// A descida já mesclava item a item; a subida, não. Agora as duas mesclam.
//
// ⚠️ E MESCLAR TRAZ UM PROBLEMA NOVO: item apagado aqui VOLTA de lá, porque
// para o merge ele é só "um item que o outro lado tem". É para isso que serve
// a marca de remoção (`marcarRemovido`) — ela separa "não tenho" de "apaguei".
//
// A hora de cada item vem com nome e formato variados (`updatedAt` número,
// `updated_at` ISO, `addedAt`…), então a leitura é tolerante. Sem hora dos
// dois lados, vence o LOCAL: quem está subindo acabou de mexer.
function _fbQuando(it) {
  if (!it) return 0
  const v = it.updatedAt ?? it.updated_at ?? it.at ?? it.addedAt ?? it.created_at
  if (typeof v === 'number') return v
  const t = Date.parse(v || '')
  return isFinite(t) ? t : 0
}

async function _fbMesclarLista(ref, listaLocal, tipo, { chave = 'id', combinar = null } = {}) {
  const local = Array.isArray(listaLocal) ? listaLocal : []
  let nuvem = []
  try {
    const snap = await ref.get()
    if (snap.exists) nuvem = snap.data().list || []
  } catch (e) {
    // Sem conseguir ler, o seguro é NÃO mesclar às cegas: sobe o local, que é
    // o comportamento antigo, em vez de arriscar gravar uma lista pela metade.
    console.warn('[Firebase] não li a nuvem para mesclar', tipo, '—', e.code || e.message)
    return local
  }
  const removidos = typeof removidosDe === 'function' ? removidosDe(tipo) : {}
  // ⚠️ `words` NÃO USA A MARCA NOVA: ela já tinha a sua desde sempre
  // (`deletedWords`), e ignorá-la faria toda palavra apagada VOLTAR da nuvem —
  // uma regressão bem pior que o problema que este merge veio consertar.
  const apagadas = (tipo === 'words' && typeof loadDeletedIds === 'function') ? loadDeletedIds() : null
  // ⚠️ Chave DERIVADA: a fila do Kindle não guarda a sua no item — ela é
  // calculada do texto do destaque. `_k` é o pedido para calcular na hora.
  const kde = it => (chave === '_k' && typeof kindleChave === 'function') ? kindleChave(it) : (it && it[chave])
  const mapa = new Map()
  for (const it of nuvem) {
    if (!it || kde(it) == null || kde(it) === '') continue
    if (apagadas && apagadas.has(kde(it))) continue
    // Removido aqui depois da última alteração dele lá: fica removido.
    if (removidos[kde(it)] && removidos[kde(it)] >= _fbQuando(it)) continue
    mapa.set(kde(it), it)
  }
  for (const it of local) {
    if (!it || kde(it) == null || kde(it) === '') continue
    const outro = mapa.get(kde(it))
    if (!outro) { mapa.set(kde(it), it); continue }
    // `combinar` existe para o que NÃO se escolhe, se soma — ver o diário.
    mapa.set(kde(it), combinar ? combinar(it, outro)
      : (_fbQuando(it) >= _fbQuando(outro) ? it : outro))
  }
  return [...mapa.values()]
}

// ⚠️ O DIÁRIO É POR DIA, E FICA COM O MAIOR — NÃO COM A SOMA. Cada linha é um
// dia (`{date, reviewed, correct, newSeen}`), e a primeira versão disto somava
// os dois lados: revisar 20 no celular e 15 no computador daria 35.
//
// **Somar estava errado, e o teste mostrou na hora.** O contador local não
// zera depois de subir, então cada push somava de novo: 20 contra 15 virou 35,
// depois 55, 75, 95 — o gráfico inflando sozinho a cada sincronização. Somar
// certo exigiria contar POR APARELHO, o que muda o formato do diário e o
// gráfico que lê dele.
//
// Ficar com o maior não é o número perfeito (perde o estudo que só o outro
// aparelho viu), mas **nunca mente para mais** — e ainda é melhor que hoje,
// onde o último a subir simplesmente apaga o outro.
function _fbDiaMaior(a, b) {
  if (!b) return a
  const n = (x, y) => Math.max(Number(x) || 0, Number(y) || 0)
  // ⚠️ COM PARCELAS, A SOMA VOLTA A SER POSSÍVEL — e correta. Cada aparelho tem
  // a sua, cumulativa no dia; unir os dois lados é ficar com o MAIOR DE CADA
  // parcela (o contador daquele aparelho só cresce) e refazer o total. Assim
  // 20 no celular e 15 no computador dão 35 de verdade, e um segundo push não
  // vira 55 — porque a parcela do celular continua sendo 20.
  const pa = a.porAparelho, pb = b.porAparelho
  if (pa || pb) {
    const juntas = {}
    for (const k of new Set([...Object.keys(pa || {}), ...Object.keys(pb || {})])) {
      const x = (pa || {})[k] || {}, y = (pb || {})[k] || {}
      juntas[k] = { reviewed: n(x.reviewed, y.reviewed), correct: n(x.correct, y.correct), newSeen: n(x.newSeen, y.newSeen) }
    }
    let rv = 0, co = 0, ns = 0
    for (const k of Object.keys(juntas)) { rv += juntas[k].reviewed; co += juntas[k].correct; ns += juntas[k].newSeen }
    return { ...b, ...a, date: a.date, porAparelho: juntas, reviewed: rv, correct: co, newSeen: ns }
  }
  // Sem parcelas dos dois lados (dias antigos): o maior, como antes.
  return { ...b, ...a,
    date: a.date,
    reviewed: n(a.reviewed, b.reviewed),
    correct:  n(a.correct,  b.correct),
    newSeen:  n(a.newSeen,  b.newSeen) }
}

// ---- A MUDANÇA QUE AINDA NÃO SUBIU (rodada 44) ----
// O debounce de 1,2s morre com a aba: o dado ficava salvo aqui, mas no boot
// seguinte o PRIMEIRO snapshot substituía o local sem merge — apagando o que
// nunca subiu (as capturas da extensão eram o caso mais provável, porque a
// extensão já tinha limpado a fila dela ao entregar).
// A bandeira marca "há mudança local não empurrada"; quem a vê no boot empurra
// ANTES de adotar a nuvem (o push mescla, então nada se perde). O contador
// garante que uma mudança feita NO MEIO de um push não seja dada por enviada.
const SK_SYNC_PENDENTE = 'el-sync-pendente'
let _fbDirtySeq = 0

// ---- O TETO DE 1 MB POR DOCUMENTO (rodada 44) ----
// O Firestore rejeita documento acima de 1 MB — e o push era um batch ATÔMICO:
// no dia em que UMA lista estourasse, o commit inteiro falharia, o sync
// pararia de vez e nada apontaria o culpado. Agora cada doc é medido antes:
// perto do teto avisa (uma vez por sessão), estourado sai DESTE envio com um
// erro nomeado — o resto do acervo continua sincronizando. O material gerado
// já tinha guarda própria (geradoSubir, 900 KB); as listas principais não.
const _FB_DOC_AVISO = 800000     // ~80% do teto: hora de saber
const _FB_DOC_TETO  = 950000     // margem sobre o 1 MB real (índices contam)
const _fbTamAvisado = new Set()
function _fbDocCabe(nome, payload) {
  let bytes = 0
  try { bytes = JSON.stringify(payload).length } catch (e) { return true }
  if (bytes > _FB_DOC_TETO) {
    if (!_fbTamAvisado.has(nome + '!') && typeof toast === 'function') {
      _fbTamAvisado.add(nome + '!')
      toast(`A lista "${nome}" passou do limite de 1 MB da nuvem e ficou FORA deste envio — o resto sincroniza normal. Este é o aviso para particionarmos essa lista.`, 'error')
    }
    console.warn(`[Firebase] doc "${nome}" com ${bytes} bytes — acima do teto, fora do batch`)
    return false
  }
  if (bytes > _FB_DOC_AVISO && !_fbTamAvisado.has(nome) && typeof toast === 'function') {
    _fbTamAvisado.add(nome)
    toast(`A lista "${nome}" está em ${Math.round(bytes / 1024)} KB — chegando perto do teto de 1 MB da nuvem. Nada quebrou ainda; é o aviso com antecedência.`, 'warning')
  }
  return true
}

async function fbPushData() {
  if (!_fbUser || !_fbDb) return false
  const seqAntes = _fbDirtySeq
  updateSyncNav('syncing')
  try {
    const base = _fbDb.collection('users').doc(_fbUser.uid)
    // ⚠️ AS LEITURAS VÊM ANTES DO BATCH. Mesclar exige saber o que já está lá,
    // e o batch é escrita pura — ler dentro dele não existe.
    const D = base.collection('data')
    // ⚠️ `known` e `kindleSeen` também são LIDOS antes de gravar (rodada 44).
    // Antes o batch os sobrescrevia às cegas com o estado local — e como eles
    // sincronizam por união na DESCIDA, um aparelho atrasado que empurrasse
    // primeiro apagava da nuvem a desmarcação/reset feita no outro.
    const lerDoc = async ref => { try { const s = await ref.get(); return s.exists ? (s.data() || {}) : {} } catch (e) { return null } }
    const [mWords, mLivros, mAudio, mVideos, mClips, mCards, mDecks, mConv, mPods, mLog, dKnown, dKindle] = await Promise.all([
      _fbMesclarLista(D.doc('words'), words, 'words'),
      _fbMesclarLista(D.doc('livros'), livros, 'livros'),
      _fbMesclarLista(D.doc('audiolivros'), audiolivros, 'audiolivros'),
      _fbMesclarLista(D.doc('videos'), videos, 'videos'),
      _fbMesclarLista(D.doc('clips'), clips, 'clips'),
      _fbMesclarLista(D.doc('srsCards'), srsCards, 'srsCards'),
      _fbMesclarLista(D.doc('srsDecks'), srsDecks, 'srsDecks'),
      _fbMesclarLista(D.doc('conversas'), conversas, 'conversas'),
      // ⚠️ Podcast não tem `id`: a identidade é o programa no catálogo.
      _fbMesclarLista(D.doc('podShows'), podShows || [], 'podShows', { chave: 'collectionId' }),
      // ⚠️ O diário é por DIA e SOMA — ver `_fbSomarDia`.
      _fbMesclarLista(D.doc('srsLog'), srsLog, 'srsLog', { chave: 'date', combinar: _fbDiaMaior }),
      lerDoc(D.doc('known')),
      lerDoc(D.doc('kindleSeen'))
    ])
    // Conhecidas/ignoradas/sentidos: o MESMO merge da descida (lápides de
    // desmarcação incluídas). `null` = não conseguiu ler a nuvem: sobe o local
    // com as lápides, que é o comportamento seguro (nada é apagado às cegas).
    const pacoteKnown = (dKnown !== null && typeof mesclarConhecidasComNuvem === 'function')
      ? mesclarConhecidasComNuvem(dKnown)
      : { map: knownWords || {}, ignored: ignoredWords || {},
          senses: (typeof knownSenses !== 'undefined' ? knownSenses : {}) || {},
          unmarked: (typeof unmarks !== 'undefined' ? unmarks : {}) || {},
          resetAt: (typeof knownResetAt === 'function' ? knownResetAt() : 0) }
    // Histórico do Kindle: se a nuvem tem uma ÉPOCA de reset mais nova que a
    // daqui, o histórico local é pré-reset — adota o da nuvem antes de subir.
    if (dKindle && typeof kindleAdotarReset === 'function') {
      kindleAdotarReset(dKindle.resetAt, dKindle.list)
    }
    // ⚠️ `srsCards` entrou depois dos outros: os cards moram no IndexedDB, e a
    // marca de remoção compara com o localStorage. A saída foi um espelho só
    // com os IDS (`marcarSumidosCards`) — barato, e o bastante para saber o
    // que sumiu entre um save e o outro.
    //
    // ⚠️ `kindleQueue` ENTROU DEPOIS, e o que faltava não era `id`: era ver que
    // a identidade já existia espalhada em `kindleItemVisto` — um destaque é o
    // hash do seu texto. Virou `kindleChave`.
    //
    // E o medo de "a captura processada volta para a fila" já tinha resposta
    // pronta: `kindleSeen`, o histórico do que passou. Ele é o tombstone
    // natural desta lista, e o filtro abaixo é o mesmo que a descida usa.
    const batch = _fbDb.batch()
    const poe = (nome, payload, opts) => {
      if (!_fbDocCabe(nome, payload)) return
      if (opts) batch.set(base.collection('data').doc(nome), payload, opts)
      else batch.set(base.collection('data').doc(nome), payload)
    }
    poe('words',    { list: mWords,    updatedAt: Date.now() })
    poe('srsCards', { list: mCards,    updatedAt: Date.now() })
    poe('srsCfg',   { ...srsCfg,       updatedAt: Date.now() })
    poe('srsLog',   { list: mLog,      updatedAt: Date.now() })
    poe('srsDecks', { list: mDecks,    updatedAt: Date.now() })
    // Configurações da conta (chave OpenAI, tema, providers).
    // IMPORTANTE: usamos merge:true e SÓ incluímos a chave quando NÃO está vazia.
    // Assim, um dispositivo sem a chave nunca apaga o valor já salvo na nuvem.
    const cfgPayload = {
      theme:       cfg.theme        || 'midnight',
      // O par preferido de cada lado, para o botão claro/escuro da barra
      // lateral chegar no outro aparelho já sabendo ao que voltar.
      themeDark:   cfg.themeDark    || '',
      themeLight:  cfg.themeLight   || '',
      accent:      cfg.accent       || '',
      imgQuality:  cfg.imgQuality   || 'low',
      nivelAluno:  cfg.nivelAluno   || 'B1',
      aiProvider:  cfg.aiProvider   || 'openai',
      aiModel:     cfg.aiModel       || '',
      ttsProvider: cfg.ttsProvider   || 'openai',
      subAddons:   cfg.subAddons     || '',
      updatedAt: Date.now()
    }
    if (cfg.openaiKey)   cfgPayload.openaiKey   = cfg.openaiKey
    if (cfg.geminiKey)   cfgPayload.geminiKey   = cfg.geminiKey
    if (cfg.groqKey)     cfgPayload.groqKey     = cfg.groqKey
    cfgPayload.aiModelProv = cfg.aiModelProv || {}
    cfgPayload.vidPT = cfg.vidPT || ''
    cfgPayload.sttProvider = cfg.sttProvider || 'auto'
    cfgPayload.imgProvider = cfg.imgProvider || 'openai'
    // Campos que mudavam num aparelho e não chegavam ao outro (rodada 44):
    // uns nem entravam no pacote, outros entravam e a descida os ignorava.
    cfgPayload.activeLang = cfg.activeLang || 'en'
    if (cfg.autoMeta    !== undefined) cfgPayload.autoMeta    = cfg.autoMeta
    if (cfg.catalogoIA  !== undefined) cfgPayload.catalogoIA  = cfg.catalogoIA
    if (cfg.googleBooksKey) cfgPayload.googleBooksKey = cfg.googleBooksKey
    if (cfg.estante) cfgPayload.estante = cfg.estante
    if (cfg.imgQuality) cfgPayload.imgQuality = cfg.imgQuality
    poe('cfg', cfgPayload, { merge: true })
    if (kindleItems.length > 0) {
      const vistos = loadKindleSeen()
      const mFila = (await _fbMesclarLista(D.doc('kindleQueue'), kindleItems, 'kindleQueue', { chave: '_k' }))
        .filter(it => !kindleItemVisto(it, vistos))
        .map(it => { const c = { ...it }; delete c._k; return c })
      poe('kindleQueue', { list: mFila, updatedAt: Date.now() })
    }
    // Histórico do Kindle: sem ele na nuvem, importar o vocab.db no PC e depois
    // abrir o Lab no celular traria TUDO de novo — o "só o novo entra" só vale
    // se o "já entrou" for o mesmo em todo aparelho.
    // União com o que já está lá (mesma época): gravar só o local apagaria da
    // nuvem os hashes que este aparelho ainda não baixou. A época do reset
    // viaja junto — é ela que faz o "Resetar histórico" valer em todo lugar.
    // (a adoção de época já rodou lá em cima, então aqui "não anterior" basta:
    // nuvem mais velha que o meu reset = hashes pré-reset, ficam de fora)
    const ksLocal = loadKindleSeen()
    const epocaLocal = (typeof kindleResetAt === 'function') ? kindleResetAt() : 0
    if (dKindle && Array.isArray(dKindle.list) && (Number(dKindle.resetAt) || 0) >= epocaLocal) {
      dKindle.list.forEach(h => ksLocal.add(h))
    }
    poe('kindleSeen', {
      list: [...ksLocal].slice(-30000),
      resetAt: (typeof kindleResetAt === 'function' ? kindleResetAt() : 0),
      updatedAt: Date.now()
    })
    poe('conversas', { list: mConv, updatedAt: Date.now() })
    // Vídeo: só METADADOS (títulos, marcadores, cortes) — o arquivo de vídeo
    // nunca sobe (300MB–2GB × limite de 1MB/doc). Legendas ficam locais (IDB).
    poe('videos', { list: mVideos, updatedAt: Date.now() })
    // Ebooks: metadados, sumário, ONDE VOCÊ PAROU e os destaques. O arquivo
    // (MBs) fica no IndexedDB de cada aparelho — mesma regra do vídeo.
    poe('livros', { list: mLivros, updatedAt: Date.now() })
    // Audiolivros: SÓ METADADOS. O áudio (centenas de MB) fica no aparelho —
    // aqui viaja título, capa reduzida, capítulos, posição e marcadores.
    poe('audiolivros', { list: mAudio, updatedAt: Date.now() })
    poe('known', { ...pacoteKnown, updatedAt: Date.now() })
    poe('clips',  { list: mClips,  updatedAt: Date.now() })
    // Podcasts: só a lista de programas visitados (ponteiros). O episódio em si
    // já viaja em `videos` e o mp3 nunca sobe.
    poe('podShows', { list: mPods, updatedAt: Date.now() })
    await batch.commit()
    // Só dá a pendência por quitada se nada mudou DURANTE o push — uma mudança
    // no meio já reagendou outro envio, e é ele que vai quitar.
    if (_fbDirtySeq === seqAntes) { try { localStorage.removeItem(SK_SYNC_PENDENTE) } catch (e) {} }
    updateSyncNav('ok')
    return true
  } catch(e) {
    console.warn('[Firebase] data push error:', e.code || e.message)
    updateSyncNav('err')
    return false
  }
}

// Push completo: dados + áudio + imagens — usado só no botão manual "Enviar para nuvem"
async function fbPush() {
  const dataOk = await fbPushData()
  if (!dataOk) return false
  updateSyncNav('syncing')
  try {
    if (!_fbStore) { updateSyncNav('ok'); return true }
    // Áudio e imagem: sobe só o que ainda não está lá, comparando pelos NOMES
    // dos arquivos — barato, não baixa conteúdo nenhum para decidir.
    for (const [tipo, db] of [['audio', AudioDB], ['images', ImageDB]]) {
      const local = await db.getAll()
      const naNuvem = await mediaChavesNaNuvem(tipo)
      for (const [key, val] of Object.entries(local)) {
        if (!naNuvem.has(key)) await mediaSubir(tipo, key, val)
      }
    }

    updateSyncNav('ok')
    return true
  } catch(e) {
    console.warn('[Firebase] media push error:', e.code || e.message)
    updateSyncNav('err')
    return false
  }
}

// ---- PULL: Firestore → local ----
async function fbPull() {
  if (!_fbUser || !_fbDb) return false
  updateSyncNav('syncing')
  try {
    const base = _fbDb.collection('users').doc(_fbUser.uid)

    // Dados principais
    const [wordsDoc, cardsDoc, cfgDoc, logDoc, decksDoc] = await Promise.all([
      base.collection('data').doc('words').get(),
      base.collection('data').doc('srsCards').get(),
      base.collection('data').doc('srsCfg').get(),
      base.collection('data').doc('srsLog').get(),
      base.collection('data').doc('srsDecks').get(),
    ])

    if (wordsDoc.exists) {
      const cloudWords = wordsDoc.data().list || []
      const localWords = (() => { try { return JSON.parse(localStorage.getItem(SK.words) || '[]') } catch { return [] } })()
      const deletedIds = loadDeletedIds()
      // Merge: para cada palavra, mantém a versão mais "avançada"
      // (analisada > pendente; ou mais recente se ambas analisadas)
      const byId = {}
      cloudWords.forEach(w => { if (!deletedIds.has(w.id)) byId[w.id] = w })
      localWords.forEach(w => {
        if (deletedIds.has(w.id)) return // ignorar deletadas
        if (!byId[w.id]) { byId[w.id] = w; return }
        const cloud = byId[w.id]
        const localAnalyzed = w.status !== "pending_ai"
        const cloudAnalyzed = cloud.status !== "pending_ai"
        if (localAnalyzed && !cloudAnalyzed) { byId[w.id] = w; return }
        if (!localAnalyzed && cloudAnalyzed) { return } // mantém cloud
        // Ambos analisados: usa o mais recente
        const localTs = w.updated_at || w.created_at || 0
        const cloudTs = cloud.updated_at || cloud.created_at || 0
        if (localTs > cloudTs) byId[w.id] = w
      })
      words = Object.values(byId)
      saveWords()
    }
    if (cardsDoc.exists) {
      const cloudCards = cardsDoc.data().list || []
      // Merge: se o card local foi revisado (state != 'new'), ele é mais recente que a nuvem.
      // Isso evita que a nuvem (stale) sobrescreva cards revisados em sessão abandonada.
      const localById = {}
      srsCards.forEach(c => { localById[c.id] = c })
      const merged = cloudCards.map(cc => {
        const local = localById[cc.id]
        if (!local) return cc                  // card novo da nuvem — aceita
        if (local.state !== 'new') return local // local foi revisado — mantém local
        if (cc.state !== 'new') return cc       // nuvem mais avançada — aceita nuvem
        return local                            // ambos 'new' — sem diferença
      })
      // Cards que existem só localmente (ainda não chegaram à nuvem)
      const cloudIds = new Set(cloudCards.map(c => c.id))
      srsCards.forEach(c => { if (!cloudIds.has(c.id)) merged.push(c) })
      srsCards = merged
      saveSrsCards()
    }
    if (cfgDoc.exists)    { srsCfg    = { ...SRS_DEF_CFG, ...cfgDoc.data() }; persistSrsCfg() }
    if (logDoc.exists) {
      const cloudLog = logDoc.data().list || []
      // Merge: para cada data, mantém o log com mais revisões (sessão mais recente)
      const localByDate = {}
      srsLog.forEach(l => { localByDate[l.date] = l })
      const allDates = new Set([...srsLog.map(l => l.date), ...cloudLog.map(l => l.date)])
      const cloudByDate = {}
      cloudLog.forEach(l => { cloudByDate[l.date] = l })
      srsLog = Array.from(allDates).map(date => {
        const local = localByDate[date]
        const cloud = cloudByDate[date]
        if (!local) return cloud
        if (!cloud) return local
        return (local.reviewed || 0) >= (cloud.reviewed || 0) ? local : cloud
      })
      saveSrsLog()
    }
    if (decksDoc.exists)  { srsDecks  = decksDoc.data().list || [];    saveSrsDecks() }

    // Configurações da conta — restaura chave OpenAI / tema / providers.
    // Merge seguro: usa o valor da nuvem só quando não estiver vazio,
    // para não apagar configurações locais quando a nuvem ainda está em branco.
    const cfgDoc2 = await base.collection('data').doc('cfg').get()
    if (cfgDoc2.exists) {
      const c = cfgDoc2.data() || {}
      if (c.openaiKey)   cfg.openaiKey   = c.openaiKey
    if (c.geminiKey)   cfg.geminiKey   = c.geminiKey
    if (c.groqKey)     cfg.groqKey     = c.groqKey
    if (c.aiModelProv) cfg.aiModelProv = c.aiModelProv
    if (c.vidPT !== undefined) cfg.vidPT = c.vidPT
    if (c.sttProvider) cfg.sttProvider = c.sttProvider
    if (c.imgProvider) cfg.imgProvider = c.imgProvider
      if (c.theme)       cfg.theme       = c.theme
      if (c.themeDark)   cfg.themeDark   = c.themeDark
      if (c.themeLight)  cfg.themeLight  = c.themeLight
    if (c.accent !== undefined) cfg.accent = c.accent
    if (c.imgQuality) cfg.imgQuality = c.imgQuality
    if (c.nivelAluno) cfg.nivelAluno = c.nivelAluno
      if (c.accent !== undefined) cfg.accent = c.accent
      if (c.imgQuality) cfg.imgQuality = c.imgQuality
      if (c.aiProvider)  cfg.aiProvider  = c.aiProvider
      if (c.aiModel)     cfg.aiModel     = c.aiModel
      if (c.ttsProvider) cfg.ttsProvider = c.ttsProvider
      saveCfg()
      if (typeof applyTheme === 'function') applyTheme(cfg.theme)
      // Se a tela de configurações estiver aberta, reflete os valores restaurados
      if (typeof fillSettings === 'function' &&
          document.getElementById('section-configuracoes')?.classList.contains('active')) {
        fillSettings()
      }
    }

    // O histórico vem ANTES da fila: é ele que decide o que ainda é novidade.
    // União, nunca substituição — cada aparelho importou coisas diferentes.
    const seenDoc = await base.collection('data').doc('kindleSeen').get()
    if (seenDoc.exists && Array.isArray(seenDoc.data().list)) {
      const uniao = loadKindleSeen()
      seenDoc.data().list.forEach(h => uniao.add(h))
      saveKindleSeen(uniao)
    }

    const kindleDoc = await base.collection('data').doc('kindleQueue').get()
    if (kindleDoc.exists && kindleDoc.data().list?.length > 0) {
      const seen = loadKindleSeen()
      kindleItems = (kindleDoc.data().list || []).filter(item => !kindleItemVisto(item, seen))
      localStorage.setItem(SK.kindleQueue, JSON.stringify(kindleItems))
    }

    const conversasDoc = await base.collection('data').doc('conversas').get()
    if (conversasDoc.exists) {
      conversas = conversasDoc.data().list || []
      saveConversas()
    }

    // ⚠️ MÍDIA VEM DOS DOIS LUGARES, e essa é a trava de segurança da mudança.
    // O que já estava gravado continua DENTRO do banco até a migração rodar; se
    // o pull passasse a ler só o Storage, ele trocaria de aparelho e chegaria
    // sem nenhum áudio antigo. O legado entra primeiro e o Storage sobrescreve,
    // porque é ele que tem a versão nova quando os dois têm a mesma chave.
    for (const [tipo, db, cache] of [['audio', AudioDB, 'audio'], ['images', ImageDB, 'images']]) {
      const mapa = {}
      try {
        const docs = await base.collection(tipo).get()      // legado, ainda no banco
        docs.forEach(d => { const v = d.data().data; if (v) mapa[d.id] = v })
      } catch (e) {}
      Object.assign(mapa, await mediaBaixarTodos(tipo))     // Storage manda
      if (Object.keys(mapa).length) {
        await db.setAll(mapa)
        if (cache === 'audio') _audioKeyCache = new Set(Object.keys(mapa))
        else _imageKeyCache = new Set(Object.keys(mapa))
      }
    }

    updateSyncNav('ok')
    return true
  } catch(e) {
    console.warn('[Firebase] pull error:', e)
    updateSyncNav('err')
    return false
  }
}

// ================================================================
// SINCRONIZAÇÃO EM TEMPO REAL — a NUVEM é a fonte da verdade
// Listener onSnapshot na coleção "data": qualquer mudança/exclusão
// em outro dispositivo aparece aqui na hora. Sem merge → sem ressuscitar.
// ================================================================
let _rtUnsub = null
let _rtFirst = true
let _pendingCloudCards = null   // cards da nuvem aguardando (sessão de estudo ativa)

function detachRealtimeSync() {
  if (_rtUnsub) { try { _rtUnsub() } catch {} _rtUnsub = null }
}

function attachRealtimeSync() {
  if (!_fbDb || !_fbUser) return
  detachRealtimeSync()
  _rtFirst = true
  updateSyncNav('syncing')
  const dataCol = _fbDb.collection('users').doc(_fbUser.uid).collection('data')
  _rtUnsub = dataCol.onSnapshot(snap => {
    // Ignora o eco das nossas próprias escritas (exceto a 1ª carga inicial)
    const fromServer = snap.docChanges().some(ch => !ch.doc.metadata.hasPendingWrites)
    if (!_rtFirst && !fromServer) return
    // ⚠️ MUDANÇA LOCAL QUE NUNCA SUBIU (a aba fechou dentro do debounce):
    // empurra ANTES de adotar a nuvem. O push mescla, então nada daqui se
    // perde — e o commit dele dispara um novo snapshot, já com os dois lados
    // casados, que é o que este listener aplica em seguida.
    if (_rtFirst && localStorage.getItem(SK_SYNC_PENDENTE) === '1') {
      _rtFirst = false
      console.info('[Firebase] mudança local pendente do boot anterior — empurrando antes de adotar a nuvem')
      fbPushData().then(() => fbPullMedia().catch(() => {})).catch(() => {})
      return
    }
    const docs = {}
    snap.forEach(d => { docs[d.id] = d.data() })
    applyCloudDocs(docs)
    if (_rtFirst) { _rtFirst = false; fbPullMedia().catch(() => {}) }
    updateSyncNav('ok')
  }, err => {
    console.warn('[Firebase] realtime erro:', err.code || err.message)
    updateSyncNav('err')
  })
}

// Adota o estado da nuvem (substitui o local — sem merge).
// Doc presente (mesmo com lista vazia) é adotado → exclusões propagam.
// Doc ausente é ignorado → não apaga um dispositivo que ainda não sincronizou.
function applyCloudDocs(docs) {
  // ⚠️ TRAVA A MARCA DE REMOÇÃO ENQUANTO A NUVEM É APLICADA. Aqui as listas são
  // SUBSTITUÍDAS pelo resultado do merge — e um item local que não sobreviveu
  // ao merge não foi "removido por ele". Sem a trava, `marcarSumidos` o
  // carimbaria como apagado e ele nunca mais voltaria da nuvem: o pior tipo de
  // perda, silenciosa e permanente.
  // `fbAplicandoNuvem` mora no core.js — mesma guarda de deploy parcial.
  const temTrava = typeof fbAplicandoNuvem !== 'undefined'
  if (temTrava) fbAplicandoNuvem = true
  try { return _applyCloudDocs(docs) } finally { if (temTrava) fbAplicandoNuvem = false }
}

function _applyCloudDocs(docs) {
  docs = docs || {}
  if (docs.words)    { words = docs.words.list || []; saveWords() }
  if (docs.srsCards) {
    const cloudCards = docs.srsCards.list || []
    if (srsSession) _pendingCloudCards = cloudCards          // aplica ao fim da sessão
    else { srsCards = cloudCards; saveSrsCards() }
  }
  if (docs.srsCfg)   { srsCfg = { ...SRS_DEF_CFG, ...docs.srsCfg }; persistSrsCfg() }
  if (docs.srsLog)   { srsLog = docs.srsLog.list || []; saveSrsLog() }
  if (docs.srsDecks) { srsDecks = docs.srsDecks.list || []; saveSrsDecks() }
  if (docs.videos)   { videos = docs.videos.list || []; saveVideos() }
  // Livros: merge POR LIVRO, pelo `updatedAt` — exceção consciente à regra
  // "a nuvem substitui". O que está em jogo é ONDE VOCÊ PAROU: um snapshot
  // atrasado (o outro aparelho empurrou antes deste) apagaria a leitura de
  // hoje e o livro reabriria no capítulo de ontem. Exclusão continua
  // propagando: livro que sumiu da nuvem sai daqui também.
  if (docs.livros) {
    const nuvem = docs.livros.list || []
    const carimbo = docs.livros.updatedAt || 0
    const locais = new Map(livros.map(l => [l.id, l]))
    const abertoId = (typeof _lerLivro !== 'undefined' && _lerLivro) ? _lerLivro.id : null
    // O HISTÓRICO DE LEITURA É A EXCEÇÃO DENTRO DA EXCEÇÃO: ele se soma, nunca
    // se escolhe. Quem perde no `updatedAt` ainda pode ter dias que o outro
    // aparelho nunca viu (leu no celular na segunda, no notebook na terça), e
    // trocar o objeto inteiro apagaria a segunda-feira do calendário para
    // sempre. União por DIA, ficando com a maior leitura de cada dia.
    const unirHistorico = (a, b) => {
      const mapa = new Map()
      for (const h of [...(a || []), ...(b || [])]) {
        if (!h || !h.d) continue
        const ja = mapa.get(h.d)
        if (!ja || (h.pct || 0) > (ja.pct || 0)) mapa.set(h.d, h)
      }
      return [...mapa.values()].sort((x, y) => (x.d < y.d ? -1 : 1))
    }
    const juntos = nuvem.map(remoto => {
      const local = locais.get(remoto.id)
      if (!local) return remoto
      const historico = unirHistorico(local.historico, remoto.historico)
      // Livro aberto agora: este aparelho é a fonte da verdade, ponto.
      if (local.id === abertoId) return { ...local, historico }
      const vence = (local.updatedAt || 0) > (remoto.updatedAt || 0) ? local : remoto
      return { ...vence, historico }
    })
    // Livro importado aqui e ainda não empurrado não pode sumir da estante.
    // ⚠️ E LIVRO CUJO ARQUIVO ESTÁ NESTE APARELHO TAMBÉM NÃO — mesmo defeito
    // que custou 202 MB órfãos no audiolivro (§8.89), com um agravante que o
    // audiolivro não tem: **o histórico de leitura morre junto**. O EPUB volta
    // por importação; os dias lidos, as páginas e a sequência do calendário,
    // não. A pergunta é respondida pelo censo local, que é síncrono.
    for (const l of livros) {
      if (nuvem.some(r => r.id === l.id)) continue
      const temArquivo = typeof livroTemArquivoAqui === 'function' && livroTemArquivoAqui(l.id)
      // ⚠️ E O LIVRO DE PAPEL NÃO TEM ARQUIVO NENHUM PARA PROTEGÊ-LO — o que
      // ele tem é justamente o que dói perder: os dias lidos, digitados um a
      // um. Histórico é trabalho humano; o arquivo, no máximo, é download.
      const temHistorico = (l.historico || []).length > 0
      if ((l.addedAt || 0) > carimbo || l.id === abertoId || temArquivo || temHistorico) juntos.push(l)
    }
    livros = juntos
    if (abertoId && typeof _lerLivro !== 'undefined') {
      _lerLivro = livros.find(l => l.id === abertoId) || _lerLivro
    }
    saveLivros()
  }
  // Audiolivros: mesma exceção dos livros — merge POR ITEM, pelo `updatedAt`.
  // O que está em jogo é ONDE VOCÊ PAROU num arquivo de doze horas, e um
  // snapshot atrasado jogaria fora a escuta de hoje.
  // ⚠️ Aparelho SEM o arquivo continua vendo o item na estante (é assim que a
  // posição atravessa o computador e o celular); ele só avisa na hora de abrir.
  if (docs.audiolivros) {
    const nuvem = docs.audiolivros.list || []
    const carimbo = docs.audiolivros.updatedAt || 0
    const locais = new Map(audiolivros.map(a => [a.id, a]))
    const abertoId = (typeof _abLivro !== 'undefined' && _abLivro) ? _abLivro.id : null
    const juntos = nuvem.map(remoto => {
      const local = locais.get(remoto.id)
      if (!local) return remoto
      const vencedor = local.id === abertoId ? local   // tocando aqui: manda quem toca
        : (local.updatedAt || 0) > (remoto.updatedAt || 0) ? local : remoto
      // ⚠️ TRANSCRIÇÃO E ANÁLISE NÃO PODEM VIAJAR NA CARONA DO VENCEDOR. O
      // `updatedAt` de um audiolivro muda a cada meio minuto de escuta — quem
      // está só OUVINDO no celular vence o computador que acabou de transcrever
      // um capítulo, e leva junto o que foi pago. Medido no acervo dele: um
      // único capítulo carrega **438 falas e 154 pontos analisados**.
      // Mesma exceção que o `historico` dos livros já tinha: isto se UNE, nunca
      // se escolhe.
      const trans = _unirTranscricoes(local.transcricoes, remoto.transcricoes)
      // ⚠️ `nuvem` NÃO obedece ao vencedor: ela descreve o que está no Storage,
      // um fato do mundo, não uma preferência deste aparelho. Se o celular subiu
      // o áudio e o computador salvou a posição depois, o registro da subida não
      // pode sumir junto — senão o computador acha que nunca subiu e sobe de novo.
      const nv = _abNuvemMaisCompleta(local.nuvem, remoto.nuvem)
      // Marcadores também se unem: cada um é um gesto dele, e gesto não se
      // desfaz porque o outro aparelho salvou depois.
      const marc = _unirMarcadores(local.marcadores, remoto.marcadores)
      const capMapa = { ...(remoto.capMapa || {}), ...(local.capMapa || {}) }
      return {
        ...vencedor,
        ...(trans ? { transcricoes: trans } : {}),
        ...(marc ? { marcadores: marc } : {}),
        ...(Object.keys(capMapa).length ? { capMapa } : {}),
        ...(nv ? { nuvem: nv } : {})
      }
    })
    // ⚠️ ITEM CUJO ÁUDIO ESTÁ NESTE APARELHO NUNCA É DESCARTADO — e esta linha
    // nasceu de um achado no acervo real dele: 202 MB guardados sob
    // `ab:mt1zwec7j56np:0`, de um audiolivro que **não existia mais na
    // estante**. O áudio ficou órfão porque o item sumiu daqui, e a regra
    // abaixo é a suspeita: um item local ausente da nuvem e mais antigo que o
    // carimbo do documento era jogado fora em silêncio. Some da estante, sobra
    // o arquivo — e no dia seguinte tudo é baixado de novo.
    // O saldo é assimétrico: manter um item a mais custa uma linha na estante
    // (e um clique para remover); descartá-lo custa 924 MB de download.
    // Marca de remoção de verdade continua valendo — ela é o caminho por onde
    // uma exclusão atravessa, e não passa por aqui.
    const comAudioAqui = typeof abLocaisLer === 'function' ? abLocaisLer() : {}
    for (const a of audiolivros) {
      if (nuvem.some(r => r.id === a.id)) continue
      if ((a.addedAt || 0) > carimbo || a.id === abertoId || comAudioAqui[a.id]) juntos.push(a)
    }
    audiolivros = juntos
    // ⚠️ O REPRODUTOR FICAVA COM UM OBJETO ÓRFÃO. O merge SUBSTITUI o array, e
    // `_abLivro` continuava apontando para o objeto de antes — a partir dali,
    // o player e o acervo eram duas coisas diferentes com o mesmo id: o que ele
    // marcasse no player não chegava ao que é salvo, e o que viesse da nuvem
    // não aparecia na tela. Achado por acaso testando o botão de fixar (§8.98):
    // o dado dizia `null` e o chip insistia em "Vale em todos".
    // A estante de livros já fazia isto (`_lerLivro = livros.find(...)`) desde
    // o merge por item; o audiolivro tinha ficado de fora.
    if (typeof _abLivro !== 'undefined' && _abLivro) {
      const novo = audiolivros.find(x => x.id === _abLivro.id)
      if (novo) _abLivro = novo
    }
    saveAudiolivros()
  }
  if (docs.known) {
    // União COM LÁPIDE (rodada 44): marcar no celular vale no computador, e
    // agora DESMARCAR também — a lápide de desmarcação viaja no mesmo doc e o
    // merge é o mesmo da subida (uma regra, dois usuários).
    if (typeof mesclarConhecidasComNuvem === 'function') mesclarConhecidasComNuvem(docs.known)
    else {
      knownWords = { ...knownWords, ...(docs.known.map || {}) }; saveKnownLocal()
      ignoredWords = { ...ignoredWords, ...(docs.known.ignored || {}) }; saveIgnoredLocal()
      knownSenses = { ...knownSenses, ...(docs.known.senses || {}) }; saveKnownSenses()
    }
  }
  if (docs.clips)    { clips  = docs.clips.list  || []; saveClips() }
  // Programas de podcast: adota a nuvem (como videos/clips) para que tirar um
  // programa da lista num aparelho valha em todos. São só ponteiros (nome,
  // capa, URL do feed) — nenhum áudio sobe.
  if (docs.podShows) { podShows = docs.podShows.list || []; savePodShows() }
  // Histórico do Kindle: UNIÃO (aqui é a exceção à regra do "adota a nuvem").
  // Marca de "já importei" nunca deve ser desfeita por um aparelho atrasado —
  // desfazê-la faria a importação seguinte ressuscitar centenas de itens.
  if (docs.kindleSeen && Array.isArray(docs.kindleSeen.list)) {
    // Época do reset primeiro (rodada 44): nuvem resetada depois de mim =
    // meu histórico é pré-reset e sai; só então vale a união de sempre.
    const adotou = typeof kindleAdotarReset === 'function' &&
      kindleAdotarReset(docs.kindleSeen.resetAt, docs.kindleSeen.list)
    if (!adotou && (Number(docs.kindleSeen.resetAt) || 0) >= (typeof kindleResetAt === 'function' ? kindleResetAt() : 0)) {
      const uniao = loadKindleSeen()
      docs.kindleSeen.list.forEach(h => uniao.add(h))
      saveKindleSeen(uniao)
    }
  }
  if (docs.kindleQueue) {
    const seen = loadKindleSeen()
    kindleItems = (docs.kindleQueue.list || []).filter(it => !kindleItemVisto(it, seen))
    localStorage.setItem(SK.kindleQueue, JSON.stringify(kindleItems))
  }
  if (docs.conversas) {
    // Merge por id mantendo a versão mais recente (updated_at). Evita que um
    // snapshot da nuvem apague uma conversa recém-criada local ainda não enviada.
    const cloudConvs = docs.conversas.list || []
    const byId = {}
    cloudConvs.forEach(c => { if (c && c.id) byId[c.id] = c })
    conversas.forEach(c => {
      if (!c || !c.id) return
      const cloud = byId[c.id]
      if (!cloud) { byId[c.id] = c; return }
      if ((c.updated_at || 0) > (cloud.updated_at || 0)) byId[c.id] = c
    })
    conversas = Object.values(byId).sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
    saveConversas()
  }
  if (docs.cfg) {
    const c = docs.cfg
    if (c.openaiKey)   cfg.openaiKey   = c.openaiKey
    if (c.geminiKey)   cfg.geminiKey   = c.geminiKey
    if (c.groqKey)     cfg.groqKey     = c.groqKey
    if (c.aiModelProv) cfg.aiModelProv = c.aiModelProv
    if (c.vidPT !== undefined) cfg.vidPT = c.vidPT
    if (c.sttProvider) cfg.sttProvider = c.sttProvider
    if (c.imgProvider) cfg.imgProvider = c.imgProvider
    if (c.theme)       cfg.theme       = c.theme
    if (c.aiProvider)  cfg.aiProvider  = c.aiProvider
    if (c.aiModel)     cfg.aiModel     = c.aiModel
    if (c.ttsProvider) cfg.ttsProvider = c.ttsProvider
    if (c.subAddons != null) cfg.subAddons = c.subAddons
    // Os que o push sempre mandou e a descida ignorava (rodada 44): mudar o
    // nível do aluno no celular passava a valer no computador só pelo botão
    // manual "Baixar" — o caminho normal (snapshot) os deixava para trás.
    if (c.accent != null)     cfg.accent     = c.accent
    if (c.themeDark)          cfg.themeDark  = c.themeDark
    if (c.themeLight)         cfg.themeLight = c.themeLight
    if (c.imgQuality)         cfg.imgQuality = c.imgQuality
    if (c.nivelAluno)         cfg.nivelAluno = c.nivelAluno
    if (c.activeLang)         cfg.activeLang = c.activeLang
    if (c.autoMeta   !== undefined) cfg.autoMeta   = c.autoMeta
    if (c.catalogoIA !== undefined) cfg.catalogoIA = c.catalogoIA
    if (c.googleBooksKey)     cfg.googleBooksKey = c.googleBooksKey
    if (c.estante)            cfg.estante = c.estante
    saveCfg()
    if (typeof applyTheme === 'function') applyTheme(cfg.theme)
  }
  _refreshActiveViews()
}

// Aplica cards que chegaram da nuvem durante uma sessão (chamado ao encerrar)
// ⚠️ DENTRO DA TRAVA (rodada 44): isto substitui a lista por uma foto guardada
// da nuvem, e sem a trava o `marcarSumidosCards` do save carimbaria como
// "removido" todo card local ausente da foto — lápide errada que o próximo
// push levaria à nuvem. Mesma guarda do applyCloudDocs, pelo mesmo motivo.
function flushPendingCloudCards() {
  if (!_pendingCloudCards) return
  const cards = _pendingCloudCards
  _pendingCloudCards = null
  const temTrava = typeof fbAplicandoNuvem !== 'undefined'
  if (temTrava) fbAplicandoNuvem = true
  try { srsCards = cards; saveSrsCards() } finally { if (temTrava) fbAplicandoNuvem = false }
  _refreshActiveViews()
}

// Re-renderiza a tela ativa após adotar dados da nuvem
function _refreshActiveViews() {
  try {
    if (typeof renderDashboard === 'function') renderDashboard()
    if (typeof updateSrsBadge === 'function') updateSrsBadge()
    const active = id => document.getElementById(id)?.classList.contains('active')
    if (active('section-assistente') && typeof renderAssistente === 'function') renderAssistente()
    // Os nomes trocaram de lugar (ver SECTIONS em core.js): preparar = a fila
    // da IA (review.js), revisar = o SRS (study.js), estudar = os dossiês.
    if (active('section-preparar') && typeof renderReview === 'function')     renderReview()
    if (active('section-revisar')  && typeof renderSrsSection === 'function' && !srsSession) renderSrsSection()
    if (active('section-estudar')  && typeof renderDossieSection === 'function') renderDossieSection()
    if (active('section-biblioteca') && typeof openBiblioteca === 'function') openBiblioteca()
    if (active('section-configuracoes') && typeof fillSettings === 'function') fillSettings()
    if (active('section-video') && typeof renderVideoSection === 'function') renderVideoSection()
  } catch(e) { console.warn('[refreshViews]', e.message) }
}

// Restaura áudio e imagens do Firestore para o IndexedDB (uma vez ao conectar)
async function fbPullMedia() {
  if (!_fbUser || !_fbDb) return
  try {
    const base = _fbDb.collection('users').doc(_fbUser.uid)
    const audioDocs = await base.collection('audio').get()
    const audioMap = {}; audioDocs.forEach(d => { audioMap[d.id] = d.data().data })
    if (Object.keys(audioMap).length) { await AudioDB.setAll(audioMap); _audioKeyCache = new Set(Object.keys(audioMap)) }
    const imageDocs = await base.collection('images').get()
    const imageMap = {}; imageDocs.forEach(d => { imageMap[d.id] = d.data().data })
    if (Object.keys(imageMap).length) { await ImageDB.setAll(imageMap); _imageKeyCache = new Set(Object.keys(imageMap)) }
  } catch(e) { console.warn('[Firebase] media pull error:', e.code || e.message) }
}

// Apaga apenas áudio e imagens da nuvem (os dados são zerados via push de listas vazias)
async function fbWipeMedia() {
  if (!_fbDb || !_fbUser) return
  try {
    const base = _fbDb.collection('users').doc(_fbUser.uid)
    const [a, i] = await Promise.all([base.collection('audio').get(), base.collection('images').get()])
    const refs = [...a.docs, ...i.docs].map(d => d.ref)
    for (let k = 0; k < refs.length; k += 450) {
      const batch = _fbDb.batch()
      refs.slice(k, k + 450).forEach(r => batch.delete(r))
      await batch.commit()
    }
    // E o Storage junto: "apagar a mídia da nuvem" que deixasse metade para
    // trás seria pior que não existir — ele apagaria achando que limpou.
    for (const tipo of ['audio', 'images']) {
      if (!_fbStore) break
      try {
        const r = await _fbStore.ref(`users/${_fbUser.uid}/${tipo}`).listAll()
        for (const it of r.items) { try { await it.delete() } catch (e) {} }
      } catch (e) {}
    }
  } catch(e) { console.warn('[Firebase] fbWipeMedia erro:', e.code || e.message) }
}

// ================================================================
// MIGRAÇÃO: tira a mídia de dentro do banco
// ================================================================
// Conserto de código não move dado já gravado (a lição de sempre). Sobe cada
// item para o Storage e SÓ ENTÃO apaga do banco — nessa ordem, um erro no meio
// deixa cópia sobrando, nunca buraco. Como o pull lê dos dois lugares, a cópia
// sobrando é inofensiva.
async function migrarMidiaParaStorage(aoAndar) {
  if (!_fbDb || !_fbUser) return { erro: 'entre na sua conta primeiro' }
  if (!_fbStore) return { erro: 'o módulo de arquivos não carregou — recarregue a página' }
  const base = _fbDb.collection('users').doc(_fbUser.uid)
  const r = { audio: 0, images: 0, bytes: 0, falhas: 0 }
  for (const tipo of ['audio', 'images']) {
    let docs
    try { docs = await base.collection(tipo).get() } catch (e) { continue }
    const total = docs.size
    let n = 0
    for (const d of docs.docs) {
      const val = d.data().data
      if (!val) { try { await d.ref.delete() } catch (e) {} ; continue }
      try {
        await mediaSubir(tipo, d.id, val)
        await d.ref.delete()
        r[tipo]++
        r.bytes += String(val).length
      } catch (e) { r.falhas++ }
      if (aoAndar) aoAndar(tipo, ++n, total)
    }
  }
  return r
}

// ---- Auto-sync com debounce ----
async function autoSyncAfterChange() {
  if (!_fbUser) return
  // A bandeira nasce ANTES do debounce: se a aba fechar dentro dos 1,2s, o
  // próximo boot sabe que há mudança presa aqui e empurra antes de adotar a
  // nuvem (ver attachRealtimeSync).
  _fbDirtySeq++
  try { localStorage.setItem(SK_SYNC_PENDENTE, '1') } catch (e) {}
  clearTimeout(_fbSyncTimer)
  // Usa só fbPushData (sem áudio/imagem) — rápido e não esgota cota
  _fbSyncTimer = setTimeout(async () => {
    await fbPushData()
  }, 1200)
}

async function fbForcePush() {
  const statusBox = el('fb-sync-status')
  const dot = el('fb-status-dot')
  const msg = el('fb-status-msg')
  if (statusBox) statusBox.classList.remove('hidden')
  if (dot) dot.className = 'sync-dot syncing'
  if (msg) msg.textContent = 'Enviando dados...'
  const ok = await fbPush()
  if (dot) dot.className = 'sync-dot ' + (ok ? 'ok' : 'err')
  if (msg) msg.textContent = ok ? 'Dados enviados com sucesso.' : 'Erro ao enviar.'
  if (ok) toast('Dados enviados para o Firebase', 'success')
}

async function fbForcePull() {
  const statusBox = el('fb-sync-status')
  const dot = el('fb-status-dot')
  const msg = el('fb-status-msg')
  if (statusBox) statusBox.classList.remove('hidden')
  if (dot) dot.className = 'sync-dot syncing'
  if (msg) msg.textContent = 'Baixando dados...'
  let ok = false
  try {
    const dataCol = _fbDb.collection('users').doc(_fbUser.uid).collection('data')
    const snap = await dataCol.get()
    const docs = {}; snap.forEach(d => { docs[d.id] = d.data() })
    applyCloudDocs(docs)
    await fbPullMedia()
    ok = true
  } catch(e) { console.warn('[Firebase] forcePull erro:', e.message) }
  if (dot) dot.className = 'sync-dot ' + (ok ? 'ok' : 'err')
  if (msg) msg.textContent = ok ? 'Dados baixados com sucesso.' : 'Erro ao baixar.'
  if (ok) toast('Dados sincronizados com a nuvem', 'success')
}

// Zera TODOS os dados do usuário na nuvem. Usado pelo "Apagar tudo".
// ⚠️ OS DOCS DE `data` SÃO ESVAZIADOS, NÃO APAGADOS (rodada 44) — e a
// diferença é o que faz o zerar PROPAGAR: a descida ignora documento ausente
// (de propósito, para não zerar aparelho que nunca sincronizou), então
// deletar os docs deixaria cada outro aparelho intacto, e o primeiro push
// deles re-encheria a nuvem. Documento presente com lista vazia é adotado —
// é o caminho oficial de uma exclusão. As épocas de reset vão junto, porque
// `known` e `kindleSeen` sincronizam por união e só uma época os zera.
// `gerado`, `audio` e `images` (documentos avulsos) são apagados de verdade,
// e o Storage inteiro também.
async function fbWipeCloud() {
  if (!_fbDb || !_fbUser) return false
  // Cancela syncs pendentes para não re-enviar dados depois de apagar
  clearTimeout(_fbSyncTimer)
  clearTimeout(_fbAudioSyncTimer)
  updateSyncNav('syncing')
  try {
    const base = _fbDb.collection('users').doc(_fbUser.uid)
    const agora = Date.now()
    const zera = _fbDb.batch()
    for (const nome of ['words', 'srsCards', 'srsLog', 'srsDecks', 'conversas',
                        'videos', 'clips', 'podShows', 'livros', 'audiolivros', 'kindleQueue']) {
      zera.set(base.collection('data').doc(nome), { list: [], updatedAt: agora })
    }
    zera.set(base.collection('data').doc('kindleSeen'),
      { list: [], resetAt: agora, updatedAt: agora })
    zera.set(base.collection('data').doc('known'),
      { map: {}, ignored: {}, senses: {}, unmarked: {}, resetAt: agora, updatedAt: agora })
    zera.set(base.collection('data').doc('srsCfg'), { updatedAt: agora })
    zera.set(base.collection('data').doc('cfg'), { updatedAt: agora })
    await zera.commit()
    // `gerado` (análises pagas de capítulo — raio-X, pré-estudo, quebras,
    // mapas de sincronia), áudio e imagens: documentos avulsos, sem lista —
    // estes sim são apagados. A descida não os escuta, então não há o que
    // propagar por aqui.
    const [audioDocs, imageDocs, geradoDocs] = await Promise.all([
      base.collection('audio').get(),
      base.collection('images').get(),
      base.collection('gerado').get()
    ])
    const refs = [...audioDocs.docs, ...imageDocs.docs, ...geradoDocs.docs].map(d => d.ref)
    // Firestore: máximo de 500 operações por batch
    for (let i = 0; i < refs.length; i += 450) {
      const batch = _fbDb.batch()
      refs.slice(i, i + 450).forEach(ref => batch.delete(ref))
      await batch.commit()
    }
    // A mídia agora vive FORA do banco: apagar só os documentos deixaria os
    // arquivos na nuvem depois de ele mandar apagar tudo — a pior forma de
    // errar, porque ele sai achando que limpou. A lista cobre TODAS as pastas
    // que o app grava (audiolivros têm subpasta por item — um nível a mais).
    let arquivos = 0
    const apagarPasta = async ref => {
      const r = await ref.listAll()
      for (const it of r.items) { try { await it.delete(); arquivos++ } catch (e) {} }
      for (const sub of r.prefixes) { try { await apagarPasta(sub) } catch (e) {} }
    }
    for (const tipo of ['audio', 'images', 'livros', 'audiolivros', 'midia', 'subs']) {
      if (!_fbStore) break
      try { await apagarPasta(_fbStore.ref(`users/${_fbUser.uid}/${tipo}`)) } catch (e) {}
    }
    console.log(`[Firebase] nuvem apagada: ${refs.length} documentos, ${arquivos} arquivos`)
    updateSyncNav('off')
    return true
  } catch (e) {
    console.warn('[Firebase] fbWipeCloud erro:', e.code || e.message)
    updateSyncNav('err')
    return false
  }
}

// Mantém compatibilidade com chamadas legadas do Gist
async function initCloudSync() { initFirebase() }

function gistHeaders() { return {} } // legacy stub

