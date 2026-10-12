---
lang: nl
project: 4_exploration_vehicle
title: "Frontier-gebaseerd autonoom verkenningsvoertuig"
source_hash: 36c561ab6341
---

<nav class="contrib">
  <p>Wat ik heb gedaan (bachelorscriptie, teamleider) · klik op een kaart om erheen te springen</p>
  <ol>
    <li><a href="#architecture"><strong>Systeemarchitectuur</strong><span>3 lagen · 2 taakmodi</span></a></li>
    <li><a href="#hardware"><strong>Hardware-integratie</strong><span>Jetson · LiDAR · RGB-D · STM32</span></a></li>
    <li><a href="#localization"><strong>Lokalisatie van slachtoffers</strong><span>YOLOv11-masker + diepte → kaart</span></a></li>
    <li><a href="#odometry"><strong>SLAM-odometriebrug</strong><span>Cartographer TF → /odometry</span></a></li>
    <li><a href="#frontier"><strong>Frontier-verkenning</strong><span>Informatiewinst versus reiskosten</span></a></li>
    <li><a href="#experiments"><strong>Veldexperimenten</strong><span>3 locaties × 3 snelheden × 3 runs</span></a></li>
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

## Overzicht

Search and rescue na een ramp is een race tegen de klok, en puin, hitte of straling maken een locatie vaak te gevaarlijk om er als eerste binnen te gaan. Dit project bouwt een kleine rupsrobot die voor de hulpverleners uit gaat: hij verkent zelfstandig een onbekende binnenruimte, bouwt tijdens het rijden de kaart op en markeert elke persoon die hij vindt op die kaart, zodat reddingswerkers weten waar ze heen moeten voordat ze naar binnen gaan.

Alles draait aan boord in ROS 2: **Cartographer** voor SLAM, **Navigation2** voor planning en besturing, **YOLOv11** met een dieptecamera voor het vinden van slachtoffers, en mijn **frontier-verkenningsnode** die bepaalt waar de robot als volgende heen gaat.

## 1. Systeemarchitectuur en taakmodi {#architecture}

{% include svg_figure.liquid name="vehicle_arch" caption="Systeemarchitectuur. De Jetson (host) draait de volledige ROS 2-stack en communiceert via USB met de sensoren; de STM32 (slave) stuurt de motoren aan en leest de IMU uit via IIC, en de twee borden communiceren via UART." %}

De robot werkt in twee modi. In de **verkenningsmodus** brengt hij een onbekend gebouw in kaart en registreert hij onderweg slachtoffers; in de **reddingsmodus** laadt hij die kaart opnieuw en rijdt hij achtereenvolgens naar elk geregistreerd slachtoffer.

{% include svg_figure.liquid name="vehicle_modes" caption="Taakstroom van de twee modi. De verkenning herhaalt kaart → frontier → navigeren tot er geen bruikbare frontier meer over is, terwijl de detectie van slachtoffers parallel loopt; de redding lokaliseert zich met AMCL op de opgeslagen kaart en bezoekt de opgeslagen posities van de slachtoffers een voor een." %}

## 2. Hardware-integratie {#hardware}

<figure class="fig">
  <img src="{{ '/assets/img/vehicle/robot.jpg' | relative_url }}" alt="Het rupsplatform met een LiDAR bovenop en een dieptecamera aan de voorkant" style="display: block; width: 100%; max-width: 520px; margin: 0 auto; border-radius: 6px;">
  <figcaption>Het platform: een rupschassis met de Jetson, een 2D-LiDAR bovenop en een RGB-D-camera aan de voorkant.</figcaption>
