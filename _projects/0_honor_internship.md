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
pagenav: h2,h3
---

Working on Honor's self-developed **humanoid robot**: teleoperation data collection, replay, training, and on-robot deployment, along with **real-robot RL** algorithm research for **Vision-Language-Action (VLA)** models on custom manipulation tasks.

<nav class="contrib">
  <p>What I did · click a card to jump</p>
  <ol>
    <li><a href="#loop"><strong>End-to-end VLA pipeline</strong><span>Collect → train → deploy, lab built from scratch</span></a></li>
    <li><a href="#data-design"><strong>Offline data design</strong><span>4 categories: track + recover</span></a></li>
    <li><a href="#infra"><strong>Human-takeover training infra</strong><span>Takeover · Actor–Learner–Robot loop · new task ≈ 0% → 50%+</span></a></li>
    <li><a href="#algorithms"><strong>Real-robot RL algorithms</strong><span>RECAP · RAPID · loco-manipulation</span></a></li>
    <li><a href="#rove"><strong>Reproducing ROVE</strong><span>Autonomous success 40% → 52%</span></a></li>
    <li><a href="#debugging"><strong>Real-robot debugging</strong><span>6 bugs, each found by a probe</span></a></li>
  </ol>
</nav>

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

## 1. End-to-end VLA pipeline {#loop}

The Shanghai lab was set up from scratch after I joined: robot configuration, two teleoperation rigs (Pico VR and motion capture), training for the data-collection operators, and the training pipeline. The task is pick-and-place (bottle → basket) with a single fixed instruction.

{% include svg_figure.liquid name="honor_pipeline" caption="End-to-end real-robot pipeline. GR00T N1.7 (3B) is post-trained with the vision-language backbone frozen; the 37-D action is selected from a 115-D robot state. There is no validation set, so checkpoints are saved every 2K steps and selected by on-robot rollouts; the loss plateaus after about 15K steps." %}

{% include svg_figure.liquid name="honor_chunk" caption="Action-chunk hand-over at inference. The next chunk is requested while 15 steps remain; actions that went stale during inference are dropped and the overlap is linearly cross-faded, so the robot does not stutter between chunks." %}

**On the robot**, the place phase almost never fails — the policy keeps up even when the basket is dragged fast. Pick failures correlate with object position; this traced back to the data (fixed stance, no local motion during collection, so the model never builds a sense of distance), not to arm accuracy. Outcome: the lab gained an in-house "collect → fine-tune → validate on robot" iteration loop instead of relying on externally delivered models.

## 2. Offline data design {#data-design}

**Why the four data categories.** Categories ①–③ (standard, pick-phase perturbation, place-phase perturbation) teach the policy to _track_ a moving object or container. Category ④ teaches it to _recover_: starting from the hovering pose right after a missed grasp, the demonstration lowers the hand, re-grasps and places. Without it, the policy often doesn't realize the grasp failed — it lifts an empty hand, moves to the basket and "places" nothing. The four categories are roughly balanced; the robustness in the demo above comes from this data design, not from hyper-parameter tuning.

## 3. Human-takeover real-robot training infrastructure {#infra}

### 3.1 Human takeover & intervention-driven data pipeline {#takeover}

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

### 3.2 Distributed real-robot learning loop {#online-loop}

**Reproduced the Hi-ORS rejection-sampling loop and ported it from π0 + a Dobot arm to GR00T N1.7 + a humanoid.** Three machines run simultaneously.

{% include svg_figure.liquid name="honor_arch" caption="Actor–Learner–Robot architecture. The Actor runs the policy against the robot, only successful episodes reach the Learner, and the Learner pushes the trainable weights back to the Actor every 1,000 steps." %}

{% include svg_figure.liquid name="honor_gates" caption="Gates before an episode enters training. The success classifier is a ResNet18 on a single left-camera frame with a one-logit head, trained with BCE + pos_weight on 572 episodes (episode-level split, online augmentation, labels derived automatically from gripper signals; frame-level F1 0.976). It latches only after 20 consecutive frames above 0.8 — this hysteresis was added after the first real-robot session, where the classifier declared success within 1–2 s and false positives filled the buffer. Base-demonstration anchors in every batch guard against forgetting." %}

### 3.3 Real-robot SFT results: a new task from ≈ 0% to 50%+ in ~140 episodes {#results}

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

## 4. Real-robot RL algorithms {#algorithms}

### 4.1 RECAP-style advantage-conditioned training {#recap}

Rejection sampling is a binary degenerate case of advantage: keep every success, discard every failure. **Ported the advantage labeling of π0.6 RECAP (as in RLinf) to GR00T N1.7** so that _all_ data is used, with "good vs. bad" as an input condition rather than a filter — failure episodes become negative samples instead of waste.

