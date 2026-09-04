// Sidebar collapse (ChatGPT-style): expanded = icons + labels, collapsed = icons only.
// Runs in <head> so the saved state is applied before first paint.
(function () {
  var html = document.documentElement;
  var KEY = "rail";
  function read() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }
  function store(v) {
    try {
      localStorage.setItem(KEY, v);
    } catch (e) {
      /* private mode */
    }
  }
  function apply(state) {
    html.setAttribute("data-rail", state);
    var btn = document.querySelector(".rail-collapse");
    if (btn) btn.setAttribute("aria-expanded", state === "expanded" ? "true" : "false");
  }
  apply(read() === "collapsed" ? "collapsed" : "expanded");

  function wire() {
    var btn = document.querySelector(".rail-collapse");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = html.getAttribute("data-rail") === "collapsed" ? "expanded" : "collapsed";
      html.classList.add("rail-animating");
      apply(next);
      store(next);
      setTimeout(function () {
        html.classList.remove("rail-animating");
      }, 260);
    });
    // ⌘/Ctrl + B toggles, like most sidebars
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        var tag = (document.activeElement && document.activeElement.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        btn.click();
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
