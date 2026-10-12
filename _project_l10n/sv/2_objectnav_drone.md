---
lang: sv
project: 2_objectnav_drone
title: "AION: Objektmålnavigering med drönare inomhus"
source_hash: 2dc0fa747eda
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2601.15614" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2601.15614
  </a>
</p>

<nav class="contrib">
  <p>Vad jag gjorde (andraförfattare) · klicka på ett kort för att hoppa dit</p>
  <ol>
    <li><a href="#framework"><strong>Ramverk med två policyer</strong><span>Utforska när målet inte syns</span></a></li>
    <li><a href="#exploration"><strong>Utforskningspolicy</strong><span>Djupbaserad signal för öppna ytor + belöningar</span></a></li>
    <li><a href="#evaluation"><strong>Utvärdering</strong><span>AI2-THOR + IsaacSim med flera rum</span></a></li>
  </ol>
</nav>

## Demo

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/img/aion_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/aion_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

## Översikt

Objektmålnavigering (ObjectNav) kräver att en agent självständigt utforskar en okänd miljö och navigerar mot målobjekt som anges med en semantisk etikett. Tidigare arbeten har huvudsakligen studerat zero-shot-ObjectNav med 2D-rörelse, medan utvidgningen till flygande plattformar med 3D-rörelse är fortfarande föga utforskad. Flygande robotar erbjuder bättre manövrerbarhet och effektivare sökning, men medför också nya utmaningar för rumsuppfattning, dynamisk styrning och säkerhet. I den här artikeln föreslår vi AION för visionsbaserad flygande ObjectNav utan extern lokalisering eller globala kartor. AION är ett end-to-end-ramverk med två policyer för förstärkningsinlärning (RL) som skiljer utforskning från målsökande beteende i två specialiserade policyer. Vi utvärderar AION på referensmiljön AI2-THOR och prövar dessutom dess realtidsprestanda i IsaacSim med högkvalitativa drönarmodeller. Experimenten visar att AION uppnår överlägsna resultat över ett brett urval mått för utforskning, navigeringseffektivitet och säkerhet.

## Detaljer

**1. Uppgift**

Objektmålnavigering inomhus för UAV:er med **3D-rörelse**: drönaren ska självständigt utforska en okänd miljö och navigera mot ett målobjekt som anges med en semantisk etikett (t.ex. "laptop", "microwave"), utan förhandskarta eller extern lokalisering.

**Min roll:** Jag utformade, tränade och validerade utforskningspolicyn.

**Varför två policyer:** tidigare arbeten använder en enda målsökande policy (LSTM + CLIP-justering mellan text och bild). Det räcker i AI2-THOR, där rummen är små och målet oftast syns efter en sväng; men när målet finns i ett annat rum har CLIP inget att justera mot och agenten snurrar på stället. Därför delar vi upp beteendet efter om målet är i sikte, utvidgar det till 3D-rörelse för drönare och skalar upp från enstaka rum till miljöer med flera rum.

**2. Ramverk**
{: #framework}

Ett RL-ramverk med två policyer som växlar mellan två lägen beroende på om målet syns:

- **Utforskningsläge** — maximera täckningen av okänt utrymme
- **Målsökningsläge** — visuell styrning (visual servoing) mot det upptäckta målobjektet

<div class="media-row">
  <div>
    <img src="/assets/img/p2_model_arch.jpg" alt="AION:s arkitektur med två policyer">
  </div>
  <div>
    <img src="/assets/img/p2_visual_input.jpg" alt="Djupbaserad extraktion av ROI">
  </div>
</div>

**3. Utforskningsläge**
{: #exploration}

**Indata:**
Djupkarta + ROI (Region of Interest). ROI:n markerar öppna, farbara områden i djupbilden — likt hur människor instinktivt blickar mot öppna ytor när de navigerar. ROI:n extraheras med OpenCV-baserade metoder och ger en riktningssignal (tyngdpunktens position $$(d_x, d_y)$$ och medeldjup $$\bar{z}$$) snarare än absolut information om okänt utrymme.

**Belöningar:**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$: belöning för att röra sig mot öppet utrymme
- $$R_{center}$$: straff för girningsavvikelse från ROI:ns tyngdpunkt
- $$R_{safe}$$: straff för kollision / närhet till hinder
- plus en bonus för täckt yta

Att mata en LSTM direkt med rå RGB-D ger inget utforskande beteende; det är ROI-signalen som ger den rekurrenta policyn en tydlig riktningskänsla, utan odometri eller karta. Så vitt vi vet är detta den första rent visionsbaserade, kartfria utforskningspolicyn för flygande robotar.

**4. Målsökningsläge**

**Indata:**
RGB-bild + fryst CLIP-textinbäddning (justerar text- och bildegenskaper för zero-shot-objektigenkänning) + begränsningsruta för objekt/klass.

**Belöningar:**

$$r_t^G = R_{dist} + R_{bbox} + R_{parent} + R_{suc} - R_{collision}$$

- $$R_{dist}$$: belöning för att minska det euklidiska avståndet till målet
- $$R_{bbox}$$: belöning för att centrera och förstora målets begränsningsruta i synfältet (tyder på att objektet närmar sig)
- $$R_{parent}$$: belöning för överordnad klass — t.ex. ger ett skrivbord en delbelöning om målet är en laptop på det skrivbordet
- $$R_{suc}$$: belöning för lyckad uppgift
- $$R_{collision}$$: straff för kollision

**5. Åtgärdsrum**

Diskreta **3D**-åtgärder — framåt, sväng vänster/höger, stiga, sjunka med mera.

**6. Utvärdering**
{: #evaluation}

Utvärderad i två simulatorer: AI2-THOR (standardreferens med uppdelning i sedda/osedda objekt) och IsaacSim (större miljöer med flera rum där målet kan finnas i ett annat rum).

Enstaka rum i AI2-THOR kan inte testa utforskning — målet syns ofta redan från start — så vi byggde en utvärdering med flera rum i IsaacSim (Chemistry Lab, Beechwood, Ihlen) där målen placerades i rum som inte syns från start. Metoder med enbart en målsökande policy snurrar på stället; med utforskningspolicyn styr drönaren mot öppet utrymme och hittar målet över rumsgränserna.

{% include svg_figure.liquid name="aion_thor" caption="AI2-THOR-benchmark på två objektuppdelningar. AION leder i alla mått på båda uppdelningarna; på den osedda 18/4-uppdelningen förbättras SR med 4,3 poäng och SPL med 3,5 jämfört med MJO." %}

{% include svg_figure.liquid name="aion_isaac" caption="Utvärdering över scener i IsaacSim i tre scener med flera rum och högkvalitativa drönarmodeller. Varje punkt är ett försök (fem per objekt och scen); AION lyckas i 52 av 60 försök, mot 40 och 35 för utforskning kombinerad med MJO respektive SSNet." %}

<div class="media-row">
  <div>
    <img src="/assets/img/p2_isaac.jpg" alt="IsaacSim-scener och målobjekt">
  </div>
  <div>
    <img src="/assets/img/p2_exploration_beechwood.png" alt="Utforskningsbanor i Beechwood">
  </div>
</div>
