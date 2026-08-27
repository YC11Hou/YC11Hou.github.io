---
layout: page
title: "Honor Omega Humanoid: Online RL for VLA"
description: VLA Algorithm Engineer Intern at Honor (Jun 2026 – present). Built a human-in-the-loop online SFT / online RL pipeline for Honor's self-developed Omega humanoid robot — smooth teleoperator takeover, an intervention-driven data pipeline, and a distributed Actor–Learner–Robot learning loop.
img: assets/video/honor/inference_demo_poster.jpg
importance: 1
category: internship
related_publications: false
---

<p class="project-links">
  <span class="venue-badge">Honor Device Co., Ltd. · Shanghai</span>
  <span>VLA Algorithm Engineer (Intern) · Jun 2026 – Present</span>
</p>

Working on Honor's self-developed **Omega humanoid robot**: teleoperation data collection, replay, training, and on-robot deployment, along with **online RL** algorithm research for **Vision-Language-Action (VLA)** models on custom manipulation tasks.

## Demos

### On-robot inference under perturbations

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/inference_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/inference_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Autonomous pick-and-place rollouts on the real robot while the object (left) and the target basket (right) are perturbed mid-episode — the policy re-tracks and completes the task.

### Data design for robustness

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/data_design_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/data_design.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Four categories of teleoperated demonstrations: standard demonstrations, perturbations during the pick phase, perturbations during the place phase, and recovery from failed-grasp states — designed so the policy learns to recover, not just to repeat.

### Online SFT: before vs. after

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

A task the offline-trained policy could not perform is learned on the robot through the online learning loop — human takeover data flows back into training, and the takeover ratio drops as new checkpoints are dispatched.

## What I built

**Smooth human takeover.** Seamless human-teleoperator intervention during autonomous rollouts, including the autonomy–teleoperation transition state machine, so a teleoperator can take over and hand back control mid-episode without disturbing the robot.

**Intervention-driven data pipeline.** On-robot data recording during takeovers, full local disk persistence, and automatic upload to the development server for training.

**Distributed learning loop.** A closed loop across three tiers: the robot's onboard AGX/NX boards (topic publishing, command execution, data collection), an x86 host as the **Actor** (model inference, streaming actions to the robot), and a development server as the **Learner** (data aggregation, training, checkpoint dispatch) — a complete **online SFT / online RL** pipeline.

## Algorithm research

Researching **RECAP**-style (π<sub>0.6</sub>) offline RL combined with **noise-space fast adaptation** (DSRL-like): learning corrective noise from human-intervention data so the policy can rapidly imitate takeover behaviors before a new checkpoint finishes training — substantially raising success rates on tasks uncovered by offline training — and further adapting the algorithm to **loco-manipulation** tasks.
