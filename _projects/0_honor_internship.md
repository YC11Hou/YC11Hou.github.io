---
layout: page
title: "Honor Humanoid: Online RL for VLA"
description: VLA Algorithm Engineer Intern at Honor. Built a human-in-the-loop online SFT / online RL pipeline for Honor's self-developed humanoid robot — smooth teleoperator takeover, an intervention-driven data pipeline, and a distributed Actor–Learner–Robot learning loop.
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

Working on Honor's self-developed **humanoid robot**: teleoperation data collection, replay, training, and on-robot deployment, along with **online RL** algorithm research for **Vision-Language-Action (VLA)** models on custom manipulation tasks.

The internship covered five threads, in the order below: (1) an end-to-end real-robot loop with a four-category data design; (2) smooth human takeover and an intervention-driven data pipeline; (3) a distributed Actor–Learner–Robot online learning loop, where online SFT lifted a new task from ≈ 0% to 50%+; (4) algorithm work — RECAP-style advantage-conditioned training and RAPID noise-space fast adaptation; (5) extension to loco-manipulation, plus a set of bugs that only surfaced on the real robot.

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

### Online SFT: before vs. after

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

A task the offline-trained policy could not perform is learned on the robot through the online learning loop — human takeover data flows back into training, and the takeover ratio drops as new checkpoints are dispatched.

## 1. Real-robot loop & data design

**Teleoperated collection → LeRobot conversion → mixing & filtering → GR00T N1.7 post-training → offline evaluation → on-robot inference.** The Shanghai lab was set up from scratch after I joined: robot configuration, two teleoperation rigs (Pico VR and motion capture), training for the data-collection operators, and the training pipeline.

- **Task:** pick-and-place (bottle → basket) with a single fixed instruction; 1,067 episodes collected, 848 episodes / 306K frames kept for training.
- **Model:** GR00T N1.7 (3B); the vision-language backbone is frozen, only the projector and the diffusion action head are trained.
- **Action space:** 37-D (root quaternion 4 + joints 29 + head 2 + hands 2), selected from a 115-D state; 30-step chunks at 20 Hz, 4 diffusion steps ≈ 0.23 s.
- **Training:** 2 nodes × 8 GPUs, global batch 256, lr 1e-4, 20K steps ≈ 95 epochs; loss plateaus after ~15K steps. There is no validation set, so a checkpoint is saved every 2K steps and selected by on-robot rollouts.
- **Chunk blending:** the next chunk is requested when 15 steps remain in the buffer; up to 12 stale actions are dropped and the 13-step overlap is linearly blended, so there is no stutter between chunks.

**On the robot**, the place phase almost never fails — the policy keeps up even when the basket is dragged fast. Pick failures correlate with object position; this traced back to the data (fixed stance, no local motion during collection, so the model never builds a sense of distance), not to arm accuracy. Outcome: the lab gained an in-house "collect → fine-tune → validate on robot" iteration loop instead of relying on externally delivered models.

**Why the four data categories.** Categories ①–③ (standard, pick-phase perturbation, place-phase perturbation) teach the policy to _track_ a moving object or container. Category ④ teaches it to _recover_: starting from the hovering pose right after a missed grasp, the demonstration lowers the hand, re-grasps and places. Without it, the policy often doesn't realize the grasp failed — it lifts an empty hand, moves to the basket and "places" nothing. The four categories are roughly balanced; the robustness in the demo above comes from this data design, not from hyper-parameter tuning.

## 2. Human takeover & intervention-driven data pipeline

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/takeover_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/takeover_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">A teleoperator takes over mid-episode and hands control back (3× speed, no audio).</p>

**Smooth human takeover.** Online learning requires that a human can take over at any moment without the robot jumping. The switch is a ROS 2 node at 50 Hz with three states — _waiting_, _VLA autonomous_, _teleop takeover_ — driven by the locomotion action channel; on takeover, the VLA command topic is re-routed to the teleoperation topic.

- **The key to smoothness:** the controller does not replay the teleoperator's absolute joint angles at the moment of switching. It records the first frame after the switch as a reference and outputs _last VLA action + teleoperation delta_, so the robot continues from its current pose.
- **Takeovers are recorded in the data:** every frame logs its transition mode and control state; a topic gap longer than 0.3 s (15 frames at 50 Hz) is counted as an untracked step, and that episode no longer counts as fully autonomous.

