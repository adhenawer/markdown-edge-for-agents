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

function getHTMLRewriter(): RewriterCtor | null {
  try {
    return (globalThis as unknown as { HTMLRewriter?: RewriterCtor }).HTMLRewriter ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Regex fallback for cleanAndDetect (works in any runtime)
// ---------------------------------------------------------------------------

/**
 * Convert a simple CSS selector to a regex that matches the opening tag.
 * Supports: tag names (`nav`), class selectors (`.foo`), tag.class (`div.bar`).
 * Returns null for selectors too complex for regex (attribute selectors, etc).
 */
function selectorToRegex(sel: string): RegExp | null {
  const trimmed = sel.trim();

  // Tag selector: "nav", "script", "style", "header", "footer", "aside", "button"
  if (/^[a-z][a-z0-9]*$/i.test(trimmed)) {
    return new RegExp(`<${trimmed}[\\s>][\\s\\S]*?<\\/${trimmed}>`, "gi");
  }

  // Class selector: ".theme-bar", ".back-home"
  const classMatch = trimmed.match(/^\.([a-zA-Z0-9_-]+)$/);
  if (classMatch) {
    return new RegExp(
      `<[a-z][a-z0-9]*[^>]*\\bclass="[^"]*\\b${classMatch[1]}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/[a-z][a-z0-9]*>`,
      "gi",
    );
  }

  // Tag + class: "div.foo"
  const tagClassMatch = trimmed.match(/^([a-z][a-z0-9]*)\.([a-zA-Z0-9_-]+)$/i);
  if (tagClassMatch) {
    return new RegExp(
      `<${tagClassMatch[1]}[^>]*\\bclass="[^"]*\\b${tagClassMatch[2]}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/${tagClassMatch[1]}>`,
      "gi",
    );
  }

  // Too complex for regex — skip silently
  return null;
}

function selectorExistsRegex(html: string, selector: string): boolean {
  // Handle comma-separated selectors: "article, main.content"
  const parts = selector.split(",").map((s) => s.trim());
  for (const part of parts) {
    const tagMatch = part.match(/^([a-z][a-z0-9]*)/i);
    if (tagMatch && new RegExp(`<${tagMatch[1]}[\\s>]`, "i").test(html)) {
      return true;
    }
  }
  return false;
}

function cleanAndDetectRegex(
  html: string,
  selector: string,
  strip: readonly string[],
): { cleaned: string; selectorMatched: boolean } {
  let cleaned = html;
  for (const sel of strip) {
    const rx = selectorToRegex(sel);
    if (rx) {
      cleaned = cleaned.replace(rx, "");
    }
  }
  const selectorMatched = selectorExistsRegex(html, selector);
  return { cleaned, selectorMatched };
}

// ---------------------------------------------------------------------------
// HTMLRewriter path (preferred in CF Workers)
// ---------------------------------------------------------------------------

async function cleanAndDetectRewriter(
  html: string,
  selector: string,
  strip: readonly string[],
): Promise<{ cleaned: string; selectorMatched: boolean }> {
  const Ctor = getHTMLRewriter();
  if (!Ctor) {
    return cleanAndDetectRegex(html, selector, strip);
  }

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

/**
 * Single pass: detect whether `selector` matches anywhere in `html` and
 * remove every element matching any entry in `strip`. Uses HTMLRewriter
 * when available (CF Workers), falls back to regex in other runtimes.
 */
async function cleanAndDetect(
  html: string,
  selector: string,
  strip: readonly string[],
): Promise<{ cleaned: string; selectorMatched: boolean }> {
  return cleanAndDetectRewriter(html, selector, strip);
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
