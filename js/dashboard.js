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

  // ── Ação principal ──
  const mainArea = el('dash-main-action')
  if (mainArea) {
    if (paraHoje > 0) {
      mainArea.innerHTML = `
        <div class="dash-action-card">
          ${streak > 0 ? `<div class="dash-hero-streak-row"><span class="dash-hero-streak">${ic('flame','ic-sm')}${streak} dia${streak!==1?'s':''} de sequência</span></div>` : ''}
          <div class="dash-action-left">
            <div class="dash-num">${paraHoje}</div>
            <div class="dash-sub">${dueToday} revisão${dueToday!==1?'ões':''} · ${newToday} novo${newToday!==1?'s':''} disponív${newToday!==1?'eis':'el'} hoje</div>
          </div>
          <button class="btn btn-primary" onclick="showSection('estudar')">Estudar agora ${ic('arrowRight')}</button>
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
        <span>${pendingAI > 0 ? pendingAI + ' palavra' + (pendingAI!==1?'s':'') + ' aguardando IA' : ''}${pendingAI>0&&pendingRev>0?' · ':''}${pendingRev > 0 ? pendingRev + ' pronta' + (pendingRev!==1?'s':'') + ' para revisar' : ''}</span>
        <button class="btn btn-ghost btn-sm" onclick="showSection('revisar')">${pendingAI > 0 ? ic('sparkles')+'Ir para revisão' : ic('eye')+'Revisar agora'}</button>
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

  // ── Recentes (chips) ──
  const recentArea = el('dash-recent-area')
  if (recentArea && words.length > 0) {
    const recent = [...words].sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).slice(0,20)
    recentArea.innerHTML = `
      <div style="font-size:0.78rem;color:var(--text3);margin-bottom:8px">Adicionadas recentemente</div>
      <div class="dash-recent-chips">
        ${recent.map(w => `<span class="dash-recent-chip" onclick="showSection('revisar')" style="cursor:pointer" title="${esc(w.context||'')}">${esc(w.word||'(frase)')}</span>`).join('')}
        <span class="dash-recent-chip" style="color:var(--text3);cursor:pointer" onclick="showSection('adicionar')">+ adicionar</span>
      </div>`
  } else if (recentArea) {
    recentArea.innerHTML = `<div class="empty-state" style="margin-top:20px">${ic('bookOpen','ic-xl')}<p>Nenhuma palavra ainda.</p><button class="btn btn-primary mt-4" onclick="showSection('adicionar')" style="margin-top:12px">${ic('plus')}Adicionar palavras</button></div>`
  }

  renderDashboardGrid()
  renderDashboardAchievements()
}

// ================================================================
// DASHBOARD — dados das seções extras (atividade, tendência, idiomas,
// leeches, palavra do dia, fontes, conquistas). Tudo derivado de
// srsLog/srsCards/words já em memória — sem estado novo persistido.
// ================================================================

function _dateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

// Grade de atividade (estilo GitHub): últimos 371 dias, alinhados p/ começar num domingo.
function dashHeatCells() {
  const byDate = {}
  srsLog.forEach(l => { byDate[l.date] = l.reviewed || 0 })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const totalDays = 371
  const start = new Date(today); start.setDate(start.getDate() - (totalDays - 1))
  const cells = []
  for (let i = 0; i < start.getDay(); i++) cells.push({ cls: 'dash-hm-pad' })
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i)
    const ds = _dateStr(d)
    const n = byDate[ds] || 0
    const cls = n === 0 ? '' : n <= 5 ? 'l1' : n <= 15 ? 'l2' : n <= 30 ? 'l3' : 'l4'
    cells.push({ cls, tip: `${d.toLocaleDateString('pt-BR')} — ${n} revis${n===1?'ão':'ões'}` })
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

function renderDashboardGrid() {
  const area = el('dash-grid-area')
  if (!area) return

  const heatCells = dashHeatCells()
  const totalMonthReviews = srsLog.filter(l => {
    const d = new Date(l.date); const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, l) => s + (l.reviewed || 0), 0)

  const trend = dashAccuracyTrend(14)
  const langs = dashLangRows()
  const leeches = dashLeeches()
  const wod = dashWordOfDay()
  const sources = dashSources()

  const heatmapCard = `
    <div class="dash-card">
      <div class="dash-card-h"><div><div class="dash-eyebrow">Atividade</div><h3>Últimos 12 meses</h3></div><span class="dash-metaval">${totalMonthReviews} revis${totalMonthReviews===1?'ão':'ões'} este mês</span></div>
      <div class="dash-hm-wrap"><div class="dash-hm-grid">${heatCells.map(c => `<div class="dash-hm-cell ${c.cls}" ${c.tip ? `title="${escA(c.tip)}"` : ''}></div>`).join('')}</div></div>
      <div class="dash-hm-legend"><span>Menos</span><div class="dash-hm-cell"></div><div class="dash-hm-cell l1"></div><div class="dash-hm-cell l2"></div><div class="dash-hm-cell l3"></div><div class="dash-hm-cell l4"></div><span>Mais</span></div>
    </div>`

  const trendCard = `
    <div class="dash-card">
      <div class="dash-card-h"><div><div class="dash-eyebrow">Desempenho</div><h3>Taxa de acerto</h3></div><span class="dash-metaval">últimos 14 dias</span></div>
      <div class="dash-trend-row">
        <div class="dash-trend-num"><div class="v">${trend.avg != null ? trend.avg + '%' : '—'}</div><div class="l">média do período</div></div>
        ${trend.hasData
          ? `<svg class="dash-trend-svg" viewBox="0 0 300 52" preserveAspectRatio="none"><polyline points="${trend.svgPoints}" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<p style="color:var(--text3);font-size:0.85rem">Estude alguns dias para ver a tendência aqui.</p>`}
      </div>
    </div>`

  const langsCard = `
    <div class="dash-card">
      <div class="dash-card-h"><div><div class="dash-eyebrow">Idiomas</div><h3>Progresso por baralho</h3></div></div>
      ${langs.length ? `<div class="dash-lang-rows">${langs.map(lg => `
        <div class="dash-lang-row"><div class="lr-top"><strong>${esc(lg.name)}</strong><span>${lg.total} card${lg.total!==1?'s':''}</span></div>
        <div class="dash-lr-bar"><span class="b-new" style="width:${lg.newPct}"></span><span class="b-learn" style="width:${lg.learnPct}"></span><span class="b-review" style="width:${lg.revPct}"></span></div></div>
      `).join('')}</div>` : `<p style="color:var(--text3);font-size:0.85rem">Nenhum card em estudo ainda.</p>`}
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
      <p style="color:var(--text3);font-size:0.85rem;margin-top:6px">Salve palavras para estudo para ver uma em destaque aqui.</p>
    </div>`

  const sourcesCard = `
    <div class="dash-card">
      <div class="dash-card-h"><div><div class="dash-eyebrow">Fontes</div><h3>De onde vem seu vocabulário</h3></div></div>
      ${sources.length ? `<div class="dash-src-list">${sources.map(s => `
        <div class="dash-src-row"><div class="dash-src-icon">${srcIcon(s.type)}</div>
          <div class="dash-src-body"><div class="dash-src-top"><span class="name">${esc(s.name)}</span><span class="count">${s.count} palavra${s.count!==1?'s':''}</span></div>
          <div class="dash-src-bar"><span style="width:${s.pct}"></span></div></div></div>
      `).join('')}</div>` : `<p style="color:var(--text3);font-size:0.85rem">Nenhuma palavra capturada ainda.</p>`}
    </div>`

  area.innerHTML = `
    <div class="dash-grid">
      <div class="dash-col">${heatmapCard}${trendCard}${langsCard}${leechCard}</div>
      <div class="dash-col">${wodCard}${sourcesCard}</div>
    </div>`
}

function renderDashboardAchievements() {
  const area = el('dash-achv-area')
  if (!area) return
  const achievements = dashAchievements()
  const unlockedCount = achievements.filter(a => a.unlocked).length
  area.innerHTML = `
    <div class="dash-card" style="margin-top:20px">
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
  return { pending_ai:'⏳ Pendente IA', pending_review:'👁 Revisar', in_srs:'📚 Em estudo', skipped:'– Pulada' }[s] || s
}


// ================================================================
// WORD CREATION
// ================================================================
function createWord(data) {
  const w = {
    id: uid(),
    word: (data.word || '').trim(),
    context: (data.context || '').trim(),
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
  return w
}


// ================================================================
// QUICK ADD
// ================================================================
function quickAdd() {
  const word = el('q-word').value.trim()
  const ctx = el('q-ctx').value.trim()
  if (!word && !ctx) { toast('Digite ao menos uma palavra ou frase', 'warning'); return }
  createWord({ word, context: ctx, source_type: 'manual' })
  el('q-word').value = ''
  el('q-ctx').value = ''
  renderDashboard()
  toast(`Adicionado! Vá em Revisar para analisar com IA.`, 'success')
}

