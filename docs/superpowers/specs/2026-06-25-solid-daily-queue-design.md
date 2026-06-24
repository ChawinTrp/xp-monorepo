# Solid Daily Queue + Persistent Progress — Design

> Status: approved (design). Date: 2026-06-25.
> Related: `NODE.md` (§3.x metadata), `apps/web/src/lib/queue.ts`, `apps/web/src/mobile/MobileShell.tsx`, `apps/web/src/views/PlanMode.tsx`.

## Problem

The mobile Focus deck recomputes its queue live from node state on every load, and the "X / Y cleared" counter is **session-only React state** (`clearedIds`) that resets on refresh. Symptoms the user hits daily:

- Progress (e.g. `3/9`) resets to `0` on refresh.
- The deck's membership/order can shift between loads (it is re-derived, not fixed).
- There is no view of the day's plan on desktop at all.

The user wants a **solid queue for the day**: a fixed list of planned things whose per-item status changes in place (done / skipped) and whose progress **persists** across refreshes — shown as a **list on desktop** and the existing **swipe card deck on mobile**.

## Decisions (locked)

1. **Surface shape:** list on PC, swipe card deck on mobile, both backed by the same persistent day state. Counter persists.
2. **Unplanned days:** auto-snapshot the queue on first open and freeze it (later-created items are NOT added).
3. **Status storage:** denominator = frozen `DayPlan.orderedIds`; "done" derived from canonical node state; add one small `metadata.skips[]` field to TASK (mirrors the routine `skips` already shipped). Single source of truth.
4. **Skip semantics (sub-decision a):** in a frozen plan the old "Tomorrow" dismiss (`due = tomorrow`) no longer removes a card, so the deck's dismiss action becomes **"Skip"** → appends today to `metadata.skips`. Rescheduling a due date moves to NodeDetail.
5. **Progress definition (sub-decision b):** `progress = (done + skipped) / total`, done emphasized, skipped muted, so a day can reach `9/9`.
6. **Desktop surface (sub-decision c):** a new **"Today"** item in the desktop sidebar (not folded into Dashboard).

## Non-goals

- No DayPlan schema change; no API changes (everything rides existing `dayPlan`/`upsertDayPlan` + opaque `metadata`).
- No change to Win-the-Week / Skills XP / propagation — those keep reading canonical node state.
- No re-sync of items created after the day is frozen.
- No rich reschedule UI in the deck/list (due-date edits stay in NodeDetail).

## Data model

### The frozen DayPlan IS the queue
Already exists: `DayPlan { _id, date, orderedIds: string[] }`, keyed by **logical date** (5am boundary, `logicalDateStr()`), upserted via `UPSERT_DAY_PLAN`. `orderedIds` is the stable denominator (the "9").

### Auto-snapshot on first open
When the Today surface loads for `today = logicalDateStr()` and `dayPlan(today)` has resolved to `null` (query returned, not merely loading) **and** nodes are loaded:
1. `ids = buildQueue(nodes, { today }).map(e => e.node._id)` (the no-plan auto-order branch — unchanged; also already used by PlanMode).
2. `upsertDayPlan({ date: today, orderedIds: ids })`.

Guards:
- Fire **once** per session per date; never overwrite an existing plan (only when `dayPlan === null`).
- Skip if the snapshot would be empty (no eligible nodes) — write nothing, show empty state, retry next open.
- On API error: do not write; degrade to empty/cached.

### Task skip marker
Add `metadata.skips: ["YYYY-MM-DD"]` to TASK, identical shape and semantics to the routine `skips` already in `queue.ts` (`skipsOf`, `isRoutineSkippedOn`). Skipping a task appends today's logical date; it is a per-day status change, **not** a due-date move.

## Per-item status (derived, per plan-date `D`)

For each id in `orderedIds` resolved to an existing node:

| Node | done | skipped | pending |
|---|---|---|---|
| TASK | `status === 'DONE'` | `skips` includes `D` | otherwise |
| ROUTINE | checked-in on `D` (`isCheckedOn(meta, D)`) | `skips` includes `D` | otherwise |

`done` takes precedence over `skipped`. Ids whose node was deleted are dropped (and excluded from `total`).

## Shared hook: `useDayQueue()`

Single source feeding both surfaces. Location: `apps/web/src/lib/dayQueue.ts` (new), or co-located in `hooks.ts`.

