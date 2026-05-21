# Phase 8: The Orchestra — Gantt / Sprint / Calendar + Google Calendar Connector

## Methodology

For each use-case below:
1. **Plan** — Define the interaction flow, data model changes, files to modify
2. **Implement** — Build backend then frontend, one UC at a time
3. **Test** — Verify via browser (e2e): navigate to the view, interact with it, confirm mutations persist
4. **Commit** — Push working code after each UC passes

---

## Current State

### What exists
- **Kanban** (`apps/web/src/views/Kanban.tsx`): 3-column drag-drop board (TODO / IN_PROGRESS / DONE), project filter, completeTask with skill credit toasts
- **Node types**: DOMAIN, SKILL, PROJECT, TASK, PERSON, TAG, ROUTINE
- **TASK metadata**: `{ due, priority, estimatedHours, actualHours, status, timerStart, timeEntries[], creditedHours, completedAt }`
- **PROJECT metadata**: `{ startDate, dueDate, status, progress }` (defined in NODE.md but not yet used in UI)
- **ViewRenderer** in `App.tsx`: switch on ViewId, currently: dashboard | kanban | routines | skills | people | graph
- **Sidebar nav**: Dashboard, Kanban, Routines, Skills, People, Graph
- **No date-fns installed yet** (listed in XP.md as planned dependency)
- **No Google API integration** yet

### What's missing
- No Gantt view
- No Sprint concept
- No Calendar view
- No Google Calendar connector
- Tasks have `due` (string) but no `startDate`
- Projects have `startDate`/`dueDate` in spec but not used in UI

---

## UC-O2: Gantt Chart — Timeline View

### User Story
As CT, I view tasks and projects on a horizontal timeline so I can see overlaps, gaps, and whether things are on track.

### Interaction Flow
1. Navigate to Gantt view (new nav item)
2. Left column: task/project names grouped by project
3. Timeline area: horizontal bars from `startDate` → `due` (tasks) or `startDate` → `dueDate` (projects)
4. Bars colored by status: gray=TODO, blue=IN_PROGRESS, green=DONE, red=overdue
5. Today line: vertical red dashed line
6. Zoom: week / month / quarter toggle
7. Click bar → open NodeDetail
8. Drag bar edges → adjust dates via `updateNode` mutation
9. Project filter dropdown (same as Kanban)

### Data Model Changes
- **TASK metadata**: Add `startDate` field (optional, defaults to `createdAt` for display)
- **NodeDetail**: Add `startDate` input for TASK type
- **CreateNodeModal**: Add `startDate` field for TASK

### Files to Create/Modify

| File | Action |
|------|--------|
| `apps/web/src/views/Gantt.tsx` | **NEW** — Gantt chart view |
| `apps/web/src/App.tsx` | Add 'gantt' to ViewId, import Gantt, add case |
| `apps/web/src/components/Sidebar.tsx` | Add 'gantt' to ViewId + NAV_ITEMS |
| `apps/web/src/components/TopBar.tsx` | Add Gantt to tab bar |
| `apps/web/src/views/NodeDetail.tsx` | Add startDate field for TASK |
| `apps/web/src/components/CreateNodeModal.tsx` | Add startDate for TASK |

### Implementation Notes
- Pure CSS/SVG — no chart library. Tasks are positioned absolutely based on date math.
- Time scale: compute `daysBetween(viewStart, viewEnd)`, each day = `columnWidth` px
- Zoom levels: week (7 days visible), month (30), quarter (90)
- Bar position: `left = daysBetween(viewStart, task.startDate) * colWidth`, `width = daysBetween(task.startDate, task.due) * colWidth`
- Draggable edges: mousedown on left/right edge → track mousemove → updateNode on mouseup

### Acceptance Criteria
- [ ] Gantt view accessible from sidebar + top bar
- [ ] Tasks grouped under their project
- [ ] Bars positioned by startDate → due date
- [ ] Color-coded by status
- [ ] Today line visible
- [ ] Week/month/quarter zoom
- [ ] Click bar opens NodeDetail
- [ ] Drag edges to resize dates (mutation fires)
- [ ] Project filter works

