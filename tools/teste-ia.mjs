#!/usr/bin/env node
// ================================================================
// BATERIA DE TESTES CONTRA A API DE VERDADE
// ================================================================
// Responde o que o navegador não responde: se a API ACEITA os esquemas
// estritos, se a Luna preenche todos os campos sem truncar, quanto custa de
// verdade cada chamada, e como ela se sai contra o modelo antigo nos MESMOS
// prompts.
//
//   node tools/teste-ia.mjs esquemas     # barato: só valida os contratos
//   node tools/teste-ia.mjs analise      # a análise completa, Luna × 4o-mini
//   node tools/teste-ia.mjs chips        # a quebra do trecho (vazamento/enum)
//   node tools/teste-ia.mjs gemini       # a MESMA análise/quebra no Gemini,
//                                        # como o app chama (GEMINI_API_KEY)
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

// Lê o `.env` sozinho quando a variável não está no ambiente. Não é conveniência
// à toa: o `.env` é editado no Bloco de Notas, que salva com quebra de linha do
// Windows (CRLF) — e um `\r` grudado no fim da chave vira 401 sem explicação
// nenhuma. Aqui a leitura corta o `\r`, as aspas e os espaços.
function doEnv(nome) {
  if (process.env[nome]) return String(process.env[nome]).trim()
  try {
    for (const linha of fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)) {
      const t = linha.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i > 0 && t.slice(0, i).trim() === nome) return t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
  return ''
}

const CHAVE = doEnv('OPENAI_API_KEY')
// A bateria do Gemini (melhoria 7, rodada 44): os prompts do app rodavam só
// contra a OpenAI — e a família inteira de defeitos da troca de fornecedor
// (modelo cravado, folga de raciocínio, JSON sem contrato de forma) passou
// batida até doer em produção. Com GEMINI_API_KEY no .env, o modo `gemini`
// roda a análise e a quebra contra a camada compatível do Google, do jeito
// que o APP chama (json_object, nunca json_schema; folga via max_tokens).
const CHAVE_GEMINI = doEnv('GEMINI_API_KEY')
const COTACAO = Number(doEnv('USD_BRL') || 5.40)   // só para a estimativa em reais

const PROVS = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', chave: () => CHAVE, json: 'schema' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            chave: () => CHAVE_GEMINI, json: 'objeto' }
}

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
  // Todos os fornecedores (melhoria 7): a conta do Gemini sai da mesma tabela.
  for (const prov of Object.values(tabela)) for (const m of (prov.modelos || [])) p[m.id] = m.preco
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
async function chamar({ modelo, prompt, schema, schemaNome, maxTokens = 5000, prov = 'openai' }) {
  const P = PROVS[prov]
  // Espelha o app: fornecedor sem `json_schema` fica no `json_object` — o
  // teste tem de exercitar exatamente o caminho que o app percorre lá.
  const usaEsquema = schema && P.json === 'schema'
  const corpo = {
    model: modelo,
    messages: [{ role: 'user', content: prompt }],
    ...tokenParam(modelo, maxTokens),
    ...(usaEsquema
      ? { response_format: { type: 'json_schema', json_schema: { name: schemaNome, strict: true, schema } } }
      : { response_format: { type: 'json_object' } })
  }
  const t0 = Date.now()
  const res = await fetch(P.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${P.chave()}` },
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

// ---------------------------------------------------------------
// A WEB — sondagem da Responses API
// ---------------------------------------------------------------
// Território novo: o app inteiro fala `chat/completions`, e a busca na web só
// existe na `responses`. Antes de desenhar qualquer coisa, MEDIR — o formato
// da resposta, se o `auto` de fato decide sozinho quando buscar, se vêm as
// fontes, quanto custa e quanto demora. Nada disto se adivinha.
async function chamarResponses({ modelo, entrada, comWeb, maxTokens = 900 }) {
  const corpo = {
    model: modelo,
    input: entrada,
    max_output_tokens: maxTokens + 25000,   // mesma folga de raciocínio do app
    ...(comWeb ? { tools: [{ type: 'web_search' }], tool_choice: 'auto' } : {})
  }
  const t0 = Date.now()
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CHAVE}` },
    body: JSON.stringify(corpo)
  })
  const d = await res.json()
  const ms = Date.now() - t0
  if (!res.ok) return { erro: (d.error && d.error.message) || `HTTP ${res.status}`, ms, cru: d }
  // O formato é aprendido AQUI, da resposta real — não de memória.
  const saida = Array.isArray(d.output) ? d.output : []
  const tipos = saida.map(o => o.type)
  const texto = saida.filter(o => o.type === 'message')
    .flatMap(o => (o.content || []).filter(c => c.type === 'output_text'))
  const uso = d.usage || {}
  const preco = PRECOS[modelo] || { in: 0, out: 0 }
  const usd = (uso.input_tokens || 0) / 1e6 * preco.in + (uso.output_tokens || 0) / 1e6 * preco.out
  return {
    ms, status: d.status, tipos,
    buscou: tipos.some(t => String(t).includes('web_search')),
    texto: texto.map(c => c.text).join('\n').trim(),
    citacoes: texto.flatMap(c => (c.annotations || []).map(a => a.url || a.title || a.type)),
    entrada: uso.input_tokens || 0, saida: uso.output_tokens || 0,
    raciocinio: (uso.output_tokens_details || {}).reasoning_tokens || 0,
    usd, brl: usd * COTACAO, chaves: Object.keys(d)
  }
}

