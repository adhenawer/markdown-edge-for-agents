# Contributing

## Setup

```bash
pnpm install
pnpm test
```

## Rules

- **TDD is mandatory** — tests first, implementation second.
- Use `pnpm changeset` to document changes before opening a PR.
- Lint: `pnpm lint`. Format: `pnpm format`.

## Adding a preset

1. Create `packages/core/src/presets/<name>.ts` following the pattern of existing presets
2. Register it in `packages/core/src/presets/index.ts`
3. Update the enum in `packages/core/src/config/schema.ts` and `types.ts`
4. Add tests in `packages/core/tests/unit/presets/`
5. Add an example in `examples/<name>-site/`
6. PR with changeset
