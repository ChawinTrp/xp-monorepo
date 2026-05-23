# XP — Security, Risk & Lessons Learned Audit

**Audit date:** 2026-05-23
**Auditor:** Claude (AI code review) + CT
**Scope:** Full codebase, deployment config, git history, dependencies

This document is an honest assessment of every security vulnerability, architectural risk, technical debt item, and operational concern in the XP project. Written as a learning tool — not to shame the code, but to catalog exactly what would need fixing before this system served real users.

---

## Severity Definitions

| Level | Meaning |
|-------|---------|
| 🔴 CRITICAL | Actively exploitable, data loss or breach likely |
| 🟠 HIGH | Serious risk, would block any production use with real users |
| 🟡 MEDIUM | Should fix, creates fragility or maintenance burden |
| 🟢 LOW | Minor concern, best practice violation |

---

## 1. Authentication & Authorization

### 🔴 SEC-01: No Authentication
**Location:** Entire API (`nodes.resolver.ts`, `gcal.controller.ts`)
**Issue:** Zero authentication. No login, no JWT, no API key. Every endpoint is fully public. Anyone who knows the Render URL can:
- Read all data: `GET /graphql` → `query { nodes { title description metadata } }`
- Delete all nodes: `mutation { deleteNode(id: "...") }`
- Modify any record
- Access the GraphQL Playground to explore the full schema

**Impact:** Complete unauthorized access to all personal data including contacts, goals, and routines.
**Evidence:** `app.enableCors()` in `main.ts` with no origin restriction. No auth guards on any resolver.
**Fix:** Add JWT or session-based auth. NestJS has `@nestjs/passport` with JWT strategy. At minimum, add an API key header check as a stopgap.
**Learning:** Authentication should be Phase 1, not Phase 11. Building features on an unsecured API means every feature inherits the vulnerability.

### 🔴 SEC-02: No Authorization / Access Control
**Location:** `nodes.resolver.ts`
**Issue:** Even with auth added, there's no concept of ownership. All nodes belong to everyone. No `userId` field on nodes, no row-level security.
**Fix:** Add `owner: ObjectId` to Node schema. Filter all queries by authenticated user's ID. Add `@UseGuards(AuthGuard)` to all resolvers.

---

## 2. API Security

### 🟠 SEC-03: GraphQL Introspection Enabled in Production
**Location:** `app.module.ts` line 18 — `playground: true`
**Issue:** GraphQL Playground and introspection are enabled in production. Attackers can see the full schema, all types, all fields, all mutations.
**Fix:**
```typescript
GraphQLModule.forRoot({
  playground: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
})
```

### 🟠 SEC-04: No Rate Limiting
**Location:** `main.ts`
**Issue:** No rate limiting on any endpoint. An attacker can:
- Scrape all data with rapid `nodes` queries
- DoS the service (Render free tier has limited resources)
- Brute-force IDs with `node(id: "...")` queries
**Fix:** Add `@nestjs/throttler` module. Configure per-endpoint limits.

### 🟠 SEC-05: No Input Validation / Sanitization
**Location:** `create-node.input.ts`, `nodes.service.ts`
**Issue:**
- `type` field accepts any string in the DTO — no enum validation at GraphQL input level (only at Mongoose schema level, which throws a raw MongoDB error)
- `title` and `description` have no length limits — could store megabytes of text
- `metadata` is `Record<string, unknown>` — any JSON accepted, no size limit
- `searchNodes` uses user input directly in regex: `{ $regex: term }` — **regex injection** possible. A crafted term like `.*` or `(?:a{100}){100}` could cause ReDoS
**Fix:**
- Add `class-validator` decorators (`@MaxLength`, `@IsEnum`, etc.)
- Sanitize regex input: escape special characters or use `$text` search instead
- Add `metadata` size limit

### 🟠 SEC-06: CORS Completely Open
**Location:** `main.ts` line 13 — `app.enableCors()`
**Issue:** CORS allows ALL origins. Any website can make API requests on behalf of a visitor.
**Fix:**
```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
});
```

### 🟡 SEC-07: No Query Depth / Complexity Limiting
**Location:** `app.module.ts`
**Issue:** GraphQL allows arbitrarily complex queries. A deeply nested or expensive query could exhaust server resources.
**Fix:** Add `graphql-depth-limit` or Apollo Server's built-in query complexity analysis.

