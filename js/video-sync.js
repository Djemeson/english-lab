// ================================================================
// VÍDEO / SINCRONIA — painel Sync, deslocamento manual, sincronização
// com IA (Whisper em 2 pontos), correção progressiva e candidatas.
// Carregado LAZY depois de js/video-subs.js.
// ================================================================
function videoSyncToggle() {
  const panel = el('vid-sync-panel'); if (!panel) return
  if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return }
  panel.classList.remove('hidden')
  _vidSyncRender()
}

function _vidSyncRender(msg) {
  const panel = el('vid-sync-panel'); if (!panel) return
  const shift = (_vidCur && _vidCur.subShift) || 0
  panel.innerHTML = `
    <div class="vid-sync">
      <div class="vid-sync-row">
        <span class="vid-sync-lbl">${ic('clock','ic-sm')}Sincronia da legenda</span>
        <span class="vid-sync-shift" data-tip="Deslocamento acumulado aplicado à legenda">${shift > 0 ? '+' : ''}${shift.toFixed(1)}s</span>
        <span style="flex:1"></span>
        <button class="vid-fix-close" onclick="el('vid-sync-panel').classList.add('hidden')" aria-label="Fechar">${ic('x','ic-sm')}</button>
      </div>
      <div class="vid-sync-row">
        <span class="vid-sync-hint">Legenda ATRASADA (fala vem antes do texto)? Use −. Adiantada? Use +.</span>
      </div>
      <div class="vid-sync-row">
        <button class="btn btn-ghost btn-sm" onclick="videoSubShift(-5)">−5s</button>
        <button class="btn btn-ghost btn-sm" onclick="videoSubShift(-0.5)">−0,5s</button>
        <button class="btn btn-ghost btn-sm" onclick="videoSubShift(-0.1)">−0,1s</button>
        <button class="btn btn-ghost btn-sm" onclick="videoSubShift(0.1)">+0,1s</button>
        <button class="btn btn-ghost btn-sm" onclick="videoSubShift(0.5)">+0,5s</button>
        <button class="btn btn-ghost btn-sm" onclick="videoSubShift(5)">+5s</button>
        <span style="flex:1"></span>
        <button class="btn btn-ghost btn-sm" ${_vidSyncing ? 'disabled' : ''} onclick="videoSyncAutoAqui()"
          data-tip="Último recurso: leva o vídeo até um diálogo, pausa ali e a IA analisa DESSE ponto em diante">
          ${ic('play','ic-sm')}IA do ponto atual</button>
        <button class="btn btn-primary btn-sm" ${_vidSyncing ? 'disabled' : ''} onclick="videoSyncAuto()"
          data-tip="A IA acha sozinha o trecho mais falado do episódio, escuta ~45s, transcreve com timestamps e alinha a legenda (~R$ 0,03)">
          ${ic('sparkles','ic-sm')}Sincronizar com IA</button>
      </div>
      <div class="vid-sync-row">
        <span class="vid-sync-hint">Tradução:</span>
        <button class="btn btn-secondary btn-sm" ${_vidPTfullRodando ? 'disabled' : ''} onclick="videoTranslateFull()"
          data-tip="A IA traduz a legenda INTEIRA para PT-BR de uma vez (centavos no DeepSeek/Gemini). Depois disso a tradução aparece na hora, sem esperar o tempo real">
          ${ic('sparkles','ic-sm')}Traduzir legenda inteira</button>
      </div>
      <div class="vid-sync-row">
        <span class="vid-sync-hint">Leve a sincronização com você:</span>
        <button class="btn btn-ghost btn-sm" onclick="videoSubExport()" data-tip="Baixa o .srt COM a sincronização aplicada, com o mesmo nome do vídeo — na mesma pasta, qualquer player carrega sozinho">${ic('download','ic-sm')}Baixar .srt</button>
        ${_vidCuesPT.length ? `<button class="btn btn-ghost btn-sm" onclick="videoSubExport('pt')" data-tip="Baixa a trilha PT-BR alinhada">${ic('download','ic-sm')}.srt PT-BR</button>` : ''}
        ${_vidCues.some(c => c.pt) ? `<button class="btn btn-ghost btn-sm" onclick="videoSubExport('ia')" data-tip="Baixa a tradução criada pela IA como .srt, nos mesmos tempos da legenda em inglês — funciona em qualquer player">${ic('download','ic-sm')}.srt PT-BR (IA)</button>` : ''}
      </div>
      ${msg ? `<div class="vid-sync-status">${msg}</div>` : ''}
    </div>`
}

