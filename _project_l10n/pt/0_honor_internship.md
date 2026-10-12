---
lang: pt
project: 0_honor_internship
title: "Honor Humanoid: RL em robô real para VLA"
source_hash: b1ae248d5011
---

Trabalho no **robô humanoide** desenvolvido internamente pela Honor: coleta de dados por teleoperação, replay, treinamento e implantação no robô, além de pesquisa de algoritmos de **RL em robô real** para modelos **Vision-Language-Action (VLA)** em tarefas de manipulação personalizadas.

<nav class="contrib">
  <p>O que fiz · clique em um cartão para ir à seção</p>
  <ol>
    <li><a href="#loop"><strong>Pipeline VLA de ponta a ponta</strong><span>Coletar → treinar → implantar, laboratório montado do zero</span></a></li>
    <li><a href="#data-design"><strong>Projeto de dados offline</strong><span>4 categorias: rastrear + recuperar</span></a></li>
    <li><a href="#infra"><strong>Infraestrutura de treinamento com intervenção humana</strong><span>Takeover · ciclo Actor–Learner–Robot · tarefa nova ≈ 0% → 50%+</span></a></li>
    <li><a href="#algorithms"><strong>Algoritmos de RL em robô real</strong><span>RECAP · RAPID · loco-manipulação</span></a></li>
    <li><a href="#rove"><strong>Reprodução do ROVE</strong><span>Sucesso autônomo 40% → 52%</span></a></li>
    <li><a href="#debugging"><strong>Depuração em robô real</strong><span>6 bugs, cada um encontrado por uma sonda</span></a></li>
  </ol>
</nav>

## Demonstrações

### Inferência no robô sob perturbações

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/inference_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/inference_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Execuções autônomas de pegar e colocar no robô real enquanto o objeto (à esquerda) e a cesta de destino (à direita) são perturbados no meio do episódio — a política volta a rastreá-los e conclui a tarefa. A mão nunca para de se mover, e a política nunca espera o objeto se acomodar: o que ela aprendeu é rastreamento visual e rejeição de perturbações, não uma única trajetória de pegar e colocar.

### Projeto de dados para robustez

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/data_design_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/data_design.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Quatro categorias de demonstrações teleoperadas: demonstrações padrão, perturbações durante a fase de pegar, perturbações durante a fase de colocar e recuperação a partir de estados de preensão falha — projetadas para que a política aprenda a se recuperar, e não apenas a repetir.

### SFT em robô real: antes vs. depois

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Uma tarefa que a política treinada offline não conseguia executar é aprendida no robô por meio do ciclo de aprendizado em robô real — os dados de takeover humano retornam ao treinamento, e a taxa de takeover cai à medida que novos checkpoints são distribuídos.

## 1. Pipeline VLA de ponta a ponta {#loop}

O laboratório de Xangai foi montado do zero depois que entrei: configuração do robô, dois equipamentos de teleoperação (Pico VR e captura de movimento), treinamento dos operadores de coleta de dados e o pipeline de treinamento. A tarefa é pegar e colocar (garrafa → cesta) com uma única instrução fixa.

{% include svg_figure.liquid name="honor_pipeline" caption="Pipeline de ponta a ponta em robô real. O GR00T N1.7 (3B) é pós-treinado com o backbone visão-linguagem congelado; a ação de 37 dimensões é selecionada a partir de um estado do robô de 115 dimensões. Não há conjunto de validação, então os checkpoints são salvos a cada 2K passos e escolhidos por execuções no robô; a loss estabiliza após cerca de 15K passos." %}

{% include svg_figure.liquid name="honor_chunk" caption="Transição de action chunks na inferência. O próximo chunk é solicitado quando ainda restam 15 passos; as ações que ficaram obsoletas durante a inferência são descartadas e a sobreposição é combinada por fade linear, de modo que o robô não engasga entre chunks." %}

**No robô**, a fase de colocar quase nunca falha — a política acompanha mesmo quando a cesta é arrastada rapidamente. As falhas ao pegar se correlacionam com a posição do objeto; isso foi rastreado até os dados (postura fixa, nenhum movimento local durante a coleta, de modo que o modelo nunca constrói noção de distância), e não até a precisão do braço. Resultado: o laboratório passou a ter um ciclo interno de iteração “coletar → fazer fine-tuning → validar no robô”, em vez de depender de modelos entregues externamente.

