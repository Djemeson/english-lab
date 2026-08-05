// ================================================================
// LANGUAGE LAB × NETFLIX — o módulo Vídeo do app, dentro do player.
// Duas fontes de legenda, nesta ordem:
//   1) o ARQUIVO TTML que o player baixa (inject.js) → tempos reais,
//      transcript completo, navegação por fala, tradução antecipada;
//   2) o DOM (.player-timedtext) → sempre funciona, mesmo sem (1).
// Chaves de IA nunca entram aqui: quem chama a API é o service worker.
// ================================================================
'use strict'

// Ao ATUALIZAR a extensao, este script segue vivo na aba antiga mas perde o
// vinculo: qualquer chrome.* vira "Extension context invalidated". Tudo o
// que fala com a extensao passa por aqui.
let extMorta = false
const extViva = () => { try { return !!(chrome.runtime && chrome.runtime.id) } catch (e) { return false } }
function morrer() {
  if (extMorta) return
  extMorta = true
  avisar('extensão atualizada — recarregue a página (F5)')
}
function comExt(fn) {
  if (extMorta) return
  if (!extViva()) { morrer(); return }
  try { fn() } catch (e) { morrer() }
}
// Embrulha CALLBACKS do chrome.*: eles rodam depois da chamada, fora do
// try/catch acima, e ali ate ler chrome.runtime.lastError pode lançar.
function cbExt(fn) {
  return function (...args) {
    if (extMorta) return
    try {
      if (chrome.runtime.lastError) { morrer(); return }
      fn(...args)
    } catch (e) { morrer() }
  }
}

// ---- estado ----
let cues = []                 // legenda completa (quando o TTML é capturado)
let idxAtual = -1
let ultimoTexto = ''
let histórico = []            // [{t, texto}] — falas que já passaram (modo DOM)
let ptCache = new Map()       // texto → tradução
let ptPend = new Set()
let barra = null, painel = null
let cfgUI = { ligada: true, ocultaNativa: true, pausaHover: true, pt: false, fog: true, transcript: false }
let pausadoPorNos = false

comExt(() => chrome.storage.local.get({ llui: null }, cbExt(({ llui }) => {
  if (llui) { cfgUI = { ...cfgUI, ...llui }; sincronizarBotoes(); aplicarNativa() }
})))
const salvarUI = () => comExt(() => chrome.storage.local.set({ llui: cfgUI }, cbExt(() => {})))

const vid = () => document.querySelector('video')
const titulo = () => {
  const t = document.querySelector('[data-uia="video-title"]')
  return (t && t.textContent.trim().replace(/\s+/g, ' ')) ||
    document.title.replace(/ - Netflix.*$/i, '').trim() || 'Netflix'
}

// ---- captura para o app ----
function salvarCaptura(word, context) {
  comExt(() => chrome.storage.local.get({ pend: [] }, cbExt(({ pend }) => {
    pend.push({ word, context, title: titulo(), ts: Date.now() })
    comExt(() => chrome.storage.local.set({ pend }, cbExt(() => {})))
  })))
}
function piscar(el) { el.classList.add('englab-ok'); setTimeout(() => el.classList.remove('englab-ok'), 600) }

// ---- legenda completa vinda do inject.js ----
window.addEventListener('message', ev => {
  if (ev.source !== window || !ev.data || ev.data.type !== 'englab-nf-cues') return
  const novos = ev.data.cues || []
  if (!novos.length) return
  // A Netflix entrega a legenda em SEGMENTOS. Substituir a lista a cada
  // chegada deixava sumir tudo o que veio antes ("secoes inteiras de fala
  // que nao aparecem") — agora e UNIAO, com dedupe por tempo+texto.
  const antes = cues.length
  const mapa = new Map(cues.map(c => [c.s.toFixed(2) + '|' + c.t, c]))
  for (const c of novos) mapa.set(c.s.toFixed(2) + '|' + c.t, c)
  cues = [...mapa.values()].sort((a, b) => a.s - b.s)
  idxAtual = -1
  if (cues.length !== antes) avisar(`legenda: ${cues.length} falas`)
  if (cfgUI.transcript) renderTranscript()
})

