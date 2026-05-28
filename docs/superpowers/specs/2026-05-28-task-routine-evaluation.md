# XP — Task & Routine Gap Audit + Next-Phase Plan

**Date:** 2026-05-28
**Scope:** Task and Routine node types only
**Use-case lens:** Personal life OS — routines anchor the day, tasks fill it; both must feel fast and frictionless (daily mixed workflow)
**Codebase state:** post-pull `99a0369`

---

## 1. What Is Working

### Task loop
- `completeTask` mutation triggers full XP propagation: TASK → PROJECT → DOMAIN via `mainParent` chain, and to linked SKILLs via `parents[]` — all in `PropagationService.onTaskCompleted()`
- Kanban drag to DONE calls `completeTask` (not just local state)
- Quick-complete button on NodeCard in Kanban
- NodeDetail saves all task fields: `due`, `priority`, `estimatedHours`, linked skills, `mainParent`
- Dashboard overdue computed from `metadata.due < today` (real)
- Dashboard stat cards computed from live data (no hardcoded strings)
- Sprint board mode: create sprints, assign tasks, burndown progress bar

### Routine loop
- Heatmap click on today's cell → `checkInRoutine` mutation
- Right-panel check-in button (toggle: check-in / undo)
- Timer on ROUTINE: `stopTimer` auto-triggers `checkInRoutine`
- Streak computed via backward date traversal from today
- Hours credited to linked SKILLs via `parents[]` — same engine as tasks
- `undoCheckInRoutine` correctly reverses hours from linked skills
- Legacy `checkInDates: string[]` migrated to `checkIns: [{date, hours}]` on read
- 30-day heatmap with sticky name column and sticky action column

### Shared mastery engine
- Hours-based tier system: unfamiliar → familiar (20h) → skilled (300h) → master (1000h) → world_class (10000h)
- Defined in `@xp/shared` — shared between API and frontend
- Skill tier recalculates on every `addHoursToSkill` call

---

## 2. Remaining Gaps

### Task gaps (ranked by daily-use impact)

| # | Gap | Impact | Root cause |
|---|-----|--------|------------|
| 1 | No `estimatedHours` + skill picker in create modal | **High** | `CreateNodeModal` is generic. `completeTask` uses `actualHours ?? estimatedHours ?? 0` — so new tasks credit 0h to skills |
| 2 | No live elapsed timer display | Medium | NodeDetail has start/stop buttons but no second-interval counter. No feedback loop while working |
| 3 | Dashboard "Tasks done" = all-time count, not this week | Medium | `weekDone = done.length` — counts every DONE task ever, not filtered by week |
| 4 | No inline "+ Add Task" at Kanban column bottom | Low | Spec calls for it; only global create exists |

### Routine gaps (ranked by daily-use impact)

| # | Gap | Impact | Root cause |
|---|-----|--------|------------|
| 1 | No cadence/target/group fields in create modal | **High** | New routines have no cadence → don't appear in cadence groups → `thisWeek/weekTarget` shows 0/7 forever |
| 2 | Weekly/monthly check-in UX ambiguous | Medium | Heatmap shows daily cells for all routines. Weekly routines ("run 3×/week") have no per-week indicator |
| 3 | `lastCheckInDate` vs `checkIns[]` inconsistency in Dashboard | Low | Dashboard uses UTC ISO slice; Routines uses local date math. Can diverge in UTC+7 timezone at midnight |

### Architecture notes

| Item | Severity |
|------|----------|
| `metadata as any` throughout frontend | Low — silent `undefined` bugs possible if DB shape changes |
| No URL routing (App.tsx uses useState) | Low — TECHNICAL_SPEC.md lists React Router v7 but it's not wired. No deep links. |

---

## 3. Next-Phase Build Order

### Phase 1 — Fix creation (both loops are broken at the source)

**1a. Task create: extend CreateNodeModal**
- Add `estimatedHours` number input
- Add skill multi-picker (SmartSearchInput filtered to SKILL type, adds to `parents[]`)
- This is the unblocking fix — without it, every new task perpetually credits 0h

**1b. Routine create: extend CreateNodeModal**
- Add `cadence` selector (daily / weekly / monthly)
- Add `target` text input ("30 min", "2h", "3x/week")
- Add `group` text input (optional grouping label)
- Without these, new routines are inert in the Routines view

### Phase 2 — Polish the daily interaction loop

**2a. Live elapsed timer in NodeDetail**
- `useEffect` with `setInterval(1000)` while `hasOpenTimer`
- Display `HH:MM:SS` derived from `timerEntries[open].start` to `Date.now()`
- Clear interval on stop or unmount

**2b. Dashboard "Tasks done this week"**
- Filter `done` tasks: `metadata.completedAt >= monday` where `monday = getMondayStart(localDateStr())`
- Rename label to "Done this week" to match the filtered count

**2c. Weekly/monthly routine indicator**
- On each routine row in the heatmap right panel, show `N×/week` badge for weekly cadence
- Count check-ins from Monday of current ISO week vs. parsed target frequency

### Phase 3 — Cleanup (low impact, batch together)

- Timezone fix: replace `new Date().toISOString().slice(0,10)` in Dashboard.tsx with `localDateStr()` helper
- Inline "+ Add Task" footer in Kanban column (TODO column only is sufficient)
- `lastCheckInDate` update in `undoCheckInRoutine` (already updated in `checkInRoutine`)

---

## 4. What Was Deliberately Excluded

The following are out of scope for Task/Routine focus:
- Obsidian sync (Phase 9) — no dependency on Task/Routine fixes
- Authentication (Phase 10)
- Google Calendar integration (`gcal/` module exists but not wired)
- Graph view, Gantt view, People view improvements
- URL routing — low daily impact for single-user personal OS
