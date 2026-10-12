---
lang: pl
project: 2_objectnav_drone
title: "AION: nawigacja wewnątrz pomieszczeń do obiektu docelowego dla robotów latających"
source_hash: 2dc0fa747eda
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2601.15614" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2601.15614
  </a>
</p>

<nav class="contrib">
  <p>Co zrobiłem (drugi autor) · kliknij kartę, aby przejść do sekcji</p>
  <ol>
    <li><a href="#framework"><strong>Struktura dwóch polityk</strong><span>Eksploracja, gdy cel jest poza polem widzenia</span></a></li>
    <li><a href="#exploration"><strong>Polityka eksploracji</strong><span>Wskazówka z obszarów otwartych w głębi + nagrody</span></a></li>
    <li><a href="#evaluation"><strong>Ewaluacja</strong><span>AI2-THOR + wielopokojowy IsaacSim</span></a></li>
  </ol>
</nav>

## Demo

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/img/aion_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/aion_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

## Przegląd

Nawigacja do obiektu docelowego (Object-Goal Navigation, ObjectNav) wymaga od agenta samodzielnej eksploracji nieznanego otoczenia i dotarcia do obiektów wskazanych etykietą semantyczną. Dotychczasowe prace dotyczyły głównie ObjectNav typu zero-shot przy ruchu 2D; rozszerzenie go na platformy latające z lokomocją 3D pozostaje słabo zbadane. Roboty latające zapewniają większą zwrotność i skuteczniejsze przeszukiwanie, ale wprowadzają też nowe wyzwania w percepcji przestrzennej, sterowaniu dynamicznym i zapewnieniu bezpieczeństwa. W tej pracy proponujemy AION — metodę wizyjnej ObjectNav dla robotów latających, która nie wymaga zewnętrznej lokalizacji ani map globalnych. AION to end-to-end framework uczenia ze wzmocnieniem (RL) z dwiema politykami, który rozdziela zachowania eksploracji i dotarcia do celu między dwie wyspecjalizowane polityki. Oceniamy AION w benchmarku AI2-THOR, a następnie badamy jego działanie w czasie rzeczywistym w IsaacSim z użyciem wiernych modeli dronów. Wyniki eksperymentów pokazują, że AION osiąga najlepsze rezultaty we wszystkich kompleksowych metrykach eksploracji, efektywności nawigacji i bezpieczeństwa.

## Szczegóły

**1. Zadanie**

Nawigacja do obiektu docelowego wewnątrz pomieszczeń dla UAV z **lokomocją 3D**: dron musi samodzielnie eksplorować nieznane otoczenie i dotrzeć do obiektu wskazanego etykietą semantyczną (np. „laptop”, „kuchenka mikrofalowa”), bez żadnej wcześniejszej mapy ani zewnętrznej lokalizacji.

**Moja rola:** zaprojektowałem, wytrenowałem i zwalidowałem politykę eksploracji.

**Dlaczego dwie polityki:** dotychczasowe prace używają jednej polityki dotarcia do celu (LSTM + dopasowanie tekstu i obrazu przez CLIP). W AI2-THOR to wystarcza, bo pokoje są małe, a cel zwykle widać po jednym obrocie; gdy jednak cel znajduje się w innym pomieszczeniu, CLIP nie ma z czym dopasowywać i agent kręci się w miejscu. Dlatego rozdzielamy zachowanie w zależności od tego, czy cel jest w polu widzenia, rozszerzamy je na ruch 3D dla dronów i skalujemy od pojedynczych pokoi do środowisk wielopokojowych.

