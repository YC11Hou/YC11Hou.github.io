---
lang: pl
project: 0_honor_internship
title: "Honor Humanoid: RL na prawdziwym robocie dla VLA"
source_hash: b1ae248d5011
---

Praca nad własnym **robotem humanoidalnym** firmy Honor: zbieranie danych teleoperacji, odtwarzanie, trening i wdrożenie na robocie, a także badania nad algorytmami **RL na prawdziwym robocie** dla modeli **Vision-Language-Action (VLA)** w niestandardowych zadaniach manipulacyjnych.

<nav class="contrib">
  <p>Co zrobiłem · kliknij kartę, aby przejść do sekcji</p>
  <ol>
    <li><a href="#loop"><strong>Kompletny pipeline VLA</strong><span>Zbieranie → trening → wdrożenie, laboratorium zbudowane od zera</span></a></li>
    <li><a href="#data-design"><strong>Projekt danych offline</strong><span>4 kategorie: śledzenie + odzyskiwanie</span></a></li>
    <li><a href="#infra"><strong>Infrastruktura treningu z przejęciem przez człowieka</strong><span>Przejęcie · pętla Actor–Learner–Robot · nowe zadanie ≈ 0% → 50%+</span></a></li>
    <li><a href="#algorithms"><strong>Algorytmy RL na prawdziwym robocie</strong><span>RECAP · RAPID · loko-manipulacja</span></a></li>
    <li><a href="#rove"><strong>Reprodukcja ROVE</strong><span>Skuteczność autonomiczna 40% → 52%</span></a></li>
    <li><a href="#debugging"><strong>Debugowanie na prawdziwym robocie</strong><span>6 błędów, każdy znaleziony sondą</span></a></li>
  </ol>
</nav>

## Demonstracje

### Wnioskowanie na robocie przy zakłóceniach

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/inference_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/inference_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Autonomiczne przebiegi pick-and-place na prawdziwym robocie, podczas których obiekt (po lewej) i docelowy kosz (po prawej) są przesuwane w trakcie epizodu — polityka ponownie namierza cel i kończy zadanie. Dłoń nigdy nie przestaje się poruszać, a polityka nie czeka, aż obiekt się uspokoi: nauczyła się śledzenia wzrokowego i odrzucania zakłóceń, a nie pojedynczej trajektorii pick-and-place.

### Projekt danych pod kątem odporności

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/data_design_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/data_design.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Cztery kategorie demonstracji teleoperowanych: demonstracje standardowe, zakłócenia w fazie chwytania, zakłócenia w fazie odkładania oraz odzyskiwanie po nieudanym chwycie — zaprojektowane tak, aby polityka uczyła się odzyskiwać sprawność, a nie tylko powtarzać ruch.

### SFT na prawdziwym robocie: przed i po

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Zadanie, którego polityka wytrenowana offline nie potrafiła wykonać, zostaje opanowane na robocie dzięki pętli uczenia na prawdziwym robocie — dane z przejęć przez człowieka wracają do treningu, a odsetek przejęć spada wraz z kolejnymi wysyłanymi checkpointami.

## 1. Kompletny pipeline VLA {#loop}

Laboratorium w Szanghaju zostało zbudowane od zera po moim dołączeniu: konfiguracja robota, dwa stanowiska teleoperacji (Pico VR i motion capture), szkolenie operatorów zbierających dane oraz pipeline treningowy. Zadanie to pick-and-place (butelka → kosz) z jedną stałą instrukcją.

{% include svg_figure.liquid name="honor_pipeline" caption="Kompletny pipeline na prawdziwym robocie. GR00T N1.7 (3B) jest dotrenowywany przy zamrożonym szkielecie wizyjno-językowym; 37-wymiarowa akcja jest wybierana ze 115-wymiarowego stanu robota. Nie ma zbioru walidacyjnego, więc checkpointy zapisuje się co 2K kroków i wybiera na podstawie przebiegów na robocie; strata osiąga plateau po około 15K kroków." %}

{% include svg_figure.liquid name="honor_chunk" caption="Przekazywanie fragmentów akcji (action chunks) podczas wnioskowania. Kolejny fragment jest żądany, gdy zostaje 15 kroków; akcje, które zdezaktualizowały się w trakcie wnioskowania, są odrzucane, a nakładający się odcinek jest liniowo przenikany, dzięki czemu robot nie szarpie na styku fragmentów." %}

