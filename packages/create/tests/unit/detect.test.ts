import { describe, it, expect } from "vitest";
import { detectFramework } from "../../src/detect.js";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "mdea-test-"));
}

describe("detectFramework", () => {
  it("detects astro from package.json deps", () => {
    const dir = tmp();
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { astro: "^4.0.0" } }),
    );
    expect(detectFramework(dir)).toBe("astro");
  });

  it("detects hugo from config file", () => {
    const dir = tmp();
    writeFileSync(join(dir, "hugo.toml"), "title = 'x'");
    expect(detectFramework(dir)).toBe("hugo");
  });

  it("detects hugo from hugo.yaml", () => {
    const dir = tmp();
    writeFileSync(join(dir, "hugo.yaml"), "title: x");
    expect(detectFramework(dir)).toBe("hugo");
  });

  it("returns custom when nothing matches", () => {
    const dir = tmp();
    writeFileSync(join(dir, "package.json"), "{}");
    expect(detectFramework(dir)).toBe("custom");
  });
});
