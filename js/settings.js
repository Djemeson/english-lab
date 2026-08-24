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
          <input type="password" id="cfg-key-${id}" aria-label="Chave de API — ${escA(P.nome)}" placeholder="${P.placeholder}" autocomplete="off">
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
  // 'low' aqui também: com 'medium', o seletor MOSTRAVA "Padrão" enquanto o
  // aiImgNivel usava outro nível — a tela mentia sobre o que ia ser cobrado.
  const atual = cfg.imgQuality || 'low'
  sel.innerHTML = ['low', 'medium', 'high'].map(q => {
    const n = P.niveis[q]
    // Sem toFixed(3): arredondava 0,0336 para "0,034" e a tela passava a
    // cobrar mais do que a tabela. Os preços são literais exatos no catálogo.
    return `<option value="${q}"${q === atual ? ' selected' : ''}>${esc(n.rotulo)} — US$ ${n.usd}/imagem</option>`
  }).join('')
}

// O rótulo do fornecedor CARREGA O MODELO, e por isso não pode ser escrito à
// mão: era literalmente "OpenAI · gpt-image-1" no HTML, e continuou dizendo
// isso depois de o catálogo passar para o gpt-image-2 — a tela mentia sobre o
// que ia ser chamado. Agora sai do AI_IMG, e mostra o modelo da qualidade
// ATIVA, que é o que de fato vai rodar.
function updateImgProviderOptions() {
  const sel = el('cfg-img-provider'); if (!sel) return
  const atual = AI_IMG[cfg.imgProvider] ? cfg.imgProvider : aiImgProvider()
  const q = cfg.imgQuality || 'low'
  sel.innerHTML = Object.entries(AI_IMG).map(([id, P]) => {
    const n = P.niveis[q] || P.niveis.low
    return `<option value="${id}"${id === atual ? ' selected' : ''}>${esc(P.nome)} · ${esc(n.model || n.quality || '')}</option>`
  }).join('')
}

function imgProviderMudou() {
  cfg.imgProvider = AI_IMG[el('cfg-img-provider')?.value] ? el('cfg-img-provider').value : cfg.imgProvider
  updateImgProviderOptions()
  updateImgQualityOptions()
  const prov = el('cfg-img-provider')?.value
  const P = AI_IMG[prov]
  if (P && !(cfg[P.keyCfg] || '').trim()) {
    toast(`Configure a chave da ${P.nome} abaixo para gerar imagens por lá`, 'warning')
  }
}

// ================================================================
// QUANTO A IA CUSTOU — o painel do livro-caixa (melhoria 1, rodada 44)
// ================================================================
// O app sempre MEDIU o consumo (`usage` de cada chamada); o número morria no
// acumulador de uma operação. Agora `ai.js` anota tudo por dia em
// `el-ia-custo`, e este painel responde a pergunta "para onde foi meu
// crédito": hoje, 7 dias, 30 dias — em reais, pela cotação do dia.
async function renderCustoIA() {
  const box = el('ia-custo-painel'); if (!box) return
  const l = (typeof aiCustoLedger === 'function') ? aiCustoLedger() : {}
  const dias = Object.keys(l).sort()
  if (!dias.length) {
    box.innerHTML = `<p class="desc">Nada registrado ainda neste aparelho — o livro-caixa começa a contar a partir de agora, a cada chamada de IA.</p>`
    return
  }
  const dl = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const hoje = dl(new Date())
  const desde = n => { const d = new Date(); d.setDate(d.getDate() - (n - 1)); return dl(d) }
  const soma = de => dias.filter(k => k >= de).reduce((a, k) => {
    const e = l[k]; a.usd += e.usd || 0; a.ch += e.chamadas || 0; a.est += e.est || 0; return a
  }, { usd: 0, ch: 0, est: 0 })
  const rate = await aiUsdBrl()
  const brl = v => 'R$ ' + (v * rate).toFixed(2).replace('.', ',')
  const linhas = [
    ['Hoje', soma(hoje)],
    ['Últimos 7 dias', soma(desde(7))],
    ['Últimos 30 dias', soma(desde(30))],
    [`Desde ${dias[0].split('-').reverse().join('/')}`, soma('0000')]
  ]
  box.innerHTML = `
    <div class="cost-rows">
      ${linhas.map(([rot, s]) => `
        <div class="cost-row"><span>${esc(rot)}</span>
          <b>${brl(s.usd)} <small style="color:var(--text3);font-weight:400">· ${s.ch} chamada${s.ch !== 1 ? 's' : ''}${s.est > 0.0005 ? ` · ${brl(s.est)} em estimativas` : ''}</small></b>
        </div>`).join('')}
    </div>
    <p class="cost-note">Tokens medidos chamada a chamada, ao preço do modelo que respondeu; áudio, imagem e transcrição entram pela tabela (marcados como estimativa). Cotação de hoje: US$ 1 ≈ R$ ${rate.toFixed(2).replace('.', ',')}. Cada aparelho tem o próprio registro.</p>`
}

// ================================================================
// O SEMÁFORO DE FORNECEDOR (melhoria 2, rodada 44)
// ================================================================
// Uma linha por fornecedor: sem chave (cinza), de pé (verde), chave inválida
// (vermelho, com o motivo) e — o caso que motivou isto — SEM CRÉDITOS
// (vermelho, nomeado). O teste de chave é o GET /models, que não custa token;
// billing o /models não vê, então o "sem créditos" vem do uso real da sessão
// (aiSemCreditoVisto). Cada chave só é testada uma vez por sessão, a menos
// que ele clique em "testar de novo".
const _semaforoMemo = new Map()   // prov + chave → { ok, msg }

