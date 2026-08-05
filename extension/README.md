# Language Lab para Netflix — extensão do Chrome

Legendas clicáveis na Netflix, no estilo Language Reactor: clique numa palavra
para capturá-la (com a frase e o título do episódio); ao abrir o Language Lab,
tudo entra no **Revisar** automaticamente — e dali segue o fluxo normal
(triagem, análise com IA, SRS).

A extensão **não guarda nenhuma chave de API** e não fala com nenhum servidor:
ela só observa as legendas que a Netflix desenha na tela e guarda suas capturas
no armazenamento local do Chrome até você abrir o app.

## Instalar (1 minuto)

1. Abra `chrome://extensions` no Chrome.
2. Ligue o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha esta pasta:
   `Claude Cowork/Claude Code/english-lab-2.0/extension`
4. Pronto. Abra um episódio na Netflix com legenda em inglês.

## O que ela faz (o módulo Vídeo do app, dentro da Netflix)

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

## Sobre a lista "Erros" em chrome://extensions

O Chrome **acumula** os erros e só limpa quando você clica na lixeira — e ele
mostra sempre o *código atual* no trecho, mesmo que o erro tenha sido gerado por
uma versão anterior. Então, para conferir de verdade:

1. Recarregue a extensão (ícone de reload).
2. Dê **F5 nas abas já abertas** do Language Lab e da Netflix (as abas antigas
   ficam órfãs quando a extensão é atualizada — é assim para toda extensão).
3. Abra "Erros" e **apague com a lixeira**.
4. Use a extensão normalmente. Se a lista continuar vazia, está tudo certo.
