---
lang: it
project: 0_honor_internship
title: "Honor Humanoid: RL su robot reale per VLA"
source_hash: b1ae248d5011
---

Lavoro sul **robot umanoide** sviluppato internamente da Honor: raccolta dati in teleoperazione, replay, addestramento e deployment sul robot, insieme alla ricerca su algoritmi di **RL su robot reale** per modelli **Vision-Language-Action (VLA)** su task di manipolazione personalizzati.

<nav class="contrib">
  <p>Cosa ho fatto · clicca su una scheda per saltare alla sezione</p>
  <ol>
    <li><a href="#loop"><strong>Pipeline VLA end-to-end</strong><span>Raccolta → addestramento → deployment, laboratorio costruito da zero</span></a></li>
    <li><a href="#data-design"><strong>Progettazione dei dati offline</strong><span>4 categorie: tracking + recupero</span></a></li>
    <li><a href="#infra"><strong>Infrastruttura di addestramento con takeover umano</strong><span>Takeover · ciclo Actor–Learner–Robot · nuovo task ≈ 0% → 50%+</span></a></li>
    <li><a href="#algorithms"><strong>Algoritmi di RL su robot reale</strong><span>RECAP · RAPID · loco-manipolazione</span></a></li>
    <li><a href="#rove"><strong>Riproduzione di ROVE</strong><span>Successo autonomo 40% → 52%</span></a></li>
    <li><a href="#debugging"><strong>Debugging su robot reale</strong><span>6 bug, ciascuno individuato con una sonda</span></a></li>
  </ol>
</nav>

## Demo

### Inferenza on-robot sotto perturbazioni

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/inference_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/inference_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Rollout autonomi di pick-and-place sul robot reale mentre l'oggetto (a sinistra) e il cestino di destinazione (a destra) vengono spostati durante l'episodio: la policy riprende il tracking e completa il task. La mano non si ferma mai e la policy non aspetta che l'oggetto si assesti: ciò che ha appreso è il tracking visivo e la reiezione dei disturbi, non una singola traiettoria di pick-and-place.

### Progettazione dei dati per la robustezza

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/data_design_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/data_design.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Quattro categorie di dimostrazioni teleoperate: dimostrazioni standard, perturbazioni durante la fase di presa, perturbazioni durante la fase di deposito e recupero da stati di presa fallita, progettate perché la policy impari a recuperare, non solo a ripetere.

### SFT su robot reale: prima e dopo

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Un task che la policy addestrata offline non riusciva a eseguire viene appreso sul robot attraverso il ciclo di apprendimento su robot reale: i dati del takeover umano rifluiscono nell'addestramento e la quota di takeover cala man mano che vengono distribuiti nuovi checkpoint.

## 1. Pipeline VLA end-to-end {#loop}

Il laboratorio di Shanghai è stato allestito da zero dopo il mio arrivo: configurazione del robot, due postazioni di teleoperazione (Pico VR e motion capture), formazione degli operatori addetti alla raccolta dati e pipeline di addestramento. Il task è un pick-and-place (bottiglia → cestino) con un'unica istruzione fissa.

{% include svg_figure.liquid name="honor_pipeline" caption="Pipeline end-to-end su robot reale. GR00T N1.7 (3B) viene post-addestrato con il backbone visione-linguaggio congelato; l'azione a 37 dimensioni è selezionata da uno stato del robot a 115 dimensioni. Non c'è un validation set: i checkpoint sono salvati ogni 2K step e scelti tramite rollout sul robot; la loss raggiunge un plateau dopo circa 15K step." %}

{% include svg_figure.liquid name="honor_chunk" caption="Passaggio di consegne tra action chunk in inferenza. Il chunk successivo viene richiesto quando restano 15 step; le azioni diventate obsolete durante l'inferenza vengono scartate e la sovrapposizione è raccordata con un cross-fade lineare, così il robot non ha scatti tra un chunk e l'altro." %}

**Sul robot**, la fase di deposito non fallisce quasi mai: la policy tiene il passo anche quando il cestino viene trascinato rapidamente. I fallimenti di presa correlano con la posizione dell'oggetto; l'origine è nei dati (postura fissa, nessun movimento locale durante la raccolta, quindi il modello non sviluppa mai un senso della distanza) e non nella precisione del braccio. Risultato: il laboratorio ha acquisito un ciclo di iterazione interno «raccolta → fine-tuning → validazione sul robot», senza dipendere da modelli forniti dall'esterno.

