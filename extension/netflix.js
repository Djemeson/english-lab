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
// PROMESSA + catch em vez de callback: com callback, o erro de contexto
// invalidado estoura dentro do Chrome e vira "Uncaught"; com promessa,
// vira rejeicao e o .catch() resolve.
function pedirExt(fn) {
  if (extMorta) return Promise.resolve(null)
  let p
  try {
    if (!extViva()) { morrer(); return Promise.resolve(null) }
    p = fn()
  } catch (e) { morrer(); return Promise.resolve(null) }
  return Promise.resolve(p).catch(() => { morrer(); return null })
}

// ---- estado ----
let cues = []                 // legenda completa (quando o TTML é capturado)
let idxAtual = -1
let ultimoTexto = ''
let histórico = []            // [{t, texto}] — falas que já passaram (modo DOM)
let ptCache = new Map()       // chavePT(texto) → tradução
let ptPend = new Set()
let barra = null, painel = null
let cfgUI = { ligada: true, ocultaNativa: true, pausaHover: true, pt: false, fog: true, transcript: false }
let pausadoPorNos = false
let tituloId = null          // id do titulo aberto (/watch/NNNN)

// A Netflix e uma SPA: trocar de episodio nao recarrega a pagina. Sem
// resetar aqui, a legenda do titulo ANTERIOR continua na memoria, se
// mistura com a nova (a uniao de segmentos) e o resultado e legenda
// trocada/dessincronizada — exatamente o que o Djemeson viu.
function idDoTitulo() {
  const m = location.pathname.match(/\/watch\/(\d+)/)
  return m ? m[1] : null
}
function resetarSessao() {
  cues = []; idxAtual = -1; ultimoTexto = ''
  histórico = []; ptCache = new Map(); ptPend = new Set()
  ruleIni = null; ruleCur = null
  pausadoPorNos = false; popPausou = false; popCtx = ''
  if (barra) {
    const linha = barra.querySelector('#englab-line'); if (linha) linha.innerHTML = ''
    const rule = barra.querySelector('#englab-rule')
    if (rule) { rule.innerHTML = ''; rule.style.display = 'none'; ruleTrack = null }
    pintarPT()
  }
  const pop = document.getElementById('englab-pop'); if (pop) pop.remove()
  if (cfgUI.transcript) renderTranscript()
}

pedirExt(() => chrome.storage.local.get({ llui: null })).then(r => {
  if (r && r.llui) { cfgUI = { ...cfgUI, ...r.llui }; sincronizarBotoes(); aplicarNativa() }
}).catch(() => {})
const salvarUI = () => pedirExt(() => chrome.storage.local.set({ llui: cfgUI }))

const vid = () => document.querySelector('video')
const titulo = () => {
  const t = document.querySelector('[data-uia="video-title"]')
  return (t && t.textContent.trim().replace(/\s+/g, ' ')) ||
    document.title.replace(/ - Netflix.*$/i, '').trim() || 'Netflix'
}

// ---- captura para o app ----
function salvarCaptura(word, context) {
  pedirExt(() => chrome.storage.local.get({ pend: [] })).then(r => {
    if (!r) return
    const pend = r.pend || []
    pend.push({ word, context, title: titulo(), ts: Date.now() })
    return pedirExt(() => chrome.storage.local.set({ pend }))
  }).catch(() => {})
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
  // Trocar o IDIOMA da legenda no mesmo titulo tambem traz cues novos: se
  // eles ocupam os mesmos tempos com textos diferentes, e OUTRA trilha —
  // unir misturaria dois idiomas na tela.
  if (cues.length) {
    let colisoes = 0, iguais = 0
    for (const c of novos.slice(0, 60)) {
      const ex = cues.find(x => Math.abs(x.s - c.s) < 0.25)
      if (!ex) continue
      colisoes++
      if (chavePT(ex.t) === chavePT(c.t)) iguais++
    }
    // 2 colisões já bastam: no mesmo idioma, tempos iguais trazem texto igual —
    // divergir aí é sinal de outra trilha (e no começo do episódio há poucas falas).
    if (colisoes >= 2 && iguais / colisoes < 0.5) {
      cues = []; ptCache = new Map(); ptPend = new Set(); ruleIni = null; ruleCur = null
      avisar('legenda trocada — recomeçando')
    }
  }
  const antes = cues.length
  const mapa = new Map(cues.map(c => [c.s.toFixed(2) + '|' + c.t, c]))
  for (const c of novos) mapa.set(c.s.toFixed(2) + '|' + c.t, c)
  cues = [...mapa.values()].sort((a, b) => a.s - b.s)
  idxAtual = -1
  if (cues.length !== antes) avisar(`legenda: ${cues.length} falas`)
  const vv = vid()
  montarRegua(vv ? vv.currentTime : 0)
  if (cfgUI.transcript) renderTranscript()
})

