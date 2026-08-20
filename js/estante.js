// ================================================================
// ESTANTE — o gerenciador do acervo de livros
// ================================================================
// Por que existir: a seção Ler nasceu como leitor, e a estante era só a porta
// de entrada dele (capa, título, barra de progresso, X para remover). Isso
// serve para ABRIR um livro; não serve para GERENCIAR uma biblioteca — não
// dava para procurar, filtrar, saber o que já foi lido, quanto se lê por dia,
// nem registrar o livro de papel que não tem arquivo nenhum.
//
// A base é o `gerenciador-de-livros` que ele mesmo escreveu (GitHub, 2025):
// status quero/lendo/lido, registro diário de páginas, calendário, meta
// diária e anual, cadastro por ISBN. O que aquele app fazia à mão, aqui o
// leitor faz sozinho quando o livro tem arquivo — e o que ele não tinha
// (destaques, capturas que viraram card) sai de graça, porque o vocabulário
// já mora neste mesmo app.
//
// AS QUATRO TELAS, todas dentro de `#ler-area`:
//   estante  — grade/lista, busca, filtro por status e tipo, ordenação
//   ficha    — um livro por inteiro: dados, progresso, capturas, notas
//   form     — cadastrar/editar (com busca no Google Books por ISBN/título)
//   painel   — leitura em números: calendário, sequência, metas, ritmo
//
// ⚠️ LAZY: carrega no pacote da seção `ler`. Nada aqui pode ser chamado por
// arquivo não-lazy (armadilha nº 1 do projeto). O ESTADO (`livros`,
// `saveLivros`) mora no core justamente por isso.
//
// ⚠️ O ARQUIVO NÃO É O LIVRO. Um item da estante pode ser:
//   kind:'arquivo' — epub/cbz/txt no BookDB; o progresso é medido pelo leitor
//   kind:'fisico'  — papel ou e-book de fora; o progresso é digitado
// Todo cálculo daqui atravessa `estPct()`/`estPaginas()`, que sabem a
// diferença. Nunca leia `l.progress` direto numa tela nova.
// ================================================================
'use strict'

// Páginas "equivalentes" para quem não tem página. É o que deixa o calendário
// somar EPUB e papel na mesma conta — sem isto, a meta diária só valeria para
// metade da estante.
//
// ⚠️ O NÚMERO FOI AFERIDO, não chutado: o EPUB de "Billy Summers" tem 164.394
// palavras e a edição impressa, 528 páginas — 311 palavras por página. Com os
// 250 do manuscrito padrão o app dizia 658 páginas, 25% a mais que o livro de
// verdade. 300 erra por 4%. Continua sendo estimativa, e a ficha diz isso com
// todas as letras.
const EST_PALAVRAS_POR_PAGINA = 300

const EST_STATUS = {
  quero:  { rotulo: 'Quero ler', cor: 'var(--role-fonte)' },
  lendo:  { rotulo: 'Lendo',     cor: 'var(--role-energia)' },
  lido:   { rotulo: 'Lido',      cor: 'var(--role-dominio)' },
  parado: { rotulo: 'Parado',    cor: 'var(--text3)' }
}

const EST_GENEROS = [
  'Ação','Autoajuda','Aventura','Biografia','Ciência','Conto','Crônica','Distopia','Drama',
  'Fantasia','Ficção científica','Ficção histórica','História','Humor','Infantil','Mistério',
  'Negócios','Poesia','Policial','Religião','Romance','Suspense','Tecnologia','Terror','Viagem'
]

// ---- estado só de tela (nada disto é persistido no acervo) ----
let _estVista = 'estante'      // estante | ficha | form | painel
let _estId = null              // livro da ficha / edição
let _estAba = 'sobre'          // aba da ficha
let _estBusca = ''
let _estStatus = 'todos'
let _estTipo = 'todos'
let _estGB = []                // resultados do Google Books
let _estGBerro = ''
const _estHoje = new Date()
let _estMes = _estHoje.getMonth()
let _estAno = _estHoje.getFullYear()

// Vista e ordenação são preferência DO APARELHO (a tela do celular pede lista,
// a do notebook pede grade), então ficam no localStorage de interface e não
// no acervo sincronizado.
function estPref(k, def) { const v = loadUiPrefs()['est_' + k]; return v === undefined ? def : v }
function estSetPref(k, v) { saveUiPref('est_' + k, v) }

// ================================================================
// MODELO — migração, medidas e o registro diário
// ================================================================
// O acervo já existia com outro formato. A migração é silenciosa e roda a
// cada render: livro antigo ganha status/histórico derivados do que já se
// sabia dele, sem apagar nada e sem pedir nada ao usuário.
function estMigrar() {
  let mudou = false
  for (const l of livros) {
    if (!l.kind) { l.kind = l.format === 'fisico' ? 'fisico' : 'arquivo'; mudou = true }
    if (!l.status) {
      const p = estPct(l)
      l.status = p >= 0.995 ? 'lido' : (p > 0 ? 'lendo' : 'quero')
      mudou = true
    }
    if (!Array.isArray(l.historico)) { l.historico = []; mudou = true }
    if (!Array.isArray(l.tags)) { l.tags = []; mudou = true }
    if (l.nota === undefined) { l.nota = 0; mudou = true }
  }
  if (mudou) saveLivros()
}

function estPaginas(l) {
  if (!l) return 0
  if (l.paginas > 0) return l.paginas
  if (l.totalWords > 0) return Math.max(1, Math.round(l.totalWords / EST_PALAVRAS_POR_PAGINA))
  if (l.format === 'manga') return (l.chapters || []).length || 0
  return 0
}
function estPaginasEstimadas(l) { return !(l && l.paginas > 0) }

function estPct(l) {
  if (!l) return 0
  if (l.kind === 'fisico') {
    const t = estPaginas(l)
    return t ? Math.max(0, Math.min(1, (l.pagAtual || 0) / t)) : 0
  }
  return Math.max(0, Math.min(1, l.progress || 0))
}

