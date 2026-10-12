---
lang: nl
project: 3_vln_drone
title: "Vision-Language Navigation op een autonome drone"
source_hash: a77378003039
---

<p class="project-links">
  <a href="https://github.com/YC11Hou/habitat-aerial-nav" target="_blank" rel="noopener">
    <i class="fab fa-github"></i> Code: github.com/YC11Hou/habitat-aerial-nav
  </a>
</p>

<nav class="contrib">
  <p>Wat ik heb gedaan · klik op een kaart om erheen te springen</p>
  <ol>
    <li><a href="#pipeline"><strong>Trajectpipeline</strong><span>Lattice A* · opstijgen → kruisvlucht → landen</span></a></li>
    <li><a href="#overview"><strong>Dataset</strong><span>90 scènes · 10.000+ trajecten, open source</span></a></li>
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
    <img src="/assets/img/p3_3dvln.jpg" alt="Egocentrisch beeld tijdens het genereren van trajecten">
  </div>
  <div>
    <img src="/assets/img/p3_3stage_traj.jpg" alt="Traject in 3 fasen: opstijgen, kruisvlucht, landen">
  </div>
</div>

## Overview {#overview}

Een robuuste pipeline gebouwd om gevarieerde 3D-navigatietrajecten te genereren in de Habitat-simulator, voor het trainen van vision-language navigation (VLN)-beleidsregels op luchtrobots.

**Motivatie:** bestaande VLN-datasets zijn bedoeld voor grondrobots op discrete navigatiegrafen; drones hebben continue trajecten in 3D nodig, van opstijgen via kruisvlucht tot landen, en zo'n dataset bestond niet, dus hebben we er zelf een van nul opgebouwd.

**Simulator:** Habitat met 90 binnenruimtes.

**Omvang:** 90 scènes × 200–300 start-doelparen per scène → **10.000+** driefasige 3D-trajecten met taalinstructies, open source op GitHub.

## Pipeline {#pipeline}

{% include svg_figure.liquid name="vln_pipeline" caption="Generatiepipeline in vier stappen. Lattice A* plant over bewegingsprimitieven in (x, y, θ), zodat de drone al vooruitvliegend draait in plaats van de rechte hoeken van Grid A* te maken (schets hieronder, ter illustratie)." %}

1. **Generatie van start-doelparen** — Genereer voor elk van de 90 scènes 200–300 willekeurige 2D-start-doelparen als eindpunten van de navigatie.

2. **2D-padplanning voor de kruisvlucht** — Bepaal per scène een geschikte constante kruishoogte en plan op die hoogte een natuurlijk 2D-pad met **Lattice A\***. In tegenstelling tot standaard Grid A\*, dat stijve rechte hoeken oplevert, plant Lattice A\* over bewegingsprimitieven in een continue toestandsruimte $$(x, y, \theta)$$. Het resultaat zijn vloeiende paden waarbij de agent draait terwijl hij vooruit beweegt. Heuristiek:

   $$H(s) = \frac{\|p - p_{goal}\|}{L} + \lambda \cdot |\Delta\theta|$$

   Dit bestraft scherpe bochten en zorgt zo voor vloeiende, realistische vliegtrajecten.

3. **Samenstelling van het 3D-traject** — Voeg aan elk kruispad een **opstijgsegment** vooraan en een **landingssegment** achteraan toe, zodat een volledig 3D-traject ontstaat. Verzamel langs het hele pad RGB-D-observaties als video.

4. **Instructiegeneratie** — Gebruik een video-naar-tekstmodel om uit de verzamelde observatievideo's natuurlijke-taalinstructies voor de navigatie te genereren, wat een complete VLN-dataset oplevert.

Het ontwerp is bewust vereenvoudigd — de drone verandert tijdens de vlucht niet vaak van hoogte — maar opstijgen en landen in combinatie met instructies zijn voor huidige modellen al moeilijk. Het trainen van beleidsregels op de dataset wordt voortgezet door labgenoten.
