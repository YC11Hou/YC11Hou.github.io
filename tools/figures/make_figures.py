#!/usr/bin/env python3
"""Generate the inline SVG figures used on project pages -> _includes/figures/<name>.svg.

Figures carry only CSS classes (styled in _sass/_figures.scss), so they follow the site theme.
Numbers shown in figures live here and nowhere else. Usage: python3 tools/figures/make_figures.py
"""

import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "_includes" / "figures"
DATA = Path(__file__).parent / "data"
W = 780
LH = {"t": 16, "s": 15, "m": 14, "cap": 14, "serif": 17}


class Fig:
    def __init__(self, name, h, label):
        self.name, self.h, self.label, self.els = name, h, label, []

    def add(self, el):
        self.els.append(el)

    def text(self, x, y, s, cls="", anchor="start", extra=""):
        c = f' class="{cls}"' if cls else ""
        a = f' text-anchor="{anchor}"' if anchor != "start" else ""
        self.add(f'<text x="{x:.1f}" y="{y:.1f}"{c}{a}{extra}>{escape(s)}</text>')

    def rect(self, x, y, w, h, cls, r=0, extra=""):
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r}" class="{cls}"{extra}/>')

    def line(self, x1, y1, x2, y2, cls):
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" class="{cls}"/>')

    def path(self, d, kind="", dash=False, arrow=True):
        cls = "ln" + (f" k-{kind}" if kind else "") + (" dash" if dash else "")
        mk = f' marker-end="url(#{self.name}-ah{kind})"' if arrow else ""
        self.add(f'<path d="{d}" class="{cls}"{mk}/>')

    def arrow(self, pts, kind="", dash=False):
        self.path("M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts), kind, dash)

    def node(self, x, y, w, h, lines, kind="", anchor="middle", r=5):
        self.rect(x, y, w, h, "box" + (f" k-{kind}" if kind else ""), r)
        total = sum(LH[c.split()[0]] for _, c in lines)
        cy = y + (h - total) / 2
        tx = x + w / 2 if anchor == "middle" else x + 12
        for s, c in lines:
            lh = LH[c.split()[0]]
            self.text(tx, cy + lh * 0.76, s, c, anchor)
            cy += lh

    def svg(self):
        defs = "".join(
            f'<marker id="{self.name}-ah{k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
            f'orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="ah{" k-" + k if k else ""}"/></marker>'
            for k in ["", "acc", "blue", "mut"])
        body = "\n".join(self.els)
        return (f'<svg class="fig-svg" viewBox="0 0 {W} {self.h}" role="img" aria-label="{escape(self.label)}" '
                f'xmlns="http://www.w3.org/2000/svg">\n<defs>{defs}</defs>\n{body}\n</svg>\n')

    def save(self):
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / f"{self.name}.svg").write_text(self.svg())


def row_of_nodes(f, specs, y, h, gap=28, arrow_kind=""):
    n = len(specs)
    w = (W - gap * (n - 1)) / n
    for i, (lines, kind) in enumerate(specs):
        x = i * (w + gap)
        f.node(x, y, w, h, lines, kind)
        if i < n - 1:
            f.arrow([(x + w + 3, y + h / 2), (x + w + gap - 3, y + h / 2)], arrow_kind)
    return w


def num(v):
    """Source precision: one decimal, keep a second only when the source has it (3.75); 100 stays 100."""
    if v == 100:
        return "100"
    t = f"{v:.2f}"
    return t[:-1] if t.endswith("0") else t


def cap(f, x, y, s, anchor="start", cls="cap"):
    keep = {"Hz", "LoRA"}  # units and names whose case carries meaning; Greek letters are never uppercased
    up = " ".join(w if w in keep else "".join(c.upper() if c.isascii() else c for c in w) for w in s.split(" "))
    f.text(x, y, up, cls, anchor)


# ── Honor ─────────────────────────────────────────────────────────────
def honor_pipeline():
    f = Fig("honor_pipeline", 276, "Real-robot pipeline from teleoperated collection to on-robot inference")
    specs = [
        ([("Teleop", "t"), ("collection", "t"), ("Pico VR · mocap", "m")], ""),
        ([("LeRobot", "t"), ("conversion", "t"), ("v2.1 format", "m")], ""),
        ([("Mixing &", "t"), ("screening", "t"), ("1,067 → 848 ep.", "m")], ""),
        ([("GR00T N1.7", "t"), ("post-training", "t"), ("VLM frozen", "m")], "acc"),
        ([("Offline", "t"), ("evaluation", "t"), ("ckpt / 2K steps", "m")], ""),
        ([("On-robot", "t"), ("inference", "t"), ("20 Hz inference", "m")], "acc"),
    ]
    y, h, gap = 34, 84, 24
    w = row_of_nodes(f, specs, y, h, gap)
    for label, a, b in [("data", 0, 2), ("model", 3, 4), ("robot", 5, 5)]:
        x1, x2 = a * (w + gap), b * (w + gap) + w
        f.line(x1, 22, x2, 22, "grid")
        cap(f, (x1 + x2) / 2, 16, label, "middle")
    x6, x1 = 5 * (w + gap) + w / 2, w / 2
    f.arrow([(x6, y + h + 2), (x6, 146), (x1, 146), (x1, y + h + 4)], "mut", dash=True)
    f.text(W / 2, 162, "select checkpoints by on-robot rollouts, then collect again", "serif", "middle")
    f.line(0, 184, W, 184, "grid")
    cells = [("data", "848 episodes · 306K frames", ["screened from 1,067"]),
             ("action space", "37-D · 30-step chunks", ["root 4 + joints 29", "+ head 2 + hands 2"]),
             ("trainable", "projector + action head", ["3B backbone frozen", "4-step diffusion ≈ 0.23 s"]),
             ("compute", "2 × 8 GPUs · batch 256", ["20K steps ≈ 95 epochs", "lr 1e-4"])]
    cw = W / 4
    for i, (k, v, m) in enumerate(cells):
        x = i * cw + (0 if i == 0 else 14)
        cap(f, x, 206, k)
        f.text(x, 226, v, "t")
        for j, mm in enumerate(m):
            f.text(x, 244 + j * 14, mm, "m")
        if i:
            f.line(i * cw, 194, i * cw, 262, "grid")
    f.save()


