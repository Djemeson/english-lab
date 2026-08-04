// ================================================================
// ABAS DAS CONFIGURAÇÕES — estado
// Declarado no TOPO de propósito: fillSettings() usa _settingsTab e é
// chamada assim que a seção abre. Com o `let` no fim do arquivo, qualquer
// chamada antes daquela linha caía na zona morta temporal (TDZ) e
// derrubava a tela inteira de Configurações.
// ================================================================
const SETTINGS_TABS = ['conta', 'ia', 'aparencia', 'dados']
let _settingsTab = (typeof loadUiPrefs === 'function' && loadUiPrefs().settingsTab) || 'conta'

// ================================================================
// SETTINGS
// ================================================================
// Modelos de IA por provider (usado por fillSettings — fica aqui, arquivo não-lazy)
// Catálogo de modelos. SÓ OpenAI de propósito: todas as chamadas do app vão
// para api.openai.com — as entradas antigas de Anthropic/Google eram uma
// armadilha (selecionar uma mandaria "claude-*" para a API errada e
// quebraria TODA a IA do app).
function _tierLabel(t) { return t === 'baixo' ? 'custo baixo' : t === 'médio' ? 'custo médio' : 'custo alto' }

function updateModelOptions() {
  const sel = el('cfg-ai-model'); if (!sel) return
  const prov = el('cfg-ai-provider')?.value || aiProviderAtual()
  const P = AI_PROVIDERS[prov] || AI_PROVIDERS.openai
  const salvo = ((cfg.aiModelProv || {})[prov]) || (prov === 'openai' ? (cfg.aiModel || '') : '')
  const atual = P.modelos.some(m => m.id === salvo) ? salvo : P.modelos[0].id
  sel.innerHTML = P.modelos.map(m =>
    `<option value="${m.id}"${m.id === atual ? ' selected' : ''}>${m.id} — ${_tierLabel(m.tier)} · ${m.nota}</option>`).join('')
}
function providerMudou() { updateModelOptions() }

// Chaves organizadas: uma linha por fornecedor, com teste individual
function renderKeyRows() {
  const box = el('cfg-keys'); if (!box) return
  const olho = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
  box.innerHTML = `<div class="cfg-keys-title">Chaves de API — uma por fornecedor (só precisa das que for usar)</div>` +
    Object.entries(AI_PROVIDERS).map(([id, P]) => `
      <div class="cfg-key-row">
        <span class="cfg-key-nome">${P.nome}${id === 'openai' ? ' <i>· também áudio/imagens</i>' : ''}</span>
        <div class="cfg-key-campo">
          <input type="password" id="cfg-key-${id}" placeholder="${P.placeholder}" autocomplete="off">
          <button type="button" class="cfg-key-eye" onclick="togglePasswordVisibility('cfg-key-${id}')" aria-label="Mostrar/ocultar">${olho}</button>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="testarChaveProv('${id}', this)">Testar</button>
        <span class="cfg-key-status" id="cfg-key-status-${id}"></span>
      </div>`).join('')
  for (const [id, P] of Object.entries(AI_PROVIDERS)) {
    const i = el('cfg-key-' + id); if (i) i.value = cfg[P.keyCfg] || ''
  }
}

async function testarChaveProv(prov, btn) {
  const key = el('cfg-key-' + prov)?.value.trim()
  const st = el('cfg-key-status-' + prov)
  if (!key) { if (st) { st.textContent = 'sem chave'; st.style.color = 'var(--text3)' } ; return }
  btn.disabled = true
  if (st) { st.textContent = 'testando...'; st.style.color = 'var(--text3)' }
  const r = await aiTestKeyProv(prov, key)
  if (st) {
    st.textContent = r.ok ? 'válida' : (r.msg || 'inválida').slice(0, 60)
    st.style.color = r.ok ? 'var(--success)' : 'var(--error)'
  }
  btn.disabled = false
}

