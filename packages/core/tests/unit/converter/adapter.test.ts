import { describe, it, expect } from "vitest";
import { convertHtmlToMarkdown } from "../../../src/converter/index.js";

const baseConfig = {
  selector: "article",
  strip: [] as string[],
  frontmatter: ["title", "author", "description", "lang"] as const,
};

describe("convertHtmlToMarkdown (adapter)", () => {
  it("converts article content to markdown", async () => {
    const html = `
      <html lang="en">
        <head><title>Hello</title></head>
        <body>
          <article>
            <h1>Title</h1>
            <p>Para with <strong>bold</strong>.</p>
            <ul><li>A</li><li>B</li></ul>
          </article>
        </body>
      </html>`;
    const result = await convertHtmlToMarkdown(html, baseConfig);
    expect(result).not.toBeNull();
    expect(result!.markdown).toContain("# Title");
    expect(result!.markdown).toContain("**bold**");
    expect(result!.markdown).toContain("- A");
    expect(result!.tokens).toBeGreaterThan(0);
    expect(result!.meta.title).toBe("Hello");
  });

  it("applies strip selectors", async () => {
    const html = `<html><body><article><div class="ad">SKIP</div><p>keep</p></article></body></html>`;
    const result = await convertHtmlToMarkdown(html, {
      ...baseConfig,
      strip: [".ad"],
    });
    expect(result!.markdown).not.toContain("SKIP");
    expect(result!.markdown).toContain("keep");
  });

  it("returns null when selector does not match", async () => {
    const html = "<html><body><div>no article</div></body></html>";
    const result = await convertHtmlToMarkdown(html, baseConfig);
    expect(result).toBeNull();
  });

  it("extracts lang from html tag", async () => {
    const html = `<html lang="pt-BR"><body><article><p>Oi</p></article></body></html>`;
    const result = await convertHtmlToMarkdown(html, baseConfig);
    expect(result!.meta.lang).toBe("pt-BR");
  });
});