**Na robocie** faza odkładania prawie nigdy się nie psuje — polityka nadąża nawet wtedy, gdy kosz jest szybko przeciągany. Porażki w chwytaniu korelują z położeniem obiektu; źródłem okazały się dane (stała postawa, brak ruchu lokalnego podczas zbierania, więc model nigdy nie wyrabia sobie poczucia odległości), a nie dokładność ramienia. Efekt: laboratorium zyskało własną pętlę iteracji „zbieranie → fine-tuning → walidacja na robocie”, zamiast polegać na modelach dostarczanych z zewnątrz.

## 2. Projekt danych offline {#data-design}

**Dlaczego cztery kategorie danych.** Kategorie ①–③ (standardowa, zakłócenia w fazie chwytania, zakłócenia w fazie odkładania) uczą politykę _śledzić_ poruszający się obiekt lub pojemnik. Kategoria ④ uczy _odzyskiwać sprawność_: wychodząc z pozycji zawisu tuż po nieudanym chwycie, demonstracja opuszcza dłoń, chwyta ponownie i odkłada. Bez niej polityka często nie zauważa, że chwyt się nie udał — unosi pustą dłoń, przenosi ją do kosza i „odkłada” nic. Cztery kategorie są mniej więcej zrównoważone; odporność widoczna w powyższym demo wynika z takiego projektu danych, a nie ze strojenia hiperparametrów.

## 3. Infrastruktura treningu na prawdziwym robocie z przejęciem przez człowieka {#infra}

### 3.1 Przejęcie przez człowieka i pipeline danych sterowany interwencjami {#takeover}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/takeover_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/takeover_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">Teleoperator przejmuje sterowanie w trakcie epizodu i oddaje je z powrotem (3× przyspieszenie, bez dźwięku).</p>

**Płynne przejęcie przez człowieka.** Uczenie na prawdziwym robocie wymaga, aby człowiek mógł przejąć sterowanie w dowolnej chwili bez szarpnięcia robota. Przy przejęciu temat poleceń VLA jest przekierowywany na temat teleoperacji, a kontroler wystawia _przyrost_ względem ostatniej akcji VLA, a nie bezwzględne kąty stawów teleoperatora.

{% include svg_figure.liquid name="honor_fsm" caption="Maszyna stanów przełączania i reguła wyjścia przy przejęciu. Przejęcia są także zapisywane w danych, więc każdy epizod wie, które klatki pochodzą od człowieka." %}

**Pipeline danych sterowany interwencjami.** Każdy epizod jest zapisywany, a operator może jedynie obniżyć werdykt klasyfikatora sukcesu, nigdy nie awansuje porażki do sukcesu; decyzje klasyfikatora oraz statystyki fałszywie dodatnich/ujemnych są logowane obok. Bufor to ograniczony pierścień numpy z kubełkami sukcesów i porażek, usuwaniem miękkim FIFO oraz próbkowaniem ważonym (korekta ważności PER), a punkt końcowy HTTP do przeglądu pozwala obejrzeć każdy epizod, zanim trafi do treningu. W innej rundzie 127 z 138 zebranych epizodów weszło do bufora jako sukcesy (11 w pełni autonomicznych, 116 z demonstracjami z przejęć).

{% include svg_figure.liquid name="honor_datapipe" caption="Od robota do learnera: każdy epizod, także nieudany, jest rejestrowany, oceniany i przesyłany; learner dzieli epizody na kubełki według wyniku. Na dole: skład jednej rundy danych z prawdziwego robota (142–416 klatek na epizod)." %}

### 3.2 Rozproszona pętla uczenia na prawdziwym robocie {#online-loop}

**Zreprodukowałem pętlę rejection sampling z Hi-ORS i przeniosłem ją z π0 + ramienia Dobot na GR00T N1.7 + humanoida.** Jednocześnie działają trzy maszyny.

{% include svg_figure.liquid name="honor_arch" caption="Architektura Actor–Learner–Robot. Actor uruchamia politykę na robocie, do Learnera trafiają tylko udane epizody, a Learner co 1000 kroków odsyła trenowalne wagi do Actora." %}

