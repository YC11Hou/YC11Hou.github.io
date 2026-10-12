---
lang: nl
project: 1_vla_benchmark
title: "LangGap: een benchmark voor taalbegrip van VLA-modellen"
source_hash: ceb66c896e84
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2603.00592" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2603.00592
  </a>
  <a href="/assets/pdf/LangGap-IROS2026-poster.pdf" target="_blank" rel="noopener">
    <i class="fa-solid fa-image"></i> Poster (IROS 2026)
  </a>
</p>

<nav class="contrib">
  <p>Wat ik deed (eerste auteur) · klik op een kaart om ernaartoe te springen</p>
  <ol>
    <li><a href="#benchmark"><strong>Benchmarkontwerp</strong><span>99 taken · 4 verstoringsdimensies</span></a></li>
    <li><a href="#data"><strong>Dataverzameling</strong><span>16 taken × 150 gescripte demo's</span></a></li>
    <li><a href="#training"><strong>Modeltraining</strong><span>π0.5 LoRA · enkele taak 0% → 90%</span></a></li>
    <li><a href="#results"><strong>Resultaatanalyse</strong><span>93.8% → 21.4% · 4 VLA-modellen</span></a></li>
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

## Overzicht

Vision-Language-Action-modellen (VLA) behalen op standaardbenchmarks een slagingspercentage van meer dan 95%. Uit systematische experimenten blijkt echter dat de huidige state-of-the-art VLA-modellen taalinstructies grotendeels negeren. Eerder werk mist: (1) systematische diagnostiek met semantische verstoringen, (2) een benchmark die taalbegrip door het ontwerp afdwingt en (3) taalkundig gevarieerde trainingsdata. Dit artikel presenteert de LangGap-benchmark, gebaseerd op een vierdimensionale methode van semantische verstoringen -- de semantiek van de instructie varieert terwijl de tafelindeling gelijk blijft -- en legt zo tekortkomingen in het taalbegrip van π0.5 bloot. Bestaande benchmarks zoals LIBERO wijzen per indeling slechts één taak toe, waardoor beschikbare objecten en doellocaties onderbenut blijven; LangGap diversifieert pick-and-place-taken volledig binnen identieke indelingen, zodat modellen taal echt moeten begrijpen. Experimenten tonen aan dat gerichte data-augmentatie de taalkloof gedeeltelijk kan dichten: het slagingspercentage stijgt van 0% naar 90% bij training op één taak en van 0% naar 28% bij training op meerdere taken. Naarmate de semantische diversiteit van de uitgebreide taken toeneemt, blijkt de leercapaciteit van het model echter ernstig tekort te schieten; zelfs getrainde taken worden slecht uitgevoerd. Dit wijst op een fundamentele uitdaging voor VLA-modellen bij het begrijpen van uiteenlopende taalinstructies -- en dat is precies de waarde van LangGap op lange termijn.

## Details

