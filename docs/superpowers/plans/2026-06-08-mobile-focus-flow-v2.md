# Mobile Focus Flow v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile Focus card flow predictable: due-date-driven task queue, refined time-of-day ordering, a clear three-action model (Snooze / Dismiss-to-tomorrow / Finish), single-level Undo (including a new `reopenTask` backend mutation), a non-inflating counter, and a refactored layout.

**Architecture:** All UI work is in the single file `apps/web/src/mobile/MobileShell.tsx`. The queue logic is extracted into an exported pure function `buildQueue(nodes, today)` so membership/ordering can be reasoned about independently. The card session state machine is rebuilt around an explicit ordered list of node ids (replacing the `snoozedIds` + `extra` recycle machinery) so Snooze reorders without inflating totals. The backend gains a `reopenTask` mutation that exactly reverses `onTaskCompleted`'s XP/progress propagation, mirroring the existing `undoCheckInRoutine`.

**Tech Stack:** React 18 + Apollo Client (web), NestJS 11 + GraphQL Code-First + Mongoose (api).

**Testing reality (read before starting):** This repo has **no working unit-test harness for this code**. The web app (`apps/web`) has **no test runner** (only `vite`/`eslint`). The API jest suite is **already red** (`apps/api/src/nodes/*.spec.ts` fail on DI — no Mongoose model/memory-server provided). Standing up `mongodb-memory-server` or `vitest` is out of scope for this feature. Therefore verification is **manual and observational**, with exact steps and expected results given per task. Do **not** add a test framework. Do **not** try to make the existing red specs pass.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `apps/api/src/nodes/propagation.service.ts` | XP propagation logic | Add `reopenTask(taskId)` method (reverse of `onTaskCompleted`) |
| `apps/api/src/nodes/nodes.resolver.ts` | GraphQL mutations | Add `reopenTask` mutation |
| `apps/web/src/lib/graphql.ts` | gql documents | Add `REOPEN_TASK`; reuse existing `UPDATE_NODE` |
| `apps/web/src/mobile/MobileShell.tsx` | Mobile Focus view | `buildQueue` extraction + membership/ordering; FocusView state machine + counter; Dismiss; Undo; layout |

---

## Task 1: Backend `reopenTask` mutation

Reverses a completed TASK back to TODO and undoes the XP/progress propagation that `onTaskCompleted` applied. Mirrors `undoCheckInRoutine` (propagation.service.ts:250) and the forward traversal in `onTaskCompleted` (propagation.service.ts:12).

**Files:**
- Modify: `apps/api/src/nodes/propagation.service.ts` (add method after `onTaskCompleted`, ~line 94)
- Modify: `apps/api/src/nodes/nodes.resolver.ts:61-64` (add mutation next to `undoCheckInRoutine`)

- [ ] **Step 1: Add `reopenTask` to the propagation service**

In `apps/api/src/nodes/propagation.service.ts`, add this method immediately after the closing brace of `onTaskCompleted` (the `return affected; }` around line 93-94):

