# Mangá: a caixa de seleção — RESOLVIDO (2026-08-19)

> Este documento nasceu como pedido de socorro depois de **onze tentativas
> falhas**. Agora é o registro do que funcionou. A parte histórica ficou no
> fim, de propósito: ela explica por que o caminho atual é o que é.

---

## 1. O que o usuário queria

> *"quero uma caixa de seleção tão perfeita com o original que ao passar o
> mouse eu quase nem perceber que se abriu uma caixa de seleção, porque tá
> exatamente igual o original."*

A referência é o **mokuro**: o texto digital aparece exatamente sobre o texto
desenhado, e a troca é quase imperceptível.

## 2. Como ficou, medido no volume real

One Piece vol. 100, 28 páginas, **relido do zero** depois dos consertos:

| Medida | Antes | Depois |
|---|---|---|
| Balões no volume | 207 | **318** |
| Balões com caixa vinda da imagem | 0 | **318 de 318 (100%)** |
| Balões mais largos que 25% da folha | 42 | **8** — metade nas páginas de TEXTO, onde é correto |
| Balões sem área (invisíveis ao ponteiro) | 31 numa rodada anterior | **0** |
| Páginas que a IA não conseguia ler | 10 | **0** (28 de 28, sem uma falha) |
| Tempo de medição | — | ~250 ms por página, sem chamada de IA |

⚠️ **Os 111 balões a mais são a resposta para "vários balões não acontece nada
ao passar o mouse".** Não era a caixa: aquelas páginas **nunca tinham sido
lidas**. O JSON quebrado derrubava a página inteira, e uma página sem balão
nenhum é indistinguível de uma página sem fala — some calada. Uma delas tinha
60 balões.

Conferido com os olhos na página 28 (a que ele fotografou) e na 17: os balões
acendem com as **mesmas quebras de linha impressas** — "YOU KNOW / HE'S NOT
THE KIND / OF BOSS WHO / BESTOWS MERCY / ON CRYBABIES!!", "I HEARD /
SANGORO'S / VOICE COMING / FROM THIS / MOUSE!!" — dentro do balão, sem remendo
no fundo e sem cobrir o traço.

---

## 3. Como funciona (três passos)

O modelo de visão **só lê o texto**. Tudo o que é posição sai da imagem.

### Passo 1 — o papel
Preenchimento por vizinhança (o balde de tinta) a partir de um ponto dentro da
fala. Marca todo o branco **ligado** àquele ponto e para na arte sozinho.

### Passo 2 — os buracos são o texto
Todo pixel escuro **cercado** por esse branco — sem caminho até a borda da
janela — é letra; o que tem caminho é desenho. Essa única distinção separa o
texto da arte sem heurística nenhuma: a arte se liga ao resto do quadro, a
letra flutua no papel.

### Passo 3 — a caixa cresce até encostar na arte
Partindo do texto medido, a caixa abre para os quatro lados enquanto a fileira
(ou coluna) inteira for papel. Num balão fechado ela para no traço; num balão
**aberto** — sem contorno nenhum — para no desenho mais próximo. Nos dois
casos o que acende é só papel: **por construção, o fundo aceso nunca cobre um
traço do original**.

### O que mais entrou junto
- **Duas passadas** para achar as linhas: a primeira com janela larga, a
  segunda já dentro da coluna da fala (senão o texto do balão vizinho, que cai
  na mesma altura, preenche o vale entre duas linhas e elas viram uma).
- **Bloco contínuo**: das linhas achadas fica só o bloco seguido que contém o
  meio da caixa, cortando onde o vão passa de 1,9 vez o passo típico — é o que
  separa duas falas empilhadas.
- **A cor sai da página**: papel e tinta são a cor **mais frequente** dentro
  do balão (a média puxa para o cinza do serrilhado e vira mancha visível).
- **A caixa do modelo é guardada em `b.ia`** e toda medição parte dela — sem
  isso o erro se acumula a cada versão.
- **`b.px` é versão**: página já lida se remede sozinha ao entrar na tela, sem
  gastar IA.
- **A área do mouse é maior que a área que acende**: a caixa medida é justa no
  texto, e o ponteiro caía no vazio a poucos pixels da letra. Uma borda
  transparente de 10 px entra na conta do ponteiro e sai da conta do fundo
  (`background-clip: padding-box`) — acende de perto, pinta no lugar exato.
  ⚠️ Nas regras de hover use `background-color`, nunca o atalho `background`:
  o atalho reescreve o `background-clip` junto.
- **Desenho dentro do balão não é linha**: um rostinho desenhado no rodapé do
  balão é tão cercado de branco quanto as letras e virava uma faixa a mais,
  espalhando o texto. Dentro de um balão o letrista usa uma letra só, então
  faixa muito mais alta que a mediana das outras é descartada.

---

## 4. O pedido à IA mudou

Pedir a caixa de cada linha **quebrava o JSON**. Capturado na resposta crua:

