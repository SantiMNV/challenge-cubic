# Cubic Wiki Generator - Ordered TODO (Fast Pipeline First)

## 0. Minimal Bootstrap (only what is needed to run pipeline)
- [x] Initialize Next.js 15 app with TypeScript, App Router, ESLint.
- [x] Install backend-first dependencies: `ai`, `@ai-sdk/openai`, `zod`, `octokit`.
- [x] Add `.env.local` with `OPENAI_API_KEY` and optional `GITHUB_TOKEN`.
- [x] Create core folders: `src/app/api`, `src/lib/{ai,github,citations,utils,store}`.

## 1. Core Contracts and Utilities
- [x] Implement repo URL parser utility (`owner/repo` extraction and validation).
- [x] Define shared TypeScript types for project, subsystem, page, citation.
- [x] Create Zod schemas for all LLM outputs (`SubsystemListSchema`, `WikiPageSchema`, etc.).
- [x] Add centralized logger and error helpers.

## 2. GitHub Ingestion (first executable milestone)
- [x] Build GitHub client for repo metadata, default branch, and latest commit SHA.
- [x] Implement recursive file tree fetch.
- [x] Add file filtering rules (skip binaries/build artifacts/lockfiles and invalid dirs like `.agents`, `.claude`, `tests`, `.coverage`).
- [x] Implement selected file content fetching with retry/backoff and size limits.
- [x] Add function to build SHA-based permalink citations (`#Lx-Ly`).

## 3. Pipeline Step A - Subsystem Extraction (test ASAP)
- [x] Create subsystem extraction prompt (feature-driven, no technical-layer labels).
- [x] Call `gpt-5-mini` through Vercel AI SDK.
- [x] Parse and validate output with Zod.
- [x] Add guardrails for invalid names (`frontend`, `backend`, `api`, `utils`, etc.).
- [x] Use AI-driven signal file path selection from full cleaned tree (no hardcoded repo heuristics, no fixed 20-path cap).
- [x] Migrate structured generation to AI SDK object-first flow (`generateObject`) and remove `content` parsing ambiguity.
- [x] Align structured output schema with Azure/OpenAI `response_format` JSON schema requirements (required properties, incl. `externalServices`).

## 4. Pipeline Step B - Evidence Mapping
- [x] Implement per-subsystem relevant file selection and scoring.
- [x] Add line-numbering before truncation utility.
- [x] Build context windows with token/file/line budgets.
- [x] Generate evidence mapping output (paths + line ranges).
- [x] Validate that every cited path and line range exists.

## 5. Pipeline Step C - Wiki Drafting
- [x] Create wiki generation prompt with required sections.
- [x] Generate one page per subsystem in parallel (`Promise.all`).
- [x] Enforce citation presence for technical claims.
- [x] Parse markdown citations into clickable SHA-based GitHub links.

## 6. Expose Pipeline Through API
- [x] Implement `POST /api/analyze` (Step A + local cache by `{owner, repo, commitSha}`).
- [x] Add structured error responses and status codes.
- [x] Smoke-test `/api/analyze` with 3 repos (critical checkpoint).

## 7. Add Basic Storage and Retrieval (Deferred / Out of Scope for now)
- [ ] Implement in-memory store for local/dev use.
- [ ] Cache results by `{owner, repo, commitSha}`.
- [ ] Persist extraction/pages/citations in memory.
- [ ] Implement `GET /api/repo/:projectId` and `GET /api/page/:pageId`.

## 8. Reliability Hardening (Deferred / Out of Scope for now)
- [ ] Add retries for GitHub and LLM transient failures.
- [ ] Add timeout protection per pipeline step.
- [ ] Handle partial generation and return warnings.
- [ ] Validate malformed LLM JSON with one repair attempt.
- [ ] Ensure no secrets are exposed to client-side code.

## 9. UI Layer (after backend is proven)
- [x] Install UI dependencies: `tailwindcss`, `shadcn/ui`, `react-markdown`, `remark-gfm`.
- [x] Build landing page with repo URL form and validation errors.
- [x] Build loading/progress state (`Fetching -> Analyzing -> Writing -> Ready`).
- [x] Build wiki shell layout with sidebar + main content.
- [x] Render markdown content and styled citation links.

## 10. Optional Features
- [x] Implement optional `POST /api/qa` (answer from generated wiki context).
- [x] Add optional Q&A panel (`Sheet`) with streamed responses.

## 11. Optional Production Upgrade (DB)
- [ ] Create Postgres schema (`projects`, `subsystems`, `wiki_pages`, `citations`, `analysis_runs`).
- [ ] Add migrations and query layer.
- [ ] Switch store adapter from memory/KV to Postgres if needed.

## 12. Final Verification
- [ ] Manual test with at least 3 public repos end-to-end via UI.
- [ ] Verify subsystem names are user-facing and feature-driven.
- [ ] Verify every page has working citations to exact lines.
- [ ] Verify cache behavior across repeated runs.
- [ ] Run lint and fix all issues.

## 13. Deployment and Submission
- [ ] Push to GitHub with clean commit history.
- [ ] Deploy on Vercel.
- [ ] Configure environment variables in Vercel.
- [ ] Smoke-test production analyze flow.
- [ ] Finalize `README.md` with architecture, setup, and tradeoffs.
- [ ] Include live demo URL and repo URL.
- [ ] Record short reflection: improvements, non-production areas, missing pieces.
- [ ] Send challenge submission email within the 48-hour window.
