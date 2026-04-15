# markdown-edge-for-agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of `@adhenawer/markdown-edge-for-agents` — biblioteca + CLI scaffolder que serve markdown para AI agents via content negotiation em Cloudflare Workers, compat 1:1 com feature Pro da Cloudflare, free-tier ready.

**Architecture:** Monorepo pnpm com dois packages (`core` e `create`). Core expõe `createMarkdownWorker(config)` que devolve `ExportedHandler` CF Workers. HTMLRewriter streaming pra conversão. Config via zod. Scaffolder CLI separado detecta framework e gera worker + wrangler.toml.

**Tech Stack:** TypeScript 5.5+, pnpm workspaces, tsup (build), vitest (tests), miniflare (worker emulation), zod (validation), biome (lint+format), HTMLRewriter (native CF), wrangler (deploy), changesets (release).

**Budget:** 4-6 fins de semana.

**Spec:** `DESIGN.md` na raiz deste diretório.

> **Decisão de build-vs-buy (revisada 2026-04-15):** Usamos [`markdown-for-agents`](https://github.com/kkonstantinov/markdown-for-agents) (MIT, ativo, tipado, 2 deps) como conversor HTML→MD ao invés de implementar do zero. Nosso valor agregado é scaffolder + presets + config declarativa + headers compat-CF + dogfood. Converter é commodity. Adapter fino isola a dep — trocar depois custa 1 arquivo.

---

## Fases

| Fase | Escopo | Weekends |
|---|---|---|
| 0 | Repo setup + tooling | 0.5 |
| 1 | Converter adapter + meta + frontmatter | 0.5 |
| 2 | Config + presets | 0.5 |
| 3 | Worker factory + request lifecycle | 1 |
| 4 | Scaffolder CLI | 1 |
| 5 | Examples + docs + CI | 0.5 |
| 6 | Dogfood em video-to-text + launch | 0.5 |

Total: ~4.5 weekends (cabe confortavelmente em 4-6, sobra pra polish).

---

## Estrutura de arquivos

```
markdown-edge-for-agents/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── converter/
│   │   │   │   ├── index.ts              # convertHtmlToMarkdown adapter (wraps upstream)
│   │   │   │   ├── extractMeta.ts        # parse <head> via HTMLRewriter (pra frontmatter)
│   │   │   │   └── frontmatter.ts        # YAML frontmatter builder
│   │   │   ├── config/
│   │   │   │   ├── schema.ts             # zod schema
│   │   │   │   ├── resolve.ts            # merge user + preset
│   │   │   │   └── types.ts
│   │   │   ├── presets/
│   │   │   │   ├── astro.ts
│   │   │   │   ├── hugo.ts
│   │   │   │   ├── custom.ts
│   │   │   │   └── index.ts
│   │   │   ├── worker/
│   │   │   │   ├── factory.ts            # createMarkdownWorker
│   │   │   │   ├── negotiate.ts          # wantsMarkdown
│   │   │   │   ├── redirects.ts          # match + apply
│   │   │   │   └── headers.ts            # build response headers
│   │   │   └── index.ts                  # public re-exports
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   ├── fixtures/
│   │   │   └── helpers/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── vitest.config.ts
│   └── create/
│       ├── src/
│       │   ├── detect.ts                 # detect framework
│       │   ├── prompts.ts                # interactive flow
│       │   ├── scaffold.ts               # generate files
│       │   ├── templates/
│       │   │   ├── worker.ts.tmpl
│       │   │   ├── wrangler.toml.tmpl
│       │   │   └── package.json.tmpl
│       │   └── index.ts                  # CLI entry
│       ├── tests/
│       ├── package.json
│       ├── tsconfig.json
│       └── tsup.config.ts
├── examples/
│   ├── custom-site/
│   ├── astro-blog/
│   └── hugo-blog/
├── .github/workflows/
│   ├── ci.yml
│   ├── release.yml
│   └── smoke.yml
├── .changeset/
│   └── config.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── README.md
├── LICENSE
└── .gitignore
```

---

# Phase 0 — Repo setup + tooling

## Task 0.1: Criar monorepo com pnpm workspaces

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `biome.json`
- Create: `.gitignore`
- Create: `LICENSE`

- [ ] **Step 1: Criar repo GitHub e clone local**

```bash
gh repo create adhenawer/markdown-edge-for-agents --public --description "Markdown for Agents, on any Edge. Free tier ready."
cd ~/Code
git clone git@github.com:adhenawer/markdown-edge-for-agents.git
cd markdown-edge-for-agents
```

- [ ] **Step 2: Criar `package.json` root**

```json
{
  "name": "markdown-edge-for-agents",
  "version": "0.0.0",
  "private": true,
  "description": "Markdown for Agents, on any Edge. Free tier ready.",
  "repository": "github:adhenawer/markdown-edge-for-agents",
  "license": "MIT",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter ./packages/create test:e2e",
    "typecheck": "pnpm -r typecheck",
    "lint": "biome check .",
    "format": "biome format --write .",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && changeset publish"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@changesets/cli": "^2.27.0",
    "typescript": "^5.5.0"
  },
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=22"
  }
}
```

- [ ] **Step 3: Criar `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "examples/*"
```

- [ ] **Step 4: Criar `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "lib": ["ES2023"],
    "types": ["@cloudflare/workers-types"]
  }
}
```

- [ ] **Step 5: Criar `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "files": {
    "ignore": ["dist", "node_modules", ".changeset", "coverage", "*.tmpl"]
  }
}
```

- [ ] **Step 6: Criar `.gitignore`**

```
node_modules/
dist/
coverage/
.wrangler/
.env
.env.local
.DS_Store
*.log
.vitest/
```

- [ ] **Step 7: Criar `LICENSE` (MIT)**

```
MIT License

Copyright (c) 2026 adhenawer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 8: Instalar deps e inicializar changesets**

Run:
```bash
pnpm install
pnpm changeset init
```
Expected: diretório `.changeset/` criado com `config.json` default.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: init monorepo with pnpm workspaces, biome, changesets"
git push -u origin main
```

---

## Task 0.2: Scaffold package `core`

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Criar `packages/core/package.json`**

```json
{
  "name": "@adhenawer/markdown-edge-for-agents",
  "version": "0.0.0",
  "description": "Markdown for Agents, on any Edge. Free tier ready.",
  "repository": "github:adhenawer/markdown-edge-for-agents",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "markdown-for-agents": "^1.3.4",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250101.0",
    "miniflare": "^4.0.0",
    "tsup": "^8.3.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

- [ ] **Step 2: Criar `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "tests"]
}
```

- [ ] **Step 3: Criar `packages/core/tsup.config.ts`**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  sourcemap: true,
});
```

- [ ] **Step 4: Criar `packages/core/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
```

- [ ] **Step 5: Criar `packages/core/src/index.ts` (placeholder público)**

```ts
export const version = "0.0.0";
```

- [ ] **Step 6: Verificar que build roda**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents build`
Expected: cria `packages/core/dist/index.js` e `index.d.ts` sem erros.

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "chore(core): scaffold package with tsup, vitest, TS config"
git push
```

---

## Task 0.3: Scaffold package `create`

**Files:**
- Create: `packages/create/package.json`
- Create: `packages/create/tsconfig.json`
- Create: `packages/create/tsup.config.ts`
- Create: `packages/create/src/index.ts`

- [ ] **Step 1: Criar `packages/create/package.json`**

```json
{
  "name": "create-markdown-edge-for-agents",
  "version": "0.0.0",
  "description": "Scaffolder CLI for markdown-edge-for-agents",
  "repository": "github:adhenawer/markdown-edge-for-agents",
  "license": "MIT",
  "type": "module",
  "bin": {
    "create-markdown-edge-for-agents": "./dist/index.js",
    "mdea": "./dist/index.js"
  },
  "files": ["dist", "templates", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "execa": "^9.0.0",
    "prompts": "^2.4.0",
    "kleur": "^4.1.0"
  },
  "devDependencies": {
    "@types/prompts": "^2.4.0",
    "tsup": "^8.3.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

- [ ] **Step 2: Criar `packages/create/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "tests"]
}
```

- [ ] **Step 3: Criar `packages/create/tsup.config.ts`**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  target: "node22",
  banner: { js: "#!/usr/bin/env node" },
  sourcemap: true,
});
```

- [ ] **Step 4: Criar `packages/create/src/index.ts` (placeholder)**

```ts
console.log("create-markdown-edge-for-agents (placeholder)");
```

- [ ] **Step 5: Verificar que build roda**

Run: `pnpm --filter create-markdown-edge-for-agents build`
Expected: `packages/create/dist/index.js` com shebang.

- [ ] **Step 6: Commit**

```bash
git add packages/create
git commit -m "chore(create): scaffold CLI package with tsup"
git push
```

---

# Phase 1 — Converter adapter + meta + frontmatter

