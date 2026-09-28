---
layout: page
title: "LangGap: VLA Language Understanding Benchmark"
description: Accepted at IROS 2026. Designed a systematic semantic perturbation evaluation framework revealing that state-of-the-art VLA models ignore language instructions despite high benchmark scores. Proposed multi-task same-scene training approach and constructed augmented dataset for fine-tuning.
preview_video: /assets/video/langgap_preview.mp4
img: assets/img/langgap_poster.jpg
importance: 1
category: master
org: nus
i18n_key: langgap
venue: IROS 2026
scholar_id: u-x6o8ySG0sC
scholar_cites: 7631014917581332933
arxiv: "2603.00592"
start: 2025-10
end: 2026-06
meta: First author
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2603.00592" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2603.00592
  </a>
  <a href="/assets/pdf/LangGap-IROS2026-poster.pdf" target="_blank" rel="noopener">
    <i class="fa-solid fa-image"></i> Poster (IROS 2026)
  </a>
</p>

<div class="contrib" markdown="1">
What I did (first author) — click to jump

1. [Benchmark design](#benchmark) — 99 tasks built on a [four-dimensional semantic perturbation](#diagnosis) of LIBERO, with [same-scene multi-task design principles](#design) so language is the only signal.
2. [Data collection](#data) — a scripted waypoint pipeline: 16 extended tasks × 150 demos ≈ 2,400 demonstrations, fully automatic.
3. [Model training](#training) — π0.5 LoRA fine-tuning; a single task goes from 0% to 90%.
4. [Result analysis](#results) — [diagnosis](#diagnosis) (93.8% original vs. 21.4% extended, 0% on Change Target), the full benchmark across four VLA models, and progressive multi-task validation.
</div>

## Demo

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="/assets/img/langgap_video_poster.jpg">
      <source src="/assets/video/langgap_video.mp4" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video autoplay loop muted playsinline preload="metadata" poster="/assets/img/langgap_poster.jpg">
      <source src="/assets/video/grid_8x4.mp4" type="video/mp4">
    </video>
  </div>
</div>

## Overview

Vision-Language-Action (VLA) models achieve over 95% success on standard benchmarks. However, through systematic experiments, we find that current state-of-the-art VLA models largely ignore language instructions. Prior work lacks: (1) systematic semantic perturbation diagnostics, (2) a benchmark that forces language understanding by design, and (3) linguistically diverse training data. This paper constructs the LangGap benchmark, based on a four-dimensional semantic perturbation method -- varying instruction semantics while keeping the tabletop layout fixed -- revealing language understanding deficits in π0.5. Existing benchmarks like LIBERO assign only one task per layout, underutilizing available objects and target locations; LangGap fully diversifies pick-and-place tasks under identical layouts, forcing models to truly understand language. Experiments show that targeted data augmentation can partially close the language gap -- success rate improves from 0% to 90% with single-task training, and 0% to 28% with multi-task training. However, as semantic diversity of extended tasks increases, model learning capacity proves severely insufficient; even trained tasks perform poorly. This reveals a fundamental challenge for VLA models in understanding diverse language instructions -- precisely the long-term value of LangGap.

## Details

**1. Benchmark & Dataset**
{: #benchmark}

LangGap benchmark: **99 tasks** total — 40 original LIBERO tasks + 59 extended semantic perturbation tasks. We provide a training dataset of 56 tasks: 16 self-collected extended tasks (150 demos each) + 40 original tasks (50 demos each), totaling ~4,100 trajectories.

**2. Problem Discovery**
{: #diagnosis}

When changing the instruction from "put bowl on plate" → "put bowl on stove" in the same visual scene, the model still executes the original action (goes to plate), achieving **0% success**. This reveals that VLAs perform vision-to-action pattern matching rather than genuine language understanding.

We design a four-dimensional semantic perturbation diagnostic — Change Object, Change Target, Spatial Description, and Drawer Action — keeping the visual scene identical and only modifying the instruction:

{% include svg_figure.liquid name="langgap_diagnosis" caption="π0.5 diagnosis over 99 tasks and 1,980 episodes. Our re-run of the 40 original tasks matches the official score; the 59 extended tasks drop by 72.4 points. On Change Target π0.5 fails all 260 episodes and no tested model exceeds 2.3%, so the failure is not a phrasing artifact — and the aggregate score hides it." %}

<div class="media-row">
  <div>
    <img src="/assets/img/libero_suites_strip.png" alt="LIBERO evaluation suites with perturbation annotations">
  </div>
</div>

**3. Design Principles**
{: #design}

1. **Same-Scene Multi-Task** — Multiple tasks share identical initial visual states, eliminating visual shortcuts. A model ignoring language achieves at most 1/k success rate (k = tasks per scene).
2. **Instruction-Level Train/Eval Split** — Training tasks do not include all test tasks; held-out evaluation contains unseen language instructions to test compositional generalization.
3. **Physical Feasibility Validation** — All extended tasks verified in the LIBERO simulator to ensure graspability, reachability, and detectability.

**4. Data Collection Pipeline**
{: #data}

- **Scalable & Diverse Generation:** We employ a scripted, waypoint-based collection pipeline to efficiently and stably gather 150 successful episodes per task. While the waypoints are hard-coded for each specific task, the simulator introduces slight natural variations in the initial tabletop layouts. This ensures the collected trajectories are visually and dynamically diverse, preventing models from merely memorizing rigid, identical paths.
- **Hierarchical Control Architecture:** Each task utilizes a custom script that decomposes the pick-and-place process into multiple sequential waypoints. At the high level, we apply pure Proportional (P) control to calculate positional errors and output continuous action commands. These commands are then executed by the simulator's low-level OSC (Operational Space Control) PD controller, achieving seamless, highly precise continuous control.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_waypoints.jpg" alt="Waypoint sequence of a scripted demonstration: home, grasp, transport, place" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Waypoint timing of a scripted demonstration (illustrative): home → above object → grasp → lift → above target → place. OSC_POSE controller with per-step pose error normalized to [−1, 1]; an episode is kept only if it succeeds within the step budget.</p>

- **Why scripts instead of teleoperation:** early attempts with mouse teleoperation were jittery, slow and inconsistent. Scripts written from the object coordinates in each task's BDDL file were hand-tuned in simulation until every task was graspable, reachable and detectable — the resulting actions are clean and the collection is fully automatic: ~150 demos per task (the official LIBERO tasks have 50), 16 tasks ≈ 2,400 demos.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_rollout_2x8.jpg" alt="Sample of scripted demonstration rollouts" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">A sample of the 2,400 scripted demonstrations.</p>

**Fine-tuning: single task from 0% to 90%**
{: #training}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="/assets/img/langgap_before_after_poster.jpg">
    <source src="/assets/video/langgap_before_after.mp4" type="video/mp4">
  </video>
</div>
<p class="caption">Left: before training — the instruction says "stove", but the policy still places the bowl on the plate. Right: after fine-tuning on the extended data — the bowl goes onto the stove.</p>

- π0.5 with LoRA (r = 64) on a single RTX 4090.
- Checkpoints are selected by rollouts, not by loss: the loss keeps decreasing while success rate is non-monotonic.
- Training and test instructions are verbatim identical except for the 43 held-out tasks, whose instructions are new.

**5. Results**
{: #results}

{% include svg_figure.liquid name="langgap_benchmark" caption="Full benchmark: recent VLA models on all four LIBERO suites, original versus extended tasks. Every model shows a large language gap; our 45-task fine-tuned π0.5 improves the extended total (22.8) and Change Target (0 → 6.2) while keeping 89.5 on the original tasks. The 43 held-out tasks were never trained on." %}

{% include svg_figure.liquid name="langgap_progressive" caption="Progressive validation with the same extended data as the number of training tasks grows from 1 to 56. Single-task memorization reaches 90%, but gains collapse as semantically different tasks are learned together; mixing in the 40 official tasks (56 tasks) restores 27.5% while the language gap remains." %}

**6. Long-Term Value**

As semantic diversity of tasks increases, model learning capacity proves severely insufficient — even trained tasks perform poorly. This reveals a fundamental challenge that is architecture-agnostic: all tested models (π0.5, π0, π0-FAST, SmolVLA) exhibit the same language gap. LangGap provides a systematic diagnostic tool that remains valuable as new VLA architectures emerge, precisely because the language gap is a persistent problem that current training paradigms have yet to solve.
