window.MathJax = {
  tex: {
    tags: "ams",
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
  },
  options: {
    renderActions: {
      addCss: [
        200,
        function (doc) {
          const style = document.createElement("style");
          style.innerHTML = `
          .mjx-container {
            color: inherit;
          }
        `;
          document.head.appendChild(style);
        },
        "",
      ],
    },
  },
};

// Typeset a translated project body that i18n.js swapped in after MathJax's first pass.
document.addEventListener("l10n:body", function () {
  var mj = window.MathJax;
  var prose = document.querySelector(".prose");
  if (!prose || !mj || !mj.startup || !mj.startup.promise) return;
  mj.startup.promise.then(function () {
    if (mj.typesetClear) mj.typesetClear([prose]);
    return mj.typesetPromise([prose]);
  });
});
