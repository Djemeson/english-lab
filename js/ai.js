// ================================================================
// LEXA — a voz da IA do Language Lab
// ================================================================
// Mora AQUI (arquivo não-lazy) porque quem explica algo ao aluno está
// espalhado pelo app: o Assistente, o Preparar, a legenda do vídeo, o leitor
// de ebooks e o service worker da extensão. Personalidade escrita em cinco
// lugares vira cinco pessoas diferentes.
//
// A regra difícil deste prompt é a última linha do pedido do Djemeson:
// "humorada, mas no tom certo, quase imperceptível". Por isso o prompt gasta
// mais palavras PROIBINDO caricatura do que descrevendo a persona — modelo
// barato, se você disser só "paraense e bem-humorada", devolve "égua,
// maninho!" em toda resposta. O sotaque dela é temperamento, não fantasia.
const LEXA_NOME = 'Lexa'
// `lexaNome()` — o acessor tolerante — mora em `core.js`, o primeiro arquivo a
// carregar. Ele nasceu em `ler.js` (LAZY), e quando o painel e o menu de
// seleção daqui passaram a chamá-lo virou a armadilha nº 1: shell falando com
// símbolo de arquivo lazy. Dentro DESTE arquivo dá para usar `LEXA_NOME`
// direto, que é daqui mesmo.

function lexaSistema(extra) {
  const nome = (typeof getLangDef === 'function' && typeof activeLang === 'function')
    ? getLangDef(activeLang()).name.toLowerCase() : 'inglês'
  return `Você é a Lexa, tutora de ${nome} do Language Lab. Mulher, paraense de Belém, jovem, muito inteligente e prática — aprendeu ${nome} na marra, assistindo série e lendo, então sabe exatamente onde dói.

COMO ELA SOA (isto pesa mais que o conteúdo):
- Calorosa e direta ao mesmo tempo. Fala como gente: "olha", "repara", "na prática".
- Bom humor em dose homeopática: no máximo uma piscadela por resposta, e só quando cabe sozinha. Se a explicação já está boa, não force graça nenhuma.
- Ser paraense é JEITO, não vocabulário: acolhedora, sem cerimônia, resolve rápido. NUNCA escreva "égua", "maninho", "maninha", "pai d'égua", "arre", "vixe" nem qualquer marca regional. Nada de sotaque escrito, nada de personagem.
- Nunca se apresenta, nunca fala de si mesma, nunca usa emoji, nunca abre com "Claro!", "Ótima pergunta" ou "Vamos lá".
- Trata o aluno por você, sem diminutivos condescendentes.
${extra || ''}`
}

// Explicação curta (Preparar, vídeo, leitor, extensão): a mesma voz, com o
// formato que essas telas comportam — 2 a 4 frases, sem introdução.
function lexaExplicar() {
  return lexaSistema(`
TAREFA AGORA: explicar um trecho para o aluno, em português do Brasil.
- 2 a 4 frases. Sem introdução, sem repetir a pergunta, sem despedida.
- Traduza o SENTIDO na cena, nunca palavra por palavra.
- Decida O QUE a coisa É nesta cena e use a palavra portuguesa DAQUILO ("barrel" de fuzil é "cano", nunca "barril") — sem ficar em cima do muro entre dois domínios.
- Gíria, marca, referência cultural ou nome próprio: diga o que é no mundo real.
- PRONOME RESPONDE AO QUE VEIO ANTES. Antes de decidir o sentido, ache no texto em volta a que "it/this/that/them/one" se refere, e use ESSA coisa na explicação. Caso real: "Macintosh holds out his hand. Billy rises and shakes it." — "it" é a MÃO, então é apertar a mão; ler "shake it" como a gíria de dançar é ignorar a frase anterior. Se o antecedente estiver no texto, a leitura idiomática só vale se a literal não fizer sentido ali.`)
}

