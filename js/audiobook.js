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
        <b>O arquivo fica só neste aparelho.</b> Um audiolivro tem centenas de megabytes, então
        ele não sobe para a nuvem — o que acompanha você entre aparelhos é a lista de capítulos,
        onde você parou e seus marcadores.
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
    : [{ titulo: 'Livro completo', arq: 0, ini: 0, fim: duracao }]

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
    caps.push({ titulo: _abNomeDeFaixa(f.name, i, prefixo), arq: i, ini: 0, fim: dur })
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
    const fim = d => { URL.revokeObjectURL(url); resolve(Number.isFinite(d) && d > 0 ? d : 0) }
    a.preload = 'metadata'
    a.onloadedmetadata = () => fim(a.duration)
    a.onerror = () => fim(0)
    setTimeout(() => fim(a.duration), 8000)   // arquivo estranho não trava a fila
    a.src = url
  })
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
        : [{ titulo: 'Livro completo', arq: 0, ini: 0, fim: dur }]
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
        caps.push({ titulo: _abNomeDeFaixa(lista[i].name, i, prefixo), arq: i, ini: 0, fim: d })
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
// ABRIR E FECHAR
// ================================================================
async function abAbrir(id) {
  const a = audiolivroPorId(id); if (!a) return
  // Item que entrou pelo catálogo ainda não tem o que tocar: o clique vira o
  // convite para anexar, e não um erro.
  if (!a.arquivos || !(a.capitulos || []).length) { abAnexarArquivo(id); return }
  const primeiro = await BookDB.get(abChaveArquivo(id, 0))
  if (!primeiro) {
    // ⚠️ FRASE HONESTA: o arquivo não está na nuvem por decisão de projeto, e
    // não por falha. Dizer "baixando…" seria mentir para sempre.
    toast('O áudio deste livro não está neste aparelho. Audiolivro não sobe para a nuvem (são centenas de MB) — importe o arquivo de novo aqui.', 'warning')
    return
  }
  _abLivro = a
  _abCap = Math.min(a.pos?.cap || 0, (a.capitulos || []).length - 1)
  _abArqAtual = -1
  _abInicioSessao = Date.now()
  a.lastOpen = Date.now()
  if (a.status === 'quero') a.status = 'ouvindo'
  saveAudiolivros()
  renderAudiobookSection()
  await _abCarregarCapitulo(_abCap, a.pos?.seg || 0)
  document.addEventListener('keydown', _abTeclas)
}

