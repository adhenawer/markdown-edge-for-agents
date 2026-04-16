import prompts from "prompts";
import type { Framework } from "./detect.js";

export interface PromptAnswers {
  workerName: string;
  workerPath: string;
  zone: string;
  pattern: string;
  preset: Framework;
}

export async function runPrompts(ctx: {
  detectedFramework: Framework;
}): Promise<PromptAnswers> {
  const res = await prompts([
    {
      name: "workerName",
      type: "text",
      message: "Worker name (nome único no CF):",
      initial: "markdown-agent",
    },
    {
      name: "workerPath",
      type: "text",
      message: "Diretório do worker:",
      initial: "workers/markdown-agent",
    },
    {
      name: "zone",
      type: "text",
      message: "Cloudflare zone (ex: example.com):",
    },
    {
      name: "pattern",
      type: "text",
      message: "Route pattern (ex: example.com/posts/*):",
      initial: (_prev: unknown, all: { zone?: string }) => `${all.zone ?? "example.com"}/*`,
    },
  ]);

  return {
    workerName: res.workerName,
    workerPath: res.workerPath,
    zone: res.zone,
    pattern: res.pattern,
    preset: ctx.detectedFramework,
  };
}