---

## 3. Data Security

### 🟠 SEC-08: MongoDB Atlas IP Whitelist — `0.0.0.0/0`
**Location:** Atlas Network Access configuration
**Issue:** Database accepts connections from any IP. Security relies entirely on credentials.
**Context:** Required for Render (dynamic IPs). This is the documented approach for serverless/container platforms.
**Risk:** If `MONGO_URI` leaks, the database is immediately compromised. No network-level defense.
**Mitigation:** Use strong credentials. Rotate credentials periodically. Monitor Atlas access logs.

### 🟡 SEC-09: Hardcoded Fallback Connection String
**Location:** `app.module.ts` line 15
```typescript
process.env.MONGO_URI || 'mongodb://localhost:27017/xp-database'
```
**Issue:** Fallback is localhost which is safe, but the pattern of `||` fallback for database connections is risky. If `MONGO_URI` is empty string (not undefined), it would use the empty string, not the fallback.
**Also:** `seed.ts` line 7 has a hardcoded absolute path:
```typescript
dotenv.config({ path: 'C:\\Projects\\XP\\xp-monorepo\\apps\\api\\.env' });
```
This is a local machine path that should not be in committed code.

### 🟡 SEC-10: No Data Encryption at Rest
**Issue:** MongoDB Atlas M0 free tier does not support encryption at rest or audit logging. All data stored in plain text on Atlas servers.
**Mitigation:** Acceptable for personal/portfolio use. Not acceptable for production with real user data.

### 🟢 SEC-11: No Database Backup Strategy
**Issue:** Atlas M0 has no automated backups. A `deleteMany({})` (like in `seed.ts`) destroys all data permanently.
**Fix:** Export data periodically via `mongodump` or upgrade to M10+ for automated backups.

---

## 4. Secrets & Configuration

### 🟡 SEC-12: GCal OAuth Tokens Stored In-Memory
**Location:** `gcal.service.ts` line 18 — `private tokens: GCalTokens | null = null`
**Issue:** OAuth tokens are stored in a class instance variable. They are:
- Lost on every deploy/restart (Render restarts frequently on free tier)
- Not encrypted
- Not refreshed automatically (no token refresh logic)
**Fix:** Store tokens in MongoDB (encrypted) or use a secrets manager. Implement token refresh.

### 🟡 SEC-13: Hardcoded Redirect URL in OAuth Callback
**Location:** `gcal.controller.ts` line 34
```typescript
res.redirect('http://localhost:5173?gcal=connected');
```
**Issue:** Production OAuth callback redirects to localhost instead of the Vercel URL.
**Fix:** Use `process.env.FRONTEND_URL || 'http://localhost:5173'`.

