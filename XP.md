# Project XP: Master Architecture & System Design Document

**Version:** 8.5 (Game + Orchestra + Mobile; Deployed — Render + Vercel)
**Status:** Active Development
**Lead Architect:** CT

---

## 1. Executive Summary

**Project Name:** XP
**Description:** A personal life operating system with two pillars — **The Game** (goal, skill, and task tracking with gamified XP progression) and **The Orchestra** (project management and relationship orchestration). XP does not manage free-form notes or ideas; that is the role of **Obsidian Second Brain**, which serves as the Vault. The two systems share a domain structure and tag system so they feel like one workspace.

### System Responsibilities

| System | Role |
|--------|------|
| **XP** | Structured, actionable data — Domains, Skills, Projects, Tasks, Persons, Tags, Routines. The Game + The Orchestra. |
| **Obsidian Second Brain** | Knowledge base — hand-written notes, ideas, references. The Vault. |
| **Sync (XP → Obsidian)** | XP pushes every node to Obsidian as a `.md` file on every mutation. Obsidian is read-only for XP data. |

---

## 2. Functional Requirements

### 2.1 The Game: Goal, Skill & Task Tracking

- **Graph-Based Hierarchy:** Nodes represent Domains, Skills, Projects, Tasks, Persons. Arbitrary depth, multi-parent connections.
- **Multi-Parent Architecture:** A node can belong to multiple parents (e.g., "Project XP" under "SWE", "DATA", and "PM" domains).
- **Primary Path (`mainParent`):** Canonical path for breadcrumbs and tree-view navigation. The full `parents` array powers the graph.
- **Tagging as Graph Relationships:** TAG nodes are first-class. Assigning a tag = adding the Tag Node's ID to `parents`. Tags also sync as Obsidian `tags` frontmatter for cross-system filtering.
- **Task Tracking:** TASK nodes with `status` (TODO / IN_PROGRESS / DONE), `priority`, `dueDate`.
- **Upward Progress Propagation:** Completing a TASK propagates progress upward — TASK → PROJECT → SKILL → DOMAIN.
- **Gamified Skill XP:** SKILLs accumulate XP from completed child tasks. XP thresholds unlock levels.

### 2.2 The Orchestra: Project Management & Relationships

- **Kanban Boards:** TASK nodes as draggable cards grouped by `status` within a PROJECT scope.
- **Agile Sprints:** TASK nodes grouped into time-boxed iterations with sprint planning and velocity.
- **Gantt Chart:** Timeline view of PROJECT/TASK dependencies via `startDate` and `dueDate`.
- **Relationship Management:** PERSON nodes with `email`, `phone`, `nextCatchupDate`, social health tracking.
- **Group Utilities:** Voting/polling and bill-splitting among linked PERSON nodes.
- **Collaborative Working (v1.x+):** Multi-user access, node assignment, real-time updates.

### 2.3 Graph Visualization

- **Interactive Graph View:** Canvas rendering the full node graph. Connections driven by `parents`/`children`.
- **Filter by Type:** Toggle DOMAIN, SKILL, PROJECT, TASK, PERSON, TAG visibility independently.
- **Obsidian Mirror:** XP pushes every node to Obsidian as `.md` on every mutation — Obsidian's graph view reflects the same graph with hand-written notes included (read-only for XP data).

---

## 3. Non-Functional Requirements

- **Performance:** Fast retrieval of deep nested graph data.
- **Availability:** Accessible across Desktop and Mobile.
- **Data Portability:** Full graph mirrored to Obsidian Second Brain on every mutation (§12).
- **Security:** Authentication to keep personal data private.

---

## 4. Technology Stack

### 4.1 Backend (API)

- **Framework:** NestJS v11 (TypeScript)
- **API Paradigm:** GraphQL — Code-First (`@nestjs/graphql`, Apollo Server v5.4.0)
- **Database:** MongoDB via Mongoose
- **Connection (`app.module.ts`):**
  ```typescript
  MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb+srv://...');
  ```

### 4.2 Frontend (Web)

- **Framework:** React 19 + TypeScript (Vite)
- **Data Fetching:** Apollo Client v4
- **Routing:** React Router v7
- **Styling:** Tailwind CSS v3 (custom dark theme)
- **Icons:** Lucide React
- **Graph Visualization:** force-graph (canvas-based, `force-graph` package) — interactive node graph
- **Drag & Drop:** dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) — Kanban board
- **Dates:** date-fns — lightweight date formatting/comparison for due dates, sprints, Gantt
- **No rich text editor.** Node descriptions are plain text (`<textarea>`). `@blocknote/*` removed.

### 4.3 Removed Dependencies

| Package | Reason |
|---------|--------|
| `@blocknote/core` | No rich editor — NOTE/IDEA moved to Obsidian |
| `@blocknote/react` | Same |
| `@blocknote/mantine` | Same — also removes the Mantine dependency chain |

---

## 5. Data Model — The Universal `Nodes` Collection

