/**
 * Extract page metadata (title, description, author, lang) from raw HTML.
 *
 * Uses HTMLRewriter (streaming, native in CF Workers) when available.
 * Falls back to regex extraction for Node.js / Bun / Deno / browser runtimes
 * — enables local testing, multi-runtime usage, and the v2 roadmap.
 */

export interface Meta {
  title: string;
  description: string;
  author: string;
  lang: string;
}

// ---------------------------------------------------------------------------
// Regex fallback (works everywhere)
// ---------------------------------------------------------------------------

function extractMetaRegex(html: string): Meta {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  const description =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i)?.[1] ??
    "";
  const author =
    html.match(/<meta\s+name=["']author["']\s+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']author["']/i)?.[1] ??
    "";
  const lang = html.match(/<html[^>]*\slang=["']([^"']+)["']/i)?.[1] ?? "en";

  return { title, description, author, lang };
}

// ---------------------------------------------------------------------------
// HTMLRewriter path (streaming, preferred in CF Workers)
// ---------------------------------------------------------------------------

interface MinimalElement {
  getAttribute(name: string): string | null;
}

interface MinimalTextChunk {
  text: string;
}

interface MinimalRewriter {
  on(
    selector: string,
    handlers: {
      element?: (el: MinimalElement) => void;
      text?: (chunk: MinimalTextChunk) => void;
    },
  ): MinimalRewriter;
  transform(response: Response): Response;
}

type RewriterCtor = new () => MinimalRewriter;

function getHTMLRewriter(): RewriterCtor | null {
  try {
    const Ctor = (globalThis as unknown as { HTMLRewriter?: RewriterCtor }).HTMLRewriter;
    return Ctor ?? null;
  } catch {
    return null;
  }
}

async function extractMetaRewriter(html: string): Promise<Meta> {
  const Ctor = getHTMLRewriter();
  if (!Ctor) return extractMetaRegex(html);

  const meta: Meta = { title: "", description: "", author: "", lang: "en" };

  const rewriter = new Ctor()
    .on("html", {
      element(el) {
        const lang = el.getAttribute("lang");
        if (lang) meta.lang = lang;
      },
    })
    .on("title", {
      text(chunk) {
        meta.title += chunk.text;
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        meta.description = el.getAttribute("content") ?? "";
      },
    })
    .on('meta[name="author"]', {
      element(el) {
        meta.author = el.getAttribute("content") ?? "";
      },
    });

  const response = new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
  await rewriter.transform(response).text();
  meta.title = meta.title.trim();
  return meta;
}

// ---------------------------------------------------------------------------
// Public API — auto-detects runtime
// ---------------------------------------------------------------------------

export async function extractMeta(html: string): Promise<Meta> {
  return extractMetaRewriter(html);
}