// Acha a janela de `dur` segundos com MAIS FALA, medida pela própria
// legenda (soma da duração das falas na janela). É onde o Whisper tem
// mais material para casar — a densidade sobrevive a legendas fora de
// sincronia, porque o desvio típico é de segundos, não de minutos.
function _vidBestSampleStart(dur, deT, ateT) {
  if (!_vidCues.length) return 60
  const fimVideo = (isFinite(_vidCur?.duration) && _vidCur.duration > dur) ? _vidCur.duration : Infinity
  const lo = deT || 0, hi = Math.min(ateT != null ? ateT : Infinity, fimVideo)
  let melhor = null, melhorFala = -1
  for (let i = 0; i < _vidCues.length; i++) {
    const ini = _vidCues[i].s
    if (ini < lo) continue
    if (ini + dur > hi) break
    let fala = 0
    for (let j = i; j < _vidCues.length && _vidCues[j].s < ini + dur; j++) {
      fala += Math.min(_vidCues[j].e, ini + dur) - _vidCues[j].s
    }
    if (fala > melhorFala) { melhorFala = fala; melhor = ini }
  }
  if (melhor == null) melhor = Math.max(lo, _vidCues[0].s)
  return Math.max(0, melhor - 1)
}

// Último recurso: o usuário posiciona o vídeo num diálogo e a IA parte dali
function videoSyncAutoAqui() {
  const p = el('vid-player'); if (!p) return
  videoSyncAuto(45, p.currentTime)
}

// Desloca TODAS as falas (EN e trilha PT juntas — o desvio é do arquivo)
function videoSubShift(delta) {
  if (!_vidCues.length || !_vidCur) return
  _vidCues.forEach(c => { c.s = Math.max(0, c.s + delta); c.e = Math.max(0.3, c.e + delta) })
  _vidCuesPT.forEach(c => { c.s = Math.max(0, c.s + delta); c.e = Math.max(0.3, c.e + delta) })
  _vidCur.subShift = +(((_vidCur.subShift || 0) + delta).toFixed(2))
  _vidCur.updated_at = new Date().toISOString()
  saveVideos(); autoSyncAfterChange()
  _vidSaveSubs()
  _vidCueIdx = -1            // força recomputar a fala corrente
  renderVidTranscript(); _vidUpdateOverlay(); _vidSyncRender()
}

