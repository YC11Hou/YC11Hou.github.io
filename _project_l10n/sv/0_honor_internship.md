---
lang: sv
project: 0_honor_internship
title: "Honor Humanoid: RL på riktig robot för VLA"
source_hash: b1ae248d5011
---

Arbete med Honors egenutvecklade **humanoida robot**: datainsamling via teleoperering, uppspelning, träning och driftsättning på roboten, samt algoritmforskning kring **RL på riktig robot** för **Vision-Language-Action (VLA)**-modeller på egna manipulationsuppgifter.

<nav class="contrib">
  <p>Vad jag gjorde · klicka på ett kort för att hoppa dit</p>
  <ol>
    <li><a href="#loop"><strong>End-to-end-pipeline för VLA</strong><span>Samla in → träna → driftsätta, labbet byggt från grunden</span></a></li>
    <li><a href="#data-design"><strong>Design av offline-data</strong><span>4 kategorier: följa + återhämta sig</span></a></li>
    <li><a href="#infra"><strong>Träningsinfrastruktur med mänsklig övertagning</strong><span>Övertagning · Actor–Learner–Robot-loop · ny uppgift ≈ 0% → 50%+</span></a></li>
    <li><a href="#algorithms"><strong>RL-algoritmer på riktig robot</strong><span>RECAP · RAPID · loco-manipulation</span></a></li>
    <li><a href="#rove"><strong>Reproduktion av ROVE</strong><span>Autonom framgång 40% → 52%</span></a></li>
    <li><a href="#debugging"><strong>Felsökning på riktig robot</strong><span>6 buggar, var och en hittad med en sond</span></a></li>
  </ol>
</nav>

## Demos

### Inferens på roboten under störningar

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/inference_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/inference_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Autonoma pick-and-place-körningar på den riktiga roboten medan objektet (vänster) och målkorgen (höger) rubbas mitt i en episod — policyn följer om och slutför uppgiften. Handen slutar aldrig röra sig, och policyn väntar aldrig på att objektet ska stabilisera sig: det den har lärt sig är visuell spårning och störningshantering, inte en enda pick-and-place-bana.

### Datadesign för robusthet

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/data_design_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/data_design.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Fyra kategorier av teleopererade demonstrationer: standarddemonstrationer, störningar under pick-fasen, störningar under place-fasen och återhämtning från misslyckade grepp — utformade så att policyn lär sig att återhämta sig, inte bara att upprepa.

### SFT på riktig robot: före och efter

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

En uppgift som den offline-tränade policyn inte kunde utföra lärs in på roboten genom inlärningsloopen på riktig robot — data från mänskliga övertagningar flödar tillbaka in i träningen, och övertagningsandelen sjunker i takt med att nya checkpoints skickas ut.

## 1. End-to-end-pipeline för VLA {#loop}

Labbet i Shanghai byggdes upp från grunden efter att jag började: robotkonfiguration, två teleoperationsriggar (Pico VR och motion capture), utbildning av operatörerna som samlar in data samt träningspipelinen. Uppgiften är pick-and-place (flaska → korg) med en enda fast instruktion.

{% include svg_figure.liquid name="honor_pipeline" caption="End-to-end-pipeline på riktig robot. GR00T N1.7 (3B) eftertränas med fryst vision-språk-backbone; den 37-dimensionella handlingen väljs ut från ett 115-dimensionellt robottillstånd. Det finns ingen valideringsmängd, så checkpoints sparas var 2K:e steg och väljs utifrån körningar på roboten; förlusten planar ut efter cirka 15K steg." %}

{% include svg_figure.liquid name="honor_chunk" caption="Överlämning av handlingschunkar vid inferens. Nästa chunk begärs när 15 steg återstår; handlingar som hunnit bli inaktuella under inferensen kastas, och överlappet tonas linjärt över, så att roboten inte hackar mellan chunkarna." %}

**På roboten** misslyckas place-fasen nästan aldrig — policyn hänger med även när korgen dras snabbt. Misslyckade pick-försök korrelerar med objektets position; detta kunde spåras till datan (fast hållning, ingen lokal rörelse under insamlingen, så modellen utvecklar aldrig någon känsla för avstånd), inte till armens noggrannhet. Resultat: labbet fick en egen iterationsloop ”samla in → finjustera → validera på roboten” i stället för att förlita sig på externt levererade modeller.

## 2. Design av offline-data {#data-design}

