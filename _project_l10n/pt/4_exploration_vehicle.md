---
lang: pt
project: 4_exploration_vehicle
title: "Veículo de exploração autônoma baseado em fronteiras"
source_hash: 36c561ab6341
---

<nav class="contrib">
  <p>O que fiz (trabalho de conclusão de curso, líder da equipe) · clique em um cartão para ir à seção</p>
  <ol>
    <li><a href="#architecture"><strong>Arquitetura do sistema</strong><span>3 camadas · 2 modos de tarefa</span></a></li>
    <li><a href="#hardware"><strong>Integração de hardware</strong><span>Jetson · LiDAR · RGB-D · STM32</span></a></li>
    <li><a href="#localization"><strong>Localização de vítimas</strong><span>máscara YOLOv11 + profundidade → mapa</span></a></li>
    <li><a href="#odometry"><strong>Ponte de odometria do SLAM</strong><span>TF do Cartographer → /odometry</span></a></li>
    <li><a href="#frontier"><strong>Exploração por fronteiras</strong><span>Ganho de informação vs. custo de deslocamento</span></a></li>
    <li><a href="#experiments"><strong>Experimentos de campo</strong><span>3 locais × 3 velocidades × 3 execuções</span></a></li>
  </ol>
</nav>

## Demonstração

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="{{ '/assets/img/exploration_demo_poster.jpg' | relative_url }}">
      <source src="{{ '/assets/video/exploration_demo.mp4' | relative_url }}" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="{{ '/assets/img/exploration_demo2_poster.jpg' | relative_url }}">
      <source src="{{ '/assets/video/exploration_demo2.mp4' | relative_url }}" type="video/mp4">
    </video>
  </div>
</div>

## Visão geral

A busca e o resgate após um desastre são uma corrida contra o tempo, e escombros, calor ou radiação muitas vezes tornam o local perigoso demais para que pessoas entrem primeiro. Este projeto constrói um pequeno robô de esteiras que vai à frente delas: ele explora sozinho um espaço interno desconhecido, constrói o mapa enquanto se move e marca no mapa cada pessoa que encontra, para que as equipes de resgate saibam aonde ir antes de pisar lá dentro.

Tudo roda a bordo em ROS 2: o **Cartographer** para SLAM, o **Navigation2** para planejamento e controle, o **YOLOv11** com uma câmera de profundidade para encontrar vítimas e o meu nó de **exploração por fronteiras**, que decide para onde ir em seguida.

## 1. Arquitetura do sistema e modos de tarefa {#architecture}

{% include svg_figure.liquid name="vehicle_arch" caption="Arquitetura do sistema. O Jetson (host) executa toda a pilha ROS 2 e se comunica com os sensores por USB; o STM32 (escravo) aciona os motores e lê a IMU por IIC, e as duas placas se comunicam por UART." %}

O robô trabalha em dois modos. No **modo de exploração**, ele mapeia um edifício desconhecido e registra as vítimas ao longo do caminho; no **modo de resgate**, ele recarrega esse mapa e vai até cada vítima registrada, uma após a outra.

{% include svg_figure.liquid name="vehicle_modes" caption="Fluxo de tarefas dos dois modos. A exploração repete mapa → fronteira → navegação até não restar nenhuma fronteira útil, enquanto a detecção de vítimas roda em paralelo; o resgate se localiza no mapa salvo com AMCL e visita, uma a uma, as posições de vítimas armazenadas." %}

## 2. Integração de hardware {#hardware}

<figure class="fig">
  <img src="{{ '/assets/img/vehicle/robot.jpg' | relative_url }}" alt="A plataforma robótica de esteiras com um LiDAR no topo e uma câmera de profundidade na frente" style="display: block; width: 100%; max-width: 520px; margin: 0 auto; border-radius: 6px;">
  <figcaption>A plataforma: um chassi de esteiras que carrega o Jetson, um LiDAR 2D no topo e uma câmera RGB-D na frente.</figcaption>
