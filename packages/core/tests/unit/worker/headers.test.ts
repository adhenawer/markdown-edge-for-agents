import { describe, expect, it } from "vitest";
import { buildResponseHeaders } from "../../../src/worker/headers.js";

const baseConfig = {
  cache: { maxAge: 3600, staleWhileRevalidate: 86400 },
  preset: "custom" as const,
  debug: false,
};

describe("buildResponseHeaders", () => {
  it("sets Content-Type to text/markdown", () => {
    const headers = buildResponseHeaders({ tokens: 100 }, baseConfig);
    expect(headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
  });

  it("sets x-markdown-tokens", () => {
    const headers = buildResponseHeaders({ tokens: 123 }, baseConfig);
    expect(headers.get("x-markdown-tokens")).toBe("123");
  });

  it("sets Content-Signal for AI opt-in", () => {
    const headers = buildResponseHeaders({ tokens: 1 }, baseConfig);
    expect(headers.get("Content-Signal")).toBe("ai-train=yes, search=yes, ai-input=yes");
  });

  it("sets Vary: Accept for correct caching", () => {
    const headers = buildResponseHeaders({ tokens: 1 }, baseConfig);
    expect(headers.get("Vary")).toBe("Accept");
  });

  it("sets Cache-Control from config", () => {
    const headers = buildResponseHeaders({ tokens: 1 }, baseConfig);
    expect(headers.get("Cache-Control")).toContain("max-age=3600");
    expect(headers.get("Cache-Control")).toContain("stale-while-revalidate=86400");
  });

  it("sets x-markdown-preset", () => {
    const headers = buildResponseHeaders({ tokens: 1 }, baseConfig);
    expect(headers.get("x-markdown-preset")).toBe("custom");
  });

  it("adds debug headers when debug=true", () => {
    const headers = buildResponseHeaders(
      { tokens: 1, bytesIn: 500, bytesOut: 200, selectorMatched: true },
      { ...baseConfig, debug: true },
    );
    expect(headers.get("x-markdown-debug-bytes-in")).toBe("500");
    expect(headers.get("x-markdown-debug-bytes-out")).toBe("200");
    expect(headers.get("x-markdown-debug-selector")).toBe("matched");
  });

  it("debug selector reports not-found when selectorMatched=false", () => {
    const headers = buildResponseHeaders(
      { tokens: 1, selectorMatched: false },
      { ...baseConfig, debug: true },
    );
    expect(headers.get("x-markdown-debug-selector")).toBe("not-found");
  });

  it("omits debug headers when debug=false", () => {
    const headers = buildResponseHeaders(
      { tokens: 1, bytesIn: 500, bytesOut: 200, selectorMatched: true },
      baseConfig,
    );
    expect(headers.get("x-markdown-debug-bytes-in")).toBeNull();
    expect(headers.get("x-markdown-debug-selector")).toBeNull();
  });
});
