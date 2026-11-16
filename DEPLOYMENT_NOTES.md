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

## Architecture graph rework (2026-11-16)
The graph page was slow and opened on a random corner. Changes made:
- **Load first, then show.** The page downloads the full graph and builds the layout behind a loading screen, then shows the whole graph fitted to the screen in one go (zoom out to 2%).
- **Compact layout**: folder > file > module > function, packed into wrapped rows so the graph keeps roughly screen proportions instead of becoming a very wide strip. Call and import links no longer distort the layout.
- **No live animation.** The glow filters and animated dashes on edges, the node blur, and the pulsing dots are removed. Only on-screen elements are drawn.
- **Layer toggles** at the top (Structure / Calls / Imports). Calls and imports are hidden by default. Clicking a node highlights all of its links.
- **Mini-map** is colour-coded by type, moved to the bottom-left, and drag/zoomable. The zoom controls are now top-left. The ✨ button (bottom-right) opens the AI chat.

## Analysis progress bar (2026-11-16)
- Importing a repo (GitHub or ZIP) now shows a **progress bar with %** and the current stage: Downloading > Scanning > Parsing > Building graph > Detecting patterns.
- When it finishes, the page **does not redirect**. It shows an "Analysis complete" card with **View Architecture Map** and **Ask AI** buttons. Failures show the error.
- Reopening a project page shows the progress if an analysis is still running, or the "complete" card for the last one.
- Backend: the job is created before downloading. Progress is saved per file while parsing (40 to 70%) and graph building (72 to 90%). New owner-checked endpoint `GET /api/analysis/projects/{id}/latest-job`.

## Profile bar & logout (2026-11-16)
- Every signed-in page has a top bar: the **CodeAtlas** logo and **Projects** on the left, a profile button on the right (yellow avatar with your initial and your email).
- Clicking the profile opens a menu: "Signed in as <email>", **My Projects**, **Log out**. Log out clears the session and goes to /login.
- The full-screen architecture page has the same profile menu (dark style) next to "Exit Matrix".
- If the session token has expired, you are signed out automatically and sent to /login.
- Files: `apps/web/src/components/UserMenu.tsx`, `TopBar.tsx`, and `app/layout.tsx`.

## UI cleanup (2026-11-16)
- Removed the "Architecture Map" / "AI Chat" buttons from the project header and the "Projects" button from the top bar.
- AI chat is now a fixed ✨ button at the bottom-right of the project page and the architecture map. It opens a chat window there (`components/ChatWidget.tsx`). On the map, the selected node is sent as context.
- Project page layout: the **Analysis complete** card (repo + **View Architecture Map**), then the **Analysis Summary**, then the **Re-analyze Repository** box (always visible, prefilled with the analyzed GitHub URL).
- **Analysis Summary**: totals for files, modules, classes, functions, calls and imports; a language bar; and findings (circular dependencies, possibly unused code) with filter chips, behind a **Show details / Hide details** toggle (closed by default; the choice is remembered in the browser). Backend: `GET /api/analysis/projects/{id}/summary` (owner-checked, latest completed analysis).

## Trie search (2026-11-16)
- `apps/web/src/lib/trie.ts`: a prefix tree. Each name is indexed whole and by each word (snake_case, camelCase, dots, slashes), so "user" finds `get_user_by_id` and `UserService`. Exact match first, then full-name prefix, then word prefix; shorter names first.
- **Architecture map**: a search box in the header (press `/` to focus). Picking a result zooms to the node, selects it and opens its details. Arrow keys, Enter and Esc work.
- **Projects page**: a search bar filters projects by name or description.