def honor_chunk():
    f = Fig("honor_chunk", 196, "Timing of action-chunk prefetching, stale-action dropping and overlap blending")
    X = lambda s: 118 + s * 13.8
    rk, rk1, rh = 46, 82, 22
    f.rect(X(20), 36, X(30) - X(20), 76, "band")
    f.rect(X(0), rk, X(30) - X(0), rh, "box", 3)
    f.rect(X(15), rk1, X(20) - X(15), rh, "box k-mut", 3)
    f.rect(X(20), rk1, X(45) - X(20), rh, "box k-acc", 3)
    f.line(X(20), rk + 3, X(30), rk + rh - 3, "ln")
    f.line(X(20), rk1 + rh - 3, X(30), rk1 + 3, "ln k-acc")
    f.text(X(20) + 4, rk + 15, "w: 1 → 0", "m")
    f.text(X(30) + 6, rk1 + 15, "w: 0 → 1, then chunk k+1 alone", "m")
    f.text(X(10), rk + 15, "executing chunk k", "m", "middle")
    for s, lab, anc in [(15, "request next chunk (15 steps left)", "end"), (20, "chunk k+1 arrives (≈ 0.23 s)", "start")]:
        f.line(X(s), 30, X(s), 112, "ln k-mut dash")
        f.text(X(s) + (-5 if anc == "end" else 5), 26, lab, "s", anc)
    f.text(104, rk + 15, "chunk k", "t", "end")
    f.text(104, rk1 + 15, "chunk k+1", "t", "end")
    f.text(X(20) - 4, 128, "stale actions dropped (≤ 12)", "m", "end")
    f.text(X(20) + 4, 128, "overlap, linearly blended (≤ 13)", "m acc")
    f.line(X(0), 144, X(46), 144, "axis")
    for s in [0, 15, 20, 30, 45]:
        f.line(X(s), 144, X(s), 149, "axis")
        f.text(X(s), 162, str(s), "m", "middle")
    f.text(X(23), 186, "time step (20 Hz)", "m", "middle")
    f.save()


def honor_fsm():
    f = Fig("honor_fsm", 304, "Autonomy / teleoperation switching state machine and the takeover output rule")
    cap(f, W / 2, 16, "ROS 2 switch node · 50 Hz · driven by the locomotion action ID", "middle")
    nodes = [(30, "WAITING", "no commands sent", "mut"), (305, "VLA AUTONOMOUS", "policy streams actions", "acc"),
             (580, "TELEOP TAKEOVER", "operator drives via Pico", "blue")]
    y, h, w = 62, 54, 170
    for x, t, s, k in nodes:
        f.node(x, y, w, h, [(t, "t"), (s, "m")], k, r=27)
    for (xa, xb, up, dn) in [(200, 305, "start", "other action"), (475, 580, "takeover", "hand back")]:
        cx = (xa + xb) / 2
        f.path(f"M{xa},{y + 12} Q{cx},{y - 20} {xb},{y + 12}", "acc" if up == "takeover" else "")
        f.path(f"M{xb},{y + h - 12} Q{cx},{y + h + 20} {xa},{y + h - 12}", "blue" if dn == "hand back" else "")
        f.text(cx, y - 11, up, "s", "middle")
        f.text(cx, y + h + 21, dn, "s", "middle")
    f.rect(0, 160, W, 140, "box", 5)
    cap(f, 18, 182, "Output during takeover (no joint jump)")
    f.text(18, 210, "a(t)  =  a_VLA(t₀)  +  [ q_teleop(t) − q_teleop(t₀) ]", "serif")
    f.text(18, 232, "t₀ = first frame after the switch → the robot continues from its current pose instead of", "m")
    f.text(18, 246, "     jumping to the teleoperator's absolute joint angles", "m")
    f.line(18, 258, W - 18, 258, "grid")
    f.text(18, 274, "logged per frame: transition mode · control state", "m")
    f.text(18, 288, "topic gap > 0.3 s (15 frames at 50 Hz) ⇒ untracked step; the episode no longer counts as fully autonomous", "m")
    f.save()


def honor_datapipe():
    f = Fig("honor_datapipe", 250, "Intervention-driven data pipeline and the composition of one round of real-robot data")
    y, h = 40, 78
    f.node(0, y, 150, h, [("Robot recording", "t"), ("every episode,", "m"), ("failures included", "m")])
    f.node(180, y, 160, h, [("Local persistence", "t"), ("LeRobot v2.1", "m"), ("parquet + mp4 + meta", "m")])
    f.node(370, y, 160, h, [("Episode verdict", "t"), ("success classifier", "m"), ("operator may only veto ↓", "m")])
    f.arrow([(153, y + h / 2), (177, y + h / 2)])
    f.arrow([(343, y + h / 2), (367, y + h / 2)])
    cap(f, 690, 12, "learner", "middle")
    f.node(600, 20, 180, 48, [("Success bucket", "t"), ("→ training buffer", "m")], "acc")
    f.node(600, 92, 180, 48, [("Failure bucket", "t"), ("→ reward-model data", "m")], "mut")
    f.line(533, y + h / 2, 556, y + h / 2, "ln")
    f.arrow([(556, y + h / 2), (556, 44), (597, 44)], "acc")
    f.arrow([(556, y + h / 2), (556, 116), (597, 116)], "mut")
    f.text(544, y + h / 2 - 6, "ZMQ", "m", "middle")
    total, tk, au = 19075, 17141, 1934
    cap(f, 0, 174, "one round of real-robot data · 83 episodes · 19,075 frames")
    wt = W * tk / total
    f.rect(0, 184, wt, 22, "f-blue", 2)
    f.rect(wt + 2, 184, W - wt - 2, 22, "f-acc", 2)
    f.text(0, 228, f"teleoperated takeover · {tk:,} frames ({100 * tk / total:.1f}%)", "t blue")
    f.text(W, 228, f"autonomous · {au:,} ({100 * au / total:.1f}%)", "t acc", "end")
    f.text(0, 244, "≈ 90% of the frames are a human correcting the policy — exactly where the model is weak", "m")
    f.save()