> **Nota:** em vez de implementar o conversor do zero (que seriam 11 tasks / 1.5 weekends), adotamos [`markdown-for-agents`](https://github.com/kkonstantinov/markdown-for-agents) como dependência. Isolamos num adapter fino (1 arquivo) pra proteger troca futura. Mantemos 3 peças próprias: **adapter**, **meta extractor** (pra frontmatter) e **frontmatter builder** (formato nosso).

## Task 1.1: Adapter `convertHtmlToMarkdown` envolvendo `markdown-for-agents`

**Files:**
- Create: `packages/core/src/converter/index.ts`
- Test: `packages/core/tests/unit/converter/adapter.test.ts`

- [ ] **Step 1: Escrever teste**

Arquivo `packages/core/tests/unit/converter/adapter.test.ts`:
```ts
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
    const html = `<article><div class="ad">SKIP</div><p>keep</p></article>`;
    const result = await convertHtmlToMarkdown(html, { ...baseConfig, strip: [".ad"] });
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
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test adapter`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar adapter**

Arquivo `packages/core/src/converter/index.ts`:
```ts
import { convert } from "markdown-for-agents";
import { extractMeta, type Meta } from "./extractMeta.js";

export interface ConverterConfig {
  selector: string;
  strip: string[];
  frontmatter: readonly string[];
}

export interface ConversionResult {
  markdown: string;
  tokens: number;
  meta: Meta;
}

export async function convertHtmlToMarkdown(
  html: string,
  config: ConverterConfig
): Promise<ConversionResult | null> {
  const meta = await extractMeta(html);

  const result = convert(html, {
    extraction: {
      selector: config.selector,
      strip: config.strip,
    },
  });

  if (!result.markdown || result.markdown.trim().length === 0) {
    return null;
  }

  return {
    markdown: result.markdown.trim(),
    tokens: result.tokenEstimate.tokens,
    meta,
  };
}
```

> **Nota de API:** a assinatura exata de `convert()` options pode variar entre versões — validar via `npm view markdown-for-agents` e ajustar o objeto `extraction` conforme o schema atual. Se as options diferem, adaptar é trivial (único arquivo).

- [ ] **Step 4: Rodar (pass)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test adapter`
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/converter/index.ts packages/core/tests/unit/converter/adapter.test.ts
git commit -m "feat(core): converter adapter wrapping markdown-for-agents"
git push
```

---

## Task 1.2: Meta extractor (HTMLRewriter pra title/author/description/lang)

**Files:**
- Create: `packages/core/src/converter/extractMeta.ts`
- Test: `packages/core/tests/unit/converter/extractMeta.test.ts`

**Por que separado:** a lib upstream converte o `<body>`/`<article>` mas não expõe os campos de `<head>` no formato que queremos pra frontmatter (title limpo sem trim issues, author e description, lang do `<html>`). Usamos HTMLRewriter nativo (zero deps em CF) só pra isso.

- [ ] **Step 1: Escrever teste**

Arquivo `packages/core/tests/unit/converter/extractMeta.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { extractMeta } from "../../../src/converter/extractMeta.js";

const html = `
<!doctype html>
<html lang="pt-BR">
  <head>
    <title>Meu Post</title>
    <meta name="description" content="Sobre coisas">
    <meta name="author" content="adhenawer">
  </head>
  <body><article>conteudo</article></body>
</html>`;

describe("extractMeta", () => {
  it("extracts title, description, author, lang", async () => {
    const meta = await extractMeta(html);
    expect(meta.title).toBe("Meu Post");
    expect(meta.description).toBe("Sobre coisas");
    expect(meta.author).toBe("adhenawer");
    expect(meta.lang).toBe("pt-BR");
  });

  it("defaults lang to en when missing", async () => {
    const meta = await extractMeta("<html><head><title>X</title></head><body></body></html>");
    expect(meta.lang).toBe("en");
  });

  it("returns empty strings for missing fields", async () => {
    const meta = await extractMeta("<html><body></body></html>");
    expect(meta.title).toBe("");
    expect(meta.description).toBe("");
    expect(meta.author).toBe("");
  });
});
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test extractMeta`

- [ ] **Step 3: Implementar com HTMLRewriter**

Arquivo `packages/core/src/converter/extractMeta.ts`:
```ts
export interface Meta {
  title: string;
  description: string;
  author: string;
  lang: string;
}

export async function extractMeta(html: string): Promise<Meta> {
  const meta: Meta = { title: "", description: "", author: "", lang: "en" };

  const rewriter = new HTMLRewriter()
    .on("html", {
      element(el) {
        const lang = el.getAttribute("lang");
        if (lang) meta.lang = lang;
      },
    })
    .on("title", {
      text(chunk) {
        meta.title += chunk.text;
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        meta.description = el.getAttribute("content") ?? "";
      },
    })
    .on('meta[name="author"]', {
      element(el) {
        meta.author = el.getAttribute("content") ?? "";
      },
    });

  const response = new Response(html, { headers: { "Content-Type": "text/html" } });
  await rewriter.transform(response).text();
  meta.title = meta.title.trim();
  return meta;
}
```

- [ ] **Step 4: Rodar (pass)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test extractMeta`
Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/converter/extractMeta.ts packages/core/tests/unit/converter/extractMeta.test.ts
git commit -m "feat(core): extractMeta via HTMLRewriter"
git push
```

---

## Task 1.3: Frontmatter builder (YAML)

**Files:**
- Create: `packages/core/src/converter/frontmatter.ts`
- Test: `packages/core/tests/unit/converter/frontmatter.test.ts`

- [ ] **Step 1: Escrever teste**

Arquivo `packages/core/tests/unit/converter/frontmatter.test.ts`:
```ts
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
    const out = buildFrontmatter({ title: "X", author: "", description: "", lang: "en", source: "s" });
    expect(out).not.toContain("author:");
    expect(out).not.toContain("description:");
  });

  it("escapes quotes in strings", () => {
    const out = buildFrontmatter({ title: 'He said "hi"', author: "", description: "", lang: "en", source: "s" });
    expect(out).toContain('title: "He said \\"hi\\""');
  });
});
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test frontmatter`

- [ ] **Step 3: Implementar**

Arquivo `packages/core/src/converter/frontmatter.ts`:
```ts
export interface FrontmatterFields {
  title?: string;
  author?: string;
  description?: string;
  lang?: string;
  source: string;
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function buildFrontmatter(fields: FrontmatterFields): string {
  const lines: string[] = ["---"];
  if (fields.title) lines.push(`title: "${escapeYaml(fields.title)}"`);
  if (fields.author) lines.push(`author: "${escapeYaml(fields.author)}"`);
  if (fields.description) lines.push(`description: "${escapeYaml(fields.description)}"`);
  lines.push(`source: "${escapeYaml(fields.source)}"`);
  lines.push(`lang: ${fields.lang ?? "en"}`);
  lines.push("---");
  lines.push("");
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Rodar (pass)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test frontmatter`
Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/converter/frontmatter.ts packages/core/tests/unit/converter/frontmatter.test.ts
git commit -m "feat(core): frontmatter builder with YAML escaping"
git push
```

---

## Task 1.4: Integration test — adapter + meta + real fixtures

**Files:**
- Create: `packages/core/tests/integration/converter.integration.test.ts`
- Create: `packages/core/tests/integration/fixtures/adhenawer-post.html`
- Create: `packages/core/tests/integration/fixtures/astro-post.html`
- Create: `packages/core/tests/integration/fixtures/hugo-post.html`

**Objetivo:** validar end-to-end com HTML real (não strings inline) que a cadeia adapter → lib upstream → meta extractor → frontmatter funciona em CF Workers (via miniflare).

- [ ] **Step 1: Criar fixture mínima `adhenawer-post.html`**

Arquivo `packages/core/tests/integration/fixtures/adhenawer-post.html`:
```html
<!doctype html>
<html lang="pt-BR">
<head>
  <title>Teste Fixture</title>
  <meta name="description" content="Post de teste">
  <meta name="author" content="adhenawer">
</head>
<body>
  <div class="theme-bar">skip</div>
  <nav>skip nav</nav>
  <article>
    <header><h1>Título do Post</h1></header>
    <p>Primeiro parágrafo com <strong>destaque</strong>.</p>
    <h2>Seção</h2>
    <ul><li>Item A</li><li>Item B</li></ul>
    <p>Código: <code>const x = 1;</code></p>
  </article>
  <script>console.log('skip')</script>
</body>
</html>
```

- [ ] **Step 2: Criar fixtures `astro-post.html` e `hugo-post.html`**

Use HTML real de um post Astro e um Hugo (pode pegar `view-source:` de blogs conhecidos e anonimizar). Mantenha cada em ~2-4KB pra velocidade de teste.

Estrutura mínima Astro: `<main>` ou `<article>` com `<h1>`, parágrafos, `<aside>` (strip), `<nav>` (strip).

Estrutura mínima Hugo: `<article>` com classes `.post-content`, possivelmente `.social-share` (strip).

- [ ] **Step 3: Escrever teste integration**

Arquivo `packages/core/tests/integration/converter.integration.test.ts`:
```ts
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
  });

  it("converts hugo fixture with hugo-style strip", async () => {
    const html = fixtures("hugo-post.html");
    const result = await convertHtmlToMarkdown(html, {
      selector: "article, main .post-content, main.single",
      strip: ["nav", "footer", ".social-share", ".post-nav"],
      frontmatter: ["title", "author"],
    });
    expect(result).not.toBeNull();
  });
});
```

- [ ] **Step 4: Rodar testes de integração**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test integration`
Expected: 3 tests passing. Se a assinatura de `convert()` do upstream diferir, ajuste Task 1.1 conforme o erro.

