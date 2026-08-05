# Language Lab — Netflix e Kindle (extensão do Chrome)

Duas fontes, um destino. Clique numa palavra (legenda da Netflix ou página do
Kindle no navegador) e ela é capturada **com a frase e o título**; ao abrir o
Language Lab, tudo entra no **Revisar** automaticamente — e dali segue o fluxo
normal (triagem, análise com IA, SRS).

A extensão **não guarda nenhuma chave de API** e não fala com nenhum servidor:
ela só observa o que a página desenha na tela e guarda suas capturas no
armazenamento local do Chrome até você abrir o app.

## Instalar (1 minuto)

1. Abra `chrome://extensions` no Chrome.
2. Ligue o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha esta pasta:
   `Claude Cowork/Claude Code/english-lab-2.0/extension`
4. Pronto. Abra um episódio na Netflix com legenda em inglês — ou um livro em
   `read.amazon.com`.

## Kindle Cloud Reader (`read.amazon.com`)

Lendo no navegador, **selecione a palavra** e aparece uma pílula com:

| Botão | O que faz |
|---|---|
| **Revisar** | manda a palavra + a frase daquela página para o Revisar |
| **frase** | manda só a frase (o Raio-X do Lab tria depois) |
| **auto** | liga o modo automático: **toda palavra selecionada vai sozinha**, com um "desfazer" de 4 segundos |

O modo **auto** é o que mais se aproxima do pedido "toda marcação vai para o
Revisar": você lê, seleciona a palavra que não conhece e segue lendo.

Funciona também em **documento pessoal** (Enviar para Kindle): aqui não existe
a limitação do Vocabulary Builder do aparelho, porque a captura é nossa.

Para quem lê no **aparelho** (e-ink), a ponte é por arquivo — veja a aba
**Adicionar → Kindle** do app: `vocab.db` (palavras consultadas, com a frase de
contexto) e `My Clippings.txt` (destaques, inclusive em documentos pessoais).

## O que ela faz na Netflix (o módulo Vídeo do app, dentro do player)

| No player | Como |
|---|---|
| Legenda com palavras clicáveis | clique numa palavra → captura |
| Frase inteira | botão **+** |
| Explicar / Estudar um trecho | **selecione** com o mouse na legenda |
| Tradução PT-BR pela IA | botão **PT** (tecla `P`) |
| Névoa na tradução | botão **◐** (borrada até passar o mouse) |
| Fala anterior / repetir / próxima | **‹‹ ↺ ››** (teclas `←` `R` `→`) |
| Transcript do episódio, clicável e com busca | botão **≡** (tecla `T`) |
| Esconder a legenda original | botão **cc** |
| **Selecionar um trecho** | arraste com o mouse sobre a legenda |
| **Seção abaixo do vídeo / legenda flutuante** | botão de alternar (chevron) — na seção, o vídeo encolhe e nada cobre a cena |
| **Régua de falas** | cada bloco é uma fala (largura = duração, vão = silêncio); clique para ir até lá |

A tradução e o Explicar usam a **sua** chave de IA — espelhada automaticamente
do Language Lab na primeira vez que você abre o app com a extensão instalada.
Nenhuma chave é digitada aqui, e as chamadas saem do service worker da extensão
(nunca da página da Netflix).

## Usar

- A barra do Language Lab aparece sobre o player, com a fala atual.
- **Clique numa palavra** → capturada (pisca verde).
- **"+ frase"** → captura a fala inteira (vira uma frase no Revisar, com direito
  ao Raio-X da triagem).
- **cc** → mostra/esconde a legenda original da Netflix (a nossa fica no lugar).
- **⏸** → liga/desliga o "pausar enquanto o mouse está na barra".
- **×** → esconde a barra (religa pelo ícone da extensão).
- O ícone da extensão mostra as capturas pendentes e o botão
  **Abrir o Language Lab**, que entrega tudo no Revisar.

## Limitações conhecidas

- Funciona no player web da Netflix (chrome/edge). O app de TV/celular não.
- Se a Netflix mudar o HTML do player, a captura pode parar até ajustarmos o
  seletor (`.player-timedtext`).
- No Kindle Cloud Reader a frase de contexto sai do parágrafo que a página
  desenhou: se a palavra cair na virada da página, o contexto pode vir cortado.
- O Kindle **de e-ink** não fala com a rede: ali a captura é por arquivo
  (`vocab.db` / `My Clippings.txt`), não em tempo real. Nenhuma extensão do
  mundo resolve isso — a Amazon não expõe as consultas por API.

## Sobre a lista "Erros" em chrome://extensions

O Chrome **acumula** os erros e só limpa quando você clica na lixeira — e ele
mostra sempre o *código atual* no trecho, mesmo que o erro tenha sido gerado por
uma versão anterior. Então, para conferir de verdade:

1. Recarregue a extensão (ícone de reload).
2. Dê **F5 nas abas já abertas** do Language Lab e da Netflix (as abas antigas
   ficam órfãs quando a extensão é atualizada — é assim para toda extensão).
3. Abra "Erros" e **apague com a lixeira**.
4. Use a extensão normalmente. Se a lista continuar vazia, está tudo certo.