def honor_arch():
    f = Fig("honor_arch", 396, "Distributed real-robot learning loop across Actor, Learner and Robot")
    nodes = [(30, 40, "acc", "Actor · inference", "x86 workstation · RTX 4090",
              ["GR00T N1.7 inference, actions at 50 Hz", "success classifier assigns reward"]),
             (490, 40, "blue", "Learner · training", "GPU development server",
              ["rejection-sampling SFT on successes", "projector + action head only"]),
             (260, 270, "", "Robot · execution", "Humanoid · onboard AGX / NX",
              ["publishes topics, executes commands", "proprio: ROS 2 · images: H.264 / TCP"])]
    for x, y, k, c, t, ss in nodes:
        f.rect(x, y, 260, 112, "box" + (f" k-{k}" if k else ""), 5)
        f.text(x + 16, y + 24, c.upper(), "cap" + (f" {k}" if k else ""))
        f.text(x + 16, y + 46, t, "t")
        for i, s in enumerate(ss):
            f.text(x + 16, y + 70 + i * 17, s, "s")
    f.arrow([(487, 96), (293, 96)], "blue")
    f.text(390, 86, "weights · every 1,000 steps", "s blue", "middle")
    f.text(390, 114, "ZMQ pub-sub", "m", "middle")
    f.text(390, 128, "trainable params only", "m", "middle")
    f.arrow([(180, 155), (318, 267)], "acc")
    f.text(236, 214, "actions · 50 Hz", "s acc", "end")
    f.text(236, 230, "ROS 2 / CycloneDDS", "m", "end")
    f.arrow([(462, 267), (600, 155)])
    f.text(544, 214, "successful episodes", "s")
    f.text(544, 230, "reward > 0.8 · ZMQ req-rep", "m")
    f.text(390, 190, "↻  real-robot learning loop", "serif", "middle")
    f.save()


def honor_gates():
    f = Fig("honor_gates", 160, "Gates an episode passes before its frames reach a training batch")
    cap(f, 0, 14, "gates before an episode reaches training")
    specs = [([("Success latch", "t"), ("ResNet18 · acc 0.987", "m"), ("p > 0.8 × 20 frames", "m")], ""),
             ([("Terminal reward", "t"), ("reward > 0.8", "m")], ""),
             ([("Length & idle filter", "t"), ("episode length gate", "m"), ("static frames dropped", "m")], ""),
             ([("Success buffer", "t"), ("bucketed · FIFO", "m")], "acc"),
             ([("Training batch", "t"), ("16 frames", "m"), ("+ 8 base-demo anchors", "m")], "blue")]
    gap = 16
    w = row_of_nodes(f, specs, 26, 80, gap)
    xs = [i * (w + gap) + w / 2 for i in range(3)]
    for x in xs:
        f.line(x, 106, x, 132, "ln k-mut dash")
    f.line(xs[0], 132, xs[-1] + 40, 132, "ln k-mut dash")
    f.text(xs[-1] + 46, 136, "rejected → failure bucket (reward-model data)", "m")
    f.text(0, 154, "Only projector + action head are trained; weight sync sends requires_grad parameters only.", "m")
    f.save()


def honor_curve():
    d = json.loads((DATA / "takeover_ratio.json").read_text())
    ep, v = d["episode"], d["takeover_pct"]
    ma = [sum(v[max(0, i - 4):i + 5]) / len(v[max(0, i - 4):i + 5]) for i in range(len(v))]
    f = Fig("honor_curve", 344, "Human takeover ratio per episode during real-robot SFT, with checkpoint updates")
    x0, x1, y0, y1 = 58, 772, 296, 44
    X = lambda e: x0 + e / 178 * (x1 - x0)
    Y = lambda p: y0 - (p + 3) / 115 * (y0 - y1)
    f.rect(X(139.1), y1, X(176.5) - X(139.1), y0 - y1, "band")
    for p in range(0, 101, 20):
        f.line(x0, Y(p), x1, Y(p), "grid")
        f.text(x0 - 8, Y(p) + 4, str(p), "m", "end")
    for e in range(0, 161, 20):
        f.text(X(e), y0 + 18, str(e), "m", "middle")
    f.line(x0, y0, x1, y0, "axis")
    for e, c in [(73.1, 1000), (77.0, 3000), (109.1, 4000), (124.1, 5000), (147.2, 6000), (166.2, 7000)]:
        f.line(X(e), y1, X(e), y0, "ln k-mut dash")
        f.text(X(e) - 4, Y(87), f"ckpt {c}", "m", "start", f' transform="rotate(-90 {X(e) - 4:.1f} {Y(87):.1f})"')
    for e, p in zip(ep, v):
        f.add(f'<circle cx="{X(e):.1f}" cy="{Y(p):.1f}" r="2.4" class="f-mut" fill-opacity="0.55"/>')
    f.add('<path d="M' + " L".join(f"{X(e):.1f},{Y(p):.1f}" for e, p in zip(ep, ma)) + '" class="ln k-acc" style="stroke-width:2"/>')
    f.text(X(157.8), 30, "test phase", "t acc", "middle")
    f.path(f"M{X(87):.1f},34 L{X(87):.1f},{Y(87):.1f}", "mut")
    f.text(X(87), 28, "scene 2 starts (basket on left)", "s", "middle")
    f.path(f"M{X(56):.1f},{Y(17):.1f} L{X(78.5):.1f},{Y(3.5):.1f}", "blue")
    f.text(X(24), Y(24), "after the checkpoint update, the policy", "s blue")
    f.text(X(24), Y(24) + 15, "completes scene 1 on its own", "s blue")
    f.text(16, (y0 + y1) / 2, "takeover steps (%)", "m", "middle", f' transform="rotate(-90 16 {(y0 + y1) / 2:.1f})"')
    f.text((x0 + x1) / 2, y0 + 38, "episode", "m", "middle")
    lx, ly = x0 - 8, 12
    f.add(f'<circle cx="{lx + 8:.1f}" cy="{ly:.1f}" r="2.6" class="f-mut" fill-opacity="0.55"/>')
    f.text(lx + 22, ly + 4, "per-episode takeover ratio", "m")
    f.line(lx, ly + 15, lx + 16, ly + 15, "ln k-acc")
    f.text(lx + 22, ly + 19, "moving average (9 episodes)", "m")
    f.save()