**2. Struktura**
{: #framework}

Framework RL z dwiema politykami, który przełącza się między dwoma trybami w zależności od widoczności celu:

- **Tryb eksploracji** — maksymalizacja pokrycia przestrzeni w nieznanym otoczeniu
- **Tryb dotarcia do celu** — sterowanie wizyjne w kierunku wykrytego obiektu docelowego

<div class="media-row">
  <div>
    <img src="/assets/img/p2_model_arch.jpg" alt="Architektura AION z dwiema politykami">
  </div>
  <div>
    <img src="/assets/img/p2_visual_input.jpg" alt="Wyodrębnianie ROI na podstawie głębi">
  </div>
</div>

**3. Tryb eksploracji**
{: #exploration}

**Wejście:**
Mapa głębi + ROI (Region of Interest, obszar zainteresowania). ROI wskazuje na obrazie głębi otwarte, przejezdne obszary — naśladuje to, jak ludzie instynktownie patrzą w stronę otwartej przestrzeni podczas nawigacji. ROI jest wyznaczany metodami opartymi na OpenCV i dostarcza wskazówkę kierunkową (położenie centroidu $$(d_x, d_y)$$ oraz średnia głębia $$\bar{z}$$), a nie bezwzględną informację o nieznanej przestrzeni.

**Nagrody:**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$: nagroda za ruch w stronę otwartej przestrzeni
- $$R_{center}$$: kara za odchylenie kąta odchylenia (yaw) od centroidu ROI
- $$R_{safe}$$: kara za kolizję / zbliżenie do przeszkody
- oraz premia za pokrytą powierzchnię

Podanie surowego RGB-D wprost do LSTM nie prowadzi do zachowań eksploracyjnych; to wskazówka z ROI daje polityce rekurencyjnej wyraźne poczucie kierunku, bez odometrii i mapy. Według naszej wiedzy jest to pierwsza czysto wizyjna polityka eksploracji dla robotów latających, niewymagająca mapy.

**4. Tryb dotarcia do celu**

**Wejście:**
Obraz RGB + zamrożony osadzony tekst CLIP (dopasowuje cechy tekstowe i wizualne na potrzeby rozpoznawania obiektów zero-shot) + ramka ograniczająca obiektu/klasy.

**Nagrody:**

$$r_t^G = R_{dist} + R_{bbox} + R_{parent} + R_{suc} - R_{collision}$$

- $$R_{dist}$$: nagroda za zmniejszanie odległości euklidesowej do celu
- $$R_{bbox}$$: nagroda za wycentrowanie i powiększenie ramki ograniczającej celu w polu widzenia (oznacza zbliżanie się do obiektu)
- $$R_{parent}$$: nagroda za klasę nadrzędną — np. dotarcie do biurka daje częściową nagrodę, jeśli celem jest laptop leżący na tym biurku
- $$R_{suc}$$: nagroda za sukces zadania
- $$R_{collision}$$: kara za kolizję

**5. Przestrzeń akcji**

Dyskretne akcje **3D** — do przodu, obrót w lewo/prawo, wznoszenie, opadanie itd.

**6. Ewaluacja**
{: #evaluation}

Ewaluacja w dwóch symulatorach: AI2-THOR (standardowy benchmark z podziałem na obiekty widziane i niewidziane) oraz IsaacSim (większe środowiska wielopokojowe, w których cel może znajdować się w innym pomieszczeniu).

Pojedyncze pokoje AI2-THOR nie pozwalają testować eksploracji — cel jest często widoczny od początku — dlatego zbudowaliśmy w IsaacSim wielopokojową ewaluację (Chemistry Lab, Beechwood, Ihlen), w której cele umieszczono w pokojach niewidocznych na starcie. Metody z samą polityką dotarcia do celu kręcą się w miejscu; z polityką eksploracji dron kieruje się ku otwartej przestrzeni i znajduje cel w kolejnych pokojach.

{% include svg_figure.liquid name="aion_thor" caption="Benchmark AI2-THOR na dwóch podziałach obiektów. AION prowadzi we wszystkich metrykach na obu podziałach; na podziale niewidzianym 18/4 poprawia wynik MJO o 4,3 punktu w SR i 3,5 w SPL." %}

{% include svg_figure.liquid name="aion_isaac" caption="Ewaluacja międzyscenowa w IsaacSim w trzech scenach wielopokojowych z wiernymi modelami dronów. Każda kropka to jedna próba (pięć na obiekt i scenę); AION odnosi sukces w 52 z 60 prób, wobec 40 i 35 dla eksploracji połączonej z MJO i SSNet." %}

<div class="media-row">
  <div>
    <img src="/assets/img/p2_isaac.jpg" alt="Sceny IsaacSim i obiekty docelowe">
  </div>
  <div>
    <img src="/assets/img/p2_exploration_beechwood.png" alt="Trajektorie eksploracji w scenie Beechwood">
  </div>
</div>