// ================================================================
// MARKDOWN DA LEXA — o modelo escreve em markdown, sempre
// ================================================================
// Pedir "não use markdown" no prompt não resolve: o modelo escorrega de volta,
// e o preço do escorregão é o aluno lendo `**pals** = "amigos"` com os
// asteriscos na cara. Então em vez de proibir, RENDERIZA — o ênfase que ele
// quis dar é informação, não sujeira, e jogá-la fora empobreceria a explicação.
//
// Ordem obrigatória: escapar SEMPRE primeiro (a resposta é texto de fora),
// depois `**` antes de `*` (senão o negrito vira dois itálicos vazios).
function lexaInline(t) {
  return String(t || '')
    // HTML que a IA às vezes manda de propósito: volta a valer, só nas tags de
    // ênfase. Tudo o mais continua escapado.
    .replace(/&lt;(\/?(?:b|strong|i|em))&gt;/gi, '<$1>')
    // O asterisco precisa COLAR no texto dos dois lados, como no markdown de
    // verdade — senão "3 * 4 * 5" vira "3 <i> 4 </i> 5". Sem lookbehind, que
    // não existe em Safari antigo: o próprio grupo proíbe espaço nas pontas.
    .replace(/\*\*([^\s*][^*\n]*?[^\s*]|[^\s*])\*\*/g, '<b>$1</b>')
    .replace(/\*([^\s*][^*\n]*?[^\s*]|[^\s*])\*/g, '<i>$1</i>')
    // Sublinhado só com fronteira de palavra: `snake_case_assim` não é itálico.
    .replace(/(^|[\s(["'])_([^_\n]+?)_(?=[\s.,;:!?)\]"']|$)/g, '$1<i>$2</i>')
    .replace(/`([^`\n]+?)`/g, '<code>$1</code>')
}

// Texto curto da Lexa (leitor, vídeo, Preparar) já pronto para innerHTML.
function lexaFormatar(txt) {
  const escapado = (typeof esc === 'function' ? esc(txt) : String(txt || ''))
  // Marcador de lista ANTES do itálico: "* item" não é ênfase, e sem isto o
  // asterisco solto engoliria o resto da linha.
  // ⚠️ LINK DE MARKDOWN NÃO PASSA CRU. Sem isto, a citação que o modelo cola no
  // meio do texto — `([catalogue.bnf.fr](https://…?utm_source=openai))` —
  // aparecia inteira na tela, colchete, parêntese e URL, várias vezes por
  // resposta. Foi metade do que ele chamou de "vômito de informação".
  // A fonte não se perde: ela já sai no rodapé, em chip clicável.
  const semLinks = escapado
    .replace(/\(\s*\[[^\]\n]*\]\([^)\n]*\)\s*\)/g, '')   // a citação entre parênteses, inteira
    .replace(/\[([^\]\n]+)\]\([^)\n]*\)/g, '$1')          // link solto: fica só o texto
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
  return lexaInline(semLinks.replace(/^\s*\*\s+/gm, '• '))
    .replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>')
}

// ================================================================
// CONVERSA COM A LEXA DENTRO DO BALÃO
// ================================================================
// A explicação respondia UMA pergunta e fechava o assunto. Mas a dúvida real
// raramente acaba na primeira resposta — "e por que não X?", "isso é comum?",
// "me dá outro exemplo" — e para perguntar isso ele tinha de sair do livro,
// ir ao Assistente e recontar o contexto todo do zero.
//
// Aqui a linha continua: a explicação vira a PRIMEIRA MENSAGEM de uma conversa
// que já nasce sabendo o livro, a frase e o termo. Componente compartilhado de
// propósito — o leitor, o Preparar e o vídeo têm popups diferentes e a mesma
// necessidade; cada um só precisa chamar `lexaChatMontar` no corpo dele.
//
// O histórico vive NO ELEMENTO (`_lexaMsgs`), não numa variável global: dois
// popups abertos em telas diferentes não podem misturar conversa, e quando o
// popup morre a conversa morre com ele — é dúvida de passagem, não sessão.
function lexaChatHTML() {
  return `
    <div class="lexa-chat">
      <div class="lexa-chat-msgs"></div>
      <form class="lexa-chat-form" autocomplete="off">
        <input type="text" class="lexa-chat-inp" placeholder="Pergunte mais sobre isto…"
               aria-label="Pergunte mais sobre este trecho">
        <button type="submit" class="lexa-chat-env" aria-label="Enviar">${ic('send', 'ic-sm')}</button>
      </form>
    </div>`
}

// ================================================================
// O PAINEL DA LEXA — a explicação deixa de morar num popup de 420px
// ================================================================
// O BALÃO SUSPENSO — a ÚNICA casa das explicações da Lexa, no projeto inteiro.
//
// Houve uma fase de painel de tela cheia, e ela morreu no uso: *"o painel
// completo só deveria ser aberto quando a IA analisa o capítulo do livro, onde
// tem que selecionar dezenas de chips e dizer se conheço ou não. Todo o resto
// onde a Lexa explica deve ser no menu suspenso mesmo. Em todo o projeto deve
// ser assim."*
//
// A razão é o GESTO. Perguntar durante a leitura é coisa de passagem: você
// tropeça numa palavra, quer saber e voltar para onde estava. O painel cobre a
// página e tira de vista justamente a frase que gerou a pergunta — some o
// motivo junto com a dúvida. O balão fica POR CIMA do texto, e o texto continua
// ali atrás. A única tela que merece a superfície inteira é a triagem do
// capítulo, que tem centenas de chips para marcar — e essa já tem a dela
// (`#ler-niv-area`), sem passar por aqui.
//
// Fechar é barato porque o material sobrevive: a quebra da frase está no
// IndexedDB (ver `quebrarTrecho`), então reabrir não custa chamada nenhuma.
//
// O balão é o MESMO elemento do menu de seleção (`#sel-menu`, com a classe
// `sel-exp`) — de propósito: assim só existe um objeto flutuante de cada vez,
// com um jeito só de fechar, e abrir a explicação nunca deixa um menu órfão
// pendurado atrás dela.

// Onde ancorar: aceita elemento, evento, DOMRect — ou nada, e aí ele nasce no
// alto e ao centro. Quem chama a partir de um popup passa o popup: o balão
// aparece onde a mão dele já estava.
function _lexaRetangulo(alvo) {
  if (!alvo) return { top: Math.round(innerHeight * 0.28), bottom: Math.round(innerHeight * 0.28),
                      left: innerWidth / 2, width: 0 }
  if (alvo.top !== undefined && alvo.width !== undefined) return alvo
  const e = alvo.currentTarget || alvo.target || alvo
  const r = (e && e.getBoundingClientRect) ? e.getBoundingClientRect() : null
  return r || _lexaRetangulo(null)
}

// Abre o balão e devolve o CORPO, onde quem chamou escreve.
// ⚠️ `frase` é ACEITO E NÃO MOSTRADO, de propósito: *"aparece o texto todo que
// a IA tá lendo e isso é irrelevante, pode ficar oculto"*. E é mesmo — num
// balão suspenso a frase está logo ali atrás, na página; repeti-la só empurrava
// a resposta para baixo. Os chamadores continuam passando porque é o mesmo
// texto que vira `trecho` dos chips.
function lexaBalaoAbrir({ titulo, frase, fonte, alvo, acoes, reusar }) {
  // ⚠️ REFAZER NÃO É REABRIR. Ele viu e nomeou: *"a Lexa fecha seu painel e
  // abre um novo do zero"*. Era isso mesmo — o botão da web chamava a função
  // inteira, que abria outro balão: a conversa que ele tivesse tido morria, a
  // posição saltava, e parecia uma segunda cobrança começando. Reaproveitando
  // o balão, o que muda é só o texto lá dentro.
  const atual = document.getElementById('sel-menu')
  if (reusar && atual && atual.classList.contains('sel-exp')) {
    const c = atual.querySelector('.sel-exp-corpo')
    if (c) { c.innerHTML = ''; return c }
  }
  _selMenuFechar()
  const r = _lexaRetangulo(alvo)
  const p = document.createElement('div')
  p.id = 'sel-menu'
  p.className = 'sel-exp'
  p.innerHTML = `
    <header class="sel-exp-cab">
      <b>${esc(titulo || LEXA_NOME)}</b>
      ${fonte ? `<span class="sel-exp-fonte">${esc(fonte)}</span>` : ''}
      ${acoes || ''}
      <button class="sel-exp-btn" onclick="_selMenuFechar()" data-tip="Fechar">${ic('x','ic-sm')}</button>
    </header>
    <div class="sel-exp-corpo" id="lexa-balao-corpo"></div>`
  p.addEventListener('mousedown', e => e.stopPropagation())
  document.body.appendChild(p)
  // A RESPOSTA CHEGA EM PARTES — spinner, figura, texto, chips, conversa — e a
  // cada parte o balão muda de tamanho. Sem reposicionar, ele cresceria para
  // fora da tela ou taparia a frase. O observador faz isso sozinho, em vez de
  // exigir uma chamada de ajuste em cada um dos cinco chamadores (e de cada
  // ponto de pintura dentro deles — foi assim que a explicação já saiu pela
  // metade uma vez).
  // ⚠️ Só recoloca quando ele SAIRIA da tela. Recolocar a cada mudança faria o
  // balão pular a cada mensagem da conversa, justamente enquanto ele lê ou
  // digita — e o texto escorregando debaixo dos olhos é pior do que a
  // imperfeição de posição que isso corrige.
  const corpo = p.querySelector('.sel-exp-corpo')
  try {
    const mo = new MutationObserver(() => {
      const b = p.getBoundingClientRect()
      if (b.bottom > innerHeight - 4 || b.top < 4 || b.right > innerWidth - 4) _selMenuPor(p, r)
    })
    mo.observe(p, { childList: true, subtree: true, characterData: true })
    p._mo = mo
  } catch (e) {}
  _selMenuPor(p, r)
  return corpo
}

// "Ainda é este balão?" — o guarda de sempre contra a resposta lenta pintando
// por cima de uma pergunta nova (ou de um balão já fechado).
function lexaBalaoVivo(corpo) {
  return !!corpo && document.getElementById('lexa-balao-corpo') === corpo
}

// ================================================================
// SELECIONAR DENTRO DO ESTUDO — Explicar / Preparar em qualquer texto
// ================================================================
// A família ganhou um botão por linha, e ele corrigiu o alvo: *"um clique é
// modo de falar, deve aceitar o selecionar, que é mais abrangente"*. E é
// mesmo: o botão só serve as linhas que EU previ. A dúvida real cai em
// qualquer lugar — uma palavra dentro de um exemplo, um pedaço da definição,
// duas palavras no meio da passagem do livro. Selecionar cobre tudo isso sem
// eu ter de adivinhar onde.
//
// Peça ÚNICA e genérica: qualquer contêiner liga o menu passando um jeito de
// descrever o que está em volta. O leitor e o Preparar já têm os popups deles,
// nascidos antes e presos às telas; este é o que serve daqui para frente.
let _selMenuCtx = null

function _selMenuFechar() {
  const p = document.getElementById('sel-menu')
  // O observador de tamanho morre junto: deixá-lo vivo é criar vigia órfão a
  // cada explicação fechada.
  if (p) { if (p._mo) { try { p._mo.disconnect() } catch (e) {} } p.remove() }
  _selMenuCtx = null
}

// Onde o balão se ancora. Fica guardado porque a resposta nasce DENTRO dele:
// quando o texto chega o balão cresce, e sem o retângulo da seleção não haveria
// como recolocá-lo sem tapar justamente o que ele acabou de selecionar.
function _selMenuPor(p, r) {
  if (!p || !r) return
  const larg = p.offsetWidth, alt = p.offsetHeight
  p.style.left = Math.round(Math.max(8, Math.min(r.left + r.width / 2 - larg / 2, innerWidth - larg - 8))) + 'px'
  // O MENU prefere ficar ACIMA, para não tapar o que ele acabou de selecionar.
  // O BALÃO prefere ABAIXO: ele nasce vazio e CRESCE conforme a resposta chega,
  // e crescer para baixo a partir de um topo fixo é o único jeito de o texto
  // não escorregar debaixo dos olhos enquanto está sendo lido.
  const balao = p.classList.contains('sel-exp')
  const abaixo = r.bottom + 8, acima = r.top - alt - 8
  let topo
  if (balao) topo = (abaixo + alt <= innerHeight - 8) ? abaixo : (acima > 8 ? acima : innerHeight - alt - 8)
  else       topo = acima > 8 ? acima : Math.min(abaixo, innerHeight - alt - 8)
  p.style.top = Math.round(Math.max(8, topo)) + 'px'
}

// `obterContexto(no)` devolve { frase, lang, origem } — e recebe o NÓ onde a
// seleção caiu.
// ⚠️ O `no` não é enfeite, é o conserto de um defeito real: sem ele o dono do
// menu só sabia dizer o que estava "em foco" na tela, e respondia sempre a
// mesma coisa. Selecionando "cramped" dentro do exemplo #2, o balão abria com a
// passagem do livro do OUTRO item e a Lexa respondia "cramped não aparece nessa
// frase". Pior: mandado ao Preparar, o item nascia com a fonte do livro — uma
// palavra que ele nunca leu lá. Fonte de avô virando fonte de neto.
function selMenuAtivar(container, obterContexto) {
  if (!container || container._selMenu) return
  container._selMenu = true
  container.addEventListener('mouseup', ev => {
    // Clique num botão não é seleção: sem isto, soltar o mouse em cima de
    // "Preparar" abriria o menu por cima do próprio botão.
    if (ev.target.closest('button, a, input, textarea')) return
    setTimeout(() => {
      const sel = window.getSelection()
      const txt = String(sel || '').replace(/\s+/g, ' ').trim()
      _selMenuFechar()
      if (!txt || txt.length < 2 || txt.length > 120) return
      if (!sel.rangeCount) return
      const rng = sel.getRangeAt(0)
      const r = rng.getBoundingClientRect()
      if (!r.width && !r.height) return
      const ctx = (typeof obterContexto === 'function' ? obterContexto(rng.commonAncestorContainer) : null) || {}
      // O retângulo é copiado: o vivo morre junto com a seleção, e a seleção é
      // desfeita no instante em que ele clica "Explicar".
      _selMenuCtx = { txt, rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width }, ...ctx }
      const p = document.createElement('div')
      p.id = 'sel-menu'
      p.innerHTML = `
        <b>"${esc(txt.length > 28 ? txt.slice(0, 28) + '…' : txt)}"</b>
        ${ctx.traduzir ? `<span class="sel-trad" id="sel-trad"><i class="sel-trad-esperando">traduzindo…</i></span>` : ''}
        <button onclick="selMenuExplicar()">${ic('sparkles','ic-sm')} Explicar</button>
        <button onclick="selMenuPreparar()">${ic('plus','ic-sm')} Preparar</button>`
      // `mousedown` no menu não pode desfazer a seleção nem borbulhar para o
      // fundo dos painéis, que fecham ao clique de fora. Depois que a resposta
      // entra, porém, o balão vira TEXTO — e texto tem de poder ser selecionado,
      // então o `preventDefault` sai de cena.
      p.addEventListener('mousedown', e => {
        e.stopPropagation()
        if (!p.classList.contains('sel-exp')) e.preventDefault()
      })
      document.body.appendChild(p)
      _selMenuPor(p, r)
      // A tradução começa DEPOIS que o menu está na tela: ele vê o balão na
      // hora e o português chega dentro dele, sem espera de tela em branco.
      if (ctx.traduzir) _selMenuTraduzir(p, _selMenuCtx)
    }, 10)   // depois do navegador fechar a seleção do clique simples
  })
  container.addEventListener('mousedown', ev => {
    if (!ev.target.closest('#sel-menu')) _selMenuFechar()
  })
}

// ---- TRADUÇÃO AO ARRASTAR (o gesto do livro, agora compartilhado) ----
// ⚠️ ELE FOI EXPLÍCITO depois de eu errar o alvo: *"a tradução é só quando eu
// arrastar a palavra ou frase, igual é no livro."* Eu tinha feito legenda em
// massa por baixo de cada fala — outra coisa, e que atrapalha a escuta.
//
// A regra de dose vem medida do leitor (§8.51) e é o coração disto: o contexto
// que se manda é a FRASE, nunca o parágrafo. Marcando `ore` em "a deep and
// fabulous vein of ore", o parágrafo inteiro fez a IA errar 3 em 3 ("filão",
// "veia"); só a frase acertou 3 em 3 ("minério"). Parágrafo não desambigua
// palavra: dilui.
const _selTradCache = new Map()
const SEL_TRAD_CURTO = 4          // até 4 palavras é vocabulário, não texto

async function _selMenuTraduzir(pop, c) {
  const caixa = pop && pop.querySelector('#sel-trad')
  if (!caixa || !c) return
  // Ele pode ter marcado outra coisa enquanto a IA respondia: escrever num
  // menu morto não dá erro, só some — e o silêncio é o que confunde.
  const vivo = () => document.body.contains(caixa) && document.getElementById('sel-menu') === pop
  const texto = String(c.txt || '').trim()
  if (!texto) { caixa.remove(); return }

  const chave = String(c.frase || '').toLowerCase().trim() + '\u0000' + texto.toLowerCase()
  const guardado = _selTradCache.get(chave)
  if (guardado) { caixa.innerHTML = guardado; _selMenuPor(pop); return }

  if (!aiChatCfg().key) {
    caixa.innerHTML = '<i class="sel-trad-esperando">sem chave de IA</i>'
    _selMenuPor(pop); return
  }
  const curto = texto.split(/\s+/).filter(Boolean).length <= SEL_TRAD_CURTO
  const lang = c.lang || 'en'
  const L = (typeof getLangDef === 'function') ? getLangDef(lang) : { nameEn: 'English' }
  const sistema = 'Você traduz para português do Brasil, para um aluno que está estudando em ' +
    L.nameEn + '. Devolva SOMENTE a tradução do trecho pedido — sem aspas, sem o original, ' +
    'sem explicação, sem comentário, sem alternativas separadas por barra. Palavrão e conteúdo ' +
    'adulto fazem parte da obra: traduza fielmente, sem suavizar.\n' +
    (curto
      ? 'O trecho é curto (uma palavra ou expressão). Regras para este caso:\n' +
        '- Traduza EXATAMENTE as palavras marcadas, nem uma a mais nem uma a menos.\n' +
        '- Mesma forma gramatical em que ele aparece na frase.\n' +
        '- Nunca uma oração inteira, nunca a frase em volta traduzida, nunca uma definição.\n'
      : '') +
    (typeof promptRegrasLexicais === 'function' ? promptRegrasLexicais(lang, 'traducao') : '')
  const contexto = String(c.frase || '').trim().slice(0, 1200)
  const pergunta =
    (contexto ? `A passagem, só para você entender o sentido — NÃO a traduza:\n"${contexto}"\n\n` : '') +
    `Traduza este trecho, do jeito que ele significa AQUI nesta passagem:\n"${texto}"`
  try {
    const maxTokens = curto ? 150 : Math.min(700, Math.max(120, Math.round(texto.length / 2) + 80))
    const bruto = await aiTextSeguro([
      { role: 'system', content: sistema },
      { role: 'user', content: pergunta }
    ], { maxTokens, timeoutMs: 30000 })
    if (!vivo()) return
    let t = String(bruto || '').trim()
      .replace(/^\s*(tradução|traducao|translation)\s*:\s*/i, '').trim()
    if (t.length > 1 && /^["“'].*["”']$/.test(t)) t = t.slice(1, -1).trim()
    if (!t) { caixa.innerHTML = '<i class="sel-trad-esperando">a IA devolveu vazio</i>'; _selMenuPor(pop); return }
    const html = esc(t)
    _selTradCache.set(chave, html)
    if (_selTradCache.size > 300) _selTradCache.delete(_selTradCache.keys().next().value)
    caixa.innerHTML = html
    _selMenuPor(pop)
  } catch (e) {
    if (!vivo()) return
    caixa.innerHTML = `<i class="sel-trad-esperando">${esc((e.message || 'não deu').slice(0, 60))}</i>`
    _selMenuPor(pop)
  }
}

function selMenuPreparar() {
  const c = _selMenuCtx; if (!c) return
  _selMenuFechar()
  try { window.getSelection().removeAllRanges() } catch (e) {}
  if (typeof lexaChipParaPreparar !== 'function') return
  lexaChipParaPreparar({ expr: c.txt, gloss: '', type: 'word' },
    { contexto: c.frase || '', lang: c.lang || 'en', ...(c.origem || {}) })
  if (typeof _dosFocoPintar === 'function') { try { _dosFocoPintar() } catch (e) {} }
}

// Selecionar e perguntar é gesto de PASSAGEM: ele está lendo um exemplo, tropeça
// numa palavra, quer saber e voltar para onde estava. O painel inteiro cobre a
// página e tira da vista exatamente a frase que motivou a pergunta — "não ficou
// no modo suspenso, que é o que eu queria nesse caso, igual acontece quando
// marco uma palavra no livro".
// Então a resposta nasce no balão, em cima do texto, com a frase à vista — e
// leva junto tudo o que o painel levava: os chips das unidades e a conversa.
async function selMenuExplicar() {
  const c = _selMenuCtx; if (!c) return
  try { window.getSelection().removeAllRanges() } catch (e) {}
  if (!aiChatCfg().key) {
    _selMenuFechar()
    toast(`Configure a chave da ${aiChatCfg().P.nome} em Configurações → IA`, 'error'); return
  }
  const L = getLangDef(c.lang || 'en')
  const corpo = lexaBalaoAbrir({
    titulo: `"${c.txt}"`, fonte: c.fonte || '', alvo: c.rect,
    // ⚠️ COM NOME, E NÃO SÓ UM "+". Ele disse "falta adicionar a opção de mandar
    // pro Preparar dentro do Explicar" — e ela existia: era este botão, mudo,
    // no canto do cabeçalho. Opção que ninguém encontra é opção que não existe.
    acoes: `<button class="sel-exp-btn sel-exp-prep" onclick="selMenuPreparar()"
              data-tip="Mandar para o Preparar">${ic('plus','ic-sm')}<span>Preparar</span></button>`
  })
  // `lexaBalaoAbrir` zera o contexto (fecha o menu antes de abrir o balão), e o
  // botão "Preparar" do cabeçalho precisa dele de volta.
  _selMenuCtx = c
  // A web entra sozinha quando o termo cheira a mundo real; fora disso, fica a
  // um botão de distância. Ver `AI_WEB_PEDAGIO`: o custo de tê-la à mão é fixo
  // e alto, então quem decide primeiro é o filtro de graça.
  await _selExplicarPintar(corpo, c, false)
}

// As FONTES são metade do ganho da web: o que ela traz de novo não é saber
// mais — o modelo já sabia sobre a revista do Archie —, é poder CONFERIR.
function lexaFontesHTML(fontes) {
  if (!fontes || !fontes.length) return ''
  const dominio = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }
  return `<div class="lexa-fontes"><b>${ic('globe','ic-sm')} buscou na internet</b>${
    fontes.slice(0, 5).map(f =>
      `<a href="${escA(f.url)}" target="_blank" rel="noopener noreferrer" data-tip="${escA(f.titulo || f.url)}">${esc(dominio(f.url))}</a>`
    ).join('')}</div>`
}

// ⚠️ A WEB TEM DE VALER NOS QUATRO CAMINHOS DE EXPLICAÇÃO, e a primeira versão
// valia em UM: o menu de seleção. O leitor, o Preparar e o vídeo têm cada um o
// seu `aiTextSeguro`, e ficaram de fora — justamente o leitor, que é onde ele
// mais lê. Ele testou no livro e viu "mesma coisa", com razão.
// A lição é a de sempre neste projeto: quando quatro telas fazem a mesma coisa,
// a peça é UMA e elas a chamam. Foi assim com o balão, foi assim com os chips.

// A explicação, decidindo sozinha se vai à web. Devolve o que os quatro
// caminhos precisam para pintar.
async function lexaExplicarTexto({ sistema, pergunta, termo, frase, forcarWeb, maxTokens = 600 }) {
  // SÓ QUANDO ELE PEDE. Não há mais filtro nem modo: o clique é a decisão.
  const comWeb = !!forcarWeb
  if (comWeb) {
    try {
      // ⚠️ OUTRA TAREFA, OUTRO PROMPT E OUTRO TETO. Reaproveitar o prompt curto
      // era garantir que a busca voltasse com a mesma resposta de antes: ele
      // manda escrever 2 a 4 frases, e o motivo de ir à rede é justamente o
      // que não cabe em quatro frases. O teto sobe junto, senão a instrução
      // pede 12 linhas e o orçamento corta na quinta.
      const r = await aiTextWeb({
        sistema: (typeof lexaExplicarWeb === 'function') ? lexaExplicarWeb() : sistema,
        pergunta: `${frase ? `Contexto em que ele encontrou: "${frase}".\n` : ''}O termo é: "${termo}".
Procure e responda como manda a tarefa: o que é no mundo real, os fatos que só a busca traz, e sobretudo o que um leitor nativo entende ao ver isso aqui.`,
        maxTokens: Math.max(maxTokens, 1100)
      })
      if (r.texto) return { texto: r.texto, fontes: r.buscou ? r.fontes : [], buscou: r.buscou }
    } catch (e) {
      // A web falhando NÃO pode calar a explicação: cai para o caminho de
      // sempre. Ele veio perguntar o que a palavra significa, não testar a rede.
      console.warn('[lexa] a busca na web falhou, seguindo sem ela:', e.message)
    }
  }
  const t = await aiTextSeguro([
    { role: 'system', content: sistema },
    { role: 'user', content: pergunta }
  ], { maxTokens })
  return { texto: t, fontes: [], buscou: false }
}

// O rodapé da web: o selo (quando buscou), o botão (quando não buscou) e a
// escolha de quando buscar sozinha. `refazer` é o que o botão chama para
// repetir a MESMA explicação com a busca forçada.
function lexaWebRodape(corpo, { buscou, fontes, refazer }) {
  if (!corpo) return
  if (buscou) corpo.insertAdjacentHTML('beforeend', lexaFontesHTML(fontes))
  if (!aiWebPodeUsar() || buscou || typeof refazer !== 'function') return
  // O PREÇO NO PRÓPRIO BOTÃO. Ele decide o gasto a cada clique, então o gasto
  // tem de estar onde a mão dele está — não numa tela de ajustes que ele
  // visitaria uma vez e esqueceria. É a mesma razão de a busca ter deixado de
  // ser automática: quem paga escolhe, e para escolher precisa ver.
  const b = document.createElement('button')
  b.className = 'lexa-web-btn'
  b.innerHTML = `${ic('globe','ic-sm')} procurar na internet <i>~R$ ${lexaWebCustoBrl().toFixed(3)}</i>`
  b.setAttribute('data-tip', 'A Lexa vai à web e volta com as fontes. Só acontece quando você clica.')
  b.onclick = refazer
  corpo.appendChild(b)
}

async function _selExplicarPintar(corpo, c, forcarWeb) {
  if (!lexaBalaoVivo(corpo)) return
  corpo.innerHTML = `<span class="gen-spinner"></span> ${esc(lexaNome())} está ${forcarWeb ? 'procurando na internet' : 'explicando'}…`
  const L = getLangDef(c.lang || 'en')
  const sistema = lexaExplicar()
  const pergunta = `${c.frase ? `A frase é: "${c.frase}".
` : ''}O aluno selecionou: "${c.txt}".
Explique o que "${c.txt}" significa AQUI, em ${L.nameEn}. Se for gíria, marca, referência cultural ou nome próprio, diga o que é no mundo real.`
  let r
  try {
    r = await lexaExplicarTexto({ sistema, pergunta, termo: c.txt, frase: c.frase, forcarWeb, maxTokens: 600 })
  } catch (e) {
    if (lexaBalaoVivo(corpo)) corpo.innerHTML = `<span style="color:var(--error)">Não deu: ${esc(e.message)}</span>`
    return
  }
  if (!lexaBalaoVivo(corpo)) return
  corpo.innerHTML = lexaFormatar(r.texto)
  // O CONVITE VEM DEPOIS DA EXPLICAÇÃO, porque é ali que ele decide: primeiro
  // entende o que a palavra quer dizer, e só então resolve se quer estudá-la.
  // O botão do cabeçalho continua, para quem já decidiu antes de ler.
  const pe = document.createElement('div')
  pe.className = 'sel-exp-acoes'
  pe.innerHTML = `<button class="btn btn-primary btn-sm" onclick="selMenuPreparar()">
    ${ic('plus','ic-sm')} Mandar para o Preparar</button>`
  corpo.appendChild(pe)
  lexaWebRodape(corpo, { ...r, refazer: () => _selExplicarPintar(corpo, c, true) })
  if (typeof lexaChipsMontar === 'function' && c.frase) {
    lexaChipsMontar(corpo, { trecho: c.txt, contexto: c.frase, lang: c.lang || 'en',
      fonte: c.fonte || '', origem: c.origem || {} })
  }
  if (typeof lexaChatMontar === 'function') {
    lexaChatMontar(corpo, { sistema, primeira: pergunta, resposta: r.texto })
  }
}

// O botão: quando a resposta veio vaga, ele força a busca. É a válvula que
// deixa o filtro automático poder ser conservador sem custar informação.

// ================================================================
// O QUE TEM NESTA FRASE — os chips das unidades
// ================================================================
// Pedido do Djemeson, e o motivo dele é o desenho inteiro: *"quando eu não
// entendo uma frase, pode se dar por ter elementos que não entendo ou que
// tenham significado diferente do que sei"*. A explicação da Lexa resolve a
// frase; ela não diz DE QUE a frase é feita. Um phrasal verb que você lê como
// duas palavras soltas, uma colocação que parece livre, um idiom tomado ao pé
// da letra — nada disso aparece numa explicação corrida, e é justamente o que
// derruba a leitura.
//
// Então: toda explicação passa a listar as unidades da frase — palavras,
// phrasal verbs, idioms, colocações e blocos fixos —, cada uma com o que
// significa ALI. Clicar manda para o Preparar.
//
// A quebra usa `quebrarTrecho`, a MESMA peça do raio-X: dez armadilhas já
// pagas (o "the mud" que virava colocação, a tradução literal, o trecho
// inteiro voltando como unidade) que não precisam ser reaprendidas aqui.
const _LEXA_CHIP_CATS = {
  phrasal_verb: 'phrasal verb', idiom: 'idiom', collocation: 'colocação',
  chunk: 'bloco fixo', word: ''
}
// Sem cache PRÓPRIO aqui: quem guarda a quebra é `quebrarTrecho`, que é quem
// paga por ela. Cache em quem consome deixaria o raio-X do Preparar de fora e
// seriam duas cópias da mesma coisa — a receita conhecida de divergir.
// Chamar de novo a mesma frase, mesmo depois de recarregar a página, custa
// zero: `quebrarTrecho` responde da memória ou do IndexedDB.

// "JÁ É SEU" — e o acervo dele é maior que a lista de itens.
// A marcação saía só de `prepAcharItem`, que olha `words`. Só que ele disse
// *"os chips pal e gal já existem nos CARDS"* — e o card é o que sobrevive a
// um item apagado: a palavra sai de `words`, o card continua na revisão, e o
// chip volta a se oferecer como novidade. Do ponto de vista dele, ter o card
// É ter a palavra — e é o ponto de vista dele que manda aqui.
// A comparação passa pelos mesmos lemas do achador de itens, nos dois lados,
// porque o card guarda a forma como a palavra foi capturada ("Pals").
function lexaJaEhSeu(expr, lang) {
  const termo = String(expr || '').trim()
  if (!termo) return false
  if (typeof prepAcharItem === 'function' && prepAcharItem(termo, lang)) return true
  if (typeof srsCards === 'undefined' || !Array.isArray(srsCards)) return false
  const norm = s => (typeof knownNorm === 'function' ? knownNorm(s) : String(s || '').toLowerCase().trim())
  const formas = new Set([norm(termo)])
  if (typeof glossLemas === 'function') {
    for (const l of glossLemas(termo, { estrito: true })) formas.add(norm(l))
  }
  return srsCards.some(c => {
    if (!c || (lang && c.lang && c.lang !== lang)) return false
    const p = norm(c.word || '')
    if (!p) return false
    if (formas.has(p)) return true
    if (typeof glossLemas !== 'function') return false
    return glossLemas(c.word, { estrito: true }).some(x => formas.has(norm(x)))
  })
}

function lexaChipsHTML(items, jaTenho) {
  if (!items || !items.length) return ''
  return `
    <div class="lexa-chips">
      <div class="lexa-chips-cab">${ic('layers','ic-sm')} o que tem no que você marcou
        <span>clique para mandar ao Preparar</span></div>
      <div class="lexa-chips-lista">${items.map((it, i) => {
        const cat = _LEXA_CHIP_CATS[it.type] || ''
        const meu = jaTenho.has(i)
        return `<button class="lexa-chip${meu ? ' meu' : ''}" data-i="${i}" ${meu ? 'disabled' : ''}
          data-tip="${escA(it.gloss || '')}${it.nivel ? ' · ' + escA(it.nivel) : ''}">
          <b>${esc(it.expr)}</b>${cat ? `<i>${esc(cat)}</i>` : ''}
          ${it.gloss ? `<span>${esc(it.gloss)}</span>` : ''}
          ${meu ? ic('check','ic-sm') : ''}
        </button>`
      }).join('')}</div>
    </div>`
}

// `origem` leva o que o item precisa para nascer inteiro no Preparar: a frase
// de onde veio, a obra e o idioma. Sem isso o chip viraria item órfão, sem
// cena e sem dossiê — o mesmo furo do Assistente antes de ter origem.
// ⚠️ `trecho` É O QUE ELE MARCOU. `contexto` é a frase em volta, e serve só
// para a IA desambiguar — nunca para virar chip.
// Isto já foi ao contrário, e ele pegou: marcou *"looks lower middle-class to
// Billy"* e os chips vieram com "two miles", "downtown", "enter",
// "neighborhood" — palavras da frase que ele NÃO marcou. *"Olha o que eu
// selecionei e olha o que aparece de chips."* A quebra tem de respeitar a
// fronteira da seleção: o que ele marcou é o pedido dele, e o resto da frase é
// cenário.
async function lexaChipsMontar(caixa, { trecho, contexto, lang, fonte, origem }) {
  if (!caixa || !trecho) return
  // UM PEDAÇO SÓ NÃO SE QUEBRA. Marcando uma palavra, o único chip possível é
  // ela mesma — e a explicação inteira já é sobre ela. Sair aqui poupa uma
  // chamada de IA e uma lista com um item redundante.
  if (!/\s/.test(String(trecho).trim())) return
  const slot = document.createElement('div')
  slot.className = 'lexa-chips-slot'
  caixa.appendChild(slot)
  slot.innerHTML = `<div class="lexa-chips-carregando"><span class="spinner"></span> vendo o que tem aqui dentro…</div>`
  let items
  try {
    const r = await quebrarTrecho({ trecho, contexto: contexto || '', lang: lang || 'en', fonte: fonte || '' })
    items = r.items || []
  } catch (e) {
    // Falhar aqui NÃO pode estragar a explicação, que é o que ele pediu e já
    // está na tela. Some em silêncio — o console guarda o motivo.
    console.warn('[lexa] quebra da frase falhou:', e.message)
    slot.remove(); return
  }
  if (!items.length) { slot.remove(); return }
  const jaTenho = new Set()
  items.forEach((it, i) => { if (lexaJaEhSeu(it.expr, lang || 'en')) jaTenho.add(i) })
  slot.innerHTML = lexaChipsHTML(items, jaTenho)
  // Delegação num pai só: os chips são repintados a cada clique, e um ouvinte
  // por botão viraria ouvinte órfão a cada repintura.
  slot.addEventListener('click', ev => {
    const btn = ev.target.closest('.lexa-chip'); if (!btn || btn.disabled) return
    ev.stopPropagation(); ev.preventDefault()
    const i = +btn.dataset.i
    const it = items[i]; if (!it) return
    if (lexaChipParaPreparar(it, { contexto: contexto || trecho, lang, ...(origem || {}) })) {
      jaTenho.add(i)
      slot.innerHTML = lexaChipsHTML(items, jaTenho)
    }
  })
  // Os popups que hospedam isto fecham ao clique de fora — o mesmo cuidado do
  // chat vale aqui, senão clicar num chip fecharia a explicação.
  slot.addEventListener('mousedown', e => e.stopPropagation())
}

function lexaChipParaPreparar(item, origem) {
  const termo = String(item.expr || '').trim()
  if (!termo) return false
  if (typeof prepAcharItem === 'function' && prepAcharItem(termo, origem.lang || 'en')) {
    toast(`"${termo}" já é seu`, 'info'); return true
  }
  const w = createWord({
    word: termo,
    context: String(origem.contexto || '').slice(0, 400),
    source_type: origem.source_type || 'manual',
    source_title: origem.source_title || '',
    source_context: origem.source_context || '',
    lang: origem.lang || 'en'
  })
  // A glosa desta passagem vira SEMENTE: a análise nasce sabendo qual sentido
  // procurar, em vez de redescobri-lo com menos contexto do que quem o achou.
  if (item.gloss) w._seedMeaning = item.gloss
  // O tipo vem junto: sem ele "get you in" nasceria como palavra e o lema o
  // poria debaixo do teto errado até a análise corrigir.
  if (item.type && item.type !== 'word') w.type = item.type === 'chunk' ? 'collocation' : item.type
  saveWords()
  if (typeof autoSyncAfterChange === 'function') autoSyncAfterChange()
  if (typeof renderSidebar === 'function') { try { renderSidebar() } catch (e) {} }
  if (typeof renderDashboard === 'function') { try { renderDashboard() } catch (e) {} }
  toast(`"${termo}" foi para o Preparar`, 'success')
  return true
}

// `contexto` descreve o que a conversa já sabe: {sistema, primeira, resposta}.
function lexaChatMontar(caixa, contexto) {
  if (!caixa) return
  caixa.insertAdjacentHTML('beforeend', lexaChatHTML())
  const chat = caixa.querySelector('.lexa-chat')
  const msgs = chat.querySelector('.lexa-chat-msgs')
  const form = chat.querySelector('.lexa-chat-form')
  const inp = chat.querySelector('.lexa-chat-inp')
  // A conversa nasce com a explicação já dada: sem isto a segunda pergunta
  // chegaria à IA sem o livro, sem a frase e sem o que ela mesma respondeu —
  // e ele teria de recontar tudo, que é justamente o atrito que isto remove.
  chat._lexaMsgs = [
    { role: 'system', content: contexto.sistema },
    { role: 'user', content: contexto.primeira },
    { role: 'assistant', content: contexto.resposta }
  ]
  // O clique dentro do chat não pode borbulhar: os popups que o hospedam
  // fecham ao clique de fora, e digitar fecharia a própria conversa. No leitor
  // isso também impede o `preventDefault` do popup, que existe para não
  // colapsar a seleção — e que impediria o campo de receber foco.
  chat.addEventListener('mousedown', e => e.stopPropagation())
  chat.addEventListener('click', e => e.stopPropagation())
  // Gancho para a tela se proteger enquanto ele digita. O leitor precisa dele:
  // clicar no campo desfaz a seleção de texto, e o vigia de seleção fecharia o
  // popup 350ms depois, no meio da pergunta. O componente não sabe disso — só
  // avisa que entrou e saiu do campo.
  if (typeof contexto.aoFoco === 'function') {
    inp.addEventListener('focus', () => contexto.aoFoco(true))
    inp.addEventListener('blur', () => contexto.aoFoco(false))
  }

  form.onsubmit = async e => {
    e.preventDefault(); e.stopPropagation()
    const q = String(inp.value || '').trim()
    if (!q || chat._ocupado) return
    chat._ocupado = true
    inp.value = ''
    msgs.insertAdjacentHTML('beforeend',
      `<div class="lexa-msg eu">${esc(q)}</div><div class="lexa-msg ela pensando"><span class="spinner"></span></div>`)
    msgs.scrollTop = msgs.scrollHeight
    const pendente = msgs.lastElementChild
    chat._lexaMsgs.push({ role: 'user', content: q })
    try {
      const t = await aiTextSeguro(chat._lexaMsgs, { maxTokens: 600 })
      chat._lexaMsgs.push({ role: 'assistant', content: t })
      pendente.classList.remove('pensando')
      pendente.innerHTML = lexaFormatar(t)
    } catch (err) {
      pendente.classList.remove('pensando')
      pendente.classList.add('erro')
      pendente.textContent = 'Não deu: ' + (err.message || 'erro')
      // Pergunta que não foi respondida sai do histórico: senão a próxima
      // chamada mandaria duas perguntas seguidas do aluno e a IA responderia
      // só a última, deixando a primeira sem resposta para sempre.
      chat._lexaMsgs.pop()
    }
    chat._ocupado = false
    msgs.scrollTop = msgs.scrollHeight
    inp.focus()
  }
}

// ================================================================
// "O QUE É AQUI?" — a checagem sob demanda, no CLIQUE
// ================================================================
// O buraco que isto fecha: `knownWords` guarda PALAVRA, não sentido. Marcar
// "cover" como conhecida tira a palavra da triagem, da cobertura e da
// pré-análise — para sempre e em todo livro. Aí, quando ela reaparece como
// "cobrir o turno de alguém", o balão diz "você marcou como conhecida", que é
// o app informando que você sabe uma coisa que não sabe. A detecção de
// reencontro não salva: ela compara a glosa da pré-análise com os sentidos que
// você tem, e para palavra conhecida não existe glosa nenhuma.
//
// Por que NO CLIQUE e nunca no hover: o hover tem orçamento de ~50 ms (foi por
// isso que o Wiktionary, de 772 a 1234 ms, foi recusado). Uma chamada de IA
// jamais cabe ali. No clique cabe — e só acontece quando você desconfia, que é
// a única hora em que vale pagar.
//
// A UNIDADE É O QUE IMPORTA. Perguntar "o que 'cover' significa aqui" e
// responder pela palavra solta seria repetir o erro do "tire of" partido em
// pneu + cansar. A resposta tem de vir na UNIDADE DE ESTUDO real da passagem:
// se for phrasal verb, idiom ou colocação, é ela que volta — em forma de
// citação (`cover for`, nunca `covered for`), pronta para virar item.
const _checkCache = new Map()

// `jaTem` = os sentidos que o item já tem, com id. Sem isso a checagem ficava
// FORA da conversa: perguntava do zero e podia responder "mina" para um item
// cujo sentido do contexto o app já tinha decidido ser "explorar" — duas telas
// do mesmo app dando respostas diferentes para a mesma palavra.
// `trecho` = o parágrafo em volta. A frase sozinha não resolve pronome, e
// pronome sem antecedente é o que fez "shakes it" virar "dançar".
async function aiChecarAqui(alvo, frase, lang, jaTem, trecho) {
  const termo = String(alvo || '').trim()
  const ctx = String(frase || '').replace(/\s+/g, ' ').trim()
  const volta = String(trecho || '').replace(/\s+/g, ' ').trim()
  if (!termo) throw new Error('sem termo')
  // SEM A FRASE NÃO HÁ O QUE CHECAR. Responder assim mesmo seria devolver o
  // sentido mais comum do dicionário — exatamente o "dicionário cego ao
  // contexto" que este projeto proíbe, e a origem do "barrel"→barril.
  if (!ctx) throw new Error('não achei a frase em volta — selecione o trecho e use Explicar')
  const lista = Array.isArray(jaTem) ? jaTem.filter(m => m && m.id && m.meaning_pt) : []
  const chave = (lang || 'en') + '|' + termo.toLowerCase() + '|' + ctx.toLowerCase() +
                '|' + lista.map(m => m.id).join(',')
  if (_checkCache.has(chave)) return _checkCache.get(chave)

  const L = (typeof getLangDef === 'function') ? getLangDef(lang || 'en') : { nameEn: 'English' }
  const PROMPT = `In the passage below, decide what the learner should actually study around "${termo}".
${volta && volta.length > ctx.length ? `
Surrounding text (use it to resolve pronouns and references — "it/this/that/them" answers to what came BEFORE):
"${volta}"
` : ''}
Passage: "${ctx || termo}"
Target word: "${termo}"

STEP 1 — FIND THE UNIT. Look at what "${termo}" is doing in this passage. It may be:
- part of a PHRASAL VERB ("cover for him", "get up his quills") — the unit is the verb + particle(s)
- part of an IDIOM ("under the weather", "fall by the wayside") — the unit is the whole idiom
- part of a fixed COLLOCATION ("take a ride", "make a decision") — the unit is the collocation
- or just the word by itself.
Always prefer the LARGEST unit that is genuinely fixed. "look forward to" beats "look forward", which beats "look".
Return the unit in CITATION form: bare verb, no inflection ("cover for", never "covered for"; "fall by the wayside", never "fell by the wayside"). Keep the learner's word inside it.

STEP 2 — SAY WHAT IT MEANS HERE. The sense IN THIS PASSAGE, in Brazilian Portuguese, max 6 words. Decide WHAT the thing IS in this scene and use the Portuguese word for THAT — "barrel" of a rifle is "cano", never "barril". Never a dictionary list, never two domains hedged together.

${lista.length ? `
STEP 3 — IS IT ONE THE LEARNER ALREADY HAS? These are the senses already recorded for this item:
${lista.map(m => `- id "${m.id}": ${m.meaning_pt}${m.definition_pt ? ` (${m.definition_pt})` : ''}`).join('\n')}
If the sense in THIS passage is one of them, set "same_as" to that id and REUSE ITS WORDING in "gloss" — the learner must not read two different answers for the same sense in two screens of the same app. Only set "same_as": null when the passage really uses a sense that is not in the list.
Judge by the SENSE, not by the wording.` : ''}

Return ONLY this JSON:
{"expr":"the study unit in citation form","tipo":"word|phrasal_verb|idiom|collocation","gloss":"o sentido nesta passagem, português do Brasil, máx 6 palavras","nivel":"A1|A2|B1|B2|C1|C2","mesma":true,"same_as":null}
"mesma": true when the unit is just the word itself, false when it is a larger expression.`

  const r = await aiJSON([
    { role: 'system', content: `You analyze ${L.nameEn} for a Brazilian Portuguese-speaking learner. Return only valid JSON.` },
    { role: 'user', content: PROMPT }
  ], { maxTokens: 300 })

  const expr = String(r && r.expr || termo).replace(/\s+/g, ' ').trim() || termo
  // COESÃO: quando a IA diz que é um sentido que ele já tem, quem manda é o
  // texto GRAVADO, não a redação nova. Duas telas do mesmo app não podem dar
  // duas respostas para a mesma coisa — foi assim que o Preparar dizia
  // "explorar" e a checagem respondia "mina".
  const casou = (r && r.same_as) ? lista.find(m => m.id === r.same_as) : null
  const out = {
    expr,
    tipo: ['word', 'phrasal_verb', 'idiom', 'collocation'].includes(r && r.tipo) ? r.tipo : 'word',
    gloss: casou ? String(casou.meaning_pt).trim() : String(r && r.gloss || '').trim(),
    nivel: String(r && r.nivel || '').trim().toUpperCase(),
    // Não confia no booleano do modelo: compara os textos. Sem contrato de
    // forma (fornecedor sem `json_schema`), booleano volta como "true"/"sim"/1
    // conforme o humor do modelo.
    mesma: expr.toLowerCase() === termo.toLowerCase(),
    jaEra: casou ? casou.id : null,
    def: casou ? String(casou.definition_pt || '').trim() : ''
  }
  if (!out.gloss) throw new Error('resposta sem significado')
  _checkCache.set(chave, out)
  return out
}

// ================================================================
// ILUSTRAÇÃO DA WIKIPÉDIA — a foto que acompanha a explicação
// ================================================================
// De graça, sem chave e sem CORS: a API da Wikipédia responde a qualquer
// origem com `origin=*`. Uma chamada devolve título, miniatura e resumo.
//
// A parte que importa é o PORTÃO. A busca "fuzzy" (generator=search) parece
// ótima e é uma armadilha: "seethed" devolve a banda Seether — com foto — e
// "grand experience" devolve Grand Theft Auto V. Uma imagem errada ao lado de
// uma explicação certa é pior que imagem nenhuma, porque o aluno acredita.
// Então aqui é busca por TÍTULO EXATO (com redirecionamento) e o resultado
// ainda precisa passar por três testes. Quando não passa, não vem nada.
const _wikiCache = new Map()

function _wikiNorm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

async function wikiIlustracao(termo, idioma) {
  const t = String(termo || '').trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, '')
  const lang = /^[a-z]{2,3}$/.test(String(idioma || '')) ? idioma : 'en'
  // Frase não tem verbete: só palavra ou nome próprio de até 4 palavras.
  if (!t || t.length < 2 || t.length > 60 || t.split(/\s+/).length > 4) return null
  const chave = lang + '|' + t.toLowerCase()
  if (_wikiCache.has(chave)) return _wikiCache.get(chave)

  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(t)}` +
    '&redirects=1&prop=pageimages|extracts&piprop=thumbnail|original&pithumbsize=480' +
    '&exintro=1&explaintext=1&exsentences=2&format=json&origin=*'
  let dados = null
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 5000)
    const r = await fetch(url, { signal: ctl.signal })
    clearTimeout(timer)
    if (r.ok) dados = await r.json()
  } catch (e) { /* offline, bloqueio, timeout: segue sem figura */ }

  let out = null
  const p = dados && dados.query && Object.values(dados.query.pages || {})[0]
  if (p && p.missing === undefined && p.thumbnail && p.thumbnail.source) {
    const ext = String(p.extract || '')
    const ehDesambiguacao = /\bmay refer to\b|\bpode referir-se\b|\bpuede referirse\b/i.test(ext) ||
      /\(disambiguation\)|\(desambigua/i.test(p.title || '')
    const a = _wikiNorm(p.title), b = _wikiNorm(t)
    // Título tem que ser o MESMO assunto: "Minie ball"→"Minié ball" e
    // "ducks"→"Duck" passam; "quills"→"Quill (disambiguation)" não.
    const casa = a === b || a.startsWith(b) || b.startsWith(a)
    if (!ehDesambiguacao && casa) {
      // Versão grande para o zoom. A largura vai embutida na URL de thumb do
      // Wikimedia, então dá para pedir maior — mas NUNCA além do arquivo
      // original: pedir 1280 de uma imagem de 620 devolve upscale borrado.
      // E derivar um thumb em vez de usar o `original` evita baixar os 20 MB
      // que algumas fotos da Commons têm.
      const larg = Math.min(1280, (p.original && p.original.width) || 1280)
      out = {
        titulo: p.title,
        img: p.thumbnail.source,
        zoom: p.thumbnail.source.replace(/\/(\d+)px-/, '/' + larg + 'px-'),
        extrato: ext.slice(0, 300),
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}`
      }
    }
  }
  _wikiCache.set(chave, out)
  return out
}