**Intervention-driven data pipeline.** Every episode — failures included — is persisted locally as LeRobot v2.1 (parquet + mp4 + meta). At the end of each episode the operator can mark success / partial / failure, but may only _veto_ the success classifier downward, never promote a failure to a success; classifier decisions and false-positive/negative statistics are logged alongside. The actor uploads episodes to the learner automatically over ZMQ, and the learner buckets them by outcome: successes go to training, failures are kept for the reward model.

**What one round of online data looks like:** 83 episodes / 19,075 frames (142–416 frames each), of which 17,141 frames are teleoperated takeover and 1,934 autonomous — about 90% is a human correcting the policy, which is exactly where the model is weak. In another round, 127 of 138 collected episodes entered the buffer as successes (11 fully autonomous, 116 with takeover demonstrations). The buffer is a bounded numpy ring with success/failure buckets, soft-delete FIFO and weighted sampling (PER importance correction); an HTTP review endpoint lets each episode be inspected before it reaches training.

## 3. Distributed online learning loop

**Reproduced the Hi-ORS online rejection-sampling loop and ported it from π0 + a Dobot arm to GR00T N1.7 + a humanoid.** Three tiers run simultaneously:

<div style="overflow-x: auto; font-size: 0.85em; margin: 1em 0;">
<table>
  <thead><tr><th>Tier</th><th>Hardware</th><th>Role</th></tr></thead>
  <tbody>
    <tr><td><strong>Robot</strong> · execution</td><td>Humanoid + onboard AGX / NX</td><td>Topic publishing, command execution, data collection; proprioception over ROS 2, images over H.264 / TCP</td></tr>
    <tr><td><strong>Actor</strong> · inference</td><td>x86 workstation (RTX 4090)</td><td>GR00T N1.7 inference, streaming actions at 50 Hz (ROS 2 / CycloneDDS); the success classifier assigns reward and only successful episodes enter the training buffer</td></tr>
    <tr><td><strong>Learner</strong> · training</td><td>Development GPU server</td><td>Rejection-sampling SFT on successful data; broadcasts the trainable parameters back to the Actor every 1,000 steps (ZMQ pub-sub)</td></tr>
  </tbody>
</table>
</div>

**Gates an episode must pass before entering the buffer:**

- A **ResNet18 single-frame success classifier** (frame-level acc 0.987 / F1 0.976, trained on 572 episodes, labels derived automatically from gripper signals): success latches only when p > 0.8 for 20 consecutive frames. This hysteresis was added after the first real-robot session, where the classifier declared success within 1–2 s and false positives filled the buffer.
- Final reward → length gate → static-frame removal → buffer. Training uses batch 16, with 8 frames of base demonstrations mixed into every batch as an anchor against forgetting.
- Only the projector and action head are trained (backbone frozen), and weight sync transfers only the `requires_grad` parameters.

## 4. Online SFT results: a new task from ≈ 0% to 50%+ in ~140 episodes

When the policy stalls, the operator takes over via Pico; takeover data flows straight into the Learner, and the takeover ratio serves as a live metric. **Scene 1** moves the bottle to the right, where the offline data is sparse. **Scene 2** swaps the whole layout left–right (basket left, bottle right) — the exact opposite of all offline data — so the offline SFT baseline is ≈ 0%.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/honor_takeover_curve.jpg" alt="Human takeover ratio per episode during online SFT, with checkpoint updates" style="width: 100%; border-radius: 4px;">
</div>

- Fully autonomous success after online SFT: **55.0%** with the bottle on the right (20 episodes), **50.0%** with the basket on the left (12 episodes).
- The takeover ratio drops right after each checkpoint is dispatched; in scene 1 it briefly reaches 0, and over the test phase it falls to 18.8%.
- Why a frozen backbone can still learn the mirrored layout: the failure mode was _not moving at all_ rather than moving the wrong way — visual understanding was intact, only the action mapping was missing.

## 5. RECAP-style advantage-conditioned training

