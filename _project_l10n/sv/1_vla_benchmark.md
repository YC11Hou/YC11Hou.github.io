---
lang: sv
project: 1_vla_benchmark
title: "LangGap: Ett benchmark för språkförståelse hos VLA-modeller"
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
  <p>Vad jag gjorde (förstaförfattare) · klicka på ett kort för att hoppa dit</p>
  <ol>
    <li><a href="#benchmark"><strong>Utformning av benchmarket</strong><span>99 uppgifter · 4 perturbationsdimensioner</span></a></li>
    <li><a href="#data"><strong>Datainsamling</strong><span>16 uppgifter × 150 skriptade demonstrationer</span></a></li>
    <li><a href="#training"><strong>Modellträning</strong><span>π0.5 LoRA · en enskild uppgift 0% → 90%</span></a></li>
    <li><a href="#results"><strong>Resultatanalys</strong><span>93.8% → 21.4% · 4 VLA-modeller</span></a></li>
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

## Översikt

Vision-Language-Action-modeller (VLA) uppnår över 95% framgång på standardbenchmarks. Våra systematiska experiment visar dock att dagens främsta VLA-modeller i stor utsträckning ignorerar språkliga instruktioner. Tidigare arbeten saknar (1) systematisk diagnostik med semantiska perturbationer, (2) ett benchmark som genom sin konstruktion tvingar fram språkförståelse och (3) språkligt varierad träningsdata. Den här artikeln konstruerar benchmarket LangGap, baserat på en fyrdimensionell metod för semantisk perturbation -- instruktionernas semantik varieras medan bordets uppställning hålls fast -- och blottlägger brister i språkförståelsen hos π0.5. Befintliga benchmarks som LIBERO tilldelar bara en uppgift per uppställning och utnyttjar därmed tillgängliga objekt och målplatser dåligt; LangGap diversifierar pick-and-place-uppgifterna fullt ut under identiska uppställningar och tvingar modellerna att verkligen förstå språket. Experimenten visar att riktad dataaugmentering delvis kan minska språkgapet -- framgångsgraden stiger från 0% till 90% vid träning på en enskild uppgift och från 0% till 28% vid träning på flera uppgifter. När den semantiska variationen hos de utökade uppgifterna ökar visar sig dock modellens inlärningskapacitet vara kraftigt otillräcklig; även tränade uppgifter går dåligt. Detta avslöjar en grundläggande utmaning för VLA-modeller att förstå varierade språkliga instruktioner -- just det som utgör LangGaps långsiktiga värde.

## Detaljer

