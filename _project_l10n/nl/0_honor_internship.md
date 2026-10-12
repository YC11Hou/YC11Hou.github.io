---
lang: nl
project: 0_honor_internship
title: "Honor Humanoid: RL op een echte robot voor VLA"
source_hash: b1ae248d5011
---

Werk aan Honors zelfontwikkelde **humanoïde robot**: teleoperatie-dataverzameling, replay, training en uitrol op de robot, plus onderzoek naar **RL op de echte robot** voor **Vision-Language-Action (VLA)**-modellen bij eigen manipulatietaken.

<nav class="contrib">
  <p>Wat ik deed · klik op een kaart om erheen te springen</p>
  <ol>
    <li><a href="#loop"><strong>End-to-end VLA-pipeline</strong><span>Verzamelen → trainen → uitrollen, lab van nul opgebouwd</span></a></li>
    <li><a href="#data-design"><strong>Ontwerp van offline data</strong><span>4 categorieën: volgen + herstellen</span></a></li>
    <li><a href="#infra"><strong>Trainingsinfrastructuur met menselijke overname</strong><span>Overname · Actor–Learner–Robot-lus · nieuwe taak ≈ 0% → 50%+</span></a></li>
    <li><a href="#algorithms"><strong>RL-algoritmen op de echte robot</strong><span>RECAP · RAPID · loco-manipulatie</span></a></li>
    <li><a href="#rove"><strong>ROVE reproduceren</strong><span>Autonoom succes 40% → 52%</span></a></li>
    <li><a href="#debugging"><strong>Debuggen op de echte robot</strong><span>6 bugs, elk gevonden met een probe</span></a></li>
  </ol>
</nav>

## Demo's

### Inferentie op de robot onder verstoringen

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/inference_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/inference_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Autonome pick-and-place-runs op de echte robot, terwijl het object (links) en de doelmand (rechts) halverwege de episode worden verstoord — het beleid volgt opnieuw en voltooit de taak. De hand stopt nooit met bewegen en het beleid wacht niet tot het object tot rust komt: wat het heeft geleerd is visueel volgen en verstoringen opvangen, geen enkel pick-and-place-traject.

### Data-ontwerp voor robuustheid

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/data_design_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/data_design.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Vier categorieën geteleopereerde demonstraties: standaarddemonstraties, verstoringen tijdens de pakfase, verstoringen tijdens de plaatsfase en herstel vanuit mislukte grepen — zo ontworpen dat het beleid leert te herstellen, niet alleen te herhalen.

### SFT op de echte robot: voor en na

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Een taak die het offline getrainde beleid niet kon uitvoeren, wordt op de robot geleerd via de leerlus op de echte robot — data van menselijke overnames stroomt terug in de training en het overnamepercentage daalt naarmate nieuwe checkpoints worden uitgerold.

## 1. End-to-end VLA-pipeline {#loop}

Het lab in Shanghai is na mijn komst van nul opgebouwd: robotconfiguratie, twee teleoperatieopstellingen (Pico VR en motion capture), training van de operators voor dataverzameling en de trainingspipeline. De taak is pick-and-place (fles → mand) met één vaste instructie.

{% include svg_figure.liquid name="honor_pipeline" caption="End-to-end pipeline op de echte robot. GR00T N1.7 (3B) wordt na-getraind met bevroren vision-language-backbone; de 37-D-actie wordt gekozen uit een 115-D-robottoestand. Er is geen validatieset, dus checkpoints worden elke 2K stappen opgeslagen en geselecteerd via rollouts op de robot; het verlies vlakt af na ongeveer 15K stappen." %}

{% include svg_figure.liquid name="honor_chunk" caption="Overdracht van action chunks tijdens inferentie. De volgende chunk wordt opgevraagd terwijl er nog 15 stappen over zijn; acties die tijdens de inferentie verouderd zijn, worden weggelaten en de overlap wordt lineair doorgefaded, zodat de robot tussen chunks niet haperen." %}

