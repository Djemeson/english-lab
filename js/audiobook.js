// ================================================================
// AUDIOBOOK — a estante e o reprodutor de audiolivros
// ================================================================
// Por que seção própria (pedido dele): audiolivro não é podcast nem vídeo. O
// que ele precisa não é legenda nem corte de cena — é CAPÍTULO, VELOCIDADE e,
// acima de tudo, VOLTAR EXATAMENTE ONDE PAROU num arquivo de doze horas.
// Enfiar isso no player de vídeo daria uma tela cheia de controles que não
// servem e sem os três que servem.
//
// ⚠️ O ARQUIVO NUNCA SAI DAQUI. Um audiolivro tem de 100 MB a 1 GB — o
// Firestore tem teto de 1 MB por documento e o Storage cobraria caro por isso.
// O áudio mora no IndexedDB (`BookDB`, chave `ab:<id>:<n>`); o que viaja é o
// que é leve e dói perder: título, autor, capa reduzida, lista de capítulos,
// ONDE VOCÊ PAROU, marcadores e o tempo ouvido.
//
// DUAS FORMAS DE UM AUDIOLIVRO CHEGAR, e as duas viram a mesma coisa:
//   .m4b        — um arquivo só, com os capítulos DENTRO dele (lidos aqui,
//                 sem biblioteca externa: o parser está neste arquivo)
//   vários .mp3 — cada arquivo é um capítulo, na ordem natural do nome
// Depois disso o resto do código não sabe qual dos dois é: todo capítulo é
// `{titulo, arq, ini, fim}` — `arq` é o índice do arquivo e `ini/fim` são
// segundos DENTRO daquele arquivo.
//
// LAZY: carrega só ao abrir a seção. Nada aqui pode ser chamado por arquivo
// não-lazy (armadilha nº 1). O estado (`audiolivros`) mora no core por isso.
// ================================================================
'use strict'

let _abLivro = null        // audiolivro aberto
let _abCap = 0             // capítulo atual
let _abUrl = ''            // objectURL do arquivo tocando
let _abArqAtual = -1       // qual arquivo está carregado
let _abSalvarTimer = null
let _abInicioSessao = 0    // para contar minutos ouvidos
let _abSono = null         // { fim, tipo, timer }
let _abArrastando = false
// ⚠️ A INTENÇÃO DE OUVIR, e não o estado do elemento. Medido: quando a faixa
// termina, `au.paused` já é `true` antes de qualquer código nosso rodar — e
// era desse estado instantâneo que eu tirava o "estava tocando?" na hora de
// virar o capítulo. Resultado: o livro virava certo e emudecia no fim de cada
// faixa. Aqui fica registrado o que a PESSOA quer; só o pause dela desliga.
let _abQuerTocar = false

const AB_VELOCIDADES = [0.8, 1, 1.15, 1.3, 1.5, 1.75, 2]
const AB_PULO_VOLTAR = 15
const AB_PULO_AVANCAR = 30

function _abAudio() { return document.getElementById('ab-audio') }

// ⚠️ PREFERÊNCIA DE TELA PELO CORE, NUNCA PELA ESTANTE. Eu havia usado o
// `estPref` daqui — e ele mora em `js/estante.js`, que é o pacote lazy da seção
// LER. Quem abre o Audiobook direto (o caminho normal de quem vai ouvir) nunca
// carregou aquele arquivo, e a aba Texto morria com `estPref is not defined`.
// É a armadilha nº 1 do projeto na sua forma mais fácil de cometer: um módulo
// lazy chamando outro. `loadUiPrefs`/`saveUiPref` são do core e existem sempre.
function _abPref(k, def) { const v = loadUiPrefs()['ab_' + k]; return v === undefined ? def : v }
function _abSetPref(k, v) { saveUiPref('ab_' + k, v) }

// ================================================================
// RAIZ
// ================================================================
function renderAudiobookSection() {
  const area = el('ab-area'); if (!area) return
  const acoes = el('ab-ph-actions')
  if (acoes) {
    acoes.innerHTML = _abLivro
      ? `<button class="btn btn-ghost btn-sm" onclick="abFechar()">${ic('chevronLeft','ic-sm')} Estante</button>`
      : (audiolivros.length
          ? `<button class="btn btn-ghost btn-sm" onclick="abCatalogoModal()" data-tip="Entra na estante só com capa e ficha; o áudio você anexa quando tiver">${ic('search','ic-sm')} Quero ouvir</button>
             <button class="btn btn-primary btn-sm" onclick="abEscolherArquivo()">${ic('upload','ic-sm')} Adicionar audiolivro</button>`
          : '')
  }
  if (_abLivro) _abRenderPlayer()
  else _abRenderEstante()
  // Sobrou envio de uma sessão anterior? Reaparece PAUSADO, com o botão de
  // continuar — retomar 700 MB sozinho, talvez no 4G, não é decisão do app.
  abFilaRetomarPendencias()
}

// ================================================================
// ESTANTE
// ================================================================
function _abRenderEstante() {
  const area = el('ab-area')
  if (!audiolivros.length) {
    area.innerHTML = `
      <div class="upload-area ab-drop"
           ondragover="event.preventDefault();this.classList.add('drag')"
           ondragleave="this.classList.remove('drag')"
           ondrop="this.classList.remove('drag');abImportar(event.dataTransfer.files)"
           onclick="abEscolherArquivo()">
        <div class="upload-icon">${ic('volume','ic-xl')}</div>
        <p><strong>Clique</strong> ou arraste um audiolivro aqui</p>
        <p>.m4b (com capítulos dentro) · vários .mp3 ou .m4a de uma vez — cada arquivo vira um capítulo</p>
      </div>
      <div class="est-vazio-acoes">
        <button class="btn btn-ghost btn-sm" onclick="abCatalogoModal()">${ic('search','ic-sm')} Marcar um que quero ouvir</button>
      </div>
      <div class="ler-vazio-dica">
        <b>O arquivo entra neste aparelho primeiro.</b> Um audiolivro tem centenas de megabytes,
        então ele não sobe sozinho — mas dá para <b>guardar na nuvem</b> pelo ícone de nuvem no
        card, e aí o livro toca também no celular. A lista de capítulos, onde você parou e seus
        marcadores viajam de qualquer jeito.
      </div>`
    return
  }
  const cards = audiolivros.slice()
    .sort((a, b) => (b.lastOpen || b.addedAt || 0) - (a.lastOpen || a.addedAt || 0))
    .map(a => {
      const pct = Math.round(abPct(a) * 100)
      const falta = abDuracao(a) - abSegAbsoluto(a)
      const semAudio = !a.arquivos
      return `
      <div class="ler-card ab-card${semAudio ? ' ab-sem-audio' : ''}"
           onclick="${semAudio ? `abAnexarArquivo('${a.id}')` : `abAbrir('${a.id}')`}"
           data-tip="${escA(semAudio ? 'Sem áudio ainda — clique para anexar' : (a.author || ''))}">
        <div class="ler-capa ab-capa">
          ${a.cover ? `<img class="ler-capa-img" src="${escA(a.cover)}" alt="">`
                    : `<div class="ler-capa-fake"><span>${esc((a.title || '?').slice(0, 28))}</span></div>`}
          <span class="ab-capa-play">${ic(semAudio ? 'upload' : 'play','ic-lg')}</span>
          ${semAudio ? `<span class="ab-selo-sem">quero ouvir</span>` : ''}
          ${pct > 0 ? `<span class="ler-capa-pct">${pct}%</span>` : ''}
        </div>
        <div class="ler-card-nome">${esc(a.title || 'Sem título')}</div>
        <div class="ler-card-autor">${esc(a.author || '')}</div>
        <div class="ab-card-tempo">${semAudio ? 'anexar o áudio' : (pct > 0 && falta > 0 ? `faltam ${abTempoLongo(falta)}` : abTempoLongo(abDuracao(a)))}</div>
        <div class="ler-card-barra"><i style="width:${pct}%;background:var(--role-energia)"></i></div>
        <button class="ler-card-x" data-tip="Remover"
                onclick="event.stopPropagation();abExcluir('${a.id}')">${ic('trash','ic-sm')}</button>
        ${semAudio ? '' : `<button class="ab-card-nuvem${abNuvemCompleto(a) ? ' on' : ''}"
                data-tip="${escA(abNuvemCompleto(a)
                  ? 'O áudio está na sua nuvem — toca em qualquer aparelho seu'
                  : 'O áudio só existe neste aparelho. Clique para guardar na nuvem')}"
                onclick="event.stopPropagation();abNuvemPainel('${a.id}')">${ic('cloud','ic-sm')}</button>`}
      </div>`
    }).join('')
  area.innerHTML = `<div class="ler-estante ab-estante">${cards}</div>`
}

// ================================================================
// IMPORTAÇÃO
// ================================================================
function abEscolherArquivo() {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = '.m4b,.m4a,.mp3,.aac,.ogg,.opus,.wav,audio/*'
  inp.multiple = true
  inp.onchange = () => abImportar(inp.files)
  inp.click()
}

async function abImportar(files) {
  const lista = [...(files || [])].filter(f => /\.(m4b|m4a|mp3|aac|ogg|opus|wav)$/i.test(f.name) || /^audio\//.test(f.type))
  if (!lista.length) { toast('Não reconheci nenhum arquivo de áudio aí.', 'warning'); return }

  // ⚠️ ORDEM NATURAL, NÃO ALFABÉTICA. "Capítulo 10" vem depois de "Capítulo 9",
  // e a ordenação de texto comum põe o 10 antes do 2. Num audiolivro de 40
  // faixas isso embaralharia o livro inteiro em silêncio.
  lista.sort((a, b) => a.name.localeCompare(b.name, 'pt', { numeric: true, sensitivity: 'base' }))

  const ehM4b = lista.length === 1 && /\.(m4b|m4a)$/i.test(lista[0].name)
  toast(ehM4b ? `Lendo "${lista[0].name}"…` : `Lendo ${lista.length} faixas…`, 'info')
  try {
    if (ehM4b) await _abImportarM4b(lista[0])
    else await _abImportarFaixas(lista)
  } catch (e) {
    console.warn('[audiobook] importação falhou:', e)
    toast('Não consegui importar: ' + e.message, 'error')
    return
  }
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  renderAudiobookSection()
  const novo = audiolivros[audiolivros.length - 1]
  if (novo) _abAutoMeta(novo)
}

// O CATÁLOGO COMPLETA O AUDIOLIVRO TAMBÉM (2026-08-20). Faixas soltas de mp3
// não trazem capa nem autor — e é a capa que faz a estante ser reconhecida de
// longe. Mesmas regras da estante de livros: só preenche o que está vazio e
// nunca mexe no título.
//
// ⚠️ A BUSCA MORA EM `estante.js`, QUE É DE OUTRA SEÇÃO. Duplicar aqui daria
// duas versões da mesma regra para manter (e uma delas envelheceria). Carrego
// o módulo sob demanda — ele é independente, e o custo é um arquivo, uma vez.
async function _abAutoMeta(a) {
  if (typeof cfg !== 'undefined' && cfg.autoMeta === false) return
  if (!a || (a.cover && a.author)) return
  try {
    if (typeof estMetaBuscar !== 'function' && typeof _loadScript === 'function') {
      await _loadScript('js/estante.js')
    }
    if (typeof estMetaBuscar !== 'function') return
    const res = await estMetaBuscar({ title: a.title, author: a.author, serie: '', serieNum: '' })
    const bom = (res || []).find(r => !r.incomparavel && r.semelhanca >= 0.6)
    if (!bom) return
    let mudou = false
    if (!a.author && bom.author) { a.author = bom.author; mudou = true }
    if (!a.cover && bom.capa) {
      // A capa vem como URL de outro domínio; guardamos a URL (o mesmo que a
      // estante de livros faz) porque o canvas não consegue converter imagem
      // de terceiro em miniatura sem esbarrar em CORS.
      a.cover = bom.capa; mudou = true
    }
    if (mudou) {
      a.updatedAt = Date.now()
      saveAudiolivros()
      if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
      if (!_abLivro) renderAudiobookSection()
      toast('Capa e autor vieram do catálogo', 'info')
    }
  } catch (e) { console.warn('[audiobook] auto-metadados:', e && e.message) }
}

async function _abImportarM4b(file) {
  const buf = await file.arrayBuffer()
  const meta = abLerM4b(buf)
  const id = uid()
  await BookDB.set(abChaveArquivo(id, 0), new Blob([buf], { type: file.type || 'audio/mp4' }))

  // Sem capítulos dentro do arquivo, o livro inteiro é um capítulo só. Melhor
  // isso do que recusar o arquivo: dá para ouvir e a posição continua sendo
  // guardada — que é o que mais importa.
  let duracao = meta.duracao
  if (!duracao) duracao = await _abDuracaoDoBlob(await BookDB.get(abChaveArquivo(id, 0)))
  const caps = meta.capitulos.length
    ? meta.capitulos.map(c => ({ titulo: c.titulo, arq: 0, ini: c.ini, fim: c.fim || duracao }))
    : _abPartesPorTempo(duracao, 0)

  const nome = _abNomeLimpo(file.name)
  audiolivros.push(_abNovo({
    id, title: meta.titulo || nome.titulo, author: meta.autor || nome.autor,
    cover: meta.capa ? await _abMiniatura(meta.capa) : '',
    capitulos: caps, arquivos: 1, duracao, formato: 'm4b',
    tamanho: file.size
  }))
  toast(`"${meta.titulo || nome.titulo}" entrou na estante — ${caps.length} ${caps.length === 1 ? 'capítulo' : 'capítulos'}`, 'success')
}

async function _abImportarFaixas(lista) {
  const id = uid()
  const caps = []
  const prefixo = _abPrefixoComum(lista.map(f => f.name))
  let total = 0, bytes = 0
  for (let i = 0; i < lista.length; i++) {
    const f = lista[i]
    const blob = new Blob([await f.arrayBuffer()], { type: f.type || 'audio/mpeg' })
    await BookDB.set(abChaveArquivo(id, i), blob)
    const dur = await _abDuracaoDoBlob(blob)
    // Uma faixa so, longa demais para ser um capitulo: vira partes por tempo.
    if (lista.length === 1 && dur > AB_PARTE_MIN * 60 * 1.5) caps.push(..._abPartesPorTempo(dur, i))
    else caps.push({ titulo: _abNomeDeFaixa(f.name, i, prefixo), arq: i, ini: 0, fim: dur })
    total += dur; bytes += f.size
  }
  // ⚠️ O NOME DO LIVRO É O PREFIXO COMUM DAS FAIXAS, não o nome do primeiro
  // arquivo. Visto no teste: com "Autor - Capitulo 01.mp3", o livro entrou na
  // estante chamado "Capitulo 01". O que as faixas têm em comum é justamente
  // a obra; o que as diferencia é o capítulo.
  const nome = prefixo ? _abNomeLimpo(prefixo + '.x') : _abNomeLimpo(lista[0].name)
  audiolivros.push(_abNovo({
    id, title: nome.titulo || nome.autor || 'Sem título', author: nome.titulo ? nome.autor : '',
    cover: '', capitulos: caps, arquivos: lista.length, duracao: total,
    formato: 'faixas', tamanho: bytes
  }))
  toast(`"${nome.titulo || nome.autor}" entrou na estante — ${caps.length} faixas`, 'success')
}

// O pedaço com que TODOS os nomes começam, aparado de separadores e do número
// que sobrou grudado ("Meu Livro - Cap 0" vira "Meu Livro").
function _abPrefixoComum(nomes) {
  if (!nomes || nomes.length < 2) return ''
  const base = nomes.map(n => String(n).replace(/\.[^.]+$/, '').replace(/_+/g, ' '))
  let i = 0
  while (i < base[0].length && base.every(n => n[i] === base[0][i])) i++
  let pre = base[0].slice(0, i)
  pre = pre.replace(/[\s\-–—_.:,]*\d*$/, '').replace(/\s*(cap[íi]tulo|cap|faixa|track|parte|part|disc)\s*$/i, '')
  pre = pre.replace(/[\s\-–—_.:,]+$/, '').trim()
  return pre.length >= 3 ? pre : ''
}

// ARQUIVO SEM CAPITULO NAO PODE VIRAR UM BLOCO DE DOZE HORAS. Ele levantou
// isso: "quando um arquivo vier sem capitulos, tem que capitular de alguma
// forma?" — e tem, porque um capitulo unico e gigante quebra tres coisas de
// uma vez: nao ha para onde pular, a barra de progresso do capitulo e inutil, e
// a transcricao "por capitulo" viraria "o livro inteiro", que e exatamente o
// que ele nao quer pagar.
//
// A saida honesta e dizer o que e: PARTES por tempo, nao capitulos inventados.
// O app nao sabe onde o autor cortou; sabe cortar de quinze em quinze minutos,
// e isso ja da navegacao, progresso legivel e transcricao em pedacos pagaveis.
const AB_PARTE_MIN = 15
function _abPartesPorTempo(duracao, arq = 0) {
  const passo = AB_PARTE_MIN * 60
  if (!duracao || duracao <= passo * 1.5) {
    return [{ titulo: 'Livro completo', arq, ini: 0, fim: duracao || 0 }]
  }
  const partes = []
  for (let ini = 0, n = 1; ini < duracao; ini += passo, n++) {
    const fim = Math.min(duracao, ini + passo)
    partes.push({ titulo: `Parte ${n} · ${abTempo(ini)}–${abTempo(fim)}`, arq, ini, fim })
  }
  return partes
}

function _abNovo(campos) {
  return {
    pos: { cap: 0, seg: 0 }, velocidade: 1, marcadores: [], minutos: 0,
    status: 'quero', addedAt: Date.now(), updatedAt: Date.now(), lastOpen: 0,
    ...campos
  }
}

// "Stephen King - Billy Summers.m4b" → autor e título separados.
function _abNomeLimpo(arquivo) {
  const base = String(arquivo || '').replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim()
  const m = base.match(/^(.{2,40}?)\s+-\s+(.{2,})$/)
  if (m) return { autor: m[1].trim(), titulo: m[2].trim() }
  return { autor: '', titulo: base || 'Sem título' }
}
// Tirado o prefixo da obra, o que sobra é o capítulo — é isso que a lista
// mostra. Sem isso, quarenta linhas repetiriam o nome do livro antes do número.
function _abNomeDeFaixa(arquivo, i, prefixo) {
  let base = String(arquivo || '').replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim()
  if (prefixo && base.toLowerCase().startsWith(prefixo.toLowerCase())) {
    base = base.slice(prefixo.length).replace(/^[\s\-–—_.:,]+/, '').trim()
  }
  return base || `Faixa ${i + 1}`
}

// A duração real vem do decodificador do navegador — é o único que sabe ler
// VBR sem erro. Custa um elemento de áudio por faixa, e só na importação.
function _abDuracaoDoBlob(blob) {
  return new Promise(resolve => {
    if (!blob) return resolve(0)
    const url = URL.createObjectURL(blob)
    const a = new Audio()
    let pronto = false
    const fim = d => {
      if (pronto) return
      pronto = true
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(d) && d > 0 ? d : 0)
    }
    a.preload = 'metadata'
    a.onloadedmetadata = () => fim(a.duration)
    a.onerror = () => fim(0)
    setTimeout(() => fim(a.duration), 8000)   // arquivo estranho nao trava a fila
    a.src = url
    // `load()` explicito: sem ele, o Chrome ADIA o carregamento de midia em aba
    // que nao esta em primeiro plano. Medido no Chrome real com a aba em
    // segundo plano: `readyState` ficou em 0, nem `loadedmetadata` nem `error`
    // dispararam, e o livro inteiro entrou com duracao zero.
    try { a.load() } catch (e) {}
  })
}

// ⚠️ A DURACAO PODE CHEGAR DEPOIS. Se a importacao aconteceu com a aba em
// segundo plano, o capitulo entra com `fim: 0` — e a barra, o "faltam" e a
// escolha entre capitulo/trecho na transcricao passam a mentir. Entao, na
// primeira vez que o capitulo realmente TOCA, a medida verdadeira e gravada.
// Conserta o acervo que ja entrou torto, sem pedir nada ao usuario.
function _abCorrigirDuracao(a, i, duracaoReal) {
  if (!a || !Number.isFinite(duracaoReal) || duracaoReal <= 0) return false
  const cap = a.capitulos[i]; if (!cap) return false
  const umArquivoPorCapitulo = a.capitulos.every(c => c.arq !== cap.arq || c === cap)
  if (!umArquivoPorCapitulo) return false          // m4b: o arquivo tem varios capitulos
  if (Math.abs(abDurCap(cap) - duracaoReal) < 1) return false
  cap.ini = 0
  cap.fim = duracaoReal
  a.duracao = a.capitulos.reduce((s, c) => s + abDurCap(c), 0)
  a.updatedAt = Date.now()
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  return true
}

// Capa reduzida a 240px e virada JPEG: precisa caber no localStorage E no
// documento do Firestore junto com o resto. Capa de m4b vem em 1200px.
function _abMiniatura(blob) {
  return new Promise(resolve => {
    try {
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const esc = Math.min(1, 240 / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        URL.revokeObjectURL(url)
        try { resolve(c.toDataURL('image/jpeg', 0.72)) } catch { resolve('') }
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve('') }
      img.src = url
    } catch { resolve('') }
  })
}

// ================================================================
// QUERO OUVIR — entra pelo catálogo, o áudio vem depois
// ================================================================
// Pedido dele: marcar o que quer ouvir buscando "em alguma livraria", e depois
// *"subir o áudio dentro do que já está carregado"*. O item nasce só com os
// metadados (capa, autor, ano) e fica na estante com o selo "quero ouvir"; no
// dia em que o arquivo chegar, ele ENTRA nesse item — não cria outro.
let _abCatRes = []
async function abCatalogoModal() {
  document.getElementById('ab-cat')?.remove()
  const ov = document.createElement('div')
  ov.id = 'ab-cat'; ov.className = 'srs-modal-overlay'
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove() })
  ov.innerHTML = `<div class="srs-modal-box" style="width:100%;max-width:620px">
    <h4 style="font-size:var(--fs-base);font-weight:700;margin-bottom:4px">Quero ouvir</h4>
    <p style="font-size:var(--fs-sm);color:var(--text2);margin-bottom:14px">
      Busque o livro pelo nome. Ele entra na estante com capa e ficha; o áudio você anexa
      quando tiver o arquivo.</p>
    <div class="est-gb-busca" style="margin-bottom:12px">
      ${ic('search','ic-sm')}
      <input type="text" id="ab-cat-q" placeholder="ex.: Project Hail Mary" onkeydown="if(event.key==='Enter')abCatalogoBuscar()">
      <button class="btn btn-ghost btn-sm" onclick="abCatalogoBuscar()">Buscar</button>
    </div>
    <div id="ab-cat-res"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ab-cat').remove()">Fechar</button>
    </div>
  </div>`
  document.body.appendChild(ov)
  setTimeout(() => document.getElementById('ab-cat-q')?.focus(), 30)
}

async function abCatalogoBuscar() {
  const q = (document.getElementById('ab-cat-q').value || '').trim()
  if (!q) return
  const box = document.getElementById('ab-cat-res')
  if (box) box.innerHTML = `<p class="est-dica">Buscando…</p>`
  // A busca mora em `estante.js` (outra seção): carrego sob demanda em vez de
  // manter duas cópias da mesma regra.
  if (typeof estMetaBuscar !== 'function' && typeof _loadScript === 'function') {
    try { await _loadScript('js/estante.js') } catch (e) {}
  }
  if (typeof estMetaBuscar !== 'function') {
    if (box) box.innerHTML = `<p class="est-dica est-erro">Não consegui carregar a busca. Tente de novo.</p>`
    return
  }
  _abCatRes = await estMetaBuscar({ title: q, author: '', serie: '', serieNum: '' })
  if (!box) return
  box.innerHTML = _abCatRes.length
    ? `<div class="est-gb-res">${_abCatRes.map((r, i) => `
        <button class="est-gb-item" onclick="abCatalogoUsar(${i})">
          ${r.capa ? `<img src="${escA(r.capa)}" alt="" loading="lazy">` : `<span class="est-gb-sem">${ic('volume','ic-sm')}</span>`}
          <span class="est-gb-txt"><b>${esc(r.title)}</b>
            <i>${esc(r.author || 'autor desconhecido')}${r.ano ? ` · ${r.ano}` : ''} · ${r.fonte}</i></span>
        </button>`).join('')}</div>`
    : `<p class="est-dica est-erro">Não achei nada com isso. Tente o título com o autor.</p>`
}

