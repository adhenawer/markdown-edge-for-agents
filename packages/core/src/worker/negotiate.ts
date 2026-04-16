/**
 * Content negotiation: decide whether the incoming request prefers markdown.
 *
 * Rules (in order):
 *   1. `Accept` header contains `text/markdown` → true.
 *   2. `User-Agent` matches one of `forcedUserAgents` → true.
 *   3. Otherwise → false.
 */
export function wantsMarkdown(request: Request, forcedUserAgents: readonly RegExp[]): boolean {
  const accept = request.headers.get("Accept") ?? "";
  if (accept.includes("text/markdown")) return true;

  const ua = request.headers.get("User-Agent") ?? "";
  if (!ua) return false;
  return forcedUserAgents.some((rx) => rx.test(ua));
}
