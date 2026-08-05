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
        // <br/> vira espaço; tags de estilo somem
        const t = p.textContent.replace(/\s+/g, ' ').trim()
        if (t) cues.push({ s, e, t })
      }
      cues.sort((a, b) => a.s - b.s)
      return cues.length ? cues : null
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

  // O content script pode pedir o tempo/controle do player
  window.addEventListener('message', ev => {
    if (ev.source !== window || !ev.data || ev.data.type !== 'englab-nf-seek') return
    const v = document.querySelector('video')
    if (v && isFinite(ev.data.t)) { v.currentTime = Math.max(0, ev.data.t); if (ev.data.play) v.play() }
  })
})()