**1. Benchmark och dataset**
{: #benchmark}

LangGap-benchmarket: totalt **99 uppgifter** — 40 ursprungliga LIBERO-uppgifter + 59 utökade uppgifter med semantiska perturbationer. Vi tillhandahåller ett träningsdataset med 56 uppgifter: 16 egeninsamlade utökade uppgifter (150 demonstrationer vardera) + 40 ursprungliga uppgifter (50 demonstrationer vardera), sammanlagt ca 4 100 trajektorier.

**2. Upptäckten av problemet**
{: #diagnosis}

När instruktionen i samma visuella scen ändras från "put bowl on plate" → "put bowl on stove" utför modellen ändå den ursprungliga handlingen (går till tallriken) och uppnår **0% framgång**. Det visar att VLA-modeller utför mönstermatchning från syn till handling snarare än verklig språkförståelse.

Vi utformar en fyrdimensionell diagnostik med semantiska perturbationer — Change Object, Change Target, Spatial Description och Drawer Action — där den visuella scenen är identisk och endast instruktionen ändras:

{% include svg_figure.liquid name="langgap_diagnosis" caption="Diagnos av π0.5 över 99 uppgifter och 1 980 episoder. Vår omkörning av de 40 ursprungliga uppgifterna stämmer med det officiella resultatet; de 59 utökade uppgifterna faller med 72,4 punkter. På Change Target misslyckas π0.5 i alla 260 episoder och ingen testad modell överstiger 2,3%, så felet är inte en artefakt av formuleringen — och det aggregerade resultatet döljer det." %}

<div class="media-row">
  <div>
    <img src="/assets/img/libero_suites_strip.png" alt="LIBERO-utvärderingssviter med annoteringar av perturbationer">
  </div>
</div>

**3. Designprinciper**
{: #design}

1. **Flera uppgifter i samma scen** — Flera uppgifter delar identiskt visuellt utgångstillstånd, vilket eliminerar visuella genvägar. En modell som ignorerar språket når högst 1/k framgång (k = antal uppgifter per scen).
2. **Uppdelning i träning/utvärdering på instruktionsnivå** — Träningsuppgifterna omfattar inte alla testuppgifter; den undanhållna utvärderingen innehåller osedda språkliga instruktioner för att testa kompositionell generalisering.
3. **Validering av fysisk genomförbarhet** — Alla utökade uppgifter har verifierats i LIBERO-simulatorn för att säkerställa att objekten går att gripa, nå och detektera.

**4. Pipeline för datainsamling**
{: #data}

- **Skalbar och varierad generering:** Vi använder en skriptad, vägpunktsbaserad insamlingspipeline för att effektivt och stabilt samla in 150 lyckade episoder per uppgift. Vägpunkterna är hårdkodade för varje enskild uppgift, men simulatorn introducerar små naturliga variationer i bordets begynnelseuppställning. Det gör de insamlade trajektorierna visuellt och dynamiskt varierade och hindrar modellerna från att bara memorera stela, identiska banor.
- **Hierarkisk reglerarkitektur:** Varje uppgift använder ett eget skript som delar upp pick-and-place-processen i flera sekventiella vägpunkter. På den högre nivån använder vi ren proportionell (P) reglering för att beräkna positionsfel och ge kontinuerliga handlingskommandon. Dessa kommandon utförs sedan av simulatorns lågnivåreglerare OSC (Operational Space Control) PD, vilket ger sömlös och mycket exakt kontinuerlig styrning.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_waypoints.jpg" alt="Vägpunktssekvens för en skriptad demonstration: hem, grepp, transport, placering" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Vägpunkternas timing i en skriptad demonstration (illustrativt): hem → ovanför objektet → grepp → lyft → ovanför målet → placering. OSC_POSE-regulator med positurfel per steg normaliserat till [−1, 1]; en episod behålls endast om den lyckas inom stegbudgeten.</p>

- **Varför skript i stället för teleoperation:** tidiga försök med teleoperation via mus var ryckiga, långsamma och inkonsekventa. Skript skrivna utifrån objektkoordinaterna i varje uppgifts BDDL-fil finjusterades för hand i simuleringen tills varje uppgift gick att gripa, nå och detektera — de resulterande handlingarna är rena och insamlingen är helt automatisk: ca 150 demonstrationer per uppgift (de officiella LIBERO-uppgifterna har 50), 16 uppgifter ≈ 2 400 demonstrationer.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_rollout_2x8.jpg" alt="Urval av skriptade demonstrationer" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Ett urval av de 2 400 skriptade demonstrationerna.</p>

**Finjustering: en enskild uppgift från 0% till 90%**
{: #training}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="/assets/img/langgap_before_after_poster.jpg">
    <source src="/assets/video/langgap_before_after.mp4" type="video/mp4">
  </video>
</div>
<p class="caption">Vänster: före träning — instruktionen säger "stove", men policyn placerar ändå skålen på tallriken. Höger: efter finjustering på de utökade data — skålen hamnar på spisen.</p>

- π0.5 med LoRA (r = 64) på ett enda RTX 4090.
- Checkpoints väljs utifrån rollouts, inte förlust: förlusten fortsätter att minska medan framgångsgraden är icke-monoton.
- Tränings- och testinstruktioner är ordagrant identiska utom för de 43 undanhållna uppgifterna, vars instruktioner är nya.

**5. Resultat**
{: #results}

{% include svg_figure.liquid name="langgap_benchmark" caption="Fullständigt benchmark: aktuella VLA-modeller på alla fyra LIBERO-sviter, ursprungliga jämfört med utökade uppgifter. Varje modell uppvisar ett stort språkgap; vår π0.5 finjusterad på 45 uppgifter förbättrar det utökade totalresultatet (22,8) och Change Target (0 → 6,2) samtidigt som den behåller 89,5 på de ursprungliga uppgifterna. De 43 undanhållna uppgifterna har aldrig tränats på." %}

{% include svg_figure.liquid name="langgap_progressive" caption="Progressiv validering med samma utökade data när antalet träningsuppgifter växer från 1 till 56. Memorering av en enskild uppgift når 90%, men vinsterna kollapsar när semantiskt olika uppgifter lärs in tillsammans; att blanda in de 40 officiella uppgifterna (56 uppgifter) återställer 27,5% medan språkgapet kvarstår." %}

**6. Långsiktigt värde**

När uppgifternas semantiska variation ökar visar sig modellens inlärningskapacitet vara kraftigt otillräcklig — även tränade uppgifter går dåligt. Detta avslöjar en grundläggande utmaning som är oberoende av arkitektur: alla testade modeller (π0.5, π0, π0-FAST, SmolVLA) uppvisar samma språkgap. LangGap är ett systematiskt diagnostiskt verktyg som förblir värdefullt när nya VLA-arkitekturer dyker upp, just för att språkgapet är ett ihållande problem som dagens träningsparadigm ännu inte har löst.
