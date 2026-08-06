# English Lab — Estado do Projeto e Guia de Continuidade

> Documento vivo. **Sempre leia este arquivo antes de iniciar qualquer tarefa** e
> **atualize-o ao finalizar cada tarefa** (instrução fixada no `CLAUDE.md`).
>
> Última atualização: 2026-08-05 — **SEÇÃO LER: o leitor de ebooks nativo (79ª rodada)**:
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
js/lang.js        — MULTI-IDIOMA: registro LANGS, idioma ativo, prompts, decks/idioma, migração (NÃO-lazy)
js/firebase.js    — sincronização Firestore (TEMPO REAL)
js/audio.js       — IndexedDB (AudioDB/CardsDB/ImageDB), TTS, Biblioteca (browser de cards), reanálise
js/srs.js         — MOTOR SM-2 (estado srsCards/srsCfg/srsLog/srsSession)
js/dashboard.js   — render do Dashboard
js/review.js      — fila de Revisar + análise de IA (prompt principal)
js/settings.js    — Configurações (cfg, temas, AI_MODELS, limpar dados)
js/init.js        — bootstrap (initApp) + service worker
js/add.js         — aba Adicionar (manual/Kindle/Mídia/Website)  (CARREGADO LAZY)
js/kindle-db.js   — leitor SQLite só-leitura (vocab.db do Kindle), sem WASM  (LAZY, antes de add.js)
js/epub.js        — leitor de ZIP (DecompressionStream nativo) + parser EPUB  (LAZY, antes de ler.js)
js/ler.js         — seção LER: estante, leitor, tipografia, captura, cobertura  (LAZY)
js/consulta.js    — seção Assistente (chat IA, histórico, streaming, SRS múltiplo)  (NÃO-lazy)
js/study.js       — UI/sessão do SRS          (CARREGADO LAZY)
js/known.js       — seção Palavras (gerenciador de vocabulário)  (LAZY)
js/video*.js      — PACOTE lazy da seção Vídeo, carregado NESTA ordem:
                    video.js (estado + player + biblioteca)
                    video-subs.js (parser/busca/aplicação de legenda, tradução, Whisper)
                    video-sync.js (painel de sincronia + correção de deriva)
                    video-study.js (seleção, card com áudio real, ditado, shadowing)
                    video-podcast.js (agregador de podcasts: busca, feed, download)
```

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
  `status`: `pending_ai` → `pending_review` → `in_srs` (ou `skipped`).
  - `lang`: código ISO do idioma do item ('en' padrão/legado). `type` é supertipo universal
    (`word|phrasal_verb|idiom|collocation`; `phrasal_verb` = expressão verbal do idioma);
    `type_label` = nome local da categoria em PT (ex.: "verbo separável"). Ver `js/lang.js`.
  - `source_context`: nota opcional de gênero/contexto da fonte (ex.: "reality de sobrevivência").
    Usada pela IA para desambiguar (resolve o caso "snuff" → "apagar a tocha" no Survivor).
  - `meanings[]`: `{meaning_pt, definition_pt, origin_pt, variety, register, level, examples[], ...}`
    - `origin_pt`: origem/história da expressão (só quando há etimologia/imagem interessante;
      vazio para palavras comuns). Vai para o snapshot do card e aparece no estudo e na revisão.
  - `examples[]`: `{en, pt}` (en com a palavra-alvo em `<b>`).
- **`srsCards[]`** — um card por (wordId, meaningIdx, exampleIdx). Guarda *snapshot*
  do conteúdo + estado SM-2: `{id, wordId, meaningIdx, exampleIdx, deckId, state, due,
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
- **Revisar** — sidebar (filtros em pílula + busca + lista) e card central com significados
  selecionáveis. Ação principal: "Salvar para estudo" (cria os cards SRS). Badge de pendentes
  fica NESTE item do menu.
- **Estudar** — números clicáveis (Novos/Revisar/Aprender) abrem a Biblioteca filtrada;
  tabela de baralhos; sessão de flip card + 4 botões (Errei/Difícil/Bom/Fácil).
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

## 9. Pendências / a verificar

- [ ] **REFAZER OS DOIS CASOS DA 163ª RODADA COM O DEEPSEEK.** As correções são de PROMPT e não
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