def two_row_flow(f, caps, rows, link_from, link_to, link_label, link_kind="", link_dash=False):
    gap, h = 28, 106
    w = (W - 3 * gap) / 4
    for r, (c, specs) in enumerate(zip(caps, rows)):
        y = 34 + r * 166
        cap(f, 110 if (r == 1 and link_to == 0) else 0, y - 12, c)
        row_of_nodes(f, specs, y, h, gap)
    cx = lambda i: i * (w + gap) + w / 2
    f.arrow([(cx(link_from), 34 + h + 2), (cx(link_from), 170), (cx(link_to), 170), (cx(link_to), 197)], link_kind, link_dash)
    if link_label:
        f.text((cx(link_from) + cx(link_to)) / 2, 164, link_label, "m", "middle")


def honor_recap():
    f = Fig("honor_recap", 312, "RECAP-style advantage labeling and advantage-conditioned training")
    two_row_flow(f, ["advantage labeling", "conditioned training & inference"], [
        [([("① Episodes", "t"), ("success · with takeover", "m"), ("· failure", "m"), ("control state per frame", "m"), ("→ human vs. policy", "m")], ""),
         ([("② Reward", "t"), ("r = −1 per step", "m"), ("final: 0 or −c_fail", "m"), ("c_fail = 1000 > 943", "m")], ""),
         ([("③ Return", "t"), ("Gₜ = rₜ + Gₜ₊₁ (γ = 1)", "m"), ("normalized to [−1, 0]", "m")], ""),
         ([("④ Value V(o)", "t"), ("frozen GR00T backbone", "m"), ("201-atom distribution", "m"), ("accepted if ρ > 0.55", "m")], "blue")],
        [([("⑤ Advantage", "t"), ("Aₜ = Σ r + V(oₜ₊ₙ) − V(oₜ)", "m"), ("n = 20 (1 s)", "m"), ("top 30% → positive", "m")], ""),
         ([("⑥ Prompt + CFG", "t"), ("task + “Advantage: ±”", "m"), ("dropout 0.3 → bare task", "m")], ""),
         ([("⑦ Policy training", "t"), ("all data used", "m"), ("success : failure = 1 : 1.5", "m"), ("3 unfreezing levels", "m")], ""),
         ([("⑧ Inference", "t"), ("prompt pinned to positive", "m"), ("single forward pass", "m")], "acc")],
    ], 3, 0, "")
    f.save()


def honor_rapid():
    f = Fig("honor_rapid", 312, "RAPID: building a noise memory from takeovers and injecting retrieved noise at deployment")
    two_row_flow(f, ["offline · build memory from takeovers", "at deployment · retrieve and inject"], [
        [([("① Corrections", "t"), ("human segments of", "m"), ("successful takeovers", "m"), ("window = stride 30", "m")], ""),
         ([("② Flow inversion", "t"), ("frozen policy, 64 steps", "m"), ("actions → noise ε*", "m")], ""),
         ([("③ DCT encoding", "t"), ("first 8 coefficients", "m"), ("store ε* and δ", "m")], ""),
         ([("④ Memory bank", "t"), ("key: observation embed.", "m"), ("value: noise ε*", "m")], "blue")],
        [([("⑤ Observation key", "t"), ("same backbone", "m"), ("encodes current obs.", "m")], ""),
         ([("⑥ Retrieval", "t"), ("cosine top-4 > 0.85", "m"), ("DTW consistency filter", "m")], ""),
         ([("⑦ Noise mixing", "t"), ("hit: slerp(ε*, N(0, I))", "m"), ("miss: random seed", "m")], ""),
         ([("⑧ Frozen VLA", "t"), ("flow-matching sampling", "m"), ("weights unchanged", "m"), ("empty memory: zero cost", "m")], "acc")],
    ], 3, 1, "lookup", "blue", True)
    f.save()


def spec_strip(f, y, cells):
    cw = W / len(cells)
    f.line(0, y - 10, W, y - 10, "grid")
    for i, (k, lines) in enumerate(cells):
        x = i * cw + (0 if i == 0 else 14)
        cap(f, x, y + 8, k)
        for j, t in enumerate(lines):
            f.text(x, y + 26 + j * 14, t, "m" if j else "s")
        if i:
            f.line(i * cw, y, i * cw, y + 50, "grid")


def legend_frozen_trained(f, y):
    f.rect(W - 250, y - 9, 12, 12, "box k-mut", 2)
    f.text(W - 232, y + 1, "frozen (GR00T)", "m")
    f.rect(W - 130, y - 9, 12, 12, "box k-acc", 2)
    f.text(W - 112, y + 1, "trained", "m")


