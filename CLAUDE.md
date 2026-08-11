# CLAUDE.md — Instruções do projeto English Lab

> Este arquivo é lido automaticamente no início de cada sessão. Siga-o sempre.

## 🚨 REGRA Nº 1 — Antes de qualquer tarefa

**LEIA o arquivo [`ESTADO-DO-PROJETO.md`](./ESTADO-DO-PROJETO.md) por completo antes de começar
qualquer coisa.** Ele contém: o que é o projeto, a arquitetura, o modelo de dados, como funciona
a sincronização e o SRS, o histórico do que já foi feito, as pendências e as armadilhas. É o
mapa para dar continuidade sem quebrar nada.

## 🚨 REGRA Nº 2 — Ao finalizar QUALQUER tarefa

**ATUALIZE o `ESTADO-DO-PROJETO.md`** para refletir o que mudou:
- Adicione o que foi feito ao histórico (seção 8).
- Atualize as pendências (seção 9) — marque o que foi concluído, adicione novas.
- Se mudou arquitetura, modelo de dados, sync, SRS ou convenções, atualize as seções
  correspondentes.
- Atualize a data de "Última atualização" no topo.

O `ESTADO-DO-PROJETO.md` precisa estar SEMPRE atualizado — é o que garante a continuidade.

## 🚨 REGRA Nº 3 — Falar como se fala a um CEO

**OBRIGATÓRIO.** A resposta é um **resumo executivo**: o que mudou, o que isso significa para
ele, o que ele precisa decidir ou fazer. Curto.

- **Nada de detalhe técnico não solicitado.** Nome de função, número de linha, nome de
  arquivo, trecho de código, nome de campo do banco — **fora**, a menos que ele pergunte ou
  precise agir sobre aquilo.
- **Fale do efeito, não do mecanismo.** "A análise ignora esse texto" e não "a rede está em
  `analyzeWordDirect`". "O app confere no livro antes de decidir" e não "`obraBuscar` com
  `ateCap`".
- **Comece pela conclusão.** Se ele só ler a primeira linha, ela tem que bastar.
- **Poucos itens, sem paredes de texto.** Tabela ou 3–5 marcadores resolvem quase tudo.
- **O que ele precisa fazer vai destacado e no fim**, em uma linha.
- Erro meu ou risco: diga em uma frase, sem autópsia.

O detalhe técnico continua sendo escrito — só que **no `ESTADO-DO-PROJETO.md` e na mensagem
de commit**, que é onde ele pertence. A resposta no chat é para decidir, não para auditar.

## 🚨 REGRA Nº 4 — Testar AO VIVO, sempre

**Nenhuma alteração é dada por pronta sem ter rodado de verdade.** Ler o código e achar que
está certo não conta; "deve funcionar" não conta; teste sintético com dado inventado não
fecha sozinho o que envolve o acervo dele.

O que "ao vivo" significa aqui, em ordem de força:

1. **Dado real, pelo terminal** — `node tools/acervo.mjs tudo` lê o Firestore direto, sem
   navegador e sem login (credencial só-leitura em `_dados-de-teste/firebase-admin.json`).
   É o caminho padrão para qualquer dúvida sobre o acervo: quantos itens, o que está torto,
   se o conserto pegou. **Nunca peça a ele que exporte JSON nem que leia tela por você.**
2. **O app rodando** — `preview_start` + `javascript_tool` para exercitar a função nova com os
   casos que motivaram a mudança, e `read_console_messages` para conferir que não sobrou erro.
3. **A tela** — quando a mudança é visível: conferir texto renderizado, ausência de emoji,
   nada de overflow. Se o painel do navegador não estiver em exibição, `innerWidth` volta 0 e a
   medição não vale nada: **diga isso em vez de fingir que mediu.**

E relate o que foi testado com o resultado na mão — número, saída, trecho. Afirmação sem
evidência é o mesmo que não ter testado.

⚠️ **Isto vale principalmente contra o erro de assumir.** Já aconteceu três vezes nesta
colaboração: afirmar que a extensão não tinha acesso à IA (tinha), registrar `tuck` como
sentido duplicado (o `moved_to` estava lá), e projetar a correção de capítulo "de brinde" (o
livro mostrou que `tuck in` aparece no *Chapter 20* sem ter vindo de lá). Nos três casos, dez
segundos olhando o real teriam evitado o erro.

## Regras rápidas do projeto

- **Trabalhe sempre na pasta `english-lab`** (é o repositório clonado; o deploy é automático
  via GitHub Pages — não precisa commitar à mão).
- **Sem emojis na interface** — use o helper `ic('nome')` (ícones SVG em `js/core.js`).
- **Toda cor via variável CSS**; acentos com `rgba(var(--primary-rgb), …)` para seguir o tema ativo.
- **Cuidado com lazy-loading:** `js/add.js` e `js/study.js` carregam sob demanda. Não use
  funções/variáveis deles em arquivos não-lazy (ver detalhes em `ESTADO-DO-PROJETO.md`, seção 2).
- **O shell/bash vê cópias desatualizadas** dos arquivos (sincronização do OneDrive). Não confie
  em `node -c` via bash; valide com a ferramenta de leitura ou inspecionando o app ao vivo
  (Claude in Chrome).
- **O navegador serve JS em cache** mesmo depois de editar o arquivo. Antes de testar, force:
  `fetch(arquivo, {cache:'reload'})` nos `.js` tocados e só então `location.reload()` — senão
  você testa a versão velha e comemora errado.
- **Login do app é `signInWithPopup`**, e o painel de navegador não alcança a janela do popup
  (o caminho por `signInWithRedirect` é barrado pelo classificador). Para dado real, use o
  `tools/acervo.mjs` — não insista no login.
- **Mudanças de dados/sync são de alto risco** — recomende backup (Configurações → Exportar JSON)
  antes de testar.
- **Responda ao Djemeson em português.**


## Olhar para o horizonte (regra permanente)

Vale para tudo que for implementado, ajustado ou corrigido aqui: **nunca parar no caso que
apareceu**. Antes de encerrar, verificar causa raiz, onde mais o mesmo padrão existe no
projeto, o que a mudança pode quebrar (estado velho, cache, contagem dupla, dado já salvo no
aparelho) e os casos vizinhos que ainda vão acontecer. Relatar o que foi verificado além do
pedido e o que ficou de fora — se algo for grande demais para a rodada, vira pendência
registrada, nunca silêncio.

> A versão completa desta regra está em `~/.claude/CLAUDE.md` e vale para todos os projetos.
