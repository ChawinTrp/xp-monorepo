# Auth + Obsidian Sync + GCal Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close XP's documented gaps — API-key auth on the GraphQL API, Phase 10 `ObsidianSyncService` (XP.md §12), and MongoDB persistence for GCal OAuth tokens.

**Architecture:** Global NestJS `ApiKeyGuard` (shared secret, off when `XP_API_KEY` unset); a self-contained `ObsidianModule` that mirrors nodes to the vault as `.md` files (no-op when `OBSIDIAN_VAULT_PATH` unset), hooked fire-and-forget from `NodesService`/`NodesResolver` exactly like the existing GCal pattern; a single-document `gcalstate` collection so tokens survive restarts.

**Tech Stack:** NestJS 11, Mongoose 9, Jest (api: `npm test -w api`), Vitest (mcp-server), React 19 + Apollo Client (web).

**Spec:** `docs/superpowers/specs/2026-07-07-auth-obsidian-sync-design.md`

## Global Constraints

- Branch: `feat/auth-obsidian-sync` (already checked out).
- Sync/side-effect failures must NEVER fail the primary mutation — always fire-and-forget with `.catch()`.
- No new dependencies. `fs/promises` + hand-rolled YAML frontmatter (no yaml lib).
- Tests must not touch the real vault (`C:\Projects\Obsidian\Second Brain`) or real env keys — temp dirs only (`fs.mkdtemp`).
- Env vars introduced: `XP_API_KEY` (api), `OBSIDIAN_VAULT_PATH` (api), `WEB_URL` (api), `XP_API_KEY` (mcp-server env).
- All commands run from repo root `C:\Projects\XP\xp-monorepo`.
- Existing suites must stay green: `npm test -w api`, `npm run test -w packages/mcp-server`.

---

### Task 1: ApiKeyGuard + @Public decorator (API)

**Files:**
- Create: `apps/api/src/auth/public.decorator.ts`
- Create: `apps/api/src/auth/api-key.guard.ts`
- Test: `apps/api/src/auth/api-key.guard.spec.ts`
- Modify: `apps/api/src/app.module.ts` (register APP_GUARD, add GraphQL `context`)
- Modify: `apps/api/src/app.controller.ts` (`@Public()` on class)
- Modify: `apps/api/src/gcal/gcal.controller.ts` (`@Public()` on `callback` handler only)

**Interfaces:**
- Produces: `Public()` decorator (`IS_PUBLIC_KEY = 'isPublic'`), `ApiKeyGuard` (global). Behavior: `XP_API_KEY` unset → all allowed; set → requires `Authorization: Bearer <key>` except `@Public()` routes.

- [ ] **Step 1: Write the failing test**

`apps/api/src/auth/api-key.guard.spec.ts`:

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ApiKeyGuard } from './api-key.guard';

function httpContext(authHeader?: string) {
  return {
    getType: () => 'http',
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authHeader ? { authorization: authHeader } : {},
      }),
    }),
  } as any;
}

describe('ApiKeyGuard', () => {
  const reflector = (isPublic: boolean) =>
    ({ getAllAndOverride: () => isPublic }) as any;

  afterEach(() => {
    delete process.env.XP_API_KEY;
    jest.restoreAllMocks();
  });

  it('allows everything when XP_API_KEY is unset', () => {
    const guard = new ApiKeyGuard(reflector(false));
    expect(guard.canActivate(httpContext())).toBe(true);
  });

  it('allows a request with the correct bearer key', () => {
    process.env.XP_API_KEY = 'secret123';
    const guard = new ApiKeyGuard(reflector(false));
    expect(guard.canActivate(httpContext('Bearer secret123'))).toBe(true);
  });

  it('rejects a missing header', () => {
    process.env.XP_API_KEY = 'secret123';
    const guard = new ApiKeyGuard(reflector(false));
    expect(() => guard.canActivate(httpContext())).toThrow(UnauthorizedException);
  });

  it('rejects a wrong key', () => {
    process.env.XP_API_KEY = 'secret123';
    const guard = new ApiKeyGuard(reflector(false));
    expect(() => guard.canActivate(httpContext('Bearer nope'))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows @Public routes without a key', () => {
    process.env.XP_API_KEY = 'secret123';
    const guard = new ApiKeyGuard(reflector(true));
    expect(guard.canActivate(httpContext())).toBe(true);
  });

  it('reads the request from GraphQL context for graphql requests', () => {
    process.env.XP_API_KEY = 'secret123';
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req: { headers: { authorization: 'Bearer secret123' } } }),
    } as any);
    const ctx = { ...httpContext(), getType: () => 'graphql' };
    const guard = new ApiKeyGuard(reflector(false));
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w api -- api-key.guard`
Expected: FAIL — cannot find module `./api-key.guard`.

- [ ] **Step 3: Write the implementation**

`apps/api/src/auth/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

`apps/api/src/auth/api-key.guard.ts`:

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { timingSafeEqual } from 'crypto';
import { IS_PUBLIC_KEY } from './public.decorator';

// ponytail: shared-secret single-user auth; upgrade to JWT when Phase 11 multi-user lands
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const apiKey = process.env.XP_API_KEY;
    if (!apiKey) return true; // auth disabled (local dev)

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req =
      context.getType<string>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext().req
        : context.switchToHttp().getRequest();

    const header: string | undefined = req?.headers?.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !safeEqual(token, apiKey)) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w api -- api-key.guard`
Expected: 6 passed.

- [ ] **Step 5: Wire the guard globally**

In `apps/api/src/app.module.ts`:
- Add imports: `import { APP_GUARD } from '@nestjs/core';`, `import { ApiKeyGuard } from './auth/api-key.guard';`
- In `GraphQLModule.forRoot<ApolloDriverConfig>({ ... })` add a context factory so the guard can see headers:

```typescript
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req }: { req: unknown }) => ({ req }),
    }),
