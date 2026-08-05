// ================================================================
// EPUB — leitor de ZIP + parser do formato (SEM dependência externa)
// ================================================================
// Um .epub é um ZIP com XHTML dentro. Duas peças, nenhuma biblioteca:
//
//   1. ZIP: o navegador já sabe descomprimir DEFLATE nativamente
//      (`DecompressionStream('deflate-raw')`, Chrome 103+). Sobra só ler o
//      diretório central — ~120 linhas. Mesma decisão do kindle-db.js: um
//      projeto sem build não deve baixar 1 MB de JS para abrir um arquivo.
//
//   2. EPUB: META-INF/container.xml aponta o .opf; o .opf traz metadados,
//      manifesto (todos os arquivos) e SPINE (a ordem de leitura). O sumário
//      vem do nav XHTML (EPUB 3) ou do .ncx (EPUB 2) — os dois existem no
//      mundo real, então os dois são lidos.
//
// Tudo aqui é leitura pura, sem tocar no DOM da página: quem monta a tela é
// js/ler.js. Assim este arquivo pode ser testado fora do navegador.
// ================================================================
'use strict'

// ---------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------
const ZIP_EOCD = 0x06054b50
const ZIP_CEN  = 0x02014b50

async function _inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw')
  const w = ds.writable.getWriter()
  w.write(bytes); w.close()
  return new Uint8Array(await new Response(ds.readable).arrayBuffer())
}

