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

## The Vault (Future)
Obsidian sync, one-way push, index generation.