### 🟡 SEC-14: GCal Event Description Contains localhost URL
**Location:** `gcal.service.ts` line 109
```typescript
`XP: http://localhost:5173 (node ${node._id})`,
```
**Issue:** Created calendar events reference localhost, not the production URL.
**Fix:** Use `process.env.FRONTEND_URL`.

---

## 5. Architectural Risks

### 🟠 ARCH-01: Fetching ALL Nodes on Every Page Load
**Location:** `hooks.ts` — `GET_NODES` query, `graphql.ts`
**Issue:** Every view calls `useNodes()` which runs `query { nodes { ...NodeFields } }` — fetching every single node from the database. With 49 nodes this is fine. With 5,000 nodes this will:
- Slow page load significantly
- Transfer large payloads over the network
- Stress MongoDB with full collection scans
**Fix:** Implement pagination, or at minimum query by type/parent. Use `@apollo/client` cache policies to avoid redundant fetches.
**Learning:** This is the #1 scalability bottleneck. Works great at prototype scale, becomes the bottleneck fast.

### 🟠 ARCH-02: `children[]` Array Desync
**Location:** `nodes.service.ts` — `update()` method, `XP.md` §11 Audit Log
**Issue:** The `children` array on parent nodes is maintained by application code — not by MongoDB's schema. If a parent is added via `parents[]` but the corresponding `children[]` update fails (network error, race condition), the arrays go out of sync.
**Evidence:** Documented as a known issue in `XP.md` §11: "Desync: children array not auto-updated when a parent is added."
**Fix:** Either:
- Derive `children` at query time from `parents` (don't store it)
- Use MongoDB change streams for eventual consistency
- Add a reconciliation job

### 🟡 ARCH-03: Propagation is Synchronous and Unbounded
**Location:** `propagation.service.ts` — `onTaskCompleted()`
**Issue:** The propagation engine walks the parent chain one document at a time, awaiting each database call. With a deep hierarchy (Task → Project → Skill → Domain chain of 10+), this becomes N sequential database round-trips in a single request.
**Also:** No cycle detection. If the graph has a cycle (A→B→A), propagation would loop until the `visited` set catches it — but there's no depth limit as a safety net.
**Fix:** Add a `MAX_DEPTH` constant (e.g., 20). Consider batch updates or queue-based propagation.

### 🟡 ARCH-04: `metadata` is Untyped JSON
**Location:** `node.entity.ts` — `metadata?: Record<string, unknown>`
**Issue:** The `metadata` field is a catch-all JSON blob. There's no validation, no schema, no TypeScript safety. Different node types store different shapes, and the frontend casts everything with `as any`.
**Consequences:**
- Bugs from typos in metadata keys (e.g., `due` vs `dueDate` — both exist in the codebase)
- No autocomplete in IDE
- Runtime errors from missing fields show as blank UI, not error messages
**Fix:** Define typed metadata interfaces per node type. Validate on write.

### 🟡 ARCH-05: Seed Script Hardcodes Absolute Windows Path
**Location:** `seed.ts` line 7
```typescript
dotenv.config({ path: 'C:\\Projects\\XP\\xp-monorepo\\apps\\api\\.env' });
```
**Issue:** Won't work on any other machine. Should use relative paths.
**Fix:** `dotenv.config({ path: join(__dirname, '..', '.env') })` (which is already on line 5 — the line 7 fallback is redundant).

---

## 6. Frontend Risks

### 🟡 FE-01: 26 TypeScript Errors Suppressed
**Location:** `apps/web/package.json` — build script changed to skip `tsc`
**Issue:** The frontend has 26 TypeScript errors (unused imports, untyped mutation returns, wrong argument counts). The build was changed from `tsc -b && vite build` to `vite build` to get past them.
**Consequence:** Type safety is effectively disabled for production builds. Real type errors will be caught at runtime, not build time.
**Evidence:** Commit `331d508`.
**Fix:** Fix all 26 errors and restore `tsc -b`. Add `tsc --noEmit` as a CI check.
**Specific errors to fix:**
- `CreateNodeModal.tsx`: unused `TypeBadge` import, `createNode`/`byId` not on type `{}`
- `Dashboard.tsx`: unused `weekTasks`
- `Gantt.tsx`: 6 unused date-fns imports
- `Kanban.tsx`: unused `onCreate`, `completeTask` not on type `{}`
- `NodeDetail.tsx`: unused `LevelBadge`/`refetch`/`byId`, `completeTask`/`stopTaskTimer` not on type `{}`
- `Routines.tsx`: unused `useEffect`/`useRef`/`byId`, `checkInRoutine`/`stopTaskTimer` not on type `{}`

### 🟡 FE-02: Bundle Size (717 KB)
**Location:** Vite build output
**Issue:** Single JS bundle is 717 KB (218 KB gzipped). Exceeds Vite's 500 KB warning threshold.
**Cause:** No code splitting. All views, all libraries loaded on first page load.
**Fix:** Use `React.lazy()` + dynamic `import()` for views. Move `force-graph` to a separate chunk (it's the heaviest dependency and only used on one page).

### 🟢 FE-03: No Error Boundaries
**Issue:** If any view component throws, the entire app crashes with a white screen.
**Fix:** Add React Error Boundaries around each view. Show a fallback UI instead of crashing.

### 🟢 FE-04: No Loading/Error States for Mutations
**Issue:** Some mutations (complete task, check-in routine) show toast on success/error but don't disable buttons during the request. Rapid double-clicking can trigger duplicate mutations.
**Fix:** Use the `loading` state from `useMutation` to disable action buttons.

---

## 7. Dependency Risks

### 🟠 DEP-01: 28 Known Vulnerabilities (17 moderate, 10 high, 1 critical)
**Location:** `npm audit` output from Docker build
**Issue:** Production dependencies include packages with known CVEs.
**Key offenders:**
- `subscriptions-transport-ws` — deprecated, unmaintained
- `glob@10.5.0` — deprecated with known vulns (3 instances)
- `@apollo/server-plugin-landing-page-graphql-playground` — deprecated
**Fix:** Run `npm audit fix`. Remove deprecated packages. Replace `subscriptions-transport-ws` with `graphql-ws`.

### 🟡 DEP-02: React 19 + Apollo Client v4 Compatibility
**Issue:** Apollo Client v4 was released during React 18 era. Some hooks may have subtle issues with React 19's concurrent features and new ref handling.
**Mitigation:** Working fine currently, but watch for React 19 strictmode warnings.

### 🟡 DEP-03: No Lock on `@xp/shared` Version
**Location:** `apps/web/package.json` — `"@xp/shared": "^1.0.0"`
**Issue:** Uses caret range. In a monorepo this is resolved via workspace linking, but the version specifier could cause confusion. Lock to `"workspace:*"` for clarity.

---

## 8. Operational Risks

### 🟠 OPS-01: No Monitoring or Alerting
**Issue:** No error tracking (Sentry), no uptime monitoring (Pingdom/UptimeRobot), no performance monitoring (Datadog). If the API goes down, the only way to know is to visit the site.
**Fix:** Add Sentry (free tier) for error tracking. Add UptimeRobot (free) for uptime alerts.

### 🟡 OPS-02: Render Free Tier Cold Start
**Issue:** After 15 minutes of inactivity, the API container shuts down. Next request takes 30-50 seconds — the first query hangs and may timeout on the client.
**Impact:** Portfolio visitors may see a loading spinner for 30+ seconds, then assume the site is broken.
**Mitigation options:**
- Add a "waking up..." loading state on the frontend
- Use a cron job or external pinger to keep the service warm
- Accept it (it's free)

### 🟡 OPS-03: No CI/CD Pipeline
**Issue:** No GitHub Actions, no automated tests, no lint checks, no type checks on PR. Everything ships on push to main.
**Fix:** Add basic GitHub Actions: `npm ci && npm run build -w api && npm run build -w web && tsc --noEmit -p apps/web`.

### 🟢 OPS-04: No Health Check Endpoint
**Issue:** API has no explicit health check. Render uses TCP port detection, not HTTP health checks.
**Fix:** Add `GET /health` that returns `{ status: 'ok', timestamp: Date.now() }`.

---

## 9. Code Quality Issues

### 🟡 CQ-01: `as any` Used 40+ Times in Frontend
**Issue:** Metadata access is always cast with `(node.metadata as any)`. No type safety on the most-accessed fields.
**Fix:** Define typed metadata interfaces:
```typescript
interface TaskMetadata { priority: string; due: string; estimatedHours: number; ... }
interface SkillMetadata { totalHours: number; level: string; hoursToNext: number; }
```

### 🟡 CQ-02: Duplicate Mastery Constants
**Location:** `node.entity.ts` duplicates `NODE_TYPES` from `@xp/shared`
**Issue:** The shared package exports `NODE_TYPES`, but the entity file defines its own copy. If one is updated without the other, they'll desync.
**Fix:** Import from `@xp/shared` in the entity file.

### 🟡 CQ-03: No Tests
**Issue:** `nodes.service.spec.ts` and `nodes.resolver.spec.ts` exist but are default NestJS scaffolding — not actual tests. Zero test coverage.
**Impact:** Every change is manual verification only. Refactoring is risky.
**Fix:** Add integration tests for propagation engine (the most complex and critical code).

### 🟢 CQ-04: Inconsistent Date Field Names
**Issue:** Tasks use `metadata.due`. Projects use `metadata.dueDate`. Gantt code checks both: `m.due || m.dueDate`. This is a bug waiting to happen.
**Fix:** Standardize on one name (`dueDate`) and migrate existing data.

### 🟢 CQ-05: GCal Errors Silently Swallowed
**Location:** `nodes.service.ts` — `.catch(() => {})`
**Issue:** GCal sync failures are completely silent. If sync breaks, there's no indication.
**Fix:** At minimum, log the error. Better: track sync status on the node.

---

## 10. Deployment-Specific Issues (Encountered & Fixed)

| # | Issue | Root Cause | Fix | Commit |
|---|-------|-----------|-----|--------|
| 1 | `@xp/shared` not found in Docker | `dist/` gitignored, no build step | Added `npm run build --workspace=@xp/shared` to Dockerfile | `b9e74a8` |
| 2 | 26 TS errors blocking web build | `tsc -b` ran unused-import checks | Changed build to `vite build` only | `331d508` |
| 3 | Double-slash `//graphql` | Trailing slash in `VITE_API_URL` | Added `.replace(/\/+$/, '')` | `07c0fe2` |
| 4 | MongoDB connection refused | Atlas IP whitelist missing Render IPs | Added `0.0.0.0/0` to whitelist | Manual |
| 5 | Render port detection failed | Dockerfile set PORT=8080, Render expects 10000 | Set PORT=10000 in env vars | Manual |