async function renderSemaforoIA(forcar) {
  const box = el('ia-semaforo'); if (!box) return
  if (typeof AI_PROVIDERS === 'undefined') return
  const provAtivo = aiProviderAtual()
  const linhas = []
  for (const [id, P] of Object.entries(AI_PROVIDERS)) {
    const chave = (cfg[P.keyCfg] || '').trim()
    linhas.push({ id, P, chave })
  }
  const pinta = estados => {
    box.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        ${estados.map(e => `
          <span style="display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);border-radius:999px;padding:5px 12px;font-size:var(--fs-xs);background:var(--surface2)"
                data-tip="${escA(e.tip || '')}">
            <i style="width:9px;height:9px;border-radius:50%;background:${e.cor};display:inline-block"></i>
            <b>${esc(e.P.nome)}</b>${e.ativo ? '<span style="color:var(--text3)">· em uso</span>' : ''}
            <span style="color:${e.corTxt || 'var(--text2)'}">${esc(e.txt)}</span>
          </span>`).join('')}
        <button class="btn btn-ghost btn-sm" onclick="renderSemaforoIA(true)" data-tip="Refaz o teste das chaves (GET /models — não gasta token)">testar de novo</button>
      </div>`
  }
  // Primeiro desenho, sem esperar rede: o que já se sabe.
  const estados = linhas.map(({ id, P, chave }) => {
    const semCredito = typeof aiSemCreditoVisto === 'function' && aiSemCreditoVisto(P.nome)
    if (!chave) return { P, ativo: id === provAtivo, cor: 'var(--text3)', txt: 'sem chave', tip: 'Guarde a chave logo abaixo para este fornecedor existir para o app' }
    if (semCredito) return { P, ativo: id === provAtivo, cor: 'var(--error)', corTxt: 'var(--error)', txt: 'SEM CRÉDITOS', tip: 'O fornecedor respondeu "sem créditos" nesta sessão. Recarregue a conta ou troque de fornecedor.' }
    const memo = _semaforoMemo.get(id + '|' + chave)
    if (memo && !forcar) return { P, ativo: id === provAtivo, cor: memo.ok ? 'var(--success)' : 'var(--error)', corTxt: memo.ok ? '' : 'var(--error)', txt: memo.ok ? 'de pé' : 'chave recusada', tip: memo.ok ? 'A chave respondeu — o fornecedor está acessível' : (memo.msg || '') }
    return { P, ativo: id === provAtivo, cor: 'var(--warning)', txt: 'testando…', chave, id }
  })
  pinta(estados)
  // Agora os que faltam testar, em paralelo — e repinta quando todos voltarem.
  const pendentes = estados.filter(e => e.txt === 'testando…')
  if (!pendentes.length) return
  await Promise.all(pendentes.map(async e => {
    let r = { ok: false, msg: 'sem resposta' }
    try { r = await aiTestKeyProv(e.id, e.chave) } catch (err) { r = { ok: false, msg: err.message } }
    _semaforoMemo.set(e.id + '|' + e.chave, r)
  }))
  if (el('ia-semaforo')) renderSemaforoIA()
}

function fillSettings() {
  const provSel = el('cfg-ai-provider')
  if (provSel) {
    provSel.innerHTML = Object.entries(AI_PROVIDERS).map(([id, P]) =>
      `<option value="${id}"${id === aiProviderAtual() ? ' selected' : ''}>${P.nome}</option>`).join('')
  }
  updateModelOptions()
  renderKeyRows()
  updateImgProviderOptions()
  updateImgQualityOptions()
  renderCustoIA()
  renderSemaforoIA()
  const nv = el('cfg-nivel-aluno')
  if (nv) {
    nv.innerHTML = CEFR.map(c =>
      `<option value="${c.id}"${c.id === cefrNivelAluno() ? ' selected' : ''}>${esc(c.nome)} — ${esc(c.dica)}</option>`).join('')
  }
  const stt = el('cfg-stt-provider'); if (stt) stt.value = cfg.sttProvider || 'auto'
  // Ligado por padrão: `cfg.autoMeta` só existe depois que ele DESLIGA.
  const am = el('cfg-auto-meta'); if (am) am.checked = cfg.autoMeta !== false
  const cia = el('cfg-catalogo-ia'); if (cia) cia.checked = cfg.catalogoIA !== false
  const gbk = el('cfg-gbooks-key'); if (gbk) gbk.value = cfg.googleBooksKey || ''
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
  cfg.imgQuality = el('cfg-img-quality')?.value || 'low'
  cfg.sttProvider = el('cfg-stt-provider')?.value || 'auto'
  const nvSel = el('cfg-nivel-aluno')?.value
  if (cefrIdx(nvSel) >= 0) cfg.nivelAluno = nvSel
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
  // Backup COMPLETO (2026-08-01; completado de verdade na rodada 44): antes
  // livros, audiolivros e as palavras conhecidas ficavam de fora — e o
  // importador só lia três campos, então "restaurar do backup" perdia o
  // progresso que o arquivo prometia guardar.
  // Áudio/imagens ficam de fora (são MBs e regeneráveis via TTS/IA).
  // ⚠️ AS CHAVES DE API NÃO ENTRAM: elas já vivem em três lugares (local,
  // IndexedDB e a nuvem da conta) — e um backup é um arquivo que se manda por
  // e-mail, se anexa, se compartilha. Chave dentro dele é chave vazada.
  const { openaiKey, geminiKey, groqKey, ...cfgSemChaves } = cfg || {}
  const payload = {
    words, cfg: cfgSemChaves, srsCards, srsLog, srsDecks, srsCfg,
    conversas: (typeof conversas !== 'undefined') ? conversas : [],
    videos:    (typeof videos    !== 'undefined') ? videos    : [],
    clips:     (typeof clips     !== 'undefined') ? clips     : [],
    podShows:  (typeof podShows  !== 'undefined') ? podShows  : [],
    livros:      (typeof livros      !== 'undefined') ? livros      : [],
    audiolivros: (typeof audiolivros !== 'undefined') ? audiolivros : [],
    obrasNome:   (typeof obrasNome   !== 'undefined') ? obrasNome   : {},
    known: {
      map:      (typeof knownWords   !== 'undefined') ? knownWords   : {},
      ignored:  (typeof ignoredWords !== 'undefined') ? ignoredWords : {},
      senses:   (typeof knownSenses  !== 'undefined') ? knownSenses  : {},
      unmarked: (typeof unmarks      !== 'undefined') ? unmarks      : {}
    },
    // Histórico do Kindle: sem ele, restaurar um backup faria a importação
    // seguinte ressuscitar todas as palavras já estudadas.
    kindleSeen: (typeof loadKindleSeen === 'function') ? [...loadKindleSeen()] : [],
    kindleResetAt: (typeof kindleResetAt === 'function') ? kindleResetAt() : 0,
    exported_at: new Date().toISOString()
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `english-lab-${new Date().toISOString().slice(0,10)}.json`
  a.click(); toast('Backup completo exportado (palavras, cards, progresso, acervo, config — sem as chaves de API)', 'success')
}

// A RESTAURAÇÃO LÊ TUDO QUE O EXPORT GRAVA (rodada 44). Antes só três campos
// eram lidos (words, kindleSeen, podShows): restaurar o backup "completo"
// jogava fora o agendamento SRS, os baralhos, o acervo e a config que ele
// prometia guardar — e o backup é a rede de segurança de todos os fluxos
// perigosos do app. Regra geral: MESCLAR, nunca substituir — o que já está no
// aparelho vence o empate, porque o backup é, por definição, mais velho.
function importData(input) {
  const file = input.files[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = async e => {
    try {
      const d = JSON.parse(e.target.result)
      if (!d || typeof d !== 'object') throw new Error('formato')
      const resumo = []
      const nBackup = {
        palavras: Array.isArray(d.words) ? d.words.length : 0,
        cards: Array.isArray(d.srsCards) ? d.srsCards.length : 0,
        livros: Array.isArray(d.livros) ? d.livros.length : 0,
        audiolivros: Array.isArray(d.audiolivros) ? d.audiolivros.length : 0
      }
      if (!(await confirmModal({ title: 'Importar backup', icon: 'upload', confirmText: 'Importar',
        html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Backup de <b>${esc(String(d.exported_at || 'data desconhecida').slice(0, 10))}</b>:
            ${nBackup.palavras} palavras · ${nBackup.cards} cards · ${nBackup.livros} livros · ${nBackup.audiolivros} audiolivros.</p>
          <p style="font-size:var(--fs-sm);color:var(--text2);margin-top:8px">Tudo será <b>mesclado</b> com o que já está aqui — nada do aparelho é apagado, e no empate o que está aqui vence.</p>` }))) return

      // Mescla por id: entra do backup só o que este aparelho não tem.
      const porId = (locais, doBackup, chave = 'id') => {
        const ids = new Set((locais || []).map(x => x && x[chave]).filter(Boolean))
        const novos = (doBackup || []).filter(x => x && x[chave] && !ids.has(x[chave]))
        return { lista: [...(locais || []), ...novos], n: novos.length }
      }

      if (Array.isArray(d.words)) {
        const r = porId(words, d.words)
        words = r.lista; saveWords()
        if (r.n) resumo.push(`${r.n} palavras`)
      }
      if (Array.isArray(d.srsCards) && typeof srsCards !== 'undefined') {
        const r = porId(srsCards, d.srsCards)
        srsCards = r.lista; saveSrsCards()
        if (r.n) resumo.push(`${r.n} cards`)
      }
      if (Array.isArray(d.srsDecks) && typeof srsDecks !== 'undefined') {
        const r = porId(srsDecks, d.srsDecks)
        srsDecks = r.lista; saveSrsDecks()
      }
      // Diário: por dia, ficando com o registro maior (o mesmo juiz do sync,
      // quando ele está carregado; sem ele, o maior `reviewed` decide).
      if (Array.isArray(d.srsLog) && typeof srsLog !== 'undefined') {
        const porDia = new Map(srsLog.map(x => [x.date, x]))
        let n = 0
        for (const x of d.srsLog) {
          if (!x || !x.date) continue
          const ja = porDia.get(x.date)
          if (!ja) { porDia.set(x.date, x); n++ }
          else if (typeof _fbDiaMaior === 'function') porDia.set(x.date, _fbDiaMaior(ja, x))
          else if ((x.reviewed || 0) > (ja.reviewed || 0)) porDia.set(x.date, x)
        }
        srsLog = [...porDia.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
        saveSrsLog()
        if (n) resumo.push(`${n} dias de diário`)
      }
      if (d.srsCfg && typeof srsCfg !== 'undefined') {
        srsCfg = { ...SRS_DEF_CFG, ...srsCfg, ...d.srsCfg }
        persistSrsCfg()
      }
      // Config: o backup só PREENCHE o que está vazio aqui — restaurar num
      // aparelho já configurado não pode rebaixar a configuração dele.
      // (Backups antigos ainda trazem as chaves de API; valem pelo mesmo
      // critério: só entram se o campo local estiver vazio.)
      if (d.cfg && typeof d.cfg === 'object') {
        for (const [k, v] of Object.entries(d.cfg)) {
          if (v === '' || v == null) continue
          const atual = cfg[k]
          if (atual === '' || atual == null || atual === undefined) cfg[k] = v
        }
        saveCfg()
        if (typeof applyTheme === 'function') applyTheme(cfg.theme)
      }
      if (Array.isArray(d.conversas) && typeof conversas !== 'undefined') {
        const porIdC = new Map(conversas.map(c => [c.id, c]))
        for (const c of d.conversas) {
          if (!c || !c.id) continue
          const ja = porIdC.get(c.id)
          if (!ja || (c.updated_at || 0) > (ja.updated_at || 0)) porIdC.set(c.id, c)
        }
        conversas = [...porIdC.values()].sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
        saveConversas()
      }
      if (Array.isArray(d.videos) && typeof videos !== 'undefined') { videos = porId(videos, d.videos).lista; saveVideos() }
      if (Array.isArray(d.clips) && typeof clips !== 'undefined') { clips = porId(clips, d.clips).lista; saveClips() }
      // Acervo: por item, o `updatedAt` decide — e o histórico de leitura se
      // UNE por dia (a mesma regra do sync: um dia lido nunca some).
      const mesclarAcervo = (locais, doBackup) => {
        const porIdA = new Map((locais || []).map(l => [l.id, l]))
        let n = 0
        for (const b of (doBackup || [])) {
          if (!b || !b.id) continue
          const ja = porIdA.get(b.id)
          if (!ja) { porIdA.set(b.id, b); n++; continue }
          const vence = (b.updatedAt || 0) > (ja.updatedAt || 0) ? b : ja
          const perde = vence === b ? ja : b
          if (Array.isArray(ja.historico) || Array.isArray(b.historico)) {
            const dias = new Map()
            for (const h of [...(perde.historico || []), ...(vence.historico || [])]) {
              if (!h || !h.d) continue
              const jaDia = dias.get(h.d)
              if (!jaDia || (h.pct || 0) > (jaDia.pct || 0)) dias.set(h.d, h)
            }
            vence.historico = [...dias.values()].sort((a, b2) => String(a.d).localeCompare(String(b2.d)))
          }
          porIdA.set(b.id, vence)
        }
        return { lista: [...porIdA.values()], n }
      }
      if (Array.isArray(d.livros) && typeof livros !== 'undefined') {
        const r = mesclarAcervo(livros, d.livros)
        livros = r.lista; saveLivros()
        if (r.n) resumo.push(`${r.n} livros`)
      }
      if (Array.isArray(d.audiolivros) && typeof audiolivros !== 'undefined') {
        const r = mesclarAcervo(audiolivros, d.audiolivros)
        audiolivros = r.lista; saveAudiolivros()
        if (r.n) resumo.push(`${r.n} audiolivros`)
      }
      if (d.obrasNome && typeof obrasNome !== 'undefined') {
        obrasNome = { ...d.obrasNome, ...obrasNome }
        saveObrasNome()
      }
      // Conhecidas/ignoradas/sentidos: o mesmo merge do sync, lápides incluídas.
      if (d.known && typeof mesclarConhecidasComNuvem === 'function') {
        mesclarConhecidasComNuvem(d.known)
      }
      // União com o histórico local (nunca substituição): o backup pode ser de
      // um aparelho que importou menos coisa do que este.
      if (Array.isArray(d.kindleSeen) && typeof loadKindleSeen === 'function') {
        const uniao = loadKindleSeen()
        d.kindleSeen.forEach(h => uniao.add(h))
        saveKindleSeen(uniao)
        if (typeof kindleMarcarReset === 'function' && (Number(d.kindleResetAt) || 0) > kindleResetAt()) {
          kindleMarcarReset(Number(d.kindleResetAt))
        }
      }
      // Programas de podcast: união por feedUrl (a lista é atalho, não dado de
      // estudo — mesclar é sempre melhor que substituir).
      if (Array.isArray(d.podShows) && typeof podShows !== 'undefined') {
        const vistos = new Set(podShows.map(s => s.feedUrl))
        podShows = [...podShows, ...d.podShows.filter(s => s && s.feedUrl && !vistos.has(s.feedUrl))].slice(0, 24)
        savePodShows()
      }

      if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
      if (typeof glossInvalidar === 'function') { try { glossInvalidar() } catch (e2) {} }
      renderDashboard()
      if (typeof renderSidebar === 'function') { try { renderSidebar() } catch (e2) {} }
      if (typeof updateSrsBadge === 'function') { try { updateSrsBadge() } catch (e2) {} }
      fillSettings()
      toast(resumo.length
        ? `Backup restaurado: ${resumo.join(' · ')} entraram — o resto já estava aqui`
        : 'Backup lido — este aparelho já tinha tudo o que há nele', 'success')
    } catch { toast('Arquivo JSON inválido', 'error') }
  }
  reader.readAsText(file); input.value = ''
}