// Markup compartilhado (leitor e Preparar usam o mesmo) — sem estado, só HTML.
// A MINIATURA abre o zoom (é o que a mão quer fazer ao ver uma foto pequena);
// o link para o verbete foi para o título, embaixo, que é onde se procura
// "quero ler mais". Antes a imagem levava para fora do app no primeiro clique.
function wikiFiguraHTML(info) {
  if (!info) return ''
  return `<figure class="ll-wiki-fig">
    <button type="button" class="ll-wiki-zoom" title="Ampliar"
      data-zoom="${escA(info.zoom || info.img)}" data-mini="${escA(info.img)}"
      data-titulo="${escA(info.titulo)}" data-fonte="${escA(info.url)}">
      <img src="${escA(info.img)}" alt="${escA(info.titulo)}" decoding="async" referrerpolicy="no-referrer">
    </button>
    <figcaption>
      <a href="${escA(info.url)}" target="_blank" rel="noopener noreferrer">${esc(info.titulo)}</a>
      <i>Wikipédia</i>
    </figcaption>
  </figure>`
}

// ---------------------------------------------------------------
// Lupa da figura — vale para qualquer tela que use wikiFiguraHTML
// ---------------------------------------------------------------
// Delegação num ouvinte só: o HTML da figura é injetado em popups diferentes
// (leitor, Preparar) que nascem e morrem o tempo todo; ligar handler em cada
// um seria ouvinte órfão garantido.
function llZoomFechar() {
  const z = document.getElementById('ll-zoom')
  if (z) z.remove()
}

