module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/downloads");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/fonts");
  eleventyConfig.addPassthroughCopy({ "src/web.config": "web.config" });
  eleventyConfig.addPassthroughCopy({ "src/.htaccess": ".htaccess" });

  return {
    dir: {
      input: "src",
      output: "build",
      includes: "_includes",
      layouts: "_includes",
    },
    htmlTemplateEngine: false,
    markdownTemplateEngine: "njk",
  };
};
