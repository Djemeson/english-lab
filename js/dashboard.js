// Estado das abas do painel — no TOPO pelo mesmo motivo do settings.js:
// renderDashboard() chama setDashTab(_dashTab) e roda no boot.
let _dashTab = (typeof loadUiPrefs === 'function' && loadUiPrefs().dashTab) || 'progresso'
const DASH_TABS = ['progresso', 'vocabulario', 'conquistas']

// ================================================================
// DASHBOARD
// ================================================================
function renderDashboard() {
  // srsCards already in memory via initApp — no loadSrs() needed here
  const total   = words.length
  const inSrs   = words.filter(w => w.status === 'in_srs').length
  const pendingAI = words.filter(w => w.status === 'pending_ai').length
  const pendingRev = words.filter(w => w.status === 'pending_review').length
  const pending = pendingAI + pendingRev
  const dueToday  = srsDueCount()
  const newToday  = srsNewTodayRemaining()
  const paraHoje  = dueToday + newToday
  const streak    = srsStreak()
  const totalReviewed = srsLog.reduce((s,l) => s + (l.reviewed||0), 0)
  const totalCorrect  = srsLog.reduce((s,l) => s + (l.correct||0), 0)
  const acerto = totalReviewed > 0 ? Math.round((totalCorrect / totalReviewed) * 100) : 0

  // Badge nav
  const badge = el('badge-review')
  if (badge) { badge.textContent = pending; badge.classList.toggle('hidden', pending === 0) }
  const badgeMob = el('badge-review-mob')
  if (badgeMob) { badgeMob.textContent = pending; badgeMob.classList.toggle('hidden', pending === 0) }

  // ── Ação principal ──
  const mainArea = el('dash-main-action')
  if (mainArea) {
    if (paraHoje > 0) {
      // O número precisa de rótulo: "183" sozinho não diz do que se trata.
      // E a quebra revisões/novos vira dado legível, não uma linha cinza solta.
      mainArea.innerHTML = `
        <div class="dash-action-card">
          <div class="dash-action-left">
            <div class="dash-eyebrow">Para revisar hoje</div>
            <div class="dash-num">${paraHoje}</div>
          </div>
          <div class="dash-hero-split">
            <div class="dhs-item"><b>${dueToday}</b><span>${dueToday !== 1 ? 'revisões' : 'revisão'}</span></div>
            <div class="dhs-item"><b>${newToday}</b><span>novo${newToday !== 1 ? 's' : ''}</span></div>
            ${streak > 0 ? `<div class="dhs-item streak"><b>${ic('flame','ic-sm')}${streak}</b><span>dia${streak!==1?'s':''} seguido${streak!==1?'s':''}</span></div>` : ''}
          </div>
          <button class="btn btn-primary" onclick="showSection('revisar')">Revisar agora ${ic('arrowRight')}</button>
        </div>`
    } else {
      mainArea.innerHTML = `
        <div class="dash-action-card" style="background:var(--surface);border-color:var(--border)">
          <div class="dash-action-left">
            <div class="dash-num" style="color:var(--success);display:flex;align-items:center">${ic('check','ic-xl')}</div>
            <div class="dash-sub">Nada para revisar hoje. Volte amanhã!</div>
          </div>
          <button class="btn btn-ghost" onclick="showSection('adicionar')">${ic('plus')}Adicionar palavras</button>
        </div>`
    }
  }

  // ── Ação secundária: pendentes de IA ──
  const statsArea = el('dash-stats-area')
  if (statsArea) {
    const secondaryHTML = pending > 0 ? `
      <div class="dash-secondary">
        <span>${pendingAI > 0 ? pendingAI + ' palavra' + (pendingAI!==1?'s':'') + ' aguardando IA' : ''}${pendingAI>0&&pendingRev>0?' · ':''}${pendingRev > 0 ? pendingRev + ' pronta' + (pendingRev!==1?'s':'') + ' para enviar ao Estudo' : ''}</span>
        <button class="btn btn-ghost btn-sm" onclick="showSection('preparar')">${pendingAI > 0 ? ic('sparkles') : ic('eye')}Ir para Preparar</button>
      </div>` : ''
    statsArea.innerHTML = secondaryHTML + `
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-icon">${ic('bookOpen')}</div>
          <div class="metric-body"><div class="mc-val">${total}</div><div class="mc-lbl">Capturadas</div></div>
        </div>
        <div class="metric-card">
          <div class="metric-icon purple">${ic('layers')}</div>
          <div class="metric-body"><div class="mc-val">${inSrs}</div><div class="mc-lbl">Em estudo</div></div>
        </div>
        <div class="metric-card">
          <div class="metric-icon green">${ic('target')}</div>
          <div class="metric-body"><div class="mc-val">${acerto}%</div><div class="mc-lbl">Taxa de acerto</div></div>
        </div>
        <div class="metric-card">
          <div class="metric-icon amber">${ic('flame')}</div>
          <div class="metric-body"><div class="mc-val">${streak}</div><div class="mc-lbl">Sequência</div></div>
        </div>
      </div>`
  }

  // Os chips de recentes viraram um cartão do painel "Vocabulário" (dashRecentCard).

  updateDashTabSignals()
  setDashTab(_dashTab)
}

