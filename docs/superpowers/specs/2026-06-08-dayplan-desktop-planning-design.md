# DayPlan & Desktop Plan Mode — Design

**Date:** 2026-06-08
**Status:** Approved design, pre-implementation. **Sequenced AFTER** `2026-06-08-mobile-focus-flow-v2`.
**Area:** new `apps/api/src/dayplan/` module · `apps/web/src/views/Kanban.tsx` (plan mode) · `apps/web/src/lib/queue.ts` (extracted) · `apps/web/src/mobile/MobileShell.tsx` (DayPlan-aware queue)

## Problem

The Mobile Focus v2 queue is auto-derived (due-date membership + time-of-day ordering). That is a usable *baseline*, but the real intent is to **manually curate and order** the day's queue the night before, on desktop. There is currently no view for this and no data model that can express a hand-picked order (Kanban only drags between status columns; there is no intra-column order, and routines never appear in Kanban at all).

## Decisions (from brainstorming)

- **Hybrid:** auto **suggests**, manual **overrides**. Mobile derives a baseline; the desktop plan, when present, takes precedence.
- **UI:** Kanban gains a third mode (`board | sprint | plan`). In plan mode the **Done** column is replaced by a reorderable **Tomorrow** column.
- **Pre-seed:** entering plan mode pre-fills Tomorrow with the auto-suggestion; user prunes/reorders/adds.
- **Routines** are shown and manually ordered **only in plan mode**, interleaved with tasks so Tomorrow is the literal unified queue.
- **Storage:** a dedicated **DayPlan record per date** holding an ordered array of node ids (tasks + routines).
- **Unplanned items on mobile:** the plan shows first, then auto-**append** any due/overdue task or not-done routine not already in the plan, tagged "unplanned" (safety net — nothing silently disappears).
- **Save:** auto-save on every change (`upsertDayPlan` per edit).

## Design

### 1. Data model — `DayPlan` collection

A new Mongoose collection, **not** a `Node` type (it is operational state, not a knowledge node):

```ts
DayPlan {
  _id: ObjectId
  date: string        // "YYYY-MM-DD", unique index
  orderedIds: string[] // node ids (TASK + ROUTINE) in manual queue order
  createdAt, updatedAt
}
```

`orderedIds` may contain ids that later complete or get deleted; readers filter against live nodes and tolerate missing ids.

### 2. Backend — new `dayplan` module (parallel to `nodes`, `gcal`)

Files: `apps/api/src/dayplan/{dayplan.module.ts, dayplan.schema.ts, dayplan.service.ts, dayplan.resolver.ts, dto/upsert-dayplan.input.ts}` plus a GraphQL `DayPlan` object type.

- **Query** `dayPlan(date: String!): DayPlan` — returns the record for that date or `null`.
- **Mutation** `upsertDayPlan(input: { date: String!, orderedIds: [String!]! }): DayPlan` — upsert by `date` (replace `orderedIds`).

The backend is **dumb storage**. It does NOT compute suggestions or ordering — that logic is the shared `buildQueue` run on the client. This keeps a single source of truth for ordering rules.

Register `DayPlanModule` in `AppModule`.

### 3. Shared refactor — `apps/web/src/lib/queue.ts`

Extract `buildQueue` (and its helpers `isDueToday`, the time-of-day constants) out of `MobileShell.tsx` into `apps/web/src/lib/queue.ts`, **parameterized by a reference date**:

```ts
export function buildQueue(
  nodes: XPNode[],
  opts: { today: string; snoozedToBack?: string[]; dayPlan?: { orderedIds: string[] } | null }
): { node: XPNode; planned: boolean }[]
```

- The Focus v2 ordering becomes the **no-plan path** and the **suggestion generator**.
- Mobile imports it for reading; Kanban plan mode imports it to generate the pre-seed for tomorrow.
- Return entries carry a `planned` flag so mobile can tag appended "unplanned" cards.

