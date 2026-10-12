---
lang: de
project: 0_honor_internship
title: "Honor-Humanoid: RL auf dem realen Roboter für VLA"
source_hash: b1ae248d5011
---

Arbeit am selbstentwickelten **humanoiden Roboter** von Honor: Teleoperations-Datenerfassung, Wiedergabe, Training und Einsatz auf dem Roboter sowie algorithmische Forschung zu **RL auf dem realen Roboter** für **Vision-Language-Action-Modelle (VLA)** bei eigens definierten Manipulationsaufgaben.

<nav class="contrib">
  <p>Meine Beiträge · Karte anklicken, um zu springen</p>
  <ol>
    <li><a href="#loop"><strong>End-to-End-VLA-Pipeline</strong><span>Erfassen → Trainieren → Einsetzen, Labor von Grund auf aufgebaut</span></a></li>
    <li><a href="#data-design"><strong>Design der Offline-Daten</strong><span>4 Kategorien: Verfolgen + Wiederherstellen</span></a></li>
    <li><a href="#infra"><strong>Trainingsinfrastruktur mit menschlicher Übernahme</strong><span>Übernahme · Actor–Learner–Robot-Schleife · neue Aufgabe ≈ 0 % → 50 %+</span></a></li>
    <li><a href="#algorithms"><strong>RL-Algorithmen für den realen Roboter</strong><span>RECAP · RAPID · Loco-Manipulation</span></a></li>
    <li><a href="#rove"><strong>Reproduktion von ROVE</strong><span>Autonome Erfolgsrate 40 % → 52 %</span></a></li>
    <li><a href="#debugging"><strong>Debugging am realen Roboter</strong><span>6 Fehler, jeder mit einer Sonde gefunden</span></a></li>
  </ol>
</nav>

## Demos

### Inferenz auf dem Roboter unter Störungen

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/inference_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/inference_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Autonome Pick-and-Place-Durchläufe auf dem realen Roboter, während das Objekt (links) und der Zielkorb (rechts) mitten in der Episode verschoben werden – die Policy verfolgt sie erneut und schließt die Aufgabe ab. Die Hand hört nie auf, sich zu bewegen, und die Policy wartet nie, bis das Objekt zur Ruhe kommt: Gelernt wurden visuelles Tracking und Störungsunterdrückung, nicht eine einzelne Pick-and-Place-Trajektorie.

### Datendesign für Robustheit

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/data_design_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/data_design.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Vier Kategorien teleoperierter Demonstrationen: Standarddemonstrationen, Störungen in der Greifphase, Störungen in der Ablagephase und Wiederherstellung aus fehlgeschlagenen Greifzuständen – so gestaltet, dass die Policy lernt, sich zu erholen, und nicht bloß zu wiederholen.

### SFT auf dem realen Roboter: vorher vs. nachher

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Eine Aufgabe, die die offline trainierte Policy nicht beherrschte, wird über die Lernschleife auf dem realen Roboter erlernt – die Daten der menschlichen Übernahme fließen zurück ins Training, und der Übernahmeanteil sinkt, sobald neue Checkpoints ausgeliefert werden.

## 1. End-to-End-VLA-Pipeline {#loop}

Das Labor in Shanghai wurde nach meinem Eintritt von Grund auf aufgebaut: Roboterkonfiguration, zwei Teleoperations-Aufbauten (Pico VR und Motion Capture), Schulung der Bediener für die Datenerfassung und die Trainingspipeline. Die Aufgabe ist Pick-and-Place (Flasche → Korb) mit einer einzigen festen Anweisung.

{% include svg_figure.liquid name="honor_pipeline" caption="End-to-End-Pipeline auf dem realen Roboter. GR00T N1.7 (3B) wird mit eingefrorenem Vision-Language-Backbone nachtrainiert; die 37-D-Aktion wird aus einem 115-D-Roboterzustand ausgewählt. Es gibt keinen Validierungssatz, daher werden Checkpoints alle 2K Schritte gespeichert und anhand von Rollouts auf dem Roboter ausgewählt; der Loss flacht nach etwa 15K Schritten ab." %}

