---
lang: it
project: 4_exploration_vehicle
title: "Veicolo autonomo per l'esplorazione basata su frontiere"
source_hash: 36c561ab6341
---

<nav class="contrib">
  <p>Cosa ho fatto (tesi di laurea triennale, responsabile del team) · clicca su una scheda per saltare alla sezione</p>
  <ol>
    <li><a href="#architecture"><strong>Architettura del sistema</strong><span>3 livelli · 2 modalità operative</span></a></li>
    <li><a href="#hardware"><strong>Integrazione hardware</strong><span>Jetson · LiDAR · RGB-D · STM32</span></a></li>
    <li><a href="#localization"><strong>Localizzazione dei feriti</strong><span>Maschera YOLOv11 + profondità → mappa</span></a></li>
    <li><a href="#odometry"><strong>Bridge di odometria SLAM</strong><span>TF di Cartographer → /odometry</span></a></li>
    <li><a href="#frontier"><strong>Esplorazione per frontiere</strong><span>Guadagno informativo vs. costo di percorso</span></a></li>
    <li><a href="#experiments"><strong>Esperimenti sul campo</strong><span>3 siti × 3 velocità × 3 prove</span></a></li>
  </ol>
</nav>

## Demo

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="{{ '/assets/img/exploration_demo_poster.jpg' | relative_url }}">
      <source src="{{ '/assets/video/exploration_demo.mp4' | relative_url }}" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="{{ '/assets/img/exploration_demo2_poster.jpg' | relative_url }}">
      <source src="{{ '/assets/video/exploration_demo2.mp4' | relative_url }}" type="video/mp4">
    </video>
  </div>
</div>

## Panoramica

Le operazioni di ricerca e soccorso dopo un disastro sono una corsa contro il tempo, e detriti, calore o radiazioni rendono spesso il sito troppo pericoloso perché le persone vi entrino per prime. Questo progetto realizza un piccolo robot cingolato che entra al loro posto: esplora da solo uno spazio interno sconosciuto, costruisce la mappa mentre avanza e segna sulla mappa ogni persona che trova, così i soccorritori sanno dove andare prima ancora di varcare la soglia.

Tutto gira a bordo in ROS 2: **Cartographer** per lo SLAM, **Navigation2** per pianificazione e controllo, **YOLOv11** con una telecamera di profondità per individuare i feriti e il mio nodo di **esplorazione per frontiere**, che decide dove andare successivamente.

## 1. Architettura del sistema e modalità operative {#architecture}

{% include svg_figure.liquid name="vehicle_arch" caption="Architettura del sistema. Il Jetson (host) esegue l'intero stack ROS 2 e comunica con i sensori via USB; l'STM32 (slave) pilota i motori e legge l'IMU tramite IIC, e le due schede dialogano via UART." %}

Il robot funziona in due modalità. Nella **modalità di esplorazione** mappa un edificio sconosciuto e registra i feriti lungo il percorso; nella **modalità di soccorso** ricarica quella mappa e raggiunge a turno ogni ferito registrato.

{% include svg_figure.liquid name="vehicle_modes" caption="Flusso operativo delle due modalità. L'esplorazione ripete mappa → frontiera → navigazione finché non resta alcuna frontiera utile, mentre il rilevamento dei feriti procede in parallelo; il soccorso si localizza sulla mappa salvata con AMCL e visita una per una le posizioni dei feriti memorizzate." %}

## 2. Integrazione hardware {#hardware}

<figure class="fig">
  <img src="{{ '/assets/img/vehicle/robot.jpg' | relative_url }}" alt="La piattaforma robotica cingolata con un LiDAR in alto e una telecamera di profondità sul davanti" style="display: block; width: 100%; max-width: 520px; margin: 0 auto; border-radius: 6px;">
  <figcaption>La piattaforma: un telaio cingolato che ospita il Jetson, un LiDAR 2D in alto e una telecamera RGB-D sul davanti.</figcaption>
