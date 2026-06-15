# Project XP: Node Logic & Relationship Rules

XP uses seven structured node types. **NOTE and IDEA are not XP node types** — they live in Obsidian Second Brain natively and are never stored in MongoDB. They appear in these tables for reference because they participate in the shared domain and tag system.

**XP node types:** `DOMAIN` · `SKILL` · `PROJECT` · `TASK` · `PERSON` · `TAG` · `ROUTINE`
**Obsidian-only types:** `NOTE` · `IDEA`

---

## 1. Allowed Main Parents (The Tree Hierarchy)

The `mainParent` field defines the canonical path of a node (e.g., `Work → Dev → Project XP → Task 1`). It drives breadcrumbs, tree-view navigation, and the Obsidian folder structure.

The UI combobox filters available `mainParent` options by node type:

| Node Type | Allowed `mainParent` Types | Where it lives |
| :--- | :--- | :--- |
| **DOMAIN** | Another `DOMAIN` (sub-domain) or `None` (root) | XP + Obsidian folder |
| **SKILL** | `DOMAIN` only | XP + Obsidian file |
| **PROJECT** | `DOMAIN` only | XP + Obsidian folder |
| **TASK** | `PROJECT`, `DOMAIN`, or another `TASK` (sub-tasks) | XP + Obsidian file |
| **PERSON** | `DOMAIN` only (e.g., "Relationships", "Work") | XP + Obsidian file |
| **TAG** | `None` — float globally, connected via `parents` array | XP + `_tags/` in Obsidian |
| **ROUTINE** | `DOMAIN` only | XP + Obsidian file |
| **NOTE** ★ | Domain folder in Obsidian — no XP `mainParent` | Obsidian only |
| **IDEA** ★ | Domain folder in Obsidian — no XP `mainParent` | Obsidian only |

> ★ Obsidian-only. Not stored in MongoDB. Not managed by XP. Use the Note or Idea template in `06 - Templates/`.

---

## 2. Multi-Parent Connections (The Graph / Tagging)

The `parents` array handles secondary connections and tagging. It is separate from `mainParent`.

- **Example:** A TASK's `mainParent` is "Project XP", but its `parents` array also includes "Alice (PERSON)" and "Urgent (TAG)".
- **Management:** Set explicitly via the **Connections** field in the Node Detail Panel, not inferred from text.
- **Tags:** Assigning a TAG means adding the TAG node's `_id` to `parents`. The sync layer reads this to write `tags: [...]` in Obsidian frontmatter for cross-system filtering.

---

## 3. Type-Specific Metadata (Properties)

All XP nodes share the universal schema (`title`, `type`, `description`, `parents`, `children`). Type-specific fields live in the `metadata` JSON object and are rendered conditionally in the Node Detail Panel. NOTE and IDEA have no MongoDB schema — their fields are Obsidian frontmatter only.

| Node Type | Fields | Where stored |
| :--- | :--- | :--- |
| **TASK** | `priority` (high/medium/low), `estimatedHours`, `actualHours`, `due` (ISO date string), `startDate` (ISO, set via Gantt), `sprint` (label, set via Kanban), `creditedHours`, `completedAt` (ISO), `completedDate` (YYYY-MM-DD, local), `timeEntries: [{start: ISO, end?: ISO}]`, `gcalEventId` | MongoDB `metadata` |
| **PROJECT** | `startDate`, `dueDate`, `gcalEventId` — `status` and `progress` on root schema | MongoDB `metadata` |
| **SKILL** | `totalHours` (accumulated), `level` (unfamiliar/familiar/skilled/master/world_class), `hoursToNext` (hours remaining to next tier) — all computed, read-only | MongoDB `metadata` |
| **PERSON** | `role`, `email`, `phone`, `initials`, `nextCatchup` (ISO date), `lastCatchup` (ISO date) — `catchupState` (upcoming/overdue/none) and `relativeDate` (human label e.g. "in 3 days") are **derived at render** from `nextCatchup` (`getPersonCatchup` in `apps/web/src/lib/queue.ts`), never stored. Circle membership is **not** metadata — it's a TAG node with `metadata.kind: 'circle'` linked via the PERSON's `parents` (single circle per person, UI-enforced). | MongoDB `metadata` |
| **DOMAIN** | _(none — progress computed from children)_ | — |
| **TAG** | `color` hex — UI chip rendering. `kind` (optional) — `'circle'` marks a People-view circle grouping; for circle tags, `color` is optional and the web falls back to name-based default colors when absent. | MongoDB `metadata` |
| **ROUTINE** | `cadence` (daily/weekly/monthly), `target` (string e.g. "30 min"), `timeOfDay` (morning/afternoon/evening/night), `group` (optional label), `skips: [YYYY-MM-DD]` (per-day "not today" dismissals from the Focus deck — always daily regardless of cadence), `checkIns: [{date: YYYY-MM-DD, hours: number}]`, `streak`, `bestStreak`, `thisWeek`, `weekTarget`, `lastCheckInDate` (YYYY-MM-DD), `creditedHours`, `timeEntries: [{start: ISO, end?: ISO}]` | MongoDB `metadata` |
| **NOTE** ★ | `domain`, `source` (optional), `xp_link` (optional wikilink to related XP node) | Obsidian frontmatter |
| **IDEA** ★ | `domain`, `idea_status` (raw / evaluating / developed / shelved), `xp_link` (optional) | Obsidian frontmatter |