**Varför fyra datakategorier.** Kategorierna ①–③ (standard, störning i pick-fasen, störning i place-fasen) lär policyn att _följa_ ett rörligt objekt eller en rörlig behållare. Kategori ④ lär den att _återhämta sig_: med start i svävande pose direkt efter ett missat grepp sänker demonstrationen handen, tar om greppet och placerar. Utan den inser policyn ofta inte att greppet misslyckades — den lyfter en tom hand, rör sig till korgen och ”placerar” ingenting. De fyra kategorierna är ungefär balanserade; robustheten i demon ovan kommer från denna datadesign, inte från hyperparameterjustering.

## 3. Träningsinfrastruktur på riktig robot med mänsklig övertagning {#infra}

### 3.1 Mänsklig övertagning och interventionsdriven datapipeline {#takeover}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/takeover_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/takeover_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">En teleoperatör tar över mitt i en episod och lämnar tillbaka kontrollen (3× hastighet, inget ljud).</p>

**Mjuk mänsklig övertagning.** Inlärning på riktig robot kräver att en människa kan ta över när som helst utan att roboten hoppar till. Vid övertagning styrs VLA-kommandotopiken om till teleoperationstopiken, och styrenheten ger ut ett _inkrement_ ovanpå den senaste VLA-handlingen i stället för teleoperatörens absoluta ledvinklar.

{% include svg_figure.liquid name="honor_fsm" caption="Tillståndsmaskinen för växling och utmatningsregeln vid övertagning. Övertagningar skrivs också in i datan, så varje episod vet vilka bildrutor som kom från människan." %}

**Interventionsdriven datapipeline.** Varje episod sparas, och operatören kan bara överstyra framgångsklassificeraren nedåt, aldrig upphöja ett misslyckande till en framgång; klassificerarens beslut och statistik över falska positiva/negativa loggas vid sidan av. Bufferten är en begränsad numpy-ringbuffert med framgångs- och misslyckandehinkar, FIFO med mjuk radering och viktad sampling (PER-viktkorrektion), och en HTTP-granskningsändpunkt gör att varje episod kan inspekteras innan den når träningen. I en annan omgång kom 127 av 138 insamlade episoder in i bufferten som framgångar (11 helt autonoma, 116 med övertagningsdemonstrationer).

{% include svg_figure.liquid name="honor_datapipe" caption="Från robot till learner: varje episod, även misslyckade, spelas in, bedöms och laddas upp; learnern sorterar episoderna i hinkar efter utfall. Nederst: sammansättningen av en omgång data från riktig robot (142–416 bildrutor per episod)." %}

### 3.2 Distribuerad inlärningsloop på riktig robot {#online-loop}

**Reproducerade rejection-sampling-loopen Hi-ORS och portade den från π0 + en Dobot-arm till GR00T N1.7 + en humanoid.** Tre maskiner körs samtidigt.

{% include svg_figure.liquid name="honor_arch" caption="Actor–Learner–Robot-arkitekturen. Actor kör policyn mot roboten, bara lyckade episoder når Learner, och Learner skickar tillbaka de träningsbara vikterna till Actor var 1 000:e steg." %}

{% include svg_figure.liquid name="honor_gates" caption="Grindar innan en episod går in i träningen. Framgångsklassificeraren är en ResNet18 på en enda bildruta från vänster kamera med ett huvud med en logit, tränad med BCE + pos_weight på 572 episoder (uppdelning på episodnivå, online-augmentering, etiketter härledda automatiskt från gripsignaler; F1 0,976 på bildrutenivå). Den låser sig först efter 20 på varandra följande bildrutor över 0,8 — denna hysteres lades till efter den första sessionen på riktig robot, där klassificeraren förklarade framgång inom 1–2 s och falska positiva fyllde bufferten. Ankare från basdemonstrationer i varje batch skyddar mot glömska." %}

### 3.3 Resultat av SFT på riktig robot: en ny uppgift från ≈ 0% till 50%+ på ~140 episoder {#results}

När policyn kör fast tar operatören över via Pico; övertagningsdata flödar direkt in i Learner, och övertagningsandelen fungerar som ett löpande mått. **Scen 1** flyttar flaskan åt höger, där offline-datan är gles. **Scen 2** byter hela uppställningen höger–vänster (korg till vänster, flaska till höger) — raka motsatsen till all offline-data — så offline-SFT-baslinjen ligger på ≈ 0%.

