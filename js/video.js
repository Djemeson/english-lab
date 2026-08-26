// ================================================================
// VÍDEO — estudar com séries e filmes (fase 1 do PLANO-VIDEO.md)
// CARREGADO LAZY (só ao abrir a seção). Regras da casa:
//   - O ESTADO videos[]/clips[] vive em core.js (não-lazy) — firebase.js
//     sincroniza os dois e não pode depender deste arquivo (armadilha nº 1).
//   - O ARQUIVO de vídeo nunca sai do aparelho: aqui só entram metadados,
//     legenda (IndexedDB local), cortes e o áudio capturado da cena (KBs).
//   - O áudio real da cena é salvo sob audioKey(texto da fala): o player do
//     estudo (study.js) o encontra sozinho, sem nenhuma mudança lá.
// ================================================================

// ---- Estado do módulo (só UI; nada disto persiste) ----
let _videoView = 'lib'          // lib | player | prepare
let _vidCur = null              // entrada de videos[] aberta no player
let _vidFile = null             // File do vídeo aberto (runtime)
let _vidURL = null              // object URL corrente
let _vidCues = []               // cues da legenda [{s,e,t,pt?}]
let _vidCueIdx = -1             // cue atual (karaokê)
let _vidSel = null              // seleção {ci,cj,s,e} (índices de cue + tempos)
let _vidSelWords = new Set()    // índices das palavras marcadas na seleção
let _vidLoop = false            // loop A–B
let _vidPlayStop = null         // fim do trecho em reprodução
let _vidAutoScroll = true
let _vidShowPT = false          // mostrar TODAS as traduções no transcript
let _vidCapturing = false
let _vidOverlayOn = true        // legenda em tempo real sobre o vídeo
let _vidHoverPausou = false     // foi o hover na legenda que pausou (rodada 51)
let _vidHoverTimer = null       // retomada suave após sair da legenda
let _vidPTmode = 'off'          // tradução no vídeo: off | sub (legenda PT) | ia (tempo real)
let _vidPTfog = true            // névoa: tradução borrada até o hover (recall)
let _vidCuesPT = []             // trilha PT-BR baixada dos addons (alinhada por tempo)
let _vidFocus = null            // estudo focado de um trecho {ci,cj,revEN,revPT}
let _vidSubsSaveTimer = null
let _vidMarkOpen = null         // marcador em ciclo: tempo de início aguardando o fechamento
let _vidSyncing = false
let _vidSubCandidates = []      // legendas da última busca (para a IA testar alternativas)
let _vidAppliedSubUrl = null    // URL da legenda aplicada (para não retestar a mesma)
// O raio-X da legenda (rodada 46): os pontos difíceis achados pela MESMA peça
// do leitor e do audiolivro (aiAnalisarDificuldade). Vive DENTRO do pacote de
// legenda — viaja com ela para o disco e a nuvem, com o mesmo "melhor vence".
let _vidRaioX = null            // { itens, nivel, at, ficha }
let _vidStream = false          // podcast tocando direto da internet (sem arquivo local)
let _vidStreamSrc = null        // URL da fonte de addon (Assistir) — transitória, nunca persistida

// ---- IndexedDB próprio: handles de arquivo + legendas ----
const VideoDB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db)
    return new Promise((resolve, reject) => {
      // v2: store 'media' — áudio consertado (m4a extraído pelo ffmpeg.wasm)
      // v3: store 'files' — o arquivo do episódio de PODCAST baixado
      const req = indexedDB.open('el-video-db', 3)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles')
        if (!db.objectStoreNames.contains('subs'))    db.createObjectStore('subs')
        if (!db.objectStoreNames.contains('media'))   db.createObjectStore('media')
        if (!db.objectStoreNames.contains('files'))   db.createObjectStore('files')
      }
      req.onsuccess = () => { this._db = req.result; resolve(this._db) }
      req.onerror = () => reject(req.error)
    })
  },
  async get(store, key) {
    const db = await this.open()
    return new Promise(resolve => {
      const req = db.transaction(store).objectStore(store).get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    })
  },
  async set(store, key, val) {
    const db = await this.open()
    return new Promise(resolve => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(val, key)
      tx.oncomplete = resolve; tx.onerror = resolve
    })
  },
  async del(store, key) {
    const db = await this.open()
    return new Promise(resolve => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).delete(key)
      tx.oncomplete = resolve; tx.onerror = resolve
    })
  }
}

// ================================================================
// RENDER RAIZ — decide a visão. Guard importante: se o player está de
// pé (o usuário só trocou de aba e voltou, ou um snapshot da nuvem
// chegou), NÃO reconstruímos o DOM — destruiria o <video> tocando.
// ================================================================
function renderVideoSection() {
  if (_pendingClipPlay) { _vidConsumePendingClip(); return }
  if (_videoView === 'player' && el('vid-player')) { _vidRenderLibBadgeOnly(); return }
  _videoView = 'lib'
  renderVideoLib()
}

function _vidRenderLibBadgeOnly() { /* player ativo: nada a fazer */ }