{% include svg_figure.liquid name="honor_chunk" caption="Übergabe von Action Chunks bei der Inferenz. Der nächste Chunk wird angefordert, solange noch 15 Schritte übrig sind; während der Inferenz veraltete Aktionen werden verworfen und die Überlappung wird linear übergeblendet, sodass der Roboter zwischen den Chunks nicht ruckelt." %}

**Auf dem Roboter** scheitert die Ablagephase fast nie – die Policy hält Schritt, selbst wenn der Korb schnell gezogen wird. Fehlgriffe korrelieren mit der Objektposition; das ließ sich auf die Daten zurückführen (feste Standposition, keine lokale Bewegung während der Erfassung, sodass das Modell kein Gefühl für Distanz entwickelt), nicht auf die Genauigkeit des Arms. Ergebnis: Das Labor erhielt eine eigene Iterationsschleife „erfassen → feintunen → auf dem Roboter validieren“, statt auf extern gelieferte Modelle angewiesen zu sein.

## 2. Design der Offline-Daten {#data-design}

**Warum vier Datenkategorien.** Die Kategorien ①–③ (Standard, Störung in der Greifphase, Störung in der Ablagephase) bringen der Policy bei, ein sich bewegendes Objekt oder einen Behälter zu _verfolgen_. Kategorie ④ bringt ihr bei, sich zu _erholen_: Ausgehend von der Schwebepose unmittelbar nach einem verfehlten Griff senkt die Demonstration die Hand ab, greift erneut und legt ab. Ohne sie bemerkt die Policy oft nicht, dass der Griff fehlgeschlagen ist – sie hebt eine leere Hand, fährt zum Korb und „legt“ nichts ab. Die vier Kategorien sind ungefähr ausgewogen; die Robustheit in der obigen Demo stammt aus diesem Datendesign, nicht aus Hyperparameter-Tuning.

## 3. Trainingsinfrastruktur für den realen Roboter mit menschlicher Übernahme {#infra}

### 3.1 Menschliche Übernahme und interventionsgetriebene Datenpipeline {#takeover}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/takeover_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/takeover_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">Ein Teleoperator übernimmt mitten in der Episode und gibt die Kontrolle wieder ab (3-fache Geschwindigkeit, ohne Ton).</p>

**Sanfte menschliche Übernahme.** Lernen auf dem realen Roboter setzt voraus, dass ein Mensch jederzeit übernehmen kann, ohne dass der Roboter ruckartig springt. Bei der Übernahme wird das VLA-Command-Topic auf das Teleoperations-Topic umgeleitet, und der Regler gibt ein _Inkrement_ auf der letzten VLA-Aktion aus statt der absoluten Gelenkwinkel des Teleoperators.

{% include svg_figure.liquid name="honor_fsm" caption="Zustandsautomat für das Umschalten und die Ausgaberegel bei der Übernahme. Übernahmen werden ebenfalls in die Daten geschrieben, sodass jede Episode weiß, welche Frames vom Menschen stammen." %}

**Interventionsgetriebene Datenpipeline.** Jede Episode wird gespeichert, und der Bediener kann den Erfolgsklassifikator nur nach unten überstimmen, nie einen Fehlschlag zum Erfolg hochstufen; Entscheidungen des Klassifikators sowie Statistiken zu falsch positiven/negativen Fällen werden mitprotokolliert. Der Puffer ist ein beschränkter numpy-Ringpuffer mit Erfolgs-/Fehlschlag-Buckets, Soft-Delete-FIFO und gewichtetem Sampling (PER-Importance-Korrektur), und ein HTTP-Review-Endpunkt erlaubt es, jede Episode zu prüfen, bevor sie das Training erreicht. In einer weiteren Runde gelangten 127 von 138 erfassten Episoden als Erfolge in den Puffer (11 vollständig autonom, 116 mit Übernahme-Demonstrationen).