A single MongoDB collection represents the entire graph. All entities are Nodes.

### 5.1 Node Schema (`node.entity.ts`)

```typescript
@Schema({ timestamps: true })
@ObjectType()
export class Node {
  @Field(() => ID)
  _id!: string;

  @Prop({ required: true })
  @Field(() => String)
  title!: string;

  // NOTE and IDEA are not XP types — they live in Obsidian Second Brain.
  @Prop({
    required: true,
    enum: ['DOMAIN', 'SKILL', 'PROJECT', 'TASK', 'PERSON', 'TAG', 'ROUTINE'],
  })
  @Field(() => String)
  type!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Node', required: false })
  @Field(() => ID, { nullable: true })
  mainParent?: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Node' }] })
  @Field(() => [ID], { nullable: 'itemsAndList' })
  parents?: string[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Node' }] })
  @Field(() => [ID], { nullable: 'itemsAndList' })
  children?: string[];

  @Prop({ enum: ['TODO', 'IN_PROGRESS', 'DONE'], required: false })
  @Field(() => String, { nullable: true })
  status?: string;

  @Prop({ required: false, default: 0 })
  @Field(() => Float, { nullable: true })
  progress?: number;

  @Prop({ required: false })
  @Field(() => String, { nullable: true })
  description?: string; // Plain text only. No rich editor.

  @Prop({ type: Object, required: false })
  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, unknown>; // Type-specific fields (dueDate, xp, level, email, etc.)

  @Prop({ required: false })
  obsidianPath?: string; // Relative vault path — used for rename/delete tracking in sync.
}
```

> `metadata` is a flexible JSON object. Type-specific fields live here to keep the root schema stable.

---

## 6. Backend Logic & Services

### 6.1 `NodesService`

- `create(input)` → saves node, calls `ObsidianSyncService.upsertNode`
- `searchNodes(term, allowedTypes)` → regex search for SmartSearch comboboxes
- `update(id, input)` → updates node, calls `ObsidianSyncService.upsertNode`
- `remove(id)` → deletes node, calls `ObsidianSyncService.deleteNode`

### 6.2 `NodesResolver` (GraphQL)

- **Queries:** `nodes`, `node(id)`, `searchNodes(term, allowedTypes)`
- **Mutations:** `createNode`, `updateNode`, `deleteNode`, `completeTask`, `checkInRoutine`, `undoCheckInRoutine`, `startTaskTimer`, `stopTaskTimer`

### 6.3 `PropagationService`

Handles all XP logic triggered by mutations:
- `onTaskCompleted(id)` — marks DONE, credits hours, walks mainParent chain (PROJECT → DOMAIN) and parents[] (SKILLs)
- `checkInRoutine(id)` — appends `{date, hours}` to `checkIns[]`, updates streak, credits SKILL hours
- `undoCheckInRoutine(id)` — reverses today's check-in and debits skill hours
- `startTimer(id)` / `stopTimer(id)` — push/close entries in `metadata.timeEntries[]`; `stopTimer` recalculates `actualHours`

---

## 7. Frontend Architecture

### 7.1 App Shell

```
main.tsx          ← ApolloProvider + BrowserRouter
Layout.tsx        ← Sidebar (domain tree nav) + TopBar + <Outlet/>
```

### 7.2 Route Structure

| Route | View | Purpose |
|-------|------|---------|
| `/` | Dashboard | Live stats: streak, routines today, tasks done this week, skill hours, catch-ups |
| `/graph` | GraphView | force-graph canvas — full node graph, filterable by type |
| `/kanban` | KanbanView | Task cards by status (TODO / IN_PROGRESS / DONE) with dnd-kit drag + sprint mode |
| `/gantt` | GanttView | Timeline of projects/tasks by startDate–dueDate |
| `/calendar` | CalendarView | Monthly grid with task chips and routine dots |
| `/routines` | RoutinesView | 30-day heatmap, streak, check-in + timer per routine |
| `/node/:id` | NodeDetail | Single-node properties panel + timer + skill linking |
| `/people` | PeopleView | PERSON grid — contact info, catch-up tracker |
| `/skills` | SkillsView | SKILL tree — mastery tiers, hours bars, domain grouping |
| `/settings` | Settings | App settings |
| *(≤768px)* | MobileShell | Swipe-card deck (TASK + ROUTINE), timer bar, Stats tab |

### 7.3 Key Components

| Component | Used in | Purpose |
|-----------|---------|---------|
| `SmartSearchInput` | NodeDetail, CreateNodeModal | Search nodes, link as `mainParent` or `parents` |
| `NodeCard` | KanbanView, Dashboard | Compact node representation (title, type badge, status, due date) |
| `Sidebar` | Layout | Domain tree navigation + quick-create button |
| `TypeBadge` | Everywhere | Colored chip for DOMAIN / SKILL / PROJECT / TASK / PERSON / TAG / ROUTINE |
| `ProgressBar` | NodeDetail, SkillsView | Hours/progress visual bar |
| `RingGauge` | Dashboard | Circular progress ring for stat cards |
| `CreateNodeModal` | App, MobileShell | Full create form — all types with type-specific fields |
| `MobileShell` | App (≤768px) | Mobile-only: swipe deck, timer bar, stats tab, FAB quick-capture |