---

## UC-O6: Calendar View

### User Story
As CT, I see my tasks and routines on a monthly/weekly calendar so I know what's due when and what I completed.

### Interaction Flow
1. Navigate to Calendar view (new nav item)
2. Month grid: days of the month, each cell shows task dots/chips for items due that day
3. Routine check-ins shown as small green dots
4. Click a day → expand to show all items
5. Click a task → open NodeDetail
6. Month navigation: prev/next arrows
7. Toggle: show tasks / routines / both
8. Color coding: tasks by status, routines by completion

### Files to Create/Modify

| File | Action |
|------|--------|
| `apps/web/src/views/Calendar.tsx` | **NEW** — Calendar view |
| `apps/web/src/App.tsx` | Add 'calendar' to ViewId, import Calendar, add case |
| `apps/web/src/components/Sidebar.tsx` | Add 'calendar' to ViewId + NAV_ITEMS |
| `apps/web/src/components/TopBar.tsx` | Add Calendar to tab bar |

### Implementation Notes
- Pure CSS grid (7 columns for days of week)
- Month computation: `new Date(year, month, 1).getDay()` for offset, loop 28-31 days
- Task placement: match `metadata.due` to calendar date
- Routine placement: use `metadata.history[]` array (index 0 = 30 days ago, index 29 = today) mapped to actual dates

### Acceptance Criteria
- [ ] Monthly calendar grid renders correctly
- [ ] Tasks appear on their due date
- [ ] Routine completions shown as dots
- [ ] Click task opens NodeDetail
- [ ] Month prev/next navigation
- [ ] Toggle tasks/routines visibility

---

## UC-O3: Sprint Planning

### User Story
As CT, I group tasks into time-boxed sprints so I can focus on a set of work and track velocity.

### Interaction Flow
1. From Kanban view, "Sprints" toggle switches between regular Kanban and Sprint mode
2. Create sprint: name, start date, end date, select tasks
3. Sprint board: Kanban but scoped to sprint tasks only
4. Sprint header: progress bar, days remaining, burndown stats
5. Sprint list: see past/current/future sprints
6. Complete sprint: moves undone tasks to backlog or next sprint

### Data Model
- Sprint is **virtual** — stored as `metadata.sprintId` on TASK nodes + a sprint registry in a config node or project metadata
- Simpler approach: `metadata.sprint` on each TASK = sprint name string (e.g., "Sprint 1"). Filter by string match. Sprint date range stored in PROJECT metadata `sprints[]` array.
- **PROJECT metadata addition**: `sprints: [{ name, startDate, endDate }]`
- **TASK metadata addition**: `sprint` (string, optional)

### Files to Create/Modify

| File | Action |
|------|--------|
| `apps/web/src/views/Kanban.tsx` | Add sprint mode toggle, sprint header, sprint filter |
| `apps/web/src/views/NodeDetail.tsx` | Add sprint field for TASK |
| `apps/web/src/components/CreateNodeModal.tsx` | Add sprint picker for TASK |

### Implementation Notes
- Sprint toggle in Kanban header: "Board" | "Sprint"
- Sprint mode: dropdown to pick sprint, shows only tasks with matching `metadata.sprint`
- Sprint creation: inline form or modal — name + dates, saves to project metadata
- Burndown: count tasks DONE vs total in sprint over time (approximate from completedAt dates)

### Acceptance Criteria
- [ ] Sprint toggle in Kanban view
- [ ] Create sprint with name + date range
- [ ] Assign tasks to sprint (from NodeDetail or Kanban)
- [ ] Sprint board filters to sprint tasks only
- [ ] Sprint progress header (X/Y done, Z days left)
- [ ] Past sprints viewable

---

## UC-GCal: Google Calendar Connector

### User Story
As CT, I sync my XP tasks (with due dates) and routines to Google Calendar so I see everything in one place, and calendar events can create/update XP tasks.

