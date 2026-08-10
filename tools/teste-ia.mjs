#!/usr/bin/env node
// ================================================================
// BATERIA DE TESTES CONTRA A API DE VERDADE
// ================================================================
// Responde o que o navegador não responde: se a API ACEITA os esquemas
// estritos, se a Luna preenche todos os campos sem truncar, quanto custa de
// verdade cada chamada, e como ela se sai contra o modelo antigo nos MESMOS
// prompts.
//
//   node tools/teste-ia.mjs esquemas     # barato: só valida os 7 contratos
//   node tools/teste-ia.mjs analise      # a análise completa, Luna × 4o-mini
//   node tools/teste-ia.mjs chips        # a quebra do trecho (vazamento/enum)
//   node tools/teste-ia.mjs tudo
//
// A CHAVE VEM DO AMBIENTE, nunca do código e nunca da linha de comando (o
// histórico do shell guardaria). Crie `.env` na raiz — já está no .gitignore:
//
//   OPENAI_API_KEY=sk-proj-...
//
// e rode:  set -a; . ./.env; set +a; node tools/teste-ia.mjs tudo
//
// ⚠️ O script NUNCA imprime a chave. Se algum dia precisar depurar a
// autenticação, imprima o comprimento e os 4 últimos caracteres — nada mais.
//
// ⚠️ OS PROMPTS E OS ESQUEMAS SÃO LIDOS DO CÓDIGO-FONTE, não copiados para cá.
// Cópia envelhece em silêncio: o dia em que o prompt mudasse, o teste passaria
// a aprovar uma coisa que o app não usa mais. Aqui o teste segue o app sozinho.
// ================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHAVE = process.env.OPENAI_API_KEY || ''
const COTACAO = Number(process.env.USD_BRL || 5.40)   // só para a estimativa em reais

const fonte = f => fs.readFileSync(path.join(RAIZ, f), 'utf8')

// ---------------------------------------------------------------
// 1. LER O CÓDIGO DO APP
// ---------------------------------------------------------------
// Um template literal não se acha com regex: ele tem `${}` dentro, e dentro do
// `${}` há outras crases e chaves. Este scanner anda caractere a caractere
// distinguindo TEXTO de EXPRESSÃO — é o que permite extrair o prompt inteiro
// da análise, com todos os blocos condicionais, sem copiá-lo para cá.
function fatiarTemplate(txt, inicio) {
  const abre = txt.indexOf('`', inicio)
  if (abre < 0) return null
  let i = abre + 1, exprs = []          // pilha de profundidade de chaves
  while (i < txt.length) {
    const c = txt[i]
    if (c === '\\') { i += 2; continue }
    if (!exprs.length) {                 // estou no TEXTO do template
      if (c === '`') return txt.slice(abre + 1, i)
      if (c === '$' && txt[i + 1] === '{') { exprs.push(1); i += 2; continue }
    } else {                             // estou dentro de um ${ ... }
      if (c === '{') exprs[exprs.length - 1]++
      else if (c === '}') { if (--exprs[exprs.length - 1] === 0) exprs.pop() }
      else if (c === '`') {              // template aninhado: pula ele inteiro
        const dentro = fatiarTemplate(txt, i)
        if (dentro === null) return null
        i += dentro.length + 2; continue
      }
    }
    i++
  }
  return null
}

// Avalia um trecho de código do app num escopo controlado. Serve tanto para os
// esquemas (código puro) quanto para os prompts (template + fixtures).
function avaliar(codigo, escopo = {}) {
  const nomes = Object.keys(escopo)
  // eslint-disable-next-line no-new-func
  return new Function(...nomes, `"use strict";${codigo}`)(...nomes.map(n => escopo[n]))
}

function carregarEsquemas() {
  const src = fonte('js/ai.js')
  const a = src.indexOf('const S = {')
  const b = src.indexOf('// ⚠️ A REDE CONTRA O ESQUECIMENTO')
  if (a < 0 || b < 0) throw new Error('não achei o bloco S/ESQ em js/ai.js')
  return avaliar(src.slice(a, b) + '\nreturn { S, ESQ };')
}

