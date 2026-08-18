// ================================================================
// OCR-CUSTO — quanto custa ler UMA página de mangá com a IA
// Roda: node tools/ocr-custo.mjs [caminho-da-imagem]
// ⚠️ A chave sai do .env e NUNCA é impressa.
// ================================================================
import fs from 'node:fs'

const CAMINHO = process.argv[2] || '_dados-de-teste/pagina-manga-teste.jpg'
const DOLAR = 5.50   // aproximado, só para dar noção

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const CHAVE = env.OPENAI_API_KEY
if (!CHAVE) { console.error('sem OPENAI_API_KEY no .env'); process.exit(1) }

const b64 = fs.readFileSync(CAMINHO).toString('base64')
const KB = Math.round(fs.statSync(CAMINHO).size / 1024)

// O que o app pediria de verdade: as falas, na ordem de leitura, e onde ficam.
const PEDIDO = `You are reading one page of an English-language manga/comic.
Return ONLY JSON: {"balloons":[{"text":"...","order":1}],"sfx":["..."]}
- "text": the exact dialogue inside each speech balloon, in reading order.
- Join broken lines into one sentence. Keep punctuation. Do not translate.
- "sfx": sound effects drawn outside balloons.`

const GABARITO = [
  "I CAN'T BELIEVE YOU PULLED THIS OFF ON YOUR OWN!",
  "DON'T GET AHEAD OF YOURSELF.",
  "WE'RE RUNNING OUT OF TIME -- HURRY UP!",
  "I'LL HOLD THEM OFF.",
  "SO THIS IS WHAT YOU'VE BEEN HIDING ALL ALONG.",
  "IT NEVER CROSSED MY MIND.",
  "IF WE PULL BACK NOW, EVERYTHING WE WORKED FOR FALLS APART.",
]
const limpar = s => String(s || '').toUpperCase().replace(/[^A-Z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim()

const MODELOS = [
  { id: 'gpt-4o-mini',  preco: { in: 0.15, out: 0.60 } },
  { id: 'gpt-5.6-luna', preco: { in: 0.20, out: 1.20 } },
]

async function medir(m, detalhe) {
  const t0 = Date.now()
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CHAVE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: m.id,
      messages: [{ role: 'user', content: [
        { type: 'text', text: PEDIDO },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: detalhe } },
      ]}],
      response_format: { type: 'json_object' },
    }),
  })
  const j = await r.json()
  if (j.error) return { erro: j.error.message.slice(0, 120) }
  const u = j.usage || {}
  const custo = (u.prompt_tokens / 1e6) * m.preco.in + (u.completion_tokens / 1e6) * m.preco.out
  let acertos = 0
  try {
    const saida = JSON.parse(j.choices[0].message.content)
    const lidas = (saida.balloons || []).map(b => limpar(b.text))
    acertos = GABARITO.filter(g => lidas.some(l => l === limpar(g))).length
  } catch {}
  return {
    entrada: u.prompt_tokens, saida: u.completion_tokens,
    custoUSD: custo, segundos: ((Date.now() - t0) / 1000).toFixed(1),
    acertos, total: GABARITO.length,
  }
}

console.log(`\nPágina: ${CAMINHO} — ${KB} KB\n`)
for (const m of MODELOS) {
  for (const d of ['high', 'low']) {
    const x = await medir(m, d)
    if (x.erro) { console.log(`${m.id.padEnd(14)} ${d.padEnd(5)} ERRO: ${x.erro}`); continue }
    const brl = x.custoUSD * DOLAR
    console.log(
      `${m.id.padEnd(14)} ${d.padEnd(5)} ` +
      `${String(x.entrada).padStart(5)} tokens entrada | ${String(x.saida).padStart(4)} saída | ` +
      `US$ ${x.custoUSD.toFixed(5)} = R$ ${brl.toFixed(4)} | ` +
      `${x.segundos}s | balões certos: ${x.acertos}/${x.total}`
    )
    const porVolume = x.custoUSD * DOLAR * 180
    console.log(`${''.padEnd(20)}→ volume de 180 páginas: R$ ${porVolume.toFixed(2)}`)
  }
}
