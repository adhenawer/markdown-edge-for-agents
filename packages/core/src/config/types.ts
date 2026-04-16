export type PresetName = "astro" | "hugo" | "custom";

export interface UserConfig {
  preset: PresetName;
  selector?: string;
  strip?: string[];
  frontmatter?: string[];
  redirects?: Record<string, string>;
  forceMarkdownForUserAgents?: RegExp[];
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
  cache: { maxAge: number; staleWhileRevalidate: number };
  debug: boolean;
  maxOriginBytes: number;
  preset: PresetName;
}
