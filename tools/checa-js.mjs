// ================================================================
// CHECA-JS — a rede contra o que o `node --check` não vê
// ================================================================
// ⚠️ ESTE ARQUIVO EXISTE POR CAUSA DE UM ERRO MEU. Editando `js/manga.js` por
// substituição de trecho, eu apaguei QUATRO funções sem perceber: o arquivo
// continuou com sintaxe válida (`node --check` passou), a chamada quebrada só
// estourava em tempo de execução, e o `try/catch` em volta a engolia — o app
// caía calado no caminho de reserva. Só o teste com dado real pegou, e depois
// de duas rodadas interpretando o sintoma errado.
//
// USO: node tools/checa-js.mjs [arquivo...]
//      (sem argumento, varre js/*.js)

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const alvos = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('js').filter(f => f.endsWith('.js')).map(f => join('js', f))

// ⚠️ O CONJUNTO DE DEFINIÇÕES É O DO APP INTEIRO, e não o do arquivo. Aqui não
// há módulos: `js/ler.js` chama função de `js/manga.js` o tempo todo, e checar
// arquivo por arquivo acusaria dezenas de chamadas legítimas — ruído que
// treina a ignorar o aviso.
const todos = readdirSync('js').filter(f => f.endsWith('.js')).map(f => join('js', f))
const fonteToda = todos.map(f => readFileSync(f, 'utf8')).join(String.fromCharCode(10))
const definidas = new Set([
  ...[...fonteToda.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]),
  ...[...fonteToda.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)].map(m => m[1])
])

let problemas = 0
for (const arq of alvos) {
  const src = readFileSync(arq, 'utf8')
  const defs = [...src.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1])
  const dup = [...new Set(defs.filter((n, i) => defs.indexOf(n) !== i))]
  // Só os nomes internos (com `_`): são os que uma edição de trecho pode
  // apagar sem que nada acuse.
  const chamadas = [...new Set([...src.matchAll(/(_[A-Za-z][\w$]*)\s*\(/g)].map(m => m[1]))]
  const orfas = chamadas.filter(n => !definidas.has(n))
  if (orfas.length) { console.error(`${arq}: chamada sem definição em lugar nenhum -> ${orfas.join(', ')}`); problemas++ }
  if (dup.length) { console.error(`${arq}: função definida duas vezes -> ${dup.join(', ')}`); problemas++ }
}
console.log(problemas ? `
${problemas} problema(s).` : 'ok: nenhuma função órfã ou duplicada.')
process.exit(problemas ? 1 : 0)
