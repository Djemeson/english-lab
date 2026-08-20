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
let _estVista = 'estante'      // estante | serie | ficha | form | painel
let _estId = null              // livro da ficha / edição
let _estSerie = ''             // série aberta (nome)
let _estAutor = ''             // autor aberto (nome)
// Dentro da prateleira de um autor, repetir o nome dele embaixo de cada capa
// é ruído: cinco cards dizendo "Stephen King" numa tela chamada Stephen King.
// A linha passa a dizer o que ali VARIA — o volume, ou o ano.
let _estOcultaAutor = false
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
  if (_estVista === 'serie')  return _estRenderSerie()
  if (_estVista === 'autor')  return _estRenderAutor()
  _estRenderEstante()
}

function _estAcoesHTML() {
  if (_estVista !== 'estante') {
    // Da ficha de um volume, voltar para a ESTANTE pularia a série de onde ele
    // veio — e num mangá de 40 volumes isso é perder o lugar.
    const l = _estVista === 'ficha' ? livroPorId(_estId) : null
    const serie = l && (l.serie || '').trim()
    const autor = _estVista === 'serie'
      ? (livros.find(x => (x.serie || '').trim().toLowerCase() === String(_estSerie).toLowerCase()) || {}).author
      : (l && l.author)
    const voltaAutor = estModoAgrupar() === 'autor' && String(autor || '').trim()
    return `${serie ? `<button class="btn btn-ghost btn-sm" onclick="estAbrirSerie(${_estArg(serie)})">${ic('chevronLeft','ic-sm')} ${esc(serie)}</button>` : ''}
      ${voltaAutor ? `<button class="btn btn-ghost btn-sm" onclick="estAbrirAutor(${_estArg(autor.trim())})">${ic('chevronLeft','ic-sm')} ${esc(autor.trim())}</button>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="estIr('estante')">${ic('chevronLeft','ic-sm')} Estante</button>`
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
  const agrupar = estModoAgrupar()
  const itens = _estAgrupar(_estFiltrar())
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
      ${(_estTemSerie() || _estTemAutorRepetido()) ? `
        <select class="est-select est-select-sm" aria-label="Agrupar" onchange="estSetAgrupar(this.value)"
                data-tip="Junta numa capa só o que é da mesma obra ou da mesma pessoa">
          ${[['serie','Agrupar: séries'],['autor','Agrupar: autor'],['nada','Sem agrupar']]
            .map(([v,r]) => `<option value="${v}"${agrupar === v ? ' selected' : ''}>${r}</option>`).join('')}
        </select>` : ''}
      <button class="est-chip" onclick="estReunirModal()" data-tip="Autor, série, gênero, status e busca de dados — em vários de uma vez">${ic('layers','ic-3xs')} Editar vários</button>
    </div>
    ${itens.length
      ? (visual === 'grade'
          ? `<div class="ler-estante">${itens.map(_estItemCard).join('')}</div>`
          : `<div class="est-lista">${itens.map(_estItemLinha).join('')}</div>`)
      : `<div class="est-nada">${ic('search','ic-lg')}<p>Nada aqui com esse filtro.</p>
         <button class="btn btn-ghost btn-sm" onclick="estLimparFiltros()">Limpar filtros</button></div>`}`
}

// ================================================================
// SÉRIES — o volume 12 não é um livro solto
// ================================================================
// Mangá vem em dezenas de volumes, e uma estante que os trata como obras
// independentes vira uma parede de capas iguais onde não se acha nada. Aqui
// eles viram UM card, que abre na lista dos volumes.
//
// ⚠️ SÉRIE DE UM VOLUME SÓ NÃO É SÉRIE. O livro volta a aparecer sozinho —
// senão marcar a série num livro avulso o esconderia atrás de uma capa que
// promete uma coleção que não existe.
function _estTemSerie() {
  const c = {}
  for (const l of livros) {
    const s = (l.serie || '').trim().toLowerCase()
    if (s) { c[s] = (c[s] || 0) + 1; if (c[s] > 1) return true }
  }
  return false
}
function _estTemAutorRepetido() {
  const c = {}
  for (const l of livros) {
    const a = (l.author || '').trim().toLowerCase()
    if (a) { c[a] = (c[a] || 0) + 1; if (c[a] > 1) return true }
  }
  return false
}

// O modo de agrupamento é `'serie' | 'autor' | 'nada'`.
// ⚠️ Era um booleano ("agrupar séries, sim ou não") até ele pedir agrupamento
// por autor: *"tem autores que gosto muito de ler e vão ter vários livros
// deles. tipo stephen king."* Valor antigo `true`/`false` continua sendo lido.
function estModoAgrupar() {
  const v = estPref('agrupar', 'serie')
  if (v === true) return 'serie'
  if (v === false) return 'nada'
  return v
}

function _estAgrupar(lista) {
  const modo = estModoAgrupar()
  if (modo === 'nada') return lista.map(l => ({ l }))

  // AUTOR: as séries daquele autor continuam agrupadas DENTRO do grupo dele —
  // senão Oda apareceria com "40 livros" quando na verdade tem uma obra em 40
  // volumes, e o número diria a coisa errada.
  if (modo === 'autor') {
    const grupos = new Map(), itens = []
    for (const l of lista) {
      const a = (l.author || '').trim()
      if (!a) { itens.push({ l }); continue }
      const k = a.toLowerCase()
      if (!grupos.has(k)) { const g = { autor: a, obras: [] }; grupos.set(k, g); itens.push(g) }
      grupos.get(k).obras.push(l)
    }
    return itens.map(it => {
      if (!it.autor) return it
      if (it.obras.length < 2) return { l: it.obras[0] }
      it.series = _estSeriesDe(it.obras)
      return it
    })
  }

  const grupos = new Map(), itens = []
  for (const l of lista) {
    const s = (l.serie || '').trim()
    if (!s) { itens.push({ l }); continue }
    const k = s.toLowerCase()
    if (!grupos.has(k)) {
      const g = { serie: s, vols: [] }
      grupos.set(k, g); itens.push(g)
    }
    grupos.get(k).vols.push(l)
  }
  // Desfaz o grupo de um volume só e ordena os volumes pelo número.
  return itens.map(it => {
    if (!it.serie) return it
    if (it.vols.length < 2) return { l: it.vols[0] }
    it.vols.sort((a, b) => (Number(a.serieNum) || 9999) - (Number(b.serieNum) || 9999))
    return it
  })
}

// Quantas OBRAS há numa lista de livros: cada série conta como uma, os avulsos
// contam um cada. É o número que a gente diz na tela do autor.
function _estSeriesDe(lista) {
  const s = new Set()
  let avulsos = 0
  for (const l of lista) {
    const n = (l.serie || '').trim().toLowerCase()
    if (n) s.add(n); else avulsos++
  }
  return { series: s.size, avulsos, obras: s.size + avulsos }
}

// O card do grupo mostra o volume que IMPORTA: o que está sendo lido; na falta
// dele, o primeiro que ainda não foi lido; na falta dos dois, o último. Mostrar
// sempre o volume 1 faria a capa de quem está no volume 40 nunca mudar.
function _estVolAtual(vols) {
  return vols.find(v => v.status === 'lendo')
      || vols.find(v => v.status !== 'lido')
      || vols[vols.length - 1]
}

function _estItemCard(it) {
  if (it.serie) return _estCardSerie(it)
  if (it.autor) return _estCardAutor(it)
  return _estCard(it.l)
}
function _estItemLinha(it) {
  if (it.serie) return _estLinhaSerie(it)
  if (it.autor) return _estLinhaAutor(it)
  return _estLinha(it.l)
}

// ================================================================
// AUTOR — a prateleira de quem você lê sempre
// ================================================================
// Pedido dele: *"tem autores que gosto muito de ler e vão ter vários livros
// deles. tipo stephen king."* Mesma mecânica da série, com uma diferença que
// muda o número na tela: aqui se contam OBRAS, não arquivos — os 40 volumes
// de um mangá são UMA obra do autor, não quarenta.
// ⚠️ "O QUE ESTÁ SENDO LIDO" SÓ GANHA SE TIVER CAPA. Visto na tela: a
// prateleira do Stephen King mostrou o retângulo vazio de *The Shining* (em
// leitura, sem capa) tendo a capa real de *Billy Summers* no mesmo grupo. Um
// card de autor sem imagem nenhuma é o pior resultado possível — a capa é o
// que faz a prateleira ser reconhecida de longe.
function _estAutorCapa(obras) {
  const temCapa = o => !!(o.cover || o.coverUrl)
  return obras.find(o => o.status === 'lendo' && temCapa(o))
      || obras.find(temCapa)
      || obras.find(o => o.status === 'lendo')
      || obras[0]
}
function _estAutorResumo(obras) {
  const c = _estSeriesDe(obras)
  const lidos = obras.filter(o => o.status === 'lido').length
  return { ...c, lidos,
    txt: `${c.obras} ${c.obras === 1 ? 'obra' : 'obras'}${c.series ? ` · ${c.series} ${c.series === 1 ? 'série' : 'séries'}` : ''}` }
}
const _estArg = v => JSON.stringify(v).replace(/"/g, '&quot;')

function _estCardAutor(g) {
  const capa = _estAutorCapa(g.obras)
  const r = _estAutorResumo(g.obras)
  const pct = Math.round(g.obras.reduce((s, o) => s + estPct(o), 0) / g.obras.length * 100)
  return `
    <div class="ler-card est-card est-card-autor" onclick="estAbrirAutor(${_estArg(g.autor)})"
         data-tip="${escA(`${r.txt} · ${r.lidos} ${r.lidos === 1 ? 'lida' : 'lidas'}`)}">
      <div class="ler-capa">${_estCapaHTML(capa)}
        <span class="est-serie-n">${g.obras.length} ${g.obras.length === 1 ? 'livro' : 'livros'}</span>
        ${pct > 0 ? `<span class="ler-capa-pct">${pct}%</span>` : ''}
      </div>
      <div class="ler-card-nome">${esc(g.autor)}</div>
      <div class="ler-card-autor">${esc(r.txt)}</div>
      <div class="ler-card-barra"><i style="width:${pct}%;background:var(--role-ia)"></i></div>
    </div>`
}

function _estLinhaAutor(g) {
  const capa = _estAutorCapa(g.obras)
  const r = _estAutorResumo(g.obras)
  const pct = Math.round(g.obras.reduce((s, o) => s + estPct(o), 0) / g.obras.length * 100)
  return `
    <div class="est-linha" onclick="estAbrirAutor(${_estArg(g.autor)})">
      <div class="est-linha-capa">${_estCapaHTML(capa)}</div>
      <div class="est-linha-meio">
        <div class="est-linha-nome">${esc(g.autor)}
          <span class="est-selo">${ic('pencil','ic-3xs')} ${g.obras.length} ${g.obras.length === 1 ? 'livro' : 'livros'}</span></div>
        <div class="est-linha-sub">${esc(r.txt)} · ${r.lidos} ${r.lidos === 1 ? 'lida' : 'lidas'}</div>
        <div class="est-linha-barra"><i style="width:${pct}%;background:var(--role-ia)"></i></div>
      </div>
      <div class="est-linha-dir"><span class="est-linha-pct">${pct}%</span></div>
      <div class="est-linha-acoes">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();estAbrirAutor(${_estArg(g.autor)})">Abrir</button>
      </div>
    </div>`
}

function estAbrirAutor(nome) { _estAutor = nome; estIr('autor') }

function _estRenderAutor() {
  const alvo = String(_estAutor || '').toLowerCase()
  const obras = livros.filter(l => (l.author || '').trim().toLowerCase() === alvo)
  if (!obras.length) { estIr('estante'); return }
  const r = _estAutorResumo(obras)
  const pct = Math.round(obras.reduce((s, o) => s + estPct(o), 0) / obras.length * 100)
  const visual = estPref('visual', 'grade')
  const minutos = obras.reduce((s, o) => s + (o.minutos || 0), 0)
  const paginas = obras.reduce((s, o) => s + Math.round(estPct(o) * estPaginas(o)), 0)
  // Dentro do autor, a série continua sendo UM card — 40 volumes soltos aqui
  // afogariam os outros livros dele.
  const itens = _estAgruparEm('serie', obras)

  _estOcultaAutor = true
  el('ler-area').innerHTML = `
    <div class="est-serie-topo">
      <div>
        <h2>${esc(_estAutor)}</h2>
        <p>${esc(r.txt)} · <b>${r.lidos}</b> ${r.lidos === 1 ? 'lida' : 'lidas'} · ${pct}% do que você tem dele${
          paginas ? ` · ${paginas.toLocaleString('pt-BR')} ${paginas === 1 ? 'página lida' : 'páginas lidas'}` : ''}${
          minutos ? ` · ${_estDur(minutos)} de leitura` : ''}</p>
        <div class="est-ficha-barra" style="max-width:420px;margin-top:10px"><i style="width:${pct}%;background:var(--role-ia)"></i></div>
      </div>
    </div>
    ${visual === 'grade'
      ? `<div class="ler-estante">${itens.map(_estItemCard).join('')}</div>`
      : `<div class="est-lista">${itens.map(_estItemLinha).join('')}</div>`}`
  // ⚠️ DESLIGAR AQUI, e não em outro lugar: o sinal vale só enquanto esta tela
  // se desenha. Esquecido ligado, a estante inteira perderia o nome do autor.
  _estOcultaAutor = false
}

// Agrupa numa modalidade específica, sem depender da preferência salva — é o
// que deixa a tela do autor agrupar séries mesmo estando no modo "autor".
function _estAgruparEm(modo, lista) {
  const antes = estPref('agrupar', 'serie')
  saveUiPref('est_agrupar', modo)
  const r = _estAgrupar(lista)
  saveUiPref('est_agrupar', antes)
  return r
}

function _estCardSerie(g) {
  const atual = _estVolAtual(g.vols)
  const lidos = g.vols.filter(v => v.status === 'lido').length
  const pct = Math.round(g.vols.reduce((s, v) => s + estPct(v), 0) / g.vols.length * 100)
  const num = atual.serieNum ? `vol. ${esc(String(atual.serieNum))}` : ''
  return `
    <div class="ler-card est-card est-card-serie" onclick="estAbrirSerie(${JSON.stringify(g.serie).replace(/"/g, '&quot;')})"
         data-tip="${escA(`${g.vols.length} volumes · ${lidos} lidos`)}">
      <div class="ler-capa">${_estCapaHTML(atual)}
        <span class="est-serie-n">${g.vols.length} vols</span>
        ${pct > 0 ? `<span class="ler-capa-pct">${pct}%</span>` : ''}
      </div>
      <div class="ler-card-nome">${esc(g.serie)}</div>
      <div class="ler-card-autor">${esc(atual.author || '')}${num ? ` · ${num}` : ''}</div>
      <div class="ler-card-barra"><i style="width:${pct}%;background:var(--role-fonte)"></i></div>
    </div>`
}

function _estLinhaSerie(g) {
  const atual = _estVolAtual(g.vols)
  const lidos = g.vols.filter(v => v.status === 'lido').length
  const pct = Math.round(g.vols.reduce((s, v) => s + estPct(v), 0) / g.vols.length * 100)
  return `
    <div class="est-linha" onclick="estAbrirSerie(${JSON.stringify(g.serie).replace(/"/g, '&quot;')})">
      <div class="est-linha-capa">${_estCapaHTML(atual)}</div>
      <div class="est-linha-meio">
        <div class="est-linha-nome">${esc(g.serie)}
          <span class="est-selo">${ic('layers','ic-3xs')} ${g.vols.length} volumes</span></div>
        <div class="est-linha-sub">${esc(atual.author || '')} · ${lidos} ${lidos === 1 ? 'lido' : 'lidos'}${
          atual.status === 'lendo' && atual.serieNum ? ` · lendo o vol. ${esc(String(atual.serieNum))}` : ''}</div>
        <div class="est-linha-barra"><i style="width:${pct}%;background:var(--role-fonte)"></i></div>
      </div>
      <div class="est-linha-dir"><span class="est-linha-pct">${pct}%</span></div>
      <div class="est-linha-acoes">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();estAbrirSerie(${JSON.stringify(g.serie).replace(/"/g, '&quot;')})">Abrir</button>
      </div>
    </div>`
}

function estAbrirSerie(nome) { _estSerie = nome; estIr('serie') }
function estSetAgrupar(modo) { estSetPref('agrupar', modo); _estRenderEstante() }

function _estRenderSerie() {
  const nome = _estSerie
  const vols = livros.filter(l => (l.serie || '').trim().toLowerCase() === String(nome || '').toLowerCase())
    .sort((a, b) => (Number(a.serieNum) || 9999) - (Number(b.serieNum) || 9999))
  if (!vols.length) { estIr('estante'); return }
  const lidos = vols.filter(v => v.status === 'lido').length
  const lendo = vols.find(v => v.status === 'lendo')
  const proximo = vols.find(v => v.status !== 'lido')
  const pct = Math.round(vols.reduce((s, v) => s + estPct(v), 0) / vols.length * 100)
  const visual = estPref('visual', 'grade')

  el('ler-area').innerHTML = `
    <div class="est-serie-topo">
      <div>
        <h2>${esc(nome)}</h2>
        <p>${vols.length} volumes · <b>${lidos}</b> ${lidos === 1 ? 'lido' : 'lidos'} · ${pct}% da série${
          vols[0].author ? ` · ${esc(vols[0].author)}` : ''}</p>
        <div class="est-ficha-barra" style="max-width:420px;margin-top:10px"><i style="width:${pct}%;background:var(--role-fonte)"></i></div>
      </div>
      <div class="est-serie-acoes">
        ${proximo ? `<button class="btn btn-primary btn-sm" onclick="${proximo.kind === 'fisico'
            ? `estProgressoModal('${proximo.id}')` : `lerAbrir('${proximo.id}')`}">
          ${ic('bookOpen','ic-sm')} ${lendo ? 'Continuar' : 'Começar'} o vol. ${esc(String(proximo.serieNum || '?'))}</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="estRenomearSerie(${JSON.stringify(nome).replace(/"/g, '&quot;')})">${ic('pencil','ic-sm')} Renomear</button>
        <button class="btn btn-ghost btn-sm" onclick="estDesfazerSerie(${JSON.stringify(nome).replace(/"/g, '&quot;')})">${ic('layers','ic-sm')} Desfazer série</button>
      </div>
    </div>
    ${visual === 'grade'
      ? `<div class="ler-estante">${vols.map(_estCard).join('')}</div>`
      : `<div class="est-lista">${vols.map(_estLinha).join('')}</div>`}`
}

function estRenomearSerie(nome) {
  inputModal({
    title: 'Renomear a série', label: 'O nome novo vale para todos os volumes.',
    value: nome, confirmText: 'Renomear',
    onConfirm: novo => {
      const alvo = String(nome || '').toLowerCase()
      livros.forEach(l => {
        if ((l.serie || '').trim().toLowerCase() === alvo) { l.serie = novo; l.updatedAt = Date.now() }
      })
      _estSerie = novo
      estSalvar(); toast('Série renomeada', 'success'); estanteRender()
    }
  })
}

async function estDesfazerSerie(nome) {
  const alvo = String(nome || '').toLowerCase()
  const n = livros.filter(l => (l.serie || '').trim().toLowerCase() === alvo).length
  const ok = await confirmModal({
    title: 'Desfazer a série?', icon: 'layers', confirmText: 'Desfazer',
    html: `<p>Os <b>${n} volumes</b> voltam a aparecer soltos na estante. Nenhum livro é apagado
           e nenhuma leitura se perde — só a etiqueta de série sai.</p>`
  })
  if (!ok) return
  livros.forEach(l => {
    if ((l.serie || '').trim().toLowerCase() === alvo) { l.serie = ''; l.serieNum = ''; l.updatedAt = Date.now() }
  })
  estSalvar(); toast('Série desfeita', 'info'); estIr('estante')
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
      <div class="ler-card-autor">${esc(_estSubCard(l))}</div>
      ${l.nota ? `<div class="est-card-nota">${_estEstrelas(l.nota)}</div>` : ''}
      <div class="ler-card-barra"><i style="width:${pct}%;background:${EST_STATUS[l.status]?.cor || 'var(--primary)'}"></i></div>
      <button class="ler-card-x" data-tip="Ficha, status e mais"
              onclick="estMenu(event,'${l.id}')">${ic('chevronDown','ic-sm')}</button>
    </div>`
}