> This refactor is owned by THIS spec (not Mobile v2). Mobile v2 ships `buildQueue` inside `MobileShell.tsx`; this spec lifts it to `lib/queue.ts` and the mobile view imports it.

### 4. Desktop — Kanban `plan` mode

Add `plan` to the mode toggle (`board | sprint | plan`). When `mode === 'plan'`:

- **Columns:** `To Do · In Progress · Tomorrow` (Done hidden; `Tomorrow` replaces it).
- **Tomorrow column source:** `dayPlan(tomorrow)`. If none exists, generate `buildQueue(nodes, { today: tomorrow })` → its node ids become the seed, persisted immediately via `upsertDayPlan`.
- **Reorder:** intra-column drag within Tomorrow updates `orderedIds` (new capability — track an over-index during `dragOver`). Auto-save each change.
- **Add:** dragging a TODO/In-Progress task card into Tomorrow inserts its id into `orderedIds` at the drop position. It does **not** modify the task's `status` or `due` — plan membership is expressed solely by the DayPlan.
- **Routines:** shown only in plan mode. Pre-seed includes not-done daily routines (time-of-day order). Removing a routine from Tomorrow moves it to a **"Not planned" tray** at the bottom of the Tomorrow column; dragging from the tray re-adds it.
- **Remove a task:** dragging a task out of Tomorrow back to TODO/In-Progress removes its id from `orderedIds`.
- `tomorrow = localDateStr(today + 1 day)`.

### 5. Mobile — DayPlan-aware queue (extends Focus v2)

- Add a `DAY_PLAN` query for `today`; fetch alongside `GET_NODES`.
- `buildQueue(nodes, { today, dayPlan })`:
  - **Plan exists:** order the still-incomplete planned nodes by `orderedIds` (drop completed/checked-in/missing), then **append** any due/overdue task or not-done routine not already in the plan, each tagged `planned: false`.
  - **No plan:** the Focus v2 baseline ordering (all `planned: true` semantics — no "unplanned" tag).
- The Focus card shows a subtle "unplanned" marker for appended items.
- Snooze/Dismiss/Finish/Undo and the counter from Focus v2 are unchanged; they operate on whatever ordered list `buildQueue` returns.

## Out of scope (this iteration)

- Planning arbitrary dates (only "tomorrow" from the desktop button; mobile reads "today"). A date picker can come later.
- Editing the plan from mobile (desktop-only authoring; mobile is read + execute).
- Reconciling Kanban's existing `JSON.stringify(metadata)` writes (lines 150/166) — a separate latent bug.
- Persistent per-routine ordering outside a DayPlan.

## Affected files

- **Create:** `apps/api/src/dayplan/*` (module, schema, service, resolver, dto), `apps/web/src/lib/queue.ts`.
- **Modify:** `apps/api/src/app.module.ts` (register module), `apps/api/src/schema.gql` (auto-gen), `apps/web/src/lib/graphql.ts` (`DAY_PLAN`, `UPSERT_DAY_PLAN`), `apps/web/src/views/Kanban.tsx` (plan mode), `apps/web/src/mobile/MobileShell.tsx` (import shared `buildQueue`, fetch + pass `dayPlan`, "unplanned" tag).

## Risks / notes

- **Ordering logic must live in exactly one place** (`lib/queue.ts`). Backend must not re-implement it, or desktop suggestion and mobile read will drift.
- **Intra-column DnD reordering** is new for this codebase (current Kanban is cross-column status only). Budget for the over-index tracking and drop-position math.
- **Stale ids in `orderedIds`** (completed/deleted nodes) must be filtered by readers, not assumed valid.
- **Coupling with Mobile v2:** v2 must land first; this spec then moves `buildQueue` to `lib/queue.ts` and switches the mobile view to the DayPlan-aware signature.
- **DayPlan write format** is its own typed input (`orderedIds: [String!]!`) — it does NOT go through node `metadata`, so it sidesteps the metadata-scalar concerns entirely.