## 2. Progettazione dei dati offline {#data-design}

**Perché quattro categorie di dati.** Le categorie ①–③ (standard, perturbazione in fase di presa, perturbazione in fase di deposito) insegnano alla policy a _seguire_ un oggetto o un contenitore in movimento. La categoria ④ le insegna a _recuperare_: partendo dalla posa di sospensione subito dopo una presa mancata, la dimostrazione abbassa la mano, riprende l'oggetto e lo deposita. Senza di essa, la policy spesso non si accorge che la presa è fallita: solleva una mano vuota, la porta al cestino e «deposita» il nulla. Le quattro categorie sono approssimativamente bilanciate; la robustezza mostrata nella demo qui sopra deriva da questa progettazione dei dati, non dal tuning degli iperparametri.

## 3. Infrastruttura di addestramento su robot reale con takeover umano {#infra}

### 3.1 Takeover umano e pipeline di dati guidata dagli interventi {#takeover}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/takeover_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/takeover_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">Un teleoperatore prende il controllo a metà episodio e poi lo restituisce (velocità 3×, senza audio).</p>

**Takeover umano fluido.** Apprendere su robot reale richiede che un umano possa subentrare in qualsiasi momento senza che il robot scatti. Al takeover, il topic dei comandi VLA viene reindirizzato al topic di teleoperazione e il controller emette un _incremento_ rispetto all'ultima azione VLA, anziché gli angoli di giunto assoluti del teleoperatore.

{% include svg_figure.liquid name="honor_fsm" caption="Macchina a stati di commutazione e regola di output del takeover. I takeover vengono scritti anche nei dati, così ogni episodio sa quali frame provengono dall'umano." %}

**Pipeline di dati guidata dagli interventi.** Ogni episodio viene salvato in modo persistente e l'operatore può solo correggere al ribasso il classificatore di successo, mai promuovere un fallimento a successo; le decisioni del classificatore e le statistiche di falsi positivi/negativi vengono registrate insieme. Il buffer è un anello numpy limitato con bucket di successo/fallimento, FIFO con soft-delete e campionamento pesato (correzione di importanza PER), e un endpoint HTTP di revisione consente di ispezionare ogni episodio prima che raggiunga l'addestramento. In un altro round, 127 dei 138 episodi raccolti sono entrati nel buffer come successi (11 completamente autonomi, 116 con dimostrazioni di takeover).

{% include svg_figure.liquid name="honor_datapipe" caption="Dal robot al learner: ogni episodio, compresi i fallimenti, viene registrato, valutato e caricato; il learner suddivide gli episodi in bucket in base all'esito. In basso: composizione di un round di dati su robot reale (142–416 frame per episodio)." %}

### 3.2 Ciclo di apprendimento distribuito su robot reale {#online-loop}

**Ho riprodotto il ciclo di rejection sampling di Hi-ORS e l'ho portato da π0 + un braccio Dobot a GR00T N1.7 + un umanoide.** Tre macchine girano contemporaneamente.

{% include svg_figure.liquid name="honor_arch" caption="Architettura Actor–Learner–Robot. L'Actor esegue la policy sul robot, solo gli episodi riusciti raggiungono il Learner e il Learner rimanda all'Actor i pesi addestrabili ogni 1.000 step." %}

{% include svg_figure.liquid name="honor_gates" caption="Controlli prima che un episodio entri nell'addestramento. Il classificatore di successo è una ResNet18 su un singolo frame della camera sinistra con testa a un logit, addestrata con BCE + pos_weight su 572 episodi (split a livello di episodio, augmentation online, etichette derivate automaticamente dai segnali del gripper; F1 a livello di frame 0,976). Scatta solo dopo 20 frame consecutivi sopra 0,8: questa isteresi è stata aggiunta dopo la prima sessione su robot reale, in cui il classificatore dichiarava il successo entro 1–2 s e i falsi positivi riempivano il buffer. Le ancore di dimostrazioni di base in ogni batch proteggono dal forgetting." %}

### 3.3 Risultati dell'SFT su robot reale: un nuovo task da ≈ 0% a oltre il 50% in ~140 episodi {#results}

Quando la policy si blocca, l'operatore subentra tramite Pico; i dati del takeover fluiscono direttamente nel Learner e la quota di takeover funge da metrica in tempo reale. La **Scena 1** sposta la bottiglia a destra, dove i dati offline sono scarsi. La **Scena 2** scambia l'intera disposizione destra–sinistra (cestino a sinistra, bottiglia a destra), esattamente l'opposto di tutti i dati offline, perciò la baseline SFT offline è ≈ 0%.