function abCatalogoUsar(i) {
  const r = _abCatRes[i]; if (!r) return
  if (audiolivros.some(a => String(a.title).toLowerCase() === String(r.title).toLowerCase())) {
    toast('Esse já está na sua estante.', 'info'); return
  }
  audiolivros.push(_abNovo({
    id: uid(), title: r.title, author: r.author || '', cover: r.capa || '',
    ano: r.ano || '', editora: r.editora || '', resumo: r.resumo || '',
    // ⚠️ SEM ARQUIVO: `arquivos: 0` é o que a estante lê para mostrar o selo
    // "quero ouvir" e mandar o clique para o anexo em vez do reprodutor.
    capitulos: [], arquivos: 0, duracao: 0, formato: '', tamanho: 0
  }))
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  document.getElementById('ab-cat')?.remove()
  toast(`"${r.title}" está na estante — anexe o áudio quando tiver`, 'success')
  renderAudiobookSection()
}

// ---- anexar o áudio a um item que já existe ----
function abAnexarArquivo(id) {
  const a = audiolivroPorId(id); if (!a) return
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = '.m4b,.m4a,.mp3,.aac,.ogg,.opus,.wav,audio/*'
  inp.multiple = true
  inp.onchange = () => _abAnexar(id, inp.files)
  inp.click()
}

