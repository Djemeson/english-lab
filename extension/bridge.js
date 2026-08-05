// ================================================================
// PONTE — roda DENTRO do Language Lab (Pages/Vercel/localhost).
// Dois sentidos:
//   ← entrega as capturas da Netflix ao app (viram itens do Revisar);
//   → espelha a config de IA do app para a extensão, para a barra da
//     Netflix poder traduzir e explicar SEM você digitar chave nenhuma
//     lá (quem chama a API é o service worker da extensão).
// ================================================================
'use strict'

function entregarCapturas() {
  chrome.storage.local.get({ pend: [] }, ({ pend }) => {
    if (!pend.length) return
    window.postMessage({ type: 'englab-ext-captures', items: pend }, location.origin)
  })
}

// A config vive no localStorage do app (mesma origem) — só os campos que
// a extensão precisa; nada é enviado para fora da máquina.
function espelharConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('englab_cfg') || '{}')
    const llcfg = {
      aiProvider: cfg.aiProvider || 'openai',
      aiModelProv: cfg.aiModelProv || {},
      openaiKey: cfg.openaiKey || '',
      deepseekKey: cfg.deepseekKey || '',
      geminiKey: cfg.geminiKey || '',
      groqKey: cfg.groqKey || ''
    }
    chrome.storage.local.set({ llcfg })
  } catch (e) {}
}

window.addEventListener('message', ev => {
  if (ev.source !== window || !ev.data || ev.data.type !== 'englab-ext-ack') return
  chrome.storage.local.set({ pend: [] })
})

function ciclo() { entregarCapturas(); espelharConfig() }
setTimeout(ciclo, 1500)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(ciclo, 500)
})
chrome.storage.onChanged.addListener(ch => { if (ch.pend) entregarCapturas() })