// A segunda linha do card: normalmente o autor; na prateleira dele, o que
// distingue um livro do outro ali dentro.
function _estSubCard(l) {
  if (!_estOcultaAutor) return l.author || ''
  if (l.serie) return `${l.serie}${l.serieNum ? ` · vol. ${l.serieNum}` : ''}`
  // Último recurso é o STATUS, e não string vazia: medido na tela, os livros
  // sem ano nem gênero ficavam com uma linha em branco sob a capa, e a coluna
  // de cards perdia o alinhamento. Status todo livro tem.
  return l.ano ? String(l.ano) : (l.genero || (EST_STATUS[l.status] || {}).rotulo || '')
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
        <div class="est-linha-sub">${_estOcultaAutor
          ? esc(_estSubCard(l) || '—')
          : `${esc(l.author || 'Autor não informado')}${l.serie ? ` · ${esc(l.serie)}${l.serieNum ? ` #${esc(String(l.serieNum))}` : ''}` : ''}`}</div>
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
        <button class="btn btn-ghost btn-sm est-linha-menu" data-tip="Ficha, status e mais"
                onclick="estMenu(event,'${l.id}')">${ic('chevronDown','ic-sm')}</button>
      </div>
    </div>`
}

// ================================================================
// O MENU DO LIVRO — trocar de status sem abrir a ficha
// ================================================================
// ⚠️ ESTE MENU NASCEU DE UMA PERGUNTA DELE: *"como um livro vai pra Quero ler
// e Parado?"* Ia pela ficha, e só por ela — dois cliques e uma tela de
// distância para uma decisão que se toma olhando a capa. Pergunta sobre onde
// fica uma função é resposta sobre onde ela DEVERIA estar.
function estMenu(ev, id) {
  ev.stopPropagation(); ev.preventDefault()
  const antigo = document.getElementById('est-menu')
  document.getElementById('est-menu')?.remove()
  if (antigo && antigo.dataset.de === id) return      // clicar de novo fecha
  const l = livroPorId(id); if (!l) return

  const m = document.createElement('div')
  m.id = 'est-menu'; m.className = 'est-menu'; m.dataset.de = id
  m.innerHTML = `
    <button onclick="estMenuFechar();estIr('ficha','${l.id}')">${ic('info','ic-sm')} Abrir a ficha</button>
    ${l.kind !== 'fisico'
      ? `<button onclick="estMenuFechar();lerAbrir('${l.id}')">${ic('bookOpen','ic-sm')} Ler agora</button>`
      : `<button onclick="estMenuFechar();estProgressoModal('${l.id}')">${ic('pencil','ic-sm')} Registrar progresso</button>`}
    <div class="est-menu-sep">Status</div>
    ${Object.entries(EST_STATUS).map(([k, s]) => `
      <button class="${l.status === k ? 'on' : ''}" onclick="estMenuFechar();estSetLivroStatus('${l.id}','${k}')">
        <i style="background:${s.cor}"></i> ${s.rotulo}${l.status === k ? ` ${ic('check','ic-3xs')}` : ''}</button>`).join('')}
    <div class="est-menu-sep">Nota</div>
    <div class="est-menu-nota">${_estEstrelas(l.nota, l.id)}</div>
    <div class="est-menu-sep"></div>
    <button class="perigo" onclick="estMenuFechar();lerExcluir('${l.id}')">${ic('trash','ic-sm')} Remover da estante</button>`
  document.body.appendChild(m)

  // Posicionado à mão, e não em `position:absolute` dentro do card: o card tem
  // `overflow:hidden` na capa e a grade rola — o menu ficaria cortado.
  const r = ev.currentTarget.getBoundingClientRect()
  const larg = 210, alt = m.offsetHeight || 300
  let x = r.right - larg, y = r.bottom + 6
  if (x < 8) x = 8
  if (x + larg > innerWidth - 8) x = innerWidth - larg - 8
  if (y + alt > innerHeight - 8) y = Math.max(8, r.top - alt - 6)
  m.style.left = x + 'px'; m.style.top = y + 'px'
  setTimeout(() => {
    document.addEventListener('click', estMenuFechar, { once: true })
    document.addEventListener('keydown', _estMenuTecla)
  }, 0)
}
function estMenuFechar() {
  document.getElementById('est-menu')?.remove()
  document.removeEventListener('keydown', _estMenuTecla)
}
function _estMenuTecla(e) { if (e.key === 'Escape') estMenuFechar() }

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
  // As estrelas também moram DENTRO do menu do card: sem fechar, ele ficaria
  // pairando sobre uma estante já redesenhada, mostrando a nota antiga.
  if (document.getElementById('est-menu')) estMenuFechar()
  estanteRender()
}

// ================================================================
// EDITAR VÁRIOS — a tela do trabalho em lote
// ================================================================
// O caminho um-a-um existe (ficha -> Editar), mas ninguém corrige o autor de
// 40 volumes de One Piece à mão. Aqui ele marca os livros e diz o que muda:
// CAMPO EM BRANCO NÃO MEXE EM NADA. Essa é a regra que faz a tela ser segura —
// aplicar "tudo o que está no formulário" apagaria o autor certo de metade da
// seleção só porque o campo ficou vazio.
//
// Nasceu como "Reunir em série" e cresceu quando ele pediu autor em lote e a
// busca de metadados para EPUB e mangá: as três coisas são o mesmo gesto —
// marcar vários e aplicar de uma vez.
function estReunirModal(pre) {
  document.getElementById('est-reunir')?.remove()
  const cands = livros.slice().sort((a, b) =>
    String(obraNome(a.title)).localeCompare(String(obraNome(b.title)), 'pt'))
  const sugestao = pre || _estSugereSerie(cands)
  const ov = document.createElement('div')
  ov.id = 'est-reunir'; ov.className = 'srs-modal-overlay'
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove() })
  ov.innerHTML = `<div class="srs-modal-box" style="width:100%;max-width:680px">
    <h4 style="font-size:var(--fs-base);font-weight:700;margin-bottom:4px">Editar vários</h4>
    <p style="font-size:var(--fs-sm);color:var(--text2);margin-bottom:14px">
      Marque os livros e preencha só o que quer mudar — <b>campo em branco não altera nada</b>.</p>

    ${sugestao.ids.length >= 2 ? `
    <div class="est-lote-sugestao">
      ${ic('layers','ic-sm')}
      <span>Achei <b>${sugestao.ids.length} volumes</b> que parecem ser
        <b>${esc(sugestao.nome)}</b>.</span>
      <button class="btn btn-ghost btn-sm" onclick="estLoteUsarSugestao(${_estArg(sugestao.nome)},${_estArg(sugestao.ids)})">Usar</button>
    </div>` : ''}

    <div class="est-lote-campos">
      <label class="est-campo">
        <span>Autor</span>
        <input type="text" id="est-lote-autor" placeholder="ex.: Eiichiro Oda" list="est-lote-autores">
        <datalist id="est-lote-autores">${estAutoresExistentes().map(a => `<option value="${escA(a)}"></option>`).join('')}</datalist>
      </label>
      <label class="est-campo">
        <span>Série</span>
        <input type="text" id="est-reunir-nome" placeholder="ex.: One Piece" list="est-series-lista">
        <datalist id="est-series-lista">${estSeriesExistentes().map(x => `<option value="${escA(x)}"></option>`).join('')}</datalist>
      </label>
      <label class="est-campo">
        <span>Gênero</span>
        <input type="text" id="est-lote-genero" list="est-generos-lote">
        <datalist id="est-generos-lote">${EST_GENEROS.map(g => `<option value="${g}"></option>`).join('')}</datalist>
      </label>
      <label class="est-campo">
        <span>Status</span>
        <select id="est-lote-status">
          <option value="">— não mudar —</option>
          ${Object.entries(EST_STATUS).map(([k, v]) => `<option value="${k}">${v.rotulo}</option>`).join('')}
        </select>
      </label>
    </div>

    <label class="est-lote-check">
      <input type="checkbox" id="est-lote-meta">
      <span>Buscar dados no catálogo (capa, ano, editora, páginas, resumo) —
        <b>só preenche o que estiver vazio</b></span>
    </label>

    <div class="est-lote-topo">
      <span id="est-lote-conta">0 marcados</span>
      <span class="est-lote-botoes">
        <button class="est-chip" onclick="estLoteMarcar(true)">Marcar todos</button>
        <button class="est-chip" onclick="estLoteMarcar(false)">Desmarcar</button>
      </span>
    </div>
    <div class="est-reunir-lista" onchange="estLoteConta()">
      ${cands.map(l => `
        <label class="est-reunir-item">
          <input type="checkbox" value="${l.id}">
          <span class="est-reunir-nome">${esc(obraNome(l.title))}</span>
          <span class="est-reunir-num">${_estResumoLinha(l)}</span>
        </label>`).join('')}
    </div>
    <div id="est-lote-log" class="est-dica" style="margin-top:10px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('est-reunir').remove()">Cancelar</button>
      <button class="btn btn-primary btn-sm" id="est-lote-ok" onclick="estReunirFazer()">${ic('check','ic-sm')} Aplicar</button>
    </div>
  </div>`
  document.body.appendChild(ov)
  estLoteConta()
  setTimeout(() => document.getElementById('est-lote-autor')?.focus(), 30)
}

// A coluna da direita diz o que aquele livro JÁ tem — é o que evita marcar o
// volume errado numa lista de quarenta nomes quase idênticos.
function _estResumoLinha(l) {
  const p = []
  if (l.serie) p.push(esc(l.serie) + (l.serieNum ? ` #${esc(String(l.serieNum))}` : ''))
  else if (_estNumDoTitulo(obraNome(l.title))) p.push('vol. ' + _estNumDoTitulo(obraNome(l.title)))
  if (l.author) p.push(esc(l.author))
  return p.join(' · ') || '—'
}

