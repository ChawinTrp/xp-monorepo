# Kanban / Routine Workflow — Gap Analysis (2026-06-10)

Audit of the task/routine workflow across Kanban, Plan mode, mobile Focus/Stats,
and Dashboard, focused on: done-task archival, weekly/monthly cadence flow, and
mobile discipline visibility.

## Filled in this pass

### G1 — Done column had no archive (Kanban.tsx)
Every completed task ever stayed in the Done column. **Fix:** completions older
than 7 days collapse behind a `Show archive (N)` footer toggle; column count
shows the working set. Client-side only (filters on `completedDate`, legacy
`completedAt` fallback).

### G2 — Queue ignored weekly/monthly cadence (lib/queue.ts, PlanMode.tsx)
`autoOrder` / `isActionable` / the Plan-mode tray used `isCheckedOn(meta, today)`
(exact-day), so a weekly routine checked Monday re-appeared Tue–Sun in the Focus
queue and was seeded into every day's plan; monthly routines nagged daily.
**Fix:** new `isRoutineSatisfied(meta, day)` — daily = checked that day; weekly =
any check-in in that day's Sunday-start week; monthly = any check-in in that
month. Used by the auto queue, plan-read actionability, and the Not-planned tray.

### G3 — Mobile Stats used Monday-start week + UTC completedAt (MobileShell.tsx)
Contradicted the canonical Sunday-start / local-`completedDate` convention
(see `@xp/shared`). **Fix:** aligned to Sunday-start with `completedDate`
(legacy `completedAt` fallback), same as Dashboard.

### G4 — Discipline loop was desktop-only (MobileShell.tsx)
Win-the-Week (day pips, week target, win streak) lived only on the Dashboard;
mobile Stats showed raw counts with no "what do I need to do to win" signal.
**Fix:** Win-the-Week strip on mobile Stats reading the same `weekProgress`
query (pips per day, `wonDays/weekTarget`, days-left hint, week-win streak).

### G5 — Dashboard regressions of fixed bug classes (Dashboard.tsx)
- Overdue used `new Date(due) < new Date()` (UTC-midnight drift: due-today tasks
  flagged overdue after 07:00 in UTC+7). Now uses `lib/queue.isOverdue`
  (date-string compare).
- "Routines today" used `lastCheckInDate`, which goes stale after
  undo-check-in. Now uses the `checkIns` array via `isCheckedOn`.

## Identified, deferred (candidates for next passes)

- **True backend archive / pagination** — `GET_NODES` still fetches every node
  including all DONE tasks; the 7-day archive is a render filter, not a data
  boundary. Needs view-specific queries + server-side pagination
  (UAT_READINESS_PLAN Phase 3).
- **Weekly-review flow** — no end-of-week surface (review wins, roll incomplete
  tasks forward, plan next week). Plan mode only plans tomorrow; a "Week" plan
  target would complete the weekly loop.
- **Monthly flow** — monthly routines now schedule correctly, but there is no
  monthly retrospective/summary view (Calendar shows chips, not outcomes).
- **Streak semantics for weekly/monthly routines** — `streak` is incremented per
  check-in and the lapsed test is daily-based (Routines.tsx); a weekly routine's
  streak should mean consecutive *weeks*. Backend change (propagation service).
- **Mobile plan editing** — mobile reads the day plan but can't reorder it;
  deliberate for now (desktop plans, mobile executes).
- **Dismiss-to-tomorrow vs. plan** — mobile "dismiss" bumps `due` to tomorrow
  but does not add the task to tomorrow's DayPlan; it will arrive as an
  unplanned append rather than a planned card.
