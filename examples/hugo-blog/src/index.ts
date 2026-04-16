import { createMarkdownWorker } from "@adhenawer-pkg/markdown-edge-for-agents";

export default createMarkdownWorker({
  preset: "hugo",
  frontmatter: ["title", "author", "description", "lang"],
  redirects: {
    "/old-path/*": "/new-path/$1",
  },
});
