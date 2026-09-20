# Hero loop sources

A 12 s muted loop (the industry norm for a hero is 5-10 s: Apple ships 5 s / 335 KB, Anthropic 4.6 s / 1 MB), delivered as four files;
`_includes/hero.liquid` lists them as `<source>` elements with `media` attributes (720p below 900 px), HEVC first, H.264 fallback.
No connection sniffing (`navigator.connection` does not exist in Safari). All scaled from 4K originals through a CRF 14 H.264 master, then rate-capped:

| File | Codec | Cap | Size |
|---|---|---|---|
| reel-1080.hevc.mp4 | HEVC (x265, crf 27, hvc1) | 2.2 Mbps | 3.4 MB |
| reel-1080.h264.mp4 | H.264 high (crf 24) | 2.2 Mbps | 3.4 MB |
| reel-720.hevc.mp4 / .h264.mp4 | same two | 1.1 Mbps | 1.7 MB |

Cut: 4 s + 4 s + 2.5 s + 4 s with 0.8 s cross-fades; the loop ends on the second before clip 1's in-point, so it is seamless.
Render: `tools/qa/render_reel.py <dir with the 4K mixkit files> <out dir>`.
Stock clips are Mixkit originals under the Mixkit Stock Video Free License (free for commercial use, no attribution required).

| # | Clip | Source |
|---|------|--------|
| 1 | Rocky cape seen from above | https://mixkit.co/free-stock-video/rocky-cape-seen-from-above-5012/ |
| 2 | Landscape of a mountain range | https://mixkit.co/free-stock-video/landscape-of-a-mountain-range-4366/ |
| 3 | Honor humanoid teleop takeover (own, 720p source, darkened, 2.5 s) | profile/assets/past_projects/honor_takeover_demo.mp4 |
| 4 | Waves hitting a small cliff, aerial | https://mixkit.co/free-stock-video/aerial-view-of-waves-hitting-a-small-cliff-51455/ |
