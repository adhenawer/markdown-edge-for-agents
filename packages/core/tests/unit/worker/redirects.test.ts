import { describe, it, expect } from "vitest";
import { matchRedirect } from "../../../src/worker/redirects.js";

describe("matchRedirect", () => {
  it("returns null when no rule matches", () => {
    const result = matchRedirect(new URL("https://x.com/unrelated"), {});
    expect(result).toBeNull();
  });

  it("exact match wins over glob", () => {
    const rules = {
      "/old/*": "/new/$1",
      "/old/specific": "/super-specific",
    };
    const result = matchRedirect(new URL("https://x.com/old/specific"), rules);
    expect(result?.to).toBe("https://x.com/super-specific");
  });

  it("glob with $1 expands", () => {
    const rules = { "/leituras/*": "/posts/pt_br/$1" };
    const result = matchRedirect(new URL("https://x.com/leituras/foo.html"), rules);
    expect(result?.to).toBe("https://x.com/posts/pt_br/foo.html");
  });

  it("defaults status to 301", () => {
    const rules = { "/x": "/y" };
    const result = matchRedirect(new URL("https://x.com/x"), rules);
    expect(result?.status).toBe(301);
  });

  it("preserves query string", () => {
    const rules = { "/old/*": "/new/$1" };
    const result = matchRedirect(new URL("https://x.com/old/foo?a=1&b=2"), rules);
    expect(result?.to).toBe("https://x.com/new/foo?a=1&b=2");
  });
});