async function _abAnexar(id, files) {
  const a = audiolivroPorId(id); if (!a) return
  const lista = [...(files || [])].filter(f => /\.(m4b|m4a|mp3|aac|ogg|opus|wav)$/i.test(f.name) || /^audio\//.test(f.type))
  if (!lista.length) { toast('Não reconheci nenhum arquivo de áudio aí.', 'warning'); return }
  lista.sort((x, y) => x.name.localeCompare(y.name, 'pt', { numeric: true, sensitivity: 'base' }))
  toast(lista.length === 1 ? `Lendo "${lista[0].name}"…` : `Lendo ${lista.length} faixas…`, 'info')
  try {
    const ehM4b = lista.length === 1 && /\.(m4b|m4a)$/i.test(lista[0].name)
    if (ehM4b) {
      const buf = await lista[0].arrayBuffer()
      const meta = abLerM4b(buf)
      await BookDB.set(abChaveArquivo(id, 0), new Blob([buf], { type: lista[0].type || 'audio/mp4' }))
      let dur = meta.duracao || await _abDuracaoDoBlob(await BookDB.get(abChaveArquivo(id, 0)))
      a.capitulos = meta.capitulos.length
        ? meta.capitulos.map(c => ({ titulo: c.titulo, arq: 0, ini: c.ini, fim: c.fim || dur }))
        : _abPartesPorTempo(dur, 0)
      a.duracao = dur; a.arquivos = 1; a.formato = 'm4b'; a.tamanho = lista[0].size
      // O que veio do catálogo MANDA sobre o que vem do arquivo: foi ele quem
      // escolheu aquela ficha. O arquivo só preenche o que está vazio.
      if (!a.author && meta.autor) a.author = meta.autor
      if (!a.cover && meta.capa) a.cover = await _abMiniatura(meta.capa)
    } else {
      const prefixo = _abPrefixoComum(lista.map(f => f.name))
      const caps = []
      let total = 0, bytes = 0
      for (let i = 0; i < lista.length; i++) {
        const blob = new Blob([await lista[i].arrayBuffer()], { type: lista[i].type || 'audio/mpeg' })
        await BookDB.set(abChaveArquivo(id, i), blob)
        const d = await _abDuracaoDoBlob(blob)
        if (lista.length === 1 && d > AB_PARTE_MIN * 60 * 1.5) caps.push(..._abPartesPorTempo(d, i))
        else caps.push({ titulo: _abNomeDeFaixa(lista[i].name, i, prefixo), arq: i, ini: 0, fim: d })
        total += d; bytes += lista[i].size
      }
      a.capitulos = caps; a.duracao = total; a.arquivos = lista.length
      a.formato = 'faixas'; a.tamanho = bytes
    }
    a.pos = { cap: 0, seg: 0 }
    a.updatedAt = Date.now()
    saveAudiolivros()
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
    toast(`Áudio anexado — ${a.capitulos.length} ${a.capitulos.length === 1 ? 'capítulo' : 'capítulos'}`, 'success')
    renderAudiobookSection()
  } catch (e) {
    console.warn('[audiobook] anexo falhou:', e)
    toast('Não consegui ler esse áudio: ' + e.message, 'error')
  }
}

// ================================================================
// O PARSER DE M4B — capítulos, duração, título e capa
// ================================================================
// Sem biblioteca: um `.m4b` é um MP4, e MP4 é uma árvore de "átomos"
// `[tamanho:4][tipo:4][conteúdo]`. Precisamos de três galhos dessa árvore, e
// nada mais — por isso vale mais 120 linhas aqui do que 300 KB de dependência.
//
// ⚠️ O QUE ESTE PARSER NÃO LÊ: o formato de capítulo em TRILHA DE TEXTO
// (QuickTime `tref/chap`), usado por parte dos conversores. Nesse caso o livro
// entra como capítulo único — ouve-se igual, e a posição continua guardada.
function abLerM4b(buf) {
  const saida = { titulo: '', autor: '', duracao: 0, capitulos: [], capa: null }
  try {
    const dv = new DataView(buf)
    const raiz = { ini: 0, fim: buf.byteLength }
    const moov = _abAtomo(dv, raiz, 'moov')
    if (!moov) return saida

    const mvhd = _abAtomo(dv, moov, 'mvhd')
    if (mvhd) {
      const ver = dv.getUint8(mvhd.ini)
      const escala = ver === 1 ? dv.getUint32(mvhd.ini + 20) : dv.getUint32(mvhd.ini + 12)
      const dur = ver === 1
        ? Number(dv.getBigUint64(mvhd.ini + 24))
        : dv.getUint32(mvhd.ini + 16)
      if (escala > 0 && dur > 0) saida.duracao = dur / escala
    }

    const udta = _abAtomo(dv, moov, 'udta')
    if (udta) {
      const chpl = _abAtomo(dv, udta, 'chpl')
      if (chpl) saida.capitulos = _abLerChpl(dv, chpl, saida.duracao)
      // ilst fica dentro de `meta`, que tem 4 bytes de version/flags ANTES dos
      // filhos — descer sem pular isso acha lixo em vez de átomo.
      const meta = _abAtomo(dv, udta, 'meta')
      if (meta) {
        const ilst = _abAtomo(dv, { ini: meta.ini + 4, fim: meta.fim }, 'ilst')
        if (ilst) {
          saida.titulo = _abTextoIlst(dv, ilst, '©nam')
          saida.autor = _abTextoIlst(dv, ilst, '©ART') || _abTextoIlst(dv, ilst, 'aART')
          saida.capa = _abCapaIlst(dv, buf, ilst)
        }
      }
    }
  } catch (e) {
    console.warn('[audiobook] m4b parcialmente ilegível:', e && e.message)
  }
  return saida
}

function _abFilhos(dv, caixa) {
  const out = []
  let p = caixa.ini
  while (p + 8 <= caixa.fim) {
    let tam = dv.getUint32(p)
    let cab = 8
    if (tam === 1) {                                   // tamanho de 64 bits
      tam = Number(dv.getBigUint64(p + 8)); cab = 16
    } else if (tam === 0) tam = caixa.fim - p          // "vai até o fim"
    if (tam < cab || p + tam > caixa.fim + 8) break
    let tipo = ''
    for (let i = 4; i < 8; i++) tipo += String.fromCharCode(dv.getUint8(p + i))
    out.push({ tipo, ini: p + cab, fim: p + tam })
    p += tam
  }
  return out
}
function _abAtomo(dv, caixa, tipo) {
  return _abFilhos(dv, caixa).find(a => a.tipo === tipo) || null
}

// chpl (capítulos "Nero"): [ver:1][flags:3] (+4 reservados quando ver=1)
// [quantidade:1] e então, por capítulo: [instante:8 em unidades de 100ns]
// [tamanho do título:1][título UTF-8].
// ⚠️ A posição da contagem varia entre gravadores, então tentamos as duas e
// ficamos com a que produzir capítulos plausíveis (instantes crescentes,
// dentro da duração do livro). Adivinhar com verificação é mais honesto que
// confiar num offset fixo.
function _abLerChpl(dv, chpl, duracao) {
  for (const desloc of [9, 5]) {
    try {
      const caps = _abChplComOffset(dv, chpl, desloc, duracao)
      if (caps.length) return caps
    } catch (e) {}
  }
  return []
}
function _abChplComOffset(dv, chpl, desloc, duracao) {
  let p = chpl.ini + desloc
  const n = dv.getUint8(chpl.ini + desloc - 1)
  if (!n || n > 2000) return []
  const caps = []
  const dec = new TextDecoder('utf-8')
  for (let i = 0; i < n; i++) {
    if (p + 9 > chpl.fim) return []
    const inst = Number(dv.getBigUint64(p)) / 1e7      // 100ns → segundos
    const tam = dv.getUint8(p + 8)
    p += 9
    if (p + tam > chpl.fim) return []
    const titulo = dec.decode(new Uint8Array(dv.buffer, p, tam)).trim()
    p += tam
    if (!Number.isFinite(inst) || inst < 0) return []
    if (duracao && inst > duracao * 1.05) return []
    if (caps.length && inst < caps[caps.length - 1].ini - 0.5) return []   // tem de crescer
    caps.push({ titulo: titulo || `Capítulo ${i + 1}`, ini: inst, fim: 0 })
  }
  for (let i = 0; i < caps.length; i++) {
    caps[i].fim = i + 1 < caps.length ? caps[i + 1].ini : (duracao || 0)
  }
  // Um "capítulo" só que começa em zero não é informação nenhuma.
  return caps.length > 1 ? caps : []
}

function _abTextoIlst(dv, ilst, chave) {
  const box = _abAtomo(dv, ilst, chave); if (!box) return ''
  const data = _abAtomo(dv, box, 'data'); if (!data) return ''
  try {
    return new TextDecoder('utf-8')
      .decode(new Uint8Array(dv.buffer, data.ini + 8, Math.max(0, data.fim - data.ini - 8))).trim()
  } catch { return '' }
}
function _abCapaIlst(dv, buf, ilst) {
  const covr = _abAtomo(dv, ilst, 'covr'); if (!covr) return null
  const data = _abAtomo(dv, covr, 'data'); if (!data) return null
  const tipo = dv.getUint32(data.ini) & 0xffffff       // 13 = jpeg, 14 = png
  const bytes = buf.slice(data.ini + 8, data.fim)
  if (!bytes.byteLength) return null
  return new Blob([bytes], { type: tipo === 14 ? 'image/png' : 'image/jpeg' })
}

// ================================================================
// AGRUPAR AS PARTES EM CAPÍTULOS — pelo que o narrador diz
// ================================================================
// Ele descreveu a estrutura ouvindo: *"ele tem o capítulo 1 e as partes 1, 2,
// 3… aí entra o capítulo 2 e acontece a mesma coisa. Essa quantidade de partes
// são exatamente essas partes de cada capítulo."* Estava certo, e os dados
// confirmaram: as 200 "partes" do Billy Summers são as **seções numeradas** do
// livro, e o `.m4b` só guarda `001`…`200` — nem o `chpl` nem a trilha de texto
// têm nome nenhum. Verificado no arquivo dele, nos dois formatos.
//
// ⚠️ E A ESTRUTURA NÃO PODE VIR DO LIVRO. Foi a primeira ideia — cruzar com o
// EPUB, cuja contagem fechou (197 seções contra 200 partes) — e ele cortou
// pelo motivo certo: *"nem sempre vou ter o livro."* Um audiolivro precisa se
// organizar sozinho.
//
// A CHAVE ESTÁ NA NARRAÇÃO, e é mais simples do que parece: **o número da
// seção reinicia em 1 a cada capítulo**. Então basta ouvir o começo de cada
// parte e anotar o número que o narrador diz; onde ele volta para 1, começou
// um capítulo. Medido nas transcrições que ele já tinha: parte 003 diz "2.",
// 004 diz "3.", 005 diz "Four." — exatamente as seções 2, 3 e 4 do Chapter 1.
//
// ⚠️ E ISSO NÃO MEXE NOS CORTES. Os grupos são uma camada de exibição
// (`a.grupos`), não uma nova lista de capítulos: `a.capitulos` fica intacto, e
// com ele a posição, os marcadores e as transcrições, que guardam `{cap, seg}`.
// Trocar a lista exigiria remapear tudo; agrupar não exige nada.
const AB_DESC_SEG = 25          // segundos do começo de cada parte: o número é dito logo

const AB_NUM_EN = {
  one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
  eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16,
  seventeen:17, eighteen:18, nineteen:19, twenty:20, thirty:30, forty:40, fifty:50
}

// "Twenty-three" → 23; "twenty three" → 23; "seven" → 7.
function _abNumPorExtenso(txt) {
  const partes = String(txt).toLowerCase().split(/[\s-]+/).filter(Boolean)
  let total = 0, achou = false
  for (const w of partes.slice(0, 2)) {
    const v = AB_NUM_EN[w]
    if (v == null) break
    total += v; achou = true
  }
  return achou ? total : null
}

// ⚠️ O WHISPER ESCREVE COMO OUVE, e o mesmo narrador sai "2." numa parte e
// "Four." na outra — foi o que apareceu nas transcrições reais dele. Ler só
// dígito perderia metade.
function _abNumeroDoInicio(texto) {
  const t = String(texto || '').trim().slice(0, 80)
  // "Chapter Two" dito em voz alta vale mais que qualquer inferência.
  const cap = t.match(/^\s*chapter\s+([a-z0-9-]+)/i)
  const capNum = cap ? (/^\d+$/.test(cap[1]) ? Number(cap[1]) : _abNumPorExtenso(cap[1])) : null
  // o número da seção: dígito ou por extenso, seguido de ponto ou espaço
  const resto = cap ? t.slice(cap[0].length) : t
  const dig = resto.match(/^[\s.,:—-]*(\d{1,3})\s*[.,]/)
  let sec = dig ? Number(dig[1]) : null
  if (sec == null) {
    const ext = resto.match(/^[\s.,:—-]*([a-z]+(?:[\s-][a-z]+)?)\s*[.,]/i)
    if (ext) sec = _abNumPorExtenso(ext[1])
  }
  return { capitulo: capNum, secao: (sec != null && sec >= 1 && sec <= 200) ? sec : null }
}

// Dos números lidos, os grupos. Um capítulo novo começa quando a seção volta
// para 1 — ou quando o narrador anuncia "Chapter N".
//
// ⚠️ O QUE VEM ANTES DA PRIMEIRA SEÇÃO 1 NÃO É CAPÍTULO. Abertura, título e
// aviso de direitos autorais moram nas primeiras faixas; jogá-los dentro do
// Chapter 1 faria o primeiro capítulo começar com o nome da editora.
function _abGruposDosNumeros(lidos, total) {
  const grupos = []
  let atual = null, nCap = 0
  for (let i = 0; i < total; i++) {
    const l = lidos[i]
    const comeca = l && (l.capitulo != null || l.secao === 1)
    if (comeca) {
      nCap = l.capitulo != null ? l.capitulo : nCap + 1
      atual = { titulo: `Chapter ${nCap}`, de: i, ate: i }
      grupos.push(atual)
    } else if (atual) {
      atual.ate = i
    } else {
      // antes do primeiro capítulo: a abertura
      if (!grupos.length || grupos[0].titulo !== 'Abertura') grupos.unshift({ titulo: 'Abertura', de: 0, ate: i })
      else grupos[0].ate = i
    }
  }
  return grupos
}

async function abAgruparCapitulos() {
  const a = _abLivro; if (!a) return
  const caps = a.capitulos || []
  if (caps.length < 3) { toast('Este livro já está em capítulos.', 'info'); return }
  const stt = typeof aiSttCfg === 'function' ? aiSttCfg() : null
  if (!stt) { toast('Configure a chave da Groq ou da OpenAI (Configurações → IA)', 'error'); return }

  // O que já está transcrito sai de graça: o número está na primeira fala.
  const jaTem = caps.map((_, i) => {
    const tr = (a.transcricoes || []).find(x => x.cap === i)
    return tr && tr.segs && tr.segs.length ? _abNumeroDoInicio(tr.segs[0].t) : null
  })
  const faltam = jaTem.map((x, i) => (x && x.secao != null) ? -1 : i).filter(i => i >= 0)
  const usd = (faltam.length * AB_DESC_SEG / 60) * stt.usdMin
  const brl = typeof aiUsdBrl === 'function' ? await aiUsdBrl().catch(() => 5.5) : 5.5

  const ok = await confirmModal({
    title: 'Descobrir os capítulos', icon: 'layers', confirmText: 'Descobrir',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
      Este livro está em <b>${caps.length} partes</b> numeradas, sem os capítulos. O narrador diz o
      número de cada parte no começo — e esse número <b>volta para 1</b> quando entra um capítulo
      novo. É por aí que dá para montar a estrutura, <b>sem precisar do livro em texto</b>.<br><br>
      Vou ouvir só os <b>${AB_DESC_SEG} segundos iniciais</b> de ${faltam.length}
      ${faltam.length === 1 ? 'parte' : 'partes'}${faltam.length < caps.length
        ? ` (as outras ${caps.length - faltam.length} já estão transcritas e saem de graça)` : ''}:
      cerca de <b>${(usd * brl).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
      na ${esc(stt.nome)}, ${_abTempoDaFila(faltam.length)}.<br><br>
      <b>Nada é apagado.</b> Os cortes, sua posição, os marcadores e as transcrições ficam como
      estão — os capítulos entram só como agrupamento na lista, e você vê a prévia antes de
      confirmar.</p>`
  })
  if (!ok) return
  _abDescRodar(a, jaTem, faltam)
}

let _abDescCancelar = false

async function _abDescRodar(a, lidos, faltam) {
  _abDescCancelar = false
  const total = (a.capitulos || []).length
  const box = () => el('ab-aba')
  const pintar = (feitos) => {
    const b = box(); if (!b) return
    b.innerHTML = `<div class="est-nada">${ic('layers','ic-lg')}
      <p>Ouvindo o começo de cada parte… <b>${feitos} de ${faltam.length}</b></p>
      <div class="est-ficha-barra" style="width:300px"><i style="width:${Math.round(feitos / Math.max(1, faltam.length) * 100)}%;background:var(--role-energia)"></i></div>
      <p class="est-dica">Dá para continuar usando o app; só não feche a aba.</p>
      <button class="btn btn-ghost btn-sm" onclick="_abDescCancelar=true">Parar</button></div>`
  }
  pintar(0)
  let feitos = 0
  for (const i of faltam) {
    if (_abDescCancelar) break
    try {
      const cap = a.capitulos[i]
      const dur = abDurCap(cap)
      const alvo = { ini: 0, fim: Math.min(AB_DESC_SEG, dur > 0 ? dur : AB_DESC_SEG) }
      const blob = await _abAudioDoTrecho(a, cap, alvo.ini, alvo.fim)
      const r = await aiTranscribe(blob, { nome: 'ini.mp3', lang: (a.lang || 'en').slice(0, 2), timeoutMs: 120000 })
      lidos[i] = _abNumeroDoInicio(r.text || (r.segments || [])[0]?.text || '')
    } catch (e) {
      console.warn('[audiobook] parte', i, 'não deu:', e && e.message)
      lidos[i] = null
    }
    feitos++
    pintar(feitos)
  }
  const grupos = _abGruposDosNumeros(lidos, total)
  _abDescPrevia(a, grupos, lidos)
}

// ⚠️ PRÉVIA ANTES DE APLICAR, e não depois. O agrupamento é um palpite montado
// a partir do que a IA ouviu: um número perdido no meio desloca tudo dali para
// frente. Ver 24 capítulos com contagens plausíveis é o que separa "funcionou"
// de "parece que funcionou".
async function _abDescPrevia(a, grupos, lidos) {
  const semNumero = lidos.filter((x, i) => !x || x.secao == null).length
  const reais = grupos.filter(g => g.titulo !== 'Abertura')
  const b = el('ab-aba')
  if (!reais.length) {
    if (b) b.innerHTML = `<div class="est-nada">${ic('alert','ic-lg')}
      <p>Não consegui achar a numeração.</p>
      <p class="est-dica" style="max-width:460px">O narrador deste livro talvez não anuncie o
        número das partes. Nada foi alterado.</p>
      <button class="btn btn-ghost btn-sm" onclick="abAba('capitulos')">Voltar</button></div>`
    return
  }
  const ok = await confirmModal({
    title: 'Confira antes de aplicar', icon: 'layers', confirmText: 'Aplicar',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
      Achei <b>${reais.length} capítulos</b> nas ${(a.capitulos || []).length} partes.
      ${semNumero ? `<br><br>⚠️ Em <b>${semNumero}</b> ${semNumero === 1 ? 'parte' : 'partes'} não
        deu para ler o número — ${semNumero === 1 ? 'ela ficou' : 'elas ficaram'} junto do capítulo
        anterior.` : ''}</p>
      <div style="max-height:220px;overflow:auto;margin-top:10px;font-size:var(--fs-sm)">
        ${grupos.map(g => `<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-bottom:1px solid var(--border)">
          <span>${esc(g.titulo)}</span>
          <b style="white-space:nowrap">${g.ate - g.de + 1} ${g.ate === g.de ? 'parte' : 'partes'}</b></div>`).join('')}
      </div>
      <p class="est-dica" style="margin-top:10px">Os cortes, sua posição e as transcrições não
        mudam — isto é só o agrupamento da lista, e dá para desfazer.</p>`
  })
  if (!ok) { abAba('capitulos'); return }
  a.grupos = grupos
  a.updatedAt = Date.now()
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast(`${reais.length} capítulos montados`, 'success')
  abAba('capitulos')
}

function abDesagrupar() {
  const a = _abLivro; if (!a || !a.grupos) return
  a.grupos = null
  a.updatedAt = Date.now()
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  abAba('capitulos')
}

// Em que grupo mora a parte `i` — para o player dizer "Chapter 3 · parte 2 de 8".
function abGrupoDaParte(a, i) {
  for (const g of (a && a.grupos) || []) if (i >= g.de && i <= g.ate) return g
  return null
}

// ================================================================
// PROCURAR OS CAPÍTULOS DE VERDADE — pelo silêncio entre eles
// ================================================================
// As "Partes de 15 minutos" são honestas, mas arbitrárias: cortam no meio de
// uma frase. Um audiolivro real tem 2 a 4 segundos de silêncio entre capítulos
// — muito mais do que a pausa de uma vírgula ou de um ponto final. É esse vão
// que o ffmpeg sabe achar (`silencedetect`), e é dele que saem os cortes
// verdadeiros.
//
// ⚠️ POR QUE ISTO É SOB DEMANDA, E NUNCA NA IMPORTAÇÃO: para medir o silêncio é
// preciso DECODIFICAR o arquivo inteiro. São minutos de trabalho num livro de
// doze horas — aceitável quando ele pediu e está vendo a barra andar,
// inaceitável como surpresa ao arrastar um arquivo para a tela.
//
// ⚠️ E O CORTE MEXE EM TUDO O QUE APONTA PARA UM CAPÍTULO: a posição de
// leitura, os marcadores e as transcrições guardam `{cap, seg}`. Trocar a lista
// de capítulos sem remapear essas referências mandaria o livro para o lugar
// errado e faria cada marcador mentir. Ver `_abRemapearParaNovosCapitulos`.
const AB_SIL_DB = -32           // abaixo disto é silêncio, para voz narrada
const AB_SIL_SEG = 1.6          // silêncio menor que isto é pausa, não capítulo
const AB_CAP_MIN_SEG = 90       // capítulo achado menor que isto é falso positivo

function abPodeProcurarCapitulos(a) {
  // Só faz sentido num arquivo único: várias faixas JÁ são a capitulação.
  return !!a && (a.arquivos === 1) && (a.capitulos || []).length >= 1
}

// ⚠️ TROCAR A LISTA DE CAPÍTULOS MEXE EM TUDO O QUE APONTA PARA UM DELES —
// a posição de leitura, cada marcador e cada transcrição guardam `{cap, seg}`.
// O remapeamento existe e é testado (`_abRemapearParaNovosCapitulos`), mas
// quem tem 3 transcrições e 12 marcadores merece saber ANTES que eles vão ser
// realinhados, e não descobrir depois que "o capítulo 3" virou outro número.
// ⚠️ "AS PARTES POR TEMPO" ERA MENTIRA NA METADE DOS CASOS. A frase nasceu
// quando este botão só aparecia para livro fatiado pelo relógio; agora ele
// aparece também para quem tem capítulos vindos do arquivo, e dizer "as partes
// por tempo" a quem tem "Chapter 1..60" descreve outra coisa.
function _abComoEstaDividido(a) {
  const caps = a.capitulos || []
  if (caps.length <= 1) return 'a divisão atual'
  const porTempo = caps.some(c => /^(Parte \d|Livro completo)/.test(c.titulo || ''))
  return porTempo ? 'as partes por tempo' : `os ${caps.length} capítulos de agora`
}

function _abOQueVaiMudar(a) {
  const t = (a.transcricoes || []).length
  const m = (a.marcadores || []).length
  if (!t && !m) return ''
  const partes = []
  if (t) partes.push(`<b>${t}</b> ${t === 1 ? 'transcrição' : 'transcrições'}`)
  if (m) partes.push(`<b>${m}</b> ${m === 1 ? 'marcador' : 'marcadores'}`)
  // Sem pronome: com "3 transcrições" saía "eles são realinhados", e com
  // "1 marcador e 2 transcrições" não há concordância que sirva para os dois.
  return `<br><br>Você tem ${partes.join(' e ')} neste livro. <b>Nada se perde</b> — tudo é
    realinhado para os capítulos novos, junto com onde você parou.`
}

async function abProcurarCapitulos() {
  const a = _abLivro; if (!a || !abPodeProcurarCapitulos(a)) return
  const dur = abDuracao(a)
  const ok = await confirmModal({
    title: 'Procurar os capítulos de verdade', icon: 'search', confirmText: 'Procurar',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
      Vou escutar o arquivo inteiro atrás dos <b>silêncios longos</b> — o vão de dois a quatro
      segundos que separa um capítulo do outro — e trocar ${_abComoEstaDividido(a)} pelos cortes
      encontrados.<br><br>
      É tudo feito <b>neste aparelho</b>, sem IA e sem custo algum. Em compensação <b>demora</b>:
      o áudio precisa ser decodificado do começo ao fim${dur ? ` (${abTempoLongo(dur)} de livro)` : ''}.
      Dá para continuar usando o app; só não feche esta aba.
      ${_abOQueVaiMudar(a)}</p>`
  })
  if (!ok) return

  const box = el('ab-aba')
  const pintar = (m, pct) => {
    if (!box) return
    box.innerHTML = `<div class="est-nada">
      <p>${esc(m)}</p>
      ${pct != null ? `<div class="est-ficha-barra" style="width:280px"><i style="width:${Math.round(pct * 100)}%;background:var(--role-energia)"></i></div>` : ''}
      <p class="est-dica">Pode deixar rodando e voltar depois.</p></div>`
  }
  try {
    pintar('Preparando o conversor (na 1ª vez baixa ~31 MB)…')
    const silencios = await _abDetectarSilencios(a, (m, pct) => pintar(m, pct))
    const cortes = _abCortesDosSilencios(silencios, abDuracao(a))
    if (cortes.length < 1) {
      if (box) box.innerHTML = `<div class="est-nada">${ic('info','ic-lg')}
        <p>Não achei silêncios longos o bastante para separar capítulos.</p>
        <p class="est-dica" style="max-width:460px">Acontece com gravação sem pausa entre
        capítulos, ou com música de fundo contínua — o vão existe para o ouvido, mas não para a
        medida. As partes por tempo continuam valendo.</p>
        <button class="btn btn-ghost btn-sm" onclick="abAba('capitulos')">Voltar</button></div>`
      return
    }
    _abPropostaCapitulos(cortes)
  } catch (e) {
    console.warn('[audiobook] silêncios:', e)
    if (box) box.innerHTML = `<div class="est-nada"><p class="est-erro">${esc(e.message)}</p>
      <button class="btn btn-ghost btn-sm" onclick="abAba('capitulos')">Voltar</button></div>`
  }
}

// O ffmpeg não devolve os silêncios como dado: ele os ESCREVE no log. A saída
// vai para `-f null`, porque nada precisa ser gravado — só queremos o relatório
// do filtro. Mono a 8 kHz para decodificar o mínimo possível: silêncio não tem
// estéreo nem agudo.
async function _abDetectarSilencios(a, aoAndar) {
  const cap0 = (a.capitulos || [])[0] || { arq: 0 }
  // Mesma história do trecho: o arquivo pode estar só na nuvem depois de
  // "liberar espaço". Aqui ele desce inteiro mesmo — a varredura de silêncio
  // precisa do áudio do começo ao fim.
  const blob = await abGarantirArquivo(a, cap0.arq, (m, pct) => aoAndar && aoAndar(m, pct))
  if (!blob) throw new Error('não consegui pegar o áudio deste livro')
  const ff = await _abFFmpeg()
  const nome = 'entrada' + (a.formato === 'm4b' ? '.m4b' : '.mp3')
  const arq = new File([blob], nome, { type: blob.type || 'audio/mpeg' })

  const achados = []
  const linha = ({ message }) => {
    const m = String(message || '')
    let r = m.match(/silence_start:\s*(-?[\d.]+)/)
    if (r) { achados.push({ ini: parseFloat(r[1]) }); return }
    r = m.match(/silence_end:\s*([\d.]+)[^|]*\|\s*silence_duration:\s*([\d.]+)/)
    if (r && achados.length) {
      const ultimo = achados[achados.length - 1]
      ultimo.fim = parseFloat(r[1])
      ultimo.dur = parseFloat(r[2])
    }
  }
  ff.on('log', linha)
  if (aoAndar) {
    ff.on('progress', ({ progress }) => {
      if (progress > 0 && progress <= 1) aoAndar(`Escutando o livro… ${Math.round(progress * 100)}%`, progress)
    })
  }
  try {
    try { await ff.unmount('/abs') } catch (e) {}
    try { await ff.createDir('/abs') } catch (e) {}
    await ff.mount('WORKERFS', { files: [arq] }, '/abs')
    if (aoAndar) aoAndar('Escutando o livro…', 0)
    const code = await ff.exec(['-i', '/abs/' + nome, '-ac', '1', '-ar', '8000',
      '-af', `silencedetect=noise=${AB_SIL_DB}dB:d=${AB_SIL_SEG}`, '-f', 'null', '-'])
    if (code !== 0) throw new Error('a varredura retornou código ' + code)
  } finally {
    try { ff.off('log', linha) } catch (e) {}
    try { await ff.unmount('/abs') } catch (e) {}
  }
  return achados.filter(x => x.fim > x.ini)
}

// O CORTE FICA NO FIM DO SILÊNCIO, e não no começo nem no meio: é ali que o
// narrador diz "Chapter Two". Cortar no início do vão deixaria o título do
// capítulo pendurado no fim do capítulo anterior.
// ⚠️ E silêncio longo não é sempre capítulo: pausa dramática, troca de cena e
// respiro de fim de parágrafo também aparecem. Por isso o filtro por tamanho
// mínimo de capítulo — melhor devolver dez capítulos certos que trinta cortes
// no meio da narração.
function _abCortesDosSilencios(silencios, duracao) {
  const cortes = []
  for (const s of silencios) {
    const ponto = Math.max(0, s.fim - 0.25)
    if (ponto < AB_CAP_MIN_SEG) continue                       // abertura do livro
    if (duracao && ponto > duracao - AB_CAP_MIN_SEG) continue  // sobra do fim
    if (cortes.length && ponto - cortes[cortes.length - 1] < AB_CAP_MIN_SEG) continue
    cortes.push(ponto)
  }
  return cortes
}

// A PROPOSTA ANTES DE APLICAR. Trocar a capitulação de um livro é irreversível
// na prática (não dá para "desfatiar"), então ele vê o que vai acontecer.
let _abCortesPropostos = null
function _abPropostaCapitulos(cortes) {
  const a = _abLivro
  const dur = abDuracao(a)
  const novos = _abCapitulosDosCortes(cortes, dur, (a.capitulos[0] || {}).arq || 0)
  _abCortesPropostos = novos
  const menor = Math.min(...novos.map(abDurCap))
  const maior = Math.max(...novos.map(abDurCap))
  const box = el('ab-aba'); if (!box) return
  box.innerHTML = `
    <div class="ab-proposta">
      <p><b>${novos.length} capítulos</b> encontrados pelo silêncio —
        do menor (${abTempoLongo(menor)}) ao maior (${abTempoLongo(maior)}).</p>
      <p class="est-dica">Confira a lista. Aplicando, suas <b>marcações e transcrições
        acompanham</b> os novos cortes, e a posição de leitura também.</p>
      <div class="ab-caps" style="margin:14px 0">
        ${novos.map((c, i) => `<div class="ab-cap">
          <span class="ab-cap-n">${i + 1}</span>
          <span class="ab-cap-t">${esc(c.titulo)}</span>
          <span class="ab-cap-d">${abTempo(abDurCap(c))}</span></div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="abAba('capitulos')">Manter como está</button>
        <button class="btn btn-primary btn-sm" onclick="abAplicarCapitulos()">${ic('check','ic-sm')} Usar estes capítulos</button>
      </div>
    </div>`
}

function _abCapitulosDosCortes(cortes, duracao, arq) {
  const pontos = [0, ...cortes, duracao]
  const caps = []
  for (let i = 0; i < pontos.length - 1; i++) {
    caps.push({
      titulo: `Capítulo ${i + 1} · ${abTempo(pontos[i])}`,
      arq, ini: pontos[i], fim: pontos[i + 1]
    })
  }
  return caps
}

function abAplicarCapitulos() {
  const a = _abLivro, novos = _abCortesPropostos
  if (!a || !novos || !novos.length) return
  _abRemapearParaNovosCapitulos(a, novos)
  a.capitulos = novos
  a.updatedAt = Date.now()
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  _abCortesPropostos = null
  _abCap = Math.min(a.pos?.cap || 0, novos.length - 1)
  toast(`${novos.length} capítulos aplicados`, 'success')
  _abAbaAtual = 'capitulos'
  _abRenderPlayer()
}

// TUDO QUE APONTAVA PARA UM CAPÍTULO PRECISA APONTAR PARA O NOVO.
// A conta é a mesma para os três casos: o tempo dentro do ARQUIVO não muda —
// muda só qual capítulo o contém. Sem isto, um marcador de "0:38 do capítulo 2"
// viraria 0:38 de um capítulo 2 que agora começa noutro lugar do livro.
function _abRemapearParaNovosCapitulos(a, novos) {
  const antigos = a.capitulos || []
  const absoluto = (cap, seg) => ((antigos[cap] || {}).ini || 0) + (seg || 0)
  const achar = abs => {
    let i = novos.findIndex(c => abs >= c.ini && abs < c.fim)
    if (i < 0) i = abs >= (novos[novos.length - 1] || {}).fim ? novos.length - 1 : 0
    return { cap: i, seg: Math.max(0, abs - novos[i].ini) }
  }
  if (a.pos) a.pos = achar(absoluto(a.pos.cap, a.pos.seg))
  for (const m of (a.marcadores || [])) {
    const novo = achar(absoluto(m.cap, m.seg))
    m.cap = novo.cap; m.seg = novo.seg
  }
  // Na transcrição, `ini/fim` e cada `seg` guardam tempo DENTRO do capítulo.
  // Todos se deslocam pela MESMA diferença — a distância entre o começo do
  // capítulo antigo e o do novo —, então basta somar esse deslocamento a todos.
  for (const t of (a.transcricoes || [])) {
    const baseAntiga = (antigos[t.cap] || {}).ini || 0
    const novoCap = achar(baseAntiga + t.ini).cap
    const desloc = baseAntiga - novos[novoCap].ini
    t.cap = novoCap
    t.ini += desloc
    t.fim += desloc
    for (const seg of (t.segs || [])) { seg.i += desloc; seg.f += desloc }
  }
}

// ================================================================
// OUVIR VIRA CARD — a transcrição por capítulo
// ================================================================
// Era a pendência que separava o reprodutor do resto do app: ele tocava, e
// ouvir não gerava nada. Agora o capítulo vira TEXTO, o texto acompanha o
// áudio, e selecionar uma frase manda para o Preparar como qualquer palavra
// capturada no livro — com a obra e a frase certas.
//
// ⚠️ POR CAPÍTULO, E ESSA FOI A DECISÃO DELE: *"a transcrição tem que
// funcionar por capítulo pra assim não ser tudo de uma vez, mas entendo que
// nem todo audiobook vai vir capitularizado."* Doze horas de uma vez seriam
// caras, demoradas e inúteis (ele estuda o capítulo que está ouvindo).
//
// E o caso que ele mesmo previu tem saída: quando o "capítulo" é o livro
// inteiro (arquivo sem marcação), transcrever tudo seria justamente o que se
// quer evitar — então o app propõe o TRECHO em volta de onde ele está, e diz
// por quê.
const AB_TRANS_CAP_MAX_MIN = 30     // até aqui, o capítulo inteiro de uma vez
const AB_TRANS_JANELA_MIN = 10      // acima disso, só o trecho em volta
const AB_ENVIO_DIRETO_MB = 24       // teto da API; abaixo disso, sem conversor

// A transcrição que cobre este ponto do capítulo (ou null).
function abTransDoPonto(a, cap, seg) {
  const t = (a.transcricoes || []).filter(x => x.cap === cap)
  return t.find(x => seg >= x.ini - 0.5 && seg <= x.fim + 0.5) || null
}

// Quanto seria transcrito agora, e por quê.
function _abAlvoDaTranscricao() {
  const a = _abLivro, au = _abAudio()
  const cap = a.capitulos[_abCap]
  const dur = abDurCap(cap)
  const atual = Math.max(0, (au ? au.currentTime : cap.ini || 0) - (cap.ini || 0))
  // ⚠️ DURACAO DESCONHECIDA NAO PODE VIRAR "ZERO MINUTOS". Acontece quando a
  // importacao rodou com a aba em segundo plano (o Chrome adia a leitura dos
  // metadados): o capitulo fica com `fim: 0`, e sem este ramo o app diria
  // "transcrever 0 min" e mandaria uma janela vazia. Estimar pelo TAMANHO do
  // arquivo (~1 MB por minuto em 128 kbps) da um numero honesto para o aviso
  // de custo, e o trecho enviado e o arquivo inteiro, que e o que existe.
  if (dur <= 0) {
    const mb = (a.tamanho || 0) / 1048576 / Math.max(1, a.arquivos || 1)
    return { ini: 0, fim: 0, inteiro: true, minutos: Math.max(1, Math.round(mb)), estimado: true }
  }
  if (dur <= AB_TRANS_CAP_MAX_MIN * 60) {
    return { ini: 0, fim: dur, inteiro: true, minutos: dur / 60 }
  }
  const meia = (AB_TRANS_JANELA_MIN * 60) / 2
  const ini = Math.max(0, Math.min(atual - meia, dur - AB_TRANS_JANELA_MIN * 60))
  return { ini, fim: Math.min(dur, ini + AB_TRANS_JANELA_MIN * 60), inteiro: false, minutos: AB_TRANS_JANELA_MIN }
}

async function abTranscrever() {
  const a = _abLivro; if (!a) return
  const stt = typeof aiSttCfg === 'function' ? aiSttCfg() : null
  if (!stt) {
    toast('Configure a chave da Groq ou da OpenAI para transcrever (Configurações → IA)', 'error')
    return
  }
  const cap = a.capitulos[_abCap]
  const alvo = _abAlvoDaTranscricao()
  const usd = alvo.minutos * stt.usdMin
  const brl = typeof aiUsdBrl === 'function' ? await aiUsdBrl().catch(() => 5.5) : 5.5

  const ok = await confirmModal({
    title: alvo.inteiro ? 'Transcrever este capítulo' : 'Transcrever este trecho',
    icon: 'sparkles', confirmText: 'Transcrever',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
      ${alvo.inteiro
        ? `<b>${esc(cap.titulo)}</b> — ${alvo.estimado
             ? `cerca de ${alvo.minutos} min de áudio (a duração exata só aparece depois de tocar)`
             : `${abTempoLongo(abDurCap(cap))} de áudio`}.`
        : `Este capítulo tem <b>${abTempoLongo(abDurCap(cap))}</b>, tempo demais para transcrever de
           uma vez. Vou pegar os <b>${AB_TRANS_JANELA_MIN} minutos</b> em volta de onde você está
           (${abTempo(alvo.ini)}–${abTempo(alvo.fim)}).`}
      <br><br>Custa cerca de <b>${(usd * brl).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
      na ${esc(stt.nome)}. Depois disso o texto fica guardado — e selecionar uma frase manda ela
      para o Preparar.</p>`
  })
  if (!ok) return

  const box = el('ab-aba')
  const msg = m => { if (box) box.innerHTML = `<div class="est-nada"><p>${esc(m)}</p></div>` }
  try {
    const r = await _abTranscreverTrecho(a, _abCap, alvo, msg)
    toast(r.ganharam
      ? `${r.falas} falas transcritas · ${r.ganharam} ${r.ganharam === 1 ? 'marcador ganhou' : 'marcadores ganharam'} a frase`
      : `${r.falas} falas transcritas`, 'success')
    abAba('texto')
  } catch (e) {
    console.warn('[audiobook] transcrição:', e)
    if (box) box.innerHTML = `<div class="est-nada"><p class="est-erro">${esc(e.message)}</p>
      <button class="btn btn-ghost btn-sm" onclick="abAba('texto')">Voltar</button></div>`
  }
}

// ⚠️ O NÚCLEO, SEM TELA E SEM PERGUNTA. Estava embutido em `abTranscrever`, que
// pergunta o custo e pinta a área da aba — e nada disso serve para o
// "transcrever tudo", que roda em segundo plano com ele fazendo outra coisa.
// Separado, os dois caminhos usam exatamente a mesma transcrição.
async function _abTranscreverTrecho(a, i, alvo, aoAndar) {
  const cap = a.capitulos[i]
  if (aoAndar) aoAndar('Separando o áudio…')
  const blob = await _abAudioDoTrecho(a, cap, alvo.ini, alvo.fim, m => aoAndar && aoAndar(m))
  if (aoAndar) aoAndar('Ouvindo e escrevendo… (isso leva alguns segundos)')
  const r = await aiTranscribe(blob, {
    nome: 'trecho.mp3', lang: (a.lang || 'en').slice(0, 2), granular: true, timeoutMs: 300000
  })
  const segs = (r.segments || []).map(x => ({
    i: alvo.ini + (x.start || 0), f: alvo.ini + (x.end || 0), t: String(x.text || '').trim()
  })).filter(x => x.t)
  if (!segs.length) throw new Error('a transcrição voltou vazia — o trecho tem fala?')
  // Com duração desconhecida, o fim verdadeiro é o da última fala: sem isso a
  // transcrição ficaria com `fim: 0` e nunca seria reencontrada pelo ponto.
  const fimReal = alvo.fim > 0 ? alvo.fim : Math.max(alvo.ini + 1, segs[segs.length - 1].f)

  a.transcricoes = (a.transcricoes || []).filter(x => !(x.cap === i && x.ini === alvo.ini))
  a.transcricoes.push({ cap: i, ini: alvo.ini, fim: fimReal, segs, at: Date.now() })
  a.updatedAt = Date.now()
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  // Os marcadores que ele guardou ANTES desta transcrição ganham a frase
  // agora — é a ordem real de uso (marca ouvindo, transcreve depois).
  let ganharam = 0
  for (const m of (a.marcadores || [])) {
    if (m.cap !== i || m.frase) continue
    const f = abFraseDoMarcador(a, m)
    if (f) { m.frase = f; ganharam++ }
  }
  if (ganharam) saveAudiolivros()
  return { falas: segs.length, ganharam }
}

// O alvo de um capítulo QUALQUER, sem depender de onde o áudio está agora.
// ⚠️ E aqui o capítulo vai INTEIRO, não a janela de 10 minutos: quem pediu
// "transcrever tudo" já aceitou o custo do livro todo, e devolver um pedaço do
// meio de cada capítulo seria uma transcrição que mente sobre o que cobre.
// O teto existe pelo tamanho do envio — acima dele o capítulo fica de fora, e
// a lista diz quais foram, em vez de fazer pela metade em silêncio.
const AB_TRANS_TETO_MIN = 90        // ~14 MB por hora em 32 kbps mono; o teto da API é 24 MB

function _abAlvoInteiro(a, i) {
  const cap = a.capitulos[i]
  const dur = abDurCap(cap)
  if (dur <= 0) {
    const mb = (a.tamanho || 0) / 1048576 / Math.max(1, a.arquivos || 1)
    return { ini: 0, fim: 0, inteiro: true, minutos: Math.max(1, Math.round(mb)), estimado: true }
  }
  return { ini: 0, fim: dur, inteiro: true, minutos: dur / 60 }
}

// O ÁUDIO DO TRECHO, pelo caminho mais barato que servir.
// ⚠️ O atalho importa mais do que parece: audiolivro em faixas costuma ter
// capítulos de 5 a 15 minutos, que cabem inteiros no limite de 24 MB da API.
// Nesses casos não se baixa conversor nenhum — o arquivo vai como está. O
// ffmpeg (31 MB na primeira vez) só entra quando é inevitável: um `.m4b` de
// meio giga do qual precisamos de dez minutos.
async function _abAudioDoTrecho(a, cap, ini, fim, aoAndar) {
  // ⚠️ CASO VIZINHO DE "LIBERAR ESPAÇO": ele apaga o áudio daqui, o livro
  // continua tocando (baixa o capítulo na hora) — e então pede para transcrever.
  // Sem esta linha, a transcrição morria com "não está neste aparelho" logo
  // depois de o capítulo ter tocado normalmente.
  const blob = await abGarantirArquivo(a, cap.arq, (m, pct) => aoAndar && aoAndar(m))
  if (!blob) throw new Error('não consegui pegar o áudio deste capítulo')

  const pedacoInteiro = (cap.ini || 0) === 0 && ini === 0 && (fim <= 0 || fim >= abDurCap(cap) - 0.5)
  if (pedacoInteiro && blob.size <= AB_ENVIO_DIRETO_MB * 1024 * 1024) return blob

  if (aoAndar) aoAndar('Preparando o conversor (na 1ª vez baixa ~31 MB)…')
  const ff = await _abFFmpeg(aoAndar)
  const nome = 'entrada' + (a.formato === 'm4b' ? '.m4b' : '.mp3')
  const arq = new File([blob], nome, { type: blob.type || 'audio/mpeg' })
  try { await ff.unmount('/ab') } catch (e) {}
  try { await ff.createDir('/ab') } catch (e) {}
  // WORKERFS lê sob demanda: um `.m4b` de 500 MB nunca entra inteiro na
  // memória do wasm — sem isso, transcrever um trecho derrubaria a aba.
  await ff.mount('WORKERFS', { files: [arq] }, '/ab')
  if (aoAndar) aoAndar('Separando o áudio…')
  const de = (cap.ini || 0) + ini
  const dur = Math.max(1, fim - ini)
  // Mono, 32 kbps, 16 kHz: é o que o Whisper escuta. Menos que isso não
  // melhora a transcrição e só faria o envio demorar.
  const code = await ff.exec(['-ss', String(de), '-t', String(dur), '-i', '/ab/' + nome,
    '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k', 'trecho.mp3'])
  if (code !== 0) throw new Error('não consegui separar o áudio (código ' + code + ')')
  const dados = await ff.readFile('trecho.mp3')
  try { await ff.deleteFile('trecho.mp3') } catch (e) {}
  try { await ff.unmount('/ab') } catch (e) {}
  return new Blob([dados.buffer], { type: 'audio/mpeg' })
}

let _abFF = null
async function _abFFmpeg(aoAndar) {
  if (_abFF) return _abFF
  const { FFmpeg } = await import('./vendor/ffmpeg/index.js')
  const ff = new FFmpeg()
  if (aoAndar) ff.on('progress', ({ progress }) => {
    if (progress > 0 && progress < 1) aoAndar(`Separando o áudio… ${Math.round(progress * 100)}%`)
  })
  const base = new URL('js/vendor/ffmpeg/', document.baseURI).href
  await ff.load({ coreURL: base + 'ffmpeg-core.js', wasmURL: base + 'ffmpeg-core.wasm' })
  _abFF = ff
  return ff
}

// ---- o painel de texto ----
function _abListaTexto() {
  const a = _abLivro, au = _abAudio()
  const cap = a.capitulos[_abCap]
  const atual = Math.max(0, (au ? au.currentTime : 0) - (cap.ini || 0))
  const tr = abTransDoPonto(a, _abCap, atual) || (a.transcricoes || []).find(x => x.cap === _abCap)
  if (!tr) {
    const alvo = _abAlvoDaTranscricao()
    // ⚠️ ESTA TELA ERA UM BECO. Ele chegava nela justamente quando queria
    // texto — e a única saída era transcrever ESTE capítulo, um de cada vez.
    // As outras duas portas (escolher na lista, ou mandar tudo) só existiam na
    // barra de cima, que nem aparece aqui: sem transcrição não há barra.
    // Quem está sem texto é quem mais precisa das três.
    const caps = a.capitulos || []
    const comTexto = caps.filter((_, i) => _abEstadoDoCap(a, i).estado !== 'vazio').length
    const faltam = caps.length - comTexto
    return `<div class="est-nada">${ic('sparkles','ic-lg')}
      <p>Este capítulo ainda não tem texto.</p>
      <p class="est-dica" style="max-width:460px">
        ${alvo.inteiro
          ? `A IA escuta o capítulo e escreve o que foi dito. Depois é só marcar uma frase para
             mandá-la ao Preparar — com a obra e o contexto certos.`
          : `Este capítulo tem ${abTempoLongo(abDurCap(cap))}. Vou transcrever os
             ${AB_TRANS_JANELA_MIN} minutos em volta de onde você está, e não o arquivo inteiro.`}
      </p>
      <div class="ab-vazio-acoes">
        <button class="btn btn-primary btn-sm" onclick="abTranscrever()">
          ${ic('sparkles','ic-sm')} Transcrever ${alvo.inteiro ? 'o capítulo' : 'este trecho'}</button>
        ${caps.length > 1 ? `<button class="btn btn-ghost btn-sm" id="ab-trans-btn-vazio"
          onclick="event.stopPropagation();abTransPainel('ab-trans-btn-vazio')">
          ${ic('captions','ic-sm')} Escolher capítulos</button>` : ''}
        ${faltam > 1 ? `<button class="btn btn-ghost btn-sm" onclick="abTranscreverTudo()">
          ${ic('layers','ic-sm')} Transcrever os ${faltam} que faltam</button>` : ''}
      </div>
      ${caps.length > 1 ? `<p class="est-dica">${comTexto} de ${caps.length} capítulos já têm texto.
        ${comTexto ? 'Os que já têm não são refeitos nem cobrados de novo.' : ''}</p>` : ''}
    </div>`
  }
  // ⚠️ NADA DE LEGENDA EM MASSA POR BAIXO DAS FALAS. Foi o que eu fiz primeiro,
  // e ele corrigiu: *"a tradução é só quando eu arrastar a palavra ou frase,
  // igual é no livro."* Português impresso ao lado do inglês faz o olho pular
  // para o português e a escuta não treina nada — a tradução tem de ser um
  // gesto, e só quando ele pedir. Quem traduz é o menu de seleção (`ai.js`).
  // ⚠️ Revalida o rótulo guardado antes de pintar: a análise fica salva no
  // audiolivro e o mundo muda em volta dela (ele estuda a palavra, marca
  // "já sei", a análise do Preparar termina). Ver `aiRevalidarAchados`.
  if (tr.achados && typeof aiRevalidarAchados === 'function') {
    const antes = tr.achados.length
    tr.achados = aiRevalidarAchados(tr.achados, _abOrigemDoCap(_abLivro, _abCap))
    if (tr.achados.length !== antes) { _abLivro.updatedAt = Date.now(); saveAudiolivros() }
  }
  const achados = tr.achados || null
  const nivel = cefrNivelAluno()
  return `
    <div class="ab-trans-topo">
      <span>${abTempo(tr.ini)} – ${abTempo(tr.fim)} · ${tr.segs.length} falas</span>
      <span class="est-dica">Marque uma palavra ou frase: a tradução aparece na hora, e o menu
        manda ao estudo.</span>
      ${achados
        ? `<button class="est-chip" id="ab-raiox-btn" onclick="abAnalisarPassagem()"
             data-tip="Refazer com o nível de agora">${ic('refresh','ic-3xs')} ${achados.filter(x => !x.ja).length} ${achados.filter(x => !x.ja).length === 1 ? 'novo' : 'novos'}${
               achados.filter(x => x.ja).length ? ` · ${achados.filter(x => x.ja).length} conhecidos` : ''}</button>`
        : `<button class="est-chip" id="ab-raiox-btn" onclick="abAnalisarPassagem()"
             data-tip="Acha o que está acima do seu nível, e todo phrasal verb e expressão">
             ${ic('eye','ic-3xs')} O que é difícil aqui</button>`}
      <button class="est-chip" onclick="abTranscrever()">${ic('plus','ic-3xs')} Outro trecho</button>
      <button class="est-chip est-chip-forte" id="ab-trans-btn" onclick="event.stopPropagation();abTransPainel()"
              data-tip="Ver os capítulos e o que já virou texto">${ic('captions','ic-3xs')} Transcrição</button>
      <button class="est-chip est-chip-forte" id="ab-raiox-btn2" onclick="event.stopPropagation();abRaioXPainel()"
              data-tip="Ver os capítulos e o que já foi analisado">${ic('eye','ic-3xs')} O que é difícil</button>
      <button class="est-chip" id="ab-tipo-btn" onclick="event.stopPropagation();abTipografia()"
              data-tip="Tipografia e papel — a mesma configuração do leitor de livros">Aa</button>
      <button class="est-chip" onclick="abTextoFull()" id="ab-full-btn"
              data-tip="Ler em tela cheia, com a fala do momento no centro (Esc sai)">
        ${ic('expand','ic-3xs')} Tela cheia</button>
    </div>
    <div class="ab-trans${achados ? ' com-raiox' : ''}" id="ab-trans" tabindex="0">
      ${tr.segs.map((s, i) => `
        <p class="ab-fala" data-i="${i}" data-ini="${s.i}" data-fim="${s.f}">
          <button class="ab-fala-t" onclick="abIrPara(${s.i})" data-tip="Ouvir a partir daqui">${abTempo(s.i)}</button>
          <span class="ab-fala-corpo">
            <span class="ab-fala-en">${achados ? _abFalaPintada(s.t, achados) : esc(s.t)}</span>
          </span>
        </p>`).join('')}
    </div>
    ${achados && !achados.length ? (achados.incompleto
      ? `<p class="est-dica est-erro" style="margin-top:10px">
          A análise não voltou inteira desta vez. Rode de novo — o que vier fica guardado.</p>`
      : `<p class="est-dica" style="margin-top:10px">
          Nada acima do seu <b>${esc(tr.achadosNivel || nivel)}</b> neste trecho — e nenhum phrasal
          verb ou expressão idiomática. Se ainda assim travou, marque a frase e peça o Explicar.</p>`) : ''}`
}

// ---- O PAINEL DO RAIO-X: os capítulos, e o que já foi analisado ----
// O mesmo painel do leitor, com uma diferença que o audiolivro impõe: aqui a
// análise precisa de TEXTO, e o texto vem da transcrição. Então um capítulo
// pode estar em três estados, e a lista diz qual é: sem texto, transcrito, ou
// transcrito e analisado. Clicar num capítulo sem texto faz as duas etapas em
// sequência — ele pediu "ao clicar no capítulo sem ele gera o processamento",
// e parar no meio com "agora transcreva" seria empurrar trabalho de volta.
// ================================================================
// O PAINEL DA TRANSCRIÇÃO — o que já virou texto, e o que falta
// ================================================================
// Pedido dele: *"deve ter um botão, igual o de análise de IA, pra gerar a
// transcrição e assim ver os que já estão gerados e os que posso gerar."*
//
// ⚠️ E FAZIA FALTA MESMO. A lista de capítulos existia só dentro do painel do
// raio-X, onde "transcrever" aparecia como um passo do caminho para analisar —
// quem só queria o TEXTO (para ler ouvindo, sem gastar com análise) não tinha
// por onde. São duas decisões diferentes e com preços diferentes: a transcrição
// passa pelo Whisper e é a cara das duas.
//
// A peça é a mesma do raio-X de propósito — mesmo desenho, mesma marca ✦, mesmo
// jeito de clicar. O que muda é a pergunta que cada uma responde.
// ⚠️ O PAINEL SE POSICIONAVA SOB UM BOTÃO QUE PODE NÃO EXISTIR. Ele nascia
// preso ao `ab-trans-btn` da barra de cima — e na tela de capítulo sem texto
// essa barra nem aparece, então o painel abriria no canto errado. A âncora
// virou parâmetro.
let _abTransAncora = 'ab-trans-btn'

function abTransPainel(ancora) {
  _abTransAncora = ancora || 'ab-trans-btn'
  const p = el('ab-trans-painel')
  if (p && p.classList.contains('aberto')) { p.classList.remove('aberto'); return }
  _abTransPainelRender()
  el('ab-trans-painel').classList.add('aberto')
}

function _abTransPainelRender(msg) {
  let p = el('ab-trans-painel')
  if (!p) {
    p = document.createElement('div')
    p.id = 'ab-trans-painel'
    p.className = 'ler-raiox-painel'
    p.addEventListener('click', e => e.stopPropagation())
    document.body.appendChild(p)
    setTimeout(() => document.addEventListener('click', () => p.classList.remove('aberto')), 0)
  }
  const a = _abLivro
  const caps = (a && a.capitulos) || []
  const prontos = caps.filter((_, i) => _abEstadoDoCap(a, i).estado !== 'vazio').length
  p.innerHTML = `
    <div class="ler-raiox-topo">
      <b>${ic('captions','ic-sm')} Transcrição</b>
      <span>${prontos} de ${caps.length} ${caps.length === 1 ? 'capítulo' : 'capítulos'} com texto</span>
    </div>
    ${msg ? `<div class="ler-raiox-msg">${esc(msg)}</div>` : ''}
    <div class="ler-raiox-lista">
      ${caps.map((c, i) => {
        const e2 = _abEstadoDoCap(a, i)
        const tem = e2.estado !== 'vazio'
        return `<button class="ler-raiox-cap${i === _abCap ? ' atual' : ''}${tem ? ' feito' : ''}"
                  onclick="abTransDoCapitulo(${i})">
          <span class="ler-raiox-spark">${tem ? ic('sparkles','ic-sm') : ''}</span>
          <span class="ler-raiox-nome">${esc(c.titulo || `Capítulo ${i + 1}`)}</span>
          <span class="ler-raiox-n">${tem ? `${e2.falas} ${e2.falas === 1 ? 'fala' : 'falas'}` : 'transcrever'}</span>
        </button>`
      }).join('')}
    </div>
    ${caps.some((_, i) => _abEstadoDoCap(a, i).estado === 'vazio') ? `
    <button class="btn btn-primary btn-sm" style="width:100%" onclick="abTranscreverTudo()">
      ${ic('captions','ic-sm')} Transcrever tudo o que falta</button>` : ''}
    <p class="est-dica">Com <b>${ic('sparkles','ic-3xs')}</b> o texto já existe — o clique leva até
      ele. Sem a marca, o clique <b>transcreve</b>, e o custo é mostrado antes. O botão acima
      <b>pula</b> os que já têm texto.</p>`
  const btn = el(_abTransAncora) || el('ab-trans-btn')
  if (btn) {
    const r = btn.getBoundingClientRect()
    // ⚠️ Preso à tela nos dois eixos: aberto por um botão lá embaixo, um painel
    // de 70vh sairia pela base. Sobe quando não couber.
    const alt = Math.min(innerHeight * 0.7, 460)
    const top = (r.bottom + 8 + alt > innerHeight) ? Math.max(8, r.top - alt - 8) : r.bottom + 8
    p.style.top = Math.round(top) + 'px'
    p.style.left = Math.round(Math.max(8, Math.min(r.left - 120, innerWidth - 340))) + 'px'
  }
}

// Só transcreve — não emenda a análise. Quem quiser as duas usa o outro painel.
async function abTransDoCapitulo(i) {
  const a = _abLivro; if (!a) return
  const antes = _abEstadoDoCap(a, i)
  if (i !== _abCap) { await _abCarregarCapitulo(i, 0); _abRenderPlayer() }
  _abAbaAtual = 'texto'
  el('ab-trans-painel')?.classList.remove('aberto')
  abAba('texto')
  if (antes.estado === 'vazio') await abTranscrever()
}

function abRaioXPainel() {
  const p = el('ab-raiox-painel')
  if (p && p.classList.contains('aberto')) { p.classList.remove('aberto'); return }
  _abRaioXPainelRender()
  el('ab-raiox-painel').classList.add('aberto')
}

function _abEstadoDoCap(a, i) {
  const tr = (a.transcricoes || []).find(x => x.cap === i)
  if (!tr) return { estado: 'vazio' }
  if (!tr.achados) return { estado: 'texto', falas: tr.segs.length }
  return { estado: 'pronto', n: tr.achados.length, falas: tr.segs.length }
}

function _abRaioXPainelRender(msg) {
  let p = el('ab-raiox-painel')
  if (!p) {
    p = document.createElement('div')
    p.id = 'ab-raiox-painel'
    p.className = 'ler-raiox-painel'
    p.addEventListener('click', e => e.stopPropagation())
    document.body.appendChild(p)
    setTimeout(() => document.addEventListener('click', () => p.classList.remove('aberto')), 0)
  }
  const a = _abLivro
  const caps = (a && a.capitulos) || []
  const prontos = caps.filter((_, i) => _abEstadoDoCap(a, i).estado === 'pronto').length
  p.innerHTML = `
    <div class="ler-raiox-topo">
      <b>${ic('eye','ic-sm')} O que é difícil aqui</b>
      <span>${prontos} de ${caps.length} ${caps.length === 1 ? 'capítulo' : 'capítulos'} analisados · nível ${esc(cefrNivelAluno())}</span>
    </div>
    ${msg ? `<div class="ler-raiox-msg">${esc(msg)}</div>` : ''}
    <div class="ler-raiox-lista">
      ${caps.map((c, i) => {
        const e2 = _abEstadoDoCap(a, i)
        return `<button class="ler-raiox-cap${i === _abCap ? ' atual' : ''}${e2.estado === 'pronto' ? ' feito' : ''}"
                  onclick="abRaioXDoCapitulo(${i})">
          <span class="ler-raiox-spark">${e2.estado === 'pronto' ? ic('sparkles','ic-sm') : ''}</span>
          <span class="ler-raiox-nome">${esc(c.titulo || `Capítulo ${i + 1}`)}</span>
          <span class="ler-raiox-n">${e2.estado === 'pronto' ? e2.n
            : e2.estado === 'texto' ? 'analisar' : 'transcrever'}</span>
        </button>`
      }).join('')}
    </div>
    <p class="est-dica">Com <b>${ic('sparkles','ic-3xs')}</b> já está analisado. Sem texto ainda, o
      clique <b>transcreve e analisa</b> — a transcrição tem custo de IA e é mostrado antes.</p>`
  const btn = el('ab-raiox-btn2')
  if (btn) {
    const r = btn.getBoundingClientRect()
    p.style.top = Math.round(r.bottom + 8) + 'px'
    p.style.left = Math.round(Math.max(8, Math.min(r.left - 120, innerWidth - 340))) + 'px'
  }
}

async function abRaioXDoCapitulo(i) {
  const a = _abLivro; if (!a) return
  const antes = _abEstadoDoCap(a, i)
  if (i !== _abCap) { await _abCarregarCapitulo(i, 0); _abRenderPlayer() }
  _abAbaAtual = 'texto'
  if (antes.estado === 'pronto') { el('ab-raiox-painel')?.classList.remove('aberto'); abAba('texto'); return }
  el('ab-raiox-painel')?.classList.remove('aberto')
  abAba('texto')
  if (antes.estado === 'vazio') {
    await abTranscrever()
    // Ele pode ter cancelado no aviso de custo: sem texto, não há o que analisar.
    if (_abEstadoDoCap(a, i).estado === 'vazio') return
  }
  await abAnalisarPassagem()
}

// A PROCEDÊNCIA DESTE CAPÍTULO, no MESMO formato que o chip grava no acervo
// (ver `abChipPreparar`) — é o casamento entre os dois que faz o raio-X
// reconhecer o que já saiu daqui.
function _abOrigemDoCap(a, i) {
  if (!a) return null
  const cap = (a.capitulos || [])[i] || {}
  return { source_title: a.title || '',
           source_context: cap.titulo ? `audiolivro · ${cap.titulo}` : 'audiolivro' }
}

// ---- O RAIO-X DA PASSAGEM: o que aqui está acima do meu nível ----
// ⚠️ ELE MOSTRA ONDE DÓI, e essa é a diferença para o que já existia. Traduzir
// diz o que a frase quer dizer; explicar diz por quê. Faltava a pergunta que
// vem antes das duas — *"não entendi, mas não sei o que me travou"*.
//
// O achado aparece em DOIS lugares ao mesmo tempo, de propósito:
//   · aceso DENTRO da fala, para o olho localizar sem procurar;
//   · como chip ABAIXO da fala (a ideia dele), com o sentido em português e o
//     clique que manda ao Preparar.
// Só o realce deixaria "o que é isso?" sem resposta; só a lista embaixo faria
// procurar a palavra no meio da linha. Juntos, um responde onde e o outro o quê.
async function abAnalisarPassagem() {
  const a = _abLivro; if (!a) return
  const cap = a.capitulos[_abCap]
  const au = _abAudio()
  const atual = Math.max(0, (au ? au.currentTime : 0) - (cap.ini || 0))
  const tr = abTransDoPonto(a, _abCap, atual) || (a.transcricoes || []).find(x => x.cap === _abCap)
  if (!tr) return
  if (!aiChatCfg().key) {
    toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error'); return
  }
  const btn = el('ab-raiox-btn')
  if (btn) { btn.disabled = true; btn.innerHTML = 'Analisando…' }
  try {
    const nivel = cefrNivelAluno()
    const achados = await aiAnalisarDificuldade({
      texto: tr.segs.map(x => x.t).join('\n'),
      lang: (a.lang || 'en').slice(0, 2), nivel,
      origem: _abOrigemDoCap(a, _abCap),
      // Capítulo longo vira várias chamadas: sem o andamento, a tela fica
      // parada por um minuto e parece travada.
      aoAndar: (i, n) => { if (btn && n > 1) btn.innerHTML = `Analisando ${i} de ${n}…` }
    })
    tr.achados = achados
    tr.achadosNivel = nivel
    a.updatedAt = Date.now()
    saveAudiolivros()
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
    abAba('texto')
    // ⚠️ "NADA ENCONTRADO" SÓ QUANDO A ANÁLISE INTEIRA DEU CERTO. Se algum
    // pedaço não voltou legível, dizer "nada acima do seu nível" é mentir —
    // foi exatamente o que aconteceu no capítulo de Carrie, que está cheio de
    // phrasal verbs e voltou dizendo que não tinha nenhum.
    toast(achados.length
      ? `${achados.length} ${achados.length === 1 ? 'ponto difícil' : 'pontos difíceis'} para o seu ${nivel}`
      : (achados.incompleto
          ? 'Parte da análise não voltou legível — vale rodar de novo'
          : `Nada acima do seu ${nivel} por aqui`),
      achados.length ? 'success' : (achados.incompleto ? 'warning' : 'info'))
  } catch (e) {
    console.warn('[audiobook] raio-x:', e)
    toast('Não consegui analisar: ' + e.message, 'error')
    abAba('texto')
  }
}

// Acende os achados dentro da fala. Trabalha por POSIÇÃO (nada de regex montada
// com o termo, que quebraria em "don't" ou "call it a day.") e do fim para o
// começo, para os índices do texto não mudarem embaixo do próximo recorte.
function _abFalaPintada(txt, achados) {
  if (!achados || !achados.length) return esc(txt)
  const marcas = []
  achados.forEach((x, idx) => {
    for (const oc of aiAcharNoTexto(txt, x.t)) marcas.push({ ...oc, idx, tipo: x.tipo, ja: x.ja })
  })
  if (!marcas.length) return esc(txt)
  marcas.sort((p, q) => p.i - q.i)
  // Sobreposição acontece ("put up" dentro de "put up with"): fica a mais longa.
  const limpas = []
  for (const m of marcas) {
    const ultima = limpas[limpas.length - 1]
    if (ultima && m.i < ultima.fim) {
      if (m.fim - m.i > ultima.fim - ultima.i) limpas[limpas.length - 1] = m
      continue
    }
    limpas.push(m)
  }
  let saida = '', de = 0
  for (const m of limpas) {
    saida += esc(txt.slice(de, m.i))
    // `data-i` (e não `data-idx`): é o nome que a peça compartilhada do chip lê,
    // em js/ai.js. Com dois nomes, o chip do audiolivro abria vazio.
    // Traço fraco no que já é dele, cheio no que é novidade — a mesma regra do
    // leitor. Sem isto, palavra já conhecida era sublinhada como descoberta.
    saida += `<mark class="ab-dif ab-dif-${m.tipo}${m.ja ? ' ab-dif-ja' : ''}" data-i="${m.idx}">${esc(txt.slice(m.i, m.fim))}</mark>`
    de = m.fim
  }
  return saida + esc(txt.slice(de))
}

// A transcrição que está na tela agora — usada pelas ações do chip.
function _abTransAtual() {
  const a = _abLivro; if (!a) return null
  const cap = a.capitulos[_abCap] || {}
  const au = _abAudio()
  const atual = Math.max(0, (au ? au.currentTime : 0) - (cap.ini || 0))
  return abTransDoPonto(a, _abCap, atual) || (a.transcricoes || []).find(x => x.cap === _abCap) || null
}

// "JÁ SEI ESTE SENTIDO" — o item some daqui e das próximas análises.
// ⚠️ Guarda o PAR (termo + sentido), nunca só a palavra: saber `ore` como "veio
// de mina" não pode esconder a passagem em que ela é "minério".
function abJaSei(mk) {
  const a = _abLivro; if (!a || !mk) return
  const tr = _abTransAtual()
  const idx = Number(mk.dataset.i)
  const item = tr && (tr.achados || [])[idx]
  if (!item) return
  if (typeof markKnownSense !== 'function' || !markKnownSense(item.t, item.pt)) {
    toast('Não consegui marcar este sentido.', 'error'); return
  }
  // Sai da lista guardada também: sem isto ele continuaria aceso nesta tela até
  // a próxima análise, e o clique pareceria não ter feito nada.
  tr.achados = (tr.achados || []).filter((_, i) => i !== idx)
  a.updatedAt = Date.now()
  saveAudiolivros()
  toast(`"${item.t}" (${item.pt}) marcado como conhecido`, 'success')
  abAba('texto')
}

// O chip vai ao Preparar com a FALA como contexto — é o mesmo caminho da
// seleção, então o item nasce igual ao que ele criaria à mão.
// A fala vem do próprio realce: `mark` está dentro de um `.ab-fala`, e é dela
// que sai o contexto do card. Antes o índice da fala vinha do HTML do chip
// fixo; agora vem de onde o mouse está.
function abChipPreparar(mk) {
  const a = _abLivro; if (!a || !mk) return
  const cap = a.capitulos[_abCap] || {}
  const tr = _abTransAtual()
  const idx = Number(mk.dataset.i)
  const item = tr && (tr.achados || [])[idx]
  const p = mk.closest('.ab-fala')
  const fala = tr && p ? tr.segs[Number(p.dataset.i)] : null
  if (!item || !fala) return
  if (typeof lexaChipParaPreparar !== 'function') return
  lexaChipParaPreparar(
    { expr: item.t, gloss: item.pt || '', type: item.tipo === 'word' ? 'word' : item.tipo },
    { contexto: fala.t, lang: (a.lang || 'en').slice(0, 2),
      source_type: 'audiobook', source_title: a.title || '',
      source_context: cap.titulo ? `audiolivro · ${cap.titulo}` : 'audiolivro' })
}

// Ligar o menu de seleção é o que faz "ouvir virar card": o mesmo gesto do
// livro e do dossiê, com a frase e a obra desta gravação.
// O chip do raio-X, com as mesmas duas saídas do leitor.
function _abLigarChips() {
  const box = el('ab-trans')
  if (!box || typeof difChipLigar !== 'function') return
  difChipLigar(box, {
    classe: 'dif-pop-app',
    item: mk => { const tr = _abTransAtual(); return tr ? (tr.achados || [])[Number(mk.dataset.i)] : null },
    preparar: mk => abChipPreparar(mk),
    jaSei: mk => abJaSei(mk)
  })
}

function _abLigarSelecao() {
  const box = el('ab-trans')
  if (!box || typeof selMenuAtivar !== 'function') return
  selMenuAtivar(box, no => {
    const a = _abLivro; if (!a) return {}
    const p = no && (no.nodeType === 1 ? no : no.parentElement)
    const fala = p && p.closest ? p.closest('.ab-fala') : null
    const frase = fala ? (fala.querySelector('span')?.textContent || '').trim() : ''
    const cap = a.capitulos[_abCap] || {}
    return {
      frase, lang: (a.lang || 'en').slice(0, 2), traduzir: true,
      fonte: [a.title, cap.titulo].filter(Boolean).join(' · '),
      origem: {
        source_type: 'audiobook',
        source_title: a.title || '',
        source_context: cap.titulo ? `audiolivro · ${cap.titulo}` : 'audiolivro'
      }
    }
  })
}

// A frase do marcador é texto como qualquer outro: marcar uma palavra ali
// manda ela ao Preparar igual à aba Texto. Seria estranho o contrário — a
// mesma frase virar card num lugar e não no outro.
function _abLigarSelecaoMarcas() {
  const box = el('ab-marcas')
  if (!box || typeof selMenuAtivar !== 'function') return
  selMenuAtivar(box, no => {
    const a = _abLivro; if (!a) return {}
    const p = no && (no.nodeType === 1 ? no : no.parentElement)
    const linha = p && p.closest ? p.closest('.ab-marca') : null
    const frase = linha ? (linha.querySelector('.ab-marca-frase')?.textContent || '').trim() : ''
    const capTitulo = linha ? (linha.querySelector('.ab-marca-ir span')?.textContent || '').trim() : ''
    return {
      frase, lang: (a.lang || 'en').slice(0, 2), traduzir: true,
      fonte: [a.title, capTitulo].filter(Boolean).join(' · '),
      origem: {
        source_type: 'audiobook',
        source_title: a.title || '',
        source_context: capTitulo ? `audiolivro · ${capTitulo}` : 'audiolivro'
      }
    }
  })
}

function abIrPara(seg) {
  const a = _abLivro, au = _abAudio(); if (!a || !au) return
  const cap = a.capitulos[_abCap]
  au.currentTime = (cap.ini || 0) + Math.max(0, seg)
  _abPintarProgresso()
  if (!_abQuerTocar) { _abQuerTocar = true; _abTocarSeguro() }
}

// O texto acompanha o áudio: a fala que está tocando fica acesa e se mantém à
// vista. É o que permite ouvir lendo — e é lendo que ele acha a palavra.
// ⚠️ A FALA QUE TOCA FICA NO CENTRO, e não "em algum lugar visível". Pedido
// dele, e a diferença é grande na prática: com o texto empurrado só até caber,
// a linha ativa vive no rodapé da caixa e o que vem A SEGUIR fica fora da
// vista — justamente o que o ouvido está prestes a receber. No centro, ele lê
// para os dois lados.
const AB_VOLTA_AO_CENTRO_MS = 5000
let _abRolouEm = 0        // quando ELE rolou por último

function _abAcompanharTexto() {
  const box = el('ab-trans'); if (!box || !_abLivro) return
  const au = _abAudio(); if (!au) return
  const cap = _abLivro.capitulos[_abCap]
  const t = au.currentTime - (cap.ini || 0)
  let ativa = null
  box.querySelectorAll('.ab-fala').forEach(p => {
    const dentro = t >= Number(p.dataset.ini) && t < Number(p.dataset.fim)
    p.classList.toggle('on', dentro)
    if (dentro) ativa = p
  })
  if (!ativa || _abArrastando) return
  // Ele mexeu no texto há pouco: a mão dele manda. Passados os 5 segundos, o
  // áudio volta a mandar — sem isso, quem sobe para reler uma frase é
  // arrastado de volta no meio da leitura.
  if (Date.now() - _abRolouEm < AB_VOLTA_AO_CENTRO_MS) return
  _abCentralizar(box, ativa)
}

function _abCentralizar(box, alvo) {
  const r = alvo.getBoundingClientRect(), c = box.getBoundingClientRect()
  const destino = box.scrollTop + (r.top - c.top) - (c.height / 2) + (r.height / 2)
  if (Math.abs(destino - box.scrollTop) < 4) return
  // ⚠️ SUAVE SÓ COM A PÁGINA À VISTA. A rolagem animada depende de o navegador
  // estar compondo quadros: em aba de segundo plano (ou num painel embutido
  // que não compõe) ela simplesmente não anda, e a fala nunca chega ao centro.
  // Com a aba escondida, o salto direto faz o trabalho — ninguém está vendo a
  // animação mesmo.
  const suave = document.visibilityState === 'visible'
  const ate = Math.max(0, destino)
  if (suave) box.scrollTo({ top: ate, behavior: 'smooth' })
  else box.scrollTop = ate
}

// Só o gesto DELE conta como rolagem manual. Escutar `scroll` puro não serve:
// ele dispara também na rolagem programática.
// ================================================================
// O MOUSE NO TEXTO PAUSA — e tirar o mouse volta a tocar
// ================================================================
// Pedido dele: *"ao passar o mouse sobre uma linha do texto o áudio deve
// pausar, pois posso querer ver o chip, selecionar texto e etc, e deve voltar a
// rodar ao afastar o mouse do texto."*
//
// O motivo é prático: quando ele para o olho numa palavra, o áudio segue e a
// fala acesa muda de linha embaixo dele — o texto foge enquanto ele lê. Levar
// o mouse até ali já é a declaração de "espera".
//
// ⚠️ TRÊS COISAS QUE NÃO PODEM ACONTECER NA VOLTA:
// 1. Retomar o que ELE pausou. Por isso a pausa por mouse tem trava própria
//    (`_abPausaHover`) e o listener de `pause` não zera a intenção de tocar —
//    mesmo desenho da virada de capítulo (`_abVirando`).
// 2. Voltar a tocar com o chip aberto. O chip mora no `body`, fora do texto:
//    ir até ele com o mouse é SAIR do texto, e o áudio voltaria bem na hora em
//    que ele foi ler a tradução.
// 3. Voltar com texto selecionado. Selecionar é o gesto mais claro de "estou
//    trabalhando nesta frase".
//
// Nos casos 2 e 3 a volta fica agendada, e tenta de novo — senão o áudio
// ficaria parado para sempre depois de um chip fechado longe do texto.
let _abPausaHover = false
let _abHoverTimer = null

function _abLigarHoverPausa(box) {
  if (!box || box._abHoverLigado) return
  box._abHoverLigado = true
  box.addEventListener('mouseenter', _abHoverEntrou)
  box.addEventListener('mouseleave', _abHoverSaiu)
}

function _abHoverEntrou() {
  clearTimeout(_abHoverTimer)
  const au = _abAudio()
  if (!au || au.paused || _abPausaHover) return
  _abPausaHover = true
  try { au.pause() } catch (e) {}
  _abPintarBotao()
}

function _abOcupado() {
  if (document.querySelector('.dif-pop')) return true          // chip aberto
  const sel = window.getSelection()
  return !!(sel && String(sel).trim() && !sel.isCollapsed)     // texto selecionado
}

function _abHoverSaiu() {
  if (!_abPausaHover) return
  clearTimeout(_abHoverTimer)
  if (_abOcupado()) { _abHoverTimer = setTimeout(_abHoverSaiu, 400); return }
  _abPausaHover = false
  _abTocarSeguro()
  _abPintarBotao()
}

// Qualquer decisão dele sobre tocar/pausar apaga a trava: a partir daí quem
// manda é ele, não o mouse.
function _abHoverLimpar() {
  _abPausaHover = false
  clearTimeout(_abHoverTimer)
}

function _abLigarRolagemManual(box) {
  if (!box || box._abRolagem) return
  box._abRolagem = true
  // ⚠️ SEM GUARDA DE "ROLAGEM AUTOMÁTICA" AQUI, e isso foi medido: com ela, um
  // gesto feito DURANTE a animação de centralização era descartado (o flag
  // ficava ligado por 700 ms) e o texto voltava ao centro por cima da mão dele
  // — exatamente o que estes 5 segundos existem para impedir. A guarda só faria
  // sentido se eu escutasse `scroll`, que a rolagem programática também
  // dispara; wheel, touch, pointer e teclas são SEMPRE gesto humano.
  const marcar = () => { _abRolouEm = Date.now() }
  box.addEventListener('wheel', marcar, { passive: true })
  box.addEventListener('touchmove', marcar, { passive: true })
  box.addEventListener('pointerdown', marcar, { passive: true })
  box.addEventListener('keydown', e => {
    if (/Arrow|Page|Home|End/.test(e.key)) marcar()
  })
}

// ================================================================
// TIPOGRAFIA DO TEXTO — a MESMA do livro, não uma cópia
// ================================================================
// Pedido dele: *"o modo de texto deve ter o mesmo botão 'Aa' pra configurar o
// texto. Lembra que eu disse que quero que o texto de audiobook se comporte
// igual o livro."*
//
// ⚠️ E "igual o livro" aqui é literal: a configuração é a MESMA (`cfg.ler`),
// não uma segunda cópia com os mesmos campos. Quem escolhe Sépia com 21px no
// leitor abre o audiolivro e encontra Sépia com 21px — e ajustar de um lado
// muda os dois. Duas configurações separadas seriam duas coisas para manter e,
// pior, duas respostas para a mesma pergunta ("como eu gosto de ler?").
//
// O painel é próprio (o do leitor mora em `js/ler.js`, pacote lazy de outra
// seção — chamá-lo daqui carregaria o leitor inteiro por causa de cinco
// controles), mas ele ESCREVE no mesmo lugar.
const AB_TEMAS = [
  { id: 'papel', nome: 'Papel', bg: '#f7f3ea', fg: '#2b2721' },
  { id: 'sepia', nome: 'Sépia', bg: '#e8dcc4', fg: '#3a3125' },
  { id: 'cinza', nome: 'Cinza', bg: '#d8d8d4', fg: '#26262a' },
  { id: 'noite', nome: 'Noite', bg: '#15181d', fg: '#c8ccd2' },
  { id: 'preto', nome: 'Preto', bg: '#000000', fg: '#a8adb4' }
]
const AB_TIPO_DEF = { tema: 'papel', fonte: 'serif', tamanho: 19, entrelinha: 1.7, largura: 34 }

function abTipoCfg() { return { ...AB_TIPO_DEF, ...(cfg.ler || {}) } }
function abTipoSet(chave, valor) {
  cfg.ler = { ...abTipoCfg(), ...(cfg.ler || {}), [chave]: valor }
  saveCfg()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  abTipoAplicar()
  _abRenderTipografia()
}

// Aplica no painel de texto. Fora do modo full a leitura é de consulta: só a
// fonte e o tamanho entram, e o fundo continua o do app — pintar a caixa de
// creme dentro da tela escura ficaria um remendo no meio do player.
function abTipoAplicar() {
  const box = el('ab-trans'); if (!box) return
  const c = abTipoCfg()
  const t = AB_TEMAS.find(x => x.id === c.tema) || AB_TEMAS[0]
  box.style.setProperty('--ab-fs', c.tamanho + 'px')
  box.style.setProperty('--ab-lh', c.entrelinha)
  box.style.setProperty('--ab-col', Math.round(c.largura * c.tamanho) + 'px')
  box.style.setProperty('--ab-ff', c.fonte === 'serif'
    ? "'Newsreader', Georgia, 'Times New Roman', serif"
    : "system-ui, -apple-system, 'Segoe UI', sans-serif")
  const full = document.body.classList.contains('ab-full')
  box.style.setProperty('--ler-bg', full ? t.bg : 'transparent')
  box.style.setProperty('--ler-fg', full ? t.fg : 'var(--text)')
  box.style.setProperty('--ler-fg2', full ? t.fg + 'a8' : 'var(--text2)')
  box.style.setProperty('--ler-mark', 'rgba(220,150,40,.30)')
}

function abTipografia() {
  const p = el('ab-tipo')
  if (p && p.classList.contains('aberto')) { p.classList.remove('aberto'); return }
  _abRenderTipografia()
  el('ab-tipo').classList.add('aberto')
}

function _abRenderTipografia() {
  let p = el('ab-tipo')
  if (!p) {
    p = document.createElement('div')
    p.id = 'ab-tipo'
    p.className = 'ab-tipo'
    p.addEventListener('click', e => e.stopPropagation())
    document.body.appendChild(p)
    setTimeout(() => document.addEventListener('click', () => p.classList.remove('aberto')), 0)
  }
  const c = abTipoCfg()
  const linha = (rot, campo, min, max, passo, sufixo) => `
    <div class="ab-tipo-linha">
      <span>${rot}</span>
      <button onclick="abTipoSet('${campo}', Math.max(${min}, +(${c[campo]} - ${passo}).toFixed(2)))">−</button>
      <b>${c[campo]}${sufixo || ''}</b>
      <button onclick="abTipoSet('${campo}', Math.min(${max}, +(${c[campo]} + ${passo}).toFixed(2)))">+</button>
    </div>`
  p.innerHTML = `
    <div class="ab-tipo-temas">
      ${AB_TEMAS.map(t => `<button class="ab-tipo-tema${c.tema === t.id ? ' on' : ''}"
        style="background:${t.bg};color:${t.fg}" onclick="abTipoSet('tema','${t.id}')"
        data-tip="${t.nome}">Aa</button>`).join('')}
    </div>
    <div class="ab-tipo-fontes">
      <button class="${c.fonte === 'serif' ? 'on' : ''}" onclick="abTipoSet('fonte','serif')" style="font-family:Georgia,serif">Serifada</button>
      <button class="${c.fonte === 'sans' ? 'on' : ''}" onclick="abTipoSet('fonte','sans')">Sem serifa</button>
    </div>
    ${linha('Tamanho', 'tamanho', 13, 30, 1, 'px')}
    ${linha('Entrelinha', 'entrelinha', 1.2, 2.4, 0.1, '')}
    ${linha('Largura', 'largura', 24, 64, 2, 'em')}
    <p class="est-dica">É a mesma configuração do leitor de livros — mudar aqui muda lá.</p>`
  // Posicionado sob o botão, e preso à tela quando não couber.
  const btn = el('ab-tipo-btn')
  if (btn) {
    const r = btn.getBoundingClientRect()
    p.style.top = Math.round(r.bottom + 8) + 'px'
    p.style.left = Math.round(Math.max(8, Math.min(r.right - 260, innerWidth - 268))) + 'px'
  }
}

// ================================================================
// MODO FULL DO TEXTO — "que se comporte igual o livro"
// ================================================================
// Pedido dele. A caixa de 420px dentro do player serve para consultar; para
// LER enquanto ouve, ela é pequena demais — e ler enquanto ouve é o que faz o
// audiolivro virar estudo. Em tela cheia o texto ganha coluna de leitura,
// tipografia serifada e o resto do app sai da frente, como no leitor de EPUB.
//
// ⚠️ O <audio> NÃO É TOCADO por isto: ele vive fora de `#ab-area` (ver o
// index.html) e o modo full só troca classes. Mover o elemento de mídia para
// dentro de um contêiner novo pararia o som no instante do clique.
function abTextoFull(ligar) {
  const quer = ligar === undefined ? !document.body.classList.contains('ab-full') : !!ligar
  document.body.classList.toggle('ab-full', quer)
  _abSetPref('full', quer)
  if (quer) document.addEventListener('keydown', _abFullTeclas)
  else document.removeEventListener('keydown', _abFullTeclas)
  // Recentraliza logo: entrar em tela cheia muda a altura da caixa, e a fala
  // ativa estaria no lugar errado.
  abTipoAplicar()
  el('ab-tipo')?.classList.remove('aberto')
  setTimeout(() => { _abRolouEm = 0; _abAcompanharTexto() }, 60)
}
function _abFullTeclas(e) {
  if (e.key === 'Escape') { e.preventDefault(); abTextoFull(false) }
}

// ================================================================
// MEDIDAS
// ================================================================
function abDuracao(a) {
  if (!a) return 0
  if (a.duracao > 0) return a.duracao
  return (a.capitulos || []).reduce((s, c) => s + Math.max(0, (c.fim || 0) - (c.ini || 0)), 0)
}
function abDurCap(c) { return Math.max(0, (c.fim || 0) - (c.ini || 0)) }
// Quanto do livro inteiro já passou, em segundos.
function abSegAbsoluto(a) {
  if (!a) return 0
  const caps = a.capitulos || []
  const i = Math.min(a.pos?.cap || 0, caps.length - 1)
  let s = 0
  for (let k = 0; k < i; k++) s += abDurCap(caps[k])
  return s + Math.max(0, a.pos?.seg || 0)
}
function abPct(a) {
  const d = abDuracao(a)
  return d > 0 ? Math.max(0, Math.min(1, abSegAbsoluto(a) / d)) : 0
}
function abTempo(seg) {
  seg = Math.max(0, Math.round(seg || 0))
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60
  const dd = n => String(n).padStart(2, '0')
  return h ? `${h}:${dd(m)}:${dd(s)}` : `${m}:${dd(s)}`
}
function abTempoLongo(seg) {
  seg = Math.max(0, Math.round(seg || 0))
  const h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60)
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`
  if (h) return `${h}h`
  return `${m} min`
}

// ================================================================
// O ÁUDIO NA NUVEM — subir, trazer de volta e liberar espaço
// ================================================================
// Pedido dele, palavra por palavra: *"atualmente o audiobook não é mandado pra
// nuvem, mas isso é necessário pq quero ter a capacidade de ouvir tanto no
// desktop quanto no celular com todo material gerado."*
//
// O resto já atravessava — capítulos, posição, marcadores, transcrição, raio-X.
// Só o áudio não, e sem ele nada disso serve no outro aparelho: abrir o livro no
// celular mostrava a estante e um aviso mandando importar o arquivo de novo.
//
// ⚠️ TRÊS DECISÕES QUE SUSTENTAM ISTO:
//
// 1. **Nunca automático.** O EPUB sobe sozinho porque tem 4 MB; um audiolivro
//    tem de 100 MB a 1 GB. Subir isso sem ele mandar seria gastar a franquia do
//    celular em segundo plano — então é sempre um clique consciente, com o
//    tamanho na tela ANTES de começar.
// 2. **Arquivo por arquivo, sob demanda.** Num livro em 40 faixas, chegar no
//    capítulo 12 baixa a faixa 12 (uns 30 MB), não o livro inteiro. Quem quiser
//    tudo de uma vez tem o botão para isso.
// 3. **Nuvem e aparelho são estados separados.** Estar na nuvem não obriga a
//    ocupar disco aqui; "liberar espaço" apaga o local e mantém o de lá. Por
//    isso a lista do que está no aparelho NUNCA sincroniza: ela é uma pergunta
//    ao IndexedDB desta máquina, e a resposta é diferente em cada uma.
const AB_NUVEM_AVISO_MB = 300     // acima disto, o aviso fica mais duro
// O teto que `storage.rules` define para a pasta dos audiolivros (2 GB). Está
// aqui só para AVISAR antes de tentar — quem manda é o servidor.
// ⚠️ Eu já errei este número uma vez: escrevi "50 MB" a partir do que o
// ESTADO-DO-PROJETO dizia, e a regra no ar era 500 MB. Por isso as regras
// passaram a morar no repositório (`storage.rules`) — o número deste arquivo e
// o do servidor agora saem do mesmo lugar.
const AB_NUVEM_TETO_MB = 2048

function abNuvemMB(bytes) {
  const mb = (bytes || 0) / 1048576
  if (mb >= 1024) return String(Math.round(mb / 1024 * 10) / 10).replace('.', ',') + ' GB'
  return Math.round(mb) + ' MB'
}

// O que está NESTE aparelho. Uma varredura das chaves, não N leituras: ler 40
// blobs de 30 MB só para saber se existem carregaria 1,2 GB na memória à toa.
async function abNoAparelho(id) {
  const pre = `ab:${id}:`
  const tem = {}
  for (const k of await BookDB.keys()) {
    if (typeof k !== 'string' || !k.startsWith(pre)) continue
    const n = Number(k.slice(pre.length))
    if (Number.isFinite(n)) tem[n] = true
  }
  return tem
}

function _abNuvemPartes(a) { return (a && a.nuvem && a.nuvem.partes) || {} }
function abNuvemCompleto(a) {
  const n = Math.max(1, (a && a.arquivos) || 0)
  const p = _abNuvemPartes(a)
  for (let i = 0; i < n; i++) if (!p[i]) return false
  return true
}

function _abNuvemGravar(a, n, bytes) {
  a.nuvem = a.nuvem || { partes: {} }
  a.nuvem.partes = { ...(a.nuvem.partes || {}), [n]: bytes || 1 }
  a.nuvem.em = Date.now()
  a.updatedAt = Date.now()
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}

// ---- O PAINEL: o que está onde, e o que dá para fazer ----
let _abNuvemPainelId = null

async function abNuvemPainel(id) {
  const a = audiolivroPorId(id); if (!a) return
  _abNuvemPainelId = id
  document.getElementById('ab-nuvem')?.remove()
  const ov = document.createElement('div')
  ov.id = 'ab-nuvem'; ov.className = 'srs-modal-overlay'
  ov.addEventListener('click', e => { if (e.target === ov && !abNuvemSubindo()) ov.remove() })
  ov.innerHTML = `<div class="srs-modal-box" style="width:100%;max-width:520px">
    <div id="ab-nuvem-corpo"><p class="est-dica">Vendo o que já está na sua nuvem…</p></div></div>`
  document.body.appendChild(ov)
  await _abNuvemRender(id)
}

async function _abNuvemRender(id, msg, pct) {
  const box = document.getElementById('ab-nuvem-corpo'); if (!box) return
  const a = audiolivroPorId(id); if (!a) return
  const total = Math.max(1, a.arquivos || 0)
  const aqui = await abNoAparelho(id)
  const nAqui = Object.keys(aqui).length

  // A verdade sobre a nuvem vem de LÁ, e não do registro salvo aqui: o registro
  // pode estar velho (subiu no celular) ou mentir (foi apagado por fora).
  let partes = _abNuvemPartes(a)
  if (msg == null) {
    const real = await abNuvemListar(id)
    if (Object.keys(real).length || Object.keys(partes).length) {
      partes = real
      a.nuvem = Object.keys(real).length ? { partes: real, em: Date.now() } : null
      a.updatedAt = Date.now()
      saveAudiolivros()
    }
  }
  const nNuvem = Object.keys(partes).length
  const bytesNuvem = Object.values(partes).reduce((t, b) => t + (Number(b) || 0), 0)

  const linha = (icone, titulo, valor, dica) => `
    <div class="ab-nuvem-linha">
      <span class="ab-nuvem-ic">${ic(icone, 'ic-sm')}</span>
      <span class="ab-nuvem-tit">${titulo}<em>${dica}</em></span>
      <b>${valor}</b>
    </div>`

  const ocupado = msg != null
  box.innerHTML = `
    <h4 style="font-size:var(--fs-base);font-weight:700;margin-bottom:4px">${esc(a.title || 'Audiolivro')}</h4>
    <p style="font-size:var(--fs-sm);color:var(--text2);margin-bottom:14px">
      Onde está o áudio deste livro — ${total === 1 ? 'um arquivo' : `${total} arquivos`}.</p>

    <div class="ab-nuvem-grade">
      ${linha('device', 'Neste aparelho', nAqui + ' de ' + total,
              nAqui === total ? 'toca na hora' : nAqui ? 'o resto baixa quando chegar lá' : 'nada guardado aqui')}
      ${linha('cloud', 'Na sua nuvem', nNuvem + ' de ' + total,
              nNuvem ? abNuvemMB(bytesNuvem) + ' guardados' : 'ainda não subiu')}
    </div>

    ${ocupado ? `<div class="ab-nuvem-prog">
      <p>${esc(msg)}</p>
      <div class="est-ficha-barra"><i style="width:${Math.round((pct || 0) * 100)}%;background:var(--role-energia)"></i></div>
      <button class="btn btn-ghost btn-sm" onclick="abNuvemCancelar()">Cancelar</button>
    </div>` : `
    <div class="ab-nuvem-acoes">
      ${nNuvem < total ? `<button class="btn btn-primary btn-sm" onclick="abNuvemGuardar('${id}')">
        ${ic('cloud','ic-sm')} Guardar na nuvem${nNuvem ? ' (o que falta)' : ''}</button>` : ''}
      ${nAqui < total && nNuvem > 0 ? `<button class="btn btn-ghost btn-sm" onclick="abNuvemTrazer('${id}')">
        ${ic('download','ic-sm')} Baixar tudo para cá</button>` : ''}
      ${nAqui > 0 && nNuvem >= total ? `<button class="btn btn-ghost btn-sm" onclick="abNuvemLiberar('${id}')">
        ${ic('trash','ic-sm')} Liberar espaço aqui</button>` : ''}
      ${nNuvem > 0 ? `<button class="btn btn-ghost btn-sm" onclick="abNuvemTirar('${id}')">Tirar da nuvem</button>` : ''}
    </div>
    <p class="est-dica">${nNuvem >= total
      ? 'Com o áudio na nuvem, abrir este livro em outro aparelho baixa só o capítulo que você for ouvir.'
      : 'Enquanto o áudio não subir, este livro só toca neste aparelho — a posição e os marcadores viajam mesmo assim.'}</p>`}

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-ghost btn-sm" ${ocupado ? 'disabled' : ''}
              onclick="document.getElementById('ab-nuvem').remove()">Fechar</button>
    </div>`
}

// ⚠️ A BARRA NÃO PODE REPINTAR O PAINEL INTEIRO. `_abNuvemRender` varre todas as
// chaves do IndexedDB e pergunta à nuvem o que já está lá — e o progresso de uma
// subida de 700 MB dispara dezenas de vezes por segundo. Enquanto anda, só o
// texto e a largura da barra mudam.
function _abNuvemAndar(msg, pct) {
  const box = document.getElementById('ab-nuvem-corpo'); if (!box) return
  const p = box.querySelector('.ab-nuvem-prog > p')
  const b = box.querySelector('.ab-nuvem-prog .est-ficha-barra > i')
  if (!p || !b) return
  p.textContent = msg
  b.style.width = Math.round((pct || 0) * 100) + '%'
}

// ---- SUBIR: UMA FILA QUE RODA EM SEGUNDO PLANO ----
// ⚠️ ANTES, A SUBIDA PRENDIA A TELA E A MEMÓRIA. Ele pediu segundo plano, e o
// pedido descobriu três defeitos reais da versão anterior:
//
// 1. **Todos os blobs iam para a memória de uma vez.** Um livro de 700 MB em 20
//    faixas ficava inteiro na RAM durante toda a subida — para nada, porque só
//    um arquivo sobe por vez. Agora cada blob é lido na sua vez e solto depois.
// 2. **O progresso morava dentro do painel.** Fechou o painel, acabou a
//    notícia: a subida continuava rodando às cegas. Agora existe um aviso
//    flutuante que acompanha ele por qualquer seção do app.
// 3. **"Não feche a aba" era só um pedido.** Fechar no meio matava o envio sem
//    dizer nada. Agora o navegador pergunta antes.
//
// ⚠️ O QUE NÃO DÁ PARA FAZER, E POR QUÊ: retomar um arquivo pela METADE depois
// de recarregar. O Storage tem upload retomável, mas o SDK não entrega o
// endereço da sessão para guardar — reimplementar o protocolo à mão seria
// trocar uma peça testada por uma nossa. O que sobrevive é a INTENÇÃO: ao
// voltar, o app sabe o que faltava, e arquivo inteiro que já subiu não repete.
const AB_FILA_SK = 'el-ab-fila'

let _abFila = []          // [{id, n}] — o que ainda falta subir
let _abFilaRodando = false
let _abFilaPausada = false
let _abFilaAtual = null   // {id, n, env, tot}

function _abFilaSalvar() {
  try { localStorage.setItem(AB_FILA_SK, JSON.stringify(_abFila.map(x => ({ id: x.id, n: x.n })))) }
  catch (e) {}
}

function _abFilaCarregar() {
  try { const v = JSON.parse(localStorage.getItem(AB_FILA_SK) || '[]'); return Array.isArray(v) ? v : [] }
  catch (e) { return [] }
}

// ---- o aviso flutuante, que segue ele pelo app ----
// ⚠️ DOIS TRABALHOS DE FUNDO PODEM RODAR JUNTOS — subir o áudio e transcrever
// o livro. Cada um com `position:fixed` no mesmo canto viraria um cartão em
// cima do outro. Uma caixa só, e o flex empilha.
function _abAvisos() {
  let cx = document.getElementById('ab-avisos')
  if (!cx) {
    cx = document.createElement('div')
    cx.id = 'ab-avisos'
    cx.className = 'ab-avisos'
    document.body.appendChild(cx)
  }
  return cx
}

function _abAvisosLimpar() {
  const cx = document.getElementById('ab-avisos')
  if (cx && !cx.children.length) cx.remove()
}

function _abFilaPintar() {
  let cx = document.getElementById('ab-fila')
  if (!_abFila.length && !_abFilaAtual) { if (cx) cx.remove(); _abAvisosLimpar(); return }
  if (!cx) {
    cx = document.createElement('div')
    cx.id = 'ab-fila'
    cx.className = 'ab-fila'
    _abAvisos().appendChild(cx)
  }
  const alvo = _abFilaAtual || _abFila[0]
  const a = alvo ? audiolivroPorId(alvo.id) : null
  // ⚠️ O item em curso CONTINUA em `_abFila[0]` — só sai depois de subir, para
  // que uma pausa o devolva inteiro. Somar `_abFilaAtual` aqui contava duas
  // vezes: com três arquivos o aviso dizia "+3 na fila" em vez de "+2".
  const restam = _abFila.length || (_abFilaAtual ? 1 : 0)
  const pct = _abFilaAtual && _abFilaAtual.tot ? _abFilaAtual.env / _abFilaAtual.tot : 0
  const linha = _abFilaPausada
    ? `Envio pausado — ${restam} ${restam === 1 ? 'arquivo' : 'arquivos'} restando`
    : _abFilaAtual
      ? `${abNuvemMB(_abFilaAtual.env)} de ${abNuvemMB(_abFilaAtual.tot)}${restam > 1 ? ` · +${restam - 1} na fila` : ''}`
      : `${restam} ${restam === 1 ? 'arquivo' : 'arquivos'} na fila`
  cx.innerHTML = `
    <div class="ab-fila-topo">
      <span class="ab-fila-ic">${ic('cloud', 'ic-sm')}</span>
      <div class="ab-fila-txt">
        <b>${esc((a && a.title) || 'Audiolivro')}</b>
        <em>${esc(linha)}</em>
      </div>
      <button class="ab-fila-x" data-tip="${_abFilaPausada ? 'Continuar' : 'Pausar'}"
              onclick="abFilaPausar()">${ic(_abFilaPausada ? 'play' : 'pause', 'ic-3xs')}</button>
      <button class="ab-fila-x" data-tip="Cancelar o envio"
              onclick="abFilaCancelar()">${ic('x', 'ic-3xs')}</button>
    </div>
    <div class="ab-fila-barra"><i style="width:${Math.round(pct * 100)}%"></i></div>`
}

// ⚠️ O navegador só deixa AVISAR, não impedir. Ainda assim é melhor que um
// envio de 700 MB morrer em silêncio porque ele fechou a aba sem saber.
function _abFilaSair(e) {
  // Vale para os DOIS trabalhos de fundo: fechar no meio de uma transcrição
  // longa joga fora o capítulo em andamento, que já foi pago.
  const ocupado = _abFila.length || _abFilaAtual ||
                  (typeof _abTr !== 'undefined' && (_abTr.length || _abTrAtual))
  if (!ocupado) return
  e.preventDefault()
  e.returnValue = ''
  return ''
}
window.addEventListener('beforeunload', _abFilaSair)

function abFilaPausar() {
  _abFilaPausada = !_abFilaPausada
  if (_abFilaPausada) {
    // Nada a devolver: o item em curso nunca saiu de `_abFila[0]`, e é por isso
    // que ele volta INTEIRO. Metade de arquivo não vale nada — o Storage não
    // guarda o pedaço.
    abNuvemCancelar()
    _abFilaSalvar()
    _abFilaPintar()
  } else {
    _abFilaPintar()
    _abFilaRodar()
  }
}

async function abFilaCancelar() {
  const ok = await confirmModal({
    title: 'Cancelar o envio', icon: 'cloud', confirmText: 'Cancelar o envio',
    cancelText: 'Continuar enviando', danger: true,
    html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
      Os arquivos que já subiram <b>ficam na nuvem</b> e não sobem de novo. Só o que ainda faltava
      é descartado — dá para retomar depois pelo ícone de nuvem no card.</p>`
  })
  if (!ok) return
  _abFila = []
  _abFilaPausada = false
  abNuvemCancelar()
  _abFilaSalvar()
  _abFilaPintar()
}

// O motor. Um arquivo por vez, de propósito: seis de 30 MB em paralelo entopem
// a subida de quem está no 4G e fazem a barra andar em pulos.
async function _abFilaRodar() {
  if (_abFilaRodando || _abFilaPausada) return
  _abFilaRodando = true
  let subiuAlgo = false
  try {
    while (_abFila.length && !_abFilaPausada) {
      const item = _abFila[0]
      const a = audiolivroPorId(item.id)
      // Livro removido enquanto a fila andava: descarta e segue.
      if (!a) { _abFila.shift(); _abFilaSalvar(); continue }
      // Já está lá (subiu no outro aparelho, ou nesta mesma fila): não repete.
      if (_abNuvemPartes(a)[item.n]) { _abFila.shift(); _abFilaSalvar(); continue }
      // ⚠️ O blob é lido AGORA, e não no enfileiramento: guardar 20 faixas de
      // 30 MB na memória enquanto sobem uma a uma seria 600 MB parados à toa.
      const blob = await BookDB.get(abChaveArquivo(item.id, item.n))
      if (!blob) { _abFila.shift(); _abFilaSalvar(); continue }

      _abFilaAtual = { id: item.id, n: item.n, env: 0, tot: blob.size }
      _abFilaPintar()
      try {
        await abNuvemSubirArquivo(item.id, item.n, blob, (env, tot) => {
          _abFilaAtual.env = env; _abFilaAtual.tot = tot
          _abFilaPintar()
          _abNuvemAndar(`Enviando ${abNuvemMB(env)} de ${abNuvemMB(tot)}`, tot ? env / tot : 0)
        })
        _abNuvemGravar(a, item.n, blob.size)
        _abFila.shift()
        _abFilaSalvar()
        subiuAlgo = true
        _abFilaAtual = null
      } catch (e) {
        const c = String(e.code || e.message || '')
        _abFilaAtual = null
        if (c.includes('canceled')) break     // pausa ou cancelamento já ajustaram a fila
        _abFila = []; _abFilaSalvar()
        if (c.includes('sem-login')) toast('Entre com o Google para guardar na nuvem.', 'warning')
        else if (c.includes('unauthorized')) _abNuvemAvisoTeto(blob.size)
        else if (c.includes('quota') || c.includes('retry-limit')) toast('Sua nuvem recusou o envio (espaço ou tempo esgotado). Tente de novo.', 'error')
        else toast('O envio falhou: ' + c, 'error')
        break
      }
    }
    if (subiuAlgo && !_abFila.length && !_abFilaPausada) {
      toast('Áudio guardado na nuvem. Já dá para ouvir em outro aparelho.', 'success')
    }
  } finally {
    _abFilaRodando = false
    _abFilaAtual = null
    _abFilaPintar()
    if (document.getElementById('ab-nuvem-corpo') && _abNuvemPainelId) _abNuvemRender(_abNuvemPainelId)
    renderAudiobookSection()
  }
}

async function abNuvemGuardar(id) {
  const a = audiolivroPorId(id); if (!a) return
  const total = Math.max(1, a.arquivos || 0)
  const partes = _abNuvemPartes(a)
  const faltam = []
  let bytes = 0, maior = 0
  for (let n = 0; n < total; n++) {
    if (partes[n]) continue
    // Aqui só interessa o TAMANHO; o conteúdo é lido na hora de subir.
    const b = await BookDB.get(abChaveArquivo(id, n))
    if (!b) continue
    faltam.push({ id, n })
    bytes += b.size
    maior = Math.max(maior, b.size)
  }
  if (!faltam.length) {
    toast('Não há nada aqui para subir — o que falta na nuvem também não está neste aparelho.', 'warning')
    return
  }

  const mb = bytes / 1048576
  const ok = await confirmModal({
    title: 'Guardar o áudio na nuvem', icon: 'cloud', confirmText: 'Guardar',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
      Vou enviar <b>${abNuvemMB(bytes)}</b>${faltam.length > 1 ? ` em ${faltam.length} arquivos` : ''}
      para a sua nuvem. Depois disso, este livro abre e toca em qualquer aparelho seu.<br><br>
      ${mb > AB_NUVEM_AVISO_MB ? `<b>É bastante coisa.</b> Numa conexão móvel isso pesa na franquia —
        vale fazer no Wi-Fi. ` : ''}O envio roda <b>em segundo plano</b>: pode fechar esta janela e
      seguir usando o app, que um aviso no canto mostra o andamento e deixa pausar.<br><br>
      ${maior > AB_NUVEM_TETO_MB * 1048576 ? `<b>Aviso:</b> o maior arquivo aqui tem
        ${abNuvemMB(maior)} e sua nuvem aceita <b>${AB_NUVEM_TETO_MB / 1024} GB</b> por arquivo —
        este vai ser recusado.<br><br>` : ''}
      Só não <b>feche a aba</b>: o arquivo que estiver a meio caminho recomeça.</p>`
  })
  if (!ok) return

  for (const f of faltam) if (!_abFila.some(x => x.id === f.id && x.n === f.n)) _abFila.push(f)
  _abFilaPausada = false
  _abFilaSalvar()
  _abFilaPintar()
  document.getElementById('ab-nuvem')?.remove()   // o aviso flutuante assume daqui
  _abFilaRodar()
}

// ================================================================
// TRANSCREVER O LIVRO INTEIRO — em segundo plano, pulando o que já tem
// ================================================================
// Pedido dele: *"a transcrição deve ter uma opção de transcrever tudo. E se
// tiver capítulos transcritos o botão vai pular eles."*
//
// ⚠️ PULAR NÃO É DETALHE, É O CORAÇÃO DISTO. Cada capítulo já transcrito que
// fosse refeito seria dinheiro gasto duas vezes pela mesma coisa — e o mais
// provável é que ele já tenha transcrito alguns à mão antes de pedir o resto.
// A conta do aviso é feita só sobre o que FALTA.
//
// Roda como a fila de subida, e pelo mesmo motivo: um livro de doze horas leva
// muito tempo, e prender a tela nisso seria transformar uma tarefa do app numa
// vigília dele.
let _abTr = []            // [{id, cap}] — capítulos a transcrever
let _abTrRodando = false
let _abTrPausada = false
let _abTrAtual = null     // {id, cap, msg}
let _abTrFeitos = 0
let _abTrFalhas = []

function _abTrPintar() {
  let cx = document.getElementById('ab-trfila')
  if (!_abTr.length && !_abTrAtual) { if (cx) cx.remove(); _abAvisosLimpar(); return }
  if (!cx) {
    cx = document.createElement('div')
    cx.id = 'ab-trfila'
    cx.className = 'ab-fila'
    _abAvisos().appendChild(cx)
  }
  const a = _abLivro
  const restam = _abTr.length || (_abTrAtual ? 1 : 0)
  const total = _abTrFeitos + restam
  const cap = _abTrAtual && a ? (a.capitulos[_abTrAtual.cap] || {}) : null
  const linha = _abTrPausada
    ? `Pausado — ${restam} ${restam === 1 ? 'capítulo' : 'capítulos'} restando`
    : _abTrAtual
      ? `${esc(cap.titulo || 'Capítulo ' + (_abTrAtual.cap + 1))} — ${esc(_abTrAtual.msg || 'transcrevendo…')}`
      : `${restam} na fila`
  cx.innerHTML = `
    <div class="ab-fila-topo">
      <span class="ab-fila-ic">${ic('captions','ic-sm')}</span>
      <div class="ab-fila-txt">
        <b>Transcrevendo ${_abTrFeitos + (_abTrAtual ? 1 : 0)} de ${total}</b>
        <em>${linha}</em>
      </div>
      <button class="ab-fila-x" data-tip="${_abTrPausada ? 'Continuar' : 'Pausar'}"
              onclick="abTrPausar()">${ic(_abTrPausada ? 'play' : 'pause','ic-3xs')}</button>
      <button class="ab-fila-x" data-tip="Parar de transcrever"
              onclick="abTrCancelar()">${ic('x','ic-3xs')}</button>
    </div>
    <div class="ab-fila-barra"><i style="width:${total ? Math.round(_abTrFeitos / total * 100) : 0}%"></i></div>`
}

// ⚠️ A pausa só vale ENTRE capítulos. O que já está no ar não dá para
// desfazer: a chamada foi paga no instante em que saiu. Parar no meio jogaria
// fora um capítulo já cobrado — melhor terminar este e não começar o próximo.
function abTrPausar() {
  _abTrPausada = !_abTrPausada
  _abTrPintar()
  if (!_abTrPausada) _abTrRodar()
  else toast('Vou parar depois de terminar este capítulo — o que já foi pedido à IA não dá para cancelar.', 'info')
}

async function abTrCancelar() {
  const ok = await confirmModal({
    title: 'Parar de transcrever', icon: 'captions', confirmText: 'Parar',
    cancelText: 'Continuar', danger: true,
    html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
      Os capítulos já transcritos <b>ficam guardados</b> e não são refeitos. O capítulo em
      andamento termina — ele já foi pedido à IA e cancelar não devolve o custo.</p>`
  })
  if (!ok) return
  _abTr = []
  _abTrPausada = false
  _abTrPintar()
}

async function _abTrRodar() {
  if (_abTrRodando || _abTrPausada) return
  _abTrRodando = true
  try {
    while (_abTr.length && !_abTrPausada) {
      const item = _abTr[0]
      const a = audiolivroPorId(item.id)
      if (!a) { _abTr.shift(); continue }
      // Alguém transcreveu enquanto a fila andava (outro aparelho, ou o botão
      // do capítulo): não repete, não cobra de novo.
      if (_abEstadoDoCap(a, item.cap).estado !== 'vazio') { _abTr.shift(); _abTrFeitos++; _abTrPintar(); continue }
      _abTrAtual = { id: item.id, cap: item.cap, msg: 'começando…' }
      _abTrPintar()
      try {
        await _abTranscreverTrecho(a, item.cap, _abAlvoInteiro(a, item.cap), m => {
          if (_abTrAtual) { _abTrAtual.msg = m; _abTrPintar() }
        })
        _abTrFeitos++
      } catch (e) {
        // ⚠️ UM CAPÍTULO QUE FALHA NÃO PODE MATAR A FILA. Áudio mudo, rede que
        // caiu, um trecho que a IA recusou — o resto do livro continua, e no
        // fim ele fica sabendo exatamente quais ficaram para trás.
        const nome = (a.capitulos[item.cap] || {}).titulo || `Capítulo ${item.cap + 1}`
        _abTrFalhas.push(nome + ': ' + String(e && e.message || e))
        console.warn('[audiobook] transcrever tudo:', nome, e)
      }
      _abTr.shift()
      _abTrAtual = null
      _abTrPintar()
      if (_abLivro && _abLivro.id === item.id && _abAbaAtual === 'texto') abAba('texto')
    }
  } finally {
    _abTrRodando = false
    _abTrAtual = null
    if (!_abTr.length) {
      const falhas = _abTrFalhas.slice()
      const feitos = _abTrFeitos
      _abTrFeitos = 0; _abTrFalhas = []
      _abTrPintar()
      if (feitos || falhas.length) {
        toast(falhas.length
          ? `${feitos} ${feitos === 1 ? 'capítulo transcrito' : 'capítulos transcritos'} · ${falhas.length} ${falhas.length === 1 ? 'falhou' : 'falharam'}`
          : `${feitos} ${feitos === 1 ? 'capítulo transcrito' : 'capítulos transcritos'}`,
          falhas.length ? 'warning' : 'success')
      }
      if (falhas.length) {
        confirmModal({
          title: 'Estes capítulos não deram certo', icon: 'alert', confirmText: 'Entendi', cancelText: '',
          html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
            O resto do livro foi transcrito normalmente. Estes você pode tentar de novo pelo painel
            de transcrição, um a um:</p>
            <ul style="font-size:var(--fs-sm);color:var(--text2);margin:10px 0 0 18px">
              ${falhas.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`
        })
      }
    } else _abTrPintar()
    if (document.getElementById('ab-trans-painel')?.classList.contains('aberto')) _abTransPainelRender()
  }
}

// ⚠️ "LEVA UM BOM TEMPO" NÃO ERA AVISO, ERA VAGUEZA — e o acervo real mostrou
// o tamanho da conta: o Billy Summers dele tem 200 capítulos, 197 sem texto.
// São 197 idas à IA em sequência, uma esperando a outra. Barato (R$ 3,43) e
// LONGO: quem lê "um bom tempo" pensa em minutos, não em horas com a aba
// aberta. Meio minuto por capítulo é a conta grosseira de extrair o áudio,
// enviar e receber — erra para mais ou para menos, mas dá a ordem de grandeza,
// que é o que falta para ele decidir se começa agora ou à noite.
function _abTempoDaFila(n) {
  const min = Math.round(n * 0.5)
  if (min < 3) return 'poucos minutos'
  if (min < 90) return `cerca de ${min} min`
  // Horas e minutos, como se fala: "1h30", "3h". Escrever "3,5 horas" já me
  // custou um "uma boa 3,5 horas" na primeira versão — número decimal não
  // combina com frase.
  const h = Math.floor(min / 60)
  const m = Math.round((min - h * 60) / 30) * 30      // meia hora mais próxima
  const txt = m === 60 ? `${h + 1}h` : m ? `${h}h${m}` : `${h}h`
  return `cerca de ${txt} — vale deixar rodando`
}

async function abTranscreverTudo() {
  const a = _abLivro; if (!a) return
  const stt = typeof aiSttCfg === 'function' ? aiSttCfg() : null
  if (!stt) { toast('Configure a chave da Groq ou da OpenAI para transcrever (Configurações → IA)', 'error'); return }

  const faltam = [], grandes = []
  let minutos = 0
  for (let i = 0; i < (a.capitulos || []).length; i++) {
    if (_abEstadoDoCap(a, i).estado !== 'vazio') continue     // já tem texto: pula
    const alvo = _abAlvoInteiro(a, i)
    if (alvo.minutos > AB_TRANS_TETO_MIN) { grandes.push((a.capitulos[i] || {}).titulo || `Capítulo ${i + 1}`); continue }
    faltam.push({ id: a.id, cap: i }); minutos += alvo.minutos
  }
  const jaTem = (a.capitulos || []).length - faltam.length - grandes.length

  if (!faltam.length) {
    toast(grandes.length
      ? `Nada a transcrever — só sobraram capítulos longos demais (${grandes.length}).`
      : 'Todos os capítulos já têm texto.', 'info')
    return
  }

  const usd = minutos * stt.usdMin
  const brl = typeof aiUsdBrl === 'function' ? await aiUsdBrl().catch(() => 5.5) : 5.5
  const ok = await confirmModal({
    title: 'Transcrever o livro inteiro', icon: 'captions', confirmText: 'Transcrever',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
      Vou transcrever <b>${faltam.length} ${faltam.length === 1 ? 'capítulo' : 'capítulos'}</b> —
      cerca de <b>${Math.round(minutos)} min</b> de áudio.
      ${jaTem ? `Os <b>${jaTem}</b> que já têm texto ficam como estão: não são refeitos nem cobrados de novo.` : ''}
      <br><br>
      Custa cerca de <b>${(usd * brl).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
      na ${esc(stt.nome)}, e leva <b>${_abTempoDaFila(faltam.length)}</b> — roda <b>em segundo
      plano</b>, com um aviso no canto que deixa pausar. Só não feche a aba.
      ${grandes.length ? `<br><br><b>${grandes.length} ${grandes.length === 1 ? 'capítulo fica' : 'capítulos ficam'} de fora</b>
        por passar de ${AB_TRANS_TETO_MIN} min (${esc(grandes.slice(0, 3).join(', '))}${grandes.length > 3 ? '…' : ''}) —
        nesses, use o botão do capítulo, que pega o trecho em volta de onde você está.` : ''}</p>`
  })
  if (!ok) return

  for (const f of faltam) if (!_abTr.some(x => x.id === f.id && x.cap === f.cap)) _abTr.push(f)
  _abTrPausada = false
  _abTrFeitos = 0; _abTrFalhas = []
  document.getElementById('ab-trans-painel')?.classList.remove('aberto')
  _abTrPintar()
  _abTrRodar()
}

// ⚠️ RETOMAR NÃO É AUTOMÁTICO. A aba pode ter fechado por qualquer motivo, e
// recomeçar 700 MB sozinho — talvez no 4G — seria decidir pelo bolso dele. O
// que fica é a fila PAUSADA, com o botão de continuar à vista.
function abFilaRetomarPendencias() {
  if (_abFila.length || _abFilaRodando) return
  const guardada = _abFilaCarregar().filter(x => {
    const a = audiolivroPorId(x.id)
    return a && !_abNuvemPartes(a)[x.n]
  })
  if (!guardada.length) { try { localStorage.removeItem(AB_FILA_SK) } catch (e) {} ; return }
  _abFila = guardada
  _abFilaPausada = true
  _abFilaSalvar()
  _abFilaPintar()
}

// ---- TRAZER DE VOLTA ----
// Um arquivo só, com barra. É a peça que `abAbrir` e a troca de capítulo usam:
// quem chega num aparelho novo não precisa saber que existe download nenhum.
async function _abTrazerArquivo(id, n, pintar) {
  const blob = await abNuvemBaixarArquivo(id, n, (lidos, tot) => {
    if (pintar) pintar(`Baixando ${abNuvemMB(lidos)}${tot ? ' de ' + abNuvemMB(tot) : ''}…`, tot ? lidos / tot : null)
  })
  await BookDB.set(abChaveArquivo(id, n), blob)
  return blob
}

async function abNuvemTrazer(id) {
  const a = audiolivroPorId(id); if (!a) return
  const total = Math.max(1, a.arquivos || 0)
  const aqui = await abNoAparelho(id)
  const partes = _abNuvemPartes(a)
  const faltam = []
  for (let n = 0; n < total; n++) if (!aqui[n] && partes[n]) faltam.push(n)
  if (!faltam.length) { toast('Já está tudo neste aparelho.', 'info'); return }
  await _abNuvemRender(id, 'Começando o download…', 0)
  try {
    let feitos = 0
    for (const n of faltam) {
      await _abTrazerArquivo(id, n, (m, pct) => {
        const geral = (feitos + (pct || 0)) / faltam.length
        _abNuvemAndar(faltam.length > 1 ? `${feitos + 1} de ${faltam.length} — ${m}` : m, geral)
      })
      feitos++
    }
    toast('Áudio baixado. Toca sem internet a partir de agora.', 'success')
  } catch (e) {
    toast('O download falhou: ' + String(e.code || e.message || ''), 'error')
  }
  await _abNuvemRender(id)
  renderAudiobookSection()
}

// ---- LIBERAR ESPAÇO ----
// ⚠️ Só aparece com TUDO na nuvem. Apagar o local com metade lá em cima seria
// destruir a única cópia da outra metade.
async function abNuvemLiberar(id) {
  const a = audiolivroPorId(id); if (!a) return
  // ⚠️ Apagar daqui enquanto a fila ainda lê estes arquivos destruiria a fonte
  // do que está subindo — e o envio morreria no meio sem explicação.
  if (_abFila.some(x => x.id === id) || (_abFilaAtual && _abFilaAtual.id === id)) {
    toast('Este livro ainda está sendo enviado. Espere terminar para liberar o espaço.', 'warning')
    return
  }
  if (!abNuvemCompleto(a)) { toast('Guarde tudo na nuvem antes de liberar o espaço daqui.', 'warning'); return }
  const total = Math.max(1, a.arquivos || 0)
  const aqui = await abNoAparelho(id)
  let bytes = 0
  for (const n of Object.keys(aqui)) {
    const b = await BookDB.get(abChaveArquivo(id, n)); if (b) bytes += b.size
  }
  const ok = await confirmModal({
    title: 'Liberar espaço neste aparelho', icon: 'trash', confirmText: 'Liberar', danger: true,
    html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
      Apagar <b>${abNuvemMB(bytes)}</b> de áudio <b>daqui</b>. A cópia da nuvem fica intacta, e o
      livro continua abrindo — o capítulo que você tocar baixa na hora.<br><br>
      Sua posição, seus marcadores e as transcrições <b>não</b> são tocados.</p>`
  })
  if (!ok) return
  if (_abLivro && _abLivro.id === id) abFechar()
  for (const n of Object.keys(aqui)) await BookDB.del(abChaveArquivo(id, n))
  toast(`${abNuvemMB(bytes)} liberados neste aparelho.`, 'success')
  await _abNuvemRender(id)
  renderAudiobookSection()
}

// ---- TIRAR DA NUVEM ----
async function abNuvemTirar(id) {
  const a = audiolivroPorId(id); if (!a) return
  const total = Math.max(1, a.arquivos || 0)
  const aqui = await abNoAparelho(id)
  const soLa = Object.keys(aqui).length < total
  const ok = await confirmModal({
    title: 'Tirar o áudio da nuvem', icon: 'cloud', confirmText: 'Tirar', danger: true,
    html: `<p style="font-size:var(--fs-sm);color:var(--text2);line-height:1.65">
      Apagar a cópia da nuvem. O livro continua tocando em qualquer aparelho que já tenha o
      arquivo — mas para de tocar nos outros.
      ${soLa ? `<br><br><b>Atenção:</b> parte deste áudio <b>só existe na nuvem</b> — este aparelho
        não tem tudo. Tirando de lá, essa parte se perde.` : ''}</p>`
  })
  if (!ok) return
  const n = await abNuvemApagar(id, total)
  a.nuvem = null
  a.updatedAt = Date.now()
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast(n ? 'Áudio removido da nuvem.' : 'Não havia nada na nuvem para remover.', 'info')
  await _abNuvemRender(id)
  renderAudiobookSection()
}

// ---- A PONTE: garantir o arquivo antes de tocar ----
// Chamada por quem vai USAR o áudio. Devolve o blob, baixando se precisar — e
// diz em português por que não deu, em vez do antigo "importe de novo" que valia
// para tudo (inclusive para quem só estava deslogado).
async function abGarantirArquivo(a, n, pintar) {
  const jaTem = await BookDB.get(abChaveArquivo(a.id, n))
  if (jaTem) return jaTem
  if (!_abNuvemPartes(a)[n]) {
    const d = await abNuvemPorQueNaoVeio(a.id, n)
    if (d.estado !== 'existe') { toast(nuvemFrase(d, 'o áudio deste livro'), 'warning'); return null }
  }
  try {
    return await _abTrazerArquivo(a.id, n, pintar)
  } catch (e) {
    const d = await abNuvemPorQueNaoVeio(a.id, n)
    toast(nuvemFrase(d, 'o áudio deste livro'), 'error')
    return null
  }
}

// ================================================================
// ABRIR E FECHAR
// ================================================================
async function abAbrir(id) {
  const a = audiolivroPorId(id); if (!a) return
  // Item que entrou pelo catálogo ainda não tem o que tocar: o clique vira o
  // convite para anexar, e não um erro.
  if (!a.arquivos || !(a.capitulos || []).length) { abAnexarArquivo(id); return }
  // ⚠️ AQUI ESTAVA O FIM DA LINHA. Antes desta versão, abrir um audiolivro cujo
  // áudio não estivesse NESTE aparelho dava um aviso e parava — porque o áudio
  // não subia para lugar nenhum. Agora ele pode estar na nuvem, e o primeiro
  // arquivo desce sozinho, com barra: o download não é uma tarefa dele.
  const cap0 = (a.capitulos || [])[0] || { arq: 0 }
  let primeiro = await BookDB.get(abChaveArquivo(id, cap0.arq || 0))
  if (!primeiro) {
    _abPintarBaixando(a, 'Procurando o áudio na sua nuvem…', null)
    primeiro = await abGarantirArquivo(a, cap0.arq || 0, (m, pct) => _abPintarBaixando(a, m, pct))
    if (!primeiro) { renderAudiobookSection(); return }
  }
  _abLivro = a
  _abCap = Math.min(a.pos?.cap || 0, (a.capitulos || []).length - 1)
  _abArqAtual = -1
  _abInicioSessao = Date.now()
  if (typeof ondeEstavaSalvar === 'function') ondeEstavaSalvar()
  a.lastOpen = Date.now()
  if (a.status === 'quero') a.status = 'ouvindo'
  saveAudiolivros()
  renderAudiobookSection()
  await _abCarregarCapitulo(_abCap, a.pos?.seg || 0)
  document.addEventListener('keydown', _abTeclas)
}

// A tela do download, na área da estante. Não é modal de propósito: ele pode ir
// fazer outra coisa no app enquanto os 40 MB chegam.
function _abPintarBaixando(a, msg, pct) {
  const area = el('ab-area'); if (!area) return
  area.innerHTML = `<div class="est-nada" style="padding:56px 20px">
    ${ic('cloud','ic-xl')}
    <p><b>${esc(a.title || 'Audiolivro')}</b></p>
    <p>${esc(msg)}</p>
    <div class="est-ficha-barra" style="width:300px"><i style="width:${Math.round((pct || 0) * 100)}%;background:var(--role-energia)"></i></div>
    <p class="est-dica">O áudio está na sua nuvem e está vindo para este aparelho. Da próxima vez
      ele abre na hora.</p></div>`
}

function abFechar() {
  _abHoverLimpar()
  _abQuerTocar = false
  _abAbaAtual = 'capitulos'
  if (document.body.classList.contains('ab-full')) abTextoFull(false)
  _abRegistrarTempo()
  _abSalvarPos(true)
  const au = _abAudio()
  if (au) { try { au.pause() } catch (e) {} }
  if (_abUrl) { try { URL.revokeObjectURL(_abUrl) } catch (e) {} _abUrl = '' }
  if (au) au.removeAttribute('src')
  _abArqAtual = -1
  _abLivro = null
  abSonoCancelar()
  document.removeEventListener('keydown', _abTeclas)
  renderAudiobookSection()
}

async function abExcluir(id) {
  const a = audiolivroPorId(id); if (!a) return
  // ⚠️ Remover daqui NÃO pode deixar lixo pago na nuvem: o item some da estante
  // em todos os aparelhos (a lista sincroniza), e sem o item ninguém mais teria
  // como chegar naqueles arquivos para apagá-los.
  const naNuvem = Object.keys(_abNuvemPartes(a)).length
  const ok = await confirmModal({
    title: 'Remover audiolivro', icon: 'trash', confirmText: 'Remover', danger: true,
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Apagar <b>${esc(a.title)}</b> e
           ${a.arquivos > 1 ? `os ${a.arquivos} arquivos de áudio` : 'o arquivo de áudio'} deste
           aparelho. Seus marcadores e a posição vão junto.
           ${naNuvem ? `<br><br>A cópia da <b>nuvem também é apagada</b> — o livro sai da estante em
             todos os seus aparelhos.` : ''}</p>`
  })
  if (!ok) return
  // ⚠️ A fila aponta para arquivos por id: deixar o livro removido lá dentro
  // faria o motor procurar um blob que não existe mais a cada volta.
  if (_abFila.some(x => x.id === id)) {
    _abFila = _abFila.filter(x => x.id !== id)
    _abFilaSalvar(); _abFilaPintar()
  }
  if (_abFilaAtual && _abFilaAtual.id === id) abNuvemCancelar()
  for (let i = 0; i < Math.max(1, a.arquivos || 0); i++) await BookDB.del(abChaveArquivo(id, i))
  if (naNuvem) await abNuvemApagar(id, a.arquivos || 1)
  audiolivros = audiolivros.filter(x => x.id !== id)
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast('Audiolivro removido', 'info')
  renderAudiobookSection()
}

// ================================================================
// O REPRODUTOR
// ================================================================
function _abRenderPlayer() {
  const a = _abLivro, caps = a.capitulos || []
  const cap = caps[_abCap] || { titulo: '—', ini: 0, fim: 0 }
  // Com capítulos montados, "001" sozinho não diz nada: o que orienta é
  // "Chapter 3 · parte 2 de 8".
  const _g = abGrupoDaParte(a, _abCap)
  const capNome = _g ? `${_g.titulo} · parte ${_abCap - _g.de + 1} de ${_g.ate - _g.de + 1}` : cap.titulo
  const area = el('ab-area')
  area.innerHTML = `
    <div class="ab-player">
      <div class="ab-topo">
        <div class="ab-capa-grande">
          ${a.cover ? `<img src="${escA(a.cover)}" alt="">`
                    : `<div class="ler-capa-fake"><span>${esc((a.title || '?').slice(0, 30))}</span></div>`}
        </div>
        <div class="ab-info">
          <h2>${esc(a.title || 'Sem título')}</h2>
          <p class="ab-autor">${esc(a.author || '')}</p>
          <p class="ab-cap-nome" id="ab-cap-nome">${esc(capNome)}</p>
          <p class="ab-cap-conta">Capítulo ${_abCap + 1} de ${caps.length} · ${abTempoLongo(abDuracao(a))} no total</p>

          <div class="ab-barra" id="ab-barra" onclick="abBarraClique(event)">
            <div class="ab-barra-fundo"><i id="ab-barra-cheia"></i></div>
          </div>
          <div class="ab-tempos">
            <span id="ab-t-atual">0:00</span>
            <span id="ab-t-resta" class="ab-t-resta"></span>
          </div>

          <div class="ab-controles">
            <button class="ab-btn" onclick="abCapAnterior()" data-tip="Capítulo anterior" aria-label="Capítulo anterior">${ic('skip','ic-sm')}</button>
            <button class="ab-btn ab-pulo" onclick="abPular(-${AB_PULO_VOLTAR})" data-tip="Voltar ${AB_PULO_VOLTAR}s">
              ${ic('undo','ic-sm')}<i>${AB_PULO_VOLTAR}</i></button>
            <button class="ab-btn ab-play" id="ab-play" onclick="abTocarPausar()" aria-label="Tocar ou pausar">${ic('play','ic-lg')}</button>
            <button class="ab-btn ab-pulo ab-espelho" onclick="abPular(${AB_PULO_AVANCAR})" data-tip="Avançar ${AB_PULO_AVANCAR}s">
              ${ic('undo','ic-sm')}<i>${AB_PULO_AVANCAR}</i></button>
            <button class="ab-btn" onclick="abCapProximo()" data-tip="Próximo capítulo" aria-label="Próximo capítulo" style="transform:scaleX(-1)">${ic('skip','ic-sm')}</button>
          </div>

          <div class="ab-secundarios">
            <button class="est-chip" onclick="abTrocarVelocidade()" id="ab-vel">${(a.velocidade || 1)}×</button>
            <button class="est-chip" onclick="abMarcar()">${ic('plus','ic-3xs')} Marcador</button>
            <button class="est-chip${_abSono ? ' on' : ''}" onclick="abSonoMenu(event)" id="ab-sono">${ic('clock','ic-3xs')} ${_abSono ? _abSonoRotulo() : 'Sono'}</button>
          </div>
        </div>
      </div>

      <div class="ab-abas">
        ${/* A marca de "onde estou" segue a aba ESCOLHIDA. Fixar `on` no
             primeiro botão fazia o player reabrir dizendo "Capítulos" com o
             texto da transcrição na tela — a tela certa, com o rótulo errado. */''}
        <button class="est-aba${_abAbaAtual === 'capitulos' ? ' on' : ''}" onclick="abAba('capitulos',event)">Capítulos</button>
        <button class="est-aba${_abAbaAtual === 'texto' ? ' on' : ''}" onclick="abAba('texto',event)">Texto${(a.transcricoes || []).some(t => t.cap === _abCap) ? '' : ' <i class="ab-novo">IA</i>'}</button>
        <button class="est-aba${_abAbaAtual === 'marcadores' ? ' on' : ''}" onclick="abAba('marcadores',event)">Marcadores${(a.marcadores || []).length ? ` (${a.marcadores.length})` : ''}</button>
      </div>
      <div id="ab-aba">${_abAbaAtual === 'texto' ? _abListaTexto()
        : _abAbaAtual === 'marcadores' ? _abListaMarcadores() : _abListaCapitulos()}</div>
    </div>`
  _abPintarBotao()
  _abPintarProgresso()
  // ⚠️ RELIGAR A SELEÇÃO DEPOIS DE CADA REDESENHO. O ouvinte mora no container,
  // e o container é recriado inteiro aqui — guardar um marcador redesenhava o
  // player e a lista ficava muda: selecionar a frase não abria mais o menu.
  if (_abAbaAtual === 'texto') _abLigarTexto()
  if (_abAbaAtual === 'marcadores') _abLigarSelecaoMarcas()
}

// ⚠️ UMA LISTA SÓ. Esta sequência existia DUPLICADA (aqui e no clique da aba),
// e o preço apareceu na hora: acrescentei o hover a uma das cópias e ele não
// funcionava, porque quem roda no clique era a outra. Regra do projeto: quando
// duas partes fazem a mesma coisa, a peça é uma.
function _abLigarTexto() {
  const box = el('ab-trans')
  _abLigarSelecao()
  _abLigarChips()
  _abLigarRolagemManual(box)
  _abLigarHoverPausa(box)
  abTipoAplicar()
  _abAcompanharTexto()
}

let _abAbaAtual = 'capitulos'
function abAba(qual, ev) {
  _abAbaAtual = qual || 'capitulos'
  document.querySelectorAll('.ab-abas .est-aba').forEach(b =>
    b.classList.toggle('on', (b.getAttribute('onclick') || '').includes(`'${_abAbaAtual}'`)))
  const box = el('ab-aba'); if (!box) return
  box.innerHTML = _abAbaAtual === 'marcadores' ? _abListaMarcadores()
    : _abAbaAtual === 'texto' ? _abListaTexto()
    : _abListaCapitulos()
  if (_abAbaAtual === 'texto') _abLigarTexto()
  if (_abAbaAtual === 'marcadores') _abLigarSelecaoMarcas()
}

function _abListaCapitulos() {
  const a = _abLivro
  // O convite aparece só onde faz sentido: arquivo único cujas "partes" foram
  // cortadas pelo relógio. Livro que já veio capitulado não precisa de nada.
  // Vale para os dois casos de "arquivo que não veio capitulado": as Partes por
  // relógio E o livro inteiro num capítulo só (arquivo curto demais para ser
  // fatiado, ou um `.m4b` cujos capítulos não estavam em `chpl`).
  const caps = a.capitulos || []
  const porTempo = caps.length === 1 || caps.some(c => /^(Parte \d|Livro completo)/.test(c.titulo || ''))
  // ⚠️ ELE PERGUNTOU "CADÊ ESSA OPÇÃO?" E A RESPOSTA ERA: escondida. O convite
  // só aparecia quando os cortes tinham sido feitos pelo relógio — e nos dois
  // livros dele os capítulos vieram DE DENTRO do `.m4b` ("001", "Chapter 1"),
  // então ele nunca via o botão.
  //
  // Na maioria das vezes não ver é o certo: capítulo que veio do arquivo já é
  // o de verdade. Mas "veio do arquivo" não quer dizer "está bom" — o Billy
  // Summers dele tem capítulos de 38 SEGUNDOS e um de 51 MINUTOS, sinal de
  // marcador de faixa, não de divisão narrativa. Quem quiser refazer precisa
  // de um caminho; o que muda é o tom, não a existência do botão.
  const maior = caps.reduce((m, c) => Math.max(m, abDurCap(c) || 0), 0)
  const podeAgrupar = caps.length >= 6 && !(a.grupos || []).length
  // ⚠️ UMA FAIXA POR VEZ. Com as duas na tela o app se contradizia: "São 200
  // partes numeradas, SEM os capítulos" logo acima de "Estes 200 CAPÍTULOS
  // vieram do arquivo". São respostas concorrentes para a mesma pergunta, e a
  // de agrupar é a certa aqui — quem tem 200 partes numeradas quer organizá-las,
  // não trocar os cortes por outros iguais.
  const convite = !abPodeProcurarCapitulos(a) || podeAgrupar ? ''
    : porTempo
    ? `<div class="ab-conv">
         ${ic('search','ic-sm')}
         <span>Estes cortes são de <b>15 em 15 minutos</b>, não os capítulos do livro.
           Dá para procurar os de verdade pelo <b>silêncio</b> entre eles — aqui no aparelho,
           sem custo.</span>
         <button class="btn btn-ghost btn-sm" onclick="abProcurarCapitulos()">Procurar capítulos</button>
       </div>`
    : `<div class="ab-conv ab-conv-fraca">
         ${ic('search','ic-sm')}
         <span>Estes ${caps.length} capítulos vieram <b>de dentro do arquivo</b>.
           ${maior > 25 * 60 ? `O maior tem <b>${abTempoLongo(maior)}</b> — se ele juntar mais de um
             capítulo do livro, ` : 'Se a divisão não bater com a do livro, '}dá para procurar os
           cortes pelo <b>silêncio</b>, aqui no aparelho e sem custo.</span>
         <button class="btn btn-ghost btn-sm" onclick="abProcurarCapitulos()">Procurar pelo silêncio</button>
       </div>`

  // ⚠️ A PORTA DO AGRUPAMENTO É OUTRA COISA, e por isso é outra faixa: procurar
  // pelo silêncio TROCA os cortes; agrupar os mantém e só os organiza. Só
  // aparece quando faz sentido — muitas partes, sem grupos ainda.
  const conviteGrupo = podeAgrupar
    ? `<div class="ab-conv">
         ${ic('layers','ic-sm')}
         <span>São <b>${caps.length} partes</b> numeradas, sem os capítulos. O narrador diz o
           número de cada uma no começo — dá para <b>montar os capítulos</b> a partir disso, sem
           precisar do livro em texto.</span>
         <button class="btn btn-ghost btn-sm" onclick="abAgruparCapitulos()">Descobrir capítulos</button>
       </div>` : ''
  const item = (c, i) => `
    <button class="ab-cap${i === _abCap ? ' on' : ''}" onclick="abIrCapitulo(${i})">
      <span class="ab-cap-n">${i + 1}</span>
      <span class="ab-cap-t">${esc(c.titulo)}</span>
      <span class="ab-cap-d">${abTempo(abDurCap(c))}</span>
    </button>`

  // ⚠️ AGRUPADO QUANDO HÁ GRUPOS, E SÓ ENTÃO. `a.grupos` é camada de exibição:
  // os índices continuam sendo os de `a.capitulos`, que é o que a posição, os
  // marcadores e as transcrições guardam. Nada aqui pode renumerar nada.
  if ((a.grupos || []).length) {
    const abertoAgora = abGrupoDaParte(a, _abCap)
    return `${conviteGrupo}${convite}
      <div class="ab-grupos">
        ${a.grupos.map((g, gi) => {
          const n = g.ate - g.de + 1
          const dur = caps.slice(g.de, g.ate + 1).reduce((t, c) => t + (abDurCap(c) || 0), 0)
          const aberto = g === abertoAgora || _abGrupoAberto === gi
          return `<div class="ab-grupo${aberto ? ' aberto' : ''}">
            <button class="ab-grupo-cab" onclick="abGrupoAbrir(${gi})">
              <span class="ab-grupo-seta">${ic('chevronRight','ic-3xs')}</span>
              <span class="ab-grupo-t">${esc(g.titulo)}</span>
              <span class="ab-grupo-n">${n} ${n === 1 ? 'parte' : 'partes'}</span>
              <span class="ab-cap-d">${abTempo(dur)}</span>
            </button>
            ${aberto ? `<div class="ab-caps">${caps.slice(g.de, g.ate + 1)
              .map((c, k) => item(c, g.de + k)).join('')}</div>` : ''}
          </div>`
        }).join('')}
      </div>
      <p class="est-dica" style="margin-top:10px">Capítulos montados pela numeração que o narrador
        diz. <button class="btn btn-ghost btn-sm" onclick="abDesagrupar()">Desfazer o agrupamento</button></p>`
  }
  return `${conviteGrupo}${convite}<div class="ab-caps">${caps.map(item).join('')}</div>`
}

let _abGrupoAberto = -1
function abGrupoAbrir(gi) {
  _abGrupoAberto = (_abGrupoAberto === gi) ? -1 : gi
  abAba('capitulos')
}

// A FALA QUE ESTAVA TOCANDO NAQUELE INSTANTE.
// ⚠️ DERIVADA NA HORA DE MOSTRAR, e não só no momento em que o marcador nasce.
// A ordem real das coisas é o contrário da ordem óbvia: ele marca ENQUANTO
// ouve (não dá para parar e transcrever no meio de uma caminhada) e transcreve
// DEPOIS. Se a frase só fosse gravada na criação, todo marcador feito antes da
// transcrição ficaria mudo para sempre — justamente os que mais importam.
// A cópia guardada em `m.frase` é o segundo caminho: ela sobrevive se aquela
// janela de transcrição for substituída por outra.
function abFraseDoMarcador(a, m) {
  if (!a || !m) return ''
  const dentro = (a.transcricoes || [])
    .filter(t => t.cap === m.cap)
    .flatMap(t => t.segs || [])
    .find(s => m.seg >= s.i - 0.6 && m.seg <= s.f + 0.6)
  return (dentro && dentro.t) || m.frase || ''
}

function _abListaMarcadores() {
  const a = _abLivro
  const ms = (a.marcadores || []).slice().sort((x, y) => (x.cap - y.cap) || (x.seg - y.seg))
  if (!ms.length) {
    return `<div class="est-nada">${ic('clock','ic-lg')}<p>Nenhum marcador ainda.</p>
      <p class="est-dica">O botão <b>Marcador</b> guarda o instante exato em que você está — serve
      para voltar a uma frase que valeu a pena. Com o capítulo transcrito, ele mostra também
      <b>o que estava sendo dito</b> ali.</p></div>`
  }
  const algumSemFrase = ms.some(m => !abFraseDoMarcador(a, m))
  return `<div class="ab-marcas" id="ab-marcas">${ms.map((m, i) => {
    const frase = abFraseDoMarcador(a, m)
    return `
    <div class="ab-marca">
      <button class="ab-marca-ir" onclick="abIrMarcador(${i})">
        <b>${abTempo(m.seg)}</b>
        <span>${esc((a.capitulos[m.cap] || {}).titulo || `Capítulo ${m.cap + 1}`)}</span>
      </button>
      <div class="ab-marca-corpo">
        ${frase ? `<p class="ab-marca-frase">${esc(frase)}</p>` : ''}
        ${m.nota ? `<p class="ab-marca-nota">${ic('pencil','ic-3xs')} ${esc(m.nota)}</p>` : ''}
        ${!frase && !m.nota ? `<p class="ab-marca-vazio">sem nota — transcreva o capítulo para ver a fala daqui</p>` : ''}
      </div>
      <button class="ab-marca-x" onclick="abMarcadorApagar(${i})" data-tip="Apagar">${ic('x','ic-3xs')}</button>
    </div>`
  }).join('')}</div>
  ${algumSemFrase && !(a.transcricoes || []).length ? `<p class="est-dica" style="margin-top:12px">
    ${ic('sparkles','ic-3xs')} <b>Transcreva o capítulo</b> na aba Texto e estes marcadores passam a
    mostrar o que foi dito — inclusive os que você guardou antes.</p>` : ''}`
}

// ---- carregar arquivo/capítulo ----
async function _abCarregarCapitulo(i, seg) {
  const a = _abLivro; if (!a) return
  const caps = a.capitulos || []
  i = Math.max(0, Math.min(i, caps.length - 1))
  const cap = caps[i]; if (!cap) return
  _abCap = i
  const au = _abAudio(); if (!au) return

  // ⚠️ SÓ TROCA O ARQUIVO SE FOR OUTRO ARQUIVO. Num `.m4b` os 40 capítulos
  // moram no MESMO arquivo: recarregar a cada troca jogaria fora 500 MB já
  // decodificados e daria um engasgo de segundos entre capítulos.
  if (cap.arq !== _abArqAtual) {
    let blob = await BookDB.get(abChaveArquivo(a.id, cap.arq))
    if (!blob) {
      // Num livro em 40 faixas, é aqui que a nuvem paga o aluguel: chegou no
      // capítulo 12 e a faixa 12 não está aqui, ela desce agora — e só ela.
      const antes = au.paused
      try { au.pause() } catch (e) {}
      _abPintarBaixando(a, 'Buscando esta parte na sua nuvem…', null)
      blob = await abGarantirArquivo(a, cap.arq, (m, pct) => _abPintarBaixando(a, m, pct))
      _abRenderPlayer()
      if (!blob) return
      if (!antes) _abQuerTocar = true
    }
    if (_abUrl) { try { URL.revokeObjectURL(_abUrl) } catch (e) {} }
    _abUrl = URL.createObjectURL(blob)
    _abArqAtual = cap.arq
    au.src = _abUrl
    await new Promise(res => {
      const pronto = () => { au.removeEventListener('loadedmetadata', pronto); res() }
      au.addEventListener('loadedmetadata', pronto)
      setTimeout(res, 6000)
    })
    if (_abCorrigirDuracao(a, i, au.duration)) _abRenderPlayer()
  }
  au.playbackRate = a.velocidade || 1
  au.currentTime = (cap.ini || 0) + Math.max(0, seg || 0)
  _abLigarEventos()
  _abAtualizarTexto()
  _abPintarProgresso()
  _abMediaSession()
}

let _abEventosLigados = false
function _abLigarEventos() {
  if (_abEventosLigados) return
  const au = _abAudio(); if (!au) return
  au.addEventListener('timeupdate', _abAoAndar)
  au.addEventListener('play', () => { _abQuerTocar = true; _abPintarBotao(); _abMediaEstado() })
  // ⚠️ A posição só é aceita depois que o navegador SABE a duração: antes
  // disso `au.duration` é NaN e `setPositionState` recusa a chamada inteira —
  // resultado, a barra da tela de bloqueio nunca aparecia.
  au.addEventListener('loadedmetadata', _abMediaPos)
  au.addEventListener('ratechange', _abMediaPos)
  au.addEventListener('seeked', _abMediaPos)
  au.addEventListener('pause', () => {
    // Pausa DURANTE a virada é técnica (o arquivo acabou), não decisão dela.
    // Pausa DURANTE a virada é técnica (o arquivo acabou) e pausa por MOUSE é
    // momentânea — nenhuma das duas é decisão dela de parar de ouvir.
    if (!_abVirando && !_abPausaHover) _abQuerTocar = false
    _abPintarBotao(); _abSalvarPos(true); _abMediaEstado()
  })
  au.addEventListener('ended', _abAoTerminarArquivo)
  _abEventosLigados = true
}

function _abAoAndar() {
  const a = _abLivro; if (!a || _abArrastando) return
  const au = _abAudio(), cap = a.capitulos[_abCap]
  if (!au || !cap) return
  // Num m4b o "fim do capítulo" não é o fim do arquivo: é um instante no meio
  // dele, e só este teste faz a virada acontecer.
  if (cap.fim && au.currentTime >= cap.fim - 0.15 && _abCap + 1 < a.capitulos.length) {
    _abVirar()
    return
  }
  _abPintarProgresso()
  if (_abAbaAtual === 'texto') _abAcompanharTexto()
  _abSalvarPos()
}

function _abAoTerminarArquivo() {
  const a = _abLivro; if (!a) return
  // ⚠️ `true` E NÃO `!au.paused`: quando o arquivo TERMINA, o elemento já se
  // declara pausado. Ler o estado aqui daria sempre "estava parado", e o livro
  // travaria no fim de cada faixa esperando um clique — foi o que aconteceu no
  // teste. Chegar ao fim tocando é a única forma de chegar aqui.
  if (_abCap + 1 < a.capitulos.length) { _abVirar(); return }
  a.status = 'ouvido'
  a.pos = { cap: _abCap, seg: abDurCap(a.capitulos[_abCap]) }
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast(`"${a.title}" — fim. Bom livro.`, 'success')
  _abPintarBotao()
}

// ⚠️ UMA VIRADA SÓ, MESMO COM DOIS AVISOS. Medido: ao chegar ao fim da faixa 1,
// o capítulo pulou para o TERCEIRO. São dois eventos dizendo a mesma coisa — o
// `timeupdate` percebe que passou do fim do capítulo e o `ended` percebe que o
// arquivo acabou —, e cada um avançava por conta própria. A trava só cai
// quando o capítulo novo terminou de carregar.
let _abVirando = false
function _abVirar() {
  if (_abVirando) return
  const a = _abLivro, au = _abAudio()
  if (!a || !au || _abCap + 1 >= a.capitulos.length) return
  _abVirando = true
  const sonoAqui = _abSono && _abSono.tipo === 'cap' && _abSono.capAlvo === _abCap
  _abCarregarCapitulo(_abCap + 1, 0).then(() => {
    _abRenderPlayer()
    _abVirando = false
    // Timer "ao fim do capítulo": a virada é exatamente o momento de parar.
    if (sonoAqui) { au.pause(); abSonoCancelar(); toast('Fim do capítulo — pausado', 'info'); return }
    if (_abQuerTocar) _abTocarSeguro()
  }).catch(() => { _abVirando = false })
}

// ⚠️ TOCAR LOGO DEPOIS DE TROCAR O ARQUIVO FALHA CALADO. O `play()` disparado
// no mesmo instante em que o elemento acabou de receber `src` novo e um
// `currentTime` novo é rejeitado sem aviso — e eu estava engolindo o erro com
// um `.catch(() => {})`, o que fazia o livro parar no fim de cada capítulo
// parecendo que a virada tinha dado certo (ela dava; o som é que não voltava).
// Uma segunda tentativa 300ms depois resolve, e o fracasso agora aparece.
function _abTocarSeguro(tentativa = 0) {
  const au = _abAudio(); if (!au) return
  const p = au.play()
  if (!p || !p.catch) return
  p.catch(err => {
    if (tentativa < 2) { setTimeout(() => _abTocarSeguro(tentativa + 1), 300); return }
    console.warn('[audiobook] não consegui retomar:', err && err.message)
    _abPintarBotao()
  })
}

// ---- controles ----
function abTocarPausar() {
  const au = _abAudio(); if (!au || !_abLivro) return
  _abHoverLimpar()
  if (au.paused) { _abQuerTocar = true; _abTocarSeguro(); _abInicioSessao = Date.now() }
  else { _abQuerTocar = false; au.pause(); _abRegistrarTempo() }
}
function abPular(seg) {
  const au = _abAudio(), a = _abLivro; if (!au || !a) return
  const cap = a.capitulos[_abCap]
  const alvo = au.currentTime + seg
  // Pular para trás no começo do capítulo leva ao capítulo anterior — é o que
  // a pessoa quer quando repete uma frase que estava na virada.
  if (alvo < (cap.ini || 0) - 0.5 && _abCap > 0) {
    const ant = a.capitulos[_abCap - 1]
    const sobra = (cap.ini || 0) - alvo
    _abCarregarCapitulo(_abCap - 1, Math.max(0, abDurCap(ant) - sobra)).then(_abRenderPlayer)
    return
  }
  au.currentTime = Math.max(cap.ini || 0, Math.min(alvo, cap.fim || au.duration || alvo))
  _abPintarProgresso(); _abSalvarPos()
}
function abCapAnterior() {
  const au = _abAudio()
  // Menos de 5 segundos no capítulo? Volta para o anterior. Mais que isso,
  // volta para o COMEÇO deste — é o comportamento de todo player de áudio, e
  // quem aperta duas vezes espera chegar ao anterior.
  const cap = _abLivro.capitulos[_abCap]
  if (au && au.currentTime - (cap.ini || 0) > 5) { au.currentTime = cap.ini || 0; _abPintarProgresso(); return }
  if (_abCap > 0) _abCarregarCapitulo(_abCap - 1, 0).then(() => { _abRenderPlayer(); if (_abQuerTocar) _abTocarSeguro() })
}
function abCapProximo() {
  const au = _abAudio()
  if (_abCap + 1 < _abLivro.capitulos.length) {
    _abCarregarCapitulo(_abCap + 1, 0).then(() => { _abRenderPlayer(); if (_abQuerTocar) _abTocarSeguro() })
  }
}
function abIrCapitulo(i) {
  _abCarregarCapitulo(i, 0).then(() => { _abRenderPlayer(); if (_abQuerTocar) _abTocarSeguro() })
}
function abTrocarVelocidade() {
  const a = _abLivro, au = _abAudio(); if (!a || !au) return
  const i = AB_VELOCIDADES.indexOf(a.velocidade || 1)
  a.velocidade = AB_VELOCIDADES[(i + 1) % AB_VELOCIDADES.length]
  au.playbackRate = a.velocidade
  const b = el('ab-vel'); if (b) b.textContent = `${a.velocidade}×`
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
}
function abBarraClique(ev) {
  const a = _abLivro, au = _abAudio(); if (!a || !au) return
  const barra = el('ab-barra'); if (!barra) return
  const r = barra.getBoundingClientRect()
  const frac = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width))
  const cap = a.capitulos[_abCap]
  au.currentTime = (cap.ini || 0) + frac * abDurCap(cap)
  _abPintarProgresso(); _abSalvarPos(true)
}

function _abTeclas(e) {
  if (!_abLivro) return
  if (/input|textarea|select/i.test((document.activeElement || {}).tagName || '')) return
  if (e.key === ' ') { e.preventDefault(); abTocarPausar() }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); abPular(-AB_PULO_VOLTAR) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); abPular(AB_PULO_AVANCAR) }
  else if (e.key === 'Escape') abFechar()
}

// ---- pintura ----
function _abPintarBotao() {
  const b = el('ab-play'), au = _abAudio()
  if (!b || !au) return
  b.innerHTML = au.paused ? ic('play', 'ic-lg') : ic('pause', 'ic-lg')
  b.classList.toggle('tocando', !au.paused)
}
function _abPintarProgresso() {
  const a = _abLivro, au = _abAudio(); if (!a || !au) return
  const cap = a.capitulos[_abCap]; if (!cap) return
  const dentro = Math.max(0, au.currentTime - (cap.ini || 0))
  const dur = abDurCap(cap) || 1
  const cheia = el('ab-barra-cheia'); if (cheia) cheia.style.width = Math.min(100, dentro / dur * 100) + '%'
  const t1 = el('ab-t-atual'); if (t1) t1.textContent = abTempo(dentro)
  const t2 = el('ab-t-resta')
  if (t2) {
    const fim = Math.max(0, dur - dentro)
    const vel = a.velocidade || 1
    t2.textContent = `−${abTempo(fim)}${vel !== 1 ? ` · ${abTempoLongo(fim / vel)} no ${vel}×` : ''}`
  }
}
function _abAtualizarTexto() {
  const a = _abLivro; if (!a) return
  const cap = a.capitulos[_abCap] || {}
  const n = el('ab-cap-nome'); if (n) n.textContent = cap.titulo || ''
}

// ---- posição e tempo ouvido ----
function _abSalvarPos(agora = false) {
  const a = _abLivro, au = _abAudio(); if (!a || !au) return
  const cap = a.capitulos[_abCap]; if (!cap) return
  a.pos = { cap: _abCap, seg: Math.max(0, au.currentTime - (cap.ini || 0)) }
  a.updatedAt = Date.now()
  clearTimeout(_abSalvarTimer)
  const gravar = () => {
    saveAudiolivros()
    if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  }
  if (agora) gravar()
  else _abSalvarTimer = setTimeout(gravar, 4000)   // `timeupdate` dispara ~4x/s
}
function _abRegistrarTempo() {
  const a = _abLivro; if (!a || !_abInicioSessao) return
  const min = (Date.now() - _abInicioSessao) / 60000
  if (min > 0.2 && min < 600) a.minutos = Math.round((a.minutos || 0) + min)
  _abInicioSessao = Date.now()
}

// ---- marcadores ----
function abMarcar() {
  const a = _abLivro, au = _abAudio(); if (!a || !au) return
  const cap = a.capitulos[_abCap]
  const seg = Math.max(0, au.currentTime - (cap.ini || 0))
  inputModal({
    title: 'Marcador', label: `Em ${abTempo(seg)} de "${cap.titulo}" — uma nota, se quiser`,
    placeholder: 'opcional', confirmText: 'Guardar',
    onConfirm: nota => _abGuardarMarcador(seg, nota)
  })
  // Guardar sem nota também tem de funcionar: quem está ouvindo no carro
  // aperta o botão e segue. O modal exige texto, então o Enter vazio some —
  // por isso o atalho abaixo grava assim que o modal fecha sem confirmar.
  const campo = document.getElementById('el-input-modal-field')
  if (campo) campo.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !campo.value.trim()) {
      document.getElementById('el-input-modal')?.remove()
      _abGuardarMarcador(seg, '')
    }
  })
}
function _abGuardarMarcador(seg, nota) {
  const a = _abLivro; if (!a) return
  a.marcadores = a.marcadores || []
  const m = { cap: _abCap, seg, nota: (nota || '').trim(), at: Date.now() }
  const frase = abFraseDoMarcador(a, m)
  if (frase) m.frase = frase
  a.marcadores.push(m)
  a.updatedAt = Date.now()
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  toast('Marcador guardado', 'success')
  _abRenderPlayer()
}
function abIrMarcador(i) {
  const a = _abLivro; if (!a) return
  const ms = (a.marcadores || []).slice().sort((x, y) => (x.cap - y.cap) || (x.seg - y.seg))
  const m = ms[i]; if (!m) return
  _abCarregarCapitulo(m.cap, m.seg).then(() => { _abRenderPlayer(); abAba('marcadores'); if (_abQuerTocar) _abTocarSeguro() })
}
function abMarcadorApagar(i) {
  const a = _abLivro; if (!a) return
  const ms = (a.marcadores || []).slice().sort((x, y) => (x.cap - y.cap) || (x.seg - y.seg))
  const m = ms[i]; if (!m) return
  a.marcadores = a.marcadores.filter(x => x !== m)
  a.updatedAt = Date.now()
  saveAudiolivros()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  const box = el('ab-aba'); if (box) box.innerHTML = _abListaMarcadores()
}

// ---- timer de sono ----
// Quem ouve audiolivro ouve deitado. Sem isto, dormir custa quarenta minutos
// de livro que a pessoa vai ter de reencontrar no dia seguinte.
function abSonoMenu(ev) {
  ev.stopPropagation()
  document.getElementById('ab-sono-menu')?.remove()
  if (_abSono) { abSonoCancelar(); return }
  const m = document.createElement('div')
  m.id = 'ab-sono-menu'; m.className = 'est-menu'
  m.innerHTML = `
    <div class="est-menu-sep">Parar em</div>
    ${[10, 20, 30, 45, 60].map(min => `<button onclick="abSonoLigar(${min})">${min} minutos</button>`).join('')}
    <button onclick="abSonoLigar(0,'cap')">Ao fim do capítulo</button>`
  document.body.appendChild(m)
  const r = ev.currentTarget.getBoundingClientRect()
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - 218)) + 'px'
  m.style.top = (r.bottom + 6 + (m.offsetHeight || 240) > innerHeight ? Math.max(8, r.top - (m.offsetHeight || 240) - 6) : r.bottom + 6) + 'px'
  setTimeout(() => document.addEventListener('click', () => document.getElementById('ab-sono-menu')?.remove(), { once: true }), 0)
}
function abSonoLigar(min, tipo) {
  document.getElementById('ab-sono-menu')?.remove()
  abSonoCancelar()
  if (tipo === 'cap') {
    _abSono = { tipo: 'cap', capAlvo: _abCap }
    toast('Vou parar no fim deste capítulo', 'info')
  } else {
    _abSono = { tipo: 'min', fim: Date.now() + min * 60000 }
    _abSono.timer = setTimeout(() => { _abAudio()?.pause(); abSonoCancelar(); toast('Timer de sono: pausado', 'info') }, min * 60000)
    toast(`Vou pausar em ${min} minutos`, 'info')
  }
  const b = el('ab-sono'); if (b) { b.classList.add('on'); b.innerHTML = `${ic('clock','ic-3xs')} ${_abSonoRotulo()}` }
}
function abSonoCancelar() {
  if (_abSono && _abSono.timer) clearTimeout(_abSono.timer)
  _abSono = null
  const b = el('ab-sono'); if (b) { b.classList.remove('on'); b.innerHTML = `${ic('clock','ic-3xs')} Sono` }
}
function _abSonoRotulo() {
  if (!_abSono) return 'Sono'
  if (_abSono.tipo === 'cap') return 'fim do cap.'
  return `${Math.max(1, Math.round((_abSono.fim - Date.now()) / 60000))} min`
}

// Fone de ouvido, tela de bloqueio e o botão do carro: o mesmo player, sem UI.
// ================================================================
// A TELA DESLIGADA — e o app continua tocando
// ================================================================
// Pedido dele: *"o app tem que funcionar com a tela desligada na parte do
// audiobook."*
//
// Quem mantém o som vivo com a tela apagada é o próprio navegador, e o que ele
// exige em troca é que a página se comporte como um TOCADOR DE VERDADE: dizer
// o que está tocando, em que estado está e em que ponto está. Faltavam as duas
// últimas — e é isso que faz o Android tratar a aba como música (mantém) ou
// como página qualquer (congela).
//
// | O que faltava        | O que muda com a tela apagada                       |
// |----------------------|-----------------------------------------------------|
// | `playbackState`      | O sistema sabia que havia áudio, não que ele TOCA    |
// | `setPositionState`   | Sem barra de progresso na tela de bloqueio, e sem o  |
// |                      | sinal de "isto é uma sessão longa, não um bipe"      |
// | `seekto`             | Arrastar na notificação não fazia nada               |
//
// ⚠️ `setPositionState` REJEITA números impossíveis e derruba a chamada
// inteira: duração `NaN` (áudio ainda carregando), posição maior que a
// duração (arredondamento na virada de capítulo) ou velocidade zero. Por isso
// cada valor é conferido antes — um `try` mudo aqui esconderia o motivo de a
// barra nunca aparecer.
function _abMediaPos() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return
  const au = _abAudio(); if (!au) return
  const dur = Number(au.duration)
  if (!isFinite(dur) || dur <= 0) return
  const pos = Math.min(Math.max(0, Number(au.currentTime) || 0), dur)
  const vel = Number(au.playbackRate) || 1
  try { navigator.mediaSession.setPositionState({ duration: dur, position: pos, playbackRate: vel }) }
  catch (e) {}
}

