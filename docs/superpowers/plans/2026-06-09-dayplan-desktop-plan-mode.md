# DayPlan & Desktop Plan Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user hand-curate and order tomorrow's queue on desktop (a new Kanban "Plan" mode backed by a per-date `DayPlan` record), and have mobile Focus read that plan with an auto-append safety net.

**Architecture:** A new dumb-storage `DayPlan` Mongo collection (`{ date, orderedIds[] }`) with `dayPlan` query + `upsertDayPlan` mutation. All ordering/suggestion logic stays client-side in a single shared `apps/web/src/lib/queue.ts` (lifted out of `MobileShell.tsx`), parameterized by a reference date and returning `{ node, planned }[]`. Kanban gains a `plan` mode (a self-contained `PlanMode.tsx` component) whose Tomorrow column is reorderable and auto-saves. Mobile imports the same `buildQueue` and reads `dayPlan(today)`.

**Tech Stack:** NestJS 11 + GraphQL Code-First (Apollo Server 5.4) + Mongoose/MongoDB Atlas (api); React 18 + Vite + Apollo Client (web); HTML5 drag-and-drop.

**Testing reality (read before starting):** The web workspace has **no test runner** (only vite/eslint) and the api jest suite is already RED (DI/Mongoose harness failures pre-date this work). Do **NOT** add a test framework — that is out of scope and would balloon the change. Verification for every task is **build/typecheck-based** (`npm run build -w api`, `npm run build -w web`) plus the manual smoke checks listed per task. `nest build` does **not** bootstrap Mongo, so `src/schema.gql` will **not** auto-regenerate — schema additions are applied **by hand** (the file is alphabetically sorted because `sortSchema: true`).

**Task order & coupling:** 1 (backend) → 2 (extract `queue.ts`, behavior-identical refactor) → 3 (graphql docs) → 4 (mobile reads plan) → 5 (Kanban plan mode). Tasks 4 and 5 both depend on 2 and 3. Each task leaves both builds green.

---

## File Structure

**Create (api):**
- `apps/api/src/dayplan/dayplan.schema.ts` — Mongoose schema + GraphQL `DayPlan` object type.
- `apps/api/src/dayplan/dto/upsert-dayplan.input.ts` — `UpsertDayPlanInput`.
- `apps/api/src/dayplan/dayplan.service.ts` — `findByDate`, `upsert` (dumb storage).
- `apps/api/src/dayplan/dayplan.resolver.ts` — `dayPlan` query, `upsertDayPlan` mutation.
- `apps/api/src/dayplan/dayplan.module.ts` — wires schema/service/resolver.

**Create (web):**
- `apps/web/src/lib/queue.ts` — shared queue logic (lifted from `MobileShell.tsx`).
- `apps/web/src/views/PlanMode.tsx` — the desktop Plan-mode UI (keeps `Kanban.tsx` small).

**Modify:**
- `apps/api/src/app.module.ts` — register `DayPlanModule`.
- `apps/api/src/schema.gql` — hand-add `DayPlan` type, `UpsertDayPlanInput`, `dayPlan` query, `upsertDayPlan` mutation (alphabetical).
- `apps/web/src/lib/graphql.ts` — add `DAY_PLAN`, `UPSERT_DAY_PLAN`.
- `apps/web/src/mobile/MobileShell.tsx` — import shared `buildQueue`/helpers; fetch + pass `dayPlan(today)`; "unplanned" marker.
- `apps/web/src/views/Kanban.tsx` — add `plan` to the mode toggle; render `<PlanMode>` when active.

---

## Task 1: Backend `dayplan` module

**Files:**
- Create: `apps/api/src/dayplan/dayplan.schema.ts`
- Create: `apps/api/src/dayplan/dto/upsert-dayplan.input.ts`
- Create: `apps/api/src/dayplan/dayplan.service.ts`
- Create: `apps/api/src/dayplan/dayplan.resolver.ts`
- Create: `apps/api/src/dayplan/dayplan.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/schema.gql`

This module is created whole (every file is needed to compile). It mirrors the existing `nodes`/`gcal` module conventions exactly (see `node.entity.ts`, `nodes.service.ts`, `gcal.module.ts`).

- [ ] **Step 1: Create the schema + GraphQL object type**

Create `apps/api/src/dayplan/dayplan.schema.ts`:

```ts
import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DayPlanDocument = DayPlan & Document;

@Schema({ timestamps: true })
@ObjectType()
export class DayPlan {
  @Field(() => ID)
  _id!: string;

  // "YYYY-MM-DD" — one plan record per date.
  @Prop({ required: true, unique: true, index: true })
  @Field(() => String)
  date!: string;

  // Node ids (TASK + ROUTINE) in manual queue order. May contain ids that
  // later complete or get deleted; readers filter against live nodes.
  @Prop({ type: [String], default: [] })
  @Field(() => [String])
  orderedIds!: string[];

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  updatedAt?: Date;
}

export const DayPlanSchema = SchemaFactory.createForClass(DayPlan);
```

- [ ] **Step 2: Create the upsert input DTO**

Create `apps/api/src/dayplan/dto/upsert-dayplan.input.ts`:

```ts
import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class UpsertDayPlanInput {
  @Field(() => String)
  date!: string;

  @Field(() => [String])
  orderedIds!: string[];
}
```

- [ ] **Step 3: Create the service (dumb storage)**

