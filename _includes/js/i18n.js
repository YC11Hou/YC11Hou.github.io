// Client-side localisation.
//
// The HTML is authored in English. Every translatable node carries
// data-i18n="dotted.key"; this script picks a language, fetches
// /assets/i18n/<lang>.json (generated from _data/i18n/<lang>.yml) and swaps
// the text in place. Dates carry ISO values in data attributes and are
// re-rendered with Intl for the chosen locale.
//
// Language choice, in order:
//   1. a language the visitor picked in the switcher (localStorage)
//   2. the browser's preferred languages (navigator.languages)
//   3. if that yields nothing, or only English: the visitor's country by IP
//      (mainland China → 中文, France → français, …), cached per session
//   4. English
(function () {
  var html = document.documentElement;
  var BASE = html.getAttribute("data-baseurl") || "";
  var LANGS = (html.getAttribute("data-languages") || "en").split(",");
  var DEFAULT = "en";

  // Country → language, for the IP fallback. Only countries whose dominant
  // language we actually ship; everyone else gets English.
  var COUNTRY = {
    CN: "zh",
    HK: "zh",
    MO: "zh",
    TW: "zh",
    FR: "fr",
    BE: "fr",
    LU: "fr",
    MC: "fr",
    DE: "de",
    AT: "de",
    CH: "de",
    LI: "de",
    ES: "es",
    MX: "es",
    AR: "es",
    CO: "es",
    CL: "es",
    PE: "es",
    UY: "es",
    VE: "es",
    EC: "es",
    IT: "it",
    SM: "it",
    VA: "it",
    PT: "pt",
    BR: "pt",
    AO: "pt",
    MZ: "pt",
    NL: "nl",
    PL: "pl",
    SE: "sv",
    RU: "ru",
    BY: "ru",
    KZ: "ru",
    KG: "ru",
  };

  // IP → country services. Free, keyless, CORS-enabled, and — importantly —
  // reachable from mainland China. First to answer wins; 2.5 s budget.
  var GEO_ENDPOINTS = [
    {
      url: "https://get.geojs.io/v1/ip/country.json",
      pick: function (j) {
        return j.country;
      },
    },
    {
      url: "https://ipwho.is/?fields=country_code",
      pick: function (j) {
        return j.country_code;
      },
    },
    {
      url: "https://api.ip.sb/geoip",
      pick: function (j) {
        return j.country_code;
      },
    },
  ];

  var dicts = {};
  var current = DEFAULT;

  function store(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      /* private mode */
    }
  }
  function read(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function sread(k) {
    try {
      return sessionStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function sstore(k, v) {
    try {
      sessionStorage.setItem(k, v);
    } catch (e) {
      /* private mode */
    }
  }

  function supported(code) {
    if (!code) return null;
    code = String(code).toLowerCase();
    var base = code.split("-")[0];
    return LANGS.indexOf(base) >= 0 ? base : null;
  }

  function fromBrowser() {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (var i = 0; i < list.length; i++) {
      var s = supported(list[i]);
      if (s) return s;
    }
    return null;
  }

  function fetchJSON(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var t = setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error("timeout"));
      }, timeoutMs);
      fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: "no-store" })
        .then(function (r) {
          return r.ok ? r.json() : Promise.reject(new Error(r.status));
        })
        .then(
          function (j) {
            clearTimeout(t);
            resolve(j);
          },
          function (e) {
            clearTimeout(t);
            reject(e);
          }
        );
    });
  }

  function geoLanguage() {
    var cached = read("geo-lang");
    if (cached) return Promise.resolve(cached === "none" ? null : cached);
    var attempts = GEO_ENDPOINTS.map(function (ep) {
      return fetchJSON(ep.url, 2500).then(function (j) {
        var cc = ep.pick(j);
        if (!cc) throw new Error("no country");
        return String(cc).toUpperCase();
      });
    });
    // first successful answer wins
    return new Promise(function (resolve) {
      var pending = attempts.length;
      var done = false;
      attempts.forEach(function (p) {
        p.then(
          function (cc) {
            if (done) return;
            done = true;
            var lang = COUNTRY[cc] || null;
            store("geo-lang", lang || "none");
            resolve(lang);
          },
          function () {
            if (--pending === 0 && !done) {
              done = true;
              // don't persist a failure: try again next visit

              resolve(null);
            }
          }
        );
      });
    });
  }

  function getPath(obj, path) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  var BUILD = html.getAttribute("data-build") || "0";

  function cachedDict(lang) {
    if (dicts[lang]) return dicts[lang];
    try {
      var raw = localStorage.getItem("i18n:" + lang);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (obj.build !== BUILD) return null;
      dicts[lang] = obj.dict;
      return obj.dict;
    } catch (e) {
      return null;
    }
  }

  function loadDict(lang) {
    var hit = cachedDict(lang);
    if (hit) return Promise.resolve(hit);
    return fetchJSON(BASE + "/assets/i18n/" + lang + ".json", 6000).then(function (d) {
      dicts[lang] = d;
      try {
        localStorage.setItem("i18n:" + lang, JSON.stringify({ build: BUILD, dict: d }));
      } catch (e) {
        /* quota / private mode */
      }
      return d;
    });
  }

  function fmtDate(iso, lang, withDay) {
    var parts = iso.split("-").map(Number);
    var d = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1));
    var opts = withDay ? { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" } : { year: "numeric", month: "short", timeZone: "UTC" };
    try {
      return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : lang, opts).format(d);
    } catch (e) {
      return iso;
    }
  }

  function applyDates(lang, dict) {
    var nodes = document.querySelectorAll("[data-date]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = fmtDate(nodes[i].getAttribute("data-date"), lang, true);
    }
    var spans = document.querySelectorAll("[data-start]");
    var present = (dict && getPath(dict, "ui.present")) || "Present";
    for (var j = 0; j < spans.length; j++) {
      var el = spans[j];
      var withDay = el.hasAttribute("data-day");
      var s = fmtDate(el.getAttribute("data-start"), lang, withDay);
      var endIso = el.getAttribute("data-end");
      var e = !endIso || endIso === "present" ? present : fmtDate(endIso, lang, withDay);
      el.innerHTML = el.hasAttribute("data-inline") ? s + " – " + e : s + "<br>— " + e;
    }
  }

  function translateTree(root, dict) {
    var nodes = root.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var val = getPath(dict, nodes[i].getAttribute("data-i18n"));
      if (typeof val === "string") nodes[i].innerHTML = val;
    }
    var attrNodes = root.querySelectorAll("[data-i18n-attr]");
    for (var k = 0; k < attrNodes.length; k++) {
      var spec = attrNodes[k].getAttribute("data-i18n-attr").split(";");
      for (var m = 0; m < spec.length; m++) {
        var pair = spec[m].split(":");
        if (pair.length !== 2) continue;
        var v = getPath(dict, pair[1].trim());
        if (typeof v === "string") attrNodes[k].setAttribute(pair[0].trim(), v.replace(/<[^>]+>/g, ""));
      }
    }
  }

  function applyDict(lang, dict) {
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-i18n");
      var val = getPath(dict, key);
      if (typeof val === "string") el.innerHTML = val;
    }
    var attrNodes = document.querySelectorAll("[data-i18n-attr]");
    for (var k = 0; k < attrNodes.length; k++) {
      var spec = attrNodes[k].getAttribute("data-i18n-attr").split(";");
      for (var m = 0; m < spec.length; m++) {
        var pair = spec[m].split(":");
        if (pair.length !== 2) continue;
        var v = getPath(dict, pair[1].trim());
        if (typeof v === "string") attrNodes[k].setAttribute(pair[0].trim(), v.replace(/<[^>]+>/g, ""));
      }
    }
    applyDates(lang, dict);
    html.setAttribute("lang", lang === "zh" ? "zh-CN" : lang);
    html.setAttribute("data-lang", lang);
    var labels = document.querySelectorAll(".lang-current");
    for (var n = 0; n < labels.length; n++) labels[n].textContent = lang.toUpperCase();
    var opts = document.querySelectorAll(".lang-list [data-lang]");
    for (var o = 0; o < opts.length; o++) {
      var on = opts[o].getAttribute("data-lang") === lang;
      opts[o].setAttribute("aria-selected", on ? "true" : "false");
    }
    current = lang;
    document.dispatchEvent(new CustomEvent("i18n:applied", { detail: { lang: lang } }));
  }

  function reveal() {
    html.removeAttribute("data-i18n-pending");
  }

  function setLanguage(lang, persist) {
    lang = supported(lang) || DEFAULT;
    if (persist) store("lang", lang);
    return loadDict(lang).then(
      function (d) {
        applyDict(lang, d);
        reveal();
      },
      function () {
        // dictionary missing or offline: stay with whatever is on the page
        reveal();
      }
    );
  }

  // ---- switcher UI -------------------------------------------------------
  function wireSwitcher() {
    var menus = document.querySelectorAll(".lang-menu");
    Array.prototype.forEach.call(menus, function (menu) {
      var btn = menu.querySelector(".lang-btn");
      var list = menu.querySelector(".lang-list");
      if (!btn || !list) return;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = !list.hidden;
        closeAll();
        if (!open) {
          list.hidden = false;
          btn.setAttribute("aria-expanded", "true");
        }
      });
      list.addEventListener("click", function (e) {
        var opt = e.target.closest("[data-lang]");
        if (!opt) return;
        setLanguage(opt.getAttribute("data-lang"), true);
        closeAll();
      });
    });
    function closeAll() {
      Array.prototype.forEach.call(document.querySelectorAll(".lang-list"), function (l) {
        l.hidden = true;
      });
      Array.prototype.forEach.call(document.querySelectorAll(".lang-btn"), function (b) {
        b.setAttribute("aria-expanded", "false");
      });
    }
    document.addEventListener("click", closeAll);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAll();
    });
  }

  // ---- boot --------------------------------------------------------------
  // Order of authority: the visitor's explicit pick → the browser's language
  // list (what the person configured on their device — the professional
  // standard, and the only signal that is right for expats and multilingual
  // countries) → the country by IP, used only when the browser lists none of
  // the languages we ship → English.
  var picked = supported(read("lang"));
  var browser = fromBrowser();
  var geoKnown = read("geo-lang");
  var initial = picked || browser || (geoKnown && geoKnown !== "none" ? geoKnown : null);

  // Keep content hidden until the dictionary is applied so nothing flashes in
  // English first. With the dictionary cached this happens before first paint;
  // a 1.6 s valve guarantees the page never stays hidden.
  if (initial && initial !== DEFAULT) html.setAttribute("data-i18n-pending", "");
  setTimeout(reveal, 1600);

  function boot() {
    wireSwitcher();
    if (initial) {
      setLanguage(initial, false);
      return;
    }
    // The browser lists no language we ship: fall back to the country, once.
    reveal();
    geoLanguage().then(function (geo) {
      if (geo && geo !== DEFAULT) setLanguage(geo, false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.siteI18n = {
    t: function (key) {
      var d = dicts[current];
      var v = d ? getPath(d, key) : undefined;
      return typeof v === "string" ? v : null;
    },
    translate: function (el) {
      var d = dicts[current];
      if (d && el) translateTree(el, d);
    },
    set: function (l) {
      return setLanguage(l, true);
    },
    current: function () {
      return current;
    },
  };
})();
