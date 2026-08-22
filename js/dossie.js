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
  const dos = typeof sentidosDe === 'function' ? sentidosDe : (w => (w.meanings || []).filter(m => m && m.meaning_pt && !m.moved_to && !m.fundido_em))
  const est = typeof sentidoEstado === 'function' ? sentidoEstado : (m => m.estado || 'pronto')
  words.forEach((w, i) => {
    for (const m of dos(w)) {
      const e = est(m)
      // `i` é a posição no `words`, e ela é o sinal MAIS confiável da ordem de
      // captura: `createWord` faz `unshift`, então quem entrou por último está
      // no índice 0. O `created_at` sozinho empata em importação de lote (o
      // Kindle cria dezenas no mesmo segundo) — por isso o índice é o critério
      // de desempate, e não enfeite.
      if (e === 'estudo' || e === 'revisao') out.push({ w, m, feito: e === 'revisao', i })
    }
  })
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
  // ⚠️ Abrir um dossiê NÃO troca de seção, e era só na troca que a volta ao
  // lugar de antes era gravada — o dossiê aberto nunca entrava no registro.
  // Cada porta que muda "onde ele está" precisa avisar.
  setTimeout(() => { if (typeof ondeEstavaSalvar === 'function') ondeEstavaSalvar() }, 0)
  _dossieAberto = chave || null
  try { localStorage.setItem(SK_DOSSIE_ABERTO, chave || '') } catch (e) {}
  renderDossieSection()
}
function dossieVoltar() { dossieAbrir(null) }

// ---- O MATERIAL RICO -------------------------------------------------
// O dossiê era a versão pobre do card de revisão: sem áudio, sem origem, sem
// nível/registro, sem os vizinhos. Estava invertido — Estudar é o PRIMEIRO
// CONTATO (é aqui que se constrói o vínculo forma-significado, e é aqui que
// ouvir a pronúncia e entender a origem muda o que fica), enquanto Revisar é
// RECUPERAÇÃO, onde material demais convida a reler em vez de lembrar.
// Estas peças são compartilhadas entre o cartão da lista (compacto) e o modo
// foco (completo) — a lista continua legível em série, o foco é onde o poder
// aparece inteiro.
function _dosChips(w, m) {
  let out = ''
  const nivel = m.level || ''
  if (nivel) out += `<span class="dos-chip nivel">${esc(nivel)}</span>`
  if (typeof varietyChip === 'function') out += varietyChip(m.variety || w.variety, wordLang(w))
  if (typeof registerChip === 'function') out += registerChip(m.register)
  if (m.type_label) out += `<span class="dos-chip">${esc(m.type_label)}</span>`
  // Sentido N de M — e o clique abre o verbete daquele item, que é onde a
  // pergunta "quais são os outros?" tem resposta completa.
  const irmaos = sentidosDe(w)
  if (irmaos.length > 1) {
    const pos = irmaos.indexOf(m) + 1
    out += `<span class="dos-chip sentido" onclick="event.stopPropagation();openWordGlossary('${w.id}')"
      data-tip="Sentido ${pos} de ${irmaos.length} — clique para ver o verbete">${ic('layers','ic-sm')}${pos}/${irmaos.length}</span>`
  }
  return out
}

// O rótulo vai em `<span>` para poder SUMIR sem levar o botão junto: com o
// cabeçalho pinado no celular, "Pronúncia" + "Frase" não cabiam na linha do
// título e a empurravam para uma segunda linha — 94px de cabeçalho fixo numa
// tela de 812. Só o ícone, os dois botões cabem, e ouvir continua a um toque.
function _dosAudioHTML(w, m) {
  const frase = (m.examples && m.examples[0] && m.examples[0].en) || ''
  return `<span class="dos-audio">
    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();playSrsTTS(${escA(JSON.stringify(w.word || ''))})"
      data-tip="Ouvir a pronúncia" aria-label="Ouvir a pronúncia">${ic('volume','ic-sm')}<span>Pronúncia</span></button>
    ${frase ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();playSrsTTS(${escA(JSON.stringify(frase.replace(/<[^>]*>/g,'')))})"
      data-tip="Ouvir a frase inteira" aria-label="Ouvir a frase inteira">${ic('volume','ic-sm')}<span>Frase</span></button>` : ''}
  </span>`
}

function _dosOrigemHTML(m) {
  if (!m.origin_pt) return ''
  return `<div class="dos-origem">${ic('sparkles','ic-sm')}<div><b>Origem</b><span>${esc(m.origin_pt)}</span></div></div>`
}

// Sem `.slice`: a tela mostra o que o item TEM. Cortar aqui era o pior tipo de
// corte — o dado estava gravado e pago, e a tela escondia parte dele sem dizer
// nada. Quem organiza é o layout; a quantidade é do dado.
function _dosVizinhosHTML(m) {
  const sin = m.synonyms || [], ant = m.antonyms || []
  if (!sin.length && !ant.length) return ''
  return `<div class="dos-vizinhos">${
    sin.length ? `<span>↔ ${sin.map(esc).join(', ')}</span>` : ''}${
    ant.length ? `<span class="ant">✕ ${ant.map(esc).join(', ')}</span>` : ''}</div>`
}

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
        ${_dosAudioHTML(w, m)}
        ${feito ? `<span class="dos-selo">${ic('check','ic-sm')} estudado</span>` : ''}
      </header>
      ${ctx ? `<div class="dos-ctx">“${esc(ctx)}”${ctxPt ? `<span>${esc(ctxPt)}</span>` : ''}</div>` : ''}
      <div class="dos-sig${m.context_match ? ' ctx' : ''}">
        <div class="dos-sig-pt">${esc(m.meaning_pt)}</div>
        <div class="dos-chips">${_dosChips(w, m)}</div>
        ${m.definition_pt ? `<div class="dos-sig-def">${esc(m.definition_pt)}</div>` : ''}
        ${_dosVizinhosHTML(m)}
        ${(m.examples || []).slice(0, 2).map(ex => `
          <div class="dos-ex">${buildSrsFrente({ example_en: ex.en || '', word: w.word })}${ex.pt ? `<span>${escB(ex.pt)}</span>` : ''}</div>`).join('')}
      </div>
      ${_dosOrigemHTML(m)}
      ${irmaos.length ? `<div class="dos-irmaos">${ic('layers','ic-sm')} ${esc(w.word)} também é: ${
        irmaos.map(x => esc(x.meaning_pt)).join(' · ')}</div>` : ''}
      <footer class="dos-acoes">
        ${feito
          ? `<button class="btn btn-ghost btn-sm" onclick="dossieDesfazerEstudo('${w.id}','${m.id || ''}')">${ic('undo','ic-sm')} não estudei ainda</button>`
          : `<button class="btn btn-primary btn-sm" onclick="dossieEstudei('${w.id}','${m.id || ''}')">${ic('check','ic-sm')} Estudei — mandar para a Revisão</button>`}
        <button class="btn btn-secondary btn-sm" onclick="dossieFoco('${w.id}','${m.id || ''}')"
          data-tip="Abre só este item na tela, sem distração — setas do teclado passam para o próximo">${ic('expand','ic-sm')} Foco</button>
        <button class="btn btn-ghost btn-sm dos-corrigir" onclick="voltarParaPreparar('${w.id}')"
          data-tip="A análise saiu errada? Devolve o item ao Preparar para re-analisar ou refazer do zero.">${ic('refresh','ic-sm')} Corrigir em Preparar</button>
      </footer>
    </article>`
}

// O convite a limpar os títulos. Só aparece quando há obra sem nome resolvido
// — some sozinho depois, e não fica pedindo dinheiro para sempre.
// É UMA chamada para TODAS as pendentes, e isso vai dito no botão: o custo é
// dele, e ele decide sabendo o tamanho.
let _dosNomesBusy = false
function _dosObrasSujasHTML(obras) {
  if (typeof resolverNomesDeObra !== 'function') return ''
  const sujas = obras.filter(o => o.obra !== OBRA_ESTUDO && !obrasNome[obraChaveNome(o.obra)])
  if (!sujas.length) return ''
  return `<p class="dos-intro dos-limpar">
    ${ic('sparkles','ic-sm')} ${sujas.length === 1
      ? 'Uma obra ainda está com o título como veio do arquivo'
      : `${sujas.length} obras ainda estão com o título como veio do arquivo`}
    — coisas como <i>(US Edition)</i>, nome de arquivo ou numeração de episódio.
    <button class="btn btn-ghost btn-sm" ${_dosNomesBusy ? 'disabled' : ''} onclick="dossieLimparTitulos()">${
      _dosNomesBusy ? '<span class="spinner"></span> limpando…'
                    : ic('sparkles','ic-sm') + ' Limpar com IA (1 chamada)'}</button></p>`
}

async function dossieLimparTitulos() {
  if (_dosNomesBusy || typeof resolverNomesDeObra !== 'function') return
  const brutos = [...new Set(_dossieListaCache.map(d => d.obra).filter(Boolean))]
  _dosNomesBusy = true; _dossiePintarCorpo()
  try {
    const n = await resolverNomesDeObra(brutos)
    if (n) toast(`${n} ${n === 1 ? 'título limpo' : 'títulos limpos'}`, 'success')
    else toast('Nada a limpar — os títulos já estão como o autor os chamou', 'info')
  } finally {
    _dosNomesBusy = false
    renderDossieSection()
  }
}

// ---- busca e filtro --------------------------------------------------
// NÃO são persistidos, de propósito. A lição já paga do projeto (o filtro de
// fonte do SRS) é que filtro salvo produz tela vazia sem explicação numa
// sessão futura. Aqui eles nascem limpos a cada abertura do app, e enquanto
// estiverem valendo a tela DIZ que estão — com um botão de limpar à mão.
// Quais OBRAS estão abertas. Da sessão, como a busca e o filtro: abrir o app
// mostrando doze pastas escancaradas seria a parede que a pasta veio evitar.
const _dosObrasAbertas = new Set()

let _dosBusca = ''
let _dosFiltro = 'todos'     // todos | pendentes | feitos

