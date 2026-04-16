export type PresetName = "astro" | "hugo" | "custom";

export interface UserConfig {
  preset: PresetName;
  selector?: string;
  strip?: string[];
  frontmatter?: string[];
  redirects?: Record<string, string>;
  /** Custom UA patterns that force markdown response. */
  forceMarkdownForUserAgents?: RegExp[];
  /**
   * Auto-detect known AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.)
   * and serve them markdown without requiring `Accept: text/markdown`.
   * Cloudflare Pro doesn't do this — differentiator.
   * @default false
   */
  autoDetectAiCrawlers?: boolean;
  cache?: { maxAge?: number; staleWhileRevalidate?: number };
  debug?: boolean;
  maxOriginBytes?: number;
}

export interface ResolvedConfig {
  selector: string;
  strip: string[];
  frontmatter: string[];
  redirects: Record<string, string>;
  forceMarkdownForUserAgents: RegExp[];
  autoDetectAiCrawlers: boolean;
  cache: { maxAge: number; staleWhileRevalidate: number };
  debug: boolean;
  maxOriginBytes: number;
  preset: PresetName;
}