async function testeWeb() {
  console.log('\n=== A LEXA NA WEB — sondagem da Responses API ===')
  const M = 'gpt-5.6-luna'
  // Três perguntas, escolhidas pelo que o app REALMENTE faz:
  //  A) referência cultural concreta — é o caso que hoje sai da memória do
  //     modelo e pode virar invenção;
  //  B) palavra comum — não deve valer uma busca;
  //  C) a mesma A sem a ferramenta, para comparar a resposta lado a lado.
  const casos = [
    ['referência cultural (com web)', true,  `O aluno está lendo "Billy Summers", de Stephen King, e encontrou: "Archie's Pals 'n' Gals". Explique em português do Brasil o que é isso no mundo real: que publicação é, de quem, de que época.`],
    ['referência cultural (sem web)', false, `O aluno está lendo "Billy Summers", de Stephen King, e encontrou: "Archie's Pals 'n' Gals". Explique em português do Brasil o que é isso no mundo real: que publicação é, de quem, de que época.`],
    ['palavra comum (com web)',       true,  `A frase é: "The houses are nothing fancy." O aluno selecionou "fancy". Explique em português do Brasil o que significa AQUI.`]
  ]
  for (const [nome, comWeb, entrada] of casos) {
    const r = await chamarResponses({ modelo: M, entrada, comWeb })
    if (r.erro) { console.log(`  ✗ ${nome}: ${r.erro}`); if (r.cru) console.log('    ', JSON.stringify(r.cru).slice(0, 300)); continue }
    console.log(`  ✓ ${nome}`)
    console.log(`      buscou na web: ${r.buscou ? 'SIM' : 'não'} · blocos: ${r.tipos.join(', ')}`)
    console.log(`      ${r.entrada}→${r.saida} tokens${r.raciocinio ? ` (${r.raciocinio} pensando)` : ''} · ${(r.ms/1000).toFixed(1)}s · ${money(r)}`)
    if (r.citacoes.length) console.log(`      fontes: ${[...new Set(r.citacoes)].slice(0,4).join(' · ')}`)
    console.log(`      resposta: ${r.texto.replace(/\s+/g,' ').slice(0, 260)}…`)
  }
}

