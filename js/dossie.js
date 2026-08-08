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

// Chave estável de um dossiê: a OBRA e o CAPÍTULO.
// FASE 2 — lê a origem do SENTIDO, com queda para a do item. É isto que põe
// cada sentido no dossiê da fonte ONDE AQUELE SENTIDO foi encontrado: o "cair"
// de `fall` fica no Capítulo 3, o "fracassar" no Capítulo 9, no mesmo item.
function _dossieChave(w, m) {
  const g = (c, f) => String((m && m[c]) || w[f] || '').trim()
  const obra = g('source_title', 'source_title') || '(sem título)'
  const cap = g('source_context', 'source_context')
  const tipo = g('source_type', 'source_type') || 'manual'
  return tipo + SEP + obra + SEP + cap
}
function _dossiePartes(chave) {
  const p = String(chave).split(SEP)
  return { tipo: p[0] || 'manual', obra: p[1] || '', cap: p[2] || '' }
}

// Só entra no dossiê o que FOI ENVIADO para cá. Ter material não basta: se
// bastasse, o item apareceria ao mesmo tempo no Preparar e aqui, e nenhuma
// das duas telas diria onde ele está de verdade. O envio é um ato — e é ele
// que esvazia a fila do Preparar.
//   in_study → está no dossiê, ainda não estudado
//   in_srs   → já foi estudado, continua legível aqui para releitura
// FASE 2 — O DOSSIÊ É UMA LISTA DE SENTIDOS, não de itens.
//   'estudo'  → no dossiê, ainda não estudado
//   'revisao' → já estudado, continua legível aqui para releitura
//   'saber'   → só verbete e glossário; NUNCA aparece aqui
// Cada linha é um par {w, m}: é assim que um `fall` estudado no Capítulo 3 e
// reencontrado no 9 aparece nos DOIS dossiês, sem virar dois itens.
function _dossieSentidos() {
  const out = []
  const dos = typeof sentidosDe === 'function' ? sentidosDe : (w => (w.meanings || []).filter(m => m && m.meaning_pt && !m.moved_to))
  const est = typeof sentidoEstado === 'function' ? sentidoEstado : (m => m.estado || 'pronto')
  for (const w of words) {
    for (const m of dos(w)) {
      const e = est(m)
      if (e === 'estudo' || e === 'revisao') out.push({ w, m, feito: e === 'revisao' })
    }
  }
  return out
}

function dossieLista() {
  // A migração roda aqui também (além do boot): assim o aparelho que receber
  // dado antigo pela nuvem se cura sozinho ao abrir a seção. É idempotente e
  // só grava quando muda algo.
  if (typeof migrarEstadosDeSentido === 'function') migrarEstadosDeSentido()
  const mapa = new Map()
  for (const s of _dossieSentidos()) {
    const k = _dossieChave(s.w, s.m)
    if (!mapa.has(k)) mapa.set(k, { chave: k, ..._dossiePartes(k), itens: [], estudados: 0 })
    const d = mapa.get(k)
    d.itens.push(s)
    if (s.feito) d.estudados++
  }
  // Dossiê com pendência primeiro: é para lá que ele quer ir.
  return [...mapa.values()].sort((a, b) => {
    const fa = a.itens.length - a.estudados, fb = b.itens.length - b.estudados
    return (fb - fa) || a.obra.localeCompare(b.obra) || a.cap.localeCompare(b.cap)
  })
}

// ---- marcar estudado = mandar AQUELE SENTIDO para a revisão ----------
// FASE 2: a marcação é por sentido. Estudar "cair" não pode arrastar
// "fracassar" junto só porque os dois moram no mesmo item.
function _dossiePar(wordId, meaningId) {
  const w = words.find(x => x.id === wordId); if (!w) return null
  const m = (w.meanings || []).find(x => x && x.id === meaningId)
  return m ? { w, m } : null
}

function dossieEstudei(wordId, meaningId) {
  const p = _dossiePar(wordId, meaningId); if (!p) return
  if (sentidoEstado(p.m) === 'revisao') return
  // A ORDEM IMPORTA: quem marca o sentido como estudado é o `saveToSrs` (a
  // única verdade sobre "entrou na revisão"). Marcar antes deixaria como
  // estudado um sentido cujo salvamento foi recusado.
  saveToSrs(p.w.id, meaningId)
  if (sentidoEstado(p.m) !== 'revisao') return   // recusou: o aviso já foi dado
  renderDossieSection()
}

function dossieDesfazerEstudo(wordId, meaningId) {
  const p = _dossiePar(wordId, meaningId); if (!p) return
  // NÃO apaga os cards do SRS: eles já podem ter histórico de revisão, e
  // jogar fora progresso real por causa de um clique errado seria pior que o
  // clique errado. Desmarcar só devolve o sentido ao dossiê para reler.
  delete p.m.estudadoEm
  // Volta para 'estudo', não para o Preparar: desmarcar é "quero reler", não
  // "quero refazer a análise" (para isso existe o "Corrigir em Preparar").
  p.m.estado = 'estudo'
  p.w.updated_at = new Date().toISOString()
  sincronizarStatusItem(p.w)
  saveWords()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast('Sentido volta para o dossiê — os cards já criados continuam na revisão', 'info')
  renderDossieSection()
}

function dossieAbrir(chave) {
  _dossieAberto = chave || null
  try { localStorage.setItem(SK_DOSSIE_ABERTO, chave || '') } catch (e) {}
  renderDossieSection()
}
function dossieVoltar() { dossieAbrir(null) }