function _abMediaEstado() {
  if (!('mediaSession' in navigator)) return
  const au = _abAudio()
  try { navigator.mediaSession.playbackState = (au && !au.paused) ? 'playing' : 'paused' } catch (e) {}
  _abMediaPos()
}

function _abMediaSession() {
  if (!('mediaSession' in navigator) || !_abLivro) return
  const a = _abLivro, cap = a.capitulos[_abCap] || {}
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      // Na tela de bloqueio, "001" nao diz nada; "Chapter 3 - parte 2 de 8" diz.
      title: (() => { const g = abGrupoDaParte(a, _abCap)
        return g ? `${g.titulo} · parte ${_abCap - g.de + 1} de ${g.ate - g.de + 1}`
                 : (cap.titulo || a.title) })(),
      artist: a.author || '', album: a.title || '',
      artwork: a.cover ? [{ src: a.cover, sizes: '240x240', type: 'image/jpeg' }] : []
    })
    // ⚠️ `play`/`pause` do sistema NÃO podem cair em `abTocarPausar`, que
    // ALTERNA: apertar "play" na tela de bloqueio com o áudio já tocando
    // pausaria. Parecia igual porque no app o botão é um só; na notificação
    // são dois botões distintos.
    navigator.mediaSession.setActionHandler('play', () => { _abHoverLimpar(); _abQuerTocar = true; _abTocarSeguro(); _abMediaEstado() })
    navigator.mediaSession.setActionHandler('pause', () => { _abHoverLimpar(); _abQuerTocar = false; const au = _abAudio(); if (au) au.pause(); _abRegistrarTempo(); _abSalvarPos(true); _abMediaEstado() })
    navigator.mediaSession.setActionHandler('seekbackward', () => abPular(-AB_PULO_VOLTAR))
    navigator.mediaSession.setActionHandler('seekforward', () => abPular(AB_PULO_AVANCAR))
    navigator.mediaSession.setActionHandler('previoustrack', () => abCapAnterior())
    navigator.mediaSession.setActionHandler('nexttrack', () => abCapProximo())
    // Arrastar a barra na notificação. `fastSeek` quando existe: em arquivo
    // grande ele pula sem redecodificar o caminho todo.
    navigator.mediaSession.setActionHandler('seekto', d => {
      const au = _abAudio(); if (!au || d.seekTime == null) return
      if (d.fastSeek && au.fastSeek) au.fastSeek(d.seekTime)
      else au.currentTime = d.seekTime
      _abSalvarPos(true); _abMediaEstado()
    })
    navigator.mediaSession.setActionHandler('stop', () => { _abQuerTocar = false; const au = _abAudio(); if (au) au.pause(); _abRegistrarTempo(); _abSalvarPos(true); _abMediaEstado() })
  } catch (e) {}
  _abMediaEstado()
}

// Trocar de seção com o livro aberto: o áudio CONTINUA tocando de propósito
// (é audiolivro — ouvir enquanto se faz outra coisa é o uso normal), mas a
// posição é gravada na hora, porque a aba pode ser fechada a qualquer momento.
function abAoSairDaSecao() {
  // A tela cheia é DESTA seção: sem isto, ir ao Dashboard deixaria o texto
  // cobrindo a tela inteira do app.
  if (document.body.classList.contains('ab-full')) abTextoFull(false)
  if (!_abLivro) return
  _abRegistrarTempo()
  _abSalvarPos(true)
}
