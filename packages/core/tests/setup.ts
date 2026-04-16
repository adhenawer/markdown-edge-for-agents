/**
 * Test setup: polyfill globalThis.HTMLRewriter with a CF Workers compatible
 * wrapper over `html-rewriter-wasm`. Production code runs in Cloudflare
 * Workers where HTMLRewriter is a native global, so tests only need the shim.
 */
import {
  type DocumentHandlers,
  type ElementHandlers,
  HTMLRewriter as WasmHTMLRewriter,
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
    // Build a new Response whose body is a ReadableStream backed by the
    // transformed HTML. This mirrors the CF API where `transform(resp).text()`
    // yields the fully rewritten body.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const src = await response.text();
          const transformed = await self._run(src, entries);
          controller.enqueue(new TextEncoder().encode(transformed));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
    return new Response(stream, { headers: response.headers });
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
(globalThis as unknown as { HTMLRewriter: typeof CFHTMLRewriter }).HTMLRewriter = CFHTMLRewriter;