// ---- Automática: a IA escuta, verifica em DOIS pontos e, se a legenda
// for de outra versão (deriva no meio), testa as CANDIDATAS da última
// busca contra as MESMAS amostras (grátis) e adota a que casar.
async function videoSyncAuto(dur, t0Manual) {
  if (_vidSyncing) return
  if (!_vidCues.length) { toast('Importe a legenda primeiro', 'warning'); return }
  if (!aiSttCfg()) { toast('A sincronização automática escuta o áudio — configure a chave da Groq ou da OpenAI', 'warning'); return }
  const p = el('vid-player'); if (!p) return
  _vidSyncing = true
  dur = dur || 40
  let msgFinal = ''
  try {
    // Janelas: 2 pontos (1º e 2º terço) quando o episódio permite — é a
    // verificação de deriva; 1 ponto para vídeos curtos ou escolha manual.
    const fimLeg = _vidCues[_vidCues.length - 1].e
    let janelas
    if (t0Manual != null) janelas = [Math.max(0, t0Manual)]
    else if (fimLeg > 240) janelas = [_vidBestSampleStart(dur, 0, fimLeg * 0.3), _vidBestSampleStart(dur, fimLeg * 0.55, fimLeg)]
    else janelas = [_vidBestSampleStart(dur, 0, fimLeg)]

    const amostras = []
    for (let k = 0; k < janelas.length; k++) {
      const t0 = janelas[k]
      _vidSyncRender(`<span class="gen-spinner"></span> Gravando amostra ${k + 1}/${janelas.length} a partir de ${_vidFmtTime(t0)} (você vai ouvi-la)...`)
      const b64 = await captureClipAudio(t0, t0 + dur)
      _vidSyncRender(`<span class="gen-spinner"></span> Transcrevendo amostra ${k + 1}/${janelas.length} com a IA...`)
      const segs = await _vidWhisper(b64, t0)
      amostras.push(segs)
    }
    if (amostras.flat().length < 3) throw new Error('a amostra tem pouca fala — tente "IA do ponto atual" num diálogo')
    const temposJanela = janelas.map(t => t + dur / 2)

    // Avalia a legenda ATUAL nos pontos amostrados
    const aval = _vidAvaliaLegenda(_vidCues, amostras)
    if (aval.matched >= 3 && aval.spread <= 0.7 && aval.disp <= 1.5) {
      // Offset constante: caso bom — aplica e encerra
      const pontosOk = aval.medianas.length
      if (Math.abs(aval.mediana) < 0.15) {
        msgFinal = `${ic('checkCircle','ic-sm')} Em sincronia de ponta a ponta (${aval.matched} falas casadas em ${pontosOk} ponto${pontosOk > 1 ? 's' : ''}).`
      } else {
        videoSubShift(+(-aval.mediana).toFixed(2))
        msgFinal = `${ic('checkCircle','ic-sm')} Sincronizado: legenda ${aval.mediana > 0 ? 'atrasada' : 'adiantada'} ${Math.abs(aval.mediana).toFixed(1)}s — verificado em ${pontosOk} ponto${pontosOk > 1 ? 's' : ''} (${aval.matched} falas)${janelas.length > pontosOk ? ' — a outra amostra não teve fala casável' : ''}.`
        toast('Legenda sincronizada pela IA', 'success')
      }
    } else {
      // Deriva (versão diferente) ou legenda que não casa: testa TODAS as
      // candidatas da mesma língua (o Djemeson pegou o teto de 5 deixando a
      // boa de fora). O custo de cada teste é 1 download + matching local —
      // a transcrição do Whisper é reaproveitada.
      const LANG3 = { en: 'eng', es: 'spa', fr: 'fre', de: 'ger', it: 'ita', pt: 'por', ja: 'jpn', ko: 'kor', ru: 'rus' }
      const langAtual = (_vidSubCandidates.find(x => x.url === _vidAppliedSubUrl) || {}).lang
        || LANG3[_vidCur.lang || 'en'] || 'eng'
      const candidatas = _vidSubCandidates.filter(c => c.url !== _vidAppliedSubUrl && c.lang === langAtual)
      const ruindade = av => Math.max(av.spread, av.disp)

      // Correção PROGRESSIVA (linear): dois pontos medidos → a legenda é
      // reescrita com o desvio interpolado no tempo. Corrige o início E o
      // fim de uma vez. Se a reavaliação (grátis) não confirmar, desfaz.
      if (aval.medianas.length === 2 && aval.matched >= 4) {
        const [off1, off2] = aval.medianas
        const [t1, t2] = temposJanela
        const bLin = (off2 - off1) / (t2 - t1)
        const aLin = off1 - bLin * t1
        const backup = _vidCues.map(c => ({ s: c.s, e: c.e }))
        const backupPT = _vidCuesPT.map(c => ({ s: c.s, e: c.e }))
        const warp = c => {
          c.s = Math.max(0, c.s - (aLin + bLin * c.s))
          c.e = Math.max(c.s + 0.3, c.e - (aLin + bLin * c.e))
        }
        _vidCues.forEach(warp); _vidCuesPT.forEach(warp)
        const pos = _vidAvaliaLegenda(_vidCues, amostras)
        if (pos.matched >= 3 && ruindade(pos) <= 1.0) {
          _vidCur.subShift = 0
          _vidCur.updated_at = new Date().toISOString()
          saveVideos(); autoSyncAfterChange(); _vidSaveSubs()
          _vidCueIdx = -1; renderVidTranscript(); _vidUpdateOverlay()
          msgFinal = `${ic('checkCircle','ic-sm')} Esta legenda DERIVA (desvio de ${off1.toFixed(1)}s no início e ${off2.toFixed(1)}s adiante) — apliquei correção PROGRESSIVA ao longo do episódio inteiro (${aval.matched} falas medidas, ${pos.matched} confirmadas depois).`
          toast('Legenda corrigida progressivamente pela IA', 'success')
          return
        }
        // não confirmou: desfaz e segue para as candidatas
        _vidCues.forEach((c, i) => { c.s = backup[i].s; c.e = backup[i].e })
        _vidCuesPT.forEach((c, i) => { c.s = backupPT[i].s; c.e = backupPT[i].e })
      }

      let melhor = null, parcial = null
      for (let i = 0; i < candidatas.length; i++) {
        _vidSyncRender(`<span class="gen-spinner"></span> Esta legenda ${aval.matched < 3 ? 'não casa com o áudio' : 'deriva no meio (versão diferente)'} — testando alternativa ${i + 1}/${candidatas.length}...`)
        try {
          const r = await fetch(candidatas[i].url)
          if (!r.ok) continue
          const cues2 = parseSubtitle(_vidDecodeSubBuf(await r.arrayBuffer()))
          if (cues2.length < 20) continue
          const a2 = _vidAvaliaLegenda(cues2, amostras)
          if (a2.matched < 3) continue
          if (a2.spread <= 0.7 && a2.disp <= 1.5 && (!melhor || a2.matched > melhor.aval.matched)) {
            melhor = { cand: candidatas[i], cues: cues2, aval: a2 }
            if (a2.matched >= 8) break     // casou bem — não precisa testar o resto
          }
          // menos ruim: guarda a de menor deriva, caso nenhuma seja perfeita
          if (!parcial || ruindade(a2) < ruindade(parcial.aval)) parcial = { cand: candidatas[i], cues: cues2, aval: a2 }
        } catch (e) { console.warn('[sync] candidata falhou:', e.message) }
      }
      const derivaAtual = aval.matched >= 3 ? ruindade(aval) : Infinity
      if (melhor) {
        _vidAdoptSub(melhor.cand, melhor.cues, melhor.aval.mediana)
        msgFinal = `${ic('checkCircle','ic-sm')} A legenda anterior era de OUTRA versão do vídeo — troquei por uma que casa de ponta a ponta (${melhor.aval.matched} falas verificadas em ${candidatas.length} alternativas) e sincronizei.`
        toast('A IA trocou a legenda por uma da versão certa', 'success')
      } else if (parcial && ruindade(parcial.aval) < derivaAtual - 1) {
        // Nenhuma é perfeita, mas há uma CLARAMENTE melhor que a atual
        _vidAdoptSub(parcial.cand, parcial.cues, parcial.aval.comeco)
        msgFinal = `Nenhuma das ${candidatas.length} legendas casa de ponta a ponta, mas troquei pela MENOS derivada: ${ruindade(parcial.aval).toFixed(1)}s de deriva contra ${isFinite(derivaAtual) ? derivaAtual.toFixed(1) + 's' : 'uma que nem casava'} da anterior, com o começo ajustado. Ainda pode escorregar adiante.`
        toast('A IA trocou pela legenda menos derivada', 'info')
      } else if (aval.matched >= 3) {
        videoSubShift(+(-aval.comeco).toFixed(2))
        msgFinal = `Ajustei o COMEÇO, mas esta legenda deriva ${ruindade(aval).toFixed(1)}s ao longo do episódio (versão com cortes diferentes) e nenhuma das ${candidatas.length} alternativas testadas casou melhor. Vai dessincronizar adiante — tente outra fonte de legenda.`
      } else {
        throw new Error(`nenhuma legenda casou com o áudio (${candidatas.length} alternativas testadas) — pode ser outro episódio`)
      }
    }
  } catch (e) {
    console.warn('[video] syncAuto:', e)
    msgFinal = `Não deu: ${esc(e.message)}. Tente "IA do ponto atual" — pause o vídeo num diálogo e clique — ou os botões manuais.`
  } finally {
    // A trava SÓ libera aqui — e o painel é re-renderizado DEPOIS dela, senão
    // o botão nasce desabilitado e assim fica.
    _vidSyncing = false
    const p2 = el('vid-player'); if (p2) p2.pause()
    _vidSyncRender(msgFinal)
  }
}

