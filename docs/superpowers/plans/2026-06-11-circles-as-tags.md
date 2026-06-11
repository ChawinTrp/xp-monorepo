# Circles as TAG Nodes — Implementation Plan (2026-06-11)

## Why

People-view circles are currently `metadata.circle` strings on PERSON nodes. Three problems:
1. **Empty circles persist only in `localStorage`** (`xp-empty-circles`, People.tsx) — device-local, violates "MongoDB is source of truth".
2. **Circle list duplicated** between `People.tsx` (`GROUP_META`) and `CreateNodeModal.tsx` (`PERSON_CIRCLES`).
3. **Rename/delete impossible** without bulk-editing every member's metadata string.

XP.md already declares TAG nodes first-class graph relationships ("assigning a tag = adding the Tag Node's ID to `parents`"). Circles become TAG nodes — zero schema changes.

## Design

- **Circle = TAG node** with `metadata.kind: 'circle'` and optional `metadata.color` (CSS color string).
- **Membership** = circle TAG `_id` present in `PERSON.parents`. The API already bidirectionally syncs `parents`/`children` on createNode/updateNode (`nodes.service.ts`).
- **Single circle per person**, enforced in the UI (when changing circle, remove all other circle-tag ids from `parents`).
- **Empty circle** = a circle TAG with no PERSON members — persisted in MongoDB. `localStorage` registry deleted.
- **Colors/icons**: `tag.metadata.color` wins if set; otherwise the existing name-based `GROUP_META` defaults in the web (single fallback table in `lib/circles.ts`); generic fallback for unknown names.
- **Display fallback**: a PERSON with no circle tag renders under the circle named `Network` (display-only — no data written), matching previous behavior.
- **Vestigial fields removed**: `metadata.circle` migrated away; `metadata.catchupState` / `metadata.relativeDate` writes dropped everywhere (they are derived at render by `getPersonCatchup` since `a6926e5`).
- **Default circles** (created by migration + seed): Family, Close Friends, Core Team, Aura Team, Mentors, Network.

Out of scope: `metadata.tags` (free-string tags on nodes) — separate mechanism, untouched.

## Tasks

### Task 1 — `lib/circles.ts` helper + People view

New file `apps/web/src/lib/circles.ts`:
- `CIRCLE_DEFAULTS`: ordered array of the 6 default circle names with color + icon name (move `GROUP_META` content here; keep `Icons.*` mapping in People.tsx if importing icons into lib is awkward — in that case export name+color and let People map icons).
- `isCircleTag(node)`: node.type === 'TAG' && node.metadata?.kind === 'circle'.
- `circleTagsOf(nodes)`: all circle TAGs ordered: defaults first (by CIRCLE_DEFAULTS order), then the rest alphabetically by title.
- `circleOfPerson(person, circleTags)`: the circle TAG whose `_id` is in `person.parents` (first match) or null.
- `circleColorOf(tag)`: `tag.metadata.color ?? default-by-name ?? 'var(--c-routine)'`.

`apps/web/src/views/People.tsx`:
- Circles come from `byType('TAG')` filtered by `isCircleTag` — **delete** `GROUP_META` (move to lib), **delete** the `emptyCircles` state, its `useEffect` pruning, and ALL `localStorage` `xp-empty-circles` usage. On mount, `localStorage.removeItem('xp-empty-circles')` once to clean the stale key.
- Grouping: `byGroup` keyed by circle tag `_id` via `circleOfPerson`. People with no circle tag go under the tag titled `Network` if it exists, else under a trailing "Unsorted" pseudo-section.
- Every circle TAG renders as a section even with 0 members (this is what replaces emptyCircles); the existing "Add contact" dashed button stays for empty sections and passes the circle **name** as `defaultCircle`.
- "New circle" button: instead of localStorage, call the `CREATE_NODE` mutation (`lib/graphql`) with `{ title: name, type: 'TAG', metadata: { kind: 'circle' } }` (no mainParent — TAG has none), `refetchQueries: [{ query: GET_NODES }]`. Keep the `window.prompt` UX. Reject empty/duplicate names (case-insensitive match on existing circle tags) with a toast or silent no-op.
- Header count "`N` circles" = number of circle TAGs.
- Sort modes (`nextCatchup` / `lastCatchup`) unchanged; `PersonChip` color comes from the person's circle tag via `circleColorOf`.

Verify: `npx tsc -b` in apps/web introduces no NEW errors vs the pre-existing baseline (28 known errors — compare against `git stash` baseline if unsure); `npm run build -w web` passes.

