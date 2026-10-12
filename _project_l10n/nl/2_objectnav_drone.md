---
lang: nl
project: 2_objectnav_drone
title: "AION: Aerial Indoor Object-Goal Navigation"
source_hash: 2dc0fa747eda
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2601.15614" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2601.15614
  </a>
</p>

<nav class="contrib">
  <p>Mijn bijdrage (tweede auteur) · klik op een kaart om te springen</p>
  <ol>
    <li><a href="#framework"><strong>Dual-policy-framework</strong><span>Verkennen wanneer het doel niet in beeld is</span></a></li>
    <li><a href="#exploration"><strong>Verkenningsbeleid</strong><span>Open-regio-aanwijzing uit diepte + beloningen</span></a></li>
    <li><a href="#evaluation"><strong>Evaluatie</strong><span>AI2-THOR + IsaacSim met meerdere kamers</span></a></li>
  </ol>
</nav>

## Demo

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/img/aion_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/aion_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

## Overzicht

Bij Object-Goal Navigation (ObjectNav) moet een agent zelfstandig een onbekende omgeving verkennen en naar doelobjecten navigeren die door een semantisch label zijn opgegeven. Eerder werk richtte zich vooral op zero-shot ObjectNav met 2D-voortbeweging; de uitbreiding naar luchtplatforms met 3D-bewegingsvrijheid is nog nauwelijks onderzocht. Vliegende robots bieden een grotere wendbaarheid en zoekefficiëntie, maar brengen ook nieuwe uitdagingen met zich mee op het gebied van ruimtelijke waarneming, dynamische besturing en veiligheid. In dit artikel presenteren we AION voor visiegebaseerde aerial ObjectNav zonder externe lokalisatie of globale kaarten. AION is een end-to-end dual-policy-framework voor reinforcement learning (RL) dat verkennend en doelgericht gedrag scheidt in twee gespecialiseerde beleidsfuncties. We evalueren AION op de AI2-THOR-benchmark en toetsen de realtime-prestaties daarnaast in IsaacSim met hoogwaardige dronemodellen. De experimentele resultaten laten zien dat AION over alle evaluatiemaatstaven voor verkenning, navigatie-efficiëntie en veiligheid de beste prestaties levert.

## Details

**1. Taak**

Object-goal navigation binnenshuis voor UAV's met **3D-voortbeweging**: de drone moet zelfstandig een onbekende omgeving verkennen en naar een doelobject navigeren dat door een semantisch label wordt opgegeven (bijv. "laptop", "magnetron"), zonder voorafgaande kaart of externe lokalisatie.

**Mijn rol:** ik heb het verkenningsbeleid ontworpen, getraind en gevalideerd.

**Waarom twee beleidsfuncties:** eerder werk gebruikt één enkel doelgericht beleid (LSTM + CLIP-uitlijning van tekst en beeld). Dat volstaat in AI2-THOR, waar de kamers klein zijn en het doel na één draai meestal zichtbaar is; maar als het doel in een andere kamer ligt, heeft CLIP niets om op uit te lijnen en draait de agent op zijn plaats rond. Daarom splitsen we het gedrag op naar de vraag of het doel in beeld is, breiden we het uit naar 3D-beweging voor drones en schalen we op van enkele kamers naar omgevingen met meerdere kamers.