{% include svg_figure.liquid name="honor_datapipe" caption="Vom Roboter zum Learner: Jede Episode, auch Fehlschläge, wird aufgezeichnet, bewertet und hochgeladen; der Learner sortiert Episoden nach Ergebnis in Buckets. Unten: Zusammensetzung einer Runde von Daten vom realen Roboter (142–416 Frames pro Episode)." %}

### 3.2 Verteilte Lernschleife auf dem realen Roboter {#online-loop}

**Die Hi-ORS-Rejection-Sampling-Schleife reproduziert und von π0 + Dobot-Arm auf GR00T N1.7 + Humanoid portiert.** Drei Rechner laufen gleichzeitig.

{% include svg_figure.liquid name="honor_arch" caption="Actor–Learner–Robot-Architektur. Der Actor führt die Policy auf dem Roboter aus, nur erfolgreiche Episoden erreichen den Learner, und der Learner schickt die trainierbaren Gewichte alle 1.000 Schritte an den Actor zurück." %}

{% include svg_figure.liquid name="honor_gates" caption="Schranken, bevor eine Episode ins Training gelangt. Der Erfolgsklassifikator ist ein ResNet18 auf einem einzelnen Frame der linken Kamera mit einem Ein-Logit-Kopf, trainiert mit BCE + pos_weight auf 572 Episoden (Split auf Episodenebene, Online-Augmentierung, Labels automatisch aus Greifersignalen abgeleitet; F1 auf Frame-Ebene 0,976). Er rastet erst nach 20 aufeinanderfolgenden Frames über 0,8 ein – diese Hysterese wurde nach der ersten Sitzung auf dem realen Roboter ergänzt, in der der Klassifikator binnen 1–2 s Erfolg meldete und falsch positive Fälle den Puffer füllten. Ankerdemonstrationen der Basisdaten in jedem Batch schützen vor Vergessen." %}

### 3.3 SFT-Ergebnisse auf dem realen Roboter: eine neue Aufgabe von ≈ 0 % auf 50 %+ in ~140 Episoden {#results}

Wenn die Policy stockt, übernimmt der Bediener per Pico; die Übernahmedaten fließen direkt in den Learner, und der Übernahmeanteil dient als Live-Metrik. **Szene 1** verschiebt die Flasche nach rechts, wo die Offline-Daten spärlich sind. **Szene 2** vertauscht das gesamte Layout links–rechts (Korb links, Flasche rechts) – das exakte Gegenteil aller Offline-Daten –, sodass die Offline-SFT-Baseline bei ≈ 0 % liegt.

{% include svg_figure.liquid name="honor_curve" caption="Anteil teleoperierter Schritte pro Episode während des SFT auf dem realen Roboter, mit den an den Actor ausgelieferten Checkpoints. Auf jedes Checkpoint-Update folgt ein Rückgang der Übernahmen; der Anstieg um Episode 86 ist der Wechsel zu Szene 2. In der Testphase (Checkpoints 5000–7000) sinkt der Übernahmeanteil auf 18,8 %." %}

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Szene</th><th>Änderung ggü. Offline-Daten</th><th>Episoden</th><th>Offline-SFT</th><th>Nach SFT auf dem realen Roboter</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Flasche rechts (in Offline-Daten spärlich)</td><td>20</td><td>nicht gemessen</td><td><strong>55.0%</strong></td></tr>
    <tr><td>2</td><td>Korb links, Flasche rechts (Layout gespiegelt)</td><td>12</td><td>≈ 0%</td><td><strong>50.0%</strong></td></tr>
  </tbody>
</table>
</div>

Vollständig autonome Erfolgsrate. Warum ein eingefrorenes Backbone das gespiegelte Layout dennoch lernen kann: Der Fehlermodus war _gar keine Bewegung_ statt einer Bewegung in die falsche Richtung – das visuelle Verständnis war intakt, nur die Abbildung auf Aktionen fehlte.