function abFechar() {
  _abQuerTocar = false
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
  const ok = await confirmModal({
    title: 'Remover audiolivro', icon: 'trash', confirmText: 'Remover', danger: true,
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Apagar <b>${esc(a.title)}</b> e
           ${a.arquivos > 1 ? `os ${a.arquivos} arquivos de áudio` : 'o arquivo de áudio'} deste
           aparelho. Seus marcadores e a posição vão junto.</p>`
  })
  if (!ok) return
  for (let i = 0; i < Math.max(1, a.arquivos || 0); i++) await BookDB.del(abChaveArquivo(id, i))
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
          <p class="ab-cap-nome" id="ab-cap-nome">${esc(cap.titulo)}</p>
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
        <button class="est-aba on" onclick="abAba('capitulos',event)">Capítulos</button>
        <button class="est-aba" onclick="abAba('marcadores',event)">Marcadores${(a.marcadores || []).length ? ` (${a.marcadores.length})` : ''}</button>
      </div>
      <div id="ab-aba">${_abListaCapitulos()}</div>
    </div>`
  _abPintarBotao()
  _abPintarProgresso()
}

function abAba(qual, ev) {
  document.querySelectorAll('.ab-abas .est-aba').forEach(b => b.classList.remove('on'))
  if (ev && ev.currentTarget) ev.currentTarget.classList.add('on')
  const box = el('ab-aba'); if (!box) return
  box.innerHTML = qual === 'marcadores' ? _abListaMarcadores() : _abListaCapitulos()
}

function _abListaCapitulos() {
  const a = _abLivro
  return `<div class="ab-caps">${(a.capitulos || []).map((c, i) => `
    <button class="ab-cap${i === _abCap ? ' on' : ''}" onclick="abIrCapitulo(${i})">
      <span class="ab-cap-n">${i + 1}</span>
      <span class="ab-cap-t">${esc(c.titulo)}</span>
      <span class="ab-cap-d">${abTempo(abDurCap(c))}</span>
    </button>`).join('')}</div>`
}

function _abListaMarcadores() {
  const a = _abLivro
  const ms = (a.marcadores || []).slice().sort((x, y) => (x.cap - y.cap) || (x.seg - y.seg))
  if (!ms.length) {
    return `<div class="est-nada">${ic('clock','ic-lg')}<p>Nenhum marcador ainda.</p>
      <p class="est-dica">O botão <b>Marcador</b> guarda o instante exato em que você está — serve
      para voltar a uma frase que valeu a pena.</p></div>`
  }
  return `<div class="ab-marcas">${ms.map((m, i) => `
    <div class="ab-marca">
      <button class="ab-marca-ir" onclick="abIrMarcador(${i})">
        <b>${abTempo(m.seg)}</b>
        <span>${esc((a.capitulos[m.cap] || {}).titulo || `Capítulo ${m.cap + 1}`)}</span>
      </button>
      <span class="ab-marca-nota">${esc(m.nota || '')}</span>
      <button class="ab-marca-x" onclick="abMarcadorApagar(${i})" data-tip="Apagar">${ic('x','ic-3xs')}</button>
    </div>`).join('')}</div>`
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
    const blob = await BookDB.get(abChaveArquivo(a.id, cap.arq))
    if (!blob) { toast('Falta o arquivo desta parte neste aparelho.', 'error'); return }
    if (_abUrl) { try { URL.revokeObjectURL(_abUrl) } catch (e) {} }
    _abUrl = URL.createObjectURL(blob)
    _abArqAtual = cap.arq
    au.src = _abUrl
    await new Promise(res => {
      const pronto = () => { au.removeEventListener('loadedmetadata', pronto); res() }
      au.addEventListener('loadedmetadata', pronto)
      setTimeout(res, 6000)
    })
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
  au.addEventListener('play', () => { _abQuerTocar = true; _abPintarBotao() })
  au.addEventListener('pause', () => {
    // Pausa DURANTE a virada é técnica (o arquivo acabou), não decisão dela.
    if (!_abVirando) _abQuerTocar = false
    _abPintarBotao(); _abSalvarPos(true)
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
  a.marcadores.push({ cap: _abCap, seg, nota: (nota || '').trim(), at: Date.now() })
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
function _abMediaSession() {
  if (!('mediaSession' in navigator) || !_abLivro) return
  const a = _abLivro, cap = a.capitulos[_abCap] || {}
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: cap.titulo || a.title, artist: a.author || '', album: a.title || '',
      artwork: a.cover ? [{ src: a.cover, sizes: '240x240', type: 'image/jpeg' }] : []
    })
    navigator.mediaSession.setActionHandler('play', () => abTocarPausar())
    navigator.mediaSession.setActionHandler('pause', () => abTocarPausar())
    navigator.mediaSession.setActionHandler('seekbackward', () => abPular(-AB_PULO_VOLTAR))
    navigator.mediaSession.setActionHandler('seekforward', () => abPular(AB_PULO_AVANCAR))
    navigator.mediaSession.setActionHandler('previoustrack', () => abCapAnterior())
    navigator.mediaSession.setActionHandler('nexttrack', () => abCapProximo())
  } catch (e) {}
}

// Trocar de seção com o livro aberto: o áudio CONTINUA tocando de propósito
// (é audiolivro — ouvir enquanto se faz outra coisa é o uso normal), mas a
// posição é gravada na hora, porque a aba pode ser fechada a qualquer momento.
function abAoSairDaSecao() {
  if (!_abLivro) return
  _abRegistrarTempo()
  _abSalvarPos(true)
}