{% include svg_figure.liquid name="honor_gates" caption="Bramki, które epizod musi przejść, zanim trafi do treningu. Klasyfikator sukcesu to ResNet18 na pojedynczej klatce lewej kamery z jednologitową głowicą, trenowany z BCE + pos_weight na 572 epizodach (podział na poziomie epizodów, augmentacja online, etykiety wyprowadzane automatycznie z sygnałów chwytaka; F1 na poziomie klatek 0.976). Zatrzaskuje się dopiero po 20 kolejnych klatkach powyżej 0.8 — ta histereza została dodana po pierwszej sesji na prawdziwym robocie, w której klasyfikator ogłaszał sukces w ciągu 1–2 s, a fałszywie dodatnie wyniki zapełniały bufor. Kotwice z demonstracji bazowych w każdej paczce chronią przed zapominaniem." %}

### 3.3 Wyniki SFT na prawdziwym robocie: nowe zadanie z ≈ 0% do 50%+ w ~140 epizodach {#results}

Gdy polityka utknie, operator przejmuje sterowanie przez Pico; dane z przejęć płyną prosto do Learnera, a odsetek przejęć służy jako metryka na żywo. **Scena 1** przesuwa butelkę w prawo, gdzie dane offline są rzadkie. **Scena 2** zamienia cały układ stronami (kosz po lewej, butelka po prawej) — dokładne przeciwieństwo wszystkich danych offline — więc bazowy wynik offline SFT wynosi ≈ 0%.

{% include svg_figure.liquid name="honor_curve" caption="Udział kroków teleoperowanych w epizodzie podczas SFT na prawdziwym robocie, wraz z checkpointami wysyłanymi do Actora. Po każdej aktualizacji checkpointu przejęć jest mniej; wzrost około epizodu 86 to przejście na scenę 2. W fazie testowej (checkpointy 5000–7000) odsetek przejęć spada do 18.8%." %}

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Scena</th><th>Zmiana względem danych offline</th><th>Epizody</th><th>SFT offline</th><th>Po SFT na prawdziwym robocie</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Butelka po prawej (rzadka w danych offline)</td><td>20</td><td>nie mierzono</td><td><strong>55.0%</strong></td></tr>
    <tr><td>2</td><td>Kosz po lewej, butelka po prawej (układ odbity lustrzanie)</td><td>12</td><td>≈ 0%</td><td><strong>50.0%</strong></td></tr>
  </tbody>
</table>
</div>

Skuteczność w pełni autonomiczna. Dlaczego zamrożony szkielet może mimo to nauczyć się odbitego układu: błąd polegał na _braku jakiegokolwiek ruchu_, a nie na ruchu w złą stronę — rozumienie wizualne było nienaruszone, brakowało jedynie odwzorowania na akcje.

## 4. Algorytmy RL na prawdziwym robocie {#algorithms}

### 4.1 Trening warunkowany przewagą w stylu RECAP {#recap}

Rejection sampling jest zdegenerowanym, binarnym przypadkiem przewagi: zachowaj każdy sukces, odrzuć każdą porażkę. **Przeniosłem etykietowanie przewagi z π0.6 RECAP (jak w RLinf) na GR00T N1.7**, aby wykorzystać _wszystkie_ dane, traktując „dobre vs. złe” jako warunek wejściowy, a nie filtr — epizody nieudane stają się próbkami negatywnymi zamiast odpadem.

{% include svg_figure.liquid name="honor_recap" caption="Pipeline w stylu RECAP. Kara za porażkę c_fail = 1000 przekracza różnicę między najdłuższym sukcesem (1000 klatek) a najkrótszą porażką (57 klatek), więc każda porażka plasuje się poniżej każdego sukcesu. n = 20 kroków odpowiada horyzontowi 1 s z artykułu przy 20 Hz. Przykłady negatywne kształtują wyłącznie bezwarunkową gałąź CFG." %}

