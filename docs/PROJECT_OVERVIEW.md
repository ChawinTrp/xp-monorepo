# Project XP — Overview

**Version:** 0.4 (Phase 8.5)
**Author:** Chawin Teriyapirom (CT)
**Status:** Deployed — [xp-monorepo-web.vercel.app](https://xp-monorepo-web.vercel.app)
**Source:** [github.com/ChawinTrp/xp-monorepo](https://github.com/ChawinTrp/xp-monorepo)

---

## What Is XP?

XP is a personal life operating system built around two pillars:

- **The Game** — A gamified skill and goal tracker. Tasks, routines, and projects feed hours into a mastery system that levels up your skills over time. The core mechanic: completing a task propagates XP upward through the graph — Task → Project → Skill → Domain.

- **The Orchestra** — Project management views: Kanban boards, Gantt timelines, Calendar, Sprint planning, and a People/relationship tracker with catch-up reminders.

Everything is modeled as a **universal node graph**. Domains, Skills, Projects, Tasks, People, Tags, and Routines are all nodes connected by parent-child relationships. This single data model powers every view.

---

## Why It Exists

XP was built to solve a personal problem: tracking progress across life domains (engineering, fitness, finance, relationships) in a way that shows momentum over time — not just checkboxes.

It also serves as a **portfolio project** demonstrating full-stack engineering: NestJS + GraphQL backend, React + Vite frontend, MongoDB Atlas, Docker deployment, and a novel gamification engine.

---

## Key Features

### The Game (Phase 7)
- **Hours-based mastery system** — 5 tiers: Unfamiliar → Familiar → Skilled → Master → World Class
- **Upward progress propagation** — Completing a task credits hours to linked skills, recalculates project progress, and updates domain health
- **Time tracking** — Start/stop timers on tasks and routines, actual hours logged automatically
- **Routines with streaks** — Daily/weekly/monthly habits with 30-day consistency heatmap
- **Skill-linking** — Tasks and routines can be linked to multiple skills for cross-domain XP credit

### The Orchestra (Phase 8)
- **Kanban** — Drag-and-drop task boards with Board/Sprint toggle, project filtering
- **Gantt** — Timeline visualization with week/month/quarter zoom, today marker
- **Calendar** — Monthly grid showing tasks on due dates and routine completion dots
- **Sprint planning** — Time-boxed iterations with velocity tracking
- **People** — Contact circles (Family, Close Friends, Core Team) with catch-up health tracking
- **Google Calendar connector** — OAuth2 integration, auto-syncs tasks and routines to a dedicated "XP Tasks" calendar

### Infrastructure
- **Force-directed graph** — Interactive visualization of the full node graph, filterable by type
- **Global search** — Cmd+K quick search across all nodes
- **Dark theme** — Catppuccin Mocha color scheme throughout
- **Mobile responsive** — All 9 views adapt to phone/tablet widths
- **Monorepo** — npm workspaces with shared TypeScript types

---

## System Architecture (30-second version)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Vercel (CDN)   │────▶│  Render (API)   │────▶│  MongoDB Atlas  │
│  React + Vite   │     │  NestJS/GraphQL │     │  nodes (single  │
│  Static SPA     │     │  Docker         │     │   collection)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Frontend:** React 19 + Vite + Tailwind CSS + Apollo Client
**Backend:** NestJS v11 + Apollo Server v5.4 + Mongoose
**Database:** MongoDB Atlas (single `nodes` collection)
**Shared:** `@xp/shared` TypeScript package (mastery tiers, parent rules)

---

## Node Types

| Type | Purpose | Key Fields |
|------|---------|------------|
| DOMAIN | Life area (Work, Health, Finance) | Hierarchy via `mainParent` |
| SKILL | Trackable competency | `totalHours`, `level`, `hoursToNext` |
| PROJECT | Group of tasks with timeline | `status`, `progress`, `startDate`, `dueDate` |
| TASK | Actionable work item | `status`, `priority`, `estimatedHours`, `actualHours` |
| ROUTINE | Recurring habit | `cadence`, `streak`, `history[]`, `target` |
| PERSON | Contact/relationship | `circle`, `nextCatchup`, `email`, `phone` |
| TAG | Cross-cutting label | `color` |

All types share the same MongoDB schema. Type-specific fields live in a flexible `metadata` JSON object.

---

## What XP Is NOT

- **Not a notes app.** Free-form notes and ideas live in Obsidian Second Brain. XP handles structured, actionable data only.
- **Not multi-user (yet).** Single-user system. No authentication. Phase 11 planned.
- **Not a product.** Personal tool and portfolio piece. Not designed for external users.

---

## Development Timeline

| Phase | Description | Status |
|-------|-------------|--------|
| 1–5 | Foundation — CRUD, NestJS, React, MongoDB, GraphQL | ✅ Complete |
| 6 | Graph connectivity — multi-parent, SmartSearch, UI rewrite | ✅ Complete |
| 7 | The Game — mastery system, timers, propagation, skill-linking | ✅ Complete |
| 8 | The Orchestra — Gantt, Calendar, Sprint, GCal connector | ✅ Complete |
| 8.5 | Mobile responsive + deployment prep | ✅ Complete |
| 9 | Deployment — Render + Vercel | ✅ Complete |
| 10 | Obsidian Sync — one-way push to vault | 🔜 Planned |
| 11 | Auth + multi-user | 🔜 Planned |
