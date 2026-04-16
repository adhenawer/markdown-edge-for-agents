import { describe, expect, it } from "vitest";
import { presets } from "../../../src/presets/index.js";

describe("presets catalog", () => {
  it("includes astro, hugo, custom", () => {
    expect(presets.astro).toBeDefined();
    expect(presets.hugo).toBeDefined();
    expect(presets.custom).toBeDefined();
  });

  it("each preset has selector and strip array", () => {
    for (const name of ["astro", "hugo", "custom"] as const) {
      expect(typeof presets[name].selector).toBe("string");
      expect(Array.isArray(presets[name].strip)).toBe(true);
      expect(Array.isArray(presets[name].frontmatter)).toBe(true);
    }
  });

  it("astro preset selector matches article or main", () => {
    expect(presets.astro.selector).toMatch(/article|main/);
  });

  it("hugo preset strips typical chrome", () => {
    expect(presets.hugo.strip).toContain("nav");
  });

  it("custom preset is empty baseline", () => {
    expect(presets.custom.strip.length).toBe(0);
  });
});