## Professional redesign (2026-11-16)
Visual only. No features changed.
- Design system in `apps/web/src/app/globals.css`: Inter font, slate neutrals, one indigo accent, and shared classes (`page`, `card`, `btn btn-primary/secondary/ghost`, `input`, `label`, `breadcrumb`, `alert-error`, `badge`).
- New `Logo` (indigo mark + wordmark) used in the top bar, auth screens and landing page.
- Landing page: hero, call-to-action buttons, and 4 feature cards.
- Sign in / sign up: split screen (dark brand panel + form), via `components/AuthShell.tsx`.
- Projects: page header, search, skeleton loading, cards with icon, delete on hover and "Open →".
- Project page: a header card (gradient banner, project icon, name, status badge, description, repository link, last analyzed and created dates, View architecture map button), a progress or error card while analyzing or failed, the summary, and an import section with GitHub + ZIP drop zone.
- Chat page restyled. It also now reads the API's `reply` field (it previously showed "undefined").
- Architecture map header: "Architecture map" / "Back to project" (was "CodeAtlas Engine" / "Exit Matrix").
- The ✨ AI chat button is unchanged.

## Motion & effects (2026-11-16)
- Motion system in `globals.css`. Only transform and opacity are animated, and all motion is off when the visitor has "Reduce motion" turned on.
- `app/template.tsx`: each page fades and slides in on navigation.
- Lists and sections appear one after another (`.stagger`). Cards lift on hover (`.card-hover`). Buttons press-scale. Loading placeholders shimmer (`.skeleton`).
- Project header gradient slowly drifts. The analysis progress bar has a moving shine, and the "Analyzing" badge dot pings.
- Summary numbers count up, and the language bar grows into place. The profile menu pops open.

## Night-sky theme (2026-11-16)
- Every page, including sign in, sits on an animated night sky (`components/NightSky.tsx`, mounted in `app/layout.tsx`): a gradient sky, a full moon with craters and glow, twinkling stars, and shooting stars every 4 to 10 seconds. Everything is drawn on one canvas at about 30 fps, paused in hidden tabs, and static under reduced motion.
- **Tap the moon for morning**: the moon travels along a ∩ arc from the top-right towards the left and sets, while the sun rises along a matching arc from the lower right into the moon's place (about 3 seconds). The sky fades to light blue, the stars fade out, shooting stars stop, and text on the sky turns dark navy for readability. **Tap the sun** to reverse it back to night. Every visit starts at night (`html[data-sky]`). Cards and the top bar stay dark in both. Taps are detected by position, so buttons, links, cards and the graph over the moon or sun still work normally.
- **Moving sky**: stars in 3 depth layers drift sideways at different speeds, and mouse movement and page scroll add parallax. There is no ground or hills, only sky. Up to 900 stars, and shooting stars every 1.5 to 4.5 seconds (up to 3 at once).
- Cards are frosted dark glass. The interface is always dark (`html.dark`).
- The moon fades on the architecture map so the graph stays readable.

## Project page additions (2026-11-16)
- **Download ZIP** in the project header once analyzed. GitHub projects download GitHub's own archive of the default branch (every file). ZIP-upload projects download the stored files from `GET /api/projects/{id}/download` (owner-checked).
- The analyzer now stores the text of every file up to 512 KB (not only source files) and flags binaries, so downloads and code views are complete.
- Analysis summary details start **closed** on every visit.
- The import section was redesigned: a header with icon and subtitle, a **GitHub | ZIP upload** switch, an inline URL field with a button, or a drop zone.

## Moonlit colour palette (2026-11-16)
One palette everywhere, defined as CSS variables in `globals.css`:
- **Night navy** surfaces, a **soft indigo** accent (`--c-accent` #6d72f6) for buttons, links and focus, and **moon-gold** (`--c-moon` #f3dfa2) for warm highlights.
- **Pale sky-blue** (#7cc4f5), **teal** (#5fd4c4) and **lavender** (#b49cf5) as secondaries; a muted navy (#3b4766) for neutral items.
- Applied to: primary buttons (soft gradient and glow), the logo, the project banner (night gradient with a moon glow instead of hot purple), the progress bar, the language bar (distinct hues at equal brightness, muted "Other"), status badges, graph nodes, edges, minimap, search tags, the details panel, and the React Flow controls.

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