const seek = (t, play = true) => window.postMessage({ type: 'englab-nf-seek', t, play }, '*')
const pausar = () => window.postMessage({ type: 'englab-nf-pause' }, '*')
const tocar  = () => window.postMessage({ type: 'englab-nf-play' }, '*')
window.addEventListener('message', ev => {
  if (ev.source === window && ev.data && ev.data.type === 'englab-nf-sem-api')
    avisar('não consegui controlar o player nesta tela — recarregue a página (F5)')
})

// ---- fala corrente ----
function cueEm(t) {
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i].s - 0.25 && t <= cues[i].e + 0.25) return i
    if (cues[i].s > t) break
  }
  return -1
}
// Uma frase pode estar quebrada em várias legendas (mesma regra do app):
// navegar por GRUPO evita cair no meio da frase.
function continua(i) {
  const a = cues[i - 1], b = cues[i]
  if (!a || !b) return false
  if (b.s - a.e > 1.5) return false
  const tb = String(b.t).trim(), ta = String(a.t).trim()
  if (/^[-–—]/.test(tb)) return false
  return !/[.!?…]["')\]]*$/.test(ta)
}
const grupoIni = i => { let g = 0; while (i > 0 && continua(i) && g++ < 12) i--; return Math.max(0, i) }
const grupoFim = i => { let g = 0; while (i + 1 < cues.length && continua(i + 1) && g++ < 12) i++; return i }

function falaAnterior() {
  const v = vid(); if (!v) return
  if (!cues.length) {   // modo DOM: usa o histórico
    const h = histórico[histórico.length - 2]
    if (h) seek(h.t - 0.2)
    return
  }
  const i = cueEm(v.currentTime)
  let alvo = i < 0 ? cues.findIndex(c => c.s > v.currentTime) - 1 : grupoIni(i)
  if (alvo < 0) alvo = 0
  if (v.currentTime - cues[alvo].s <= 0.8) alvo = grupoIni(Math.max(0, alvo - 1))
  seek(cues[alvo].s - 0.2)
}
function repetirFala() {
  const v = vid(); if (!v) return
  if (!cues.length) { const h = histórico[histórico.length - 1]; if (h) seek(h.t - 0.2); return }
  const i = cueEm(v.currentTime)
  if (i < 0) return
  seek(cues[grupoIni(i)].s - 0.2)
}
function proximaFala() {
  const v = vid(); if (!v) return
  if (!cues.length) { seek(v.currentTime + 5); return }
  const i = cueEm(v.currentTime)
  let alvo = i < 0 ? cues.findIndex(c => c.s > v.currentTime) : grupoFim(grupoIni(i)) + 1
  if (alvo < 0 || alvo >= cues.length) alvo = cues.length - 1
  if (cues[alvo].s - v.currentTime <= 0.6) {
    const seg = grupoFim(alvo) + 1
    if (seg < cues.length) alvo = seg
  }
  seek(cues[alvo].s - 0.2)
}

// ---- tradução (IA) com janela antecipada, como no app ----
function traduzirJanela(t) {
  if (!cfgUI.pt || !cues.length) return
  const alvos = []
  for (const c of cues) {
    if (c.e < t - 0.5) continue
    if (c.s > t + 30) break
    if (!ptCache.has(c.t) && !ptPend.has(c.t)) alvos.push(c.t)
  }
  if (!alvos.length) return
  for (const bloco of fatiar(alvos, 4)) {
    bloco.forEach(x => ptPend.add(x))
    comExt(() => chrome.runtime.sendMessage({ type: 'ai-traduzir', falas: bloco }, cbExt(resp => {
      bloco.forEach(x => ptPend.delete(x))
      if (!resp || !resp.ok) { if (resp && resp.erro) avisar(resp.erro); return }
      bloco.forEach((x, i) => { if (resp.pt[i]) ptCache.set(x, resp.pt[i]) })
      pintarPT()
      if (cfgUI.transcript) renderTranscript()
    })))
  }
}
const fatiar = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

function traduzirAvulsa(texto) {   // modo DOM (sem arquivo de legenda)
  if (!cfgUI.pt || ptCache.has(texto) || ptPend.has(texto)) return
  ptPend.add(texto)
  comExt(() => chrome.runtime.sendMessage({ type: 'ai-traduzir', falas: [texto] }, cbExt(resp => {
    ptPend.delete(texto)
    if (resp && resp.ok && resp.pt[0]) { ptCache.set(texto, resp.pt[0]); pintarPT() }
    else if (resp && resp.erro) avisar(resp.erro)
  })))
}

function pintarPT() {
  const el = barra && barra.querySelector('#englab-pt')
  if (!el) return
  const pt = cfgUI.pt ? (ptCache.get(ultimoTexto) || '') : ''
  el.textContent = pt
  el.style.display = pt ? 'block' : 'none'
  el.classList.toggle('englab-fog', cfgUI.fog)
}

// ---- barra ----
function garantirBarra() {
  if (barra && document.body.contains(barra)) return barra
  barra = document.createElement('div')
  barra.id = 'englab-bar'
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
  const IC = {
    prev: svg('<path d="M18 6 10 12l8 6z"/><path d="M6 5v14"/>'),
    rep:  svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
    next: svg('<path d="M6 6l8 6-8 6z"/><path d="M18 5v14"/>'),
    fog:  svg('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>'),
    add:  svg('<path d="M12 5v14M5 12h14"/>'),
    tr:   svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
    cc:   svg('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M10.5 10.3a2.4 2.4 0 1 0 0 3.4M17.2 10.3a2.4 2.4 0 1 0 0 3.4"/>'),
    hide: svg('<path d="M18 6 6 18M6 6l12 12"/>')
  }
  barra.innerHTML = `
    <div class="englab-nav">
      <button data-a="prev" title="Fala anterior (←)">${IC.prev}</button>
      <button data-a="rep"  title="Repetir esta fala (R)">${IC.rep}</button>
      <button data-a="next" title="Próxima fala (→)">${IC.next}</button>
    </div>
    <div class="englab-mid">
      <div class="englab-line" id="englab-line"></div>
      <div class="englab-pt" id="englab-pt"></div>
    </div>
    <div class="englab-tools">
      <button data-a="pt"   class="englab-pill" title="Tradução PT-BR pela IA (P)">PT</button>
      <button data-a="fog"  title="Névoa: tradução borrada até passar o mouse">${IC.fog}</button>
      <button data-a="line" title="Salvar a frase inteira no Language Lab">${IC.add}</button>
      <button data-a="tr"   title="Transcript do episódio (T)">${IC.tr}</button>
      <button data-a="cc"   title="Mostrar/esconder a legenda original">${IC.cc}</button>
      <button data-a="hide" title="Esconder a barra">${IC.hide}</button>
    </div>`
  document.body.appendChild(barra)

  barra.addEventListener('click', e => {
    const b = e.target.closest('button[data-a]'); if (!b) return
    const a = b.dataset.a
    if (a === 'prev') falaAnterior()
    else if (a === 'rep') repetirFala()
    else if (a === 'next') proximaFala()
    else if (a === 'pt') { cfgUI.pt = !cfgUI.pt; salvarUI(); sincronizarBotoes(); if (cfgUI.pt) { const v = vid(); cues.length ? traduzirJanela(v ? v.currentTime : 0) : traduzirAvulsa(ultimoTexto) } else pintarPT() }
    else if (a === 'fog') { cfgUI.fog = !cfgUI.fog; salvarUI(); sincronizarBotoes(); pintarPT() }
    else if (a === 'line') { if (ultimoTexto) { salvarCaptura('', ultimoTexto); piscar(b) } }
    else if (a === 'tr') { cfgUI.transcript = !cfgUI.transcript; salvarUI(); sincronizarBotoes(); renderTranscript() }
    else if (a === 'cc') { cfgUI.ocultaNativa = !cfgUI.ocultaNativa; salvarUI(); sincronizarBotoes(); aplicarNativa() }
    else if (a === 'hide') { cfgUI.ligada = false; salvarUI(); barra.style.display = 'none'; aplicarNativa() }
  })
  barra.addEventListener('mouseenter', () => {
    if (!cfgUI.pausaHover) return
    const v = vid(); if (v && !v.paused) { pausar(); pausadoPorNos = true }
  })
  barra.addEventListener('mouseleave', () => {
    if (pausadoPorNos) { tocar(); pausadoPorNos = false }
  })
  // seleção de trecho → Explicar / Estudar (o popup do app)
  barra.querySelector('#englab-line').addEventListener('mouseup', () => setTimeout(mostrarPopupSel, 10))
  sincronizarBotoes()
  return barra
}

function sincronizarBotoes() {
  if (!barra) return
  const on = (a, v) => barra.querySelector(`button[data-a="${a}"]`)?.classList.toggle('on', !!v)
  on('pt', cfgUI.pt); on('fog', cfgUI.fog); on('tr', cfgUI.transcript); on('cc', !cfgUI.ocultaNativa)
}
function aplicarNativa() {
  document.documentElement.classList.toggle('englab-hide-native', cfgUI.ligada && cfgUI.ocultaNativa)
}
function avisar(msg) {
  let t = document.getElementById('englab-toast')
  if (!t) { t = document.createElement('div'); t.id = 'englab-toast'; document.body.appendChild(t) }
  t.textContent = msg
  t.classList.add('on')
  clearTimeout(t._id); t._id = setTimeout(() => t.classList.remove('on'), 3200)
}

// ---- render da fala (palavras clicáveis) ----
function renderFala(texto) {
  if (!cfgUI.ligada) return
  const b = garantirBarra()
  const linha = b.querySelector('#englab-line')
  linha.innerHTML = ''
  for (const parte of texto.split(/([A-Za-zÀ-ÿ']+)/)) {
    if (/^[A-Za-zÀ-ÿ']+$/.test(parte)) {
      const s = document.createElement('span')
      s.className = 'englab-w'
      s.textContent = parte
      s.onclick = ev => {
        if (window.getSelection().toString().trim()) return   // seleção manda
        ev.stopPropagation()
        salvarCaptura(parte.toLowerCase(), texto); piscar(s)
      }
      linha.appendChild(s)
    } else linha.appendChild(document.createTextNode(parte))
  }
  b.style.display = texto ? 'flex' : 'none'
  pintarPT()
}

// ---- popup de seleção: Explicar / Estudar / Revisar ----
function mostrarPopupSel() {
  const sel = String(window.getSelection() || '').trim()
  const antigo = document.getElementById('englab-pop')
  if (!sel) { antigo?.remove(); return }
  const pop = antigo || document.createElement('div')
  pop.id = 'englab-pop'
  pop.innerHTML = `
    <div class="englab-pop-row">
      <b>"${sel.length > 40 ? sel.slice(0, 40) + '…' : sel}"</b>
      <button data-p="exp">Explicar</button>
      <button data-p="rev">Estudar</button>
    </div>
    <div class="englab-pop-body" id="englab-pop-body"></div>`
  if (!antigo) document.body.appendChild(pop)
  pop.onmousedown = e => e.preventDefault()   // não colapsa a seleção
  pop.querySelector('[data-p="rev"]').onclick = () => {
    salvarCaptura(sel.toLowerCase(), ultimoTexto); avisar(`"${sel}" vai para o Revisar`); pop.remove()
  }
  pop.querySelector('[data-p="exp"]').onclick = () => {
    const v = vid(); if (v && !v.paused) pausar()
    const body = pop.querySelector('#englab-pop-body')
    body.textContent = 'a IA está explicando…'
    comExt(() => chrome.runtime.sendMessage({ type: 'ai-explicar', alvo: sel, contexto: ultimoTexto, titulo: titulo() }, cbExt(resp => {
      body.textContent = (resp && resp.ok) ? resp.texto : ('Não deu: ' + ((resp && resp.erro) || 'sem resposta'))
    })))
  }
}
document.addEventListener('mousedown', e => {
  const pop = document.getElementById('englab-pop')
  if (pop && !pop.contains(e.target) && !e.target.closest('#englab-line')) pop.remove()
})

// ---- transcript do episódio ----
function renderTranscript() {
  if (!cfgUI.transcript) { painel?.remove(); painel = null; return }
  if (!painel) {
    painel = document.createElement('div')
    painel.id = 'englab-transcript'
    document.body.appendChild(painel)
  }
  const linhas = cues.length ? cues : histórico.map((h, i) => ({ s: h.t, e: h.t, t: h.texto, _h: i }))
  if (!linhas.length) { painel.innerHTML = `<div class="englab-tr-vazio">Sem legenda capturada ainda — troque a legenda no player para o inglês.</div>`; return }
  painel.innerHTML = `
    <div class="englab-tr-head">
      <b>${cues.length ? cues.length + ' falas' : histórico.length + ' falas (do que já passou)'}</b>
      <input id="englab-tr-busca" placeholder="Buscar na legenda...">
    </div>
    <div class="englab-tr-list" id="englab-tr-list">
      ${linhas.map((c, i) => `
        <div class="englab-tr-line${i === idxAtual ? ' cur' : ''}" data-i="${i}" data-t="${c.s}">
          <span class="englab-tr-time">${fmt(c.s)}</span>
          <span class="englab-tr-txt">${escapar(c.t)}</span>
          ${cfgUI.pt && ptCache.get(c.t) ? `<span class="englab-tr-pt">${escapar(ptCache.get(c.t))}</span>` : ''}
        </div>`).join('')}
    </div>`
  painel.querySelector('#englab-tr-list').onclick = e => {
    const l = e.target.closest('.englab-tr-line'); if (!l) return
    seek(parseFloat(l.dataset.t) - 0.2)
  }
  painel.querySelector('#englab-tr-busca').oninput = e => {
    const q = e.target.value.toLowerCase()
    painel.querySelectorAll('.englab-tr-line').forEach(l => {
      l.style.display = !q || l.textContent.toLowerCase().includes(q) ? '' : 'none'
    })
  }
  const cur = painel.querySelector('.englab-tr-line.cur')
  if (cur) cur.scrollIntoView({ block: 'center' })
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const escapar = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---- o que mostrar AGORA -------------------------------------------
// Regra de ouro: o DOM e a verdade do que esta na tela (nunca perde uma
// fala, mesmo que o arquivo de legenda venha incompleto ou atrasado). O
// arquivo serve para navegar, traduzir na frente e montar o transcript.
function renderAtual() {
  const v = vid()
  const doDOM = textoDOM()
  let t = doDOM
  if (!t && cues.length && v) {
    const i = cueEm(v.currentTime)
    t = i >= 0 ? cues[i].t : ''
  }
  if (t === ultimoTexto) return
  ultimoTexto = t
  if (t && v) {
    histórico.push({ t: v.currentTime, texto: t })
    if (histórico.length > 600) histórico.shift()
  }
  renderFala(t)
  aplicarNativa()
  if (cfgUI.pt && t && !ptCache.has(t)) traduzirAvulsa(t)
  if (cfgUI.transcript) renderTranscript()
}

setInterval(() => {
  const v = vid(); if (!v) return
  if (cues.length) {
    const i = cueEm(v.currentTime)
    if (i !== idxAtual) { idxAtual = i; if (cfgUI.transcript) renderTranscript() }
    if (cfgUI.pt) traduzirJanela(v.currentTime)
  }
  renderAtual()
}, 120)

// ---- fallback: observa o DOM (sempre ativo; manda quando não há arquivo) ----
function textoDOM() {
  const c = document.querySelector('.player-timedtext')
  if (!c) return ''
  return [...c.querySelectorAll('.player-timedtext-text-container')]
    .map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ')
}
let deb = null
new MutationObserver(() => {
  clearTimeout(deb)
  deb = setTimeout(renderAtual, 40)   // reage na hora; o relogio e a rede de seguranca
}).observe(document.body, { childList: true, subtree: true, characterData: true })

// ---- atalhos ----
document.addEventListener('keydown', e => {
  if (!cfgUI.ligada) return
  const tag = (document.activeElement?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea') return
  if (e.ctrlKey || e.altKey || e.metaKey) return
  const k = e.key.toLowerCase()
  if (k === 'arrowleft')  { e.preventDefault(); e.stopPropagation(); falaAnterior() }
  else if (k === 'arrowright') { e.preventDefault(); e.stopPropagation(); proximaFala() }
  else if (k === 'r') { e.preventDefault(); repetirFala() }
  else if (k === 'p') { barra?.querySelector('button[data-a="pt"]')?.click() }
  else if (k === 't') { barra?.querySelector('button[data-a="tr"]')?.click() }
}, true)

// religar pela popup da extensão
comExt(() => chrome.runtime.onMessage.addListener(msg => {
  if (msg && msg.type === 'englab-religar') {
    cfgUI.ligada = true; salvarUI()
    if (barra) barra.style.display = ultimoTexto ? 'flex' : 'none'
    aplicarNativa()
  }
}))

// Rede de segurança: engole o erro de contexto invalidado para ele não
// poluir a lista de Erros da extensão (acontece ao atualizar a extensão
// com a aba da Netflix aberta).
window.addEventListener('error', ev => {
  const m = String((ev && ev.message) || '')
  if (m.includes('Extension context invalidated') || m.includes('Receiving end does not exist')) {
    morrer(); ev.preventDefault(); ev.stopImmediatePropagation()
  }
}, true)
