// ================================================================
// PONTE — roda DENTRO do Language Lab (Pages/Vercel/localhost).
// Entrega as capturas pendentes da Netflix ao app via postMessage;
// o app confirma (ack) e a fila é limpa. Sem chaves, sem rede própria.
// ================================================================
'use strict'

function entregar() {
  chrome.storage.local.get({ pend: [] }, ({ pend }) => {
    if (!pend.length) return
    window.postMessage({ type: 'englab-ext-captures', items: pend }, location.origin)
  })
}

window.addEventListener('message', ev => {
  if (ev.source !== window || !ev.data || ev.data.type !== 'englab-ext-ack') return
  chrome.storage.local.set({ pend: [] })
})

// na abertura, quando a aba volta ao foco, e quando nova captura chega
// com o app já aberto
setTimeout(entregar, 1500)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(entregar, 500)
})
chrome.storage.onChanged.addListener(ch => { if (ch.pend) entregar() })
