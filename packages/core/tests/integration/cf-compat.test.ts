import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";
import { convertHtmlToMarkdown } from "../../src/converter/index.js";

describe("CF Workers compatibility", () => {
  it("boots inside miniflare and adapter runs with the polyfilled HTMLRewriter", async () => {
    // Sanity check 1: miniflare (workerd) loads and serves a trivial module
    // worker. This proves the runtime used by production deployments is at
    // least reachable from our test environment.
    const mf = new Miniflare({
      script: `
        export default {
          async fetch() {
            return new Response("ok");
          }
        };
      `,
      modules: true,
    });
    const res = await mf.dispatchFetch("https://x.com/");
    expect(await res.text()).toBe("ok");
    await mf.dispose();

    // Sanity check 2: the adapter runs against the test-time HTMLRewriter
    // polyfill (which mirrors the CF API surface). Production workers rely on
    // the same API via the native global.
    const result = await convertHtmlToMarkdown(
      "<html><body><article><h1>T</h1></article></body></html>",
      { selector: "article", strip: [], frontmatter: ["title"] },
    );
    expect(result).not.toBeNull();
  });
});
