/**
 * Extract page metadata (title, description, author, lang) from raw HTML using
 * the Cloudflare Workers HTMLRewriter global. In Node tests a polyfill is
 * installed via the vitest setup file (see `tests/setup.ts`).
 */

export interface Meta {
  title: string;
  description: string;
  author: string;
  lang: string;
}

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

export async function extractMeta(html: string): Promise<Meta> {
  const meta: Meta = { title: "", description: "", author: "", lang: "en" };

  const Ctor = (globalThis as unknown as { HTMLRewriter: RewriterCtor }).HTMLRewriter;
  if (!Ctor) {
    throw new Error(
      "HTMLRewriter is not available in this runtime. " +
        "This module requires Cloudflare Workers or a compatible polyfill.",
    );
  }

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
