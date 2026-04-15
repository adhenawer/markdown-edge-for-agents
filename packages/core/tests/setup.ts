/**
 * Test setup: polyfill globalThis.HTMLRewriter with a CF Workers compatible
 * wrapper over `html-rewriter-wasm`. Production code runs in Cloudflare
 * Workers where HTMLRewriter is a native global, so tests only need the shim.
 */
import {
  HTMLRewriter as WasmHTMLRewriter,
  type ElementHandlers,
  type DocumentHandlers,
} from "html-rewriter-wasm";

type Selector = string;
type HandlerEntry =
  | { kind: "element"; selector: Selector; handlers: ElementHandlers }
  | { kind: "document"; handlers: DocumentHandlers };

class CFHTMLRewriter {
  private readonly entries: HandlerEntry[] = [];

  on(selector: Selector, handlers: ElementHandlers): this {
    this.entries.push({ kind: "element", selector, handlers });
    return this;
  }

  onDocument(handlers: DocumentHandlers): this {
    this.entries.push({ kind: "document", handlers });
    return this;
  }

  transform(response: Response): Response {
    const entries = this.entries;
    const self = this;
    // Build a new Response whose body is the transformed HTML. We lazily
    // transform when the consumer reads text(): this mirrors the CF API where
    // `transform(resp).text()` returns the fully rewritten body.
    const transformed = new Response(
      (async () => {
        const src = await response.text();
        return await self._run(src, entries);
      })().then((t) => new Blob([t], { type: "text/html" })),
      { headers: response.headers }
    );
    return transformed;
  }

  private async _run(html: string, entries: HandlerEntry[]): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let output = "";
    const rewriter = new WasmHTMLRewriter((chunk) => {
      output += decoder.decode(chunk, { stream: true });
    });
    try {
      for (const entry of entries) {
        if (entry.kind === "element") {
          rewriter.on(entry.selector, entry.handlers);
        } else {
          rewriter.onDocument(entry.handlers);
        }
      }
      await rewriter.write(encoder.encode(html));
      await rewriter.end();
      // Flush decoder
      output += decoder.decode();
      return output;
    } finally {
      rewriter.free();
    }
  }
}

// Install as global
(globalThis as unknown as { HTMLRewriter: typeof CFHTMLRewriter }).HTMLRewriter =
  CFHTMLRewriter;