</figure>

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Componente</th><th>Ruolo</th><th>Specifica principale</th></tr></thead>
  <tbody>
    <tr><td><strong>Jetson Orin NX 16GB</strong></td><td>Computer di bordo, esegue tutto ROS 2</td><td>Ubuntu 22.04 · ROS 2 Humble</td></tr>
    <tr><td><strong>RPLIDAR C1</strong></td><td>LiDAR 2D per SLAM e costmap</td><td>ToF · portata 0,05–12 m · scansione 8–12 Hz</td></tr>
    <tr><td><strong>Orbbec Astra Pro Plus</strong></td><td>Telecamera RGB-D per il rilevamento dei feriti</td><td>Profondità 0,6–8 m · fino a 640×480 @ 30 fps · FOV RGB 66.01° × 40.2°</td></tr>
    <tr><td><strong>STM32F407VET6 + MPU6050</strong></td><td>Controllo dei motori e IMU</td><td>Cortex-M4 · 168 MHz</td></tr>
    <tr><td><strong>Motori DC MG513</strong></td><td>Trazione cingolata</td><td>Fino a 1,1 m/s · carico utile 3 kg</td></tr>
  </tbody>
</table>
</div>

## 3. Rilevamento dei feriti e localizzazione 3D {#localization}

Un bounding box non basta per collocare una persona sulla mappa: i suoi angoli cadono sul pavimento e sulla parete retrostante, quindi la profondità al suo interno è in gran parte sfondo. Il detector usa perciò la **segmentazione di YOLOv11** e vengono utilizzati solo i pixel di profondità interni alla maschera della persona.

{% include svg_figure.liquid name="vehicle_localize" caption="Localizzazione dei feriti. La maschera di segmentazione seleziona i pixel della persona nell'immagine di profondità allineata; un filtro mediano rimuove rumore e outlier, e la media di ciò che resta dà la distanza d_tar. La posizione orizzontale del centro della maschera fornisce l'angolo θ_off, e la posa del robot ottenuta dall'odometria porta il punto dal sistema di riferimento della telecamera a quello della mappa." %}

Con $$x_{cen}$$ il centro orizzontale della maschera, $$W_{img}$$ la larghezza dell'immagine e $$\theta_{FOV}$$ il campo visivo orizzontale della telecamera:

$$\theta_{off} = \frac{2x_{cen} - W_{img}}{2W_{img}} \cdot \theta_{FOV}$$

$$x_c = d_{tar}\sin\theta_{off}, \qquad y_c = d_{tar}\cos\theta_{off}$$

Ogni posizione viene salvata insieme alla mappa, e questi sono gli obiettivi che la modalità di soccorso raggiungerà in seguito.

## 4. Bridge di odometria SLAM {#odometry}

Cartographer fornisce la posa del robot sotto forma di trasformazioni TF, mentre i nodi di navigazione e localizzazione si aspettano un flusso `nav_msgs/Odometry` con le velocità. Un piccolo nodo bridge converte l'uno nell'altro:

1. Ricavare `map → odom` e `odom → base_link` e comporre la posa del robot, $$T_{mb} = T_{mo} \cdot T_{ob}$$, ottenendo la posizione $$p = [x, y, z]^T$$ e il quaternione di orientamento $$q$$.
2. Convertire $$q$$ in roll, pitch e yaw.
3. Derivare nel tempo: $$v(t) \approx \dfrac{p_{mb}(t) - p_{mb}(t_{prev})}{\Delta t}$$, e la velocità di imbardata dalla differenza di yaw riportata nell'intervallo principale.
4. Pubblicare `/odometry/filtered` con posa, twist e covarianza.

## 5. Esplorazione per frontiere ottimizzata {#frontier}

L'esplorazione per frontiere classica si dirige verso la frontiera più vicina, sprecando tempo in minuscole nicchie e tornando più volte sui propri passi. Il mio nodo assegna a ogni frontiera un punteggio che confronta **quanto spazio sconosciuto rivelerebbe** con **quanta strada il robot deve percorrere** per raggiungerla:

1. **Preprocessing** — sottoscrivere l'occupancy grid di Cartographer e rimodellarla in un array 2D.
2. **Rilevamento delle frontiere** — applicare il rilevatore di bordi Canny al confine tra spazio libero noto e spazio sconosciuto.
3. **Decisione** — scegliere la frontiera con il miglior compromesso tra guadagno e costo e inviarla a Nav2 come obiettivo successivo.

