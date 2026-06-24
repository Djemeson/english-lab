// ================================================================
// BOOTSTRAP
// ================================================================
async function initApp() {
  applyUiPrefs()     // estado recolhido da sidebar
  loadCfg()
  await restoreCfgFromBackup()  // repõe chave OpenAI / URL n8n / tema se o localStorage foi limpo
  applyTheme(cfg.theme)   // aplica o tema (já restaurado, se preciso)
  loadWords()
  loadConversas()    // conversas do Assistente
  loadSrs()          // loads srsCfg, srsLog, decks
  await loadSrsAsync() // loads srsCards from IDB (migrates if needed)
  renderDashboard()
  updateSrsBadge()
  initFirebase()
}
// Kick off when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp)
} else {
  initApp()
}


// Atualiza metadado de um card (variety ou register) e propaga para irmãos
function updateCardMeta(cardId, field, value) {
  const card = srsCards.find(c => c.id === cardId)
  if (!card) return
  card[field] = value
  // Propaga para todos os cards do mesmo significado (mesmo wordId+meaningIdx)
  srsCards.forEach(c => {
    if (c.wordId === card.wordId && c.meaningIdx === card.meaningIdx) {
      c[field] = value
    }
  })
  saveSrsCards()
  autoSyncAfterChange()
  // Atualiza a exibição sem fechar o card
  renderSrsCardBack()
  toast(`${field === 'variety' ? 'Variedade' : 'Registro'} atualizado em ${srsCards.filter(c=>c.wordId===card.wordId&&c.meaningIdx===card.meaningIdx).length} card(s)`, 'success')
}

// ── Service Worker ──────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/english-lab/sw.js', { scope: '/english-lab/' })
    .then(r => console.log('[SW] registrado, scope:', r.scope))
    .catch(e => console.warn('[SW] falha ao registrar:', e))
}
