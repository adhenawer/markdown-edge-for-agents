# Hugo blog example

Worker for Hugo blogs. Uses the `hugo` preset which comes with selectors and strip list for standard Hugo themes.

## Usage

1. Edit `wrangler.toml` with your domain
2. `npm install && npx wrangler deploy`

## Test

```bash
curl -H "Accept: text/markdown" https://example.com/post
```