{% include svg_figure.liquid name="honor_recap" caption="RECAP-style pipeline. The failure penalty c_fail = 1000 exceeds the gap between the longest success (1,000 frames) and the shortest failure (57 frames), so every failure ranks below every success. n = 20 steps matches the paper's 1 s horizon at 20 Hz. Negatives only shape the unconditional CFG branch." %}

{% include svg_figure.liquid name="honor_value_net" caption="Value network. The GR00T backbone stays frozen and receives no gradient; image and text tokens are mean-pooled separately because image tokens far outnumber text tokens and a single mean would dilute the language conditioning. RLinf appends a learnable CLS token and uses a single linear head; the GR00T backbone accepts no extra input embeddings, so we pool instead and add one hidden layer. The atom distribution sketch is illustrative." %}

Until V is ready, rule-based labels serve as a fallback: all success frames positive, autonomous frames of failures negative, and the 20 frames before every takeover overwritten as negative. The value network is trained separately and accepted only if Spearman ρ on held-out episodes (every 10th episode) exceeds 0.55: the dry run reached ρ = 0.647 (plateau 0.59) with loss 4.52 → 0.76, while a shuffled-label control stayed at an absolute ρ ≤ 0.26 and failed the criterion — so the criterion is meaningful. Agreement between V-based and rule-based labels was only 0.31, so the value network remains the bottleneck, and the real-robot A/B comparison was not completed.

### 4.2 RAPID: noise-space fast adaptation {#rapid}

**RAPID** (_Rapid Adaptation from Physical Interventions via Diffusion-noise_), in the spirit of DSRL: training a new checkpoint takes time, and until it lands the robot still can't do the task. RAPID leaves the VLA weights frozen and only replaces the initial noise of flow matching, so a correction the human just made can be reused the next time a similar state appears. It was wired into on-robot inference in late August.

{% include svg_figure.liquid name="honor_rapid" caption="RAPID. Offline, human corrections are inverted through the frozen policy into the initial noise that reproduces them (64 fine steps; 4-step Euler is too coarse) and stored in a memory keyed by observation. At deployment, retrieved noise is spherically interpolated with Gaussian noise before normal flow-matching sampling." %}

{% include svg_figure.liquid name="honor_dsbc_net" caption="DSBC noise network. A small MLP maps the retrieval key directly to the initial noise, replacing nearest-neighbour lookup; the VLA itself stays frozen. H is the 40-step action horizon of the GR00T action head (30 steps are executed per inference); D is its action dimension." %}

{% include svg_figure.liquid name="honor_rapid_chart" caption="Offline validation on 24 takeover episodes of a counter task. DSBC leads at every K (54.9–57.0); memory retrieval reaches only 20 at K = 1–2 and 45–49 at K ≥ 4; partial noising stays flat at 37; memory_delta is below 8. The metric is DTW gain, not real-robot success rate." %}

The audit was **pre-registered**: audit PASS; reversal CONDITIONAL (reconstruction error 0.232, within 0.10–0.30); spread downgraded to fragile after a re-run; transfer PASS (p ≈ 1e-21). Under these criteria the claim "retrieval wins at K < 10" was **dropped** — the experimental design rejected my own hypothesis — and the system converged on DSBC as the main path with memory retrieval as an optional front end. Next steps were distilling DSBC into the policy, soft-retiring memory entries, and connecting it to real-robot RL.

### 4.3 Extending to loco-manipulation {#loco}

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

## 5. Reproducing ROVE {#rove}

**Task.** The humanoid stands in place — feet fixed, no walking — and picks up a phone with its hand: fine-grained manipulation where a small misalignment quickly ends in a human takeover.

ROVE (XPENG, arXiv:2606.17011) keeps RECAP's advantage-conditioning skeleton (§4.1) and changes how human takeovers are scored. I reproduced it on top of the RECAP pipeline behind a single algorithm switch — the default RECAP path stays bit-identical, enforced by self-tests — and ran the paper's Algorithm 1 as an offline loop: deploy and collect → stage-aware returns → value refresh → advantages and labels → conditional SFT. Only the first step needs the robot; the other four run as one command.

### 5.1 Stage-aware return {#rove-return}

Under RECAP, an episode that a human rescued still counts as a success: its return rises by one every step up to 0, so the autonomous actions that _caused_ the takeover look like steady progress. The only remedy is a fixed rule that labels the 20 frames before a takeover negative. ROVE splits such an episode into three segments — autonomous execution, adaptation (the human is still pulling the robot back on track) and recovery — and books a failure penalty C_fail at t_r, the end of adaptation. The autonomous segment that led to the takeover now scores at failure level, while recovery keeps its normal time-to-go return.

