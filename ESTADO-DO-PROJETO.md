# English Lab — Estado do Projeto e Guia de Continuidade

> Documento vivo. **Sempre leia este arquivo antes de iniciar qualquer tarefa** e
> **atualize-o ao finalizar cada tarefa** (instrução fixada no `CLAUDE.md`).
>
> ✅ **A ENTREGA DO FLUXO DE 4 ETAPAS ESTÁ CONCLUÍDA** (90ª rodada, 2026-08-07). A seção 8.1
> deixou de ser "em curso" e virou o registro de como ficou. **O mapa dos nomes de seção
> mora em `js/core.js`, logo acima de `SECTIONS`** — leia-o antes de mexer em qualquer id.
>
> Última atualização: 2026-08-08 — **A FORMA VIROU CONTRATO (structured outputs), O DEEPSEEK SAIU
> E A LUNA VIROU PADRÃO**. Decisão dele: *"não vamos mais usar o DeepSeek, ele não trouxe
> resultados tão efetivos assim. O modelo padrão será o Luna."* O fornecedor saiu inteiro (tabela,
> chave, sincronização e os comentários que se justificavam por ele); quem tinha `deepseek` salvo
> cai sozinho na OpenAI. `gpt-5.6-luna` virou `AI_DEFAULT_MODEL` **e** o primeiro da lista — com
> `migrarModeloPadrao()`, porque trocar um default não move ninguém que já tem escolha salva.
> **E `aiJSON` ganhou `json_schema` com `strict: true`**: sete esquemas (`ESQ.*` em `ai.js`) cobrem
> a análise, o completar, os sentidos, a família, a quebra dos chips, os títulos de obra e a
> correção do "Produza". Escada de três degraus — schema → json_object → texto — mais a repescagem
> na OpenAI. ⚠️ A armadilha do modo estrito é `additionalProperties: false`: campo esquecido no
> esquema vira campo PROIBIDO, e o app perderia o dado em silêncio. Por isso existe `_esqConfere()`,
> que compara cada esquema com o molde JSON do próprio prompt — os sete passaram com zero faltando
> e zero sobrando. `sw.js` → `englab-v179`. Ver 8.2 ("A forma virou contrato") e a **especificação
> da Lexa que leu o livro e vê a web**, na mesma seção.
>
> Anterior: 2026-08-08 — **OS CHIPS SÃO DO QUE ELE MARCOU**. Ele marcou *"looks lower
> middle-class to Billy"* e vieram chips de "two miles", "downtown", "enter", "neighborhood" —
> palavras da frase que ele NÃO marcou. *"Olha o que eu selecionei e olha o que aparece de chips."*
> A máquina já estava certa: `quebrarTrecho` sempre teve `trecho` (o que quebrar) e `contexto` (só
> para desambiguar, com a regra *"NEVER take units from it"* no prompt). Os **quatro** chamadores é
> que mandavam a FRASE como `trecho`. Agora mandam a marcação, e a frase vai como contexto.
> **Marcação de uma palavra só não gera chips** — não há o que quebrar, a explicação já é sobre ela,
> e some uma chamada de IA. O rótulo virou "o que tem no que você marcou". ⚠️ Isto **reverte de
> propósito** a decisão da 96ª rodada ("os chips saem da FRASE, não do pedaço selecionado"): ele
> viu na prática e não é o que quer. `sw.js` → `englab-v178`.
>
> Anterior: 2026-08-08 — **A ABERTURA DO CAPÍTULO FAZIA AS VEZES DE TODA FRASE**. Ele
> selecionou **"fancy"** no leitor e a Lexa respondeu *"fancy não aparece no trecho enviado"*;
> selecionou **"drive"** e ela negou que fosse "dirigir"; e os chips vinham do capítulo inteiro.
> A raiz é antiga e não tem nada a ver com o balão: **`_lerBlocoEmVolta` subia seis níveis e ficava
> com o texto MAIS LONGO** que achasse — e num EPUB o pai do parágrafo é o `<div>` do capítulo.
> Aí o `indexOf` da palavra falhava dentro dos 700 caracteres e a "frase" virava a ABERTURA DO
> CAPÍTULO, a mesma para toda palavra. Agora ele sobe até o PARÁGRAFO (`closest('p, li, …')`).
> ⚠️ **O estrago não era só da explicação**: `_lerDuploClique` usa a mesma peça, então **toda
> palavra capturada no leitor guardou a abertura do capítulo como contexto** — ver pendência sobre
> o acervo já capturado. Mesmo defeito, versão leve, corrigido no Preparar (`_revFraseEmVolta`).
> **E o balão voltou ao tamanho de antes** (432px, sem o bloco da frase): *"ficou imenso, não está
> como era antes, eu adorava como era antes"* — e o texto que a IA está lendo *"é irrelevante, pode
> ficar oculto"*, porque num balão suspenso a frase está logo ali atrás, na página.
> `sw.js` → `englab-v177`. Ver 8.2 ("A abertura do capítulo").
>
> Anterior: 2026-08-08 — **O BALÃO É A ÚNICA CASA DA LEXA**. Regra dele, para o projeto
> inteiro: *"o painel completo só deveria ser aberto quando a IA analisa o capítulo do livro, onde
> tem que selecionar dezenas de chips. Todo o resto onde a Lexa explica deve ser no menu suspenso
> mesmo."* O painel de tela cheia **foi removido** — função, CSS, preferência e atalho. Entrou
> `lexaBalaoAbrir({titulo, frase, fonte, alvo})`, que devolve o corpo igual ao painel devolvia, e
> os **cinco** chamadores mudaram de casa: seleção no Estudar, família do Estudar, leitor, Preparar
> e vídeo. O balão leva tudo o que o painel levava — explicação, chips das unidades e a conversa —
> e ancora onde a mão dele estava (o popup que o chamou, o botão que ele clicou). A triagem do
> capítulo, a tal exceção, **nunca usou o painel**: ela tem superfície própria (`#ler-niv-area`) e
> ficou como estava. `sw.js` → `englab-v176`. Ver 8.2 ("O balão é a única casa da Lexa").
>
> Anterior: 2026-08-08 — **A FONTE ANCESTRAL, E O BALÃO QUE VOLTOU**. Três defeitos
> num PDF dele, dois com a mesma raiz. Selecionando **"cramped"** dentro do exemplo #2 do item
> *digest-sized*, a Lexa abria falando da passagem de **Billy Summers** e respondia *"cramped não
> aparece nessa frase"*; mandada ao Preparar, a palavra nascia como item **do livro**, com a
> passagem do digest-sized por contexto — *"ta pegando fontes ancestrais pra novas fontes"*. A
> raiz: `obterContexto()` devolvia sempre a cena do ITEM EM FOCO, sem saber ONDE na página a
> seleção caiu. Agora `selMenuAtivar` passa o nó da seleção e vale a regra **a passagem é o único
> pedaço autêntico da página** — exemplos da IA, definição, colocações, família e conjugação são
> material do estudo, e quem nasce dali tem `source_title = OBRA_ESTUDO` ("Do seu estudo") com o
> item por capítulo. **O mesmo defeito estava em mais dois lugares** e foi corrigido junto: o botão
> "Preparar" da família (`dossieFamiliaPreparar`, que dava ao membro a cena do livro da raiz) e os
> chips do Preparar (`revSelExplain`). **E o "Explicar" voltou ao modo suspenso**: a resposta nasce
> DENTRO do balão, em cima do texto, com a frase à vista — o painel inteiro cobria justamente a
> frase que motivou a pergunta. O painel continua a um clique no botão de expandir, **reaproveitando
> a resposta já paga** (sem 2ª chamada) e levando junto os chips e a conversa. `sw.js` →
> `englab-v175`. ⚠️ O LEITOR continua abrindo o painel — ver pendência.
>
> Anterior: 2026-08-08 — **OBRA → CAPÍTULO → ITENS, E O TÍTULO LIMPO**. A lista do
> Estudar era plana (um cartão por obra+capítulo), então um livro de doze capítulos virava doze
> cartões repetindo o mesmo título e o progresso da OBRA não existia. Agora a obra é o contêiner e
> os capítulos são linhas dentro dela. E o título passou a ser **o que o autor chamou**, não o que
> veio do arquivo: `Billy Summers (US Edition)` → `Billy Summers · Stephen King`, numa chamada
> para TODAS as obras pendentes. ⚠️ **A chave de agrupamento continua sendo o título bruto** —
> reescrever `source_title` reagruparia o acervo inteiro; o que entrou é uma camada de exibição
> (`obrasNome`), e a busca aceita os dois nomes. **E a pergunta dele fechou o buraco**: *"ao trazer
> da fonte um item já vem limpo?"* — não vinha, e isso faria item antigo e novo virarem **dois
> grupos com o mesmo nome na tela**. Agora o agrupamento é pelo nome RESOLVIDO (convergem sozinhos)
> e a resolução acontece **na entrada** do livro, vídeo ou episódio, uma chamada por obra. **E a
> obra virou PASTA**: nasce fechada e diz quantos capítulos tem — escancarar 12 linhas por livro
> era a parede que a hierarquia veio desfazer. Buscando, tudo abre; voltando de um capítulo, a
> pasta continua como ele deixou. **E o "Explicar" do menu de seleção não fazia nada**:
> `lexaNome is not defined` — a armadilha nº 1 (shell chamando símbolo de arquivo LAZY), silenciosa
> porque o balão fechava antes do erro. A definição foi para `core.js`; ⚠️ a correção óbvia
> (declarar a função em `ai.js`) teria quebrado o LEITOR inteiro com "already been declared".
> `sw.js` → `englab-v174`. Ver seção 8.2 ("Obra → capítulo → itens").
>
> Anterior: 2026-08-08 — **O ITEM NUNCA SAI DE VISTA**. O cabeçalho subia com a rolagem
> e a página virava seções sem dono. Ele passou a ficar **preso no topo, encolhendo** de 115px
> para 62px — sobram palavra, pronúncia e o botão de ouvir. ⚠️ O recuo do topo teve de sair do
> corpo e ir para o cabeçalho: com ele no corpo, o texto **escorria por uma faixa de 20px e
> aparecia ACIMA do item**. E no celular a linha do título quebrava em duas (94px de 812) — os
> rótulos dos botões de áudio foram para dentro de um `<span>`, ficam só os ícones, e o cabeçalho
> caiu para **64px**. `sw.js` → `englab-v170`. Ver seção 8.2 ("O item nunca sai de vista").
>
> Anterior: 2026-08-08 — **O RITMO DO PAINEL DE ESTUDO**. *"As informações parecem
> querer viver uma dentro da outra."* Medido antes de mexer: **24px entre as seções contra 8px
> dentro** — seções de 46px separadas por 24px, ou seja, a distância era menor que a própria
> seção. O **rótulo ganhou coluna própria** (âncora comum para blocos de formatos diferentes, e
> gruda no topo enquanto a seção rola), o **espaço entre passou a dominar o de dentro** (64px
> contra 10px) e a **decoração interna diminuiu** — com separação de verdade, borda dentro de
> seção é terceiro nível de moldura, e redundância lê como aperto. ⚠️ A coluna do rótulo não pode
> somar-se à largura de leitura: a 56rem o texto ficou com 78 caracteres por linha; a 48rem voltou
> a 64. E a correção dele logo depois — *"não quero que você limite caracteres"* — derrubou os
> **tetos de quantidade** que eu tinha criado antes: forms/colocações (6), régua (4), conjugação
> (10), família (60), e os cortes de EXIBIÇÃO de sinônimos e antônimos, que eram os piores (o
> dado estava gravado e pago, e a tela escondia parte dele em silêncio). O teto que ficou é contra
> LIXO, não contra quantidade. E o último teto era de FORMATO: `curiosidade` e `armadilha` eram
> texto único, o que obrigava a IA a escolher uma e jogar o resto fora — viraram **listas**, com
> rótulo no plural quando há várias. ⚠️ `[]` é truthy em JS, e isso teria feito o "Completar
> material" sumir de quem mais precisa dele. **E a lista criou um bug que ele pegou na hora**:
> "digest-sized" perdeu a curiosidade no refazer, porque o guarda de 140 caracteres derrubava
> qualquer texto de 1-2 frases (a real tem 170). Virou **duas funções** — `_listaCurta` para itens
> de poucas palavras, `_listaTexto` para prosa —, e o refazer ganhou **duas redes**: resposta
> inteiramente vazia não escreve nada, e bloco que esvaziou é nomeado no aviso.
> `sw.js` → `englab-v169`. Ver seção 8.2 ("O ritmo do painel de estudo").
>
> Anterior: 2026-08-08 — **A FORMA NEUTRA E A FAMÍLIA COMPLETA**. O item aparecia como
> "Gals" (a forma do livro): o prompt passou a pedir a **forma de citação**, com a guarda
> `_mesmoItemCanonico` — muda flexão e caixa, **nunca a extensão** —, porque `w.word` é a chave do
> reencontro, do áudio e dos cards. Duas seções novas, da MESMA chamada, sob demanda e guardadas
> no ITEM: **tempos verbais** e **tudo que existe com aquele item** (phrasal verbs, idioms,
> colocações, blocos fixos e derivadas), com **Preparar a um clique** e explicar ao lado. ⚠️ Dois
> filtros que o teste corrigiu: o item voltava como membro da própria família, e o conserto disso
> engoliu as **derivadas** — que são, por definição, da mesma família de lema. E a correção dele
> logo depois: *"um clique é modo de falar, deve aceitar o selecionar"* — **selecionar qualquer
> texto** no painel de estudo (e no da Lexa) abre Explicar / Preparar, peça genérica
> (`selMenuAtivar`) que cobre o que eu não previ.
> `sw.js` → `englab-v165`. Ver seção 8.2 ("A forma neutra e a família completa").
>
> Anterior: 2026-08-08 — **CURIOSIDADE NÃO É REGISTRO**. A "curiosidade" de *gals* era
> uma observação de TOM ("leve, amistoso e um pouco retrô") — ou seja, `registro_uso` disfarçado.
> O defeito era da especificação: ela dizia *"where it is heard"*, que é justamente o trabalho do
> vizinho, e "genuinely interesting" não restringe modelo nenhum. Agora **cada campo tem um
> trabalho e eles não se sobrepõem**, e "interessante" virou testável: um FATO sobre o mundo,
> datável e verificável, mais o **teste da troca** — se a frase continuaria verdadeira trocando a
> palavra por centenas de outras, devolva vazio. Como prompt novo não conserta dado gravado
> (quarta vez), `completarMaterial` ganhou o modo **refazer**, que sobrescreve inclusive com
> vazio — senão nunca daria para APAGAR a curiosidade ruim. `sw.js` → `englab-v163`.
> Ver seção 8.2 ("Curiosidade não é registro").
>
> Anterior: 2026-08-08 — **O PAINEL DA LEXA**. A explicação com os chips morava num
> popup de 420px e ficou apertada. Virou **painel próprio, com dois tamanhos** (cheio para
> concentrar, compacto para ver a página por trás) e o **mesmo DOM nos dois** — alternar é trocar
> uma classe, então conversa, chips e rolagem sobrevivem. A escolha fica guardada. Vale nas três
> telas que explicam. ⚠️ Dois defeitos que o painel expôs: o **acerto de cache dava tela pela
> metade** (guardava só o HTML, sem chips nem conversa — agora guarda o contexto inteiro e a
> montagem é uma função só) e a **coluna medida em `ch` por filho desalinhava** (cada um usava a
> própria fonte como régua: 640px × 581px). De graça, caiu a trava do vigia de seleção do leitor.
> `sw.js` → `englab-v162`. Ver seção 8.2 ("O painel da Lexa").
>
> Anterior: 2026-08-08 — **O TRABALHO SOBREVIVE AO RECARREGAMENTO**. *"Posso não
> finalizar tudo na primeira vez."* As **marcas da triagem** passaram a ser gravadas (chave
> própria, gravação adiada em 400 ms) — ⚠️ o registro é a verdade INTEIRA e não um complemento ao
> palpite, senão DESMARCAR não sobreviveria e o app desfaria a decisão dele em silêncio. E a
> **quebra da frase** (os chips) foi para o IndexedDB — mudando de lugar no caminho: saiu de dentro
> dos chips e foi para `quebrarTrecho`, **em quem produz o caro**, e com isso o raio-X do Preparar
> ganhou junto. Resposta vazia não vai para o disco. "Refazer" apaga as marcas, o desfazer devolve
> as palavras marcadas, e apagar um livro leva junto `pre:`, `niv:` e `nivmarca:`.
> `sw.js` → `englab-v161`. Ver seção 8.2 ("O trabalho sobrevive ao recarregamento").
>
> Anterior: 2026-08-08 — **OS DOIS PINCÉIS DA TRIAGEM**. A triagem por nível do leitor
> era binária (marcado = conheço), e com dois estados *"não marcado"* quer dizer **duas coisas ao
> mesmo tempo** — "ainda não olhei" e "olhei e não sei" —, o que torna toda varredura em massa
> insegura. Entrou o **terceiro estado** e **dois pincéis**: a ferramenta ativa decide o que o
> clique pinta, e **"sem olhar: conheço" pinta só o que está sem marca** — é essa regra que faz o
> fluxo dele fechar (marcar as 8 que não conhece e varrer as outras 300 de uma vez). Cada faixa
> ganhou **"resolver N conhecidas"**, que grava e tira só aquelas da triagem. ⚠️ A repintura
> passou a ser **por faixa**: 400+ chips reconstruídos a cada clique era a diferença entre a tela
> responder e travar. `sw.js` → `englab-v160`. Ver seção 8.2 ("Os dois pincéis da triagem").
>
> Anterior: 2026-08-08 — **O QUE TEM NESTA FRASE**. *"Quando eu não entendo uma frase,
> pode se dar por ter elementos que não entendo ou que tenham significado diferente do que sei."*
> Toda explicação da Lexa passa a listar as **unidades da frase** — palavra, phrasal verb, idiom,
> colocação, bloco fixo — com a categoria à vista e o sentido ALI; clicar manda para o Preparar
> com a cena, a origem e a glosa como semente. Vale no leitor, no vídeo e no Preparar, e usa a
> **mesma peça do raio-X** (`quebrarTrecho`), não um segundo prompt. ⚠️ Dois defeitos que só
> aparecem com frase inteira: o **phrasal verb flexionado sumia** (`"end up"` da IA × `"ended up"`
> da frase) e a **frase quase inteira passava como bloco**. No mesmo commit, o **reencontro no
> vídeo**: era a última fonte que duplicava o item, e agora a cena nova vira sentido novo no MESMO
> item — com o áudio da cena guardado sob duas chaves, senão a gravação real viraria lixo na
> re-análise. A passagem no modo foco ganhou **Ouvir** e **Rever a cena**.
> `sw.js` → `englab-v159`. Ver seção 8.2 ("O que tem nesta frase" e "O reencontro no vídeo").
>
> Anterior: 2026-08-08 — **O VÍDEO ENTRA NA FILA**. Ele perguntou se vídeo, podcast e
> Netflix seguiam o padrão novo. **Netflix, Kindle, leitor e documento seguem** (param no
> Preparar). **Vídeo e podcast não**: prompt próprio reduzido e `saveToSrs` direto — iam para a
> Revisão pulando Preparar E Estudar, enchendo a fila de item nunca estudado. Decisão dele: o
> vídeo passa a parar no Preparar, e a captura (sentido na cena + áudio real) vira a SEMENTE.
> ⚠️ O `clipId` do "Rever a cena" teria sumido em silêncio — era carimbado nos cards logo após a
> captura, e agora vai no ITEM, copiado por `createSrsCard`. **Buraco achado de brinde:** vídeo e
> Assistente criavam sentido **sem `id`**, então o card voltava a depender da posição e nem
> "Estudei" nem "Completar material" funcionavam neles — corrigido, com rede que carimba id em
> dado antigo e religa o card órfão pela posição. **E o Assistente entrou junto**, a pedido dele:
> agora **TODA fonte para no Preparar** — leitor, Netflix, Kindle, documento, mídia, vídeo,
> podcast e Assistente. Os termos da Lexa passaram a ter origem (`Assistente · <conversa>`),
> senão caíam todos num dossiê "(sem título)".
> `sw.js` → `englab-v158`. Ver seção 8.2 ("O vídeo entra na fila").
>
> Anterior: 2026-08-08 — **O ITEM COMO PÁGINA DE ESTUDO** (4 fatias). A frase do livro
> dominava a tela sendo só referência: virou o **exemplo #0** dentro de "Em uso" (é o único
> exemplo autêntico da página), e no topo ficou um crédito de procedência. Correção dele que
> inverteu meu plano: **nada é recolhido no Estudar** — *"o item pode ficar grande, o estudo é pra
> isso"*. No lugar da regra de recolher entrou o **ARCO** de 11 blocos, terminando em **Produza**.
> Régua nova e permanente: **o que ajuda a LEMBRAR pode estar no card; o que ajuda a CONSTRUIR
> vive só no Estudar**. Campos novos: forma, padrão, colocações, régua, armadilha, curiosidade,
> registro na prática — todos com "vazio é resposta válida" no prompt. De graça: o `sense_audit`
> parou de morrer no console, e o EPUB guardado permite **contar quantas vezes a palavra aparece
> no seu livro**. **"Completar material"** enriquece o acervo antigo sem devolver nada e sem
> apagar card. `sw.js` → `englab-v156`. Ver seção 8.2 ("O item como página de estudo").
>
> Anterior: 2026-08-08 — **A VOLTA QUE NÃO VOLTAVA**. Ele pediu para devolver tudo ao
> Preparar e o mutirão revelou um defeito silencioso desde a Fase 2: `voltarParaPreparar` só
> trocava `w.status`, mas quem tem estado é o **SENTIDO** e o status é **derivado** — a volta não
> voltava (a primeira re-derivação desfazia). A regra virou peça única (`desfazerSentido`), os
> cards do sentido saem junto (única forma coerente com a fila que esvazia) e o push ao Firebase
> é imediato, senão o merge do `fbPull` ressuscita card apagado. **Configurações → Devolver tudo
> ao Preparar**, recolhido e em âmbar — devolver não apaga nenhuma palavra, só a posição no
> fluxo. A varredura pela mesma raiz achou mais dois (`saveAllToSrs`, `saveSelectedToSrs`) **e um
> bug de índice**: o card nascia apontando para o sentido errado quando havia sentido desmarcado.
> `sw.js` → `englab-v155`. Ver seção 8.2 ("A volta que não voltava").
>
> Anterior: 2026-08-08 — **O PESO NA TELA CERTA**. O insight dele: *"o card de Revisão
> é mais robusto e poderoso do que o Estudar de fato"* — e estava invertido. **Revisar ficou
> enxuto** (definição, origem, vizinhos e a cena do livro desceram para um `<details>` recolhido)
> e **o material certeiro abre sozinho ao errar**, segurando o card seguinte até ele dizer
> "Entendi". ⚠️ **A nota é aplicada na hora; só o avanço espera** — segurar a avaliação junto com
> a tela perderia o "Errei" se ele fechasse o app. **Estudar virou o painel cheio**: chips,
> pronúncia, frase falada, origem e vizinhos no cartão, mais um **MODO FOCO** de tela cheia com
> ← / Estudei / → nas setas do teclado. A fila do foco é um **retrato tirado na entrada** — sobre
> a lista viva, marcar "Estudei" reordenava tudo e o avanço pulava o vizinho. E há **atalho com
> volta**: da pausa do erro para o painel cheio e de volta à mesma tela, sessão intacta.
> `sw.js` → `englab-v154`. Ver seção 8.2 ("O peso na tela certa").
>
> Anterior: 2026-08-07 — **O ITEM AVISANDO CONTRA ELE MESMO (94ª rodada)**. Print
> dele: o item **"fall in love"** — já separado — exibia *"este sentido só existe com **in love**
> … não fall in love sozinho"* e oferecia separar o que já estava separado. **Causa:** ao
> analisar a expressão, a IA responde (com razão) `requires: "in love"`, e nada checava se o
> **item já contém** aquele material. O teste do apagamento vale sobre o ITEM COMO ELE É, não
> sobre a primeira palavra dele — corrigido nos dois lugares: guarda em `unidadeDoSentido` e a
> regra explícita no prompt. **Segundo erro no mesmo card:** a expressão herdava a frase do pai
> às cegas, e "fall" tinha sido capturado numa frase sobre o **outono** — o card de "fall in
> love" ficou ilustrado por patos e musgo-espanhol. Agora a frase só vem junto se contiver o
> material da expressão (`_fraseServeParaExpressao`), e os itens que já nasceram com a frase
> errada mostram um aviso com **"Remover a frase"** — conserto de código não limpa dado gravado.
> `sw.js` → `englab-v140`. Ver seção 8 (94ª rodada).
>
> Anterior: 2026-08-07 — **FECHANDO O QUE A 92ª DEIXOU ABERTO (93ª rodada)**.
> As seis pendências da rodada anterior, todas entregues. **A regra "de quem é o sentido" virou
> fonte única** em `lang.js` (`promptUnidadeDoSentido`, modos `analise`/`curto`/`curto-pt`) e
> alcançou os **cinco** prompts que produzem significado — análise, reanálise em lote,
> regeneração de exemplo, Assistente e extrator de documento (lá com a ressalva de que
> *canonicalizar não é encurtar*: "ran by"→"run by" continua certo, "fall in love"→"fall" nunca).
> **O `meaningIdx` posicional foi consertado na raiz**: todo card ganhou `meaningId` e a busca
> passa por `meaningDoCard()` — provado ao vivo invertendo `w.meanings` e vendo o card continuar
> no sentido certo (pela posição ele viraria outro). **O lado da captura** ganhou duas camadas:
> a de graça (a frase contém uma expressão que ele JÁ estuda) e a sob demanda ("Faz parte de uma
> expressão?", uma chamada, só se ele clicar). **A família** apareceu na tela — o item diz de
> onde veio e o que saiu dele, com clique que leva à seção certa **conforme o estado** —, e os
> itens do raio-X passaram a guardar origem retroativamente. Os **cards já na Revisão** de um
> sentido separado agora têm saída oferecida, com o preço escrito. E o detector passou a olhar
> **também à esquerda** do alvo, com barra mais alta. `sw.js` → `englab-v139`.
> Ver seção 8 (93ª rodada).
>
> Anterior: 2026-08-07 — **DE QUEM É O SENTIDO (92ª rodada)**. O item `fall` voltou
> da IA com o sentido **"apaixonar-se"** — e os três exemplos diziam *fall **in love***. Sentido
> que só existe com um complemento FIXO não é sentido da palavra: é outra unidade de estudo.
> **Causa raiz:** o prompt tinha três testes para decidir se dois sentidos são DIFERENTES, e
> todos operavam do lado do PORTUGUÊS; ninguém perguntava, do lado do inglês, **de quem é o
> sentido**. Entrou o **teste do apagamento** com três categorias (sentido da palavra ·
> unidade própria · padrão aberto — `fall silent/asleep/ill` continua sendo sentido de `fall`),
> os campos `requires`/`unit` por significado, e um **detector local, sem IA**: se os 3 exemplos
> repetem as mesmas palavras logo depois do alvo, o complemento é fixo. Separar cria a expressão
> como **item próprio** (baralho, card e agendamento dele), com `_seedMeaning` preservando o
> sentido. **Nada some do array `meanings`** — `meaningIdx` é posicional e está gravado em
> `srsCards` e na chave das imagens; o sentido movido fica com `moved_to`+`selected:false`.
> `spun_off` impede o sentido de voltar na re-análise (e se autocura se o filho for apagado).
> Junto: **varredura da base inteira** (a lição da 50ª — prompt novo não conserta dado velho),
> gratuita, 10ms em 400 itens. `sw.js` → `englab-v138`. Ver seção 8 (92ª rodada).
>
> Anterior: 2026-08-07 — **A COR QUE NÃO SEGUIA O TEMA (91ª rodada, parte C)**.
> **A medição desmentiu a premissa que a própria rodada A tinha registrado.** A pendência dizia
> "390 estilos inline, cada um um ponto onde o tema pode não chegar". Falso: dos 403 estilos
> inline, **236 são só layout, 157 já usam `var(--)` e apenas 6 prendiam uma cor**. Mover os
> outros 397 para classes seria churn enorme sem mudar um pixel. **O defeito de verdade estava
> no CSS**, não no inline: 51 cores literais fora dos blocos de tema. Achado mais concreto,
> provado no navegador: `.stat-card` tinha borda `rgba(255,255,255,0.07)` — branco sobre
> superfície BRANCA nos temas *light* e *papel*, **distância de cor ZERO**, ou seja, o cartão
> ficava sem borda nenhuma em 2 dos 6 temas. Junto: três restos de paleta antiga (`#e67e22`,
> `#1abc9c`, `#e74c3c`) que nenhum tema define, os botões success/danger com gradiente e hover
> fixos ignorando `--success`/`--error`, e um aviso apoiado num `--warning-bg` **que nunca
> existiu**. Tudo passou a sair dos tokens. `sw.js` → `englab-v136`.
> Ver seção 8 (91ª rodada, C). **As três rodadas de design estão fechadas.**
>
> Anterior: 2026-08-07 — **FOCO DE TECLADO E ALVO DE TOQUE (91ª rodada, parte B)**.
> Segunda das três rodadas de design. Em 5.196 linhas de CSS havia **dois** `:focus-visible` e
> nove `outline:none`, vários sem substituto — andar de Tab pelo app era às cegas, num app em
> que se digita o tempo todo. Agora existe um anel de foco global (`outline`, não `box-shadow`;
> `:focus-visible`, então **quem usa mouse não vê diferença nenhuma**) com `!important`
> deliberado: sem ele qualquer `outline:none` antigo mais específico apaga o anel em silêncio,
> que foi exatamente como o app chegou até aqui. **Os 34 campos do app agora têm nome
> acessível** — 24 por `label for` (eram ZERO) e 10 por `aria-label`. A varredura do horizonte
> achou o mesmo defeito **nos campos gerados por JS**: 13 arquivos corrigidos. Alvo de toque de
> 44px em `(hover:none) and (pointer:coarse)` — pelo PONTEIRO, não pela largura de tela.
> `sw.js` → `englab-v135`. Ver seção 8 (91ª rodada, B).
>
> Anterior: 2026-08-07 — **AS TRÊS ESCADAS DO CSS (91ª rodada)**. Rodada de
> *design*, não de função: o pedido foi "passar o olho no layout e propor mudanças". A varredura
> achou o CSS **já bem tokenizado em cor e tipografia** (1.451 `var(--…)`, só 7 `font-size` em
> px) e **sem escada nenhuma** nas outras três dimensões: espaçamento (244 valores distintos,
> zero token), camadas (18 z-index inventados um a um, de 1 a 99999) e breakpoints (11 valores
> em 20 grafias). O z-index não era estética: a **navegação inferior do celular estava em 999,
> ACIMA do overlay de modal (600)** — modal aberto no celular nascia atravessado pela barra.
> Junto veio **código morto que mentia sobre o app**: dois blocos de `@media(max-width:700px)`
> encolhendo a sidebar para 52px e 60px (medidas diferentes entre si!), impossíveis de acontecer
> porque em 768px a sidebar já é `display:none`. Agora existem `--sp-1..--sp-10`, `--z-*`
> nomeados e cinco degraus de breakpoint escritos como contrato no topo do arquivo. **`sw.js`
> foi para `englab-v133`** — sem o bump o aparelho continuaria servindo o CSS velho.
> Ver seção 8 (91ª rodada) e as pendências de design na 9.
>
> Anterior: 2026-08-07 — **FLUXO DE 4 ETAPAS NO AR + RENOMEAÇÃO DOS IDS
> (90ª rodada)**. A seção dos dossiês foi ligada (menu do computador e do celular, `_LAZY`,
> service worker, CSS) e os ids internos trocaram de nome junto com os rótulos: `revisar` →
> **`preparar`** (js/review.js), `estudar` → **`revisar`** (js/study.js, o SRS) e a seção nova
> ficou com **`estudar`** (js/dossie.js). Os NOMES DOS ARQUIVOS não mudaram — de propósito.
> O portão virou uma verdade só: quem marca `estudadoEm` é o `saveToSrs`, então o atalho
> "Mandar para a Revisão" do Preparar não deixa mais o dossiê mentir. Itens antigos
> (`in_srs` sem `estudadoEm`) são costurados no primeiro render. A seção também nasceu com
> **busca e filtro** (Todos / Com pendência / Concluídos). Ainda na mesma rodada, e por dois
> apontamentos dele usando a tela, o fluxo virou **fila que esvazia**: nasceu o status
> **`in_study`** e o botão principal do Preparar é **"Enviar para o Estudo"** — o item sai da
> fila e passa a viver só no dossiê (com volta pelo "Corrigir em Preparar").
> Ver seção 8 (90ª rodada) e a 8.1.
>
> Anterior: 2026-08-06 — **"NÃO LEMBRO" — saindo do limbo sem perder o lugar
> (89ª rodada)**. O balão dizia *"você marcou como conhecida"* para uma palavra que ele não
> reconhecia, e aquilo era um beco: a palavra ficava marcada, não voltava para a fila, e a
> única saída era caçá-la no Revisar. Agora esse estado (e o de *ignorada*) ganha um botão
> **"Não lembro"** que faz três coisas juntas: **desmarca** o conheço — sem isso a cobertura,
> a triagem por nível e o próprio glossário continuam achando que ele sabe —, cria o card
> **com a frase**, e o leva até aquele item. A volta ao ponto exato é um **mecanismo
> compartilhado em core.js**, não código do leitor: a tela de origem só declara de onde veio e
> como se volta, então vale para vídeo, podcast, Assistente e o que vier. A pílula "Voltar
> para <obra>" vive no `body`, fora de qualquer seção. Ver seção 8 (89ª rodada).
>
> Anterior: 2026-08-06 — **ESTUDAR POR FONTE (88ª rodada)** — hoje esse painel vive na
> seção **Revisar** (era "Estudar" antes da renomeação da 90ª): pedido de escolher a
> origem na hora de estudar ("por exemplo Flags on the Bayou, assim eu foco só nessas novas
> entradas"). O dado já existia — todo card carrega `source_type`/`source_title` desde que
> nasce — mas nunca tinha sido usado na fila do SRS, que só filtrava por deck. Agora o painel
> do Estudar traz uma fileira de cartões (livro, série, podcast) com **quantos há para hoje em
> cada um**, e a fila passa a respeitar a escolha. Convive com o filtro de deck em vez de
> substituí-lo: deck é a gaveta que ele montou, fonte é de onde a palavra veio. A escolha é
> **persistida**, e por isso a fonte ativa aparece em três lugares (cartão, botão e aviso de
> fila vazia com saída em um clique) — filtro invisível é o que faz o usuário achar que o app
> quebrou. Ver seção 8 (88ª rodada).
>
> Anterior: 2026-08-06 — **TRIAGEM POR NÍVEL (QECR) + "Estudar" no balão (86ª
> rodada)**. O Djemeson é intermediário e um capítulo acusava **647 palavras novas** — mas a
> maioria só é nova para o APP: ele as conhece, e marcá-las uma a uma nunca aconteceria. A
> cobertura mentia (67% quando o real é ~90%) e a leitura com IA pagava glosa de palavra
> sabida. Agora a IA **classifica cada palavra no QECR (A1…C2)** numa chamada barata, tudo
> **abaixo do nível dele já vem marcado** como conhecido e ele só **desmarca a exceção** —
> marcar 300 vira desmarcar 8. Faixas ACIMA também são marcáveis (chip e "marcar todas"), a
> pedido dele: ninguém sabe vocabulário em blocos alinhados com a escala. O passo é separado
> da glosa e vem ANTES, de propósito: classificar é barato e cobre tudo, e depois de marcar
> sobra bem menos para glosar. Nada é marcado sem confirmação, e há desfazer que **não apaga
> marcação antiga**. Junto: teto da glosa 120→500, o balão ganhou **Estudar** (manda a
> expressão com a frase do livro para o Revisar), e a pré-análise passou a pegar **phrasal
> verbs, idioms e colocações**. Ver seção 8 (86ª rodada).
>
> Anterior: 2026-08-06 — **O APP PASSOU A MEDIR O QUE GASTA (85ª rodada)**. Diante do
> modal de R$ 0,02, o Djemeson perguntou se aquilo condizia com a realidade. O contexto estava
> contado (a entrada inclui as frases), mas a **saída ignorava os tokens de RACIOCÍNIO**, que o
> Luna cobra no preço caro — o real ficava entre **1,8× e 6,7×** a estimativa. Em vez de chutar
> um multiplicador, o app passou a **medir**: todo `usage` é recolhido (entrada, saída,
> raciocínio, cache), o custo REAL aparece no fim (*"…palavras lidas · custou R$ X"*) e a
> medição **calibra a estimativa seguinte** por modelo. A primeira leitura de cada modelo usa
> estimativa alta de propósito e **avisa que é chute**; da segunda em diante usa o medido.
> Ver seção 8 (85ª rodada).
>
> Anterior: 2026-08-06 — **O ORÇAMENTO DE TOKENS ESTAVA ERRADO NO APP INTEIRO
> (84ª rodada)**. "Ler o capítulo" falhou com *"a IA devolveu uma resposta vazia"* rodando o
> Luna. Causa confirmada na doc da OpenAI: **modelos que raciocinam gastam os tokens de
> raciocínio DENTRO do mesmo `max_completion_tokens`** — e se o teto acaba durante o
> raciocínio, volta `finish_reason: length` com content vazio, *"cobrando entrada e raciocínio
> sem entregar resposta visível"*. Eu tinha dado **1.440** tokens; a OpenAI recomenda reservar
> **~25.000**. E o erro não era só meu: `add.js` pedia 800, `review.js` 600, `ler.js` 600 —
> **todo o app** quebraria do mesmo jeito em modelo que pensa. Corrigido no único ponto de
> passagem (`_aiTokenParam`), que agora soma 25.000 de folga só para `gpt-5*`/`o*`. A folga é
> de graça: o teto é LIMITE, não reserva. Junto, `_aiPorQueVazio()` passou a nomear a causa
> real (estouro no raciocínio, corte, filtro, recusa, erro da API, JSON inválido) em vez do
> inútil "vazia ou fora do formato". E a leitura do capítulo ganhou **barra de progresso** com
> etapa, lote atual e palavras já lidas. Ver seção 8 (84ª rodada).
>
> Anterior: 2026-08-06 — **CAMADA 1: A PRÉ-ANÁLISE DO CAPÍTULO (83ª rodada)**. O plano
> registrado era embarcar um dicionário inglês→português. **A medição derrubou o plano, e é bom
> que tenha derrubado.** O extrato do Wikcionário português (kaikki.org, 18.044 verbetes) cabia
> folgado — **0,26 MB comprimido**, cobrindo **91,5%** do texto corrido com o nosso lematizador.
> Reprovou na qualidade: `barrel`→"barril" (no livro dele é o **cano** do fuzil), `bore`→
> "chateação" (é o passado de *bear*), `yank`→"puxão" (é *Billy Yank*, o soldado da União), e
> `tire`/`animus` sem verbete. E o sentido certo **não está lá**: `barrel` tem três acepções e
> nenhuma é a arma. Embarcar aquilo seria reintroduzir por 0,26 MB o erro que as rodadas 163–167
> gastaram para matar. **Em vez disso**: ele não lê "inglês em geral", lê UM livro — então as
> palavras novas do capítulo vão para a IA **com a frase em que aparecem**, numa chamada só, e
> ficam guardadas no IndexedDB. A glosa nasce presa ao contexto. Nunca automático: confirma com
> o custo real na frente (~1 centavo por capítulo no `gpt-5-nano`). Ver seção 8 (83ª rodada).
>
> Anterior: 2026-08-06 — **GLOSSÁRIO NO HOVER — camada 0 (82ª rodada)**: pedido
> "um dicionário onde passar o mouse numa palavra mostra o significado, como o Language
> Reactor". **A medição decidiu a arquitetura**: Wiktionary REST responde em 772–1234 ms,
> MediaWiki em 2817 ms, `dictionaryapi.dev` devolve **200 com corpo vazio** (quebrado) e o
> endpoint de definições do `pt.wiktionary` **não existe (501)** — ou seja, nenhuma API serve
> para hover (que precisa de ~50 ms) e não há rota gratuita de inglês→português. O dado tem de
> estar no aparelho. Nasceu `js/glossario.js` (SHELL) com a **camada 0**: o dicionário é o que
> **o próprio aluno já escreveu** — cards, `knownWords`, `ignoredWords`. Zero download, zero
> custo, e a tradução é a certa porque já foi validada no contexto. Lê a palavra sob o cursor
> por `caretPositionFromPoint` (**sem tocar no DOM** — envolver palavra em `<span>` quebraria a
> paginação por colunas do leitor), tem lematizador com irregulares (`began`→begin,
> `went`→go, `children`→child, `running`→run) e **prefere o sentido `context_match`** —
> `barrel` mostra "cano", não "barril". Ligado no leitor, no Revisar e no Assistente pelo MESMO
> componente. No celular **nenhum gesto novo**: a glosa entra no popup que o toque longo já
> abre. De graça: o `isKnownWord` passou a enxergar verbo irregular. Ver seção 8 (82ª rodada).
>
> Anterior: 2026-08-06 — **Catálogo de imagens revisado na fonte (81ª rodada)**:
> o nível barato do Gemini deixou de ser o `gemini-2.5-flash-image` (US$ 0,039, set/2025) e
> passou a ser o **`gemini-3.1-flash-lite-image` — Nano Banana 2 Lite (US$ 0,0336, jun/2026)**:
> mais novo E mais barato ao mesmo tempo, então manter o 2.5 era pagar mais por uma geração
> anterior. O 2.5 saiu do catálogo. **Armadilha registrada:** o Imagen 4 Fast custa US$ 0,02 e
> parece o mais barato de todos, mas os três Imagen 4 estão **depreciados e desligam em
> 17/ago/2026** — não entrar. O seletor de Configurações parou de usar `toFixed(3)`, que
> arredondava 0,0336 para "0,034" e fazia a tela cobrar mais do que a tabela.
> **TTS avaliado e recusado:** o `gemini-2.5-flash-preview-tts` (US$ 0,50/10,00) sai perto do
> `gpt-4o-mini-tts` que já usamos, e ambos os TTS do Gemini são *Preview* — trocar a pipeline
> inteira por empate não se paga. Ver seção 8 (81ª rodada) e a pendência do Live Translate na 9.
>
> Anterior: 2026-08-05 — **SEÇÃO LER: o leitor de ebooks nativo (79ª rodada)**:
> a ponte com o Kindle sempre terminava numa exportação manual, e o único ganho real do
> aparelho era a tela. Então o livro passou a morar AQUI: nova seção **Ler** com estante,
> leitor de `.epub`/`.txt`/`.html` (ZIP + EPUB lidos sem nenhuma dependência), tipografia de
> descanso (5 temas, tamanho, entrelinha, medida, virar página ou rolagem), posição salva e
> sincronizada — e, em cima disso, **duplo-clique numa palavra vira card com a frase do
> livro**, cobertura de vocabulário por capítulo e a lista das palavras novas mais frequentes.
> **No celular** o leitor toma a tela inteira, vira página no arrasto do dedo ou no toque das
> bordas, e o toque longo numa palavra abre Explicar/Estudar.
> Ver seção 8 (79ª rodada, itens 146–153) e o roteiro na seção 9.
>
> Anterior: 2026-08-05 — **Fechando o que a 76ª deixou aberto (78ª rodada)**:
> "Seus podcasts" passou a sincronizar (`podShows` em core.js + doc `data/podShows`), nasceu o
> painel de **espaço em disco** em Configurações → Dados locais, e caiu um bug antigo do
> "Apagar todos os dados" — que re-enviava vídeos/cortes/conversas para a nuvem logo depois de
> limpar o disco. Ver seção 8 (78ª rodada).
>
> Anterior: 2026-08-05 — **PONTE COM O KINDLE (77ª rodada)**: o `vocab.db` do
> aparelho (toda palavra que você toca, com a frase de contexto) passou a ser lido direto no
> navegador por um leitor de SQLite escrito à mão (sem WASM, sem dependência), com importação
> INCREMENTAL — conectou o cabo, só o que é novo entra. No `read.amazon.com` a extensão
> captura ao vivo (com modo "auto"), inclusive em documento pessoal. O histórico "já importei"
> virou estado de core.js e passou a sincronizar. Ver seção 8 (77ª rodada).
>
> Anterior: 2026-08-05 — **PODCASTS no módulo Vídeo (76ª rodada)**: busca no
> catálogo do Apple Podcasts (sem chave), episódios pelo RSS do próprio programa, o mp3 baixa
> para o aparelho e cai no player de sempre — legenda, régua, PT, ditado, shadowing e card com
> o áudio real da fala. Transcrição publicada pelo programa (Podcasting 2.0) vira legenda de
> graça. Ver seção 8 (76ª rodada).
>
> Anterior: 2026-08-05 — **Acertos da seção (75ª rodada)**: controles do player
> voltaram ao rodapé do vídeo, cores originais de volta (o teal é só de palavra conhecida) e
> a área da legenda passou a explicar por que está vazia. Ver seção 8 (75ª rodada).
>
> Anterior: 2026-08-04 — **Seção abaixo do vídeo (74ª rodada)**: em vez de flutuar
> sobre a cena e brigar com os controles, a extensão passou a ter uma SEÇÃO própria abaixo do
> player (que encolhe na medida exata), com um modo minimizado em que só as legendas voltam a
> flutuar, com fundo próprio. Ver seção 8 (74ª rodada).
>
> Anterior: 2026-08-04 — **Painel com altura constante (73ª rodada)**: a linha de
> tradução sumia por completo sem texto (o painel "crescia um pouquinho" quando a fala
> chegava) e a barra não nascia se o vídeo começasse em silêncio. Ver seção 8 (73ª rodada).
>
> Anterior: 2026-08-04 — **Layout da barra: espaços, proporção e controles (72ª
> rodada)**: as palavras saíam coladas porque a linha virou container flex (que descarta os
> espaços); a barra também cobria a barra de progresso do player. Ver seção 8 (72ª rodada).
>
> Anterior: 2026-08-04 — **Capturas que sumiam no reload (71ª rodada)**: duas
> causas — o app se anunciava pronto ANTES de carregar as palavras, e o listener não
> sincronizava (a nuvem apagava no carregamento seguinte). Ver seção 8 (71ª rodada).
>
> Anterior: 2026-08-04 — **Sessão por título + REGRA DO HORIZONTE (70ª rodada)**:
> trocar de série/filme deixava a legenda antiga na memória (legenda trocada/dessincronizada);
> agora há reset por título, detecção de troca de idioma e a barra some fora do player. E
> ficou valendo para sempre a regra "olhar para o horizonte". Ver seção 8 (70ª rodada).
>
> Anterior: 2026-08-04 — **Painel de tamanho fixo e régua que desliza (69ª
> rodada)**: a barra parou de mudar de tamanho a cada fala (dimensionada pelo teto do padrão
> de legendagem: 42 caracteres × 2 linhas) e a régua virou um trilho que desliza por frame.
> Ver seção 8 (69ª rodada).
>
> Anterior: 2026-08-04 — **Régua de falas + PT em sincronia (68ª rodada)**: barra
> não some mais no silêncio, a fala exibida passou a vir do MESMO cue que é traduzido (fim
> do PT atrasado) e nasceu a régua de falas — na extensão E no vídeo do Lab.
> Ver seção 8 (68ª rodada).
>
> Anterior: 2026-08-04 — **Extensão v2.4.0: contexto congelado e legenda PT que
> aparece (67ª rodada)**: a frase de origem vinha errada (o vídeo voltava a rodar enquanto o
> mouse ia ao botão) e a tradução quase nunca aparecia (o cache era indexado pelo texto CRU,
> que não bate entre tela e arquivo). Ver seção 8 (67ª rodada).
>
> Anterior: 2026-08-04 — **Extensão v2.3.0: entrega injetada + seleção de trecho
> (66ª rodada)**: as capturas não chegavam ao Lab (a aba tinha ponte órfã e o botão só a
> focava) e não dava para selecionar trecho (a Netflix bloqueia seleção no player).
> Ver seção 8 (66ª rodada).
>
> Anterior: 2026-08-04 — **Extensão v2.2.0: promessas no lugar de callbacks (65ª
> rodada)**: a classe inteira do erro "Extension context invalidated" foi eliminada trocando
> os callbacks do chrome.* por promessas com .catch(). Ver seção 8 (65ª rodada).
>
> Anterior: 2026-08-04 — **Extensão v2.1.2: o erro estava no CALLBACK (64ª
> rodada)**: proteger a chamada não bastava — o callback roda depois e ali até LER
> `chrome.runtime.lastError` lança. Todos os callbacks embrulhados + rede de segurança.
> Ver seção 8 (64ª rodada).
>
> Anterior: 2026-08-04 — **Extensão v2.1.1: ponte à prova de recarga (63ª
> rodada)**: o erro em bridge.js era "Extension context invalidated" (aba viva + extensão
> recarregada); os 3 content scripts foram blindados e o popup passou a abrir a URL real
> do app (Vercel). Ver seção 8 (63ª rodada).
>
> Anterior: 2026-08-04 — **Extensão v2.1: fim do crash e acabamento (62ª rodada)**:
> o seek ia direto no `video.currentTime` e derrubava o pipeline MSE/DRM da Netflix (agora
> usa a API interna do player); legendas em segmentos eram substituídas em vez de somadas
> (por isso "seções inteiras sumiam"); e a barra ganhou desenho novo. Ver seção 8.
>
> Anterior: 2026-08-04 — **Extensão v2: o módulo Vídeo dentro da Netflix (61ª
> rodada)**: intercepta o TTML do player (tempos reais) e ganha tradução IA com névoa,
> navegação por fala, Explicar/Estudar na seleção, transcript clicável e atalhos.
> Ver seção 8 (61ª rodada).
>
> Anterior: 2026-08-04 — **Extensão para a Netflix (60ª rodada)**: pasta
> /extension (Manifest V3) com legendas clicáveis no player da Netflix (técnica Language
> Reactor), capturas em chrome.storage e ponte que as entrega no Revisar quando o app abre
> — sem chave de API na extensão. Ver seção 8 (60ª rodada).
>
> Anterior: 2026-08-04 — **Gerenciador de Palavras (59ª rodada)**: seção nova com
> inventário montado a partir do SEU material (legendas + contextos + cards), grid de chips
> por status, filtros com contadores, medidor de domínio, busca/ordenação e varredura em
> lote. Ver seção 8 (59ª rodada).
>
> Anterior: 2026-08-04 — **Pacote de 7 tarefas (58ª rodada)**: chip do "ethos"
> (adjetivo+substantivo livre não é colocação), persona "Lex" no Assistente, módulo de
> vídeo aceita PODCAST (áudio), núcleo do módulo PALAVRAS CONHECIDAS (triagem + SRS maduro
> + cobertura de episódio + sync por união), e análises de clipes de vídeo/addons de
> stream/Netflix. Ver seção 8 (58ª rodada).
>
> Anterior: 2026-08-04 — **Triagem em camadas (57ª rodada)**: recorte criado pela
> triagem volta a ser triável — um phrasal pode ter palavra desconhecida dentro — mas SÓ
> sobre ele mesmo: o filtro limita ao conteúdo do objeto e o objeto inteiro nunca vira chip.
> `no_break` removido. Ver seção 8 (57ª rodada).
>
> Anterior: 2026-08-04 — **Triagem fiel ao objeto de estudo (56ª rodada)**: a
> triagem devolvia pedaços da frase de CONTEXTO ("Okay.", "Great.") e re-triava itens que
> ela mesma criou. Agora: filtro no código (unidade fora do objeto é descartada) + marca
> `no_break` nascendo JUNTO com o item (corrida corrigida). Ver seção 8 (56ª rodada).
>
> Anterior: 2026-08-04 — **Anti-literal em todo o projeto (55ª rodada)**: a
> armadilha da tradução literal ("get you in" → "colocar você dentro") agora é combatida
> explicitamente nos 7 prompts que produzem português, com exemplo contrastivo e ordem de
> operação ("entenda a função na cena, depois traduza a função") — técnica calibrada para
> modelos baratos. Ver seção 8 (55ª rodada).
>
> Anterior: 2026-08-04 — **Faxina do Raio-X (54ª rodada)**: a área de triagem não
> tinha passado pela lente KonMari — saíram o aviso redundante, o botão que repetia ação já
> feita, o rodapé duplicado e o botão desabilitado; chips ficaram leves e a análise recuou a
> ação secundária quando há triagem. Ver seção 8 (54ª rodada).
>
> Anterior: 2026-08-04 — **Lista do Revisar "Marie Kondo" (53ª rodada)**: linhas
> de 32px (eram ~90), chips "Pendente IA" repetidos viraram ponto âmbar / contador de
> significados, checkbox só no hover, cabeçalhos de grupo discretos, coluna 320px.
> Ver seção 8 (53ª rodada).
>
> Anterior: 2026-08-04 — **Raio-X da frase (52ª rodada)**: frase capturada é
> triada AUTOMATICAMENTE pela IA ao entrar na revisão (leve, ~R$ 0,0004) — chips de
> palavras/phrasals/expressões/estruturas com mini-glosa; o aluno marca o que NÃO conhece
> e os itens saem criados e ANALISADOS. Ver seção 8 (52ª rodada).
>
> Anterior: 2026-08-04 — **Forma neutra, tempos fixos e o merge que fossilizava
> (51ª rodada)**: o "debilitante" preso vinha do merge de preservação (agora resolve
> contradições); títulos em forma de citação (lema, sem "esvazia" conjugado nem
> "esvaziadora" inventado); exemplos em ordem fixa presente→passado→forma que mais flexiona;
> trava de coerência replicada em TODOS os prompts geradores. Ver seção 8 (51ª rodada).
>
> Anterior: 2026-08-04 — **Sentido vs sinônimo (50ª rodada)**: cards vinham com 1
> significado só, empacotando sentidos distintos como se fossem sinônimos ("desvirilizador,
> castrador, debilitante"). O prompt ganhou três testes lexicográficos, checagem de
> coerência, auditoria de sentidos e teto de tokens maior. Ver seção 8 (50ª rodada).
>
> Anterior: 2026-08-04 — **Varredura anti-DeepSeek (49ª rodada)**: "Analisar com
> IA" não fazia nada com o DeepSeek — `aiJSON` dependia de `response_format: json_object`.
> Agora tem 3 camadas + parser tolerante, e TODAS as guardas de chat do projeto deixaram de
> exigir chave OpenAI. Ver seção 8 (49ª rodada).
>
> Anterior: 2026-08-04 — **Imagens pelo Gemini (48ª rodada)**: fornecedor de
> imagens virou opção (OpenAI ou Gemini) com três níveis cada, modelo e preço reais no
> dropdown; duas rotas da API do Gemini com plano B automático. Ver seção 8 (48ª rodada).
>
> Anterior: 2026-08-04 — **Transcrição na Groq, 9× mais barata (47ª rodada)**: o
> "só a OpenAI faz isso" estava errado — a Groq roda o MESMO Whisper num endpoint idêntico
> por US$ 0,04/h (contra 0,36). Transcrição centralizada em `aiTranscribe()` com escolha de
> fornecedor. Ver seção 8 (47ª rodada).
>
> Anterior: 2026-08-04 — **Pacote de 4 tarefas do Djemeson (46ª rodada)**:
> progresso do dia agora é gravado card a card (encerrar no "X" zerava tudo); Explicar
> ganhou rede de segurança (`aiTextSeguro` → OpenAI quando o DeepSeek volta vazio);
> navegação ‹‹/›› passou a andar por FRASE (legendas encadeadas viram grupo); e o custo
> estimado passou a sair do preço real do modelo ativo. Ver seção 8 (46ª rodada).
>
> Anterior: 2026-08-03 — **Tradução da IA volta ligada sozinha (45ª rodada)**: ao
> reabrir um vídeo já traduzido, o modo PT volta no estado de antes (preferência `cfg.vidPT`
> + auto-ligar quando há tradução salva), com aviso de quantas falas; importar um .srt PT
> passou a entrar como TRADUÇÃO, sem substituir a legenda EN. Ver seção 8 (45ª rodada).
>
> Anterior: 2026-08-03 — **130 falas de fora no Traduzir legenda inteira (44ª
> rodada)**: a passada única deixava para trás o que o modelo pulava/truncava. Agora são
> até 3 passadas automáticas (blocos 10 → 5), teto de tokens folgado (140/fala), parser
> aceita markdown, e o total espera os fallbacks antes de contar. Ver seção 8 (44ª rodada).
>
> Anterior: 2026-08-03 — **PT IA a tempo + legenda inteira (42ª/43ª rodadas)**:
> tradução em tempo real virou blocos de 4 falas em PARALELO com janela de 30s (lote
> grande demorava e a fala passava sem tradução); Explicar com resposta vazia não é mais
> cacheado mudo; e o painel de sincronia ganhou "Traduzir legenda inteira" (IA traduz
> todas as falas de uma vez, blocos de 20). Ver seção 8.
>
> Anterior: 2026-08-03 — **DeepSeek recusa conteúdo adulto (41ª rodada)**: falas
> explícitas eram omitidas/recusadas silenciosamente pelo DeepSeek (comportamento
> documentado) e trechos ficavam sem tradução. Agora: prompt de tradução fiel, fallback
> automático para a OpenAI SÓ nas falas recusadas, e desistência controlada (sem loop de
> chamadas). Ver seção 8 (41ª rodada).
>
> Anterior: 2026-08-03 — **PT IA falhando SÓ no DeepSeek (40ª rodada)**: o lote de
> tradução usava `response_format: json_object`, que no DeepSeek às vezes volta
> vazio/truncado (limitação documentada) — trechos grandes ficavam sem tradução. O lote
> agora é texto puro com linhas numeradas (funciona em qualquer fornecedor) + timeout de
> 30s. Ver seção 8 (40ª rodada).
>
> Anterior: 2026-08-03 — **Explicar "não vai" com o vídeo tocando (39ª rodada)**:
> a troca de fala escondia o popup antes de a resposta da IA chegar. Agora Explicar PAUSA
> o vídeo, a troca de fala não fecha o popup com explicação carregando, e erro aparece
> dentro do popup. Ver seção 8 (39ª rodada).
>
> Anterior: 2026-08-03 — **Três consertos do uso real (38ª rodada)**: explicação
> vinha CORTADA (teto de 220 tokens → 600, no vídeo e no Revisar); cabeçalho do popup da
> legenda agora é linha única (seleção longa não empurra mais botão para baixo); e a
> tradução IA que pulava falas com DeepSeek virou LOTE (uma chamada por janela) com
> antecedência de 12s. Ver seção 8 (38ª rodada).
>
> Anterior: 2026-08-03 — **Explicar na legenda do vídeo (37ª rodada)**: o popup de
> seleção da legenda sobre o vídeo ganhou o botão "Explicar" (mini-glosa da IA ali mesmo,
> com a fala como contexto), com as mesmas proteções anti-colapso da 34ª rodada e cache
> compartilhado com o Revisar. Ver seção 8 (37ª rodada).
>
> Última atualização anterior: 2026-08-03 — **DeepSeek V4 (36ª rodada)**: IDs novos confirmados na doc
> oficial (v4-flash/v4-pro); os aliases V3 foram descontinuados pelo próprio DeepSeek em
> 24/07/2026 e saíram da lista — migração automática para quem os tinha salvos.
>
> Anterior a essa: 2026-08-03 — **Multi-fornecedor de IA + botões de tradução no vídeo (35ª
> rodada)**: Gemini, DeepSeek e Groq além da OpenAI (modelos curados por faixa de custo,
> chaves organizadas com teste individual, sync); TTS/imagens/Whisper seguem na OpenAI. No
> vídeo, a tradução virou dois botões com ícone (CC = legenda oficial, faíscas = IA literal),
> flutuando no vídeo e funcionando em tela cheia. Ver seção 8 (35ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Fix do Explicar (34ª rodada)**: o mousedown do clique
> colapsava a seleção e o próprio listener escondia o popup antes da explicação chegar.
> Clique dentro do popup não fecha mais + preventDefault preserva a seleção.
> Ver seção 8 (34ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Explicar/minerar por seleção no Revisar (33ª rodada)**: o
> caso "o que é Adderall?" — selecione qualquer palavra no card e escolha "Explicar" (gloss da
> IA ali mesmo, com cache) ou "Revisar" (vira item novo herdando contexto e fonte). Sem trocar
> de aba, sem perder o card aberto. Ver seção 8 (33ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Tradução em 3 posições + névoa (32ª rodada)**: um botão
> alterna off → legenda PT-BR oficial → IA literal em tempo real (traduz só o ponto atual +5s,
> economia de tokens validada); névoa borrada por padrão sobre o vídeo com hover revelando,
> desligável — tudo funcionando em fullscreen. Ver seção 8 (32ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Navegação por fala (31ª rodada)**: R repete a fala que
> acabou de passar; ←/→ pulam entre falas (com comportamento "faixa anterior"); Shift+←/→
> mantém os ±5s; segundo par de botões flutuantes no vídeo. Ver seção 8 (31ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Modularização + 3 modos novos (30ª rodada)**: video.js
> virou 4 módulos por responsabilidade (com retry no loader lazy); nasceram o DITADO (escreva o
> que ouviu, correção palavra a palavra, custo zero), o SHADOWING (grave a imitação, a IA diz o
> que saiu claro) e a LEGENDA CRIADA PELA IA (episódio sem legenda em lugar nenhum → Whisper
> escreve uma, ~R,50); fullscreen do vídeo consertado. Ver seção 8 (30ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Correção progressiva de deriva (29ª rodada)**: o caso dos
> 9s que travou o estudo — rótulo adiantada/atrasada estava invertido, a âncora do "começo"
> podia ser o minuto 20, e deriva não se conserta com shift constante. Agora a IA mede 2 pontos
> e reescreve a legenda com desvio interpolado (teste: deriva 3,5s→8,1s ficou a ≤50ms do áudio
> de ponta a ponta). Ver seção 8 (29ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Legenda automática na abertura (28ª rodada)**: abrir um
> vídeo sem legenda dispara a cadeia inteira sozinho (título+episódio do nome do arquivo →
> Cinemeta → addons → melhor da língua → aplica → trilha PT atrás). Validado com rede real:
> 1020 falas do White Lotus S01E01 aplicadas com zero cliques, PT-BR alinhada em 851.
> Ver seção 8 (28ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Candidatas sem teto + tela cheia + pular ±5s (27ª
> rodada)**: o sync com IA testa TODAS as legendas alternativas (a boa estava na posição 7 e o
> teto de 5 a deixava de fora) e adota a menos derivada quando nenhuma é perfeita; tela cheia
> com legenda por dois caminhos (botão próprio = overlay interativo; botão nativo = trilha
> VTT nativa); botões −5s/+5s no vídeo + setas do teclado. Ver seção 8 (27ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Continuar de onde parou (26ª rodada)**: reabrir o mesmo
> arquivo volta com a legenda modificada intacta e retoma a posição (com 2s de recuo; "parou
> em X" na biblioteca). O teste achou e matou um bug de perda de dados (save debounced abortado
> na saída do player) e um caso degenerado do alinhador PT. Ver seção 8 (26ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Seleção na legenda do vídeo (25ª rodada)**: arraste (ou
> clique duplo) na legenda SOBRE o vídeo e leve a palavra/trecho para o estudo — com áudio real
> da cena ou direto para o Revisar. E os botões de traduzir pararam de "não fazer nada":
> tradução pedida aparece sem blur e o PT do trecho aparece no próprio painel.
> Ver seção 8 (25ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Alinhador PT v2 (24ª rodada)**: a tradução PT caía na fala
> errada (a trilha PT vem de outra release — agora o alinhador estima o offset entre as trilhas
> com varredura + mediana) e duplicava no estudo focado (fusões de 2 falas EN num cue PT agora
> são deduplicadas na exibição). Dados antigos se corrigem sozinhos ao reabrir o vídeo.
> Ver seção 8 (24ª rodada).
>
> Última atualização anterior: 2026-08-03 — **.srt sincronizado + IA troca legenda errada (23ª rodada)**:
> "Baixar .srt" exporta a legenda com a sincronização aplicada e o mesmo nome do vídeo (players
> externos carregam sozinhos); e a sincronização agora verifica DOIS pontos do episódio — se a
> legenda deriva (versão diferente), a IA testa as candidatas da busca contra as mesmas
> transcrições (custo zero extra) e troca sozinha pela que casa. Ver seção 8 (23ª rodada).
>
> Última atualização anterior: 2026-08-03 — **Sync com IA consertado (22ª rodada)**: a amostra agora cai
> sozinha no trecho MAIS FALADO do episódio (densidade medida pela própria legenda), o botão
> volta a habilitar após uma falha (re-render movido para depois da trava) e nasceu o último
> recurso "IA do ponto atual" — pause num diálogo e a IA analisa dali.
> Ver seção 8 (22ª rodada).
>
> Última atualização anterior: 2026-08-02 — **Marcador em ciclo + sync com IA (21ª rodada)**: M abre o
> trecho, M fecha e cai direto no estudo focado (marcador virou intervalo); e o painel "Sync"
> ajusta a legenda na mão (±0,1/±0,5s) ou sozinho — Whisper transcreve ~45s do áudio real com
> timestamps, casa com a legenda e aplica a mediana dos desvios (teste com dessincronia
> plantada de +2,0s: detectou e corrigiu exato). Ver seção 8 (21ª rodada).
>
> Última atualização anterior: 2026-08-02 — **Player de verdade (20ª rodada)**: legenda em tempo real
> sobre o vídeo, tradução simultânea em camadas (legenda PT-BR oficial alinhada por tempo —
> 614/769 falas no teste real — com IA como camada adicional), busca de legenda sem fricção
> (direto para a lista do episódio) e ESTUDO FOCADO por trecho (escuta às cegas → revelar fala
> → revelar tradução → salvar card com áudio real), acessível da seleção e dos marcadores.
> Ver seção 8 (20ª rodada).
>
> Última atualização anterior: 2026-08-02 — **Legendas via addons do Stremio + conserto de áudio Dolby
> (19ª rodada)**: botão "Buscar legenda" (protocolo aberto dos addons, com CORS — a função
> serverless ficou desnecessária; validado com 40 legendas reais de House of the Dragon S03E02)
> e "Consertar áudio" para MKV com Dolby/DTS mudo no Chrome (ffmpeg.wasm hospedado no próprio
> site, WORKERFS, m4a no IndexedDB + <audio> paralelo sincronizado).
> Ver seção 8 (19ª rodada).
>
> Última atualização anterior: 2026-08-01 — **FASE 1 DO VÍDEO NO AR (18ª rodada)**: nova seção "Vídeo"
> (lazy) com player + transcript karaokê + cortes A–B + card com o ÁUDIO REAL da cena +
> "Preparar para assistir" + marcadores + tradução com recall + "rever a cena" no estudo.
> Backup: tag git `pre-video-fase1` e Exportar JSON virou backup completo.
> Ver seção 8 (18ª rodada) e `PLANO-VIDEO.md`.
>
> Última atualização anterior: 2026-08-01 — **Estudo de escopo VÍDEO (17ª rodada)**: análise completa da
> funcionalidade de estudar com vídeo + legenda está em [`PLANO-VIDEO.md`](./PLANO-VIDEO.md)
> (viabilidade das 4 ideias do Djemeson, arquitetura, custos, fases, ideias extras). SEM código
> ainda — aguardando as decisões da seção 9 do plano. Ver seção 8 (17ª rodada).
>
> Última atualização anterior: 2026-08-01 — **Estudar no celular (16ª rodada)**: a página rolava 63px
> para o lado a 375px. Causas: `repeat(3,1fr)` que não encolhe (`1fr` = `minmax(auto,1fr)`) e a
> tabela de baralhos empurrando a página em vez de rolar dentro do cartão. Agora: 0 de scroll
> horizontal nas 7 telas a 320px e 375px. Ver seção 8 (16ª rodada).
>
> Última atualização anterior: 2026-08-01 — **Dashboard mais denso (15ª rodada)**: 443px de moldura antes
> do primeiro dado viraram 347px, a seção passou de 1180 para 1336px de largura (e o heatmap
> voltou a mostrar o ano inteiro), o hero parou de espalhar os números pelas pontas e as colunas
> do painel foram reorganizadas por altura medida (vão de 653px → ~220px).
> Ver seção 8 (sessão 2026-08-01, 15ª rodada).
>
> Última atualização anterior: 2026-08-01 — **Heatmap na coluna de sempre (14ª rodada)**: o alargamento
> da 13ª rodada foi revertido a pedido. A barra de rolagem some encolhendo o HISTÓRICO (39
> semanas a 1440px, 17 a 375px), não o layout. De quebra, o alinhamento dos rótulos
> Seg/Qua/Sex, que acumulava 5px no celular, foi para 0,01px.
> Ver seção 8 (sessão 2026-08-01, 14ª rodada).
>
> Última atualização anterior: 2026-08-01 — **Heatmap fluido (13ª rodada)**: a grade tinha largura fixa
> (795px) dentro de uma coluna de 412px e a diferença virava barra de rolagem. O cartão passou a
> ocupar a largura toda, a célula virou fluida (colunas `1fr` + `aspect-ratio`) e o número de
> semanas de histórico é escolhido pelo espaço disponível — overflow deixou de ser possível.
> Ver seção 8 (sessão 2026-08-01, 13ª rodada).
>
> Última atualização anterior: 2026-07-31 — **Heatmap com previsão (12ª rodada)**: o calendário de
> atividade passou a mostrar 28 dias à frente com os cards já agendados (célula vazada, para
> não confundir carga prevista com esforço feito), ganhou a estatística "Próx. 7 dias" e agora
> nasce rolado até o fim — antes hoje ficava fora da tela.
> Ver seção 8 (sessão 2026-07-31, 12ª rodada).
>
> Última atualização anterior: 2026-07-31 — **Imagem do card ilustra o SENTIDO (11ª rodada)**: o prompt
> mandava a palavra estrangeira + o significado em português para o modelo de imagem, que
> ancorava no sentido mais comum ("tally" 2/2 = concordar saía como marcas de contagem). Agora
> `buildImageScene()` traduz o sentido numa cena em inglês, com os outros sentidos da palavra
> como proibição, e a palavra não vai mais para o modelo de imagem.
> Ver seção 8 (sessão 2026-07-31, 11ª rodada).
>
> Última atualização anterior: 2026-07-31 — **Sidebar reformada (7ª rodada)**: os 254px de vazio (35% da
> altura) viraram um bloco **"Hoje"** ancorado no fim do menu (progresso do dia + sequência),
> o rótulo "MENU" virou dois grupos ("Geral" e "Vocabulário"), o item ativo trocou gradiente +
> anel por tinta chapada + marca de 3px no vinco da barra, os contadores viraram pílulas tintas
> e o cartão de conta (3 linhas com moldura) virou uma linha só com o ponto de nuvem no avatar.
> Ver seção 8 (sessão 2026-07-31, 7ª rodada).
>
> Última atualização anterior: 2026-07-30 — **Sessão de infraestrutura + correções + melhorias na cópia
> `english-lab-2.0`**: repositório git configurado apontando para `Djemeson/english-lab`,
> service worker consertado para GitHub Pages, PWA instalável, variáveis CSS que não existiam,
> corrida de cards no player de playlist, viewport que bloqueava zoom, emojis residuais e
> documentação obsoleta. Ver seção 8 (sessão 2026-07-30).
>
> Última atualização anterior: 2026-07-14 — **Dashboard implementado a partir do mockup Claude
> Design** ("Dashboard.dc.html", projeto "Redesign da aba"): 7 seções novas com DADOS REAIS
> (nenhuma mockada) — atividade (heatmap 12 meses), tendência de acerto (14 dias), progresso por
> baralho/idioma, "travando na memória" (leeches), palavra em destaque do dia, fontes do
> vocabulário e conquistas (6 marcos calculados). Na mesma data, **correção do bug de
> pluralização** no hero do Dashboard ("0 revisãoões"). Ver seção 8 (sessão 2026-07-14).
>
> Última atualização anterior: 2026-07-13 (2ª rodada) — **Precisão do negrito do objeto de estudo**
> revisada em todos os 7 pontos que geram frases (review.js, audio.js × 2, study.js,
> consulta.js, add.js × 2): prompts padronizados/reforçados (flexão, expressão de várias
> palavras/separável, idiom, ocorrência repetida), mismatch entre a regra e o exemplo de
> schema JSON corrigido em review.js/audio.js, rede de segurança adicionada na Fase 1 do
> extrator de documento, e o botão "Negrito perfeito (IA)" da Biblioteca passou a validar
> com precisão (exatamente 1 span, não vazio, não a frase inteira) em vez de só checar se
> existe algum `<b>`. Ver seção 8 (sessão 2026-07-13, 2ª rodada).
>
> Última atualização anterior: 2026-07-13 — **Reskin visual "Papel"** (app renomeado para "Language
> Lab" na interface; novo 6º tema `papel` claro com paleta azul-tinta; fonte serifada
> Newsreader nos títulos/palavras/números grandes; cantos mais arredondados e sombras mais
> quentes nos 6 temas; hero card do Dashboard em gradiente; chips/tabs em pílula). Mudança
> só de CSS/tokens — nenhum id/classe usado pelo JS foi tocado. Ver seção 8 (sessão
> 2026-07-13).
>
> Última atualização anterior: 2026-07-05 — **Botão de IA passou a PRESERVAR exemplos já curados**
> ("Analisar com IA"/"Re-analisar" no Revisar não sobrescreve mais significado/frases de um
> sentido que já tinha exemplos — só completa o que falta). Botão temporário da Biblioteca
> generalizado: `fillOriginsAll` → `fillMissingAll` ("Completar dados (IA)"), preenche IPA/
> categoria/nível/origem vazios sem tocar em frases. Ver seção 8 (sessão 2026-07-05, 2ª rodada).
>
> **Suporte MULTI-IDIOMA implementado** (qualquer idioma na
> entrada; PT-BR continua sendo a saída). Novo `js/lang.js` (NÃO-lazy, logo após core.js) com o
> registro `LANGS` (en/es/fr/de + fallback genérico), seletor de idioma ativo (Adicionar +
> Assistente), decks por idioma sob demanda, auto-detecção e supertipos universais + `type_label`.
> Ver `PLANO-MULTI-IDIOMA.md`. ⚠️ Ainda NÃO testado ao vivo.

---

## 1. O que é o projeto

**English Lab** é uma plataforma pessoal (web, HTML/CSS/JS puro, sem build) para o
Djemeson estudar inglês por leitura progressiva. Captura vocabulário de várias fontes,
analisa com IA (OpenAI), gera áudio (TTS) e estuda com **repetição espaçada (SRS) nativa**
(algoritmo SM-2 estilo Anki). Sincroniza entre dispositivos via **Firebase/Firestore**.

- **Hospedagem (DOIS destinos, desde 2026-07-30):**
  - GitHub Pages → `https://djemeson.github.io/english-lab/`
  - Vercel → `https://english-lab-seven.vercel.app/` (projeto `english-lab`, time
    `djemeson's projects`, importado do GitHub em 2026-07-30)
- **Deploy:** `git push origin main` publica nos **dois** (Actions do Pages + integração Git da
  Vercel). Decisão do Djemeson: **toda alteração vai para os dois destinos**. Confirme o
  Actions (`gh run list --branch main --limit 1`) antes de dar a tarefa por concluída.
  ⚠️ Ao contrário do que este arquivo dizia antes, a pasta **não** faz deploy sozinha: é
  preciso commitar e dar push de verdade.
- **Firebase e domínios:** o login Google só funciona em domínios autorizados
  (Console → Authentication → Settings → Authorized domains). URL nova = login quebrado até
  adicionar. Precisam estar lá: `djemeson.github.io`, `localhost` e o domínio da Vercel.
- **IA:** OpenAI (chave fica em `cfg.openaiKey`). Análise e TTS rodam direto no browser.
- **n8n:** REMOVIDO em 2026-07-30. O app não depende de nenhum serviço externo próprio —
  é só navegador + OpenAI + Firebase.

---

## 2. Estrutura de arquivos

```
index.html        — markup de todas as seções + modais
css/styles.css    — todo o CSS (tokens/temas no topo, camadas premium no fim)
sw.js             — service worker (cache do shell)
js/core.js        — estado, storage, temas, ÍCONES, toast, inputModal, tooltips, navegação
js/lang.js        — MULTI-IDIOMA: registro LANGS, idioma ativo, decks/idioma, migração (NÃO-lazy)
                    + as REGRAS DE PROMPT compartilhadas: promptRegrasLexicais (lexicais) e
                    promptUnidadeDoSentido (de quem é o sentido). Regra nova de significado
                    nasce AQUI, nunca dentro do prompt que precisou dela.
js/firebase.js    — sincronização Firestore (TEMPO REAL)
js/audio.js       — IndexedDB (AudioDB/CardsDB/ImageDB), TTS, Biblioteca (browser de cards), reanálise
js/srs.js         — MOTOR SM-2 (estado srsCards/srsCfg/srsLog/srsSession)
js/dashboard.js   — render do Dashboard
js/review.js      — seção PREPARAR (fila + análise de IA, prompt principal). Id: `preparar`
js/settings.js    — Configurações (cfg, temas, AI_MODELS, limpar dados)
js/init.js        — bootstrap (initApp) + service worker
js/add.js         — aba Adicionar (manual/Kindle/Mídia/Website)  (CARREGADO LAZY)
js/kindle-db.js   — leitor SQLite só-leitura (vocab.db do Kindle), sem WASM  (LAZY, antes de add.js)
js/epub.js        — leitor de ZIP (DecompressionStream nativo) + parser EPUB  (LAZY, antes de ler.js)
js/ler.js         — seção LER: estante, leitor, tipografia, captura, cobertura  (LAZY)
js/consulta.js    — seção Assistente (chat IA, histórico, streaming, SRS múltiplo)  (NÃO-lazy)
js/study.js       — seção REVISAR: UI/sessão do SRS. Id: `revisar`   (CARREGADO LAZY)
js/dossie.js      — seção ESTUDAR: os dossiês por obra+capítulo. Id: `estudar`  (LAZY)
js/known.js       — seção Palavras (gerenciador de vocabulário)  (LAZY)
js/video*.js      — PACOTE lazy da seção Vídeo, carregado NESTA ordem:
                    video.js (estado + player + biblioteca)
                    video-subs.js (parser/busca/aplicação de legenda, tradução, Whisper)
                    video-sync.js (painel de sincronia + correção de deriva)
                    video-study.js (seleção, card com áudio real, ditado, shadowing)
                    video-podcast.js (agregador de podcasts: busca, feed, download)
```

> ⚠️ **O NOME DO ARQUIVO NÃO É O NOME DA SEÇÃO** desde 2026-08-07: `review.js` = **Preparar**,
> `study.js` = **Revisar**, `dossie.js` = **Estudar**. O mapa oficial está em `js/core.js`,
> acima de `SECTIONS`. Ver seção 8.1.

> ⚠️ **`consulta.js` é NÃO-lazy** (incluído sempre no index.html). Motivo: o `firebase.js`
> precisa de `conversas`/`saveConversas` no sync e re-renderiza o Assistente no snapshot.
> O ESTADO `conversas`/`activeConversaId` + `loadConversas`/`saveConversas` ficam em `core.js`
> (não-lazy); só a UI/lógica do chat vive em `consulta.js`.

### ⚠️ Lazy-loading — a armadilha nº 1 do projeto
`add.js` e `study.js` são carregados **sob demanda** (só ao abrir "Adicionar"/"Estudar"),
via `_LAZY` em `core.js`. **Funções/variáveis definidas neles NÃO podem ser usadas por
arquivos não-lazy** (core, firebase, audio, srs, dashboard, review, settings, init),
senão quebra com `X is not defined` quando o usuário não passou por aquela aba.

Já corrigimos vários casos assim (movendo para arquivos não-lazy):
- `srcIcon` → core.js
- `AI_MODELS` / `updateModelOptions` → settings.js
- `OPENAI_VOICES` / `randomVoice` → audio.js
- `srsSession` → srs.js
- `VARIETY_LABELS` / `REGISTER_LABELS` + `varietyChip`/`registerChip` → **lang.js** (2026-07-30)
- `buildSrsFrente` → **core.js** (2026-07-30)
- `kindleHighlightHash` / `loadKindleSeen` / `saveKindleSeen` / `kindleItemKey` /
  `kindleItemVisto` / `markKindleItemsAsSeen` → **core.js** (2026-08-05) — o `firebase.js`
  usa o histórico do Kindle no sync e chamava funções que moravam no `add.js` lazy
**Ao criar algo novo, verifique quem usa antes de decidir onde declarar.**

---

## 3. Modelo de dados

- **`words[]`** — itens capturados. Cada um: `{id, word, context, source_type, source_title,
  source_context, lang, status, ipa, type, type_label, meanings[], created_at, updated_at}`.
  `status`: `pending_ai` → `pending_review` → **`in_study`** → `in_srs` (ou `skipped`).
  - **`in_study`** (desde 2026-08-07) — o item **foi enviado para o Estudo**: sumiu da fila do
    Preparar e vive no dossiê. É o estado que faz cada tela ser uma fila que ESVAZIA, em vez de
    o mesmo item aparecer em duas telas ao mesmo tempo. `enviadoEm` guarda quando.
    Ida: `enviarParaEstudo()`/`enviarSelecionadasParaEstudo()` (review.js).
    Volta: `voltarParaPreparar()` — análise errada não pode virar beco sem saída.
  - **`estudadoEm`** (número, desde 2026-08-07): o instante em que o item foi dado por
    estudado — é o que o manda para a repetição espaçada e o que a seção **Estudar** usa
    para saber o que já saiu do dossiê. Quem grava é o **`saveToSrs()`**, sempre; itens
    anteriores ao campo são costurados no 1º render do dossiê (ver 8.1).
  - `lang`: código ISO do idioma do item ('en' padrão/legado). `type` é supertipo universal
    (`word|phrasal_verb|idiom|collocation`; `phrasal_verb` = expressão verbal do idioma);
    `type_label` = nome local da categoria em PT (ex.: "verbo separável"). Ver `js/lang.js`.
  - `source_context`: nota opcional de gênero/contexto da fonte (ex.: "reality de sobrevivência").
    Usada pela IA para desambiguar (resolve o caso "snuff" → "apagar a tocha" no Survivor).
  - **`spun_off[]`** (desde 2026-08-07, 92ª rodada) — sentidos que **viraram item próprio**:
    `{meaning_pt, word, wordId, at}`. É o que impede a re-análise de trazer de volta um sentido
    que o aluno separou. Mora AQUI, e não dentro de `meanings`, porque `meanings` é
    **reconstruído** a cada análise — marca posta lá não sobreviveria. **Autocura**: se o item
    filho não existe mais em `words`, o bloqueio cai (a decisão deixou de existir).
  - **`from`** (no item FILHO) — `{id, word, rel:'mwe', meaning_pt}`: de qual item ele saiu.
    Hoje serve ao bloqueio acima; é também a base pronta para as "variantes/família" (pendência).
  - `meanings[]`: `{meaning_pt, definition_pt, origin_pt, variety, register, level, examples[], ...}`
    - **`requires` / `unit`** (92ª rodada): o material FIXO sem o qual o sentido não existe
      (`"in love"`) e a expressão inteira (`"fall in love"`). Vazios quando o sentido é da
      palavra sozinha OU de um padrão aberto (`fall + adjetivo`). Quem preenche é a IA; o
      detector `unidadeFixaDoSentido` (core.js) confere sozinho, sem custo.
    - **`moved_to` / `moved_word`** (92ª rodada): o sentido virou o item `moved_to`. Ele
      **continua no array** — `meaningIdx` é POSICIONAL e está gravado em `srsCards` e na chave
      das imagens, então remover embaralharia os cards já criados. Quem o exclui do SRS é o
      `selected:false` que vai junto; quem o exclui das telas é o filtro `!m.moved_to`
      (Preparar, dossiê, glossário, prompt de imagem).
    - `origin_pt`: origem/história da expressão (só quando há etimologia/imagem interessante;
      vazio para palavras comuns). Vai para o snapshot do card e aparece no estudo e na revisão.
  - `examples[]`: `{en, pt}` (en com a palavra-alvo em `<b>`).
- **`srsCards[]`** — um card por (wordId, meaningIdx, exampleIdx). Guarda *snapshot*
  do conteúdo + estado SM-2.
  - ⚠️ **`meaningId` (desde 2026-08-07, 93ª rodada) é quem identifica o significado**, não o
    `meaningIdx`: `w.meanings` é RECONSTRUÍDO a cada análise, então a posição muda em silêncio se
    a IA devolver os sentidos em outra ordem. **Sempre use `meaningDoCard(w, card)`** (core.js,
    não-lazy) para ir do card ao significado — ele tenta o id e cai na posição só para card
    antigo. `migrateMeaningIds()` (no `initApp`) preenche o campo na base existente.
    O `meaningIdx` **continua sendo gravado**: é a chave da imagem (`img_wordId_meaningIdx`) e o
    que agrupa cards irmãos.
  Campos: `{id, wordId, meaningIdx, meaningId, exampleIdx, deckId, state, due,
  interval, ease, lapses, stepIdx, variety, register, word, lang, type_label, meaning_pt,
  example_en, example_pt, leech?}`. `state`: `new|learning|review|relearning`.
- **`srsDecks[]`** — baralhos (árvore). Padrão em `DEFAULT_DECKS` (core.js).
- **`srsLog[]`** — `{date, reviewed, correct, newSeen}` por dia.
- **`srsCfg`** — parâmetros SM-2 (ver seção SRS).
- **`cfg`** — `{openaiKey, n8nBase, theme, aiProvider, aiModel, ttsProvider}`.
- **`videos[]`** (core.js, sincronizado) — `{id, title, source_type, lang, fileName, fileSize,
  duration, cueCount, coverage, markers[], position, subShift, created_at, updated_at}`.
  Só metadados: o arquivo NUNCA entra aqui.
  - **`podcast`** (só em episódios de podcast) — `{showTitle, feedUrl, collectionId, artwork,
    guid, audioUrl, pageUrl, published, sizeBytes, transcriptUrl, transcriptType}`.
    É a chave de identidade (`guid`) e o caminho para **rebaixar o áudio em qualquer aparelho**.
- **`videos[]` fora do localStorage:** IndexedDB `el-video-db` (v3) —
  `handles` (File System Access), `subs` (legendas + trilha PT + candidatas),
  `media` (áudio consertado pelo ffmpeg) e **`files` (o mp3 do episódio de podcast baixado)**.
  Nada disso sincroniza: é peso de arquivo, fica no aparelho.
- **`podShows[]`** (core.js, localStorage `el-podcasts`, **sincronizado** em `data/podShows`) —
  programas de podcast já visitados, para o atalho "Seus podcasts":
  `{title, artist, artwork, feedUrl, collectionId, addedAt}` (máx. 24). Só ponteiros — nenhum
  áudio. A nuvem é adotada como em `videos[]`, então **remover um programa propaga**.

### Onde cada coisa é persistida
- **localStorage:** `cfg` (`englab_cfg`), `words`, `srsCfg`, `srsLog`, `srsDecks`, filas Kindle.
- **IndexedDB:** `CardsDB` (cards — fonte local primária), `AudioDB` (áudios b64),
  `ImageDB` (imagens b64), `SettingsDB` (**backup da cfg** — sobrevive à limpeza do localStorage).
- **Firestore (`users/{uid}/`):** `data/{words,srsCards,srsCfg,srsLog,srsDecks,cfg,kindleQueue}`,
  `audio/*`, `images/*`.

---

## 4. Sincronização (Firebase) — MODELO ATUAL: tempo real, nuvem = fonte da verdade

`js/firebase.js`:
- **Login** (`onAuthStateChanged`) → `attachRealtimeSync()`: listener `onSnapshot` na
  coleção `data`. Qualquer mudança/exclusão em qualquer dispositivo reflete na hora.
- **`applyCloudDocs(docs)`**: adota o estado da nuvem (SUBSTITUI o local, **sem merge**).
  - Doc presente (mesmo com lista vazia) → adota → **exclusões propagam**.
  - Doc ausente → ignora (não apaga dispositivo que ainda não sincronizou).
  - `cfg`: só sobrescreve campos não-vazios (preserva chave/URL locais).
  - Durante **sessão de estudo ativa**, cards da nuvem ficam em `_pendingCloudCards` e são
    aplicados ao encerrar a sessão (`flushPendingCloudCards`, chamado em `endSrsSession`).
  - Ignora o "eco" das próprias escritas (`metadata.hasPendingWrites`).
- **Mudança local** → `autoSyncAfterChange()` (debounce ~1.2s) → `fbPushData()` grava os
  docs na nuvem → propaga para os outros via snapshot.
- **`fbPushData`**: grava words/srsCards/srsCfg/srsLog/srsDecks + `cfg` (com `merge:true`,
  **omitindo openaiKey/n8nBase vazios** para nunca apagar a chave na nuvem).
- **Áudio/imagens:** `fbPullMedia()` (uma vez ao conectar). Push de áudio via
  `autoSyncAudioAfterChange` (debounce longo).
- **`setPersistence(LOCAL)`** garante que o login sobreviva a refresh.

Trade-off aceito: edição simultânea do mesmo item em 2 lugares = vence o último a salvar.

⚠️ **Ainda não testado em 2 dispositivos ao vivo.** Antes de mexer em sync, **exportar JSON**
(Configurações → Exportar) como backup.

---

## 5. Motor SRS (SM-2 estilo Anki) — `js/srs.js`

`SRS_DEF_CFG` espelha o preset do Anki do usuário:
```
newPerDay, revPerDay, steps[] (aprendizagem, min), relearnSteps[] (reaprendizagem, min),
graduateInterval (1d), easyInterval (4d), easeStart (2.5), easeMin (1.3), easyBonus (1.3),
hardInterval (1.2), intervalModifier (1.0), lapseNewInterval (0), minInterval (1),
maxInterval (36500), leechThreshold (50)
```
- **Card novo + "Bom"** → avança UMA etapa de aprendizagem (ex.: 10m) e **reaparece na
  sessão**; só gradua (vira `review`, 1 dia) ao concluir todas as etapas. **"Fácil"** pula
  o aprendizado e vai direto p/ revisão (4 dias). (Era o bug "estudado só uma vez" — corrigido.)
- **Lapso (errar em review)** → `relearning` com etapas próprias; intervalo reduzido por
  `lapseNewInterval`; ao atingir `leechThreshold` falhas, marca `card.leech` (selo, sem suspender).
- Modal "Configurar SRS" expõe todos os parâmetros + botão **"Preset do Anki"**.
- `rateSrsCard` (aplica nota), `previewInterval` (mostra o próximo intervalo nos botões).

---

## 6. Identidade visual / Premium

- **Temas:** `data-theme` no `<html>`. 6 temas em `THEMES` (core.js): `midnight` (padrão),
  `light`, `sepia`, `emerald`, `violet`, `papel` (novo, sessão 2026-07-13 — claro, acento
  azul-tinta `#2E4BC6`, estética "paper"). Trocados em Configurações → Aparência. `applyTheme()`
  grava em `cfg.theme` (persistido + sincronizado). TODA cor usa variáveis CSS (`var(--...)`);
  acentos usam `rgba(var(--primary-rgb), …)` para seguir o tema. `--radius`/`--radius-sm`
  (16px/11px) e as sombras (`--shadow*`) são compartilhados pelos 6 temas com tom mais quente
  desde o reskin "Papel".
- **Fonte:** Inter (corpo/UI) + **Newsreader** (serifada, só em `.page-header h1`, palavra do
  card de Revisar `.wc-word`, palavra da flashcard `.srs-card-front-word`/`.srs-back-word` e
  números grandes `.mc-val`/`.sdc-value`/`.dash-num`) — carregada via Google Fonts em
  `index.html`. Regras do reskin ficam numa seção nova no FIM de `css/styles.css` (depois do
  bloco "Biblioteca Cards|Palavras"), para vencer a cascata sem editar as regras antigas.
- **Ícones:** SEM emojis na interface. Use `ic('nome')` (core.js, mapa `ICONS`, SVG de linha).
  `srcIcon(tipo)` para fontes (série/filme/etc.). HTML estático usa `<svg class="ic">` inline.
- **Tooltips:** sistema global em core.js — qualquer elemento com `data-tip` ou `title`
  ganha tooltip premium (flutuante, não cortado por overflow).
- **Modais:** use `inputModal({...})` (core.js) em vez de `prompt()`. Overlay `.srs-modal-overlay`.
- **Layout:** conteúdo centralizado (`.section` com max-width; Biblioteca é full-width),
  sidebar com logo + nav em pílulas agrupada ("Geral"/"Vocabulário") + bloco "Hoje" ancorado no
  fim do menu + linha de conta no rodapé, page-headers com ícone + ação à direita.
- **As quatro escadas (91ª rodada).** Nada de valor solto: toda medida nova sai de um destes.
  - **Tipografia** — `--fs-3xs` … `--fs-3xl` (10 degraus).
  - **Espaçamento** — `--sp-1` (4px) … `--sp-10` (40px). Ficam fora só 1-3px (borda,
    deslocamento óptico), o 0 e as medidas calibradas no olho de um componente único (barra de
    legenda do vídeo, tipografia do leitor).
  - **Camadas** — `--z-sticky` 60 · `--z-panel` 100 · `--z-nav` 200 · `--z-popover` 300 ·
    `--z-hover` 400 · `--z-modal` 500 · `--z-modal-pop` 550 · `--z-lightbox` 600 · `--z-pill`
    650 · `--z-gate` 700 · `--z-toast` 800 · `--z-tooltip` 900. **Camada nova entra AQUI,
    nomeada** — nunca com um número solto na regra. Valores 1-10 literais no arquivo são
    empilhamento local dentro de um componente e não competem com nada global.
  - **Breakpoints** — 480 / 640 / **768 (CORTE MOBILE: a sidebar some e entram o header e a nav
    inferior)** / 1040 / 1280. Sempre `@media (max-width:NNNpx)`, com espaço depois do `@media`.
    ⚠️ **Nada abaixo de 768px pode mexer na `.sidebar`** — ela já é `display:none` ali. Duas
    rodadas escreveram regras assim e as duas eram código morto.
  - As escadas de espaço e camada moram em `:root` de propósito (como as famílias tipográficas):
    **não mudam com o tema**, só as cores mudam.
- **Acessibilidade (91ª rodada, B).** Regras fixas, não sugestões:
  - **Todo campo precisa de nome acessível.** `<label for="id">` quando há rótulo visível;
    `aria-label` quando não há. **Placeholder NÃO é rótulo** — some ao digitar e leitor de tela
    não o trata como nome. Vale igual para campo gerado por JS (foi lá que estava a maior parte
    do problema). Em lista, o rótulo é específico do item: `aria-label="Selecionar ${escA(w.word)}"`,
    nunca "selecionar este item" repetido vinte vezes. `escA` vive em `core.js` (não-lazy).
  - **O anel de foco é global e usa `!important`** — de propósito, para que nenhum `outline:none`
    futuro o apague em silêncio. Fica no fim de `css/styles.css`. **Não declare `border-radius`
    no `:focus-visible`**: o outline já segue o raio do elemento, e declarar ali muda a FORMA do
    elemento enquanto ele está focado.
  - **Alvo de toque de 44px em `@media (hover:none) and (pointer:coarse)`** — pelo ponteiro,
    nunca por largura de tela.
- **Cor literal: quando pode (91ª rodada, C).** A regra "toda cor via variável" tem exceções
  legítimas, e elas estão marcadas no CSS para ninguém "consertar" por engano: **cor de marca**
  (o botão do Google), **o que fica sobre imagem e não sobre o tema** (véu preto e legenda do
  vídeo, lightbox), e **os 5 temas próprios do leitor** (`--ler-*`, mesma estrutura de tema, só
  local). Fora disso, cor literal é bug — e o mais caro deles é **branco-alpha em borda**:
  invisível nos temas `light` e `papel`, onde a superfície JÁ é branca. Use `--border`.
  ⚠️ **Para conferir tema por script, desligue a `transition` antes de medir** — várias
  superfícies têm 0,3s em `border-color`/`background`, e `getComputedStyle` no meio da animação
  devolve o valor ANTIGO e faz parecer que o tema não pegou.
- **⚠️ Mexeu em `css/styles.css`? Bumpe o `CACHE` do `sw.js`.** O shell é cache-first: sem o
  bump o aparelho continua servindo o CSS anterior mesmo depois do reload. Descoberto na
  verificação da 91ª rodada, quando o navegador insistia em mostrar o layout velho.

---

## 7. Telas (seções)

- **Dashboard** — ação principal (estudar hoje, com chip de sequência quando streak > 0) + 4
  cards de métrica + grade de 2 colunas com: atividade (heatmap 12 meses), tendência de acerto
  (14 dias), progresso por baralho/idioma, "travando na memória" (leeches); coluna direita:
  palavra em destaque do dia + fontes do vocabulário. Abaixo: card de conquistas (6 marcos) +
  recentes. Tudo com dados reais, sem estado novo persistido (deriva de `srsLog`/`srsCards`/
  `words` já existentes). Ver `js/dashboard.js` (funções `dash*`) e seção 8 (sessão 2026-07-14).
- **Assistente** — seção própria (2ª no menu), chat com IA estilo Claude. Layout de duas colunas:
  histórico de conversas à esquerda (nova/selecionar/renomear/excluir/buscar) e o chat à direita.
  - **Histórico persistido** em `conversas[]` (localStorage `el-consulta-conversas`) e **sincronizado**
    via Firebase (doc `data/conversas`, merge por `id` mantendo o `updated_at` mais recente).
  - **Streaming** (SSE da OpenAI, `stream:true`) — a resposta aparece aos poucos.
  - **Vários itens SRS por resposta**: o prompt pede um ARRAY `<srs_items>` com TODOS os termos
    falados (não só um). Cada termo vira um botão "Adicionar"; se já estiver em `words[]`, mostra
    "já no estudo" (anti-duplicado). Botão "Adicionar todos" quando há mais de um pendente.
  - Adicionar um item reusa `createWord` + `saveToSrs` (cria a palavra em `pending_review` já com
    significado/exemplos e salva direto no SRS).
- **Adicionar** — abas Manual / Kindle / Mídia. (A aba **Consulta** virou a seção **Assistente**;
  a aba **Website** saiu junto com o n8n em 2026-07-30.)
  - **Mídia** tem três entradas: (1) colar texto linha a linha → `analyzeMidiaText`; (2) campo
    opcional de **contexto/gênero** (`#midia-context-new`); (3) **upload/arrastar documento**
    (.md/.txt/.pdf) → `handleMidiaFile` → `extractMidiaDoc`. O doc é lido (PDF via pdf.js do CDN),
    a IA infere o gênero pela fonte e extrai só o que vira card, com significado **no contexto da
    fonte**. Cada item vira palavra em `pending_review` (via `createDocWord`) já com significado +
    exemplo + IPA + nível — pronto para salvar no SRS, sem perdas na revisão.
- **Preparar** (id `preparar`, `js/review.js`) — sidebar (filtros em pílula + busca + lista) e
  card central com significados selecionáveis. Ação principal: **"Enviar para o Estudo"** — o
  item vira `in_study`, **sai desta fila** e passa a viver no dossiê. O **"Pular para a
  Revisão"** é o atalho assumido, discreto e no fim. Badge de pendentes fica NESTE item do menu.
  - **Separar sentido que é de outra expressão** (92ª rodada): significado cujo sentido só
    existe com material fixo ("fall" + *in love*) ganha um aviso âmbar nomeando a expressão e o
    botão **"Separar em item próprio"**; os demais têm a mesma ação discreta (ícone de camadas
    nos chips), para quando o detector não vê o que o aluno vê. No cabeçalho, **"Expressões
    presas N"** abre a varredura da base INTEIRA (todos os status, sem custo de IA) — e só
    aparece quando há o que separar.
  - **A palavra que nasceu dentro de uma expressão** (93ª rodada): item de UMA palavra com frase
    de contexto ganha duas camadas. De graça, um aviso quando a frase contém uma expressão que
    ele **já estuda** ("a frase contém *fall in love*"). Sob demanda, o botão **"Faz parte de uma
    expressão?"** — uma chamada de IA, só se ele clicar; adotar a expressão cria o item e
    pergunta se dispensa a palavra solta.
  - **Família** (93ª rodada): quando o item veio de outro (sentido separado ou parte escolhida no
    raio-X), o cabeçalho mostra de onde ele veio e o que saiu dele. O clique leva à seção onde o
    parente está AGORA — Preparar, dossiê ou glossário.
- **Estudar** (id `estudar`, `js/dossie.js`, LAZY) — os **dossiês**: o que foi **enviado do
  Preparar** (`in_study`) mais o que já foi estudado (`in_srs`, legível para releitura),
  agrupado por obra + capítulo, com o material que a IA montou (frase original com tradução, significados,
  definições e exemplos). Duas telas: grade de dossiês com barra de progresso e a leitura item
  a item. **Marcar "Estudei" é o portão** que manda aquele item para a repetição espaçada.
  Busca + filtro (Todos / Com pendência / Concluídos) no topo. Ver 8.1.
- **Revisar** (id `revisar`, `js/study.js`, LAZY) — o SRS: números clicáveis
  (Novos/Revisar/Aprender) abrem a Biblioteca filtrada; escolha de fonte; tabela de baralhos;
  sessão de flip card + 4 botões (Errei/Difícil/Bom/Fácil).
- **Biblioteca** — aba própria. Browser de todos os cards por baralho + preview. Botão
  **"Reanalisar tudo (corrigir)"**: regenera exemplos batendo com o significado, preenche
  variedade/registro e gera áudio das novas frases, **preservando o agendamento SRS**.
- **Vídeo e podcast** — biblioteca → player. Duas portas de entrada: **"Abrir arquivo"**
  (episódio/filme/áudio do computador) e **"Buscar podcast"** (catálogo do Apple Podcasts →
  programa → episódio → baixa e abre). Dentro do player, tudo é igual para os dois: legenda,
  régua de falas, PT legenda/PT IA com névoa, Explicar, marcadores, estudo focado, ditado,
  shadowing e card com o áudio real. Só o cabeçalho muda: podcast troca "Buscar legenda"
  (addons, que não indexam podcast) por **"Criar legenda com IA"** e ganha **"Liberar espaço"**.
- **Configurações** — Aparência (temas), IA (provider/modelo/chave/TTS), n8n, Firebase, Dados
  locais (exportar/importar/limpar), Manutenção de áudio.

---

## 8. Histórico do que foi feito (sessão de junho/2026)

### Sessão 2026-08-07 (94ª rodada) — O ITEM AVISANDO CONTRA ELE MESMO

**O print**: o item **"fall in love"** (já separado de "fall", com a fileira de família mostrando
"< fall") exibia o aviso âmbar *"Este sentido só existe com **in love** — parece ser a expressão
**fall in love**, não fall in love sozinho"*, com o botão "Separar em item próprio" logo ao lado.
Frase sem sentido, botão que não podia funcionar, e o item contado na varredura como se houvesse
o que fazer.

**Erro 1 — nada verificava se o item JÁ É a unidade.** Ao analisar "fall in love", a IA preencheu
`requires: "in love"` — e ela **não está errada**: aquele sentido exige mesmo aquelas palavras. O
que faltava era a pergunta seguinte, do lado do app: *essas palavras já estão no item?* O
detector local não teria disparado ali (com o item de 3 palavras a barra exige 2+ palavras em
comum e sobrava só "with"), então o defeito entrou pelo caminho que o código **confia**: o campo
da IA. Corrigido nos dois lados, como manda o padrão da 49ª:
- **Guarda em `unidadeDoSentido`**: descarta quando `unidade` normalizada é igual ao item, ou
  quando o próprio item já contém `extra`. Vale para o campo da IA e para o detector.
- **Regra no prompt** (`promptUnidadeDoSentido`, modos `analise` e `curto-pt`): *"o teste é sobre
  o item EXATAMENTE COMO DADO, não sobre a primeira palavra dele — se ele já contém o material
  fixo, `requires` e `unit` ficam vazios"*, com "fall in love" nomeado como o caso.

**Erro 2, no mesmo card — a frase que não era daquele item.** O cabeçalho mostrava *"Morning on
the Lady of the Lake Plantation… particularly in the late **fall** when the sky is a clear blue…
thousands of ducks quacking"*. Era a frase do PAI: "fall" foi capturado num trecho sobre o
**outono**, e "apaixonar-se" era apenas um dos sentidos que a IA lista para a palavra. A
separação herdava `context`/`context_pt` às cegas, então o card de "fall in love" nasceu
ilustrado por uma citação sobre patos.
- **`_fraseServeParaExpressao(frase, expressao)`**: a frase só vem junto se contiver o RESTO da
  expressão ("in love") — olhando o resto, nunca o verbo, porque a frase traz "fell"/"falling" e
  comparar forma com forma erra em todo irregular (mesmo raciocínio de `unidadeJaEstudada`).
- **O dado já gravado não se conserta sozinho** (a lição da 50ª, terceira vez): os itens
  separados ANTES desta rodada continuam com a frase alheia colada. Em vez de apagar por conta
  própria — a frase pode ser a única pista de onde ele viu aquilo —, o card mostra o aviso
  *"Esta frase veio de fall e não usa fall in love"* com o botão **"Remover a frase"**. Só
  aparece em item com `from` cuja frase realmente não serve.

**Verificado ao vivo** reproduzindo o print: o aviso contra si mesmo sumiu e a varredura zerou;
o caso legítimo (o pai "fall" com o sentido "apaixonar-se") **continua** avisando e aparecendo na
varredura; separar a partir da frase do outono cria o item **sem contexto**; "Remover a frase"
limpa os dois campos e o aviso some. Console limpo. `CACHE`: `v139` → **`v140`**.

### Sessão 2026-08-07 (93ª rodada) — FECHANDO AS SEIS PENDÊNCIAS DA 92ª

**O pedido**: "implemente o que ficou de fora e depois pode comitar e dar push". As seis
pendências abertas pela rodada anterior, todas nesta rodada.

**1. A regra virou FONTE ÚNICA e alcançou os cinco prompts.** `promptUnidadeDoSentido(alvo, modo)`
mora agora em **`lang.js`**, ao lado de `promptRegrasLexicais` e pelo mesmo motivo registrado em
2026-08-05: *regra em cópia é regra que diverge*. Três modos, porque o teto de atenção do modelo
barato é curto: **`analise`** (bloco inteiro, 3 categorias + caso trabalhado), **`curto`** (4
linhas, para quem só gera exemplo) e **`curto-pt`** (as mesmas em português, para o Assistente,
cujo prompt é escrito em PT — o que não podia existir era uma SEGUNDA versão da regra escrita à
mão por lá). Aplicada em: `analyzeWordDirect` (review.js), `regenerateMeaning` (audio.js),
`regenerateCardExample` (study.js), `srsExtractSystem` (consulta.js) e `ENRICH_SYSTEM` (add.js).
- ⚠️ **No extrator de documento a regra podia virar contradição** e por isso entrou nomeada:
  *CANONICALIZING IS NOT SHORTENING*. A canonicalização da 4ª rodada de 2026-06-24 ("ran by" →
  "run by", "run something by someone" → "run by") continua **certa** — ela tira flexão e
  encaixe livre. O que ela nunca pode tirar é o material FIXO: "fall in love" → "fall" seria
  perder o sentido junto.

**2. `meaningIdx` posicional — consertado na raiz, não contornado.** Era uma fragilidade
ANTERIOR à 92ª: toda análise reconstrói `w.meanings`, então bastava a IA devolver os sentidos em
outra ordem para todo card existente passar a apontar, em silêncio, para outro significado — sem
erro, só trocando nível, definição e imagem de lugar. Agora:
- `createSrsCard` grava **`meaningId`** (o `id` que cada significado já tinha desde o
  `applyAiResult`, e que o merge de curadoria preserva).
- **`meaningDoCard(w, card)`** (core.js, não-lazy) é o único jeito de ir do card ao significado:
  tenta pelo id, cai na posição quando o card é antigo. Substituiu os **6 pontos** que liam
  `w.meanings[card.meaningIdx]` (audio.js ×4, study.js ×1, e o agrupamento de nível).
- **`migrateMeaningIds()`** (chamado no `initApp`, junto do `migrateLangFields`) congela a
  identidade dos cards antigos **enquanto a posição ainda é a verdade** — depois seria tarde.
- `meaningIdx` **continua sendo gravado**: é a chave das imagens (`img_wordId_meaningIdx`) e o
  que agrupa cards irmãos. Mudar a chave da imagem órfãaria as imagens já geradas.
- Provado ao vivo: com `w.meanings` invertido, o card continuou em "apaixonar-se" (pela posição
  teria virado "cair"); card sem `meaningId` continua resolvendo pela posição.

**3. O lado da captura — o item que já NASCE errado.** Clicar em "fall" numa frase que diz
"fell in love" cria um item que nunca poderá ser consertado por separação, porque o material
certo nunca existiu. Duas camadas, na ordem do custo:
- **De graça**: `unidadeJaEstudada(w)` acha uma expressão que ele **já estuda** e que está nesta
  frase. Casa pela **cauda** ("in love"), nunca pelo verbo — a frase traz "fell"/"falling" e
  comparar forma com forma erraria em todo verbo irregular (a mesma razão pela qual o negrito é a
  âncora do detector). Vira um aviso no card com "Abrir <expressão>".
- **Sob demanda**: botão **"Faz parte de uma expressão?"** (só para item de UMA palavra com frase
  de ≥3 palavras). Uma chamada curta, com o teste do apagamento dentro do prompt e a instrução
  explícita de devolver **lista vazia** quando a palavra está no sentido dela mesma ("She fell on
  the ice" → vazio). A resposta vazia é mostrada como resposta ("está no sentido dela mesma"),
  senão ele clicaria de novo achando que falhou. Adotar a expressão cria o item com a mesma frase
  e fonte e **pergunta se dispensa** a palavra solta — com remoção inline, porque o `deleteWord`
  abre a própria confirmação e perguntar duas vezes a mesma coisa ensina a clicar sem ler.

**4. A família na tela.** `familiaDoItem(w)` deriva pai e filhos de `w.from` — **o pai não guarda
lista**: duas listas para a mesma verdade divergem. A fileira só aparece quando há parentesco.
**`irParaItem(id)`** (core.js) manda para a seção certa **conforme o estado**: Preparar
(pending), dossiê aberto na obra certa (in_study, com o cuidado do `dossie.js` ser lazy),
glossário focado (in_srs). Mandar para a tela errada é pior do que não ter link.
**Ganho retroativo**: os itens que o **raio-X** cria a partir de uma frase agora guardam origem
(`rel:'part'`) — antes não guardavam nada.

**5. Os cards que já estavam na Revisão.** Antes só o número era avisado. Agora, ao separar, o
app **pergunta** se exclui, com o preço escrito (perde intervalo, facilidade e lapsos) e a
alternativa nomeada ("Deixar como estão"). Apagar sem perguntar destruiria agendamento de
semanas; avisar sem oferecer saída seria empurrar o problema.

**6. O detector passou a olhar à esquerda.** A 92ª registrou que olhar os dois lados "dobraria o
falso positivo" — **medindo, isso se mostrou pessimista**: à esquerda do alvo costuma estar o
SUJEITO, e o prompt exige que ele varie, então repetição ali é sinal forte. Entrou com barra
mais alta (**2+ palavras**, contra 1 à direita) e só quando a direita não disse nada. Pega
"make up" a partir de "make"; e continua devolvendo `null` quando o possessivo varia
("make up **your/his/our** mind" a partir de "mind") — conservador, como deve ser.

**Verificado ao vivo** (servidor local): as 5 funções de prompt carregam a regra (inclusive as
lazy, `study.js` e `add.js`); `meaningDoCard` resolve por id com o array invertido; separação com
card na Revisão pergunta e exclui; família aparece nos dois lados e navega para as 3 seções;
aviso de graça acerta a frase com a expressão e **não** acerta "She fell on the ice"; varredura
zera depois de separar; chip da família segue o tema nos 6; sem transbordo; console limpo.
⚠️ **Armadilha de verificação (nova, vale registrar)**: além do service worker, o **cache HTTP do
navegador** serviu um `lang.js` velho por dois recarregamentos seguidos — o sintoma foi
`promptUnidadeDoSentido` indefinida enquanto a função VIZINHA no mesmo arquivo existia. Só caiu
com `fetch(src, {cache:'reload'})` em todos os scripts antes do reload. `CACHE`: `v138` → **`v139`**.

### Sessão 2026-08-07 (92ª rodada) — DE QUEM É O SENTIDO: "fall" não significa apaixonar-se

**O caso** (print dele): o item `fall` voltou com **8 significados**, e um deles era
**"apaixonar-se"**. Os três exemplos: *"People **fall** in love…"*, *"Clara **fell** in love…"*,
*"He is **falling** in love…"*. A prova estava no próprio dado, sem IA nenhuma: **os três
exemplos compartilham as mesmas duas palavras extras**. Se o sentido fosse de `fall`, o
complemento variaria. Junto, um segundo defeito no mesmo card: o sentido "ficar, tornar-se"
(*falls silent*, *fell asleep*) vinha **contaminado** com *"is falling **behind**"* — que é
outra unidade.

**A causa raiz.** O prompt tinha os três testes lexicográficos da 50ª rodada (substituição,
combinação, antônimo) — e **todos os três decidem se dois sentidos são DIFERENTES, olhando o
português**. Nenhum perguntava, do lado do inglês, **de quem é o sentido**: da palavra sozinha
ou de uma expressão maior. O modelo então acerta ("apaixonar-se" é mesmo um sentido distinto)
e erra de lugar (pendura no item errado). Detalhe que confirma o diagnóstico: o prompt da
**triagem** (raio-X) já mandava *"FIRST identify multi-word units"* — o app já sabia fazer isso
partindo de uma FRASE; só não fazia partindo de uma PALAVRA.

**O critério — três categorias, não duas.** Duas categorias fariam o conserto dividir demais:
1. **Sentido do item** — sobrevive à palavra sozinha (`fall` = cair, diminuir, ruir).
2. **Unidade própria** — precisa de material **fixo**: *fall in love*, *fall short*,
   *fall through*, *fall behind*. → vira item separado.
3. **Padrão com encaixe** — o complemento é uma **classe aberta** (`fall + adjetivo`:
   silent/asleep/ill). → **continua sendo sentido da palavra**, e os 3 exemplos têm de usar
   complementos DIFERENTES dessa classe.
Teste operacional: **apague o resto e veja se o sentido sobrevive.**

**O que foi feito, em camadas** (cada uma independente, barata → cara):
- **Prompt** (`review.js`): bloco "WHOSE SENSE IS IT" com o teste do apagamento, as três
  categorias, o caso `fall`/`fall in love` por extenso e a **regra anti-contaminação** (um
  sentido de tipo (3) nunca pode conter um exemplo de tipo (2)). Cada significado ganhou
  `requires` (o material fixo) e `unit` (a expressão inteira).
- **Detector local** (`unidadeFixaDoSentido`, **core.js** — não-lazy porque o Preparar e a
  varredura usam): prefixo comum das caudas dos exemplos, ancorado no `<b>` (regex de radical
  não acerta verbo irregular — *fell*). Corta genéricas do fim ("in love **with**"), ignora
  determinante sozinho, exige 2+ palavras quando o item **já** é expressão, e não atravessa
  vírgula/ponto. É o "suspensório" do padrão da 49ª: prompt é regra, código é garantia.
- **A ação** (`separarSentido`): o nome passa pelo aluno num `inputModal` — o detector acerta
  muito, mas *fall to the ground* e *fall in love* chegam pelo mesmo caminho e só ele sabe
  qual vale um item. Cria via `createWord` (como o raio-X já fazia), **herda contexto e fonte**,
  e roda a análise completa com **`_seedMeaning`** preservando o sentido dele.
- **Anti-regressão** (`spun_off` no pai): sem isso, "Re-analisar" traria "apaixonar-se" de
  volta — o espelho da lição da 51ª. **Autocura**: se o item filho for apagado, o bloqueio cai.
- **Varredura da base** (`varrerUnidades` + modal): a lição da 50ª é literal — *"cards antigos
  não se corrigem sozinhos"*. Roda o detector sobre `words` inteiro **sem uma chamada de IA**;
  botão só aparece quando há o que separar. Medido: **10,6ms em 401 itens / 1.203 significados**.

**A armadilha que quase entrou.** Remover o significado do array com `splice` era o caminho
óbvio e estava **errado**: `meaningIdx` é **posicional** e está gravado em `srsCards`, na chave
das imagens (`img_wordId_meaningIdx`) e no agrupamento de áudio — tirar o 4º repontaria em
silêncio os cards do 5º em diante. O mecanismo certo **já existia**: `selected:false` (que o
`saveToSrs` respeita) + a marca `moved_to`. Índice preservado, sentido fora da tela.

**Varredura do horizonte — onde mais o sentido movido apareceria** (todos corrigidos):
`dossie.js` (3 pontos: predicado de material, card e busca), `glossario.js` (balão da leitura)
e `audio.js` (o "outros sentidos" que orienta a geração de imagem). E uma quarta, preventiva:
`createWord` ganhou `no_break` — sem ele, criar "fall in love" (3 palavras) dispararia o raio-X
em segundo plano e pagaria uma chamada para desmontar o que acabou de ser montado.

**Verificado ao vivo** (servidor local, sem chave de IA): detector acerta os 8 casos de teste
(inclusive negrito já na expressão, exemplo único, item multi-palavra e fallback sem negrito);
separação preserva o array em 3 e mostra 2; `spun_off` bloqueia a volta e libera ao apagar o
filho; aviso segue `--warning` nos **6 temas**; sem transbordo horizontal em 375px; console
limpo. `CACHE`: `v137` → **`v138`**.

### Sessão 2026-08-07 (91ª rodada, parte C) — A COR QUE NÃO SEGUIA O TEMA

**O pedido**: "sim" — a rodada C, a última das três de design.

**⚠️ A MEDIÇÃO DESMENTIU A PREMISSA QUE A RODADA A TINHA REGISTRADO.** A pendência dizia: "136
`style=` no index.html e ~250 nos JS; cada um é um ponto onde o tema pode não chegar". Classificar
um a um mostrou outra coisa:

| categoria | quantos | veredito |
|---|---|---|
| só layout (`display`, `margin`, `flex`) | 236 | inofensivo, tema não passa por ali |
| já usa `var(--…)` | 157 | **já estava certo** |
| prende uma cor literal | **6** | o defeito |

Mover 397 estilos inocentes para classes seria um diff gigante, arriscado e **sem mudar um
pixel**. A rodada foi reorientada para o que o inline só sintomatizava: **cor que não segue o
tema, onde quer que esteja**. E o grosso estava no CSS — 51 literais fora dos blocos de tema.

**O achado mais concreto, provado antes de mexer.** `.stat-card` tinha
`border:1px solid rgba(255,255,255,0.07)`. Composta sobre o `--surface` de cada tema, a
**distância de cor** era: midnight 22, violet 21, emerald 21 — e **light 0, papel 0**, sepia 4.
Ou seja: **o cartão ficava literalmente sem borda em 2 dos 6 temas**, e quase sem borda no
terceiro. `--border` existe para isso e já vira escuro nos temas claros.

**O que foi corrigido** (tudo verificado nos seis temas depois):

- `.stat-card` → `var(--border)`.
- `.stat-card.orange/.teal/.red .stat-value` → `#e67e22`/`#1abc9c`/`#e74c3c` eram **restos de
  uma paleta antiga que NENHUM tema define** — ficavam iguais nos seis, ao lado de irmãos
  (`.blue`, `.green`, `.yellow`, `.purple`) que já seguiam o tema. Agora `--warning`/`--success`/
  `--error`.
- `.btn-success` e `.btn-danger`: gradiente E hover fixos (`#34D399→#059669`, `#F87171→#DC2626`)
  ignoravam `--success`/`--error` nos seis temas. Agora derivam do token por `color-mix`.
- `.chip.register-slang`, `.image-badge-ok`, `.sdt-learn`, `.srs-rate-btn.again .srb-label` e um
  `#ef4444` que convivia com `color-mix(var(--error))` na MESMA regra.
- `.pl-status.is-recall/.is-reveal`: o texto seguia o tema e o fundo não.
- `.ler-tri-ok:hover{background:var(--success,#1f9d63)}` — fallback que nunca era usado e ainda
  por cima com um verde que não é do projeto.
- Os 6 inline: os chips do `add.js` tinham `rgba(59,130,246,.15)` (o azul do midnight) atrás de
  um `color:var(--primary)` que mudava — o fundo ficava azul no tema roxo. Viraram
  `rgba(var(--primary-rgb),.15)`. Mais `review.js`, `study.js` (onde a nota 1 usava `#F87171`
  enquanto as notas 2, 3 e 4 já usavam tokens) e o aviso de duplicata do `index.html`, que se
  apoiava num **`--warning-bg` que nunca existiu em token nenhum** — o fallback âmbar valia
  sempre.
- **`z-index:500` escrito à mão** no modal de configurações do SRS (único do projeto fora da
  escada). Coincidia com `--z-modal` hoje; no dia em que a escada mudasse, ficaria para trás em
  silêncio. Agora `var(--z-modal)`.

**O que foi deixado fixo DE PROPÓSITO** (e por quê, para não "consertarem" depois):
o botão do Google (`#3c4043` sobre `#fff` — cor de marca, contratual), os véus pretos e a legenda
`#ffd98a` sobre vídeo (ficam sobre imagem, não sobre o tema), os 5 temas próprios do leitor
(`--ler-*`, que é a mesma estrutura de tema, só local) e o `#ll-zoom` (lightbox de fundo escuro
fixo).

**Correção de rota registrada**: `.sb-brand` e `.sb-foot` também tinham borda branca literal na
regra base — mas **já eram vencidas por regras posteriores** que usam `--border`. Foram medidas
no navegador antes e não foram tocadas. Consertar regra morta é ruído no diff.

**Armadilha de medição encontrada**: ao trocar `data-theme` por script e ler
`getComputedStyle` na hora, a borda parecia não mudar em tema nenhum. Não era bug — `.stat-card`
tem `transition` de 0,3s em `border-color`, e eu estava lendo o valor **no meio da animação**.
Com `transition:none` no elemento de teste, os seis temas respondem certo. Fica o aviso: para
conferir tema por script, desligue a transição antes de medir.

**Verificado**: `node --check` nos 3 JS; CSS com 1.714 regras, chaves 1.989/1.989, comentários
430/430; os oito seletores corrigidos medidos **nos seis temas** com transição desligada
(`.stat-card` agora dá `rgba(15,23,42,0.1)` no light e `rgba(40,35,25,0.1)` no papel);
`color-mix` dentro de `linear-gradient` resolvendo; modal do SRS lendo `--z-modal`; console
limpo. **Sobrou 1 cor literal inline no projeto inteiro** — o véu preto do modal, que é
proposital. `sw.js` → `englab-v136`.

### Sessão 2026-08-07 (91ª rodada, parte B) — FOCO DE TECLADO E ALVO DE TOQUE

**O pedido**: "pode fazer" — a rodada B que a parte A tinha deixado registrada na seção 9.

**O diagnóstico da parte A confirmado no código**: em 5.196 linhas havia **dois**
`:focus-visible` (`.seg-tab` e `.sb-signout`) contra **nove** `outline:none`, vários deles sem
nada no lugar. `.asst-search input` desligava o contorno e não colocava substituto nenhum. E o
`index.html` tinha **24 `<input>` e ZERO `<label for=>`**.

**A camada nova fica no FIM de `css/styles.css`**, pela mesma razão que o reskin: vence a
cascata sem editar as regras antigas.

**As três decisões que valem registro:**

1. **`:focus-visible`, não `:focus`.** O navegador só acende o anel para quem chegou de teclado.
   **Quem usa mouse não vê diferença nenhuma** — zero regressão visual no uso normal.
2. **`outline`, não `box-shadow`.** Outline não ocupa espaço (não empurra vizinho), acompanha
   sozinho o `border-radius` do elemento e não é cortado pelo overflow do próprio elemento.
3. **`!important` deliberado.** É a correção da CAUSA, não do sintoma: sem ele, qualquer
   `outline:none` antigo com seletor mais específico apaga o anel em silêncio — que é
   literalmente como o app chegou até aqui. Indicador de foco não pode depender de ordem de
   arquivo para existir.

**⚠️ Erro cometido e corrigido dentro da rodada** (registrado para não voltar): o primeiro
rascunho declarava `border-radius:var(--radius-sm)` dentro do `:focus-visible`. Isso **muda a
forma do elemento enquanto ele está focado** — um avatar redondo viraria quadrado arredondado ao
receber Tab. O outline já segue o raio próprio do elemento; não se declara raio ali. Confirmado
no navegador depois da correção: o elemento focado mantém o raio dele (11px), não um imposto.

**Nome acessível em TODOS os campos.** Os 24 `<label>` do `index.html` ganharam `for=`, e os
campos que não têm rótulo visível (buscas, upload de arquivo, caixa do Assistente) ganharam
`aria-label` — *placeholder não é rótulo*: some quando a pessoa digita e leitor de tela não o
trata como nome.

**A varredura do horizonte achou o mesmo defeito nos campos GERADOS POR JS.** Onde o `index.html`
tinha 24, o JS tinha mais 31 sem rótulo. **13 arquivos corrigidos**: `add.js`, `audio.js`,
`core.js`, `dossie.js`, `known.js`, `lang.js`, `ler.js`, `review.js`, `settings.js`, `study.js`,
`video-podcast.js`, `video-study.js`, `video-subs.js`. Em lista, o rótulo é **específico do item**
(`aria-label="Selecionar ${escA(c.word)}"`) — vinte caixas dizendo "selecionar este card" não
ajudam ninguém. Usa-se `escA` (definida em `core.js`, **não-lazy**, logo disponível em todos).
Achado bom da varredura: **nem tudo estava errado** — o painel de playlist do `audio.js`, os
campos de temporada/episódio do `video-subs.js` e o rádio de faixa do `video-sync.js` já usavam
`<label for>` ou `<label>` envolvente. Só foi tocado o que faltava.

**Alvo de toque de 44px** em `@media (hover:none) and (pointer:coarse)`: `--control-h` 40→44,
`.btn`, `.tab`, `.seg-tab` e os botões só de ícone. **Pelo PONTEIRO, não pela largura de tela** —
tablet com caneta e desktop com toque existem, e quem decide é o dedo. `.btn-sm` para em 40px de
propósito: ele vive em fileiras densas e 44px ali quebraria a linha em duas (registrado na
seção 9 para o dia em que essas fileiras virarem coluna no celular).

**Verificado ao vivo**: `node --check` nos 13 JS (e confirmado que o bash estava lendo os
arquivos certos, não as cópias defasadas do OneDrive); CSS com 1.715 regras, chaves 1.989/1.989,
comentários 426/426; **Tab de verdade no navegador** (não `.focus()` por script, que não dispara
`:focus-visible` e me deu um falso negativo na primeira medição) mostrando
`outline: 2px solid #60A5FA` com offset 2px; **os 34 campos com nome acessível, nenhum sem**;
`--control-h` em 40px no desktop e 44px no toque; sem overflow horizontal em 1280 e em 375;
zero erro no console. `sw.js` → `englab-v135`.

### Sessão 2026-08-07 (91ª rodada) — AS TRÊS ESCADAS DO CSS (espaço, camada, breakpoint)

**O pedido**: "vc tem skills ou plugins específicos de layout, design que poderia passar o olho
no projeto e propor mudanças?" — e, depois do diagnóstico, "sim, pode fazer".

**Resposta honesta sobre ferramenta**: não existe skill de auditoria de design para app
existente. As que há (`artifact-design`, `artifact-diagramming`, `dataviz`, `DesignSync`) servem
para artefatos publicados, gráficos e sincronização com design system — nenhuma revisa este
projeto. A revisão foi feita à mão.

**O diagnóstico.** O CSS **já estava bem tratado onde alguém tratou**: 1.451 usos de `var(--…)`,
só 7 `font-size` em px, escala tipográfica de 10 degraus, `--text3` já corrigido para AA, seis
temas, fontes com `preconnect` e cacheadas no service worker. O problema estava nas três
dimensões que nenhuma rodada tinha tocado:

1. **Espaçamento sem escada** — 244 valores DISTINTOS de `padding`/`gap`/`margin`, com 5, 7, 9,
   11, 13, 15 e 18px convivendo com a escala par. Zero token. É o mesmo defeito que a escala
   tipográfica resolveu (77 tamanhos → 10), na dimensão que ninguém tinha olhado.
2. **Camadas sem escada** — 18 valores de `z-index` inventados um a um: 1, 3, 4, 5, 10, 20, 40,
   60, 400, 500, 600, 620, 900, 999, 4000, 9999, 99999.
3. **Breakpoints sem escada** — 11 valores (400/480/600/640/700/768/860/900/980/1040/1280) em
   20 grafias diferentes (`@media (max-width:768px)` e `@media(max-width:768px)` no mesmo
   arquivo).

**O bug que estava escondido na desordem das camadas.** `.mobile-bottom-nav` tinha `z-index:999`
e `.srs-modal-overlay` tinha `600`. Ou seja: **no celular, todo modal nascia atravessado pela
barra de navegação** — a barra ficava por cima do overlay que deveria cobrir a tela inteira.
Não era um caso raro, era toda vez. Agora chrome do app é `--z-nav` (200) e fica abaixo de
modal, lightbox, toast e tooltip, como manda a ordem real da interface.

**O código morto que MENTIA sobre o app.** Dois blocos separados de `@media(max-width:700px)`
encolhiam a sidebar para o modo "só ícones" — um para `52px` com `padding:12px`, outro para
`60px` com `padding:11px` (medidas diferentes para a mesma coisa, o segundo vencendo em
silêncio). **Nenhum dos dois podia acontecer**: o corte mobile em 768px faz
`.sidebar{display:none}`, e 700 < 768. Quem lesse o arquivo concluiria que existe uma sidebar
de ícones no celular — não existe, ela some. Mesma história com
`@media(max-width:700px){ .sb-today{display:none} }`: o bloco "Hoje" mora dentro da `.sb-nav`,
que já não existe nessa largura. Tudo removido com o porquê registrado no lugar.

**O que passou a existir** (topo de `css/styles.css`, junto dos tokens que já havia):

- `--sp-1: 4px` … `--sp-10: 40px`. Os degraus **não foram inventados**: são os valores que o
  arquivo já mais usava (8px 73×, 6px 52×, 10px 40×, 12px 36×, 4px 25×, 16px 19×), justamente
  para que adotar a escala não redesenhe nada — só tire as sobras de 1px do meio. Ficam fora de
  propósito: 1-3px (borda, deslocamento óptico), o 0, e as medidas calibradas no olho de um
  componente só (barra de legenda do vídeo, tipografia do leitor).
- `--z-sticky` (60) → `--z-panel` (100) → `--z-nav` (200) → `--z-popover` (300) → `--z-hover`
  (400) → `--z-modal` (500) → `--z-modal-pop` (550) → `--z-lightbox` (600) → `--z-pill` (650) →
  `--z-gate` (700) → `--z-toast` (800) → `--z-tooltip` (900). **A ordem antiga foi preservada
  item a item**, com uma exceção deliberada: a navegação inferior, que era o bug.
  Os valores 1-10 soltos que sobraram (9 deles) são empilhamento LOCAL dentro de um card, de uma
  célula do heatmap ou do palco do vídeo — continuam literais porque não competem com nada.
- Os cinco degraus de breakpoint **escritos como contrato em comentário** (CSS não tem variável
  em `@media`): 480 / 640 / **768 = corte mobile** / 1040 / 1280. Consolidações feitas:
  400→480, 600→640, 700→768, 860→768, 900→1040, 980→1040. Cada uma tem o motivo no comentário
  ao lado — a de 860→768 alinha a gaveta do Assistente com o momento em que o app inteiro vira
  mobile; as de 900/980→1040 alinham Biblioteca e Vídeo com o Dashboard, que já colapsava lá.

**Onde os tokens de espaçamento foram aplicados**: na faixa compartilhada (sidebar, layout,
stats, card-box, lista de recentes, chips, quick-add, tabs, forms, botões, upload) **e na camada
de reskin do fim do arquivo**, que é quem de fato vence a cascata. Descoberta da rodada: a faixa
do topo é largamente sobrescrita pelo reskin — tokenizar só o topo teria sido decorativo. 113
usos de `var(--sp-*)` no fim.

**Verificado ao vivo** (servidor próprio na 8766, porque a 8765 estava ocupada): o CSS parseia
inteiro (1.709 regras), **nenhuma `var()` fica sem resolver**, chaves balanceadas (1.979/1.979),
zero erro no console, os tokens resolvem **nos seis temas** (estão em `:root` de propósito, como
as famílias tipográficas: não mudam com o tema), sem overflow horizontal, e a escada de camadas
confirmada no DOM em 375px (nav 200, toast 800, login 700).

**⚠️ Armadilha encontrada na verificação**: o service worker estava servindo `englab-v132` em
cache e o navegador mostrava o CSS VELHO mesmo depois do reload — foi preciso desregistrar o SW
e limpar o cache para ver a mudança. **`CACHE` foi para `englab-v133`.** Toda rodada que mexer
em `css/styles.css` precisa do bump, senão o aparelho do usuário fica com a versão anterior.

### Sessão 2026-08-07 (90ª rodada) — O FLUXO DE 4 ETAPAS NO AR + os ids renomeados

**O pedido**: "continue a entrega em curso do ESTADO e já renomeie os ids também pra ficar tudo
perfeitinho" — e, no meio da rodada, "adicione um filtro e um buscador pra essa nova seção".

**O que foi ligado.** `js/dossie.js` existia desde `aa97a07` e não era carregado por ninguém.
Agora tem seção no `index.html` (`#section-estudar` com `#dossie-area`), entrada no menu do
computador **e do celular**, `_LAZY.estudar`, CSS próprio (`dos-*`) e lugar na lista
network-first do `sw.js` (`CACHE` → `v131`).

**A renomeação, que era a parte perigosa.** Foi um ciclo de três nomes, não uma troca:
`revisar`→`preparar`, `estudar`→`revisar`, e a seção nova ficou com `estudar`. Varridos os ids
(`section-*`, `nav-*`, `showSection()`, `_LAZY`, o `_refreshActiveViews` do **sync** e as regras
`#section-estudar` do CSS) **e também os rótulos e textos** — deixar "vai para o Revisar" numa
tela em que Revisar agora é o SRS seria pior que não renomear. A varredura alcançou
`core.js`, `review.js`, `study.js`, `dashboard.js`, `firebase.js`, `known.js`, `ler.js`,
`glossario.js`, `consulta.js`, `add.js`, `ai.js`, `audio.js`, `video-study.js`, `srs.js`,
`index.html`, `styles.css` **e a extensão** (`kindle.js`, `netflix.js`, `bridge.js`,
`popup.html`) — o botão da Netflix e o do Kindle Cloud Reader diziam "Revisar"/"Estudar".

**O portão ganhou uma verdade só.** Em vez de cada tela marcar o item, quem grava `estudadoEm`
passou a ser o **`saveToSrs()`**. O atalho do Preparar virou "Mandar para a Revisão" (com
tooltip dizendo o que ele pula) e não deixa mais o dossiê mentir. `dossieEstudei()` chama
`saveToSrs` **antes** de considerar feito: se ele recusar (nenhum significado marcado), o item
não fica marcado com base numa gravação que não aconteceu.

**Três coisas achadas olhando além do pedido:**
1. **O dado velho.** Item com `status: 'in_srs'` e sem `estudadoEm` apareceria como pendente —
   centenas deles. `_dossieCosturarLegado()` costura no render e só grava se mudou.
   E o `desfazer` precisou devolver o `status`, senão a costura desfazia o desfazer.
2. **O separador da chave era um caractere de CONTROLE literal no fonte** (invisível, morre em
   copiar/colar). Virou escape `'\u0001'` — e a chave saiu de dentro do `onclick`, onde título
   de livro com aspas ou `&` quebraria o clique.
3. **O rodapé do celular tinha 6 itens e passou a ter 7.** Medido a 375px: o maior rótulo
   ocupa 42px num espaço de 52px. "Biblioteca" virou "Cards" ali (e só ali).

**Busca e filtro** (detalhes na 8.1): barra fixa fora do trecho que se repinta — senão o campo
perde o foco a cada tecla — e filtro **não** persistido, pela lição do filtro de fonte do SRS.

**Verificado ao vivo** (servidor local, dados de teste depois apagados): as 9 seções abrem e
marcam o menu certo, sem erro no console; dossiês agrupados por obra+capítulo; marcar "Estudei"
criou os 3 cards, mudou os dois badges e moveu o item; desfazer preservou os cards e sobreviveu
a um segundo render; a chave com `U+0001` sobreviveu ao recarregamento; busca acha por
capítulo, por significado e sem acento; e o foco não se perde ao digitar.

**Duas correções na mesma rodada, as duas vindas do uso** (detalhes na 8.1):

1. "estou na Preparar e tá dizendo que vai mandar pra Revisão ao invés do Estudar" — o botão
   estava honesto, mas era o **principal**: a tela anunciava o atalho e não mostrava o caminho.
2. "o material que está aqui precisa **sair daqui** e viver só no Estudar e depois no Revisar"
   — e essa derrubou o meu desenho, não só o rótulo. Eu tinha feito o dossiê mostrar tudo que
   tivesse material, então o item vivia nas DUAS telas. Entrou o status **`in_study`**: agora
   "Enviar para o Estudo" tira o item da fila do Preparar, e cada tela é uma fila que esvazia.
   Com volta (`voltarParaPreparar`), porque análise errada não pode virar beco.

3. "essas palavras nesse estágio nunca devem ser enviadas pro Estudo sem antes ser gerado o
   material por IA" — a barra oferecia o envio para itens `pending_ai`. A função recusava (o
   dado nunca correu risco), mas oferecer o impossível já é o erro. A barra passou a mostrar
   só o que cabe: com pendentes, **Analisar** vira a ação principal.

Três lições de método, registradas: **rótulo correto não conserta hierarquia errada** (o que a
tela ensina é o que ela põe em primeiro lugar); **duas telas mostrando o mesmo item é sinal de
que falta um estado**, não de que falta um filtro; e **guarda no dado não dispensa guarda na
tela** — recusar depois do clique é pior que não oferecer. (`CACHE` → `v132` e depois `v133`: sem o
bump, o shell em cache continuava servindo os botões antigos — aconteceu no teste.)

**O que NÃO foi feito e por quê**: os arquivos continuam `review.js`/`study.js`/`dossie.js` —
renomeá-los custaria histórico do git e lista do SW sem ganho real; e a seção não ganhou áudio
nem imagem no dossiê (o material tem os dois) — é rodada própria, com decisão de layout.

### Sessão 2026-08-05 (79ª rodada) — SEÇÃO LER: o leitor de ebooks nativo

**A observação do Djemeson que virou o projeto do avesso**: "o que percebi é que no fim o que
já faço, que é enviar a exportação das marcações, vai continuar tendo que acontecer. Então, ao
invés de tudo isso, eu quero uma seção nativa pra ebooks. Porque o meu ganho no Kindle é ler
sem cansar a vista; já que não tenho isso, faz mais sentido construir um leitor no projeto com
todas as funcionalidades das ferramentas poderosas que estamos criando."

Está certo, e é uma inversão importante de registrar: **a ponte com o Kindle continua útil para
o acervo que já existe lá, mas ela é sempre retroativa**. O leitor nativo é o único jeito de a
palavra virar card no mesmo segundo em que você tropeça nela.

146. **Ler `.epub` sem nenhuma dependência — `js/epub.js` (novo)**. Um EPUB é um ZIP com XHTML
     dentro. As duas peças foram escritas à mão pelo mesmo motivo do `kindle-db.js` (projeto
     sem build não deve baixar 1 MB de JS para abrir um arquivo):
     - **ZIP**: o navegador já descomprime DEFLATE nativamente
       (`DecompressionStream('deflate-raw')`, confirmado no Chrome 148 do Djemeson). Sobrou ler
       o diretório central — ~120 linhas, cobrindo entradas STORED e DEFLATE.
     - **EPUB**: `container.xml` → `.opf` → metadados, manifesto e **spine** (a ordem real de
       leitura). Sumário do `nav` (EPUB 3) **e** do `.ncx` (EPUB 2) — os dois existem no mundo
       real. Capa por `properties="cover-image"`, por `<meta name="cover">` ou por heurística.
     - `.txt`/`.html` entram pelo mesmo trilho: são fatiados em capítulos por cabeçalho
       (`CHAPTER I`, `Capítulo 3`) ou, na falta deles, por tamanho — um `.txt` de 400 KB numa
       página só travaria o navegador na hora de paginar.

147. **Estante e leitor — `js/ler.js` (novo) + seção `Ler` no menu**. O arquivo do livro vai
     para o **IndexedDB** (`BookDB`, em core.js); o que sincroniza é só o que é leve: título,
     autor, sumário, contagem por capítulo, **onde você parou** e os destaques.

148. **Tipografia de descanso — é o motivo de o módulo existir**. 5 temas de papel
     (Papel, Sépia, Cinza, Noite, Preto), tamanho, entrelinha, **medida** (largura da linha) e
     fonte serifada/sem serifa. O HTML do livro entra **sem a folha de estilo do editor**: a
     tipografia é nossa de propósito, senão cada ebook imporia a sua. Dois modos: **virar
     página** (colunas CSS, padrão) e rolagem.

149. **A posição é guardada como FRAÇÃO do capítulo**, nunca como página. Mudar o tamanho da
     letra muda quantas páginas o capítulo tem — guardar "página 12" faria o leitor voltar para
     o lugar errado toda vez que a fonte mudasse. Testado: fechar na página 7 e reabrir volta
     ao mesmo ponto (0,2121 → 0,212).

150. **A captura, que é o ponto de tudo**: **duplo-clique numa palavra** → card no Revisar com
     a **frase inteira do livro**, o título e o capítulo. Selecionar um trecho abre
     **Explicar** (IA, com o livro como contexto), **Estudar** e **ouvir** (voz do navegador,
     custo zero). Palavras que você já está estudando ficam **sublinhadas discretamente** no
     texto — marca de leitura, não caneta marca-texto.

151. **Cobertura e frequência — o que só é possível porque o livro está aqui dentro**. Painel
     com "quanto deste capítulo/livro você já conhece", quantas palavras são novas, **quantas
     voltam mais de uma vez** (essas é que valem o estudo) e a lista das mais frequentes, com
     botão para mandar as 10/25 direto para o Revisar. Cada uma sai com a **primeira frase real
     do capítulo** em que ela aparece — palavra sem frase não ensina nada. Palavras gramaticais
     (`the/of/and`…) e o que já está no vocabulário conhecido ficam fora da conta.

152. **Detalhes que só apareceram testando ao vivo (e o que quebravam)**:
     - **Paginação com largura errada**: a coluna era medida pela viewport e o texto tinha
       outra largura — dava 259 "páginas" num capítulo de 5 parágrafos. Agora a área de rolagem
       é que carrega a medida, e uma coluna = exatamente uma tela.
     - **Deriva de meio pixel**: `clientWidth` é arredondado; somar 646 numa coluna de 646,4
       escorregava meia linha a cada dezena de páginas. Passo agora vem de
       `getBoundingClientRect()` e cada virada é snapada. Testado: 20 páginas, desvio 0.
     - **Corrida no "mandar as 10 mais frequentes"**: ler o texto é assíncrono e o leitor podia
       ter virado o capítulo no meio — os cards saíam carimbados com o capítulo errado. Livro e
       capítulo agora são congelados no início da operação.
     - **Snapshot da nuvem trocando o livro embaixo do leitor**: a posição que este aparelho
       está gravando é mais nova que a que acabou de chegar. O `applyCloudDocs` adota a nuvem e
       devolve por cima o livro que está aberto.
     - Sanitização conferida ao vivo: `<script>`, `<style>`, `onload=` e `id/class` do editor
       não entram; imagens viram `blob:` do próprio zip; link interno vira salto de capítulo.

153. **O leitor no CELULAR (mesma rodada, a pedido do Djemeson)**. Um leitor que não funciona
     no telefone não é um leitor — é onde a leitura de verdade acontece.
     - **Modo imersivo**: o cabeçalho do app e a barra de navegação de baixo somem enquanto se
       lê (126px que viram TEXTO). A saída é o botão "voltar" do próprio leitor, como em
       qualquer e-reader. Como a barra de baixo some, `_activateSection` passou a tirar a
       classe `lendo` ao ir para QUALQUER outra seção — senão bastava um caminho alternativo
       para o app ficar sem navegação.
     - **Altura em `dvh`, não `vh`**: no celular a barra de endereço encolhe e cresce, e `100vh`
       mente — o rodapé do leitor ficava escondido atrás dela.
     - **Virar página com o dedo**: arrastar move a página JUNTO com o dedo (`scrollLeft` segue
       o toque) e solta encaixando na página inteira mais próxima; arrastar 20% já vira.
       Tocar nas bordas (26% de cada lado) também vira. O **miolo fica livre** de propósito:
       é onde se segura para selecionar uma palavra.
     - **Seleção por toque longo**: no celular não existe `mouseup` depois do toque longo, então
       o popup passou a nascer também de `selectionchange` (com debounce), filtrado para
       seleções dentro do texto.
     - **`touch-action:pan-y` + `overscroll-behavior:contain`**: o horizontal é nosso, o vertical
       continua do navegador, e o "puxar para recarregar" para de disparar no meio da leitura.
     - **`resize` que fazia o texto pular**: esconder a barra de endereço dispara `resize` a cada
       rolagem; re-paginar ali era ver o texto saltar na mão. Agora só remedimos quando a
       LARGURA muda (girar a tela) ou a altura muda mais de 120px.
     - **Painéis viram folha de baixo** (sumário, tipografia, ferramentas): sobem do rodapé até
       62% da tela, com alça, perto do polegar — não no topo.
     - **Alvos de toque de 44px** em toda a barra, pílulas e botões do popup; a lixeira da
       estante aparece sozinha (no toque não existe `hover`).
     - **Área segura** (`env(safe-area-inset-*)`) no topo e no rodapé, para o entalhe do iPhone.
     - Validado a 375×812 com toques sintéticos: arrastar curto volta para a mesma página,
       arrastar longo avança/volta uma, arrastar vertical não vira, borda vira, miolo não vira,
       e o scroll cai sempre exato na página. Popup 319×94 inteiro dentro da tela.

154. **Seleção longa não abria o menu (relatado pelo Djemeson no primeiro uso real)**. Ele
     marcou "Morning on the Lady of the Lake Plantation can be a grand experience" — 13
     palavras — e nada aconteceu. Havia um **teto de 12 palavras** no popup, herdado da
     extensão (onde a captura é de palavra solta). Num livro, marcar a frase inteira é o uso
     NORMAL, e a falha era do pior tipo: silenciosa.
     - O teto virou **1200 caracteres** e, quando estoura de verdade (Ctrl+A, arrastar por
       páginas), agora **avisa** em vez de sumir calado.
     - Acima de **4 palavras** o botão muda de "Estudar" para **"Salvar frase"** e o item entra
       como `word:''` + a seleção como contexto — o mesmo formato dos destaques do Kindle, que
       o Raio-X da triagem quebra em palavras/phrasals/expressões no Revisar. Antes, uma frase
       de 13 palavras viraria o TÍTULO de um card.
     - **Onde mais o mesmo defeito existia**: `extension/kindle.js` tinha o teto de 8 palavras /
       200 caracteres no Kindle Cloud Reader — mesma correção aplicada lá, incluindo o botão
       que vira "Salvar frase" e manda o trecho como contexto.

155. **LEXA — a IA ganhou uma pessoa só, e o menu ganhou Wikipédia e web**. Pedido do Djemeson:
     "quero que a personalidade da IA esteja aqui também; ela deve ser uma figura feminina e
     deve se chamar Lexa. Jovial, inteligente, paraense, humorada, mas no tom certo, quase
     imperceptível."
     - **A persona mora em `js/ai.js`** (`lexaSistema()` / `lexaExplicar()`), arquivo não-lazy,
       porque quem explica algo ao aluno está espalhado por CINCO lugares: Assistente, Revisar,
       legenda do vídeo, leitor de ebooks e o service worker da extensão. Havia um **"Lex"**
       (masculino) escrito à mão só no `consulta.js` e quatro cópias de "Tutor de inglês de um
       brasileiro" nos outros — personalidade escrita em cinco lugares vira cinco pessoas.
       Agora é uma função só; o único duplicado inevitável é o da extensão (o service worker
       não enxerga o código do app), e ele está marcado como cópia no comentário.
     - **O truque do prompt** está em "quase imperceptível": o texto gasta mais palavras
       PROIBINDO caricatura do que descrevendo a persona. Se você disser a um modelo barato só
       "paraense e bem-humorada", ele devolve "égua, maninho!" em toda resposta. Então: ser
       paraense é JEITO (acolhedora, sem cerimônia, resolve rápido), nunca vocabulário — com
       lista explícita de expressões proibidas —, humor em "dose homeopática, no máximo uma
       piscadela por resposta, e só quando cabe sozinha", sem emoji, sem se apresentar, sem
       "Claro!" nem "Ótima pergunta".
     - **Só as saídas conversacionais receberam a persona.** Os prompts que produzem JSON
       (análise de card, triagem, tradução em lote) ficaram intactos de propósito: persona em
       prompt estruturado é convite a poluir a saída.
     - **Wikipédia e web no menu de seleção**: segunda fileira do popup, com Ouvir · Wikipédia ·
       Web. É o que a IA NÃO resolve bem — nome de lugar, batalha, arma, marca ou pessoa real
       pede FONTE, não paráfrase — e sai de graça, sem gastar token. A Wikipédia é buscada no
       **idioma do livro** (quem lê em inglês procura "Minie ball", não "bala Minié"). Abre em
       outra aba com `noopener,noreferrer`; a leitura e a posição ficam intactas.
     - **Um risco de deploy apareceu no teste e foi corrigido**: `js/ai.js` é do SHELL
       (cache-first) e `js/ler.js` é lazy (network-first) — numa visita logo depois do deploy o
       leitor novo pode chegar antes da Lexa e estourar `LEXA_NOME is not defined`. Duas
       defesas: o `CACHE` do `sw.js` foi bumpado (v93 → **v94**, o que faz o `activate` apagar
       o cache velho) e o `ler.js` nunca fala direto com o símbolo de lá — usa `lexaNome()` e
       `lexaPrompt()`, com texto de reserva. Vale a regra para o futuro: **símbolo novo num
       arquivo do shell usado por outro arquivo = bump obrigatório do CACHE**.

156. **"Quando volto ao livro não está na posição onde deixei" — e por que era pior do que
     parecia**. Reproduzido com um EPUB de 3 capítulos e imagens: a posição era **gravada
     certa** (`frac: 0,6`) e a reabertura caía na página 0.
     - **Causa**: `lerIrParaCapitulo` posicionava depois de UM `requestAnimationFrame`, mas
       nesse instante as colunas ainda não existiam (`scrollWidth − clientWidth` = 0), então
       `_lerIrParaFrac` calculava um alvo de zero. Duas coisas mudam a paginação DEPOIS do
       `innerHTML`: a fonte serifada (baixada do Google Fonts) e as imagens do livro, que só
       ganham altura quando carregam.
     - **Por que era autodestrutivo**: ao pousar na página 0, o evento de `scroll` disparava e
       gravava o zero POR CIMA do marcador. Uma reabertura apagava o lugar para sempre — não
       dava nem para "voltar na mão". É o tipo de defeito que precisa de trava, não de ajuste.
     - **Correção**: trava `_lerRestaurando` (nada grava posição enquanto o capítulo se monta),
       `_lerEsperarLayout()` esperando `document.fonts.ready` + as imagens (com teto de tempo)
       + dois quadros, remedição com a forma final, uma segunda tentativa se o alvo não pegou,
       e re-posicionamento por até 4 s quando uma imagem preguiçosa chega atrasada e empurra o
       texto. Testado: capítulo 2 / página 7 sobreviveu a fechar, reabrir e recarregar a página.
     - **A outra metade do mesmo problema, no sync**: `applyCloudDocs` adotava a lista da nuvem
       inteira. Um snapshot atrasado (o outro aparelho empurrou antes deste) apagava a leitura
       de hoje. Agora o merge é **por livro, pelo `updatedAt`** — exceção consciente à regra "a
       nuvem substitui", porque o que está em jogo é onde você parou. Exclusão continua
       propagando, e livro importado aqui e ainda não empurrado não some mais da estante.
     - **`visibilitychange`**: fechar a aba ou trocar de app não dispara `lerFechar` — no
       celular é a saída mais comum de todas. Agora a posição e os minutos lidos são gravados
       na hora em que a tela some.

158. **Imagem JUNTO com a explicação da Lexa — e o portão que impede a foto errada**. Pergunta
     do Djemeson: "é possível trazer imagens junto com as explicações da Lexa?". É, e de graça:
     a API da Wikipédia responde a qualquer origem com `origin=*`, sem chave e sem custo — uma
     chamada devolve título, miniatura e resumo em ~0,6s.
     - **A armadilha, encontrada testando antes de construir**: a busca "fuzzy"
       (`generator=search`) parece perfeita e mente com cara de acerto. `seethed` devolve
       **Seether** (banda de rock, com foto); `grand experience` devolve **Grand Theft Auto V**;
       `quills` devolve o filme. Uma imagem errada ao lado de uma explicação certa é PIOR que
       imagem nenhuma, porque o aluno acredita na foto.
     - **A solução é o portão** (`wikiIlustracao()` em `js/ai.js`): busca por **título exato**
       com `redirects=1`, e o resultado ainda precisa passar por três testes — existir, não ser
       página de desambiguação, e o título ter que casar com o termo depois de normalizado
       (sem acento, minúsculo, com prefixo aceito). Assim `Minie ball`→**Minié ball** e
       `ducks`→**Duck** passam, enquanto `seethed`, `quills` e `grand experience` não trazem
       nada. Só palavra ou nome próprio de até 4 palavras — frase não tem verbete.
     - **Em paralelo com a IA, nunca em série**: a Wikipédia responde em ~0,6s e a explicação
       leva alguns segundos. A figura entra assim que chega. No teste (sem chave de IA
       configurada) a imagem apareceu e o texto mostrou o erro da IA — que é exatamente o
       comportamento desejado: uma coisa não derruba a outra.
     - Vale no **leitor** e no **Revisar** (mesma função, mesmo markup `.ll-wiki-fig`, mesmo
       CSS). Falta no vídeo e no Assistente — ver pendências.
     - `CACHE` do `sw.js` bumpado de novo (v94 → **v95**): `ai.js` é do shell e ganhou símbolos
       que `ler.js` e `review.js` passaram a usar.

159. **Lupa na figura** (pedido logo depois: "quero que ao clicar na imagem seja dado zoom").
     - **A miniatura virou o gatilho do zoom** e o link do verbete desceu para o título. Antes a
       imagem levava para fora do app no primeiro clique — mas a mão, ao ver uma foto pequena,
       quer AMPLIAR; "quero ler mais" é o que se procura no título embaixo.
     - **Sem upscale**: a largura vai embutida na URL de thumb do Wikimedia, então dá para pedir
       maior — mas pedir 1280px de uma imagem de 620 devolve borrão esticado. O tamanho é
       `min(1280, largura do arquivo original)`, obtido com `piprop=thumbnail|original`. E
       deriva-se um thumb em vez de usar o `original` porque foto da Commons chega a ter 20 MB.
       Se o Wikimedia não servir aquele tamanho, cai na miniatura (`onerror`), nunca em imagem
       quebrada.
     - **Um ouvinte só, delegado no documento**: o HTML da figura é injetado em popups que
       nascem e morrem o tempo todo (leitor, Revisar) — ligar handler em cada um seria ouvinte
       órfão garantido.
     - **Dois detalhes de convivência**: `preventDefault` no `mousedown` da lupa (senão a
       seleção morria e o popup do leitor fechava atrás dela), e o `Escape` capturado na fase de
       CAPTURA com `stopPropagation`, para fechar a lupa ANTES de o leitor fechar o próprio
       popup. Testado: Esc fecha a lupa e o popup continua vivo.
     - **Armadilha de CSS que apareceu no teste**: `#ler-pop button` tem especificidade de ID
       (1,0,1) e vencia `.ll-wiki-fig .ll-wiki-zoom` (0,2,0) — a foto voltava a ser um botão em
       formato de pílula, com padding, fundo e o cursor errado. Corrigido com seletores de
       mesma força para cada contexto.
     - Validado no desktop e a 375×812: imagem de 1280px nativos exibida a 503×688 (desktop) e
       352×482 (celular), sempre dentro da tela; botão de fechar de 40px respeitando a área
       segura. `CACHE` do `sw.js` → **v96**.

160. **Conversar com a Lexa DENTRO do livro + modo tela cheia**. Pedido: "quero um botão pra
     abrir uma interação com a Lexa dentro do contexto do livro. Por exemplo, em Flags on the
     Bayou eu quero perguntar quem são os invasores do Norte e onde acontece a história".
     - **A regra que decide se presta é a de SPOILER.** Um companheiro de leitura que entrega o
       final não é companheiro. A Lexa recebe em que ponto você está (capítulo + % do livro) e
       tem ordem explícita, em maiúsculas no prompt, de **nunca contar o que vem depois** — se a
       resposta honesta exigir isso, ela diz que aquilo ainda vem e responde só até onde você leu.
     - **Ela fala do que está na SUA tela**, não de um resumo genérico: vai junto um recorte de
       3.000 caracteres em volta do ponto de leitura (janela centrada na fração atual). Mandar o
       capítulo inteiro estouraria tokens à toa; mandar nada faria a resposta ser sobre "o livro
       em geral", que é justamente o que não se quer.
     - **Anti-invenção**: ordem explícita de dizer "não tenho certeza" em vez de inventar fato
       sobre o livro — o modelo conhece muitos títulos, mas não todos, e leitor não tem como
       checar.
     - Quatro perguntas sugeridas prontas (onde/quando se passa, quem é quem, me situa, contexto
       histórico). A conversa **fica salva por livro** (`livro.chat`, últimas 12 mensagens, teto
       de 1.400 caracteres cada) e sincroniza — reabrir o livro devolve a conversa. As últimas
       7 trocas vão como histórico no prompt.
     - **Modo tela cheia** (botão e tecla **F**): Fullscreen API de verdade + classe que esconde
       a barra lateral e recua barra/rodapé para 22% de opacidade (voltam no hover/foco). Sair é
       Esc ou o mesmo botão. **Entrar e sair repagina e volta ao MESMO ponto** — sem isso, sair
       da tela cheia jogava o leitor para longe (testado: página 6 antes, 6 durante, 6 depois).
     - **Detalhe do celular**: o teclado abrindo muda a altura em centenas de pixels e disparava
       repaginação embaixo do dedo. `_lerAoRedimensionar` agora ignora o evento quando o foco
       está num campo de texto. E o `textarea` tem `font-size:16px` — abaixo disso o iOS dá zoom
       sozinho ao focar.
     - A barra passou a ter 4 botões à direita. Conferido a 375px com título de capítulo longo:
       o título encolhe com reticências (115px) e a barra não transborda.
     - `CACHE` do `sw.js` → **v97**.

161. **TRIAGEM na cobertura — "marcar como conhecido" era a metade que faltava da conta**.
     Observação do Djemeson: "só tem a opção de mandar pra revisão. Não seria interessante ter
     opção de marcar como conhecido?".
     - **O buraco era maior do que parecia.** A cobertura é medida contra `knownWords`, mas esse
       mapa só é alimentado pela triagem do Raio-X e por cards maduros do SRS. Com ele quase
       vazio, **o número mente**: no teste apareceram "bright", "cold", "day" e "April" como
       palavras novas, e a única saída era mandar lixo para o Revisar. Sem o caminho de volta,
       o painel media contra o vazio.
     - Cada palavra virou uma peça com **três destinos**: clicar no nome manda para o Revisar
       (não conheço), **✓** marca como conhecida, **×** manda para os ignorados (nome próprio —
       que num romance DOMINA a lista de frequência: Wade, Lufkin, Bayou).
     - **Os números se refazem na hora**, sem recontar o capítulo: já sabemos quantas vezes cada
       palavra aparece, então "conheço" soma às conhecidas e "ignorar" tira do total dos dois
       lados (nome próprio não é vocabulário a aprender nem vocabulário que você sabe). Ver a
       cobertura subir a cada clique é o que dá sentido ao trabalho.
     - **Desfazer** para as marcações (não para o envio ao Revisar, que já criou o item lá). O
       desfazer espelha exatamente o que foi feito — no primeiro teste ele devolvia a palavra à
       lista mas esquecia de restaurar o `total` do "ignorar", e a cobertura continuava mentindo.
     - **A meta dos 95%**: "estudando as N mais frequentes daqui, você sai de X% para 95% — o
       patamar em que dá para ler sem travar", com botão para mandar exatamente essas N. Converte
       uma lista solta num alvo com fim.
     - **O que isso destrava além do painel**: o que você marca aqui é o MESMO vocabulário que
       mede série, podcast e os outros livros. Uma triagem de dois minutos antes do capítulo
       melhora toda medição futura do app — e é o que faz a ideia de "cobertura na capa da
       estante" (roteiro, item 2) passar a valer alguma coisa.
     - **Bug latente encontrado ao escrever**: os chips usavam `onclick="lerMandarUma('${w}')"`.
       Palavra com apóstrofo (`don't`, `father's`) quebrava o handler, porque o HTML decodifica
       `&#39;` ANTES de o JS ler e a string fechava no meio. Trocado por delegação com `data-w`
       — o texto nunca passa pelo parser de JS. Testado com `father's`.
     - Alvo de toque da triagem subiu de 31px para 37px no celular: é ação repetida dezenas de
       vezes seguidas. `CACHE` do `sw.js` → **v98**.

162. **A posição AINDA se perdia — TRÊS bugs diferentes, um deles autodestrutivo**. Relato:
     "voltar pra seção onde eu estava lendo ainda está com problema, tanto ao ir pra outra aba e
     voltar quanto recarregando a página" (+ "verifique não só o modo virar página, mas o
     rolagem também"). A 156ª rodada consertou a restauração; faltavam os caminhos de SAÍDA.
     - **(1) A gravação media com a viewport de tamanho ZERO.** `_lerSalvarPos` tirava a medida
       DENTRO do debounce de 1,5s. Ao trocar de seção, o timer disparava com `#section-ler` já
       em `display:none` — `scrollWidth − clientWidth` = 0, `frac` = 0, e o marcador bom era
       sobrescrito. Reproduzido: `frac 0,533` virava `frac 0`. É o mesmo motivo do "recarregar
       não funciona": o reload apenas lia o zero que a saída já tinha gravado.
       **Correção**: a medida é congelada NA HORA da rolagem (layout válido) e o debounce só
       persiste; mais o guard `_lerMedivel()` (`offsetParent` + largura > 40) barrando qualquer
       medida fora da tela. E o pendente pode ser descarregado a qualquer momento sem risco.
     - **(2) Voltar para a seção deixava a PÁGINA EM BRANCO.** `renderLerSection` chamava
       `renderLeitor()`, que só reconstrói a moldura — ninguém recarregava o capítulo. Voltava a
       barra, o rodapé e nada de texto. Agora a volta recarrega o capítulo no ponto salvo.
     - **(3) Só no modo ROLAGEM**: a viewport tem `scroll-behavior:smooth`, então restaurar
       virava uma animação de ~300ms e cada quadro dela disparava `scroll`, gravando posições
       intermediárias por cima da boa. Agora a restauração usa `scrollTo({behavior:'instant'})`,
       que vence o CSS **sem alterar o elemento** — a primeira tentativa trocava
       `style.scrollBehavior` e devolvia num `requestAnimationFrame` que não roda com a aba em
       segundo plano, deixando o `auto` grudado para sempre.
     - **De quebra**: o texto fica invisível enquanto o capítulo se monta e procura o ponto
       (`.ler-montando`). Antes via-se a página 0 e um salto — parecia que o leitor tinha
       perdido o lugar sozinho.
     - Validado nos QUATRO cenários: virar-página e rolagem × trocar de seção e recarregar a
       página. Página 8, `top` 9360, `top` 9360 e página 11 — todos de volta no ponto exato.
       `CACHE` do `sw.js` → **v99**.

163. **Qualidade da IA: glosa fora de contexto + tradução da frase no Revisar**. Dois casos
     reais trazidos pelo Djemeson, com o pedido de calibrar para **modelo barato (DeepSeek)**.
     - **Caso 1 — "does"** em "The boat ride does add time to the trip" foi analisado como
       "fazer, executar", com exemplos "She does the laundry every Saturday". Ali `does` é
       **auxiliar enfático**, não o verbo lexical. **Causa**: o prompt de análise não tinha
       NENHUMA regra para palavra que está funcionando como GRAMÁTICA — e modelo barato vai
       direto no primeiro sentido do dicionário. Entrou um bloco **GRAMMAR BEFORE DICTIONARY**,
       antes de todas as outras regras: se a palavra é auxiliar (do/does/did, have/has, modal,
       "be" de progressivo/passiva), marcador de infinitivo, complementizador ou "it/there"
       vazio, o PRIMEIRO significado descreve a FUNÇÃO gramatical e leva o `context_match` — o
       sentido lexical pode vir depois, com `context_match: false`. Com o caso do "does" escrito
       como exemplo CONTRASTIVO (o errado e o certo lado a lado), que é a técnica que funciona
       com modelo fraco.
     - **Caso 2 — "tire of"** glosado como "perder o interesse em" enquanto a Lexa explicava
       "cansar-se". **Causa**: a triagem pedia "o significado AQUI" mas não tinha como VERIFICAR.
       Entrou o **teste de substituição**: devolva a glosa para dentro da frase em português; se
       a frase parar de dizer o que o inglês diz, a glosa está errada ("começamos a perder o
       interesse na lama" ≠ "começamos a nos cansar da lama"). Mais a regra de **forma de
       citação** na glosa ("began" → "começar", nunca "começamos") e o descarte de palavras A1
       óbvias, que só faziam ruído na triagem.
     - **Caso 3 (visto no print, mesma família) — "the mud" como COLOCAÇÃO**. Determinante +
       substantivo é gramática, não vocabulário. Como a regra no prompt já não segurava o
       "adjetivo+substantivo" sozinha, aqui entrou **cinto e suspensório** (padrão da 56ª
       rodada): regra no prompt E filtro no código — determinante sozinho é descartado e o par
       encolhe para o substantivo ("the mud" → "mud", "that day" → "day"), enquanto
       "heavy rain" e "make a difference" passam intactos. A mesma proibição foi para o prompt
       do lote da aba Kindle (`add.js`), que tem a mesma natureza.
     - **Tradução da frase no Revisar** (pedido junto): a frase capturada chegava sem tradução.
       Duas descobertas: (a) `createWord` **descartava o `context_pt`** — o Kindle e a Mídia já
       mandavam a tradução e ela morria no caminho; (b) não havia onde exibi-la. Agora o card
       mostra a tradução logo abaixo da citação (discreta, some quando não existe) e ela é
       preenchida **sem chamada extra**: vem como um campo a mais na resposta da triagem
       (`trad`) e na da análise (`context_pt`), com a exigência explícita de CONCORDAR com as
       glosas/o sentido marcado — mesma leitura, mesma resposta, em vez de duas chamadas que
       podem se contradizer.
     - ⚠️ **O que NÃO foi verificado**: as mudanças de prompt não puderam ser testadas aqui (o
       ambiente de teste não tem chave de IA). Foram validados por código o filtro de
       determinante, a preservação do `context_pt` e a exibição da tradução. **Os dois casos
       reais precisam ser refeitos no app com o DeepSeek** — ver pendências.
     - `CACHE` do `sw.js` → **v100**.

164. **"Mandei reanalisar e veio a mesma coisa" — o culpado NÃO era o prompt**. O Djemeson
     refez a análise do `does` e o card voltou igual. A investigação achou o verdadeiro
     bloqueio, em `applyAiResult`:
     ```js
     if (!match && nm.context_match) match = curated.find(om => om.context_match)
     ```
     O merge de preservação (regra pedida em 2026-07-05: "não sobrescrever o que já tem
     exemplos") casava significados **só por os dois serem "o do contexto"** — sem olhar se
     falavam da mesma coisa. Ou seja: a IA podia ter ACERTADO o auxiliar enfático e a
     preservação colava "fazer, executar" por cima. **A correção era descartada pelo próprio
     mecanismo que deveria proteger a curadoria.** Três consertos:
     - O casamento por contexto agora exige **mesma natureza**: significado de função
       gramatical não se funde com sentido lexical (campo novo `gramatical` em cada meaning).
     - **"Refazer do zero"** ao lado de "Re-analisar": descarta os significados atuais e pede
       análise nova, com confirmação. É a saída para "a IA errou o card inteiro" — antes o único
       botão preservava justamente o erro. Os dois botões ganharam `data-tip` explicando a
       diferença, que não era óbvia.
     - O bloco **GRAMMAR BEFORE DICTIONARY** subiu para logo depois da frase de contexto: estava
       enterrado no meio de um prompt enorme, e modelo barato pesa o início e o schema.
     - **`gramatical` é lido com tolerância** (`true`, `"true"`, `1`, `"sim"`): pergunta do
       Djemeson — "tem certeza que o DeepSeek lê esses JSON?". Lê: o que ele não suporta é o
       PARÂMETRO `response_format: json_object`, e `ai.js` já nem tenta usá-lo com DeepSeek
       (conserto da 49ª rodada) — o JSON vem por texto livre com parser tolerante. Justamente
       por isso booleano pode voltar como string, e `=== true` descartaria a resposta certa.
       Pela mesma razão a descrição do campo no schema foi encurtada: descrição longa dentro do
       JSON é convite a o modelo devolvê-la como valor.

165. **"tip of its barrel" traduzido como "barril"** (mesmo lote): em "a bayonet mounted on the
     tip of its barrel", `barrel` é o **cano do fuzil**. O card veio "extremidade do barril" —
     e os próprios exemplos que a IA gerou falavam de atirador e armas de fogo. Entrou o bloco
     **DOMAIN CHECK**, logo abaixo do GRAMMAR: decida o QUE a coisa é na frase e escolha a
     palavra portuguesa para AQUILO, nunca o equivalente mais frequente do dicionário; proibido
     hedge entre dois domínios ("usado em armas ou recipientes"); e uma auto-checagem que casa
     exatamente com o erro observado — "se os seus 3 exemplos descrevem um domínio e o seu
     português usa palavra de outro, a tradução está errada". A mesma regra foi para a triagem.

166. **`<b>` cru na tela** (bug introduzido na 163ª): a tradução da frase vinha com o negrito da
     IA e era escapada inteira, então o leitor via `<b>adiciona</b>` literal. Agora o texto é
     escapado e SÓ o `<b>` volta a valer como marcação (mais `**markdown**`, que modelo barato
     usa às vezes). `<script>` continua escapado — conferido no teste. `CACHE` → **v101**.

173. **IMAGENS: "tem umas que não estão sendo geradas" — TRÊS causas, e a pior mentia
     (2026-08-06)**. Sem print, a investigação foi por leitura de código + doc oficial.
     - **(1) O lote contava falha como sucesso.** Em `browserGenerateImagesSelected`:
       `const r = await generateCardImage(...); if (r === 'skip') pulados++; else feitos++`.
       Mas `generateCardImage` **capturava o próprio erro** e devolvia `undefined` — que caía
       em `feitos`. Gerar 10 com 3 falhas dizia **"10 geradas"**, e os toasts de erro
       individuais se atropelavam e sumiam. Era isto que fazia parecer que a imagem
       "simplesmente não aparecia". Agora `generateCardImage` devolve `'ok'` ou
       `{erro, word}`, o resumo conta a verdade, e um modal lista **quais palavras** falharam
       e **por quê** (as 8 primeiras; o resto no console).
     - **(2) O parser não conhecia o formato da rota nova.** A doc oficial mostra que a
       `/v1beta/interactions` responde com um array **`steps`**, cada passo com blocos de
       conteúdo. O `_aiGeminiImgDaResposta` procurava em `candidates`, `output_image` e
       `output` — **`steps` nunca**. Ou seja: a chamada dava 200, a imagem vinha, e o app não
       sabia onde procurar. Adicionado (`steps[].content[]` e `steps[].blocks[]`), com os
       formatos antigos mantidos.
     - **(3) Recusa de segurança não era explicada.** Vocabulário de romance de guerra
       (arma, sangue, morte…) faz o Gemini recusar a cena — e o app dizia só "a resposta não
       trouxe imagem". Nasceu `_aiGeminiMotivoSemImagem`, que lê `promptFeedback.blockReason`
       e `candidates[0].finishReason` e traduz: SAFETY, IMAGE_SAFETY, PROHIBITED_CONTENT,
       BLOCKLIST, RECITATION. E, sobretudo, **separa recusa de formato desconhecido**: recusa
       para na hora (repetir daria a mesma recusa e cobraria de novo); formato desconhecido
       loga a forma da resposta e tenta a outra rota, porque aí o erro é nosso.
       ⚠️ Isto CORRIGE o excesso da 172ª rodada, em que eu tinha trocado a queda para a
       segunda rota por um `throw` seco — com o parser incompleto, aquilo podia ter deixado
       imagens legítimas sem gerar.
     - **Dois acertos de contrato com a API**: `responseModalities` passou de `['Image']` para
       **`['IMAGE']`** (é enum — a forma errada podia passar hoje e virar 400 amanhã), e a
       rota `/interactions` agora manda **`image_size: '1K'` explícito**, porque no
       `3.1-flash-image` o preço sobe com o tamanho (0,067 → 0,101 em 2K → 0,151 em 4K) e um
       padrão maior do Google viraria fatura maior sem ninguém escolher.
     - Validado com respostas sintéticas nos formatos reais: as 4 formas de resposta são
       reconhecidas, SAFETY/IMAGE_SAFETY/PROHIBITED_CONTENT viram recusa explicada, `STOP` não
       é tratado como recusa, e a contagem do lote passou de "4 geradas" para
       "2 geradas · 1 já existia · 2 falharam". `CACHE` → **v108**.

202. **O CURSOR PISCAVA: consertar depois é diferente de impedir
     (106ª rodada, 2026-08-06)**. Terceira volta no mesmo sintoma, e cada uma errou por um
     motivo diferente — vale registrar a escada inteira, porque é um caso-escola:
       · **1ª** (104ª rodada): consertava só ao MOVER o mouse. A Netflix esconde por
         ociosidade, quando ele está parado — gatilho errado.
       · **2ª** (105ª rodada): passou a vigiar de 400 em 400ms, mas **devolvendo** o cursor
         depois de ela o esconder. Ela esconde, nós devolvemos, ela esconde de novo: **piscava**
         a cada ciclo. Diminuir o intervalo só encurtaria o piscar, não o eliminaria.
       · **3ª (esta)**: parar de consertar e passar a **vencer**. Um atributo marcador
         (`data-ll-cursor`) e uma folha injetada com `cursor: auto !important`. A Netflix pode
         tirar e pôr a classe dela quantas vezes quiser — a nossa regra ganha sempre, e não há
         momento nenhum em que o cursor fique escondido.
     - **Marca os ANCESTRAIS, não só o elemento sob o ponteiro**: ela declara o `none` num
       container, não na folha da árvore. Marcar só o elemento resolvia até ela trocar de
       classe. Sobe até 12 níveis marcando quem esconde.
     - **Por que marcar ancestral é seguro**: `cursor: auto !important` num pai **não impede**
       um filho de declarar o próprio cursor — o `!important` só decide o valor DAQUELE
       elemento. Testado: um botão com `cursor: pointer` dentro da área marcada continua
       `pointer`.
     - Verificado com a Netflix tirando e pondo a classe 5 vezes seguidas: **0 de 5 ciclos com
       o cursor sumido**. `manifest.json` → **3.11.0**.

201. **O CURSOR SUMIA DE NOVO: reagir não bastava, era preciso VIGIAR
     (105ª rodada, 2026-08-06)**.
     - **Por que a correção anterior era incompleta**: ela rodava dentro de
       `_engolirMovimento`, ou seja, **só ao mover o mouse**. Mas a Netflix esconde o ponteiro
       por **tempo de ociosidade** — exatamente quando ele está PARADO e não há evento nenhum
       para reagirmos. Corrigi o gatilho errado.
     - **E o cache piorava**: eu guardava "já arrumei este elemento" e saía cedo. Quando ela
       reaplicava o `cursor: none`, a checagem seguinte desistia no mesmo elemento e o ponteiro
       ficava sumido de vez. Agora a decisão é sempre pelo valor **computado**, e só há escrita
       quando ele está de fato `none` — repetir a checagem não custa nada.
     - **A vigia**: `setInterval` de 400ms, ativo só com a barra ligada no modo flutuante. Um
       `elementFromPoint` e um `getComputedStyle` por ciclo. A última posição do ponteiro fica
       guardada, então a vigia funciona **sem** movimento novo.
     - Verificado: arruma na primeira vez; **arruma de novo depois de a Netflix reaplicar, sem
       nenhum movimento**; arruma numa terceira; lembra a posição; e não toca em elemento que
       já tem cursor válido. `manifest.json` → **3.10.2**.

200. **O CURSOR SUMIU — efeito colateral direto da supressão (104ª rodada, 2026-08-06)**.
     - **Causa**: a Netflix esconde o ponteiro junto com o painel quando conclui que o usuário
       parou de mexer. Como passamos a **engolir** o movimento, para ela ele parou **para
       sempre** — e o cursor nunca voltava. Não é bug da supressão: é a consequência lógica
       dela, e eu devia ter previsto ao escrever a rodada anterior.
     - **Conserto sem depender de classe**, pelo mesmo motivo de sempre: `elementFromPoint` no
       ponto do cursor e, se o `cursor` computado ali for `none`, devolve `auto` por `style`
       inline. Como `cursor` é **herdado**, mandar no elemento sob o ponteiro basta — não é
       preciso descobrir em qual container da Netflix o `none` foi declarado.
     - **Cacheado por elemento**: `elementFromPoint` + `getComputedStyle` a cada pixel de
       movimento seria caro, e o alvo muda pouco enquanto se assiste.
     - Verificado: filho herdando `cursor:none` volta a `auto` depois de um movimento engolido,
       e um elemento que já tem cursor válido (`pointer`, nas palavras da legenda) **não é
       tocado**. `manifest.json` → **3.10.1**.

199. **CONTROLES DA NETFLIX SÓ PERTO DO RODAPÉ (103ª rodada, 2026-08-06)**.
     Pedido: *"quando se move o mouse o painel aparece, mas o Reactor desabilitou isso — só
     aparece quando o mouse passa em cima da barra de progresso. Quero isso."*
     - **Isto fecha o mistério do "painel menor" das rodadas 99–101**: o Language Reactor não
       encolhe o painel — ele **suprime a abertura automática**. O painel só sobe quando o
       ponteiro desce até ele, então na maior parte do tempo simplesmente não existe.
     - **Por evento, não por CSS**, e a diferença importa: esconder o painel exigiria o nome da
       classe do container da Netflix — que eu tentei três vezes e não casou, e que muda sem
       aviso. Interceptar `mousemove`/`pointermove` na **fase de captura** do `document` (antes
       de a Netflix ver) e `stopPropagation()` quando o ponteiro está longe do rodapé **não
       depende de nome nenhum**. É a razão de esta tentativa ter chance onde a outra falhou.
     - **Zona de 140px** a partir do rodapé: dentro dela o evento passa e a Netflix abre o
       painel normalmente.
     - **Três travas de escopo**: só com a barra ligada, só no modo flutuante (na doca o player
       já é redimensionado e o painel não atrapalha), e **nunca** engole o que tem alvo dentro
       de `#englab-bar`, `#englab-pop` ou `#englab-transcript` — nossa própria UI depende de
       mousemove para seleção, hover e arrastar.
     - Verificado: engolido no meio da tela e no topo; passa no rodapé e na borda da zona;
       engolido logo acima dela; **passa sobre uma palavra da nossa barra**; e não interfere na
       doca nem com a extensão desligada.
     - ⚠️ Duas medições do meu teste estavam erradas antes de acertar: contei eventos num
       listener do *player* para julgar um clique na *nossa barra* — que não é descendente
       dele, então o contador ficaria zerado de qualquer jeito. Medir `stopPropagation` exige
       observar um **ancestral do alvo**. `manifest.json` → **3.10.0**.

198. **INTERRUPTOR NA POPUP DA EXTENSÃO (102ª rodada, 2026-08-06)**.
     - O botão **"Religar a barra na Netflix"** só servia DEPOIS de ela já ter sumido, e não
       dizia o estado atual — não havia como saber se estava ligada, nem como desligar dali
       (só pelo botão dentro da própria barra). Virou **switch**, que mostra E muda.
     - **A fonte da verdade é a mesma dos dois lados**: `llui.ligada` no `chrome.storage.local`,
       o objeto que o content script já lia e gravava. Assim popup e barra nunca discordam —
       esconder pelo botão da barra reflete no switch, e vice-versa. O switch grava com
       *spread* do objeto existente para não apagar as outras preferências (`doca`, `pt`,
       `fog`…).
     - **O content script ganhou o ramo `englab-desligar`**: ele só sabia RELIGAR, então um
       interruptor de dois estados não teria como desligar nada.
     - O rótulo diz o estado real e distingue os casos: *"aparecendo sobre o vídeo"*,
       *"escondida"* e *"ligada — abra a Netflix para ver"* quando não há aba da Netflix aberta.
     - ⚠️ **Não verifiquei o visual do switch.** A maquete roda DENTRO da página do app, com a
       folha de estilo dele competindo, e o `:checked` não pintou ali — o popup é documento
       isolado, então o resultado do teste não vale para ele. O CSS é o padrão
       `input:checked + span`, conferido no arquivo. **Confirmar abrindo a popup.**
       `manifest.json` → **3.9.0**.

197. **A LEGENDA PAROU DE SEGUIR OS CONTROLES (101ª rodada, 2026-08-06)**.
     - **Efeito colateral do conserto anterior**: passei a medir o topo dos controles A CADA
       QUADRO, e eles aparecem e somem conforme o mouse. A legenda passou a subir e descer
       junto — o MESMO defeito do salto `9% ↔ 22%`, por outro caminho. Agora a função guarda o
       ponto **mais alto** já medido (controles à mostra) e fica nele: sai da frente da barra
       de progresso quando ela aparece e **não se mexe** quando ela some. Zerado ao trocar de
       título, porque o player pode ter outra altura.
     - Verificado nos 4 estados — controles visíveis, sumidos, de volta e menores: **130px nos
       quatro**. E ao simular outro vídeo com player mais alto, recalcula (210px).
     - **A compressão do painel da Netflix foi REMOVIDA**, não corrigida. Os seletores tentados
       não casaram com o DOM atual e a regra não fazia nada. Mantê-la seria código morto
       fingindo que funciona — pior que ausência, porque esconde o problema real. Virou
       pendência com o que falta para refazer: o nome da classe, pego no inspetor.
       `manifest.json` → **3.8.0**.

196. **PAREI DE DEPENDER DE CSS: a posição do flutuante passou a ser MEDIDA
     (100ª rodada, 2026-08-06)**. Ele voltou dizendo que a régua continuava aparecendo e que o
     painel não encolheu — e o CSS estava correto e bem formado nos dois casos, conferido no
     arquivo. **Terceira vez na sessão que algo confere no meu teste e não vale na tela dele.**
     - **A decisão**: quando uma regra visual depende de (a) vencer especificidade numa folha
       grande e (b) acertar o nome de uma classe da NETFLIX, ela tem duas chances de falhar em
       silêncio. Os dois problemas foram para o JS, onde são verificáveis:
       · a **régua** some por `style` inline no flutuante — nenhuma folha sobrescreve isso, e
         ela volta sozinha ao entrar na doca;
       · a **posição** é ancorada 10px acima do **topo real dos controles**, medido com
         `getBoundingClientRect` numa lista de seletores conhecidos. Renomeou classe? A lista
         não casa, a função devolve o controle ao CSS e a legenda fica só um pouco mais alta.
     - Filtro contra falso positivo: o seletor só vale se o elemento tiver altura > 8px **e**
       estiver na metade de baixo da tela — alguns desses seletores também casam com
       contêineres que ocupam a página inteira.
     - ⚠️ **Bug que o teste pegou**: eu usava `null` para dois significados — "ainda não
       calculei" e "calculei e não achei painel". Depois de um reset, `alvo === _ultimoFundo`
       dava `null === null` e a função saía cedo, deixando o valor velho grudado no `style`.
       Agora `undefined` é "não calculei" e `null` é "não achei". Verificado nos 4 estados:
       painel normal (130px), painel maior (190px, a barra sobe junto), **sem painel** (devolve
       ao CSS) e doca (limpa o `style` e a régua volta). `manifest.json` → **3.7.1**.

195. **COMPRIMIR O PAINEL DA NETFLIX, COMO O LANGUAGE REACTOR FAZ (99ª rodada, 2026-08-06)**.
     Ele mandou duas capturas **do Language Reactor** (ligado e desligado) — a referência, não
     um defeito nosso — e pediu "exatamente igual ao Reactor ativado".
     - **O que as capturas mostram, medido**: com o LR ativo a barra de progresso da Netflix
       fica a **~87px** do chão; sem ele, a **~110px**. O LR **encolhe o painel inferior da
       Netflix**, e é isso que libera a legenda dele para descer. Era o "painel menor".
     - **Por que a nossa não descia**: o texto já estava a 114px do chão, a 4px da barra de
       progresso no tamanho normal. Descer mais **cobriria** a barra — exatamente o que ele
       não queria. Sem comprimir o painel, não havia para onde ir.
     - **Implementado**: classe `englab-flut-on` no `<html>` (o painel da Netflix é IRMÃO da
       nossa barra, não filho — não dá para alcançá-lo de dentro dela), que zera o
       `padding-bottom` do container de controles. Com ele comprimido, o piso da legenda cai de
       104 para **84px** e o respiro interno da barra de 12 para 4px.
     - **Falha benigna por desenho**: os seletores do container são da NETFLIX. Se ela
       renomear as classes, a regra deixa de casar e o painel volta ao tamanho normal — a
       legenda fica só um pouco mais alta e **nunca** cobre a barra, porque a altura tem piso
       próprio. Nada de `!important` justamente para não brigar com o layout deles.
     - ⚠️ **Meu teste mentiu por 220ms**: a primeira medição acusou "ganho de 1px" porque
       `#englab-bar` tem `transition: bottom .22s` e eu medi 100ms depois de trocar a classe —
       no meio da animação. O valor final era 90px, não 110. E o achado colateral: com a
       posição agora fixa, essa transição não serve mais para nada e só pode produzir deslize
       na entrada — **removida** no flutuante. Regra prática: medir propriedade animada só
       depois da transição, ou desligá-la no teste. `manifest.json` → **3.6.0**.

194. **TRÊS DEFEITOS DO FLUTUANTE, DOIS DELES MEUS (98ª rodada, 2026-08-06)**.
     - **Mais perto da barra de progresso**: de `18%` para `max(104px, 11vh)`. Em px com piso,
       não em porcentagem: os controles da Netflix têm altura praticamente FIXA, então uma
       porcentagem afasta demais em tela alta e encosta demais em tela baixa. O piso de 104px
       livra a barra de progresso e a fileira de botões.
     - **⚠️ A CAIXINHA ESCURA VAZIA e a TRADUÇÃO CONGELADA tinham a MESMA causa, e era minha**:
       a regra `#englab-bar.englab-flut .englab-pt` da 97ª rodada não estava qualificada com
       `.englab-tem-pt`. Ela dava `display` ao português **sempre**, ignorando o interruptor da
       tradução. Daí (a) com PT ligado e sem tradução aparecia o fundo e o padding sem texto —
       uma caixinha escura sem sentido; e (b) desligar o PT deixava a última tradução parada na
       tela. Uma qualificação faltando, dois sintomas que pareciam problemas distintos.
     - **Cinto e suspensório no JS**: `pintarPT` passou a **esvaziar** o elemento ao desligar,
       em vez de confiar que o CSS o esconde. Basta uma regra de modo esquecer a qualificação
       para o texto voltar a congelar; limpar o conteúdo torna isso impossível.
     - **A régua de falas saiu do flutuante** (`display: none`). Ela é ferramenta de navegação
       e pertence à doca; sobre a cena era ruído — e estava em `opacity: 0` esperando um hover
       que ninguém dá enquanto assiste.
     - Verificado no flutuante: altura 110px do chão numa viewport de 1000px, régua escondida,
       caixa presente com tradução, **sumindo por completo sem tradução**, e **sumindo ao
       desligar o PT**. A caixa continua abraçando o texto (404px em 1284px disponíveis) —
       o abraço vem do `align-items:center` do flex, não do `inline-block`, então o
       `display:block` que a cascata resolve ali é inócuo. `manifest.json` → **3.5.0**.
     - 📖 **Nome da peça**, que ele perguntou: **régua de falas** — cada bloco é uma fala, o vão
       entre eles é silêncio, e clicar leva até lá.

193. **O FLUTUANTE: parou de pular e ganhou o desenho de legenda de verdade
     (97ª rodada, 2026-08-06)**. Pedido com duas imagens — a nossa e a referência
     (Language Reactor), *"exceto as cores"*.
     - **Parou de subir e descer.** O salto `bottom: 9% ↔ 22%` existia para sair da frente da
       barra de progresso quando os controles aparecem. Mas legenda que muda de lugar a cada
       movimento do mouse é pior de acompanhar do que legenda um pouco mais alta — foi o que
       ele pediu explicitamente. Agora é **fixa em 18%**, altura que já livra a barra de
       progresso E a fileira de controles, e a regra de subida é anulada no flutuante.
     - **⚠️ AS CAIXAS LARGAS ERAM CULPA MINHA, da 95ª rodada.** O `inline-block` que faz a
       caixa abraçar o texto sempre esteve lá — mas eu tinha posto
       `display:flex; flex-direction:column` no `.englab-mid`, e **`align-items: stretch` é o
       padrão do flex**, o que estica os filhos para a largura toda e anula o `inline-block`.
       Resultado: duas barras atravessando a tela com o texto perdido no meio. `align-items:
       center` devolveu a largura do conteúdo (medido: 389px de caixa em 1220px disponíveis).
     - **A hierarquia visual, lida da referência**: o inglês **sem caixa**, só texto com sombra
       em camadas (contorno curto e opaco encostado na letra + halo largo que apaga fundo
       claro — o truque da legenda nativa), maior e mais pesado; o português **com caixa justa**,
       menor. Duas caixas empilhadas viram duas barras que competem com a cena; uma só separa
       os papéis — o inglês é a cena, a tradução é o apoio. Cores mantidas (branco/âmbar), como
       ele pediu.
     - Verificado no modo flutuante: fundo do inglês transparente, sombra presente, caixa do
       português presente e justa, inglês não estica, vão de 6px, fontes 27/20, e a posição
       **idêntica com e sem a classe de controles à mostra** (180px nos dois).
     - Lembrete que agora tem precedente: conferir sempre no modo que o relato menciona.
       ⚠️ **Correção do que escrevi aqui antes**: eu disse "três aparências — doca, flutuante e
       a barra normal". **São DUAS.** `aplicarDoca()` é um interruptor binário
       (`barra.classList.toggle('englab-flut', !cfgUI.doca)`), e o estilo base do `#englab-bar`
       não é um modo — é o alicerce que os dois herdam. O Djemeson apontou, e conferir a
       afirmação achou um bug de verdade: o caminho de **religar pela popup** mostrava a barra
       chamando só `aplicarNativa()`, **sem `aplicarDoca()`**, então ela reaparecia sem nenhuma
       das duas classes e caía no estilo base — uma aparência que o usuário nunca escolheu.
       Corrigido. `manifest.json` → **3.4.0**, depois **3.4.1**.

192. **EU ARRUMEI A MODALIDADE ERRADA — o modo DOCA (96ª rodada, 2026-08-06)**.
     Resposta ao ajuste anterior: *"ainda tá longe… as barrinhas você não mexeu, ainda tá
     feio"*. As duas observações estavam **literalmente certas**.
     - **A extensão tem DUAS modalidades com CSS próprio**: a barra flutuante sobre o vídeo e
       a **doca** (`html.englab-dock`), que é uma seção abaixo do vídeo. Ele usa a doca. Toda a
       95ª rodada mexeu só na flutuante — a doca redefine fonte, alturas e régua e **ignorou
       tudo**. Minha maquete de teste também não tinha a classe `englab-dock`, então o teste
       confirmou uma correção que não valia para a tela dele.
     - **A distância na doca tinha TRÊS somas**: `min-height: 2.5em` no `.englab-line` (a
       mesma reserva de duas linhas, duplicada aqui), mais `padding-top: 9px` e a margem do
       `border-top` do fio separador. Agora a reserva foi para o `.englab-mid`
       (`clamp(96px, 8vw, 140px)`), e o fio ficou fino, curto (420px em vez de 560) e colado.
       **Vão medido: 5px** — era a soma acima.
     - **Degrau de tamanho**: 32px no inglês contra 21px no português fazia os olhos saltarem.
       Agora 28 e 23.
     - **⚠️ POR QUE AS PÍLULAS CONTINUAVAM FEIAS, e não era o raio**: a régua da doca tem
       16px de altura, mas `.englab-rtrack` nasce em `top: 8px` — medida da barra flutuante,
       que é mais alta. **Metade de cada pílula ficava fora da régua, cortada.** Estilo novo
       nenhum resolveria isso. A doca ganhou as próprias medidas de pista e pílula.
     - Verificado COM a classe `englab-dock` ativa: vão de 5px, fontes 28/23, régua de 18px, e
       as pílulas (normal e a corrente) **cabendo inteiras** dentro dela — comparação de
       `getBoundingClientRect` da pílula contra a da régua.
     - **Lição**: antes de dar por consertado um ajuste visual desta extensão, reproduzir a
       maquete **nas duas modalidades**. `manifest.json` → **3.3.0**.

191. **A BARRA DA NETFLIX: as duas legendas coladas e a régua em pílulas
     (95ª rodada, 2026-08-06)**. Pedido: *"na tradução, alargue o espaçamento em vez de
     descer… a distância entre a original e a tradução é grande… os pontilhados do tempo de
     fala estão feios"*.
     - **A distância tinha uma CAUSA, não era margem**: `.englab-line` reservava
       **`min-height: 2.7em` SEMPRE** — duas linhas — mesmo exibindo uma só, e a tradução ia
       para o fim daquele espaço vazio. A reserva existia por um bom motivo (o painel não pode
       mudar de tamanho a cada fala), então a solução não foi removê-la e sim **mudá-la de
       lugar**: a altura fixa passou para o `.englab-mid`
       (`min-height: clamp(74px, 6.2vw, 108px)`), e o par fica junto e centralizado dentro
       dela. Vão medido: **2px** (era uma linha inteira).
     - **Largura de 1040 → 1320px** (96vw): a tradução quebrava em duas linhas por falta de
       espaço, e quebrar empurra o texto para baixo — exatamente o oposto do que ele queria.
     - **Degrau de tamanho reduzido**: inglês de 23 → 21px e português de 17 → 18px. Ele
       sugeriu diminuir a original; fazer os dois movimentos aproxima mais sem encolher
       demais a que ele lê primeiro.
     - **A régua**: `border-radius: 3px` numa barra de 6px ainda lê como TRAÇO. Virou pílula
       (`999px`), com degradê leve no lugar do cinza chapado, brilho na fala corrente e o
       cursor do "agora" como cápsula em vez de risco de 2px. O realce cresce a partir do
       centro (top e height juntos), o que tira o pulinho para baixo que havia.
     - Verificado nos três regimes — fala curta, a do print e uma de duas linhas nos dois
       idiomas: a barra mede **184px nos três** (a estabilidade que motivou a reserva está
       preservada), o vão é 2px em todos, e nada é cortado (`scrollHeight` vs `clientHeight`).
       `manifest.json` → **3.2.0**.

190. **A EXTENSÃO NÃO ACOMPANHOU AS DUAS LIÇÕES DE IA DO DIA (94ª rodada, 2026-08-06)**.
     Erro na tela durante o episódio: *"Unsupported parameter: 'max_tokens' is not supported
     with this model. Use 'max_completion_tokens' instead."*
     - **`extension/background.js` fala com a OpenAI POR CONTA PRÓPRIA** — o service worker não
       enxerga `js/ai.js`. Então ele ficou de fora de duas correções feitas horas antes:
       · **84ª rodada** (`_aiTokenParam`): a família `gpt-5`/`o*` rejeita `max_tokens`. Com o
         Luna selecionado, TODA chamada da extensão falhava. E, junto, a folga de 25.000 para
         o raciocínio — sem ela o orçamento some pensando e volta resposta vazia, cobrada.
       · **93ª rodada** (freio de taxa): a extensão **não tinha repetição nenhuma**. Um 429
         virava erro na cara do aluno no meio do episódio. Aquele
         *"[openai] Rate limit reached…"* do print anterior era DAQUI, não do app — o prefixo
         `[openai]` é o formato desta função.
     - Agora ela tem: escolha correta do parâmetro por modelo, folga de raciocínio, repetição
       com o tempo que a própria mensagem da OpenAI informa, freio compartilhado entre chamadas
       e mensagem específica para o caso de o raciocínio esgotar o teto.
     - **A lição de manutenção**: `extension/` é cópia deliberada de partes do app e **não
       recebe conserto por tabela**. Toda mudança em `js/ai.js` que altere o CONTRATO da API
       (parâmetro, retry, orçamento) tem de ser replicada ali no mesmo dia. Já valia para os
       prompts (`promptRegrasLexicais`, 80ª rodada) e agora vale explicitamente para a chamada.
     - ⚠️ **Armadilha de ferramenta, pela SEGUNDA vez na sessão**: o `` da regex virou
       caractere de BACKSPACE literal ao escrever o arquivo por script, exatamente como na 93ª.
       Conferido com contagem de `chr(8)` depois de gravar — passou a ser passo obrigatório.
       `manifest.json` → **3.1.0** (a extensão precisa ser recarregada à mão).

189. **LEGENDA INCOMPLETA NA NETFLIX — o parser de TTML perdia a segunda linha
     (93ª rodada, 2026-08-06)**. Relato com print: a legenda oficial da Netflix mostrava
     *"Well, if you hadn't meddled / to start with,"* e a nossa, embaixo, só a primeira metade.
     - **Onde NÃO estava**: o `parseSubtitle` do app junta as linhas certo
       (`lines.slice(ti+1).join(' ')`), e o `textoDOM()` da extensão junta os
       `.player-timedtext-text-container` certo. Investigar os dois antes evitou consertar o
       arquivo errado — e a informação que virou a chave veio dele: *"está rodando dentro da
       Netflix, com a extensão"*, o que descartou o player do app inteiro.
     - **DOIS bugs no `parseTTML` de `extension/inject.js`**, ambos produzindo "legenda
       incompleta" por caminhos diferentes:
       · o comentário dizia *"`<br/>` vira espaço"* e **não virava**: `p.textContent` concatena
         os nós de texto SEM separador, então "meddled&lt;br/&gt;to start" saía
         **"meddledto start"**. Agora o `<br>` é trocado por espaço antes da leitura.
       · a Netflix às vezes manda **cada linha num `<p>` próprio com o MESMO intervalo de
         tempo**. Viravam duas falas, e a tela mostrava só a primeira — este era o caso do
         print. Falas de tempo idêntico (tolerância 50 ms) passam a ser remontadas numa só.
     - Verificado nos 5 casos: `<br>` na mesma `<p>`; `<p>` separados com mesmo tempo;
       tempos DIFERENTES que **não** podem ser fundidos (são falas distintas); três linhas; e
       tags de estilo que continuam sumindo.
     - ⚠️ Junto foi para o app o botão **"Usar a legenda do próprio arquivo"** no painel Sync
       (`videoUsarFaixaEmbutida`), que lê `player.textTracks`. **Ele NÃO resolve o caso da
       Netflix** — foi escrito antes de eu saber que era a extensão, e serve ao player do app
       com arquivo local que exponha faixa legível. Fica registrado para ninguém achar que é a
       resposta para aquele sintoma.

188. **PILHA ÚNICA DE AVISOS + PROGRESSO EM TUDO QUE GERA (92ª rodada, 2026-08-06)**.
     Duas coisas num pedido: *"qualquer coisa que for gerada tem que ter informação de
     progresso"* (regra permanente) e *"quando mando uma palavra da revisão pro estudo aparecem
     duas informações uma sobre a outra"*.
     - **O bug era literal**: `#toasts` (bottom 24 / right 24) e `#audio-gen-banner`
       (bottom 16 / right 16) eram os DOIS `position:fixed` no mesmo canto, mesmo z-index.
       Salvar para estudo dispara os dois — o toast dos cards e o banner da pré-geração de
       áudio — e eles se sobrepunham. **E havia uma segunda regra, só no celular** (media
       query, linha ~2660), que reintroduzia o `fixed`: consertar só a primeira não resolvia,
       e foi o que o primeiro teste pegou.
     - **Conserto estrutural, não pontual**: existe UMA pilha (`#toasts`) e todo aviso entra
       nela; o flex-column com gap cuida do empilhamento e ninguém mais precisa saber de
       coordenadas. O banner de áudio passou a `position:static` e é movido para dentro da
       pilha no `init.js`. Consertar só o banner adiaria o problema, porque a regra nova do
       projeto garante que vão nascer mais avisos.
     - **API de progresso compartilhada** (core.js), porque uma geração tem três momentos e
       todos precisam aparecer: `progressoAbrir(id,titulo,sub)` · `progressoAtualizar(id,
       feito,total,sub)` · `progressoFechar(id,msg,tipo)`. Mais `progressoItem()` para
       operação de peça única — **sem barra de propósito**: não há fração a mostrar, e barra
       falsa que anda sozinha é pior que spinner honesto.
     - **Aplicado às imagens**: a individual (10–30 s, cujo único sinal era um botão
       desabilitado que some da vista se ele rolar a tela) ganhou aviso próprio; o lote ganhou
       barra com **a palavra da vez** — numa fila de dezenas, saber ONDE está é o que
       diferencia "trabalhando" de "travado" — e fecha com o resumo, sem deixar aviso órfão.
     - Verificado: banner dentro da pilha e `static`; quatro avisos simultâneos com topos
       distintos e **nenhuma sobreposição**; barra em 40% com "2/5" e a palavra no subtítulo;
       fechar remove e vira toast; item único sem barra. `CACHE` → **v129**.

187. **COLUNA "CRIADO" + GERAR IMAGENS SÓ PARA QUEM NÃO TEM (91ª rodada, 2026-08-06)**.
     - **A data sem migração nem campo novo**: `uid()` é `Date.now().toString(36)` + 5
       aleatórios, então **os 8 primeiros caracteres do `id` JÁ SÃO o instante de criação**
       (36⁸ cobre até 2059). `cardCriadoEm()` lê dali e dá ordenação **exata** para todos os
       cards que já existem — sem migrar nada e sem depender de sync. `addedDate` (que sempre
       existiu) é o segundo recurso: tem só granularidade de DIA, e ele quer justamente ver
       "os que chegaram agora". Nova coluna, ordenável, com o texto curto ("hoje", "ontem",
       "5d", "3mes", "2a") e a data completa no `title`. Ordena do mais novo para o mais velho
       no primeiro clique, que é o que ele pediu.
     - **Gerar imagens ignora quem já tem.** O `generateCardImage` já devolvia `'skip'` para
       esses e **não gastava dinheiro** — mas eles entravam na CONTA do modal, que prometia
       "476 imagens" quando a maioria já existia. Agora `refreshImageKeyCache()` roda antes e
       o filtro tira os que já têm; o modal cota só o que falta e a linha de detalhe diz
       quantos ficaram de fora. "Selecionar tudo → Gerar imagens" virou gesto seguro.
     - Verificado: leitura da data em 7 formatos (incluindo id malformado caindo no
       `addedDate` e card sem nada virando "—"); ordenação novos-primeiro; e o filtro de
       imagens em 3 cenários (pula quem tem, deduplica significado repetido, não gera nada
       quando todos já têm). `CACHE` → **v127**.

186. **O SELETOR CONTINUAVA DIZENDO "gpt-image-1" (90ª rodada, 2026-08-06)**. Relato com
     print: a caixa de qualidade já mostrava US$ 0,006 (vem do catálogo), mas a de fornecedor
     insistia em "OpenAI · gpt-image-1".
     - **Causa**: os `<option>` estavam **escritos à mão no index.html**. É a MESMA família do
       `model` hardcoded consertado minutos antes — rótulo que duplica dado do catálogo e
       envelhece em silêncio. Pior: aqui a tela mentia sobre qual modelo seria chamado.
     - **Correção estrutural, não cosmética**: o HTML ficou vazio e `updateImgProviderOptions()`
       monta as opções a partir do `AI_IMG`, mostrando o modelo da **qualidade ativa** — que é o
       que de fato vai rodar. Trocar a qualidade atualiza o rótulo junto.
     - Verificado: o HTML não traz mais rótulo nenhum; com low aparece "OpenAI · gpt-image-2" e
       "Google Gemini · gemini-3.1-flash-lite-image"; em high o Gemini vira `gemini-3-pro-image`;
       a seleção é preservada; e `aiImgNivel()` devolve exatamente o par que a tela anuncia.
     - ⚠️ **Mesmo padrão ainda existe no seletor de transcrição** (`index.html`): os preços
       "US$ 0,04/h" e "US$ 0,36/h" estão escritos à mão. Estão CORRETOS hoje (conferidos na
       84ª rodada), mas vão envelhecer do mesmo jeito. Registrado na seção 9.

185. **IMAGENS DA OPENAI: gpt-image-1 → gpt-image-2 (90ª rodada, 2026-08-06)**. Pedido de
     análise do catálogo novo do playground.
     - **Preços por imagem em 1024×1024** (fonte: guia oficial de geração de imagens — e note
     que agora eles são COTADOS, enquanto o gpt-image-1 publicava só US$ 40/1M e obrigava a
     multiplicar pelos tokens de cada qualidade: 272 / 1.056 / 4.160):
       | qualidade | gpt-image-1 | **gpt-image-2** | |
       |---|---|---|---|
       | low | 0,0109 | **0,006** | **−45%** |
       | medium | 0,0422 | 0,053 | +26% |
       | high | 0,1664 | 0,211 | +26% |
     - **A troca vale porque o app usa `low` por padrão** (decidido depois do episódio do
       R$ 1,80). Medium e high sobem, mas não por tarifa — a saída caiu de US$ 40 para 30/1M;
       eles emitem MAIS tokens (~1.766 e ~7.033 contra 1.056 e 4.160), são imagens maiores.
     - ⚠️ **Risco anotado**: no `low` o image-2 emite MENOS que o image-1 (~200 contra 272
       tokens), então parte da economia vem de peso. Se a ilustração ficar pobre, o caminho é
       subir para `medium`, não voltar ao image-1. **Não deu para avaliar a qualidade** — o
       ambiente de teste não tem chave.
     - **BUG LATENTE ACHADO DE PASSAGEM**: `_aiImageOpenAI` tinha `model: 'gpt-image-1'`
       **hardcoded**, o que tornava o campo `model` das faixas OpenAI puramente decorativo —
       trocar no catálogo não mudaria nada e o preço exibido podia divergir do modelo
       realmente chamado. Agora o catálogo manda (`n.model`), com `gpt-image-2` como padrão.
       O lado Gemini nunca teve esse problema.
     - **Outros do catálogo**: `gpt-image-1-mini` tem saída a **US$ 8/1M** (5× abaixo do
       image-1) e pode ser o mais barato de todos — mas a OpenAI **não publica a tabela por
       imagem dele**, então não dá para cotar sem medir. Ficou como pendência.
       `gpt-image-1.5` e `chatgpt-image-latest` saem a US$ 32/1M, sem tabela por imagem.
       `CACHE` → **v125**.

184. **"NÃO LEMBRO" NO BALÃO + RETORNO GENÉRICO (89ª rodada, 2026-08-06)**. Pedido: *"ao ver
     uma palavra que não lembro, a informação diz que já conheço; poderia ter uma pequena opção
     de revisar… mas deve voltar rápido pra exatamente onde eu estava"*, com o complemento
     *"tem que servir pra todos os métodos de estudo"*.
     - **O beco que existia**: o balão informava o estado e não oferecia saída. A palavra
       continuava marcada, fora da fila, e recuperá-la exigia procurá-la no Revisar.
     - **Três coisas juntas, e é a junção que torna o botão útil**: (1) `markKnownWord(w,false)`
       — e o mesmo para `ignoredWords` —, porque enquanto a marca existe a cobertura, a triagem
       por nível e o glossário seguem achando que ele sabe; (2) card criado **com a frase em
       volta** (`glossFraseEmVolta`), para a análise nascer com contexto; (3) navegação até
       aquele item, com `activeWordId` já apontando para ele.
     - **O retorno é GENÉRICO de propósito** (`estudoVoltarDefinir/estudoVoltar` em core.js).
       A tela de origem declara `{secao, rotulo, restaurar}` e nada mais; desmarcar, criar e
       navegar é mecanismo compartilhado. O leitor nem precisa de `restaurar` próprio —
       `renderLerSection()` já reabre no capítulo e na posição salvos (só força
       `_lerSalvarPos(true)` antes de sair). Vídeo, podcast e Assistente entram passando o
       mesmo objeto.
     - **A pílula flutuante vive no `body`**, fora de qualquer seção — é isso que faz o
       "volte para onde eu estava" valer para todos os métodos de estudo em vez de virar um
       banner por tela. O `restaurar` roda 60 ms depois do `showSection` porque a seção pode
       ser lazy e o módulo dela só existe após o carregamento.
     - O botão **substitui** o "Estudar" nesse estado em vez de conviver com ele: dois botões
       que criam o mesmo card, um deles sem desfazer a marcação, seria armadilha.
     - Verificado (10 casos): o balão mostra "Não lembro" só para conhecida/ignorada e some com
       o "Estudar" redundante; o callback leva palavra E frase inteira; a palavra sai das
       conhecidas; o card nasce com contexto e a fonte do livro; o glossário passa a responder
       como `card`; a pílula aparece com o nome da obra, está no `body`, restaura ao clique e
       some depois; palavra ignorada também é liberada; e chamar duas vezes não duplica o card.
       `CACHE` → **v124**.

183. **ESTUDAR POR FONTE — `srsFontesHoje()` / filtro na fila (88ª rodada, 2026-08-06)**.
     Pedido: *"quando eu for estudar quero poder escolher a fonte, por exemplo Flags on the
     Bayou, assim eu foco só nessas novas entradas"*.
     - **Nada de dado novo foi preciso**: `source_type` e `source_title` são carimbados na
       criação de todo card (o leitor põe o título do livro, a Mídia a série, o Kindle o
       livro). O que faltava era `buildSessionQueue` olhar para isso — ela só filtrava por
       **deck**. Os dois filtros agora convivem: deck é a gaveta que ele montou, fonte é de
       onde a palavra veio.
     - **Por que vale**: vocabulário estudado junto do contexto em que apareceu gruda mais, e
       "terminar este livro" vira meta concreta.
     - **O painel** ganhou uma fileira rolável de cartões — ícone da fonte, nome da obra e as
       contagens de hoje separadas em *revisar* (verde) e *novos* (acento). Fonte sem nada hoje
       **não aparece**: cartão que não leva a lugar nenhum é ruído. Com uma fonte só, o seletor
       inteiro some — não é escolha, é enfeite.
     - **O teto diário de novos é GLOBAL**, não por fonte. Cada cartão mostra
       `min(novos da fonte, teto restante do dia)` — anunciar "40 novos" numa fonte quando o
       dia permite 10 seria prometer o que a sessão não entrega. Testado: com teto 1, o cartão
       anuncia 1 e a fila traz exatamente 1.
     - **O perigo de persistir um filtro** é fila vazia sem explicação, que se parece com app
       quebrado. Por isso a fonte ativa aparece em três lugares: o cartão destacado, o texto do
       botão (*"Começar — Flags on the Bayou"*) e um aviso próprio quando a fila fica vazia por
       causa dela, com *"Estudar todas"* em um clique. O `startSrsSession` também nomeia a
       fonte no toast de fila vazia.
     - **Desempenho**: `_srsMapaFontes()` monta `wordId → fonte` uma vez por render; um `find`
       por card dentro do laço seria quadrático numa coleção que cresce para milhares.
     - Verificado: 3 fontes detectadas com as contagens certas; sem filtro a fila traz 9, com
       "Flags on the Bayou" traz só os 5 do livro, com "The Wire" só os 3 da série; o cartão
       ativo é destacado; fonte que zerou some da lista; e o teto global é respeitado.
       ⚠️ Duas "falhas" do primeiro teste eram do arsenal, não do código: `loadSrs()` recarrega
       `srsCfg` do localStorage e apagava o ajuste feito em memória, e cards órfãos (palavra
       apagada, card mantido) criavam um balde "Sem fonte" que impedia o caso de fonte única.
       `CACHE` → **v123**.

182. **"CLASSIFIQUEI DE NOVO E CONTINUA SEM EXPRESSÕES" — eu esqueci de subir a versão do
     cache (87ª rodada, 2026-08-06)**. O recurso estava certo; o dado velho é que mandava.
     - **O que acontecia**: a classificação anterior foi gravada como `v:1`. Ao adicionar a
       busca de expressões eu **não subi `LER_NIV_VER`**, então a checagem
       `Number(d.v||0) < LER_NIV_VER` dava `1 < 1` = falso e o cache antigo era **aceito**.
       Clicar em "Classificar por nível" achava o cache, carregava, avisava "classificação
       carregada" e **nunca chamava a IA** — parecia que o recurso novo não funcionava.
     - **`LER_NIV_VER` → 2.** Classificação v1 é incompleta *por construção* (foi produzida
       pela versão que mandava a palavra nua), então é descartada para ser refeita.
     - **A regra que faltou aplicar**: subir a versão do cache não é só para quando o FORMATO
       quebra — é para quando muda **o que aquele dado contém**. Uma rodada antes eu tinha
       feito exatamente isso no glossário (`LER_PRE_VER` 1→2) e não transportei a lição para o
       código novo do mesmo dia.
     - **Verificado que o resto do caminho está íntegro**, para não trocar um diagnóstico por
       outro: o prompt pede `expr` e `nx`; o envio vai `palavra :: frase` (conferido
       interceptando a chamada, sem gastar); e o parser aprova as sete expressões reais do
       livro dele — `tire of`, `shed the blood`, `bear the mark`, `arm myself`, `picked up`
       (separável), `look forward to`, `burn inside`. `CACHE` → **v122**.

181. **O CLASSIFICADOR NÃO ENXERGAVA OS CARDS FLEXIONADOS (87ª rodada, 2026-08-06)**.
     Relato: *"o classificador parece não olhar pras palavras já no projeto que estão pra
     estudo"*. Estava certo, e o defeito era maior do que o classificador.
     - **Reproduzido**: com cards de `begin`, `run`, `child`, `soldier`, um texto com
       `began`, `children`, `running`, `soldiers` devolvia **as quatro como NOVAS**.
     - **Causa raiz — divergência entre dois caminhos que deviam concordar**: na 82ª rodada o
       `isKnownWord` (palavras marcadas como conhecidas) ganhou lematização, mas a checagem
       contra **cards** (`_lerConjuntoEmEstudo` + `emEstudo.has(t)`) ficou em comparação
       LITERAL. Quem estudava "begin" continuava recebendo "began" como novidade.
     - **Estrago**: dezenas de falsas novas por capítulo — inflavam a contagem, faziam a
       cobertura mentir para baixo, e o classificador **gastava dinheiro** com palavra que já
       estava na fila de estudo. Medido no teste: cobertura **60% → 87%** no mesmo texto.
     - **Correção nos DOIS sentidos**: o conjunto guarda o card **e os lemas dele** (card
       "began" cobre o texto "begin") e `_lerEhEmEstudo()` testa os lemas do token contra o
       conjunto (card "begin" cobre o texto "began"). Modo `estrito` nos dois: -er/-est derivam
       palavra nova, e sumir com item legítimo é pior que mostrá-lo de novo — testado,
       `teacher` continua aparecendo apesar do card `teach`.
     - Aplicado também em `_lerNivMontar`, para a triagem por nível usar o mesmo critério que
       a contagem. Não sobrou nenhum `emEstudo.has(` literal no arquivo. `CACHE` → **v121**.
     - ⚠️ **Armadilha de teste, pela segunda vez nesta sessão**: a primeira verificação disse
       que o conserto não funcionara. Era o arsenal — carregar `ler.js` duas vezes na mesma
       página faz a segunda falhar na redeclaração dos `const` de topo, e o código ANTIGO
       continua valendo em silêncio. Recarregar a página antes de reavaliar é obrigatório.

180. **O CLIQUE QUE NÃO FAZIA NADA, O PAINEL CURTO E O CLASSIFICADOR CEGO A EXPRESSÕES
     (87ª rodada, 2026-08-06)**. Três relatos seguidos, e o primeiro era um par de bugs mudos.
     - **"clico em classificar e nada acontece"** — DOIS defeitos, os dois silenciosos:
       · `_lerPreProgresso` escrevia num id FIXO (`#ler-pre-area`) que pertence só ao bloco da
         GLOSA. O fluxo de nível desenhava no bloco errado e, quando aquele bloco estava no
         estado "já foi lido" (que não tem esse id), a função **saía sem fazer nada**.
         Agora o alvo é parâmetro (`_lerProgresso(areaId, …)`) e cada fluxo tem a sua área e o
         seu atalho — nenhum ponto de chamada precisa lembrar o id, que foi como o bug nasceu.
       · com a classificação já em cache, `lerClassificar` retornava **sem redesenhar**: o
         segundo clique também não produzia nada visível. Agora redesenha e avisa.
       · E a regra que ficou: **avisar ANTES do primeiro `await`**. Ler o IndexedDB e abrir o
         capítulo do EPUB levam tempo; clique sem resposta é indistinguível de app travado.
         Aplicado também ao fluxo da glosa, que tinha o mesmo buraco.
     - **"tem que ter um painel maior, tá muito curto"** — `.ler-painel` tem 46vh, dimensão
       pensada para sumário e tipografia (listas curtas). Aqui se triam centenas de palavras.
       `#ler-ferramentas` ganhou **86vh**, com **resumo e ação principal fixos no topo**
       (`position:sticky`) e só a lista rolando por dentro: o botão de confirmar não pode fugir
       da tela no meio da triagem. Cada faixa virou cartão, e a do nível dele tem marca própria
       — é a fronteira, onde estão os buracos reais.
     - **Ação POR FAIXA** (`lerNivEstudarGrupo`): cada nível tem "estudar as N restantes", que
       manda ao Revisar as **não marcadas** daquela faixa — marcado significa "eu conheço",
       então mandar as marcadas criaria card do que ele acabou de dispensar. Reusa
       `_lerCapturarSemFrase`, que já acha a frase de cada palavra no capítulo.
     - **⚠️ "o classificador só traz palavras, não phrasal verbs / idioms / collocations, e
       isso é fundamental"** — estava certo, e era falha ESTRUTURAL: o classificador mandava a
       palavra **nua**. Sem a frase, "tire" e "of" chegam separados e sem vizinhança, então
       "tire of" jamais poderia aparecer — o mesmo motivo pelo qual o dicionário embarcado foi
       recusado. Agora vai `palavra :: frase`, e a expressão volta com **nível próprio** (`nx`).
       Ela entra como item SEPARADO, não substitui a palavra: quem sabe "look" pode não saber
       "look forward to", e são duas decisões diferentes de "eu conheço". Custa pouco — a frase
       pesa na ENTRADA, o lado barato (US$ 0,20/1M contra 1,20 da saída).
       As mesmas três travas da glosa contra unidade inventada, mais deduplicação (a mesma
       expressão reaparece em várias frases). Testadas 8 situações, todas corretas.
     - **Buraco vizinho fechado**: `_lerConjuntoEmEstudo` só guarda palavra de uma peça, então
       expressão que JÁ era card escapava e voltava a aparecer na triagem. A checagem passou a
       ser contra a lista de cards inteira. `CACHE` → **v120**.

179. **TRIAGEM POR NÍVEL (QECR) — `lerClassificar()` (86ª rodada, 2026-08-06)**. Pedido:
     *"eu já entendo escrita muito bem, pelo nível médio. A cada capítulo você poderia fazer
     uma classificação de nível, onde todas as de nível menor que o meu já estão marcadas como
     conhecidas, e as que eu não conhecer eu desmarco."*
     - **O problema real**: um capítulo acusava **647 palavras novas**, mas a maioria só é nova
       para o APP. Elas nunca entraram no `knownWords` porque marcá-las uma a uma é trabalho de
       horas. Efeito duplo e ruim: a cobertura mentia para baixo (67% contra ~90% real) e a
       leitura com IA gastava dinheiro glosando palavra que ele sabe.
     - **A inversão**: a IA põe cada palavra numa faixa do QECR, tudo **abaixo** do nível dele
       já vem marcado, e ele **desmarca a exceção**. Marcar 300 vira desmarcar 8.
     - **O nível DELE não vem pré-marcado**, e é decisão consciente: "B1" para quem é B1 é
       exatamente a faixa onde ainda há buracos — marcá-la em massa esconderia o que ele
       precisa estudar.
     - **Faixas ACIMA são marcáveis** (pedido complementar dele, no meio da implementação):
       todo chip é clicável e TODO grupo tem "marcar todas", inclusive C1 e C2. A escala é
       palpite para poupar clique, não teto — quem é B1 sabe "bayonet" se leu sobre guerra.
     - **A ORDEM DO FLUXO é o que faz a economia**: (1) classificar, barato, cobre TODAS as
       palavras sem teto — a saída é de duas letras por palavra; (2) marcar as conhecidas;
       (3) só então glosar o que sobrou, que é caro. O inverso seria pagar glosa de palavra
       que ele marcaria como conhecida no minuto seguinte. Por isso o bloco de nível aparece
       ACIMA do de leitura no painel.
     - **Nunca marca sozinho.** `knownWords` alimenta cobertura, triagem e o glossário — erro
       em massa contamina tudo. Tem confirmação com custo na frente e desfazer que guarda
       **só o que não era conhecido antes**: reverter não pode apagar marcação legítima
       antiga (testado — `water`, marcada antes, sobreviveu ao desfazer).
     - Casamento da resposta **pela palavra**, nunca por índice — a lição do bug do "ordered =
       para". Nível fora de A1…C2 é descartado. `cfg.nivelAluno` (padrão B1) entrou no
       `DEF_CFG`, nas Configurações e no sync.
     - Verificado: as 6 faixas renderizam; só as abaixo do nível vêm marcadas; nível inválido
       sai; o nível dele e os de cima não vêm marcados; marcar C1/C2 individual e por grupo
       funciona; confirmar marca e esvazia; desfazer reverte sem tocar no que era antigo; a
       flexão continua valendo; e apóstrofo (`don't`) não quebra o `onclick`. `CACHE` → **v117**.

178. **A ESTIMATIVA DE CUSTO IGNORAVA O RACIOCÍNIO — e agora o app MEDE (85ª rodada,
     2026-08-06)**. Pergunta do Djemeson diante do modal de R$ 0,02: *"analise se isso condiz
     com a realidade, porque ele também lê o contexto da palavra"*.
     - **A preocupação dele estava OK**: os ~5.773 tokens de entrada SÃO as 120 palavras **com
       as frases** (`lista.length` entra na conta, ~23 mil caracteres). O contexto estava
       contado.
     - **O furo era outro**: `tokensOut = itens.length * 14` contava só as glosas **visíveis**.
       O Luna raciocina, e a OpenAI cobra raciocínio **como saída** — o lado caro (US$ 1,20/1M
       contra 0,20 da entrada). Conforme o quanto ele pense, o real fica entre **1,8× e 6,7×**
       a estimativa: R$ 0,02 podia ser R$ 0,03 ou R$ 0,12.
     - **A correção NÃO foi chutar um multiplicador** — seria trocar um número errado por
       outro. O app passou a **medir**: `_aiGuardarUso()` recolhe o `usage` de toda chamada
       (entrada, saída, `reasoning_tokens`, `cached_tokens`), `aiUsoZerar()`/`aiUsoAcumulado()`
       delimitam uma operação inteira de N chamadas, e `aiCustoDeUso()` calcula o preço do que
       foi REALMENTE consumido. Ao terminar, o toast diz *"…palavras lidas · custou R$ X"* e o
       console traz entrada/saída/raciocínio/chamadas com o estimado ao lado.
     - **E a medição CALIBRA a próxima**: `_lerRacGuardar()` guarda em `localStorage`
       (`el-rac-por-item`) quantos tokens de raciocínio aquele modelo gasta **por item**, em
       média corrida (um capítulo atípico não vira a régua sozinho). A primeira leitura de cada
       modelo roda com estimativa **alta de propósito** (4× o texto visível — errar para cima é
       o lado seguro) e o modal **diz que é chute**; da segunda em diante usa o número medido e
       diz que é medição.
     - Testado: sem medição → 6.720 tokens previstos e `medido:false`; modelo sem raciocínio →
       0 tokens e nenhum aviso; três chamadas sintéticas → 5.520 de raciocínio, R$ 0,054 (2,7×
       o que o modal dizia, no meio da faixa prevista); calibração gravada em 46/item; próxima
       estimativa já usa 5.520; segunda medição mais leve move a régua para 33 e não para 20;
       `cached_tokens` também é lido (serve para a conversa de cache do DeepSeek).
     - ⚠️ **Armadilha do meu próprio teste, que vale registrar**: a primeira bateria disse que a
       calibração não salvava. Era o arsenal de teste — extraí as funções sem a constante
       `SK_LER_RAC`, e o `try/catch` de `_lerRacGuardar` engoliu o `ReferenceError` em silêncio.
       Ou seja: `catch` vazio esconde erro de teste tão bem quanto erro de produção.

177. **O ORÇAMENTO DE TOKENS ESTAVA ERRADO NO APP INTEIRO — modelo que raciocina (84ª rodada,
     2026-08-06)**. "Ler o capítulo com a IA" falhou com *"[OpenAI] a IA devolveu uma resposta
     vazia ou fora do formato"*, rodando `gpt-5.6-luna`.
     - **Confirmado na doc oficial** (`developers.openai.com/api/docs/guides/reasoning`), e a
       frase que fecha o caso: os tokens de raciocínio **contam dentro do
       `max_completion_tokens`**, e se o orçamento acaba durante o raciocínio a resposta volta
       com content VAZIO — *"você pode pagar entrada e raciocínio sem receber resposta
       visível"*. A recomendação da OpenAI é **reservar ~25.000 tokens**.
     - **Eu tinha dado 1.440** (`lote.length * 26 + 400`, dimensionado só para as glosas
       visíveis). O Luna gastou tudo pensando e não sobrou texto. **A chamada foi cobrada.**
     - **⚠️ E O ERRO NÃO ERA SÓ DA PRÉ-ANÁLISE.** A varredura achou o mesmo risco em todo o
       app: `add.js` pedia 800 e `Math.max(800, n*60)`, `review.js` 600 e 800, `ler.js` 600 e
       700 — **qualquer uma dessas quebra do mesmo jeito** em modelo que pensa. Por isso a
       correção foi no ÚNICO ponto de passagem, `_aiTokenParam()`: para `gpt-5*`/`o*` ele
       soma `AI_FOLGA_RACIOCINIO = 25000` ao que o chamador pediu. Nenhum chamador precisou
       mudar, e todos ficaram protegidos.
     - **Por que a folga é de graça**: `max_completion_tokens` é **limite, não reserva** — só
       se paga o que for realmente gerado. Levantar o teto não encarece nada; o que encarecia
       era a chamada que falhava e era cobrada assim mesmo. Modelos sem raciocínio
       (`gpt-4o-mini`, DeepSeek, Groq) continuam com `max_tokens` intocado — testado.
     - **`_aiPorQueVazio()`**: "resposta vazia ou fora do formato" era verdade e não servia
       para nada, porque as causas pedem ações opostas. Agora olha o que a API devolveu e
       nomeia: estouro no raciocínio (com a contagem de tokens pensados e o aviso de que foi
       cobrado), corte por teto, filtro de conteúdo, recusa do modelo, erro da API, ou "veio
       texto mas não era JSON". Sete casos testados, todos distinguidos.
     - **PROGRESSO** (pedido junto: *"depois que aperta o botão nada acontece e tem que ficar
       esperando"*). O botão vira estado ao vivo: etapa, lote atual/total, barra e quantas
       palavras já entraram. Começa **no preparo** — abrir o capítulo do EPUB e casar as frases
       também demora, e acontece ANTES da pergunta de custo. Atualiza **antes** de cada lote,
       não só depois: a primeira chamada é a mais longa e deixar a barra em zero durante ela
       seria repetir o silêncio que se está corrigindo. Toast não servia aqui — some sozinho, e
       some justamente enquanto ainda está trabalhando. Testado: preparo sem barra, 0/3, 2/3 a
       67%, 3/3 a 100%, e não explode se o painel for fechado no meio.

176. **CAMADA 1 — PRÉ-ANÁLISE DO CAPÍTULO (83ª rodada, 2026-08-06)**. A pendência dizia "medir o
     kaikki.org antes de prometer". Medi, e **a medição derrubou o próprio plano**.
     - **O DICIONÁRIO EMBARCADO FOI MEDIDO E RECUSADO** — registrar isto por extenso evita que
       alguém (eu, daqui a três rodadas) refaça o estudo e chegue à mesma parede:
       · fonte: `kaikki.org/ptwiktionary/Inglês` — 18.044 verbetes, 11 MB de JSONL cru.
         (O dump do Wikcionário INGLÊS tem 3,0 GB e está fora de cogitação.)
       · **CORS bloqueia** todos eles (kaikki, FreeDict, WikDict) — o arquivo teria de ser
         servido pelo NOSSO repositório, não buscado em tempo de execução.
       · tamanho: 0,86 MB em JSON enxuto, **0,26 MB comprimido** (recorte nas 10 mil mais
         frequentes: 0,09 MB). Minha estimativa anterior de "poucos MB" estava errada — para
         melhor. **Cabia.**
       · cobertura ponderada por frequência real: 94,7% (top 1.000) e 87,3% (top 20.000) na
         forma crua; **96,7% e 91,5% com o nosso lematizador**. Parecia ótimo.
       · **QUALIDADE — foi aqui que reprovou.** Nas palavras do livro que ele está lendo:
         `barrel`→"barril" (é o **cano** do fuzil), `bore`→"chateação" (é o passado de *bear*:
         "não **nutri** rancor"), `yank`→"puxão" (é *Billy Yank*, o soldado da União),
         `tire` e `animus` **sem verbete**. Conferido se outro sentido salvava: **não salva** —
         `barrel` tem três acepções e nenhuma é a arma, `bore` tem quatro e nenhuma é o passado
         de *bear*. O sentido certo **não existe no dado**.
       · **Conclusão**: as três palavras dos prints que ele mandou (`animus`, `bore`,
         `Billy Yank`) o dicionário erra ou não tem, e `barrel`→barril é literalmente o erro
         das rodadas 163–167. Seria reintroduzi-lo por 0,26 MB.
     - **O QUE ENTROU NO LUGAR**: ele não lê "inglês em geral", lê **um livro**, e o app tem o
       livro inteiro. `lerPreAnalisar()` pega as palavras novas do capítulo (as que
       `lerAnalisar` já filtra: fora conhecidas, palavras de função e as que já são card),
       casa cada uma com **a frase em que aparece** (`_lerFrasesPara`) e manda tudo numa
       chamada só, com `promptRegrasLexicais(lang,'glosa')` embutido. A glosa nasce **presa ao
       contexto** — o oposto do verbete cego. Guardado em `BookDB` sob `pre:<livro>:<cap>`.
     - **Ordem de consulta no `glossBuscar`**: card **antes** da pré-análise, e é deliberado —
       o card é material que ELE curou e corrigiu; a pré-análise é leitura automática. Testado:
       com card "cano" e pré-análise "barril" para `barrel`, ganha **cano**.
     - **Nunca automático.** Confirma com o custo calculado sobre o **prompt real** (~4 chars/
       token na entrada, ~14 tokens de saída por item), não sobre a média de 1.800 do
       `aiConfirmBatch` — que superestimaria em ~100×, porque aqui é UMA chamada para até 120
       palavras. Precedente que justifica o rigor: o episódio das imagens no nível médio.
     - **Três armadilhas de estado fechadas** (todas da mesma família do bug de posição da 79ª):
       · trocar de capítulo **zera** a pré-análise antes de recarregar — mostrar a glosa do
         capítulo 3 no capítulo 4 é pior que não mostrar nada;
       · `lerPreAplicar` confere `_lerCap === cap` **depois** do await do IndexedDB, e
         `lerPreAnalisar` confere de novo depois do await da IA (que leva segundos) — mas
         **grava sempre**, porque o trabalho já foi pago;
       · fechar o livro limpa a camada, senão as glosas do romance apareceriam sobre o texto do
         Revisar e do Assistente, que usam o mesmo glossário;
       · e remover o livro apaga as chaves `pre:<id>:*`, que de outro modo ficariam órfãs para
         sempre no IndexedDB (a chave depende de um livro que não existe mais).
     - **Não sincroniza** (é IndexedDB, por aparelho) e **não vira card** — é apoio de leitura;
       estudar continua sendo escolha explícita.
     - Verificado: as 8 combinações de busca nas duas camadas, a extração de frase em 9 palavras
       de um trecho do livro dele (cada uma saiu com a frase certa, `barrel` inclusive), e o
       carregamento do `ler.js` lazy com a UI renderizando sem livro aberto. `CACHE` → **v112**.
     - 🔴 **O BUG QUE ISSO TROUXE, E QUE É A LIÇÃO MAIS CARA DA RODADA** (`CACHE` → **v113**).
       Rodando com o Luna, o Djemeson viu `ordered` glosado como **"para"**. Não era a IA
       errando: era **eu casando resposta com pergunta pelo ÍNDICE que o modelo devolve**.
       A lista ia numerada 1..N e a resposta trazia `{"i":n,"pt":…}`. Basta o modelo **pular um
       item e renumerar** — comportamento comum com lista longa em modelo barato — para TODAS as
       glosas seguintes grudarem na palavra vizinha, **em silêncio e com cara de acerto**.
       Reproduzido em teste: com um item pulado, o casamento antigo devolvia
       `pledge→"ordenar"`, `ordered→"armar-se"`, `arm→"fileira"`; o novo devolve as quatro
       certas e o item pulado apenas fica sem glosa.
       · **Causa raiz nomeada**: índice é *bookkeeping do modelo*; palavra é *conteúdo*. Nunca
         confiar no bookkeeping dele — é a MESMA lição do lote de imagens que contava falha
         como sucesso (item 173). Agora o modelo **repete a palavra** e é ela que casa; resposta
         com palavra que não foi perguntada é descartada e contada no console.
       · Porta tolerante: se o modelo devolver o LEMA ("order" para "ordered"), casa mesmo
         assim — **desde que só uma palavra do lote leve àquele lema**; se duas levarem, é
         ambíguo e adivinhar seria repetir o erro que se está consertando.
       · Lotes de **40** em vez de 120 numa tacada: lista longa é o que convida ao pulo. O custo
         no modal passou a contar o sistema repetido por lote (subestimar é pior).
       · **Dado velho no aparelho**: `LER_PRE_VER = 2`. O que a v1 gravou está errado e não tem
         conserto possível depois, então é descartado em silêncio ao carregar — melhor não
         mostrar nada do que mostrar a glosa da palavra vizinha. Testado: v1 com e sem o campo
         `v`, JSON corrompido e cache ausente, todos recusados; v2 aceita.
       · **Varredura do mesmo padrão no projeto**: `add.js` tem dois prompts que também pedem
         `"i"` (lote do Kindle, linha ~481, e da Mídia, ~815). Os dois são **estruturalmente
         mais seguros** — buscam pelo VALOR (`kindleItems[idx]` e
         `find(x => Number(x.i) === i)`), então item pulado é ignorado sem deslocar o resto, e a
         numeração 0-based bate com o consumo. `review.js` e `video-*` não casam por índice: a
         IA devolve objetos autocontidos (`{expr, gloss}`). Risco residual registrado na seção 9.

175. **GLOSSÁRIO NO HOVER — `js/glossario.js` (82ª rodada, 2026-08-06)**. Pedido: "uma espécie
     de dicionário no projeto, onde ao passar o mouse sobre uma palavra em inglês apareça o
     significado — vi que o Language Reactor tem isso".
     - **A MEDIÇÃO QUE DECIDIU TUDO** (feita do próprio app, e é o que evita refazer o estudo):
       `en.wiktionary.org/api/rest_v1/page/definition/` → **772–1234 ms** (funciona, CORS ok);
       MediaWiki action API → **2817 ms** e HTML sujo; `api.dictionaryapi.dev` → **HTTP 200 com
       CORPO VAZIO**, quebrado; `pt.wiktionary` definitions → **HTTP 501, não existe**.
       Conclusão dupla: (a) hover precisa de ~50 ms, então **nenhuma API serve**; (b) **não há
       rota REST gratuita inglês→português**. O Language Reactor não faz mágica — ele embarca
       os dados. Logo o dado tem de estar no aparelho, e o que muda entre as opções é QUAL.
     - **A camada 0 (esta rodada)**: o dicionário é **o que o aluno já escreveu** — os cards,
       o `knownWords` e o `ignoredWords`. Baixa **zero byte**, custa zero, responde na hora, e
       a tradução é a CERTA porque já foi validada no contexto em que ele encontrou a palavra.
       Cobre só o que ele já viu — que no livro é justamente onde o reforço vale mais.
     - **Sem tocar no DOM**: a palavra sob o cursor sai de `caretPositionFromPoint` /
       `caretRangeFromPoint` (validado: lê corretamente palavra a palavra numa linha). Envolver
       cada palavra num `<span>` — o caminho óbvio — **quebraria a paginação por colunas do
       leitor** e encheria o DOM de um capítulo inteiro à toa.
     - **A defesa contra o erro das rodadas 163–167**, que é o risco central de qualquer
       dicionário: ele é cego ao contexto por construção. Três travas, e as três testadas:
       · a glosa mostrada é a do significado marcado **`context_match`** — `barrel` devolve
         **"cano"**, não "barril", e o balão avisa "+1 outro significado no card";
       · antes de responder pela palavra, testa se ela abre uma **expressão** que já é card:
         passar o mouse em `tire` dentro de "tire of" devolve **"cansar-se de"** com o selo
         *expressão* — e `tire` sozinho não devolve nada, em vez de chutar;
       · o balão sempre oferece **"Ver com a Lexa"**, que não reimplementa nada: chama
         `glossSelecionar()`, seleciona a palavra e deixa o popup normal do leitor abrir com
         Explicar/Estudar/Ouvir/Imagens/Wikipédia. Um caminho só, que não diverge.
     - **Lematizador** (`glossLemas`), sem o qual o recurso morre no primeiro parágrafo — o
       texto traz "began" e o card é "begin". Tabela de irregulares (verbos, plurais,
       comparativos) + regras de sufixo com consoante dobrada e -ies→y. Testado:
       `began`→begin, `went`→go, `children`→child, `running`→run, `stopped`→stop.
       **A regra de -ly ficou DE FORA de propósito**: "hardly" não é "hard", "barely" não é
       "bare" — é a mesma família de erro do "barrel"→barril, significado trocado com cara de
       acerto. E o modo `estrito` corta -er/-est, que derivam palavra nova ("teacher" não é
       "teach").
     - **UM componente para TODAS as telas** (leitor, Revisar, Assistente). Se cada uma tivesse
       a sua cópia, o mesmo defeito seria consertado três vezes — foi exatamente o que
       aconteceu com as regras lexicais até a 80ª rodada.
     - **No celular, nenhum gesto novo.** O leitor já tem três (borda vira página, arrasto vira
       página, toque longo seleciona); um quarto quebraria o virar-página. A glosa entra no
       **topo do popup que o toque longo já abre**, via `glossLinhaHTML()`. Hover só entra em
       `(hover:hover) and (pointer:fine)`.
     - **Invalidação do índice** — o pior bug possível aqui seria mostrar para sempre uma
       tradução velha, e em silêncio, porque o card na tela já estaria certo. `saveWords()` e
       `markKnownWord()` matam o índice; há ainda rede de segurança pelo tamanho de `words`
       (importação em lote/snapshot da nuvem que troquem o array sem avisar). Testado nos 4
       caminhos: corrigir card, apagar card, marcar conhecida, e o `saveWords` da nuvem.
     - **⚠️ Armadilha de ambiente encontrada no teste, e que virou correção real**: o
       estrangulamento era por `requestAnimationFrame`, que **é suspenso em aba de fundo** — uma
       chamada pendente na troca de aba nunca devolve e a trava ficaria presa, matando o hover
       em silêncio. Trocado por carimbo de tempo (40 ms), que não tem esse estado. Alinhar com o
       quadro não servia para nada aqui: quem manda no ritmo é a mão.
     - **De graça (`isKnownWord`)**: a regra de sufixo dele nunca enxergou **verbo irregular**,
       que é o vocabulário mais frequente do inglês — quem marcava "begin" como conhecida
       continuava recebendo "began" para estudar, e "go" não cobria "went". Agora usa
       `glossLemas(…, {estrito:true})`. ⚠️ **Efeito colateral consciente**: a cobertura por
       capítulo no leitor vai SUBIR (mais formas reconhecidas). É correção, não regressão, mas
       o número muda de um dia para o outro.
     - `CACHE` → **v110**; `js/glossario.js` entrou no SHELL (não é lazy: três das telas que o
       chamam carregam sob demanda).
     - **DOIS DEFEITOS NO USO REAL, corrigidos no mesmo dia** (`c9f0f10`, `CACHE` → **v111**):
       · *"tem palavras que mandei pra revisão mas aparecem como marquei que conheço"* — era
         **rótulo, não índice** (o índice estava certo, conferido). Palavra mandada ao Revisar e
         **ainda não analisada** entra como card sem glosa, e o `else` do `glossLinhaHTML`
         jogava esse caso na mensagem de "conhecida" — dizendo ao aluno o CONTRÁRIO do que ele
         fez com ela. **Causa raiz**: eu havia colapsado TRÊS estados num binário (tem glosa /
         não tem). Agora são três mensagens distintas. Na mesma linha, o painel do toque longo
         passou a mostrar também os casos sem glosa: "já está no Revisar" evita que ele
         recapture a mesma palavra pelo botão *Estudar* logo abaixo.
       · *"quando eu subo o mouse pra cima do card que aparece ele some"* — o balão nasce ACIMA
         da palavra, então subir o mouse era **sair da palavra**, e o fechamento imediato
         tornava o "Ver com a Lexa" impossível de clicar: o botão existia e era inalcançável.
         Sair da palavra agora **agenda** o fechamento (`GLOSS_GRACA`, 280 ms); entrar no balão
         cancela; sair do balão fecha. O vão caiu de 12px para **6px** — distância grande
         transforma "ir até o botão" em prova de pontaria. E o CSS deixou de usar
         `pointer-events:none`, que impedia o balão de receber o ponteiro.
       · ⚠️ **Efeito colateral que a trégua criou e precisou de conserto**: `_glossMostrar`
         chamava `glossFechar()` para limpar o balão anterior, e isso cancelava também o
         fechamento agendado — um balão criado DEPOIS de o mouse já ter saído do texto ficaria
         preso na tela para sempre. Agora ele só remove o elemento.
       · Sete casos verificados: aparece; sobrevive ao vão; segura enquanto o mouse está sobre
         o balão; o clique chega e fecha; a trégua expira quando a mão vai embora de vez;
         passar por palavra SEM card fecha o balão aberto; sair do container usa a trégua.

174. **CATÁLOGO DE IMAGENS REVISADO NA FONTE — o nível barato ficou mais novo E mais barato
     (2026-08-06)**. O Djemeson trouxe prints do catálogo do Google (abas Images, Audio e
     Agents). Da lista inteira, **uma coisa era acionável hoje** — e vale registrar as duas
     que NÃO eram, porque parecem boas e não são.
     - **A troca**: o nível `low` do Gemini deixou de ser `gemini-2.5-flash-image`
       (US$ 0,039, set/2025) e passou a ser **`gemini-3.1-flash-lite-image` — Nano Banana 2
       Lite (US$ 0,0336, jun/2026)**. É simultaneamente **geração mais nova e preço menor**,
       então manter o 2.5 era pagar a mais por um modelo anterior. O 2.5 saiu do catálogo:
       com o Lite existindo, ele não é o melhor em nenhum critério.
       O preço foi conferido na tabela oficial — o fetch embolou o valor padrão do Lite, mas
       o batch fecha a conta: nessa família batch é sempre metade do padrão (0,067→0,034;
       0,134→0,067; 0,039→0,0195), e o batch do Lite é 0,0168 → padrão **0,0336**, idêntico
       ao print. Método a repetir quando a doc vier ambígua.
     - **⚠️ ARMADILHA — Imagen 4 Fast, US$ 0,02**: é o preço mais baixo da tela inteira e é
       uma cilada. Os três Imagen 4 (`imagen-4.0-generate-001`, `-ultra-`, `-fast-`) estão
       **depreciados e desligam em 17/ago/2026** — 11 dias depois desta rodada. Adotar por
       preço seria trocar um módulo funcionando por um que quebra em duas semanas.
     - **Tela que cobrava a mais**: o seletor de Configurações usava `usd.toFixed(3)`, que
       arredondava 0,0336 para **"0,034"**. Com preços de 4 casas isso deixa a interface
       mentindo *para cima* sobre a fatura. Agora imprime o literal do catálogo.
     - **TTS avaliado e RECUSADO** (a aba Audio): `gemini-2.5-flash-preview-tts` custa
       US$ 0,50 in / 10,00 out e o `gemini-3.1-flash-tts-preview` US$ 1,00 / 20,00 — contra o
       `gpt-4o-mini-tts` (US$ 0,60 / 12,00) que já roda. O 2.5 sai perto de empate e o 3.1 é
       quase o dobro; os dois são **Preview** (mudam sem aviso), e a pipeline atual é
       OpenAI-shaped (catálogo de 13 vozes + queda para voz legada no `tts-1`). Trocar tudo
       por empate de preço não se paga. O atrativo real do 3.1 são as *expressive audio tags*
       (narração dirigida — ler devagar, enfatizar a palavra-alvo), que seriam pedagogicamente
       úteis; ficou como pendência, não como troca.
     - **Nada a fazer** com Lyria (música), Antigravity/Deep Research (agentes precisam de
       servidor; este app é 100% cliente).
     - Verificado no app: os três níveis resolvem para os modelos certos, `aiImgNivel()` com
       Gemini cai no Lite a US$ 0,0336, `'high'` explícito continua no 3-pro, console limpo.
       Nenhum id de modelo é gravado junto da imagem, então **não há dado velho no aparelho** —
       a troca vale para quem já tem `imgQuality: 'low'` salvo, sem migração. `CACHE` → **v109**.

172. **IMAGENS: "gerei 4 no mais baixo e consumiu 1,80" — o app caía no MÉDIO em silêncio
     (2026-08-06)**. Preços do Gemini reconferidos na fonte e **corretos** (2.5-flash-image
     US$ 0,039 · 3.1-flash-image US$ 0,067 · 3-pro-image US$ 0,134). O problema era outro, e a
     conta fechou exata: **R$ 1,80 = US$ 0,333 = 5 gerações a US$ 0,067 (nível MÉDIO)**.
     - **Causa raiz**: `imgQuality` **não existia no `DEF_CFG`**. Sem ele salvo,
       `aiImgNivel()` caía em `'medium'` — no Gemini, 1,7× o preço do econômico — sem ninguém
       pedir. Havia **quatro cópias** desse `|| 'medium'`: `aiImgNivel` (ai.js),
       `updateImgQualityOptions` e `saveSettings` (settings.js) e o push do `fbPushData`
       (firebase.js). Todas passaram para `'low'`, e `imgQuality: 'low'` entrou no `DEF_CFG`.
     - **A mentira na tela**: o seletor de Configurações mostrava **"Padrão"** selecionado
       (porque lia `|| 'medium'`) enquanto o código gerava no nível que o `aiImgNivel` decidia.
       A tela dizia uma coisa e a fatura dizia outra.
     - **Bug de cobrança DUPLA encontrado no caminho**: `_aiImageGemini` tem duas rotas
       (`:generateContent` e `/interactions`). Se a primeira devolvia **HTTP 200 sem imagem**
       (prompt recusado, ou formato de resposta novo), o laço **caía na segunda rota e gerava
       de novo** — duas cobranças pela mesma imagem. Agora só há queda para a segunda rota em
       404/400 ("o modelo não existe aqui"); 200-sem-imagem para na hora e explica.
     - **Visibilidade**: o `aiImage` agora imprime no console o nível, o fornecedor, o modelo e
       o preço por imagem ANTES de gerar — dá para conferir o que vai ser cobrado sem esperar a
       fatura.
     - Validado com `cfg` vazio: nível `low` nos dois fornecedores (OpenAI US$ 0,011 ·
       Gemini US$ 0,039); escolha explícita de "high" continua mandando. Quatro imagens no
       Gemini caem de **R$ 1,45 para R$ 0,84**. `CACHE` → **v107**.

171. **ÁUDIO: auditoria do TTS na fonte oficial — o app estava com a lista de vozes ANTIGA
     (2026-08-06)**. Pedido: "analise a geração de áudio olhando na fonte da OpenAI agora".
     - **O modelo está certo**: a doc oficial ainda chama o `gpt-4o-mini-tts` de "our newest
       and most reliable text-to-speech model". Nada a trocar aí — o `tts-1`/`tts-1-hd`
       continuam sendo os legados, e o app já usa o novo com queda para o antigo.
     - **O achado**: o endpoint `/audio/speech` tem hoje **13 vozes** e a OpenAI recomenda
       explicitamente **`marin` e `cedar`** "for best quality". O app tinha a lista de **9** —
       a antiga, do `tts-1` — e portanto **sorteava justamente sem as duas melhores**. Agora
       são 13: entraram `ballad`, `cedar`, `marin` e `verse`.
     - **A armadilha que veio junto** (e que quase virou card mudo): o `tts-1`, usado como
       FALLBACK do `aiTTS`, **não conhece as vozes novas**. Sortear "marin" e cair no fallback
       daria 400 e o card ficaria sem áudio. Por isso a lista legada existe separada
       (`OPENAI_VOICES_LEGACY`) e o `aiTTS` **troca a voz ao descer de modelo** (`vozLegada()`).
       Testado: as 13 vozes sorteiam, e todas as 13 mapeiam para uma voz que o `tts-1` aceita;
       as 9 clássicas não mudam.
     - **Por que manter o sorteio**: é pedagógico. Cada card sai com uma voz diferente, e ouvir
       timbres variados treina o ouvido melhor que uma voz só. Ampliar de 9 para 13 aumenta
       essa variedade e ainda inclui as duas de melhor qualidade.
     - **Preço do TTS conferido, sem mudança**: `gpt-4o-mini-tts` = US$ 0,60/1M tokens de texto
       + US$ 12,00/1M tokens de áudio (≈ US$ 0,015 por minuto gerado — o número que já estava
       no comentário do `ai.js` e na estimativa de custo).
     - **Bônus na transcrição** (fora do pedido, anotado): a OpenAI hoje tem `gpt-transcribe`
       a US$ 0,0045/min e `gpt-4o-mini-transcribe` a US$ 0,003/min — contra US$ 0,006/min do
       Whisper. Ou seja, dá para reduzir pela metade SEM sair da OpenAI. Mas a Groq segue
       imbatível a US$ 0,04/HORA (≈ US$ 0,00067/min), então a recomendação continua a mesma.
     - `CACHE` → **v106**.

170. **O TESTE COMPARATIVO RODOU — e o resultado mais importante foi um que ninguém esperava
     (2026-08-06)**. Os três casos (does / tire of + the mud / barrel) passaram pelos três
     modelos configurados. Leitura do resultado:
     - ✅ **As correções de prompt das rodadas 163–167 FUNCIONAM.** Todos acertaram:
       `does` → "de fato, realmente" com `gramatical: true`; `tire of` → "cansar-se de";
       `the mud` → não virou unidade; `barrel` → "cano". Os três casos que motivaram tudo
       estão resolvidos.
     - ⚠️ **A linha "deepseek-v4-flash" do teste NÃO É do DeepSeek.** O console mostrou
       `[ai] JSON pelo fallback OpenAI` **quatro vezes** durante aquela rodada: TODAS as
       chamadas JSON do DeepSeek falharam e o app caiu na OpenAI sozinho. O DeepSeek não errou
       o teste — ele não respondeu. **O DeepSeek segue não validado.**
     - 🔧 **Defeito de diagnóstico corrigido na hora**: o `aiJSON` guardava o erro do
       fornecedor em `erro` e só o mostrava se a OpenAI TAMBÉM falhasse — ou seja, era
       impossível saber POR QUE o DeepSeek não respondeu (chave? cota? modelo descontinuado?
       JSON quebrado?). Agora o motivo vai junto no `console.warn`. E, pior que o console:
       o fallback era **invisível para o usuário** — você escolhe DeepSeek, ele falha em toda
       chamada e o app cobra OpenAI sem avisar. Agora sai um toast, **uma vez por sessão**
       (não por chamada, senão vira spam).
     - 📊 **Sinal forte de qualidade a favor da Luna** — no `sense_audit` (o log que a 50ª
       rodada criou justamente para auditar sentidos):
       · `does` → gpt-4o-mini achou **2** sentidos; **Luna achou 5**, incluindo auxiliar
         interrogativo, auxiliar de negação e "corças" (plural de *doe*, fêmea de cervo).
       · `barrel` → gpt-4o-mini achou **2**; **Luna achou 5**, incluindo a unidade de petróleo,
         o corpo cilíndrico de um instrumento e o VERBO *to barrel* (avançar velozmente).
       Como a regra do app é "devolva TODOS os sentidos distintos", a Luna está cumprindo o
       prompt melhor. É uma amostra só — sinal forte, não prova.
     - 🐞 **Achado colateral**: o console mostrou `net::ERR_BLOCKED_BY_CLIENT` em
       `firestore.googleapis.com`. Alguma extensão do navegador (bloqueador de anúncios) está
       barrando o Firebase — a sincronização com a nuvem está falhando em silêncio nesse
       navegador. Ver pendências.
     - `CACHE` → **v105**.

169. **GPT-5.6 (Sol / Terra / Luna) no catálogo — e o número que decide (2026-08-06)**.
     A OpenAI lançou em 2026-07-09 uma família de TRÊS níveis com nome próprio: **Sol** (topo),
     **Terra** (equilibrado) e **Luna** (rápido/barato). Preços de tabela conferidos na página
     oficial: Sol 5,00/30,00 · Terra 2,00/12,00 · Luna 0,20/1,20 (cache: 0,50 · 0,20 · **0,02**).
     - **O dado que manda para ESTE app** está no MRCR (recall em contexto longo):
       Sol 91,5% · Terra 89,6% · **Luna 41,3%**. Nos outros testes a Luna praticamente empata
       com a Terra (Agents' Last Exam 50,3 vs 50,4), mas despenca nesse. O prompt de análise
       daqui tem ~3.000 tokens — não é "contexto longo" no sentido do teste —, porém é longo em
       REGRAS, e soltar regra é exatamente a nossa dor das rodadas 163–167. Por isso a Luna
       entrou como **candidata a testar, não como padrão**.
     - **O argumento a favor da Luna**: o padrão do app é `gpt-4o-mini-2024-07-18` — modelo de
       **julho de 2024**, dois anos atrás. A Luna é geração atual por R$ 0,0127/card contra
       R$ 0,0071 do 4o-mini (1,8×) — ou R$ 1,27 contra R$ 0,71 em 100 cards/mês. E o desconto de
       cache dela é 10× (0,20→0,02) contra 2× do 4o-mini, o que a favorece ainda mais se o
       prompt for reestruturado para cachear (ver pendência).
     - **Terra** entrou como tier alto (R$ 0,127/card): "quase o topo por 1/2,5 do preço", para
       quando a qualidade do card importar mais que o custo.
     - **Sol ficou de fora**: R$ 0,32 por card analisado é desproporcional para glosa de
       vocabulário. Se um dia fizer sentido, é só acrescentar.
     - **Compatibilidade conferida antes de adicionar**: `_aiTokenParam` já manda
       `max_completion_tokens` para tudo que casa com `/^(gpt-5|o\d)/` — `gpt-5.6-luna` e
       `gpt-5.6-terra` entram sem ajuste nenhum.
     - Catálogo agora tem **16 modelos**; a ordem continua importando (primeiro = padrão).

168. **Auditoria do catálogo de preços nas fontes oficiais (2026-08-05)**. Pedido: "cheque na
     fonte original e atualize os números se for o caso". Conferidos os 14 modelos um a um em
     `developers.openai.com/api/docs/pricing`, `api-docs.deepseek.com`,
     `ai.google.dev/gemini-api/docs/pricing` e `console.groq.com/docs/models`.
     - **ONDE CONFERIR PREÇO (atualizado em 06/08 — as URLs da OpenAI MUDARAM)**. O antigo
       `platform.openai.com/docs/*` devolve **301** para `developers.openai.com/api/docs/*`.
       São três páginas, e a segunda é a que resolve discussão de custo:
       · `developers.openai.com/api/docs/models` — cartão por modelo (entrada/saída por MTok,
         contexto, corte de conhecimento). **Não mostra cached input.**
       · `developers.openai.com/api/docs/models/compare` — lado a lado, e este **inclui
         cached input**, tokens de raciocínio e limites de taxa. É o único lugar onde dá para
         comparar honestamente com o desconto de cache do DeepSeek.
       · `developers.openai.com/api/docs/pricing` — tabela completa: texto (Standard/Batch/
         Flex/Fast), áudio, realtime, imagem, vídeo, transcrição, embeddings, fine-tuning.
       O Playground só RODA prompt; não exibe preço.
     - **⚠️ Os preços de imagem da OpenAI no `AI_IMG` são DERIVADOS, não copiados.** A tabela
       oficial lista só `gpt-image-1` a **US$ 40 / 1M tokens de saída** — não existe linha
       "low/medium/high" lá. Os nossos três vêm da contagem de tokens por qualidade em
       1024×1024: **272 → 0,011 · 1.056 → 0,042 · 4.160 → 0,167** (conferido em 06/08, bate).
       Consequência para manutenção: se a OpenAI mexer no preço por token, o site continua com
       um número só e os **três** do app têm de ser recalculados à mão — diferente do Gemini,
       que cobra por imagem e é cópia direta.
     - **13 de 14 estavam corretos.** Um errado: `openai/gpt-oss-120b` (Groq) estava com saída
       **0,75** e o correto é **0,60**.
     - **`gpt-5-nano` (0,05/0,40) entrou no catálogo** e vale registrar por quê: ele custa
       **R$ 0,0040 por card analisado contra R$ 0,0044 do `deepseek-v4-flash`** — ou seja, o
       modelo mais barato da OpenAI é HOJE mais barato que o DeepSeek para a carga deste app.
       O argumento de custo a favor do DeepSeek **deixou de existir**; a escolha passou a ser só
       de qualidade.
     - **ARMADILHA evitada na hora**: `settings.js` usa `P.modelos[0].id` como padrão de quem
       nunca escolheu modelo. Colocar o nano no topo da lista trocaria o padrão de todo mundo
       por um modelo pequeno — justamente o que solta regra em prompt longo, que é a batalha das
       rodadas 163–167. Ele entrou em SEGUNDO, com a nota "lote sim, análise não", e o comentário
       no código agora avisa que a ordem importa.
     - **Não adotados, mas anotados** (existem e são mais caros que os equivalentes já no
       catálogo): Gemini 3.x inteiro (3.1-flash-lite 0,25/1,50; 3.5-flash 1,50/9,00;
       3.6-flash 1,50/7,50 — a linha 3 é MAIS cara que a 2.5), `gpt-4.1-nano` (0,10/0,40,
       pior custo que o gpt-5-nano), `gpt-5.6-luna` e `gpt-5.4-nano` (0,20/1,20 e 0,20/1,25 —
       posteriores ao meu conhecimento, sem base para recomendar), `o3-mini`/`o4-mini`
       (1,10/4,40, modelos de raciocínio, caros para glosa).
     - Confirmado também o preço dinâmico do DeepSeek (**2× no horário de pico da China**,
       9h–12h e 14h–18h de Pequim) — o comentário já existia no código e continua válido.
     - Custo real de UM card analisado (~2.800 tokens de entrada, ~1.500 de saída, a US$ 5,40):
       llama-3.1-8b R$ 0,0014 · gpt-5-nano R$ 0,0040 · deepseek-v4-flash R$ 0,0044 ·
       gemini-2.5-flash-lite R$ 0,0048 · gpt-4o-mini R$ 0,0071 · gpt-4.1-mini R$ 0,0190.

167. **AS REGRAS LEXICAIS VIRARAM UMA FONTE ÚNICA — `promptRegrasLexicais()` (80ª rodada)**.
     Pedido do Djemeson: "faça uma varredura em todo o projeto e crie todas as normas para que
     o DeepSeek não cometa nenhum erro nunca mais". Honestidade primeiro: **"nunca mais" não
     existe com modelo barato via prompt** — o que existe é (a) regra centralizada que não
     diverge e (b) validação no CÓDIGO que pega o erro quando ele vem. Os dois foram feitos.
     - **O diagnóstico da varredura** (24 pontos de chamada de IA inventariados): as regras
       viviam espalhadas em 9 prompts, cada um com a própria cópia — e cópia diverge. Foi assim
       que a triagem disse "perder o interesse" enquanto a Lexa dizia "cansar-se".
     - **A fonte única**: `promptRegrasLexicais(langCode, modo)` em `js/lang.js` (não-lazy, onde
       já vivem os helpers de prompt). Três modos, porque o teto de atenção de modelo barato é
       curto e cada prompt deve receber SÓ o que precisa:
       · `'traducao'` (4 regras): anti-literal ("get you in"), domínio ("barrel"→cano, nunca
         barril, sem hedge), teste de substituição, auto-checagem exemplos×domínio.
       · `'glosa'` (+2): forma de citação ("began"→começar) e determinante+substantivo nunca é
         unidade.
       · `'analise'` (+1): GRAMMAR BEFORE DICTIONARY com o exemplo contrastivo do "does".
       Cada regra existe porque um modelo barato COMETEU aquele erro — e cada uma carrega o
       exemplo contrastivo (o formato que modelo fraco respeita).
     - **Onde foi injetada** (9 prompts): análise e triagem do Revisar, lote do Kindle e da
       Mídia (`add.js`), card-da-cena (`video-study.js`, com guarda `typeof` — módulo lazy pode
       chegar antes de um lang.js novo), legenda em tempo real (`video-subs.js`, idem),
       regenerar exemplo (`study.js`, idem), extrator do Assistente (`consulta.js`) e
       `lexaExplicar()` (`ai.js`). Na extensão é CÓPIA marcada (`background.js` não enxerga o
       app): mudou em lang.js, muda lá.
     - **A rede de segurança no código** (`_redeGramatical` em review.js): se o alvo é
       palavra-função do inglês (do/does/have/to/that/it/there…, 27 itens) COM contexto e a
       análise voltou sem NENHUM significado `gramatical:true`, repete UMA vez com a correção
       como system; se ainda vier errada, mantém com aviso no console — nunca bloqueia o aluno.
       Testado nos 4 caminhos: palavra comum não repete, `does` errado repete e adota a
       correção, falha dupla mantém a original, `does` já certo não repete.
     - **Regra de manutenção para o futuro**: erro novo do modelo = exemplo contrastivo novo em
       `promptRegrasLexicais`, NUNCA regra avulsa num prompt individual. Se a classe de erro
       for verificável por código, também entra na rede (padrão `_redeGramatical`).
     - `CACHE` → **v102** (lang.js/ai.js/consulta.js são do shell). ⚠️ Prompts novos não
       testados com o DeepSeek real (ambiente sem chave) — os 3 casos da pendência continuam
       valendo como prova final.

157. **Busca de imagem no menu de seleção** (pedido junto): quarto botão da fileira de baixo,
     abrindo a aba de imagens do Google no idioma do livro (`tbm=isch&hl=…`). É o complemento
     natural da Wikipédia: para objeto, planta, roupa, arma ou bicho, a foto ensina o que a
     definição não ensina — e custa zero token. No celular os quatro botões quebram em duas
     linhas de dois (44% cada), com 40px de altura.

### Sessão 2026-08-05 (77ª rodada) — A PONTE COM O KINDLE

**Pedido do Djemeson**: "é possível fazer uma ponte entre o Kindle e o nosso projeto? a cada
nova marcação em uma palavra desconhecida no livro que estou lendo seria enviado pro Revisar…
verifique também os livros adicionados como documento pelo usuário".

**O que a realidade permite** (pesquisado antes de codar, e vale registrar porque limita o
desenho): o Kindle de e-ink **não fala com a rede** — a Amazon não publica as consultas do
Vocabulary Builder por API. Não existe "tempo real" a partir do aparelho, e nenhuma extensão
muda isso. O que existe são três portas, e o projeto passou a usar as três:

| Porta | O que traz | Documento pessoal? |
|---|---|---|
| `system/vocabulary/vocab.db` (USB) | toda palavra **consultada** + a **frase inteira** + livro + data | ❌ o Vocabulary Builder da Amazon só grava em livro comprado |
| `documents/My Clippings.txt` (USB) | todo **destaque** feito com o dedo | ✅ é o caminho dos arquivos do usuário |
| `read.amazon.com` (extensão) | palavra **selecionada** + frase da página, na hora | ✅ a captura é nossa, não da Amazon |

139. **Leitor de SQLite escrito à mão — `js/kindle-db.js` (novo)**. O `vocab.db` é um SQLite
     binário. A saída óbvia seria o `sql.js`, mas são ~1,5 MB de WASM baixados para ler quatro
     tabelinhas num projeto que é "sem build". Como só precisamos de **varredura completa de
     tabela** (nada de índice, JOIN, WHERE ou escrita), o formato do arquivo cabe em ~250
     linhas: cabeçalho de 100 bytes, `sqlite_master`, b-tree de tabela (páginas folha `0x0D` e
     interiores `0x05`), registros com *serial types* e **cadeia de páginas de overflow** (a
     frase de uso do Kindle é longa e cai nesse caso com frequência).
     Validado com fixtures geradas em Python: páginas de **4096 e 512 bytes**, encoding
     **UTF-8 e UTF-16**, frase de 6,7 KB atravessando páginas de overflow, acentuação, b-tree
     com nível interior, e conferência de que nenhuma célula é lida duas vezes.

140. **`parseKindleVocabDb()` em `add.js`**. Junta `LOOKUPS × WORDS × BOOK_INFO` e devolve item
     pronto: **`stem` como objeto de estudo** (é a forma de citação — o mesmo lema que o resto
     do app usa como título de card), `usage` como contexto, título do livro como fonte, autor
     como subtítulo, idioma vindo de `WORDS.lang`. Três filtros na entrada:
     - **incremental**: cada consulta tem id (`LOOKUPS.id`) — o que já entrou uma vez não volta;
     - **palavra já conhecida/ignorada** (Gerenciador de Palavras) não vira card;
     - **mesma palavra consultada N vezes** vira **um** item, com a frase mais informativa e o
       selo "consultada N×" — repetir a consulta é o próprio Kindle dizendo que ela não colou.

141. **Formato detectado pelos BYTES, não pela extensão**. `handleKindleFile` lê os 16 primeiros
     bytes e procura `SQLite format 3`. Ler um binário como texto devolveria lixo em silêncio.

142. **`My Clippings.txt` reescrito** (é a porta dos documentos pessoais): BOM do Kindle não
     gruda mais no título do primeiro livro; **nota e marcador em português** (e alemão/francês)
     passaram a ser descartados — antes só `note`/`bookmark` em inglês eram reconhecidos, então
     num Kindle em pt-BR "Sua nota" entrava como se fosse vocabulário; destaque repetido
     (reajustar o destaque no aparelho regrava o bloco) entra uma vez só; e **destaque curto
     (≤3 palavras) já nasce com a palavra-alvo** — não gasta IA para descobrir o que você marcou.

143. **Captura ao vivo no Kindle Cloud Reader — `extension/kindle.js` + `kindle.css` (novos)**.
     Content script em `read.amazon.com` com `all_frames: true` (o leitor desenha o livro dentro
     de um iframe). Selecionou → pílula com **Revisar** / **frase** / **auto**. O modo **auto**
     é o que entrega o pedido literal: toda palavra selecionada vai sozinha para a fila, com
     "desfazer" de 4 s. O alvo e o contexto são **congelados no instante da seleção** (o leitor
     repagina sozinho — mesma lição da 67ª rodada na Netflix). A frase sai do parágrafo
     reconstruído (o leitor quebra o texto em dezenas de `<span>`, um por linha desenhada).

144. **A ponte deixou de ser só da Netflix (causa raiz)**. `_englabReceber` em `core.js` fixava
     `source_type:'series'` e título `'Netflix'` — toda captura de livro entraria como "série".
     Agora o tipo e o idioma vêm de quem capturou, com um registro `_EXT_FONTES` para o rótulo
     do toast. Extensão **3.0.0**, renomeada para "Language Lab — Netflix e Kindle".

145. **O que a mudança podia quebrar — e foi corrigido junto**:
     - **`firebase.js` chamava `kindleHighlightHash`/`loadKindleSeen`, que moravam no `add.js`
       lazy** (armadilha nº 1). Todo o histórico do Kindle mudou para `core.js`.
     - **O histórico não sincronizava**: importar o `vocab.db` no PC e abrir o Lab no celular
       traria tudo de novo. Passou a ser o doc `kindleSeen` no Firestore, com merge por
       **UNIÃO** (exceção consciente à regra "a nuvem substitui": desfazer uma marca de "já
       importei" ressuscitaria centenas de itens), teto de 30 mil marcas e entrada no
       Exportar/Importar JSON.
     - **"Limpar histórico Kindle"** ficaria inútil com a união — agora ele grava lista vazia e
       **empurra na hora**, antes que o próximo snapshot devolvesse tudo.
     - **Chave de identidade do item**: o hash antigo era do texto truncado em 200 caracteres —
       duas palavras consultadas na MESMA frase colidiam e a segunda sumia calada. Item de
       `vocab.db` usa o id da consulta. Para destaques o hash antigo foi mantido de propósito
       (mudá-lo faria o histórico existente perder a validade).
     - **`analyzeKindleItems` pedia `vocab` no prompt e lia `item` na resposta** — o campo nunca
       chegava, então o chip ficava em "analisando…" para sempre e a triagem automática de
       expressões nunca acontecia. Corrigido, com a garantia de que a IA **não sobrescreve** um
       alvo que já veio do `vocab.db`.
     - Item que só tem palavra (sem frase) mandava string vazia para a IA traduzir.
     - `sw.js`: `kindle-db.js` entrou na regra *network-first* dos módulos lazy.

### Sessão 2026-08-05 (78ª rodada) — Fechando o que a 76ª deixou aberto

> Nota de numeração: as rodadas 76ª (podcasts) e 77ª (Kindle) foram escritas por sessões
> **simultâneas** na mesma pasta e acabaram reusando os números 139–141. A partir daqui a
> contagem segue limpa em 146.

146. **"Seus podcasts" agora sincroniza.** O estado saiu do lazy `video-podcast.js` e virou
     **`podShows` em `core.js`** (mesmo motivo de `videos`/`clips`/`conversas`: `firebase.js` é
     não-lazy e não pode depender de módulo lazy — armadilha nº 1). Doc próprio
     **`data/podShows`** no Firestore, com **adoção da nuvem** (como `videos`), então **tirar um
     programa num aparelho o tira em todos**. `addedAt` é preservado ao revisitar um programa —
     revisitar não pode "envelhecer" o registro do outro aparelho. Entrou também no
     **Exportar/Importar JSON** (na importação o merge é por **união** de `feedUrl`: backup é
     complemento, não substituição).

147. **Espaço em disco visível** (Configurações → Dados locais → "Espaço usado neste aparelho"):
     episódios de podcast baixados, áudio consertado pelo ffmpeg e o **total do navegador**
     (`navigator.storage.estimate()`), com botão para liberar cada grupo. Medido ao vivo:
     "1 arquivo · 32 MB" e "64 MB de 1,4 GB disponíveis".
     - O tamanho vem do **próprio Blob no cursor do IndexedDB**: lá o Blob é uma referência de
       arquivo, então ler `.size` **não carrega os bytes** — `getAll()` traria centenas de MB
       para a memória só para somar.
     - `settings.js` é não-lazy: abre o `el-video-db` **sem versão** (só lê o que existe) em vez
       de usar o `VideoDB` do `video.js`.
     - Liberar não perde nada do estudo — testado: apaguei os 32 MB e a entrada do episódio,
       a legenda e os cards continuaram.

148. **Bug achado de passagem em "Apagar todos os dados"** (existia desde antes do podcast): o
     passo 3 zerava só `words`/`srsCards`/`srsLog`, mas o passo 4 chama `fbPushData()`, que grava
     **a memória**. Resultado: a função limpava o disco e em seguida **RE-ENVIAVA** vídeos,
     cortes, conversas e palavras conhecidas para a nuvem — que voltavam no snapshot seguinte.
     Agora o passo 3 zera tudo o que o push envia (`videos`, `clips`, `conversas`,
     `kindleItems`, `knownWords`, `ignoredWords` e `podShows`). Validado ao vivo: com estado
     plantado nas 7 variáveis, todas voltaram vazias.

149. **Sync validado sem servidor**: `applyCloudDocs` chamado à mão — adota a lista da nuvem,
     lista vazia propaga a exclusão e doc ausente **não** apaga o local. `sw.js` v92 → **v93**.
     Fica pendente só o teste em 2 aparelhos de verdade.

### Sessão 2026-08-05 (76ª rodada) — PODCASTS: um agregador dentro do módulo Vídeo

138. **Pedido do Djemeson**: "dá para pegar um agregador de podcasts e trazer pro projeto? eu
     escolheria o episódio e usaríamos todas as ferramentas que já temos". A decisão de projeto
     foi essa mesma: **nada de pipeline paralelo**. O episódio entra como um arquivo comum e cai
     no player de sempre — legenda, régua de falas, PT legenda/PT IA, névoa, Explicar, seleção
     na legenda, marcadores, estudo focado, ditado, shadowing e card com o **áudio real da fala**.
     Novo arquivo: **`js/video-podcast.js`** (5º módulo do pacote lazy `video`).

139. **Como funciona (100% no navegador — nenhum serviço nosso, nenhuma chave nova)**:
     - **Busca** → API pública do Apple Podcasts (`itunes.apple.com/search`), sem chave e com
       `Access-Control-Allow-Origin: *`. A **loja é escolhida pelo idioma ativo** (en→US, es→ES,
       fr→FR, pt→BR…), porque catálogo de podcast é regional.
     - **Episódios** → o **RSS do próprio programa**, lido com `DOMParser`. Foi verificado na
       rede real que os grandes hosts liberam CORS no feed: BBC, Megaphone, Simplecast, Libsyn,
       Fireside, RedCircle, Blubrry. **Plano B**: se o feed recusar, cai no
       `itunes.apple.com/lookup?entity=podcastEpisode`, que devolve os últimos ~200 episódios já
       com o link do áudio (testado forçando a falha do feed: 2779 episódios pelo RSS → 165 pelo
       plano B, com as mesmas URLs de áudio).
     - **Importar** → o mp3 é **baixado para o aparelho** com barra de progresso (streaming do
       `fetch` + `getReader`), guardado no IndexedDB (`el-video-db`, **store nova `files`**,
       versão 2→3) e entregue ao player como um `File`. A partir daí **nada mais sabe que veio
       de um podcast**: ffmpeg, Whisper e `captureStream` funcionam como sempre.
     - **Se o CDN bloquear o download** (CORS), o player toca **por streaming** (`_vidStream`),
       com `crossorigin="anonymous"` — o que preserva a gravação do áudio da cena quando o
       servidor permite. Se nem isso for aceito, o elemento recarrega sem o atributo e avisa o
       que se perde.
     - **Legenda de graça**: se o feed publicar `<podcast:transcript>` (Podcasting 2.0), a
       transcrição entra sem gastar IA. Suporta VTT/SRT (pelo `parseSubtitle` que já existia) e
       o JSON do PodcastIndex — este vem palavra a palavra, então é **agrupado em falas** de até
       8s quebrando na pontuação (senão o transcript viraria uma lista de palavras soltas).

140. **O que mudou no que já existia** (a varredura do "olhar para o horizonte"):
     - `videoOpen()` — podcast **nunca pede arquivo ao usuário**: usa o blob guardado ou baixa de
       novo pela URL do feed. Isso vale inclusive em **outro aparelho**: `videos[]` sincroniza
       pelo Firebase e o episódio se rebaixa sozinho lá (com vídeo local isso é impossível).
     - `_vidAutoSub()` — **não roda para podcast**: procurar um título de episódio no
       OpenSubtitles era chamada garantida ao vácuo.
     - Detector de áudio mudo / conserto Dolby — **pulado para podcast** (mp3 não tem o problema
       e o banner só faria ruído).
     - `videoTranscribeFull()` — em modo streaming não há bytes para mandar ao Whisper; a
       mensagem agora explica isso em vez do genérico "abra o vídeo primeiro".
     - `videoOpenPlayerBack()` e `_vidConsumePendingClip()` testavam só `_vidFile`; passaram a
       aceitar `_vidStream` (senão "rever a cena" caía na biblioteca).
     - `videoDelete()` — apaga também `files` e `media` (episódio de podcast é dezenas de MB;
       ficariam órfãos no disco).
     - **Palco de áudio refeito**: o `<video>` de um mp3 é só a barra de controles, e a legenda
       (`bottom:64px` do palco) caía **em cima** dos controles no palco de 110px. Agora o palco
       tem 236px, os controles descem para o rodapé e sobra a faixa de cima para a legenda + a
       capa do programa.
     - **`sw.js`**: o cache do shell pegava **qualquer** GET, inclusive de terceiros — o mp3 de
       33 MB e o RSS entrariam nele. Agora só entra no cache o que é **da mesma origem** (mais as
       fontes do Google); `itunes.apple.com` foi para `NETWORK_ONLY`. `CACHE` v91 → **v92**.
     - **"Liberar espaço"** (só para podcast): apaga o áudio baixado e **não perde nada** do
       estudo — legenda, marcadores, cortes e cards continuam, e o episódio volta quando for
       preciso. Testado: apaguei o arquivo, reabri, ele rebaixou e as 40 falas da legenda
       estavam intactas.
     - Cards criados a partir de um podcast já nascem com `source_type: 'podcast'` (os 4 pontos
       de `createWord` no `video-study.js` usam `_vidCur.source_type`), então o Dashboard e o
       ícone de fonte (mic) já os classificam certo — sem nenhuma mudança lá.

141. **Testes ao vivo** (localhost:8766, rede real): busca "All Ears English" → 3 programas;
     feed do programa → **2779 episódios** com título, data, duração e URL; import → **33,4 MB
     baixados em 3,7s**, player abre em modo áudio com a capa, duração 1042s batendo com o feed;
     reabrir da biblioteca → **815ms sem rede**; `captureStream` + `MediaRecorder` no episódio →
     **19 KB de áudio real gravados** (o card com a voz do apresentador funciona); modo streaming
     forçado → toca, duração lê, legenda preservada, "Liberar espaço" some do cabeçalho.
     Parsers validados com feed sintético: `itunes:duration` "1:02:03" → 3723s, `http://` →
     `https://` (conteúdo misto), `<podcast:transcript>` VTT preferido ao JSON, e o JSON
     palavra-a-palavra virando "Hello there." / "How are you?".
     Achado de passagem corrigido: `.pod-show-x` usava `var(--danger)`, que **não existe** no
     projeto (é `--error`) — exatamente a armadilha documentada na seção 10.

### Sessão 2026-08-05 (75ª rodada) — Os três acertos da seção
136. Djemeson mandou três prints (dois do nosso estado falho, um do Language Reactor como
     referência de organização). Três causas distintas:
     - **Controles do player no MEIO da cena**: `.watch-video--bottom-controls-container` é
       filho do player, que já tinha encolhido — a regra `bottom: var(--ll-dock)` somava o
       recuo DUAS vezes. Removida: agora os controles terminam exatamente no rodapé do vídeo.
     - **Cores**: a legenda verde-menta copiada do print do Language Reactor colidia com o
       significado que o teal já tem aqui (palavra conhecida/capturada). Voltaram as cores de
       sempre — fala em branco (`--ll-txt`), tradução em dourado (`--ll-pt`) — e o teal ficou
       reservado ao seu papel. De graça: um fio discreto separando fala e tradução, como na
       referência.
     - **Área da legenda vazia**: silêncio entre falas e "não há legenda nenhuma" pareciam a
       mesma coisa. Agora, após 5s sem cue e sem legenda no DOM, a seção explica o que fazer —
       e detecta o **Language Reactor ativo na aba**, que também intercepta a legenda da
       Netflix, citando-o como causa provável. No modo flutuante, a pílula de fundo some
       quando não há texto (antes ficava um retângulo escuro boiando na cena).
137. **Achado de passagem**: ao LIGAR o PT, `pintarPT()` só era chamado no ramo do desligar —
     o espaço da tradução só era reservado quando a IA respondia, e o painel crescia. Agora
     pinta antes de pedir a tradução. Altura medida: 175px com e sem PT.
     `manifest`: 2.9.0 → **2.9.1**.

### Sessão 2026-08-04 (74ª rodada) — A extensão ganha uma SEÇÃO abaixo do vídeo (modo doca)
135. **Diagnóstico do Djemeson** (com dois prints de referência): "o painel fica sobre o
     vídeo; se passo o mouse ele sobe para não cobrir a barra de progresso, mas fica em cima
     da cena — isso causa confusão". Proposta dele: **duas áreas isoladas**, com a seção
     abaixo do vídeo, e um modo minimizado em que as legendas voltam a flutuar bonitas.
     - **Modo DOCA (padrão)**: `html.englab-dock` encolhe o `<video>` e os containers do
       player (`.watch-video`, `--player-view`, `video-canvas`) e desloca os controles do
       player para cima da seção. A seção ocupa a faixa inferior inteira, com a legenda EN
       em verde-menta e destaque maior (é a protagonista ali), a tradução em branco e a
       régua de falas na base.
     - **Reserva MEDIDA, não fixa**: com altura fixa a seção estourava e voltava a cobrir a
       cena (25px de sobreposição no primeiro teste). Agora a seção tem altura natural e um
       **ResizeObserver** informa a medida real para a reserva do vídeo — acompanha o modo
       PT, o texto de duas linhas e o redimensionamento da janela. Encaixe medido: exato.
     - **Modo FLUTUANTE (minimizado)**: só as legendas sobre a cena, cada uma com seu fundo
       translúcido arredondado (como no print), e os controles/régua aparecendo no hover.
     - O "subir para fugir dos controles" (72ª) só vale no modo flutuante — na doca não há
       sobreposição para evitar.
     - Validado: vídeo encolhe, fundo do vídeo = topo da seção (545=545), controles do
       player livres acima da seção, alternância nos dois sentidos, cor/tipografia conforme
       as imagens. `manifest`: 2.8.1 → **2.9.0**.

### Sessão 2026-08-04 (73ª rodada) — Painel com altura realmente constante
134. **"O painel sem legenda é um tamanho e quando a legenda aparece ele cresce um
     pouquinho"**. Duas causas somadas:
     - A linha de **tradução usava `display:none`** quando não havia PT: o painel encolhia e
       voltava a crescer quando a fala chegava. Agora, com o modo PT ligado, ela **sempre
       ocupa o lugar** (classe `englab-tem-pt` no próprio bar); só o conteúdo fica invisível.
     - Sobrou 1px de diferença: `min-height` (1,30em vazia) contra a altura real do texto
       (1,35em). Resolvido com **altura FIXA de 2 linhas** para a tradução — constante em
       qualquer caso e ainda cabe tradução de duas linhas sem cortar. A linha EN vazia
       também ganhou um espaço inquebrável (`:empty::before`) para não colapsar.
     - **Horizonte — bug achado no teste**: a barra só era criada quando um texto MUDAVA,
       então um vídeo que **começasse em silêncio** ficava sem barra (e sem os botões de
       navegação). Agora ela nasce assim que há player, mesmo calado.
     - Medido: **136px** (PT desligado) e **182px** (PT ligado) — idênticos no silêncio, com
       fala curta e com fala longa. `manifest`: 2.8.0 → **2.8.1**.

### Sessão 2026-08-04 (72ª rodada) — Layout da barra: espaços colados, proporção e controles
133. **Cinco sintomas do Djemeson, uma causa central**: "There'sajuvenile.Whitemale" — as
     palavras saíram **coladas**, o texto ficou desproporcional, invadiu os botões e a
     formatação se desmontou (`8"` e `70` empilhados).
     - **Causa raiz**: na 69ª rodada, ao reservar 2 linhas, dei `display:flex` à
       `.englab-line`. Num container flex, cada `<span>` de palavra vira um flex item e os
       **nós de texto com os espaços são descartados** — daí as palavras grudadas e o
       empilhamento estranho. A linha voltou a ser `display:block` (o comentário no CSS
       registra o porquê, para ninguém "consertar" de volta); a reserva de 2 linhas passou
       para o `.englab-mid` (coluna flex), que não contém texto solto.
     - **Proporção**: fonte reduzida (clamp 15→23px no EN, 13→17px no PT), `line-height`
       mais justo, `overflow-wrap` e teto de 2 linhas com `overflow:hidden` — o texto nunca
       mais empurra os botões.
     - **Barra cobrindo a barra de progresso**: a extensão agora acompanha o ritmo do
       player — ao mover o mouse (ou teclar), os controles da Netflix aparecem e a barra
       **sobe** (9% → 22%), voltando sozinha após 3,6s de quietude. O popup de seleção
       acompanha. Medido: sobe 94px e libera os controles.
     - Validado com as legendas EXATAS dos prints: espaços preservados, texto dentro dos
       limites (não invade nav nem ferramentas), tamanho estável entre falas curtas e
       longas (1074×136). `manifest`: 2.7.0 → **2.8.0**.

### Sessão 2026-08-04 (71ª rodada) — Capturas da extensão sumiam ao recarregar o Lab
132. **Relato**: as capturas apareciam no Revisar, mas desapareciam ao recarregar a página.
     Duas causas independentes, ambas corrigidas:
     - **Corrida na inicialização**: `window.__englabReady = true` estava no TOPO do core.js
       (primeiro script), mas `words` só é preenchido em `loadWords()`, lá no `initApp`.
       Se a entrega chegasse nessa janela, `createWord` empilhava num array vazio e o
       `saveWords()` seguinte gravava **só as capturas** — e o `loadWords()` posterior
       sobrescrevia tudo. Agora o sinal é ligado por **`englabAppPronto()`** no fim do
       `initApp`, e capturas que chegam antes ficam numa **fila** (`_extFila`), processadas
       assim que o app fica pronto. **O ack só sai quando o recebimento é real** — se o app
       não estiver pronto, a extensão mantém a fila dela e tenta de novo.
     - **Faltava sincronizar**: o listener criava as palavras e salvava no localStorage, mas
       NÃO chamava `autoSyncAfterChange()`. Como a nuvem é a fonte da verdade
       (`applyCloudDocs` faz `words = docs.words.list`), o snapshot seguinte do Firestore
       **apagava** as capturas. Agora sobe junto.
     - **Horizonte**: o mesmo padrão (criar palavra sem sincronizar) foi conferido nos
       outros pontos que criam itens — Raio-X/triagem e gerenciador de Palavras já chamavam
       o sync; ficou consistente.
     - Validado com a corrida real: entrega disparada no instante do load (app com 0
       palavras carregadas) → item enfileirado, processado ao ficar pronto, gravado no
       localStorage e **sobreviveu ao recarregamento**. `sw`: v90 → **v91**.

### Sessão 2026-08-04 (70ª rodada) — Sessão por título na Netflix + a REGRA DO HORIZONTE
130. **Bug**: sair de um título para o menu deixava o painel ativo; ao entrar em outro, a
     legenda era a do anterior ou vinha dessincronizada. Causa: a Netflix é uma SPA — trocar
     de episódio **não recarrega a página**, então `cues` (que são unidos por segmento)
     acumulavam de dois títulos diferentes.
     - **Sessão por título**: o relógio vigia `/watch/<id>`; ao mudar, `resetarSessao()`
       limpa cues, cache PT, pendências, histórico, régua, transcript, popup e as flags de
       pausa. Fora do player (menu/busca), a barra **some** e a legenda nativa é liberada.
     - **Horizonte 1 — troca de IDIOMA no mesmo título**: também traz cues novos; se ocupam
       os mesmos tempos com textos diferentes, é OUTRA trilha → substitui em vez de unir
       (senão dois idiomas se misturam na tela). Limiar de 2 colisões com <50% de textos
       iguais, para funcionar já no começo do episódio.
     - **Horizonte 2 — o mesmo defeito no Lab**: trocar de vídeo na biblioteca deixaria a
       régua deslizando com os tempos do vídeo anterior. `videoOpenPlayer` agora zera o
       estado da régua.
     - **Horizonte 3 — bug latente encontrado de passagem**: `js/settings.js` tinha um
       **`async` órfão** numa linha sozinha (sobra de patch antigo). O JS o lia como
       variável e lançava `ReferenceError` a cada avaliação do arquivo, abortando qualquer
       código no fim dele. Removido.
     - Validado: título 1 → menu (barra some, nativa liberada) → título 2 (zerado, sem
       mistura); troca de idioma substitui; segmento novo une; reenvio não duplica.
     `manifest`: 2.6.0 → **2.7.0**; `sw`: v89 → **v90**.
131. **REGRA PERMANENTE — "olhar para o horizonte"** (pedido do Djemeson): toda
     implementação, ajuste ou correção deve percorrer causa raiz, onde mais o padrão existe,
     o que a mudança pode quebrar, casos vizinhos que ainda vão acontecer e o que fica melhor
     de graça — relatando o que foi verificado além do pedido. Gravada em
     **`~/.claude/CLAUDE.md`** (vale para todos os projetos, inclusive os que ainda serão
     criados) e replicada nos CLAUDE.md de `english-lab-2.0` e
     `claude-gerenciador-de-projetos`. Os projetos sem CLAUDE.md ficam cobertos pelo global.

### Sessão 2026-08-04 (69ª rodada) — Painel de tamanho fixo e régua deslizante
129. **Dois refinamentos pedidos**:
     - **Painel mudava de tamanho a cada fala**. Pesquisa do teto real: o padrão de
       legendagem (Netflix inclusive) é **42 caracteres por linha, no máximo 2 linhas**.
       A barra passou a ter largura FIXA por esse teto (`min(1040px, 92vw)`), a linha EN
       reserva **2 linhas** (`min-height: 2.8em`, centralizada) e a PT reserva 1 —
       nada mais "pula". Medido: 1074×154px tanto com "Ok." quanto com uma legenda no
       limite.
     - **Régua suave/macia**: a versão anterior REPINTAVA o HTML a cada 0,25s (movimento
       aos saltos). Agora o trilho é montado UMA vez em pixels (bloco de 300s) e apenas
       **desliza** via `translate3d` dentro de um `requestAnimationFrame`, com
       `will-change: transform`; o destaque da fala corrente só toca no DOM quando muda de
       bloco, e há remontagem automática ao chegar perto da borda. Máscara em degradê nas
       pontas para o trilho parecer entrar/sair em vez de ser cortado.
     - Aplicado nos DOIS: extensão (`.englab-rtrack`) e vídeo do Lab (`.vid-rtrack`, com o
       loop se encerrando sozinho quando o player sai do DOM).
     - Validado: deslocamento de **8px a cada 0,5s** (16px/s exatos, sem salto), destaque
       correto, remontagem ao se aproximar da borda, clique ainda levando ao instante certo
       (19,85s para a fala de 20s). Nota: `requestAnimationFrame` não avança em aba sem
       composição, então o loop foi exercitado manualmente no teste.
     `manifest`: 2.5.0 → **2.6.0**; `sw`: v88 → **v89**.

### Sessão 2026-08-04 (68ª rodada) — Régua de falas, barra persistente e PT em sincronia
128. **Três pedidos**, com um diagnóstico fino do Djemeson ("a legenda original está aqui e
     vai pra acolá, mas a tradução ainda está aqui"):
     - **Barra some no silêncio**: sem ela não dava para clicar em "voltar a última fala"
       justamente quando se precisa. Agora a barra fica SEMPRE visível (classe
       `englab-mudo`); só o texto fica vazio, e a navegação continua acessível.
     - **PT correndo atrás**: causa real — traduzíamos pelo ARQUIVO e exibíamos pelo DOM;
       quando os textos divergiam, o fallback mostrava a tradução da fala VIZINHA. Agora,
       quando o arquivo cobre o instante, a fala exibida vem do MESMO cue que foi traduzido
       (EN e PT trocam juntos); o DOM só entra no silêncio do arquivo ou quando não há
       arquivo. O fallback por índice ficou restrito ao caso em que o texto exibido é
       comprovadamente o do cue corrente.
     - **RÉGUA DE FALAS** (ideia do Djemeson, com print de referência): faixa onde cada
       bloco é uma fala, largura proporcional à duração e vão = silêncio; janela deslizante
       de 60s centrada no agora, fala corrente destacada, marcador do instante e clique que
       leva ao início daquela fala. Implementada na **extensão** (`.englab-rule`) e no
       **vídeo do Lab** (`.vid-rule`, sob o player), com a mesma linguagem visual.
     - Validado no simulador: 4 falas com silêncio → larguras proporcionais (3s→5%,
       5s→8,33%), bloco atual destacado, marcador presente; no silêncio a barra continua e
       o "fala anterior" funciona; EN e PT trocam juntos em 11s/15s/27s; clique na régua
       levou a 30,85s (fala de 31s). `manifest`: 2.4.0 → **2.5.0**; `sw`: v87 → **v88**.

### Sessão 2026-08-04 (67ª rodada) — Contexto errado na captura e legenda PT que não aparecia
127. **Dois relatos, ambos com diagnóstico certeiro do Djemeson**:
     - **Frase de origem errada**: ele selecionava (o vídeo pausava pelo hover), arrastava o
       mouse até o popup — que fica FORA da barra — o `mouseleave` retomava o vídeo, e ao
       clicar em "Estudar" o `ultimoTexto` já era outra fala. Correções: o contexto é
       **congelado no instante da seleção** (`popCtx`), a barra **não retoma o vídeo
       enquanto o popup estiver aberto**, e o popup pausa ao abrir e retoma ao fechar.
     - **Tradução quase nunca aparecia (DeepSeek)**: causa estrutural — o cache era indexado
       pelo **texto cru**, e o texto que o player DESENHA quase nunca é idêntico ao do
       ARQUIVO TTML (itálico, `…` vs `...`, símbolos, espaços). A tradução era feita e
       jogada fora. Agora a chave é normalizada (`chavePT`: só letras/números) e há
       fallback pela fala corrente do arquivo. Além disso: janela de antecedência **30s →
       90s** e blocos de 4 → 6 (o DeepSeek é mais lento), e um indicador discreto ("...")
       enquanto a tradução não chega, para não parecer quebrado.
     - Validado no simulador: arquivo com `…` unicode e tela com `<i>...</i>` → tradução
       exibida; contexto congelado sobreviveu à fala mudando na tela para outra completamente
       diferente; pausa ao selecionar, mantida a caminho do popup, retomada ao fechar.
     `manifest`: 2.3.0 → **2.4.0**.

### Sessão 2026-08-04 (66ª rodada) — Capturas que não chegavam e seleção de trecho travada
126. **Dois defeitos relatados**: as palavras marcadas não chegavam ao Lab (nem com ele
     aberto, nem pelo botão da extensão — "a página é acionada mas as palavras não vêm") e
     na Netflix "só dá para clicar na palavra, não dá para selecionar um trecho".
     - **Entrega**: erro de desenho meu. O botão apenas FOCAVA a aba do Lab — e se aquela
       aba tinha uma **ponte órfã** (extensão recarregada depois de a aba abrir), ninguém
       entregava nada. Agora o popup **injeta o script de entrega na hora**
       (`chrome.scripting.executeScript`, permissão `scripting` + host das URLs do app):
       funciona mesmo em aba órfã. O app marca `window.__englabReady`; o injetado só limpa
       a fila se esse sinal existir, e se o app não responder o popup **recarrega a aba e
       tenta de novo**, com status visível ("2 entregues!"). Sem Lab aberto, abre uma aba
       nova (a ponte entrega no load, como antes).
     - **Seleção**: o player da Netflix aplica `user-select: none` nos containers — nossa
       barra herdava e o arraste não selecionava nada. CSS agora libera
       `user-select: text !important` só na barra/popup/transcript. Além disso, o clique
       que capturava a palavra atrapalhava o arraste: agora medimos o deslocamento entre
       mousedown e mouseup (>4px = arraste, não captura) e o `mouseup` fora da linha
       também abre o popup Explicar/Estudar.
     - Validado em dois simuladores: (a) player com `user-select:none` — seleção liberada
       só na barra, arrastar abre Explicar/Estudar sem capturar palavra solta, clique
       simples captura; (b) popup com aba de ponte órfã — injetou, viu que não respondeu,
       recarregou, injetou de novo, 2 capturas entregues e fila limpa.
     `manifest`: 2.2.0 → **2.3.0**; `sw`: v86 → **v87** (o app ganhou `__englabReady`).

### Sessão 2026-08-04 (65ª rodada) — Fim da classe de erro: promessas no lugar de callbacks
125. **O erro apareceu pela 3ª vez**, já com o código 2.1.2 no print. Duas conclusões:
     - **Parte do que ele via era HISTÓRICO**: o Chrome acumula erros em
       `chrome://extensions` até a lixeira ser clicada, e exibe o **código atual** no
       trecho — por isso o print mostrava a linha 9 com o comentário novo, embora o erro
       tivesse sido gerado pela versão anterior numa aba órfã. Documentado no README com o
       procedimento de verificação (recarregar → F5 nas abas → limpar erros → usar).
     - **A causa estrutural**: com CALLBACK, a falha de contexto estoura DENTRO do Chrome e
       não há como capturar. A correção definitiva foi trocar todo `chrome.*` por
       **promessas** (MV3 suporta) com `.catch()` — falha vira rejeição tratada, nunca
       "Uncaught". `pedir()` (bridge) e `pedirExt()` (netflix) são os únicos pontos de
       contato; `cbExt/comExt` foram removidos (0 ocorrências). O listener de
       `storage.onChanged` agora é removido ao aposentar.
     - Validado com chrome falso no formato MV3 (storage retornando promessa que REJEITA
       quando morto), matando a extensão entre a chamada e a resolução: **zero erros**, e
       com vínculo bom a config e a URL continuam sendo espelhadas.
     `manifest`: 2.1.2 → **2.2.0**.

### Sessão 2026-08-04 (64ª rodada) — O erro persistiu: a lição estava no CALLBACK
124. **O mesmo erro voltou** depois da 63ª (o print mostrava o arquivo NOVO — linha 9 já era
     o comentário da blindagem). Diagnóstico correto desta vez:
     - `seguro()` protegia a CHAMADA (`chrome.storage.local.get(...)`), mas o **callback é
       assíncrono e roda fora daquele try/catch**. Dentro dele eu fazia
       `if (chrome.runtime.lastError)` — e **ler essa propriedade com o contexto morto já
       lança**. O throw acontecia num callback do Chrome, sem ninguém para pegar → "Uncaught
       Error: Extension context invalidated".
     - Correção: helpers **`cb()`/`cbExt()`** que embrulham TODO callback do `chrome.*`
       (try/catch em volta, inclusive na leitura do `lastError`), aplicados em bridge.js,
       netflix.js e popup.js. Mais duas **redes de segurança** (`window.onerror` e
       `unhandledrejection`) que engolem especificamente esse erro para ele não poluir a
       lista de Erros da extensão.
     - **Validado com um chrome falso mais cruel** que o da 63ª: `lastError` que EXPLODE ao
       ser lido e callbacks assíncronos (30ms), matando a extensão **entre a chamada e o
       callback** — zero erros, e o vínculo bom continua espelhando config e URL.
     `manifest`: 2.1.1 → **2.1.2**.

### Sessão 2026-08-04 (63ª rodada) — "Erros" na extensão: contexto invalidado + URL do app
123. **Print do Djemeson**: erro apontando `bridge.js` na aba
     `english-lab-seven.vercel.app`. Causa: ao ATUALIZAR a extensão (2.0 → 2.1), os content
     scripts das abas já abertas ficam órfãos — qualquer `chrome.*` lança
     **"Extension context invalidated"**. Não é bug de lógica, é ciclo de vida do Chrome,
     mas aparecia como erro vermelho e deixava a ponte muda sem avisar.
     - **Blindagem nos 3 content scripts**: helper `vivo()/seguro()` (bridge) e
       `extViva()/comExt()` (netflix) checam `chrome.runtime.id` antes de cada chamada,
       capturam a exceção e checam `chrome.runtime.lastError` nos callbacks. Quando o
       vínculo cai, a ponte **se aposenta** (remove listeners, limpa o timer, loga um
       aviso) e a barra da Netflix mostra "extensão atualizada — recarregue a página (F5)".
       `popup.js` idem (o `sendMessage` para aba antiga não gera mais erro).
     - **Ronda de 20s na ponte**: cobre config alterada com a aba já aberta e serve de
       sentinela para detectar a recarga da extensão.
     - **URL do app corrigida**: o popup abria `djemeson.github.io` fixo, mas o Djemeson usa
       a **Vercel**. Agora a ponte registra a URL real (`llapp`) e o botão foca uma aba já
       aberta do app; só cai no endereço padrão se não houver nenhuma.
     - Validado com um chrome falso que "morre" no meio: config espelhada, URL registrada,
       e **zero erros** após invalidar o contexto e disparar foco/ack/ciclo.
     `manifest`: 2.1.0 → **2.1.1**.

### Sessão 2026-08-04 (62ª rodada) — Extensão v2.1: o crash, as falas que sumiam e o acabamento
122. **Dois defeitos graves + pedido de acabamento**, todos resolvidos:
     - **CRASH da Netflix ao usar ‹‹ / ↺**: o `seek` fazia `video.currentTime = t`. O player
       alimenta o `<video>` por MSE/DRM — mexer no tempo por fora derruba o pipeline. Agora
       o inject.js usa a **API interna do player**
       (`netflix.appContext.state.playerApp.getAPI().videoPlayer`, seek em ms) e, se ela não
       existir, **não move nada** e avisa. Pause/play também passaram por lá.
     - **"Seções inteiras de fala não aparecem"**: a Netflix entrega a legenda em SEGMENTOS
       e o código fazia `cues = novos` a cada chegada — só o último pedaço sobrevivia. Agora
       é **união com dedupe** (tempo+texto). Mais: a exibição passou a ter o **DOM como
       fonte da verdade** (nunca perde uma fala, mesmo com arquivo incompleto/atrasado) e o
       arquivo serve para navegar, traduzir à frente e montar o transcript. Relógio de
       300ms → 120ms e observer reagindo em 40ms.
     - **Acabamento**: ícones SVG no lugar de caracteres (‹‹ ↺ ›› viraram desenhos), barra
       com vidro fosco de 18px, cantos de 16px, sombra profunda, grupos separados por
       filetes, botões de 32px com estados hover/active/on, tipografia de sistema, popup e
       transcript no mesmo idioma visual, animações de entrada, scrollbar estilizada.
     - **Achado de CSS**: transicionar o shorthand `background` deixava transição órfã
       travando a cor; trocado por `background-color`.
     - **Validado num simulador do player** (stub da API interna + detector de
       `currentTime`): 4 seeks, todos pela API, detector NUNCA disparou; dois segmentos de
       legenda somaram 4 falas (antes: 2); repetir foi ao início da frase; transcript com 4
       linhas navegáveis; popup Explicar respondendo; e todos os estados de cor conferidos.
       Nota do ambiente: a aba do preview não compõe frames, então transições ficam
       congeladas — as medições finais foram feitas com `transition:none`.

### Sessão 2026-08-04 (61ª rodada) — Extensão v2: as funções do módulo Vídeo dentro da Netflix
121. **Pedido**: "quero que a extensão tenha as mesmas funcionalidades do vídeo no site".
     A peça que destravou tudo: **interceptar o arquivo de legendas** (o DOM só entrega a
     fala do instante; o arquivo entrega o episódio inteiro com tempos).
     - **inject.js** (`world: MAIN`, document_start): hooka XHR e fetch, pega o TTML/DFXP
       que o player baixa, converte ticks→segundos (`ttp:tickRate`) e HH:MM:SS.mmm, achata
       `<span>`, e manda os cues ao content script. Também executa seek a pedido.
     - **background.js** (service worker): ÚNICO que fala com as APIs de IA — evita CORS da
       origem netflix.com e mantém chave fora da página. Traduz em lote (mesma âncora
       anti-literal do app) e explica seleção. Fornecedor/modelo/chave vêm espelhados.
     - **bridge.js** ganhou o 2º sentido: espelha `englab_cfg` (provedor + chaves) para
       `chrome.storage` quando o app abre — o Djemeson não digita chave na extensão.
     - **netflix.js** reescrito: barra com fala clicável + linha PT (com **névoa**),
       navegação **‹‹ ↺ ››** por GRUPO de falas (mesma regra do app: frase quebrada em
       várias legendas não parte no meio), popup de seleção com **Explicar** (pausa o
       vídeo, mesma proteção anti-colapso) e **Estudar**, **transcript** lateral clicável
       com busca e destaque da fala atual, atalhos `←/→/R/P/T`, e fallback pelo DOM
       (histórico de falas) quando o TTML não é capturado.
     - **Validado ao vivo** (lógica pura, sem Netflix): TTML real com namespaces → 5 cues,
       ticks 100000000t→10s, `<span>` achatado, HH:MM:SS.mmm=12.5s, lixo → null sem
       quebrar; agrupamento de frase partida `[0,0,2,3,3]`. **O player em si segue não
       testável daqui** (DRM/login) — teste real é do Djemeson.
120. **Pedido**: "crie a extensão pra usarmos na minha conta da netflix" (aprovando a
     análise da 58ª). Pasta **`/extension`** (Manifest V3, sem build):
     - **netflix.js**: MutationObserver no `.player-timedtext` (as legendas que a Netflix
       desenha no DOM — a mesma técnica do Language Reactor); re-renderiza a fala numa
       barra própria com CADA PALAVRA clicável; "+ frase" captura a fala inteira; botões
       cc (esconde a legenda nativa), ⏸ (pausa com o mouse na barra) e ×. Captura leva
       palavra + frase + título do episódio para `chrome.storage.local`.
     - **bridge.js** (roda no Pages/Vercel/localhost): entrega as capturas ao app por
       postMessage na abertura/foco/na hora (storage.onChanged) e limpa a fila no ack.
     - **core.js**: listener `englab-ext-captures` cria os itens no Revisar via
       `createWord` (frase sem palavra vira item-frase → ganha o Raio-X; dedupe por
       palavra+contexto; ack sempre). **Nenhuma chave de API na extensão.**
     - **popup**: contagem de pendências, últimas capturas, "Abrir o Language Lab",
       religar a barra, descartar fila. README com instalação (Carregar sem compactação).
     - **Validado ao vivo (lado do app)**: 3 capturas simuladas → 2 itens criados
       (duplicata ignorada), fonte/título corretos, frase virou item-frase, ack `got:3`,
       reenvio não duplica. **Lado Netflix NÃO testável daqui** (DRM/login) — seletor
       `.player-timedtext` é o padrão estável usado pelo LR; primeiro teste real é do
       Djemeson. `CACHE`: `v86` → **`v87`**.

### Sessão 2026-08-04 (59ª rodada) — Gerenciador visual de Palavras (estilo Language Reactor)
119. **Pedido**: "faça o gerenciador visual estilo Language Reactor pra deixar poderoso".
     Nova seção **Palavras** (`js/known.js`, lazy; nav próprio):
     - **Inventário do SEU material**, não lista genérica: `_knLevantar()` varre as legendas
       de todos os vídeos/podcasts (VideoDB subs), os contextos capturados e as frases dos
       cards — a frequência exibida é a do que o Djemeson assiste. Stop-words fora.
     - **4 status por cor**: conhecidas (verde), em estudo (primária), sugestões (neutra),
       não aprender (apagada/tracejada). Filtros com contador, "não aprender" oculto por
       padrão.
     - **Medidor de domínio**: % do material que já é conhecido/em estudo.
     - **Ações**: clique alterna conhecida; botões no hover mandam para o Revisar (cria a
       palavra com o contexto real) ou silenciam para sempre; **"marcar as N sugestões
       visíveis como conhecidas"** com confirmação — a varredura rápida que faz o LR ser
       eficiente. Busca, ordenação (frequência/alfabética) e paginação de 300 em 300.
     - **`ignoredWords`** (novo, core.js) + sync no mesmo doc `data/known` por união.
     - Validado ao vivo com episódio sintético: inventário montado, frequência real
       (ethos=3), status iniciais certos, contadores, medidor, ignorada oculta, marcar →
       verde + persistência, estudar → cria word e vira "em estudo", busca e filtros.
     `CACHE`: `v85` → **`v86`** (known.js entra na regra network-first dos lazy).

### Sessão 2026-08-04 (58ª rodada) — Pacote de 7 tarefas (4 executadas + 3 análises)
114. **Chip "ethos"**: triagem devolvia "Japanese ethos" (colocação) + "it's" (lixo A1).
     Regras novas no prompt: adjetivo+substantivo LIVRE não é colocação → devolver a
     PALAVRA notável ("ethos", C1); contrações/fillers ("it's", "you know") proibidos.
115. **Persona do Assistente**: `consultaSystem()` agora é o **Lex** — professor brasileiro
     que aprendeu com séries; direto, caloroso, humor seco, sem emojis, fecha com UMA
     provocação curta. Regras de formato/IPA/exemplos preservadas.
116. **PODCAST no módulo de vídeo**: os 4 pontos de abertura de arquivo aceitam áudio
     (.mp3/.m4a/.aac/.ogg/.opus/.wav/.flac); arquivo só-áudio ganha palco compacto
     (`.vid-stage.vid-audio`, player de 110px). TODO o resto já funciona igual: Criar
     legenda com IA (ffmpeg extrai de áudio também), PT IA, estudo focado, captura de
     áudio real, SRS.
117. **PALAVRAS CONHECIDAS (núcleo v1)** — pedido "completo e poderoso"; esta rodada
     entrega o motor, o gerenciador visual fica para a próxima:
     - core.js: `knownWords` (mapa palavra→ts em `el-known`), `knownNorm/isKnownWord`
       (flexões triviais s/es/ed/d/ing) e `markKnownWord`.
     - Alimentação automática: triagem do Raio-X (o que o aluno NÃO marcou vira conhecido,
       em `revBreakStudy`) e SRS (card com intervalo ≥ 21 dias marca a palavra, nos dois
       ramos de `rateSrsCard`).
     - Consumo: `_vidIsKnown` (cobertura do "Preparar para assistir") considera o módulo.
     - Sync: doc `data/known` no Firestore, adotado por UNIÃO (nunca perde marcas de outro
       aparelho). Validado ao vivo: normalização, flexão, persistência, remoção, triagem
       marcando não-selecionadas, selecionadas ficando de fora.
118. **Análises entregues (decisões para as próximas rodadas)**:
     - **Clipes de vídeo na revisão**: o Anki guarda mídia LOCALMENTE (collection.media) e
       sincroniza pelos servidores próprios (AnkiWeb) — lição: local-first. Firebase
       Storage exige plano Blaze (cartão) e cobra egress; alternativas com bom
       custo-benefício: **Cloudflare R2** (10 GB grátis, egress ZERO) > Backblaze B2.
       Recomendação: clipes no IndexedDB local (como o áudio de cena hoje — grátis,
       offline), nuvem opcional depois via R2. Implementação: captureStream com trilha de
       vídeo + <video> no card do SRS — próxima rodada.
     - **Addons de VÍDEO do Stremio**: os de legenda já estão integrados; os de stream
       devolvem majoritariamente torrents (infoHash — precisa de motor torrent; navegador
       não decodifica mkv/HEVC) ou links HTTP de debrid (tocáveis SE o CORS deixar).
       Viável parcialmente: suportar addons de stream HTTP direto; torrent no navegador
       não. Próximo passo: testar com um addon real do Djemeson.
     - **Netflix / Language Reactor**: IMPOSSÍVEL dentro do site (DRM + proibição de
       embed). O LR é uma EXTENSÃO de Chrome injetada no player. Caminho real: extensão
       própria reaproveitando conta Firebase + SRS (legendas capturadas do player, mesmo
       popup/triagem). É um mini-produto separado — a decidir.
     `CACHE`: `v84` → **`v85`**.

### Sessão 2026-08-04 (57ª rodada) — Triagem em camadas: o recorte também pode ter partes
113. **Ajuste do Djemeson sobre a 56ª**: o recorte escolhido PODE gerar novos chips ("um
     phrasal verb pode ter uma palavra isolada que eu não conheço") — mas só em cima do
     OBJETO DE ESTUDO, nunca da frase original. O `no_break` (56ª) era conservador demais.
     - **`no_break` removido** (prefetch, ehFrase, createWord): item criado pela triagem
       volta a ser triado normalmente. A fidelidade fica por conta de DUAS cercas em
       `_revBreakFetch`: (1) o filtro da 56ª — unidade tem de estar contida no objeto de
       estudo (o contexto continua indo no prompt só para o SENTIDO das glosas); (2) nova:
       o objeto INTEIRO nunca vira chip (`normB(expr) !== normB(alvo)` + regra no prompt
       "only its PARTS") — sub-triagem só mostra partes menores.
     - Validado ponta a ponta com stub desobediente: frase → recorte "get you in" criado →
       sub-triagem rodou SOBRE o recorte → devolveu o recorte inteiro + "for that" (da
       frase original) + "get" → só **"get"** sobrou como chip. Nota de fluxo: como a
       análise completa roda automaticamente, os sub-chips aparecem enquanto o item ainda
       está pendente; depois de analisado, o card mostra os significados (as camadas
       continuam disponíveis via seleção de texto/minerar). `CACHE`: `v83` → **`v84`**.

### Sessão 2026-08-04 (56ª rodada) — Triagem fiel ao objeto de estudo (dois bugs dos prints)
112. **Prints do Djemeson**: (a) itens criados PELA triagem ("I have yet to do", "All of
     which") eram triados de novo e decompunham o CONTEXTO — mostrando unidades que nem
     pertencem ao objeto de estudo; (b) "We'll get you in for that" trazia chips "Okay." e
     "Great.", que só existem na frase de contexto. Duas correções:
     - **Cinto e suspensório contra o contexto**: prompt reescrito ("Snippet to break down
       (ONLY this)" + "a frase em volta é só para entender o SENTIDO — nunca tire unidades
       dela") E filtro no código: `expr` normalizada (sem caixa/acento/pontuação) precisa
       estar contida no objeto de estudo com fronteira de palavra — modelo barato
       desobedece instrução, o filtro não. Validado com resposta suja de propósito
       ("Okay.", "Great.", "all of which") → só "get you in"/"for that" sobraram.
     - **`no_break` nasce COM o item** (campo do createWord, persistido): item criado pela
       triagem é um recorte já escolhido — nunca re-triar. A 1ª tentativa marcava a flag
       DEPOIS do createWord e perdia a corrida contra o prefetch (pego no teste ao vivo);
       agora vai no payload. Card desses itens também não mostra área de triagem.
     - Validado ponta a ponta: frase → chips filtrados → item criado com `no_break`, zero
       triagens extras, card do novo item limpo. `CACHE`: `v82` → **`v83`**.

### Sessão 2026-08-04 (55ª rodada) — Armadilha da tradução literal combatida em TODO o projeto
111. **Pedido**: "reforce a instrução em todo o projeto, levando em consideração modelos
     baratos" (gatilho: a triagem glosou "get you in" como "colocar você dentro" — literal
     — em vez de "a gente te encaixa"). Técnica calibrada para modelo econômico: nomear a
     armadilha ("LITERAL-TRANSLATION TRAP"), dar a ORDEM DE OPERAÇÃO ("primeiro entenda o
     que a expressão FAZ na cena, depois traduza essa função") e um EXEMPLO CONTRASTIVO
     (errado vs certo) — regra abstrata sozinha não segura modelo barato.
     - **7 prompts reforçados**: triagem do Raio-X (review.js), traduções de exemplos da
       análise (review.js) + o sentido do contexto ("nunca a leitura mais literal do
       dicionário"), reanálise em lote (audio.js), regenerar exemplo único (study.js),
       tradução de legendas do vídeo (`_VID_PT_SIS`, video-subs.js — "traduza o SENTIDO na
       cena, nunca palavra por palavra") e os dois lotes do add.js (Kindle e mídia).
     - Âncora comum em todos: "we'll get you in" → "a gente te encaixa", NUNCA "colocar
       você dentro" (o caso real do Djemeson vira o exemplo canônico do projeto).
     - Validado ao vivo: os prompts efetivamente ENVIADOS nos três fluxos principais
       (triagem, análise completa, lote de legenda) carregam o reforço; duas passadas de
       verificação porque o OneDrive serviu audio.js/review.js velhos na primeira.
       `CACHE`: `v81` → **`v82`**.

### Sessão 2026-08-04 (54ª rodada) — A faxina KonMari alcança o Raio-X da frase
110. **Pergunta do Djemeson**: "ficou muito bom, mas essa parte você analisou sob a ótica da
     Marie Kondo?" — não tinha: o Raio-X (52ª) nasceu antes do pedido de faxina (53ª).
     Auditado e arrumado com o mesmo critério:
     - **Descartado**: "Esta palavra ainda não foi analisada pela IA" (o layout já diz);
       o botão "O que tem aqui? Separar em partes" quando a triagem JÁ rodou (repetia uma
       ação feita — só re-renderizava o cache); o parágrafo-rodapé que explicava de novo o
       que a instrução do topo já dizia; e o botão "Estudar selecionadas" **desabilitado**
       ocupando espaço à espera de seleção.
     - **Hierarquia por estado** (cada momento mostra só o que serve): COM triagem, os chips
       são protagonistas e "Analisar a frase inteira" recua para ghost/sm num rodapé
       separado por linha fina; SEM triagem (palavra simples), o botão primário grande
       continua centralizado. `renderWordCard` é re-chamado quando a triagem chega, para o
       layout assumir o novo estado inteiro.
     - **Chips leves**: fundo cinza → transparente com borda de 1px (acento só quando
       escolhido); glosa menor; feitos ficam tracejados e esmaecidos.
     - **Um alinhamento só**: bloco de 520px alinhado à esquerda, ações na mesma coluna —
       antes misturava chips à esquerda com botões centralizados.
     - **Instrução enxuta**: "Marque o que você não conhece" (era duas frases).
     - Validado ao vivo nos dois estados: frase (sem aviso/rodapé/botão redundante, chips
       transparentes, rodapé aparecendo só ao marcar — "Estudar 1" — e sumindo ao
       desmarcar) e palavra simples (botão primário grande, centralizado, sem chips).
       `CACHE`: `v80` → **`v81`**.

### Sessão 2026-08-04 (53ª rodada) — Lista do Revisar no espírito Marie Kondo
109. **Pedido**: "essa aba parece estranha — cards pequenos, fontes grandes; quero algo
     clean, inspirado na Marie Kondo". Aplicado o princípio: descartar o que não informa,
     um lugar para cada coisa, silêncio visual.
     - **Ruído descartado**: o chip "Pendente IA" repetido em TODA linha virou um ponto
       âmbar de 7px (tooltip explica); palavra pronta mostra só o Nº de significados num
       contador pequeno. `status-chip` continua existindo nos outros lugares.
     - **Linha única de 32px** (era ~90): palavra à esquerda (ellipsis), fonte/estado à
       direita; sem molduras nem cantos de cartão — hover suave, ativa com barra fina.
       ~3× mais palavras visíveis sem rolar.
     - **Checkbox invisível em repouso**: aparece no hover e permanece quando marcada
       (a seleção múltipla continua idêntica).
     - **Cabeçalhos de grupo silenciosos**: caixa cinza → rótulo pequeno em maiúsculas.
     - **Coluna 260px → 320px** (títulos de release não truncam tão cedo), tipografia um
       degrau menor em cabeçalho/filtros/busca.
     - Markup: `renderSidebar` simplificado (`rw-body/rw-meta` → linha flat + `rw-right`);
       CSS em bloco de override no fim do styles.css. Validado ao vivo com dados
       sintéticos nos dois estados e duas fontes: 32px/linha, zero chips na lista, pontos
       e contadores certos, checkbox oculta em repouso. `CACHE`: `v79` → **`v80`**.

### Sessão 2026-08-04 (52ª rodada) — Raio-X da frase: triagem automática do que estudar
108. **Pedido** (card "We'll get you in for that"): "tem vezes que não sei exatamente o que
     não entendi — se é palavra, phrasal, idiom… quero separar o que já sei do que não, e
     aí mandar pra IA analisar". Refinos durante a rodada: a triagem deve ser LEVE (sem
     levantamento profundo), rodar SOZINHA assim que o item entra na revisão, e com
     análise de custo-benefício antes (feita: ~R$ 0,0004/frase no DeepSeek — 100 frases =
     R$ 0,04/mês; benefício = card abre com os chips prontos; aprovada).
     - **`_revBreakPrefetch`** disparado pelo `createWord` (dashboard.js) para itens com
       3+ palavras: UMA chamada `aiJSON` curta (glosa de até 6 palavras por unidade,
       maxTokens 700) → cache em memória (`_revBreakCache`, não persiste — recarregar a
       página re-tria só quando o card for aberto).
     - **UI no card pendente** (review.js): chips agrupados por categoria (Phrasal verbs /
       Expressões idiomáticas / Colocações / Estruturas / Palavras), cada um com
       mini-glosa e nível CEFR. "Toque no que você NÃO conhece" → botão "Estudar N
       selecionadas" cria os itens (herdam contexto/fonte/idioma; tipo preservado —
       phrasal vira phrasal) **e já roda a análise completa em sequência** (o "de fato
       mandar pra IA analisar" do pedido). Chips criados ficam marcados; aparece "Remover
       a frase da fila" (a frase-mãe vira descartável). Botão manual continua para quem
       abriu antes de a triagem terminar.
     - Validado ao vivo (fluxo completo com stubs): frase criada → triagem automática (1
       chamada só) → chips prontos AO ABRIR o card → 2 marcadas → 2 itens criados com
       fonte herdada e tipo certo → 2 análises completas automáticas → chips "feitos" +
       botão de remover a frase. `CACHE`: `v78` → **`v79`**.

### Sessão 2026-08-04 (51ª rodada) — Forma neutra, tempos fixos e o merge que fossilizava termos
107. **Feedback sobre a reanálise de *emasculating*** (agora com 2 sentidos): "debilitante
     ainda tá junto com castrador; 'esvaziadora' nem faz sentido; e o objeto de estudo deve
     vir no sentido neutro, com exemplos presente/passado/tempo com variação". Três causas,
     três correções — e varredura em todos os prompts geradores:
     - **"debilitante" preso era o MERGE, não a IA**: a regra de preservação (item da
       curadoria) mantinha título e exemplos antigos do sentido casado — a IA nova devolveu
       limpo, mas o fóssil venceu. `applyAiResult` agora RESOLVE CONTRADIÇÃO: termo do
       título preservado que a nova análise moveu para OUTRO sentido é removido (comparação
       por radical: castrador/castradora, debilitante/debilitantes), e o exemplo preservado
       cujo negrito PT usava esse termo é trocado pelo exemplo novo da IA. Todo o resto da
       curadoria permanece (id, definição, exemplos bons, sinônimos).
     - **Forma neutra de citação (lema)** no meaning_pt: verbos no INFINITIVO ("esvaziar",
       nunca "esvazia"), adjetivos no masculino singular, substantivos no singular; e SÓ
       palavras que existem — se o derivado soa inventado ("esvaziadora"), usar perífrase
       natural "que esvazia, que enfraquece".
     - **Ordem FIXA dos exemplos**: #1 presente, #2 passado, #3 a construção em que a
       palavra MAIS muda de forma (contínuo/futuro/condicional/passiva) — a variação
       morfológica (run/ran/running) é o objetivo didático. Aplicada também ao prompt de
       "Reanalisar" (audio.js).
     - **Varredura**: trava de coerência ("o negrito PT deve ser intercambiável com o
       meaning_pt — nunca palavra de outro sentido") replicada nos 3 prompts que geram
       exemplos: análise (review.js), reanálise em lote (audio.js) e regenerar exemplo
       único (study.js). Os lotes do add.js (Kindle/mídia) só extraem vocabulário e
       traduzem frase — não geram significados; conferido e deixado como está.
     - Validado ao vivo com o card real do print: título preservado perdeu só o
       "debilitante", exemplos 1–2 curados intactos, o 3º (contaminado) trocado pelo novo,
       sentido novo entrou, prompt carrega forma neutra + tempos fixos.
       `CACHE`: `v77` → **`v78`**.

### Sessão 2026-08-04 (50ª rodada) — Sentido distinto vs sinônimo de tradução (estudo + prompt)
106. **Observação do Djemeson** (card de *emasculating*): "todos vêm com 1 significado só, mas
     aqui dava uns dois — tem caso em que varia a tradução e o sentido é o mesmo, e caso em
     que é outro significado, como 'debilitante'". Estudo e correção:
     - **Diagnóstico**: o prompt já pedia vários sentidos, mas tinha duas instruções em
       CONFLITO: (a) "use sinônimos DIFERENTES nas 3 traduções" (busca de riqueza lexical) e
       (b) meaning_pt "liste 2–3 sinônimos separados por vírgula" — **sem nenhum teste de
       intercambialidade**. O modelo então varia a tradução até atravessar a fronteira do
       sentido e empacota o resultado como sinônimo: "desvirilizador, castrador,
       **debilitante**" (os dois primeiros são o mesmo sentido; o terceiro é outro).
     - **Três testes lexicográficos** agora explícitos no prompt: (1) SUBSTITUIÇÃO — trocar
       as traduções na mesma frase; se muda o que se afirma, são sentidos distintos;
       (2) COMBINAÇÃO — sentido que se aplica a pessoa ≠ sentido que se aplica a lei/objeto,
       ainda que ambos figurados; (3) ANTÔNIMO — se o oposto natural muda, o sentido mudou.
       Com o caso *emasculating* resolvido por extenso dentro do prompt como exemplo.
     - **CHECAGEM DE COERÊNCIA**: o negrito em PT de cada exemplo tem de ser intercambiável
       com o meaning_pt daquele sentido; se não for, **isso é prova de que falta um sentido**
       → criar o objeto. E a variação de sinônimos ganhou limite explícito ("variar dentro
       do sentido; sair dele não é variedade, é sentido faltando").
     - **`sense_audit`**: campo novo colocado ANTES de `meanings` no template (a ordem
       importa em modelo autoregressivo) — obriga a listar os sentidos candidatos com
       SPLIT/MERGED e o teste que decidiu. Não aparece na UI; sai no console para depurar
       quando um card voltar com menos sentidos do que deveria.
     - **`maxTokens` 2800 → 5000**: 2–3 sentidos × 3 exemplos (en+pt) truncavam a resposta —
       e resposta truncada volta como um sentido só, reforçando o sintoma.
     - Validado ao vivo: prompt carrega os 3 testes + exemplo + coerência + auditoria;
       resposta com 2 sentidos aceita inteira (2 objetos, 3 exemplos cada, o do contexto
       primeiro), `sense_audit` não vaza para o card. **Cards antigos não se corrigem
       sozinhos**: "Reanalisar tudo" só conserta exemplos do sentido existente — para ganhar
       sentidos novos é o botão "Analisar com IA" da palavra. `CACHE`: `v76` → **`v77`**.

### Sessão 2026-08-04 (49ª rodada) — Varredura: o projeto INTEIRO rodando em DeepSeek
105. **Bug**: "Analisar com IA não aparece nada quando o DeepSeek está ativo" (print da
     palavra *neocon*). Mesma raiz da 40ª, agora no caminho da ANÁLISE: `aiJSON` mandava
     sempre `response_format: json_object`, que o DeepSeek atende com vazio/truncado.
     Pedido complementar: "analise TODO o projeto pra não dar esse tipo de erro".
     - **`aiJSON` em 3 camadas**: (1) fornecedor ativo com `json_object` — **pulada para o
       DeepSeek**, que já começa sem; (2) mesmo fornecedor sem `json_object`; (3) OpenAI,
       se houver chave. Novo **`_aiParseJSON`**: aceita cerca ```json, texto antes/depois
       (pega do primeiro `{` ao último `}`) e `reasoning_content`.
     - **Varredura completa do acoplamento à OpenAI** (4 padrões: chat/completions direto,
       `response_format`, `cfg.openaiKey`, `ai_provider` fixo). Trocadas **23 guardas** de
       operações de CHAT para `aiChatCfg().key` em review.js, add.js, study.js, audio.js e
       video-subs.js — incluindo `analyzeWordDirect`, que fazia `return false` MUDO sem
       chave OpenAI (o "não aparece nada" literal), e `analyzeWord`/`analyzeAll`.
       `w.ai_provider` agora grava o fornecedor real, não 'openai' fixo.
     - **Imagens**: as duas guardas de geração passaram a olhar a chave do fornecedor de
       IMAGENS (`aiImgKey()`, 48ª rodada), não a da OpenAI.
     - **Mantidas em OpenAI de propósito** (verificado uma a uma): TTS (audio.js, o teste em
       settings.js, criar card com áudio) e o fallback deliberado de traduções recusadas.
     - Validado ao vivo: DeepSeek respondendo JSON puro, com cerca markdown + texto em
       volta, vazio (→ cai na OpenAI, rota `deepseek` → `openai+fmt`), tudo falhando (erro
       "[DeepSeek] …"), OpenAI seguindo com `json_object`; e o fluxo REAL de "Analisar com
       IA" da palavra *neocon* rodando 100% no DeepSeek (status `pending_review`,
       significado e exemplos preenchidos). `CACHE`: `v75` → **`v76`**.

### Sessão 2026-08-04 (48ª rodada) — Imagens pelo Gemini (Nano Banana), três níveis
104. **Pedido**: "construa o gemini pra imagem, com modelo baixo, médio e alto igual o do
     openai — talvez a qualidade compense" (decisão consciente por QUALIDADE, não preço:
     a análise da 47ª mostrou que o Gemini não é mais barato aqui).
     - **`AI_IMG`** em ai.js: dois fornecedores × três níveis, cada um com modelo e preço
       reais. OpenAI: gpt-image-1 low/medium/high (0,011/0,042/0,167). Gemini:
       `gemini-2.5-flash-image` 0,039 · `gemini-3.1-flash-image` 0,067 · `gemini-3-pro-image`
       0,134. `cfg.imgProvider` (sincronizado) escolhe; `aiImgNivel()` resolve tudo.
     - **`_aiImageGemini`**: o Gemini NÃO passa pela camada compatível — usa
       `POST /v1beta/models/{model}:generateContent` com header `x-goog-api-key` e
       `responseModalities:['Image']`, lendo `candidates[0].content.parts[].inlineData`.
       Como a doc de ago/2026 já mostra a rota nova `/v1beta/interactions`, há **plano B
       automático**: 404/400 na clássica → tenta a nova; o leitor aceita os dois formatos
       de resposta (`inlineData` e `output_image`). Contrato de saída inalterado (data URL).
     - **Configurações**: dropdown "Imagens (fornecedor)" + o de qualidade agora listando
       **modelo real e US$/imagem** ("Nano Banana Pro (3 Pro) — US$ 0,134/imagem"); trocar
       de fornecedor preserva o nível e avisa se falta a chave.
     - Validado ao vivo (chamadas stubadas): tabela dos 6 níveis, rota+headers+modalidade
       corretos por fornecedor, data URL montada dos dois formatos, plano B disparando na
       ordem certa (generateContent → interactions), erro claro sem chave, custo do lote
       acompanhando o fornecedor. **Não validado com chave Gemini real** — na primeira
       geração de verdade, conferir. `CACHE`: `v74` → **`v75`**.

### Sessão 2026-08-04 (47ª rodada) — "Só a OpenAI faz isso" estava errado: transcrição na Groq
101. **Contestação do Djemeson** ("o Gemini não gera imagem e áudio? o DeepSeek não
     transcreve?"). Pesquisa nas fontes atuais (doc oficial da Groq + preços 2026):
     - **Groq FAZ transcrição** — mesmo Whisper, endpoint `api.groq.com/openai/v1/audio/
       transcriptions`, formato idêntico ao da OpenAI (verbose_json com timestamps de
       segmento), **US$ 0,04/h (turbo) contra US$ 0,36/h da OpenAI = 9× mais barato**.
     - **Gemini** tem TTS (US$ 10/1M tokens de áudio), imagens (US$ 0,045–0,151) e
       transcrição via multimodal — mas NENHUM desses fala o dialeto OpenAI; exigiriam
       cliente próprio (TTS devolve PCM cru para empacotar em WAV). Imagem não é mais
       barata que o gpt-image-1 padrão. Ficam anotados como próximo passo possível.
     - **DeepSeek** é só texto na API oficial (Janus/VL são modelos abertos, fora da API).
     - **Implementado**: `AI_STT` + `aiSttCfg()` + **`aiTranscribe()`** em ai.js — um único
       ponto para as 3 chamadas que existiam soltas (legenda inteira, sincronia, shadowing).
       Novo `cfg.sttProvider` ('auto' = Groq quando há chave | 'groq' | 'openai'), dropdown
       em Configurações, sincronizado. Guardas que exigiam `cfg.openaiKey` para OUVIR agora
       aceitam Groq; o modal de custo mostra fornecedor, modelo e a conta por minuto.
     - Validado ao vivo: auto→Groq, auto sem chave Groq→OpenAI, forçado nos dois sentidos,
       URL/modelo/Bearer corretos por rota, erro identificando o fornecedor, custo/hora
       0,04 vs 0,36. Um episódio de 45min: **R$ 1,50 → R$ 0,17**.
102. **Análise minuciosa de imagens e áudio** (pedido de aprofundamento) — números das docs
     oficiais, ago/2026. Conclusão: **só a transcrição valia a troca**.
     - **TTS**: Gemini 2.5 Flash TTS US$ 10/1M tokens de áudio a 25 tokens/s = US$ 0,90/h =
       **US$ 0,015/min — o MESMO preço do gpt-4o-mini-tts**. Zero ganho financeiro, e a
       camada OpenAI-compat do Gemini **não** cobre TTS (exigiria cliente próprio +
       empacotar PCM 24kHz em WAV). Não implementado, por decisão fundamentada.
     - **Imagens**: Gemini 2.5 Flash Image US$ 0,039/imagem vs gpt-image-1 padrão US$ 0,042
       (−7%) e vs nosso modo econômico US$ 0,011 (3,5× MAIS caro). Gemini 3.1 Flash Image
       (0,067) e 3 Pro (0,134) são mais caros. Imagen 4 (0,02) está DEPRECADO (sunset
       ago/2026) — não adotar. Também fora da camada compat. Sem ganho: não implementado.
     - **DeepSeek**: API oficial é só texto (Janus/VL são pesos abertos, não API).
     - **Correção de honestidade nos números**: `AI_COST.tts` era 0,008/frase (herdado da
       tabela por caractere do tts-1) — o preço real do gpt-4o-mini-tts é US$ 0,015/**min**,
       e a frase de um card tem ~5s → **US$ 0,00125**. O app superestimava o TTS em ~6×
       (100 frases: R$ 4,40 mostrado → R$ 0,69 real).
103. **Barra do dia subindo 2 por card e caindo ao sair** — efeito colateral do item 97:
     `renderSbToday` (e o backup de sessão, srs.js) somavam `srsLog.reviewed + srsSession.done`,
     desenho válido enquanto o log só era gravado no fim. Com o log incremental isso passou a
     contar DUAS vezes por card e a "perder" a parcela da sessão ao encerrar (voltava ~4–5).
     Agora ambos leem só o log. Validado: 4→5→6→7→8 (um por card) e o "X" mantém em 8.
     `CACHE`: `v73` → **`v74`**.

### Sessão 2026-08-04 (46ª rodada) — Pacote de 4 tarefas exportado do quadro do Djemeson
97. **Progresso do dia zerava ao encerrar o estudo no "X"**. Causa: só `finishSrsSession()`
    (fim natural) gravava `srsLog` — `endSrsSession()` fazia `srsSession = null` e o que já
    tinha sido revisado sumia do dia (o agendamento dos cards nunca se perdeu; o CONTADOR
    do dia é que voltava a zero). Agora `_logRevisao(±1)` grava **card a card** dentro de
    `rateSrsCardAndNext` (e desconta no `undoLastCard`) — cobre também fechar a aba no
    meio. `finishSrsSession` não soma mais nada (evita contagem dupla).
98. **Explicar mudo em certas frases (DeepSeek)**. Duas causas somadas: resposta com
    `content` vazio, e modelos que gastam o orçamento em `reasoning_content`. Novo
    **`aiTextSeguro()`** em ai.js: usa `reasoning_content` quando o `content` vem vazio e,
    se ainda assim não houver texto (ou a chamada falhar), **repete a pergunta na OpenAI**
    (gpt-4o-mini) quando há chave. Usado no Explicar do vídeo E do Revisar; o erro agora
    aparece dentro do popup nos dois.
99. **‹‹/›› caíam no meio/fim da frase**. Uma frase falada quase nunca cabe numa legenda só
    — navegar por LEGENDA fazia o salto parar no meio. `_vidCueContinua/_vidGrupoIni/
    _vidGrupoFim` agrupam legendas encadeadas (sem pontuação final, sem travessão de outro
    falante, pausa < 1,5s) e a navegação passou a andar **por frase**, sempre ao início.
    Validado: grupos `[0,0,0,3,4,4]`, ‹‹ do meio da 3ª legenda volta ao início da frase,
    sequência 24s → 20,8 → 16,8 → 9,8 (uma frase por clique) e o mesmo no sentido inverso.
100. **"Os valores da OpenAI se atualizam conforme o modelo?"** — NÃO se atualizavam:
    `AI_COST.chat` era um número fixo (US$ 0,001/item) calibrado no gpt-4o-mini, igual para
    qualquer fornecedor. Agora cada modelo tem `preco: {in, out}` (US$/1M tokens, tabela de
    ago/2026) e `aiCustoChatUsd()` calcula `tokens médios × preço do modelo ATIVO`. Medido:
    100 itens = R$ 0,09 (Groq 8B), R$ 0,28 (DeepSeek V4-flash), R$ 0,45 (gpt-4o-mini),
    R$ 7,43 (gpt-4o). O modal agora mostra fornecedor·modelo e a linha **"Base do cálculo"**;
    o modal do Whisper explica que é `whisper-1 · US$ 0,006/min` e NÃO muda com o
    fornecedor de texto. `CACHE`: `v72` → **`v73`**.

### Sessão 2026-08-03 (45ª rodada) — A tradução da IA volta ligada sozinha ao reabrir o vídeo
96. **Perguntas do Djemeson**: "como faço pra ver as legendas da IA? ao abrir o vídeo de
    novo ela sobe automaticamente? quero que abra junto. e pra usar, como faz?". As
    traduções JÁ eram persistidas (`cue.pt` no VideoDB), mas `_vidPTmode` nascia sempre
    `'off'` — a cada sessão era preciso religar o botão de faíscas. Corrigido:
    - **`cfg.vidPT`** (novo em DEF_CFG, sincronizado no Firestore): guarda o modo escolhido
      (`off`/`sub`/`ia`); `videoSetPT` e `videoTranslateFull` gravam.
    - **`_vidRestaurarPT()`** em `videoOpenPlayer`: restaura o modo se os dados existirem
      (pref `sub` sem trilha oficial mas com IA → cai para `ia`); **sem preferência salva,
      um vídeo que já tem tradução da IA abre com ela LIGADA** — foi pedida e paga. Toast
      "Tradução da IA carregada (N falas)" responde o "como vejo".
    - `videoSetPT('ia')` não exige mais chave de IA quando a legenda já está traduzida
      (exibir o que está salvo não consome nada).
    - **Importar .srt PT deixou de ser destrutivo**: nome com `.pt`/`.pt-BR`/`por` entra
      como TRILHA DE TRADUÇÃO (alinhada, modo `sub` ligado) em vez de substituir a legenda
      EN; e o import de legenda EN passou a usar `_vidSaveSubsNow()` — antes um
      `VideoDB.set({cues})` cru **apagava trilha PT e traduções da IA**.
    - Validado ao vivo com persistência real: traduzir → sair → reabrir = 3/3 traduções,
      modo `ia` sozinho, botão aceso, overlay e transcript com PT; `off` explícito é
      respeitado; import do `.pt-BR.srt` preservou legenda EN + traduções da IA.
      `CACHE`: `v71` → **`v72`**.

### Sessão 2026-08-03 (44ª rodada) — 130 falas de fora no "Traduzir legenda inteira"
95. **Reclamação**: "traduziu mas disse que 130 falas ficaram de fora". Duas causas:
    blocos de 20 falas estouravam o teto de tokens (as últimas linhas do bloco eram
    ENGOLIDAS pelo truncamento) e o fluxo rodava UMA passada — o que faltou, faltava.
    - **Até 3 passadas automáticas**: a 1ª (blocos de 10) cobre quase tudo; as seguintes
      varrem só o que faltou com blocos de 5. Pela contagem `_ptTent`, recusas caem no
      fallback OpenAI já na 2ª passada. Status mostra "(2ª passada)" no progresso.
    - **Teto folgado**: `140 tokens/fala + 200` (era 90/+120) — truncar bloco engole falas.
    - **Parser tolerante a markdown**: aceita `**1.**` etc. e limpa asteriscos da tradução.
    - **Contagem honesta**: espera os fallbacks em segundo plano terminarem (`_ptReq`
      zerado, até 35s) antes de anunciar quantas faltaram.
    - Validado ao vivo: 60 falas com truncamento simulado (3 engolidas por bloco) → 1ª
      passada deixou 18 buracos, 2ª varreu todos — zero faltantes, markdown limpo.
      `CACHE`: `v70` → **`v71`**.

### Sessão 2026-08-03 (43ª rodada) — "Traduzir legenda inteira" (legenda PT-BR criada por IA)
94. **Pedido**: "adicione uma opção de criar a legenda em portugues com IA baseado na
    legenda em ingles". Botão **"Traduzir legenda inteira"** no painel de sincronia:
    - `videoTranslateFull()` (video-subs.js): traduz TODAS as falas sem `pt` em blocos de
      20 (até 3 em voo), reusando `_vidPTlote`/`_vidPTparse`/fallback de recusas da 41ª.
      Progresso no painel ("N/M falas"); re-filtra a cada grupo (o tempo real pode ter
      traduzido algumas); `_vidSaveSubsNow()` no fim; liga o modo "PT IA" sozinho se
      estava desligado. Custo: centavos no DeepSeek (~90 tokens/fala).
    - Validado ao vivo: 50 falas → tempo real cobriu ~10 (janela 30s), o botão traduziu o
      resto em blocos 20/19, modo ligou sozinho, status no painel, todas com `pt`.
    - **Complemento (mesmo dia)**: "tem que ser possível baixar" — `videoSubExport('ia')`
      exporta a tradução da IA como .srt (`nome-do-vídeo.pt-BR.ia.srt`), nos MESMOS tempos
      da legenda EN (com a sincronização aplicada); falas sem `pt` ficam de fora sem furar
      a numeração. Botão "**.srt PT-BR (IA)**" no painel de sincronia, visível quando há
      tradução da IA. Validado: conteúdo, tempos, numeração, aviso quando não há tradução.
      `CACHE`: `v69` → **`v70`**.

### Sessão 2026-08-03 (42ª rodada) — Tradução chegando DEPOIS da fala + Explicar mudo por cache vazio
93. **Duas reclamações**: "demora muito pra carregar algumas legendas em tempo real — se
    eu voltar a frase a informação já está lá" e "algumas palavras ainda não vêm a
    explicação".
    - **Causa da demora**: a resposta da IA é gerada token a token — o tempo cresce com o
      tamanho do lote. Um lote de 8–10 falas levava 10–15s; as primeiras falas passavam
      antes de o lote ficar pronto. `_vidEnsurePT` agora fatia em **blocos de até 4 falas
      em PARALELO** (`_vidPTlote` extraído) e a janela do `_vidEnsurePTAhead` foi de 12s
      para **30s** — o bloco fica pronto ANTES de a fala chegar.
    - **Causa do Explicar mudo**: resposta VAZIA da IA (o DeepSeek faz isso às vezes) era
      renderizada como nada e **cacheada como ''** — a seleção ficava muda para sempre.
      Agora vazio vira erro visível ("resposta vazia… clique para tentar de novo") e NÃO
      entra no cache.
    - Validado ao vivo: 50 falas, janela pegou ~10 em blocos ≤4 paralelos; resposta vazia
      mostrou o erro no popup e o cache ficou limpo. `CACHE`: `v68` → **`v69`**.

### Sessão 2026-08-03 (41ª rodada) — DeepSeek recusa/omite falas de conteúdo adulto
92. **Pedido**: "verifique se o deepseek tem proibição de certas falas". Tem — e pesquisa
    confirmou: o DeepSeek aplica moderação a conteúdo sexual explícito e, em TRADUÇÃO,
    costuma **omitir/alterar silenciosamente** em vez de avisar. Nas cenas adultas do
    White Lotus, trechos inteiros ficavam sem PT. Três camadas de defesa em video-subs.js:
    - **Prompt de fidelidade** (`_VID_PT_SIS`): deixa explícito que é tradução fiel de
      legenda de obra existente para estudo — "sem censurar, suavizar nem omitir". Reduz
      a taxa de recusa (mas não zera).
    - **Fallback automático para a OpenAI** (`_vidPTRecusadas`): fala que voltar sem
      tradução 2× no fornecedor ativo vai SOZINHA para a OpenAI (`gpt-4o-mini`, direto
      via `_aiFetch` com `cfg.openaiKey`) — o resto do lote nem percebe. Contador
      `_ptTent` por fala (transitório, o `limpa` do save já o descarta).
    - **Desistência controlada** (`_ptDesisti`): sem chave OpenAI, ou se ela também não
      der, a fala para de ser re-tentada a cada tick (senão viraria loop de chamadas);
      pedido manual (`sinc`) ignora a desistência e tenta de novo.
    - Helpers extraídos: `_vidPTparse` (linhas numeradas → mapa) e `_vidPTaplica`.
    - **Validado ao vivo** (DS + OA stubados): DS omite a fala explícita → 2ª tentativa
      recusada → fallback OA recebeu SÓ ela e traduziu; depois de resolvido, zero
      chamadas extras. `CACHE`: `v67` → **`v68`**.

### Sessão 2026-08-03 (40ª rodada) — PT IA falhando só no DeepSeek (o json_object era o vilão)
91. **Pista decisiva do Djemeson**: "fiz o teste com a openai no mesmo trecho e funcionou
    perfeitamente" — a falha era específica do DeepSeek. O lote da 38ª usava `aiJSON`
    (`response_format: json_object`); o DeepSeek nesse modo às vezes devolve **conteúdo
    vazio ou truncado** (limitação admitida na doc deles) → `JSON.parse` falhava → o lote
    INTEIRO caía → retentava → caía de novo = "sessões muito grandes sem tradução, às
    vezes aparece e depois para". (O Explicar funcionava no DeepSeek porque é texto puro.)
    - `_vidEnsurePT` agora pede **texto puro com linhas numeradas** ("1. tradução") e
      parseia com regex tolerante (`1.`/`1)`/`1:`/`1-`); linha de conversa fiada do modelo
      é ignorada; número faltante = só aquela fala re-tenta no próximo tick.
    - `timeoutMs: 30000, retries: 1` no lote: uma travada não segura mais a janela por
      minutos (antes: 90s × 3 tentativas ≈ o "para de aparecer" que o Djemeson viu).
    - Validado ao vivo: resposta bagunçada de propósito (pula a 2ª, formatos mistos, lixo
      no fim) → 1ª e 3ª aplicadas, 2ª re-tentada sozinha no lote seguinte; nenhuma chamada
      com `response_format`. `CACHE`: `v66` → **`v67`**.
    - Lição de arquitetura: **`json_object` só onde a estrutura importa de verdade**; para
      listas simples, linha numerada é mais robusta entre fornecedores.

### Sessão 2026-08-03 (39ª rodada) — Explicar "não vai" quando o vídeo está tocando
90. **Reclamação**: "pedi pra explicar essa frase, e só reiki, mas não vai. e essa não foi a
    primeira vez". Causa raiz: `_vidOnTime` esconde o popup em TODA troca de fala
    (video.js:415) — com o vídeo TOCANDO, a fala trocava segundos após o clique e o popup
    sumia antes de a resposta da IA (DeepSeek, mais lento) chegar. Três mudanças:
    - **Explicar agora PAUSA o vídeo** ao clicar (vai-se ler; a cena congela e a fala não
      troca por baixo). Retomar o play é do aluno.
    - **Troca de fala não fecha o popup enquanto a explicação carrega** (guard: só esconde
      se não houver `.gen-spinner` no popup). Depois de carregada, a próxima troca fecha
      normalmente (quem retomou o play terminou de ler).
    - **Erro visível DENTRO do popup** (cor `--error`; "clique em Explicar para tentar de
      novo") — antes era `corpo=''` + toast, que some e parece "não fez nada".
    - Validado no cenário exato: vídeo tocando → Explicar pausa → troca de fala forçada
      durante o carregamento não fecha → resposta aparece → troca seguinte (pós-leitura)
      fecha → falha da API mostra o erro no popup. `CACHE`: `v65` → **`v66`**.
    - Obs.: a captura do Djemeson ainda mostrava o layout antigo (Revisar na 2ª linha) —
      o conserto da 38ª estava publicado mas o SW precisa de duas recargas para trocar.

### Sessão 2026-08-03 (38ª rodada) — Três consertos vindos do uso real (Explicar cortado, popup quebrando, PT IA pulando falas)
89. **Três reclamações do Djemeson usando de verdade** (com DeepSeek como fornecedor ativo):
    - **"As informações vêm incompletas"**: o Explicar (vídeo E Revisar) tinha teto de
      `maxTokens: 220` — cortava a resposta no meio da frase. Subiu para **600** nos dois
      (`videoOvExplain` e `revSelExplain`). O teto é só segurança: paga-se o que for gerado.
    - **"Frase longa empurrou o botão para baixo"**: o popup da legenda virou coluna com um
      cabeçalho `.vid-ov-row` (flex **nowrap**: seleção com reticências + 3 botões SEMPRE
      numa linha; botões com `flex-shrink:0`) e a explicação ocupa a linha de baixo inteira.
    - **"Algumas legendas não ganham a tradução da IA em certos trechos"**: o modo PT IA
      disparava UMA chamada POR fala em paralelo com só 5,5s de antecedência — com a
      latência do DeepSeek a resposta chegava depois de a fala passar. `_vidEnsurePT` agora
      traduz a janela em **LOTE** (uma chamada `aiJSON` com as falas numeradas →
      `{"t":[...]}`; falta na resposta = re-tenta no próximo tick; erro limpa `_ptReq` do
      lote inteiro) e `_vidEnsurePTAhead` olha **12s** à frente (era 5,5). Mais rápido,
      mais barato (um prompt) e chega a tempo.
    - **Validado ao vivo**: 3 falas → 1 chamada `json_object` com as 3 numeradas; a 4ª fala
      (fora dos 12s) NÃO traduzida; overlay com o PT; explicação com `max_tokens: 600` e
      texto completo abaixo do cabeçalho; cabeçalho nowrap com botões dentro da linha.
      Duas pegadinhas de teste registradas: o SW re-registrado no reload serviu CSS de
      cache (limpar de novo DEPOIS do reload) e o OneDrive serviu o video-subs.js velho
      (reiniciar o servidor de preview). `CACHE`: `v64` → **`v65`**.

### Sessão 2026-08-03 (37ª rodada) — Explicar também na legenda do vídeo
88. **Pedido**: "quero que exista o botão de explicar tambem nas legendas do video". O popup
    de seleção da legenda sobre o vídeo (`_vidOvSelCheck`, video-study.js) — que tinha só
    "Estudar com áudio" e "Revisar" — ganhou o **Explicar**, espelhando o do Revisar (33ª):
    - `videoOvExplain()`: mini-glosa da IA (2–4 frases PT-BR — sentido NAQUELA fala, gíria/
      marca/referência cultural, sentido figurado) renderizada dentro do próprio popup, num
      bloco `.sel-pop-exp` (classe reutilizada). O contexto enviado é a fala inteira
      (`_vidCues[_vidCueIdx]`) + título do vídeo. Usa `aiText` → fornecedor ativo (35ª).
    - **Cache compartilhado** com o Revisar (`_revExplainCache`, chave `vid|fala|seleção`) —
      review.js é não-lazy, então o Map já existe quando o módulo de vídeo carrega (sem
      violar a armadilha nº 1: o lado lazy é quem referencia o não-lazy, nunca o contrário).
    - **Proteções da 34ª aplicadas de saída**: `preventDefault` no mousedown do popup (a
      seleção não colapsa e o clique não o fecha) + fechar só em clique FORA (novo handler
      em `_vidOvBind`). CSS: `.vid-ov-pop` virou `flex-wrap:wrap` com largura mínima — a
      explicação quebra para baixo dos botões e rola a partir de 180px.
    - **Validado com a sequência REAL de eventos** (lição da 34ª): seleção → popup com 3
      botões → mousedown no Explicar com `defaultPrevented` conferido → explicação aparece
      e o popup PERMANECE aberto → 2º clique instantâneo pelo cache (1 chamada só) →
      clique fora fecha → "Estudar com áudio"/"Revisar" intactos. `CACHE`: `v63` → **`v64`**.

### Sessão 2026-08-03 (36ª rodada) — DeepSeek V4 (e a remoção da V3, decidida por fato)
87. **Pedido**: "crie a versão v4 da deepseek, analise se remove a v3". A análise foi feita na
    FONTE (doc oficial api-docs.deepseek.com via fetch), não em artigo de terceiro:
    - IDs ativos hoje: **`deepseek-v4-flash`** (US$ 0,14/0,28 por 1M tokens; cache hit a
      US$ 0,0028 — quase grátis) e **`deepseek-v4-pro`** (US$ 0,435/0,87).
    - Os aliases antigos `deepseek-chat`/`deepseek-reasoner` foram **DESCONTINUADOS em
      2026-07-24** (dez dias antes desta rodada) — remover não era opcional, era conserto.
    - **Migração suave por construção**: `aiModel()` valida o modelo salvo contra a lista
      curada — quem tinha o alias morto cai automaticamente no `v4-flash` (validado ao
      vivo). Preço dinâmico do DeepSeek (2× no pico da China) anotado no código.
    `CACHE`: `v62` → **`v63`**.

### Sessão 2026-08-03 (35ª rodada) — Multi-fornecedor de IA + botões de tradução com ícone no vídeo
86. **Dois pedidos**: dropdown de fornecedores de IA (Gemini, DeepSeek, Groq além da OpenAI)
    com modelos por faixa de custo e chaves organizadas; e (mensagem do meio) os controles de
    tradução do vídeo viraram DOIS botões com ícone, presentes no fullscreen.
    - **Gateway multi-fornecedor** (`ai.js`): `AI_PROVIDERS` (OpenAI, Gemini, DeepSeek,
      Groq — todos falam o dialeto OpenAI de chat/completions), `aiChatCfg()` decide
      URL+chave+modelo; `aiJSON`/`aiText`/Assistente (streaming) roteiam pelo fornecedor
      ativo. **TTS, imagens e Whisper continuam SEMPRE na OpenAI** (sem equivalente
      compatível) — guard com mensagem clara. Modelos CURADOS por faixa de custo
      (baixo/médio/alto + nota) e lembrados POR fornecedor (`cfg.aiModelProv`).
    - **Configurações**: dropdown de fornecedor → dropdown de modelos com faixa de custo →
      seção "Chaves de API" com 4 linhas organizadas (olho + botão Testar individual via
      GET /models, que não gasta token). Chaves novas: `geminiKey/deepseekKey/groqKey` —
      sincronizadas no Firestore (só quando não-vazias, padrão da openaiKey) e protegidas
      pelo backup pegajoso do IndexedDB. sw: domínios novos em NETWORK_ONLY.
    - **Validado ao vivo**: 4 fornecedores no dropdown, modelos por faixa, roteamento
      conferido (Groq URL+Bearer gsk+llama; Gemini URL+Bearer AIza+flash-lite), TTS
      bloqueando com mensagem certa, teste de chave por fornecedor.
    - **Tradução no vídeo: DOIS botões com ícone** (pedido: "mais sofisticado que texto"):
      CC (legenda PT-BR oficial) e faíscas (IA literal em tempo real), exclusivos entre si,
      no toolbar E como **minis flutuantes no canto do vídeo** (aparecem no hover, valem em
      tela cheia) + mini de névoa. `videoSetPT(modo)` substituiu o ciclo de 3 posições.
      A tradução por IA do vídeo agora usa o FORNECEDOR ATIVO (Groq/Gemini/DeepSeek servem).
      Validado: exclusividade, estados espelhados toolbar↔minis, overlay trocando
      oficial↔IA, fog. `CACHE`: `v61` → **`v62`**.

### Sessão 2026-08-03 (34ª rodada) — Conserto do "cliquei em Explicar e nada aconteceu"
85. **Bug do Djemeson na 33ª**: o menu aparecia, mas Explicar "não fazia nada". Causa: o
    **mousedown no botão colapsa a seleção** do navegador, e 10ms depois o próprio listener
    de mouseup via "seleção vazia" e ESCONDIA o popup — a explicação chegava num popup
    invisível. (O teste da 33ª chamou a função direto e por isso passou — lição: validar
    com a sequência de clique REAL mousedown→colapso→mouseup→click.)
    Correção dupla: (1) mouseup com alvo DENTRO do popup não fecha; (2) `preventDefault` no
    mousedown do popup — clicar nos botões nem colapsa mais a seleção (padrão
    toolbar-sobre-seleção). Revisar verificado junto: cria e fecha como deve.
    Validado com a sequência real de eventos + latência simulada da API: popup aberto
    durante e depois da resposta. `CACHE`: `v60` → **`v61`**.

### Sessão 2026-08-03 (33ª rodada) — Dúvida dentro da dúvida: Explicar/minerar por seleção no Revisar
84. **Caso real do Djemeson** (card "closet Adderall snorter"): entendeu a análise, mas ficou
    com "o que é Adderall? o que é closet?" — e não queria perguntar em outra aba, "sem
    perder o flow". E pediu: selecionar palavras/frases no título e mandar para revisão.
    - **Seleção em QUALQUER parte do card do Revisar** (título, exemplos, definição) → popup
      flutuante posicionado na seleção com duas ações:
      · **"Explicar"**: mini-gloss da IA ALI MESMO (2–4 frases, PT-BR) — o prompt pede o
        sentido NO contexto e, se for marca/gíria/referência cultural (o caso do Adderall),
        o que é no mundo real. Com **cache por seleção** (perguntar de novo é grátis).
      · **"Revisar"**: vira item novo da fila (`createWord` pending_ai) com o contexto da
        frase onde estava a seleção e **herdando a fonte** do card (série/episódio) — o
        "Adderall" minerado nasce sabendo que veio do White Lotus.
    - **O flow não quebra**: o card aberto NÃO re-renderiza (só sidebar + badges); popup
      fecha ao clicar fora e não vaza para outras seções (guard por seção ativa).
    - Implementado em `js/review.js` (não-lazy), classes `.sel-pop` genéricas.
    - Validado ao vivo com o cenário do print: seleção de "Adderall" no título → popup →
      explicação da IA no lugar → cache confirmado → minerado como pending_ai com fonte
      herdada → card intacto; 0 erros nas telas. `CACHE`: `v59` → **`v60`**.

### Sessão 2026-08-03 (32ª rodada) — Tradução em 3 posições + névoa (fog) sobre o vídeo
83. **Pedido**: separar BEM os dois canais de tradução ("a legenda PT-BR pode atrapalhar muito
    no estudo — é aí que a tradução em tempo real da API entra"), traduzir com IA só o ponto
    atual +5s ("não gastar tokens se não for assistir tudo"), névoa borrada por padrão com
    hover revelando (desligável), tudo compatível com fullscreen — "sofisticado, não cheio de
    elementos".
    - **Um botão, três posições** (`videoCyclePT`): `PT` (off) → `PT · legenda` (trilha
      PT-BR oficial alinhada — cue.pts; pula essa posição se não houver trilha) → `PT · IA`
      (tradução LITERAL em tempo real — cue.pt) → off. Fontes nunca se misturam no modo:
      `_vidPTshow()` escolhe por modo; `_vidPTmode` substituiu o antigo `_vidLivePT`.
    - **Economia de tokens**: `_vidEnsurePTAhead(t)` traduz SÓ as falas visíveis e as que
      começam nos próximos ~5s (janela [t−0,5, t+5,5]), com dedupe — validado: 10 falas no
      episódio, apenas 2 traduzidas na janela, avanço sem retraduzir. `_vidEnsurePT` ganhou
      `forcaIA` (o modo IA traduz MESMO onde existe trilha oficial — a divergência entre as
      duas é justamente o que o estudo quer evitar).
    - **Névoa (fog)**: a linha PT sobre o vídeo nasce BORRADA (blur 7px), hover revela;
      botão "Névoa" (só aparece com PT ligado) desliga o efeito. Funciona no fullscreen do
      stage (hover por CSS). Transcript mantém o recall próprio que já tinha.
    - Trilha nativa (fullscreen do player) também segue o modo.
    - Validado ao vivo: ciclo completo com rótulos/toasts, oficial × IA visivelmente
      distintas no overlay, contagem de chamadas exata, fog on/off, off limpa tudo.
      `CACHE`: `v58` → **`v59`**.

### Sessão 2026-08-03 (31ª rodada) — Navegação por FALA ("a frase passou, quero voltar nela")
82. **Pedido**: "uma frase que me interessou passou; a única forma de voltar é −5s. Quero voltar
    rapidamente na última fala, e avançar/retroceder rapidamente entre as falas."
    - **R / botão "Repetir fala"**: volta ao início da fala atual — e, no silêncio entre
      falas, da ÚLTIMA que passou (o caso exato dele). Aterrissa 0,2s antes, de respiro.
    - **← / → viraram fala anterior / próxima** (navegação de player de idioma, não de
      segundos): ← no meio de uma fala volta ao INÍCIO dela; apertando de novo, vai para a
      anterior — o comportamento "faixa anterior" dos players de música. **Shift+←/→**
      mantém os ±5s brutos; sem legenda carregada, as setas caem nos ±5s.
    - **Segundo par de botões flutuantes** no vídeo (‹‹ ››) acima dos de ±5s — valem em tela
      cheia.
    - Caso de borda pego na validação: como o pulo aterrissa na "entradinha" (−0,2s), o →
      seguinte recaía na MESMA fala e parecia travado — o avanço agora reconhece a entradinha
      e pula para a seguinte. Validado ao vivo: 6 cenários de navegação (meio da fala,
      silêncio, sequências ←←→→, começo do vídeo) todos exatos.
      `CACHE`: `v57` → **`v58`**.

### Sessão 2026-08-03 (30ª rodada) — Modularização + Ditado + Shadowing + Legenda criada pela IA
81. **Pedido**: "crie todos esses [Whisper de episódio inteiro, ditado, shadowing] seguindo as
    boas práticas que você mencionou" — ou seja, a faxina ANTES das funcionalidades.
    - **MODULARIZAÇÃO**: `js/video.js` (2.194 linhas) virou 4 módulos por responsabilidade:
      `video.js` (núcleo: estado, player, overlay, transcript, retomada, conserto de áudio),
      `video-subs.js` (parser, busca/addons, trilha PT, traduções, export, TRANSCRIÇÃO IA),
      `video-sync.js` (painel Sync, Whisper 2 pontos, correção progressiva, candidatas),
      `video-study.js` (seleção, foco, marcadores, card com áudio real, DITADO, SHADOWING).
      `_LAZY.video` virou ARRAY (carga sequencial — o estado vive no 1º); `_loadScript`
      ganhou 1 retry com cache-buster (cobre a janela de troca do service worker num deploy —
      corrida que sempre existiu para add.js/study.js). sw.js casa `/js/video` por prefixo.
      Split validado: 4 módulos carregam, todas as funções presentes, byte-total preservado.
      ⚠️ Falso-bug de dev pego no caminho: o servidor python antigo servia um core.js VELHO
      (handle do OneDrive) — a MESMA URL devolvia conteúdos diferentes; reiniciar o servidor
      resolveu. Em produção não existe: todo deploy sobe a versão do cache.
    - **DITADO** (custo zero): no estudo focado, antes de revelar a fala — "escreva o que
      ouviu" → correção por alinhamento palavra a palavra (LCS): verdes = pegou, vermelhas =
      o ouvido perdeu (CLICÁVEIS → Revisar), "escreveu a mais" listado, score %. Corrigiu =
      fala se revela. Validado: erros plantados ("torch"→"port", "spoken" omitido) foram
      exatamente os apontados (87%).
    - **SHADOWING** (centavos): após revelar a fala — grava a imitação pelo microfone,
      Whisper transcreve a SUA voz, mesmo diff → "X% das palavras saíram claras" + lista do
      que a IA não reconheceu; Ouvir você / Ouvir a cena / Gravar de novo. Validado o score
      com gravação falsa + Whisper stubado; o caminho do microfone real fica para o uso.
    - **LEGENDA CRIADA PELA IA** ("Criar com IA" no transcript vazio, ~R$ 1,50/45min, com
      confirmação de custo em reais): ffmpeg local extrai o áudio (mono 16kHz 48kbps — 1h
      cabe numa chamada; acima disso fatia por tempo), Whisper devolve segmentos com tempos,
      cues aplicadas — nasce sincronizada por construção. Validado com ffmpeg REAL no vídeo
      sintético + Whisper stubado: 5 falas aplicadas, DOM e IDB corretos (inclusive a trava
      de sanidade <5 falas disparando no stub pequeno — comportamento certo).
    - **Fullscreen consertado** (feedback do meio da rodada): o `max-height:56vh` do player
      (ID) vencia a regra de tela cheia (classe) — vídeo pequeno com vão embaixo. Regra nova
      com ID: `.vid-stage:fullscreen #vid-player` a 100vw/100vh. Legenda continua sobre o
      vídeo, como o Djemeson pediu.
    - 0 erros nas telas. `CACHE`: `v55` → **`v57`** (v56 intermediário).

### Sessão 2026-08-03 (29ª rodada) — Correção PROGRESSIVA de deriva (o caso dos 9 segundos)
80. **O Djemeson travou**: a melhor legenda tinha ~9s de atraso; o sync disse "ajustei o
    começo, vai derivar adiante" mas o começo continuou torto; ele tentou ±9s na mão e piorou.
    Três causas encontradas:
    - **Rótulo INVERTIDO**: "adiantada"/"atrasada" trocados na mensagem (mediana>0 = cue
      depois da fala = ATRASADA) — por isso o ajuste manual dele foi no sentido errado.
    - **"Ajustei o começo" mentia**: a âncora era o trecho mais falado da 1ª METADE (podia
      ser o minuto 20). Janelas reancoradas: 1ª nos primeiros 30%, 2ª nos últimos 45%.
    - **Deriva não se conserta com deslocamento constante** — nasceu a **correção
      PROGRESSIVA (linear)**: com o desvio medido em 2 pontos, a legenda inteira é reescrita
      com o desvio interpolado no tempo (framerate/versão = deriva linear na prática);
      reavaliação grátis contra as mesmas transcrições confirma, senão desfaz e cai para as
      candidatas. Validado com deriva plantada 3,5s→8,1s: legenda inteira a ≤50ms do áudio
      (início, meio e fim), 8/8 falas confirmadas.
    - Extras: botões manuais ±5s no painel Sync; mensagem conta PONTOS MEDIDOS (não janelas
      abertas — "verificado em 2 pontos" com 1 amostra vazia era desonesto).
      `CACHE`: `v54` → **`v55`**.

### Sessão 2026-08-03 (28ª rodada) — Legenda AUTOMÁTICA na abertura (zero cliques)
79. **Pedido**: "na primeira vez preciso clicar no botão de legenda e selecionar — quero que
    seja automático, sem eu fazer nada".
    - **`_vidAutoSub()`**: ao abrir um vídeo SEM legenda salva, roda sozinho: título limpo +
      SxxExx do nome do arquivo → Cinemeta confirma (nome normalizado tem que bater EXATO,
      senão para e aponta o botão manual — sem adivinhar) → `_vidFetchSubs` lista nos addons
      (com moviehash) → melhor legenda da LÍNGUA DO VÍDEO (`VID_LANG3`) → aplica → a trilha
      PT-BR vem atrás sozinha. Toasts em cada desfecho (achou / título incerto / sem episódio
      no nome / nada nos addons / falhou).
    - **Refatoração para reuso sem modal**: o miolo de `videoSubListLoad` virou
      `_vidFetchSubs(meta, temporada, episodio)` (também atualiza as candidatas persistidas)
      e o de `videoSubDownload` virou `_vidApplySubUrl(sub)` — modal e automático usam as
      mesmas peças.
    - **Vão pego no teste**: `_vidAutoFetchPT` lia a lista DO MODAL (`_vidSubState.subs`) —
      no fluxo automático o modal não existe e a trilha PT não vinha. Agora cai para as
      candidatas persistidas.
    - **Validado com rede REAL, zero stub**: arquivo novo "The.White.Lotus.S01E01...RARBG"
      aberto sem nenhuma legenda salva → **1020 falas aplicadas sozinhas** ("Hawaiian Flight
      451 to Honolulu" é a abertura real do episódio), 40 candidatas guardadas para o sync,
      e a trilha PT-BR (774 cues) alinhada em **851/1020 falas** ("Voo 451 da Hawaiian Air
      para Honolulu..."). 0 erros nas telas. `CACHE`: `v53` → **`v54`**.

### Sessão 2026-08-03 (27ª rodada) — Candidatas sem teto, tela cheia com legenda e pular ±5s
78. **Três pedidos do Djemeson na sequência** (White Lotus S01E01 como caso real):
    - **"Só 5 alternativas testadas, mas a lista tinha mais"** — certíssimo: o teto de 5 era
      arbitrário (`.slice(0,5)`) e as candidatas guardadas paravam em 15. Agora TODAS as
      candidatas da mesma língua são guardadas (até 40) e testadas — cada teste custa 1
      download + matching local (a transcrição do Whisper é reaproveitada). E nasceu o
      segundo nível que faltava: se nenhuma casa PERFEITAMENTE, a IA adota a **menos
      derivada** quando ela é ao menos 1s melhor que a atual (`parcial`, com o começo
      ajustado e aviso honesto). Validado ao vivo: a candidata boa na POSIÇÃO 7 foi
      encontrada e adotada (o teto antigo a deixava de fora). Nota: o ramo "menos ruim" usa
      o mesmo `_vidAdoptSub` do ramo validado, mas seu gatilho não foi exercitado ao vivo.
      ⚠️ Para o sync usar a lista completa num vídeo antigo, refazer "Buscar legenda" uma vez
      (atualiza as candidatas guardadas).
    - **"Em tela cheia a legenda não aparece"** — o botão nativo do player põe só o <video>
      em fullscreen, onde overlay nenhum entra. Dois caminhos: botão próprio **"Tela cheia"**
      (fullscreen no `.vid-stage` — o overlay interativo vai junto, dá para SELECIONAR
      palavra em tela cheia) e, para o botão nativo, uma **trilha de legenda nativa**
      (TextTrack/VTTCue, EN + PT quando "PT ao vivo" está ligado, `cue.line=-3`) ligada
      automaticamente no fullscreenchange. Validado: trilha com EN+PT montada; as transições
      de fullscreen em si exigem gesto do usuário (não automatizável — conferir no uso real).
    - **"Não tem botão de avançar/voltar segundos"** — botões flutuantes **−5s/+5s** sobre o
      vídeo (aparecem no hover, valem em tela cheia) + setas **←/→** do teclado (guardas:
      não em inputs, não quando o player nativo tem foco). Validado ao vivo: pulo por botão
      e por teclado.
    - `CACHE`: `v51` → **`v53`** (v52 intermediário na mesma rodada).

### Sessão 2026-08-03 (26ª rodada) — Continuar de onde parou (+2 bugs achados pelo teste)
77. **Pedido**: reabrir o mesmo arquivo deve carregar a legenda com as modificações e retomar
    exatamente de onde parou ("nem sempre vou acabar o vídeo no mesmo dia").
    - **A legenda já persistia** (IDB por vídeo, casado por nome+tamanho do arquivo) — mas o
      teste do fluxo achou um **bug de perda de dados real**: o save é debounced (1,5s) e
      `videoBackToLib`/troca de vídeo anulava `_vidCur` ANTES do timer — o guard abortava o
      save e a última mudança de legenda EVAPORAVA. Agora há flush (`_vidSaveSubsNow`) na
      saída do player, na troca de vídeo, no `beforeunload` e no `visibilitychange`.
    - **Retomar posição**: `v.position` gravada a cada ~5s de reprodução (localStorage; sem
      spam de sync) + no pause/saída; ao reabrir, retoma com **2s de recuo** para contexto e
      toast "Retomando de 12:31". Perto do fim (<20s) não retoma; 'ended' zera. A biblioteca
      mostra "parou em 12:31" em cada vídeo.
    - **Bug 2 (alinhador PT em caso degenerado)**: com pouquíssimas falas, vários offsets
      empatavam e a varredura ficava com o PRIMEIRO (−15s) — a tradução ia para a fala errada.
      Desempate por |off| menor + exigência de evidência mínima (senão off=0).
    - Validado ao vivo em duas "sessões" com o mesmo arquivo: legenda com shift −0,3s,
      tradução IA e trilha PT voltaram intactas; retomou em 14,9s (17−2); "parou em 0:17" na
      biblioteca; saída rápida do player não perde mais nada; 0 erros.
      `CACHE`: `v50` → **`v51`**.

### Sessão 2026-08-03 (25ª rodada) — Seleção na legenda do vídeo + botões de traduzir consertados
76. **Dois pedidos do Djemeson**:
    - **Selecionar palavra OU TRECHO na legenda sobre o vídeo**: a linha EN do overlay deixou
      de ser só exibição (`user-select:text`, clique pausa o vídeo). Arrastou (ou clique
      duplo) → popup com o trecho e duas saídas: **"Estudar com áudio"** (card completo com o
      áudio real da cena — `videoCreateCard` ganhou parâmetro de alvo explícito) e
      **"Revisar"** (`createWord` pending_ai com a fala como contexto, como o garimpo do
      estudo). Popup fecha quando a fala muda; overlay congela enquanto ele está aberto (a
      seleção não é destruída pelo re-render).
    - **"Botões de traduzir não funcionam todos"** — dois defeitos de percepção reais:
      (1) tradução pedida explicitamente (botão `pt` da fala, PT do trecho) aparecia
      **BORRADA** (o recall blur valia para tudo) — parecia que nada acontecia; agora pedido
      explícito = `.show`, sem blur (o blur fica só para o modo recall global);
      (2) o PT do trecho selecionado só aparecia no transcript — agora aparece **no próprio
      painel de seleção**, deduplicado.
    - Validado ao vivo: `pt` da fala visível sem blur; PT do trecho no painel; overlay
      selecionável; popup com os 2 botões; "Revisar" criou pending_ai com contexto/fonte;
      "Estudar com áudio" com trecho de 3 palavras ("tribe has spoken") → card in_srs com
      exemplo em negrito, clipId e áudio webm real; 0 erros nas telas.
      `CACHE`: `v49` → **`v50`**.

### Sessão 2026-08-03 (24ª rodada) — Alinhador PT v2: offset entre trilhas + fusões
75. **Print do Djemeson (Marshals S01E01)**: a tradução PT aparecia na fala ERRADA e duplicada
    no estudo focado. Ele perguntou se era a legenda PT-BR ou a IA — **era a legenda PT-BR
    oficial alinhada** (a IA só traduz onde é pedida); os dois defeitos eram do alinhador v1:
    - **A trilha PT vem de OUTRA release com timing deslocado** — o v1 alinhava pelo ponto
      médio SEM estimar o deslocamento entre as trilhas, então a tradução caía na vizinha.
      O v2 (`_vidAlignPTTrack`) estima o offset global em 3 passos: varredura grossa (±15s,
      passo 0,5s) + fina (0,1s) maximizando falas EN contidas em cues PT, e **refino pela
      mediana dos deltas de início** (a varredura fica com o primeiro empate — viés para
      baixo que o teste pegou: a última fala caía no cue vizinho).
    - **Legendas PT fundem 2 falas EN num cue só** — o mesmo texto vale para as duas. Na
      exibição: o estudo focado deduplica consecutivos, e o transcript mostra
      "⤷ (mesma tradução da fala acima)" na segunda em vez de repetir.
    - **Fonte visível**: a linha PT ganhou `title` dizendo se veio "da legenda PT-BR
      (alinhada)" ou "traduzido por IA".
    - **Dados antigos se corrigem sozinhos**: o realinhamento roda a cada abertura do vídeo
      (<50ms) — o Marshals dele conserta na próxima visita, sem ação manual.
    - Validado ao vivo com o cenário do print (trilha PT +3s com fusão): **6/6 falas no PT
      certo**, fusão única no foco, seta no transcript. `CACHE`: `v48` → **`v49`**.

### Sessão 2026-08-03 (23ª rodada) — .srt sincronizado para download + IA troca legenda de versão errada
74. **Dois pedidos do Djemeson**:
    - **"Baixar .srt" com a sincronização aplicada** (painel Sync): serializa as falas JÁ
      DESLOCADAS em SRT válido (CRLF + BOM) com o **mesmo nome do arquivo de vídeo** — na
      mesma pasta, qualquer player externo carrega sozinho. Botão extra para a trilha PT-BR
      alinhada (`.pt-BR.srt`). Validado: blob reparseia com 25 falas e tempos sincronizados.
    - **Legenda de VERSÃO ERRADA (deriva no meio)**: ele diagnosticou certo — offset constante
      a IA resolvia, deriva não. E pediu para ver o nome do release da legenda; **análise
      honesta: o protocolo dos addons só devolve `{id, lang, url}` — o nome NÃO existe na
      resposta** (e a página do OpenSubtitles que o teria bloqueia navegador). Então foi feito
      o que ele sugeriu como alternativa: **a IA reconhece e troca sozinha**:
      · `videoSyncAuto` agora amostra **2 pontos** do episódio (1º e 2º terço, janelas de
        maior densidade de fala em cada metade) quando o vídeo > 4min;
      · `_vidAvaliaLegenda` mede matched/mediana/**spread** (entre amostras) e **disp**
        (dispersão INTRA-amostra, aparada — pega deriva até com uma janela só; achado do
        teste: só o spread deixava passar deriva dentro da mesma janela);
      · consistente (spread ≤ 0,7s e disp ≤ 1,5s) → aplica a mediana como antes;
      · **derivou → testa as CANDIDATAS** da última busca (mesma língua, até 5, guardadas no
        IDB com a URL aplicada) contra as MESMAS transcrições — custo extra ZERO — e adota a
        primeira que casa de ponta a ponta, substituindo a legenda salva + ajuste fino;
      · nenhuma casou → ajusta só o COMEÇO (mediana da 1ª metade da 1ª amostra, não a mediana
        contaminada pela deriva) e avisa que vai dessincronizar adiante.
    - **Validado ao vivo com deriva plantada** (2 falas a +1s, 2 a +3,3s) e 3 candidatas
      (a aplicada, uma de outro episódio e uma boa a +0,8s constante): detectou a deriva,
      rejeitou o lixo, **adotou a boa, aplicou −0,8s** e a 1ª fala caiu exata no áudio;
      candidatas + URL aplicada persistidas no IDB; 0 erros de console.
      `CACHE`: `v47` → **`v48`**.

### Sessão 2026-08-03 (22ª rodada) — Sync com IA: acha sozinho o trecho falado + destrava após falha
73. **Bug relatado pelo Djemeson**: a IA amostrou um trecho com poucas falas, deu erro pedindo
    um trecho com mais fala, **o botão ficou desativado** e, ao recarregar, amostrava o MESMO
    trecho. Três causas, três correções:
    - **Ponto de amostra era fixo** (sempre a 10ª fala). Agora `_vidBestSampleStart(dur)`
      desliza uma janela pela legenda e escolhe a de **maior densidade de fala** (soma da
      duração das falas) — a densidade sobrevive a legendas fora de sincronia porque o desvio
      típico é de segundos. O status mostra onde a amostra foi tirada ("a partir de 12:31 — o
      trecho mais falado").
    - **Botão travado após falha**: o painel era re-renderizado DENTRO do catch, quando
      `_vidSyncing` ainda era true — o botão nascia desabilitado e ficava. O re-render foi
      para o `finally`, DEPOIS de liberar a trava.
    - **Último recurso — "IA do ponto atual"**: botão novo; o usuário leva o vídeo até um
      diálogo, pausa e a IA analisa dali (`videoSyncAuto(45, currentTime)`). A mensagem de
      falha agora aponta para ele.
    - **Validado ao vivo** com legenda de densidades desiguais: a janela caiu no bloco denso
      (não no "Hm." inicial); falha com Whisper stubado vazio → botões HABILITADOS + mensagem
      honesta; "do ponto atual" com desvio plantado de −1,0s → detectou e corrigiu exato
      (3 falas casadas). `CACHE`: `v46` → **`v47`**.

### Sessão 2026-08-02 (21ª rodada) — Marcador em ciclo + sincronização com IA
72. **Dois pedidos do Djemeson**:
    - **Marcador em CICLO** ("clica marca o começo, clica de novo marca o fim, e é esse trecho
      que vai pro estudo focado"): o 1º M/clique abre o trecho (botão vira "Fechar trecho" e
      pulsa em âmbar), o 2º fecha e **abre o estudo focado direto** naquele intervalo. O
      marcador agora é um INTERVALO `{a,b}` (os antigos, de ponto, seguem funcionando); a
      lista mostra `12:31 → 12:39 (8s)` com botão "estudar". `videoFocusRange(a,b)` acha as
      falas que o trecho toca e as bordas marcadas vencem quando são mais largas que as falas.
      Trecho < 0,8s = marcação cancelada (anti-clique-duplo).
    - **Sincronização da legenda** (pediu "algo mais poderoso, sincronização automática com
      IA — faça acontecer"): botão **"Sync"** no toolbar abre o painel com ajuste manual
      (±0,1s/±0,5s, indicador do deslocamento acumulado em `v.subShift`, desloca EN e trilha
      PT juntas) e **"Sincronizar com IA"**: grava ~45s do áudio REAL (captureClipAudio — usa
      o áudio consertado quando existe), transcreve com **Whisper** (`verbose_json`, timestamps
      por segmento), casa cada segmento com a fala mais parecida da legenda (tokens
      normalizados, score ≥ 0,5, janela ±60s) e aplica a **mediana** dos desvios (≥3 falas
      casadas; senão falha com mensagem honesta e aponta para o manual). Desvio < 150ms =
      "já está em sincronia". Custo ~R$ 0,03 por uso — abaixo do limiar de confirmação.
    - **Validado ao vivo**: ciclo abre/fecha → foco com 2 falas e bordas do usuário; lista de
      trechos; shift manual com indicador; auto-sync com dessincronia PLANTADA de +2,0s e
      Whisper stubado → detectou 2,0s exatos, corrigiu as 4 falas, `subShift = −2`; ciclo
      aberto sobrevive à troca de seção; 0 erros de console. `CACHE`: `v45` → **`v46`**.

### Sessão 2026-08-02 (20ª rodada) — Player de verdade: legenda no vídeo, PT simultâneo e estudo focado
71. **Feedback do Djemeson em 4 pontos** (+1 mensagem no meio da rodada), tudo construído:
    - **Busca de legenda SEM fricção**: com título limpo + SxxExx detectados do nome do
      arquivo, "Buscar legenda" vai DIRETO para a lista do episódio (auto-pick quando o 1º
      resultado do Cinemeta bate com o nome normalizado) — sem escolher série, sem confirmar
      episódio. Limite honesto documentado: o protocolo dos addons NÃO devolve o nome do
      release de cada legenda; a correspondência exata vem do moviehash na consulta.
    - **Legenda em TEMPO REAL sobre o vídeo** (`.vid-stage` + overlay): a fala corrente
      aparece sobre o vídeo (toggle "Legenda"), estilo player de verdade.
    - **Tradução simultânea em camadas** (pedido da mensagem do meio): ao aplicar uma legenda
      EN, o app busca sozinho a legenda **PT-BR do mesmo episódio** nos addons e alinha por
      tempo (`cue.pts`, ponto médio ±1,2s) — tradução OFICIAL, custo zero. Validado com dados
      reais: **614 de 769 falas alinhadas** ("What have you done?" → "O que você fez?").
      A IA (`cue.pt`) é a camada ADICIONAL: "PT ao vivo" traduz com a chave OpenAI as falas
      que não têm trilha (lookahead corrente+3), centavos por episódio. Preferência de
      exibição: pt (IA explícita) > pts (oficial).
    - **Tradução no transcript e no trecho**: botão `pt` por fala (hover; revela a alinhada ou
      traduz via IA) e o botão PT do painel de seleção agora usa a trilha alinhada primeiro.
      O antigo toggle "PT" (que parecia morto quando não havia tradução nenhuma) virou
      **"PT ao vivo"** com feedback claro em todos os estados.
    - **ESTUDO FOCADO** (o que o Djemeson esperava do marcador): trecho → escuta às cegas
      ("Ouça sem ler...") → **Mostrar a fala** (palavras clicáveis) → **Mostrar a tradução**
      (alinhada ou IA) → salvar card com áudio real — com Ouvir de novo, 0.75×, loop.
      Entradas: botão "Estudo focado" no painel de seleção e botão "estudar" em cada marcador.
      Salvar card no modo focado NÃO fecha o trecho.
    - Persistência: `subs` no IDB agora guarda `{cues (com pt/pts), cuesPT}`, com save
      debounced e limpeza de campos transitórios. `CACHE`: `v44` → **`v45`**.
    - Validado ao vivo com o episódio real: 1 clique → 40 legendas de HotD S03E02, EN aplicada,
      PT-BR alinhada em background, overlay com as duas linhas, foco completo (cego → fala →
      tradução → 4 palavras clicáveis), botão pt por fala, marcador → foco, persistência
      conferida no IDB, 0 erros de console.

### Sessão 2026-08-02 (19ª rodada) — Legenda via addons do Stremio + conserto de áudio Dolby
70. **Dois pedidos**: "o Stremio tem addons de legendas — não seria possível aceitar esses
    addons?" e "esse episódio veio sem áudio, faça funcionar:
    House.of.the.Dragon.S03E02...x265-MeGusta.mkv".
    - **Addons do Stremio: SIM, e melhor que o plano original.** O protocolo é aberto
      (`/manifest.json` + `/subtitles/{tipo}/{imdbId}.json`) e **tem CORS** (o Stremio Web roda
      em navegador) — a função serverless da fase 3 ficou DESNECESSÁRIA. Novo botão
      **"Buscar legenda"** no player: busca o título no Cinemeta (catálogo público), detecta
      SxxExx do nome do arquivo, consulta os addons (OpenSubtitles v3 por padrão + campo para
      colar QUALQUER addon de legendas do Stremio, sincronizado em `cfg.subAddons`), calcula o
      **moviehash** do arquivo (BigInt, primeiros/últimos 64 KB) para o addon priorizar a
      legenda certa, baixa e aplica. **Validado com dados reais ao vivo**: "House of the
      Dragon" achado no Cinemeta, **40 legendas do S03E02**, 769 falas importadas.
    - **Encoding na base da evidência**: além do UTF-8×1252 (menos lixo vence), as legendas
      chegam às vezes **duplamente encodadas DA ORIGEM** (bytes UTF-8 soletrando "â™ª") —
      `_vidFixMojibake()` reverte via tabela windows-1252 e mantém o original se piorar.
      Selo "sincronia exata" foi REMOVIDO: a resposta do addon não diz quais bateram no hash.
    - **MKV sem áudio (o caso MeGusta)**: áudio Dolby/DTS (EAC3) toca MUDO no Chrome (codec
      sem licença). Solução: **ffmpeg.wasm hospedado no PRÓPRIO site** (`js/vendor/ffmpeg/`,
      ~31 MB — CDN não funciona: o worker do ffmpeg tem imports relativos que quebram
      cross-origin, TESTADO e travou). Detector automático (`webkitAudioDecodedByteCount === 0`
      após 1,5s tocando) mostra o banner "Consertar áudio": monta o arquivo via **WORKERFS**
      (leitura sob demanda — um MKV de 2 GB NÃO passa pela heap do wasm), extrai a faixa
      (`-vn -c:a aac 128k`), salva o m4a no IndexedDB (store `media`, v2 do `el-video-db`) e
      toca num `<audio>` paralelo sincronizado ao vídeo mudo (deriva medida: 10–20ms; correção
      automática acima de 300ms). Feito 1×, fica salvo. `captureClipAudio` captura do áudio
      consertado quando ele existe — cards com áudio real continuam funcionando.
    - **sw.js**: cache SEPARADO e permanente `englab-ffmpeg-v1` (31 MB não podem ser reapagados
      a cada versão do shell) + `strem.io` em NETWORK_ONLY. `CACHE`: `v43` → **`v44`**.
    - Validado ao vivo: fluxo completo de legenda com episódio real, conversão de áudio
      integrada (banner → progresso → chip "áudio consertado"), reanexação automática ao
      reabrir, sincronização, 0 erros nas 8 telas.

### Sessão 2026-08-01 (18ª rodada) — FASE 1 DO VÍDEO implementada (seção nova + 6 ideias)
69. **Pedido**: "faça você um backup e logo depois execute a fase 1" + "implemente as ideias
    que você deu — o que couber na fase 1". Entregue e validado ao vivo com vídeo sintético
    (canvas + oscilador via MediaRecorder) e fetch stubado — zero dólar gasto no teste.
    - **Backup**: a extensão do Chrome não estava conectada, então os DADOS reais (browser
      logado + Firestore) ficaram fora de alcance — o que coube foi (a) tag git
      **`pre-video-fase1`** (rollback de código instantâneo) e (b) **`exportData()` virou
      backup completo**: antes só words+cfg; agora inclui srsCards/srsLog/srsDecks/srsCfg/
      conversas/videos/clips. ⚠️ Djemeson: um clique em Configurações → Exportar agora vale
      como backup de verdade.
    - **Nova seção "Vídeo"** (`js/video.js`, LAZY): biblioteca de vídeos → player + transcript.
      O ESTADO `videos[]`/`clips[]` vive em **core.js** (não-lazy) porque firebase.js os
      sincroniza (docs `data/videos` e `data/clips`) — armadilha nº 1 respeitada. Legendas
      ficam LOCAIS (IndexedDB `el-video-db`, stores `handles`+`subs`); o arquivo de vídeo
      nunca sobe e o handle (File System Access) é lembrado entre sessões no Chrome/Edge.
    - **O que funciona** (tudo verificado ao vivo):
      · abrir vídeo local (picker com handle persistido + fallback `<input type=file>`);
      · importar `.srt`/`.vtt` (parser tolerante: CRLF/BOM, tags `<i>`/`{\\an8}` removidas);
      · transcript karaokê (fala corrente destacada + rolagem automática com toggle);
      · fala clicável = seleção; estender ±fala, ajuste fino ±0,5s, loop A–B;
      · **card com o áudio REAL da cena**: captureStream+MediaRecorder grava o trecho (toca
        em tempo real), 1 chamada de chat analisa o sentido NA CENA, o exemplo do card É a
        fala com `<b>`, e o áudio entra sob `audioKey(example_en CRU — com as tags <b>)`.
        ⚠️ Descoberta da rodada: o pipeline INTEIRO (playSrsTTS/preGenerateAudio) chaveia o
        áudio pelo texto COM tags — a chave "limpa" nunca seria encontrada.
      · **"Preparar para assistir"**: cruza a legenda com words[] (stoplist EN + flexões
        triviais), lista as desconhecidas por frequência, manda as marcadas para Revisar e
        grava a **cobertura** (% conhecido) no vídeo — aparece na biblioteca;
      · **marcadores** (tecla M ou botão) → lista com a fala da legenda → vira seleção;
      · **tradução por fala** cacheada no cue, exibida BORRADA até o hover (recall);
      · **"Rever a cena"** no verso do card de estudo (`card.clipId` → `reverCena()` no core
        → video.js consome `_pendingClipPlay`); toca só o trecho e para no fim.
    - **Bugs pegos na validação**: duração `Infinity` de webm do MediaRecorder persistida
      (guard `isFinite`); "rever a cena" pedindo o arquivo mesmo com o File na memória
      (vinha da view Preparar); hot-reload de módulo lazy com `let` top-level não re-executa
      (limitação de teste, não do app).
    - **Integrações mínimas fora do módulo**: `study.js` só ganhou o botão "Rever a cena";
      sync ganhou 2 docs aditivos; `sw.js` serve video.js network-first como os outros lazy.
    - Vídeo NÃO está na barra inferior do celular (decisão: notebook); 0 overflow nas 8 telas.
      `CACHE`: `englab-v42` → **`englab-v43`**.

### Sessão 2026-08-01 (17ª rodada) — Estudo de escopo: vídeo + legendas (SEM código ainda)
68. **Pedido**: analisar uma funcionalidade nova — adicionar vídeo (série/filme) com legenda,
    criar legenda do zero, buscador automático de legenda, quebrar o vídeo em pedaços e levar
    cortes exatos para o estudo — "vá muito além do que eu disse".
    - **Entrega: [`PLANO-VIDEO.md`](./PLANO-VIDEO.md)** — análise completa de viabilidade,
      arquitetura proposta, custos, 4 fases e ideias complementares. Resumo das conclusões:
      · As 4 coisas pedidas são viáveis NO NAVEGADOR. Princípio estrutural: **o vídeo nunca
        sobe para o Firebase** (300 MB–2 GB × limite de 1 MB/doc) — sincronizam legenda,
        clipes `{início,fim}` e áudios pequenos dos cortes (mecanismo de sync de áudio já
        existe). O Djemeson confirmou: o vídeo é descartável depois da extração.
      · Cortes = **virtuais** (`currentTime`), sem processar nada; a legenda é o picotador.
      · Arma secreta: card SRS com o **áudio real da cena** (captureStream + MediaRecorder)
        no lugar do TTS.
      · Ideia de maior valor/esforço: **"Preparar para assistir"** — cruza a legenda inteira
        com `words[]` e apresenta as palavras desconhecidas ANTES do episódio.
      · Busca automática de legenda exige 1 função serverless na própria Vercel (CORS);
        alternativa zero-infra é semi-manual.
      · Whisper de episódio inteiro é o único ponto pesado no browser (ffmpeg.wasm);
        é o argumento real para um futuro app desktop (Tauri com o MESMO código web,
        sync de graça) — decisão adiada, navegador primeiro.
    - **Decisões tomadas na mesma sessão** (todas na recomendação): vídeos = arquivos locais;
      aparelho do vídeo = notebook; função serverless na Vercel = aceita (fase 3); MVP =
      player + importar .srt + transcript clicável + cortes A–B + card com áudio real da cena
      + "Preparar para assistir". Próximo passo: implementar a fase 1 do plano.

### Sessão 2026-08-01 (16ª rodada) — Estudar parava de transbordar no celular
67. **Pedido**: corrigir o transbordo horizontal que eu tinha achado (e confirmado na versão
    publicada) na tela Estudar a 375px — a página rolava **63px** para o lado.
    Duas causas, as duas do tipo "grid/tabela que não encolhe":
    1. **`.srs-dashboard` era `repeat(3,1fr)`** — e `1fr` é `minmax(AUTO,1fr)`: os rótulos
       ("PARA REVISAR HOJE", "NOVOS DISPONÍVEIS") seguravam cada coluna acima de 1/3 e as três
       somavam **373px num container de 310px**. Existia uma regra de 2 colunas no bloco mobile,
       mas era **letra morta**: a declaração de 3 colunas vem DEPOIS no arquivo com a mesma
       especificidade e vencia mesmo no celular. Agora é `minmax(0,1fr)` (o track pode encolher)
       e, abaixo de 700px, o cartão perde 24px de padding e o rótulo usa `--fs-3xs`.
       Resultado: 3 cartões de 98px a 375px e de 79px a 320px, com o texto legível.
    2. **`.srs-deck-table` tem 393px de largura mínima** (cinco colunas de números) dentro de um
       cartão de 347px, e o wrap estava com `overflow` visível — quem rolava era a **página**.
       Agora `.srs-deck-table-wrap{overflow-x:auto}`: a tabela rola dentro do próprio cartão.
    > Lição: `1fr` não é "um terço" — é "no mínimo o conteúdo". Em grade de cartão com rótulo
    > por extenso, `minmax(0,1fr)` é o que realmente divide a largura.
    - **Validado ao vivo**: **0 de scroll horizontal nas 7 telas a 320px e a 375px** (era 63px),
      tabela rolando dentro do cartão (83px de scroll interno), desktop intacto (padding 20px,
      número 40px, 3 colunas de 355px, tabela sem barra) e 0 erros de console.
      `CACHE`: `englab-v41` → **`englab-v42`**.

### Sessão 2026-08-01 (15ª rodada) — Dashboard: 443px de moldura antes do primeiro dado
66. **Pedido**: "ao entrar na dashboard tenho a impressão de que o espaço não está sendo bem
    aproveitado... informação sendo cortada, botões muito grandes e cabeçalhos grandes
    empurrando outras informações pra baixo."
    - **Medido a 1640×900**: **443px** (49% da tela) de cabeçalho + hero + métricas + abas antes
      do primeiro dado — por isso a linha de estatísticas do calendário aparecia cortada na
      dobra. E a seção parava em **1180px** com **1336px** de área útil disponível.
    - **Vertical (443 → 347px, −22%)**:
      · cabeçalho 80 → 65px (título `--fs-xl` → `--fs-lg`, margens 26/16 → 18/12);
      · hero 117 → 81px (padding 24 → 16, número `--fs-3xl` → `--fs-2xl`);
      · métricas 80 → 64px (padding 16 → 12, ícone 42 → 36, valor `--fs-xl` → `--fs-lg`);
      · abas e respiros 22/18/20 → 16/14/14.
    - **Horizontal**: `#section-dashboard` vai a **1336px** e, acima de 1280px, o `.dash-grid`
      vira **2fr 1fr** — a coluna do calendário é a que converte largura em informação. Efeito
      colateral bom: com 873px de coluna o heatmap volta a mostrar **52 semanas** (o ano
      inteiro), sem barra de rolagem, o que a 14ª rodada tinha reduzido a 39.
    - **O hero agrupava mal**: `justify-content:space-evenly` jogava "123 revisões" e "50 novos"
      para as pontas — o vazio tinha saído do meio do cartão e ido parar ENTRE os números.
      Agora os dados andam juntos e só o botão vai para a direita.
    - **Botão principal**: a sombra de 18px a 40% (brilho de template) virou 8px a 22%.
    - **Colunas do painel Progresso reorganizadas por ALTURA medida**: com [calendário + volume]
      à esquerda e só a taxa de acerto à direita, a coluna da direita terminava **653px** antes
      da outra. Trocando a taxa de acerto (cartão baixo) para junto do calendário, a diferença
      cai para ~220px.
    - **Cabeçalho de cartão em coluna estreita**: o `space-between` espremia o título contra o
      valor da direita e "Volume de Estudos" quebrava em duas linhas, empurrando o gráfico para
      baixo. Com `flex-wrap`, quem desce uma linha é o valor — o dado secundário.
    - ⚠️ **O cabeçalho compacto vale para as 7 telas**, não só para o Dashboard: um título que
      encolhe ao entrar numa aba e cresce na outra seria uma inconsistência visível a cada
      clique. As outras seis ganham os mesmos ~40px.
    - **Validado ao vivo** em 1640×900 e 1280×860: painel inteiro cabendo na tela (879px de
      página para 860px de viewport, contra 1225px antes), 0 erros de console, 0 scroll
      horizontal, heatmap sem barra, e as 6 outras telas mantendo largura e layout próprios.
      `CACHE`: `englab-v40` → **`englab-v41`**.

### Sessão 2026-08-01 (14ª rodada) — Heatmap volta para a coluna; quem encolhe é o histórico
65. **Correção do rumo da 13ª rodada**: eu tinha resolvido a barra de rolagem alargando o cartão
    para a seção inteira. O Djemeson recusou — *"vc ocupou toda a seção em que ele está. não
    quero isso. deixa como era antes. vc pode resolver o problema inicial removendo meses pra
    trás."* Correto: a barra era o problema, o layout não.
    - **Layout revertido**: o cartão voltou para a coluna `1.7fr` do `.dash-grid`, junto com
      "Volume de Estudos", e "Taxa de acerto" na coluna da direita — exatamente como era.
    - **O que resolve agora é o histórico**: a célula fluida e o `dashHmSemanas()` continuam,
      mas medindo a COLUNA (não a seção). Resultado medido: **39 semanas a 1440px, 40 a 1024px,
      17 a 375px** — em vez das 53 fixas. Perde-se de 3 a 8 meses de passado; ganha-se um
      calendário que cabe inteiro na tela, que era o pedido.
    - **`dashHmLarguraUtil()`**: mede o `.dash-hm-container` da renderização anterior (fonte
      exata); só na PRIMEIRA vez estima a coluna (`(painel-18)*1.7/2.7`, ou o painel inteiro
      abaixo de 1040px, onde o `.dash-grid` vira uma coluna só).
    - **`dashHmWrapHTML(semanas)` + `dashHmAjustar()`**: a grade foi extraída para uma função
      porque agora é montada DUAS vezes — uma com a estimativa e, se a medida real pedir outro
      número de semanas, reconstrói só o miolo da grade (não o painel).
    - ⚠️ **Bug de alinhamento que só a medição pegou**: com célula fluida, os rótulos
      Seg/Qua/Sex desciam ~0,9px por linha (**5,25px acumulados no "Sex" a 375px**). Causa: a
      coluna de rótulos era item flex e a altura MÍNIMA do texto (7 × 10,4px) inflava a linha
      para 113px enquanto a grade tinha 84px. `min-height:0` **não** resolve — o que conta para
      a altura da linha flex é o tamanho de CONTEÚDO do item, não o seu mínimo. Solução: tirar
      a coluna do fluxo (`position:absolute; top:23px; bottom:0`), onde ela não opina sobre a
      altura e fica amarrada exatamente à área da grade. Desalinhamento final: **0,01px** em
      1440/1024/375px.
    - **Validado ao vivo**: barra de rolagem = 0 nas três larguras, layout de 3 cartões idêntico
      ao original (699 + 699 + 411px a 1440), 28 células de previsão preservadas, ajuste
      sobrevivendo à troca de aba, 0 erros de console.
      `CACHE`: `englab-v39` → **`englab-v40`**.

### Sessão 2026-08-01 (13ª rodada) — Heatmap fluido: fim da barra de rolagem
64. **Pedido**: "existe uma barra pra poder arrastar pro lado e ver o restante. não quero que
    tenha a barra. analise como deixar mais funcional."
    - **Causa medida**: a grade tinha largura FIXA — 57 colunas × 14px = **795px** — dentro de
      uma coluna de **412px** (o cartão vivia no `1.7fr` do `.dash-grid`). Os 383px de diferença
      viravam barra de rolagem: metade do ano ficava atrás de um arrasto que ninguém dá. A
      previsão da 12ª rodada tinha sido remendada com `scrollLeft` no fim — remendo no sintoma.
    - **Três mudanças, nesta ordem**:
      1. **O cartão saiu da coluna e ocupa a largura toda** do painel (`dash-card-wide`);
         "Volume de Estudos" e "Taxa de acerto" continuam lado a lado embaixo. Um ano de dias
         nunca ia caber em 412px — a coluna estreita era o erro de origem.
      2. **Célula fluida**: `grid-template-columns: repeat(N, 1fr)` + `aspect-ratio: 1`.
         A grade passa a ocupar exatamente a largura disponível, qualquer que seja —
         **overflow deixa de ser possível por construção**, não por ajuste.
      3. **`dashHmSemanas()` decide quantas semanas cabem** (mede o painel, desconta padding/
         coluna de dias/gap, divide por um passo de 12–14px e limita a 53). A célula nunca
         fica menor que ~10px; o que varia é o tamanho da janela de histórico.
    - **Teto de 16px por coluna**: sem ele, poucas colunas numa tela larga viravam quadrados de
      35px (visto ao medir a 1440px antes do re-render).
    - **Rótulos de mês em `calc(% + px)`**: com célula fluida, `left` em px mentiria. A fórmula
      exata da posição da coluna i numa grade de N colunas `1fr` com gap g é
      `i/N*100% + i*g/N`.
    - **Seg/Qua/Sex acompanham a altura variável**: a coluna estica junto (`align-self:stretch`)
      e divide a altura em 7 partes iguais com o mesmo gap. Medido: **0px de desalinhamento**
      em 1440/1024/800px e 1–2px a 375px (arredondamento de subpixel).
    - **Listener de resize** (debounce 220ms) redesenha só quando o número de semanas que cabe
      muda — os `let` de estado ficam no TOPO do arquivo, pela lição do item 52 (zona morta).
    - **Validado ao vivo** em 1440 / 1024 / 800 / 375px: **barra de rolagem = 0 em todos**,
      célula 13 / 11,5 / 11,8 / 10px, janela de 53 / 40 / 24 / 17 semanas de passado + as 4 de
      previsão, última coluna dentro do container, sem scroll horizontal na página, previsão
      preservada (as últimas células continuam `fut`) e 0 erros de console.
      `CACHE`: `englab-v38` → **`englab-v39`**.

### Sessão 2026-07-31 (12ª rodada) — O heatmap passa a mostrar o que vem pela frente
63. **Pedido**: "no heatmap mostrar as previsões de cards a estudar nos dias à frente de hoje".
    O calendário terminava em hoje — era um retrovisor, e o SRS é justamente a promessa de que
    a carga de amanhã já está decidida.
    - **Janela**: 371 dias para trás + **28 dias (4 semanas) para a frente**
      (`DASH_HM_PAST` / `DASH_HM_FUT` em `js/dashboard.js`).
    - **`dashForecast(dias)`**: conta os cards já agendados por dia de vencimento.
      **Cards `new` ficam de fora de propósito** — não têm data marcada, entram pelo limite
      diário (`srsCfg.newPerDay`) no dia em que a sessão for aberta; contá-los inventaria carga
      num dia que o calendário não sabe qual é. Atrasados e o próprio hoje também não entram
      (hoje continua sendo o que foi REVISADO, e o bloco "Hoje" da sidebar já mostra o restante).
    - **Passado cheio, futuro vazado**: as células do futuro usam a mesma escala de volume
      (≤5 / ≤15 / ≤30 / +30), mas com anel em vez de preenchimento — carga prevista não pode
      ser lida como esforço já feito. Dia sem nada agendado continua na textura neutra, igual
      a um dia passado sem estudo. Medido nos 6 temas: o anel do nível 1 (1,50–1,82:1 contra o
      cartão) é **mais visível** que o preenchimento do nível 1 do passado (1,29–1,47:1), e o
      nível 4 bate exatamente com o passado (4,36–7,15:1) — as duas rampas têm o mesmo alcance.
    - **Hoje ganhou anel** (`--text2`): sem ele, a fronteira cheio|vazado sumia quando os
      últimos dias não tinham nem estudo nem previsão.
    - **Legenda** ganhou separador + "Previsto", e a linha de estatísticas ganhou a 6ª:
      **"Próx. 7 dias"** — o total que as células distribuem mas não somam.
    - ⚠️ **A grade abria pela coluna mais ANTIGA**: com ~57 colunas, hoje e a previsão nasciam
      fora da tela até alguém arrastar. Agora o painel nasce com `scrollLeft` no fim.
    - **Validado ao vivo** com `srsLog`/`srsCards` sintéticos: 399 células (371+28), previsão
      por dia batendo item a item (4→f1, 14→f2, 22→f3, 41→f4, dia vazio sem nível), os 50 cards
      `new` ignorados, atrasados e hoje fora da previsão, "Próx. 7 dias" = 81 conferido na mão,
      rótulo de mês futuro aparecendo, scroll no fim depois de trocar de aba, sem cards nenhum
      não quebra, 0 erros de console e mobile 375px (estatísticas em 3×2, sem scroll horizontal
      na página). `CACHE`: `englab-v37` → **`englab-v38`**.

### Sessão 2026-07-31 (11ª rodada) — A imagem do card passa a ilustrar O SENTIDO, não a palavra
62. **Pedido**: um print do card de "tally" no sentido **2/2** ("bater, concordar com") com uma
    imagem de **marcas de contagem** — o sentido 1. "Já foi a segunda tentativa."
    - **Causa raiz no prompt, não no modelo**: `generateCardImage` montava
      `...flashcard image for the word "tally". Meaning: "bater, concordar (com)"` — a palavra
      estrangeira em destaque e o significado em **português** para um modelo que só entende
      cena. Ele ancorava no sentido mais comum da palavra e ignorava o resto. Nada no prompt
      dizia que existia outro sentido, nem que ele era proibido; e a frase de exemplo
      ("evidence presented in court") ainda empurrava para o tribunal do print.
    - **Correção — descrever a cena antes de desenhar**: novo **`buildImageScene(card)`**
      (`js/audio.js`, não-lazy) faz uma chamada de texto barata (gpt-4o-mini, ~US$ 0,001 = 2%
      do custo da imagem) que recebe a palavra, o sentido, a definição, a frase **e a lista dos
      OUTROS sentidos como proibição explícita**, e devolve `{"scene": "..."}`: uma cena
      concreta em inglês, incompatível com os outros sentidos. **A palavra não vai mais para o
      modelo de imagem** — era justamente ela que puxava para o sentido errado.
    - **Proibições reforçadas**: o antigo "No text or lettering" virou "No text, letters,
      numbers, symbols, **tally marks**, signs or captions" — as marcas de contagem do print
      passavam pela regra antiga.
    - **Fallback**: se a descrição falhar (chave inválida, rede), o prompt antigo continua
      valendo — pior para palavra polissêmica, melhor que não gerar nada. O botão mostra
      "Descrevendo..." e depois "Gerando...".
    - **Custo**: `_aiUnitUsd('image')` passou a somar a chamada de texto, então a estimativa em
      reais dos lotes continua honesta.
    - **Validado ao vivo com `fetch` stubado** (zero dólar gasto): com "tally" sentido 2, o
      prompt de texto lista `"contagem, registro"` como proibido e o prompt de imagem sai
      **sem a palavra**, só com a cena + proibições; com a chamada de texto retornando 401, cai
      no prompt antigo e ainda gera. `CACHE`: `englab-v36` → **`englab-v37`**.

### Sessão 2026-07-31 (10ª rodada) — Sessão de estudo usa a tela inteira + mobile
61. **Pedido**: "muita margem nas laterais, sem aproveitamento — a imagem podia ser bem maior;
    ajuste para o mobile também". Causas: `.srs-session-wrap` preso em **800px** e a coluna de
    imagem **fixa em 220px**.
    - **Sessão: 800 → 1240px.** Quem protege a leitura é o limite de MEDIDA do texto (72ch no
      verso, 70ch na frase da frente) — a largura extra vai para a **imagem**, que agora cresce
      com `clamp(280px, 34%, 460px)`. Medido a 1720px com sidebar recolhida: sessão 1180px,
      imagem **389px** (era 220), texto em 564px.
    - **Verso sem imagem**: wrapper `.srs-back-text-solo` — card largo, texto centrado em
      medida legível (não vira linha de 120 caracteres).
    - **MOBILE — bug real prevenido**: a navegação inferior fixa (68px, z-index 999) ficaria
      POR CIMA da barra de notas sticky (z-index 60). Em ≤768px a barra ancora acima da nav
      (`bottom:76px`, fundo sólido; a 1ª medição a 68px ainda deixava 6px de sobreposição —
      afinado). Medido: barra em y=714, nav em y=744, sem sobreposição, botões com 63px de
      altura (alvo de toque ok).
    - `CACHE`: `v35` → **`v36`**.



### Sessão 2026-07-31 (9ª rodada) — Verso do card de estudo (print da sessão real)
60. **Pedido**: "algo que podemos fazer, melhorar, corrigir ou construir aqui?" com um print do
    verso do card em sessão. Quatro achados, quatro correções:
    1. **Os botões de avaliar caíam abaixo da dobra** — com o box de Origem + imagem o verso
       fica alto e o print mostrava as notas cortadas no rodapé; avaliar exigia rolar, o pior
       atrito possível no meio de uma sessão. A barra de notas agora é **sticky** no rodapé da
       viewport (z-index 60, gradiente para o conteúdo não vazar por baixo). Vale também para
       o modo histórico.
    2. **`série · Inglês::Vocabulary`** — o separador `::` (jargão de caminho do Anki) vazava
       na interface. `getSrsDeckPath` agora usa ` › ` (vale também para o painel de foco do
       baralho no Estudar).
    3. **O 2º botão de áudio tinha como rótulo a própria palavra** ("🔊 tally" logo abaixo da
       palavra gigante) — virou **"Pronúncia"**.
    4. **`configurações`** (minúsculo, vago) virou **"Editar card"** com ícone de lápis; o
       botão de regenerar frase trocou o glifo cru `↻` por `ic('refresh')`.
    - **Validado ao vivo** (Vercel, v34): caminho "Inglês › Vocabulary", botões "Repetir frase
      | Pronúncia | Gerar imagem", summary "Editar card", barra de notas `position:sticky`
      visível na viewport mesmo com verso alto (origem longa), 0 erros de console.



### Sessão 2026-07-31 (8ª rodada) — Revisar e Biblioteca: o que a estrutura deles pedia
59. **Pedido**: "estude o que a estrutura deles pede" — as duas telas que ficaram fora do
    padrão de grupos numerados. Conclusão do estudo: são **ferramentas de trabalho contínuo**
    (mestre-detalhe no Revisar; browser de três colunas na Biblioteca), não fluxos em passos —
    esticar o padrão da Mídia nelas seria forçado. O que a estrutura pedia era outra coisa:
    - **UM idioma de controle segmentado.** O app tinha TRÊS desenhos para o mesmo trabalho:
      `.seg-tab` (painel/configurações — ativo = cartão claro + sombra), `.rsb-filter`
      (Revisar — ativo = pílula com gradiente do acento) e `.lmt-btn` (Biblioteca — idem).
      Os três agora computam **exatamente o mesmo estilo de ativo** (verificado ao vivo:
      mesmos valores de fundo e cor nos três). Só CSS; nenhuma classe ou handler mudou.
    - **Cabeçalho da Biblioteca**: 6 controles misturando naturezas — trocar de visão
      (toggle Cards|Palavras), ação de uso diário (Ouvir playlist) e TRÊS operações pesadas de
      IA que rodam raramente e custam dinheiro (Negrito perfeito, Completar dados, Reanalisar
      tudo). As três foram para um **menu "Manutenção IA"** (popover com título + descrição
      por item, clique-fora fecha, `aria-haspopup`/`aria-expanded`). Cabeçalho final: toggle +
      playlist + menu. **Os ids originais foram preservados nos itens do menu** — o código de
      progresso (que salva/restaura `innerHTML` durante os lotes) continua funcionando sem
      mudança. No modo Palavras o gatilho some inteiro (antes 3 botões sumiam um a um).
    - **Validado ao vivo** (Vercel, v33): os 3 segmentados com estilo de ativo idêntico,
      cabeçalho da Biblioteca reduzido a "Ouvir playlist | Manutenção IA", menu abrindo com os
      3 itens, clique-fora fechando, gatilho sumindo no modo Palavras e voltando no Cards,
      0 erros de console.



### Sessão 2026-07-31 (7ª rodada) — O padrão da Mídia vira a linguagem do app + escala de tamanhos
58. **Pedido**: o Djemeson apontou a aba Mídia como referência ("organização e estrutura bem
    montada") e pediu o mesmo para todos os painéis, mais uma análise de TAMANHOS.
    - **Componente compartilhado**: `.midia-group`/`.midia-eyebrow` viraram
      **`.panel-group`/`.panel-eyebrow`** (os nomes antigos seguem como alias). O padrão:
      moldura de cartão + rótulo numerado em caixa alta + agrupamento por passo.
    - **Aplicado em**: Adicionar→Manual ("1 · Item de estudo" com palavra/frase/aviso de
      duplicata; "2 · Fonte" com chips e título; botão de ação fora das molduras);
      Adicionar→Kindle ("1 · Arquivo do Kindle" emoldurando a dropzone; "2 · Destaques
      importados" nos resultados); Estudar (cartões do dia + CTA "Começar sessão" agrupados
      sob **"Hoje"**; a tabela de baralhos virou grupo próprio com rótulo no padrão — o `<h3>`
      avulso saiu).
    - **TAMANHOS — medido ao vivo antes**: CINCO alturas de botão visíveis ao mesmo tempo
      (26, 28, 35, 36, 38px) e controles em 38/42px — o tipo de ruído que ninguém aponta mas
      tira a sofisticação. Agora:
      - **Escala oficial de botões: 44 (`.btn-lg`, ações-herói) / 38 (padrão) / 30 (`.btn-sm`)
        / 24 (`.btn-xs`)** via min-height. O CTA "Começar sessão" estava em 43px por acidente
        de padding e passou a ser grande DE DIREITO (`.btn-lg`); o enviar do chat alinhou em
        44; **exceção documentada**: "Testar chave" fica em 40px de propósito, alinhado aos
        controles de 40px ao lado.
      - **Controles de formulário numa altura única**: token `--control-h` (40px) substituindo
        os 38/42px hardcoded (medido depois: chave, modelo e qualidade todos em 40px).
    - **Validado ao vivo** (Vercel, v32): grupos e rótulos presentes nas três telas, CTA dentro
      do grupo "Hoje", ids críticos preservados (m-word, chips, kindle-drop), 0 erros nas 7
      telas. `CACHE`: `v30` → **`v32`**.



### Sessão 2026-07-31 (7ª rodada) — Sidebar: o vazio vira informação
58. **Pedido**: "essa barra lateral realmente está boa? ela deve ser aqui mesmo? podemos
    melhorar? deixar mais sofisticado?" — a partir de um print. Cada mudança saiu de uma
    medição, não de gosto:
    - **254px de vazio (35% da altura a 1280×720)** entre "Biblioteca" e "Configurações". Espaço
      morto no FIM de uma lista lê como menu inacabado; entre dois blocos ancorados, lê como
      respiro. Novo bloco **"Hoje"** (`#sb-today`) com `margin-top:auto` ancora o fim do menu:
      barra de progresso do dia, "N feitas / N restantes", chama + sequência quando streak > 0,
      estado **"Dia concluído"** (barra verde + check) e clique levando a Estudar.
      Renderizado por **`renderSbToday()` em `js/srs.js`** (não-lazy), chamado dentro do
      `updateSrsBadge()` — herda os 8 call sites que já existiam, então acompanha a sessão de
      estudo em tempo real (usa `srsSession.done`, porque o `srsLog` só é gravado no fim).
      Sem dado nenhum (total 0) o bloco some em vez de mostrar zeros.
    - **"MENU" virou dois grupos**: "Geral" (Dashboard, Assistente) e "Vocabulário" (Adicionar,
      Revisar, Estudar, Biblioteca). Um rótulo que só diz "menu" não informa nada; a ordem dos
      itens **não mudou** (nada de muscle memory quebrada).
    - **Item ativo**: gradiente de 135° + anel interno (o mesmo desenho de template dos
      gradientes já removidos no item 54) → **tinta chapada + marca de 3px encostada na borda
      da barra** (`::before` em `left:-12px`, `-8px` no rail). Escopado em `.sidebar` para não
      vazar para a barra inferior do celular, que usa as mesmas classes `.nav-item`.
    - ⚠️ **Contraste medido derrubou a primeira escolha**: acento como cor do rótulo ativo dava
      **3,28:1 no sepia** e 4,33:1 no violet — reprova AA. O rótulo passou para `--text`
      (8,52–15,32:1) e a cor ficou com o **ícone e a marca**, que são gráfico (alvo 3:1;
      medidos 3,28–7,84). Mesmo problema no contador (acento puro reprovava com 3,12:1 no
      sepia): o texto virou `color-mix(--primary 62%, --text)` → **4,53–8,58:1**. E no número
      da sequência (`--warning` sobre superfície clara = 3,19:1): número em `--text2`
      (5,82–7,58:1), chama em `--warning` como gráfico.
    - **Contadores**: pílula tinta com números tabulares no lugar do sólido com brilho — o
      "183" verde chapado gritava mais alto que o próprio item de menu.
    - **Conta**: o cartão com moldura, sombra e 3 linhas (indicador "Nuvem" + avatar/nome +
      botão "sair" sempre visível) virou **uma linha de 40px sem moldura** — o ponto de
      sincronização mudou para o canto do avatar (mesmo sinal, sem linha própria) e "sair"
      aparece no hover/foco. O avatar ganhou círculo de fundo, então conta sem foto não quebra.
    - **Rail recolhido**: o bloco "Hoje" some inteiro (reduzido a uma barra sem rótulo, virava
      enfeite ambíguo); o badge de Estudar continua dando o sinal do dia.
    - **A barra continua à esquerda**, e essa é a resposta certa: 7 destinos, dois deles com
      contador permanente, e paridade com a barra inferior do celular. Topo custaria os
      contadores e o bloco ambiente.
    - **Validado ao vivo** (servidor local, 6 temas com transições desligadas — a medição de
      cor durante transição é inválida): contraste AA em todos os itens acima, 7 seções sem
      erro de console, estados vazio/normal/concluído, deslogado, rail recolhido (74px, sem
      overflow) e mobile 375px (sidebar oculta, barra inferior intacta, sem scroll horizontal).
      `CACHE`: `englab-v29` → **`englab-v30`**.

### Sessão 2026-07-31 (6ª rodada) — Assistente auditado pelo print + fim dos confirm() nativos
57. **Pedido**: migrar os `confirm()` restantes e auditar o print do Assistente (melhorias,
    correções, layout, design).
    - **IPA com barras duplas (`//ˈbɛtər...//`) — causa raiz no PRÓPRIO prompt**: o
      `consultaSystem()` pedia a pronúncia "entre barras: //" e o modelo obedecia ao pé da
      letra. Agora pede barras SIMPLES com exemplo (`/ˈwɔːtər/`), e `formatConsultaReply`
      normaliza as mensagens **antigas** no render (`//…//` → `/…/`, regex de span curto que
      não encosta em URLs — verificado com `https://example.com/path` intacta).
    - **Exemplos repetidos** (a mesma frase 3× no print): o prompt agora exige exemplos
      genuinamente diferentes (tempos verbais, sujeitos e situações distintas), na linha do que
      o `review.js` já fazia.
    - **Layout do chat**: a bolha da IA esticava a 90+ caracteres por linha — medida travada em
      `min(70ch, 92%)`, line-height 1.65. **Placeholder acompanha o idioma ativo** (dizia
      "em inglês" fixo mesmo com o seletor em espanhol). **Botão copiar** em cada resposta da
      IA (hover, feedback de check, `navigator.clipboard`).
    - **ZERO `confirm()` nativos no app** (eram 15):
      - Os 4 dos lotes de IA eram **confirmação dupla** com o modal de custo — fundidos:
        `aiConfirmBatch` ganhou `opts.detalhe` (os tópicos entram no próprio modal de custo)
        e `opts.sempre` (operações que REESCREVEM conteúdo confirmam mesmo custando centavos:
        reanalisar, negrito, reprocessar variedade).
      - Os 11 restantes viraram `confirmModal`: excluir cards/card/baralho/conversa/itens/
        palavra (danger), sair da conta (copy melhorada: "nada é apagado"), importar backup,
        resetar Kindle, e **"apagar todos os dados" — que era um confirm DUPLO** e virou um
        único modal danger com a lista do que será apagado (inclui o aviso de nuvem quando
        logado) e o lembrete de backup.
      - Funções que eram síncronas viraram async (`deleteSrsCard`, `deleteDeckUI`,
        `deleteConversa`, `deleteSelected`, `deleteWord`, `clearKindleSeen`, callback do
        `importData`).
    - **Validado ao vivo** (Vercel, v29): IPA antigo normalizado e URL preservada, prompt novo
      com as duas regras, bolha em 70ch com copiar no hover, modal "Sair da conta" e "Apagar
      todos os dados" (danger, 4 itens, botão "Apagar tudo"), lote com custo+detalhe no mesmo
      modal, 0 erros de console.



### Sessão 2026-07-31 (5ª rodada) — Custos em reais + modal de confirmação de verdade
56. **Pedido**: os custos estavam em dólar (a OpenAI cobra em dólar) e a janela era o
    `confirm()` nativo — "aquela de quando a pessoa aprende a programar".
    - **Conversão para reais**: `aiUsdBrl()` busca a cotação comercial USD→BRL do dia na
      **AwesomeAPI** (gratuita, sem chave, timeout 3,5s), cacheia 24h no localStorage
      (`el-usd-brl`); se a consulta falhar usa a última cotação conhecida mesmo vencida e, em
      último caso, câmbio fixo 5,50. `aiEstimate`/`aiConfirmBatch` viraram **async** — os 6
      call sites receberam `await`.
    - **`confirmModal()` genérico em core.js** (Promise<boolean>): overlay com blur no padrão
      do `inputModal`, cartão do tema, `role="alertdialog"`, Enter confirma, Esc/clique-fora
      cancelam, foco inicial no botão de ação. Disponível para substituir os demais
      `confirm()` nativos do app no futuro (sair da conta, limpar dados, excluir deck…).
    - **O diálogo de lote virou informativo de verdade**: linhas Operação / Chamadas à OpenAI /
      Modelo (com a qualidade da imagem por extenso) / **Custo estimado em destaque**
      (Newsreader, cor do acento), nota com a cotação usada, e o botão de confirmar carrega o
      valor: **"Continuar — R$ 6,41"**. Limiar de não-interromper mantido (~R$ 0,12).
    - **Validado ao vivo na Vercel**: cotação real da API (R$ 5,08 em 189ms), cache 24h
      funcionando (2ª chamada 0ms), modal com todas as linhas, Cancelar→false, Continuar→true,
      Esc→false, lote barato passa sem modal, 0 erros de console. `CACHE`: **`englab-v28`**.



### Sessão 2026-07-31 (4ª rodada) — Kindle e Mídia a partir de prints de produção
55. **Pedido**: analisar dois prints reais (Kindle com 41 destaques em tradução; aba Mídia
    "cheia de campos") e corrigir/empoderar. Cada mudança nasceu de um defeito visível no print:
    - **BUG de entidades HTML no Kindle**: `&quot;Your fault, Gaius` aparecia CRU na tela — o
      export do Kindle é HTML e o parser (`parseKindleHTML`) nunca decodificava entidades, que
      vazavam para a interface **e para os prompts de IA**. Novo `decodeEntities()` (textarea
      trick) no título/capítulo/texto + **migração leve em `loadKindleQueue`** para consertar
      itens já persistidos na fila. Títulos-nome-de-arquivo ("Emperor_ The Gates of Rome_ A N")
      normalizados por `cleanSourceTitle()` (underscores → espaço).
    - **Kindle — progresso real**: "Traduzindo 41 destaques..." (estático) virou
      "Traduzindo 20/41..." por lote, com rótulo final "tradução concluída".
    - **Kindle — contador vivo**: "Adicionar selecionados (N)" atualiza a cada checkbox
      (delegação de `change`).
    - **Kindle — empoderamento**: botão **"Sugerir alvos (IA)"** — para cada destaque
      selecionado ainda sem palavra-alvo, a IA aponta o melhor item de estudo da frase
      (pool de 4, custo confirmado via `aiConfirmBatch`, reusa `detectKindleWord`). Antes a
      única via era clicar palavra por palavra em 41 frases.
    - **Mídia — estrutura**: a pilha de campos soltos virou **dois passos com moldura**
      ("1 · Fonte": chips + título/contexto lado a lado com placeholders completos — antes
      truncavam sem fechar parêntese; "2 · Material": dropzone compacta AO LADO do textarea).
    - **Mídia — botão único inteligente**: "Extrair material colado" × "Analisar linha a
      linha" exigiam saber a diferença. Agora `midiaDetectMode()` classifica pelo formato
      (mediana de palavras por linha ≤ 8 = lista), o hint anuncia o modo **antes** de rodar e o
      rótulo do botão muda junto ("Analisar 3 linhas" / "Extrair material completo"). As duas
      funções originais continuam por trás — zero mudança de lógica de análise.
    - **Validado ao vivo** (Vercel, v27): parser decodificando (`"Your fault, Gaius," he said
      & laughed.`), fila migrada, 2 grupos na Mídia, detecção lista/artigo/vazio trocando hint
      e rótulo, botões novos no lugar, 0 erros de console.



### Sessão 2026-07-31 (3ª rodada) — Reforma visual "profissional + personalizável" + 4 propostas de IA
54. **Pedido**: "visualmente parece brincadeira de criança — deixe profissional, comercial e
    personalizável" + aplicar as 4 propostas de IA do item 53. O que fazia parecer amador tinha
    nome e contagem:
    - **Acentos néon crus do Tailwind** nos 3 temas escuros (`#34D399`, `#FBBF24`, `#F87171`,
      `#A78BFA` — a assinatura de template) → versões refinadas de **mesma luminância**
      (`#4CC39A`, `#E7BA53`, `#ED7A74`, `#A896E4`; violet `#C4B5FD`→`#BCAAE9`), preservando o
      contraste AA medido nas sessões anteriores (spot-check: warning novo 10.87:1 no fundo).
      Temas claros não mudaram (já usavam tons próprios).
    - **3 gradientes EM TEXTO** (wordmark da sidebar, do header mobile e do login) — o marcador
      nº 1 de template — viraram cor sólida (`Language` em `--text`, `Lab` em `--primary`).
    - **3 glows** (`drop-shadow` atrás de ícones) removidos; glow radial do hero `.45`→`.22`.
    - **`font-weight` 800 → 700** nos 9 pontos (Newsreader em 800 lê como panfleto).
    - **PERSONALIZÁVEL — seletor de cor de destaque** (Configurações → Aparência): 8 acentos
      (padrão do tema, Índigo, Petróleo, Esmeralda, Terracota, Framboesa, Ametista, Dourado)
      aplicáveis por cima de QUALQUER tema. `applyAccent()` em `core.js` sobrepõe só
      `--primary`/`--primary-rgb`/`--primary-d`/`--accent-bright`/`--primary-grad`/
      `--primary-glow` via style do `<html>` — success/warning/error são semânticos e ficam
      com o tema. `cfg.accent` persiste, **sincroniza via Firebase** (push + 2 pontos de pull;
      string vazia é valor legítimo = "padrão") e restaura do backup IDB. Verificado: acento
      sobrevive à troca de tema e o "padrão do tema" limpa as propriedades inline.
    - **As 4 propostas de IA aplicadas**:
      1. **Custo antes de lotes** — `aiConfirmBatch(tipo, n, rótulo)` em Reanalisar tudo,
         Completar dados, Negrito perfeito, Gerar imagens em lote e Gerar áudio ausente.
         Lotes abaixo de ~US$ 0,02 não interrompem (confirmar centavos é atrito).
         `aiEstimate` documenta ordens de grandeza (chat US$0,001/item; TTS US$0,008/frase;
         imagem low/medium/high US$0,011/0,042/0,167).
      2. **TTS `gpt-4o-mini-tts`** com instrução de estilo ("ritmo de aprendiz") e **fallback
         automático para `tts-1`** na mesma chamada (validado com stub: 400 no novo → tts-1 →
         áudio ok). Cache por texto no AudioDB limita o custo do fallback a 1 tentativa extra
         por frase nova.
      3. **Timeout de conexão no streaming** do Assistente: 45s **só até o primeiro byte** —
         aberto o stream, o timer desliga (retry automático em SSE duplicaria a resposta,
         continua sendo o que NÃO fazemos). O streaming também passou a usar `aiModel()`.
      4. **Qualidade de imagem configurável** (aba IA: Econômica/Padrão/Alta) em
         `cfg.imgQuality`, sincronizada, consumida por `aiImage()`.
    - **Validado ao vivo (Vercel, cache v26)**: cores novas aplicadas, 0 gradientes-em-texto
      no DOM, 8 bolinhas de acento funcionando (Terracota → `--primary` muda, grad recalculado,
      sobrevive à troca de tema, padrão limpa), select de qualidade com os 3 níveis, estimador
      coerente (30 imagens: US$1,26 medium / US$0,33 low), fallback de TTS comprovado, 7 telas
      sem erro de console.



### Sessão 2026-07-31 (2ª rodada) — Reestruturação da camada de IA (gateway único)
53. **Pedido**: auditar tudo que a IA faz (análise, TTS, imagens, cards, lotes) e aplicar
    melhorias/correções/reestruturação. Inventário: **16 pontos de chamada em 6 arquivos**,
    com **5 implementações duplicadas** do mesmo fetch JSON e três defeitos sistêmicos:
    nenhuma chamada tinha **timeout** (rede pendurada = spinner infinito), nenhuma tinha
    **retry** (um 429 no meio de um lote — Kindle 25 itens, enriquecimento, pool de áudio —
    perdia itens em silêncio) e os erros subiam como "HTTP 401" **sem a mensagem real** da
    OpenAI.
    - **Novo `js/ai.js`** (NÃO-lazy, carregado após `lang.js`; incluído no SHELL do sw.js):
      `aiJSON` / `aiText` / `aiTTS` / `aiImage` / `aiTestKey` / `aiModel()`. Timeout por
      AbortController (90s chat, 60s TTS, 180s imagem), retry 2× em 429/5xx/queda de rede com
      backoff e respeito a `Retry-After`, 4xx real nunca retenta, mensagem de erro da API
      exposta ao usuário, e `max_completion_tokens` automático para gpt-5/o* (rejeitam
      `max_tokens`). **Streaming do Assistente fica FORA por desenho** — retry automático em
      SSE duplicaria a resposta na tela.
    - **Correções achadas na auditoria**:
      - Lote do Kindle e análise linha-a-linha usavam **`gpt-4o` hardcoded** (≈30× o preço do
        mini) e `_openaiJSON` caía em gpt-4o com cfg vazia — o resto do app usa gpt-4o-mini.
        Unificado via `aiModel()`.
      - `AI_MODELS` listava **Anthropic/Google, mas TODAS as chamadas vão para api.openai.com**
        — selecionar outro provider mandaria `claude-*` para a API errada e quebraria toda a
        IA. Catálogo agora é só OpenAI (4o-mini padrão, 4.1-mini, 4o, 5-mini, 5) e `aiModel()`
        ignora um `cfg.aiModel` não-OpenAI vindo da nuvem.
      - **"Gerar imagens" em lote re-gerava (e re-PAGAVA) imagens existentes** — a deduplicação
        era só dentro da seleção. `generateCardImage(id, el, force)`: lote passa `force=false`
        e pula quem já tem (reportando quantas economizou); botão individual mantém regeneração.
      - Prompt de imagem pedia *"verify before finalizing, reject and redo"* — modelo de imagem
        não itera; instrução impossível. E o `example_en` ia com `<b></b>` cru para o prompt.
      - `fetchAudioBase64`: **zero chamadores**, removida.
    - **UI nova (aba IA)**: o **seletor de modelo voltou** (a reforma do AI Studio tinha
      removido o `<select>` e deixado o modelo inescolhível) e botão **"Testar chave"** via
      `GET /v1/models` (não consome token), com resultado inline.
    - **Validado ao vivo na Vercel com fetch stubado**: retry 429→500→200 em 3 tentativas;
      401 não retenta e expõe "Incorrect API key provided"; sem chave → mensagem amigável;
      `claude-*` na cfg → cai no default; análise ponta-a-ponta via gateway populando
      meanings/ipa; lote de imagem pulando existente (`skip`, 0 chamadas) e force regenerando;
      seletor com os 5 modelos; 7 telas sem erro de console. `CACHE`: **`englab-v25`**.
    - **Propostas ANOTADAS, não aplicadas** (decidir com o Djemeson): estimativa de custo antes
      de lotes grandes; TTS `gpt-4o-mini-tts` (mais barato e com instruções de estilo) no lugar
      do `tts-1`; timeout+retry de conexão para o streaming do Assistente; `quality`/`size`
      configuráveis na geração de imagem.



### Sessão 2026-07-31 — Abas: informação solta vira informação organizada
52. **Pedido**: "aplique abas sofisticadas e inteligentes onde for necessário — na dashboard tem
    muita informação solta". A decisão de ONDE foi medida, não achada:

    | Tela | Rolagem | Blocos | Recebeu aba? |
    |---|---|---|---|
    | Dashboard | **2,2×** | **13** | sim |
    | Configurações | 1,2× | 5 | sim |
    | Biblioteca / Estudar / Revisar / Assistente / Adicionar | ≤ 0,8× | 0–1 | **não** |

    Só duas telas justificavam. As outras **não ganharam aba** — pôr aba onde não há acúmulo
    troca rolagem por clique, o que é pior.
    - **Dashboard → 3 painéis**, agrupados pela PERGUNTA que cada bloco responde, não por tipo
      de gráfico: **Progresso** (como estou indo no tempo — heatmap, volume semanal, acerto),
      **Vocabulário** (o que eu tenho e de onde veio — idiomas, fontes, leeches, palavra em
      destaque, adicionadas recentemente) e **Conquistas** (os 6 marcos).
      **Hero e as 4 métricas ficam SEMPRE visíveis acima das abas** — esconder a ação principal
      atrás de uma aba seria trocar bagunça por fricção.
      Resultado: 1980px → **1191/1085/692px** por aba.
    - **Configurações → 4 painéis**, agrupados por INTENÇÃO (quem entra ali quer resolver UMA
      coisa): **Conta**, **IA e áudio** (a chave e a manutenção de TTS vivem juntas porque a
      chave é o que alimenta o áudio), **Aparência**, **Dados**. 1085px → **324px**.
      O botão de salvar saiu do rodapé da página e foi para a aba de IA, a única com campo
      editável — solto no fim, ele sugeria que salvava tudo.
    - **O que faz as abas serem "inteligentes" e não só abas**: só o painel ativo é renderizado
      (os gráficos são SVG montado em string — não vale construir três telas para esconder
      duas); a aba escolhida **persiste** em `el-ui-prefs`, então voltar devolve onde você
      estava; e **as abas avisam o que têm dentro** — Conquistas mostra `2/6` e Vocabulário
      ganha um sinal âmbar com a contagem de cards travando na memória.
    - **Acessibilidade**: `role="tablist"/"tab"/"tabpanel"`, `aria-selected`, `aria-controls`,
      roving `tabindex` e setas ←/→ · Home/End percorrendo as abas, com o foco acompanhando.
    - **Componente compartilhado**: em vez de duplicar, as abas viraram `.seg-tabs`/`.seg-tab`
      e as duas telas usam o mesmo visual, a mesma semântica e o mesmo comportamento.
    - ⚠️ **Dois bugs meus, achados por medição e corrigidos**:
      1. A cirurgia nas Configurações deixou **um `</div>` sobrando** (192 aberturas × 193
         fechamentos). O navegador corrige sozinho, então a tela "funcionava" — mas a árvore
         ficava aninhada errado. Achado por contagem de profundidade, não a olho.
      2. Anexei o estado das abas no **fim** do `settings.js`, mas `fillSettings()` usa
         `_settingsTab` e roda assim que a seção abre → `Cannot access '_settingsTab' before
         initialization` (zona morta temporal do `let`), e a tela de Configurações parava de
         abrir. As declarações foram para o topo dos dois arquivos.
         > Lição registrada: **função que roda no boot não pode depender de `let`/`const`
         > declarado depois no mesmo arquivo** — o hoisting salva a função, não a variável.
    - **Validado**: 42 combinações tema × tela sem problema, teclado e persistência conferidos,
      todos os controles críticos (chave, 6 temas, os 4 botões de dados, login) alcançáveis.
      `CACHE`: `v21` → **`v24`**.



### Sessão 2026-07-30 (4ª rodada) — Auditoria de design do projeto inteiro
46. **Motivo**: o Djemeson reportou um incômodo difuso ("não sei se as cores, ou a bagunça
    visual, o blob, a falta de sofisticação em embutir certas coisas") e pediu uma auditoria por
    ÁREAS, no projeto todo — não só na tela que mostrou. A abordagem foi **medir, não opinar**.
    - **Causa raiz: dispersão de valores.** O que faz uma interface parecer bagunçada quase nunca
      é uma escolha ruim isolada — são muitos valores diferentes fazendo o mesmo trabalho.
      Medido no CSS: **77 tamanhos de fonte distintos** (treze deles espremidos entre 0.7 e
      0.95rem — diferenças invisíveis uma a uma que somadas destroem o ritmo), **36 raios**,
      **47 sombras**, **46 hex + 61 rgba fixos** fora dos blocos de tema, **137 `!important`**,
      **129 `style=` inline no index.html** (374 declarações) e **209 nos templates JS**.
    - **Escala tipográfica** (`--fs-3xs` … `--fs-3xl`, 10 degraus): 255 substituições no CSS +
      101 nos estilos inline. Renderizado no app: 77 → **escala + 8px/9px**, que são atributos
      de SVG do gráfico semanal, não CSS.
    - **Raios** (`--radius-xs/-sm/base/-lg/-pill`): 73 substituições. Sobram só 2–4px em
      detalhes micro, 50% em círculos e os tokens.
    - **Cor**: 44 `rgba()` fixos viraram `color-mix()` sobre `--success`/`--error`/`--purple`/
      `--primary`, então acompanham os 6 temas. Os 22 restantes são `rgba(0,0,0)`/
      `rgba(255,255,255)` em sombras e overlays, onde preto/branco literal é correto.
    - **`--text3` reprovava contraste nos 6 temas** (2.36:1 no midnight, 2.37 no light, 3.11 no
      papel). É o cinza de TODOS os rótulos pequenos do app — sozinho, deixava de 25 a 45
      elementos ilegíveis por tema. Cada tema recebeu um valor calculado caminhando do valor
      antigo na direção do `--text2` do próprio tema até cruzar 4.6:1 contra `--surface` E
      `--bg`. Continua sendo o tom mais leve da hierarquia. **Agora passa AA nos 6.**
    - **Dashboard (o "blob")**: o hero era um retângulo azul chapado de 1120px com **663px de
      vazio** entre o número e o botão, num sistema onde todo o resto é cartão claro com borda.
      Virou cartão da mesma família, com acento no número e numa faixa lateral; o "183" ganhou
      rótulo (antes era um número sem legenda) e a quebra revisões/novos/sequência passou a
      ocupar a folga. **Vão: 663px → 28px.**
    - **Cor sem significado**: os 4 ícones de métrica usavam azul/roxo/verde/âmbar em hex fixo
      sem codificar nada ("96%" era verde tanto a 96% quanto a 12%). Cor que não carrega
      informação é ruído — ficaram neutros.
    - **Dois defeitos de precisão no heatmap**: os rótulos Seg/Qua/Sex ficavam **12px abaixo**
      das linhas correspondentes (medido: 503,517,531 contra 491,505,519 → agora 0px), e o
      primeiro rótulo de mês era cortado ao meio por um `translateX(-50%)` — era o "ul" no lugar
      de "Jul" na tela do Djemeson.
    - ⚠️ **Regressão que eu mesmo causei e corrigi na sequência**: o script da escala tratou
      `html{font-size:16px}` como mais um tamanho de texto e o trocou por `var(--fs-base)`
      (0.95rem). Como `rem` é relativo à raiz, isso virou uma raiz de 15.2px e **encolheu a
      interface inteira em 5%**. Pego ao medir os tamanhos renderizados (apareciam 10.64,
      10.944, 11.248… em vez dos tokens). Restaurado para 16px, com comentário no CSS.
    - **Validado**: 7 telas × 6 temas, 0 erros de console, 0 telas quebradas, raiz em 16px.
    - **Aberto para a próxima rodada** (medido, não corrigido): 47 sombras distintas,
      137 `!important`, 338 `style=` inline restantes (a maioria layout, não tipografia),
      o heatmap com **97% das células vazias** ocupando 344px, e o estado vazio geral do
      Dashboard quando há pouco histórico.
    - `CACHE` do `sw.js`: `englab-v11` → **`v16`** (5 deploys nesta rodada).

### Sessão 2026-07-30 (5ª rodada) — Fecha o que a auditoria tinha deixado aberto
47. **Sombras** — correção do que eu havia afirmado: das 47 "distintas", **32 são brilhos
    coloridos semânticos** (verde no sucesso, azul no primário), variedade legítima, não
    desleixo. Soltas mesmo eram **9 neutras**, agora todas em `--shadow-sm`/`--shadow-card`/
    `--shadow`, mais um token novo **`--shadow-up`** para a barra inferior do mobile (sombra
    ascendente não existia na paleta). Restam **0** sombras neutras literais.
48. **Heatmap** — 97% das células ficam vazias e o `--surface3` dava peso visual próprio ao
    "nada", transformando o cartão num retângulo cinza. O vazio virou textura (13% do
    `--text3`) e os níveis de atividade ficaram mais separados, então os dias estudados saltam.
49. **`!important`: 137 → 19.** Os 118 do bloco `@media (max-width: 768px)` (herança do AI
    Studio) foram removidos com **verificação empírica**: capturei os estilos computados de 17
    seletores-chave a 375px antes e depois. **16 computaram idênticos.**
50. **O 17º revelou um bug real**: o `!important` não protegia nada — estava **atropelando a
    indentação da árvore de baralhos** no celular (todos os subdecks apareciam alinhados com a
    raiz). A indentação passou de `padding-left` inline para a variável `--indent`, que o CSS
    **soma** ao padding, e a regra ganhou especificidade `(0,2,1)` para vencer
    `.srs-deck-table td` do bloco responsivo. Verificado no mobile: raiz 14px, filhos 32px.
    > Lição registrada: `!important` num bloco responsivo costuma esconder um conflito de
    > propriedade, não resolver um. Vale checar o que ele está calando antes de mantê-lo.
51. **Estado final medido** (1440px, 42 combinações tema × tela): **0 problemas**, 0 erros de
    console, 13 tamanhos de fonte (10 da escala + 8px/9px de atributos SVG + 16px da raiz),
    9 raios (5 tokens + 2–4px micro + 50% + pill), 10 formas de sombra.
    `CACHE`: `v17` → **`v20`**.
    - **Ainda aberto**: ~338 `style=` inline de LAYOUT (display/gap/align — os de tipografia e
      raio já saíram), e o estado vazio do Dashboard quando há pouco histórico.



### Sessão 2026-07-30 (3ª rodada) — Fim do n8n, tela de login, filtro de idioma
45. **Pedidos do Djemeson**: remover o n8n ("não vai mais ser preciso mandar link"), filtro de
    idioma na Biblioteca, uma tela de login "linda e sofisticada", e entender por que a chave da
    OpenAI configurada no notebook não aparecia no telefone.
    - **n8n removido por completo**: o n8n existia para UMA coisa — extrair vocabulário de uma
      URL, a única operação que o navegador não faz sozinho (CORS). Saíram: a aba **Website** e
      seu painel (`index.html`), o cartão de configuração, `extractSite`/`renderSiteList`/
      `addSiteSelected` (`add.js`), `testN8nAI` (`settings.js`), o campo `n8nBase` da `cfg`
      (`core.js`) e do sync (`firebase.js`), a variável `siteItems` e a pasta `n8n/`.
      **O app agora é 100% navegador + OpenAI + Firebase**, sem nenhum serviço externo próprio
      para manter. ⚠️ `cfg.n8nBase` pode sobrar no localStorage de quem já usava — é dado morto,
      ninguém lê, não vale migração.
    - **Chave da OpenAI que "não aparecia no telefone" — NÃO era bug.** Li o caminho inteiro
      (`fbPushData` grava a chave com `merge:true` e omite quando vazia; `applyCloudDocs`
      adota campos não-vazios e chama `fillSettings()` se a tela estiver aberta) e testei os 3
      cenários ao vivo, inclusive "a nuvem chega enquanto o usuário está em outra tela": todos
      passaram. A causa é operacional — **é preciso estar logado nos dois aparelhos**, e até
      2026-07-30 o login no domínio da Vercel estava bloqueado no Firebase. Nada na interface
      deixava isso óbvio, o que motivou a tela de login abaixo.
    - **Tela de login — 1ª versão REJEITADA e refeita**: a primeira tentativa era um cartão de
      marketing genérico (marca, título, 3 bullets de benefício, botão). O Djemeson devolveu:
      *"queria uma tela com design lindo e vc só me deu uma tela de informações"* — e estava
      certo, trocando o texto aquilo serviria para qualquer SaaS, não tinha nada de idiomas.
      **Conceito da versão final: a tela É o produto acontecendo.** Um flashcard vivo cicla por
      quatro palavras que só existem em outra língua (`Fernweh`, `dépaysement`, `estrenar`,
      `serendipity`) — aparece a palavra com o IPA, há uma **pausa de recall de ~2,5s**, e o
      significado se revela em verde. É exatamente o gesto que o app ensina, e mostra os 4
      idiomas suportados sem precisar dizer. Ao fundo, o vocabulário como textura: palavras em
      Newsreader itálico derivando a 5% de opacidade. Os 3 bullets sumiram; o texto ficou curto
      e específico. Animação 100% CSS (ciclo de 22s, 4 cards com delay escalonado), sem timer JS.
    - **Tela de login (comportamento)**: aparece na primeira visita de quem não está logado. Entrar é
      **opcional** — o app funciona inteiro sem conta, só não sincroniza — então há sempre
      "Usar só neste aparelho", que grava `el-login-skipped` e não volta a perguntar; sair da
      conta limpa essa flag. Identidade do projeto: título em **Newsreader**, marca do livro
      sobre `--primary-grad`, brilho de fundo no mesmo vocabulário do `--bg-grad`, **tudo em
      variáveis de tema** (funciona nos 6). `role="dialog"`, foco inicial no botão principal,
      trava o scroll do fundo, responsiva (338×614 em 375px, sem rolar) e respeita
      `prefers-reduced-motion` (mostra o 1º card estático já com o significado à vista).
      **Contraste medido nos 6 temas, sobre o fundo do palco**: na 1ª medição o significado —
      a linha mais importante da tela — ficava em **3.77:1** no tema light, o IPA reprovava em
      **todos** (2.36–3.41) e o rótulo do idioma raspava em 4.36 no violet. Corrigido com a
      mesma técnica dos chips (puxar o acento em direção ao `--text` do tema, preservando o
      matiz): **0 reprovações, pior caso 5.70:1**. A única cor fixa é a do botão do Google,
      por exigência da identidade deles.
    - **Filtro de idioma na Biblioteca**: chips com contagem (`Todos 11 · Inglês 6 · Espanhol 3`)
      no **glossário (modo Palavras)**, renderizados só quando há **2+ idiomas** em estudo.
      **Não foi para o modo Cards de propósito**: lá os baralhos (`dk-root-<código>`, criados por
      `ensureLangDecks`) já separam os idiomas na própria árvore — seria redundante. Os totais do
      topo respeitam o filtro; a busca, que é passageira, não mexe neles. Deriva de `srsCards`,
      sem estado novo persistido. Novos: `_libLang`, `libLangCounts()`, `libLangChipsHtml()`,
      `setLibLang()` em `audio.js` e o bloco `.gloss-lang-*` no CSS.
    - **Auto-update do service worker**: o `sw.js` já fazia `skipWaiting()`+`clients.claim()`,
      mas o HTML/JS **já carregado** continuava sendo o antigo até um hard-refresh. Isso me
      enganou **quatro vezes** nesta sessão (cheguei a diagnosticar como bug de código o que era
      `fillSettings` velho em cache) e enganaria o Djemeson a cada deploy, ainda mais no celular.
      Agora `init.js` escuta `controllerchange` e recarrega **uma vez** (guard contra laço).
    - `CACHE` do `sw.js`: `englab-v7` → `v8` → **`v9`**.
    - **Validado ao vivo na Vercel** (cache limpo): tela de login nos 6 temas e em 375px sem
      estouro, "Usar só neste aparelho" fechando e não voltando, filtro de idioma narrando
      11→3→2→11 com os totais certos, chips somindo com 1 idioma só e no modo Cards, as 3 abas
      restantes do Adicionar abrindo, as 7 telas navegando, 0 erros de console.

### Sessão 2026-07-30 (2ª rodada) — Chips de variedade/registro: emoji, contraste e lazy
44. **Pedido**: aplicar o item que ficou de fora da 1ª rodada (os chips de variedade/registro,
    únicos emojis restantes na interface). Ao abrir o código, o que era "trocar 13 emojis" virou
    um bolo de quatro problemas — os três últimos descobertos durante a análise:
    - **(a) Emoji na interface**: bandeiras 🇺🇸🇬🇧🇦🇺🇨🇦🌍 nas variedades e 💬👥🎩🗣📜📖⚙️⚠️ nos
      registros. Em todos os casos **o rótulo de texto ao lado já dizia a mesma coisa**
      ("🇺🇸 AmE", "💬 slang") — o emoji era redundante, não informativo.
    - **(b) Armadilha nº 1 (lazy)**: `VARIETY_LABELS`/`REGISTER_LABELS` eram declarados em
      `js/study.js` (**lazy**) e consumidos por `js/audio.js` (**não-lazy**, glossário da
      Biblioteca). Idem `buildSrsFrente`. Comprovado no console: fora do caminho que carrega o
      study.js, ambos lançam `ReferenceError`. Hoje é **latente** — `_LAZY.biblioteca` aponta
      para `study.js`, então na prática não quebra — mas basta mexer nesse mapa para virar crash.
    - **(c) Cor fixa em hex**, violando "toda cor via variável CSS": 14 regras com `#1d4ed8`,
      `#be185d`, `#0f766e`… iguais nos 6 temas.
    - **(d) Contraste reprovado**, consequência de (c). Medido com um verificador WCAG rodando
      nos 6 temas: **3 a 7 dos 9 chips abaixo de 4.5:1 em cada tema**, pior caso **1.90:1**
      ("arcaico" no midnight) — praticamente ilegível.
    - **Correções aplicadas**:
      - `VARIETY_LABELS`/`REGISTER_LABELS` + os novos `varietyChip()`/`registerChip()`/
        `varietyShort()` foram para **`js/lang.js` (não-lazy)** — que já era a casa de
        `varietyLabel`/`typeLabel`/`langChip`. `study.js` e `audio.js` agora chamam os mesmos
        helpers, o que também **eliminou a duplicação** do bloco de 2 linhas que existia nos dois.
      - `buildSrsFrente` foi para **`js/core.js`** (ao lado do `escB`, que ela usa). Na mudança
        passou a reaproveitar o `escR()` que já existia no core — a versão antiga reimplementava
        o escape de regex inline **três vezes**. **E ganhou escape**: o ramo que insere o `<b>`
        por regex devolvia a frase **crua** para o `innerHTML`; agora sai por `escB()`. Verificado:
        `a <script>x</script> & "b" run by` → `a &lt;script&gt;… &amp; &quot;b&quot; <b>run by</b>`.
      - **Variedade ficou neutra e multi-idioma**: um só caminho para todos os idiomas. Antes o
        inglês tinha bandeiras e espanhol/francês/alemão caíam num fallback com 🌍. Agora usa
        `varietyShort()` — "AmE"/"BrE" no inglês (campo `short` novo em `LANGS.en`) e o rótulo
        próprio nos demais ("Rio da Prata (AR/UY)", "Áustria"). Cor uniforme: são dezenas de
        variedades somando 4 idiomas, pintar cada uma seria arbitrário e não escalaria.
      - **Registro passou a ter cor semântica por FAMÍLIA**, toda vinda do tema: vulgar→`--error`,
        gíria→`--warning`, informal/coloquial→`--purple`, formal/técnico→`--primary`,
        arcaico/literário→`--text2`. A cor diz a família; o texto diz o termo exato.
        "slang" virou "gíria" (a interface é toda em PT).
      - **Fórmula de contraste**: o texto não usa o acento puro — puxa 45% na direção do `--text`
        do tema (`color-mix(… 55%, var(--text))`), com fundo a 12%. Como `--text` é escuro nos
        temas claros e claro nos escuros, a mistura empurra para o lado certo **dos dois lados**,
        sem `if` por tema. Fallback neutro antes das linhas de `color-mix` para navegador antigo.
    - **Resultado medido (mesmo verificador, antes × depois)**: reprovações por tema
      `midnight 7→0, light 3→0, sepia 6→0, emerald 7→0, violet 7→0, papel 3→0`; pior caso
      global **1.90:1 → 4.68:1**. Matizes seguem distinguíveis (vermelho/âmbar/violeta/azul/neutro).
    - ⚠️ **Nota sobre a medição**: a primeira versão do meu verificador lia o fundo via
      `getComputedStyle(body).backgroundColor` — mas o `body` tem `transition:background-color
      .35s`, então eu lia o valor **em transição** e media 5 dos 6 temas contra o fundo errado.
      Corrigido lendo `--bg` direto. Os números acima são os do verificador corrigido.
    - **Validado ao vivo**: helpers disponíveis **sem** o study.js carregado (a correção de (b)),
      glossário com 8/8 chips de registro e 7 de variedade incluindo espanhol e alemão,
      flashcard com chips na frente e no verso, `general` e registro inexistente devolvendo
      vazio, 0 emojis em nós de texto no DOM inteiro, 0 erros de console.
      `CACHE` do `sw.js`: `englab-v5` → **`englab-v6`**.
    - **Armadilha de desenvolvimento encontrada**: o `python -m http.server` não manda
      `Cache-Control`, e o Chrome segurou `styles.css`/`lang.js` antigos por várias recargas —
      inclusive depois de desregistrar o service worker. Truque que resolve: abrir por
      **`127.0.0.1` em vez de `localhost`** (origem diferente = cache separado).

### Sessão 2026-07-30 — Cópia `english-lab-2.0`: git, correções e melhorias transversais
43. **Contexto**: o Djemeson trouxe a pasta `english-lab-2.0` — uma cópia do repositório que
    passou pelo **Google AI Studio** e voltou com trabalho novo (uma camada mobile completa e um
    player de playlist de áudio), mas **sem `.git`** e com o boilerplate do AI Studio por cima.
    Pedido: configurar o controle remoto, achar e corrigir erros, aplicar ajustes e melhorias.
    - **Git configurado**: `git init` + `origin` → `https://github.com/Djemeson/english-lab.git`,
      branch `main` adotando `origin/main` **sem tocar na árvore de trabalho** (`git branch main
      origin/main` + `symbolic-ref` + `reset`, nunca `checkout` — que teria sobrescrito o
      trabalho local). O diff local × remoto era de ~1.400 linhas: mobile header + bottom nav,
      redesenho da tela de Configurações, atalhos de teclado do SRS, estatísticas e gráfico
      semanal no Dashboard, e o player de playlist. **Nada foi enviado ao GitHub** — commit
      local numa branch, push fica a critério do Djemeson.
    - **`.gitignore` criado** (não existia): `node_modules/`, `dist/`, `.env*`, backups JSON
      exportados pelo app, lixo de SO/editor.
    - **Service worker consertado (erro que quebrava o GitHub Pages)**: `js/init.js` registrava
      `/sw.js` com escopo `/` — inexistente em `djemeson.github.io/english-lab/`; e o `SHELL` do
      `sw.js` usava caminhos de raiz (`/index.html`, `/css/...`), o que fazia o `addAll()`
      rejeitar inteiro num 404 e o SW **nunca instalar** em produção. Agora tudo é **relativo**
      (`new URL('sw.js', document.baseURI)`, escopo `./`, `'./index.html'`…), funciona na raiz
      e em subpasta; o install cacheia **um por um** (um 404 não derruba mais o resto);
      `js/consulta.js` (não-lazy, faltava) entrou no shell; `CACHE` foi para `englab-v5`.
    - **PWA**: novos `manifest.webmanifest` e `icon.svg`; `<link rel=manifest>`, `theme-color`,
      `apple-touch-icon` e `color-scheme` no `<head>`. O app já tinha service worker mas não era
      instalável.
    - **Viewport duplicado + zoom bloqueado**: o `<head>` tinha **duas** tags `viewport`, a
      primeira com `maximum-scale=1.0` (impede pinch-zoom — falha de acessibilidade). Sobrou uma,
      sem `maximum-scale`, com `viewport-fit=cover`. Removido também um `<script type="module">`
      vazio.
    - **Variáveis CSS que não existiam** (confirmado ao vivo por `getComputedStyle`): o código do
      AI Studio usava `--surface-hover`, `--font-mono` e `--font-display`, nenhuma definida — o
      painel do player ficava **sem fundo** e as fontes caíam no padrão. `--font-display` e
      `--font-mono` agora são tokens de `:root` (compartilhados pelos 6 temas) e o
      `--surface-hover` virou `--surface2`. `.hm-stat-num` deixou de repetir a família de fonte
      na mão.
    - **`.srb-key` / `.srb-key-inline` sem CSS**: as dicas de atalho (`1`–`4`, `Espaço`) eram
      texto solto. Agora são chips estilo `<kbd>`, e somem em telas de toque (`hover: none`).
    - **Player de playlist (`js/audio.js`) — 5 correções**: (1) **corrida de cards** — pular/voltar
      durante a fala deixava a cadeia `async` antiga terminar depois e chamar `playlistNext()` de
      novo, **pulando um card**; resolvido com token de geração (`_playlistGen`) que invalida
      cadeias órfãs (validado com TTS falso: pular durante a fala avança exatamente 1);
      (2) `playlistDelay` agora é **cancelável** (antes o `clearTimeout` deixava a Promise pendente
      para sempre); (3) a frase era injetada **sem escape** — passou a usar `escB()` como o resto
      do app; (4) bloco de **IPA morto** (o snapshot de `srsCards` não tem `ipa`) removido;
      (5) fecha ao clicar fora, `role="dialog"`/`aria-label`, e as setas/espaço deixaram de
      sequestrar o slider e o checkbox.
    - **Dashboard**: rótulos do heatmap passaram a cobrir o **nº real de colunas** (era fixo em 53,
      e as células de padding do começo deixavam a última coluna sem rótulo); a largura da linha
      de meses agora vem do JS e bate exatamente com a grade (753px = 753px). A legenda do gráfico
      semanal dizia "Erros / Lapso" para a barra que representa o **total revisado** — corrigido
      para "Acertos" / "Total revisado".
    - **Emojis removidos da interface** (pendência antiga, seção 9): varredura em `index.html` e
      em 8 arquivos JS trocando emoji por `ic()` ou removendo quando era redundante (o `toast()`
      já desenha o próprio ícone). Confirmado ao vivo: **0 emojis em nós de texto do DOM** nas
      7 telas. **Exceção deliberada**: o mapa de chips de variedade/registro em `js/study.js`
      (linhas ~694-721) — são 8 símbolos que formam um vocabulário visual próprio; trocar exige
      desenhar 8 ícones e uma passada de design, não um find/replace.
    - **CSS morto removido**: `.tab span{display:none}` no mobile não casava com nada (os rótulos
      das tabs são nós de texto, não `<span>`) e viraria uma armadilha se alguém envolvesse.
    - **Documentação**: `README.md`, `metadata.json` e `.env.example` eram **boilerplate do Google
      AI Studio** (falavam de Gemini, `GEMINI_API_KEY`, `.env.local` — nada disso existe aqui).
      Reescritos. `setup.md` descrevia um app extinto (`plataforma-ingles.html`, AnkiConnect,
      Google Sheets) e `instrucoes-projeto.md` afirmava que o projeto é "um `index.html` único de
      ~220KB com toda a lógica num `<script>`" (falso desde a divisão em `js/*.js`) — ambos
      reescritos. `package.json` ganhou um script `check` (`node --check` em todos os JS) no lugar
      de um `build` morto que nem rodava no Windows.
    - **Marcadores de conflito de merge** (`<<<<<<< HEAD` … `>>>>>>> claude/youthful-thompson-8f87f3`)
      estavam **commitados** no `ESTADO-DO-PROJETO.md`, em dois pontos — inclusive no `main` do
      GitHub. Resolvidos (as duas versões eram complementares, ambas ficaram) e o
      **CI ganhou um guarda** que falha o build se algum marcador voltar, além de uma checagem
      de JSON válido (`.github/workflows/deploy.yml`).
    - **Validado ao vivo** (servidor local + Claude Browser): 0 erros de console nas 7 telas,
      0 IDs duplicados, 0 handlers `onclick` apontando para função inexistente, SW instalando com
      os 14 arquivos do shell, `manifest` carregado, layout mobile (375px) sem estouro horizontal,
      e `node --check` limpo em todos os JS. ⚠️ A ferramenta de **screenshot continua indisponível**
      (timeout) — a validação visual foi por `getComputedStyle`/DOM, como nas sessões anteriores.

### Sessão 2026-07-14 — Dashboard implementado a partir do mockup Claude Design
42. **Contexto**: o Djemeson trouxe o mockup "Dashboard.dc.html" do projeto Claude Design
    "Redesign da aba" (mesmo projeto do reskin "Papel" de 2026-07-13; projectId
    `18938966-2928-4595-80ed-382898ddf0a5`, tem também `Adicionar - Mídia.dc.html`,
    `Canvas.dc.html`, `Estudar.dc.html` e `Gamificação.dc.html` — ainda não implementados).
    Pedido: "implementar" o mockup do Dashboard. Diferente do reskin "Papel" (só CSS), este
    mockup tinha 7 seções **novas** que não existiam (heatmap, tendência, idiomas, leeches,
    palavra do dia, fontes, conquistas) — perguntei ao Djemeson o escopo antes de mexer; ele
    escolheu **"tudo, com dados reais"** (não mockado) em vez de reskin visual só ou pular
    conquistas.
    - **`js/dashboard.js`**: novas funções `dashHeatCells` (371 dias a partir de `srsLog`,
      alinhado p/ começar num domingo), `dashAccuracyTrend` (14 dias, `correct/reviewed` do
      `srsLog`, SVG polyline), `dashLangRows` (agrupa `srsCards` por `lang`/`state`),
      `dashLeeches` (cards com `card.leech`, um chip por palavra), `dashWordOfDay` (escolha
      determinística pelo hash da data — mesma palavra o dia todo — entre cards com
      `origin_pt`, senão qualquer card com `meaning_pt`), `dashSources` (agrupa `words` por
      `source_title`/`source_type`), `dashAchievements` (6 marcos calculados: 1ª palavra,
      50 cards maduros — `state==='review' && interval>=21` —, streak 7 dias, 2+ idiomas,
      100 idioms, 500 palavras — **sem sistema de gamificação novo por trás**, só thresholds
      sobre dados existentes). `renderDashboardGrid`/`renderDashboardAchievements` chamadas
      no fim de `renderDashboard()`. Chip de sequência (🔥 N dias) adicionado ao hero
      existente (`dash-action-card`) só quando `streak > 0` — hero em si NÃO foi tocado
      (já estava bom, gradiente do reskin "Papel").
    - **`index.html`**: `section-dashboard` ganhou `page-header` (padrão das outras seções)
      e dois containers novos — `dash-grid-area` (grade 2 colunas) e `dash-achv-area`
      (conquistas) — preenchidos via JS; `dash-main-action`/`dash-stats-area`/
      `dash-recent-area` (existentes) intocados.
    - **`css/styles.css`**: bloco novo no fim do arquivo (`.dash-hero-streak*`, `.dash-grid`,
      `.dash-card*`, `.dash-hm-*`, `.dash-trend-*`, `.dash-lang-*`/`.dash-lr-*`,
      `.dash-leech-*`, `.dash-wod-*`, `.dash-src-*`, `.dash-badge*`), todo via variáveis de
      tema (`--primary`, `--surface`, `--success`, `--warning`, `--error` etc.) — funciona
      nos 6 temas sem hardcode de cor. Responsivo: grade vira 1 coluna e badges 3→2 colunas
      em telas estreitas.
    - **`js/core.js`**: 2 ícones novos em `ICONS` (`lock`, `heart`) — faltavam para as
      conquistas "Poliglota" e "100 idioms" (os outros 4 ícones do mockup já existiam:
      `pencil`, `sparkles`, `clock`, `book`).
    - **Empty states**: cada seção nova trata a ausência de dados sem quebrar (heatmap todo
      cinza, tendência com mensagem, idiomas/fontes/palavra-do-dia com texto neutro, card de
      leech só aparece se houver algum). Testado ao vivo (servidor HTTP local + Claude
      Browser) com o app **zerado** (sem erro) e com **dados sintéticos injetados via
      console** (`words`/`srsCards`/`srsLog` em memória) cobrindo os 6 temas via
      `getComputedStyle` — grade 2 colunas (1.7fr/1fr), cor do heatmap/badges seguindo
      `--primary` de cada tema, badges bloqueados com opacidade reduzida, chip de sequência
      branco sobre o gradiente do hero. ⚠️ Ferramenta de screenshot do Claude Browser
      indisponível (timeout) nesta sessão também — validação por `getComputedStyle`/
      `get_page_text`, não por captura visual.
    - **Achado (fora do escopo, não corrigido aqui)**: bug pré-existente de pluralização no
      hero (`js/dashboard.js`) — quando `dueToday` é 0, o template gera "0 revisãoões" (o
      sufixo condicional "ões" é concatenado a "revisão", que já não termina em "revis").
      Sinalizado como tarefa separada (`task_36f52dbd`), não uma regressão desta sessão.
    - **Não tocado**: `Adicionar - Mídia.dc.html`, `Canvas.dc.html`, `Estudar.dc.html` e
      `Gamificação.dc.html` do mesmo projeto Claude Design — ficam para sessões futuras se o
      Djemeson pedir.
### Sessão 2026-07-14 (mesma data) — Correção de bug de pluralização no Dashboard
42b. **Motivo**: bug encontrado ao validar a implementação do Dashboard.dc.html (pré-existente,
    não introduzido na sessão). Em [js/dashboard.js](js/dashboard.js:31), `renderDashboard()`,
    a linha do hero (`dash-action-card`) montava a pluralização de "revisão" concatenando um
    sufixo (`'revisão' + (dueToday!==1?'ões':'')`), o que produzia "revisãoões" para qualquer
    `dueToday !== 1` (inclusive 0), já que o singular não termina em "revis".
    **Correção**: trocado para escolher entre duas strings completas —
    `` `${dueToday} ${dueToday!==1?'revisões':'revisão'}` ``. Mudança isolada, sem impacto em
    sync/SRS/dados.

### Sessão 2026-07-13 (2ª rodada) — Precisão do negrito do objeto de estudo (EN + PT)
41. **Motivo**: o Djemeson reportou que o negrito do objeto de estudo (a palavra/expressão
    sendo estudada) está inconsistente e impreciso, tanto na frase em inglês quanto na
    tradução em português. Investigação (agente Explore) mapeou os 7 pontos que geram frases
    com negrito e achou 3 causas raiz reais (nenhuma era bug de renderização — `escB`/
    `allowBold` já preservam `<b>` corretamente em todo lugar; o problema é 100% na geração):
    - **Mismatch schema × regra** em `review.js` (`analyzeWordDirect`) e `audio.js`
      (`regenerateMeaning`): a regra em prosa pedia negrito também no lado PT, mas o EXEMPLO
      de JSON do prompt (o que o modelo mais "copia") mostrava `"pt"` **sem** `<b>` nenhum —
      contradição direta que plausivelmente fazia o negrito do PT sumir nesses dois fluxos.
      Corrigido: os exemplos de schema agora mostram `<b>equivalente</b>` no PT também.
    - **Fase 1 do extrator de documento** (`add.js` → `LIST_SYSTEM`) não tinha NENHUMA
      instrução de negrito pro `doc_example_en` (a frase-semente tirada do documento), e essa
      semente **fica permanente** se a Fase 2 (enriquecimento) falhar pra aquele lote — um
      caminho real e reproduzível pra um card ficar pra sempre com a frase em inglês sem
      negrito nenhum e a tradução vazia. Corrigido: Fase 1 agora pede o negrito na semente
      também (rede de segurança), e a instrução de negrito da Fase 2 (`ENRICH_SYSTEM`), que
      antes estava escondida no meio de um parágrafo denso, virou um bloco de regras próprio
      e explícito.
    - **Validação fraca no botão "Negrito perfeito (IA)"** (`audio.js` → `markBoldAll`/
      `markBoldOne`): tanto o filtro de "quais cards precisam de correção" quanto a checagem
      de aceitação da resposta da IA usavam só `/<b>/i.test(...)` — ou seja, só checavam se
      existia ALGUM `<b>` em algum lugar, não se o negrito estava no lugar certo, era um span
      só, ou não cobria a frase inteira. Um negrito errado (palavra errada, duplicado, ou a
      frase toda em negrito) passava como "corrigido" e ficava assim pra sempre.
      **Corrigido**: nova função `boldSpanOk(s)` (audio.js) exige EXATAMENTE um par
      `<b>...</b>`, não vazio, e cobrindo menos de 85% do texto puro — usada tanto pra decidir
      o que precisa de correção (agora pega negrito ausente E malformado, não só ausente)
      quanto pra validar a resposta da IA antes de aceitar como corrigido.
    - **Prompts padronizados**: os 7 pontos que pedem negrito (review.js, audio.js ×2 —
      `regenerateMeaning` e `markBoldOne`, study.js `regenerateCardExample`, consulta.js
      `srsExtractSystem`, add.js ×2 — `LIST_SYSTEM` e `ENRICH_SYSTEM`) agora seguem a mesma
      regra completa (a de `markBoldOne`, que já era a mais precisa): negrito na forma
      flexionada/conjugada como aparece na frase (não a forma de dicionário), todas as partes
      de uma expressão de várias palavras/verbo separável mesmo com outra palavra no meio,
      idiom inteiro, só a ocorrência principal se o termo repetir, exatamente um span por lado.
    - **Não tocado**: renderização (`escB`/`allowBold`/`buildSrsFrente`) já estava correta;
      `fillMissingAll` (não mexe em exemplos, por desenho); Kindle (não gera frases próprias,
      depende do `review.js` na hora de analisar).
    - ⚠️ **Não testado ao vivo com a API real** (só validação sintática/lógica local — `node`
      não roda no bash deste ambiente conforme já documentado; `boldSpanOk` foi testado direto
      no browser com casos sintéticos). Recomenda-se: (1) analisar uma palavra nova em Revisar
      e conferir o negrito nos dois lados; (2) rodar "Negrito perfeito (IA)" na Biblioteca uma
      vez (ele agora vai pegar bem mais cards que antes, incluindo os com negrito malformado —
      **fazer backup/Exportar JSON antes**, já que reescreve frases); (3) importar um documento
      novo na Mídia e conferir o negrito da semente da Fase 1 se a Fase 2 falhar algum lote.

### Sessão 2026-07-13 — Reskin visual "Papel" + rename para "Language Lab"
40. **Contexto**: o Djemeson trouxe um mockup do Claude Design ("App Redesign.dc.html", projeto
    "Landing page para línguas") com uma linguagem visual nova (fundo "papel" cremoso, azul-tinta
    como acento, tipografia serifada Newsreader nos títulos, cantos mais arredondados, sombras
    mais quentes, hero card em gradiente, chips em pílula). Pedido: "implementar" o mockup.
    - **Decisão de estratégia (validada com o usuário)**: em vez de reescrever o HTML/CSS/classes
      1:1 com o mockup (que exigiria também atualizar as classes hard-coded nas strings de
      template de 7 arquivos JS — dashboard/revisar/estudar/biblioteca/configurações/assistente/
      adicionar — sem suíte de testes, alto risco de quebrar `onclick`/ids ao vivo), foi feito um
      **reskin**: só `css/styles.css` (tokens + restilização de classes já existentes),
      `index.html` (fonte + texto da marca) e `js/core.js` (1 entrada nova em `THEMES`) foram
      tocados. Nenhum id, classe usada por JS ou handler `onclick` mudou de nome.
    - **Tokens globais**: `--radius`/`--radius-sm` 14px/9px → **16px/11px** (`:root`).
      `--shadow`/`--shadow-sm`/`--shadow-card` dos 5 temas existentes recoloridos de preto puro
      para um tom mais quente (mesma opacidade/blur, só a cor muda); `sepia` já era quente, não
      mexido; `hue` de cada tema (`--primary`/`--surface`/`--bg`/etc.) preservado 100%.
    - **Novo 6º tema `papel`** (`[data-theme="papel"]`, claro): paleta literal do mockup mapeada
      para os nomes de variável já existentes (`--bg:#F6F4EF`, `--primary:#2E4BC6`, etc., com
      `--success`/`--warning` dessaturados para não ficarem berrantes em fundo branco). Entrada
      correspondente em `THEMES` (`js/core.js`) — `js/settings.js` já renderiza o seletor de
      temas genericamente a partir do array, **nenhuma mudança nele foi necessária**.
    - **Fonte**: adicionada **Newsreader** (Google Fonts) ao lado de Inter em `index.html`,
      aplicada só em títulos/palavra-chave/números grandes (ver seção 6 acima); todo o resto
      (botões, nav, chips, inputs) continua Inter.
    - **Restilização de componentes** (regras novas no fim de `styles.css`, não edições nas
      regras antigas — vencem a cascata por ordem de origem): hero card do Dashboard
      (`.dash-action-card`) ganhou gradiente sólido + texto branco, mas **só quando o elemento
      não tem `style` inline** (`:not([style])`) — o estado "nada para revisar hoje" usa um
      `style` inline próprio em `dashboard.js` e continua neutro, sem ficar azul por engano.
      Chips/tabs viraram pílula total (`border-radius:999px`); `.btn-primary` ganhou sombra mais
      forte; `.wc-word`/`.srs-card-front-word` (palavra da flashcard) aumentaram de tamanho;
      `.srs-rate-btn` ganhou borda tintada em repouso (não só no hover).
    - **Rename "English Lab" → "Language Lab"** (só texto, na sidebar e no `<title>`) — resolve a
      pendência opcional que já estava registrada na seção 9 por causa do suporte multi-idioma.
      Infraestrutura (repo, URL do GitHub Pages, Firebase) continua `english-lab`.
    - **Validado ao vivo** (servidor HTTP local + Claude Browser, já que `file://` é bloqueado):
      `getComputedStyle` confirmou os 6 temas no seletor, o tema `papel` aplicando os tokens
      certos, o hero card em gradiente com texto branco só no estado populado (o estado vazio
      manteve `--surface` e o ícone verde inline intactos), fonte Newsreader nos seletores certos,
      chips/tabs em pílula (999px), navegação entre as 7 telas (inclusive `adicionar`/`estudar`/
      `biblioteca`, que são lazy-loaded) sem nenhum erro no console, e ausência de qualquer texto
      "English Lab" residual no DOM. ⚠️ A ferramenta de screenshot do Claude Browser ficou
      indisponível (timeout) nesta sessão — a validação visual foi feita via `getComputedStyle`/
      leitura de página, não por captura de tela; vale um hard-refresh + olhada visual manual
      depois do deploy (ver pendências, seção 9).

### Sessão 2026-07-05 (2ª rodada) — botão de IA passou a PRESERVAR exemplos já curados
39. **Motivo**: o Djemeson importou uma leva de estudo de espanhol (`A1.1-leva-01.md`, material
    com exemplos cuidadosamente ordenados por tempo verbal/pessoa) e ficou com medo de clicar em
    "Analisar com IA"/"Re-analisar" (Revisar) por essas palavras já terem exemplo — o `applyAiResult`
    **substituía `w.meanings` por inteiro**, então a IA reescrevia até os significados que já tinham
    frases boas (o prompt só "pedia com jeitinho" pra IA preservar o `_seedMeaning`, sem garantia).
    - **`js/review.js` → `applyAiResult`**: agora faz um MERGE. Significados que já têm
      `examples.length > 0` (vindos de import de doc, de uma análise anterior ou de edição manual)
      são casados com o retorno da IA (por `meaning_pt` normalizado ou por `context_match`) e têm
      `meaning_pt/definition_pt/examples` **preservados** — só completa o que estava vazio (`origin_pt`,
      `type_label`, `variety`/`register` ainda genéricos, `level`, `synonyms`/`antonyms`). Sentidos
      NOVOS que a IA trouxe (que a palavra ainda não tinha) entram do jeito que vieram, exemplos
      inclusos — não há nada pra preservar ali. Campos de nível-palavra (`type`, `type_label`, `ipa`)
      também passaram a só preencher se estavam vazios, em vez de sobrescrever sempre.
      Afeta TODOS os botões que passam por `analyzeWordDirect` (Analisar com IA, Re-analisar,
      Analisar selecionadas, Analisar todas) — correção única no ponto central.
    - **Biblioteca — botão temporário generalizado**: `fillOriginsAll` (`#lib-fill-origin-btn`) virou
      `fillMissingAll` (`js/audio.js`) — em vez de só completar `origin_pt`, agora completa IPA,
      `type_label`, nível E origem, sempre só o que estiver VAZIO (nunca mexe em significado, frases,
      variedade/registro nem agendamento). Botão renomeado para "Completar dados (IA)" — serve pra
      rodar a IA com segurança sobre itens JÁ ADICIONADOS (qualquer leva/import antigo), sem risco de
      perder frases curadas. Ainda um botão TEMPORÁRIO (mesmo ciclo de vida do antigo "Preencher
      origem" — ver pendências).

### Sessão 2026-07-05 — SUPORTE MULTI-IDIOMA (es/fr/de prioritários; genérico p/ qualquer um)
38. **Multi-idioma completo** — decisões do Djemeson: idiomas prioritários **Espanhol, Francês e
    Alemão**; **seletor de idioma ativo + auto-detecção**; **baralho raiz por idioma**; saída
    continua PT-BR. Plano completo em **`PLANO-MULTI-IDIOMA.md`**. Implementação:
    - **`js/lang.js` (novo, NÃO-lazy, carregado logo após core.js no index.html e no sw.js —
      cache bump p/ `englab-v4`)**: registro `LANGS` (en/es/fr/de + `_langFallback` genérico p/
      qualquer código ISO) com variedades, regras de prompt (`varietyRule`/`typeRule`/
      `variantHint`/`ipaNote`) e nome do subdeck de expressões verbais. Helpers: `getLangDef`,
      `activeLang`/`setActiveLang` (persistido em `cfg.activeLang`, sincronizado),
      `wordLang`/`cardLang` (fallback 'en'), `typeLabel`, `varietyLabel`, `langChip`, fragmentos
      de prompt (`promptVarietyRules`, `promptVarietyEnum`, `promptTypeRules`, `promptIpaRule`,
      `promptLangName`, `promptVariantHint`), `ensureLangDecks` (cria `dk-root-<code>` + 4
      subdecks sob demanda; inglês mantém ids legados), `deckIdForWord`, `migrateLangFields`
      (aditiva: words/cards antigos ganham `lang:'en'`; chamada no initApp), `langSelectorHtml`/
      `mountLangSelector` (seletores `#lang-selector-add` e `#lang-selector-asst`).
    - **Taxonomia**: enum `type` mantido como SUPERTIPO universal (`phrasal_verb` = "expressão
      verbal": phrasal/pronominal/separável/perífrase); novo campo **`type_label`** (nome local
      da categoria em PT, ex. "verbo separável (trennbares Verb)") na palavra, nos meanings e no
      snapshot do card. Gíria continua via `register`. Roteamento de deck pelo supertipo.
    - **Prompts parametrizados por idioma**: review.js (análise principal + `detected_lang` p/
      auto-detecção — se divergir, a palavra adota o idioma detectado, cria os decks e avisa),
      add.js (Kindle, clique-na-palavra, linha a linha, extrator de doc LIST/ENRICH; o webhook
      do site agora envia `lang`/`lang_name` ao n8n — **falta ajustar o workflow n8n**),
      audio.js (reanálise, classificação variety/register em lote c/ `lang` por item, origem,
      negrito perfeito, prompt de imagem), study.js (regenerar exemplo), consulta.js
      (`CONSULTA_SYSTEM`/`SRS_EXTRACT_SYSTEM` viraram FUNÇÕES `consultaSystem()`/
      `srsExtractSystem()` do idioma ativo; sugestões do empty state por idioma).
    - **UI**: seletor de idioma no header do Adicionar e na barra do Assistente (CSS
      `.lang-select`); chip de idioma (`.chip-lang`) no Revisar e nos cards quando ≠ inglês;
      dropdown de variedade do card dinâmico pelo idioma (`getLangDef(...).varieties`);
      `_normVariety` agora valida contra as variedades do idioma do item.
    - **Dados (aditivo, sem migração destrutiva)**: `words[]`+`lang`/`type_label`;
      `srsCards[]`+`lang`/`type_label` no snapshot; `cfg`+`activeLang`. Sync inalterado.
    - Typo pré-existente corrigido no prompt do doc ("rape"→"rapé").

### Sessão 2026-06-25 — fuso horário do "dia" do SRS (renovação da contagem)
37. **`todayStr()` passou a usar a data LOCAL (Brasília)** em vez de `toISOString()` (UTC).
    Sintoma: o Djemeson não tinha estudado nada "hoje", mas "Novos disponíveis" mostrava 26 (= 50 −
    24). Causa: o "dia" do SRS renovava às **00:00 UTC = 21:00 de Brasília**, então cards estudados
    depois das 21h eram contados no dia seguinte. Agora o dia vira à **meia-noite local**. Afeta
    `srsNewTodayRemaining`, `newLimit` da sessão, `srsStreak`, `addedDate` e o log diário (`srsLog`).
    ⚠️ Entradas de `srsLog` já gravadas antes desta correção ficaram com data UTC; a correção é só
    daqui pra frente (uma entrada mal-atribuída ao "hoje" UTC zera sozinha no dia seguinte local).
    (Possível evolução estilo Anki: "novo dia começa às 4h" configurável — não feito.)

### Sessão 2026-06-25 — cor dos novos (Estudar) + esclarecimento dos contadores
35. **"Novos disponíveis" = quantos novos ainda faltam hoje** (`study.js` → `renderSrsSection`,
    `el('srs-new-count') = newRem = srsNewTodayRemaining()` = `min(newPerDay − vistos hoje, estoque)`).
    Esse SEMPRE foi o comportamento correto/desejado (confirmado pelo Djemeson). Numa 1ª tentativa eu
    troquei por "estoque total de novos" — **revertido**. Esclarecimento que gerou a dúvida:
    **"Para revisar hoje"** (`srsDueCount()`) são as **revisões** vencidas (controladas por
    *Revisões por dia*), NÃO por *Novos por dia* — por isso nunca reflete o valor de "Novos por dia".
    Quem reage a *Novos por dia* é o card **"Novos disponíveis"** (desconta os já vistos no dia).
36. **Azul = novos** (antes azul = revisar; alinha com a tabela de baralhos, onde NOVO já é azul).
    Trocadas as cores em `css/styles.css`
    (`.srs-dash-card.new` → `--primary`/azul, `.due` → `--success`/verde) e no subtítulo da sessão
    em `study.js` (mantendo azul nos "novos" e verde no "para revisar"). Streak segue `--warning`.

1. **Persistência da cfg**: backup em IndexedDB (`SettingsDB`, "pegajoso" p/ chave/URL) +
   restauração no boot; `setPersistence(LOCAL)`; cfg sincronizada (merge, omit-empty).
2. **Removida toda a integração com Anki** (AnkiConnect, envio de cards, campos, indicador).
3. **Sistema de 5 temas** + seletor em Configurações.
4. **Redesign premium completo** (tokens, gradientes, sombras, microanimações, layout centralizado,
   sidebar, headers, métricas).
5. **Sistema de ícones** `ic()` + remoção de emojis da interface.
6. **Badge de pendentes** movido de "Adicionar" para "Revisar".
7. **Biblioteca virou aba própria**; contadores do Estudar clicáveis (abrem filtrado).
8. **Tooltips globais** premium.
9. **`inputModal`** substituindo `prompt()` (criar/renomear deck).
10. **Sidebar do Revisar** reconstruída (filtros segmentados, itens em cartão, chips de status).
11. **Variedade/Registro**: IA passou a preencher; dropdowns com padrão Geral/Neutro.
12. **"Reanalisar tudo"** na Biblioteca (corrige frases que não batiam com o significado +
    variedade/registro + gera áudio; preserva SRS).
13. **Consulta**: 3 exemplos → 3 cards; corrigido vazamento de HTML/JSON e botão quebrado
    (passou a referenciar por índice, não JSON no onclick).
14. **Motor SRS estilo Anki** (correção da graduação por etapas + reaprendizagem + todos os
    parâmetros + modal expandido + preset do Anki + leech).
15. **Sync em tempo real** (onSnapshot, nuvem = verdade; "Limpar tudo" propaga o vazio).
16. Correções de bugs lazy/não-lazy (`srcIcon`, `AI_MODELS`/`updateModelOptions`,
    `randomVoice`/`OPENAI_VOICES`, `srsSession`).

### Sessão 2026-06-24 (5ª rodada) — glossário, indicador de sentido e negrito EN+PT
32. **Modo "Palavras" na Biblioteca** (toggle `Cards | Palavras` no header — `setLibMode`,
    `_libMode`, `_applyLibModeUI`). O glossário (`renderWordsGlossary`/`glossWordHtml` em audio.js)
    lista cada objeto de estudo UMA vez, com todos os seus sentidos (significado, definição,
    variedade/registro, 1 exemplo com negrito, origem), busca com debounce
    (`renderWordsGlossaryDebounced`) e contagem "N palavras · M sentidos". Resolve a dor de "na
    Biblioteca aparecem todas as frases de todas as palavras". Deriva tudo de `srsCards` (snapshot),
    agrupado por `wordId` → `meaningIdx`.
33. **Chip "sentido X de Y" nos cards** (`senseInfo` em srs.js — não-lazy; chip em `buildMetaChips`).
    Aparece SÓ quando a palavra tem mais de um sentido em estudo (discreto). Mostra posição/total e,
    ao clicar, abre o glossário focado naquele termo (`openWordGlossary` → rola e dá um flash).
34. **Negrito perfeito do objeto de estudo (EN + PT)** — resolve "muitas frases em inglês sem
    negrito". Causa raiz: `buildSrsFrente` DESCARTAVA o `<b>` que a IA já colocava e tentava refazer
    por regex, que falha em formas irregulares (run→ran, go→went) e expressões. Correções:
    - **Render (grátis, instantâneo):** `escB()` em core.js (escapa preservando `<b>`).
      `buildSrsFrente` agora CONFIA no `<b>` existente (só usa regex quando não há nenhum). O PT da
      frase passou a renderizar com `escB` (antes era `esc(strip(...))` — removia o negrito). Idem
      no Revisar e no preview da Mídia (usam `allowBold`, equivalente a `escB`).
    - **Botão IA retroativo** "Negrito perfeito (IA)" na Biblioteca (`#lib-bold-btn` → `markBoldAll`/
      `markBoldOne`, gpt-4o-mini, `runPool` concorrência 4). Pega só as frases sem `<b>` (EN ou PT),
      pede o termo em `<b>` no inglês e o equivalente em `<b>` no português, escreve nos cards e nos
      significados da palavra. Preserva o agendamento SRS. Deduplica por par exato (palavra+EN+PT).
    - **Todas as novas** já saem com PT em negrito: prompts ajustados em `review.js` (análise
      principal), `regenerateMeaning` (audio.js), `regenerateCardExample` (study.js), `consulta.js`
      (Assistente) e o doc extractor de `add.js`. Removidos os `replace(/<\/?b>/gi,'')` que
      apagavam o `<b>` do PT no add.js e no review.js.
    - CSS premium novo: `.lib-mode-toggle/.lmt-btn`, `.srs-sense-chip`, todo o bloco `.gloss-*`.

### Sessão 2026-06-24 (4ª rodada) — múltiplos sentidos por termo (doc)
31. **Sentidos múltiplos** no extrator de documento (`extractMidiaDoc`/`createDocWord`/
    `renderMidiaDocItem`). Antes, um termo virava 1 significado só — um artigo do Mairo que ensina
    "run by" em 5 sentidos (falar com alguém / apresentar ideia / repassar / dar um pulo / passar
    correndo) colapsava tudo num significado. Agora a Fase 2 retorna `senses[]` (um objeto por
    sentido que o documento realmente desenvolve), cada sentido com seus próprios
    significado/definição/registro/origem e os **exemplos reais do texto atribuídos àquele sentido**.
    `createDocWord` monta `w.meanings[]` com um significado por sentido (todos `selected`), então o
    SRS gera cards por sentido × exemplo (reaproveita `saveToSrs`/`createSrsCard`). Preview mostra os
    sentidos numerados + chip "N sentidos". Fallback de sentido único preservado; max_tokens do
    enriquecimento subiu p/ 5000. Itens só MENCIONADos continuam fora (filtro da 3ª rodada).
31b. **Correção (1ª tentativa falhou)**: a Fase 1 estava SEPARANDO as variações ("run by",
    "run something by someone", "ran by") em 3 itens — eu havia, por engano, mandado incluir as
    sub-estruturas como itens separados. Agora a Fase 1 **CANONICALIZA E MESCLA**: cada expressão
    sai UMA vez na forma base (verbo+partícula p/ phrasal), sem separar por sentido, inflexão
    ("ran by"→"run by") ou padrão estrutural ("run something by someone"→"run by"). Os sentidos são
    montados só na Fase 2. Também: exemplos por sentido voltaram a ser **EXATAMENTE 3** (prefere as
    frases reais do doc; completa com exemplos fiéis ao sentido se o texto tiver menos de 3).
31c. **Validado ao vivo (Claude in Chrome)** rodando o prompt NOVO direto na API (gpt-4o-mini)
    sobre o artigo "Pass On" (que NÃO é o exemplo do prompt — generalização honesta): retornou
    **7 sentidos**, **3 exemplos cada** (`[3,3,3,3,3,3,3]`), com as frases reais do texto. Também
    blindado: remove `<b>` da tradução PT dos exemplos (o modelo às vezes inseria). ⚠️ Deploy
    OneDrive→GitHub é assíncrono + service worker cacheia o JS; pode levar alguns minutos / um
    hard-refresh até a UI ao vivo refletir a versão nova.

### Sessão 2026-06-24 (3ª rodada) — extrator de documento: só o que é ENSINADO
30. **Filtro "ensinado vs mencionado"** na Fase 1 do `extractMidiaDoc` (`add.js` → `LIST_SYSTEM`).
    Sintoma: ao colar o artigo "Run By" do Mairo (que ensina só *run by*), o projeto gerou 15 itens —
    os 3 certos (família *run by*) + 12 phrasal verbs que o artigo só **cita de passagem** numa frase
    de efeito ("run out, run into, run off…"). A Fase 1 mandava ser EXAUSTIVA e capturava tudo;
    a Fase 2 então **inventava** exemplos (do conhecimento geral) para esses 12, perdendo a curadoria
    da fonte. Correção: o prompt agora inclui um termo **só** se o documento o desenvolve (tem
    explicação própria e/ou frase de exemplo real no texto); termos apenas listados/citados são
    descartados (com o caso "run by" como exemplo no próprio prompt). `doc_example_en` virou a "prova"
    de que o termo é ensinado.

### Sessão 2026-06-24 (2ª rodada) — robustez do Assistente + recolher + Mídia colada
27. **Extração de SRS robusta** (`consulta.js`): o botão "Adicionar" não aparecia em perguntas
    PT→EN ("como se diz X em inglês?"). Mudança de abordagem: a resposta visível agora é
    **conversacional e limpa** (sem JSON no prompt) e os termos de estudo são extraídos em uma
    **chamada dedicada** (`extractSrsItems` → `_consultaOpenAIJSON`, `response_format:json_object`)
    sobre o par pergunta/resposta — explicitamente pega o termo em inglês mesmo com pergunta em PT
    e ambos os lados em "diferença entre X e Y". Mostra loader "Procurando termos para estudo…".
    Removidos `parseSrsItems`/`extractSrsRaw` (inline); `stripSrsBlocks`/`cleanConsultaReply` ficam
    como defesa.
28. **Sidebar global recolhível** (rail só-ícones) e **coluna de histórico recolhível** —
    **independentes**, cada uma com seu toggle, ambas premium e persistidas (`el-ui-prefs`).
    - Sidebar: botão chevron no brand → `body.sb-collapsed` (largura 74px, só ícones, tooltips
      via `data-tip`). `toggleSidebar`/`applyUiPrefs`/`saveUiPref`/`loadUiPrefs` em `core.js`
      (aplicado cedo p/ evitar flash).
    - Histórico: barra superior do chat (`.asst-chat-top`, sempre visível) com toggle →
      `.asst-layout.hist-collapsed`. No mobile o mesmo botão abre o drawer. `toggleHistory` em
      `consulta.js`; preferência aplicada em `renderAssistente`.
29. **Mídia aceita material COLADO como documento** (`add.js` → `extractMidiaPasted`): novo botão
    "Extrair material colado" roda o mesmo fluxo rico do upload (`extractMidiaDoc`) sobre o texto
    do `#midia-text-new` — ideal para colar artigos do **Mairo Vergara** (formatos "Como se diz",
    "O que significa", "Qual a diferença entre", "phrasal verb", "Estruturas"). O botão antigo
    virou "Analisar linha a linha" (uma palavra/frase por linha). Ambos com legenda explicativa.

### Sessão 2026-06-24 — Assistente (Consulta promovida a seção própria)
22. **Consulta saiu da aba Adicionar e virou a seção "Assistente"** (2º item do menu). Dashboard
    mantido como estava. Novo arquivo `js/consulta.js` (NÃO-lazy) com toda a UI/lógica; estado
    `conversas`/`activeConversaId` + `loadConversas`/`saveConversas` em `core.js`; `'assistente'`
    adicionado a `SECTIONS` e ao `_activateSection`; `loadConversas()` no boot (`init.js`).
23. **Histórico de conversas persistido + sincronizado**: `conversas[]` no localStorage e no
    Firebase. `firebase.js`: `fbPushData` grava `data/conversas`; `fbPull` e `applyCloudDocs`
    leem (merge por `id` pelo `updated_at` mais recente — não apaga conversa local recém-criada);
    `_refreshActiveViews` re-renderiza o Assistente no snapshot. Conversa criada na 1ª mensagem
    (sem conversas vazias); título automático a partir da primeira pergunta.
24. **Respostas em streaming** (SSE `stream:true`): texto renderizado aos poucos com markdown leve;
    blocos `<srs_items>` ficam ocultos durante o streaming (`stripSrsBlocks`).
25. **Vários itens SRS por resposta + anti-duplicado**: prompt agora pede ARRAY `<srs_items>` com
    TODOS os termos da resposta. Cada um vira botão "Adicionar"; `isWordInStudy` mostra "já no
    estudo" para os que existem em `words[]`; botão "Adicionar todos". Fallback de parse aceita o
    `<srs_item>` único legado.
26. **CSS estilo Claude** (`styles.css`): `.asst-layout` (grid 2 colunas), sidebar de conversas,
    bolhas, "typing dots", sugestões no empty state, chips de termos SRS e responsivo (sidebar vira
    drawer em telas estreitas; `#section-assistente{max-width:none}`).

### Sessão 2026-06-23 — contexto da fonte + importação de documentos
17. **Análise sensível à fonte** (`review.js` → `analyzeWordDirect`): o prompt agora recebe
    `source_type`/`source_title`/`source_context` e instrui a IA a inferir o GÊNERO da fonte e
    eleger como `context_match` (primeiro da lista) o sentido usado naquele contexto, mantendo os
    demais sentidos gerais. Corrige "snuff" (Survivor) = "apagar a tocha" em vez de "rapé".
18. **Campo opcional de contexto/gênero** na aba Mídia (`#midia-context-new`) + novo campo
    `source_context` em `createWord` (dashboard.js), propagado em todo o fluxo de Mídia.
19. **Importação de documento na Mídia** (.md/.txt/.pdf), por clique ou arrastar
    (`#midia-drop`/`#midia-file` → `handleMidiaFile`). PDF lido com **pdf.js** carregado do CDN sob
    demanda (`loadExtScript`/`readPdfTextMidia`). `extractMidiaDoc` roda em **DUAS FASES** (helper
    `_openaiJSON`): (1) listagem leve e exaustiva de TODOS os termos (output pequeno → não corta
    itens); (2) enriquecimento em **lotes de 6** (IPA, nível, registro, definição, **3 exemplos**
    en/pt → 3 cards), com progresso visível. Lote que falha mantém o significado/exemplo do doc
    (nada se perde). Antes era 1 chamada só, que estourava o teto de tokens e cortava itens
    (ex.: doc com 31 → só 20). Preview rico
    (`renderMidiaDocItem`); ao adicionar, `createDocWord` cria a palavra em `pending_review`
    preservando o significado/exemplo do doc como `context_match`. Reaproveita a lista/seleção
    existente de Mídia (`midiaProcessed` com flag `doc:true`).
20. **Origem/história das expressões** (`origin_pt`): novo campo no significado, preenchido pela
    IA SÓ quando há etimologia/imagem interessante (idiomas, expressões, metáforas — ex.: "sitting
    duck", "on the chopping block", "flagship"); vazio para palavras comuns; sem inventar. Gerado
    em `analyzeWordDirect` (review.js), na importação de doc (`extractMidiaDoc` fase 2), em
    `regenerateMeaning`/`reanalyzeAll` (audio.js — backfill dos cards já no SRS) e na Consulta.
    Vai ao snapshot em `createSrsCard` (srs.js) e aparece no card de estudo (`buildSrsVerso`,
    bloco "Origem") e na revisão (`renderMeaningItem`). Importação de doc grava `_seedMeaning` na
    palavra para que uma "Re-analisar" por palavra PRESERVE o significado curado (não reinventa).
21. **Botão TEMPORÁRIO "Preencher origem"** na Biblioteca (`#lib-fill-origin-btn` → `fillOriginsAll`
    em audio.js): passada leve (gpt-4o-mini) que SÓ adiciona `origin_pt` aos significados que ainda
    não têm — não toca em significado, definição, frases, variedade/registro nem agendamento. Pula
    os que já têm origem. **A REMOVER depois do backfill** (botão + função).

---

### Regra permanente: tudo que gera, mostra progresso

Pedido explícito do Djemeson (92ª rodada): **qualquer operação que gere algo neste projeto tem
de informar o progresso** — imagem individual, imagem em lote, áudio, classificação, leitura de
capítulo, análise. O padrão é a API de `core.js`:

- `progressoAbrir(id, titulo, sub)` ao começar — **antes do primeiro `await`**, porque abrir
  arquivo e ler IndexedDB já demoram e clique sem resposta é indistinguível de app travado;
- `progressoAtualizar(id, feito, total, sub)` a cada passo, e **antes** de cada lote também:
  a primeira chamada é a mais longa e barra parada em zero é o silêncio que se está corrigindo;
- `progressoFechar(id, msg, tipo)` ao terminar, **com mensagem** — o fim é informação;
- `progressoItem(id, titulo)` para peça única, sem barra.

Tudo entra na pilha `#toasts`. **Nunca criar outro elemento `position:fixed` num canto da
tela** — foi exatamente isso que fez o banner de áudio sobrepor os toasts.

## 8.1 O FLUXO DE 4 ETAPAS — CONCLUÍDO em 2026-08-07 (90ª rodada)

> **Leia isto antes de mexer em `js/dossie.js` ou em qualquer nome de seção.**
> Desenho aprovado pelo Djemeson em 2026-08-06, implementado por inteiro em 2026-08-07.
> A tabela de nomes abaixo é a MESMA que está em `js/core.js`, acima de `SECTIONS` —
> se um dia divergirem, o código manda.

### O problema que motivou

O material que a IA monta é rico (item, significados, exemplos, frase original, imagem,
áudio), mas o único caminho para fora era "salvar para estudo", que **estilhaça o dossiê em
cards de um significado cada**. Não havia onde LER o material montado, e ele não queria mandar
para a repetição espaçada aquilo que ainda não tinha estudado.

### O fluxo e os nomes — COMO FICOU

| id da seção | Rótulo na tela | Arquivo | Papel |
|---|---|---|---|
| `preparar` (era `revisar`) | **Preparar** | `js/review.js` (não-lazy) | a IA monta o material |
| `estudar` (novo) | **Estudar** | `js/dossie.js` (LAZY) | ler o dossiê inteiro, por obra + capítulo |
| `revisar` (era `estudar`) | **Revisar** | `js/study.js` (LAZY) | repetição espaçada (SRS) |

⚠️ **Os NOMES DOS ARQUIVOS não acompanharam a troca, e isso é decisão, não esquecimento:**
renomeá-los quebraria o histórico do git e a lista do service worker sem ganhar nada. Então
`review.js` = Preparar e `study.js` = Revisar. O mapa vive em `core.js` acima de `SECTIONS`,
e cada um dos três arquivos tem a nota no topo. **Não invente outro mapa em outro arquivo.**

"palavra" → **item** na interface: entram idiom, phrasal verb e colocação.

### As duas regras que ELE decidiu

1. **O portão é por item, não por dossiê.** Marcar um item como estudado é o que o manda para a
   revisão espaçada — não é preciso terminar o dossiê. Um ato, um significado.
2. **Item por item**, não um botão único no fim.

### Como o portão foi resolvido (item que faltava decidir)

Passou a existir **uma verdade só**: quem grava `estudadoEm` é o **`saveToSrs()`**
(`js/srs.js`), não cada tela. Assim o Assistente, o card com áudio do vídeo e o atalho do
Preparar deixam o dossiê coerente — item que está girando no SRS nunca aparece como
"para estudar".

⚠️ **DUAS CORREÇÕES no mesmo dia, as duas achadas pelo Djemeson usando a tela.**

**1ª:** o botão principal do Preparar era o ATALHO ("Mandar N cards para a Revisão"). Rotulado
com honestidade, mas **a tela ensinava o caminho errado** — anunciava a Revisão como próximo
passo e a leitura do dossiê não tinha representação nenhuma. Virou "Ver em Estudar".

**2ª (a que corrigiu o MODELO, não o rótulo):** *"não faz sentido. o botão deveria ser enviar
pro estudo e não ver ela no estudo. afinal de contas o material que está aqui precisa sair
daqui e viver só no Estudar e depois no Revisar."* Estava certo, e o erro era meu, de desenho:
eu tinha feito o dossiê mostrar **tudo que tivesse material**, então o item preparado aparecia
ao mesmo tempo no Preparar e no Estudar — e nenhuma das duas telas dizia onde ele estava.

**O modelo certo é fila que ESVAZIA**, e isso exigiu um estado novo:

| status | onde o item aparece |
|---|---|
| `pending_ai` | Preparar (esperando a IA) |
| `pending_review` | Preparar (material pronto, **esperando o envio**) |
| **`in_study`** | **só** no dossiê, em Estudar |
| `in_srs` | Revisar (e continua legível no dossiê, como estudado) |

- **Ação principal do Preparar = "Enviar para o Estudo"** (`enviarParaEstudo` /
  `enviarSelecionadasParaEstudo`). O item **some da fila** e a tela avança para o próximo,
  como o "pular" já fazia.
- `_dossieItens()` passou a filtrar por **status**, não por "tem material".
- **A volta existe**: `voltarParaPreparar()`, no rodapé de cada item do dossiê
  ("Corrigir em Preparar"). Sem ela, enviar seria porta de mão única e um item com análise
  errada ficaria preso — o mesmo beco que o "Não lembro" resolveu no glossário.
- "não estudei ainda" devolve o item para **`in_study`** (reler), não para o Preparar
  (refazer). São duas intenções diferentes e agora têm dois botões diferentes.
- O atalho **"Pular para a Revisão"** continua, fantasma e no fim (`.wct-atalho`).
- **SEM MATERIAL DA IA NÃO EXISTE ENVIO** (3ª correção do dia, também vinda do uso: ele
  selecionou os 11 `pending_ai` e a barra ofereceu "Enviar para o Estudo"). `_prepPodeEnviar()`
  já recusava — o dado nunca esteve em risco —, mas **a barra oferecia o que não podia
  acontecer**, e isso já é o erro. Agora ela reflete a regra: seleção só com pendentes mostra
  apenas **Analisar** (promovida a principal) e **Excluir**, com o aviso *"N sem material da
  IA"*; seleção mista rotula **"Enviar N para o Estudo"**, dizendo quantos vão; e no item único
  sem nenhum significado marcado o botão fica **desabilitado** com o motivo no tooltip, em vez
  de aceitar o clique e recusar depois.
- Efeito colateral bom: **a fila do Preparar pode ficar vazia** — e o vazio virou informação
  ("o que você já enviou está em Estudar"), com o dossiê vazio dizendo quantos itens esperam
  envio do outro lado.
- **Bug vizinho consertado de graça**: o subtítulo ("N pendentes · N prontas") só era
  recalculado dentro do `renderReview()`, então quem saía pela lateral — o "pular" já fazia
  isso antes de existir o "enviar" — deixava um número mentindo no cabeçalho. Virou
  `_prepAtualizarCabecalho()`, chamado pelos três caminhos.

`dossieDesfazerEstudo()` **não apaga cards do SRS** (eles já podem ter histórico), mas **devolve
o `status` para `pending_review`** — sem isso a costura do legado (abaixo) remarcaria o item no
render seguinte e o desfazer duraria uma fração de segundo.

### O dado que já existia no aparelho

Itens antigos têm `status: 'in_srs'` e nenhum `estudadoEm` (o campo nasceu aqui). O primeiro
dossiê diria "300 para estudar" sobre coisas revisadas há semanas. `_dossieCosturarLegado()`
roda a cada render, preenche `estudadoEm` a partir do `updated_at` e **só grava se mudou algo**
— então também cura o aparelho que receber esses itens pela nuvem. Nenhuma migração manual.

### Busca e filtro (mesma rodada, a pedido dele)

Barra fixa no topo da seção: busca + três pílulas com contagem. Na grade elas são
**Todos / Com pendência / Concluídos**; dentro de um dossiê, **Todos / Para estudar /
Estudados**. A busca varre termo, frase de origem, significados, definições e exemplos — e na
grade também casa **dentro dos itens**, porque "onde foi que eu vi *barrel*?" é a pergunta que
traz alguém a esta tela. Sem acento e sem caixa (`_dosNorm`).
Dois cuidados que valem para qualquer tela nova: **a barra fica FORA do trecho que se repinta**
(`#dossie-corpo`), senão o campo perde o foco no meio da palavra; e **filtro não é persistido**,
pela lição já paga do filtro de fonte do SRS — tela vazia sem explicação parece app quebrado.

### Armadilhas desta entrega (todas verificadas)

- `js/dossie.js` é **lazy**: nada do shell pode chamá-lo. Por isso o **badge da seção Estudar**
  (`dossiePendentes`/`updateDossieBadge`) mora em **`core.js`**, chamado dentro de
  `loadWords`/`saveWords` — todo caminho que muda um item passa por lá, inclusive o snapshot
  da nuvem.
- `estudadoEm` **sobrevive ao sync**: o `firebase.js` grava `words` inteiro (`{list: words}`),
  sem lista de campos — verificado.
- O separador da chave do dossiê é `'\u0001'` (U+0001) **por escape, nunca o caractere literal** no
  fonte (invisível no editor, some em copiar/colar). Mesmo cuidado no regex de acentos.
  A chave **não viaja dentro do `onclick`**: vai pelo índice, com o handler ligado em JS.
- `CACHE` do `sw.js` bumpado para `v131` e `dossie.js` acrescentado à lista network-first.
  **`v132` na correção do botão** — `review.js`, `core.js` e o CSS são SHELL (cache-first), e
  sem o bump a tela continuaria mostrando os botões antigos. Foi exatamente o que aconteceu no
  teste: o navegador serviu o `review.js` velho até a versão subir.

## 8.2 O ITEM QUE CRESCE — plano do reencontro (FASE 1 feita em 2026-08-07)

> **Leia antes de mexer em `words[].meanings[]`, no glossário ou na captura.**
> Desenho aprovado pelo Djemeson em 2026-08-07, depois de três rodadas de análise.
> A Fase 1 está implementada; as Fases 2 e 3 estão desenhadas e NÃO foram executadas.

### O problema

A IA devolve **todos** os sentidos de um item, e o `saveToSrs` cria um card por
(sentido × exemplo) — com 3 exemplos por sentido, um item de 3 sentidos vira **9 cards**.
Projetado sobre os 108 itens de *Flags on the Bayou*: **600 a 900 cards** de um livro só, ou
30-45 dias de cards novos a `newPerDay: 20`. E, nas palavras dele, **~10% era o sentido do
livro**. O resto não é lixo — é consulta — mas estava cobrando tempo de revisão.

### A decisão

**Capturar só o sentido do contexto.** Os outros não são gerados de véspera: chegam quando
você os encontra. O item **cresce por reencontro**, e é assim que ele vira um verbete pessoal
— um dicionário escrito pelo seu histórico de leitura, com a cena de cada sentido.

Isso exige a mudança conceitual que organiza tudo:

> **A unidade de estudo desce de ITEM para SENTIDO.** O item vira o verbete (o continente);
> o sentido é o que se captura, se estuda e vira card. O SRS já funcionava assim
> (card por `meaningIdx`) — era o resto que estava desalinhado.

E a regra que destrava o caso central:

> **Palavra conhecida ≠ sentido conhecido.**

### Os dois eixos (por que Estudar e Biblioteca são telas diferentes)

| Eixo | Pergunta que responde | Onde vive |
|---|---|---|
| **Fonte** | "o que este capítulo me ensinou?" | **Estudar** — dossiê por obra + capítulo |
| **Item** | "tudo que eu sei sobre *fall*" | **Biblioteca → Palavras** — o verbete |

Um verbete não pertence a fonte nenhuma: pertence a **todas as fontes onde você esbarrou
nele**. Por isso ele não cabe em Estudar — foi o próprio Djemeson quem apontou.

### FASE 1 — o reencontro deixa de ser beco (FEITA)

Antes, o cenário "leio `fall`, já existe, mas aqui é outro sentido" produzia **três erros ao
mesmo tempo**, e todos por uma premissa velha (*1 palavra = 1 item*):

1. o balão mostrava **o sentido antigo** (o card ganhava da pré-análise, sempre);
2. o botão de capturar **sumia** (`achado.fonte !== 'card'`);
3. e a captura era **recusada** ("já está na sua fila").

O que passou a valer:

- **As duas camadas param de competir e passam a se compor** (`_glossComReencontro`, em
  `glossario.js`). Quando a pré-análise discorda de **todos** os sentidos do item, a
  divergência não é ruído — é o sinal de que apareceu sentido novo. O balão mostra
  *"fracassar, ruir"* como resposta principal e, no rodapé, *"sentido novo — aqui não é
  'cair', que é o que você estuda"*. **Sem chamada de IA no hover**: a pré-análise do capítulo
  já leu tudo antes, e é por isso que cabe nos ~50 ms (o segundo do Wiktionary foi recusado
  por este mesmo motivo).
- A comparação é contra **todos** os sentidos (`todosPt`), não só o exibido — senão
  reencontrar o sentido nº 2 seria anunciado como novo. E usa *contém*, não *igual*: "cair" e
  "cair em desgraça" são o mesmo sentido dito com mais palavras. Erra para o lado de "já
  tenho", que é o lado seguro (no máximo não avisa; o botão continua lá).
- **O botão nunca some** — troca de rótulo: `Estudar` para palavra nova, `Outro sentido` para
  quem já é card, com destaque quando há divergência.
- **A semente**: o leitor passava `aoEstudar: (alvo, ctx) => …` e **descartava o terceiro
  argumento**, onde vinha a glosa que a pré-análise já pagou para descobrir. Agora ela viaja
  como `_seedMeaning` — mecanismo que já existia e era usado por outros dois caminhos
  (`add.js` da Mídia e o Raio-X). Sem isso o Preparar **redescobria** o sentido vendo só uma
  frase, quando ele foi decidido vendo o capítulo inteiro. Era provavelmente a origem do
  desencontro "o balão diz uma coisa, o card sai com outra".
- **A captura aceita palavra existente** — `prepAcharItem()` acha o item inclusive
  **flexionado** (`fell` → `fall`), reusando `glossLemas`, que já cobre irregular por tabela e
  cuja qualidade já foi medida (os 91,5% da 83ª rodada foram medidos com ele).
- **`prepararNovoSentido()`** põe o sentido novo NO MESMO item: volta o item para
  `pending_ai` com a frase nova e a glosa como semente. Os sentidos antigos sobrevivem — o
  merge da análise preserva todo significado já curado, e os cards nem são tocados (card se
  liga ao sentido pelo `meaningId`, não pela posição).
- **Migração preguiçosa e ADITIVA** (`_prepDescerContexto`): antes de a frase nova
  sobrescrever a antiga, cada sentido que ainda não tem a sua recebe `context`, `context_pt` e
  `source_*` do item. Sem isso, a origem do primeiro sentido se perderia **no exato instante
  do segundo encontro**. Aditiva: os campos do item continuam lá e todo código que lê
  `w.context` segue funcionando.

**Limitação da Fase 1 — RESOLVIDA na Fase 2.** Enquanto o `status` era do ITEM, um item em
reencontro voltava inteiro para o Preparar e sumia do dossiê. Com `m.estado`, cada sentido
guarda o seu e nada é arrastado junto.

### FASE 2 — o estado desce para o sentido (FEITA em 2026-08-08)

**`m.estado`**, com quatro valores, e é o eixo de tudo:

| estado | significa | aparece em |
|---|---|---|
| `pronto` | material montado, esperando envio | Preparar |
| `estudo` | enviado ao dossiê | Estudar |
| `revisao` | estudado, virou card | Revisão (e legível no dossiê) |
| `saber` | só consulta | verbete e glossário — **fila nenhuma** |

- **`w.status` virou DERIVADO** (`sincronizarStatusItem`). É o truque que permitiu trocar o
  modelo sem reescrever o app: a lista do Preparar, os contadores do Dashboard, os badges e o
  glossário continuam lendo `w.status` e continuam certos.
- **O dossiê é uma lista de SENTIDOS** (`_dossieSentidos` devolve pares `{w, m}`).
  `_dossieChave(w, m)` lê a origem do sentido com queda para a do item — é isto que faz o
  `fall` estudado no Capítulo 3 e reencontrado no 9 aparecer **nos dois dossiês, sem virar
  dois itens**. No cartão, os outros sentidos viram uma linha discreta ("fall também é: cair").
- **`saveToSrs(wordId, meaningId)`** — o segundo argumento restringe a UM sentido. É como o
  dossiê manda um sentido para a revisão sem arrastar os irmãos.
- **A caixinha de seleção ganhou o sentido que faltava a ela**: marcada = vai estudar;
  desmarcada, no envio, vira **`saber`** — conhecido, no verbete, nunca mais pedindo tempo de
  revisão. É o que resolve os ~90% de um livro que não são o sentido daquela obra.
- **O merge da análise preserva** `estado`, `estudadoEm`, `context` e `source_*`. Sem isso,
  "Re-analisar" jogaria fora o progresso de estudo e a cena de origem de cada sentido.
- **A limitação declarada da Fase 1 morreu**: o reencontro não puxa mais o item inteiro para
  trás. Os sentidos já estudados ficam com o estado deles e seguem no dossiê e na Revisão.

**Migração** (`migrarEstadosDeSentido`, roda no boot depois do `loadSrsAsync` — a ordem
importa, ela deriva "estudado" da existência do card — e de novo ao abrir o dossiê, para curar
aparelho que receber dado antigo pela nuvem). É idempotente e derivável, sem chute:
tem card ⇒ `revisao`; item `in_study` ⇒ `estudo`; item já no SRS com sentido sem card ⇒
**`saber`**; resto ⇒ `pronto`.
**Verificado ao vivo** com `barrel` de 3 sentidos e 1 card: "cano" → `revisao`, "barril" e
"tambor" → `saber`, e o dossiê do Capítulo 3 nasceu com **um** sentido em vez de três.

### FASE 3 — o verbete e as saídas (FEITA em 2026-08-08)

**5. Lema e verbete por família.** A chave do verbete é a **cabeça** da expressão, e a regra
que decide onde ela fica é uma só:

> **Expressão que começa com VERBO é de cabeça INICIAL; qualquer outra é de cabeça FINAL** —
> que é como o inglês monta sintagma nominal.

| tipo | exemplo | lema |
|---|---|---|
| palavra | `fell`, `children` | `fall`, `child` |
| phrasal verb (cabeça inicial por definição) | `get by`, `look forward to` | `get`, `look` |
| idiom com verbo | `fall by the wayside`, `gets up his quills` | `fall`, `get` |
| idiom sem verbo | `under the weather`, `the last straw` | `weather`, `straw` |
| composto nominal | `cold feet`, `crocodile tears` | `foot`, `tear` |

Peças (todas em `core.js`): `_LEMA_FUNCIONAIS` (o que nunca é cabeça), `_LEMA_VERBOS` (~150
verbos que encabeçam expressão — auxiliares incluídos, porque aqui `get`/`be`/`do` **são** o
núcleo), `_lemaEhVerbo()` (reconhece a forma flexionada), `_lemaBase()` (tabela de irregulares
antes das regras de sufixo) e `lemaCabeca(expr, tipo)`.
**Medido**: 30 de 31 casos difíceis. O único fora é `leaves` → `leaf` em vez de `leave` — e
não é bug, é ambiguidade real (plural de *leaf* e 3ª pessoa de *leave*); é exatamente onde a
IA decide.

**O LEMA DA IA TEM PRIORIDADE.** A análise que já roda passou a devolver `"lemma"`, com a
regra de cabeça escrita no prompt — ela sabe de núcleo de expressão o que lista fechada nenhuma
vai saber. Mas passa por `aplicarLemaDaIA()`, que **valida**: uma palavra só, alfabética, e que
tenha parentesco real com a expressão. Lema alucinado espalharia famílias inteiras pelo
verbete, e em silêncio — testado que ele recusa tradução ("doente"), sinônimo ("sick"), duas
palavras e lixo, e aceita flexão (`fell`→`fall`) e plural irregular (`feet`→`foot`).

O cache (`w.lemma`) é invalidado quando a PALAVRA muda (`w.lemma_de`): editar o item tem de
mudar a família, e lema velho grudado deixaria a entrada para sempre no teto errado.
Se algum item existente casar com um candidato, **é ele que manda** — a família se mantém
junta conforme cresce, em vez de rachar por grafia.

⚠️ **A trava do vazio da Biblioteca também teve de mudar** (achado no teste): ela olhava só
`srsCards.length`, então quem já preparou material e ainda não estudou nada tinha verbete cheio
e via **"Biblioteca vazia"**. Agora o vazio depende do MODO — cards conta cards, Palavras conta
sentidos.

A Biblioteca → Palavras passou a montar o verbete **a partir de `words[]`, não dos cards**.
Antes ela só enxergava o que virou card, e por isso todo sentido guardado como `saber` ficava
invisível **justamente na tela que existe para consultar**. Agora a Biblioteca é a vitrine e o
`words[]` é o estoque. Cada sentido mostra o estado (`na revisão` / `em estudo` / `só
consulta`) — é a prova visível de que o verbete guarda tudo e só uma parte pede tempo.

Famílias com 2+ entradas ganham moldura, com seções por tipo. Verificado ao vivo:
`fall` + `fell` + **phrasal verb** `fall down` + **expressão idiomática** `fall by the wayside`
debaixo do mesmo teto, cada um item próprio.
⚠️ Agrupar é da VISTA. **Não aninhar no dado**: `fall down` tem IPA e agenda próprios — o
projeto já tentou o contrário e desfez, e a cicatriz é o campo `moved_to`.

**6. Reencontro com IA — custo ZERO.** Os sentidos que ele já tem entram na análise **que já
ia acontecer**, com os ids, e cada significado devolvido traz `same_as: "<id>"` ou `null`. O
merge passou a preferir o `same_as` ao casamento por texto normalizado, que continua como rede
para modelo que ignore o campo. Casar contra **lista fechada** é tarefa muito mais fácil que
geração aberta — é por isso que dá para confiar aqui e não dava nas rodadas 163-167.

**7. Fundir — o desfazer que faltava** (`fundirSentidos`, `fundirSentidoPerguntar`). O par do
"separar", que já existia. O sentido de origem **não sai do array**: ganha `fundido_em`, do
mesmo jeito que o `moved_to` — remover deslocaria os índices e os cards antigos passariam a
apontar para o sentido errado. O que acontece na fusão:
os exemplos que faltavam entram no destino; os cards são **repontados** (`meaningId` e
`meaningIdx`); card repetido é resolvido **ficando o que tem mais história** (estado, intervalo
e lapsos), porque jogar fora agendamento real numa fusão seria o mesmo erro que o "não estudei
ainda" evita; e `estado`/`estudadoEm`/`context_match` são herdados quando o destino não os
tinha. Com dois sentidos não há pergunta (o destino é o outro); com três ou mais, rádio.
⚠️ **`fundido_em` teve de ser filtrado em TODO lugar que já filtrava `moved_to`** — 9 pontos em
6 arquivos. O primeiro teste pegou exatamente isso: o sentido fundido sumia do verbete mas
continuava no dossiê e na contagem.

### FASE 4 — "O que é aqui?": a checagem sob demanda (FEITA em 2026-08-08)

**O buraco, achado por ele olhando a tela de triagem**: *"se eu marcar `cover` aqui como
conhecida ela não vai aparecer futuramente pra mim se tiver outro sentido?"*

Sim, não aparecia. `knownWords` guarda **palavra**, não sentido — é a premissa que as Fases
1-3 derrubaram para os cards, viva numa camada que não tínhamos tocado. E o efeito é maior do
que a tela de triagem: `isKnownWord()` tira a palavra de `novas` ([ler.js:1494](js/ler.js:1494)),
e `novas` alimenta **três** coisas — a triagem, a cobertura e **a pré-análise**. Como a
pré-análise nunca glosa `cover`, a detecção de reencontro da Fase 1 **não tinha o que comparar**
e jamais dispararia para ela. O balão dizia só *"você marcou como conhecida"*.

**A saída é no CLIQUE, nunca no hover.** O hover tem orçamento de ~50 ms (foi por isso que o
Wiktionary, de 772-1234 ms, foi recusado); IA não cabe. No clique cabe, e só acontece quando
ele desconfia — que é a única hora em que vale pagar.

`aiChecarAqui()` (ai.js) — **uma chamada pequena, com cache** — e a pergunta é feita na ordem
certa:

1. **Qual é a UNIDADE?** Phrasal verb, idiom, colocação ou a palavra sozinha — sempre a
   MAIOR unidade genuinamente fixa, em forma de citação (`cover for`, nunca `covered for`).
   Responder pela palavra solta repetiria o erro do `tire of` partido em pneu + cansar.
2. **O que ela significa AQUI** — com a regra de sempre: decidir o que a coisa É na cena e
   usar a palavra portuguesa daquilo.

No balão (`_glossChecar`), com três cuidados que o teste cobriu:
- **O balão fica PRESO** no clique (`_glossPrender`): a chamada leva 1-2 s e o mouse sai nesse
  tempo — sem isso a resposta chegaria e não teria onde pousar, depois de paga. Fecha por
  clique fora ou Esc.
- **O "conheço" só cai quando a unidade é a própria palavra.** Se a resposta foi `cover for`,
  o `cover` **continua conhecido** — quem ele não conhecia era a expressão. Verificado nos dois
  ramos.
- **O envio reusa o caminho da tela** (`opts.aoEstudar`), que já sabe a fonte, já acha item
  existente por lema e já manda a glosa como semente. `w.type` vai junto, senão `cover for`
  nasceria como palavra e o verbete o poria na família errada até a análise corrigir.

**Onde o botão aparece** — só onde o app não tem resposta para aquela passagem: palavra
`known`/`ignored` (não tem glosa nenhuma, e a pré-análise nem olhou para ela) e card **sem
pré-análise no capítulo** (a glosa que ele mostra é a do contexto antigo). Onde a pré-análise
já respondeu, ou já acusou divergência, o botão não aparece — seria pagar por resposta que
existe.

### A ORDEM DO DOSSIÊ (2026-08-08)

*"Aqui sempre os mais novos aparecem em cima. Não tem problema, mas deve haver um
classificador… assim eu estudo na ordem que vi primeiro nas fontes."*

O topo era efeito colateral: `createWord` faz `words.unshift(w)`, então o último capturado fica
no índice 0 e o dossiê herdava isso. Agora tem seletor: **"Mais recentes primeiro"** (o de
sempre, mantido como padrão para nada mudar sem ele pedir) e **"Ordem da fonte"**, que é a
sequência em que ele encontrou no livro — o dossiê passa a recontar o capítulo em vez de
embaralhá-lo.

Três decisões que valem registro:

- **A ordem É persistida; o filtro NÃO.** Parece incoerente com a regra escrita acima, mas a
  diferença é de natureza: filtro **esconde** (e some sem explicar — a lição do filtro de fonte
  do SRS), ordenação só reorganiza. Nada desaparece, então não há como abrir o app e achar que
  ele quebrou. Re-escolher a ordem toda vez é que seria atrito à toa.
- **O desempate é o ÍNDICE do array, não o `created_at`.** Importação em lote (o Kindle cria
  dezenas no mesmo segundo) empata a data, e aí o índice é o único sinal que sobra da ordem
  real de captura. Testado com quatro itens de `created_at` idêntico: a ordem da fonte saiu
  correta.
- **A ordem vale DENTRO de cada grupo**: o que falta continua vindo antes do que já foi
  estudado. Inverter isso obrigaria a rolar por cima do que já terminou.

### UM SENTIDO POR ENCONTRO — a análise para de despejar o verbete (2026-08-08)

A pergunta dele fechou a incoerência que sobrava: *"mandar até mesmo os sentidos que eu não vou
estudar não vai contra a minha ideia de ir construindo aos poucos o vocabulário de diferentes
significados pra um mesmo item?"* **Vai**, por três motivos:

1. **O verbete deixa de ser o histórico dele.** O "meu, minha" do `mine` não veio de cena
   nenhuma — não tem frase, obra nem capítulo. Guardá-lo transforma o dicionário pessoal
   naquilo que ele recusou no papo do Oxford: uma entrada genérica com um sentido real e o
   resto de enfeite.
2. **Mata o reencontro** — medido: sentido guardado como `saber` **cala o alerta** de "sentido
   novo". O segundo encontro, que ele chamou de o mais valioso, não produzia nada.
3. **Não sobra progressão.** Item que nasce completo não cresce.

E o argumento que parecia sustentar o despejo — *"o custo já foi pago"* — **é falso**: no
prompt, o grosso da resposta é POR SENTIDO (definição, origem, sinônimos, antônimos e 3
exemplos com tradução). Pedir só o do contexto é a opção **mais barata**, não a mais cara.

**A política nova**: a IA **delibera sobre todos os sentidos e devolve UM** — o do contexto.
- O `sense_audit` (que já existia) virou a peça central: é lá que ficam os sentidos
  considerados e descartados, e é essa deliberação que faz `barrel` sair "cano". **Pensa em
  cinco, escreve um.**
- Invertidas todas as regras que exigiam o contrário: o bloco de fonte, o exemplo do
  `take off` (agora mostra o `sense_audit` com dois descartados e UM objeto), o caso
  `emasculating` (a divisão continua valendo para não mentir dentro de um objeto — deixou de
  ser licença para devolver vários) e a checagem de coerência (exemplo que não cabe no sentido
  se **reescreve**, não vira sentido novo).
- Item **sem frase de contexto** devolve o sentido mais comum, ainda com `context_match: true`.

⚠️ **A MUDANÇA CRÍTICA, e quase invisível**: `w.meanings = freshMeanings.map(...)` fazia a lista
nova SUBSTITUIR a antiga. Isso era inofensivo enquanto a IA devolvia tudo (a lista nova era um
superconjunto); com um sentido de volta, **a primeira re-análise apagaria todo o vocabulário
acumulado do item** e deixaria os cards órfãos. Agora o que a IA não devolveu é preservado
(`sobraram`), e as lápides `moved_to`/`fundido_em` sobrevivem até ao "Refazer do zero", porque
elas seguram a posição no array para os cards antigos não apontarem para o sentido errado.
**Medido**: re-análise devolvendo 1 sentido manteve os 3 (um `saber` e um `revisao` intactos).

**A válvula**: `completarVerbete()` — botão *"Completar verbete"* no card do Preparar. Traz os
OUTROS sentidos numa chamada própria, com **um exemplo cada** (são para consultar, não para
drilar), já listando o que ele tem para não repetir, com rede no código contra a repetição que
o modelo faz mesmo assim. Nascem `saber` **e já enviados** — ele pediu para ver, então aparecem
no verbete e no glossário na hora; fazê-lo "enviar" um sentido que nunca vai estudar seria
burocracia. O panorama do Oxford não se perdeu: deixou de ser padrão e virou escolha.

**Medido de ponta a ponta**: `mine` analisado devolve 1 sentido → 1 selecionado → **3 cards**
(era 15). "Completar verbete" acrescentou 2 sentidos como consulta, sem duplicar o repetido, e
os três selos aparecem no verbete (*na revisão* / *só consulta*).

### "EM ANÁLISE" SOBREVIVE À NAVEGAÇÃO (2026-08-08)

*"Essa frase está sendo analisada com IA, mas eu cliquei em outro item e quando voltei aqui
não dá pra saber que está."*

O aviso era escrito **direto no `innerHTML`** do card (`main.innerHTML = spinner`), e só quando
o item era o ativo. Clicar noutro item repintava a área e apagava o aviso; ao voltar, a tela
mostrava o botão "Analisar com IA" como se nada estivesse acontecendo. O caminho natural dali
era **mandar analisar de novo, pagando a chamada duas vezes**.

`_emAnalise` (Set de ids) em `review.js` + `estaEmAnalise()`. Quem responde "está analisando?"
passou a ser o estado, então card e lista podem ser repintados quantas vezes for:
- **No card**: nome do item, a frase, e "…está analisando — pode navegar, o resultado aparece
  aqui". Mostrar a palavra e a frase, e não um spinner anônimo, é o que deixa ele reconhecer
  onde está ao voltar.
- **Na lista lateral**: o giro toma o lugar do ponto âmbar (`.rw-spin`) — é o que permite
  mandar analisar, cuidar de outro item e voltar sabendo o que aconteceu.

Três detalhes que o teste cobriu:
- **`finally`, não fim do `try`**: erro, timeout ou chave inválida também soltam o item. Item
  preso em "analisando" para sempre seria pior que o problema original.
- **Clique repetido não vira chamada repetida** — medido: 3 cliques = **1 chamada**. Ganho de
  custo que veio de graça com o estado.
- O lote (`analyzeSelected`/`analyzeAll`) herda tudo, porque passa pelo mesmo
  `analyzeWordDirect`.

⚠️ **Varri os vizinhos com o mesmo padrão** (estado de progresso vivendo no DOM): a geração de
áudio e a reanálise da Biblioteca usam **banner global**, que sobrevive ao render; o card com
áudio do vídeo já usava flag em memória (`_vidCapturing`). O `analyzeWordDirect` era o único
fora do padrão.

### O PRONOME SEM ANTECEDENTE — "shakes it" virou "dançar" (2026-08-08)

Ele mandou o print: *"Macintosh holds out his hand. **Billy rises and shakes it.**"* e a Lexa
respondeu **"Billy se levanta e começa a dançar"**, explicando que *shake it* é gíria de dançar.
O "it" é **a mão** — Billy se levanta e aperta a mão dele.

**A culpa não era do modelo, era do que a gente mandava.** `_lerFraseEmVolta` calcula o
parágrafo inteiro e depois **corta na fronteira da frase**: o que chegava à IA era exatamente
`"Billy rises and shakes it."`, sem o `Macintosh holds out his hand.`. Sem antecedente, "it"
não tem dono, e o modelo escolheu a leitura idiomática — que, sem contexto, é até a mais
provável.

É a mesma família do `barrel`→barril: **contexto estreito demais produz erro com cara de
acerto**. Só que ali a frase bastava, e para anáfora não basta nunca.

Corrigido em três frentes, porque as três tinham o mesmo estreitamento:
- **Leitor** — `_lerBlocoEmVolta()` (extraído do que o `_lerFraseEmVolta` já calculava e
  jogava fora) guarda o **parágrafo**, e ele vai ao prompt como "trecho em volta". ⚠️ A FRASE
  continua sendo o que vai para o card: contexto enxuto é o tamanho certo para virar exemplo;
  o parágrafo é só para a IA entender.
- **Vídeo** — mandava **uma fala só**, e diálogo depende ainda mais do turno anterior
  ("Do it." / "I already did"). Agora vão duas antes e uma depois, com a atual marcada `>>`.
- **"O que é aqui?"** — mesmo tratamento (`_glossBlocoEmVolta`), passando o parágrafo **junto**
  com a frase, não no lugar dela.

E a regra entrou no **prompt compartilhado** (`lexaExplicar`), então vale para as três telas de
uma vez: *"pronome responde ao que veio antes; ache o antecedente no texto em volta e use ESSA
coisa. Se o antecedente estiver no texto, a leitura idiomática só vale se a literal não fizer
sentido ali."* — com o caso do `shakes it` escrito como exemplo.

**Medido**: para a seleção "Billy rises and shakes it", a frase devolvia
`"Billy rises and shakes it."` (sem antecedente) e o bloco devolve
`"Macintosh holds out his hand. Billy rises and shakes it."` (com).

⚠️ **Fica de fora, e é limite conhecido**: a **pré-análise do capítulo** manda uma frase por
palavra, em lote. Alargar para parágrafo multiplicaria os tokens de uma chamada que já é a mais
cara do app. Enquanto isso, a glosa dela pode errar em palavra cuja leitura dependa da frase
anterior — e o conserto no caso concreto é o "O que é aqui?", que agora manda o parágrafo.

### O MATERIAL SÓ VALE DEPOIS DO ENVIO (2026-08-08)

*"O material só deve ir pra Biblioteca, ou glossário, depois que eu mandar pro Estudo."*

Regra fechada, e ela completa a Fase 3: sentido em **`pronto` é rascunho da IA esperando
conferência**, não material adotado — não pode responder por ele no balão que aparece por cima
do livro nem ocupar linha no verbete. Depois do envio (`estudo`, `revisao` **ou `saber`**)
passa a valer; o `saber` inclusive existe exatamente para ser consulta.

Três pontos filtrados: `_glossDoCard` (glossário), o construtor do verbete e a trava do vazio
da Biblioteca (`temVerbete`) — os três com a mesma regra.

⚠️ **O item continua no ÍNDICE do glossário mesmo sem sentido válido**, com `pt` vazio. É o que
permite ao balão dizer "já está no Preparar" e evitar a recaptura. E o rótulo ganhou duas
versões, porque agora há dois motivos para não ter glosa: *"ainda sem análise"* e
*"envie para o Estudo e o material aparece aqui"* — dizer o primeiro para um item já analisado
seria mentir sobre trabalho que já foi feito.

### CONVERSA COM A LEXA NO BALÃO (2026-08-08)

*"Quando a Lexa analisar um item, quero uma caixa de texto pra conversar com ela sobre aquilo,
tudo no balãozinho."*

A explicação respondia UMA pergunta e fechava o assunto — e a dúvida real raramente acaba na
primeira resposta. Para perguntar "e por que não X?" ele tinha de sair do livro, ir ao
Assistente e recontar o contexto do zero.

`lexaChatHTML` / `lexaChatMontar` em `ai.js`, componente compartilhado, ligado nas **três**
telas que explicam: leitor, Preparar e vídeo. A explicação vira a **primeira mensagem** da
conversa, então a pergunta seguinte já nasce sabendo o livro/episódio, a frase e o termo.

Cuidados que o teste cobriu:
- **O histórico vive no elemento** (`chat._lexaMsgs`), não numa global: dois popups em telas
  diferentes não misturam conversa, e quando o popup morre a conversa morre junto — é dúvida
  de passagem, não sessão. Pelo mesmo motivo o chat **não entra no cache de explicação**.
- **Pergunta que falhou sai do histórico**, senão a chamada seguinte mandaria duas perguntas
  do aluno em sequência e a IA responderia só a última.
- **Dois bloqueios do leitor tiveram de ser contornados**, e nenhum era óbvio:
  (a) `pop.onmousedown = preventDefault` (existe para não colapsar a seleção) impediria o
  campo de receber foco — resolvido pelo `stopPropagation` do próprio chat, que roda antes;
  (b) clicar no campo desfaz a seleção de texto, e `_lerSelecaoMudou` fecharia o popup 350 ms
  depois, no meio da pergunta — resolvido por um gancho `aoFoco` que a tela usa para segurar
  a trava `_lerIgnoraSel` que o duplo-clique já tinha.

### COESÃO ENTRE AS TELAS — o "mine" que virou "mina" (2026-08-08)

*"O sentido do contexto aqui é 'explorar', mas quando fui na opção de o que significava
apareceu 'mina'."* Duas falhas somadas, e a segunda era minha, da rodada anterior:

1. **A checagem podia rodar SEM a frase.** `glossFraseEmVolta(pos)` devolve `''` quando `pos`
   não veio (o balão também abre por caminhos sem posição), e o `aiChecarAqui` seguia em
   frente com `Passage: "mine"`. Sem contexto, o modelo responde o sentido mais comum do
   dicionário — que é literalmente o "dicionário cego ao contexto" que o cabeçalho do
   `glossario.js` proíbe, e a origem do `barrel`→barril.
   Agora: queda para o bloco em volta, depois para a frase que o próprio card guardou da
   captura, e **se ainda assim não houver frase, não pergunta** — diz por quê e não gasta
   chamada.
2. **A checagem não sabia o que o app já tinha decidido.** Ela perguntava do zero, ignorando
   que o item já existia com `context_match` definido. Agora os sentidos do item entram na
   pergunta (com id) e volta `same_as` — e, quando casa, **quem manda é o texto GRAVADO**, não
   a redação nova: a IA respondeu "garimpar informações", a tela mostra "explorar, aproveitar".
   Duas telas do mesmo app não podem dar duas respostas para a mesma coisa.
   Quando casa, a ação também muda: em vez de "Estudar" (que criaria duplicata), o balão diz
   *"nada a fazer — já está no seu material"*.

Sentido genuinamente novo (`same_as: null`) segue oferecendo o "Estudar", como antes.

### O PADRÃO DE SELEÇÃO — a peça que faltava (2026-08-08)

Ele mandou o print de `mine`: **5 significados · 5 selecionados · 15 cards**, num item captado
de um texto onde `mine` era "explorar (dados)". *"Acredito que isso não era pra acontecer."*
Não era mesmo — e o buraco era meu: as Fases 1-4 construíram o mecanismo (`estado: 'saber'`,
o envio por sentido, o verbete que guarda tudo) e **nunca inverteram o padrão**.
`review.js` seguia com `selected: true` para todos os sentidos, que é de onde saem os 15 cards.

Agora **nasce marcado só o sentido do `context_match`**. Os outros não somem: no envio viram
`saber`, aparecem no verbete com o selo *"só consulta"* e continuam alimentando o glossário.
Marcar de volta é um clique.
Rede de segurança: se a IA não marcar `context_match` em nenhum (acontece em item sem frase de
contexto), o primeiro nasce marcado — senão o item chegaria sem nada selecionado e o botão de
enviar nasceria desabilitado.

**Atalho para o que já foi analisado** (`selectContextMeaning`, botão *"Só o do contexto"* ao
lado de Todos/Nenhum): o padrão novo só vale para análise nova, e desmarcar 4 sentidos a um
por item, vezes 97 itens, seria exatamente o atrito que este projeto tenta tirar do caminho.
Os dois botões antigos também passaram a respeitar o estado: sentido que já está em Estudar ou
na Revisão não se remarca daqui.

**Medido no caso dele**: `mine` foi de **15 cards para 3**, o dossiê do capítulo passou a
listar **um** sentido, e os outros quatro seguem no verbete como consulta.

⚠️ **O que NÃO foi mexido, e por quê**: reduzir os 3 exemplos por sentido. É tentador (seriam
3 cards → 1), mas os 3 exemplos são **load-bearing no prompt**: a verificação "leia os 3
exemplos lado a lado; se as mesmas palavras aparecerem depois do item nos três, é unidade
fixa" é o que detecta `requires`/`unit` e evitou o `fall in love` colado em `fall`. Cortar
exemplo enfraqueceria essa checagem para economizar card — troca ruim.

### O markdown da Lexa (2026-08-08)

Ele viu `*Archie*` e `**pals**` **crus** no balão do leitor. Causa: o modelo escreve em
markdown sempre, e as telas de explicação curta jogavam o texto na tela sem formatar —
`ler.js` com `textContent`, `review.js` e `video-study.js` com `esc()+<br>`. **As três
vazavam.** O Assistente tinha formatador, mas só de `**negrito**`: itálico de asterisco
simples passava cru lá também.

`lexaInline()` / `lexaFormatar()` em `ai.js`, e as quatro telas passaram a usar.
Decisão: **renderizar, não proibir.** Pedir "não use markdown" no prompt não resolve (o
modelo escorrega de volta), e a ênfase que ele deu é informação — jogá-la fora empobrece a
explicação. Detalhes que o teste cobriu:
- escapar **sempre primeiro** (é texto de fora), e só depois devolver as tags de ênfase;
- `**` antes de `*`, senão o negrito vira dois itálicos vazios;
- o asterisco tem de **colar no texto** dos dois lados — sem isso `3 * 4 * 5` virava
  `3 <i> 4 </i> 5`. Feito sem lookbehind, que não existe em Safari antigo;
- `_snake_case_` não vira itálico (sublinhado só com fronteira de palavra);
- `* item` no começo da linha é marcador de lista, não ênfase — tratado antes;
- `<script>` continua escapado; só `b/strong/i/em` voltam a valer.

### O PESO NA TELA CERTA — Estudar poderoso, Revisar enxuto (2026-08-08)

*"O card de Revisão atualmente é mais robusto e poderoso do que o Estudar de fato. O correto não
seria o Estudar ter todo esse poder e o Revisar somente itens realmente necessários?"*

Ele estava certo, e a inversão tinha nome: **Estudar é o primeiro contato** (é ali que se
constrói o vínculo forma–significado, e é ali que ouvir a pronúncia, ver a origem e ler os três
exemplos muda o que fica), enquanto **Revisar é recuperação** — e material demais no verso
convida a **reler em vez de lembrar**, que é o jeito clássico de sentir que aprendeu sem ter
fortalecido nada.

**Revisar ficou enxuto.** Frase, palavra, IPA, áudio, chips e o significado continuam à vista.
Definição, origem, sinônimos/antônimos e a cena do livro desceram para um `<details class=
"srs-material">` recolhido. Confirmado ao vivo que fechado ele não ocupa a tela
(`checkVisibility() === false`, altura do `<details>` = 34px, só o resumo).

**O material certeiro aparece sozinho ao errar.** Apertou "Errei" e o card seguinte não entra:
o verso repinta com o material aberto, os quatro botões de nota saem de cena e surge
"Entendi — próximo". A ordem do Anki é frente → verso → nota, então sem essa pausa o único
instante em que reler vale alguma coisa passava batido.

> ⚠️ **A nota é aplicada NA HORA; só o avanço espera.** O primeiro desenho desta rodada segurava
> a avaliação junto com a tela — se ele fechasse o app na pausa, o "Errei" evaporava. Perder
> progresso real por causa de uma tela é exatamente o erro que este projeto vem evitando desde o
> "não estudei ainda". Provado no teste: `state=learning`, `histórico=1`, `done=1` **antes** de
> qualquer clique em "Entendi".

**No celular a pausa nascia sem saída visível**: abrir o material estica o verso e o
"Entendi — próximo" caía em y=815, com a tela terminando em 812. Rolar sozinho também não
bastava — a barra fixa de navegação come os 68px de baixo e engolia o botão. Agora a pausa rola
o mínimo (`block:'nearest'`) e a folga vem de `scroll-margin-bottom` no CSS, que é quem sabe da
barra. Medido: botão em 632→728, barra em 744, cena do livro inteira na tela.

Durante a pausa o teclado só sabe seguir (Espaço/Enter/→/1-4 = "Entendi"), senão a segunda
batida cairia como nota **no card seguinte, que ele nem viu**. Olhar o histórico encerra a pausa
(`navigateHistory` zera `_srsErrou`), senão o card antigo apareceria com um botão que ali não
significa nada.

**Estudar virou o painel cheio.** O cartão da lista ganhou chips (nível, variedade, registro,
tipo, "sentido N de M" clicável para o verbete), botões de **Pronúncia** e **Frase**, os
vizinhos e a origem — as mesmas peças do card, agora do lado onde se aprende.

**MODO FOCO** (`#dos-foco`, tela cheia fora de `.section`): um item sozinho, com a cena onde ele
encontrou, o significado grande, **os três exemplos** (a lista mostra dois), origem, vizinhos e
irmãos. Rodapé com ← / **Estudei** / →, e as **setas do teclado** fazendo o mesmo; Esc sai;
Espaço/Enter marca estudado e segue.

Três armadilhas que o teste ao vivo pegou:

- **A fila do foco é um RETRATO, tirado na entrada — não a lista viva.** Andando sobre a lista
  viva, marcar "Estudei" reordenava tudo (o estudado desce para os concluídos) e o avanço `+1`
  **pulava o vizinho**: shake → *fall/fracassar*, com *fall/cair* passando na frente sem ser
  visto. Congelado o retrato, o percurso saiu 1→2→3 sem buraco e o contador parou de saltar.
  O **estado** continua lido ao vivo — o retrato guarda a ordem, nunca os dados.
- **O par é reancorado por id a cada pintura.** Um sync da nuvem troca os objetos de `words`, e o
  retrato passaria a segurar cópias órfãs: a tela mostraria dado velho e o `sentidoEstado` do
  órfão nunca viraria `revisao`, travando o avanço para sempre.
- **`saveToSrs` pode recusar** (limite diário, sentido sem material). Se recusar, não se anda —
  avançar ali faria o item sumir da tela **sem ter entrado na revisão**.

**O atalho com volta**, fechando o ciclo: na pausa do erro há **"Estudar de novo"**, que leva ao
painel cheio daquele item (`dossieAbrirItem` acha o dossiê pela chave, derruba busca e filtro —
o item vindo da revisão está *concluído* e sumiria no filtro "para estudar" — e cai no foco em
cima dele). A sessão sobrevive à troca de seção, então a **pílula "Voltar para a revisão"**
devolve a tela idêntica, com a pausa de pé. Provado ponta a ponta no navegador.

`_activateSection` passou a fechar o foco ao trocar de seção — ele mora no `body`, fora de
`.section`, e ficaria por cima da tela nova. No foco a pílula sobe para o topo, senão cairia
justo sobre o ← / Estudei / →.

**Arquivos**: `js/study.js`, `js/dossie.js`, `js/core.js` (`_activateSection`), `css/styles.css`.
`sw.js` → `englab-v154`.

### A VOLTA QUE NÃO VOLTAVA — devolver ao Preparar (2026-08-08)

*"Tem itens na revisão e no estudar. Tem como devolver tudo isso pro Preparar? Assim tudo entra
no que vc fez."*

O pedido era de mutirão, mas ao abrir o `voltarParaPreparar` (o "Corrigir em Preparar" do dossiê)
apareceu um **defeito silencioso desde a Fase 2**: a função só trocava `w.status`. Só que depois
da Fase 2 quem tem estado é o **SENTIDO**, e `w.status` é **derivado** — então o item aparecia no
Preparar e a primeira re-derivação (`sincronizarStatusItem`, que roda em meia dúzia de caminhos)
o mandava de volta. Provado ao vivo antes de mexer:

```
antes:               status=in_srs         sentido=revisao
voltarParaPreparar:  status=pending_review sentido=revisao   ← só a casca mudou
após re-derivar:     status=in_srs         sentido=revisao   ← voltou sozinho
```

**A regra da reversão virou peça única** (`desfazerSentido`), usada pelo botão individual e pelo
mutirão — regra duplicada é regra que diverge na primeira correção. Ela devolve `estudo`/`revisao`
para `pronto`, limpa `estudadoEm`/`enviadoEm` e remarca `selected`. **`saber` não é tocado**: é a
escolha dele ("conheço, não quero drilar"), e aquele sentido nunca esteve na fila.

**Os cards saem junto** — decisão dele, e é a única coerente: mantê-los deixaria o item no
Preparar **e** cobrando revisão ao mesmo tempo, o material vivendo em dois lugares, que é
exatamente o que o fluxo de 4 etapas veio acabar.

- **`cardsDoSentido(w, m)` casa pelo `meaningId`** e só cai na posição para card antigo que não o
  tem. Cair no `wordId` puro arrastaria os cards dos IRMÃOS — provado o isolamento: devolvendo só
  "fracassar", os 3 cards de "cair" ficaram de pé e o sentido continuou `revisao`.
- **Push imediato ao Firebase**, não o debounce de 1,2s: o merge do `fbPull` faz
  `if (!local) return cc`, ou seja, **card apagado que ainda esteja na nuvem ressuscita**. Apagar
  centenas e deixar a janela aberta seria pedir por isso.
- **A sessão de revisão em curso é encerrada** — ela apontaria para cards que não existem mais.

**Onde fica:** Configurações → Dados, recolhido como a zona de perigo, mas em **âmbar** e não em
vermelho (`.dz-suave`). Pintar as duas iguais ensinaria que o vermelho não quer dizer nada:
devolver não apaga uma palavra sequer — significados, exemplos, áudios e imagens ficam intactos.
O que volta é a **posição no fluxo**. O modal diz a conta exata antes (itens, sentidos, cards).

**A varredura pela mesma raiz achou mais dois** (`saveAllToSrs` e `saveSelectedToSrs`, os atalhos
"Salvar todos"/"Salvar selecionadas"): criavam card e cravavam `w.status = 'in_srs'` **sem tocar
no sentido** — item com card na Revisão e sentido ainda `pronto`, que a primeira re-derivação
devolveria ao Preparar. Corrigidos com a peça `_marcarSentidoNaRevisao`.

> **Bug de índice achado de brinde no `saveSelectedToSrs`**: era
> `w.meanings.filter(...).forEach((m, mi) => …)` — `mi` é a posição no array **filtrado**. Com
> qualquer sentido desmarcado as posições se deslocavam e o card nascia **apontando para o
> sentido errado** (o mesmo defeito posicional que a 93ª rodada matou no `meaningIdx`). Provado
> com 3 sentidos e o primeiro desmarcado: antes o card de "B" apontava para "A"; agora
> `meaningIdx` sai 1 e 2, certos. E o item continua `pending_review` porque "A" segue por
> decidir — antes o `in_srs` cravado escondia esse sentido do Preparar para sempre.

**Arquivos**: `js/review.js`, `js/settings.js`, `index.html`, `css/styles.css`. `sw.js` →
`englab-v155`.

### O ITEM COMO PÁGINA DE ESTUDO — as quatro fatias (2026-08-08)

Print do card de "Gals" com três observações dele: (1) a frase do livro estava mais em destaque
que todo o resto, sendo só referência de onde veio; (2) *"o que mais aqui seria importante pra um
estudante de línguas? Por exemplo Curiosidades"*; (3) o Estudar tinha o mesmo material do card de
erro — *"não acredito que tem que reduzir mais no card, mas sim enriquecer mais o Estudar"*.

E uma correção dele que inverteu o meu plano: eu tinha proposto recolher metade dos blocos com
medo da "parede". **"O item pode ficar grande. O estudo é pra isso, se derramar sobre o item."**
Ele está certo — recolher é a lógica do REVISAR aplicada na tela errada. **Nada é recolhido no
Estudar. Rolar a página é o estudo.**

**A régua que separa as duas telas**, e ela vale para as próximas rodadas:

> **O que ajuda a LEMBRAR pode estar no card. O que ajuda a CONSTRUIR vive só no Estudar.**

Nada do material novo vai para o SRS — não por poda, mas porque forma, padrão e colocação só
fazem diferença no primeiro contato.

#### FATIA 1 — a hierarquia

O problema não era só tamanho de fonte: eram **massa** (3 linhas em itálico, largura inteira),
**posição** (primeiro bloco depois do título) e **moldura** (barra de acento + rótulo em caixa
alta). A tela anunciava a citação como texto principal enquanto o significado vinha depois, em
uma linha.

A passagem tem outro papel: **é o único exemplo autêntico da página** (os outros três são
fabricados). Então virou o **exemplo #0**, dentro de "Em uso", marcada *"do seu livro"*, com o
termo em negrito. No topo ficou só um crédito de procedência clicável, que rola até ela e pisca.

Escala medida ao vivo: palavra (y=88) → procedência (y=151, 11px) → **significado (y=227, peso
700)** → definição → passagem (y=393).

#### O ARCO — o que substituiu a regra de recolher

Página longa não morre de tamanho, morre de falta de ordem. Os blocos contam uma história:

`O que é → A forma → Como se comporta → Com quem anda → Em uso → A régua → Também quer dizer →
De onde vem → Curiosidade → Na sua vida → Produza`

Reconhecer → entender → analisar a forma → ver em uso → distinguir do vizinho → aprofundar →
ligar ao histórico → **produzir**. Termina em produção porque é o único ato que sai dele.
**Bloco sem conteúdo não existe** — a lista é filtrada, e o índice sai da mesma lista, então
nunca aponta para seção vazia.

Índice fino à esquerda (some abaixo de 1100px) com marcador "você está aqui".

> ⚠️ **Duas armadilhas do navegador de teste, e a decisão que elas forçaram.** O
> `IntersectionObserver` seria a ferramenta certa para o marcador, e `requestAnimationFrame` o
> limitador certo para a rolagem. **Nenhum dos dois dispara na aba de teste** — ela não compõe
> frames (é a mesma causa de `screenshot` falhar e de `scroll-behavior: smooth` nunca completar).
> Sem conseguir medir, não entra: o marcador virou ouvinte de `scroll` com limitador por TEMPO,
> que eu consigo provar. Ler oito retângulos a cada 80ms não custa nada. De brinde, a rolagem
> suave passou a viver em `@media (prefers-reduced-motion: no-preference)`, que é o certo de
> acessibilidade e ainda tira a dependência de animação.

#### FATIA 2 — o que o app já sabia e nunca contou (zero IA)

- **`sense_audit` deixou de morrer no console.** A IA já delibera sobre todos os sentidos em toda
  análise — é isso que a faz escolher certo — e o resultado ia para `console.log` e acabava ali.
  **Já está pago.** Agora é guardado e vira "Também quer dizer", sem criar card para nenhum.
  ⚠️ O texto bruto é raciocínio interno (`"lei/regra: esvazia — SPLIT, test 2"`), então passa por
  limpeza. **Dois defeitos que o teste pegou:** a comparação era por string, e "moça/garota
  informal" não batia com "garota, moça" só por causa da ORDEM — agora é por conjunto de
  palavras; e a linha era comparada só com o sentido da tela, então "namorada" (que ele já tinha
  como `saber`) reaparecia como novidade — agora compara com TODOS os sentidos do item.
- **Os outros sentidos deste item**, cada um com o capítulo de onde veio e onde está no fluxo.
- **A família do lema** (Fase 3), com clique que leva ao parente.
- **📊 Quantas vezes aparece no seu livro.** O EPUB inteiro está guardado (`BookDB.set(id, blob)`
  em ler.js), então dá para contar as ocorrências do lema no livro todo — com as flexões vindas do
  mesmo gerador do glossário, senão "gals" não acharia "gal". Sob demanda e com cache: abrir e
  descomprimir custa décimos de segundo e ninguém deve pagar isso só por abrir um item.

#### FATIA 3 — os campos novos

Descoberta que ancorou tudo: **havia cinco gavetas mortas no modelo de dados** — `notes`,
`word_family`, `grammar`, `context_note`, `tags`. O normalizador salvava todas, a IA nunca era
solicitada a preenchê-las e nenhuma tela as mostrava. `grammar` passou a ser ocupada.

Novos: **`forms`** (gal → gals; a informação que mais faltava — o item foi capturado flexionado e
nada dizia a forma de dicionário), **`grammar`** (o padrão: "fall + adjetivo", "give up + -ing"),
**`collocations`**, **`confusoes`** (o vizinho COM a régua — sinônimo em lista nunca diz a
diferença, e a diferença é a informação toda), **`armadilha`** (falso amigo para lusófono),
**`curiosidade`** (nota cultural — etimologia continua em `origin_pt`, sem sobreposição) e
**`registro_uso`** (onde usar e onde NÃO — a leitura prática do chip "informal").

Regras que os tornam confiáveis:
- **"Vazio é resposta válida e frequente"**, escrito no prompt. Armadilha inventada é pior que
  campo vazio, porque ele memorizaria algo falso.
- **`_listaCurta`** aceita array, string com vírgulas ou array com buracos. Provado no teste com
  `collocations` vindo como string — o modelo barato faz isso, e um `.map` direto quebraria a
  análise inteira por causa de um campo secundário.
- **Nenhum deles entra na lista de preservados do merge.** Lá o valor ANTIGO ganha, e como o item
  antigo não tem nenhum destes campos o vazio venceria para sempre.

**"Completar material"** — a resposta à pergunta dele (*"devolver pro Preparar e re-analisar já
entra tudo isso?"*). Entra, mas não é preciso devolver: este botão pede **só o que falta**, sobre
o sentido que já está escrito. Resposta menor, mais barata, sem chance de mexer no que ele curou,
e **sem apagar card nenhum**. Só aparece para item do acervo antigo e some depois — inclusive
quando a IA responde que não há o que acrescentar, graças ao carimbo `material_at`, sem o qual o
botão pediria dinheiro para sempre.

#### FATIA 4 — Produza

Campo de escrita no fim: ele escreve uma frase própria e a Lexa devolve veredito, frase corrigida
(**só quando é diferente da dele** — devolver a mesma faria parecer que houve conserto),
comentário e leitura do registro. Uma chamada por resposta, só ao clicar.

O rascunho vive em memória, **não em `words`**: é exercício, não vocabulário — gravar faria isso
viajar para a nuvem e sujar o backup.

#### O que o teste ao vivo cobrou

- **Repintar jogava a página para o topo.** Completar material, contar no livro e pedir correção
  repintam o item inteiro — numa página longa isso é perder o lugar da leitura a cada ação, justo
  no fim dela. Agora a rolagem e o cursor do campo são preservados, e só voltam a zero quando o
  ITEM muda. Medido: rolagem 829 → 829.
- **Esc passou a valer dentro do campo de texto.** Setas e espaço continuam bloqueados enquanto
  ele escreve (senão a página andaria de item), mas Esc é o "me tira daqui" universal — e o
  rascunho sobrevive, porque vive fora do DOM.
- **O botão de contar estourava a coluna no celular** (400px numa tela de 372). Botão dentro de
  bloco de texto agora quebra linha.

**Arquivos**: `js/dossie.js`, `js/review.js`, `css/styles.css`. `sw.js` → `englab-v156`.

### O VÍDEO ENTRA NA FILA — a varredura das fontes (2026-08-08)

Pergunta dele depois das quatro fatias: *"o mesmo padrão é seguido em vídeo, podcast e netflix?"*
A varredura respondeu **não**, e achou três buracos.

**Seguem o padrão** (param no Preparar e ganham a análise principal, com os campos novos):
Netflix e Kindle pela extensão (`core.js:284`, nasce `pending_ai`), o leitor, e o `add.js`
(vocab.db, documento, mídia — traz material próprio mas para em `pending_review`; a preservação
mantém o que foi curado e os campos novos entram, porque **não** estão na lista de preservados).

**Não seguia:** o **vídeo** (`video-study.js`) tinha prompt próprio e reduzido (7 campos, sem
`origin_pt`, sem vizinhos, sem `sense_audit`) e chamava `saveToSrs(w.id)` — ia do vídeo **direto
para a Revisão, pulando Preparar E Estudar**. O **podcast** é uma entrada de `videos[]` com
`source_type: 'podcast'`, ou seja, o mesmo caminho e o mesmo problema. O **Assistente**
(`consulta.js`) também manda direto.

**Decisão dele: o vídeo passa a parar no Preparar, como todo o resto.** Era a única fonte que
pulava, e pulava sem dar escolha — o Preparar já tem um botão *"Pular para a Revisão"* explícito,
onde pular é um clique consciente. Na prática a Revisão enchia de item nunca estudado, que é
exatamente o que o fluxo de 4 etapas veio acabar.

O material da captura (sentido na cena, frase traduzida, **áudio real do trecho**) continua todo
lá e vira a **semente**: no Preparar ele escolhe mandar assim para o Estudar ou analisar antes.
O áudio sobrevive porque a chave é o `example_en` com as tags `<b>`, e a preservação de sentidos
curados mantém o exemplo intacto na re-análise.

> ⚠️ **O `clipId` teria sumido em silêncio.** Ele era carimbado nos cards logo depois da captura
> (`srsCards.forEach(c => …)`), o que só funcionava porque a captura criava o card na hora. Sem o
> `saveToSrs`, o card nasce muito depois e não haveria ninguém para carimbar — o **"Rever a cena"
> sumiria** sem erro nenhum. Agora o carimbo vai no ITEM e `createSrsCard` o copia, então
> sobrevive a qualquer caminho até o SRS (o "Estudei" do dossiê e o atalho do Preparar, ambos
> provados).

#### O Assistente também entrou na fila (2026-08-08)

Ele mandou corrigir logo em seguida, e é o mesmo raciocínio: **perguntar à Lexa é triagem, não
estudo.** O termo saía dali com significado e exemplos, mas ninguém tinha lido nada — e ia direto
para a repetição espaçada. Agora para no Preparar, e o material da Lexa vira a semente.

Uma consequência que só apareceu porque o Assistente passou a alimentar o dossiê: os itens dele
não tinham origem nenhuma, então caíam todos num dossiê **"(sem título)"** — toda conversa no
mesmo balaio. A conversa É a fonte, então virou `Assistente · <título da conversa>`. Provado com
duas conversas: cada uma virou o seu dossiê.

A cópia da tela acompanhou: *"já no estudo"* virou *"já é seu"* (o termo pode estar em qualquer
etapa, e mandar procurá-lo no Estudar seria mentira), e *"Adicionar todos"* virou *"Mandar todos
para o Preparar"*.

#### O buraco que eu não estava procurando: sentido sem `id`

Vídeo e Assistente criavam `w.meanings = [{ … }]` **sem `id`** — e `meaningId` é a identidade
card↔sentido desde a 93ª rodada. Consequências reais:

- o card nascia com `meaningId: ''` e **voltava a depender da POSIÇÃO**, o defeito que a 93ª matou;
- `_dossiePar` casa por `m.id`, então **"Estudei" nunca funcionaria** para item de vídeo;
- `completarMaterial` também usa `m.id` — o botão "Completar material" não funcionaria neles.

Corrigido nos dois, mais uma **rede na migração**: sentido já gravado sem id ganha um, e o card
órfão é religado **pela posição**, que é o único vínculo que lhe restava. Provado com o cenário
exato (dois sentidos sem id, dois cards com `meaningId: ''`): os dois ids nascem, os dois cards
religam ao sentido certo, o `clipId` antigo sobrevive e a religação persiste no IndexedDB.

**Arquivos**: `js/video-study.js`, `js/consulta.js`, `js/review.js` (migração), `js/srs.js`
(`clipId` no card). `sw.js` → `englab-v158`.

### O QUE TEM NESTA FRASE — os chips da explicação (2026-08-08)

*"Quando eu não entendo uma frase, pode se dar por ter elementos que não entendo ou que tenham
significado diferente do que sei."*

A explicação da Lexa resolve a frase; ela não diz **de que a frase é feita**. Um phrasal verb lido
como duas palavras soltas, uma colocação que parece livre, um idiom tomado ao pé da letra — nada
disso aparece numa explicação corrida, e é exatamente o que derruba a leitura.

Agora **toda explicação lista as unidades da frase** — palavra, phrasal verb, idiom, colocação e
bloco fixo —, cada uma com a categoria à vista e o que significa ALI. Clicar manda para o
Preparar, com a cena, a origem e a **glosa como semente** (a análise nasce sabendo qual sentido
procurar). O que ele já tem aparece marcado e não é clicável.

Vale nas três telas que explicam: leitor, vídeo/podcast e Preparar. **Os chips saem da FRASE, não
do pedaço selecionado** — quem não entendeu a frase precisa ver a frase inteira desmontada.

**A quebra é a MESMA peça do raio-X.** `_revBreakFetch` foi partido em `quebrarTrecho({trecho,
contexto, lang, fonte})`, e os chips chamam a mesma função. Escrever um segundo prompt seria a
receita conhecida — duas regras que divergem na primeira correção —, e aquele já carrega dez
armadilhas pagas (o "the mud" que virava colocação, a tradução literal, o trecho inteiro voltando
como unidade). Diferença única: `quebrarTrecho` devolve vazio em vez de lançar, porque "não achei
nada" é erro no raio-X (foi pedido) e resposta legítima nos chips; `_revBreakFetch` levanta o erro
por conta própria.

> ⚠️ **Dois defeitos que SÓ aparecem com frase inteira**, achados no teste:
> - **O phrasal verb flexionado sumia.** O filtro exigia o texto literal, o que funciona num
>   trecho curto (o modelo copia tal e qual) mas não numa frase: a IA devolve `"end up"` e a
>   frase traz `"ended up"`. O chip mais importante desaparecia em silêncio. Agora o **primeiro**
>   termo da unidade pode vir flexionado (é onde a flexão mora), com o resto batendo literal e na
>   ordem — tolerância estreita para não montar unidade com palavras espalhadas.
> - **A frase quase inteira passava como "bloco".** A regra antiga só barrava a cópia exata; num
>   trecho longo o modelo devolve a frase menos o ponto final. Rede grossa no código (metade do
>   trecho, teto de 8 palavras) e o julgamento no prompt: *"a unidade tem de sobreviver FORA desta
>   frase"* — `let the cat out of the bag` sim, `ruining the ethos of the whole thing` não.

Falhar na quebra **não estraga a explicação**: os chips somem em silêncio e o console guarda o
motivo. A explicação é o que ele pediu e já está na tela.

### O REENCONTRO NO VÍDEO (2026-08-08)

O vídeo era a última fonte que **duplicava o item**: perguntava *"palavra já existe, criar mesmo
assim?"* e o sim criava um `fall` novo ao lado do antigo — família rachada, verbete partido em
dois. Agora usa `prepAcharItem` + `prepararNovoSentido`, como o leitor: **a cena nova vira sentido
novo no MESMO item**, e o reconhecimento pega inclusive a forma flexionada da legenda.

Duas coisas que o caminho longo exigiu:

- **O áudio da cena vai sob DUAS chaves** — `boldEn` (o `example_en`, que é o que o estudo procura)
  e o texto limpo da fala (o que a passagem mostra no modo foco). No reencontro a análise reescreve
  os exemplos, então só a segunda sobreviveria — e sem ela a **gravação real da cena viraria lixo**.
- **O `clipId` do sentido só é carimbado em item NOVO.** No reencontro o sentido desta cena ainda
  não existe (a análise é assíncrona) e `meanings[0]` é o sentido ANTIGO — carimbá-lo mandaria o
  card do encontro passado para a cena errada. O sentido novo herda pelo `w.clipId`, que é
  justamente a cena mais recente.

De brinde, a passagem no modo foco ganhou **"Ouvir"** e, quando há cena de vídeo, **"Rever a
cena"**: a gravação real existia e não havia como tocá-la fora do card. E o selo deixou de dizer
"do seu livro" para tudo — série, podcast e YouTube têm cena, não página.

### OS DOIS PINCÉIS DA TRIAGEM (2026-08-08)

Pedido dele sobre a triagem por nível do leitor: uma opção **dentro de cada faixa** para resolver
as já marcadas como conhecidas (elas saem da verificação, o resto continua), e — a ideia boa —
uma **seleção de ferramentas**: *"se eu marcar somente as que desconheço, posso apertar o botão
de selecionar todos, que agora marcaria com outra cor que não como conhecido"*.

#### O que faltava era o TERCEIRO estado

A tela nasceu binária: marcado = conheço, não marcado = vai estudar. Funciona enquanto a proposta
da IA está quase certa e ele só desmarca a exceção; **não funciona quando a exceção é a maioria**.
E com dois estados, "não marcado" significa duas coisas ao mesmo tempo — *"ainda não olhei"* e
*"olhei e não sei"* —, então **nenhuma varredura em massa é segura**: ela atropela as duas.

```
(vazio) = ainda não olhei
'sim'   = conheço
'nao'   = não conheço   ← é isto que sobrevive à varredura
```

`_lerNiv.sel` (Set) virou `_lerNiv.marca` (Map de três valores).

#### As ferramentas, e a regra que faz o fluxo dele fechar

Dois pincéis no topo, um ativo por vez. **A ferramenta ativa decide o que o clique pinta**;
clicar de novo com o MESMO pincel apaga a marca (comportamento de pincel, não precisa ser
aprendido); com o pincel diferente, repinta por cima sem limpar antes.

> **"Sem olhar: conheço" pinta SÓ o que está sem marca.** É esta regra, e só ela, que faz o fluxo
> dele funcionar: marcar as 8 que não conhece e varrer as outras 300 como conhecidas vira uma
> varredura só, sem risco de apagar as 8. Quando a faixa não tem mais nada sem marca, o botão
> troca para **"toda a faixa"**, que repinta tudo — em vez de virar um botão que não faz nada.

Ele sugeriu como alternativa um ciclo de três estados no mesmo clique (1 clique = conheço, 2 =
não conheço). Ficou de fora porque as duas coisas brigam: com o pincel de "não conheço" na mão, o
primeiro clique teria de pintar "conheço" para respeitar o ciclo.

#### Resolver por faixa

`lerNivConfirmar(nivel)` — sem argumento vale para a triagem inteira (a barra do topo), com
argumento resolve só aquela faixa: grava as conhecidas, **tira-as da triagem** e deixa o resto da
faixa no lugar. O desfazer continua valendo.

**Âmbar, não vermelho**, para o "não conheço": não é erro nem perigo — é o que vale estudar, a
parte boa da triagem. E precisa ser inconfundível com o azul do "conheço" à distância de uma
varredura.

> ⚠️ **A repintura passou a ser POR FAIXA.** Um capítulo traz 400+ chips, e a tela refazia o
> `innerHTML` do corpo inteiro a cada clique — 400 nós reconstruídos para mudar um. Numa varredura
> de dezenas de cliques é a diferença entre responder e travar. Provado: clicar num chip de C1
> deixa A1 e B2 **como o mesmo nó** e refaz só C1 e a barra. (Trocar de ferramenta ainda repinta
> tudo, e deve mesmo: ela muda o rótulo de ação de todas as faixas.)
>
> O teste também pegou uma fragilidade de escopo: a busca da faixa era `document.querySelector`,
> que pega o primeiro nó da página inteira — com dois painéis na árvore, a faixa certa ficava sem
> repintar **em silêncio**. Agora a busca é dentro de `#ler-niv-corpo`.

**Arquivos**: `js/ler.js`, `css/styles.css`. `sw.js` → `englab-v160`.

### O TRABALHO SOBREVIVE AO RECARREGAMENTO (2026-08-08)

*"Quero que essa análise e os chips que a IA traz permaneçam mesmo quando a página recarregar,
pois posso não finalizar tudo na primeira vez."*

Duas coisas se perdiam, e as duas por motivos diferentes.

**As marcas da triagem.** A CLASSIFICAÇÃO já era gravada (é cara — uma chamada de IA por
capítulo); as marcas dele, não. Um capítulo de 400 palavras não se resolve numa sentada, e
recarregar devolvia a tela ao palpite inicial, jogando fora a triagem inteira. Agora vão para
`nivmarca:<livro>:<cap>`, em chave **própria** (junto seria reescrever o blob dos 400 itens a cada
clique) e com gravação **adiada** em 400 ms (numa varredura são dezenas de cliques por segundo, e
gravar em cada um faria a tela esperar o disco).

> ⚠️ **O registro gravado é a verdade INTEIRA, não um complemento ao palpite.** Se fosse
> complemento, DESMARCAR não sobreviveria: tirar "house" (A1, que nasce pré-marcada) some do mapa,
> e no recarregamento a pré-marcação a devolveria como conhecida — o app desfazendo a decisão dele
> em silêncio. Existindo registro, ele substitui o mapa. Provado com recarregamento real: as duas
> marcas 'nao', as seis 'sim' e **a desmarcação de "house"** voltaram idênticas.

Detalhes que o caminho exigiu: **"Refazer" apaga as marcas** (classificação nova = lista nova, e
marca velha apontando para ela daria a pior impressão possível — palavra marcada como conhecida
sem ele ter olhado); **o desfazer devolve as palavras MARCADAS**, que é o estado em que estavam um
instante antes de confirmar; e **apagar um livro leva junto** `pre:`, `niv:` e `nivmarca:` — antes
só `pre:` era limpo, e o resto ficava órfão no IndexedDB para sempre.

**A quebra da frase.** O cache dos chips vivia só em memória: a mesma frase custava de novo a cada
recarregamento. Ele foi para o IndexedDB — **e mudou de lugar no caminho**. Nasceu dentro dos
chips, mas cache em quem CONSOME deixava o raio-X do Preparar de fora, e seriam duas cópias da
mesma coisa. Foi para dentro de `quebrarTrecho`, **em quem produz o caro**: agora os chips e o
raio-X ganham juntos. Medido: 1 chamada, e nem a segunda montagem nem a "de depois do
recarregamento" custam outra.

> **Resposta vazia não vai para o disco.** Pode ser tropeço do modelo, e gravada condenaria a
> frase a nunca mais ser quebrada. Na memória tudo bem — morre com a sessão.

**Arquivos**: `js/ler.js`, `js/review.js`, `js/ai.js`. `sw.js` → `englab-v161`.

### O PAINEL DA LEXA — a explicação sai do balãozinho (2026-08-08)

*"Essa análise que é feita dos chips é meio apertada do jeito que é hoje. Ao apertar no botão de
análise com IA deve abrir um painel completo só seu, pra máximo foco e concentração, mas sendo
possível sair do modo full."*

O popup do leitor é `max-width: min(420px, 92vw)`. Quando ele só carregava "2 a 4 frases", isso
bastava. Hoje carrega explicação + os chips de **todas** as unidades da frase + a conversa que
continua dali — e 420px espremem as três.

**Um painel, dois tamanhos, e o MESMO DOM nos dois.** Alternar é trocar uma classe, então nada se
perde na troca: nem a conversa, nem os chips, nem a rolagem. Remontar em outro hospedeiro é que
perderia. `cheio` cobre a tela; `compacto` é um cartão centrado com a página visível por trás (no
celular vira folha de baixo). A escolha fica guardada em `uiPrefs` — quem prefere um dos dois
prefere sempre. Esc fecha, clique no fundo fecha, clique dentro não.

Vale nas **três** telas que explicam: leitor, vídeo/podcast e Preparar.

**O que caiu junto, de graça:** no leitor, a explicação dependia da seleção continuar de pé, e por
isso existia uma trava (`aoFoco` → `_lerIgnoraSel`) só para o vigia de seleção não fechar o popup
enquanto ele digitava na conversa. O painel não depende da seleção — a briga inteira deixou de
existir.

> ⚠️ **O acerto de cache passou a dar tela pela metade.** `_revExplainCache` guardava só o HTML e
> a função voltava ali mesmo — o que já deixava chips e conversa de fora, mas passava
> despercebido num balãozinho. Num painel inteiro seria gritante: reabrir a mesma seleção abriria
> uma tela sem chips e sem poder perguntar nada. Agora ele guarda
> `{html, sistema, pergunta, resposta}` e a montagem virou **uma função só**, chamada tanto pelo
> cache quanto pela IA — duas cópias é como a divergência começou.

> ⚠️ **Coluna de leitura medida em `ch` dentro de cada filho desalinhava a tela.** Cada elemento
> usava a PRÓPRIA fonte como régua: a frase (maior) dava 640px e o corpo (menor) 581px, e os dois
> não batiam. Medido no teste, corrigido pondo a medida **uma vez, no contêiner** — agora topo,
> frase, corpo, chips e conversa começam e terminam no mesmo pixel.

Cada caminho ganhou um guarda `vivo()`: fechar o painel enquanto a IA responde não pode fazer o
app reabri-lo sozinho.

**Arquivos**: `js/ai.js`, `js/ler.js`, `js/video-study.js`, `js/review.js`, `css/styles.css`.
`sw.js` → `englab-v162`.

### CURIOSIDADE NÃO É REGISTRO (2026-08-08)

Print da "Curiosidade" de **gals**: *"Em títulos e expressões como 'pals 'n' gals', a palavra
costuma aparecer em tom leve, amistoso e um pouco retrô."* A pergunta dele: *"isso realmente é uma
curiosidade?"*

Não é — **é registro**, e registro tem campo próprio (`registro_uso`). O defeito era meu, na
especificação: eu tinha escrito *"a cultural fact, a famous use, why it is spelled that way,
**where it is heard**"*. Esse "where it is heard" É o trabalho do `registro_uso`, então o campo
tinha licença para invadir o vizinho. E "genuinely interesting" não restringe modelo nenhum: ele
satisfaz o adjetivo com uma observação de tom bem escrita.

Duas correções, nos três lugares onde a regra vive (schema da análise, `completarMaterial` e o
bloco compartilhado):

- **Cada campo tem UM trabalho e eles não se sobrepõem.** Tom, estilo e onde se ouve →
  `registro_uso` (que passou a dizer explicitamente que é a casa disso). De onde a palavra veio →
  `origin_pt`. Fato sobre o mundo → `curiosidade`. Escrever registro dentro de curiosidade é
  **resposta errada, não resposta fraca** — e o caso real ficou nomeado no prompt.
- **"Interessante" virou testável.** Curiosidade agora é *um fato sobre o mundo — datável,
  nomeável, verificável*, com exemplos do que serve (obra/marca/pessoa com data, evento que
  espalhou a palavra, sentido completamente diferente em outra área — "gal" também é a abreviação
  de "gallon") e do que é rejeição. Mais **o teste da troca**:

> Se a mesma frase continuaria verdadeira trocando o item por centenas de outras palavras, ela não
> diz nada sobre ESTE item — devolva `""`.

O texto do print falha nesse teste de forma perfeita, e por isso passava.

**E o dado já gravado não se conserta sozinho** (quarta vez que este projeto paga essa lição).
`completarMaterial` ganhou o modo **refazer**: pede tudo de novo com as regras atuais e
**sobrescreve**, inclusive com vazio — sem aceitar o vazio, "melhorar" nunca conseguiria APAGAR
uma curiosidade que era registro disfarçado. A seção do foco troca de cara conforme o estado:
"Falta material" (completar) ou "O material desta análise" (refazer). Significado, definição e
exemplos continuam intocados nos dois casos.

Provado com o texto exato do print: a seção **Curiosidade desapareceu** (campo voltou vazio) e o
conteúdo reapareceu em *Como se comporta*, como registro.

**Arquivos**: `js/review.js`, `js/dossie.js`. `sw.js` → `englab-v163`.

### A FORMA NEUTRA E A FAMÍLIA COMPLETA (2026-08-08)

Print do estudo de **Gals**, e três pedidos: o item devia aparecer na forma neutra; devia haver uma
seção de **tempos verbais**; e uma seção com **TODOS** os phrasal verbs, idioms e collocations que
existem com aquele item — *"se eu quiser mandar algum phrasal verb pra Preparar quero que esteja a
1 clique de distância"*.

#### A forma de citação

O texto é capturado como aparece no livro, então chega flexionado e com a maiúscula da frase. O
campo `word` do prompt dizia só *"exact word or expression to study"* — a IA devolvia "Gals" de
volta, e o verbete arquivava a forma da cena. Agora ele pede a **forma de citação**, e a regra que
já existia para o extrator de documento veio junto: *canonicalizar não é encurtar*.

> ⚠️ **Aceitar o que a IA devolve às cegas é trocar a IDENTIDADE do item.** `w.word` é a chave do
> `prepAcharItem`, é o `audioKey` do áudio já gerado e é o texto congelado nos cards — um
> "fall in love" → "fall" partiria a família e deixaria card apontando para outra palavra.
> `_mesmoItemCanonico` exige **mesma quantidade de palavras** e cada palavra igual ou da mesma
> família de lema: muda a flexão e a caixa, nunca a extensão. Provado nos seis casos:
> `Gals→gal` ✓, `fell in love→fall in love` ✓, `ran by→run by` ✓, `fall in love→fall` ✗,
> `get up→get` ✗, `gal→woman` ✗.

O item já gravado se conserta pelo **Refazer o material**, que agora também devolve a citação —
provado: `w.word` saiu de "Gals" para "gal".

#### Tempos verbais e a família

As duas vêm da **mesma chamada** (`expandirFamilia`), **sob demanda** e guardadas **no item**, não
no sentido: "get up" existe independentemente de qual sentido de "get" ele encontrou no livro.

É uma chamada separada porque para "get" a lista é de dezenas de linhas — enfiá-la na análise de
todo item pagaria caro em cada captura por algo que ele talvez nunca abra.

A família é **diferente de tudo que já existia** no item, e vale registrar para não se
sobreporem de novo:
- `collocations` — as que acompanham AQUELE SENTIDO, poucas, para produzir;
- `sense_audit` — os outros sentidos da MESMA palavra;
- **família** — as unidades MAIORES que a palavra forma, que são itens de estudo à parte.

Cada linha tem **Preparar a um clique** (o pedido literal) e **explicar** ao lado, que abre o
painel da Lexa sem tirar ninguém do estudo. O envio reusa `lexaChipParaPreparar` — mesma criação,
mesma semente, mesma proteção contra duplicar. O que ele já tem aparece marcado e sai de cena.
Medido: um clique em "get over" → item novo em `pending_ai`, tipo `phrasal_verb`, glosa como
semente, cena herdada, **zero cards** (parou no Preparar), e a linha vira "já é seu".

> ⚠️ **Dois filtros que o teste corrigiu.** O primeiro: o item voltava como membro da própria
> família, porque o modelo devolve a forma do livro ("Gals") e o item já está canônico ("gal") —
> comparação literal não pegava. Passou a usar a mesma guarda da citação. O segundo veio do
> conserto: a guarda engoliu **"getter"**, e palavra derivada é *por definição* da mesma família
> de lema — sumia justamente a categoria pedida. Para `derivada` basta não ser a mesma palavra
> escrita igual.

#### E então: SELECIONAR, que é mais abrangente

Correção dele assim que a família ficou pronta: *"um clique é modo de falar, deve aceitar o
selecionar, que é mais abrangente"*. E é mesmo — o botão por linha só serve as linhas que EU
previ. A dúvida real cai em qualquer lugar: uma palavra dentro de um exemplo, um pedaço da
definição, duas palavras no meio da passagem do livro.

`selMenuAtivar(container, obterContexto)` é a peça, e é **genérica**: qualquer contêiner liga o
menu passando um jeito de descrever o que está em volta. Ligada no **painel de estudo** e no
**painel da Lexa** (a explicação costuma trazer outra palavra que ele também não conhece, e parar
ali para perguntar é o uso natural). O leitor e o Preparar mantêm os popups deles, nascidos antes
e presos às telas; este é o que serve daqui para frente.

`obterContexto` é **função, não valor**: o painel troca de item embaixo do ouvinte, e o ouvinte é
ligado uma vez por caixa. Provado: selecionar "the hang of it" dentro da passagem do livro abriu o
menu, e Preparar criou o item em `pending_ai` **com a cena e a origem herdadas**, sem card.

Detalhes que o comportamento exigiu: soltar o mouse em cima de um botão não conta como seleção
(senão o menu nasceria por cima do próprio botão), o `mousedown` no menu não desfaz a seleção nem
borbulha para o fundo dos painéis (que fecham ao clique de fora), e o menu vive em `--z-modal-pop`
— acima do painel, senão nasceria atrás da tela onde ele está selecionando.

**Arquivos**: `js/review.js`, `js/dossie.js`, `js/ai.js`, `js/ler.js`, `js/video-study.js`,
`css/styles.css`. `sw.js` → `englab-v165`.

### O RITMO DO PAINEL DE ESTUDO (2026-08-08)

*"O painel de estudo tem bastante informação valiosa, mas as informações parecem querer viver uma
dentro da outra. Falta conforto visual, separação mais coerente entre as seções."*

**Medido antes de mexer**, e o número explica tudo:

```
24px ENTRE as seções   ×   8px DENTRO delas
```

Seções de 46px ("De onde vem", "Curiosidade") separadas por 24px — **a distância era menor que a
própria seção**. E cada bloco tinha um tratamento próprio (caixa de código, tabela, cápsulas,
chips, texto nu, lista com risco à esquerda), então blocos vizinhos não compartilhavam âncora
nenhuma. Era literalmente isso o "querer viver uma dentro da outra".

Três decisões, em ordem de impacto:

1. **O rótulo ganhou coluna própria.** Todas as seções passam a começar no mesmo x e o rótulo
   nunca disputa a linha com o conteúdo — é o que dicionário e obra de referência fazem, e é o que
   dá âncora comum a blocos de formatos diferentes. Ele **gruda no topo** enquanto a seção rola:
   numa lista de 40 expressões, saber em que seção se está deixa de depender da memória.
2. **O espaço entre passou a dominar o espaço dentro**: 32px de margem + filete + 32px de recuo
   (64px de conteúdo a conteúdo) contra 10px do rótulo ao texto. É a única regra que faz
   agrupamento visual funcionar.
3. **A decoração interna diminuiu.** Com separação de verdade entre seções, borda e fundo dentro
   de cada uma viram terceiro nível de moldura — e redundância lê como aperto. O risco à esquerda
   das listas saiu; o que separa os itens agora é espaço.

> ⚠️ **A coluna do rótulo não pode sair da largura de leitura.** Primeira tentativa (56rem) deixou
> o texto com **78 caracteres por linha**, acima do confortável, porque a coluna do rótulo somou-se
> à coluna de texto em vez de sair dela. Com 48rem a leitura voltou a **64 caracteres**, meio da
> faixa boa (55–75).

A coluna só existe onde há largura para ela (≥1000px); abaixo disso o rótulo volta a ficar acima do
conteúdo. **E o celular tinha um override antigo** que deixava a margem em 20px — justo onde a
separação importa MAIS, porque sem a coluna do rótulo o espaço e o filete são tudo o que resta.
Corrigido para 44px de conteúdo a conteúdo.

**Arquivos**: `css/styles.css`. `sw.js` → `englab-v166`.

#### E aí veio a correção: NÃO LIMITE O CONTEÚDO

*"Atenção, não quero que você limite caracteres, se é o que fez. O que quero é a organização das
informações somente."*

A palavra que eu usei ("64 caracteres") era largura de LINHA — onde ela quebra —, e o CSS foi
conferido: **não há `ellipsis`, `line-clamp` nem altura fixa** em nenhum ponto do painel; nada
estava sendo cortado ali. Mas a preocupação dele estava certa no geral, porque **eu tinha criado
tetos de QUANTIDADE em rodadas anteriores**, e esses cortavam de verdade:

| onde | era | virou |
|---|---|---|
| `forms`, `collocations` | 6 | sem teto |
| `confusoes` | 4 | sem teto |
| conjugação | 10 | 24 |
| família | 60 | 200 |
| `sense_audit` | 12 | 30 |
| sinônimos na tela | 5 (foco) / 4 (card) | todos |
| antônimos na tela | 4 (foco) / 3 (card) | todos |
| "Também quer dizer" | 8 | todos |

> **A regra que ficou:** o teto existe contra LIXO, não contra quantidade — resposta enlouquecida
> (parágrafo inteiro no lugar de uma colocação) e item repetido. Quem organiza é a tela; o dado
> vem inteiro. O pior dos cortes era o de EXIBIÇÃO: o dado estava gravado e pago, e a tela
> escondia parte dele sem dizer nada.

Os prompts também pediam pouco por omissão — `collocations` e `confusoes` ganharam *"seja
COMPLETO, 4–10 é o normal para uma palavra comum, não pare em três"*.

Medido depois, com um item inflado de propósito: forma 9/9, colocações 12/12, régua 8/8,
conjugação 14/14, família 75/75, sentidos 13/13, sinônimos 11/11 — **tudo inteiro**, sem estouro
horizontal. E o normalizador continua barrando o que deve: string de 200 caracteres e entrada
repetida.

**Arquivos**: `js/review.js`, `js/dossie.js`, `js/study.js`. `sw.js` → `englab-v167`.

#### E o último teto: curiosidade e armadilha viram LISTA

*"A curiosidade agora tá bem legal, mas não precisa ser só uma. Deve trazer tantas quantas
houverem. Não deve haver limitação."*

Os dois campos eram **texto único**, e isso é um teto disfarçado de formato: obrigava a IA a
escolher uma curiosidade e jogar as outras fora. Uma palavra rica tem três ou quatro; e
`armadilha` tinha exatamente a mesma forma e o mesmo problema — um item pode ter mais de um falso
amigo —, então as duas mudaram juntas. O prompt passou a dizer, com destaque, que **não há teto**,
e que se para só quando a próxima entrada falharia no teste da troca.

O rótulo acompanha o conteúdo: **"Curiosidade" com uma, "Curiosidades" com várias** (e o mesmo
para "Cuidado"/"Cuidados"). Uma nota só continua sendo parágrafo — numerar um item é ruído.

> ⚠️ **`[]` é truthy em JavaScript.** Com os campos virando lista, o `m.armadilha ? …` que decidia
> "este item já tem material" passaria a dizer SIM para um item cujo campo voltou vazio — e a
> oferta de "Completar material" sumiria justamente de quem mais precisa dela. Tudo passou por
> `_dosTem`, que mede array e string pela mesma régua.

**Sem migração de dado**: `_dosLista` aceita string e array, então item já gravado continua
legível. Migrar o acervo só para mudar a forma seria arriscá-lo por nada.

Provado nos quatro casos: várias (3 de 3 e 2 de 2 na tela, com os rótulos no plural), uma só
(parágrafo, singular), string antiga (aparece igual) e lista vazia (a seção não existe e a oferta
de completar continua de pé).

**Arquivos**: `js/review.js`, `js/dossie.js`, `css/styles.css`. `sw.js` → `englab-v168`.

#### O bug que a lista criou: "digest-sized" perdeu a curiosidade

Relato dele, uma rodada depois: *"digest-sized antes tinha curiosidade e depois que recarreguei e
cliquei em refazer o material não veio nenhuma, ao invés de vir mais."*

Duas falhas no MESMO normalizador, e as duas só aparecem em campo de **prosa**:

1. **O teto de 140 caracteres.** Ele foi escrito como guarda contra lixo pensando em colocação
   (2-4 palavras). Curiosidade é **1-2 frases** — a real de "digest-sized" tem **170 caracteres**,
   e TODAS caíam. Reproduzido no teste: `_listaCurta([texto de 170]) → 0 entradas`.
2. **A quebra por vírgula.** Quando o modelo devolve string em vez de array, quebrar em vírgulas é
   o certo para uma lista curta ("get up, get over") e é destruição numa frase — a mesma
   curiosidade virava três fragmentos sem sentido.

Viraram **duas funções, porque são duas naturezas**: `_listaCurta` (itens de poucas palavras;
quebra string; teto 140) e `_listaTexto` (uma frase por entrada; string é UMA entrada; teto 900).
`confusoes` foi junto — *"girl — neutro, mas infantiliza uma adulta"* tem vírgula e passa de 140.

> ⚠️ **Mas o pior não foi o corte: foi o SILÊNCIO.** O refazer sobrescreve de propósito (é assim
> que uma curiosidade ruim sai), e isso o torna capaz de **destruir material bom quando a resposta
> chega quebrada** — sem nada na tela dizendo por quê. Duas redes:
>
> - **Refazer com resposta inteiramente vazia não escreve nada.** Um item que TINHA material nunca
>   volta com todos os campos vazios de verdade; quando isso acontece, o problema é a resposta, e
>   resposta quebrada não pode apagar o que está no aparelho. Avisa e pede para tentar de novo.
> - **Bloco que esvaziou é NOMEADO no aviso**: *"Material refeito — a IA não devolveu curiosidade
>   desta vez"*. Perder conteúdo tem de ser dito, não descoberto depois.

Provado nos três casos: curiosidades de 170 caracteres agora são guardadas (eram 0); resposta
vazia preserva o que existia e devolve `false`; e perda parcial legítima acontece **com aviso
nomeando o bloco**.

**Arquivos**: `js/review.js`. `sw.js` → `englab-v169`.

### O ITEM NUNCA SAI DE VISTA (2026-08-08)

*"Quero que ao dar scroll down o 'digest-sized' ainda apareça no topo, pra sempre ter em vista o
item de estudo."*

O cabeçalho subia junto com a rolagem, e a página virava um monte de seções sem dono — *"de
formato pequeno, compacto"* sem a palavra em cima. Agora ele fica preso no topo, mas **encolhe**:
em tamanho cheio (título serifado + chips + procedência) comeria 115px de uma tela de 790 para
sempre. Pinado, sobra o essencial — palavra, pronúncia e o botão de ouvir — em **62px**.

O interruptor entra no ouvinte de rolagem que já existia (o do marcador do índice): é o MESMO
evento, e dois ouvintes no mesmo elemento seria pagar duas vezes pela mesma informação.

> ⚠️ **O recuo do topo tinha de mudar de dono.** Com `padding-top` no corpo, o cabeçalho pinado
> parava 20px abaixo da borda e **o texto escorria por essa faixa, aparecendo ACIMA do item** —
> medido: *"adjetivo atributivo: digest-sized…"* visível por cima do próprio cabeçalho. O recuo
> passou para o cabeçalho; a faixa foi a zero.

> ⚠️ **No celular a linha do título quebrava em duas.** "Pronúncia" + "Frase" não cabem em 375px
> ao lado da palavra, e o cabeçalho fixo ficava com **94px de 812**. Os rótulos dos botões foram
> para dentro de um `<span>` — some o texto, ficam os ícones, e ouvir continua a um toque. Resultado
> medido: **64px, 8% da tela, numa linha só**.

O `top` dos rótulos das seções desceu para 60px, senão eles deslizariam por baixo do cabeçalho
pinado e sumiriam justamente nas seções longas — que é quando servem.

**Arquivos**: `css/styles.css`, `js/dossie.js`. `sw.js` → `englab-v170`.

### OBRA → CAPÍTULO → ITENS, E O TÍTULO LIMPO (2026-08-08)

Dois pedidos sobre a lista do Estudar: *"a hierarquia aqui deve ser Obra → capítulo/episódio →
itens"* e *"o título deve ser não o que veio do original, pois pode ter lixo junto, mas o que de
fato se chama assim como o autor"*.

#### A hierarquia

A lista era **plana**: um cartão por (obra, capítulo). Um livro de doze capítulos virava doze
cartões soltos repetindo o mesmo título, e o progresso do LIVRO não existia em lugar nenhum.
Agora a obra é o contêiner e os capítulos são linhas dentro dela — o título aparece uma vez, com o
progresso da obra inteira ao lado do de cada capítulo. Capítulo é **linha, não cartão**: cartão
dentro de cartão é a moldura dupla que já tinha apertado o painel de estudo.

#### O título limpo

O `source_title` é o que a fonte deu, e a fonte traz lixo: `Billy Summers (US Edition)`,
`Flags on the Bayou - Unabridged.epub`, `Better.Call.Saul.S01E03.1080p.WEBRip`.

> ⚠️ **A chave de agrupamento continua sendo o título BRUTO.** Reescrever `w.source_title`
> reagruparia o acervo inteiro e quebraria os dossiês já abertos, o `_dossieChave` gravado e a
> origem de cada sentido. O que entrou é uma **camada de exibição**: `obrasNome` mapeia bruto →
> `{titulo, autor}`, e `obraNome()` cai no bruto quando não há resolução — a tela nunca fica
> esperando IA para desenhar.

**Uma chamada para TODAS as obras pendentes**, não uma por obra: são poucas, a resposta é
minúscula, e a lista completa dá à IA o contexto de que se trata de uma estante — o que a ajuda a
reconhecer título mutilado. O botão diz "1 chamada" porque o custo é dele. Some depois de
resolvido.

O prompt separa o que é ruído (`(US Edition)`, `.epub`, `1080p`, `S01E03`, editora, narrador) do
que é título (subtítulo depois de dois-pontos, número de série, artigo), e proíbe inventar: sem
reconhecer a obra, apenas limpa a string recebida. **Resolução para obra que não estava na lista é
descartada** — o modelo às vezes devolve entradas a mais, e uma obra inventada aqui viraria um
dossiê com nome que não corresponde a nada.

O nome limpo vale em toda parte: lista, cabeçalho do dossiê aberto e procedência do modo foco. **A
busca aceita os dois** — ele pode procurar por "Billy Summers" (o que a tela mostra) ou por "us
edition" (o que lembra do arquivo).

Provado com um acervo de três obras e cinco capítulos: Billy Summers virou UMA obra com dois
capítulos; a chamada listou os 3 títulos pendentes de uma vez; a obra inventada foi recusada; o
convite sumiu; e a busca achou pelos dois nomes. No celular, a linha do capítulo tem 44px de
toque e nada estoura.

**Arquivos**: `js/core.js`, `js/init.js`, `js/review.js`, `js/dossie.js`, `css/styles.css`.
`sw.js` → `englab-v171`.

#### E aí veio a pergunta certa: por que não já vem limpo da fonte?

*"Mas ao trazer da fonte um item já vem assim limpo? É isso que quero."*

O conserto anterior estava pela metade: eu limpava na EXIBIÇÃO, mas quem chegava novo continuava
entrando com o nome sujo. E havia um defeito escondido nisso — item capturado ANTES da limpeza e
item capturado DEPOIS teriam títulos diferentes e virariam **dois grupos exibindo o MESMO nome na
tela**. O pior resultado possível: parece defeito sem dar como entender.

Duas correções:

1. **O agrupamento passou a ser pelo nome RESOLVIDO**, não pelo bruto. Assim as duas versões
   convergem sozinhas e nenhum dado precisa ser reescrito. Provado: "Billy Summers (US Edition)" e
   "Billy Summers" viram um grupo só, com os dois capítulos juntos.
2. **A resolução acontece na ENTRADA**, não num botão lá adiante: ao importar um livro, um vídeo
   ou um episódio de podcast, o título é resolvido em segundo plano. Uma chamada por OBRA — não
   por item —, e daí em diante tudo que sair dali já nasce com o nome certo. A estante de livros
   também passou a mostrar o nome limpo.

O botão manual continua, mas agora só para o acervo antigo — some quando não há mais o que limpar.
E resolver o mesmo livro duas vezes não custa nada: o mapa é consultado antes.

**Arquivos**: `js/ler.js`, `js/video.js`, `js/video-podcast.js`, `js/dossie.js`.
`sw.js` → `englab-v172`.

#### A obra é uma PASTA, não uma gaveta escancarada

*"Quer dizer que todos os capítulos vão aparecer aqui? Imagina isso cheio e vários livros. Os
capítulos têm que aparecer somente quando eu clicar no card da fonte, tipo como acontece em
pastas."*

Certo — a hierarquia resolveu a repetição do título, mas escancarava tudo: um livro de 12
capítulos despejava 12 linhas, e com a estante cheia a tela virava a parede que a hierarquia veio
desfazer. Agora a obra nasce **fechada** e diz quantos capítulos tem; eles aparecem ao clique.

Medido com 3 obras (uma de 12 capítulos): **381px fechado, 876px com uma aberta** — e 0 linhas de
capítulo na tela até ele pedir.

Três comportamentos que a pasta exigiu:

- **Buscando, tudo abre.** O resultado de uma busca é justamente a linha lá dentro; escondê-la
  faria a busca parecer quebrada. Provado: buscar "capítulo 2" abre só a obra que tem, com 1 linha.
- **A obra fica aberta para a volta.** Ele estuda um capítulo, volta, e encontra a pasta como
  deixou — fechá-la o obrigaria a reabrir a cada capítulo, que é o atrito que a pasta veio remover.
- **O estado é da SESSÃO**, como a busca e o filtro: abrir o app com doze pastas escancaradas seria
  o problema de novo.

O cabeçalho virou `<button>` com `aria-expanded`, e a seta gira. No celular, 120px de toque e nada
estoura.

**Arquivos**: `js/dossie.js`, `css/styles.css`. `sw.js` → `englab-v173`.

#### O "Explicar" que não fazia nada — armadilha nº 1 de novo

*"Ao clicar em explicar o balão some e não acontece nada."*

Reproduzido com o console aberto: **`ReferenceError: lexaNome is not defined`**. É a armadilha nº 1
do projeto, na forma mais silenciosa possível — `_selMenuFechar()` roda ANTES de abrir o painel,
então o balão sumia; o erro derrubava a função na linha seguinte e morria no console. Nenhum aviso,
nenhum toast: só "não acontece nada".

`lexaNome()` nasceu como `const` dentro de **`ler.js`, que é LAZY**. Enquanto só o leitor a usava,
tudo bem. Quando o painel da Lexa, o menu de seleção (`ai.js`, SHELL) e o Preparar (`review.js`,
SHELL) passaram a chamá-la, ela deixou de existir em qualquer sessão onde o leitor nunca tivesse
sido aberto — que é o caso normal de quem entra direto no Estudar.

> ⚠️ **A correção óbvia estava errada e teria sido pior.** Declarar `function lexaNome()` em
> `ai.js` faria o `const lexaNome` de `ler.js` estourar com *"Identifier has already been
> declared"* ao carregar o leitor — trocando um botão quebrado pelo **leitor inteiro** quebrado.
> Um `const` de script não convive com propriedade global não configurável de mesmo nome.

A definição foi para **`core.js`**, o primeiro arquivo a carregar, e é tolerante (`LEXA_NOME` vem
de `ai.js`, que carrega depois — o corpo só roda quando alguém chama). `ler.js` deixou de
redeclarar. **Uma definição, alcançável de todo lugar.**

Provado nos dois lados: numa sessão **sem o leitor carregado**, selecionar e clicar em Explicar
abre o painel com título, frase, resposta e conversa; e carregar o leitor depois disso **não gera
erro nenhum** — que é onde o "already been declared" apareceria.

**Arquivos**: `js/core.js`, `js/ai.js`, `js/ler.js`. `sw.js` → `englab-v174`.

### A fonte ancestral (2026-08-08) — e o balão que voltou

Ele mandou um PDF com três defeitos. Dois eram o mesmo defeito.

**O que aconteceu.** Estudando *digest-sized*, ele selecionou **"cramped"** dentro do exemplo #2
(*"Maya chose a digest-sized cookbook for her cramped kitchen."*). A Lexa abriu mostrando a
passagem de **Billy Summers** como sendo "a frase", respondeu *"cramped não aparece nessa frase"*,
e os chips listaram as unidades da passagem do livro. Mandada ao Preparar, "cramped" nasceu com
`source_title = Billy Summers (US Edition)` e a passagem do digest-sized por contexto. Nas
palavras dele: ***"ta pegando fontes ancestrais pra novas fontes"***.

**A raiz.** `obterContexto()` era chamado **sem argumento nenhum**. O dono do menu só sabia
responder *"o que está em foco na tela"* — e o que está em foco é o ITEM. Onde na página a seleção
caiu, ninguém perguntava. Selecionar em qualquer lugar dava a mesma resposta.

**A regra que entrou** (`_dosSelContexto`, em `js/dossie.js`):

> **A passagem é o único pedaço autêntico da página.**

Ela veio mesmo da obra. Todo o resto — exemplos inventados pela IA **para este item**, definição,
colocações, família, conjugação — é material do estudo. Então:

| Onde a seleção caiu | frase | procedência |
|---|---|---|
| `#dosf-passagem` | `m.context` | a obra (livro, cena, episódio) |
| `.dosf-ex` (exemplo da IA) | a linha `.dosf-ex-en` daquele exemplo | `OBRA_ESTUDO` · o item |
| colocação, família, forma, definição… | a LINHA em volta, se ≤ 300 caracteres | `OBRA_ESTUDO` · o item |

`OBRA_ESTUDO` (`"Do seu estudo"`) mora em **`js/core.js`**, junto de `obraNome`. É excluída da
limpeza de títulos com IA em **dois** pontos — `resolverNomesDeObra` e `_dosObrasSujasHTML` —
porque o nome já nasce limpo e mandá-lo à IA a faria "reconhecer" um livro inexistente.

Detalhes que só aparecem testando: a frase do exemplo sai da linha em **inglês** mesmo quando ele
seleciona na tradução (é o inglês que dá o sentido); e a leitura do texto **não** usa `textContent`
puro — a linha da família é `<b>booklet</b><span>livrinho</span>` e virava `"bookletlivrinho"`
indo assim para o prompt.

**⚠️ O mesmo defeito estava em mais dois lugares**, achados na varredura e corrigidos junto:

- **`dossieFamiliaPreparar`** — o botão "Preparar" da família dava ao membro (`booklet`) a cena e a
  obra da raiz. O botão errava tão fácil quanto o selecionar errava.
- **`revSelExplain`** (Preparar) — os chips herdavam sempre `w.source_*`, e o cartão do Preparar
  também mostra exemplos da IA. Entrou `_revOrigemDaFrase(w, frase)`, que compara a frase lida do
  DOM com o `w.context` guardado (tolerante nos dois sentidos, porque o bloco do DOM pode trazer um
  pedaço a mais ou a menos).

**O terceiro defeito: o modo suspenso.** *"Ao clicar em explicar abriu um novo painel, não ficou no
modo suspenso, que é o que eu queria nesse caso."* Faz sentido: perguntar durante a leitura é gesto
de passagem, e o painel inteiro cobre justamente a frase que motivou a pergunta. Agora o **balão
cresce no lugar** (`#sel-menu.sel-exp`, ~480px, corpo com rolagem própria) e traz a resposta ali
mesmo, com três botões: **Preparar**, **expandir** e **fechar**.

O painel não morreu — ele fica a um clique, e **reaproveita a resposta já paga** (`c.resposta`
viaja no contexto; não há segunda chamada), levando junto os chips e a caixa de conversa, que no
balão não caberiam. Duas saídas de sempre: **Esc** e clique fora. ⚠️ O Esc do balão usa **captura +
`stopPropagation`** para não fechar junto o modo foco do Estudar, e o `preventDefault` do
`mousedown` só vale enquanto o balão é menu — depois que vira texto, texto precisa poder ser
selecionado e copiado.

**Provado no navegador** (com a IA dublada, sem gastar chamada): as 5 regiões da página devolvendo
frase e procedência certas; o balão abrindo, pintando, cabendo na tela e guardando a resposta; o
"expandir" abrindo o painel com o mesmo texto e a conversa; Esc e clique fora fechando; e o modo
foco sobrevivendo ao Esc do balão.

**Arquivos**: `js/ai.js`, `js/dossie.js`, `js/review.js`, `js/core.js`, `css/styles.css`.
`sw.js` → `englab-v175`.

### O balão é a única casa da Lexa (2026-08-08)

Regra dele, dita para o projeto inteiro:

> *"O painel completo só deveria ser aberto quando a IA analisa o capítulo do livro, onde tem que
> selecionar dezenas de chips e dizer se conheço ou não. Todo o resto onde a Lexa explica deve ser
> no menu suspenso mesmo. **Em todo o projeto deve ser assim.**"*

**A razão é o gesto.** Perguntar durante a leitura é coisa de passagem: você tropeça numa palavra,
quer saber e voltar para onde estava. O painel de tela cheia cobria a página e tirava de vista
**justamente a frase que gerou a pergunta** — sumia o motivo junto com a dúvida. O balão fica por
cima, e o texto continua ali atrás.

O painel foi **removido inteiro**: `lexaPainelAbrir/Fechar/Alternar/ModoAtual`, o ouvinte de Esc, a
preferência `uiPrefs.lexaPainel` e ~60 linhas de CSS. Ficou um objeto flutuante só no app, com um
jeito só de fechar — antes, abrir a explicação podia deixar um menu de seleção órfão atrás dela.

Entrou **`lexaBalaoAbrir({ titulo, frase, fonte, alvo, acoes })`**, com a mesma assinatura de
antes (devolve o CORPO), então os cinco chamadores mudaram só de casa:

| Onde | Ancora em |
|---|---|
| seleção em qualquer texto (`selMenuExplicar`) | o retângulo da seleção |
| família do Estudar (`dossieFamiliaExplicar`) | o botão clicado (por isso ganhou `event`) |
| leitor (`#ler-pop` → Explicar) | o popup de seleção, antes de fechar |
| Preparar (`revSelExplain`) | idem |
| vídeo (`vidExplicar`) | idem — aqui cobrir a tela seria cobrir a **cena** |

**A exceção que ele citou nunca passou por aqui**: a triagem por nível do capítulo é
`#ler-niv-area`, superfície própria dentro do leitor, com as centenas de chips de "conheço / não
conheço". Ficou como estava.

Três detalhes que só aparecem montando:

- **O balão prefere ficar ABAIXO da âncora**; o menu de dois botões prefere acima. O menu não pode
  tapar o que você selecionou; o balão **nasce vazio e cresce** conforme a resposta chega, e
  crescer para baixo a partir de um topo fixo é o único jeito de o texto não escorregar debaixo dos
  olhos enquanto está sendo lido.
- **O reposicionamento é por exceção, não por mudança.** Um `MutationObserver` vigia o balão, mas
  só o recoloca quando ele **sairia da tela** — recolocar a cada mensagem faria o balão pular
  justamente enquanto ele lê ou digita na conversa.
- **A altura é flex, não conta fixa.** A frase é opcional; qualquer `max-height` calculado erraria
  num dos dois casos — espaço branco sem ela, rodapé da conversa cortado com ela.

⚠️ **Selecionar DENTRO da explicação deixou de abrir uma segunda pergunta.** O painel permitia
(era outro elemento); o balão é o próprio `#sel-menu`, e uma seleção nova o substituiria — a
resposta que ele está lendo sumiria no meio da leitura. Os chips das unidades cobrem o caso comum.

**Arquivos**: `js/ai.js`, `js/dossie.js`, `js/ler.js`, `js/review.js`, `js/video-study.js`,
`css/styles.css`. `sw.js` → `englab-v176`.

### A abertura do capítulo fazia as vezes de toda frase (2026-08-08)

O balão suspenso, ao mostrar a frase que ia para a IA, **denunciou um bug antigo** que estava
escondido havia rodadas.

**O que ele viu.** Selecionou **"fancy"** no meio do capítulo e a Lexa respondeu *"fancy não
aparece no trecho enviado"*. Selecionou **"drive"**, que ali era claramente *dirigir*, e ela negou.
E os chips — que deviam ser da frase — listaram *comic book, very much, turn out to be, lobby,
ride, noon, digest-sized, Although*: as unidades da **abertura do capítulo**, não da frase dele.

**A raiz.** `_lerBlocoEmVolta` subia até seis níveis de DOM e ficava com o texto **mais longo** que
encontrasse, cortado em 700 caracteres. Num EPUB o pai do parágrafo é o `<div>` do capítulo — então
o "bloco" virava o capítulo. Daí:

1. `_lerFraseEmVolta` procurava a palavra nesses 700 caracteres;
2. qualquer palavra depois do primeiro parágrafo **não estava ali**;
3. o `if (i < 0)` devolvia `bloco.slice(0, 400)` — **a abertura do capítulo**, sempre a mesma.

Um `if` de fallback silencioso transformando "não achei" em "toma esta outra frase". Reproduzido no
navegador com a estrutura real (`#ler-conteudo > div.capitulo > p`): o código antigo devolveu
`"CHAPTER 11 Billy Summers sits in the hotel lobby, waiting for his ride. It's Friday noon. Filler
paragraph num…"` — sem a palavra dentro. O novo devolve a frase certa.

**A correção.** Subir até o **parágrafo**, não até o maior texto: `closest('p, li, blockquote, h1…,
td, dd, figcaption, pre')`. Sem marcação de parágrafo (EPUB que quebra tudo em `<div>`), sobe um de
cada vez e para no **primeiro** com texto de parágrafo, recusando qualquer ancestral acima de 1200
caracteres — isso é capítulo, não contexto. O alvo também passou a ser normalizado antes do
`indexOf`: uma seleção que atravessa quebra de linha trazia `\n` e falhava pelo mesmo caminho.

**⚠️ O estrago era maior que a explicação.** `_lerDuploClique` chama a MESMA peça — então **toda
palavra capturada no leitor** guardou a abertura do capítulo como `context`, e foi assim para o
card, para os exemplos e para a análise da IA. Ver a pendência sobre o acervo já capturado.

Mesmo defeito, versão leve, corrigido junto no Preparar: `_revSelCtx` pegava o bloco do
`closest(… 'div' …)` e o cortava em 220 caracteres. Agora passa por `_revFraseEmVolta`, que extrai
a frase em volta do termo.

**E o balão encolheu.** *"Ficou imenso, não está como era antes, eu adorava como era antes."* Voltou
a 432px (o antigo `#ler-pop` tinha 420) com teto de 58vh, e o bloco que repetia a frase **saiu**:
*"aparece o texto todo que a IA tá lendo e isso é irrelevante, pode ficar oculto"*. É a lógica do
modo suspenso levada até o fim — a frase está logo ali atrás, na página; repeti-la só empurrava a
resposta para baixo.

**Arquivos**: `js/ler.js`, `js/review.js`, `js/ai.js`, `css/styles.css`. `sw.js` → `englab-v177`.

### Os chips são do que ele marcou (2026-08-08)

Corrigida a frase, sobrou o vazamento: ele marcou **"looks lower middle-class to Billy"** e os
chips trouxeram *two miles*, *downtown*, *enter*, *neighborhood* — palavras da frase que ele **não**
marcou. *"Olha o que eu selecionei e olha o que aparece de chips."*

**A máquina já estava certa.** `quebrarTrecho({ trecho, contexto })` sempre distinguiu os dois, e o
prompt já dizia *"Snippet to break down (ONLY this)"* e *"Surrounding sentence (context to
understand the MEANING only — NEVER take units from it)"*. Havia até o cinto de segurança `dentro()`
para o modelo barato que ignora a regra. **Os quatro chamadores** é que mandavam a FRASE como
`trecho` — e aí não havia o que filtrar: as unidades da frase estavam, por definição, dentro do
"trecho".

Agora os quatro mandam a MARCAÇÃO como `trecho`, e a frase (mais o parágrafo/as falas em volta, no
leitor e no vídeo) como `contexto`.

**Marcação de uma palavra só não gera chips.** Não há o que quebrar: o único chip possível seria a
própria palavra, e a explicação inteira já é sobre ela. Sair antes poupa uma chamada de IA. Quem
quer mandá-la ao Preparar tem o botão no cabeçalho do balão.

⚠️ Isto **reverte de propósito** a decisão registrada na 96ª rodada — *"os chips saem da FRASE do
item, não do pedaço selecionado: quem não entendeu a frase precisa ver de que ela é feita"*. O
argumento era bom no papel; no uso, o que ele quer ver é o que ele apontou. Se um dia fizer falta
ver as unidades da frase inteira, o caminho é marcar a frase inteira.

Provado com `aiJSON` dublado devolvendo as cinco unidades do caso real: as três de fora da marcação
foram descartadas pelo `dentro()`, sobraram *lower middle-class* e *looks*; e "fancy" sozinho não
chegou nem a chamar a IA.

**Arquivos**: `js/ai.js`, `js/ler.js`, `js/review.js`, `js/video-study.js`. `sw.js` → `englab-v178`.

### A forma virou contrato — structured outputs (2026-08-08)

**O DeepSeek saiu.** Decisão dele: *"não trouxe resultados tão efetivos assim"*. Saiu a entrada da
tabela, a chave do `DEF_CFG`, a sincronização no `firebase.js` e — o que mais importa — os
**comentários que se justificavam por ele**, espalhados por `review.js`, `ai.js`, `video-subs.js` e
`video-study.js`. Quem tem `cfg.aiProvider = 'deepseek'` salvo cai sozinho na OpenAI:
`aiProviderAtual()` valida contra a tabela. A chave guardada não é apagada de propósito.

**A Luna virou o padrão.** `AI_DEFAULT_MODEL = 'gpt-5.6-luna'`, e ela subiu para o topo de
`modelos[]` (que é o default de quem nunca escolheu). ⚠️ **Trocar um default não move ninguém** —
`aiModel()` respeita o que está salvo, e `gpt-4o-mini` está salvo em todo aparelho que já abriu
Configurações → IA. Por isso `migrarModeloPadrao()`, que só move quem tem o **padrão antigo**
salvo (isto é, quem nunca escolheu de verdade) e roda **uma vez** — com carimbo, para que voltar
ao gpt-4o-mini de propósito não seja desfeito no boot seguinte.

A ressalva do MRCR (Luna 41,3% de recall em contexto longo) continua registrada no código, mas a
decisão ficou menos arriscada do que era: **com contrato de forma, a parte da regra que mais doía
saiu do prompt**. O que se perde soltando regra agora é julgamento, não estrutura.

#### O contrato

Até aqui a forma da resposta era **pedida em prosa**: cada prompt carrega um molde de JSON, e o
código põe uma rede embaixo — leitores tolerantes, campos opcionais, extração de JSON do meio do
texto. Caro em três moedas: tokens de prompt, leitura defensiva espalhada por seis arquivos, e bug
silencioso quando o campo vem com outro nome (o `curiosidade` que sumiu no "refazer" foi disso).

`json_schema` com `strict: true` inverte: **a API recusa devolver fora do formato.**

`aiJSON(msgs, { schema, schemaNome })`, com escada de três degraus e a repescagem no fim:

| degrau | o que garante | quando |
|---|---|---|
| `schema` | forma exata | há esquema **e** o fornecedor sustenta (`P.json === 'schema'`) |
| `objeto` | JSON válido | sempre disponível |
| `texto` | nada — extrai o JSON de dentro da resposta | último recurso |
| OpenAI | repescagem | fornecedor ativo é outro e há chave |

Os fornecedores ganharam `json:` — `'schema'` na OpenAI, `'objeto'` no Gemini e no Groq (a camada
de compatibilidade do Google aceita `json_schema` de forma irregular conforme o modelo; ficar no
que se sabe garantido é mais barato que descobrir na fatura).

#### As três regras do modo estrito, e o que elas mudaram aqui

1. todo objeto precisa de `additionalProperties: false`;
2. **toda** propriedade precisa estar em `required` — não existe campo opcional. Ausência vira
   presença vazia (`""` ou `[]`). **E isso é bom aqui**: "campo ausente" e "campo vazio" eram dois
   estados com o mesmo significado, e cada leitor tratava de um jeito;
3. validação fina (minLength, format, pattern) não entra — por isso o helper `S` só emite o que o
   modo estrito aceita.

O ganho mais direto é o **enum**: hoje o código recebe `type: "colocação"` em vez de `collocation`
e cai num default mudo (`_RVB_CATS.some(...)`). Sob contrato, a API não deixa.

#### ⚠️ A armadilha, e a rede contra ela

Com `additionalProperties: false`, **um campo que eu esquecer no esquema o modelo fica proibido de
devolver** — e o app perde o dado em silêncio, que é pior do que o problema que fui resolver. Por
isso `_esqConfere(prompt, esquema)`: extrai as chaves do molde JSON que está dentro do próprio
prompt e compara com as do esquema, nos dois sentidos.

Rodado sobre os sete, fatiando o texto real dos prompts: **zero faltando, zero sobrando** —
inclusive na análise, que tem 30 campos em dois níveis.

**Os esquemas descrevem a FORMA, não o conteúdo**, e isso é decisão: os prompts daqui foram
afinados ao longo de dezenas de rodadas, cada campo com instrução, exemplo e contra-exemplo. Mover
esse texto para dentro do esquema seria reescrever o coração do app numa rodada de infraestrutura.
O prompt continua ensinando O QUE escrever; o esquema garante ONDE.

**A rede antiga continua de pé, e não é herança morta.** Os leitores tolerantes de `review.js` valem
para os degraus de baixo — Gemini, Groq, ou a API recusando o esquema. Os comentários foram
reescritos para dizer isso, em vez de citarem um fornecedor que não existe mais.

**Provado no navegador**: corpo da requisição com `json_schema`/`strict:true`/raiz fechada e o enum
do `type` na OpenAI; `json_object` sem esquema; `json_object` no Gemini mesmo passando esquema;
`deepseek` salvo caindo em `openai`; a migração movendo `gpt-4o-mini` → Luna uma vez e não
desfazendo a escolha deliberada; Configurações listando três fornecedores, sem citar DeepSeek.

**Arquivos**: `js/ai.js`, `js/core.js`, `js/firebase.js`, `js/init.js`, `js/review.js`,
`js/dossie.js`, `js/video-study.js`, `js/video-subs.js`, `js/video-sync.js`. `sw.js` → `englab-v179`.

### ESPECIFICAÇÃO — a Lexa que leu o livro, e que vê a web (2026-08-08)

Pedido dele, ainda **não implementado**. Duas capacidades diferentes, que só parecem uma.

**O que falta hoje:** a Lexa vê **um parágrafo** (`_lerBlocoEmVolta`) ou as falas vizinhas
(`video-study.js`). Ela não sabe quem é um personagem, não sabe se a palavra já apareceu antes, e
não sabe o que uma marca é no mundo real.

#### A — Memória da obra (busca local, zero API nova)

O material já é nosso: o `BookDB` tem os capítulos do EPUB, e `_vidCues` tem a trilha inteira do
episódio. Recuperação **sem embeddings** — embedding exigiria uma chamada por trecho e um índice
para guardar; três sinais locais somados resolvem o caso de uso:

1. **Busca por lema** — reusar `glossLemas`, que já resolve flexão ("fell" acha "fall"). É o que faz
   *"já apareceu antes?"* funcionar de verdade, e não só busca literal.
2. **Nomes próprios** — capitalizados fora do começo da frase, indexados por capítulo. Resolve
   *"quem é Nick Majarian?"*.
3. **Proximidade** — o capítulo atual e os anteriores pesam mais.

⚠️ **A regra que só aparece pensando: SPOILER.** A busca **não pode** trazer trecho de capítulo que
ele ainda não leu. Corte duro em `_lerCap` — e isso vale também para a contagem ("aparece 7 vezes"
já entrega que o livro continua). É a diferença entre uma ferramenta de estudo e um estrago.

O índice mora no `BookDB` sob `idxlivro:<id>`, ao lado de `quebra:` e `nivmarca:`, construído na
abertura do livro. Custo de recuperação: **zero**. A chamada de explicação cresce em tokens de
entrada — 2.000 tokens extras na Luna dão ~US$ 0,0004. Desprezível.

- **Fase 1 (barata, alto valor):** bloco *"já apareceu antes"* no balão — contagem nos capítulos
  já lidos e 2-3 trechos. Nenhuma chamada de IA, reusa `glossLemas` + `BookDB`.
- **Fase 2:** índice de entidades, e a conversa passando a receber os trechos recuperados.

#### B — Olhos na web

Duas rotas, e a escolha mudou de peso hoje:

1. **Responses API + `web_search`** (a do print). A IA decide quando buscar. **Custo
   arquitetural:** sai do dialeto `chat/completions`, então vale **só na OpenAI** — o app deixaria
   de trocar de fornecedor nessa função. ⚠️ Esse custo caiu bastante nesta rodada: com o DeepSeek
   fora e a OpenAI de padrão, "trocar de fornecedor" já não é o que era.
2. **Buscar por fora e injetar** — é o que `wikiIlustracao` já faz, de graça.

**Recomendação:** rota 1 no "Explicar", com degradação (fornecedor não-OpenAI cai no caminho atual)
e **interruptor em Configurações**. O gatilho é `tool_choice: 'auto'` — deixar a IA decidir é
literalmente o que a ferramenta faz, e o prompt do `lexaExplicar` já tem o instinto
(*"se for gíria, marca, referência cultural ou nome próprio, diga o que é no mundo real"*).
⚠️ `web_search` é cobrada por chamada: precisa entrar no `_aiGuardarUso` e na estimativa em reais,
senão vira custo invisível — o mesmo erro que o aviso de fallback existe para evitar.

#### Ordem sugerida

1. **Fase 1 da obra** — zero IA, zero risco, prova o valor.
2. **Web search no Explicar** — atrás de interruptor, com o custo à vista.
3. **Fase 2 da obra** — se a 1 provar.

### Onde a captura ainda NÃO leva a semente

Só o leitor foi ligado. Faltam **vídeo/legenda** e **a extensão (Netflix/Kindle)** — e o
caminho é o mesmo: generalizar "pré-análise do capítulo" para **pré-análise do lote**. A
legenda de um episódio é o análogo direto (o app já tem a trilha inteira e já faz chamada em
lote nela, em "Traduzir legenda inteira"); para a extensão, o app glosa **em lote quando as
capturas chegarem** — padrão que o `add.js` já usa no Kindle e na Mídia. A chave fica num
lugar só.

## 9. Pendências / a verificar

- [x] ~~Fonte ancestral: item nascido de exemplo herdava a obra~~ — **corrigido em 2026-08-08**.
      `selMenuAtivar` passa o nó da seleção; `_dosSelContexto` (dossie.js) decide pela REGIÃO da
      página. Varrido e corrigido nos outros dois lugares com o mesmo defeito:
      `dossieFamiliaPreparar` e `revSelExplain`. Ver o topo deste arquivo.
- [x] ~~"Explicar" abria painel em vez do modo suspenso~~ — **corrigido em 2026-08-08**: a resposta
      nasce no próprio balão (`#sel-menu.sel-exp`), com botões de Preparar, expandir e fechar.
- [x] ~~O leitor ainda abre o painel no "Explicar"~~ — **resolvido em 2026-08-08**, e ele fechou a
      questão para o projeto inteiro: o painel foi REMOVIDO e o balão virou a única casa da Lexa
      nas cinco telas. Ver 8.2 ("O balão é a única casa da Lexa").
- [ ] **OS OUTROS 20 `aiJSON` AINDA NÃO TÊM ESQUEMA** (2026-08-08). Sete dos 27 ganharam contrato de
      forma — os de maior valor e forma estável. Faltam os de `add.js` (6), `audio.js` (5),
      `consulta.js`, `ler.js` (2), `study.js`, `video-study.js` e dois de `review.js`. Não é
      urgente: sem esquema o comportamento é exatamente o de antes. **O caminho é conhecido**:
      escrever o `ESQ.*`, passar `{ schema, schemaNome }` e rodar `_esqConfere` contra o trecho do
      prompt — ⚠️ **nunca passar esquema sem conferir**, porque campo esquecido vira campo proibido.
- [ ] **A LEXA QUE LEU O LIVRO E VÊ A WEB** (2026-08-08) — especificação escrita na seção 8.2,
      nada implementado. Ordem sugerida: fase 1 da obra (zero IA), depois web search atrás de
      interruptor, depois fase 2. ⚠️ A regra do **spoiler** é a que não pode ser esquecida.
- [ ] **PROVAR O CONTRATO COM CHAVE DE VERDADE** (2026-08-08). O corpo da requisição foi conferido
      com `_aiFetch` dublado; falta a resposta real da API sob `strict: true` — em especial se a
      Luna sustenta a análise de 30 campos sem estourar o teto de 5000 tokens, já que agora ela é
      obrigada a devolver TODOS os campos (vazios inclusive) em vez de omitir os que não tem.
- [ ] **O ACERVO JÁ CAPTURADO NO LEITOR ESTÁ COM O CONTEXTO ERRADO** (2026-08-08). Enquanto
      `_lerBlocoEmVolta` subia atrás do maior texto, **toda palavra pescada no leitor** guardou a
      abertura do capítulo como `context` — e esse contexto virou o exemplo do card e a base da
      análise da IA. A correção vale só dali para a frente; o que já está salvo continua errado.
      **Como consertar**: os capítulos estão no `BookDB`, então dá para varrer os itens de
      `source_type === 'kindle'`, procurar a palavra no capítulo gravado e reescrever `context` com
      a frase de verdade — item por item, sem IA. Vale um botão em Configurações, perto do
      "devolver tudo para o Preparar". **Sintoma para reconhecer**: vários itens de livros
      diferentes com a MESMA frase de contexto, sempre a primeira do capítulo.
- [ ] **USAR O BALÃO NO LEITOR E NO VÍDEO COM CONTEÚDO DE VERDADE** (2026-08-08). O balão foi
      provado no navegador por dois caminhos (seleção e família), e os cinco chamadores carregam
      sem erro — mas leitor e vídeo pedem livro aberto e episódio tocando, que o ambiente de teste
      não tem. Falta ver: se a ilustração da Wikipédia cabe bem lá dentro, se a conversa tem
      espaço confortável no celular, e se o balão ancorado no popup do vídeo atrapalha a legenda.
- [ ] **`OBRA_ESTUDO` cria um grupo novo no Estudar** (2026-08-08). Itens pescados de exemplos e da
      família passam a se juntar sob a pasta *"Do seu estudo"*, com o item de origem por capítulo.
      É o desenho pretendido (procedência honesta), mas só o uso dirá se essa pasta vira um
      depósito grande demais. Ela é excluída da limpeza de títulos com IA nos dois pontos
      (`resolverNomesDeObra` e `_dosObrasSujasHTML`).
- [x] ~~O Assistente pula o Preparar~~ — **corrigido em 2026-08-08**, a pedido dele, logo depois
      da varredura. Ver 8.2 ("O Assistente também entrou na fila"). **Agora TODA fonte para no
      Preparar**: leitor, Netflix, Kindle, documento, mídia, vídeo, podcast e Assistente.
- [x] ~~Captura repetida no vídeo duplica o item~~ — **corrigido em 2026-08-08**: usa
      `prepAcharItem` + `prepararNovoSentido`, como o leitor. Ver 8.2 ("O reencontro no vídeo").
- [ ] **PROVAR OS CHIPS DA FRASE COM IA DE VERDADE** (2026-08-08). A quebra, os filtros (flexão,
      determinante, tamanho) e o clique foram exercitados com `aiJSON` mockado. Falta ver, com
      chave: **(a)** se a IA respeita *"a unidade tem de sobreviver FORA desta frase"* ou continua
      devolvendo fatia de frase como bloco; **(b)** se ela escreve a unidade na forma que aparece
      no texto ou na de citação (o filtro cobre o segundo caso, mas só no primeiro termo);
      **(c)** o custo real — é uma chamada a mais por explicação.
- [ ] **PROVAR OS CAMPOS NOVOS COM IA DE VERDADE** (2026-08-08). Todo o fluxo das 4 fatias foi
      exercitado com `aiJSON` mockado — o ambiente de teste não tem chave. Falta o que só a chave
      diz: **(a) o tamanho real da resposta** (o teto é 5000 e o comentário no código diz que 2800
      truncava com 2-3 sentidos × 3 exemplos; desde "um sentido por encontro" sobrou orçamento,
      mas 7 campos novos ainda não foram medidos); **(b) se `armadilha` e `curiosidade` respeitam
      o "vazio é resposta válida"** ou viram enchimento — são os dois mais fáceis de um modelo
      barato encher de conversa fiada; **(c) o DeepSeek**, onde o `aiJSON` cai para texto livre e
      cada campo novo é superfície nova para quebrar.
- [ ] **CONTAR NO LIVRO com um EPUB de verdade** (2026-08-08). A leitura do `BookDB`, as flexões e
      o cache foram exercitados, mas o caminho feliz (livro presente) só foi provado pelo erro
      tratado ("o arquivo do livro não está mais neste aparelho"). Testar com *Flags on the Bayou*
      aberto na estante e conferir se a contagem bate com a busca do leitor.
- [ ] **USAR O MODO FOCO COM UM CAPÍTULO DE VERDADE** (2026-08-08). O percurso foi provado no
      navegador com 4 itens semeados: retrato estável, setas sem pular, "Estudei" mandando para a
      revisão, pausa do erro, atalho e volta. Falta o que só o uso diz — se **os três exemplos**
      no foco são leitura boa ou parede, se o rodapé fica à mão no celular, e se a lista compacta
      (dois exemplos) já basta ou também quer os três.
- [ ] **DECIDIR: 3 exemplos = 3 CARDS?** (aberto desde a rodada do "um sentido por encontro").
      Um sentido com 3 exemplos vira **3 cards** no SRS — confirmado de novo neste teste
      (2 sentidos estudados → 6 cards). Com a captura já enxugada para um sentido por encontro,
      talvez o multiplicador que sobra seja este. É **uma linha** na criação do card; o que falta
      é ele decidir se quer um card com 3 exemplos ou 3 cards com um exemplo cada.
- [x] ~~A pausa do erro no celular~~ — **medido e corrigido na mesma rodada** (2026-08-08): em
      375×812 o "Entendi — próximo" nascia em y=815 (fora da tela) e, depois de rolar, ficava
      embaixo da barra fixa de navegação. Resolvido com `scrollIntoView({block:'nearest'})` na
      pausa + `scroll-margin-bottom: 84px` no celular. Medido de novo: botão em 632→728, barra
      começa em 744, e a cena do livro continua inteira na tela.
- [x] ~~Medir a pré-análise com IA de verdade (`barrel` → "cano"?)~~ — **FEITO e PASSOU**
      (confirmado pelo Djemeson em 2026-08-07). ⚠️ **Não refazer este teste.** É o que
      autorizou a glosa da pré-análise a virar semente do sentido (ver 8.2, Fase 1).
- [x] ~~FASE 2 (estado por sentido) e FASE 3 (lema, verbete, reencontro por IA, fundir)~~ —
      **FEITAS em 2026-08-08**. O plano das três fases está inteiro na 8.2.
- [ ] **PROVAR O "O QUE É AQUI?" COM IA DE VERDADE** (Fase 4). O fluxo inteiro foi exercitado
      com a `aiJSON` mockada — o ambiente de teste não tem chave. O teste que vale: marcar
      `cover` como conhecida, achar no livro um `cover for` e conferir (a) se a IA devolve a
      EXPRESSÃO e não a palavra, (b) se a glosa é a da passagem e (c) o custo real da chamada.
      ⚠️ Com DeepSeek o `aiJSON` cai para texto livre — vale ver se `expr`/`tipo` sobrevivem.
      Note que o `mesma` do modelo é ignorado de propósito: quem decide é a comparação dos
      textos, justamente porque booleano volta como `"true"`/`"sim"`/`1` conforme o fornecedor.
- [ ] **O BOTÃO SÓ EXISTE NO GLOSSÁRIO** (Fase 4). Vale no leitor, na legenda do vídeo, no
      Assistente e no Preparar — em toda tela que chama `glossAtivar`. **Não** vale na tela de
      triagem por nível (a do print), onde ele marca as 421 de uma vez: lá não há frase sob o
      cursor, então não há passagem para checar. Se incomodar, o caminho é outro — desmarcar
      pelo grupo, que já existe.
- [ ] **PROVAR O `same_as` COM IA DE VERDADE** (Fase 3). O bloco do reencontro entrou no
      prompt e o merge já prefere o campo, mas nada disso rodou com chave: o ambiente de teste
      não tem. O teste: ter `fall` = "cair", reencontrar `fall` num contexto de "fracassar" e
      conferir (a) que a IA devolve `same_as: null` para o novo e o id certo para o antigo, e
      (b) que o sentido velho **não é duplicado**. ⚠️ Com DeepSeek o `aiJSON` cai para texto
      livre — vale medir se o campo sobrevive; se não, a rede do casamento por texto assume.
- [x] ~~O lema não cobre tudo~~ — **estendido ao máximo em 2026-08-08** (ver 8.2, item 5):
      regra de cabeça inicial/final por tipo + IA devolvendo `lemma` validado. Medido em 30/31
      casos difíceis. O que **sobra** e é limite conhecido, não pendência:
      **(a)** ambiguidade real de forma (`leaves` = *leaf* ou *leave*) — só o contexto resolve,
      e é a IA quem resolve; **(b)** derivação continua **fora de propósito** — `glossLemas`
      exclui `-er`/`-est`/`-ly` porque "teacher" não é "teach" e "hardly" não é "hard"; juntar
      essas famílias reintroduziria a classe de erro das rodadas 163-167.
- [ ] **ZONA DE PERIGO — conferir num aparelho com dado real.** O "apagar tudo" ganhou o que
      faltava (bases `english-lab-books` e `el-video-db` inteiras, as chaves soltas do
      localStorage e recarregamento no fim). Foi exercitado com dado sintético; num aparelho
      com livros e podcasts baixados, vale confirmar que a estante e os episódios somem mesmo
      e que o app volta limpo.
- [ ] **LEVAR A SEMENTE PARA O VÍDEO E PARA A EXTENSÃO** — só o leitor foi ligado. Ver o fim
      da 8.2 para o caminho (pré-análise do LOTE, não do capítulo).
- [ ] **USAR O REENCONTRO COM DADO REAL.** A Fase 1 foi exercitada ao vivo, mas com item
      sintético e pré-análise injetada na mão. Falta o teste de verdade: ler um capítulo com a
      pré-análise ligada, esbarrar numa palavra que você já estuda com outro sentido, e ver
      (a) se o balão acusa, (b) se "Outro sentido" leva ao Preparar com a semente certa e
      (c) se a análise **preserva** o sentido antigo em vez de trocá-lo.

### De quem é o sentido (92ª + 93ª) — o que fechou e o que sobrou

**As seis pendências da 92ª foram fechadas na 93ª** (ver seção 8): fonte única da regra nos 5
prompts, `meaningId` no lugar da posição, as duas camadas da captura, a família na tela, a saída
para os cards já na Revisão e o detector também à esquerda. O que continua aberto:

- [ ] **A FAMÍLIA SÓ APARECE NO PREPARAR.** O dossiê (Estudar) e o glossário da Biblioteca
      mostram o mesmo item sem dizer de onde ele veio. `familiaDoItem` e `irParaItem` são
      genéricos e não-lazy — é só chamar de lá. Ficou fora por serem duas telas com layout
      próprio, não por dificuldade.
- [ ] **A CAPTURA AVISA NO PREPARAR, NÃO NA HORA DO CLIQUE.** O aviso ("a frase contém *fall in
      love*") aparece quando ele abre o item no Preparar — não no balão do leitor/vídeo, onde a
      captura de fato acontece. `unidadeJaEstudada(w)` é de graça e serve igual lá; falta só o
      lugar na UI daquelas telas.
- [ ] **`imageKey` AINDA USA A POSIÇÃO** (`img_wordId_meaningIdx`). Mantido de propósito: trocar
      a chave orfanaria toda imagem já gerada. Se um dia valer, precisa de migração das chaves no
      `ImageDB`, não de uma troca no código.
- [ ] **A COBERTURA DO DETECTOR À ESQUERDA É ESTREITA.** Exige 2+ palavras iguais e falha quando
      o possessivo varia ("make up **your/his** mind" a partir de "mind"). É deliberado — a
      alternativa é falso positivo em série —, mas significa que expressão com encaixe no meio
      continua dependendo do olho dele ou do "Faz parte de uma expressão?".
- [ ] **VARREDURA SÓ RODA NA BASE LOCAL DE `words`.** Item cujo `words[]` foi apagado mas que
      ainda tem cards no SRS (snapshot) não é varrido. Não deve ser comum, mas existe.

### Design / CSS — o que a 91ª rodada deixou aberto de propósito

A revisão de design foi dividida em três rodadas. **As três estão fechadas.**

- [x] ~~**RODADA A — AS ESCADAS**~~ — feita (espaço, camada, breakpoint + o bug do modal
      atravessado pela barra no celular + o código morto da sidebar).
- [x] ~~**RODADA B — FOCO DE TECLADO E ALVO DE TOQUE**~~ — feita. Anel de foco global, os 34
      campos com nome acessível (24 `label for` + 10 `aria-label`, incluindo os gerados por JS
      em 13 arquivos) e 44px no ponteiro grosseiro. Ver seção 8 (91ª rodada, parte B).
- [x] ~~**RODADA C — OS ESTILOS INLINE**~~ — feita, **mas não como estava escrito aqui**. A
      premissa ("390 estilos inline = 390 vazamentos de tema") era FALSA: 236 são só layout, 157
      já usavam `var(--)` e só **6** prendiam cor. O defeito real estava no CSS (51 literais fora
      dos blocos de tema) — inclusive `.stat-card` com borda invisível em 2 dos 6 temas. Ver
      seção 8 (91ª rodada, parte C). **Lição registrada: medir antes de aceitar a própria
      pendência da rodada anterior.**
- [ ] **ESPAÇAMENTO NO RESTO DO ARQUIVO.** Os `--sp-*` foram aplicados na faixa compartilhada e
      na camada de reskin (113 usos). O CSS específico de cada seção (vídeo, leitor, dossiê,
      assistente) ainda usa literais. Não é urgente e **não deve ser feito em varredura cega**:
      parte daquelas medidas é calibrada no olho e perde ao ser arredondada.
- [ ] **DUAS REGRAS `@media (hover:none)` separadas** (uma esconde `.ler-seta`, a outra também).
      Sobreposição inofensiva, mas são o mesmo caso — vale unir quando alguém passar por ali.
- [ ] **`.btn-sm` ficou em 40px no toque, não 44px** (rodada B). Foi decisão consciente: ele vive
      em fileiras densas (ações do dossiê, linha do card, rodapé de lista) e 44px ali quebraria a
      linha em duas. No dia em que essas fileiras virarem coluna no celular, sobe para 44 e o app
      passa a cumprir o alvo de toque em todo botão.
- [ ] **MOVIMENTO E CONTRASTE ainda não têm tratamento completo** (achado na rodada B, deixado
      fora de propósito). Há só **duas** regras `prefers-reduced-motion` para um app cheio de
      transição e animação, e **zero** `prefers-contrast`. Não é urgente, mas é o mesmo tipo de
      lacuna que o foco de teclado era: invisível para quem não precisa, bloqueante para quem
      precisa.
- [ ] **O anel de foco pode ser cortado por ancestral com `overflow:hidden`** (ex.: `.card-box`).
      O outline não é cortado pelo overflow do PRÓPRIO elemento, mas é pelo do pai. Não foi visto
      acontecendo; se aparecer, a saída é `outline-offset` negativo naquele componente específico
      — não mexer na regra global.

- [x] ~~Ligar a seção dos dossiês, renomear as seções e decidir o portão~~ — **feito na 90ª
      rodada** (2026-08-07). Ver 8.1: está tudo lá, inclusive por que os arquivos NÃO foram
      renomeados.
- [ ] **O DOSSIÊ AINDA NÃO MOSTRA ÁUDIO NEM IMAGEM** (90ª rodada). O material tem os dois
      (`AudioDB`, `ImageDB`) e a tela só mostra texto. É a diferença entre ler o material e
      *estudar* o material. Ficou de fora por ser decisão de layout própria — um botão de ouvir
      por exemplo, e a ilustração do sentido no cabeçalho do item.
- [ ] **USAR O FLUXO NOVO COM DADO REAL** (90ª rodada). Tudo foi exercitado ao vivo, mas com 5
      itens sintéticos. Com a base de verdade, conferir três coisas: (a) a **costura do legado**
      (`_dossieCosturarLegado`) marcou como estudado exatamente o que já está no SRS — abrir a
      seção e ver se algum dossiê antigo aparece com pendência que não existe; (b) a grade não
      fica gigante demais (um livro com 40 capítulos = 40 cartões — se incomodar, agrupar por
      obra e abrir os capítulos dentro); (c) a busca continua instantânea com centenas de itens
      (`_dosItemTexto` remonta o texto a cada tecla; se pesar, cachear por `id`+`updated_at`).
- [ ] **ENVIAR OS 97 ITENS QUE JÁ ESTÃO PRONTOS** (90ª rodada). Com o status `in_study`, os
      itens antigos em `pending_review` continuam **no Preparar esperando envio** — é o certo,
      mas são muitos de uma vez. Se for chato item a item, use "Selecionar todas" + "Enviar
      para o Estudo" (o lote já funciona); e se ainda assim incomodar, vale um "enviar todos
      os prontos deste capítulo" na própria barra.
- [ ] **`saveAllToSrs()` é CÓDIGO MORTO** (achado na 90ª): a função existe em `review.js` (~402)
      e procura o botão `btn-save-all-srs`, que não existe mais no HTML. Não foi removida nesta
      rodada por ser anterior a ela e não atrapalhar; ao mexer no Preparar, apagar.
- [ ] **RENOMEAR OS ARQUIVOS `review.js`/`study.js`** — decidido NÃO fazer na 90ª. Só vale se um
      dia o custo de lembrar "review.js é Preparar" superar o de perder o histórico do git e
      mexer na lista do service worker. Registrado para não virar dúvida recorrente.

- [x] ~~GLOSSÁRIO CAMADA 1 — dicionário bilíngue embarcado~~ — **medido e RECUSADO** na 83ª
      rodada. Cabia (0,26 MB comprimido) e cobria 91,5% do texto, mas erra `barrel`, `bore` e
      `yank` e não tem `animus` nem `tire`. Substituído pela **pré-análise do capítulo**.
      ⚠️ **Não refazer este estudo** — os números, as fontes e o porquê estão no item 176.
- [ ] **ENDURECER OS DOIS LOTES DO `add.js` CONTRA RENUMERAÇÃO** (risco achado na varredura da
      83ª, NÃO é bug observado). Os prompts do lote do Kindle (`add.js` ~481) e da Mídia (~815)
      pedem `{"i":<n>}` e casam pelo VALOR do índice, então **item pulado não desloca nada** —
      diferente do bug da pré-análise. O risco que sobra é o modelo **renumerar de 1**: aí
      `find(x => Number(x.i) === i)` casaria conteúdo com a linha errada. Hoje isso é improvável
      porque o lote do Kindle imprime índices ABSOLUTOS (ex.: "47.", não "1."), que desencorajam
      a renumeração. A blindagem definitiva é a mesma da pré-análise: **pedir o texto de volta e
      casar por ele**. Não foi feito nesta rodada porque mexe em dois fluxos que funcionam.
- [ ] **USAR A PRÉ-ANÁLISE COM A IA DE VERDADE** (83ª rodada). Toda a camada 1 foi validada com
      dados sintéticos — o ambiente de teste não tem chave. Falta rodar "Ler este capítulo com
      a IA" num capítulo real e conferir: (a) se o custo cobrado bate com o estimado no modal;
      (b) se a glosa de `barrel` naquela frase sai **cano** e não "barril" — é o teste que
      justifica a rodada inteira; (c) quantos itens a IA deixa de devolver (o toast já conta os
      perdidos). ⚠️ Com DeepSeek o `aiJSON` cai para texto livre: vale medir a perda com ele.
- [ ] **PRÉ-ANÁLISE DO LIVRO INTEIRO, não só do capítulo.** Hoje é um capítulo por vez, e num
      livro de 40 capítulos isso vira 40 confirmações. Só vale depois de saber o custo REAL de
      um capítulo (pendência acima); com o número na mão dá para oferecer "ler os próximos 5"
      com o total na frente.
- [ ] **GLOSSÁRIO na legenda do vídeo** (`video-subs.js`). Leitor, Revisar e Assistente já
      chamam `glossAtivar`; a legenda ficou de fora porque ela se re-renderiza a cada segundo e
      precisa de um ponto de ligação estável — do contrário vira listener novo por quadro.
- [ ] **Wiktionary como último recurso NO CLIQUE** (nunca no hover). Aquele ~1 s é inaceitável
      passando o mouse e perfeitamente aceitável clicando: seria o "não achei no seu material"
      para palavra que ainda não é card. Inglês→inglês, então é apoio, não tradução.
- [ ] **ENCOLHER O PAINEL DE CONTROLES DA NETFLIX** (tentado e REMOVIDO na 101ª). É o que o
      Language Reactor faz para a legenda poder descer mais: com ele ativo a barra de progresso
      fica a ~87px do chão, sem ele a ~110px. Tentei `[data-uia="controls-standard"]`,
      `.watch-video--bottom-controls-container` e `.PlayerControlsNeo__*` — **nenhum casou**, a
      regra não fazia nada, e código morto fingindo que funciona é pior que ausência. Para
      refazer é preciso o **nome real da classe do container**, pego no inspetor da página
      (F12 → selecionar a área dos controles). Sem isso é chute.
- [ ] **TIRAR OS PREÇOS DE TRANSCRIÇÃO DO HTML** (achado na 90ª). O seletor `cfg-stt-provider`
      tem "whisper-large-v3-turbo (US$ 0,04/h)" e "whisper-1 (US$ 0,36/h)" **escritos à mão** no
      `index.html`. Hoje estão certos, mas é exatamente o padrão que fez o seletor de imagens
      continuar anunciando `gpt-image-1` depois da troca. O conserto é o mesmo: um catálogo
      (como `AI_IMG`) e um `updateSttProviderOptions()` que monta a partir dele.
- [ ] **MEDIR O `gpt-image-1-mini`** (90ª rodada). A saída dele é US$ 8/1M — 5× abaixo do
      gpt-image-1 e 3,75× abaixo do image-2 — e ele pode ser o mais barato do catálogo para
      ilustrar card. Mas a OpenAI **não publica a tabela por imagem** dele, então cotar seria
      chute. O jeito é gerar uma imagem e ler o `usage` real (o app já mede desde a 85ª
      rodada). Só depois disso vale considerar a troca.
- [ ] **AVALIAR A QUALIDADE DO `low` NO gpt-image-2** (90ª rodada). Ele emite ~200 tokens
      contra 272 do image-1 na mesma faixa: é 45% mais barato, mas em parte por ser mais leve.
      Se a ilustração ficar pobre, subir para `medium` — não voltar ao image-1.
- [ ] **CONFERIR O IMAGEN 4 EM 17/AGO/2026** — não é para adotar, é para não ser pego: se
      alguma parte do projeto passar a citar `imagen-4.0-*`, ela quebra nessa data. Hoje o
      projeto **não usa** nenhum Imagen (só a família Nano Banana), então é só vigilância.
- [ ] **GERAR UM LOTE COM O NANO BANANA 2 LITE** (81ª rodada). O modelo `gemini-3.1-flash-lite-image`
      nunca foi chamado de verdade daqui — a troca foi validada só no catálogo e no
      `aiImgNivel()`. Falta a prova de fogo: gerar imagens e confirmar (a) que ele responde numa
      das duas rotas (`:generateContent` ou `/interactions`) e (b) que a linha
      `[img] … via <rota> — US$ 0.0336` sai no console. Se ele só existir numa das rotas, a
      outra devolve 404/400 e a queda automática já cobre — mas convém saber qual é.
- [ ] **NARRAÇÃO DIRIGIDA COM `gemini-3.1-flash-tts-preview`** (ideia da 81ª, NÃO é troca de
      fornecedor). O TTS do Gemini não compensa por preço (avaliado e recusado), mas o 3.1 tem
      *expressive audio tags* — dá para pedir "leia devagar", "enfatize a palavra-alvo",
      "separe as sílabas". Isso é ganho **pedagógico**, não econômico: seria um botão extra no
      card ("ouvir devagar / com ênfase"), convivendo com o `gpt-4o-mini-tts` atual, não
      substituindo. Custa 2× por minuto e o modelo é *Preview* — só vale se o uso for pontual.
- [ ] **Gemini 3.5 Live Translate — anotado, sem plano** (81ª). Tradução fala→fala em tempo
      real, 70+ idiomas, US$ 3,50 in / 21,00 out. Abriria "conversar e ser entendido na hora",
      mas é **Live API por WebSocket** (nada parecido com o que o app faz hoje), preço de outra
      ordem de grandeza e status *Preview*. Registrado para não se perder; não priorizado.
- [ ] **DESCOBRIR POR QUE O DEEPSEEK NÃO RESPONDE** (170ª rodada). No teste de 06/08, as 4
      chamadas JSON dele caíram no fallback da OpenAI. Agora o motivo aparece no console e um
      toast avisa. Rodar de novo e ler a mensagem: se for `model not found`, o ID
      `deepseek-v4-flash` mudou; se for 401/402, é chave ou saldo; se for "resposta vazia ou
      fora do formato", é o modelo devolvendo texto não-JSON e aí o caminho é o de sempre
      (prompt mais explícito ou parser mais tolerante).
- [ ] **Firebase bloqueado por extensão do navegador** (visto na 170ª): `ERR_BLOCKED_BY_CLIENT`
      em `firestore.googleapis.com`. A sincronização está falhando em silêncio nesse navegador
      — vale liberar o domínio no bloqueador, ou o app passar a avisar quando o sync falhar
      por bloqueio (hoje ele só marca o ponto como erro, sem dizer por quê).
- [x] ~~REFAZER OS DOIS CASOS DA 163ª RODADA~~ — **feito em 06/08 e PASSOU** nos modelos da
      OpenAI (ver 170ª rodada). Falta só refazer com o DeepSeek de fato respondendo.

- [ ] **(histórico) REFAZER OS DOIS CASOS DA 163ª RODADA COM O DEEPSEEK.** As correções são de PROMPT e não
      puderam ser testadas (o ambiente de teste não tem chave de IA). Repetir exatamente:
      (a) mandar `"we began to tire of the mud"` para o Revisar e conferir se a glosa de
      "tire of" agora é "cansar-se de" e se "the mud" sumiu das colocações;
      (b) analisar `does` com o contexto `"The boat ride does add time to the trip"` e conferir
      se o primeiro significado é o auxiliar enfático ("de fato, realmente") com exemplos de
      ênfase — e não "fazer, executar" com "she does the laundry".
      Se o DeepSeek ainda escorregar, o próximo passo é o mesmo da 49ª rodada: rede de segurança
      no código (validar a resposta e repetir na OpenAI só nesse item).
      ⚠️ **Use "Refazer do zero", não "Re-analisar"** — o "Re-analisar" preserva o que já tem
      exemplos, então devolveria o mesmo erro (foi exatamente o que aconteceu na 164ª rodada).
      Terceiro caso a refazer: `"a bayonet mounted on the tip of its barrel"` → o significado
      tem de ser **"ponta do cano"** (fuzil), nunca "barril".

### LER — buracos conhecidos (79ª rodada)

- [ ] **Nenhum EPUB comercial de verdade passou por aqui.** O parser foi validado com fixtures
      fiéis (EPUB 3 com `nav`, EPUB 2 com `.ncx`, subpasta, entrada STORED, capa, acentuação,
      capítulo de 4 mil palavras) e a leitura foi exercitada ao vivo no navegador — mas um livro
      real tem 300 arquivos, CSS complicado e notas de rodapé. **Primeiro teste a fazer**: um
      `.epub` do Standard Ebooks (bem diagramado) e um da sua estante.
- [ ] **EPUB com DRM não abre e não vai abrir.** Livro comprado na Amazon/Kobo com proteção é
      um arquivo cifrado; o leitor mostra erro de formato. Isso não é bug — é o desenho.
- [ ] **PDF não é suportado.** Precisaria do pdf.js (~1 MB) e o texto de PDF vem sem estrutura
      (quebra de linha por posição, não por parágrafo), o que estragaria a captura de frase.
      Se for necessário, o caminho barato é converter para EPUB antes.
- [x] ~~Celular: falta o gesto de virar a página.~~ **Feito na mesma rodada**: arrastar, tocar
      nas bordas, modo imersivo, folhas de baixo e toque longo para selecionar. Falta só
      **provar num aparelho de verdade** — os gestos foram validados com toques sintéticos a
      375×812, não com um dedo real (inércia, latência e o menu nativo de seleção do Android
      podem pedir ajuste fino).
- [ ] **Pintura em capítulo gigante não foi medida.** `_lerRepintar()` percorre todos os nós de
      texto do capítulo; testado com 4 mil palavras (instantâneo), não com 20 mil.
- [ ] **Capa**: a extração foi exercitada, mas com PNG inválido de propósito na fixture (o
      caminho de erro devolve `''` corretamente). Falta ver uma capa real virando miniatura.

- [ ] **Ilustração da Wikipédia ainda não está no vídeo nem no Assistente** (79ª rodada, item
      158). A função é a mesma (`wikiIlustracao` + `wikiFiguraHTML`, em `js/ai.js`, não-lazy) —
      falta só chamar no `video-study.js` e na resposta do chat. Ficou de fora porque cada tela
      tem markup próprio de popup e cada uma precisa de teste próprio.
- [ ] **Imagem para palavra ABSTRATA continua sem resposta.** O portão da Wikipédia
      (deliberadamente) não devolve nada para "seethed", "faltered", "grand experience". Os dois
      caminhos possíveis: (a) buscador de imagens com chave (Google CSE/Bing) — resultado real,
      mas exige chave e tem custo; (b) **gerar** a imagem com a IA, que o app JÁ faz nos cards
      (`buildImageScene`, 11ª rodada) — funciona para qualquer palavra, mas custa
      US$ 0,01–0,04 por imagem, então teria de ser sob clique, nunca automático.

### LER — o que o módulo torna possível (roteiro, em ordem de valor/esforço)

> Escrito na 79ª rodada a pedido do Djemeson ("analise, estude e planeje ferramentas novas que
> são viáveis com esse novo módulo"). Nada aqui foi implementado ainda.

**Barato e de alto valor — próxima rodada natural:**

1. **Pré-leitura do capítulo.** Antes de abrir o capítulo, estudar as 10–15 palavras novas mais
    frequentes DELE. É o "Preparar para assistir" do módulo Vídeo aplicado ao livro, e a
    matemática já está pronta (`lerAnalisar`). Muda a experiência de "travo a cada parágrafo"
    para "leio corrido". **Provavelmente o item de maior impacto da lista.**
2. **Cobertura na estante.** Calcular a cobertura de cada livro e mostrá-la na capa: "97% —
    leitura fluida", "89% — vai doer". Escolher o livro certo é metade da leitura extensiva.
    **Ficou mais valioso depois da triagem (item 161)**: agora o `knownWords` cresce de verdade,
    então o número na capa passa a significar alguma coisa. Cuidado de projeto: NÃO congelar o
    valor na importação — ele muda toda vez que você triar um capítulo. Calcular sob demanda
    (ou recalcular quando a estante abrir) e guardar com carimbo de quando foi medido.
3. **Ler ouvindo.** A voz do navegador já está ligada na seleção; falta o modo contínuo com a
    frase atual destacada e avanço automático de página. Custo zero de API.
4. **Retomar com resumo.** "Faz 6 dias que você parou" → a IA resume em 3 linhas o que
    aconteceu até ali (usando o texto dos capítulos lidos). Uma chamada barata, resolve o
    atrito real de abandonar livro por ter perdido o fio.
5. **Leitura no Dashboard.** `livro.minutos` e palavras lidas já são gravados; falta plotar no
    heatmap e virar sequência (streak) — o app já tem a máquina de streak.
6. **Página de destaques do livro.** Tudo que você capturou naquele livro numa tela só
    (`livro.notes` já guarda palavra, frase, capítulo e o id do card), com exportação.

**Médio — precisa de investigação antes:**

7. **Catálogo embutido (Project Gutenberg / Standard Ebooks).** Buscar e baixar sem sair do
    app. A API `gutendex.com` tem CORS liberado para METADADOS; falta confirmar se o download
    do `.epub` também tem, senão precisaria de uma função serverless (a Vercel já hospeda o
    app). 70 mil livros de domínio público em inglês, de graça, é acervo de sobra.
8. **Modo bilíngue por parágrafo.** Tradução da IA sob demanda, com a mesma névoa borrada do
    módulo Vídeo (32ª rodada) — revela ao passar o mouse. O prompt anti-literal já existe.
9. **Cloze a partir do livro.** Transformar a frase capturada num card de lacuna ("He ____ with
    a rage he could not name"). O SRS já aceita variações de card; é mais desenho do que código.
10. **Meta de leitura extensiva.** Minutos ou páginas por dia, com o streak existente. Combina
    com o item 5.

**Ambicioso — só se virar prioridade:**

11. **Livro + audiobook sincronizados.** O app já tem Whisper (Groq, barato) para transcrever;
    alinhar a transcrição ao texto do livro daria leitura acompanhada de narração real, que é o
    exercício de *listening* mais poderoso que existe. Complexo: alinhamento forçado de horas
    de áudio contra centenas de milhares de palavras.
12. **Nível automático do livro (CEFR).** Estimar a faixa pelo perfil de frequência do
    vocabulário e comparar com o SEU perfil. Vale como número na estante, mas exige uma lista
    de frequência de referência embutida (~5 mil palavras).

- [ ] **KINDLE — rodar com o `vocab.db` REAL do aparelho** (77ª rodada). O leitor de SQLite foi
      validado com fixtures fiéis ao esquema (WORDS/LOOKUPS/BOOK_INFO, 4096 e 512 bytes/página,
      UTF-8 e UTF-16, overflow de 6,7 KB) e a importação foi exercitada no navegador de ponta a
      ponta — mas **nenhum arquivo saído de um Kindle de verdade passou por aqui ainda**.
      Ao ligar o cabo, conferir três coisas: (a) o Windows 11 monta o Kindle como **MTP**, não
      como unidade — se o seletor de arquivos não abrir a pasta `system`, copie o `vocab.db`
      para a Área de Trabalho antes; (b) `system` é **pasta oculta**; (c) o `stem` do Kindle é
      mesmo o lema esperado (se vier flexionado demais, trocar para `word`).
- [ ] **KINDLE — testar a extensão em `read.amazon.com` com um livro aberto** (77ª rodada). A
      lógica pura (recorte da frase, título, fila, dedupe, desfazer) está coberta por teste
      automatizado, mas os **seletores do leitor da Amazon** não foram vistos ao vivo. Se o
      contexto vier estranho, o ponto a ajustar é `blocoDaSelecao()` em `extension/kindle.js`.
      Verificar também se a pílula não briga com o dicionário nativo da Amazon.
- [ ] **KINDLE — documento pessoal no aparelho não entra pelo `vocab.db`** (limite da Amazon,
      não nosso). O caminho é destacar a palavra com o dedo → `My Clippings.txt`. Se isso virar
      atrito no uso diário, a alternativa é ler o documento pelo `read.amazon.com` (Enviar para
      Kindle) e usar o modo **auto** da extensão.
- [ ] **Backup JSON ainda não leva `knownWords`/`ignoredWords`** (visto na 77ª rodada ao incluir
      o histórico do Kindle no Exportar/Importar). Quem restaurar um backup perde a triagem de
      "palavras que já conheço". Não entrou nesta rodada por precisar de decisão de merge
      própria (união? substituição? o que fazer com palavra que virou card depois?).

- [ ] **PODCAST — rodar um episódio de verdade de ponta a ponta** (76ª rodada): busque um
      programa, importe um episódio e rode **"Criar legenda com IA"** com a chave da **Groq**
      (episódio de 1h ≈ R$ 0,15 na Groq contra ~R$ 1,35 na OpenAI). Depois conferir: a legenda
      nasce sincronizada? A régua de falas acompanha? O card com o áudio real sai com a voz do
      apresentador? (A gravação de áudio já foi validada tecnicamente — 19 KB reais capturados
      do mp3 — mas nenhum card de podcast foi criado ainda de verdade.)
- [x] **PODCAST — espaço em disco** — feito na 78ª rodada: Configurações → Dados locais mostra
      "Espaço usado neste aparelho" (episódios baixados, áudio consertado e o total do navegador
      via `navigator.storage.estimate()`), com botões para liberar cada grupo.
- [ ] **PODCAST — programa com transcrição publicada**: o caminho `<podcast:transcript>` foi
      validado com feed sintético (VTT preferido ao JSON, JSON palavra-a-palavra virando falas),
      mas **nenhum feed real com transcrição foi testado**. Ao achar um, conferir a sincronia.
- [x] **PODCAST — "Seus podcasts" sincroniza** — feito na 78ª rodada: o estado saiu do lazy
      `video-podcast.js` e virou `podShows` em `core.js`, com doc próprio (`data/podShows`) no
      Firestore, adoção da nuvem (exclusão propaga) e entrada no Exportar/Importar JSON.
- [ ] **PODCAST — testar o sync de programas em 2 aparelhos**: adicionar um programa num,
      conferir que aparece no outro, e **tirar** num e conferir que some no outro (a adoção da
      nuvem propaga exclusão). Backup — Exportar JSON — antes.

- [x] **Estudar transbordava a tela no celular** — corrigido em 2026-08-01 (16ª rodada, item 67).

- [ ] **Olhar a sidebar nova com dados reais** (7ª rodada, 2026-07-31): o bloco "Hoje" foi
      validado com `srsLog` sintético (12 feitas / 183 restantes / 5 dias). Com uso real,
      conferir se a proporção da barra faz sentido durante uma sessão (o número de "feitas"
      conta cada nota dada, inclusive repetições das etapas de aprendizagem — então pode passar
      do que parecia o total do dia) e se "Dia concluído" aparece na hora certa.

- [x] **Publicado no GitHub** em 2026-07-30 (`main` = `5e4a32f`, Actions verde, service worker
      confirmado ao vivo em `/english-lab/` com o cache `englab-v5` e 14 arquivos).
- [x] **Repositório importado na Vercel** em 2026-07-30 → `https://english-lab-seven.vercel.app/`.
      Verificado ao vivo: 0 erros de console, service worker registrado no escopo `/` com o
      cache `englab-v5` e 14 arquivos, `manifest.webmanifest` servido como
      `application/manifest+json`, `sw.js` com `must-revalidate`, as 7 telas navegando e
      servido como **estático** (`server: Vercel`, sem função Node). Os caminhos relativos do
      SW provaram seu valor: o mesmo código funciona em `/english-lab/` no Pages e em `/` na
      Vercel, sem condicional.
- [x] **`english-lab-seven.vercel.app` autorizado no Firebase** (2026-07-30, feito pelo
      Djemeson) — login Google e sync funcionam na Vercel. Na mesma passada ele removeu as
      três sobras do Google AI Studio (`aistudio.google.com`, `ais-dev-…`, `ais-pre-…`), que
      davam a páginas de terceiros a capacidade de iniciar o login do projeto.
      Lista atual: `localhost`, `english-lab-726e7.firebaseapp.com`,
      `english-lab-726e7.web.app`, `djemeson.github.io`, `english-lab-seven.vercel.app`.
      ⚠️ `*.vercel.app` não funciona como curinga: cada **preview deploy** tem URL própria e
      **não autentica**. Para estudar de verdade, sempre a URL de produção.
- [ ] **Hard-refresh + backup depois de abrir a versão nova** (Exportar JSON antes): o service
      worker mudou de `englab-v4` para `englab-v5`.
- [ ] **Testar o player "Ouvir playlist" com áudio real** (a validação desta sessão usou TTS
      falso para provar que pular durante a fala não pula card): abrir a Biblioteca, tocar nos
      3 modos (Completo / Desafio / Só o idioma), pular e voltar durante a fala, e conferir que
      a tradução em PT sai no modo Desafio só depois da pausa de recall.
- [ ] **Conferir o app instalado como PWA** (manifest + `icon.svg` novos): "Adicionar à tela de
      início" no celular, ver o ícone e se abre em `standalone` sem a barra do navegador.
- [ ] **Confirmar o service worker no GitHub Pages** depois do deploy (era o erro que o impedia
      de instalar em `/english-lab/`): DevTools → Application → Service Workers deve mostrar
      escopo `https://djemeson.github.io/english-lab/` e o cache `englab-v5` com 14 entradas.
- [x] **Chips de variedade/registro** — feito na 2ª rodada de 2026-07-30 (item 44): emoji
      removido, movidos para `js/lang.js` (não-lazy), cor pelas variáveis do tema e contraste
      WCAG AA nos 6 temas. A interface está **100% sem emoji** agora.
- [ ] **Conferir visualmente o novo Dashboard ao vivo** (após deploy + hard-refresh; a
      validação desta sessão foi só por `getComputedStyle`/dados sintéticos, sem screenshot):
      com dados reais de uso, olhar o heatmap (cores fazem sentido com o histórico real de
      `srsLog`?), a tendência de acerto, o card de "travando na memória" (só aparece se
      houver leech de verdade), a palavra em destaque (troca a cada dia?) e o card de
      conquistas nos 6 temas — inclusive em mobile (grade 2 colunas deve virar 1 coluna,
      badges 6→3→2 por linha).
- [x] **Bug de pluralização "0 revisãoões"** no hero do Dashboard — corrigido em 2026-07-14
      (confirmado no código em 2026-07-30: `js/dashboard.js` usa duas strings completas).
- [ ] (Opcional) Avaliar implementar os outros mockups do mesmo projeto Claude Design
      ("Redesign da aba"): `Adicionar - Mídia.dc.html`, `Canvas.dc.html`, `Estudar.dc.html`
      e `Gamificação.dc.html` (este último provavelmente cobre um sistema de conquistas mais
      rico que os 6 marcos simples do Dashboard).
- [ ] **Testar o MULTI-IDIOMA ao vivo** (após deploy + hard-refresh; backup — Exportar JSON —
      antes): (1) trocar o seletor p/ Espanhol no Adicionar, adicionar "echar de menos" e
      analisar — conferir type=phrasal_verb c/ type_label "perífrase verbal", IPA, variedades
      es no dropdown do card e deck "Espanhol" criado; (2) auto-detecção: com seletor em Inglês,
      adicionar "se débrouiller" com frase de contexto em francês → deve avisar "Idioma
      detectado: Francês" e ir p/ o deck certo; (3) Assistente: trocar o idioma na barra do chat
      e conferir sugestões + resposta como tutor do idioma + termos extraídos no idioma;
      (4) TTS de uma frase em espanhol/alemão (tts-1 é multilíngue); (5) conferir chip de idioma
      nos cards não-ingleses e o glossário.
- [x] ~~Ajustar o workflow do n8n~~ — a integração inteira foi removida em 2026-07-30.
- [x] Nome exibido do app trocado para "Language Lab" (sessão 2026-07-13) — infra
      (repo/URL/Firebase) continua `english-lab` como já era a decisão.
- [x] Filtro por idioma no glossário da Biblioteca — feito em 2026-07-30 (item 45).
- [ ] **Testar a precisão do negrito ao vivo** (sessão 2026-07-13, 2ª rodada — fazer backup/
      Exportar JSON antes do passo 2, que reescreve frases): (1) analisar uma palavra nova em
      Revisar/Assistente e conferir negrito nos dois lados; (2) rodar "Negrito perfeito (IA)"
      na Biblioteca — deve pegar mais cards que antes (agora detecta negrito malformado, não só
      ausente); (3) importar um documento na Mídia e, se algum lote da Fase 2 falhar, conferir
      se a semente da Fase 1 ainda saiu com negrito no inglês.
- [ ] **Conferir visualmente o reskin "Papel" ao vivo** (após deploy + hard-refresh): a
      ferramenta de screenshot não funcionou nesta sessão, então a validação foi só por
      `getComputedStyle`/DOM — olhar as 7 telas nos 6 temas (principalmente o hero card do
      Dashboard com dados reais/`paraHoje > 0`, a flashcard de Estudar com a palavra maior em
      Newsreader, e o tema `papel` novo) e ajustar valores a olho se algo parecer errado
      (radius/sombra/contraste). Conferir também em mobile (o `.srs-card-front-word` maior pode
      cortar em telas estreitas — ver checklist de risco do plano desta sessão).
- [ ] **Testar ao vivo as melhorias da 5ª rodada** (após o deploy GitHub Pages + hard-refresh):
      (1) abrir Biblioteca → alternar **Cards/Palavras**, conferir o glossário e a busca; (2) num card
      de palavra com 2+ sentidos, ver o chip **"sentido X de Y"** e clicar (deve abrir o glossário no
      termo); (3) rodar **"Negrito perfeito (IA)"** e conferir o `<b>` no inglês e no português (cards
      antigos); (4) criar/analisar uma palavra nova e confirmar que o PT já vem em negrito. Backup
      (Exportar JSON) antes do passo 3, pois ele reescreve as frases dos cards.
- [ ] **Testar o Assistente ao vivo** (fazer backup — Exportar JSON — antes, pois o sync mudou):
      perguntar algo, ver o streaming, conferir os botões "Adicionar"/"Adicionar todos" e o
      "já no estudo"; recarregar e confirmar que a conversa persiste; checar o doc `data/conversas`
      no Firebase. Testar uma pergunta com vários termos (ex.: "diferença entre speak e talk") e
      confirmar que aparecem dois botões.
- [ ] **Testar o sync em tempo real em 2 dispositivos** (abrir em duas abas/navegadores e
      confirmar propagação e exclusão). Fazer backup (Exportar JSON) antes.
- [ ] Depois de a versão de sync estar no ar, rodar **"Limpar tudo"** uma vez para zerar a
      nuvem (que ainda guarda dados antigos), se o objetivo for recomeçar.
- [x] Emojis residuais trocados por ícones `ic()` em 2026-07-30 (tela de fim de sessão, toasts,
      botões de Kindle/Mídia/Website, banner de áudio, avisos). Sobra só o mapa de chips de
      variedade/registro em `study.js` — ver item opcional acima.
- [ ] (Opcional) varredura final para mover qualquer símbolo restante de arquivos lazy
      usado fora deles.
- [ ] **Testar ao vivo a importação de documento** (subir o `survivor-vocabulario-ingles.md`):
      confirmar que extrai os termos, que "snuff" sai como "apagar a tocha" e que os cards entram
      em "pendente de revisão" já com significado/exemplo. Fazer backup (Exportar JSON) antes.
- [ ] **Testar PDF** (pdf.js do CDN) — precisa de internet na primeira leitura; depois cacheia.
- [ ] **REMOVER o botão temporário "Completar dados (IA)"** (`#lib-fill-origin-btn` no index.html +
      função `fillMissingAll` em audio.js — sucessora do antigo "Preencher origem"/`fillOriginsAll`)
      depois de rodar o backfill de IPA/categoria/nível/origem nos cards antigos.
- [ ] **Testar ao vivo a preservação de exemplos curados** (após deploy + hard-refresh; backup —
      Exportar JSON — antes): (1) com a leva `A1.1-leva-01.md` já importada em Revisar, clicar
      "Re-analisar" numa palavra (ex.: "hablar") e conferir que as frases/significado curados NÃO
      mudam, só campos vazios (origem etc.) são completados; (2) na Biblioteca, rodar "Completar
      dados (IA)" e conferir que só preenche o que faltava, sem tocar em frases nem no agendamento.
- [ ] (Opcional) Enriquecimento em lote dos itens importados: hoje cada item vem com 1 sentido +
      3 exemplos (3 cards) do doc; o botão "Re-analisar" (já sensível à fonte) expande para TODOS
      os sentidos. Avaliar se vale um "Enriquecer todos" automático na Mídia.

---

## 10. Convenções e armadilhas ao trabalhar aqui

- **Trabalhar SEMPRE na pasta `english-lab`** (é o repo git que faz deploy automático).
- **Não precisa commitar** — o deploy é automático. Pode haver ~1 min de atraso até o
  GitHub Pages publicar.
- **O shell (bash) enxerga cópias DESATUALIZADAS/truncadas** dos arquivos (OneDrive/mount).
  NÃO confie em `node -c`/`wc` via bash para validar; use a ferramenta de leitura (Read) ou
  o Claude in Chrome para inspecionar o app ao vivo.
- **Cuidado com lazy-loading** (seção 2).
- **Toda cor via variável CSS**; acentos via `rgba(var(--primary-rgb), …)`.
- **Sem emojis na UI** — usar `ic()`.
- **Mudanças de dados/sync são de alto risco** — sugerir backup (Exportar JSON) antes de testar.
- **Caminhos do service worker são RELATIVOS de propósito** (`js/init.js` e o `SHELL` do
  `sw.js`). O app roda na raiz em desenvolvimento e em `/english-lab/` no GitHub Pages;
  caminho absoluto quebra um dos dois. **Ao mudar qualquer arquivo do shell, bumpe a constante
  `CACHE` em `sw.js`** e lembre-se de incluir arquivos novos no `SHELL`.
- **Antes de usar `var(--alguma-coisa)`, confirme que a variável existe** em `css/styles.css`.
  Variável inexistente não dá erro: some silenciosamente (foi assim que o painel do player
  ficou sem fundo). Vale o mesmo para classes CSS referenciadas pelo JS.
- **Nunca use `git checkout` para "adotar" uma pasta como cópia de trabalho** — sobrescreve os
  arquivos locais. O caminho seguro é `git branch <b> origin/<b>` + `git symbolic-ref HEAD` +
  `git reset` (mixed), que só mexe no índice.
- **O CI falha se houver marcador de conflito de merge** (`<<<<<<<`/`=======`/`>>>>>>>`) em
  qualquer `.js`/`.css`/`.html`/`.md`/`.json`/`.yml` — guarda adicionado em 2026-07-30 depois de
  encontrar marcadores commitados no `main`.