{% include svg_figure.liquid name="honor_value_net" caption="Sieć wartości. Szkielet GR00T pozostaje zamrożony i nie otrzymuje gradientu; tokeny obrazu i tekstu są uśredniane osobno, ponieważ tokenów obrazu jest znacznie więcej niż tekstu i pojedyncza średnia rozmyłaby warunkowanie językowe. RLinf dodaje uczony token CLS i pojedynczą głowicę liniową; szkielet GR00T nie przyjmuje dodatkowych osadzeń wejściowych, więc zamiast tego stosujemy pooling i dodajemy jedną warstwę ukrytą. Szkic rozkładu atomów ma charakter ilustracyjny." %}

Dopóki V nie jest gotowe, rolę zapasową pełnią etykiety regułowe: wszystkie klatki sukcesów pozytywne, autonomiczne klatki porażek negatywne, a 20 klatek przed każdym przejęciem nadpisane jako negatywne. Sieć wartości jest trenowana osobno i akceptowana tylko wtedy, gdy Spearman ρ na epizodach wyłączonych z treningu (co 10. epizod) przekracza 0.55: próba na sucho osiągnęła ρ = 0.647 (plateau 0.59) przy stracie 4.52 → 0.76, podczas gdy kontrola z przetasowanymi etykietami pozostała przy bezwzględnym ρ ≤ 0.26 i nie spełniła kryterium — zatem kryterium ma sens. Zgodność etykiet opartych na V z regułowymi wyniosła tylko 0.31, więc sieć wartości pozostaje wąskim gardłem, a porównanie A/B na prawdziwym robocie nie zostało ukończone.

### 4.2 RAPID: szybka adaptacja w przestrzeni szumu {#rapid}

**RAPID** (_Rapid Adaptation from Physical Interventions via Diffusion-noise_), w duchu DSRL: trening nowego checkpointu zajmuje czas, a dopóki ten nie dotrze, robot nadal nie potrafi wykonać zadania. RAPID zostawia wagi VLA zamrożone i podmienia wyłącznie początkowy szum flow matching, dzięki czemu korekta, której człowiek właśnie dokonał, może zostać użyta ponownie, gdy pojawi się podobny stan. Został podłączony do wnioskowania na robocie pod koniec sierpnia.

{% include svg_figure.liquid name="honor_rapid" caption="RAPID. Offline korekty człowieka są odwracane przez zamrożoną politykę do początkowego szumu, który je odtwarza (64 drobne kroki; 4-krokowa metoda Eulera jest zbyt gruba), i zapisywane w pamięci indeksowanej obserwacją. Podczas wdrożenia odzyskany szum jest interpolowany sferycznie z szumem gaussowskim przed normalnym próbkowaniem flow matching." %}

{% include svg_figure.liquid name="honor_dsbc_net" caption="Sieć szumu DSBC. Mały MLP odwzorowuje klucz wyszukiwania bezpośrednio na szum początkowy, zastępując wyszukiwanie najbliższego sąsiada; samo VLA pozostaje zamrożone. H to 40-krokowy horyzont akcji głowicy akcji GR00T (na jedno wnioskowanie wykonuje się 30 kroków); D to jej wymiar akcji." %}

{% include svg_figure.liquid name="honor_rapid_chart" caption="Walidacja offline na 24 epizodach przejęć w zadaniu zliczania. DSBC prowadzi przy każdym K (54.9–57.0); wyszukiwanie w pamięci osiąga tylko 20 przy K = 1–2 i 45–49 przy K ≥ 4; częściowe zaszumianie pozostaje płaskie na poziomie 37; memory_delta jest poniżej 8. Miarą jest przyrost DTW, a nie skuteczność na prawdziwym robocie." %}

Audyt był **zarejestrowany z góry**: audit PASS; reversal CONDITIONAL (błąd rekonstrukcji 0.232, w przedziale 0.10–0.30); spread obniżony do fragile po ponownym uruchomieniu; transfer PASS (p ≈ 1e-21). Przy tych kryteriach teza „wyszukiwanie wygrywa dla K < 10” została **odrzucona** — projekt eksperymentu obalił moją własną hipotezę — a system zbiegł do DSBC jako głównej ścieżki z wyszukiwaniem w pamięci jako opcjonalnym frontem. Kolejne kroki to destylacja DSBC do polityki, miękkie wycofywanie wpisów pamięci i podłączenie do RL na prawdziwym robocie.

