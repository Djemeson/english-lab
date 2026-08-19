# Mangá: a caixa de seleção não encaixa no balão

> Documento de transferência. Escrito depois de várias rodadas de tentativa
> **sem sucesso**. Leia inteiro antes de tocar no código — metade deste texto
> existe para você **não repetir** o que já falhou.

---

## 1. O que o usuário quer, nas palavras dele

> *"quero uma caixa de seleção tão perfeita com o original que ao passar o
> mouse eu quase nem perceber que se abriu uma caixa de seleção, porque tá
> exatamente igual o original."*

A referência é o **mokuro**. No mokuro, ao passar o mouse sobre um balão, o
texto digital aparece **exatamente sobre o texto desenhado** — mesmo tamanho,
mesmo recorte, mesma quebra de linhas. A troca é quase imperceptível.

Hoje o nosso está longe disso: o texto aparece **maior que o balão**, com
menos linhas que o original, transbordando por cima da arte vizinha.

---

## 2. Onde está o código

| Arquivo | O que faz |
|---|---|
| `js/manga.js` | tudo do mangá: abrir CBZ, ler os balões com IA, medir por pixel, desenhar a camada de texto |
| `css/styles.css` | classes `.mg-*` (procure por `MANGÁ`) |
| `js/ler.js` | ganchos: importar, abrir, e o HTML do "capítulo" |

Funções centrais em `js/manga.js`:

- `mangaLerPagina(i)` — manda a página para a IA e guarda o resultado
- `_mgAplicar()` — valida a resposta da IA e monta `chapters[i].baloes`
- `_mgAfinarPorPixel()` / `_mgAfinarBalao()` — mede as linhas na imagem
- `_mgCamadaHtml()` — gera os `<span>` de texto sobre a página
- `mangaAjustarLinhas()` — calcula o tamanho da fonte e o encaixe

**Modelo de dados** — cada página tem `baloes: [{ t, x, y, w, h, ls: [...] }]`,
tudo em fração de 0 a 1 da página. `ls` são as linhas, com os mesmos campos.

---

## 3. Estado atual, medido (não estimado)

Volume de teste: **One Piece vol. 100**, 28 páginas, relido do zero.

| Medida | Valor |
|---|---|
| Páginas lidas | 28 de 28 |
| Balões | 207 |
| Balões com linhas separadas | 154 |
| Balões medidos por pixel | 147 |
| **Balões mais largos que 25% da página** | **42** ← o defeito |
| **Balões colados na margem esquerda (`x < 0,01`)** | **8** ← o defeito |

Um balão de fala de mangá raramente passa de 20% da largura da folha. **42
balões acima de 25% é o problema que o usuário está vendo na tela.**

---

## 4. O que já foi tentado e FALHOU

⚠️ **Não repita nada desta lista.** Cada linha custou uma rodada e piorou ou
apenas deslocou o defeito.

| # | Tentativa | Resultado |
|---|---|---|
| 1 | Pedir à IA a caixa em fração (0–1) | ela devolve escala 0–1000; caixas 100% fora |
| 2 | Pedir `x, y, w, h` em 0–1000 | altura vinha de 2× a 5× a real |
| 3 | Trocar para `box_2d: [ymin,xmin,ymax,xmax]` | melhorou, mas ainda impreciso |
| 4 | Medir a largura por projeção de pixels | linha com **45% da largura da página** (pegou a moldura do quadro) |
| 5 | Rejeitar largura pequena demais | as grandes continuaram passando |
| 6 | Rejeitar largura grande demais | linhas coladas na margem (`x: 0`) |
| 7 | Herdar a caixa do balão quando falta | herda o lixo, porque o balão já está errado |
| 8 | Repartir as linhas por igual no balão | espalha o texto quando a caixa está inflada |
| 9 | Usar o passo mediano entre linhas | comprime o bloco quando a IA junta duas linhas numa |
| 10 | Forçar quebra estreitando a largura | `NEA / R / DE / ENTWANCE` (quebrou dentro da palavra) |
| 11 | Desligar a medição horizontal de vez | **estado atual** — ainda 42 balões largos demais |

---

## 5. O diagnóstico, e por que as tentativas falharam

**As duas fontes de informação são ruins, cada uma à sua maneira:**

### A IA de visão erra a caixa

Ela **lê o texto muito bem** (7 de 7 balões, palavra por palavra, em todos os
testes). Mas a caixa que devolve é aproximada — e às vezes grosseira:

- junta duas linhas impressas numa só leitura
- devolve caixa de 30% da altura da página para uma palavra ("WHAAAT ?!!")
- devolve caixa começando em `x: 0` (borda da página)

⚠️ **Pedir precisão de caixa a um modelo de visão é pedir a coisa errada a
quem faz outra.**

### A projeção de pixels erra a horizontal

Somar pixels escuros por **fileira** encontra as linhas de texto muito bem
(picos e vales). Mas na horizontal ela pega **tudo que é escuro na mesma
altura das letras**: a moldura do quadro, o contorno do balão, a arte ao lado.

