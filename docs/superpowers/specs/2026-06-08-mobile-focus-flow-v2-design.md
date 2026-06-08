# Mobile Focus Flow v2 — Design

**Date:** 2026-06-08
**Status:** Approved design, pre-implementation
**Area:** `apps/web/src/mobile/MobileShell.tsx` (Focus view) + `apps/api` (new `reopenTask` mutation)

## Problem

The mobile card-swipe Focus flow is confusing in practice:

1. **Snooze doesn't stick.** Swipe-left "Snooze" is purely client-side and ephemeral — it removes the card and re-appends it to the *back of today's queue* (`extra` array), so the card reappears in the same session and is forgotten on reload. Users expect it to go away.
2. **No way to defer to tomorrow.** There is no persistent "not today" action.
3. **Opaque queue membership.** A TASK enters today's queue under a hidden rule (`overdue OR high OR medium priority`). Low-priority and undated tasks silently never appear; membership is unpredictable.
4. **Ordering feels arbitrary.** The fixed interleave doesn't map to a clear mental model.
5. **Misleading counter.** `X/Y = idx+1 / queue.length`. Because Snooze appends to `extra`, `queue.length` grows by 1 while `idx` also advances — both numbers climb (1/10 → 2/11).
6. **No undo.** Finish and (new) Dismiss are persisted; a mis-tap is unrecoverable.

Routine time-sensitivity ("if miss is miss") was discussed and **explicitly descoped** for this iteration — routines keep current behavior.

## Decisions (from brainstorming)

- **Defer model:** two distinct "not now" actions — **Snooze** (later today) and **Dismiss** (tomorrow).
- **Task membership:** **due-date driven**. Planning happens as a manual night-before review on PC (setting due dates).
- **Ordering:** **time-of-day rhythm, refined** — keep the day-flow shape, feed it due-date inputs.
- **Dismiss trigger:** **button only** (no new swipe gesture).
- **Undo:** a header **Undo last action** button covering all four reversible actions, including a new backend `reopenTask`.

## Design

### 1. Task queue membership

A **TASK** is in today's queue iff it has a `due` and `due <= today` (due today or overdue).

- Priority no longer affects *membership* — only *order*.
- Undated tasks never appear on mobile; the user assigns due dates during the night-before PC review.
- **ROUTINES are unchanged**: appear if not checked-in today.

This replaces the current `over || priority === 'high' || priority === 'medium'` filter in `useQueue`.

### 2. Ordering — time-of-day rhythm (refined)

Same day-flow shape as today, fed by due-date task inputs:

```
morning routines + anytime routines
overdue tasks            (priority high → low)
due-today high tasks
afternoon routines
due-today medium tasks
evening routines
due-today low tasks
night routines
```

Routines sort within their bucket by streak (as today). Tasks sort within their group by priority, overdue group before due-today group.

### 3. Three card actions

| Action | Trigger | Effect | Persisted? |
|--------|---------|--------|-----------|
| **Finish** | swipe right / button | `completeTask` (task) / `checkInRoutine` (routine) | ✅ |
| **Snooze** (later today) | swipe left / button | move card to back of the **remaining** queue | ❌ session-only |
| **Dismiss** (tomorrow) | **button only** | `updateNode` → set `metadata.due = tomorrow` (drops it from today) | ✅ |

**Dismiss persistence:** `metadata` is a single JSON field the client already holds in full (`NODE_FIELDS`). `updateNode` does a full-replace of `metadata`, so Dismiss sends `{ _id, metadata: { ...node.metadata, due: <tomorrow> } }`. No new dismiss mutation needed.

- `tomorrow` = `localDateStr(today + 1 day)` to stay consistent with the existing local-date helpers (avoid UTC drift).
- Dismiss only applies to TASKS (routines have no `due`). The Dismiss button is hidden/disabled on routine cards.

### 4. Undo last action

A header **Undo** button (top-left), enabled only when a reversible last action exists. It tracks a single-entry "last action" record `{ kind, node, prevState }` and reverses:

