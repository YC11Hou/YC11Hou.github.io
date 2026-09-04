// Video loading states — no blank boxes, ever.
// Every <video> keeps its poster visible until real frames are ready; a small
// "Loading…" badge shows whenever the browser is waiting for data (initial
// load of autoplay loops, or buffering after the user presses play).
(function () {
  var videos = document.querySelectorAll("video");
  if (!videos.length) return;
  function label() {
    var v = window.siteI18n && window.siteI18n.t("ui.loading");
    return v || "Loading…";
  }
  Array.prototype.forEach.call(videos, function (v) {
    var box = v.parentElement;
    if (!box) return;
    box.classList.add("video-shell");
    var badge = document.createElement("span");
    badge.className = "video-loading";
    badge.setAttribute("data-i18n", "ui.loading");
    badge.textContent = label();
    box.appendChild(badge);

    function busy(on) {
      box.classList.toggle("is-loading", on);
    }
    // Autoplay loops: busy until the first frames are decodable
    if (v.autoplay) busy(v.readyState < 3);
    v.addEventListener("loadeddata", function () {
      busy(false);
    });
    v.addEventListener("canplay", function () {
      busy(false);
    });
    v.addEventListener("playing", function () {
      busy(false);
    });
    v.addEventListener("waiting", function () {
      busy(true);
    });
    v.addEventListener("stalled", function () {
      busy(true);
    });
    v.addEventListener("error", function () {
      busy(false);
    });
    // Retry autoplay after data arrives (some browsers pause muted loops that started empty)
    if (v.autoplay) {
      v.addEventListener("canplay", function () {
        if (v.paused) v.play().catch(function () {});
      });
    }
  });
  document.addEventListener("i18n:applied", function () {
    Array.prototype.forEach.call(document.querySelectorAll(".video-loading"), function (b) {
      b.textContent = label();
    });
  });
})();
