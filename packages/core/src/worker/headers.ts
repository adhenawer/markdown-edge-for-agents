/**
 * Build `Response` headers compatible 1:1 with Cloudflare's "Markdown for
 * Agents" feature, so consumers can migrate between this worker and the Pro
 * feature without changing anything client-side.
 *
 * Always-on headers:
 *   - Content-Type:          text/markdown; charset=utf-8
 *   - Content-Signal:        ai-train=yes, search=yes, ai-input=yes
 *   - Vary:                  Accept
 *   - Cache-Control:         public, max-age=N, stale-while-revalidate=M
 *   - x-markdown-tokens:     estimated token count
 *   - x-markdown-version:    library version (manual bump)
 *   - x-markdown-preset:     preset name used
 *   - Access-Control-Allow-Origin: *   (CORS so agents can fetch freely)
 *
 * Debug-only headers (when `config.debug === true`):
 *   - x-markdown-debug-bytes-in
 *   - x-markdown-debug-bytes-out
 *   - x-markdown-debug-selector: "matched" | "not-found"
 */

import type { ResolvedConfig } from "../config/types.js";

export interface HeadersContext {
  tokens: number;
  bytesIn?: number;
  bytesOut?: number;
  selectorMatched?: boolean;
}

// Bumped manually on release; kept as a constant so tests can assert presence
// but don't have to track the exact value.
const VERSION = "0.1.0";

export function buildResponseHeaders(
  ctx: HeadersContext,
  config: Pick<ResolvedConfig, "cache" | "preset" | "debug">,
): Headers {
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Signal": "ai-train=yes, search=yes, ai-input=yes",
    Vary: "Accept",
    "Cache-Control": `public, max-age=${config.cache.maxAge}, stale-while-revalidate=${config.cache.staleWhileRevalidate}`,
    "x-markdown-tokens": String(ctx.tokens),
    "x-markdown-version": VERSION,
    "x-markdown-preset": config.preset,
    "Access-Control-Allow-Origin": "*",
  });

  if (config.debug) {
    if (ctx.bytesIn !== undefined) {
      headers.set("x-markdown-debug-bytes-in", String(ctx.bytesIn));
    }
    if (ctx.bytesOut !== undefined) {
      headers.set("x-markdown-debug-bytes-out", String(ctx.bytesOut));
    }
    if (ctx.selectorMatched !== undefined) {
      headers.set("x-markdown-debug-selector", ctx.selectorMatched ? "matched" : "not-found");
    }
  }

  return headers;
}