```

- Add to providers: `{ provide: APP_GUARD, useClass: ApiKeyGuard },`

In `apps/api/src/app.controller.ts`: import `Public` from `./auth/public.decorator` and add `@Public()` directly above `@Controller()` on the class (health check stays open).

In `apps/api/src/gcal/gcal.controller.ts`: import `Public` from `../auth/public.decorator` and add `@Public()` directly above `@Get('callback')` ONLY (Google's browser redirect carries no header; `status` and `auth` stay guarded).

- [ ] **Step 6: Full API suite + build**

Run: `npm test -w api` then `npm run build -w api`
Expected: all suites pass, build clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/auth apps/api/src/app.module.ts apps/api/src/app.controller.ts apps/api/src/gcal/gcal.controller.ts
git commit -m "feat(api): XP_API_KEY bearer-token guard (off when unset)"
```

---

### Task 2: Web — send API key + Settings UI

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/views/Settings.tsx`

**Interfaces:**
- Consumes: API rejects non-`@Public` calls without `Authorization: Bearer <XP_API_KEY>` (Task 1).
- Produces: key persisted in `localStorage['xp_api_key']`; every Apollo + gcal fetch sends it.

- [ ] **Step 1: Attach header in main.tsx**

In `apps/web/src/main.tsx`, above the `client` declaration add:

```typescript
const API_KEY = localStorage.getItem('xp_api_key');
```

and change the link line to:

```typescript
  link: new HttpLink({
    uri: `${API_BASE}/graphql`,
    headers: API_KEY ? { authorization: `Bearer ${API_KEY}` } : undefined,
  }),
```

- [ ] **Step 2: Settings — API key section + gcal fetch headers**

In `apps/web/src/views/Settings.tsx`:

Add below the `API_BASE` constant:

```typescript
const authHeaders = (): Record<string, string> => {
  const k = localStorage.getItem('xp_api_key');
  return k ? { authorization: `Bearer ${k}` } : {};
};
```

Pass `{ headers: authHeaders() }` as the second argument to BOTH existing `fetch` calls (`/gcal/status` and `/gcal/auth`).

Inside the component add state:

```typescript
  const [apiKey, setApiKey] = useState(localStorage.getItem('xp_api_key') ?? '');
  const [keySaved, setKeySaved] = useState(false);

  const saveKey = () => {
    if (apiKey.trim()) localStorage.setItem('xp_api_key', apiKey.trim());
    else localStorage.removeItem('xp_api_key');
    setKeySaved(true);
    // Apollo link captures the key at startup — reload to apply
    setTimeout(() => window.location.reload(), 400);
  };
