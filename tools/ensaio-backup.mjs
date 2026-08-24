// ================================================================
// ENSAIO DE BACKUP — o backup vale contra a nuvem de verdade?
// ================================================================
// POR QUE ISTO EXISTE (melhoria 4, rodada 44). O backup JSON é a rede de
// segurança recomendada em todos os fluxos perigosos do app — e a auditoria
// mostrou que ele passou meses prometendo o que não continha (e o importador,
// meses lendo três campos). Conserto de código não prova nada sozinho: prova
// é conferir UM BACKUP REAL contra o Firestore REAL e listar o que ficaria de
// fora se ele fosse usado hoje. É o que este script faz, sem navegador.
//
// USO
//   node tools/ensaio-backup.mjs <caminho-do-english-lab-AAAA-MM-DD.json>
//
// SÓ LEITURA, como o acervo.mjs: mesma credencial de serviço
// (_dados-de-teste/firebase-admin.json, papel Cloud Datastore Viewer), mesmo
// fluxo jwt-bearer sem dependências. Este script nunca escreve nada.
// Sai com código 0 quando o backup cobre a nuvem; 1 quando algo ficaria fora.

import { readFileSync, existsSync } from 'node:fs'
import { createSign } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const CRED = join(RAIZ, '_dados-de-teste', 'firebase-admin.json')

