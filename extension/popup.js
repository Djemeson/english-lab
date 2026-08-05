'use strict'
const APP_FALLBACK = 'https://english-lab-seven.vercel.app/'
const ehLab = u => /english-lab|djemeson\.github\.io|localhost:8765/.test(String(u || ''))

function status(txt) { const e = document.getElementById('status'); if (e) e.textContent = txt || '' }

function render() {
  chrome.storage.local.get({ pend: [] }).catch(() => null).then(r => {
    if (!r) return
    const pend = r.pend || []
    document.getElementById('qtd').textContent = pend.length
    const ul = document.getElementById('lista')
    ul.innerHTML = ''
    for (const it of pend.slice(-8).reverse()) {
      const li = document.createElement('li')
      const b = document.createElement('b')
      b.textContent = it.word || '(frase)'
      li.appendChild(b)
      li.appendChild(document.createTextNode(' — ' + String(it.context || '').slice(0, 48)))
      ul.appendChild(li)
    }
  })
}

// Entrega INJETANDO o script na aba do Lab, em vez de depender da ponte que
// já está lá. Isso é o que faz funcionar mesmo numa aba aberta antes de a
// extensão ser recarregada (ponte órfã) — o caso que travava tudo.
async function entregarNaAba(tabId, pend) {
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [pend],
    func: itens => {
      if (!window.__englabReady) return { pronto: false }   // app ainda não carregou
      window.postMessage({ type: 'englab-ext-captures', items: itens }, location.origin)
      return { pronto: true }
    }
  })
  return !!(r && r.result && r.result.pronto)
}

async function abrirOuEntregar() {
  const { pend = [], llapp = '' } = await chrome.storage.local.get({ pend: [], llapp: '' })
  const alvo = llapp || APP_FALLBACK
  const tabs = await chrome.tabs.query({})
  const aba = tabs.find(t => ehLab(t.url))

  if (!aba) {                       // sem Lab aberto: abre — a ponte entrega no load
    await chrome.tabs.create({ url: alvo })
    window.close(); return
  }
  await chrome.tabs.update(aba.id, { active: true })
  try { await chrome.windows.update(aba.windowId, { focused: true }) } catch (e) {}

  if (!pend.length) { window.close(); return }
  try {
    let ok = await entregarNaAba(aba.id, pend)
    if (!ok) {                      // app não respondeu: recarrega e tenta de novo
      status('recarregando o Lab…')
      await chrome.tabs.reload(aba.id)
      await new Promise(r => setTimeout(r, 2500))
      ok = await entregarNaAba(aba.id, pend)
    }
    if (ok) {
      await chrome.storage.local.set({ pend: [] })
      status(`${pend.length} entregue${pend.length > 1 ? 's' : ''}!`)
      render()
      setTimeout(() => window.close(), 900)
    } else {
      status('o Lab não respondeu — abra-o e clique de novo')
    }
  } catch (e) {
    status('não consegui entregar: ' + (e.message || 'erro'))
  }
}

document.getElementById('abrir').onclick = abrirOuEntregar
document.getElementById('limpar').onclick = () => chrome.storage.local.set({ pend: [] }).then(render)
document.getElementById('religar').onclick = () => {
  chrome.tabs.query({ url: 'https://www.netflix.com/*' }).then(tabs => {
    for (const t of tabs) chrome.tabs.sendMessage(t.id, { type: 'englab-religar' }).catch(() => {})
  }).catch(() => {})
}
chrome.storage.onChanged.addListener(render)
render()
