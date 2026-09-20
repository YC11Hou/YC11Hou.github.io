#!/usr/bin/env python3
"""Real-browser QA loop for the site: build, serve, drive headless Chrome over the
DevTools protocol, and report video start-up, stalls, dropped frames, scroll
animation smoothness, plus a screenshot sequence. Usage: tools/qa/qa.py [--no-build]
[--url URL] [--out DIR]. Needs Chrome, ffmpeg (optional), python websockets."""
import argparse, asyncio, base64, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
import websockets

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 8797
DEVPORT = 9446


def build(out_dir):
    cfg = os.path.join(out_dir, "override.yml")
    with open(cfg, "w") as f:
        f.write("exclude: [assets/jupyter, _posts, vendor, node_modules, tools]\ndestination: %s\n" % os.path.join(out_dir, "_site"))
    r = subprocess.run(["bundle", "exec", "jekyll", "build", "--quiet", "--config", "_config.yml,%s" % cfg], cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        sys.exit("jekyll build failed:\n" + r.stderr[-2000:])
    return os.path.join(out_dir, "_site")


class Chrome:
    def __init__(self, profile, width, height, dpr):
        self.proc = subprocess.Popen([CHROME, "--headless=new", "--no-first-run", "--no-proxy-server", "--user-data-dir=" + profile,
            "--autoplay-policy=no-user-gesture-required", "--remote-debugging-port=%d" % DEVPORT,
            "--window-size=%d,%d" % (width, height), "--hide-scrollbars", "--force-device-scale-factor=%s" % dpr, "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.ws = None
        self.i = 0

    async def connect(self):
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for _ in range(150):
            try:
                tabs = json.load(opener.open("http://127.0.0.1:%d/json/list" % DEVPORT, timeout=3))
                break
            except Exception:
                await asyncio.sleep(0.2)
        url = [t for t in tabs if t["type"] == "page"][0]["webSocketDebuggerUrl"]
        self.ws = await websockets.connect(url, max_size=None, proxy=None)

    async def call(self, method, params=None):
        self.i += 1
        await self.ws.send(json.dumps({"id": self.i, "method": method, "params": params or {}}))
        while True:
            m = json.loads(await asyncio.wait_for(self.ws.recv(), 30))
            if m.get("id") == self.i:
                return m.get("result", {})

    async def js(self, expr):
        r = await self.call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        return r.get("result", {}).get("value")

    async def shot(self, path):
        r = await self.call("Page.captureScreenshot", {"format": "png"})
        open(path, "wb").write(base64.b64decode(r["data"]))

    def close(self):
        try:
            self.proc.terminate()
        except Exception:
            pass


VIDEO_PROBE = """
(() => {
  const v = document.querySelector('.hero-video');
  if (!v) return {present:false};
  const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : {};
  let buffered = 0; for (let i = 0; i < v.buffered.length; i++) buffered += v.buffered.end(i) - v.buffered.start(i);
  return {present:true, src:v.currentSrc.split('/').pop(), ready:v.readyState, paused:v.paused, t:v.currentTime,
    buffered:+buffered.toFixed(1), duration:+(v.duration||0).toFixed(1), w:v.videoWidth, h:v.videoHeight,
    total:q.totalVideoFrames||0, dropped:q.droppedVideoFrames||0, playing:v.classList.contains('is-playing')};
})()
"""

SCROLL_FPS = """
new Promise(res => {
  const frames = []; let last = performance.now(); const t0 = last; const total = 1600;
  const h = (document.querySelector('.home-hero')||document.body).offsetHeight || innerHeight;
  function step(now) {
    frames.push(now - last); last = now;
    const p = Math.min(1, (now - t0) / total);
    window.scrollTo(0, Math.round(p * h));
    if (p < 1) requestAnimationFrame(step); else {
      frames.shift();
      const worstAt = frames.indexOf(Math.max(...frames));
      const long = frames.filter(d => d > 24).length;
      const avg = frames.reduce((a,b)=>a+b,0)/frames.length;
      res({frames:frames.length, avg_ms:+avg.toFixed(1), fps:+(1000/avg).toFixed(0), janky:long, worst_ms:+Math.max(...frames).toFixed(1), worst_at:worstAt});
    }
  }
  requestAnimationFrame(step);
})
"""


async def run(args):
    out = args.out
    os.makedirs(out, exist_ok=True)
    site = build(out) if not args.no_build else os.path.join(out, "_site")
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=site,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    base = args.url or "http://127.0.0.1:%d" % PORT
    report = {"url": base, "checks": []}
    profile = tempfile.mkdtemp(prefix="qa-chrome-")
    ch = Chrome(profile, args.width, args.height, args.dpr)
    try:
        await ch.connect()
        await ch.call("Page.enable")
        await ch.call("Network.enable")
        if args.throttle:
            await ch.call("Network.emulateNetworkConditions", {"offline": False, "latency": 40,
                "downloadThroughput": args.throttle * 125000, "uploadThroughput": 5 * 125000})
        t0 = time.time()
        await ch.call("Page.navigate", {"url": base + "/"})
        # Video start-up: poll until the first real frame is shown
        first = None
        for _ in range(100):
            v = await ch.js(VIDEO_PROBE)
            if v.get("playing") and v.get("t", 0) > 0.05:
                first = round(time.time() - t0, 2)
                break
            await asyncio.sleep(0.1)
        report["video_first_frame_s"] = first
        await ch.shot(os.path.join(out, "01_top.png"))
        # Stalls during 8 s of playback
        stalls = 0
        prev = await ch.js(VIDEO_PROBE)
        for _ in range(16):
            await asyncio.sleep(0.5)
            cur = await ch.js(VIDEO_PROBE)
            if not cur.get("paused") and cur.get("t", 0) - prev.get("t", 0) < 0.2:
                stalls += 1
            prev = cur
        report["video"] = cur
        report["video_stalls_in_8s"] = stalls
        # Scroll animation smoothness while the video plays
        report["scroll"] = await ch.js(SCROLL_FPS)
        # Sequence for the eye
        h = await ch.js("(document.querySelector('.home-hero')||document.body).offsetHeight")
        for k, f in enumerate((0, 0.25, 0.5, 0.75, 1.0)):
            await ch.js("window.scrollTo(0, %d)" % int(h * f))
            await asyncio.sleep(0.4)
            await ch.shot(os.path.join(out, "seq_%d.png" % k))
        # Other pages still render and have no hero
        for path in ("/publications/", "/projects/"):
            await ch.call("Page.navigate", {"url": base + path})
            await asyncio.sleep(1.5)
            ok = await ch.js("!!document.querySelector('.site-content') && !document.querySelector('.home-hero')")
            report["checks"].append({"page": path, "clean": bool(ok)})
    finally:
        ch.close()
        server.terminate()
        shutil.rmtree(profile, ignore_errors=True)
    # Verdicts
    v = report.get("video", {})
    verdict = []
    verdict.append(("video started < 2.5 s", first is not None and first < 2.5, first))
    verdict.append(("no stalls in 8 s", report["video_stalls_in_8s"] == 0, report["video_stalls_in_8s"]))
    verdict.append(("dropped frames < 2 %", v.get("total", 0) > 0 and v.get("dropped", 0) / max(1, v.get("total", 1)) < 0.02, "%s/%s" % (v.get("dropped"), v.get("total"))))
    sc = report.get("scroll") or {}
    verdict.append(("scroll >= 50 fps, <= 3 janky frames", sc.get("fps", 0) >= 50 and sc.get("janky", 99) <= 3, sc))
    for c in report["checks"]:
        verdict.append(("%s has no hero" % c["page"], c["clean"], ""))
    report["verdict"] = [{"check": a, "pass": bool(b), "value": c} for a, b, c in verdict]
    json.dump(report, open(os.path.join(out, "report.json"), "w"), indent=2, default=str)
    for a, b, c in verdict:
        print("%s  %s  %s" % ("PASS" if b else "FAIL", a, c))
    print("video:", v.get("src"), v.get("w"), "x", v.get("h"), "buffered", v.get("buffered"), "of", v.get("duration"), "s")
    print("screens:", out)
    return all(b for _, b, _ in verdict)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-build", action="store_true")
    ap.add_argument("--url", help="test a deployed site instead of the local build")
    ap.add_argument("--out", default=os.path.join(tempfile.gettempdir(), "site-qa"))
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--dpr", default="2")
    ap.add_argument("--throttle", type=float, default=0, help="emulate this many Mbps down")
    for k in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        os.environ.pop(k, None)
    ok = asyncio.run(run(ap.parse_args()))
    sys.exit(0 if ok else 1)