### Task 2 — CreateNodeModal

`apps/web/src/components/CreateNodeModal.tsx`:
- **Delete** `PERSON_CIRCLES`. `circleOptions` = circle TAG titles from `circleTagsOf(byType('TAG'))` + `defaultCircle` prop if new (de-duped, ordered).
- The `circle` state stays a **name** (capture pref `CAPTURE_KEYS.circle` keeps storing the name; if the stored name no longer matches a circle tag at open, fall back to `'Network'`).
- On submit for PERSON: resolve the selected circle name → circle tag `_id`; include that id in the `parents` array sent to `createNode` (alongside `parentId` and `linkedSkillIds`). **Stop writing** `metadata.circle` and **stop writing** `metadata.catchupState = 'none'` (derived field).
- `+ New circle...` option: on prompt, create the TAG node first via `createNode` (`{ title, type: 'TAG', metadata: { kind: 'circle' } }`), then select it. If the modal is mid-form this is fine — two sequential mutations.
- If the selected circle name resolves to no tag at submit (race/deleted), omit the circle parent rather than failing the create.

Verify: same as Task 1.

### Task 3 — NodeDetail

`apps/web/src/views/NodeDetail.tsx`:
- The `circle` state becomes the selected circle tag `_id` (`''` = none). Initialize from `n.parents` ∩ circle tag ids (use `circleOfPerson`).
- `circleOptions` = circle TAGs (id + title), same ordering helper.
- On save (the existing parent-surgery block ~line 155-205): `keptParents` must ALSO exclude circle-tag ids (like it excludes SKILLs and old mainParent); then append the selected circle id if set. **Delete** the `newMeta.circle` write/delete logic.
- `+ New circle...`: create TAG via `createNode` mutation, then select its id (NodeDetail already imports mutations; add CREATE_NODE if missing).
- Display: wherever the circle name was shown, resolve from the tag node title.

Verify: same as Task 1. Manual check: changing a person's circle twice leaves exactly one circle-tag id in `parents`.

### Task 4 — API: migration script + seed

New `apps/api/src/migrate-circles.ts` (mirror `seed.ts`'s dotenv/mongoose-connect pattern, including the .env fallback path):
1. Ensure a TAG `{ type:'TAG', metadata.kind:'circle' }` exists for each of the 6 defaults AND each distinct non-empty `metadata.circle` value found on PERSON nodes (match existing by title, case-sensitive). Create missing ones.
2. For each PERSON with `metadata.circle`: `$addToSet` the circle tag `_id` into `parents`, `$addToSet` the person `_id` into the tag's `children`, `$unset metadata.circle`.
3. For ALL PERSON nodes: `$unset` `metadata.catchupState` and `metadata.relativeDate` (vestigial — derived at render since a6926e5).
4. Idempotent (safe to re-run), logs a summary (tags created, people migrated, fields cleaned).
- Add npm script in apps/api: `"migrate:circles": "ts-node src/migrate-circles.ts"` (with a `premigrate:circles": "npm run build:shared"` guard ONLY if the script imports @xp/shared; skip the guard otherwise).

`apps/api/src/seed.ts`:
- Seed the 6 default circle TAGs plus any extra circle names used by seed people (`Work` is used — keep it as a 7th tag or change that person to `Core Team`; keep `Work` to exercise the custom-circle path).
- Seed people: replace `metadata.circle` with the circle tag `_id` in `parents` AND the person `_id` in the tag's `children` (seed writes documents directly, bypassing the service sync — both sides must be set explicitly).
- Remove `catchupState` and `relativeDate` from seeded people metadata (keep `nextCatchup`).

Verify: `npx tsc --noEmit -p apps/api/tsconfig.json` clean. Do NOT run the migration or seed against the database — the controller runs the migration after review.

### Task 5 — Docs

- `NODE.md`: PERSON row — remove `circle` from metadata, note "circle = TAG node with `metadata.kind:'circle'` linked via `parents` (single circle per person, UI-enforced)". TAG row — add `kind` (`'circle'` marks a People-view circle). 
- `XP.md`: People view section (~line 714) — mention circle grouping is TAG-based.
- `docs/UAT_READINESS_PLAN.md`: check off the "Persist People circles server-side" item.

## Execution notes

- Branch: `feat/circles-as-tags` off `main`.
- Web has no test runner; "tests" = typecheck-vs-baseline + `vite build` + controller's browser verification at the end.
- Pre-existing web `tsc -b` baseline: 28 errors (unused vars + untyped Apollo generics) — do not fix, do not add to them.