// Adota uma legenda candidata: substitui a salva, realinha a trilha PT e
// aplica o ajuste fino de offset
function _vidAdoptSub(cand, cues, offset) {
  _vidCues = cues
  _vidAppliedSubUrl = cand.url
  _vidCur.subShift = 0
  if (_vidCuesPT.length) _vidAlignPTTrack()
  if (Math.abs(offset) >= 0.15) videoSubShift(+(-offset).toFixed(2))
  else { _vidSaveSubs(); _vidCueIdx = -1; renderVidTranscript(); _vidUpdateOverlay() }
  _vidCur.cueCount = _vidCues.length
  saveVideos(); autoSyncAfterChange()
}

// Whisper com timestamps: amostra (dataURL) → segmentos em tempo ABSOLUTO
async function _vidWhisper(b64, t0) {
  const blob = await (await fetch(b64)).blob()
  const data = await aiTranscribe(blob, {
    nome: 'amostra.webm',
    lang: (_vidCur.lang || 'en') === 'en' ? 'en' : undefined
  })
  return (data.segments || []).map(s => ({ t: s.text, abs: t0 + s.start }))
    .filter(s => (s.t || '').trim().length > 6)
}

// Casa os segmentos transcritos com as falas de UMA legenda e mede:
// mediana por amostra, mediana geral e o SPREAD entre as amostras —
// spread alto = a legenda deriva = versão diferente do vídeo.
function _vidAvaliaLegenda(cues, amostras) {
  let _c = 0
  const norm = t => String(t).toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(w => w.length > 1)
  const medianas = [], todos = []
  for (const segs of amostras) {
    const deltas = []
    for (const seg of segs) {
      const tokensSeg = new Set(norm(seg.t))
      if (tokensSeg.size < 3) continue
      let melhor = null, melhorScore = 0
      for (const c of cues) {
        if (c.s < seg.abs - 60 || c.s > seg.abs + 60) continue
        const tokensCue = norm(c.t)
        if (!tokensCue.length) continue
        let inter = 0
        for (const w of tokensCue) if (tokensSeg.has(w)) inter++
        const score = inter / Math.min(tokensSeg.size, tokensCue.length)
        if (score > melhorScore) { melhorScore = score; melhor = c }
      }
      if (melhor && melhorScore >= 0.5) deltas.push(melhor.s - seg.abs)
    }
    if (deltas.length) {
      // comeco: mediana da PRIMEIRA metade da 1a amostra (em ordem de tempo)
      // — e o que o fallback usa para ao menos acertar o inicio do episodio
      if (!medianas.length) {
        const metade = deltas.slice(0, Math.ceil(deltas.length / 2)).sort((a, b) => a - b)
        _c = metade[Math.floor(metade.length / 2)]
      }
      deltas.sort((a, b) => a - b)
      medianas.push(deltas[Math.floor(deltas.length / 2)])
      todos.push(...deltas)
    }
  }
  todos.sort((a, b) => a - b)
  // disp: dispersão DENTRO das amostras (aparada nas pontas quando há dados
  // suficientes). Pega deriva mesmo com uma janela só: numa legenda da versão
  // certa os desvios são todos parecidos; numa de versão diferente, os do
  // começo e os do fim da amostra divergem.
  let disp = 0
  if (todos.length >= 2) {
    const corte = todos.length >= 6 ? 1 : 0
    disp = todos[todos.length - 1 - corte] - todos[corte]
  }
  return {
    matched: todos.length,
    medianas,
    mediana: todos.length ? todos[Math.floor(todos.length / 2)] : 0,
    spread: medianas.length > 1 ? Math.max(...medianas) - Math.min(...medianas) : 0,
    disp,
    comeco: _c
  }
}

// Decodificação de legenda (UTF-8 × 1252 por evidência + des-mojibake)
function _vidDecodeSubBuf(buf) {
  const u8 = new TextDecoder('utf-8').decode(buf)
  const w12 = new TextDecoder('windows-1252').decode(buf)
  const ruimU8 = (u8.match(/\uFFFD/g) || []).length
  const ruimW12 = (w12.match(/Ã[©ªµ£§¡³]|â[€™"]|Â./g) || []).length
  return _vidFixMojibake(ruimU8 <= ruimW12 ? u8 : w12)
}

// ---- Baixar a legenda SINCRONIZADA como .srt ----
// Mesmo nome do arquivo de vídeo: players externos a carregam sozinhos.