⚠️ **Numa fileira, texto e desenho se misturam. Numa coluna, o texto se separa
sozinho.**

---

## 6. O que fazer — a abordagem que NÃO foi tentada

**Detectar o balão pela própria imagem, não pedi-lo à IA.**

Um balão de fala é uma **região branca fechada, cercada por uma linha preta**.
Isso é detectável com precisão de pixel, e é o que os leitores de mangá
sérios fazem (o mokuro usa um detector dedicado, o `comic-text-detector`).

Caminho sugerido, do mais simples ao mais completo:

### Passo 1 — Preenchimento a partir do texto (flood fill)

1. Pegue o centro aproximado do balão (a caixa da IA serve como **ponto de
   partida**, não como resultado).
2. Faça um preenchimento por vizinhança a partir dali, aceitando só pixels
   claros (o miolo do balão).
3. O preenchimento para sozinho na linha preta do contorno.
4. **A caixa envolvente do que foi preenchido é o balão** — com precisão de
   pixel, sem heurística nenhuma.

Isso resolve de uma vez: largura, altura, posição e o transbordo. E funciona
tanto no balão redondo quanto no explodido, porque não assume forma.

### Passo 2 — Linhas dentro do balão

Com o balão exato, a projeção por fileira volta a ser confiável, **porque a
janela agora exclui a moldura e a arte**. As linhas saem certas.

### Passo 3 — Casar o texto lido com as linhas encontradas

Se a projeção achar 5 linhas e a IA tiver lido 4, junte as leituras vizinhas
proporcionalmente ao comprimento — ou deixe o texto quebrar sozinho dentro da
caixa do balão, que agora está correta.

### Cuidados

- **Balão com fundo preto e texto branco existe** (página 4 do volume de
  teste, o resumo). O preenchimento precisa detectar o tom do miolo antes de
  decidir o que é "claro".
- **Balões encostados** — dois balões colados podem virar um só no
  preenchimento. Um limite de área (nenhum balão passa de ~25% da folha) evita
  o pior caso.
- **Mangá digitalizado de papel** não tem branco puro; use limiar adaptativo
  (já existe: `_mgLimiarDaJanela`, com Otsu).

---

## 7. Como testar — e o erro de método que atrapalhou

⚠️ **O maior erro desta série não foi de código: foi de teste.** Passei
rodadas medindo proporções, transbordos e contagens — números que passavam
limpos — enquanto na tela havia balões cobrindo a arte e outros que sequer
existiam para o ponteiro. O usuário via em um segundo o que meus testes não
pegavam.

**O que funcionou como teste:**

1. **Perguntar "quanto o balão OCUPA na tela?"** — foi assim que apareceram os
   31 balões com largura zero e os que cobrem os vizinhos.
2. **Medir a tinta da imagem sob a caixa** — um balão de fala é branco por
   dentro; se a caixa tem pouco branco, ela vazou para a arte.
3. **Comparar lado a lado com o original**, olhando. Sem isso, nada vale.

**Como rodar:** o app publicado é `https://english-lab-seven.vercel.app/`.
O usuário tem o One Piece vol. 100 na estante. No Chrome dele, com a janela
**visível** (em aba oculta o navegador congela as medições):

```js
showSection('ler')
await lerAbrir(livros.find(l => l.format === 'manga').id)
mangaIrParaPagina(27, false)   // a página dos exemplos
```

Para forçar releitura de uma página: `chapters[i].baloes = null` e
`mangaLerPagina(i)`. Para remedir sem gastar IA: `delete b.px` e
`_mgAfinarPorPixel(bytes, c.baloes)`.

⚠️ Sempre limpe o cache antes de testar (o service worker serve versão velha):

```js
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
for (const k of await caches.keys()) await caches.delete(k)
```

---

## 8. O que está bom e não deve ser mexido

Para não jogar fora o que funciona:

- **A leitura do texto pela IA** — precisa em todos os testes, a R$ 0,0053 por
  página (~R$ 0,96 o volume). Modelo: `gemini-flash-lite-latest`.
- **O fluxo contínuo** — rolagem por todo o volume, imagens carregadas sob
  demanda, memória estável em ~2 páginas.
- **O acender no hover** — fundo branco, texto digital, seleção que não apaga.
  É a mecânica certa; só a CAIXA está errada.
- **A seleção → Lexa → card** — funciona pelo caminho do leitor de livros,
  sem código próprio.
- **O teto de 2 min por leitura** — impede a página travar para sempre.

---

## 9. Resumo em três linhas

1. O texto lido está certo; **a caixa está errada** — vem da IA, que aproxima.
2. Tentar corrigir a caixa com heurísticas **piorou a cada rodada**; há 11
   tentativas registradas na seção 4, todas falhas.
3. O caminho não tentado é **detectar o balão na imagem por preenchimento**,
   que dá a caixa exata sem heurística — e é o que o mokuro faz.
