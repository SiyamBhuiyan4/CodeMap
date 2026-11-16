# CodeMap: Vercel Deployment Notes

Live since **2026-11-16**. Maintained by **SiyamBhuiyan4**.
Forked from the original project [Sifaetul/CodeMap](https://github.com/Sifaetul/CodeMap).

## Live links
| What | URL |
|---|---|
| Website | https://codemap-web-peach.vercel.app |
| API | https://codemap-api.vercel.app |
| API health check | https://codemap-api.vercel.app/ready |
| API docs (Swagger) | https://codemap-api.vercel.app/docs |
| GitHub repo | https://github.com/SiyamBhuiyan4/CodeMap |

Everything runs on **free plans**. No card was used.

## How it is set up
| Part | Where it runs |
|---|---|
| Next.js frontend (`apps/web`) | Vercel project `codemap-web` (root directory `apps/web`, framework Next.js) |
| FastAPI backend (`apps/api`, `apps/analyzer`, `packages`) | Vercel project `codemap-api` (repo root, `api/index.py` + `vercel.json`) |
| Postgres | Neon **Free** plan, added through the Vercel Marketplace (resource `codemap-db`) |
| Analysis jobs | Run inside the API request (`ANALYSIS_MODE=inline`), up to 300 s per run |
| AI chat | Built-in fallback answers. Real llama3 answers via Groq once `LLM_*` vars are set (see below) |

The original **docker-compose** setup (Celery worker, Redis, Ollama, local Postgres) still works unchanged for running locally.

## Environment variables
**codemap-api**
- `DATABASE_URL` (plus other `PG*`/`POSTGRES_*` vars): added automatically by the Neon integration
- `SECRET_KEY`: random value that signs login tokens. Don't change it, or everyone gets logged out.
- `ANALYSIS_MODE=inline`
- `CORS_ORIGINS=https://codemap-web-peach.vercel.app` (comma-separate to allow more domains)
- Optional, for real AI chat: `LLM_PROVIDER=openai`, `LLM_BASE_URL=https://api.groq.com/openai/v1`, `LLM_API_KEY=<groq key>`, `LLM_MODEL=llama-3.1-8b-instant`

**codemap-web**
- `NEXT_PUBLIC_API_URL=https://codemap-api.vercel.app`

## Code changes made for Vercel (no features removed)
- **Inline analysis mode**: `ANALYSIS_MODE=inline` runs the analyzer in the request. Celery is still the default. The job logic is shared in `apps/analyzer/jobs.py`.
- **GitHub import without git**: when the server has no `git` program, the repo is downloaded as a tarball from the GitHub API (`packages/shared/utils/git.py`), with size and path-traversal guards. Set `GITHUB_TOKEN` to raise GitHub's 60 requests/hour limit.
- **Source code saved in the database**: new column `files.content` (migration `b7c1d2e3f4a5`). The code viewer and chat context read from disk first, then fall back to the database.
- **Choosable AI provider**: Ollama (default) or any OpenAI-compatible API, such as Groq (`packages/shared/ai/provider.py`).
- `CORS_ORIGINS` env var. `postgres://` URLs are normalised for SQLAlchemy.
- Next.js upgraded from 14.1.0 to **14.2.35** (security fix).
- `docker-compose.prod.yml` fixed: API port exposed, shared workspaces volume, Ollama service.

## What Siyam did (by hand)
1. Asked for the app to be hosted for free, without a card, and without dropping any features.
2. Tried Oracle Cloud first (needs a card, so dropped), then Hugging Face (Docker Spaces need PRO, so dropped).
3. Created a Hugging Face account and token (not used in the end).
4. Accepted the Neon marketplace terms on Vercel (Free plan).

## Redeploying
```bash
# API (from the repo root)
vercel deploy --prod
# Web
cd apps/web && vercel deploy --prod
# New database migrations (DATABASE_URL from `vercel env pull`)
cd apps/api && alembic upgrade head
```

## Known limits
- One analysis can take at most **300 seconds** (Vercel free plan). Very large repos may time out.
- ZIP uploads go through Vercel's 4.5 MB request-body limit, so import big repos from GitHub instead.
- The rate limiter is in-memory, so it applies per server instance.
- The test account `e2e-…@example.com` and its project "e2e test" were created during the live check. They can be deleted.
