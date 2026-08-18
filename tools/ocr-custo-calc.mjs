// Custo de LER uma pagina de manga, pela regra oficial de cobranca de imagem.
// Deterministico: depende so das dimensoes. Roda sem gastar nada.
const DOLAR = 5.50
const PAGINA = { w: 1600, h: 2400 }
const SAIDA = 400

function ladrilhos({w,h}) {
  let e = Math.min(2048/w, 2048/h, 1); w*=e; h*=e
  const menor = Math.min(w,h); if (menor > 768) { const f = 768/menor; w*=f; h*=f }
  return Math.ceil(w/512) * Math.ceil(h/512)
}
function retalhos({w,h}, teto=1536) {
  let p = Math.ceil(w/32) * Math.ceil(h/32)
  if (p > teto) { const f = Math.sqrt(teto*32*32/(w*h)); p = Math.ceil(w*f/32)*Math.ceil(h*f/32) }
  return p
}
const t = ladrilhos(PAGINA)
const MOD = [
  { nome:'gemini-2.5-flash-lite', entrada: 1548, preco:{in:0.10,out:0.40} },
  { nome:'gemini-2.5-flash',      entrada: 1548, preco:{in:0.30,out:2.50} },
  { nome:'gpt-5-nano',  entrada: Math.round(retalhos(PAGINA)*1.62), preco:{in:0.05,out:0.40} },
  { nome:'gpt-4o-mini (detalhe baixo)', entrada: 2833, preco:{in:0.15,out:0.60} },
  { nome:'gpt-5-mini',  entrada: Math.round(retalhos(PAGINA)*1.62), preco:{in:0.25,out:2.00} },
  { nome:'gpt-5.6-luna',entrada: retalhos(PAGINA, 1e9), preco:{in:0.20,out:1.20} },
  { nome:'gpt-4o-mini (detalhe alto)', entrada: 2833 + 5667*t, preco:{in:0.15,out:0.60} },
  { nome:'gpt-4o',      entrada: 85 + 170*t, preco:{in:2.50,out:10.00} },
]
console.log(`\nPagina ${PAGINA.w}x${PAGINA.h} -- ${t} ladrilhos | ${retalhos(PAGINA,1e9)} retalhos de 32px\n`)
console.log('modelo                            tokens    1 pagina    capitulo(20)   volume(180)')
console.log('-'.repeat(82))
for (const m of MOD) {
  const u = (m.entrada/1e6)*m.preco.in + (SAIDA/1e6)*m.preco.out
  const r = u*DOLAR
  console.log(
    `${m.nome.padEnd(32)} ${String(m.entrada).padStart(6)}  ` +
    `R$ ${r.toFixed(4).padStart(7)}   R$ ${(r*20).toFixed(3).padStart(7)}   R$ ${(r*180).toFixed(2).padStart(7)}`
  )
}
console.log('\n(dolar a R$ 5,50; saida estimada em 400 tokens ~ 7 baloes em JSON)')
