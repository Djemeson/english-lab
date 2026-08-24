// ================================================================
// LANGUAGE LAB × NETFLIX — o módulo Vídeo do app, dentro do player.
// Duas fontes de legenda, nesta ordem:
//   1) o ARQUIVO TTML que o player baixa (inject.js) → tempos reais,
//      transcript completo, navegação por fala, tradução antecipada;
//   2) o DOM (.player-timedtext) → sempre funciona, mesmo sem (1).
// Chaves de IA nunca entram aqui: quem chama a API é o service worker.
// ================================================================
'use strict'

// Ao ATUALIZAR a extensao, este script segue vivo na aba antiga mas perde o
// vinculo: qualquer chrome.* vira "Extension context invalidated". Tudo o
// que fala com a extensao passa por aqui.
let extMorta = false
const extViva = () => { try { return !!(chrome.runtime && chrome.runtime.id) } catch (e) { return false } }
function morrer() {
  if (extMorta) return
  extMorta = true
  avisar('extensão atualizada — recarregue a página (F5)')
}
// PROMESSA + catch em vez de callback: com callback, o erro de contexto
// invalidado estoura dentro do Chrome e vira "Uncaught"; com promessa,
// vira rejeicao e o .catch() resolve.
function pedirExt(fn) {
  if (extMorta) return Promise.resolve(null)
  let p
  try {
    if (!extViva()) { morrer(); return Promise.resolve(null) }
    p = fn()
  } catch (e) { morrer(); return Promise.resolve(null) }
  return Promise.resolve(p).catch(() => { morrer(); return null })
}

// ---- estado ----
let cues = []                 // legenda completa (quando o TTML é capturado)
let idxAtual = -1
let ultimoTexto = ''
let histórico = []            // [{t, texto}] — falas que já passaram (modo DOM)
let ptCache = new Map()       // chavePT(texto) → tradução
let ptPend = new Set()
let barra = null, painel = null
let cfgUI = { ligada: true, ocultaNativa: true, pausaHover: true, pt: false, fog: true, transcript: false, doca: true }
let pausadoPorNos = false
let mouseNaBarra = false     // ponteiro sobre a barra/legenda (ver `_irAteAFala`)
let tituloId = null          // id do titulo aberto (/watch/NNNN)
// Declarado AQUI, e nao junto da funcao que o preenche, porque
// `resetarSessao()` mexe nele e roda cedo — `let` mais abaixo daria
// ReferenceError por zona morta temporal.
let _tituloVisto = ''        // ultimo "Serie · T10:E15 · Episodio" que apareceu na tela

// A Netflix e uma SPA: trocar de episodio nao recarrega a pagina. Sem
// resetar aqui, a legenda do titulo ANTERIOR continua na memoria, se
// mistura com a nova (a uniao de segmentos) e o resultado e legenda
// trocada/dessincronizada — exatamente o que o Djemeson viu.
function idDoTitulo() {
  const m = location.pathname.match(/\/watch\/(\d+)/)
  return m ? m[1] : null
}
function resetarSessao() {
  // ⚠️ O TITULO GUARDADO MORRE AQUI. Sem isto, capturar no episodio novo antes
  // de os controles aparecerem carimbaria a captura com o episodio ANTERIOR —
  // pior que "Netflix", porque parece certo e esta errado.
  _tituloVisto = ''
  cues = []; idxAtual = -1; ultimoTexto = ''
  histórico = []; ptCache = new Map(); ptPend = new Set()
  ruleIni = null; ruleCur = null
  pausadoPorNos = false; popPausou = false; popCtx = ''
  if (barra) {
    const linha = barra.querySelector('#englab-line'); if (linha) linha.innerHTML = ''
    const rule = barra.querySelector('#englab-rule')
    if (rule) { rule.innerHTML = ''; rule.style.display = 'none'; ruleTrack = null }
    pintarPT()
  }
  const pop = document.getElementById('englab-pop'); if (pop) pop.remove()
  if (cfgUI.transcript) renderTranscript()
}

pedirExt(() => chrome.storage.local.get({ llui: null })).then(r => {
  if (r && r.llui) { cfgUI = { ...cfgUI, ...r.llui }; sincronizarBotoes(); aplicarNativa(); aplicarDoca() }
}).catch(() => {})
const salvarUI = () => pedirExt(() => chrome.storage.local.set({ llui: cfgUI }))

const vid = () => document.querySelector('video')