// ================================================================
// DASHBOARD — dados das seções extras (atividade, tendência, idiomas,
// leeches, palavra do dia, fontes, conquistas). Tudo derivado de
// srsLog/srsCards/words já em memória — sem estado novo persistido.
// ================================================================

function _dateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

// Janela do heatmap: 4 semanas para a frente + quantas semanas de passado
// COUBEREM na largura disponível. A grade tinha largura fixa (57 colunas ×
// 14px = 795px) dentro de uma coluna de 412px, e a diferença virava barra de
// rolagem — metade do ano ficava escondida atrás de um arrasto que ninguém dá.
// Agora a célula é fluida (colunas 1fr) e o número de semanas é escolhido para
// a célula não ficar menor que ~11px. Overflow deixa de ser possível.
const DASH_HM_FUT = 28
const DASH_HM_GAP = 3
const DASH_HM_MAX_SEM = 53   // teto: um ano de passado

// Declarados AQUI, no topo, e não no fim do arquivo: `renderDashboardGrid`
// roda no boot e um `let` declarado depois cairia na zona morta temporal
// (a lição do item 52 — o hoisting salva a função, não a variável).
let _hmSemanasAtual = null
let _hmResizeTimer = null

// Largura real disponível para a grade. A fonte boa é o próprio container da
// renderização anterior; na PRIMEIRA vez ele ainda não existe, então estima a
// coluna 1.7fr do `.dash-grid` (que vira 1fr abaixo de 1040px — ver o media
// query do CSS) e desconta padding do cartão (44), coluna Seg/Qua/Sex (34) e
// o gap (8).
function dashHmLarguraUtil() {
  const cont = document.querySelector('#dpanel-progresso .dash-hm-container')
  if (cont && cont.clientWidth > 40) return cont.clientWidth
  const painel = el('dpanel-progresso')
  const base = (painel && painel.clientWidth) || window.innerWidth || 1000
  const coluna = window.innerWidth <= 1040 ? base : (base - 18) * 1.7 / 2.7
  return Math.max(150, coluna - 86)
}

// Nº de semanas de PASSADO que cabem. É aqui que o histórico encolhe para a
// grade caber: quem manda é o espaço, não um número fixo de meses.
function dashHmSemanas() {
  const passo = window.innerWidth < 600 ? 12 : 14      // célula mínima + gap
  const colunas = Math.floor(dashHmLarguraUtil() / passo)
  return Math.min(DASH_HM_MAX_SEM, Math.max(8, colunas - DASH_HM_FUT / 7))
}

// Quantos cards JÁ AGENDADOS caem em cada dia à frente.
// Cards `new` ficam de fora de propósito: eles não têm data marcada — entram
// pelo limite diário (`srsCfg.newPerDay`) no dia em que você abrir a sessão.
// Contá-los inventaria uma carga que o calendário não sabe onde colocar.
function dashForecast(days = DASH_HM_FUT) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const limite = new Date(hoje); limite.setDate(limite.getDate() + days)
  const map = {}
  srsCards.forEach(c => {
    if (!c.due || c.state === 'new') return
    const d = new Date(c.due); d.setHours(0, 0, 0, 0)
    if (d <= hoje || d > limite) return          // atrasados e hoje não são previsão
    const ds = _dateStr(d)
    map[ds] = (map[ds] || 0) + 1
  })
  return map
}

// Grade de atividade (estilo GitHub), alinhada p/ começar num domingo:
// passado = o que foi estudado (célula cheia), futuro = o que está agendado
// (célula vazada). A distinção é o ponto — carga prevista não pode se
// confundir com esforço já feito.
function dashHeatCells(diasPassado) {
  const DASH_HM_PAST = diasPassado
  const byDate = {}
  srsLog.forEach(l => { byDate[l.date] = l.reviewed || 0 })
  const prev = dashForecast(DASH_HM_FUT)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const hojeStr = _dateStr(today)
  const start = new Date(today); start.setDate(start.getDate() - (DASH_HM_PAST - 1))
  const cells = []
  for (let i = 0; i < start.getDay(); i++) cells.push({ cls: 'dash-hm-pad' })
  for (let i = 0; i < DASH_HM_PAST + DASH_HM_FUT; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i)
    const ds = _dateStr(d)
    const data = d.toLocaleDateString('pt-BR')
    if (i >= DASH_HM_PAST) {
      const n = prev[ds] || 0
      const nivel = n === 0 ? '' : n <= 5 ? ' f1' : n <= 15 ? ' f2' : n <= 30 ? ' f3' : ' f4'
      cells.push({ cls: 'fut' + nivel, tip: n ? `${data} — ${n} card${n===1?'':'s'} previsto${n===1?'':'s'}` : `${data} — nada previsto` })
    } else {
      const n = byDate[ds] || 0
      const nivel = n === 0 ? '' : n <= 5 ? 'l1' : n <= 15 ? 'l2' : n <= 30 ? 'l3' : 'l4'
      cells.push({ cls: nivel + (ds === hojeStr ? ' hoje' : ''), tip: `${data} — ${n} revis${n===1?'ão':'ões'}` })
    }
  }
  return cells
}

