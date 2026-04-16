export const astroPreset = {
  selector: "article, main[data-page-type='post'], main.content",
  strip: [
    "nav",
    "header:not(article header)",
    "footer",
    "aside",
    "script",
    "style",
    "[aria-hidden='true']",
  ],
  frontmatter: ["title", "author", "description", "pubDate"],
} as const;