---

## 11. Lessons Learned

### L-01: Authentication is not a feature — it's a foundation
Auth was deferred to Phase 11. This means 8 phases of features were built on a publicly accessible API. Retrofitting auth requires touching every resolver, adding user ownership to the data model, and updating every frontend query. Start with auth.

### L-02: Type safety doesn't end at TypeScript
TypeScript catches structural errors, but `Record<string, unknown>` metadata + `as any` casting defeats the purpose. The metadata field was convenient early but became a type-safety escape hatch that every view relies on. Define types upfront.

### L-03: "Works locally" is not deployment-ready
Three of five deployment issues were environment differences: gitignored files, TypeScript strictness differences between `vite dev` and `tsc -b`, and trailing slashes in env vars. Docker builds should be tested locally before deploying.

### L-04: Fetching everything is fine until it isn't
`GET_NODES` fetching all 49 nodes works great. At 500 nodes it'll be slow. At 5,000 it'll be unusable. The architecture decision to fetch everything client-side saved time early but creates a scalability ceiling.

### L-05: `children[]` as stored state is fragile
Maintaining both `parents[]` and `children[]` as stored arrays means every mutation must update both sides. This is a consistency problem that MongoDB doesn't enforce. Either derive `children` at read time (simpler, correct) or use database triggers.