```typescript
async reopenTask(taskId: string): Promise<Node[]> {
  const task = await this.nodeModel.findById(taskId).exec();
  if (!task) throw new NotFoundException(`Node ${taskId} not found`);
  if (task.type !== 'TASK')
    throw new Error('reopenTask called on non-TASK node');
  if (task.status !== 'DONE') return [task]; // nothing to reopen

  const meta = { ...(task.metadata ?? {}) } as Record<string, unknown>;
  // The exact hours credited at completion time (stored by onTaskCompleted).
  const creditedHours = (meta.creditedHours as number) ?? 0;

  // Reset the task itself.
  delete meta.completedAt;
  delete meta.completedDate;
  delete meta.creditedHours;
  task.status = 'TODO';
  task.metadata = meta;
  task.markModified('metadata');
  // Leaf tasks go back to 0%; parent tasks recompute from children below.
  task.progress = 0;
  await task.save();

  const affected: Node[] = [task];
  const visited = new Set<string>([taskId]);

  // Phase 1: walk mainParent chain, reversing each effect onTaskCompleted applied.
  let currentId = task.mainParent?.toString();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const parent = await this.nodeModel.findById(currentId).exec();
    if (!parent) break;

    switch (parent.type) {
      case 'TASK':
        await this.recalcTaskProgress(parent);
        break;
      case 'PROJECT':
        await this.recalcProjectProgress(parent);
        break;
      case 'SKILL':
        await this.subtractHoursFromSkill(parent, creditedHours);
        break;
      case 'DOMAIN':
        await this.recalcDomainProgress(parent);
        break;
      default:
        // PERSON, TAG, ROUTINE — stop walking
        affected.push(parent);
        return affected;
    }

    affected.push(parent);
    currentId = parent.mainParent?.toString();
  }

  // Phase 2: reverse hours credited to SKILLs linked via parents[].
  if (creditedHours > 0) {
    const parentIds = (task.parents ?? [])
      .map(p => p.toString())
      .filter(pid => !visited.has(pid));

    for (const pid of parentIds) {
      const parentNode = await this.nodeModel.findById(pid).exec();
      if (!parentNode || parentNode.type !== 'SKILL') continue;
      visited.add(pid);
      await this.subtractHoursFromSkill(parentNode, creditedHours);
      affected.push(parentNode);

      let ancestorId = parentNode.mainParent?.toString();
      while (ancestorId && !visited.has(ancestorId)) {
        visited.add(ancestorId);
        const ancestor = await this.nodeModel.findById(ancestorId).exec();
        if (!ancestor) break;
        if (ancestor.type === 'DOMAIN') {
          await this.recalcDomainProgress(ancestor);
          affected.push(ancestor);
        }
        ancestorId = ancestor.mainParent?.toString();
      }
    }
  }

  return affected;
}
```

- [ ] **Step 2: Add the resolver mutation**

In `apps/api/src/nodes/nodes.resolver.ts`, immediately after the `undoCheckInRoutine` mutation block (lines 61-64), add:

```typescript
  @Mutation(() => [Node])
  reopenTask(@Args('id', { type: () => ID }) id: string) {
    return this.propagationService.reopenTask(id);
  }
```

- [ ] **Step 3: Verify it compiles and the schema regenerates**

Run: `npm run build -w api`
Expected: build succeeds. Then confirm `reopenTask` appears in the generated schema:

Run: `git diff apps/api/src/schema.gql`
Expected: a new `reopenTask(id: ID!): [Node!]!` mutation line (schema is auto-generated on build/start).

- [ ] **Step 4: Manual round-trip verification on the dev server**

Start the API: `npm run start:dev -w api` (wait for `http://localhost:3000/graphql`).
In the GraphQL playground, pick a TASK that is a child of a SKILL (so hours propagate). Record the skill's `metadata.totalHours` first:

```graphql
query { node(id: "<SKILL_ID>") { _id metadata } }
```

Complete the task, then reopen it:

```graphql
mutation { completeTask(completeTaskInput: { id: "<TASK_ID>" }) { _id status metadata } }
mutation { reopenTask(id: "<TASK_ID>") { _id type status metadata } }
```

Expected after reopen:
- task `status` = `"TODO"`, `metadata` no longer has `completedAt`/`completedDate`/`creditedHours`.
- the SKILL's `metadata.totalHours` is back to the value recorded before completion (re-run the query above).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/nodes/propagation.service.ts apps/api/src/nodes/nodes.resolver.ts apps/api/src/schema.gql
git commit -m "feat(api): reopenTask mutation reversing task-completion propagation"
```

---

## Task 2: Web — `REOPEN_TASK` gql document

Adds the mutation document the Undo handler (Task 6) will call. `UPDATE_NODE` already exists (graphql.ts:48) and is reused for Dismiss — no change needed there.

**Files:**
- Modify: `apps/web/src/lib/graphql.ts` (add after `UNDO_CHECK_IN_ROUTINE`, ~line 108)

- [ ] **Step 1: Add the document**

In `apps/web/src/lib/graphql.ts`, after the `UNDO_CHECK_IN_ROUTINE` export (ends line 108), add:

```typescript
export const REOPEN_TASK = gql`
  ${NODE_FIELDS}
  mutation ReopenTask($id: ID!) {
    reopenTask(id: $id) {
      ...NodeFields
    }
  }
`;
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build -w web`
Expected: build succeeds (the new export is syntactically valid; it is unused until Task 6, which is fine).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/graphql.ts
git commit -m "feat(web): add REOPEN_TASK mutation document"
```

