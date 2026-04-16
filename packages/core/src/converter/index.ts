/**
 * Adapter over `markdown-for-agents`.
 *
 * External contract:
 *   convertHtmlToMarkdown(html, { selector, strip, frontmatter })
 *     -> { markdown, tokens, meta } | null
 *
 * Implementation notes
 * --------------------
 * `markdown-for-agents` v1.3.x does not expose a "CSS selector scope" — its
 * `extract` option strips non-content elements heuristically but always walks
 * the full document. To honor our contract we:
 *
 *   1. Run one HTMLRewriter pass that removes every match of `strip` AND
 *      detects whether at least one element matching `selector` is present.
 *   2. If no selector match exists, return `null`.
 *   3. Feed the cleaned HTML to `convert()` with `extract: true` so the
 *      upstream heuristic extraction (which prefers `<article>`, `<main>`,
 *      etc.) produces the final content.
 *   4. `extractMeta` runs separately against the ORIGINAL html so `<head>`
 *      is intact even if the caller includes `head` in `strip` by mistake.
 *
 * This keeps the adapter thin and isolates the upstream library behind a
 * single file for easy replacement.
 */

import { convert } from "markdown-for-agents";
import { type Meta, extractMeta } from "./extractMeta.js";

export interface ConverterConfig {
  /** CSS selector identifying the primary content root (e.g. `"article"`). */
  selector: string;
  /** CSS selectors whose matches should be removed before conversion. */
  strip: string[];
  /** Frontmatter field names the caller wants preserved (informational). */
  frontmatter: readonly string[];
}

export interface ConversionResult {
  markdown: string;
  tokens: number;
  meta: Meta;
}

interface MinimalElement {
  remove(): unknown;
}

interface MinimalRewriter {
  on(selector: string, handlers: { element?: (el: MinimalElement) => void }): MinimalRewriter;
  transform(response: Response): Response;
}

type RewriterCtor = new () => MinimalRewriter;

function getRewriter(): RewriterCtor {
  const Ctor = (globalThis as unknown as { HTMLRewriter?: RewriterCtor }).HTMLRewriter;
  if (!Ctor) {
    throw new Error(
      "HTMLRewriter is not available in this runtime. " +
        "This module requires Cloudflare Workers or a compatible polyfill.",
    );
  }
  return Ctor;
}

/**
 * Single HTMLRewriter pass: detect whether `selector` matches anywhere in
 * `html` and remove every element matching any entry in `strip`. Returns the
 * cleaned HTML plus a flag indicating whether the selector matched.
 */
async function cleanAndDetect(
  html: string,
  selector: string,
  strip: readonly string[],
): Promise<{ cleaned: string; selectorMatched: boolean }> {
  const Ctor = getRewriter();
  const rewriter = new Ctor();

  for (const sel of strip) {
    rewriter.on(sel, {
      element(el) {
        el.remove();
      },
    });
  }

  let selectorMatched = false;
  rewriter.on(selector, {
    element() {
      selectorMatched = true;
    },
  });

  const response = new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
  const cleaned = await rewriter.transform(response).text();
  return { cleaned, selectorMatched };
}

export async function convertHtmlToMarkdown(
  html: string,
  config: ConverterConfig,
): Promise<ConversionResult | null> {
  const meta = await extractMeta(html);

  const { cleaned, selectorMatched } = await cleanAndDetect(html, config.selector, config.strip);
  if (!selectorMatched) return null;

  const result = convert(cleaned, {
    // `keepHeader: true` preserves <header> inside the main content (which
    // commonly wraps the article's <h1>); the caller's `strip` already
    // removed site-level chrome, so the upstream extraction mainly serves as
    // a light safety net for residual boilerplate.
    extract: { keepHeader: true },
    frontmatter: false,
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