async function clearKindleSeen() {
  if (!(await confirmModal({ title: 'Resetar histórico do Kindle', icon: 'refresh', confirmText: 'Resetar',
    html: '<p style="font-size:var(--fs-sm);color:var(--text2)">Tudo o que já foi importado do Kindle (palavras do <b>vocab.db</b> e destaques) <b>volta a aparecer</b> na próxima importação. Nenhum card de estudo é afetado.</p>' }))) return
  localStorage.setItem(SK.kindleSeen, '[]')
  // A ÉPOCA DO RESET (rodada 44): o merge é por UNIÃO e união não esquece —
  // empurrar a lista vazia não bastava, porque o push de qualquer outro
  // aparelho devolvia o histórico dele. O carimbo viaja no doc da nuvem e
  // manda todo aparelho descartar o histórico pré-reset.
  if (typeof kindleMarcarReset === 'function') kindleMarcarReset(Date.now())
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

// ================================================================
// DEVOLVER TUDO AO PREPARAR — recomeçar o acervo pelo fluxo de 4 etapas
// ================================================================
// Pedido do Djemeson depois que Estudar e Revisar mudaram de forma: o acervo
// dele foi montado no fluxo ANTIGO e ele quer que tudo passe pelo novo.
//
// A regra da reversão é a mesma de `voltarParaPreparar` — literalmente a mesma
// função (`desfazerSentido`), porque duas cópias da mesma regra viram duas
// regras diferentes na primeira vez que uma delas for corrigida.
//
// OS CARDS SÃO APAGADOS, e essa é a decisão dele. Mantê-los deixaria o item no
// Preparar E cobrando revisão ao mesmo tempo — o material vivendo em dois
// lugares, exatamente o que o fluxo de 4 etapas veio acabar.
//
// `saber` não é tocado: o sentido que ele marcou como "conheço, não quero
// drilar" nunca esteve na fila, então não há de onde devolvê-lo.
// ================================================================
// ARRUMAR O LEMA DOS ITENS
// ================================================================
// O motor mora em `core.js` (shell), então aqui não há carregamento sob
// demanda — diferente do reparo do contexto, cujo motor é lazy.
// `conferir: true` simula e mostra as trocas; mexer no lema reagrupa o
// verbete, e reagrupar o acervo dele sem mostrar antes seria abuso.
function arrumarLemas(conferir) {
  const saida = el('lema-saida'); if (!saida) return
  if (typeof migrarLemas !== 'function') {
    saida.innerHTML = `<p class="dz-nota" style="color:var(--error)">Recarregue a página e tente de novo.</p>`
    return
  }
  const r = migrarLemas()
  if (!r.mexeu) {
    saida.innerHTML = `<p class="dz-nota">${ic('checkCircle','ic-sm')} Nenhum item com o lema torto — não há o que arrumar.</p>`
    return
  }
  if (!conferir) {
    const n = r.aplicar()
    saida.innerHTML = `<p class="dz-nota">${ic('checkCircle','ic-sm')} <b>${n}</b> ${n === 1 ? 'item arrumado' : 'itens arrumados'}.</p>`
    toast(`${n} ${n === 1 ? 'lema corrigido' : 'lemas corrigidos'}`, 'success')
    if (typeof renderReview === 'function') { try { renderReview() } catch (e) {} }
    return
  }
  const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`
  saida.innerHTML = `
    <ul class="cost-bullets"><li><b>${pl(r.mexeu, 'item vai mudar', 'itens vão mudar')}</b> de teto no verbete</li></ul>
    <div class="reparo-amostras">
      <p class="dz-nota">Como fica${r.exemplos.length < r.mexeu ? ` (${r.exemplos.length} de ${r.mexeu})` : ''}:</p>
      ${r.exemplos.map(e => `<div class="reparo-amostra">
        <b>${esc(e.palavra)}</b>
        <div class="reparo-antes">${esc(e.de)}</div>
        <div class="reparo-depois">${esc(e.para)}</div>
      </div>`).join('')}
    </div>
    <button class="btn btn-primary btn-sm" onclick="arrumarLemas(false)">${
      ic('check','ic-sm')} Arrumar ${pl(r.mexeu, 'item', 'itens')}</button>`
}

// A OBRA QUE VEIO DE CARONA. Irmã da de cima, mesmo contrato e mesmo cuidado:
// mudar a procedência REAGRUPA o item no Estudar — ele sai de baixo do livro e
// vai para "Do seu estudo" —, então mostra antes e só mexe se ele mandar.
// `migrarProcedenciaHerdada` mora em `review.js`, que é SHELL: pode chamar
// direto, sem a dança do lazy que o reparo do contexto exige logo abaixo.
// O CONFERIDOR QUE ABRE O LIVRO. Monta a função que a migração recebe injetada
// — ela mora no shell e não pode citar `ler.js`. Devolve `null` quando não há
// como montar; a migração então cai no julgamento textual, que é o de antes.
//
// ⚠️ TRÊS DECISÕES QUE MUDAM O RESULTADO, e nenhuma é óbvia:
//
// 1. `BookDB.keys()` ANTES de qualquer busca. `obraBuscar` engole o erro de
//    "o arquivo não está neste aparelho" e devolve zero achados — indistinguível
//    de "procurei e não está no livro". Confiar nisso apagaria a obra de itens
//    corretos em qualquer aparelho onde o EPUB não foi aberto ainda. Só as
//    CHAVES são lidas: nada de carregar 4 MB para saber se o arquivo existe.
//
// 2. O livro INTEIRO, não até onde ele leu. A regra do spoiler existe para não
//    entregar página nova na cara dele; aqui ninguém está lendo nada — é
//    verificação de procedência. E o teto seria falso: o `pos.cap` é a leitura
//    NO APP, mas as capturas vêm do Kindle, que costuma estar bem à frente.
//    Buscar só até o teto marcaria como forasteiro o item capturado adiante.
//    Foi essa decisão que o teste validou na hora: "tuck in" existe no livro,
//    no *Chapter 20* — o modo textual o teria expulsado da obra.
//
// 3. A resposta é SIM/NÃO, sem capítulo. Ver o porquê em
//    `migrarProcedenciaHerdada`: achar no livro protege o dado, não autoriza
//    reescrevê-lo.
async function _procConferidor() {
  if (typeof BookDB === 'undefined' || typeof obraDoItem !== 'function' ||
      typeof obraBuscar !== 'function' || typeof obraAteOndeLeu !== 'function') return null
  let comArquivo
  try { comArquivo = new Set(await BookDB.keys()) } catch (e) { return null }
  if (!comArquivo.size) return null
  return async (w) => {
    const livro = obraDoItem(w)
    if (!livro || !comArquivo.has(livro.id)) return null
    const ate = ((livro.chapters || []).length || 1) - 1
    let r
    try { r = await obraBuscar(livro, w.word, { ateCap: ate, maxTrechos: 1 }) } catch (e) { return null }
    return { achou: !!(r && r.total) }
  }
}

async function arrumarProcedencia(conferir) {
  const saida = el('proc-saida'); if (!saida) return
  if (typeof migrarProcedenciaHerdada !== 'function') {
    saida.innerHTML = `<p class="dz-nota" style="color:var(--error)">Recarregue a página e tente de novo.</p>`
    return
  }
  saida.innerHTML = `<p class="dz-nota"><span class="spinner"></span> abrindo os livros e conferindo…</p>`
  // Best-effort de propósito: se o leitor não carregar, a migração roda pelo
  // julgamento textual em vez de não rodar. O rodapé diz em qual modo foi.
  let olharNoLivro = null
  try { if (await _reparoCarregar()) olharNoLivro = await _procConferidor() } catch (e) { olharNoLivro = null }

  let r
  try { r = await migrarProcedenciaHerdada({ olharNoLivro }) }
  catch (e) { saida.innerHTML = `<p class="dz-nota" style="color:var(--error)">Falhou: ${esc(e.message)}</p>`; return }

  const modo = r.olhouOLivro
    ? `${ic('bookOpen','ic-sm')} conferido <b>dentro do livro</b>`
    : `${ic('alert','ic-sm')} conferido só pela <b>frase</b> — o arquivo do livro não está neste aparelho`
  const extras = [
    r.protegidos ? `<li><b>${r.protegidos}</b> ${r.protegidos === 1 ? 'ficou' : 'ficaram'} como ${r.protegidos === 1 ? 'está' : 'estão'} — a frase não usa a expressão, mas ela <b>está no livro</b></li>` : '',
    r.semLivro ? `<li><b>${r.semLivro}</b> ${r.semLivro === 1 ? 'item ficou de fora' : 'itens ficaram de fora'} — sem o livro aqui, não dá para conferir, e chutar seria pior</li>` : ''
  ].filter(Boolean).join('')

  if (!r.mexeu) {
    saida.innerHTML = `<p class="dz-nota">${ic('checkCircle','ic-sm')} Nenhum item com a obra errada — não há o que arrumar.</p>
      <ul class="cost-bullets"><li>${modo}</li>${extras}</ul>`
    return
  }
  if (!conferir) {
    const n = r.aplicar()
    saida.innerHTML = `<p class="dz-nota">${ic('checkCircle','ic-sm')} <b>${n}</b> ${n === 1 ? 'item arrumado' : 'itens arrumados'}.</p>`
    toast(`${n} ${n === 1 ? 'procedência corrigida' : 'procedências corrigidas'}`, 'success')
    if (typeof renderReview === 'function') { try { renderReview() } catch (e) {} }
    if (typeof renderDashboard === 'function') { try { renderDashboard() } catch (e) {} }
    return
  }
  const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`
  const linhas = [
    `<li>${modo}</li>`,
    `<li><b>${pl(r.mexeu, 'item sai', 'itens saem')}</b> da obra — ${r.olhouOLivro ? 'a expressão não está no livro' : 'a frase não usa a expressão'}</li>`,
    extras
  ].filter(Boolean).join('')
  saida.innerHTML = `
    <ul class="cost-bullets">${linhas}</ul>
    <div class="reparo-amostras">
      <p class="dz-nota">Como fica${r.exemplos.length < r.mexeu ? ` (${r.exemplos.length} de ${r.mexeu})` : ''}:</p>
      ${r.exemplos.map(e => `<div class="reparo-amostra">
        <b>${esc(e.palavra)}</b>
        <div class="reparo-antes">${esc(e.de)}</div>
        <div class="reparo-depois">${esc(e.para)}</div>
      </div>`).join('')}
    </div>
    <button class="btn btn-primary btn-sm" onclick="arrumarProcedencia(false)">${
      ic('check','ic-sm')} Arrumar ${pl(r.mexeu, 'item', 'itens')}</button>`
}

// A MÍDIA SAINDO DO BANCO. Mesma família das outras: conferência antes, e a
// contagem vem do servidor, não de estimativa — o que ele vê é o que existe.
async function migrarMidia(conferir) {
  const saida = el('midia-saida'); if (!saida) return
  if (typeof migrarMidiaParaStorage !== 'function' || typeof _fbUser === 'undefined' || !_fbUser) {
    saida.innerHTML = `<p class="dz-nota" style="color:var(--error)">Entre na sua conta para migrar — os arquivos são seus e vão para a sua pasta.</p>`
    return
  }
  const kb = n => n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`

  if (conferir) {
    saida.innerHTML = `<p class="dz-nota"><span class="spinner"></span> contando o que está no banco…</p>`
    let a = 0, i = 0, bytes = 0
    try {
      const base = _fbDb.collection('users').doc(_fbUser.uid)
      const [da, di] = await Promise.all([base.collection('audio').get(), base.collection('images').get()])
      a = da.size; i = di.size
      da.forEach(d => bytes += String((d.data() || {}).data || '').length)
      di.forEach(d => bytes += String((d.data() || {}).data || '').length)
    } catch (e) {
      saida.innerHTML = `<p class="dz-nota" style="color:var(--error)">Não consegui ler: ${esc(e.message)}</p>`
      return
    }
    if (!a && !i) {
      saida.innerHTML = `<p class="dz-nota">${ic('checkCircle','ic-sm')} O banco já está limpo — nada de mídia guardada nele.</p>`
      return
    }
    const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`
    saida.innerHTML = `
      <ul class="cost-bullets">
        ${a ? `<li><b>${pl(a, 'áudio', 'áudios')}</b> saem do banco</li>` : ''}
        ${i ? `<li><b>${pl(i, 'imagem', 'imagens')}</b> saem do banco</li>` : ''}
        <li><b>${kb(bytes)}</b> de peso que o banco para de carregar</li>
      </ul>
      <button class="btn btn-primary btn-sm" onclick="migrarMidia(false)">${ic('check','ic-sm')} Mover ${pl(a + i, 'arquivo', 'arquivos')}</button>`
    return
  }

  saida.innerHTML = `<p class="dz-nota"><span class="spinner"></span> movendo… <span id="midia-passo"></span></p>`
  const passo = el('midia-passo')
  const r = await migrarMidiaParaStorage((tipo, n, total) => {
    if (passo) passo.textContent = `${tipo === 'audio' ? 'áudios' : 'imagens'} ${n}/${total}`
  })
  if (r.erro) { saida.innerHTML = `<p class="dz-nota" style="color:var(--error)">${esc(r.erro)}</p>`; return }
  saida.innerHTML = `<p class="dz-nota">${ic('checkCircle','ic-sm')}
    <b>${r.audio}</b> ${r.audio === 1 ? 'áudio' : 'áudios'} e <b>${r.images}</b> ${r.images === 1 ? 'imagem' : 'imagens'} movidos
    (${kb(r.bytes)}).${r.falhas ? ` <b>${r.falhas}</b> não foram e continuam no banco — rode de novo.` : ''}</p>`
  toast('Mídia movida para o espaço de arquivos', 'success')
}