---

## Task 3: Web — `buildQueue` pure function (due-date membership + refined ordering)

Replaces the body of `useQueue` (MobileShell.tsx:52-105). Extracts an exported pure function so the membership/ordering rules are isolated and reasoned about on their own. New rules:
- **TASK membership:** in queue iff `metadata.due` exists and `due <= today` (overdue or due-today). Priority no longer gates membership.
- **ROUTINE membership:** unchanged (not checked in today).
- **Ordering:** time-of-day rhythm, refined (see spec §2).

**Files:**
- Modify: `apps/web/src/mobile/MobileShell.tsx:52-105` (replace `useQueue`)

- [ ] **Step 1: Add a `dueOnOrBefore` helper and `buildQueue`, and rewrite `useQueue` to call it**

Replace the entire `useQueue` function (MobileShell.tsx:52-105) with:

```typescript
// ── A task counts for "today" when it has a due date that is today or earlier.
//    Date-string compare avoids the UTC drift of `new Date(due) < new Date()`.
function isDueToday(node: XPNode): boolean {
  const due = (node.metadata as any)?.due as string | undefined;
  if (!due) return false;
  // due may be 'YYYY-MM-DD' or an ISO timestamp; compare on the date portion.
  return due.slice(0, 10) <= TODAY;
}

// ── Pure queue builder: which cards show today and in what order.
//    Exported for isolated reasoning/inspection.
export function buildQueue(nodes: XPNode[], snoozedToBack: string[] = []): XPNode[] {
  const routines = nodes
    .filter(n => n.type === 'ROUTINE' && !isCheckedToday(n.metadata))
    .sort((a, b) => {
      const todA = (a.metadata as any)?.timeOfDay ?? 'anytime';
      const todB = (b.metadata as any)?.timeOfDay ?? 'anytime';
      const da = (TOD_ORDER[todA] ?? 99) - (TOD_ORDER[todB] ?? 99);
      return da !== 0 ? da : ((b.metadata as any)?.streak ?? 0) - ((a.metadata as any)?.streak ?? 0);
    });

  // Membership is due-date driven; priority only affects order.
  const tasks = nodes.filter(n => n.type === 'TASK' && n.status !== 'DONE' && isDueToday(n));
  const prio: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const byPriority = (a: XPNode, b: XPNode) =>
    (prio[(a.metadata as any)?.priority] ?? 9) - (prio[(b.metadata as any)?.priority] ?? 9);

  const morningR   = routines.filter(r => (r.metadata as any)?.timeOfDay === 'morning');
  const afternoonR = routines.filter(r => (r.metadata as any)?.timeOfDay === 'afternoon');
  const eveningR   = routines.filter(r => (r.metadata as any)?.timeOfDay === 'evening');
  const nightR     = routines.filter(r => (r.metadata as any)?.timeOfDay === 'night');
  const anytimeR   = routines.filter(r => !TOD_ORDER[(r.metadata as any)?.timeOfDay]);

  const overdueTasks = tasks.filter(t => isOverdue(t)).sort(byPriority);
  const todayTasks   = tasks.filter(t => !isOverdue(t)).sort(byPriority);
  const highToday    = todayTasks.filter(t => (t.metadata as any)?.priority === 'high');
  const medToday     = todayTasks.filter(t => (t.metadata as any)?.priority === 'medium');
  const lowToday     = todayTasks.filter(t =>
    (t.metadata as any)?.priority !== 'high' && (t.metadata as any)?.priority !== 'medium');

  const ordered = [
    ...morningR, ...anytimeR,
    ...overdueTasks,
    ...highToday,
    ...afternoonR,
    ...medToday,
    ...eveningR,
    ...lowToday,
    ...nightR,
  ];

  // Snoozed-this-session cards are moved to the back, preserving relative order.
  if (snoozedToBack.length === 0) return ordered;
  const back = new Set(snoozedToBack);
  const front = ordered.filter(n => !back.has(n._id));
  const tail = ordered.filter(n => back.has(n._id));
  return [...front, ...tail];
}

function useQueue(nodes: XPNode[], snoozedToBack: string[]) {
  return useMemo(() => buildQueue(nodes, snoozedToBack), [nodes, snoozedToBack]);
}
```