**Op de robot** mislukt de plaatsfase bijna nooit — het beleid houdt stand, zelfs als de mand snel wordt weggesleept. Mislukte grepen hangen samen met de positie van het object; dit bleek terug te voeren op de data (vaste houding, geen lokale beweging tijdens het verzamelen, waardoor het model nooit gevoel voor afstand ontwikkelt) en niet op de nauwkeurigheid van de arm. Resultaat: het lab kreeg een eigen iteratielus „verzamelen → finetunen → valideren op de robot” in plaats van afhankelijk te zijn van extern geleverde modellen.

## 2. Ontwerp van offline data {#data-design}

**Waarom vier datacategorieën.** Categorieën ①–③ (standaard, verstoring in de pakfase, verstoring in de plaatsfase) leren het beleid een bewegend object of een bewegende container te _volgen_. Categorie ④ leert het te _herstellen_: vanaf de zweefpositie direct na een gemiste greep zakt de hand in de demonstratie omlaag, grijpt opnieuw en plaatst. Zonder deze categorie merkt het beleid vaak niet dat de greep mislukt is — het tilt een lege hand op, beweegt naar de mand en „plaatst” niets. De vier categorieën zijn ruwweg in evenwicht; de robuustheid in de demo hierboven komt uit dit data-ontwerp, niet uit het afstemmen van hyperparameters.

## 3. Trainingsinfrastructuur op de echte robot met menselijke overname {#infra}

### 3.1 Menselijke overname en door interventies aangedreven datapipeline {#takeover}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/takeover_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/takeover_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">Een teleoperator neemt halverwege de episode over en geeft de besturing weer terug (3× snelheid, zonder geluid).</p>

**Soepele menselijke overname.** Leren op de echte robot vereist dat een mens op elk moment kan overnemen zonder dat de robot schokt. Bij een overname wordt het VLA-commandotopic omgeleid naar het teleoperatietopic en geeft de controller een _increment_ bovenop de laatste VLA-actie, in plaats van de absolute gewrichtshoeken van de teleoperator.

{% include svg_figure.liquid name="honor_fsm" caption="Toestandsmachine voor het omschakelen en de uitvoerregel bij overname. Overnames worden ook in de data vastgelegd, zodat elke episode weet welke frames van de mens afkomstig zijn." %}

**Door interventies aangedreven datapipeline.** Elke episode wordt bewaard en de operator kan de succesclassifier alleen naar beneden corrigeren, nooit een mislukking tot succes bevorderen; beslissingen van de classifier en statistieken over fout-positieven en fout-negatieven worden erbij gelogd. De buffer is een begrensde numpy-ringbuffer met succes- en mislukkingsbuckets, soft-delete-FIFO en gewogen sampling (PER-importancecorrectie), en een HTTP-reviewendpoint maakt het mogelijk elke episode te inspecteren voordat die de training bereikt. In een andere ronde kwamen 127 van de 138 verzamelde episodes als succes in de buffer (11 volledig autonoom, 116 met overnamedemonstraties).

{% include svg_figure.liquid name="honor_datapipe" caption="Van robot naar learner: elke episode, ook mislukte, wordt opgenomen, beoordeeld en geüpload; de learner verdeelt episodes naar uitkomst over buckets. Onder: samenstelling van één ronde data van de echte robot (142–416 frames per episode)." %}

### 3.2 Gedistribueerde leerlus op de echte robot {#online-loop}

**De Hi-ORS-rejection-samplinglus gereproduceerd en overgezet van π0 + een Dobot-arm naar GR00T N1.7 + een humanoïde.** Drie machines draaien tegelijk.

{% include svg_figure.liquid name="honor_arch" caption="Actor–Learner–Robot-architectuur. De Actor draait het beleid op de robot, alleen geslaagde episodes bereiken de Learner en de Learner stuurt de trainbare gewichten om de 1.000 stappen terug naar de Actor." %}

