import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scaffoldProject } from "../../src/scaffold.js";

describe("scaffoldProject", () => {
  it("creates worker, wrangler.toml, package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "mdea-scaffold-"));
    scaffoldProject({
      cwd: dir,
      workerPath: "workers/markdown-agent",
      workerName: "my-worker",
      preset: "astro",
      zone: "example.com",
      patterns: ["example.com/posts/*"],
      selector: null,
      strip: null,
      redirects: null,
    });

    const workerDir = join(dir, "workers/markdown-agent");
    expect(existsSync(join(workerDir, "src/index.ts"))).toBe(true);
    expect(existsSync(join(workerDir, "wrangler.toml"))).toBe(true);
    expect(existsSync(join(workerDir, "package.json"))).toBe(true);

    const worker = readFileSync(join(workerDir, "src/index.ts"), "utf8");
    expect(worker).toContain('preset: "astro"');
    expect(worker).toContain("createMarkdownWorker");

    const wrangler = readFileSync(join(workerDir, "wrangler.toml"), "utf8");
    expect(wrangler).toContain('name = "my-worker"');
    expect(wrangler).toContain('pattern = "example.com/posts/*"');
    expect(wrangler).toContain('zone_name = "example.com"');
  });

  it("includes custom selector and strip", () => {
    const dir = mkdtempSync(join(tmpdir(), "mdea-scaffold-"));
    scaffoldProject({
      cwd: dir,
      workerPath: "workers/md",
      workerName: "w",
      preset: "custom",
      zone: "x.com",
      patterns: ["x.com/*"],
      selector: "main",
      strip: [".ads"],
      redirects: null,
    });

    const worker = readFileSync(join(dir, "workers/md/src/index.ts"), "utf8");
    expect(worker).toContain('selector: "main"');
    expect(worker).toContain('".ads"');
  });
});