- [ ] **Step 5: Validar compat CF Workers via miniflare (sanity check rápido)**

Arquivo `packages/core/tests/integration/cf-compat.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Miniflare } from "miniflare";
import { convertHtmlToMarkdown } from "../../src/converter/index.js";

describe("CF Workers compatibility", () => {
  it("runs inside miniflare without throwing", async () => {
    const mf = new Miniflare({
      script: `
        export default {
          async fetch() {
            return new Response("ok");
          }
        };
      `,
      modules: true,
    });
    // Sanity check: miniflare runtime loads; adapter is testable in this env
    const res = await mf.dispatchFetch("https://x.com/");
    expect(await res.text()).toBe("ok");
    await mf.dispose();

    // Direct adapter invocation (uses globalThis.HTMLRewriter from vitest-workerd shim or node polyfill)
    const result = await convertHtmlToMarkdown(
      "<html><body><article><h1>T</h1></article></body></html>",
      { selector: "article", strip: [], frontmatter: ["title"] }
    );
    expect(result).not.toBeNull();
  });
});
```

- [ ] **Step 6: Rodar CF compat**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test cf-compat`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/tests/integration
git commit -m "test(core): integration tests for converter with real fixtures"
git push
```

---# Phase 2 — Config + presets

## Task 2.1: Config types e zod schema

**Files:**
- Create: `packages/core/src/config/types.ts`
- Create: `packages/core/src/config/schema.ts`
- Test: `packages/core/tests/unit/config/schema.test.ts`

- [ ] **Step 1: Escrever teste**

Arquivo `packages/core/tests/unit/config/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
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
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test schema`

- [ ] **Step 3: Implementar types**

Arquivo `packages/core/src/config/types.ts`:
```ts
export type PresetName = "astro" | "hugo" | "custom";

export interface UserConfig {
  preset: PresetName;
  selector?: string;
  strip?: string[];
  frontmatter?: string[];
  redirects?: Record<string, string>;
  forceMarkdownForUserAgents?: RegExp[];
  cache?: { maxAge?: number; staleWhileRevalidate?: number };
  debug?: boolean;
  maxOriginBytes?: number;
}

export interface ResolvedConfig {
  selector: string;
  strip: string[];
  frontmatter: string[];
  redirects: Record<string, string>;
  forceMarkdownForUserAgents: RegExp[];
  cache: { maxAge: number; staleWhileRevalidate: number };
  debug: boolean;
  maxOriginBytes: number;
  preset: PresetName;
}
```

- [ ] **Step 4: Implementar schema**

Arquivo `packages/core/src/config/schema.ts`:
```ts
import { z } from "zod";

export const userConfigSchema = z.object({
  preset: z.enum(["astro", "hugo", "custom"]),
  selector: z.string().optional(),
  strip: z.array(z.string()).max(100).optional(),
  frontmatter: z.array(z.string()).optional(),
  redirects: z.record(z.string(), z.string()).optional(),
  forceMarkdownForUserAgents: z.array(z.instanceof(RegExp)).optional(),
  cache: z
    .object({
      maxAge: z.number().min(0).optional(),
      staleWhileRevalidate: z.number().min(0).optional(),
    })
    .optional(),
  debug: z.boolean().optional(),
  maxOriginBytes: z.number().positive().optional(),
});
```

- [ ] **Step 5: Rodar (pass)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test schema`
Expected: 5 tests passing.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/config packages/core/tests/unit/config
git commit -m "feat(core): config types and zod schema"
git push
```

---

## Task 2.2: Presets catalog

**Files:**
- Create: `packages/core/src/presets/astro.ts`
- Create: `packages/core/src/presets/hugo.ts`
- Create: `packages/core/src/presets/custom.ts`
- Create: `packages/core/src/presets/index.ts`
- Test: `packages/core/tests/unit/presets/presets.test.ts`

- [ ] **Step 1: Escrever teste**

Arquivo `packages/core/tests/unit/presets/presets.test.ts`:
```ts
import { describe, it, expect } from "vitest";
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
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test presets`

- [ ] **Step 3: Implementar astro preset**

Arquivo `packages/core/src/presets/astro.ts`:
```ts
import type { PresetConfig } from "../config/types.js";

export const astroPreset = {
  selector: "article, main[data-page-type='post'], main.content",
  strip: [
    "nav",
    "header:not(article header)",
    "footer",
    "aside",
    "script",
    "style",
    "[aria-hidden='true']",
  ],
  frontmatter: ["title", "author", "description", "pubDate"],
} as const;
```

- [ ] **Step 4: Implementar hugo preset**

Arquivo `packages/core/src/presets/hugo.ts`:
```ts
export const hugoPreset = {
  selector: "article, main .post-content, main.single",
  strip: [
    "nav",
    "header.site-header",
    "footer",
    "aside",
    "script",
    "style",
    ".post-nav",
    ".social-share",
  ],
  frontmatter: ["title", "author", "description", "date"],
} as const;
```

- [ ] **Step 5: Implementar custom preset**

Arquivo `packages/core/src/presets/custom.ts`:
```ts
export const customPreset = {
  selector: "article",
  strip: [],
  frontmatter: ["title", "author", "description", "lang"],
} as const;
```

- [ ] **Step 6: Implementar index**

Arquivo `packages/core/src/presets/index.ts`:
```ts
import { astroPreset } from "./astro.js";
import { hugoPreset } from "./hugo.js";
import { customPreset } from "./custom.js";

export const presets = {
  astro: astroPreset,
  hugo: hugoPreset,
  custom: customPreset,
} as const;

export type PresetConfig = typeof astroPreset;
```

- [ ] **Step 7: Rodar (pass)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test presets`
Expected: 5 tests passing.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/presets packages/core/tests/unit/presets
git commit -m "feat(core): astro, hugo, custom presets"
git push
```

---

## Task 2.3: Config resolver (merge preset + user)

**Files:**
- Create: `packages/core/src/config/resolve.ts`
- Test: `packages/core/tests/unit/config/resolve.test.ts`

- [ ] **Step 1: Escrever teste**

Arquivo `packages/core/tests/unit/config/resolve.test.ts`:
```ts
import { describe, it, expect } from "vitest";
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
    expect(() => resolveConfig({ preset: "custom", selector: "article", cache: { maxAge: -1 } } as never))
      .toThrow(/cache/);
  });

  it("uses maxOriginBytes default of 10MB", () => {
    const resolved = resolveConfig({ preset: "custom", selector: "article" });
    expect(resolved.maxOriginBytes).toBe(10 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test resolve`

- [ ] **Step 3: Implementar resolver**

Arquivo `packages/core/src/config/resolve.ts`:
```ts
import { presets } from "../presets/index.js";
import { userConfigSchema } from "./schema.js";
import type { UserConfig, ResolvedConfig } from "./types.js";

const DEFAULTS = {
  cache: { maxAge: 3600, staleWhileRevalidate: 86400 },
  debug: false,
  maxOriginBytes: 10 * 1024 * 1024,
  forceMarkdownForUserAgents: [] as RegExp[],
  redirects: {} as Record<string, string>,
};

export function resolveConfig(user: UserConfig): ResolvedConfig {
  const parsed = userConfigSchema.safeParse(user);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - "${i.path.join(".")}": ${i.message}`)
      .join("\n");
    throw new Error(
      `[mdea] Invalid config:\n${issues}\n\nConfig docs: https://github.com/adhenawer/markdown-edge-for-agents#config`
    );
  }

  const preset = presets[parsed.data.preset];

  return {
    selector: parsed.data.selector ?? preset.selector,
    strip: parsed.data.strip ?? [...preset.strip],
    frontmatter: parsed.data.frontmatter ?? [...preset.frontmatter],
    redirects: parsed.data.redirects ?? DEFAULTS.redirects,
    forceMarkdownForUserAgents:
      parsed.data.forceMarkdownForUserAgents ?? DEFAULTS.forceMarkdownForUserAgents,
    cache: {
      maxAge: parsed.data.cache?.maxAge ?? DEFAULTS.cache.maxAge,
      staleWhileRevalidate:
        parsed.data.cache?.staleWhileRevalidate ?? DEFAULTS.cache.staleWhileRevalidate,
    },
    debug: parsed.data.debug ?? DEFAULTS.debug,
    maxOriginBytes: parsed.data.maxOriginBytes ?? DEFAULTS.maxOriginBytes,
    preset: parsed.data.preset,
  };
}
```

- [ ] **Step 4: Rodar (pass)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test resolve`
Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/resolve.ts packages/core/tests/unit/config/resolve.test.ts
git commit -m "feat(core): config resolver merging preset + user"
git push
```

---

# Phase 3 — Worker factory + request lifecycle

## Task 3.1: Content negotiation (`wantsMarkdown`)

**Files:**
- Create: `packages/core/src/worker/negotiate.ts`
- Test: `packages/core/tests/unit/worker/negotiate.test.ts`

- [ ] **Step 1: Escrever teste**

Arquivo `packages/core/tests/unit/worker/negotiate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { wantsMarkdown } from "../../../src/worker/negotiate.js";

