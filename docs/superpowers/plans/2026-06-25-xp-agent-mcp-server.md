# XP Agent MCP Server (Approach A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local stdio MCP server that lets Claude read and safely mutate live XP data (read + create/update + soft-delete), reusing XP's existing GraphQL API.

**Architecture:** Approach A from `docs/superpowers/specs/2026-06-25-xp-agent-mcp-server-design.md`. Two parts: (A) a small soft-delete/archive addition to the NestJS API (prerequisite — XP only has hard-delete today); (B) a new `packages/mcp-server` workspace that talks to XP's GraphQL endpoint and exposes hybrid tools (CRUD primitives + semantic actions). Guardrails (no hard-delete tool, field whitelist, per-type metadata validation) live in the MCP tool layer.

**Tech Stack:** Part A — NestJS v11, Mongoose, GraphQL Code-First, Jest. Part B — TypeScript (ESM), `@modelcontextprotocol/sdk`, `graphql-request`, `zod`, Vitest.

---

## File Structure

**Part A — API (modify existing):**
- `apps/api/src/nodes/node.entity.ts` — add `archived` field.
- `apps/api/src/nodes/nodes.service.ts` — add `archive`/`unarchive`; filter archived from `findAll`/`searchNodes`.
- `apps/api/src/nodes/nodes.resolver.ts` — add `archiveNode`/`unarchiveNode` mutations; add `includeArchived` arg to `nodes`/`searchNodes`.
- `apps/api/src/nodes/nodes.service.spec.ts` — replace stub with real mocked-model tests.

**Part B — new `packages/mcp-server/`:**
- `package.json`, `tsconfig.json`, `vitest.config.ts` — package setup.
- `src/xp-client.ts` — `XpClient`: typed wrapper over `graphql-request`. One method per XP operation.
- `src/validation.ts` — `validateMetadata(type, metadata)`: per-type metadata guard.
- `src/tools.ts` — `toolDefinitions`: array of `{name, description, inputSchema, handler}`. The testable core.
- `src/server.ts` — `buildServer(client)`: registers every tool definition on an `McpServer`.
- `src/index.ts` — entrypoint: read env, build `XpClient`, connect `StdioServerTransport`.
- `test/xp-client.test.ts`, `test/validation.test.ts`, `test/tools.test.ts` — Vitest suites.

> All commits happen inside the `xp-monorepo` git repo. **Do not `git push`** — pushing `main` auto-deploys the API to Render. Pushing is CT's explicit step after review.

---

## PART A — Backend soft-delete (archive)

### Task A1: Add `archived` field + service archive/unarchive + read filter

**Files:**
- Modify: `apps/api/src/nodes/node.entity.ts`
- Modify: `apps/api/src/nodes/nodes.service.ts`
- Test: `apps/api/src/nodes/nodes.service.spec.ts`

- [ ] **Step 1: Replace the stub spec with a mocked-model setup + failing archive tests**

Replace the entire contents of `apps/api/src/nodes/nodes.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { Node } from './node.entity';
import { PropagationService } from './propagation.service';
import { GCalService } from '../gcal/gcal.service';

const execWith = <T>(value: T) => ({ exec: () => Promise.resolve(value) });

describe('NodesService', () => {
  let service: NodesService;
  let model: {
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
    updateMany: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      updateMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodesService,
        { provide: getModelToken(Node.name), useValue: model },
        { provide: PropagationService, useValue: { onTaskCompleted: jest.fn() } },
        { provide: GCalService, useValue: { isConnected: () => false } },
      ],
    }).compile();

    service = module.get<NodesService>(NodesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('archive() sets archived true and returns the node', async () => {
    const updated = { _id: '1', archived: true } as Node;
    model.findByIdAndUpdate.mockReturnValue(execWith(updated));

    const result = await service.archive('1');

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      '1',
      { archived: true },
      { returnDocument: 'after' },
    );
    expect(result).toEqual(updated);
  });

  it('archive() throws NotFoundException when node is missing', async () => {
    model.findByIdAndUpdate.mockReturnValue(execWith(null));
    await expect(service.archive('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unarchive() sets archived false and returns the node', async () => {
    const updated = { _id: '1', archived: false } as Node;
    model.findByIdAndUpdate.mockReturnValue(execWith(updated));

    const result = await service.unarchive('1');

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      '1',
      { archived: false },
      { returnDocument: 'after' },
    );
    expect(result).toEqual(updated);
  });

  it('findAll() excludes archived by default', async () => {
    model.find.mockReturnValue(execWith([]));
    await service.findAll();
    expect(model.find).toHaveBeenCalledWith({ archived: { $ne: true } });
  });

  it('findAll(true) includes archived', async () => {
    model.find.mockReturnValue(execWith([]));
    await service.findAll(true);
    expect(model.find).toHaveBeenCalledWith({});
  });

  it('searchNodes() excludes archived by default', async () => {
    model.find.mockReturnValue({ limit: () => execWith([]) });
    await service.searchNodes('xp');
    expect(model.find).toHaveBeenCalledWith({
      title: { $regex: 'xp', $options: 'i' },
      archived: { $ne: true },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w api -- nodes.service`