> `totalHours`, `level`, and `hoursToNext` on SKILL nodes are computed by the propagation engine on every `completeTask` or `checkInRoutine` mutation. Never set manually.
>
> ROUTINE check-ins are stored as `checkIns: [{date, hours}]` (one entry per day). The legacy `checkInDates: string[]` format is automatically migrated to this structure on read.
>
> ★ Obsidian-only. See `06 - Templates/Note Template.md` and `06 - Templates/Idea Template.md`.

---

## 3.1 Property Classes

Every property is one of three classes. This is the lens for "should it be editable":

| Class | Meaning | Editable? | Examples |
| :--- | :--- | :--- | :--- |
| **User-set** | Entered by the user | ✅ editable wherever it matters | `priority`, `due`, `role`, `cadence`, `timeOfDay`, TAG `color` |
| **Engine-computed** | Written by `propagation.service.ts` on `completeTask` / `checkInRoutine` / timer stop | ❌ read-only always | SKILL `totalHours`/`level`/`hoursToNext`; ROUTINE `streak`/`bestStreak`/`thisWeek`/`checkIns`/`lastCheckInDate`; TASK `actualHours`/`creditedHours`/`completedAt`/`completedDate`; PROJECT & DOMAIN `progress` |
| **Derived-at-render** | Never stored; computed in `apps/web/src/lib/queue.ts` | ❌ not a stored field | PERSON `catchupState`/`relativeDate`; PERSON circle (read from TAG parent); PERSON `initials` (derived on save) |

> **No server-side validation.** `CreateNodeInput` / `UpdateNodeInput` accept `metadata` as opaque `GraphQLJSON`. The shape of `metadata` is enforced only by the React forms and the propagation engine. A discriminated-union refactor is tracked in `docs/UAT_READINESS_PLAN.md` Phase 3.

---

## 3.2 Editability & Surfacing Matrix

Where each **user-set** property can be edited, and where it is surfaced read-only across views. (Computed/derived fields omitted — always read-only per §3.1.)

