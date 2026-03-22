---
layout: page
title: VLA Language Understanding Benchmark
description: Designed a systematic semantic perturbation evaluation framework revealing that state-of-the-art VLA models ignore language instructions despite high benchmark scores. Proposed multi-task same-scene training approach and constructed augmented dataset for fine-tuning.
preview_video: /assets/video/grid_8x4.mp4
importance: 1
category: master
---

## Demo

<div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
  <div style="flex: 1; position: relative; padding-bottom: 28%; height: 0; overflow: hidden; border-radius: 0.25rem;">
    <video controls style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
      <source src="/assets/video/iros_final.mp4" type="video/mp4">
    </video>
  </div>
  <div style="flex: 1; position: relative; padding-bottom: 28%; height: 0; overflow: hidden; border-radius: 0.25rem;">
    <video autoplay loop muted playsinline style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
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
    <tr><td>&emsp;Change Object</td><td>38</td><td>760</td><td>29.3%</td></tr>
    <tr><td>&emsp;Change Target</td><td>13</td><td>260</td><td><strong>0.0%</strong></td></tr>
    <tr><td>&emsp;Spatial Description</td><td>5</td><td>100</td><td>11.0%</td></tr>
    <tr><td>&emsp;Drawer Action</td><td>3</td><td>60</td><td>31.7%</td></tr>
  </tbody>
</table>
</div>

<div style="margin: 1.5em 0;">
  <img src="/assets/img/perturbation_types_4x1.png" alt="Four-dimensional semantic perturbation taxonomy" style="max-width: 100%; border-radius: 0.25rem;">
</div>

**3. Design Principles**

1. **Same-Scene Multi-Task** — Multiple tasks share identical initial visual states, eliminating visual shortcuts. A model ignoring language achieves at most 1/k success rate (k = tasks per scene).
2. **Instruction-Level Train/Eval Split** — Training tasks do not include all test tasks; held-out evaluation contains unseen language instructions to test compositional generalization.
3. **Physical Feasibility Validation** — All extended tasks verified in the LIBERO simulator to ensure graspability, reachability, and detectability.

**4. Results**

<div style="display: flex; gap: 1rem; margin: 1em 0;">
  <div style="flex: 1; overflow-x: auto; font-size: 0.8em;">
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
  <div style="flex: 1; overflow-x: auto; font-size: 0.8em;">
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

**5. Long-Term Value**

As semantic diversity of tasks increases, model learning capacity proves severely insufficient — even trained tasks perform poorly. This reveals a fundamental challenge that is architecture-agnostic: all tested models (π0.5, π0, π0-FAST, SmolVLA) exhibit the same language gap. LangGap provides a systematic diagnostic tool that remains valuable as new VLA architectures emerge, precisely because the language gap is a persistent problem that current training paradigms have yet to solve.

## Resources

- [arXiv Paper](https://arxiv.org/abs/2603.00592)
