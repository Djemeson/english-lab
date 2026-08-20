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
async function midiaGarantirLocal(id, aoAndar) {
  if (typeof VideoDB === 'undefined') return null
  try {
    const jaTem = await VideoDB.get('files', id)
    if (jaTem) return jaTem
    const r = _midiaRef('midia', id); if (!r) return null
    if (aoAndar) aoAndar('baixando o episódio da sua nuvem')
    const url = await r.getDownloadURL()
    const blob = await (await fetch(url)).blob()
    await VideoDB.set('files', id, blob)
    return blob
  } catch (e) { return null }
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
    if (name) name.textContent = user.displayName || user.email
    
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
async function fbPushData() {
  if (!_fbUser || !_fbDb) return false
  updateSyncNav('syncing')
  try {
    const base = _fbDb.collection('users').doc(_fbUser.uid)
    const batch = _fbDb.batch()
    batch.set(base.collection('data').doc('words'),    { list: words,     updatedAt: Date.now() })
    batch.set(base.collection('data').doc('srsCards'), { list: srsCards,  updatedAt: Date.now() })
    batch.set(base.collection('data').doc('srsCfg'),   { ...srsCfg,       updatedAt: Date.now() })
    batch.set(base.collection('data').doc('srsLog'),   { list: srsLog,    updatedAt: Date.now() })
    batch.set(base.collection('data').doc('srsDecks'), { list: srsDecks,  updatedAt: Date.now() })
    // Configurações da conta (chave OpenAI, tema, providers).
    // IMPORTANTE: usamos merge:true e SÓ incluímos a chave quando NÃO está vazia.
    // Assim, um dispositivo sem a chave nunca apaga o valor já salvo na nuvem.
    const cfgPayload = {
      theme:       cfg.theme        || 'midnight',
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
    batch.set(base.collection('data').doc('cfg'), cfgPayload, { merge: true })
    if (kindleItems.length > 0) {
      batch.set(base.collection('data').doc('kindleQueue'), { list: kindleItems, updatedAt: Date.now() })
    }
    // Histórico do Kindle: sem ele na nuvem, importar o vocab.db no PC e depois
    // abrir o Lab no celular traria TUDO de novo — o "só o novo entra" só vale
    // se o "já entrou" for o mesmo em todo aparelho.
    batch.set(base.collection('data').doc('kindleSeen'), { list: [...loadKindleSeen()], updatedAt: Date.now() })
    batch.set(base.collection('data').doc('conversas'), { list: conversas, updatedAt: Date.now() })
    // Vídeo: só METADADOS (títulos, marcadores, cortes) — o arquivo de vídeo
    // nunca sobe (300MB–2GB × limite de 1MB/doc). Legendas ficam locais (IDB).
    batch.set(base.collection('data').doc('videos'), { list: videos, updatedAt: Date.now() })
    // Ebooks: metadados, sumário, ONDE VOCÊ PAROU e os destaques. O arquivo
    // (MBs) fica no IndexedDB de cada aparelho — mesma regra do vídeo.
    batch.set(base.collection('data').doc('livros'), { list: livros, updatedAt: Date.now() })
    batch.set(base.collection('data').doc('known'), { map: knownWords || {}, ignored: ignoredWords || {}, updatedAt: Date.now() })
    batch.set(base.collection('data').doc('clips'),  { list: clips,  updatedAt: Date.now() })
    // Podcasts: só a lista de programas visitados (ponteiros). O episódio em si
    // já viaja em `videos` e o mp3 nunca sobe.
    batch.set(base.collection('data').doc('podShows'), { list: podShows || [], updatedAt: Date.now() })
    await batch.commit()
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
    for (const l of livros) {
      if (nuvem.some(r => r.id === l.id)) continue
      if ((l.addedAt || 0) > carimbo || l.id === abertoId) juntos.push(l)
    }
    livros = juntos
    if (abertoId && typeof _lerLivro !== 'undefined') {
      _lerLivro = livros.find(l => l.id === abertoId) || _lerLivro
    }
    saveLivros()
  }
  if (docs.known)    { knownWords = { ...knownWords, ...(docs.known.map || {}) }; saveKnownLocal()
                       ignoredWords = { ...ignoredWords, ...(docs.known.ignored || {}) }; saveIgnoredLocal() }
  if (docs.clips)    { clips  = docs.clips.list  || []; saveClips() }
  // Programas de podcast: adota a nuvem (como videos/clips) para que tirar um
  // programa da lista num aparelho valha em todos. São só ponteiros (nome,
  // capa, URL do feed) — nenhum áudio sobe.
  if (docs.podShows) { podShows = docs.podShows.list || []; savePodShows() }
  // Histórico do Kindle: UNIÃO (aqui é a exceção à regra do "adota a nuvem").
  // Marca de "já importei" nunca deve ser desfeita por um aparelho atrasado —
  // desfazê-la faria a importação seguinte ressuscitar centenas de itens.
  if (docs.kindleSeen && Array.isArray(docs.kindleSeen.list)) {
    const uniao = loadKindleSeen()
    docs.kindleSeen.list.forEach(h => uniao.add(h))
    saveKindleSeen(uniao)
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
    saveCfg()
    if (typeof applyTheme === 'function') applyTheme(cfg.theme)
  }
  _refreshActiveViews()
}

// Aplica cards que chegaram da nuvem durante uma sessão (chamado ao encerrar)
function flushPendingCloudCards() {
  if (_pendingCloudCards) {
    srsCards = _pendingCloudCards; _pendingCloudCards = null
    saveSrsCards(); _refreshActiveViews()
  }
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

// Apaga TODOS os dados do usuário no Firestore (data + audio + images).
// Usado pelo "Limpar tudo" — sem isso, ao reconectar a nuvem restaura tudo.
async function fbWipeCloud() {
  if (!_fbDb || !_fbUser) return false
  // Cancela syncs pendentes para não re-enviar dados depois de apagar
  clearTimeout(_fbSyncTimer)
  clearTimeout(_fbAudioSyncTimer)
  updateSyncNav('syncing')
  try {
    const base = _fbDb.collection('users').doc(_fbUser.uid)
    const [dataDocs, audioDocs, imageDocs] = await Promise.all([
      base.collection('data').get(),
      base.collection('audio').get(),
      base.collection('images').get()
    ])
    const refs = [...dataDocs.docs, ...audioDocs.docs, ...imageDocs.docs].map(d => d.ref)
    // Firestore: máximo de 500 operações por batch
    for (let i = 0; i < refs.length; i += 450) {
      const batch = _fbDb.batch()
      refs.slice(i, i + 450).forEach(ref => batch.delete(ref))
      await batch.commit()
    }
    // A mídia agora vive FORA do banco: apagar só os documentos deixaria os
    // arquivos na nuvem depois de ele mandar apagar tudo — a pior forma de
    // errar, porque ele sai achando que limpou.
    let arquivos = 0
    for (const tipo of ['audio', 'images', 'livros']) {
      if (!_fbStore) break
      try {
        const r = await _fbStore.ref(`users/${_fbUser.uid}/${tipo}`).listAll()
        for (const it of r.items) { try { await it.delete(); arquivos++ } catch (e) {} }
      } catch (e) {}
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

