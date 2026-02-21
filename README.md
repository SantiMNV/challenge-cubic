# Cubic Wiki Generator

Generate feature-driven wiki pages for public GitHub repositories with line-level citations and an optional chat assistant.

## What This App Does

- Accepts a public GitHub repository URL.
- Analyzes the repo through a 3-step AI pipeline.
- Produces user-facing subsystem pages (not technical-layer pages).
- Attaches line-level citation links pinned to commit SHA.
- Caches analysis in Upstash Redis.
- Supports Q&A chat grounded in generated wiki context.

## How The Code Works

### 1) Analyze API (`POST /api/analyze`)

Implemented in `/src/app/api/analyze/route.ts`.

Flow:
- Parse and validate input (`repoUrl`, optional `forceRefresh`).
- Resolve `owner/repo` and fetch repo head SHA.
- Check cache by `{owner, repo, headSha}`.
- On cache miss:
- Fetch and clean file tree.
- Select high-signal paths with AI.
- Fetch selected files.
- Run pipeline:
- Step A: subsystem extraction.
- Step B: evidence mapping (exact path + line ranges).
- Step C: wiki drafting (parallel by subsystem).
- Parse markdown citations to permalink URLs.
- Store final result in Upstash and return payload.

### 2) AI Pipeline

Implemented in `/src/lib/ai/pipeline.ts`.

- Uses `generateObject` + Zod schemas for structured outputs.
- Rejects forbidden subsystem labels like `frontend`, `backend`, `api`, `utils`.
- Validates evidence line ranges against real fetched files.
- Requires valid citations for each generated wiki page.

### 3) GitHub Ingestion + Citations

Relevant files:
- `/src/lib/github/client.ts`
- `/src/lib/github/filters.ts`
- `/src/lib/citations/parser.ts`
- `/src/lib/citations/permalink.ts`

Behavior:
- Fetches repo head and recursive tree.
- Filters non-useful paths.
- Fetches selected file contents with bounds.
- Builds immutable citation links to exact lines: `blob/{sha}/{path}#Lx-Ly`.

### 4) Storage and Retrieval

Relevant files:
- `/src/lib/store/index.ts`
- `/src/lib/store/kv.ts`

Current storage:
- Upstash Redis (required in current implementation).
- Records full analysis payload and indexes:
- latest result per repo.
- recent analyzed repos list.

Read APIs:
- `GET /api/analyze/[user]/[repository]`
- `GET /api/analyze/recent`

### 5) UI

Relevant files:
- `/src/app/page.tsx`
- `/src/components/repo-analyzer.tsx`
- `/src/components/repo-wiki-view.tsx`
- `/src/components/chat-assistant.tsx`

Current UX:
- Landing form with URL validation and progress stages.
- Wiki sidebar + searchable subsystem list.
- Markdown wiki rendering + citations list.
- Floating chat assistant with streamed responses from `/api/qa`.

## Implemented Features

- [x] End-to-end repository analysis pipeline.
- [x] Feature-oriented subsystem extraction.
- [x] Evidence mapping with line ranges.
- [x] Wiki drafting with citations.
- [x] SHA-pinned GitHub permalinks.
- [x] Upstash Redis cache and retrieval routes.
- [x] Cached repo page route (`/[user]/[repository]`).
- [x] Streaming repository Q&A assistant.

## Local Setup

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Required:
- `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional:
- `OPENAI_MODEL` (default: `gpt-5-mini`)
- `OPENAI_BASE_URL`
- `GITHUB_TOKEN` (recommended for rate limits)

## What To Improve For Production

- Improvea analyzing time.
- Add streaming doc generation.
- Add robust retries and per-step timeout/cancellation for LLM and GitHub calls.
- Add partial-success mode when one subsystem fails.
- Add rate limiting and abuse protection on analyze/chat endpoints.
- Add observability (stage latency, token usage, cost, error rates).
- Add automated tests (unit + integration + E2E).
- Add Postgres for durable history and run analytics (keep Redis as hot cache).

## Analysis Speed Improvements

- Right now it takes ~2minutes using gpt-5-mini, the quickest and simplest way to optimize this is using a faster model.
- Use smarter context slicing (symbol/function-level chunks).
- Add a cheap pre-ranking pass before full evidence mapping.
- Tune bounded concurrency for fetch + generation steps.
- Return stale cache immediately and refresh in background.
- Cache intermediate stage artifacts, not only final payloads.
- Avoiding LLM's creation of sha codes will also improve timing.


## Better Chat UI and QA Improvements

- Persist chat history per repository.
- Add citations in assistant answers.
- Add retrieval over evidence snippets instead of passing broad markdown each turn.
- Add stop-generation control and suggested follow-up prompts.
- Add clearer uncertainty behavior when context is insufficient.
