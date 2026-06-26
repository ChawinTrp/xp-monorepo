export interface GqlRequester {
  request<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
}

export interface XpNode {
  _id: string;
  title: string;
  type: string;
  status?: string | null;
  progress?: number | null;
  description?: string | null;
  mainParent?: string | null;
  parents?: (string | null)[] | null;
  children?: (string | null)[] | null;
  metadata?: Record<string, unknown> | null;
  archived?: boolean | null;
}

export interface CreateNodeInput {
  type: string;
  title: string;
  description?: string;
  mainParent?: string;
  parents?: string[];
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateNodeInput {
  _id: string;
  title?: string;
  description?: string;
  status?: string;
  mainParent?: string;
  parents?: string[];
  metadata?: Record<string, unknown>;
}

const NODE_FIELDS = `_id title type status progress description mainParent parents children metadata archived`;

export class XpClient {
  constructor(private gql: GqlRequester) {}

  async searchNodes(
    term: string,
    allowedTypes?: string[],
    includeArchived = false,
  ): Promise<XpNode[]> {
    const doc = `query($term:String,$allowedTypes:[String!],$includeArchived:Boolean){
      searchNodes(term:$term, allowedTypes:$allowedTypes, includeArchived:$includeArchived){ ${NODE_FIELDS} } }`;
    const r = await this.gql.request<{ searchNodes: XpNode[] }>(doc, {
      term,
      allowedTypes,
      includeArchived,
    });
    return r.searchNodes;
  }

  async getNode(id: string): Promise<XpNode> {
    const doc = `query($id:String!){ node(id:$id){ ${NODE_FIELDS} } }`;
    const r = await this.gql.request<{ node: XpNode }>(doc, { id });
    return r.node;
  }

  async createNode(input: CreateNodeInput): Promise<XpNode> {
    const doc = `mutation($input:CreateNodeInput!){ createNode(createNodeInput:$input){ ${NODE_FIELDS} } }`;
    const r = await this.gql.request<{ createNode: XpNode }>(doc, { input });
    return r.createNode;
  }

  async updateNode(input: UpdateNodeInput): Promise<XpNode> {
    const doc = `mutation($input:UpdateNodeInput!){ updateNode(updateNodeInput:$input){ ${NODE_FIELDS} } }`;
    const r = await this.gql.request<{ updateNode: XpNode }>(doc, { input });
    return r.updateNode;
  }

  async archiveNode(id: string): Promise<XpNode> {
    const doc = `mutation($id:ID!){ archiveNode(id:$id){ ${NODE_FIELDS} } }`;
    const r = await this.gql.request<{ archiveNode: XpNode }>(doc, { id });
    return r.archiveNode;
  }

  async unarchiveNode(id: string): Promise<XpNode> {
    const doc = `mutation($id:ID!){ unarchiveNode(id:$id){ ${NODE_FIELDS} } }`;
    const r = await this.gql.request<{ unarchiveNode: XpNode }>(doc, { id });
    return r.unarchiveNode;
  }

  async completeTask(id: string, completedDate?: string): Promise<XpNode[]> {
    const doc = `mutation($input:CompleteTaskInput!){ completeTask(completeTaskInput:$input){ ${NODE_FIELDS} } }`;
    const r = await this.gql.request<{ completeTask: XpNode[] }>(doc, {
      input: { id, completedDate },
    });
    return r.completeTask;
  }

  async checkInRoutine(id: string): Promise<XpNode[]> {
    const doc = `mutation($id:ID!){ checkInRoutine(id:$id){ ${NODE_FIELDS} } }`;
    const r = await this.gql.request<{ checkInRoutine: XpNode[] }>(doc, { id });
    return r.checkInRoutine;
  }

  async startTaskTimer(id: string): Promise<XpNode> {
    const doc = `mutation($id:ID!){ startTaskTimer(id:$id){ ${NODE_FIELDS} } }`;
    const r = await this.gql.request<{ startTaskTimer: XpNode }>(doc, { id });
    return r.startTaskTimer;
  }

  async stopTaskTimer(id: string): Promise<XpNode> {
    const doc = `mutation($id:ID!){ stopTaskTimer(id:$id){ ${NODE_FIELDS} } }`;
    const r = await this.gql.request<{ stopTaskTimer: XpNode }>(doc, { id });
    return r.stopTaskTimer;
  }
}
