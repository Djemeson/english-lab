// ================================================================
// ESTUDAR — os dossiês: o material inteiro de uma obra + capítulo
// ================================================================
// O buraco que isto fecha: o material que a IA monta em PREPARAR é rico —
// item, significados, exemplos com tradução, a frase original, imagem, áudio.
// Mas o único caminho para fora dali era "salvar para estudo", que estilhaça
// o dossiê em cards de UM significado cada. Não havia onde LER o material
// montado, e o Djemeson não queria mandar para a repetição espaçada aquilo
// que ainda não tinha estudado.
//
// O fluxo passou a ser: captar → PREPARAR (a IA monta) → ESTUDAR (aqui, o
// dossiê inteiro) → REVISAR (repetição espaçada).
//
// A REGRA DO PORTÃO, decidida com ele: marcar um item como estudado é o que
// o manda para a revisão espaçada. Um ato, um significado — não existe
// "estudei mas não mandei", nem é preciso terminar o dossiê para o primeiro
// item começar a girar no SRS.
//
// "Item", não "palavra": entram idiom, phrasal verb e colocação, e chamar
// tudo de palavra era mentir sobre o que o aluno está estudando.
//
// ESTA SEÇÃO SE CHAMA "ESTUDAR" NA INTERFACE (id de seção: `estudar`).
// O arquivo continua `dossie.js` porque o nome descreve o QUE ele mostra —
// e porque `study.js` já é o SRS, hoje rotulado "Revisar". O mapa completo
// dos nomes está em core.js, acima de SECTIONS.

const SK_DOSSIE_ABERTO = 'el-dossie-aberto'
// Separador por ESCAPE, nunca o caractere literal no fonte: literal é
// invisível no editor, some em copiar/colar, o OneDrive/Git podem estragá-lo
// e o bug resultante é impossível de enxergar lendo o código.
// U+0001 não aparece em título de obra nem de capítulo.
const SEP = '\u0001'
let _dossieAberto = null      // chave do dossiê em foco (null = lista)
let _dossieListaCache = []    // a lista do último render (a chave sai daqui)

// Chave estável de um dossiê: a OBRA e o CAPÍTULO. `source_context` guarda o
// título do capítulo desde a captura (o leitor grava; Kindle e Mídia também),
// então nada precisou ser migrado para isto existir.
function _dossieChave(w) {
  const obra = String(w.source_title || '').trim() || '(sem título)'
  const cap = String(w.source_context || '').trim()
  return (w.source_type || 'manual') + SEP + obra + SEP + cap
}
function _dossiePartes(chave) {
  const p = String(chave).split(SEP)
  return { tipo: p[0] || 'manual', obra: p[1] || '', cap: p[2] || '' }
}

// Só entra no dossiê o que JÁ TEM MATERIAL. Item ainda sem análise pertence
// a Preparar — mostrá-lo aqui seria oferecer para estudar o que não existe.
function _dossieItens() {
  return words.filter(w =>
    Array.isArray(w.meanings) && w.meanings.some(m => m && m.meaning_pt))
}

// O DADO ANTIGO. Quem já usava o app tem centenas de itens com `status:
// 'in_srs'` e nenhum `estudadoEm` — o campo nasceu com esta seção. Sem esta
// costura, o primeiro dossiê abriria dizendo "300 para estudar" sobre coisas
// que ele já revisa há semanas. Roda a cada render e só grava se mudou algo,
// então também cura o aparelho que receber esses itens pela nuvem.
function _dossieCosturarLegado() {
  let mudou = 0
  for (const w of words) {
    if (w.status === 'in_srs' && !w.estudadoEm) {
      w.estudadoEm = Date.parse(w.updated_at || w.created_at || '') || Date.now()
      mudou++
    }
  }
  if (mudou) {
    saveWords()
    // Sem sync os outros aparelhos refariam a mesma costura com datas
    // diferentes — inofensivo, mas é escrita à toa em todo dispositivo.
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  }
  return mudou
}

function dossieLista() {
  _dossieCosturarLegado()
  const mapa = new Map()
  for (const w of _dossieItens()) {
    const k = _dossieChave(w)
    if (!mapa.has(k)) mapa.set(k, { chave: k, ..._dossiePartes(k), itens: [], estudados: 0 })
    const d = mapa.get(k)
    d.itens.push(w)
    if (w.estudadoEm) d.estudados++
  }
  // Dossiê com pendência primeiro: é para lá que ele quer ir.
  return [...mapa.values()].sort((a, b) => {
    const fa = a.itens.length - a.estudados, fb = b.itens.length - b.estudados
    return (fb - fa) || a.obra.localeCompare(b.obra) || a.cap.localeCompare(b.cap)
  })
}

