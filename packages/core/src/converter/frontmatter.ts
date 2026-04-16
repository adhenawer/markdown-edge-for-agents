/**
 * Build a YAML frontmatter block for a markdown document.
 *
 * Empty string fields are omitted (so callers can pass meta objects with
 * missing values without polluting the output). Strings are double-quoted and
 * internal double quotes are backslash-escaped. `lang` is emitted unquoted
 * (plain YAML scalar) and defaults to `"en"`.
 *
 * Output always ends with `---\n\n` so the frontmatter can be prepended to
 * markdown content directly.
 */

export interface FrontmatterFields {
  title?: string;
  author?: string;
  description?: string;
  lang?: string;
  source: string;
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function buildFrontmatter(fields: FrontmatterFields): string {
  const lines: string[] = ["---"];
  if (fields.title) lines.push(`title: "${escapeYaml(fields.title)}"`);
  if (fields.author) lines.push(`author: "${escapeYaml(fields.author)}"`);
  if (fields.description)
    lines.push(`description: "${escapeYaml(fields.description)}"`);
  lines.push(`source: "${escapeYaml(fields.source)}"`);
  lines.push(`lang: ${fields.lang ?? "en"}`);
  lines.push("---");
  lines.push("");
  return lines.join("\n") + "\n";
}