{% include svg_figure.liquid name="honor_gates" caption="Poorten voordat een episode de training in gaat. De succesclassifier is een ResNet18 op één frame van de linkercamera met een kop met één logit, getraind met BCE + pos_weight op 572 episodes (split op episodeniveau, online augmentatie, labels automatisch afgeleid uit grijpersignalen; F1 op framenivo 0,976). Hij vergrendelt pas na 20 opeenvolgende frames boven 0,8 — deze hysterese is toegevoegd na de eerste sessie op de echte robot, waar de classifier binnen 1–2 s succes meldde en fout-positieven de buffer vulden. Ankers van basisdemonstraties in elke batch beschermen tegen vergeten." %}

### 3.3 Resultaten van SFT op de echte robot: een nieuwe taak van ≈ 0% naar 50%+ in ~140 episodes {#results}

Wanneer het beleid vastloopt, neemt de operator over via Pico; overnamedata stroomt rechtstreeks naar de Learner en het overnamepercentage dient als live metriek. **Scène 1** verplaatst de fles naar rechts, waar de offline data schaars is. **Scène 2** spiegelt de hele opstelling links–rechts (mand links, fles rechts) — precies het tegenovergestelde van alle offline data — waardoor de offline SFT-baseline ≈ 0% haalt.

{% include svg_figure.liquid name="honor_curve" caption="Aandeel geteleopereerde stappen per episode tijdens SFT op de echte robot, met de checkpoints die naar de Actor zijn gestuurd. Na elke checkpointupdate daalt het aantal overnames; de stijging rond episode 86 is de overgang naar scène 2. Tijdens de testfase (checkpoints 5000–7000) daalt het overnamepercentage naar 18,8%." %}

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Scène</th><th>Verschil met offline data</th><th>Episodes</th><th>Offline SFT</th><th>Na SFT op de echte robot</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Fles rechts (schaars in offline data)</td><td>20</td><td>niet gemeten</td><td><strong>55,0%</strong></td></tr>
    <tr><td>2</td><td>Mand links, fles rechts (opstelling gespiegeld)</td><td>12</td><td>≈ 0%</td><td><strong>50,0%</strong></td></tr>
  </tbody>
</table>
</div>

Volledig autonoom slagingspercentage. Waarom een bevroren backbone de gespiegelde opstelling toch kan leren: de foutmodus was _helemaal niet bewegen_ en niet de verkeerde kant op bewegen — het visuele begrip was intact, alleen de actiemapping ontbrak.

## 4. RL-algoritmen op de echte robot {#algorithms}

### 4.1 Advantage-geconditioneerde training in RECAP-stijl {#recap}

Rejection sampling is een binair, gedegenereerd geval van advantage: behoud elk succes, gooi elke mislukking weg. **De advantage-labeling van π0.6 RECAP (zoals in RLinf) overgezet naar GR00T N1.7**, zodat _alle_ data wordt gebruikt, met „goed versus slecht” als invoerconditie in plaats van als filter — mislukte episodes worden negatieve voorbeelden in plaats van afval.

{% include svg_figure.liquid name="honor_recap" caption="Pipeline in RECAP-stijl. De mislukkingsstraf c_fail = 1000 is groter dan het verschil tussen het langste succes (1.000 frames) en de kortste mislukking (57 frames), dus elke mislukking scoort lager dan elk succes. n = 20 stappen komt overeen met de horizon van 1 s uit het artikel bij 20 Hz. Negatieven sturen alleen de onvoorwaardelijke CFG-tak." %}