## 2. Projeto de dados offline {#data-design}

**Por que quatro categorias de dados.** As categorias ①–③ (padrão, perturbação na fase de pegar, perturbação na fase de colocar) ensinam a política a _rastrear_ um objeto ou recipiente em movimento. A categoria ④ ensina a _se recuperar_: a partir da pose de pairar logo após uma preensão falha, a demonstração abaixa a mão, pega de novo e coloca. Sem ela, a política muitas vezes não percebe que a preensão falhou — levanta a mão vazia, vai até a cesta e “coloca” nada. As quatro categorias são aproximadamente equilibradas; a robustez da demonstração acima vem desse projeto de dados, não do ajuste de hiperparâmetros.

## 3. Infraestrutura de treinamento em robô real com takeover humano {#infra}

### 3.1 Takeover humano e pipeline de dados orientado por intervenção {#takeover}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/takeover_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/takeover_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">Um teleoperador assume o controle no meio do episódio e o devolve (velocidade 3×, sem áudio).</p>

**Takeover humano suave.** Aprender no robô real exige que um humano possa assumir o controle a qualquer momento sem que o robô dê um salto. No takeover, o tópico de comandos do VLA é redirecionado para o tópico de teleoperação, e o controlador emite um _incremento_ sobre a última ação do VLA, em vez dos ângulos de junta absolutos do teleoperador.

{% include svg_figure.liquid name="honor_fsm" caption="Máquina de estados de comutação e regra de saída no takeover. Os takeovers também são gravados nos dados, de modo que cada episódio sabe quais quadros vieram do humano." %}

**Pipeline de dados orientado por intervenção.** Cada episódio é persistido, e o operador só pode vetar o classificador de sucesso para baixo, nunca promover uma falha a sucesso; as decisões do classificador e as estatísticas de falsos positivos/negativos são registradas junto. O buffer é um anel numpy limitado com baldes de sucesso/falha, FIFO com exclusão lógica e amostragem ponderada (correção de importância do PER), e um endpoint HTTP de revisão permite inspecionar cada episódio antes de chegar ao treinamento. Em outra rodada, 127 de 138 episódios coletados entraram no buffer como sucessos (11 totalmente autônomos, 116 com demonstrações de takeover).

{% include svg_figure.liquid name="honor_datapipe" caption="Do robô ao learner: cada episódio, inclusive as falhas, é gravado, julgado e enviado; o learner separa os episódios em baldes por resultado. Embaixo: composição de uma rodada de dados de robô real (142–416 quadros por episódio)." %}

### 3.2 Ciclo distribuído de aprendizado em robô real {#online-loop}

**Reproduzi o ciclo de amostragem por rejeição do Hi-ORS e o portei de π0 + braço Dobot para GR00T N1.7 + humanoide.** Três máquinas funcionam simultaneamente.

{% include svg_figure.liquid name="honor_arch" caption="Arquitetura Actor–Learner–Robot. O Actor executa a política no robô, apenas os episódios bem-sucedidos chegam ao Learner, e o Learner devolve os pesos treináveis ao Actor a cada 1.000 passos." %}

{% include svg_figure.liquid name="honor_gates" caption="Portões antes de um episódio entrar no treinamento. O classificador de sucesso é uma ResNet18 sobre um único quadro da câmera esquerda, com cabeça de um logit, treinada com BCE + pos_weight em 572 episódios (divisão por episódio, aumento de dados online, rótulos derivados automaticamente dos sinais da garra; F1 por quadro de 0,976). Ele só trava após 20 quadros consecutivos acima de 0,8 — essa histerese foi adicionada após a primeira sessão no robô real, em que o classificador declarava sucesso em 1–2 s e os falsos positivos enchiam o buffer. Âncoras de demonstrações-base em cada batch protegem contra esquecimento." %}

### 3.3 Resultados do SFT em robô real: uma tarefa nova de ≈ 0% a 50%+ em ~140 episódios {#results}

Quando a política trava, o operador assume o controle via Pico; os dados de takeover fluem direto para o Learner, e a taxa de takeover serve como métrica em tempo real. A **Cena 1** move a garrafa para a direita, onde os dados offline são escassos. A **Cena 2** inverte todo o layout da esquerda para a direita (cesta à esquerda, garrafa à direita) — exatamente o oposto de todos os dados offline —, de modo que o baseline de SFT offline é ≈ 0%.

