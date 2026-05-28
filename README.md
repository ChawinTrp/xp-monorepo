# Project XP

A personal life operating system built on a graph-based data model. Two pillars:

- **The Game** — goal, skill, and task tracking with hours-based mastery progression
- **The Orchestra** — project management, routine tracking, and relationship orchestration

---

## What It Does

- Track **Tasks** with priority, due dates, estimated hours, and time tracking
- Track **Routines** with daily/weekly check-ins, streaks, and time-of-day scheduling
- **Skills** accumulate hours from completed tasks and routine check-ins, progressing through mastery tiers (Unfamiliar → Familiar → Skilled → Master → World Class at 10,000h)
- **Projects** roll up task progress automatically
- **People** with catch-up scheduling and relationship tracking
- **Dashboard** with live stats: streaks, routines done today, tasks done this week, total skill hours
- **Kanban**, **Gantt**, **Calendar**, **Sprint** planning, **Graph** view, **Skills** view
- **Mobile shell** (≤768px) — swipe-card focus deck for Tasks and Routines, timer, quick capture

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS v11, Apollo Server v5, MongoDB Atlas via Mongoose |
| Frontend | React 19, Apollo Client v4, Vite, Tailwind CSS |
| Graph view | force-graph (canvas) |
| Drag & drop | dnd-kit |
| Icons | Lucide React |
| Shared | `@xp/shared` — mastery tiers, parent rules |

---

## Repository Structure

```
xp-monorepo/
├── apps/
│   ├── api/          # NestJS backend — GraphQL, PropagationService, GCal connector
│   └── web/          # React frontend — 11 views + mobile shell
└── packages/
    └── shared/       # Mastery tiers, ALLOWED_MAIN_PARENTS
```

---

## Local Development

```bash
# Install from repo root
npm install

# Terminal 1 — API  http://localhost:3000/graphql
npm run start:dev -w api

# Terminal 2 — Web  http://localhost:5173
npm run dev -w web
```

**Required env var for API** (`apps/api/.env`):
```
MONGO_URI=mongodb+srv://...
PORT=3000
NODE_ENV=development
```

**Required env var for Web** (`apps/web/.env`):
```
VITE_API_URL=http://localhost:3000
```

---

## Deployed

| Service | URL |
|---------|-----|
| Frontend | https://xp-monorepo-web.vercel.app |
| API | https://xp-monorepo.onrender.com |

---

## Key Docs

| Doc | What it covers |
|-----|---------------|
| `docs/TECHNICAL_SPEC.md` | Schema, API surface, propagation engine, tech stack versions |
| `NODE.md` | Node type rules, parent hierarchy, full metadata field reference |
| `XP.md` | Master architecture, use cases, roadmap |
| `DESIGN_HANDOFF.md` | Desktop UI spec (Catppuccin Mocha theme, component patterns) |
| `DESIGN_HANDOFF_MOBILE.md` | Mobile UI spec (card deck, swipe gestures, timer bar) |
| `docs/ARCHITECTURE_AND_LESSONS.md` | Architectural decisions and lessons learned |
| `docs/DEPLOYMENT.md` | Deployment configuration and known issues |
| `docs/the-game/` | Use case specs: task completion, routine check-in, skill linking |