// Abre um ZIP e devolve { arquivos: Map(nome → entrada), bytes(nome), texto(nome) }
async function zipAbrir(buffer) {
  const u8 = new Uint8Array(buffer)
  const dv = new DataView(buffer)
  // O EOCD fica no FIM, mas pode ter até 64 KB de comentário depois dele.
  let eocd = -1
  const limite = Math.max(0, u8.length - 65557 - 22)
  for (let i = u8.length - 22; i >= limite; i--) {
    if (dv.getUint32(i, true) === ZIP_EOCD) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('não é um arquivo ZIP (fim do diretório não encontrado)')

  const total = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const arquivos = new Map()
  const nomeDec = new TextDecoder('utf-8')

  for (let i = 0; i < total; i++) {
    if (dv.getUint32(p, true) !== ZIP_CEN) break
    const metodo   = dv.getUint16(p + 10, true)
    const compSize = dv.getUint32(p + 20, true)
    const rawSize  = dv.getUint32(p + 24, true)
    const nLen     = dv.getUint16(p + 28, true)
    const eLen     = dv.getUint16(p + 30, true)
    const cLen     = dv.getUint16(p + 32, true)
    const off      = dv.getUint32(p + 42, true)
    const nome     = nomeDec.decode(u8.subarray(p + 46, p + 46 + nLen))
    arquivos.set(nome, { nome, metodo, compSize, rawSize, off })
    p += 46 + nLen + eLen + cLen
  }

  const cache = new Map()
  async function bytes(nome) {
    if (cache.has(nome)) return cache.get(nome)
    const e = arquivos.get(nome)
    if (!e) return null
    // O tamanho do "extra" do cabeçalho LOCAL costuma diferir do central —
    // por isso ele é lido aqui, e não reaproveitado do diretório.
    const nLen = dv.getUint16(e.off + 26, true)
    const eLen = dv.getUint16(e.off + 28, true)
    const ini = e.off + 30 + nLen + eLen
    const cru = u8.subarray(ini, ini + (e.metodo === 0 ? e.rawSize : e.compSize))
    let out
    if (e.metodo === 0) out = cru
    else if (e.metodo === 8) out = await _inflateRaw(cru)
    else throw new Error(`compressão não suportada (método ${e.metodo}) em ${nome}`)
    cache.set(nome, out)
    return out
  }
  async function texto(nome) {
    const b = await bytes(nome)
    return b ? new TextDecoder('utf-8').decode(b) : null
  }
  return { arquivos, bytes, texto }
}

// ---------------------------------------------------------------
// Caminhos relativos dentro do EPUB (o OPF vive numa subpasta)
// ---------------------------------------------------------------
function _dir(caminho) {
  const i = caminho.lastIndexOf('/')
  return i < 0 ? '' : caminho.slice(0, i + 1)
}
function _resolver(base, rel) {
  if (!rel) return ''
  rel = String(rel).split('#')[0]
  if (!rel) return ''
  if (rel.startsWith('/')) return rel.slice(1)
  const partes = (base + rel).split('/')
  const pilha = []
  for (const s of partes) {
    if (s === '.' || s === '') continue
    if (s === '..') pilha.pop()
    else pilha.push(s)
  }
  return pilha.join('/')
}
function _xml(txt) {
  const d = new DOMParser().parseFromString(txt, 'application/xml')
  // Parser de XML falha calado num arquivo malformado; o HTML aguenta mais.
  if (d.querySelector('parsererror')) return new DOMParser().parseFromString(txt, 'text/html')
  return d
}
// querySelector não lida bem com namespace (dc:title, opf:role) em XML.
function _tag(raiz, nome) {
  return [...raiz.getElementsByTagName('*')].filter(e => e.localName === nome)
}
function _tag1(raiz, nome) { return _tag(raiz, nome)[0] || null }

// ---------------------------------------------------------------
// EPUB
// ---------------------------------------------------------------
// Devolve { titulo, autor, idioma, capaHref, capitulos[], zip, opfDir }
// capitulos[] = ordem REAL de leitura (spine), já com o título do sumário
// quando existe.
async function epubAbrir(buffer) {
  const zip = await zipAbrir(buffer)

  const containerTxt = await zip.texto('META-INF/container.xml')
  if (!containerTxt) throw new Error('não é um EPUB (falta META-INF/container.xml)')
  const rootfile = _tag1(_xml(containerTxt), 'rootfile')
  const opfPath = rootfile && rootfile.getAttribute('full-path')
  if (!opfPath) throw new Error('EPUB sem rootfile no container.xml')

  const opfTxt = await zip.texto(opfPath)
  if (!opfTxt) throw new Error('EPUB aponta para um .opf que não existe: ' + opfPath)
  const opf = _xml(opfTxt)
  const base = _dir(opfPath)

  const meta = _tag1(opf, 'metadata') || opf
  const txtDe = n => { const e = _tag1(meta, n); return e ? e.textContent.trim() : '' }
  const titulo = txtDe('title') || 'Sem título'
  const autor  = txtDe('creator')
  const idioma = (txtDe('language') || 'en').toLowerCase().slice(0, 2)

  // manifesto: id → { href absoluto no zip, tipo, propriedades }
  const itens = new Map()
  const manifesto = _tag1(opf, 'manifest')
  for (const it of (manifesto ? _tag(manifesto, 'item') : [])) {
    const id = it.getAttribute('id')
    if (!id) continue
    itens.set(id, {
      id,
      href: _resolver(base, it.getAttribute('href')),
      tipo: it.getAttribute('media-type') || '',
      props: it.getAttribute('properties') || ''
    })
  }

  // spine: a ordem de leitura
  const spineEl = _tag1(opf, 'spine')
  const capitulos = []
  for (const ref of (spineEl ? _tag(spineEl, 'itemref') : [])) {
    if (ref.getAttribute('linear') === 'no') continue
    const it = itens.get(ref.getAttribute('idref'))
    if (!it || !it.href) continue
    if (it.tipo && !/xhtml|html/i.test(it.tipo)) continue
    capitulos.push({ id: it.id, href: it.href, titulo: '' })
  }
  if (!capitulos.length) throw new Error('EPUB sem capítulos legíveis no spine')

  // ---- sumário: nav (EPUB 3) e, se faltar, NCX (EPUB 2) ----
  const rotulos = new Map()   // href → título
  const navItem = [...itens.values()].find(i => /\bnav\b/.test(i.props))
  if (navItem) {
    const t = await zip.texto(navItem.href)
    if (t) {
      const doc = new DOMParser().parseFromString(t, 'text/html')
      const navBase = _dir(navItem.href)
      let lista = [...doc.querySelectorAll('nav')].find(n =>
        (n.getAttribute('epub:type') || n.getAttribute('type') || '').includes('toc')) || doc
      for (const a of lista.querySelectorAll('a[href]')) {
        const alvo = _resolver(navBase, a.getAttribute('href'))
        const nome = a.textContent.replace(/\s+/g, ' ').trim()
        if (alvo && nome && !rotulos.has(alvo)) rotulos.set(alvo, nome)
      }
    }
  }
  if (!rotulos.size) {
    const ncxId = spineEl && spineEl.getAttribute('toc')
    const ncxItem = (ncxId && itens.get(ncxId)) ||
      [...itens.values()].find(i => /ncx/i.test(i.tipo) || /\.ncx$/i.test(i.href))
    if (ncxItem) {
      const t = await zip.texto(ncxItem.href)
      if (t) {
        const ncxBase = _dir(ncxItem.href)
        for (const p of _tag(_xml(t), 'navPoint')) {
          const c = _tag1(p, 'content')
          const lbl = _tag1(p, 'navLabel')
          const alvo = c && _resolver(ncxBase, c.getAttribute('src'))
          const nome = lbl ? lbl.textContent.replace(/\s+/g, ' ').trim() : ''
          if (alvo && nome && !rotulos.has(alvo)) rotulos.set(alvo, nome)
        }
      }
    }
  }
  capitulos.forEach((c, i) => { c.titulo = rotulos.get(c.href) || `Parte ${i + 1}` })

  // ---- capa ----
  let capaHref = ''
  const porProp = [...itens.values()].find(i => /cover-image/.test(i.props))
  if (porProp) capaHref = porProp.href
  if (!capaHref) {
    const m = _tag(meta, 'meta').find(e => (e.getAttribute('name') || '') === 'cover')
    const it = m && itens.get(m.getAttribute('content'))
    if (it) capaHref = it.href
  }
  if (!capaHref) {
    const img = [...itens.values()].find(i => /^image\//.test(i.tipo) && /cover/i.test(i.href))
    if (img) capaHref = img.href
  }

  return { titulo, autor, idioma, capaHref, capitulos, itens, zip, opfDir: base }
}

// Texto CRU de um capítulo (sem marcação) — usado pela cobertura e pela
// contagem de palavras, onde o HTML só atrapalharia.
function epubTextoLimpo(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,head').forEach(e => e.remove())
  return (doc.body ? doc.body.textContent : '').replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------
// TXT e HTML soltos entram pelo MESMO caminho do EPUB
// ---------------------------------------------------------------
// Um .txt de 400 KB numa página só trava o navegador na hora de paginar,
// então ele é fatiado em "capítulos" — por cabeçalho quando o arquivo tem
// (CHAPTER I, Capítulo 3), senão por tamanho.
function textoParaCapitulos(txt, nomeArquivo) {
  const limpo = String(txt || '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const linhas = limpo.split('\n')
  const cabecalho = /^\s*(chapter|cap[íi]tulo|part[e]?|book|livro)\s+([0-9]+|[ivxlcdm]+\b)/i
  const cortes = []
  linhas.forEach((l, i) => { if (l.trim().length < 60 && cabecalho.test(l)) cortes.push(i) })

  const blocos = []
  if (cortes.length >= 2) {
    if (cortes[0] > 0) cortes.unshift(0)
    for (let i = 0; i < cortes.length; i++) {
      const ini = cortes[i], fim = i + 1 < cortes.length ? cortes[i + 1] : linhas.length
      const corpo = linhas.slice(ini, fim).join('\n').trim()
      if (corpo) blocos.push({ titulo: linhas[ini].trim().slice(0, 80) || `Parte ${blocos.length + 1}`, corpo })
    }
  } else {
    const ALVO = 24000   // ~4 mil palavras por bloco
    let atual = []
    let tam = 0
    for (const par of limpo.split(/\n{2,}/)) {
      atual.push(par); tam += par.length
      if (tam >= ALVO) { blocos.push({ titulo: '', corpo: atual.join('\n\n') }); atual = []; tam = 0 }
    }
    if (atual.length) blocos.push({ titulo: '', corpo: atual.join('\n\n') })
    blocos.forEach((b, i) => { b.titulo = `Parte ${i + 1}` })
  }
  if (!blocos.length) blocos.push({ titulo: 'Texto', corpo: limpo })

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return blocos.map((b, i) => ({
    id: 'txt' + i,
    titulo: b.titulo,
    html: b.corpo.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n')
  }))
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { zipAbrir, epubAbrir, epubTextoLimpo, textoParaCapitulos }
}
