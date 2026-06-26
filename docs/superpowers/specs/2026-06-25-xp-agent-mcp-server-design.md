# XP Agent MCP Server — Design (choices captured, not finalized)

**Date:** 2026-06-25
**Status:** 🟡 Brainstorm captured — architecture fork still open, implementation deferred by CT ("write the plan and choices, implement later")
**Source idea:** "XP agent API (GraphQL)" — expose XP live data to AI agents for read + controlled mutation (idea backlog: `Obsidian/Second Brain/01 - Projects/Ideas/Tech Project Ideas.md`)
**Architecture home:** this slots as a new XP phase (after/alongside Phase 10 Obsidian Sync). Promote the chosen approach into `XP.md` once decided.

---

## 1. Goal

Let an AI agent (primarily **Claude**, via an **MCP server**) read and safely manipulate live XP data — tasks, projects, skills, routines, people — so XP can be driven conversationally ("what's overdue?", "add a task to ship the lakehouse CI", "mark the Trivy task done").

Doubles as a **portfolio piece** for the DE/SWE job hunt: "I built an MCP server for my personal life-OS."

## 2. Decisions locked in

| Decision | Choice | Why |
|---|---|---|
| **Primary consumer** | **MCP server** | Strongest demoable portfolio artifact; Claude can drive it day one; cleanly separates agent reasoning from XP owning the writes (Standing Instruction #5). |
| **Mutation scope** | **Read + Create/Update + soft-delete (archive)** | Full usefulness with no irreversible loss. Hard-delete stays a human-only action in the web UI. |
| **Tool granularity** | **Hybrid** — CRUD primitives + semantic action tools | Best agent ergonomics; action tools reuse `PropagationService` so agent-completed tasks propagate XP exactly like the UI. |

## 3. OPEN decision — how the MCP server talks to XP

**Not yet decided.** Three approaches, recommendation = **A**.

### Approach A — Thin stdio MCP server, own monorepo package, calls XP's GraphQL *(recommended)*
- New package `packages/mcp-server` (TypeScript, official MCP SDK). Each tool calls XP's existing GraphQL endpoint over the network.
- XP backend gains only the soft-delete addition (§5). Guardrails live in the MCP tool layer.
- Runs locally (stdio), wired into Claude Desktop/Code.
- **Pros:** fastest to a working demo; MCP server is just a client (clean separation); writes go through XP's GraphQL mutations = Standing Instruction #5 satisfied; most legible standalone repo for a portfolio.
- **Cons:** guardrails are client-side — a direct hit on the raw API bypasses them. This is the *pre-existing* no-auth gap (XP §11), not introduced here.

### Approach B — MCP server + dedicated agent module in the NestJS API
- New NestJS module: agent-scoped resolvers (read/create/update/archive, no hard-delete) + API-key guard. MCP server calls those.
- **Pros:** scope enforced server-side; isolated surface ready for when auth lands (Phase 11).
- **Cons:** materially more work; overlaps existing resolvers; slower to first demo. Its main benefit only matters once the API is authenticated/multi-user — which it isn't yet.

### Approach C — MCP embedded in the Nest API (same deploy, calls services directly)
- MCP served over HTTP/SSE inside the Nest app, calling `NodesService`/`PropagationService` directly.
- **Pros:** no network hop; reuses services directly; single deploy.
- **Cons:** couples MCP to Nest internals; remote MCP hosting fiddlier than local stdio; worse as a standalone artifact; harder to run with Claude Desktop.

**Recommendation rationale:** A gets a working "agent controls my life-OS" in the least time and keeps the server as a clean standalone repo. B's server-side scope enforcement is the right end-state but should ride along with Phase 11 (Auth & Multi-user), not block this.

## 4. Required XP backend change (independent of A/B/C)

XP has **no soft-delete today** — `deleteNode` is a hard delete (removes from Mongo + deletes the Obsidian `.md`). The chosen scope needs:

- **`archived: boolean`** on the Node schema (default `false`) — or `metadata.archived` if avoiding a schema migration is preferred.
- **`archiveNode(id)` / `unarchiveNode(id)`** mutation(s).
- **Query filter:** `nodes`, `node`, `searchNodes` exclude archived by default; opt-in flag to include them.
- Hard-delete (`deleteNode`) remains, but is **not** exposed to the agent.
- Obsidian sync (Phase 10, pending): archived nodes either skip the push or move to an `_archive/` area — resolve when Phase 10 lands.

## 5. Proposed tool surface (hybrid)

**Read primitives**
- `search_nodes(query, types?, status?, includeArchived?)` — wraps existing `searchNodes`.
- `get_node(id)` — wraps `node(id)`; returns node + connections.
- `list_overdue()` / `list_today()` — convenience reads over TASK/ROUTINE (mirror Dashboard logic).

**Write primitives**
- `create_node(type, title, mainParent?, parents?, description?, metadata?)` — wraps `createNode`. Validate `type` ∈ allowed enum; validate `mainParent` rules per `NODE.md`.
- `update_node(id, patch)` — wraps `updateNode`. Whitelist editable fields; reject hard-delete-shaped patches.
- `archive_node(id)` / `unarchive_node(id)` — the soft-delete path (§4). **No hard-delete tool.**

**Semantic action tools (reuse existing logic)**
- `complete_task(id)` → `completeTask` (triggers propagation).
- `check_in_routine(id)` / `undo_check_in_routine(id)`.
- `start_task_timer(id)` / `stop_task_timer(id)`.

**Metadata safety:** `metadata` is an unvalidated `GraphQLJSON` bag in XP (§11). The MCP layer should validate per-type metadata shape (TASK → dueDate/priority/estimatedHours, PERSON → email/phone, etc.) before sending, since the server won't.

## 6. Security & guardrails

- **Network/auth:** out of scope here — pre-existing XP gap (no auth, public API). Track under Phase 11. A local stdio server consuming the existing API does **not** worsen it.
- **Agent-behaviour guardrails (the real risk):**
  - No hard-delete tool exposed — archive only.
  - Field whitelist on `update_node`; reject unknown/dangerous fields.
  - Per-type `metadata` validation before write.
  - Consider a `dryRun`/preview return on bulk or ambiguous operations.
  - Tool descriptions make the soft-delete-only contract explicit to the model.

## 7. Stack & topology (recommendations, still flexible)

- **Language:** TypeScript — matches XP + `@xp/shared` types; official MCP SDK is first-class in TS. (Note: idea 1 / Google ADK course is Python; this is a separate track. Revisit only if you want the agent runtime and the MCP server to share a language.)
- **Transport:** local **stdio** (personal use, simplest, safest).
- **API target:** env var `XP_API_URL` — default to the deployed Render API (`https://xp-monorepo.onrender.com/graphql`), point at local API for dev. Note Render free-tier cold start (~30–50s) on first call after idle.
- **Location:** new `packages/mcp-server` in the monorepo (shares `@xp/shared` types) for Approach A.

## 8. Open questions to resolve before implementing

1. **Approach A vs B vs C** (the §3 fork). Recommendation: A.
2. `archived` as a **schema field** vs `metadata.archived` (migration cost vs cleanliness).
3. TypeScript MCP server vs Python (to share a language with the idea-1 agent runtime).
4. Connect to **deployed** Render API or require a **local** XP API while developing.
5. Interaction with **Phase 10 (Obsidian Sync)** for archived nodes — skip push vs `_archive/` folder.

## 9. Next steps (when picking this up)

1. Resolve §8 Q1 (and ideally Q2–Q4).
2. Re-enter the brainstorming → **writing-plans** flow to produce the implementation plan for the chosen approach.
3. Implement the XP backend soft-delete addition first (§4) — it's a prerequisite for any approach and is independently useful.
4. Build the MCP server, wire into Claude Desktop/Code, demo.
5. Promote the chosen architecture into `XP.md` as a numbered phase.
