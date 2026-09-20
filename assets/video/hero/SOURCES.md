# Hero reel sources

One 33 s cut, delivered as six files so every browser gets the cheapest codec it can decode
(chosen in `_includes/hero.liquid`: HEVC -> AV1 -> H.264; 720p below 900 px or when the browser reports a link under 10 Mbps, 1080p otherwise).
All are scaled from the clips' 4K originals (Lanczos + light sharpen) through a CRF 14 H.264 master,
then rate-capped so playback never outruns an ordinary connection:

| File | Codec | Cap | Size |
|---|---|---|---|
| reel-1080.av1.mp4 | AV1 (SVT, crf 34) | 5 Mbps | ~15 MB |
| reel-1080.hevc.mp4 | HEVC (x265, crf 26, hvc1) | 5 Mbps | ~17 MB |
| reel-1080.h264.mp4 | H.264 high (crf 23) | 5 Mbps | ~20 MB |
| reel-720.* | same three | 2.5 Mbps | 8 - 10 MB |

8 clips of 5 s (Honor 4 s), 1 s cross-fades; the reel ends on the two seconds before clip 1's in-point, so the loop is seamless.
Stock clips are Mixkit originals under the Mixkit Stock Video Free License (free for commercial use, no attribution required).
Render script: `tools/qa/render_reel.py` (edit the clip list and source paths there).

| # | Clip | Source |
|---|------|--------|
| 1 | Landscape of a mountain range | https://mixkit.co/free-stock-video/landscape-of-a-mountain-range-4366/ |
| 2 | Rocky cape seen from above | https://mixkit.co/free-stock-video/rocky-cape-seen-from-above-5012/ |
| 3 | Snowy mountains, aerial | https://mixkit.co/free-stock-video/beautiful-landscape-of-snowy-mountains-aerial-3365/ |
| 4 | Waves hitting a small cliff, aerial | https://mixkit.co/free-stock-video/aerial-view-of-waves-hitting-a-small-cliff-51455/ |
| 5 | River through a forest | https://mixkit.co/free-stock-video/river-passing-through-a-forest-full-of-trees-51447/ |
| 6 | Honor humanoid teleop takeover (own, 720p source, darkened) | profile/assets/past_projects/honor_takeover_demo.mp4 |
| 7 | Swiss Alps snow time-lapse | https://mixkit.co/free-stock-video/swiss-alps-snow-background-time-lapse-4283/ |
| 8 | Coast with motorboats and a pier | https://mixkit.co/free-stock-video/beautiful-coast-with-motorboats-and-a-pier-seen-from-the-5363/ |
