// Cross-document view transitions: tag the incoming transition with where it
// came from, so the stylesheet can pick a direction-aware animation.
(function () {
  if (!("navigation" in window)) return;
  window.addEventListener("pagereveal", function (e) {
    if (!e.viewTransition) return;
    var from = navigation.activation && navigation.activation.from;
    if (!from || !from.url) return;
    var path = new URL(from.url).pathname.replace(/index\.html$/, "");
    if (path === "/" || path === "") e.viewTransition.types.add("from-home");
  });
})();
