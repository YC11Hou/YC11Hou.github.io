---
lang: pl
project: 1_vla_benchmark
title: "LangGap: benchmark rozumienia języka przez modele VLA"
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
  <p>Co zrobiłem (pierwszy autor) · kliknij kartę, aby przejść do sekcji</p>
  <ol>
    <li><a href="#benchmark"><strong>Projekt benchmarku</strong><span>99 zadań · 4 wymiary perturbacji</span></a></li>
    <li><a href="#data"><strong>Zbieranie danych</strong><span>16 zadań × 150 demonstracji ze skryptów</span></a></li>
    <li><a href="#training"><strong>Trenowanie modelu</strong><span>π0.5 LoRA · jedno zadanie 0% → 90%</span></a></li>
    <li><a href="#results"><strong>Analiza wyników</strong><span>93.8% → 21.4% · 4 modele VLA</span></a></li>
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

## Przegląd

Modele Vision-Language-Action (VLA) osiągają ponad 95% skuteczności na standardowych benchmarkach. Systematyczne eksperymenty pokazują jednak, że obecne najnowocześniejsze modele VLA w dużej mierze ignorują instrukcje językowe. Dotychczasowym pracom brakowało: (1) systematycznej diagnostyki opartej na perturbacjach semantycznych, (2) benchmarku, który już samą konstrukcją wymusza rozumienie języka, oraz (3) językowo zróżnicowanych danych treningowych. W tej pracy konstruujemy benchmark LangGap, oparty na czterowymiarowej metodzie perturbacji semantycznych — zmieniamy znaczenie instrukcji, utrzymując stały układ obiektów na stole — który ujawnia braki π0.5 w rozumieniu języka. Istniejące benchmarki, takie jak LIBERO, przypisują każdemu układowi sceny tylko jedno zadanie, co niedowykorzystuje dostępne obiekty i miejsca docelowe; LangGap w pełni różnicuje zadania pick-and-place w identycznych układach, zmuszając modele do rzeczywistego rozumienia języka. Eksperymenty pokazują, że ukierunkowana augmentacja danych częściowo zmniejsza lukę językową — skuteczność rośnie z 0% do 90% przy treningu na jednym zadaniu oraz z 0% do 28% przy treningu wielozadaniowym. Jednak wraz ze wzrostem różnorodności semantycznej zadań rozszerzonych okazuje się, że zdolność uczenia się modelu jest wyraźnie niewystarczająca; nawet zadania uczone wypadają słabo. Ujawnia to fundamentalne wyzwanie dla modeli VLA w rozumieniu zróżnicowanych instrukcji językowych — i właśnie na tym polega długofalowa wartość LangGap.

## Szczegóły