// ⚠️ A SUGESTÃO PRECISA SER UM CLIQUE, NUNCA UM CAMPO JÁ PREENCHIDO.
// Pego no teste: o campo Série vinha com "Berserk" (o palpite), eu marquei os
// quatro volumes de One Piece para trocar o AUTOR — e os quatro foram parar na
// série Berserk. Num modal que aplica tudo o que está preenchido, um campo que
// o usuário não digitou é uma armadilha. Agora o palpite se apresenta, e só
// entra em cena se ele mandar.
function estLoteUsarSugestao(nome, ids) {
  const campo = document.getElementById('est-reunir-nome')
  if (campo) campo.value = nome
  document.querySelectorAll('#est-reunir .est-reunir-lista input[type=checkbox]')
    .forEach(i => { i.checked = ids.includes(i.value) })
  estLoteConta()
}

function estLoteMarcar(todos) {
  document.querySelectorAll('#est-reunir .est-reunir-lista input[type=checkbox]')
    .forEach(i => { i.checked = todos })
  estLoteConta()
}
function estLoteConta() {
  const n = document.querySelectorAll('#est-reunir .est-reunir-lista input:checked').length
  const e = document.getElementById('est-lote-conta')
  if (e) e.textContent = `${n} ${n === 1 ? 'marcado' : 'marcados'}`
}

