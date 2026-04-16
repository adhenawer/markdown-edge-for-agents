# create-markdown-edge-for-agents

> Scaffold a Markdown-for-Agents worker in one command.

CLI companion to [`@adhenawer-pkg/markdown-edge-for-agents`](https://www.npmjs.com/package/@adhenawer-pkg/markdown-edge-for-agents). Detects your framework, generates a Cloudflare Worker with the right preset, installs dependencies, and points you to deploy.

[![CI](https://github.com/adhenawer/markdown-edge-for-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/adhenawer/markdown-edge-for-agents/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/create-markdown-edge-for-agents.svg)](https://npmjs.com/package/create-markdown-edge-for-agents)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/adhenawer/markdown-edge-for-agents/blob/main/LICENSE)

## Quick start

```bash
npx create-markdown-edge-for-agents init
```

That's it. The CLI will:

1. Detect your framework (Astro, Hugo, or custom)
2. Ask for your Cloudflare zone and route patterns
3. Generate a worker at `workers/markdown-agent/`
4. Install dependencies
5. Print next steps for deployment

## What it generates

```
workers/markdown-agent/
├── src/
│   └── index.ts          # 5-line worker using the lib
├── wrangler.toml          # Configured with your zone + routes
└── package.json           # With @adhenawer-pkg/markdown-edge-for-agents dep
```

### Generated worker (Astro example)

```ts
import { createMarkdownWorker } from "@adhenawer-pkg/markdown-edge-for-agents";

export default createMarkdownWorker({
  preset: "astro",
});
```

### Generated wrangler.toml

```toml
name = "markdown-agent"
main = "src/index.ts"
compatibility_date = "2026-04-15"

routes = [
  { pattern = "yoursite.com/posts/*", zone_name = "yoursite.com" }
]
```

## Framework detection

The CLI auto-detects your framework:

| Signal | Detected as |
|---|---|
| `astro` in package.json dependencies | Astro |
| `hugo.toml`, `hugo.yaml`, or `config.toml` present | Hugo |
| Nothing matches | Custom (you configure selectors manually) |

## Deploy

After scaffolding:

```bash
cd workers/markdown-agent
npx wrangler login      # First time only
npx wrangler deploy
```

## Verify

```bash
# Should return markdown with YAML frontmatter
curl -H "Accept: text/markdown" https://yoursite.com/any-page.html

# Should return normal HTML (browser behavior)
curl https://yoursite.com/any-page.html
```

## Aliases

Both commands work:

```bash
npx create-markdown-edge-for-agents init
npx mdea init
```

## What this does NOT do

- Does not modify your existing site or HTML
- Does not require a Cloudflare Pro plan (works on Free tier)
- Does not send any data to third parties
- Does not run any background processes

The generated worker runs entirely on Cloudflare's edge network, intercepting requests only when AI agents ask for markdown.

## Requirements

- Node.js 22+
- A Cloudflare account (Free tier works)
- A site deployed behind Cloudflare DNS

## Related

- [`@adhenawer-pkg/markdown-edge-for-agents`](https://www.npmjs.com/package/@adhenawer-pkg/markdown-edge-for-agents) — the core library
- [GitHub repo](https://github.com/adhenawer/markdown-edge-for-agents) — source code, examples, contributing guide

## License

MIT
