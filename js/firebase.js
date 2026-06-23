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
  if (!ind) return
  if (state === 'off') { ind.classList.add('hidden'); return }
  ind.classList.remove('hidden')
  dot.className = 'sync-dot' + (state === 'ok' ? ' ok' : state === 'err' ? ' err' : state === 'syncing' ? ' syncing' : '')
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
let _fbSyncTimer = null
let _fbAudioSyncTimer = null

// Sincroniza APENAS áudios novos — roda após um delay longo para acumular mudanças
async function autoSyncAudioAfterChange() {
  if (!_fbUser || !_fbDb) return
  clearTimeout(_fbAudioSyncTimer)
  _fbAudioSyncTimer = setTimeout(async () => {
    try {
      const base = _fbDb.collection('users').doc(_fbUser.uid)
      const audioData = await AudioDB.getAll()
      const existing = await base.collection('audio').get()
      const existingKeys = new Set(existing.docs.map(d => d.id))
      const newEntries = Object.entries(audioData).filter(([k]) => !existingKeys.has(k))
      if (!newEntries.length) return
      for (const [key, val] of newEntries) {
        await base.collection('audio').doc(key).set({ data: val, updatedAt: Date.now() })
      }
      console.log(`[Firebase] Audio sync: ${newEntries.length} novos áudios enviados`)
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
    // Garante que a sessão de login sobreviva a refresh / fechar e reabrir a aba
    _fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e =>
      console.warn('[Firebase] setPersistence falhou:', e.message))
    _fbAuth.onAuthStateChanged(user => {
      _fbUser = user
      updateFirebaseUI(user)
      if (user) {
        // Sincronização em tempo real (a nuvem é a fonte da verdade)
        attachRealtimeSync()
      } else {
        detachRealtimeSync()
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
  const loggedOut  = el('fb-settings-logged-out')
  const loggedIn   = el('fb-settings-logged-in')

  if (user) {
    if (loginBtn)  loginBtn.style.display  = 'none'
    if (userChip)  userChip.style.display  = 'flex'
    const photo = el('fb-user-photo')
    const name  = el('fb-user-name')
    if (photo && user.photoURL) { photo.src = user.photoURL; photo.style.display = 'block' }
    if (name) name.textContent = user.displayName || user.email
    if (loggedOut) loggedOut.style.display = 'none'
    if (loggedIn)  loggedIn.style.display  = 'block'
    const emailEl = el('fb-settings-email')
    if (emailEl) emailEl.textContent = user.displayName || user.email
  } else {
    if (loginBtn)  loginBtn.style.display  = 'block'
    if (userChip)  { userChip.style.display = 'none'; userChip.style.cssText += ';display:none' }
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
  if (!confirm('Sair da conta Google? Os dados locais são mantidos.')) return
  await _fbAuth?.signOut()
  updateSyncNav('off')
  toast('Saiu da conta.', 'info')
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
    // Configurações da conta (chave OpenAI, URL do n8n, tema, providers).
    // IMPORTANTE: usamos merge:true e SÓ incluímos chave/URL quando NÃO estão vazias.
    // Assim, uma sessão/dispositivo sem a chave nunca apaga o valor já salvo na nuvem.
    const cfgPayload = {
      theme:       cfg.theme        || 'midnight',
      aiProvider:  cfg.aiProvider   || 'openai',
      aiModel:     cfg.aiModel       || '',
      ttsProvider: cfg.ttsProvider   || 'openai',
      updatedAt: Date.now()
    }
    if (cfg.openaiKey) cfgPayload.openaiKey = cfg.openaiKey
    if (cfg.n8nBase)   cfgPayload.n8nBase   = cfg.n8nBase
    batch.set(base.collection('data').doc('cfg'), cfgPayload, { merge: true })
    if (kindleItems.length > 0) {
      batch.set(base.collection('data').doc('kindleQueue'), { list: kindleItems, updatedAt: Date.now() })
    }
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
    const base = _fbDb.collection('users').doc(_fbUser.uid)

    // Áudios — só escreve os que ainda não existem no Firestore
    const audioData = await AudioDB.getAll()
    const existingAudio = await base.collection('audio').get()
    const existingAudioKeys = new Set(existingAudio.docs.map(d => d.id))
    const newAudioEntries = Object.entries(audioData).filter(([k]) => !existingAudioKeys.has(k))
    for (const [key, val] of newAudioEntries) {
      await base.collection('audio').doc(key).set({ data: val, updatedAt: Date.now() })
    }

    // Imagens — idem
    const imageData = await ImageDB.getAll()
    const existingImages = await base.collection('images').get()
    const existingImageKeys = new Set(existingImages.docs.map(d => d.id))
    const newImageEntries = Object.entries(imageData).filter(([k]) => !existingImageKeys.has(k))
    for (const [key, val] of newImageEntries) {
      await base.collection('images').doc(key).set({ data: val, updatedAt: Date.now() })
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

    // Configurações da conta — restaura chave OpenAI / URL n8n / tema / providers.
    // Merge seguro: usa o valor da nuvem só quando não estiver vazio,
    // para não apagar configurações locais quando a nuvem ainda está em branco.
    const cfgDoc2 = await base.collection('data').doc('cfg').get()
    if (cfgDoc2.exists) {
      const c = cfgDoc2.data() || {}
      if (c.openaiKey)   cfg.openaiKey   = c.openaiKey
      if (c.n8nBase)     cfg.n8nBase     = c.n8nBase
      if (c.theme)       cfg.theme       = c.theme
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

    const kindleDoc = await base.collection('data').doc('kindleQueue').get()
    if (kindleDoc.exists && kindleDoc.data().list?.length > 0) {
      const seen = loadKindleSeen()
      kindleItems = (kindleDoc.data().list || []).filter(item => !seen.has(kindleHighlightHash(item.context || item.word)))
      localStorage.setItem(SK.kindleQueue, JSON.stringify(kindleItems))
    }

    // Áudios — restaurar no IndexedDB
    const audioDocs = await base.collection('audio').get()
    const audioMap = {}
    audioDocs.forEach(d => { audioMap[d.id] = d.data().data })
    if (Object.keys(audioMap).length > 0) {
      await AudioDB.setAll(audioMap)
      _audioKeyCache = new Set(Object.keys(audioMap))
    }

    // Imagens
    const imageDocs = await base.collection('images').get()
    const imageMap = {}
    imageDocs.forEach(d => { imageMap[d.id] = d.data().data })
    if (Object.keys(imageMap).length > 0) {
      await ImageDB.setAll(imageMap)
      _imageKeyCache = new Set(Object.keys(imageMap))
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
  if (docs.kindleQueue) {
    const seen = (typeof loadKindleSeen === 'function') ? loadKindleSeen() : new Set()
    kindleItems = (docs.kindleQueue.list || []).filter(it =>
      typeof kindleHighlightHash !== 'function' || !seen.has(kindleHighlightHash(it.context || it.word)))
    localStorage.setItem(SK.kindleQueue, JSON.stringify(kindleItems))
  }
  if (docs.cfg) {
    const c = docs.cfg
    if (c.openaiKey)   cfg.openaiKey   = c.openaiKey
    if (c.n8nBase)     cfg.n8nBase     = c.n8nBase
    if (c.theme)       cfg.theme       = c.theme
    if (c.aiProvider)  cfg.aiProvider  = c.aiProvider
    if (c.aiModel)     cfg.aiModel     = c.aiModel
    if (c.ttsProvider) cfg.ttsProvider = c.ttsProvider
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
    if (active('section-revisar')  && typeof renderReview === 'function')     renderReview()
    if (active('section-estudar')  && typeof renderSrsSection === 'function' && !srsSession) renderSrsSection()
    if (active('section-biblioteca') && typeof openBiblioteca === 'function') openBiblioteca()
    if (active('section-configuracoes') && typeof fillSettings === 'function') fillSettings()
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
  } catch(e) { console.warn('[Firebase] fbWipeMedia erro:', e.code || e.message) }
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
  if (msg) msg.textContent = ok ? '✅ Dados enviados com sucesso!' : '❌ Erro ao enviar.'
  if (ok) toast('⬆ Dados enviados para o Firebase!', 'success')
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
  if (msg) msg.textContent = ok ? '✅ Dados baixados com sucesso!' : '❌ Erro ao baixar.'
  if (ok) toast('⬇ Dados sincronizados com a nuvem!', 'success')
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
    console.log(`[Firebase] nuvem apagada: ${refs.length} documentos`)
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