// Data local em ISO. `toISOString()` cru devolve UTC e, à noite, carimbaria a
// leitura no dia seguinte — o calendário mostraria um dia que não existiu.
function estData(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// UMA entrada por dia por livro, atualizada. O `delta` é medido contra o fim
// do último dia ANTERIOR — assim reabrir o livro cinco vezes no mesmo dia não
// vira cinco avanços, e o total do dia continua verdadeiro.
// ⚠️ `semCredito` existe porque nem todo salto de progresso é leitura DAQUELE
// dia. Marcar um livro antigo como "lido", ou cadastrar dizendo "estou na
// página 120", movia o progresso — e o calendário passava a exibir 352
// páginas num dia em que ninguém leu nada. A posição avança; o crédito do dia
// não. Leitura de verdade (o leitor, ou o registro manual de progresso)
// continua creditando normalmente.
function estRegistrar(l, pct, dia, semCredito) {
  const d = dia || estData()
  l.historico = l.historico || []
  const antes = l.historico.filter(h => h.d < d)
  const base = antes.length ? antes[antes.length - 1].pct : 0
  const pgs = estPaginas(l)
  const delta = semCredito ? 0 : Math.max(0, pct - base)
  // ⚠️ ARREDONDADO E COM TETO por causa do teto de 1 MB do documento no
  // Firestore: o histórico sincroniza junto com o resto do acervo. Fração
  // crua (0.5683333333333331) custa 20 bytes por linha sem dizer nada a mais
  // que 0.5683, e 400 dias de leitura no MESMO livro já é mais que qualquer
  // leitura real — quem chega lá perde o começo, não a estante inteira.
  const reg = {
    d, pct: Math.round(pct * 1e4) / 1e4, delta: Math.round(delta * 1e4) / 1e4,
    pag: Math.round(pct * pgs), deltaPag: Math.round(delta * pgs),
    ts: Date.now()
  }
  const ja = l.historico.find(h => h.d === d)
  if (ja) Object.assign(ja, reg)
  else l.historico.push(reg)
  l.historico.sort((a, b) => (a.d < b.d ? -1 : 1))
  if (l.historico.length > 400) l.historico = l.historico.slice(-400)
  l.updatedAt = Date.now()
}

// Status que se cuida sozinho: quem lê passa de "quero" para "lendo", e quem
// chega ao fim vira "lido" com a data. "Parado" é decisão humana e por isso
// NÃO é sobrescrito aqui — só o próprio usuário tira o livro de parado.
function estStatusAuto(l, pct, dia) {
  const d = dia || estData()
  if (pct >= 0.995) {
    l.status = 'lido'
    l.fim = l.fim || d
    l.anoFim = Number(String(l.fim).slice(0, 4))
    if (!l.inicio) l.inicio = d
  } else if (pct > 0) {
    if (l.status !== 'parado') l.status = 'lendo'
    if (!l.inicio) l.inicio = d
    l.fim = null; l.anoFim = null
  }
}

// PONTE COM O LEITOR. Chamada por `ler.js` toda vez que a posição é gravada:
// é o que faz a estatística existir sem ninguém digitar nada. O filtro de
// ruído evita gravar um avanço de 0,1% só porque a página foi remedida.
function estanteMarcarAvanco(l) {
  if (!l || l.kind === 'fisico') return
  const pct = estPct(l), d = estData()
  const hoje = (l.historico || []).find(h => h.d === d)
  if (hoje && Math.abs(hoje.pct - pct) < 0.002) return
  estRegistrar(l, pct, d)
  estStatusAuto(l, pct, d)
}

// Abrir o livro já conta como começar a ler — senão o item ficaria em "quero
// ler" para sempre em quem lê pouco por sessão.
function estanteAoAbrir(l) {
  if (!l) return
  l.lastOpen = Date.now()
  if (l.status === 'quero' || !l.status) { l.status = 'lendo'; l.inicio = l.inicio || estData() }
  saveLivros()
}

// ---- as configurações do acervo (metas) moram na cfg, que sincroniza ----
const EST_CFG_DEF = { metaPag: 20, metaLivros: 12 }
function estCfg() { return { ...EST_CFG_DEF, ...(cfg.estante || {}) } }
function estSetCfg(k, v) {
  cfg.estante = { ...estCfg(), [k]: v }
  saveCfg()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}

function estSalvar() {
  saveLivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}

// ================================================================
// RAIZ — quem decide qual das quatro telas aparece
// ================================================================
function estanteRender() {
  estMigrar()
  const area = el('ler-area'); if (!area) return
  const acoes = el('ler-ph-actions')
  if (acoes) acoes.innerHTML = _estAcoesHTML()
  if (_estVista === 'ficha')  return _estRenderFicha()
  if (_estVista === 'form')   return _estRenderForm()
  if (_estVista === 'painel') return _estRenderPainel()
  _estRenderEstante()
}

function _estAcoesHTML() {
  if (_estVista !== 'estante') {
    return `<button class="btn btn-ghost btn-sm" onclick="estIr('estante')">${ic('chevronLeft','ic-sm')} Estante</button>`
  }
  if (!livros.length) return ''
  return `
    <button class="btn btn-ghost btn-sm" onclick="estIr('painel')" data-tip="Calendário, metas e ritmo de leitura">${ic('chart','ic-sm')} Leitura em números</button>
    <button class="btn btn-ghost btn-sm" onclick="estNovoManual()" data-tip="Livro de papel ou sem arquivo">${ic('plus','ic-sm')} Cadastrar livro</button>
    <button class="btn btn-primary btn-sm" onclick="lerEscolherArquivo()">${ic('upload','ic-sm')} Importar arquivo</button>`
}

function estIr(vista, id) {
  _estVista = vista
  if (id !== undefined) _estId = id
  if (vista === 'ficha') _estAba = 'sobre'
  estanteRender()
  const area = el('ler-area'); if (area) area.scrollIntoView({ block: 'start' })
}

// ================================================================
// TELA 1 — A ESTANTE
// ================================================================
function _estRenderEstante() {
  const area = el('ler-area')
  if (!livros.length) { area.innerHTML = _estVazioHTML(); return }

  const visual = estPref('visual', 'grade')
  const ordem = estPref('ordem', 'recentes')
  const lista = _estFiltrar()
  const contas = _estContagens()

  const abas = ['todos', 'lendo', 'quero', 'lido', 'parado'].map(s => {
    const rot = s === 'todos' ? 'Todos' : EST_STATUS[s].rotulo
    const n = contas[s] || 0
    return `<button class="est-aba${_estStatus === s ? ' on' : ''}" onclick="estSetStatus('${s}')">
      ${rot}${n ? `<span class="est-aba-n">${n}</span>` : ''}</button>`
  }).join('')

  const tipos = [['todos','Todos'],['epub','EPUB'],['manga','Mangá'],['fisico','Físico'],['txt','Texto']]
    .filter(([v]) => v === 'todos' || contas.tipo[v])
    .map(([v, r]) => `<button class="est-chip${_estTipo === v ? ' on' : ''}" onclick="estSetTipo('${v}')">${r}</button>`).join('')

  area.innerHTML = `
    <div class="est-barra">
      <div class="est-busca">
        ${ic('search','ic-sm')}
        <input type="text" id="est-busca" placeholder="Buscar por título, autor, série ou etiqueta"
               value="${escA(_estBusca)}" oninput="estBuscar(this.value)" aria-label="Buscar na estante">
        ${_estBusca ? `<button class="est-busca-x" onclick="estBuscar('')" aria-label="Limpar busca">${ic('x','ic-sm')}</button>` : ''}
      </div>
      <div class="est-barra-dir">
        <select class="est-select" aria-label="Ordenar" onchange="estSetOrdem(this.value)">
          ${[['recentes','Abertos por último'],['titulo','Título (A–Z)'],['autor','Autor (A–Z)'],
             ['progresso','Mais adiantados'],['nota','Melhor nota'],['novos','Adicionados por último']]
            .map(([v,r]) => `<option value="${v}"${ordem === v ? ' selected' : ''}>${r}</option>`).join('')}
        </select>
        <div class="est-visual">
          <button class="${visual === 'grade' ? 'on' : ''}" onclick="estSetVisual('grade')" data-tip="Grade" aria-label="Ver em grade">${ic('grid','ic-sm')}</button>
          <button class="${visual === 'lista' ? 'on' : ''}" onclick="estSetVisual('lista')" data-tip="Lista" aria-label="Ver em lista">${ic('list','ic-sm')}</button>
        </div>
      </div>
    </div>
    <div class="est-filtros">
      <div class="est-abas">${abas}</div>
      ${tipos ? `<div class="est-chips">${tipos}</div>` : ''}
    </div>
    ${lista.length
      ? (visual === 'grade'
          ? `<div class="ler-estante">${lista.map(_estCard).join('')}</div>`
          : `<div class="est-lista">${lista.map(_estLinha).join('')}</div>`)
      : `<div class="est-nada">${ic('search','ic-lg')}<p>Nada aqui com esse filtro.</p>
         <button class="btn btn-ghost btn-sm" onclick="estLimparFiltros()">Limpar filtros</button></div>`}`
}

function _estVazioHTML() {
  return `
    <div class="upload-area ler-drop" id="ler-drop"
         ondragover="event.preventDefault();this.classList.add('drag')"
         ondragleave="this.classList.remove('drag')"
         ondrop="this.classList.remove('drag');lerImportar(event.dataTransfer.files)"
         onclick="lerEscolherArquivo()">
      <div class="upload-icon">${ic('book','ic-xl')}</div>
      <p><strong>Clique</strong> ou arraste um livro aqui</p>
      <p>.epub · .cbz (mangá) · .txt · .html — o arquivo fica neste aparelho, não sobe para a nuvem</p>
    </div>
    <div class="est-vazio-acoes">
      <button class="btn btn-ghost btn-sm" onclick="estNovoManual()">${ic('plus','ic-sm')} Cadastrar livro de papel</button>
      <button class="btn btn-ghost btn-sm" onclick="estImportarModal()">${ic('download','ic-sm')} Trazer de outro app</button>
      <button class="btn btn-ghost btn-sm" onclick="estanteDemo()">${ic('sparkles','ic-sm')} Ver com acervo de exemplo</button>
    </div>
    <div class="ler-vazio-dica">
      <b>De onde tirar livros em inglês, de graça e legalmente:</b>
      Project Gutenberg (domínio público, 70 mil títulos), Standard Ebooks (os mesmos
      clássicos, bem diagramados) e qualquer <i>.epub</i> que você já tenha comprado sem DRM.
    </div>`
}

function _estContagens() {
  const c = { todos: livros.length, tipo: {} }
  for (const l of livros) {
    c[l.status] = (c[l.status] || 0) + 1
    const t = l.kind === 'fisico' ? 'fisico' : (l.format || 'epub')
    c.tipo[t] = (c.tipo[t] || 0) + 1
  }
  return c
}

function _estFiltrar() {
  const q = _estBusca.trim().toLowerCase()
  const ordem = estPref('ordem', 'recentes')
  let lista = livros.filter(l => {
    if (_estStatus !== 'todos' && l.status !== _estStatus) return false
    if (_estTipo !== 'todos') {
      const t = l.kind === 'fisico' ? 'fisico' : (l.format || 'epub')
      if (t !== _estTipo) return false
    }
    if (!q) return true
    const alvo = [obraNome(l.title), l.author, l.serie, l.genero, l.editora, (l.tags || []).join(' ')]
      .join(' ').toLowerCase()
    return alvo.includes(q)
  })
  const nome = l => obraNome(l.title || '').toLowerCase()
  const cmp = {
    recentes:  (a, b) => (b.lastOpen || b.addedAt || 0) - (a.lastOpen || a.addedAt || 0),
    novos:     (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
    titulo:    (a, b) => nome(a).localeCompare(nome(b), 'pt'),
    autor:     (a, b) => String(a.author || 'zzz').localeCompare(String(b.author || 'zzz'), 'pt'),
    progresso: (a, b) => estPct(b) - estPct(a),
    nota:      (a, b) => (b.nota || 0) - (a.nota || 0)
  }
  return lista.sort(cmp[ordem] || cmp.recentes)
}

function _estSeloTipo(l) {
  if (l.kind === 'fisico') return `<span class="est-selo fisico">${ic('book','ic-3xs')} Físico</span>`
  if (l.format === 'manga') return `<span class="est-selo manga">Mangá</span>`
  return ''
}

function _estEstrelas(n, id) {
  const cheias = Math.round(n || 0)
  return `<span class="est-estrelas${id ? ' clic' : ''}">${[1,2,3,4,5].map(i =>
    `<i class="${i <= cheias ? 'on' : ''}"${id ? ` onclick="event.stopPropagation();estNota('${id}',${i === cheias ? 0 : i})" role="button" aria-label="${i} de 5"` : ''}>${ic('star','ic-3xs' + (i <= cheias ? ' ic-fill' : ''))}</i>`
  ).join('')}</span>`
}

function _estCard(l) {
  const pct = Math.round(estPct(l) * 100)
  const capa = _estCapaHTML(l)
  const temArquivo = l.kind !== 'fisico'
  return `
    <div class="ler-card est-card" onclick="${temArquivo ? `lerAbrir('${l.id}')` : `estIr('ficha','${l.id}')`}"
         data-tip="${escA((l.author || '') + (l.serie ? ` · ${l.serie}` : ''))}">
      <div class="ler-capa">${capa}
        ${pct > 0 ? `<span class="ler-capa-pct">${pct}%</span>` : ''}
        ${_estSeloTipo(l)}
      </div>
      <div class="ler-card-nome">${esc(obraNome(l.title) || 'Sem título')}</div>
      <div class="ler-card-autor">${esc(l.author || '')}</div>
      ${l.nota ? `<div class="est-card-nota">${_estEstrelas(l.nota)}</div>` : ''}
      <div class="ler-card-barra"><i style="width:${pct}%;background:${EST_STATUS[l.status]?.cor || 'var(--primary)'}"></i></div>
      <button class="ler-card-x" data-tip="Abrir a ficha"
              onclick="event.stopPropagation();estIr('ficha','${l.id}')">${ic('info','ic-sm')}</button>
    </div>`
}

function _estCapaHTML(l) {
  const src = l.cover || l.coverUrl
  return src
    ? `<img class="ler-capa-img" src="${escA(src)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="ler-capa-fake"><span>${esc((obraNome(l.title) || '?').slice(0, 28))}</span></div>`
}

function _estLinha(l) {
  const pct = Math.round(estPct(l) * 100)
  const pgs = estPaginas(l)
  const st = EST_STATUS[l.status] || EST_STATUS.quero
  const temArquivo = l.kind !== 'fisico'
  return `
    <div class="est-linha" onclick="estIr('ficha','${l.id}')">
      <div class="est-linha-capa">${_estCapaHTML(l)}</div>
      <div class="est-linha-meio">
        <div class="est-linha-nome">${esc(obraNome(l.title) || 'Sem título')}
          ${_estSeloTipo(l)}</div>
        <div class="est-linha-sub">${esc(l.author || 'Autor não informado')}${l.serie ? ` · ${esc(l.serie)}${l.serieNum ? ` #${l.serieNum}` : ''}` : ''}</div>
        <div class="est-linha-barra"><i style="width:${pct}%;background:${st.cor}"></i></div>
      </div>
      <div class="est-linha-dir">
        <span class="est-status" style="--st:${st.cor}">${st.rotulo}</span>
        <span class="est-linha-pct">${pct}%${pgs ? ` · ${Math.round(estPct(l) * pgs)}/${pgs} pág` : ''}</span>
        ${l.nota ? _estEstrelas(l.nota) : ''}
      </div>
      <div class="est-linha-acoes">
        ${temArquivo
          ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();lerAbrir('${l.id}')">${ic('bookOpen','ic-sm')} Ler</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();estProgressoModal('${l.id}')">${ic('pencil','ic-sm')} Progresso</button>`}
      </div>
    </div>`
}

// ---- handlers da barra ----
let _estBuscaTimer = null
function estBuscar(v) {
  _estBusca = v
  clearTimeout(_estBuscaTimer)
  _estBuscaTimer = setTimeout(() => {
    _estRenderEstante()
    const i = el('est-busca'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length) }
  }, 160)
}
function estSetStatus(s) { _estStatus = s; _estRenderEstante() }
function estSetTipo(t) { _estTipo = t; _estRenderEstante() }
function estSetOrdem(o) { estSetPref('ordem', o); _estRenderEstante() }
function estSetVisual(v) { estSetPref('visual', v); _estRenderEstante() }
function estLimparFiltros() { _estBusca = ''; _estStatus = 'todos'; _estTipo = 'todos'; _estRenderEstante() }

function estNota(id, n) {
  const l = livroPorId(id); if (!l) return
  l.nota = n; l.updatedAt = Date.now()
  estSalvar()
  estanteRender()
}

// ================================================================
// TELA 2 — A FICHA DO LIVRO
// ================================================================
function _estRenderFicha() {
  const l = livroPorId(_estId)
  if (!l) { estIr('estante'); return }
  const area = el('ler-area')
  const pct = estPct(l), pgs = estPaginas(l)
  const st = EST_STATUS[l.status] || EST_STATUS.quero
  const temArquivo = l.kind !== 'fisico'
  const caps = _estCapturas(l)

  const abas = [['sobre','Sobre'], ['progresso','Progresso'], ['capturas', `Capturas${caps.length ? ` (${caps.length})` : ''}`], ['notas','Notas']]
    .map(([v, r]) => `<button class="est-aba${_estAba === v ? ' on' : ''}" onclick="estFichaAba('${v}')">${r}</button>`).join('')

  area.innerHTML = `
    <div class="est-ficha">
      <div class="est-ficha-lado">
        <div class="est-ficha-capa">${_estCapaHTML(l)}</div>
        ${temArquivo
          ? `<button class="btn btn-primary" style="width:100%" onclick="lerAbrir('${l.id}')">${ic('bookOpen','ic-sm')} ${pct > 0 ? 'Continuar lendo' : 'Começar a ler'}</button>`
          : `<button class="btn btn-primary" style="width:100%" onclick="estProgressoModal('${l.id}')">${ic('pencil','ic-sm')} Registrar progresso</button>`}
        <div class="est-ficha-status">
          ${Object.entries(EST_STATUS).map(([k, v]) =>
            `<button class="est-chip${l.status === k ? ' on' : ''}" onclick="estSetLivroStatus('${l.id}','${k}')">${v.rotulo}</button>`).join('')}
        </div>
        <div class="est-ficha-nota">${_estEstrelas(l.nota, l.id)}<span>${l.nota ? `${l.nota}/5` : 'Sem nota'}</span></div>
        <div class="est-ficha-mini">
          <button class="btn btn-ghost btn-sm" onclick="estEditar('${l.id}')">${ic('pencil','ic-sm')} Editar</button>
          <button class="btn btn-ghost btn-sm" onclick="lerExcluir('${l.id}')">${ic('trash','ic-sm')} Remover</button>
        </div>
      </div>
      <div class="est-ficha-corpo">
        <div class="est-ficha-topo">
          <h2>${esc(obraNome(l.title) || 'Sem título')}</h2>
          <p class="est-ficha-autor">${esc(l.author || 'Autor não informado')}${l.serie ? ` · <b>${esc(l.serie)}</b>${l.serieNum ? ` #${esc(String(l.serieNum))}` : ''}` : ''}</p>
          <div class="est-ficha-selos">
            <span class="est-status" style="--st:${st.cor}">${st.rotulo}</span>
            ${_estSeloTipo(l)}
            ${l.genero ? `<span class="est-selo">${esc(l.genero)}</span>` : ''}
            ${(l.tags || []).map(t => `<span class="est-selo tag">${ic('tag','ic-3xs')} ${esc(t)}</span>`).join('')}
          </div>
        </div>
        <div class="est-ficha-prog">
          <div class="est-ficha-prog-topo">
            <b>${Math.round(pct * 100)}%</b>
            <span>${pgs ? `${Math.round(pct * pgs)} de ${pgs} páginas${estPaginasEstimadas(l) ? ' (estimadas)' : ''}` : 'sem contagem de páginas'}</span>
          </div>
          <div class="est-ficha-barra"><i style="width:${pct * 100}%;background:${st.cor}"></i></div>
        </div>
        <div class="est-abas est-abas-ficha">${abas}</div>
        <div id="est-ficha-aba">${_estFichaAbaHTML(l, caps)}</div>
      </div>
    </div>`
}

function estFichaAba(a) {
  _estAba = a
  const l = livroPorId(_estId); if (!l) return
  const box = el('est-ficha-aba'); if (!box) { estanteRender(); return }
  box.innerHTML = _estFichaAbaHTML(l, _estCapturas(l))
  document.querySelectorAll('.est-abas-ficha .est-aba').forEach(b =>
    b.classList.toggle('on', b.getAttribute('onclick').includes(`'${a}'`)))
}

function _estFichaAbaHTML(l, caps) {
  if (_estAba === 'progresso') return _estAbaProgresso(l)
  if (_estAba === 'capturas')  return _estAbaCapturas(l, caps)
  if (_estAba === 'notas')     return _estAbaNotas(l)
  return _estAbaSobre(l, caps)
}

function _estAbaSobre(l, caps) {
  const pgs = estPaginas(l)
  const dados = [
    ['Editora', l.editora], ['Ano', l.ano], ['ISBN', l.isbn],
    ['Idioma', (l.lang || '').toUpperCase()], ['Páginas', pgs ? pgs + (estPaginasEstimadas(l) ? ' (est.)' : '') : ''],
    ['Palavras', l.totalWords ? l.totalWords.toLocaleString('pt-BR') : ''],
    ['Capítulos', (l.chapters || []).length || ''],
    ['Começou em', l.inicio ? _estDataBR(l.inicio) : ''],
    ['Terminou em', l.fim ? _estDataBR(l.fim) : ''],
    ['Tempo lido', l.minutos ? _estDur(l.minutos) : ''],
    ['Na estante desde', l.addedAt ? _estDataBR(estData(new Date(l.addedAt))) : ''],
    ['Vocabulário daqui', caps.length ? `${caps.length} ${caps.length === 1 ? 'item' : 'itens'}` : '']
  ].filter(([, v]) => v !== '' && v !== undefined && v !== null)

  return `
    ${l.resumo ? `<p class="est-resumo">${esc(l.resumo)}</p>` : ''}
    <div class="est-dados">
      ${dados.map(([k, v]) => `<div class="est-dado"><span>${k}</span><b>${esc(String(v))}</b></div>`).join('')}
    </div>
    ${_estPrevisaoHTML(l)}`
}

// A previsão só fala quando tem base: 3 dias de leitura registrados. Antes
// disso qualquer número seria chute com cara de dado.
function _estPrevisaoHTML(l) {
  const pct = estPct(l)
  if (pct <= 0 || pct >= 0.995) return ''
  const dias = (l.historico || []).filter(h => h.delta > 0).slice(-14)
  if (dias.length < 3) return ''
  const ritmo = dias.reduce((s, h) => s + h.delta, 0) / dias.length
  if (ritmo <= 0) return ''
  const faltam = Math.ceil((1 - pct) / ritmo)
  const pgs = estPaginas(l)
  const fim = new Date(); fim.setDate(fim.getDate() + faltam)
  // Sem quebra de linha ANTES do ponto final: o HTML colapsa o espaço, mas o
  // ponto aparecia solto depois da data ("28/08/26 .").
  return `<div class="est-previsao">${ic('target','ic-sm')}<span>No seu ritmo dos últimos dias (${
    pgs ? `~${Math.round(ritmo * pgs)} pág/dia` : `${(ritmo * 100).toFixed(1)}%/dia`
  }), você termina em <b>${faltam} ${faltam === 1 ? 'dia' : 'dias'}</b> — por volta de <b>${_estDataBR(estData(fim))}</b>.</span></div>`
}

function _estAbaProgresso(l) {
  const h = (l.historico || []).slice().reverse()
  const pgs = estPaginas(l)
  if (!h.length) {
    return `<div class="est-nada">${ic('chart','ic-lg')}<p>Nenhum avanço registrado ainda.</p>
      ${l.kind === 'fisico'
        ? `<button class="btn btn-ghost btn-sm" onclick="estProgressoModal('${l.id}')">Registrar o primeiro</button>`
        : `<p class="est-dica">Com o livro aberto no leitor, o avanço é anotado sozinho.</p>`}</div>`
  }
  const max = Math.max(...h.map(x => x.delta)) || 1
  return `
    <div class="est-hist-graf">
      ${h.slice(0, 30).reverse().map(x => `<i style="height:${Math.max(3, (x.delta / max) * 100)}%" data-tip="${_estDataBR(x.d)} · ${pgs ? Math.round(x.delta * pgs) + ' pág' : (x.delta * 100).toFixed(1) + '%'}"></i>`).join('')}
    </div>
    <div class="est-hist">
      ${h.slice(0, 40).map(x => `
        <div class="est-hist-linha">
          <span class="est-hist-d">${_estDataBR(x.d)}</span>
          <span class="est-hist-p">${pgs ? `pág. ${x.pag}` : `${Math.round(x.pct * 100)}%`}</span>
          <span class="est-hist-delta">${x.delta > 0 ? `+${pgs ? Math.round(x.delta * pgs) + ' pág' : (x.delta * 100).toFixed(1) + '%'}` : '—'}</span>
          <button class="est-hist-x" data-tip="Apagar este dia" onclick="estApagarDia('${l.id}','${x.d}')">${ic('x','ic-3xs')}</button>
        </div>`).join('')}
    </div>
    ${h.length > 40 ? `<p class="est-dica">Mostrando os 40 dias mais recentes de ${h.length}.</p>` : ''}`
}

// O que o livro DEU: os itens de vocabulário capturados nele. É a ponte que o
// gerenciador de fora não tinha como ter — aqui a obra e o card são a mesma
// história.
function _estCapturas(l) {
  if (typeof words === 'undefined' || !Array.isArray(words)) return []
  const alvo = obraChaveNome(obraNome(l.title))
  if (!alvo) return []
  return words.filter(w => {
    const t = obraChaveNome(obraNome(w.source_title || ''))
    return t && t === alvo
  })
}

function _estAbaCapturas(l, caps) {
  if (!caps.length) {
    return `<div class="est-nada">${ic('sparkles','ic-lg')}<p>Nenhuma palavra saiu deste livro ainda.</p>
      <p class="est-dica">No leitor, marcar uma palavra já traz a tradução; o menu manda para o estudo.</p></div>`
  }
  const porStatus = {}
  caps.forEach(w => { porStatus[w.status] = (porStatus[w.status] || 0) + 1 })
  const rotulos = { pending_ai: 'esperando análise', pending_review: 'no Preparar', in_study: 'no Estudo', in_srs: 'na revisão', skipped: 'dispensadas' }
  return `
    <div class="est-cap-resumo">
      ${Object.entries(porStatus).map(([k, n]) => `<span class="est-selo">${n} ${rotulos[k] || k}</span>`).join('')}
    </div>
    <div class="est-cap-lista">
      ${caps.slice(0, 60).map(w => `
        <div class="est-cap">
          <b>${esc(w.word)}</b>
          <span>${esc((w.meanings && w.meanings[0] && w.meanings[0].meaning_pt) || '—')}</span>
        </div>`).join('')}
    </div>
    ${caps.length > 60 ? `<p class="est-dica">…e mais ${caps.length - 60}. A lista inteira está em Palavras.</p>` : ''}`
}

function _estAbaNotas(l) {
  const notas = Array.isArray(l.notes) ? l.notes : []
  return `
    <div class="est-notas-nova">
      <textarea id="est-nota-txt" rows="3" placeholder="Uma ideia, uma citação, o que ficou deste trecho…"></textarea>
      <button class="btn btn-primary btn-sm" onclick="estAddNota('${l.id}')">${ic('plus','ic-sm')} Anotar</button>
    </div>
    ${notas.length
      ? `<div class="est-notas">${notas.slice().reverse().map((n, i) => `
          <div class="est-nota">
            <p>${esc(typeof n === 'string' ? n : (n.txt || n.text || ''))}</p>
            <div class="est-nota-pe">
              <span>${n.at ? _estDataBR(estData(new Date(n.at))) : ''}${n.cap !== undefined && l.chapters && l.chapters[n.cap] ? ` · ${esc(l.chapters[n.cap].titulo || '')}` : ''}</span>
              <button onclick="estDelNota('${l.id}',${notas.length - 1 - i})" data-tip="Apagar">${ic('trash','ic-3xs')}</button>
            </div>
          </div>`).join('')}</div>`
      : `<div class="est-nada">${ic('pencil','ic-lg')}<p>Sem anotações neste livro.</p></div>`}`
}

function estAddNota(id) {
  const l = livroPorId(id); if (!l) return
  const t = el('est-nota-txt'); const txt = (t && t.value || '').trim()
  if (!txt) { toast('Escreva alguma coisa antes.', 'warning'); return }
  l.notes = Array.isArray(l.notes) ? l.notes : []
  l.notes.push({ txt, at: Date.now(), cap: undefined })
  l.updatedAt = Date.now()
  estSalvar(); estFichaAba('notas')
}
function estDelNota(id, i) {
  const l = livroPorId(id); if (!l || !l.notes) return
  l.notes.splice(i, 1); l.updatedAt = Date.now()
  estSalvar(); estFichaAba('notas')
}
function estApagarDia(id, d) {
  const l = livroPorId(id); if (!l) return
  l.historico = (l.historico || []).filter(h => h.d !== d)
  l.updatedAt = Date.now()
  estSalvar(); estFichaAba('progresso')
}

function estSetLivroStatus(id, s) {
  const l = livroPorId(id); if (!l) return
  l.status = s
  const hoje = estData()
  if (s === 'lido') {
    l.fim = l.fim || hoje
    l.anoFim = Number(String(l.fim).slice(0, 4))
    if (!l.inicio) l.inicio = hoje
    // Marcar como lido é dizer "cheguei ao fim" — o progresso tem de contar a
    // mesma história, senão a estante mostra 43% num livro concluído.
    if (l.kind === 'fisico') { const p = estPaginas(l); if (p) l.pagAtual = p }
    else if ((l.progress || 0) < 0.995) l.progress = 1
    estRegistrar(l, 1, hoje, true)
  } else if (s === 'lendo' && !l.inicio) l.inicio = hoje
  if (s !== 'lido') { l.fim = null; l.anoFim = null }
  l.updatedAt = Date.now()
  estSalvar(); estanteRender()
}

// ================================================================
// REGISTRAR PROGRESSO (livro sem arquivo)
// ================================================================
function estProgressoModal(id) {
  const l = livroPorId(id); if (!l) return
  const pgs = estPaginas(l)
  if (!pgs) {
    toast('Informe o total de páginas primeiro (Editar).', 'warning')
    estIr('form', id); return
  }
  const atual = Math.round(estPct(l) * pgs)
  document.getElementById('est-prog-modal')?.remove()
  const ov = document.createElement('div')
  ov.id = 'est-prog-modal'; ov.className = 'srs-modal-overlay'
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove() })
  ov.innerHTML = `<div class="srs-modal-box">
    <h4 style="font-size:var(--fs-base);font-weight:700;margin-bottom:4px">${esc(obraNome(l.title))}</h4>
    <p style="font-size:var(--fs-sm);color:var(--text2);margin-bottom:14px">
      Está na página <b>${atual}</b> de ${pgs}. Em que página você parou?</p>
    <div class="est-prog-campos">
      <input type="number" id="est-prog-pag" class="srs-modal-select" min="0" max="${pgs}" value="${atual}" aria-label="Página atual">
      <input type="date" id="est-prog-data" class="srs-modal-select" value="${estData()}" max="${estData()}" aria-label="Data">
    </div>
    <p class="est-dica" style="margin:10px 0 16px">Data diferente de hoje? O avanço entra no dia escolhido.</p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('est-prog-modal').remove()">Cancelar</button>
      <button class="btn btn-primary btn-sm" onclick="estProgressoSalvar('${l.id}')">Salvar</button>
    </div>
  </div>`
  document.body.appendChild(ov)
  const f = document.getElementById('est-prog-pag')
  setTimeout(() => { f.focus(); f.select() }, 30)
  f.addEventListener('keydown', e => { if (e.key === 'Enter') estProgressoSalvar(l.id) })
}

function estProgressoSalvar(id) {
  const l = livroPorId(id); if (!l) return
  const pgs = estPaginas(l)
  const v = Number(document.getElementById('est-prog-pag').value)
  const d = document.getElementById('est-prog-data').value || estData()
  if (isNaN(v) || v < 0) { toast('Página inválida.', 'error'); return }
  l.pagAtual = Math.min(Math.max(0, Math.round(v)), pgs)
  const pct = estPct(l)
  estRegistrar(l, pct, d)
  estStatusAuto(l, pct, d)
  estSalvar()
  document.getElementById('est-prog-modal')?.remove()
  toast(pct >= 0.995 ? `"${obraNome(l.title)}" concluído` : `Página ${l.pagAtual} registrada`, 'success')
  estanteRender()
}

// ================================================================
// TELA 3 — CADASTRAR / EDITAR
// ================================================================
function estNovoManual() { _estGB = []; _estGBerro = ''; estIr('form', null) }
function estEditar(id) { _estGB = []; _estGBerro = ''; estIr('form', id) }

function _estRenderForm() {
  const l = _estId ? livroPorId(_estId) : null
  const area = el('ler-area')
  const v = (k, d = '') => escA(l && l[k] !== undefined && l[k] !== null ? l[k] : d)
  area.innerHTML = `
    <div class="est-form">
      <h2>${l ? 'Editar livro' : 'Cadastrar livro'}</h2>
      <p class="est-dica">${l ? 'O que estiver errado no arquivo se corrige aqui — a estante e as capturas passam a usar o nome certo.'
        : 'Para o livro de papel, o e-book de fora ou o que você ainda quer ler. Sem arquivo, o progresso é você quem registra.'}</p>

      ${!l ? `
      <div class="est-gb">
        <div class="est-gb-busca">
          ${ic('search','ic-sm')}
          <input type="text" id="est-gb-q" placeholder="Buscar por título, autor ou ISBN — preenche tudo sozinho"
                 onkeydown="if(event.key==='Enter')estGBBuscar()">
          <button class="btn btn-ghost btn-sm" onclick="estGBBuscar()">Buscar</button>
        </div>
        <div id="est-gb-res">${_estGBResHTML()}</div>
      </div>` : ''}

      <div class="est-form-grid">
        <label class="est-campo w2"><span>Título</span><input type="text" id="est-f-title" value="${v('title')}" placeholder="Obrigatório"></label>
        <label class="est-campo w2"><span>Autor</span><input type="text" id="est-f-author" value="${v('author')}"></label>
        <label class="est-campo"><span>Série</span><input type="text" id="est-f-serie" value="${v('serie')}" placeholder="ex.: Discworld"></label>
        <label class="est-campo"><span>Nº na série</span><input type="number" id="est-f-serieNum" value="${v('serieNum')}" min="0"></label>
        <label class="est-campo"><span>Editora</span><input type="text" id="est-f-editora" value="${v('editora')}"></label>
        <label class="est-campo"><span>Ano</span><input type="number" id="est-f-ano" value="${v('ano')}" min="0" max="2100"></label>
        <label class="est-campo"><span>ISBN</span><input type="text" id="est-f-isbn" value="${v('isbn')}"></label>
        <label class="est-campo"><span>Páginas</span><input type="number" id="est-f-paginas" value="${v('paginas')}" min="0"></label>
        <label class="est-campo"><span>Gênero</span>
          <input type="text" id="est-f-genero" list="est-generos" value="${v('genero')}">
          <datalist id="est-generos">${EST_GENEROS.map(g => `<option value="${g}"></option>`).join('')}</datalist>
        </label>
        <label class="est-campo"><span>Idioma</span>
          <select id="est-f-lang">
            ${[['en','Inglês'],['pt','Português'],['es','Espanhol'],['fr','Francês'],['de','Alemão'],['ja','Japonês']]
              .map(([c, n]) => `<option value="${c}"${(l && l.lang || 'en') === c ? ' selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
        <label class="est-campo"><span>Etiquetas</span><input type="text" id="est-f-tags" value="${escA((l && l.tags || []).join(', '))}" placeholder="separadas por vírgula"></label>
        <label class="est-campo"><span>Status</span>
          <select id="est-f-status">
            ${Object.entries(EST_STATUS).map(([k, s]) => `<option value="${k}"${(l && l.status || 'quero') === k ? ' selected' : ''}>${s.rotulo}</option>`).join('')}
          </select>
        </label>
        ${!l || l.kind === 'fisico' ? `
        <label class="est-campo"><span>Página atual</span><input type="number" id="est-f-pagAtual" value="${v('pagAtual', 0)}" min="0"></label>` : ''}
        <label class="est-campo w2"><span>URL da capa</span><input type="text" id="est-f-coverUrl" value="${v('coverUrl')}" placeholder="https://…"></label>
        <label class="est-campo w4"><span>Resumo</span><textarea id="est-f-resumo" rows="4">${esc(l && l.resumo || '')}</textarea></label>
      </div>

      <div class="est-form-acoes">
        <button class="btn btn-ghost" onclick="estIr('${l ? 'ficha' : 'estante'}'${l ? `,'${l.id}'` : ''})">Cancelar</button>
        <button class="btn btn-primary" onclick="estSalvarForm(${l ? `'${l.id}'` : 'null'})">${ic('check','ic-sm')} Salvar</button>
      </div>
    </div>`
}

function _estGBResHTML() {
  // Aviso e erro são coisas diferentes: "veio da outra fonte" com resultados
  // na tela é informação; pintar de vermelho faria parecer que falhou.
  const aviso = _estGBerro ? `<p class="est-dica${_estGB.length ? '' : ' est-erro'}">${esc(_estGBerro)}</p>` : ''
  if (!_estGB.length) return aviso
  return `${aviso}<div class="est-gb-res">${_estGB.map((r, i) => `
    <button class="est-gb-item" onclick="estGBUsar(${i})">
      ${r.capa ? `<img src="${escA(r.capa)}" alt="" loading="lazy">` : `<span class="est-gb-sem">${ic('book','ic-sm')}</span>`}
      <span class="est-gb-txt"><b>${esc(r.title)}</b><i>${esc(r.author || 'autor desconhecido')}${r.ano ? ` · ${r.ano}` : ''}${r.paginas ? ` · ${r.paginas} pág` : ''}</i></span>
    </button>`).join('')}</div>`
}

// DUAS FONTES, nesta ordem. As duas são públicas, sem chave e sem custo.
//
// ⚠️ O GOOGLE BOOKS FALHA COM FREQUÊNCIA E NÃO É "SEM INTERNET". Sem chave,
// a cota é compartilhada por todo mundo que chama daquele jeito, e ela estoura
// no meio do dia — foi exatamente o que aconteceu no primeiro teste desta
// tela: HTTP 429, "Quota exceeded... per day". Um app que dissesse "sem
// internet" ali estaria mentindo, e o usuário ficaria reiniciando o roteador.
// Por isso o 429 é reconhecido pelo nome e a busca CAI SOZINHA na Open
// Library, que não tem essa cota. A tela diz de onde vieram os dados.
async function estGBBuscar() {
  const q = (document.getElementById('est-gb-q').value || '').trim()
  if (!q) return
  _estGBerro = ''; _estGB = []
  const box = el('est-gb-res'); if (box) box.innerHTML = `<p class="est-dica">Buscando…</p>`
  const soDigitos = q.replace(/[^0-9Xx]/g, '')
  const ehIsbn = soDigitos.length === 10 || soDigitos.length === 13

  let cota = false
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(ehIsbn ? `isbn:${soDigitos}` : q)}&maxResults=6`)
    if (r.status === 429) cota = true
    else {
      const j = await r.json()
      _estGB = (j.items || []).map(it => {
        const v = it.volumeInfo || {}
        const img = (v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || ''
        return {
          fonte: 'Google Books',
          title: v.title || '', author: (v.authors || []).join(', '),
          editora: v.publisher || '', ano: (v.publishedDate || '').slice(0, 4),
          isbn: ((v.industryIdentifiers || []).find(x => /ISBN_13|ISBN_10/.test(x.type)) || {}).identifier || '',
          paginas: v.pageCount || '', genero: (v.categories || [])[0] || '',
          resumo: (v.description || '').slice(0, 1200), lang: v.language || 'en',
          capa: img.replace(/^http:/, 'https:')
        }
      })
    }
  } catch (e) { cota = true }

  if (!_estGB.length) {
    try {
      const campos = 'key,title,author_name,first_publish_year,number_of_pages_median,cover_i,publisher,isbn,subject,language'
      const r2 = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(ehIsbn ? `isbn:${soDigitos}` : q)}&limit=6&fields=${campos}`)
      const j2 = await r2.json()
      _estGB = (j2.docs || []).map(d => ({
        fonte: 'Open Library', key: d.key || '',
        title: d.title || '', author: (d.author_name || []).join(', '),
        editora: (d.publisher || [])[0] || '', ano: d.first_publish_year || '',
        isbn: (d.isbn || [])[0] || '', paginas: d.number_of_pages_median || '',
        genero: (d.subject || [])[0] || '', resumo: '',
        lang: ((d.language || [])[0] || 'eng').slice(0, 2),
        capa: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : ''
      }))
      if (_estGB.length && cota) _estGBerro = 'O Google Books estourou a cota do dia — estes vieram da Open Library.'
    } catch (e) {
      _estGBerro = cota
        ? 'O Google Books estourou a cota do dia e a Open Library não respondeu. Preencha à mão — funciona igual.'
        : 'Não consegui falar com as fontes de catálogo (sem internet?). Preencha à mão — funciona igual.'
    }
  }
  if (!_estGB.length && !_estGBerro) _estGBerro = 'Não achei nada com isso. Tente o título junto com o autor.'
  const b = el('est-gb-res'); if (b) b.innerHTML = _estGBResHTML()
}

