---
layout: page
title: "Honor Humanoid: Real-Robot RL for VLA"
description: VLA Algorithm Engineer Intern at Honor. Built a human-in-the-loop real-robot SFT / RL pipeline for Honor's self-developed humanoid robot — smooth teleoperator takeover, an intervention-driven data pipeline, and a distributed Actor–Learner–Robot learning loop.
img: assets/img/honor_poster.jpg
preview_video: /assets/video/honor_preview.mp4
importance: 0
category: master
org: honor
i18n_key: honor
xp_company: "Honor Device Co., Ltd."
meta: Honor Device Co., Ltd. · Summer internship
related_publications: false
---

Working on Honor's self-developed **humanoid robot**: teleoperation data collection, replay, training, and on-robot deployment, along with **real-robot RL** algorithm research for **Vision-Language-Action (VLA)** models on custom manipulation tasks.

<div class="contrib" markdown="1">
What I did — click to jump

1. [End-to-end VLA pipeline](#loop) — data collection, processing, training, inference and real-robot deployment, built from scratch in the Shanghai lab.
2. [Offline data design](#data-design) — four balanced demonstration categories that teach tracking and failure recovery.
3. [Human takeover](#takeover) — smooth autonomy ↔ teleoperation switching with takeover-state detection, the foundation for Online SFT and real-robot RL.
4. [Actor–Learner–Robot loop](#online-loop) — online rejection sampling (Hi-ORS) on three machines; [a new task from ≈ 0% to 50%+](#results).
5. [RL algorithms](#recap) — RECAP-style advantage conditioning and [RAPID noise-space adaptation](#rapid), extended to [loco-manipulation](#loco), plus [real-robot debugging](#debugging).
</div>

## Demos

### On-robot inference under perturbations

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/inference_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/inference_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Autonomous pick-and-place rollouts on the real robot while the object (left) and the target basket (right) are perturbed mid-episode — the policy re-tracks and completes the task. The hand never stops moving, and the policy never waits for the object to settle: what it learned is visual tracking and disturbance rejection, not a single pick-and-place trajectory.

### Data design for robustness

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/data_design_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/data_design.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Four categories of teleoperated demonstrations: standard demonstrations, perturbations during the pick phase, perturbations during the place phase, and recovery from failed-grasp states — designed so the policy learns to recover, not just to repeat.

### Real-robot SFT: before vs. after

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

A task the offline-trained policy could not perform is learned on the robot through the real-robot learning loop — human takeover data flows back into training, and the takeover ratio drops as new checkpoints are dispatched.

## 1. Real-robot loop & data design {#loop}

The Shanghai lab was set up from scratch after I joined: robot configuration, two teleoperation rigs (Pico VR and motion capture), training for the data-collection operators, and the training pipeline. The task is pick-and-place (bottle → basket) with a single fixed instruction.

{% include svg_figure.liquid name="honor_pipeline" caption="End-to-end real-robot pipeline. GR00T N1.7 (3B) is post-trained with the vision-language backbone frozen; the 37-D action is selected from a 115-D robot state. There is no validation set, so checkpoints are saved every 2K steps and selected by on-robot rollouts; the loss plateaus after about 15K steps." %}

{% include svg_figure.liquid name="honor_chunk" caption="Action-chunk hand-over at inference. The next chunk is requested while 15 steps remain; actions that went stale during inference are dropped and the overlap is linearly cross-faded, so the robot does not stutter between chunks." %}

**On the robot**, the place phase almost never fails — the policy keeps up even when the basket is dragged fast. Pick failures correlate with object position; this traced back to the data (fixed stance, no local motion during collection, so the model never builds a sense of distance), not to arm accuracy. Outcome: the lab gained an in-house "collect → fine-tune → validate on robot" iteration loop instead of relying on externally delivered models.

**Why the four data categories.** Categories ①–③ (standard, pick-phase perturbation, place-phase perturbation) teach the policy to _track_ a moving object or container. Category ④ teaches it to _recover_: starting from the hovering pose right after a missed grasp, the demonstration lowers the hand, re-grasps and places. Without it, the policy often doesn't realize the grasp failed — it lifts an empty hand, moves to the basket and "places" nothing. The four categories are roughly balanced; the robustness in the demo above comes from this data design, not from hyper-parameter tuning.
{: #data-design}

## 2. Human takeover & intervention-driven data pipeline {#takeover}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/takeover_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/takeover_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">A teleoperator takes over mid-episode and hands control back (3× speed, no audio).</p>

**Smooth human takeover.** Learning on the real robot requires that a human can take over at any moment without the robot jumping. On takeover, the VLA command topic is re-routed to the teleoperation topic, and the controller outputs an _increment_ on top of the last VLA action rather than the teleoperator's absolute joint angles.

{% include svg_figure.liquid name="honor_fsm" caption="Switching state machine and the takeover output rule. Takeovers are also written into the data, so every episode knows which frames came from the human." %}

**Intervention-driven data pipeline.** Every episode is persisted, and the operator can only veto the success classifier downward, never promote a failure to a success; classifier decisions and false-positive/negative statistics are logged alongside. The buffer is a bounded numpy ring with success/failure buckets, soft-delete FIFO and weighted sampling (PER importance correction), and an HTTP review endpoint lets each episode be inspected before it reaches training. In another round, 127 of 138 collected episodes entered the buffer as successes (11 fully autonomous, 116 with takeover demonstrations).

{% include svg_figure.liquid name="honor_datapipe" caption="From robot to learner: every episode, including failures, is recorded, judged and uploaded; the learner buckets episodes by outcome. Bottom: composition of one round of real-robot data (142–416 frames per episode)." %}

## 3. Distributed real-robot learning loop {#online-loop}

**Reproduced the Hi-ORS rejection-sampling loop and ported it from π0 + a Dobot arm to GR00T N1.7 + a humanoid.** Three machines run simultaneously.

{% include svg_figure.liquid name="honor_arch" caption="Actor–Learner–Robot architecture. The Actor runs the policy against the robot, only successful episodes reach the Learner, and the Learner pushes the trainable weights back to the Actor every 1,000 steps." %}

{% include svg_figure.liquid name="honor_gates" caption="Gates before an episode enters training. The success classifier is a ResNet18 on a single left-camera frame with a one-logit head, trained with BCE + pos_weight on 572 episodes (episode-level split, online augmentation, labels derived automatically from gripper signals; frame-level F1 0.976). It latches only after 20 consecutive frames above 0.8 — this hysteresis was added after the first real-robot session, where the classifier declared success within 1–2 s and false positives filled the buffer. Base-demonstration anchors in every batch guard against forgetting." %}

## 4. Real-robot SFT results: a new task from ≈ 0% to 50%+ in ~140 episodes {#results}

When the policy stalls, the operator takes over via Pico; takeover data flows straight into the Learner, and the takeover ratio serves as a live metric. **Scene 1** moves the bottle to the right, where the offline data is sparse. **Scene 2** swaps the whole layout left–right (basket left, bottle right) — the exact opposite of all offline data — so the offline SFT baseline is ≈ 0%.

{% include svg_figure.liquid name="honor_curve" caption="Share of teleoperated steps per episode during real-robot SFT, with the checkpoints dispatched to the Actor. Each checkpoint update is followed by a drop in takeover; the rise around episode 86 is the switch to scene 2. Over the test phase (checkpoints 5000–7000) the takeover ratio falls to 18.8%." %}

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Scene</th><th>Change vs. offline data</th><th>Episodes</th><th>Offline SFT</th><th>After real-robot SFT</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Bottle on the right (sparse in offline data)</td><td>20</td><td>not measured</td><td><strong>55.0%</strong></td></tr>
    <tr><td>2</td><td>Basket left, bottle right (layout mirrored)</td><td>12</td><td>≈ 0%</td><td><strong>50.0%</strong></td></tr>
  </tbody>
</table>
</div>

Fully autonomous success rate. Why a frozen backbone can still learn the mirrored layout: the failure mode was _not moving at all_ rather than moving the wrong way — visual understanding was intact, only the action mapping was missing.

## 5. RECAP-style advantage-conditioned training {#recap}

Rejection sampling is a binary degenerate case of advantage: keep every success, discard every failure. **Ported the advantage labeling of π0.6 RECAP (as in RLinf) to GR00T N1.7** so that _all_ data is used, with "good vs. bad" as an input condition rather than a filter — failure episodes become negative samples instead of waste.

{% include svg_figure.liquid name="honor_recap" caption="RECAP-style pipeline. The failure penalty c_fail = 1000 exceeds the gap between the longest success (1,000 frames) and the shortest failure (57 frames), so every failure ranks below every success. n = 20 steps matches the paper's 1 s horizon at 20 Hz. Negatives only shape the unconditional CFG branch." %}

{% include svg_figure.liquid name="honor_value_net" caption="Value network. The GR00T backbone stays frozen and receives no gradient; image and text tokens are mean-pooled separately because image tokens far outnumber text tokens and a single mean would dilute the language conditioning. RLinf appends a learnable CLS token and uses a single linear head; the GR00T backbone accepts no extra input embeddings, so we pool instead and add one hidden layer. The atom distribution sketch is illustrative." %}

Until V is ready, rule-based labels serve as a fallback: all success frames positive, autonomous frames of failures negative, and the 20 frames before every takeover overwritten as negative. The value network is trained separately and accepted only if Spearman ρ on held-out episodes (every 10th episode) exceeds 0.55: the dry run reached ρ = 0.647 (plateau 0.59) with loss 4.52 → 0.76, while a shuffled-label control stayed at an absolute ρ ≤ 0.26 and failed the criterion — so the criterion is meaningful. Agreement between V-based and rule-based labels was only 0.31, so the value network remains the bottleneck, and the real-robot A/B comparison was not completed.

## 6. RAPID: noise-space fast adaptation {#rapid}

**RAPID** (_Rapid Adaptation from Physical Interventions via Diffusion-noise_), in the spirit of DSRL: training a new checkpoint takes time, and until it lands the robot still can't do the task. RAPID leaves the VLA weights frozen and only replaces the initial noise of flow matching, so a correction the human just made can be reused the next time a similar state appears. It was wired into on-robot inference in late August.

{% include svg_figure.liquid name="honor_rapid" caption="RAPID. Offline, human corrections are inverted through the frozen policy into the initial noise that reproduces them (64 fine steps; 4-step Euler is too coarse) and stored in a memory keyed by observation. At deployment, retrieved noise is spherically interpolated with Gaussian noise before normal flow-matching sampling." %}

{% include svg_figure.liquid name="honor_dsbc_net" caption="DSBC noise network. A small MLP maps the retrieval key directly to the initial noise, replacing nearest-neighbour lookup; the VLA itself stays frozen. H is the 40-step action horizon of the GR00T action head (30 steps are executed per inference); D is its action dimension." %}

{% include svg_figure.liquid name="honor_rapid_chart" caption="Offline validation on 24 takeover episodes of a counter task. DSBC leads at every K (54.9–57.0); memory retrieval reaches only 20 at K = 1–2 and 45–49 at K ≥ 4; partial noising stays flat at 37; memory_delta is below 8. The metric is DTW gain, not real-robot success rate." %}

The audit was **pre-registered**: audit PASS; reversal CONDITIONAL (reconstruction error 0.232, within 0.10–0.30); spread downgraded to fragile after a re-run; transfer PASS (p ≈ 1e-21). Under these criteria the claim "retrieval wins at K < 10" was **dropped** — the experimental design rejected my own hypothesis — and the system converged on DSBC as the main path with memory retrieval as an optional front end. Next steps were distilling DSBC into the policy, soft-retiring memory entries, and connecting it to real-robot RL.

## 7. Extending to loco-manipulation {#loco}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/locomanip_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/locomanip_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">The humanoid autonomously walks to a counter and grasps a bottle — 7 real-robot clips, 5× speed, no audio; yellow floor marks are walking-path references.</p>

The whole stack — takeover, the real-robot learning loop, RECAP and RAPID — carried over from tabletop pick-and-place to a task with walking without being rewritten.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Loco-manipulation data</th><th>Value</th></tr></thead>
  <tbody>
    <tr><td>Walking episodes collected</td><td>507 episodes · 181K frames</td></tr>
    <tr><td>Kept after 6 screening criteria</td><td>326 episodes</td></tr>
    <tr><td>Merged training set</td><td><strong>848 episodes · 306K frames (+71%)</strong></td></tr>
    <tr><td>Median path length per episode</td><td>0.32 m → <strong>3.2 m</strong></td></tr>
  </tbody>
</table>
</div>

**On metrics, honestly:** the real-robot SFT stage has complete numbers (55% / 50%). After switching to the loco task, all components were implemented and wired in, but no metric-level improvement was achieved on it: the maturity of the whole-body hardware and locomotion stack at the time did not allow systematic real-robot evaluation.

## 8. Real-robot debugging {#debugging}

None of these could be found by reviewing code offline — they only surfaced during long real-robot runs, and each was located with a probe or a quantitative metric.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Symptom</th><th>Probe / evidence</th><th>Root cause → fix</th></tr></thead>
  <tbody>
    <tr><td>Generalization drifting after fine-tuning</td><td>Held-out loss 0.0048 → 0.0222 at step 2000 (×4.6); action-direction cosine 0.995 → 0.979 → 0.961</td><td>Base-data mixer read mp4 as BGR while the frozen vision tower expects RGB — half the gradient budget learned noise; fixed one default. Anchors covered only 29 episodes (5.6%) → enlarge the base buffer</td></tr>
    <tr><td>Buffer filled with false successes</td><td>Episodes latched “success” after 24 and 29 steps; learner trained on them for 1,000+ steps</td><td>Latch and reset shared one 0.5 threshold, no hysteresis → latch at p &gt; 0.8 × 20 frames, reset at p ≤ 0.3 × 3 frames. A later un-reset object produced 2,536 junk steps over 11 episodes — just past the 2,500-step training threshold: audit frame by frame from the first session</td></tr>
    <tr><td>Behavior differs between training, deployment and RL</td><td>Field-by-field comparison of observations across the three pipelines</td><td>Gripper DDS type, an upside-down camera, hand-position initialization, head-position indexing → 9-item fix list</td></tr>
    <tr><td>Robot turns at episode start</td><td>Median yaw drift 31°</td><td>Stale yaw anchor + full re-anchoring every chunk → 3°/chunk rate limit with a 20° cap; 6 validation runs: anchoring error 0.0°, first-second turning ≤ 1.6°</td></tr>
    <tr><td>Stale camera frames</td><td>47% duplicate consecutive frames in 77 of 83 episodes; source 61 Hz, decode 54.9 Hz, effective ≈ 10.6 Hz under load</td><td>Added frame-freshness observability</td></tr>
    <tr><td>“The model doesn't move”</td><td>Trainer client blocked in retries</td><td>Mismatched actor / learner ports. Lesson: every “the model doesn't move” is first a communication or observation check, then a weights check</td></tr>
  </tbody>
</table>
</div>
