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
          <div class="dash-action-left">
            <div class="dash-num">${paraHoje}</div>
            <div class="dash-sub">${dueToday} ${dueToday!==1?'revisões':'revisão'} · ${newToday} novo${newToday!==1?'s':''} disponív${newToday!==1?'eis':'el'} hoje</div>
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

