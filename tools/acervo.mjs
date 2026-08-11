// ================================================================
// ACERVO — lê o Language Lab direto do Firestore, sem navegador
// ================================================================
// POR QUE ISTO EXISTE. Diagnosticar com dado real dependia de abrir o app
// logado, e o login do app é `signInWithPopup`: uma janela que a automação não
// alcança. O resultado era sempre o mesmo pedido — "exporta o JSON e me manda"
// —, ou seja, interferência dele a cada rodada. Aqui o navegador sai da conta:
// uma credencial de serviço lida do disco, e o acervo responde.
//
// ⚠️ SÓ LEITURA, E A GARANTIA É ESTRUTURAL. A conta de serviço deve ter o papel
// **Cloud Datastore Viewer** (`roles/datastore.viewer`) e nada além. Assim
// escrever é impossível pelo próprio IAM do Google — não é promessa de quem
// escreveu este arquivo, é o servidor recusando. Este script nunca faz PATCH,
// POST em documento nem DELETE; se um dia fizer, o 403 aparece.
//
// SEM DEPENDÊNCIA NENHUMA: o projeto é vanilla e continua. O token OAuth é
// montado à mão (JWT RS256 com o `crypto` do Node) e o Firestore é falado por
// REST.
//
// USO
//   node tools/acervo.mjs resumo          quantos itens, cards, livros, fontes
//   node tools/acervo.mjs familia         parentesco: moved_to, from órfão, spun_off
//   node tools/acervo.mjs item <palavra>  tudo sobre um item (sentidos crus)
//   node tools/acervo.mjs procedencia     itens com obra possivelmente herdada
//   node tools/acervo.mjs bruto <doc>     despeja um documento (words, livros, …)
//
// CREDENCIAL: `_dados-de-teste/firebase-admin.json` (a pasta é gitignored).
// Console do Firebase → Configurações do projeto → Contas de serviço →
// Gerar nova chave privada. Depois, no Console do Google Cloud → IAM, deixe a
// conta só com "Cloud Datastore Viewer".

import { readFileSync, existsSync } from 'node:fs'
import { createSign } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const CRED = join(RAIZ, '_dados-de-teste', 'firebase-admin.json')

// ---- credencial + token -----------------------------------------
function credencial() {
  if (!existsSync(CRED)) {
    console.error(`\nNão achei a credencial em:\n  ${CRED}\n`)
    console.error('Console do Firebase → Configurações do projeto → Contas de serviço')
    console.error('→ "Gerar nova chave privada". Salve o arquivo com esse nome exato.')
    console.error('Depois, no Google Cloud → IAM, deixe essa conta só com "Cloud Datastore Viewer".\n')
    process.exit(1)
  }
  const c = JSON.parse(readFileSync(CRED, 'utf8'))
  for (const campo of ['client_email', 'private_key', 'project_id']) {
    if (!c[campo]) { console.error(`credencial sem "${campo}" — arquivo errado?`); process.exit(1) }
  }
  return c
}

const b64url = b => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// JWT assinado → access_token. É o fluxo "jwt-bearer" do Google, 20 linhas em
// vez de uma árvore de dependências.
async function token(cred) {
  const agora = Math.floor(Date.now() / 1000)
  const cab = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corpo = b64url(JSON.stringify({
    iss: cred.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora, exp: agora + 3600
  }))
  const assinatura = createSign('RSA-SHA256').update(`${cab}.${corpo}`).end()
    .sign(cred.private_key.replace(/\\n/g, '\n'), 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cab}.${corpo}.${assinatura}`
    })
  })
  const j = await r.json()
  if (!j.access_token) { console.error('falha ao pegar o token:', j); process.exit(1) }
  return j.access_token
}

// ---- Firestore por REST -----------------------------------------
// O Firestore devolve valores etiquetados (`stringValue`, `arrayValue`…).
// Sem desembrulhar, tudo vira ruído ilegível.
function desembrulhar(v) {
  if (v == null) return null
  if ('nullValue' in v) return null
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(desembrulhar)
  if ('mapValue' in v) {
    const o = {}
    for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = desembrulhar(x)
    return o
  }
  return v
}

class Acervo {
  constructor(cred, tok) { this.cred = cred; this.tok = tok; this.uid = null; this.cache = new Map() }

  async _get(caminho) {
    const url = `https://firestore.googleapis.com/v1/projects/${this.cred.project_id}` +
                `/databases/(default)/documents/${caminho}`
    const r = await fetch(url, { headers: { authorization: `Bearer ${this.tok}` } })
    if (r.status === 403) {
      console.error('\n403 do Firestore. A conta de serviço não tem permissão de leitura.')
      console.error('Google Cloud → IAM → dê "Cloud Datastore Viewer" a esta conta.\n')
      process.exit(1)
    }
    if (!r.ok) return null
    return r.json()
  }

  // Descobre o uid sozinho: a coleção `users` tem um documento por conta, e
  // esta base é de um usuário só. Com mais de um, ele escolhe.
  async acharUid() {
    if (this.uid) return this.uid
    const j = await this._get('users?pageSize=20')
    const docs = (j && j.documents) || []
    if (!docs.length) { console.error('nenhum usuário na base — credencial do projeto certo?'); process.exit(1) }
    const uids = docs.map(d => d.name.split('/').pop())
    if (uids.length > 1) {
      const pedido = process.argv.find(a => a.startsWith('--uid='))
      if (!pedido) {
        console.error('mais de uma conta nesta base. Repita com --uid=<um destes>:')
        uids.forEach(u => console.error('  ' + u))
        process.exit(1)
      }
      this.uid = pedido.slice(6)
    } else this.uid = uids[0]
    return this.uid
  }

  async doc(nome) {
    if (this.cache.has(nome)) return this.cache.get(nome)
    const uid = await this.acharUid()
    const j = await this._get(`users/${uid}/data/${nome}`)
    const campos = (j && j.fields) || {}
    const saida = {}
    for (const [k, v] of Object.entries(campos)) saida[k] = desembrulhar(v)
    this.cache.set(nome, saida)
    return saida
  }

  async words()    { return (await this.doc('words')).list || [] }
  async cards()    { return (await this.doc('srsCards')).list || [] }
  async livros()   { return (await this.doc('livros')).list || [] }
}