function llZoomAbrir(botao) {
  llZoomFechar()
  const grande = botao.dataset.zoom
  const mini = botao.dataset.mini
  const z = document.createElement('div')
  z.id = 'll-zoom'
  z.innerHTML = `
    <button type="button" class="ll-zoom-x" aria-label="Fechar">${ic('x')}</button>
    <img src="${escA(grande)}" alt="${escA(botao.dataset.titulo)}" referrerpolicy="no-referrer">
    <div class="ll-zoom-pe">
      <b>${esc(botao.dataset.titulo)}</b>
      <a href="${escA(botao.dataset.fonte)}" target="_blank" rel="noopener noreferrer">ver na Wikipédia</a>
    </div>`
  // A versão grande é derivada da URL: se o Wikimedia não servir aquele
  // tamanho, cai na miniatura em vez de mostrar imagem quebrada.
  const img = z.querySelector('img')
  img.onerror = () => { if (img.src !== mini) img.src = mini }
  // No leitor, o popup morre quando a seleção some. `preventDefault` no
  // mousedown mantém a seleção viva enquanto a lupa está aberta.
  z.addEventListener('mousedown', e => e.preventDefault())
  z.addEventListener('click', e => { if (!e.target.closest('a')) llZoomFechar() })
  document.body.appendChild(z)
}

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.ll-wiki-zoom')
  if (!b) return
  e.preventDefault(); e.stopPropagation()
  llZoomAbrir(b)
})
// Captura: o Esc precisa fechar a LUPA antes de o leitor fechar o popup dele.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !document.getElementById('ll-zoom')) return
  e.stopPropagation()
  llZoomFechar()
}, true)

// ================================================================
// GATEWAY DE IA — todas as chamadas à OpenAI passam por aqui.
//
// Por que existe (2026-07-31): o projeto tinha 16 pontos de chamada em
// 6 arquivos, com 5 implementações duplicadas do mesmo fetch e TRÊS
// defeitos sistêmicos que este arquivo corrige de uma vez:
//   1. NENHUMA chamada tinha timeout — uma rede pendurada deixava o
//      spinner girando para sempre;
//   2. NENHUMA tinha retry — um 429 (limite de taxa) no meio de um lote
//      (Kindle 25 itens, enriquecimento de documento, pool de áudio)
//      perdia itens em silêncio;
//   3. o erro subia como "HTTP 401" sem a mensagem real da OpenAI
//      ("Incorrect API key…", "You exceeded your quota…").
//
// NÃO-lazy (carregado logo após lang.js): audio.js e review.js, que são
// não-lazy, dependem dele — ver armadilha nº 1 no ESTADO-DO-PROJETO.
// O streaming do Assistente (consulta.js) fica FORA por desenho: SSE tem
// ciclo de vida próprio e retry automático duplicaria respostas.
// ================================================================

// O modelo do app quando ninguém escolheu — e o da REDE DE SEGURANÇA (a
// repescagem na OpenAI quando o fornecedor ativo falha). Luna desde 2026-08-08.
const AI_DEFAULT_MODEL = 'gpt-5.6-luna'
// O padrão ANTIGO. Serve a uma coisa só: reconhecer quem nunca escolheu
// modelo de verdade (tinha o default salvo) para migrá-lo junto. Sem isto,
// trocar o padrão não moveria ninguém — `aiModel()` respeita o que está salvo.
const AI_MODELO_ANTIGO = 'gpt-4o-mini'

// ================================================================
// FORNECEDORES DE IA (análise, traduções e chat).
// Todos falam o "dialeto" OpenAI (chat/completions + Bearer), o que
// permite trocar de fornecedor sem tocar no resto do app.
// ÁUDIO (TTS), IMAGENS e TRANSCRIÇÃO (Whisper) usam SEMPRE a OpenAI —
// os outros não têm equivalente compatível no navegador.
// Faixas de custo: rótulos curados (ordem de grandeza, não fatura).
// ================================================================
const AI_PROVIDERS = {
  openai: {
    nome: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    modelsUrl: 'https://api.openai.com/v1/models',
    keyCfg: 'openaiKey',
    placeholder: 'sk-proj-...',
    // `preco`: US$ por 1 MILHÃO de tokens (entrada/saída), preço de tabela do
    // fornecedor. É daqui que sai a estimativa em reais.
    // CONFERIDO nas páginas oficiais em 2026-08-05 (developers.openai.com/api/docs/pricing,
    // api-docs.deepseek.com, ai.google.dev/gemini-api/docs/pricing, console.groq.com/docs/models).
    // ORDEM IMPORTA: o primeiro da lista é o padrão de quem nunca escolheu
    // (settings.js → `P.modelos[0].id`). Por isso o gpt-4o-mini continua no
    // topo e o gpt-5-nano vem depois: nano é o mais barato de todos, mas
    // modelo pequeno é justamente o que solta regra em prompt longo — e o
    // prompt de análise deste app tem centenas de linhas.
    // JSON: 'schema' = aceita `response_format: json_schema` com `strict`, que é
    // o contrato de verdade (a API recusa devolver fora do formato). Ver `aiJSON`.
    json: 'schema',
    // GPT-5.6 (lançada 2026-07-09) é uma família de TRÊS níveis com nome
    // próprio: Sol (topo), Terra (equilibrado) e Luna (rápido/barato).
    // ⚠️ A ressalva do MRCR (recall em contexto longo) continua registrada:
    // Sol 91,5% · Terra 89,6% · **Luna 41,3%**.
    // ⚠️ E o tamanho do prompt estava SUBESTIMADO AQUI: este comentário dizia
    // "~3.000 tokens" desde que a Luna entrou na lista. Medido em 2026-08-08
    // por `tools/teste-ia.mjs` (que monta o prompt de verdade a partir do
    // código): **25.238 caracteres, ~6.300 tokens** — mais do que o dobro, e
    // ~6.400 quando o bloco de reencontro entra. Não é "contexto longo" no
    // sentido do MRCR, mas é o dobro do que eu supunha ao aceitar a troca.
    // Por isso a medição com chave real virou pendência de primeira ordem.
    // ⚠️ LUNA VIROU O PADRÃO em 2026-08-08, por decisão dele — e a decisão ficou
    // menos arriscada do que era: com STRUCTURED OUTPUTS a parte da regra que
    // mais doía (o formato do JSON) saiu do prompt e virou contrato da API. O
    // que se perde soltando regra agora é julgamento, não estrutura.
    // Sol ficou de fora: R$ 0,32 por card analisado é desproporcional para
    // glosa de vocabulário.
    modelos: [
      { id: 'gpt-5.6-luna',  tier: 'baixo', nota: 'GPT-5.6 Luna — geração atual pelo preço de um mini (padrão do app)', preco: { in: 0.20, out: 1.20 } },
      { id: 'gpt-4o-mini',   tier: 'baixo', nota: 'rápido e barato',                          preco: { in: 0.15, out: 0.60 } },
      { id: 'gpt-5-nano',    tier: 'baixo', nota: 'o mais barato daqui — lote sim, análise não', preco: { in: 0.05, out: 0.40 } },
      { id: 'gpt-4.1-mini',  tier: 'baixo', nota: 'melhor texto, preço próximo',              preco: { in: 0.40, out: 1.60 } },
      { id: 'gpt-4o',        tier: 'médio', nota: 'equilibrado (geração 2024)',               preco: { in: 2.50, out: 10.00 } },
      { id: 'gpt-5-mini',    tier: 'médio', nota: 'nova geração',                             preco: { in: 0.25, out: 2.00 } },
      { id: 'gpt-5.6-terra', tier: 'alto',  nota: 'GPT-5.6 Terra — quase o topo por 1/2,5 do preço', preco: { in: 2.00, out: 12.00 } },
      { id: 'gpt-5',         tier: 'alto',  nota: 'mais capaz',                               preco: { in: 1.25, out: 10.00 } },
    ]
  },
  gemini: {
    nome: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    keyCfg: 'geminiKey',
    placeholder: 'AIza...',
    // 'objeto' = só `json_object` (JSON válido, sem contrato de forma). A
    // camada de compatibilidade OpenAI do Google aceita `json_schema` de forma
    // irregular conforme o modelo; ficar no que se sabe garantido é mais
    // barato que descobrir na fatura.
    json: 'objeto',
    // ⚠️ A LINHA 2.5 INTEIRA MORREU. Em 2026-08-17 os três modelos que estavam
    // aqui (`gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`)
    // devolviam **404** na conta dele — "no longer available to new users".
    // Quem escolhesse Gemini nas Configurações não conseguia analisar NADA, e
    // o app não dava pista do motivo. Medido no navegador, não suposto.
    //
    // Os dois primeiros são apelidos que o Google mantém apontando para o
    // modelo corrente: eles NÃO envelhecem, e é de propósito que encabeçam a
    // lista — foi exatamente o envelhecimento silencioso que quebrou a versão
    // anterior. O preço deles acompanha o modelo para onde apontam, então a
    // coluna aqui é a do alvo de hoje e pode ficar defasada; os ids fixos
    // abaixo servem a quem quer preço previsível.
    modelos: [
      { id: 'gemini-flash-lite-latest', tier: 'baixo', nota: 'sempre o Flash-Lite atual — não envelhece (padrão)', preco: { in: 0.30, out: 2.50 } },
      { id: 'gemini-flash-latest',      tier: 'médio', nota: 'sempre o Flash atual — não envelhece',              preco: { in: 0.75, out: 3.75 } },
      { id: 'gemini-3.5-flash-lite',    tier: 'baixo', nota: 'o mais barato da casa; leu mangá 7/7 no teste',     preco: { in: 0.30, out: 2.50 } },
      { id: 'gemini-3.1-flash-lite',    tier: 'baixo', nota: 'geração anterior, mais barata ainda',               preco: { in: 0.25, out: 1.50 } },
      { id: 'gemini-3.7-flash',         tier: 'médio', nota: 'o Flash mais novo',                                 preco: { in: 0.75, out: 3.75 } },
      { id: 'gemini-3.5-flash',         tier: 'médio', nota: 'raciocina mais, custa mais',                        preco: { in: 1.50, out: 9.00 } },
      { id: 'gemini-3.1-pro-preview',   tier: 'alto',  nota: 'mais capaz da casa',                                preco: { in: 2.00, out: 12.00 } },
    ]
  },
  // ⚠️ O DEEPSEEK SAIU em 2026-08-08, por decisão dele: *"não vamos mais usar o
  // DeepSeek, ele não trouxe resultados tão efetivos assim"*. Quem tiver
  // `cfg.aiProvider = 'deepseek'` salvo cai sozinho na OpenAI — `aiProviderAtual`
  // valida contra esta tabela. A chave guardada não é apagada de propósito: se
  // um dia voltar, ela ainda está lá; ela só deixou de ser sincronizada.
  groq: {
    nome: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    modelsUrl: 'https://api.groq.com/openai/v1/models',
    keyCfg: 'groqKey',
    placeholder: 'gsk_...',
    json: 'objeto',
    // ⚠️ CATÁLOGO CONFERIDO NA PRÓPRIA GROQ em 2026-08-21 (`GET /v1/models`), e
    // não copiado da documentação: os dois `llama-*` que estavam aqui **saíram
    // do ar** e devolviam "The model does not exist or you do not have access
    // to it". Como o primeiro da lista é o PADRÃO de quem escolhe a Groq, o
    // fornecedor inteiro estava quebrado para quem não trocasse o modelo à mão.
    // Se voltar a falhar assim, é este o comando que dá a resposta certa.
    modelos: [
      { id: 'openai/gpt-oss-120b',  tier: 'médio', nota: 'modelo aberto grande, o mais capaz aqui', preco: { in: 0.15, out: 0.60 } },
      { id: 'openai/gpt-oss-20b',   tier: 'baixo', nota: 'rápido e barato',                          preco: { in: 0.10, out: 0.40 } },
      { id: 'qwen/qwen3.6-27b',     tier: 'baixo', nota: 'bom em tradução',                          preco: { in: 0.10, out: 0.40 } },
    ]
  }
}

// TROCAR O PADRÃO NÃO MOVE NINGUÉM — este é o problema silencioso de mudar um
// default. `aiModel()` respeita o que está salvo, e `gpt-4o-mini` está salvo em
// todo aparelho que já abriu Configurações → IA. Sem esta migração, "o padrão
// agora é a Luna" seria verdade só para uma instalação nova.
// ⚠️ Só move quem tem o PADRÃO ANTIGO salvo — isto é, quem nunca escolheu de
// verdade. Quem escolheu gpt-5, Gemini ou Groq continua onde pôs. E roda uma
// vez: com o carimbo, voltar para o gpt-4o-mini de propósito não é desfeito no
// boot seguinte.
function migrarModeloPadrao() {
  if (cfg.migModeloLuna) return
  const antigo = m => m === AI_MODELO_ANTIGO
  let mexeu = false
  if (antigo((cfg.aiModel || '').trim())) { cfg.aiModel = AI_DEFAULT_MODEL; mexeu = true }
  if (cfg.aiModelProv && antigo((cfg.aiModelProv.openai || '').trim())) {
    cfg.aiModelProv.openai = AI_DEFAULT_MODEL; mexeu = true
  }
  cfg.migModeloLuna = 1
  saveCfg()
  if (mexeu) console.info('[ai] modelo padrão migrado para', AI_DEFAULT_MODEL)
}

function aiProviderAtual() {
  return AI_PROVIDERS[cfg.aiProvider] ? cfg.aiProvider : 'openai'
}
// Config completa do chat corrente: fornecedor + chave + modelo
function aiChatCfg() {
  const prov = aiProviderAtual()
  const P = AI_PROVIDERS[prov]
  return { prov, P, key: (cfg[P.keyCfg] || '').trim(), model: aiModel() }
}

// Modelo efetivo: o configurado, se for um modelo OpenAI plausível.
// Protege contra um cfg.aiModel antigo sincronizado da nuvem com um
// modelo de outro provedor (ex.: claude-*) — iria para a API errada.
function aiModel() {
  const prov = aiProviderAtual()
  const lista = AI_PROVIDERS[prov].modelos
  // por fornecedor (aiModelProv); legado: cfg.aiModel vale para a OpenAI
  const salvo = ((cfg.aiModelProv || {})[prov]) || (prov === 'openai' ? (cfg.aiModel || '').trim() : '')
  return lista.some(m => m.id === salvo) ? salvo : lista[0].id
}

// A família gpt-5/o* rejeita `max_tokens` (exige `max_completion_tokens`).
function _aiRaciocina(model) { return /^(gpt-5|o\d)/.test(model || '') }

// ⚠️ ESTES MODELOS GASTAM TOKENS DE RACIOCÍNIO DENTRO DO MESMO ORÇAMENTO.
// A doc da OpenAI é explícita: se o teto acabar durante o raciocínio, volta
// `finish_reason: length` com content VAZIO — e "você paga a entrada e o
// raciocínio sem receber resposta visível". Foi o que derrubou a leitura do
// capítulo com o Luna: 1.440 tokens dimensionados para 40 glosas sumiram no
// raciocínio e não sobrou nada para o texto. A recomendação da OpenAI é
// reservar ~25.000.
// A folga é DE GRAÇA: `max_completion_tokens` é LIMITE, não reserva — só se
// paga o que for realmente gerado. Por isso vale para todas as chamadas do
// app, e não só para a pré-análise: `add.js` pedia 800, `review.js` 600,
// `ler.js` 600 — todas correndo o mesmo risco em modelo que pensa.
const AI_FOLGA_RACIOCINIO = 25000
function _aiTokenParam(model, maxTokens) {
  if (!maxTokens) return {}
  return _aiRaciocina(model)
    ? { max_completion_tokens: maxTokens + AI_FOLGA_RACIOCINIO }
    : { max_tokens: maxTokens }
}

