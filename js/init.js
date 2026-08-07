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
  loadVideos()       // metadados de vídeo (seção Vídeo — o módulo é lazy, o estado não)
  loadClips()        // cortes de cena
  loadLivros()       // estante de ebooks (o arquivo fica no IDB; aqui só metadados)
  loadPodShows()     // programas de podcast já visitados (sincronizados)
  loadSrs()          // loads srsCfg, srsLog, decks
  await loadSrsAsync() // loads srsCards from IDB (migrates if needed)
  migrateLangFields()  // multi-idioma: words/cards antigos ganham lang:'en' (aditivo)
  migrateMeaningIds()  // card antigo ganha `meaningId`: identidade por id, não por posição
  mountLangSelector('lang-selector-add')  // seletor de idioma ativo (Adicionar)
  mountLangSelector('lang-selector-asst') // seletor de idioma ativo (Assistente)
  renderDashboard()
  updateSrsBadge()
  // Setas ←/→ percorrem as abas do painel (padrão de tablist acessível)
  const tl = document.getElementById('dash-tablist')
  if (tl) tl.addEventListener('keydown', _dashTabKeys)
  const stl = document.getElementById('settings-tablist')
  if (stl) stl.addEventListener('keydown', _settingsTabKeys)
  initFirebase()
  // Só agora o app tem palavras/config na memória: libera a entrega das
  // capturas da extensão (e processa o que já tiver chegado).
  englabAppPronto()
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

  // Atualização automática após um deploy.
  // O sw.js faz skipWaiting()+clients.claim(), então a versão nova assume o
  // controle da aba na hora — mas o HTML/JS já carregado continua sendo o
  // ANTIGO até um refresh. Sem isto, o app fica numa versão velha até o
  // usuário lembrar de dar hard-refresh (e no celular quase nunca lembra).
  // Recarregamos UMA vez quando o controlador troca; o guard evita laço.
  let _swRecarregando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swRecarregando) return
    _swRecarregando = true
    console.log('[SW] versão nova assumiu — recarregando')
    location.reload()
  })
}

// O banner de áudio nasce solto no index.html; aqui ele entra na PILHA DE
// AVISOS, que é quem empilha. Sem isto ele voltava a competir com os toasts
// pelo mesmo canto da tela.
;(function _moverBannerParaPilha() {
  const b = document.getElementById('audio-gen-banner')
  const pilha = document.getElementById('toasts')
  if (b && pilha && b.parentElement !== pilha) pilha.appendChild(b)
})()
