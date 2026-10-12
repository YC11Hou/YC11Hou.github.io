---
lang: de
project: 4_exploration_vehicle
title: "Frontier-basiertes autonomes Erkundungsfahrzeug"
source_hash: 36c561ab6341
---

<nav class="contrib">
  <p>Was ich gemacht habe (Bachelorarbeit, Teamleitung) · Karte anklicken, um zu springen</p>
  <ol>
    <li><a href="#architecture"><strong>Systemarchitektur</strong><span>3 Schichten · 2 Einsatzmodi</span></a></li>
    <li><a href="#hardware"><strong>Hardware-Integration</strong><span>Jetson · LiDAR · RGB-D · STM32</span></a></li>
    <li><a href="#localization"><strong>Lokalisierung von Verletzten</strong><span>YOLOv11-Maske + Tiefe → Karte</span></a></li>
    <li><a href="#odometry"><strong>SLAM-Odometrie-Brücke</strong><span>Cartographer-TF → /odometry</span></a></li>
    <li><a href="#frontier"><strong>Frontier-Exploration</strong><span>Informationsgewinn vs. Fahrtkosten</span></a></li>
    <li><a href="#experiments"><strong>Feldexperimente</strong><span>3 Orte × 3 Geschwindigkeiten × 3 Läufe</span></a></li>
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

## Überblick

Such- und Rettungseinsätze nach einer Katastrophe sind ein Wettlauf gegen die Zeit, und Trümmer, Hitze oder Strahlung machen den Einsatzort oft zu gefährlich, als dass Menschen ihn zuerst betreten könnten. Dieses Projekt baut einen kleinen Kettenroboter, der ihnen vorausfährt: Er erkundet einen unbekannten Innenraum selbstständig, baut während der Fahrt die Karte auf und markiert jede gefundene Person darin, sodass die Retter wissen, wohin sie müssen, bevor sie das Gebäude betreten.

Alles läuft an Bord in ROS 2: **Cartographer** für SLAM, **Navigation2** für Planung und Regelung, **YOLOv11** mit einer Tiefenkamera zum Auffinden von Verletzten sowie mein **Frontier-Exploration**-Knoten, der entscheidet, wohin als Nächstes gefahren wird.

## 1. Systemarchitektur & Einsatzmodi {#architecture}

{% include svg_figure.liquid name="vehicle_arch" caption="Systemarchitektur. Der Jetson (Host) führt den gesamten ROS-2-Stack aus und kommuniziert über USB mit den Sensoren; der STM32 (Slave) steuert die Motoren und liest die IMU über IIC aus, und die beiden Platinen sprechen über UART miteinander." %}

Der Roboter arbeitet in zwei Modi. Im **Erkundungsmodus** kartiert er ein unbekanntes Gebäude und erfasst unterwegs Verletzte; im **Rettungsmodus** lädt er diese Karte erneut und fährt nacheinander jeden erfassten Verletzten an.

{% include svg_figure.liquid name="vehicle_modes" caption="Ablauf der beiden Modi. Die Erkundung wiederholt Karte → Frontier → Navigation, bis keine nützliche Frontier mehr übrig ist, während die Verletztenerkennung parallel läuft; der Rettungsmodus lokalisiert sich mit AMCL auf der gespeicherten Karte und fährt die hinterlegten Positionen der Verletzten einzeln an." %}

## 2. Hardware-Integration {#hardware}

<figure class="fig">
  <img src="{{ '/assets/img/vehicle/robot.jpg' | relative_url }}" alt="Die Kettenroboter-Plattform mit einem LiDAR oben und einer Tiefenkamera vorn" style="display: block; width: 100%; max-width: 520px; margin: 0 auto; border-radius: 6px;">
  <figcaption>Die Plattform: ein Kettenfahrwerk mit dem Jetson, einem 2D-LiDAR oben und einer RGB-D-Kamera vorn.</figcaption>
