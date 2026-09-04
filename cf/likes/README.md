# Likes / guestbook backend

Cloudflare Worker + KV. Deploy from this folder:

    export CLOUDFLARE_API_TOKEN=...   # token lives in ~/.cloudflare/token, never in the repo
    npx wrangler kv namespace create LIKES     # once; paste the id into wrangler.toml
    npx wrangler deploy

The site reads the API base URL from `likes_api` in `_config.yml`.