Expected: FAIL — `service.archive is not a function`, and `findAll`/`searchNodes` called without the `archived` filter.

- [ ] **Step 3: Add the `archived` field to the entity**

In `apps/api/src/nodes/node.entity.ts`, add this prop immediately after the `obsidianPath` prop (line ~63):

```typescript
  @Prop({ required: false, default: false })
  @Field(() => Boolean, { nullable: true })
  archived?: boolean;
```

(`Boolean` is a built-in GraphQL scalar — no extra import needed.)

- [ ] **Step 4: Implement archive/unarchive and the read filters in the service**

In `apps/api/src/nodes/nodes.service.ts`:

Replace `findAll`:

```typescript
  async findAll(includeArchived = false): Promise<Node[]> {
    const query = includeArchived ? {} : { archived: { $ne: true } };
    return this.nodeModel.find(query).exec();
  }
```

In `searchNodes`, add the archived filter just before the `return` (after the `allowedTypes` block):

```typescript
    if (!includeArchived) {
      query.archived = { $ne: true };
    }

    return this.nodeModel.find(query).limit(20).exec();
```

Update the `searchNodes` signature to accept the flag:

```typescript
  async searchNodes(
    term: string,
    allowedTypes?: string[],
    includeArchived = false,
  ): Promise<Node[]> {
```

Add these two methods after `remove`:

```typescript
  async archive(id: string): Promise<Node> {
    const node = await this.nodeModel
      .findByIdAndUpdate(id, { archived: true }, { returnDocument: 'after' })
      .exec();
    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }
    return node;
  }

  async unarchive(id: string): Promise<Node> {
    const node = await this.nodeModel
      .findByIdAndUpdate(id, { archived: false }, { returnDocument: 'after' })
      .exec();
    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }
    return node;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w api -- nodes.service`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/nodes/node.entity.ts apps/api/src/nodes/nodes.service.ts apps/api/src/nodes/nodes.service.spec.ts
git commit -m "feat(api): add soft-delete (archived flag, archive/unarchive, read filter)"
```

---

### Task A2: Expose archive mutations + includeArchived args in the resolver

**Files:**
- Modify: `apps/api/src/nodes/nodes.resolver.ts`

- [ ] **Step 1: Add the mutations and query args**

In `apps/api/src/nodes/nodes.resolver.ts`:

Replace the `findAll` query:

```typescript
  @Query(() => [Node], { name: 'nodes' })
  findAll(
    @Args('includeArchived', { type: () => Boolean, nullable: true })
    includeArchived?: boolean,
  ) {
    return this.nodesService.findAll(includeArchived ?? false);
  }
```

Replace the `searchNodes` query:

```typescript
  @Query(() => [Node], { name: 'searchNodes' })
  searchNodes(
    @Args('term', { type: () => String, nullable: true }) term?: string,
    @Args('allowedTypes', { type: () => [String], nullable: 'itemsAndList' })
    allowedTypes?: string[],
    @Args('includeArchived', { type: () => Boolean, nullable: true })
    includeArchived?: boolean,
  ) {
    return this.nodesService.searchNodes(term || '', allowedTypes, includeArchived ?? false);
  }
