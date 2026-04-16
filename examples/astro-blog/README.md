# Astro blog example

Worker for Astro blogs. Uses the `astro` preset which comes with selectors and strip list ready for the standard Astro layout.

## Usage

1. Edit `wrangler.toml` with your domain
2. `npm install && npx wrangler deploy`

## Test

```bash
curl -H "Accept: text/markdown" https://example.com/post
```
