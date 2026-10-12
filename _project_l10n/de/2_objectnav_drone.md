---
lang: de
project: 2_objectnav_drone
title: "AION: Aerial Indoor Object-Goal Navigation"
source_hash: 2dc0fa747eda
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2601.15614" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2601.15614
  </a>
</p>

<nav class="contrib">
  <p>Mein Beitrag (zweiter Autor) · Karte anklicken, um dorthin zu springen</p>
  <ol>
    <li><a href="#framework"><strong>Dual-Policy-Framework</strong><span>Erkunden, wenn das Ziel nicht im Blickfeld ist</span></a></li>
    <li><a href="#exploration"><strong>Explorations-Policy</strong><span>Tiefenbasierter Hinweis auf offene Bereiche + Belohnungen</span></a></li>
    <li><a href="#evaluation"><strong>Evaluation</strong><span>AI2-THOR + IsaacSim mit mehreren Räumen</span></a></li>
  </ol>
</nav>

## Demo

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/img/aion_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/aion_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

## Überblick

Die Object-Goal Navigation (ObjectNav) verlangt von einem Agenten, eine unbekannte Umgebung autonom zu erkunden und sich zu Zielobjekten zu navigieren, die durch ein semantisches Label vorgegeben sind. Bisherige Arbeiten haben vor allem Zero-Shot-ObjectNav mit 2D-Fortbewegung untersucht; die Übertragung auf Luftfahrzeuge mit 3D-Fortbewegung ist dagegen noch wenig erforscht. Fluggeräte bieten höhere Wendigkeit und Sucheffizienz, bringen aber neue Herausforderungen für Raumwahrnehmung, dynamische Regelung und Sicherheit mit sich. In dieser Arbeit stellen wir AION für visionbasierte aerielle ObjectNav ohne externe Lokalisierung und ohne globale Karten vor. AION ist ein durchgängiges Dual-Policy-Framework für Reinforcement Learning (RL), das Exploration und Zielansteuerung auf zwei spezialisierte Policies aufteilt. Wir evaluieren AION auf dem AI2-THOR-Benchmark und prüfen die Echtzeitleistung zusätzlich in IsaacSim mit hochgenauen Drohnenmodellen. Die Experimente zeigen, dass AION über alle Metriken zu Exploration, Navigationseffizienz und Sicherheit hinweg überlegene Ergebnisse erzielt.

## Details

**1. Aufgabe**

Indoor-Object-Goal-Navigation für UAVs mit **3D-Fortbewegung**: Die Drohne muss eine unbekannte Umgebung autonom erkunden und sich zu einem Zielobjekt navigieren, das durch ein semantisches Label vorgegeben ist (z. B. „laptop", „microwave"), ohne vorherige Karte und ohne externe Lokalisierung.

**Meine Rolle:** Ich habe die Explorations-Policy entworfen, trainiert und validiert.

**Warum zwei Policies:** Frühere Arbeiten verwenden eine einzige Policy zur Zielansteuerung (LSTM + CLIP-Abgleich von Text und Bild). In AI2-THOR genügt das, da die Räume klein sind und das Ziel nach einer Drehung meist sichtbar ist; befindet sich das Ziel aber in einem anderen Raum, hat CLIP nichts zum Abgleichen, und der Agent dreht sich auf der Stelle. Wir trennen das Verhalten daher danach, ob das Ziel im Blickfeld ist, erweitern es auf 3D-Bewegung für Drohnen und skalieren von einzelnen Räumen auf Umgebungen mit mehreren Räumen.