// Taxa de acerto dos últimos N dias (só os dias com revisão entram na linha).
function dashAccuracyTrend(days = 14) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const pts = []
  let totalReviewed = 0, totalCorrect = 0
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const log = srsLog.find(l => l.date === _dateStr(d))
    if (log && log.reviewed > 0) {
      totalReviewed += log.reviewed; totalCorrect += log.correct || 0
      pts.push({ i: days - 1 - i, pct: Math.round((log.correct || 0) / log.reviewed * 100) })
    }
  }
  const avg = totalReviewed > 0 ? Math.round(totalCorrect / totalReviewed * 100) : null
  let svgPoints = ''
  if (pts.length >= 2) {
    const max = 100, min = 50
    svgPoints = pts.map(p => {
      const x = (p.i / (days - 1)) * 300
      const y = 52 - ((Math.max(min, p.pct) - min) / (max - min)) * 48 - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }
  return { avg, svgPoints, hasData: pts.length >= 2 }
}

// Progresso por idioma (baseado nos cards já em estudo, agrupados por lang/estado).
function dashLangRows() {
  const byLang = {}
  srsCards.forEach(c => {
    const code = c.lang || 'en'
    if (!byLang[code]) byLang[code] = { new: 0, learn: 0, rev: 0, total: 0 }
    const s = byLang[code]
    s.total++
    if (c.state === 'new') s.new++
    else if (c.state === 'review') s.rev++
    else s.learn++ // learning/relearning
  })
  return Object.entries(byLang).sort((a, b) => b[1].total - a[1].total).map(([code, s]) => {
    const name = (typeof getLangDef === 'function' && getLangDef(code) && getLangDef(code).name) || code.toUpperCase()
    const pct = n => s.total ? Math.round(n / s.total * 100) + '%' : '0%'
    return { name, total: s.total, newPct: pct(s.new), learnPct: pct(s.learn), revPct: pct(s.rev) }
  })
}

// Cards marcados como sanguessuga (muitos lapsos) — um chip por palavra, sem repetir.
function dashLeeches() {
  const seen = new Set(), list = []
  srsCards.filter(c => c.leech).forEach(c => {
    const key = c.wordId || c.word
    if (seen.has(key)) return
    seen.add(key)
    list.push({ word: c.word || '(?)' })
  })
  return list.slice(0, 12)
}

// Palavra em destaque: escolha determinística pelo dia (mesma palavra o dia todo),
// preferindo cards com origem/história registrada.
function dashWordOfDay() {
  const withOrigin = srsCards.filter(c => c.origin_pt && c.word && c.meaning_pt)
  const pool = withOrigin.length ? withOrigin : srsCards.filter(c => c.word && c.meaning_pt)
  if (!pool.length) return null
  const ds = todayStr()
  let h = 0
  for (let i = 0; i < ds.length; i++) h = (h * 31 + ds.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}

// Fontes de onde o vocabulário veio (agrupado por título da fonte, ou tipo quando sem título).
function dashSources() {
  const TYPE_LABEL = { series: 'Séries', movie: 'Filmes', youtube: 'YouTube', kindle: 'Kindle', podcast: 'Podcasts', website: 'Sites', manual: 'Manual' }
  const byKey = {}
  words.forEach(w => {
    const key = w.source_title || TYPE_LABEL[w.source_type] || 'Outros'
    if (!byKey[key]) byKey[key] = { name: key, count: 0, type: w.source_type }
    byKey[key].count++
  })
  const list = Object.values(byKey).sort((a, b) => b.count - a.count).slice(0, 6)
  const max = list.length ? list[0].count : 1
  return list.map(s => ({ ...s, pct: Math.round(s.count / max * 100) + '%' }))
}

// Conquistas — marcos simples calculados direto dos dados (sem sistema de gamificação novo).
function dashAchievements() {
  const matured = srsCards.filter(c => c.state === 'review' && c.interval >= 21).length
  const langsCount = new Set(words.map(w => w.lang || 'en')).size
  const idiomsCount = words.filter(w => w.type === 'idiom').length
  const streak = srsStreak()
  return [
    { icon: 'pencil',   title: 'Primeira palavra', desc: 'Adicionou seu 1º card',   unlocked: words.length >= 1 },
    { icon: 'sparkles', title: '50 dominadas',      desc: '50 cards maduros',        unlocked: matured >= 50 },
    { icon: 'clock',    title: '7 dias seguidos',   desc: 'Uma semana de sequência', unlocked: streak >= 7 },
    { icon: 'lock',     title: 'Poliglota',         desc: '2 idiomas em estudo',     unlocked: langsCount >= 2 },
    { icon: 'heart',    title: '100 idioms',        desc: '100 expressões salvas',   unlocked: idiomsCount >= 100 },
    { icon: 'book',     title: '500 capturadas',    desc: '500 palavras adicionadas', unlocked: words.length >= 500 },
  ]
}

// Monta o interior do `.dash-hm-wrap` (faixa de meses + grade) para um dado
// número de semanas de passado. Isolado porque roda DUAS vezes: na montagem do
// painel e no ajuste que acontece depois de medir o container de verdade.
function dashHmWrapHTML(semanas) {
  const diasPassado = semanas * 7
  const heatCells = dashHeatCells(diasPassado)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const totalDays = diasPassado + DASH_HM_FUT
  const start = new Date(today); start.setDate(start.getDate() - (diasPassado - 1))
  const padOffset = start.getDay()

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  // Nº real de colunas: as células de padding do começo empurram a grade, então
  // fixar 53 deixava a última coluna sem rótulo em parte do ano.
  const totalCols = Math.ceil((padOffset + totalDays) / 7)
  const monthLabels = []
  let lastMonth = -1
  for (let col = 0; col < totalCols; col++) {
    const colDate = new Date(start)
    colDate.setDate(start.getDate() + (col * 7 - padOffset))
    const m = colDate.getMonth()
    if (m !== lastMonth) { monthLabels.push({ col, name: monthNames[m] }); lastMonth = m }
  }

  // Filter labels to prevent overlaps (must be at least 3 columns apart)
  const finalMonthLabels = []
  let lastCol = -9
  monthLabels.forEach(lbl => {
    if (lbl.col - lastCol >= 3) { finalMonthLabels.push(lbl); lastCol = lbl.col }
  })

  // Teto de tamanho: célula fluida sem limite viraria um quadrado de 35px
  // numa tela larga. Passo máximo de 16px = célula de 13px, densidade de
  // calendário. Sobrando espaço, a grade para de crescer em vez de inchar.
  const hmMaxPx = totalCols * 16 - DASH_HM_GAP

  // Com célula fluida o rótulo não pode ser posicionado em px. Posição exata
  // da coluna i numa grade de N colunas 1fr com gap g:
  //   i * (célula + g), com célula = (100% - (N-1)g)/N  →  i/N*100% + i*g/N
  const monthLabelsHTML = finalMonthLabels.map(lbl => {
    const pct = (lbl.col / totalCols * 100).toFixed(3)
    const px = (lbl.col * DASH_HM_GAP / totalCols).toFixed(1)
    return `<span class="dash-hm-month-lbl" style="left:calc(${pct}% + ${px}px)">${lbl.name}</span>`
  }).join('')

  return `
    <div class="dash-hm-months-row" style="max-width:${hmMaxPx}px">${monthLabelsHTML}</div>
    <div class="dash-hm-grid" style="grid-template-columns:repeat(${totalCols},1fr);max-width:${hmMaxPx}px">${
      heatCells.map(c => `<div class="dash-hm-cell ${c.cls}" ${c.tip ? `title="${escA(c.tip)}"` : ''}></div>`).join('')
    }</div>`
}

// Depois de inserido, o container tem largura REAL — a estimativa da primeira
// renderização erra por natureza. Se a medida pedir outro número de semanas,
// reconstrói só a grade, não o painel inteiro.
function dashHmAjustar() {
  const wrap = document.querySelector('#dpanel-progresso .dash-hm-wrap')
  if (!wrap) return
  const ideal = dashHmSemanas()
  if (ideal === _hmSemanasAtual) return
  _hmSemanasAtual = ideal
  wrap.innerHTML = dashHmWrapHTML(ideal)
}

function renderDashboardGrid() {
  // Os painéis substituíram o antigo #dash-grid-area (ver setDashTab).
  if (!el('dpanel-progresso')) return

  const hmSemanas = dashHmSemanas()
  _hmSemanasAtual = hmSemanas
  const totalMonthReviews = srsLog.filter(l => {
    const d = new Date(l.date); const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, l) => s + (l.reviewed || 0), 0)

  const trend = dashAccuracyTrend(14)
  const langs = dashLangRows()
  const leeches = dashLeeches()
  const wod = dashWordOfDay()
  const sources = dashSources()

  // Calculate statistics for the heatmap stats row
  const activeDays = srsLog.filter(l => (l.reviewed || 0) > 0).length
  const totalReviews = srsLog.reduce((sum, l) => sum + (l.reviewed || 0), 0)
  const maxReviews = srsLog.length ? Math.max(...srsLog.map(l => l.reviewed || 0), 0) : 0
  const dailyAverage = activeDays > 0 ? (totalReviews / activeDays).toFixed(1) : '0'
  const streak = srsStreak()

  // Carga prevista da próxima semana — o número que o calendário sozinho
  // não dá (as células mostram a distribuição, não o total).
  const prev7 = Object.values(dashForecast(7)).reduce((s, n) => s + n, 0)

  const heatmapCard = `
    <div class="dash-card">
      <div class="dash-card-h">
        <div>
          <div class="dash-eyebrow">Atividade</div>
          <h3>Frequência de Estudos</h3>
        </div>
        <span class="dash-metaval">${totalMonthReviews} revis${totalMonthReviews===1?'ão':'ões'} este mês</span>
      </div>
      
      <div class="dash-hm-days-and-grid">
        <div class="dash-hm-days">
          <div></div>
          <div>Seg</div>
          <div></div>
          <div>Qua</div>
          <div></div>
          <div>Sex</div>
          <div></div>
        </div>
        <div class="dash-hm-container">
          <div class="dash-hm-wrap">${dashHmWrapHTML(hmSemanas)}</div>
        </div>
      </div>
      
      <div class="dash-hm-legend">
        <span>Menos</span>
        <div class="dash-hm-cell"></div>
        <div class="dash-hm-cell l1"></div>
        <div class="dash-hm-cell l2"></div>
        <div class="dash-hm-cell l3"></div>
        <div class="dash-hm-cell l4"></div>
        <span>Mais</span>
        <span class="dash-hm-legend-sep"></span>
        <div class="dash-hm-cell fut f3"></div>
        <span>Previsto</span>
      </div>

      <div class="dash-hm-stats">
        <div class="hm-stat">
          <div class="hm-stat-num">${totalReviews}</div>
          <div class="hm-stat-lbl">Revisões</div>
        </div>
        <div class="hm-stat">
          <div class="hm-stat-num">${activeDays}</div>
          <div class="hm-stat-lbl">Dias Ativos</div>
        </div>
        <div class="hm-stat">
          <div class="hm-stat-num">${dailyAverage}</div>
          <div class="hm-stat-lbl">Média Diária</div>
        </div>
        <div class="hm-stat">
          <div class="hm-stat-num">${maxReviews}</div>
          <div class="hm-stat-lbl">Recorde</div>
        </div>
        <div class="hm-stat">
          <div class="hm-stat-num" style="color:var(--warning); display:flex; align-items:center; gap:4px">${streak}${ic('flame','ic-sm')}</div>
          <div class="hm-stat-lbl">Sequência</div>
        </div>
        <div class="hm-stat">
          <div class="hm-stat-num">${prev7}</div>
          <div class="hm-stat-lbl">Próx. 7 dias</div>
        </div>
      </div>
    </div>`

  // --- Weekly Reviews Stats and Chart ---
  const todayDate = new Date(); todayDate.setHours(0,0,0,0)
  const dayOfWeek = todayDate.getDay() // 0 = dom, 1 = seg...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(todayDate)
  monday.setDate(todayDate.getDate() + diffToMonday)

  const daysLabel = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  const reviewsCount = []
  const correctCount = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const ds = _dateStr(d)
    const log = srsLog.find(l => l.date === ds)
    reviewsCount.push(log ? (log.reviewed || 0) : 0)
    correctCount.push(log ? (log.correct || 0) : 0)
  }

  const weeklyTotal = reviewsCount.reduce((s, c) => s + c, 0)
  const maxInWeek = Math.max(...reviewsCount, 5) // Mínimo 5 para escala agradável
  const halfInWeek = Math.round(maxInWeek / 2)

  let barsHTML = ''
  for (let i = 0; i < 7; i++) {
    const count = reviewsCount[i]
    const correct = correctCount[i]
    const x = 30 + i * 48
    const barWidth = 20
    const maxHeight = 85 // Altura máxima da barra em pixels
    const barHeight = (count / maxInWeek) * maxHeight
    const correctHeight = (correct / maxInWeek) * maxHeight

    const y = 110 - barHeight
    const cy = 110 - correctHeight

    // Track de fundo (opcional, deixa mais visual)
    const bgTrack = `<rect x="${x}" y="25" width="${barWidth}" height="${maxHeight}" rx="4" fill="var(--border)" opacity="0.15" />`
    
    // Barra de revisados (azul translúcido/fundo)
    const reviewedBar = `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="var(--primary)" opacity="0.35" />`
    
    // Barra de corretos (verde sólido por cima)
    const correctBar = correct > 0 ? `<rect x="${x}" y="${cy}" width="${barWidth}" height="${correctHeight}" rx="4" fill="var(--success)" />` : ''

    // Texto de contador de revisões (somente se maior que zero)
    const labelText = count > 0 ? `<text x="${x + 10}" y="${y - 4}" fill="var(--text)" font-size="8" font-weight="700" text-anchor="middle" font-family="var(--font-mono)">${count}</text>` : ''
    
    // Rótulo do dia
    const dayLabel = `<text x="${x + 10}" y="125" fill="var(--text2)" font-size="9" text-anchor="middle" font-weight="600">${daysLabel[i]}</text>`

    barsHTML += `${bgTrack}${reviewedBar}${correctBar}${labelText}${dayLabel}`
  }

  const weeklyReviewsCard = `
    <div class="dash-card" style="margin-top:20px">
      <div class="dash-card-h">
        <div>
          <div class="dash-eyebrow">Atividade Semanal</div>
          <h3>Volume de Estudos</h3>
        </div>
        <span class="dash-metaval">${weeklyTotal} revis${weeklyTotal===1?'ão':'ões'} esta semana</span>
      </div>
      <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 12px;">
        <svg viewBox="0 0 380 140" style="width: 100%; height: auto; overflow: visible;">
          <!-- Linhas de grade -->
          <line x1="25" y1="25" x2="365" y2="25" stroke="var(--border)" stroke-dasharray="3,3" />
          <line x1="25" y1="67" x2="365" y2="67" stroke="var(--border)" stroke-dasharray="3,3" />
          <line x1="25" y1="110" x2="365" y2="110" stroke="var(--border-strong)" stroke-width="1.2" />

          <!-- Eixos Y labels -->
          <text x="5" y="28" fill="var(--text3)" font-size="8" font-family="var(--font-mono)">${maxInWeek}</text>
          <text x="5" y="70" fill="var(--text3)" font-size="8" font-family="var(--font-mono)">${halfInWeek}</text>
          <text x="5" y="113" fill="var(--text3)" font-size="8" font-family="var(--font-mono)">0</text>

          ${barsHTML}
        </svg>
        <div style="display: flex; gap: 14px; align-items: center; justify-content: center; font-size: var(--fs-2xs); color: var(--text3); margin-top: 4px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 2px; background: var(--success);"></span>
            <span>Acertos</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 2px; background: var(--primary); opacity: 0.5;"></span>
            <span>Total revisado</span>
          </div>
        </div>
      </div>
    </div>`

  const trendCard = `
    <div class="dash-card">
      <div class="dash-card-h"><div><div class="dash-eyebrow">Desempenho</div><h3>Taxa de acerto</h3></div><span class="dash-metaval">últimos 14 dias</span></div>
      <div class="dash-trend-row">
        <div class="dash-trend-num"><div class="v">${trend.avg != null ? trend.avg + '%' : '—'}</div><div class="l">média do período</div></div>
        ${trend.hasData
          ? `<svg class="dash-trend-svg" viewBox="0 0 300 52" preserveAspectRatio="none"><polyline points="${trend.svgPoints}" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<p style="color:var(--text3);font-size:var(--fs-md)">Estude alguns dias para ver a tendência aqui.</p>`}
      </div>
    </div>`

  const langsCard = `
    <div class="dash-card">
      <div class="dash-card-h"><div><div class="dash-eyebrow">Idiomas</div><h3>Progresso por baralho</h3></div></div>
      ${langs.length ? `<div class="dash-lang-rows">${langs.map(lg => `
        <div class="dash-lang-row"><div class="lr-top"><strong>${esc(lg.name)}</strong><span>${lg.total} card${lg.total!==1?'s':''}</span></div>
        <div class="dash-lr-bar"><span class="b-new" style="width:${lg.newPct}"></span><span class="b-learn" style="width:${lg.learnPct}"></span><span class="b-review" style="width:${lg.revPct}"></span></div></div>
      `).join('')}</div>` : `<p style="color:var(--text3);font-size:var(--fs-md)">Nenhum card em estudo ainda.</p>`}
    </div>`

  const leechCard = leeches.length ? `
    <div class="dash-card dash-leech-card">
      <div class="dash-card-h"><div><div class="dash-eyebrow">Atenção</div><h3>Travando na memória</h3></div></div>
      <div class="dash-leech-list">${leeches.map(w => `<span class="dash-leech-chip">${ic('alert','ic-sm')}${esc(w.word)}</span>`).join('')}</div>
    </div>` : ''

  const wodCard = wod ? `
    <div class="dash-card">
      <div class="dash-wod-badge">Palavra em destaque</div>
      <div class="dash-wod-word">${esc(wod.word)}</div>
      <div class="dash-wod-meaning">${esc(wod.meaning_pt)}</div>
      ${wod.origin_pt ? `<div class="dash-wod-origin">${esc(wod.origin_pt)}</div>` : ''}
    </div>` : `
    <div class="dash-card">
      <div class="dash-wod-badge">Palavra em destaque</div>
      <p style="color:var(--text3);font-size:var(--fs-md);margin-top:6px">Salve palavras para estudo para ver uma em destaque aqui.</p>
    </div>`

  const sourcesCard = `
    <div class="dash-card">
      <div class="dash-card-h"><div><div class="dash-eyebrow">Fontes</div><h3>De onde vem seu vocabulário</h3></div></div>
      ${sources.length ? `<div class="dash-src-list">${sources.map(s => `
        <div class="dash-src-row"><div class="dash-src-icon">${srcIcon(s.type)}</div>
          <div class="dash-src-body"><div class="dash-src-top"><span class="name">${esc(s.name)}</span><span class="count">${s.count} palavra${s.count!==1?'s':''}</span></div>
          <div class="dash-src-bar"><span style="width:${s.pct}"></span></div></div></div>
      `).join('')}</div>` : `<p style="color:var(--text3);font-size:var(--fs-md)">Nenhuma palavra capturada ainda.</p>`}
    </div>`

  // Os blocos são agrupados pela PERGUNTA que respondem, não por tipo de gráfico:
  //   Progresso   = "como estou indo ao longo do tempo?"
  //   Vocabulário = "o que eu tenho e de onde veio?"
  if (_dashTab === 'progresso') {
    // Distribuição medida, não estética: com [calendário + volume] à esquerda
    // e só a taxa de acerto à direita, a coluna da direita terminava 653px
    // antes da outra — o vão que dava a impressão de espaço desperdiçado.
    // Com a taxa de acerto (cartão baixo) junto do calendário, as colunas
    // fecham com 59px de diferença.
    el('dpanel-progresso').innerHTML = `
      <div class="dash-grid">
        <div class="dash-col">${heatmapCard}${trendCard}</div>
        <div class="dash-col">${weeklyReviewsCard}</div>
      </div>`
    // Só agora o container tem largura de verdade: confere se o histórico
    // renderizado é mesmo o que cabe (ver dashHmAjustar).
    dashHmAjustar()
  } else if (_dashTab === 'vocabulario') {
    el('dpanel-vocabulario').innerHTML = `
      <div class="dash-grid">
        <div class="dash-col">${langsCard}${sourcesCard}${leechCard}</div>
        <div class="dash-col">${wodCard}${dashRecentCard()}</div>
      </div>`
  }
}

// A grade se adapta à largura. Se o número de semanas que cabe mudou (janela
// redimensionada, celular girado), redesenha — sem isso a densidade fica
// errada, ainda que a barra de rolagem não volte.
window.addEventListener('resize', () => {
  clearTimeout(_hmResizeTimer)
  _hmResizeTimer = setTimeout(() => {
    const painel = el('dpanel-progresso')
    if (!painel || painel.hidden || _dashTab !== 'progresso') return
    if (dashHmSemanas() === _hmSemanasAtual) return
    renderDashboardGrid()
  }, 220)
})

// Chips de palavras recentes — vira um cartão do painel de Vocabulário,
// em vez de uma faixa solta no fim da página.
function dashRecentCard() {
  if (!words.length) {
    return `<div class="dash-card">
      <div class="dash-card-h"><div><div class="dash-eyebrow">Entradas</div><h3>Adicionadas recentemente</h3></div></div>
      <p style="color:var(--text3);font-size:var(--fs-md);margin:0">Nenhuma palavra capturada ainda.</p>
    </div>`
  }
  const recent = [...words].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 24)
  return `<div class="dash-card">
    <div class="dash-card-h">
      <div><div class="dash-eyebrow">Entradas</div><h3>Adicionadas recentemente</h3></div>
      <span class="dash-metaval">${words.length} no total</span>
    </div>
    <div class="dash-recent-chips">
      ${recent.map(w => `<span class="dash-recent-chip" data-id="${escA(w.id)}" onclick="irParaItem(this.dataset.id)" style="cursor:pointer"
        title="${escA(w.context || '')}">${esc(w.word || '(frase)')}</span>`).join('')}
      <span class="dash-recent-chip" style="color:var(--text3);cursor:pointer" onclick="showSection('adicionar')">+ adicionar</span>
    </div>
  </div>`
}

