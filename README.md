# a place where i can rest

a simple writing space.

## run locally

```bash
python3 -m http.server 8080
```

open http://localhost:8080

## stack

- **Cloudflare Workers** — serve HTML + API
- **Cloudflare D1** — database
- **Cloudflare Assets** — static files

## deploy

```bash
wrangler deploy
```

## update

```bash
cp core/main.js public/core/main.js
cp core/style.css public/core/style.css
cp index.html public/index.html
wrangler deploy
```