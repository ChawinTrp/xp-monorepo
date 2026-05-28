# XP — Technical Specification

**Version:** 0.4 (Phase 8.5)
**Last updated:** 2026-05-23

---

## 1. Repository Structure

```
xp-monorepo/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts         # Entry point — CORS, port binding
│   │   │   ├── app.module.ts   # Root module — Mongoose, GraphQL, feature modules
│   │   │   ├── nodes/          # Core feature module
│   │   │   │   ├── node.entity.ts          # Mongoose schema + GraphQL ObjectType
│   │   │   │   ├── nodes.service.ts        # CRUD + parent-child wiring
│   │   │   │   ├── nodes.resolver.ts       # GraphQL queries and mutations
│   │   │   │   ├── propagation.service.ts  # XP engine — completion, timers, routines
│   │   │   │   └── dto/                    # Input types (create, update)
│   │   │   ├── gcal/           # Google Calendar integration
│   │   │   │   ├── gcal.service.ts         # OAuth2, event CRUD
│   │   │   │   └── gcal.controller.ts      # REST endpoints for OAuth flow
│   │   │   ├── seed.ts         # Database seeder (standalone script)
│   │   │   └── ping.resolver.ts            # Health check query
│   │   ├── Dockerfile          # Multi-stage production build
│   │   └── .env                # Local env vars (gitignored)
│   └── web/                    # React frontend
│       └── src/
│           ├── main.tsx        # Apollo Client setup + API URL config
│           ├── App.tsx         # Router + Layout shell
│           ├── components/     # Reusable UI (Sidebar, TopBar, NodeCard, modals)
│           ├── views/          # Page-level components (11 views)
│           └── lib/            # GraphQL operations, hooks, types
├── packages/
│   └── shared/                 # @xp/shared — mastery tiers, parent rules, types
│       ├── index.ts
│       └── dist/               # Compiled output (gitignored — built in Docker)
├── docs/                       # Project documentation
├── package.json                # Workspace root
└── .dockerignore
```

---

## 2. Technology Stack

### Backend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | NestJS | v11 |
| API | GraphQL (Code-First) | Apollo Server v5.4.0 |
| ORM | Mongoose | v8 |
| Database | MongoDB Atlas | M0 (free tier) |
| Runtime | Node.js | 22 (LTS) |
| Language | TypeScript | ~5.9 |

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | v19 |
| Build | Vite | v7.3 |
| Data | Apollo Client | v4 |
| Routing | React Router | v7 |
| Styling | Tailwind CSS | v3 |
| Icons | Lucide React | v0.577 |
| DnD | dnd-kit | v6/v10 |
| Dates | date-fns | v4 |
| Graph | force-graph | v1.51 |

### Infrastructure
| Component | Service | Tier |
|-----------|---------|------|
| API hosting | Render | Free (sleeps after 15min) |
| Frontend hosting | Vercel | Free (Hobby) |
| Database | MongoDB Atlas | M0 (free, 512MB) |
| DNS/CDN | Vercel Edge | Included |

---

## 3. Data Model

### 3.1 Single Collection Design

All entities stored in one MongoDB collection (`nodes`). This enables:
- Uniform GraphQL API (one resolver handles all types)
- Graph traversal without joins
- Flexible `metadata` field for type-specific data

### 3.2 Schema Definition

```typescript
{
  _id: ObjectId,
  title: string,                              // Required
  type: 'DOMAIN' | 'SKILL' | 'PROJECT' |     // Required, enum
        'TASK' | 'PERSON' | 'TAG' | 'ROUTINE',
  mainParent?: ObjectId,                      // Canonical parent for breadcrumbs
  parents?: ObjectId[],                       // All parent links (graph edges)
  children?: ObjectId[],                      // Derived — maintained by service
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE',  // TASK/PROJECT only
  progress?: number,                          // 0-100, computed for PROJECT/DOMAIN
  description?: string,                       // Plain text
  metadata?: object,                          // Type-specific flexible JSON
  obsidianPath?: string,                      // Future: vault sync tracking
  createdAt: Date,                            // Mongoose timestamps
  updatedAt: Date,
}
```