{% include svg_figure.liquid name="honor_curve" caption="Andel teleopererade steg per episod under SFT på riktig robot, med de checkpoints som skickats till Actor. Varje checkpoint-uppdatering följs av ett fall i övertagningar; ökningen kring episod 86 är bytet till scen 2. Under testfasen (checkpoints 5000–7000) faller övertagningsandelen till 18,8%." %}

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Scen</th><th>Förändring jämfört med offline-data</th><th>Episoder</th><th>Offline-SFT</th><th>Efter SFT på riktig robot</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Flaska till höger (gles i offline-datan)</td><td>20</td><td>ej mätt</td><td><strong>55.0%</strong></td></tr>
    <tr><td>2</td><td>Korg till vänster, flaska till höger (spegelvänd uppställning)</td><td>12</td><td>≈ 0%</td><td><strong>50.0%</strong></td></tr>
  </tbody>
</table>
</div>

Andel helt autonoma framgångar. Varför en fryst backbone ändå kan lära sig den spegelvända uppställningen: felläget var att _inte röra sig alls_ snarare än att röra sig åt fel håll — den visuella förståelsen var intakt, det var bara handlingsmappningen som saknades.

## 4. RL-algoritmer på riktig robot {#algorithms}

### 4.1 Fördelsvillkorad träning i RECAP-stil {#recap}

Rejection sampling är ett binärt degenererat fall av fördel (advantage): behåll varje framgång, kassera varje misslyckande. **Portade advantage-etiketteringen från π0.6 RECAP (som i RLinf) till GR00T N1.7** så att _all_ data används, med ”bra kontra dåligt” som ingångsvillkor i stället för filter — misslyckade episoder blir negativa exempel i stället för spill.

{% include svg_figure.liquid name="honor_recap" caption="Pipeline i RECAP-stil. Misslyckandestraffet c_fail = 1000 överstiger gapet mellan den längsta framgången (1 000 bildrutor) och det kortaste misslyckandet (57 bildrutor), så varje misslyckande rankas under varje framgång. n = 20 steg motsvarar artikelns horisont på 1 s vid 20 Hz. Negativa exempel formar bara den ovillkorade CFG-grenen." %}

{% include svg_figure.liquid name="honor_value_net" caption="Värdenätverket. GR00T-backbonen förblir fryst och får ingen gradient; bild- och texttokens medelvärdesbildas var för sig eftersom bildtokens är långt fler än texttokens och ett enda medelvärde skulle späda ut språkvillkoret. RLinf lägger till en inlärbar CLS-token och använder ett enda linjärt huvud; GR00T-backbonen tar inga extra ingångsembeddingar, så vi poolar i stället och lägger till ett dolt lager. Skissen av atomfördelningen är illustrativ." %}

Tills V är klart fungerar regelbaserade etiketter som reserv: alla framgångsbildrutor positiva, autonoma bildrutor i misslyckanden negativa, och de 20 bildrutorna före varje övertagning skrivs över som negativa. Värdenätverket tränas separat och godtas bara om Spearman ρ på undanhållna episoder (var 10:e episod) överstiger 0,55: torrkörningen nådde ρ = 0,647 (platå 0,59) med förlust 4,52 → 0,76, medan en kontroll med blandade etiketter höll sig på ett absolut ρ ≤ 0,26 och föll på kriteriet — kriteriet är alltså meningsfullt. Överensstämmelsen mellan V-baserade och regelbaserade etiketter var bara 0,31, så värdenätverket förblir flaskhalsen, och A/B-jämförelsen på riktig robot slutfördes inte.

### 4.2 RAPID: snabb anpassning i brusrummet {#rapid}

**RAPID** (_Rapid Adaptation from Physical Interventions via Diffusion-noise_), i DSRL:s anda: att träna en ny checkpoint tar tid, och tills den är på plats kan roboten fortfarande inte utföra uppgiften. RAPID lämnar VLA-vikterna frysta och ersätter bara flow matchings initialbrus, så att en korrigering som människan just gjorde kan återanvändas nästa gång ett liknande tillstånd dyker upp. Den kopplades in i inferensen på roboten i slutet av augusti.