async function estGBUsar(i) {
  const r = _estGB[i]; if (!r) return
  const set = (id, v) => { const e = document.getElementById(id); if (e && v) e.value = v }
  set('est-f-title', r.title); set('est-f-author', r.author); set('est-f-editora', r.editora)
  set('est-f-ano', r.ano); set('est-f-isbn', r.isbn); set('est-f-paginas', r.paginas)
  set('est-f-genero', r.genero); set('est-f-resumo', r.resumo); set('est-f-coverUrl', r.capa)
  const lang = document.getElementById('est-f-lang'); if (lang && r.lang) lang.value = r.lang.slice(0, 2)
  toast(`Dados de ${r.fonte} — confira antes de salvar`, 'success')
  // A Open Library não manda a sinopse na busca; ela mora na obra. Uma
  // requisição a mais, e só depois de o usuário ESCOLHER o livro — buscar o
  // resumo dos seis resultados seria pagar por cinco que ele vai descartar.
  if (r.fonte === 'Open Library' && r.key && !r.resumo) {
    try {
      const w = await (await fetch(`https://openlibrary.org${r.key}.json`)).json()
      const d = typeof w.description === 'string' ? w.description : (w.description && w.description.value) || ''
      if (d) { r.resumo = d.slice(0, 1200); set('est-f-resumo', r.resumo) }
    } catch (e) {}
  }
}

