#!/usr/bin/env python3
"""Render the landing-page hero loop. Short (about 12 s), muted, seamless, from
4K sources; delivered as 1080p/720p in HEVC (hvc1) + H.264 at low, capped
bitrates. Usage: render_reel.py <src_dir> <out_dir>   (src_dir holds the Mixkit
4K files named <id>.mp4; see assets/video/hero/SOURCES.md for the ids)."""
import os, subprocess, sys

SRC, OUT = sys.argv[1], sys.argv[2]
OWN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "assets", "past_projects", "honor_takeover_demo.mp4")
G = "eq=saturation=0.88:contrast=1.04"
B = "eq=saturation=0.85:contrast=1.05:brightness=-0.04"
CLIPS = [
    (f"{SRC}/5012.mp4", 1, 4, G),
    (f"{SRC}/4366.mp4", 2, 4, B),
    (OWN, 5, 2.5, "eq=saturation=0.6:contrast=1.08:brightness=-0.14"),
    (f"{SRC}/51455.mp4", 6, 4, G),
    (f"{SRC}/5012.mp4", 0, 1, G),  # tail = head clip's second before its in-point -> seamless loop
]
XF = 0.8


def master(w, h, out):
    inputs, fc = [], []
    for i, (f, s, l, g) in enumerate(CLIPS):
        inputs += ["-ss", str(s), "-t", str(l), "-i", f]
        fc.append(f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h},fps=24,setsar=1,{g},unsharp=5:5:0.4:5:5:0,format=yuv420p,setpts=PTS-STARTPTS[v{i}]")
    prev, off = "v0", 0
    for i in range(1, len(CLIPS)):
        off += CLIPS[i - 1][2] - XF
        fc.append(f"[{prev}][v{i}]xfade=transition=fade:duration={XF}:offset={off:.3f}[x{i}]")
        prev = f"x{i}"
    run(["ffmpeg", "-v", "error", "-y"] + inputs + ["-filter_complex", ";".join(fc), "-map", f"[{prev}]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", out])


def encode(src, codec, out, maxrate, buf):
    base = ["ffmpeg", "-v", "error", "-y", "-i", src, "-an", "-g", "48", "-keyint_min", "24"]
    if codec == "h264":
        v = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", "24", "-maxrate", maxrate, "-bufsize", buf, "-pix_fmt", "yuv420p"]
    else:
        v = ["-c:v", "libx265", "-preset", "medium", "-crf", "27", "-maxrate", maxrate, "-bufsize", buf, "-pix_fmt", "yuv420p", "-tag:v", "hvc1", "-x265-params", "log-level=error"]
    run(base + v + ["-movflags", "+faststart", out])
    print(codec, os.path.basename(out), os.path.getsize(out) // 1024, "KB", flush=True)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-800:])


os.makedirs(OUT, exist_ok=True)
for res, (w, h), rate in (("1080", (1920, 1080), ("2.2M", "4.4M")), ("720", (1280, 720), ("1.1M", "2.2M"))):
    m = os.path.join(OUT, f"master-{res}.mp4")
    master(w, h, m)
    for codec in ("hevc", "h264"):
        encode(m, codec, os.path.join(OUT, f"reel-{res}.{codec}.mp4"), *rate)
    os.remove(m)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1", "-i", os.path.join(OUT, "reel-1080.h264.mp4"), "-frames:v", "1", "-vf", "scale=1600:-1", "-q:v", "7", os.path.join(OUT, "reel_poster.jpg")])
print("done", flush=True)
