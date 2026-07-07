# Design: API Key Auth + Phase 10 Obsidian Sync + GCal Token Persistence

**Date:** 2026-07-07
**Branch:** `feat/auth-obsidian-sync`
**Status:** Approved (autonomous session — decisions made per XP.md §12 and Audit Log §11)

## Goals

Close the two documented gaps in XP.md §11 (Audit Log) plus one functional fix:

1. **Auth** — the API is public; anyone with the URL can read/mutate all data.
2. **Obsidian sync** — Phase 10 `ObsidianSyncService` is designed (XP.md §12) but not implemented.
3. **GCal token persistence** — OAuth tokens are in-memory; lost on every Render restart.

## 1. Auth — Static API Key (Phase 11-lite)

Single-user app. A shared-secret bearer token is the right size; JWT/multi-user stays Phase 11.

- **Env:** `XP_API_KEY` on the API. **Unset → auth disabled** (local dev unchanged). Set → enforced.
- **Guard:** global `ApiKeyGuard` (registered via `APP_GUARD` in `AppModule`). Checks
  `Authorization: Bearer <XP_API_KEY>` on every HTTP + GraphQL request. Comparison via
  `crypto.timingSafeEqual`.
  - GraphQL: extract `req` via `GqlExecutionContext`; requires `context: ({ req }) => ({ req })`
    in the GraphQLModule config.
  - `@Public()` decorator exempts: `GET /` (health), `GET /gcal/callback` (Google redirects the
    browser there without our header — the `code` param is single-use and validated by Google).
- **Web:** key stored in `localStorage.xp_api_key`. `main.tsx` HttpLink sends the header when
  present. Settings gets an "API Key" section (password input, save → reload). GCal fetches in
  Settings also send the header.
- **MCP server:** reads `XP_API_KEY` env, adds the same header in its GraphQL requester.
- **Docs:** DEPLOYMENT.md env-var table entry: set `XP_API_KEY` on Render, key in Vercel is NOT
  an env var (it's per-browser localStorage).

Failure mode: wrong/missing key → 401 (REST) / GraphQL error. No lockout, no rotation UI — rotate
by changing the env var.

## 2. Obsidian Sync — Phase 10 (implements XP.md §12 as spec'd)

`ObsidianSyncService` in `apps/api/src/obsidian/`, interface exactly per §12.10:

- `upsertNode(node)`, `deleteNode(node)`, `regenerateIndex(domainPath)`, private `buildPath`,
  `buildContent`, `resolveTagNames`.
- **Enabled only when `OBSIDIAN_VAULT_PATH` is set** (local dev; Render has no vault → no-op).
- Path rules per §12.3–12.5: mainParent DOMAIN chain → folders, `{slug}_{id}.md` filenames,
  TAG nodes → `_tags/`. Simplification from spec: only DOMAIN nodes become folders
  (`_index_xp_{id}.md` inside); PROJECTs (and every other non-DOMAIN type) are flat files in
  their nearest DOMAIN ancestor's folder — no project subfolders.
- Frontmatter per §12.6 (only non-empty fields), body per §12.8 (title header, parent/tag
  wikilinks, plain-text description).
- `obsidianPath` stored on the node; rename/move → delete old file, write new (§12.9).
- `_xp_index.md` regenerated for affected domain folders; `_index.md` never touched.
- **Hook points** (fire-and-forget, same pattern as GCal, sync failures never fail the mutation):
  - `NodesService.create/update/remove`
  - `archive` → delete file (vault mirrors active data); `unarchive` → upsert.
  - Propagation mutations (`completeTask`, `checkInRoutine`, timers) return affected nodes —
    resolver fires `upsertNode` for each returned node.

## 3. GCal Token Persistence (functional fix)

- New single-doc Mongoose collection `gcalstate`: `{ tokens, calendarId }`.
- `GCalService`: load state on `onModuleInit`; save after `handleCallback` and on the OAuth2
  client's `tokens` refresh event.
- Also fix the hardcoded `http://localhost:5173` redirect in `gcal.controller.ts` →
  `process.env.WEB_URL ?? 'http://localhost:5173'`.

## Testing

- **ApiKeyGuard:** unit tests — no env = allow; env set: valid/invalid/missing header; @Public bypass.
- **ObsidianSyncService:** unit tests against a temp dir — slugify, buildPath (root domain,
  nested domain, TAG), frontmatter output, upsert/rename/delete lifecycle, index regeneration,
  disabled when env unset.
- **GCal state:** service test with mocked model — load on init, save on callback.
- Existing suites (`api`, `mcp-server`, `shared`) must stay green.

## Out of Scope

- JWT / multi-user (Phase 11), MCP scope enforcement, tag-dualism reconcile, graph pagination.
