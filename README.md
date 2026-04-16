# markdown-edge-for-agents

> Markdown for Agents, on any Edge. Free tier ready.

Drop-in alternativa open source para o feature [Markdown for Agents da Cloudflare](https://blog.cloudflare.com/markdown-for-agents/) (só Pro+). Serve markdown para AI agents via content negotiation, compat 1:1 com a API oficial.

[![CI](https://github.com/adhenawer/markdown-edge-for-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/adhenawer/markdown-edge-for-agents/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-pre--release-orange.svg)](#roadmap)

> **Status:** Pre-release. `v0.1.0` ainda não publicado no npm — use via workspace protocol local por enquanto.

_(demo GIF coming soon)_

## Quick start

```bash
npx create-markdown-edge-for-agents init
```

Detecta seu framework (Astro, Hugo, ou custom), gera o worker + wrangler.toml, instala deps, aponta pro deploy.

## Por que

- Cloudflare's "Markdown for Agents" custa $25/mês (Pro) por zone
- Indie hackers em Free tier ficam de fora
- Workers OSS existentes não têm DX de 1 comando nem compat 1:1 com API oficial

## Uso como lib

```ts
import { createMarkdownWorker } from "@adhenawer/markdown-edge-for-agents";

export default createMarkdownWorker({
  preset: "custom",
  selector: "article",
  strip: [".ad", "nav", "footer"],
});
```

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
| Content negotiation via `Accept` | Yes | Yes |
| `x-markdown-tokens` header | Yes | Yes |
| `Content-Signal` header | Yes | Yes |
| `Vary: Accept` caching | Yes | Yes |
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