{% include svg_figure.liquid name="honor_rapid" caption="RAPID. Offline inverteras mänskliga korrigeringar genom den frusna policyn till det initialbrus som återskapar dem (64 fina steg; 4-stegs Euler är för grov) och lagras i ett minne indexerat på observation. Vid driftsättning interpoleras det hämtade bruset sfäriskt med gaussiskt brus före vanlig flow-matching-sampling." %}

{% include svg_figure.liquid name="honor_dsbc_net" caption="DSBC-brusnätverket. En liten MLP avbildar hämtningsnyckeln direkt på initialbruset och ersätter närmaste-granne-sökning; själva VLA förblir fryst. H är GR00T:s handlingshuvuds handlingshorisont på 40 steg (30 steg utförs per inferens); D är dess handlingsdimension." %}

{% include svg_figure.liquid name="honor_rapid_chart" caption="Offline-validering på 24 övertagningsepisoder av en räkneuppgift. DSBC leder för varje K (54,9–57,0); minneshämtning når bara 20 vid K = 1–2 och 45–49 vid K ≥ 4; partiell brusning ligger still på 37; memory_delta ligger under 8. Måttet är DTW-vinst, inte framgångsgrad på riktig robot." %}

Granskningen var **förregistrerad**: granskning PASS; reversering CONDITIONAL (rekonstruktionsfel 0,232, inom 0,10–0,30); spridning nedgraderad till skör efter en omkörning; överföring PASS (p ≈ 1e-21). Enligt dessa kriterier **övergavs** påståendet ”hämtning vinner vid K < 10” — experimentdesignen förkastade min egen hypotes — och systemet konvergerade mot DSBC som huvudspår med minneshämtning som valfri front-end. Nästa steg var att destillera DSBC in i policyn, mjukt pensionera minnesposter och koppla in det i RL på riktig robot.

### 4.3 Utvidgning till loco-manipulation {#loco}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/locomanip_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/locomanip_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">Humanoiden går autonomt till en bänk och greppar en flaska — 7 klipp från riktig robot, 5× hastighet, inget ljud; gula golvmarkeringar är referenser för gångbanan.</p>

Hela stacken — övertagning, inlärningsloopen på riktig robot, RECAP och RAPID — fördes över från pick-and-place på bordet till en uppgift med gång utan att skrivas om.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Data för loco-manipulation</th><th>Värde</th></tr></thead>
  <tbody>
    <tr><td>Insamlade gångepisoder</td><td>507 episoder · 181K bildrutor</td></tr>
    <tr><td>Behållna efter 6 granskningskriterier</td><td>326 episoder</td></tr>
    <tr><td>Sammanslagen träningsmängd</td><td><strong>848 episoder · 306K bildrutor (+71%)</strong></td></tr>
    <tr><td>Median av banlängd per episod</td><td>0,32 m → <strong>3,2 m</strong></td></tr>
  </tbody>
</table>
</div>

**Ärligt om måtten:** SFT-steget på riktig robot har fullständiga siffror (55% / 50%). Efter bytet till loco-uppgiften implementerades och kopplades alla komponenter in, men ingen förbättring på mätnivå uppnåddes där: mognaden hos helkroppshårdvaran och gångstacken vid den tiden medgav ingen systematisk utvärdering på riktig robot.

## 5. Reproduktion av ROVE {#rove}

**Uppgift.** Humanoiden står still — fötterna fixerade, ingen gång — och plockar upp en telefon med handen: finmotorisk manipulation där en liten felinriktning snabbt leder till mänsklig övertagning.

ROVE (XPENG, arXiv:2606.17011) behåller RECAP:s skelett med advantage-villkorning (§4.1) och ändrar hur mänskliga övertagningar poängsätts. Jag reproducerade det ovanpå RECAP-pipelinen bakom en enda algoritmomkopplare — standardvägen för RECAP förblir bit-identisk, vilket säkras av självtester — och körde artikelns Algoritm 1 som en offline-loop: driftsätt och samla in → stadiemedvetna returer → värdeuppdatering → advantages och etiketter → villkorad SFT. Bara det första steget kräver roboten; de andra fyra körs som ett enda kommando.

### 5.1 Stadiemedveten retur {#rove-return}

Under RECAP räknas en episod som en människa räddade fortfarande som en framgång: dess retur stiger med ett för varje steg upp till 0, så de autonoma handlingar som _orsakade_ övertagningen ser ut som stadiga framsteg. Det enda botemedlet är en fast regel som etiketterar de 20 bildrutorna före en övertagning som negativa. ROVE delar en sådan episod i tre segment — autonom exekvering, anpassning (människan drar fortfarande roboten tillbaka på rätt spår) och återhämtning — och bokför ett misslyckandestraff C_fail vid t_r, anpassningens slut. Det autonoma segmentet som ledde till övertagningen poängsätts nu på misslyckandenivå, medan återhämtningen behåller sin vanliga time-to-go-retur.