function estSalvarForm(id) {
  const g = k => { const e = document.getElementById('est-f-' + k); return e ? e.value.trim() : '' }
  const titulo = g('title')
  if (!titulo) { toast('O título é obrigatório.', 'error'); return }
  const l = id ? livroPorId(id) : null
  const dados = {
    title: titulo, author: g('author'), serie: g('serie'), serieNum: Number(g('serieNum')) || '',
    editora: g('editora'), ano: g('ano'), isbn: g('isbn'),
    paginas: Number(g('paginas')) || 0, genero: g('genero'), lang: g('lang') || 'en',
    tags: g('tags').split(',').map(s => s.trim()).filter(Boolean),
    status: g('status') || 'quero', coverUrl: g('coverUrl'), resumo: g('resumo'),
    updatedAt: Date.now()
  }
  if (l) {
    Object.assign(l, dados)
    if (l.kind === 'fisico') l.pagAtual = Math.min(Number(g('pagAtual')) || 0, estPaginas(l) || Infinity)
  } else {
    const novo = {
      id: uid(), kind: 'fisico', format: 'fisico',
      chapters: [], pos: { cap: 0, frac: 0 }, progress: 0, notes: [], historico: [],
      pagAtual: Math.min(Number(g('pagAtual')) || 0, dados.paginas || Infinity),
      nota: 0, minutos: 0, addedAt: Date.now(), lastOpen: 0, ...dados
    }
    livros.push(novo)
    const pct = estPct(novo)
    if (pct > 0) { estRegistrar(novo, pct, null, true); estStatusAuto(novo, pct) }
    _estId = novo.id
  }
  estSalvar()
  toast(l ? 'Livro atualizado' : `"${titulo}" entrou na estante`, 'success')
  estIr('ficha', _estId)
}