> Note: `isOverdue` (line 27) currently uses `new Date(m.due) < new Date()`. `isDueToday` deliberately uses a date-string compare so a task due *today* counts as in-queue (an ISO `due` at 00:00 would otherwise read as "past"). Leave `isOverdue` as-is — within the queue an overdue task and a due-today task are both members; `isOverdue` only sorts them into the overdue group.

- [ ] **Step 2: Verify it builds**

Run: `npm run build -w web`
Expected: build succeeds. (`useQueue` signature changed from `Set<string>` to `string[]`; Task 4 updates the only caller. If you build before Task 4 you will get a type error at the `useQueue(...)` call site — that is expected and resolved in Task 4. To build green in isolation, complete Task 4 in the same session before building.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/mobile/MobileShell.tsx
git commit -m "feat(web): due-date task membership + refined queue ordering (buildQueue)"
```

---

## Task 4: Web — FocusView state machine + counter fix

Replaces the `snoozedIds: Set` + `extra: XPNode[]` recycle machinery (MobileShell.tsx:274-316) with an explicit model: a `snoozedToBack` id list feeds `buildQueue`, and a `done` count drives a **stable** counter. Snooze moves a card to the back without inflating the total.

**Files:**
- Modify: `apps/web/src/mobile/MobileShell.tsx` — `FocusView` state (274-296), `advance` (298-316), the empty-state reset (347-354), the header counter (378-385).

- [ ] **Step 1: Replace the FocusView session state**

Replace lines 274-296 (from `// snoozedIds keeps...` through the init `useEffect`) with:

```typescript
  // Cards snoozed THIS SESSION are pushed to the back of the queue (session-only).
  const [snoozedToBack, setSnoozedToBack] = useState<string[]>([]);
  // Ids finished or dismissed this session — drives the stable counter denominator.
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  // ID-based tracking avoids index drift when the queue shrinks after a refetch.
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);

  const queue = useQueue(nodes, snoozedToBack);

  const idx = queue.findIndex(n => n._id === currentId);
  const node = idx >= 0 ? queue[idx] : undefined;

  // Stable denominator: distinct cards seen today = current queue length + cleared.
  const total = queue.length + clearedIds.size;
  const cleared = clearedIds.size;

  // Initialize currentId once the queue is ready; showDone prevents re-init after completion.
  useEffect(() => {
    if (!showDone && currentId === null && queue.length > 0) {
      setCurrentId(queue[0]._id);
    }
  }, [showDone, currentId, queue.length]); // eslint-disable-line react-hooks/exhaustive-deps
```

> This removes the old `baseQueue`/`queue`/`extra`/`cleared` state and `setCleared`. The `cleared` and `total` values are now derived. Delete any remaining references to `baseQueue`, `extra`, `setExtra`, `snoozedIds`, `setSnoozedIds`, `setCleared` — Steps 2-4 cover the ones in `advance`, the empty state, and the header.

- [ ] **Step 2: Rewrite `advance` for the three actions + non-inflating counter**

Replace the `advance` callback (was lines 298-316) with a version that handles `finish`, `snooze`, and `dismiss`. Dismiss/Undo wiring lands in Tasks 5-6; here `dismiss` removes the card via `clearedIds` and calls the passed-in `onDismiss`:

```typescript
  const advance = useCallback((action: 'finish' | 'snooze' | 'dismiss') => {
    if (!node || idx < 0) return;
    // The next card to show, computed before state changes reshuffle the queue.
    const nextId = queue.find((n, i) => i > idx && n._id !== node._id)?._id ?? null;

    if (action === 'finish') {
      onFinish(node);
      setClearedIds(s => new Set([...s, node._id]));
      setDragDx(600);
    } else if (action === 'dismiss') {
      onDismiss(node);
      setClearedIds(s => new Set([...s, node._id]));
      setDragDx(-600);
    } else {
      // Snooze: push to back of the remaining queue, do NOT count as cleared.
      setSnoozedToBack(s => (s.includes(node._id) ? s : [...s, node._id]));
      setDragDx(-600);
    }

    setTimeout(() => {
      // For snooze, the card moved to the back; advance to whatever is now first-unseen.
      setCurrentId(nextId);
      if (!nextId) setShowDone(true);
      setDragDx(0);
    }, 240);
  }, [node, idx, queue, onFinish, onDismiss]);
```

> `FocusViewProps` gains `onDismiss: (node: XPNode) => void`. Add it to the interface (lines 263-269) and destructure it in the `FocusView(...)` signature (line 271). It is supplied with a temporary no-op in this task and implemented in Task 5.

Add to the `FocusViewProps` interface:
```typescript
  onDismiss: (node: XPNode) => void;
```
And add `onDismiss` to the destructured params on line 271.

- [ ] **Step 3: Provide a temporary `onDismiss` no-op from the parent**

So the app runs end-to-end after this task, wire a placeholder in the `<FocusView .../>` usage (MobileShell.tsx:781-787). Add the prop:

```typescript
            onDismiss={() => { /* implemented in Task 5 */ }}
```

- [ ] **Step 4: Fix the empty-state reset and the header counter**

In the empty-state "Replay queue" button onClick (was lines 347-354), replace the body with the new state setters:

```typescript
          onClick={() => {
            setShowDone(false);
            setSnoozedToBack([]);
            setClearedIds(new Set());
            setCurrentId(null);
          }}
```

In the empty-state copy (line 345), `cleared` is still in scope (now derived) — no change needed there.

In the header counter block (lines 378-385), replace `queue.length` usages so the denominator is the stable `total` and "left" reflects remaining:

```typescript
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 22, fontWeight: 600, letterSpacing: -0.5 }}>
            {cleared + 1}<span style={{ color: 'var(--overlay0)' }}>/{total}</span>
          </div>
          <div style={{ fontSize: 10.5, letterSpacing: 1, color: 'var(--subtext1)', textTransform: 'uppercase' }}>
            {queue.length} left
          </div>
        </div>
```

> Also update `ProgressDots` usage (line 432) to use the stable total: change `total={queue.length}` to `total={total}` and keep `index={cleared}` — replace `index={idx}` with `index={cleared}` so dots track completed, not raw position. (ProgressDots itself, lines 473-492, needs no change.)

- [ ] **Step 5: Run the app and verify the counter no longer inflates**

Run web + api (`npm run start:dev -w api`, `npm run dev -w web`), open the mobile view (DevTools device toolbar / narrow viewport).
Verify, with at least 3 cards in the queue:
1. The counter shows `1/N` with a fixed `N`.
2. **Snooze a routine** → the card goes to the back, the counter denominator `N` stays the same (the `1/10 → 2/11` bug is gone; it should read e.g. still `/N`, advancing the left-hand number only as you clear cards).
3. **Finish a card** → `cleared` increments, "X left" decrements.
4. Snoozed card reappears at the end of the queue, not immediately.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/mobile/MobileShell.tsx
git commit -m "feat(web): rebuild Focus session state — snooze-to-back + stable counter"
```

---

## Task 5: Web — Dismiss → tomorrow (persisted)

Implements the real `onDismiss`: set the task's `metadata.due` to tomorrow via `updateNode`, removing it from today's queue. Because `updateNode` full-replaces `metadata`, send the complete metadata object with `due` changed.

**Files:**
- Modify: `apps/web/src/mobile/MobileShell.tsx` — imports (line 5-7), mutations block (727-731), add `handleDismiss` (near 758-771), pass to `FocusView` (781-787).

- [ ] **Step 1: Import `UPDATE_NODE` and add a tomorrow helper**

Update the graphql import (lines 5-7) to include `UPDATE_NODE`:

```typescript
import {
  COMPLETE_TASK, CHECK_IN_ROUTINE, START_TIMER, STOP_TIMER, GET_NODES,
  UPDATE_NODE, REOPEN_TASK,
} from '../lib/graphql';
```

> `REOPEN_TASK` is imported now (used in Task 6) to avoid touching the import twice.

Add a `tomorrowStr` helper next to `localDateStr` (after line 18):

```typescript
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}
```

- [ ] **Step 2: Register the mutations**

In the mutations block (lines 727-731), add `updateNodeMut` and `reopenTaskMut`:

```typescript
  const [updateNodeMut]   = useMutation(UPDATE_NODE,         refetchOpts);
  const [reopenTaskMut]    = useMutation(REOPEN_TASK,         refetchOpts);