### Interaction Flow

#### Phase 1: One-way push (XP → GCal)
1. Settings/connect: OAuth2 flow to authorize XP to access Google Calendar
2. XP creates a dedicated "XP" calendar in user's GCal
3. On task create/update with a due date → upsert a GCal event (title, date, description with XP link)
4. On task complete → update GCal event (mark completed in description, change color)
5. On task delete → delete GCal event
6. Daily routines → recurring GCal events

#### Phase 2: Two-way sync (future, out of scope for now)
- GCal event changes → update XP task dates
- New GCal events → create XP tasks

### Architecture
```
Frontend                  Backend                    Google
────────                  ───────                    ──────
Settings page   →  POST /auth/google/init    →  OAuth2 consent
                ←  redirect with code        ←
                →  POST /auth/google/callback →  Exchange for tokens
                                              →  Store refresh_token (encrypted)

On mutation:
NodesService.create/update/delete
  → GCalSyncService.upsertEvent(node) / deleteEvent(node)
    → Google Calendar API (REST)
    → Store gcalEventId in node.metadata
```

### Backend Files

| File | Action |
|------|--------|
| `apps/api/src/gcal/gcal.module.ts` | **NEW** — NestJS module |
| `apps/api/src/gcal/gcal.service.ts` | **NEW** — Google Calendar API wrapper |
| `apps/api/src/gcal/gcal.controller.ts` | **NEW** — OAuth flow endpoints (REST, not GraphQL) |
| `apps/api/src/nodes/nodes.service.ts` | Call GCalSyncService on create/update/delete |
| `apps/api/src/app.module.ts` | Import GCalModule |

### Frontend Files

| File | Action |
|------|--------|
| `apps/web/src/views/Settings.tsx` | **NEW** — Settings page with Google Calendar connect button |
| `apps/web/src/App.tsx` | Add 'settings' to ViewId |
| `apps/web/src/components/Sidebar.tsx` | Add settings gear icon at bottom |

### Dependencies
- `googleapis` npm package (backend only) — Google Calendar API client
- Google Cloud Console: create OAuth2 credentials (client ID + secret)
- Environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

### Implementation Notes
- OAuth2: Use authorization code flow. Store refresh token in MongoDB (new `Settings` collection or user metadata).
- GCalSyncService: `upsertEvent(node)` — if node has `metadata.gcalEventId`, update; else create. Store returned eventId back to node.
- Calendar selection: Create "XP Tasks" calendar on first sync. Store calendarId in settings.
- Event mapping: title = node.title, date = metadata.due, description = `[${node.type}] ${node.description}\n\nXP: ${frontendUrl}/node/${node._id}`
- Routine mapping: daily routine → daily recurring event. Check-in → mark event as completed (custom property or color change).

### Acceptance Criteria
- [ ] OAuth2 flow connects Google account
- [ ] Settings page shows connection status
- [ ] Creating task with due date creates GCal event
- [ ] Updating task due date updates GCal event
- [ ] Completing task updates GCal event
- [ ] Deleting task removes GCal event
- [ ] Daily routines create recurring GCal events
- [ ] "XP Tasks" calendar created automatically

---

## Execution Order

1. **UC-O2: Gantt** — Highest visual impact, uses existing data (just needs startDate)
2. **UC-O6: Calendar** — Complements Gantt, pure frontend, no backend changes
3. **UC-O3: Sprint** — Adds metadata fields, enhances Kanban
4. **UC-GCal: Google Calendar** — Backend-heavy, needs OAuth setup, do last

## Dependencies to Install

```bash
# Frontend — date utilities
npm install date-fns -w web

# Backend — Google Calendar API
npm install googleapis -w api
```

---

## Verification Protocol

After each UC implementation:
1. **TypeScript check**: `npx tsc --noEmit -p apps/web/tsconfig.json`
2. **Visual check**: Navigate to the view in browser, verify rendering
3. **Interaction check**: Click, drag, filter — verify mutations fire and UI updates
4. **Commit + push** if passing