## 4. RL-Algorithmen für den realen Roboter {#algorithms}

### 4.1 Advantage-konditioniertes Training im Stil von RECAP {#recap}

Rejection Sampling ist der binäre Spezialfall des Advantage: jeden Erfolg behalten, jeden Fehlschlag verwerfen. **Das Advantage-Labeling von π0.6 RECAP (wie in RLinf) auf GR00T N1.7 portiert**, sodass _alle_ Daten genutzt werden, mit „gut vs. schlecht“ als Eingabebedingung statt als Filter – Fehlschlag-Episoden werden zu negativen Beispielen statt zu Abfall.

{% include svg_figure.liquid name="honor_recap" caption="Pipeline im RECAP-Stil. Die Fehlschlagstrafe c_fail = 1000 übersteigt die Differenz zwischen dem längsten Erfolg (1.000 Frames) und dem kürzesten Fehlschlag (57 Frames), sodass jeder Fehlschlag unter jedem Erfolg rangiert. n = 20 Schritte entsprechen dem 1-s-Horizont des Papers bei 20 Hz. Negative Beispiele formen nur den unkonditionierten CFG-Zweig." %}

{% include svg_figure.liquid name="honor_value_net" caption="Value-Netz. Das GR00T-Backbone bleibt eingefroren und erhält keinen Gradienten; Bild- und Text-Tokens werden getrennt per Mittelwert gepoolt, weil Bild-Tokens die Text-Tokens bei Weitem überwiegen und ein einzelner Mittelwert die Sprachkonditionierung verwässern würde. RLinf hängt ein lernbares CLS-Token an und nutzt einen einzelnen linearen Kopf; das GR00T-Backbone akzeptiert keine zusätzlichen Eingabe-Embeddings, daher poolen wir stattdessen und ergänzen eine Hidden-Schicht. Die Skizze der Atomverteilung ist illustrativ." %}

Bis V bereit ist, dienen regelbasierte Labels als Fallback: alle Erfolgs-Frames positiv, autonome Frames von Fehlschlägen negativ, und die 20 Frames vor jeder Übernahme werden als negativ überschrieben. Das Value-Netz wird separat trainiert und nur akzeptiert, wenn Spearman ρ auf zurückgehaltenen Episoden (jede 10. Episode) 0,55 übersteigt: Der Probelauf erreichte ρ = 0,647 (Plateau 0,59) bei einem Loss von 4,52 → 0,76, während eine Kontrolle mit permutierten Labels bei einem absoluten ρ ≤ 0,26 blieb und das Kriterium verfehlte – das Kriterium ist also aussagekräftig. Die Übereinstimmung zwischen V-basierten und regelbasierten Labels lag nur bei 0,31, das Value-Netz bleibt also der Engpass, und der A/B-Vergleich auf dem realen Roboter wurde nicht abgeschlossen.

### 4.2 RAPID: schnelle Anpassung im Rauschraum {#rapid}

**RAPID** (_Rapid Adaptation from Physical Interventions via Diffusion-noise_), im Geiste von DSRL: Das Training eines neuen Checkpoints braucht Zeit, und bis er ankommt, kann der Roboter die Aufgabe weiterhin nicht. RAPID lässt die VLA-Gewichte eingefroren und ersetzt nur das Anfangsrauschen des Flow Matching, sodass eine Korrektur, die der Mensch gerade vorgenommen hat, beim nächsten Auftreten eines ähnlichen Zustands wiederverwendet werden kann. Es wurde Ende August in die Inferenz auf dem Roboter eingebunden.

{% include svg_figure.liquid name="honor_rapid" caption="RAPID. Offline werden menschliche Korrekturen durch die eingefrorene Policy in das Anfangsrauschen invertiert, das sie reproduziert (64 feine Schritte; 4-Schritt-Euler ist zu grob), und in einem nach Beobachtung indizierten Speicher abgelegt. Beim Einsatz wird das abgerufene Rauschen vor dem normalen Flow-Matching-Sampling sphärisch mit Gauß-Rauschen interpoliert." %}