{% include svg_figure.liquid name="honor_value_net" caption="Value-netwerk. De GR00T-backbone blijft bevroren en krijgt geen gradiënt; beeld- en teksttokens worden apart gemiddeld (mean-pooling), omdat beeldtokens ver in de meerderheid zijn en één enkel gemiddelde de taalconditionering zou verdunnen. RLinf voegt een leerbaar CLS-token toe en gebruikt één lineaire kop; de GR00T-backbone accepteert geen extra invoer-embeddings, dus poolen we en voegen we één verborgen laag toe. De schets van de atoomverdeling is illustratief." %}

Totdat V gereed is, dienen regelgebaseerde labels als terugval: alle succesframes positief, autonome frames van mislukkingen negatief en de 20 frames vóór elke overname overschreven als negatief. Het value-netwerk wordt apart getraind en alleen geaccepteerd als Spearman ρ op achtergehouden episodes (elke 10e episode) hoger is dan 0,55: de proefrun haalde ρ = 0,647 (plateau 0,59) met verlies 4,52 → 0,76, terwijl een controle met geschudde labels op een absolute ρ ≤ 0,26 bleef en het criterium niet haalde — het criterium is dus zinvol. De overeenstemming tussen V-gebaseerde en regelgebaseerde labels was slechts 0,31, dus het value-netwerk blijft de bottleneck en de A/B-vergelijking op de echte robot is niet afgerond.

### 4.2 RAPID: snelle adaptatie in de ruimte van ruis {#rapid}

**RAPID** (_Rapid Adaptation from Physical Interventions via Diffusion-noise_), in de geest van DSRL: het trainen van een nieuw checkpoint kost tijd en tot het klaar is kan de robot de taak nog steeds niet. RAPID laat de VLA-gewichten bevroren en vervangt alleen de initiële ruis van flow matching, zodat een correctie die de mens zojuist maakte, hergebruikt kan worden zodra een vergelijkbare toestand zich opnieuw voordoet. Het werd eind augustus in de inferentie op de robot geïntegreerd.

{% include svg_figure.liquid name="honor_rapid" caption="RAPID. Offline worden menselijke correcties via het bevroren beleid geïnverteerd tot de initiële ruis die ze reproduceert (64 fijne stappen; 4-staps Euler is te grof) en opgeslagen in een geheugen met observaties als sleutel. Bij uitrol wordt de opgehaalde ruis sferisch geïnterpoleerd met Gaussische ruis vóór de gewone flow-matching-sampling." %}

{% include svg_figure.liquid name="honor_dsbc_net" caption="DSBC-ruisnetwerk. Een klein MLP koppelt de ophaalsleutel rechtstreeks aan de initiële ruis en vervangt zo de nearest-neighbour-opzoeking; de VLA zelf blijft bevroren. H is de actiehorizon van 40 stappen van de GR00T-actiekop (30 stappen worden per inferentie uitgevoerd); D is de actiedimensie." %}

{% include svg_figure.liquid name="honor_rapid_chart" caption="Offline validatie op 24 overname-episodes van een telltaak. DSBC leidt bij elke K (54,9–57,0); geheugenophaling haalt slechts 20 bij K = 1–2 en 45–49 bij K ≥ 4; gedeeltelijke ruisinjectie blijft vlak op 37; memory_delta ligt onder 8. De metriek is DTW-winst, niet het slagingspercentage op de echte robot." %}

De audit was **vooraf geregistreerd**: audit PASS; reversal CONDITIONAL (reconstructiefout 0,232, binnen 0,10–0,30); spread na een herhaalde run afgewaardeerd naar fragiel; transfer PASS (p ≈ 1e-21). Onder deze criteria werd de bewering „ophalen wint bij K < 10” **geschrapt** — het experimentele ontwerp verwierp mijn eigen hypothese — en het systeem convergeerde naar DSBC als hoofdpad met geheugenophaling als optionele voorkant. Vervolgstappen waren DSBC destilleren in het beleid, geheugenitems zacht uitfaseren en het koppelen aan RL op de echte robot.

