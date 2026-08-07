// ================================================================
// INJETADO NO MUNDO DA PÁGINA (world: MAIN) — sem acesso a chrome.*
// Único trabalho: farejar o ARQUIVO de legendas que o player da Netflix
// baixa (TTML/DFXP) e repassar as falas com tempo real ao content script.
// É isso que destrava navegação por fala, transcript e tradução
// antecipada — o DOM sozinho só entrega a fala do instante.
// ================================================================
'use strict'
;(() => {
  const ehLegenda = url => /nflxvideo\.net\/\?o=|\.dfxp|\.ttml|timedtext/i.test(String(url || ''))

  function parseTTML(xmlTexto) {
    try {
      const doc = new DOMParser().parseFromString(xmlTexto, 'text/xml')
      const tt = doc.querySelector('tt')
      if (!tt) return null
      // Netflix usa ticks: begin="123456789t" + ttp:tickRate no <tt>
      const tickRate = parseFloat(tt.getAttribute('ttp:tickRate') || tt.getAttribute('tickRate') || '10000000')
      const seg = v => {
        if (!v) return null
        const s = String(v).trim()
        if (s.endsWith('t')) return parseFloat(s) / tickRate
        if (s.endsWith('s')) return parseFloat(s)
        const m = s.match(/^(\d+):(\d+):(\d+(?:[.,]\d+)?)$/)
        if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3].replace(',', '.'))
        return parseFloat(s) || null
      }
      const cues = []
      for (const p of doc.querySelectorAll('p')) {
        const s = seg(p.getAttribute('begin')), e = seg(p.getAttribute('end'))
        if (s == null || e == null) continue
        // O comentário antigo dizia "<br/> vira espaço" — e NÃO virava:
        // `textContent` concatena os nós de texto sem separador, então
        // "meddled<br/>to start" saía "meddledto start". Aqui o <br> é
        // trocado por espaço ANTES de ler o texto.
        const clone = p.cloneNode(true)
        clone.querySelectorAll('br').forEach(br => br.replaceWith(doc.createTextNode(' ')))
        const t = clone.textContent.replace(/\s+/g, ' ').trim()
        if (t) cues.push({ s, e, t })
      }
      cues.sort((a, b) => a.s - b.s || a.e - b.e)

      // ⚠️ AS DUAS LINHAS DA MESMA FALA. A Netflix às vezes manda cada linha
      // num <p> PRÓPRIO com o MESMO intervalo de tempo — e aí viravam duas
      // falas, das quais a tela mostrava só a primeira. Era exatamente o
      // "Well, if you hadn't meddled" aparecendo sem o "to start with,".
      // Quem tem o mesmo tempo é uma fala só e é remontado aqui.
      const juntos = []
      for (const c of cues) {
        const ult = juntos[juntos.length - 1]
        const mesmoTempo = ult && Math.abs(ult.s - c.s) < 0.05 && Math.abs(ult.e - c.e) < 0.05
        if (mesmoTempo) ult.t += ' ' + c.t
        else juntos.push({ ...c })
      }
      return juntos.length ? juntos : null
    } catch (e) { return null }
  }

  function entregar(texto) {
    const cues = parseTTML(texto)
    if (cues) window.postMessage({ type: 'englab-nf-cues', cues }, '*')
  }

  // --- XHR (caminho usado pelo player da Netflix) ---
  const XHRopen = XMLHttpRequest.prototype.open
  const XHRsend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, url, ...r) {
    this._englabUrl = url
    return XHRopen.call(this, m, url, ...r)
  }
  XMLHttpRequest.prototype.send = function (...args) {
    if (ehLegenda(this._englabUrl)) {
      this.addEventListener('load', () => {
        try {
          const t = this.responseType === '' || this.responseType === 'text' ? this.responseText : null
          if (t && t.includes('<tt')) entregar(t)
        } catch (e) {}
      })
    }
    return XHRsend.apply(this, args)
  }

  // --- fetch (caminho alternativo) ---
  const fetchOrig = window.fetch
  window.fetch = async function (...args) {
    const res = await fetchOrig.apply(this, args)
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url)
      if (ehLegenda(url)) {
        res.clone().text().then(t => { if (t && t.includes('<tt')) entregar(t) }).catch(() => {})
      }
    } catch (e) {}
    return res
  }

  // ---- CONTROLE DO PLAYER ------------------------------------------
  // NUNCA mexer em video.currentTime: o player da Netflix alimenta o
  // <video> por MSE/DRM e um seek por fora derruba o pipeline (o crash
  // que o Djemeson viu). O caminho legitimo e a API interna do player.
  function playerNF() {
    try {
      const api = window.netflix && window.netflix.appContext &&
        window.netflix.appContext.state.playerApp.getAPI()
      const vp = api && api.videoPlayer
      if (!vp) return null
      const ids = vp.getAllPlayerSessionIds ? vp.getAllPlayerSessionIds() : []
      const id = ids.find(x => String(x).indexOf('watch-') === 0) || ids[0]
      return id ? vp.getVideoPlayerBySessionId(id) : null
    } catch (e) { return null }
  }

  window.addEventListener('message', ev => {
    if (ev.source !== window || !ev.data) return
    const d = ev.data
    if (d.type === 'englab-nf-seek') {
      if (!isFinite(d.t)) return
      const p = playerNF()
      if (p && typeof p.seek === 'function') {
        try {
          p.seek(Math.max(0, d.t) * 1000)      // a API fala em milissegundos
          if (d.play && typeof p.play === 'function') p.play()
          return
        } catch (e) {}
      }
      // Sem a API: nao arriscamos o pipeline — avisamos e nao movemos nada.
      window.postMessage({ type: 'englab-nf-sem-api' }, '*')
    } else if (d.type === 'englab-nf-pause' || d.type === 'englab-nf-play') {
      const p = playerNF()
      const acao = d.type === 'englab-nf-pause' ? 'pause' : 'play'
      if (p && typeof p[acao] === 'function') { try { p[acao](); return } catch (e) {} }
      const v = document.querySelector('video')      // pause/play direto e inofensivo
      if (v) { try { v[acao]() } catch (e) {} }
    }
  })
})()