### 4.3 Rozszerzenie na loko-manipulację {#loco}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/locomanip_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/locomanip_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">Humanoid autonomicznie podchodzi do blatu i chwyta butelkę — 7 nagrań z prawdziwego robota, 5× przyspieszenie, bez dźwięku; żółte znaczniki na podłodze to odniesienia ścieżki marszu.</p>

Cały stos — przejęcie, pętla uczenia na prawdziwym robocie, RECAP i RAPID — przeniósł się z pick-and-place na stole na zadanie z chodzeniem bez przepisywania.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Dane loko-manipulacji</th><th>Wartość</th></tr></thead>
  <tbody>
    <tr><td>Zebrane epizody z chodzeniem</td><td>507 epizodów · 181K klatek</td></tr>
    <tr><td>Zachowane po 6 kryteriach selekcji</td><td>326 epizodów</td></tr>
    <tr><td>Połączony zbiór treningowy</td><td><strong>848 epizodów · 306K klatek (+71%)</strong></td></tr>
    <tr><td>Mediana długości ścieżki na epizod</td><td>0.32 m → <strong>3.2 m</strong></td></tr>
  </tbody>
</table>
</div>

**Szczerze o metrykach:** etap SFT na prawdziwym robocie ma komplet liczb (55% / 50%). Po przejściu na zadanie loko wszystkie komponenty zostały zaimplementowane i podłączone, ale nie uzyskano na nim poprawy na poziomie metryk: dojrzałość sprzętu całego ciała i stosu lokomocji w tamtym czasie nie pozwalała na systematyczną ewaluację na prawdziwym robocie.

## 5. Reprodukcja ROVE {#rove}

**Zadanie.** Humanoid stoi w miejscu — stopy unieruchomione, bez chodzenia — i dłonią podnosi telefon: precyzyjna manipulacja, w której drobne niewspółosiowienie szybko kończy się przejęciem przez człowieka.

ROVE (XPENG, arXiv:2606.17011) zachowuje szkielet RECAP z warunkowaniem przewagą (§4.1) i zmienia sposób punktowania przejęć przez człowieka. Zreprodukowałem go na bazie pipeline'u RECAP, za jednym przełącznikiem algorytmu — domyślna ścieżka RECAP pozostaje identyczna co do bitu, co wymuszają autotesty — i uruchomiłem Algorytm 1 z artykułu jako pętlę offline: wdrożenie i zbieranie → zwroty uwzględniające etap → odświeżenie wartości → przewagi i etykiety → warunkowy SFT. Tylko pierwszy krok wymaga robota; pozostałe cztery działają jednym poleceniem.

### 5.1 Zwrot uwzględniający etap {#rove-return}

W RECAP epizod uratowany przez człowieka nadal liczy się jako sukces: jego zwrot rośnie o jeden w każdym kroku aż do 0, więc autonomiczne akcje, które _spowodowały_ przejęcie, wyglądają na stały postęp. Jedynym lekarstwem jest stała reguła oznaczająca 20 klatek przed przejęciem jako negatywne. ROVE dzieli taki epizod na trzy segmenty — wykonanie autonomiczne, adaptację (człowiek wciąż sprowadza robota z powrotem na tor) i odzyskiwanie — i księguje karę za porażkę C_fail w t_r, na końcu adaptacji. Segment autonomiczny, który doprowadził do przejęcia, dostaje teraz wynik na poziomie porażki, a odzyskiwanie zachowuje zwykły zwrot time-to-go.

{% include svg_figure.liquid name="honor_rove_return" caption="Zwrot uwzględniający etap (równanie 2 z artykułu): −1 na krok, C_fail w t_r, klatki bezczynne (operator zmienia tryb) usunięte. Gdy t_r nie jest oznaczone, przyjmuje się moment przejęcia + 40 klatek (2 s); ablacja z artykułu traci 30 pp, gdy t_r umieszczono na początku przejęcia, więc domyślnie błądzimy w stronę późniejszego momentu. C_fail musi przekraczać najdłuższy odcinek w puli pozytywnej, inaczej nieudany epizod wyprzedziłby odzyskiwanie: zmierzona dolna granica na tych danych to 919, stąd C_fail = 1000 (500 z artykułu jest tu za mało). Zwroty zgadzały się z obliczeniem ręcznym co do bitu na 38 zarchiwizowanych epizodach." %}

