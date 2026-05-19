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

export const ALLOWED_MAIN_PARENTS: Record<NodeType, NodeType[] | null> = {
  DOMAIN: ['DOMAIN'],
  SKILL: ['DOMAIN'],
  PROJECT: ['DOMAIN'],
  TASK: ['PROJECT', 'DOMAIN', 'TASK'],
  PERSON: ['DOMAIN'],
  TAG: null,
  ROUTINE: ['DOMAIN'],
};