```

> `reopenTaskMut` is wired into Undo in Task 6.

- [ ] **Step 3: Implement `handleDismiss`**

After `handleFinish` (ends line 771), add:

```typescript
  const handleDismiss = useCallback(async (node: XPNode) => {
    if (node.type !== 'TASK') return; // routines have no due date
    const meta = { ...(node.metadata as any), due: tomorrowStr() };
    try {
      await updateNodeMut({ variables: { input: { _id: node._id, metadata: meta } } });
    } catch { /* ignore */ }
  }, [updateNodeMut]);
```

- [ ] **Step 4: Replace the Task-4 placeholder with the real handler**

In the `<FocusView .../>` usage, replace `onDismiss={() => { /* implemented in Task 5 */ }}` with:

```typescript
            onDismiss={handleDismiss}
```

- [ ] **Step 5: Run the app and verify dismiss persists**

With the app running and a TASK card showing:
1. Tap **Dismiss** → card leaves the queue, counter "left" decrements.
2. **Reload the page** → the dismissed task does **not** reappear in today's queue (its `due` is now tomorrow).
3. In the desktop view or GraphQL, confirm the task's `metadata.due` equals tomorrow's date and **other metadata fields are intact** (priority, estimatedHours, etc. — proves the full-metadata resend worked).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/mobile/MobileShell.tsx
git commit -m "feat(web): Dismiss action sets task due=tomorrow (persisted)"
```

