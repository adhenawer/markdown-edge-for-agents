# Custom site example

Worker for sites with custom HTML (not Astro/Hugo).

## Usage

1. Edit `src/index.ts` with your selectors
2. Edit `wrangler.toml` with your domain
3. `npm install && npx wrangler deploy`

## Test

```bash
curl -H "Accept: text/markdown" https://example.com/post
```
