import { describe, expect, it } from "vitest";
import { wantsMarkdown } from "../../../src/worker/negotiate.js";

function req(headers: Record<string, string>): Request {
  return new Request("https://x.com/post", { headers });
}

describe("wantsMarkdown", () => {
  it("true when Accept includes text/markdown", () => {
    expect(wantsMarkdown(req({ Accept: "text/markdown" }), [])).toBe(true);
  });

  it("true when Accept mixes markdown and html", () => {
    expect(wantsMarkdown(req({ Accept: "text/markdown, text/html" }), [])).toBe(true);
  });

  it("false when Accept is only html", () => {
    expect(wantsMarkdown(req({ Accept: "text/html" }), [])).toBe(false);
  });

  it("true when User-Agent matches forced pattern", () => {
    expect(wantsMarkdown(req({ "User-Agent": "ChatGPT-User/1.0" }), [/ChatGPT/i])).toBe(true);
  });

  it("false when User-Agent does not match and no Accept", () => {
    expect(wantsMarkdown(req({}), [/ChatGPT/i])).toBe(false);
  });
});