{% include svg_figure.liquid name="honor_curve" caption="Quota di step teleoperati per episodio durante l'SFT su robot reale, con i checkpoint distribuiti all'Actor. Ogni aggiornamento del checkpoint è seguito da un calo del takeover; l'aumento intorno all'episodio 86 corrisponde al passaggio alla scena 2. Nella fase di test (checkpoint 5000–7000) la quota di takeover scende al 18,8%." %}

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Scena</th><th>Differenza rispetto ai dati offline</th><th>Episodi</th><th>SFT offline</th><th>Dopo l'SFT su robot reale</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Bottiglia a destra (scarsa nei dati offline)</td><td>20</td><td>non misurato</td><td><strong>55.0%</strong></td></tr>
    <tr><td>2</td><td>Cestino a sinistra, bottiglia a destra (disposizione speculare)</td><td>12</td><td>≈ 0%</td><td><strong>50.0%</strong></td></tr>
  </tbody>
</table>
</div>

Tasso di successo completamente autonomo. Perché un backbone congelato riesce comunque a imparare la disposizione speculare: la modalità di fallimento era _non muoversi affatto_ e non muoversi nella direzione sbagliata; la comprensione visiva era intatta, mancava solo la mappatura delle azioni.

## 4. Algoritmi di RL su robot reale {#algorithms}

### 4.1 Addestramento condizionato al vantaggio in stile RECAP {#recap}

Il rejection sampling è un caso degenere binario del vantaggio: tenere ogni successo, scartare ogni fallimento. **Ho portato su GR00T N1.7 l'etichettatura del vantaggio di π0.6 RECAP (come in RLinf)** così da usare _tutti_ i dati, con «buono vs. cattivo» come condizione in ingresso anziché come filtro: gli episodi falliti diventano campioni negativi invece di scarti.

{% include svg_figure.liquid name="honor_recap" caption="Pipeline in stile RECAP. La penalità di fallimento c_fail = 1000 supera la differenza tra il successo più lungo (1.000 frame) e il fallimento più corto (57 frame), quindi ogni fallimento si colloca sotto ogni successo. n = 20 step corrisponde all'orizzonte di 1 s del paper a 20 Hz. I negativi modellano solo il ramo CFG non condizionato." %}

{% include svg_figure.liquid name="honor_value_net" caption="Rete del valore. Il backbone GR00T resta congelato e non riceve gradienti; i token di immagine e di testo sono mediati (mean-pooling) separatamente perché i primi superano di gran lunga i secondi e una singola media diluirebbe il condizionamento linguistico. RLinf aggiunge un token CLS apprendibile e usa una singola testa lineare; il backbone GR00T non accetta embedding di input aggiuntivi, quindi facciamo pooling e aggiungiamo un hidden layer. Lo schizzo della distribuzione di atomi è illustrativo." %}

Finché V non è pronto, come ripiego si usano etichette basate su regole: tutti i frame di successo positivi, i frame autonomi dei fallimenti negativi e i 20 frame precedenti a ogni takeover sovrascritti come negativi. La rete del valore è addestrata separatamente e accettata solo se la Spearman ρ sugli episodi held-out (un episodio ogni 10) supera 0,55: il dry run ha raggiunto ρ = 0,647 (plateau 0,59) con loss 4,52 → 0,76, mentre un controllo con etichette rimescolate è rimasto a una ρ assoluta ≤ 0,26 e non ha soddisfatto il criterio, quindi il criterio è significativo. La concordanza tra etichette basate su V e basate su regole era appena 0,31, perciò la rete del valore resta il collo di bottiglia, e il confronto A/B su robot reale non è stato completato.

### 4.2 RAPID: adattamento rapido nello spazio del rumore {#rapid}

**RAPID** (_Rapid Adaptation from Physical Interventions via Diffusion-noise_), nello spirito di DSRL: addestrare un nuovo checkpoint richiede tempo, e finché non è pronto il robot non sa ancora eseguire il task. RAPID lascia congelati i pesi del VLA e sostituisce soltanto il rumore iniziale del flow matching, così una correzione appena fatta dall'umano può essere riutilizzata la volta successiva in cui compare uno stato simile. È stato integrato nell'inferenza on-robot a fine agosto.

