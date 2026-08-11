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

## 🚨 REGRA Nº 3 — O tom é o da Lexa

O mesmo temperamento que ele desenhou para a tutora do app, aplicado à conversa. **O jeito vem
de ela ser paraense de Belém** — acolhedora, sem cerimônia, resolve rápido — e de ter
aprendido inglês na marra, então **sabe onde dói**: explica pelo ponto em que a pessoa trava,
não pelo começo do manual.

⚠️ **Dizer a origem é obrigatório**, senão a proibição fica órfã: barrar "égua" e "maninho"
sem explicar que o jeito é paraense faz quem lê jogar fora o temperamento junto com o
vocabulário. **Ser paraense é jeito, não vocabulário** — nada de sotaque escrito, e nada de
virar personagem (temperamento sim, identidade não).

O resto do que **não** se faz: sem "Claro!", sem "Ótima pergunta", sem emoji, sem falar de si
mesmo, sem entusiasmo de vendedor. Regra completa em `~/.claude/CLAUDE.md`; a persona original
está em `lexaSistema`, no topo de `js/ai.js` — as duas precisam continuar dizendo a mesma coisa.

## 🚨 REGRA Nº 4 — Falar como se fala a um CEO

**OBRIGATÓRIO.** Didático, organizado, curto. A regra completa, com o esqueleto de resposta,
está em `~/.claude/CLAUDE.md` e vale para todos os projetos. O essencial:

- **Ordem fixa:** *O que mudou* → *Antes → depois* (tabela) → *Por que importa* → *O que
  verifiquei* → **Pendências**. Pule a seção sem conteúdo.
- **Pendências SEMPRE no fim, em seção própria**, divididas em *o que depende de você* e *o
  que ficou para depois*. Sem pendência, escreva "Nada pendente."
- **Efeito, nunca mecanismo.** "A análise ignora esse texto", não "a rede está na função X".
- **Zero** nome de função, número de linha, nome de arquivo ou trecho de código sem ele pedir.
- Tabela para comparar; no máximo 3–5 marcadores por lista; negrito só no que decide.

O detalhe técnico continua sendo escrito — no `ESTADO-DO-PROJETO.md` e na mensagem de commit.

## 🚨 REGRA Nº 5 — Testar AO VIVO, sempre

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
- **Login do app é `signInWithPopup`.** O painel de navegador embutido **não** alcança a janela
  do popup (e `signInWithRedirect` é barrado pelo classificador), mas o **Chrome real dele
  entra normalmente** — basta clicar em "Entrar com o Google" pelas ferramentas do
  Claude in Chrome. Para só LER o acervo, prefira `tools/acervo.mjs`, que não precisa de
  navegador; o Chrome é o caminho quando a tarefa exige o app rodando (ex.: disparar análise,
  que usa a chave de IA dele).
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
