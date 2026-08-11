// ================================================================
// STATE & STORAGE
// ================================================================
const SK = { settings: 'englab_cfg', words: 'englab_words', srsCards: 'el-srs-cards', srsCfg: 'el-srs-cfg', srsLog: 'el-srs-log', srsDecks: 'el-srs-decks', kindleSeen: 'el-kindle-seen', kindleQueue: 'el-kindle-queue', deletedWords: 'el-deleted-words', conversas: 'el-consulta-conversas', videos: 'el-videos', clips: 'el-clips', podShows: 'el-podcasts', livros: 'el-livros' }

// ── VÍDEO (estado em core, como conversas): firebase.js sincroniza videos/
//    clips e por isso eles NÃO podem morar no lazy video.js (armadilha nº 1).
//    O arquivo de vídeo em si NUNCA entra aqui — só metadados (KBs).
let videos = []   // [{id,title,source_type,lang,duration,coverage,markers[],created_at,updated_at}]
let clips  = []   // [{id,videoId,start,end,text,wordId,created_at}]
function loadVideos() { try { videos = JSON.parse(localStorage.getItem(SK.videos) || '[]') } catch { videos = [] } }
function saveVideos() { localStorage.setItem(SK.videos, JSON.stringify(videos)) }
function loadClips()  { try { clips = JSON.parse(localStorage.getItem(SK.clips) || '[]') } catch { clips = [] } }
function saveClips()  { localStorage.setItem(SK.clips, JSON.stringify(clips)) }

// ── LEITOR DE EBOOKS: metadados dos livros da estante.
//    Mesma regra de videos/clips: o ARQUIVO do livro nunca entra aqui (fica
//    no IndexedDB, em BookDB) — só o que é leve e precisa viajar entre
//    aparelhos: título, autor, sumário, ONDE VOCÊ PAROU e os destaques.
//    Mora no core porque firebase.js sincroniza (armadilha nº 1).
let livros = []   // [{id,title,author,lang,format,cover,chapters[],pos,notes[],stats,...}]
function loadLivros() { try { livros = JSON.parse(localStorage.getItem(SK.livros) || '[]') } catch { livros = [] } }
function saveLivros() {
  try { localStorage.setItem(SK.livros, JSON.stringify(livros)) }
  catch (e) { console.warn('[livros] save falhou:', e.message) }
}
function livroPorId(id) { return livros.find(l => l.id === id) || null }

// Arquivo do livro (epub/txt): IndexedDB, nunca localStorage (são MBs) e
// nunca a nuvem (o Firestore tem teto de 1 MB por documento).
const BookDB = {
  _db: null,
  async open() {
    if (this._db) return this._db
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('english-lab-books', 1)
      req.onupgradeneeded = e => e.target.result.createObjectStore('files')
      req.onsuccess = e => { this._db = e.target.result; resolve(this._db) }
      req.onerror = () => reject(req.error)
    })
  },
  async get(id) {
    try {
      const db = await this.open()
      return await new Promise(res => {
        const r = db.transaction('files', 'readonly').objectStore('files').get(id)
        r.onsuccess = () => res(r.result || null); r.onerror = () => res(null)
      })
    } catch { return null }
  },
  async set(id, blob) {
    const db = await this.open()
    return new Promise((res, rej) => {
      const tx = db.transaction('files', 'readwrite')
      tx.objectStore('files').put(blob, id)
      tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error)
    })
  },
  async del(id) {
    try {
      const db = await this.open()
      return await new Promise(res => {
        const tx = db.transaction('files', 'readwrite')
        tx.objectStore('files').delete(id)
        tx.oncomplete = () => res(true); tx.onerror = () => res(false)
      })
    } catch { return false }
  },
  async keys() {
    try {
      const db = await this.open()
      return await new Promise(res => {
        const r = db.transaction('files', 'readonly').objectStore('files').getAllKeys()
        r.onsuccess = () => res(r.result || []); r.onerror = () => res([])
      })
    } catch { return [] }
  }
}

// ── PODCASTS: programas já visitados ("Seus podcasts" no buscador).
//    Mora aqui pelo mesmo motivo de videos/clips: firebase.js sincroniza e
//    NÃO pode depender do lazy video-podcast.js (armadilha nº 1).
//    São só ponteiros (nome, capa, URL do feed) — nenhum áudio.
let podShows = []   // [{title, artist, artwork, feedUrl, collectionId, addedAt}]
function loadPodShows() { try { podShows = JSON.parse(localStorage.getItem(SK.podShows) || '[]') } catch { podShows = [] } }
function savePodShows() { localStorage.setItem(SK.podShows, JSON.stringify(podShows)) }

// "Rever a cena" a partir do estudo: study.js (lazy) não pode chamar funções
// de video.js (lazy) — este handoff vive no core: guarda o clipe pedido e
// navega; video.js consome _pendingClipPlay ao ativar a seção.
let _pendingClipPlay = null
function reverCena(clipId) { _pendingClipPlay = clipId; showSection('video') }

function loadDeletedIds() { try { return new Set(JSON.parse(localStorage.getItem(SK.deletedWords) || '[]')) } catch { return new Set() } }
function saveDeletedIds(ids) { localStorage.setItem(SK.deletedWords, JSON.stringify([...ids])) }
function markDeleted(id) { const ids = loadDeletedIds(); ids.add(id); saveDeletedIds(ids) }

const DEF_CFG = {
  // ⚠️ O padrão de instalação NOVA. Ficou para trás quando a Luna virou o
  // modelo do app: `migrarModeloPadrao()` conserta quem já existia, mas quem
  // instalasse hoje nasceria no modelo antigo e só seria movido no boot
  // seguinte. O padrão tem de ser o padrão nos dois caminhos.
  aiProvider: 'openai', aiModel: 'gpt-5.6-luna', ttsProvider: 'openai',
  openaiKey: '', geminiKey: '', groqKey: '',
  aiModelProv: {},
  vidPT: '',        // modo de tradução no vídeo, lembrado entre sessões
  sttProvider: 'auto',  // quem transcreve: auto (Groq se houver chave) | groq | openai
  imgProvider: 'openai',// quem gera as imagens: openai | gemini
  // FALTAVA aqui, e o buraco custava dinheiro: sem `imgQuality` no padrão,
  // `aiImgNivel()` caía em 'medium' — no Gemini isso é o 3.1 Flash a
  // US$ 0,067 em vez do 2.5 Flash a US$ 0,039, 1,7× mais caro, sem ninguém
  // pedir. Para ilustrar card de vocabulário, o nível econômico basta.
  imgQuality: 'low',
  // Nível do aluno no QECR/CEFR. É a régua da triagem por nível do leitor:
  // palavra classificada ABAIXO dele já entra marcada como conhecida, e ele
  // só desmarca a exceção — em vez de marcar centenas uma a uma.
  nivelAluno: 'B1',
  theme: 'midnight'
}

// A escala inteira, em ordem. `i` é o que permite comparar ("é menor que o
// meu?") sem espalhar if/else pelo código.
const CEFR = [
  { id: 'A1', i: 0, nome: 'A1 — iniciante',      dica: 'as 500 palavras mais comuns' },
  { id: 'A2', i: 1, nome: 'A2 — básico',         dica: 'dia a dia, presente e passado simples' },
  { id: 'B1', i: 2, nome: 'B1 — intermediário',  dica: 'lê notícia e diálogo comum sem travar' },
  { id: 'B2', i: 3, nome: 'B2 — intermediário alto', dica: 'lê romance e texto técnico com esforço' },
  { id: 'C1', i: 4, nome: 'C1 — avançado',       dica: 'literatura, ironia, registro formal' },
  { id: 'C2', i: 5, nome: 'C2 — proficiente',    dica: 'raro, arcaico, altamente especializado' }
]
function cefrIdx(id) { const n = CEFR.find(x => x.id === String(id || '').toUpperCase()); return n ? n.i : -1 }
function cefrNivelAluno() { return CEFR.find(x => x.id === cfg.nivelAluno) ? cfg.nivelAluno : 'B1' }

let cfg = {}
let words = []
let activeWordId = null
const collapsedGroups = new Set()
let kindleItems = [], midiaItems = []

// ---- PALAVRAS CONHECIDAS (estilo Language Reactor) ----
// Mapa palavra-normalizada -> timestamp. Alimentado por: triagem do Raio-X
// (o que o aluno NAO marcou ele declarou conhecer), cards maduros do SRS
// (intervalo >= 21 dias) e edicao futura no gerenciador. Sincronizado por
// UNIAO (nunca perde o que outro aparelho marcou).
let knownWords = {}
try { knownWords = JSON.parse(localStorage.getItem('el-known') || '{}') } catch (e) {}
function knownNorm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z' -]/g, '').replace(/\s+/g, ' ').trim()
}
function isKnownWord(s) {
  const k = knownNorm(s); if (!k) return false
  if (knownWords[k]) return true
  // Usa o lematizador do glossário quando ele existe: a regra de sufixo abaixo
  // nunca enxergou VERBO IRREGULAR, que é justamente o vocabulário mais comum
  // do inglês — quem marcava "begin" como conhecida continuava recebendo
  // "began" para estudar, e "go" não cobria "went". O modo `estrito` deixa de
  // fora -er/-est, que derivam palavra nova ("teacher" não é "teach") e
  // sumiriam com item legítimo da lista de estudo.
  if (typeof glossLemas === 'function') {
    for (const l of glossLemas(k, { estrito: true })) if (knownWords[l]) return true
    return false
  }
  for (const suf of ['s', 'es', 'ed', 'd', 'ing']) {
    if (k.length > suf.length + 2 && k.endsWith(suf) && knownWords[k.slice(0, -suf.length)]) return true
  }
  return false
}
function markKnownWord(s, on = true) {
  const k = knownNorm(s); if (!k) return
  if (on) knownWords[k] = Date.now(); else delete knownWords[k]
  saveKnownLocal()
  if (typeof glossInvalidar === 'function') glossInvalidar()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}
function saveKnownLocal() {
  try { localStorage.setItem('el-known', JSON.stringify(knownWords)) } catch (e) {}
}

// "Nunca mais sugerir": nomes proprios, jargao que nao interessa, etc.
let ignoredWords = {}
try { ignoredWords = JSON.parse(localStorage.getItem('el-ignored') || '{}') } catch (e) {}
function markIgnoredWord(s, on = true) {
  const k = knownNorm(s); if (!k) return
  if (on) ignoredWords[k] = Date.now(); else delete ignoredWords[k]
  saveIgnoredLocal()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}
function saveIgnoredLocal() {
  try { localStorage.setItem('el-ignored', JSON.stringify(ignoredWords)) } catch (e) {}
}