// ================================================================
// ABAS DO DASHBOARD
// Só o painel ativo é renderizado — os gráficos são SVG montado em string,
// não vale construir três telas para esconder duas. A aba escolhida
// persiste em el-ui-prefs, então voltar ao painel devolve onde você estava.
// ================================================================

function setDashTab(tab, foco) {
  if (!DASH_TABS.includes(tab)) tab = 'progresso'
  _dashTab = tab
  if (typeof saveUiPref === 'function') saveUiPref('dashTab', tab)

  DASH_TABS.forEach(t => {
    const btn = el('dtab-' + (t === 'vocabulario' ? 'vocabulario' : t))
    const painel = el('dpanel-' + t)
    const ativo = t === tab
    if (btn) {
      btn.classList.toggle('active', ativo)
      btn.setAttribute('aria-selected', ativo ? 'true' : 'false')
      btn.tabIndex = ativo ? 0 : -1
      if (ativo && foco) btn.focus()
    }
    if (painel) painel.hidden = !ativo
  })

  if (tab === 'conquistas') renderDashboardAchievements()
  else renderDashboardGrid()
}

// Setas ←/→ percorrem as abas (padrão de tablist acessível)
function _dashTabKeys(e) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
  const i = DASH_TABS.indexOf(_dashTab)
  let novo = i
  if (e.key === 'ArrowLeft')  novo = (i - 1 + DASH_TABS.length) % DASH_TABS.length
  if (e.key === 'ArrowRight') novo = (i + 1) % DASH_TABS.length
  if (e.key === 'Home') novo = 0
  if (e.key === 'End')  novo = DASH_TABS.length - 1
  if (novo === i) return
  e.preventDefault()
  setDashTab(DASH_TABS[novo], true)
}