### 3.3 Type-Specific Metadata

| Type | Metadata Fields |
|------|----------------|
| SKILL | `totalHours`, `level`, `hoursToNext` |
| TASK | `priority`, `estimatedHours`, `actualHours`, `due`, `creditedHours`, `completedAt`, `timeEntries[]`, `gcalEventId` |
| ROUTINE | `cadence`, `target`, `timeOfDay`, `group`, `checkIns: [{date, hours}]`, `streak`, `bestStreak`, `thisWeek`, `weekTarget`, `lastCheckInDate`, `creditedHours`, `timeEntries[]` |
| PERSON | `circle`, `role`, `email`, `phone`, `initials`, `nextCatchup`, `catchupState` |
| TAG | `color` |
| PROJECT | `startDate`, `dueDate`, `gcalEventId` |
| DOMAIN | (no specific metadata — uses progress from children) |

### 3.4 Parent Rules (from `@xp/shared`)

| Node Type | Allowed mainParent Types |
|-----------|--------------------------|
| DOMAIN | DOMAIN |
| SKILL | DOMAIN |
| PROJECT | DOMAIN |
| TASK | PROJECT, DOMAIN, TASK |
| PERSON | DOMAIN |
| TAG | (none — root level) |
| ROUTINE | DOMAIN |

---

## 4. API Surface

### 4.1 GraphQL Queries

| Query | Arguments | Returns | Description |
|-------|-----------|---------|-------------|
| `nodes` | — | `[Node]` | All nodes (full collection) |
| `node` | `id: String` | `Node` | Single node by ID |
| `searchNodes` | `term: String`, `allowedTypes: [String]` | `[Node]` | Regex title search, optional type filter, limit 20 |

### 4.2 GraphQL Mutations

| Mutation | Arguments | Returns | Description |
|----------|-----------|---------|-------------|
| `createNode` | `CreateNodeInput` | `Node` | Create node + wire parent-child links |
| `updateNode` | `UpdateNodeInput` | `Node` | Update node + re-wire changed parents |
| `deleteNode` | `id: ID` | `Node` | Delete + clean up parent/child references |
| `completeTask` | `id: ID` | `[Node]` | Mark DONE + propagate XP upward |
| `checkInRoutine` | `id: ID` | `[Node]` | Record check-in + credit skill hours |
| `undoCheckInRoutine` | `id: ID` | `[Node]` | Reverse today's check-in + debit skill hours |
| `startTaskTimer` | `id: ID` | `Node` | Start time tracking entry (works on TASK and ROUTINE) |
| `stopTaskTimer` | `id: ID` | `Node` | Stop timer + calculate actualHours |

### 4.3 REST Endpoints (GCal only)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/gcal/status` | Check OAuth2 configuration and connection state |
| GET | `/gcal/auth` | Get Google OAuth2 authorization URL |
| GET | `/gcal/callback` | OAuth2 callback — exchange code for tokens |

---

## 5. Core Engine — Propagation Service

The propagation engine is the unique technical feature. It handles three flows:

### 5.1 Task Completion (`onTaskCompleted`)
```
1. Mark task DONE, progress = 100
2. Credit hours = actualHours ?? estimatedHours ?? 0
3. Walk mainParent chain upward:
   - PROJECT → recalc progress (done children / total children)
   - SKILL → add credited hours, recalc mastery tier
   - DOMAIN → recalc aggregate progress
4. Walk parents[] array (non-mainParent links):
   - Find SKILL nodes → add credited hours
   - Walk their ancestors → update domain progress
5. Return all affected nodes (for cache invalidation)
```

### 5.2 Routine Check-in (`checkInRoutine`)
```
1. Idempotent check: skip if already checked in today
2. Append {date, hours} to checkIns[] (replaces legacy checkInDates string[])
3. Update: streak (backward traversal), bestStreak, thisWeek (from Monday), lastCheckInDate
4. Compute creditedHours from timer actualHours or parseTarget(target string)
5. Clear timer entries for next session
6. Credit hours to linked SKILLs via parents[]
7. Return all affected nodes
```

