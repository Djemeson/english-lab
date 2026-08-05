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

// Os três níveis de imagem mudam de nome e de preço conforme o fornecedor —
// o dropdown mostra o modelo real e o custo por imagem, não rótulos vagos.
function updateImgQualityOptions() {
  const sel = el('cfg-img-quality'); if (!sel) return
  const prov = el('cfg-img-provider')?.value || aiImgProvider()
  const P = AI_IMG[prov] || AI_IMG.openai
  const atual = cfg.imgQuality || 'medium'
  sel.innerHTML = ['low', 'medium', 'high'].map(q => {
    const n = P.niveis[q]
    return `<option value="${q}"${q === atual ? ' selected' : ''}>${esc(n.rotulo)} — US$ ${n.usd.toFixed(3)}/imagem</option>`
  }).join('')
}

function imgProviderMudou() {
  updateImgQualityOptions()
  const prov = el('cfg-img-provider')?.value
  const P = AI_IMG[prov]
  if (P && !(cfg[P.keyCfg] || '').trim()) {
    toast(`Configure a chave da ${P.nome} abaixo para gerar imagens por lá`, 'warning')
  }
}

function fillSettings() {
  const provSel = el('cfg-ai-provider')
  if (provSel) {
    provSel.innerHTML = Object.entries(AI_PROVIDERS).map(([id, P]) =>
      `<option value="${id}"${id === aiProviderAtual() ? ' selected' : ''}>${P.nome}</option>`).join('')
  }
  updateModelOptions()
  renderKeyRows()
  const ip = el('cfg-img-provider'); if (ip) ip.value = aiImgProvider()
  updateImgQualityOptions()
  const stt = el('cfg-stt-provider'); if (stt) stt.value = cfg.sttProvider || 'auto'
  setSettingsTab(_settingsTab)
  renderThemePicker()
  renderAccentPicker()
  renderEspacoLocal()      // assíncrono de propósito: não segura a abertura da tela
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
  cfg.imgProvider = AI_IMG[el('cfg-img-provider')?.value] ? el('cfg-img-provider').value : 'openai'
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

// ================================================================
// DATA MANAGEMENT
// ================================================================
// (havia um `async` órfão aqui, sobra de um patch antigo: como estava numa
//  linha sozinha, o JS o lia como variável e lançava ReferenceError toda vez
//  que este arquivo era avaliado — abortando qualquer código no fim dele.)
// ================================================================
// ESPAÇO EM DISCO — episódios de podcast e áudio consertado ocupam
// dezenas/centenas de MB no IndexedDB, e até aqui não havia como ver
// quanto. Abre o `el-video-db` SEM versão (só lê o que já existe) para
// não depender do lazy js/video.js — armadilha nº 1.
// O tamanho vem do próprio Blob: em IndexedDB ele é uma referência de
// arquivo, então ler `.size` NÃO carrega os bytes na memória.
// ================================================================
function _mb(b) {
  if (!b) return '0 MB'
  return b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : Math.round(b / 1048576) + ' MB'
}

function _idbTamanhos(store) {
  return new Promise(resolve => {
    let req
    try { req = indexedDB.open('el-video-db') } catch { return resolve([]) }
    req.onerror = () => resolve([])
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(store)) { db.close(); return resolve([]) }
      const itens = []
      const cur = db.transaction(store).objectStore(store).openCursor()
      cur.onerror = () => { db.close(); resolve(itens) }
      cur.onsuccess = e => {
        const c = e.target.result
        if (!c) { db.close(); return resolve(itens) }
        itens.push({ key: c.key, size: (c.value && c.value.size) || 0 })
        c.continue()
      }
    }
  })
}

