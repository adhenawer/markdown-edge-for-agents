import { describe, expect, it } from "vitest";
import { extractMeta } from "../../../src/converter/extractMeta.js";

const html = `
<!doctype html>
<html lang="pt-BR">
  <head>
    <title>Meu Post</title>
    <meta name="description" content="Sobre coisas">
    <meta name="author" content="adhenawer">
  </head>
  <body><article>conteudo</article></body>
</html>`;

describe("extractMeta", () => {
  it("extracts title, description, author, lang", async () => {
    const meta = await extractMeta(html);
    expect(meta.title).toBe("Meu Post");
    expect(meta.description).toBe("Sobre coisas");
    expect(meta.author).toBe("adhenawer");
    expect(meta.lang).toBe("pt-BR");
  });

  it("defaults lang to en when missing", async () => {
    const meta = await extractMeta("<html><head><title>X</title></head><body></body></html>");
    expect(meta.lang).toBe("en");
  });

  it("returns empty strings for missing fields", async () => {
    const meta = await extractMeta("<html><body></body></html>");
    expect(meta.title).toBe("");
    expect(meta.description).toBe("");
    expect(meta.author).toBe("");
  });
});
