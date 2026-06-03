// ================================================================
// SETTINGS
// ================================================================
function fillSettings() {
  el('cfg-ai-provider').value = cfg.aiProvider || 'openai'
  updateModelOptions(false)
  el('cfg-ai-model').value = cfg.aiModel || AI_MODELS[cfg.aiProvider || 'openai'][0]?.value || ''
  el('cfg-tts-provider').value = cfg.ttsProvider || 'openai'
  el('cfg-openai-key').value = cfg.openaiKey || ''
  el('cfg-anki-url').value = cfg.ankiUrl || 'http://localhost:8765'
  el('cfg-anki-deck').value = cfg.ankiDeck || 'Inglês'
  el('cfg-anki-model').value = cfg.ankiModel || 'Inglês Básico'
  loadAnkiDropdowns()
  el('cfg-n8n').value = cfg.n8nBase || ''
  el('cfg-f-word').value = cfg.fields?.word || 'Frente'
  el('cfg-f-meaning').value = cfg.fields?.meaning || 'Verso'
  el('cfg-f-context').value = cfg.fields?.context || 'Contexto'
  el('cfg-f-ipa').value = cfg.fields?.ipa || 'IPA'
  el('cfg-f-examples').value = cfg.fields?.examples || 'Exemplos'
  el('cfg-f-audio').value = cfg.fields?.audio || 'Áudio'
  // Atualiza UI Firebase com estado atual
  if (_fbUser !== undefined) updateFirebaseUI(_fbUser)
}

function saveSettings() {
  cfg.aiProvider = el('cfg-ai-provider').value
  cfg.aiModel = el('cfg-ai-model').value
  cfg.ttsProvider = el('cfg-tts-provider').value
  cfg.openaiKey = el('cfg-openai-key').value.trim()
  cfg.ankiUrl = el('cfg-anki-url').value.trim()
  const _ds = el('cfg-anki-deck-sel'), _ms = el('cfg-anki-model-sel')
  cfg.ankiDeck  = (_ds && _ds.style.display !== 'none' ? _ds.value  : el('cfg-anki-deck').value).trim()
  cfg.ankiModel = (_ms && _ms.style.display !== 'none' ? _ms.value : el('cfg-anki-model').value).trim()
  cfg.n8nBase = el('cfg-n8n').value.trim()
  // Firebase — sem campos de token para salvar
  cfg.fields = {
    word: el('cfg-f-word').value.trim() || 'Frente',
    meaning: el('cfg-f-meaning').value.trim() || 'Verso',
    context: el('cfg-f-context').value.trim() || 'Contexto',
    ipa: el('cfg-f-ipa').value.trim() || 'IPA',
    examples: el('cfg-f-examples').value.trim() || 'Exemplos',
    audio: el('cfg-f-audio').value.trim() || 'Áudio'
  }
  saveCfg()
  toast('Configurações salvas!', 'success')
}

async function testN8nAI() {
  const base = el('cfg-n8n').value.trim()
  if (!base) { toast('Configure a URL do n8n primeiro', 'error'); return }
  showTestResult('n8n-ai', null, 'Testando...')
  try {
    const res = await fetch(`${base}/webhook/en-processar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: 'test', context: 'This is a test.', ai_provider: el('cfg-ai-provider').value, tts_provider: 'none' })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    showTestResult('n8n-ai', true, `Conectado! Provider: ${data.ai_provider || el('cfg-ai-provider').value}`)
  } catch(e) { showTestResult('n8n-ai', false, `Erro: ${e.message}`) }
}

async function loadAnkiDropdowns() {
  try {
    const [decks, models] = await Promise.all([ callAnki('deckNames'), callAnki('modelNames') ])
    const ds = el('cfg-anki-deck-sel'), di = el('cfg-anki-deck')
    const ms = el('cfg-anki-model-sel'), mi = el('cfg-anki-model')
    if (ds && decks) {
      const cur = cfg.ankiDeck || ''
      ds.innerHTML = decks.sort().map(d => `<option value="${esc(d)}"${d===cur?' selected':''}>${esc(d)}</option>`).join('')
      ds.style.display = ''; di.style.display = 'none'
    }
    if (ms && models) {
      const cur = cfg.ankiModel || ''
      ms.innerHTML = models.sort().map(m => `<option value="${esc(m)}"${m===cur?' selected':''}>${esc(m)}</option>`).join('')
      ms.style.display = ''; mi.style.display = 'none'
    }
  } catch {
    // Anki offline — show text inputs
    const ds = el('cfg-anki-deck-sel'), di = el('cfg-anki-deck')
    const ms = el('cfg-anki-model-sel'), mi = el('cfg-anki-model')
    if (ds) ds.style.display = 'none'; if (di) di.style.display = ''
    if (ms) ms.style.display = 'none'; if (mi) mi.style.display = ''
  }
}

async function testAnki() {
  showTestResult('anki', null, 'Testando...')
  try {
    const v = await callAnki('version')
    showTestResult('anki', true, `AnkiConnect v${v} — conectado!`)
    updateAnkiNav(true)
    // Verifica se o deck existe
    const decks = await callAnki('deckNames').catch(() => [])
    const deck = cfg.ankiDeck || 'Inglês'
    if (decks.length && !decks.includes(deck)) {
      showTestResult('anki', false, `Conectado, mas o deck "${deck}" não existe. Decks disponíveis: ${decks.slice(0,5).join(', ')}`)
    }
  } catch(e) {
    updateAnkiNav(false)
    const msg = e.message || ''
    let dica = ''
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_CONNECTION_REFUSED')) {
      dica = '❌ Não foi possível conectar. Verifique: (1) O Anki está aberto? (2) O plugin AnkiConnect está instalado? (instale pelo código 2055492159 em Ferramentas → Complementos → Instalar). (3) A URL está correta (padrão: http://localhost:8765)?'
    } else if (msg.includes('CORS') || msg.includes('cross-origin')) {
      dica = '❌ Erro de CORS. Nas configurações do AnkiConnect, adicione seu domínio à lista webCorsOriginList (ou use "*").'
    } else if (msg.toLowerCase().includes('not allowed') || msg.includes('403')) {
      dica = `❌ Acesso negado pelo AnkiConnect. Vá em Ferramentas → Complementos → AnkiConnect → Configuração e adicione "${location.origin}" em webCorsOriginList.`
    } else {
      dica = `❌ Erro: ${msg}. Verifique se o Anki está aberto e o AnkiConnect está ativo.`
    }
    showTestResult('anki', false, dica)
  }
}

function showTestResult(which, ok, msg) {
  const map = {
    'n8n-ai': ['n8n-ai-test-result', 'n8n-ai-dot', 'n8n-ai-msg'],
    'anki':   ['anki-test-result',   'anki-tdot',   'anki-tmsg']
  }
  const [resId, dotId, msgId] = map[which] || map['anki']
  const resultEl = el(resId), dotEl = el(dotId), msgEl = el(msgId)
  resultEl.classList.remove('hidden')
  dotEl.className = 'test-dot' + (ok === true ? ' ok' : ok === false ? ' err' : '')
  msgEl.textContent = msg
}

function updateAnkiNav(on) {
  el('anki-dot').className = 'anki-dot' + (on ? ' on' : '')
  el('anki-label').textContent = on ? 'Anki ✓' : 'Anki'
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