</figure>

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Komponente</th><th>Aufgabe</th><th>Wichtige Spezifikation</th></tr></thead>
  <tbody>
    <tr><td><strong>Jetson Orin NX 16GB</strong></td><td>Bordcomputer, führt das gesamte ROS 2 aus</td><td>Ubuntu 22.04 · ROS 2 Humble</td></tr>
    <tr><td><strong>RPLIDAR C1</strong></td><td>2D-LiDAR für SLAM und Costmaps</td><td>ToF · 0,05–12 m Reichweite · 8–12 Hz Scanrate</td></tr>
    <tr><td><strong>Orbbec Astra Pro Plus</strong></td><td>RGB-D-Kamera zur Verletztenerkennung</td><td>Tiefe 0,6–8 m · bis zu 640×480 @ 30 fps · RGB-FOV 66,01° × 40,2°</td></tr>
    <tr><td><strong>STM32F407VET6 + MPU6050</strong></td><td>Motorsteuerung und IMU</td><td>Cortex-M4 · 168 MHz</td></tr>
    <tr><td><strong>MG513 DC motors</strong></td><td>Kettenantrieb</td><td>Bis zu 1,1 m/s · 3 kg Nutzlast</td></tr>
  </tbody>
</table>
</div>

## 3. Verletztenerkennung & 3D-Lokalisierung {#localization}

Eine Bounding Box reicht nicht aus, um eine Person in einer Karte zu verorten: Ihre Ecken liegen auf dem Boden und der Wand dahinter, sodass die Tiefe darin größtenteils Hintergrund ist. Der Detektor verwendet daher **YOLOv11-Segmentierung**, und nur Tiefenpixel innerhalb der Maske der Person werden genutzt.

{% include svg_figure.liquid name="vehicle_localize" caption="Lokalisierung von Verletzten. Die Segmentierungsmaske wählt die Pixel der Person im ausgerichteten Tiefenbild aus; ein Medianfilter entfernt Rauschen und Ausreißer, und der Mittelwert der verbleibenden Werte ergibt die Entfernung d_tar. Die horizontale Lage des Maskenzentrums liefert den Peilwinkel θ_off, und die Roboterpose aus der Odometrie überführt den Punkt vom Kamerakoordinatensystem in die Karte." %}

Mit $$x_{cen}$$ als horizontalem Zentrum der Maske, $$W_{img}$$ als Bildbreite und $$\theta_{FOV}$$ als horizontalem Sichtfeld der Kamera:

$$\theta_{off} = \frac{2x_{cen} - W_{img}}{2W_{img}} \cdot \theta_{FOV}$$

$$x_c = d_{tar}\sin\theta_{off}, \qquad y_c = d_{tar}\cos\theta_{off}$$

Jede Position wird zusammen mit der Karte gespeichert; dies sind die Ziele, die der Rettungsmodus später anfährt.

## 4. SLAM-Odometrie-Brücke {#odometry}

Cartographer liefert die Roboterpose als TF-Transformationen, während die Navigations- und Lokalisierungsknoten einen `nav_msgs/Odometry`-Strom mit Geschwindigkeiten erwarten. Ein kleiner Brückenknoten wandelt das eine in das andere um:

1. `map → odom` und `odom → base_link` nachschlagen und die Roboterpose zusammensetzen, $$T_{mb} = T_{mo} \cdot T_{ob}$$, was die Position $$p = [x, y, z]^T$$ und das Orientierungsquaternion $$q$$ ergibt.
2. $$q$$ in Roll, Nick und Gier umrechnen.
3. Zeitlich differenzieren: $$v(t) \approx \dfrac{p_{mb}(t) - p_{mb}(t_{prev})}{\Delta t}$$, und die Gierrate aus der umgebrochenen Gierdifferenz.
4. `/odometry/filtered` mit Pose, Twist und Kovarianz veröffentlichen.

## 5. Optimierte Frontier-Exploration {#frontier}

Klassische Frontier-Exploration fährt zur nächstgelegenen Frontier, was Zeit auf winzige Nischen verschwendet und zu Rückwegen über die Karte führt. Mein Knoten bewertet jede Frontier danach, **wie viel unbekannten Raum sie aufdecken würde**, im Verhältnis dazu, **wie weit der Roboter fahren muss**, um sie zu erreichen:

1. **Vorverarbeitung** — das Occupancy Grid von Cartographer abonnieren und in ein 2D-Array umformen.
2. **Frontiers erkennen** — Canny-Kantenerkennung auf der Grenze zwischen bekanntem freiem Raum und Unbekanntem ausführen.
3. **Entscheiden** — die Frontier mit dem besten Verhältnis von Gewinn zu Kosten auswählen und als nächstes Ziel an Nav2 senden.

$$I_f = \sum_{c \,\in\, N(f,r),\ c\ \text{unknown}} w_c, \qquad D_f = d_{path}(p, f)$$

$$f^* = \arg\max_{f \in F} \left( w_1 I_f - w_2 D_f \right)$$

