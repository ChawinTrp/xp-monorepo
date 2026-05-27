# XP — Architecture Decisions, Trade-offs & Lessons Learned

**Purpose:** Learning reference for software design interviews. Every section covers WHAT was decided, WHY it was chosen, WHAT alternatives existed, and WHAT went wrong.

**Project:** XP — a personal life operating system (task/skill/routine tracker with gamified progression).  
**Stack:** NestJS 11 · GraphQL (Code-First) · MongoDB Atlas · React 19 · Vite · Tailwind CSS · Apollo Client  
**Author:** CT · **Timeline:** Jan 2025 – May 2026 (Phases 1–9)

---

## Table of Contents

1. [Data Model — Single Collection Polymorphic Design](#1-data-model)
2. [API Paradigm — Why GraphQL Over REST](#2-api-paradigm)
3. [Database — Why MongoDB Over PostgreSQL](#3-database)
4. [Backend Framework — Why NestJS](#4-backend-framework)
5. [Frontend — Why React + Vite Over Next.js](#5-frontend)
6. [State Management — Apollo Cache as Single Source of Truth](#6-state-management)
7. [Monorepo — npm Workspaces Trade-offs](#7-monorepo)
8. [The Propagation Engine — Graph Traversal Design](#8-propagation-engine)
9. [Timer System — Append-Only Time Entries](#9-timer-system)
10. [The Metadata Bag — Flexibility vs. Type Safety](#10-metadata-bag)
11. [Obsidian Integration — One-Way Push Architecture](#11-obsidian-integration)
12. [OAuth & Third-Party Integration — GCal](#12-oauth-gcal)
13. [Deployment — Container Strategy & Pitfalls](#13-deployment)
14. [Problems Encountered & How They Were Solved](#14-problems)
15. [Security & Risk Audit](#15-security-audit)
16. [What I Would Do Differently (v2 Hindsight)](#16-hindsight)

---

## 1. Data Model — Single Collection Polymorphic Design {#1-data-model}

### The Decision

All entities (DOMAIN, SKILL, PROJECT, TASK, PERSON, TAG, ROUTINE) live in a **single `nodes` collection**. Every document shares the same schema with a `type` discriminator field. Type-specific data lives in a `metadata: Object` bag.

```
nodes collection
├── { type: "DOMAIN", title: "Work", children: [...] }
├── { type: "SKILL",  title: "Backend Dev", metadata: { totalHours: 820, level: "skilled" } }
├── { type: "TASK",   title: "Fix bug",     metadata: { priority: "high", due: "2026-05-20" } }
└── { type: "PERSON", title: "Alice Chen",  metadata: { email: "...", circle: "Close Friends" } }
```

### Why This Design

**The core requirement was a graph.** Nodes connect to other nodes via `parents[]` and `children[]` — a TASK links to a PROJECT which links to a SKILL which links to a DOMAIN. Cross-type connections are first-class (a TASK can also link to SKILLs and TAGs via `parents[]`).

A single collection means:
- **Any node can reference any other node** — no cross-collection joins, no polymorphic lookup tables
- **Graph traversal is simple** — `findById()` always hits the same collection regardless of type
- **The propagation engine** walks up `mainParent` chains without caring about types — it just reads `parent.type` and dispatches

### Alternatives Considered

| Alternative | Why Not |
|---|---|
| **Separate collections** (tasks, skills, projects, etc.) | Graph edges would require cross-collection lookups. Propagation engine would need to know which collection to query at each step. Adds N+1 query risk. |
| **Relational DB with join tables** | `node_edges(from_id, to_id, relationship_type)` would work but adds complexity for a single-user app. PostgreSQL would enforce referential integrity though (MongoDB doesn't). |
| **Graph database** (Neo4j, ArangoDB) | Natural fit for the data model. Overkill for <100 nodes. Hosting cost higher. Fewer learning resources for NestJS integration. **Would be the right choice at scale.** |

### Trade-offs Accepted

- **No schema enforcement per type.** A TASK can be saved without `status` and MongoDB won't complain. Validation is the application's job — and we don't do it (see §15).
- **`metadata` is untyped.** `Record<string, unknown>` means you can put anything in there. Great for flexibility. Terrible for catching bugs at compile time.
- **`children[]` desync.** Adding a parent to node A should add A to the parent's `children[]`. This is done manually in application code — if one write fails, the graph is inconsistent. A relational DB with foreign keys would prevent this.

### Interview Framing

> "We used a single-collection polymorphic document model because the core abstraction is a graph — any node can connect to any other node regardless of type. This made the propagation engine simple (just walk `mainParent` and dispatch on `type`), but we traded away schema enforcement and had to manually maintain bidirectional edges in application code. At scale, I'd evaluate a graph database or add a referential integrity layer."

---

## 2. API Paradigm — Why GraphQL Over REST {#2-api-paradigm}

### The Decision

GraphQL with NestJS Code-First approach. Apollo Server v5.4. Schema generated from TypeScript decorators (`@ObjectType`, `@Field`, `@Resolver`).

### Why GraphQL

1. **The data is a graph.** Nodes have parents, children, metadata. GraphQL's nested query model maps naturally: fetch a node with its children and their children in one query.
2. **Flexible frontend queries.** The Dashboard, Kanban, Graph, and Skills views all need different shapes of the same data. GraphQL lets each view request exactly what it needs.
3. **Code-First with NestJS.** TypeScript classes are the single source of truth for both the schema and the runtime types. No `.graphql` schema files to keep in sync.
4. **Learning goal.** GraphQL + Apollo was a deliberate skill investment.

### Alternatives

| Alternative | Why Not |
|---|---|
| **REST** | Would need 10+ endpoints (`/nodes`, `/nodes/:id`, `/nodes/:id/children`, `/tasks`, `/skills`, etc.). Over-fetching problem: the Dashboard needs different fields than Kanban. |
| **tRPC** | Type-safe RPC — excellent DX. But requires both client and server in TypeScript (which this is), and doesn't have the graph-query expressiveness. Would be a strong choice for the v2 rebuild. |
| **GraphQL Schema-First** | Write `.graphql` files first, generate TypeScript types. Cleaner separation but requires codegen step. Code-First keeps everything in one place. |

### What Went Wrong

**We fetch ALL nodes on every query.** The main `GET_NODES` query returns the entire collection. There's no pagination, no filtering at the query level, no cursor-based fetching. This works fine for ~50 nodes. At 5,000 nodes, the Dashboard would load 5,000 documents to show 5 overdue tasks.

```graphql
# This is what every view calls:
query GetNodes {
  nodes { _id title type mainParent parents children status progress description metadata createdAt updatedAt }
}
```

**In a real system:** You'd have scoped queries (`tasksDueToday`, `skillsByDomain`, `routinesWithStreaks`) that push filtering to the database. The current design treats MongoDB as a dumb store and does all filtering in the frontend.

### Interview Framing

> "GraphQL was the right choice because the data model is inherently a graph — nodes reference other nodes across types. But I made a scalability mistake: instead of writing purpose-built queries per view, I fetched the entire collection and filtered client-side. The fix is straightforward — add scoped resolvers with database-level filtering and cursor-based pagination — but it's a common trap when prototyping with GraphQL."

---

## 3. Database — Why MongoDB Over PostgreSQL {#3-database}

### The Decision

MongoDB Atlas (cloud-hosted) with Mongoose ODM.

### Why MongoDB

1. **Flexible `metadata` field.** Each node type has different metadata (TASK has `due`, `priority`; SKILL has `totalHours`, `level`; PERSON has `email`, `circle`). MongoDB's document model lets `metadata` be any shape without schema migrations.
2. **JSON-native storage.** The frontend sends JSON, GraphQL resolves to JSON, MongoDB stores JSON. No ORM impedance mismatch.
3. **Atlas free tier.** 512MB shared cluster, good enough for a personal app.
4. **Mongoose + NestJS integration.** `@nestjs/mongoose` is mature. Decorators (`@Prop`, `@Schema`) map cleanly to the Code-First GraphQL decorators.

### Why Not PostgreSQL

| PostgreSQL Advantage | Why We Accepted Losing It |
|---|---|
| **Referential integrity** | We manually maintain `children[]` sync. PostgreSQL with `FOREIGN KEY` would prevent orphaned references. We accepted the desync risk. |
| **Structured queries** | `WHERE status = 'DONE' AND due < NOW()` is cleaner than MongoDB's query syntax. But we're not doing complex queries — we fetch everything. |
| **ACID transactions** | Propagation updates multiple documents (task, project, skill, domain). If one fails, the others are already saved. PostgreSQL transactions would make this atomic. We accepted eventual consistency. |
| **Joins** | `parents[]` → lookup parent documents. In PostgreSQL this would be a simple JOIN. In MongoDB it's multiple queries or `$lookup` aggregation. |

### The Honest Answer

**PostgreSQL would have been a better choice for this data model.** The data is relational (nodes reference other nodes), needs referential integrity (parent-child consistency), and benefits from transactions (propagation is a multi-document operation). MongoDB was chosen for developer ergonomics (schemaless metadata) and familiarity, not for architectural fit.

### Interview Framing

> "I chose MongoDB for the flexible metadata field — each node type has different properties and I didn't want to run migrations every time I added a field. In hindsight, PostgreSQL with a JSONB column for metadata would have given me the same flexibility plus referential integrity, transactions for the propagation engine, and proper joins. The trade-off was developer velocity vs. architectural correctness — for a single-user prototype, MongoDB was faster to iterate on."

---

## 4. Backend Framework — Why NestJS {#4-backend-framework}

### The Decision

NestJS v11 with TypeScript. Module-based architecture. Dependency injection. Code-First GraphQL with `@nestjs/graphql`.

### Why NestJS

1. **Structure.** NestJS enforces modules, services, resolvers. This prevents the "god file" problem where Express apps grow into 2000-line route handlers.
2. **GraphQL Code-First.** Decorators on TypeScript classes generate the schema. One source of truth.
3. **Dependency Injection.** Services are injected, not imported. The `PropagationService` is injected into both `NodesService` and `NodesResolver` — easy to test, easy to swap.
4. **Enterprise patterns.** Guards, interceptors, pipes, middleware — all available when needed (auth, validation, logging). We don't use most of them yet, which is a problem (§15).

### Alternatives

| Alternative | Trade-off |
|---|---|
| **Express + Apollo Server** | Less boilerplate. But no DI, no module system, no structure enforcement. Fine for small APIs, harder to maintain as it grows. |
| **Fastify** | Faster than Express (NestJS can use Fastify as HTTP adapter). We didn't need the performance gain for a single-user app. |
| **Go (net/http or Gin)** | Faster runtime, smaller binary, better for Cloud Run cold starts. But no GraphQL Code-First ecosystem comparable to NestJS. Would need schema-first with gqlgen. |

### What We Underused

NestJS has a rich middleware ecosystem that we didn't use:
- **No `ValidationPipe`** — inputs aren't validated (§15)
- **No `AuthGuard`** — no authentication at all
- **No `ThrottlerGuard`** — no rate limiting
- **No interceptors** for logging or error formatting

The framework gave us the tools. We didn't use them.

---

## 5. Frontend — Why React + Vite Over Next.js {#5-frontend}

### The Decision

React 19 + Vite + client-side routing (React Router v7). Pure SPA, no server-side rendering.

### Why Not Next.js

1. **No SEO needed.** This is a personal app behind a login (eventually). Search engines never see it.
2. **No SSR needed.** All data comes from GraphQL. There's no benefit to server-rendering a dashboard that immediately re-fetches from an API.
3. **Simpler deployment.** Vite builds to static files → deploy to Vercel/Netlify as a CDN-served SPA. No Node.js server for SSR.
4. **Faster dev experience.** Vite's HMR is near-instant. Next.js has more moving parts (App Router, Server Components, API routes) that aren't needed here.

### When Next.js Would Be Right

- If XP becomes multi-user with public profiles → SEO matters → SSR/SSG needed
- If we need API routes in the same deployment → Next.js API routes simplify this
- If we want React Server Components for data fetching → reduces client bundle size

### The Bundle Size Problem

The final bundle is **717KB** (218KB gzipped). For a personal app this is fine. For a production app, this is a Lighthouse performance hit. The fix:

```typescript
// Current: everything in one chunk
import Kanban from './views/Kanban';
import Gantt from './views/Gantt';

// Fix: lazy load per route
const Kanban = lazy(() => import('./views/Kanban'));
const Gantt = lazy(() => import('./views/Gantt'));
```

We didn't implement code splitting. Every view loads on first visit even if you only use the Dashboard.

---

## 6. State Management — Apollo Cache as Single Source of Truth {#6-state-management}

### The Decision

No Redux, no Zustand, no React Context for data. Apollo Client's `InMemoryCache` is the single source of truth. `useQuery(GET_NODES)` in a custom `useNodes()` hook provides all data to every component.

```typescript
// The entire app's data layer:
export function useNodes() {
  const { data, loading, error, refetch } = useQuery<NodesData>(GET_NODES);
  const nodes = data?.nodes ?? [];
  // Derived: byId, childrenOf, breadcrumb, byType
  return { nodes, byId, childrenOf, breadcrumb, byType, loading, error, refetch };
}
```

### Why This Works

1. **Single query, single cache.** All views share the same `GET_NODES` result. When the Kanban updates a task status, `refetchQueries: [GET_NODES]` refreshes every view automatically.
2. **No sync bugs.** There's no "Kanban shows DONE but Dashboard still shows IN_PROGRESS" because both read from the same cache.
3. **Simple mental model.** Data flows one way: MongoDB → GraphQL → Apollo Cache → React components.

### Why This Doesn't Scale

1. **Refetch-everything strategy.** Every mutation triggers `refetchQueries: [GET_NODES]`, which re-fetches ALL nodes from the server. With 50 nodes this is <100ms. With 5000 nodes, every task completion triggers a full database scan.
2. **No optimistic updates.** When you drag a Kanban card, the UI waits for the server response before updating. The fix: Apollo's `optimisticResponse` to update the cache immediately and reconcile when the server responds.
3. **Computed data recalculated on every render.** `byId`, `childrenOf`, `byType` are recomputed with `useMemo` on every `nodes` change. For large datasets, you'd want a normalized cache with selective invalidation.

### Alternatives

| Alternative | When to Use |
|---|---|
| **Zustand/Jotai** | When you have local UI state (modals, filters, sidebar state) that doesn't belong in the server cache. We mix these concerns. |
| **TanStack Query + graphql-request** | Lighter than Apollo Client. Better cache invalidation controls. No normalized cache overhead. Good for the v2 rebuild. |
| **Apollo normalized cache with `cache.modify()`** | The "proper" Apollo approach — update specific cache entries instead of refetching everything. More code, much better performance. |

### Interview Framing

> "We used Apollo Client's InMemoryCache as the single source of truth to avoid sync bugs between views — every component reads from the same cache. The trade-off was performance: every mutation triggers a full refetch instead of surgical cache updates. For a prototype with <100 records this was fine, but it wouldn't scale. In production, I'd use optimistic updates and targeted cache invalidation."

---

## 7. Monorepo — npm Workspaces Trade-offs {#7-monorepo}

### The Decision

npm workspaces with three packages:

```
xp-monorepo/
├── apps/api/        ← NestJS backend
├── apps/web/        ← React frontend
└── packages/shared/ ← Shared TypeScript types (@xp/shared)
```

### Why Monorepo

1. **Shared types.** The mastery tier system (`getMasteryTier`, `getNextTierThreshold`, `MASTERY_THRESHOLDS`) is used by both the API (propagation engine) and the frontend (UI display). One source of truth.
2. **Coordinated changes.** When you add a new node type, you update `NODE_TYPES` in `@xp/shared`, and both apps see it immediately.
3. **Single Git history.** All changes are atomic — no "forgot to publish the shared package" bugs.

### The Problem We Hit (Deployment)

**Docker couldn't find `@xp/shared` at build time.**

The `packages/shared/dist/` directory is gitignored (compiled output). Locally it works because you've run `npm run build` in shared at some point. Docker starts from a clean checkout — `dist/` doesn't exist — and the API build fails with:

```
error TS2307: Cannot find module '@xp/shared' or its corresponding type declarations.
```

**The Fix:**

```dockerfile
# Build shared package BEFORE the API
RUN npm run build --workspace=@xp/shared

# Then build the API
COPY apps/api/ apps/api/
RUN npm run build --workspace=api
```

Also needed: `npm ci` (all workspaces, not just `--workspace=api`) to ensure the shared package's devDependencies (TypeScript) are installed during the build stage.

### Lesson

> **Never assume the Docker build environment matches your local machine.** Gitignored build artifacts that "just work" locally will break in CI/CD. Monorepo build order matters — dependencies must be built before dependents. Document the build order or use a tool like Turborepo that handles it automatically.

### Alternatives

| Tool | Trade-off |
|---|---|
| **Turborepo** | Handles build ordering, caching, and parallelism automatically. More setup but eliminates the class of bugs we hit. |
| **Nx** | Full monorepo framework. Overkill for 3 packages but great for larger teams. |
| **Separate repos + published npm package** | No build order issues but requires versioning, publishing, and coordinating releases. Slower iteration. |

---

## 8. The Propagation Engine — Graph Traversal Design {#8-propagation-engine}

### The Problem

When a TASK is completed, the system needs to:
1. Mark the task DONE and record `creditedHours`
2. Update the parent PROJECT's progress (% of children done)
3. Credit hours to linked SKILLs and update mastery tier
4. Update ancestor DOMAIN health (aggregate of children)

This is a **multi-node graph update triggered by a single event**.

### The Design

```
onTaskCompleted(taskId):
  1. Load task, set status=DONE, progress=100, save
  2. Walk UP via mainParent chain:
     └── if parent is PROJECT → recalc progress (done children / total children)
     └── if parent is SKILL → add creditedHours, recalc mastery tier
     └── if parent is DOMAIN → recalc domain progress
     └── stop at PERSON, TAG, ROUTINE (terminal types)
  3. Walk ACROSS via parents[] array (non-mainParent links):
     └── find SKILLs in parents[] → credit hours to each
     └── for each credited SKILL, walk up to DOMAIN ancestors
  4. Return all affected nodes (for cache refresh)
```

### Key Design Decisions

**Visited set to prevent double-counting:**
```typescript
const visited = new Set<string>([taskId]);
// ... before processing each node:
if (visited.has(id)) continue;
visited.add(id);
```

A SKILL can be reached via both the `mainParent` chain AND the `parents[]` array. Without a visited set, hours would be credited twice.

**Sequential DB queries, not batch:**
The engine loads each ancestor one by one (`findById`). This is an N+1 query pattern — 4 levels deep means 4 database round-trips. For <100 nodes with MongoDB Atlas latency ~5ms, total is ~20ms. At scale, you'd batch-load with `$in` or use a graph database.

**No transactions:**
Updates to task, project, skill, and domain are separate `save()` calls. If the process crashes between saving the project and the skill, the project shows updated progress but the skill doesn't have the hours. MongoDB doesn't support multi-document transactions on the free tier.

### The Streak System (Routines)

```typescript
checkInRoutine(routineId):
  1. Load routine
  2. Idempotent check: if lastCheckInDate === today → return (no double-counting)
  3. Push true to history[], increment streak
  4. Update bestStreak = max(streak, bestStreak)
  5. Calculate creditedHours from timer or target string
  6. Credit hours to linked SKILLs (same multi-skill logic as tasks)
```

**Target string parsing:** The routine's `target` field accepts human-readable strings like "30 min", "2 hours", "4x/week". A regex parser extracts numeric hours:

```typescript
"30 min"    → 0.5 hours
"2 hours"   → 2.0 hours
"4x/week"   → 0 hours (frequency, not duration)
```

### Interview Framing

> "The propagation engine is a graph traversal that walks upward from a completed task to its ancestors. The key challenge was preventing double-counting when a node is reachable via multiple paths — we solved this with a visited set. The main weakness is the N+1 query pattern (one DB call per ancestor level) and lack of transactions. At scale, I'd batch-load ancestors with `$in` and wrap the entire propagation in a transaction."

---

## 9. Timer System — Append-Only Time Entries {#9-timer-system}

### The Design

```typescript
metadata.timeEntries = [
  { start: "2026-05-20T09:00:00Z", end: "2026-05-20T10:30:00Z" },
  { start: "2026-05-20T14:00:00Z", end: "2026-05-20T15:15:00Z" },
  { start: "2026-05-21T10:00:00Z" }  // ← no end = timer running
]
```

### Why Append-Only

1. **Auditability.** You can see every work session — when you started, when you stopped, how long each session was.
2. **Resume support.** Stop working at lunch, resume after. Each session is a separate entry.
3. **Computed actual hours.** `actualHours = sum of (end - start) for all entries`. Recalculated on every `stopTimer` call.

### Alternative: Single start/end

```typescript
metadata.timerStart = "2026-05-20T09:00:00Z"
metadata.totalSeconds = 5400
```

Simpler but loses session history. You can't see "I worked 1.5h in the morning and 1.25h in the afternoon."

### Edge Case: Open timer on completion

What happens if you complete a task while a timer is still running? Currently: the timer is ignored. The task is marked DONE with whatever `actualHours` was last calculated. **This is a bug** — the open timer session is lost. The fix: auto-stop the timer before completing.

---

## 10. The Metadata Bag — Flexibility vs. Type Safety {#10-metadata-bag}

### The Design

```typescript
@Prop({ type: Object, required: false })
@Field(() => GraphQLJSON, { nullable: true })
metadata?: Record<string, unknown>;
```

Every type-specific field lives in this untyped JSON object. TASK metadata looks different from SKILL metadata looks different from PERSON metadata.

### Why This Design

1. **Rapid iteration.** Adding a new field (e.g., `metadata.sprint` for sprint planning) requires zero schema migrations and zero backend changes. Just save it from the frontend.
2. **GraphQL JSON scalar.** `graphql-type-json` passes the entire object through. The frontend knows what to expect by checking `node.type`.

### The Cost

1. **No compile-time safety.** `(node.metadata as any)?.priority` is everywhere in the frontend. If you rename `priority` to `urgency` in the backend, nothing catches it.
2. **No database-level validation.** You can save `metadata: { due: "not-a-date" }` and MongoDB won't stop you.
3. **No IDE autocomplete.** Every metadata access requires knowing what fields exist per type. There's no `TaskMetadata` interface enforced anywhere.

### What v2 Should Do

```typescript
// Discriminated union with typed metadata
interface TaskNode extends BaseNode {
  type: 'TASK';
  metadata: {
    priority: 'low' | 'medium' | 'high';
    due?: string;
    estimatedHours?: number;
    actualHours?: number;
    timeEntries?: TimeEntry[];
  };
}

interface SkillNode extends BaseNode {
  type: 'SKILL';
  metadata: {
    totalHours: number;
    level: MasteryTier;
    hoursToNext: number | null;
  };
}

type XPNode = TaskNode | SkillNode | ProjectNode | ...;
```

---

## 11. Obsidian Integration — One-Way Push Architecture {#11-obsidian-integration}

### The Decision

XP → Obsidian only. No bidirectional sync. No CouchDB. No LiveSync plugin. The API writes `.md` files directly to the vault filesystem.

### Why One-Way

**We tried bidirectional first.** The original plan was CouchDB + PouchDB + Obsidian LiveSync plugin for real-time two-way sync. This was scrapped because:

1. **Conflict resolution is hard.** If you edit a node in XP and the same `.md` file in Obsidian simultaneously, who wins?
2. **Obsidian files are free-form.** A hand-written note doesn't have the structure of an XP node. Trying to parse arbitrary markdown back into structured data is fragile.
3. **One source of truth is simpler.** MongoDB is canonical for structured data. Obsidian is canonical for notes/ideas. They don't overlap.

### The Design Principle

> "XP pushes. Obsidian reads. Never edit an XP-pushed file in Obsidian — it will be overwritten."

**How they connect:** XP-pushed files expose `aliases: ["Title"]` in frontmatter. Hand-written Obsidian notes reference XP nodes via `[[Title]]` wikilinks. Obsidian resolves the alias automatically. The graph view shows both XP nodes and hand-written notes connected.

### Interview Framing

> "We chose one-way sync to avoid the conflict resolution problem. The key insight was that the two systems have different sources of truth — structured data belongs in the database, free-form knowledge belongs in Obsidian. Instead of trying to merge them, we push a read-only mirror and let Obsidian's native linking (wikilinks, aliases) create the connections."

---

## 12. OAuth & Third-Party Integration — GCal {#12-oauth-gcal}

### The Implementation

```
User clicks "Connect" → GET /gcal/auth → redirect to Google OAuth
Google redirects back → GET /gcal/callback?code=xxx → exchange code for tokens
Tokens stored in memory → used for all subsequent API calls
```

### Critical Bugs

1. **Tokens stored in memory.** When the server restarts (every deploy, every cold start on Render free tier), the OAuth tokens are lost. GCal disconnects. User must re-authenticate.  
   **Fix:** Store tokens in MongoDB or a persistent key-value store.

2. **Hardcoded localhost in callback URL.**
   ```typescript
   res.redirect('http://localhost:5173?gcal=connected');
   ```
   This redirects to localhost in production. Should use an environment variable.

3. **Hardcoded localhost in event descriptions.**
   ```typescript
   `XP: http://localhost:5173 (node ${node._id})`
   ```
   GCal events created in production point to localhost.

### Lesson

> **Search your codebase for `localhost` before deploying.** Every hardcoded localhost is a deployment bug waiting to happen. Use environment variables for all URLs.

---

## 13. Deployment — Container Strategy & Pitfalls {#13-deployment}

### Architecture

```
Vercel (CDN)  →  Render (Docker)  →  MongoDB Atlas
React SPA          NestJS API           Database
Static files       Free tier            Free tier
                   (sleeps after 15m)
```

### Problems Hit During Deployment

| # | Problem | Root Cause | Fix |
|---|---|---|---|
| 1 | `Cannot find module '@xp/shared'` | Shared package dist is gitignored; Docker builds from clean checkout | Add `npm run build --workspace=@xp/shared` to Dockerfile |
| 2 | `npm ci --workspace=api` didn't install shared deps | Scoped install skips other workspaces' devDependencies | Changed to `npm ci` (all workspaces) |
| 3 | TypeScript build failed (26 errors) | `tsc -b` in build script caught unused imports + untyped mutation returns | Removed `tsc -b` from build, use `vite build` only (esbuild doesn't type-check) |
| 4 | MongoDB connection refused | Render's dynamic IPs aren't in Atlas whitelist | Opened Atlas Network Access to `0.0.0.0/0` |
| 5 | `404` on `/graphql` (double slash `//graphql`) | `VITE_API_URL` had trailing slash + code appends `/graphql` | Added `.replace(/\/+$/, '')` to strip trailing slashes |
| 6 | "No open ports detected" on Render | App listening on wrong port | Set `PORT=10000` env var (Render's default) |

### Lesson

> **Every deployment problem was a gap between "works on my machine" and "works in a clean environment."** Local development hides missing build steps (shared package was pre-built), network assumptions (MongoDB accessible from any IP), and hardcoded values (localhost URLs, port numbers). The fix pattern is always the same: make it configurable via environment variables and document the build order.

---

## 14. Problems Encountered & How They Were Solved {#14-problems}

### P1: Children Array Desync (Known Bug — Unfixed)

**Problem:** When you add a parent to node A, node A appears in that parent's `children[]`. But if you add parent B to node A later, the old parent A's `children[]` still contains node A. The `update()` method handles this with `$pull` and `$addToSet`, but edge cases exist:
- Direct database edits bypass the service
- Failed writes leave inconsistent state
- No background job to reconcile

**Systematic Fix:** Either (a) drop `children[]` entirely and compute it from `parents[]` on read (slower reads, always consistent), or (b) use database triggers/hooks to maintain the inverse relationship.

### P2: Frontend Type Safety Erosion

**Problem:** The frontend has 26+ TypeScript errors (unused imports, untyped returns). The team skipped `tsc` in the build because fixing them slowed deployment.

**Root Cause:** `useMutation` returns `{ data }` typed as `{}` when the GraphQL operation isn't fully typed. This cascades — every `data?.completeTask` access errors because TypeScript doesn't know `completeTask` exists on `{}`.

**Systematic Fix:** Generate types from the GraphQL schema using `@graphql-codegen/cli`. This creates typed hooks (`useCompleteTaskMutation`) that return properly typed data. Never write `as any` again.

### P3: Regex Injection in Search

**Problem:**
```typescript
query.title = { $regex: term, $options: 'i' };
```
The search term is used directly as a regex. A user could enter `.*` to match everything, or `(?=a]` to crash with a regex syntax error.

**Fix:** Escape regex special characters before using in `$regex`, or use MongoDB's `$text` index for full-text search.

### P4: `findAll()` Returns Everything

**Problem:** The main data query returns ALL nodes. No pagination, no limit, no cursor.

**Impact:** Linear degradation with data size. 50 nodes = fine. 500 nodes = noticeable. 5000 nodes = unusable.

**Fix:** Implement cursor-based pagination and purpose-built queries per view (e.g., `tasksDueThisWeek(limit: 10, after: cursor)`).

---

## 15. Security & Risk Audit {#15-security-audit}

### CRITICAL — Must Fix Before Real Use

| # | Issue | Severity | File | Detail |
|---|---|---|---|---|
| 1 | **No authentication** | 🔴 Critical | `main.ts` | Anyone with the URL can read/write/delete all data. No auth guards on any resolver or controller. |
| 2 | **No input validation** | 🔴 Critical | DTOs, `main.ts` | No `ValidationPipe`, no `class-validator` decorators. Users can save any type, any shape, any value. A `createNode` call with `type: "ADMIN"` would succeed. |
| 3 | **Open CORS** | 🟡 High | `main.ts:13` | `app.enableCors()` with no origin restriction. Any website can make API calls. |
| 4 | **GraphQL Playground in production** | 🟡 High | `app.module.ts:21` | `playground: true` exposes the full schema and lets anyone execute queries interactively from a browser. |
| 5 | **No rate limiting** | 🟡 High | — | No `@nestjs/throttler`. An attacker could flood mutations or exfiltrate the entire database with rapid queries. |
| 6 | **Regex injection in search** | 🟡 Medium | `nodes.service.ts:47` | User input used directly as MongoDB regex. Can cause ReDoS (regex denial of service) or match everything. |
| 7 | **OAuth tokens in memory** | 🟡 Medium | `gcal.service.ts:18` | Lost on every server restart. Not a security risk per se but breaks the integration silently. |
| 8 | **MongoDB URI fallback to localhost** | 🟠 Low | `app.module.ts:15` | If `MONGO_URI` env var is missing, the app silently connects to `localhost:27017` (which doesn't exist in production). Should throw a startup error. |
| 9 | **Error messages expose internals** | 🟠 Low | `gcal.controller.ts:36` | `OAuth failed: ${err.message}` — leaks internal error details to the client. |
| 10 | **No HTTPS enforcement** | 🟠 Low | `main.ts` | No redirect from HTTP to HTTPS. Render handles this at the proxy level, but the app itself doesn't enforce it. |
| 11 | **Hardcoded localhost URLs** | 🟠 Low | `gcal.controller.ts:34`, `gcal.service.ts:109` | OAuth callback and GCal event descriptions point to `localhost:5173`. Broken in production. |

### What a Production Deployment Would Need

```typescript
// main.ts — minimum viable security
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
app.enableCors({ origin: process.env.FRONTEND_URL });
app.use(helmet());

// app.module.ts
GraphQLModule.forRoot({
  playground: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
});

// Add @nestjs/throttler
ThrottlerModule.forRoot({ ttl: 60, limit: 100 });

// Add auth guard (JWT or session-based)
// Add class-validator decorators on DTOs
```

---

## 16. What I Would Do Differently (v2 Hindsight) {#16-hindsight}

| Area | v1 (What I Did) | v2 (What I'd Do) |
|---|---|---|
| **Database** | MongoDB (flexible but no integrity) | PostgreSQL + JSONB for metadata (integrity + flexibility) |
| **API** | GraphQL fetching everything | GraphQL with scoped queries + cursor pagination |
| **Types** | `metadata: Record<string, unknown>` | Discriminated union types per node type |
| **Auth** | None | JWT + refresh tokens from day 1 |
| **Validation** | None | `class-validator` + `ValidationPipe` |
| **Frontend data** | Apollo Client (heavy) | TanStack Query + graphql-request (lighter) |
| **Build** | `tsc -b && vite build` (broke on deploy) | Vite-only build + separate `tsc --noEmit` CI check |
| **Monorepo** | npm workspaces (manual build order) | Turborepo (auto build order + caching) |
| **Tests** | None | Integration tests on propagation engine at minimum |
| **Deployment** | "It works locally" | Dockerfile tested in CI before merge |
| **Obsidian sync** | Phase 10 (afterthought) | Core architecture from Phase 1 |

### The Biggest Lesson

**The most valuable part of building XP was not the app — it was learning what I'd do differently.** Every decision above was reasonable at the time. The mistakes only become visible when you try to deploy, scale, or maintain. That's why building is the fastest way to learn system design — reading about N+1 queries is different from debugging one at 2am.

---

*Document version: 1.0 · Written: 2026-05-25 · Based on xp-monorepo commit `07c0fe2`*
