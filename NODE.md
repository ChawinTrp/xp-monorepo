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
| **TASK** | `dueDate`, `priority` — `status` dropdown, `progress` bar | MongoDB `metadata` |
| **PROJECT** | `startDate`, `dueDate` — `status`, `progress` (computed) | MongoDB `metadata` |
| **SKILL** | `level`, `xp` (both computed, read-only) | MongoDB `metadata` |
| **PERSON** | `email`, `phone`, `nextCatchupDate` | MongoDB `metadata` |
| **DOMAIN** | _(none)_ | — |
| **TAG** | `color` hex — UI chip rendering | MongoDB `metadata` |
| **ROUTINE** | `cadence` (daily/weekly/monthly), `streak`, `bestStreak`, `group`, `target`, `thisWeek`, `weekTarget`, `history` (30-day boolean array) | MongoDB `metadata` |
| **NOTE** ★ | `domain`, `source` (optional), `xp_link` (optional wikilink to related XP node) | Obsidian frontmatter |
| **IDEA** ★ | `domain`, `idea_status` (raw / evaluating / developed / shelved), `xp_link` (optional) | Obsidian frontmatter |

> `level` and `xp` on SKILL nodes are computed by the progress propagation engine (Phase 7). Never set manually.
> ★ Obsidian-only. See `06 - Templates/Note Template.md` and `06 - Templates/Idea Template.md`.

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