// A ORDEM, AO CONTRÁRIO, É PERSISTIDA — e a diferença é de natureza, não de
// gosto: filtro ESCONDE (e some sem explicar), ordenação só reorganiza. Nada
// desaparece, então não há como abrir o app e achar que ele quebrou. Re-
// escolher a ordem toda vez é que seria atrito à toa.
let _dosOrdem = (typeof loadUiPrefs === 'function' && loadUiPrefs().dosOrdem) || 'recentes'

// 'recentes' = o mais novo em cima (é o que o `unshift` do createWord já dava)
// 'fonte'    = a ordem em que ele ENCONTROU no livro — estudar na sequência da
//              leitura faz o dossiê recontar o capítulo em vez de embaralhá-lo.
function _dosComparar(a, b) {
  const t = s => Date.parse(s.w.created_at || '') || 0
  const dir = _dosOrdem === 'fonte' ? 1 : -1
  return (t(a) - t(b)) * dir || (a.i - b.i) * -dir
}

function dossieOrdenar(v) {
  _dosOrdem = (v === 'fonte') ? 'fonte' : 'recentes'
  if (typeof saveUiPref === 'function') saveUiPref('dosOrdem', _dosOrdem)
  _dossiePintarCorpo()
}

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
  // Busca pelos DOIS nomes: ele pode procurar por "Billy Summers" (o limpo,
  // que e o que a tela mostra) ou pelo que estiver lembrando do arquivo.
  if (_dosNorm(d.obra + ' ' + obraNome(d.obra) + ' ' + d.cap).includes(_dosBusca)) return true
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
      <label class="dos-ordem">
        ${ic('layers','ic-sm')}
        <select onchange="dossieOrdenar(this.value)" aria-label="Ordem dos itens">
          <option value="recentes"${_dosOrdem === 'recentes' ? ' selected' : ''}>Mais recentes primeiro</option>
          <option value="fonte"${_dosOrdem === 'fonte' ? ' selected' : ''}>Ordem da fonte (mais antigos)</option>
        </select>
      </label>
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
    // OBRA → CAPÍTULO → ITENS.
    // A lista era plana: um cartão por (obra, capítulo), então um livro de
    // doze capítulos virava doze cartões soltos repetindo o mesmo título. A
    // obra é o que se lê; o capítulo é onde se está DENTRO dela.
    // O agrupamento é pelo título BRUTO (a chave de verdade); o que aparece
    // na tela é `obraNome`, que limpa o lixo da fonte.
    const obras = new Map()
    for (const d of visiveis) {
      // ⚠️ AGRUPA PELO NOME RESOLVIDO, nao pelo bruto: item capturado ANTES
      // da limpeza ("Billy Summers (US Edition)") e item capturado DEPOIS
      // ("Billy Summers") virariam dois grupos exibindo o MESMO nome na tela --
      // o pior resultado possivel, porque parece defeito sem dar como entender.
      // Pelo resolvido, os dois convergem sozinhos e nada precisa ser reescrito.
      const k = obraChaveNome(obraNome(d.obra)) + '' + d.tipo
      if (!obras.has(k)) obras.set(k, { obra: d.obra, tipo: d.tipo, caps: [], itens: 0, feitos: 0 })
      const o = obras.get(k)
      o.caps.push(d); o.itens += d.itens.length; o.feitos += d.estudados
    }
    // Obra com pendência primeiro — é para lá que ele quer ir.
    const ordenadas = [...obras.values()].sort((a, b) =>
      ((b.itens - b.feitos) - (a.itens - a.feitos)) || obraNome(a.obra).localeCompare(obraNome(b.obra)))

    corpo.innerHTML = `
      <p class="dos-intro">Cada obra reúne <b>tudo que você captou dela</b>, separado por capítulo, com o material
      que a IA montou. Leia à vontade — marcar um item como estudado é o que o manda para a <b>Revisão</b>.</p>
      ${_dosObrasSujasHTML(ordenadas)}
      <div class="dos-obras">${ordenadas.map((o, oi) => {
        const falta = o.itens - o.feitos
        const pct = o.itens ? Math.round((o.feitos / o.itens) * 100) : 0
        const autor = obraAutor(o.obra)
        // COMPORTAMENTO DE PASTA: fechada por padrão.
        // Aberta, uma obra de 40 capítulos despeja 40 linhas — e com vários
        // livros na estante a tela vira uma parede antes de ele escolher onde
        // quer entrar. A obra diz QUANTOS capítulos tem; os capítulos só
        // aparecem quando ele pede.
        // ⚠️ Buscando, tudo abre: o resultado de uma busca é justamente a
        // linha lá dentro, e escondê-la faria a busca parecer quebrada.
        const chaveO = obraChaveNome(obraNome(o.obra))
        const aberta = !!_dosBusca || _dosObrasAbertas.has(chaveO)
        return `<section class="dos-obra${aberta ? ' aberta' : ''}">
          <button class="dos-obra-cab" data-o="${oi}" aria-expanded="${aberta}">
            <span class="dos-obra-ic">${srcIcon(o.tipo)}</span>
            <div class="dos-obra-nome">
              <b>${esc(obraNome(o.obra))}</b>
              <span>${autor ? esc(autor) + ' · ' : ''}${o.caps.length} ${o.caps.length === 1 ? 'capítulo' : 'capítulos'}</span>
            </div>
            <span class="dos-obra-n"><b>${falta}</b> para estudar<i>${o.feitos} de ${o.itens} feitos</i></span>
            <span class="dos-obra-seta">${ic('chevronDown','ic-sm')}</span>
            <span class="dos-barra"><i style="width:${pct}%"></i></span>
          </button>
          ${aberta ? `<div class="dos-caps">${o.caps
            .sort((a, b) => (b.itens.length - b.estudados) - (a.itens.length - a.estudados) || a.cap.localeCompare(b.cap))
            .map(d => {
              const f = d.itens.length - d.estudados
              return `<button class="dos-cap" data-k="${lista.indexOf(d)}">
                <span class="dos-cap-nome">${esc(d.cap || 'sem capítulo')}</span>
                <span class="dos-cap-n">${f ? `<b>${f}</b> para estudar` : 'tudo estudado'}</span>
                <span class="dos-cap-tot">${d.estudados}/${d.itens.length}</span>
                ${ic('chevronRight','ic-sm')}
              </button>`
            }).join('')}</div>` : ''}
        </section>`
      }).join('')}</div>`
    // A chave viaja pelo ÍNDICE do render, não dentro do onclick: ela carrega
    // um caractere de controle e o título do livro, e enfiar isso num atributo
    // HTML é convite para aspas, & e acentos quebrarem o clique.
    corpo.querySelectorAll('.dos-obra-cab').forEach(b => {
      b.onclick = () => {
        const o = ordenadas[+b.dataset.o]; if (!o) return
        const k = obraChaveNome(obraNome(o.obra))
        _dosObrasAbertas.has(k) ? _dosObrasAbertas.delete(k) : _dosObrasAbertas.add(k)
        _dossiePintarCorpo()
      }
    })
    corpo.querySelectorAll('.dos-cap').forEach(b => {
      b.onclick = () => {
        const d = lista[+b.dataset.k]
        if (!d) return
        // Deixa a obra ABERTA para a volta: ele estuda um capítulo, volta, e
        // encontra a pasta como deixou. Fechá-la aqui o obrigaria a reabrir a
        // cada capítulo — que é o atrito que a pasta veio remover.
        _dosObrasAbertas.add(obraChaveNome(obraNome(d.obra)))
        dossieAbrir(d.chave)
      }
    })
    return
  }

  // A ordem escolhida vale DENTRO de cada grupo. O que falta continua vindo
  // antes do que já foi feito: é o que ele veio fazer aqui, e inverter isso
  // seria fazê-lo rolar por cima do que já terminou.
  const falta = aberto.itens.filter(s => !s.feito).sort(_dosComparar)
  const feitos = aberto.itens.filter(s => s.feito).sort(_dosComparar)
  // O foco anda sobre a MESMA lista que a tela mostra — por isso ela é
  // guardada aqui, depois do filtro, da busca e da ordem.
  // Não estudados primeiro: é o que ele veio fazer.
  const visiveis = [...falta, ...feitos].filter(_dosItemCasa)
  _dosVisiveis = visiveis
  const filtrando = !!_dosBusca || _dosFiltro !== 'todos'
  corpo.innerHTML = `
    <div class="dos-topo">
      <button class="btn btn-ghost btn-sm" onclick="dossieVoltar()">${ic('chevronLeft','ic-sm')} Todos os dossiês</button>
      <div class="dos-titulo">
        <b>${esc(obraNome(aberto.obra))}</b>${aberto.cap ? `<span>${esc(aberto.cap)}</span>` : ''}
      </div>
      ${visiveis.length ? `<button class="btn btn-secondary btn-sm" onclick="dossieFoco()"
        data-tip="Um item por vez, tela cheia — as setas do teclado andam">${ic('expand','ic-sm')} Modo foco</button>` : ''}
      <span class="dos-contagem">${feitos.length}/${aberto.itens.length} estudados${
        filtrando ? ` · <i>${visiveis.length} na tela</i>` : ''}</span>
    </div>
    ${(falta.length === 0 && !filtrando) ? `<p class="dos-parabens">${ic('checkCircle','ic-sm')}
      Dossiê inteiro estudado — todos os itens já estão girando na Revisão.</p>` : ''}
    ${visiveis.length
      ? `<div class="dos-lista">${visiveis.map(_dossieCardHTML).join('')}</div>`
      : _dossieNadaHTML('item')}`
}

