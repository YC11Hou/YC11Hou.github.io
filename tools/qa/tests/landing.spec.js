const { test, expect } = require("@playwright/test");

const probe = () => {
  const v = document.querySelector(".hero-video");
  if (!v) return null;
  const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : {};
  return { src: v.currentSrc.split("/").pop(), t: v.currentTime, paused: v.paused, w: v.videoWidth,
    total: q.totalVideoFrames || 0, dropped: q.droppedVideoFrames || 0, playing: v.classList.contains("is-playing") };
};

test.describe("landing page", () => {
  test("hero video starts quickly and keeps playing", async ({ page }) => {
    const t0 = Date.now();
    await page.goto("/");
    await page.waitForFunction(() => { const v = document.querySelector(".hero-video"); return v && v.classList.contains("is-playing") && v.currentTime > 0.05; }, null, { timeout: 15_000 });
    const start = (Date.now() - t0) / 1000;
    test.info().annotations.push({ type: "first-frame-s", description: String(start) });
    await page.waitForTimeout(4000);
    const p = await page.evaluate(probe);
    expect(p.paused).toBe(false);
    expect(p.t).toBeGreaterThan(3);
    // Dropped frames are asserted in qa.py (real Chrome, hardware decode); the headless shell
    // decodes in software, so here they are only recorded
    test.info().annotations.push({ type: "dropped-ratio", description: (p.dropped / Math.max(1, p.total)).toFixed(3) + " on " + p.src });
    expect(start).toBeLessThan(4);
  });

  test("landing matches the approved look", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => document.querySelector(".hero-video.is-playing"));
    // Freeze the video on one frame so snapshots are deterministic
    await page.evaluate(() => { const v = document.querySelector(".hero-video"); v.pause(); v.currentTime = 2; });
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot("landing.png");
  });

  test("rail opens and pushes the page like other pages", async ({ page, isMobile }) => {
    test.skip(isMobile, "rail is a dock on phones");
    await page.goto("/projects/");
    const projLeft = await page.evaluate(() => document.querySelector(".site-main").getBoundingClientRect().left);
    await page.goto("/");
    await page.click(".hero-menu");
    // The push is a 280 ms transition: poll until the hero has settled where Projects puts its column
    await expect.poll(() => page.evaluate(() => document.querySelector(".site-main").getBoundingClientRect().left), { timeout: 3000 })
      .toBeCloseTo(projLeft, 0);
    await expect(page.locator(".hero-menu")).toHaveCSS("opacity", "0");
  });

  test("other pages carry no hero and navigation is consistent", async ({ page }) => {
    for (const path of ["/about/", "/publications/", "/projects/", "/experience/"]) {
      const r = await page.goto(path);
      expect(r.status()).toBe(200);
      expect(await page.locator(".home-hero").count()).toBe(0);
      expect(await page.locator('a[href="/about/"]').count()).toBeGreaterThan(0);
    }
  });

  test("About is a page like the others: same head offset, and the nav marks exactly it", async ({ page, isMobile }) => {
    const nav = isMobile ? ".mobile-bottom-nav-item" : ".rail-nav li";
    const active = () => page.evaluate((sel) => Array.from(document.querySelectorAll(sel + ".active")).map((e) => e.querySelector("[data-i18n]").getAttribute("data-i18n")), nav);
    const headTop = () => page.evaluate(() => document.querySelector(".page-head .eyebrow").getBoundingClientRect().top);
    await page.goto("/projects/");
    const ref = await headTop();
    await page.goto("/about/");
    expect(await headTop()).toBeCloseTo(ref, 0);
    expect(ref).toBeGreaterThan(16);
    expect(await active()).toEqual(["ui.about"]);
    expect(await page.locator("#about #bio p").count()).toBe(3);
    await page.goto("/");
    expect(await active()).toEqual(["ui.home"]);
    expect(await page.locator("#about").count()).toBe(0);
    // Nothing scrolls beneath the hero
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(1);
  });

  test("a paper opens the same project page from Publications and from Projects", async ({ page }) => {
    await page.goto("/publications/");
    const fromPubs = await page.evaluate(() => Array.from(document.querySelectorAll(".bibliography .title a")).map((a) => [a.textContent.trim(), a.getAttribute("href")]));
    expect(fromPubs.length).toBeGreaterThan(0);
    await page.goto("/projects/");
    const projectHrefs = await page.evaluate(() => Array.from(document.querySelectorAll(".proj-title a")).map((a) => a.getAttribute("href")));
    for (const [, href] of fromPubs) expect(projectHrefs).toContain(href);
    // The first-author paper carries its IROS 2026 poster
    await page.goto("/publications/");
    const poster = page.locator('a[href="/assets/pdf/LangGap-IROS2026-poster.pdf"]');
    expect(await poster.count()).toBe(1);
    const r = await page.request.get(await poster.getAttribute("href"));
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("pdf");
  });

  // Guards the inlined theme script: a minifier bug once stripped it from the production build
  for (const scheme of ["light", "dark"]) {
    test(`colours follow the system ${scheme} preference`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      const [r, g, b] = await page.evaluate(() => getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number));
      const luma = (r + g + b) / 3;
      expect(scheme === "dark" ? luma < 80 : luma > 200).toBe(true);
      await ctx.close();
    });
  }
});
