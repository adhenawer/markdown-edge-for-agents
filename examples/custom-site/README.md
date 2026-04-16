# Custom site example

Worker para sites com HTML próprio (não Astro/Hugo).

## Como usar

1. Edite `src/index.ts` com seus selectors
2. Edite `wrangler.toml` com seu domínio
3. `npm install && npx wrangler deploy`

## Teste

```bash
curl -H "Accept: text/markdown" https://example.com/post
```
