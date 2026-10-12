---
lang: pt
project: 1_vla_benchmark
title: "LangGap: um benchmark de compreensão de linguagem para VLA"
source_hash: ceb66c896e84
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2603.00592" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2603.00592
  </a>
  <a href="/assets/pdf/LangGap-IROS2026-poster.pdf" target="_blank" rel="noopener">
    <i class="fa-solid fa-image"></i> Pôster (IROS 2026)
  </a>
</p>

<nav class="contrib">
  <p>O que eu fiz (primeiro autor) · clique em um cartão para ir à seção</p>
  <ol>
    <li><a href="#benchmark"><strong>Projeto do benchmark</strong><span>99 tarefas · 4 dimensões de perturbação</span></a></li>
    <li><a href="#data"><strong>Coleta de dados</strong><span>16 tarefas × 150 demos por script</span></a></li>
    <li><a href="#training"><strong>Treinamento do modelo</strong><span>π0.5 LoRA · tarefa única de 0% a 90%</span></a></li>
    <li><a href="#results"><strong>Análise dos resultados</strong><span>93,8% → 21,4% · 4 modelos VLA</span></a></li>
  </ol>
</nav>

## Demo

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="/assets/img/langgap_video_poster.jpg">
      <source src="/assets/video/langgap_video.mp4" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video autoplay loop muted playsinline preload="metadata" poster="/assets/img/langgap_poster.jpg">
      <source src="/assets/video/grid_8x4.mp4" type="video/mp4">
    </video>
  </div>
</div>

## Visão geral

Os modelos Vision-Language-Action (VLA) alcançam mais de 95% de sucesso em benchmarks padrão. No entanto, por meio de experimentos sistemáticos, constatamos que os modelos VLA de ponta atuais ignoram em grande parte as instruções em linguagem natural. Os trabalhos anteriores carecem de: (1) diagnósticos sistemáticos de perturbação semântica, (2) um benchmark que, por construção, exija compreensão da linguagem e (3) dados de treinamento linguisticamente diversos. Este artigo constrói o benchmark LangGap, baseado em um método de perturbação semântica em quatro dimensões -- variar a semântica da instrução mantendo fixo o layout da mesa --, revelando deficiências de compreensão de linguagem no π0.5. Benchmarks existentes, como o LIBERO, atribuem apenas uma tarefa por layout, subutilizando os objetos e os locais de destino disponíveis; o LangGap diversifica por completo as tarefas de pegar e colocar sob layouts idênticos, forçando os modelos a realmente compreender a linguagem. Os experimentos mostram que o aumento de dados direcionado consegue fechar parcialmente a lacuna de linguagem -- a taxa de sucesso sobe de 0% para 90% com treinamento em tarefa única e de 0% para 28% com treinamento multitarefa. Contudo, à medida que a diversidade semântica das tarefas estendidas aumenta, a capacidade de aprendizado do modelo se mostra gravemente insuficiente; até mesmo as tarefas treinadas têm desempenho ruim. Isso revela um desafio fundamental para os modelos VLA na compreensão de instruções linguísticas diversas -- justamente o valor de longo prazo do LangGap.

## Detalhes