function estAutoresExistentes() {
  return [...new Set(livros.map(l => (l.author || '').trim()).filter(Boolean))].sort()
}
function estSeriesExistentes() {
  return [...new Set(livros.map(l => (l.serie || '').trim()).filter(Boolean))].sort()
}

// Sugestão de partida: o maior conjunto de títulos que começam igual e têm
// número. Adivinhar bem economiza vinte cliques; adivinhar mal não custa nada,
// porque tudo continua editável antes de confirmar.
function _estSugereSerie(cands) {
  const grupos = new Map()
  for (const l of cands) {
    // ⚠️ SÓ O QUE AINDA NÃO TEM SÉRIE. Sem este filtro a sugestão apontava
    // para o maior grupo do acervo — que costuma ser justamente o que já foi
    // organizado, deixando de fora os volumes soltos que motivaram a tela.
    if ((l.serie || '').trim()) continue
    const d = estSerieDoNome(obraNome(l.title), true)
    if (!d) continue
    const k = d.serie.toLowerCase()
    if (!grupos.has(k)) grupos.set(k, { nome: d.serie, ids: [] })
    grupos.get(k).ids.push(l.id)
  }
  let melhor = { nome: '', ids: [] }
  for (const g of grupos.values()) if (g.ids.length > melhor.ids.length) melhor = g
  return melhor.ids.length >= 2 ? melhor : { nome: '', ids: [] }
}