// ================================================================
// TELA 4 — LEITURA EM NÚMEROS
// ================================================================
function _estRenderPainel() {
  const c = estCfg()
  const hoje = estData()
  const dias = _estDiasMapa()                    // 'YYYY-MM-DD' → páginas
  const hojePag = dias[hoje] || 0
  const semana = _estSoma(dias, 7)
  const mes = _estSoma(dias, 30)
  const seq = _estSequencia(dias)
  const ano = new Date().getFullYear()
  const lidosAno = livros.filter(l => l.status === 'lido' && (l.anoFim || Number(String(l.fim || '').slice(0, 4))) === ano)
  const lendo = livros.filter(l => l.status === 'lendo').sort((a, b) => (b.lastOpen || 0) - (a.lastOpen || 0))
  const pctMeta = Math.min(100, Math.round(hojePag / (c.metaPag || 1) * 100))
  const pctAno = Math.min(100, Math.round(lidosAno.length / (c.metaLivros || 1) * 100))
  const totalPagAno = Object.entries(dias).filter(([d]) => d.startsWith(String(ano))).reduce((s, [, v]) => s + v, 0)

  el('ler-area').innerHTML = `
    <div class="est-painel">
      <div class="est-metricas">
        ${_estMetrica('Hoje', `${hojePag}`, 'páginas', pctMeta, `meta de ${c.metaPag}/dia`)}
        ${_estMetrica('Sequência', `${seq}`, seq === 1 ? 'dia seguido' : 'dias seguidos', null, seq ? 'não quebre' : 'comece hoje')}
        ${_estMetrica('7 dias', `${semana}`, 'páginas', null, `${Math.round(semana / 7)} por dia`)}
        ${_estMetrica('30 dias', `${mes}`, 'páginas', null, `${Math.round(mes / 30)} por dia`)}
      </div>

      <div class="est-painel-grade">
        <div class="est-bloco">
          <div class="est-bloco-topo">
            <h3>${ic('calendar','ic-sm')} ${_estMesNome(_estMes)} ${_estAno}</h3>
            <div class="est-cal-nav">
              <button onclick="estMesMudar(-1)" aria-label="Mês anterior">${ic('chevronLeft','ic-sm')}</button>
              <button onclick="estMesMudar(1)" aria-label="Próximo mês">${ic('chevronRight','ic-sm')}</button>
            </div>
          </div>
          ${_estCalendarioHTML(dias)}
          <p class="est-dica">Quanto mais forte a cor, mais páginas naquele dia.</p>
        </div>

        <div class="est-bloco">
          <div class="est-bloco-topo"><h3>${ic('target','ic-sm')} Metas</h3></div>
          <div class="est-meta">
            <div class="est-meta-lin"><span>Páginas por dia</span>
              <input type="number" min="1" max="500" value="${c.metaPag}" onchange="estSetCfg('metaPag',Number(this.value)||20);estanteRender()"></div>
            <div class="est-ficha-barra"><i style="width:${pctMeta}%;background:var(--role-energia)"></i></div>
            <p class="est-dica">${hojePag >= c.metaPag ? 'Meta do dia cumprida.' : `Faltam ${c.metaPag - hojePag} páginas hoje.`}</p>
          </div>
          <div class="est-meta">
            <div class="est-meta-lin"><span>Livros no ano</span>
              <input type="number" min="1" max="365" value="${c.metaLivros}" onchange="estSetCfg('metaLivros',Number(this.value)||12);estanteRender()"></div>
            <div class="est-ficha-barra"><i style="width:${pctAno}%;background:var(--role-dominio)"></i></div>
            <p class="est-dica">${lidosAno.length} de ${c.metaLivros} concluídos em ${ano} · ${totalPagAno.toLocaleString('pt-BR')} páginas no ano.</p>
          </div>
        </div>

        <div class="est-bloco w2">
          <div class="est-bloco-topo"><h3>${ic('bookOpen','ic-sm')} Em leitura agora</h3></div>
          ${lendo.length ? `<div class="est-lista">${lendo.map(_estLinha).join('')}</div>`
            : `<div class="est-nada"><p>Nenhum livro em andamento.</p></div>`}
        </div>

        ${lidosAno.length ? `
        <div class="est-bloco w2">
          <div class="est-bloco-topo"><h3>${ic('checkCircle','ic-sm')} Concluídos em ${ano}</h3></div>
          <div class="ler-estante est-mini">${lidosAno.map(_estCard).join('')}</div>
        </div>` : ''}
      </div>

      <div class="est-painel-pe">
        <button class="btn btn-ghost btn-sm" onclick="estImportarModal()">${ic('download','ic-sm')} Trazer acervo de outro app</button>
        ${livros.some(l => l.demo)
          ? `<button class="btn btn-ghost btn-sm" onclick="estanteDemoRemover()">${ic('trash','ic-sm')} Remover o acervo de exemplo</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="estanteDemo()">${ic('sparkles','ic-sm')} Carregar acervo de exemplo</button>`}
      </div>
    </div>`
}

