---
lang: de
project: 1_vla_benchmark
title: "LangGap: Benchmark zum Sprachverständnis von VLA-Modellen"
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
  <p>Mein Beitrag (Erstautor) · Karte anklicken, um zu springen</p>
  <ol>
    <li><a href="#benchmark"><strong>Benchmark-Entwurf</strong><span>99 Aufgaben · 4 Perturbationsdimensionen</span></a></li>
    <li><a href="#data"><strong>Datenerhebung</strong><span>16 Aufgaben × 150 skriptgesteuerte Demos</span></a></li>
    <li><a href="#training"><strong>Modelltraining</strong><span>π0.5 LoRA · Einzelaufgabe 0% → 90%</span></a></li>
    <li><a href="#results"><strong>Ergebnisanalyse</strong><span>93.8% → 21.4% · 4 VLA-Modelle</span></a></li>
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

## Überblick

Vision-Language-Action-Modelle (VLA) erreichen auf Standard-Benchmarks Erfolgsquoten von über 95%. Systematische Experimente zeigen jedoch, dass aktuelle VLA-Modelle auf dem Stand der Technik Spracheingaben weitgehend ignorieren. Bisherigen Arbeiten fehlen: (1) systematische Diagnosen mittels semantischer Perturbation, (2) ein Benchmark, der Sprachverständnis konstruktionsbedingt erzwingt, und (3) sprachlich vielfältige Trainingsdaten. Diese Arbeit konstruiert den LangGap-Benchmark auf Grundlage einer vierdimensionalen semantischen Perturbationsmethode -- die Semantik der Anweisung wird variiert, während das Tischlayout fest bleibt -- und legt damit Defizite im Sprachverständnis von π0.5 offen. Bestehende Benchmarks wie LIBERO weisen jedem Layout nur eine einzige Aufgabe zu und nutzen die vorhandenen Objekte und Zielorte nicht aus; LangGap diversifiziert Pick-and-Place-Aufgaben bei identischen Layouts vollständig und zwingt Modelle so zu echtem Sprachverständnis. Die Experimente zeigen, dass gezielte Datenaugmentierung die Sprachlücke teilweise schließen kann -- die Erfolgsquote steigt beim Einzelaufgabentraining von 0% auf 90% und beim Multitask-Training von 0% auf 28%. Mit wachsender semantischer Vielfalt der erweiterten Aufgaben erweist sich die Lernkapazität der Modelle jedoch als gravierend unzureichend; selbst trainierte Aufgaben werden schlecht gelöst. Das offenbart eine grundlegende Herausforderung für VLA-Modelle beim Verstehen vielfältiger Spracheingaben -- und genau darin liegt der langfristige Wert von LangGap.

## Details

