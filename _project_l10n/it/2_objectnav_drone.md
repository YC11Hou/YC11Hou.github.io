---
lang: it
project: 2_objectnav_drone
title: "AION: navigazione indoor aerea verso un oggetto obiettivo"
source_hash: 2dc0fa747eda
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2601.15614" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2601.15614
  </a>
</p>

<nav class="contrib">
  <p>Cosa ho fatto (secondo autore) · clicca su una scheda per saltare alla sezione</p>
  <ol>
    <li><a href="#framework"><strong>Framework a doppia policy</strong><span>Esplorare quando il bersaglio non è in vista</span></a></li>
    <li><a href="#exploration"><strong>Policy di esplorazione</strong><span>Indizio di regione aperta dalla profondità + ricompense</span></a></li>
    <li><a href="#evaluation"><strong>Valutazione</strong><span>AI2-THOR + IsaacSim multi-stanza</span></a></li>
  </ol>
</nav>

## Demo

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/img/aion_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/aion_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

## Panoramica

La navigazione verso un oggetto obiettivo (Object-Goal Navigation, ObjectNav) richiede che un agente esplori in autonomia un ambiente sconosciuto e raggiunga oggetti bersaglio indicati da un'etichetta semantica. Mentre i lavori precedenti hanno studiato soprattutto l'ObjectNav zero-shot con locomozione 2D, la sua estensione a piattaforme aeree con locomozione 3D resta poco esplorata. I robot aerei offrono una manovrabilità e un'efficienza di ricerca superiori, ma pongono anche nuove sfide in termini di percezione spaziale, controllo dinamico e garanzie di sicurezza. In questo articolo proponiamo AION per l'ObjectNav aerea basata sulla visione, senza ricorrere a localizzazione esterna né a mappe globali. AION è un framework di reinforcement learning (RL) end-to-end a doppia policy, che separa i comportamenti di esplorazione e di raggiungimento dell'obiettivo in due policy specializzate. Valutiamo AION sul benchmark AI2-THOR e ne verifichiamo inoltre le prestazioni in tempo reale in IsaacSim con modelli di drone ad alta fedeltà. I risultati sperimentali mostrano che AION ottiene prestazioni superiori su un'ampia gamma di metriche di esplorazione, efficienza di navigazione e sicurezza.

## Dettagli

**1. Compito**

Navigazione indoor verso un oggetto obiettivo per UAV con **locomozione 3D**: il drone deve esplorare in autonomia un ambiente sconosciuto e raggiungere un oggetto bersaglio indicato da un'etichetta semantica (ad es. "laptop", "microwave"), senza alcuna mappa preliminare né localizzazione esterna.

**Il mio ruolo:** ho progettato, addestrato e validato la policy di esplorazione.

**Perché due policy:** i lavori precedenti usano un'unica policy di raggiungimento dell'obiettivo (LSTM + allineamento testo–visione con CLIP). In AI2-THOR, dove le stanze sono piccole e il bersaglio è di solito visibile dopo una rotazione, questo basta; ma quando il bersaglio si trova in un'altra stanza, CLIP non ha nulla con cui allinearsi e l'agente gira su se stesso. Per questo separiamo il comportamento in base alla visibilità del bersaglio, lo estendiamo al moto 3D dei droni e passiamo da singole stanze ad ambienti multi-stanza.