def honor_value_net():
    f = Fig("honor_value_net", 322, "Architecture of the distributional value network used for RECAP")
    cap(f, 0, 12, "value network · distributional critic")
    legend_frozen_trained(f, 12)
    y, h = 40, 104
    f.node(0, y, 150, h, [("Frozen GR00T", "t"), ("VLM backbone", "t"), ("last hidden state", "m"), ("151 tokens × 2048", "m")], "mut")
    f.node(180, y, 150, 44, [("image tokens", "t"), ("masked mean · 2048", "m")], "mut")
    f.node(180, y + 60, 150, 44, [("text tokens", "t"), ("masked mean · 2048", "m")], "mut")
    f.arrow([(152, y + 30), (177, y + 22)])
    f.arrow([(152, y + 74), (177, y + 82)])
    f.node(360, y, 100, h, [("concat", "t"), ("4096-d", "m"), ("stop-gradient", "m"), ("to backbone", "m")], "mut")
    f.arrow([(332, y + 22), (357, y + 40)])
    f.arrow([(332, y + 82), (357, y + 64)])
    f.node(490, y, 130, h, [("Linear 4096 → 512", "t"), ("GELU", "m"), ("LayerNorm", "m")], "acc")
    f.node(650, y, 130, h, [("Linear 512 → 201", "t"), ("logits over", "m"), ("201 atoms", "m")], "acc")
    f.arrow([(462, y + h / 2), (487, y + h / 2)])
    f.arrow([(622, y + h / 2), (647, y + h / 2)])
    # softmax over atoms -> expected value
    bx, by, bw, bh = 480, 172, 280, 48
    import math
    for i in range(41):
        z = -1 + i / 40
        p = math.exp(-((z + 0.32) ** 2) / 0.018) + 0.35 * math.exp(-((z + 0.7) ** 2) / 0.01)
        f.rect(bx + i * bw / 41, by + bh - p * bh, bw / 41 - 1.5, p * bh, "f-acc", 0, ' fill-opacity="0.55"')
    f.line(bx, by + bh, bx + bw, by + bh, "axis")
    f.text(bx, by + bh + 16, "−1", "m", "middle")
    f.text(bx + bw, by + bh + 16, "0", "m", "middle")
    f.text(bx + bw / 2, by + bh + 16, "201 atoms", "m", "middle")
    f.path(f"M715,{y + h + 2} L715,{by - 4}", "acc")
    f.text(0, by + 12, "V(o, l) = Σᵢ softmax(logits)ᵢ · zᵢ ,  zᵢ evenly spaced on [−1, 0]", "serif")
    f.text(0, by + 32, "target: normalized return, two-hot over the nearest atoms", "m")
    f.text(0, by + 46, "loss: cross-entropy against the two-hot target", "m")
    spec_strip(f, 268, [("optimizer", ["Adam · lr 1e-4", "batch 256"]), ("acceptance", ["held-out Spearman ρ > 0.55", "dry run 0.647"]),
                        ("pooling", ["image / text separately:", "keeps language conditioning"]),
                        ("vs. RLinf", ["pooled, no CLS token", "hence one extra hidden layer"])])
    f.save()


def honor_dsbc_net():
    f = Fig("honor_dsbc_net", 280, "Architecture of the DSBC noise network used in RAPID")
    cap(f, 0, 12, "DSBC noise network · key → initial noise")
    legend_frozen_trained(f, 12)
    y, h = 40, 128
    f.node(0, y, 110, h, [("Frozen GR00T", "t"), ("encoder", "t"), ("current", "m"), ("observation", "m")], "mut")
    f.node(136, y, 130, 54, [("VLM last token", "t"), ("backbone feature", "m")], "mut")
    f.node(136, y + 74, 130, 54, [("state features", "t"), ("mean over tokens", "m")], "mut")
    f.arrow([(112, y + 40), (133, y + 27)])
    f.arrow([(112, y + 88), (133, y + 101)])
    f.node(292, y, 110, h, [("concat", "t"), ("L2-normalize", "t"), ("= key, shared", "m"), ("with retrieval", "m")], "mut")
    f.arrow([(268, y + 27), (289, y + 50)])
    f.arrow([(268, y + 101), (289, y + 78)])
    mx, mw = 428, 190
    f.rect(mx, y, mw, h, "box k-acc", 5)
    f.text(mx + mw / 2, y + 20, "3-layer MLP", "t", "middle")
    for i, (a, b) in enumerate([("Linear → 512", "ReLU"), ("Linear 512 → 512", "ReLU"), ("Linear 512 → H·D", "")]):
        yy = y + 32 + i * 31
        f.rect(mx + 12, yy, mw - 24, 25, "box", 3)
        f.text(mx + 22, yy + 17, a, "m")
        if b:
            f.text(mx + mw - 22, yy + 17, b, "m", "end")
    f.arrow([(404, y + h / 2), (425, y + h / 2)])
    f.node(644, y, 136, 60, [("initial noise ε", "t"), ("H × D, H = 40", "m")], "blue")
    f.arrow([(620, y + 30), (641, y + 30)])
    f.node(644, y + 84, 136, 44, [("frozen action head", "t"), ("flow matching", "m")], "mut")
    f.arrow([(712, y + 62), (712, y + 81)], "blue")
    spec_strip(f, 214, [("training data", ["(key, ε*) pairs from", "takeover corrections"]), ("loss", ["MSE", "behavior cloning"]),
                        ("optimizer", ["Adam · lr 1e-3", "2,000 full-batch steps"]),
                        ("shapes", ["D and key width read", "from the checkpoint"])])
    f.save()


RAPID_K = ["K = 1", "K = 2", "K = 4", "K = 8", "K = 12"]
RAPID = [("DSBC", "noise network π(ε | key), behavior-cloned on (key, ε*) pairs", "f-acc", 1, (54.9, 54.6, 56.8, 55.8, 57.0)),
         ("memory_dct", "ε* rebuilt from its first 8 DCT coefficients (default)", "f-blue", 1, (20.4, 20.3, 45.0, 47.3, 49.0)),
         ("memory_raw", "retrieved ε* blended with random noise", "f-blue", 0.45, (20.2, 20.0, 44.5, 47.9, 48.9)),
         ("partial_noising", "RtS-style baseline: stored action chunks, partially re-noised", "f-ink", 0.4, (36.5, 36.8, 37.0, 37.2, 37.3)),
         ("memory_delta", "random sample + β·α·δ (ablation arm)", "f-rule", 1, (7.1, 7.3, 7.5, 7.7, 7.8))]


