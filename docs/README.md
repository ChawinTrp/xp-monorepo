# XP Work Plans

Living reference docs for each use-case area. Status tracked per file.

## The Game (Phase 7)
Tasks, Routines, Skills, Mastery progression.

| Doc | Use Case | Status |
|-----|----------|--------|
| [overview](the-game/overview.md) | Mastery system + tiers | Done |
| [uc-task-completion](the-game/uc-task-completion.md) | Create -> Timer -> Complete -> Skill credit | Done |
| [uc-routine-checkin](the-game/uc-routine-checkin.md) | Routine check-in + timer + skill credit | Done |
| [uc-skill-linking](the-game/uc-skill-linking.md) | Link skills to tasks/routines via UI | Done (CreateTaskModal TODO) |
| [uc-domain-progress](the-game/uc-domain-progress.md) | Domain health + aggregate progress | Done |

## The Orchestra (Phase 8)
Gantt, Calendar, Sprint planning, Google Calendar connector.

| Doc | Use Case | Status |
|-----|----------|--------|
| [skill](the-orchestra/skill.md) | Phase 8 plan + all UCs | Done |

### Views Added
- **Gantt** — horizontal timeline, week/month/quarter zoom, drag-to-resize dates, today line
- **Calendar** — monthly grid, tasks on due dates, routine dots, month navigation
- **Sprint** — Board/Sprint toggle in Kanban, create sprints, assign tasks, progress bar
- **Settings** — Google Calendar OAuth2 connection status

### Google Calendar Connector
- Backend: `GCalModule` (NestJS) with OAuth2 flow, event CRUD via googleapis
- Auto-creates "XP Tasks" calendar, syncs on every node create/update/delete
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

## Mobile Responsive (Phase 8.5)
All 9 views responsive. CSS `clamp()`, `auto-fit minmax()` grids, mobile sidebar overlay with hamburger toggle, horizontal-scroll tab bar. Breakpoint: 768px.

## Deployment (Phase 9) — In Progress
| Component | Target | Status |
|-----------|--------|--------|
| API | GCP Cloud Run (asia-southeast1) | Ready — Dockerfile created, env-var-based config |
| Frontend | Vercel | Ready — `VITE_API_URL` env var wired |
| Database | MongoDB Atlas (existing) | Done — no changes needed |

### Files Added
- `apps/api/Dockerfile` — multi-stage build (node:22-slim)
- `.dockerignore` — excludes node_modules, .git, web app, .env
- `apps/api/src/main.ts` — conditional dotenv (dev only, Cloud Run injects env vars)
- `apps/web/src/main.tsx` — `VITE_API_URL` env var for API endpoint
- `apps/web/src/views/Settings.tsx` — same env var pattern

## The Vault (Future)
Obsidian sync, one-way push, index generation.