function req(headers: Record<string, string>): Request {
  return new Request("https://x.com/post", { headers });
}

describe("wantsMarkdown", () => {
  it("true when Accept includes text/markdown", () => {
    expect(wantsMarkdown(req({ Accept: "text/markdown" }), [])).toBe(true);
  });

  it("true when Accept mixes markdown and html", () => {
    expect(wantsMarkdown(req({ Accept: "text/markdown, text/html" }), [])).toBe(true);
  });

  it("false when Accept is only html", () => {
    expect(wantsMarkdown(req({ Accept: "text/html" }), [])).toBe(false);
  });

  it("true when User-Agent matches forced pattern", () => {
    expect(wantsMarkdown(req({ "User-Agent": "ChatGPT-User/1.0" }), [/ChatGPT/i])).toBe(true);
  });

  it("false when User-Agent does not match and no Accept", () => {
    expect(wantsMarkdown(req({}), [/ChatGPT/i])).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test negotiate`

- [ ] **Step 3: Implementar**

Arquivo `packages/core/src/worker/negotiate.ts`:
```ts
export function wantsMarkdown(request: Request, forcedUserAgents: RegExp[]): boolean {
  const accept = request.headers.get("Accept") ?? "";
  if (accept.includes("text/markdown")) return true;

  const ua = request.headers.get("User-Agent") ?? "";
  return forcedUserAgents.some((rx) => rx.test(ua));
}
```

- [ ] **Step 4: Rodar (pass)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test negotiate`
Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/worker/negotiate.ts packages/core/tests/unit/worker/negotiate.test.ts
git commit -m "feat(core): wantsMarkdown content negotiation"
git push
```

---

## Task 3.2: Redirects matcher

**Files:**
- Create: `packages/core/src/worker/redirects.ts`
- Test: `packages/core/tests/unit/worker/redirects.test.ts`

- [ ] **Step 1: Escrever teste**

Arquivo `packages/core/tests/unit/worker/redirects.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { matchRedirect } from "../../../src/worker/redirects.js";

describe("matchRedirect", () => {
  it("returns null when no rule matches", () => {
    const result = matchRedirect(new URL("https://x.com/unrelated"), {});
    expect(result).toBeNull();
  });

  it("exact match wins over glob", () => {
    const rules = {
      "/old/*": "/new/$1",
      "/old/specific": "/super-specific",
    };
    const result = matchRedirect(new URL("https://x.com/old/specific"), rules);
    expect(result?.to).toBe("https://x.com/super-specific");
  });

  it("glob with $1 expands", () => {
    const rules = { "/leituras/*": "/posts/pt_br/$1" };
    const result = matchRedirect(new URL("https://x.com/leituras/foo.html"), rules);
    expect(result?.to).toBe("https://x.com/posts/pt_br/foo.html");
  });

  it("defaults status to 301", () => {
    const rules = { "/x": "/y" };
    const result = matchRedirect(new URL("https://x.com/x"), rules);
    expect(result?.status).toBe(301);
  });

  it("preserves query string", () => {
    const rules = { "/old/*": "/new/$1" };
    const result = matchRedirect(new URL("https://x.com/old/foo?a=1&b=2"), rules);
    expect(result?.to).toBe("https://x.com/new/foo?a=1&b=2");
  });
});
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test redirects`

- [ ] **Step 3: Implementar**

Arquivo `packages/core/src/worker/redirects.ts`:
```ts
export interface RedirectMatch {
  to: string;
  status: 301 | 302;
}

export function matchRedirect(
  url: URL,
  rules: Record<string, string>
): RedirectMatch | null {
  const pathname = url.pathname;

  // Exact match first
  if (rules[pathname]) {
    return { to: url.origin + rules[pathname] + url.search, status: 301 };
  }

  // Glob matching
  for (const [pattern, target] of Object.entries(rules)) {
    if (!pattern.includes("*")) continue;
    const regex = new RegExp("^" + pattern.replace(/\*/g, "(.+)") + "$");
    const m = pathname.match(regex);
    if (m) {
      const expanded = target.replace(/\$1/g, m[1] ?? "");
      return { to: url.origin + expanded + url.search, status: 301 };
    }
  }

  return null;
}
```

- [ ] **Step 4: Rodar (pass)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test redirects`
Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/worker/redirects.ts packages/core/tests/unit/worker/redirects.test.ts
git commit -m "feat(core): matchRedirect with exact and glob support"
git push
```

---

## Task 3.3: Response headers builder

**Files:**
- Create: `packages/core/src/worker/headers.ts`
- Test: `packages/core/tests/unit/worker/headers.test.ts`

- [ ] **Step 1: Escrever teste**

Arquivo `packages/core/tests/unit/worker/headers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildResponseHeaders } from "../../../src/worker/headers.js";

const baseConfig = {
  cache: { maxAge: 3600, staleWhileRevalidate: 86400 },
  preset: "custom" as const,
  debug: false,
};

describe("buildResponseHeaders", () => {
  it("sets Content-Type to text/markdown", () => {
    const headers = buildResponseHeaders({ tokens: 100 }, baseConfig);
    expect(headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
  });

  it("sets x-markdown-tokens", () => {
    const headers = buildResponseHeaders({ tokens: 123 }, baseConfig);
    expect(headers.get("x-markdown-tokens")).toBe("123");
  });

  it("sets Content-Signal for AI opt-in", () => {
    const headers = buildResponseHeaders({ tokens: 1 }, baseConfig);
    expect(headers.get("Content-Signal")).toBe("ai-train=yes, search=yes, ai-input=yes");
  });

  it("sets Vary: Accept for correct caching", () => {
    const headers = buildResponseHeaders({ tokens: 1 }, baseConfig);
    expect(headers.get("Vary")).toBe("Accept");
  });

  it("sets Cache-Control from config", () => {
    const headers = buildResponseHeaders({ tokens: 1 }, baseConfig);
    expect(headers.get("Cache-Control")).toContain("max-age=3600");
    expect(headers.get("Cache-Control")).toContain("stale-while-revalidate=86400");
  });

  it("sets x-markdown-preset", () => {
    const headers = buildResponseHeaders({ tokens: 1 }, baseConfig);
    expect(headers.get("x-markdown-preset")).toBe("custom");
  });

  it("adds debug headers when debug=true", () => {
    const headers = buildResponseHeaders(
      { tokens: 1, bytesIn: 500, bytesOut: 200, selectorMatched: true },
      { ...baseConfig, debug: true }
    );
    expect(headers.get("x-markdown-debug-bytes-in")).toBe("500");
    expect(headers.get("x-markdown-debug-bytes-out")).toBe("200");
    expect(headers.get("x-markdown-debug-selector")).toBe("matched");
  });
});
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test headers`

- [ ] **Step 3: Implementar**

Arquivo `packages/core/src/worker/headers.ts`:
```ts
import type { ResolvedConfig } from "../config/types.js";

export interface HeadersContext {
  tokens: number;
  bytesIn?: number;
  bytesOut?: number;
  selectorMatched?: boolean;
}

const VERSION = "0.1.0"; // bumped manually on release

export function buildResponseHeaders(ctx: HeadersContext, config: Pick<ResolvedConfig, "cache" | "preset" | "debug">): Headers {
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Signal": "ai-train=yes, search=yes, ai-input=yes",
    "Vary": "Accept",
    "Cache-Control": `public, max-age=${config.cache.maxAge}, stale-while-revalidate=${config.cache.staleWhileRevalidate}`,
    "x-markdown-tokens": String(ctx.tokens),
    "x-markdown-version": VERSION,
    "x-markdown-preset": config.preset,
    "Access-Control-Allow-Origin": "*",
  });

  if (config.debug) {
    if (ctx.bytesIn !== undefined) headers.set("x-markdown-debug-bytes-in", String(ctx.bytesIn));
    if (ctx.bytesOut !== undefined) headers.set("x-markdown-debug-bytes-out", String(ctx.bytesOut));
    if (ctx.selectorMatched !== undefined) {
      headers.set("x-markdown-debug-selector", ctx.selectorMatched ? "matched" : "not-found");
    }
  }

  return headers;
}
```

- [ ] **Step 4: Rodar (pass)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test headers`
Expected: 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/worker/headers.ts packages/core/tests/unit/worker/headers.test.ts
git commit -m "feat(core): build response headers compat with CF"
git push
```

---

## Task 3.4: Worker factory `createMarkdownWorker`

**Files:**
- Create: `packages/core/src/worker/factory.ts`
- Create: `packages/core/src/index.ts` (update — public exports)
- Test: `packages/core/tests/integration/worker.test.ts`

- [ ] **Step 1: Escrever teste integration**

Arquivo `packages/core/tests/integration/worker.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createMarkdownWorker } from "../../src/worker/factory.js";

const config = {
  preset: "custom" as const,
  selector: "article",
  strip: [".noise"],
  redirects: { "/leituras/*": "/posts/pt_br/$1" },
};

const fixtureHtml = `
<!doctype html>
<html lang="en">
  <head><title>Fix</title></head>
  <body>
    <article>
      <h1>Hello</h1>
      <div class="noise">skip</div>
      <p>World</p>
    </article>
  </body>
</html>`;

describe("createMarkdownWorker", () => {
  beforeAll(() => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/no-article")) {
        return new Response("<html><body></body></html>", { headers: { "Content-Type": "text/html" } });
      }
      if (url.endsWith("/non-html")) {
        return new Response("pdf bytes", { headers: { "Content-Type": "application/pdf" } });
      }
      return new Response(fixtureHtml, { status: 200, headers: { "Content-Type": "text/html" } });
    }) as typeof fetch;
  });

  afterAll(() => { vi.restoreAllMocks(); });

  const worker = createMarkdownWorker(config);

  it("serves HTML unchanged for browser request", async () => {
    const req = new Request("https://example.com/post", { headers: { Accept: "text/html" } });
    const res = await worker.fetch!(req, {} as never, {} as never);
    expect(res.headers.get("Content-Type")).toMatch(/text\/html/);
  });

  it("serves markdown when Accept is text/markdown", async () => {
    const req = new Request("https://example.com/post", { headers: { Accept: "text/markdown" } });
    const res = await worker.fetch!(req, {} as never, {} as never);
    expect(res.headers.get("Content-Type")).toMatch(/text\/markdown/);
    expect(res.headers.get("Vary")).toBe("Accept");
    expect(res.headers.get("x-markdown-tokens")).toBeTruthy();
    const body = await res.text();
    expect(body).toContain("# Hello");
    expect(body).toContain("World");
    expect(body).not.toContain("skip");
  });

  it("redirects configured paths before negotiation", async () => {
    const req = new Request("https://example.com/leituras/foo.html", { redirect: "manual" });
    const res = await worker.fetch!(req, {} as never, {} as never);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://example.com/posts/pt_br/foo.html");
  });

  it("returns 404 when article selector not found", async () => {
    const req = new Request("https://example.com/no-article", { headers: { Accept: "text/markdown" } });
    const res = await worker.fetch!(req, {} as never, {} as never);
    expect(res.status).toBe(404);
  });

  it("passes through when origin is not HTML", async () => {
    const req = new Request("https://example.com/non-html", { headers: { Accept: "text/markdown" } });
    const res = await worker.fetch!(req, {} as never, {} as never);
    expect(res.headers.get("Content-Type")).toMatch(/application\/pdf/);
  });
});
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test worker`

- [ ] **Step 3: Implementar factory**

Arquivo `packages/core/src/worker/factory.ts`:
```ts
import { convertHtmlToMarkdown } from "../converter/index.js";
import { buildFrontmatter } from "../converter/frontmatter.js";
import { resolveConfig } from "../config/resolve.js";
import type { UserConfig } from "../config/types.js";
import { wantsMarkdown } from "./negotiate.js";
import { matchRedirect } from "./redirects.js";
import { buildResponseHeaders } from "./headers.js";