function _estMetrica(rot, val, uni, pct, pe) {
  return `<div class="est-metrica">
    <span class="est-metrica-rot">${rot}</span>
    <b>${val}<i>${uni}</i></b>
    ${pct !== null && pct !== undefined ? `<div class="est-metrica-barra"><i style="width:${pct}%"></i></div>` : ''}
    <span class="est-metrica-pe">${pe}</span>
  </div>`
}

// Todas as páginas de todos os livros por dia. É a soma que faz papel e EPUB
// viverem no mesmo calendário.
function _estDiasMapa() {
  const m = {}
  for (const l of livros) {
    for (const h of (l.historico || [])) {
      if (h.deltaPag > 0) m[h.d] = (m[h.d] || 0) + h.deltaPag
    }
  }
  return m
}
function _estSoma(dias, n) {
  const hoje = new Date(); let t = 0
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje); d.setDate(hoje.getDate() - i)
    t += dias[estData(d)] || 0
  }
  return t
}
// Sequência: dias seguidos com leitura, terminando hoje OU ontem. Contar só a
// partir de hoje zeraria a sequência de quem ainda não leu de manhã — e isso
// é punir o usuário por causa do relógio.
function _estSequencia(dias) {
  const hoje = new Date()
  let ini = 0
  if (!dias[estData(hoje)]) {
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
    if (!dias[estData(ontem)]) return 0
    ini = 1
  }
  let n = 0
  for (let i = ini; i < 400; i++) {
    const d = new Date(hoje); d.setDate(hoje.getDate() - i)
    if (dias[estData(d)]) n++
    else break
  }
  return n
}