```json
"lines": [{"text":"YOU KNOW","box_2d":[...],"box_2d":[...],"box_2d":]
```

Ele escreve o texto da primeira linha e emenda as caixas das outras como
chaves repetidas no mesmo objeto. Duas leituras seguidas da página 28 caíram
assim. Hoje se pede `"lines": ["primeira linha", "segunda linha"]` — texto
puro. O JSON encolheu umas três vezes e o aninhamento sumiu.

---

## 5. O que ainda não está perfeito

- **Grito solto sobre o branco** (o "AAAAH!!" da página 19): sem balão em
  volta, os respingos do impacto são tão cercados de papel quanto as letras, e
  a faixa sai maior que o texto. Há um corte por densidade, mas ele não
  resolve tudo. O fundo aceso cobre área branca a mais — não cobre traço.
- **Volume relido em 2026-08-19** — as caixas antigas, sobrescritas por
  medições de versões anteriores, saíram de cena. Um volume novo já nasce
  certo; um volume lido por uma versão antiga do app se beneficia de uma
  releitura (~R$ 0,005 por página).
- **A fonte é Comic Sans** (com Comic Neue e a da interface como reserva). É a
  aproximação disponível sem baixar fonte nova; o lettering de mangá de
  verdade é outro desenho.

---

## 6. O que NÃO fazer (o histórico que custou onze rodadas)

⚠️ Cada linha abaixo já foi tentada e falhou. A lista existe para não repetir.

| # | Tentativa | Resultado |
|---|---|---|
| 1 | Pedir à IA a caixa em fração (0–1) | ela devolve escala 0–1000; caixas 100% fora |
| 2 | Pedir `x, y, w, h` em 0–1000 | altura vinha de 2× a 5× a real |
| 3 | Trocar para `box_2d` | melhorou, mas ainda impreciso |
| 4 | Medir a largura por projeção na janela do modelo | linha com 45% da largura da folha (pegou a moldura) |
| 5 | Rejeitar largura pequena demais | as grandes continuaram passando |
| 6 | Rejeitar largura grande demais | linhas coladas na margem (`x: 0`) |
| 7 | Herdar a caixa do balão quando falta | herda o lixo |
| 8 | Repartir as linhas por igual no balão | espalha o texto quando a caixa está inflada |
| 9 | Usar o passo mediano entre linhas | comprime o bloco |
| 10 | Forçar quebra estreitando a largura | `NEA / R / DE / ENTWANCE` |
| 11 | Desligar a medição horizontal de vez | 42 balões largos demais |
| 12 | **Exigir que o preenchimento seja fechado** | 3 balões de 11: metade do One Piece não tem contorno |

⚠️ A #12 é desta rodada e é a mais instrutiva: a suposição de que "balão é
região fechada" veio de mim, não do material. Dez segundos olhando o pixel
mostraram um balão sem contorno nenhum.

---

## 7. Como testar

**Números, sem navegador nem IA** — o caminho mais rápido:

```js
// com o volume aberto no leitor
const c = _lerLivro.chapters[27]
const bytes = await _lerEpub.manga.zip.bytes(c.href)
for (const b of c.baloes) { delete b.px; delete b.bg; delete b.fg }
await _mgAfinarPorPixel(bytes, c.baloes)   // remede sem gastar IA
c.baloes.map(b => [b.w.toFixed(3), (b.ls||[]).map(l => l.t)])
```

**Com os olhos** (é o que fecha a conta):

```js
mangaIrParaPagina(27, false)
// depois de a imagem carregar:
document.querySelectorAll('.mg-pagina[data-pg="27"] .mg-balao')
  .forEach(b => b.classList.add('mg-aceso'))
```

**Ver o que a medição enxerga** (máscara em verde, texto em vermelho, faixas
em azul) — foi isto que achou o balão sem contorno e a fala vizinha invadindo
a faixa: monte um canvas com `det.masc`, `det.buraco` e as faixas de
`_mgLinhasDoBalao`, e ponha por cima da página.

⚠️ **Limpe o cache antes** (o service worker serve versão velha):

```js
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
for (const k of await caches.keys()) await caches.delete(k)
```

---

## 8. Onde está o código

| Arquivo | O que faz |
|---|---|
| `js/manga.js` | tudo do mangá; a medição fica na seção **"O BALÃO SAI DA IMAGEM"**, no fim |
| `css/styles.css` | classes `.mg-*` (procure por `MANGÁ`) |
| `js/ler.js` | ganchos: importar, abrir, o HTML do "capítulo" |

Funções da medição, na ordem em que rodam:

`_mgMedirBalao` → `_mgDetectarBalao` (papel + buracos) → `_mgLinhasDoBalao`
(duas passadas, bloco contínuo, teto e piso de altura) → `_mgEscreverBalao`
(reparte o texto, cresce a caixa no papel, tira as cores).