def honor_rapid_chart():
    f = Fig("honor_rapid_chart", 372, "DTW gain versus retrieval size K for five initial-noise strategies")
    x0, x1, y0, y1 = 50, 776, 236, 30
    Y = lambda v: y0 - v / 60 * (y0 - y1)
    cap(f, 0, 12, "offline validation · DTW gain vs. K · 24 takeover episodes")
    for v in range(0, 61, 10):
        f.line(x0, Y(v), x1, Y(v), "grid")
        f.text(x0 - 8, Y(v) + 4, str(v), "m", "end")
    f.line(x0, y0, x1, y0, "axis")
    gw = (x1 - x0) / 5
    bw = 21
    for g, k in enumerate(RAPID_K):
        gx = x0 + g * gw + (gw - 5 * bw - 8) / 2
        for i, (_, _, cls, op, vals) in enumerate(RAPID):
            x = gx + i * (bw + 2)
            f.rect(x, Y(vals[g]), bw, y0 - Y(vals[g]), cls, 1, f' fill-opacity="{op}"')
            f.text(x + bw / 2, Y(vals[g]) - 4, f"{vals[g]:.0f}", "m", "middle", ' style="font-size:9px"')
        f.text(x0 + g * gw + gw / 2, y0 + 18, k, "s", "middle")
    f.text(14, (y0 + y1) / 2, "DTW gain", "m", "middle", f' transform="rotate(-90 14 {(y0 + y1) / 2:.1f})"')
    for i, (n, desc, cls, op, _) in enumerate(RAPID):
        y = 272 + i * 21
        f.rect(0, y - 10, 12, 12, cls, 2, f' fill-opacity="{op}"')
        f.text(20, y, n, "t")
        f.text(150, y, desc, "s")
    f.save()


# ── LangGap ───────────────────────────────────────────────────────────
def langgap_diagnosis():
    f = Fig("langgap_diagnosis", 272, "pi0.5 success rate on original versus extended LangGap tasks, by perturbation type")
    rows = [("Original LIBERO", "40 tasks · 800 episodes", 93.8, "f-ink", 0), ("Extended (LangGap)", "59 tasks · 1,180 episodes", 21.4, "f-acc", 0),
            ("Change Object", "38 tasks · 760 ep.", 29.3, "f-acc", 1), ("Change Target", "13 tasks · 260 ep.", 0.0, "f-acc", 1),
            ("Spatial Description", "5 tasks · 100 ep.", 11.0, "f-acc", 1), ("Drawer Action", "3 tasks · 60 ep.", 31.7, "f-acc", 1)]
    bx, bw = 250, 440
    X = lambda v: bx + v / 100 * bw
    cap(f, 0, 12, "π0.5 success rate (%) · same scenes, only the instruction changes")
    y = 30
    ys = []
    for name, meta, v, cls, sub in rows:
        ind = 16 if sub else 0
        f.text(ind, y + 13, name, "t" if not sub else "s")
        f.text(ind, y + 27, meta, "m")
        f.rect(bx, y + 6, max(X(v) - bx, 0.1), 18, cls, 2, ' fill-opacity="0.55"' if sub else "")
        if v == 0:
            f.rect(bx, y + 6, 2.5, 18, "f-acc")
            f.text(bx + 10, y + 20, "0.0 — all 260 episodes fail", "t acc")
        else:
            f.text(X(v) + 8, y + 20, f"{v:.1f}", "t" + (" acc" if cls == "f-acc" else ""))
        ys.append(y)
        y += 36 if sub or name.startswith("Orig") else 42
        if name.startswith("Ext"):
            f.line(0, y - 6, W, y - 6, "grid")
    xo = X(93.8)
    f.path(f"M{xo:.1f},{ys[0] + 26} L{xo:.1f},{ys[1] + 15} L{X(21.4) + 50:.1f},{ys[1] + 15}", "acc", dash=True)
    f.text(xo + 8, ys[1] + 5, "−72.4 pts", "t acc")
    f.line(bx, y, bx + bw, y, "axis")
    for t in [0, 25, 50, 75, 100]:
        f.line(X(t), y, X(t), y + 4, "axis")
        f.text(X(t), y + 17, str(t), "m", "middle")
    f.save()


def langgap_progressive():
    f = Fig("langgap_progressive", 300, "Progressive validation: fine-tuning gains shrink as the number of tasks grows")
    rows = [("Single task", "1 extended · eval 1 task", 3.75, 90.0), ("6 tasks", "1 + 5 extended · eval 5 ext.", 0.0, 28.0),
            ("45 tasks", "40 orig. + 5 ext. · eval 5 ext.", 0.0, 4.0), ("16 tasks", "16 extended · eval 16 ext.", 26.2, 6.2),
            ("56 tasks", "40 orig. + 16 ext. · eval 16 ext.", 26.2, 27.5)]
    bx, bw = 250, 440
    X = lambda v: bx + v / 100 * bw
    cap(f, 0, 12, "success rate (%) on extended tasks · π0.5 LoRA")
    f.rect(420, 3, 12, 10, "f-rule", 2)
    f.text(438, 12, "baseline π0.5", "m")
    f.rect(548, 3, 12, 10, "f-acc", 2)
    f.text(566, 12, "fine-tuned on LangGap data", "m")
    y = 32
    for name, meta, b, o in rows:
        f.text(0, y + 14, name, "t")
        f.text(0, y + 29, meta, "m")
        for dy, v, cls in [(2, b, "f-rule"), (19, o, "f-acc")]:
            f.rect(bx, y + dy, max(X(v) - bx, 1.5), 14, cls, 2)
            f.text(X(v) + 6, y + dy + 11, num(v), "m" + (" acc b" if cls == "f-acc" else ""))
        y += 48
    f.line(bx, y, bx + bw, y, "axis")
    for t in [0, 25, 50, 75, 100]:
        f.line(X(t), y, X(t), y + 4, "axis")
        f.text(X(t), y + 17, str(t), "m", "middle")
    f.save()