$$I_f = \sum_{c \,\in\, N(f,r),\ c\ \text{unknown}} w_c, \qquad D_f = d_{path}(p, f)$$

$$f^* = \arg\max_{f \in F} \left( w_1 I_f - w_2 D_f \right)$$

$$I_f$$ conta le celle sconosciute pesate entro il raggio $$r$$ dalla frontiera $$f$$; $$D_f$$ è la lunghezza del percorso dalla posizione del robot $$p$$; $$w_1, w_2$$ regolano il compromesso.

{% include svg_figure.liquid name="vehicle_loop" caption="Ciclo di esplorazione. Ogni 2 s la mappa viene ricostruita e le frontiere vengono estratte lungo il confine dello spazio libero noto; la frontiera con il miglior punteggio di guadagno informativo rispetto al costo di percorso diventa il successivo obiettivo di Nav2, e i punteggi si aggiornano man mano che la mappa cresce — un'esplorazione costante, senza percorsi ridondanti." %}

<figure class="fig">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <img src="{{ '/assets/img/vehicle/frontier_map.jpg' | relative_url }}" alt="Mappa di visualizzazione delle frontiere: frontiere, robot, frontiera scelta e feriti localizzati" style="flex: 557; min-width: 0; border-radius: 4px;">
    <img src="{{ '/assets/img/vehicle/frontier_rviz.jpg' | relative_url }}" alt="Vista RViz dello stesso istante con la mappa di Cartographer e la costmap di Nav2" style="flex: 557; min-width: 0; border-radius: 4px;">
  </div>
  <figcaption>Lo stesso istante di una prova in due viste. A sinistra, la mappa delle frontiere: le linee rosse sono le frontiere, il punto blu scuro è il robot, il punto verde è la frontiera scelta e i punti arancioni sono i feriti localizzati. A destra, RViz con la mappa di Cartographer e la costmap inflazionata di Nav2.</figcaption>
</figure>

## 6. Esperimenti sul campo {#experiments}

Un vero soccorso avviene in uno spazio ampio e complesso e sotto pressione temporale, quindi il test pone una domanda semplice: **quanta area esplora il robot in cinque minuti?** È stato eseguito in tre ambienti interni con layout diversi, con tre limiti di velocità e tre prove ciascuno, per un totale di 27 prove.

{% include svg_figure.liquid name="vehicle_sites" caption="I tre siti di test (in alto) e una mappa costruita in cinque minuti per ciascun limite di velocità. Le mappe mostrano solo la forma e non sono in scala comune. Il bianco è spazio libero esplorato, il grigio è sconosciuto, il nero indica gli ostacoli e le linee rosse sono frontiere; i punti arancioni sono feriti localizzati, il punto blu è il robot e il punto verde è la frontiera successiva." %}

{% include svg_figure.liquid name="vehicle_area" caption="Area esplorata in cinque minuti. Ogni ambiente reagisce in modo diverso a un limite di velocità più alto." %}

**Cosa dicono i numeri.** Il limite di velocità ottimale dipende dal layout. Nel **lungo e aperto corridoio dell'area didattica**, un robot più veloce semplicemente copre più terreno. Nel **corridoio stretto del dormitorio**, curve e passaggi angusti limitano il guadagno una volta superati 0,6 m/s. Nel **laboratorio disordinato**, 0,9 m/s non esplora più di 0,6 m/s. Un singolo limite di velocità regolato a mano è quindi un compromesso.

## 7. Considerazioni finali

Semplice per gli standard odierni, ma un ciclo completo su robot reale costruito a partire dai singoli componenti — sensori, controllo embedded, SLAM, navigazione, percezione e decisione — e le competenze di deployment usate in ogni progetto successivo sono nate qui.

Gli esperimenti hanno anche indicato cosa sarebbe venuto dopo. La tesi proponeva due direzioni: regolare online, con RL model-free, parametri di esplorazione come il limite di velocità invece di impostarli a mano, e sostituire lo stack modulare basato su LiDAR con un RL end-to-end e model-based che usi solo la visione. La navigazione basata sull'apprendimento è la linea seguita dalla mia ricerca successiva.
