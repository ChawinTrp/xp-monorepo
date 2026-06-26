import type { XPNode } from './types';
import { localDateStr, logicalDateStr, addDays, getWeekStart, getWeekDates } from '@xp/shared';

// Re-export so existing view imports keep one entry point for queue+date utils.
// logicalDateStr is the 5am-cutoff "today" — prefer it over bare localDateStr()
// for anything that means "the day the user is currently living in".
export { localDateStr, logicalDateStr, addDays };

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

// ── Cadence-aware "already satisfied" check. A weekly routine checked Monday
//    shouldn't reappear in the queue Tue–Sun; monthly likewise within the month.
//    Weeks are Sunday-start (canonical @xp/shared convention).
function weekRangeOf(day: string): { start: string; end: string } {
  const start = getWeekStart(day);
  return { start, end: getWeekDates(start)[6] };
}
export function isRoutineSatisfied(meta: any, day: string): boolean {
  const cadence = meta?.cadence ?? 'daily';
  const checks = checkInsOf(meta);
  if (cadence === 'weekly') {
    const { start, end } = weekRangeOf(day);
    return checks.some((c) => c.date >= start && c.date <= end);
  }
  if (cadence === 'monthly') {
    const month = day.slice(0, 7);
    return checks.some((c) => c.date.slice(0, 7) === month);
  }
  return checks.some((c) => c.date === day);
}

// ── Per-day skip ("not today" from the Focus deck). Both TASK and ROUTINE carry
//    `metadata.skips: [YYYY-MM-DD]`. Skips are ALWAYS daily regardless of cadence:
//    skipping a weekly routine hides it for today only, not the whole week. Kept
//    separate from isRoutineSatisfied so the cadence-aware logic stays clean.
export function skipsOf(meta: any): string[] {
  return Array.isArray(meta?.skips) ? meta.skips : [];
}
export function isSkippedOn(meta: any, day: string): boolean {
  return skipsOf(meta).some((d) => d.slice(0, 10) === day);
}
// Backwards-compatible alias (call sites predate the task/routine generalization).
export const isRoutineSkippedOn = isSkippedOn;

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
    .filter(
      (n) =>
        n.type === 'ROUTINE' &&
        !isRoutineSatisfied(n.metadata, today) &&
        !isRoutineSkippedOn(n.metadata, today),
    )
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
  // `=== undefined`, not `!TOD_ORDER[...]`: TOD_ORDER.morning is 0 (falsy), so a
  // truthiness test would re-include every morning routine here and duplicate it.
  const anytimeR = routines.filter(
    (r) => TOD_ORDER[(r.metadata as any)?.timeOfDay] === undefined,
  );

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

// Still actionable when reading a plan: incomplete task / unsatisfied routine.
function isActionable(node: XPNode, today: string): boolean {
  if (node.type === 'TASK') {
    if (node.status === 'DONE') return false;
    // Dismissed ("Tomorrow") or otherwise deferred to a FUTURE due date → it has
    // left today. Without this a planned task pushed to tomorrow reappears in the
    // deck after a refresh (it's still "not DONE"). A task with no due date, or
    // one due today/overdue, stays actionable.
    const due = (node.metadata as any)?.due as string | undefined;
    if (due && due.slice(0, 10) > today) return false;
    return true;
  }
  if (node.type === 'ROUTINE')
    return !isRoutineSatisfied(node.metadata, today) && !isRoutineSkippedOn(node.metadata, today);
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

// ── Pure queue builder.
//    • No dayPlan → Focus v2 baseline: the full autoOrder rhythm (all planned:true).
//      This branch also seeds PlanMode, so it must keep returning everything eligible.
//    • With a dayPlan → EXACTLY the plan: the planned, still-actionable nodes in plan
//      order and nothing else. We deliberately do NOT append eligible-but-unplanned
//      cards — the deck must match what the user planned (no surprise extras, no
//      reordering). New/just-due cards surface in tomorrow's plan, not today's deck.
export function buildQueue(nodes: XPNode[], opts: BuildQueueOpts): QueueEntry[] {
  const { today, snoozedToBack = [], dayPlan = null } = opts;

  if (!dayPlan) {
    return applySnooze(
      autoOrder(nodes, today).map((node) => ({ node, planned: true })),
      snoozedToBack,
    );
  }

  const byId = new Map(nodes.map((n) => [n._id, n]));

  // De-dup ids: heals plans persisted before the morning-routine duplication fix.
  const seenPlan = new Set<string>();
  const planned: QueueEntry[] = dayPlan.orderedIds
    .filter((id) => (seenPlan.has(id) ? false : (seenPlan.add(id), true)))
    .map((id) => byId.get(id))
    .filter((n): n is XPNode => !!n && isActionable(n, today))
    .map((node) => ({ node, planned: true }));

  return applySnooze(planned, snoozedToBack);
}

// ── Dynamic catch-up state helper for PERSON nodes
export function getPersonCatchup(person: any, todayStr: string = logicalDateStr()) {
  const m = person?.metadata ?? {};
  const nextCatchup = m.nextCatchup as string | undefined;
  if (!nextCatchup) {
    return { catchupState: 'none', relativeDate: '' };
  }

  const cleanNext = nextCatchup.slice(0, 10);
  const cleanToday = todayStr.slice(0, 10);

  if (cleanNext < cleanToday) {
    const diffDays = Math.round((new Date(cleanToday + 'T00:00:00').getTime() - new Date(cleanNext + 'T00:00:00').getTime()) / (1000 * 3600 * 24));
    const relativeDate = diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
    return { catchupState: 'overdue', relativeDate };
  } else {
    const diffDays = Math.round((new Date(cleanNext + 'T00:00:00').getTime() - new Date(cleanToday + 'T00:00:00').getTime()) / (1000 * 3600 * 24));
    let relativeDate = '';
    if (diffDays === 0) relativeDate = 'today';
    else if (diffDays === 1) relativeDate = 'tomorrow';
    else relativeDate = `in ${diffDays} days`;
    return { catchupState: 'upcoming', relativeDate };
  }
}

// ── Solid-daily-queue per-item status. Derived per plan-date `day` from canonical
//    node state, so it persists across refreshes and never drifts from the rest of
//    the app (Win-the-Week, XP). `done` wins over `skipped`.
export type ItemStatus = 'done' | 'skipped' | 'pending';

export function itemStatus(node: XPNode, day: string): ItemStatus {
  const meta = node.metadata as any;
  if (node.type === 'TASK') {
    if (node.status === 'DONE') return 'done';
    if (isSkippedOn(meta, day)) return 'skipped';
    return 'pending';
  }
  if (node.type === 'ROUTINE') {
    if (isCheckedOn(meta, day)) return 'done';
    if (isSkippedOn(meta, day)) return 'skipped';
    return 'pending';
  }
  return 'pending';
}

export interface DaySummary {
  total: number;
  done: number;
  skipped: number;
  pending: number;
  resolved: number; // done + skipped — drives the X / Y progress counter
}

export function summarizeDay(statuses: ItemStatus[]): DaySummary {
  const done = statuses.filter((s) => s === 'done').length;
  const skipped = statuses.filter((s) => s === 'skipped').length;
  const pending = statuses.filter((s) => s === 'pending').length;
  return { total: statuses.length, done, skipped, pending, resolved: done + skipped };
}