{% include svg_figure.liquid name="honor_rapid" caption="RAPID. Offline, le correzioni umane vengono invertite attraverso la policy congelata fino al rumore iniziale che le riproduce (64 passi fini; l'Euler a 4 passi è troppo grossolano) e salvate in una memoria indicizzata per osservazione. In deployment, il rumore recuperato viene interpolato sfericamente con rumore gaussiano prima del normale campionamento di flow matching." %}

{% include svg_figure.liquid name="honor_dsbc_net" caption="Rete del rumore DSBC. Un piccolo MLP mappa direttamente la chiave di recupero sul rumore iniziale, sostituendo la ricerca del vicino più prossimo; il VLA resta congelato. H è l'orizzonte di azione di 40 step della action head di GR00T (30 step vengono eseguiti per inferenza); D è la sua dimensione d'azione." %}

{% include svg_figure.liquid name="honor_rapid_chart" caption="Validazione offline su 24 episodi di takeover di un task di conteggio. DSBC è in testa per ogni K (54,9–57,0); il recupero dalla memoria raggiunge solo 20 per K = 1–2 e 45–49 per K ≥ 4; il partial noising resta piatto a 37; memory_delta è sotto 8. La metrica è il guadagno DTW, non il tasso di successo su robot reale." %}

L'audit è stato **pre-registrato**: audit PASS; reversal CONDITIONAL (errore di ricostruzione 0,232, entro 0,10–0,30); spread declassato a fragile dopo una nuova esecuzione; transfer PASS (p ≈ 1e-21). Con questi criteri l'affermazione «il recupero vince per K < 10» è stata **scartata**: il disegno sperimentale ha respinto la mia stessa ipotesi. Il sistema è quindi convergente su DSBC come percorso principale, con il recupero dalla memoria come front end opzionale. I passi successivi erano distillare DSBC nella policy, ritirare gradualmente le voci di memoria e collegarlo al RL su robot reale.

### 4.3 Estensione alla loco-manipolazione {#loco}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/locomanip_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/locomanip_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">L'umanoide cammina autonomamente fino a un bancone e afferra una bottiglia: 7 clip su robot reale, velocità 5×, senza audio; i segni gialli sul pavimento sono riferimenti per il percorso di camminata.</p>

L'intero stack (takeover, ciclo di apprendimento su robot reale, RECAP e RAPID) è passato dal pick-and-place su tavolo a un task con camminata senza essere riscritto.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Dati di loco-manipolazione</th><th>Valore</th></tr></thead>
  <tbody>
    <tr><td>Episodi di camminata raccolti</td><td>507 episodi · 181K frame</td></tr>
    <tr><td>Conservati dopo 6 criteri di selezione</td><td>326 episodi</td></tr>
    <tr><td>Training set unito</td><td><strong>848 episodi · 306K frame (+71%)</strong></td></tr>
    <tr><td>Lunghezza mediana del percorso per episodio</td><td>0.32 m → <strong>3.2 m</strong></td></tr>
  </tbody>
</table>
</div>

**Sulle metriche, con onestà:** la fase di SFT su robot reale ha numeri completi (55% / 50%). Dopo il passaggio al task di locomozione, tutti i componenti sono stati implementati e integrati, ma su di esso non è stato ottenuto alcun miglioramento a livello di metriche: la maturità dello stack hardware e di locomozione whole-body all'epoca non consentiva una valutazione sistematica su robot reale.

## 5. Riproduzione di ROVE {#rove}

**Task.** L'umanoide sta fermo sul posto (piedi fissi, senza camminare) e prende un telefono con la mano: manipolazione fine in cui un piccolo disallineamento porta rapidamente a un takeover umano.

ROVE (XPENG, arXiv:2606.17011) mantiene lo scheletro di condizionamento al vantaggio di RECAP (§4.1) e cambia il modo in cui vengono valutati i takeover umani. L'ho riprodotto sopra la pipeline RECAP dietro un unico interruttore di algoritmo (il percorso RECAP predefinito resta identico bit per bit, verificato da self-test) e ho eseguito l'Algoritmo 1 del paper come ciclo offline: deployment e raccolta → return sensibili allo stadio → aggiornamento del valore → vantaggi ed etichette → SFT condizionato. Solo il primo passo richiede il robot; gli altri quattro girano con un unico comando.

### 5.1 Return sensibile allo stadio {#rove-return}