function estMesMudar(delta) {
  _estMes += delta
  if (_estMes < 0) { _estMes = 11; _estAno-- }
  if (_estMes > 11) { _estMes = 0; _estAno++ }
  _estRenderPainel()
}
function _estMesNome(m) {
  return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][m]
}

function _estCalendarioHTML(dias) {
  const primeiro = new Date(_estAno, _estMes, 1)
  const total = new Date(_estAno, _estMes + 1, 0).getDate()
  const vazios = primeiro.getDay()
  const doMes = []
  for (let d = 1; d <= total; d++) doMes.push(dias[estData(new Date(_estAno, _estMes, d))] || 0)
  const max = Math.max(...doMes, 1)
  const hoje = estData()
  const cels = []
  for (let i = 0; i < vazios; i++) cels.push('<span class="est-cal-vazio"></span>')
  for (let d = 1; d <= total; d++) {
    const iso = estData(new Date(_estAno, _estMes, d))
    const p = dias[iso] || 0
    const nivel = p ? Math.min(4, Math.ceil(p / max * 4)) : 0
    cels.push(`<span class="est-cal-dia n${nivel}${iso === hoje ? ' hoje' : ''}"
      data-tip="${_estDataBR(iso)} · ${p ? p + ' páginas' : 'sem leitura'}">${d}</span>`)
  }
  return `<div class="est-cal">
    ${['D','S','T','Q','Q','S','S'].map(x => `<span class="est-cal-cab">${x}</span>`).join('')}
    ${cels.join('')}
  </div>`
}

// ================================================================
// IMPORTAR DE FORA
// ================================================================
// O `gerenciador-de-livros` guardava tudo no localStorage do navegador em que
// rodava — não há servidor para consultar. Então o caminho honesto é este:
// ele copia de lá com uma linha e cola aqui.
function estImportarModal() {
  document.getElementById('est-imp-modal')?.remove()
  const ov = document.createElement('div')
  ov.id = 'est-imp-modal'; ov.className = 'srs-modal-overlay'
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove() })
  ov.innerHTML = `<div class="srs-modal-box" style="max-width:620px">
    <h4 style="font-size:var(--fs-base);font-weight:700;margin-bottom:6px">Trazer acervo de outro app</h4>
    <p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.6;margin-bottom:12px">
      Abra o app antigo, aperte F12, cole isto no Console e dê Enter — o conteúdo vai para a
      área de transferência:</p>
    <code class="est-code">copy(localStorage.getItem('livros'))</code>
    <p style="font-size:var(--fs-sm);color:var(--text2);margin:12px 0 8px">Depois cole aqui:</p>
    <textarea id="est-imp-txt" rows="6" class="srs-modal-select" placeholder='[{"titulo":"…","autor":"…"}]'></textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('est-imp-modal').remove()">Cancelar</button>
      <button class="btn btn-primary btn-sm" onclick="estImportarFazer()">${ic('download','ic-sm')} Importar</button>
    </div>
  </div>`
  document.body.appendChild(ov)
  setTimeout(() => document.getElementById('est-imp-txt')?.focus(), 30)
}