def heatmap(f, groups, cols, rows, x0, top, cw, rh, lo, hi, sep_before=None, label_w=None):
    x = x0
    for g, n in groups:
        f.text(x + n * cw / 2, top - 22, g, "t", "middle")
        f.line(x + 3, top - 16, x + n * cw - 3, top - 16, "grid")
        x += n * cw
    for i, c in enumerate(cols):
        f.text(x0 + i * cw + cw / 2, top - 4, c, "m", "middle")
    y = top + 4
    for r, (label, vals, hl) in enumerate(rows):
        if sep_before is not None and r == sep_before:
            y += 8
        f.text(x0 - 12, y + rh / 2 + 4, label, "t acc" if hl else "s", "end")
        for i, v in enumerate(vals):
            op = 0.05 + 0.85 * max(0.0, min(1.0, (v - lo) / (hi - lo)))
            f.rect(x0 + i * cw + 1, y + 1, cw - 2, rh - 2, "f-acc", 2, f' fill-opacity="{op:.2f}"')
            cls = "m on b" if op > 0.55 else ("m b" if hl else "m")
            f.text(x0 + i * cw + cw / 2, y + rh / 2 + 4, num(v), cls, "middle",
                   ' style="font-size:11px"' + (' style="fill:var(--ink)"' if op <= 0.55 else ""))
        y += rh
    return y


def langgap_benchmark():
    f = Fig("langgap_benchmark", 326, "Success rates of VLA models on the full LangGap benchmark by suite and perturbation")
    rows = [("π0.5", (97.0, 5.9, 97.0, 30.0, 100, 37.7, 81.0, 93.8, 21.4, 29.3, 0.0), False),
            ("π0", (47.0, 3.6, 63.0, 0.0, 43.0, 18.6, 40.0, 48.3, 8.6, 10.8, 0.0), False),
            ("π0-FAST", (65.0, 1.5, 37.8, 1.2, 61.0, 5.0, 26.0, 47.5, 2.7, 3.1, 2.3), False),
            ("SmolVLA", (17.0, 3.2, 44.0, 0.0, 50.0, 13.2, 41.0, 38.0, 6.4, 7.6, 0.0), False),
            ("π0.5 + ours (45)", (95.0, 10.2, 85.0, 27.2, 100, 37.0, 78.0, 89.5, 22.8, 28.4, 6.2), True),
            ("π0.5 + ours (56)", (97.0, 7.1, 77.0, 26.1, 98.0, 35.0, 70.0, 85.5, 20.4, 27.5, 5.0), True)]
    groups = [("Spatial", 2), ("Goal", 2), ("Object", 2), ("Long", 1), ("Total", 2), ("Extended by type", 2)]
    cols = ["orig.", "ext.", "orig.", "ext.", "orig.", "ext.", "orig.", "orig.", "ext.", "Ch.Obj", "Ch.Tgt"]
    y = heatmap(f, groups, cols, rows, 128, 50, 59, 30, 0, 100, sep_before=4)
    f.text(0, y + 22, "Success rate (%). orig. = original LIBERO tasks; ext. = LangGap extended tasks;", "m")
    f.text(0, y + 36, "Ch.Obj / Ch.Tgt = extended tasks that change the object / the target. Darker = higher.", "m")
    f.save()


# ── AION ──────────────────────────────────────────────────────────────
def aion_thor():
    f = Fig("aion_thor", 400, "AI2-THOR results: success rate and SPL on seen and unseen objects for two splits")
    data = {"18/4": [("BaseModel", (76.7, 39.9, 81.5, 36.4)), ("Scene Prior", (74.3, 42.1, 83.7, 41.9)), ("MJO", (81.2, 52.0, 90.7, 51.7)),
                     ("SSNet", (72.3, 50.4, 77.8, 50.0)), ("AION (ours)", (88.7, 57.9, 95.0, 55.2))],
            "14/8": [("BaseModel", (73.3, 47.3, 70.8, 46.6)), ("Scene Prior", (79.3, 52.7, 71.0, 44.8)), ("MJO", (78.8, 43.6, 83.0, 45.6)),
                     ("SSNet", (79.2, 44.3, 81.8, 46.4)), ("AION (ours)", (84.7, 61.2, 87.0, 60.5))]}
    rows, x0, cw, rh = [], 250, 128, 28
    for split, rs in data.items():
        for name, vals in rs:
            rows.append((name, vals, name.startswith("AION")))
    y = heatmap(f, [("Seen objects", 2), ("Unseen objects", 2)], ["SR", "SPL", "SR", "SPL"], rows, x0, 50, cw, rh, 30, 100, sep_before=5)
    for i, split in enumerate(data):
        yy = 54 + i * (5 * rh + 8) + 5 * rh / 2
        f.text(0, yy + 4, f"split {split}", "cap")
    f.text(0, y + 22, "SR = success rate (%), SPL = success weighted by path length (%). Darker = higher.", "m")
    f.save()