Con RECAP, un episodio salvato da un umano conta comunque come successo: il suo return aumenta di uno a ogni step fino a 0, quindi le azioni autonome che _hanno causato_ il takeover sembrano un progresso costante. L'unico rimedio è una regola fissa che etichetta come negativi i 20 frame prima di un takeover. ROVE divide un tale episodio in tre segmenti (esecuzione autonoma, adattamento, in cui l'umano sta ancora riportando il robot sulla giusta strada, e recupero) e assegna una penalità di fallimento C_fail in t_r, la fine dell'adattamento. Il segmento autonomo che ha portato al takeover ottiene così un punteggio da fallimento, mentre il recupero mantiene il suo normale return time-to-go.

{% include svg_figure.liquid name="honor_rove_return" caption="Return sensibile allo stadio (Eq. 2 del paper): −1 per step, C_fail in t_r, frame inattivi (l'operatore cambia modalità) rimossi. Se non annotato, t_r ripiega su takeover + 40 frame (2 s); l'ablation del paper perde 30 pp quando t_r è posto all'inizio del takeover, quindi il default pecca per eccesso di ritardo. C_fail deve superare l'intervallo più lungo nel pool positivo, altrimenti un episodio fallito otterrebbe un punteggio più alto di un recupero: il limite inferiore misurato su questi dati è 919, perciò C_fail = 1000 (il 500 del paper qui è troppo piccolo). I return coincidono bit per bit con il calcolo a mano su 38 episodi archiviati." %}

### 5.2 Stima ottimistica del valore (OVE) {#rove-ove}

La regressione Monte-Carlo semplice apprende il return _medio_. Negli stati che sfociano spesso in un takeover la media è già bassa, quindi l'azione che ha causato il takeover ottiene un vantaggio vicino a zero e non viene mai etichettata come negativa. OVE rifinisce la stessa testa scalare del valore, dopo il pre-addestramento MC, con un target TD a 16 step (da una copia EMA della rete) e una expectile loss con τ = 0,7, che penalizza le sottostime più delle sovrastime. V stima così quanto vale uno stato _quando le cose vanno bene_: gli stati pre-takeover hanno un valore alto, il loro return effettivo è basso e il vantaggio negativo ricade sulle azioni che hanno causato il takeover. Anche l'orizzonte del vantaggio è di 16 step, cioè un action chunk, l'unità a cui è associata l'etichetta, e il 40% superiore dei frame viene etichettato come positivo.

Ogni checkpoint del valore è vincolato dalla Spearman ρ sugli episodi held-out: la concordanza di rango tra V predetto e return effettivo (1 = stesso ordine). La fase MC deve raggiungere ρ ≥ 0,55 sull'intero pool; la fase OVE è valutata solo sugli episodi di successo (ρ ≥ 0,70), perché OVE si discosta per costruzione dal return medio sugli stati destinati al fallimento, quindi una ρ più bassa sull'intero pool è attesa e non è una regressione.

{% include svg_figure.liquid name="honor_rove_rho" caption="Spearman ρ held-out in tre esecuzioni di addestramento del valore (area ombreggiata: fase OVE). Rollout puliti: la ρ sull'insieme dei successi resta a 0,744–0,806 dopo il passaggio a OVE, mentre la ρ sull'intero pool scende da 0,735 a 0,69 come previsto; la soglia di 0,70 è stata fissata da questa esecuzione. Demo + rollout: la ρ sui successi scivola da 0,731 a 0,628, perché l'85% dell'insieme held-out è composto da dimostrazioni pulite e il bootstrapping ottimistico le spinge tutte verso l'alto, comprimendo il ranking. Pool iter0, warm-start direttamente in OVE: ρ sull'intero pool 0,68–0,71, ρ sui successi 0,63–0,67, sotto la soglia. I tre pool hanno insiemi held-out diversi, quindi la ρ non è confrontabile tra i pannelli." %}

<figure class="fig">
  <img src="{{ '/assets/img/honor_rove_value_curve.jpg' | relative_url }}" alt="Curve del valore su un episodio di takeover held-out: return reale, valore MC e valore OVE, con i frame a vantaggio negativo evidenziati" loading="lazy" width="1400" height="653">
  <figcaption>Riproduzione della Fig. 6 del paper su un episodio held-out con un takeover (x: frame, frame inattivi rimossi; y: valore normalizzato). Prima di t_r il valore OVE (blu) sta sopra il valore MC (arancione), ottimistico in distribuzione, poi salta in t_r e segue il return reale durante il recupero. I punti rossi indicano i frame con vantaggio OVE negativo: si concentrano prima del takeover e nel segmento di adattamento.</figcaption>
</figure>

### 5.3 Risultati {#rove-results}