### 5.2 Optymistyczna estymacja wartości (OVE) {#rove-ove}

Zwykła regresja Monte Carlo uczy się _średniego_ zwrotu. W stanach, które często kończą się przejęciem, średnia jest już niska, więc akcja, która spowodowała przejęcie, dostaje przewagę bliską zeru i nigdy nie jest oznaczana jako negatywna. OVE dostraja tę samą skalarną głowicę wartości, po wstępnym treningu MC, z 16-krokowym celem TD (z kopii sieci EMA) i stratą expectile z τ = 0.7, która karze niedoszacowania silniej niż przeszacowania. V szacuje wtedy, ile stan jest wart, _gdy wszystko idzie dobrze_: stany przed przejęciem mają wysoką wartość, ich faktyczny zwrot jest niski, a ujemna przewaga trafia na akcje, które spowodowały przejęcie. Horyzont przewagi to również 16 kroków — jeden fragment akcji, jednostka, do której przypisana jest etykieta — a górne 40% klatek dostaje etykietę pozytywną.

Każdy checkpoint wartości jest bramkowany przez Spearman ρ na epizodach wyłączonych z treningu: zgodność rang między przewidywanym V a faktycznym zwrotem (1 = ta sama kolejność). Etap MC musi osiągnąć ρ ≥ 0.55 na pełnej puli; etap OVE jest oceniany tylko na epizodach sukcesu (ρ ≥ 0.70), ponieważ OVE z założenia odbiega od średniego zwrotu w stanach prowadzących do porażki, więc niższe ρ na pełnej puli jest oczekiwane, a nie jest regresją.

{% include svg_figure.liquid name="honor_rove_rho" caption="Spearman ρ na danych wyłączonych z treningu w trzech przebiegach treningu wartości (zacieniowane: faza OVE). Czyste przebiegi na robocie: ρ na zbiorze sukcesów utrzymuje się na poziomie 0.744–0.806 po przejściu na OVE, podczas gdy ρ na pełnej puli dryfuje z 0.735 do 0.69, zgodnie z zamierzeniem; bramka 0.70 została ustalona na podstawie tego przebiegu. Demonstracje + przebiegi: ρ na zbiorze sukcesów spada z 0.731 do 0.628 — 85% zbioru wyłączonego to czyste demonstracje, a optymistyczny bootstrapping przesuwa je wszystkie ku górze, ściskając ranking. Pula iter0, uruchomiona z ciepłego startu wprost w OVE: ρ na pełnej puli 0.68–0.71, ρ na zbiorze sukcesów 0.63–0.67, poniżej bramki. Trzy pule mają różne zbiory wyłączone, więc ρ nie jest porównywalne między panelami." %}

<figure class="fig">
  <img src="{{ '/assets/img/honor_rove_value_curve.jpg' | relative_url }}" alt="Krzywe wartości dla epizodu z przejęciem wyłączonego z treningu: prawdziwy zwrot, wartość MC i wartość OVE, z zaznaczonymi klatkami o ujemnej przewadze" loading="lazy" width="1400" height="653">
  <figcaption>Reprodukcja rys. 6 z artykułu na epizodzie z przejęciem wyłączonym z treningu (x: klatka, klatki bezczynne usunięte; y: znormalizowana wartość). Przed t_r wartość OVE (niebieska) leży powyżej wartości MC (pomarańczowej) — optymistycznie w ramach rozkładu — następnie skacze w t_r i podąża za prawdziwym zwrotem przez odzyskiwanie. Czerwone kropki oznaczają klatki z ujemną przewagą OVE: koncentrują się przed przejęciem i w segmencie adaptacji.</figcaption>
</figure>

### 5.3 Wyniki {#rove-results}

Skuteczność autonomiczna na robocie wzrosła z 40% (checkpoint bazowy, n = 77) do **52%** (ROVE iter0, n = 192); sukcesy z pomocą człowieka spadły z 45% do 20% epizodów, a porażki wzrosły z 14% do 28%.

{% include svg_figure.liquid name="honor_rove_robot" caption="Wynik każdego zarejestrowanego epizodu na prawdziwym robocie według checkpointu, oceniony przez operatora. Base 64000: koniec sierpnia – początek września; base 80000: początek – połowa września; ROVE iter0: 17–23 września." %}

