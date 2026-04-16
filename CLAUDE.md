# CLAUDE.md — markdown-edge-for-agents

Open-source lib + CLI scaffolder that serves markdown to AI agents via content negotiation on Cloudflare Workers. Free-tier alternative to Cloudflare's Pro "Markdown for Agents" feature.

## Architecture

```
markdown-edge-for-agents/
├── packages/
│   ├── core/                  # @adhenawer-pkg/markdown-edge-for-agents (npm)
│   │   ├── src/
│   │   │   ├── converter/     # HTML→MD adapter (wraps markdown-for-agents)
│   │   │   ├── config/        # Zod schema, resolver, types
│   │   │   ├── presets/       # astro, hugo, custom
│   │   │   ├── worker/        # factory, negotiate, redirects, headers
│   │   │   └── index.ts       # public re-exports
│   │   └── tests/
│   │       ├── unit/
│   │       ├── integration/
│   │       └── setup.ts       # HTMLRewriter polyfill for Node tests
│   └── create/                # create-markdown-edge-for-agents (npm CLI)
│       ├── src/
│       │   ├── detect.ts      # framework detection (astro/hugo/custom)
│       │   ├── prompts.ts     # interactive CLI flow
│       │   ├── scaffold.ts    # generate worker files from templates
│       │   ├── templates/     # .tmpl files for worker, wrangler, package.json
│       │   └── index.ts       # CLI entry (shebang added by tsup, NOT in source)
│       └── tests/
├── examples/                  # 3 example workers (custom, astro, hugo)
├── docs/                      # DESIGN.md, PLAN.md, EXECUTION-LOG.md
└── .github/workflows/         # ci.yml (auto), release.yml (manual dispatch)
```

## Tech stack

| Layer | Tool | Version |
|---|---|---|
| Runtime | Cloudflare Workers (workerd) | — |
| Language | TypeScript | ^5.5 |
| Package manager | pnpm (workspaces) | 9.12 |
| Build | tsup | ^8.3 |
| Tests | vitest + miniflare | ^2.1 |
| Lint + format | biome | ^1.9 |
| Validation | zod | ^3.23 |
| HTML→MD | markdown-for-agents (upstream dep) | ^1.3.4 |
| Versioning | changesets | ^2.27 |
| Target | ES2022 | — |
| Node | >=22 | — |

## Key design decisions

### Converter is NOT ours
We use `markdown-for-agents` as a dependency for HTML→Markdown conversion. Our value-add is the worker factory, config system, presets, scaffolder, and CF-compat headers. The converter is isolated behind a thin adapter in `packages/core/src/converter/index.ts` — if the upstream lib ever needs replacing, only that file changes.

### HTMLRewriter has regex fallback
`extractMeta` and `cleanAndDetect` auto-detect the runtime:
- CF Workers → native HTMLRewriter (streaming, precise)
- Node/Bun/Deno → regex fallback (covers tag, .class, tag.class selectors)

Never throw if HTMLRewriter is unavailable. Always fallback gracefully.

### Selector means "gate", not "scope"
The upstream `markdown-for-agents` lib uses heuristic extraction — it doesn't support CSS selector scoping. Our `selector` config field acts as a **presence gate**: if no element matches, return `null`. The upstream heuristic handles actual content extraction. This works well for `article`/`main` patterns but may include surrounding content for exotic selectors.

### autoDetectAiCrawlers
`KNOWN_AI_CRAWLERS` in `worker/negotiate.ts` contains 16 regex patterns for known AI bot User-Agents. When `autoDetectAiCrawlers: true`, these bots get markdown without needing `Accept: text/markdown`. This is a key differentiator vs CF Pro. The list is exported publicly for transparency.

### Presets are data, not code
Each preset (`presets/astro.ts`, etc.) is a plain object with `selector`, `strip`, `frontmatter`. No logic. Adding a preset = one new file + register in `presets/index.ts` + add to schema enum in `config/schema.ts` + add to types in `config/types.ts`.

## Conventions

### Code style
- **Biome** handles lint + format. Run `pnpm lint` and `pnpm format` before committing.
- **No eslint, no prettier** — biome replaces both.
- Indent: 2 spaces. Line width: 100.
- Imports auto-organized by biome.

