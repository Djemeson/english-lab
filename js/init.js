// ================================================================
// BOOTSTRAP
// ================================================================
async function initApp() {
  applyUiPrefs()     // estado recolhido da sidebar
  loadCfg()
  await restoreCfgFromBackup()  // repõe chave OpenAI / tema se o localStorage foi limpo
  applyTheme(cfg.theme)   // aplica o tema (já restaurado, se preciso)
  loadWords()
  loadConversas()    // conversas do Assistente
  loadSrs()          // loads srsCfg, srsLog, decks
  await loadSrsAsync() // loads srsCards from IDB (migrates if needed)
  migrateLangFields()  // multi-idioma: words/cards antigos ganham lang:'en' (aditivo)
  mountLangSelector('lang-selector-add')  // seletor de idioma ativo (Adicionar)
  mountLangSelector('lang-selector-asst') // seletor de idioma ativo (Assistente)
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
// Caminho RELATIVO de propósito: o app roda tanto na raiz (dev local, preview)
// quanto em subpasta (GitHub Pages → /english-lab/). Caminho absoluto quebra em um dos dois.
if ('serviceWorker' in navigator) {
  const swUrl = new URL('sw.js', document.baseURI)
  navigator.serviceWorker.register(swUrl, { scope: './' })
    .then(r => console.log('[SW] registrado, scope:', r.scope))
    .catch(e => console.warn('[SW] falha ao registrar:', e))
}