{% include svg_figure.liquid name="honor_rove_return" caption="Stage-aware return (Eq. 2 of the paper): −1 per step, C_fail at t_r, idle frames (operator switching modes) removed. t_r falls back to takeover + 40 frames (2 s) when not annotated; the paper's ablation loses 30 pp when t_r is placed at the takeover onset, so the default errs late. C_fail must exceed the longest span in the positive pool, or a failed episode would out-score a recovery: the measured lower bound on this data is 919, so C_fail = 1000 (the paper's 500 is too small here). Returns matched hand computation bit for bit on 38 archived episodes." %}

### 5.2 Optimistic value estimation (OVE) {#rove-ove}

Plain Monte-Carlo regression learns the _average_ return. In states that often end in a takeover the average is already low, so the action that caused the takeover scores an advantage near zero and is never labelled negative. OVE fine-tunes the same scalar value head, after MC pre-training, with a 16-step TD target (from an EMA copy of the network) and an expectile loss with τ = 0.7, which penalizes under-estimates more than over-estimates. V then estimates what a state is worth _when things go well_: pre-takeover states are valued high, their actual return is low, and the negative advantage lands on the actions that caused the takeover. The advantage horizon is also 16 steps — one action chunk, the unit the label is attached to — and the top 40% of frames are labelled positive.

Each value checkpoint is gated by Spearman ρ on held-out episodes: the rank agreement between predicted V and the actual return (1 = same order). The MC stage must reach ρ ≥ 0.55 on the full pool; the OVE stage is judged on success episodes only (ρ ≥ 0.70), because OVE departs from the mean return on failure-bound states by design, so a lower full-pool ρ is expected rather than a regression.

{% include svg_figure.liquid name="honor_rove_rho" caption="Held-out Spearman ρ in three value-training runs (shaded: OVE phase). Clean rollouts: success-set ρ stays at 0.744–0.806 after the switch to OVE, while full-pool ρ drifts from 0.735 to 0.69 as intended; the 0.70 gate was set from this run. Demos + rollouts: success-set ρ slides from 0.731 to 0.628 — 85% of the held-out set is clean demonstrations, and optimistic bootstrapping pushes them all toward the top, compressing the ranking. iter0 pool, warm-started straight into OVE: full-pool ρ 0.68–0.71, success-set ρ 0.63–0.67, below the gate. The three pools have different held-out sets, so ρ is not comparable across panels." %}

<figure class="fig">
  <img src="{{ '/assets/img/honor_rove_value_curve.jpg' | relative_url }}" alt="Value curves on a held-out takeover episode: true return, MC value and OVE value, with frames of negative advantage marked" loading="lazy" width="1400" height="653">
  <figcaption>Reproduction of the paper's Fig. 6 on a held-out episode with a takeover (x: frame, idle frames removed; y: normalized value). Before t_r the OVE value (blue) sits above the MC value (orange) — optimistic in distribution — then jumps at t_r and follows the true return through recovery. Red dots mark frames with negative OVE advantage: they concentrate before the takeover and in the adaptation segment.</figcaption>
</figure>

### 5.3 Results {#rove-results}

Autonomous success on the robot rose from 40% (base checkpoint, n = 77) to **52%** (ROVE iter0, n = 192); human-assisted successes fell from 45% to 20% of episodes, while failures rose from 14% to 28%.

{% include svg_figure.liquid name="honor_rove_robot" caption="Outcome of every logged real-robot episode per checkpoint, as judged by the operator. Base 64000: late Aug – early Sep; base 80000: early – mid Sep; ROVE iter0: Sep 17–23." %}

iter0 was trained with one pass of the offline loop: a 2,068-episode value pool (534K frames of demonstrations and real-robot rollouts, 207 episodes held out), labels at exactly 40.0% positive, and conditional SFT from the 80K-step base checkpoint for 8,000 steps (lr 1e-4) on one H20 GPU in 18 h 17 min.

{% include svg_figure.liquid name="honor_rove_sft" caption="iter0 conditional SFT loss. The 200-step mean falls from 0.54 to 0.047 by step 1,000 and to 0.025 by step 8,000." %}

**On metrics, honestly:** the three groups come from different days, operators and prompt sets, so this is an observation, not an A/B test — the interleaved evaluation against the base checkpoint and a RECAP arm is still pending. The iter0 collection also logged no takeover segments, so the next round lacks ROVE's core signal until that logging is fixed.

## 6. Real-robot debugging {#debugging}

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