---

## Task 6: Web — Undo last action (single-level)

Adds a header Undo that reverses the last Snooze / Dismiss / Finish. Undo state lives in `FocusView` for snooze (client-only) and in the parent for persisted reversals. To keep one source of truth, the parent owns an `undoableRef` describing the last persisted action; `FocusView` reports actions up via callbacks and exposes an `onUndo` that the header button calls.

**Approach:** `FocusView` keeps a `lastAction` record `{ kind, nodeId, prevQueueIndex?, prevDue? }`. On Undo it reverses locally (snooze) or calls the matching parent mutation handler (finish/dismiss) passed as props.

**Files:**
- Modify: `apps/web/src/mobile/MobileShell.tsx` — `FocusViewProps` + `FocusView` (undo state, record on each action, `handleUndo`), header (add Undo button), parent handlers `onUndoFinish`/`onUndoDismiss`.

- [ ] **Step 1: Add parent undo handlers**

After `handleDismiss` (Task 5), add reversal handlers in the parent and pass them down:

```typescript
  const handleUndoFinish = useCallback(async (node: XPNode, prevDue?: string) => {
    try {
      if (node.type === 'ROUTINE') {
        await undoCheckInMut({ variables: { id: node._id } });
      } else {
        await reopenTaskMut({ variables: { id: node._id } });
      }
    } catch { /* ignore */ }
  }, [reopenTaskMut]);

  const handleUndoDismiss = useCallback(async (node: XPNode, prevDue?: string) => {
    const meta = { ...(node.metadata as any), due: prevDue ?? null };
    try {
      await updateNodeMut({ variables: { input: { _id: node._id, metadata: meta } } });
    } catch { /* ignore */ }
  }, [updateNodeMut]);
```

Add the `UNDO_CHECK_IN_ROUTINE` import to the graphql import list (line 5-7), and register the mutation in the mutations block:

```typescript
  const [undoCheckInMut]  = useMutation(UNDO_CHECK_IN_ROUTINE, refetchOpts);
```

> Add `UNDO_CHECK_IN_ROUTINE` to the `from '../lib/graphql'` import.

- [ ] **Step 2: Extend `FocusViewProps` and capture prev-state on each action**

Add to `FocusViewProps` (interface at 263-269):

```typescript
  onUndoFinish: (node: XPNode) => void;
  onUndoDismiss: (node: XPNode, prevDue?: string) => void;
```

Destructure them in `FocusView(...)`. Add undo state near the other `useState`s (Task 4 block):

