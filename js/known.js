// ================================================================
// PALAVRAS — gerenciador de vocabulário (estilo Language Reactor)
// CARREGADO LAZY. O estado (knownWords/ignoredWords) vive em core.js
// porque firebase.js sincroniza os dois (armadilha nº 1).
//
// A ideia: em vez de uma lista genérica de "palavras mais comuns do
// inglês", o inventário sai do SEU material — legendas dos episódios
// abertos + contextos capturados. A frequência é a do que você assiste.
// ================================================================

let _knFiltro = { conhecidas: true, estudando: true, sugestoes: true, ignoradas: false }
let _knBusca = ''
let _knOrdem = 'freq'          // freq | alfa | nivel
let _knLimite = 300            // paginação leve (o grid pode ter milhares)
let _knInventario = null       // cache do levantamento [{w, freq, status, ex}]
let _knCarregando = false

// Palavras funcionais: aparecem sempre e não são objeto de estudo.
const _KN_STOP = new Set(('a an the and or but if of to in on at by for with from as is are was were be been being ' +
  'do does did done have has had having will would can could shall should may might must i you he she it we they ' +
  'me him her us them my your his its our their this that these those there here what who whom whose which when ' +
  'where why how not no yes so than then too very just only also about into over under out up down off again ' +
  'am s t re ve ll d m o').split(' '))

