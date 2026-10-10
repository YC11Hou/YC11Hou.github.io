// Measure the rendered ink extent (top/bottom, viewBox units) of every inline figure in a built site and write
// data/fit.json, so make_figures.py can crop each viewBox to its content with equal top and bottom padding.
// Usage: node tools/figures/fit_figures.mjs <built _site dir>   (then rerun make_figures.py)
import { createRequire } from "module";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../qa/package.json"));
const { chromium } = require("playwright");

const site = path.resolve(process.argv[2] || "_site");
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const server = http
  .createServer((req, res) => {
    let p = path.join(site, decodeURIComponent(req.url.split("?")[0]));
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!fs.existsSync(p)) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  })
  .listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const pages = fs.readdirSync(path.join(site, "projects")).filter((d) => fs.existsSync(path.join(site, "projects", d, "index.html")));
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 4 });
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
const fit = {};
for (const d of pages) {
  await page.goto(`${base}/projects/${d}/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const figs = await page.$$eval(".fig-svg", (els) => els.map((e) => e.outerHTML));
  const css = await page.$$eval('link[rel="stylesheet"]', (ls) => ls.map((l) => l.href));
  for (const html of figs) {
    const name = html.match(/<marker id="([^"]+)-ah/)?.[1];
    if (!name) continue;
    const [, y0, w, h] = html
      .match(/viewBox="([^"]+)"/)[1]
      .split(/\s+/)
      .map(Number);
    const pad = 120;
    // Isolate one figure on a blank transparent page with a generous viewBox, then scan the alpha channel per row.
    const svg = html.replace(
      /viewBox="[^"]+"/,
      `viewBox="0 ${y0 - pad} ${w} ${h + 2 * pad}" style="width:${w}px;min-width:0;height:${h + 2 * pad}px"`
    );
    await page.setContent(
      `<!doctype html><html style="background:transparent"><head>${css.map((c) => `<link rel="stylesheet" href="${c}">`).join("")}</head>` +
        `<body style="margin:0;background:transparent">${svg}</body></html>`,
      { waitUntil: "load" }
    );
    await page.evaluate(() => document.fonts.ready);
    const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h + 2 * pad } });
    if (process.env.FIT_DEBUG) fs.writeFileSync(`${process.env.FIT_DEBUG}/${name}.png`, buf);
    const rows = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      const g = cv.getContext("2d");
      g.drawImage(img, 0, 0);
      const a = g.getImageData(0, 0, cv.width, cv.height).data;
      let top = -1,
        bot = -1;
      for (let y = 0; y < cv.height; y++) {
        for (let x = 0; x < cv.width; x++)
          if (a[(y * cv.width + x) * 4 + 3] > 24) {
            if (top < 0) top = y;
            bot = y;
            break;
          }
      }
      return { top, bot, H: cv.height };
    }, buf.toString("base64"));
    const k = (h + 2 * pad) / rows.H;
    fit[name] = [+(y0 + rows.top * k - pad).toFixed(1), +(y0 + (rows.bot + 1) * k - pad).toFixed(1)];
    console.log(name.padEnd(20), "viewBox h", h, "ink", fit[name].join(" .. "));
  }
}
fs.writeFileSync(path.join(here, "data", "fit.json"), JSON.stringify(fit, null, 1) + "\n");
await browser.close();
server.close();
