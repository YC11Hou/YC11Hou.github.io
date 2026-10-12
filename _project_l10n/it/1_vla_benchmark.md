---
lang: it
project: 1_vla_benchmark
title: "LangGap: un benchmark per la comprensione del linguaggio nei VLA"
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
  <p>Il mio contributo (primo autore) · clicca su una scheda per saltare alla sezione</p>
  <ol>
    <li><a href="#benchmark"><strong>Progettazione del benchmark</strong><span>99 task · 4 dimensioni di perturbazione</span></a></li>
    <li><a href="#data"><strong>Raccolta dei dati</strong><span>16 task × 150 dimostrazioni scriptate</span></a></li>
    <li><a href="#training"><strong>Addestramento del modello</strong><span>π0.5 LoRA · singolo task 0% → 90%</span></a></li>
    <li><a href="#results"><strong>Analisi dei risultati</strong><span>93.8% → 21.4% · 4 modelli VLA</span></a></li>
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

## Panoramica

I modelli Vision-Language-Action (VLA) raggiungono tassi di successo superiori al 95% sui benchmark standard. Tuttavia, attraverso esperimenti sistematici, abbiamo riscontrato che gli attuali modelli VLA allo stato dell'arte ignorano in larga misura le istruzioni linguistiche. I lavori precedenti mancano di: (1) una diagnostica sistematica basata su perturbazioni semantiche, (2) un benchmark che imponga per costruzione la comprensione del linguaggio e (3) dati di addestramento linguisticamente diversificati. Questo articolo costruisce il benchmark LangGap, basato su un metodo di perturbazione semantica a quattro dimensioni -- che varia la semantica dell'istruzione mantenendo fisso il layout del tavolo -- e porta alla luce le carenze di comprensione del linguaggio di π0.5. Benchmark esistenti come LIBERO assegnano un solo task a ciascun layout, sfruttando poco gli oggetti e le posizioni di destinazione disponibili; LangGap diversifica pienamente i task di pick-and-place a parità di layout, costringendo i modelli a comprendere davvero il linguaggio. Gli esperimenti mostrano che un'aumentazione mirata dei dati può colmare solo in parte il divario linguistico: il tasso di successo passa dallo 0% al 90% con l'addestramento su singolo task e dallo 0% al 28% con l'addestramento multi-task. Tuttavia, all'aumentare della diversità semantica dei task estesi, la capacità di apprendimento del modello si rivela gravemente insufficiente, e persino i task visti in addestramento hanno prestazioni scarse. Ciò evidenzia una sfida fondamentale per i modelli VLA nella comprensione di istruzioni linguistiche diversificate -- ed è proprio qui che risiede il valore a lungo termine di LangGap.

## Dettagli