| Last action | Reversal |
|-------------|----------|
| Snooze | restore card to its prior queue position (client-only) |
| Dismiss | `updateNode` restoring previous `metadata.due` (captured before the mutation) |
| Finish — routine | `undoCheckInRoutine(id)` (exists) |
| Finish — task | **new `reopenTask(id)` mutation** (see §6) |

After a successful undo, the undo record clears (single-level undo only).

### 5. Counter fix

The denominator becomes a **stable count of distinct cards** for today, keyed by unique node id — not the length of the `baseQueue + extra` concatenation.

- Snooze reorders within the distinct set; it must not increase the total.
- Display: `cleared / total` (cards finished or dismissed vs. distinct cards planned today), or equivalently position over distinct-remaining. The chosen denominator never inflates on Snooze.
- Implementation note: replace the `snoozedIds`/`extra` recycle machinery with an explicit ordered list of ids where Snooze moves the current id to the end of the remaining slice, and Finish/Dismiss remove it. `total` derives from the initial distinct set (plus any genuinely new cards from a refetch), independent of snooze operations.

### 6. Backend: `reopenTask` mutation

Mirror of `undoCheckInRoutine`, reversing `onTaskCompleted`:

- Guard: node exists, `type === 'TASK'`, `status === 'DONE'` (else no-op return).
- Reset task: `status = 'TODO'`, clear `metadata.completedAt`, `metadata.completedDate`, `metadata.creditedHours`; recompute `progress` (recalc from children or 0 for leaf).
- Reverse credited hours: for each SKILL credited in `onTaskCompleted` (mainParent walk + `parents[]` skills), call `subtractHoursFromSkill` and recalc ancestor DOMAIN progress — same traversal `onTaskCompleted` used, in reverse.
- Recalc progress up the mainParent chain (TASK/PROJECT/DOMAIN) as `onTaskCompleted` does.
- Return all affected nodes.

Resolver: `@Mutation(() => [Node]) reopenTask(@Args('id', { type: () => ID }) id)`.
Web: add `REOPEN_TASK` gql + wire into the undo handler.

### 7. Layout

```
┌─────────────────────────────────────┐
│ Tue Jun 8            3/10  [↺ Undo]  │  ← header: date L; counter + Undo R
│              • • ● • •               │  ← progress dots moved to top
│                                      │
│            ┌──────────┐              │
│            │   CARD   │              │
│            └──────────┘              │
│                                      │
│   [Snooze]  [Dismiss]  [Finish]      │  ← single row of 3 buttons
└─────────────────────────────────────┘
```

- **Progress dots** move to the top, directly under the header.
- **Undo** sits in the header top-right, immediately next to the `X/Y` counter number; disabled (dimmed) when nothing to undo.
- **Action row** is a single horizontal row of three equal buttons: `Snooze · Dismiss · Finish`. On routine cards, Dismiss is hidden/disabled (routines have no `due`), leaving Snooze · Finish.
- Swipe still maps: right = Finish, left = Snooze. Dismiss remains button-only.

## Out of scope (this iteration)

- Routine missed-window handling / strict-vs-flexible routines.
- Multi-level undo (single-level only).
- Desktop night-before planning UX changes (the review already happens via existing due-date editing).
- Undated high-priority task nudges on mobile.

## Affected files

- `apps/web/src/mobile/MobileShell.tsx` — `useQueue` membership + ordering, `FocusView` action/undo/counter logic, action row + header Undo, Dismiss handler.
- `apps/web/src/lib/graphql.ts` — add `REOPEN_TASK`; reuse `UPDATE_NODE` for Dismiss.
- `apps/api/src/nodes/propagation.service.ts` — `reopenTask` method.
- `apps/api/src/nodes/nodes.resolver.ts` — `reopenTask` mutation.

## Risks / notes

- **`updateNode` full-replace of `metadata`:** Dismiss and Undo-Dismiss must always resend the complete metadata object. Capture `node.metadata` at action time to avoid races with refetches.
- **`reopenTask` must exactly mirror `onTaskCompleted`'s traversal** or skill hours/domain progress will drift. Reverse both the mainParent walk and the `parents[]` skill crediting.
- Snooze remaining session-only is intentional; on reload the card simply reappears in normal order (no longer feels like a broken dismiss now that Dismiss exists).
