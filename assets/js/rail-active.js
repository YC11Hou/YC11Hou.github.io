// Home and About are both on the landing page, so their rail items are switched by scroll position:
// Home while the hero is in view, About once #about has reached the upper half of the viewport.
(function () {
  var about = document.getElementById("about");
  var home = document.querySelector('.rail-nav [data-rail-section="hero"]');
  var aboutItem = document.querySelector('.rail-nav [data-rail-section="about"]');
  if (!about || !home || !aboutItem) return;

  var current = null;
  function mark(item, on) {
    item.classList.toggle("active", on);
    var a = item.querySelector("a");
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  function update() {
    var next = about.getBoundingClientRect().top <= window.innerHeight * 0.5 ? "about" : "hero";
    if (next === current) return;
    current = next;
    mark(home, next === "hero");
    mark(aboutItem, next === "about");
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; update(); });
  }, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("hashchange", update);
  update();
})();