// ================================================================
// MODO FOCO — um item por vez, a tela inteira
// ================================================================
// A lista serve para percorrer o capítulo; o foco serve para ESTUDAR um item.
// São leituras diferentes, e é por isso que o material pesado (origem,
// vizinhos, exemplos todos) mora aqui e não lá: 14 itens com tudo aberto viram
// uma parede e ninguém lê a segunda metade.
//
// A FILA DO FOCO É UM RETRATO, TIRADO NA ENTRADA — e isto foi aprendido
// errando: a lista da tela se reordena sozinha (o estudado desce para o fim
// dos "concluídos"), então andar por índice sobre a lista VIVA pulava o
// vizinho e fazia o contador saltar de "2 de 3" para "3 de 3" no mesmo item.
// Congelando a ordem na entrada, o percurso é o que ele viu quando entrou:
// busca, filtro e ordem valem — mas valem uma vez, não a cada clique.
// O estado de cada sentido continua LIVE (lido do objeto, não do retrato),
// porque marcar estudado precisa aparecer na hora.
let _dosFoco = null            // { i } índice em _dosFocoLista, ou null
let _dosFocoLista = []         // o retrato: [{w, m}] na ordem da entrada
let _dosVisiveis = []          // a lista viva do último render (fonte do retrato)

function dossieFoco(wordId, meaningId) {
  _dosFocoLista = _dosVisiveis.slice()
  if (!_dosFocoLista.length) { toast('Nada para focar nesta tela', 'info'); return }
  const i = _dosFocoLista.findIndex(s => s.w.id === wordId && (s.m.id || '') === (meaningId || ''))
  _dosFoco = { i: i >= 0 ? i : 0 }
  _dosFocoPintar()
}

function dossieFocoSair() {
  _dosFoco = null
  _dosFocoLista = []
  document.body.classList.remove('dos-focando')
  const box = el('dos-foco'); if (box) box.remove()
  renderDossieSection()
}

// `dir` = +1 / -1. Sem circular de propósito: chegar ao fim é informação
// ("acabou o capítulo"), e voltar ao começo em silêncio esconderia isso.
function dossieFocoAndar(dir) {
  if (!_dosFoco) return
  const novo = _dosFoco.i + dir
  if (novo < 0 || novo >= _dosFocoLista.length) {
    toast(dir > 0 ? 'Último item deste dossiê' : 'Primeiro item deste dossiê', 'info')
    return
  }
  _dosFoco.i = novo
  _dosFocoPintar()
}

function dossieFocoEstudei() {
  if (!_dosFoco) return
  const s = _dosFocoLista[_dosFoco.i]; if (!s) return
  dossieEstudei(s.w.id, s.m.id)
  // `saveToSrs` pode RECUSAR (limite diário, sentido sem material). Nesse caso
  // o aviso já apareceu e não se anda: avançar aqui faria o item sumir da tela
  // sem ter entrado na revisão — o pior tipo de erro silencioso.
  // A leitura é pelo par VIVO, nunca pelo do retrato: um sync da nuvem troca os
  // objetos de `words`, e o retrato passaria a segurar cópias órfãs — o estado
  // ficaria eternamente 'estudo' e o foco nunca mais andaria.
  const vivo = _dossiePar(s.w.id, s.m.id)
  if (!vivo || sentidoEstado(vivo.m) !== 'revisao') { _dosFocoPintar(); return }
  // O retrato não mudou de tamanho, então o próximo é literalmente o próximo.
  if (_dosFoco.i >= _dosFocoLista.length - 1) { _dosFocoPintar(); toast('Último item deste dossiê', 'info'); return }
  dossieFocoAndar(+1)
}

// Desmarcar não mexe no retrato — só no estado do sentido, que é lido live.
// (Não apaga os cards já criados: essa decisão mora em `dossieDesfazerEstudo`.)
function dossieFocoDesfazer() {
  if (!_dosFoco) return
  const s = _dosFocoLista[_dosFoco.i]; if (!s) return
  dossieDesfazerEstudo(s.w.id, s.m.id)
  _dosFocoPintar()
}

// PORTA DE ENTRADA VINDA DE FORA (hoje: o atalho da Revisão).
// Quem chama sabe QUAL sentido quer, não em que dossiê ele mora nem que filtro
// está ligado — então aqui se arruma tudo: acha o dossiê pela chave, abre,
// derruba busca e filtro (o item vindo da revisão está 'feito' e sumiria no
// filtro "para estudar") e cai no foco em cima dele.
function dossieAbrirItem(wordId, meaningId) {
  const p = _dossiePar(wordId, meaningId)
  const e = p ? sentidoEstado(p.m) : ''
  if (!p || (e !== 'estudo' && e !== 'revisao')) {
    toast('Este item não está no Estudar', 'info'); return false
  }
  _dosBusca = ''
  _dosFiltro = 'todos'
  const inp = el('dossie-busca'); if (inp) inp.value = ''
  dossieAbrir(_dossieChave(p.w, p.m))
  _dossiePintarFiltros()
  // `dossieAbrir` já repintou o corpo, então `_dosVisiveis` é a lista deste
  // dossiê — e é dela que o retrato do foco vai sair.
  if (!_dosVisiveis.some(s => s.w.id === wordId && (s.m.id || '') === (meaningId || ''))) {
    toast('Item não encontrado neste dossiê', 'info'); return false
  }
  dossieFoco(wordId, meaningId)
  return true
}

// ================================================================
// O ITEM COMO PÁGINA DE ESTUDO
// ================================================================
// Decisão do Djemeson, e ela inverte o que eu tinha proposto: **nada é
// recolhido aqui**. Recolher é a lógica do REVISAR (onde material demais
// convida a reler em vez de lembrar) aplicada na tela errada. No Estudar o
// item está sozinho na tela justamente para ele se derramar em cima — rolar
// a página É o estudo. "O item pode ficar grande. O estudo é pra isso."
//
// O que substitui a regra de recolher é o ARCO. Uma página longa não morre de
// tamanho, morre de falta de ordem — então os blocos contam uma história:
//   reconhecer → entender → analisar a forma → ver em uso →
//   distinguir do vizinho → aprofundar → ligar ao histórico → PRODUZIR
// Termina em produção porque é o único ato da página que sai DELE.
//
// Bloco sem conteúdo não existe (não é economia de espaço: rótulo com nada
// embaixo é ruído). Por isso cada peça devolve '' quando não tem o que dizer,
// e a lista é filtrada — o índice lateral sai da mesma lista, então ele nunca
// aponta para uma seção vazia.

// A PASSAGEM DO LIVRO DESCE PARA CÁ. Ela vinha logo abaixo do título, em
// itálico, largura inteira, com moldura e rótulo em caixa alta — três linhas
// que a tela anunciava como o texto principal, enquanto o significado (o
// centro de verdade) vinha depois e em uma linha só.
// O papel dela é outro: é o ÚNICO exemplo autêntico da página. Os outros três
// são fabricados pela IA. Então ela é o exemplo #0, marcada como do livro, e
// no topo fica apenas um crédito de procedência.
function _dosExemplosHTML(w, m, ctx, ctxPt) {
  const exs = m.examples || []
  if (!ctx && !exs.length) return ''
  let out = '<div class="dosf-exs">'
  if (ctx) {
    // "do seu livro" só quando veio de livro. Vídeo, série e podcast têm cena,
    // não página — e no vídeo essa cena tem a GRAVAÇÃO REAL, capturada na hora
    // (guardada sob a chave do texto limpo da fala). Sem este botão a gravação
    // existia e não havia como tocá-la fora do card.
    const clip = m.clipId || w.clipId || ''
    const ORIG = { kindle:'do seu livro', website:'do que você leu', series:'da cena',
                   movie:'da cena', youtube:'do vídeo', podcast:'do episódio', manual:'de onde veio' }
    const selo = ORIG[m.source_type || w.source_type] || 'de onde você encontrou'
    out += `<div class="dosf-ex dosf-ex-livro" id="dosf-passagem">
      <span class="dosf-ex-n">${ic('bookOpen','ic-sm')}</span>
      <div>
        <div class="dosf-ex-en">${buildSrsFrente({ example_en: ctx, word: w.word })}</div>
        ${ctxPt ? `<div class="dosf-ex-pt">${escB(ctxPt)}</div>` : ''}
        <div class="dosf-ex-rodape">
          <span class="dosf-ex-selo">${selo}</span>
          <button class="btn btn-ghost btn-sm" onclick="playSrsTTS(${escA(JSON.stringify(ctx.replace(/<[^>]*>/g,'')))})"
            data-tip="Ouvir a passagem">${ic('volume','ic-sm')} Ouvir</button>
          ${clip ? `<button class="btn btn-ghost btn-sm" onclick="reverCena('${clip}')"
            data-tip="Abrir o vídeo no ponto exato desta fala">${ic('film','ic-sm')} Rever a cena</button>` : ''}
        </div>
      </div>
    </div>`
  }
  out += exs.map((ex, k) => `
    <div class="dosf-ex"><span class="dosf-ex-n">#${k + 1}</span>
      <div>
        <div class="dosf-ex-en">${buildSrsFrente({ example_en: ex.en || '', word: w.word })}</div>
        ${ex.pt ? `<div class="dosf-ex-pt">${escB(ex.pt)}</div>` : ''}
      </div>
    </div>`).join('')
  return out + '</div>'
}

// O QUE É — o centro da página, e agora ele parece o centro.
function _dosOqueHTML(m) {
  return `<div class="dosf-sig">${esc(m.meaning_pt)}</div>${
    m.definition_pt ? `<div class="dosf-def">${esc(m.definition_pt)}</div>` : ''}`
}

// A RÉGUA — sinônimo em lista não diz a DIFERENÇA, e a diferença é a
// informação toda. Por isso `confusoes` (o vizinho COM a régua) vem primeiro e
// os sinônimos/antônimos ficam embaixo, como referência rápida.
function _dosReguaHTML(m) {
  const conf = m.confusoes || [], sin = m.synonyms || [], ant = m.antonyms || []
  if (!conf.length && !sin.length && !ant.length) return ''
  let out = ''
  if (conf.length) {
    out += `<ul class="dosf-lista dosf-conf">${conf.map(c => {
      // "girl — neutro, mas infantiliza uma adulta": a palavra em negrito, a
      // régua em texto. Se a IA não usar o travessão, mostra a linha inteira.
      const p = String(c).split(/\s+[—–-]\s+/)
      return p.length > 1
        ? `<li><b>${esc(p[0])}</b> <span>${esc(p.slice(1).join(' — '))}</span></li>`
        : `<li>${esc(c)}</li>`
    }).join('')}</ul>`
  }
  if (sin.length || ant.length) {
    out += `<div class="dosf-vizinhos">${
      sin.length ? `<div class="dosf-viz"><span class="dosf-viz-cab">↔ parecidos</span>
        <span>${sin.map(esc).join(' · ')}</span></div>` : ''}${
      ant.length ? `<div class="dosf-viz ant"><span class="dosf-viz-cab">✕ opostos</span>
        <span>${ant.map(esc).join(' · ')}</span></div>` : ''}</div>`
  }
  return out
}