**1. Benchmark i zbiór danych**
{: #benchmark}

Benchmark LangGap: łącznie **99 zadań** — 40 oryginalnych zadań LIBERO + 59 rozszerzonych zadań z perturbacjami semantycznymi. Udostępniamy zbiór treningowy obejmujący 56 zadań: 16 samodzielnie zebranych zadań rozszerzonych (po 150 demonstracji) + 40 zadań oryginalnych (po 50 demonstracji), łącznie ok. 4 100 trajektorii.

**2. Odkrycie problemu**
{: #diagnosis}

Gdy w tej samej scenie wizualnej zmienimy instrukcję z „put bowl on plate" na „put bowl on stove", model nadal wykonuje pierwotną akcję (jedzie do talerza) i osiąga **0% skuteczności**. Pokazuje to, że modele VLA dopasowują wzorce między obrazem a akcją, zamiast naprawdę rozumieć język.

Projektujemy czterowymiarową diagnostykę perturbacji semantycznych — Change Object, Change Target, Spatial Description i Drawer Action — w której scena wizualna pozostaje identyczna, a zmienia się wyłącznie instrukcja:

{% include svg_figure.liquid name="langgap_diagnosis" caption="Diagnoza π0.5 na 99 zadaniach i 1 980 epizodach. Nasz ponowny przebieg 40 oryginalnych zadań odpowiada oficjalnemu wynikowi; 59 zadań rozszerzonych traci 72.4 punktu. W kategorii Change Target π0.5 zawodzi we wszystkich 260 epizodach, a żaden z testowanych modeli nie przekracza 2.3%, więc porażka nie wynika z samego sformułowania instrukcji — a wynik zagregowany ją ukrywa." %}

<div class="media-row">
  <div>
    <img src="/assets/img/libero_suites_strip.png" alt="Zestawy ewaluacyjne LIBERO z adnotacjami perturbacji">
  </div>
</div>

**3. Zasady projektowe**
{: #design}

1. **Wiele zadań w jednej scenie** — Wiele zadań dzieli identyczne początkowe stany wizualne, co eliminuje wizualne skróty. Model ignorujący język osiąga co najwyżej skuteczność 1/k (k = liczba zadań na scenę).
2. **Podział trening/ewaluacja na poziomie instrukcji** — Zadania treningowe nie obejmują wszystkich zadań testowych; ewaluacja na zadaniach wstrzymanych zawiera nieznane instrukcje językowe, aby sprawdzić generalizację kompozycyjną.
3. **Weryfikacja wykonalności fizycznej** — Wszystkie zadania rozszerzone zweryfikowano w symulatorze LIBERO, aby zapewnić możliwość chwytania, osiągalność i wykrywalność obiektów.

**4. Potok zbierania danych**
{: #data}

- **Skalowalne i zróżnicowane generowanie:** Stosujemy skryptowy potok zbierania danych oparty na punktach pośrednich (waypointach), który wydajnie i stabilnie gromadzi 150 udanych epizodów na zadanie. Choć waypointy są zakodowane na sztywno dla każdego zadania, symulator wprowadza niewielkie naturalne wariacje początkowego układu obiektów na stole. Dzięki temu zebrane trajektorie są zróżnicowane wizualnie i dynamicznie, co zapobiega zapamiętywaniu przez modele sztywnych, identycznych ścieżek.
- **Hierarchiczna architektura sterowania:** Każde zadanie wykorzystuje własny skrypt, który rozkłada proces pick-and-place na wiele kolejnych waypointów. Na wysokim poziomie stosujemy czyste sterowanie proporcjonalne (P), które oblicza błędy położenia i generuje ciągłe polecenia akcji. Polecenia te wykonuje następnie niskopoziomowy regulator PD typu OSC (Operational Space Control) symulatora, co zapewnia płynne i bardzo precyzyjne sterowanie ciągłe.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_waypoints.jpg" alt="Sekwencja waypointów skryptowej demonstracji: pozycja początkowa, chwyt, transport, odłożenie" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Czasowy przebieg waypointów skryptowej demonstracji (ilustracja): pozycja początkowa → nad obiektem → chwyt → uniesienie → nad celem → odłożenie. Regulator OSC_POSE ze znormalizowanym do [−1, 1] błędem pozy w każdym kroku; epizod jest zachowywany tylko wtedy, gdy zakończy się sukcesem w limicie kroków.</p>

- **Dlaczego skrypty zamiast teleoperacji:** wczesne próby z teleoperacją myszą były szarpane, powolne i niespójne. Skrypty pisane na podstawie współrzędnych obiektów z pliku BDDL każdego zadania były ręcznie dostrajane w symulacji, aż każde zadanie stało się wykonalne pod względem chwytania, osiągalności i wykrywalności — uzyskane akcje są czyste, a zbieranie danych jest w pełni automatyczne: ok. 150 demonstracji na zadanie (oficjalne zadania LIBERO mają ich 50), 16 zadań ≈ 2 400 demonstracji.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_rollout_2x8.jpg" alt="Próbka przebiegów skryptowych demonstracji" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Próbka z 2 400 skryptowych demonstracji.</p>

**Dostrajanie: jedno zadanie z 0% do 90%**
{: #training}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="/assets/img/langgap_before_after_poster.jpg">
    <source src="/assets/video/langgap_before_after.mp4" type="video/mp4">
  </video>
</div>
<p class="caption">Po lewej: przed treningiem — instrukcja mówi „stove", ale polityka nadal kładzie miskę na talerzu. Po prawej: po dostrojeniu na danych rozszerzonych — miska trafia na kuchenkę.</p>

- π0.5 z LoRA (r = 64) na pojedynczym RTX 4090.
- Punkty kontrolne wybieramy na podstawie rolloutów, a nie straty: strata wciąż maleje, podczas gdy skuteczność zmienia się niemonotonicznie.
- Instrukcje treningowe i testowe są dosłownie identyczne, z wyjątkiem 43 zadań wstrzymanych, których instrukcje są nowe.

**5. Wyniki**
{: #results}

{% include svg_figure.liquid name="langgap_benchmark" caption="Pełny benchmark: najnowsze modele VLA na wszystkich czterech zestawach LIBERO, zadania oryginalne i rozszerzone. Każdy model wykazuje dużą lukę językową; nasz π0.5 dostrojony na 45 zadaniach poprawia sumę dla zadań rozszerzonych (22.8) i Change Target (0 → 6.2), zachowując 89.5 na zadaniach oryginalnych. 43 zadania wstrzymane nigdy nie były używane w treningu." %}

{% include svg_figure.liquid name="langgap_progressive" caption="Walidacja progresywna na tych samych danych rozszerzonych, gdy liczba zadań treningowych rośnie od 1 do 56. Zapamiętanie pojedynczego zadania daje 90%, lecz zyski załamują się, gdy równolegle uczone są zadania semantycznie różne; dodanie 40 oficjalnych zadań (56 zadań) przywraca 27.5%, a luka językowa pozostaje." %}

**6. Długofalowa wartość**

Wraz ze wzrostem różnorodności semantycznej zadań zdolność uczenia się modelu okazuje się wyraźnie niewystarczająca — nawet zadania uczone wypadają słabo. Ujawnia to fundamentalne wyzwanie niezależne od architektury: wszystkie testowane modele (π0.5, π0, π0-FAST, SmolVLA) wykazują tę samą lukę językową. LangGap dostarcza systematyczne narzędzie diagnostyczne, które pozostaje wartościowe w miarę pojawiania się nowych architektur VLA, właśnie dlatego, że luka językowa jest trwałym problemem, którego obecne paradygmaty treningu jeszcze nie rozwiązały.