**2. Framework**
{: #framework}

Un framework RL a doppia policy che passa da una modalità all'altra in base alla visibilità del bersaglio:

- **Modalità di esplorazione** — massimizzare la copertura dello spazio sconosciuto
- **Modalità di raggiungimento dell'obiettivo** — visual servoing verso l'oggetto bersaglio rilevato

<div class="media-row">
  <div>
    <img src="/assets/img/p2_model_arch.jpg" alt="Architettura a doppia policy di AION">
  </div>
  <div>
    <img src="/assets/img/p2_visual_input.jpg" alt="Estrazione della ROI basata sulla profondità">
  </div>
</div>

**3. Modalità di esplorazione**
{: #exploration}

**Input:**
Mappa di profondità + ROI (Region of Interest, regione di interesse). La ROI individua nell'immagine di profondità le aree aperte e percorribili, simulando il modo in cui gli esseri umani guardano d'istinto verso gli spazi aperti mentre si orientano. La ROI è estratta con metodi basati su OpenCV e fornisce un indizio direzionale (posizione del centroide $$(d_x, d_y)$$ e profondità media $$\bar{z}$$), anziché informazioni assolute sullo spazio sconosciuto.

**Ricompense:**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$: ricompensa per il movimento verso lo spazio aperto
- $$R_{center}$$: penalità per la deviazione di imbardata rispetto al centroide della ROI
- $$R_{safe}$$: penalità per collisione / prossimità agli ostacoli
- più un bonus per l'area coperta

Fornire direttamente RGB-D grezzo a un LSTM non produce un comportamento esplorativo; è l'indizio della ROI a dare alla policy ricorrente un forte senso della direzione, senza odometria né mappa. Per quanto ne sappiamo, questa è la prima policy di esplorazione per robot aerei puramente visiva e priva di mappa.

**4. Modalità di raggiungimento dell'obiettivo**

**Input:**
Immagine RGB + embedding testuale CLIP congelato (allinea le feature testuali e visive per il riconoscimento zero-shot di oggetti) + bounding box dell'oggetto/della classe.

**Ricompense:**

$$r_t^G = R_{dist} + R_{bbox} + R_{parent} + R_{suc} - R_{collision}$$

- $$R_{dist}$$: ricompensa per la riduzione della distanza euclidea dal bersaglio
- $$R_{bbox}$$: ricompensa per centrare e ingrandire la bounding box del bersaglio nel campo visivo (indica l'avvicinamento all'oggetto)
- $$R_{parent}$$: ricompensa per la classe genitore — ad es. raggiungere una scrivania dà una ricompensa parziale se il bersaglio è un laptop su quella scrivania
- $$R_{suc}$$: ricompensa per il successo del compito
- $$R_{collision}$$: penalità per collisione

**5. Spazio delle azioni**

Azioni discrete **3D** — avanti, rotazione a sinistra/destra, salita, discesa, ecc.

**6. Valutazione**
{: #evaluation}

La valutazione è condotta su due simulatori: AI2-THOR (benchmark standard con suddivisioni di oggetti visti/non visti) e IsaacSim (ambienti multi-stanza più grandi, in cui il bersaglio può trovarsi in un'altra stanza).

Le singole stanze di AI2-THOR non permettono di testare l'esplorazione — il bersaglio è spesso visibile fin dall'inizio — perciò abbiamo costruito in IsaacSim una valutazione multi-stanza (Chemistry Lab, Beechwood, Ihlen) con bersagli collocati in stanze non visibili dal punto di partenza. I metodi dotati solo della policy di raggiungimento dell'obiettivo girano su se stessi; con la policy di esplorazione, il drone si dirige verso lo spazio aperto e trova il bersaglio attraverso le stanze.

{% include svg_figure.liquid name="aion_thor" caption="Benchmark AI2-THOR su due suddivisioni di oggetti. AION è in testa in tutte le metriche su entrambe le suddivisioni; sulla suddivisione non vista 18/4 migliora MJO di 4,3 punti in SR e di 3,5 in SPL." %}

{% include svg_figure.liquid name="aion_isaac" caption="Valutazione cross-scena in IsaacSim in tre scene multi-stanza con modelli di drone ad alta fedeltà. Ogni punto è una prova (cinque per oggetto e scena); AION ha successo in 52 prove su 60, contro 40 e 35 per l'esplorazione combinata con MJO e SSNet." %}

<div class="media-row">
  <div>
    <img src="/assets/img/p2_isaac.jpg" alt="Scene di IsaacSim e oggetti bersaglio">
  </div>
  <div>
    <img src="/assets/img/p2_exploration_beechwood.png" alt="Traiettorie di esplorazione a Beechwood">
  </div>
</div>
