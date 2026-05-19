export const NODE_TYPES = ['DOMAIN', 'SKILL', 'PROJECT', 'TASK', 'PERSON', 'TAG', 'ROUTINE'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface XPNode {
  _id: string;
  title: string;
  type: NodeType;
  mainParent?: string | null;
  parents?: string[];
  children?: string[];
  status?: TaskStatus | null;
  progress?: number | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export const TYPE_COLORS: Record<string, string> = {
  DOMAIN: 'var(--c-domain)',
  SKILL: 'var(--c-skill)',
  PROJECT: 'var(--c-project)',
  TASK: 'var(--c-task)',
  PERSON: 'var(--c-person)',
  TAG: 'var(--c-tag)',
  ROUTINE: 'var(--c-routine)',
};