{% include svg_figure.liquid name="honor_dsbc_net" caption="DSBC-Rauschnetz. Ein kleines MLP bildet den Abrufschlüssel direkt auf das Anfangsrauschen ab und ersetzt die Nächste-Nachbarn-Suche; das VLA selbst bleibt eingefroren. H ist der 40-Schritte-Aktionshorizont des GR00T-Aktionskopfs (30 Schritte werden pro Inferenz ausgeführt); D ist dessen Aktionsdimension." %}

{% include svg_figure.liquid name="honor_rapid_chart" caption="Offline-Validierung auf 24 Übernahme-Episoden einer Zählaufgabe. DSBC liegt bei jedem K vorn (54,9–57,0); der Speicherabruf erreicht bei K = 1–2 nur 20 und bei K ≥ 4 45–49; Partial Noising bleibt konstant bei 37; memory_delta liegt unter 8. Die Metrik ist der DTW-Gewinn, nicht die Erfolgsrate auf dem realen Roboter." %}

Das Audit war **vorab registriert**: Audit PASS; Reversal CONDITIONAL (Rekonstruktionsfehler 0,232, innerhalb von 0,10–0,30); Spread nach einem erneuten Lauf auf fragil herabgestuft; Transfer PASS (p ≈ 1e-21). Unter diesen Kriterien wurde die Behauptung „Abruf gewinnt bei K < 10“ **verworfen** – das Versuchsdesign widerlegte meine eigene Hypothese –, und das System konvergierte auf DSBC als Hauptpfad mit Speicherabruf als optionalem Front-End. Als nächste Schritte standen an: DSBC in die Policy zu destillieren, Speichereinträge sanft auszumustern und es an RL auf dem realen Roboter anzubinden.

### 4.3 Erweiterung auf Loco-Manipulation {#loco}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/locomanip_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/locomanip_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">Der Humanoide geht autonom zu einem Tresen und greift eine Flasche – 7 Clips vom realen Roboter, 5-fache Geschwindigkeit, ohne Ton; gelbe Bodenmarkierungen sind Referenzen für den Laufweg.</p>

Der gesamte Stack – Übernahme, Lernschleife auf dem realen Roboter, RECAP und RAPID – ließ sich vom Pick-and-Place auf dem Tisch ohne Neuschreiben auf eine Aufgabe mit Laufen übertragen.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Loco-Manipulation-Daten</th><th>Wert</th></tr></thead>
  <tbody>
    <tr><td>Erfasste Lauf-Episoden</td><td>507 Episoden · 181K Frames</td></tr>
    <tr><td>Behalten nach 6 Auswahlkriterien</td><td>326 Episoden</td></tr>
    <tr><td>Zusammengeführter Trainingssatz</td><td><strong>848 Episoden · 306K Frames (+71 %)</strong></td></tr>
    <tr><td>Median der Weglänge pro Episode</td><td>0,32 m → <strong>3,2 m</strong></td></tr>
  </tbody>
</table>
</div>

**Ehrlich zu den Metriken:** Für die SFT-Stufe auf dem realen Roboter liegen vollständige Zahlen vor (55 % / 50 %). Nach dem Wechsel zur Loco-Aufgabe waren alle Komponenten implementiert und eingebunden, doch es wurde keine Verbesserung auf Metrikebene erzielt: Der damalige Reifegrad von Ganzkörper-Hardware und Lokomotions-Stack erlaubte keine systematische Evaluation auf dem realen Roboter.

## 5. Reproduktion von ROVE {#rove}

**Aufgabe.** Der Humanoide steht an Ort und Stelle – Füße fixiert, kein Laufen – und nimmt mit der Hand ein Telefon auf: feine Manipulation, bei der eine kleine Fehlausrichtung schnell zu einer menschlichen Übernahme führt.