// ---- credencial + token (o mesmo desenho do acervo.mjs) ---------
function credencial() {
  if (!existsSync(CRED)) {
    console.error(`\nNão achei a credencial em:\n  ${CRED}\n`)
    console.error('Ela é a mesma do acervo.mjs — veja as instruções no topo daquele arquivo.\n')
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

async function fsGet(cred, tok, caminho) {
  const url = `https://firestore.googleapis.com/v1/projects/${cred.project_id}` +
              `/databases/(default)/documents/${caminho}`
  const r = await fetch(url, { headers: { authorization: `Bearer ${tok}` } })
  if (r.status === 403) {
    console.error('\n403 do Firestore — a conta de serviço não tem leitura (Cloud Datastore Viewer).\n')
    process.exit(1)
  }
  if (!r.ok) return null
  return r.json()
}

async function acharUid(cred, tok) {
  const j = await fsGet(cred, tok, 'users?pageSize=20&showMissing=true')
  const docs = (j && j.documents) || []
  if (!docs.length) { console.error('nenhum usuário na base — projeto certo?'); process.exit(1) }
  const uids = docs.map(d => d.name.split('/').pop())
  if (uids.length > 1) {
    const pedido = process.argv.find(a => a.startsWith('--uid='))
    if (!pedido) {
      console.error('mais de uma conta. Repita com --uid=<um destes>:')
      uids.forEach(u => console.error('  ' + u))
      process.exit(1)
    }
    return pedido.slice(6)
  }
  return uids[0]
}

async function docDaNuvem(cred, tok, uid, nome) {
  const j = await fsGet(cred, tok, `users/${uid}/data/${nome}`)
  const campos = (j && j.fields) || {}
  const saida = {}
  for (const [k, v] of Object.entries(campos)) saida[k] = desembrulhar(v)
  return saida
}

// ---- o ensaio ---------------------------------------------------
const arq = process.argv[2]
if (!arq) {
  console.error('\nUSO: node tools/ensaio-backup.mjs <english-lab-AAAA-MM-DD.json>')
  console.error('(o arquivo que sai de Configurações → Exportar JSON)\n')
  process.exit(1)
}
if (!existsSync(arq)) { console.error(`não achei o arquivo: ${arq}`); process.exit(1) }
let bkp
try { bkp = JSON.parse(readFileSync(arq, 'utf8')) } catch (e) {
  console.error('o arquivo não é um JSON válido:', e.message); process.exit(1)
}

console.log(`\nENSAIO DE BACKUP — ${arq}`)
console.log(`exportado em: ${bkp.exported_at || '(sem data — backup muito antigo?)'}\n`)

// Chave vazando em backup antigo é o primeiro aviso.
const chaves = ['openaiKey', 'geminiKey', 'groqKey'].filter(k => bkp.cfg && bkp.cfg[k])
if (chaves.length) {
  console.log(`⚠ ATENÇÃO: este backup é ANTIGO e carrega chave de API dentro (${chaves.join(', ')}).`)
  console.log('  Não compartilhe este arquivo; exporte um novo — os atuais saem sem as chaves.\n')
}

const cred = credencial()
const tok = await token(cred)
const uid = await acharUid(cred, tok)

// [nome do doc na nuvem, campo no backup, chave de identidade, rótulo]
const LISTAS = [
  ['words',       'words',       'id',           'palavras'],
  ['srsCards',    'srsCards',    'id',           'cards'],
  ['srsDecks',    'srsDecks',    'id',           'baralhos'],
  ['srsLog',      'srsLog',      'date',         'dias de diário'],
  ['livros',      'livros',      'id',           'livros'],
  ['audiolivros', 'audiolivros', 'id',           'audiolivros'],
  ['conversas',   'conversas',   'id',           'conversas'],
  ['videos',      'videos',      'id',           'vídeos/episódios'],
  ['clips',       'clips',       'id',           'cortes'],
  ['podShows',    'podShows',    'collectionId', 'podcasts'],
]

let problemas = 0
for (const [docNome, campo, chave, rotulo] of LISTAS) {
  const nuvem = (await docDaNuvem(cred, tok, uid, docNome)).list || []
  const local = Array.isArray(bkp[campo]) ? bkp[campo] : null
  if (local === null) {
    if (nuvem.length) {
      problemas++
      console.log(`✗ ${rotulo}: o backup NÃO TEM este campo — ${nuvem.length} da nuvem ficariam de fora`)
    } else {
      console.log(`· ${rotulo}: nada na nuvem, nada no backup`)
    }
    continue
  }
  const ids = new Set(local.map(x => x && x[chave]).filter(Boolean))
  const faltam = nuvem.filter(x => x && x[chave] && !ids.has(x[chave]))
  if (faltam.length) {
    problemas++
    const nomes = faltam.slice(0, 8).map(x => x.word || x.title || x.date || x[chave]).join(', ')
    console.log(`✗ ${rotulo}: backup tem ${local.length}, nuvem tem ${nuvem.length} — FALTAM ${faltam.length} no backup (${nomes}${faltam.length > 8 ? ', …' : ''})`)
  } else {
    console.log(`✓ ${rotulo}: backup ${local.length} × nuvem ${nuvem.length} — cobre tudo`)
  }
}

// known: mapas por união
const known = await docDaNuvem(cred, tok, uid, 'known')
const bk = bkp.known || {}
for (const [campo, rotulo] of [['map', 'palavras conhecidas'], ['ignored', 'ignoradas'], ['senses', 'sentidos sabidos']]) {
  const nNuvem = Object.keys(known[campo] || {}).length
  const temCampo = bk && typeof bk[campo] === 'object'
  const nBkp = temCampo ? Object.keys(bk[campo]).length : 0
  if (!temCampo && nNuvem) { problemas++; console.log(`✗ ${rotulo}: o backup não tem o campo — ${nNuvem} da nuvem ficariam de fora`) }
  else {
    const faltam = Object.keys(known[campo] || {}).filter(k => !(k in (bk[campo] || {})))
    if (faltam.length) { problemas++; console.log(`✗ ${rotulo}: faltam ${faltam.length} de ${nNuvem} no backup`) }
    else console.log(`✓ ${rotulo}: backup ${nBkp} × nuvem ${nNuvem}`)
  }
}

// kindleSeen
const ks = await docDaNuvem(cred, tok, uid, 'kindleSeen')
const ksNuvem = Array.isArray(ks.list) ? ks.list.length : 0
const ksBkp = Array.isArray(bkp.kindleSeen) ? bkp.kindleSeen.length : 0
console.log(`${ksBkp >= ksNuvem ? '✓' : '·'} histórico do Kindle: backup ${ksBkp} × nuvem ${ksNuvem}${ksBkp < ksNuvem ? ' (união na importação cobre a diferença)' : ''}`)

console.log('\n' + (problemas
  ? `VEREDITO: ${problemas} lacuna(s) — se você restaurasse ESTE backup hoje, o que está marcado com ✗ ficaria de fora. Exporte um backup novo.`
  : 'VEREDITO: este backup cobre tudo o que está na nuvem. Pode confiar nele.') + '\n')
process.exit(problemas ? 1 : 0)
