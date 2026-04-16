import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Framework = "astro" | "hugo" | "custom";

export function detectFramework(cwd: string): Framework {
  // Hugo config (highest priority since simplest check)
  if (
    existsSync(join(cwd, "hugo.toml")) ||
    existsSync(join(cwd, "hugo.yaml")) ||
    existsSync(join(cwd, "config.toml")) ||
    existsSync(join(cwd, "config.yaml"))
  ) {
    return "hugo";
  }

  // Astro from package.json deps
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps.astro) return "astro";
    } catch {
      // ignore parse errors
    }
  }

  return "custom";
}
