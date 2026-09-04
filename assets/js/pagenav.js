// In-page section navigation.
//
// Long, structured pages (Projects, Experience, project write-ups, the home
// page) get a sticky bar of section chips built from their headings. Clicking
// a chip scrolls to the section; the chip for the section in view is
// highlighted. Labels follow the current language: they are re-read from the
// headings whenever i18n.js finishes applying a dictionary.
(function () {
  var root = document.querySelector(".site-content");
  if (!root) return;
  var host = root.querySelector("[data-pagenav]");
  if (!host) return;

  var levels = (host.getAttribute("data-pagenav") || "h2").split(",").map(function (s) {
    return s.trim();
  });
  var headings = Array.prototype.slice.call(host.querySelectorAll(levels.join(","))).filter(function (h) {
    return h.closest(".page-head, .home-opening, .pagenav") === null && h.textContent.trim().length > 0;
  });
  if (headings.length < 2) return;

  var anchor = root.querySelector("[data-pagenav-anchor]") || root.querySelector(".page-head") || root.querySelector(".home-opening");
  if (!anchor) return;

  function slug(text) {
    return (
      text
        .toLowerCase()
        .replace(/<[^>]+>/g, "")
        .replace(/[^\w一-鿿Ѐ-ӿ]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "section"
    );
  }

  function labelOf(h) {
    // Prefer the translatable span; drop the "02 — " index and any trailing "All …" link
    var src = h.querySelector("[data-i18n]") || h;
    var text = src.textContent.replace(/\s+/g, " ").trim();
    return text.replace(/^\d+\s*[—–-]\s*/, "");
  }

  // Ensure stable ids
  var used = {};
  headings.forEach(function (h) {
    var target = h.closest("section[id]") && h.closest("section[id]").querySelector(levels[0]) === h ? h.closest("section[id]") : h;
    if (!target.id) {
      var base = slug(labelOf(h));
      var id = base;
      var n = 2;
      while (used[id] || document.getElementById(id)) id = base + "-" + n++;
      target.id = id;
    }
    used[target.id] = true;
    h.setAttribute("data-pagenav-target", target.id);
  });

  var nav = document.createElement("nav");
  nav.className = "pagenav";
  nav.setAttribute("aria-label", "On this page");
  var inner = document.createElement("div");
  inner.className = "pagenav-inner";
  nav.appendChild(inner);

  var links = headings.map(function (h) {
    var a = document.createElement("a");
    a.href = "#" + h.getAttribute("data-pagenav-target");
    a.className = "pagenav-item" + (h.tagName.toLowerCase() === levels[0] ? "" : " pagenav-sub");
    a.textContent = labelOf(h);
    inner.appendChild(a);
    return a;
  });

  anchor.insertAdjacentElement("afterend", nav);

  // Offsets: the bar sits under the mobile topbar; headings must clear both.
  function topbarHeight() {
    var tb = document.querySelector(".site-topbar");
    return tb && getComputedStyle(tb).display !== "none" ? tb.offsetHeight : 0;
  }
  function layout() {
    var top = topbarHeight();
    nav.style.top = top + "px";
    var clear = top + nav.offsetHeight + 12;
    headings.forEach(function (h) {
      var t = document.getElementById(h.getAttribute("data-pagenav-target"));
      if (t) t.style.scrollMarginTop = clear + "px";
    });
    return clear;
  }
  var clearance = layout();
  window.addEventListener("resize", function () {
    clearance = layout();
  });

  // Active chip = last heading above the reading line
  var ticking = false;
  function update() {
    ticking = false;
    var line = clearance + 8;
    var current = 0;
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top - line <= 0) current = i;
    }
    // At the very bottom, light the last chip
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = headings.length - 1;
    links.forEach(function (a, i) {
      a.classList.toggle("active", i === current);
    });
    var active = links[current];
    if (active && inner.scrollWidth > inner.clientWidth) {
      var r = active.getBoundingClientRect();
      var ir = inner.getBoundingClientRect();
      if (r.left < ir.left || r.right > ir.right) {
        inner.scrollTo({ left: active.offsetLeft - 16, behavior: "smooth" });
      }
    }
  }
  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();

  // Re-label after a translation lands
  document.addEventListener("i18n:applied", function () {
    links.forEach(function (a, i) {
      a.textContent = labelOf(headings[i]);
    });
    clearance = layout();
  });
})();
