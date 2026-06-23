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
- **Mudanças de dados/sync são de alto risco** — recomende backup (Configurações → Exportar JSON)
  antes de testar.
- **Responda ao Djemeson em português.**