// fetch com timeout + retry.
// Retenta em 429/5xx/queda de rede (2 vezes, backoff 1s→3s, respeitando
// Retry-After). NUNCA retenta 4xx de verdade (chave errada não melhora
// tentando de novo). O corpo do erro da OpenAI vira a mensagem do Error.
// ================================================================
// FREIO GLOBAL — não estourar o limite de requisições por minuto
// ================================================================
// O erro que motivou isto: "Rate limit reached for gpt-5.6-luna … RPM:
// Limit 500, Used 500". O `_aiFetch` JÁ tentava de novo em 429 — o problema
// era anterior: vários caminhos disparam em `Promise.all` (a sincronia de
// legenda é um deles) e mandam dezenas de chamadas de uma vez. Repetir não
// resolve, porque as tentativas colidem com a mesma rajada.
//
// Duas travas, e as duas precisam existir:
//  1. TETO DE SIMULTÂNEAS — impede a rajada nascer. `Promise.all` continua
//     escrito do mesmo jeito nos chamadores; a fila é que segura.
//  2. FREIO COMPARTILHADO — quando UMA chamada leva 429, TODAS as outras
//     esperam. Sem isso, só a que apanhou desacelera e as demais continuam
//     batendo na parede, mantendo o limite estourado.
const AI_MAX_SIMULT = 4
let _aiEmVoo = 0
const _aiFila = []
let _aiFreioAte = 0        // timestamp até quando todo mundo espera

function _aiLiberarVaga() {
  _aiEmVoo--
  const proximo = _aiFila.shift()
  if (proximo) proximo()
}

async function _aiPegarVaga() {
  if (_aiEmVoo >= AI_MAX_SIMULT) {
    await new Promise(res => _aiFila.push(res))
  }
  _aiEmVoo++
  // O freio é checado DEPOIS de pegar a vaga e em laço: um 429 que chegue
  // enquanto esta chamada esperava na fila também vale para ela.
  while (Date.now() < _aiFreioAte) {
    await new Promise(r => setTimeout(r, Math.min(2000, _aiFreioAte - Date.now() + 20)))
  }
}

// A própria mensagem da OpenAI diz quanto esperar ("Please try again in
// 120ms") — é mais preciso que qualquer palpite nosso, e às vezes vem sem o
// cabeçalho `retry-after`.
function _aiEsperaDoErro(msg, cab) {
  const h = parseFloat(cab) * 1000
  if (h > 0) return h
  const m = /try again in ([\d.]+)\s*(ms|s)\b/i.exec(String(msg || ''))
  if (m) return parseFloat(m[1]) * (m[2].toLowerCase() === 's' ? 1000 : 1)
  return 0
}

async function _aiFetch(url, body, { timeoutMs = 90000, retries = 2, key } = {}) {
  await _aiPegarVaga()
  try {
    return await _aiFetchBruto(url, body, { timeoutMs, retries, key })
  } finally {
    _aiLiberarVaga()
  }
}

async function _aiFetchBruto(url, body, { timeoutMs = 90000, retries = 2, key } = {}) {
  let lastErr = null
  for (let tent = 0; tent <= retries; tent++) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key || cfg.openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl.signal
      })
      clearTimeout(timer)
      if (res.ok) return res
      let msg = 'HTTP ' + res.status
      try { const e = await res.json(); if (e.error?.message) msg = e.error.message } catch {}
      const retryavel = res.status === 429 || res.status >= 500
      lastErr = new Error(msg)
      lastErr.status = res.status
      if (!retryavel || tent === retries) throw lastErr
      // 429 é limite de TAXA, não falha desta chamada: quem espera é o app
      // inteiro. Piso de 1,2s mesmo quando a API pede 120ms — o que ela mede
      // é a janela dela, e voltar em 120ms com a fila cheia só reestoura.
      let espera = _aiEsperaDoErro(msg, res.headers.get('retry-after')) || (tent + 1) * 1500
      if (res.status === 429) {
        espera = Math.max(espera, 1200)
        _aiFreioAte = Math.max(_aiFreioAte, Date.now() + espera)
        console.warn('[ai] limite de taxa — segurando todas as chamadas por ' + Math.round(espera) + 'ms')
      }
      await new Promise(r => setTimeout(r, espera))
    } catch (e) {
      clearTimeout(timer)
      if (e === lastErr) throw e                       // HTTP não-retryável já decidido acima
      const eraTimeout = e.name === 'AbortError'
      lastErr = eraTimeout ? new Error(`Sem resposta da OpenAI em ${timeoutMs / 1000}s`) : e
      if (tent === retries) throw lastErr
      await new Promise(r => setTimeout(r, (tent + 1) * 1500))
    }
  }
  throw lastErr
}

// Extrai o objeto JSON de uma resposta: tolera cerca de ```json, texto antes
// ou depois, e o content vindo em reasoning_content.
function _aiParseJSON(data) {
  const msg = data.choices?.[0]?.message || {}
  let raw = String(msg.content || msg.reasoning_content || '')
    .replace(/```(?:json)?\n?|\n?```/g, '').trim()
  if (!raw) return null
  try { return JSON.parse(raw) } catch {}
  const i = raw.indexOf('{'), f = raw.lastIndexOf('}')
  if (i >= 0 && f > i) { try { return JSON.parse(raw.slice(i, f + 1)) } catch {} }
  return null
}

// ================================================================
// O QUE ESTÁ DIFICULTANDO ESTA PASSAGEM — a análise por nível
// ================================================================
// A ideia é dele, e o diagnóstico também: *"vejo uma frase que não entendo, mas
// não sei por que não entendi. Em vez de tentar traduzir e pedir pra Lexa
// explicar, já vejo de cara que ali no meio tem um phrasal ou palavra
// desconhecida."*
//
// É outra pergunta, e por isso outra ferramenta. Traduzir responde "o que isto
// quer dizer"; explicar responde "por que isto quer dizer isso". Falta a
// primeira de todas: **ONDE está o problema**. Quem responde isso é esta
// varredura — ela não traduz nada, só APONTA.
//
// DOIS CRITÉRIOS, e eles são diferentes de propósito:
//   1. Vocabulário ACIMA DO NÍVEL dele (o nível vive em Configurações).
//   2. Phrasal verbs, idioms e collocations **em qualquer nível** — porque o
//      que trava não é a raridade da palavra: "put up with" é feito de três
//      palavras que um A1 conhece e significa uma quarta coisa.
//
// ⚠️ O QUE ELE JÁ SABE SAI — MAS PELO SENTIDO, NUNCA PELA FORMA.
// A primeira versão apagava a palavra só por ela já existir no acervo, e ele
// derrubou o critério com uma pergunta: *"já deixamos claro que uma mesma
// palavra pode ter vários significados. Vai ser simplesmente apagado por eu
// conhecer ela com um significado, ou vai buscar no significado que eu conheço
// e, se for igual ao que está sendo analisado, aí sim remove?"*
//
// Ele tem razão, e o app inteiro é construído sobre isso (`meanings[]`,
// `meaningId`, sentidos separados em item próprio). Apagar `ore` porque ele
// estudou "veio de mina" esconderia justamente a passagem em que a palavra
// significa "minério" — o caso que este raio-X existe para pegar.
//
// A regra passou a ser em três estados:
//   · sentido JÁ ESTUDADO (a glosa bate com um `meaning_pt` do item) → sai
//   · palavra no acervo com OUTRO sentido → FICA, com o selo "outro sentido"
//   · marcada como conhecida (`knownWords`, que não guarda significado nenhum)
//     → FICA, com selo discreto: ali não há sentido para comparar, e sumir
//     seria decidir no escuro.

// O JSON de dentro de uma resposta de texto. Gêmeo de `_aiParseJSON`, que só
// sabe ler o objeto cru da API — aqui a resposta já veio como string.
function _aiJsonDeTexto(bruto) {
  let raw = String(bruto || '').replace(/```(?:json)?\n?|\n?```/g, '').trim()
  if (!raw) return null
  try { return JSON.parse(raw) } catch {}
  const i = raw.indexOf('{'), f = raw.lastIndexOf('}')
  if (i >= 0 && f > i) { try { return JSON.parse(raw.slice(i, f + 1)) } catch {} }
  return null
}

const AI_DIF_TIPOS = {
  word:         { rotulo: 'palavra',    cor: 'var(--role-novo)' },
  phrasal_verb: { rotulo: 'phrasal',    cor: 'var(--role-fonte)' },
  idiom:        { rotulo: 'expressão',  cor: 'var(--role-urgente)' },
  collocation:  { rotulo: 'combinação', cor: 'var(--role-ia)' }
}

// ⚠️ EM BLOCOS, E ESSE É O CONSERTO DA PRIMEIRA VERSÃO. Ele mandou analisar um
// capítulo de "Carrie" (7,5 mil caracteres) e recebeu *"nada acima do seu nível
// B1, nenhum phrasal verb"* — numa página com `back away`, `catch up`,
// `pull her leg`, `tagging along` e `incontrovertible`. A IA tinha achado tudo:
// a resposta VEIO CORTADA no teto de tokens, o JSON ficou inválido e o parse
// falhado virava lista vazia. **Falha silenciosa que vira mentira na tela** —
// o pior tipo, porque parece resposta.
//
// Duas travas agora: o texto vai em blocos que cabem na resposta, e JSON
// quebrado é RESGATADO item a item; se nem isso der, é ERRO, nunca "não achei".
const AI_DIF_BLOCO = 2200        // caracteres por chamada — cabe na resposta
const AI_DIF_TOKENS = 2600

// ⚠️ MODELO QUE RACIOCINA PRECISA DE OUTRO ORÇAMENTO, e o projeto já pagou para
// aprender isso (ver `aiText`): a família gpt-5/o* gasta tokens PENSANDO dentro
// do mesmo teto, e quando o teto acaba durante o raciocínio volta
// `finish_reason: length` com content VAZIO — paga-se a entrada e o raciocínio
// sem receber uma linha. Aqui isso seria idêntico ao bug que acabamos de
// corrigir: resposta vazia virando "não achei nada".
// Ele pediu para deixar pronto antes de rodar no Luna (gpt-5.6). Então: teto
// bem maior e bloco menor — menos texto por chamada é menos raciocínio por
// chamada, e é o que evita o estouro em vez de só aumentar a fatura.
function _aiDifOrcamento() {
  const modelo = (typeof aiChatCfg === 'function' ? aiChatCfg().model : '') || ''
  const raciocina = typeof _aiRaciocina === 'function' ? _aiRaciocina(modelo) : /^(gpt-5|o\d)/.test(modelo)
  return raciocina
    ? { bloco: 1500, tokens: 7000, raciocina: true }
    : { bloco: AI_DIF_BLOCO, tokens: AI_DIF_TOKENS, raciocina: false }
}

async function aiAnalisarDificuldade({ texto, lang = 'en', nivel, maxItens = 40, aoAndar } = {}) {
  const t = String(texto || '').trim()
  if (!t) return []
  const nv = nivel || (typeof cefrNivelAluno === 'function' ? cefrNivelAluno() : 'B1')
  const orc = _aiDifOrcamento()
  const blocos = _aiFatiarTexto(t, orc.bloco)
  const cru = []
  let falhas = 0
  for (let i = 0; i < blocos.length; i++) {
    if (aoAndar) aoAndar(i + 1, blocos.length)
    try {
      const parte = await _aiDificuldadeBloco(blocos[i], lang, nv, maxItens, orc)
      if (parte === null) falhas++
      else cru.push(...parte)
    } catch (e) {
      console.warn('[raio-x] bloco', i + 1, 'falhou:', e && e.message)
      falhas++
    }
  }
  // Todos os pedaços falharam: isso é erro, e tem de aparecer como erro.
  if (falhas && !cru.length) {
    throw new Error('a análise não voltou legível — tente de novo')
  }
  const vistos = new Set()
  const itens = cru
    .map(x => ({ ...x, ja: aiJaConhecido(x) }))
    .filter(x => {
      if (!x.t || x.t.length > 60) return false
      const k = x.t.toLowerCase()
      if (vistos.has(k)) return false
      vistos.add(k)
      return x.ja !== 'sentido'          // só o sentido JÁ ESTUDADO some
    })
  itens.incompleto = falhas > 0
  return itens
}

