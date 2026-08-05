// ================================================================
// LEITOR DE SQLite (somente leitura) — para o vocab.db do Kindle
// ================================================================
// Por que um leitor próprio e não sql.js: o projeto é "sem build" e o
// sql.js custaria ~1,5 MB de WASM baixado para ler quatro tabelinhas.
// Aqui só precisamos de VARREDURA COMPLETA de tabela (nada de índices,
// JOIN, WHERE ou escrita) — isso são ~250 linhas de formato de arquivo.
//
// O que está implementado do formato (fileformat2.html):
//   • cabeçalho de 100 bytes (tamanho de página, bytes reservados, encoding)
//   • sqlite_master (página 1) para descobrir tabelas e suas raízes
//   • b-tree de TABELA: páginas folha (0x0D) e interiores (0x05)
//   • registros: cabeçalho de serial types + corpo (int/float/text/blob)
//   • payload que transborda a página (cadeia de overflow) — a frase de uso
//     do Kindle é longa e cai nesse caso com frequência
// O que NÃO está: WAL, escrita, b-tree de índice, páginas freelist.
// Um vocab.db copiado do aparelho por USB nunca precisa disso.
// ================================================================
'use strict'

function _sqliteErro(msg) { throw new Error('SQLite: ' + msg) }

// Varint big-endian de 1 a 9 bytes → [valor, bytes lidos]
function _sqVarint(u8, pos) {
  let v = 0
  for (let i = 0; i < 8; i++) {
    const b = u8[pos + i]
    if (b === undefined) _sqliteErro('arquivo truncado')
    if (i === 8) break
    if (b & 0x80) { v = v * 128 + (b & 0x7f) }
    else { return [v * 128 + b, i + 1] }
  }
  // 9º byte entra inteiro (8 bits)
  return [v * 256 + u8[pos + 8], 9]
}

// Inteiro com sinal de n bytes (complemento de dois), big-endian
function _sqInt(u8, pos, n) {
  let v = 0
  for (let i = 0; i < n; i++) v = v * 256 + u8[pos + i]
  const teto = Math.pow(2, n * 8)
  return v >= teto / 2 ? v - teto : v
}

// Nomes das colunas a partir do CREATE TABLE (basta para o esquema do Kindle)
function _sqColunas(sql) {
  const abre = sql.indexOf('(')
  const fecha = sql.lastIndexOf(')')
  if (abre < 0 || fecha < abre) return []
  const corpo = sql.slice(abre + 1, fecha)
  const partes = []
  let nivel = 0, atual = '', aspas = ''
  for (const ch of corpo) {
    if (aspas) { atual += ch; if (ch === aspas) aspas = ''; continue }
    if (ch === '"' || ch === "'" || ch === '`') { aspas = ch; atual += ch; continue }
    if (ch === '(') nivel++
    if (ch === ')') nivel--
    if (ch === ',' && nivel === 0) { partes.push(atual); atual = ''; continue }
    atual += ch
  }
  if (atual.trim()) partes.push(atual)
  const restricoes = /^(primary|unique|check|foreign|constraint|key)\b/i
  return partes.map(p => p.trim()).filter(p => p && !restricoes.test(p)).map(p => {
    const m = p.match(/^("([^"]*)"|`([^`]*)`|\[([^\]]*)\]|[^\s(]+)/)
    if (!m) return ''
    return (m[2] ?? m[3] ?? m[4] ?? m[1]).trim()
  }).filter(Boolean)
}

