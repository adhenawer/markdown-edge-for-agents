import { presets } from "../presets/index.js";
import { userConfigSchema } from "./schema.js";
import type { UserConfig, ResolvedConfig } from "./types.js";

const DEFAULTS = {
  cache: { maxAge: 3600, staleWhileRevalidate: 86400 },
  debug: false,
  maxOriginBytes: 10 * 1024 * 1024,
  forceMarkdownForUserAgents: [] as RegExp[],
  redirects: {} as Record<string, string>,
};

export function resolveConfig(user: UserConfig): ResolvedConfig {
  const parsed = userConfigSchema.safeParse(user);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - "${i.path.join(".")}": ${i.message}`)
      .join("\n");
    throw new Error(
      `[mdea] Invalid config:\n${issues}\n\nConfig docs: https://github.com/adhenawer/markdown-edge-for-agents#config`,
    );
  }

  const preset = presets[parsed.data.preset];

  return {
    selector: parsed.data.selector ?? preset.selector,
    strip: parsed.data.strip ?? [...preset.strip],
    frontmatter: parsed.data.frontmatter ?? [...preset.frontmatter],
    redirects: parsed.data.redirects ?? DEFAULTS.redirects,
    forceMarkdownForUserAgents:
      parsed.data.forceMarkdownForUserAgents ?? DEFAULTS.forceMarkdownForUserAgents,
    cache: {
      maxAge: parsed.data.cache?.maxAge ?? DEFAULTS.cache.maxAge,
      staleWhileRevalidate:
        parsed.data.cache?.staleWhileRevalidate ?? DEFAULTS.cache.staleWhileRevalidate,
    },
    debug: parsed.data.debug ?? DEFAULTS.debug,
    maxOriginBytes: parsed.data.maxOriginBytes ?? DEFAULTS.maxOriginBytes,
    preset: parsed.data.preset,
  };
}
