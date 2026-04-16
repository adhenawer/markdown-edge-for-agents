import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { convertHtmlToMarkdown } from "../../src/converter/index.js";
import { buildFrontmatter } from "../../src/converter/frontmatter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("converter integration", () => {
  it("converts adhenawer fixture end-to-end with frontmatter", async () => {
    const html = fixtures("adhenawer-post.html");
    const result = await convertHtmlToMarkdown(html, {
      selector: "article",
      strip: [".theme-bar", "nav", "script"],
      frontmatter: ["title", "author", "description", "lang"],
    });
    expect(result).not.toBeNull();
    expect(result!.markdown).toContain("# Título do Post");
    expect(result!.markdown).toContain("**destaque**");
    expect(result!.markdown).not.toContain("skip");
    expect(result!.meta.title).toBe("Teste Fixture");
    expect(result!.meta.lang).toBe("pt-BR");

    const fm = buildFrontmatter({
      title: result!.meta.title,
      author: result!.meta.author,
      description: result!.meta.description,
      lang: result!.meta.lang,
      source: "https://adhenawer.net/posts/test",
    });
    const full = fm + result!.markdown;
    expect(full.startsWith("---\n")).toBe(true);
    expect(full).toContain('title: "Teste Fixture"');
  });

  it("converts astro fixture with astro-style strip", async () => {
    const html = fixtures("astro-post.html");
    const result = await convertHtmlToMarkdown(html, {
      selector: "article, main[data-page-type='post'], main.content",
      strip: ["nav", "aside", "footer", "script"],
      frontmatter: ["title", "author"],
    });
    expect(result).not.toBeNull();
    expect(result!.markdown.length).toBeGreaterThan(50);
    expect(result!.meta.title).toContain("Astro Blog Post");
  });

  it("converts hugo fixture with hugo-style strip", async () => {
    const html = fixtures("hugo-post.html");
    const result = await convertHtmlToMarkdown(html, {
      selector: "article, main .post-content, main.single",
      strip: ["nav", "footer", ".social-share", ".post-nav"],
      frontmatter: ["title", "author"],
    });
    expect(result).not.toBeNull();
    expect(result!.markdown).toContain("# Deploy Hugo to the Edge");
    expect(result!.markdown).not.toContain("Tweet");
  });
});
