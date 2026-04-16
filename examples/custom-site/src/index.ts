import { createMarkdownWorker } from "@adhenawer-pkg/markdown-edge-for-agents";

export default createMarkdownWorker({
  preset: "custom",
  selector: "article",
  strip: [".ad", "nav", "footer", ".newsletter"],
  frontmatter: ["title", "author", "description", "lang"],
  redirects: {
    "/old-path/*": "/new-path/$1",
  },
});
