# markdown-edge-for-agents — Design Spec

**Status:** rascunho vivo (brainstorming em andamento).
**Data:** 2026-04-15
**Autor:** adhenawer + Claude (via superpowers:brainstorming)

---

## Índice

1. [Visão geral e wedge](#1-visão-geral-e-wedge) ✅ aprovada
2. [Arquitetura de componentes](#2-arquitetura-de-componentes) ✅ aprovada
3. [Data flow e lifecycle de request](#3-data-flow-e-lifecycle-de-request) ✅ aprovada
4. [Error handling, observabilidade e edge cases](#4-error-handling-observabilidade-e-edge-cases) ✅ aprovada
5. [Estratégia de testes e CI](#5-estratégia-de-testes-e-ci) ✅ aprovada

---

## 1. Visão geral e wedge

### Problema

Cloudflare lançou "Markdown for Agents" em fev/2026 como feature **Pro+ only** ($25/mês por zone). Indie hackers e blogs em Free tier querem o mesmo sem pagar. Existem 5+ workers OSS (`aivorynet/cloudflare-ai-markdown-worker`, `thieung/defuddle`, `thekevinm/HTML-to-MD-AI`, etc.) mas nenhum tem:

- DX de "1 comando" (todos exigem clone + edit)
- Compat 1:1 com API oficial CF (migração trivial pra Pro depois)
- Roadmap multi-runtime (CF-only hoje)

### Solução

Biblioteca runtime-agnostic + scaffolder CLI. Deploya worker em ~60s. Headers compat 1:1 com Cloudflare nativo. Runtime: CF Workers (v1), Vercel Edge / Deno Deploy / Bun (v2+).

### Wedge primário

> *"Markdown for Agents, on any Edge. Free tier ready. Drop-in compat with Cloudflare's Pro feature."*

### Escopo explícito

**v1 ships:**
- Converter HTML→MD com `HTMLRewriter` nativo (streaming, zero deps runtime)
- Content negotiation via `Accept: text/markdown` header
- Config declarativa: selectors, strip, frontmatter, redirects
- 3 presets: `astro`, `hugo`, `custom`
- Scaffolder interativo: `npx create-markdown-edge-for-agents init`
- Tests com vitest + miniflare, ≥80% coverage
- Docs com README + 1 GIF + 3 examples

**Fora de v1 (roadmap):**
- Multi-runtime (Vercel Edge, Deno, Bun, Node)
- Mais presets (Jekyll, 11ty, Next, Ghost) — via PR da comunidade
- Auto-geração de `llms.txt`
- Cache integration custom (v1 usa Cache API nativa)
- GitHub Action / CLI standalone pra test local
- Web playground
- Telemetria opt-in
- Fallback ML-based (Readability/Defuddle)

### Success criteria v1

- [x] `video-to-text` rodando em produção consumindo a lib (dogfood validado)
- [x] `npx create-markdown-edge-for-agents init` deploya worker funcional em <60s em repo limpo
- [x] Headers `x-markdown-tokens`, `Content-Signal`, `Vary: Accept` idênticos ao produto CF
- [x] 3 presets funcionais (astro, hugo, custom) com exemplo testado end-to-end
- [x] ≥80% test coverage no core

---

## 2. Arquitetura de componentes

### Visão de alto nível

```
┌─────────────────────────────────────────────────────────────────┐
│                   @adhenawer-pkg/markdown-edge-for-agents            │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐   │
│  │ Preset Store │──▶│ Config Loader │──▶│  Worker Factory    │   │
│  │ (astro,hugo, │   │  (validate +  │   │ createMarkdownWorker│  │
│  │  custom)     │   │   normalize)  │   │  (returns fetch)    │  │
│  └──────────────┘   └──────────────┘   └──────────┬──────────┘  │
│                                                    │             │
│                                          ┌─────────▼─────────┐   │
│                                          │   Converter Core   │   │
│                                          │   (HTMLRewriter    │   │
│                                          │    pipeline)       │   │
│                                          └─────────┬─────────┘   │
│                                                    │             │
│                          ┌─────────────────────────┼──────────┐  │
│                          ▼                         ▼          ▼  │
│                  ┌───────────────┐  ┌────────────────┐  ┌──────┐ │
│                  │ Frontmatter   │  │ Strip Selectors│  │Token │ │
│                  │ Builder       │  │ Handler        │  │Counter│ │
│                  └───────────────┘  └────────────────┘  └──────┘ │
└─────────────────────────────────────────────────────────────────┘
                         ▲
                         │ imports
                         │
      ┌──────────────────┼──────────────────┐
      │                                      │
┌─────▼──────┐                        ┌──────▼─────────────────┐
│ Your Worker │                        │ create-markdown-       │
│ (10 lines)  │                        │ edge-for-agents (CLI)  │
│             │                        │  - detect framework    │
│             │                        │  - scaffold worker     │
│             │                        │  - gen wrangler.toml   │
└─────────────┘                        │  - offer deploy        │
                                       └─────────────────────────┘
```

### Componentes e responsabilidades

#### 1. `converter/` — núcleo

**O que faz:** recebe HTML string + config resolvido → devolve markdown string + token count.

**Interface pública:**
```ts
function convertHtmlToMarkdown(html: string, config: ResolvedConfig): {
  markdown: string;
  tokens: number;
  meta: { title, author, description, lang };
};
```

**Depende de:** HTMLRewriter (CF Workers global) ou `@worker-tools/html-rewriter` (fallback pra tests em Node via miniflare).

**Isolamento:** pure function. Zero I/O. Testável com string input/output.

#### 2. `config/` — loader + validator

**O que faz:** pega `UserConfig` (do `createMarkdownWorker`), mescla com preset escolhido, valida com zod, devolve `ResolvedConfig` canônico.

**Interface:**
```ts
function resolveConfig(user: UserConfig): ResolvedConfig;
```

**Depende de:** `presets/` + zod.

**Isolamento:** pure. Erros de config viram exception clara no startup do worker.

#### 3. `presets/` — catálogo de configs

**O que faz:** exporta configs por framework. Cada preset é um objeto tipado.

**Formato:**
```ts
export const astroPreset: PresetConfig = {
  selector: "article, main[data-page-type='post']",
  strip: [".astro-header", "nav", "footer[class*='astro']"],
  frontmatter: ["title", "description", "pubDate", "author"],
};
```

**v1 ships:** `astro`, `hugo`, `custom` (que é efetivamente vazio).

**Isolamento:** dados puros, sem lógica. Novo preset = arquivo novo + export.

#### 4. `worker/` — factory

**O que faz:** recebe `UserConfig`, devolve objeto `ExportedHandler` compatível com CF Workers.

**Interface pública (o que o usuário importa):**
```ts
export function createMarkdownWorker(config: UserConfig): ExportedHandler;
```

**Comportamento:** no `fetch`, decide se a request quer markdown (`Accept: text/markdown`), busca origem, invoca converter, devolve response com headers compat-CF (`x-markdown-tokens`, `Content-Signal`, `Vary`, `Cache-Control`).

**Isolamento:** orquestração apenas — delega tudo pro converter.

#### 5. `scaffolder/` — CLI separado (npm bin)

**O que faz:** `npx create-markdown-edge-for-agents init` interativo.

**Passos:**
1. Detecta se tá em repo git + qual framework (lê `package.json` deps: astro? hugo config?)
2. Pergunta: preset (auto-detectado ou custom), CF zone, path do worker
3. Cria `workers/markdown-agent/` com `wrangler.toml` + `src/index.ts` + `package.json` (já com a lib como dep)
4. Roda `npm install` automaticamente
5. Oferece `wrangler deploy` no fim

**Depende de:** `prompts`, `execa`, `cosmiconfig`. Não depende do core (só sabe o nome do pacote pra gerar import).

**Isolamento:** package separado no monorepo (`packages/create/`) — permite manter independentemente.

### Estrutura do monorepo

```
markdown-edge-for-agents/
├── packages/
│   ├── core/                          # @adhenawer-pkg/markdown-edge-for-agents
│   │   ├── src/
│   │   │   ├── converter/
│   │   │   ├── config/
│   │   │   ├── presets/
│   │   │   ├── worker/
│   │   │   └── index.ts               # re-exports públicos
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsup.config.ts
│   └── create/                        # create-markdown-edge-for-agents
│       ├── src/
│       │   ├── detect.ts              # detecta framework
│       │   ├── prompts.ts             # fluxo interativo
│       │   ├── scaffold.ts            # gera arquivos
│       │   └── index.ts               # entry CLI
│       ├── templates/                 # templates de wrangler.toml, index.ts, etc
│       └── package.json
├── examples/
│   ├── custom-site/                   # exemplo genérico custom
│   ├── astro-blog/                    # exemplo preset astro
│   └── hugo-blog/                     # exemplo preset hugo
├── .github/workflows/                 # CI: test + build + publish
├── README.md
├── package.json                       # workspace root (pnpm workspaces)
└── pnpm-workspace.yaml
```

**Workspaces via pnpm** — `core` e `create` em pacotes separados, versionados via changesets.

### Decisões arquiteturais

| Decisão | Alternativa | Razão |
|---|---|---|
| Monorepo com pnpm workspaces | Dois repos separados | Changesets sincroniza versões, teste cross-package em CI, refactor mais fácil |
| TypeScript com tsup | JavaScript puro ou vite-lib | Autocomplete do config é valor grande, tsup compila bundle CF Workers-ready |
| Zod pra validar config | Validação manual | Erros claros no startup, tipagem runtime + compile-time |
| HTMLRewriter native | Regex / Turndown | Streaming, correção, zero deps (nativo CF Workers) |
| Scaffolder em package separado | Dentro do core | `npm install @adhenawer-pkg/markdown-edge-for-agents` não puxa deps de CLI (`prompts`, `execa`) |
| Presets como data, não code | Classes/funções | Fácil de serializar/inspecionar, PR da comunidade é arquivo único |

### Unidades isolavelmente testáveis

Cada componente pode ser testado sem os outros:

- **converter:** input HTML + config → assert markdown output
- **config:** input UserConfig → assert ResolvedConfig ou throw
- **presets:** assert shape + valores fixos
- **worker factory:** mock fetch origin → assert Response com headers corretos
- **scaffolder:** mock filesystem + prompts → assert arquivos gerados

### Como o `video-to-text` consome

```bash
cd video-to-text/workers/markdown-agent
npm install @adhenawer-pkg/markdown-edge-for-agents
```

`src/index.ts` (substitui os 180 linhas regex por ~10):
```ts
import { createMarkdownWorker } from "@adhenawer-pkg/markdown-edge-for-agents";

export default createMarkdownWorker({
  preset: "custom",
  selector: "article",
  strip: [".theme-bar", ".back-home", ".progress", ".reading-pct", ".resume-banner"],
  redirects: {
    "/leituras/*": "/posts/pt_br/$1",
  },
  frontmatter: ["title", "author", "description", "lang"],
});
```

Deploy permanece igual (`wrangler deploy`). Updates via `npm update`.

---

## 3. Data flow e lifecycle de request

### 3.1 Request HTML normal (browser)

```
Browser ─GET /posts/foo.html, Accept: text/html─▶ Worker
                                                    │
                                                    ▼
                                       wantsMarkdown()? NO
                                                    │
                                                    ▼
                                       fetch(request) ──────▶ Origin
                                                    ◀────── HTML
                                                    │
Browser ◀──────────── Response (HTML intacto) ──────┘
```

**Decisão:** passa direto. Zero processamento. Origin response volta sem tocar.

### 3.2 Request Markdown (AI agent / curl)

```
Agent ─GET /posts/foo.html, Accept: text/markdown─▶ Worker
                                                      │
                                                      ▼
                                        wantsMarkdown()? YES
                                                      │
                                                      ▼
                                        fetch(origin, Accept: text/html) ──▶ Origin
                                                      ◀─── HTML response
                                                      │
                                                      ▼
                                        contentType includes text/html? YES
                                                      │
                                                      ▼
                                        convertHtmlToMarkdown(html, config)
                                                      │
                                                      ▼
                                        Response(markdown, {
                                          Content-Type: text/markdown; charset=utf-8,
                                          x-markdown-tokens: N,
                                          Content-Signal: ai-train=yes, search=yes, ai-input=yes,
                                          Vary: Accept,
                                          Cache-Control: public, max-age=3600
                                        })
                                                      │
Agent ◀─────────────────────────────────────────────┘
```

### 3.3 Redirects antes da negociação

Redirects rodam **primeiro**, antes de decidir content-type. Config:
```ts
redirects: {
  "/leituras/*": "/posts/pt_br/$1",            // glob pattern → 301
  "/old/exact.html": "/new/exact.html"          // match exato → 301
}
```

**Ordem de matching:**
1. Exact match wins sobre glob
2. Glob matching preserva query string
3. Status default: 301 (permanente)
4. Config permite `status: 302` explícito por regra

### 3.4 Edge cases e respostas

| Cenário | Status | Corpo | Por quê |
|---|---|---|---|
| Origin 404 | 404 | Passa origin body | Fidelidade |
| Origin 5xx | Passa status | Passa body | Origin está quebrado, não inventa |
| Content-Type não é `text/html*` | Passa response | Sem conversão | Tentar converter PDF/JSON seria absurdo |
| HTML sem `<article>` (ou selector config) | 404 | `No article content found` | Decisão: não tentar heurística fallback em v1 |
| `Accept: text/markdown, text/html` (ambos) | Markdown | Markdown | `text/markdown` presente = ganha |
| Origin muito grande (>10MB) | 413 | `Content too large` | Proteção de memória CF Workers (limite ~128MB heap) |
| Timeout origin (>5s) | 504 | Passa | CF já timeouta em 30s; worker expira elegante antes |

### 3.5 Detecção de AI crawlers por User-Agent (opcional)

Alguns agentes AI **não mandam `Accept: text/markdown`**. Config opcional:
```ts
forceMarkdownForUserAgents: [
  /ChatGPT-User/i,
  /Claude-Web/i,
  /Perplexity/i,
  /GPTBot/i,
  /anthropic-ai/i,
]
```

Quando User-Agent bate, comporta como se Accept fosse markdown. Opt-in, não default — respeita princípio de menor surpresa.

### 3.6 Cache strategy (v1)

Usa **Cache API nativa** do Cloudflare sem custom cache. Headers:
- `Cache-Control: public, max-age=3600` — default 1h
- `Vary: Accept` — CF cacheia versões separadas pra HTML e Markdown da mesma URL (crítico pra correção)

**Configurável:**
```ts
cache: {
  maxAge: 3600,      // default 1h
  staleWhileRevalidate: 86400, // default 24h
}
```

Cache explicit custom (KV, R2) fica **fora de v1** — Cache API cobre 95% dos casos.

### 3.7 Lifecycle completo (pseudocódigo)

```ts
async fetch(request, env, ctx) {
  const url = new URL(request.url);

  // 1. Redirects (antes de tudo)
  const redirect = matchRedirect(url, config.redirects);
  if (redirect) return Response.redirect(redirect.to, redirect.status);

  // 2. Decide se quer markdown
  if (!wantsMarkdown(request, config.forceMarkdownForUserAgents)) {
    return fetch(request);
  }

  // 3. Busca origin como HTML
  const originReq = new Request(request.url, { headers: { Accept: "text/html" } });
  const response = await fetch(originReq);

  // 4. Guards
  if (!response.ok) return response;
  if (!isHtmlResponse(response)) return response;
  if (contentLength(response) > config.maxOriginBytes) {
    return new Response("Content too large", { status: 413 });
  }

  // 5. Converte
  const html = await response.text();
  const result = convertHtmlToMarkdown(html, config);
  if (!result) {
    return new Response("No article content found", { status: 404 });
  }

  // 6. Monta markdown com frontmatter
  const markdown = buildMarkdownWithFrontmatter(result, url);

  // 7. Response com headers compat-CF
  return new Response(markdown, {
    status: 200,
    headers: buildResponseHeaders(markdown, config),
  });
}
```

### Decisões importantes

| Decisão | Alternativa | Razão |
|---|---|---|
| Redirects antes da negociação | Depois | Evita gastar fetch origin desnecessário |
| `text/markdown` wins em Accept com múltiplos | Q-value parsing completo | YAGNI v1, 95% dos cases são simples |
| `Vary: Accept` obrigatório | Omitir | Correção do cache é crítica — senão agentes pegam HTML cacheado |
| Fallback a HTML quando `<article>` ausente = 404 | Converter o `<body>` inteiro | Resultado seria lixo; melhor deixar claro que não suporta |
| Sem heurística ML (Readability) | Incluir | Complexidade alta, ganho marginal, cada framework tem estrutura previsível |
| Detecção UA é opt-in | Default on | Respeita princípio de menor surpresa + evita race com agentes que não mandam Accept |

---

## 4. Error handling, observabilidade e edge cases

### 4.1 Classes de erro

| Categoria | Momento | Exemplo | Resposta |
|---|---|---|---|
| **Config error** | Startup (quando `createMarkdownWorker(config)` roda) | `selector` ausente, zod schema fail | Throw síncrono, worker não inicia, mensagem clara |
| **Origin error** | Runtime, ao fazer fetch | 5xx, timeout, DNS fail | Passa através ao client (fidelidade) |
| **Payload error** | Runtime, ao ler origin | >maxBytes, não-HTML esperado | Status específico (413, 415) com mensagem curta |
| **Conversion error** | Runtime, durante HTMLRewriter | Exception inesperada no parsing | Fallback: responde HTML original + header `x-markdown-error` |
| **User error** | Runtime | Selector não encontra `<article>` | 404 `No article content found` |

### 4.2 Fallback graceful quando conversão explode

**Princípio:** nunca deixar o user sem resposta. Se conversão falha por bug inesperado, devolve o HTML original com header indicando o erro.

```ts
try {
  const result = convertHtmlToMarkdown(html, config);
  return buildMarkdownResponse(result);
} catch (err) {
  if (config.debug) console.error("[mdea] conversion failed:", err);

  // Fallback: serve HTML original com sinal do erro
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "x-markdown-error": err.message.slice(0, 200),
      "Vary": "Accept",
    },
  });
}
```

**Por quê:** se mandarmos 500, agentes AI descartam a URL. Devolvendo HTML + header, o agente ainda consegue operar (com ruído maior) e você fica sabendo via logs que tem bug.

### 4.3 Validação de config (startup)

Zod schema gera mensagem clara. Exemplo:
```
[mdea] Invalid config:
  - "selector": Required
  - "strip[0]": Expected string, received object
  - "cache.maxAge": Expected number ≥ 0, received -100

Config docs: https://github.com/adhenawer/markdown-edge-for-agents#config
```

Worker nunca chega a produção com config quebrada. Erro explode no `wrangler dev` / build.

### 4.4 Observabilidade — o que o usuário consegue ver

Sem telemetria externa em v1. Apenas mecanismos locais:

**Headers de response (sempre):**
- `x-markdown-tokens: N` — tamanho estimado
- `x-markdown-version: 1.0.0` — versão da lib (pra debug remoto)
- `x-markdown-preset: astro` — qual preset foi usado
- `x-markdown-error: <msg>` — **só quando fallback ativou**

**Debug mode opt-in via config:**
```ts
createMarkdownWorker({
  preset: "custom",
  debug: true,  // default false
  ...
});
```
Quando `debug: true`:
- `console.log` dos passos (visível em `wrangler tail`)
- Headers extras: `x-markdown-debug-selector: matched|not-found`, `x-markdown-debug-bytes-in: 15234`, `x-markdown-debug-bytes-out: 4120`
- Não commita: destinado a desenvolvimento local, não produção

### 4.5 Telemetria externa (explicitamente fora de v1)

Nenhum "call home", nenhum analytics embutido. Princípios:
- **Privacidade first** — worker roda no domínio do usuário, zero data leak
- **Respect Free tier** — cada request custosa (logs, analytics) conta no budget deles
- **Opt-in always** — se v2 tiver analytics, vai ser flag explícito + URL do próprio usuário (não nossa)

### 4.6 Edge cases técnicos específicos

#### HTML malformado
- HTMLRewriter do CF é tolerante por design — não quebra em HTML mal formado.
- Entities HTML (`&amp;`, `&#x1F4A9;`) são decoded pelo próprio rewriter.
- Encoding não-UTF8 no origin: respeitamos `Content-Type: text/html; charset=xxx` e deixamos o CF handlar (fora do nosso escopo).

#### Imagens e assets relativos
- URLs `<img src="/path">` no markdown ficam relativas ao domínio, igual ao HTML.
- Não fazemos resolve pra absolute — agente que quer absoluto deve inferir a partir do `source:` no frontmatter.

#### Links internos com âncoras
- `<a href="#section">` vira `[text](#section)` — preservado.
- Âncoras de heading (slug auto-gerado) ficam fora de v1. Markdown renderers resolvem no consumer.

#### Conteúdo dinâmico (SPA)
- Se origin serve HTML quase-vazio + JS que hidrata, worker converte o HTML vazio. **Resultado garbage.**
- **Decisão:** documenta explicitamente que markdown-edge-for-agents é pra **sites com HTML server-rendered**. SPAs precisam de pre-rendering (Astro SSG, Next SSG, etc.).
- Fora do nosso escopo resolver SSR/hidratação.

#### Múltiplos `<article>` na página
- Config `selector: "article"` pega o primeiro.
- User pode refinar: `selector: "article.main-post"` pra maior especificidade.
- Converter preserva apenas o primeiro match — intencional, evita ambiguidade.

#### Código com syntax highlighting
- `<pre><code class="language-ts">...</code></pre>` vira fence triplo com language tag.
- Mapeia classes `language-XXX` ou `hljs-XXX` pra fence language.
- Se nenhuma language detectada, fica fence triplo sem language tag.

#### Listas aninhadas
- `<ul><li>A<ul><li>B</li></ul></li></ul>` → identação correta em markdown (2 espaços).
- HTMLRewriter permite rastrear profundidade via handler state.

### 4.7 Limites hard-coded (sanidade)

| Limite | Valor | Por quê |
|---|---|---|
| Max origin size | 10 MB | CF Workers heap ~128MB, deixa espaço |
| Max conversion time | 5 s | Worker CPU budget em Free é 10ms (CF faz batch), mas tempo total ~30s |
| Max config object depth | 10 | Previne config recursiva absurda |
| Max strip selectors | 100 | Sanity check |
| Max redirects rules | 500 | Sanity check |

### 4.8 Matriz de respostas

| Código | Quando | Headers notáveis |
|---|---|---|
| 200 (markdown) | Sucesso | `Content-Type: text/markdown`, `x-markdown-tokens`, `Vary: Accept` |
| 200 (HTML) | Request browser normal OU fallback pós-erro | `Vary: Accept`, opcional `x-markdown-error` |
| 301/302 | Redirect configurado | `Location: <new-url>` |
| 404 | Origin 404 OU `<article>` não encontrado | passa origin headers OU body `No article content found` |
| 413 | Origin >maxBytes | `Content-Length: 0`, body curto |
| 415 | Origin não-HTML mas quis markdown | body `Origin is not HTML` |
| 5xx | Passa origin | passa origin headers |

### 4.9 Logs estruturados (roadmap v2)

Fora de v1, mas DESIGN preparado pra futuro via callback opcional injetado pelo user. Permite integração com Sentry / logs próprios sem lock-in.

---

## 5. Estratégia de testes e CI

### 5.1 Pirâmide de testes

```
         ┌──────────────┐
         │   e2e (3-5)  │  ← scaffolder real + deploy em dev zone
         └──────────────┘
        ┌──────────────────┐
        │ integration (15) │  ← worker full-cycle com miniflare
        └──────────────────┘
      ┌────────────────────────┐
      │     unit (60-80)       │  ← converter, config, presets
      └────────────────────────┘
```

Proporção: **80% unit, 15% integration, 5% e2e** — fast feedback loop.

### 5.2 Unit tests (`packages/core/tests/unit/`)

Cobrem converter (headings, strip selectors, code fences com language, listas aninhadas, entities), config validator (schema valid/invalid, merge ordering), presets (shape check).

Coverage gate: **≥85%** no `packages/core/src/`.

### 5.3 Integration tests (`packages/core/tests/integration/`)

Usam **miniflare** pra emular worker runtime com HTMLRewriter real. Testam:
- Negociação HTML vs Markdown
- Headers compat-CF (`x-markdown-tokens`, `Content-Signal`, `Vary`)
- Redirects antes da negociação
- Fallback quando selector não encontra
- Force markdown para User-Agent de AI crawler

Fixtures HTML reais em `tests/integration/fixtures/`:
- `astro-blog-post.html`, `hugo-blog-post.html`
- `adhenawer-net-post.html` (case de regressão do dogfood)
- `malformed.html`

### 5.4 E2E tests

Rodam **só no CI** (GitHub Actions), pre-merge gate em main:
1. CI cria scaffolder output em tmpdir
2. Deploy em `dev.markdown-edge-for-agents.workers.dev` (zone dedicada)
3. `curl -H "Accept: text/markdown"` valida output
4. Teardown: deleta deployment

Requer `CLOUDFLARE_API_TOKEN` como GitHub secret (conta dedicada, não pessoal).

### 5.5 CI pipeline

```yaml
# .github/workflows/ci.yml
on:
  pull_request:
  push: { branches: [main] }

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck      # tsc --noEmit em todos packages
      - run: pnpm lint           # biome check
      - run: pnpm test           # vitest em todos packages
      - run: pnpm build          # tsup em todos packages
      - uses: codecov/codecov-action@v4
        with: { fail_ci_if_error: true }

  e2e:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:e2e
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_DEV_TOKEN }}
```

**Gates:**
- Coverage ≥85% no `core` — CI falha se cair
- Lint: biome (mais rápido que eslint+prettier)
- Typecheck: strict mode obrigatório
- Build: tsup precisa compilar sem warnings

### 5.6 Release flow

**Changesets** pra versionamento semântico:
```bash
pnpm changeset              # dev adiciona mudança
# escolhe package + tipo (major/minor/patch) + descreve
```

Ao merge em main, GitHub Action:
1. Abre PR "Version Packages" consolidando changesets
2. Merge desse PR → publica no npm + cria GitHub release + tag

**Versionamento inicial:**
- v0.x durante pre-1.0 launch (API pode mudar)
- v1.0.0 quando declarar estável (pós-feedback de early users)

**Pre-release pra beta testers:**
```bash
pnpm changeset pre enter beta
# versões viram 0.2.0-beta.0, etc
pnpm changeset pre exit
```

### 5.7 Smoke test (sanity check diário)

Scheduled workflow diário:
```yaml
# .github/workflows/smoke.yml
on:
  schedule: [{ cron: "0 12 * * *" }]
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - run: curl -H "Accept: text/markdown" https://dev.markdown-edge-for-agents.workers.dev/fixture | grep -q "^---$"
```

Detecta mudanças silenciosas no CF (breaking changes em HTMLRewriter, mudanças de comportamento). Issue auto-aberta se falhar.

### 5.8 Test-driven development flow

Pra cada feature nova (incluindo PRs externos):
1. **RED** — escreve teste que define comportamento, rode, veja falhar
2. **GREEN** — implementa mínimo pra passar
3. **REFACTOR** — limpa mantendo testes verdes

CLAUDE.md do repo documenta como hard requirement. PRs sem teste são sinalizados com label `needs-tests`.

---

## Self-review do spec (2026-04-15)

### Placeholder scan
- [x] Nenhum "TBD", "TODO" ou seção vaga restante
- [x] Todos os exemplos de código são ilustrativos (não placeholders)

### Internal consistency
- [x] Arquitetura (seção 2) usa mesmos nomes/boundaries que data flow (seção 3)
- [x] Error handling (seção 4) cobre todos os caminhos do lifecycle (seção 3)
- [x] Testing strategy (seção 5) mapeia pra componentes da seção 2

### Scope check
- [x] v1 scope está bem delimitado (8 itens IN, 8 itens OUT explicitamente)
- [x] 4-6 fins de semana é realista pro escopo: ~1 fds core + 1 fds worker/factory + 1 fds scaffolder + 1 fds presets/examples + 1-2 fds tests/docs/polish

### Ambiguity check
- [x] "Preset custom é efetivamente vazio" — clarificado: significa `{}`, user provê tudo via config
- [x] "Fallback graceful" — clarificado: retorna HTML original (não 500) + header `x-markdown-error`
- [x] "Compat 1:1 com CF" — enumerado quais headers exatos (`x-markdown-tokens`, `Content-Signal`, `Vary`, `Cache-Control`)
- [x] Detecção de framework no scaffolder — documentada: lê `package.json` deps (`astro`) ou config (`hugo.toml`, `hugo.yaml`)
