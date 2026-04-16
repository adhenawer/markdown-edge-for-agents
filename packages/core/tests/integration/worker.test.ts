import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMarkdownWorker } from "../../src/worker/factory.js";

const config = {
  preset: "custom" as const,
  selector: "article",
  strip: [".noise"],
  redirects: { "/leituras/*": "/posts/pt_br/$1" },
};

const fixtureHtml = `
<!doctype html>
<html lang="en">
  <head><title>Fix</title></head>
  <body>
    <article>
      <h1>Hello</h1>
      <div class="noise">skip</div>
      <p>World</p>
    </article>
  </body>
</html>`;

const explodingConfig = {
  // Intentionally invalid selector syntax to make HTMLRewriter throw inside
  // the factory's try/catch, exercising the graceful HTML fallback path.
  preset: "custom" as const,
  selector: "article::invalid-pseudo(",
  strip: [],
};

describe("createMarkdownWorker", () => {
  beforeAll(() => {
    globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/no-article")) {
        return new Response("<html><body></body></html>", {
          headers: { "Content-Type": "text/html" },
        });
      }
      if (url.endsWith("/non-html")) {
        return new Response("pdf bytes", {
          headers: { "Content-Type": "application/pdf" },
        });
      }
      if (url.endsWith("/browser-html")) {
        return new Response("<html><body>browser</body></html>", {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response(fixtureHtml, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as typeof fetch;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  const worker = createMarkdownWorker(config);

  it("serves HTML unchanged for browser request", async () => {
    const req = new Request("https://example.com/browser-html", {
      headers: { Accept: "text/html" },
    });
    const res = await worker.fetch?.(req, {} as never, {} as never);
    expect(res.headers.get("Content-Type")).toMatch(/text\/html/);
  });

  it("serves markdown when Accept is text/markdown", async () => {
    const req = new Request("https://example.com/post", {
      headers: { Accept: "text/markdown" },
    });
    const res = await worker.fetch?.(req, {} as never, {} as never);
    expect(res.headers.get("Content-Type")).toMatch(/text\/markdown/);
    expect(res.headers.get("Vary")).toBe("Accept");
    expect(res.headers.get("x-markdown-tokens")).toBeTruthy();
    const body = await res.text();
    expect(body).toContain("# Hello");
    expect(body).toContain("World");
    expect(body).not.toContain("skip");
  });

  it("redirects configured paths before negotiation", async () => {
    const req = new Request("https://example.com/leituras/foo.html", {
      redirect: "manual",
    });
    const res = await worker.fetch?.(req, {} as never, {} as never);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://example.com/posts/pt_br/foo.html");
  });

  it("returns 404 when article selector not found", async () => {
    const req = new Request("https://example.com/no-article", {
      headers: { Accept: "text/markdown" },
    });
    const res = await worker.fetch?.(req, {} as never, {} as never);
    expect(res.status).toBe(404);
  });

  it("passes through when origin is not HTML", async () => {
    const req = new Request("https://example.com/non-html", {
      headers: { Accept: "text/markdown" },
    });
    const res = await worker.fetch?.(req, {} as never, {} as never);
    expect(res.headers.get("Content-Type")).toMatch(/application\/pdf/);
  });

  it("falls back to HTML with x-markdown-error when conversion throws", async () => {
    const explodingWorker = createMarkdownWorker(explodingConfig);
    const req = new Request("https://example.com/post", {
      headers: { Accept: "text/markdown" },
    });
    const res = await explodingWorker.fetch?.(req, {} as never, {} as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/html/);
    expect(res.headers.get("x-markdown-error")).toBeTruthy();
    expect(res.headers.get("Vary")).toBe("Accept");
  });
});
