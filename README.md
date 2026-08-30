# a place where i can rest

a simple writing space.

## run locally

```bash
python3 -m http.server 8080
```

open http://localhost:8080

## stack

- **Frontend:** Cloudflare Pages
- **Backend:** Cloudflare Workers
- **Database:** Cloudflare D1

## deploy

```bash
# push to github, Cloudflare Pages auto-deploys

# deploy worker
wrangler deploy

# init database
wrangler d1 execute myrest --remote --command="CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, content TEXT, image TEXT, date TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
```