import { describe, expect, it } from "vitest";
import { userConfigSchema } from "../../../src/config/schema.js";

describe("userConfigSchema", () => {
  it("accepts minimal valid config", () => {
    const result = userConfigSchema.safeParse({
      preset: "custom",
      selector: "article",
    });
    expect(result.success).toBe(true);
  });

  it("accepts full config", () => {
    const result = userConfigSchema.safeParse({
      preset: "astro",
      selector: "article",
      strip: [".ad", "nav"],
      frontmatter: ["title", "author"],
      redirects: { "/old/*": "/new/$1" },
      forceMarkdownForUserAgents: [/GPTBot/i],
      cache: { maxAge: 3600, staleWhileRevalidate: 86400 },
      debug: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown preset", () => {
    const result = userConfigSchema.safeParse({ preset: "wordpress", selector: "article" });
    expect(result.success).toBe(false);
  });

  it("rejects negative cache maxAge", () => {
    const result = userConfigSchema.safeParse({
      preset: "custom",
      selector: "article",
      cache: { maxAge: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects too many strip selectors", () => {
    const strip = Array(101).fill(".x");
    const result = userConfigSchema.safeParse({ preset: "custom", selector: "article", strip });
    expect(result.success).toBe(false);
  });
});
