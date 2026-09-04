---
layout: page
title: "LangGap: VLA Language Understanding Benchmark"
description: Accepted at IROS 2026. Designed a systematic semantic perturbation evaluation framework revealing that state-of-the-art VLA models ignore language instructions despite high benchmark scores. Proposed multi-task same-scene training approach and constructed augmented dataset for fine-tuning.
preview_video: /assets/video/grid_8x4.mp4
importance: 1
category: master
org: nus
i18n_key: langgap
venue: IROS 2026
scholar_id: u-x6o8ySG0sC
arxiv: 2603.00592
meta: Oct 2025 – Jun 2026 · First author
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2603.00592" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2603.00592
  </a>
</p>

## Demo

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata">
      <source src="/assets/video/langgap_video.mp4" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video autoplay loop muted playsinline>
      <source src="/assets/video/grid_8x4.mp4" type="video/mp4">
    </video>
  </div>
</div>

## Overview

Vision-Language-Action (VLA) models achieve over 95% success on standard benchmarks. However, through systematic experiments, we find that current state-of-the-art VLA models largely ignore language instructions. Prior work lacks: (1) systematic semantic perturbation diagnostics, (2) a benchmark that forces language understanding by design, and (3) linguistically diverse training data. This paper constructs the LangGap benchmark, based on a four-dimensional semantic perturbation method -- varying instruction semantics while keeping the tabletop layout fixed -- revealing language understanding deficits in π0.5. Existing benchmarks like LIBERO assign only one task per layout, underutilizing available objects and target locations; LangGap fully diversifies pick-and-place tasks under identical layouts, forcing models to truly understand language. Experiments show that targeted data augmentation can partially close the language gap -- success rate improves from 0% to 90% with single-task training, and 0% to 28% with multi-task training. However, as semantic diversity of extended tasks increases, model learning capacity proves severely insufficient; even trained tasks perform poorly. This reveals a fundamental challenge for VLA models in understanding diverse language instructions -- precisely the long-term value of LangGap.

## Details

**1. Benchmark & Dataset**

LangGap benchmark: **99 tasks** total — 40 original LIBERO tasks + 59 extended semantic perturbation tasks. We provide a training dataset of 56 tasks: 16 self-collected extended tasks (150 demos each) + 40 original tasks (50 demos each), totaling ~4,100 trajectories.

**2. Problem Discovery**

When changing the instruction from "put bowl on plate" → "put bowl on stove" in the same visual scene, the model still executes the original action (goes to plate), achieving **0% success**. This reveals that VLAs perform vision-to-action pattern matching rather than genuine language understanding.

We design a four-dimensional semantic perturbation diagnostic — Change Object, Change Target, Spatial Description, and Drawer Action — keeping the visual scene identical and only modifying the instruction:

<div style="overflow-x: auto; font-size: 0.85em; margin: 1em 0;">
<table>
  <thead><tr><th>Category</th><th>Tasks</th><th>Episodes</th><th>Success Rate</th></tr></thead>
  <tbody>
    <tr><td>Original (LIBERO)</td><td>40</td><td>800</td><td>93.8%</td></tr>
    <tr><td>Extended (Ours)</td><td>59</td><td>1,180</td><td>21.4%</td></tr>
    <tr><td>Change Object</td><td>38</td><td>760</td><td>29.3%</td></tr>
    <tr><td>Change Target</td><td>13</td><td>260</td><td><strong>0.0%</strong></td></tr>
    <tr><td>Spatial Description</td><td>5</td><td>100</td><td>11.0%</td></tr>
    <tr><td>Drawer Action</td><td>3</td><td>60</td><td>31.7%</td></tr>
  </tbody>
</table>
</div>

<div class="media-row">
  <div>
    <img src="/assets/img/libero_suites_strip.png" alt="LIBERO evaluation suites with perturbation annotations">
  </div>
</div>

**3. Design Principles**

