import prompts from "prompts";
import { describe, expect, it } from "vitest";
import { runPrompts } from "../../src/prompts.js";

describe("runPrompts", () => {
  it("returns answers with detected defaults", async () => {
    prompts.inject(["my-worker", "workers/md", "example.com", "example.com/*"]);
    const result = await runPrompts({ detectedFramework: "astro" });
    expect(result.workerName).toBe("my-worker");
    expect(result.workerPath).toBe("workers/md");
    expect(result.zone).toBe("example.com");
    expect(result.preset).toBe("astro");
  });

  it("allows override when framework is custom", async () => {
    prompts.inject(["w", "workers/w", "x.com", "x.com/*"]);
    const result = await runPrompts({ detectedFramework: "custom" });
    expect(result.preset).toBe("custom");
  });
});
