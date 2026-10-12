---
lang: pt
project: 3_vln_drone
title: "Navegação por Visão e Linguagem em Drone Autônomo"
source_hash: a77378003039
---

<p class="project-links">
  <a href="https://github.com/YC11Hou/habitat-aerial-nav" target="_blank" rel="noopener">
    <i class="fab fa-github"></i> Code: github.com/YC11Hou/habitat-aerial-nav
  </a>
</p>

<nav class="contrib">
  <p>O que eu fiz · clique em um cartão para ir à seção</p>
  <ol>
    <li><a href="#pipeline"><strong>Pipeline de trajetórias</strong><span>Lattice A* · decolagem → cruzeiro → pouso</span></a></li>
    <li><a href="#overview"><strong>Conjunto de dados</strong><span>90 cenas · mais de 10.000 trajetórias, código aberto</span></a></li>
  </ol>
</nav>

## Demonstração

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="/assets/img/vln_highlights_poster.jpg">
      <source src="/assets/video/vln_highlights.mp4" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video autoplay loop muted playsinline preload="metadata" poster="/assets/img/vln_overview_poster.jpg">
      <source src="/assets/video/vln_overview.webm" type="video/webm">
    </video>
  </div>
</div>

<div class="media-row">
  <div>
    <img src="/assets/img/p3_3dvln.jpg" alt="Visão egocêntrica durante a geração de trajetórias">
  </div>
  <div>
    <img src="/assets/img/p3_3stage_traj.jpg" alt="Trajetória em 3 etapas: decolagem, cruzeiro e pouso">
  </div>
</div>

## Visão geral {#overview}

Construí um pipeline robusto para gerar trajetórias de navegação 3D diversificadas no simulador Habitat, destinadas ao treinamento de políticas de navegação por visão e linguagem (VLN) em robôs aéreos.

**Motivação:** os conjuntos de dados de VLN existentes são voltados a robôs terrestres em grafos de navegação discretos; drones precisam de trajetórias contínuas de decolagem → cruzeiro → pouso em 3D, e esse conjunto de dados não existia, então o construímos do zero.

**Simulador:** Habitat com 90 cenas internas.

**Escala:** 90 cenas × 200–300 pares de origem e destino cada → **mais de 10.000** trajetórias 3D em três etapas com instruções em linguagem natural, disponibilizadas como código aberto no GitHub.

## Pipeline {#pipeline}

{% include svg_figure.liquid name="vln_pipeline" caption="Pipeline de geração em quatro etapas. O Lattice A* planeja sobre primitivas de movimento em (x, y, θ), de modo que o drone curva enquanto avança, em vez de fazer as curvas em ângulo reto do Grid A* (esboço abaixo, ilustrativo)." %}

1. **Geração de pares origem-destino** — Para cada uma das 90 cenas, gere de 200 a 300 pares aleatórios de origem e destino em 2D como pontos extremos da navegação.

2. **Planejamento de caminho de cruzeiro em 2D** — Determine uma altitude de cruzeiro constante adequada para cada cena e, em seguida, planeje um caminho 2D natural nessa altitude usando **Lattice A\***. Ao contrário do Grid A\* padrão, que produz curvas rígidas em ângulo reto, o Lattice A\* planeja sobre primitivas de movimento no espaço de estados contínuo $$(x, y, \theta)$$, produzindo caminhos suaves em que o agente curva enquanto avança. Heurística:

   $$H(s) = \frac{\|p - p_{goal}\|}{L} + \lambda \cdot |\Delta\theta|$$

   Isso penaliza curvas fechadas para garantir trajetórias de voo suaves e realistas.

3. **Montagem da trajetória 3D** — Acrescente um segmento de **decolagem** no início e um de **pouso** no fim de cada caminho de cruzeiro, formando uma trajetória 3D completa. Colete observações RGB-D ao longo de todo o percurso em formato de vídeo.

4. **Geração de instruções** — Use um modelo de vídeo para texto para gerar instruções de navegação em linguagem natural a partir dos vídeos de observação coletados, produzindo um conjunto de dados de VLN completo.

O projeto é deliberadamente simplificado — o drone não muda de altitude com frequência durante o voo —, mas a decolagem e o pouso combinados com instruções já são difíceis para os modelos atuais. O treinamento de políticas sobre o conjunto de dados é conduzido por colegas de laboratório.