**2. Framework**
{: #framework}

Ein Dual-Policy-RL-Framework, das je nach Sichtbarkeit des Ziels zwischen zwei Modi wechselt:

- **Explorationsmodus** — räumliche Abdeckung im unbekannten Raum maximieren
- **Zielansteuerungsmodus** — Visual Servoing auf das erkannte Zielobjekt

<div class="media-row">
  <div>
    <img src="/assets/img/p2_model_arch.jpg" alt="AION-Dual-Policy-Architektur">
  </div>
  <div>
    <img src="/assets/img/p2_visual_input.jpg" alt="Tiefenbasierte ROI-Extraktion">
  </div>
</div>

**3. Explorationsmodus**
{: #exploration}

**Eingabe:**
Tiefenkarte + ROI (Region of Interest). Die ROI kennzeichnet offene, befahrbare Bereiche im Tiefenbild — sie ahmt nach, wie Menschen beim Navigieren instinktiv zu offenen Räumen blicken. Die ROI wird mit OpenCV-basierten Methoden extrahiert und liefert einen Richtungshinweis (Schwerpunktposition $$(d_x, d_y)$$ und mittlere Tiefe $$\bar{z}$$) statt absoluter Informationen über unbekannten Raum.

**Belohnungen:**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$: Belohnung für die Bewegung auf offenen Raum zu
- $$R_{center}$$: Strafe für die Gierabweichung vom ROI-Schwerpunkt
- $$R_{safe}$$: Strafe für Kollisionen bzw. zu geringen Hindernisabstand
- zusätzlich ein Bonus für die abgedeckte Fläche

Rohe RGB-D-Daten direkt in ein LSTM zu geben, erzeugt kein Explorationsverhalten; erst der ROI-Hinweis verleiht der rekurrenten Policy einen ausgeprägten Richtungssinn, ganz ohne Odometrie oder Karte. Nach unserem Wissen ist dies die erste rein visionbasierte, kartenfreie Explorations-Policy für Flugroboter.

**4. Zielansteuerungsmodus**

**Eingabe:**
RGB-Bild + eingefrorenes CLIP-Text-Embedding (gleicht Text- und Bildmerkmale für die Zero-Shot-Objekterkennung ab) + Bounding Box des Objekts bzw. der Klasse.

**Belohnungen:**

$$r_t^G = R_{dist} + R_{bbox} + R_{parent} + R_{suc} - R_{collision}$$

- $$R_{dist}$$: Belohnung für die Verringerung des euklidischen Abstands zum Ziel
- $$R_{bbox}$$: Belohnung dafür, die Bounding Box des Ziels im Sichtfeld zu zentrieren und zu vergrößern (zeigt die Annäherung an das Objekt an)
- $$R_{parent}$$: Belohnung für die übergeordnete Klasse — z. B. gibt das Erreichen eines Schreibtischs eine Teilbelohnung, wenn das Ziel ein Laptop auf diesem Schreibtisch ist
- $$R_{suc}$$: Belohnung für den Aufgabenerfolg
- $$R_{collision}$$: Kollisionsstrafe

**5. Aktionsraum**

Diskrete **3D**-Aktionen — vorwärts, nach links/rechts drehen, steigen, sinken usw.

**6. Evaluation**
{: #evaluation}

Die Evaluation erfolgt in zwei Simulatoren: AI2-THOR (Standard-Benchmark mit Splits für bekannte und unbekannte Objekte) und IsaacSim (größere Umgebungen mit mehreren Räumen, in denen sich das Ziel in einem anderen Raum befinden kann).

Die einzelnen Räume in AI2-THOR können die Exploration nicht testen — das Ziel ist oft von Anfang an sichtbar —, deshalb haben wir in IsaacSim eine Evaluation mit mehreren Räumen aufgebaut (Chemistry Lab, Beechwood, Ihlen), in der die Ziele in Räumen liegen, die vom Start aus nicht sichtbar sind. Methoden mit nur einer Zielansteuerungs-Policy drehen sich auf der Stelle; mit der Explorations-Policy steuert die Drohne auf offenen Raum zu und findet das Ziel über Räume hinweg.

{% include svg_figure.liquid name="aion_thor" caption="AI2-THOR-Benchmark auf zwei Objekt-Splits. AION führt bei jeder Metrik auf beiden Splits; auf dem Split 18/4 mit unbekannten Objekten verbessert es sich gegenüber MJO um 4,3 Punkte bei SR und 3,5 bei SPL." %}

{% include svg_figure.liquid name="aion_isaac" caption="Szenenübergreifende Evaluation in IsaacSim in drei Szenen mit mehreren Räumen und hochgenauen Drohnenmodellen. Jeder Punkt ist ein Versuch (fünf pro Objekt und Szene); AION ist in 52 von 60 Versuchen erfolgreich, gegenüber 40 und 35 bei der Kombination aus Exploration mit MJO bzw. SSNet." %}

<div class="media-row">
  <div>
    <img src="/assets/img/p2_isaac.jpg" alt="IsaacSim-Szenen und Zielobjekte">
  </div>
  <div>
    <img src="/assets/img/p2_exploration_beechwood.png" alt="Explorationstrajektorien in Beechwood">
  </div>
</div>
