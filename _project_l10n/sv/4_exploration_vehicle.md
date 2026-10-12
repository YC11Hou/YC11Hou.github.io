---
lang: sv
project: 4_exploration_vehicle
title: "Frontierbaserat autonomt utforskningsfordon"
source_hash: 36c561ab6341
---

<nav class="contrib">
  <p>Vad jag gjorde (examensarbete, teamledare) · klicka på ett kort för att hoppa dit</p>
  <ol>
    <li><a href="#architecture"><strong>Systemarkitektur</strong><span>3 lager · 2 uppgiftslägen</span></a></li>
    <li><a href="#hardware"><strong>Hårdvaruintegration</strong><span>Jetson · LiDAR · RGB-D · STM32</span></a></li>
    <li><a href="#localization"><strong>Lokalisering av nödställda</strong><span>YOLOv11-mask + djup → karta</span></a></li>
    <li><a href="#odometry"><strong>SLAM-odometribrygga</strong><span>Cartographer TF → /odometry</span></a></li>
    <li><a href="#frontier"><strong>Frontierutforskning</strong><span>Informationsvinst mot färdkostnad</span></a></li>
    <li><a href="#experiments"><strong>Fältexperiment</strong><span>3 platser × 3 hastigheter × 3 körningar</span></a></li>
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

## Översikt

Sök- och räddningsinsatser efter en katastrof är ett kapplöpningslopp mot klockan, och spillror, värme eller strålning gör ofta platsen för farlig för att människor ska gå in först. Det här projektet bygger en liten bandrobot som går in före dem: den utforskar ett okänt inomhusutrymme på egen hand, bygger kartan medan den kör och markerar varje person den hittar på kartan, så att räddningspersonalen vet vart de ska gå innan de sätter sin fot därinne.

Allt körs ombord i ROS 2: **Cartographer** för SLAM, **Navigation2** för planering och styrning, **YOLOv11** med en djupkamera för att hitta nödställda, och min **frontier-exploration**-nod som avgör vart roboten ska åka härnäst.

## 1. Systemarkitektur och uppgiftslägen {#architecture}

{% include svg_figure.liquid name="vehicle_arch" caption="Systemarkitektur. Jetson (master) kör hela ROS 2-stacken och kommunicerar med sensorerna via USB; STM32 (slav) driver motorerna och läser av IMU:n via IIC, och de två korten kommunicerar över UART." %}

Roboten arbetar i två lägen. I **utforskningsläge** kartlägger den en okänd byggnad och registrerar nödställda längs vägen; i **räddningsläge** läser den in kartan på nytt och kör till varje registrerad nödställd i tur och ordning.

{% include svg_figure.liquid name="vehicle_modes" caption="Arbetsflödet för de två lägena. Utforskningen upprepar karta → frontier → navigering tills inga användbara frontiers återstår, medan detektionen av nödställda pågår parallellt; räddningsläget lokaliserar sig på den sparade kartan med AMCL och besöker de lagrade positionerna för nödställda en efter en." %}

## 2. Hårdvaruintegration {#hardware}

<figure class="fig">
  <img src="{{ '/assets/img/vehicle/robot.jpg' | relative_url }}" alt="Bandrobotplattformen med en LiDAR på toppen och en djupkamera framtill" style="display: block; width: 100%; max-width: 520px; margin: 0 auto; border-radius: 6px;">
  <figcaption>Plattformen: ett bandchassi som bär Jetson, en 2D-LiDAR på toppen och en RGB-D-kamera framtill.</figcaption>
</figure>

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Komponent</th><th>Roll</th><th>Viktigaste specifikation</th></tr></thead>
  <tbody>
    <tr><td><strong>Jetson Orin NX 16GB</strong></td><td>Omborddator, kör hela ROS 2</td><td>Ubuntu 22.04 · ROS 2 Humble</td></tr>
    <tr><td><strong>RPLIDAR C1</strong></td><td>2D-LiDAR för SLAM och kostnadskartor</td><td>ToF · räckvidd 0,05–12 m · skanning 8–12 Hz</td></tr>
    <tr><td><strong>Orbbec Astra Pro Plus</strong></td><td>RGB-D-kamera för detektion av nödställda</td><td>Djup 0,6–8 m · upp till 640×480 @ 30 fps · RGB FOV 66.01° × 40.2°</td></tr>
    <tr><td><strong>STM32F407VET6 + MPU6050</strong></td><td>Motorstyrning och IMU</td><td>Cortex-M4 · 168 MHz</td></tr>
    <tr><td><strong>MG513 DC-motorer</strong></td><td>Banddrift</td><td>Upp till 1,1 m/s · 3 kg last</td></tr>
  </tbody>
</table>
</div>

## 3. Detektion av nödställda och 3D-lokalisering {#localization}

En begränsningsruta räcker inte för att placera en person på en karta: dess hörn hamnar på golvet och väggen bakom, så djupet inuti rutan är mest bakgrund. Detektorn använder därför **YOLOv11-segmentering**, och endast djuppixlar inuti personens mask används.

{% include svg_figure.liquid name="vehicle_localize" caption="Lokalisering av nödställda. Segmenteringsmasken väljer ut personens pixlar i den justerade djupbilden; ett medianfilter tar bort brus och avvikande värden, och medelvärdet av det som återstår blir avståndet d_tar. Maskcentrumets horisontella läge ger riktningsvinkeln θ_off, och robotens pose från odometrin för punkten från kamerans koordinatsystem till kartan." %}

Med $$x_{cen}$$ som maskens horisontella centrum, $$W_{img}$$ som bildbredden och $$\theta_{FOV}$$ som kamerans horisontella synfält:

$$\theta_{off} = \frac{2x_{cen} - W_{img}}{2W_{img}} \cdot \theta_{FOV}$$