```

Add these mutations after `deleteNode`:

```typescript
  @Mutation(() => Node)
  archiveNode(@Args('id', { type: () => ID }) id: string) {
    return this.nodesService.archive(id);
  }

  @Mutation(() => Node)
  unarchiveNode(@Args('id', { type: () => ID }) id: string) {
    return this.nodesService.unarchive(id);
  }
```

- [ ] **Step 2: Verify the API builds and the schema is valid**

Run: `npm run build -w api`
Expected: PASS — no TypeScript errors. (Code-First schema generation runs at boot; a clean build confirms decorators are valid.)

- [ ] **Step 3: Run the full API test suite**

Run: `npm test -w api`
Expected: PASS — existing suites plus the new archive tests.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/nodes/nodes.resolver.ts
git commit -m "feat(api): expose archiveNode/unarchiveNode + includeArchived query args"
```

> Backward compatible: `nodes`/`searchNodes` gain optional args; the web app's existing `nodes` query keeps working and now hides archived nodes by default.

---

## PART B — MCP server (`packages/mcp-server`)

### Task B1: Scaffold the package

**Files:**
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/vitest.config.ts`

- [ ] **Step 1: Create `packages/mcp-server/package.json`**

```json
{
  "name": "@xp/mcp-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "xp-mcp": "dist/index.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.18.0",
    "graphql-request": "^7.1.2",
    "graphql": "^16.9.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/mcp-server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/mcp-server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```

- [ ] **Step 4: Install dependencies from the monorepo root**

Run: `npm install`
Expected: PASS — `@xp/mcp-server` registered as a workspace; deps resolved.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/package.json packages/mcp-server/tsconfig.json packages/mcp-server/vitest.config.ts package-lock.json
git commit -m "chore(mcp): scaffold @xp/mcp-server package"
```

---

### Task B2: `XpClient` — typed GraphQL wrapper

**Files:**
- Create: `packages/mcp-server/src/xp-client.ts`
- Test: `packages/mcp-server/test/xp-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/mcp-server/test/xp-client.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { XpClient } from '../src/xp-client.js';

const fakeNode = { _id: '1', title: 'XP', type: 'PROJECT' };

function makeClient(responseKey: string, payload: unknown) {
  const request = vi.fn().mockResolvedValue({ [responseKey]: payload });
  return { client: new XpClient({ request }), request };
}

describe('XpClient', () => {
  it('searchNodes passes variables and unwraps the result', async () => {
    const { client, request } = makeClient('searchNodes', [fakeNode]);
    const result = await client.searchNodes('xp', ['PROJECT'], false);
    expect(result).toEqual([fakeNode]);
    const [doc, vars] = request.mock.calls[0];
    expect(doc).toContain('searchNodes');
    expect(vars).toEqual({ term: 'xp', allowedTypes: ['PROJECT'], includeArchived: false });
  });

  it('getNode passes the id and unwraps node', async () => {
    const { client, request } = makeClient('node', fakeNode);
    const result = await client.getNode('1');
    expect(result).toEqual(fakeNode);
    expect(request.mock.calls[0][1]).toEqual({ id: '1' });
  });

  it('createNode wraps input under createNodeInput', async () => {
    const { client, request } = makeClient('createNode', fakeNode);
    const input = { type: 'TASK', title: 'Ship CI' };
    await client.createNode(input);
    expect(request.mock.calls[0][0]).toContain('createNode');
    expect(request.mock.calls[0][1]).toEqual({ input });
  });

  it('archiveNode passes the id', async () => {
    const { client, request } = makeClient('archiveNode', fakeNode);
    await client.archiveNode('1');
    expect(request.mock.calls[0][0]).toContain('archiveNode');
    expect(request.mock.calls[0][1]).toEqual({ id: '1' });
  });

  it('completeTask passes id + completedDate and unwraps the node array', async () => {
    const { client, request } = makeClient('completeTask', [fakeNode]);
    const result = await client.completeTask('1', '2026-06-25');
    expect(result).toEqual([fakeNode]);
    expect(request.mock.calls[0][1]).toEqual({ input: { id: '1', completedDate: '2026-06-25' } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @xp/mcp-server`
Expected: FAIL — cannot find module `../src/xp-client.js`.

- [ ] **Step 3: Implement `XpClient`**

Create `packages/mcp-server/src/xp-client.ts`:

```typescript
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

  async searchNodes(term: string, allowedTypes?: string[], includeArchived = false): Promise<XpNode[]> {
    const doc = `query($term:String,$allowedTypes:[String!],$includeArchived:Boolean){
      searchNodes(term:$term, allowedTypes:$allowedTypes, includeArchived:$includeArchived){ ${NODE_FIELDS} } }`;
    const r = await this.gql.request<{ searchNodes: XpNode[] }>(doc, { term, allowedTypes, includeArchived });
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
    const r = await this.gql.request<{ completeTask: XpNode[] }>(doc, { input: { id, completedDate } });
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @xp/mcp-server`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/xp-client.ts packages/mcp-server/test/xp-client.test.ts
git commit -m "feat(mcp): add XpClient GraphQL wrapper"
```

---

### Task B3: `validateMetadata` — per-type guard

**Files:**
- Create: `packages/mcp-server/src/validation.ts`
- Test: `packages/mcp-server/test/validation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/mcp-server/test/validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateMetadata } from '../src/validation.js';

describe('validateMetadata', () => {
  it('accepts valid TASK metadata', () => {
    const md = { dueDate: '2026-06-30', priority: 'HIGH', estimatedHours: 3 };
    expect(validateMetadata('TASK', md)).toEqual(md);
  });

  it('rejects TASK estimatedHours of wrong type', () => {
    expect(() => validateMetadata('TASK', { estimatedHours: 'three' })).toThrow(/estimatedHours/);
  });

  it('accepts valid PERSON metadata', () => {
    const md = { email: 'a@b.com', phone: '123' };
    expect(validateMetadata('PERSON', md)).toEqual(md);
  });

  it('passes through unknown extra keys (forward-compatible)', () => {
    const md = { dueDate: '2026-06-30', somethingNew: true };
    expect(validateMetadata('TASK', md)).toEqual(md);
  });

  it('returns undefined when metadata is undefined', () => {
    expect(validateMetadata('TASK', undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @xp/mcp-server -- validation`
Expected: FAIL — cannot find module `../src/validation.js`.

- [ ] **Step 3: Implement `validateMetadata`**

Create `packages/mcp-server/src/validation.ts`:

```typescript
import { z } from 'zod';

// Per-type known fields. `.passthrough()` keeps unknown keys so new XP
// metadata fields don't break the agent before this file is updated.
const schemas: Record<string, z.ZodTypeAny> = {
  TASK: z
    .object({
      dueDate: z.string().optional(),
      priority: z.string().optional(),
      estimatedHours: z.number().optional(),
    })
    .passthrough(),
  PERSON: z
    .object({
      email: z.string().optional(),
      phone: z.string().optional(),
      nextCatchupDate: z.string().optional(),
    })
    .passthrough(),
};

export function validateMetadata(
  type: string,
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (metadata === undefined) return undefined;
  const schema = schemas[type];
  if (!schema) return metadata; // no per-type rules → accept as-is
  return schema.parse(metadata) as Record<string, unknown>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @xp/mcp-server -- validation`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/validation.ts packages/mcp-server/test/validation.test.ts
git commit -m "feat(mcp): add per-type metadata validation"
```

---

### Task B4: `toolDefinitions` — the hybrid tool surface

**Files:**
- Create: `packages/mcp-server/src/tools.ts`
- Test: `packages/mcp-server/test/tools.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/mcp-server/test/tools.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { toolDefinitions } from '../src/tools.js';
import type { XpClient } from '../src/xp-client.js';

const node = { _id: '1', title: 'Ship CI', type: 'TASK' };

function findTool(name: string) {
  const def = toolDefinitions.find((t) => t.name === name);
  if (!def) throw new Error(`tool ${name} not registered`);
  return def;
}

describe('toolDefinitions', () => {
  it('registers the expected hybrid tool set and no hard-delete tool', () => {
    const names = toolDefinitions.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'archive_node',
        'check_in_routine',
        'complete_task',
        'create_node',
        'get_node',
        'search_nodes',
        'start_task_timer',
        'stop_task_timer',
        'unarchive_node',
        'update_node',
      ].sort(),
    );
    expect(names).not.toContain('delete_node');
  });

  it('search_nodes calls the client and returns JSON text', async () => {
    const client = { searchNodes: vi.fn().mockResolvedValue([node]) } as unknown as XpClient;
    const out = await findTool('search_nodes').handler(client, {
      term: 'ci',
      types: ['TASK'],
      includeArchived: false,
    });
    expect(client.searchNodes).toHaveBeenCalledWith('ci', ['TASK'], false);
    expect(JSON.parse(out)).toEqual([node]);
  });

  it('create_node validates metadata then calls the client', async () => {
    const client = { createNode: vi.fn().mockResolvedValue(node) } as unknown as XpClient;
    await findTool('create_node').handler(client, {
      type: 'TASK',
      title: 'Ship CI',
      metadata: { estimatedHours: 2 },
    });
    expect(client.createNode).toHaveBeenCalledWith({
      type: 'TASK',
      title: 'Ship CI',
      metadata: { estimatedHours: 2 },
    });
  });

  it('create_node rejects malformed metadata before calling the client', async () => {
    const client = { createNode: vi.fn() } as unknown as XpClient;
    await expect(
      findTool('create_node').handler(client, {
        type: 'TASK',
        title: 'x',
        metadata: { estimatedHours: 'lots' },
      }),
    ).rejects.toThrow(/estimatedHours/);
    expect(client.createNode).not.toHaveBeenCalled();
  });

  it('update_node maps id to _id and forwards whitelisted fields', async () => {
    const client = { updateNode: vi.fn().mockResolvedValue(node) } as unknown as XpClient;
    await findTool('update_node').handler(client, { id: '1', status: 'DONE' });
    expect(client.updateNode).toHaveBeenCalledWith({ _id: '1', status: 'DONE' });
  });

  it('archive_node calls the client archive method', async () => {
    const client = { archiveNode: vi.fn().mockResolvedValue(node) } as unknown as XpClient;
    await findTool('archive_node').handler(client, { id: '1' });
    expect(client.archiveNode).toHaveBeenCalledWith('1');
  });

  it('complete_task forwards id and optional completedDate', async () => {
    const client = { completeTask: vi.fn().mockResolvedValue([node]) } as unknown as XpClient;
    await findTool('complete_task').handler(client, { id: '1' });
    expect(client.completeTask).toHaveBeenCalledWith('1', undefined);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @xp/mcp-server -- tools`
Expected: FAIL — cannot find module `../src/tools.js`.

- [ ] **Step 3: Implement `toolDefinitions`**

Create `packages/mcp-server/src/tools.ts`:

```typescript
import { z } from 'zod';
import type { ZodRawShape } from 'zod';
import type { XpClient, UpdateNodeInput } from './xp-client.js';
import { validateMetadata } from './validation.js';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (client: XpClient, args: Record<string, any>) => Promise<string>;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

export const toolDefinitions: ToolDef[] = [
  {
    name: 'search_nodes',
    description:
      'Search XP nodes by title (regex, case-insensitive). Optionally filter by type ' +
      '(DOMAIN/SKILL/PROJECT/TASK/PERSON/TAG/ROUTINE). Archived nodes are hidden unless includeArchived is true.',
    inputSchema: {
      term: z.string().optional(),
      types: z.array(z.string()).optional(),
      includeArchived: z.boolean().optional(),
    },
    handler: async (client, args) =>
      json(await client.searchNodes(args.term ?? '', args.types, args.includeArchived ?? false)),
  },
  {
    name: 'get_node',
    description: 'Fetch a single XP node by id, including its connections (mainParent, parents, children).',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.getNode(args.id)),
  },
  {
    name: 'create_node',
    description:
      'Create an XP node. type must be one of DOMAIN/SKILL/PROJECT/TASK/PERSON/TAG/ROUTINE. ' +
      'Type-specific fields go in metadata (e.g. TASK: dueDate, priority, estimatedHours).',
    inputSchema: {
      type: z.enum(['DOMAIN', 'SKILL', 'PROJECT', 'TASK', 'PERSON', 'TAG', 'ROUTINE']),
      title: z.string(),
      description: z.string().optional(),
      mainParent: z.string().optional(),
      parents: z.array(z.string()).optional(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
      metadata: z.record(z.any()).optional(),
    },
    handler: async (client, args) => {
      const metadata = validateMetadata(args.type, args.metadata);
      return json(
        await client.createNode({
          type: args.type,
          title: args.title,
          description: args.description,
          mainParent: args.mainParent,
          parents: args.parents,
          status: args.status,
          metadata,
        }),
      );
    },
  },
  {
    name: 'update_node',
    description:
      'Update editable fields of a node by id. Whitelisted fields only: title, description, status, ' +
      'mainParent, parents, metadata. Cannot delete — use archive_node for removal.',
    inputSchema: {
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
      mainParent: z.string().optional(),
      parents: z.array(z.string()).optional(),
      metadata: z.record(z.any()).optional(),
    },
    handler: async (client, args) => {
      const patch: UpdateNodeInput = { _id: args.id };
      if (args.title !== undefined) patch.title = args.title;
      if (args.description !== undefined) patch.description = args.description;
      if (args.status !== undefined) patch.status = args.status;
      if (args.mainParent !== undefined) patch.mainParent = args.mainParent;
      if (args.parents !== undefined) patch.parents = args.parents;
      if (args.metadata !== undefined) {
        const node = await client.getNode(args.id);
        patch.metadata = validateMetadata(node.type, args.metadata);
      }
      return json(await client.updateNode(patch));
    },
  },
  {
    name: 'archive_node',
    description: 'Soft-delete (archive) a node. Reversible via unarchive_node. This is the ONLY removal tool — hard delete is human-only.',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.archiveNode(args.id)),
  },
  {
    name: 'unarchive_node',
    description: 'Restore a previously archived node.',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.unarchiveNode(args.id)),
  },
  {
    name: 'complete_task',
    description: 'Mark a TASK done and trigger XP propagation (PROJECT/SKILL/DOMAIN progress). Optional completedDate (YYYY-MM-DD).',
    inputSchema: { id: z.string(), completedDate: z.string().optional() },
    handler: async (client, args) => json(await client.completeTask(args.id, args.completedDate)),
  },
  {
    name: 'check_in_routine',
    description: 'Check in a ROUTINE for today (updates streak and credits skill hours).',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.checkInRoutine(args.id)),
  },
  {
    name: 'start_task_timer',
    description: 'Start the work timer on a TASK.',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.startTaskTimer(args.id)),
  },
  {
    name: 'stop_task_timer',
    description: 'Stop the work timer on a TASK and roll up actual hours.',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.stopTaskTimer(args.id)),
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @xp/mcp-server -- tools`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/tools.ts packages/mcp-server/test/tools.test.ts
git commit -m "feat(mcp): add hybrid tool definitions (CRUD primitives + actions)"
```

---

### Task B5: `buildServer` — register tools on an McpServer

**Files:**
- Create: `packages/mcp-server/src/server.ts`

- [ ] **Step 1: Implement `buildServer`**

Create `packages/mcp-server/src/server.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { XpClient } from './xp-client.js';
import { toolDefinitions } from './tools.js';

export function buildServer(client: XpClient): McpServer {
  const server = new McpServer({ name: 'xp-mcp-server', version: '0.1.0' });

  for (const def of toolDefinitions) {
    server.registerTool(
      def.name,
      { description: def.description, inputSchema: def.inputSchema },
      async (args: Record<string, any>) => {
        try {
          const text = await def.handler(client, args);
          return { content: [{ type: 'text' as const, text }] };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { isError: true, content: [{ type: 'text' as const, text: `Error: ${message}` }] };
        }
      },
    );
  }

  return server;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run build -w @xp/mcp-server`
Expected: PASS — no TypeScript errors. (If the SDK's `registerTool` overload rejects the args typing, change the handler signature to `async (args) =>` and let inference apply; the raw-shape schema drives the arg type.)

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/src/server.ts
git commit -m "feat(mcp): buildServer registers tools with error wrapping"
```

---

### Task B6: `index.ts` — stdio entrypoint

**Files:**
- Create: `packages/mcp-server/src/index.ts`

- [ ] **Step 1: Implement the entrypoint**

Create `packages/mcp-server/src/index.ts`:

```typescript
import { GraphQLClient } from 'graphql-request';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { XpClient } from './xp-client.js';
import { buildServer } from './server.js';

async function main() {
  const endpoint =
    process.env.XP_API_URL ?? 'https://xp-monorepo.onrender.com/graphql';
  const gql = new GraphQLClient(endpoint);
  const client = new XpClient(gql);
  const server = buildServer(client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio servers must not write to stdout (it carries the protocol).
  console.error(`xp-mcp-server connected to ${endpoint}`);
}

main().catch((err) => {
  console.error('xp-mcp-server failed to start:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Build the package**

Run: `npm run build -w @xp/mcp-server`
Expected: PASS — emits `packages/mcp-server/dist/index.js`.

- [ ] **Step 3: Smoke-test against a running API**

Start the API in another terminal: `npm run start:dev -w api`
Then: `XP_API_URL=http://localhost:3000/graphql node packages/mcp-server/dist/index.js`
Expected: stderr prints `xp-mcp-server connected to http://localhost:3000/graphql` and the process stays alive on stdio. Ctrl+C to exit.

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-server/src/index.ts
git commit -m "feat(mcp): add stdio entrypoint with XP_API_URL config"
```

---

### Task B7: Wire into Claude + README

**Files:**
- Create: `packages/mcp-server/README.md`

- [ ] **Step 1: Write the README**

Create `packages/mcp-server/README.md`:

```markdown
# @xp/mcp-server

A local MCP (stdio) server that lets Claude read and safely mutate live XP data.

## Scope
- Read: search_nodes, get_node
- Write: create_node, update_node, archive_node, unarchive_node
- Actions: complete_task, check_in_routine, start_task_timer, stop_task_timer

No hard-delete tool — removal is soft (archive) only. Hard delete stays a human action in the web UI.

## Build
    npm install
    npm run build -w @xp/mcp-server

## Configure in Claude Desktop
Add to `claude_desktop_config.json`:

    {
      "mcpServers": {
        "xp": {
          "command": "node",
          "args": ["C:/Projects/XP/xp-monorepo/packages/mcp-server/dist/index.js"],
          "env": { "XP_API_URL": "https://xp-monorepo.onrender.com/graphql" }
        }
      }
    }

Point `XP_API_URL` at `http://localhost:3000/graphql` for local development.

## Note
The XP API has no auth yet (tracked as Phase 11). Guardrails here are agent-behaviour
guardrails (no hard delete, field whitelist, metadata validation), not network auth.
```

- [ ] **Step 2: Final full test run**

Run: `npm test -w @xp/mcp-server`
Expected: PASS — all suites (xp-client, validation, tools).

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/README.md
git commit -m "docs(mcp): add README + Claude Desktop wiring"
```

---

## Self-Review

**Spec coverage:**
- Read + Create/Update + soft-delete scope → Part A (archive) + Tasks B2/B4 (tools). ✓
- Hybrid tools (primitives + actions reusing PropagationService) → Task B4 + `completeTask`/`checkInRoutine`/timer client methods. ✓
- No hard-delete tool → asserted in `tools.test.ts`. ✓
- Per-type metadata validation → Task B3, enforced in create/update handlers. ✓
- Field whitelist on update → `update_node` builds an explicit patch. ✓
- Approach A (thin client over GraphQL, monorepo package, stdio, env-configurable endpoint) → Tasks B1–B6. ✓
- Backend prerequisite (archive, since XP has only hard-delete) → Part A. ✓

**Known deferrals (out of scope, noted in spec §6/§8):**
- Network auth — pre-existing XP gap, Phase 11.
- Obsidian sync (Phase 10) interaction with archived nodes — archive does not yet skip/relocate the `.md`; revisit when Phase 10 lands.
- Archived nodes may still appear as ids inside other nodes' `children` arrays; hidden from views via the read filter, acceptable for v1.

**Type consistency:** `XpClient` method names (`searchNodes`, `getNode`, `createNode`, `updateNode`, `archiveNode`, `unarchiveNode`, `completeTask`, `checkInRoutine`, `startTaskTimer`, `stopTaskTimer`) are used identically in `tools.ts` and both test files. `UpdateNodeInput._id` mapping from tool arg `id` is consistent. Tool names match between `tools.ts` and `tools.test.ts`.