async function estReunirFazer() {
  const g = id => (document.getElementById(id).value || '').trim()
  const autor = g('est-lote-autor'), serie = g('est-reunir-nome')
  const genero = g('est-lote-genero'), status = g('est-lote-status')
  const buscarMeta = document.getElementById('est-lote-meta').checked
  const ids = [...document.querySelectorAll('#est-reunir .est-reunir-lista input:checked')].map(i => i.value)
  if (!ids.length) { toast('Marque pelo menos um livro.', 'warning'); return }
  if (!autor && !serie && !genero && !status && !buscarMeta) {
    toast('Preencha algum campo — ou marque a busca no catálogo.', 'warning'); return
  }

  ids.forEach((id, i) => {
    const l = livroPorId(id); if (!l) return
    if (autor) l.author = autor
    if (genero) l.genero = genero
    if (serie) {
      l.serie = serie
      l.serieNum = _estNumDoTitulo(obraNome(l.title)) || Number(l.serieNum) || (i + 1)
    }
    if (status) estStatusEmLote(l, status)
    l.updatedAt = Date.now()
  })
  estSalvar()

  if (buscarMeta) {
    const ok = document.getElementById('est-lote-ok')
    if (ok) { ok.disabled = true; ok.innerHTML = 'Buscando…' }
    const r = await estMetaEmLote(ids, m => {
      const log = document.getElementById('est-lote-log')
      if (log) log.textContent = m
    })
    document.getElementById('est-reunir')?.remove()
    toast(r.achou
      ? `${r.achou} de ${ids.length} completados pelo catálogo`
      : 'O catálogo não reconheceu nenhum destes títulos', r.achou ? 'success' : 'info')
  } else {
    document.getElementById('est-reunir')?.remove()
    toast(`${ids.length} ${ids.length === 1 ? 'livro atualizado' : 'livros atualizados'}`, 'success')
  }

  if (serie && ids.length > 1) { estSetPref('agrupar', 'serie'); estAbrirSerie(serie) }
  else estanteRender()
}

// Troca o status sem redesenhar a tela nem disparar um toast por livro —
// dentro de um laço de quarenta, cada render seria um congelamento visível.
function estStatusEmLote(l, s) {
  const hoje = estData()
  l.status = s
  if (s === 'lido') {
    l.fim = l.fim || hoje
    l.anoFim = Number(String(l.fim).slice(0, 4))
    if (!l.inicio) l.inicio = hoje
    if (l.kind === 'fisico') { const p = estPaginas(l); if (p) l.pagAtual = p }
    else if ((l.progress || 0) < 0.995) l.progress = 1
    estRegistrar(l, 1, hoje, true)
  } else {
    if (s === 'lendo' && !l.inicio) l.inicio = hoje
    l.fim = null; l.anoFim = null
  }
}