$$x_c = d_{tar}\sin\theta_{off}, \qquad y_c = d_{tar}\cos\theta_{off}$$

Varje position sparas tillsammans med kartan, och det är dessa mål som räddningsläget senare kör till.

## 4. SLAM-odometribrygga {#odometry}

Cartographer anger robotens pose som TF-transformationer, medan navigerings- och lokaliseringsnoderna förväntar sig en `nav_msgs/Odometry`-ström med hastigheter. En liten brygg-nod konverterar den ena till den andra:

1. Slå upp `map → odom` och `odom → base_link` och sammansätt robotens pose, $$T_{mb} = T_{mo} \cdot T_{ob}$$, vilket ger positionen $$p = [x, y, z]^T$$ och orienteringskvaternionen $$q$$.
2. Konvertera $$q$$ till roll, pitch och yaw.
3. Derivera över tid: $$v(t) \approx \dfrac{p_{mb}(t) - p_{mb}(t_{prev})}{\Delta t}$$, och girhastigheten från den vinkelomslagna yaw-differensen.
4. Publicera `/odometry/filtered` med pose, twist och kovarians.

## 5. Optimerad frontierutforskning {#frontier}

Klassisk frontierutforskning kör till den närmaste frontiern, vilket slösar tid på små fickor och får roboten att vända tillbaka över kartan. Min nod poängsätter varje frontier utifrån **hur mycket okänt utrymme den skulle avslöja** mot **hur långt roboten måste köra** för att nå den:

1. **Förbehandling** — prenumerera på Cartographers beläggningsrutnät och omforma det till en 2D-array.
2. **Frontierdetektion** — kör Canny-kantdetektering på gränsen mellan känt fritt utrymme och okänt utrymme.
3. **Beslut** — välj den frontier med bäst avvägning mellan vinst och kostnad och skicka den till Nav2 som nästa mål.

$$I_f = \sum_{c \,\in\, N(f,r),\ c\ \text{unknown}} w_c, \qquad D_f = d_{path}(p, f)$$

$$f^* = \arg\max_{f \in F} \left( w_1 I_f - w_2 D_f \right)$$

$$I_f$$ räknar de viktade okända cellerna inom radien $$r$$ från frontiern $$f$$; $$D_f$$ är väglängden från robotens position $$p$$; $$w_1, w_2$$ styr avvägningen.

{% include svg_figure.liquid name="vehicle_loop" caption="Utforskningsloopen. Var 2:a sekund byggs kartan om och frontiers extraheras längs gränsen till känt fritt utrymme; den frontier med bäst poäng för informationsvinst mot färdkostnad blir nästa Nav2-mål, och poängen uppdateras när kartan växer — jämn utforskning utan onödiga omvägar." %}

<figure class="fig">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <img src="{{ '/assets/img/vehicle/frontier_map.jpg' | relative_url }}" alt="Frontiervisualiseringskarta: frontiers, robot, vald frontier och lokaliserade nödställda" style="flex: 557; min-width: 0; border-radius: 4px;">
    <img src="{{ '/assets/img/vehicle/frontier_rviz.jpg' | relative_url }}" alt="RViz-vy av samma ögonblick med Cartographer-kartan och Nav2-kostnadskartan" style="flex: 557; min-width: 0; border-radius: 4px;">
  </div>
  <figcaption>Samma ögonblick av en körning i två vyer. Till vänster frontierkartan: röda linjer är frontiers, den mörkblå pricken är roboten, den gröna pricken är den valda frontiern och orange prickar är lokaliserade nödställda. Till höger RViz med Cartographers karta och Nav2:s uppblåsta kostnadskarta.</figcaption>
</figure>

## 6. Fältexperiment {#experiments}

En verklig räddningsinsats sker i ett stort, komplext utrymme under tidspress, så testet ställer en enkel fråga: **hur stor yta söker roboten av på fem minuter?** Det genomfördes i tre inomhusmiljöer med olika planlösning, under tre hastighetsgränser och med tre körningar vardera — 27 körningar totalt.

{% include svg_figure.liquid name="vehicle_sites" caption="De tre testplatserna (överst) och en karta byggd på fem minuter vid varje hastighetsgräns. Kartorna visar endast form och är inte ritade i gemensam skala. Vitt är utforskat fritt utrymme, grått är okänt, svart markerar hinder och röda linjer är frontiers; orange prickar är lokaliserade nödställda, den blå pricken är roboten och den gröna pricken är nästa frontier." %}

{% include svg_figure.liquid name="vehicle_area" caption="Avsökt yta på fem minuter. Varje miljö reagerar olika på en högre hastighetsgräns." %}

**Vad siffrorna visar.** Den bästa hastighetsgränsen beror på planlösningen. I den **långa, öppna korridoren i undervisningsområdet** täcker en snabbare robot helt enkelt mer mark. I den **smala studentbostadskorridoren** begränsar svängar och trånga passager vinsten när gränsen överstiger 0,6 m/s. I det **belamrade laboratoriet** utforskar 0,9 m/s inte mer än 0,6 m/s. En enda handjusterad hastighetsgräns är därför en kompromiss.

## 7. Slutsatser

Enkelt med dagens mått mätt, men en komplett verklig robotloop byggd av enskilda delar — sensorer, inbyggd styrning, SLAM, navigering, perception och beslutsfattande — och de driftsättningsfärdigheter som jag använt i varje senare projekt började här.

Experimenten pekade också mot vad som kom härnäst. Examensarbetet föreslog två riktningar: att justera utforskningsparametrar som hastighetsgränsen online med modellfri RL i stället för för hand, och att ersätta den modulära LiDAR-stacken med modellbaserad, end-to-end-RL enbart från syn. Inlärningsbaserad navigering är den linje som min senare forskning har följt.