{% include svg_figure.liquid name="honor_rove_return" caption="Stadiemedveten retur (ekv. 2 i artikeln): −1 per steg, C_fail vid t_r, tomgångsbildrutor (operatören byter läge) borttagna. t_r faller tillbaka på övertagning + 40 bildrutor (2 s) när det inte är annoterat; artikelns ablation tappar 30 procentenheter när t_r läggs vid övertagningens början, så standardvärdet felar åt sent håll. C_fail måste överstiga det längsta spannet i den positiva poolen, annars skulle en misslyckad episod få högre poäng än en återhämtning: den uppmätta nedre gränsen på denna data är 919, så C_fail = 1000 (artikelns 500 är för litet här). Returerna stämde bit för bit med handräkning på 38 arkiverade episoder." %}

### 5.2 Optimistisk värdeskattning (OVE) {#rove-ove}

Vanlig Monte Carlo-regression lär sig den _genomsnittliga_ returen. I tillstånd som ofta slutar i en övertagning är genomsnittet redan lågt, så handlingen som orsakade övertagningen får en advantage nära noll och etiketteras aldrig som negativ. OVE finjusterar samma skalära värdehuvud, efter MC-förträning, med ett 16-stegs TD-mål (från en EMA-kopia av nätverket) och en expektilförlust med τ = 0,7, som straffar underskattningar hårdare än överskattningar. V skattar då vad ett tillstånd är värt _när det går bra_: tillstånd före övertagning värderas högt, deras faktiska retur är låg, och den negativa advantagen hamnar på de handlingar som orsakade övertagningen. Advantage-horisonten är också 16 steg — en handlingschunk, enheten som etiketten fästs vid — och de översta 40% av bildrutorna etiketteras som positiva.

Varje värde-checkpoint grindas av Spearman ρ på undanhållna episoder: rangöverensstämmelsen mellan predikterat V och faktisk retur (1 = samma ordning). MC-steget måste nå ρ ≥ 0,55 på hela poolen; OVE-steget bedöms enbart på framgångsepisoder (ρ ≥ 0,70), eftersom OVE enligt design avviker från medelreturen i tillstånd som leder mot misslyckande, så ett lägre ρ på hela poolen är väntat snarare än en regression.

{% include svg_figure.liquid name="honor_rove_rho" caption="Undanhållet Spearman ρ i tre värdeträningskörningar (skuggat: OVE-fasen). Rena rollouts: ρ på framgångsmängden ligger kvar på 0,744–0,806 efter bytet till OVE, medan ρ på hela poolen glider från 0,735 till 0,69 som avsett; gränsen 0,70 sattes utifrån denna körning. Demos + rollouts: ρ på framgångsmängden sjunker från 0,731 till 0,628 — 85% av den undanhållna mängden är rena demonstrationer, och optimistisk bootstrapping trycker alla mot toppen och komprimerar rankningen. iter0-poolen, varmstartad direkt in i OVE: ρ på hela poolen 0,68–0,71, ρ på framgångsmängden 0,63–0,67, under gränsen. De tre poolerna har olika undanhållna mängder, så ρ är inte jämförbart mellan panelerna." %}

<figure class="fig">
  <img src="{{ '/assets/img/honor_rove_value_curve.jpg' | relative_url }}" alt="Värdekurvor för en undanhållen övertagningsepisod: sann retur, MC-värde och OVE-värde, med bildrutor med negativ advantage markerade" loading="lazy" width="1400" height="653">
  <figcaption>Reproduktion av artikelns fig. 6 på en undanhållen episod med en övertagning (x: bildruta, tomgångsbildrutor borttagna; y: normaliserat värde). Före t_r ligger OVE-värdet (blått) över MC-värdet (orange) — optimistiskt i fördelningen — hoppar sedan vid t_r och följer den sanna returen genom återhämtningen. Röda punkter markerar bildrutor med negativ OVE-advantage: de koncentreras före övertagningen och i anpassningssegmentet.</figcaption>
</figure>

### 5.3 Resultat {#rove-results}

