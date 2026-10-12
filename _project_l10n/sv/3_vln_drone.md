---
lang: sv
project: 3_vln_drone
title: "Vision-språknavigering för autonoma drönare"
source_hash: a77378003039
---

<p class="project-links">
  <a href="https://github.com/YC11Hou/habitat-aerial-nav" target="_blank" rel="noopener">
    <i class="fab fa-github"></i> Kod: github.com/YC11Hou/habitat-aerial-nav
  </a>
</p>

<nav class="contrib">
  <p>Vad jag gjorde · klicka på ett kort för att hoppa dit</p>
  <ol>
    <li><a href="#pipeline"><strong>Trajektoriepipeline</strong><span>Lattice A* · start → marschflygning → landning</span></a></li>
    <li><a href="#overview"><strong>Dataset</strong><span>90 scener · över 10 000 trajektorier, öppen källkod</span></a></li>
  </ol>
</nav>

## Demo

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
    <img src="/assets/img/p3_3dvln.jpg" alt="Egocentrisk vy under generering av trajektorier">
  </div>
  <div>
    <img src="/assets/img/p3_3stage_traj.jpg" alt="Trajektoria i tre steg: start, marschflygning, landning">
  </div>
</div>

## Översikt {#overview}

Jag byggde en robust pipeline som genererar varierade 3D-navigeringstrajektorier i simulatorn Habitat, för att träna policyer för vision-språknavigering (VLN) på flygande robotar.

**Motivation:** befintliga VLN-dataset gäller markrobotar på diskreta navigeringsgrafer; drönare behöver kontinuerliga trajektorier i 3D med start, marschflygning och landning, och något sådant dataset fanns inte, så vi byggde ett från grunden.

**Simulator:** Habitat med 90 inomhusscener.

**Omfattning:** 90 scener × 200–300 start–mål-par vardera → **över 10 000** tresteg-3D-trajektorier med språkinstruktioner, utgivna som öppen källkod på GitHub.

## Pipeline {#pipeline}

{% include svg_figure.liquid name="vln_pipeline" caption="Genereringspipeline i fyra steg. Lattice A* planerar över rörelseprimitiver i (x, y, θ), så att drönaren svänger medan den rör sig framåt i stället för att göra de rätvinkliga svängarna i Grid A* (skiss nedan, illustrativ)." %}

1. **Generering av start–mål-par** — För var och en av de 90 scenerna genereras 200–300 slumpmässiga 2D-par av start och mål som navigeringens ändpunkter.

2. **2D-planering av marschbanan** — Bestäm en lämplig konstant marschhöjd för varje scen och planera sedan en naturlig 2D-bana på den höjden med **Lattice A\***. Till skillnad från vanlig Grid A\*, som ger stela rätvinkliga svängar, planerar Lattice A\* över rörelseprimitiver i kontinuerligt tillståndsrum $$(x, y, \theta)$$ och ger släta banor där agenten svänger under framåtrörelse. Heuristik:

   $$H(s) = \frac{\|p - p_{goal}\|}{L} + \lambda \cdot |\Delta\theta|$$

   Den straffar skarpa svängar och ger därmed mjuka, realistiska flygbanor.

3. **Sammansättning av 3D-trajektorian** — Lägg till ett **startsegment** före och ett **landningssegment** efter varje marschbana, så att en fullständig 3D-trajektoria bildas. RGB-D-observationer längs hela banan samlas in som video.

4. **Generering av instruktioner** — En video-till-text-modell genererar naturliga språkliga navigeringsinstruktioner från de insamlade observationsvideorna, vilket ger ett komplett VLN-dataset.

Designen är medvetet förenklad — drönaren ändrar inte höjd ofta under flygningen — men start och landning i kombination med instruktioner är redan svåra för dagens modeller. Träningen av policyer på datasetet drivs vidare av labbkollegor.