### 4.3 Uitbreiding naar loco-manipulatie {#loco}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/locomanip_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/locomanip_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">De humanoïde loopt autonoom naar een aanrecht en pakt een fles — 7 clips van de echte robot, 5× snelheid, zonder geluid; gele vloermarkeringen zijn referenties voor het looppad.</p>

De hele stack — overname, de leerlus op de echte robot, RECAP en RAPID — ging zonder herschrijven over van pick-and-place op tafel naar een taak met lopen.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Loco-manipulatiedata</th><th>Waarde</th></tr></thead>
  <tbody>
    <tr><td>Verzamelde looppepisodes</td><td>507 episodes · 181K frames</td></tr>
    <tr><td>Behouden na 6 screeningcriteria</td><td>326 episodes</td></tr>
    <tr><td>Samengevoegde trainingsset</td><td><strong>848 episodes · 306K frames (+71%)</strong></td></tr>
    <tr><td>Mediane padlengte per episode</td><td>0,32 m → <strong>3,2 m</strong></td></tr>
  </tbody>
</table>
</div>

**Eerlijk over de metrieken:** de SFT-fase op de echte robot heeft complete cijfers (55% / 50%). Na de overstap naar de loco-taak waren alle componenten geïmplementeerd en aangesloten, maar er werd daarop geen verbetering op metriekniveau bereikt: de toenmalige maturiteit van de whole-body-hardware en de locomotiestack liet geen systematische evaluatie op de echte robot toe.

## 5. ROVE reproduceren {#rove}

**Taak.** De humanoïde staat stil — voeten vast, niet lopend — en pakt met de hand een telefoon op: fijne manipulatie waarbij een kleine afwijking snel tot een menselijke overname leidt.

ROVE (XPENG, arXiv:2606.17011) behoudt het advantage-conditioneringsskelet van RECAP (§4.1) en verandert hoe menselijke overnames worden gescoord. Ik reproduceerde het bovenop de RECAP-pipeline achter één enkele algoritmeschakelaar — het standaard RECAP-pad blijft bitgelijk, afgedwongen door zelftests — en draaide Algoritme 1 uit het artikel als offline lus: uitrollen en verzamelen → stage-aware returns → value-verversing → advantages en labels → conditionele SFT. Alleen de eerste stap heeft de robot nodig; de andere vier draaien als één commando.

### 5.1 Stage-aware return {#rove-return}

Onder RECAP telt een episode die een mens heeft gered nog steeds als succes: de return stijgt elke stap met één tot 0, waardoor de autonome acties die de overname _veroorzaakten_ op gestage vooruitgang lijken. Het enige redmiddel is een vaste regel die de 20 frames vóór een overname negatief labelt. ROVE splitst zo'n episode in drie segmenten — autonome uitvoering, adaptatie (de mens trekt de robot nog terug op koers) en herstel — en boekt een mislukkingsstraf C_fail op t_r, het einde van de adaptatie. Het autonome segment dat tot de overname leidde, scoort nu op mislukkingsniveau, terwijl het herstel zijn normale time-to-go-return houdt.

{% include svg_figure.liquid name="honor_rove_return" caption="Stage-aware return (vgl. 2 van het artikel): −1 per stap, C_fail op t_r, inactieve frames (operator wisselt van modus) verwijderd. t_r valt terug op overname + 40 frames (2 s) als het niet geannoteerd is; de ablatie in het artikel verliest 30 pp wanneer t_r op het begin van de overname wordt gezet, dus de standaard kiest liever laat. C_fail moet groter zijn dan de langste spanne in de positieve pool, anders zou een mislukte episode hoger scoren dan een herstel: de gemeten ondergrens op deze data is 919, dus C_fail = 1000 (de 500 uit het artikel is hier te klein). Returns kwamen bit voor bit overeen met handberekening op 38 gearchiveerde episodes." %}

### 5.2 Optimistische value-schatting (OVE) {#rove-ove}