// ================================================================
// REPARAR O CONTEXTO DOS ITENS DO LEITOR
// ================================================================
// ⚠️ ARMADILHA Nº 1: o motor do reparo mora em `ler.js`, que é LAZY — este
// arquivo é do shell e não pode citá-lo direto. Por isso os módulos são
// carregados sob demanda ANTES da primeira chamada, e a guarda é por
// `typeof`, não por fé. `epub.js` vem primeiro porque `ler.js` usa
// `epubAbrir`, na mesma ordem do pacote 'ler' do `_LAZY`.
async function _reparoCarregar() {
  if (typeof reparoExecutar === 'function') return true
  for (const f of ['js/epub.js', 'js/ler.js']) {
    try { await _loadScript(f) } catch (e) { console.error(e); return false }
  }
  return typeof reparoExecutar === 'function'
}

// `conferir: true` simula — não grava nada. É o modo em que ele ENTRA, porque
// trocar a frase de um item não tem volta e a amostra é o que deixa ele
// decidir com o caso na mão em vez de no escuro.
async function repararContexto(conferir) {
  const saida = el('reparo-saida'); if (!saida) return
  saida.innerHTML = `<p class="dz-nota"><span class="spinner"></span> abrindo os livros e procurando…</p>`
  if (!(await _reparoCarregar())) {
    saida.innerHTML = `<p class="dz-nota" style="color:var(--error)">Não consegui carregar o leitor. Recarregue a página.</p>`
    return
  }
  let r
  try { r = await reparoExecutar({ simular: !!conferir }) }
  catch (e) { saida.innerHTML = `<p class="dz-nota" style="color:var(--error)">Falhou: ${esc(e.message)}</p>`; return }

  if (r.erro) { saida.innerHTML = `<p class="dz-nota" style="color:var(--error)">${esc(r.erro)}</p>`; return }
  if (!r.total) {
    saida.innerHTML = `<p class="dz-nota">${ic('checkCircle','ic-sm')} Nenhum item com o contexto trocado — não há o que reparar.</p>`
    return
  }
  if (!conferir) {
    saida.innerHTML = `<p class="dz-nota">${ic('checkCircle','ic-sm')} <b>${r.consertados}</b> ${r.consertados === 1 ? 'item reparado' : 'itens reparados'}.</p>`
    toast(`${r.consertados} ${r.consertados === 1 ? 'contexto devolvido' : 'contextos devolvidos'}`, 'success')
    if (typeof renderReview === 'function') { try { renderReview() } catch (e) {} }
    return
  }

  const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`
  const linhas = [
    `<b>${pl(r.total, 'item está', 'itens estão')}</b> com a frase de outro lugar`,
    r.unicos   ? `<b>${r.unicos}</b> ${r.unicos === 1 ? 'tem' : 'têm'} uma única ocorrência no capítulo — reparo exato` : '',
    r.ambiguos ? `<b>${r.ambiguos}</b> ${r.ambiguos === 1 ? 'aparece' : 'aparecem'} mais de uma vez: fica a primeira (qual você marcou se perdeu junto com o contexto)` : '',
    r.ancestrais ? `<b>${r.ancestrais}</b> ${r.ancestrais === 1 ? 'nasceu' : 'nasceram'} da família de outro item e ${r.ancestrais === 1 ? 'herdou' : 'herdaram'} a obra dele — a procedência passa a ser <b>${esc(OBRA_ESTUDO)}</b>, e a cena emprestada sai` : '',
    r.semCapitulo ? `<b>${r.semCapitulo}</b> com o capítulo em outro nome — procurei no livro inteiro` : '',
    r.naoAchados  ? `<b>${r.naoAchados}</b> não ${r.naoAchados === 1 ? 'foi encontrado' : 'foram encontrados'} no livro: ${r.naoAchados === 1 ? 'fica' : 'ficam'} como ${r.naoAchados === 1 ? 'está' : 'estão'}` : '',
    r.semLivro    ? `<b>${r.semLivro}</b> sem o arquivo neste aparelho — importe o .epub para reparar` : ''
  ].filter(Boolean)

  // ⚠️ QUEM NÃO FOI REPARADO PRECISA DIZER POR QUÊ. "Não encontrado no livro"
  // sozinho é um beco: some a informação de que talvez o livro é que não abriu,
  // e ele fica sem saber se reimporta o arquivo ou se o item veio de outro
  // lugar. O motivo por item é o que transforma o relatório em ação.
  const perdidos = (r.perdidos || []).length ? `
    <div class="reparo-amostras">
      <p class="dz-nota">Não deu para reparar:</p>
      ${r.perdidos.slice(0, 15).map(p => `
        <div class="reparo-amostra">
          <b>${esc(p.palavra)}</b>${p.obra ? `<i> · ${esc(obraNome(p.obra))}${p.cap ? ' · ' + esc(p.cap) : ''}</i>` : ''}
          <div class="reparo-motivo">${esc(p.motivo)}</div>
        </div>`).join('')}
      ${r.perdidos.length > 15 ? `<p class="dz-nota">…e mais ${r.perdidos.length - 15}</p>` : ''}
    </div>` : ''

  saida.innerHTML = `
    <ul class="cost-bullets">${linhas.map(l => `<li>${l}</li>`).join('')}</ul>
    ${perdidos}
    ${r.amostras.length ? `<div class="reparo-amostras">
      <p class="dz-nota">Como fica (${pl(r.amostras.length, 'exemplo', 'exemplos')}):</p>
      ${r.amostras.map(a => `
        <div class="reparo-amostra">
          <b>${esc(a.palavra)}</b>${a.ocorrencias > 1 ? `<i> · ${a.ocorrencias}× no capítulo</i>` : ''}
          <div class="reparo-antes">${esc(a.antes)}…</div>
          <div class="reparo-depois">${esc(a.depois)}</div>
        </div>`).join('')}
    </div>` : ''}
    ${r.consertados ? `<button class="btn btn-primary btn-sm" onclick="repararContexto(false)">${
      ic('check','ic-sm')} Reparar ${pl(r.consertados, 'item', 'itens')}</button>` : ''}`
}

function _devolverContagem() {
  let itens = 0, sentidos = 0, cards = 0
  if (!Array.isArray(words)) return { itens, sentidos, cards }
  for (const w of words) {
    if (w.status === 'skipped') continue
    const alvos = sentidosDe(w).filter(m => ['estudo','revisao'].includes(sentidoEstado(m)))
    if (!alvos.length) continue
    itens++
    sentidos += alvos.length
    cards += alvos.reduce((s, m) => s + cardsDoSentido(w, m).length, 0)
  }
  return { itens, sentidos, cards }
}

async function devolverTudoParaPreparar() {
  if (typeof desfazerSentido !== 'function') { toast('Recarregue a página e tente de novo', 'warning'); return }
  const c = _devolverContagem()
  if (!c.sentidos) { toast('Nada para devolver — Estudar e Revisar já estão vazios', 'info'); return }
  const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`
  const ok = await confirmModal({
    title: 'Devolver tudo ao Preparar', icon: 'refresh', danger: true, confirmText: 'Devolver tudo',
    html: `<ul class="cost-bullets danger">
        <li>${pl(c.itens, 'item volta', 'itens voltam')} para a fila do Preparar (${pl(c.sentidos, 'sentido', 'sentidos')})</li>
        <li>${pl(c.cards, 'card sai', 'cards saem')} da Revisão — o progresso de revisão ${c.cards === 1 ? 'dele' : 'deles'} se perde</li>
        <li>Estudar e Revisar ficam vazios até você reenviar</li>
      </ul>
      <p class="cost-note">Nada do material da IA é apagado: significados, exemplos, áudios e imagens
      continuam onde estão. O que volta é a <b>posição no fluxo</b>.<br>
      <b>Sem volta.</b> Exporte o backup JSON (logo acima) antes, se houver dúvida.</p>`
  })
  if (!ok) return

  const mortos = new Set()
  let itens = 0, sentidos = 0
  for (const w of words) {
    if (w.status === 'skipped') continue
    let mexeu = false
    for (const m of sentidosDe(w)) {
      if (!['estudo','revisao'].includes(sentidoEstado(m))) continue
      cardsDoSentido(w, m).forEach(x => mortos.add(x.id))
      if (desfazerSentido(m)) { sentidos++; mexeu = true }
    }
    if (!mexeu) continue
    itens++
    delete w.enviadoEm
    delete w.estudadoEm
    sincronizarStatusItem(w)
    w.updated_at = new Date().toISOString()   // bump p/ vencer o merge do fbPull
  }
  if (mortos.size) { srsCards = srsCards.filter(x => !mortos.has(x.id)); saveSrsCards() }
  saveWords()

  // A sessão de revisão em curso apontaria para cards que não existem mais.
  if (typeof srsSession !== 'undefined' && srsSession && typeof endSrsSession === 'function') endSrsSession()

  // PUSH IMEDIATO, não o debounce de 1,2s: o merge do `fbPull` traz de volta
  // todo card que ainda estiver na nuvem (`if (!local) return cc`). Apagar
  // centenas e deixar a janela aberta seria pedir para eles ressuscitarem.
  if (typeof fbPushData === 'function' && typeof _fbUser !== 'undefined' && _fbUser) {
    try { await fbPushData() } catch (e) { console.error(e) }
  }

  ;['updateDossieBadge','updateSrsBadge','renderSidebar','renderDashboard','fillSettings']
    .forEach(f => { if (typeof window[f] === 'function') { try { window[f]() } catch (e) {} } })
  if (typeof renderReview === 'function') renderReview()
  toast(`${pl(itens, 'item voltou', 'itens voltaram')} para o Preparar${
    mortos.size ? ` · ${pl(mortos.size, 'card removido', 'cards removidos')}` : ''}`, 'success')
}