$$I_f$$ zählt die gewichteten unbekannten Zellen im Radius $$r$$ um die Frontier $$f$$; $$D_f$$ ist die Pfadlänge von der Roboterposition $$p$$; $$w_1, w_2$$ legen den Zielkonflikt fest.

{% include svg_figure.liquid name="vehicle_loop" caption="Erkundungsschleife. Alle 2 s wird die Karte neu aufgebaut und es werden Frontiers entlang der Grenze des bekannten freien Raums extrahiert; die Frontier mit dem besten Wert aus Informationsgewinn und Fahrtkosten wird zum nächsten Nav2-Ziel, und die Werte aktualisieren sich mit wachsender Karte — stetige Erkundung ohne redundante Wege." %}

<figure class="fig">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <img src="{{ '/assets/img/vehicle/frontier_map.jpg' | relative_url }}" alt="Frontier-Visualisierungskarte: Frontiers, Roboter, gewählte Frontier und lokalisierte Verletzte" style="flex: 557; min-width: 0; border-radius: 4px;">
    <img src="{{ '/assets/img/vehicle/frontier_rviz.jpg' | relative_url }}" alt="RViz-Ansicht desselben Moments mit der Cartographer-Karte und der Nav2-Costmap" style="flex: 557; min-width: 0; border-radius: 4px;">
  </div>
  <figcaption>Derselbe Moment eines Laufs in zwei Ansichten. Links die Frontier-Karte: Rote Linien sind Frontiers, der dunkelblaue Punkt ist der Roboter, der grüne Punkt die gewählte Frontier und orangefarbene Punkte sind lokalisierte Verletzte. Rechts RViz mit der Karte von Cartographer und der aufgeblähten Costmap von Nav2.</figcaption>
</figure>

## 6. Feldexperimente {#experiments}

Ein realer Rettungseinsatz findet in einem großen, komplexen Raum unter Zeitdruck statt, daher stellt der Test eine einfache Frage: **Wie viel Fläche durchsucht der Roboter in fünf Minuten?** Er wurde in drei Innenräumen mit unterschiedlichem Grundriss unter drei Geschwindigkeitsgrenzen mit jeweils drei Läufen durchgeführt — insgesamt 27 Läufe.

{% include svg_figure.liquid name="vehicle_sites" caption="Die drei Testorte (oben) und eine in fünf Minuten erstellte Karte für jede Geschwindigkeitsgrenze. Die Karten zeigen nur die Form und sind nicht im gleichen Maßstab gezeichnet. Weiß ist erkundeter freier Raum, Grau ist unbekannt, Schwarz markiert Hindernisse und rote Linien sind Frontiers; orangefarbene Punkte sind lokalisierte Verletzte, der blaue Punkt ist der Roboter und der grüne Punkt die nächste Frontier." %}

{% include svg_figure.liquid name="vehicle_area" caption="In fünf Minuten durchsuchte Fläche. Jede Umgebung reagiert anders auf eine höhere Geschwindigkeitsgrenze." %}

**Was die Zahlen zeigen.** Die beste Geschwindigkeitsgrenze hängt vom Grundriss ab. Im **langen, offenen Flur des Lehrbereichs** deckt ein schnellerer Roboter schlicht mehr Fläche ab. Im **schmalen Wohnheimflur** begrenzen Kurven und enge Passagen den Gewinn, sobald die Grenze 0,6 m/s übersteigt. Im **unübersichtlichen Labor** erkundet 0,9 m/s nicht mehr als 0,6 m/s. Eine einzelne, von Hand eingestellte Geschwindigkeitsgrenze ist daher ein Kompromiss.

## 7. Fazit

Nach heutigen Maßstäben einfach, aber ein vollständiger Regelkreis auf einem realen Roboter, aufgebaut aus einzelnen Teilen — Sensoren, eingebetteter Steuerung, SLAM, Navigation, Wahrnehmung und Entscheidungsfindung — und die Deployment-Fähigkeiten, die ich in jedem späteren Projekt eingesetzt habe, nahmen hier ihren Anfang.

Die Experimente wiesen auch auf das hin, was als Nächstes kam. Die Arbeit schlug zwei Richtungen vor: Explorationsparameter wie die Geschwindigkeitsgrenze online mit modellfreiem RL abzustimmen statt von Hand, und den modularen LiDAR-Stack durch modellbasiertes, durchgängiges RL allein aus Vision zu ersetzen. Lernbasierte Navigation ist die Linie, der meine spätere Forschung gefolgt ist.