{% include svg_figure.liquid name="honor_curve" caption="Proporção de passos teleoperados por episódio durante o SFT em robô real, com os checkpoints enviados ao Actor. Cada atualização de checkpoint é seguida por uma queda no takeover; a alta por volta do episódio 86 é a troca para a cena 2. Na fase de teste (checkpoints 5000–7000), a taxa de takeover cai para 18,8%." %}

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Cena</th><th>Mudança em relação aos dados offline</th><th>Episódios</th><th>SFT offline</th><th>Após SFT em robô real</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Garrafa à direita (escassa nos dados offline)</td><td>20</td><td>não medido</td><td><strong>55.0%</strong></td></tr>
    <tr><td>2</td><td>Cesta à esquerda, garrafa à direita (layout espelhado)</td><td>12</td><td>≈ 0%</td><td><strong>50.0%</strong></td></tr>
  </tbody>
</table>
</div>

Taxa de sucesso totalmente autônoma. Por que um backbone congelado ainda consegue aprender o layout espelhado: o modo de falha era _não se mover_, e não se mover na direção errada — a compreensão visual estava intacta, faltava apenas o mapeamento de ações.

## 4. Algoritmos de RL em robô real {#algorithms}

### 4.1 Treinamento condicionado por vantagem no estilo RECAP {#recap}

A amostragem por rejeição é um caso degenerado binário da vantagem: manter todo sucesso, descartar toda falha. **Portei a rotulagem de vantagem do π0.6 RECAP (como no RLinf) para o GR00T N1.7**, de modo que _todos_ os dados sejam usados, com “bom vs. ruim” como condição de entrada em vez de filtro — os episódios de falha viram amostras negativas em vez de desperdício.

{% include svg_figure.liquid name="honor_recap" caption="Pipeline no estilo RECAP. A penalidade de falha c_fail = 1000 excede a diferença entre o maior sucesso (1.000 quadros) e a menor falha (57 quadros), de modo que toda falha fica abaixo de todo sucesso. n = 20 passos corresponde ao horizonte de 1 s do artigo a 20 Hz. Os negativos moldam apenas o ramo CFG incondicional." %}

{% include svg_figure.liquid name="honor_value_net" caption="Rede de valor. O backbone do GR00T permanece congelado e não recebe gradiente; os tokens de imagem e de texto passam por mean-pooling separadamente porque os tokens de imagem superam em muito os de texto, e uma média única diluiria o condicionamento de linguagem. O RLinf acrescenta um token CLS aprendível e usa uma única cabeça linear; o backbone do GR00T não aceita embeddings de entrada extras, então fazemos pooling e adicionamos uma camada oculta. O esboço da distribuição de átomos é ilustrativo." %}

Até que V esteja pronto, rótulos baseados em regras servem de alternativa: todos os quadros de sucesso positivos, os quadros autônomos de falhas negativos, e os 20 quadros antes de cada takeover sobrescritos como negativos. A rede de valor é treinada separadamente e só é aceita se o Spearman ρ em episódios held-out (um a cada 10) exceder 0,55: o dry run alcançou ρ = 0,647 (platô 0,59) com loss de 4,52 → 0,76, enquanto um controle com rótulos embaralhados ficou em ρ absoluto ≤ 0,26 e reprovou no critério — logo, o critério é significativo. A concordância entre os rótulos baseados em V e os baseados em regras foi de apenas 0,31, então a rede de valor continua sendo o gargalo, e a comparação A/B em robô real não foi concluída.

### 4.2 RAPID: adaptação rápida no espaço de ruído {#rapid}

**RAPID** (_Rapid Adaptation from Physical Interventions via Diffusion-noise_), no espírito do DSRL: treinar um novo checkpoint leva tempo e, até ele chegar, o robô ainda não consegue fazer a tarefa. O RAPID mantém os pesos do VLA congelados e substitui apenas o ruído inicial do flow matching, de modo que uma correção que o humano acabou de fazer possa ser reaproveitada na próxima vez que um estado semelhante aparecer. Foi integrado à inferência no robô no fim de agosto.

