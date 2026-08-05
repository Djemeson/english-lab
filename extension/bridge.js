// ================================================================
// PONTE — roda DENTRO do Language Lab (Pages/Vercel/localhost).
// Dois sentidos:
//   ← entrega as capturas da Netflix ao app (viram itens do Revisar);
//   → espelha a config de IA do app para a extensão, para a barra da
//     Netflix poder traduzir e explicar SEM você digitar chave nenhuma
//     lá (quem chama a API é o service worker da extensão).
//
// Blindagem obrigatória: ao ATUALIZAR/RECARREGAR a extensão, este script
// continua vivo na aba antiga mas perde o vínculo — qualquer chrome.*
// vira "Extension context invalidated". Então tudo passa por vivo()/seguro()
// e, quando o vínculo cai, a ponte se aposenta em silêncio.
// ================================================================
'use strict'

let aposentada = false
const vivo = () => { try { return !!(chrome.runtime && chrome.runtime.id) } catch (e) { return false } }
function seguro(fn) {
  if (aposentada) return
  if (!vivo()) { aposentar(); return }
  try { fn() } catch (e) {
    if (String(e && e.message).includes('Extension context invalidated')) aposentar()
  }
}
function aposentar() {
  if (aposentada) return
  aposentada = true
  clearInterval(timerId)
  document.removeEventListener('visibilitychange', aoVoltar)
  window.removeEventListener('message', aoAck)
  console.info('[Language Lab] extensão recarregada — atualize a página para reconectar a ponte')
}

function entregarCapturas() {
  seguro(() => {
    chrome.storage.local.get({ pend: [] }, ({ pend }) => {
      if (chrome.runtime.lastError || !pend || !pend.length) return
      window.postMessage({ type: 'englab-ext-captures', items: pend }, location.origin)
    })
  })
}

// A config vive no localStorage do app (mesma origem) — só os campos que
// a extensão precisa; nada é enviado para fora da máquina.
function espelharConfig() {
  seguro(() => {
    let cfg = {}
    try { cfg = JSON.parse(localStorage.getItem('englab_cfg') || '{}') } catch (e) { return }
    chrome.storage.local.set({
      llcfg: {
        aiProvider: cfg.aiProvider || 'openai',
        aiModelProv: cfg.aiModelProv || {},
        openaiKey: cfg.openaiKey || '',
        deepseekKey: cfg.deepseekKey || '',
        geminiKey: cfg.geminiKey || '',
        groqKey: cfg.groqKey || ''
      }
    }, () => { if (chrome.runtime.lastError) aposentar() })
  })
}

function aoAck(ev) {
  if (ev.source !== window || !ev.data || ev.data.type !== 'englab-ext-ack') return
  seguro(() => chrome.storage.local.set({ pend: [] }))
}
function aoVoltar() {
  if (document.visibilityState === 'visible') setTimeout(ciclo, 500)
}
// Guarda a URL do app que o Djemeson realmente usa (Vercel, Pages ou local),
// para o botao do popup abrir a certa em vez de um endereco chutado.
function registrarApp() {
  seguro(() => chrome.storage.local.set({ llapp: location.origin + location.pathname.replace(/[^/]*$/, '') }))
}
function ciclo() { entregarCapturas(); espelharConfig(); registrarApp() }

window.addEventListener('message', aoAck)
document.addEventListener('visibilitychange', aoVoltar)
setTimeout(ciclo, 1500)
// Ronda leve: cobre o caso de a config mudar com a aba já aberta e
// serve de sentinela para aposentar a ponte quando a extensão recarrega.
const timerId = setInterval(ciclo, 20000)

seguro(() => chrome.storage.onChanged.addListener(ch => {
  if (ch && ch.pend) entregarCapturas()
}))
