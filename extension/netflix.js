// ================================================================
// LANGUAGE LAB × NETFLIX — legendas clicáveis (técnica Language Reactor)
// A Netflix renderiza as legendas no DOM (.player-timedtext). Observamos
// essas mudanças, re-renderizamos a fala numa barra própria com cada
// palavra clicável, e guardamos as capturas em chrome.storage — a ponte
// (bridge.js) as entrega quando o Language Lab for aberto.
// Nada de chaves de API aqui: a extensão só captura.
// ================================================================
'use strict'

let elBarra = null
let ultimoTexto = ''
let pausadoPorNos = false
let ligada = true          // barra visível
let ocultaNativa = true    // esconde a legenda da própria Netflix
let pausaHover = true      // pausa enquanto o mouse está na barra

// ---------------------------------------------------------------
// captura
// ---------------------------------------------------------------
function tituloAtual() {
  const t = document.querySelector('[data-uia="video-title"]')
  if (t && t.textContent.trim()) return t.textContent.trim().replace(/\s+/g, ' ')
  return document.title.replace(/ - Netflix.*$/i, '').trim() || 'Netflix'
}

function salvarCaptura(word, context) {
  chrome.storage.local.get({ pend: [] }, ({ pend }) => {
    pend.push({ word, context, title: tituloAtual(), ts: Date.now() })
    chrome.storage.local.set({ pend })
  })
}

// ---------------------------------------------------------------
// barra de legenda própria
// ---------------------------------------------------------------
function garantirBarra() {
  if (elBarra && document.body.contains(elBarra)) return elBarra
  elBarra = document.createElement('div')
  elBarra.id = 'englab-bar'
  elBarra.innerHTML = `
    <div class="englab-line" id="englab-line"></div>
    <div class="englab-tools">
      <button id="englab-save-line" title="Salvar a frase inteira no Language Lab">+ frase</button>
      <button id="englab-toggle-native" title="Mostrar/esconder a legenda original da Netflix">cc</button>
      <button id="englab-toggle-pause" title="Pausar enquanto o mouse está na barra">⏸</button>
      <button id="englab-hide" title="Esconder a barra (o ícone da extensão religa)">×</button>
    </div>`
  document.body.appendChild(elBarra)

  elBarra.addEventListener('mouseenter', () => {
    if (!pausaHover) return
    const v = document.querySelector('video')
    if (v && !v.paused) { v.pause(); pausadoPorNos = true }
  })
  elBarra.addEventListener('mouseleave', () => {
    const v = document.querySelector('video')
    if (v && pausadoPorNos) { v.play(); pausadoPorNos = false }
  })
  elBarra.querySelector('#englab-save-line').onclick = () => {
    if (!ultimoTexto) return
    salvarCaptura('', ultimoTexto)
    piscar(elBarra.querySelector('#englab-save-line'))
  }
  elBarra.querySelector('#englab-toggle-native').onclick = () => {
    ocultaNativa = !ocultaNativa
    aplicarNativa()
  }
  elBarra.querySelector('#englab-toggle-pause').onclick = e => {
    pausaHover = !pausaHover
    e.target.classList.toggle('off', !pausaHover)
  }
  elBarra.querySelector('#englab-hide').onclick = () => {
    ligada = false
    elBarra.style.display = 'none'
    aplicarNativa()
  }
  return elBarra
}

function aplicarNativa() {
  document.documentElement.classList.toggle('englab-hide-native', ligada && ocultaNativa)
}

function piscar(el) {
  el.classList.add('englab-ok')
  setTimeout(() => el.classList.remove('englab-ok'), 600)
}

function renderFala(texto) {
  if (!ligada) return
  const barra = garantirBarra()
  const linha = barra.querySelector('#englab-line')
  linha.innerHTML = ''
  // tokeniza preservando pontuação; só palavras viram clicáveis
  for (const parte of texto.split(/([A-Za-zÀ-ÿ']+)/)) {
    if (/^[A-Za-zÀ-ÿ']+$/.test(parte)) {
      const s = document.createElement('span')
      s.className = 'englab-w'
      s.textContent = parte
      s.onclick = () => { salvarCaptura(parte.toLowerCase(), texto); piscar(s) }
      linha.appendChild(s)
    } else {
      linha.appendChild(document.createTextNode(parte))
    }
  }
  barra.style.display = texto ? 'flex' : 'none'
}

// ---------------------------------------------------------------
// observador das legendas da Netflix
// ---------------------------------------------------------------
function textoDaLegenda() {
  const cont = document.querySelector('.player-timedtext')
  if (!cont) return ''
  return [...cont.querySelectorAll('.player-timedtext-text-container')]
    .map(n => n.textContent.replace(/\s+/g, ' ').trim())
    .filter(Boolean).join(' ')
}

let debounceId = null
const obs = new MutationObserver(() => {
  clearTimeout(debounceId)
  debounceId = setTimeout(() => {
    const t = textoDaLegenda()
    if (t === ultimoTexto) return
    ultimoTexto = t
    renderFala(t)
    aplicarNativa()
  }, 60)
})
obs.observe(document.body, { childList: true, subtree: true, characterData: true })

// religar a barra pelo ícone da extensão (popup manda mensagem)
chrome.runtime.onMessage?.addListener?.(msg => {
  if (msg && msg.type === 'englab-religar') {
    ligada = true
    if (elBarra) elBarra.style.display = ultimoTexto ? 'flex' : 'none'
    aplicarNativa()
  }
})
