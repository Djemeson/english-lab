// ================================================================
// PONTE — roda DENTRO do Language Lab (Pages/Vercel/localhost).
//   ← entrega as capturas da Netflix ao app (viram itens do Preparar);
//   → espelha a config de IA do app para a extensão (a barra da Netflix
//     traduz/explica sem você digitar chave lá).
//
// Por que PROMESSAS e não callbacks: ao recarregar a extensão, este
// script segue vivo na aba antiga sem vínculo. Com callback, o erro
// estoura dentro do Chrome ("Uncaught Extension context invalidated") e
// ninguém pega. Com promessa, a falha vira rejeição — e .catch() resolve.
// Nenhuma linha aqui fala com chrome.* fora de um try + .catch.
// ================================================================
'use strict'

let aposentada = false
let timerId = null
let ouvinteStorage = null

function aposentar() {
  if (aposentada) return
  aposentada = true
  try { clearInterval(timerId) } catch (e) {}
  try { document.removeEventListener('visibilitychange', aoVoltar) } catch (e) {}
  try { window.removeEventListener('message', aoAck) } catch (e) {}
  try { if (ouvinteStorage) chrome.storage.onChanged.removeListener(ouvinteStorage) } catch (e) {}
  console.info('[Language Lab] extensão recarregada — atualize esta página (F5) para reconectar')
}

// Toda conversa com a extensão passa por aqui: promessa + catch, nunca callback.
function pedir(fn) {
  if (aposentada) return Promise.resolve(null)
  let p
  try {
    if (!(chrome && chrome.runtime && chrome.runtime.id)) { aposentar(); return Promise.resolve(null) }
    p = fn()
  } catch (e) { aposentar(); return Promise.resolve(null) }
  return Promise.resolve(p).catch(() => { aposentar(); return null })
}

function entregarCapturas() {
  return pedir(() => chrome.storage.local.get({ pend: [] })).then(r => {
    const pend = r && r.pend
    if (!pend || !pend.length) return
    window.postMessage({ type: 'englab-ext-captures', items: pend }, location.origin)
  }).catch(() => {})
}

// A config vive no localStorage do app (mesma origem) — só os campos que
// a extensão precisa; nada sai da máquina.
function espelharConfig() {
  let cfg
  try { cfg = JSON.parse(localStorage.getItem('englab_cfg') || '{}') } catch (e) { return Promise.resolve() }
  return pedir(() => chrome.storage.local.set({
    llcfg: {
      aiProvider: cfg.aiProvider || 'openai',
      aiModelProv: cfg.aiModelProv || {},
      openaiKey: cfg.openaiKey || '',
      geminiKey: cfg.geminiKey || '',
      groqKey: cfg.groqKey || ''
    }
  }))
}

// Registra a URL do app que o Djemeson realmente usa (Vercel, Pages, local)
// para o botão do popup abrir a certa.
function registrarApp() {
  const url = location.origin + location.pathname.replace(/[^/]*$/, '')
  return pedir(() => chrome.storage.local.set({ llapp: url }))
}

function aoAck(ev) {
  if (ev.source !== window || !ev.data || ev.data.type !== 'englab-ext-ack') return
  pedir(() => chrome.storage.local.set({ pend: [] }))
}
function aoVoltar() {
  if (document.visibilityState === 'visible') setTimeout(ciclo, 500)
}
function ciclo() {
  if (aposentada) return
  entregarCapturas(); espelharConfig(); registrarApp()
}

window.addEventListener('message', aoAck)
document.addEventListener('visibilitychange', aoVoltar)
setTimeout(ciclo, 1500)
// Ronda leve: pega config alterada com a aba já aberta e serve de sentinela
// para aposentar a ponte quando a extensão é recarregada.
timerId = setInterval(ciclo, 20000)

try {
  ouvinteStorage = function (ch) {
    if (aposentada) return
    try { if (ch && ch.pend) entregarCapturas() } catch (e) { aposentar() }
  }
  chrome.storage.onChanged.addListener(ouvinteStorage)
} catch (e) { aposentar() }

// Rede de segurança: se algo escapar por um caminho interno do Chrome,
// engolimos SÓ este erro para ele não poluir a lista de Erros da extensão.
window.addEventListener('error', ev => {
  const m = String((ev && ev.message) || '')
  if (m.includes('Extension context invalidated') || m.includes('Receiving end does not exist')) {
    aposentar(); ev.preventDefault(); ev.stopImmediatePropagation()
  }
}, true)
window.addEventListener('unhandledrejection', ev => {
  const m = String((ev && ev.reason && ev.reason.message) || (ev && ev.reason) || '')
  if (m.includes('Extension context invalidated')) { aposentar(); ev.preventDefault() }
})