Create `apps/api/src/dayplan/dayplan.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DayPlan, DayPlanDocument } from './dayplan.schema';
import { UpsertDayPlanInput } from './dto/upsert-dayplan.input';

@Injectable()
export class DayPlanService {
  constructor(
    @InjectModel(DayPlan.name) private dayPlanModel: Model<DayPlanDocument>,
  ) {}

  async findByDate(date: string): Promise<DayPlan | null> {
    return this.dayPlanModel.findOne({ date }).exec();
  }

  async upsert(input: UpsertDayPlanInput): Promise<DayPlan> {
    return this.dayPlanModel
      .findOneAndUpdate(
        { date: input.date },
        { $set: { orderedIds: input.orderedIds } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec() as Promise<DayPlan>;
  }
}
```

- [ ] **Step 4: Create the resolver**

Create `apps/api/src/dayplan/dayplan.resolver.ts`:

```ts
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { DayPlan } from './dayplan.schema';
import { DayPlanService } from './dayplan.service';
import { UpsertDayPlanInput } from './dto/upsert-dayplan.input';

@Resolver(() => DayPlan)
export class DayPlanResolver {
  constructor(private readonly dayPlanService: DayPlanService) {}

  @Query(() => DayPlan, { name: 'dayPlan', nullable: true })
  dayPlan(@Args('date', { type: () => String }) date: string) {
    return this.dayPlanService.findByDate(date);
  }

  @Mutation(() => DayPlan)
  upsertDayPlan(@Args('input') input: UpsertDayPlanInput) {
    return this.dayPlanService.upsert(input);
  }
}
```

- [ ] **Step 5: Create the module**

Create `apps/api/src/dayplan/dayplan.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DayPlan, DayPlanSchema } from './dayplan.schema';
import { DayPlanService } from './dayplan.service';
import { DayPlanResolver } from './dayplan.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DayPlan.name, schema: DayPlanSchema }]),
  ],
  providers: [DayPlanService, DayPlanResolver],
})
export class DayPlanModule {}
```

- [ ] **Step 6: Register the module in `AppModule`**

In `apps/api/src/app.module.ts`, add the import near the other module imports (after the `GCalModule` import line):

```ts
import { GCalModule } from './gcal/gcal.module';
import { DayPlanModule } from './dayplan/dayplan.module';
```

And add `DayPlanModule` to the `imports` array, right after `GCalModule`:

```ts
    NodesModule,
    GCalModule,
    DayPlanModule,
```

- [ ] **Step 7: Hand-add the GraphQL SDL to `schema.gql`**

`nest build` does NOT regenerate this file without a Mongo bootstrap, so add it manually. The file is alphabetically sorted (`sortSchema: true`) — insert each piece in sorted position.

7a. Add the input. After the `input UpdateNodeInput { ... }` block, add:

```graphql
input UpsertDayPlanInput {
  date: String!
  orderedIds: [String!]!
}
```

7b. Add the object type. Immediately **before** `type DayWin {` (because `DayPlan` < `DayWin`), add:

```graphql
type DayPlan {
  _id: ID!
  createdAt: DateTime
  date: String!
  orderedIds: [String!]!
  updatedAt: DateTime
}
```

7c. In `type Mutation { ... }`, add this line in sorted position — **after** `updateNode(...)` (last line before the closing brace):

```graphql
  upsertDayPlan(input: UpsertDayPlanInput!): DayPlan!
```

7d. In `type Query { ... }`, add this line **first** (before `node(id: String!): Node!`, since `dayPlan` < `node`):

```graphql
  dayPlan(date: String!): DayPlan
```

- [ ] **Step 8: Verify the api builds**