export function createMarkdownWorker(userConfig: UserConfig): ExportedHandler {
  const config = resolveConfig(userConfig);

  return {
    async fetch(request) {
      const url = new URL(request.url);

      // 1. Redirects first
      const redirect = matchRedirect(url, config.redirects);
      if (redirect) return Response.redirect(redirect.to, redirect.status);

      // 2. Negotiate
      if (!wantsMarkdown(request, config.forceMarkdownForUserAgents)) {
        return fetch(request);
      }

      // 3. Fetch origin as HTML
      const originReq = new Request(request.url, {
        headers: { Accept: "text/html" },
        method: request.method,
      });
      const response = await fetch(originReq);

      // 4. Guards
      if (!response.ok) return response;
      const ct = response.headers.get("Content-Type") ?? "";
      if (!ct.includes("text/html")) return response;

      const cl = Number(response.headers.get("Content-Length") ?? "0");
      if (cl > config.maxOriginBytes) {
        return new Response("Content too large", { status: 413 });
      }

      const html = await response.text();
      if (html.length > config.maxOriginBytes) {
        return new Response("Content too large", { status: 413 });
      }

      // 5. Convert
      try {
        const result = await convertHtmlToMarkdown(html, {
          selector: config.selector,
          strip: config.strip,
          frontmatter: config.frontmatter,
        });

        if (!result) {
          return new Response("No article content found", { status: 404 });
        }

        // 6. Build frontmatter + body
        const frontmatter = buildFrontmatter({
          title: result.meta.title,
          author: result.meta.author,
          description: result.meta.description,
          lang: result.meta.lang,
          source: request.url,
        });
        const body = frontmatter + result.markdown;

        // 7. Response with compat headers
        return new Response(body, {
          status: 200,
          headers: buildResponseHeaders(
            { tokens: result.tokens, bytesIn: html.length, bytesOut: body.length, selectorMatched: true },
            config
          ),
        });
      } catch (err) {
        if (config.debug) {
          console.error("[mdea] conversion failed:", err);
        }
        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "x-markdown-error": (err instanceof Error ? err.message : String(err)).slice(0, 200),
            "Vary": "Accept",
          },
        });
      }
    },
  };
}
```

- [ ] **Step 4: Atualizar `packages/core/src/index.ts`**

```ts
export { createMarkdownWorker } from "./worker/factory.js";
export { convertHtmlToMarkdown } from "./converter/index.js";
export { resolveConfig } from "./config/resolve.js";
export { presets } from "./presets/index.js";
export type { UserConfig, ResolvedConfig, PresetName } from "./config/types.js";
```

- [ ] **Step 5: Rodar (pass)**

Run: `pnpm --filter @adhenawer/markdown-edge-for-agents test worker`
Expected: 5 tests passing.

- [ ] **Step 6: Verify build + typecheck**

Run:
```bash
pnpm --filter @adhenawer/markdown-edge-for-agents typecheck
pnpm --filter @adhenawer/markdown-edge-for-agents build
```
Expected: both succeed, `dist/index.js` + `dist/index.d.ts` exportam `createMarkdownWorker`.

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat(core): createMarkdownWorker factory with full lifecycle"
git push
```

---

# Phase 4 — Scaffolder CLI

## Task 4.1: Framework detection

**Files:**
- Create: `packages/create/src/detect.ts`
- Test: `packages/create/tests/unit/detect.test.ts`

- [ ] **Step 1: Escrever teste**

Arquivo `packages/create/tests/unit/detect.test.ts`:
```ts
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
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { astro: "^4.0.0" } }));
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
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter create-markdown-edge-for-agents test`

- [ ] **Step 3: Implementar**

Arquivo `packages/create/src/detect.ts`:
```ts
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
```

- [ ] **Step 4: Rodar (pass)**

Run: `pnpm --filter create-markdown-edge-for-agents test`
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/create/src/detect.ts packages/create/tests/unit/detect.test.ts
git commit -m "feat(create): detectFramework for astro/hugo/custom"
git push
```

---

## Task 4.2: Templates

**Files:**
- Create: `packages/create/src/templates/worker.ts.tmpl`
- Create: `packages/create/src/templates/wrangler.toml.tmpl`
- Create: `packages/create/src/templates/package.json.tmpl`

- [ ] **Step 1: Criar `worker.ts.tmpl`**

Arquivo `packages/create/src/templates/worker.ts.tmpl`:
```ts
import { createMarkdownWorker } from "@adhenawer/markdown-edge-for-agents";