</figure>

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Component</th><th>Rol</th><th>Belangrijkste specificatie</th></tr></thead>
  <tbody>
    <tr><td><strong>Jetson Orin NX 16GB</strong></td><td>Boordcomputer, draait heel ROS 2</td><td>Ubuntu 22.04 · ROS 2 Humble</td></tr>
    <tr><td><strong>RPLIDAR C1</strong></td><td>2D-LiDAR voor SLAM en costmaps</td><td>ToF · bereik 0,05–12 m · scan 8–12 Hz</td></tr>
    <tr><td><strong>Orbbec Astra Pro Plus</strong></td><td>RGB-D-camera voor detectie van slachtoffers</td><td>Diepte 0,6–8 m · tot 640×480 @ 30 fps · RGB-FOV 66,01° × 40,2°</td></tr>
    <tr><td><strong>STM32F407VET6 + MPU6050</strong></td><td>Motorbesturing en IMU</td><td>Cortex-M4 · 168 MHz</td></tr>
    <tr><td><strong>MG513 DC motors</strong></td><td>Rupsaandrijving</td><td>Tot 1,1 m/s · 3 kg laadvermogen</td></tr>
  </tbody>
</table>
</div>

## 3. Detectie van slachtoffers en 3D-lokalisatie {#localization}

Een bounding box volstaat niet om een persoon op een kaart te plaatsen: de hoeken vallen op de vloer en de muur erachter, zodat de diepte erbinnen grotendeels achtergrond is. De detector gebruikt daarom **YOLOv11-segmentatie**, en alleen dieptepixels binnen het masker van de persoon worden gebruikt.

{% include svg_figure.liquid name="vehicle_localize" caption="Lokalisatie van slachtoffers. Het segmentatiemasker selecteert de pixels van de persoon in het uitgelijnde dieptebeeld; een mediaanfilter verwijdert ruis en uitschieters, en het gemiddelde van de rest is de afstand d_tar. De horizontale positie van het maskermidden geeft de peiling θ_off, en de robotpositie uit de odometrie brengt het punt van het camerakader naar de kaart." %}

Met $$x_{cen}$$ het horizontale midden van het masker, $$W_{img}$$ de beeldbreedte en $$\theta_{FOV}$$ het horizontale gezichtsveld van de camera:

$$\theta_{off} = \frac{2x_{cen} - W_{img}}{2W_{img}} \cdot \theta_{FOV}$$

$$x_c = d_{tar}\sin\theta_{off}, \qquad y_c = d_{tar}\cos\theta_{off}$$

Elke positie wordt samen met de kaart opgeslagen, en dit zijn de doelen waar de reddingsmodus later heen rijdt.

## 4. SLAM-odometriebrug {#odometry}

Cartographer levert de robotpositie als TF-transformaties, terwijl de navigatie- en lokalisatienodes een `nav_msgs/Odometry`-stroom met snelheden verwachten. Een kleine brugnode zet het ene om in het andere:

1. Zoek `map → odom` en `odom → base_link` op en componeer de robotpositie, $$T_{mb} = T_{mo} \cdot T_{ob}$$, wat de positie $$p = [x, y, z]^T$$ en het oriëntatiekwaternion $$q$$ geeft.
2. Zet $$q$$ om naar roll, pitch en yaw.
3. Differentieer in de tijd: $$v(t) \approx \dfrac{p_{mb}(t) - p_{mb}(t_{prev})}{\Delta t}$$, en de giersnelheid uit het gewrapte yaw-verschil.
4. Publiceer `/odometry/filtered` met pose, twist en covariantie.

## 5. Geoptimaliseerde frontier-verkenning {#frontier}

Klassieke frontier-verkenning rijdt naar de dichtstbijzijnde frontier, wat tijd verspilt aan kleine hoekjes en leidt tot heen-en-weer rijden over de kaart. Mijn node beoordeelt elke frontier op **hoeveel onbekende ruimte hij zou onthullen** tegenover **hoe ver de robot moet rijden** om hem te bereiken:

1. **Voorbewerking** — abonneer op het bezettingsraster van Cartographer en vorm het om tot een 2D-array.
2. **Frontiers detecteren** — voer Canny-randdetectie uit op de grens tussen bekende vrije ruimte en onbekende ruimte.
3. **Beslissen** — kies de frontier met de beste afweging tussen winst en kosten en stuur die als volgend doel naar Nav2.

$$I_f = \sum_{c \,\in\, N(f,r),\ c\ \text{unknown}} w_c, \qquad D_f = d_{path}(p, f)$$