### 5.2a Routine Undo (`undoCheckInRoutine`)
```
1. Find today's entry in checkIns[] — return early if not found
2. Remove today's entry, recompute streak from yesterday backward
3. Recompute thisWeek, update lastCheckInDate to previous entry or null
4. Debit the exact hours that were credited (todayEntry.hours)
5. Return all affected nodes
```

### 5.3 Mastery Tiers (from `@xp/shared`)

| Tier | Min Hours | Threshold |
|------|-----------|-----------|
| Unfamiliar | 0 | 20h |
| Familiar | 20 | 300h |
| Skilled | 300 | 1,000h |
| Master | 1,000 | 10,000h |
| World Class | 10,000 | — |

---

## 6. Frontend Architecture

### 6.1 Data Flow

```
Apollo Client
  └── useNodes() hook (single GET_NODES query)
        └── Returns: { nodes, byId, childrenOf, breadcrumb, byType }
              └── Every view consumes this hook
```

All views share one Apollo query (`GET_NODES`) that fetches every node. Filtering, grouping, and tree-building happen client-side via the `useNodes()` hook.

### 6.2 Views (11 desktop + 1 mobile)

| View | Route | Key Libraries |
|------|-------|---------------|
| Dashboard | `/` | — |
| Kanban | `/kanban` | dnd-kit |
| Gantt | `/gantt` | date-fns, custom SVG |
| Calendar | `/calendar` | date-fns |
| Routines | `/routines` | — |
| Skills | `/skills` | — |
| People | `/people` | — |
| Graph | `/graph` | force-graph (canvas) |
| NodeDetail | `/node/:id` | — |
| Settings | `/settings` | — |
| SearchModal | (overlay) | — |
| **MobileShell** | **(≤768px breakpoint)** | Replaces entire desktop layout on mobile |

`MobileShell` (`src/mobile/MobileShell.tsx`) renders when `window.innerWidth < 768`. It shows a swipe-card focus deck (TASK + ROUTINE only), a persistent timer bar, and a Stats tab. Same Apollo data layer — no new API.

### 6.3 Component Library

Custom UI components in `components/ui/index.tsx`:
- `Button`, `TypeBadge`, `TypeIcon`, `ProgressBar`, `RingGauge`
- `Avatar`, `TagChip`, `LevelBadge`, `Dropdown`
- `Icons` (re-exports from Lucide)
- `useToast()` hook + toast notification system

All styled with Tailwind CSS + CSS custom properties (Catppuccin Mocha palette).

---

## 7. Environment Variables

### API (Render)
| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `PORT` | Yes | Render uses 10000 |
| `NODE_ENV` | Yes | `production` |
| `GOOGLE_CLIENT_ID` | No | GCal OAuth2 |
| `GOOGLE_CLIENT_SECRET` | No | GCal OAuth2 |
| `GOOGLE_REDIRECT_URI` | No | GCal OAuth2 callback URL |

### Frontend (Vercel)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | API base URL (no trailing slash) |

---

## 8. Build & Deploy

### Local Development
```bash
npm run start:dev -w api    # API on http://localhost:3000/graphql
npm run dev -w web          # Web on http://localhost:5173
```

### Production Build
```bash
# API — Docker
docker build -f apps/api/Dockerfile -t xp-api .

# Web — Vite
npm run build -w web        # Output: apps/web/dist/
```

### Database Seeding
```bash
npx ts-node apps/api/src/seed.ts
```

---

## 9. Commit History (Major Milestones)

| Hash | Description |
|------|-------------|
| `750ade3` | Foundation — initial NestJS + React setup |
| `9fe38d8` | DAG linking services |
| `0c719a6` | Force-directed graph + CSS fix |
| `811b833` | Phase 7b — The Game full user flow |
| `1e821b5` | Routines heatmap with dates |
| `2354895` | Phase 8 — Gantt, Calendar, Sprint |
| `bb9bbf1` | Google Calendar connector |
| `8949bd0` | Mobile responsive layout |
| `ae96743` | Deployment prep — Dockerfile, env vars |
| `b9e74a8` | Dockerfile fix — build @xp/shared |
| `331d508` | Skip tsc in web build |
| `07c0fe2` | Strip trailing slash from API URL |