Gewone Monte-Carlo-regressie leert de _gemiddelde_ return. In toestanden die vaak op een overname uitlopen is het gemiddelde al laag, dus de actie die de overname veroorzaakte krijgt een advantage rond nul en wordt nooit negatief gelabeld. OVE finetunet dezelfde scalaire value-kop, na MC-voortraining, met een TD-doel van 16 stappen (uit een EMA-kopie van het netwerk) en een expectile-verlies met τ = 0,7, dat onderschattingen zwaarder bestraft dan overschattingen. V schat dan wat een toestand waard is _als het goed gaat_: toestanden vóór een overname krijgen een hoge waarde, hun werkelijke return is laag en de negatieve advantage valt op de acties die de overname veroorzaakten. De advantage-horizon is eveneens 16 stappen — één action chunk, de eenheid waaraan het label hangt — en de top 40% van de frames wordt positief gelabeld.

Elk value-checkpoint wordt getoetst met Spearman ρ op achtergehouden episodes: de rangovereenstemming tussen voorspelde V en de werkelijke return (1 = zelfde volgorde). De MC-fase moet ρ ≥ 0,55 halen op de volledige pool; de OVE-fase wordt alleen op succesepisodes beoordeeld (ρ ≥ 0,70), omdat OVE bij toestanden die op mislukking afstevenen bewust afwijkt van de gemiddelde return, zodat een lagere ρ op de volledige pool wordt verwacht en geen terugval is.

{% include svg_figure.liquid name="honor_rove_rho" caption="Spearman ρ op achtergehouden data in drie value-trainingsruns (gearceerd: OVE-fase). Schone rollouts: ρ op de succesverzameling blijft na de overstap naar OVE op 0,744–0,806, terwijl ρ op de volledige pool zoals bedoeld van 0,735 naar 0,69 afdrijft; de drempel van 0,70 is uit deze run afgeleid. Demo's + rollouts: ρ op de succesverzameling zakt van 0,731 naar 0,628 — 85% van de achtergehouden set bestaat uit schone demonstraties en optimistische bootstrapping duwt ze allemaal naar boven, waardoor de rangschikking samengedrukt wordt. iter0-pool, direct warm gestart in OVE: ρ op de volledige pool 0,68–0,71, op de succesverzameling 0,63–0,67, onder de drempel. De drie pools hebben verschillende achtergehouden sets, dus ρ is niet vergelijkbaar tussen de panelen." %}

<figure class="fig">
  <img src="{{ '/assets/img/honor_rove_value_curve.jpg' | relative_url }}" alt="Value-curves op een achtergehouden overname-episode: ware return, MC-value en OVE-value, met frames met negatieve advantage gemarkeerd" loading="lazy" width="1400" height="653">
  <figcaption>Reproductie van Fig. 6 uit het artikel op een achtergehouden episode met een overname (x: frame, inactieve frames verwijderd; y: genormaliseerde value). Vóór t_r ligt de OVE-value (blauw) boven de MC-value (oranje) — optimistisch in verdeling — springt daarna op t_r omhoog en volgt tijdens het herstel de ware return. Rode stippen markeren frames met negatieve OVE-advantage: ze concentreren zich vóór de overname en in het adaptatiesegment.</figcaption>
</figure>

### 5.3 Resultaten {#rove-results}

Het autonome succes op de robot steeg van 40% (basischeckpoint, n = 77) naar **52%** (ROVE iter0, n = 192); met menselijke hulp behaalde successen daalden van 45% naar 20% van de episodes, terwijl mislukkingen stegen van 14% naar 28%.

{% include svg_figure.liquid name="honor_rove_robot" caption="Uitkomst van elke gelogde episode op de echte robot per checkpoint, zoals beoordeeld door de operator. Base 64000: eind aug – begin sep; base 80000: begin – half sep; ROVE iter0: 17–23 sep." %}