function fillSettings() {
  const provSel = el('cfg-ai-provider')
  if (provSel) {
    provSel.innerHTML = Object.entries(AI_PROVIDERS).map(([id, P]) =>
      `<option value="${id}"${id === aiProviderAtual() ? ' selected' : ''}>${P.nome}</option>`).join('')
  }
  updateModelOptions()
  renderKeyRows()
  const q = el('cfg-img-quality'); if (q) q.value = cfg.imgQuality || 'medium'
  const stt = el('cfg-stt-provider'); if (stt) stt.value = cfg.sttProvider || 'auto'
  setSettingsTab(_settingsTab)
  renderThemePicker()
  renderAccentPicker()
  if (_fbUser !== undefined) updateFirebaseUI(_fbUser)
}

function saveSettings() {
  const prov = el('cfg-ai-provider')?.value || 'openai'
  cfg.aiProvider = AI_PROVIDERS[prov] ? prov : 'openai'
  const modelo = el('cfg-ai-model')?.value || AI_DEFAULT_MODEL
  cfg.aiModelProv = { ...(cfg.aiModelProv || {}), [cfg.aiProvider]: modelo }
  if (cfg.aiProvider === 'openai') cfg.aiModel = modelo   // espelho legado (sync antigo)
  cfg.ttsProvider = 'openai'
  for (const [id, P] of Object.entries(AI_PROVIDERS)) {
    const i = el('cfg-key-' + id)
    if (i) cfg[P.keyCfg] = i.value.trim()
  }
  cfg.imgQuality = el('cfg-img-quality')?.value || 'medium'
  cfg.sttProvider = el('cfg-stt-provider')?.value || 'auto'
  saveCfg()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast('Configurações salvas!', 'success')
}


// ================================================================
// THEMES — seletor visual nas configurações
// ================================================================
function renderThemePicker() {
  const wrap = el('theme-picker')
  if (!wrap) return
  const current = cfg.theme || 'midnight'
  wrap.innerHTML = THEMES.map(t => `
    <button type="button" class="theme-swatch${t.id === current ? ' active' : ''}"
            data-theme-id="${t.id}" onclick="selectTheme('${t.id}')" title="${t.name}">
      <span class="theme-swatch-preview" style="background:${t.swatch[0]}">
        <span class="theme-swatch-accent" style="background:${t.swatch[1]}"></span>
      </span>
      <span class="theme-swatch-name">${t.name}</span>
    </button>`).join('')
}
// Acentos: fileira de bolinhas de cor abaixo dos temas. O acento vale por
// cima de qualquer tema e sincroniza entre aparelhos (cfg.accent).
function renderAccentPicker() {
  const area = el('accent-picker'); if (!area) return
  area.innerHTML = ACCENTS.map(a => {
    const ativo = (cfg.accent || '') === a.id
    const cor = a.id || null
    return `<button type="button" class="accent-dot${ativo ? ' active' : ''}" data-tip="${escA(a.name)}"
      aria-label="${escA(a.name)}" onclick="setAccent('${a.id}')"
      style="${cor ? 'background:' + cor : ''}">${cor ? '' : ic('x','ic-sm')}</button>`
  }).join('')
}

function setAccent(id) {
  cfg.accent = id || ''
  applyAccent(cfg.accent)
  saveCfg()
  renderAccentPicker()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}


function selectTheme(id) {
  applyTheme(id)        // aplica visualmente + grava em cfg.theme
  saveCfg()             // persiste local imediatamente
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  renderThemePicker()
  toast(`Tema "${THEMES.find(t => t.id === id)?.name || id}" aplicado`, 'success')
}

