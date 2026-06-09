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