ROVE (XPENG, arXiv:2606.17011) behält das Advantage-Konditionierungsgerüst von RECAP (§4.1) bei und ändert, wie menschliche Übernahmen bewertet werden. Ich habe es auf der RECAP-Pipeline hinter einem einzigen Algorithmus-Schalter reproduziert – der Standardpfad RECAP bleibt bitidentisch, durch Selbsttests abgesichert – und Algorithmus 1 des Papers als Offline-Schleife ausgeführt: einsetzen und erfassen → stufenbewusste Returns → Value-Aktualisierung → Advantages und Labels → konditionales SFT. Nur der erste Schritt braucht den Roboter; die anderen vier laufen als ein einziger Befehl.

### 5.1 Stufenbewusster Return {#rove-return}

Unter RECAP zählt eine Episode, die ein Mensch gerettet hat, weiterhin als Erfolg: Ihr Return steigt mit jedem Schritt um eins bis 0, sodass die autonomen Aktionen, die die Übernahme _verursacht_ haben, wie stetiger Fortschritt aussehen. Das einzige Gegenmittel ist eine feste Regel, die die 20 Frames vor einer Übernahme als negativ labelt. ROVE teilt eine solche Episode in drei Segmente – autonome Ausführung, Anpassung (der Mensch zieht den Roboter noch zurück auf Kurs) und Wiederherstellung – und verbucht eine Fehlschlagstrafe C_fail bei t_r, dem Ende der Anpassung. Das autonome Segment, das zur Übernahme führte, wird nun auf Fehlschlagniveau bewertet, während die Wiederherstellung ihren normalen Time-to-go-Return behält.

{% include svg_figure.liquid name="honor_rove_return" caption="Stufenbewusster Return (Gl. 2 des Papers): −1 pro Schritt, C_fail bei t_r, Leerlauf-Frames (Bediener wechselt den Modus) entfernt. t_r fällt auf Übernahme + 40 Frames (2 s) zurück, wenn es nicht annotiert ist; die Ablation des Papers verliert 30 pp, wenn t_r auf den Beginn der Übernahme gelegt wird, daher liegt der Standard bewusst spät. C_fail muss die längste Spanne im positiven Pool übersteigen, sonst würde eine fehlgeschlagene Episode eine Wiederherstellung überbieten: Die gemessene untere Schranke für diese Daten ist 919, daher C_fail = 1000 (die 500 des Papers sind hier zu klein). Die Returns stimmten auf 38 archivierten Episoden bitgenau mit der Handrechnung überein." %}

### 5.2 Optimistische Wertschätzung (OVE) {#rove-ove}

Reine Monte-Carlo-Regression lernt den _durchschnittlichen_ Return. In Zuständen, die oft in einer Übernahme enden, ist der Durchschnitt bereits niedrig, sodass die Aktion, die die Übernahme verursacht hat, einen Advantage nahe null erhält und nie negativ gelabelt wird. OVE feintunt nach dem MC-Vortraining denselben skalaren Value-Kopf mit einem 16-Schritte-TD-Ziel (aus einer EMA-Kopie des Netzes) und einem Expektil-Loss mit τ = 0,7, der Unterschätzungen stärker bestraft als Überschätzungen. V schätzt dann, was ein Zustand wert ist, _wenn alles gut läuft_: Zustände vor einer Übernahme werden hoch bewertet, ihr tatsächlicher Return ist niedrig, und der negative Advantage fällt auf die Aktionen, die die Übernahme verursacht haben. Der Advantage-Horizont beträgt ebenfalls 16 Schritte – ein Action Chunk, die Einheit, an der das Label hängt –, und die oberen 40 % der Frames werden positiv gelabelt.

