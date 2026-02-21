# Cubic Wiki Generator

Generate feature-driven subsystem wiki pages for public GitHub repos, with line-level citations and optional Q&A.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Minimum required:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (defaults to `openai/gpt-5-mini` if omitted in some paths)
- `OPENAI_BASE_URL` (optional, if using a provider gateway)
- `GITHUB_TOKEN` (optional but strongly recommended for higher rate limits)

Cache backend (required, Upstash Redis):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Upstash Redis cache integration

This project supports Redis-backed analysis cache via `@upstash/redis`:

- Cache key: `{owner}__{repo}__{headSha}`
- Record: full analysis payload (`productSummary`, `subsystems`, `wikiPages`)
- Extra indices:
  - latest cache per repo
  - recent repos list for homepage

### How to enable Upstash

1. In Vercel, add an Upstash Redis integration to your project.
2. Pull env vars locally:

```bash
vercel env pull .env.local
```

3. Restart dev server.


### How to use it in this app

- `POST /api/analyze`:
  - Reads by `{owner, repo, headSha}` first.
  - On miss, runs full pipeline and stores result in Upstash.
- `GET /api/analyze/:owner/:repo`:
  - Reads latest cached analysis for that repo.
- `GET /api/analyze/recent`:
  - Lists latest cached repos.

## Deploy

Deploy on Vercel and set env vars in Project Settings -> Environment Variables.