// O PREÇO DE APENAS OFERECER A FERRAMENTA.
// A primeira sondagem deixou uma suspeita grande: a pergunta sobre "fancy" NÃO
// buscou nada e mesmo assim contou 4.473 tokens de entrada, para um prompt de
// umas 40 palavras. Se a definição da ferramenta entra no contexto toda vez,
// ligar a web encarece TODA explicação — inclusive as que nunca vão usá-la.
// Isso decide o desenho inteiro, então merece medição isolada: mesma pergunta,
// mesmo modelo, só muda oferecer ou não.
async function testeWebCusto() {
  console.log('\n=== QUANTO CUSTA SÓ TER A FERRAMENTA À MÃO ===')
  const M = 'gpt-5.6-luna'
  const p = 'A frase é: "The houses are nothing fancy." O aluno selecionou "fancy". Explique em português do Brasil o que significa AQUI.'
  const a = await chamarResponses({ modelo: M, entrada: p, comWeb: false })
  const b = await chamarResponses({ modelo: M, entrada: p, comWeb: true })
  if (a.erro || b.erro) { console.log('  ✗', a.erro || b.erro); return }
  console.log(`  sem a ferramenta: ${a.entrada} tokens de entrada · ${money(a)} · ${(a.ms/1000).toFixed(1)}s`)
  console.log(`  com a ferramenta: ${b.entrada} tokens de entrada · ${money(b)} · ${(b.ms/1000).toFixed(1)}s · buscou: ${b.buscou ? 'sim' : 'não'}`)
  console.log(`  → o pedágio de ter a ferramenta à mão: ${b.entrada - a.entrada} tokens, ${(b.brl / (a.brl || 1e-9)).toFixed(1)}× o custo`)
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
// A BATERIA DO GEMINI (melhoria 7): os mesmos prompts de verdade, contra a
// camada compatível do Google, do jeito que o app chama. É o teste que teria
// pego a família inteira de defeitos da troca de fornecedor antes de doer.
async function testeGemini() {
  const modelo = 'gemini-flash-lite-latest'   // o padrão do app no Gemini
  console.log(`\n=== A BATERIA DO GEMINI — ${modelo}, json_object + folga (como o app) ===`)
  // 1) análise completa
  const prompt = promptDaAnalise({ comReencontro: false })
  const r = await chamar({ prov: 'gemini', modelo, prompt, maxTokens: 5000 })
  if (r.erro) console.log(`  ✗ análise  ERRO: ${r.erro}`)
  else if (!r.json) console.log(`  ✗ análise  não voltou JSON legível (fim: ${r.fim}) — é o sintoma da falta de folga`)
  else {
    const m = (r.json.meanings || [])[0] || {}
    const p = preenchimento(m)
    console.log(`  ✓ análise  ${r.entrada}→${r.saida} tokens${r.raciocinio ? ` (${r.raciocinio} pensando)` : ''} · ${(r.ms / 1000).toFixed(1)}s · ${money(r)}`)
    console.log(`      word="${r.json.word}" type=${r.json.type} · sentidos: ${(r.json.meanings || []).length} · campos preenchidos: ${p.cheios.length}/${p.cheios.length + p.vazios.length}`)
  }
  // 2) quebra do trecho (o vazamento)
  const pq = promptDaQuebra()
  const DENTRO = 'looks lower middle-class to billy'
  const r2 = await chamar({ prov: 'gemini', modelo, prompt: pq, maxTokens: 800 })
  if (r2.erro || !r2.json) console.log(`  ✗ quebra   ${r2.erro || `sem JSON (fim: ${r2.fim})`}`)
  else {
    const items = r2.json.items || []
    const vazando = items.filter(it => !DENTRO.includes(String(it.expr || '').toLowerCase()))
    const tipoTorto = items.filter(it => !['word','phrasal_verb','idiom','collocation','chunk'].includes(it.type))
    console.log(`  ✓ quebra   ${items.length} unidades · ${r2.saida} tokens · ${money(r2)}`)
    console.log(`      vazou do contexto: ${vazando.length ? vazando.map(i => i.expr).join(', ') : 'nada ✓'}` +
      ` · tipo fora do enum: ${tipoTorto.length ? tipoTorto.map(i => i.type).join(', ') : 'nenhum ✓'}`)
  }
  console.log('  (sem contrato de forma aqui de propósito: o Gemini fica no json_object, como no app —')
  console.log('   tipo fora do enum é o que as camadas tolerantes do app existem para segurar)')
}

// ---------------------------------------------------------------
const qual = (process.argv[2] || 'seco').toLowerCase()
const tudo = qual === 'tudo'
try {
  if (qual === 'seco') { testeSeco(); process.exit(0) }
  if (qual === 'gemini') {
    if (!CHAVE_GEMINI) {
      console.error('Falta GEMINI_API_KEY no .env (mesmo formato da OPENAI_API_KEY).')
      process.exit(1)
    }
    console.log(`chave Gemini: ...${CHAVE_GEMINI.slice(-4)} · cotação R$ ${COTACAO.toFixed(2)}/US$`)
    await testeGemini()
    process.exit(0)
  }
  if (!CHAVE) {
    console.error('Falta OPENAI_API_KEY no ambiente. Veja o cabeçalho deste arquivo.')
    console.error('Sem chave, só o modo "seco" roda:  node tools/teste-ia.mjs seco')
    console.error('(o modo "gemini" usa GEMINI_API_KEY e roda sem a da OpenAI)')
    process.exit(1)
  }
  console.log(`chave: ...${CHAVE.slice(-4)} · cotação R$ ${COTACAO.toFixed(2)}/US$`)
  if (tudo) testeSeco()
  if (tudo || qual === 'esquemas') await testeEsquemas()
  if (tudo || qual === 'analise')  await testeAnalise()
  if (tudo || qual === 'chips')    await testeChips()
  if (tudo || qual === 'web')      await testeWeb()
  if (tudo || qual === 'webcusto') await testeWebCusto()
  if (tudo && CHAVE_GEMINI)        await testeGemini()
} catch (e) {
  console.error('\nfalhou:', e.message)
  process.exit(1)
}
