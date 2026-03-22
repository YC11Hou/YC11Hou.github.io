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

Object-Goal Navigation (ObjectNav) requires an agent to autonomously explore an unknown environment and navigate toward target objects specified by a semantic label. While prior work has primarily studied zero-shot ObjectNav under 2D locomotion, extending it to aerial platforms with 3D locomotion capability remains underexplored. Aerial robots offer superior maneuverability and search efficiency, but they also introduce new challenges in spatial perception, dynamic control, and safety assurance. In this paper, we propose AION for vision-based aerial ObjectNav without relying on external localization or global maps. AION is an end-to-end dual-policy reinforcement learning (RL) framework that decouples exploration and goal-reaching behaviors into two specialized policies. We evaluate AION on the AI2-THOR benchmark and further assess its real-time performance in IsaacSim using high-fidelity drone models. Experimental results show that AION achieves superior performance across comprehensive evaluation metrics in exploration, navigation efficiency, and safety.

## Details

**1. Task**

Indoor object-goal navigation for UAVs with **3D locomotion**: the drone must autonomously explore an unknown environment and navigate toward a target object specified by a semantic label (e.g., "laptop", "microwave"), without any prior map or external localization.

**2. Framework**

A dual-policy RL framework that switches between two modes based on target visibility:
- **Exploration Mode** — maximize spatial coverage in unknown space
- **Goal-Reaching Mode** — visual servoing toward the detected target object

<div style="display: flex; gap: 1rem; margin: 1.5em 0;">
  <div style="flex: 1;">
    <img src="/assets/img/p2_model_arch.jpg" alt="AION dual-policy architecture" style="width: 100%; border-radius: 0.25rem;">
  </div>
  <div style="flex: 1;">
    <img src="/assets/img/p2_visual_input.jpg" alt="Depth-based ROI extraction" style="width: 100%; border-radius: 0.25rem;">
  </div>
</div>

**3. Exploration Mode**

**Input:**
Depth map + ROI (Region of Interest). The ROI identifies open, navigable areas in the depth image — simulating how humans instinctively look toward open spaces when navigating. The ROI is extracted using OpenCV-based methods and provides a directional cue (centroid position $$(d_x, d_y)$$ and mean depth $$\bar{z}$$), rather than absolute unknown-space information.

**Rewards:**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$: reward for moving toward open space
- $$R_{center}$$: penalty for yaw deviation from ROI centroid
- $$R_{safe}$$: collision / obstacle proximity penalty

**4. Goal-Reaching Mode**

**Input:**
RGB image + frozen CLIP text embedding (aligns text and visual features for zero-shot object recognition) + object/class bounding box.

**Rewards:**

$$r_t^G = R_{dist} + R_{bbox} + R_{parent} + R_{suc} - R_{collision}$$

- $$R_{dist}$$: reward for reducing Euclidean distance to target
- $$R_{bbox}$$: reward for centering and enlarging the target bounding box in the field of view (indicates approaching the object)
- $$R_{parent}$$: parent-class reward — e.g., reaching a desk earns partial reward if the target is a laptop on that desk
- $$R_{suc}$$: task success reward
- $$R_{collision}$$: collision penalty

**5. Action Space**

Discrete **3D** actions — forward, turn left/right, ascend, descend, etc.

**6. Evaluation**

Evaluated on two simulators: AI2-THOR (standard benchmark with seen/unseen object splits) and IsaacSim (larger multi-room environments where the target may be in a different room).