1. **Same-Scene Multi-Task** — Multiple tasks share identical initial visual states, eliminating visual shortcuts. A model ignoring language achieves at most 1/k success rate (k = tasks per scene).
2. **Instruction-Level Train/Eval Split** — Training tasks do not include all test tasks; held-out evaluation contains unseen language instructions to test compositional generalization.
3. **Physical Feasibility Validation** — All extended tasks verified in the LIBERO simulator to ensure graspability, reachability, and detectability.

**4. Data Collection Pipeline**

- **Scalable & Diverse Generation:** We employ a scripted, waypoint-based collection pipeline to efficiently and stably gather 150 successful episodes per task. While the waypoints are hard-coded for each specific task, the simulator introduces slight natural variations in the initial tabletop layouts. This ensures the collected trajectories are visually and dynamically diverse, preventing models from merely memorizing rigid, identical paths.
- **Hierarchical Control Architecture:** Each task utilizes a custom script that decomposes the pick-and-place process into multiple sequential waypoints. At the high level, we apply pure Proportional (P) control to calculate positional errors and output continuous action commands. These commands are then executed by the simulator's low-level OSC (Operational Space Control) PD controller, achieving seamless, highly precise continuous control.

**5. Results**

<div class="media-row">
  <div style="overflow-x: auto; font-size: 0.8em;">
    <strong>Cross-Model Benchmark</strong>
    <table>
      <thead><tr><th>Method</th><th>Orig.</th><th>Ext.</th><th>Ch.Obj</th><th>Ch.Tgt</th></tr></thead>
      <tbody>
        <tr><td>π0.5</td><td>93.8%</td><td>21.4%</td><td>29.3%</td><td>0.0%</td></tr>
        <tr><td>π0</td><td>48.3%</td><td>8.6%</td><td>10.8%</td><td>0.0%</td></tr>
        <tr><td>π0-FAST</td><td>47.5%</td><td>2.7%</td><td>3.1%</td><td>2.3%</td></tr>
        <tr><td>SmolVLA</td><td>38.0%</td><td>6.4%</td><td>7.6%</td><td>0.0%</td></tr>
        <tr><td><strong>π0.5-Ours (45)</strong></td><td>89.5%</td><td><strong>22.8%</strong></td><td>28.4%</td><td><strong>6.2%</strong></td></tr>
        <tr><td><strong>π0.5-Ours (56)</strong></td><td>85.5%</td><td>20.4%</td><td>27.5%</td><td>5.0%</td></tr>
      </tbody>
    </table>
  </div>
  <div style="overflow-x: auto; font-size: 0.8em;">
    <strong>Progressive Validation</strong>
    <table>
      <thead><tr><th>Config</th><th>Eval</th><th>Baseline</th><th>Ours</th></tr></thead>
      <tbody>
        <tr><td>Single-task (1 ext)</td><td>1 task</td><td>3.75%</td><td><strong>90.0%</strong></td></tr>
        <tr><td>6-task (1+5 ext)</td><td>5 ext</td><td>0.0%</td><td><strong>28.0%</strong></td></tr>
        <tr><td>45-task (40+5 ext)</td><td>5 ext</td><td>0.0%</td><td>4.0%</td></tr>
        <tr><td>16-task (16 ext)</td><td>16 ext</td><td>26.2%</td><td>6.2%</td></tr>
        <tr><td>56-task (40+16 ext)</td><td>16 ext</td><td>26.2%</td><td>27.5%</td></tr>
      </tbody>
    </table>
    <small>Single-task memorization achieves 90%, but multi-task scaling reveals fundamental capacity limits.</small>
  </div>
</div>

**6. Long-Term Value**

As semantic diversity of tasks increases, model learning capacity proves severely insufficient — even trained tasks perform poorly. This reveals a fundamental challenge that is architecture-agnostic: all tested models (π0.5, π0, π0-FAST, SmolVLA) exhibit the same language gap. LangGap provides a systematic diagnostic tool that remains valuable as new VLA architectures emerge, precisely because the language gap is a persistent problem that current training paradigms have yet to solve.