// Sinais nas próprias abas: a aba avisa se tem algo esperando lá dentro.
function updateDashTabSignals() {
  const conq = el('dtab-conq-count')
  if (conq) {
    const a = dashAchievements()
    conq.textContent = `${a.filter(x => x.unlocked).length}/${a.length}`
  }
  const flag = el('dtab-vocab-flag')
  if (flag) {
    const leeches = srsCards.filter(c => c.leech).length
    flag.textContent = leeches
    flag.title = `${leeches} card${leeches !== 1 ? 's' : ''} travando na memória`
    flag.classList.toggle('hidden', leeches === 0)
  }
}

function renderDashboardAchievements() {
  const area = el('dpanel-conquistas')
  if (!area) return
  const achievements = dashAchievements()
  const unlockedCount = achievements.filter(a => a.unlocked).length
  area.innerHTML = `
    <div class="dash-card">
      <div class="dash-card-h"><div><div class="dash-eyebrow">Conquistas</div><h3>${unlockedCount} de ${achievements.length} marcos desbloqueados</h3></div></div>
      <div class="dash-badge-grid">${achievements.map(a => `
        <div class="dash-badge ${a.unlocked ? '' : 'locked'}">
          <div class="dash-badge-icon">${ic(a.icon)}</div>
          <div class="dash-badge-title">${esc(a.title)}</div>
          <div class="dash-badge-desc">${esc(a.desc)}</div>
        </div>
      `).join('')}</div>
    </div>`
}