async function renderEspacoLocal() {
  const box = el('set-espaco'); if (!box) return
  const [eps, fix] = await Promise.all([_idbTamanhos('files'), _idbTamanhos('media')])
  const bEps = eps.reduce((a, x) => a + x.size, 0)
  const bFix = fix.reduce((a, x) => a + x.size, 0)
  let est = null
  try { if (navigator.storage && navigator.storage.estimate) est = await navigator.storage.estimate() } catch {}

  if (!eps.length && !fix.length && !est) { box.innerHTML = ''; return }

  const linha = (rot, n, bytes, dica) => `
    <div class="cost-row"><span data-tip="${escA(dica)}">${rot}</span>
      <b>${n} ${n === 1 ? 'arquivo' : 'arquivos'} · ${_mb(bytes)}</b></div>`

  box.innerHTML = `
    <div class="set-espaco">
      <div class="set-espaco-head">${ic('database','ic-sm')}Espaço usado neste aparelho</div>
      <div class="cost-rows">
        ${linha('Episódios de podcast baixados', eps.length, bEps, 'O mp3 de cada episódio. Apagar não perde nada do estudo: a legenda, os marcadores, os cortes e os cards continuam, e o episódio volta a ser baixado quando você abrir de novo.')}
        ${fix.length ? linha('Áudio consertado (MKV com Dolby)', fix.length, bFix, 'Faixa de áudio extraída pelo ffmpeg para vídeos que tocavam mudos no Chrome. Refeita sob demanda.') : ''}
        ${est && est.usage ? `<div class="cost-row total"><span>Total do Language Lab</span><b>${_mb(est.usage)}${est.quota ? ' de ' + _mb(est.quota) + ' disponíveis' : ''}</b></div>` : ''}
      </div>
      ${(eps.length || fix.length) ? `
        <div class="btn-group" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          ${eps.length ? `<button class="btn btn-secondary btn-sm" onclick="liberarEspacoPodcasts()">${ic('trash','ic-sm')}Liberar ${eps.length === 1 ? 'o episódio' : `os ${eps.length} episódios`} (${_mb(bEps)})</button>` : ''}
          ${fix.length ? `<button class="btn btn-ghost btn-sm" onclick="liberarEspacoAudioFix()">${ic('trash','ic-sm')}Liberar o áudio consertado (${_mb(bFix)})</button>` : ''}
        </div>
        <p class="cost-note">Nada de estudo é perdido: só o arquivo grande sai. Legendas, marcadores,
        cortes e cards ficam — e o áudio volta sozinho quando você reabrir.</p>` : ''}
    </div>`
}

function _idbLimpar(store) {
  return new Promise(resolve => {
    let req
    try { req = indexedDB.open('el-video-db') } catch { return resolve(false) }
    req.onerror = () => resolve(false)
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(store)) { db.close(); return resolve(false) }
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).clear()
      tx.oncomplete = () => { db.close(); resolve(true) }
      tx.onerror = () => { db.close(); resolve(false) }
    }
  })
}

async function liberarEspacoPodcasts() {
  const eps = await _idbTamanhos('files')
  const bytes = eps.reduce((a, x) => a + x.size, 0)
  if (!eps.length) { toast('Nenhum episódio baixado', 'info'); return }
  if (!(await confirmModal({ title: 'Liberar espaço', icon: 'trash', confirmText: `Apagar ${_mb(bytes)}`,
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Apaga o áudio de
      <b>${eps.length} episódio${eps.length !== 1 ? 's' : ''}</b> (${_mb(bytes)}) guardado neste aparelho.
      <b>Nada do estudo é perdido</b>: legendas, marcadores, cortes e cards continuam, e cada episódio
      volta a ser baixado do feed quando você abri-lo de novo.</p>` }))) return
  await _idbLimpar('files')
  toast(`${_mb(bytes)} liberados — o estudo continua todo aqui`, 'success')
  renderEspacoLocal()
}

async function liberarEspacoAudioFix() {
  const fix = await _idbTamanhos('media')
  const bytes = fix.reduce((a, x) => a + x.size, 0)
  if (!fix.length) { toast('Nada para liberar', 'info'); return }
  if (!(await confirmModal({ title: 'Liberar áudio consertado', icon: 'trash', confirmText: `Apagar ${_mb(bytes)}`,
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Apaga a faixa de áudio que o ffmpeg extraiu
      para vídeos que tocavam mudos (${_mb(bytes)}). Ela é <b>refeita em minutos</b> pelo botão
      "Consertar áudio" na próxima vez que você abrir o vídeo.</p>` }))) return
  await _idbLimpar('media')
  toast(`${_mb(bytes)} liberados`, 'success')
  renderEspacoLocal()
}