// ================================================================
// COMPLETAR PELO CATÁLOGO — para o que já entrou pelo arquivo
// ================================================================
// Pedido dele: *"que dê pra puxar metadados de itens que eu adiciono tipo epub
// e manga."* O EPUB traz título, autor e capa e mais nada; o CBZ de mangá
// muitas vezes não traz nem o autor. Ano, editora, gênero, sinopse e número de
// páginas ficam vazios para sempre — e é isso que a estante usa para ordenar,
// filtrar e mostrar.
//
// ⚠️ AS TRÊS REGRAS QUE FAZEM ISTO SER SEGURO:
//   1. NUNCA sobrescreve o que já está preenchido (a não ser que ele mande,
//      na tela individual). O metadado do arquivo é mais confiável que o
//      palpite de um catálogo sobre um título parecido.
//   2. O TÍTULO NUNCA é trocado automaticamente. É a chave que liga o livro às
//      capturas de vocabulário (`obraNome`) — trocar em silêncio quebraria a
//      aba "Capturas" de todo mundo.
//   3. Em lote, só aplica quando o resultado PARECE ser o mesmo livro
//      (semelhança de título), porque ali ninguém está olhando.

// ⚠️ A COTA DO GOOGLE SE LEMBRA POR MEIA HORA. Sem isto, um lote de 40 volumes
// dispara 40 requisições que já se sabe que vão voltar 429 — uma por livro,
// cada uma com sua ida e volta e sua linha vermelha no console. Ao primeiro
// 429, a fonte é dada como fora do ar e as buscas seguintes vão direto para a
// Open Library. Meia hora depois ela é tentada de novo, porque a cota é diária
// mas o relógio dela não é o nosso.
let _estGoogleFora = 0
function _estGooglePodeTentar() { return !_estGoogleFora || (Date.now() - _estGoogleFora) > 30 * 60 * 1000 }
function _estGoogleCaiu() { _estGoogleFora = Date.now() }

// Consulta montada para o caso real: mangá busca pela SÉRIE + volume (o título
// do arquivo, "One Piece v12", não existe em catálogo nenhum).
function _estConsultaDe(l) {
  const base = (l.serie || '').trim() || _estTituloLimpo(obraNome(l.title)) || ''
  const vol = l.serie && l.serieNum ? ` vol ${l.serieNum}` : ''
  const autor = (l.author || '').trim()
  return `${base}${vol}${autor ? ' ' + autor : ''}`.trim()
}

// ⚠️ O TÍTULO DO ARQUIVO VEM COM O CARIMBO DA EDIÇÃO, e o catálogo não tem
// esse carimbo. Medido: o EPUB dele chama-se "Billy Summers (US Edition)"; o
// catálogo devolve "Billy Summers", e a comparação por palavras dava 2 de 4 —
// abaixo do corte de 0,6. O livro certo era recusado por causa de duas
// palavras que não são do título.
function _estTituloLimpo(t) {
  return String(t || '')
    .replace(/[\(\[\{][^)\]\}]*[\)\]\}]/g, ' ')              // (US Edition), [Unabridged]
    .replace(/\b(unabridged|abridged|edition|ed|us|uk|deluxe|revised|reprint|anniversary|illustrated|boxed set|omnibus)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-–—:,.]+$/, '')
    .trim()
}

// Semelhança por palavras: quantas palavras do nosso título aparecem no do
// catálogo. Não é distância de edição — é o que distingue "One Piece, Vol. 12"
// (bom) de "The Art of One Piece" (ruim) sem inventar sofisticação.
// ⚠️ DEVOLVE `null` QUANDO NÃO DÁ PARA COMPARAR, e isso não é o mesmo que
// zero. Visto no teste: o único resultado para "Berserk vol 1" foi
// «ベルセルク 1» — o livro certo, com o volume certo, e semelhança 0 porque
// não há uma palavra latina para casar. Zero diria "é outro livro"; `null` diz
// "não sei", e aí quem decide é o número do volume. Mangá em catálogo grande
// cai nisto o tempo todo.
function _estParecido(a, b) {
  const limpa = t => String(t || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1)
  const A = limpa(a), B = new Set(limpa(b))
  if (!A.length) return 0
  if (!B.size) return null
  return A.filter(w => B.has(w)).length / A.length
}

// Uma busca, as duas fontes, o melhor candidato. Devolve `null` quando nada
// serve — o silêncio aqui é resposta, não falha.
async function estMetaBuscar(l) {
  const q = _estConsultaDe(l)
  if (!q) return []
  const saida = []
  try {
    if (!_estGooglePodeTentar()) throw new Error('cota')
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`)
    if (r.status === 429) _estGoogleCaiu()
    else {
      const j = await r.json()
      for (const it of (j.items || [])) {
        const v = it.volumeInfo || {}
        const img = (v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || ''
        saida.push({
          fonte: 'Google Books', title: v.title || '', author: (v.authors || []).join(', '),
          editora: v.publisher || '', ano: (v.publishedDate || '').slice(0, 4),
          isbn: ((v.industryIdentifiers || []).find(x => /ISBN_13|ISBN_10/.test(x.type)) || {}).identifier || '',
          paginas: v.pageCount || '', genero: (v.categories || [])[0] || '',
          resumo: (v.description || '').slice(0, 1200), capa: img.replace(/^http:/, 'https:')
        })
      }
    }
  } catch (e) {}
  if (!saida.length) {
    try {
      const campos = 'key,title,author_name,first_publish_year,number_of_pages_median,cover_i,publisher,isbn,subject'
      const r2 = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5&fields=${campos}`)
      const j2 = await r2.json()
      for (const d of (j2.docs || [])) {
        saida.push({
          fonte: 'Open Library', key: d.key || '', title: d.title || '',
          author: (d.author_name || []).join(', '), editora: (d.publisher || [])[0] || '',
          ano: d.first_publish_year || '', isbn: (d.isbn || [])[0] || '',
          paginas: d.number_of_pages_median || '', genero: (d.subject || [])[0] || '', resumo: '',
          capa: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : ''
        })
      }
    } catch (e) {}
  }
  // ⚠️ O NÚMERO DO VOLUME DESEMPATA, E PESA MAIS QUE O TÍTULO. Medido: para o
  // volume 2 de One Piece, os três primeiros resultados vieram com semelhança
  // 1,00 — "ONE PIECE 1", "ONE PIECE 2" e "ONE PIECE 13" — e o primeiro da
  // fila era o volume ERRADO. Numa série, gravar ano, páginas e capa de outro
  // volume é pior que não gravar nada, porque parece certo.
  const alvo = (l.serie || '').trim() || _estTituloLimpo(obraNome(l.title))
  const numAlvo = Number(l.serieNum) || 0
  return saida.map(r => {
    const semelhanca = _estParecido(alvo, r.title)
    const incomparavel = semelhanca === null
    const num = _estNumDeTitulo(r.title)
    const bate = numAlvo && num === numAlvo
    const briga = numAlvo && num && num !== numAlvo
    // ⚠️ PARASITA DE CATÁLOGO. "Summary of The Martian by Andy Weir —
    // Conversation Starters" contém TODAS as palavras da busca e por isso
    // ganhava de "The Martian" na ordenação. Livro sobre o livro não é o
    // livro; a penalidade empurra esses para o fim sem escondê-los.
    const parasita = /\b(summary|summaries|study guide|conversation starters|analysis|workbook|quiz|companion|unofficial|cliffsnotes|sparknotes)\b/i.test(r.title)
    return { ...r, semelhanca: incomparavel ? 0 : semelhanca, incomparavel, num,
             volumeBate: !!bate, volumeBriga: !!briga, parasita,
             peso: (incomparavel ? 0.35 : semelhanca) + (bate ? 0.6 : 0) - (briga ? 0.9 : 0) - (parasita ? 1.2 : 0) }
  }).sort((a, b) => b.peso - a.peso)
}

