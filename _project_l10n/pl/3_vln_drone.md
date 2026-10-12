---
lang: pl
project: 3_vln_drone
title: "Nawigacja wizyjno-językowa dla autonomicznego drona"
source_hash: a77378003039
---

<p class="project-links">
  <a href="https://github.com/YC11Hou/habitat-aerial-nav" target="_blank" rel="noopener">
    <i class="fab fa-github"></i> Kod: github.com/YC11Hou/habitat-aerial-nav
  </a>
</p>

<nav class="contrib">
  <p>Co zrobiłem · kliknij kartę, aby przejść do sekcji</p>
  <ol>
    <li><a href="#pipeline"><strong>Potok generowania trajektorii</strong><span>Lattice A* · start → przelot → lądowanie</span></a></li>
    <li><a href="#overview"><strong>Zbiór danych</strong><span>90 scen · ponad 10 000 trajektorii, otwarte źródło</span></a></li>
  </ol>
</nav>

## Demo

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="/assets/img/vln_highlights_poster.jpg">
      <source src="/assets/video/vln_highlights.mp4" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video autoplay loop muted playsinline preload="metadata" poster="/assets/img/vln_overview_poster.jpg">
      <source src="/assets/video/vln_overview.webm" type="video/webm">
    </video>
  </div>
</div>

<div class="media-row">
  <div>
    <img src="/assets/img/p3_3dvln.jpg" alt="Widok z perspektywy drona podczas generowania trajektorii">
  </div>
  <div>
    <img src="/assets/img/p3_3stage_traj.jpg" alt="Trajektoria trzyetapowa: start, przelot, lądowanie">
  </div>
</div>

## Przegląd {#overview}

Zbudowałem solidny potok generujący zróżnicowane trójwymiarowe trajektorie nawigacyjne w symulatorze Habitat, przeznaczone do trenowania polityk nawigacji wizyjno-językowej (VLN) dla robotów latających.

**Motywacja:** istniejące zbiory danych VLN dotyczą robotów naziemnych i dyskretnych grafów nawigacji; drony potrzebują ciągłych trajektorii 3D obejmujących start, przelot i lądowanie, a takiego zbioru nie było, więc stworzyliśmy go od podstaw.

**Symulator:** Habitat z 90 scenami wnętrz.

**Skala:** 90 scen × 200–300 par start–cel każda → **ponad 10 000** trzyetapowych trajektorii 3D z instrukcjami w języku naturalnym, udostępnionych jako otwarte źródło na GitHubie.

## Potok {#pipeline}

{% include svg_figure.liquid name="vln_pipeline" caption="Czteroetapowy potok generowania. Lattice A* planuje na prymitywach ruchu w przestrzeni (x, y, θ), dzięki czemu dron skręca w trakcie lotu do przodu, zamiast wykonywać zakręty pod kątem prostym jak w Grid A* (szkic poniżej, poglądowy)." %}

1. **Generowanie par start–cel** — Dla każdej z 90 scen generuję 200–300 losowych dwuwymiarowych par start–cel jako punkty końcowe nawigacji.

2. **Planowanie dwuwymiarowej ścieżki przelotu** — Dla każdej sceny wyznaczam odpowiednią stałą wysokość przelotu, a następnie planuję na niej naturalną ścieżkę 2D algorytmem **Lattice A\***. W przeciwieństwie do standardowego Grid A\*, który daje sztywne zakręty pod kątem prostym, Lattice A\* planuje na prymitywach ruchu w ciągłej przestrzeni stanów $$(x, y, \theta)$$, tworząc gładkie ścieżki, na których agent skręca w trakcie lotu do przodu. Heurystyka:

   $$H(s) = \frac{\|p - p_{goal}\|}{L} + \lambda \cdot |\Delta\theta|$$

   Penalizuje ona ostre zakręty, co zapewnia gładkie, realistyczne trajektorie lotu.

3. **Składanie trajektorii 3D** — Do każdej ścieżki przelotu dodaję na początku odcinek **startu**, a na końcu odcinek **lądowania**, tworząc kompletną trajektorię 3D. Obserwacje RGB-D zebrane wzdłuż całej ścieżki zapisuję jako wideo.

4. **Generowanie instrukcji** — Za pomocą modelu wideo-na-tekst generuję instrukcje nawigacyjne w języku naturalnym na podstawie zebranych nagrań obserwacji, uzyskując kompletny zbiór danych VLN.

Konstrukcja jest celowo uproszczona — dron nie zmienia często wysokości w trakcie lotu — a mimo to start i lądowanie w połączeniu z instrukcjami są już trudne dla obecnych modeli. Trenowaniem polityk na tym zbiorze zajmują się koledzy z laboratorium.