// ---- marcar estudado = mandar para a revisão espaçada ----------------
function dossieEstudei(wordId) {
  const w = words.find(x => x.id === wordId)
  if (!w || w.estudadoEm) return
  // A ORDEM IMPORTA: quem marca `estudadoEm` é o `saveToSrs` (a única verdade
  // sobre "entrou na revisão"). Marcar antes deixaria o item como estudado
  // mesmo quando o salvamento recusa — por exemplo, com todos os significados
  // desmarcados, caso em que ele só mostra um aviso e volta.
  if (typeof saveToSrs === 'function') {
    saveToSrs(w.id)
    if (!w.estudadoEm) return           // saveToSrs recusou: o aviso já foi dado
  } else {
    w.estudadoEm = Date.now()
    w.updated_at = new Date().toISOString()
    saveWords()
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  }
  renderDossieSection()
}

function dossieDesfazerEstudo(wordId) {
  const w = words.find(x => x.id === wordId)
  if (!w) return
  // NÃO apaga os cards do SRS: eles já podem ter histórico de revisão, e
  // jogar fora progresso real por causa de um clique errado seria pior que o
  // clique errado. Desmarcar só devolve o item ao dossiê para reler.
  delete w.estudadoEm
  // O status VOLTA junto. Sem isto a costura do legado (que trata `in_srs`
  // como estudado) remarcaria o item no render seguinte — o desfazer duraria
  // uma fração de segundo.
  if (w.status === 'in_srs') w.status = 'pending_review'
  w.updated_at = new Date().toISOString()
  saveWords()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast('Item volta para o dossiê — os cards já criados continuam na revisão', 'info')
  renderDossieSection()
}

function dossieAbrir(chave) {
  _dossieAberto = chave || null
  try { localStorage.setItem(SK_DOSSIE_ABERTO, chave || '') } catch (e) {}
  renderDossieSection()
}
function dossieVoltar() { dossieAbrir(null) }

// ---- telas -----------------------------------------------------------
function _dossieCardHTML(w) {
  const feito = !!w.estudadoEm
  const ms = (w.meanings || []).filter(m => m && m.meaning_pt)
  const sig = ms.map(m => `
    <div class="dos-sig${m.context_match ? ' ctx' : ''}">
      <div class="dos-sig-pt">${esc(m.meaning_pt)}${m.type_label ? `<i>${esc(m.type_label)}</i>` : ''}</div>
      ${m.definition_pt ? `<div class="dos-sig-def">${esc(m.definition_pt)}</div>` : ''}
      ${(m.examples || []).slice(0, 2).map(ex => `
        <div class="dos-ex">${buildSrsFrente({ example_en: ex.en || '', word: w.word })}${ex.pt ? `<span>${escB(ex.pt)}</span>` : ''}</div>`).join('')}
    </div>`).join('')
  return `
    <article class="dos-item${feito ? ' feito' : ''}" id="dos-${w.id}">
      <header class="dos-cab">
        <b>${esc(w.word || '(frase)')}</b>
        ${w.ipa ? `<span class="dos-ipa">${esc(w.ipa)}</span>` : ''}
        ${feito ? `<span class="dos-selo">${ic('check','ic-sm')} estudado</span>` : ''}
      </header>
      ${w.context ? `<div class="dos-ctx">“${esc(w.context)}”${
        w.context_pt ? `<span>${esc(w.context_pt)}</span>` : ''}</div>` : ''}
      ${sig}
      <footer class="dos-acoes">
        ${feito
          ? `<button class="btn btn-ghost btn-sm" onclick="dossieDesfazerEstudo('${w.id}')">${ic('undo','ic-sm')} não estudei ainda</button>`
          : `<button class="btn btn-primary btn-sm" onclick="dossieEstudei('${w.id}')">${ic('check','ic-sm')} Estudei — mandar para a Revisão</button>`}
      </footer>
    </article>`
}

// ---- busca e filtro --------------------------------------------------
// NÃO são persistidos, de propósito. A lição já paga do projeto (o filtro de
// fonte do SRS) é que filtro salvo produz tela vazia sem explicação numa
// sessão futura. Aqui eles nascem limpos a cada abertura do app, e enquanto
// estiverem valendo a tela DIZ que estão — com um botão de limpar à mão.
let _dosBusca = ''
let _dosFiltro = 'todos'     // todos | pendentes | feitos