// ================================================================
// O NOME DA SERIE, TEMPORADA E EPISODIO
// ================================================================
// ⚠️ O TITULO SO EXISTE NO HTML ENQUANTO OS CONTROLES ESTAO VISIVEIS. Ele
// clica numa palavra da legenda com o painel escondido — que e o normal
// assistindo — e nesse instante `[data-uia="video-title"]` NAO ESTA NO DOM.
// O codigo antigo lia na hora da captura e caia no `document.title`, que
// durante a reproducao e so "Netflix". Por isso ele viu "Netflix" no lugar de
// "Friends T10:E15".
//
// A saida e nao depender do instante: um observador guarda o titulo toda vez
// que ele APARECE (ao mover o mouse, ao pausar, ao trocar de episodio), e a
// captura usa o ultimo visto (`_tituloVisto`, declarado no topo). Zerado no
// `resetarSessao`, senao a serie anterior grudaria na proxima.
//
// A Netflix quebra o titulo em pedacos: <h4> com a serie, spans com "T10:E15"
// e com o nome do episodio. `textContent` cola tudo sem espaco
// ("FriendsT10:E15A Festa"), entao os filhos entram separados por " · ".
function _lerTituloDoDom() {
  const t = document.querySelector('[data-uia="video-title"]')
  if (!t) return ''
  const partes = [...t.childNodes]
    .map(n => (n.textContent || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean)
  const texto = (partes.length ? partes.join(' · ') : t.textContent.trim().replace(/\s+/g, ' '))
  return texto.replace(/\s*·\s*·\s*/g, ' · ').trim()
}

function _guardarTitulo() {
  const t = _lerTituloDoDom()
  if (t && t !== _tituloVisto) _tituloVisto = t
}

// Barato: so olha quando algo muda na arvore, e o que ele faz e ler um texto.
const _obsTitulo = new MutationObserver(_guardarTitulo)
try {
  _obsTitulo.observe(document.body, { childList: true, subtree: true })
} catch (e) {}
document.addEventListener('mousemove', _guardarTitulo, { passive: true })
_guardarTitulo()

const titulo = () => _tituloVisto ||
  _lerTituloDoDom() ||
  document.title.replace(/ - Netflix.*$/i, '').trim() ||
  'Netflix'

// ---- captura para o app ----
function salvarCaptura(word, context) {
  pedirExt(() => chrome.storage.local.get({ pend: [] })).then(r => {
    if (!r) return
    const pend = r.pend || []
    pend.push({ word, context, title: titulo(), ts: Date.now() })
    return pedirExt(() => chrome.storage.local.set({ pend }))
  }).catch(() => {})
  // A GLOSA VAI JUNTO, e e AQUI que ela custa menos e vale mais: a fala
  // inteira esta na mao neste segundo. Chegando crua ao Preparar, a analise
  // escolhe o sentido MAIS COMUM da palavra -- e num "snuffs the torch" isso
  // vira "rape" em vez de "apagar".
  // ⚠️ Em segundo plano de proposito: a captura NAO espera a IA. O aviso ja
  // piscou, ele ja voltou para a cena, e travar o clique por causa de um
  // bilhete seria trocar o essencial pelo acessorio. Falhando, a captura
  // continua valendo -- so chega sem bilhete, como chegava antes.
  if (word) _glosarDepois(word, context)
}

// Guarda a glosa DENTRO da captura ja salva, achando-a pelo carimbo de tempo.
// Reescrever a fila inteira seria correr contra outra captura em voo.
function _glosarDepois(word, context) {
  const marca = Date.now()
  pedirExt(() => chrome.runtime.sendMessage({ type: 'ai-glosar', itens: [{ word, context }] }))
    .then(resp => {
      const g = resp && resp.ok && (resp.glosas || [])[0]
      if (!g) return
      return pedirExt(() => chrome.storage.local.get({ pend: [] })).then(r => {
        const pend = (r && r.pend) || []
        // O mais recente com esta palavra e sem glosa: e o que acabou de entrar.
        for (let i = pend.length - 1; i >= 0; i--) {
          if (pend[i].word === word && !pend[i].gloss && Math.abs((pend[i].ts || 0) - marca) < 120000) {
            pend[i].gloss = g
            return pedirExt(() => chrome.storage.local.set({ pend }))
          }
        }
      })
    }).catch(() => {})
}
function piscar(el) { el.classList.add('englab-ok'); setTimeout(() => el.classList.remove('englab-ok'), 600) }

// ---- legenda completa vinda do inject.js ----
window.addEventListener('message', ev => {
  if (ev.source !== window || !ev.data || ev.data.type !== 'englab-nf-cues') return
  const novos = ev.data.cues || []
  if (!novos.length) return
  // A Netflix entrega a legenda em SEGMENTOS. Substituir a lista a cada
  // chegada deixava sumir tudo o que veio antes ("secoes inteiras de fala
  // que nao aparecem") — agora e UNIAO, com dedupe por tempo+texto.
  // Trocar o IDIOMA da legenda no mesmo titulo tambem traz cues novos: se
  // eles ocupam os mesmos tempos com textos diferentes, e OUTRA trilha —
  // unir misturaria dois idiomas na tela.
  if (cues.length) {
    let colisoes = 0, iguais = 0
    for (const c of novos.slice(0, 60)) {
      const ex = cues.find(x => Math.abs(x.s - c.s) < 0.25)
      if (!ex) continue
      colisoes++
      if (chavePT(ex.t) === chavePT(c.t)) iguais++
    }
    // ⚠️ PERTO DO FIM, "OUTRA TRILHA" E O PROXIMO EPISODIO. A Netflix
    // pre-carrega o proximo nos ultimos minutos, e o TTML dele chega enquanto
    // este ainda esta rodando — com tempos comecando do zero, que colidem com
    // tudo o que ja temos. A regra abaixo interpretava isso como "trocou a
    // legenda", zerava o episodio ATUAL e adotava o do proximo: foi o que ele
    // viu, "mais de 1000 falas se sobrepondo faltando 3 minutos".
    //
    // Aqui a decisao correta e a INVERSA da de sempre: ignorar o que chega.
    // Trocar de idioma a 3 minutos do fim praticamente nao acontece; receber o
    // proximo episodio, sempre. E quando ele de fato trocar de episodio, a URL
    // muda e `resetarSessao()` limpa tudo pelo caminho certo.
    const _v = vid()
    const pertoDoFim = _v && _v.duration && (_v.duration - _v.currentTime) < 240
    if (colisoes >= 2 && iguais / colisoes < 0.5 && pertoDoFim) return

    // 2 colisões já bastam: no mesmo idioma, tempos iguais trazem texto igual —
    // divergir aí é sinal de outra trilha (e no começo do episódio há poucas falas).
    if (colisoes >= 2 && iguais / colisoes < 0.5) {
      cues = []; ptCache = new Map(); ptPend = new Set(); ruleIni = null; ruleCur = null
      avisar('legenda trocada — recomeçando')
    }
  }
  const antes = cues.length
  const mapa = new Map(cues.map(c => [c.s.toFixed(2) + '|' + c.t, c]))
  for (const c of novos) mapa.set(c.s.toFixed(2) + '|' + c.t, c)
  cues = [...mapa.values()].sort((a, b) => a.s - b.s)
  idxAtual = -1
  if (cues.length !== antes) avisar(`legenda: ${cues.length} falas`)
  const vv = vid()
  montarRegua(vv ? vv.currentTime : 0)
  if (cfgUI.transcript) renderTranscript()
})

// O texto que o player DESENHA e o que vem no ARQUIVO quase nunca sao
// identicos (italico, simbolos, espacos). Como o cache era indexado pelo
// texto cru, a traducao existia mas nunca era achada — a legenda PT "nao
// aparecia". A chave agora compara so letras e numeros.
const chavePT = t => String(t || '').toLowerCase().replace(/[^0-9a-zA-Zà-ÿÀ-Ÿ]+/g, ' ').trim()
function ptDe(texto) {
  if (!texto) return ''
  const direto = ptCache.get(chavePT(texto))
  if (direto) return direto
  // Fallback SO se o texto exibido for mesmo o do cue corrente — senao
  // mostrariamos a traducao de outra fala (o "PT correndo atras").
  if (idxAtual >= 0 && cues[idxAtual] && chavePT(cues[idxAtual].t) === chavePT(texto)) {
    return ptCache.get(chavePT(cues[idxAtual].t)) || ''
  }
  return ''
}

const seek = (t, play = true) => window.postMessage({ type: 'englab-nf-seek', t, play }, '*')
const pausar = () => window.postMessage({ type: 'englab-nf-pause' }, '*')
const tocar  = () => window.postMessage({ type: 'englab-nf-play' }, '*')
window.addEventListener('message', ev => {
  if (ev.source === window && ev.data && ev.data.type === 'englab-nf-sem-api')
    avisar('não consegui controlar o player nesta tela — recarregue a página (F5)')
})

// ---- fala corrente ----
function cueEm(t) {
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i].s - 0.25 && t <= cues[i].e + 0.25) return i
    if (cues[i].s > t) break
  }
  return -1
}
// Uma frase pode estar quebrada em várias legendas (mesma regra do app):
// navegar por GRUPO evita cair no meio da frase.
function continua(i) {
  const a = cues[i - 1], b = cues[i]
  if (!a || !b) return false
  if (b.s - a.e > 1.5) return false
  const tb = String(b.t).trim(), ta = String(a.t).trim()
  if (/^[-–—]/.test(tb)) return false
  return !/[.!?…]["')\]]*$/.test(ta)
}
const grupoIni = i => { let g = 0; while (i > 0 && continua(i) && g++ < 12) i--; return Math.max(0, i) }
const grupoFim = i => { let g = 0; while (i + 1 < cues.length && continua(i + 1) && g++ < 12) i++; return i }

// ================================================================
// VOLTAR PARA VER, NAO PARA OUVIR PASSAR DE NOVO
// ================================================================
// Pedido dele, e o motivo e o gesto inteiro: "se eu volto e porque quero VER a
// palavra; se estiver sendo falado rapido acaba passando de novo e eu nao vejo".
// Voltar e dar play imediatamente devolve o mesmo problema que o levou a
// voltar.
//
// Entao: com o ponteiro sobre a barra — onde estao a legenda e estes botoes —
// a fala fica PARADA ali, a espera. Afastar o mouse e o sinal de "pode seguir",
// e o `mouseleave` acima ja cuida disso porque marcamos `pausadoPorNos`.
//
// ⚠️ Nao depende de `cfgUI.pausaHover`. Aquela opcao e sobre passar o mouse
// por acaso; esta e uma acao deliberada dele — apertou o botao de voltar. Amarrar
// as duas faria o botao mudar de comportamento por causa de uma preferencia que
// nada tem a ver com ele.
// ⚠️ NAO E "seek e depois pausa". `seek` avisa o player por `postMessage` e JA
// MANDA TOCAR por padrao (`play = true`); pausar em seguida seria uma corrida —
// as duas ordens viajam assincronas e o play costuma chegar por ultimo,
// desfazendo a pausa. O proprio `seek` aceita `play = false`, entao a decisao
// vai JUNTO com a ordem, numa mensagem so.
function _irAteAFala(t) {
  const pousar = mouseNaBarra
  seek(t, !pousar)
  if (pousar) pausadoPorNos = true   // o `mouseleave` da barra devolve o play
}

function falaAnterior() {
  const v = vid(); if (!v) return
  if (!cues.length) {   // modo DOM: usa o histórico
    const h = histórico[histórico.length - 2]
    if (h) _irAteAFala(h.t - 0.2)
    return
  }
  const i = cueEm(v.currentTime)
  let alvo
  if (i >= 0) alvo = grupoIni(i)
  else {
    // Depois da ÚLTIMA legenda (créditos), findIndex dava -1 e o -1 extra
    // clampava para 0: rever a última frase virava recomeçar o episódio.
    const prox = cues.findIndex(c => c.s > v.currentTime)
    alvo = prox < 0 ? cues.length - 1 : prox - 1
  }
  if (alvo < 0) alvo = 0
  if (v.currentTime - cues[alvo].s <= 0.8) alvo = grupoIni(Math.max(0, alvo - 1))
  _irAteAFala(cues[alvo].s - 0.2)
}
function repetirFala() {
  const v = vid(); if (!v) return
  if (!cues.length) { const h = histórico[histórico.length - 1]; if (h) _irAteAFala(h.t - 0.2); return }
  const i = cueEm(v.currentTime)
  if (i < 0) return
  _irAteAFala(cues[grupoIni(i)].s - 0.2)
}
function proximaFala() {
  const v = vid(); if (!v) return
  if (!cues.length) { _irAteAFala(v.currentTime + 5); return }
  const i = cueEm(v.currentTime)
  let alvo = i < 0 ? cues.findIndex(c => c.s > v.currentTime) : grupoFim(grupoIni(i)) + 1
  if (alvo < 0 || alvo >= cues.length) alvo = cues.length - 1
  if (cues[alvo].s - v.currentTime <= 0.6) {
    const seg = grupoFim(alvo) + 1
    if (seg < cues.length) alvo = seg
  }
  _irAteAFala(cues[alvo].s - 0.2)
}

// ---- tradução (IA) com janela antecipada, como no app ----
function traduzirJanela(t) {
  if (!cfgUI.pt || !cues.length) return
  const alvos = []
  for (const c of cues) {
    if (c.e < t - 0.5) continue
    if (c.s > t + 90) break   // 90s de antecedencia: fornecedor lento nao atrasa a legenda
    if (!ptCache.has(chavePT(c.t)) && !ptPend.has(c.t)) alvos.push(c.t)
  }
  if (!alvos.length) return
  for (const bloco of fatiar(alvos.slice(0, 60), 6)) {
    bloco.forEach(x => ptPend.add(x))
    pedirExt(() => chrome.runtime.sendMessage({ type: 'ai-traduzir', falas: bloco })).then(resp => {
      bloco.forEach(x => ptPend.delete(x))
      if (!resp || !resp.ok) { if (resp && resp.erro) avisar(resp.erro); return }
      bloco.forEach((x, i) => { if (resp.pt[i]) ptCache.set(chavePT(x), resp.pt[i]) })
      pintarPT()
      if (cfgUI.transcript) renderTranscript()
    }).catch(() => { bloco.forEach(x => ptPend.delete(x)) })
  }
}
const fatiar = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

function traduzirAvulsa(texto) {   // modo DOM (sem arquivo de legenda)
  if (!cfgUI.pt || ptCache.has(chavePT(texto)) || ptPend.has(texto)) return
  ptPend.add(texto)
  pedirExt(() => chrome.runtime.sendMessage({ type: 'ai-traduzir', falas: [texto] })).then(resp => {
    ptPend.delete(texto)
    if (resp && resp.ok && resp.pt[0]) { ptCache.set(chavePT(texto), resp.pt[0]); pintarPT() }
    else if (resp && resp.erro) avisar(resp.erro)
  }).catch(() => { ptPend.delete(texto) })
}

function pintarPT() {
  const el = barra && barra.querySelector('#englab-pt')
  if (!el) return
  // A ALTURA do painel nao pode depender de haver traducao: o espaco fica
  // reservado enquanto o modo PT estiver ligado (classe no proprio bar) e
  // so o conteudo aparece/some.
  const tinhaPT = barra.classList.contains('englab-tem-pt')
  barra.classList.toggle('englab-tem-pt', !!cfgUI.pt)
  if (tinhaPT !== !!cfgUI.pt) medirDoca()
  el.style.display = ''
  if (!cfgUI.pt) {
    // ESVAZIA ao desligar. Só tirar a classe bastava enquanto o CSS escondia
    // o elemento — mas basta uma regra de modo esquecer a qualificação para a
    // última tradução ficar congelada na tela. Limpar o texto torna isso
    // impossível, venha o CSS que vier.
    el.textContent = ''
    el.classList.remove('englab-esperando', 'englab-fog')
    el.classList.add('englab-vazia')
    return
  }
  const pt = ptDe(ultimoTexto)
  // Sem traducao ainda: reticencias — da para ver que a IA esta trabalhando
  // (o DeepSeek leva alguns segundos).
  const esperando = !pt && !!ultimoTexto
  el.textContent = pt || (esperando ? '...' : '')
  el.classList.toggle('englab-vazia', !pt && !esperando)
  el.classList.toggle('englab-esperando', esperando)
  el.classList.toggle('englab-fog', cfgUI.fog && !esperando)
}

// ---- barra ----
let IC_BAIXO = '', IC_CIMA = ''
function garantirBarra() {
  if (barra && document.body.contains(barra)) return barra
  barra = document.createElement('div')
  barra.id = 'englab-bar'
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
  const IC = {
    prev: svg('<path d="M18 6 10 12l8 6z"/><path d="M6 5v14"/>'),
    rep:  svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
    next: svg('<path d="M6 6l8 6-8 6z"/><path d="M18 5v14"/>'),
    fog:  svg('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>'),
    add:  svg('<path d="M12 5v14M5 12h14"/>'),
    tr:   svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
    cc:   svg('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M10.5 10.3a2.4 2.4 0 1 0 0 3.4M17.2 10.3a2.4 2.4 0 1 0 0 3.4"/>'),
    hide: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    baixo: svg('<path d="m6 9 6 6 6-6"/>'),
    cima: svg('<path d="m6 15 6-6 6 6"/>')
  }
  IC_BAIXO = IC.baixo; IC_CIMA = IC.cima
  barra.innerHTML = `
    <div class="englab-nav">
      <button data-a="prev" title="Fala anterior (←)">${IC.prev}</button>
      <button data-a="rep"  title="Repetir esta fala (R)">${IC.rep}</button>
      <button data-a="next" title="Próxima fala (→)">${IC.next}</button>
    </div>
    <div class="englab-mid">
      <div class="englab-line" id="englab-line"></div>
      <div class="englab-pt" id="englab-pt"></div>
    </div>
    <div class="englab-tools">
      <button data-a="pt"   class="englab-pill" title="Tradução PT-BR pela IA (P)">PT</button>
      <button data-a="fog"  title="Névoa: tradução borrada até passar o mouse">${IC.fog}</button>
      <button data-a="line" title="Salvar a frase inteira no Language Lab">${IC.add}</button>
      <button data-a="tr"   title="Transcript do episódio (T)">${IC.tr}</button>
      <button data-a="cc"   title="Mostrar/esconder a legenda original">${IC.cc}</button>
      <button data-a="doca" title="Alternar entre seção abaixo do vídeo e legenda flutuante">${IC.baixo}</button>
      <button data-a="hide" title="Esconder a barra">${IC.hide}</button>
    </div>
    <div class="englab-rule" id="englab-rule" title="Régua de falas: cada bloco é uma fala, o vão é silêncio. Clique para ir até lá."></div>`
  document.body.appendChild(barra)

  // ⚠️ NENHUM CLIQUE NOSSO PODE CHEGAR AO PLAYER. A Netflix alterna play/pause
  // em clique na area do video, e a barra vive por cima dela: sem esta trava,
  // apertar "proxima fala" ou "PT" tambem pausava o filme. Mesma causa do
  // popup que ele relatou, so que espalhada pela barra inteira.
  barra.addEventListener('mousedown', e => e.stopPropagation())
  barra.addEventListener('click', e => {
    e.stopPropagation()
    const b = e.target.closest('button[data-a]'); if (!b) return
    const a = b.dataset.a
    if (a === 'prev') falaAnterior()
    else if (a === 'rep') repetirFala()
    else if (a === 'next') proximaFala()
    // pintarPT() ANTES de pedir a traducao: e ele quem reserva o espaco da
    // linha PT. Chamando so no "else", ligar o PT deixava o painel crescer
    // quando a IA respondia.
    else if (a === 'pt') { cfgUI.pt = !cfgUI.pt; salvarUI(); sincronizarBotoes(); pintarPT(); if (cfgUI.pt) { const v = vid(); cues.length ? traduzirJanela(v ? v.currentTime : 0) : traduzirAvulsa(ultimoTexto) } }
    else if (a === 'fog') { cfgUI.fog = !cfgUI.fog; salvarUI(); sincronizarBotoes(); pintarPT() }
    else if (a === 'line') { if (ultimoTexto) { salvarCaptura('', ultimoTexto); piscar(b) } }
    else if (a === 'tr') { cfgUI.transcript = !cfgUI.transcript; salvarUI(); sincronizarBotoes(); renderTranscript() }
    else if (a === 'cc') { cfgUI.ocultaNativa = !cfgUI.ocultaNativa; salvarUI(); sincronizarBotoes(); aplicarNativa() }
    else if (a === 'doca') { cfgUI.doca = !cfgUI.doca; salvarUI(); aplicarDoca(); sincronizarBotoes() }
    else if (a === 'hide') { cfgUI.ligada = false; salvarUI(); barra.style.display = 'none'; aplicarNativa(); aplicarDoca() }
  })
  barra.addEventListener('mouseenter', () => {
    mouseNaBarra = true
    if (!cfgUI.pausaHover) return
    const v = vid(); if (v && !v.paused) { pausar(); pausadoPorNos = true }
  })
  barra.addEventListener('mouseleave', () => {
    mouseNaBarra = false
    // com o popup aberto o aluno esta indo ate ele: manter pausado
    if (document.getElementById('englab-pop')) return
    if (pausadoPorNos) { tocar(); pausadoPorNos = false }
  })
  // seleção de trecho → Explicar / Preparar (o popup do app)
  barra.querySelector('#englab-rule').addEventListener('click', ev => {
    const b = ev.target.closest('.englab-rb')
    if (b) { ev.stopPropagation(); seek(parseFloat(b.dataset.t) - 0.15) }
  })
  barra.querySelector('#englab-line').addEventListener('mouseup', () => setTimeout(mostrarPopupSel, 10))
  // Arraste que TERMINA fora da linha (acontece muito) também conta — mas
  // ⚠️ o que vale e onde ele COMECOU. Antes bastava existir texto selecionado
  // em qualquer canto da Netflix para o popup abrir E PAUSAR O VIDEO: marcar
  // uma sinopse, um nome de episodio, qualquer coisa, e o filme parava sem
  // motivo. Agora a ancora da selecao precisa estar na legenda.
  document.addEventListener('mouseup', ev => {
    if (!barra || barra.style.display === 'none') return
    if (ev.target.closest && ev.target.closest('#englab-pop')) return
    setTimeout(() => {
      const s = window.getSelection()
      if (!s || !String(s).trim()) return
      const no = s.anchorNode
      const el = no && (no.nodeType === 1 ? no : no.parentElement)
      if (!el || !el.closest || !el.closest('#englab-line')) return
      mostrarPopupSel()
    }, 10)
  })
  sincronizarBotoes()
  aplicarDoca()
  return barra
}

function sincronizarBotoes() {
  if (!barra) return
  const on = (a, v) => barra.querySelector(`button[data-a="${a}"]`)?.classList.toggle('on', !!v)
  on('pt', cfgUI.pt); on('fog', cfgUI.fog); on('tr', cfgUI.transcript); on('cc', !cfgUI.ocultaNativa)
}
// A DOCA: em vez de flutuar SOBRE a cena (e brigar com os controles), a
// seção fica ABAIXO do vídeo — o player é encolhido na mesma medida, então
// são duas áreas isoladas. O botão alterna para o modo flutuante, em que só
// as legendas voltam à tela, com fundo próprio.
// A reserva no video e a altura REAL da secao (que muda com o modo PT).
// Medir evita tanto sobreposicao quanto faixa preta sobrando.
function medirDoca() {
  if (!barra || !cfgUI.doca) return
  const h = Math.ceil(barra.getBoundingClientRect().height)
  if (h > 40) document.documentElement.style.setProperty('--ll-dock', h + 'px')
}
// ResizeObserver: a secao avisa quando muda de altura (modo PT, janela,
// texto de duas linhas) e a reserva acompanha sozinha. Melhor que medir por
// frame — nao depende de animacao e nao fica sondando.
let docaRO = null
function observarDoca() {
  if (docaRO || !barra || typeof ResizeObserver !== 'function') return
  docaRO = new ResizeObserver(() => medirDoca())
  docaRO.observe(barra)
}
// ================================================================
// POSIÇÃO DO FLUTUANTE — medida, não adivinhada
// ================================================================
// Duas coisas vinham falhando por depender só de CSS:
//   1. esconder a régua no flutuante (`display:none` numa regra que confere
//      no teste e não valia na tela dele);
//   2. subir a legenda o suficiente acima da barra de progresso, o que exigia
//      acertar o nome da classe do painel da Netflix — que muda sem aviso.
// Aqui os dois são resolvidos MEDINDO o que está na tela: a régua some por
// `style` inline (vence qualquer folha), e a barra é ancorada logo acima do
// topo real dos controles. Se nada for encontrado, o CSS assume — a legenda
// fica um pouco mais alta e nunca cobre nada.
const SEL_CONTROLES = [
  '[data-uia="controls-standard"]',
  '.watch-video--bottom-controls-container',
  '[data-uia="timeline-bar"]',
  '.PlayerControlsNeo__bottom-controls',
  '.PlayerControlsNeo__layout'
]
function _topoDosControles() {
  for (const sel of SEL_CONTROLES) {
    const n = document.querySelector(sel)
    if (!n) continue
    const r = n.getBoundingClientRect()
    // Só serve se estiver visível E na metade de baixo da tela: alguns desses
    // seletores também casam com contêineres que ocupam a página inteira.
    if (r.height > 8 && r.top > innerHeight * 0.5) return r.top
  }
  return null
}

// `undefined` = ainda não calculei; `null` = calculei e NÃO achei o painel.
// Usar `null` para os dois fazia a função sair cedo depois de um reset e
// deixar o valor velho grudado no style — o teste pegou.
// O ponto mais alto que os controles já ocuparam nesta sessão de vídeo. É a
// régua da posição fixa. Zerado ao trocar de título (a altura do player muda).
let _pisoControles = null
let _ultimoFundo
function posicionarFlutuante() {
  if (!barra) return
  const flut = barra.classList.contains('englab-flut')
  const rule = barra.querySelector('#englab-rule')
  // A RÉGUA sai por style inline no flutuante: nenhuma folha de estilo
  // sobrescreve isso, e ela volta sozinha ao entrar na doca.
  if (rule) rule.style.display = flut ? 'none' : ''
  if (!flut) { if (_ultimoFundo !== undefined) { barra.style.bottom = ''; _ultimoFundo = undefined } return }
  const topo = _topoDosControles()
  // ⚠️ TRAVA NA POSIÇÃO DE CONTROLES VISÍVEIS. Medir a cada quadro fazia a
  // legenda SUBIR E DESCER junto com os controles, que aparecem e somem ao
  // mexer o mouse — o mesmo defeito que o salto 9%↔22% tinha, só que por
  // outro caminho. Guardamos o ponto MAIS ALTO já medido (controles à
  // mostra) e ficamos nele: some da frente da barra de progresso quando ela
  // aparece, e não se mexe quando ela some.
  let alvo = topo == null ? null : Math.max(72, Math.round(innerHeight - topo + 10))
  if (alvo != null) {
    if (_pisoControles == null || alvo > _pisoControles) _pisoControles = alvo
    alvo = _pisoControles
  } else if (_pisoControles != null) {
    alvo = _pisoControles          // controles sumiram: mantém o lugar
  }
  if (alvo === _ultimoFundo) return
  _ultimoFundo = alvo
  barra.style.bottom = alvo == null ? '' : alvo + 'px'
}

// ================================================================
// CONTROLES SÓ PERTO DA BARRA — não a cada movimento do mouse
// ================================================================
// A Netflix mostra o painel inteiro (barra de progresso + botões) a QUALQUER
// mexida do mouse sobre o player. Assistindo com legenda de estudo isso é
// ruído constante: o painel entra e sai o tempo todo, e era ele que tapava a
// cena e obrigava a legenda a ficar mais alta.
//
// A técnica é interceptar o movimento ANTES de a Netflix vê-lo (fase de
// captura no `document`) e engolir o evento quando o ponteiro está longe do
// rodapé. Perto do rodapé o evento passa e ela abre o painel normalmente —
// que é o comportamento do Language Reactor.
//
// POR QUE POR EVENTO E NÃO POR CSS: esconder o painel exigiria o nome da
// classe do container dela, que muda sem aviso (já tentei, e não casou).
// Interceptar o evento não depende de nome nenhum.
const ZONA_CONTROLES = 140   // px a partir do rodapé onde o painel PODE abrir

function _pertoDoRodape(y) { return y >= innerHeight - ZONA_CONTROLES }

function _engolirMovimento(e) {
  // Só quando a barra está ligada e flutuando: na doca o player é redimensionado
  // e o painel dela não atrapalha a cena.
  if (!cfgUI.ligada || cfgUI.doca) return
  if (_pertoDoRodape(e.clientY)) return          // deixa a Netflix abrir
  // Nunca engolir o que é NOSSO: a barra, o popup e o transcript precisam dos
  // próprios eventos de mouse (seleção de palavra, hover, arrastar).
  // ⚠️ SOBRE A NOSSA UI O MOVIMENTO TAMBEM NAO PODE VAZAR. Antes havia um
  // `return` seco aqui: o evento seguia e a Netflix abria o painel de
  // controles justamente quando ele ia ate a barra apertar Explicar/Preparar —
  // a "tela de suspensao" que ele relatou.
  //
  // ⚠️ MAS ENGOLIR AQUI CALA OS NOSSOS TAMBEM. Este interceptador roda em
  // CAPTURA no `document`; `stopPropagation` impede a descida E a subida,
  // entao os nossos ouvintes de `mousemove` registrados na bolha do document
  // (`controlesAmostra`, que mantem a barra a vista, e `_guardarTitulo`)
  // nunca seriam alcancados. Por isso eles sao chamados A MAO antes de engolir.
  const t = e.target
  if (t && t.closest && t.closest('#englab-bar, #englab-pop, #englab-transcript')) {
    try { _guardarTitulo() } catch (err) {}
    try { if (typeof controlesAmostra === 'function') controlesAmostra() } catch (err) {}
    e.stopPropagation()
    return
  }
  // ⚠️ O PONTEIRO SOME sem isto. A Netflix esconde o cursor junto com o
  // painel quando acha que você parou de mexer — e como estamos engolindo o
  // movimento, para ela você parou para sempre. Aqui devolvemos o cursor no
  // elemento sob o ponteiro, sem precisar saber em qual container ela pôs o
  // `cursor: none` (o valor é herdado, então mandar no filho basta).
  _garantirCursor(e.clientX, e.clientY)
  e.stopPropagation()
}

// ⚠️ NÃO cachear por elemento. A primeira versão guardava "já arrumei este" e
// saía cedo — mas a Netflix esconde o cursor por TEMPO DE OCIOSIDADE, não por
// movimento: quando ele para, ela some com o painel E com o ponteiro, e
// nenhum evento acontece para nós reagirmos. O cache fazia a checagem
// seguinte desistir no mesmo elemento, então o cursor ficava sumido.
// Agora a decisão é sempre pelo valor COMPUTADO — e só há escrita quando ele
// está de fato `none`, então repetir a checagem não custa nada.
// ⚠️ MARCA PERMANENTE, não conserto a cada ciclo. Devolver o cursor depois de
// a Netflix escondê-lo faz ele PISCAR: ela esconde, nós devolvemos 400ms
// depois, ela esconde de novo. O que resolve é a nossa regra passar a vencer
// para sempre naquele elemento — daí um atributo marcador e uma folha de
// estilo com `!important`, que ela não tem como derrubar ao trocar de classe.
//
// Marcar ANCESTRAIS é seguro: `cursor: auto !important` num pai NÃO impede um
// filho de declarar o próprio cursor (`pointer` num botão continua valendo).
// O !important só decide o valor DAQUELE elemento.
const ATTR_CURSOR = 'data-ll-cursor'
;(function _folhaDoCursor() {
  if (document.getElementById('englab-cursor-css')) return
  const st = document.createElement('style')
  st.id = 'englab-cursor-css'
  st.textContent = '[' + ATTR_CURSOR + ']{cursor:auto !important}'
  ;(document.head || document.documentElement).appendChild(st)
})()

let _ultimoX = 0, _ultimoY = 0
function _garantirCursor(x, y) {
  if (x != null) { _ultimoX = x; _ultimoY = y }
  let n = document.elementFromPoint(_ultimoX, _ultimoY)
  // Sobe a árvore marcando TUDO que esconde o cursor. A Netflix declara o
  // `none` num container, não na folha — marcar só o elemento sob o ponteiro
  // resolvia até ela trocar de classe, e o piscar voltava.
  let subiu = 0
  while (n && n !== document.documentElement && subiu < 12) {
    if (!n.hasAttribute(ATTR_CURSOR) && getComputedStyle(n).cursor === 'none') {
      n.setAttribute(ATTR_CURSOR, '')
    }
    n = n.parentElement
    subiu++
  }
}

// A VIGIA. É ela que cobre o caso do ponteiro PARADO, que é justamente quando
// a Netflix o esconde. 400ms é imperceptível para o olho e barato: um
// `elementFromPoint` e um `getComputedStyle` por ciclo, e só enquanto a barra
// está ligada no modo flutuante.
setInterval(() => {
  if (!cfgUI.ligada || cfgUI.doca) return
  _garantirCursor(null)
}, 400)
for (const tipo of ['mousemove', 'pointermove']) {
  document.addEventListener(tipo, _engolirMovimento, true)
}

// ================================================================
// O PLAY/PAUSE PASSA A SER NOSSO
// ================================================================
// ⚠️ ESTA E A CAUSA RAIZ DO "CLICO E NAO PAUSA". A Netflix decide o que fazer
// no clique conforme os controles estarem visiveis: escondidos, o primeiro
// clique so os REVELA; visiveis, ele alterna play/pause. Como engolimos o
// movimento do mouse para o painel nao tapar a cena, para ela o ponteiro nunca
// se move — os controles vivem escondidos e **todo clique e gasto em
// mostra-los**. Dai o pause/play erratico dele, "mesmo sem selecionar nada":
// nao era a selecao, era o preco de esconder o painel.
//
// A saida e nao depender do humor dela: o clique na area do video vira
// play/pause aqui, direto no elemento <video>. Previsivel sempre.
//
// FICA DE FORA, de proposito:
//   - a zona do rodape, onde ela abre os controles de verdade (barra de
//     progresso, botoes) e ele quer que funcione como sempre;
//   - a nossa UI, que tem os proprios cliques;
//   - o clique duplo, que e tela cheia — soltamos para ela tratar.
document.addEventListener('click', e => {
  if (!cfgUI.ligada || cfgUI.doca) return
  if (e.detail >= 2) return                       // duplo clique: tela cheia é dela
  if (_pertoDoRodape(e.clientY)) return           // controles de verdade
  const t = e.target
  if (t && t.closest && t.closest('#englab-bar, #englab-pop, #englab-transcript')) return
  const v = vid(); if (!v) return
  e.preventDefault()
  e.stopPropagation()
  if (v.paused) tocar(); else pausar()
}, true)

function aplicarDoca() {
  const on = !!(cfgUI.ligada && cfgUI.doca && idDoTitulo())
  document.documentElement.classList.toggle('englab-dock', on)
  if (on) { observarDoca(); medirDoca(); setTimeout(medirDoca, 80) }
  else document.documentElement.style.removeProperty('--ll-dock')
  if (barra) barra.classList.toggle('englab-flut', !cfgUI.doca)
  // Classe no <html> porque o painel de controles da Netflix é IRMÃO da
  // nossa barra, não filho — não dá para alcançá-lo de dentro dela.
  // Só quando a barra está de fato visível: desligada, a Netflix volta ao
  // tamanho dela e nada nosso fica pendurado no player.
  document.documentElement.classList.toggle(
    'englab-flut-on', !!(cfgUI.ligada && !cfgUI.doca && idDoTitulo()))
  _ultimoFundo = undefined       // força recalcular ao trocar de modo
  _pisoControles = null          // player pode ter outra altura
  posicionarFlutuante()
  const btn = barra && barra.querySelector('button[data-a="doca"]')
  if (btn) {
    btn.innerHTML = cfgUI.doca ? IC_BAIXO : IC_CIMA
    btn.title = cfgUI.doca ? 'Minimizar: legenda flutuando sobre o vídeo'
                           : 'Expandir: seção própria abaixo do vídeo'
  }
}

function aplicarNativa() {
  document.documentElement.classList.toggle('englab-hide-native', cfgUI.ligada && cfgUI.ocultaNativa)
}
function avisar(msg) {
  let t = document.getElementById('englab-toast')
  if (!t) { t = document.createElement('div'); t.id = 'englab-toast'; document.body.appendChild(t) }
  t.textContent = msg
  t.classList.add('on')
  clearTimeout(t._id); t._id = setTimeout(() => t.classList.remove('on'), 3200)
}

// ---- render da fala (palavras clicáveis) ----
function renderFala(texto) {
  if (!cfgUI.ligada) return
  const b = garantirBarra()
  const linha = b.querySelector('#englab-line')
  linha.innerHTML = ''
  for (const parte of texto.split(/([A-Za-zÀ-ÿ']+)/)) {
    if (/^[A-Za-zÀ-ÿ']+$/.test(parte)) {
      const s = document.createElement('span')
      s.className = 'englab-w'
      s.textContent = parte
      // Clique simples captura a palavra; arrastar (selecionar trecho) não —
      // por isso medimos o deslocamento entre mousedown e mouseup.
      s.onmousedown = ev => { s._x = ev.clientX; s._y = ev.clientY }
      s.onclick = ev => {
        const arrastou = s._x != null &&
          (Math.abs(ev.clientX - s._x) > 4 || Math.abs(ev.clientY - s._y) > 4)
        s._x = s._y = null
        // ⚠️ O `stopPropagation` VEM ANTES DA DESISTENCIA. Terminar uma
        // selecao em cima de uma palavra caia neste `return` e o clique seguia
        // para o player: o filme pausava no meio do gesto de selecionar.
        ev.stopPropagation()
        if (arrastou || String(window.getSelection() || '').trim()) return   // seleção manda
        salvarCaptura(parte.toLowerCase(), texto); piscar(s)
      }
      linha.appendChild(s)
    } else linha.appendChild(document.createTextNode(parte))
  }
  // A barra NAO some no silencio (senao nao daria para clicar em "voltar a
  // ultima fala" justo quando se precisa) — mas FORA do player (menu, busca,
  // pagina inicial) ela nao tem o que fazer.
  b.style.display = (idDoTitulo() && vid()) ? 'flex' : 'none'
  b.classList.toggle('englab-mudo', !texto)
  if (texto) b.classList.remove('englab-sem-leg')
  pintarPT()
}

// ---- popup de seleção: Explicar / Preparar ----
let popCtx = ''          // fala de origem CONGELADA no instante da selecao
let popPausou = false
// Declarados AQUI, e nao junto de `_lexaFalar`: `fecharPopupSel()` os zera e
// roda antes daquele trecho ser alcancado — `let` mais abaixo daria
// ReferenceError por zona morta temporal (mesma pegadinha do `_tituloVisto`).
let popHist = []          // [{quem:'lexa'|'aluno', texto}] — a conversa desta selecao
let popOcupado = false
function mostrarPopupSel() {
  const sel = String(window.getSelection() || '').trim()
  const antigo = document.getElementById('englab-pop')
  if (!sel) { fecharPopupSel(); return }
  // Congela AQUI: o video pode voltar a rodar enquanto o mouse vai ate o
  // botao, e ai "ultimoTexto" ja seria outra fala (bug relatado).
  popCtx = ultimoTexto
  const vv = vid()
  if (vv && !vv.paused) { pausar(); popPausou = true }
  const pop = antigo || document.createElement('div')
  pop.id = 'englab-pop'
  pop.innerHTML = `
    <div class="englab-pop-row">
      <b>"${sel.length > 40 ? sel.slice(0, 40) + '…' : sel}"</b>
      <button data-p="exp">Explicar</button>
      <button data-p="rev">Preparar</button>
    </div>
    <div class="englab-pop-body" id="englab-pop-body"></div>
    <div class="englab-pop-chat" id="englab-pop-chat" hidden>
      <input id="englab-pop-q" type="text" placeholder="pergunte mais sobre isto…" autocomplete="off">
      <button id="englab-pop-send" title="Perguntar (Enter)"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></button>
    </div>`
  if (!antigo) document.body.appendChild(pop)
  pop.onmousedown = e => e.preventDefault()   // não colapsa a seleção
  pop.querySelector('[data-p="rev"]').onclick = () => {
    salvarCaptura(sel.toLowerCase(), popCtx); avisar(`"${sel}" vai para o Preparar`); fecharPopupSel()
  }
  pop.querySelector('[data-p="exp"]').onclick = () => _lexaFalar(pop, sel, null)

  // ⚠️ O CAMPO PRECISA DOS PROPRIOS EVENTOS. O popup tem
  // `onmousedown = preventDefault` para nao colapsar a selecao da legenda —
  // e isso tambem impede o campo de receber o cursor. Aqui devolvemos o foco
  // a mao, so para ele.
  const q = pop.querySelector('#englab-pop-q')
  q.onmousedown = e => { e.stopPropagation(); setTimeout(() => q.focus(), 0) }
  // Teclas param aqui: a Netflix usa espaco para pausar e as setas para
  // avancar — digitar "para que serve" faria o filme pular pela tela.
  q.onkeydown = e => {
    e.stopPropagation()
    if (e.key === 'Enter') { e.preventDefault(); _lexaFalar(pop, sel, q.value) }
    if (e.key === 'Escape') { e.preventDefault(); fecharPopupSel() }
  }
  q.onkeyup = q.onkeypress = e => e.stopPropagation()
  pop.querySelector('#englab-pop-send').onclick = () => _lexaFalar(pop, sel, q.value)
}

// ================================================================
// A CONVERSA COM A LEXA, DENTRO DO PLAYER
// ================================================================
// No site ele CONTINUA perguntando; aqui vinha uma resposta seca e acabou.
// O historico e por SELECAO: trocar de palavra comeca conversa nova, porque a
// cena e outra e arrastar o papo anterior so confundiria.
function _lexaBolha(quem, texto, pendente) {
  return `<div class="englab-fala englab-fala-${quem}${pendente ? ' englab-pend' : ''}">${
    quem === 'aluno' ? escapar(texto) : _marcacaoDaLexa(texto)}</div>`
}

function _lexaPintar(pop) {
  const body = pop.querySelector('#englab-pop-body')
  body.innerHTML = popHist.map(t => _lexaBolha(t.quem, t.texto, t.pendente)).join('')
  body.scrollTop = body.scrollHeight
}

function _lexaFalar(pop, sel, pergunta) {
  if (popOcupado) return
  const v2 = vid(); if (v2 && !v2.paused) { pausar(); popPausou = true }
  const q = pop.querySelector('#englab-pop-q')
  const chat = pop.querySelector('#englab-pop-chat')

  if (pergunta != null) {
    const txt = String(pergunta).trim()
    if (!txt) { q.focus(); return }
    popHist.push({ quem: 'aluno', texto: txt })
    q.value = ''
  }
  popHist.push({ quem: 'lexa', texto: 'pensando…', pendente: true })
  popOcupado = true
  _lexaPintar(pop)

  pedirExt(() => chrome.runtime.sendMessage({
    type: 'ai-explicar', alvo: sel, contexto: popCtx, titulo: titulo(),
    // manda o historico SEM o balao de "pensando", que e so da tela
    historico: popHist.filter(t => !t.pendente).map(t => ({ quem: t.quem, texto: t.texto }))
  })).then(resp => {
    popHist.pop()                                  // tira o "pensando"
    popHist.push({ quem: 'lexa', texto: (resp && resp.ok) ? resp.texto
      : 'Não deu: ' + ((resp && resp.erro) || 'sem resposta') })
  }).catch(() => {
    popHist.pop()
    popHist.push({ quem: 'lexa', texto: 'Extensão atualizada — recarregue a página (F5).' })
  }).finally(() => {
    popOcupado = false
    chat.hidden = false                            // só aparece depois da 1ª resposta
    _lexaPintar(pop)
    q.focus()
  })
}
function fecharPopupSel() {
  const pop = document.getElementById('englab-pop')
  if (pop) pop.remove()
  if (popPausou) { tocar(); popPausou = false }
  popCtx = ''
  // A conversa morre com o painel: ela pertence AQUELA selecao, naquela cena.
  // Deixar viva faria a proxima palavra herdar o papo da anterior.
  popHist = []
  popOcupado = false
}
// ⚠️ O CLIQUE QUE FECHA O POPUP NAO PODE CHEGAR AO PLAYER. Era a causa do
// "clico fora, o painel nao some e o video nao roda; clico de novo e ele liga
// e desliga sozinho". O mesmo clique fazia DUAS coisas:
//   1. fechava o popup, e `fecharPopupSel` manda o video voltar a tocar;
//   2. seguia ate o player da Netflix, que alterna play/pause em qualquer
//      clique na tela — desfazendo (1) no mesmo instante.
// O saldo era video parado. No clique seguinte, ja sem popup, so o toggle da
// Netflix rodava: liga. E se o popup tivesse reaberto pela selecao ainda viva,
// pausava de novo — o "liga e desliga" que ele viu.
//
// Fase de CAPTURA e propagacao cortada: este clique tem UM proposito, fechar
// o painel. E a selecao e limpa junto, senao o `mouseup` logo abaixo veria
// texto selecionado e reabriria o popup que acabou de fechar.
document.addEventListener('mousedown', e => {
  const pop = document.getElementById('englab-pop')
  if (!pop) return
  const alvo = e.target
  const dentro = pop.contains(alvo) || (alvo.closest && alvo.closest('#englab-line, #englab-bar'))
  if (dentro) return
  e.preventDefault()
  e.stopPropagation()
  try { const s = window.getSelection(); if (s) s.removeAllRanges() } catch (err) {}
  fecharPopupSel()
}, true)

// Esc fecha, como qualquer painel. Sem isto o unico jeito de sair era clicar
// fora — e clicar fora era justamente o que estava quebrado.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return
  if (!document.getElementById('englab-pop')) return
  e.preventDefault(); e.stopPropagation()
  try { const s = window.getSelection(); if (s) s.removeAllRanges() } catch (err) {}
  fecharPopupSel()
}, true)

// ---- RÉGUA DE FALAS (deslizante) -----------------------------------
// Cada bloco é uma fala: largura = duração, vão = silêncio. O trilho é
// montado UMA vez em pixels e depois só DESLIZA (transform a cada frame),
// em vez de ser repintado — é isso que dá o movimento macio.
const RULE_PXS = 16          // pixels por segundo de vídeo
const RULE_BLOCO = 300       // segundos montados de cada vez
let ruleTrack = null, ruleRaf = null, ruleIni = null, ruleCur = null

function montarRegua(t) {
  const el = barra && barra.querySelector('#englab-rule')
  if (!el) return
  if (!cues.length) { el.style.display = 'none'; return }
  el.style.display = 'block'
  ruleIni = Math.max(0, t - RULE_BLOCO / 2)
  const fim = ruleIni + RULE_BLOCO
  let html = ''
  for (const c of cues) {
    if (c.e < ruleIni) continue
    if (c.s > fim) break
    html += `<i class="englab-rb" data-t="${c.s}"
      style="left:${((c.s - ruleIni) * RULE_PXS).toFixed(1)}px;width:${Math.max((c.e - c.s) * RULE_PXS, 4).toFixed(1)}px"
      title="${escapar(c.t).slice(0, 90)}"></i>`
  }
  let track = el.querySelector('.englab-rtrack')
  if (!track) {
    el.innerHTML = '<div class="englab-rtrack"></div><b class="englab-rnow"></b>'
    track = el.querySelector('.englab-rtrack')
  }
  track.innerHTML = html
  ruleTrack = track
  ruleCur = null
}

function loopRegua() {
  ruleRaf = requestAnimationFrame(loopRegua)
  const v = vid()
  if (!v || !ruleTrack || !cues.length || ruleIni == null) return
  const t = v.currentTime
  // remonta só quando o tempo se aproxima da borda do bloco montado
  if (t < ruleIni + 20 && ruleIni > 0) { montarRegua(t); return }
  if (t > ruleIni + RULE_BLOCO - 20) { montarRegua(t); return }
  const el = ruleTrack.parentElement
  const meio = el.clientWidth / 2
  ruleTrack.style.transform = `translate3d(${(meio - (t - ruleIni) * RULE_PXS).toFixed(2)}px,0,0)`
  // destaque muda de bloco raramente: só mexe no DOM quando troca
  const i = cueEm(t)
  const alvo = i >= 0 ? String(cues[i].s) : null
  if (alvo !== ruleCur) {
    ruleTrack.querySelector('.englab-rb.cur')?.classList.remove('cur')
    if (alvo) ruleTrack.querySelector(`.englab-rb[data-t="${alvo}"]`)?.classList.add('cur')
    ruleCur = alvo
  }
}
if (!ruleRaf) loopRegua()

// ---- transcript do episódio ----
function renderTranscript() {
  if (!cfgUI.transcript) { painel?.remove(); painel = null; return }
  if (!painel) {
    painel = document.createElement('div')
    painel.id = 'englab-transcript'
    // Mesma trava da barra: ler o transcript, buscar dentro dele ou rolar não
    // pode alternar o play do filme por baixo.
    painel.addEventListener('mousedown', e => e.stopPropagation())
    painel.addEventListener('click', e => e.stopPropagation())
    document.body.appendChild(painel)
  }
  const linhas = cues.length ? cues : histórico.map((h, i) => ({ s: h.t, e: h.t, t: h.texto, _h: i }))
  if (!linhas.length) { painel.innerHTML = `<div class="englab-tr-vazio">Sem legenda capturada ainda — troque a legenda no player para o inglês.</div>`; return }
  painel.innerHTML = `
    <div class="englab-tr-head">
      <b>${cues.length ? cues.length + ' falas' : histórico.length + ' falas (do que já passou)'}</b>
      <input id="englab-tr-busca" placeholder="Buscar na legenda...">
    </div>
    <div class="englab-tr-list" id="englab-tr-list">
      ${linhas.map((c, i) => `
        <div class="englab-tr-line${i === idxAtual ? ' cur' : ''}" data-i="${i}" data-t="${c.s}">
          <span class="englab-tr-time">${fmt(c.s)}</span>
          <span class="englab-tr-txt">${escapar(c.t)}</span>
          ${cfgUI.pt && ptCache.get(chavePT(c.t)) ? `<span class="englab-tr-pt">${escapar(ptCache.get(chavePT(c.t)))}</span>` : ''}
        </div>`).join('')}
    </div>`
  painel.querySelector('#englab-tr-list').onclick = e => {
    e.stopPropagation()          // idem: pular para uma fala não pode pausar o filme
    const l = e.target.closest('.englab-tr-line'); if (!l) return
    seek(parseFloat(l.dataset.t) - 0.2)
  }
  painel.querySelector('#englab-tr-busca').oninput = e => {
    const q = e.target.value.toLowerCase()
    painel.querySelectorAll('.englab-tr-line').forEach(l => {
      l.style.display = !q || l.textContent.toLowerCase().includes(q) ? '' : 'none'
    })
  }
  const cur = painel.querySelector('.englab-tr-line.cur')
  if (cur) cur.scrollIntoView({ block: 'center' })
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
// `"` também (rodada 44): diálogo com aspas fechava o title="" da régua no
// meio e o resto virava atributo-lixo.
const escapar = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Só move a marcação de fala atual — SEM reconstruir o painel (rodada 44).
// O re-render a cada fala recriava o campo de busca vazio no meio da
// digitação, perdia o filtro aplicado e roubava a rolagem de volta ao centro.
function transcriptMarcarAtual() {
  if (!painel) return
  const antiga = painel.querySelector('.englab-tr-line.cur')
  if (antiga) antiga.classList.remove('cur')
  const nova = painel.querySelector(`.englab-tr-line[data-i="${idxAtual}"]`)
  if (!nova) return
  nova.classList.add('cur')
  // A rolagem acompanha a fala SÓ quando ele não está mexendo no painel:
  // busca ativa ou mouse em cima = a rolagem é dele.
  const busca = painel.querySelector('#englab-tr-busca')
  if ((busca && busca.value) || painel.matches(':hover')) return
  nova.scrollIntoView({ block: 'center' })
}

// ================================================================
// A MARCACAO DA LEXA, TAMBEM AQUI
// ================================================================
// ⚠️ Ele viu `**"ice chips"**` com os asteriscos na cara. O modelo escreve em
// markdown mesmo mandado nao escrever — o app ja aprendeu isso e RENDERIZA em
// vez de proibir (ver `lexaInline`, em js/ai.js): a enfase que ele quis dar e
// informacao, e jogar fora empobrece a explicacao. A extensao ficou de fora
// daquela licao e mostrava cru.
//
// ORDEM OBRIGATORIA: escapar SEMPRE primeiro — o texto vem de fora e vai para
// `innerHTML` —, e `**` antes de `*`, senao o negrito vira dois italicos
// vazios. As quebras de linha viram <br> porque o popup e uma caixa so.
function _marcacaoDaLexa(t) {
  return escapar(String(t || '').trim())
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    // ⚠️ `\S` nas pontas: sem isso, "2 * 3 * 4" virava "2 <i> 3 </i> 4" —
    // asterisco de multiplicacao lido como enfase. Italico de verdade nunca
    // tem espaco colado por dentro.
    .replace(/(^|[^*])\*(\S(?:[^*\n]*\S)?)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>')
}

// ---- o que mostrar AGORA -------------------------------------------
// Regra de ouro: o DOM e a verdade do que esta na tela (nunca perde uma
// fala, mesmo que o arquivo de legenda venha incompleto ou atrasado). O
// arquivo serve para navegar, traduzir na frente e montar o transcript.
// ---- por que a area da legenda esta vazia? ----------------------------
// Silencio entre falas e uma coisa; nao ter legenda NENHUMA e outra, e o
// usuario merece saber a diferenca em vez de encarar uma faixa muda.
let semLegDesde = 0
function outroLeitorDeLegenda() {
  // O Language Reactor (prefixo "lln"/"lr-") tambem intercepta a legenda da
  // Netflix; com os dois ligados, um pode consumir o que o outro esperava.
  return !!document.querySelector('[id^="lln"], [class^="lln"], [id^="lr-app"], [class*="language-reactor"]')
}
function conferirSemLegenda() {
  if (!barra) return
  const temAlgo = cues.length > 0 || !!textoDOM()
  if (temAlgo) { semLegDesde = 0; barra.classList.remove('englab-sem-leg'); return }
  if (!semLegDesde) { semLegDesde = Date.now(); return }
  if (Date.now() - semLegDesde < 5000) return          // pode ser so um silencio longo
  const linha = barra.querySelector('#englab-line')
  if (linha) linha.dataset.dica = outroLeitorDeLegenda()
    ? 'Nenhuma legenda chegou até aqui. O Language Reactor está ativo nesta aba e também intercepta a legenda da Netflix — desative-o e recarregue a página.'
    : 'Nenhuma legenda chegou até aqui. Ligue a legenda em inglês no player da Netflix; se já estiver ligada, troque de idioma e volte para o inglês (isso faz a Netflix baixar o arquivo de novo).'
  barra.classList.add('englab-sem-leg')
}

function renderAtual() {
  const v = vid()
  // A barra nasce assim que estamos num player — mesmo em silencio. Antes
  // ela so era criada quando um texto MUDAVA, entao um video que comecava
  // calado ficava sem barra (e sem os botoes de navegacao).
  if (cfgUI.ligada && idDoTitulo() && v) garantirBarra().style.display = 'flex'
  posicionarFlutuante()   // os controles aparecem e somem; a medida acompanha
  const doDOM = textoDOM()
  let t = ''
  if (cues.length && v) {
    // O ARQUIVO manda quando cobre o instante: assim a fala exibida e a
    // traduzida sao a MESMA (fim do descompasso EN x PT).
    const i = cueEm(v.currentTime)
    t = i >= 0 ? cues[i].t : ''
  }
  if (!t) t = doDOM        // silencio no arquivo (ou sem arquivo): usa a tela
  if (t === ultimoTexto) return
  ultimoTexto = t
  if (t && v) {
    histórico.push({ t: v.currentTime, texto: t })
    if (histórico.length > 600) histórico.shift()
  }
  renderFala(t)
  aplicarNativa()
  if (cfgUI.pt && t && !ptCache.has(chavePT(t))) traduzirAvulsa(t)
  // No modo DOM o transcript cresce com o histórico e precisa do render cheio
  // — mas nunca POR CIMA de quem está usando o painel (busca digitada ou mouse
  // em cima): o re-render apagava a busca no meio e roubava a rolagem.
  if (cfgUI.transcript && !_trOcupado()) renderTranscript()
}

function _trOcupado() {
  if (!painel) return false
  const busca = painel.querySelector('#englab-tr-busca')
  return !!(busca && (busca.value || busca === document.activeElement)) || painel.matches(':hover')
}

setInterval(() => {
  // vigia a troca de episodio/filme e a saida para o menu
  const idAgora = idDoTitulo()
  if (idAgora !== tituloId) {
    tituloId = idAgora
    resetarSessao()
    if (idAgora) avisar('novo título — legenda zerada')
  }
  if (!idAgora) {                       // no menu: some e nao processa nada
    if (barra) barra.style.display = 'none'
    document.documentElement.classList.remove('englab-hide-native')
    document.documentElement.classList.remove('englab-dock')
    document.documentElement.classList.remove('englab-flut-on')
    return
  }
  const v = vid(); if (!v) return
  if (cues.length) {
    const i = cueEm(v.currentTime)
    if (i !== idxAtual) { idxAtual = i; if (cfgUI.transcript) transcriptMarcarAtual() }
    if (cfgUI.pt) traduzirJanela(v.currentTime)
    if (ruleIni == null) montarRegua(v.currentTime)
  }
  renderAtual()
  conferirSemLegenda()
}, 120)

// ---- fallback: observa o DOM (sempre ativo; manda quando não há arquivo) ----
function textoDOM() {
  const c = document.querySelector('.player-timedtext')
  if (!c) return ''
  return [...c.querySelectorAll('.player-timedtext-text-container')]
    .map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ')
}
let deb = null
new MutationObserver(() => {
  clearTimeout(deb)
  deb = setTimeout(renderAtual, 40)   // reage na hora; o relogio e a rede de seguranca
}).observe(document.body, { childList: true, subtree: true, characterData: true })

// ---- a barra sai da frente dos controles do player -------------------
// A Netflix mostra os controles ao mover o mouse e os esconde sozinha
// depois de alguns segundos; seguimos o mesmo ritmo.
let ctrlTimer = null
function controlesAmostra() {
  if (!barra || cfgUI.doca) return          // na doca nao ha sobreposicao
  barra.classList.add('englab-up')
  document.getElementById('englab-pop')?.classList.add('englab-up')
  clearTimeout(ctrlTimer)
  ctrlTimer = setTimeout(() => {
    barra && barra.classList.remove('englab-up')
    document.getElementById('englab-pop')?.classList.remove('englab-up')
  }, 3600)
}
document.addEventListener('mousemove', controlesAmostra, { passive: true })
document.addEventListener('keydown', controlesAmostra, { passive: true })

// ---- atalhos ----
document.addEventListener('keydown', e => {
  if (!cfgUI.ligada) return
  const tag = (document.activeElement?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea') return
  if (e.ctrlKey || e.altKey || e.metaKey) return
  const k = e.key.toLowerCase()
  if (k === 'arrowleft')  { e.preventDefault(); e.stopPropagation(); falaAnterior() }
  else if (k === 'arrowright') { e.preventDefault(); e.stopPropagation(); proximaFala() }
  else if (k === 'r') { e.preventDefault(); repetirFala() }
  else if (k === 'p') { barra?.querySelector('button[data-a="pt"]')?.click() }
  else if (k === 't') { barra?.querySelector('button[data-a="tr"]')?.click() }
}, true)

// religar pela popup da extensão
try { chrome.runtime.onMessage.addListener(msg => {
  // Desligar pela popup: o interruptor de lá manda os dois lados, e sem este
  // ramo só dava para RELIGAR — desligar exigia achar o botão na própria
  // barra, que é justamente o que o switch veio resolver.
  if (msg && msg.type === 'englab-desligar') {
    cfgUI.ligada = false; salvarUI()
    if (barra) barra.style.display = 'none'
    aplicarNativa(); aplicarDoca()
    return
  }
  if (msg && msg.type === 'englab-religar') {
    cfgUI.ligada = true; salvarUI()
    if (barra) barra.style.display = 'flex'
    aplicarNativa()
    // `aplicarDoca()` FALTAVA aqui. Só existem dois modos — doca e flutuante —
    // e é ela que aplica a classe de um ou de outro. Religando pela popup, a
    // barra reaparecia SEM nenhuma das duas e caía no estilo base, que não é
    // um modo: é o alicerce que os dois herdam. Dava uma aparência que o
    // usuário nunca escolheu.
    aplicarDoca()
  }
}) } catch (e) { morrer() }

// Rede de segurança: engole o erro de contexto invalidado para ele não
// poluir a lista de Erros da extensão (acontece ao atualizar a extensão
// com a aba da Netflix aberta).
window.addEventListener('error', ev => {
  const m = String((ev && ev.message) || '')
  if (m.includes('Extension context invalidated') || m.includes('Receiving end does not exist')) {
    morrer(); ev.preventDefault(); ev.stopImmediatePropagation()
  }
}, true)

// A altura da secao muda com a largura da janela (o texto reflui)
window.addEventListener('resize', () => { if (cfgUI.doca) medirDoca() })
