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
  // Preview loops (muted autoplay) are driven by visibility: play when on
  // screen, pause when off. Mobile browsers only load them on a play()
  // attempt, and may refuse autoplay (Low Power Mode, data saver) — then the
  // poster simply stays, without a spinner.
  var io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (en) {
              var v = en.target;
              if (en.isIntersecting) attemptPlay(v);
              else if (!v.paused) v.pause();
            });
          },
          { rootMargin: "120px 0px", threshold: 0.1 }
        )
      : null;

  function attemptPlay(v) {
    if (!v.paused && !v.ended) return;
    var box = v.parentElement;
    var pr = v.play();
    if (pr && pr.then) {
      pr.then(
        function () {
          v._playable = true;
        },
        function () {
          // autoplay refused: static poster is the final state
          v._playable = false;
          box.classList.remove("is-loading");
        }
      );
    }
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

    var timer = null;
    var gaveUp = false;
    function busy(on) {
      if (gaveUp) on = false;
      box.classList.toggle("is-loading", on);
      clearTimeout(timer);
      // never spin forever: one 8 s budget per video, then the poster is final
      if (on)
        timer = setTimeout(function () {
          gaveUp = true;
          box.classList.remove("is-loading");
        }, 8000);
    }
    // Spinner only while a started playback is actually waiting for data
    v.addEventListener("waiting", function () {
      if (!v.paused) busy(true);
    });
    v.addEventListener("stalled", function () {
      if (!v.paused) busy(true);
    });
    v.addEventListener("playing", function () {
      busy(false);
    });
    v.addEventListener("canplay", function () {
      busy(false);
    });
    v.addEventListener("pause", function () {
      busy(false);
    });
    v.addEventListener("error", function () {
      busy(false);
    });

    if (v.autoplay) {
      v.removeAttribute("autoplay"); // we decide when to play
      // In-app browsers (WeChat, QQ) neither autoplay reliably nor report it
      // honestly: show the poster only, no playback attempt, no spinner.
      if (/MicroMessenger|QQ\//i.test(navigator.userAgent)) {
        v.removeAttribute("loop");
        badge.remove();
        return;
      }
      v.muted = true;
      v.setAttribute("playsinline", "");
      if (io) io.observe(v);
      else attemptPlay(v);
    }
  });

  // Publications: the "Video" link opens its own panel (and closes the abstract), not the abstract
  Array.prototype.forEach.call(document.querySelectorAll("a.video-toggle"), function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var entry = a.closest("li") || a.parentElement.parentElement;
      var panel = entry.querySelector(".video.hidden");
      var abs = entry.querySelector(".abstract.hidden");
      if (abs) abs.classList.remove("open");
      if (panel) {
        var open = panel.classList.toggle("open");
        var vid = panel.querySelector("video");
        if (vid) {
          if (open) vid.play().catch(function () {});
          else vid.pause();
        }
      }
    });
  });

  document.addEventListener("i18n:applied", function () {
    Array.prototype.forEach.call(document.querySelectorAll(".video-loading"), function (b) {
      b.textContent = label();
    });
  });
})();
