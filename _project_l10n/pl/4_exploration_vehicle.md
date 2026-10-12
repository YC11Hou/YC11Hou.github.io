---
lang: pl
project: 4_exploration_vehicle
title: "Autonomiczny pojazd eksploracyjny oparty na eksploracji frontowej"
source_hash: 36c561ab6341
---

<nav class="contrib">
  <p>Co zrobiłem (praca inżynierska, lider zespołu) · kliknij kartę, aby przejść do sekcji</p>
  <ol>
    <li><a href="#architecture"><strong>Architektura systemu</strong><span>3 warstwy · 2 tryby zadań</span></a></li>
    <li><a href="#hardware"><strong>Integracja sprzętu</strong><span>Jetson · LiDAR · RGB-D · STM32</span></a></li>
    <li><a href="#localization"><strong>Lokalizacja poszkodowanych</strong><span>maska YOLOv11 + głębia → mapa</span></a></li>
    <li><a href="#odometry"><strong>Most odometrii SLAM</strong><span>Cartographer TF → /odometry</span></a></li>
    <li><a href="#frontier"><strong>Eksploracja frontowa</strong><span>Zysk informacyjny a koszt dojazdu</span></a></li>
    <li><a href="#experiments"><strong>Eksperymenty terenowe</strong><span>3 miejsca × 3 prędkości × 3 przejazdy</span></a></li>
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

## Przegląd

Akcja poszukiwawczo-ratunkowa po katastrofie to wyścig z czasem, a gruz, wysoka temperatura lub promieniowanie często sprawiają, że wejście ludzi do środka jest zbyt niebezpieczne. Ten projekt to mały robot gąsienicowy, który wjeżdża przed nimi: samodzielnie eksploruje nieznane pomieszczenia, buduje mapę w trakcie jazdy i zaznacza na niej każdą znalezioną osobę, dzięki czemu ratownicy wiedzą, dokąd iść, zanim wejdą do budynku.

Całość działa na pokładzie w ROS 2: **Cartographer** do SLAM, **Navigation2** do planowania i sterowania, **YOLOv11** z kamerą głębi do wykrywania poszkodowanych oraz mój węzeł **eksploracji frontowej (frontier exploration)**, który decyduje, dokąd jechać dalej.

## 1. Architektura systemu i tryby zadań {#architecture}

{% include svg_figure.liquid name="vehicle_arch" caption="Architektura systemu. Jetson (host) uruchamia cały stos ROS 2 i komunikuje się z czujnikami przez USB; STM32 (slave) steruje silnikami i odczytuje IMU przez IIC, a obie płytki komunikują się przez UART." %}

Robot działa w dwóch trybach. W **trybie eksploracji** mapuje nieznany budynek i na bieżąco zapisuje pozycje poszkodowanych; w **trybie ratunkowym** ładuje tę mapę ponownie i kolejno jedzie do każdego zapisanego poszkodowanego.

{% include svg_figure.liquid name="vehicle_modes" caption="Przebieg zadań w obu trybach. Eksploracja powtarza cykl mapa → frontier → nawigacja, aż nie zostanie żaden użyteczny frontier, a wykrywanie poszkodowanych działa równolegle; tryb ratunkowy lokalizuje się na zapisanej mapie za pomocą AMCL i odwiedza zapisane pozycje poszkodowanych jedna po drugiej." %}

## 2. Integracja sprzętu {#hardware}

<figure class="fig">
  <img src="{{ '/assets/img/vehicle/robot.jpg' | relative_url }}" alt="Gąsienicowa platforma robota z LiDAR-em na górze i kamerą głębi z przodu" style="display: block; width: 100%; max-width: 520px; margin: 0 auto; border-radius: 6px;">
  <figcaption>Platforma: podwozie gąsienicowe z Jetsonem, 2D LiDAR-em na górze i kamerą RGB-D z przodu.</figcaption>
