# Project XP: Node Logic & Relationship Rules

To prevent the Graph from becoming a chaotic "hairball," Project XP enforces strict relationship rules and type-specific metadata properties.

## 1. Allowed Main Parents (The Tree Hierarchy)

The `mainParent` field dictates the canonical path of a node (e.g., for breadcrumbs: `Life` -> `Work` -> `Dev` -> `Project XP` -> `Task 1`).

When linking a `mainParent`, the UI Combobox will strictly filter available options based on the following rules:

| Node Type | Allowed Main Parent Types |
| :--- | :--- |
| **DOMAIN** | Another `DOMAIN` (Sub-domains) or `None` (Root) |
| **SKILL** | Must be parented by a `DOMAIN` |
| **PROJECT** | Must be parented by a `DOMAIN` |
| **TASK** | `PROJECT`, `DOMAIN`, or another `TASK` (Sub-tasks) |
| **NOTE** | `PROJECT`, `DOMAIN`, `IDEA`, or `PERSON` (e.g., meeting notes) |
| **IDEA** | Must be parented by a `DOMAIN` (e.g., "Business Ideas") |
| **PERSON** | Must be parented by a `DOMAIN` (e.g., "Relationships" or "Work") |
| **TAG** | `None` (Tags float globally and are applied via the `parents` array) |

---

## 2. Multi-Parent Connections (The Graph / Tagging)

The `parents` array is used for secondary structural connections and tagging.

- **Example:** A `TASK`'s `mainParent` is "Project XP", but its `parents` array includes "Alice (PERSON)" and "Urgent (TAG)".
- **Management:** These connections are explicitly managed via the dedicated **Connections** property field, not by mentioning them in the text.

---

## 3. Type-Specific Metadata (Properties)

While all nodes share the **Universal Node schema** (`title`, `type`, `content`), certain fields will only render in the UI based on the selected type.

| Node Type | Specific UI Fields & Metadata to Render |
| :--- | :--- |
| **TASK** | `status` (TODO/IN_PROGRESS/DONE), `progress` (0-100), `dueDate` |
| **PROJECT** | `status`, `progress` (Calculated), `startDate`, `dueDate` |
| **SKILL** | `level` / `xp` (Calculated), `progress` |
| **PERSON** | `email`, `phone`, `nextCatchupDate` |
| **NOTE / IDEA** | None (Focus solely on content) |
| **TAG** | Color hex code (for UI rendering) |

> **Implementation Note:** These metadata fields will be stored in a flexible JSON `metadata` object within the MongoDB Node schema, keeping the root schema clean while allowing infinite flexibility.
