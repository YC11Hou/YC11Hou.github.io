// In-page index ("On this page").
//
// Long, structured pages get a vertical index built from their headings:
// a sticky column to the right of the content on desktop, a collapsible list
// under the page head on narrow screens. Two levels (h2 → h3). The entry for
// the section in view is highlighted. Labels follow the current language:
// they are re-read from the headings whenever i18n.js applies a dictionary.
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

  function slug(text) {
    return (
      text
        .toLowerCase()
        .replace(/[^\w一-鿿Ѐ-ӿ]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "section"
    );
  }

  function labelOf(h) {
    // Prefer the translatable span; drop the "02 — " index and any trailing "All …" link
    var src = h.querySelector("[data-i18n]") || h;
    return src.textContent
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\d+\s*[—–-]\s*/, "");
  }

  // Stable ids: reuse the enclosing <section id> when the heading is its title
  var used = {};
  headings.forEach(function (h) {
    var sec = h.closest("section[id]");
    var target = sec && sec.querySelector(levels[0]) === h ? sec : h;
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

  // ---- build ---------------------------------------------------------------
  var nav = document.createElement("nav");
  nav.className = "pagenav";
  nav.setAttribute("aria-label", "On this page");

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "pagenav-toggle";
  toggle.setAttribute("aria-expanded", "false");
  var title = document.createElement("span");
  title.className = "pagenav-title";
  title.setAttribute("data-i18n", "ui.on_this_page");
  title.textContent = "On this page";
  toggle.appendChild(title);
  var chevron = document.createElement("i");
  chevron.className = "fa-solid fa-chevron-down pagenav-chevron";
  chevron.setAttribute("aria-hidden", "true");
  toggle.appendChild(chevron);
  nav.appendChild(toggle);

  var list = document.createElement("ol");
  list.className = "pagenav-list";
  nav.appendChild(list);

  var links = headings.map(function (h) {
    var li = document.createElement("li");
    var sub = !h.matches(levels[0]);
    li.className = sub ? "pagenav-sub" : "pagenav-top";
    var a = document.createElement("a");
    a.href = "#" + h.getAttribute("data-pagenav-target");
    a.textContent = labelOf(h);
    li.appendChild(a);
    list.appendChild(li);
    return a;
  });

  root.classList.add("has-pagenav");
  // Desktop: a column beside the content. Narrow screens: right under the page head.
  var head = root.querySelector(".page-head, .home-opening");
  if (window.matchMedia("(max-width: 1199.98px)").matches && head) {
    head.insertAdjacentElement("afterend", nav);
  } else {
    root.appendChild(nav);
  }

  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  list.addEventListener("click", function (e) {
    if (e.target.closest("a")) {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  // ---- offsets -------------------------------------------------------------
  function topbarHeight() {
    var tb = document.querySelector(".site-topbar");
    return tb && getComputedStyle(tb).display !== "none" ? tb.offsetHeight : 0;
  }
  function layout() {
    var clear = topbarHeight() + 20;
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

  // ---- active entry ----------------------------------------------------------
  var ticking = false;
  function update() {
    ticking = false;
    var line = clearance + 8;
    var current = 0;
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top - line <= 0) current = i;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = headings.length - 1;
    links.forEach(function (a, i) {
      a.classList.toggle("active", i === current);
    });
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

  document.addEventListener("i18n:applied", function () {
    links.forEach(function (a, i) {
      a.textContent = labelOf(headings[i]);
    });
    clearance = layout();
  });
})();