Jeder Value-Checkpoint wird über Spearman ρ auf zurückgehaltenen Episoden geprüft: die Rangübereinstimmung zwischen vorhergesagtem V und tatsächlichem Return (1 = gleiche Reihenfolge). Die MC-Stufe muss auf dem vollen Pool ρ ≥ 0,55 erreichen; die OVE-Stufe wird nur auf Erfolgs-Episoden beurteilt (ρ ≥ 0,70), weil OVE bei Zuständen, die auf einen Fehlschlag zulaufen, absichtlich vom mittleren Return abweicht, ein niedrigeres ρ auf dem vollen Pool also zu erwarten ist und keine Regression darstellt.

{% include svg_figure.liquid name="honor_rove_rho" caption="Spearman ρ auf zurückgehaltenen Daten in drei Value-Trainingsläufen (schattiert: OVE-Phase). Saubere Rollouts: ρ auf der Erfolgsmenge bleibt nach dem Wechsel zu OVE bei 0,744–0,806, während ρ auf dem vollen Pool wie beabsichtigt von 0,735 auf 0,69 absinkt; die Schranke von 0,70 wurde aus diesem Lauf abgeleitet. Demos + Rollouts: ρ auf der Erfolgsmenge sinkt von 0,731 auf 0,628 – 85 % der zurückgehaltenen Menge sind saubere Demonstrationen, und optimistisches Bootstrapping schiebt sie alle nach oben und staucht das Ranking. iter0-Pool, direkt in OVE warm gestartet: ρ auf dem vollen Pool 0,68–0,71, auf der Erfolgsmenge 0,63–0,67, unter der Schranke. Die drei Pools haben unterschiedliche zurückgehaltene Mengen, daher ist ρ zwischen den Panels nicht vergleichbar." %}

<figure class="fig">
  <img src="{{ '/assets/img/honor_rove_value_curve.jpg' | relative_url }}" alt="Wertkurven auf einer zurückgehaltenen Übernahme-Episode: wahrer Return, MC-Wert und OVE-Wert, mit markierten Frames mit negativem Advantage" loading="lazy" width="1400" height="653">
  <figcaption>Reproduktion von Abb. 6 des Papers auf einer zurückgehaltenen Episode mit Übernahme (x: Frame, Leerlauf-Frames entfernt; y: normalisierter Wert). Vor t_r liegt der OVE-Wert (blau) über dem MC-Wert (orange) – optimistisch in der Verteilung –, springt dann bei t_r und folgt durch die Wiederherstellung dem wahren Return. Rote Punkte markieren Frames mit negativem OVE-Advantage: Sie konzentrieren sich vor der Übernahme und im Anpassungssegment.</figcaption>
</figure>

### 5.3 Ergebnisse {#rove-results}

Die autonome Erfolgsrate auf dem Roboter stieg von 40 % (Basis-Checkpoint, n = 77) auf **52 %** (ROVE iter0, n = 192); menschlich unterstützte Erfolge sanken von 45 % auf 20 % der Episoden, während Fehlschläge von 14 % auf 28 % stiegen.

{% include svg_figure.liquid name="honor_rove_robot" caption="Ergebnis jeder protokollierten Episode auf dem realen Roboter pro Checkpoint, vom Bediener beurteilt. Basis 64000: Ende Aug – Anfang Sep; Basis 80000: Anfang – Mitte Sep; ROVE iter0: 17.–23. Sep." %}

iter0 wurde mit einem Durchlauf der Offline-Schleife trainiert: ein Value-Pool aus 2.068 Episoden (534K Frames aus Demonstrationen und Rollouts auf dem realen Roboter, 207 Episoden zurückgehalten), Labels mit exakt 40,0 % positiven Anteilen und konditionales SFT ab dem Basis-Checkpoint bei 80K Schritten über 8.000 Schritte (lr 1e-4) auf einer H20-GPU in 18 h 17 min.

{% include svg_figure.liquid name="honor_rove_sft" caption="Loss des konditionalen SFT von iter0. Der 200-Schritte-Mittelwert fällt von 0,54 bis Schritt 1.000 auf 0,047 und bis Schritt 8.000 auf 0,025." %}

