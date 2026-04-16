# Contributing

## Setup

```bash
pnpm install
pnpm test
```

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
