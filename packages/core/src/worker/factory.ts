/**
 * Worker factory — glues the converter, config resolver, content negotiation,
 * redirects and response headers into a single `ExportedHandler` ready to be
 * default-exported from a Cloudflare Worker entry point.
 *
 * Request lifecycle (mirrors DESIGN §3):
 *
 *   1. Evaluate redirects. Configured redirects apply before negotiation so
 *      we never waste an origin fetch for paths destined to move.
 *   2. Decide whether the caller wants markdown (Accept header or forced UA).
 *      If not, forward the original request unchanged.
 *   3. Fetch the origin as HTML (Accept override). Pass through non-OK or
 *      non-HTML responses verbatim — we never invent behavior on top of a
 *      broken origin.
 *   4. Enforce `maxOriginBytes` (413) via Content-Length header and, as a
 *      defense in depth, the actual body length after reading.
 *   5. Convert. Success → markdown with frontmatter + compat headers.
 *      Selector miss → 404. Unexpected exception → graceful HTML fallback
 *      with `x-markdown-error` so agents keep working while we observe the
 *      bug out-of-band.
 */

import { resolveConfig } from "../config/resolve.js";
import type { ResolvedConfig, UserConfig } from "../config/types.js";
import { buildFrontmatter } from "../converter/frontmatter.js";
import { convertHtmlToMarkdown } from "../converter/index.js";
import { buildResponseHeaders } from "./headers.js";
import { wantsMarkdown } from "./negotiate.js";
import { matchRedirect } from "./redirects.js";

type FetchHandler = NonNullable<ExportedHandler["fetch"]>;

export function createMarkdownWorker(userConfig: UserConfig): ExportedHandler {
  const config: ResolvedConfig = resolveConfig(userConfig);

  const fetchHandler: FetchHandler = async (request) => {
    const url = new URL(request.url);

    // 1. Redirects first.
    const redirect = matchRedirect(url, config.redirects);
    if (redirect) {
      return Response.redirect(redirect.to, redirect.status);
    }

    // 2. Decide whether the caller wants markdown.
    if (!wantsMarkdown(request, config.forceMarkdownForUserAgents, config.autoDetectAiCrawlers)) {
      return fetch(request);
    }

    // 3. Fetch origin forcing HTML so we have something to convert.
    const originReq = new Request(request.url, {
      method: request.method,
      headers: { Accept: "text/html" },
    });
    const response = await fetch(originReq);

    // 4. Guards: passthrough on non-OK, non-HTML, or oversized payloads.
    if (!response.ok) return response;

    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.includes("text/html")) return response;

    const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
    if (declaredLength > config.maxOriginBytes) {
      return new Response("Content too large", { status: 413 });
    }

    const html = await response.text();
    if (html.length > config.maxOriginBytes) {
      return new Response("Content too large", { status: 413 });
    }

    // 5. Convert, with graceful fallback if the pipeline explodes.
    try {
      const result = await convertHtmlToMarkdown(html, {
        selector: config.selector,
        strip: config.strip,
        frontmatter: config.frontmatter,
      });

      if (!result) {
        return new Response("No article content found", { status: 404 });
      }

      const frontmatter = buildFrontmatter({
        title: result.meta.title,
        author: result.meta.author,
        description: result.meta.description,
        lang: result.meta.lang,
        source: request.url,
      });
      const body = frontmatter + result.markdown;

      return new Response(body, {
        status: 200,
        headers: buildResponseHeaders(
          {
            tokens: result.tokens,
            bytesIn: html.length,
            bytesOut: body.length,
            selectorMatched: true,
          },
          config,
        ),
      });
    } catch (err) {
      if (config.debug) {
        // eslint-disable-next-line no-console
        console.error("[mdea] conversion failed:", err);
      }
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 200);
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "x-markdown-error": message,
          Vary: "Accept",
        },
      });
    }
  };

  return { fetch: fetchHandler };
}