// O texto que o player DESENHA e o que vem no ARQUIVO quase nunca sao
// identicos (italico, simbolos, espacos). Como o cache era indexado pelo
// texto cru, a traducao existia mas nunca era achada — a legenda PT "nao
// aparecia". A chave agora compara so letras e numeros.
const chavePT = t => String(t || '').toLowerCase().replace(/[^0-9a-zA-Zà-ÿÀ-Ÿ]+/g, ' ').trim()
function ptDe(texto) {
  if (!texto) return ''
  const direto = ptCache.get(chavePT(texto))
  if (direto) return direto
  // Fallback SO se o texto exibido for mesmo o do cue corrente — senao
  // mostrariamos a traducao de outra fala (o "PT correndo atras").
  if (idxAtual >= 0 && cues[idxAtual] && chavePT(cues[idxAtual].t) === chavePT(texto)) {
    return ptCache.get(chavePT(cues[idxAtual].t)) || ''
  }
  return ''
}

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
    if (c.s > t + 90) break   // 90s de antecedencia: fornecedor lento nao atrasa a legenda
    if (!ptCache.has(chavePT(c.t)) && !ptPend.has(c.t)) alvos.push(c.t)
  }
  if (!alvos.length) return
  for (const bloco of fatiar(alvos.slice(0, 60), 6)) {
    bloco.forEach(x => ptPend.add(x))
    pedirExt(() => chrome.runtime.sendMessage({ type: 'ai-traduzir', falas: bloco })).then(resp => {
      bloco.forEach(x => ptPend.delete(x))
      if (!resp || !resp.ok) { if (resp && resp.erro) avisar(resp.erro); return }
      bloco.forEach((x, i) => { if (resp.pt[i]) ptCache.set(chavePT(x), resp.pt[i]) })
      pintarPT()
      if (cfgUI.transcript) renderTranscript()
    }).catch(() => { bloco.forEach(x => ptPend.delete(x)) })
  }
}
const fatiar = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

function traduzirAvulsa(texto) {   // modo DOM (sem arquivo de legenda)
  if (!cfgUI.pt || ptCache.has(chavePT(texto)) || ptPend.has(texto)) return
  ptPend.add(texto)
  pedirExt(() => chrome.runtime.sendMessage({ type: 'ai-traduzir', falas: [texto] })).then(resp => {
    ptPend.delete(texto)
    if (resp && resp.ok && resp.pt[0]) { ptCache.set(chavePT(texto), resp.pt[0]); pintarPT() }
    else if (resp && resp.erro) avisar(resp.erro)
  }).catch(() => { ptPend.delete(texto) })
}