def aion_isaac():
    f = Fig("aion_isaac", 362, "IsaacSim multi-room results: successes out of five trials per object and scene")
    methods = [("Exp + MJO", [3, 4, 4], [2, 5, 5], [0, 3, 5], [2, 5, 2]),
               ("Exp + SSNet", [3, 4, 3], [3, 2, 3], [0, 3, 5], [1, 5, 3]),
               ("AION (ours)", [4, 4, 5], [5, 5, 4], [2, 5, 5], [3, 5, 5])]
    objs = ["Sofa", "Plant", "Laptop", "Microwave"]
    scenes = ["Chemistry Lab", "Beechwood", "Ihlen"]
    sx = [300, 450, 600]
    for s, x in zip(scenes, sx):
        f.text(x + 40, 20, s, "t", "middle")
    f.text(W, 20, "total", "t", "end")
    y = 38
    for mi, (m, *per_obj) in enumerate(methods):
        ours = m.startswith("AION")
        tot = sum(sum(o) for o in per_obj)
        f.text(0, y + 2 * 22 + 4, m, "t acc" if ours else "t")
        f.text(W, y + 2 * 22 + 4, f"{tot} / 60", "t acc" if ours else "s", "end")
        for oi, (o, vals) in enumerate(zip(objs, per_obj)):
            yy = y + oi * 22 + 11
            f.text(150, yy + 4, o, "s")
            for x, n in zip(sx, vals):
                for p in range(5):
                    cx = x + p * 16
                    cls = ("f-acc" if ours else "f-ink") if p < n else "pip-off"
                    f.add(f'<circle cx="{cx:.1f}" cy="{yy:.1f}" r="5.5" class="{cls}"/>')
        y += 4 * 22 + 12
        if mi < 2:
            f.line(0, y - 6, W, y - 6, "grid")
    f.text(0, y + 12, "Each dot is one trial (5 per object and scene); targets start in rooms not visible from the start.", "m")
    f.save()


# ── VLN / vehicle ─────────────────────────────────────────────────────
def vln_pipeline():
    f = Fig("vln_pipeline", 290, "Four-step pipeline generating 3D aerial trajectories and instructions in Habitat")
    specs = [([("① Start–goal pairs", "t"), ("200–300 per scene", "m"), ("navigable, filtered", "m")], ""),
             ([("② 2D cruise path", "t"), ("Lattice A* on (x, y, θ)", "m"), ("H = ‖p − p_g‖/L + λ|Δθ|", "m")], "acc"),
             ([("③ 3D trajectory", "t"), ("takeoff + cruise + landing", "m"), ("RGB-D along the path", "m")], ""),
             ([("④ Instruction", "t"), ("video → text model", "m"), ("one per trajectory", "m")], "")]
    row_of_nodes(f, specs, 10, 84)
    for i, (title, smooth) in enumerate([("Grid A* · right-angle turns", False), ("Lattice A* · turns while moving", True)]):
        x, y, w, h = i * 262, 124, 246, 160
        f.rect(x, y, w, h, "box", 5)
        cap(f, x + 12, y + 18, title, cls="cap acc" if smooth else "cap")
        for gx in range(int(x) + 20, int(x + w) - 10, 18):
            for gy in range(y + 32, y + h - 8, 18):
                f.add(f'<circle cx="{gx}" cy="{gy}" r="1" class="f-rule"/>')
        f.rect(x + 96, y + 64, 50, 46, "f-rule", 3, ' fill-opacity="0.6"')
        sxy, gxy = (x + 32, y + h - 22), (x + w - 28, y + 44)
        if smooth:
            d = f"M{sxy[0]},{sxy[1]} C{x + 80},{y + h - 20} {x + 70},{y + 48} {x + 120},{y + 46} S{x + 190},{y + 44} {gxy[0]},{gxy[1]}"
            f.path(d, "acc")
        else:
            f.arrow([sxy, (x + 74, sxy[1]), (x + 74, y + 50), (x + 164, y + 50), (x + 164, gxy[1]), gxy])
        f.add(f'<circle cx="{sxy[0]}" cy="{sxy[1]}" r="4" class="f-ink"/>')
        f.text(sxy[0] - 4, sxy[1] + 16, "start", "m")
        f.text(gxy[0] + 2, gxy[1] - 8, "goal", "m", "end")
    stats = [("90", "indoor scenes"), ("200–300", "start–goal pairs per scene"), ("10,000+", "three-stage 3D trajectories"),
             ("open source", "code and data on GitHub")]
    for i, (n, lab) in enumerate(stats):
        y = 146 + i * 38
        f.text(548, y, n, "t acc", extra=' style="font-size:17px"')
        f.text(548, y + 16, lab, "m")
    f.save()


def vehicle_loop():
    f = Fig("vehicle_loop", 300, "Frontier-based exploration loop running on the vehicle")
    nodes = {"top": (390, 44, [("Map update", "t"), ("Cartographer SLAM · every 2 s", "m")], ""),
             "right": (620, 150, [("Frontier extraction", "t"), ("boundary of known free space", "m")], ""),
             "bottom": (390, 256, [("Frontier scoring", "t"), ("f* = argmax w₁·I_f − w₂·D_f", "m")], "acc"),
             "left": (160, 150, [("Navigate", "t"), ("best frontier → Nav2 goal", "m")], "blue")}
    bw, bh = 220, 56
    for cx, cy, lines, k in nodes.values():
        f.node(cx - bw / 2, cy - bh / 2, bw, bh, lines, k)
    f.path(f"M{390 + bw / 2 + 3},44 Q620,44 620,{150 - bh / 2 - 3}")
    f.path(f"M620,{150 + bh / 2 + 3} Q620,256 {390 + bw / 2 + 3},256")
    f.path(f"M{390 - bw / 2 - 3},256 Q160,256 160,{150 + bh / 2 + 3}")
    f.path(f"M160,{150 - bh / 2 - 3} Q160,44 {390 - bw / 2 - 3},44")
    f.text(390, 146, "exploration loop", "serif", "middle")
    f.text(390, 164, "information gain vs. travel cost", "m", "middle")
    f.save()


if __name__ == "__main__":
    for fn in [honor_pipeline, honor_chunk, honor_fsm, honor_datapipe, honor_arch, honor_gates, honor_curve,
               honor_recap, honor_value_net, honor_rapid, honor_dsbc_net, honor_rapid_chart, langgap_diagnosis, langgap_progressive, langgap_benchmark,
               aion_thor, aion_isaac, vln_pipeline, vehicle_loop]:
        fn()
        print("wrote", fn.__name__)