function exportData() {
  // Backup COMPLETO (2026-08-01): antes só words+cfg saíam — nem o agendamento
  // SRS entrava, então "restaurar do backup" perdia todo o progresso de estudo.
  // Áudio/imagens ficam de fora (são MBs e regeneráveis via TTS/IA).
  const payload = {
    words, cfg, srsCards, srsLog, srsDecks, srsCfg,
    conversas: (typeof conversas !== 'undefined') ? conversas : [],
    videos:    (typeof videos    !== 'undefined') ? videos    : [],
    clips:     (typeof clips     !== 'undefined') ? clips     : [],
    podShows:  (typeof podShows  !== 'undefined') ? podShows  : [],
    // Histórico do Kindle: sem ele, restaurar um backup faria a importação
    // seguinte ressuscitar todas as palavras já estudadas.
    kindleSeen: (typeof loadKindleSeen === 'function') ? [...loadKindleSeen()] : [],
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
      // União com o histórico local (nunca substituição): o backup pode ser de
      // um aparelho que importou menos coisa do que este.
      if (Array.isArray(d.kindleSeen) && typeof loadKindleSeen === 'function') {
        const uniao = loadKindleSeen()
        d.kindleSeen.forEach(h => uniao.add(h))
        saveKindleSeen(uniao)
      }
      // Programas de podcast: união por feedUrl (a lista é atalho, não dado de
      // estudo — mesclar é sempre melhor que substituir).
      if (Array.isArray(d.podShows) && typeof podShows !== 'undefined') {
        const vistos = new Set(podShows.map(s => s.feedUrl))
        podShows = [...podShows, ...d.podShows.filter(s => s && s.feedUrl && !vistos.has(s.feedUrl))].slice(0, 24)
        savePodShows()
      }
    } catch { toast('Arquivo JSON inválido', 'error') }
  }
  reader.readAsText(file); input.value = ''
}

async function clearKindleSeen() {
  if (!(await confirmModal({ title: 'Resetar histórico do Kindle', icon: 'refresh', confirmText: 'Resetar',
    html: '<p style="font-size:var(--fs-sm);color:var(--text2)">Tudo o que já foi importado do Kindle (palavras do <b>vocab.db</b> e destaques) <b>volta a aparecer</b> na próxima importação. Nenhum card de estudo é afetado.</p>' }))) return
  localStorage.setItem(SK.kindleSeen, '[]')
  // O histórico agora também vive na nuvem, e lá o merge é por UNIÃO: se não
  // empurrarmos a lista vazia AGORA, o próximo snapshot devolveria tudo.
  if (typeof fbPushData === 'function') { try { await fbPushData() } catch (e) {} }
  toast('Histórico Kindle resetado. Próxima importação mostrará tudo de novo.', 'info')
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
  // ⚠️ Tem de zerar TUDO o que o fbPushData do passo 4 envia: ele grava a
  // memória, não o localStorage. Sem isto, "apagar tudo" limpava o disco e
  // logo em seguida RE-ENVIAVA vídeos, cortes, conversas e palavras conhecidas
  // para a nuvem — que voltavam no snapshot seguinte.
  words = []; srsCards = []; srsLog = []
  if (typeof videos    !== 'undefined') videos    = []
  if (typeof clips     !== 'undefined') clips     = []
  if (typeof conversas !== 'undefined') { conversas = []; if (typeof activeConversaId !== 'undefined') activeConversaId = null }
  if (typeof podShows  !== 'undefined') podShows  = []
  if (typeof kindleItems !== 'undefined') kindleItems = []
  if (typeof knownWords  !== 'undefined') knownWords  = {}
  if (typeof ignoredWords !== 'undefined') ignoredWords = {}
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
