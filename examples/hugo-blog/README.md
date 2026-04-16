# Hugo blog example

Worker para blogs Hugo. Usa o preset `hugo` que já traz selectors e strip list pra temas Hugo padrão.

## Como usar

1. Edite `wrangler.toml` com seu domínio
2. `npm install && npx wrangler deploy`

## Teste

```bash
curl -H "Accept: text/markdown" https://example.com/post
```