Il successo autonomo sul robot è salito dal 40% (checkpoint base, n = 77) al **52%** (ROVE iter0, n = 192); i successi assistiti dall'umano sono scesi dal 45% al 20% degli episodi, mentre i fallimenti sono saliti dal 14% al 28%.

{% include svg_figure.liquid name="honor_rove_robot" caption="Esito di ogni episodio su robot reale registrato, per checkpoint, secondo la valutazione dell'operatore. Base 64000: fine ago – inizio set; base 80000: inizio – metà set; ROVE iter0: 17–23 set." %}

iter0 è stato addestrato con un passaggio del ciclo offline: un pool di valore di 2.068 episodi (534K frame di dimostrazioni e rollout su robot reale, 207 episodi held-out), etichette con esattamente il 40,0% di positivi e SFT condizionato a partire dal checkpoint base a 80K step per 8.000 step (lr 1e-4) su una GPU H20 in 18 h 17 min.

{% include svg_figure.liquid name="honor_rove_sft" caption="Loss dell'SFT condizionato di iter0. La media su 200 step scende da 0,54 a 0,047 allo step 1.000 e a 0,025 allo step 8.000." %}

**Sulle metriche, con onestà:** i tre gruppi provengono da giorni, operatori e set di prompt diversi, quindi questa è un'osservazione e non un test A/B; la valutazione intercalata rispetto al checkpoint base e a un braccio RECAP è ancora in sospeso. Inoltre la raccolta di iter0 non ha registrato segmenti di takeover, quindi al round successivo mancherà il segnale centrale di ROVE finché il logging non sarà corretto.

## 6. Debugging su robot reale {#debugging}

Nessuno di questi problemi poteva essere trovato rivedendo il codice offline: sono emersi solo durante lunghe sessioni su robot reale, e ciascuno è stato localizzato con una sonda o una metrica quantitativa.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Sintomo</th><th>Sonda / evidenza</th><th>Causa radice → correzione</th></tr></thead>
  <tbody>
    <tr><td>Generalizzazione in deriva dopo il fine-tuning</td><td>Loss held-out 0,0048 → 0,0222 allo step 2000 (×4,6); coseno della direzione dell'azione 0,995 → 0,979 → 0,961</td><td>Il mixer dei dati di base leggeva gli mp4 come BGR mentre la vision tower congelata si aspetta RGB: metà del budget di gradiente apprendeva rumore; corretto cambiando un default. Le ancore coprivano solo 29 episodi (5,6%) → ampliare il buffer di base</td></tr>
    <tr><td>Buffer riempito di falsi successi</td><td>Episodi con «successo» scattato dopo 24 e 29 step; il learner ha addestrato su di essi per oltre 1.000 step</td><td>Latch e reset condividevano un'unica soglia di 0,5, senza isteresi → latch a p &gt; 0,8 × 20 frame, reset a p ≤ 0,3 × 3 frame. Un oggetto non riposizionato in seguito ha prodotto 2.536 step spazzatura in 11 episodi, appena oltre la soglia di addestramento di 2.500 step: audit frame per frame fin dalla prima sessione</td></tr>
    <tr><td>Comportamento diverso tra addestramento, deployment e RL</td><td>Confronto campo per campo delle osservazioni nelle tre pipeline</td><td>Tipo DDS del gripper, una camera capovolta, inizializzazione della posizione della mano, indicizzazione della posizione della testa → elenco di 9 correzioni</td></tr>
    <tr><td>Il robot ruota all'inizio dell'episodio</td><td>Deriva mediana dello yaw di 31°</td><td>Ancora di yaw obsoleta + riancoraggio completo a ogni chunk → limite di 3°/chunk con tetto di 20°; 6 esecuzioni di validazione: errore di ancoraggio 0,0°, rotazione nel primo secondo ≤ 1,6°</td></tr>
    <tr><td>Frame della camera obsoleti</td><td>47% di frame consecutivi duplicati in 77 episodi su 83; sorgente 61 Hz, decodifica 54,9 Hz, effettivi ≈ 10,6 Hz sotto carico</td><td>Aggiunta l'osservabilità della freschezza dei frame</td></tr>
    <tr><td>«Il modello non si muove»</td><td>Client del trainer bloccato nei retry</td><td>Porte di actor / learner non corrispondenti. Lezione: ogni «il modello non si muove» è prima di tutto un controllo di comunicazione o di osservazione, poi un controllo dei pesi</td></tr>
  </tbody>
</table>
</div>