### 7.4 Node Detail Panel

Structured properties panel (no rich editor). Fields rendered conditionally by type:

| Type | Fields |
|------|--------|
| All | `title`, `description` (textarea), `mainParent` (searchable), children list |
| TASK | `status` dropdown, `due` date, `priority`, `estimatedHours`, timer start/stop, live elapsed, skill-linking picker, complete button |
| PROJECT | `status`, `progress` (computed from children), `startDate`, `dueDate` |
| SKILL | `level`, `totalHours`, `hoursToNext` (computed, read-only) |
| PERSON | `email`, `phone`, `nextCatchup` |
| TAG | color hex picker |
| ROUTINE | timer start/stop, check-in button (toggle with undo), streak, 30-day heatmap |

### 7.5 GraphQL Layer

```
src/lib/
  graphql.ts    ← All gql documents: GET_NODES, GET_NODE, SEARCH_NODES,
                   CREATE_NODE, UPDATE_NODE, DELETE_NODE,
                   COMPLETE_TASK, CHECK_IN_ROUTINE, UNDO_CHECK_IN_ROUTINE,
                   START_TIMER, STOP_TIMER
  hooks.ts      ← useNodes() — single shared Apollo query + derived maps
  types.ts      ← XPNode type, TYPE_COLORS
```

---

## 8. Local Development

```bash
# Terminal 1 — API  http://localhost:3000/graphql
npm run start:dev -w api

# Terminal 2 — Web  http://localhost:5173
npm run dev -w web
```

---

## 9. Implementation Roadmap

- ✅ **Phase 1–5:** Foundation, CRUD — NestJS/React, MongoDB Atlas, GraphQL, full node CRUD.
- ✅ **Phase 6:** Graph Connectivity — `parents`/`children` schema, SmartSearch UI, full frontend rewrite (multi-view Life OS UI with Catppuccin Mocha theme), ROUTINE node type added, seed data from Second Brain.
- ✅ **Phase 7: The Game** — Hours-based mastery system (5 tiers: Unfamiliar→World Class), `PropagationService` (`completeTask`, `checkInRoutine`, `undoCheckInRoutine`, `startTimer`, `stopTimer`), skill-linking UI (SkillPicker in CreateNodeModal + NodeDetail), `checkIns: [{date, hours}]` log, streak tracking, domain progress display, toast notification system.
- ✅ **Phase 8: The Orchestra** — Gantt chart (week/month/quarter zoom, drag-resize, today line), Calendar view (monthly grid, task chips, routine dots), Sprint planning (board/sprint toggle, create sprints, assign tasks, burndown bar), Google Calendar connector (OAuth2, event sync).
- ✅ **Phase 8.5: Mobile Shell** — `MobileShell` (≤768px): swipe-card focus deck for TASK + ROUTINE, time-of-day queue ordering, shared timer state with persistent timer bar, Stats tab, FAB quick-capture. Desktop views unchanged and fully responsive via CSS `clamp()` / `auto-fit`.
- ✅ **Phase 9: Deployment** — API on Render (free tier), frontend on Vercel. Dockerfile ready, env-var-based API URL (`VITE_API_URL`). Live at xp-monorepo-web.vercel.app.
- 🔜 **Phase 10: Obsidian Sync** — `ObsidianSyncService` one-way push (§12). `obsidianPath` field already on schema.
- 🔜 **Phase 11: Auth & Multi-user** — Authentication, collaborative access.

---

## 10. Deployment

> **Canonical guide:** `docs/DEPLOYMENT.md` (live URLs, env vars, troubleshooting). This section is the summary.

**Live:** Frontend → https://xp-monorepo-web.vercel.app · API → https://xp-monorepo.onrender.com/graphql

### 10.1 Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Vercel (CDN)   │────▶│   Render (API)    │────▶│  MongoDB Atlas   │
│   React + Vite   │     │  NestJS + GraphQL │     │   xp-database    │
│   Static build   │     │   Docker, free    │     │   (M0 free)      │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### 10.2 API — Render