// ---- HISTÓRICO DE IMPORTAÇÃO DO KINDLE ----
// Mora AQUI (arquivo não-lazy) porque firebase.js precisa dele no sync — e a
// UI que o alimenta (js/add.js) só é carregada quando a seção Adicionar abre.
// É este conjunto que faz "conectei o Kindle de novo → só o que é novo entra".
function kindleHighlightHash(text) {
  let h = 0
  const t = String(text || '')
  for (let i = 0; i < Math.min(t.length, 200); i++)
    h = (Math.imul(31, h) + t.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}
// Chave de identidade do item.
// O vocab.db traz o id do lookup (estável e único por consulta); o destaque só
// tem o próprio texto. Sem essa distinção, duas palavras consultadas na MESMA
// frase geram o mesmo hash e a segunda some calada.
function kindleItemKey(item) {
  if (Array.isArray(item.kids) && item.kids.length) return 'L:' + item.kids[0]
  return kindleHighlightHash(item.context || item.word)
}
function kindleItemVisto(item, seen) {
  if (Array.isArray(item.kids) && item.kids.length) return item.kids.some(k => seen.has('L:' + k))
  return seen.has(kindleHighlightHash(item.context || item.word))
}
function loadKindleSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SK.kindleSeen) || '[]')) } catch { return new Set() }
}
// Teto para o histórico não virar um documento gigante na nuvem: guardamos as
// últimas 30 mil marcas (ordem de inserção = as mais antigas saem primeiro).
const KINDLE_SEEN_MAX = 30000
function saveKindleSeen(seen) {
  let arr = [...seen]
  if (arr.length > KINDLE_SEEN_MAX) arr = arr.slice(arr.length - KINDLE_SEEN_MAX)
  try { localStorage.setItem(SK.kindleSeen, JSON.stringify(arr)) }
  catch (e) { console.warn('[kindle] histórico não coube no localStorage:', e.message) }
}
function markKindleItemsAsSeen(items) {
  const seen = loadKindleSeen()
  items.forEach(item => {
    // Um item do vocab.db pode ter juntado várias consultas da mesma palavra:
    // TODAS precisam ser marcadas, senão as irmãs voltam na próxima importação.
    if (Array.isArray(item.kids) && item.kids.length) item.kids.forEach(k => seen.add('L:' + k))
    else seen.add(kindleHighlightHash(item.context || item.word))
  })
  saveKindleSeen(seen)
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}

// ---- PONTE COM A EXTENSÃO DO CHROME (Netflix, Kindle Cloud Reader) ----
// A extensão (pasta /extension) captura palavras/frases das legendas da
// Netflix e as guarda no chrome.storage; quando o app abre, o content
// script bridge.js as entrega por postMessage. Aqui viram itens do
// Preparar (o Raio-X e a análise seguem o fluxo normal via createWord).
// __englabReady NÃO é marcado aqui: este é o primeiro script do app e as
// palavras só existem depois do loadWords() (no initApp). Marcar cedo fazia
// a extensão entregar antes da hora — as capturas entravam num `words` vazio
// e sumiam no recarregamento. Quem liga o sinal é englabAppPronto().
let _extFila = []          // capturas que chegaram antes de o app ficar pronto
let _extAppPronto = false

function englabAppPronto() {
  _extAppPronto = true
  window.__englabReady = true
  if (_extFila.length) { const f = _extFila; _extFila = []; _englabReceber(f) }
}

window.addEventListener('message', ev => {
  if (ev.source !== window || !ev.data || ev.data.type !== 'englab-ext-captures') return
  const items = Array.isArray(ev.data.items) ? ev.data.items : []
  // App ainda carregando: guarda e NÃO confirma — a extensão só limpa a fila
  // dela quando o recebimento for de verdade.
  if (!_extAppPronto) { _extFila.push(...items); return }
  _englabReceber(items)
})

// Rótulo por origem. A ponte nasceu só para a Netflix e fixava
// source_type:'series' — quando o Kindle entrou, toda captura de livro viraria
// "série". O tipo agora vem de quem capturou; 'series' é só o padrão antigo.
const _EXT_FONTES = {
  series:  { rotulo: 'da Netflix',  titulo: 'Netflix' },
  kindle:  { rotulo: 'do Kindle',   titulo: 'Kindle'  },
  movie:   { rotulo: 'do filme',    titulo: 'Filme'   },
  website: { rotulo: 'da web',      titulo: 'Web'     }
}

function _englabReceber(items) {
  let n = 0
  const tipos = new Set()
  for (const it of items.slice(0, 500)) {
    const word = String(it.word || '').trim()
    const context = String(it.context || '').trim()
    const alvo = word || context
    if (!alvo) continue
    if (words.some(w => (w.word || '') === alvo && (w.context || '') === context)) continue
    const tipo = _EXT_FONTES[it.source_type] ? it.source_type : 'series'
    tipos.add(tipo)
    createWord({
      word: alvo, context,
      source_type: tipo,
      source_title: String(it.title || _EXT_FONTES[tipo].titulo).slice(0, 120),
      lang: (typeof LANGS === 'object' && LANGS[it.lang]) ? it.lang : 'en'
    })
    n++
  }
  if (n) {
    const fonte = tipos.size === 1 ? _EXT_FONTES[[...tipos][0]].rotulo : ''
    if (typeof renderSidebar === 'function') { try { renderSidebar() } catch (e) {} }
    if (typeof renderDashboard === 'function') { try { renderDashboard() } catch (e) {} }
    // SEM isto as capturas ficavam só no localStorage e o snapshot da nuvem
    // as apagava no recarregamento seguinte (a nuvem é a fonte da verdade).
    if (typeof autoSyncAfterChange === 'function') { try { autoSyncAfterChange() } catch (e) {} }
    toast(`${n} captura${n > 1 ? 's' : ''} ${fonte} ${n > 1 ? 'entraram' : 'entrou'} no Preparar`.replace(/\s{2,}/g, ' '), 'success')
  }
  // ack mesmo com n=0 (duplicatas): a fila da extensão pode ser limpa
  window.postMessage({ type: 'englab-ext-ack', got: items.length }, location.origin)
}
// Assistente (Consulta) — conversas persistidas e sincronizadas.
// Estado declarado aqui (arquivo NÃO-lazy) para que firebase.js possa
// referenciá-lo no sync; a UI vive em js/consulta.js.
let conversas = []
let activeConversaId = null
function loadConversas() { try { conversas = JSON.parse(localStorage.getItem(SK.conversas) || '[]') } catch { conversas = [] } }
function saveConversas() { try { localStorage.setItem(SK.conversas, JSON.stringify(conversas)) } catch(e) { console.warn('[conversas] save falhou:', e.message) } }

// ── O NOME DA LEXA, alcançável de QUALQUER arquivo ─────────────────
// Nasceu como `const lexaNome` dentro de `ler.js`, que é LAZY — e isso ficou
// bem enquanto só o leitor a usava. Quando o painel, o menu de seleção e o
// Preparar passaram a chamá-la, virou a armadilha nº 1 do projeto: arquivo do
// SHELL falando com símbolo de arquivo lazy. O sintoma foi mudo — clicar em
// "Explicar" fechava o balão e não acontecia nada, porque `lexaNome is not
// defined` derrubava a função antes de o painel abrir e o erro morria no
// console.
// Mora aqui, que é o PRIMEIRO arquivo a carregar, e é tolerante: `LEXA_NOME`
// vem de `ai.js`, que carrega depois — o corpo só roda quando alguém chama.
function lexaNome() { return (typeof LEXA_NOME === 'string' ? LEXA_NOME : 'Lexa') }

// ── NOME DA OBRA: o que o autor chamou, não o que veio no arquivo ──
// O `source_title` é o que a fonte deu — e a fonte traz lixo: o EPUB devolve
// "Billy Summers (US Edition)", o vídeo devolve o nome do arquivo, o podcast
// devolve o título do episódio com o número do programa colado.
//
// A CHAVE DE AGRUPAMENTO CONTINUA SENDO O TÍTULO BRUTO. Reescrever
// `w.source_title` reagruparia todo o acervo e quebraria os dossiês já
// abertos, o `_dossieChave` gravado e a origem de cada sentido. Isto aqui é
// uma CAMADA DE EXIBIÇÃO: bruto → { titulo, autor }, resolvido uma vez por
// obra e guardado. Uma chamada por OBRA, nunca por item.
const SK_OBRAS = 'el-obras-nome'
// A "obra" de quem nasceu ESTUDANDO. Uma palavra pescada num exemplo inventado
// pela IA, numa colocação ou na família de outro item não veio de livro nenhum
// — e herdar o livro do item onde ela apareceu é mentira de procedência: a
// palavra passa a jurar que estava numa página que ele nunca leu. Aqui ela diz
// a verdade: veio do estudo de tal item, e o item vira o "capítulo".
const OBRA_ESTUDO = 'Do seu estudo'
let obrasNome = {}   // titulo bruto (minúsculo) → { titulo, autor, at }
function loadObrasNome() { try { obrasNome = JSON.parse(localStorage.getItem(SK_OBRAS) || '{}') } catch { obrasNome = {} } }
function saveObrasNome() { try { localStorage.setItem(SK_OBRAS, JSON.stringify(obrasNome)) } catch (e) {} }
function obraChaveNome(bruto) { return String(bruto || '').trim().toLowerCase() }
// Nome para MOSTRAR. Sem resolução guardada, devolve o bruto — a tela nunca
// fica esperando IA para desenhar.
function obraNome(bruto) {
  const r = obrasNome[obraChaveNome(bruto)]
  return (r && r.titulo) || String(bruto || '')
}
function obraAutor(bruto) {
  const r = obrasNome[obraChaveNome(bruto)]
  return (r && r.autor) || ''
}

// ── Preferências de interface (recolher sidebar/histórico) ─────────
const SK_UI = 'el-ui-prefs'
function loadUiPrefs() { try { return JSON.parse(localStorage.getItem(SK_UI) || '{}') } catch { return {} } }
function saveUiPref(key, val) { const p = loadUiPrefs(); p[key] = val; try { localStorage.setItem(SK_UI, JSON.stringify(p)) } catch {} }
function applyUiPrefs() { document.body.classList.toggle('sb-collapsed', !!loadUiPrefs().sbCollapsed) }
// Recolhe/expande a sidebar global (vira rail só-ícones). Independente do histórico.
function toggleSidebar() {
  const collapsed = document.body.classList.toggle('sb-collapsed')
  saveUiPref('sbCollapsed', collapsed)
  const btn = document.querySelector('.sb-collapse-btn')
  if (btn) btn.setAttribute('data-tip', collapsed ? 'Expandir menu' : 'Recolher menu')
}
// Aplica o estado recolhido o quanto antes (core.js já roda após o markup) p/ evitar flash
try { if (document.body) applyUiPrefs() } catch {}