// `lang.js` é quase puro (só duas referências ao DOM) — com dois calços ele
// roda aqui e entrega os helpers de prompt DE VERDADE: promptIpaRule,
// promptVarietyEnum, promptTypeRules e companhia.
function carregarLang() {
  const src = fonte('js/lang.js')
  const calços = 'const document={querySelector:()=>null,getElementById:()=>null},' +
                 'window={},localStorage={getItem:()=>null,setItem:()=>{}};'
  const expõe = `\nreturn { getLangDef, wordLang, promptIpaRule, promptRegrasLexicais,
    promptTypeRules, promptUnidadeDoSentido, promptVarietyEnum, promptVarietyRules };`
  return avaliar(calços + src + expõe)
}

// O parâmetro de teto de tokens NÃO é igual para todo modelo: os que
// "raciocinam" querem `max_completion_tokens` (com folga para o raciocínio),
// os outros querem `max_tokens`. Em vez de reimplementar essa regra aqui — e
// errá-la no dia em que ela mudar —, o teste usa a função do próprio app.
function carregarTokenParam() {
  const src = fonte('js/ai.js')
  const a = src.indexOf('function _aiRaciocina')
  const b = src.indexOf('// fetch com timeout + retry.')
  if (a < 0 || b < 0) throw new Error('não achei _aiTokenParam em js/ai.js')
  return avaliar(src.slice(a, b) + '\nreturn _aiTokenParam;')
}

// Os preços saem da MESMA tabela que o app usa para estimar custo — assim a
// conta do teste e a conta que ele vê na tela nunca divergem.
function carregarPrecos() {
  const src = fonte('js/ai.js')
  const a = src.indexOf('const AI_PROVIDERS = {')
  const b = src.indexOf('function aiProviderAtual')
  const tabela = avaliar(src.slice(a, b) + '\nreturn AI_PROVIDERS;')
  const p = {}
  for (const m of tabela.openai.modelos) p[m.id] = m.preco
  return p
}

const { S, ESQ } = carregarEsquemas()
const L8N = carregarLang()
const PRECOS = carregarPrecos()
const tokenParam = carregarTokenParam()

// ---------------------------------------------------------------
// 2. OS PROMPTS DE VERDADE, montados com fixtures
// ---------------------------------------------------------------
// O item de teste é o caso real que ele reportou: "digest-sized", pescado do
// Billy Summers. Usar um caso real importa — palavra de laboratório ("apple")
// não exercita citação, phrasal verb nem desambiguação por fonte.
const FIX = {
  w: {
    id: 'teste1', word: 'digest-sized', lang: 'en',
    context: "Although he's reading a digest-sized comic book called Archie's Pals 'n' Gals, he's very much on the job.",
    source_type: 'kindle', source_title: 'Billy Summers', source_context: 'Chapter 11',
    meanings: []
  },
  target: 'digest-sized',
  ctx: "Although he's reading a digest-sized comic book called Archie's Pals 'n' Gals, he's very much on the job."
}

function promptDaAnalise({ comReencontro }) {
  const src = fonte('js/review.js')
  const marca = 'const PROMPT = `Analyze this ${L.nameEn} vocabulary item'
  const i = src.indexOf(marca)
  if (i < 0) throw new Error('não achei o prompt da análise em js/review.js')
  const template = fatiarTemplate(src, i)
  if (!template) throw new Error('não consegui fatiar o template da análise')

  const w = FIX.w, L = L8N.getLangDef('en')
  // O bloco do reencontro é montado aqui igual ao app — é ele que traz o
  // `same_as`, o campo que quase ficou de fora do esquema.
  const jaTem = comReencontro
    ? [{ id: 'm1', meaning_pt: 'de formato compacto', definition_pt: 'menor que o tamanho padrão' }]
    : []
  const reencontroBlock = jaTem.length ? `
SENSES THE LEARNER ALREADY HAS FOR THIS ITEM (do not lose them, do not duplicate them):
${jaTem.map(m => `- id "${m.id}": ${m.meaning_pt}${m.definition_pt ? ` (${m.definition_pt})` : ''}`).join('\n')}
- For EVERY meaning you return, add "same_as": "<id>" when it is the SAME sense as one listed above (even if you word the Portuguese differently), or "same_as": null when it is a genuinely NEW sense.` : ''

  const escopo = {
    L, w, target: FIX.target, ctx: FIX.ctx, jaTem, reencontroBlock,
    seedBlock: '', sourceBlock: '', ...L8N
  }
  return avaliar('return `' + template + '`;', escopo)
}

