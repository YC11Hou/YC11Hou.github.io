module.exports = {
  content: ["_site/**/*.html", "_site/**/*.js"],
  css: ["_site/assets/css/*.css"],
  output: "_site/assets/css/",
  skippedContentGlobs: ["_site/assets/**/*.html"],
  safelist: {
    greedy: [/projects/, /project-media/, /project-text/, /no-gutters/, /about-banner/, /quote-card/, /video-container/],
  },
};
