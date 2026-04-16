/**
 * Redirect matcher.
 *
 * Rules are a map of `pattern -> target`:
 *   - Pattern without `*` is an exact pathname match.
 *   - Pattern with `*` is a glob; the single captured segment substitutes `$1`
 *     in the target.
 *
 * Exact matches take priority over glob matches. The resulting `to` URL is
 * rebuilt against the incoming origin and preserves the original query string.
 * Status defaults to 301 (permanent).
 */

export interface RedirectMatch {
  to: string;
  status: 301 | 302;
}

function escapeRegex(s: string): string {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

export function matchRedirect(
  url: URL,
  rules: Record<string, string>,
): RedirectMatch | null {
  const pathname = url.pathname;

  // 1. Exact match wins over glob.
  const exact = rules[pathname];
  if (exact !== undefined) {
    return { to: url.origin + exact + url.search, status: 301 };
  }

  // 2. Glob matching: `*` captures greedily, substituted as `$1` in target.
  for (const [pattern, target] of Object.entries(rules)) {
    if (!pattern.includes("*")) continue;
    const regexSource = `^${pattern.split("*").map(escapeRegex).join("(.+)")}$`;
    const regex = new RegExp(regexSource);
    const m = pathname.match(regex);
    if (m) {
      const expanded = target.replace(/\$1/g, m[1] ?? "");
      return { to: url.origin + expanded + url.search, status: 301 };
    }
  }

  return null;
}