function pintarPT() {
  const el = barra && barra.querySelector('#englab-pt')
  if (!el) return
  // A ALTURA do painel nao pode depender de haver traducao: o espaco fica
  // reservado enquanto o modo PT estiver ligado (classe no proprio bar) e
  // so o conteudo aparece/some.
  barra.classList.toggle('englab-tem-pt', !!cfgUI.pt)
  el.style.display = ''
  if (!cfgUI.pt) return
  const pt = ptDe(ultimoTexto)
  // Sem traducao ainda: reticencias — da para ver que a IA esta trabalhando
  // (o DeepSeek leva alguns segundos).
  const esperando = !pt && !!ultimoTexto
  el.textContent = pt || (esperando ? '...' : '')
  el.classList.toggle('englab-vazia', !pt && !esperando)
  el.classList.toggle('englab-esperando', esperando)
  el.classList.toggle('englab-fog', cfgUI.fog && !esperando)
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
    </div>
    <div class="englab-rule" id="englab-rule" title="Régua de falas: cada bloco é uma fala, o vão é silêncio. Clique para ir até lá."></div>`
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
    // com o popup aberto o aluno esta indo ate ele: manter pausado
    if (document.getElementById('englab-pop')) return
    if (pausadoPorNos) { tocar(); pausadoPorNos = false }
  })
  // seleção de trecho → Explicar / Estudar (o popup do app)
  barra.querySelector('#englab-rule').addEventListener('click', ev => {
    const b = ev.target.closest('.englab-rb')
    if (b) { ev.stopPropagation(); seek(parseFloat(b.dataset.t) - 0.15) }
  })
  barra.querySelector('#englab-line').addEventListener('mouseup', () => setTimeout(mostrarPopupSel, 10))
  // arraste que termina fora da linha (acontece muito) também conta
  document.addEventListener('mouseup', ev => {
    if (!barra || barra.style.display === 'none') return
    if (ev.target.closest && ev.target.closest('#englab-pop')) return
    setTimeout(() => { if (String(window.getSelection() || '').trim()) mostrarPopupSel() }, 10)
  })
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
      // Clique simples captura a palavra; arrastar (selecionar trecho) não —
      // por isso medimos o deslocamento entre mousedown e mouseup.
      s.onmousedown = ev => { s._x = ev.clientX; s._y = ev.clientY }
      s.onclick = ev => {
        const arrastou = s._x != null &&
          (Math.abs(ev.clientX - s._x) > 4 || Math.abs(ev.clientY - s._y) > 4)
        s._x = s._y = null
        if (arrastou || String(window.getSelection() || '').trim()) return   // seleção manda
        ev.stopPropagation()
        salvarCaptura(parte.toLowerCase(), texto); piscar(s)
      }
      linha.appendChild(s)
    } else linha.appendChild(document.createTextNode(parte))
  }
  // A barra NAO some no silencio (senao nao daria para clicar em "voltar a
  // ultima fala" justo quando se precisa) — mas FORA do player (menu, busca,
  // pagina inicial) ela nao tem o que fazer.
  b.style.display = (idDoTitulo() && vid()) ? 'flex' : 'none'
  b.classList.toggle('englab-mudo', !texto)
  pintarPT()
}

// ---- popup de seleção: Explicar / Estudar / Revisar ----
let popCtx = ''          // fala de origem CONGELADA no instante da selecao
let popPausou = false
function mostrarPopupSel() {
  const sel = String(window.getSelection() || '').trim()
  const antigo = document.getElementById('englab-pop')
  if (!sel) { fecharPopupSel(); return }
  // Congela AQUI: o video pode voltar a rodar enquanto o mouse vai ate o
  // botao, e ai "ultimoTexto" ja seria outra fala (bug relatado).
  popCtx = ultimoTexto
  const vv = vid()
  if (vv && !vv.paused) { pausar(); popPausou = true }
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
    salvarCaptura(sel.toLowerCase(), popCtx); avisar(`"${sel}" vai para o Revisar`); fecharPopupSel()
  }
  pop.querySelector('[data-p="exp"]').onclick = () => {
    const v2 = vid(); if (v2 && !v2.paused) { pausar(); popPausou = true }
    const body = pop.querySelector('#englab-pop-body')
    body.textContent = 'a IA está explicando…'
    pedirExt(() => chrome.runtime.sendMessage({ type: 'ai-explicar', alvo: sel, contexto: popCtx, titulo: titulo() })).then(resp => {
      body.textContent = (resp && resp.ok) ? resp.texto : ('Não deu: ' + ((resp && resp.erro) || 'sem resposta'))
    }).catch(() => { body.textContent = 'Extensão atualizada — recarregue a página (F5).' })
  }
}
function fecharPopupSel() {
  const pop = document.getElementById('englab-pop')
  if (pop) pop.remove()
  if (popPausou) { tocar(); popPausou = false }
  popCtx = ''
}
document.addEventListener('mousedown', e => {
  const pop = document.getElementById('englab-pop')
  if (pop && !pop.contains(e.target) && !e.target.closest('#englab-line')) fecharPopupSel()
})

// ---- RÉGUA DE FALAS (deslizante) -----------------------------------
// Cada bloco é uma fala: largura = duração, vão = silêncio. O trilho é
// montado UMA vez em pixels e depois só DESLIZA (transform a cada frame),
// em vez de ser repintado — é isso que dá o movimento macio.
const RULE_PXS = 16          // pixels por segundo de vídeo
const RULE_BLOCO = 300       // segundos montados de cada vez
let ruleTrack = null, ruleRaf = null, ruleIni = null, ruleCur = null

function montarRegua(t) {
  const el = barra && barra.querySelector('#englab-rule')
  if (!el) return
  if (!cues.length) { el.style.display = 'none'; return }
  el.style.display = 'block'
  ruleIni = Math.max(0, t - RULE_BLOCO / 2)
  const fim = ruleIni + RULE_BLOCO
  let html = ''
  for (const c of cues) {
    if (c.e < ruleIni) continue
    if (c.s > fim) break
    html += `<i class="englab-rb" data-t="${c.s}"
      style="left:${((c.s - ruleIni) * RULE_PXS).toFixed(1)}px;width:${Math.max((c.e - c.s) * RULE_PXS, 4).toFixed(1)}px"
      title="${escapar(c.t).slice(0, 90)}"></i>`
  }
  let track = el.querySelector('.englab-rtrack')
  if (!track) {
    el.innerHTML = '<div class="englab-rtrack"></div><b class="englab-rnow"></b>'
    track = el.querySelector('.englab-rtrack')
  }
  track.innerHTML = html
  ruleTrack = track
  ruleCur = null
}

function loopRegua() {
  ruleRaf = requestAnimationFrame(loopRegua)
  const v = vid()
  if (!v || !ruleTrack || !cues.length || ruleIni == null) return
  const t = v.currentTime
  // remonta só quando o tempo se aproxima da borda do bloco montado
  if (t < ruleIni + 20 && ruleIni > 0) { montarRegua(t); return }
  if (t > ruleIni + RULE_BLOCO - 20) { montarRegua(t); return }
  const el = ruleTrack.parentElement
  const meio = el.clientWidth / 2
  ruleTrack.style.transform = `translate3d(${(meio - (t - ruleIni) * RULE_PXS).toFixed(2)}px,0,0)`
  // destaque muda de bloco raramente: só mexe no DOM quando troca
  const i = cueEm(t)
  const alvo = i >= 0 ? String(cues[i].s) : null
  if (alvo !== ruleCur) {
    ruleTrack.querySelector('.englab-rb.cur')?.classList.remove('cur')
    if (alvo) ruleTrack.querySelector(`.englab-rb[data-t="${alvo}"]`)?.classList.add('cur')
    ruleCur = alvo
  }
}
if (!ruleRaf) loopRegua()

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
          ${cfgUI.pt && ptCache.get(chavePT(c.t)) ? `<span class="englab-tr-pt">${escapar(ptCache.get(chavePT(c.t)))}</span>` : ''}
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
  // A barra nasce assim que estamos num player — mesmo em silencio. Antes
  // ela so era criada quando um texto MUDAVA, entao um video que comecava
  // calado ficava sem barra (e sem os botoes de navegacao).
  if (cfgUI.ligada && idDoTitulo() && v) garantirBarra().style.display = 'flex'
  const doDOM = textoDOM()
  let t = ''
  if (cues.length && v) {
    // O ARQUIVO manda quando cobre o instante: assim a fala exibida e a
    // traduzida sao a MESMA (fim do descompasso EN x PT).
    const i = cueEm(v.currentTime)
    t = i >= 0 ? cues[i].t : ''
  }
  if (!t) t = doDOM        // silencio no arquivo (ou sem arquivo): usa a tela
  if (t === ultimoTexto) return
  ultimoTexto = t
  if (t && v) {
    histórico.push({ t: v.currentTime, texto: t })
    if (histórico.length > 600) histórico.shift()
  }
  renderFala(t)
  aplicarNativa()
  if (cfgUI.pt && t && !ptCache.has(chavePT(t))) traduzirAvulsa(t)
  if (cfgUI.transcript) renderTranscript()
}

setInterval(() => {
  // vigia a troca de episodio/filme e a saida para o menu
  const idAgora = idDoTitulo()
  if (idAgora !== tituloId) {
    tituloId = idAgora
    resetarSessao()
    if (idAgora) avisar('novo título — legenda zerada')
  }
  if (!idAgora) {                       // no menu: some e nao processa nada
    if (barra) barra.style.display = 'none'
    document.documentElement.classList.remove('englab-hide-native')
    return
  }
  const v = vid(); if (!v) return
  if (cues.length) {
    const i = cueEm(v.currentTime)
    if (i !== idxAtual) { idxAtual = i; if (cfgUI.transcript) renderTranscript() }
    if (cfgUI.pt) traduzirJanela(v.currentTime)
    if (ruleIni == null) montarRegua(v.currentTime)
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

// ---- a barra sai da frente dos controles do player -------------------
// A Netflix mostra os controles ao mover o mouse e os esconde sozinha
// depois de alguns segundos; seguimos o mesmo ritmo.
let ctrlTimer = null
function controlesAmostra() {
  if (!barra) return
  barra.classList.add('englab-up')
  document.getElementById('englab-pop')?.classList.add('englab-up')
  clearTimeout(ctrlTimer)
  ctrlTimer = setTimeout(() => {
    barra && barra.classList.remove('englab-up')
    document.getElementById('englab-pop')?.classList.remove('englab-up')
  }, 3600)
}
document.addEventListener('mousemove', controlesAmostra, { passive: true })
document.addEventListener('keydown', controlesAmostra, { passive: true })

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
try { chrome.runtime.onMessage.addListener(msg => {
  if (msg && msg.type === 'englab-religar') {
    cfgUI.ligada = true; salvarUI()
    if (barra) barra.style.display = 'flex'
    aplicarNativa()
  }
}) } catch (e) { morrer() }

// Rede de segurança: engole o erro de contexto invalidado para ele não
// poluir a lista de Erros da extensão (acontece ao atualizar a extensão
// com a aba da Netflix aberta).
window.addEventListener('error', ev => {
  const m = String((ev && ev.message) || '')
  if (m.includes('Extension context invalidated') || m.includes('Receiving end does not exist')) {
    morrer(); ev.preventDefault(); ev.stopImmediatePropagation()
  }
}, true)