**1. Benchmark & Datensatz**
{: #benchmark}

LangGap-Benchmark: insgesamt **99 Aufgaben** — 40 ursprüngliche LIBERO-Aufgaben + 59 erweiterte Aufgaben mit semantischer Perturbation. Wir stellen einen Trainingsdatensatz mit 56 Aufgaben bereit: 16 selbst erhobene erweiterte Aufgaben (je 150 Demos) + 40 ursprüngliche Aufgaben (je 50 Demos), zusammen ca. 4.100 Trajektorien.

**2. Problementdeckung**
{: #diagnosis}

Wird die Anweisung in derselben visuellen Szene von „put bowl on plate" → „put bowl on stove" geändert, führt das Modell weiterhin die ursprüngliche Aktion aus (fährt zum Teller) und erreicht **0% Erfolg**. Das zeigt, dass VLAs eine Zuordnung von Bild zu Aktion lernen, statt Sprache wirklich zu verstehen.

Wir entwerfen eine vierdimensionale Diagnose durch semantische Perturbation — Change Object, Change Target, Spatial Description und Drawer Action —, bei der die visuelle Szene identisch bleibt und nur die Anweisung verändert wird:

{% include svg_figure.liquid name="langgap_diagnosis" caption="Diagnose von π0.5 über 99 Aufgaben und 1.980 Episoden. Unser erneuter Lauf der 40 ursprünglichen Aufgaben stimmt mit dem offiziellen Wert überein; bei den 59 erweiterten Aufgaben fällt er um 72,4 Punkte. Bei Change Target scheitert π0.5 in allen 260 Episoden, und kein getestetes Modell übersteigt 2,3%; der Fehler ist also kein Artefakt der Formulierung — und der Gesamtwert verdeckt ihn." %}

<div class="media-row">
  <div>
    <img src="/assets/img/libero_suites_strip.png" alt="LIBERO-Evaluierungssuiten mit Anmerkungen zu den Perturbationen">
  </div>
</div>

**3. Entwurfsprinzipien**
{: #design}

1. **Multitask in derselben Szene** — Mehrere Aufgaben teilen identische visuelle Ausgangszustände, wodurch visuelle Abkürzungen entfallen. Ein Modell, das Sprache ignoriert, erreicht höchstens eine Erfolgsquote von 1/k (k = Aufgaben pro Szene).
2. **Trennung von Training und Evaluation auf Anweisungsebene** — Die Trainingsaufgaben enthalten nicht alle Testaufgaben; die zurückgehaltene Evaluation enthält unbekannte Anweisungen, um kompositionelle Generalisierung zu prüfen.
3. **Validierung der physischen Machbarkeit** — Alle erweiterten Aufgaben wurden im LIBERO-Simulator geprüft, damit Greifbarkeit, Erreichbarkeit und Erkennbarkeit gewährleistet sind.

**4. Pipeline der Datenerhebung**
{: #data}

- **Skalierbare und vielfältige Erzeugung:** Wir verwenden eine skriptgesteuerte, wegpunktbasierte Erhebungspipeline, um pro Aufgabe effizient und stabil 150 erfolgreiche Episoden zu sammeln. Die Wegpunkte sind zwar für jede Aufgabe fest codiert, der Simulator erzeugt jedoch leichte natürliche Variationen in den anfänglichen Tischlayouts. So sind die gesammelten Trajektorien visuell und dynamisch vielfältig, und die Modelle können nicht bloß starre, identische Pfade auswendig lernen.
- **Hierarchische Regelungsarchitektur:** Jede Aufgabe nutzt ein eigenes Skript, das den Pick-and-Place-Vorgang in mehrere aufeinanderfolgende Wegpunkte zerlegt. Auf der oberen Ebene wenden wir eine reine Proportionalregelung (P) an, die Positionsfehler berechnet und kontinuierliche Aktionsbefehle ausgibt. Diese Befehle führt anschließend der PD-Regler OSC (Operational Space Control) des Simulators auf der unteren Ebene aus, was eine nahtlose, hochpräzise kontinuierliche Regelung ergibt.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_waypoints.jpg" alt="Wegpunktfolge einer skriptgesteuerten Demonstration: Ausgangsposition, Greifen, Transport, Ablegen" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Zeitlicher Ablauf der Wegpunkte einer skriptgesteuerten Demonstration (schematisch): Ausgangsposition → über dem Objekt → Greifen → Anheben → über dem Ziel → Ablegen. OSC_POSE-Regler mit auf [−1, 1] normiertem Posenfehler pro Schritt; eine Episode wird nur behalten, wenn sie innerhalb des Schrittbudgets erfolgreich ist.</p>

- **Warum Skripte statt Teleoperation:** Frühe Versuche mit Maus-Teleoperation waren ruckelig, langsam und uneinheitlich. Skripte, die anhand der Objektkoordinaten in der BDDL-Datei jeder Aufgabe geschrieben und im Simulator von Hand abgestimmt wurden, bis jede Aufgabe greifbar, erreichbar und erkennbar war, liefern saubere Aktionen und eine vollautomatische Erhebung: ca. 150 Demos pro Aufgabe (die offiziellen LIBERO-Aufgaben haben 50), 16 Aufgaben ≈ 2.400 Demos.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_rollout_2x8.jpg" alt="Auswahl skriptgesteuerter Demonstrations-Rollouts" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Eine Auswahl der 2.400 skriptgesteuerten Demonstrationen.</p>

**Fine-Tuning: Einzelaufgabe von 0% auf 90%**
{: #training}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="/assets/img/langgap_before_after_poster.jpg">
    <source src="/assets/video/langgap_before_after.mp4" type="video/mp4">
  </video>
</div>
<p class="caption">Links: vor dem Training — die Anweisung nennt „stove", doch die Policy legt die Schüssel weiterhin auf den Teller. Rechts: nach dem Fine-Tuning auf den erweiterten Daten — die Schüssel kommt auf den Herd.</p>

- π0.5 mit LoRA (r = 64) auf einer einzelnen RTX 4090.
- Checkpoints werden anhand von Rollouts ausgewählt, nicht anhand des Loss: Der Loss sinkt stetig, während die Erfolgsquote nicht monoton verläuft.
- Trainings- und Testanweisungen sind wortgleich, mit Ausnahme der 43 zurückgehaltenen Aufgaben, deren Anweisungen neu sind.

**5. Ergebnisse**
{: #results}

{% include svg_figure.liquid name="langgap_benchmark" caption="Vollständiger Benchmark: aktuelle VLA-Modelle auf allen vier LIBERO-Suiten, ursprüngliche gegenüber erweiterten Aufgaben. Jedes Modell zeigt eine große Sprachlücke; unser auf 45 Aufgaben feinabgestimmtes π0.5 verbessert die Summe der erweiterten Aufgaben (22,8) und Change Target (0 → 6,2) und behält dabei 89,5 auf den ursprünglichen Aufgaben. Die 43 zurückgehaltenen Aufgaben wurden nie trainiert." %}

{% include svg_figure.liquid name="langgap_progressive" caption="Progressive Validierung mit denselben erweiterten Daten, während die Zahl der Trainingsaufgaben von 1 auf 56 wächst. Das Auswendiglernen einer Einzelaufgabe erreicht 90%, doch die Gewinne brechen ein, sobald semantisch verschiedene Aufgaben gemeinsam gelernt werden; die Beimischung der 40 offiziellen Aufgaben (56 Aufgaben) stellt 27,5% wieder her, während die Sprachlücke bestehen bleibt." %}

**6. Langfristiger Wert**

Mit wachsender semantischer Vielfalt der Aufgaben erweist sich die Lernkapazität der Modelle als gravierend unzureichend — selbst trainierte Aufgaben werden schlecht gelöst. Das offenbart eine grundlegende Herausforderung, die architekturunabhängig ist: Alle getesteten Modelle (π0.5, π0, π0-FAST, SmolVLA) zeigen dieselbe Sprachlücke. LangGap bietet ein systematisches Diagnosewerkzeug, das auch mit neuen VLA-Architekturen wertvoll bleibt, gerade weil die Sprachlücke ein hartnäckiges Problem ist, das die gängigen Trainingsparadigmen bislang nicht gelöst haben.
