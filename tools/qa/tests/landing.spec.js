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

  test("scroll sequence matches the approved look", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => document.querySelector(".hero-video.is-playing"));
    // Freeze the video on one frame so snapshots are deterministic
    await page.evaluate(() => { const v = document.querySelector(".hero-video"); v.pause(); v.currentTime = 2; });
    await page.waitForTimeout(400);
    const h = await page.evaluate(() => document.querySelector(".home-hero").offsetHeight);
    for (const f of [0, 0.5, 1]) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(h * f));
      await page.waitForTimeout(350);
      await expect(page).toHaveScreenshot(`landing-${f}.png`);
    }
  });

  test("rail opens and pushes the page like other pages", async ({ page, isMobile }) => {
    test.skip(isMobile, "rail is a dock on phones");
    await page.goto("/projects/");
    const projLeft = await page.evaluate(() => document.querySelector(".site-content > .page").getBoundingClientRect().left);
    await page.goto("/");
    await page.click(".hero-menu");
    // The push is a 280 ms transition: poll until the column has settled where Projects puts it
    await expect.poll(() => page.evaluate(() => document.querySelector(".site-content > .home").getBoundingClientRect().left), { timeout: 3000 })
      .toBeCloseTo(projLeft, 0);
    await expect(page.locator(".hero-menu")).toHaveCSS("opacity", "0");
  });

  test("other pages carry no hero and navigation is consistent", async ({ page }) => {
    for (const path of ["/publications/", "/projects/", "/experience/"]) {
      const r = await page.goto(path);
      expect(r.status()).toBe(200);
      expect(await page.locator(".home-hero").count()).toBe(0);
      expect(await page.locator('a[href="/#about"]').count()).toBeGreaterThan(0);
    }
  });

  test("rail marks Home in the hero and About once scrolled to it", async ({ page, isMobile }) => {
    test.skip(isMobile, "rail is a dock on phones");
    const active = () => page.evaluate(() => Array.from(document.querySelectorAll(".rail-nav li.active")).map((li) => li.dataset.railSection));
    await page.goto("/");
    await page.waitForFunction(() => document.querySelector(".hero-video.is-playing"));
    expect(await active()).toEqual(["hero"]);
    await page.evaluate(() => document.getElementById("about").scrollIntoView());
    await expect.poll(active).toEqual(["about"]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(active).toEqual(["hero"]);
    await page.goto("/#about");
    await expect.poll(active).toEqual(["about"]);
    await page.goto("/projects/");
    expect(await active()).toEqual([]);
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
