---
lang: it
project: 3_vln_drone
title: "Navigazione visione-linguaggio per droni autonomi"
source_hash: a77378003039
---

<p class="project-links">
  <a href="https://github.com/YC11Hou/habitat-aerial-nav" target="_blank" rel="noopener">
    <i class="fab fa-github"></i> Code: github.com/YC11Hou/habitat-aerial-nav
  </a>
</p>

<nav class="contrib">
  <p>Cosa ho fatto · clicca su una scheda per saltare alla sezione</p>
  <ol>
    <li><a href="#pipeline"><strong>Pipeline di traiettorie</strong><span>Lattice A* · decollo → crociera → atterraggio</span></a></li>
    <li><a href="#overview"><strong>Dataset</strong><span>90 scene · oltre 10.000 traiettorie, open source</span></a></li>
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
    <img src="/assets/img/p3_3dvln.jpg" alt="Vista egocentrica durante la generazione della traiettoria">
  </div>
  <div>
    <img src="/assets/img/p3_3stage_traj.jpg" alt="Traiettoria in 3 fasi: decollo, crociera, atterraggio">
  </div>
</div>

## Panoramica {#overview}

Ho costruito una pipeline robusta per generare traiettorie di navigazione 3D diversificate nel simulatore Habitat, per addestrare policy di navigazione visione-linguaggio (VLN) su robot aerei.

**Motivazione:** i dataset VLN esistenti riguardano robot terrestri su grafi di navigazione discreti; i droni richiedono traiettorie 3D continue di decollo → crociera → atterraggio e un dataset simile non esisteva, quindi lo abbiamo costruito da zero.

**Simulatore:** Habitat con 90 scene d'interni.

**Scala:** 90 scene × 200–300 coppie partenza-destinazione ciascuna → **oltre 10.000** traiettorie 3D in tre fasi con istruzioni in linguaggio naturale, rilasciate open source su GitHub.

## Pipeline {#pipeline}

{% include svg_figure.liquid name="vln_pipeline" caption="Pipeline di generazione in quattro passi. Lattice A* pianifica su primitive di movimento in (x, y, θ), così il drone ruota mentre avanza, invece di compiere le svolte ad angolo retto di Grid A* (schema sotto, a scopo illustrativo)." %}

1. **Generazione delle coppie partenza-destinazione** — Per ciascuna delle 90 scene, si generano 200–300 coppie casuali 2D di partenza e destinazione come estremi della navigazione.

2. **Pianificazione del percorso di crociera 2D** — Si determina una quota di crociera costante adatta a ciascuna scena, quindi si pianifica un percorso 2D naturale a quella quota con **Lattice A\***. A differenza del Grid A\* standard, che produce rigide svolte ad angolo retto, Lattice A\* pianifica su primitive di movimento nello spazio degli stati continuo $$(x, y, \theta)$$, generando percorsi fluidi in cui l'agente ruota mentre avanza. Euristica:

   $$H(s) = \frac{\|p - p_{goal}\|}{L} + \lambda \cdot |\Delta\theta|$$

   Questo penalizza le curve brusche e garantisce traiettorie di volo fluide e realistiche.

3. **Assemblaggio della traiettoria 3D** — Si antepone un segmento di **decollo** e si aggiunge un segmento di **atterraggio** a ogni percorso di crociera, formando una traiettoria 3D completa. Lungo l'intero percorso si raccolgono osservazioni RGB-D sotto forma di video.

4. **Generazione delle istruzioni** — Un modello video-to-text genera istruzioni di navigazione in linguaggio naturale a partire dai video di osservazione raccolti, completando il dataset VLN.

Il design è volutamente semplificato — il drone non cambia quota di frequente durante il volo — eppure decollo e atterraggio, combinati con le istruzioni, sono già difficili per i modelli attuali. L'addestramento delle policy sul dataset è portato avanti dai colleghi di laboratorio.
