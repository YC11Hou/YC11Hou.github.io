---
lang: de
project: 3_vln_drone
title: "Vision-Language-Navigation für autonome Drohnen"
source_hash: a77378003039
---

<p class="project-links">
  <a href="https://github.com/YC11Hou/habitat-aerial-nav" target="_blank" rel="noopener">
    <i class="fab fa-github"></i> Code: github.com/YC11Hou/habitat-aerial-nav
  </a>
</p>

<nav class="contrib">
  <p>Meine Beiträge · Karte anklicken, um zu springen</p>
  <ol>
    <li><a href="#pipeline"><strong>Trajektorien-Pipeline</strong><span>Lattice A* · Start → Reiseflug → Landung</span></a></li>
    <li><a href="#overview"><strong>Datensatz</strong><span>90 Szenen · über 10.000 Trajektorien, Open Source</span></a></li>
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
    <img src="/assets/img/p3_3dvln.jpg" alt="Egozentrische Ansicht während der Trajektoriengenerierung">
  </div>
  <div>
    <img src="/assets/img/p3_3stage_traj.jpg" alt="Dreistufige Trajektorie: Start, Reiseflug, Landung">
  </div>
</div>

## Überblick {#overview}

Entwicklung einer robusten Pipeline zur Erzeugung vielfältiger 3D-Navigationstrajektorien im Habitat-Simulator, um Vision-Language-Navigation-Policies (VLN) für Flugroboter zu trainieren.

**Motivation:** Bestehende VLN-Datensätze sind für Bodenroboter auf diskreten Navigationsgraphen ausgelegt; Drohnen benötigen kontinuierliche 3D-Trajektorien aus Start, Reiseflug und Landung. Einen solchen Datensatz gab es nicht, also haben wir ihn von Grund auf selbst erstellt.

**Simulator:** Habitat mit 90 Innenraumszenen.

**Umfang:** 90 Szenen × je 200–300 Start-Ziel-Paare → **über 10.000** dreistufige 3D-Trajektorien mit sprachlichen Anweisungen, als Open Source auf GitHub veröffentlicht.

## Pipeline {#pipeline}

{% include svg_figure.liquid name="vln_pipeline" caption="Vierstufige Generierungs-Pipeline. Lattice A* plant über Bewegungsprimitive in (x, y, θ), sodass die Drohne während der Vorwärtsbewegung kurvt, statt wie bei Grid A* rechtwinklig abzubiegen (Skizze unten, illustrativ)." %}

1. **Generierung von Start-Ziel-Paaren** — Für jede der 90 Szenen werden 200–300 zufällige 2D-Start-Ziel-Paare als Endpunkte der Navigation erzeugt.

2. **2D-Reiseflugplanung** — Für jede Szene wird eine geeignete konstante Reiseflughöhe bestimmt und auf dieser Höhe mit **Lattice A\*** ein natürlicher 2D-Pfad geplant. Anders als das übliche Grid A\*, das starre rechtwinklige Kurven erzeugt, plant Lattice A\* über Bewegungsprimitive im kontinuierlichen Zustandsraum $$(x, y, \theta)$$ und liefert glatte Pfade, auf denen der Agent während der Vorwärtsbewegung abbiegt. Heuristik:

   $$H(s) = \frac{\|p - p_{goal}\|}{L} + \lambda \cdot |\Delta\theta|$$

   Sie bestraft scharfe Kurven und sorgt so für glatte, realistische Flugtrajektorien.

3. **Zusammensetzen der 3D-Trajektorie** — Jedem Reiseflugpfad wird ein **Start**-Segment vorangestellt und ein **Lande**-Segment angehängt, sodass eine vollständige 3D-Trajektorie entsteht. Entlang des gesamten Pfads werden RGB-D-Beobachtungen als Video aufgezeichnet.

4. **Generierung der Anweisungen** — Ein Video-zu-Text-Modell erzeugt aus den aufgezeichneten Beobachtungsvideos natürlichsprachliche Navigationsanweisungen, woraus ein vollständiger VLN-Datensatz entsteht.

Das Design ist bewusst vereinfacht — die Drohne ändert mitten im Flug nicht häufig ihre Höhe —, doch Start und Landung in Kombination mit den Anweisungen sind für aktuelle Modelle bereits schwierig. Das Policy-Training auf dem Datensatz übernehmen Kollegen aus dem Labor.