async function clearAllData() {
  const loggedIn = !!(typeof _fbUser !== 'undefined' && _fbUser)
  const itens = ['Palavras, revisões e o acervo (livros, audiolivros, vídeos)',
    'Cards SRS e progresso de estudo', 'Áudios, imagens e análises geradas', 'Configurações']
  if (loggedIn) itens.push('TUDO na nuvem (Firebase) — propaga para os outros aparelhos')
  if (!(await confirmModal({ title: 'Apagar todos os dados', icon: 'alert', danger: true, confirmText: 'Apagar tudo',
    html: `<ul class="cost-bullets danger">${itens.map(x => `<li>${x}</li>`).join('')}</ul>
      <p class="cost-note"><b>Esta ação é irreversível.</b> Faça um backup antes (Exportar JSON, logo acima).</p>` }))) return

  // ⚠️ O LISTENER SAI DE CENA PRIMEIRO (rodada 44): apagar a nuvem dispara um
  // snapshot por documento removido, e aplicá-los no meio da limpeza seria
  // trabalho inútil na melhor hipótese e corrida na pior.
  if (loggedIn && typeof detachRealtimeSync === 'function') { try { detachRealtimeSync() } catch (e) {} }

  // 1) localStorage — POR PREFIXO, não por lista (rodada 44). A lista de
  // chaves soltas ficava para trás a cada recurso novo ('el-known',
  // 'el-obras-nome', o censo…) e o "zerado" nunca era zerado de verdade.
  // Tudo que o app grava começa com 'el-' ou 'englab'.
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('el-') || k.startsWith('englab')) { try { localStorage.removeItem(k) } catch (e) {} }
  }

  // 2) IndexedDB — áudio, imagens, cards e backup de configurações
  try { await AudioDB.setAll({}) } catch {}
  try { await ImageDB.setAll({}) } catch {}
  try { await CardsDB.clear() } catch {}
  try { await SettingsDB.set('cfg', {}) } catch {}

  // 2b) AS BASES INTEIRAS que ficavam de fora — e eram as mais pesadas:
  // `english-lab-books` guarda os EPUB da estante e as pré-análises de
  // capítulo; `el-video-db` guarda legendas, áudio consertado e o mp3 dos
  // podcasts baixados. Sem isto, "apagar tudo" deixava os livros e os
  // episódios no aparelho, e o app voltava com uma estante órfã.
  for (const base of ['english-lab-books', 'el-video-db']) {
    await new Promise(resolve => {
      let pronto = false
      const fim = () => { if (!pronto) { pronto = true; resolve() } }
      try {
        const req = indexedDB.deleteDatabase(base)
        req.onsuccess = fim; req.onerror = fim
        // `onblocked` acontece quando outra aba tem a base aberta. Não trava a
        // limpeza por isso: o recarregamento no fim conclui o serviço.
        req.onblocked = fim
      } catch { fim() }
      setTimeout(fim, 1500)
    })
  }

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
  if (typeof knownSenses !== 'undefined') knownSenses = {}
  if (typeof unmarks     !== 'undefined') unmarks     = {}
  if (typeof livros      !== 'undefined') livros      = []
  if (typeof audiolivros !== 'undefined') audiolivros = []
  if (typeof obrasNome   !== 'undefined') obrasNome   = {}
  srsDecks = (typeof DEFAULT_DECKS !== 'undefined') ? JSON.parse(JSON.stringify(DEFAULT_DECKS)) : []
  cfg = { ...DEF_CFG }
  srsCfg = { ...SRS_DEF_CFG }
  _audioKeyCache = null; _imageKeyCache = null
  if (typeof srsSession !== 'undefined') srsSession = null

  // 4) Zera a NUVEM de verdade (rodada 44). Antes este passo chamava
  //    `fbPushData` esperando gravar listas vazias — mas o push MESCLA com a
  //    nuvem antes de escrever: local vazio + nuvem cheia = a nuvem inteira
  //    re-enviada intacta, e o recarregamento trazia tudo de volta. Ele saía
  //    achando que limpou — a pior forma de errar. `fbWipeCloud` apaga os
  //    documentos (data + gerado + mídia) e os arquivos do Storage.
  if (loggedIn) {
    toast('Zerando a nuvem em todos os dispositivos...', 'info')
    let nuvemOk = false
    try { if (typeof fbWipeCloud === 'function') nuvemOk = await fbWipeCloud() } catch {}
    if (!nuvemOk) {
      toast('Não consegui apagar a nuvem — o local foi zerado, mas a conta ainda tem os dados. Tente de novo com internet.', 'error')
    }
  }

  renderDashboard()
  fillSettings()
  updateSrsBadge()
  toast(loggedIn ? 'Tudo zerado — local e nuvem, em todos os dispositivos.' : 'Tudo zerado neste aparelho.', 'success')
  // RECARREGA de propósito. Zerar deixa muita coisa viva na memória que não é
  // estado de dados: índice do glossário, caches de áudio/imagem, o livro
  // aberto no leitor, a pré-análise do capítulo, o handle do arquivo de vídeo.
  // Começar do zero de verdade é começar do boot.
  setTimeout(() => location.reload(), 1200)
}

