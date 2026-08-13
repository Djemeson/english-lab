# Estudo visual do Migaku — o que faz aquilo parecer aquilo

> Levantado em 2026-08-11 **do site no ar**, lendo os estilos computados e as
> variáveis de tema — não de memória nem de print. É a base do reskin do
> Language Lab.

## O resumo em uma frase

Migaku é **peso 900 sobre roxo profundo, com seis acentos vibrantes e gradiente
como assinatura**. Não é "mais um app escuro": é um app escuro que se recusa a
ser discreto.

---

## 1. Tipografia — aqui está metade da identidade

| | Migaku | Language Lab hoje |
|---|---|---|
| Fonte | **Inter Variable** | Inter + Newsreader (serif) |
| Peso dos títulos | **900 (black)** | 700 |
| H1 | 99px / entrelinha 115px | bem menor |
| H2 | 36px / 42px, peso 900 | 700 |
| Botão | 18px, peso 500 | menor |

⚠️ **O peso 900 é o que mais marca.** Não é 700 "negrito forte" — é *black*.
Títulos gigantes em peso máximo, com entrelinha apertada (115/99 ≈ 1,16), dão a
sensação de cartaz, não de documento.

Fonte secundária: **GT Maru** (display arredondada), usada em pouquíssimos
lugares — é tempero, não base.

## 2. Cores

**Fundos**

| Papel | Valor |
|---|---|
| Fundo escuro principal | `#0A002A` — roxo-marinho profundo |
| Fundo escuro alternativo | `#11112E` |
| Fundo claro | `#D4DDF5` — azul-lavanda |
| Véu de modal | `rgba(25, 0, 94, .5)` |
| Texto de alto contraste | `#19005E` |

⚠️ **Nada de cinza.** O escuro tem roxo dentro (`#0A002A` é azul-violeta, não
`#111`). É isso que tira o ar de "tema escuro genérico".

**Os seis acentos** — e são seis de propósito, não um:

| # | Cor | Aproximado |
|---|---|---|
| 1 | roxo | `#6B2FC3` |
| 2 | rosa | `#FE4670` |
| 3 | laranja | `#FF9345` |
| 4 | azul | `#3C91FF` |
| 5 | verde-água | `#00C7A4` |
| 6 | lima | `#BEF214` |

Declarados em **display-p3** (gama ampla): em telas modernas ficam mais vivos
do que o mesmo hex conseguiria.

**Gradientes — a assinatura**

```
--gradient-text:      linear-gradient(174.87deg, #3C91FF 4.47%, #672FC3 84.8%)
--primary-gradient:   #FF9345 → #FE4670
--text-gradient:      radial(#FF9345 → #D1B7FF)
```

O gradiente entra **no texto** (título com preenchimento em degradê), não só em
fundo de botão. É a marca registrada.

## 3. Hierarquia por opacidade, não por cor

```
--primary-text:    100%
--secondary-text:   60%
--tertiary-text:    35%
```

Três níveis da **mesma** cor. Mais simples de manter que três cores cinzas
diferentes — e nunca desafina com o fundo.

## 4. Formas

- Raios em uso: **6, 8, 16, 20, 24, 32px** — generosos
- Botão principal: **32px = pílula**
- Cartões: sem borda e sem sombra pesada; separam-se pelo **fundo**, não por
  linha

---

## O que trazer para o Language Lab

**Traz (é o que dá a cara):**

1. **Peso 900 nos títulos** + entrelinha apertada
2. **Fundo escuro com roxo dentro**, no lugar do cinza-azulado
3. **Paleta de acentos múltiplos** — hoje o app é monocromático no azul
4. **Gradiente no texto** de destaque
5. **Hierarquia por opacidade** (100/60/35)
6. **Botão em pílula**

**Não traz:**

- ⚠️ **H1 de 99px.** Aquilo é página de venda; o app é ferramenta de uso
  diário, e cartaz cansa quando se abre dez vezes por dia.
- A fonte GT Maru (paga).
- O visual de landing page nas telas de trabalho.

⚠️ **E o principal: o app já tem um design system próprio** ("Tinta", §8.15).
O reskin é **trocar os tokens dele**, não pintar tela por tela — senão a
próxima tela nasce fora do padrão e o trabalho se perde.

---

## Ordem sugerida

1. **Tokens** — cores, pesos e raios no `:root`. Muda o app inteiro de uma vez.
2. **Tipografia** — títulos em 900, escala e entrelinha.
3. **Acentos e gradiente** — onde ganha significado (destaque, progresso, IA).
4. **Componentes** — botão pílula, cartão sem borda.

O reskin e as duas funcionalidades novas (card com cena, lacuna) são **três
frentes**; misturar as três numa rodada é como se perde o controle do que
quebrou o quê.