function statusLabel(s) {
  return { pending_ai:'Pendente IA', pending_review:'Pronta para enviar', in_study:'No estudo', in_srs:'Na revisão', skipped:'Pulada' }[s] || s
}


// ================================================================
// WORD CREATION
// ================================================================
function createWord(data) {
  const w = {
    id: uid(),
    word: (data.word || '').trim(),
    context: (data.context || '').trim(),
    // A tradução da frase vinha sendo DESCARTADA aqui: o Kindle e a Mídia já
    // mandavam `context_pt` e ele morria no caminho, então a frase chegava ao
    // Preparar sempre sem tradução — e o app pagava de novo para traduzi-la.
    context_pt: (data.context_pt || '').trim(),
    source_type: data.source_type || 'manual',
    source_title: data.source_title || '',
    source_context: (data.source_context || '').trim(),
    lang: (data.lang || (typeof activeLang === 'function' ? activeLang() : 'en')),
    status: 'pending_ai',
    meanings: [],
    ai_processed: false,
    created_at: new Date().toISOString()
  }
  words.unshift(w)
  saveWords()
  // Frase multi-palavra entrando na revisão: a triagem leve (raio-X) roda em
  // segundo plano JÁ — quando o card for aberto, os chips estão prontos.
  // `no_break` desliga isso para quem já nasce sabendo o que é: a expressão
  // separada de um sentido ("fall in love") vai direto para a análise completa,
  // e triá-la em partes seria pagar uma chamada para desmontar o que acabamos
  // de montar.
  if (typeof _revBreakPrefetch === 'function' && !data.no_break) _revBreakPrefetch(w)
  return w
}


// ================================================================
// QUICK ADD
// ================================================================

