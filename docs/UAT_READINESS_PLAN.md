# UAT Readiness Plan

This document outlines the necessary steps to transition the XP Monorepo from its current mature prototype stage to a state ready for User Acceptance Testing (UAT). The plan addresses missing features, critical technical debt, and system stability.

## Phase 1: Feature Completion (The "Plan Tomorrow" Gap) — ✅ COMPLETE
Before UAT can begin on the core game loop, the desktop planning experience must match the mobile execution reality.

- [x] **Implement `DayPlan` Data Model:** (`889bced`)
  - Create the `DayPlan` MongoDB schema and NestJS module (`apps/api/src/dayplan`).
  - Add GraphQL mutations/queries for `upsertDayPlan` and `dayPlan(date)`.
- [x] **Desktop Kanban "Plan Mode":** (`cfd7fdc`, fixes in `9658876`/`586e463`/`9592404`)
  - Update `apps/web/src/views/Kanban.tsx` to include the `plan` mode.
  - Replace the "Done" column with a reorderable "Tomorrow" column powered by the `DayPlan` record.
  - Implement drag-and-drop logic for manual routine and task ordering.
- [x] **Unify Mobile Queue:** (`3eb5af9`, `0a27328`)
  - Update `apps/web/src/mobile/MobileShell.tsx` to read the pre-seeded or manually ordered `DayPlan` to drive the morning Focus queue.

## Phase 2: Security & Stability (UAT Prerequisites)
To ensure the system doesn't break or expose data during UAT, fundamental security and reliability gaps must be closed.

- [ ] **Authentication & Authorization:**
  - Implement basic JWT-based authentication in the NestJS API.
  - Secure all GraphQL endpoints (currently open) using standard Auth guards.
- [ ] **ACID Transactions for XP Engine:**
  - Refactor `propagation.service.ts` to execute graph traversals (`onTaskCompleted`, `reopenTask`) within MongoDB transactions. This prevents inconsistent states if a network or logic failure occurs mid-propagation.
- [ ] **GCal Integration Hardening:**
  - Replace in-memory token storage with a persistent database approach.
  - Migrate hardcoded `localhost` redirect URIs to environment variables to support staging/production deployments.
- [x] **Persist People circles server-side (circles → TAG nodes):**
  - Empty circles currently live only in `localStorage` (`xp-empty-circles` in `People.tsx`) and the circle list is duplicated between `People.tsx` (`GROUP_META`) and `CreateNodeModal.tsx` (`PERSON_CIRCLES`) — multi-device UAT will desync.
  - Proposed: model circles as TAG nodes (`metadata.kind: 'circle'`) per XP.md "tags are first-class" — membership via `parents`, color from TAG `color`, rename = one title edit. Needs a one-off migration from `metadata.circle` strings. No schema/enum change.
  - (Merged to `main`. Run the one-off `npm run migrate:circles -w api` once against the DB to backfill existing `metadata.circle` strings into circle TAG nodes — see memory note "Circles as TAGs".)

## Phase 3: Performance & Type Safety (Fast Follows)
While UAT *could* start with the current over-fetching, it will degrade the experience rapidly.

- [ ] **Targeted Data Fetching:**
  - Replace the global "fetch all nodes" strategy. Implement view-specific queries (e.g., fetch only active tasks for mobile, fetch all for graph view).
  - Add server-side pagination for historical data (e.g., the "Done" list).
- [ ] **TypeScript / Metadata Refactor:**
  - Replace the generic `metadata: any` bag pattern with discriminated unions in the GraphQL schema and TypeScript definitions to eliminate runtime type errors and brittle `as any` casts.

### Node property / editability audit (2026-06-14)

Full spec lives in `NODE.md` §3.1–3.3. Findings from auditing every node type against the schema, `CreateNodeModal`, `NodeDetail`, and `propagation.service`, ranked. The well-scoped create-only gaps were executed in this pass; the architectural items remain open.

- [x] **ROUTINE / PROJECT / TASK / TAG create-only field gaps** — fields that could be set at creation but never edited afterward are now editable in the Node Detail panel:
  - ROUTINE `cadence` (recomputes `weekTarget`), `target`, `group` (+ `timeOfDay`, fixed earlier).
  - PROJECT `status` (was plain text), `startDate`, `dueDate` (previously Gantt-only).
  - TASK `startDate` (previously Gantt-only / read-only).
  - TAG `color` editor + `kind` badge (TAG nodes previously had no Detail editor at all).
- [ ] **🔴 Reconcile the two parallel tag systems** — `metadata.tags` free-strings (Detail "Tags" card, `window.prompt`) vs first-class TAG nodes linked via `parents` ("Additional parents" / graph). `NODE.md` §2 declares the parent-based model canonical, but the UI writes free strings. Decide migration + single mechanism **before** reworking the tag UI. Needs a design pass (data-model change + Obsidian-sync implications).
- [ ] **🟠 Full Connections editing in Node Detail** — allow adding/removing arbitrary PERSON/TAG `parents` from the panel, not just `mainParent` + skills + circle, to match `NODE.md` §2.
- [ ] **🟡 Replace `window.prompt`** for adding tags and naming new circles with inline inputs consistent with the rest of the UI.
- [ ] **🟡 "Log catch-up" action** on PERSON — one click sets `lastCatchup = today` and bumps `nextCatchup`, instead of manual date entry.

## Phase 4: UAT Execution Setup
Once development is complete, testers will evaluate the core loops.

- [ ] **Scenario 1: Fast Capture & Organization:** Test creating tasks, routines, and skills via the Desktop modal and Mobile FAB. Verify sticky defaults.
- [ ] **Scenario 2: Desktop Planning (DayPlan):** Test moving tasks and routines into the "Tomorrow" column in Kanban plan mode.
- [ ] **Scenario 3: Mobile Focus Execution:** Test the morning routine: working through the ordered queue, using the Timer, and utilizing the Snooze / Dismiss (Tomorrow) / Finish actions. Check for the non-inflating counter.
- [ ] **Scenario 4: The Game Loop (XP):** Complete a task and verify that progress rolls up correctly to parent Projects and hours are credited to linked Skills. Undo the action and verify the reversal.