iter0 werd getraind met één doorgang van de offline lus: een value-pool van 2.068 episodes (534K frames aan demonstraties en rollouts op de echte robot, 207 episodes achtergehouden), labels met precies 40,0% positief en conditionele SFT vanaf het basischeckpoint van 80K stappen gedurende 8.000 stappen (lr 1e-4) op één H20-GPU in 18 u 17 min.

{% include svg_figure.liquid name="honor_rove_sft" caption="Verlies van de conditionele SFT van iter0. Het gemiddelde over 200 stappen daalt van 0,54 naar 0,047 bij stap 1.000 en naar 0,025 bij stap 8.000." %}

**Eerlijk over de metrieken:** de drie groepen komen van verschillende dagen, operators en promptsets, dus dit is een observatie en geen A/B-test — de afwisselende evaluatie tegen het basischeckpoint en een RECAP-arm staat nog open. Bij de iter0-verzameling zijn bovendien geen overnamesegmenten gelogd, dus de volgende ronde mist het kernsignaal van ROVE totdat dat logging is hersteld.

## 6. Debuggen op de echte robot {#debugging}

Geen van deze problemen was offline door code te reviewen te vinden — ze kwamen pas aan het licht tijdens lange runs op de echte robot en elk werd gelokaliseerd met een probe of een kwantitatieve metriek.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Symptoom</th><th>Probe / bewijs</th><th>Hoofdoorzaak → oplossing</th></tr></thead>
  <tbody>
    <tr><td>Generalisatie drijft weg na finetunen</td><td>Verlies op achtergehouden data 0,0048 → 0,0222 bij stap 2000 (×4,6); cosinus van de actierichting 0,995 → 0,979 → 0,961</td><td>De mixer voor basisdata las mp4 als BGR terwijl de bevroren vision-tower RGB verwacht — de helft van het gradiëntbudget leerde ruis; opgelost met één standaardwaarde. Ankers dekten slechts 29 episodes (5,6%) → basisbuffer vergroten</td></tr>
    <tr><td>Buffer gevuld met onterechte successen</td><td>Episodes vergrendelden „succes” na 24 en 29 stappen; de learner trainde er 1.000+ stappen op</td><td>Vergrendelen en resetten deelden één drempel van 0,5, geen hysterese → vergrendelen bij p &gt; 0,8 × 20 frames, resetten bij p ≤ 0,3 × 3 frames. Een later niet-gereset object leverde 2.536 waardeloze stappen over 11 episodes op — net boven de trainingsdrempel van 2.500 stappen: audit frame voor frame vanaf de eerste sessie</td></tr>
    <tr><td>Gedrag verschilt tussen training, uitrol en RL</td><td>Veld-voor-veld-vergelijking van observaties over de drie pipelines</td><td>DDS-type van de grijper, een ondersteboven hangende camera, initialisatie van de handpositie, indexering van de hoofdpositie → lijst van 9 fixes</td></tr>
    <tr><td>Robot draait bij het begin van de episode</td><td>Mediane yaw-drift 31°</td><td>Verouderd yaw-anker + volledig herankeren bij elke chunk → snelheidslimiet van 3°/chunk met een plafond van 20°; 6 validatieruns: ankerfout 0,0°, draaiing in de eerste seconde ≤ 1,6°</td></tr>
    <tr><td>Verouderde camerabeelden</td><td>47% dubbele opeenvolgende frames in 77 van 83 episodes; bron 61 Hz, decodering 54,9 Hz, effectief ≈ 10,6 Hz onder belasting</td><td>Observeerbaarheid van de versheid van frames toegevoegd</td></tr>
    <tr><td>„Het model beweegt niet”</td><td>Trainer-client blokkeerde in retries</td><td>Actor- en learnerpoorten kwamen niet overeen. Les: elk „het model beweegt niet” is eerst een controle van communicatie of observatie, en pas daarna van gewichten</td></tr>
  </tbody>
</table>
</div>
