// Live Google Scholar citation counts (backend: cf/likes /scholar, via SerpAPI).
// Every [data-scholar-id] badge is rendered at build time from _data/citations.yml;
// this swaps in the live count and the "cited by" link once the Worker answers.
(function () {
  var API = document.documentElement.getAttribute("data-likes-api") || "";
  var badges = document.querySelectorAll("[data-scholar-id]");
  if (!API || !badges.length || !window.fetch) return;
  fetch(API + "/scholar")
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (data) {
      if (!data || !data.papers) return;
      Array.prototype.forEach.call(badges, function (el) {
        var p = data.papers[el.getAttribute("data-scholar-id")];
        if (!p) return;
        var n = el.querySelector(".pub-cites-n");
        if (n) n.textContent = p.citations;
        if (p.cites) el.href = "https://scholar.google.com/scholar?cites=" + p.cites;
      });
    })
    .catch(function () {});
})();
