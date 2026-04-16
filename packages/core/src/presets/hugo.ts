export const hugoPreset = {
  selector: "article, main .post-content, main.single",
  strip: [
    "nav",
    "header.site-header",
    "footer",
    "aside",
    "script",
    "style",
    ".post-nav",
    ".social-share",
  ],
  frontmatter: ["title", "author", "description", "date"],
} as const;