**1. Benchmark e dataset**
{: #benchmark}

Il benchmark LangGap comprende **99 task** in totale: 40 task LIBERO originali + 59 task estesi con perturbazioni semantiche. Forniamo un dataset di addestramento di 56 task: 16 task estesi raccolti da noi (150 dimostrazioni ciascuno) + 40 task originali (50 dimostrazioni ciascuno), per un totale di circa 4.100 traiettorie.

**2. Individuazione del problema**
{: #diagnosis}

Cambiando l'istruzione da "put bowl on plate" → "put bowl on stove" nella stessa scena visiva, il modello esegue comunque l'azione originale (va verso il piatto) e ottiene **0% di successo**. Ciò rivela che i VLA eseguono un pattern matching tra visione e azione, anziché una reale comprensione del linguaggio.

Abbiamo progettato una diagnostica a quattro dimensioni di perturbazione semantica — Change Object, Change Target, Spatial Description e Drawer Action — mantenendo identica la scena visiva e modificando soltanto l'istruzione:

{% include svg_figure.liquid name="langgap_diagnosis" caption="Diagnosi di π0.5 su 99 task e 1.980 episodi. La nostra riesecuzione dei 40 task originali coincide con il punteggio ufficiale; i 59 task estesi perdono 72,4 punti. Su Change Target π0.5 fallisce tutti i 260 episodi e nessun modello testato supera il 2,3%: il fallimento non dipende dalla formulazione delle istruzioni — e il punteggio aggregato lo nasconde." %}

<div class="media-row">
  <div>
    <img src="/assets/img/libero_suites_strip.png" alt="Suite di valutazione LIBERO con annotazioni delle perturbazioni">
  </div>
</div>

**3. Principi di progettazione**
{: #design}

1. **Multi-task sulla stessa scena** — Più task condividono stati visivi iniziali identici, eliminando le scorciatoie visive. Un modello che ignora il linguaggio ottiene al massimo un tasso di successo di 1/k (k = numero di task per scena).
2. **Suddivisione addestramento/valutazione a livello di istruzione** — I task di addestramento non includono tutti i task di test; la valutazione su dati esclusi contiene istruzioni mai viste, per verificare la generalizzazione composizionale.
3. **Validazione della fattibilità fisica** — Tutti i task estesi sono stati verificati nel simulatore LIBERO per garantire che siano afferrabili, raggiungibili e rilevabili.

**4. Pipeline di raccolta dei dati**
{: #data}

- **Generazione scalabile e diversificata:** Usiamo una pipeline di raccolta scriptata basata su waypoint per ottenere in modo efficiente e stabile 150 episodi riusciti per task. Pur essendo i waypoint codificati a mano per ciascun task, il simulatore introduce lievi variazioni naturali nei layout iniziali del tavolo. Ciò rende le traiettorie raccolte diversificate sul piano visivo e dinamico, evitando che i modelli si limitino a memorizzare percorsi rigidi e identici.
- **Architettura di controllo gerarchica:** Ogni task usa uno script dedicato che scompone il processo di pick-and-place in più waypoint sequenziali. Al livello alto applichiamo un controllo puramente proporzionale (P) per calcolare gli errori di posizione ed emettere comandi di azione continui. Tali comandi sono poi eseguiti dal controllore PD OSC (Operational Space Control) di basso livello del simulatore, ottenendo un controllo continuo fluido e molto preciso.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_waypoints.jpg" alt="Sequenza di waypoint di una dimostrazione scriptata: posizione iniziale, presa, trasporto, rilascio" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Temporizzazione dei waypoint di una dimostrazione scriptata (illustrativa): posizione iniziale → sopra l'oggetto → presa → sollevamento → sopra la destinazione → rilascio. Controllore OSC_POSE con errore di posa per passo normalizzato in [−1, 1]; un episodio viene mantenuto solo se riesce entro il budget di passi.</p>

- **Perché script invece della teleoperazione:** i primi tentativi con la teleoperazione tramite mouse erano a scatti, lenti e incoerenti. Gli script, scritti a partire dalle coordinate degli oggetti nel file BDDL di ciascun task, sono stati messi a punto a mano in simulazione finché ogni task non è risultato afferrabile, raggiungibile e rilevabile — le azioni risultanti sono pulite e la raccolta è completamente automatica: circa 150 dimostrazioni per task (i task LIBERO ufficiali ne hanno 50), 16 task ≈ 2.400 dimostrazioni.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_rollout_2x8.jpg" alt="Esempio di rollout di dimostrazioni scriptate" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Un campione delle 2.400 dimostrazioni scriptate.</p>

**Fine-tuning: da 0% a 90% su un singolo task**
{: #training}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="/assets/img/langgap_before_after_poster.jpg">
    <source src="/assets/video/langgap_before_after.mp4" type="video/mp4">
  </video>
</div>
<p class="caption">A sinistra: prima dell'addestramento — l'istruzione dice «stove», ma la policy colloca comunque la ciotola sul piatto. A destra: dopo il fine-tuning sui dati estesi — la ciotola va sul fornello.</p>

- π0.5 con LoRA (r = 64) su una singola RTX 4090.
- I checkpoint sono scelti in base ai rollout, non alla loss: la loss continua a diminuire mentre il tasso di successo non è monotono.
- Le istruzioni di addestramento e di test sono identiche parola per parola, eccetto che per i 43 task esclusi, le cui istruzioni sono nuove.

**5. Risultati**
{: #results}

{% include svg_figure.liquid name="langgap_benchmark" caption="Benchmark completo: modelli VLA recenti su tutte e quattro le suite LIBERO, task originali contro task estesi. Ogni modello mostra un ampio divario linguistico; il nostro π0.5 sottoposto a fine-tuning su 45 task migliora il totale sui task estesi (22,8) e Change Target (0 → 6,2) mantenendo 89,5 sui task originali. I 43 task esclusi non sono mai stati usati in addestramento." %}

{% include svg_figure.liquid name="langgap_progressive" caption="Validazione progressiva con gli stessi dati estesi, al crescere del numero di task di addestramento da 1 a 56. La memorizzazione di un singolo task raggiunge il 90%, ma i guadagni crollano quando si apprendono insieme task semanticamente diversi; l'aggiunta dei 40 task ufficiali (56 task) riporta il tasso al 27,5%, mentre il divario linguistico resta." %}

**6. Valore a lungo termine**

All'aumentare della diversità semantica dei task, la capacità di apprendimento del modello si rivela gravemente insufficiente — persino i task visti in addestramento hanno prestazioni scarse. Ciò evidenzia una sfida fondamentale e indipendente dall'architettura: tutti i modelli testati (π0.5, π0, π0-FAST, SmolVLA) presentano lo stesso divario linguistico. LangGap offre uno strumento diagnostico sistematico che resta prezioso con l'emergere di nuove architetture VLA, proprio perché il divario linguistico è un problema persistente che gli attuali paradigmi di addestramento non hanno ancora risolto.