Autonom framgång på roboten steg från 40% (basens checkpoint, n = 77) till **52%** (ROVE iter0, n = 192); människoassisterade framgångar föll från 45% till 20% av episoderna, medan misslyckanden steg från 14% till 28%.

{% include svg_figure.liquid name="honor_rove_robot" caption="Utfallet för varje loggad episod på riktig robot per checkpoint, bedömt av operatören. Bas 64000: sen aug – tidig sep; bas 80000: tidig – mitten av sep; ROVE iter0: 17–23 sep." %}

iter0 tränades med ett varv av offline-loopen: en värdepool på 2 068 episoder (534K bildrutor av demonstrationer och rollouts på riktig robot, 207 episoder undanhållna), etiketter med exakt 40,0% positiva, och villkorad SFT från basens checkpoint vid 80K steg i 8 000 steg (lr 1e-4) på en H20-GPU på 18 h 17 min.

{% include svg_figure.liquid name="honor_rove_sft" caption="Förlusten för villkorad SFT i iter0. Medelvärdet över 200 steg faller från 0,54 till 0,047 vid steg 1 000 och till 0,025 vid steg 8 000." %}

**Ärligt om måtten:** de tre grupperna kommer från olika dagar, operatörer och promptuppsättningar, så detta är en observation, inte ett A/B-test — den interfolierade utvärderingen mot basens checkpoint och en RECAP-arm återstår. iter0-insamlingen loggade dessutom inga övertagningssegment, så nästa omgång saknar ROVE:s kärnsignal tills loggningen är åtgärdad.

## 6. Felsökning på riktig robot {#debugging}

Ingen av dessa kunde hittas genom att granska koden offline — de dök bara upp under långa körningar på riktig robot, och var och en lokaliserades med en sond eller ett kvantitativt mått.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Symtom</th><th>Sond / belägg</th><th>Grundorsak → åtgärd</th></tr></thead>
  <tbody>
    <tr><td>Generaliseringen driver iväg efter finjustering</td><td>Förlust på undanhållen data 0,0048 → 0,0222 vid steg 2000 (×4,6); cosinus för handlingsriktning 0,995 → 0,979 → 0,961</td><td>Basdatamixern läste mp4 som BGR medan det frusna visionstornet förväntar sig RGB — hälften av gradientbudgeten lärde sig brus; åtgärdat med ett standardvärde. Ankarna täckte bara 29 episoder (5,6%) → förstora basbufferten</td></tr>
    <tr><td>Bufferten fylldes av falska framgångar</td><td>Episoder låste ”framgång” efter 24 och 29 steg; learnern tränade på dem i över 1 000 steg</td><td>Låsning och återställning delade en tröskel på 0,5, ingen hysteres → lås vid p &gt; 0,8 × 20 bildrutor, återställ vid p ≤ 0,3 × 3 bildrutor. Ett senare icke-återställt objekt gav 2 536 skräpsteg över 11 episoder — precis över träningströskeln på 2 500 steg: granska bildruta för bildruta från första sessionen</td></tr>
    <tr><td>Beteendet skiljer sig mellan träning, driftsättning och RL</td><td>Fält-för-fält-jämförelse av observationer över de tre pipelinerna</td><td>Gripdonets DDS-typ, en upp-och-nedvänd kamera, initialisering av handposition, indexering av huvudposition → åtgärdslista med 9 punkter</td></tr>
    <tr><td>Roboten vrider sig vid episodstart</td><td>Median av girdrift 31°</td><td>Inaktuellt gir-ankare + full omförankring varje chunk → hastighetsgräns på 3°/chunk med tak på 20°; 6 valideringskörningar: förankringsfel 0,0°, vridning första sekunden ≤ 1,6°</td></tr>
    <tr><td>Inaktuella kamerabilder</td><td>47% dubbletter av på varandra följande bildrutor i 77 av 83 episoder; källa 61 Hz, avkodning 54,9 Hz, effektivt ≈ 10,6 Hz under last</td><td>Lade till observerbarhet för bildrutors färskhet</td></tr>
    <tr><td>”Modellen rör sig inte”</td><td>Träningsklienten blockerad i omförsök</td><td>Actor- och learner-portar stämde inte överens. Lärdom: varje ”modellen rör sig inte” är först en kontroll av kommunikation eller observation, sedan en kontroll av vikterna</td></tr>
  </tbody>
</table>
</div>
