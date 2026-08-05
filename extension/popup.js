'use strict'
const APP_FALLBACK = 'https://english-lab-seven.vercel.app/'

function render() {
  chrome.storage.local.get({ pend: [] }, ({ pend }) => {
    if (chrome.runtime.lastError) return
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

// Abrir o app: foca a aba que ja estiver aberta; senao usa a ultima URL
// registrada pela ponte; so entao cai no endereco padrao.
document.getElementById('abrir').onclick = () => {
  chrome.storage.local.get({ llapp: '' }, ({ llapp }) => {
    const alvo = llapp || APP_FALLBACK
    chrome.tabs.query({}, tabs => {
      const aberta = tabs.find(t => t.url && (t.url.startsWith(alvo) ||
        /english-lab|localhost:8765/.test(t.url)))
      if (aberta) { chrome.tabs.update(aberta.id, { active: true }); chrome.windows.update(aberta.windowId, { focused: true }) }
      else chrome.tabs.create({ url: alvo })
      window.close()
    })
  })
}
document.getElementById('limpar').onclick = () => chrome.storage.local.set({ pend: [] }, render)
document.getElementById('religar').onclick = () => {
  chrome.tabs.query({ url: 'https://www.netflix.com/*' }, tabs => {
    // aba antiga (de antes de recarregar a extensão) não tem receptor: ignora
    for (const t of tabs) chrome.tabs.sendMessage(t.id, { type: 'englab-religar' }, () => chrome.runtime.lastError)
  })
}
chrome.storage.onChanged.addListener(render)
render()