</figure>

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Componente</th><th>Função</th><th>Especificação principal</th></tr></thead>
  <tbody>
    <tr><td><strong>Jetson Orin NX 16GB</strong></td><td>Computador de bordo, executa todo o ROS 2</td><td>Ubuntu 22.04 · ROS 2 Humble</td></tr>
    <tr><td><strong>RPLIDAR C1</strong></td><td>LiDAR 2D para SLAM e costmaps</td><td>ToF · alcance de 0,05–12 m · varredura de 8–12 Hz</td></tr>
    <tr><td><strong>Orbbec Astra Pro Plus</strong></td><td>Câmera RGB-D para detecção de vítimas</td><td>Profundidade 0,6–8 m · até 640×480 @ 30 fps · FOV RGB 66,01° × 40,2°</td></tr>
    <tr><td><strong>STM32F407VET6 + MPU6050</strong></td><td>Controle dos motores e IMU</td><td>Cortex-M4 · 168 MHz</td></tr>
    <tr><td><strong>Motores CC MG513</strong></td><td>Tração por esteiras</td><td>Até 1,1 m/s · carga útil de 3 kg</td></tr>
  </tbody>
</table>
</div>

## 3. Detecção de vítimas e localização 3D {#localization}

Uma caixa delimitadora não basta para situar uma pessoa no mapa: seus cantos caem sobre o chão e a parede ao fundo, de modo que a profundidade dentro dela é, em grande parte, de fundo. Por isso, o detector usa **segmentação do YOLOv11**, e apenas os pixels de profundidade dentro da máscara da pessoa são utilizados.

{% include svg_figure.liquid name="vehicle_localize" caption="Localização de vítimas. A máscara de segmentação seleciona os pixels da pessoa na imagem de profundidade alinhada; um filtro de mediana remove ruído e valores atípicos, e a média do que resta é a distância d_tar. A posição horizontal do centro da máscara fornece o ângulo θ_off, e a pose do robô obtida da odometria leva o ponto do referencial da câmera para o mapa." %}

Com $$x_{cen}$$ o centro horizontal da máscara, $$W_{img}$$ a largura da imagem e $$\theta_{FOV}$$ o campo de visão horizontal da câmera:

$$\theta_{off} = \frac{2x_{cen} - W_{img}}{2W_{img}} \cdot \theta_{FOV}$$

$$x_c = d_{tar}\sin\theta_{off}, \qquad y_c = d_{tar}\cos\theta_{off}$$

Cada posição é salva junto com o mapa, e esses são os objetivos para os quais o modo de resgate seguirá depois.

## 4. Ponte de odometria do SLAM {#odometry}

O Cartographer fornece a pose do robô como transformações TF, enquanto os nós de navegação e localização esperam um fluxo `nav_msgs/Odometry` com velocidades. Um pequeno nó ponte converte um no outro:

1. Consultar `map → odom` e `odom → base_link` e compor a pose do robô, $$T_{mb} = T_{mo} \cdot T_{ob}$$, obtendo a posição $$p = [x, y, z]^T$$ e o quatérnio de orientação $$q$$.
2. Converter $$q$$ em roll, pitch e yaw.
3. Derivar no tempo: $$v(t) \approx \dfrac{p_{mb}(t) - p_{mb}(t_{prev})}{\Delta t}$$, e a taxa de guinada a partir da diferença de yaw com ajuste de ciclo.
4. Publicar `/odometry/filtered` com pose, twist e covariância.

## 5. Exploração por fronteiras otimizada {#frontier}

A exploração clássica por fronteiras vai até a fronteira mais próxima, o que desperdiça tempo com pequenos bolsões e obriga a voltar pelo mesmo caminho no mapa. Meu nó pontua cada fronteira comparando **quanto espaço desconhecido ela revelaria** com **a distância que o robô precisa percorrer** para alcançá-la:

1. **Pré-processamento** — assinar a grade de ocupação do Cartographer e remodelá-la como um array 2D.
2. **Detecção de fronteiras** — aplicar detecção de bordas de Canny na fronteira entre o espaço livre conhecido e o espaço desconhecido.
3. **Decisão** — escolher a fronteira com o melhor equilíbrio entre ganho e custo e enviá-la ao Nav2 como o próximo objetivo.

