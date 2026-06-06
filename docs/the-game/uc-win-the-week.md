# UC: Win the Day → Win the Week

> **Status:** Shipped (Phases 1–6 + `weekWinStreak`). Phase 7 Settings UI still open.
> **Author:** CT · Sonnet · 2026-05-28 · revised 2026-06-06
> **Depends on:** routine `checkIns: [{date, hours}]`, task `completedDate`

> **2026-06-06 — Date logic centralised.** The week/date math previously lived
> in 5 copies (propagation service, Dashboard, Routines, seed, shared) and had
> drifted: heatmap + dashboard + seed were still Monday-start, mobile task
> completion fell back to a UTC date, and `getWeekProgress` keyed "today" off
> UTC. All week math now has a single source of truth in `@xp/shared`
> (`localDateStr`, `parseLocalDate`, `getWeekStart` [Sunday, local],
> `getWeekDates`). Web files mirror these with a pointer comment (the codebase
> deliberately avoids importing `@xp/shared` into Vite — see `NodeDetail.tsx`).

## Philosophy

Perfection is the enemy of consistency. You will not win every day — life
happens. The goal is to **win the *majority* of days**, and let that majority
carry the week.

> Win a day to win the week. You don't need 7/7. You need 4/7.

A forgiving, momentum-oriented metric: miss a day (or three) and the week is
still winnable. This rewards showing up *most* of the time rather than
punishing the first slip — the opposite of a fragile daily streak.

---

## Definitions

### Won Day
A day is **won** when you clear a **compound threshold** across your daily
commitments — both must be met (AND):

| Condition | Default | Meaning |
|---|---|---|
| Routines | ≥ 3 of daily-cadence routines checked in | the "show up" bar |
| Tasks | ≥ 1 task completed that day | the "move forward" bar |

```
dayWon(date) =
  (dailyRoutinesCheckedIn(date) >= routineThreshold)   // e.g. 3
  AND
  (tasksCompletedOn(date)       >= taskThreshold)       // e.g. 1
```

- **Routines counted:** only `cadence === 'daily'` routines. Weekly/monthly
  routines don't gate a *daily* win.
- **Tasks counted:** TASK nodes whose completion date (local) equals `date`.
- Both thresholds are **configurable** (see Config below). The example
  "3/4 routines + 1 task" is the default starting point.

### Won Week
A **week runs Sunday → Saturday**. A week is **won** when you win the
majority of its days:

```
weekWon(weekStart) = wonDays(weekStart .. weekStart+6) >= 4   // 4 of 7
```

`weekTarget = 4` is configurable but 4/7 is the headline rule.

---

## Week-Start Reconciliation (decided: Sunday everywhere)

The codebase currently computes "this week" as **Monday-start**
(`getMondayStart`, and the heatmap groups weeks by splitting on Monday,
`d.getDay() === 1`). This feature requires **Sunday-start**, and we are
**unifying the whole app to Sunday** so there is exactly one week definition.

| Location | Today | Change |
|---|---|---|
| `propagation.service.ts` `getMondayStart()` | Mon | rename → `getWeekStart()`, Sun-based |
| routine `thisWeek` computation (check-in / undo) | Mon | use `getWeekStart()` |
| seed `mondayStart()` / `thisWeekFromCheckIns()` | Mon | Sun-based |
| `Routines.tsx` heatmap week split (`getDay() === 1`) | Mon | split on `getDay() === 0` (Sun) |

> Net effect: `thisWeek` counters and the heatmap week-grouping shift to
> Sunday, matching the new Win-the-Week tracker. No data migration needed —
> it's all derived from dates.

---

## Data Model

**Everything is derived — no new persistent per-day "won" flag is required.**
Wins are computed on read from data we already store:

- Routine completion → `metadata.checkIns: [{date, hours}]`
- Task completion → `metadata.completedAt` (⚠️ see TZ note)

```
wonDays(weekStart):
  days = [weekStart .. weekStart+6]            // Sun..Sat, local YYYY-MM-DD
  for each d in days:
    r = count(routines where cadence='daily' AND checkIns has date d)
    t = count(tasks where localDate(completedAt) == d)
    won[d] = (r >= routineThreshold) AND (t >= taskThreshold)
  return count(won == true)
```

### ⚠️ Task completion timezone
`onTaskCompleted` currently sets `metadata.completedAt = new Date().toISOString()`
(**UTC**). Routines already moved to **local** dates (`localDateStr`). For
day-wins to line up with the user's real day, task completion must compare on
the **local** date too. Add `metadata.completedDate = localDateStr()`
alongside the ISO `completedAt`, and key day-wins off `completedDate`. (Same
class of bug we fixed for routine check-ins.)

### Config
Single-user app → start with defaults in `@xp/shared`, expose a Settings UI later.

```ts
// @xp/shared
export const WIN_RULES = {
  routineThreshold: 3,   // daily routines checked in
  taskThreshold: 1,      // tasks completed
  weekTarget: 4,         // days needed to win the week (of 7)
  weekStartsOn: 0,       // 0 = Sunday
};
```

> Open question: should `routineThreshold` be **absolute** (3) or **relative**
> (`ceil(dailyRoutineCount * 0.75)`)? Relative auto-scales as you add
> routines; absolute is predictable. Recommend relative with an absolute cap.

---

## API Surface

New read-only resolver (no mutations — wins are derived):