```typescript
  // Single-level undo of the most recent action this session.
  const [lastAction, setLastAction] = useState<
    | { kind: 'finish' | 'snooze' | 'dismiss'; node: XPNode; prevDue?: string }
    | null
  >(null);
```

In `advance`, record the action before mutating. Insert at the top of `advance` (after the `nextId` line):

```typescript
    setLastAction({
      kind: action,
      node,
      prevDue: (node.metadata as any)?.due,
    });
```

- [ ] **Step 3: Implement `handleUndo` in FocusView**

Add after `advance`:

```typescript
  const handleUndo = useCallback(() => {
    if (!lastAction) return;
    const { kind, node: an, prevDue } = lastAction;

    if (kind === 'snooze') {
      // Pull the card back out of the snoozed-to-back list and make it current.
      setSnoozedToBack(s => s.filter(id => id !== an._id));
      setCurrentId(an._id);
    } else if (kind === 'finish') {
      onUndoFinish(an);
      setClearedIds(s => { const n = new Set(s); n.delete(an._id); return n; });
      setShowDone(false);
      setCurrentId(an._id);
    } else {
      onUndoDismiss(an, prevDue);
      setClearedIds(s => { const n = new Set(s); n.delete(an._id); return n; });
      setShowDone(false);
      setCurrentId(an._id);
    }
    setLastAction(null);
  }, [lastAction, onUndoFinish, onUndoDismiss]);
```

> After a finish/dismiss undo, the underlying node returns to the queue via the refetch (`refetchOpts`), so setting `currentId` to it makes it the visible card again.

- [ ] **Step 4: Wire parent props into `<FocusView/>`**

In the usage (Task 5), add:

```typescript
            onUndoFinish={handleUndoFinish}
            onUndoDismiss={handleUndoDismiss}
```

- [ ] **Step 5: Build check**

Run: `npm run build -w web`
Expected: build succeeds, no unused-import or type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/mobile/MobileShell.tsx
git commit -m "feat(web): single-level Undo for snooze/dismiss/finish (incl. reopenTask)"
```

> The Undo **button** is added in Task 7 (layout), where the header is rebuilt. `handleUndo`/`lastAction` are exercised there.

---

## Task 7: Web — Layout (dots top, 3-button row, Undo top-right)

Moves the progress dots to the top, places Undo in the header next to the counter, and makes the action row a single row of three equal buttons (Snooze · Dismiss · Finish), with Dismiss hidden on routine cards.

**Files:**
- Modify: `apps/web/src/mobile/MobileShell.tsx` — header (370-386), remove dots from action row / add dots under header, action row (419-444), `ActionBtn` tone type (449-471), `S.actions` style (975-980).

- [ ] **Step 1: Add Undo to the header and dots under it**

Replace the header block (lines 370-386) with a version that adds an Undo button beside the counter and renders `ProgressDots` directly beneath the header:

```typescript
      {/* header */}
      <div style={S.header}>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: 'var(--subtext1)', letterSpacing: 0.8 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '2px 0 0', letterSpacing: -0.5 }}>Focus</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 22, fontWeight: 600, letterSpacing: -0.5 }}>
              {cleared + 1}<span style={{ color: 'var(--overlay0)' }}>/{total}</span>
            </div>
            <div style={{ fontSize: 10.5, letterSpacing: 1, color: 'var(--subtext1)', textTransform: 'uppercase' }}>
              {queue.length} left
            </div>
          </div>
          <button
            onClick={handleUndo}
            disabled={!lastAction}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 11px', borderRadius: 999,
              background: lastAction ? 'var(--surface0)' : 'transparent',
              color: lastAction ? 'var(--subtext0)' : 'var(--overlay0)',
              border: 'none', cursor: lastAction ? 'pointer' : 'default',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              opacity: lastAction ? 1 : 0.4,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
            </svg>
            Undo
          </button>
        </div>
      </div>

      {/* progress dots — top */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 10 }}>
        <ProgressDots total={total} index={cleared} />
      </div>