{% include svg_figure.liquid name="honor_rapid" caption="RAPID. Offline, as correções humanas são invertidas através da política congelada até o ruído inicial que as reproduz (64 passos finos; Euler de 4 passos é grosseiro demais) e armazenadas em uma memória indexada por observação. Na implantação, o ruído recuperado é interpolado esfericamente com ruído gaussiano antes da amostragem normal de flow matching." %}

{% include svg_figure.liquid name="honor_dsbc_net" caption="Rede de ruído do DSBC. Um MLP pequeno mapeia a chave de recuperação diretamente para o ruído inicial, substituindo a busca por vizinho mais próximo; o próprio VLA permanece congelado. H é o horizonte de ação de 40 passos da cabeça de ação do GR00T (30 passos são executados por inferência); D é a sua dimensão de ação." %}

{% include svg_figure.liquid name="honor_rapid_chart" caption="Validação offline em 24 episódios de takeover de uma tarefa de contagem. O DSBC lidera em todo K (54,9–57,0); a recuperação por memória chega a apenas 20 com K = 1–2 e a 45–49 com K ≥ 4; o partial noising fica estável em 37; o memory_delta fica abaixo de 8. A métrica é o ganho de DTW, não a taxa de sucesso em robô real." %}

A auditoria foi **pré-registrada**: auditoria PASS; reversão CONDICIONAL (erro de reconstrução 0,232, dentro de 0,10–0,30); dispersão rebaixada para frágil após uma nova execução; transferência PASS (p ≈ 1e-21). Sob esses critérios, a afirmação “a recuperação vence com K < 10” foi **descartada** — o desenho experimental rejeitou minha própria hipótese — e o sistema convergiu para o DSBC como caminho principal, com a recuperação por memória como front end opcional. Os próximos passos eram destilar o DSBC na política, aposentar gradualmente entradas da memória e conectá-lo ao RL em robô real.

### 4.3 Extensão à loco-manipulação {#loco}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/locomanip_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/locomanip_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">O humanoide caminha sozinho até um balcão e pega uma garrafa — 7 clipes de robô real, velocidade 5×, sem áudio; as marcas amarelas no chão são referências do trajeto de caminhada.</p>

Toda a pilha — takeover, ciclo de aprendizado em robô real, RECAP e RAPID — passou da tarefa de pegar e colocar sobre a mesa para uma tarefa com caminhada sem precisar ser reescrita.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Dados de loco-manipulação</th><th>Valor</th></tr></thead>
  <tbody>
    <tr><td>Episódios de caminhada coletados</td><td>507 episódios · 181K quadros</td></tr>
    <tr><td>Mantidos após 6 critérios de triagem</td><td>326 episódios</td></tr>
    <tr><td>Conjunto de treinamento combinado</td><td><strong>848 episódios · 306K quadros (+71%)</strong></td></tr>
    <tr><td>Comprimento mediano do trajeto por episódio</td><td>0,32 m → <strong>3,2 m</strong></td></tr>
  </tbody>
</table>
</div>

**Sobre as métricas, com honestidade:** a etapa de SFT em robô real tem números completos (55% / 50%). Depois da mudança para a tarefa de locomoção, todos os componentes foram implementados e integrados, mas não houve melhora em nível de métrica nela: a maturidade do hardware de corpo inteiro e da pilha de locomoção na época não permitiu uma avaliação sistemática em robô real.

## 5. Reprodução do ROVE {#rove}

**Tarefa.** O humanoide fica parado — pés fixos, sem caminhar — e pega um celular com a mão: manipulação fina em que um pequeno desalinhamento rapidamente termina em um takeover humano.

O ROVE (XPENG, arXiv:2606.17011) mantém o esqueleto de condicionamento por vantagem do RECAP (§4.1) e muda a forma de pontuar os takeovers humanos. Eu o reproduzi sobre o pipeline do RECAP, atrás de uma única chave de algoritmo — o caminho RECAP padrão permanece idêntico bit a bit, garantido por autotestes — e executei o Algoritmo 1 do artigo como um ciclo offline: implantar e coletar → retornos cientes de estágio → atualização do valor → vantagens e rótulos → SFT condicional. Só o primeiro passo precisa do robô; os outros quatro rodam como um único comando.

### 5.1 Retorno ciente de estágio {#rove-return}

