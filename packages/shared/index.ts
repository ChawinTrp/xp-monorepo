export const NODE_TYPES = [
  'DOMAIN',
  'SKILL',
  'PROJECT',
  'TASK',
  'PERSON',
  'TAG',
  'ROUTINE',
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface NodeBase {
  _id: string;
  title: string;
  type: NodeType;
  mainParent?: string;
  parents?: string[];
  children?: string[];
  status?: TaskStatus;
  progress?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

// ── Mastery System ──

export const MASTERY_TIERS = ['unfamiliar', 'familiar', 'skilled', 'master', 'world_class'] as const;
export type MasteryTier = (typeof MASTERY_TIERS)[number];

export const MASTERY_THRESHOLDS: { tier: MasteryTier; minHours: number }[] = [
  { tier: 'world_class', minHours: 10_000 },
  { tier: 'master',      minHours: 1_000 },
  { tier: 'skilled',     minHours: 300 },
  { tier: 'familiar',    minHours: 20 },
  { tier: 'unfamiliar',  minHours: 0 },
];

export function getMasteryTier(totalHours: number): MasteryTier {
  return MASTERY_THRESHOLDS.find(t => totalHours >= t.minHours)!.tier;
}

export function getNextTierThreshold(totalHours: number): number | null {
  if (totalHours >= 10_000) return null;
  if (totalHours >= 1_000) return 10_000;
  if (totalHours >= 300) return 1_000;
  if (totalHours >= 20) return 300;
  return 20;
}

// ── Parent Rules ──

export const ALLOWED_MAIN_PARENTS: Record<NodeType, NodeType[] | null> = {
  DOMAIN: ['DOMAIN'],
  SKILL: ['DOMAIN'],
  PROJECT: ['DOMAIN'],
  TASK: ['PROJECT', 'DOMAIN', 'TASK'],
  PERSON: ['DOMAIN'],
  TAG: null,
  ROUTINE: ['DOMAIN'],
};

// ── Win-the-Week System ──

export const WIN_RULES = {
  routineThreshold: 3,   // daily routines checked in to win a day
  taskThreshold: 1,      // tasks completed to win a day
  weekTarget: 4,         // days needed to win the week (of 7)
  weekStartsOn: 0,       // 0 = Sunday
} as const;

export type DayWinResult = {
  date: string;           // YYYY-MM-DD local
  won: boolean;
  routinesCheckedIn: number;
  routineTarget: number;
  tasksCompleted: number;
  taskTarget: number;
};

export function dayWon(
  routinesCheckedIn: number,
  tasksCompleted: number,
  routineTarget: number = WIN_RULES.routineThreshold,
): boolean {
  return routinesCheckedIn >= routineTarget && tasksCompleted >= WIN_RULES.taskThreshold;
}

// ── Core habits (graduation) ──
// A daily ROUTINE with `metadata.core = 'YYYY-MM-DD'` counts toward Win-the-Day
// from that date on. New habits start non-core (tracked, not required) and are
// promoted by setting `core` once they've stuck. If no routine is flagged, the
// legacy fixed threshold applies, so existing data behaves exactly as before.
type CoreRoutineLike = { metadata?: { cadence?: string; core?: string } | null };

/** Which daily routines are required to win `date`. */
export function coreRoutinesOn<T extends CoreRoutineLike>(routines: T[], date: string): T[] {
  return routines.filter((r) => {
    const m = r.metadata ?? {};
    return m.cadence === 'daily' && typeof m.core === 'string' && m.core <= date;
  });
}

/** Routines needed to win `date`: all core ones, or the legacy threshold if none are flagged. */
export function routineTargetOn(routines: CoreRoutineLike[], date: string): number {
  const anyFlagged = routines.some((r) => typeof r.metadata?.core === 'string');
  return anyFlagged ? coreRoutinesOn(routines, date).length : WIN_RULES.routineThreshold;
}

export function weekWon(wonDaysCount: number): boolean {
  return wonDaysCount >= WIN_RULES.weekTarget;
}

// ── Habit Contract (penalty layer over Win-the-Week) ──
// Derived, never stored: a lost day is a past day that wasn't won; the week is
// lost once the remaining days can't reach weekTarget. Payments live outside XP.

export const PENALTY_RULES = {
  perLostDay: 100,   // ฿ per past weekday not won
  lostWeek: 300,     // ฿ once the week can no longer be won
  startDate: '2026-09-19', // contract signed; days before it never count
  // From this date Sat/Sun carry no per-day penalty. They still count toward
  // Win-the-Week, so a weekend is upside-only: winnable, never billable.
  // Dated so settled weeks (09-20 -> 26, ฿800) do not move.
  weekendsFreeFrom: '2026-09-27',
} as const;

/** Whether a lost `date` is charged for. Weekends stop billing from 2026-09-27. */
export function penalisedDay(date: string): boolean {
  if (date < PENALTY_RULES.weekendsFreeFrom) return true;
  const wd = parseLocalDate(date).getDay();
  return wd >= 1 && wd <= 5;
}

export type WeekPenalty = {
  lostDays: number;
  weekLost: boolean;
  owed: number;
};

/** `days` are the week's 7 DayWinResults; `today` is the logical date. */
export function weekPenalty(days: Pick<DayWinResult, 'date' | 'won'>[], today: string): WeekPenalty {
  if (today < PENALTY_RULES.startDate) return { lostDays: 0, weekLost: false, owed: 0 };
  const wonSoFar = days.filter((d) => d.won).length;
  const lostDays = days.filter(
    (d) => d.date >= PENALTY_RULES.startDate && d.date < today && !d.won && penalisedDay(d.date),
  ).length;
  const remaining = days.filter((d) => d.date >= today && !d.won).length;
  // A week that began before the contract can't be "lost" — nothing to defend.
  const weekLost = days[0].date >= PENALTY_RULES.startDate && wonSoFar + remaining < WIN_RULES.weekTarget;
  return {
    lostDays,
    weekLost,
    owed: lostDays * PENALTY_RULES.perLostDay + (weekLost ? PENALTY_RULES.lostWeek : 0),
  };
}

// ── Date helpers (single source of truth) ──
// All week math is Sunday-start and operates on LOCAL calendar dates so that
// derived wins/streaks line up with the user's real day. Single-user app:
// server and client are assumed to share a timezone (see XP.md §11).

/** Local YYYY-MM-DD for a Date (defaults to now). */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string as local midnight (avoids UTC-parse drift). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ── Logical day (5am cutoff) ──
// The "day" the user lives in rolls over at 5am, not midnight: anything done
// between midnight and 5am counts toward the day that just ended. Every "today"
// in the app (plans, streaks, win-the-week, check-ins, completion dates) should
// derive from logicalDateStr so the boundary is consistent everywhere.

/** Hour at which the logical day rolls over (local). Before this hour, an
 *  instant belongs to the previous calendar date. */
export const DAY_CUTOFF_HOUR = 5;

/** Local YYYY-MM-DD of the *logical* day for `d` (defaults to now). Instants
 *  before DAY_CUTOFF_HOUR map back to the previous calendar date. */
export function logicalDateStr(d: Date = new Date()): string {
  const shifted = new Date(d);
  if (shifted.getHours() < DAY_CUTOFF_HOUR) {
    shifted.setDate(shifted.getDate() - 1);
  }
  return localDateStr(shifted);
}

/** A YYYY-MM-DD string shifted by `n` local days (DST-safe; `n` may be negative). */
export function addDays(dateStr: string, n: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

/** Sunday that starts the week containing `dateStr` (defaults to the logical
 *  today). Local. */
export function getWeekStart(dateStr: string = logicalDateStr()): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() - d.getDay()); // getDay() === 0 for Sunday
  return localDateStr(d);
}

/** 7 local date strings Sun..Sat for the week starting at `weekStartSunday`. */
export function getWeekDates(weekStartSunday: string): string[] {
  const base = parseLocalDate(weekStartSunday);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    out.push(localDateStr(d));
  }
  return out;
}
