---
layout: page
title: Vision-Language Navigation on Autonomous Drone
description: Built a robust pipeline to generate various 3D paths in the Habitat simulator. Overcame challenges of the simulator initially designed only for ground robots by designing a robust 3D navigation algorithm and obstacle detection method. Trained a strong and general policy for drone navigation.
preview_video: /assets/video/vln_highlights.mp4
importance: 3
category: master
github: https://github.com/YC11Hou/habitat-aerial-nav
---

<p style="margin-bottom: 1rem;">
  <a href="https://github.com/YC11Hou/habitat-aerial-nav" target="_blank" rel="noopener">
    <i class="fab fa-github"></i> Code: github.com/YC11Hou/habitat-aerial-nav
  </a>
</p>

## Demo

<div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
  <div style="flex: 1; position: relative; padding-bottom: 28%; height: 0; overflow: hidden; border-radius: 0.25rem;">
    <video controls style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
      <source src="/assets/video/vln_highlights.mp4" type="video/mp4">
    </video>
  </div>
  <div style="flex: 1; position: relative; padding-bottom: 28%; height: 0; overflow: hidden; border-radius: 0.25rem;">
    <video autoplay loop muted playsinline style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
      <source src="/assets/video/vln_overview.webm" type="video/webm">
    </video>
  </div>
</div>

<div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
  <div style="flex: 1;">
    <img src="/assets/img/p3_3dvln.jpg" alt="Ego-centric view during trajectory generation" style="width: 100%; border-radius: 0.25rem;">
  </div>
  <div style="flex: 1;">
    <img src="/assets/img/p3_3stage_traj.jpg" alt="3-stage trajectory: Takeoff, Cruise, Landing" style="width: 100%; border-radius: 0.25rem;">
  </div>
</div>

## Overview

Built a robust pipeline to generate diverse 3D navigation trajectories in the Habitat simulator for training vision-language navigation (VLN) policies on aerial robots.

**Simulator:** Habitat with 90 indoor scenes.

## Pipeline

1. **Start-Goal Pair Generation** — For each of the 90 scenes, generate 200–300 random 2D start-goal pairs as navigation endpoints.

2. **2D Cruise Path Planning** — Determine a suitable constant cruising altitude for each scene, then plan a natural 2D path at that altitude using **Lattice A\***. Unlike standard Grid A\* which produces rigid right-angle turns, Lattice A\* plans over motion primitives in continuous state space $$(x, y, \theta)$$, producing smooth paths where the agent turns while moving forward. Heuristic:

   $$H(s) = \frac{\|p - p_{goal}\|}{L} + \lambda \cdot |\Delta\theta|$$

   This penalizes sharp turns to ensure smooth, realistic flight trajectories.

3. **3D Trajectory Assembly** — Prepend a **takeoff** segment and append a **landing** segment to each cruise path, forming a complete 3D trajectory. Collect RGB-D observations along the full path as video.

4. **Instruction Generation** — Use a video-to-text model to generate natural language navigation instructions from the collected observation videos, producing a complete VLN dataset.