// ================================================================
// DIAGNÓSTICOS
// ================================================================
const nl = () => console.log('')
const tit = t => { nl(); console.log(t); console.log('─'.repeat(t.length)) }

async function resumo(a) {
  const [w, c, l] = [await a.words(), await a.cards(), await a.livros()]
  tit('ACERVO')
  console.log(`itens: ${w.length}   cards: ${c.length}   livros: ${l.length}   uid: ${a.uid}`)
  const por = (arr, f) => arr.reduce((m, x) => (m[f(x) || '(vazio)'] = (m[f(x) || '(vazio)'] || 0) + 1, m), {})
  console.log('\npor fonte:  ', JSON.stringify(por(w, x => x.source_type)))
  console.log('por estado: ', JSON.stringify(por(w, x => x.status)))
  console.log('por idioma: ', JSON.stringify(por(w, x => x.lang)))
  for (const li of l) {
    const n = (li.chapters || []).length
    console.log(`\nlivro: ${li.title} — ${n} partes, lendo a parte ${(li.pos && li.pos.cap) || 0}`)
  }
}

// A PENDÊNCIA QUE ORIGINOU ISTO. Separar um sentido marca `moved_to` nele e
// registra em `spun_off` do pai; adotar uma expressão NÃO mexe no pai. Os dois
// caminhos gravam `from.rel = 'mwe'` no filho, então só o pai diz qual foi.
async function familia(a) {
  const w = await a.words()
  const cards = await a.cards()
  const porId = new Map(w.map(x => [x.id, x]))

  tit('SENTIDOS MOVIDOS (separar sentido)')
  let achou = false
  for (const x of w) {
    const movidos = (x.meanings || []).filter(m => m && m.moved_to)
    const spun = Array.isArray(x.spun_off) ? x.spun_off : []
    if (!movidos.length && !spun.length) continue
    achou = true
    console.log(`\n${x.word}`)
    for (const m of movidos) {
      const alvo = porId.get(m.moved_to)
      console.log(`  sentido "${m.meaning_pt}" → ${m.moved_word || '?'} ` +
                  `[${alvo ? 'alvo existe' : '⚠ ALVO SUMIU'}]`)
    }
    for (const s of spun) {
      console.log(`  spun_off: "${s.meaning_pt}" → ${s.word} ` +
                  `[${porId.has(s.wordId) ? 'ok' : '⚠ item sumiu'}]`)
    }
  }
  if (!achou) console.log('nenhum — nenhum sentido foi separado por este caminho')

  tit('FILHOS (from) E DE ONDE VIERAM')
  const filhos = w.filter(x => x.from)
  if (!filhos.length) console.log('nenhum item tem `from`')
  for (const f of filhos) {
    const pai = f.from.id ? porId.get(f.from.id) : null
    const estado = !f.from.id ? 'sem id (promovido)' : pai ? 'pai vivo' : '⚠ PAI NÃO EXISTE'
    // Se o pai marcou este filho em spun_off/moved_to, veio de "separar sentido".
    const separado = pai && ((pai.spun_off || []).some(s => s.wordId === f.id) ||
                             (pai.meanings || []).some(m => m.moved_to === f.id))
    const caminho = separado ? 'separar sentido' : (pai ? 'adotar expressão / raio-X' : '?')
    console.log(`\n${f.word}   (rel: ${f.from.rel || '?'})`)
    console.log(`  from: ${f.from.word || '?'}  [${estado}]  → nasceu por: ${caminho}`)
    console.log(`  obra: ${f.source_title || '(sem)'} · ${f.source_context || '(sem cap)'}`)
    console.log(`  frase: ${f.context ? '"' + String(f.context).slice(0, 90) + '"' : '(vazia)'}`)
  }

  tit('CARDS ÓRFÃOS')
  const orfaos = cards.filter(c => !porId.has(c.wordId))
  console.log(orfaos.length ? `⚠ ${orfaos.length} card(s) sem item` : 'nenhum')
}

