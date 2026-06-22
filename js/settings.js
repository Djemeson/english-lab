// ================================================================
// SETTINGS
// ================================================================
function fillSettings() {
  el('cfg-ai-provider').value = cfg.aiProvider || 'openai'
  updateModelOptions(false)
  el('cfg-ai-model').value = cfg.aiModel || AI_MODELS[cfg.aiProvider || 'openai'][0]?.value || ''
  el('cfg-tts-provider').value = cfg.ttsProvider || 'openai'
  el('cfg-openai-key').value = cfg.openaiKey || ''
  el('cfg-n8n').value = cfg.n8nBase || ''
  renderThemePicker()
  // Atualiza UI Firebase com estado atual
  if (_fbUser !== undefined) updateFirebaseUI(_fbUser)
}

function saveSettings() {
  cfg.aiProvider = el('cfg-ai-provider').value
  cfg.aiModel = el('cfg-ai-model').value
  cfg.ttsProvider = el('cfg-tts-provider').value
  cfg.openaiKey = el('cfg-openai-key').value.trim()
  cfg.n8nBase = el('cfg-n8n').value.trim()
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

async function testN8nAI() {
  // Testa a conexão com o n8n para extração de websites
  const base = el('cfg-n8n').value.trim()
  if (!base) { toast('Configure a URL do n8n primeiro', 'error'); return }
  try {
    const res = await fetch(`${base}/webhook/en-site`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', test: true })
    })
    // Qualquer resposta (mesmo erro de parse) confirma que o webhook está ativo
    toast(res.ok ? 'n8n conectado!' : `n8n respondeu (status ${res.status})`, res.ok ? 'success' : 'warning')
  } catch(e) { toast(`Não foi possível conectar ao n8n: ${e.message}`, 'error') }
}

// ================================================================
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
      statusEl.innerHTML = `<span style="color:var(--success)">✅ Todos os ${texts.length} cards têm áudio.</span>`
    } else {
      statusEl.innerHTML = `<span style="color:var(--warning)">⚠️ ${missing.length} de ${texts.length} cards sem áudio.</span>`
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
  if (!confirm('⚠️ Apagar TODOS os dados?\n\nIsso inclui:\n• Palavras e revisões\n• Cards SRS e progresso\n• Áudios gerados\n• Imagens geradas\n• Configurações\n\nFaça um backup antes.')) return
  if (!confirm('Confirma? Esta ação é IRREVERSÍVEL.')) return

  // localStorage
  Object.values(SK).forEach(k => localStorage.removeItem(k))
  localStorage.removeItem('el-kindle-seen')
  localStorage.removeItem(SK.kindleQueue)
  localStorage.removeItem('englab_cfg')

  // IndexedDB — áudio e imagens
  try { await AudioDB.setAll({}) } catch {}
  try { await ImageDB.setAll({}) } catch {}
  try { await CardsDB.clear() } catch {}
  try { await SettingsDB.set('cfg', {}) } catch {}

  // Reset state
  words = []; srsCards = []; srsLog = []; srsDecks = []
  cfg = { ...DEF_CFG }
  srsCfg = { ...SRS_DEF_CFG }
  _audioKeyCache = null; _imageKeyCache = null

  renderDashboard()
  fillSettings()
  updateSrsBadge()
  toast('✅ Todos os dados apagados. Começando do zero.', 'success')
  setTimeout(() => showSection('dashboard'), 800)
  // Sign out Firebase se estiver logado
  if (_fbAuth && _fbUser) _fbAuth.signOut().catch(() => {})
}