| Type | Property | Create modal | Node Detail | Also surfaced in |
| :--- | :--- | :---: | :---: | :--- |
| **TASK** | `status` | ✅ | ✅ segmented | Kanban (column), Calendar |
| | `priority` | ✅ | ✅ | Kanban card |
| | `estimatedHours` | ✅ | ✅ | — |
| | `due` | ✅ | ✅ date | Kanban card, Calendar, Gantt |
| | `startDate` | ✖ | ✅ date | Gantt (drag), Calendar |
| | `progress` | ✖ | ✅ slider (manual; auto→100 on complete) | — |
| | `sprint` | ✖ | 👁 read-only (set via Kanban) | Kanban sprint board |
| **ROUTINE** | `cadence` | ✅ | ✅ select (recomputes `weekTarget`) | Routines |
| | `target` | ✅ | ✅ input | Routines, Focus deck |
| | `timeOfDay` | ✅ | ✅ select | Routines grouping, Mobile/Plan queue order |
| | `group` | ✅ | ✅ input | Routines section header |
| **PROJECT** | `status` | ✅ | ✅ segmented | Kanban, Dashboard |
| | `startDate` / `dueDate` | ✖ | ✅ date | Gantt, Calendar |
| **PERSON** | `role` / `email` / `phone` | ✅ | ✅ | People card |
| | circle (TAG parent) | ✅ select+new | ✅ select+new | People grouping, Graph |
| | `nextCatchup` / `lastCatchup` | ✖ | ✅ date | People (overdue badge) |
| **TAG** | `color` | (circles only, via People) | ✅ color picker | chips everywhere |
| | `kind` (`'circle'`) | set when creating a circle | 👁 read-only badge | People (circle grouping) |
| **SKILL** | _(no user-set type fields)_ | — | universal only | Skills, SkillPicker |
| **DOMAIN** | _(no user-set type fields)_ | — | universal only | tree, Dashboard |

**Universal, all types:** `title` (header, inline), `description` (Detail textarea), `mainParent` (Detail → Connections → ParentPicker, type-filtered per §1), `metadata.tags` free-string list (Detail → Tags card).

### Editability conventions

- **Node Detail uses batched save.** All edits mutate local React state and persist together via one `updateNode` on **Save changes**. New Detail editors MUST follow this — do not auto-save individual fields in the panel.
- **List/board quick-edits save immediately** (Kanban drag, Routines check-in, People inline). That is the exception, reserved for high-frequency actions outside the Detail panel.
- **Never expose computed fields as editable** (§3.1). When a user-set field feeds a computed one, recompute on save — e.g. editing ROUTINE `cadence` must reset `weekTarget` (`daily → 7`, else `1`).

---

## 3.3 Known Spec Gaps (tracked)

Open inconsistencies between this spec and the implementation, ranked. Full detail and status in `docs/UAT_READINESS_PLAN.md` Phase 3.

1. **🔴 Two parallel tag systems.** §2 says a tag = a TAG node's id in `parents`. But the Detail "Tags" card edits `metadata.tags` as free strings (no TAG node, not in the graph), while graph-linked TAGs appear under "Additional parents." These must be reconciled before the tag UI is reworked. **Not yet resolved.**
2. **🟠 Connections editing is partial.** §2 says additional parents are "set explicitly via the Connections field," but the Detail panel only edits `mainParent`, linked skills, and (PERSON) circle. Arbitrary PERSON/TAG parents cannot be added/removed from the panel yet. **Not yet resolved.**
3. **🟡 No server-side metadata validation** (§3.1) — Phase 3 discriminated-union refactor. **Not yet resolved.**
4. **🟡 `window.prompt`** is still used for adding free-string tags and naming new circles — to be replaced with inline inputs. **Not yet resolved.**

---

## 4. Obsidian Sync Implications

| Node Type | Obsidian location | Synced by XP? |
| :--- | :--- | :--- |
| **DOMAIN** | Folder at its `mainParent` path. Auto-creates folder + `_xp_index.md`. | Yes — on every mutation |
| **SKILL** | File inside its DOMAIN folder | Yes |
| **PROJECT** | Folder inside its DOMAIN folder. Own file is `_index_xp_<id>.md`. | Yes |
| **TASK** | File inside its PROJECT or DOMAIN folder | Yes |
| **PERSON** | File inside its DOMAIN folder | Yes |
| **TAG** | `_tags/{name}_{id}.md`. Also written as `tags: [...]` in all related frontmatter. | Yes |
| **ROUTINE** | File inside its DOMAIN folder | Yes |
| **NOTE** ★ | Hand-written anywhere in the domain folders. Uses shared `tags` frontmatter. | No — Obsidian-native |
| **IDEA** ★ | Hand-written anywhere in the domain folders. Uses shared `tags` frontmatter. | No — Obsidian-native |

> ★ NOTE and IDEA files can link to XP nodes using `[[Alias]]` wikilinks (XP-pushed files expose `aliases` in frontmatter). Use `xp_link` frontmatter to declare the primary XP connection explicitly.