**Ehrlich zu den Metriken:** Die drei Gruppen stammen von verschiedenen Tagen, Bedienern und Prompt-Sets, dies ist also eine Beobachtung und kein A/B-Test – die verschachtelte Evaluation gegen den Basis-Checkpoint und einen RECAP-Arm steht noch aus. Bei der iter0-Erfassung wurden zudem keine Übernahmesegmente protokolliert, sodass der nächsten Runde das Kernsignal von ROVE fehlt, bis dieses Logging behoben ist.

## 6. Debugging am realen Roboter {#debugging}

Keiner dieser Fehler ließ sich durch Code-Review offline finden – sie traten erst in langen Läufen auf dem realen Roboter zutage, und jeder wurde mit einer Sonde oder einer quantitativen Metrik lokalisiert.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Symptom</th><th>Sonde / Beleg</th><th>Ursache → Behebung</th></tr></thead>
  <tbody>
    <tr><td>Generalisierung driftet nach dem Feintuning</td><td>Held-out-Loss 0,0048 → 0,0222 bei Schritt 2000 (×4,6); Kosinus der Aktionsrichtung 0,995 → 0,979 → 0,961</td><td>Der Mixer der Basisdaten las mp4 als BGR, während der eingefrorene Vision-Tower RGB erwartet – das halbe Gradientenbudget lernte Rauschen; mit einem Standardwert behoben. Die Anker deckten nur 29 Episoden (5,6 %) ab → Basispuffer vergrößern</td></tr>
    <tr><td>Puffer füllt sich mit falschen Erfolgen</td><td>Episoden rasteten nach 24 und 29 Schritten auf „Erfolg“ ein; der Learner trainierte 1.000+ Schritte darauf</td><td>Einrasten und Zurücksetzen teilten sich eine Schwelle von 0,5, keine Hysterese → Einrasten bei p &gt; 0,8 × 20 Frames, Zurücksetzen bei p ≤ 0,3 × 3 Frames. Ein später nicht zurückgesetztes Objekt erzeugte 2.536 Müll-Schritte über 11 Episoden – knapp über der Trainingsschwelle von 2.500 Schritten: ab der ersten Sitzung Frame für Frame prüfen</td></tr>
    <tr><td>Verhalten unterscheidet sich zwischen Training, Einsatz und RL</td><td>Feldweiser Vergleich der Beobachtungen über die drei Pipelines</td><td>DDS-Typ des Greifers, eine kopfstehende Kamera, Initialisierung der Handposition, Indizierung der Kopfposition → Korrekturliste mit 9 Punkten</td></tr>
    <tr><td>Roboter dreht sich zu Beginn der Episode</td><td>Median der Gierdrift 31°</td><td>Veralteter Gier-Anker + vollständiges Neuverankern bei jedem Chunk → Ratenbegrenzung von 3°/Chunk mit einer Obergrenze von 20°; 6 Validierungsläufe: Verankerungsfehler 0,0°, Drehung in der ersten Sekunde ≤ 1,6°</td></tr>
    <tr><td>Veraltete Kamerabilder</td><td>47 % doppelte aufeinanderfolgende Frames in 77 von 83 Episoden; Quelle 61 Hz, Dekodierung 54,9 Hz, effektiv ≈ 10,6 Hz unter Last</td><td>Beobachtbarkeit der Frame-Aktualität ergänzt</td></tr>
    <tr><td>„Das Modell bewegt sich nicht“</td><td>Trainer-Client blockierte in Wiederholungsversuchen</td><td>Nicht übereinstimmende Ports von Actor / Learner. Lehre: Jedes „das Modell bewegt sich nicht“ ist zuerst eine Kommunikations- oder Beobachtungsprüfung, dann eine Gewichtsprüfung</td></tr>
  </tbody>
</table>
</div>