function estImportarFazer() {
  const txt = (document.getElementById('est-imp-txt').value || '').trim()
  let dados
  try { dados = JSON.parse(txt) } catch { toast('Isso não é um JSON válido.', 'error'); return }
  const lista = Array.isArray(dados) ? dados : (dados.livros || [])
  if (!Array.isArray(lista) || !lista.length) { toast('Não achei livros nesse texto.', 'error'); return }

  const mapaStatus = { quero_ler: 'quero', lendo: 'lendo', lido: 'lido', parado: 'parado' }
  let n = 0
  for (const b of lista) {
    const titulo = b.titulo || b.title || ''
    if (!titulo) continue
    if (livros.some(l => obraChaveNome(l.title) === obraChaveNome(titulo))) continue
    const paginas = Number(b.paginas) || 0
    const lidas = Number(b.lidas) || 0
    const hist = (b.history || []).map(h => ({
      d: h.date, pct: paginas ? Math.min(1, (h.pages || 0) / paginas) : (h.percent || 0) / 100,
      delta: paginas ? Math.max(0, (h.delta || 0) / paginas) : 0,
      pag: h.pages || 0, deltaPag: Math.max(0, h.delta || 0), ts: h.timestamp || Date.now()
    })).filter(h => h.d)
    livros.push({
      id: uid(), kind: 'fisico', format: 'fisico',
      title: titulo, author: b.autor || b.author || '', editora: b.editora || '',
      genero: b.genero || b.categoria || '', resumo: b.resumo || '', isbn: b.isbn || '',
      coverUrl: b.capa || '', lang: 'pt', paginas, pagAtual: lidas,
      status: mapaStatus[b.status] || (lidas >= paginas && paginas ? 'lido' : lidas > 0 ? 'lendo' : 'quero'),
      inicio: b.startDate || null, fim: b.endDate || null,
      anoFim: b.completedYear || (b.endDate ? Number(String(b.endDate).slice(0, 4)) : null),
      tags: b.tipo && b.tipo !== 'Físico' ? [b.tipo] : [],
      nota: Number(b.nota) || 0, historico: hist, notes: [], chapters: [],
      pos: { cap: 0, frac: 0 }, progress: 0, minutos: 0,
      addedAt: Date.now(), updatedAt: Date.now(), lastOpen: 0
    })
    n++
  }
  estSalvar()
  document.getElementById('est-imp-modal')?.remove()
  toast(n ? `${n} ${n === 1 ? 'livro importado' : 'livros importados'}` : 'Nada novo — todos já estavam aqui', n ? 'success' : 'info')
  estIr('estante')
}

// ================================================================
// ACERVO DE EXEMPLO
// ================================================================
// Marcado com `demo:true` e removível em um clique. Sem a marca, o exemplo
// vira lixo permanente no acervo de verdade — e este acervo sincroniza.
// `dias` = quanto tempo durou a leitura; `atras` = há quantos dias ela parou.
// ⚠️ `atras` existe porque sem ele TODO livro do exemplo terminava hoje — três
// obras concluídas no mesmo dia e um livro "parado" com leitura de hoje. O
// exemplo serve para mostrar a tela funcionando, e tela que mente não mostra.
const EST_DEMO = [
  { title: 'The Hobbit', author: 'J.R.R. Tolkien', paginas: 310, genero: 'Fantasia', ano: '1937', editora: 'Allen & Unwin', nota: 5, tags: ['clássico'], status: 'lido', dias: 22, atras: 41, pct: 1 },
  { title: 'Project Hail Mary', author: 'Andy Weir', paginas: 476, genero: 'Ficção científica', ano: '2021', editora: 'Ballantine', nota: 5, tags: ['releitura'], status: 'lendo', dias: 14, atras: 0, pct: 0.62 },
  { title: 'Atomic Habits', author: 'James Clear', paginas: 320, genero: 'Autoajuda', ano: '2018', editora: 'Avery', nota: 4, tags: ['hábito'], status: 'lendo', dias: 9, atras: 0, pct: 0.35 },
  { title: 'The Old Man and the Sea', author: 'Ernest Hemingway', paginas: 127, genero: 'Drama', ano: '1952', editora: 'Scribner', nota: 4, tags: ['inglês fácil'], status: 'lido', dias: 6, atras: 13, pct: 1 },
  { title: 'Norwegian Wood', author: 'Haruki Murakami', paginas: 296, genero: 'Romance', ano: '1987', editora: 'Kodansha', nota: 3, tags: [], status: 'parado', dias: 11, atras: 26, pct: 0.28 },
  { title: 'Educated', author: 'Tara Westover', paginas: 352, genero: 'Biografia', ano: '2018', editora: 'Random House', nota: 0, tags: [], status: 'quero', dias: 0, atras: 0, pct: 0 },
  { title: 'Dune', author: 'Frank Herbert', paginas: 688, genero: 'Ficção científica', ano: '1965', editora: 'Chilton', nota: 0, tags: ['série'], serie: 'Dune', serieNum: 1, status: 'quero', dias: 0, atras: 0, pct: 0 },
  { title: 'Sapiens', author: 'Yuval Noah Harari', paginas: 443, genero: 'História', ano: '2011', editora: 'Harper', nota: 5, tags: [], status: 'lido', dias: 34, atras: 86, pct: 1 }
]

function estanteDemo() {
  if (livros.some(l => l.demo)) { toast('O acervo de exemplo já está aqui.', 'info'); return }
  const hoje = new Date()
  for (const d of EST_DEMO) {
    const l = {
      id: uid(), demo: true, kind: 'fisico', format: 'fisico',
      title: d.title, author: d.author, paginas: d.paginas, genero: d.genero, ano: d.ano,
      editora: d.editora, nota: d.nota, tags: d.tags, serie: d.serie || '', serieNum: d.serieNum || '',
      lang: 'en', resumo: '', coverUrl: '', status: d.status,
      pagAtual: Math.round(d.paginas * d.pct), historico: [], notes: [], chapters: [],
      pos: { cap: 0, frac: 0 }, progress: 0, minutos: Math.round(d.paginas * d.pct * 1.6),
      addedAt: Date.now() - (d.dias + d.atras + 2) * 86400000, updatedAt: Date.now(),
      lastOpen: d.pct ? Date.now() - Math.max(1, d.atras) * 86400000 : 0
    }
    // Um histórico plausível: o avanço distribuído nos dias de leitura, com
    // folgas no meio (semana real tem dia sem ler, e é isso que faz calendário
    // e sequência se parecerem com a vida).
    // ⚠️ Os dias válidos são apurados ANTES de distribuir. Dividir pelo total
    // e depois pular dias deixava o último registro abaixo da página atual —
    // a ficha dizia 62% e o histórico parava em 57%.
    if (d.dias && d.pct) {
      const validos = []
      for (let i = d.dias - 1; i >= 0; i--) {
        if (i > 2 && i % 6 === 4) continue          // folga, nunca nos 3 últimos dias
        validos.push(i + (d.atras || 0))
      }
      validos.forEach((i, n) => {
        const dt = new Date(hoje); dt.setDate(hoje.getDate() - i)
        estRegistrar(l, d.pct * ((n + 1) / validos.length), estData(dt))
      })
      l.inicio = l.historico[0] && l.historico[0].d
      if (d.pct >= 1) { l.fim = l.historico[l.historico.length - 1].d; l.anoFim = Number(String(l.fim).slice(0, 4)) }
    }
    livros.push(l)
  }
  estSalvar()
  toast('Acervo de exemplo carregado — dá para remover em um clique', 'success')
  estIr('estante')
}

async function estanteDemoRemover() {
  const n = livros.filter(l => l.demo).length
  if (!n) return
  const ok = await confirmModal({
    title: 'Remover o acervo de exemplo?',
    html: `<p>Saem os <b>${n} livros de exemplo</b>. Nada do seu acervo de verdade é tocado.</p>`,
    confirmText: 'Remover', danger: true, icon: 'trash'
  })
  if (!ok) return
  livros = livros.filter(l => !l.demo)
  estSalvar()
  toast('Exemplo removido', 'success')
  estIr('estante')
}

// ================================================================
// FORMATADORES
// ================================================================
function _estDataBR(iso) {
  if (!iso) return ''
  const [a, m, d] = String(iso).split('-')
  return `${d}/${m}/${a.slice(2)}`
}
function _estDur(min) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`
}