// LEITURA TOLERANTE de campo que virou LISTA.
// `armadilha` e `curiosidade` nasceram como texto único e viraram lista — uma
// palavra pode ter duas armadilhas e quatro curiosidades, e guardar em string
// obrigava a IA a escolher uma e jogar o resto fora. Item já gravado continua
// com string, e migrar dado só para mudar a forma seria arriscar o acervo por
// nada: quem lê aceita as duas.
function _dosLista(v) {
  if (Array.isArray(v)) return v.map(x => String(x || '').trim()).filter(Boolean)
  const s = String(v || '').trim()
  return s ? [s] : []
}
function _dosTem(v) { return _dosLista(v).length > 0 }

function _dosNotasHTML(v, classe) {
  const lista = _dosLista(v)
  if (!lista.length) return ''
  // Uma nota só não vira lista: numeração para um item é ruído.
  if (lista.length === 1) return `<p class="dosf-texto ${classe || ''}">${esc(lista[0])}</p>`
  return `<ul class="dosf-notas ${classe || ''}">${
    lista.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
}

// A FORMA — a informação que mais falta hoje. O item foi capturado como
// "Gals" e nada na tela dizia que o dicionário arquiva isso como "gal".
// Sem isto se aprende uma flexão e não se reconhece a outra.
function _dosFormasHTML(m) {
  const fs = m.forms || []
  if (!fs.length) return ''
  return `<div class="dosf-formas">${fs.map(f => {
    const p = String(f).split(/\s*=\s*/)
    return `<span class="dosf-forma"><b>${esc(p[0])}</b>${p[1] ? `<i>${esc(p[1])}</i>` : ''}</span>`
  }).join('')}</div>`
}

// COM QUEM ANDA — para produção, o item de maior retorno da página inteira.
function _dosColocacoesHTML(m) {
  const cs = m.collocations || []
  if (!cs.length) return ''
  return `<div class="dosf-colocacoes">${cs.map(c =>
    `<span class="dosf-coloc">${esc(c)}</span>`).join('')}</div>`
}

// COMO SE COMPORTA — o padrão gramatical (ocupa `grammar`, que era campo morto
// no modelo de dados desde sempre) mais a leitura prática do registro.
function _dosPadraoHTML(m) {
  const partes = []
  if (m.grammar) partes.push(`<p class="dosf-padrao">${esc(m.grammar)}</p>`)
  if (m.registro_uso) partes.push(`<p class="dosf-texto">${esc(m.registro_uso)}</p>`)
  return partes.join('')
}

// ================================================================
// NA SUA VIDA — o que o app já sabe, sem gastar um token
// ================================================================
// Tudo daqui sai do aparelho: `words[]`, o lema da Fase 3 e o EPUB guardado
// em `BookDB`. É a parte do verbete que NENHUM dicionário tem, porque depende
// da sua história de leitura — e é o que dá sentido à ideia do item que cresce.

// OS OUTROS SENTIDOS DESTE MESMO ITEM. Não é o mesmo que a régua: ali são
// palavras vizinhas, aqui é a MESMA palavra querendo dizer outra coisa — e
// cada um traz a cena de onde veio, que é o que os separa na memória.
function _dosIrmaosHTML(w, m) {
  const irmaos = sentidosDe(w).filter(x => x !== m)
  if (!irmaos.length) return ''
  const ONDE = { pronto:'no Preparar', estudo:'no Estudar', revisao:'na Revisão', saber:'só consulta' }
  return `<ul class="dosf-lista">${irmaos.map(x => {
    const cap = x.source_context || ''
    return `<li><b>${esc(x.meaning_pt)}</b>
      <span class="dosf-nota">${cap ? esc(cap) + ' · ' : ''}${ONDE[sentidoEstado(x)] || ''}</span></li>`
  }).join('')}</ul>`
}

// OS SENTIDOS QUE VOCÊ AINDA NÃO ENCONTROU (`w.sense_audit`).
// A IA já pensa em todos os sentidos do item a cada análise — é isso que a faz
// escolher o certo — e essa deliberação ia inteira para o console. Guardada,
// ela responde de graça a pergunta que o dicionário responderia: "o que mais
// essa palavra quer dizer?". Sem criar card para nenhum: eles chegam quando
// você os encontrar, que é a ideia do item que cresce.
//
// ⚠️ O texto bruto é raciocínio interno ("lei/regra: esvazia — SPLIT, test 2"),
// não conteúdo de aluno. Por isso passa por uma limpeza antes de aparecer, e
// qualquer linha que sobre parecida com o sentido que ele já tem é descartada.
function _dosAuditLimpo(w, m) {
  const bruto = Array.isArray(w.sense_audit) ? w.sense_audit : []
  if (!bruto.length) return []
  const norm = s => String(s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
  // Comparação por CONJUNTO de palavras, não por texto corrido: a auditoria
  // escreve na ordem dela ("moça/garota informal") e o sentido está na ordem
  // do verbete ("garota, moça"). Comparando string, os dois passavam como
  // diferentes e o mesmo sentido aparecia duas vezes na tela — foi o que o
  // teste mostrou.
  const conj = s => new Set(norm(s).split(' ').filter(p => p.length > 2))
  const cobre = (a, b) => {
    if (!a.size || !b.size) return false
    const menor = a.size <= b.size ? a : b, maior = a.size <= b.size ? b : a
    return [...menor].every(p => maior.has(p))
  }
  // Contra TODOS os sentidos que ele já tem, não só o desta tela: 'namorada'
  // já existe como sentido 'saber' do item, e reaparecia aqui como novidade.
  const jaTem = sentidosDe(w).map(x => conj(x.meaning_pt))
  const out = []
  for (const linha of bruto) {
    let t = String(linha || '').trim()
    // A linha final ("SELECIONADO: …") é o sentido que ele JÁ tem na tela.
    if (/^(selecionad|selected)/i.test(t)) continue
    // O veredito e o número do teste são jargão do prompt, não informação.
    t = t.replace(/\s*[—-]\s*(SPLIT|MERGED)\b.*$/i, '').trim()
    if (!t || t.length < 3) continue
    const c = conj(t)
    if (!c.size) continue
    if (jaTem.some(j => cobre(c, j))) continue
    if (out.some(x => cobre(c, conj(x)))) continue
    out.push(t)
  }
  // Sem teto: se a IA deliberou sobre doze sentidos, os doze são o verbete
  // que ele ainda vai encontrar. Cortar em oito escondia parte do mapa.
  return out
}

function _dosMaisSentidosHTML(w, m) {
  const linhas = _dosAuditLimpo(w, m)
  if (!linhas.length) return ''
  return `<ul class="dosf-lista">${linhas.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    <p class="dosf-nota">Nenhum destes virou card. Eles entram quando você os encontrar
    numa leitura — é assim que o verbete cresce.</p>`
}

// A FAMÍLIA DO LEMA (Fase 3): `fall` mora debaixo do mesmo teto que
// `fall in love` e `fall behind`. Já existia no verbete da Biblioteca e
// faltava aqui, que é onde ele estuda.
function _dosFamiliaHTML(w) {
  if (typeof lemaDoItem !== 'function' || !Array.isArray(words)) return ''
  const lema = lemaDoItem(w)
  if (!lema) return ''
  const parentes = words.filter(x => x !== w && x.status !== 'skipped' && lemaDoItem(x) === lema)
  if (!parentes.length) return ''
  return `<p class="dosf-texto">${ic('layers','ic-sm')} Debaixo de <b>${esc(lema)}</b> você também estuda:
    ${parentes.map(x => `<a href="#" onclick="return _dosIrParaItem(event,'${x.id}')">${esc(x.word)}</a>`).join(' · ')}</p>`
}

function _dosIrParaItem(ev, wordId) {
  ev.preventDefault()
  const w = words.find(x => x.id === wordId)
  const m = w && sentidosDe(w).find(x => ['estudo','revisao'].includes(sentidoEstado(x)))
  if (m) dossieAbrirItem(w.id, m.id)
  else if (typeof openWordGlossary === 'function') openWordGlossary(wordId)
  return false
}

// QUANTAS VEZES APARECE NO SEU LIVRO — e ONDE.
// ⚠️ ESTA PEÇA FOI REFEITA. A primeira versão contava o livro INTEIRO com um
// regex, e tinha dois defeitos: dava só um número (sem os trechos, que é onde
// está o aprendizado) e, pior, contava capítulos que ele AINDA NÃO LEU —
// spoiler embutido numa tela de estudo. Agora usa o motor da obra
// (`obraBuscar`, em ler.js), que respeita a fronteira do que ele já leu e
// devolve as frases.
// O motor é LAZY: o Estudar carrega o pacote do leitor sob demanda, do mesmo
// jeito que o reparo faz em Configurações (armadilha nº 1).
const _dosFreqCache = new Map()     // livroId|termo → resultado da busca

async function _dosCarregarObra() {
  if (typeof obraBuscar === 'function') return true
  for (const f of ['js/epub.js', 'js/ler.js']) {
    try { await _loadScript(f) } catch (e) { console.error(e); return false }
  }
  return typeof obraBuscar === 'function'
}

function _dosFreqHTML(w) {
  const livro = _dosLivroDoItem(w)
  if (!livro) return ''
  const chave = livro.id + '|' + String(w.word || '').toLowerCase()
  const r = _dosFreqCache.get(chave)
  if (r) {
    if (!r.total) return `<p class="dosf-nota">${ic('search','ic-sm')} não achei
      <b>${esc(w.word)}</b> no que você já leu de <i>${esc(obraNome(livro.title))}</i>.</p>`
    return `<p class="dosf-texto">${ic('search','ic-sm')} <b>${esc(w.word)}</b> aparece
        <b>${r.total}×</b> no que você já leu de <i>${esc(obraNome(livro.title))}</i>${
        r.caps > 1 ? `, em ${r.caps} capítulos` : ''}.</p>
      ${typeof obraBlocoHTML === 'function' ? obraBlocoHTML(r, { noLeitor: false }) : ''}`
  }
  return `<p class="dosf-texto" id="dosf-freq"><button class="btn btn-ghost btn-sm"
    onclick="dossieContarNoLivro('${w.id}')">${ic('search','ic-sm')} Procurar em "${escA(obraNome(livro.title))}"</button>
    <span class="dosf-nota"> — só no que você já leu, sem estragar o que vem.</span></p>`
}

function _dosLivroDoItem(w) {
  if (!Array.isArray(livros) || !livros.length) return null
  const t = String(obraNome(w.source_title || '')).trim().toLowerCase()
  if (!t) return null
  return livros.find(l => String(obraNome(l.title) || '').trim().toLowerCase() === t
                       || String(l.title || '').trim().toLowerCase() === t) || null
}

async function dossieContarNoLivro(wordId) {
  const w = words.find(x => x.id === wordId); if (!w) return
  const livro = _dosLivroDoItem(w); if (!livro) return
  const alvo = el('dosf-freq')
  if (alvo) alvo.innerHTML = `<span class="dosf-nota"><span class="spinner"></span> lendo o livro…</span>`
  if (!(await _dosCarregarObra())) {
    if (alvo) alvo.innerHTML = `<span class="dosf-nota">não consegui carregar o leitor</span>`
    return
  }
  try {
    const r = await obraBuscar(livro, String(w.word || ''), { maxTrechos: 4 })
    _dosFreqCache.set(livro.id + '|' + String(w.word || '').toLowerCase(), r)
    _dosFocoPintar()
  } catch (e) {
    console.error(e)
    if (alvo) alvo.innerHTML = `<span class="dosf-nota">não deu para ler o livro: ${esc(e.message || 'erro')}</span>`
  }
}

// O CONVITE A COMPLETAR — só aparece para item do acervo ANTIGO, que foi
// analisado antes destes campos existirem. Some sozinho depois de completar
// (inclusive quando a IA responde que não há nada a acrescentar: o carimbo
// `material_at` é o que impede o botão de ficar pedindo dinheiro para sempre).
function _dosCompletarHTML(w, m) {
  // ⚠️ `[]` É TRUTHY em JS. Com `armadilha` e `curiosidade` virando LISTA, um
  // `m.armadilha ? …` daria "tem material" para um item cujo campo veio vazio —
  // e a oferta de completar sumiria de quem mais precisa dela. Tudo passa por
  // `_dosTem`, que mede array e string pela mesma régua.
  const temAlgo = ['forms','collocations','confusoes','armadilha','curiosidade']
                    .some(c => _dosTem(m[c])) || m.grammar || m.registro_uso
  if (typeof completarMaterial !== 'function') return ''
  const rodando = typeof estaEmAnalise === 'function' && estaEmAnalise(w.id + '|' + m.id)
  // JÁ TEM MATERIAL: a oferta deixa de ser "completar" e vira REFAZER.
  // Melhorar o prompt não melhora o dado já gravado — a lição que este projeto
  // já pagou três vezes. Foi o caso da "curiosidade", que vinha devolvendo
  // observação de REGISTRO disfarçada ("tom leve, amistoso e um pouco retrô"
  // para "gals"): a regra apertou, e sem isto todo item antigo ficaria com o
  // texto velho até uma re-análise inteira — mais cara, e mexendo no que ele
  // já curou.
  if (temAlgo || m.material_at) {
    return `<p class="dosf-texto dosf-nota">Forma, padrão, colocações, régua, cuidado e
        curiosidade vieram de uma análise anterior. Refazer pede tudo de novo com as regras
        atuais — significado, definição e exemplos continuam intocados.</p>
      <button class="btn btn-ghost btn-sm" ${rodando ? 'disabled' : ''}
        onclick="dossieCompletar('${w.id}','${m.id}',true)">${
        rodando ? '<span class="spinner"></span> refazendo…' : ic('refresh','ic-sm') + ' Refazer o material'}</button>`
  }
  return `<p class="dosf-texto">Este sentido foi analisado antes de o app aprender a guardar
      forma, padrão, colocações e régua. Uma chamada de IA busca só o que falta —
      seu significado, definição e exemplos não são tocados.</p>
    <button class="btn btn-secondary btn-sm" ${rodando ? 'disabled' : ''}
      onclick="dossieCompletar('${w.id}','${m.id}')">${
      rodando ? '<span class="spinner"></span> completando…' : ic('sparkles','ic-sm') + ' Completar material'}</button>`
}

// ================================================================
// TEMPOS VERBAIS e A FAMÍLIA COMPLETA
// ================================================================
// A conjugação e a família vêm da MESMA chamada (`expandirFamilia`) e moram no
// ITEM, não no sentido: "get up" existe independentemente de qual sentido de
// "get" ele encontrou no livro.
function _dosConjugacaoHTML(w) {
  const c = w.conjugacao || []
  if (!c.length) return ''
  return `<table class="dosf-conj"><tbody>${c.map(f => `
    <tr>
      <th>${esc(f.rotulo || '')}</th>
      <td><b>${esc(f.forma)}</b></td>
      <td>${f.exemplo ? buildSrsFrente({ example_en: f.exemplo, word: f.forma }) : ''}</td>
    </tr>`).join('')}</tbody></table>`
}

const _DOS_FAM_ROTULOS = {
  phrasal_verb: 'phrasal verbs', idiom: 'idioms', collocation: 'colocações',
  chunk: 'blocos fixos', derivada: 'palavras derivadas'
}
const _DOS_FAM_ORDEM = ['phrasal_verb', 'idiom', 'collocation', 'chunk', 'derivada']

// Cada linha tem PREPARAR a um clique — o pedido literal dele — e EXPLICAR ao
// lado, que abre o painel da Lexa sem tirar ninguém do estudo. O que ele já
// tem aparece marcado e não é clicável, pela mesma regra dos chips da frase.
function _dosFamiliaCompletaHTML(w) {
  const fam = w.familia || []
  if (!fam.length) return ''
  const lang = wordLang(w)
  const grupos = _DOS_FAM_ORDEM.map(tipo => {
    const lista = fam.filter(x => x.tipo === tipo)
    if (!lista.length) return ''
    return `<div class="dosf-fam-grupo">
      <h4>${esc(_DOS_FAM_ROTULOS[tipo])} <span>${lista.length}</span></h4>
      ${lista.map(x => {
        const meu = typeof prepAcharItem === 'function' && prepAcharItem(x.expr, lang)
        return `<div class="dosf-fam-linha${meu ? ' meu' : ''}">
          <div class="dosf-fam-txt"><b>${esc(x.expr)}</b>${x.nivel ? `<i>${esc(x.nivel)}</i>` : ''}
            ${x.gloss ? `<span>${esc(x.gloss)}</span>` : ''}</div>
          ${meu ? `<span class="dosf-fam-selo">${ic('check','ic-sm')} já é seu</span>` : `
            <span class="dosf-fam-acoes">
              <button class="btn btn-ghost btn-sm" onclick="dossieFamiliaExplicar(event,'${w.id}',${escA(JSON.stringify(x.expr))})"
                data-tip="A Lexa explica sem tirar você do estudo">${ic('sparkles','ic-sm')} explicar</button>
              <button class="btn btn-secondary btn-sm" onclick="dossieFamiliaPreparar('${w.id}',${escA(JSON.stringify(x.expr))})"
                data-tip="Vai direto para a fila do Preparar">${ic('plus','ic-sm')} Preparar</button>
            </span>`}
        </div>`
      }).join('')}
    </div>`
  }).filter(Boolean).join('')
  return grupos
}

function _dosFamAchar(wordId, expr) {
  const w = words.find(x => x.id === wordId)
  const it = w && (w.familia || []).find(x => x.expr === expr)
  return { w, it }
}

function dossieFamiliaPreparar(wordId, expr) {
  const { w, it } = _dosFamAchar(wordId, expr)
  if (!w || !it || typeof lexaChipParaPreparar !== 'function') return
  // Reusa a peça dos chips da frase: mesma criação, mesma semente, mesma
  // proteção contra duplicar.
  // ⚠️ A PROCEDÊNCIA É O ESTUDO, não a obra. "booklet" saiu da família de
  // "digest-sized"; ele nunca a leu em Billy Summers, e mandá-la para lá com a
  // passagem do livro por contexto é o mesmo defeito da seleção — fonte de avô
  // virando fonte de neto. O botão erra tão fácil quanto o selecionar errava.
  lexaChipParaPreparar(
    { expr: it.expr, gloss: it.gloss, type: it.tipo === 'derivada' ? 'word' : it.tipo },
    { contexto: '', lang: wordLang(w),
      source_type: 'manual', source_title: OBRA_ESTUDO, source_context: w.word || '' })
  _dosFocoPintar()
}

// O `ev` só serve para ANCORAR o balão no botão que ele clicou — a explicação
// aparece onde a mão dele já estava, e não no meio da tela.
async function dossieFamiliaExplicar(ev, wordId, expr) {
  const { w, it } = _dosFamAchar(wordId, expr)
  if (!w || !it || typeof lexaBalaoAbrir !== 'function') return
  if (!aiChatCfg().key) {
    toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error'); return
  }
  const corpo = lexaBalaoAbrir({ titulo: it.expr, fonte: `da família de "${w.word}"`,
    alvo: (ev && ev.currentTarget) || ev })
  const vivo = () => lexaBalaoVivo(corpo)
  corpo.innerHTML = `<span class="gen-spinner"></span> ${esc(lexaNome())} está explicando…`
  try {
    const L = getLangDef(wordLang(w))
    const sistema = lexaExplicar()
    const pergunta = `O aluno estuda "${w.word}" e está vendo a família de expressões dele.
Explique a expressão ${L.nameEn} "${it.expr}"${it.gloss ? ` (${it.gloss})` : ''}: o que quer dizer, quando se usa e um exemplo curto.`
    const resp = await aiTextSeguro([
      { role: 'system', content: sistema },
      { role: 'user', content: pergunta }
    ], { maxTokens: 500 })
    if (!vivo()) return
    corpo.innerHTML = lexaFormatar(resp)
    if (typeof lexaChatMontar === 'function') {
      lexaChatMontar(corpo, { sistema, primeira: pergunta, resposta: resp })
    }
  } catch (e) {
    if (vivo()) corpo.innerHTML = `<span style="color:var(--error)">Não deu: ${esc(e.message)}</span>`
  }
}

// O convite a buscar a família. Some depois de buscada (o carimbo é quem
// impede o botão de ficar pedindo dinheiro para sempre), e vira "atualizar".
function _dosFamiliaConviteHTML(w) {
  if (typeof expandirFamilia !== 'function') return ''
  const rodando = typeof estaEmAnalise === 'function' && estaEmAnalise('fam|' + w.id)
  const tem = (w.familia || []).length
  if (!tem && w.familia_at) return ''   // já buscou e não havia nada
  return `${tem ? '' : `<p class="dosf-texto">Uma chamada de IA lista <b>tudo que existe com
      "${esc(w.word)}"</b> — phrasal verbs, idioms, colocações, blocos fixos e palavras derivadas —
      e cada um fica a um clique do Preparar.</p>`}
    <button class="btn ${tem ? 'btn-ghost' : 'btn-secondary'} btn-sm" ${rodando ? 'disabled' : ''}
      onclick="dossieFamiliaBuscar('${w.id}')">${
      rodando ? '<span class="spinner"></span> procurando…'
              : ic(tem ? 'refresh' : 'layers','ic-sm') + (tem ? ' Atualizar a lista' : ' Buscar tudo que existe com este item')}</button>`
}

async function dossieFamiliaBuscar(wordId) {
  if (typeof expandirFamilia !== 'function') return
  await expandirFamilia(wordId)
  _dosFocoPintar()
}

// ================================================================
// PRODUZA — o único ato da página que sai DELE
// ================================================================
// Tudo acima é consumo: ler, comparar, entender. Aqui ele escreve uma frase
// própria e a Lexa devolve a correção. É o pulo de reconhecer para produzir, e
// é por isso que este é o ÚLTIMO bloco: fecha o estudo com o aluno usando o
// item, não relendo sobre ele.
//
// Custa uma chamada de IA POR RESPOSTA e só quando ele clica — nada acontece
// ao simplesmente abrir o item.
const _dosProduzir = new Map()   // wordId|meaningId → { texto, resposta, erro, rodando }

function _dosProduzirHTML(w, m) {
  if (typeof aiJSON !== 'function') return ''
  const k = w.id + '|' + m.id
  const st = _dosProduzir.get(k) || {}
  return `
    <p class="dosf-texto">Escreva uma frase sua com <b>${esc(w.word)}</b> no sentido
      “${esc(m.meaning_pt)}”. A Lexa corrige e diz se o registro ficou certo.</p>
    <textarea class="dosf-escrita" id="dosf-escrita" rows="2" spellcheck="false"
      placeholder="Sua frase em ${esc((getLangDef(wordLang(w)) || {}).name || 'inglês')}…"
      oninput="_dosProduzirGuardar('${w.id}','${m.id}',this.value)">${esc(st.texto || '')}</textarea>
    <div class="dosf-escrita-acoes">
      <button class="btn btn-primary btn-sm" ${st.rodando ? 'disabled' : ''}
        onclick="dossieProduzir('${w.id}','${m.id}')">${
        st.rodando ? '<span class="spinner"></span> conferindo…' : ic('send','ic-sm') + ' Pedir correção'}</button>
      ${st.resposta ? `<button class="btn btn-ghost btn-sm" onclick="_dosProduzirLimpar('${w.id}','${m.id}')">${ic('x','ic-sm')} limpar</button>` : ''}
    </div>
    ${st.erro ? `<p class="dosf-nota">${esc(st.erro)}</p>` : ''}
    ${st.resposta ? `<div class="dosf-correcao">${st.resposta}</div>` : ''}`
}

// O texto fica em memória, NÃO em `words`: é rascunho de exercício, não
// vocabulário. Gravar em `words` faria isso viajar para a nuvem e para os
// outros aparelhos, e sujaria o backup com rabisco.
function _dosProduzirGuardar(wordId, meaningId, v) {
  const k = wordId + '|' + meaningId
  _dosProduzir.set(k, { ..._dosProduzir.get(k), texto: v })
}
function _dosProduzirLimpar(wordId, meaningId) {
  _dosProduzir.delete(wordId + '|' + meaningId)
  _dosFocoPintar()
}

async function dossieProduzir(wordId, meaningId) {
  const w = words.find(x => x.id === wordId); if (!w) return
  const m = (w.meanings || []).find(x => x && x.id === meaningId); if (!m) return
  const k = wordId + '|' + meaningId
  const st = _dosProduzir.get(k) || {}
  const frase = String(st.texto || '').trim()
  if (frase.length < 3) { toast('Escreva a frase primeiro', 'info'); return }
  if (!aiChatCfg().key) {
    toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error')
    showSection('configuracoes'); return
  }
  _dosProduzir.set(k, { ...st, rodando: true, erro: '', resposta: '' })
  _dosFocoPintar()
  // O foco repinta e o campo nasce de novo: sem devolver o cursor, escrever a
  // segunda frase obrigaria a clicar no campo outra vez.
  const L = getLangDef(wordLang(w))
  try {
    const PROMPT = `A Brazilian learner is practising the ${L.nameEn} item "${w.word}" in the sense "${m.meaning_pt}"${
      m.definition_pt ? ` (${m.definition_pt})` : ''}${m.grammar ? `, whose pattern is: ${m.grammar}` : ''}.

The sentence he wrote:
"""${frase}"""

Judge ONLY this sentence. Answer in Brazilian Portuguese, warmly and briefly, as a teacher who wants him to keep writing.

Return ONLY this JSON:
{
 "ok": true or false — true if the sentence uses "${w.word}" correctly IN THAT SENSE and is natural ${L.nameEn},
 "corrigida": "the corrected sentence in ${L.nameEn}. If nothing needs changing, repeat his sentence unchanged.",
 "comentario": "1-3 sentences in PT-BR. Say what he got right FIRST — always find something. Then, only if there is a real problem, name it plainly (wrong sense, wrong pattern, unnatural word order, wrong register). Never invent an error just to have something to say.",
 "registro": "one short line in PT-BR on whether the register fits where he would use this sentence, or \\"\\" if it is fine and unremarkable."
}`
    const r = await aiJSON(PROMPT, { maxTokens: 700, schema: ESQ.produzir, schemaNome: 'produzir' })
    if (!r || typeof r !== 'object') throw new Error('resposta vazia')
    const fmt = t => (typeof lexaInline === 'function') ? lexaInline(String(t || '')) : esc(String(t || ''))
    const ok = (r.ok === true || /^(true|sim|yes|1)$/i.test(String(r.ok || '')))
    const corr = String(r.corrigida || '').trim()
    let html = `<div class="dosf-veredito ${ok ? 'ok' : 'ajuste'}">${
      ic(ok ? 'checkCircle' : 'pencil','ic-sm')} ${ok ? 'Está certo' : 'Dá para melhorar'}</div>`
    // A frase corrigida só aparece quando é DIFERENTE da dele: devolver a
    // mesma frase como "corrigida" faria parecer que houve conserto.
    if (corr && corr.replace(/\s+/g,' ') !== frase.replace(/\s+/g,' ')) {
      html += `<p class="dosf-corrigida">${esc(corr)}</p>`
    }
    if (r.comentario) html += `<p class="dosf-texto">${fmt(r.comentario)}</p>`
    if (r.registro)   html += `<p class="dosf-nota">${fmt(r.registro)}</p>`
    _dosProduzir.set(k, { texto: frase, resposta: html, rodando: false, erro: '' })
  } catch (e) {
    _dosProduzir.set(k, { texto: frase, rodando: false, erro: 'Não deu para conferir: ' + (e.message || 'erro'), resposta: '' })
  }
  _dosFocoPintar()
}

async function dossieCompletar(wordId, meaningId, refazer) {
  if (typeof completarMaterial !== 'function') return
  await completarMaterial(wordId, meaningId, refazer)
  _dosFocoPintar()
}

// A procedência vira UM CRÉDITO no topo: obra, capítulo, e um clique que rola
// até a passagem lá embaixo. Nota de rodapé de dicionário, não manchete.
function _dosFocoCabecalho(w, m, feito, ctx) {
  // O nome LIMPO: a procedencia mostra a obra como o autor a chamou, nao o
  // que veio no arquivo. O bruto continua sendo a chave, so nao aparece.
  const obra = obraNome(m.source_title || w.source_title || '')
  const cap  = m.source_context || w.source_context || ''
  return `
    <header class="dosf-cab">
      <div class="dosf-cab-linha">
        <b>${esc(w.word || '(frase)')}</b>
        ${w.ipa ? `<span class="dosf-ipa">${esc(w.ipa)}</span>` : ''}
        ${_dosAudioHTML(w, m)}
        ${feito ? `<span class="dos-selo">${ic('check','ic-sm')} estudado</span>` : ''}
      </div>
      <div class="dos-chips">${_dosChips(w, m)}</div>
      ${(typeof _familiaHtml === 'function' ? _familiaHtml(w) : '')}
      ${obra ? `<div class="dosf-fonte">${ic('bookOpen','ic-sm')}
        ${ctx ? `<a href="#dosf-passagem" onclick="return _dosFocoIrPassagem(event)">` : '<span>'}
        ${esc(obra)}${cap ? ' · ' + esc(cap) : ''}
        ${ctx ? '</a>' : '</span>'}</div>` : ''}
    </header>`
}

// O ARCO. A ordem é a tese da tela — mexer aqui é mexer no que se estuda antes
// do quê. Peça que devolve '' some, e some também do índice.
function _dosFocoBlocos(w, m, ctx, ctxPt) {
  return [
    { id:'oque',    rotulo:'O que é',           icone:'target',   html:_dosOqueHTML(m) },
    { id:'forma',   rotulo:'A forma',           icone:'shrink',   html:_dosFormasHTML(m) },
    { id:'padrao',  rotulo:'Como se comporta',  icone:'wrench',   html:_dosPadraoHTML(m) },
    { id:'anda',    rotulo:'Com quem anda',     icone:'zap',      html:_dosColocacoesHTML(m) },
    // A conjugação fica logo depois da forma e do padrão: é a mesma pergunta
    // ("que cara isso tem?"), só que estendida no tempo.
    { id:'tempos',  rotulo:'Tempos verbais',    icone:'clock',    html:_dosConjugacaoHTML(w) },
    { id:'uso',     rotulo:'Em uso',            icone:'message',  html:_dosExemplosHTML(w, m, ctx, ctxPt) },
    { id:'regua',   rotulo:'A régua',           icone:'layers',   html:_dosReguaHTML(m) },
    { id:'cuidado', icone:'alert',
      rotulo: _dosLista(m.armadilha).length > 1 ? 'Cuidados' : 'Cuidado',
      html: _dosNotasHTML(m.armadilha, 'dosf-alerta') },
    { id:'mais',    rotulo:'Também quer dizer', icone:'book',     html:_dosMaisSentidosHTML(w, m) },
    // A família fica DEPOIS de "também quer dizer" porque é o passo seguinte
    // da mesma escada: primeiro os outros sentidos da MESMA palavra, depois as
    // unidades MAIORES que ela forma — que são itens de estudo à parte.
    { id:'familia', icone:'layers',
      rotulo: (w.familia || []).length ? `Tudo com "${w.word}"` : 'A família deste item',
      html: _dosFamiliaCompletaHTML(w) + _dosFamiliaConviteHTML(w) },
    // Aqui o texto vai NU: quem rotula é o cabeçalho da seção. A versão com
    // rótulo próprio (`_dosOrigemHTML`) continua servindo o cartão da lista,
    // que não tem seções.
    // Origem ANTES de curiosidade: primeiro de onde a palavra veio, depois o
    // que ela virou. Ao contrário, a nota cultural chega sem chão.
    { id:'origem',  rotulo:'De onde vem',  icone:'sparkles',
      html: m.origin_pt ? `<p class="dosf-texto">${esc(m.origin_pt)}</p>` : '' },
    // Plural no rotulo quando ha mais de uma: a tela nao pode chamar de
    // "Curiosidade" uma lista de quatro.
    { id:'curiosidade', icone:'flame',
      rotulo: _dosLista(m.curiosidade).length > 1 ? 'Curiosidades' : 'Curiosidade',
      html: _dosNotasHTML(m.curiosidade) },
    // O rótulo muda com o estado: falta material, ou material que dá para
    // refazer com as regras de hoje.
    { id:'completar', icone:'sparkles', html:_dosCompletarHTML(w, m),
      rotulo: (m.material_at || (m.forms || []).length || m.grammar || _dosTem(m.curiosidade))
        ? 'O material desta análise' : 'Falta material' },
    // O último bloco antes de produzir: a palavra dentro da SUA história de
    // leitura. Tudo local, nenhuma chamada de IA.
    { id:'vida',    rotulo:'Na sua vida', icone:'clock',
      html: [_dosIrmaosHTML(w, m), _dosFamiliaHTML(w), _dosFreqHTML(w)].filter(Boolean).join('') },
    // O ÚLTIMO, sempre — fecha o estudo com ele usando o item, não relendo
    // sobre ele. É o único bloco que não some por falta de conteúdo, porque o
    // conteúdo é o que ele vai escrever.
    { id:'produzir', rotulo:'Produza',   icone:'pencil',    html:_dosProduzirHTML(w, m) }
  ].filter(b => b.html)
}

// O "você está aqui" do índice. Sem ele, numa página de doze blocos, o índice
// vira uma lista de links que não diz onde você está — metade da utilidade.
//
// Por que rolagem e não `IntersectionObserver`, que seria a ferramenta certa:
// o observador é a escolha melhor no papel (quem calcula é o navegador), mas
// ele NÃO dispara no navegador de teste desta sessão — a aba não compõe frames
// e nenhum callback chega, nem com root na janela. Sem conseguir provar, não
// entra. Isto aqui eu consigo medir, e o custo é irrisório: um ouvinte, preso
// a `requestAnimationFrame`, sobre uma dúzia de seções.
// O limitador é por TEMPO e não por `requestAnimationFrame` pelo mesmo motivo
// do parágrafo acima: rAF também não roda no navegador de teste, e um marcador
// que eu não consigo medir é um marcador que eu não sei se funciona. Ler oito
// retângulos a cada 80ms não custa nada.
let _dosFocoUltimo = 0
function _dosFocoObservar(box) {
  // Só o CORPO é obrigatório: o ouvinte serve duas coisas agora — o marcador
  // do índice e o encolher do cabeçalho —, e a segunda tem de valer mesmo num
  // item sem seção nenhuma, que é quando o índice não existe.
  const corpo = box.querySelector('.dosf-corpo')
  if (!corpo) return
  // O ouvinte morre junto com o nó a cada repintura (o innerHTML troca o
  // corpo inteiro), então não há como sobrar órfão.
  corpo.addEventListener('scroll', () => {
    const agora = Date.now()
    if (agora - _dosFocoUltimo < 80) return
    _dosFocoUltimo = agora
    _dosFocoMarcarAqui(box)
  })
  _dosFocoMarcarAqui(box)
}

function _dosFocoMarcarAqui(box) {
  const corpo = box.querySelector('.dosf-corpo')
  if (!corpo) return
  // O cabeçalho encolhe assim que a rolagem começa. Vai junto com o marcador
  // do índice porque é o MESMO evento — dois ouvintes de scroll no mesmo
  // elemento seria pagar duas vezes pela mesma informação.
  // O limiar é generoso (12px) para não piscar com o tranco do trackpad.
  const cab = box.querySelector('.dosf-cab')
  if (cab) cab.classList.toggle('encolhido', corpo.scrollTop > 12)
  const nav = box.querySelector('.dosf-indice')
  if (!nav) return
  const blocos = [...box.querySelectorAll('.dosf-bloco')]
  if (!blocos.length) return
  // "Onde estou" = o último bloco cujo topo já passou pelo cursor de leitura,
  // uma faixa a 25% da altura do corpo. Pegar o bloco mais próximo do topo
  // absoluto acenderia o seguinte cedo demais; pegar o que "está visível"
  // acenderia dois ao mesmo tempo, porque as seções têm alturas diferentes.
  const cursor = corpo.getBoundingClientRect().top + corpo.clientHeight * 0.25
  let atual = blocos[0]
  for (const b of blocos) { if (b.getBoundingClientRect().top <= cursor) atual = b }
  // No fim da rolagem manda o ÚLTIMO: a última seção costuma ser curta demais
  // para alcançar o cursor, e ficaria eternamente apagada.
  if (corpo.scrollTop + corpo.clientHeight >= corpo.scrollHeight - 4) atual = blocos[blocos.length - 1]
  const alvo = '#' + atual.id
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('aqui', a.getAttribute('href') === alvo))
}

// Rolagem dentro do CORPO do foco — é ele que rola, não a janela.
// `scrollTop` calculado na mão em vez de `scrollIntoView`: assim o topo da
// seção para logo abaixo da borda, e não colado nela.
function _dosFocoIr(ev, id) {
  ev.preventDefault()
  const box = el('dos-foco'); if (!box) return false
  const corpo = box.querySelector('.dosf-corpo')
  const alvo = document.getElementById('dosf-s-' + id)
  if (corpo && alvo) {
    corpo.scrollTop += alvo.getBoundingClientRect().top - corpo.getBoundingClientRect().top - 12
  }
  return false
}
function _dosFocoIrPassagem(ev) {
  ev.preventDefault()
  const box = el('dos-foco')
  const corpo = box && box.querySelector('.dosf-corpo')
  const alvo = document.getElementById('dosf-passagem')
  if (corpo && alvo) {
    corpo.scrollTop += alvo.getBoundingClientRect().top - corpo.getBoundingClientRect().top - 60
    // Um pisca curto: sem ele o clique parece não ter feito nada quando a
    // passagem já estava visível na tela.
    alvo.classList.remove('pisca'); void alvo.offsetWidth; alvo.classList.add('pisca')
  }
  return false
}

function _dosFocoPintar() {
  if (!_dosFoco) return
  if (!_dosFocoLista.length) { dossieFocoSair(); return }
  _dosFoco.i = Math.max(0, Math.min(_dosFoco.i, _dosFocoLista.length - 1))
  const s = _dosFocoLista[_dosFoco.i]
  // Reancora pelo id a cada pintura: o retrato guarda a ORDEM do percurso, não
  // os dados. Se um sync trocou os objetos de `words`, é o par vivo que aparece
  // na tela; se o item sumiu de vez, sai do foco em vez de pintar um fantasma.
  const par = _dossiePar(s.w.id, s.m.id)
  if (!par) { toast('Este item saiu do dossiê', 'info'); dossieFocoSair(); return }
  const { w, m } = par
  // `feito` LIVE, não o do retrato: marcar estudado tem que aparecer no mesmo
  // instante, e o retrato guarda a ordem — não o estado.
  const feito = sentidoEstado(m) === 'revisao'
  const ctx = m.context || w.context || ''
  const ctxPt = m.context_pt || (m.context ? '' : w.context_pt) || ''
  const blocos = _dosFocoBlocos(w, m, ctx, ctxPt)

  let box = el('dos-foco')
  if (!box) {
    box = document.createElement('div')
    box.id = 'dos-foco'
    document.body.appendChild(box)
    document.body.classList.add('dos-focando')
  }
  // REPINTURA NÃO PODE JOGAR A PÁGINA PARA O TOPO. Completar material, contar
  // no livro e pedir correção repintam o item inteiro — e numa página longa
  // isso significaria perder o lugar da leitura a cada ação, justo quando ele
  // está no fim dela. A rolagem só volta a zero quando o ITEM muda, que é
  // quando começar de cima é o certo.
  const chaveAtual = w.id + '|' + (m.id || '')
  const mesmo = box.dataset.item === chaveAtual
  const rolagem = mesmo ? (box.querySelector('.dosf-corpo') || {}).scrollTop || 0 : 0
  const escrevendo = mesmo && document.activeElement && document.activeElement.id === 'dosf-escrita'
  const cursor = escrevendo ? document.activeElement.selectionStart : null
  box.dataset.item = chaveAtual
  box.innerHTML = `
    <div class="dosf-topo">
      <button class="btn btn-ghost btn-sm" onclick="dossieFocoSair()">${ic('x','ic-sm')} Sair do foco <span class="dosf-tecla">Esc</span></button>
      <span class="dosf-pos">${_dosFoco.i + 1} de ${_dosFocoLista.length}</span>
      <span class="dosf-obra">${esc(obraNome(w.source_title || m.source_title || ''))}</span>
    </div>
    <div class="dosf-palco">
      <nav class="dosf-indice" aria-label="Seções deste item">${blocos.map(b =>
        `<a href="#dosf-s-${b.id}" onclick="return _dosFocoIr(event,'${b.id}')">${esc(b.rotulo)}</a>`).join('')}</nav>
      <div class="dosf-corpo">
        ${_dosFocoCabecalho(w, m, feito, ctx)}
        ${blocos.map(b => `<section class="dosf-bloco" id="dosf-s-${b.id}">
          <h3 class="dosf-rot">${b.icone ? ic(b.icone,'ic-sm') : ''}${esc(b.rotulo)}</h3>
          ${b.html}</section>`).join('')}
      </div>
    </div>
    <div class="dosf-rodape">
      <button class="btn btn-ghost" onclick="dossieFocoAndar(-1)" ${_dosFoco.i === 0 ? 'disabled' : ''}>
        ${ic('chevronLeft','ic-sm')} <span class="dosf-tecla">←</span></button>
      ${feito
        ? `<button class="btn btn-ghost" onclick="dossieFocoDesfazer()">${ic('undo','ic-sm')} não estudei ainda</button>`
        : `<button class="btn btn-primary" onclick="dossieFocoEstudei()">${ic('check','ic-sm')} Estudei<span class="dosf-longo"> — mandar para a Revisão</span></button>`}
      <button class="btn btn-ghost" onclick="dossieFocoAndar(1)" ${_dosFoco.i >= _dosFocoLista.length - 1 ? 'disabled' : ''}>
        <span class="dosf-tecla">→</span> ${ic('chevronRight','ic-sm')}</button>
    </div>`
  const corpoNovo = box.querySelector('.dosf-corpo')
  if (corpoNovo && rolagem) {
    // 'auto' na mão: com `scroll-behavior: smooth` valendo, devolver a posição
    // viraria uma animação visível de cima para baixo a cada repintura.
    const antes = corpoNovo.style.scrollBehavior
    corpoNovo.style.scrollBehavior = 'auto'
    corpoNovo.scrollTop = rolagem
    corpoNovo.style.scrollBehavior = antes
  }
  if (escrevendo) {
    const campo = el('dosf-escrita')
    if (campo) { campo.focus(); try { campo.setSelectionRange(cursor, cursor) } catch (e) {} }
  }
  _dosFocoObservar(box)
  // SELECIONAR VALE NA PÁGINA INTEIRA, não só nas linhas da família: a dúvida
  // cai em qualquer lugar — uma palavra dentro de um exemplo, um pedaço da
  // definição, duas palavras no meio da passagem do livro. O contexto é lido
  // na hora (função, não valor) porque o painel troca de item embaixo do
  // ouvinte, e o ouvinte é ligado UMA vez por caixa.
  if (typeof selMenuAtivar === 'function') {
    selMenuAtivar(box, no => {
      const s = _dosFoco && _dosFocoLista[_dosFoco.i]
      const p = s && _dossiePar(s.w.id, s.m.id)
      return p ? _dosSelContexto(p.w, p.m, no) : {}
    })
  }
}

// DE ONDE veio o que eu selecionei. A página é toda selecionável, mas ela NÃO É
// FEITA DE UMA COISA SÓ — e tratá-la como se fosse produziu dois defeitos de
// uma vez:
//   • selecionei "cramped" no exemplo #2 e a Lexa abriu com a passagem do livro
//     do outro item, respondendo "cramped não aparece nessa frase";
//   • mandado ao Preparar, "cramped" nasceu como item de Billy Summers, com a
//     passagem do digest-sized por contexto — palavra que ele nunca leu ali.
//     Nas palavras dele: *"ta pegando fontes ancestrais pra novas fontes"*.
//
// A regra é uma linha: A PASSAGEM É O ÚNICO PEDAÇO AUTÊNTICO DA PÁGINA. Ela
// veio mesmo da obra. Todo o resto — exemplos inventados pela IA para ESTE
// item, definição, colocações, família, conjugação — é material do estudo. Quem
// nasce dali tem a procedência do estudo, e o "capítulo" é o item que o gerou.
function _dosSelContexto(w, m, no) {
  const lang = wordLang(w)
  const bloco = no && (no.nodeType === 1 ? no : no.parentElement)
  const perto = sel => (bloco && bloco.closest) ? bloco.closest(sel) : null
  const limpo = t => String(t || '').replace(/\s+/g, ' ').trim()
  // `textContent` cola irmãos sem espaço: a linha da família, que é
  // `<b>booklet</b><span>livrinho</span>`, virava "bookletlivrinho" e ia assim
  // para a IA como se fosse a frase. Os filhos entram separados por espaço.
  const textoDe = e => e ? limpo([...e.childNodes].map(n => n.textContent || '').join(' ')) : ''
  const ex = perto('.dosf-ex')

  // A PASSAGEM: aqui, e só aqui, a fonte do item é a fonte da seleção.
  if (ex && ex.id === 'dosf-passagem') {
    const origem = {
      source_type: m.source_type || w.source_type || 'manual',
      source_title: m.source_title || w.source_title || '',
      source_context: m.source_context || w.source_context || ''
    }
    return {
      frase: m.context || w.context || '',
      lang,
      fonte: [obraNome(origem.source_title), origem.source_context].filter(Boolean).join(' · '),
      origem
    }
  }

  const item = w.word || ''
  const origem = { source_type: 'manual', source_title: OBRA_ESTUDO, source_context: item }
  let frase = ''
  // Num exemplo, a frase é a LINHA EM INGLÊS — mesmo que ele tenha selecionado
  // na tradução embaixo: é o inglês que dá o sentido da palavra ali.
  if (ex) frase = textoDe(ex.querySelector('.dosf-ex-en'))
  // ⚠️ A LINHA DA FAMÍLIA NÃO É FRASE, É GLOSA BILÍNGUE. Ela é
  // `<b>busty</b><span>sinônimo mais comum e direto; bosomy soa mais
  // literário</span>` — expressão em inglês colada à explicação em português.
  // Selecionar ali criava o item com ESSE texto como `context`, e `context` é
  // o que a Lexa recebe como cena da palavra: a análise sairia com português
  // no lugar do exemplo. Achado com o acervo real (2026-08-11): SETE itens
  // nasceram assim — busty, buxom, stash, pageantry, westward, western,
  // exploit —, todos ainda esperando análise.
  //
  // Sai VAZIO de propósito, e o `return` é antes de tudo: só remover o
  // seletor da lista abaixo faria `closest` subir para o `li`/`p` em volta e
  // trazer um bloco ainda maior. Item sem frase é caso previsto e tratado (o
  // "tuck one's tail between one's legs" dele é assim) — frase errada, não.
  if (!frase && perto('.dosf-fam-txt')) {
    return { frase: '', lang, fonte: [OBRA_ESTUDO, w.word || ''].filter(Boolean).join(' · '),
             origem: { source_type: 'manual', source_title: OBRA_ESTUDO, source_context: w.word || '' } }
  }
  if (!frase) {
    // Fora dos exemplos: vale a LINHA em volta, não o bloco. Uma seção inteira
    // não é frase, e mandar um parágrafo como "contexto" recria o defeito de
    // origem por outro caminho — a Lexa procuraria a palavra no lugar errado.
    // `.dosf-coloc` fica: é a colocação sozinha ("make a decision"), fragmento
    // mas no idioma do item — diferente da linha da família, que é bilíngue.
    const linha = perto('.dosf-coloc, .dosf-forma, .dosf-conj, .dosf-sig, .dosf-def, .dosf-texto, .dosf-nota, .dosf-padrao, li, p')
    const t = textoDe(linha)
    if (t && t.length <= 300) frase = t
  }
  return { frase, lang, fonte: [OBRA_ESTUDO, item].filter(Boolean).join(' · '), origem }
}

// UM listener só, ligado uma vez. Ligar/desligar a cada abertura do foco é
// como se cria ouvinte órfão — o guarda é o próprio `_dosFoco`.
if (!window._dosFocoTeclas) {
  window._dosFocoTeclas = true
  document.addEventListener('keydown', e => {
    if (!_dosFoco) return
    // Esc ANTES da guarda de digitação: é o "me tira daqui" universal e não
    // significa outra coisa dentro de um campo de texto. O rascunho não se
    // perde — ele vive em `_dosProduzir`, que sobrevive a sair e voltar.
    if (e.key === 'Escape') { e.preventDefault(); dossieFocoSair(); return }
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return
    if (e.key === 'ArrowRight') { e.preventDefault(); dossieFocoAndar(1); return }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); dossieFocoAndar(-1); return }
    // Enter/espaço = marcar estudado e seguir: a mão fica na mesma tecla do
    // "próximo" e o fluxo de percorrer o capítulo não se quebra.
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      const s = _dosFocoLista[_dosFoco.i]
      // Estado LIVE, pelo mesmo motivo da pintura: o retrato guarda ordem, e
      // ler `s.feito` daqui mandaria para a revisão um item já mandado.
      const vivo = s && _dossiePar(s.w.id, s.m.id)
      if (vivo && sentidoEstado(vivo.m) !== 'revisao') dossieFocoEstudei(); else dossieFocoAndar(1)
    }
  })
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