<div style="display: flex; gap: 1rem; margin: 1.5em 0;">
  <div style="flex: 1; overflow-x: auto; font-size: 0.85em;">
    <strong>AI2-THOR Benchmark</strong>
    <table>
      <thead><tr><th>Model</th><th>Split</th><th>Seen SR</th><th>SPL</th><th>Unseen SR</th><th>SPL</th></tr></thead>
      <tbody>
        <tr><td>BaseModel</td><td>18/4</td><td>76.7</td><td>39.9</td><td>81.5</td><td>36.4</td></tr>
        <tr><td>Scene Prior</td><td>18/4</td><td>74.3</td><td>42.1</td><td>83.7</td><td>41.9</td></tr>
        <tr><td>MJO</td><td>18/4</td><td>81.2</td><td>52.0</td><td>90.7</td><td>51.7</td></tr>
        <tr><td>SSNet</td><td>18/4</td><td>72.3</td><td>50.4</td><td>77.8</td><td>50.0</td></tr>
        <tr><td><strong>Ours</strong></td><td><strong>18/4</strong></td><td><strong>88.7</strong></td><td><strong>57.9</strong></td><td><strong>95.0</strong></td><td><strong>55.2</strong></td></tr>
        <tr><td>BaseModel</td><td>14/8</td><td>73.3</td><td>47.3</td><td>70.8</td><td>46.6</td></tr>
        <tr><td>Scene Prior</td><td>14/8</td><td>79.3</td><td>52.7</td><td>71.0</td><td>44.8</td></tr>
        <tr><td>MJO</td><td>14/8</td><td>78.8</td><td>43.6</td><td>83.0</td><td>45.6</td></tr>
        <tr><td>SSNet</td><td>14/8</td><td>79.2</td><td>44.3</td><td>81.8</td><td>46.4</td></tr>
        <tr><td><strong>Ours</strong></td><td><strong>14/8</strong></td><td><strong>84.7</strong></td><td><strong>61.2</strong></td><td><strong>87.0</strong></td><td><strong>60.5</strong></td></tr>
      </tbody>
    </table>
    <small>SR = Success Rate (%), SPL = Success weighted by Path Length (%)</small>
  </div>
  <div style="flex: 1; overflow-x: auto; font-size: 0.85em;">
    <strong>IsaacSim Cross-Scene</strong>
    <table>
      <thead><tr><th>Algorithm</th><th>Object</th><th>Chem.</th><th>Beech.</th><th>Ihlen</th></tr></thead>
      <tbody>
        <tr><td rowspan="4">Exp+MJO</td><td>Sofa</td><td>3/5</td><td>4/5</td><td>4/5</td></tr>
        <tr><td>Plant</td><td>2/5</td><td><strong>5/5</strong></td><td><strong>5/5</strong></td></tr>
        <tr><td>Laptop</td><td>0/5</td><td>3/5</td><td><strong>5/5</strong></td></tr>
        <tr><td>Microwave</td><td>2/5</td><td>5/5</td><td>2/5</td></tr>
        <tr><td rowspan="4">Exp+SSNet</td><td>Sofa</td><td>3/5</td><td>4/5</td><td>3/5</td></tr>
        <tr><td>Plant</td><td>3/5</td><td>2/5</td><td>3/5</td></tr>
        <tr><td>Laptop</td><td>0/5</td><td>3/5</td><td><strong>5/5</strong></td></tr>
        <tr><td>Microwave</td><td>1/5</td><td><strong>5/5</strong></td><td>3/5</td></tr>
        <tr><td rowspan="4"><strong>AION</strong></td><td>Sofa</td><td><strong>4/5</strong></td><td>4/5</td><td><strong>5/5</strong></td></tr>
        <tr><td>Plant</td><td><strong>5/5</strong></td><td><strong>5/5</strong></td><td>4/5</td></tr>
        <tr><td>Laptop</td><td><strong>2/5</strong></td><td><strong>5/5</strong></td><td><strong>5/5</strong></td></tr>
        <tr><td>Microwave</td><td><strong>3/5</strong></td><td><strong>5/5</strong></td><td><strong>5/5</strong></td></tr>
      </tbody>
    </table>
    <small>SR = Success Rate (successes / 5 trials)</small>
  </div>
</div>

<div style="display: flex; gap: 1rem; margin: 1.5em 0;">
  <div style="flex: 1;">
    <img src="/assets/img/p2_isaac.jpg" alt="IsaacSim scenes and target objects" style="width: 100%; border-radius: 0.25rem;">
  </div>
  <div style="flex: 1;">
    <img src="/assets/img/p2_exploration_beechwood.png" alt="Exploration trajectories in Beechwood" style="width: 100%; border-radius: 0.25rem;">
  </div>
</div>

## Resources

- [arXiv Paper](https://arxiv.org/abs/2601.15614)