function loadCfg() {
  try { cfg = { ...DEF_CFG, ...JSON.parse(localStorage.getItem(SK.settings) || '{}') } }
  catch { cfg = { ...DEF_CFG } }
}

// ================================================================
// BACKUP DA CONFIG EM IndexedDB
// O localStorage de alguns navegadores é limpo entre sessões (ITP/privacidade),
// mas o IndexedDB persiste (é onde os cards sobrevivem). Espelhamos a cfg ali
// para que a chave OpenAI e o tema NÃO se percam no refresh.
// ================================================================
const SettingsDB = {
  _db: null,
  async open() {
    if (this._db) return this._db
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('english-lab-settings', 1)
      req.onupgradeneeded = e => e.target.result.createObjectStore('kv')
      req.onsuccess = e => { this._db = e.target.result; resolve(this._db) }
      req.onerror = () => reject(req.error)
    })
  },
  async get(key) {
    try {
      const db = await this.open()
      return await new Promise(res => {
        const r = db.transaction('kv', 'readonly').objectStore('kv').get(key)
        r.onsuccess = () => res(r.result ?? null); r.onerror = () => res(null)
      })
    } catch { return null }
  },
  async set(key, value) {
    try {
      const db = await this.open()
      return await new Promise(res => {
        const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(value, key)
        tx.oncomplete = () => res(true); tx.onerror = () => res(false)
      })
    } catch { return false }
  }
}

// Grava no localStorage E no IndexedDB. O backup em IDB é "pegajoso":
// nunca sobrescreve a chave existente com valor vazio.
function saveCfg() {
  try { localStorage.setItem(SK.settings, JSON.stringify(cfg)) }
  catch (e) { console.warn('[cfg] localStorage falhou:', e.message) }
  backupCfgToIDB()
}
async function backupCfgToIDB() {
  try {
    const prev = (await SettingsDB.get('cfg')) || {}
    const merged = { ...cfg }
    // Protege os campos sensíveis: não apaga um valor já salvo com string vazia
    for (const k of ['openaiKey', 'geminiKey', 'groqKey']) {
      if (!merged[k] && prev[k]) merged[k] = prev[k]
    }
    await SettingsDB.set('cfg', merged)
  } catch (e) { console.warn('[cfg] backup IDB falhou:', e && e.message) }
}

// Restaura do backup IDB os campos que o localStorage perdeu (vazios/default).
// Retorna true se restaurou algo.
async function restoreCfgFromBackup() {
  let backup = null
  try { backup = await SettingsDB.get('cfg') } catch {}
  if (!backup || typeof backup !== 'object') return false
  let restored = false
  const keys = ['openaiKey', 'geminiKey', 'groqKey', 'theme', 'accent', 'aiProvider', 'aiModel', 'ttsProvider']
  for (const k of keys) {
    const cur = cfg[k]
    const curEmptyOrDefault = (cur === undefined || cur === '' || cur === DEF_CFG[k])
    if (curEmptyOrDefault && backup[k] && backup[k] !== cur) { cfg[k] = backup[k]; restored = true }
  }
  if (restored) {
    try { localStorage.setItem(SK.settings, JSON.stringify(cfg)) } catch {}
    if (typeof applyTheme === 'function') applyTheme(cfg.theme)
    console.log('[cfg] restaurado do backup IndexedDB')
  }
  return restored
}

// ================================================================
// THEMES
// ================================================================
const THEMES = [
  { id: 'midnight', name: 'Midnight',  dark: true,  swatch: ['#06091A', '#3B82F6'] },
  { id: 'light',    name: 'Light',     dark: false, swatch: ['#F4F6FB', '#2563EB'] },
  { id: 'sepia',    name: 'Sepia',     dark: false, swatch: ['#F3EAD8', '#B45309'] },
  { id: 'emerald',  name: 'Emerald',   dark: true,  swatch: ['#07130F', '#10B981'] },
  { id: 'violet',   name: 'Violet',    dark: true,  swatch: ['#0E0A1C', '#8B5CF6'] },
  { id: 'papel',    name: 'Papel',     dark: false, swatch: ['#F6F4EF', '#2E4BC6'] },
]
function applyTheme(id) {
  const valid = THEMES.find(t => t.id === id) ? id : 'midnight'
  document.documentElement.setAttribute('data-theme', valid)
  cfg.theme = valid
  applyAccent(cfg.accent)
}

// ================================================================
// ACENTO PERSONALIZÁVEL
// O usuário escolhe a cor de destaque por cima de QUALQUER tema — é o que
// torna o visual dele, e não o nosso. Só o --primary e derivados mudam;
// success/warning/error são semânticos e ficam com o tema.
// ================================================================
const ACCENTS = [
  { id: '',        name: 'Padrão do tema' },
  { id: '#4F6BED', name: 'Índigo' },
  { id: '#0E8DA3', name: 'Petróleo' },
  { id: '#2F9E6E', name: 'Esmeralda' },
  { id: '#C2703D', name: 'Terracota' },
  { id: '#B84A6B', name: 'Framboesa' },
  { id: '#7A5CC6', name: 'Ametista' },
  { id: '#946B21', name: 'Dourado' },
]

function _hexRgb(h) {
  h = (h || '').replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}
function _mixHex(hex, alvo, t) {  // alvo: [r,g,b]; t: 0..1
  const c = _hexRgb(hex).map((v,i) => Math.round(v + (alvo[i]-v)*t))
  return '#' + c.map(v => v.toString(16).padStart(2,'0')).join('')
}

function applyAccent(hex) {
  const root = document.documentElement
  const PROPS = ['--primary','--primary-rgb','--primary-d','--accent-bright','--primary-grad','--primary-glow']
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) { PROPS.forEach(p => root.style.removeProperty(p)); return }
  const rgb = _hexRgb(hex).join(',')
  const escuro = _mixHex(hex, [0,0,0], .18)
  const claro  = _mixHex(hex, [255,255,255], .25)
  root.style.setProperty('--primary', hex)
  root.style.setProperty('--primary-rgb', rgb)
  root.style.setProperty('--primary-d', escuro)
  root.style.setProperty('--accent-bright', claro)
  root.style.setProperty('--primary-grad', `linear-gradient(135deg, ${hex} 0%, ${escuro} 100%)`)
  root.style.setProperty('--primary-glow', `rgba(${rgb},0.10)`)
}
// Aplica o tema o mais cedo possível (antes mesmo do initApp) p/ evitar flash
try {
  const _stored = JSON.parse(localStorage.getItem('englab_cfg') || '{}')
  document.documentElement.setAttribute('data-theme', _stored.theme || 'midnight')
} catch { document.documentElement.setAttribute('data-theme', 'midnight') }

// ================================================================
// ÍCONES — conjunto de linha (estilo Lucide), inline SVG.
// Uso: ic('plus')  ou  ic('plus','ic-lg')  → string SVG p/ innerHTML
// ================================================================
const ICONS = {
  home:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  bookOpen:'<path d="M12 6.5C10 5 7 4.5 3 5v14c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5z"/><path d="M12 6.5V20"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sparkles:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7z"/>',
  palette:'<path d="M12 2a10 10 0 1 0 0 20 2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2h1a4 4 0 0 0 4-4 9 9 0 0 0-9-9z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.3-.6-.6-2.3z"/>',
  cloud:'<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 7 19z"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6a8 3 0 0 0 16 0V5"/><path d="M4 11v6a8 3 0 0 0 16 0v-6"/>',
  volume:'<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/>',
  pencil:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  film:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 12h18M3 7.5h4M3 16.5h4M17 7.5h4M17 16.5h4"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
  message:'<path d="M21 11.5a8.5 8.5 0 0 1-12 7.7L3 21l1.8-6A8.5 8.5 0 1 1 21 11.5z"/>',
  trash:'<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  download:'<path d="M12 3v12"/><path d="m7 12 5 5 5-5"/><path d="M5 21h14"/>',
  upload:'<path d="M12 21V9"/><path d="m7 12 5-5 5 5"/><path d="M5 3h14"/>',
  layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  flame:'<path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1.6 1-3 1-3s2 1.5 2 3c1.5 0 2-2 2-3 0-3-2-6-2-6z"/>',
  play:'<path d="M6 4l14 8-14 8z"/>',
  pause:'<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  skip:'<path d="M5 4l10 8-10 8z"/><path d="M19 5v14"/>',
  playCircle:'<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>',
  arrowRight:'<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  zap:'<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a6 6 0 0 1 0 12h-3"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  alert:'<path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  checkCircle:'<circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  tv:'<rect x="2" y="7" width="20" height="13" rx="2"/><path d="m7 2 5 5 5-5"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/>',
  clipboard:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  google:'<path d="M21 12.2c0-.6-.05-1.2-.15-1.7H12v3.4h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-7z"/><path d="M12 21c2.4 0 4.5-.8 6-2.2l-3.1-2.4c-.8.6-2 .9-2.9.9-2.3 0-4.2-1.5-4.9-3.6H3.9v2.4A9 9 0 0 0 12 21z"/><path d="M7.1 13.7a5.4 5.4 0 0 1 0-3.4V7.9H3.9a9 9 0 0 0 0 8.2z"/><path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 3.9 7.9l3.2 2.4C7.8 8.1 9.7 6.6 12 6.6z"/>',
  lock:'<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  expand:'<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  shrink:'<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
  send:'<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  chevronLeft:'<path d="m15 18-6-6 6-6"/>',
  chevronRight:'<path d="m9 18 6-6-6-6"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',
}
function ic(name, extra) {
  const inner = ICONS[name]; if (!inner) return ''
  return `<svg class="ic${extra ? ' ' + extra : ''}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`
}
// Ícone por tipo de fonte (série, filme, etc.) — usado em Preparar, Adicionar e Estudar
function srcIcon(t) {
  const m = { series:'tv', movie:'film', youtube:'playCircle', kindle:'book', podcast:'mic', website:'globe', manual:'pencil' }
  return ic(m[t] || 'bookOpen', 'ic-sm')
}
function loadWords() {
  try { words = JSON.parse(localStorage.getItem(SK.words) || '[]') } catch { words = [] }
  if (typeof glossInvalidar === 'function') glossInvalidar()
  updateDossieBadge()
}

