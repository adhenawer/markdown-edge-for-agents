# @adhenawer-pkg/markdown-edge-for-agents

> Markdown for Agents, on any Edge. Free tier ready.

Drop-in open-source alternative to Cloudflare's [Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) feature (Pro+ only, $25/mo per zone). Serves markdown to AI agents via `Accept: text/markdown` content negotiation. 1:1 compatible with Cloudflare's official headers.

[![CI](https://github.com/adhenawer/markdown-edge-for-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/adhenawer/markdown-edge-for-agents/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@adhenawer-pkg/markdown-edge-for-agents.svg)](https://npmjs.com/package/@adhenawer-pkg/markdown-edge-for-agents)
[![npm downloads](https://img.shields.io/npm/dm/@adhenawer-pkg/markdown-edge-for-agents.svg)](https://npmjs.com/package/@adhenawer-pkg/markdown-edge-for-agents)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/adhenawer/markdown-edge-for-agents/blob/main/LICENSE)

## Install

```bash
npm install @adhenawer-pkg/markdown-edge-for-agents
```

## Usage

Create a Cloudflare Worker that serves markdown to AI agents:

```ts
import { createMarkdownWorker } from "@adhenawer-pkg/markdown-edge-for-agents";

export default createMarkdownWorker({
  preset: "astro",
});
```

That's it. When an AI agent requests your page with `Accept: text/markdown`, it gets clean markdown with YAML frontmatter. Browsers get the original HTML unchanged.

### Custom config

```ts
export default createMarkdownWorker({
  preset: "custom",
  selector: "article",
  strip: [".ad-banner", "nav", "footer", ".cookie-notice"],
  frontmatter: ["title", "author", "description", "lang"],
  redirects: {
    "/old-blog/*": "/posts/$1",
  },
});
```

## How it works

1. Agent sends `GET /post.html` with `Accept: text/markdown`
2. Worker fetches original HTML from your origin
3. HTML is converted to clean markdown (via [markdown-for-agents](https://github.com/kkonstantinov/markdown-for-agents))
4. Metadata extracted from `<head>` becomes YAML frontmatter
5. Response includes Cloudflare-compatible headers

```
$ curl -H "Accept: text/markdown" https://yoursite.com/post.html

---
title: "My Post"
author: "Jane"
source: "https://yoursite.com/post.html"
lang: en
---

# My Post

Content here...
```

## Presets

Built-in presets configure `selector` and `strip` for popular frameworks:

| Preset | Selector | Strips |
|---|---|---|
| `astro` | `article`, `main[data-page-type='post']`, `main.content` | nav, header, footer, aside, script, style, [aria-hidden] |
| `hugo` | `article`, `main .post-content`, `main.single` | nav, header.site-header, footer, .post-nav, .social-share |
| `custom` | `article` | _(empty — you define)_ |

## Config reference

| Option | Type | Default | Description |
|---|---|---|---|
| `preset` | `"astro" \| "hugo" \| "custom"` | **required** | Base config |
| `selector` | `string` | from preset | CSS selector for content area |
| `strip` | `string[]` | from preset | Elements to remove before converting |
| `frontmatter` | `string[]` | `["title","author","description","lang"]` | YAML frontmatter fields |
| `redirects` | `Record<string, string>` | `{}` | 301 redirects (run before negotiation) |
| `forceMarkdownForUserAgents` | `RegExp[]` | `[]` | Force markdown for specific user agents |
| `autoDetectAiCrawlers` | `boolean` | `false` | Auto-serve markdown to known AI bots (see below) |
| `cache` | `{ maxAge, staleWhileRevalidate }` | `{ 3600, 86400 }` | Cache-Control values |
| `debug` | `boolean` | `false` | Adds extra debug headers |

## AI crawler auto-detection

Most AI crawlers **don't send `Accept: text/markdown`** — they fetch your page as a browser would and parse the noisy HTML. Cloudflare's Pro feature only responds to that header, making it nearly useless in practice ([source](https://dri.es/markdown-llms-txt-and-ai-crawlers)).

Enable `autoDetectAiCrawlers` to serve clean markdown automatically when a known AI bot visits:

```ts
export default createMarkdownWorker({
  preset: "astro",
  autoDetectAiCrawlers: true,
});
```

### Built-in crawler list (16 bots)

| Provider | User-Agent patterns |
|---|---|
| OpenAI | `GPTBot`, `ChatGPT-User`, `OAI-SearchBot` |
| Anthropic | `ClaudeBot`, `Claude-Web`, `anthropic-ai` |
| Google | `Google-Extended`, `Googlebot-AI` |
| Perplexity | `PerplexityBot` |
| Apple | `Applebot-Extended` |
| Cohere | `cohere-ai` |
| Meta | `Meta-ExternalAgent`, `FacebookExternalHit` |
| Amazon | `Amazonbot` |
| Common Crawl | `CCBot` |
| ByteDance | `Bytespider` |
| Microsoft | `bingbot` |
| You.com | `YouBot` |

The list is exported as `KNOWN_AI_CRAWLERS` for transparency:

```ts
import { KNOWN_AI_CRAWLERS } from "@adhenawer-pkg/markdown-edge-for-agents";
console.log(KNOWN_AI_CRAWLERS); // RegExp[]
```

You can also combine auto-detection with custom patterns:

```ts
export default createMarkdownWorker({
  preset: "custom",
  selector: "article",
  autoDetectAiCrawlers: true,
  forceMarkdownForUserAgents: [/MyInternalBot/i],
});
```

### Comparison with Cloudflare Pro

| Behavior | Cloudflare Pro | This lib |
|---|---|---|
| Responds to `Accept: text/markdown` | Yes | Yes |
| Auto-serves markdown to AI crawlers by User-Agent | **No** | **Yes (16 bots)** |

This is a real differentiator: your content reaches AI systems in clean markdown even when they don't explicitly ask for it.

## Response headers (1:1 Cloudflare compat)

| Header | Value | Purpose |
|---|---|---|
| `Content-Type` | `text/markdown; charset=utf-8` | MIME type |
| `x-markdown-tokens` | `6062` | Estimated token count |
| `x-markdown-version` | `0.1.0` | Lib version |
| `x-markdown-preset` | `astro` | Active preset |
| `Content-Signal` | `ai-train=yes, search=yes, ai-input=yes` | AI opt-in signal |
| `Vary` | `Accept` | Correct caching (HTML vs MD) |
| `Cache-Control` | `public, max-age=3600, stale-while-revalidate=86400` | Configurable |

These match Cloudflare's native Pro feature, so migrating to Pro later is trivial — just flip the toggle and remove the worker.

## Error handling

- **Origin errors** (404, 5xx): passed through unchanged
- **No article found** (selector didn't match): returns 404
- **Conversion error**: falls back to original HTML with `x-markdown-error` header
- **Non-HTML origin**: passed through unchanged
- **Oversized content** (>10MB): returns 413

## Quick start with scaffolder

Don't want to set up manually? Use the companion CLI:

```bash
npx create-markdown-edge-for-agents init
```

Detects your framework, generates the worker, installs deps, and deploys.

## Requirements

- Cloudflare Workers (Free tier works)
- Node.js 22+ (for development)
- wrangler 4+ (for deployment)

## Roadmap

- **v1.x**: Cloudflare Workers
- **v2.x**: Multi-runtime (Vercel Edge, Deno Deploy, Bun, Node)
- **Community**: more presets (Jekyll, 11ty, Next.js, Ghost)

## Live demo

This lib powers [adhenawer.net](https://adhenawer.net):

```bash
curl -H "Accept: text/markdown" https://adhenawer.net/posts/pt_br/fabio-akita-flow-588.html
```

## License

MIT - [GitHub](https://github.com/adhenawer/markdown-edge-for-agents)
