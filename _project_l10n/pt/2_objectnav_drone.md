---
lang: pt
project: 2_objectnav_drone
title: "AION: Navegação Aérea Interna Orientada a Objetos"
source_hash: 2dc0fa747eda
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2601.15614" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2601.15614
  </a>
</p>

<nav class="contrib">
  <p>O que eu fiz (segundo autor) · clique em um cartão para ir à seção</p>
  <ol>
    <li><a href="#framework"><strong>Framework de política dupla</strong><span>Explorar quando o alvo está fora de vista</span></a></li>
    <li><a href="#exploration"><strong>Política de exploração</strong><span>Indício de região aberta por profundidade + recompensas</span></a></li>
    <li><a href="#evaluation"><strong>Avaliação</strong><span>AI2-THOR + IsaacSim com vários cômodos</span></a></li>
  </ol>
</nav>

## Demo

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/img/aion_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/aion_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

## Visão geral

A navegação orientada a objetos (Object-Goal Navigation, ObjectNav) exige que um agente explore de forma autônoma um ambiente desconhecido e navegue até objetos-alvo especificados por um rótulo semântico. Embora os trabalhos anteriores tenham estudado principalmente o ObjectNav zero-shot com locomoção 2D, estendê-lo a plataformas aéreas com locomoção 3D continua pouco explorado. Robôs aéreos oferecem maior manobrabilidade e eficiência de busca, mas também trazem novos desafios de percepção espacial, controle dinâmico e garantia de segurança. Neste trabalho, propomos o AION para ObjectNav aéreo baseado em visão, sem depender de localização externa nem de mapas globais. O AION é um framework de aprendizado por reforço (RL) de política dupla, de ponta a ponta, que separa os comportamentos de exploração e de alcance do objetivo em duas políticas especializadas. Avaliamos o AION no benchmark AI2-THOR e analisamos ainda seu desempenho em tempo real no IsaacSim, com modelos de drone de alta fidelidade. Os resultados experimentais mostram que o AION alcança desempenho superior em métricas abrangentes de exploração, eficiência de navegação e segurança.

## Detalhes

**1. Tarefa**

Navegação interna orientada a objetos para UAVs com **locomoção 3D**: o drone deve explorar de forma autônoma um ambiente desconhecido e navegar até um objeto-alvo especificado por um rótulo semântico (por exemplo, "laptop", "microwave"), sem nenhum mapa prévio nem localização externa.

**Meu papel:** projetei, treinei e validei a política de exploração.

**Por que duas políticas:** os trabalhos anteriores usam uma única política de alcance do objetivo (LSTM + alinhamento texto–visão do CLIP). Isso basta no AI2-THOR, onde os cômodos são pequenos e o alvo costuma ficar visível após uma única volta; mas, quando o alvo está em outro cômodo, o CLIP não tem nada com que alinhar e o agente gira no mesmo lugar. Por isso separamos o comportamento conforme o alvo esteja ou não à vista, o estendemos ao movimento 3D de drones e passamos de cômodos isolados a ambientes com vários cômodos.

**2. Framework**
{: #framework}

Um framework de RL de política dupla que alterna entre dois modos conforme a visibilidade do alvo:

- **Modo de exploração** — maximizar a cobertura espacial em espaço desconhecido
- **Modo de alcance do objetivo** — servo visual em direção ao objeto-alvo detectado

<div class="media-row">
  <div>
    <img src="/assets/img/p2_model_arch.jpg" alt="Arquitetura de política dupla do AION">
  </div>
  <div>
    <img src="/assets/img/p2_visual_input.jpg" alt="Extração de ROI baseada em profundidade">
  </div>
</div>

**3. Modo de exploração**
{: #exploration}

**Entrada:**
Mapa de profundidade + ROI (Region of Interest, região de interesse). A ROI identifica áreas abertas e navegáveis na imagem de profundidade — simulando como os humanos olham instintivamente para espaços abertos ao se locomover. A ROI é extraída com métodos baseados em OpenCV e fornece um indício direcional (posição do centroide $$(d_x, d_y)$$ e profundidade média $$\bar{z}$$), e não informação absoluta sobre o espaço desconhecido.

**Recompensas:**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$: recompensa por avançar em direção ao espaço aberto
- $$R_{center}$$: penalidade pelo desvio de guinada em relação ao centroide da ROI
- $$R_{safe}$$: penalidade por colisão / proximidade de obstáculos
- mais um bônus de área coberta

Alimentar um LSTM diretamente com RGB-D bruto não produz comportamento de exploração; é o indício da ROI que dá à política recorrente um forte senso de direção, sem odometria nem mapa. Até onde sabemos, esta é a primeira política de exploração puramente visual e sem mapa para robôs aéreos.

**4. Modo de alcance do objetivo**

**Entrada:**
Imagem RGB + embedding de texto do CLIP congelado (alinha características textuais e visuais para o reconhecimento zero-shot de objetos) + caixa delimitadora do objeto/classe.

**Recompensas:**

$$r_t^G = R_{dist} + R_{bbox} + R_{parent} + R_{suc} - R_{collision}$$

- $$R_{dist}$$: recompensa por reduzir a distância euclidiana até o alvo
- $$R_{bbox}$$: recompensa por centralizar e ampliar a caixa delimitadora do alvo no campo de visão (indica aproximação do objeto)
- $$R_{parent}$$: recompensa pela classe-mãe — por exemplo, chegar a uma mesa rende recompensa parcial se o alvo for um laptop sobre essa mesa
- $$R_{suc}$$: recompensa por sucesso na tarefa
- $$R_{collision}$$: penalidade por colisão

**5. Espaço de ações**

Ações **3D** discretas — avançar, girar à esquerda/direita, subir, descer etc.

**6. Avaliação**
{: #evaluation}

Avaliado em dois simuladores: AI2-THOR (benchmark padrão com divisões de objetos vistos/não vistos) e IsaacSim (ambientes maiores com vários cômodos, em que o alvo pode estar em outro cômodo).

Os cômodos isolados do AI2-THOR não permitem testar a exploração — o alvo muitas vezes está visível desde o início —, por isso construímos no IsaacSim uma avaliação com vários cômodos (Chemistry Lab, Beechwood, Ihlen), com alvos colocados em cômodos não visíveis no início. Métodos com apenas uma política de alcance do objetivo giram no mesmo lugar; com a política de exploração, o drone segue em direção ao espaço aberto e encontra o alvo através dos cômodos.

{% include svg_figure.liquid name="aion_thor" caption="Benchmark AI2-THOR em duas divisões de objetos. O AION lidera todas as métricas em ambas as divisões; na divisão não vista 18/4, supera o MJO em 4,3 pontos de SR e 3,5 de SPL." %}

{% include svg_figure.liquid name="aion_isaac" caption="Avaliação entre cenas no IsaacSim, em três cenas com vários cômodos e modelos de drone de alta fidelidade. Cada ponto é um ensaio (cinco por objeto e cena); o AION tem sucesso em 52 de 60 ensaios, contra 40 e 35 da exploração combinada com MJO e SSNet." %}

<div class="media-row">
  <div>
    <img src="/assets/img/p2_isaac.jpg" alt="Cenas do IsaacSim e objetos-alvo">
  </div>
  <div>
    <img src="/assets/img/p2_exploration_beechwood.png" alt="Trajetórias de exploração em Beechwood">
  </div>
</div>
