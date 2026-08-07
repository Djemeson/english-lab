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

const SK_DOSSIE_ABERTO = 'el-dossie-aberto'
// Separador por ESCAPE, não caractere literal no fonte: invisível no editor,
// some em copiar/colar e é impossível de depurar. `` não aparece em
// título de obra nem de capítulo.
const SEP = ''
let _dossieAberto = null      // chave do dossiê em foco (null = lista)

// Chave estável de um dossiê: a OBRA e o CAPÍTULO. `source_context` guarda o
// título do capítulo desde a captura (o leitor grava; Kindle e Mídia também),
// então nada precisou ser migrado para isto existir.
function _dossieChave(w) {
  const obra = String(w.source_title || '').trim() || '(sem título)'
  const cap = String(w.source_context || '').trim()
  return (w.source_type || 'manual') + '' + obra + '' + cap
}
function _dossiePartes(chave) {
  const p = String(chave).split('')
  return { tipo: p[0] || 'manual', obra: p[1] || '', cap: p[2] || '' }
}

// Só entra no dossiê o que JÁ TEM MATERIAL. Item ainda sem análise pertence
// a Preparar — mostrá-lo aqui seria oferecer para estudar o que não existe.
function _dossieItens() {
  return words.filter(w =>
    Array.isArray(w.meanings) && w.meanings.some(m => m && m.meaning_pt))
}

function dossieLista() {
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
  w.estudadoEm = Date.now()
  w.updated_at = new Date().toISOString()
  // `saveToSrs` já cuida de criar um card por significado selecionado, pular
  // duplicado e disparar o áudio. Reusar evita ter duas verdades sobre o que
  // é "mandar para a revisão".
  if (typeof saveToSrs === 'function') saveToSrs(w.id)
  else { saveWords(); if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange() }
  saveWords()
  renderDossieSection()
}

function dossieDesfazerEstudo(wordId) {
  const w = words.find(x => x.id === wordId)
  if (!w) return
  // NÃO apaga os cards do SRS: eles já podem ter histórico de revisão, e
  // jogar fora progresso real por causa de um clique errado seria pior que o
  // clique errado. Desmarcar só devolve o item ao dossiê para reler.
  delete w.estudadoEm
  w.updated_at = new Date().toISOString()
  saveWords()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast('Item volta para o dossiê — os cards já criados continuam na revisão', 'info')
  renderDossieSection()
}

function dossieAbrir(chave) {
  _dossieAberto = chave
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
        <div class="dos-ex"><b>${esc(ex.en || '')}</b>${ex.pt ? `<span>${esc(ex.pt)}</span>` : ''}</div>`).join('')}
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
          : `<button class="btn btn-primary btn-sm" onclick="dossieEstudei('${w.id}')">${ic('check','ic-sm')} Estudei — mandar para a revisão</button>`}
      </footer>
    </article>`
}

function renderDossieSection() {
  const area = el('dossie-area'); if (!area) return
  const lista = dossieLista()

  if (!lista.length) {
    area.innerHTML = `<div class="dos-vazio">${ic('book','ic-xl')}
      <p><b>Nenhum material pronto ainda</b></p>
      <p>Capture itens e monte o material em <b>Preparar</b> — eles aparecem aqui organizados por obra e capítulo.</p>
      <button class="btn btn-primary" onclick="showSection('revisar')">${ic('arrowRight')}Ir para Preparar</button></div>`
    return
  }

  const aberto = _dossieAberto && lista.find(d => d.chave === _dossieAberto)
  if (!aberto) {
    area.innerHTML = `
      <p class="dos-intro">Cada dossiê reúne <b>tudo que você captou de uma obra e capítulo</b>, com o material
      que a IA montou. Leia à vontade — marcar um item como estudado é o que o manda para a <b>Revisão</b>.</p>
      <div class="dos-grade">${lista.map(d => {
        const falta = d.itens.length - d.estudados
        const pct = d.itens.length ? Math.round((d.estudados / d.itens.length) * 100) : 0
        return `<button class="dos-card" onclick="dossieAbrir(${escA(JSON.stringify(d.chave))})">
          <span class="dos-card-ic">${srcIcon(d.tipo)}</span>
          <span class="dos-card-obra">${esc(d.obra)}</span>
          ${d.cap ? `<span class="dos-card-cap">${esc(d.cap)}</span>` : ''}
          <span class="dos-card-n"><b>${falta}</b> para estudar<i>${d.estudados} de ${d.itens.length} feitos</i></span>
          <span class="dos-barra"><i style="width:${pct}%"></i></span>
        </button>`
      }).join('')}</div>`
    return
  }

  const falta = aberto.itens.filter(w => !w.estudadoEm)
  const feitos = aberto.itens.filter(w => w.estudadoEm)
  // Não estudados primeiro: é o que ele veio fazer.
  const ordem = [...falta, ...feitos]
  area.innerHTML = `
    <div class="dos-topo">
      <button class="btn btn-ghost btn-sm" onclick="dossieVoltar()">${ic('chevronLeft','ic-sm')} Todos os dossiês</button>
      <div class="dos-titulo">
        <b>${esc(aberto.obra)}</b>${aberto.cap ? `<span>${esc(aberto.cap)}</span>` : ''}
      </div>
      <span class="dos-contagem">${feitos.length}/${aberto.itens.length} estudados</span>
    </div>
    ${falta.length === 0 ? `<p class="dos-parabens">${ic('checkCircle','ic-sm')}
      Dossiê inteiro estudado — todos os itens já estão girando na Revisão.</p>` : ''}
    <div class="dos-lista">${ordem.map(_dossieCardHTML).join('')}</div>`
}
