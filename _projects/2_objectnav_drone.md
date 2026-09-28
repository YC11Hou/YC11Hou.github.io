---
layout: page
title: "AION: Aerial Indoor Object-Goal Navigation"
description: Accepted at IROS 2026. End-to-end dual-policy RL framework for vision-based aerial ObjectNav without external localization or global maps. Evaluated on AI2-THOR and IsaacSim.
img: assets/img/aion_poster.jpg
preview_video: /assets/video/aion_preview.mp4
importance: 2
category: master
org: nus
i18n_key: aion
venue: IROS 2026
scholar_id: u5HHmVD_uO8C
scholar_cites: 17972743793882607765
arxiv: "2601.15614"
start: 2025-06
end: 2026-06
meta: Co-author
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2601.15614" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2601.15614
  </a>
</p>

<div class="contrib" markdown="1">
What I did (second author) — click to jump

1. [Dual-policy framework](#framework) — split exploration from goal-reaching, because CLIP alignment is useless when the target is out of view.
2. [Exploration policy](#exploration) — designed, trained and validated it: the largest open region of the depth image and its bearing are fed to the LSTM, with forward / center / safety / coverage rewards.
3. [Evaluation](#evaluation) — AI2-THOR benchmark plus a multi-room IsaacSim evaluation where the target sits in another room.
</div>

## Demo

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/img/aion_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/aion_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

## Overview

Object-Goal Navigation (ObjectNav) requires an agent to autonomously explore an unknown environment and navigate toward target objects specified by a semantic label. While prior work has primarily studied zero-shot ObjectNav under 2D locomotion, extending it to aerial platforms with 3D locomotion capability remains underexplored. Aerial robots offer superior maneuverability and search efficiency, but they also introduce new challenges in spatial perception, dynamic control, and safety assurance. In this paper, we propose AION for vision-based aerial ObjectNav without relying on external localization or global maps. AION is an end-to-end dual-policy reinforcement learning (RL) framework that decouples exploration and goal-reaching behaviors into two specialized policies. We evaluate AION on the AI2-THOR benchmark and further assess its real-time performance in IsaacSim using high-fidelity drone models. Experimental results show that AION achieves superior performance across comprehensive evaluation metrics in exploration, navigation efficiency, and safety.

## Details

**1. Task**

Indoor object-goal navigation for UAVs with **3D locomotion**: the drone must autonomously explore an unknown environment and navigate toward a target object specified by a semantic label (e.g., "laptop", "microwave"), without any prior map or external localization.

**My role:** I designed, trained and validated the exploration policy.

**Why two policies:** prior work uses a single goal-reaching policy (LSTM + CLIP text–vision alignment). That is enough in AI2-THOR, where rooms are small and the target is usually visible after one turn; but when the target is in another room, CLIP has nothing to align with and the agent spins in place. We therefore split behavior by whether the target is in view, extend it to 3D motion for drones, and scale from single rooms to multi-room environments.

**2. Framework**
{: #framework}

A dual-policy RL framework that switches between two modes based on target visibility:

- **Exploration Mode** — maximize spatial coverage in unknown space
- **Goal-Reaching Mode** — visual servoing toward the detected target object

<div class="media-row">
  <div>
    <img src="/assets/img/p2_model_arch.jpg" alt="AION dual-policy architecture">
  </div>
  <div>
    <img src="/assets/img/p2_visual_input.jpg" alt="Depth-based ROI extraction">
  </div>
</div>

**3. Exploration Mode**
{: #exploration}

**Input:**
Depth map + ROI (Region of Interest). The ROI identifies open, navigable areas in the depth image — simulating how humans instinctively look toward open spaces when navigating. The ROI is extracted using OpenCV-based methods and provides a directional cue (centroid position $$(d_x, d_y)$$ and mean depth $$\bar{z}$$), rather than absolute unknown-space information.

**Rewards:**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$: reward for moving toward open space
- $$R_{center}$$: penalty for yaw deviation from ROI centroid
- $$R_{safe}$$: collision / obstacle proximity penalty
- plus a coverage-area bonus

Feeding raw RGB-D straight into an LSTM does not produce exploration behavior; the ROI cue is what gives the recurrent policy a strong sense of direction, with no odometry or map. To our knowledge, this is the first purely vision-based, map-free exploration policy for aerial robots.

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
{: #evaluation}

Evaluated on two simulators: AI2-THOR (standard benchmark with seen/unseen object splits) and IsaacSim (larger multi-room environments where the target may be in a different room).

AI2-THOR's single rooms cannot test exploration — the target is often visible from the start — so we built a multi-room evaluation in IsaacSim (Chemistry Lab, Beechwood, Ihlen) with targets placed in rooms not visible from the start. Methods with only a goal-reaching policy spin in place; with the exploration policy, the drone heads for open space and finds the target across rooms.

{% include svg_figure.liquid name="aion_thor" caption="AI2-THOR benchmark on two object splits. AION leads every metric on both splits; on the 18/4 unseen split it improves over MJO by 4.3 points in SR and 3.5 in SPL." %}

{% include svg_figure.liquid name="aion_isaac" caption="IsaacSim cross-scene evaluation in three multi-room scenes with high-fidelity drone models. Each dot is one trial (five per object and scene); AION succeeds in 52 of 60 trials, versus 40 and 35 for exploration combined with MJO and SSNet." %}

<div class="media-row">
  <div>
    <img src="/assets/img/p2_isaac.jpg" alt="IsaacSim scenes and target objects">
  </div>
  <div>
    <img src="/assets/img/p2_exploration_beechwood.png" alt="Exploration trajectories in Beechwood">
  </div>
</div>