// ---- telas -----------------------------------------------------------
function _dossieCardHTML(s) {
  const { w, m, feito } = s
  // A frase é a DAQUELE sentido (Fase 2), com queda para a do item: é a cena
  // em que ESTE sentido foi encontrado, não a do último encontro do item.
  const ctx = m.context || w.context || ''
  const ctxPt = m.context_pt || (m.context ? '' : w.context_pt) || ''
  // Os outros sentidos do mesmo item viram uma linha discreta: dizem que a
  // palavra tem mais vida sem competir com o que ele veio estudar aqui.
  const irmaos = sentidosDe(w).filter(x => x !== m)
  return `
    <article class="dos-item${feito ? ' feito' : ''}" id="dos-${w.id}-${m.id || ''}">
      <header class="dos-cab">
        <b>${esc(w.word || '(frase)')}</b>
        ${w.ipa ? `<span class="dos-ipa">${esc(w.ipa)}</span>` : ''}
        ${feito ? `<span class="dos-selo">${ic('check','ic-sm')} estudado</span>` : ''}
      </header>
      ${ctx ? `<div class="dos-ctx">“${esc(ctx)}”${ctxPt ? `<span>${esc(ctxPt)}</span>` : ''}</div>` : ''}
      <div class="dos-sig${m.context_match ? ' ctx' : ''}">
        <div class="dos-sig-pt">${esc(m.meaning_pt)}${m.type_label ? `<i>${esc(m.type_label)}</i>` : ''}</div>
        ${m.definition_pt ? `<div class="dos-sig-def">${esc(m.definition_pt)}</div>` : ''}
        ${(m.examples || []).slice(0, 2).map(ex => `
          <div class="dos-ex">${buildSrsFrente({ example_en: ex.en || '', word: w.word })}${ex.pt ? `<span>${escB(ex.pt)}</span>` : ''}</div>`).join('')}
      </div>
      ${irmaos.length ? `<div class="dos-irmaos">${ic('layers','ic-sm')} ${esc(w.word)} também é: ${
        irmaos.map(x => esc(x.meaning_pt)).join(' · ')}</div>` : ''}
      <footer class="dos-acoes">
        ${feito
          ? `<button class="btn btn-ghost btn-sm" onclick="dossieDesfazerEstudo('${w.id}','${m.id || ''}')">${ic('undo','ic-sm')} não estudei ainda</button>`
          : `<button class="btn btn-primary btn-sm" onclick="dossieEstudei('${w.id}','${m.id || ''}')">${ic('check','ic-sm')} Estudei — mandar para a Revisão</button>`}
        <button class="btn btn-ghost btn-sm dos-corrigir" onclick="voltarParaPreparar('${w.id}')"
          data-tip="A análise saiu errada? Devolve o item ao Preparar para re-analisar ou refazer do zero.">${ic('refresh','ic-sm')} Corrigir em Preparar</button>
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

// Todo o texto pesquisável de um SENTIDO: o termo, a frase de onde ele saiu e
// o material que a IA montou para ele. Buscar só pelo termo obrigaria a
// lembrar a grafia exata — e o valor do dossiê está justamente no material.
function _dosItemTexto(s) {
  const { w, m } = s
  return _dosNorm([
    w.word, m.context || w.context, m.context_pt || w.context_pt,
    m.meaning_pt, m.definition_pt, m.type_label,
    ...(m.examples || []).map(ex => (ex.en || '') + ' ' + (ex.pt || ''))
  ].join(' '))
}
function _dosItemCasa(s) {
  if (_dosFiltro === 'pendentes' && s.feito) return false
  if (_dosFiltro === 'feitos' && !s.feito) return false
  if (!_dosBusca) return true
  return _dosItemTexto(s).includes(_dosBusca)
}
// Na grade, a busca também entra NOS sentidos: "onde foi que eu vi 'barrel'?"
// é exatamente a pergunta que traz alguém a esta tela.
function _dosDossieCasa(d) {
  const falta = d.itens.length - d.estudados
  if (_dosFiltro === 'pendentes' && falta === 0) return false
  if (_dosFiltro === 'feitos' && falta > 0) return false
  if (!_dosBusca) return true
  if (_dosNorm(d.obra + ' ' + d.cap).includes(_dosBusca)) return true
  return d.itens.some(s => _dosItemTexto(s).includes(_dosBusca))
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
    const feitos = aberto.itens.filter(s => s.feito).length
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
        <input type="text" id="dossie-busca" aria-label="Buscar nos dossiês" placeholder="Buscar item, significado, obra ou capítulo…"
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

  const falta = aberto.itens.filter(s => !s.feito)
  const feitos = aberto.itens.filter(s => s.feito)
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
    // O vazio precisa dizer o ATO que enche a tela. "Ainda não tem nada" sem
    // dizer como chega aqui é o tipo de tela morta que faz o app parecer quebrado.
    const prontas = words.filter(w => w.status === 'pending_review').length
    area.innerHTML = `<div class="dos-vazio">${ic('bookOpen','ic-xl')}
      <p><b>Nenhum item no estudo ainda</b></p>
      <p>${prontas
        ? `Você tem <b>${prontas} ${prontas !== 1 ? 'itens prontos' : 'item pronto'}</b> em <b>Preparar</b>. Use <b>"Enviar para o Estudo"</b> lá — eles chegam aqui organizados por obra e capítulo.`
        : 'Prepare o material em <b>Preparar</b> e use <b>"Enviar para o Estudo"</b> — os itens chegam aqui organizados por obra e capítulo.'}</p>
      <button class="btn btn-primary" onclick="showSection('preparar')">${ic('arrowRight')}Ir para Preparar</button></div>`
    return
  }

  area.innerHTML = _dossieBarraHTML() + '<div id="dossie-corpo"></div>'
  _dossiePintarFiltros()
  _dossiePintarCorpo()
}