Rejection sampling is a binary degenerate case of advantage: keep every success, discard every failure. **Ported the advantage labeling of π0.6 RECAP (as in RLinf) to GR00T N1.7** so that _all_ data is used, with "good vs. bad" as an input condition rather than a filter — failure episodes become negative samples instead of waste.

**Labeling (1–4) and conditioning (5–8):**

1. **Episodes** — success / success-with-takeover / failure; per-frame control state marks human vs. policy. Replays, unreviewed and truncated successes are excluded.
2. **Reward** — −1 per step; last frame 0 on success, −c<sub>fail</sub> on failure with c<sub>fail</sub> = 1000 (longest success 1,000 frames, shortest failure 57 frames, so c<sub>fail</sub> > 943 guarantees every failure ranks below every success).
3. **Return** — backward recursion with γ = 1, normalized to [−1, 0].
4. **Value network V(o)** — a distributional critic on the frozen GR00T backbone: image and text tokens are masked-mean-pooled separately and concatenated, then a two-layer MLP outputs 201 atoms over [−1, 0]; V is the atom-weighted sum, trained with cross-entropy against the target projected onto its two neighboring atoms.
5. **Advantage** — N-step lookahead reward plus value difference, N = 20 (1 s at 20 Hz, matching the paper's N = 50 at 50 Hz); binarized with a quantile threshold over the whole buffer (positive fraction 0.3).
6. **Prompt injection + CFG** — `Advantage: positive / negative` appended to the task string, CFG dropout 0.3 (falling back to the bare task string); negatives only shape the unconditional branch.
7. **Policy training** — success : failure mixed at 1.0 : 1.5 over all data, with three unfreezing levels (heads only / top-4 LLM layers / full).
8. **Inference** — prompt pinned to _positive_, a single forward pass with no guidance mixing.

Until V is ready, rule-based labels serve as a fallback: all success frames positive, autonomous frames of failures negative, and the 20 frames before every takeover overwritten as negative. The value network is trained separately and accepted only if Spearman ρ on held-out episodes (every 10th episode) exceeds 0.55: the dry run reached ρ = 0.647 (plateau 0.59) with loss 4.52 → 0.76, while a shuffled-label control stayed at an absolute ρ ≤ 0.26 and failed the criterion — so the criterion is meaningful. Agreement between V-based and rule-based labels was only 0.31, so the value network remains the bottleneck, and the real-robot A/B comparison was not completed.

## 6. RAPID: noise-space fast adaptation

**RAPID** (_Rapid Adaptation from Physical Interventions via Diffusion-noise_), in the spirit of DSRL: training a new checkpoint takes time, and until it lands the robot still can't do the task. RAPID leaves the VLA weights frozen and only replaces the initial noise of flow matching, so a correction the human just made can be reused the next time a similar state appears.

- **Offline:** cut the human-correction segments out of successful takeover episodes with a sliding window of the execution stride (30); invert the real actions through the frozen policy (64 fine steps — 4-step Euler is too coarse) to obtain the initial noise ε\*; encode it with a temporal DCT keeping the first 8 coefficients, storing both the raw ε\* and its offset δ from default sampling. The memory key is the observation embedding, the value is the noise.
- **Online:** encode the current observation with the same backbone, retrieve cosine top-4 above 0.85, and filter hits whose actions disagree (DTW consistency). On a hit, spherically interpolate ε\* with Gaussian noise as the initial noise; on a miss, fall back to a random seed; then sample from the frozen VLA as usual. An empty memory costs nothing. RAPID was wired into online inference in late August.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/honor_rapid_dtw.jpg" alt="DTW gain versus retrieval size K for five initial-noise strategies" style="width: 100%; border-radius: 4px;">
</div>

<div style="overflow-x: auto; font-size: 0.85em; margin: 1em 0;">
<table>
  <thead><tr><th>Strategy</th><th>Where the initial noise comes from</th></tr></thead>
  <tbody>
    <tr><td>memory_raw</td><td>Retrieved ε* blended with random noise</td></tr>
    <tr><td>memory_dct (default)</td><td>ε* reconstructed from its first 8 DCT coefficients, then blended</td></tr>
    <tr><td>memory_delta</td><td>Random sample + β·α·δ (ablation arm)</td></tr>
    <tr><td>partial_noising</td><td>RtS-style baseline: stored action chunks, partially re-noised</td></tr>
    <tr><td>DSBC</td><td>A small noise network π(ε | key), behavior-cloned on (key, ε*) pairs</td></tr>
  </tbody>
</table>
</div>

**Offline validation** on 24 takeover episodes of a counter task: DSBC leads at every K (54.9–57.0); memory retrieval reaches only 20 at K = 1–2 and 45–49 at K ≥ 4; partial noising stays flat at 37; memory_delta is below 8. The audit was **pre-registered**: audit PASS; reversal CONDITIONAL (reconstruction error 0.232, within 0.10–0.30); spread downgraded to fragile after a re-run; transfer PASS (p ≈ 1e-21). Under these criteria the claim "retrieval wins at K < 10" was **dropped** — the experimental design rejected my own hypothesis — and the system converged on DSBC as the main path with memory retrieval as an optional front end. Next steps were distilling DSBC into the policy, soft-retiring memory entries, and connecting it to real-robot RL. Note the metric is DTW gain, not real-robot success rate.

## 7. Extending to loco-manipulation

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/locomanip_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/locomanip_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">The humanoid autonomously walks to a counter and grasps a bottle — 7 real-robot clips, 5× speed, no audio; yellow floor marks are walking-path references.</p>

The whole stack — takeover, online loop, RECAP and RAPID — carried over from tabletop pick-and-place to a task with walking without being rewritten.

- **Data:** 507 episodes / 181K frames with walking, of which 326 survived six screening criteria; the merged training set is 848 episodes / 306K frames (+71%), and the median path length went from 0.32 m to 3.2 m — walking genuinely entered the data.
- **On metrics, honestly:** the online SFT stage has complete numbers (55% / 50%). After switching to the loco task, all components were implemented and wired in, but no metric-level improvement was achieved on it: the maturity of the whole-body hardware and locomotion stack at the time did not allow systematic real-robot evaluation.

## 8. Real-robot debugging

None of these could be found by reviewing code offline — they only surfaced during long real-robot runs, and each was located with a probe or a quantitative metric.

**BGR color order & a forgetting probe.** The base-data mixer read mp4 frames as BGR while the frozen vision tower expects RGB, so half the gradient budget was spent learning noise; fixed by changing one default. A forgetting probe showed held-out loss rising from 0.0048 (base) to 0.0222 at step 2000 (×4.6) and action-direction cosine dropping 0.995 → 0.979 → 0.961: capability wasn't overwritten, but a generalization gap was opening — the anchor set covered only 29 episodes (5.6%), so the base buffer had to grow.

**A success classifier polluting the buffer.** In the first real-robot session, episodes latched "success" after 24 and 29 steps, and the learner trained on the false samples for 1,000+ steps. Root cause: latch and reset gates shared a single 0.5 threshold with no hysteresis → changed to latch at p > 0.8 for 20 consecutive frames and reset at p ≤ 0.3 for 3 frames. A second incident (object not reset) produced 2,536 junk steps across 11 episodes — just enough to cross the 2,500-step training threshold. Lesson: audit frame by frame from the very first session.

**Observation mismatch & initial turning.** Observations were compared field by field across the training, deployment and RL pipelines — gripper DDS type, an upside-down camera, hand-position initialization, head-position indexing — yielding a 9-item fix list. An initial yaw drift (median 31°) came from a stale yaw anchor plus full re-anchoring on every chunk → rate-limited to 3°/chunk with a 20° hard cap; across 6 validation runs the anchoring error was 0.0° and first-second turning ≤ 1.6°.

**Stale camera frames & mismatched ports.** In 77 of 83 episodes, 47% of consecutive frames were duplicates: the source runs at 61 Hz and decoding at 54.9 Hz, but the effective rate under load was ≈ 10.6 Hz; added frame-freshness observability. Mismatched actor/learner ports left the trainer client blocked in retries, which looked like "the model doesn't move". Lesson: on a real-robot pipeline, every "the model doesn't move" is first a communication or observation check, then a weights check.