No RECAP, um episódio que um humano resgatou ainda conta como sucesso: seu retorno sobe de um em um a cada passo até 0, de modo que as ações autônomas que _causaram_ o takeover parecem progresso constante. O único remédio é uma regra fixa que rotula como negativos os 20 quadros anteriores a um takeover. O ROVE divide esse episódio em três segmentos — execução autônoma, adaptação (o humano ainda está recolocando o robô no rumo) e recuperação — e contabiliza uma penalidade de falha C_fail em t_r, o fim da adaptação. O segmento autônomo que levou ao takeover passa a pontuar no nível de falha, enquanto a recuperação mantém seu retorno normal de time-to-go.

{% include svg_figure.liquid name="honor_rove_return" caption="Retorno ciente de estágio (Eq. 2 do artigo): −1 por passo, C_fail em t_r, quadros ociosos (operador trocando de modo) removidos. t_r recua para takeover + 40 quadros (2 s) quando não anotado; a ablação do artigo perde 30 pp quando t_r é colocado no início do takeover, então o padrão erra para o lado tardio. C_fail deve exceder o maior intervalo no pool positivo, ou um episódio de falha pontuaria mais que uma recuperação: o limite inferior medido nestes dados é 919, portanto C_fail = 1000 (o 500 do artigo é pequeno demais aqui). Os retornos coincidiram bit a bit com o cálculo manual em 38 episódios arquivados." %}

### 5.2 Estimativa otimista de valor (OVE) {#rove-ove}

A regressão Monte Carlo simples aprende o retorno _médio_. Em estados que frequentemente terminam em takeover, a média já é baixa, então a ação que causou o takeover recebe uma vantagem próxima de zero e nunca é rotulada como negativa. O OVE faz fine-tuning da mesma cabeça de valor escalar, após o pré-treinamento MC, com um alvo TD de 16 passos (a partir de uma cópia EMA da rede) e uma loss de expectile com τ = 0,7, que penaliza mais as subestimativas do que as superestimativas. Assim, V estima quanto um estado vale _quando as coisas correm bem_: estados pré-takeover recebem valor alto, seu retorno real é baixo, e a vantagem negativa recai sobre as ações que causaram o takeover. O horizonte da vantagem também é de 16 passos — um action chunk, a unidade à qual o rótulo é atribuído — e os 40% melhores quadros são rotulados como positivos.

Cada checkpoint de valor passa por um portão de Spearman ρ em episódios held-out: a concordância de ranking entre o V previsto e o retorno real (1 = mesma ordem). A etapa MC deve atingir ρ ≥ 0,55 no pool completo; a etapa OVE é julgada apenas em episódios de sucesso (ρ ≥ 0,70), porque o OVE se afasta do retorno médio em estados que levam à falha por construção, de modo que um ρ menor no pool completo é esperado e não uma regressão.

{% include svg_figure.liquid name="honor_rove_rho" caption="Spearman ρ held-out em três execuções de treinamento de valor (sombreado: fase OVE). Rollouts limpos: o ρ do conjunto de sucessos permanece em 0,744–0,806 após a troca para OVE, enquanto o ρ do pool completo cai de 0,735 para 0,69, como pretendido; o portão de 0,70 foi definido a partir desta execução. Demos + rollouts: o ρ do conjunto de sucessos cai de 0,731 para 0,628 — 85% do conjunto held-out são demonstrações limpas, e o bootstrapping otimista empurra todas para o topo, comprimindo o ranking. Pool iter0, com warm start direto em OVE: ρ do pool completo 0,68–0,71, ρ do conjunto de sucessos 0,63–0,67, abaixo do portão. Os três pools têm conjuntos held-out diferentes, então o ρ não é comparável entre os painéis." %}

<figure class="fig">
  <img src="{{ '/assets/img/honor_rove_value_curve.jpg' | relative_url }}" alt="Curvas de valor em um episódio held-out com takeover: retorno real, valor MC e valor OVE, com os quadros de vantagem negativa marcados" loading="lazy" width="1400" height="653">
  <figcaption>Reprodução da Fig. 6 do artigo em um episódio held-out com takeover (x: quadro, quadros ociosos removidos; y: valor normalizado). Antes de t_r, o valor OVE (azul) fica acima do valor MC (laranja) — otimista dentro da distribuição —, depois salta em t_r e acompanha o retorno real durante a recuperação. Os pontos vermelhos marcam quadros com vantagem OVE negativa: eles se concentram antes do takeover e no segmento de adaptação.</figcaption>
</figure>

### 5.3 Resultados {#rove-results}