**1. Benchmark e conjunto de dados**
{: #benchmark}

O benchmark LangGap tem **99 tarefas** no total — 40 tarefas originais do LIBERO + 59 tarefas estendidas de perturbação semântica. Fornecemos um conjunto de treinamento com 56 tarefas: 16 tarefas estendidas coletadas por nós (150 demos cada) + 40 tarefas originais (50 demos cada), totalizando ~4.100 trajetórias.

**2. Descoberta do problema**
{: #diagnosis}

Ao mudar a instrução de "put bowl on plate" → "put bowl on stove" na mesma cena visual, o modelo continua executando a ação original (vai até o prato), com **0% de sucesso**. Isso revela que os VLAs fazem correspondência de padrões entre visão e ação, em vez de uma compreensão genuína da linguagem.

Projetamos um diagnóstico de perturbação semântica em quatro dimensões — Change Object, Change Target, Spatial Description e Drawer Action — mantendo a cena visual idêntica e modificando apenas a instrução:

{% include svg_figure.liquid name="langgap_diagnosis" caption="Diagnóstico do π0.5 em 99 tarefas e 1.980 episódios. Nossa reexecução das 40 tarefas originais coincide com a pontuação oficial; as 59 tarefas estendidas caem 72,4 pontos. Em Change Target, o π0.5 falha nos 260 episódios e nenhum modelo testado passa de 2,3%; portanto, a falha não é um artefato de formulação — e a pontuação agregada a esconde." %}

<div class="media-row">
  <div>
    <img src="/assets/img/libero_suites_strip.png" alt="Suítes de avaliação do LIBERO com anotações de perturbação">
  </div>
</div>

**3. Princípios de projeto**
{: #design}

1. **Multitarefa na mesma cena** — Várias tarefas compartilham estados visuais iniciais idênticos, eliminando atalhos visuais. Um modelo que ignora a linguagem alcança no máximo 1/k de sucesso (k = tarefas por cena).
2. **Divisão treino/avaliação no nível da instrução** — As tarefas de treinamento não incluem todas as tarefas de teste; a avaliação com tarefas reservadas contém instruções inéditas para testar a generalização composicional.
3. **Validação de viabilidade física** — Todas as tarefas estendidas foram verificadas no simulador LIBERO para garantir que possam ser agarradas, alcançadas e detectadas.

**4. Pipeline de coleta de dados**
{: #data}

- **Geração escalável e diversa:** Empregamos um pipeline de coleta por script, baseado em waypoints, para reunir de forma eficiente e estável 150 episódios bem-sucedidos por tarefa. Embora os waypoints sejam codificados manualmente para cada tarefa específica, o simulador introduz pequenas variações naturais nos layouts iniciais da mesa. Isso garante que as trajetórias coletadas sejam visual e dinamicamente diversas, evitando que os modelos apenas memorizem caminhos rígidos e idênticos.
- **Arquitetura de controle hierárquica:** Cada tarefa usa um script próprio que decompõe o processo de pegar e colocar em vários waypoints sequenciais. No nível alto, aplicamos controle puramente proporcional (P) para calcular os erros de posição e emitir comandos de ação contínuos. Esses comandos são então executados pelo controlador PD OSC (Operational Space Control) de baixo nível do simulador, obtendo um controle contínuo suave e de alta precisão.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_waypoints.jpg" alt="Sequência de waypoints de uma demonstração por script: posição inicial, preensão, transporte, colocação" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Temporização dos waypoints de uma demonstração por script (ilustrativa): posição inicial → acima do objeto → preensão → elevação → acima do destino → colocação. Controlador OSC_POSE com erro de pose por passo normalizado para [−1, 1]; um episódio só é mantido se for bem-sucedido dentro do orçamento de passos.</p>

- **Por que scripts em vez de teleoperação:** as primeiras tentativas com teleoperação por mouse foram trêmulas, lentas e inconsistentes. Os scripts, escritos a partir das coordenadas dos objetos no arquivo BDDL de cada tarefa, foram ajustados à mão no simulador até que toda tarefa pudesse ser agarrada, alcançada e detectada — as ações resultantes são limpas e a coleta é totalmente automática: ~150 demos por tarefa (as tarefas oficiais do LIBERO têm 50), 16 tarefas ≈ 2.400 demos.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_rollout_2x8.jpg" alt="Amostra de execuções de demonstrações por script" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Uma amostra das 2.400 demonstrações por script.</p>

**Ajuste fino: tarefa única de 0% a 90%**
{: #training}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="/assets/img/langgap_before_after_poster.jpg">
    <source src="/assets/video/langgap_before_after.mp4" type="video/mp4">
  </video>
</div>
<p class="caption">Esquerda: antes do treinamento — a instrução diz "stove", mas a política ainda coloca a tigela no prato. Direita: após o ajuste fino com os dados estendidos — a tigela vai para o fogão.</p>

- π0.5 com LoRA (r = 64) em uma única RTX 4090.
- Os checkpoints são selecionados por execuções (rollouts), e não pela perda: a perda continua diminuindo, enquanto a taxa de sucesso não é monotônica.
- As instruções de treinamento e de teste são literalmente idênticas, exceto nas 43 tarefas reservadas, cujas instruções são novas.

**5. Resultados**
{: #results}

{% include svg_figure.liquid name="langgap_benchmark" caption="Benchmark completo: modelos VLA recentes nas quatro suítes do LIBERO, tarefas originais versus estendidas. Todos os modelos apresentam uma grande lacuna de linguagem; nosso π0.5 ajustado com 45 tarefas melhora o total estendido (22,8) e o Change Target (0 → 6,2), mantendo 89,5 nas tarefas originais. As 43 tarefas reservadas nunca foram usadas no treinamento." %}

{% include svg_figure.liquid name="langgap_progressive" caption="Validação progressiva com os mesmos dados estendidos, à medida que o número de tarefas de treinamento cresce de 1 para 56. A memorização de uma única tarefa chega a 90%, mas os ganhos desabam quando tarefas semanticamente diferentes são aprendidas em conjunto; incluir as 40 tarefas oficiais (56 tarefas) recupera 27,5%, e a lacuna de linguagem permanece." %}

**6. Valor de longo prazo**

À medida que a diversidade semântica das tarefas aumenta, a capacidade de aprendizado do modelo se mostra gravemente insuficiente — até mesmo as tarefas treinadas têm desempenho ruim. Isso revela um desafio fundamental, independente da arquitetura: todos os modelos testados (π0.5, π0, π0-FAST, SmolVLA) apresentam a mesma lacuna de linguagem. O LangGap oferece uma ferramenta de diagnóstico sistemática que continua valiosa à medida que novas arquiteturas VLA surgem, justamente porque a lacuna de linguagem é um problema persistente que os paradigmas de treinamento atuais ainda não resolveram.