// Número solto num título de catálogo: "ONE PIECE 2", "One Piece, Vol. 12".
function _estNumDeTitulo(t) {
  const str = String(t || '')
  const m = str.match(/\bvol\.?\s*(\d{1,3})\b/i) || str.match(/(\d{1,3})\s*$/)
  return m ? Number(m[1]) : 0
}

// ⚠️ O "GÊNERO" DA OPEN LIBRARY É UM ASSUNTO QUALQUER, e o primeiro da lista
// costuma ser catalogação, não gênero: no teste, Billy Summers voltou com
// "New York Times reviewed". Gênero é uma palavra ou duas ("Suspense",
// "Ficção científica"); frase comprida, com números ou com cara de fichário
// não entra — campo com lixo é pior que campo vazio, porque some do radar.
function _estGeneroServe(g) {
  const t = String(g || '').trim()
  if (t.length < 3 || t.length > 28) return false
  if (/\d/.test(t)) return false
  if (/(review|nyt|new york times|accessible|protected daisy|in library|overdrive|fiction in english|lending|award)/i.test(t)) return false
  return t.split(/\s+/).length <= 3
}

// Aplica um resultado sobre o livro. `sobrescrever` só vem `true` do botão
// explícito da ficha — em lote é sempre `false`.
function estMetaAplicar(l, r, sobrescrever) {
  const campos = ['author', 'editora', 'ano', 'isbn', 'paginas', 'genero', 'resumo']
  let n = 0
  for (const c of campos) {
    const novo = r[c]
    if (!novo) continue
    if (c === 'genero' && !_estGeneroServe(novo)) continue
    const atual = l[c]
    const vazio = atual === undefined || atual === null || atual === '' || atual === 0
    if (vazio || sobrescrever) { l[c] = novo; n++ }
  }
  // A capa do arquivo (miniatura do EPUB) vence a do catálogo, sempre: é a
  // capa DAQUELA edição, e não a de uma parecida.
  if (r.capa && (!l.cover && (!l.coverUrl || sobrescrever))) { l.coverUrl = r.capa; n++ }
  if (n) l.updatedAt = Date.now()
  return n
}

// Em lote: um livro por vez, com respiro entre as chamadas. Duas razões — as
// duas fontes são gratuitas e o Google já respondeu 429 uma vez nesta mesma
// tela; e disparar quarenta requisições juntas é a receita para tomar bloqueio
// justo quando ele mais precisa da tela.
async function estMetaEmLote(ids, aoAndar) {
  let achou = 0, i = 0
  for (const id of ids) {
    i++
    const l = livroPorId(id); if (!l) continue
    if (aoAndar) aoAndar(`Buscando ${i} de ${ids.length}: ${obraNome(l.title)}…`)
    try {
      const res = await estMetaBuscar(l)
      // Em lote ninguém está olhando: além da semelhança de título, se o livro
      // tem número de volume, o resultado PRECISA ser daquele volume.
      const numAlvo = Number(l.serieNum) || 0
      // Título ilegível para nós (japonês, russo) só passa quando o NÚMERO do
      // volume bate — aí o sinal vem do número, não do nome. Sem número de
      // volume, título incomparável não entra: seria fé, não evidência.
      const bom = res.find(r => !r.parasita
                              && (r.incomparavel ? (numAlvo && r.volumeBate) : r.semelhanca >= 0.6)
                              && (!numAlvo || r.volumeBate))
      if (bom) {
        if (bom.fonte === 'Open Library' && bom.key && !bom.resumo) {
          try {
            const w = await (await fetch(`https://openlibrary.org${bom.key}.json`)).json()
            const d = typeof w.description === 'string' ? w.description : (w.description && w.description.value) || ''
            if (d) bom.resumo = d.slice(0, 1200)
          } catch (e) {}
        }
        if (estMetaAplicar(l, bom, false)) achou++
      }
    } catch (e) {}
    if (i < ids.length) await new Promise(r => setTimeout(r, 220))
  }
  estSalvar()
  return { achou, total: ids.length }
}

// ---- AUTOMÁTICO: o livro que acabou de entrar se completa sozinho ----
// ⚠️ ELE PEDIU ASSIM, com todas as letras: *"os metadados quero que puxe
// automaticamente. não vi essa opção."* — e tinha razão de não ver: existia só
// dentro de "Editar vários" (uma tela de lote) e num botão da ficha. Coisa que
// deve acontecer sempre não pode depender de o usuário achar um botão.
//
// Três freios, porque isto roda sem ninguém olhando:
//   1. Só preenche campo VAZIO — nunca discute com o metadado do arquivo.
//   2. Só aceita resultado que pareça ser o mesmo livro (e o mesmo volume).
//   3. Roda em SEGUNDO PLANO: a estante já apareceu, e nada na tela espera.
function estAutoMetaLigado() { return cfg.autoMeta !== false }

function estAutoCompletar(ids, aoTerminar) {
  if (!estAutoMetaLigado() || !ids || !ids.length) return
  setTimeout(async () => {
    try {
      const r = await estMetaEmLote(ids, null)
      if (r.achou) {
        toast(r.achou === 1
          ? 'Dados do catálogo preenchidos'
          : `${r.achou} livros completados pelo catálogo`, 'info')
        if (typeof estanteRender === 'function' && _estVista === 'estante') estanteRender()
      }
      if (aoTerminar) aoTerminar(r)
    } catch (e) { console.warn('[estante] auto-metadados:', e && e.message) }
  }, 400)
}

// ---- a tela individual: ele vê os candidatos e escolhe ----
async function estMetaModal(id) {
  const l = livroPorId(id); if (!l) return
  document.getElementById('est-meta')?.remove()
  const ov = document.createElement('div')
  ov.id = 'est-meta'; ov.className = 'srs-modal-overlay'
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove() })
  ov.innerHTML = `<div class="srs-modal-box" style="width:100%;max-width:620px">
    <h4 style="font-size:var(--fs-base);font-weight:700;margin-bottom:4px">Completar pelo catálogo</h4>
    <p style="font-size:var(--fs-sm);color:var(--text2);margin-bottom:12px">
      Procurando por <b id="est-meta-q">${esc(_estConsultaDe(l))}</b></p>
    <div class="est-gb-busca" style="margin-bottom:12px">
      ${ic('search','ic-sm')}
      <input type="text" id="est-meta-termo" value="${escA(_estConsultaDe(l))}"
             onkeydown="if(event.key==='Enter')estMetaRebuscar('${l.id}')">
      <button class="btn btn-ghost btn-sm" onclick="estMetaRebuscar('${l.id}')">Buscar</button>
    </div>
    <label class="est-lote-check">
      <input type="checkbox" id="est-meta-sobre">
      <span>Substituir também o que já está preenchido (o título nunca muda)</span>
    </label>
    <div id="est-meta-res"><p class="est-dica">Buscando…</p></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('est-meta').remove()">Fechar</button>
    </div>
  </div>`
  document.body.appendChild(ov)
  _estMetaRes = await estMetaBuscar(l)
  _estMetaPintar(l)
}