function promptDaQuebra() {
  const src = fonte('js/review.js')
  const i = src.indexOf('`Break down this ${L.nameEn} snippet')
  if (i < 0) throw new Error('não achei o prompt da quebra em js/review.js')
  const template = fatiarTemplate(src, i)
  return avaliar('return `' + template + '`;', {
    L: L8N.getLangDef('en'),
    alvo: 'looks lower middle-class to Billy',
    ctx: 'Two miles from downtown they enter a neighborhood that looks lower middle-class to Billy.',
    fonte: 'Billy Summers',
    promptRegrasLexicais: L8N.promptRegrasLexicais, lang: 'en'
  })
}

// ---------------------------------------------------------------
// 3. A CHAMADA
// ---------------------------------------------------------------
async function chamar({ modelo, prompt, schema, schemaNome, maxTokens = 5000 }) {
  const corpo = {
    model: modelo,
    messages: [{ role: 'user', content: prompt }],
    ...tokenParam(modelo, maxTokens),
    ...(schema
      ? { response_format: { type: 'json_schema', json_schema: { name: schemaNome, strict: true, schema } } }
      : { response_format: { type: 'json_object' } })
  }
  const t0 = Date.now()
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CHAVE}` },
    body: JSON.stringify(corpo)
  })
  const dados = await res.json()
  const ms = Date.now() - t0
  if (!res.ok) return { erro: (dados.error && dados.error.message) || `HTTP ${res.status}`, ms }
  const c = dados.choices && dados.choices[0]
  const uso = dados.usage || {}
  let json = null
  try { json = JSON.parse((c && c.message && c.message.content) || '') } catch {}
  const preco = PRECOS[modelo] || { in: 0, out: 0 }
  const usd = (uso.prompt_tokens || 0) / 1e6 * preco.in + (uso.completion_tokens || 0) / 1e6 * preco.out
  return {
    json, ms, fim: c && c.finish_reason,
    entrada: uso.prompt_tokens || 0, saida: uso.completion_tokens || 0,
    raciocinio: (uso.completion_tokens_details || {}).reasoning_tokens || 0,
    usd, brl: usd * COTACAO,
    bruto: (c && c.message && c.message.content) || ''
  }
}

const money = r => `US$ ${r.usd.toFixed(5)} (R$ ${r.brl.toFixed(4)})`

// ---------------------------------------------------------------
// 4. OS TESTES
// ---------------------------------------------------------------

// O mais barato e o mais importante: a API valida o esquema ANTES de gerar.
// Um esquema malformado volta 400 na hora, gastando quase nada — é aqui que se
// descobre `additionalProperties` faltando ou `required` incompleto.
async function testeEsquemas() {
  console.log('\n=== OS 7 CONTRATOS, contra a API de verdade ===')
  let ok = 0
  for (const [nome, schema] of Object.entries(ESQ)) {
    const r = await chamar({
      modelo: 'gpt-5.6-luna', schema, schemaNome: nome, maxTokens: 400,
      prompt: 'Return the JSON object required by the schema. Use empty strings and empty arrays everywhere.'
    })
    if (r.erro) { console.log(`  ✗ ${nome.padEnd(10)} RECUSADO: ${r.erro}`); continue }
    ok++
    const campos = r.json ? Object.keys(r.json).length : 0
    console.log(`  ✓ ${nome.padEnd(10)} aceito · ${campos} campos na raiz · ${r.saida} tokens · ${money(r)}`)
  }
  console.log(`  → ${ok}/${Object.keys(ESQ).length} contratos aceitos`)
}

// Conta o que veio PREENCHIDO. É a pergunta que sobra depois do contrato: o
// modo estrito obriga o campo a existir, não a ter conteúdo — e um modelo
// pequeno pode devolver 30 campos vazios e "cumprir" o contrato.
function preenchimento(m) {
  const vazio = v => v == null || v === '' || (Array.isArray(v) && !v.length)
  const cheios = [], vazios = []
  for (const [k, v] of Object.entries(m || {})) (vazio(v) ? vazios : cheios).push(k)
  return { cheios, vazios }
}

async function testeAnalise() {
  console.log('\n=== A ANÁLISE COMPLETA — Luna × gpt-4o-mini, mesmo prompt ===')
  for (const comReencontro of [false, true]) {
    const prompt = promptDaAnalise({ comReencontro })
    console.log(`\n-- ${comReencontro ? 'COM reencontro (exige same_as)' : 'item novo'} · prompt com ${prompt.length} caracteres`)
    for (const modelo of ['gpt-5.6-luna', 'gpt-4o-mini']) {
      for (const comEsquema of [true, false]) {
        const r = await chamar({
          modelo, prompt, maxTokens: 5000,
          schema: comEsquema ? ESQ.analise : null, schemaNome: 'analise'
        })
        const rot = `${modelo} ${comEsquema ? '+esquema' : ' cru    '}`
        if (r.erro) { console.log(`  ✗ ${rot}  ERRO: ${r.erro}`); continue }
        if (!r.json) { console.log(`  ✗ ${rot}  não voltou JSON (fim: ${r.fim})`); continue }
        const m = (r.json.meanings || [])[0] || {}
        const p = preenchimento(m)
        const truncou = r.fim === 'length'
        console.log(`  ${truncou ? '⚠' : '✓'} ${rot}  ${r.entrada}→${r.saida} tokens` +
          `${r.raciocinio ? ` (${r.raciocinio} pensando)` : ''} · ${(r.ms / 1000).toFixed(1)}s · ${money(r)}` +
          `${truncou ? '  ⚠ TRUNCOU NO TETO' : ''}`)
        console.log(`      sentidos: ${(r.json.meanings || []).length} · campos preenchidos: ${p.cheios.length}/${p.cheios.length + p.vazios.length}` +
          `${p.vazios.length ? ` · vazios: ${p.vazios.join(', ')}` : ''}`)
        console.log(`      word="${r.json.word}" lemma="${r.json.lemma}" type=${r.json.type} audit=${(r.json.sense_audit || []).length} linhas`)
        if (comReencontro) console.log(`      same_as: ${JSON.stringify(m.same_as)} ${m.same_as === 'm1' ? '✓ reconheceu o sentido que ele já tinha' : '⚠ não casou'}`)
      }
    }
  }
}

async function testeChips() {
  console.log('\n=== A QUEBRA DO TRECHO — o caso do vazamento ===')
  console.log('    marcado: "looks lower middle-class to Billy"')
  console.log('    frase:   "Two miles from downtown they enter a neighborhood that looks lower middle-class to Billy."')
  const prompt = promptDaQuebra()
  const DENTRO = 'looks lower middle-class to billy'
  for (const modelo of ['gpt-5.6-luna', 'gpt-4o-mini']) {
    for (const comEsquema of [true, false]) {
      const r = await chamar({ modelo, prompt, maxTokens: 800, schema: comEsquema ? ESQ.quebra : null, schemaNome: 'quebra' })
      const rot = `${modelo} ${comEsquema ? '+esquema' : ' cru    '}`
      if (r.erro || !r.json) { console.log(`  ✗ ${rot}  ${r.erro || 'sem JSON'}`); continue }
      const items = r.json.items || []
      const vazando = items.filter(it => !DENTRO.includes(String(it.expr || '').toLowerCase()))
      const tipoTorto = items.filter(it => !['word','phrasal_verb','idiom','collocation','chunk'].includes(it.type))
      console.log(`  ✓ ${rot}  ${items.length} unidades · ${r.saida} tokens · ${money(r)}`)
      console.log(`      ${items.map(i => `${i.expr} [${i.type}]`).join(' · ') || '(nenhuma)'}`)
      console.log(`      vazou do contexto: ${vazando.length ? vazando.map(i => i.expr).join(', ') : 'nada ✓'}` +
        ` · tipo fora do enum: ${tipoTorto.length ? tipoTorto.map(i => i.type).join(', ') : 'nenhum ✓'}`)
    }
  }
}

// SECO — monta tudo e não chama ninguém. É o teste do TESTE: prova que a
// leitura do código-fonte ainda funciona depois de mexer nos prompts, sem
// gastar um centavo. Rode este primeiro sempre que o app mudar.
function testeSeco() {
  console.log('\n=== MONTAGEM (nenhuma chamada, nenhum custo) ===')
  console.log(`  esquemas lidos de js/ai.js: ${Object.keys(ESQ).join(', ')}`)
  console.log(`  helpers de js/lang.js: ${Object.keys(L8N).length} funções`)
  console.log(`  preços lidos da tabela do app: ${Object.keys(PRECOS).length} modelos`)
  for (const comReencontro of [false, true]) {
    const p = promptDaAnalise({ comReencontro })
    const temSameAs = p.includes('same_as')
    console.log(`  prompt da análise ${comReencontro ? '(com reencontro)' : '(item novo)  '}: ` +
      `${String(p.length).padStart(5)} caracteres · ~${Math.round(p.length / 4)} tokens · same_as no prompt: ${temSameAs}`)
  }
  const q = promptDaQuebra()
  console.log(`  prompt da quebra: ${q.length} caracteres · ~${Math.round(q.length / 4)} tokens`)
  // A mesma conferência do navegador, agora fora dele: campo do prompt que o
  // esquema não conhece seria campo PROIBIDO pelo modo estrito.
  const chaves = t => new Set((String(t).match(/"([a-z_]+)"\s*:/g) || []).map(x => x.replace(/["\s:]/g, '')))
  const doEsq = e => { const s = new Set(); (function anda(n) {
    if (!n || typeof n !== 'object') return
    if (n.properties) Object.keys(n.properties).forEach(k => { s.add(k); anda(n.properties[k]) })
    if (n.items) anda(n.items)
  })(e); return s }
  const alvo = doEsq(ESQ.analise)
  const faltando = [...chaves(promptDaAnalise({ comReencontro: true }))].filter(k => !alvo.has(k))
  console.log(`  campos citados no prompt e AUSENTES no esquema: ${faltando.length ? faltando.join(', ') : 'nenhum ✓'}`)
  console.log('    (podem aparecer falsos positivos: a varredura pega qualquer "chave": do texto)')
}

// ---------------------------------------------------------------
const qual = (process.argv[2] || 'seco').toLowerCase()
const tudo = qual === 'tudo'
try {
  if (qual === 'seco') { testeSeco(); process.exit(0) }
  if (!CHAVE) {
    console.error('Falta OPENAI_API_KEY no ambiente. Veja o cabeçalho deste arquivo.')
    console.error('Sem chave, só o modo "seco" roda:  node tools/teste-ia.mjs seco')
    process.exit(1)
  }
  console.log(`chave: ...${CHAVE.slice(-4)} · cotação R$ ${COTACAO.toFixed(2)}/US$`)
  if (tudo) testeSeco()
  if (tudo || qual === 'esquemas') await testeEsquemas()
  if (tudo || qual === 'analise')  await testeAnalise()
  if (tudo || qual === 'chips')    await testeChips()
} catch (e) {
  console.error('\nfalhou:', e.message)
  process.exit(1)
}
