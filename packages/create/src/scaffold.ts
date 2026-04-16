import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ScaffoldOptions {
  cwd: string;
  workerPath: string;
  workerName: string;
  preset: "astro" | "hugo" | "custom";
  zone: string;
  patterns: string[];
  selector: string | null;
  strip: string[] | null;
  redirects: Record<string, string> | null;
}

function loadTemplate(name: string): string {
  return readFileSync(resolve(__dirname, "./templates", name), "utf8");
}

function renderWorker(opts: ScaffoldOptions): string {
  const tpl = loadTemplate("worker.ts.tmpl");
  let out = tpl.replace("{{PRESET}}", opts.preset);
  out = out.replace(
    /\{\{#SELECTOR\}\}[\s\S]*?\{\{\/SELECTOR\}\}/,
    opts.selector ? `\n  selector: "${opts.selector}",` : "",
  );
  out = out.replace(
    /\{\{#STRIP\}\}[\s\S]*?\{\{\/STRIP\}\}/,
    opts.strip?.length ? `\n  strip: ${JSON.stringify(opts.strip)},` : "",
  );
  out = out.replace(
    /\{\{#REDIRECTS\}\}[\s\S]*?\{\{\/REDIRECTS\}\}/,
    opts.redirects ? `\n  redirects: ${JSON.stringify(opts.redirects, null, 2)},` : "",
  );
  return out;
}

function renderWrangler(opts: ScaffoldOptions): string {
  const tpl = loadTemplate("wrangler.toml.tmpl");
  let out = tpl.replace("{{WORKER_NAME}}", opts.workerName);
  const routeBlocks = opts.patterns
    .map((p) => `  { pattern = "${p}", zone_name = "${opts.zone}" }`)
    .join(",\n");
  out = out.replace(/\{\{#ROUTES\}\}[\s\S]*?\{\{\/ROUTES\}\}/, routeBlocks);
  return out;
}

function renderPackage(opts: ScaffoldOptions): string {
  const tpl = loadTemplate("package.json.tmpl");
  return tpl.replace("{{WORKER_NAME}}", opts.workerName);
}

export function scaffoldProject(opts: ScaffoldOptions): string {
  const workerDir = join(opts.cwd, opts.workerPath);
  const srcDir = join(workerDir, "src");
  mkdirSync(srcDir, { recursive: true });

  writeFileSync(join(srcDir, "index.ts"), renderWorker(opts), "utf8");
  writeFileSync(join(workerDir, "wrangler.toml"), renderWrangler(opts), "utf8");
  writeFileSync(join(workerDir, "package.json"), renderPackage(opts), "utf8");

  return workerDir;
}