let _estMetaRes = []
function _estMetaPintar(l) {
  const box = document.getElementById('est-meta-res'); if (!box) return
  if (!_estMetaRes.length) {
    box.innerHTML = `<p class="est-dica est-erro">Nada encontrado. Tente o nome como está na capa,
      sem o número do volume — ou preencha à mão em Editar.</p>`
    return
  }
  box.innerHTML = `<div class="est-gb-res">${_estMetaRes.map((r, i) => `
    <button class="est-gb-item" onclick="estMetaEscolher('${l.id}',${i})">
      ${r.capa ? `<img src="${escA(r.capa)}" alt="" loading="lazy">` : `<span class="est-gb-sem">${ic('book','ic-sm')}</span>`}
      <span class="est-gb-txt">
        <b>${esc(r.title)}</b>
        <i>${esc(r.author || 'autor desconhecido')}${r.ano ? ` · ${r.ano}` : ''}${r.paginas ? ` · ${r.paginas} pág` : ''} · ${r.fonte}</i>
      </span>
      ${r.volumeBate ? `<span class="est-selo">este volume</span>`
        : r.volumeBriga ? `<span class="est-selo est-selo-alerta">vol. ${r.num}</span>`
        : r.semelhanca >= 0.6 ? `<span class="est-selo">provável</span>` : ''}
    </button>`).join('')}</div>`
}

async function estMetaRebuscar(id) {
  const l = livroPorId(id); if (!l) return
  const termo = (document.getElementById('est-meta-termo').value || '').trim()
  const box = document.getElementById('est-meta-res'); if (box) box.innerHTML = `<p class="est-dica">Buscando…</p>`
  _estMetaRes = await estMetaBuscar({ ...l, serie: '', serieNum: '', author: '', title: termo })
  _estMetaPintar(l)
}

async function estMetaEscolher(id, i) {
  const l = livroPorId(id), r = _estMetaRes[i]
  if (!l || !r) return
  const sobre = document.getElementById('est-meta-sobre')?.checked
  if (r.fonte === 'Open Library' && r.key && !r.resumo) {
    try {
      const w = await (await fetch(`https://openlibrary.org${r.key}.json`)).json()
      const d = typeof w.description === 'string' ? w.description : (w.description && w.description.value) || ''
      if (d) r.resumo = d.slice(0, 1200)
    } catch (e) {}
  }
  const n = estMetaAplicar(l, r, sobre)
  estSalvar()
  document.getElementById('est-meta')?.remove()
  toast(n ? `${n} ${n === 1 ? 'campo preenchido' : 'campos preenchidos'}` : 'Nada a preencher — já estava tudo lá', n ? 'success' : 'info')
  estanteRender()
}

// ================================================================
// O NÚMERO DO VOLUME, LIDO DO NOME
// ================================================================
// ⚠️ O PADRÃO "TÍTULO + NÚMERO NO FIM" SÓ VALE PARA MANGÁ (`.cbz`). Em livro
// comum ele transformaria *Fahrenheit 451* na série "Fahrenheit", volume 451,
// e *Catch 22* na série "Catch". Para EPUB exige-se marca explícita — `v`,
// `vol`, `volume`, `#`. O teto de 300 também é proposital: número maior que
// isso é ano, código ou parte do título, não volume.
function estSerieDoNome(nome, ehManga) {
  const limpo = String(nome || '').replace(/\.[^.]{2,4}$/, '').replace(/_+/g, ' ').trim()
  const padroes = [
    /^(.{2,}?)[\s\-–—:]*\bv(?:ol(?:ume)?)?\.?\s*0*(\d{1,3})\b/i,
    /^(.{2,}?)[\s\-–—:]*#\s*0*(\d{1,3})\b/i
  ]
  if (ehManga) padroes.push(/^(.{2,}?)[\s\-–—:]+0*(\d{1,3})\s*$/)
  for (const p of padroes) {
    const m = limpo.match(p)
    if (!m) continue
    const num = Number(m[2])
    const serie = m[1].replace(/[\s\-–—:,.]+$/, '').trim()
    if (num >= 1 && num <= 300 && serie.length >= 2) return { serie, num }
  }
  return null
}
function _estNumDoTitulo(nome) {
  const d = estSerieDoNome(nome, true)
  return d ? d.num : 0
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
        ${l.kind === 'fisico' ? `<p class="est-dica" style="text-align:center">Sem arquivo aqui dentro — leitura no papel ou em outro aparelho.</p>` : ''}
        <div class="est-ficha-status">
          ${Object.entries(EST_STATUS).map(([k, v]) =>
            `<button class="est-chip${l.status === k ? ' on' : ''}" onclick="estSetLivroStatus('${l.id}','${k}')">${v.rotulo}</button>`).join('')}
        </div>
        <div class="est-ficha-nota">${_estEstrelas(l.nota, l.id)}<span>${l.nota ? `${l.nota}/5` : 'Sem nota'}</span></div>
        <div class="est-ficha-mini">
          <button class="btn btn-ghost btn-sm" onclick="estEditar('${l.id}')">${ic('pencil','ic-sm')} Editar</button>
          <button class="btn btn-ghost btn-sm" onclick="lerExcluir('${l.id}')">${ic('trash','ic-sm')} Remover</button>
        </div>
        ${l.kind === 'fisico' ? `
        <button class="btn btn-ghost btn-sm" style="width:100%" onclick="lerAnexarArquivo('${l.id}')"
                data-tip="O EPUB ou CBZ entra NESTE livro — sem criar um item repetido">
          ${ic('upload','ic-sm')} Anexar arquivo para ler</button>` : ''}
        <button class="btn btn-ghost btn-sm" style="width:100%" onclick="estMetaModal('${l.id}')"
                data-tip="Ano, editora, páginas, sinopse e capa — do Google Books ou da Open Library">
          ${ic('download','ic-sm')} Completar pelo catálogo</button>
      </div>
      <div class="est-ficha-corpo">
        <div class="est-ficha-topo">
          <h2>${esc(obraNome(l.title) || 'Sem título')}</h2>
          <p class="est-ficha-autor">${l.author
            ? `<button class="est-link" onclick="estAbrirAutor(${_estArg(l.author)})">${esc(l.author)}</button>`
            : 'Autor não informado'}${l.serie
            ? ` · <button class="est-link" onclick="estAbrirSerie(${_estArg(l.serie)})"><b>${esc(l.serie)}</b>${l.serieNum ? ` #${esc(String(l.serieNum))}` : ''}</button>` : ''}</p>
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
        : 'Busque pelo título e o livro entra na estante com capa e sinopse, mesmo sem você ter o arquivo. O EPUB ou o CBZ pode ser anexado depois, na ficha — sem criar item repetido.'}</p>

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
        <label class="est-campo"><span>Série</span>
          <input type="text" id="est-f-serie" value="${v('serie')}" placeholder="ex.: One Piece" list="est-f-series">
          <datalist id="est-f-series">${estSeriesExistentes().map(s => `<option value="${escA(s)}"></option>`).join('')}</datalist>
        </label>
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
    if (!_estGooglePodeTentar()) throw new Error('cota')
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(ehIsbn ? `isbn:${soDigitos}` : q)}&maxResults=6`)
    if (r.status === 429) { cota = true; _estGoogleCaiu() }
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
  // Cadastro à mão sem usar a busca: o catálogo completa o resto sozinho.
  if (!l) estAutoCompletar([_estId], () => { if (_estVista === 'ficha') estanteRender() })
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
  ov.innerHTML = `<div class="srs-modal-box" style="width:100%;max-width:620px">
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
