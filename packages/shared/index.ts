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

export function dayWon(routinesCheckedIn: number, tasksCompleted: number): boolean {
  return (
    routinesCheckedIn >= WIN_RULES.routineThreshold &&
    tasksCompleted >= WIN_RULES.taskThreshold
  );
}

export function weekWon(wonDaysCount: number): boolean {
  return wonDaysCount >= WIN_RULES.weekTarget;
}

export function getWeekDates(weekStartSunday: string): string[] {
  const result: string[] = [];
  const base = new Date(weekStartSunday);
  for (let i = 0; i < 7; i++) {
    result.push(new Date(base.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  }
  return result;
}
