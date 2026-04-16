import { z } from "zod";

export const userConfigSchema = z.object({
  preset: z.enum(["astro", "hugo", "custom"]),
  selector: z.string().optional(),
  strip: z.array(z.string()).max(100).optional(),
  frontmatter: z.array(z.string()).optional(),
  redirects: z.record(z.string(), z.string()).optional(),
  forceMarkdownForUserAgents: z.array(z.instanceof(RegExp)).optional(),
  autoDetectAiCrawlers: z.boolean().optional(),
  cache: z
    .object({
      maxAge: z.number().min(0).optional(),
      staleWhileRevalidate: z.number().min(0).optional(),
    })
    .optional(),
  debug: z.boolean().optional(),
  maxOriginBytes: z.number().positive().optional(),
});
