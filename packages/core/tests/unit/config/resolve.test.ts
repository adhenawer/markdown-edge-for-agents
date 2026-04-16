import { describe, expect, it } from "vitest";
import { resolveConfig } from "../../../src/config/resolve.js";

describe("resolveConfig", () => {
  it("applies astro preset defaults", () => {
    const resolved = resolveConfig({ preset: "astro" });
    expect(resolved.selector).toMatch(/article|main/);
    expect(resolved.strip.length).toBeGreaterThan(0);
    expect(resolved.preset).toBe("astro");
  });

  it("user config overrides preset", () => {
    const resolved = resolveConfig({
      preset: "astro",
      selector: "main#custom",
      strip: [".only-this"],
    });
    expect(resolved.selector).toBe("main#custom");
    expect(resolved.strip).toEqual([".only-this"]);
  });

  it("applies cache defaults", () => {
    const resolved = resolveConfig({ preset: "custom", selector: "article" });
    expect(resolved.cache.maxAge).toBe(3600);
    expect(resolved.cache.staleWhileRevalidate).toBe(86400);
  });

  it("throws on invalid config with clear message", () => {
    expect(() =>
      resolveConfig({
        preset: "custom",
        selector: "article",
        cache: { maxAge: -1 },
      } as never),
    ).toThrow(/cache/);
  });

  it("uses maxOriginBytes default of 10MB", () => {
    const resolved = resolveConfig({ preset: "custom", selector: "article" });
    expect(resolved.maxOriginBytes).toBe(10 * 1024 * 1024);
  });
});