```graphql
type DayWin {
  date: String!            # YYYY-MM-DD (local)
  won: Boolean!
  routinesCheckedIn: Int!
  routineTarget: Int!
  tasksCompleted: Int!
  taskTarget: Int!
}

type WeekProgress {
  weekStart: String!       # Sunday, YYYY-MM-DD
  days: [DayWin!]!         # 7 entries Sun..Sat
  wonDays: Int!
  weekTarget: Int!         # 4
  weekWon: Boolean!
  weekWinStreak: Int!      # consecutive won weeks ending at the current week
}

# weekStart optional → defaults to current week's Sunday
query { weekProgress(weekStart: String): WeekProgress! }
```

`weekWinStreak` is computed from the **current** week regardless of the
`weekStart` argument: it counts back through consecutive won weeks. The
in-progress current week counts only once it is already won, so a week still
underway shows the streak of prior completed weeks rather than zeroing it.

---

## UI Plan

### 1. Dashboard widget — "Win the Week" (primary surface)
Seven pips Sun→Sat, today highlighted; counter + verdict.

```
WIN THE WEEK                         ●●●○●○·   4 / 7  ✓ Week won
Sun Mon Tue Wed Thu Fri Sat          (○ = lost, ● = won, · = future)
```

- Turns celebratory once `wonDays >= 4` ("Week won 🎉 — bank the rest").
- Before 4: shows "need N more" and how many days remain.
- Each pip tooltip: "Tue — 3/4 routines, 1 task ✓".

### 2. Routines page banner
Same 7-pip strip at the top of the Routines view, so the daily heatmap and
the weekly verdict sit together.

### 3. Day detail (stretch)
Tapping a pip shows the day's breakdown: which routines/tasks counted, and
what was missing to win it.

### 4. Streak visualization — fire & ice
Make a routine's *state* legible at a glance through animated treatment, not
just a number:

- **🔥 Fire (hot streak):** routines on a high streak get an animated flame
  treatment that intensifies with streak length. Tiered, e.g.:
  - `streak ≥ 7` → small ember glow on the streak badge
  - `streak ≥ 14` → animated flame (reuse the existing `timer-pulse`-style
    keyframe approach in `index.css`)
  - `streak ≥ 30` → bigger blaze + warm accent on the row
- **🧊 Ice (snoozed / lapsed):** routines you've stopped doing get a frosted,
  desaturated "iced over" treatment so they read as dormant rather than
  failed — gentle nudge, not punishment. A routine is "snoozed" when its
  last check-in is older than its cadence allows (e.g. a daily routine with
  `lastCheckInDate` > 2 days ago).
- Respect `prefers-reduced-motion`: fall back to static glow/frost (no
  animation) when the user has reduced-motion enabled.
- Surfaces: the Routines heatmap left-column name + the streak badge in both
  the Routines view and `NodeDetail`.

> Implementation note: reuse the keyframe pattern already added for the timer
> (`.timer-pulse` in `apps/web/src/index.css`); add `.streak-fire` /
> `.streak-ice` classes gated by streak/lapsed thresholds.

---

## Phasing

| Phase | Scope | Outcome | Status |
|---|---|---|---|
| **1** | Sunday-start unification (`getWeekStart`, heatmap split, seed) | One week definition app-wide | ✅ (centralised in `@xp/shared` 2026-06-06) |
| **2** | `completedDate` local-date on task completion | Day-wins align to the user's real day | ✅ (mobile fixed 2026-06-06) |
| **3** | `WIN_RULES` in `@xp/shared` + `dayWon`/`weekProgress` derivation | Computation correct & tested | ✅ |
| **4** | `weekProgress` resolver + Dashboard widget | Feature visible | ✅ |
| **5** | Routines-page banner + pip tooltips | Daily ↔ weekly in one place | ✅ |
| **6** | Streak visualization — fire (hot streak) & ice (snoozed) | Routine state legible at a glance | ◑ Routines only; 2 tiers (7/30). NodeDetail + 14-tier still open |
| **7a** | `weekWinStreak` (consecutive won weeks) badge | Streak-of-weeks momentum | ✅ 2026-06-06 — derived in `getWeekProgress`, 🔥 badge on Dashboard widget |
| **7b** (stretch) | Settings UI for `WIN_RULES` thresholds | Configurable | ❌ Open (defaults fine for single user) |

---

## Acceptance Criteria
- [x] Weeks run Sunday→Saturday everywhere (`thisWeek`, heatmap, win tracker)
- [x] A day is won iff `dailyRoutinesCheckedIn ≥ routineThreshold` **and** `tasksCompleted ≥ taskThreshold`
- [x] A week is won iff `wonDays ≥ 4`
- [x] Day-wins use **local** dates for both routine check-ins and task completion (incl. mobile)
- [x] `weekProgress` returns 7 days Sun→Sat with per-day breakdown
- [x] Dashboard widget shows pips, count (`4/7`), and "week won" state
- [x] Wins are fully derived — no manual "won" flag, no double source of truth
- [x] Thresholds read from `WIN_RULES` (single config), not hardcoded at call sites
- [x] **No date/week math is redefined outside `@xp/shared`** (web mirrors with a pointer comment)
- [x] `weekWinStreak` = consecutive won weeks; surfaced as a 🔥 badge (≥2 weeks)

---

## Open Decisions
1. **Routine threshold absolute (3) vs relative (75% of daily routines)?** — recommend relative w/ cap.
2. **Day-win AND vs weighted points?** — starting with AND (matches "3 routines + 1 task"); points is a later mode.
3. **Should weekly/monthly routines contribute to a daily win?** — current plan: no, only daily-cadence.
4. **Retroactive task credit:** if a task's `completedAt` is back-dated, does it count for that earlier day? — plan keys off completion date, so yes.