</figure>

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Komponent</th><th>Rola</th><th>Kluczowe parametry</th></tr></thead>
  <tbody>
    <tr><td><strong>Jetson Orin NX 16GB</strong></td><td>Komputer pokładowy, uruchamia cały ROS 2</td><td>Ubuntu 22.04 · ROS 2 Humble</td></tr>
    <tr><td><strong>RPLIDAR C1</strong></td><td>2D LiDAR do SLAM i map kosztów</td><td>ToF · zasięg 0,05–12 m · skan 8–12 Hz</td></tr>
    <tr><td><strong>Orbbec Astra Pro Plus</strong></td><td>Kamera RGB-D do wykrywania poszkodowanych</td><td>Głębia 0,6–8 m · do 640×480 @ 30 fps · FOV RGB 66,01° × 40,2°</td></tr>
    <tr><td><strong>STM32F407VET6 + MPU6050</strong></td><td>Sterowanie silnikami i IMU</td><td>Cortex-M4 · 168 MHz</td></tr>
    <tr><td><strong>Silniki DC MG513</strong></td><td>Napęd gąsienicowy</td><td>Do 1,1 m/s · udźwig 3 kg</td></tr>
  </tbody>
</table>
</div>

## 3. Wykrywanie poszkodowanych i lokalizacja 3D {#localization}

Ramka ograniczająca nie wystarcza, aby umieścić osobę na mapie: jej rogi wypadają na podłogę i ścianę za nią, więc głębia wewnątrz ramki to głównie tło. Dlatego detektor używa **segmentacji YOLOv11**, a wykorzystywane są tylko piksele głębi wewnątrz maski osoby.

{% include svg_figure.liquid name="vehicle_localize" caption="Lokalizacja poszkodowanego. Maska segmentacji wybiera piksele osoby w wyrównanym obrazie głębi; filtr medianowy usuwa szum i wartości odstające, a średnia z pozostałych daje odległość d_tar. Pozioma pozycja środka maski wyznacza kierunek θ_off, a poza robota z odometrii przenosi punkt z układu kamery do układu mapy." %}

Niech $$x_{cen}$$ oznacza poziomy środek maski, $$W_{img}$$ szerokość obrazu, a $$\theta_{FOV}$$ poziome pole widzenia kamery:

$$\theta_{off} = \frac{2x_{cen} - W_{img}}{2W_{img}} \cdot \theta_{FOV}$$

$$x_c = d_{tar}\sin\theta_{off}, \qquad y_c = d_{tar}\cos\theta_{off}$$

Każda pozycja jest zapisywana razem z mapą i to właśnie do tych celów tryb ratunkowy jedzie później.

## 4. Most odometrii SLAM {#odometry}

Cartographer podaje pozę robota w postaci transformacji TF, podczas gdy węzły nawigacji i lokalizacji oczekują strumienia `nav_msgs/Odometry` z prędkościami. Mały węzeł-most zamienia jedno w drugie:

1. Odczytaj `map → odom` i `odom → base_link` i złóż pozę robota, $$T_{mb} = T_{mo} \cdot T_{ob}$$, otrzymując położenie $$p = [x, y, z]^T$$ i kwaternion orientacji $$q$$.
2. Przelicz $$q$$ na kąty roll, pitch i yaw.
3. Zróżniczkuj w czasie: $$v(t) \approx \dfrac{p_{mb}(t) - p_{mb}(t_{prev})}{\Delta t}$$, a prędkość kątową odchylenia oblicz z różnicy yaw po zawinięciu kąta.
4. Opublikuj `/odometry/filtered` z pozą, twistem i kowariancją.

## 5. Zoptymalizowana eksploracja frontowa {#frontier}

Klasyczna eksploracja frontowa jedzie do najbliższego frontieru, co marnuje czas na drobne zakamarki i prowadzi do zawracania przez całą mapę. Mój węzeł ocenia każdy frontier według tego, **ile nieznanej przestrzeni odsłoni**, w zestawieniu z tym, **jak daleko robot musi jechać**, by do niego dotrzeć:

1. **Przetwarzanie wstępne** — subskrybuj siatkę zajętości z Cartographera i przekształć ją w tablicę 2D.
2. **Wykrywanie frontierów** — uruchom detekcję krawędzi Canny'ego na granicy między znaną wolną przestrzenią a nieznaną.
3. **Decyzja** — wybierz frontier o najlepszym kompromisie zysku i kosztu i wyślij go do Nav2 jako kolejny cel.

$$I_f = \sum_{c \,\in\, N(f,r),\ c\ \text{unknown}} w_c, \qquad D_f = d_{path}(p, f)$$

$$f^* = \arg\max_{f \in F} \left( w_1 I_f - w_2 D_f \right)$$