```

Add this section between the Google Calendar section and the About section (reuse the existing section styling):

```tsx
      {/* API Key */}
      <section className="rounded-xl mb-5" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 20 }}>
        <h2 className="m-0 font-bold mb-1" style={{ fontSize: 15 }}>API Key</h2>
        <div className="text-ctp-subtext1 mb-3" style={{ fontSize: 12 }}>
          Required when the API sets <code style={{ background: 'var(--surface1)', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>XP_API_KEY</code>. Stored in this browser only.
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your XP API key"
            className="flex-1 rounded-lg px-3 py-2"
            style={{ background: 'var(--mantle)', border: '1px solid var(--surface1)', color: 'inherit', fontSize: 13, fontFamily: 'inherit' }}
          />
          <button
            onClick={saveKey}
            className="border-none cursor-pointer rounded-lg px-4 py-2 font-semibold"
            style={{ fontSize: 13, fontFamily: 'inherit', background: 'var(--blue)', color: 'var(--base)' }}
          >
            {keySaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </section>
```

- [ ] **Step 3: Verify build**

Run: `npm run build -w web`
Expected: build succeeds (tsc + vite). No unit test infra exists in web — build is the check.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/main.tsx apps/web/src/views/Settings.tsx
git commit -m "feat(web): API key in Settings, sent as bearer header"
```

---

### Task 3: MCP server — send API key

**Files:**
- Modify: `packages/mcp-server/src/index.ts`

**Interfaces:**
- Consumes: guard from Task 1. Produces: `XP_API_KEY` env → `Authorization` header on the GraphQLClient.

- [ ] **Step 1: Add header**

In `packages/mcp-server/src/index.ts` replace the `gql` construction:

```typescript
  const endpoint = process.env.XP_API_URL ?? 'https://xp-monorepo.onrender.com/graphql';
  const apiKey = process.env.XP_API_KEY;
  const gql = new GraphQLClient(
    endpoint,
    apiKey ? { headers: { authorization: `Bearer ${apiKey}` } } : undefined,
  );
```

- [ ] **Step 2: Verify suite + build**

Run: `npm run test -w packages/mcp-server` then `npm run build -w packages/mcp-server`
Expected: vitest green, tsc clean.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/src/index.ts
git commit -m "feat(mcp): send XP_API_KEY as bearer header"
```

---

### Task 4: GCal token persistence + WEB_URL redirect

**Files:**
- Create: `apps/api/src/gcal/gcal-state.schema.ts`
- Test: `apps/api/src/gcal/gcal.service.spec.ts`
- Modify: `apps/api/src/gcal/gcal.service.ts`
- Modify: `apps/api/src/gcal/gcal.module.ts`
- Modify: `apps/api/src/gcal/gcal.controller.ts` (redirect URL)

**Interfaces:**
- Produces: `GCalState` schema (`{ tokens: object, calendarId?: string }`, collection `gcalstate`, single doc). `GCalService` gains `onModuleInit()` (restore) and `private saveState()`.

- [ ] **Step 1: Schema**

`apps/api/src/gcal/gcal-state.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GCalStateDocument = GCalState & Document;

// ponytail: single-document collection — one Google account, one XP instance
@Schema({ collection: 'gcalstate' })
export class GCalState {
  @Prop({ type: Object, required: false })
  tokens?: Record<string, unknown>;

  @Prop({ required: false })
  calendarId?: string;
}

export const GCalStateSchema = SchemaFactory.createForClass(GCalState);
```

- [ ] **Step 2: Write the failing test**

`apps/api/src/gcal/gcal.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { GCalService } from './gcal.service';
import { Node } from '../nodes/node.entity';
import { GCalState } from './gcal-state.schema';

describe('GCalService state persistence', () => {
  const storedTokens = {
    access_token: 'a',
    refresh_token: 'r',
    expiry_date: 123,
  };

  let stateModel: {
    findOne: jest.Mock;
    updateOne: jest.Mock;
  };

  const makeService = async () => {
    const module = await Test.createTestingModule({
      providers: [
        GCalService,
        { provide: getModelToken(Node.name), useValue: {} },
        { provide: getModelToken(GCalState.name), useValue: stateModel },
      ],
    }).compile();
    return module.get(GCalService);
  };

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    stateModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    jest.restoreAllMocks();
  });

  it('restores tokens + calendarId from DB on init', async () => {
    stateModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ tokens: storedTokens, calendarId: 'cal_1' }),
    });
    const service = await makeService();
    await service.onModuleInit();
    expect(service.isConnected()).toBe(true);
    expect(service.getStatus().calendarId).toBe('cal_1');
  });

  it('stays disconnected when DB has no state', async () => {
    const service = await makeService();
    await service.onModuleInit();
    expect(service.isConnected()).toBe(false);
  });

  it('persists tokens after handleCallback', async () => {
    const service = await makeService();
    await service.onModuleInit();
    jest
      .spyOn((service as any).oauth2Client, 'getToken')
      .mockResolvedValue({ tokens: storedTokens } as any);
    jest
      .spyOn(service as any, 'ensureXPCalendar')
      .mockResolvedValue(undefined);
    await service.handleCallback('code123');
    expect(stateModel.updateOne).toHaveBeenCalledWith(
      {},
      { $set: { tokens: storedTokens, calendarId: null } },
      { upsert: true },
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -w api -- gcal.service`
Expected: FAIL — `GCalState` model missing / `onModuleInit` not a function.

- [ ] **Step 4: Implement in gcal.service.ts**

- Add imports: `OnModuleInit` from `@nestjs/common`; `GCalState, GCalStateDocument` from `./gcal-state.schema`.
- Class declaration: `export class GCalService implements OnModuleInit {`
- Constructor gains a second injected model (keep the existing Node model):

```typescript
  constructor(
    @InjectModel(Node.name) private nodeModel: Model<NodeDocument>,
    @InjectModel(GCalState.name) private stateModel: Model<GCalStateDocument>,
  ) {
```

- Add after the constructor:

```typescript
  async onModuleInit(): Promise<void> {
    if (!this.oauth2Client) return;

    const state = await this.stateModel.findOne().exec().catch(() => null);
    if (state?.tokens && (state.tokens as any).refresh_token) {
      this.tokens = state.tokens as unknown as GCalTokens;
      this.calendarId = state.calendarId ?? null;
      this.oauth2Client.setCredentials(this.tokens);
      this.logger.log('Restored Google Calendar tokens from DB');
    }

    // googleapis refreshes access tokens automatically — persist each refresh
    this.oauth2Client.on('tokens', (t) => {
      this.tokens = { ...(this.tokens ?? {}), ...t } as GCalTokens;
      void this.saveState();
    });
  }

  private async saveState(): Promise<void> {
    try {
      await this.stateModel.updateOne(
        {},
        { $set: { tokens: this.tokens, calendarId: this.calendarId } },
        { upsert: true },
      );
    } catch (err: any) {
      this.logger.error(`Failed to persist GCal state: ${err.message}`);
    }
  }
```

- At the end of `handleCallback`, after `await this.ensureXPCalendar();` add `await this.saveState();`

- [ ] **Step 5: Register the schema**

`apps/api/src/gcal/gcal.module.ts` — add `GCalState, GCalStateSchema` to the existing `MongooseModule.forFeature([...])` array:

```typescript
MongooseModule.forFeature([
  { name: Node.name, schema: NodeSchema },
  { name: GCalState.name, schema: GCalStateSchema },
]),
```

(Read the file first; keep whatever is already registered.)

- [ ] **Step 6: WEB_URL redirect**

In `apps/api/src/gcal/gcal.controller.ts` replace the hardcoded redirect:

```typescript
      res.redirect(`${process.env.WEB_URL ?? 'http://localhost:5173'}?gcal=connected`);
```

- [ ] **Step 7: Run tests**

Run: `npm test -w api -- gcal.service` → 3 passed. Then `npm test -w api` → all green.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/gcal
git commit -m "fix(gcal): persist OAuth tokens + calendarId to Mongo; WEB_URL redirect"
```

---

### Task 5: ObsidianSyncService — pure builders (slugify, paths, content)

**Files:**
- Create: `apps/api/src/obsidian/obsidian-sync.service.ts`
- Create: `apps/api/src/obsidian/obsidian.module.ts`
- Test: `apps/api/src/obsidian/obsidian-sync.service.spec.ts`

**Interfaces:**
- Produces (used by Tasks 6–7):
  - `slugify(title: string): string` (exported function)
  - `class ObsidianSyncService` — `enabled: boolean` (true iff `OBSIDIAN_VAULT_PATH` set at construction), `buildPath(node): Promise<string>` (vault-relative, `/`-separated), `buildContent(node): Promise<string>`.
  - Path rules: TAG → `_tags/{slug}_{id}.md`; DOMAIN → `{domainFolderChain}/_index_xp_{id}.md`; everything else → `{nearestDomainAncestorFolder}/{slug}_{id}.md` (vault root if no DOMAIN ancestor). Folder names are the raw DOMAIN titles with `\ / : * ? " < > |` replaced by `_`.
- Consumes: `Node`/`NodeDocument` from `../nodes/node.entity`.

**Design note (deviation from XP.md §12.3, flagged):** PROJECT nodes do NOT become folders — all non-DOMAIN nodes live flat in their nearest DOMAIN ancestor folder. Cuts the rename-cascade complexity; wikilinks still connect everything. `// ponytail:` comment marks it.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/obsidian/obsidian-sync.service.spec.ts` (builders portion — the same file grows in Task 6):

```typescript
import { ObsidianSyncService, slugify } from './obsidian-sync.service';

// Minimal in-memory stand-in for the Mongoose Node model.
export function fakeModel(nodes: any[]) {
  const byId = new Map(nodes.map((n) => [String(n._id), n]));
  return {
    findById: (id: string) => ({
      exec: async () => byId.get(String(id)) ?? null,
    }),
    find: (query: any = {}) => ({
      exec: async () => {
        let out = nodes.filter((n) => n.archived !== true);
        if (query._id?.$in) {
          const ids = query._id.$in.map(String);
          out = out.filter((n) => ids.includes(String(n._id)));
        }
        return out;
      },
    }),
    updateOne: () => ({ exec: async () => ({}) }),
  } as any;
}

const id = (hex: string) => hex.padStart(24, '0');

export const work = { _id: id('1'), title: 'Work', type: 'DOMAIN' };
export const dev = { _id: id('2'), title: 'Dev', type: 'DOMAIN', mainParent: id('1') };
export const urgent = { _id: id('3'), title: 'Urgent!', type: 'TAG' };
export const proj = {
  _id: id('4'),
  title: 'Project XP',
  type: 'PROJECT',
  mainParent: id('2'),
  parents: [id('2'), id('3')],
  status: 'IN_PROGRESS',
  progress: 40,
  description: 'The life OS.',
  metadata: { dueDate: '2026-08-01' },
};

export const allNodes = [work, dev, urgent, proj];

function makeService(vault: string, nodes: any[] = allNodes) {
  process.env.OBSIDIAN_VAULT_PATH = vault;
  const svc = new ObsidianSyncService(fakeModel(nodes));
  delete process.env.OBSIDIAN_VAULT_PATH;
  return svc;
}

describe('slugify', () => {
  it('lowercases and collapses special chars to underscores', () => {
    expect(slugify('Project XP')).toBe('project_xp');
    expect(slugify('  Fix bug #42 (API)!  ')).toBe('fix_bug_42_api');
    expect(slugify('!!!')).toBe('untitled');
  });
});

describe('ObsidianSyncService builders', () => {
  it('is disabled when OBSIDIAN_VAULT_PATH is unset', () => {
    delete process.env.OBSIDIAN_VAULT_PATH;
    const svc = new ObsidianSyncService(fakeModel([]));
    expect(svc.enabled).toBe(false);
  });

  it('builds TAG paths under _tags/', async () => {
    const svc = makeService('/vault');
    expect(await svc.buildPath(urgent as any)).toBe(`_tags/urgent_${id('3')}.md`);
  });

  it('builds DOMAIN paths as folder + _index_xp file', async () => {
    const svc = makeService('/vault');
    expect(await svc.buildPath(dev as any)).toBe(`Work/Dev/_index_xp_${id('2')}.md`);
  });

  it('places other nodes flat in the nearest DOMAIN ancestor folder', async () => {
    const svc = makeService('/vault');
    expect(await svc.buildPath(proj as any)).toBe(`Work/Dev/project_xp_${id('4')}.md`);
  });

  it('places nodes with no DOMAIN ancestor at the vault root', async () => {
    const orphan = { _id: id('9'), title: 'Loose Task', type: 'TASK' };
    const svc = makeService('/vault', [...allNodes, orphan]);
    expect(await svc.buildPath(orphan as any)).toBe(`loose_task_${id('9')}.md`);
  });

  it('builds frontmatter + wikilinks + description', async () => {
    const svc = makeService('/vault');
    const content = await svc.buildContent(proj as any);
    expect(content).toContain('---\n');
    expect(content).toContain(`xp_id: ${id('4')}`);
    expect(content).toContain('type: PROJECT');
    expect(content).toContain('title: "Project XP"');
    expect(content).toContain('aliases: ["Project XP"]');
    expect(content).toContain('tags: [urgent]');
    expect(content).toContain('status: IN_PROGRESS');
    expect(content).toContain('dueDate: 2026-08-01');
    expect(content).toContain('# Project XP');
    expect(content).toContain(`[[_index_xp_${id('2')}|Dev]]`);
    expect(content).toContain(`[[urgent_${id('3')}|Urgent!]]`);
    expect(content).toContain('The life OS.');
    expect(content).not.toContain('undefined');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w api -- obsidian-sync`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the builders**

`apps/api/src/obsidian/obsidian-sync.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Node, NodeDocument } from '../nodes/node.entity';

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'untitled'
  );
}

/** Folder segment from a DOMAIN title — keep human-readable, strip fs-illegal chars. */
function folderName(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled';
}

@Injectable()
export class ObsidianSyncService {
  private readonly logger = new Logger(ObsidianSyncService.name);
  readonly vaultPath: string;

  constructor(@InjectModel(Node.name) private nodeModel: Model<NodeDocument>) {
    this.vaultPath = process.env.OBSIDIAN_VAULT_PATH ?? '';
    if (!this.enabled) {
      this.logger.log('OBSIDIAN_VAULT_PATH not set — Obsidian sync disabled');
    }
  }

  get enabled(): boolean {
    return !!this.vaultPath;
  }

  private fileName(node: Node): string {
    return `${slugify(node.title)}_${node._id}.md`;
  }

  /** Folder chain for a DOMAIN node, e.g. "Work/Dev". */
  private async domainFolder(domain: Node): Promise<string> {
    const segments = [folderName(domain.title)];
    let cur: Node | null = domain;
    const seen = new Set<string>([String(domain._id)]);
    while (cur?.mainParent) {
      const parent: Node | null = await this.nodeModel
        .findById(cur.mainParent)
        .exec();
      if (!parent || parent.type !== 'DOMAIN' || seen.has(String(parent._id))) break;
      seen.add(String(parent._id));
      segments.unshift(folderName(parent.title));
      cur = parent;
    }
    return segments.join('/');
  }

  /** Nearest DOMAIN ancestor via the mainParent chain, or null. */
  private async nearestDomain(node: Node): Promise<Node | null> {
    let cur: Node | null = node;
    const seen = new Set<string>([String(node._id)]);
    while (cur?.mainParent) {
      const parent: Node | null = await this.nodeModel
        .findById(cur.mainParent)
        .exec();
      if (!parent || seen.has(String(parent._id))) return null;
      if (parent.type === 'DOMAIN') return parent;
      seen.add(String(parent._id));
      cur = parent;
    }
    return null;
  }

  /** Vault-relative path ("/" separators) for a node's .md file. */
  async buildPath(node: Node): Promise<string> {
    if (node.type === 'TAG') return `_tags/${this.fileName(node)}`;
    if (node.type === 'DOMAIN') {
      // ponytail: DOMAINs are folders; flat files inside (no PROJECT subfolders,
      // unlike XP.md §12.3) — avoids rename cascades. Revisit if folders get huge.
      return `${await this.domainFolder(node)}/_index_xp_${node._id}.md`;
    }
    const domain = await this.nearestDomain(node);
    if (!domain) return this.fileName(node);
    return `${await this.domainFolder(domain)}/${this.fileName(node)}`;
  }

  /** Frontmatter (§12.6) + body (§12.8). Only non-empty fields are written. */
  async buildContent(node: Node): Promise<string> {
    const parentIds = [
      ...new Set(
        [node.mainParent, ...(node.parents ?? [])].filter(Boolean).map(String),
      ),
    ];
    const parentNodes: Node[] = parentIds.length
      ? await this.nodeModel.find({ _id: { $in: parentIds } }).exec()
      : [];
    const tagNames = parentNodes
      .filter((p) => p.type === 'TAG')
      .map((p) => slugify(p.title));

    const meta = (node.metadata ?? {}) as Record<string, unknown>;
    const dueDate = (meta.due ?? meta.dueDate) as string | undefined;
    const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    const fm: string[] = ['---'];
    fm.push(`xp_id: ${node._id}`);
    fm.push(`type: ${node.type}`);
    fm.push(`title: ${q(node.title)}`);
    fm.push(`aliases: [${q(node.title)}]`);
    if (tagNames.length) fm.push(`tags: [${tagNames.join(', ')}]`);
    if (node.status) fm.push(`status: ${node.status}`);
    if (node.progress != null && node.progress !== 0) fm.push(`progress: ${node.progress}`);
    if (node.mainParent) fm.push(`mainParent: ${node.mainParent}`);
    if (node.parents?.length) {
      fm.push('parents:');
      node.parents.forEach((p) => fm.push(`  - ${p}`));
    }
    if (node.children?.length) {
      fm.push('children:');
      node.children.forEach((c) => fm.push(`  - ${c}`));
    }
    if (dueDate) fm.push(`dueDate: ${dueDate}`);
    if (node.updatedAt) fm.push(`updatedAt: ${new Date(node.updatedAt).toISOString()}`);
    fm.push('---');

    const links = await Promise.all(
      parentNodes.map(async (p) => {
        const target = (await this.buildPath(p)).split('/').pop()!.replace(/\.md$/, '');
        return `[[${target}|${p.title}]]`;
      }),
    );

    const body: string[] = ['', `# ${node.title}`];
    if (links.length) body.push('', links.join('  '));
    if (node.description) body.push('', node.description);
    body.push('');

    return fm.join('\n') + body.join('\n');
  }
}
```

`apps/api/src/obsidian/obsidian.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Node, NodeSchema } from '../nodes/node.entity';
import { ObsidianSyncService } from './obsidian-sync.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Node.name, schema: NodeSchema }])],
  providers: [ObsidianSyncService],
  exports: [ObsidianSyncService],
})
export class ObsidianModule {}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w api -- obsidian-sync`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/obsidian
git commit -m "feat(obsidian): sync service skeleton — slugify, path + content builders"
```

---

### Task 6: ObsidianSyncService — file lifecycle (upsert, delete, indexes, syncAll)

**Files:**
- Modify: `apps/api/src/obsidian/obsidian-sync.service.ts`
- Test: `apps/api/src/obsidian/obsidian-sync.service.spec.ts` (append a describe block)

**Interfaces:**
- Produces (used by Task 7):
  - `upsertNode(node: Node): Promise<void>` — writes/rewrites the file; deletes the old file if the path changed; persists `obsidianPath`; regenerates the folder index. Archived nodes are treated as deletes.
  - `upsertMany(nodes: Node[]): Promise<void>` — loop over `upsertNode`, error-safe.
  - `deleteNode(node: Node): Promise<void>` — removes the file + regenerates index.
  - `syncAll(): Promise<void>` — full vault rebuild: upsert every live node, regenerate all touched indexes, delete stale `*_{24-hex}.md` files whose id is no longer live.
  - `regenerateIndex(domainFolder: string): Promise<void>` — rebuilds `_xp_index.md` from the `*_{id}.md` files present in that folder. Never touches `_index.md`.
- Consumes: builders from Task 5.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/obsidian/obsidian-sync.service.spec.ts` (reuses `fakeModel`, `allNodes`, `proj`, `dev`, `id` from Task 5's portion — export them if not already):

```typescript
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('ObsidianSyncService file lifecycle', () => {
  let vault: string;

  beforeEach(async () => {
    vault = await fs.mkdtemp(path.join(os.tmpdir(), 'xp-vault-'));
  });

  afterEach(async () => {
    await fs.rm(vault, { recursive: true, force: true });
  });

  const svcWith = (nodes: any[]) => {
    process.env.OBSIDIAN_VAULT_PATH = vault;
    const svc = new ObsidianSyncService(fakeModel(nodes));
    delete process.env.OBSIDIAN_VAULT_PATH;
    return svc;
  };

  const exists = (rel: string) =>
    fs.access(path.join(vault, rel)).then(() => true, () => false);

  it('upsertNode writes the file and regenerates the index', async () => {
    const svc = svcWith(allNodes);
    await svc.upsertNode(proj as any);
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(true);
    const index = await fs.readFile(path.join(vault, 'Work/Dev/_xp_index.md'), 'utf8');
    expect(index).toContain('auto_generated: true');
    expect(index).toContain(`[[project_xp_${id('4')}|Project XP]]`);
  });

  it('upsertNode moves the file when the path changed', async () => {
    const moved = { ...proj, obsidianPath: 'Old/project_xp_' + id('4') + '.md' };
    await fs.mkdir(path.join(vault, 'Old'), { recursive: true });
    await fs.writeFile(path.join(vault, moved.obsidianPath), 'stale');
    const svc = svcWith([...allNodes.filter((n) => n !== proj), moved]);
    await svc.upsertNode(moved as any);
    expect(await exists(moved.obsidianPath)).toBe(false);
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(true);
  });

  it('upsertNode of an archived node deletes its file', async () => {
    const svc = svcWith(allNodes);
    await svc.upsertNode(proj as any);
    await svc.upsertNode({ ...proj, archived: true } as any);
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(false);
  });

  it('deleteNode removes the file', async () => {
    const svc = svcWith(allNodes);
    await svc.upsertNode(proj as any);
    await svc.deleteNode(proj as any);
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(false);
  });

  it('never touches the manual _index.md', async () => {
    await fs.mkdir(path.join(vault, 'Work/Dev'), { recursive: true });
    await fs.writeFile(path.join(vault, 'Work/Dev/_index.md'), 'my MOC');
    const svc = svcWith(allNodes);
    await svc.upsertNode(proj as any);
    expect(await fs.readFile(path.join(vault, 'Work/Dev/_index.md'), 'utf8')).toBe('my MOC');
  });

  it('syncAll writes every live node and removes stale xp files', async () => {
    await fs.writeFile(
      path.join(vault, `ghost_${'f'.repeat(24)}.md`),
      'stale xp file',
    );
    await fs.writeFile(path.join(vault, 'My handwritten note.md'), 'keep me');
    const svc = svcWith(allNodes);
    await svc.syncAll();
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(true);
    expect(await exists(`_tags/urgent_${id('3')}.md`)).toBe(true);
    expect(await exists(`Work/Dev/_index_xp_${id('2')}.md`)).toBe(true);
    expect(await exists(`ghost_${'f'.repeat(24)}.md`)).toBe(false);
    expect(await exists('My handwritten note.md')).toBe(true);
  });

  it('all operations are no-ops when disabled', async () => {
    delete process.env.OBSIDIAN_VAULT_PATH;
    const svc = new ObsidianSyncService(fakeModel(allNodes));
    await svc.upsertNode(proj as any);
    await svc.syncAll();
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w api -- obsidian-sync`
Expected: FAIL — `upsertNode is not a function`.

- [ ] **Step 3: Implement the lifecycle methods**

Add to `ObsidianSyncService` (imports at top: `import { promises as fs } from 'fs';` and `import * as path from 'path';`):

```typescript
  private abs(rel: string): string {
    return path.join(this.vaultPath, rel);
  }

  async upsertNode(node: Node): Promise<void> {
    if (!this.enabled) return;
    try {
      if (node.archived) return await this.deleteNode(node);

      const newPath = await this.buildPath(node);
      const oldPath = node.obsidianPath;
      if (oldPath && oldPath !== newPath) {
        await fs.rm(this.abs(oldPath), { force: true });
        await this.regenerateIndex(path.posix.dirname(oldPath));
      }

      await fs.mkdir(path.dirname(this.abs(newPath)), { recursive: true });
      await fs.writeFile(this.abs(newPath), await this.buildContent(node), 'utf8');

      if (oldPath !== newPath) {
        await this.nodeModel
          .updateOne({ _id: node._id }, { obsidianPath: newPath }, { timestamps: false })
          .exec();
      }
      await this.regenerateIndex(path.posix.dirname(newPath));
    } catch (err: any) {
      this.logger.error(`Obsidian upsert failed for "${node.title}": ${err.message}`);
    }
  }

  async upsertMany(nodes: Node[]): Promise<void> {
    for (const n of nodes) await this.upsertNode(n);
  }

  async deleteNode(node: Node): Promise<void> {
    if (!this.enabled) return;
    try {
      const rel = node.obsidianPath ?? (await this.buildPath(node));
      await fs.rm(this.abs(rel), { force: true });
      await this.regenerateIndex(path.posix.dirname(rel));
    } catch (err: any) {
      this.logger.error(`Obsidian delete failed for "${node.title}": ${err.message}`);
    }
  }

  /** Rebuild _xp_index.md from the xp files actually present in the folder. */
  async regenerateIndex(domainFolder: string): Promise<void> {
    if (!this.enabled) return;
    const folder = domainFolder === '.' ? '' : domainFolder;
    if (folder === '_tags') return; // tag pages don't get an index
    let files: string[];
    try {
      files = await fs.readdir(this.abs(folder));
    } catch {
      return;
    }
    const idRe = /_([0-9a-f]{24})\.md$/;
    const ids = files
      .map((f) => idRe.exec(f)?.[1])
      .filter((x): x is string => !!x);
    if (ids.length === 0) {
      await fs.rm(this.abs(path.posix.join(folder, '_xp_index.md')), { force: true });
      return;
    }
    const nodes = await this.nodeModel
      .find({ _id: { $in: ids }, archived: { $ne: true } })
      .exec();

    const groups = new Map<string, Node[]>();
    for (const n of nodes) {
      const list = groups.get(n.type) ?? [];
      list.push(n);
      groups.set(n.type, list);
    }
    const heading: Record<string, string> = {
      DOMAIN: 'Domains', SKILL: 'Skills', PROJECT: 'Projects', TASK: 'Tasks',
      PERSON: 'People', TAG: 'Tags', ROUTINE: 'Routines',
    };
    const lines = [
      '---',
      'auto_generated: true',
      `domain: ${folder.split('/').pop() || 'Vault Root'}`,
      `updated: ${new Date().toISOString()}`,
      '---',
      '',
      `# XP Index — ${folder.split('/').pop() || 'Vault Root'}`,
    ];
    for (const type of Object.keys(heading)) {
      const list = groups.get(type);
      if (!list?.length) continue;
      lines.push('', `## ${heading[type]}`);
      for (const n of list.sort((a, b) => a.title.localeCompare(b.title))) {
        const file = (await this.buildPath(n)).split('/').pop()!.replace(/\.md$/, '');
        const extras = [
          n.status,
          (n.metadata as any)?.due ?? (n.metadata as any)?.dueDate
            ? `due ${(n.metadata as any).due ?? (n.metadata as any).dueDate}`
            : undefined,
        ].filter(Boolean);
        lines.push(`- [[${file}|${n.title}]]${extras.length ? ' · ' + extras.join(' · ') : ''}`);
      }
    }
    lines.push('');
    await fs.writeFile(this.abs(path.posix.join(folder, '_xp_index.md')), lines.join('\n'), 'utf8');
  }

  /** Full vault rebuild — bootstrap + recovery. Safe for hand-written notes. */
  async syncAll(): Promise<void> {
    if (!this.enabled) return;
    const nodes = await this.nodeModel.find({ archived: { $ne: true } }).exec();
    const liveIds = new Set(nodes.map((n) => String(n._id)));
    const folders = new Set<string>();

    for (const node of nodes) {
      try {
        const rel = await this.buildPath(node);
        await fs.mkdir(path.dirname(this.abs(rel)), { recursive: true });
        await fs.writeFile(this.abs(rel), await this.buildContent(node), 'utf8');
        if (node.obsidianPath !== rel) {
          await this.nodeModel
            .updateOne({ _id: node._id }, { obsidianPath: rel }, { timestamps: false })
            .exec();
        }
        folders.add(path.posix.dirname(rel));
      } catch (err: any) {
        this.logger.error(`syncAll failed for "${node.title}": ${err.message}`);
      }
    }

    // Remove stale xp files ({anything}_{24hex}.md with a dead id). Hand-written
    // notes never match the pattern, so they are never touched.
    await this.removeStale('', liveIds, folders);
    for (const f of folders) await this.regenerateIndex(f);
    this.logger.log(`Obsidian vault synced: ${nodes.length} nodes`);
  }

  private async removeStale(
    relFolder: string,
    liveIds: Set<string>,
    touchedFolders: Set<string>,
  ): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(this.abs(relFolder), { withFileTypes: true });
    } catch {
      return;
    }
    const idRe = /_([0-9a-f]{24})\.md$/;
    for (const e of entries) {
      const rel = relFolder ? path.posix.join(relFolder, e.name) : e.name;
      if (e.isDirectory()) {
        if (e.name.startsWith('.')) continue;
        await this.removeStale(rel, liveIds, touchedFolders);
      } else {
        const m = idRe.exec(e.name);
        if (m && !liveIds.has(m[1])) {
          await fs.rm(this.abs(rel), { force: true });
          touchedFolders.add(relFolder === '' ? '.' : relFolder);
        }
      }
    }
  }
```

Note: `regenerateIndex('.')` / root folder — `path.posix.dirname('file.md')` returns `'.'`; the method already maps `'.'` → `''`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w api -- obsidian-sync`
Expected: all pass (builders + lifecycle).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/obsidian
git commit -m "feat(obsidian): file lifecycle — upsert/delete, _xp_index, syncAll with stale cleanup"
```

---

### Task 7: Wire Obsidian sync into mutations

**Files:**
- Modify: `apps/api/src/nodes/nodes.module.ts` (import `ObsidianModule`)
- Modify: `apps/api/src/nodes/nodes.service.ts` (inject + call)
- Modify: `apps/api/src/nodes/nodes.resolver.ts` (inject + call after propagation mutations)
- Modify: `apps/api/src/nodes/nodes.service.spec.ts`, `apps/api/src/nodes/nodes.resolver.spec.ts` (provide a stub)
- Modify: `apps/api/src/app.module.ts` — no change needed (ObsidianModule arrives via NodesModule)

**Interfaces:**
- Consumes: `ObsidianSyncService.upsertNode / upsertMany / deleteNode / syncAll` (Task 6).
- Rule: every call is fire-and-forget: `void this.obsidianSync.X(...).catch(() => {})` — a broken vault path must never fail a mutation. (upsertNode already catches internally; the `.catch` is belt-and-braces for programming errors.)

- [ ] **Step 1: Module wiring**

`nodes.module.ts`: add `import { ObsidianModule } from '../obsidian/obsidian.module';` and `ObsidianModule` to `imports`.

- [ ] **Step 2: NodesService hooks**

Inject: `private obsidianSync: ObsidianSyncService` (import from `../obsidian/obsidian-sync.service`). Then:

- `create()` — before `return node;` add:
  ```typescript
  void this.obsidianSync.upsertNode(node).catch(() => {});
  ```
- `update()` — before `return updatedNode;` add:
  ```typescript
  if (
    updatedNode.type === 'DOMAIN' &&
    (input.title !== undefined || input.mainParent !== undefined)
  ) {
    // Domain rename/move shifts every descendant path — brute-force full resync.
    void this.obsidianSync.syncAll().catch(() => {});
  } else {
    void this.obsidianSync.upsertNode(updatedNode).catch(() => {});
  }
  ```
- `remove()` — before `return node;` add:
  ```typescript
  void this.obsidianSync.deleteNode(node).catch(() => {});
  ```
- `archive()` — before `return node;` add: `void this.obsidianSync.upsertNode(node).catch(() => {});` (node has `archived: true` → upsert deletes the file)
- `unarchive()` — before `return node;` add: `void this.obsidianSync.upsertNode(node).catch(() => {});`

- [ ] **Step 3: Resolver hooks for propagation mutations**

In `nodes.resolver.ts`, inject `private readonly obsidianSync: ObsidianSyncService` and make the propagation mutations async so the returned nodes also land in the vault:

```typescript
  @Mutation(() => [Node])
  async completeTask(@Args('completeTaskInput') completeTaskInput: CompleteTaskInput) {
    const nodes = await this.propagationService.onTaskCompleted(completeTaskInput);
    void this.obsidianSync.upsertMany(nodes).catch(() => {});
    return nodes;
  }

  @Mutation(() => [Node])
  async checkInRoutine(@Args('id', { type: () => ID }) id: string) {
    const nodes = await this.propagationService.checkInRoutine(id);
    void this.obsidianSync.upsertMany(nodes).catch(() => {});
    return nodes;
  }

  @Mutation(() => [Node])
  async undoCheckInRoutine(@Args('id', { type: () => ID }) id: string) {
    const nodes = await this.propagationService.undoCheckInRoutine(id);
    void this.obsidianSync.upsertMany(nodes).catch(() => {});
    return nodes;
  }

  @Mutation(() => [Node])
  async reopenTask(@Args('id', { type: () => ID }) id: string) {
    const nodes = await this.propagationService.reopenTask(id);
    void this.obsidianSync.upsertMany(nodes).catch(() => {});
    return nodes;
  }

  @Mutation(() => Node)
  async startTaskTimer(@Args('id', { type: () => ID }) id: string) {
    const node = await this.propagationService.startTimer(id);
    void this.obsidianSync.upsertNode(node).catch(() => {});
    return node;
  }

  @Mutation(() => Node)
  async stopTaskTimer(@Args('id', { type: () => ID }) id: string) {
    const node = await this.propagationService.stopTimer(id);
    void this.obsidianSync.upsertNode(node).catch(() => {});
    return node;
  }
```

- [ ] **Step 4: Fix existing specs**

`nodes.service.spec.ts` and `nodes.resolver.spec.ts` construct testing modules — add to their `providers` array:

```typescript
        {
          provide: ObsidianSyncService,
          useValue: {
            upsertNode: jest.fn().mockResolvedValue(undefined),
            upsertMany: jest.fn().mockResolvedValue(undefined),
            deleteNode: jest.fn().mockResolvedValue(undefined),
            syncAll: jest.fn().mockResolvedValue(undefined),
          },
        },
```

(with `import { ObsidianSyncService } from '../obsidian/obsidian-sync.service';`). Read each spec first and match its existing mock style (they already stub `GCalService` the same way).

- [ ] **Step 5: Full suite + build**

Run: `npm test -w api` then `npm run build -w api`
Expected: all green, clean build.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/nodes apps/api/src/obsidian
git commit -m "feat(obsidian): fire-and-forget sync on every node mutation"
```

---

### Task 8: Docs + spec truth-up

**Files:**
- Modify: `XP.md` (§9 roadmap, §11 audit log, §12 note)
- Modify: `docs/DEPLOYMENT.md` (env var table)
- Modify: `docs/superpowers/specs/2026-07-07-auth-obsidian-sync-design.md` (PROJECT-folder simplification)

**Steps:**

- [ ] **Step 1: XP.md**
  - §9: change Phase 10 line to `✅ **Phase 10: Obsidian Sync** — ObsidianSyncService one-way push (§12), enabled via OBSIDIAN_VAULT_PATH (local only; Render no-op). Simplification: PROJECTs stay flat files (no project subfolders).` and Phase 11 line to `🔜 **Phase 11: Multi-user** — JWT auth, collaborative access. (Interim: XP_API_KEY bearer guard shipped 2026-07-07.)`
  - §11 Audit Log: replace the "GCal token persistence" bullet with a note that tokens now persist in `gcalstate`; replace the "Obsidian sync … not yet implemented" bullet with implemented-note; replace "No auth" bullet with: static `XP_API_KEY` bearer guard (single-user); JWT/multi-user still Phase 11.
  - §12.3: add one line noting the implemented deviation — PROJECT nodes do not become folders; all non-DOMAIN nodes are flat files in their nearest DOMAIN folder.
- [ ] **Step 2: DEPLOYMENT.md** — add to the Render env-var list: `XP_API_KEY` (optional — enables auth; paste the same key into the web Settings page and Claude Desktop MCP env), `WEB_URL` (`https://xp-monorepo-web.vercel.app`, used for the GCal OAuth redirect). Note that `OBSIDIAN_VAULT_PATH` is local-dev only.
- [ ] **Step 3: Update the design spec** — in §2, change the path-rules line to match the implementation (PROJECTs flat, no `_index_xp_` for projects; DOMAINs only).
- [ ] **Step 4: Commit**

```bash
git add XP.md docs/DEPLOYMENT.md docs/superpowers/specs/2026-07-07-auth-obsidian-sync-design.md
git commit -m "docs: Phase 10 + API-key auth shipped; env vars; audit log updates"
```

---

### Task 9: End-to-end verification (local)

**No new files.** Manual verification against a scratch vault — NEVER the real vault.

- [ ] **Step 1:** Create a scratch vault dir and start the API with auth + sync enabled (PowerShell):

```powershell
$env:XP_API_KEY = 'e2e-test-key'
$env:OBSIDIAN_VAULT_PATH = "$env:TEMP\xp-e2e-vault"
New-Item -ItemType Directory -Force "$env:TEMP\xp-e2e-vault"
npm run start:dev -w api
```

- [ ] **Step 2:** No key → rejected. `POST http://localhost:3000/graphql` with body `{"query":"{ nodes { _id } }"}` and no Authorization header → response contains `Unauthorized`/401.
- [ ] **Step 3:** With `Authorization: Bearer e2e-test-key` → returns node data.
- [ ] **Step 4:** Startup `syncAll` populated the scratch vault — folders per DOMAIN, `_xp_index.md` files present.
- [ ] **Step 5:** `createNode` mutation (a TASK titled `e2e sync probe`) with the key → `.md` file appears; then `deleteNode` it → file gone.
- [ ] **Step 6:** `GET /gcal/status` without key → 401; `GET /` (health) without key → 200.
- [ ] **Step 7:** Stop the API. Report results; no commit unless fixes were needed.