// ================================================================
// BIBLIOTECA DE VÍDEOS
// ================================================================
function renderVideoLib() {
  _videoView = 'lib'
  const acts = el('video-ph-actions')
  if (acts) acts.innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="podcastOpen()" data-tip="Buscar um podcast e escolher o episódio — ele é baixado e estudado como qualquer vídeo">${ic('mic')}Buscar podcast</button>
    <button class="btn btn-primary btn-sm" onclick="videoPickFile()">${ic('plus')}Abrir arquivo</button>`
  const area = el('video-area'); if (!area) return

  if (!videos.length) {
    area.innerHTML = `
      <div class="srs-empty">
        ${ic('film','ic-xl')}
        <p style="font-size:var(--fs-base);font-weight:600;margin-bottom:8px">Nada aqui ainda</p>
        <p style="font-size:var(--fs-md);margin-bottom:6px">Busque um <b>podcast</b> e escolha o episódio, ou abra um episódio/filme
        do seu computador. Importe a legenda (.srt) e transforme as falas em cards — com o áudio real.</p>
        <p style="font-size:var(--fs-sm);color:var(--text3);margin-bottom:20px">O arquivo fica só no seu aparelho e pode ser apagado depois:
        o app guarda a legenda, os cortes e os áudios extraídos.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="podcastOpen()">${ic('mic')}Buscar podcast</button>
          <button class="btn btn-secondary" onclick="videoPickFile()">${ic('plus')}Abrir arquivo</button>
        </div>
      </div>`
    return
  }

  area.innerHTML = `
    <div class="vid-lib">
      ${videos.map(v => {
        const nClips = clips.filter(c => c.videoId === v.id).length
        const dur = v.duration ? _vidFmtTime(v.duration) : '—'
        return `
        <div class="vid-lib-row" onclick="videoOpen('${v.id}')">
          <div class="vid-lib-icon">${v.podcast && v.podcast.artwork
            ? `<img class="vid-lib-art" src="${escA(v.podcast.artwork)}" alt="" loading="lazy">`
            : srcIcon(v.source_type || 'series')}</div>
          <div class="vid-lib-body">
            <div class="vid-lib-title">${esc(v.title)}</div>
            <div class="vid-lib-meta">
              ${v.podcast && v.podcast.showTitle ? `<span class="vid-lib-show">${esc(v.podcast.showTitle)}</span>` : ''}
              ${v.source_type === 'stream' ? `<span class="vid-lib-online">assistir online</span>` : ''}
              <span>${dur}</span>
              <span>${v.cueCount ? v.cueCount + ' falas' : 'sem legenda'}</span>
              ${nClips ? `<span>${nClips} corte${nClips !== 1 ? 's' : ''}</span>` : ''}
              ${v.position > 15 ? `<span>parou em ${_vidFmtTime(v.position)}</span>` : ''}
              ${v.coverage != null ? `<span class="vid-cov">${v.coverage}% conhecido</span>` : ''}
            </div>
          </div>
          <!-- Menu único de card (UX-2): a lixeira solta no canto virou o
               mesmo menu da estante — destrutivo não fica a um clique nu. -->
          <button class="btn btn-ghost btn-sm" onclick="videoLibMenu(event,'${v.id}')" data-tip="Opções">${ic('chevronDown','ic-sm')}</button>
        </div>`
      }).join('')}
    </div>`
}

function videoLibMenu(ev, id) {
  const v = videos.find(x => x.id === id); if (!v) return
  cardMenu(ev, id, `
    <button onclick="cardMenuFechar();videoOpen('${id}')">${ic('play','ic-sm')} ${v.podcast ? 'Ouvir agora' : 'Assistir agora'}</button>
    <div class="est-menu-sep"></div>
    <button class="perigo" onclick="cardMenuFechar();videoDelete('${id}')">${ic('trash','ic-sm')} Remover da lista</button>`)
}

async function videoDelete(id) {
  const v = videos.find(x => x.id === id); if (!v) return
  if (!(await confirmModal({ title: 'Remover vídeo da lista', icon: 'trash', danger: true, confirmText: 'Remover',
    html: `<p style="font-size:var(--fs-sm);color:var(--text2)">Remove <b>${esc(v.title)}</b> da lista, com a legenda e os marcadores.
      <b>Nada de estudo é apagado</b>: cards, cortes e áudios extraídos continuam.</p>` }))) return
  videos = videos.filter(x => x.id !== id); saveVideos()
  VideoDB.del('handles', id); VideoDB.del('subs', id)
  // podcast baixado ocupa dezenas de MB: sai junto (nada de órfão no disco)
  VideoDB.del('files', id); VideoDB.del('media', id)
  // ⚠️ E DA NUVEM TAMBÉM — aqui, e SÓ aqui. "Remover da lista" é a decisão de
  // não estudar mais isto; deixar a cópia lá comeria a cota e o episódio
  // reapareceria sozinho. Diferente de "liberar espaço", que é o oposto: lá o
  // arquivo sai só deste aparelho, de propósito, para poder voltar depois.
  if (typeof midiaApagarDaNuvem === 'function') midiaApagarDaNuvem(id)
  autoSyncAfterChange()
  renderVideoLib()
}

// ================================================================
// ABRIR ARQUIVO
// ================================================================
async function videoPickFile() {
  // File System Access (Chrome/Edge desktop): o handle é persistível e o
  // app "lembra" do arquivo nas próximas visitas.
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Vídeo ou podcast', accept: { 'video/*': ['.mp4', '.mkv', '.webm', '.mov', '.avi'], 'audio/*': ['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.flac'] } }]
      })
      const file = await handle.getFile()
      await videoAcceptFile(file, handle)
      return
    } catch (e) { if (e.name === 'AbortError') return }
  }
  // Fallback universal
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = 'video/*,audio/*,.mkv,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac'
  inp.onchange = () => { if (inp.files[0]) videoAcceptFile(inp.files[0], null) }
  inp.click()
}

// Entrada única (picker, fallback e testes): registra/reencontra o vídeo
// pelo par nome+tamanho e abre o player.
async function videoAcceptFile(file, handle) {
  let v = videos.find(x => x.fileName === file.name && x.fileSize === file.size)
  if (!v) {
    v = {
      id: uid(),
      title: file.name.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ').trim(),
      source_type: 'series',
      lang: (typeof activeLang === 'function' ? activeLang() : 'en'),
      fileName: file.name, fileSize: file.size,
      duration: 0, cueCount: 0, coverage: null, markers: [],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }
    videos.unshift(v); saveVideos(); autoSyncAfterChange()
    // Mesmo motivo do livro: o nome limpo se resolve NA ENTRADA, para que
    // tudo capturado daqui ja nasca com o nome certo na tela. Uma chamada
    // por episodio, em segundo plano.
    if (typeof resolverNomesDeObra === 'function' && aiChatCfg().key) {
      resolverNomesDeObra([v.title]).catch(e => console.warn('[obra]', e && e.message))
    }
  }
  if (handle) VideoDB.set('handles', v.id, handle)
  _vidFile = file
  await videoOpenPlayer(v)
}

// Ponte da seção Assistir: abre o player com uma URL de fonte já resolvida.
// A URL é transitória (expira) — vive só em runtime, nunca em videos[].
async function videoOpenStream(v, url) {
  _vidFile = null
  _vidStreamSrc = url
  await videoOpenPlayer(v)
}

// Reabre um vídeo da biblioteca (tenta o handle persistido primeiro).
//
// ⚠️ `silencioso` EXISTE POR CAUSA DA VOLTA AUTOMÁTICA. Quando o app reabre
// sozinho o que estava aberto (ver `ondeEstavaRestaurar`), esta função não
// pode pedir NADA: sem o handle autorizado ela mostra um toast e abre o
// seletor de arquivos do sistema — um diálogo brotando sozinho ao iniciar o
// app, sem ele ter clicado em nada. No modo silencioso ela desiste e deixa a
// biblioteca na tela, que é a resposta honesta.
async function videoOpen(id, { silencioso = false } = {}) {
  const v = videos.find(x => x.id === id); if (!v) return
  // Entrada de STREAM (addon): a URL expira, então quem reabre é a seção
  // Assistir, que re-resolve a fonte. Nunca pede arquivo ao usuário.
  if (v.source_type === 'stream') {
    if (silencioso) return
    if (typeof assistirReabrir === 'function') assistirReabrir(v)
    else toast('Abra pela seção Assistir para tocar esta fonte de novo', 'info')
    return
  }
  // Podcast: o "arquivo" é o episódio baixado (ou baixável de novo pela URL
  // do feed). Nunca pede arquivo ao usuário — nem em outro aparelho.
  if (v.podcast && typeof podcastEnsureFile === 'function') {
    const ok = await podcastEnsureFile(v)
    if (!ok && !v.podcast.audioUrl) { toast('Não consegui recuperar o áudio deste episódio', 'error'); return }
    await videoOpenPlayer(v)
    return
  }
  const handle = await VideoDB.get('handles', id)
  if (handle) {
    try {
      let perm = await handle.queryPermission({ mode: 'read' })
      // Pedir permissão abre uma caixa do navegador: só quando ELE mandou abrir.
      if (perm !== 'granted' && silencioso) return
      if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'read' })
      if (perm === 'granted') {
        _vidFile = await handle.getFile()
        await videoOpenPlayer(v)
        return
      }
    } catch (e) { console.warn('[video] handle inválido:', e.message) }
  }
  if (silencioso) return          // nada de seletor de arquivo sem ele pedir
  toast('Escolha o arquivo do vídeo (o navegador não o guarda — só o atalho)', 'info')
  if (window.showOpenFilePicker) {
    try {
      const [h] = await window.showOpenFilePicker({ types: [{ description: 'Vídeo ou podcast', accept: { 'video/*': ['.mp4', '.mkv', '.webm', '.mov', '.avi'], 'audio/*': ['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.flac'] } }] })
      const file = await h.getFile()
      // Reaponta o registro existente para o arquivo escolhido
      v.fileName = file.name; v.fileSize = file.size; v.updated_at = new Date().toISOString()
      saveVideos(); VideoDB.set('handles', v.id, h)
      _vidFile = file
      await videoOpenPlayer(v)
    } catch (e) { if (e.name !== 'AbortError') console.warn(e) }
  } else {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = 'video/*,audio/*,.mkv,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac'
    inp.onchange = async () => {
      if (!inp.files[0]) return
      _vidFile = inp.files[0]
      v.fileName = _vidFile.name; v.fileSize = _vidFile.size; saveVideos()
      await videoOpenPlayer(v)
    }
    inp.click()
  }
}

// ================================================================
// PLAYER + TRANSCRIPT
// ================================================================
async function videoOpenPlayer(v) {
  setTimeout(() => { if (typeof ondeEstavaSalvar === 'function') ondeEstavaSalvar() }, 0)
  if (_vidSubsSaveTimer) _vidSaveSubsNow()   // flush do vídeo anterior
  _vidCur = v
  _videoView = 'player'
  _vidSel = null; _vidSelWords = new Set(); _vidLoop = false; _vidPlayStop = null; _vidCueIdx = -1

  // ================================================================
  // LOCAL × NUVEM: O MAIS NOVO VENCE (rodada 45)
  // ================================================================
  // Antes a nuvem só era consultada com o local VAZIO — e nunca era corrigida
  // quando ficava para trás. Foi assim que uma sincronização feita aqui se
  // perdeu: o upload dela falhou calado, o local sumiu depois, e a nuvem
  // devolveu a versão pré-sincronização como se fosse a boa. Agora o pacote
  // tem carimbo (`at`), o vídeo guarda nos metadados sincronizados o carimbo
  // do que a nuvem TEM (`legendaAt`, barato de comparar sem baixar nada), e a
  // abertura corrige o lado perdedor — nos dois sentidos.
  const temCues = d => !!(d && (d.cues || []).length)
  let stored = await VideoDB.get('subs', v.id)
  // LEGADO: pacote local sem carimbo é a verdade DESTE aparelho (inclui a
  // sincronização que ele fez e vê funcionar). Carimba uma vez; a autocura
  // abaixo o torna a versão canônica da nuvem.
  if (temCues(stored) && !stored.at) {
    stored.at = Date.now(); stored.v = 2
    try { await VideoDB.set('subs', v.id, stored) } catch (e) {}
  }
  const localAt = temCues(stored) ? (Number(stored.at) || 0) : 0
  const nuvemAt = Number(v.legendaAt) || 0
  if (typeof legendaBaixar === 'function' && (!temCues(stored) || nuvemAt > localAt)) {
    const daNuvem = await legendaBaixar(v.id)
    if (temCues(daNuvem) && (Number(daNuvem.at) || 0) >= localAt) {
      const recuperou = !temCues(stored)
      stored = daNuvem
      try { await VideoDB.set('subs', v.id, daNuvem) } catch (e) {}
      toast(recuperou
        ? 'Legenda recuperada da sua nuvem' + (daNuvem.sync ? ' — com a sincronização que você fez' : '')
        : 'Legenda atualizada: a sua nuvem tinha uma versão mais nova (sincronizada no outro aparelho)', 'success')
    }
  }
  _vidCues = (stored && stored.cues) || []
  _vidCuesPT = (stored && stored.cuesPT) || []
  _vidSubCandidates = (stored && stored.candidates) || []
  _vidAppliedSubUrl = (stored && stored.appliedUrl) || null
  if (typeof _vidSyncInfo !== 'undefined') _vidSyncInfo = (stored && stored.sync) || null
  // O raio-X vem no MESMO pacote — e o rótulo guardado envelhece (ele estuda a
  // palavra, marca "já sei"): a revalidação de sempre, a mesma do leitor.
  _vidRaioX = (stored && stored.raiox) || null
  if (_vidRaioX && Array.isArray(_vidRaioX.itens) && typeof aiRevalidarAchados === 'function') {
    _vidRaioX.itens = aiRevalidarAchados(_vidRaioX.itens,
      { source_title: v.title || '', source_context: '' })
  }
  // AUTOCURA DO OUTRO LADO: o local é mais novo do que a nuvem conhece — um
  // upload falhou um dia. Re-sobe agora, e o carimbo só avança se confirmar.
  if (temCues(stored) && (Number(stored.at) || 0) > nuvemAt && typeof legendaSubir === 'function') {
    const pacote = stored, alvo = v
    legendaSubir(alvo.id, pacote).then(ok => {
      if (!ok) return
      alvo.legendaAt = Number(pacote.at) || 0
      alvo.updated_at = new Date().toISOString()
      saveVideos()
      if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
      console.info('[video] legenda local mais nova re-enviada à nuvem (autocura)')
    }).catch(() => {})
  }
  _vidFocus = null
  // Realinha a trilha PT a cada abertura: é barato (<50ms) e corrige dados
  // salvos por versões antigas do alinhador (sem estimativa de offset).
  // O carimbo é PRESERVADO: abrir não é mudar, e um `at` novo aqui faria
  // conteúdo velho vencer a comparação só por ter sido aberto por último.
  if (_vidCues.length && _vidCuesPT.length) {
    if (typeof _vidSubsPreservaAt !== 'undefined') _vidSubsPreservaAt = (stored && Number(stored.at)) || 0
    _vidAlignPTTrack(); _vidSaveSubs()
  }
  _vidRestaurarPT()
  // trocar de vídeo tem de zerar a régua (senão ela desliza com os tempos
  // do vídeo anterior — o mesmo problema que a extensão tinha na Netflix)
  _vidRuleIni = null; _vidRuleTrack = null; _vidRuleCur = null

  if (_vidURL) { URL.revokeObjectURL(_vidURL); _vidURL = null }
  // Origem do áudio/vídeo: o arquivo local sempre que existir. Podcast sem
  // arquivo (CORS do CDN bloqueou o download) toca por STREAMING — com
  // crossorigin para o captureStream do áudio da cena continuar valendo
  // quando o servidor permite.
  const ehPod = !!v.podcast
  _vidStream = false
  let src = ''
  if (_vidFile) { _vidURL = URL.createObjectURL(_vidFile); src = _vidURL }
  else if (ehPod && v.podcast.audioUrl) { src = v.podcast.audioUrl; _vidStream = true }
  // Fonte de addon (Assistir): a URL foi resolvida agora e é transitória.
  // O caminho de streaming (crossorigin + fallback de CORS) já existe abaixo.
  else if (v.source_type === 'stream' && _vidStreamSrc) { src = _vidStreamSrc; _vidStream = true }

  const acts = el('video-ph-actions')
  if (acts) acts.innerHTML = `
    ${ehPod
      ? `<button class="btn btn-secondary btn-sm" onclick="videoTranscribeFull()" data-tip="Podcast não tem legenda pronta: a IA escuta o episódio e escreve uma, já sincronizada">${ic('sparkles')}Criar legenda com IA</button>`
      : `<button class="btn btn-secondary btn-sm" onclick="videoSubSearchOpen()" data-tip="Buscar legenda online (addons do Stremio — OpenSubtitles e outros)">${ic('search')}Buscar legenda</button>`}
    <button class="btn btn-ghost btn-sm" onclick="videoImportSubPick()" data-tip="Importar arquivo .srt/.vtt do computador">${ic('upload')}Importar</button>
    <button class="btn btn-secondary btn-sm" onclick="videoPrepare()" data-tip="Cruza a legenda com seu vocabulário: o que você ainda não conhece neste episódio">${ic('sparkles')}Preparar para assistir</button>
    ${ehPod && !_vidStream ? `<button class="btn btn-ghost btn-sm" onclick="podcastFreeSpace()" data-tip="Apaga só o áudio baixado; legenda, cortes e cards continuam">${ic('trash')}Liberar espaço</button>` : ''}
    <button class="btn btn-ghost btn-sm" onclick="videoBackToLib()">${ic('undo')}Biblioteca</button>`

  const area = el('video-area'); if (!area) return
  area.innerHTML = `
    <div class="vid-layout">
      <div class="vid-main">
        <div class="vid-stage${ehPod || /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test(_vidCur.fileName || '') ? ' vid-audio' : ''}">
          ${ehPod && v.podcast.artwork ? `<img class="vid-pod-art" src="${escA(v.podcast.artwork)}" alt="">` : ''}
          <!-- ⚠️ escA no src (rodada 44): em podcast por streaming a URL vem
               crua do enclosure do RSS — uma aspa no feed fechava o atributo e
               injetava o que quisesse na origem do app, onde vivem as chaves. -->
          <video id="vid-player" src="${escA(src)}" controls preload="metadata"${_vidStream ? ' crossorigin="anonymous"' : ''}></video>
          <div class="vid-ov" id="vid-ov">
            <span class="vid-ov-en" id="vid-ov-en" title="Arraste para selecionar um trecho; clique duplo seleciona a palavra"></span>
            <span class="vid-ov-pt" id="vid-ov-pt"></span>
          </div>
          <div class="vid-ov-pop hidden" id="vid-ov-pop"></div>
          <button class="vid-skipbtn left" onclick="videoSkip(-5)" data-tip="Voltar 5s (Shift+←)">−5s</button>
          <button class="vid-skipbtn right" onclick="videoSkip(5)" data-tip="Avançar 5s (Shift+→)">+5s</button>
          <div class="vid-pt-minis">
            <button class="vid-pt-mini ${_vidPTmode === 'sub' ? 'on' : ''}" id="vid-mini-sub" onclick="videoSetPT('sub')" data-tip="Tradução da legenda PT-BR"><svg class="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M10.5 10.3a2.4 2.4 0 1 0 0 3.4M17.2 10.3a2.4 2.4 0 1 0 0 3.4"/></svg></button>
            <button class="vid-pt-mini ${_vidPTmode === 'ia' ? 'on' : ''}" id="vid-mini-ia" onclick="videoSetPT('ia')" data-tip="Tradução literal pela IA (tempo real)">${ic('sparkles','ic-sm')}</button>
            <button class="vid-pt-mini ${_vidPTfog ? 'on' : ''}" id="vid-mini-fog" onclick="videoToggleFog()" data-tip="Névoa: borrada até o hover">${ic('eye','ic-sm')}</button>
          </div>
          <button class="vid-skipbtn vid-cuebtn left" onclick="videoCueNav(-1)" data-tip="Fala anterior (←) — de novo no meio de uma fala volta ao início dela">‹‹</button>
          <button class="vid-skipbtn vid-cuebtn right" onclick="videoCueNav(1)" data-tip="Próxima fala (→)">››</button>
        </div>
        <div class="vid-rule hidden" id="vid-rule" onclick="videoRuleClick(event)"
          data-tip="Régua de falas: cada bloco é uma fala e o vão é silêncio. Clique para ir até lá."></div>
        <div id="vid-audiofix-banner"></div>
        <div id="vid-sync-panel" class="hidden"></div>
        <!-- A ARRUMAÇÃO DA TOOLBAR (rodada 47): 9 botões soltos viravam duas
             linhas sem hierarquia. Agora são TRÊS grupos por categoria, com
             separador visual: ASSISTIR (repetir/marcar) · TRADUÇÃO (os dois
             modos como controle segmentado — a exclusividade fica visível —
             + névoa e "traduzir tudo" contextuais) · TELA (legenda no vídeo,
             sync, tela cheia). "Seguir" mudou para o cabeçalho do transcript,
             que é a coisa que ele rola. Nenhum handler mudou de nome. -->
        <div class="vid-toolbar">
          <span class="vid-title" data-tip="${escA(ehPod ? (v.podcast.showTitle || v.fileName) : v.fileName)}">${esc(v.title)}</span>
          <span style="flex:1"></span>
          <div class="vid-tb-group">
            <button class="btn btn-ghost btn-sm" onclick="videoReplayCue()" data-tip="A frase passou? Volta ao início da fala atual/última (tecla R)">${ic('undo','ic-sm')}Repetir fala</button>
            <button class="btn btn-ghost btn-sm" id="vid-mark-btn" onclick="videoAddMarker()" data-tip="Marca o INÍCIO do trecho; o 2º clique (ou tecla M) fecha e abre o estudo focado">${ic('flame','ic-sm')}Marcar</button>
            <button class="btn btn-ghost btn-sm" id="vid-sono" onclick="videoSonoMenu(event)" data-tip="Timer de sono: pausa sozinho depois do tempo escolhido — podcast na cama sem perder o fio">${ic('clock','ic-sm')}Sono</button>
          </div>
          <div class="vid-tb-group">
            <div class="vid-seg" data-tip="Tradução sob a legenda — um modo por vez; clicar de novo desliga">
              <button class="btn btn-ghost btn-sm ${_vidPTmode === 'sub' ? 'vid-on' : ''}" id="vid-pt-sub" onclick="videoSetPT('sub')" data-tip="Tradução da LEGENDA PT-BR oficial, sob a original"><svg class="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M10.5 10.3a2.4 2.4 0 1 0 0 3.4M17.2 10.3a2.4 2.4 0 1 0 0 3.4"/></svg>PT legenda</button>
              <button class="btn btn-ghost btn-sm ${_vidPTmode === 'ia' ? 'vid-on' : ''}" id="vid-pt-ia" onclick="videoSetPT('ia')" data-tip="Tradução LITERAL pela IA em tempo real — só o que você está vendo (+5s)">${ic('sparkles','ic-sm')}PT IA</button>
            </div>
            <button class="btn btn-ghost btn-sm ${_vidPTfog ? 'vid-on' : ''}" id="vid-fog-toggle" onclick="videoToggleFog()" style="${_vidPTmode === 'off' ? 'display:none' : ''}" data-tip="Névoa: a tradução fica borrada até passar o mouse (treino de recall). Clique para mostrar sempre.">${ic('eye','ic-sm')}Névoa</button>
            <button class="btn btn-ghost btn-sm" id="vid-pt-full" onclick="videoTraduzirClick()" style="display:none" data-tip="">${ic('sparkles','ic-sm')}Traduzir tudo</button>
          </div>
          <div class="vid-tb-group">
            <button class="btn btn-ghost btn-sm ${_vidOverlayOn ? 'vid-on' : ''}" id="vid-ov-toggle" onclick="videoToggleOverlay()" data-tip="Legenda sobre o vídeo, em tempo real">${ic('message','ic-sm')}Legenda</button>
            <button class="btn btn-ghost btn-sm" id="vid-sync-btn" onclick="videoSyncToggle()" data-tip="Legenda fora de sincronia? Ajuste manual ou automático com IA">${ic('clock','ic-sm')}Sync${(v.subShift || 0) ? ` <span class="vid-sync-shift">${v.subShift > 0 ? '+' : ''}${(+v.subShift).toFixed(1)}s</span>` : ''}</button>
            <button class="btn btn-ghost btn-sm" onclick="videoToggleFullscreen()" data-tip="Tela cheia COM a legenda interativa (o botão do player usa a legenda nativa)"><svg class="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>Tela cheia</button>
          </div>
        </div>
        <div id="vid-sel-panel"></div>
        <div id="vid-markers"></div>
      </div>
      <div class="vid-transcript-wrap">
        <div class="vid-transcript-head">
          <span>Transcript</span>
          <span id="vid-raiox-slot"></span>
          <span style="flex:1"></span>
          <button class="vid-th-btn ${_vidAutoScroll ? 'vid-on' : ''}" id="vid-scroll-toggle" onclick="videoToggleScroll()" data-tip="Rolagem automática: o transcript acompanha a fala atual">${ic('arrowRight','ic-sm')}Seguir</button>
          <span id="vid-cue-count">${_vidCues.length ? _vidCues.length + ' falas' : ''}</span>
        </div>
        <div class="vid-transcript" id="vid-transcript" ondragover="event.preventDefault()" ondrop="videoDropSub(event)"></div>
      </div>
    </div>`

  const player = el('vid-player')
  player.addEventListener('loadedmetadata', () => {
    // isFinite: webm gravado por MediaRecorder reporta duração Infinity
    if (isFinite(player.duration) && player.duration && Math.abs((v.duration || 0) - player.duration) > 1) {
      v.duration = Math.round(player.duration); v.updated_at = new Date().toISOString()
      saveVideos(); autoSyncAfterChange()
    }
  })
  player.addEventListener('timeupdate', _vidOnTime)
  // ⚠️ O GLOSSÁRIO NAS DUAS SUPERFÍCIES DE TEXTO DO VÍDEO — a legenda sobre a
  // imagem e o transcript ao lado. O leitor, o Preparar e o Assistente já
  // tinham; a legenda ficou de fora por medo do repinte, e o medo era do
  // problema errado: `glossAtivar` põe UM ouvinte no contêiner e acha a palavra
  // por COORDENADA, então repintar os filhos não deixa ouvinte órfão nenhum.
  // Ativar UMA vez basta (a própria função tem o guarda `_glossOn`), e é aqui
  // que "uma vez" acontece: na montagem do player.
  if (typeof glossAtivar === 'function') {
    const ov = el('vid-ov'), tr = el('vid-transcript')
    if (ov) glossAtivar(ov)
    if (tr) glossAtivar(tr)
  }
  // O chip do raio-X — a MESMA peça do leitor e do audiolivro (difChipLigar,
  // em ai.js), com as mesmas duas saídas: Preparar e "já sei este sentido".
  // Ligado nas DUAS superfícies de texto, como o glossário logo acima: o
  // transcript e a legenda sobre o vídeo.
  if (typeof difChipLigar === 'function') {
    const cfgChip = {
      classe: 'dif-pop-app',
      item: mk => (_vidRaioX && Array.isArray(_vidRaioX.itens)) ? _vidRaioX.itens[Number(mk.dataset.i)] : null,
      preparar: mk => { if (typeof videoRaioXPreparar === 'function') videoRaioXPreparar(mk) },
      jaSei: mk => { if (typeof videoRaioXJaSei === 'function') videoRaioXJaSei(mk) }
    }
    const tr2 = el('vid-transcript')
    if (tr2) difChipLigar(tr2, cfgChip)
    const ov2 = el('vid-ov')
    if (ov2) difChipLigar(ov2, cfgChip)
  }
  // O botão de tradução nasce dizendo a verdade do estado (rodada 49):
  // falta → "Traduzir tudo" · coberta (IA ou trilha importada) → "Retraduzir".
  if (typeof _vidPTfullStatus === 'function') _vidPTfullStatus(null)
  // MOUSE NA LEGENDA = PAUSA (rodada 51, pedido dele). Ler com calma, marcar,
  // abrir o chip — tudo isso briga com o vídeo andando. Só a legenda recebe
  // mouse (pointer-events fica nos spans), então hover em outra parte do vídeo
  // não pausa nada. A retomada espera 250ms (pular do inglês para a tradução
  // não faz o vídeo gaguejar) e segura enquanto houver balão aberto
  // (glossário, chip do raio-X ou seleção). Play manual devolve o comando.
  _vidHoverPausou = false
  clearTimeout(_vidHoverTimer); _vidHoverTimer = null
  {
    const ov3 = el('vid-ov')
    const balaoAberto = () =>
      (typeof glossAberto === 'function' && glossAberto()) ||
      (typeof _difPop !== 'undefined' && _difPop && document.body.contains(_difPop)) ||
      (el('vid-ov-pop') && !el('vid-ov-pop').classList.contains('hidden'))
    const retomar = () => {
      _vidHoverTimer = null
      if (!_vidHoverPausou) return
      if (balaoAberto()) { _vidHoverTimer = setTimeout(retomar, 300); return }
      const p = el('vid-player')
      _vidHoverPausou = false
      if (p && p.paused) p.play()
    }
    if (ov3) {
      ov3.addEventListener('mouseenter', () => {
        clearTimeout(_vidHoverTimer); _vidHoverTimer = null
        const p = el('vid-player')
        if (p && !p.paused) { p.pause(); _vidHoverPausou = true }
      })
      ov3.addEventListener('mouseleave', () => {
        if (!_vidHoverPausou) return
        clearTimeout(_vidHoverTimer)
        _vidHoverTimer = setTimeout(retomar, 250)
      })
    }
  }

  // ---- Retomar de onde parou ----
  // A posição é salva a cada ~5s de reprodução (e no pause/saída). Na volta,
  // recua 2s para dar contexto. Perto do fim (<20s) não retoma; 'ended' zera.
  player.addEventListener('loadedmetadata', () => {
    const pos = v.position || 0
    if (pos > 15 && (!isFinite(player.duration) || pos < player.duration - 20)) {
      player.currentTime = Math.max(0, pos - 2)
      toast(`Retomando de ${_vidFmtTime(pos)} — de onde você parou`, 'info')
    }
  }, { once: true })
  player.addEventListener('pause', _vidSavePos)
  player.addEventListener('ended', () => { v.position = 0; saveVideos() })
  // Play manual com o mouse ainda na legenda: o comando volta para ele —
  // o hover não pode "devolver" uma pausa que já não é dele.
  player.addEventListener('play', () => {
    if (_vidHoverPausou) { _vidHoverPausou = false; clearTimeout(_vidHoverTimer); _vidHoverTimer = null }
  })

  // Fone, tela de bloqueio e botão do carro — o mesmo bloco do audiolivro
  // (melhoria 3, rodada 44). Podcast com a tela apagada é o caso de uso
  // inteiro: sem isto, a notificação de mídia do sistema não tinha título,
  // capa, barra nem botões — e as setas do fone não pulavam de fala.
  _vidMediaSession(v, player)

  // Streaming com crossorigin: se o servidor NÃO manda CORS, o elemento nem
  // carrega. Recarrega sem o atributo (toca, mas sem captureStream) em vez de
  // deixar o player mudo e sem explicação.
  if (_vidStream) {
    player.addEventListener('error', () => {
      if (!player.crossOrigin) return
      player.crossOrigin = null
      player.src = src
      player.load()
      toast('Este servidor não libera a leitura do áudio: dá para ouvir, mas não para gravar a fala em card', 'warning')
    }, { once: true })
  }

  // Áudio consertado de sessão anterior? Reanexa. Senão, arma o detector de
  // áudio mudo (MKV com Dolby/DTS: o Chrome toca o vídeo e cala o áudio).
  // Podcast é mp3/m4a: nada disso se aplica (e o ffmpeg não teria arquivo).
  _vidFixAudio = null
  if (!ehPod) {
    const fixedBlob = await VideoDB.get('media', v.id)
    if (fixedBlob) _vidAttachFixedAudio(fixedBlob)
    else _vidArmSilentDetector(player)
  }

  renderVidTranscript()
  renderVidMarkers()
  renderVidSelPanel()
  _vidOvBind()          // seleção na legenda sobre o vídeo
  // Busca automática nos addons só faz sentido para série/filme — para
  // podcast ela procuraria um título de episódio no OpenSubtitles à toa.
  if (!_vidCues.length && !ehPod) _vidAutoSub()


  // Tecla M marca o momento (só com a seção ativa e fora de inputs)
  if (!window._vidKeysBound) {
    window._vidKeysBound = true
    document.addEventListener('keydown', e => {
      if (e.key.toLowerCase() !== 'm' || e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return
      if (!document.getElementById('section-video')?.classList.contains('active')) return
      if (_videoView !== 'player' || !el('vid-player')) return
      videoAddMarker()
    })
  }
}

function videoBackToLib() {
  _vidSavePos()
  // Flush ANTES de anular _vidCur: o save debounced (1,5s) aborta sem ele —
  // sair rápido do player perdia a última mudança de legenda (bug real).
  if (_vidSubsSaveTimer) _vidSaveSubsNow()
  const p = el('vid-player'); if (p) p.pause()
  if (typeof videoSonoCancelar === 'function') videoSonoCancelar()
  if (_vidURL) { URL.revokeObjectURL(_vidURL); _vidURL = null }
  _vidCur = null; _vidFile = null; _vidStream = false; _vidStreamSrc = null
  renderVideoLib()
}

function _vidFmtTime(sec) {
  if (!isFinite(sec)) return '—'
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0')
}

// ---- Karaokê: destaca a fala corrente e segue a reprodução ----
function _vidOnTime() {
  const p = el('vid-player'); if (!p) return
  const t = p.currentTime

  // Posição para o "continuar de onde parou" (grava a cada ~5s de avanço)
  if (_vidCur && Math.abs(t - (_vidCur.position || 0)) > 5) {
    _vidCur.position = +t.toFixed(1); saveVideos()
  }

  // Áudio consertado: corrige deriva além de 300ms
  if (_vidFixAudio && !p.paused && Math.abs(_vidFixAudio.currentTime - t) > 0.3) {
    _vidFixAudio.currentTime = t
  }

  // Fim de trecho selecionado: para (ou loopa)
  if (_vidPlayStop != null && t >= _vidPlayStop) {
    if (_vidLoop && _vidSel) { p.currentTime = _vidSel.s; return }
    p.pause(); _vidPlayStop = null
  }

  if (!_vidCues.length) return
  let idx = _vidCueIdx
  const inCue = i => i >= 0 && i < _vidCues.length && t >= _vidCues[i].s && t <= _vidCues[i].e
  if (!inCue(idx)) {
    idx = -1
    for (let i = 0; i < _vidCues.length; i++) { if (inCue(i)) { idx = i; break } if (_vidCues[i].s > t) break }
  }
  if (idx === _vidCueIdx) return
  const old = document.querySelector('.vid-cue.cur')
  if (old) old.classList.remove('cur')
  _vidCueIdx = idx
  // Troca de fala fecha o popup de seleção — EXCETO com uma explicação da IA
  // ainda carregando (senão a resposta chegava com o popup já escondido)
  const _pop = el('vid-ov-pop')
  if (_pop && !_pop.querySelector('.gen-spinner')) _pop.classList.add('hidden')
  if (idx >= 0) {
    const elCue = document.querySelector(`.vid-cue[data-i="${idx}"]`)
    if (elCue) {
      elCue.classList.add('cur')
      if (_vidAutoScroll) elCue.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    // Tradução simultânea via IA: garante a fala atual + as 3 próximas
    if (_vidPTmode === 'ia') _vidEnsurePTAhead(t)
  if (_vidRuleIni == null && _vidCues.length) _vidMontarRule(t)
  }
  _vidUpdateOverlay()
}

// ---- RÉGUA DE FALAS (deslizante) -----------------------------------
// Cada bloco é uma fala: largura = duração, vão = silêncio. O trilho é
// montado UMA vez em pixels e depois só DESLIZA (transform por frame),
// em vez de ser repintado — é o que dá o movimento macio.
const VID_RULE_PXS = 16      // pixels por segundo de vídeo
const VID_RULE_BLOCO = 300   // segundos montados de cada vez
let _vidRuleTrack = null, _vidRuleRaf = null, _vidRuleIni = null, _vidRuleCur = null

function _vidMontarRule(t) {
  const el = el2('vid-rule'); if (!el) return
  if (!_vidCues.length) { el.classList.add('hidden'); _vidRuleIni = null; return }
  el.classList.remove('hidden')
  _vidRuleIni = Math.max(0, t - VID_RULE_BLOCO / 2)
  const fim = _vidRuleIni + VID_RULE_BLOCO
  let html = ''
  for (const c of _vidCues) {
    if (c.e < _vidRuleIni) continue
    if (c.s > fim) break
    html += `<i class="vid-rb" data-t="${c.s}"
      style="left:${((c.s - _vidRuleIni) * VID_RULE_PXS).toFixed(1)}px;width:${Math.max((c.e - c.s) * VID_RULE_PXS, 4).toFixed(1)}px"
      data-tip="${escA(String(c.t).slice(0, 90))}"></i>`
  }
  let track = el.querySelector('.vid-rtrack')
  if (!track) {
    el.innerHTML = '<div class="vid-rtrack"></div><b class="vid-rnow"></b>'
    track = el.querySelector('.vid-rtrack')
  }
  track.innerHTML = html
  _vidRuleTrack = track
  _vidRuleCur = null
  if (!_vidRuleRaf) _vidRuleLoop()
}

function _vidRuleLoop() {
  _vidRuleRaf = requestAnimationFrame(_vidRuleLoop)
  const p = el2('vid-player')
  if (!p || !_vidRuleTrack || !_vidCues.length || _vidRuleIni == null) return
  if (!document.body.contains(_vidRuleTrack)) {     // player fechado: encerra o loop
    cancelAnimationFrame(_vidRuleRaf); _vidRuleRaf = null; _vidRuleTrack = null; _vidRuleIni = null
    return
  }
  const t = p.currentTime
  if ((t < _vidRuleIni + 20 && _vidRuleIni > 0) || t > _vidRuleIni + VID_RULE_BLOCO - 20) {
    _vidMontarRule(t); return
  }
  const meio = _vidRuleTrack.parentElement.clientWidth / 2
  _vidRuleTrack.style.transform = `translate3d(${(meio - (t - _vidRuleIni) * VID_RULE_PXS).toFixed(2)}px,0,0)`
  const i = _vidCueIndexAt(t)
  const alvo = (i >= 0 && t <= _vidCues[i].e + 0.25) ? String(_vidCues[i].s) : null
  if (alvo !== _vidRuleCur) {
    _vidRuleTrack.querySelector('.vid-rb.cur')?.classList.remove('cur')
    if (alvo) _vidRuleTrack.querySelector(`.vid-rb[data-t="${alvo}"]`)?.classList.add('cur')
    _vidRuleCur = alvo
  }
}

function videoRuleClick(ev) {
  const b = ev.target.closest('.vid-rb'); if (!b) return
  const p = el2('vid-player'); if (!p) return
  p.currentTime = Math.max(0, parseFloat(b.dataset.t) - 0.15)
  p.play()
}
const el2 = id => document.getElementById(id)

// Legenda em tempo real sobre o vídeo (EN + PT quando ligado)
function _vidUpdateOverlay() {
  const en = el('vid-ov-en'), pt = el('vid-ov-pt')
  if (!en || !pt) return
  const pop = el('vid-ov-pop')
  if (pop && !pop.classList.contains('hidden')) return   // seleção em curso
  // ⚠️ E O GLOSSÁRIO CONGELA A LEGENDA PELO MESMO MOTIVO. Era esta a
  // dificuldade real de trazer o glossário para cá — e não os ouvintes, como
  // a pendência supunha: `glossAtivar` põe UM ouvinte no contêiner e acha a
  // palavra por coordenada, então repintar os filhos não órfã nada. O que
  // quebra é a FRASE mudar debaixo de um balão aberto: a glosa continua na
  // tela descrevendo uma palavra que já saiu dali.
  if (typeof glossAberto === 'function' && glossAberto()) return
  // O chip do raio-X congela a legenda pelo MESMO motivo do glossário: a fala
  // não pode trocar debaixo de um balão aberto descrevendo o que já saiu.
  if (typeof _difPop !== 'undefined' && _difPop && document.body.contains(_difPop)) return
  const cue = _vidCueIdx >= 0 ? _vidCues[_vidCueIdx] : null
  const showEN = _vidOverlayOn && cue
  // O raio-X acende TAMBÉM aqui: a legenda sobre o vídeo é onde ele passa a
  // maior parte do tempo — deixar as marcas só no transcript escondia o achado
  // exatamente na hora em que a expressão é dita. Mesma pintura, mesmos índices.
  if (showEN) {
    const ritens = (_vidRaioX && Array.isArray(_vidRaioX.itens)) ? _vidRaioX.itens : null
    en.innerHTML = (ritens && typeof _vidFalaPintada === 'function')
      ? _vidFalaPintada(cue.t, ritens) : esc(cue.t)
  } else en.textContent = ''
  en.style.display = showEN ? '' : 'none'
  const ptTxt = showEN ? _vidPTshow(cue) : ''
  pt.className = 'vid-ov-pt' + (_vidPTfog ? ' fog' : '')
  pt.textContent = ptTxt
  pt.style.display = ptTxt ? '' : 'none'
}

// Tradução de uma fala, na ordem de preferência:
// pt (IA, pedida explicitamente) > pts (legenda PT-BR oficial alinhada)
function _vidPTof(cue) { return (cue && (cue.pt || cue.pts)) || '' }

function videoToggleScroll() {
  _vidAutoScroll = !_vidAutoScroll
  el('vid-scroll-toggle')?.classList.toggle('vid-on', _vidAutoScroll)
}

// ---- Timer de sono (UX-4, rodada 55) — a peça do audiolivro, portada. ----
// Quem ouve PODCAST ouve deitado; dormir sem isto custa quarenta minutos de
// episódio para reencontrar amanhã. O menu é o cardMenu único da casa (52ª).
let _vidSono = null            // { fim, timer }
function videoSonoMenu(ev) {
  if (_vidSono) { videoSonoCancelar(); toast('Timer de sono desligado', 'info'); return }
  cardMenu(ev, 'vid-sono', `
    <div class="est-menu-sep">Parar em</div>
    ${[10, 20, 30, 45, 60].map(min => `<button onclick="cardMenuFechar();videoSonoLigar(${min})">${min} minutos</button>`).join('')}`)
}
function videoSonoLigar(min) {
  videoSonoCancelar()
  _vidSono = { fim: Date.now() + min * 60000 }
  _vidSono.timer = setTimeout(() => {
    el('vid-player')?.pause()
    videoSonoCancelar()
    toast('Timer de sono: pausado', 'info')
  }, min * 60000)
  toast(`Vou pausar em ${min} minutos`, 'info')
  const b = el('vid-sono'); if (b) { b.classList.add('vid-on'); b.innerHTML = `${ic('clock','ic-sm')}${min} min` }
}
function videoSonoCancelar() {
  if (_vidSono && _vidSono.timer) clearTimeout(_vidSono.timer)
  _vidSono = null
  const b = el('vid-sono'); if (b) { b.classList.remove('vid-on'); b.innerHTML = `${ic('clock','ic-sm')}Sono` }
}
function videoToggleOverlay() {
  _vidOverlayOn = !_vidOverlayOn
  el('vid-ov-toggle')?.classList.toggle('vid-on', _vidOverlayOn)
  _vidUpdateOverlay()
}
// Fonte da tradução conforme o MODO (o Djemeson pediu os dois canais bem
// distintos: a legenda PT-BR oficial pode divergir do literal — para estudo,
// a IA em tempo real traduz fiel, só o trecho que está sendo visto):
//   'sub' → cue.pts (trilha oficial alinhada) · 'ia' → cue.pt (IA)
//   'off' → nada (reveladas explicitamente continuam via _vidPTof)
function _vidPTshow(cue) {
  if (!cue || _vidPTmode === 'off') return ''
  return _vidPTmode === 'sub' ? (cue.pts || '') : (cue.pt || '')
}
function videoSetPT(modo) {
  if (!_vidCues.length) { toast('Importe ou busque a legenda primeiro', 'warning'); return }
  if (_vidPTmode === modo) {
    _vidPTmode = 'off'
  } else {
    if (modo === 'sub' && !_vidCues.some(c => c.pts)) {
      toast('Sem trilha PT-BR baixada — use "Buscar legenda" (a PT vem junto) ou a tradução por IA', 'warning'); return
    }
    // já traduzida por inteiro? então não precisa de chave para exibir
    if (modo === 'ia' && !aiChatCfg().key && !_vidCues.some(c => c.pt)) {
      toast('Configure uma chave de IA em Configurações para a tradução em tempo real', 'warning'); return
    }
    _vidPTmode = modo
    toast(modo === 'sub'
      ? 'Tradução da legenda PT-BR oficial (pode divergir do literal)'
      : 'Tradução literal pela IA — só o que você está vendo (+5s)', 'info')
  }
  cfg.vidPT = _vidPTmode; saveCfg()   // o modo volta sozinho no próximo vídeo
  _vidShowPT = _vidPTmode !== 'off'
  _vidPTButtons()
  renderVidTranscript()
  _vidUpdateOverlay()
  const p = el('vid-player')
  if (_vidPTmode === 'ia' && p) _vidEnsurePTAhead(p.currentTime)
}

// Ao abrir um vídeo: a tradução volta LIGADA sozinha, no modo de antes.
// As traduções da IA já ficam salvas por fala (VideoDB) — não faria sentido
// obrigar a religar o botão a cada sessão. Sem preferência salva, um vídeo
// que JÁ tem tradução da IA abre com ela ligada (foi pedida e paga).
function _vidRestaurarPT() {
  const temIA = _vidCues.some(c => c.pt)
  const temSub = _vidCues.some(c => c.pts)
  const pref = cfg.vidPT || (temIA ? 'ia' : '')
  _vidPTmode = (pref === 'ia' && (temIA || aiChatCfg().key)) ? 'ia'
    : (pref === 'sub' && temSub) ? 'sub'
    : (pref === 'sub' && temIA) ? 'ia'      // sem trilha oficial, a da IA serve
    : 'off'
  _vidShowPT = _vidPTmode !== 'off'
  if (_vidPTmode === 'ia' && temIA) {
    const n = _vidCues.filter(c => c.pt).length
    toast(`Tradução da IA carregada (${n} falas) — já ligada sob a legenda`, 'info')
  }
}

// Sincroniza o estado visual dos controles de tradução (toolbar + minis
// flutuantes do vídeo — os minis valem em tela cheia)
function _vidPTButtons() {
  el('vid-pt-sub')?.classList.toggle('vid-on', _vidPTmode === 'sub')
  el('vid-pt-ia')?.classList.toggle('vid-on', _vidPTmode === 'ia')
  el('vid-mini-sub')?.classList.toggle('on', _vidPTmode === 'sub')
  el('vid-mini-ia')?.classList.toggle('on', _vidPTmode === 'ia')
  el('vid-mini-fog')?.classList.toggle('on', _vidPTfog)
  const fog = el('vid-fog-toggle')
  if (fog) fog.style.display = _vidPTmode === 'off' ? 'none' : ''
}

function videoToggleFog() {
  _vidPTfog = !_vidPTfog
  el('vid-fog-toggle')?.classList.toggle('vid-on', _vidPTfog)
  _vidPTButtons()
  _vidUpdateOverlay()
}

// ================================================================
// LEGENDA — importar e parsear (.srt/.vtt)
// ================================================================
function renderVidTranscript() {
  const box = el('vid-transcript'); if (!box) return
  if (!_vidCues.length) {
    const ehPod = !!(_vidCur && _vidCur.podcast)
    box.innerHTML = `
      <div class="vid-transcript-empty">
        ${ic(ehPod ? 'sparkles' : 'upload','ic-lg')}
        <p><b>Sem legenda ainda.</b></p>
        <p>${ehPod
          ? 'Podcast quase nunca tem legenda pronta — a IA escuta o episódio e escreve uma, já sincronizada. Se você tiver a transcrição em <b>.srt</b>/<b>.vtt</b>, arraste aqui.'
          : 'Arraste um arquivo <b>.srt</b>/<b>.vtt</b> aqui, ou use o botão "Legenda" acima.'}</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px">
          ${ehPod ? '' : `<button class="btn btn-secondary btn-sm" onclick="videoSubSearchOpen()">${ic('search','ic-sm')}Buscar legenda</button>`}
          <button class="btn ${ehPod ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="videoTranscribeFull()" data-tip="A IA escuta o episódio inteiro e escreve a legenda, com os tempos certos (~R$ 1,50 por 45min na OpenAI; ~9× menos na Groq)">${ic('sparkles','ic-sm')}Criar com IA</button>
          ${ehPod ? `<button class="btn btn-ghost btn-sm" onclick="videoImportSubPick()">${ic('upload','ic-sm')}Importar .srt/.vtt</button>` : ''}
        </div>
      </div>`
    return
  }
  // Os achados do raio-X acendem DENTRO das falas — a mesma pintura do
  // audiolivro (posição, não regex; sublinhado, não fundo).
  const raioItens = (_vidRaioX && Array.isArray(_vidRaioX.itens)) ? _vidRaioX.itens : null
  box.innerHTML = _vidCues.map((c, i) => {
    const pt = _vidPTshow(c) || (c._rev ? _vidPTof(c) : '')
    // Fusão PT (um cue PT cobrindo duas falas EN): mostra o texto só na
    // primeira; a seguinte ganha a seta de continuação em vez de repetir.
    const repetida = pt && i > 0 && _vidPTof(_vidCues[i - 1]) === pt
    const fonte = c.pt ? 'traduzido por IA' : (c.pts ? 'da legenda PT-BR (alinhada)' : '')
    const txt = (raioItens && typeof _vidFalaPintada === 'function') ? _vidFalaPintada(c.t, raioItens) : esc(c.t)
    return `
    <div class="vid-cue${_vidSel && i >= _vidSel.ci && i <= _vidSel.cj ? ' insel' : ''}" data-i="${i}">
      <button class="vid-cue-time" onclick="videoPlayCue(${i})" data-tip="Tocar esta fala">${_vidFmtTime(c.s)}</button>
      <div class="vid-cue-body">
        <div class="vid-cue-text" onclick="videoSelectCue(${i})">${txt}</div>
        <div class="vid-cue-pt${_vidShowPT || c._rev ? '' : ' hid'}${c._rev ? ' show' : ''}" id="vid-cue-pt-${i}" title="${escA(fonte)}">${repetida ? '⤷ (mesma tradução da fala acima)' : esc(pt)}</div>
      </div>
      <button class="vid-cue-ptbtn" onclick="videoCuePT(${i})" data-tip="Traduzir esta fala">pt</button>
    </div>`}).join('')
  if (typeof _vidRaioXPintarBotao === 'function') _vidRaioXPintarBotao()
}

// Tradução de UMA fala do transcript: usa a trilha PT alinhada se houver;
// senão traduz com IA. Revela só a linha pedida (as outras seguem no recall).
function videoPlayCue(i) {
  const p = el('vid-player'); const c = _vidCues[i]
  if (!p || !c) return
  p.currentTime = Math.max(0, c.s - 0.15)
  _vidPlayStop = c.e + 0.15
  p.play()
}

// Clique na fala = vira a seleção de estudo
function videoSelectCue(i) {
  const c = _vidCues[i]; if (!c) return
  _vidFocus = null                    // sai do estudo focado, se estava nele
  _vidSel = { ci: i, cj: i, s: c.s, e: c.e }
  _vidSelWords = new Set()
  renderVidTranscript()
  renderVidSelPanel()
}

// ================================================================
// SELEÇÃO — ajuste fino, loop A–B, palavra-alvo e card
// ================================================================
async function _vidConsumePendingClip() {
  const clipId = _pendingClipPlay; _pendingClipPlay = null
  const clip = clips.find(c => c.id === clipId)
  if (!clip) { renderVideoLib(); return }
  const v = videos.find(x => x.id === clip.videoId)
  if (!v) { toast('O vídeo desta cena não está mais na lista', 'warning'); renderVideoLib(); return }
  // Player de pé? Só toca. Arquivo ainda na memória (veio do "Preparar",
  // p.ex.)? Remonta o player sem pedir o arquivo. Senão, reabre pelo handle.
  if (_vidCur?.id === v.id && el('vid-player')) {
    _vidSeekClip(clip)
    return
  }
  // Podcast em streaming não tem _vidFile, mas o player já sabe tocá-lo.
  if (_vidCur?.id === v.id && (_vidFile || _vidStream)) await videoOpenPlayer(v)
  else await videoOpen(v.id)
  const p = el('vid-player')
  if (p) {
    if (p.readyState >= 1) _vidSeekClip(clip)
    else p.addEventListener('loadedmetadata', () => _vidSeekClip(clip), { once: true })
  }
}
function _vidSeekClip(clip) {
  const p = el('vid-player'); if (!p) return
  p.currentTime = Math.max(0, clip.start - 0.3)
  _vidPlayStop = clip.end + 0.3
  p.play()
}

// ================================================================
// CONSERTAR ÁUDIO — MKVs com Dolby (AC3/EAC3) ou DTS tocam MUDOS no
// Chrome (codecs sem licença no navegador). O ffmpeg.wasm (hospedado no
// próprio site, ~31 MB baixados 1× e cacheados) extrai a faixa e a
// converte para AAC; o m4a fica no IndexedDB e toca num <audio>
// paralelo, sincronizado ao vídeo mudo. Caso real que motivou isto:
// House.of.the.Dragon S03E02 x265-MeGusta (EAC3) — vídeo ok, som nenhum.
// WORKERFS: o arquivo é LIDO sob demanda, nunca copiado para a heap —
// sem isso, um MKV de 2 GB estouraria a memória do wasm.
// ================================================================
let _vidFixAudio = null      // <audio> paralelo com a faixa consertada
let _vidFFmpeg = null        // instância carregada (1× por sessão)
let _vidFixando = false

async function _vidLoadFFmpeg(onProgress) {
  if (_vidFFmpeg) return _vidFFmpeg
  const { FFmpeg } = await import('./vendor/ffmpeg/index.js')
  const ff = new FFmpeg()
  if (onProgress) ff.on('progress', ({ progress }) => onProgress(Math.min(1, progress)))
  const base = new URL('js/vendor/ffmpeg/', document.baseURI).href
  await ff.load({ coreURL: base + 'ffmpeg-core.js', wasmURL: base + 'ffmpeg-core.wasm' })
  _vidFFmpeg = ff
  return ff
}

// Detector: o Chrome expõe webkitAudioDecodedByteCount — se depois de 1,5s
// tocando nada foi decodificado, a faixa existe mas o codec não é suportado.
function _vidArmSilentDetector(player) {
  if (!('webkitAudioDecodedByteCount' in player)) return
  let checado = false
  player.addEventListener('playing', () => {
    if (checado) return
    checado = true
    setTimeout(() => {
      if (!el('vid-player') || _vidFixAudio) return
      if (player.muted || player.volume === 0) { checado = false; return }
      if (player.webkitAudioDecodedByteCount === 0 && player.currentTime > 0.8) {
        _vidShowFixBanner()
      }
    }, 1500)
  })
}

function _vidShowFixBanner() {
  const box = el('vid-audiofix-banner'); if (!box || box.innerHTML) return
  box.innerHTML = `
    <div class="vid-fix-banner">
      <div>
        <b>Este arquivo está sem som?</b>
        <span>O áudio deve ser Dolby/DTS, que o navegador não decodifica. Dá para converter aqui mesmo —
        uma vez só, fica salvo neste aparelho (na primeira vez baixa o conversor, ~31&nbsp;MB).</span>
      </div>
      <button class="btn btn-primary btn-sm" onclick="videoFixAudio()">${ic('volume','ic-sm')}Consertar áudio</button>
      <button class="vid-fix-close" onclick="el('vid-audiofix-banner').innerHTML=''" aria-label="Fechar">${ic('x','ic-sm')}</button>
    </div>`
}

async function videoFixAudio() {
  if (_vidFixando || !_vidFile || !_vidCur) return
  _vidFixando = true
  const box = el('vid-audiofix-banner')
  const setMsg = (m, pct) => { if (box) box.innerHTML = `
    <div class="vid-fix-banner"><div><b>${m}</b>${pct != null ? `
      <span class="vid-fix-bar"><i style="width:${Math.round(pct*100)}%"></i></span>` : ''}</div></div>` }
  try {
    const p = el('vid-player'); if (p) p.pause()
    setMsg('Baixando o conversor (1ª vez)...')
    const ff = await _vidLoadFFmpeg(prog => setMsg('Convertendo o áudio...', prog))
    setMsg('Preparando o arquivo...')
    try { await ff.unmount('/mnt') } catch (e) {}
    try { await ff.createDir('/mnt') } catch (e) {}
    await ff.mount('WORKERFS', { files: [_vidFile] }, '/mnt')
    setMsg('Convertendo o áudio...', 0)
    // -vn ignora o vídeo (HEVC nem é tocado); AAC nativo do ffmpeg
    const code = await ff.exec(['-i', '/mnt/' + _vidFile.name, '-vn', '-c:a', 'aac', '-b:a', '128k', 'out.m4a'])
    if (code !== 0) throw new Error('a conversão retornou código ' + code)
    const data = await ff.readFile('out.m4a')
    try { await ff.deleteFile('out.m4a') } catch (e) {}
    try { await ff.unmount('/mnt') } catch (e) {}
    const blob = new Blob([data.buffer], { type: 'audio/mp4' })
    if (blob.size < 10000) throw new Error('saída vazia — o arquivo tem faixa de áudio?')
    await VideoDB.set('media', _vidCur.id, blob)
    _vidAttachFixedAudio(blob)
    if (box) box.innerHTML = ''
    toast('Áudio consertado — salvo neste aparelho, não precisa repetir', 'success')
  } catch (e) {
    console.warn('[video] fixAudio:', e)
    if (box) box.innerHTML = ''
    _vidShowFixBanner()
    toast('Não consegui converter: ' + e.message, 'error')
  } finally { _vidFixando = false }
}

// Anexa o m4a num <audio> escondido e cola nele os eventos do vídeo.
function _vidAttachFixedAudio(blob) {
  const p = el('vid-player'); if (!p) return
  if (_vidFixAudio) { try { _vidFixAudio.pause() } catch (e) {}; _vidFixAudio.remove() }
  const a = document.createElement('audio')
  a.id = 'vid-fixaudio'
  a.src = URL.createObjectURL(blob)
  a.preload = 'auto'
  document.body.appendChild(a)
  _vidFixAudio = a
  p.muted = true
  const sync = () => { a.currentTime = p.currentTime }
  p.addEventListener('play',  () => { sync(); a.play().catch(() => {}) })
  p.addEventListener('pause', () => a.pause())
  p.addEventListener('seeked', sync)
  p.addEventListener('ratechange', () => { a.playbackRate = p.playbackRate })
  // Chip informativo no toolbar
  const tb = document.querySelector('.vid-toolbar')
  if (tb && !el('vid-fix-chip')) {
    const chip = document.createElement('span')
    chip.id = 'vid-fix-chip'
    chip.className = 'vid-fix-chip'
    chip.title = 'A faixa original (Dolby/DTS) foi convertida para AAC e toca em paralelo'
    chip.innerHTML = `${ic('volume','ic-sm')} áudio consertado`
    tb.insertBefore(chip, tb.children[1])
  }
}

// ================================================================
// BUSCAR LEGENDA — protocolo de ADDONS do Stremio (aberto, com CORS):
//   {addon}/manifest.json e {addon}/subtitles/{tipo}/{imdbId}.json
// A busca de título usa o Cinemeta (catálogo público do Stremio) e o
// moviehash do OpenSubtitles (tamanho + primeiros/últimos 64 KB) acha a
// legenda EXATA do arquivo quando ela existe. Tudo direto do navegador.
// ================================================================
function _vidSavePos() {
  const p = el('vid-player')
  if (!p || !_vidCur) return
  if (p.currentTime > 5) { _vidCur.position = +p.currentTime.toFixed(1); saveVideos() }
}

// Fechar a aba / trocar de app não pode perder nem a posição nem uma
// mudança de legenda que ainda estava no debounce de 1,5s.
if (!window._vidFlushBound) {
  window._vidFlushBound = true
  const _vidFlush = () => {
    _vidSavePos()
    if (_vidSubsSaveTimer) _vidSaveSubsNow()
  }
  window.addEventListener('beforeunload', _vidFlush)
  document.addEventListener('visibilitychange', () => { if (document.hidden) _vidFlush() })
}

// ================================================================
// TELA CHEIA COM LEGENDA
// Caminho 1 (botão próprio): fullscreen no .vid-stage — o overlay
// interativo vai junto (dá para selecionar palavra em tela cheia).
// Caminho 2 (botão nativo do player): o fullscreen é só do <video>,
// onde nenhum overlay entra — então injetamos uma trilha de legenda
// NATIVA (TextTrack/VTTCue), que o player renderiza em qualquer modo.
// ================================================================
// Pular alguns segundos (botões no vídeo + Shift+setas)
function videoSkip(d) {
  const p = el('vid-player'); if (!p) return
  p.currentTime = Math.max(0, p.currentTime + d)
}

// ================================================================
// NAVEGAÇÃO POR FALA — "a frase passou, quero voltar NELA":
//   R          → repete a fala atual/última (do início dela)
//   ← / →      → fala anterior / próxima (← no meio de uma fala volta ao
//                início dela; apertando de novo, vai para a anterior —
//                o comportamento de "faixa anterior" dos players)
//   Shift+←/→  → ±5s (o pulo bruto continua disponível)
// ================================================================
// Índice da fala corrente, ou da ÚLTIMA que começou antes de t
// ================================================================
// MEDIA SESSION — fone, tela de bloqueio, botão do carro (melhoria 3)
// ================================================================
// O mesmo desenho do audiolivro, com as mesmas lições: play/pause do sistema
// são DOIS botões (nunca alternar), e `setPositionState` rejeita número
// impossível e derruba a chamada — cada valor conferido antes. As setas de
// faixa viram FALA anterior/próxima: aqui a unidade de escuta é a fala.
function _vidMediaEstado(player) {
  if (!('mediaSession' in navigator)) return
  try { navigator.mediaSession.playbackState = (player && !player.paused) ? 'playing' : 'paused' } catch (e) {}
  if (!navigator.mediaSession.setPositionState || !player) return
  const dur = Number(player.duration)
  if (!isFinite(dur) || dur <= 0) return
  const pos = Math.min(Math.max(0, Number(player.currentTime) || 0), dur)
  const vel = Number(player.playbackRate) || 1
  try { navigator.mediaSession.setPositionState({ duration: dur, position: pos, playbackRate: vel }) } catch (e) {}
}

function _vidMediaSession(v, player) {
  if (!('mediaSession' in navigator) || !player) return
  const ehPod = !!v.podcast
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: v.title || v.fileName || 'Episódio',
      artist: ehPod ? (v.podcast.showTitle || '') : '',
      album: ehPod ? (v.podcast.showTitle || '') : 'Language Lab',
      artwork: (ehPod && v.podcast.artwork)
        ? [{ src: v.podcast.artwork, sizes: '512x512', type: 'image/jpeg' }] : []
    })
    navigator.mediaSession.setActionHandler('play', () => { player.play().catch(() => {}); _vidMediaEstado(player) })
    navigator.mediaSession.setActionHandler('pause', () => { player.pause(); _vidMediaEstado(player) })
    navigator.mediaSession.setActionHandler('seekbackward', () => videoSkip(-5))
    navigator.mediaSession.setActionHandler('seekforward', () => videoSkip(5))
    navigator.mediaSession.setActionHandler('previoustrack', () => { try { videoCueNav(-1) } catch (e) {} })
    navigator.mediaSession.setActionHandler('nexttrack', () => { try { videoCueNav(1) } catch (e) {} })
    navigator.mediaSession.setActionHandler('seekto', d => {
      if (d.seekTime == null) return
      if (d.fastSeek && player.fastSeek) player.fastSeek(d.seekTime)
      else player.currentTime = d.seekTime
      _vidMediaEstado(player)
    })
  } catch (e) {}
  const estado = () => _vidMediaEstado(player)
  player.addEventListener('play', estado)
  player.addEventListener('pause', estado)
  player.addEventListener('ratechange', estado)
  player.addEventListener('durationchange', estado)
  estado()
}

function _vidCueIndexAt(t) {
  let idx = -1
  for (let i = 0; i < _vidCues.length; i++) {
    if (_vidCues[i].s <= t + 0.05) idx = i
    else break
  }
  return idx
}

// Uma FRASE falada quase nunca cabe em uma legenda só: ela continua na
// legenda seguinte. Navegando por legenda, o ‹‹ caía no meio (ou no fim) da
// frase — a queixa do Djemeson. Legendas encadeadas viram um GRUPO e o salto
// vai sempre ao INÍCIO do grupo.
function _vidCueContinua(i) {
  const a = _vidCues[i - 1], b = _vidCues[i]
  if (!a || !b) return false
  if (b.s - a.e > 1.5) return false                    // pausa longa = frase nova
  const tb = String(b.t || '').trim()
  const ta = String(a.t || '').trim()
  if (/^[-–—]/.test(tb)) return false                  // travessão = outro falante
  if (/^[A-ZÀ-Þ"'(¿¡]/.test(tb) && /[.!?…]["')\]]*$/.test(ta)) return false
  return !/[.!?…]["')\]]*$/.test(ta)                   // a anterior não fechou a frase
}
function _vidGrupoIni(i) {
  let g = 0                                            // trava de segurança
  while (i > 0 && _vidCueContinua(i) && g++ < 12) i--
  return Math.max(0, i)
}
function _vidGrupoFim(i) {
  let g = 0
  while (i + 1 < _vidCues.length && _vidCueContinua(i + 1) && g++ < 12) i++
  return i
}

function videoReplayCue() {
  const p = el('vid-player'); if (!p) return
  if (!_vidCues.length) { videoSkip(-5); return }
  const i = _vidCueIndexAt(p.currentTime)
  if (i < 0) { videoSkip(-5); return }
  p.currentTime = Math.max(0, _vidCues[_vidGrupoIni(i)].s - 0.2)
  p.play()
}

function videoCueNav(dir) {
  const p = el('vid-player'); if (!p) return
  if (!_vidCues.length) { videoSkip(dir * 5); return }
  const t = p.currentTime
  const i = _vidCueIndexAt(t)
  let alvo
  if (dir < 0) {
    if (i < 0) { videoSkip(-5); return }
    alvo = _vidGrupoIni(i)
    // já no comecinho da frase? então o ‹‹ vai para a frase ANTERIOR inteira
    if (t - _vidCues[alvo].s <= 0.8) alvo = _vidGrupoIni(Math.max(0, alvo - 1))
  } else {
    alvo = i < 0 ? 0 : _vidGrupoFim(_vidGrupoIni(i)) + 1
    if (alvo >= _vidCues.length) alvo = _vidCues.length - 1
    // Aterrissamos 0,2s ANTES da frase (respiro): se o t atual já está nessa
    // entradinha, "próxima" tem que pular o grupo — senão o botão trava.
    if (_vidCues[alvo].s - t <= 0.6) {
      const seg = _vidGrupoFim(alvo) + 1
      if (seg < _vidCues.length) alvo = seg
    }
  }
  p.currentTime = Math.max(0, _vidCues[alvo].s - 0.2)
  p.play()
}

if (!window._vidSkipKeysBound) {
  window._vidSkipKeysBound = true
  document.addEventListener('keydown', e => {
    const ehSeta = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
    const ehR = e.key === 'r' || e.key === 'R'
    if (!ehSeta && !ehR) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const tag = (document.activeElement?.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return
    if (!document.getElementById('section-video')?.classList.contains('active')) return
    if (!el('vid-player')) return
    if (document.activeElement === el('vid-player')) return   // o player nativo já trata
    e.preventDefault()
    if (ehR) videoReplayCue()
    else if (e.shiftKey) videoSkip(e.key === 'ArrowLeft' ? -5 : 5)
    else videoCueNav(e.key === 'ArrowLeft' ? -1 : 1)
  })
}

function videoToggleFullscreen() {
  const stage = document.querySelector('.vid-stage'); if (!stage) return
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  else stage.requestFullscreen().catch(e => toast('Tela cheia bloqueada: ' + e.message, 'warning'))
}

let _vidTrack = null
function _vidFillTrack() {
  const p = el('vid-player'); if (!p) return
  if (!_vidTrack || _vidTrack._for !== p) {
    _vidTrack = p.addTextTrack('subtitles', 'Estudo', 'en')
    _vidTrack._for = p
  }
  const velhos = _vidTrack.cues ? [..._vidTrack.cues] : []
  velhos.forEach(c => { try { _vidTrack.removeCue(c) } catch (e) {} })
  for (const c of _vidCues) {
    const pt = _vidPTshow(c)
    try {
      const cue = new VTTCue(c.s, c.e, pt ? c.t + '\n' + pt : c.t)
      cue.line = -3          // um pouco acima da borda, longe dos controles
      _vidTrack.addCue(cue)
    } catch (e) {}
  }
}

if (!window._vidFsBound) {
  window._vidFsBound = true
  document.addEventListener('fullscreenchange', () => {
    const p = el('vid-player')
    if (!p) return
    if (document.fullscreenElement === p) {
      // fullscreen NATIVO (só o vídeo): liga a trilha nativa
      if (_vidOverlayOn && _vidCues.length) { _vidFillTrack(); _vidTrack.mode = 'showing' }
    } else if (_vidTrack) {
      // saiu, ou é o fullscreen do stage (overlay rico cuida da legenda)
      _vidTrack.mode = 'hidden'
    }
  })
}