// Comparação sem acento e sem caixa: quem busca "cogumelos" no capítulo
// "Um atalho para cogumelos" também digita "COGUMELOS" e "cogumêlos".
function _dosNorm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Todo o texto pesquisável de um item: o termo, a frase de onde ele saiu e o
// material que a IA montou. Buscar só pelo termo obrigaria a lembrar a grafia
// exata — e o valor do dossiê está justamente no material.
function _dosItemTexto(w) {
  const ms = (w.meanings || []).filter(m => m && m.meaning_pt)
  return _dosNorm([
    w.word, w.context, w.context_pt,
    ...ms.map(m => [m.meaning_pt, m.definition_pt, m.type_label,
      ...(m.examples || []).map(ex => (ex.en || '') + ' ' + (ex.pt || ''))].join(' '))
  ].join(' '))
}
function _dosItemCasa(w) {
  if (_dosFiltro === 'pendentes' && w.estudadoEm) return false
  if (_dosFiltro === 'feitos' && !w.estudadoEm) return false
  if (!_dosBusca) return true
  return _dosItemTexto(w).includes(_dosBusca)
}
// Na grade, a busca também entra NOS itens: "onde foi que eu vi 'barrel'?" é
// exatamente a pergunta que traz alguém a esta tela.
function _dosDossieCasa(d) {
  const falta = d.itens.length - d.estudados
  if (_dosFiltro === 'pendentes' && falta === 0) return false
  if (_dosFiltro === 'feitos' && falta > 0) return false
  if (!_dosBusca) return true
  if (_dosNorm(d.obra + ' ' + d.cap).includes(_dosBusca)) return true
  return d.itens.some(w => _dosItemTexto(w).includes(_dosBusca))
}

function dossieBuscar(v) {
  _dosBusca = _dosNorm(v)
  _dossiePintarCorpo()          // só o corpo: o campo de busca não perde o foco
}
function dossieFiltrar(f) {
  _dosFiltro = f
  _dossiePintarCorpo()
  _dossiePintarFiltros()
}
function dossieLimparFiltros() {
  _dosBusca = ''; _dosFiltro = 'todos'
  const inp = el('dossie-busca'); if (inp) inp.value = ''
  _dossiePintarCorpo(); _dossiePintarFiltros()
}

function _dossieContagens() {
  const aberto = _dossieListaCache.find(d => d.chave === _dossieAberto)
  if (aberto) {
    const feitos = aberto.itens.filter(w => w.estudadoEm).length
    return { todos: aberto.itens.length, pendentes: aberto.itens.length - feitos, feitos }
  }
  const l = _dossieListaCache
  const pend = l.filter(d => d.itens.length - d.estudados > 0).length
  return { todos: l.length, pendentes: pend, feitos: l.length - pend }
}

function _dossiePintarFiltros() {
  const box = el('dossie-filtros'); if (!box) return
  const c = _dossieContagens()
  const abertoAgora = !!_dossieListaCache.find(d => d.chave === _dossieAberto)
  const rot = abertoAgora
    ? { todos: 'Todos', pendentes: 'Para estudar', feitos: 'Estudados' }
    : { todos: 'Todos', pendentes: 'Com pendência', feitos: 'Concluídos' }
  box.innerHTML = ['todos', 'pendentes', 'feitos'].map(f => `
    <button class="dos-fil${_dosFiltro === f ? ' active' : ''}" onclick="dossieFiltrar('${f}')">
      ${rot[f]}<span class="dos-fil-n">${c[f]}</span>
    </button>`).join('')
}

function _dossieBarraHTML() {
  return `
    <div class="dos-barra-topo">
      <div class="dos-busca">
        ${ic('search','ic-sm')}
        <input type="text" id="dossie-busca" placeholder="Buscar item, significado, obra ou capítulo…"
               value="${escA(_dosBusca)}" oninput="dossieBuscar(this.value)">
      </div>
      <div class="dos-fils" id="dossie-filtros"></div>
    </div>`
}

function _dossieNadaHTML(oQue) {
  return `<div class="dos-vazio-filtro">${ic('search','ic-lg')}
    <p>Nenhum ${oQue} com esses filtros.</p>
    <button class="btn btn-ghost btn-sm" onclick="dossieLimparFiltros()">${ic('x','ic-sm')}Limpar busca e filtro</button>
  </div>`
}