Run: `npm run build -w api`
Expected: build succeeds (TypeScript compiles; no Mongo needed). If `findOneAndUpdate(...).exec()` produces a type error, the `as Promise<DayPlan>` cast in Step 3 resolves it (Mongoose's `findOneAndUpdate` returns `... | null`).

- [ ] **Step 9: Manual smoke check (optional, needs Mongo + running api)**

Start the api (`npm run start:dev -w api`) and in the GraphQL playground (`http://localhost:3000/graphql`) run:

```graphql
mutation { upsertDayPlan(input: { date: "2026-06-10", orderedIds: ["a","b"] }) { date orderedIds } }
query { dayPlan(date: "2026-06-10") { date orderedIds } }
```

Expected: mutation returns `{ date: "2026-06-10", orderedIds: ["a","b"] }`; the query returns the same. A second `upsertDayPlan` for the same date replaces `orderedIds` (no duplicate record).

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/dayplan apps/api/src/app.module.ts apps/api/src/schema.gql
git commit -m "feat(api): DayPlan collection + dayPlan query/upsertDayPlan mutation"
```

---

## Task 2: Extract shared `buildQueue` into `lib/queue.ts` (behavior-identical refactor)

**Files:**
- Create: `apps/web/src/lib/queue.ts`
- Modify: `apps/web/src/mobile/MobileShell.tsx`

This lifts `buildQueue` + its helpers out of `MobileShell.tsx`, parameterizes them by a reference date, and changes the return type to `{ node, planned }[]`. Mobile behavior must stay **identical** (no `dayPlan` passed yet ⇒ all `planned: true`, empty snooze ⇒ same order). The mobile view keeps consuming a plain `XPNode[]` by mapping `entries.map(e => e.node)`.

- [ ] **Step 1: Create `apps/web/src/lib/queue.ts`**

Create the file with this exact content:

```ts
import type { XPNode } from './types';

// ── Local-date string (YYYY-MM-DD). Drift-safe vs. UTC.
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── localDateStr of `base` shifted by `days` (e.g. tomorrow = addDaysStr(new Date(), 1)).
export function addDaysStr(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

// ── Routine check-ins
type CheckIn = { date: string; hours: number };
export function checkInsOf(meta: any): CheckIn[] {
  if (Array.isArray(meta?.checkIns)) return meta.checkIns;
  if (Array.isArray(meta?.checkInDates))
    return (meta.checkInDates as string[]).map((d) => ({ date: d, hours: 0 }));
  return [];
}
export function isCheckedOn(meta: any, day: string): boolean {
  return checkInsOf(meta).some((c) => c.date === day);
}

// ── Task due helpers. Date-string compare avoids `new Date(due) < new Date()`
//    mis-flagging a due-today task as overdue in non-UTC locales.
export function isDueOnOrBefore(node: XPNode, day: string): boolean {
  const due = (node.metadata as any)?.due as string | undefined;
  if (!due) return false;
  return due.slice(0, 10) <= day;
}
export function isOverdue(node: XPNode, day: string): boolean {
  const due = (node.metadata as any)?.due as string | undefined;
  return !!due && due.slice(0, 10) < day;
}

// ── Time-of-day ordering for routines
export const TOD_ORDER: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
};

export interface QueueEntry {
  node: XPNode;
  planned: boolean;
}
export interface BuildQueueOpts {
  today: string;
  snoozedToBack?: string[];
  dayPlan?: { orderedIds: string[] } | null;
}

// Auto baseline: not-checked routines + due tasks, in time-of-day rhythm order.
function autoOrder(nodes: XPNode[], today: string): XPNode[] {
  const routines = nodes
    .filter((n) => n.type === 'ROUTINE' && !isCheckedOn(n.metadata, today))
    .sort((a, b) => {
      const todA = (a.metadata as any)?.timeOfDay ?? 'anytime';
      const todB = (b.metadata as any)?.timeOfDay ?? 'anytime';
      const da = (TOD_ORDER[todA] ?? 99) - (TOD_ORDER[todB] ?? 99);
      return da !== 0
        ? da
        : ((b.metadata as any)?.streak ?? 0) - ((a.metadata as any)?.streak ?? 0);
    });

  // Membership is due-date driven; priority only affects order.
  const tasks = nodes.filter(
    (n) => n.type === 'TASK' && n.status !== 'DONE' && isDueOnOrBefore(n, today),
  );
  const prio: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const byPriority = (a: XPNode, b: XPNode) =>
    (prio[(a.metadata as any)?.priority] ?? 9) - (prio[(b.metadata as any)?.priority] ?? 9);

  const morningR = routines.filter((r) => (r.metadata as any)?.timeOfDay === 'morning');
  const afternoonR = routines.filter((r) => (r.metadata as any)?.timeOfDay === 'afternoon');
  const eveningR = routines.filter((r) => (r.metadata as any)?.timeOfDay === 'evening');
  const nightR = routines.filter((r) => (r.metadata as any)?.timeOfDay === 'night');
  const anytimeR = routines.filter((r) => !TOD_ORDER[(r.metadata as any)?.timeOfDay]);

  const overdueTasks = tasks.filter((t) => isOverdue(t, today)).sort(byPriority);
  const todayTasks = tasks.filter((t) => !isOverdue(t, today)).sort(byPriority);
  const highToday = todayTasks.filter((t) => (t.metadata as any)?.priority === 'high');
  const medToday = todayTasks.filter((t) => (t.metadata as any)?.priority === 'medium');
  const lowToday = todayTasks.filter(
    (t) =>
      (t.metadata as any)?.priority !== 'high' && (t.metadata as any)?.priority !== 'medium',
  );

  return [
    ...morningR,
    ...anytimeR,
    ...overdueTasks,
    ...highToday,
    ...afternoonR,
    ...medToday,
    ...eveningR,
    ...lowToday,
    ...nightR,
  ];
}

// Still actionable when reading a plan: incomplete task / not-checked-in routine.
function isActionable(node: XPNode, today: string): boolean {
  if (node.type === 'TASK') return node.status !== 'DONE';
  if (node.type === 'ROUTINE') return !isCheckedOn(node.metadata, today);
  return false;
}

// Snoozed-this-session cards move to the back, preserving relative order.
function applySnooze(entries: QueueEntry[], snoozedToBack: string[]): QueueEntry[] {
  if (snoozedToBack.length === 0) return entries;
  const back = new Set(snoozedToBack);
  const front = entries.filter((e) => !back.has(e.node._id));
  const tail = entries.filter((e) => back.has(e.node._id));
  return [...front, ...tail];
}

// ── Pure queue builder. With no dayPlan it is the Focus v2 baseline (all
//    planned:true). With a dayPlan it orders planned-and-still-actionable nodes
//    first, then appends any eligible card not in the plan (planned:false safety net).
export function buildQueue(nodes: XPNode[], opts: BuildQueueOpts): QueueEntry[] {
  const { today, snoozedToBack = [], dayPlan = null } = opts;
  const auto = autoOrder(nodes, today);

  if (!dayPlan) {
    return applySnooze(
      auto.map((node) => ({ node, planned: true })),
      snoozedToBack,
    );
  }

  const byId = new Map(nodes.map((n) => [n._id, n]));
  const inPlan = new Set(dayPlan.orderedIds);

  const planned: QueueEntry[] = dayPlan.orderedIds
    .map((id) => byId.get(id))
    .filter((n): n is XPNode => !!n && isActionable(n, today))
    .map((node) => ({ node, planned: true }));

  const appended: QueueEntry[] = auto
    .filter((n) => !inPlan.has(n._id))
    .map((node) => ({ node, planned: false }));

  return applySnooze([...planned, ...appended], snoozedToBack);
}
```

- [ ] **Step 2: Replace MobileShell's imports + remove the moved helpers**

In `apps/web/src/mobile/MobileShell.tsx`, change the graphql import block (lines 5-8) to also import from the new module. Replace:

```ts
import {
  COMPLETE_TASK, CHECK_IN_ROUTINE, START_TIMER, STOP_TIMER, GET_NODES,
  UPDATE_NODE, REOPEN_TASK, UNDO_CHECK_IN_ROUTINE,
} from '../lib/graphql';
import type { XPNode } from '../lib/types';
import CreateNodeModal from '../components/CreateNodeModal';
```

with:

```ts
import {
  COMPLETE_TASK, CHECK_IN_ROUTINE, START_TIMER, STOP_TIMER, GET_NODES,
  UPDATE_NODE, REOPEN_TASK, UNDO_CHECK_IN_ROUTINE,
} from '../lib/graphql';
import type { XPNode } from '../lib/types';
import {
  buildQueue, isOverdue, isCheckedOn, localDateStr, addDaysStr,
  type QueueEntry,
} from '../lib/queue';
import CreateNodeModal from '../components/CreateNodeModal';
```

- [ ] **Step 3: Delete the now-duplicated helper/date block**

Delete the entire block from the `// ── Date helpers (mirrors Routines.tsx)` comment through the end of `isOverdue` (current lines 12-39), and replace it with just the `TODAY` / `tomorrowStr` definitions that the file still needs:

Replace:

```ts
// ── Date helpers (mirrors Routines.tsx)
function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const TODAY = localDateStr();
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}

type CheckIn = { date: string; hours: number };
function checkInsOf(meta: any): CheckIn[] {
  if (Array.isArray(meta?.checkIns)) return meta.checkIns;
  if (Array.isArray(meta?.checkInDates)) return (meta.checkInDates as string[]).map(d => ({ date: d, hours: 0 }));
  return [];
}
function isCheckedToday(meta: any) { return checkInsOf(meta).some(c => c.date === TODAY); }
function isOverdue(node: XPNode) {
  const due = (node.metadata as any)?.due as string | undefined;
  // Date-string compare (consistent with isDueToday): overdue = strictly before
  // today. `new Date(due) < new Date()` would mis-flag a due-today task as
  // overdue for most of the day in non-UTC locales (UTC-midnight drift).
  return !!due && due.slice(0, 10) < TODAY;
}
```

with:

```ts
// ── Today / tomorrow (date helpers now live in ../lib/queue)
const TODAY = localDateStr();
function tomorrowStr(): string {
  return addDaysStr(new Date(), 1);
}
```

- [ ] **Step 4: Delete the moved `TOD_ORDER` constant**

The `TOD_GLYPH` / `TOD_LABEL` constants stay (used by `FocusCard`), but `TOD_ORDER` moved to `queue.ts`. Delete this line (current line 47):

```ts
const TOD_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2, night: 3 };
```

(Leave the `TOD_GLYPH` and `TOD_LABEL` lines directly below it untouched.)

- [ ] **Step 5: Delete the moved `isDueToday` + `buildQueue` + old `useQueue`**

Delete the block from the `// ── A task counts for "today"...` comment (current line 61) through the end of the old `useQueue` (current line 122) — i.e. remove `isDueToday`, the local `buildQueue`, and the old `useQueue`. Replace that whole block with the new `useQueue`:

```ts
function useQueue(nodes: XPNode[], snoozedToBack: string[]): QueueEntry[] {
  return useMemo(
    () => buildQueue(nodes, { today: TODAY, snoozedToBack }),
    [nodes, snoozedToBack],
  );
}
```

- [ ] **Step 6: Map entries → nodes in `FocusView` (keeps the rest of FocusView unchanged)**

In `FocusView`, replace:

```ts
  const queue = useQueue(nodes, snoozedToBack);
```

with:

```ts
  const entries = useQueue(nodes, snoozedToBack);
  const queue = useMemo(() => entries.map((e) => e.node), [entries]);
```

(All existing `queue.*` usages below — `findIndex`, `map`, `find`, `queue[idx]`, `queue[idx + 1]` — keep working because `queue` is still `XPNode[]`.)

- [ ] **Step 7: Fix the two remaining call sites of the moved helpers**

7a. In `FocusCard`, the meta row calls `isOverdue(node)`. It now needs the day arg. Replace:

```tsx
            {isOverdue(node) ? 'OVERDUE' : (m.due ? `Due ${m.due}` : '—')}
```

with:

```tsx
            {isOverdue(node, TODAY) ? 'OVERDUE' : (m.due ? `Due ${m.due}` : '—')}
```

7b. In `StatsView`, `isCheckedToday(r.metadata)` is now `isCheckedOn(r.metadata, TODAY)`. Replace:

```ts
  const doneToday       = dailyRoutines.filter(r => isCheckedToday(r.metadata)).length;
```

with:

```ts
  const doneToday       = dailyRoutines.filter(r => isCheckedOn(r.metadata, TODAY)).length;
```

- [ ] **Step 8: Verify the web builds**

Run: `npm run build -w web`
Expected: build succeeds. If TypeScript reports `isCheckedToday`/`isDueToday`/`buildQueue`/`TOD_ORDER` as undefined, a usage was missed in Steps 3-7 — grep the file for those names and fix.

- [ ] **Step 9: Manual smoke check (needs running web + api)**

Open the app on a narrow viewport (mobile shell). The Focus queue order, counter, snooze, dismiss, finish and undo must behave **exactly as before** — this task changes no behavior.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/queue.ts apps/web/src/mobile/MobileShell.tsx
git commit -m "refactor(web): lift buildQueue into lib/queue.ts (date-parameterized, planned flag)"
```

---

## Task 3: GraphQL documents for DayPlan (web)

**Files:**
- Modify: `apps/web/src/lib/graphql.ts`

- [ ] **Step 1: Add the query + mutation documents**

In `apps/web/src/lib/graphql.ts`, after the `REOPEN_TASK` block (and before `WEEK_PROGRESS`), add:

```ts
export const DAY_PLAN = gql`
  query DayPlan($date: String!) {
    dayPlan(date: $date) {
      _id
      date
      orderedIds
    }
  }
`;

export const UPSERT_DAY_PLAN = gql`
  mutation UpsertDayPlan($input: UpsertDayPlanInput!) {
    upsertDayPlan(input: $input) {
      _id
      date
      orderedIds
    }
  }
`;
```

- [ ] **Step 2: Verify the web builds**

Run: `npm run build -w web`
Expected: build succeeds (these are just `gql` template strings; nothing consumes them yet).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/graphql.ts
git commit -m "feat(web): DAY_PLAN query + UPSERT_DAY_PLAN mutation documents"
```

---

## Task 4: Mobile reads `dayPlan(today)` with unplanned marker

**Files:**
- Modify: `apps/web/src/mobile/MobileShell.tsx`

The mobile Focus view fetches `dayPlan(today)`, threads it into `buildQueue`, and shows a subtle "unplanned" marker on appended (`planned: false`) cards. All Focus v2 action/undo/counter logic is untouched.

- [ ] **Step 1: Import `useQuery` and `DAY_PLAN`**

In `apps/web/src/mobile/MobileShell.tsx`, the React-Apollo import currently is:

```ts
import { useMutation } from '@apollo/client/react';
```

Replace with:

```ts
import { useMutation, useQuery } from '@apollo/client/react';
```

And add `DAY_PLAN` to the graphql import list (the `from '../lib/graphql'` block):

```ts
import {
  COMPLETE_TASK, CHECK_IN_ROUTINE, START_TIMER, STOP_TIMER, GET_NODES,
  UPDATE_NODE, REOPEN_TASK, UNDO_CHECK_IN_ROUTINE, DAY_PLAN,
} from '../lib/graphql';
```

- [ ] **Step 2: Add a `dayPlan` prop to `FocusViewProps` and thread it into the queue**

In the `FocusViewProps` interface, add the field:

```ts
interface FocusViewProps {
  runningId: string | null;
  elapsed: number;
  onStartTimer: (id: string) => void;
  onPauseTimer: () => void;
  onFinish: (node: XPNode) => void;
  onDismiss: (node: XPNode) => void;
  onUndoFinish: (node: XPNode) => void;
  onUndoDismiss: (node: XPNode, prevDue?: string) => void;
  dayPlan: { orderedIds: string[] } | null;
}
```

Update the `FocusView` destructure to accept it:

```ts
function FocusView({ runningId, elapsed, onStartTimer, onPauseTimer, onFinish, onDismiss, onUndoFinish, onUndoDismiss, dayPlan }: FocusViewProps) {
```

- [ ] **Step 3: Pass `dayPlan` to `useQueue` and derive `unplannedIds`**

Change the `useQueue` signature to take `dayPlan`. Replace the `useQueue` helper (added in Task 2 Step 5) with:

```ts
function useQueue(nodes: XPNode[], snoozedToBack: string[], dayPlan: { orderedIds: string[] } | null): QueueEntry[] {
  return useMemo(
    () => buildQueue(nodes, { today: TODAY, snoozedToBack, dayPlan }),
    [nodes, snoozedToBack, dayPlan],
  );
}
```

Then in `FocusView`, replace the entries/queue lines (from Task 2 Step 6):

```ts
  const entries = useQueue(nodes, snoozedToBack);
  const queue = useMemo(() => entries.map((e) => e.node), [entries]);
```

with:

```ts
  const entries = useQueue(nodes, snoozedToBack, dayPlan);
  const queue = useMemo(() => entries.map((e) => e.node), [entries]);
  const unplannedIds = useMemo(
    () => new Set(entries.filter((e) => !e.planned).map((e) => e.node._id)),
    [entries],
  );
```

- [ ] **Step 4: Pass the unplanned flag into `FocusCard`**

In `FocusView`'s render, the `<FocusCard ... />` call currently passes `breadcrumbStr={crumbStr}`. Add an `unplanned` prop:

```tsx
        <FocusCard
          node={node}
          runningId={runningId}
          elapsed={elapsed}
          dragDx={dragDx}
          dragging={dragging}
          onStartTimer={() => onStartTimer(node._id)}
          onPauseTimer={onPauseTimer}
          breadcrumbStr={crumbStr}
          unplanned={unplannedIds.has(node._id)}
        />
```

- [ ] **Step 5: Render the marker in `FocusCard`**

Add `unplanned` to `FocusCardProps`:

```ts
interface FocusCardProps {
  node: XPNode;
  runningId: string | null;
  elapsed: number;
  dragDx: number;
  dragging: boolean;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  breadcrumbStr: string;
  unplanned: boolean;
}
```

Update the destructure:

```ts
function FocusCard({ node, runningId, elapsed, dragDx, dragging, onStartTimer, onPauseTimer, breadcrumbStr, unplanned }: FocusCardProps) {
```

Then render a subtle chip next to the kind chip. In the `topMeta` row, replace:

```tsx
      {/* top meta row */}
      <div style={S.topMeta}>
        <span style={{ ...S.kindChip, background: chipBg, color: cardFg }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: cardFg }} />
          {isRoutine ? 'ROUTINE' : 'TASK'}
        </span>
```

with:

```tsx
      {/* top meta row */}
      <div style={S.topMeta}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...S.kindChip, background: chipBg, color: cardFg }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: cardFg }} />
            {isRoutine ? 'ROUTINE' : 'TASK'}
          </span>
          {unplanned && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
              padding: '3px 7px', borderRadius: 999,
              background: 'rgba(255,255,255,0.28)', color: ink,
              textTransform: 'uppercase',
            }}>+ Unplanned</span>
          )}
        </span>
```

(The original `kindChip` span is now nested inside the new wrapper; the closing `</span>` for `topMeta`'s right side stays as-is.)

- [ ] **Step 6: Fetch `dayPlan(today)` in `MobileShell` and pass it down**

In the `MobileShell` component body, after the `const { nodes } = useNodes();` line, add the query:

```ts
  const { data: dayPlanData } = useQuery<{ dayPlan: { orderedIds: string[] } | null }>(
    DAY_PLAN,
    { variables: { date: TODAY } },
  );
  const dayPlan = dayPlanData?.dayPlan ?? null;
```

Then pass it into `<FocusView>` (in the `tab === 'today'` branch):

```tsx
          <FocusView
            runningId={runningId}
            elapsed={elapsed}
            onStartTimer={handleStartTimer}
            onPauseTimer={handlePauseTimer}
            onFinish={handleFinish}
            onDismiss={handleDismiss}
            onUndoFinish={handleUndoFinish}
            onUndoDismiss={handleUndoDismiss}
            dayPlan={dayPlan}
          />
```

- [ ] **Step 7: Verify the web builds**

Run: `npm run build -w web`
Expected: build succeeds.

- [ ] **Step 8: Manual smoke check (needs running web + api with a saved plan)**

1. With **no** `DayPlan` for today: mobile Focus order is the baseline (Task 2 behavior), no "Unplanned" chips.
2. After saving a plan for today (via Task 5 desktop, or the playground `upsertDayPlan`): planned cards appear first in the saved order; any due/overdue task or not-done routine missing from the plan appears **after**, each showing the "+ Unplanned" chip. Completing a planned card removes it; a still-due card never silently disappears.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/mobile/MobileShell.tsx
git commit -m "feat(web): mobile Focus reads dayPlan(today) with unplanned-card safety net"
```

---

## Task 5: Desktop Kanban `plan` mode

**Files:**
- Create: `apps/web/src/views/PlanMode.tsx`
- Modify: `apps/web/src/views/Kanban.tsx`

Plan mode lives in its own component to keep `Kanban.tsx` focused. Columns are **To Do · In Progress · Tomorrow**. Tomorrow is sourced from `dayPlan(tomorrow)` (pre-seeded + persisted from `buildQueue` on first entry), is intra-column reorderable, accepts task/routine drops, and removed routines fall into a "Not planned" tray. Every change auto-saves via `upsertDayPlan`.

- [ ] **Step 1: Create `apps/web/src/views/PlanMode.tsx`**

Create the file with this exact content:

```tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import NodeCard from '../components/NodeCard';
import { Icons } from '../components/ui';
import { DAY_PLAN, UPSERT_DAY_PLAN } from '../lib/graphql';
import { buildQueue, isCheckedOn, addDaysStr } from '../lib/queue';
import type { XPNode } from '../lib/types';

interface DayPlanData {
  dayPlan: { _id: string; date: string; orderedIds: string[] } | null;
}

type DragFrom = 'TODO' | 'IN_PROGRESS' | 'plan' | 'tray';

const TOD_GLYPH: Record<string, string> = {
  morning: '☀', afternoon: '◐', evening: '◑', night: '☾',
};

export default function PlanMode({ onOpen }: { onOpen: (id: string) => void }) {
  const { nodes, byId, byType, breadcrumb } = useNodes();
  const tomorrow = useMemo(() => addDaysStr(new Date(), 1), []);

  const { data, loading } = useQuery<DayPlanData>(DAY_PLAN, { variables: { date: tomorrow } });
  const [upsertDayPlan] = useMutation(UPSERT_DAY_PLAN, {
    refetchQueries: [{ query: DAY_PLAN, variables: { date: tomorrow } }],
  });

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [drag, setDrag] = useState<{ id: string; from: DragFrom } | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<'TODO' | 'IN_PROGRESS' | 'TOMORROW' | null>(null);
  const seeded = useRef(false);

  // Seed once on entry: load existing plan, else generate from buildQueue + persist.
  useEffect(() => {
    if (loading || seeded.current) return;
    seeded.current = true;
    const existing = data?.dayPlan?.orderedIds;
    if (existing && existing.length > 0) {
      setOrderedIds(existing);
    } else {
      const seed = buildQueue(nodes, { today: tomorrow }).map((e) => e.node._id);
      setOrderedIds(seed);
      upsertDayPlan({ variables: { input: { date: tomorrow, orderedIds: seed } } });
    }
  }, [loading, data, nodes, tomorrow, upsertDayPlan]);

  const persist = (ids: string[]) => {
    upsertDayPlan({ variables: { input: { date: tomorrow, orderedIds: ids } } });
  };

  const placeInPlan = (id: string, at: number) => {
    setOrderedIds((prev) => {
      const without = prev.filter((x) => x !== id);
      const clamped = Math.max(0, Math.min(at, without.length));
      const next = [...without.slice(0, clamped), id, ...without.slice(clamped)];
      persist(next);
      return next;
    });
  };
  const removeFromPlan = (id: string) => {
    setOrderedIds((prev) => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter((x) => x !== id);
      persist(next);
      return next;
    });
  };

  // Live, ordered plan items (drop completed tasks / deleted ids).
  const planItems = useMemo(
    () =>
      orderedIds
        .map((id) => byId[id])
        .filter((n): n is XPNode => !!n && (n.type !== 'TASK' || n.status !== 'DONE')),
    [orderedIds, byId],
  );
  const planSet = useMemo(() => new Set(planItems.map((n) => n._id)), [planItems]);

  const todoTasks = byType('TASK').filter(
    (t) => (t.status ?? 'TODO') === 'TODO' && !planSet.has(t._id),
  );
  const inProgTasks = byType('TASK').filter(
    (t) => t.status === 'IN_PROGRESS' && !planSet.has(t._id),
  );
  // Routines not yet planned → tray (none are checked-in on a future date).
  const trayRoutines = byType('ROUTINE').filter(
    (r) => !isCheckedOn(r.metadata, tomorrow) && !planSet.has(r._id),
  );

  const onItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientY - r.top > r.height / 2;
    setOverIdx(after ? index + 1 : index);
    setOverCol('TOMORROW');
  };
  const dropOnTomorrow = () => {
    if (drag) placeInPlan(drag.id, overIdx ?? planItems.length);
    setDrag(null); setOverIdx(null); setOverCol(null);
  };
  const dropOnStatusCol = (col: 'TODO' | 'IN_PROGRESS') => {
    // Per spec: dragging a plan item back to a status column removes it from the
    // plan and does NOT change the node's status.
    if (drag && drag.from === 'plan') removeFromPlan(drag.id);
    setDrag(null); setOverIdx(null); setOverCol(null);
    void col;
  };

  const colShell = (isOver: boolean): React.CSSProperties => ({
    background: 'var(--mantle)',
    border: `1px ${isOver ? 'dashed' : 'solid'} ${isOver ? 'var(--accent)' : 'var(--surface1)'}`,
  });

  const renderStatusCol = (
    key: 'TODO' | 'IN_PROGRESS',
    label: string,
    color: string,
    tasks: XPNode[],
  ) => (
    <div
      onDragOver={(e) => { e.preventDefault(); setOverCol(key); }}
      onDragLeave={() => setOverCol((c) => (c === key ? null : c))}
      onDrop={() => dropOnStatusCol(key)}
      className="flex flex-col overflow-hidden rounded-[10px] transition-all duration-200"
      style={colShell(overCol === key)}
    >
      <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: '1px solid var(--surface1)' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="font-semibold uppercase" style={{ fontSize: 13, letterSpacing: 0.5 }}>{label}</span>
        <span className="mono text-ctp-overlay1" style={{ fontSize: 11 }}>{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {tasks.map((t) => (
          <NodeCard
            key={t._id}
            node={t}
            onOpen={onOpen}
            breadcrumb={breadcrumb(t._id).map((c) => c.title).join(' / ')}
            draggable
            dragging={drag?.id === t._id}
            onDragStart={() => setDrag({ id: t._id, from: key })}
            onDragEnd={() => { setDrag(null); setOverIdx(null); setOverCol(null); }}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center text-ctp-overlay0 rounded-lg" style={{
            padding: '32px 12px', fontSize: 12, border: '1px dashed var(--surface1)',
          }}>
            Drag here to remove from tomorrow
          </div>
        )}
      </div>
    </div>
  );

  const RoutineChip = ({ r, from }: { r: XPNode; from: DragFrom }) => {
    const tod = (r.metadata as any)?.timeOfDay as string | undefined;
    return (
      <div
        draggable
        onDragStart={() => setDrag({ id: r._id, from })}
        onDragEnd={() => { setDrag(null); setOverIdx(null); setOverCol(null); }}
        onClick={() => onOpen(r._id)}
        className="flex items-center gap-2 rounded-lg cursor-pointer"
        style={{
          background: 'color-mix(in srgb, var(--teal) 14%, var(--surface0))',
          border: '1px solid color-mix(in srgb, var(--teal) 30%, transparent)',
          padding: '8px 10px', opacity: drag?.id === r._id ? 0.35 : 1,
        }}
      >
        <span style={{ fontSize: 13 }}>{tod ? TOD_GLYPH[tod] ?? '•' : '•'}</span>
        <span className="font-semibold text-sm flex-1 min-w-0 overflow-hidden text-ellipsis" style={{ color: 'var(--text)' }}>
          {r.title}
        </span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--teal)' }}>🔥 {(r.metadata as any)?.streak ?? 0}d</span>
        <Icons.GripVertical size={14} color="var(--overlay0)" />
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(260px, 1fr))', gap: 16 }}>
      {renderStatusCol('TODO', 'To Do', 'var(--overlay2)', todoTasks)}
      {renderStatusCol('IN_PROGRESS', 'In Progress', 'var(--blue)', inProgTasks)}

      {/* Tomorrow column */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (overCol !== 'TOMORROW') setOverCol('TOMORROW'); }}
        onDragLeave={() => setOverCol((c) => (c === 'TOMORROW' ? null : c))}
        onDrop={dropOnTomorrow}
        className="flex flex-col overflow-hidden rounded-[10px] transition-all duration-200"
        style={colShell(overCol === 'TOMORROW')}
      >
        <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: '1px solid var(--surface1)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="font-semibold uppercase" style={{ fontSize: 13, letterSpacing: 0.5 }}>Tomorrow</span>
          <span className="mono text-ctp-overlay1" style={{ fontSize: 11 }}>{planItems.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
          {planItems.map((n, i) => (
            <div key={n._id} onDragOver={(e) => onItemDragOver(e, i)}>
              {overCol === 'TOMORROW' && overIdx === i && (
                <div style={{ height: 2, background: 'var(--accent)', borderRadius: 2, marginBottom: 6 }} />
              )}
              {n.type === 'ROUTINE' ? (
                <RoutineChip r={n} from="plan" />
              ) : (
                <NodeCard
                  node={n}
                  onOpen={onOpen}
                  breadcrumb={breadcrumb(n._id).map((c) => c.title).join(' / ')}
                  draggable
                  dragging={drag?.id === n._id}
                  onDragStart={() => setDrag({ id: n._id, from: 'plan' })}
                  onDragEnd={() => { setDrag(null); setOverIdx(null); setOverCol(null); }}
                />
              )}
            </div>
          ))}
          {overCol === 'TOMORROW' && overIdx === planItems.length && (
            <div style={{ height: 2, background: 'var(--accent)', borderRadius: 2 }} />
          )}
          {planItems.length === 0 && (
            <div className="text-center text-ctp-overlay0 rounded-lg" style={{
              padding: '32px 12px', fontSize: 12, border: '1px dashed var(--surface1)',
            }}>
              Drag tasks & routines here to plan tomorrow
            </div>
          )}
        </div>

        {/* Not-planned routine tray */}
        {trayRoutines.length > 0 && (
          <div style={{ borderTop: '1px solid var(--surface1)', padding: 12 }}>
            <div className="uppercase font-semibold" style={{ fontSize: 10, letterSpacing: 1, color: 'var(--subtext1)', marginBottom: 8 }}>
              Not planned
            </div>
            <div className="flex flex-col gap-2">
              {trayRoutines.map((r) => <RoutineChip key={r._id} r={r} from="tray" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `plan` to Kanban's mode toggle**

In `apps/web/src/views/Kanban.tsx`, import the new component near the top imports:

```ts
import NodeCard from '../components/NodeCard';
import PlanMode from './PlanMode';
```

Widen the `mode` state type. Replace:

```ts
  const [mode, setMode] = useState<'board' | 'sprint'>('board');
```

with:

```ts
  const [mode, setMode] = useState<'board' | 'sprint' | 'plan'>('board');
```

Add `plan` to the toggle list. Replace:

```tsx
          {(['board', 'sprint'] as const).map(m => (
```

with:

```tsx
          {(['board', 'sprint', 'plan'] as const).map(m => (
```

- [ ] **Step 3: Render `PlanMode` when active (replacing the board grid)**

In `Kanban.tsx`, the board grid is the `<div className="flex-1 overflow-x-auto ...">` block that maps `COLUMNS` (starts at the current line 283). Wrap it so plan mode short-circuits to `PlanMode`. Replace the opening of that grid:

```tsx
      <div className="flex-1 overflow-x-auto overflow-y-hidden" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(260px, 1fr))', gap: 16 }}>
        {COLUMNS.map((col) => {
```

with:

```tsx
      {mode === 'plan' ? (
        <PlanMode onOpen={onOpen} />
      ) : (
      <div className="flex-1 overflow-x-auto overflow-y-hidden" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(260px, 1fr))', gap: 16 }}>
        {COLUMNS.map((col) => {
```

Then close the ternary. The board grid currently ends with:

```tsx
          );
        })}
      </div>
    </div>
  );
}
```

Replace that with:

```tsx
          );
        })}
      </div>
      )}
    </div>
  );
}
```

(The `{filtered.length} tasks` header and the sprint UI above the grid stay as-is; in plan mode they simply describe the underlying task set, which is harmless. The mode toggle, filter dropdown remain visible.)

- [ ] **Step 4: Verify the web builds**

Run: `npm run build -w web`
Expected: build succeeds. If `PlanMode` reports an unused `col` param error, the `void col;` line in `dropOnStatusCol` (Step 1) silences it; confirm it is present.

- [ ] **Step 5: Manual smoke check (needs running web + api)**

1. Open Kanban, click the **plan** toggle. The Tomorrow column pre-fills with the auto-suggestion (routines in time-of-day order + due/overdue tasks). A `DayPlan` for tomorrow is created immediately (verify in the playground: `dayPlan(date: "<tomorrow>")` returns the seed).
2. Drag a card within Tomorrow to reorder — an accent insertion line shows the drop position; on drop the order persists (reload the page → order is retained).
3. Drag a To Do / In Progress task into Tomorrow → it joins the plan at the drop position (its status/due are unchanged).
4. Drag a Tomorrow task back to To Do → it leaves the plan (status unchanged).
5. Drag a routine out of Tomorrow → it lands in the "Not planned" tray; drag it from the tray back into Tomorrow → it rejoins the order.
6. Complete a planned task elsewhere → it disappears from Tomorrow (filtered as DONE) without corrupting the saved order.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/views/PlanMode.tsx apps/web/src/views/Kanban.tsx
git commit -m "feat(web): Kanban plan mode - reorderable Tomorrow column backed by DayPlan"
```

---

## Self-Review Notes (author checklist — already applied)

- **Spec coverage:** §1 DayPlan collection → Task 1 (schema). §2 backend module → Task 1. §3 `lib/queue.ts` extraction (date-parameterized, `planned` flag) → Task 2. §4 Kanban plan mode (Tomorrow column, pre-seed+persist, intra-column reorder, add/remove, routines + Not-planned tray, auto-save) → Task 5. §5 mobile DayPlan-aware queue + unplanned marker → Task 4. GraphQL docs → Task 3. ✅ all sections mapped.
- **Type consistency:** `buildQueue(nodes, opts)` returns `QueueEntry[]` everywhere (Tasks 2/4/5). Helper names are stable across files: `isCheckedOn`, `isOverdue(node, day)`, `isDueOnOrBefore`, `addDaysStr`, `localDateStr`. DayPlan shape `{ orderedIds: string[] }` is identical in api entity, gql docs, `BuildQueueOpts.dayPlan`, and the mobile/desktop props.
- **Out of scope (unchanged):** arbitrary-date planning, mobile-side plan editing, Kanban's pre-existing `JSON.stringify(metadata)` writes (a separate latent bug — not touched here), persistent per-routine ordering outside a DayPlan.
- **Known accepted lint:** `apps/web` lint is already RED (pre-existing `no-explicit-any`); new code follows the same `(x as any)?.field` metadata access idiom used throughout the file. Build (`tsc`/vite) is the gate, not lint.
```