// ---- LEMA: a chave do verbete (Fase 3) -------------------------------
// `fall down` e `fall by the wayside` moram no verbete debaixo de `fall`, mas
// continuam ITENS PRÓPRIOS — IPA próprio, exemplos próprios, agenda própria.
// Agrupar é da VISTA; aninhar no dado seria refazer o erro que o `moved_to`
// desfez (o sentido "apaixonar-se" que teve de sair de `fall`).
//
// ONDE FICA A CABEÇA — a regra que decide tudo:
//
//   Expressão que começa com VERBO é de cabeça INICIAL.
//     "fall by the wayside", "kick the bucket", "give up", "take it easy"  → o verbo
//   Qualquer outra é de cabeça FINAL (é assim que o inglês monta sintagma nominal).
//     "under the weather" → weather · "the last straw" → straw
//     "cold feet" → foot   · "crocodile tears" → tear
//
// A primeira versão só pegava "a primeira palavra de conteúdo", e por isso
// mandava "under the weather" para a família de `under` — juntando idioms que
// não têm nada a ver só porque começam com a mesma preposição.

// Palavras que nunca são cabeça de nada.
const _LEMA_FUNCIONAIS = new Set([
  'a','an','the','this','that','these','those','some','any','no','every','each',
  'of','in','on','at','to','for','with','by','from','into','onto','over','under',
  'out','up','down','off','about','around','through','across','after','before',
  'behind','between','against','without','within','upon','than','then','so','as',
  'and','or','but','nor','if','when','while','not',"n't",
  'it','its','one','ones',"one's",'someone',"someone's",'something','somebody',
  'oneself','myself','yourself','himself','herself','itself','ourselves',
  'themselves','my','your','his','her','their','our','you','he','she','they','we','i',
  'very','too','just','only','own','more','most','less','least'
])

// Verbos que começam expressão. Lista fechada e curta de propósito: são os que
// de fato encabeçam phrasal verbs e idioms em inglês. Auxiliares entram porque
// AQUI eles são o núcleo ("get by", "be into", "do over", "have it out") — o
// contrário do que valeria numa frase.
const _LEMA_VERBOS = new Set([
  'be','have','do','get','go','come','take','make','give','put','keep','let','run',
  'hit','break','cut','hold','throw','turn','bring','call','fall','pull','push',
  'draw','drive','ride','catch','kick','spill','bite','beat','blow','burn','buy',
  'carry','clear','cost','count','cross','drop','eat','face','feel','fight','find',
  'fly','follow','hang','hear','jump','know','lay','lead','leave','lie','look',
  'lose','love','meet','miss','move','pass','pay','pick','play','ring','rise',
  'roll','save','say','see','sell','send','set','shake','shoot','show','sing',
  'sit','sleep','speak','stand','start','stay','step','stick','stop','strike',
  'swear','talk','teach','tell','think','touch','walk','watch','wear','win',
  'work','wrap','write','bear','bend','bury','change','chew','choose','close',
  'cook','cry','dig','draw','dress','drink','fill','fit','fix','hide','hurt',
  'kill','knock','land','laugh','learn','live','mind','open','order','own',
  'paint','plan','point','pour','pray','press','print','raise','reach','read',
  'ride','rub','rush','seek','settle','shut','sink','slip','smell','sort','spend',
  'spread','stir','swim','switch','take','tear','throw','tie','try','use','wait',
  'wake','wash','wave','weigh','wind','wipe','wish'
])

// Uma forma flexionada ainda é verbo: "fell/kicked/spilling/takes".
function _lemaEhVerbo(tok) {
  const t = String(tok || '').toLowerCase()
  if (!t) return false
  if (_LEMA_VERBOS.has(t)) return true
  const base = (typeof GLOSS_IRREG === 'object' && GLOSS_IRREG) ? GLOSS_IRREG[t] : null
  if (base && _LEMA_VERBOS.has(base)) return true
  if (typeof glossLemas === 'function') {
    for (const c of glossLemas(t, { estrito: true })) if (_LEMA_VERBOS.has(c)) return true
  }
  return false
}

// Reduz a forma à base pela mesma escada do glossário: tabela de irregulares
// primeiro (medida e específica), regras de sufixo depois.
// ⚠️ A "MEDIDA" DO PORTER: quantas vezes o radical alterna vogal→consoante.
// Serve a uma pergunta só: o radical é curto o bastante para que o 'e' mudo
// tenha sido cortado? `mak` (medida 1) veio de `make`; `walk` (medida 1) veio
// de `walk` mesmo — quem separa os dois é o teste CVC logo abaixo.
function _lemaMedida(t) {
  return ((String(t || '')
    .replace(/[aeiou]+|(?!^)y/g, 'V')
    .replace(/[^V]+/g, 'C')
    .match(/VC/g)) || []).length
}

// O PASSO 1b DO PORTER, aplicado ao radical que sobra depois de tirar -ed/-ing.
// É o conserto do defeito que a bateria achou: `glossLemas` gera os candidatos
// certos, mas empurra o RADICAL CRU primeiro — e `_lemaBase` pegava o primeiro.
// Daí `running`→`runn`, `making`→`mak`, `stopping`→`stopp`: não-palavras
// virando o teto onde o item mora no verbete, e "running" deixando de se juntar
// a "run", que é justamente o que o lema existe para evitar.
// Os três ramos são EXCLUSIVOS, e é isso que faz o par difícil dar certo:
//   hopping → hopp → (consoante dobrada) → hop
//   hoping  → hop  → (medida 1 + CVC)    → hope
// Qualquer regra que aplicasse os dois em sequência erraria um dos dois.
function _lemaPorter1b(base) {
  const b = String(base || '')
  if (b.length < 3) return b
  if (/(at|bl|iz)$/.test(b)) return b + 'e'                       // conflat → conflate
  // ⚠️ `l`, `s` e `z` FICAM DE FORA, e é exatamente isso que o Porter manda.
  // Deixá-los na lista (foi meu primeiro erro, pego no banco de prova) fazia
  // `falling`→`fal`, `passing`→`pas`, `filled`→`fil`, `buzzing`→`buz`: eu
  // consertava a consoante dobrada de "running" e quebrava a de "fall", que
  // estava certa. `ll`, `ss` e `zz` são terminações legítimas em inglês.
  if (/([bcdfgjkmnpqrtv])\1$/.test(b)) return b.slice(0, -1)      // runn → run
  if (_lemaMedida(b) === 1 && /[^aeiou][aeiou][^aeiouwxy]$/.test(b)) return b + 'e'   // mak → make
  return b
}

function _lemaBase(tok) {
  const t = String(tok || '').toLowerCase()
  if (!t) return ''
  const irr = (typeof GLOSS_IRREG === 'object' && GLOSS_IRREG) ? GLOSS_IRREG[t] : null
  if (irr) return irr
  // ⚠️ COMPOSTO COM HÍFEN NÃO SE PODA.
  // O redutor foi feito para palavra simples, onde ele sabe as regras de
  // sufixo do inglês ("running" → "run"). Aplicado ao composto inteiro, ele
  // corta o fim como se fosse uma palavra só e devolve NÃO-PALAVRA:
  //   digest-sized → digest-siz · self-employed → self-employ
  //   good-looking → good-look  · old-fashioned → old-fashion
  // O item ia morar no verbete debaixo de um teto que não existe em lugar
  // nenhum. Encontrado em 2026-08-08 por `tools/teste-ia.mjs`: a Luna devolve
  // "size" para "digest-sized", `aplicarLemaDaIA` (bem) recusa, e a regra da
  // casa assumia — entregando "digest-siz".
  // Não podar custa quase nada: adjetivo composto praticamente não flexiona,
  // então não há família para reunir. E chave estável, ainda que literal, é
  // melhor que chave inventada.
  if (t.includes('-')) return t
  // ⚠️ ORDEM IMPORTA: o `-ied`/`-ies` do `glossLemas` já acerta sozinho
  // (`carried`→`carry`) e vem ANTES na lista. Deixar o Porter pegar esses
  // trocaria um acerto por `carri`.
  if (!/(ies|ied|i(er|est))$/.test(t)) {
    const m = t.match(/^(.+?)(ed|ing)$/)
    if (m && m[1].length >= 3) {
      const alvo = _lemaPorter1b(m[1])
      if (alvo && alvo !== t) return alvo
    }
  }
  if (typeof glossLemas === 'function') {
    const cands = glossLemas(t, { estrito: true })
    // Fora do -ed/-ing, o segundo candidato é a redução mais provável
    // ("leaves"→"leave", "boxes"→"box").
    if (cands.length > 1) return cands[1]
  }
  return t
}

// A REGRA VELHA, guardada de propósito: é o que a migração usa para saber se o
// lema gravado veio DAQUI ou da IA. Sem ela, remigrar apagaria o lema que a
// `aplicarLemaDaIA` validou — trocando um acerto por uma regra.
function _lemaBaseAntigo(tok) {
  const t = String(tok || '').toLowerCase()
  if (!t) return ''
  const irr = (typeof GLOSS_IRREG === 'object' && GLOSS_IRREG) ? GLOSS_IRREG[t] : null
  if (irr) return irr
  if (typeof glossLemas === 'function') {
    const cands = glossLemas(t, { estrito: true })
    if (cands.length > 1) return cands[1]
  }
  return t
}

