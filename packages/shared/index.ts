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