async function item(a, termo) {
  const w = await a.words()
  const alvo = w.filter(x => String(x.word || '').toLowerCase().includes(String(termo).toLowerCase()))
  if (!alvo.length) { console.log(`nada com "${termo}"`); return }
  for (const x of alvo) {
    tit(x.word.toUpperCase())
    console.log(`id: ${x.id}   estado: ${x.status}   tipo: ${x.type || '(sem)'}   lema: ${x.lemma || '(sem)'}`)
    console.log(`obra: ${x.source_title || '(sem)'} · ${x.source_context || '(sem cap)'}  [${x.source_type}]`)
    console.log(`frase: ${x.context ? '"' + x.context + '"' : '(vazia)'}`)
    if (x.from) console.log(`from: ${JSON.stringify(x.from)}`)
    if (Array.isArray(x.spun_off) && x.spun_off.length) console.log(`spun_off: ${JSON.stringify(x.spun_off)}`)
    const ms = x.meanings || []
    console.log(`\nsentidos (${ms.length}):`)
    ms.forEach((m, i) => {
      const marcas = [
        m.moved_to ? `MOVIDO→${m.moved_word || m.moved_to}` : '',
        m.fundido_em ? 'FUNDIDO' : '',
        m.estado ? `estado:${m.estado}` : '',
        m.selected === false ? 'não-selecionado' : ''
      ].filter(Boolean).join(' ')
      console.log(`  ${i}. ${m.meaning_pt || '(sem tradução)'}  ${marcas ? '[' + marcas + ']' : ''}`)
      if (m.context) console.log(`     frase: "${String(m.context).slice(0, 90)}"`)
    })
  }
}

async function procedencia(a) {
  const w = await a.words()
  const porId = new Map(w.map(x => [x.id, x]))
  tit('PROCEDÊNCIA POSSIVELMENTE HERDADA')
  const norm = s => String(s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z'’\- ]+/g, ' ').replace(/\s+/g, ' ').trim()
  const serve = (frase, expr) => {
    if (!String(frase || '').trim()) return false
    const resto = String(expr || '').trim().split(/\s+/).slice(1).join(' ')
    if (!resto) return true
    return (' ' + norm(frase) + ' ').includes(' ' + norm(resto) + ' ')
  }
  let n = 0
  for (const x of w) {
    if (!x.from) continue
    const t = String(x.source_title || '').trim()
    if (!t || t === 'Do seu estudo') continue
    const pai = x.from.id ? porId.get(x.from.id) : null
    if (pai && String(pai.source_title || '').trim() !== t) continue
    if (serve(x.context, x.word)) continue
    n++
    console.log(`\n${x.word}  → hoje: ${t} · ${x.source_context || '?'}`)
    console.log(`  frase não usa a expressão${x.context ? '' : ' (não tem frase)'}`)
    console.log('  ⓘ o app confere no EPUB antes de mexer; aqui é só a suspeita textual')
  }
  if (!n) console.log('nenhum candidato pelo teste textual')
}

async function bruto(a, nome) {
  const d = await a.doc(nome || 'words')
  console.log(JSON.stringify(d, null, 1).slice(0, 40000))
}

// ---- main -------------------------------------------------------
const modo = process.argv[2] || 'resumo'
const arg = process.argv[3]
const cred = credencial()
const a = new Acervo(cred, await token(cred))
await a.acharUid()

if (modo === 'resumo') await resumo(a)
else if (modo === 'familia') await familia(a)
else if (modo === 'item') await item(a, arg || 'tuck')
else if (modo === 'procedencia') await procedencia(a)
else if (modo === 'bruto') await bruto(a, arg)
else if (modo === 'tudo') { await resumo(a); await familia(a); await procedencia(a) }
else { console.log('modos: resumo | familia | item <palavra> | procedencia | bruto <doc> | tudo') }
nl()
