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
const AI_MODELS = [
  { value: 'gpt-4o-mini',  label: 'GPT-4o mini — rápido e barato (padrão)' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini — melhor texto, preço próximo' },
  { value: 'gpt-4o',       label: 'GPT-4o — equilibrado' },
  { value: 'gpt-5-mini',   label: 'GPT-5 mini — nova geração' },
  { value: 'gpt-5',        label: 'GPT-5 — mais capaz (mais caro)' },
]

function updateModelOptions() {
  const sel = el('cfg-ai-model'); if (!sel) return
  const atual = aiModel()
  sel.innerHTML = AI_MODELS.map(m =>
    `<option value="${m.value}"${m.value === atual ? ' selected' : ''}>${m.label}</option>`).join('')
}


function fillSettings() {
  el('cfg-openai-key').value = cfg.openaiKey || ''
  updateModelOptions()
  setSettingsTab(_settingsTab)
  renderThemePicker()
  // Atualiza UI Firebase com estado atual
  if (_fbUser !== undefined) updateFirebaseUI(_fbUser)
}


function saveSettings() {
  cfg.aiProvider = 'openai'
  cfg.aiModel = el('cfg-ai-model')?.value || AI_DEFAULT_MODEL
  cfg.ttsProvider = 'openai'
  cfg.openaiKey = el('cfg-openai-key').value.trim()
  saveCfg()
  // Envia para a nuvem (se logado) para sobreviver a refresh e sincronizar entre dispositivos
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
  const blob = new Blob([JSON.stringify({ words, cfg, exported_at: new Date().toISOString() }, null, 2)], { type:'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `english-lab-${new Date().toISOString().slice(0,10)}.json`
  a.click(); toast('Backup exportado!', 'success')
}

function importData(input) {
  const file = input.files[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const d = JSON.parse(e.target.result)
      if (d.words) {
        if (!confirm(`Importar ${d.words.length} palavras (mescla com dados existentes)?`)) return
        const ids = new Set(words.map(w => w.id))
        words = [...words, ...d.words.filter(w => !ids.has(w.id))]
        saveWords(); renderDashboard()
        toast(`${d.words.length} palavras importadas!`, 'success')
      }
    } catch { toast('Arquivo JSON inválido', 'error') }
  }
  reader.readAsText(file); input.value = ''
}

function clearKindleSeen() {
  if (!confirm('Resetar histórico do Kindle?\nOs destaques já adicionados voltarão a aparecer na próxima importação.')) return
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
  await preGenerateAudio(missing.map(t => ({ example_en: t })))
  if (btn) btn.disabled = false
  checkMissingAudio()
}

async function clearAllData() {
  const loggedIn = !!(typeof _fbUser !== 'undefined' && _fbUser)
  const cloudWarn = loggedIn ? '\n• TUDO na nuvem (Firebase) também será apagado' : ''
  if (!confirm('Apagar TODOS os dados?\n\nIsso inclui:\n• Palavras e revisões\n• Cards SRS e progresso\n• Áudios gerados\n• Imagens geradas\n• Configurações' + cloudWarn + '\n\nFaça um backup antes.')) return
  if (!confirm('Confirma? Esta ação é IRREVERSÍVEL.')) return

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
async function testOpenAIKeyUI(btn) {
  const st = el('cfg-key-status')
  const key = el('cfg-openai-key').value.trim()
  if (!key) { if (st) st.textContent = 'Cole a chave primeiro.'; return }
  btn.disabled = true
  if (st) { st.style.color = 'var(--text2)'; st.textContent = 'Testando...' }
  const r = await aiTestKey(key)
  btn.disabled = false
  if (!st) return
  if (r.ok) { st.style.color = 'var(--success)'; st.textContent = 'Chave válida.' }
  else { st.style.color = 'var(--error)'; st.textContent = 'Falhou: ' + r.msg }
}
