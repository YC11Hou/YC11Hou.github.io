#!/usr/bin/env node
// List-rhythm check: every list on the site must share one item spec (see $item-* in _sass/_variables.scss).
// Checks: no text under 14px inside an item, experience dates on the title baseline, one title size, one gap between meta line and title, one text size, one row padding, every row ruled, thumbnails centred
// between the rules (<= 1px), text block / thumbnail height in range, no horizontal overflow.
// Usage: node tools/qa/rhythm.js <base url> [--ref url ...]
// Runs each listing page at desktop and phone width, en and zh, light and dark; exits 1 on any failure.
const { chromium } = require("./node_modules/playwright");

const PAGES = ["/about/", "/projects/", "/publications/", "/experience/"];
const ITEMS = ".proj-row, .publications ol.bibliography > li, .xp-entry, .work-tile";
const TITLE = ".proj-title, .publications .title, .xp-title, .work-title";
const TEXT = ".proj-desc, .publications .author, .xp-highlights, .work-desc";
const VIEWS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1100, height: 800 },
  { name: "phone", width: 390, height: 844 },
];
const RATIO = [0.75, 1.3]; // text block height / thumbnail height, desktop rows

function measure({ ITEMS, TITLE, TEXT }) {
  const px = (e, p) => parseFloat(getComputedStyle(e)[p]);
  const rows = [...document.querySelectorAll(ITEMS)].filter((it) => it.offsetParent && !it.matches(".work-tile"));
  const pads = new Set(),
    offsets = [],
    ratios = [],
    unruled = [],
    heads = new Set(),
    tiny = new Set(),
    baselines = [];
  for (const it of rows) {
    const b = it.getBoundingClientRect();
    pads.add(px(it, "paddingTop")).add(px(it, "paddingBottom"));
    if (!px(it, "borderTopWidth")) unruled.push(it.className || it.tagName);
    // Every text line inside an item is at least 14px (badges excepted), like the reference sites
    for (const t of it.querySelectorAll("*"))
      if (
        t.offsetParent &&
        !t.closest(".pub-venue, .pub-cites") &&
        [...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
        px(t, "fontSize") < 14
      )
        tiny.add(`${t.className || t.tagName}:${px(t, "fontSize")}`);
    const title = it.querySelector(".proj-title, .title");
    const head = it.querySelector(".proj-head, .pub-head");
    if (title && head) heads.add(Math.round(title.getBoundingClientRect().top - head.getBoundingClientRect().bottom));
    if (head && head.getBoundingClientRect().height < 22) heads.add("short meta line");
    // Experience: the first date line sits on the title's baseline
    const when = it.querySelector(".xp-when"),
      xt = it.querySelector(".xp-title");
    if (when && xt && when.getBoundingClientRect().right < xt.getBoundingClientRect().left) {
      const base = (el) => {
        const s = document.createElement("span");
        s.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
        el.insertBefore(s, el.firstChild);
        const y = s.getBoundingClientRect().top;
        s.remove();
        return y;
      };
      baselines.push(+(base(when) - base(xt)).toFixed(1));
    }
    const media = it.querySelector(".proj-media, .pub-media");
    if (!media) continue;
    // Side-by-side rows only (phones stack the thumbnail above the text): thumbnail centred between the rules
    const m = media.getBoundingClientRect();
    const body = it.querySelector(".proj-body") || it.querySelector(".pub-head")?.parentElement;
    if (body && m.right < body.getBoundingClientRect().left) {
      const top = b.top + px(it, "borderTopWidth"),
        bot = b.bottom - px(it, "borderBottomWidth");
      offsets.push(+((m.top + m.bottom) / 2 - (top + bot) / 2).toFixed(1));
      const kids = [...body.children].filter((c) => c.offsetParent && c.getBoundingClientRect().height);
      const h = kids.at(-1).getBoundingClientRect().bottom - kids[0].getBoundingClientRect().top;
      ratios.push(+(h / m.height).toFixed(2));
    }
  }
  const sizes = (s) => [...new Set([...document.querySelectorAll(s)].filter((e) => e.offsetParent).map((e) => px(e, "fontSize")))];
  return {
    items: rows.length,
    heads: [...heads],
    tiny: [...tiny],
    baselines,
    title: sizes(TITLE),
    text: sizes(TEXT),
    gaps: [...pads],
    offsets,
    ratios,
    unruled,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
}

(async () => {
  const args = process.argv.slice(2);
  const base = args[0].replace(/\/$/, "");
  const browser = await chromium.launch({ args: ["--no-proxy-server"] });
  let fail = 0;
  const all = { title: new Set(), text: new Set(), gaps: new Set() };
  for (const v of VIEWS)
    for (const locale of ["en-US", "zh-CN"])
      for (const scheme of ["light", "dark"]) {
        const ctx = await browser.newContext({ viewport: v, locale, colorScheme: scheme });
        const page = await ctx.newPage();
        for (const path of PAGES) {
          await page.goto(base + path + (base.startsWith("https") ? "?v=" + Date.now() : ""), { waitUntil: "load" });
          await page.waitForTimeout(600);
          const r = await page.evaluate(measure, { ITEMS, TITLE, TEXT });
          const bad = [];
          if (r.title.length > 1) bad.push("title sizes " + r.title);
          if (r.text.length > 1) bad.push("text sizes " + r.text);
          if (r.gaps.length > 1) bad.push("row paddings " + r.gaps);
          r.baselines.filter((d) => Math.abs(d) > 1).forEach((d) => bad.push("date/title baseline " + d + "px"));
          if (r.tiny.length) bad.push("text under 14px: " + r.tiny.join(","));
          if (r.heads.length > 1) bad.push("meta-to-title gaps " + r.heads);
          if (r.unruled.length) bad.push("rows without divider rule: " + [...new Set(r.unruled)]);
          r.offsets.filter((o) => Math.abs(o) > 1).forEach((o) => bad.push("thumbnail off-centre " + o + "px"));
          if (r.overflow) bad.push("horizontal overflow");
          if (v.name === "desktop") r.ratios.filter((x) => x < RATIO[0] || x > RATIO[1]).forEach((x) => bad.push("text/thumb " + x));
          r.title.forEach((x) => all.title.add(x));
          r.text.forEach((x) => all.text.add(x));
          r.gaps.forEach((x) => all.gaps.add(`${v.name}:${x}`));
          fail += bad.length;
          console.log(
            `${bad.length ? "FAIL" : "ok  "} ${v.name.padEnd(7)} ${locale} ${scheme.padEnd(5)} ${path.padEnd(15)} items=${r.items} title=${r.title} text=${r.text} pad=${r.gaps} centre=${r.offsets} ratio=${r.ratios} ${bad.join("; ")}`
          );
        }
        await ctx.close();
      }
  // Site-wide: one title size, one text size, one item gap per width
  const views = new Set([...all.gaps].map((g) => g.split(":")[0]));
  const site = [];
  if (all.title.size > 2) site.push("title sizes across pages " + [...all.title]);
  if (all.text.size > 2) site.push("text sizes across pages " + [...all.text]);
  if (all.gaps.size > views.size) site.push("row paddings across pages " + [...all.gaps]);
  fail += site.length;
  console.log(
    site.length ? "FAIL site-wide: " + site.join("; ") : `ok   site-wide: title=${[...all.title]} text=${[...all.text]} gaps=${[...all.gaps]}`
  );
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