// A cabeça da expressão, já reduzida à base.
// ⚠️ A MIGRAÇÃO DO LEMA — e ela é a metade difícil do conserto.
// `w.lemma` fica GRAVADO no item (com `lemma_de`), e `lemaDoItem` devolve o
// cache sem recalcular. Consertar a regra sem remigrar deixaria o "running"
// capturado ontem sob `runn` e o de amanhã sob `run`: família rachada, o
// defeito em DOBRO. Por isso as duas coisas andam juntas ou nenhuma anda.
//
// ⚠️ E ela só troca o que a REGRA DA CASA produziu. O lema pode ter vindo da
// IA por `aplicarLemaDaIA`, que o valida contra a expressão — esse é melhor do
// que qualquer regra minha, e remigrar por cima seria trocar um acerto por um
// palpite. O reconhecimento é direto: se o valor gravado bate com o que a
// regra VELHA daria, foi ela quem escreveu.
function migrarLemas() {
  if (typeof words === 'undefined' || !Array.isArray(words)) return { mexeu: 0, exemplos: [] }
  const mudancas = []
  for (const w of words) {
    const bruto = String(w.word || '').trim().toLowerCase()
    if (!bruto || !w.lemma || w.lemma_de !== bruto) continue
    // O que a regra velha daria para este item, cabeça e tudo.
    const velho = _lemaCabecaCom(bruto, w.type, _lemaBaseAntigo)
    if (w.lemma !== velho) continue          // não foi a regra: não é meu para mexer
    const novo = _lemaCabecaCom(bruto, w.type, _lemaBase)
    if (!novo || novo === w.lemma) continue
    mudancas.push({ w, de: w.lemma, para: novo })
  }
  return {
    mexeu: mudancas.length,
    exemplos: mudancas.slice(0, 12).map(m => ({ palavra: m.w.word, de: m.de, para: m.para })),
    aplicar() {
      for (const m of mudancas) { m.w.lemma = m.para; m.w.lemma_de = String(m.w.word || '').trim().toLowerCase() }
      if (mudancas.length && typeof saveWords === 'function') saveWords()
      if (mudancas.length && typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
      return mudancas.length
    }
  }
}

// `lemaCabeca` com o redutor injetado, para a migração poder rodar a regra
// velha e a nova sobre a MESMA lógica de cabeça (phrasal head-initial, "to"
// que não conta, último token de conteúdo). Duplicar essa lógica na migração
// seria criar uma terceira regra para manter em dia.
function _lemaCabecaCom(expr, tipo, reduz) {
  const bruto = String(expr || '').toLowerCase().replace(/[^\p{L}\p{N}'\s-]/gu, ' ').trim()
  if (!bruto) return ''
  const toks = bruto.split(/\s+/).filter(Boolean)
  if (toks.length === 1) return reduz(toks[0])
  if (tipo === 'phrasal_verb') return reduz(toks[0])
  const inicio = toks[0] === 'to' && toks.length > 1 ? 1 : 0
  if (_lemaEhVerbo(toks[inicio])) return reduz(toks[inicio])
  for (let i = toks.length - 1; i >= 0; i--) {
    if (!_LEMA_FUNCIONAIS.has(toks[i])) return reduz(toks[i])
  }
  return reduz(toks[toks.length - 1])
}

function lemaCabeca(expr, tipo) {
  const bruto = String(expr || '').toLowerCase().replace(/[^\p{L}\p{N}'\s-]/gu, ' ').trim()
  if (!bruto) return ''
  const toks = bruto.split(/\s+/).filter(Boolean)
  if (toks.length === 1) return _lemaBase(toks[0])

  // Phrasal verb é head-initial POR DEFINIÇÃO — o verbo vem primeiro e a
  // partícula é o que muda o sentido. Nem precisa adivinhar.
  if (tipo === 'phrasal_verb') return _lemaBase(toks[0])

  // "to be honest": o marcador de infinitivo não conta, mas o verbo depois dele sim.
  const inicio = toks[0] === 'to' && toks.length > 1 ? 1 : 0

  // Começa com verbo? Cabeça inicial.
  if (_lemaEhVerbo(toks[inicio])) return _lemaBase(toks[inicio])

  // Senão, cabeça final: o último token de conteúdo.
  for (let i = toks.length - 1; i >= 0; i--) {
    if (!_LEMA_FUNCIONAIS.has(toks[i])) return _lemaBase(toks[i])
  }
  // Só palavras funcionais ("by and large" cai aqui se 'large' entrasse na
  // lista): devolve a última mesmo, para a chave ser estável.
  return _lemaBase(toks[toks.length - 1])
}

function lemaDoItem(w) {
  if (!w) return ''
  const bruto = String(w.word || '').trim().toLowerCase()
  if (!bruto) return ''
  // O cache é invalidado quando a PALAVRA muda: editar "fell" para "fall in
  // love" tem de mudar a família, e um lema velho grudado no item faria a
  // entrada aparecer para sempre debaixo do teto errado.
  if (w.lemma && w.lemma_de === bruto) return w.lemma

  let lema = lemaCabeca(bruto, w.type)

  // Se algum item que já existe casa com um candidato de lema, é ELE que manda:
  // a família se mantém junta conforme cresce, em vez de rachar por grafia.
  if (typeof glossLemas === 'function' && Array.isArray(words)) {
    const cands = [lema, ...glossLemas(lema, { estrito: true })]
    for (const c of cands) {
      const dono = words.find(x => x !== w && String(x.word || '').trim().toLowerCase() === c)
      if (dono) { lema = c; break }
    }
  }
  w.lemma = lema
  w.lemma_de = bruto
  return lema
}

// O LEMA QUE A IA DEVOLVE tem prioridade sobre a regra — ela sabe de morfologia
// e de núcleo de expressão o que nenhuma lista fechada aqui vai saber. Mas é
// VALIDADO antes de entrar: lema alucinado espalharia famílias inteiras pelo
// verbete, e o estrago seria silencioso. Só passa palavra única que tenha
// relação real com a expressão.
function aplicarLemaDaIA(w, bruto) {
  const cand = String(bruto || '').toLowerCase().trim()
  if (!w || !cand || /\s/.test(cand) || !/^[\p{L}'-]+$/u.test(cand)) return false
  const toks = String(w.word || '').toLowerCase().split(/\s+/).filter(Boolean)
  const parente = toks.some(t => {
    if (t === cand || _lemaBase(t) === cand) return true
    if (typeof glossLemas === 'function') return glossLemas(t, { estrito: true }).includes(cand)
    return false
  })
  if (!parente) return false
  w.lemma = cand
  w.lemma_de = String(w.word || '').trim().toLowerCase()
  return true
}

// ---- Badge da seção ESTUDAR (os dossiês) -----------------------------
// Mora aqui, e não em js/dossie.js, pelo motivo de sempre: dossie.js é LAZY
// e o menu existe em todas as telas. Um item "pendente de estudo" é o que já
// tem material montado e ainda não foi marcado como estudado.
function dossiePendentes() {
  if (!Array.isArray(words)) return 0
  // FASE 2: conta SENTIDOS, não itens — a unidade de estudo desceu para o
  // sentido, e um item pode ter um sentido esperando estudo e outro já na
  // revisão. `estado: 'estudo'` = foi enviado ao dossiê e ainda não estudado.
  let n = 0
  for (const w of words) {
    for (const m of (w.meanings || [])) {
      if (m && m.meaning_pt && !m.moved_to && !m.fundido_em && m.estado === 'estudo') n++
    }
  }
  return n
}
function updateDossieBadge() {
  const n = dossiePendentes()
  for (const id of ['badge-dossie', 'badge-dossie-mob']) {
    const b = document.getElementById(id)
    if (!b) continue
    b.textContent = n
    b.classList.toggle('hidden', n === 0)
  }
}
// Todo caminho que MUDA um card passa por aqui, então é aqui que o índice do
// glossário morre. Sem isto, corrigir a tradução de uma palavra deixaria o
// balão do hover mostrando a versão velha para sempre — e o erro seria
// invisível, porque o card na tela já estaria certo.
function saveWords() {
  localStorage.setItem(SK.words, JSON.stringify(words))
  if (typeof glossInvalidar === 'function') glossInvalidar()
  // Mesmo raciocínio do glossário: TODO caminho que muda um item passa aqui,
  // então é aqui que o contador de "para estudar" deixa de mentir — inclusive
  // quando quem mudou foi o snapshot da nuvem.
  updateDossieBadge()
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7) }


// ================================================================
// NAVIGATION
// ================================================================
// O NOME DA SEÇÃO É O FLUXO (renomeado em 2026-08-07 — ver ESTADO 8.1):
//   preparar  → js/review.js   (a IA monta o material)   — era 'revisar'
//   estudar   → js/dossie.js   (ler o dossiê da obra)    — seção nova
//   revisar   → js/study.js    (repetição espaçada/SRS)  — era 'estudar'
// Os ARQUIVOS mantiveram os nomes antigos de propósito: renomeá-los quebraria
// o histórico do git e o cache do service worker sem ganhar nada. É aqui que
// a tradução mora — não invente outra em nenhum outro arquivo.
const SECTIONS = ['dashboard','assistente','adicionar','preparar','estudar','revisar','biblioteca','palavras','video','ler','configuracoes']
// Lazy-load map: section → arquivo JS carregado só na 1ª visita
// biblioteca usa funções de study.js (buildSrsFrente/Verso/MetaChips/fmtDays)
// (assistente NÃO é lazy — js/consulta.js é carregado sempre, pois firebase.js
//  precisa de `conversas`/render no sync.)
// video é um PACOTE de módulos (ordem importa: o estado vive no primeiro)
const _LAZY = {
  // adicionar = PACOTE: o leitor de SQLite vem antes porque add.js usa
  // sqliteAbrir() para ler o vocab.db do Kindle.
  adicionar: ['js/kindle-db.js', 'js/add.js'],
  // ler = PACOTE: epub.js (formato, sem DOM da página) antes de ler.js (tela)
  ler: ['js/epub.js', 'js/ler.js'],
  // revisar = SRS (study.js); estudar = os dossiês (dossie.js). Ver o mapa
  // acima de SECTIONS antes de mexer: os nomes trocaram de lugar.
  revisar: 'js/study.js', biblioteca: 'js/study.js',
  estudar: 'js/dossie.js',
  palavras: 'js/known.js',
  video: ['js/video.js', 'js/video-subs.js', 'js/video-sync.js', 'js/video-study.js', 'js/video-podcast.js']
}
const _loadedModules = new Set()

function _loadScript(src, tentativa = 0) {
  return new Promise((resolve, reject) => {
    if (_loadedModules.has(src)) { resolve(); return }
    const s = document.createElement('script')
    s.src = tentativa ? src + '?r=' + Date.now() : src
    s.onload = () => { _loadedModules.add(src); resolve() }
    s.onerror = () => {
      s.remove()
      if (tentativa >= 1) { reject(new Error('Falha ao carregar ' + src)); return }
      // 1 retry com cache-buster: cobre a janela de troca do service worker
      // logo após um deploy — requisições em voo abortam quando o SW novo
      // assume, e era isso que deixava os módulos lazy pela metade.
      setTimeout(() => _loadScript(src, tentativa + 1).then(resolve, reject), 400)
    }
    document.body.appendChild(s)
  })
}

function showSection(name) {
  const lazy = _LAZY[name]
  const files = Array.isArray(lazy) ? lazy : (lazy ? [lazy] : [])
  if (files.some(f => !_loadedModules.has(f))) {
    // Sequencial de propósito: módulos posteriores usam o estado do primeiro
    ;(async () => {
      for (const f of files) {
        try { await _loadScript(f) } catch (e) { console.error(e) }
      }
      _activateSection(name)
    })()
  } else {
    _activateSection(name)
  }
}

function _activateSection(name) {
  // O modo foco do Estudar é uma tela cheia FORA de `.section` (mora no body).
  // Trocar de seção sem fechá-lo deixaria a nova tela escondida atrás dele.
  if (typeof dossieFocoSair === 'function' && document.getElementById('dos-foco')) dossieFocoSair()
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'))
  const navEl = document.getElementById(`nav-${name}`)
  if (navEl) navEl.classList.add('active')
  const navMobEl = document.getElementById(`nav-${name}-mob`)
  if (navMobEl) navMobEl.classList.add('active')
  document.getElementById(`section-${name}`).classList.add('active')
  if (name === 'dashboard') renderDashboard()
  if (name === 'assistente') { if (typeof renderAssistente === 'function') renderAssistente() }
  if (name === 'adicionar') { if (loadKindleQueue()) renderKindleList() }
  if (name === 'preparar') renderReview()
  if (name === 'configuracoes') fillSettings()
  if (name === 'revisar') renderSrsSection()
  if (name === 'estudar') { if (typeof renderDossieSection === 'function') renderDossieSection() }
  if (name === 'biblioteca') openBiblioteca()
  if (name === 'video') { if (typeof renderVideoSection === 'function') renderVideoSection() }
  // O modo de leitura esconde o cabeçalho e a barra de baixo no celular:
  // sair da seção por qualquer outro caminho precisa devolvê-los, senão o
  // app fica sem navegação.
  if (name !== 'ler') document.body.classList.remove('lendo')
  if (name === 'ler') { if (typeof renderLerSection === 'function') renderLerSection() }
  if (name === 'palavras') { if (typeof renderKnownSection === 'function') renderKnownSection() }
}
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
  document.getElementById(`panel-${name}`).classList.add('active')
  event.currentTarget.classList.add('active')
}


// ================================================================
// HELPERS
// ================================================================
function el(id) { return document.getElementById(id) }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function escA(s) { return String(s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }
function escR(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') }
// Escapa o texto MAS preserva as tags <b>/</b> (negrito do objeto de estudo).
// Usada nas frases EN/PT que já vêm com o termo marcado em <b> pela IA.
function escB(s) {
  return esc(s).replace(/&lt;b&gt;/gi, '<b>').replace(/&lt;\/b&gt;/gi, '</b>')
}

// Frente do card: a frase com o objeto de estudo em negrito.
// Mora aqui (NÃO-lazy) porque o glossário da Biblioteca (audio.js, não-lazy)
// também usa — antes vivia no study.js, que é lazy.
function buildSrsFrente(card) {
  const sentence = card.example_en || ''
  if (!sentence) return ''
  // Se a frase JÁ vem com o termo marcado em <b> (pela IA), confiamos nela —
  // o regex abaixo não acerta formas irregulares (run→ran, go→went) nem
  // expressões, então re-marcar por conta própria APAGARIA o negrito correto.
  if (/<b>/i.test(sentence)) return escB(sentence)
  const wordRaw = (card.word || '').trim()
  if (!wordRaw) return esc(sentence)
  const cleanSentence = sentence.replace(/<\/?b>/gi, '')
  try {
    let regex
    if (wordRaw.includes(' ')) {
      // Expressão de várias palavras (phrasal/separável): casa o verbo flexionado
      // + a(s) partícula(s), tolerando outra palavra no meio.
      const particle = wordRaw.split(/\s+/).slice(1).map(escR).join('\\s+')
      regex = new RegExp(`\\b(\\w+(?:'\\w+)?\\s+${particle})\\b`, 'gi')
    } else {
      regex = new RegExp(`\\b(${escR(wordRaw)}(?:s|es|ed|d|ing|er|est|ly|'s)?)\\b`, 'gi')
    }
    return escB(cleanSentence.replace(regex, '<b>$1</b>'))
  } catch { return esc(cleanSentence) }
}
// ================================================================
// UNIDADE FIXA — o sentido que não é do item, é da EXPRESSÃO inteira
// ================================================================
// O caso que criou isto (2026-08-07): "fall" voltou da IA com o sentido
// "apaixonar-se" — e os TRÊS exemplos diziam "fall in love". Sentido que só
// existe com um complemento FIXO não é sentido da palavra: é outra unidade de
// estudo, com baralho, card e agendamento próprios ("fall in love").
//
// A prova está no próprio dado, sem gastar IA: se os exemplos compartilham as
// mesmas palavras logo DEPOIS do alvo, o complemento é fixo. Se variam
// (fall silent / asleep / ill), é padrão aberto — e aí o sentido É da palavra.
// Por isso o teste roda sobre os exemplos e não sobre o significado em PT:
// é o inglês que decide de quem é o sentido.
//
// Mora aqui (NÃO-lazy) porque quem usa é o review.js (Preparar) e a varredura
// da base inteira — e amanhã, provavelmente, a reanálise em lote do audio.js.

// Palavras que sozinhas não provam unidade nenhuma: determinantes, pronomes e
// conectivos. Preposição e partícula ficam FORA desta lista de propósito — são
// justamente elas que formam "fall in love", "fall through", "fall apart".
const _UF_GENERICAS = new Set(['the','a','an','this','that','these','those','my','your','his','her','its','our','their',
  'and','but','or','so','then','when','while','because','if','as','than','it','him','them','me','us','you','he','she',
  'they','i','we','there','here','again','now','very','just','more','most','some','any','no','not'])

function _ufTokens(txt) {
  const limpo = String(txt || '').replace(/<[^>]*>/g, '')
  // A cauda não atravessa fronteira de oração: o que vem depois de vírgula ou
  // ponto é outra coisa, não parte da expressão.
  const corte = limpo.search(/[.,;:!?—–"“”]/)
  const trecho = corte >= 0 ? limpo.slice(0, corte) : limpo
  return trecho.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z'’-]+/).filter(Boolean)
}

// O que vem DEPOIS do alvo neste exemplo. Âncora preferida: o negrito, que o
// projeto inteiro garante estar no termo flexionado (fell, falling) — regex de
// radical não acerta verbo irregular. Se o negrito já engloba a expressão
// ("<b>fell in love</b>"), o excedente também conta como cauda.
function _ufCauda(en, palavra) {
  const s = String(en || '')
  const nBase = String(palavra || '').trim().split(/\s+/).filter(Boolean).length || 1
  const b = /<b>([\s\S]*?)<\/b>/i.exec(s)
  if (b) {
    const dentro = _ufTokens(b[1]).slice(nBase)
    return [...dentro, ..._ufTokens(s.slice(b.index + b[0].length))].slice(0, 4)
  }
  const raiz = String(palavra || '').trim().split(/\s+/)[0].toLowerCase()
  if (!raiz) return []
  const limpo = s.replace(/<\/?b>/gi, '')
  let m
  try { m = new RegExp(`\\b${escR(raiz)}[a-z]*\\b`, 'i').exec(limpo) } catch { return [] }
  if (!m) return []
  return _ufTokens(limpo.slice(m.index + m[0].length)).slice(0, 4)
}

// O que vem ANTES do alvo, do mais próximo para o mais distante. Existe porque
// nem toda expressão põe o material fixo depois do verbo: capturar "mind" de
// "make up your mind" deixa o item sem nada à direita. O corte é mais alto
// aqui (2+ palavras) porque à esquerda costuma estar o SUJEITO — e o prompt
// exige que ele varie, então repetição de 2+ palavras ali é sinal forte.
function _ufCabeca(en, palavra) {
  const s = String(en || '')
  const b = /<b>([\s\S]*?)<\/b>/i.exec(s)
  let antes
  if (b) antes = _ufTokensAntes(s.slice(0, b.index))
  else {
    const raiz = String(palavra || '').trim().split(/\s+/)[0].toLowerCase()
    if (!raiz) return []
    const limpo = s.replace(/<\/?b>/gi, '')
    let m
    try { m = new RegExp(`\\b${escR(raiz)}[a-z]*\\b`, 'i').exec(limpo) } catch { return [] }
    if (!m) return []
    antes = _ufTokensAntes(limpo.slice(0, m.index))
  }
  return antes.reverse().slice(0, 4)
}
// Igual ao _ufTokens, mas a fronteira de oração é a ÚLTIMA pontuação, não a
// primeira: aqui se lê de trás para a frente.
function _ufTokensAntes(txt) {
  const limpo = String(txt || '').replace(/<[^>]*>/g, '')
  let corte = -1
  for (let i = limpo.length - 1; i >= 0; i--) if (/[.,;:!?—–"“”]/.test(limpo[i])) { corte = i; break }
  const trecho = corte >= 0 ? limpo.slice(corte + 1) : limpo
  return trecho.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z'’-]+/).filter(Boolean)
}

function _ufPrefixoComum(listas) {
  const comum = []
  for (let i = 0; i < listas[0].length; i++) {
    const t = listas[0][i]
    if (listas.every(c => c[i] === t)) comum.push(t)
    else break
  }
  return comum
}

// Devolve {extra, unidade, lado} quando o sentido depende de material fixo;
// null quando o sentido é da palavra. Conservador de propósito: na dúvida,
// null — isto vira SUGESTÃO na tela, e sugestão errada em excesso é o que faz
// o usuário parar de ler as sugestões.
function unidadeFixaDoSentido(m, palavra) {
  const exs = (m && Array.isArray(m.examples) ? m.examples : []).filter(e => e && e.en)
  if (exs.length < 2) return null
  const base = String(palavra || '').trim()
  const nBase = base.split(/\s+/).filter(Boolean).length || 1

  // 1) À DIREITA — o caso dominante do inglês (fall in love, fall apart).
  const caudas = exs.map(e => _ufCauda(e.en, palavra))
  if (!caudas.some(c => !c.length)) {
    const comum = _ufPrefixoComum(caudas)
    // "in love with" → a preposição solta do fim não faz parte da unidade
    while (comum.length && _UF_GENERICAS.has(comum[comum.length - 1])) comum.pop()
    const serve = comum.length && !(comum.length === 1 && _UF_GENERICAS.has(comum[0])) &&
      !(nBase > 1 && comum.length < 2)
    if (serve) {
      const extra = comum.join(' ')
      return { extra, unidade: base ? `${base} ${extra}` : extra, lado: 'direita' }
    }
  }

  // 2) À ESQUERDA — só quando a direita não disse nada, e com barra mais alta.
  const cabecas = exs.map(e => _ufCabeca(e.en, palavra))
  if (cabecas.some(c => !c.length)) return null
  const antes = _ufPrefixoComum(cabecas)
  // O começo da expressão não pode ser artigo/pronome solto ("the mind").
  while (antes.length && _UF_GENERICAS.has(antes[antes.length - 1])) antes.pop()
  if (antes.length < 2) return null
  const extra = antes.slice().reverse().join(' ')
  return { extra, unidade: base ? `${extra} ${base}` : extra, lado: 'esquerda' }
}

// ================================================================
// O SIGNIFICADO DE UM CARD — por id, não por posição
// ================================================================
// `meaningIdx` é POSICIONAL, e `w.meanings` é RECONSTRUÍDO a cada análise: se a
// IA devolver os sentidos em outra ordem, todo card existente passa a apontar,
// em silêncio, para outro significado. O bug nunca dá erro — só troca o nível,
// a definição e a imagem de lugar. Cada significado já nasce com `id` (uid em
// applyAiResult, preservado pelo merge de curadoria): é ele que identifica.
//
// `meaningIdx` continua no card e continua sendo gravado: é a chave das imagens
// (`img_wordId_meaningIdx`) e o que agrupa cards irmãos. O que muda é só a
// BUSCA dentro de `w.meanings`, que passa a preferir o id e a cair no índice
// quando o card é antigo (ou quando o significado foi apagado).
function meaningDoCard(w, card) {
  if (!w || !card || !Array.isArray(w.meanings)) return null
  if (card.meaningId) {
    const porId = w.meanings.find(m => m && m.id === card.meaningId)
    if (porId) return porId
  }
  return w.meanings[card.meaningIdx] || null
}

// Migração aditiva: cards antigos não têm `meaningId`. Enquanto a posição ainda
// é a verdade (nenhuma análise nova rodou desde então), este é o momento certo
// de congelar a identidade — depois seria tarde.
function migrateMeaningIds() {
  if (typeof srsCards === 'undefined' || !Array.isArray(srsCards)) return false
  let changed = false
  for (const c of srsCards) {
    if (c.meaningId) continue
    const w = (words || []).find(x => x.id === c.wordId)
    const m = w && Array.isArray(w.meanings) ? w.meanings[c.meaningIdx] : null
    if (m && m.id) { c.meaningId = m.id; changed = true }
  }
  if (changed && typeof saveSrsCards === 'function') saveSrsCards()
  return changed
}

// ================================================================
// FAMÍLIA DE UM ITEM — de onde ele veio e o que saiu dele
// ================================================================
// Um item guarda em `from` de qual outro ele nasceu: o sentido separado
// ("fall in love" veio de "fall") e a parte escolhida no raio-X ("get you in"
// veio da frase inteira). O PAI não guarda lista nenhuma — os filhos são
// derivados por varredura. Duas listas para a mesma verdade divergem, e este
// projeto já apanhou disso.
function familiaDoItem(w) {
  if (!w) return { pai: null, filhos: [] }
  const pai = w.from && w.from.id ? (words || []).find(x => x.id === w.from.id) || null : null
  const filhos = (words || []).filter(x => x.from && x.from.id === w.id)
  return { pai, filhos }
}

// Onde o item mora AGORA decide para onde o clique leva: cada estado tem uma
// tela só dele desde o fluxo de 4 etapas. Mandar para a tela errada é pior do
// que não ter link nenhum — o usuário procura e não acha.
function irParaItem(id) {
  const w = (words || []).find(x => x.id === id)
  if (!w) { toast('Esse item não existe mais', 'warning'); return }
  if (w.status === 'pending_ai' || w.status === 'pending_review') {
    showSection('preparar')
    setTimeout(() => { try { selectWord(w.id) } catch (e) {} }, 60)
    return
  }
  if (w.status === 'in_study') {
    showSection('estudar')
    // dossie.js é LAZY: só existe depois que a seção abre.
    setTimeout(() => {
      try { if (typeof dossieAbrir === 'function' && typeof _dossieChave === 'function') dossieAbrir(_dossieChave(w)) } catch (e) {}
    }, 120)
    return
  }
  if (typeof openWordGlossary === 'function') { openWordGlossary(w.id); return }
  toast(`"${w.word}" está na Revisão`, 'info')
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function selectAll(cls, val) {
  document.querySelectorAll(`.${cls}`).forEach(c => c.checked = val)
}

function speakWord(word) {
  if (!window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(word); u.lang = 'en-US'; u.rate = 0.85
  speechSynthesis.speak(u)
}

function toast(msg, type = 'info') {
  const icons = { success:'checkCircle', error:'x', warning:'alert', info:'info' }
  const t = document.createElement('div')
  t.className = `toast ${type}`
  t.innerHTML = `${ic(icons[type] || 'info')}<span>${esc(msg)}</span>`
  el('toasts').appendChild(t)
  setTimeout(() => t.remove(), 4500)
}

// ================================================================
// MODAL DE CONFIRMAÇÃO (substitui confirm() nativo) — Promise<boolean>
// html: corpo livre (já escapado por quem chama). Enter confirma, Esc cancela.
// ================================================================
function confirmModal({ title, html = '', confirmText = 'Continuar', cancelText = 'Cancelar', icon = 'info', danger = false }) {
  return new Promise(resolve => {
    document.getElementById('el-confirm-modal')?.remove()
    const overlay = document.createElement('div')
    overlay.id = 'el-confirm-modal'
    overlay.className = 'srs-modal-overlay'
    const done = ok => { overlay.remove(); document.removeEventListener('keydown', teclas); resolve(ok) }
    overlay.addEventListener('click', e => { if (e.target === overlay) done(false) })
    overlay.innerHTML = `<div class="srs-modal-box confirm-box" role="alertdialog" aria-labelledby="el-confirm-title">
      <div class="confirm-head">
        <span class="confirm-icon${danger ? ' danger' : ''}">${ic(icon)}</span>
        <h4 id="el-confirm-title">${esc(title || 'Confirmar')}</h4>
      </div>
      <div class="confirm-body">${html}</div>
      <div class="confirm-actions">
        <button class="btn btn-ghost btn-sm" id="el-confirm-cancel">${esc(cancelText)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm" id="el-confirm-ok">${esc(confirmText)}</button>
      </div>
    </div>`
    document.body.appendChild(overlay)
    const teclas = e => {
      if (e.key === 'Escape') { e.preventDefault(); done(false) }
      if (e.key === 'Enter')  { e.preventDefault(); done(true) }
    }
    document.addEventListener('keydown', teclas)
    document.getElementById('el-confirm-ok').onclick = () => done(true)
    document.getElementById('el-confirm-cancel').onclick = () => done(false)
    setTimeout(() => document.getElementById('el-confirm-ok')?.focus(), 30)
  })
}

// ================================================================
// MODAL DE INPUT (substitui prompt() nativo) — visual premium
// ================================================================
function inputModal({ title, label, value = '', placeholder = '', confirmText = 'Salvar', onConfirm }) {
  document.getElementById('el-input-modal')?.remove()
  const overlay = document.createElement('div')
  overlay.id = 'el-input-modal'
  overlay.className = 'srs-modal-overlay'
  const close = () => overlay.remove()
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })
  overlay.innerHTML = `<div class="srs-modal-box">
    <h4 style="font-size:var(--fs-base);font-weight:700;margin-bottom:${label ? '4px' : '14px'}">${esc(title || '')}</h4>
    ${label ? `<p style="font-size:var(--fs-sm);color:var(--text2);margin-bottom:14px">${esc(label)}</p>` : ''}
    <input type="text" id="el-input-modal-field" class="srs-modal-select" aria-label="${escA(label || title || 'Digite aqui')}" placeholder="${escA(placeholder)}" value="${escA(value)}" style="margin-bottom:18px">
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" id="el-input-modal-cancel">Cancelar</button>
      <button class="btn btn-primary btn-sm" id="el-input-modal-ok">${esc(confirmText)}</button>
    </div>
  </div>`
  document.body.appendChild(overlay)
  const field = document.getElementById('el-input-modal-field')
  const submit = () => { const v = field.value.trim(); close(); if (v && onConfirm) onConfirm(v) }
  document.getElementById('el-input-modal-ok').onclick = submit
  document.getElementById('el-input-modal-cancel').onclick = close
  field.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') close() })
  setTimeout(() => { field.focus(); field.select() }, 30)
}

// ================================================================
// TOOLTIPS GLOBAIS — estilizados, escapam overflow (delegação)
// Lê data-tip; se ausente, converte um title= existente em tooltip premium.
// ================================================================
;(function setupTooltips() {
  let tipEl = null, tipTarget = null
  function ensure() {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'el-tip'; document.body.appendChild(tipEl) }
    return tipEl
  }
  function show(target, txt) {
    const t = ensure()
    t.textContent = txt; t.style.display = 'block'; t.style.opacity = '0'
    const r = target.getBoundingClientRect(), tr = t.getBoundingClientRect()
    let left = r.left + r.width / 2 - tr.width / 2
    left = Math.max(6, Math.min(left, window.innerWidth - tr.width - 6))
    let top = r.top - tr.height - 8, below = false
    if (top < 6) { top = r.bottom + 8; below = true }
    t.style.left = Math.round(left) + 'px'; t.style.top = Math.round(top) + 'px'
    t.classList.toggle('below', below)
    requestAnimationFrame(() => { if (tipEl) tipEl.style.opacity = '1' })
  }
  function hide() { if (tipEl) tipEl.style.display = 'none'; tipTarget = null }
  document.addEventListener('mouseover', e => {
    const target = e.target.closest && e.target.closest('[data-tip],[title]')
    if (!target || target === tipTarget) return
    let txt = target.getAttribute('data-tip')
    if (!txt) {
      txt = target.getAttribute('title')
      if (txt) { target.setAttribute('data-tip', txt); target.removeAttribute('title') }
    }
    if (txt) { tipTarget = target; show(target, txt) }
  })
  document.addEventListener('mouseout', e => {
    if (tipTarget && (!e.relatedTarget || !tipTarget.contains(e.relatedTarget))) hide()
  })
  document.addEventListener('click', hide, true)
  window.addEventListener('scroll', hide, true)
  window.addEventListener('resize', hide)
})()

// Drag & drop upload
function setupDrop(areaId, handler) {
  const area = el(areaId); if (!area) return
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag') })
  area.addEventListener('dragleave', () => area.classList.remove('drag'))
  area.addEventListener('drop', e => {
    e.preventDefault(); area.classList.remove('drag')
    const file = e.dataTransfer.files[0]
    if (file) { const dt = new DataTransfer(); dt.items.add(file); handler({ files: dt.files }) }
  })
}




// ================================================================
// SRS DECK SYSTEM
// ================================================================
let srsDecks = []

const DEFAULT_DECKS = [
  { id: 'dk-root',    name: 'Inglês', parentId: null },
  { id: 'dk-vocab',   name: 'Vocabulary',    parentId: 'dk-root' },
  { id: 'dk-phrasal', name: 'Phrasal Verbs', parentId: 'dk-root' },
  { id: 'dk-idioms',  name: 'Idioms',        parentId: 'dk-root' },
  { id: 'dk-colloc',  name: 'Collocations',  parentId: 'dk-root' },
]

function loadSrsDecks() {
  try {
    const stored = JSON.parse(localStorage.getItem(SK.srsDecks) || '[]')
    srsDecks = stored.length ? stored : JSON.parse(JSON.stringify(DEFAULT_DECKS))
  } catch { srsDecks = JSON.parse(JSON.stringify(DEFAULT_DECKS)) }
  if (!srsDecks.length) srsDecks = JSON.parse(JSON.stringify(DEFAULT_DECKS))
  saveSrsDecks()
}
function saveSrsDecks() { localStorage.setItem(SK.srsDecks, JSON.stringify(srsDecks)) }
function getDeckById(id) { return srsDecks.find(d => d.id === id) }
function getSrsDeckPath(id) {
  const deck = getDeckById(id); if (!deck) return ''
  if (!deck.parentId) return deck.name
  return getSrsDeckPath(deck.parentId) + ' › ' + deck.name
}
function getDeckChildren(parentId) { return srsDecks.filter(d => d.parentId === parentId) }
function getRootDecks() { return srsDecks.filter(d => !d.parentId) }
function getAllDescendantIds(deckId) {
  const children = getDeckChildren(deckId)
  let ids = children.map(c => c.id)
  children.forEach(c => { ids = ids.concat(getAllDescendantIds(c.id)) })
  return ids
}
function getDeckCardCount(deckId) {
  const allIds = [deckId, ...getAllDescendantIds(deckId)]
  return srsCards.filter(c => allIds.includes(c.deckId)).length
}
function getWordDeckId(wordType, langCode) {
  // Multi-idioma: delega para lang.js (cria os decks do idioma sob demanda).
  if (typeof deckIdForWord === 'function') return deckIdForWord(wordType, langCode || 'en')
  const m = { phrasal_verb:'dk-phrasal', idiom:'dk-idioms', collocation:'dk-colloc' }
  return m[(wordType||'').toLowerCase()] || 'dk-vocab'
}
function addDeck(name, parentId) {
  const id = 'dk-' + uid(); srsDecks.push({ id, name: name.trim(), parentId: parentId||null }); saveSrsDecks(); return id
}
function renameDeck(id, newName) { const d = getDeckById(id); if (d) { d.name = newName.trim(); saveSrsDecks() } }
function deleteDeck(id) {
  const deck = getDeckById(id); const fallback = deck?.parentId || 'dk-vocab'
  srsCards.forEach(c => { if (c.deckId === id) c.deckId = fallback })
  const toRemove = [id, ...getAllDescendantIds(id)]
  srsDecks = srsDecks.filter(d => !toRemove.includes(d.id))
  saveSrsDecks(); saveSrsCards()
}
function populateDeckSelect(selectEl, selectedId) {
  if (!selectEl) return; selectEl.innerHTML = ''
  function addOpts(parentId, depth) {
    srsDecks.filter(d => d.parentId === parentId).forEach(d => {
      const opt = document.createElement('option')
      opt.value = d.id; opt.textContent = '  '.repeat(depth) + (depth > 0 ? '› ' : '') + d.name
      if (d.id === selectedId) opt.selected = true
      selectEl.appendChild(opt); addOpts(d.id, depth + 1)
    })
  }
  addOpts(null, 0)
}


// ================================================================
// "NÃO LEMBRO" — tirar uma palavra do limbo sem perder o lugar
// ================================================================
// O caso: passando o mouse numa palavra, o balão diz "você marcou como
// conhecida" — e ele não lembra dela. Hoje isso é um beco: a palavra está
// marcada, não volta para a fila, e a única saída é caçá-la no Preparar.
//
// Três coisas têm de acontecer juntas, e é isso que torna o botão útil:
//   1. DESMARCAR o "conheço" — sem isso a cobertura, a triagem por nível e o
//      próprio glossário continuam achando que ele sabe;
//   2. criar o card COM A FRASE, para a análise nascer com contexto;
//   3. levá-lo até aquele item e trazê-lo de volta ao ponto exato.
//
// O PONTO 3 É GENÉRICO DE PROPÓSITO. Isto não é código do leitor: vale para
// vídeo, podcast, Assistente e qualquer tela que venha depois. A tela de
// origem registra COMO se volta para ela; o resto é mecanismo compartilhado.
// Se a tela não precisar de nada além de reabrir, `restaurar` fica vazio e
// `showSection` sozinho já devolve o estado (o leitor, por exemplo, restaura
// capítulo e posição no próprio render).
let _voltarPara = null

function estudoVoltarDefinir(p) {
  _voltarPara = (p && p.secao) ? p : null
  _voltarPintar()
}

function estudoVoltarLimpar() { _voltarPara = null; _voltarPintar() }

function estudoVoltar() {
  const p = _voltarPara
  _voltarPara = null
  _voltarPintar()
  if (!p) return
  showSection(p.secao)
  // Depois do showSection: a seção pode ser lazy e o módulo dela só existe
  // depois do carregamento. O atraso curto cobre isso sem precisar de gancho.
  if (typeof p.restaurar === 'function') setTimeout(() => { try { p.restaurar() } catch (e) {} }, 60)
}

// Pílula flutuante, fora de qualquer seção — é o que faz o retorno valer para
// TODOS os métodos de estudo em vez de um banner por tela.
function _voltarPintar() {
  let b = document.getElementById('voltar-pill')
  if (!_voltarPara) { if (b) b.remove(); return }
  if (!b) {
    b = document.createElement('button')
    b.id = 'voltar-pill'
    b.type = 'button'
    b.onclick = estudoVoltar
    document.body.appendChild(b)
  }
  b.innerHTML = ic('arrowRight', 'ic-sm') + '<span>Voltar para ' + esc(_voltarPara.rotulo || 'onde eu estava') + '</span>'
}

// O caminho completo, chamado pelo balão do glossário em qualquer tela.
// `origem` descreve de onde veio e como voltar.
function estudoNaoLembro(alvo, ctx, origem) {
  const termo = String(alvo || '').trim()
  if (!termo) return
  // 1) sai do limbo
  if (typeof markKnownWord === 'function') markKnownWord(termo, false)
  const k = typeof knownNorm === 'function' ? knownNorm(termo) : termo.toLowerCase()
  if (typeof ignoredWords === 'object' && ignoredWords && ignoredWords[k]) {
    delete ignoredWords[k]
    if (typeof saveIgnoredLocal === 'function') saveIgnoredLocal()
  }
  if (typeof glossInvalidar === 'function') glossInvalidar()

  // 2) vira card com a frase — se já não for um
  let w = words.find(x => knownNorm(x.word || '') === k)
  if (!w) {
    w = createWord({
      word: termo,
      context: String(ctx || '').slice(0, 400),
      source_type: (origem && origem.source_type) || 'manual',
      source_title: (origem && origem.source_title) || '',
      lang: (origem && origem.lang) || 'en'
    })
    saveWords()
    if (typeof autoSyncAfterChange === 'function') { try { autoSyncAfterChange() } catch (e) {} }
  }

  // 3) guarda a volta ANTES de sair, e vai para o item
  if (origem && origem.secao) {
    estudoVoltarDefinir({ secao: origem.secao, rotulo: origem.rotulo, restaurar: origem.restaurar })
  }
  activeWordId = w.id
  showSection('preparar')
  setTimeout(() => {
    try {
      if (typeof selectWord === 'function') selectWord(w.id)
      else if (typeof renderWordCard === 'function') renderWordCard(w.id)
    } catch (e) {}
  }, 80)
  toast('"' + termo + '" saiu das conhecidas e está aqui — analise e volte', 'success')
}

// ================================================================
// PILHA DE AVISOS — toasts e progressos no MESMO empilhamento
// ================================================================
// O bug que motivou isto: `#toasts` e `#audio-gen-banner` eram os dois
// `position:fixed` no canto inferior direito, com o MESMO z-index. Salvar uma
// palavra para estudo dispara os dois (o toast dos cards e o banner da
// pré-geração de áudio), e eles apareciam LITERALMENTE um sobre o outro.
//
// Consertar só o banner adiaria o problema: a regra do projeto agora é que
// TUDO que gera algo mostra progresso, então vão nascer mais desses. Logo o
// conserto é estrutural — existe UMA pilha, `#toasts`, e todo aviso entra
// nela. O flex-column com gap cuida do empilhamento, e nada mais precisa
// saber de coordenadas.
//
// A API é de três funções porque uma geração tem três momentos, e cada um
// precisa aparecer: começou, está em N de M, terminou. `id` identifica a
// operação — chamar `progressoAtualizar` com o mesmo id não empilha, atualiza.
function _pilhaAvisos() {
  let p = document.getElementById('toasts')
  if (!p) {
    p = document.createElement('div')
    p.id = 'toasts'
    document.body.appendChild(p)
  }
  return p
}

function progressoAbrir(id, titulo, sub) {
  const pilha = _pilhaAvisos()
  let box = document.getElementById('prog-' + id)
  if (!box) {
    box = document.createElement('div')
    box.id = 'prog-' + id
    box.className = 'prog-aviso'
    pilha.appendChild(box)
  }
  box.innerHTML =
    '<div class="prog-topo"><span class="gen-spinner"></span>' +
      '<b>' + esc(titulo || 'Gerando…') + '</b>' +
      '<span class="prog-n" id="prog-n-' + id + '"></span></div>' +
    '<div class="prog-barra"><i id="prog-bar-' + id + '" style="width:0%"></i></div>' +
    '<div class="prog-sub" id="prog-sub-' + id + '">' + esc(sub || '') + '</div>'
  return box
}

function progressoAtualizar(id, feito, total, sub) {
  const box = document.getElementById('prog-' + id)
  if (!box) return
  const bar = document.getElementById('prog-bar-' + id)
  const n = document.getElementById('prog-n-' + id)
  const s = document.getElementById('prog-sub-' + id)
  if (bar) bar.style.width = (total ? Math.round((feito / total) * 100) : 0) + '%'
  if (n) n.textContent = total > 1 ? feito + '/' + total : ''
  if (s && sub !== undefined) s.textContent = String(sub || '')
}

// `msg` fecha com uma mensagem final em vez de sumir calado — o fim de uma
// operação é informação, não silêncio.
function progressoFechar(id, msg, tipo) {
  const box = document.getElementById('prog-' + id)
  if (box) box.remove()
  if (msg) toast(msg, tipo || 'success')
}

// Progresso de item ÚNICO (uma imagem, um áudio). Não tem barra: não há
// fração a mostrar, e barra falsa que anda sozinha é pior que spinner honesto.
function progressoItem(id, titulo) {
  const pilha = _pilhaAvisos()
  let box = document.getElementById('prog-' + id)
  if (!box) {
    box = document.createElement('div')
    box.id = 'prog-' + id
    box.className = 'prog-aviso prog-item'
    pilha.appendChild(box)
  }
  box.innerHTML = '<div class="prog-topo"><span class="gen-spinner"></span><b>' +
    esc(titulo || 'Gerando…') + '</b></div>'
  return box
}