- **Dockerfile:** `apps/api/Dockerfile` (multi-stage: build + prod, Node.js 22)
- **Region:** Washington, D.C. (Render free tier)
- **Port:** Render injects `PORT`; `main.ts` reads `process.env.PORT`
- **Env vars (set in Render):**
  - `MONGO_URI` — MongoDB Atlas connection string (Atlas IP allowlist `0.0.0.0/0` for Render's dynamic IPs)
  - `NODE_ENV=production`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (optional, for GCal)
- **CORS:** `app.enableCors()` in `main.ts` — `origin` set to the Vercel domain
- **Scales to zero** on free tier — cold start ~30-50s on first request after idle

### 10.3 Frontend — Vercel

- **Framework:** Vite (auto-detected by Vercel)
- **Root directory:** `apps/web`
- **Build command:** `cd ../.. && npm ci && npm run build -w web`
- **Output directory:** `dist`
- **Env vars (set in Vercel):**
  - `VITE_API_URL` — Render API URL (`https://xp-monorepo.onrender.com`)

### 10.4 Deploy

Both services auto-deploy from the GitHub repo on push to `main`:
- **Render** — connected to the repo, builds `apps/api/Dockerfile`.
- **Vercel** — connected to the repo, root `apps/web`, `VITE_API_URL` env var set.

See `docs/DEPLOYMENT.md` for first-time setup and manual redeploy steps.

---

## 11. Audit Log (Known Issues)

- **GCal token persistence:** OAuth tokens lost on Render restart (in-memory). Tokens must be re-authorized after cold start.
- **Obsidian sync:** `ObsidianSyncService` is designed and documented (§12) but not yet implemented — `obsidianPath` field exists on schema for future use.
- **Timezone edge:** All week/date math is centralised in `@xp/shared` (`localDateStr`, `getWeekStart` [Sunday, local], `getWeekDates`) and uses **local** dates everywhere — routine check-ins, task `completedDate`, `weekProgress`, and the Win-the-Week tracker. Consistent, but still assumes the server and client share a timezone. UTC+7 users: day/week cutoff is midnight Bangkok time.
- **Graph view performance:** force-graph loads all nodes — performance degrades above ~500 nodes. No pagination or lazy loading yet.
- **No auth:** Single-user personal OS; no authentication layer. All data is public to anyone with the API URL.

---

## 12. Obsidian Sync Layer (One-Way Push: XP → Obsidian)

### 12.1 Design Principles

- **XP is the source of truth.** MongoDB is canonical for all structured data.
- **Obsidian is the Vault.** Hand-written notes and ideas live in Obsidian natively. XP nodes are pushed there as a mirror — never edit the XP-pushed files in Obsidian.
- **One-way push only.** No CouchDB, no LiveSync, no watcher. NestJS writes files; Obsidian reads them.
- **Every mutation triggers a sync.** `create`, `update`, `delete` in `NodesService` each call `ObsidianSyncService`.

### 12.2 Vault Configuration

| Setting | Value |
|---------|-------|
| **Vault root** | `C:\Projects\Obsidian\Second Brain\` |
| **Env var** | `OBSIDIAN_VAULT_PATH` |

### 12.3 Flat Folder Structure (Domain-Mirrored)

XP nodes and hand-written notes coexist in the same domain-mirrored folders. The folder hierarchy is driven by XP DOMAIN nodes.

```
Second Brain/
  Work/                              ← DOMAIN node (no mainParent)
    Dev/                             ← DOMAIN node (mainParent: Work)
      project_xp_<id>.md            ← PROJECT pushed from XP
      task_1_<id>.md                 ← TASK pushed from XP
      My note on system design.md    ← hand-written, Obsidian-native
      _xp_index.md                   ← AUTO-GENERATED by XP sync (list of XP nodes in this domain)
      _index.md                      ← MANUAL personal MOC — not touched by sync
    Finance/
      ...
  Personal/
    ...
  Relationships/                     ← DOMAIN node
    alice_<id>.md                    ← PERSON node pushed from XP
  _tags/                             ← All TAG nodes pushed from XP
    urgent_<id>.md
    dev_<id>.md
  _index.md                          ← Global home dashboard (manual, not touched by sync)
```

**Rules:**
- Root DOMAIN nodes (no `mainParent`) → top-level folders under vault root.
- Sub-DOMAIN nodes → subfolders mirroring the `mainParent` chain.
- DOMAIN and PROJECT nodes with children → become folders. Their own file is `_index_xp_<id>.md` inside the folder (not `_xp_index.md`, which is the domain aggregate).
- TAG nodes → `_tags/` subfolder.
- Creating a new DOMAIN in XP auto-creates the folder and `_xp_index.md`.

### 12.4 Index Pages (Hybrid)

| File | Author | Content | Touched by sync? |
|------|--------|---------|-----------------|
| `_xp_index.md` | XP (auto) | Auto-generated list of all XP nodes in this domain with wikilinks | Yes — overwritten on every relevant mutation |
| `_index.md` | You (manual) | Personal MOC — curated links, hand-written notes, context | Never |

`_xp_index.md` example for `Work/Dev/`:
```markdown
---
auto_generated: true
domain: Dev
updated: 2026-05-19T10:00:00Z
---

# XP Index — Dev

## Projects
- [[project_xp_683b...|Project XP]]
- [[project_aura_683b...|Project Aura]]

## Tasks
- [[task_1_683b...|Task 1]] · IN_PROGRESS · due 2026-06-01
- [[task_2_683b...|Task 2]] · TODO

## Skills
- [[swe_683b...|SWE]] · Level 2 · 340 XP
```

### 12.5 File Naming

```
{slugified-title}_{_id}.md
```

Slugify: lowercase, spaces and special chars → underscores. `_id` = 24-char MongoDB ObjectId hex.

### 12.6 Frontmatter Schema

Every XP-pushed file includes `aliases` (human-readable title for clean wikilinks) and `tags` (Obsidian native tags for cross-system filtering).

```yaml
---
xp_id: 683b2f4e1a2b3c4d5e6f7890
type: TASK
title: Task 1
aliases: ["Task 1"]          # ← enables [[Task 1]] wikilinks from hand-written notes
tags: [urgent, dev]          # ← Obsidian native tags; shared with hand-written notes
status: IN_PROGRESS
progress: 40
mainParent: 683b2f4e1a2b3c4d5e6f1111
parents:
  - 683b2f4e1a2b3c4d5e6f1111
  - 683b2f4e1a2b3c4d5e6f2222
children:
  - 683b2f4e1a2b3c4d5e6f3333
dueDate: 2026-06-01
updatedAt: 2026-05-19T10:00:00.000Z
---
```

Only fields with values are written. No empty/null keys.

### 12.7 Tag System (Shared)

Tags are unified across XP and Obsidian via two mechanisms:

| Mechanism | Purpose |
|-----------|---------|
| `_tags/{name}_{id}.md` file | TAG node definition page. Obsidian backlinks panel shows all XP nodes that wikilink to it. |
| `tags: [...]` in frontmatter | Obsidian native tag property. Enables `#urgent` filtering across ALL files — both XP-pushed and hand-written notes. |

Hand-written notes use the same tag names in their frontmatter (`tags: [dev, learning]`) to participate in the shared tag filtering system. Obsidian's tag pane and search queries (`tag:#dev`) return results from both systems.

### 12.8 File Body

```markdown
# Task 1

[[project_xp_683b...|Project XP]]  [[urgent_683b...|urgent]]

Plain text description here.
```

- `# {title}` header.
- Wikilinks auto-generated from `parents` array — `[[{filename}|{title}]]` — powers Obsidian graph view.
- `description` written as plain text.

### 12.9 `obsidianPath` on Node

Stored on the Node document for rename/delete without re-traversing the parent chain.

```typescript
obsidianPath?: string; // e.g. "Work/Dev/task_1_683b....md"
```

| Event | Action |
|-------|--------|
| Create | Compute path → write file → save `obsidianPath`. If new DOMAIN, create folder + `_xp_index.md`. |
| Update (title or mainParent changed) | Delete old path → write new path → update `obsidianPath` → regenerate affected `_xp_index.md` files. |
| Update (description / status / progress only) | Overwrite same path — `obsidianPath` unchanged. Regenerate `_xp_index.md` if status changed. |
| Delete | Delete file at `obsidianPath` → regenerate affected `_xp_index.md`. |

### 12.10 `ObsidianSyncService` Interface

```typescript
class ObsidianSyncService {
  upsertNode(node: Node): Promise<void>          // create or update node file
  deleteNode(node: Node): Promise<void>          // remove .md file
  regenerateIndex(domainPath: string): Promise<void> // rebuild _xp_index.md for a domain
  private buildPath(node: Node): string          // derive vault path from mainParent chain
  private buildContent(node: Node): string       // frontmatter + wikilinks + description
  private resolveTagNames(tagIds: string[]): Promise<string[]> // TAG id → title for frontmatter
}
```

Called from `NodesService` after every successful `create`, `update`, or `remove`.

---

## 13. Use Cases

All use cases are organized by pillar. Each describes WHO does WHAT, the TRIGGER, the FLOW, and the OUTCOME. These drive the frontend views and backend logic.

### 13.1 Core — Node Management

#### UC-C1: Create a Node
**Actor:** CT
**Trigger:** Click "+" button in Sidebar, or "Quick Create" from any view.
**Flow:**
1. Modal or inline form appears with: title (required), type selector (DOMAIN / SKILL / PROJECT / TASK / PERSON / TAG).
2. Based on selected type, allowed `mainParent` options are filtered (per NODE.md §1).
3. SmartSearch for `mainParent` — type-ahead against existing nodes.
4. Optional: add `description` (textarea), `tags` (multi-select from existing TAG nodes or create new), additional `parents`.
5. Type-specific fields appear: TASK gets `status`/`dueDate`/`priority`, PERSON gets `email`/`phone`, etc.
6. Submit → `createNode` mutation → backend saves to MongoDB, auto-adds to parent's `children[]`, triggers Obsidian sync.
**Outcome:** Node appears in Sidebar tree, Graph view, and relevant Kanban/views. `.md` file written to Obsidian vault.

#### UC-C2: View/Edit a Node
**Actor:** CT
**Trigger:** Click any node from Sidebar, Graph, Kanban card, or direct URL (`/node/:id`).
**Flow:**
1. NodeDetail panel loads with all fields pre-filled.
2. Editable: title, description, mainParent, parents, tags, type-specific metadata.
3. Read-only computed fields: progress (for PROJECT — derived from children), XP/level (for SKILL — derived from propagation).
4. "Connections" section shows: mainParent (breadcrumb path), parents (graph links), children (list with type badges).
5. Save → `updateNode` mutation → Obsidian sync.
**Outcome:** Changes persisted. If title or mainParent changed, Obsidian file moves to new path.

#### UC-C3: Delete a Node
**Actor:** CT
**Trigger:** Delete button on NodeDetail, or context menu.
**Flow:**
1. Confirmation dialog showing impact: "This node has N children. They will become orphans (mainParent cleared)."
2. On confirm → `deleteNode` mutation → removes from all parents' `children[]`, clears `mainParent` on orphaned children, deletes Obsidian file.
**Outcome:** Node removed. Children re-parented or orphaned. Graph/Kanban/Sidebar updated.

#### UC-C4: Search and Filter Nodes
**Actor:** CT
**Trigger:** Global search bar (Cmd+K / Ctrl+K), or filter controls on any view.
**Flow:**
1. Type-ahead search by title (regex match).
2. Filter by: type (multi-select), status (for TASKs), tags, domain (mainParent chain).
3. Results shown as a list with type badges, status chips, and breadcrumb paths.
4. Click result → navigates to `/node/:id`.
**Outcome:** Fast node lookup without navigating the tree manually.

#### UC-C5: Navigate the Domain Tree
**Actor:** CT
**Trigger:** Sidebar always visible.
**Flow:**
1. Sidebar shows the full `mainParent` hierarchy as a collapsible tree.
2. Root level: DOMAIN nodes with no mainParent.
3. Expanding a DOMAIN shows its children (sub-DOMAINs, SKILLs, PROJECTs).
4. Expanding a PROJECT shows its TASKs.
5. Click any node → opens NodeDetail (`/node/:id`).
6. Drag a node onto another → reparent (update `mainParent`).
**Outcome:** Spatial awareness of the full life graph. Quick navigation.

---

### 13.2 The Game — Progress & Skill Tracking

#### UC-G1: Complete a Task (Trigger Upward Propagation)
**Actor:** CT
**Trigger:** Set TASK status to `DONE` (via Kanban drag, NodeDetail dropdown, or quick-action checkbox).
**Flow:**
1. TASK `status` → `DONE`, `progress` → 100.
2. Backend propagation engine fires:
   a. Find TASK's `mainParent` (e.g., PROJECT).
   b. Recalculate PROJECT `progress` = average of all children's progress (or weighted).
   c. If PROJECT's parent is a SKILL → recalculate SKILL XP: `+N XP` for completed task.
   d. If SKILL XP crosses a threshold → SKILL `level` increments.
   e. Continue up to DOMAIN if applicable (DOMAIN progress = aggregate of children).
3. All affected nodes trigger Obsidian sync.
**Outcome:** Completing one task ripples XP/progress up the entire hierarchy. Skill levels up. Visible in SkillsView and Dashboard.

#### UC-G2: View Skill Progression
**Actor:** CT
**Trigger:** Navigate to `/skills` or click a SKILL node.
**Flow:**
1. SkillsView shows all SKILL nodes grouped by parent DOMAIN.
2. Each SKILL card: title, current level, XP bar (current / next threshold), child projects count, recent activity.
3. Click a SKILL → NodeDetail with full breakdown: child projects, their progress, contributing tasks.
4. Historical XP gain chart (stretch goal — track XP over time).
**Outcome:** Gamified view of personal growth. "Am I leveling up in SWE? What tasks contributed?"

#### UC-G3: View the Full Life Graph
**Actor:** CT
**Trigger:** Navigate to `/graph`.
**Flow:**
1. React Flow canvas renders all nodes as interactive cards with edges from `parents`/`children`.
2. Nodes colored by type (DOMAIN = blue, SKILL = green, PROJECT = orange, TASK = gray, PERSON = pink, TAG = yellow).
3. Filter toggles per type — hide/show DOMAINs, TASKs, etc.
4. Click a node → highlight its connections, show mini-detail panel.
5. Double-click → navigate to `/node/:id`.
6. Zoom/pan for large graphs. Auto-layout options (hierarchical top-down, force-directed).
**Outcome:** Bird's-eye view of your entire life system. See how everything connects.

#### UC-G4: Dashboard — Daily Overview
**Actor:** CT
**Trigger:** Navigate to `/` (home).
**Flow:**
1. **Overdue tasks:** TASKs with `dueDate < today` and `status != DONE`.
2. **In-progress tasks:** TASKs with `status = IN_PROGRESS`, sorted by due date.
3. **Recent completions:** Last 5 tasks marked DONE (with XP gained).
4. **Skill summary:** Top 3 most-active SKILLs (by recent XP gain).
5. **Upcoming catch-ups:** PERSON nodes with `nextCatchupDate` approaching.
6. **Streak indicator:** Current daily streak count + weekly completion rate.
**Outcome:** "What should I work on today?" answered in 5 seconds.

#### Future Work — The Game (v2.x+)

##### UC-G5: Time-Based XP on Tasks & Projects
**Concept:** XP awarded is not flat — it scales with estimated effort and actual time invested.
**Design:**
1. TASKs gain `metadata.estimatedHours` and `metadata.actualHours` fields.
2. XP formula: `baseXP * timeMultiplier` where `timeMultiplier = max(1, actualHours / 2)` — a 10-hour task gives 5× the XP of a 2-hour task.
3. PROJECTs aggregate time from child TASKs. SKILL XP reflects total time invested across all contributing projects.
4. Optional time-tracking integration: start/stop timer on a TASK to log `actualHours` automatically (stored in `metadata.timeEntries[]`).
5. Dashboard shows: "This week: 12h invested → 340 XP earned."
**Outcome:** XP reflects real effort, not just checkbox-counting. A weekend deep-dive project contributes more than 10 trivial tasks.

##### UC-G6: World's Greatest Leaderboard — Benchmark Comparison
**Concept:** Compare your skill hours and progress against benchmarks from the world's best in each domain. Context: "Where am I vs. where the greats were at this stage?"
**Design:**
1. Each SKILL or DOMAIN can have `metadata.benchmarks[]` — a curated list of reference points:
   ```json
   {
     "name": "Anders Hejlsberg",
     "domain": "Programming Languages",
     "milestone": "Created TypeScript",
     "estimatedHours": 50000,
     "age": 52
   }
   ```
2. LeaderboardView (`/leaderboard` or panel within SkillsView): your total hours and XP in a SKILL plotted on a timeline alongside the greats.
3. Visual: horizontal bar chart or timeline — "You: 200h → Beginner. 10,000h = Mastery (Malcolm Gladwell). Anders Hejlsberg had ~50,000h when he created TypeScript."
4. Benchmarks are user-curated (not auto-fetched). CT populates them manually or imports from a seed dataset.
5. Motivational, not competitive — framing is "journey comparison", not ranking.
**Outcome:** Perspective on the long game. "I've invested 200 hours in SWE — the greats had 10,000+. Keep going."

##### UC-G7: Daily Task Streaks
**Concept:** Track consecutive days where at least one TASK was completed. Streaks motivate consistency.
**Design:**
1. System-level `metadata` (global or per-user): `currentStreak`, `longestStreak`, `lastCompletionDate`.
2. When a TASK is marked DONE:
   a. If `lastCompletionDate == today` → no change (already counted today).
   b. If `lastCompletionDate == yesterday` → `currentStreak++`.
   c. If `lastCompletionDate < yesterday` → `currentStreak = 1` (streak broken).
   d. Update `longestStreak = max(longestStreak, currentStreak)`.
3. Dashboard shows: streak flame icon + count ("🔥 14 days"), longest streak record.
4. Streak freeze (optional): spend earned XP to preserve streak on a rest day (1 freeze per week max).
5. Weekly view: calendar heatmap showing completion density (GitHub-contribution-graph style).
**Outcome:** Consistency > intensity. Small daily progress compounds. Visual motivation to not break the chain.

##### UC-G8: Weekly Task Goals & Review
**Concept:** Set a weekly target (e.g., "Complete 15 tasks this week") and track against it.
**Design:**
1. Weekly goal stored in system metadata: `weeklyTarget` (number of tasks), `weekStart` (day-of-week, default Monday).
2. Dashboard widget: progress ring showing `completedThisWeek / weeklyTarget`.
3. End-of-week auto-summary (generated on `weekStart`):
   - Tasks completed vs. target.
   - Top domains/skills where XP was earned.
   - Streak status.
   - Carry-over: incomplete IN_PROGRESS tasks flagged for next week.
4. Weekly history: bar chart of tasks completed per week over the last 12 weeks — spot trends.
5. Optional: per-PROJECT weekly goals (e.g., "Finish 5 XP tasks this week").
**Outcome:** Weekly rhythm. Plan on Monday, execute through the week, review on Sunday. Prevents both overcommitting and coasting.

---

### 13.3 The Orchestra — Project Management

#### UC-O1: Kanban Board — Manage Tasks by Status
**Actor:** CT
**Trigger:** Navigate to `/kanban` (all tasks) or `/kanban/:projectId` (scoped to a project).
**Flow:**
1. Three columns: TODO, IN_PROGRESS, DONE.
2. Each task rendered as a `NodeCard`: title, type badge, due date, priority, tags, assignee.
3. Drag a card between columns → updates `status` via `updateNode` mutation.
4. Drag within a column → reorder (position stored in `metadata.sortOrder`).
5. Click a card → slide-out NodeDetail panel (no full navigation — stay on Kanban).
6. "+ Add Task" at the bottom of each column → inline create with project pre-filled as `mainParent`.
7. Filter bar: by tag, priority, due date range.
**Outcome:** Visual task flow. Move tasks through pipeline by dragging. Like Trello/Linear but backed by the XP graph.

#### UC-O2: Gantt Chart — Timeline View (Phase 8)
**Actor:** CT
**Trigger:** Navigate to `/gantt` or `/gantt/:projectId`.
**Flow:**
1. Horizontal timeline with PROJECT and TASK bars plotted by `startDate` → `dueDate`.
2. Bars colored by status (gray = TODO, blue = IN_PROGRESS, green = DONE).
3. Dependency lines between tasks if `parents` relationship implies ordering.
4. Drag bar edges to adjust dates → `updateNode` mutation.
5. Hover a bar → tooltip with title, status, progress, assignee.
**Outcome:** Timeline awareness. "Is Project XP on track? What overlaps with what?"

#### UC-O3: Sprint Planning (Phase 8+)
**Actor:** CT
**Trigger:** Create a sprint from `/kanban/:projectId` or ProjectDetail.
**Flow:**
1. Sprint = a time-boxed grouping of TASKs. Stored as a TASK-like node with `type: SPRINT` in metadata (or a virtual grouping via date range).
2. Select tasks → assign to sprint → sprint board shows only those tasks.
3. Sprint burndown: tasks completed vs. remaining over the sprint window.
4. Sprint retrospective: auto-summary of completed/incomplete at sprint end.
**Outcome:** Agile-lite project management. Time-box work without heavyweight tools.

#### UC-O4: People & Catch-Up Tracker
**Actor:** CT
**Trigger:** Navigate to `/people`.
**Flow:**
1. Grid of PERSON nodes: photo placeholder, name, email, phone, last catch-up date, next catch-up date.
2. Sort by: next catch-up (soonest first), last contact (oldest first), domain grouping.
3. The grid is grouped by **circle** — TAG nodes with `metadata.kind: 'circle'`, one per person via `parents` (single circle per person, UI-enforced). Empty circles persist as member-less TAG nodes so they stay visible across devices.
4. Click a person → NodeDetail with: contact info, related projects/tasks (from `parents` links), catch-up history (from metadata).
5. "Schedule Catch-Up" button → set `nextCatchupDate` in metadata.
6. Overdue catch-ups highlighted (nextCatchupDate < today).
**Outcome:** Never lose touch. "Who haven't I caught up with in a while?"

#### UC-O5: Tag-Based Filtering Across Views
**Actor:** CT
**Trigger:** Click a tag chip on any node, or select tags in filter bar.
**Flow:**
1. Clicking a tag (e.g., "urgent") from any view → filters current view to only nodes with that tag in `parents`.
2. Tag filter persists across view switches (Kanban → Graph → Dashboard — all filtered to "urgent").
3. Tag management page (accessible via `_tags/` concept): list all tags, see node counts, edit colors.
**Outcome:** Cross-cutting views. "Show me everything tagged 'urgent' regardless of project or domain."

---

### 13.4 Cross-Pillar — Obsidian Integration

#### UC-X1: Auto-Sync on Every Mutation
**Actor:** System (automatic)
**Trigger:** Any `createNode`, `updateNode`, `deleteNode` mutation completes successfully.
**Flow:**
1. `NodesService` calls `ObsidianSyncService.upsertNode(node)` or `deleteNode(node)`.
2. Service builds path from `mainParent` chain, writes `.md` file with frontmatter + wikilinks + description.
3. Regenerates `_xp_index.md` for the affected domain.
4. If `mainParent` or `title` changed → old file deleted, new file written, `obsidianPath` updated.
**Outcome:** Obsidian vault always mirrors XP state. No manual export needed.

#### UC-X2: Link a Hand-Written Obsidian Note to an XP Node
**Actor:** CT (in Obsidian)
**Trigger:** Writing a note in Obsidian and wanting to connect it to an XP project/task.
**Flow:**
1. In the Obsidian note's frontmatter, set `xp_link: [[Project XP]]` (using the alias).
2. In the note body, write `[[Project XP]]` as a wikilink.
3. Obsidian resolves both via the `aliases` frontmatter on the XP-pushed file.
4. Obsidian's graph view now shows the hand-written note connected to the XP node.
**Outcome:** Knowledge (Obsidian) and action (XP) linked visually in Obsidian's graph. No XP changes needed — the link is Obsidian-native.

#### UC-X3: Browse XP Data in Obsidian
**Actor:** CT (in Obsidian)
**Trigger:** Open `_xp_index.md` in any domain folder, or browse XP-pushed files directly.
**Flow:**
1. `_xp_index.md` shows all XP nodes in that domain: projects with status, tasks with due dates, skills with levels.
2. Click any wikilink → opens the XP-pushed node file with full frontmatter properties.
3. Obsidian's backlinks panel shows hand-written notes that reference this XP node.
4. Obsidian search (`tag:#dev`) finds both XP-pushed and hand-written files.
**Outcome:** Read XP data without opening the XP app. Quick reference while writing notes.