### TDD mandatory
Every feature or bugfix follows RED → GREEN → REFACTOR → COMMIT:
1. Write the failing test first
2. Run it, see it fail
3. Implement the minimum to pass
4. Run tests, see green
5. Commit

PRs without tests will be flagged.

### Commit messages
Follow conventional commits:
```
feat(core): add new preset for Jekyll
fix(create): handle missing package.json gracefully
test(core): add edge case for nested lists
docs: update README with new config option
chore: bump dependencies
style: apply biome autofix
ci: fix workflow pnpm version
```

Scope: `core`, `create`, or omit for root-level changes.

### File organization
- Source in `src/`, tests in `tests/` (mirror structure: `src/worker/negotiate.ts` → `tests/unit/worker/negotiate.test.ts`)
- Integration tests in `tests/integration/` with HTML fixtures in `tests/integration/fixtures/`
- One responsibility per file. If a file grows past ~150 lines, consider splitting.

### Package boundaries
- `packages/core/` — zero CLI dependencies (no `prompts`, `execa`, `kleur`). Only runtime deps: `markdown-for-agents`, `zod`.
- `packages/create/` — CLI-only. Never import from core at runtime (only references the package name as a string in templates).
- Examples use `workspace:*` protocol locally, `^X.Y.Z` when scaffolded for real users.

## How to add a new preset

1. Create `packages/core/src/presets/<name>.ts`:
   ```ts
   export const <name>Preset = {
     selector: "article",
     strip: ["nav", "footer"],
     frontmatter: ["title", "author"],
   } as const;
   ```
2. Register in `packages/core/src/presets/index.ts`
3. Add to `PresetName` type in `packages/core/src/config/types.ts`
4. Add to zod enum in `packages/core/src/config/schema.ts`
5. Add tests in `packages/core/tests/unit/presets/`
6. Add example in `examples/<name>-site/`
7. Update root README preset table
8. Add fixture HTML in `tests/integration/fixtures/<name>-post.html`

## How to add a new AI crawler

Edit `KNOWN_AI_CRAWLERS` array in `packages/core/src/worker/negotiate.ts`. Add a regex pattern with `i` flag. Include a comment with the provider name. No other files need changing.

## Running locally

```bash
# Install
pnpm install

# Run all tests
pnpm test

# Typecheck
pnpm typecheck

# Lint
pnpm lint

# Build
pnpm build

# Fix lint/format issues
pnpm format
```

## Testing

- **Unit tests** (`tests/unit/`): pure function tests, fast, no I/O
- **Integration tests** (`tests/integration/`): use miniflare to emulate CF Workers, test full request lifecycle
- **HTMLRewriter polyfill**: `tests/setup.ts` installs `html-rewriter-wasm` as `globalThis.HTMLRewriter` for vitest (Node). Production uses the native CF global.
- **Coverage threshold**: 85% lines/functions/statements, 80% branches (enforced in `vitest.config.ts`)

## Publishing

1. `pnpm changeset` — describe the change
2. Commit the changeset file
3. Merge to main
4. Manually trigger Release workflow in GitHub Actions (requires `NPM_TOKEN` secret)
5. Or publish locally: `pnpm build && cd packages/core && npm publish --access public`

Both packages are published independently:
- `@adhenawer-pkg/markdown-edge-for-agents` — the lib
- `create-markdown-edge-for-agents` — the CLI

## Dogfood

This lib powers [adhenawer.net](https://adhenawer.net). The worker config lives in `github.com/adhenawer/video-to-text/workers/markdown-agent/src/index.ts`. Test production:

```bash
curl -H "Accept: text/markdown" https://adhenawer.net/posts/original/head-claude-code-happens-after-coding-solved.html | head -20
```

## Do NOT

- Add runtime deps to `packages/core/` without discussion (bundle size matters for CF Workers)
- Use HTMLRewriter without a regex fallback (breaks Node/Bun/Deno)
- Put shebang in `packages/create/src/index.ts` (tsup banner handles it — double shebang breaks the binary)
- Skip TDD
- Push to main without CI green
- Hardcode User-Agent strings outside of `KNOWN_AI_CRAWLERS` — keep the list centralized
- Add Readability/Defuddle/ML-based extraction (out of scope for v1, keep it simple)
