import { describe, it, expect } from "vitest";
import { buildFrontmatter } from "../../../src/converter/frontmatter.js";

describe("buildFrontmatter", () => {
  it("builds YAML frontmatter from fields", () => {
    const out = buildFrontmatter({
      title: "Post",
      author: "a",
      description: "d",
      lang: "en",
      source: "https://x.com/p",
    });
    expect(out).toContain("---\n");
    expect(out).toContain('title: "Post"');
    expect(out).toContain('author: "a"');
    expect(out).toContain('source: "https://x.com/p"');
    expect(out).toContain("lang: en");
    expect(out.endsWith("---\n\n")).toBe(true);
  });

  it("skips empty fields", () => {
    const out = buildFrontmatter({
      title: "X",
      author: "",
      description: "",
      lang: "en",
      source: "s",
    });
    expect(out).not.toContain("author:");
    expect(out).not.toContain("description:");
  });

  it("escapes quotes in strings", () => {
    const out = buildFrontmatter({
      title: 'He said "hi"',
      author: "",
      description: "",
      lang: "en",
      source: "s",
    });
    expect(out).toContain('title: "He said \\"hi\\""');
  });
});
