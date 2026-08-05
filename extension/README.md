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