// Fatia por LINHA e, quando a linha não cabe, por FRASE — nunca no meio de uma
// frase, porque o modelo precisa dela inteira para dizer o que ali é difícil.
//
// ⚠️ O RAMO DA FRASE NÃO É LUXO: a transcrição do audiolivro vem em linhas (uma
// por fala), mas o texto de um EPUB vem em UMA LINHA SÓ. Sem ele, um capítulo
// de 20 mil caracteres virava um bloco único, a resposta era cortada no teto e
// voltávamos ao bug que esta função existe para consertar — medido no capítulo
// 1 do Billy Summers, que devolveu 33 achados onde havia muito mais.
function _aiFatiarTexto(texto, tamanho) {
  const pedacos = []
  for (const linha of String(texto).split('\n')) {
    if (linha.length <= tamanho) { pedacos.push(linha); continue }
    // Linha comprida: quebra nas fronteiras de frase, mantendo a pontuação.
    const frases = linha.match(/[^.!?…]+[.!?…]+["'”’)\]]*\s*|[^.!?…]+$/g) || [linha]
    let atual = ''
    for (const f of frases) {
      if (atual && (atual.length + f.length) > tamanho) { pedacos.push(atual); atual = '' }
      // Frase sozinha maior que o bloco (diálogo sem pontuação): corta no espaço.
      if (f.length > tamanho) {
        let resto = f
        while (resto.length > tamanho) {
          const corte = resto.lastIndexOf(' ', tamanho)
          pedacos.push(resto.slice(0, corte > 0 ? corte : tamanho))
          resto = resto.slice(corte > 0 ? corte + 1 : tamanho)
        }
        atual = resto
        continue
      }
      atual += f
    }
    if (atual.trim()) pedacos.push(atual)
  }
  // Junta os pedaços de volta até encher o bloco.
  const blocos = []
  let atual = ''
  for (const pe of pedacos) {
    if (atual && (atual.length + pe.length + 1) > tamanho) { blocos.push(atual); atual = '' }
    atual += (atual ? '\n' : '') + pe
  }
  if (atual.trim()) blocos.push(atual)
  return blocos.length ? blocos : [texto]
}

async function _aiDificuldadeBloco(texto, lang, nv, maxItens, orc) {
  const o = orc || _aiDifOrcamento()
  const L = (typeof getLangDef === 'function') ? getLangDef(lang) : { nameEn: 'English' }
  const def = (typeof CEFR !== 'undefined' ? CEFR.find(x => x.id === nv) : null) || { nome: nv }
  const sistema =
`Você é professor de ${L.nameEn} e está preparando um aluno de nível ${nv} (${def.nome}).
Receberá um trecho e deve apontar SÓ o que provavelmente o faria travar.

Devolva JSON: {"itens":[{"t":"...","tipo":"word|phrasal_verb|idiom|collocation","nivel":"A1..C2","pt":"..."}]}

REGRAS:
- "t" é a forma EXATA como aparece no trecho (mesma flexão, mesma ordem), para poder ser
  encontrada nele. Nunca o infinitivo, nunca a forma de dicionário.
- "pt": o sentido AQUI, em português, no máximo 4 palavras. Sem definição, sem explicação.
- CONFIRA CADA "pt" ANTES DE RESPONDER: troque o trecho pela sua tradução dentro da frase. Se a
  frase deixar de fazer sentido, a tradução está errada — corrija ou não inclua o item.
  Exemplo do erro a evitar: em "Macintosh holds out his hand. Billy rises and shakes it",
  "shakes it" é APERTAR A MÃO. Traduzir por "treme de medo" ignora a frase anterior.
- Use as frases vizinhas para decidir o sentido: o trecho recebido é contínuo.
- Inclua vocabulário acima de ${nv} (nivel B2, C1 ou C2 para um aluno ${nv}).
- Inclua phrasal verb, idiom e collocation SÓ quando o sentido ali NÃO for literal — é o caso de
  "put up with" e "call it a day". Verbo comum com objeto comum ("open the door", "take the bus")
  não é idiom.
- NÃO inclua: nome próprio, número, palavra transparente com o português (hotel, doctor),
  nem vocabulário que um aluno ${nv} já domina.
- Máximo ${maxItens} itens. Se não houver nada difícil, devolva {"itens":[]}.
- Nada além do JSON: sem raciocínio escrito, sem comentário, sem cerca de código.`

  const bruto = await aiTextSeguro([
    { role: 'system', content: sistema },
    { role: 'user', content: texto }
  ], { maxTokens: o.tokens, timeoutMs: o.raciocina ? 180000 : 90000 })

  const obj = _aiJsonDeTexto(bruto)
  let lista = (obj && Array.isArray(obj.itens)) ? obj.itens : null
  if (!lista) lista = _aiResgatarItens(bruto)      // JSON cortado: salva o que deu
  if (!lista) return null                          // nem isso: o bloco falhou
  return lista.map(x => ({
    t: String(x.t || '').trim(),
    tipo: AI_DIF_TIPOS[x.tipo] ? x.tipo : 'word',
    nivel: String(x.nivel || '').toUpperCase(),
    pt: String(x.pt || '').trim()
  })).filter(x => x.t)
}

// ⚠️ RESGATE DE JSON CORTADO. Resposta que acaba no meio ("...\"tipo\": \"word")
// tem, antes do corte, dezenas de itens perfeitos — e eles já foram pagos.
// Jogar tudo fora por causa da última linha é desperdício em cima de erro.
function _aiResgatarItens(bruto) {
  const raw = String(bruto || '')
  const achados = []
  const re = /\{[^{}]*"t"\s*:\s*"(?:[^"\\]|\\.)*"[^{}]*\}/g
  let m
  while ((m = re.exec(raw))) {
    try { achados.push(JSON.parse(m[0])) } catch (e) {}
  }
  return achados.length ? achados : null
}

// A FRASE em que o termo aparece — é ela que vira o contexto do card.
// ⚠️ Sem isto, o item nasceria com o parágrafo inteiro (ou com nada) no lugar
// da frase, e a regra que este projeto mediu vale aqui igual: contexto grande
// demais dilui, e o Preparar erra o sentido.
function aiFraseDoTermo(texto, termo) {
  const t = String(texto || '')
  const oc = aiAcharNoTexto(t, termo)[0]
  if (!oc) return ''
  // Fronteiras de frase, tolerando "Mr." e reticências pela exigência de
  // espaço + maiúscula depois do ponto.
  let ini = 0
  for (let i = oc.i; i > 0; i--) {
    if (/[.!?]/.test(t[i]) && /\s/.test(t[i + 1] || ' ')) { ini = i + 1; break }
  }
  let fim = t.length
  for (let i = oc.fim; i < t.length; i++) {
    if (/[.!?]/.test(t[i]) && /\s|$/.test(t[i + 1] || ' ')) { fim = i + 1; break }
  }
  const frase = t.slice(ini, fim).replace(/\s+/g, ' ').trim()
  return frase.length > 400 ? frase.slice(0, 400) : frase
}

// Em que pé este termo está para ele: `'sentido'` (já estudou ESTE sentido),
// `'outro'` (tem a palavra, com outro significado), `'marcada'` (declarou
// conhecer, sem significado registrado) ou `null`.
function aiJaConhecido(x) {
  const k = String(x.t || '').toLowerCase().trim()
  if (!k) return null
  const item = (typeof words !== 'undefined' && Array.isArray(words))
    ? words.find(w => String(w.word || '').toLowerCase() === k)
    : null
  if (item) {
    const sentidos = (item.meanings || [])
      .filter(m => m && m.meaning_pt && !m.moved_to && !m.fundido_em)
      .map(m => m.meaning_pt)
    if (!sentidos.length) return 'outro'
    return sentidos.some(m => aiSentidoParecido(m, x.pt)) ? 'sentido' : 'outro'
  }
  if (typeof isKnownWord === 'function' && x.tipo === 'word' && isKnownWord(x.t)) return 'marcada'
  return null
}

// Dois sentidos são "o mesmo" quando compartilham uma palavra de peso.
// ⚠️ Comparação FROUXA de propósito: a glosa do raio-X tem até quatro palavras
// e a do card foi escrita noutro momento — exigir igualdade literal faria
// "tolerar" e "suportar, tolerar" contarem como sentidos diferentes, e o item
// voltaria a aparecer para sempre. O risco do outro lado (juntar dois sentidos
// distintos que dividem uma palavra) é pequeno: "minério" e "veio" não têm
// palavra em comum, nem "luz" e "leve".
function aiSentidoParecido(a, b) {
  const limpa = t => String(t || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !/^(para|como|algo|alguem|fazer|coisa|muito|mais|sobre|entre|quando|pessoa|aquilo|isso)$/.test(w))
  const A = limpa(a), B = limpa(b)
  if (!A.length || !B.length) return false
  // Uma palavra de peso em comum basta — inclusive por prefixo, para pegar
  // "tolerar/tolerância" e "canceladas/cancelar".
  return A.some(x => B.some(y => x === y || (x.length >= 5 && y.startsWith(x.slice(0, 5))) || (y.length >= 5 && x.startsWith(y.slice(0, 5)))))
}

// Onde cada achado APARECE no texto. Casamento por posição, sem regex montada
// com o termo — expressão com ponto, parêntese ou apóstrofo viraria um padrão
// inválido, e é exatamente o formato de "call it a day." ou "don't".
function aiAcharNoTexto(texto, termo) {
  const alvo = String(texto || '').toLowerCase()
  const t = String(termo || '').toLowerCase().trim()
  if (!t) return []
  const saida = []
  let de = 0
  while (saida.length < 8) {
    const i = alvo.indexOf(t, de)
    if (i < 0) break
    // Fronteira de palavra nas duas pontas, para "on" não acender dentro de
    // "only" e "at" dentro de "attention".
    const antes = i === 0 || /[^a-z0-9']/i.test(alvo[i - 1])
    const depois = i + t.length >= alvo.length || /[^a-z0-9']/i.test(alvo[i + t.length])
    if (antes && depois) saida.push({ i, fim: i + t.length })
    de = i + Math.max(1, t.length)
  }
  return saida
}

// ================================================================
// A LEXA NA WEB — só quando ele pedir
// ================================================================
// A busca só existe na Responses API (`/v1/responses`), fora do dialeto
// `chat/completions` que o resto do app fala. Sondada com chave real em
// 2026-08-08, e o número que importa é o preço de OFERECÊ-LA:
//
//   mesma pergunta ("o que significa 'fancy' aqui?"), mesmo modelo:
//     sem a ferramenta ................  37 tokens de entrada · R$ 0,0010
//     com a ferramenta, SEM buscar .... 4.473 tokens de entrada · R$ 0,0055
//
// Os 4.436 tokens de diferença são o MANUAL DA FERRAMENTA, que a API põe no
// contexto a cada chamada. Paga-se por ele estar à mão, o modelo usando ou não.
//
// ⚠️ HOUVE UM MODO AUTOMÁTICO AQUI — filtro de nome próprio, três posições de
// escolha, projeção de custo, memória do que não adiantou — e ele decidiu
// contra: *"sobre a pesquisa web ele nunca deve ser automático. Só acontece
// quando eu clico."* Está certo, e o motivo é o que ele mesmo viu na tela: o
// automático disparava em "Archie's Pals 'n' Gals", pagava o pedágio, e o
// modelo decidia não buscar porque já sabia. Gasto sem resultado, repetido.
// Tudo aquilo SAIU em vez de ficar desligado: opção que ninguém deve escolher
// é código morto com aparência de recurso.
//
// Sobrou o essencial: um botão, e o preço dele à vista. Clicou, buscou.
const AI_WEB_PEDAGIO = 4436    // pedágio da ferramenta (medido)
const AI_WEB_BUSCA   = 10700   // o que os resultados somam quando ela busca

// O custo de UM clique, em reais. Lê a cotação já guardada (`aiUsdBrl` é
// assíncrona e isto vai num `data-tip`); sem ela, o piso conhecido.
function lexaWebCustoBrl() {
  let brl = AI_USD_BRL_FALLBACK
  try {
    const c = JSON.parse(localStorage.getItem(SK_USD_BRL) || 'null')
    if (c && c.rate > 0) brl = c.rate
  } catch (e) {}
  return (AI_WEB_PEDAGIO + AI_WEB_BUSCA) / 1e6 * aiPrecoModelo().in * brl
}

function aiWebPodeUsar() {
  return aiProviderAtual() === 'openai' && !!(cfg.openaiKey || '').trim()
}

// ⚠️ QUANDO RODAR SOZINHA É DECISÃO DELE, e por isso são TRÊS posições — a
// pergunta não é "ligado ou desligado", é "quanto de automático eu quero
// pagar". Cada opção tem um preço que só a medição revela, e ele escolhe com
// esse preço à vista, não com a minha preferência embutida:
//   'pedido' — nunca sozinha. O botão no balão continua lá. Custo extra: zero.
//   'auto'   — quando o termo cheira a mundo real (o padrão que eu defendo).
//   'sempre' — em toda explicação. 5,3× o custo de todas, medido.
// O botão manual existe nos três modos: é ele que deixa o filtro poder ser
// conservador sem custar informação.
// ⚠️ PEDIR BUSCA É PEDIR MAIS, NÃO O MESMO COM FONTE.
// Ele clicou e recebeu a MESMA resposta — *"esperava riqueza de informações"*.
// Tinha razão, e por duas causas somadas:
//   1) `tool_choice: 'auto'` deixava o modelo RECUSAR a busca mesmo com ele
//      pedindo. "Auto" é para quem não decidiu; ele decidiu ao clicar.
//   2) o prompt continuava sendo o de sempre, que manda responder em "2 a 4
//      frases, sem introdução" — um teto que briga com a razão de ir à rua.
// Este prompt é outra tarefa, e mira no que a explicação curta não cobre: o
// que um LEITOR NATIVO entende ao ver aquilo na cena. É essa a informação que
// muda a leitura e que nenhum dicionário dá.
// ⚠️ E O PROMPT NÃO PODE TER FORMULÁRIO DENTRO.
// A primeira versão listava "1. o que é / 2. fatos / 3. ⭐ o que um nativo
// entende", e o modelo devolveu exatamente isso: títulos em negrito,
// estrelinha, bullets e um bloco final reexplicando a cena. Ele resumiu em uma
// palavra — *"vômito de informação"* — e pediu o oposto: *"quero a
// personalidade da Lexa me apresentando as informações"*.
// A lição serve para todo prompt deste app: ESTRUTURA NO PEDIDO VIRA ESTRUTURA
// NA RESPOSTA. Se eu quero conversa, tenho de pedir em prosa e proibir a
// moldura — e dizer o que ela NÃO deve repetir, porque a explicação curta já
// falou da cena.
function lexaExplicarWeb() {
  return lexaSistema(`
TAREFA AGORA: ele pediu que você fosse à internet sobre algo que encontrou lendo.
Ele JÁ leu sua explicação curta e JÁ entendeu o que a coisa faz na frase. O que falta é o MUNDO por trás — e é isso que você foi buscar.

ESCREVA COMO VOCÊ FALA, em prosa: no máximo dois parágrafos curtos, corridos.
Dissolva na conversa o que a busca trouxe — o que a coisa é de verdade, de quem, de quando —, e termine pelo que mais interessa a quem lê numa língua que não é a sua: o que um nativo SENTE ao topar com aquilo. Se soa infantil, cafona, nostálgico, canônico, datado, regional, caro, brega. É essa camada que não está em dicionário nenhum.

PROIBIDO, e isto é para valer:
- Título, subtítulo, negrito de seção, "1.", "2.", bullet, traço no começo da linha, estrela, emoji. NADA de lista. Prosa.
- URL, link, domínio ou citação entre parênteses. O app mostra as fontes embaixo sozinho; repetir suja a leitura.
- Reexplicar a cena, o personagem ou o que a frase quer dizer. Isso já foi dado, e repetir é o que mais irrita.
- "É importante notar", "vale destacar", recapitular a pergunta.
- Inventar data, nome ou fato. Sem fonte, não afirme — e se a busca não achou nada firme, diga isso numa frase e pare.

Umas 6 a 8 linhas no total. Rico e coeso, não extenso.`)
}

// Texto com busca na web. Devolve `{ texto, fontes, buscou }` — as fontes vêm
// nas anotações da resposta, e mostrá-las é metade do ganho: o que a web traz
// de novo não é saber mais, é poder CONFERIR.
async function aiTextWeb({ sistema, pergunta, maxTokens = 700, timeoutMs }) {
  const chat = aiChatCfg()
  if (chat.prov !== 'openai' || !chat.key) throw new Error('a busca na web só existe na OpenAI')
  const res = await _aiFetch('https://api.openai.com/v1/responses', {
    model: chat.model,
    ...(sistema ? { instructions: sistema } : {}),
    input: pergunta,
    // A folga de raciocínio vale aqui igual: `max_output_tokens` é LIMITE, não
    // reserva — só se paga o que for gerado.
    max_output_tokens: maxTokens + AI_FOLGA_RACIOCINIO,
    tools: [{ type: 'web_search' }],
    // ⚠️ `required`, NÃO `auto`. "Auto" é para quem não decidiu — e aqui quem
    // decidiu foi ELE, no clique. Com `auto`, o modelo olhava um nome que já
    // conhecia, dispensava a busca e devolvia a mesma resposta de antes: ele
    // pagava o pedágio e recebia o que já tinha. Pedido dele é ordem, não
    // sugestão.
    tool_choice: 'required'
  }, { timeoutMs, retries: 0, key: chat.key })
  const d = await res.json()
  _aiGuardarUso(d, chat.model)          // já entende input_tokens/output_tokens
  const saida = Array.isArray(d.output) ? d.output : []
  const blocos = saida.filter(o => o.type === 'message')
    .flatMap(o => (o.content || []).filter(c => c.type === 'output_text'))
  const fontes = []
  for (const b of blocos) {
    for (const a of (b.annotations || [])) {
      const url = a.url || ''
      if (url && !fontes.some(f => f.url === url)) fontes.push({ url, titulo: a.title || '' })
    }
  }
  return {
    texto: blocos.map(b => b.text).join('\n').trim(),
    fontes,
    buscou: saida.some(o => String(o.type || '').includes('web_search'))
  }
}

// ================================================================
// STRUCTURED OUTPUTS — a forma da resposta vira contrato, não pedido
// ================================================================
// O app inteiro se apoia em `aiJSON`, e até aqui a forma da resposta era
// PEDIDA em prosa: cada prompt carrega um molde de JSON e uma lista de regras,
// e o código põe uma rede embaixo para o caso de o modelo não obedecer —
// leitores tolerantes, campos opcionais, extração de JSON do meio do texto.
// Isso é caro em três moedas: tokens de prompt, código de leitura defensiva
// espalhado por seis arquivos, e bug silencioso quando o campo vem com outro
// nome (o `curiosidade` que sumiu no "refazer" foi disso).
//
// `json_schema` com `strict: true` inverte o jogo: a API RECUSA devolver fora
// do formato. O que era esperança vira garantia.
//
// ⚠️ AS TRÊS REGRAS DO MODO ESTRITO, que moldam o helper abaixo:
//   1. todo objeto precisa de `additionalProperties: false`;
//   2. TODA propriedade precisa estar em `required` — não existe campo
//      opcional. Ausência vira presença vazia: `""` ou `[]`. E isto é bom
//      aqui: "campo ausente" e "campo vazio" eram dois estados com o mesmo
//      significado, e cada leitor tratava de um jeito;
//   3. palavras-chave de validação fina (minLength, format, pattern) não
//      entram. Por isso o helper só emite o que o modo estrito aceita.
const S = {
  txt:   d => ({ type: 'string', description: d || undefined }),
  num:   d => ({ type: 'number', description: d || undefined }),
  bool:  d => ({ type: 'boolean', description: d || undefined }),
  // O enum é o ganho mais direto: hoje o código recebe `type: "colocação"` em
  // vez de `collocation` e cai num default silencioso. Aqui a API não deixa.
  ou:  (vals, d) => ({ type: 'string', enum: vals, description: d || undefined }),
  // No modo estrito não existe campo opcional — "pode vir nulo" se diz assim.
  txtOuNulo: d => ({ type: ['string', 'null'], description: d || undefined }),
  lista: (itens, d) => ({ type: 'array', items: itens, description: d || undefined }),
  obj: (props, d) => ({
    type: 'object', properties: props,
    required: Object.keys(props),     // regra 2: todas, sempre
    additionalProperties: false,
    description: d || undefined
  })
}

// ---- OS ESQUEMAS DO APP ----------------------------------------
// ⚠️ ELES DESCREVEM A FORMA, NÃO O CONTEÚDO — e isso é decisão, não preguiça.
// Os prompts daqui foram afinados ao longo de dezenas de rodadas: cada campo
// carrega instrução, exemplo e contra-exemplo, e mover esse texto para dentro
// do esquema seria reescrever o coração do app numa rodada de infraestrutura.
// O prompt continua ensinando O QUE escrever; o esquema garante ONDE.
//
// ⚠️ ARMADILHA DO MODO ESTRITO: com `additionalProperties: false`, um campo que
// eu esquecer aqui o modelo fica PROIBIDO de devolver — e o app perde o dado
// em silêncio, que é pior do que o problema que vim resolver. Por isso existe
// `_esqConfere()`, que compara cada esquema com o molde JSON do próprio prompt.
const ESQ = {}

// A ANÁLISE — o centro do app. Um sentido por encontro, com o audit dos que
// ficaram de fora.
ESQ.analise = S.obj({
  word: S.txt(), detected_lang: S.txt(), context_pt: S.txt(),
  type: S.ou(['word', 'phrasal_verb', 'idiom', 'collocation']),
  type_label: S.txt(), lemma: S.txt(), ipa: S.txt(),
  level: S.ou(['A2', 'B1', 'B2', 'C1', 'C2']),
  sense_audit: S.lista(S.txt()),
  meanings: S.lista(S.obj({
    meaning_pt: S.txt(), definition_pt: S.txt(), origin_pt: S.txt(),
    // `variety` muda com o idioma (promptVarietyEnum) — texto livre de propósito.
    variety: S.txt(),
    register: S.ou(['neutral','formal','informal','colloquial','slang','technical','literary','archaic','vulgar']),
    level: S.ou(['A2', 'B1', 'B2', 'C1', 'C2']),
    gramatical: S.bool(), requires: S.txt(), unit: S.txt(), context_match: S.bool(),
    // ⚠️ `same_as` QUASE FICOU DE FORA, e teria quebrado o reencontro (Fase 3)
    // em silêncio: é por ele que a IA diz "este sentido é aquele que ele já
    // tem" (review.js, `nm.same_as`). Ele não está no molde JSON principal —
    // vive no `reencontroBlock`, que só aparece quando o item já tem sentidos.
    // Foi assim que passou pela primeira conferência: eu fatiei só o molde.
    // A lição está no `_esqConfere`: conferir a FUNÇÃO INTEIRA, não o molde.
    same_as: S.txtOuNulo(),
    synonyms: S.lista(S.txt()), antonyms: S.lista(S.txt()), forms: S.lista(S.txt()),
    grammar: S.txt(), collocations: S.lista(S.txt()), confusoes: S.lista(S.txt()),
    armadilha: S.lista(S.txt()), curiosidade: S.lista(S.txt()), registro_uso: S.txt(),
    examples: S.lista(S.obj({ en: S.txt(), pt: S.txt() }))
  }))
})

// COMPLETAR MATERIAL — os campos que faltavam num sentido já existente.
ESQ.completar = S.obj({
  citacao: S.txt(), forms: S.lista(S.txt()), grammar: S.txt(),
  collocations: S.lista(S.txt()), confusoes: S.lista(S.txt()),
  armadilha: S.lista(S.txt()), curiosidade: S.lista(S.txt()), registro_uso: S.txt()
})

// OS OUTROS SENTIDOS do mesmo item (o "mais sentidos" do Estudar).
ESQ.sentidos = S.obj({
  meanings: S.lista(S.obj({
    meaning_pt: S.txt(), definition_pt: S.txt(), type_label: S.txt(),
    register: S.ou(['neutral','formal','informal','colloquial','slang','technical','literary','archaic','vulgar']),
    level: S.ou(['A2', 'B1', 'B2', 'C1', 'C2']),
    examples: S.lista(S.obj({ en: S.txt(), pt: S.txt() }))
  }))
})

// A FAMÍLIA do item: classe, conjugação e tudo que orbita em volta.
ESQ.familia = S.obj({
  classe: S.txt(),
  conjugacao: S.lista(S.obj({ rotulo: S.txt(), forma: S.txt(), exemplo: S.txt() })),
  familia: S.lista(S.obj({
    expr: S.txt(),
    tipo: S.ou(['phrasal_verb', 'idiom', 'collocation', 'chunk', 'derivada']),
    gloss: S.txt(), nivel: S.ou(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  }))
})

// A QUEBRA DO TRECHO — os chips. O `type` aqui era o caso mais gritante: o
// código recebia "colocação" em vez de "collocation" e caía num default mudo.
ESQ.quebra = S.obj({
  trad: S.txt(),
  items: S.lista(S.obj({
    expr: S.txt(),
    type: S.ou(['word', 'phrasal_verb', 'idiom', 'collocation', 'chunk']),
    gloss: S.txt(), nivel: S.ou(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  }))
})

// A SEMENTE DAS CAPTURAS — a glosa que cada uma tem na própria frase.
ESQ.sementes = S.obj({
  itens: S.lista(S.obj({ n: S.num(), gloss: S.txt() }))
})

// O TÍTULO LIMPO DA OBRA.
ESQ.obras = S.obj({
  obras: S.lista(S.obj({ bruto: S.txt(), titulo: S.txt(), autor: S.txt() }))
})

// A CORREÇÃO DA FRASE QUE ELE ESCREVEU (bloco "Produza", no Estudar).
ESQ.produzir = S.obj({
  ok: S.bool(), corrigida: S.txt(), comentario: S.txt(), registro: S.txt()
})

// ⚠️ A REDE CONTRA O ESQUECIMENTO. Compara as chaves citadas no prompt com as
// chaves do esquema. Se eu acrescentar um campo ao prompt e esquecer aqui, o
// modo estrito o proibiria em silêncio — e o app perderia o dado sem nenhum
// erro. Só roda quando pedido (testes/console).
//
// ⚠️⚠️ PASSE A FUNÇÃO INTEIRA, NUNCA SÓ O MOLDE JSON. Esta rede já falhou uma
// vez por isso: o `same_as` da análise não mora no molde, mora num bloco
// condicional (`reencontroBlock`) montado antes dele. Fatiando só o molde, ele
// não aparecia — e o esquema o teria banido calado.
// A varredura é grosseira de propósito (qualquer `"chave":` no texto), então
// ela também acusa exemplos dentro das instruções. Falso positivo aqui custa
// dez segundos de leitura; falso negativo custa um campo perdido em produção.
function _esqConfere(prompt, esquema) {
  const doPrompt = new Set((String(prompt).match(/"([a-z_]+)"\s*:/g) || [])
    .map(x => x.replace(/"|:|\s/g, '')))
  const doEsquema = new Set()
  const anda = e => {
    if (!e || typeof e !== 'object') return
    if (e.properties) { Object.keys(e.properties).forEach(k => { doEsquema.add(k); anda(e.properties[k]) }) }
    if (e.items) anda(e.items)
  }
  anda(esquema)
  return { faltando: [...doPrompt].filter(k => !doEsquema.has(k)), sobrando: [...doEsquema].filter(k => !doPrompt.has(k)) }
}

// Chat que retorna JSON. Aceita string única ou array de mensagens.
// Passe `schema` (use o helper `S`) para exigir a forma; sem ele, o
// comportamento é o de antes.
// Três camadas, em ordem de garantia:
//   1) 'schema'  — `json_schema` estrito. Só onde o fornecedor sustenta.
//   2) 'objeto'  — `json_object`: JSON válido, forma por conta do prompt.
//   3) 'texto'   — sem `response_format`, extraindo o JSON de dentro do texto.
// E, por fim, a repescagem na OpenAI se o fornecedor ativo for outro.
// ⚠️ A camada 3 não é herança morta do DeepSeek: qualquer modelo pode
// devolver o JSON embrulhado em ```json quando o formato é recusado, e é ela
// que evita perder uma chamada já paga.
// O fallback é SILENCIOSO por natureza — e silêncio aqui engana a conta: você
// escolhe o Gemini, ele falha em toda chamada, e o app cobra OpenAI sem
// você saber. Um aviso por sessão (não por chamada, senão vira spam).
let _aiFallbackAvisado = false
function _aiAvisarFallback(nome, modelo, motivo) {
  if (_aiFallbackAvisado) return
  _aiFallbackAvisado = true
  if (typeof toast !== 'function') return
  toast(`${nome} (${modelo}) não respondeu — o app seguiu pela OpenAI. Motivo: ${String(motivo).slice(0, 90)}`, 'warning')
}

// "resposta vazia ou fora do formato" era verdade e não servia para nada — as
// causas exigem ações opostas. Esta função olha o que a API DE FATO devolveu e
// diz qual delas foi. O caso `length` é o mais traiçoeiro: a chamada foi
// COBRADA (entrada + raciocínio) e não trouxe texto nenhum.
function _aiPorQueVazio(dados) {
  const c = dados?.choices?.[0]
  const fim = c?.finish_reason || c?.finishReason || ''
  const uso = dados?.usage || {}
  const rac = uso.completion_tokens_details?.reasoning_tokens
  if (fim === 'length') {
    return rac
      ? `o teto de tokens acabou durante o raciocínio (${rac} tokens pensando, nada de texto) — a chamada foi cobrada mesmo assim`
      : 'a resposta foi cortada no meio pelo teto de tokens'
  }
  if (fim === 'content_filter') return 'o filtro de conteúdo do fornecedor barrou a resposta'
  if (c?.message?.refusal) return 'o modelo recusou: ' + String(c.message.refusal).slice(0, 140)
  if (dados?.error?.message) return String(dados.error.message).slice(0, 180)
  if (c?.message?.content) return 'a resposta veio, mas não era JSON válido'
  return 'a IA devolveu uma resposta vazia ou fora do formato'
}

function _aiFormato(modo, schema, nome) {
  if (modo === 'schema') {
    return { response_format: { type: 'json_schema',
      json_schema: { name: nome || 'resposta', strict: true, schema } } }
  }
  if (modo === 'objeto') return { response_format: { type: 'json_object' } }
  return {}
}

// ================================================================
// VISÃO — mandar uma IMAGEM e receber JSON
// ================================================================
// Os três fornecedores falam o mesmo dialeto aqui (o formato da OpenAI), então
// isto é só o invólucro que monta a mensagem multimodal — quem chama, tenta os
// modos de JSON e cai para o reserva continua sendo `aiJSON`.
//
// ⚠️ `maxTokens` FOLGADO de propósito. A resposta útil são ~250 tokens, mas os
// modelos que raciocinam gastam do MESMO orçamento antes de escrever: se o
// teto acaba no meio do raciocínio, volta `finish_reason: length` com conteúdo
// VAZIO — paga-se a imagem inteira e não vem nada. Foi assim que a leitura do
// capítulo morreu uma vez (ver comentário em `_aiRaciocina`). O teto é LIMITE,
// não reserva: a folga não custa nada a quem não usa.
async function aiVisaoJSON(pedido, base64, { maxTokens = 8000, model, timeoutMs = 90000, retries = 1, mime = 'image/jpeg', temperature = 0 } = {}) {
  return aiJSON([{ role: 'user', content: [
    { type: 'text', text: pedido },
    { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
  ]}], { maxTokens, model, timeoutMs, retries, temperature })
}

async function aiJSON(messages, { maxTokens, model, timeoutMs, retries, schema, schemaNome, temperature } = {}) {
  const chat = aiChatCfg()
  if (!chat.key) throw new Error('Chave da ' + chat.P.nome + ' não configurada (Configurações → IA)')
  const m = model || chat.model
  const msgs = typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages
  const corpo = (mod, modo) => ({
    model: mod,
    ..._aiFormato(modo, schema, schemaNome),
    messages: msgs,
    // Só entra quando pedida: os modelos que raciocinam RECUSAM temperatura
    // diferente de 1, e mandá-la sempre quebraria as chamadas de análise.
    ...(typeof temperature === 'number' && !_aiRaciocina(mod) ? { temperature } : {}),
    ..._aiTokenParam(mod, maxTokens)
  })
  // O modo estrito só entra quando HÁ esquema e o fornecedor o sustenta.
  const modos = (schema && chat.P.json === 'schema') ? ['schema', 'objeto', 'texto'] : ['objeto', 'texto']
  let erro = null
  for (const modo of modos) {
    try {
      const res = await _aiFetch(chat.P.url, corpo(m, modo), { timeoutMs, retries, key: chat.key })
      const dados = await res.json()
      _aiGuardarUso(dados, m)
      const j = _aiParseJSON(dados)
      if (j) return j
      erro = new Error(_aiPorQueVazio(dados))
    } catch (e) {
      erro = e
      // ⚠️ ESQUEMA RECUSADO É ERRO MEU, NÃO DO MODELO — e cair calado para o
      // modo frouxo esconderia justamente a garantia que fui buscar. O aviso
      // deixa isso visível no console em vez de virar "às vezes vem torto".
      if (modo === 'schema') {
        console.warn(`[ai] esquema "${schemaNome || 'resposta'}" recusado, seguindo sem contrato de forma:`, e.message)
      }
    }
  }
  if (chat.prov !== 'openai' && cfg.openaiKey) {
    try {
      const res = await _aiFetch('https://api.openai.com/v1/chat/completions',
        corpo(AI_DEFAULT_MODEL, schema ? 'schema' : 'objeto'), { timeoutMs, retries: 1, key: cfg.openaiKey })
      const j = _aiParseJSON(await res.json())
      if (j) {
        // O MOTIVO junto: sem ele, "não respondeu" some no console e não dá
        // para saber se foi chave, cota, modelo descontinuado ou JSON quebrado
        // — foi exatamente o que aconteceu no teste comparativo de 06/08.
        const motivo = (erro && erro.message) || 'resposta vazia ou fora do formato'
        console.warn(`[ai] JSON pelo fallback OpenAI — ${chat.P.nome} (${m}) não respondeu.`, 'Motivo:', motivo)
        _aiAvisarFallback(chat.P.nome, m, motivo)
        return j
      }
    } catch (e) { erro = erro || e }
  }
  throw new Error(`[${chat.P.nome}] ${erro ? erro.message : 'não retornou um JSON válido'}`)
}

// Chat de texto puro (respostas curtas, sem JSON).
async function aiText(messages, { maxTokens, model, timeoutMs, retries } = {}) {
  const chat = aiChatCfg()
  if (!chat.key) throw new Error('Chave da ' + chat.P.nome + ' não configurada (Configurações → IA)')
  const m = model || chat.model
  const msgs = typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages
  const res = await _aiFetch(chat.P.url, {
    model: m, messages: msgs, ..._aiTokenParam(m, maxTokens)
  }, { timeoutMs, retries, key: chat.key })
  const data = await res.json()
  _aiGuardarUso(data, m)
  const msg = data.choices?.[0]?.message || {}
  // `reasoning_content`: modelos que "pensam" às vezes gastam todo o orçamento
  // no raciocínio e devolvem content vazio — melhor mostrar o que veio.
  return String(msg.content || msg.reasoning_content || '').trim()
}

// Texto com REDE DE SEGURANÇA: se o fornecedor ativo devolver vazio ou falhar,
// repete na OpenAI quando há chave. É o que garante que "Explicar" nunca fique
// mudo. Continua valendo com a OpenAI de padrão — a rede é para quem escolheu
// Gemini ou Groq, e resposta vazia não é privilégio de fornecedor nenhum
// (teto de tokens estourado no raciocínio devolve vazio em qualquer um).
async function aiTextSeguro(messages, opts = {}) {
  let erro = null
  try {
    const r = await aiText(messages, opts)
    if (r) return r
  } catch (e) { erro = e }
  if (aiProviderAtual() !== 'openai' && cfg.openaiKey) {
    try {
      const res = await _aiFetch('https://api.openai.com/v1/chat/completions', {
        model: AI_DEFAULT_MODEL,
        messages: typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages,
        ..._aiTokenParam(AI_DEFAULT_MODEL, opts.maxTokens)
      }, { timeoutMs: opts.timeoutMs, retries: 1, key: cfg.openaiKey })
      const data = await res.json()
      const t = String(data.choices?.[0]?.message?.content || '').trim()
      if (t) return t
    } catch (e) { erro = erro || e }
  }
  throw erro || new Error('a IA devolveu uma resposta vazia')
}

// TTS — tenta o gpt-4o-mini-tts (mais barato, aceita instrução de estilo);
// se a conta/modelo recusar, cai no tts-1 clássico na mesma chamada.
// O resultado é cacheado por texto no AudioDB, então o fallback custa
// no máximo uma tentativa extra por frase nova.
const AI_TTS_MODEL = 'gpt-4o-mini-tts'
const AI_TTS_FALLBACK = 'tts-1'
async function aiTTS(text, { voice, speed = 0.9, timeoutMs = 60000 } = {}) {
  if (!cfg.openaiKey) throw new Error('Chave da OpenAI não configurada')
  const v = voice || randomVoice()
  try {
    const res = await _aiFetch('https://api.openai.com/v1/audio/speech', {
      model: AI_TTS_MODEL, input: text, voice: v,
      instructions: 'Speak clearly at a slightly slow pace, for a language learner.'
    }, { timeoutMs, retries: 0 })
    return blobToBase64(await res.blob())
  } catch (e) {
    // O tts-1 não conhece as vozes novas (ballad/verse/marin/cedar): mandar
    // uma delas aqui daria 400 e o card ficaria mudo. Troca por uma clássica.
    const vLegada = (typeof vozLegada === 'function') ? vozLegada(v) : v
    const res = await _aiFetch('https://api.openai.com/v1/audio/speech', {
      model: AI_TTS_FALLBACK, input: text, voice: vLegada, speed
    }, { timeoutMs, retries: 1 })
    return blobToBase64(await res.blob())
  }
}

// ---- IMAGENS ---------------------------------------------------
// Dois fornecedores, três níveis cada (cfg.imgProvider + cfg.imgQuality).
// Preços por imagem 1024×1024, tabela de ago/2026. O Gemini NÃO entra pela
// camada compatível com a OpenAI — tem endpoint e formato próprios.
const AI_IMG = {
  openai: {
    nome: 'OpenAI', keyCfg: 'openaiKey',
    niveis: {
      // gpt-image-2 (abr/2026). Preços POR IMAGEM em 1024×1024, da tabela
      // oficial — e aqui eles são cotados, não derivados como no gpt-image-1
      // (que publicava só US$ 40/1M e obrigava a multiplicar pelos tokens de
      // cada qualidade: 272 / 1.056 / 4.160).
      //
      // A troca vale porque o app usa 'low' por padrão, e nessa faixa o
      // image-2 é 45% MAIS BARATO (0,006 contra 0,011). Nas outras duas ele
      // é ~26% mais caro — não por tarifa (a saída caiu de US$ 40 para 30/1M)
      // mas porque emite mais tokens: são imagens maiores de verdade.
      // ⚠️ No 'low' ele emite MENOS que o image-1 (~200 contra 272 tokens),
      // então parte da economia vem de peso. Se a ilustração ficar pobre
      // demais, o caminho é subir para 'medium', não voltar ao image-1.
      low:    { model: 'gpt-image-2', quality: 'low',    usd: 0.006, rotulo: 'Econômica' },
      medium: { model: 'gpt-image-2', quality: 'medium', usd: 0.053, rotulo: 'Padrão' },
      high:   { model: 'gpt-image-2', quality: 'high',   usd: 0.211, rotulo: 'Alta' }
    }
  },
  gemini: {
    nome: 'Google Gemini', keyCfg: 'geminiKey',
    niveis: {
      // O nível barato NÃO é mais o 2.5-flash-image: o Lite (jun/2026) é ao
      // mesmo tempo mais novo E mais barato (0,0336 < 0,039). Manter o 2.5 era
      // pagar mais por uma geração anterior. O 2.5 saiu do catálogo por isso.
      // Imagen 4 Fast custa 0,02 e parece tentador — mas está DEPRECIADO e o
      // Google desliga em 17/ago/2026. Entrar nele hoje é quebrar em 11 dias.
      low:    { model: 'gemini-3.1-flash-lite-image', usd: 0.0336, rotulo: 'Nano Banana 2 Lite (3.1 Flash Lite)' },
      medium: { model: 'gemini-3.1-flash-image',      usd: 0.067,  rotulo: 'Nano Banana 2 (3.1 Flash)' },
      high:   { model: 'gemini-3-pro-image',          usd: 0.134,  rotulo: 'Nano Banana Pro (3 Pro)' }
    }
  }
}

function aiImgProvider() { return AI_IMG[cfg.imgProvider] ? cfg.imgProvider : 'openai' }
// Chave do fornecedor de IMAGENS ativo (vazia = não dá para gerar)
function aiImgKey() { return (cfg[AI_IMG[aiImgProvider()].keyCfg] || '').trim() }
function aiImgNivel(quality) {
  const P = AI_IMG[aiImgProvider()]
  // Padrão 'low' (e não 'medium'): imagem de card de vocabulário não precisa
  // de resolução alta, e o salto medium/high multiplica a conta por 1,7 e 3,4.
  const q = quality || cfg.imgQuality || 'low'
  return { prov: aiImgProvider(), P, q, ...(P.niveis[q] || P.niveis.low) }
}

// Imagem — retorna data URL base64 (contrato usado por audio.js/study).
async function aiImage(prompt, { size = '1024x1024', quality, timeoutMs = 180000 } = {}) {
  const n = aiImgNivel(quality)
  const key = (cfg[n.P.keyCfg] || '').trim()
  if (!key) throw new Error(`Chave da ${n.P.nome} não configurada (Configurações → IA)`)
  // Qual nível está REALMENTE valendo — o "gerei no baixo e veio caro" nasceu
  // de o app cair no médio em silêncio (imgQuality faltava no DEF_CFG).
  console.info(`[img] nível "${n.q}" · ${n.P.nome} · ${n.model || n.quality} · US$ ${n.usd}/imagem`)
  return n.prov === 'gemini'
    ? _aiImageGemini(prompt, n.model, key, timeoutMs, n)
    : _aiImageOpenAI(prompt, n.quality, size, timeoutMs, n.model)
}

// ⚠️ O `model` vinha HARDCODED aqui, o que tornava o campo `model` do catálogo
// OpenAI puramente decorativo: trocar lá não mudava nada, e o preço exibido
// podia divergir do modelo realmente chamado. Agora o catálogo manda.
async function _aiImageOpenAI(prompt, quality, size, timeoutMs, modelo) {
  const res = await _aiFetch('https://api.openai.com/v1/images/generations', {
    model: modelo || 'gpt-image-2', prompt, n: 1, size, quality
  }, { timeoutMs, retries: 1 })
  const data = await res.json()
  if (data.data?.[0]?.b64_json) return 'data:image/png;base64,' + data.data[0].b64_json
  // fallback para modelos legados que retornam URL
  const blob = await (await fetch(data.data[0].url)).blob()
  return blobToBase64(blob)
}

// O Gemini tem DUAS rotas para gerar imagem: a clássica `:generateContent` e
// a nova `/interactions`. Tenta a clássica e cai na nova se o modelo só
// existir lá — assim um modelo novo não quebra a geração.
async function _aiImageGemini(prompt, model, key, timeoutMs, n2) {
  const tentativas = [
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      // 'IMAGE' MAIÚSCULO: é enum na API. 'Image' podia passar por sorte hoje
      // e virar 400 amanhã — e 400 aqui manda a geração para a outra rota.
      body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }
    },
    {
      url: 'https://generativelanguage.googleapis.com/v1beta/interactions',
      // `image_size: '1K'` EXPLÍCITO: no 3.1-flash-image o preço sobe com o
      // tamanho (0,067 em 1K → 0,101 em 2K → 0,151 em 4K). Sem fixar, um
      // padrão maior do Google viraria fatura maior sem ninguém escolher.
      body: {
        model,
        input: [{ type: 'text', text: prompt }],
        response_format: { type: 'image', mime_type: 'image/png', image_size: '1K' }
      }
    }
  ]
  let ultimoErro = null
  for (const t of tentativas) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      const res = await fetch(t.url, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(t.body), signal: ctl.signal
      })
      if (!res.ok) {
        let m = 'HTTP ' + res.status
        try { const e = await res.json(); if (e.error?.message) m = e.error.message } catch {}
        ultimoErro = new Error(`[Gemini] ${m}`)
        if (res.status === 404 || res.status === 400) continue   // rota/modelo não existe aqui: tenta a outra
        throw ultimoErro
      }
      const rota = t.url.includes('interactions') ? 'interactions' : 'generateContent'
      const json = await res.json()
      const img = _aiGeminiImgDaResposta(json)
      if (img) { console.info(`[img] ${model} via ${rota} — US$ ${n2 ? n2.usd : '?'}`); return img }

      // 200 sem imagem tem DOIS motivos muito diferentes:
      const motivo = _aiGeminiMotivoSemImagem(json)
      if (motivo.recusa) {
        // Recusa declarada: nada foi entregue e repetir na outra rota daria a
        // mesma recusa — só gastaria de novo. Para aqui, e diz o porquê.
        throw new Error(`[Gemini] imagem não gerada: ${motivo.texto}`)
      }
      // Formato que não reconheço: aí o erro é NOSSO, e a outra rota pode
      // salvar. Loga a forma da resposta para o parser ser corrigido depois.
      console.warn(`[img] ${rota} respondeu 200 sem imagem reconhecível. Campos:`,
        Object.keys(json || {}).join(', '), json)
      ultimoErro = new Error(`[Gemini] ${motivo.texto}`)
    } catch (e) {
      ultimoErro = e.name === 'AbortError' ? new Error('[Gemini] tempo esgotado ao gerar a imagem') : e
    } finally { clearTimeout(timer) }
  }
  throw ultimoErro || new Error('[Gemini] falha ao gerar a imagem')
}

// Aceita os dois formatos de resposta (parts[].inlineData e output_image)
function _aiGeminiImgDaResposta(j) {
  // 1) rota clássica :generateContent
  const parts = j?.candidates?.[0]?.content?.parts || []
  for (const p of parts) {
    const inline = p.inlineData || p.inline_data
    if (inline?.data) return `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,` + inline.data
  }
  // 2) /interactions — atalho de conveniência
  const oi = j?.output_image || j?.outputImage
  if (oi?.data) return `data:${oi.mime_type || oi.mimeType || 'image/png'};base64,` + oi.data
  // 3) /interactions — o formato REAL do REST: um array `steps`, cada um com
  //    blocos de conteúdo. FALTAVA aqui, e era isto que fazia "algumas imagens
  //    não serem geradas": a chamada dava 200, a imagem vinha, e o parser não
  //    sabia onde procurar. `output` era chute; a doc diz `steps`.
  for (const st of (j?.steps || [])) {
    for (const c of (st?.content || st?.blocks || [])) {
      if (c?.data && (c.type === 'image' || String(c.mime_type || c.mimeType || '').startsWith('image/'))) {
        return `data:${c.mime_type || c.mimeType || 'image/png'};base64,` + c.data
      }
    }
  }
  // 4) formato antigo que já estava aqui — mantido por segurança
  for (const o of (j?.output || [])) {
    if (o?.data && (o.type === 'image' || o.mime_type?.startsWith('image/'))) {
      return `data:${o.mime_type || 'image/png'};base64,` + o.data
    }
  }
  return null
}

// Por que NÃO veio imagem: recusa de segurança tem motivo declarado e não
// adianta repetir; formato desconhecido é bug nosso e vale tentar a outra
// rota. Distinguir os dois é o que separa "explique ao usuário" de "insista".
function _aiGeminiMotivoSemImagem(j) {
  const bloqueio = j?.promptFeedback?.blockReason || j?.prompt_feedback?.block_reason
  const fim = j?.candidates?.[0]?.finishReason || j?.candidates?.[0]?.finish_reason
  const recusaFim = fim && !/^STOP$/i.test(fim)
  if (bloqueio || recusaFim) {
    const cod = bloqueio || fim
    const humano = {
      SAFETY: 'a cena foi barrada pelo filtro de segurança do Google',
      IMAGE_SAFETY: 'a imagem foi barrada pelo filtro de segurança do Google',
      PROHIBITED_CONTENT: 'o conteúdo é proibido pela política do Google',
      BLOCKLIST: 'o prompt caiu numa lista de termos bloqueados',
      RECITATION: 'a resposta foi barrada por semelhança com material protegido',
      OTHER: 'o Google recusou sem detalhar o motivo'
    }[String(cod).toUpperCase()] || `o Google recusou (${cod})`
    return { recusa: true, texto: humano }
  }
  return { recusa: false, texto: 'a resposta veio 200 mas sem imagem num formato que eu reconheça' }
}

// Teste de chave POR FORNECEDOR: GET /models não consome token nenhum.
async function aiTestKeyProv(prov, key) {
  const P = AI_PROVIDERS[prov]
  if (!P) return { ok: false, msg: 'fornecedor desconhecido' }
  try {
    const res = await fetch(P.modelsUrl, { headers: { 'Authorization': `Bearer ${key}` } })
    if (res.ok) return { ok: true }
    let msg = 'HTTP ' + res.status
    try { const e = await res.json(); if (e.error?.message) msg = e.error.message } catch {}
    return { ok: false, msg }
  } catch (e) { return { ok: false, msg: e.message } }
}

// Teste de chave: GET /v1/models não consome token nenhum.
async function aiTestKey(key) {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${key || cfg.openaiKey}` }
  })
  if (res.ok) return { ok: true }
  let msg = 'HTTP ' + res.status
  try { const e = await res.json(); if (e.error?.message) msg = e.error.message } catch {}
  return { ok: false, msg }
}

// ================================================================
// ESTIMATIVA DE CUSTO para operações em lote — exibida em REAIS.
// A OpenAI cobra em dólar; convertemos com a cotação comercial do dia
// (AwesomeAPI, gratuita, cacheada por 24h) e caímos num câmbio fixo se
// a consulta falhar. Ordens de grandeza, não fatura.
// ================================================================
const AI_COST = {
  // gpt-4o-mini-tts cobra ~US$ 0,015 por MINUTO de áudio gerado; a frase de um
  // card tem ~5s. O valor antigo (0,008) vinha da tabela por caractere do
  // tts-1 e superestimava a conta em ~6×.
  tts:   0.015 * (5 / 60)                           // ≈ US$ 0,00125 por frase falada
  // imagens: preço por nível vive em AI_IMG (varia com o fornecedor escolhido)
}

// ---- TRANSCRIÇÃO (fala → texto) --------------------------------
// A Groq roda o MESMO Whisper num endpoint idêntico ao da OpenAI
// (api.groq.com/openai/v1/audio/transcriptions, verbose_json com
// timestamps) por US$ 0,04/h contra US$ 0,36/h — 9× mais barato.
// Por isso o padrão é "auto": usa a Groq quando há chave, senão OpenAI.
const AI_STT = {
  groq:   { nome: 'Groq', url: 'https://api.groq.com/openai/v1/audio/transcriptions',
            model: 'whisper-large-v3-turbo', keyCfg: 'groqKey', usdMin: 0.04 / 60, limiteMB: 25 },
  openai: { nome: 'OpenAI', url: 'https://api.openai.com/v1/audio/transcriptions',
            model: 'whisper-1', keyCfg: 'openaiKey', usdMin: 0.006, limiteMB: 25 }
}

// Qual fornecedor transcreve agora (cfg.sttProvider: 'auto' | 'groq' | 'openai')
function aiSttCfg() {
  const pref = cfg.sttProvider || 'auto'
  const tem = p => !!(cfg[AI_STT[p].keyCfg] || '').trim()
  const prov = (pref !== 'auto' && tem(pref)) ? pref
    : tem('groq') ? 'groq'
    : tem('openai') ? 'openai'
    : null
  return prov ? { prov, ...AI_STT[prov], key: cfg[AI_STT[prov].keyCfg].trim() } : null
}

// Transcrição única para todo o app (legenda inteira, sincronia, shadowing).
// `granular`: pede os tempos por segmento (verbose_json).
async function aiTranscribe(blob, { nome = 'audio.webm', lang, granular = true, timeoutMs = 120000 } = {}) {
  const stt = aiSttCfg()
  if (!stt) throw new Error('Configure a chave da Groq ou da OpenAI para transcrever (Configurações → IA)')
  const fd = new FormData()
  fd.append('file', blob, nome)
  fd.append('model', stt.model)
  if (granular) fd.append('response_format', 'verbose_json')
  if (lang) fd.append('language', lang)
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(stt.url, {
      method: 'POST', headers: { 'Authorization': `Bearer ${stt.key}` }, body: fd, signal: ctl.signal
    })
    if (!res.ok) {
      let m = 'HTTP ' + res.status
      try { const e = await res.json(); if (e.error?.message) m = e.error.message } catch {}
      throw new Error(`[${stt.nome}] ${m}`)
    }
    return await res.json()
  } finally { clearTimeout(timer) }
}

// Tokens médios de UMA análise de item (prompt do card + resposta), medidos
// nos lotes reais do app. Multiplicados pelo preço do MODELO ATIVO — é isso
// que faz a estimativa acompanhar a troca de modelo/fornecedor (antes o custo
// de chat era um número fixo calibrado no gpt-4o-mini).
const AI_TOKENS_ITEM = { in: 1800, out: 900 }

// Preço (US$/1M tokens) do modelo indicado, procurado em todos os fornecedores.
function aiPrecoModelo(id) {
  const alvo = id || aiModel()
  for (const P of Object.values(AI_PROVIDERS)) {
    const m = (P.modelos || []).find(x => x.id === alvo)
    if (m && m.preco) return m.preco
  }
  return { in: 0.15, out: 0.60 }        // desconhecido: assume o preço do mini
}

// Custo em dólar de `n` análises no modelo ativo.
function aiCustoChatUsd(n = 1) {
  const p = aiPrecoModelo()
  return n * (AI_TOKENS_ITEM.in * p.in + AI_TOKENS_ITEM.out * p.out) / 1e6
}
const AI_USD_BRL_FALLBACK = 5.5
const SK_USD_BRL = 'el-usd-brl'

async function aiUsdBrl() {
  try {
    const cache = JSON.parse(localStorage.getItem(SK_USD_BRL) || 'null')
    if (cache && Date.now() - cache.at < 24 * 3600e3) return cache.rate
  } catch {}
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 3500)
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', { signal: ctl.signal })
    clearTimeout(t)
    const j = await res.json()
    const rate = parseFloat(j?.USDBRL?.bid)
    if (rate > 0) {
      try { localStorage.setItem(SK_USD_BRL, JSON.stringify({ rate, at: Date.now() })) } catch {}
      return rate
    }
  } catch {}
  try {
    const velho = JSON.parse(localStorage.getItem(SK_USD_BRL) || 'null')
    if (velho?.rate > 0) return velho.rate           // cotação vencida > chute fixo
  } catch {}
  return AI_USD_BRL_FALLBACK
}

function _aiUnitUsd(tipo) {
  // Cada imagem custa também a chamada de texto que descreve a cena
  // (buildImageScene, em audio.js) — ~2% do total, mas entra na conta.
  if (tipo === 'image') return aiImgNivel().usd + aiCustoChatUsd(1)
  if (tipo === 'chat') return aiCustoChatUsd(1)
  return AI_COST[tipo] || 0.001
}

function _brl(v) { return 'R$ ' + (v < 0.01 ? '0,01' : v.toFixed(2).replace('.', ',')) }

// Mantida para exibições avulsas — agora precisa da cotação, então é async.
async function aiEstimate(tipo, n) {
  const usd = _aiUnitUsd(tipo) * n
  return _brl(usd * await aiUsdBrl())
}

// Confirmação antes de um lote que custa dinheiro — modal de verdade,
// com o detalhamento em reais. Lotes < ~R$ 0,12 não interrompem
// (confirmar centavos é atrito).
async function aiConfirmBatch(tipo, n, rotulo, opts = {}) {
  const usd = _aiUnitUsd(tipo) * n
  // "sempre": operações que REESCREVEM conteúdo confirmam mesmo custando centavos.
  if (usd < 0.022 && !opts.sempre) return true
  const rate = await aiUsdBrl()
  const total = usd * rate
  const NOMES = { chat: 'Análise com IA', tts: 'Geração de áudio (TTS)', image: 'Geração de imagens' }
  const ni = aiImgNivel()
  const detalheModelo = tipo === 'chat' ? `${aiChatCfg().P.nome} · ${aiModel()}`
    : tipo === 'tts' ? `OpenAI · ${AI_TTS_MODEL}`
    : `${ni.P.nome} · ${ni.model}${ni.quality ? ' · ' + ni.rotulo.toLowerCase() : ''}`
  // De onde sai a conta — o Djemeson pediu para entender a origem do número
  const pm = aiPrecoModelo()
  const base = tipo === 'chat'
    ? `~${AI_TOKENS_ITEM.in} tokens de entrada + ~${AI_TOKENS_ITEM.out} de saída por item, ao preço deste modelo (US$ ${pm.in}/${pm.out} por 1M)`
    : tipo === 'tts' ? 'US$ 0,015 por minuto de áudio (gpt-4o-mini-tts) × ~5s por frase'
    : `US$ ${ni.usd.toFixed(3)} por imagem 1024×1024 + a chamada de texto que descreve a cena`
  return confirmModal({
    title: rotulo || NOMES[tipo] || 'Operação com IA',
    icon: 'sparkles',
    confirmText: 'Continuar — ' + _brl(total),
    html: `
      <div class="cost-rows">
        <div class="cost-row"><span>Operação</span><b>${esc(NOMES[tipo] || tipo)}</b></div>
        <div class="cost-row"><span>Chamadas</span><b>${n}</b></div>
        <div class="cost-row"><span>Modelo</span><b>${esc(detalheModelo)}</b></div>
        <div class="cost-row"><span>Base do cálculo</span><b>${esc(base)}</b></div>
        <div class="cost-row total"><span>Custo estimado</span><b>${_brl(total)}</b></div>
      </div>
      ${opts.detalhe ? `<ul class="cost-bullets">${opts.detalhe.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      <p class="cost-note">Estimativa pela cotação de hoje (US$ 1 ≈ R$ ${rate.toFixed(2).replace('.', ',')}) — muda junto com o modelo escolhido. A cobrança real é feita pelo fornecedor, em dólar, na sua conta.</p>`
  })
}

// ---- CONSUMO REAL -----------------------------------------------
// Estimativa de custo é palpite; `usage` é fato. E para modelo que raciocina a
// diferença não é detalhe: os tokens de RACIOCÍNIO são cobrados como SAÍDA (o
// lado caro), e nenhuma estimativa baseada no texto visível os enxerga. Na
// leitura de capítulo com o Luna a conta estimada ficava entre 1,8× e 6,7×
// abaixo do real, dependendo de quanto ele pensasse.
//
// Todo caminho que fala com a API passa o `usage` por aqui. Quem quiser saber
// o preço de uma operação inteira chama `aiUsoZerar()` antes e
// `aiUsoAcumulado()` depois — vale para lote de N chamadas.
let _aiUso = { in: 0, out: 0, raciocinio: 0, cache: 0, chamadas: 0, model: '' }

function aiUsoZerar() { _aiUso = { in: 0, out: 0, raciocinio: 0, cache: 0, chamadas: 0, model: '' } }
function aiUsoAcumulado() { return { ..._aiUso } }

function _aiGuardarUso(dados, model) {
  const u = dados && dados.usage
  if (!u) return
  const rac = u.completion_tokens_details?.reasoning_tokens
           || u.output_tokens_details?.reasoning_tokens || 0
  const cache = u.prompt_tokens_details?.cached_tokens || u.prompt_cache_hit_tokens || 0
  _aiUso.in += Number(u.prompt_tokens || u.input_tokens || 0)
  _aiUso.out += Number(u.completion_tokens || u.output_tokens || 0)
  _aiUso.raciocinio += Number(rac)
  _aiUso.cache += Number(cache)
  _aiUso.chamadas++
  _aiUso.model = model || _aiUso.model
}

// Custo em dólar a partir do consumo MEDIDO. `completion_tokens` já inclui os
// de raciocínio (a OpenAI os soma ali), então não se conta duas vezes.
function aiCustoDeUso(uso, model) {
  const p = aiPrecoModelo(model || (uso && uso.model))
  if (!p || !uso) return 0
  return ((uso.in || 0) * p.in + (uso.out || 0) * p.out) / 1e6
}
