// ================================================================
// PONTE — roda DENTRO do Language Lab (Pages/Vercel/localhost).
// Dois sentidos:
//   ← entrega as capturas da Netflix ao app (viram itens do Revisar);
//   → espelha a config de IA do app para a extensão, para a barra da
//     Netflix poder traduzir e explicar SEM você digitar chave nenhuma
//     lá (quem chama a API é o service worker da extensão).
//
// Blindagem: ao ATUALIZAR/RECARREGAR a extensão, este script continua
// vivo na aba antiga mas perde o vínculo. Proteger só a CHAMADA não
// basta — o callback roda depois, e lá até ler chrome.runtime.lastError
// lança "Extension context invalidated". Por isso TUDO (chamada E
// callback) passa por try/catch, e ao primeiro sinal a ponte se aposenta.
// ================================================================
'use strict'

let aposentada = false
let timerId = null

function aposentar() {
  if (aposentada) return
  aposentada = true
  try { clearInterval(timerId) } catch (e) {}
  try { document.removeEventListener('visibilitychange', aoVoltar) } catch (e) {}
  try { window.removeEventListener('message', aoAck) } catch (e) {}
  console.info('[Language Lab] extensão recarregada — atualize esta página (F5) para reconectar')
}

// true só enquanto o vínculo com a extensão existe de fato
function viva() {
  if (aposentada) return false
  try { return !!(chrome && chrome.runtime && chrome.runtime.id) } catch (e) { aposentar(); return false }
}

// Executa algo que fala com a extensão. Qualquer exceção = vínculo morto.
function seguro(fn) {
  if (!viva()) return
  try { fn() } catch (e) { aposentar() }
}

// Embrulha um CALLBACK do chrome.* — é aqui que o erro escapava.
function cb(fn) {
  return function (...args) {
    if (aposentada) return
    try {
      if (chrome.runtime.lastError) { aposentar(); return }   // ler isto já pode lançar
      fn(...args)
    } catch (e) { aposentar() }
  }
}

function entregarCapturas() {
  seguro(() => chrome.storage.local.get({ pend: [] }, cb(({ pend }) => {
    if (!pend || !pend.length) return
    window.postMessage({ type: 'englab-ext-captures', items: pend }, location.origin)
  })))
}

// A config vive no localStorage do app (mesma origem) — só os campos que
// a extensão precisa; nada é enviado para fora da máquina.
function espelharConfig() {
  let cfg = null
  try { cfg = JSON.parse(localStorage.getItem('englab_cfg') || '{}') } catch (e) { return }
  seguro(() => chrome.storage.local.set({
    llcfg: {
      aiProvider: cfg.aiProvider || 'openai',
      aiModelProv: cfg.aiModelProv || {},
      openaiKey: cfg.openaiKey || '',
      deepseekKey: cfg.deepseekKey || '',
      geminiKey: cfg.geminiKey || '',
      groqKey: cfg.groqKey || ''
    }
  }, cb(() => {})))
}

// Guarda a URL do app que o Djemeson realmente usa (Vercel, Pages ou local),
// para o botão do popup abrir a certa em vez de um endereço chutado.
function registrarApp() {
  const url = location.origin + location.pathname.replace(/[^/]*$/, '')
  seguro(() => chrome.storage.local.set({ llapp: url }, cb(() => {})))
}

function aoAck(ev) {
  if (ev.source !== window || !ev.data || ev.data.type !== 'englab-ext-ack') return
  seguro(() => chrome.storage.local.set({ pend: [] }, cb(() => {})))
}
function aoVoltar() {
  if (document.visibilityState === 'visible') setTimeout(ciclo, 500)
}
function ciclo() {
  if (!viva()) return
  entregarCapturas(); espelharConfig(); registrarApp()
}

window.addEventListener('message', aoAck)
document.addEventListener('visibilitychange', aoVoltar)
setTimeout(ciclo, 1500)
// Ronda leve: cobre config alterada com a aba já aberta e serve de
// sentinela para aposentar a ponte quando a extensão é recarregada.
timerId = setInterval(ciclo, 20000)

seguro(() => chrome.storage.onChanged.addListener(function (ch) {
  if (aposentada) return
  try { if (ch && ch.pend) entregarCapturas() } catch (e) { aposentar() }
}))

// Rede de segurança final: se algo escapar (callback interno do Chrome,
// por exemplo), engolimos o erro específico do contexto invalidado para
// ele não poluir a lista de Erros da extensão.
window.addEventListener('error', ev => {
  const m = String((ev && ev.message) || '')
  if (m.includes('Extension context invalidated') || m.includes('Receiving end does not exist')) {
    aposentar()
    ev.preventDefault()
    ev.stopImmediatePropagation()
  }
}, true)
window.addEventListener('unhandledrejection', ev => {
  const m = String((ev && ev.reason && ev.reason.message) || ev.reason || '')
  if (m.includes('Extension context invalidated')) { aposentar(); ev.preventDefault() }
})
