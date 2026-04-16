/**
 * Known AI crawler User-Agent patterns.
 *
 * Curated list of bots that consume web content for LLM training, inference,
 * or retrieval. Most of these do NOT send `Accept: text/markdown` — they get
 * noisy HTML by default. Serving them markdown reduces token waste ~3x.
 *
 * Enable via `autoDetectAiCrawlers: true` in config.
 *
 * Sources:
 * - https://platform.openai.com/docs/bots
 * - https://docs.anthropic.com/en/docs/web-crawlers
 * - https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
 * - https://docs.perplexity.ai/guides/bots
 */
export const KNOWN_AI_CRAWLERS: readonly RegExp[] = [
  // OpenAI
  /GPTBot/i,
  /ChatGPT-User/i,
  /OAI-SearchBot/i,
  // Anthropic
  /ClaudeBot/i,
  /Claude-Web/i,
  /anthropic-ai/i,
  // Google AI
  /Google-Extended/i,
  /Googlebot-AI/i,
  // Perplexity
  /PerplexityBot/i,
  // Apple
  /Applebot-Extended/i,
  // Cohere
  /cohere-ai/i,
  // Meta
  /Meta-ExternalAgent/i,
  /FacebookExternalHit/i,
  // Amazon
  /Amazonbot/i,
  // Common Crawl (used by many AI labs)
  /CCBot/i,
  // ByteDance / TikTok
  /Bytespider/i,
  // Microsoft / Bing AI
  /bingbot/i,
  // You.com
  /YouBot/i,
];

/**
 * Content negotiation: decide whether the incoming request prefers markdown.
 *
 * Rules (in order):
 *   1. `Accept` header contains `text/markdown` → true.
 *   2. `User-Agent` matches a known AI crawler (if `autoDetect` enabled) → true.
 *   3. `User-Agent` matches one of custom `forcedUserAgents` → true.
 *   4. Otherwise → false (serve HTML as usual).
 */
export function wantsMarkdown(
  request: Request,
  forcedUserAgents: readonly RegExp[],
  autoDetectAiCrawlers = false,
): boolean {
  const accept = request.headers.get("Accept") ?? "";
  if (accept.includes("text/markdown")) return true;

  const ua = request.headers.get("User-Agent") ?? "";
  if (!ua) return false;

  if (autoDetectAiCrawlers && KNOWN_AI_CRAWLERS.some((rx) => rx.test(ua))) {
    return true;
  }

  return forcedUserAgents.some((rx) => rx.test(ua));
}