$$I_f$$ to suma ważona nieznanych komórek w promieniu $$r$$ od frontieru $$f$$; $$D_f$$ to długość ścieżki od położenia robota $$p$$; $$w_1, w_2$$ ustalają kompromis.

{% include svg_figure.liquid name="vehicle_loop" caption="Pętla eksploracji. Co 2 s mapa jest odbudowywana, a frontiery są wyodrębniane wzdłuż granicy znanej wolnej przestrzeni; frontier z najlepszym wynikiem zysku informacyjnego względem kosztu dojazdu staje się kolejnym celem Nav2, a oceny aktualizują się wraz ze wzrostem mapy — eksploracja przebiega równomiernie, bez zbędnych tras." %}

<figure class="fig">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <img src="{{ '/assets/img/vehicle/frontier_map.jpg' | relative_url }}" alt="Mapa wizualizacji frontierów: frontiery, robot, wybrany frontier i zlokalizowani poszkodowani" style="flex: 557; min-width: 0; border-radius: 4px;">
    <img src="{{ '/assets/img/vehicle/frontier_rviz.jpg' | relative_url }}" alt="Widok RViz z tego samego momentu z mapą Cartographera i mapą kosztów Nav2" style="flex: 557; min-width: 0; border-radius: 4px;">
  </div>
  <figcaption>Ten sam moment przejazdu w dwóch widokach. Po lewej mapa frontierów: czerwone linie to frontiery, ciemnoniebieska kropka to robot, zielona kropka to wybrany frontier, a pomarańczowe kropki to zlokalizowani poszkodowani. Po prawej RViz z mapą Cartographera i napompowaną mapą kosztów Nav2.</figcaption>
</figure>

## 6. Eksperymenty terenowe {#experiments}

Prawdziwa akcja ratunkowa odbywa się w dużej, złożonej przestrzeni pod presją czasu, więc test zadaje proste pytanie: **jaką powierzchnię robot przeszukuje w pięć minut?** Przeprowadzono go w trzech środowiskach wewnętrznych o różnych układach, przy trzech ograniczeniach prędkości, po trzy przejazdy każde — łącznie 27 przejazdów.

{% include svg_figure.liquid name="vehicle_sites" caption="Trzy miejsca testowe (u góry) oraz mapa zbudowana w pięć minut przy każdym ograniczeniu prędkości. Mapy pokazują tylko kształt i nie są narysowane w jednej skali. Biel to zbadana wolna przestrzeń, szarość to obszar nieznany, czerń oznacza przeszkody, a czerwone linie to frontiery; pomarańczowe kropki to zlokalizowani poszkodowani, niebieska kropka to robot, a zielona to następny frontier." %}

{% include svg_figure.liquid name="vehicle_area" caption="Powierzchnia przeszukana w pięć minut. Każde środowisko inaczej reaguje na wyższe ograniczenie prędkości." %}

**Co mówią liczby.** Najlepsze ograniczenie prędkości zależy od układu pomieszczeń. W **długim, otwartym korytarzu strefy dydaktycznej** szybszy robot po prostu pokrywa więcej terenu. W **wąskim korytarzu akademika** zakręty i ciasne przejścia ograniczają zysk, gdy limit przekracza 0,6 m/s. W **zagraconym laboratorium** prędkość 0,9 m/s nie pozwala zbadać więcej niż 0,6 m/s. Jedno ręcznie dobrane ograniczenie prędkości jest więc kompromisem.

## 7. Wnioski

Z dzisiejszej perspektywy rzecz prosta, ale to kompletna pętla na prawdziwym robocie, zbudowana z osobnych elementów — czujników, sterowania wbudowanego, SLAM, nawigacji, percepcji i podejmowania decyzji — a umiejętności wdrożeniowe wykorzystywane w każdym późniejszym projekcie zaczęły się właśnie tu.

Eksperymenty wskazały też, co dalej. Praca proponowała dwa kierunki: strojenie parametrów eksploracji, takich jak ograniczenie prędkości, online za pomocą bezmodelowego RL zamiast ręcznie, oraz zastąpienie modularnego stosu LiDAR opartym na modelu, end-to-end RL wyłącznie z obrazu. Nawigacja oparta na uczeniu to kierunek, w którym podążyły moje późniejsze badania.
