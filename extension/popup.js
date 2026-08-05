'use strict'
const APP_URL = 'https://djemeson.github.io/english-lab/'

function render() {
  chrome.storage.local.get({ pend: [] }, ({ pend }) => {
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

document.getElementById('abrir').onclick = () => chrome.tabs.create({ url: APP_URL })
document.getElementById('limpar').onclick = () => chrome.storage.local.set({ pend: [] }, render)
document.getElementById('religar').onclick = () => {
  chrome.tabs.query({ url: 'https://www.netflix.com/*' }, tabs => {
    for (const t of tabs) chrome.tabs.sendMessage(t.id, { type: 'englab-religar' })
  })
}
chrome.storage.onChanged.addListener(render)
render()