async // ================================================================
// DATA MANAGEMENT
// ================================================================
function exportData() {
  // Backup COMPLETO (2026-08-01): antes só words+cfg saíam — nem o agendamento
  // SRS entrava, então "restaurar do backup" perdia todo o progresso de estudo.
  // Áudio/imagens ficam de fora (são MBs e regeneráveis via TTS/IA).
  const payload = {
    words, cfg, srsCards, srsLog, srsDecks, srsCfg,
    conversas: (typeof conversas !== 'undefined') ? conversas : [],
    videos:    (typeof videos    !== 'undefined') ? videos    : [],
    clips:     (typeof clips     !== 'undefined') ? clips     : [],
    exported_at: new Date().toISOString()
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `english-lab-${new Date().toISOString().slice(0,10)}.json`
  a.click(); toast('Backup completo exportado (palavras, cards, progresso, config)', 'success')
}

function importData(input) {
  const file = input.files[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = async e => {
    try {
      const d = JSON.parse(e.target.result)
      if (d.words) {
        if (!(await confirmModal({ title: 'Importar backup', icon: 'upload', confirmText: 'Importar',
          html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Importar <b>${d.words.length} palavras</b>? Elas serão <b>mescladas</b> com os dados existentes — nada é apagado.</p>` }))) return
        const ids = new Set(words.map(w => w.id))
        words = [...words, ...d.words.filter(w => !ids.has(w.id))]
        saveWords(); renderDashboard()
        toast(`${d.words.length} palavras importadas!`, 'success')
      }
    } catch { toast('Arquivo JSON inválido', 'error') }
  }
  reader.readAsText(file); input.value = ''
}

async function clearKindleSeen() {
  if (!(await confirmModal({ title: 'Resetar histórico do Kindle', icon: 'refresh', confirmText: 'Resetar',
    html: '<p style="font-size:var(--fs-sm);color:var(--text2)">Os destaques já adicionados <b>voltarão a aparecer</b> na próxima importação. Nenhum card de estudo é afetado.</p>' }))) return
  localStorage.removeItem(SK.kindleSeen)
  toast('Histórico Kindle resetado. Próxima importação mostrará todos os destaques.', 'info')
}

async function checkMissingAudio() {
  const statusEl = el('audio-maint-status')
  const btn = el('btn-gen-missing-audio')
  if (statusEl) statusEl.textContent = 'Verificando...'
  await refreshAudioKeyCache()
  const texts = [...new Set(srsCards.map(c => c.example_en || c.word).filter(Boolean))]
  const missing = texts.filter(t => !_audioKeyCache?.has(audioKey(t)))
  if (statusEl) {
    if (missing.length === 0) {
      statusEl.innerHTML = `<span style="color:var(--success)">${ic('checkCircle','ic-sm')} Todos os ${texts.length} cards têm áudio.</span>`
    } else {
      statusEl.innerHTML = `<span style="color:var(--warning)">${ic('alert','ic-sm')} ${missing.length} de ${texts.length} cards sem áudio.</span>`
    }
  }
  if (btn) btn.style.display = missing.length > 0 ? 'inline-flex' : 'none'
}

async function generateMissingAudio() {
  if (!cfg.openaiKey) { toast('Configure a chave OpenAI primeiro', 'error'); return }
  const btn = el('btn-gen-missing-audio')
  if (btn) btn.disabled = true
  await refreshAudioKeyCache()
  const texts = [...new Set(srsCards.map(c => c.example_en || c.word).filter(Boolean))]
  const missing = texts.filter(t => !_audioKeyCache?.has(audioKey(t)))
  if (!missing.length) { toast('Todos os cards já têm áudio', 'info'); if (btn) btn.disabled = false; return }
  if (!(await aiConfirmBatch('tts', missing.length, 'Gerar áudio ausente'))) { if (btn) btn.disabled = false; return }
  await preGenerateAudio(missing.map(t => ({ example_en: t })))
  if (btn) btn.disabled = false
  checkMissingAudio()
}

async function clearAllData() {
  const loggedIn = !!(typeof _fbUser !== 'undefined' && _fbUser)
  const cloudWarn = loggedIn ? '\n• TUDO na nuvem (Firebase) também será apagado' : ''
  const itens = ['Palavras e revisões', 'Cards SRS e progresso de estudo', 'Áudios e imagens gerados', 'Configurações']
  if (loggedIn) itens.push('TUDO na nuvem (Firebase) — propaga para os outros aparelhos')
  if (!(await confirmModal({ title: 'Apagar todos os dados', icon: 'alert', danger: true, confirmText: 'Apagar tudo',
    html: `<ul class="cost-bullets danger">${itens.map(x => `<li>${x}</li>`).join('')}</ul>
      <p class="cost-note"><b>Esta ação é irreversível.</b> Faça um backup antes (Exportar JSON, logo acima).</p>` }))) return

  // 1) localStorage
  Object.values(SK).forEach(k => localStorage.removeItem(k))
  localStorage.removeItem('el-kindle-seen')
  localStorage.removeItem(SK.kindleQueue)
  localStorage.removeItem('englab_cfg')

  // 2) IndexedDB — áudio, imagens, cards e backup de configurações
  try { await AudioDB.setAll({}) } catch {}
  try { await ImageDB.setAll({}) } catch {}
  try { await CardsDB.clear() } catch {}
  try { await SettingsDB.set('cfg', {}) } catch {}

  // 3) Reset do estado em memória (decks voltam ao padrão)
  words = []; srsCards = []; srsLog = []
  srsDecks = (typeof DEFAULT_DECKS !== 'undefined') ? JSON.parse(JSON.stringify(DEFAULT_DECKS)) : []
  cfg = { ...DEF_CFG }
  srsCfg = { ...SRS_DEF_CFG }
  _audioKeyCache = null; _imageKeyCache = null
  if (typeof srsSession !== 'undefined') srsSession = null

  // 4) Zera a NUVEM continuando logado: grava listas vazias (propaga a exclusão
  //    em tempo real para todos os dispositivos) e apaga áudios/imagens da nuvem.
  if (loggedIn) {
    toast('Zerando a nuvem em todos os dispositivos...', 'info')
    if (typeof clearTimeout === 'function' && typeof _fbSyncTimer !== 'undefined') clearTimeout(_fbSyncTimer)
    try { if (typeof fbPushData === 'function') await fbPushData() } catch {}
    try { if (typeof fbWipeMedia === 'function') await fbWipeMedia() } catch {}
  }

  renderDashboard()
  fillSettings()
  updateSrsBadge()
  toast('Tudo zerado — local e nuvem, em todos os dispositivos.', 'success')
  setTimeout(() => showSection('dashboard'), 900)
}

function togglePasswordVisibility(id) {
  const input = el(id)
  if (!input) return
  if (input.type === 'password') {
    input.type = 'text'
  } else {
    input.type = 'password'
  }
}


// ================================================================
// ABAS DAS CONFIGURAÇÕES
// Mesmo componente visual do painel (.seg-tab*). Agrupa por INTENÇÃO:
// quem entra aqui quer resolver uma coisa — conectar a conta, colar a
// chave, trocar o tema ou mexer nos dados — não ler cinco cartões.
// ================================================================

function setSettingsTab(tab, foco) {
  if (!SETTINGS_TABS.includes(tab)) tab = 'conta'
  _settingsTab = tab
  if (typeof saveUiPref === 'function') saveUiPref('settingsTab', tab)
  SETTINGS_TABS.forEach(t => {
    const btn = el('stab-' + t), painel = el('spanel-' + t)
    const ativo = t === tab
    if (btn) {
      btn.classList.toggle('active', ativo)
      btn.setAttribute('aria-selected', ativo ? 'true' : 'false')
      btn.tabIndex = ativo ? 0 : -1
      if (ativo && foco) btn.focus()
    }
    if (painel) painel.hidden = !ativo
  })
}

function _settingsTabKeys(e) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
  const i = SETTINGS_TABS.indexOf(_settingsTab)
  let novo = i
  if (e.key === 'ArrowLeft')  novo = (i - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length
  if (e.key === 'ArrowRight') novo = (i + 1) % SETTINGS_TABS.length
  if (e.key === 'Home') novo = 0
  if (e.key === 'End')  novo = SETTINGS_TABS.length - 1
  if (novo === i) return
  e.preventDefault()
  setSettingsTab(SETTINGS_TABS[novo], true)
}

// Botão "Testar chave" — GET /v1/models não consome nenhum token.
// (testOpenAIKeyUI substituído por testarChaveProv — 35ª rodada)
