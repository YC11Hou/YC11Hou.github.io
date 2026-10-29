// Reference census: list-row geometry, type sizes and thumbnail sharpness of academic homepages, one JSON line per site.
// Usage: node tools/qa/ref_census.js $(cat tools/qa/ref_sites.txt) > census.jsonl   (compare our pages with the same script)
const { chromium } = require("./node_modules/playwright");
const urls = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const one = async (url) => {
    const p = await ctx.newPage();
    try {
      await p.goto(url, { waitUntil: "load", timeout: 25000 });
      await p.waitForTimeout(2000);
      return await p.evaluate(() => {
        const med = (a) => {
          a = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y);
          return a.length ? a[Math.floor(a.length / 2)] : null;
        };
        const vis = (e) => e.getBoundingClientRect().height > 0;
        const media = [...document.querySelectorAll("img, video")]
          .map((e) => ({ e, r: e.getBoundingClientRect() }))
          .filter((o) => o.r.width >= 120 && o.r.width <= 500 && o.r.height >= 60 && o.r.left < 900)
          .sort((a, b) => a.r.top - b.r.top);
        const rows = [];
        for (const o of media) {
          let row = o.e;
          for (let i = 0; i < 6 && row.parentElement; i++) {
            row = row.parentElement;
            if (row.getBoundingClientRect().width > o.r.width + 200) break;
          }
          const leaves = [...row.querySelectorAll("*")].filter(
            (t) =>
              vis(t) &&
              [...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) &&
              t.getBoundingClientRect().left > o.r.right - 5
          );
          if (!leaves.length) continue;
          const tb = leaves.map((t) => t.getBoundingClientRect());
          const top = Math.min(...tb.map((x) => x.top)),
            bot = Math.max(...tb.map((x) => x.bottom));
          const st = leaves.map((t) => getComputedStyle(t));
          const fs = st.map((s) => parseFloat(s.fontSize));
          const ti = fs.indexOf(Math.max(...fs));
          const nat = o.e.tagName === "VIDEO" ? o.e.videoWidth : o.e.naturalWidth;
          rows.push({
            w: o.r.width,
            h: o.r.height,
            top: Math.min(top, o.r.top) + scrollY,
            bot: Math.max(bot, o.r.bottom) + scrollY,
            textH: bot - top,
            title: fs[ti],
            tw: +st[ti].fontWeight,
            tfam: st[ti].fontFamily,
            body: med(fs),
            meta: Math.min(...fs),
            sharp: nat ? nat / o.r.width : null,
            mid: (o.r.top + o.r.bottom) / 2 - (top + bot) / 2,
          });
        }
        if (rows.length < 3) return { n: rows.length };
        const gaps = rows
          .slice(1)
          .map((r, i) => r.top - rows[i].bot)
          .filter((g) => g > 0 && g < 200);
        const serif = (f) =>
          (/serif/i.test(f) && !/sans/i.test(f)) || /georgia|times|garamond|palatino|merriweather|source serif|charter|lora|crimson/i.test(f);
        const h2 = [...document.querySelectorAll("h1, h2, h3")].filter(vis).map((e) => parseFloat(getComputedStyle(e).fontSize));
        return {
          n: rows.length,
          thumbW: med(rows.map((r) => r.w)),
          thumbH: med(rows.map((r) => r.h)),
          ratio: med(rows.map((r) => r.textH / r.h)),
          gap: med(gaps),
          title: med(rows.map((r) => r.title)),
          tw: med(rows.map((r) => r.tw)),
          serifTitle: serif(rows[0].tfam),
          body: med(rows.map((r) => r.body)),
          meta: med(rows.map((r) => r.meta)),
          sharp: med(rows.map((r) => r.sharp)),
          center: med(rows.map((r) => Math.abs(r.mid))),
          heading: med(h2),
          baseFont: getComputedStyle(document.body).fontFamily.split(",")[0].replace(/"/g, ""),
        };
      });
    } catch (e) {
      return { err: e.message.slice(0, 50) };
    } finally {
      await p.close();
    }
  };
  for (let i = 0; i < urls.length; i += 3) {
    const res = await Promise.all(urls.slice(i, i + 3).map(one));
    res.forEach((r, k) => console.log(JSON.stringify({ url: urls[i + k], ...r })));
  }
  await b.close();
})();