// O interruptor do "completar sozinho" (2026-08-20). Ligado por padrão: foi
// pedido assim. Fica em Configurações porque é comportamento que roda sem
// pedir licença, e coisa que age sozinha precisa ter onde ser desligada.
function cfgAutoMeta(ligado) {
  cfg.autoMeta = !!ligado
  saveCfg()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast(ligado ? 'Vou completar os dados ao importar' : 'Não vou mais buscar dados sozinho', 'info')
}

// O desempate por IA (2026-08-22). Ligado por padrão, mas ele só dispara
// quando os dois primeiros resultados do catálogo empatam — busca fácil não
// paga pedágio nenhum.
function cfgCatalogoIA(ligado) {
  cfg.catalogoIA = !!ligado
  saveCfg()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast(ligado ? 'A IA vai desempatar quando o catálogo empatar' : 'Só o catálogo decide agora', 'info')
}

// ⚠️ A CHAVE DO GOOGLE BOOKS NÃO É SEGREDO NO SENTIDO USUAL — ela viaja no
// endereço da requisição e qualquer um que abra o app a vê. É assim por
// desenho: a proteção dela não é esconder, é PRENDER AO SITE (Google Cloud →
// Credenciais → Restrições de aplicativo → Sites). Sem restrição, ela funciona
// igual, mas a cota é de quem a copiar.
function cfgGoogleBooksKey(valor) {
  cfg.googleBooksKey = String(valor || '').trim()
  saveCfg()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  const s = el('cfg-gbooks-status')
  if (s) s.textContent = cfg.googleBooksKey ? 'Chave guardada. Clique em Testar para confirmar.' : 'Sem chave — a busca usa a cota compartilhada.'
}