// ---------------------------------------------------------------
// LEVANTAMENTO — varre legendas (VideoDB), palavras em estudo e cards
// ---------------------------------------------------------------
async function _knLevantar() {
  const freq = {}, exemplo = {}
  const add = (tok, frase) => {
    if (!tok || tok.length < 3 || _KN_STOP.has(tok)) return
    freq[tok] = (freq[tok] || 0) + 1
    if (!exemplo[tok] && frase) exemplo[tok] = frase
  }
  // 1) Legendas dos vídeos/podcasts abertos — a fonte mais rica
  try {
    if (typeof VideoDB === 'object' && Array.isArray(videos)) {
      for (const v of videos) {
        const st = await VideoDB.get('subs', v.id)
        for (const c of ((st && st.cues) || [])) {
          const t = String(c.t || '')
          for (const raw of (t.toLowerCase().match(/[\p{L}']+/gu) || [])) add(raw.replace(/^'+|'+$/g, ''), t)
        }
      }
    }
  } catch (e) { console.warn('[palavras] legendas:', e.message) }
  // 2) Contextos capturados (Preparar/Kindle/mídia)
  for (const w of words) {
    const t = String(w.context || '')
    for (const raw of (t.toLowerCase().match(/[\p{L}']+/gu) || [])) add(raw.replace(/^'+|'+$/g, ''), t)
  }
  // 3) Frases dos cards já criados
  for (const c of srsCards) {
    const t = String(c.example_en || '').replace(/<\/?b>/g, '')
    for (const raw of (t.toLowerCase().match(/[\p{L}']+/gu) || [])) add(raw.replace(/^'+|'+$/g, ''), t)
  }
  // Palavras em estudo entram mesmo sem aparecer em texto nenhum
  for (const w of words) {
    const k = knownNorm(w.word)
    if (k && !freq[k]) { freq[k] = 0; exemplo[k] = w.context || '' }
  }
  // E as já marcadas como conhecidas/ignoradas continuam listáveis
  for (const k of [...Object.keys(knownWords), ...Object.keys(ignoredWords)]) {
    if (k && !(k in freq)) freq[k] = 0
  }
  const emEstudo = new Set(words.map(w => knownNorm(w.word)).filter(Boolean))
  return Object.keys(freq).map(w => ({
    w, freq: freq[w], ex: exemplo[w] || '',
    status: ignoredWords[w] ? 'ignoradas'
      : emEstudo.has(w) ? 'estudando'
      : isKnownWord(w) ? 'conhecidas'
      : 'sugestoes'
  })).sort((a, b) => b.freq - a.freq || a.w.localeCompare(b.w))
}

// ---------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------
async function renderKnownSection() {
  const area = el('palavras-area'); if (!area) return
  if (!_knInventario && !_knCarregando) {
    _knCarregando = true
    area.innerHTML = `<div class="kn-loading"><span class="gen-spinner"></span> levantando seu vocabulário…</div>`
    _knInventario = await _knLevantar()
    _knCarregando = false
  }
  if (!_knInventario) return
  _knPintar()
}

function _knPintar() {
  const area = el('palavras-area'); if (!area || !_knInventario) return
  const inv = _knInventario
  const cont = { conhecidas: 0, estudando: 0, sugestoes: 0, ignoradas: 0 }
  inv.forEach(it => cont[it.status]++)
  const busca = _knBusca.trim().toLowerCase()
  let lista = inv.filter(it => _knFiltro[it.status] && (!busca || it.w.includes(busca)))
  if (_knOrdem === 'alfa') lista = [...lista].sort((a, b) => a.w.localeCompare(b.w))
  const total = lista.length
  const visiveis = lista.slice(0, _knLimite)
  const pct = inv.length ? Math.round((cont.conhecidas + cont.estudando) / inv.length * 100) : 0

  const FIL = [
    ['conhecidas', 'Conhecidas', 'k'],
    ['estudando', 'Em estudo', 'e'],
    ['sugestoes', 'Sugestões', 's'],
    ['ignoradas', 'Não aprender', 'i']
  ]
  area.innerHTML = `
    <div class="kn-top">
      <div class="kn-gauge" data-tip="Do vocabulário que aparece no seu material, quanto você já domina ou está estudando">
        <div class="kn-gauge-bar"><i style="width:${pct}%"></i></div>
        <div class="kn-gauge-lbl"><b>${pct}%</b> do seu material já é seu · ${inv.length} palavras no inventário</div>
      </div>
      <div class="kn-filters">
        ${FIL.map(([id, lbl, cls]) => `
          <button class="kn-fil ${cls}${_knFiltro[id] ? ' on' : ''}" onclick="knToggleFiltro('${id}')">
            <span class="kn-fil-dot"></span>${lbl}<span class="kn-fil-n">${cont[id]}</span>
          </button>`).join('')}
      </div>
      <div class="kn-tools">
        <input class="kn-search" type="search" placeholder="Buscar palavra..." value="${escA(_knBusca)}"
          oninput="knBuscar(this.value)">
        <select class="kn-ord" onchange="knOrdenar(this.value)">
          <option value="freq"${_knOrdem === 'freq' ? ' selected' : ''}>Mais frequentes primeiro</option>
          <option value="alfa"${_knOrdem === 'alfa' ? ' selected' : ''}>Ordem alfabética</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="knRecarregar()" data-tip="Varrer de novo as legendas e contextos">${ic('refresh','ic-sm')}Atualizar</button>
      </div>
    </div>

    <div class="kn-hint">
      Clique para marcar como <b>conhecida</b>. Nos botões do canto: mandar para estudo ou nunca mais sugerir.
      ${_knFiltro.sugestoes && cont.sugestoes ? `<button class="kn-bulk" onclick="knMarcarVisiveis()">Marcar as ${Math.min(visiveis.filter(v => v.status === 'sugestoes').length, 999)} sugestões visíveis como conhecidas</button>` : ''}
    </div>

    ${total ? `<div class="kn-grid">
      ${visiveis.map(it => `
        <div class="kn-chip ${it.status}" onclick="knToggleConhecida('${escA(it.w)}')" data-tip="${escA(it.ex ? it.ex.slice(0, 120) : '')}">
          <span class="kn-w">${esc(it.w)}</span>
          ${it.freq ? `<span class="kn-f">${it.freq}</span>` : ''}
          <span class="kn-acts">
            <button onclick="event.stopPropagation();knEstudar('${escA(it.w)}')" data-tip="Mandar para o Preparar (a IA analisa)">${ic('arrowRight','ic-sm')}</button>
            <button onclick="event.stopPropagation();knIgnorar('${escA(it.w)}')" data-tip="Nunca mais sugerir">${ic('x','ic-sm')}</button>
          </span>
        </div>`).join('')}
    </div>
    ${total > _knLimite ? `<button class="btn btn-ghost btn-sm kn-more" onclick="knMais()">Mostrar mais (${total - _knLimite} restantes)</button>` : ''}`
    : `<div class="kn-empty">${ic('search','ic-lg')}<p>Nada aqui com esses filtros.</p>
       <p class="kn-empty-sub">Abra um episódio com legenda no módulo Vídeo — o inventário se monta sozinho a partir do que você assiste.</p></div>`}
  `
}

// ---------------------------------------------------------------
// AÇÕES
// ---------------------------------------------------------------
function _knAtualizaItem(w, status) {
  const it = _knInventario && _knInventario.find(x => x.w === w)
  if (it) it.status = status
  _knPintar()
}

function knToggleConhecida(w) {
  const it = _knInventario.find(x => x.w === w); if (!it) return
  if (it.status === 'estudando') { toast('Esta palavra está em estudo — termine o card ou remova na Biblioteca', 'info'); return }
  if (it.status === 'conhecidas') { markKnownWord(w, false); _knAtualizaItem(w, 'sugestoes') }
  else {
    if (it.status === 'ignoradas') markIgnoredWord(w, false)
    markKnownWord(w, true); _knAtualizaItem(w, 'conhecidas')
  }
}

function knIgnorar(w) {
  const it = _knInventario.find(x => x.w === w); if (!it) return
  if (it.status === 'ignoradas') { markIgnoredWord(w, false); _knAtualizaItem(w, 'sugestoes'); return }
  markKnownWord(w, false); markIgnoredWord(w, true)
  _knAtualizaItem(w, 'ignoradas')
}

function knEstudar(w) {
  const it = _knInventario.find(x => x.w === w); if (!it) return
  if (it.status === 'estudando') { showSection('preparar'); return }
  markKnownWord(w, false); markIgnoredWord(w, false)
  createWord({ word: w, context: it.ex || '', source_type: 'manual', source_title: 'Palavras', lang: activeLang() })
  saveWords(); renderSidebar(); renderDashboard()
  toast(`"${w}" foi para o Preparar`, 'success')
  _knAtualizaItem(w, 'estudando')
}

// Varredura rápida: o grande ganho de tempo do Language Reactor é poder
// dizer "essas 300 primeiras eu já sei" de uma vez.
async function knMarcarVisiveis() {
  const busca = _knBusca.trim().toLowerCase()
  let lista = _knInventario.filter(it => _knFiltro[it.status] && (!busca || it.w.includes(busca)))
  if (_knOrdem === 'alfa') lista = [...lista].sort((a, b) => a.w.localeCompare(b.w))
  const alvos = lista.slice(0, _knLimite).filter(it => it.status === 'sugestoes')
  if (!alvos.length) return
  if (!(await confirmModal({ title: 'Marcar como conhecidas', icon: 'checkCircle',
    confirmText: `Marcar ${alvos.length}`,
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">As <b>${alvos.length}</b> sugestões visíveis passam a contar como vocabulário seu.
      Isso melhora a cobertura dos episódios e tira essas palavras das próximas triagens. Dá para desfazer clicando de novo em cada uma.</p>` }))) return
  alvos.forEach(it => { knownWords[knownNorm(it.w)] = Date.now(); it.status = 'conhecidas' })
  saveKnownLocal(); autoSyncAfterChange()
  _knPintar()
  toast(`${alvos.length} palavras marcadas como conhecidas`, 'success')
}

function knToggleFiltro(id) { _knFiltro[id] = !_knFiltro[id]; _knLimite = 300; _knPintar() }
function knBuscar(v) { _knBusca = v; _knLimite = 300; _knPintar() }
function knOrdenar(v) { _knOrdem = v; _knPintar() }
function knMais() { _knLimite += 500; _knPintar() }
async function knRecarregar() { _knInventario = null; await renderKnownSection() }