**1. Benchmark en dataset**
{: #benchmark}

De LangGap-benchmark telt in totaal **99 taken**: 40 oorspronkelijke LIBERO-taken + 59 uitgebreide taken met semantische verstoringen. We leveren een trainingsdataset van 56 taken: 16 zelf verzamelde uitgebreide taken (elk 150 demo's) + 40 oorspronkelijke taken (elk 50 demo's), samen ongeveer 4.100 trajecten.

**2. Ontdekking van het probleem**
{: #diagnosis}

Wanneer de instructie in dezelfde visuele scène wordt veranderd van "put bowl on plate" → "put bowl on stove", voert het model nog steeds de oorspronkelijke handeling uit (het gaat naar het bord) en behaalt het **0% succes**. Dit toont aan dat VLA's vooral patronen koppelen van beeld naar actie, in plaats van taal echt te begrijpen.

We ontwerpen een vierdimensionale diagnostiek met semantische verstoringen — Change Object, Change Target, Spatial Description en Drawer Action — waarbij de visuele scène identiek blijft en alleen de instructie wijzigt:

{% include svg_figure.liquid name="langgap_diagnosis" caption="Diagnose van π0.5 over 99 taken en 1.980 episodes. Onze herhaling van de 40 oorspronkelijke taken komt overeen met de officiële score; bij de 59 uitgebreide taken daalt de score met 72,4 punten. Bij Change Target faalt π0.5 in alle 260 episodes en scoort geen enkel geteste model hoger dan 2,3%; de mislukking is dus geen artefact van de formulering — en de totaalscore verbergt haar." %}

<div class="media-row">
  <div>
    <img src="/assets/img/libero_suites_strip.png" alt="LIBERO-evaluatiesuites met annotaties van de verstoringen">
  </div>
</div>

**3. Ontwerpprincipes**
{: #design}

1. **Meerdere taken in dezelfde scène** — Meerdere taken delen identieke visuele begintoestanden, waardoor visuele shortcuts wegvallen. Een model dat taal negeert, haalt hooguit een slagingspercentage van 1/k (k = aantal taken per scène).
2. **Train/eval-splitsing op instructieniveau** — De trainingstaken omvatten niet alle testtaken; de achtergehouden evaluatie bevat onbekende taalinstructies om compositionele generalisatie te toetsen.
3. **Validatie van fysieke haalbaarheid** — Alle uitgebreide taken zijn in de LIBERO-simulator geverifieerd, zodat de objecten grijpbaar, bereikbaar en detecteerbaar zijn.

**4. Pijplijn voor dataverzameling**
{: #data}

- **Schaalbare en diverse generatie:** We gebruiken een gescripte, op waypoints gebaseerde verzamelpijplijn om per taak efficiënt en stabiel 150 succesvolle episodes te verzamelen. Hoewel de waypoints per taak vastgelegd zijn, brengt de simulator lichte natuurlijke variaties aan in de begindeling van de tafel. Zo zijn de verzamelde trajecten visueel en dynamisch divers en onthouden modellen niet louter starre, identieke paden.
- **Hiërarchische regelarchitectuur:** Elke taak gebruikt een eigen script dat het pick-and-place-proces opdeelt in meerdere opeenvolgende waypoints. Op het hoge niveau passen we zuivere proportionele (P-)regeling toe om positiefouten te berekenen en continue actiecommando's uit te sturen. Die commando's worden vervolgens uitgevoerd door de OSC-PD-regelaar (Operational Space Control) van de simulator op laag niveau, wat een naadloze en zeer nauwkeurige continue besturing oplevert.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_waypoints.jpg" alt="Waypointreeks van een gescripte demonstratie: startpositie, grijpen, transporteren, plaatsen" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Waypointtiming van een gescripte demonstratie (ter illustratie): startpositie → boven het object → grijpen → optillen → boven het doel → plaatsen. OSC_POSE-regelaar met per stap een posefout genormaliseerd naar [−1, 1]; een episode wordt alleen bewaard als ze binnen het stappenbudget slaagt.</p>

- **Waarom scripts in plaats van teleoperatie:** eerste pogingen met teleoperatie via de muis waren schokkerig, traag en inconsistent. Scripts, geschreven op basis van de objectcoördinaten in het BDDL-bestand van elke taak, zijn in de simulatie met de hand afgestemd tot elke taak grijpbaar, bereikbaar en detecteerbaar was — de resulterende acties zijn schoon en de verzameling verloopt volledig automatisch: ~150 demo's per taak (de officiële LIBERO-taken hebben er 50), 16 taken ≈ 2.400 demo's.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_rollout_2x8.jpg" alt="Selectie van gescripte demonstratie-rollouts" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Een selectie uit de 2.400 gescripte demonstraties.</p>

**Fine-tuning: enkele taak van 0% naar 90%**
{: #training}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="/assets/img/langgap_before_after_poster.jpg">
    <source src="/assets/video/langgap_before_after.mp4" type="video/mp4">
  </video>
</div>
<p class="caption">Links: vóór de training — de instructie zegt "stove", maar het beleid plaatst de kom toch op het bord. Rechts: na fine-tuning op de uitgebreide data — de kom gaat op het fornuis.</p>

- π0.5 met LoRA (r = 64) op één enkele RTX 4090.
- Checkpoints worden gekozen op basis van rollouts, niet van de loss: de loss blijft dalen terwijl het slagingspercentage niet-monotoon verloopt.
- Trainings- en testinstructies zijn woordelijk identiek, behalve bij de 43 achtergehouden taken, waarvan de instructies nieuw zijn.

**5. Resultaten**
{: #results}

{% include svg_figure.liquid name="langgap_benchmark" caption="Volledige benchmark: recente VLA-modellen op alle vier de LIBERO-suites, oorspronkelijke versus uitgebreide taken. Elk model vertoont een grote taalkloof; ons op 45 taken gefinetunede π0.5 verbetert het totaal op de uitgebreide taken (22,8) en Change Target (0 → 6,2) en behoudt 89,5 op de oorspronkelijke taken. Op de 43 achtergehouden taken is nooit getraind." %}

{% include svg_figure.liquid name="langgap_progressive" caption="Progressieve validatie met dezelfde uitgebreide data naarmate het aantal trainingstaken groeit van 1 tot 56. Memorisatie van een enkele taak bereikt 90%, maar de winst stort in zodra semantisch verschillende taken samen worden geleerd; het bijmengen van de 40 officiële taken (56 taken) herstelt 27,5%, terwijl de taalkloof blijft bestaan." %}

**6. Waarde op lange termijn**

Naarmate de semantische diversiteit van de taken toeneemt, blijkt de leercapaciteit van het model ernstig tekort te schieten — zelfs getrainde taken worden slecht uitgevoerd. Dit wijst op een fundamentele uitdaging die onafhankelijk is van de architectuur: alle geteste modellen (π0.5, π0, π0-FAST, SmolVLA) vertonen dezelfde taalkloof. LangGap biedt een systematisch diagnostisch instrument dat waardevol blijft naarmate nieuwe VLA-architecturen verschijnen, juist omdat de taalkloof een hardnekkig probleem is dat de huidige trainingsparadigma's nog niet hebben opgelost.