// O CORPO é o que muda ao digitar; a barra de busca fica de fora e por isso
// não é recriada a cada tecla (recriar rouba o foco no meio da palavra).
function _dossiePintarCorpo() {
  const corpo = el('dossie-corpo'); if (!corpo) return
  const lista = _dossieListaCache
  const aberto = _dossieAberto && lista.find(d => d.chave === _dossieAberto)

  if (!aberto) {
    const visiveis = lista.filter(_dosDossieCasa)
    if (!visiveis.length) { corpo.innerHTML = _dossieNadaHTML('dossiê'); return }
    corpo.innerHTML = `
      <p class="dos-intro">Cada dossiê reúne <b>tudo que você captou de uma obra e capítulo</b>, com o material
      que a IA montou. Leia à vontade — marcar um item como estudado é o que o manda para a <b>Revisão</b>.</p>
      <div class="dos-grade">${visiveis.map(d => {
        const falta = d.itens.length - d.estudados
        const pct = d.itens.length ? Math.round((d.estudados / d.itens.length) * 100) : 0
        return `<button class="dos-card" data-k="${lista.indexOf(d)}">
          <span class="dos-card-ic">${srcIcon(d.tipo)}</span>
          <span class="dos-card-obra">${esc(d.obra)}</span>
          ${d.cap ? `<span class="dos-card-cap">${esc(d.cap)}</span>` : ''}
          <span class="dos-card-n"><b>${falta}</b> para estudar<i>${d.estudados} de ${d.itens.length} feitos</i></span>
          <span class="dos-barra"><i style="width:${pct}%"></i></span>
        </button>`
      }).join('')}</div>`
    // A chave viaja pelo ÍNDICE do render, não dentro do onclick: ela carrega
    // um caractere de controle e o título do livro, e enfiar isso num atributo
    // HTML é convite para aspas, & e acentos quebrarem o clique.
    corpo.querySelectorAll('.dos-card').forEach(b => {
      b.onclick = () => {
        const d = lista[+b.dataset.k]
        if (d) dossieAbrir(d.chave)
      }
    })
    return
  }

  const falta = aberto.itens.filter(w => !w.estudadoEm)
  const feitos = aberto.itens.filter(w => w.estudadoEm)
  // Não estudados primeiro: é o que ele veio fazer.
  const visiveis = [...falta, ...feitos].filter(_dosItemCasa)
  const filtrando = !!_dosBusca || _dosFiltro !== 'todos'
  corpo.innerHTML = `
    <div class="dos-topo">
      <button class="btn btn-ghost btn-sm" onclick="dossieVoltar()">${ic('chevronLeft','ic-sm')} Todos os dossiês</button>
      <div class="dos-titulo">
        <b>${esc(aberto.obra)}</b>${aberto.cap ? `<span>${esc(aberto.cap)}</span>` : ''}
      </div>
      <span class="dos-contagem">${feitos.length}/${aberto.itens.length} estudados${
        filtrando ? ` · <i>${visiveis.length} na tela</i>` : ''}</span>
    </div>
    ${(falta.length === 0 && !filtrando) ? `<p class="dos-parabens">${ic('checkCircle','ic-sm')}
      Dossiê inteiro estudado — todos os itens já estão girando na Revisão.</p>` : ''}
    ${visiveis.length
      ? `<div class="dos-lista">${visiveis.map(_dossieCardHTML).join('')}</div>`
      : _dossieNadaHTML('item')}`
}

function renderDossieSection() {
  const area = el('dossie-area'); if (!area) return
  const lista = dossieLista()
  _dossieListaCache = lista

  // A seção só existe depois da 1ª visita, mas o estado sobrevive a ela:
  // reabrir o app no dossiê onde parou é o mesmo cuidado do "continuar de
  // onde parou" do vídeo.
  if (_dossieAberto === null) {
    try { _dossieAberto = localStorage.getItem(SK_DOSSIE_ABERTO) || null } catch (e) {}
  }

  if (!lista.length) {
    area.innerHTML = `<div class="dos-vazio">${ic('bookOpen','ic-xl')}
      <p><b>Nenhum material pronto ainda</b></p>
      <p>Capture itens e monte o material em <b>Preparar</b> — eles aparecem aqui organizados por obra e capítulo.</p>
      <button class="btn btn-primary" onclick="showSection('preparar')">${ic('arrowRight')}Ir para Preparar</button></div>`
    return
  }

  area.innerHTML = _dossieBarraHTML() + '<div id="dossie-corpo"></div>'
  _dossiePintarFiltros()
  _dossiePintarCorpo()
}