export default createMarkdownWorker({
  preset: "{{PRESET}}",{{#SELECTOR}}
  selector: "{{SELECTOR}}",{{/SELECTOR}}{{#STRIP}}
  strip: {{STRIP}},{{/STRIP}}{{#REDIRECTS}}
  redirects: {{REDIRECTS}},{{/REDIRECTS}}
});
```

- [ ] **Step 2: Criar `wrangler.toml.tmpl`**

Arquivo `packages/create/src/templates/wrangler.toml.tmpl`:
```toml
name = "{{WORKER_NAME}}"
main = "src/index.ts"
compatibility_date = "2026-04-15"

routes = [
{{#ROUTES}}
  { pattern = "{{PATTERN}}", zone_name = "{{ZONE}}" },
{{/ROUTES}}
]
```

- [ ] **Step 3: Criar `package.json.tmpl`**

Arquivo `packages/create/src/templates/package.json.tmpl`:
```json
{
  "name": "{{WORKER_NAME}}",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@adhenawer/markdown-edge-for-agents": "^0.1.0"
  },
  "devDependencies": {
    "wrangler": "^4"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/create/src/templates
git commit -m "feat(create): worker, wrangler, package.json templates"
git push
```

---

## Task 4.3: Scaffold generator

**Files:**
- Create: `packages/create/src/scaffold.ts`
- Test: `packages/create/tests/unit/scaffold.test.ts`

- [ ] **Step 1: Escrever teste**

Arquivo `packages/create/tests/unit/scaffold.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scaffoldProject } from "../../src/scaffold.js";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter create-markdown-edge-for-agents test scaffold`

- [ ] **Step 3: Implementar**

Arquivo `packages/create/src/scaffold.ts`:
```ts
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
  out = out.replace(/\{\{#SELECTOR\}\}[\s\S]*?\{\{\/SELECTOR\}\}/, opts.selector ? `\n  selector: "${opts.selector}",` : "");
  out = out.replace(/\{\{#STRIP\}\}[\s\S]*?\{\{\/STRIP\}\}/, opts.strip?.length ? `\n  strip: ${JSON.stringify(opts.strip)},` : "");
  out = out.replace(/\{\{#REDIRECTS\}\}[\s\S]*?\{\{\/REDIRECTS\}\}/, opts.redirects ? `\n  redirects: ${JSON.stringify(opts.redirects, null, 2)},` : "");
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
```

- [ ] **Step 4: Copiar templates pro dist**

Atualizar `packages/create/tsup.config.ts`:
```ts
import { defineConfig } from "tsup";
import { cpSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  target: "node22",
  banner: { js: "#!/usr/bin/env node" },
  sourcemap: true,
  onSuccess: async () => {
    cpSync("src/templates", "dist/templates", { recursive: true });
  },
});
```

- [ ] **Step 5: Rodar (pass)**

Run: `pnpm --filter create-markdown-edge-for-agents test scaffold`
Expected: 2 tests passing.

- [ ] **Step 6: Commit**

```bash
git add packages/create
git commit -m "feat(create): scaffoldProject with template rendering"
git push
```

---

## Task 4.4: Prompts interativos

**Files:**
- Create: `packages/create/src/prompts.ts`
- Test: `packages/create/tests/unit/prompts.test.ts`

- [ ] **Step 1: Escrever teste (mocka prompts)**

Arquivo `packages/create/tests/unit/prompts.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import prompts from "prompts";
import { runPrompts } from "../../src/prompts.js";

describe("runPrompts", () => {
  it("returns answers with detected defaults", async () => {
    prompts.inject(["my-worker", "workers/md", "example.com", "example.com/*"]);
    const result = await runPrompts({ detectedFramework: "astro" });
    expect(result.workerName).toBe("my-worker");
    expect(result.workerPath).toBe("workers/md");
    expect(result.zone).toBe("example.com");
    expect(result.preset).toBe("astro");
  });

  it("allows override when framework is custom", async () => {
    prompts.inject(["w", "workers/w", "x.com", "x.com/*"]);
    const result = await runPrompts({ detectedFramework: "custom" });
    expect(result.preset).toBe("custom");
  });
});
```

- [ ] **Step 2: Rodar (fail)**

Run: `pnpm --filter create-markdown-edge-for-agents test prompts`

- [ ] **Step 3: Implementar**

Arquivo `packages/create/src/prompts.ts`:
```ts
import prompts from "prompts";
import type { Framework } from "./detect.js";

export interface PromptAnswers {
  workerName: string;
  workerPath: string;
  zone: string;
  pattern: string;
  preset: Framework;
}

export async function runPrompts(ctx: { detectedFramework: Framework }): Promise<PromptAnswers> {
  const res = await prompts([
    {
      name: "workerName",
      type: "text",
      message: "Worker name (nome único no CF):",
      initial: "markdown-agent",
    },
    {
      name: "workerPath",
      type: "text",
      message: "Diretório do worker:",
      initial: "workers/markdown-agent",
    },
    {
      name: "zone",
      type: "text",
      message: "Cloudflare zone (ex: example.com):",
    },
    {
      name: "pattern",
      type: "text",
      message: "Route pattern (ex: example.com/posts/*):",
      initial: (prev: unknown, all: { zone?: string }) => `${all.zone ?? "example.com"}/*`,
    },
  ]);

  return {
    workerName: res.workerName,
    workerPath: res.workerPath,
    zone: res.zone,
    pattern: res.pattern,
    preset: ctx.detectedFramework,
  };
}
```

- [ ] **Step 4: Rodar (pass)**

Run: `pnpm --filter create-markdown-edge-for-agents test prompts`
Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/create/src/prompts.ts packages/create/tests/unit/prompts.test.ts
git commit -m "feat(create): interactive prompts with framework detection"
git push
```

---

## Task 4.5: CLI entry point

**Files:**
- Modify: `packages/create/src/index.ts`

- [ ] **Step 1: Implementar CLI completo**

Arquivo `packages/create/src/index.ts`:
```ts
#!/usr/bin/env node
import kleur from "kleur";
import { execa } from "execa";
import { detectFramework } from "./detect.js";
import { runPrompts } from "./prompts.js";
import { scaffoldProject } from "./scaffold.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "init";

  if (command !== "init") {
    console.error(kleur.red(`Unknown command: ${command}. Try 'init'.`));
    process.exit(1);
  }

  const cwd = process.cwd();
  console.log(kleur.cyan("✨ markdown-edge-for-agents"));
  console.log(kleur.gray("Detectando framework..."));

  const detected = detectFramework(cwd);
  console.log(kleur.gray(`Detectado: ${kleur.bold(detected)}`));

  const answers = await runPrompts({ detectedFramework: detected });

  console.log(kleur.gray("Gerando arquivos..."));
  const workerDir = scaffoldProject({
    cwd,
    workerPath: answers.workerPath,
    workerName: answers.workerName,
    preset: answers.preset,
    zone: answers.zone,
    patterns: [answers.pattern],
    selector: null,
    strip: null,
    redirects: null,
  });

  console.log(kleur.green(`✓ Criado em ${workerDir}`));
  console.log(kleur.gray("Instalando deps..."));
  try {
    await execa("npm", ["install"], { cwd: workerDir, stdio: "inherit" });
  } catch {
    console.log(kleur.yellow("! npm install falhou. Rode manualmente em " + workerDir));
  }

  console.log();
  console.log(kleur.green("✓ Pronto!"));
  console.log();
  console.log("Próximos passos:");
  console.log(kleur.gray(`  cd ${answers.workerPath}`));
  console.log(kleur.gray("  npx wrangler login"));
  console.log(kleur.gray("  npx wrangler deploy"));
  console.log();
}

main().catch((err) => {
  console.error(kleur.red(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
```

- [ ] **Step 2: Build e typecheck**

Run:
```bash
pnpm --filter create-markdown-edge-for-agents typecheck
pnpm --filter create-markdown-edge-for-agents build
```
Expected: sem erros.

- [ ] **Step 3: Smoke test manual**

Run:
```bash
cd /tmp && mkdir mdea-smoke && cd mdea-smoke
echo '{"dependencies":{"astro":"^4.0.0"}}' > package.json
node /Users/adhenawer/Code/markdown-edge-for-agents/packages/create/dist/index.js init
# Responda os prompts; verifique workers/markdown-agent/ criado
```

- [ ] **Step 4: Commit**

```bash
cd /Users/adhenawer/Code/markdown-edge-for-agents
git add packages/create/src/index.ts
git commit -m "feat(create): CLI entry wiring detect + prompts + scaffold"
git push
```

---

# Phase 5 — Examples, docs, CI

## Task 5.1: Example — custom-site

**Files:**
- Create: `examples/custom-site/` (full worker)

- [ ] **Step 1: Criar estrutura**

Run:
```bash
mkdir -p examples/custom-site/src
```

- [ ] **Step 2: Criar `examples/custom-site/src/index.ts`**

```ts
import { createMarkdownWorker } from "@adhenawer/markdown-edge-for-agents";

export default createMarkdownWorker({
  preset: "custom",
  selector: "article",
  strip: [".ad", "nav", "footer", ".newsletter"],
  frontmatter: ["title", "author", "description", "lang"],
  redirects: {
    "/old-path/*": "/new-path/$1",
  },
});
```

- [ ] **Step 3: Criar `examples/custom-site/wrangler.toml`**

```toml
name = "markdown-custom-example"
main = "src/index.ts"
compatibility_date = "2026-04-15"

# Substitua por seu domínio:
# routes = [
#   { pattern = "example.com/*", zone_name = "example.com" }
# ]
```

- [ ] **Step 4: Criar `examples/custom-site/package.json`**

```json
{
  "name": "example-custom-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@adhenawer/markdown-edge-for-agents": "workspace:*"
  },
  "devDependencies": {
    "wrangler": "^4"
  }
}
```

- [ ] **Step 5: Criar `examples/custom-site/README.md`**

```markdown
# Custom site example

Worker para sites com HTML próprio (não Astro/Hugo).

## Como usar

1. Edite `src/index.ts` com seus selectors
2. Edite `wrangler.toml` com seu domínio
3. `npm install && npx wrangler deploy`

## Teste

\`\`\`bash
curl -H "Accept: text/markdown" https://example.com/post
\`\`\`
```

- [ ] **Step 6: Commit**

```bash
git add examples/custom-site
git commit -m "docs(examples): custom-site worker example"
git push
```

---

## Task 5.2: Example — astro-blog (análogo, preset astro)

**Files:**
- Create: `examples/astro-blog/` (mesma estrutura, preset: "astro")

- [ ] **Step 1: Criar análogo ao 5.1 mas com preset astro**

Replicar estrutura da Task 5.1 em `examples/astro-blog/`, alterando:
- `src/index.ts`: `preset: "astro"`, remover `selector` (usa do preset)
- `wrangler.toml`: `name = "markdown-astro-example"`
- `package.json`: `"name": "example-astro-blog"`
- `README.md`: trocar título e contexto pra Astro

- [ ] **Step 2: Commit**

```bash
git add examples/astro-blog
git commit -m "docs(examples): astro-blog worker example"
git push
```

---

## Task 5.3: Example — hugo-blog (análogo, preset hugo)

**Files:**
- Create: `examples/hugo-blog/`

- [ ] **Step 1: Replicar com preset hugo**

Idêntico à 5.2 mas `preset: "hugo"`, nomes trocados.

- [ ] **Step 2: Commit**

```bash
git add examples/hugo-blog
git commit -m "docs(examples): hugo-blog worker example"
git push
```

---

## Task 5.4: README principal

**Files:**
- Modify: `README.md` (root)

- [ ] **Step 1: Reescrever README raiz**

Arquivo `README.md`:
```markdown
# markdown-edge-for-agents

> Markdown for Agents, on any Edge. Free tier ready.

Drop-in alternativa open source para o feature [Markdown for Agents da Cloudflare](https://blog.cloudflare.com/markdown-for-agents/) (só Pro+). Serve markdown para AI agents via content negotiation, compat 1:1 com a API oficial.

[![npm](https://img.shields.io/npm/v/@adhenawer/markdown-edge-for-agents.svg)](https://npmjs.com/package/@adhenawer/markdown-edge-for-agents)
[![CI](https://github.com/adhenawer/markdown-edge-for-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/adhenawer/markdown-edge-for-agents/actions)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## Quick start

\`\`\`bash
npx create-markdown-edge-for-agents init
\`\`\`

Detecta seu framework (Astro, Hugo, ou custom), gera o worker + wrangler.toml, instala deps, aponta pro deploy.

## Por que

- Cloudflare's "Markdown for Agents" custa $25/mês (Pro) por zone
- Indie hackers em Free tier ficam de fora
- Workers OSS existentes não têm DX de 1 comando nem compat 1:1 com API oficial

## Uso como lib

\`\`\`ts
import { createMarkdownWorker } from "@adhenawer/markdown-edge-for-agents";

export default createMarkdownWorker({
  preset: "custom",
  selector: "article",
  strip: [".ad", "nav", "footer"],
});
\`\`\`

## Presets

| Preset | Selector | Strip |
|---|---|---|
| `astro` | `article, main[data-page-type='post'], main.content` | nav, header, footer, aside, script, style, [aria-hidden] |
| `hugo` | `article, main .post-content, main.single` | nav, header.site-header, footer, .post-nav, .social-share |
| `custom` | `article` | (empty — você define) |

## Config

| Opção | Tipo | Default | Descrição |
|---|---|---|---|
| `preset` | `"astro" \| "hugo" \| "custom"` | **required** | Base de config |
| `selector` | `string` | do preset | Seletor CSS da área de conteúdo |
| `strip` | `string[]` | do preset | Seletores a remover antes de converter |
| `frontmatter` | `string[]` | `["title","author","description","lang"]` | Campos no YAML frontmatter |
| `redirects` | `Record<string,string>` | `{}` | Redirects 301 antes da negociação |
| `forceMarkdownForUserAgents` | `RegExp[]` | `[]` | UA patterns que forçam markdown |
| `cache` | `{maxAge,staleWhileRevalidate}` | `{3600,86400}` | Cache headers |
| `debug` | `boolean` | `false` | Headers extras de debug |

## Comparação com Cloudflare Pro

| Feature | Cloudflare Pro | markdown-edge-for-agents |
|---|---|---|
| Content negotiation via `Accept` | ✅ | ✅ |
| `x-markdown-tokens` header | ✅ | ✅ |
| `Content-Signal` header | ✅ | ✅ |
| `Vary: Accept` caching | ✅ | ✅ |
| Preço | $25/mo por zone | Grátis |
| Customização | Limitada | Total |

## Roadmap

- v1.x: CF Workers only
- v2.x: Multi-runtime (Vercel Edge, Deno Deploy, Bun, Node)
- Comunidade: mais presets (Jekyll, 11ty, Next.js, Ghost)

## Contribuindo

Ver [CONTRIBUTING.md](./CONTRIBUTING.md). TDD obrigatório.

## License

MIT
```

- [ ] **Step 2: Criar CONTRIBUTING.md curto**

Arquivo `CONTRIBUTING.md`:
```markdown
# Contributing

## Setup

\`\`\`bash
pnpm install
pnpm test
\`\`\`

## Regras

- **TDD obrigatório** — teste primeiro, implementação depois.
- Use `pnpm changeset` pra documentar mudanças antes do PR.
- Lint: `pnpm lint`. Format: `pnpm format`.

## Adicionar preset

1. Crie `packages/core/src/presets/<nome>.ts` seguindo pattern dos existentes
2. Registre em `packages/core/src/presets/index.ts`
3. Atualize enum em `packages/core/src/config/schema.ts` e `types.ts`
4. Adicione testes em `packages/core/tests/unit/presets/`
5. Adicione example em `examples/<nome>-site/`
6. PR com changeset
```

- [ ] **Step 3: Commit**

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs: complete README and CONTRIBUTING"
git push
```

---

## Task 5.5: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Criar `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
      - uses: codecov/codecov-action@v4
        with:
          fail_ci_if_error: false
```

- [ ] **Step 2: Criar `.github/workflows/release.yml`**

```yaml
name: Release
on:
  push:
    branches: [main]

concurrency:
  group: release-${{ github.ref }}

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: changesets/action@v1
        with:
          publish: pnpm release
          version: pnpm version-packages
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 3: Commit e push; verificar CI verde**

```bash
git add .github
git commit -m "ci: add CI and release workflows"
git push
```

Aguarde GitHub Actions rodar. Gate: build + test + typecheck devem passar.

---

# Phase 6 — Dogfood em video-to-text + launch

## Task 6.1: Publicar v0.1.0 beta no npm

**Files:**
- Modify: `packages/core/package.json` (version)
- Modify: `packages/create/package.json` (version)

- [ ] **Step 1: Criar changeset**

Run:
```bash
pnpm changeset
# Escolhe: both packages, minor, "Initial beta release"
git add .changeset
git commit -m "chore: initial beta changeset"
git push
```

- [ ] **Step 2: Merge o "Version Packages" PR que o action vai abrir**

Aguarda bot abrir PR, revisa, merge. Action publica no npm automaticamente.

- [ ] **Step 3: Verificar publicação**

Run:
```bash
npm view @adhenawer/markdown-edge-for-agents version
npm view create-markdown-edge-for-agents version
```

Expected: ambos `0.1.0`.

---

## Task 6.2: Migrar video-to-text worker

**Files:**
- Modify: `~/Code/video-to-text/workers/markdown-agent/src/index.js` → rename para `.ts`
- Modify: `~/Code/video-to-text/workers/markdown-agent/package.json`
- Create: `~/Code/video-to-text/workers/markdown-agent/tsconfig.json`

- [ ] **Step 1: Backup do worker atual**

Run:
```bash
cd ~/Code/video-to-text/workers/markdown-agent
cp src/index.js src/index.js.bak
```

- [ ] **Step 2: Atualizar `package.json`**

```json
{
  "name": "markdown-agent",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@adhenawer/markdown-edge-for-agents": "^0.1.0"
  },
  "devDependencies": {
    "wrangler": "^4"
  }
}
```

- [ ] **Step 3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2023"],
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Atualizar `wrangler.toml` pra main .ts**

```toml
name = "markdown-agent"
main = "src/index.ts"
compatibility_date = "2024-12-01"

routes = [
  { pattern = "adhenawer.net/posts/*", zone_name = "adhenawer.net" },
  { pattern = "adhenawer.net/en/*", zone_name = "adhenawer.net" },
  { pattern = "adhenawer.net/blog/*", zone_name = "adhenawer.net" },
  { pattern = "adhenawer.net/leituras/*", zone_name = "adhenawer.net" },
  { pattern = "adhenawer.net/index.html", zone_name = "adhenawer.net" },
  { pattern = "adhenawer.net/llms.txt", zone_name = "adhenawer.net" }
]
```

- [ ] **Step 5: Criar novo `src/index.ts`**

```ts
import { createMarkdownWorker } from "@adhenawer/markdown-edge-for-agents";

export default createMarkdownWorker({
  preset: "custom",
  selector: "article",
  strip: [
    ".theme-bar",
    ".back-home",
    ".progress",
    ".reading-pct",
    ".resume-banner",
    "script",
    "style",
    "nav",
    "button",
    "header",
  ],
  frontmatter: ["title", "author", "description", "lang"],
  redirects: {
    "/leituras/*": "/posts/pt_br/$1",
    "/posts/pt_br/akita-ia-prompt-fim-programador-bracal.html": "/posts/pt_br/fabio-akita-flow-588.html",
    "/posts/original/akita-ai-prompts-end-of-grunt-work-programming.html": "/posts/original/fabio-akita-flow-588.html",
  },
});
```

- [ ] **Step 6: Instalar e testar local**

Run:
```bash
cd ~/Code/video-to-text/workers/markdown-agent
rm src/index.js  # não precisamos mais do JS
npm install
npx wrangler dev --port 8787 &
sleep 3
curl -s -H "Accept: text/markdown" http://localhost:8787/posts/pt_br/fabio-akita-flow-588.html | head -20
```

Expected: output tem `---` frontmatter + heading + conteúdo traduzido.

Kill o wrangler dev: `kill %1`.

- [ ] **Step 7: Deploy produção**

Run:
```bash
npx wrangler deploy
```

Verifique em produção:
```bash
curl -s -H "Accept: text/markdown" https://adhenawer.net/posts/pt_br/fabio-akita-flow-588.html | head -20
```

- [ ] **Step 8: Commit no video-to-text**

```bash
cd ~/Code/video-to-text
git add workers/markdown-agent
git rm workers/markdown-agent/src/index.js.bak
git commit -m "refactor(workers): migrate markdown-agent to @adhenawer/markdown-edge-for-agents"
git push
```

---

## Task 6.3: Gravar GIF de demo

**Files:**
- Create: `docs/demo.gif`

- [ ] **Step 1: Criar asciicast**

Instale asciinema:
```bash
brew install asciinema agg
```

Grave sessão mostrando:
```bash
asciinema rec demo.cast
# Em outro terminal:
cd /tmp && mkdir demo && cd demo
echo '{"dependencies":{"astro":"^4"}}' > package.json
npx create-markdown-edge-for-agents init
# Responda prompts rapidamente
cat workers/markdown-agent/src/index.ts
# Ctrl+D pra parar asciinema
```

- [ ] **Step 2: Converter pra GIF**

Run:
```bash
agg demo.cast demo.gif --cols 80 --rows 24
mv demo.gif ~/Code/markdown-edge-for-agents/docs/demo.gif
```

- [ ] **Step 3: Atualizar README pra referenciar o GIF**

Adicione no topo do README após o título:
```markdown
![demo](./docs/demo.gif)
```

- [ ] **Step 4: Commit**

```bash
cd ~/Code/markdown-edge-for-agents
git add docs/demo.gif README.md
git commit -m "docs: add demo GIF"
git push
```

---

## Task 6.4: Launch

- [ ] **Step 1: Criar Release v0.1.0 no GitHub**

Via `gh`:
```bash
gh release create v0.1.0 --title "v0.1.0 — First public release" --notes "First release of markdown-edge-for-agents. Free tier alternative to Cloudflare's Pro 'Markdown for Agents' feature. Drop-in compat, scaffolder CLI, Astro/Hugo/custom presets."
```

- [ ] **Step 2: Thread de launch no X**

Template (guardar em `docs/launch-x.md` como referência):
```
I built an open-source version of Cloudflare's "Markdown for Agents" that works on the Free tier.

Why: CF's native feature is Pro-only ($25/mo per zone). Indie hackers on Free get nothing.

One command: npx create-markdown-edge-for-agents init

Drop-in compat with CF's headers. Works with Astro, Hugo, custom sites.

Live demo on my blog: curl -H "Accept: text/markdown" https://adhenawer.net/posts/pt_br/fabio-akita-flow-588.html

Repo: https://github.com/adhenawer/markdown-edge-for-agents
```

- [ ] **Step 3: HN post**

Template em `docs/launch-hn.md`:
```
Title: Show HN: markdown-edge-for-agents – Cloudflare's Pro feature, for the Free tier

Body:
I kept wanting to serve markdown to AI agents hitting my blog, but Cloudflare's native "Markdown for Agents" feature is Pro-only ($25/mo per zone). I wrote this as an alternative for Free tier users.

Key differentiators from existing OSS workers:
- `npx create-markdown-edge-for-agents init` — deploys a working worker in ~60s
- Headers (`x-markdown-tokens`, `Content-Signal`, `Vary: Accept`) match CF's native feature 1:1, so migrating to Pro later is trivial
- HTMLRewriter streaming (not regex/Turndown) — accurate and fast
- Astro + Hugo presets built-in; custom for everything else

Current limitations:
- CF Workers only in v1 (Vercel Edge, Deno Deploy on roadmap)
- Server-rendered HTML only (no SPA/hydration support)

Using it live on my blog. Feedback welcome.
```

- [ ] **Step 4: r/selfhosted + r/CloudFlare post**

Criar threads com pitch similar, mencionando Free tier angle e repo.

- [ ] **Step 5: Monitorar primeiros 24h**

Checklist:
- Responder comentários rápido
- Abrir issues para bugs reportados
- Track stars: `gh api repos/adhenawer/markdown-edge-for-agents | jq .stargazers_count`

---

## Self-review do plano (2026-04-15)

### 1. Spec coverage check

| Seção do DESIGN | Tarefa(s) |
|---|---|
| §1 Escopo v1 | Phase 0-6 cobrem tudo |
| §2.1 Converter core (via dep `markdown-for-agents`) | Tasks 1.1–1.4 |
| §2.2 Config | Tasks 2.1, 2.3 |
| §2.3 Presets | Task 2.2 |
| §2.4 Worker factory | Tasks 3.1–3.4 |
| §2.5 Scaffolder | Tasks 4.1–4.5 |
| §3 Data flow (redirects, negotiate, guards, lifecycle) | Tasks 3.1, 3.2, 3.4 |
| §4 Error handling, edge cases, limits | Task 3.4 (try/catch fallback, maxOriginBytes, guards) |
| §5 Testes e CI | Tasks 1.1–4.5 (unit/integration TDD) + 5.5 (CI) |
| §5 Release flow (changesets) | Task 6.1 |
| §1 Dogfood | Task 6.2 |
| §1 Launch (HN + ≥1 comentário) | Task 6.4 |

✅ Todos cobertos. §2.1 agora delegado a `markdown-for-agents` (upstream), isolado via adapter fino em Task 1.1.

### 2. Placeholder scan

- [x] Zero "TBD", "TODO", "implement later"
- [x] Todos exemplos de código completos (não fragmentos)
- [x] Comandos bash com expected output explícito
- [x] Task 5.2 e 5.3 dizem "análogo ao 5.1 alterando X Y Z" — aceitável porque lista exatamente o que muda
- [x] Task 1.1 nota que assinatura exata de `convert()` da lib upstream pode variar entre versões — validação via `npm view` documentada

### 3. Type consistency

- [x] `createMarkdownWorker(config)` consistente entre Task 3.4 (implementação), 5.4 (README), 6.2 (dogfood)
- [x] `UserConfig`, `ResolvedConfig`, `PresetName` mencionados consistentemente
- [x] `ConversionResult` tem `markdown`, `tokens`, `meta` — bate em 1.1, 3.4
- [x] Preset shape (`selector`, `strip`, `frontmatter`) bate em 2.2, 2.3, 5.4

### 4. Ambiguity check

- [x] TDD flow explícito em todas as tasks (RED → GREEN → COMMIT)
- [x] Bash commands têm paths absolutos quando ambiguo (cd pra `video-to-text` explícito)
- [x] Package names (`@adhenawer/markdown-edge-for-agents` vs `create-markdown-edge-for-agents`) sempre qualificados
- [x] `preset: "custom"` shape documentado (baseline vazio)
- [x] Adapter pattern documentado: trocar lib upstream = editar 1 arquivo (`packages/core/src/converter/index.ts`)

### 5. Build-vs-buy tradeoff documented

- [x] Decisão de usar `markdown-for-agents` como dep justificada no header do plano
- [x] Mitigação de risco (adapter fino) explícita em Task 1.1
- [x] Validação de CF Workers compat em Task 1.4 (Step 5-6 via miniflare)
- [x] Phase 1 passou de 11 tasks / 1.5 weekends → 4 tasks / 0.5 weekend

### Resultado

Plano pronto pra execução. Escopo agora cabe confortavelmente no budget (4.5 weekends estimados pra budget 4-6 — sobra margem pra polish pré-launch). Todas as decisões do DESIGN têm task correspondente.
