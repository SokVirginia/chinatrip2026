export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src": "src" });
  eleventyConfig.addPassthroughCopy({ "data": "data" });
  eleventyConfig.addPassthroughCopy({ "sw.js": "sw.js" });

  return {
    dir: {
      input: "site",
      output: "dist"
    },
    htmlTemplateEngine: "njk"
  };
}