$$f^* = \arg\max_{f \in F} \left( w_1 I_f - w_2 D_f \right)$$

$$I_f$$ telt de gewogen onbekende cellen binnen straal $$r$$ van frontier $$f$$; $$D_f$$ is de padlengte vanaf de robotpositie $$p$$; $$w_1, w_2$$ bepalen de afweging.

{% include svg_figure.liquid name="vehicle_loop" caption="Verkenningslus. Elke 2 s wordt de kaart opnieuw opgebouwd en worden frontiers langs de rand van de bekende vrije ruimte geëxtraheerd; de frontier met de beste score voor informatiewinst versus reiskosten wordt het volgende Nav2-doel, en de scores worden bijgewerkt naarmate de kaart groeit — gestage verkenning zonder overbodige paden." %}

<figure class="fig">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <img src="{{ '/assets/img/vehicle/frontier_map.jpg' | relative_url }}" alt="Frontier-visualisatiekaart: frontiers, robot, gekozen frontier en gelokaliseerde slachtoffers" style="flex: 557; min-width: 0; border-radius: 4px;">
    <img src="{{ '/assets/img/vehicle/frontier_rviz.jpg' | relative_url }}" alt="RViz-weergave van hetzelfde moment met de Cartographer-kaart en de Nav2-costmap" style="flex: 557; min-width: 0; border-radius: 4px;">
  </div>
  <figcaption>Hetzelfde moment van een run in twee weergaven. Links de frontierkaart: rode lijnen zijn frontiers, de donkerblauwe stip is de robot, de groene stip is de gekozen frontier en oranje stippen zijn gelokaliseerde slachtoffers. Rechts RViz met de kaart van Cartographer en de opgeblazen costmap van Nav2.</figcaption>
</figure>

## 6. Veldexperimenten {#experiments}

Een echte reddingsactie speelt zich af in een grote, complexe ruimte onder tijdsdruk, dus de test stelt een eenvoudige vraag: **hoeveel oppervlak doorzoekt de robot in vijf minuten?** Hij werd getest in drie binnenomgevingen met verschillende indelingen, onder drie snelheidslimieten, telkens drie runs — in totaal 27 runs.

{% include svg_figure.liquid name="vehicle_sites" caption="De drie testlocaties (boven) en een kaart die in vijf minuten is opgebouwd bij elke snelheidslimiet. De kaarten tonen alleen de vorm en zijn niet op een gemeenschappelijke schaal getekend. Wit is verkende vrije ruimte, grijs is onbekend, zwart markeert obstakels en rode lijnen zijn frontiers; oranje stippen zijn gelokaliseerde slachtoffers, de blauwe stip is de robot en de groene stip is de volgende frontier." %}

{% include svg_figure.liquid name="vehicle_area" caption="Doorzocht oppervlak in vijf minuten. Elke omgeving reageert anders op een hogere snelheidslimiet." %}

**Wat de cijfers zeggen.** De beste snelheidslimiet hangt af van de indeling. In de **lange, open gang van het onderwijsgebied** dekt een snellere robot simpelweg meer terrein. In de **smalle slaapzaalgang** begrenzen bochten en nauwe doorgangen de winst zodra de limiet boven 0,6 m/s komt. In het **rommelige laboratorium** verkent 0,9 m/s niet meer dan 0,6 m/s. Een enkele met de hand afgestelde snelheidslimiet is dus een compromis.

## 7. Conclusies

Naar hedendaagse maatstaven eenvoudig, maar wel een complete real-robot-lus opgebouwd uit afzonderlijke onderdelen — sensoren, embedded besturing, SLAM, navigatie, perceptie en besluitvorming — en de deployment-vaardigheden die ik in elk later project gebruikte, begonnen hier.

De experimenten wezen ook naar wat er daarna kwam. De scriptie stelde twee richtingen voor: verkenningsparameters zoals de snelheidslimiet online afstellen met modelvrije RL in plaats van met de hand, en de modulaire LiDAR-stack vervangen door modelgebaseerde, end-to-end RL op basis van alleen beeld. Lerende navigatie is de lijn die mijn latere onderzoek heeft gevolgd.
