---
layout: page
title: "AION: Aerial Indoor Object-Goal Navigation"
description: End-to-end dual-policy RL framework for vision-based aerial ObjectNav without external localization or global maps. Evaluated on AI2-THOR and IsaacSim.
img: assets/img/aion_thumbnail.jpg
video: https://www.youtube.com/embed/TgsUm6bb7zg
importance: 2
category: master
---

## Demo

<div class="video-container">
  <iframe src="https://www.youtube.com/embed/TgsUm6bb7zg" allowfullscreen></iframe>
</div>

## Overview

Object-Goal Navigation (ObjectNav) requires an agent to autonomously explore unknown environments and navigate toward target objects specified by semantic labels. While prior work has primarily studied zero-shot ObjectNav under 2D locomotion, extending it to aerial platforms with 3D locomotion remains underexplored.

**AION** is an end-to-end dual-policy reinforcement learning framework that decouples exploration and goal-reaching behaviors into two specialized policies. It enables vision-based aerial ObjectNav without relying on external localization or global maps.

## Task

Indoor object-goal navigation for UAVs with **3D locomotion**: the drone must autonomously explore an unknown environment and navigate toward a target object specified by a semantic label (e.g., "laptop", "microwave"), without any prior map or external localization.

## Framework

A dual-policy RL framework that switches between two modes based on target visibility:
- **Exploration Mode** — maximize spatial coverage in unknown space
- **Goal-Reaching Mode** — visual servoing toward the detected target object

<div style="margin: 1.5em 0;">
  <img src="/assets/img/p2_intro.jpeg" alt="AION dual-policy framework" style="max-width: 70%; border-radius: 0.25rem;">
</div>

## Exploration Mode

<div style="margin: 1.5em 0;">
  <img src="/assets/img/p2_visual_input.jpg" alt="Depth-based ROI extraction" style="max-width: 70%; border-radius: 0.25rem;">
</div>

**Input:** Depth map + ROI (Region of Interest). The ROI identifies open, navigable areas in the depth image — simulating how humans instinctively look toward open spaces when navigating. The ROI is extracted using OpenCV-based methods and provides a directional cue (centroid position $$(d_x, d_y)$$ and mean depth $$\bar{z}$$), rather than absolute unknown-space information.

**Rewards:**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$: reward for moving toward open space
- $$R_{center}$$: penalty for yaw deviation from ROI centroid
- $$R_{safe}$$: collision / obstacle proximity penalty

## Goal-Reaching Mode

**Input:** RGB image + frozen CLIP text embedding (aligns text and visual features for zero-shot object recognition) + object/class bounding box.

**Rewards:**

$$r_t^G = R_{dist} + R_{bbox} + R_{parent} + R_{suc} - R_{collision}$$

- $$R_{dist}$$: reward for reducing Euclidean distance to target
- $$R_{bbox}$$: reward for centering and enlarging the target bounding box in the field of view (indicates approaching the object)
- $$R_{parent}$$: parent-class reward — e.g., reaching a desk earns partial reward if the target is a laptop on that desk
- $$R_{suc}$$: task success reward
- $$R_{collision}$$: collision penalty

## Action Space

Discrete **3D** actions — forward, turn left/right, ascend, descend, etc.

## Evaluation

### AI2-THOR Benchmark

| Model | Split | Seen SR | Seen SPL | Unseen SR | Unseen SPL |
|-------|-------|---------|----------|-----------|------------|
| BaseModel | 18/4 | 76.7 | 39.9 | 81.5 | 36.4 |
| Scene Prior | 18/4 | 74.3 | 42.1 | 83.7 | 41.9 |
| MJO | 18/4 | 81.2 | 52.0 | 90.7 | 51.7 |
| SSNet | 18/4 | 72.3 | 50.4 | 77.8 | 50.0 |
| **Ours** | **18/4** | **88.7** | **57.9** | **95.0** | **55.2** |
| BaseModel | 14/8 | 73.3 | 47.3 | 70.8 | 46.6 |
| Scene Prior | 14/8 | 79.3 | 52.7 | 71.0 | 44.8 |
| MJO | 14/8 | 78.8 | 43.6 | 83.0 | 45.6 |
| SSNet | 14/8 | 79.2 | 44.3 | 81.8 | 46.4 |
| **Ours** | **14/8** | **84.7** | **61.2** | **87.0** | **60.5** |

SR = Success Rate (%), SPL = Success weighted by Path Length (%).

### IsaacSim Cross-Scene

Larger multi-room environments where the target object may be in a different room.

| Algorithm | Object | Chemistry SR | Beechwood SR | Ihlen SR |
|-----------|--------|-------------|-------------|---------|
| Exp+MJO | Sofa | 3/5 | 4/5 | 4/5 |
| | Plant | 2/5 | **5/5** | **5/5** |
| | Laptop | 0/5 | 3/5 | **5/5** |
| | Microwave | 2/5 | 5/5 | 2/5 |
| Exp+SSNet | Sofa | 3/5 | 4/5 | 3/5 |
| | Plant | 3/5 | 2/5 | 3/5 |
| | Laptop | 0/5 | 3/5 | **5/5** |
| | Microwave | 1/5 | **5/5** | 3/5 |
| **AION** | Sofa | **4/5** | 4/5 | **5/5** |
| | Plant | **5/5** | **5/5** | 4/5 |
| | Laptop | **2/5** | **5/5** | **5/5** |
| | Microwave | **3/5** | **5/5** | **5/5** |

SR = Success Rate (successes / 5 trials).

## Resources

- [arXiv Paper](https://arxiv.org/abs/2601.15614)