```

> This replaces the previous header counter edit from Task 4 Step 4 — the counter markup now lives here. If the Task 4 header still has its own counter, this block supersedes it.

- [ ] **Step 2: Rewrite the action row as three buttons**

Replace the action row block (lines 419-444, the `<div style={S.actions}>...</div>` that contained Snooze / ProgressDots / Finish) with:

```typescript
      {/* action buttons — single row of three */}
      <div style={S.actions}>
        <ActionBtn
          tone="snooze"
          label="Snooze"
          hint="swipe ←"
          onClick={() => advance('snooze')}
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v6l3 3"/><circle cx="12" cy="12" r="9"/>
            </svg>
          }
        />
        {node.type === 'TASK' && (
          <ActionBtn
            tone="dismiss"
            label="Tomorrow"
            hint="dismiss"
            onClick={() => advance('dismiss')}
            icon={
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            }
          />
        )}
        <ActionBtn
          tone="finish"
          label={node.type === 'ROUTINE' ? 'Check in' : 'Finish'}
          hint="swipe →"
          onClick={() => advance('finish')}
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
        />
      </div>
```

- [ ] **Step 3: Add the `dismiss` tone to `ActionBtn`**

In `ActionBtn` (lines 449-471), widen the `tone` type and add its colors. Change the signature `tone: 'snooze' | 'finish'` to:

```typescript
  tone: 'snooze' | 'finish' | 'dismiss';
```

And replace the `fg`/`bg` derivation (lines 456-457):

```typescript
  const fg = tone === 'finish' ? 'var(--green)' : tone === 'dismiss' ? 'var(--blue)' : 'var(--subtext1)';
  const bg = tone === 'finish' ? 'rgba(166,227,161,0.10)' : tone === 'dismiss' ? 'rgba(137,180,250,0.10)' : 'rgba(166,173,200,0.08)';
```

- [ ] **Step 4: Update `S.actions` to space three buttons evenly**

Replace `S.actions` (lines 975-980):

```typescript
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 8,
    padding: '14px 4px 4px',
  },
```

- [ ] **Step 5: Run the app and verify the full flow**

With web + api running, in the mobile viewport:
1. **Layout:** dots sit under the header; the counter and an Undo button are top-right; the action row shows three buttons on task cards (Snooze · Tomorrow · Finish) and two on routine cards (Snooze · Check in — no Tomorrow).
2. **Snooze** a card → moves to back, counter total unchanged, **Undo** enabled → tap Undo → the snoozed card returns as current.
3. **Finish** a task → cleared++, Undo enabled → tap Undo → task returns to TODO and reappears (verify via reload that status is TODO).
4. **Finish** a routine → Undo → check-in removed (streak restored).
5. **Tomorrow (Dismiss)** a task → leaves queue → Undo → task's `due` restored to its previous value (verify other metadata intact).
6. Undo is dimmed/disabled when there is no last action (e.g., right after a successful undo).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/mobile/MobileShell.tsx
git commit -m "feat(web): Focus layout v2 — dots top, Undo in header, 3-button action row"
```

---

## Final verification

- [ ] Run `npm run build -w web` and `npm run build -w api` — both succeed.
- [ ] Run `npm run lint -w web` — no new errors in `MobileShell.tsx` (warnings pre-existing elsewhere are fine).
- [ ] Full manual pass of Task 7 Step 5 scenarios 1-6.
- [ ] Confirm dead state is gone: search `MobileShell.tsx` for `snoozedIds`, `extra`, `setExtra`, `setCleared`, `baseQueue` — expect **no matches**.

```bash
git log --oneline feat/mobile-focus-flow-v2 ~7..HEAD
```
Expected: design-doc commits + Tasks 1-7 commits.

---

## Spec coverage map

| Spec section | Task(s) |
|--------------|---------|
| §1 Task membership (due-date) | Task 3 |
| §2 Ordering (time-of-day refined) | Task 3 |
| §3 Three actions (Finish/Snooze/Dismiss) | Tasks 4 (finish/snooze), 5 (dismiss), 7 (buttons) |
| §4 Undo (incl. reopenTask) | Tasks 1 (backend), 6 (web), 7 (button) |
| §5 Counter fix | Task 4 |
| §6 reopenTask backend | Task 1 |
| §7 Layout | Task 7 |
| Routines unchanged | Task 3 (membership untouched) |