Responsibilities:
- Read nodes (`useNodes`) + `dayPlan(today)`.
- Perform the auto-snapshot (above).
- Resolve `orderedIds` → `items: { node, status }[]` in plan order, dropping deleted ids.
- Derive counts: `total`, `doneCount`, `skippedCount`, `pendingCount`, `resolvedCount = done + skipped`.

Returns: `{ items, total, doneCount, skippedCount, pendingCount, resolvedCount, ready }`.

Mutations stay where they are (the components call `completeTask` / `checkInRoutine` / skip), but membership and counts come only from this hook's derived state.

## Mobile (swipe deck) changes — `MobileShell.tsx`

- `FocusView` consumes `useDayQueue()`. The **pending** items are the swipe rotation; finished/skipped items leave the rotation.
- Counter = `resolvedCount / total` (derived, persistent) — **remove `clearedIds`** session state and the `total`/`cleared` union logic.
- A thin optimistic layer may keep the just-acted card animating out until the refetch confirms; the persistent counts always come from node state.
- Dismiss action: routine path unchanged (`skips`); **task path switches from `due = tomorrow` to appending `skips`**. Button label/icon: "Skip" for both types (drop the "Tomorrow" label). Undo removes today's `skips` entry (task) / reopens (existing).
- "You're all caught up" shows when `pendingCount === 0`. Replay/undo behavior preserved.

## Desktop list — `views/Today.tsx` (new)

- New nav item **"Today"** in `Sidebar.tsx`; wire `view` + `ViewRenderer` in `App.tsx`.
- Header: date + progress `resolved / total` (ring or bar, accent), with `N done · M skipped · K left` breakdown.
- Body: list of all items in plan order. Each row: TypeBadge + icon, title, breadcrumb, status badge, and Done / Skip / Undo actions. Done rows muted with check; skipped rows muted with skip glyph; pending rows full-strength.
- Styling: Tier-2 token-swap per `DESIGN.md` — solid list surfaces (not heavy glass), node colors paired with icons.

## Files touched

| File | Change |
|---|---|
| `apps/web/src/lib/queue.ts` | Task skip helpers (`taskSkippedOn`); `itemStatus(node, day)`; day-summary helper. |
| `apps/web/src/lib/dayQueue.ts` (new) | `useDayQueue()` hook + auto-snapshot. |
| `apps/web/src/mobile/MobileShell.tsx` | Deck consumes `useDayQueue`; derived counter; task skip → `skips`; "Tomorrow" → "Skip". |
| `apps/web/src/views/Today.tsx` (new) | Desktop list surface. |
| `apps/web/src/App.tsx`, `components/Sidebar.tsx` | New "Today" nav (desktop). |
| `NODE.md` | Document TASK `metadata.skips`. |
| API / `packages/shared` | None. |

## Edge cases

- **No plan + no eligible nodes:** write nothing; "Nothing planned today" empty state; snapshot retried next open.
- **Deleted node in `orderedIds`:** filtered from `items` and `total`.
- **API down:** no snapshot write; degrade to cached/empty (do not hang — mirror the existing `dayPlanReady`/error guard).
- **5am rollover:** date key changes → new day → fresh snapshot. Yesterday's plan is untouched/immutable.
- **Task completed but in plan:** stays visible as **done** (the point of a solid queue).
- **Frozen task whose due date is in the future:** still counts in the plan; not auto-skipped (skip is explicit via `skips`). Note: this supersedes the recent `isActionable` future-due exclusion for the *planned* path — to be reconciled during planning (the frozen plan, not due-date, governs membership).

## Testing / verification

No test runner in `apps/web`. Verify the pure derivation (`itemStatus`, day summary, auto-snapshot id list) by importing the actual modules in the dev-server browser context via `preview_eval` (as done for the `buildQueue` fix), asserting:
- frozen denominator stable across simulated refreshes,
- done/skipped/pending derivation per type,
- `resolved/total` counts,
- auto-snapshot fires only when no plan exists.
Then `tsc --noEmit` + `vite build`, plus a browser smoke test of both surfaces.

## Open follow-up (not in this spec)

- Reconcile `isActionable` future-due task exclusion vs. frozen-plan membership (the frozen plan should govern; due-date no longer removes a planned task).