// ⚠️ HOUVE UM BOTÃO "USAR A DO GEMINI" AQUI, E O TESTE AO VIVO O DERRUBOU.
// A ideia era reaproveitar a chave que ele já tem — as duas são `AIza…`. Só
// que a chave do Gemini dele nasceu no **AI Studio**, e a Books API a recusa
// com 401 *"API keys are not supported by this API"*. Um botão que promete
// atalho e entrega erro é pior que nenhum botão.
// Chave do Books tem de vir de um projeto do Google Cloud com a Books API
// habilitada — o texto ao lado do campo diz o caminho.

// Testar é obrigatório aqui, não zelo: a chave pode estar certa e a Books API
// desligada no projeto, e o sintoma disso (403) é idêntico ao de chave errada.
// Melhor descobrir neste botão do que numa busca de livro.
async function cfgGoogleBooksTestar() {
  const s = el('cfg-gbooks-status')
  const k = (el('cfg-gbooks-key')?.value || '').trim()
  if (s) { s.style.color = 'var(--text3)'; s.textContent = 'Testando…' }
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=hobbit&maxResults=1${k ? `&key=${encodeURIComponent(k)}` : ''}`
    const r = await fetch(url)
    const j = await r.json().catch(() => ({}))
    const msg = (j.error && j.error.message) || ''
    if (r.ok) {
      if (s) { s.style.color = 'var(--success, var(--text2))'; s.textContent = k ? 'Funcionou — a busca de livros agora usa a sua cota.' : 'Funcionou, mas sem chave: hoje a cota compartilhada respondeu; amanhã pode não responder.' }
    } else if (r.status === 429) {
      if (s) { s.style.color = 'var(--error)'; s.textContent = k ? 'Cota do dia estourada NESTA chave.' : 'Cota compartilhada estourada — é exatamente para isso que serve a chave.' }
    } else if (/not been used|disabled|is not enabled|not supported by this API/i.test(msg)) {
      // ⚠️ MEDIDO COM A CHAVE DELE: a chave do Gemini feita no AI Studio
      // devolve 401 "API keys are not supported by this API". A mensagem é
      // enganosa — o problema não é o formato da chave, é que a Books API não
      // está habilitada no projeto dela. Dizer isso poupa uma hora de busca.
      if (s) { s.style.color = 'var(--error)'; s.textContent = 'Essa chave não vale para a Books API — falta habilitá-la no projeto. No Google Cloud: APIs e serviços → Ativar API → "Books API", e depois Credenciais → Criar chave de API.' }
    } else {
      if (s) { s.style.color = 'var(--error)'; s.textContent = `Recusada (${r.status}). ${msg.slice(0, 120)}` }
    }
  } catch (e) {
    if (s) { s.style.color = 'var(--error)'; s.textContent = 'Não consegui falar com o Google (sem internet?).' }
  }
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