$$I_f = \sum_{c \,\in\, N(f,r),\ c\ \text{unknown}} w_c, \qquad D_f = d_{path}(p, f)$$

$$f^* = \arg\max_{f \in F} \left( w_1 I_f - w_2 D_f \right)$$

$$I_f$$ soma as células desconhecidas ponderadas dentro do raio $$r$$ da fronteira $$f$$; $$D_f$$ é o comprimento do caminho a partir da posição do robô $$p$$; $$w_1, w_2$$ definem o equilíbrio.

{% include svg_figure.liquid name="vehicle_loop" caption="Laço de exploração. A cada 2 s o mapa é reconstruído e as fronteiras são extraídas ao longo do limite do espaço livre conhecido; a fronteira com a melhor pontuação de ganho de informação versus custo de deslocamento torna-se o próximo objetivo do Nav2, e as pontuações são atualizadas à medida que o mapa cresce — uma exploração constante, sem caminhos redundantes." %}

<figure class="fig">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <img src="{{ '/assets/img/vehicle/frontier_map.jpg' | relative_url }}" alt="Mapa de visualização de fronteiras: fronteiras, robô, fronteira escolhida e vítimas localizadas" style="flex: 557; min-width: 0; border-radius: 4px;">
    <img src="{{ '/assets/img/vehicle/frontier_rviz.jpg' | relative_url }}" alt="Visão do RViz no mesmo instante, com o mapa do Cartographer e o costmap do Nav2" style="flex: 557; min-width: 0; border-radius: 4px;">
  </div>
  <figcaption>O mesmo instante de uma execução em duas visões. À esquerda, o mapa de fronteiras: as linhas vermelhas são fronteiras, o ponto azul-escuro é o robô, o ponto verde é a fronteira escolhida e os pontos laranja são vítimas localizadas. À direita, o RViz com o mapa do Cartographer e o costmap inflado do Nav2.</figcaption>
</figure>

## 6. Experimentos de campo {#experiments}

Um resgate real ocorre em um espaço grande e complexo, sob pressão de tempo, por isso o teste faz uma pergunta simples: **qual área o robô consegue vasculhar em cinco minutos?** Ele foi executado em três ambientes internos com layouts diferentes, sob três limites de velocidade, com três execuções cada — 27 execuções no total.

{% include svg_figure.liquid name="vehicle_sites" caption="Os três locais de teste (acima) e um mapa construído em cinco minutos para cada limite de velocidade. Os mapas mostram apenas a forma e não estão desenhados em uma escala comum. O branco é espaço livre explorado, o cinza é desconhecido, o preto marca obstáculos e as linhas vermelhas são fronteiras; os pontos laranja são vítimas localizadas, o ponto azul é o robô e o ponto verde é a próxima fronteira." %}

{% include svg_figure.liquid name="vehicle_area" caption="Área vasculhada em cinco minutos. Cada ambiente responde de forma diferente a um limite de velocidade mais alto." %}

**O que os números dizem.** O melhor limite de velocidade depende do layout. No **corredor longo e aberto da área de ensino**, um robô mais rápido simplesmente cobre mais terreno. No **corredor estreito do dormitório**, as curvas e as passagens apertadas limitam o ganho quando o limite passa de 0,6 m/s. No **laboratório congestionado**, 0,9 m/s não explora mais do que 0,6 m/s. Um único limite de velocidade ajustado à mão é, portanto, um compromisso.

## 7. Conclusões

Simples para os padrões de hoje, mas um ciclo completo em robô real, construído a partir de peças individuais — sensores, controle embarcado, SLAM, navegação, percepção e tomada de decisão — e as habilidades de implantação usadas em todos os projetos posteriores começaram aqui.

Os experimentos também apontaram o que viria a seguir. A tese propôs duas direções: ajustar online, com RL livre de modelo, parâmetros de exploração como o limite de velocidade, em vez de ajustá-los à mão, e substituir a pilha modular baseada em LiDAR por RL de ponta a ponta, baseado em modelo, apenas a partir da visão. A navegação baseada em aprendizado é a linha que minha pesquisa posterior seguiu.
