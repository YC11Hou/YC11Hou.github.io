---
layout: page
title: Vision-Language Navigation on Autonomous Drone
description: Built a robust pipeline to generate various 3D paths in the Habitat simulator. Overcame challenges of the simulator initially designed only for ground robots by designing a robust 3D navigation algorithm and obstacle detection method. Trained a strong and general policy for drone navigation.
preview_video: /assets/video/vln_preview.mp4
img: assets/img/vln_poster.jpg
importance: 3
category: master
org: nus
i18n_key: vln
start: 2025-06
end: 2026-02
meta: Habitat · Aerial VLN dataset pipeline
github: https://github.com/YC11Hou/habitat-aerial-nav
---

<p class="project-links">
  <a href="https://github.com/YC11Hou/habitat-aerial-nav" target="_blank" rel="noopener">
    <i class="fab fa-github"></i> Code: github.com/YC11Hou/habitat-aerial-nav
  </a>
</p>

<nav class="contrib">
  <p>What I did · click a card to jump</p>
  <ol>
    <li><a href="#pipeline"><strong>Trajectory pipeline</strong><span>Lattice A* · takeoff → cruise → land</span></a></li>
    <li><a href="#overview"><strong>Dataset</strong><span>90 scenes · 10,000+ trajectories, open-sourced</span></a></li>
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
    <img src="/assets/img/p3_3dvln.jpg" alt="Ego-centric view during trajectory generation">
  </div>
  <div>
    <img src="/assets/img/p3_3stage_traj.jpg" alt="3-stage trajectory: Takeoff, Cruise, Landing">
  </div>
</div>

## Overview {#overview}

Built a robust pipeline to generate diverse 3D navigation trajectories in the Habitat simulator for training vision-language navigation (VLN) policies on aerial robots.

**Motivation:** existing VLN datasets are for ground robots on discrete navigation graphs; drones need continuous takeoff → cruise → landing trajectories in 3D, and no such dataset existed, so we built one from scratch.

**Simulator:** Habitat with 90 indoor scenes.

**Scale:** 90 scenes × 200–300 start-goal pairs each → **10,000+** three-stage 3D trajectories with language instructions, open-sourced on GitHub.

## Pipeline {#pipeline}

{% include svg_figure.liquid name="vln_pipeline" caption="Four-step generation pipeline. Lattice A* plans over motion primitives in (x, y, θ), so the drone turns while moving forward instead of making the right-angle turns of Grid A* (sketch below, illustrative)." %}

1. **Start-Goal Pair Generation** — For each of the 90 scenes, generate 200–300 random 2D start-goal pairs as navigation endpoints.

2. **2D Cruise Path Planning** — Determine a suitable constant cruising altitude for each scene, then plan a natural 2D path at that altitude using **Lattice A\***. Unlike standard Grid A\* which produces rigid right-angle turns, Lattice A\* plans over motion primitives in continuous state space $$(x, y, \theta)$$, producing smooth paths where the agent turns while moving forward. Heuristic:

   $$H(s) = \frac{\|p - p_{goal}\|}{L} + \lambda \cdot |\Delta\theta|$$

   This penalizes sharp turns to ensure smooth, realistic flight trajectories.

3. **3D Trajectory Assembly** — Prepend a **takeoff** segment and append a **landing** segment to each cruise path, forming a complete 3D trajectory. Collect RGB-D observations along the full path as video.

4. **Instruction Generation** — Use a video-to-text model to generate natural language navigation instructions from the collected observation videos, producing a complete VLN dataset.

The design is deliberately simplified — the drone does not change altitude frequently mid-flight — yet takeoff and landing combined with instructions are already hard for current models. Policy training on the dataset is carried on by labmates.