### L-06: Separate your build and type-check steps
The `tsc -b && vite build` pipeline was correct in principle but coupled two separate concerns. When type errors blocked deployment, the fix was to remove type-checking entirely. Better: `tsc --noEmit` as a separate CI step, `vite build` for actual bundling.

### L-07: Free tier hosting is great for portfolio — with caveats
Render + Vercel + Atlas M0 = $0/month. But: 30-second cold starts, no monitoring, no backups, GCal tokens lost on restart, 512MB storage limit. Acceptable for a portfolio piece, but every limitation should be documented for anyone evaluating the system.

### L-08: Hardcoded paths are time bombs
`seed.ts` has `C:\\Projects\\XP\\xp-monorepo\\apps\\api\\.env` and `gcal.controller.ts` has `http://localhost:5173`. These work on one machine, break everywhere else. Always use env vars or relative paths.

### L-09: npm audit warnings are not just warnings
28 vulnerabilities (1 critical) shipped to production. Most are in transitive dependencies, but `subscriptions-transport-ws` is directly depended upon and unmaintained. Dependency auditing should be part of the build pipeline.

### L-10: Document decisions when you make them
The `XP.md` architecture doc is excellent — it captures the why behind each design choice. But deployment issues, security trade-offs, and "we'll fix it later" items were not tracked until this audit. Keep a running decision log.

---

## Summary

| Category | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low |
|----------|-------------|---------|-----------|--------|
| Auth & Access | 2 | — | — | — |
| API Security | — | 4 | 1 | — |
| Data Security | — | 1 | 2 | 1 |
| Secrets/Config | — | — | 3 | — |
| Architecture | — | 2 | 3 | — |
| Frontend | — | — | 2 | 2 |
| Dependencies | — | 1 | 2 | — |
| Operations | — | 1 | 2 | 1 |
| Code Quality | — | — | 3 | 2 |
| **Total** | **2** | **9** | **18** | **6** |

**Bottom line:** XP is a well-built portfolio project with a genuinely clever propagation engine. As a personal tool, the risks are acceptable — the data is demo/seed data, the user base is one, and the attack surface is low-value. As a production system for real users, it would need authentication, input validation, rate limiting, monitoring, and a scalable data fetching strategy before it could be trusted.