**2. Framework**
{: #framework}

Een dual-policy-RL-framework dat op basis van de zichtbaarheid van het doel tussen twee modi schakelt:

- **Verkenningsmodus** — maximaliseer de ruimtelijke dekking in onbekende ruimte
- **Doelmodus** — visual servoing naar het gedetecteerde doelobject

<div class="media-row">
  <div>
    <img src="/assets/img/p2_model_arch.jpg" alt="Dual-policy-architectuur van AION">
  </div>
  <div>
    <img src="/assets/img/p2_visual_input.jpg" alt="ROI-extractie uit diepte">
  </div>
</div>

**3. Verkenningsmodus**
{: #exploration}

**Invoer:**
Dieptekaart + ROI (Region of Interest). De ROI markeert open, begaanbare gebieden in het dieptebeeld — naar het voorbeeld van hoe mensen bij het navigeren instinctief naar open ruimtes kijken. De ROI wordt met OpenCV-methoden bepaald en levert een richtingsaanwijzing (zwaartepuntpositie $$(d_x, d_y)$$ en gemiddelde diepte $$\bar{z}$$), in plaats van absolute informatie over onbekende ruimte.

**Beloningen:**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$: beloning voor beweging richting open ruimte
- $$R_{center}$$: straf voor yaw-afwijking ten opzichte van het ROI-zwaartepunt
- $$R_{safe}$$: straf voor botsingen en nabijheid van obstakels
- plus een bonus voor het bestreken oppervlak

Het rechtstreeks voeden van ruwe RGB-D aan een LSTM levert geen verkenningsgedrag op; de ROI-aanwijzing geeft het recurrente beleid een sterk richtingsgevoel, zonder odometrie of kaart. Voor zover wij weten is dit het eerste puur visiegebaseerde, kaartloze verkenningsbeleid voor vliegende robots.

**4. Doelmodus**

**Invoer:**
RGB-beeld + bevroren CLIP-tekstembedding (lijnt tekst- en beeldkenmerken uit voor zero-shot objectherkenning) + bounding box van object/klasse.

**Beloningen:**

$$r_t^G = R_{dist} + R_{bbox} + R_{parent} + R_{suc} - R_{collision}$$

- $$R_{dist}$$: beloning voor het verkleinen van de Euclidische afstand tot het doel
- $$R_{bbox}$$: beloning voor het centreren en vergroten van de bounding box van het doel in het gezichtsveld (wijst op het naderen van het object)
- $$R_{parent}$$: beloning voor de bovenliggende klasse — bijv. het bereiken van een bureau levert een deelbeloning op als het doel een laptop op dat bureau is
- $$R_{suc}$$: beloning voor geslaagde taakuitvoering
- $$R_{collision}$$: straf voor botsingen

**5. Actieruimte**

Discrete **3D**-acties — vooruit, links/rechts draaien, stijgen, dalen, enz.

**6. Evaluatie**
{: #evaluation}

Geëvalueerd op twee simulatoren: AI2-THOR (standaardbenchmark met zichtbare en onzichtbare objectsplits) en IsaacSim (grotere omgevingen met meerdere kamers waarin het doel zich in een andere kamer kan bevinden).

De afzonderlijke kamers van AI2-THOR kunnen verkenning niet testen — het doel is vaak vanaf het begin zichtbaar — daarom hebben we in IsaacSim een evaluatie met meerdere kamers opgezet (Chemistry Lab, Beechwood, Ihlen), waarbij de doelen in kamers liggen die vanaf de start niet zichtbaar zijn. Methoden met alleen een doelgericht beleid draaien op hun plaats rond; met het verkenningsbeleid vliegt de drone naar open ruimte en vindt hij het doel over meerdere kamers heen.

{% include svg_figure.liquid name="aion_thor" caption="AI2-THOR-benchmark op twee objectsplits. AION voert op beide splits alle maatstaven aan; op de onzichtbare 18/4-split verbetert het ten opzichte van MJO met 4,3 punten in SR en 3,5 in SPL." %}

{% include svg_figure.liquid name="aion_isaac" caption="Cross-scene-evaluatie in IsaacSim in drie scènes met meerdere kamers en hoogwaardige dronemodellen. Elke stip is één poging (vijf per object en scène); AION slaagt in 52 van de 60 pogingen, tegenover 40 en 35 voor verkenning gecombineerd met respectievelijk MJO en SSNet." %}

<div class="media-row">
  <div>
    <img src="/assets/img/p2_isaac.jpg" alt="IsaacSim-scènes en doelobjecten">
  </div>
  <div>
    <img src="/assets/img/p2_exploration_beechwood.png" alt="Verkenningstrajecten in Beechwood">
  </div>
</div>
