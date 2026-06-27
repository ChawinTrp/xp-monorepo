# XP Agent MCP Server — Engineering Notes for Learning

A companion to the code: why this is built the way it is, what was considered and rejected, and the bugs hit along the way. Written so a future me — or a system-design interviewer — can follow the reasoning, not just the API surface.

**What it is:** a local stdio [MCP](https://modelcontextprotocol.io) server that lets an AI agent (Claude) read and safely mutate live XP data — tasks, projects, skills, routines, people — by calling XP's existing GraphQL API. Built in a day: brainstormed → spec'd → planned → TDD'd (28 tests) → shipped → deployed → verified against live production data.

The one-line pitch: *XP is my personal life-OS; this gives it an agent interface, with the deliberate constraint that the agent can archive but never destroy.*

---

## Table of Contents
1. Stack choices
2. The core architecture decision (A vs B vs C)
3. Data modeling: soft-delete
4. The tool surface: hybrid, and why
5. The safety model
6. Bugs we hit and their lessons
7. What we deliberately did NOT build
8. System design interview cheatsheet

---

## 1. Stack choices

**TypeScript, not Python.** The idea-1 agentic-AI learning track is Python (Google ADK), so Python was a real option — it would let the agent runtime and the tool server share a language. TypeScript won because XP itself is TypeScript end-to-end, the MCP server can share the `@xp/shared` types and live in the same npm-workspaces monorepo, and the official MCP SDK is first-class in TS. Cost accepted: a future custom agent in Python would talk to this server over the wire rather than importing it. That's fine — MCP is a wire protocol; cross-language is the normal case.

**`graphql-request`, not a generated client or raw `fetch`.** This server makes ~10 simple operations against one endpoint. A codegen pipeline (`graphql-codegen`) would buy typed operations but adds a build step and a schema-introspection dependency on a deployed API. Raw `fetch` would mean hand-rolling the GraphQL envelope. `graphql-request` is the middle: one tiny dependency, `request(query, vars)`, done. Lesson: match client weight to surface area — a 10-operation client doesn't earn a codegen toolchain.

**`zod` for tool input schemas.** The MCP SDK consumes zod raw shapes directly to advertise each tool's parameters to the model, so zod was the path of least resistance — and it doubles as runtime validation. One library, two jobs (schema advertisement + validation).

**stdio transport, not HTTP/SSE.** This is a personal, local server driven by Claude Desktop on the same machine. stdio is the simplest, safest transport — no port, no network exposure, no auth dance. HTTP/SSE only earns its complexity when the server is remote or multi-client. We aren't there.

**Vitest, not Jest.** The XP API uses Jest (NestJS default), so consistency argued for Jest. But this package is plain ESM TypeScript with no Nest, and Vitest runs ESM out of the box with near-zero config. Cost: two test runners in one monorepo. Worth it — forcing Jest's ESM story onto a standalone package buys nothing.

---

## 2. The core architecture decision (A vs B vs C)

Three ways to connect an MCP server to XP:

- **A — thin stdio client calling XP's GraphQL.** The server is just an MCP-shaped client. Guardrails live in the tool layer.
- **B — a dedicated "agent" module inside the NestJS API** with agent-scoped resolvers and an API-key guard; the MCP server calls those.
- **C — MCP embedded in the Nest app**, calling `NodesService`/`PropagationService` directly (no network hop).

**We chose A.** The decisive question was: *what does B's server-side scope enforcement actually buy, today?* Its value is protecting the API when something other than this trusted local server can call the agent surface. But XP has no auth at all yet (Phase 11) — the whole API is already public. Adding server-side agent-scoping while the front door is open is fortifying one window. So B's main benefit is dead weight until auth exists, at which point it's the right move and should ride along with that work.

C was rejected because it couples the MCP server to Nest internals and makes the thing a service inside a deploy rather than a clean standalone artifact you can run with Claude Desktop and point at in a repo.

**Generalized lesson:** don't pay for a security boundary that sits behind an already-open door. Sequence hardening so each layer's protection is meaningful when it lands.

A second decision falls out of A: **writes go through XP's GraphQL mutations, never around them.** That's not incidental — it satisfies a standing rule that XP is the only write interface for structured data. The agent never touches Mongo; it speaks the same API the web app speaks, so propagation, parent/child bookkeeping, and (eventually) Obsidian sync all happen for free.

---

## 3. Data modeling: soft-delete

XP shipped with only **hard delete** — `deleteNode` removes the document and deletes the mirrored Obsidian `.md`. Giving an agent that power is the one irreversible action in the whole surface, so before the MCP server could exist, XP needed a reversible removal.

The addition is deliberately minimal: an `archived: boolean` field (defaulting false), `archive`/`unarchive` service methods, and — the part that makes it actually useful — **read queries that exclude archived nodes by default**:

```typescript
async findAll(includeArchived = false): Promise<Node[]> {
  const query = includeArchived ? {} : { archived: { $ne: true } };
  return this.nodeModel.find(query).exec();
}
```

`{ archived: { $ne: true } }` rather than `{ archived: false }` is intentional — it matches legacy documents that predate the field and have no `archived` key at all. A plain `false` match would have hidden every node created before this migration.

Why a real schema field instead of stuffing it in the existing `metadata` JSON bag? Because "is this node alive" is a first-class query predicate that every read filters on. Burying it in an opaque JSON blob would mean it can't be cleanly indexed or filtered at the query layer. Type-specific attributes belong in `metadata`; lifecycle state belongs in a column.

Cost accepted: archived nodes still appear as ids inside other nodes' `children` arrays. They're hidden from the node lists the UI renders, so they vanish from views, but the graph edges aren't pruned. For a single-user v1 that's fine; a stricter version would filter children too.

---

## 4. The tool surface: hybrid, and why

Three options for tool granularity: raw CRUD pass-throughs, high-level intent verbs ("plan my week"), or a hybrid. We chose **hybrid** — CRUD primitives (`search_nodes`, `get_node`, `create_node`, `update_node`, `archive_node`, `unarchive_node`) plus semantic action tools that wrap XP's existing domain logic (`complete_task`, `check_in_routine`, `start_task_timer`, `stop_task_timer`).

Pure raw-CRUD would force the model to understand XP's entire data model — and would let it set a TASK's status to DONE *without* triggering the XP-propagation that completing a task is supposed to fire. Pure intent-verbs would be a polished demo but brittle for anything novel. The hybrid lets the agent do arbitrary structured work through the primitives, while the action tools guarantee that "complete this task" reuses `PropagationService` and ripples XP/progress up the hierarchy exactly like the web UI does. The semantic tools aren't sugar — they're the difference between mutating a row and invoking domain behavior.

---

## 5. The safety model

There are two distinct risks, and conflating them leads to the wrong fix.

**Network/auth risk** — anyone with the API URL can call it. This is a pre-existing XP property (no auth, Phase 11). The MCP server doesn't worsen it: a local stdio server consuming an already-public API adds no new exposure. So this is explicitly *out of scope* for this work.

**Agent-behavior risk** — a hallucinating or buggy agent issuing destructive writes. This is the real risk the tool introduces, and it's solved entirely in the tool layer:
- **No hard-delete tool exists.** `archive_node` is the only removal path. This is asserted in a test, so it can't regress silently.
- **Field whitelist on update.** `update_node` builds an explicit patch from known fields rather than forwarding arbitrary input.
- **Per-type metadata validation** before any write, because XP's `metadata` is an unvalidated JSON bag server-side — the server won't catch a malformed shape, so the client does.

**Lesson:** when you bolt an autonomous actor onto a system, separate "who can reach the API" from "what damage a reach can do." They have different fixes, and the second one is the one you own here.

---

## 6. Bugs we hit and their lessons

### Bug 1 — `TS2589: Type instantiation is excessively deep and possibly infinite`

**Symptom:** the package tested green but `tsc` refused to build, pointing at the single line that registers a tool on the server.

**Diagnosis path:** the error is TypeScript's recursion-depth bailout. The first instinct — "infinite type somewhere in my code" — was wrong. The trigger was the SDK's `registerTool`, which infers a tool's argument type *through* the zod raw shape you hand it. My `ToolDef.inputSchema` is typed as the generic `ZodRawShape` (because the definitions live in an array of heterogeneous tools), and asking the SDK's conditional types to resolve a concrete arg type from a fully-generic shape blows the instantiation budget.

**Root cause:** generic-over-generic. The SDK is designed for `registerTool` to be called with a *literal* shape at each call site (so inference has something concrete to chew on). Driving it from a generic array element defeats that.

**Fix:** cast at the registration boundary so TypeScript stops trying to infer through the generic shape — the runtime contract is already pinned by the `tools.test.ts` suite:

```typescript
// The SDK's registerTool infers deeply through the generic ZodRawShape,
// which trips TS2589. The runtime contract is exercised by tools.test.ts.
(server.registerTool as any)(def.name, { description: def.description, inputSchema: def.inputSchema }, handler);
```

**Lesson:** TS2589 usually isn't your infinite type — it's a library's heavy generic meeting your too-generic input. The clean fix is to give inference a concrete type or sever it at one boundary, not to fight the library's internals. And lean on runtime tests to cover what you cast away.

### Bug 2 — the schema/deploy mismatch

**Symptom:** every MCP read would have failed against the deployed API with "Cannot query field `archived`."

**Diagnosis:** caught *before* it bit, by reasoning about deploy state. The MCP client's `NODE_FIELDS` selection set includes `archived`, and `search_nodes` passes `includeArchived` — both exist only on the feature branch. The deployed Render API was still running old `main`. So the client was coupled to a schema that wasn't live yet.

**Root cause:** a client and the schema it depends on were on different sides of a deploy boundary.

**Fix:** sequence the deploy — merge the API change to `main`, let Render redeploy, *then* point the agent at it. Verified live afterward: the first node the agent pulled was the project's own "LakeHouse CI" task, carrying `archived: false` (proof the new schema was live).

**Lesson:** an API client is implicitly versioned against its server's schema. When they deploy independently, the consumer must not run ahead of the producer. Either ship the schema first, or make the client tolerant of its absence.

### Bug 3 — the silently-broken test stub

**Symptom:** adding the resolver mutations turned the API suite red — but at *module compile*, on a file I hadn't touched.

**Diagnosis:** `nodes.resolver.spec.ts` was the auto-generated Nest stub — `providers: [NodesResolver]` with none of the resolver's dependencies provided. It had been failing to instantiate all along; it just hadn't been in the blast radius of a change until now.

**Fix:** gave it real mocked providers (the same shape I'd just written for the service spec) and added two assertions for the new mutations.

**Lesson:** a scaffolded "should be defined" test that was never wired up isn't a passing test — it's a latent failure waiting for the first person who runs the suite. Fix the stubs in files you're already touching.

---

## 7. What we deliberately did NOT build

| Not built | Why not (yet) |
|-----------|---------------|
| Network auth / API keys | Pre-existing XP gap; belongs with Phase 11 multi-user, not here |
| A hard-delete tool | The entire point — agent removal must be reversible |
| Server-side scope enforcement (Approach B) | No value behind an already-open API; revisit with auth |
| Remote / hosted MCP (HTTP/SSE) | Local single-user; stdio is simpler and safer |
| Retry / backoff on the GraphQL client | One trusted caller, one endpoint; add when flakiness is observed, not before |
| Full metadata schema validation | Light per-type guard covers the real shapes; full discriminated-union validation is XP-side work (tracked there) |
| Pruning archived ids from `children` arrays | Hidden from views already; acceptable for v1 |

The discipline of saying no is half the design. Most of these are "right idea, wrong time" — seams left for later, not doors closed.

---

## 8. System design interview cheatsheet

**Prompt this project answers: "Design an agent interface (MCP server) over an existing application's API."**

**Clarify scope first.**
- Functional: agent can read all node types, create/update them, and *reversibly* remove them; plus domain actions (complete task, check-in routine, timers).
- Non-functional: single user, local, low volume; safety > throughput; reuse existing business logic rather than reimplement.

**Where do the writes go?** Through the existing API, not the database. This keeps one write path, so invariants (propagation, parent/child links, downstream sync) hold no matter who triggers the write. Bypassing the API to hit the DB directly is the classic mistake — it duplicates business logic and lets the two paths drift.

**Tool granularity.** Raw CRUD vs intent verbs vs hybrid. Hybrid is usually right: primitives for flexibility, semantic actions to guarantee domain behavior fires. Name the trade-off explicitly.

**Safety / blast radius.** Separate the two risks: *reachability* (auth — who can call) and *authority* (what a call can do). For an autonomous caller, constrain authority at the tool layer: no irreversible ops, field whitelists, input validation. Soft-delete instead of delete is the cheapest high-value guardrail.

**Schema coupling & deploys.** The client is versioned against the server's schema. If they deploy separately, the producer ships first. Otherwise the consumer references fields that don't exist yet.

**Scaling discussion** (where this would break and the fix):

| Scale | What breaks | Fix |
|-------|-------------|-----|
| 1 user, local | Nothing | — |
| A few users | No auth — anyone with the URL mutates data; stdio doesn't fan out | Add auth (API keys/OAuth); move to HTTP/SSE transport |
| Many users / shared | Client-side guardrails are bypassable by direct API calls; no per-user scoping | Promote guardrails server-side (Approach B): agent-scoped resolvers + per-key permissions |
| High write volume | `search` has no pagination; full reads; each tool is a network round-trip | Cursor pagination; batch/dataloader; cache hot reads |

**Failure modes.** API down or cold-started (Render free tier scales to zero → ~30–50s first request) → surface a clear timeout to the model, not a hang. Malformed agent input → validation rejects before the write. Partial GraphQL errors → the client surfaces them as tool errors (the `buildServer` wrapper turns thrown errors into `isError` tool results so the model can react rather than crash).

---

## Closing thought

The shape of this project is "build for today, leave seams for tomorrow." The storage abstraction in XP made the eventual GCS/BigQuery swap a one-file change; here, choosing Approach A and putting guardrails in the tool layer means the day auth arrives, the upgrade path (promote scoping server-side) is already named and isolated. The most senior decision in the whole thing wasn't a thing built — it was declining to build server-side enforcement that would have sat uselessly behind an open door, and writing down exactly when to revisit it. Knowing the right time for a piece of work is as much engineering as the work itself.