iter0 wytrenowano jednym przejściem pętli offline: pula wartości z 2068 epizodów (534K klatek demonstracji i przebiegów na prawdziwym robocie, 207 epizodów wyłączonych), etykiety z dokładnie 40.0% pozytywnych oraz warunkowy SFT od bazowego checkpointu 80K kroków przez 8000 kroków (lr 1e-4) na jednym GPU H20 w 18 h 17 min.

{% include svg_figure.liquid name="honor_rove_sft" caption="Strata warunkowego SFT iter0. Średnia z 200 kroków spada z 0.54 do 0.047 w kroku 1000 i do 0.025 w kroku 8000." %}

**Szczerze o metrykach:** trzy grupy pochodzą z różnych dni, od różnych operatorów i z różnych zestawów promptów, więc to obserwacja, a nie test A/B — przeplatana ewaluacja względem checkpointu bazowego i ramienia RECAP wciąż czeka. Zbieranie iter0 nie zarejestrowało też segmentów przejęć, więc w następnej rundzie zabraknie podstawowego sygnału ROVE, dopóki logowanie nie zostanie naprawione.

## 6. Debugowanie na prawdziwym robocie {#debugging}

Żadnego z tych błędów nie dało się znaleźć, przeglądając kod offline — ujawniały się dopiero podczas długich przebiegów na prawdziwym robocie, a każdy został zlokalizowany za pomocą sondy lub miary ilościowej.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Objaw</th><th>Sonda / dowód</th><th>Przyczyna → poprawka</th></tr></thead>
  <tbody>
    <tr><td>Pogarszająca się generalizacja po fine-tuningu</td><td>Strata na danych wyłączonych 0.0048 → 0.0222 w kroku 2000 (×4.6); kosinus kierunku akcji 0.995 → 0.979 → 0.961</td><td>Mikser danych bazowych czytał mp4 jako BGR, podczas gdy zamrożona wieża wizyjna oczekuje RGB — połowa budżetu gradientu uczyła się szumu; naprawione jedną wartością domyślną. Kotwice obejmowały tylko 29 epizodów (5.6%) → powiększyć bufor bazowy</td></tr>
    <tr><td>Bufor zapełniony fałszywymi sukcesami</td><td>Epizody zatrzaskiwały „sukces” po 24 i 29 krokach; learner trenował na nich przez ponad 1000 kroków</td><td>Zatrzask i reset dzieliły jeden próg 0.5, bez histerezy → zatrzask przy p &gt; 0.8 × 20 klatek, reset przy p ≤ 0.3 × 3 klatki. Późniejszy niezresetowany obiekt wytworzył 2536 śmieciowych kroków w 11 epizodach — tuż powyżej progu treningowego 2500 kroków: audyt klatka po klatce od pierwszej sesji</td></tr>
    <tr><td>Zachowanie różni się między treningiem, wdrożeniem i RL</td><td>Porównanie obserwacji pole po polu w trzech pipeline'ach</td><td>Typ DDS chwytaka, kamera obrócona do góry nogami, inicjalizacja pozycji dłoni, indeksowanie pozycji głowy → lista 9 poprawek</td></tr>
    <tr><td>Robot skręca na początku epizodu</td><td>Mediana dryfu yaw 31°</td><td>Nieaktualna kotwica yaw + pełne ponowne zakotwiczanie w każdym fragmencie → limit tempa 3°/fragment z pułapem 20°; 6 przebiegów walidacyjnych: błąd zakotwiczenia 0.0°, skręt w pierwszej sekundzie ≤ 1.6°</td></tr>
    <tr><td>Nieaktualne klatki kamery</td><td>47% zduplikowanych kolejnych klatek w 77 z 83 epizodów; źródło 61 Hz, dekodowanie 54.9 Hz, efektywnie ≈ 10.6 Hz pod obciążeniem</td><td>Dodano obserwowalność świeżości klatek</td></tr>
    <tr><td>„Model się nie rusza”</td><td>Klient trenera zablokowany w ponowieniach</td><td>Niezgodne porty actora i learnera. Wniosek: każde „model się nie rusza” to najpierw kontrola komunikacji lub obserwacji, dopiero potem kontrola wag</td></tr>
  </tbody>
</table>
</div>
