module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/downloads");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");

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