// ---------------------------------------------------------------
// Abre o arquivo e devolve { tabelas, ler(nome) }
// ---------------------------------------------------------------
function sqliteAbrir(buffer) {
  const u8 = new Uint8Array(buffer)
  const dv = new DataView(buffer)
  const assinatura = 'SQLite format 3\0'
  for (let i = 0; i < assinatura.length; i++) {
    if (u8[i] !== assinatura.charCodeAt(i)) _sqliteErro('não é um arquivo SQLite')
  }
  let pageSize = dv.getUint16(16)
  if (pageSize === 1) pageSize = 65536
  const reservado = u8[20]
  const usavel = pageSize - reservado
  if (usavel < 480) _sqliteErro('tamanho de página inválido')
  const enc = dv.getUint32(56)
  const decoder = new TextDecoder(enc === 3 ? 'utf-16be' : enc === 2 ? 'utf-16le' : 'utf-8')
  const totalPaginas = Math.floor(u8.length / pageSize)

  const inicioPagina = n => (n - 1) * pageSize

  // Junta o payload da célula, seguindo a cadeia de overflow se houver.
  function _payload(inicio, P) {
    const X = usavel - 35
    let local = P
    if (P > X) {
      const M = Math.floor(((usavel - 12) * 32) / 255) - 23
      const K = M + ((P - M) % (usavel - 4))
      local = K <= X ? K : M
    }
    if (P === local) return u8.subarray(inicio, inicio + P)
    const out = new Uint8Array(P)
    out.set(u8.subarray(inicio, inicio + local), 0)
    let escrito = local
    let prox = dv.getUint32(inicio + local)
    let voltas = 0
    while (escrito < P && prox > 0 && prox <= totalPaginas) {
      if (++voltas > totalPaginas + 8) _sqliteErro('cadeia de overflow em laço')
      const base = inicioPagina(prox)
      const pedaco = Math.min(usavel - 4, P - escrito)
      out.set(u8.subarray(base + 4, base + 4 + pedaco), escrito)
      escrito += pedaco
      prox = dv.getUint32(base)
    }
    if (escrito < P) _sqliteErro('payload incompleto')
    return out
  }

  // Registro → array de valores
  function _registro(bytes) {
    const [tamCab, n] = _sqVarint(bytes, 0)
    const tipos = []
    let p = n
    while (p < tamCab) {
      const [t, k] = _sqVarint(bytes, p)
      tipos.push(t); p += k
    }
    const vals = []
    let b = tamCab
    for (const t of tipos) {
      if (t === 0) { vals.push(null) }
      else if (t >= 1 && t <= 4) { vals.push(_sqInt(bytes, b, t)); b += t }
      else if (t === 5) { vals.push(_sqInt(bytes, b, 6)); b += 6 }
      else if (t === 6) { vals.push(_sqInt(bytes, b, 8)); b += 8 }
      else if (t === 7) { vals.push(new DataView(bytes.buffer, bytes.byteOffset + b, 8).getFloat64(0)); b += 8 }
      else if (t === 8) { vals.push(0) }
      else if (t === 9) { vals.push(1) }
      else if (t >= 12 && t % 2 === 0) { const len = (t - 12) / 2; vals.push(bytes.subarray(b, b + len)); b += len }
      else if (t >= 13) { const len = (t - 13) / 2; vals.push(decoder.decode(bytes.subarray(b, b + len))); b += len }
      else { vals.push(null) }
    }
    return vals
  }

  // Percorre a b-tree de uma TABELA chamando cb(rowid, valores)
  function _percorrer(raiz, cb) {
    const vistas = new Set()
    const pilha = [raiz]
    let lidas = 0
    while (pilha.length) {
      const num = pilha.pop()
      if (!num || num > totalPaginas || vistas.has(num)) continue
      vistas.add(num)
      if (++lidas > totalPaginas + 8) _sqliteErro('b-tree em laço')
      const base = inicioPagina(num)
      const hdr = num === 1 ? 100 : 0
      const tipo = u8[base + hdr]
      const nCels = dv.getUint16(base + hdr + 3)
      if (tipo === 13) {
        const arr = base + hdr + 8
        for (let i = 0; i < nCels; i++) {
          const cel = base + dv.getUint16(arr + i * 2)
          const [P, a] = _sqVarint(u8, cel)
          const [rowid, b] = _sqVarint(u8, cel + a)
          cb(rowid, _registro(_payload(cel + a + b, P)))
        }
      } else if (tipo === 5) {
        const arr = base + hdr + 12
        pilha.push(dv.getUint32(base + hdr + 8))   // ponteiro mais à direita
        for (let i = 0; i < nCels; i++) {
          const cel = base + dv.getUint16(arr + i * 2)
          pilha.push(dv.getUint32(cel))
        }
      }
      // 2/10 (b-tree de índice) e 0 (página livre) são ignorados de propósito
    }
  }

  // sqlite_master mora sempre na página 1
  const tabelas = {}
  _percorrer(1, (_id, v) => {
    // schema: type, name, tbl_name, rootpage, sql
    if (v[0] !== 'table' || !v[1] || !v[3]) return
    tabelas[String(v[1]).toUpperCase()] = { nome: v[1], raiz: v[3], sql: String(v[4] || ''), cols: _sqColunas(String(v[4] || '')) }
  })

  function ler(nome, limite) {
    const t = tabelas[String(nome).toUpperCase()]
    if (!t) return []
    const linhas = []
    const teto = limite || 200000
    try {
      _percorrer(t.raiz, (rowid, v) => {
        if (linhas.length >= teto) return
        const o = { _rowid: rowid }
        t.cols.forEach((c, i) => { o[c] = v[i] === undefined ? null : v[i] })
        linhas.push(o)
      })
    } catch (e) {
      // Tabela corrompida não pode derrubar a importação inteira: devolve o
      // que já foi lido e deixa o chamador decidir.
      console.warn('[sqlite] leitura parcial de', nome, '—', e.message)
    }
    return linhas
  }

  return { tabelas, ler, pageSize, encoding: enc }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { sqliteAbrir }