O sucesso autônomo no robô subiu de 40% (checkpoint base, n = 77) para **52%** (ROVE iter0, n = 192); os sucessos com assistência humana caíram de 45% para 20% dos episódios, enquanto as falhas subiram de 14% para 28%.

{% include svg_figure.liquid name="honor_rove_robot" caption="Resultado de cada episódio de robô real registrado, por checkpoint, conforme julgado pelo operador. Base 64000: fim de ago. – início de set.; base 80000: início – meados de set.; ROVE iter0: 17–23 de set." %}

O iter0 foi treinado com uma passagem do ciclo offline: um pool de valor com 2.068 episódios (534K quadros de demonstrações e rollouts em robô real, 207 episódios held-out), rótulos com exatamente 40,0% de positivos e SFT condicional a partir do checkpoint base de 80K passos por 8.000 passos (lr 1e-4) em uma GPU H20 em 18 h 17 min.

{% include svg_figure.liquid name="honor_rove_sft" caption="Loss do SFT condicional do iter0. A média de 200 passos cai de 0,54 para 0,047 no passo 1.000 e para 0,025 no passo 8.000." %}

**Sobre as métricas, com honestidade:** os três grupos vêm de dias, operadores e conjuntos de prompts diferentes, então isto é uma observação, não um teste A/B — a avaliação intercalada contra o checkpoint base e um braço RECAP ainda está pendente. A coleta do iter0 também não registrou segmentos de takeover, de modo que a próxima rodada fica sem o sinal central do ROVE até que esse registro seja corrigido.

## 6. Depuração em robô real {#debugging}

Nenhum desses problemas poderia ser encontrado revisando o código offline — eles só apareceram em longas execuções no robô real, e cada um foi localizado com uma sonda ou uma métrica quantitativa.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Sintoma</th><th>Sonda / evidência</th><th>Causa raiz → correção</th></tr></thead>
  <tbody>
    <tr><td>Generalização se deteriorando após o fine-tuning</td><td>Loss held-out 0,0048 → 0,0222 no passo 2000 (×4,6); cosseno da direção da ação 0,995 → 0,979 → 0,961</td><td>O mixer de dados-base lia mp4 como BGR enquanto a torre de visão congelada espera RGB — metade do orçamento de gradiente aprendia ruído; corrigido com um único valor padrão. As âncoras cobriam apenas 29 episódios (5,6%) → ampliar o buffer-base</td></tr>
    <tr><td>Buffer cheio de falsos sucessos</td><td>Episódios travavam em “sucesso” após 24 e 29 passos; o learner treinou com eles por mais de 1.000 passos</td><td>Travamento e reset compartilhavam um único limiar de 0,5, sem histerese → travar em p &gt; 0,8 × 20 quadros, resetar em p ≤ 0,3 × 3 quadros. Um objeto posteriormente não resetado produziu 2.536 passos inúteis em 11 episódios — logo acima do limiar de treinamento de 2.500 passos: auditar quadro a quadro desde a primeira sessão</td></tr>
    <tr><td>Comportamento difere entre treinamento, implantação e RL</td><td>Comparação campo a campo das observações nos três pipelines</td><td>Tipo DDS da garra, câmera de cabeça para baixo, inicialização da posição da mão, indexação da posição da cabeça → lista de correções com 9 itens</td></tr>
    <tr><td>O robô gira no início do episódio</td><td>Deriva mediana de yaw de 31°</td><td>Âncora de yaw obsoleta + reancoragem completa a cada chunk → limite de taxa de 3°/chunk com teto de 20°; 6 execuções de validação: erro de ancoragem 0,0°, giro no primeiro segundo ≤ 1,6°</td></tr>
    <tr><td>Quadros de câmera obsoletos</td><td>47% de quadros consecutivos duplicados em 77 de 83 episódios; fonte a 61 Hz, decodificação a 54,9 Hz, efetivo ≈ 10,6 Hz sob carga</td><td>Adicionada observabilidade da atualidade dos quadros</td></tr>
    <tr><td>“O modelo não se move”</td><td>Cliente do trainer bloqueado em retentativas</td><td>Portas do actor / learner incompatíveis. Lição: todo “o modelo não se move” é, primeiro, uma verificação de comunicação ou de observação e só depois uma verificação de pesos</td></tr>
  </tbody>
</table>
</div>
