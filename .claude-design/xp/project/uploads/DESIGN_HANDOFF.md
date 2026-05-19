# XP — Design Handoff for Claude Design

> Use this document to create high-fidelity UX/UI mockups for Project XP.
> Read the full architecture in `XP.md` and node rules in `NODE.md` in this same repo.

---

## 1. What is XP?

A **personal life operating system** with two pillars:

- **The Game** — goal, skill, and task tracking with gamified XP progression and skill leveling
- **The Orchestra** — project management (Kanban, Gantt, sprints) and relationship orchestration

XP is **not** a note-taking app. Notes and ideas live in Obsidian Second Brain. XP handles only structured, actionable data: Domains, Skills, Projects, Tasks, Persons, and Tags.

**User:** Single user (CT) — power user, dark-theme preference, keyboard-heavy workflow.

---

## 2. Node Types & Color System

Every entity in XP is a "Node." Six types, each with a fixed color:

| Type | Color | Hex | Icon (Lucide) | Description |
|------|-------|-----|---------------|-------------|
| DOMAIN | Blue | `#89b4fa` | `Layers` | Life areas (Work, Personal, Learning) |
| SKILL | Green | `#a6e3a1` | `Zap` | Trackable skills with XP/levels |
| PROJECT | Orange | `#fab387` | `FolderKanban` | Scoped work with start/end dates |
| TASK | Gray | `#9399b2` | `CheckSquare` | Actionable items with status |
| PERSON | Pink | `#f5c2e7` | `User` | Contacts with catch-up tracking |
| TAG | Yellow | `#f9e2af` | `Tag` | Cross-cutting labels |

---

## 3. Design Language

### Theme: Catppuccin Mocha (Dark)

| Token | Hex | Usage |
|-------|-----|-------|
| Base | `#1e1e2e` | Page background |
| Mantle | `#181825` | Sidebar background |
| Surface 0 | `#313244` | Card backgrounds |
| Surface 1 | `#45475a` | Hover states, borders |
| Overlay 0 | `#6c7086` | Disabled text, dividers |
| Text | `#cdd6f4` | Primary text |
| Subtext 1 | `#a6adc8` | Secondary text, breadcrumbs |
| Subtext 0 | `#bac2de` | Placeholder text |
| Accent (Purple) | `#cba6f7` | Primary actions, active states, links |
| Red | `#f38ba8` | Overdue, errors, delete |
| Green | `#a6e3a1` | Success, completed, SKILL |
| Yellow | `#f9e2af` | Warnings, TAG |

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Page title | Inter | 700 | 24px |
| Section header | Inter | 600 | 18px |
| Card title | Inter | 600 | 14px |
| Body text | Inter | 400 | 14px |
| Metadata / IDs | JetBrains Mono | 400 | 12px |
| Breadcrumb | Inter | 400 | 12px |

### Spacing & Layout

- **Grid:** 4px base unit
- **Card padding:** 16px
- **Section gaps:** 24px
- **Sidebar width:** 240px (collapsible to 48px icon rail)
- **Border radius:** 8px (cards), 4px (badges/chips), 16px (buttons)
- **Transitions:** 200ms ease

### Core Components

| Component | Description |
|-----------|-------------|
| **NodeCard** | Compact card: title (bold), type badge, due date, priority dot, tag chips. Used in Kanban, Dashboard, lists. Height ~64px. |
| **TypeBadge** | Rounded chip with type icon + label, background = type color at 15% opacity, text = type color. 24px height. |
| **ProgressBar** | Rounded bar, filled portion in type color (green for SKILL, orange for PROJECT). 8px height, full-width within parent. |
| **StatusDot** | 8px circle. TODO = `#9399b2`, IN_PROGRESS = `#89b4fa`, DONE = `#a6e3a1`. |
| **TagChip** | Small rounded pill, background `#f9e2af` at 15% opacity, text `#f9e2af`. 20px height. Click to filter. |
| **SmartSearchInput** | Combobox with type-ahead dropdown. Shows type badges in results. Filters by allowed parent types per selection context. |
| **StreakBadge** | Flame icon + number. Orange gradient when active, gray when broken. |

---

## 4. App Shell

### Layout

```
+--[ SIDEBAR 240px ]--+--[ MAIN CONTENT ]------------------+
|                      |  [ TOP BAR ]                       |
|  [Logo: "XP"]        |  Breadcrumb: Work > Dev > Project  |
|  [Search: Cmd+K]     |  View tabs: Dashboard | Graph |    |
|                      |           Kanban | Skills | People  |
|  DOMAIN TREE:        +------------------------------------+
|  > Work              |                                    |
|    > Dev             |  [ VIEW CONTENT ]                  |
|      > Project XP    |                                    |
|        - Task 1      |  (renders the active route)        |
|        - Task 2      |                                    |
|    > Finance         |                                    |
|  > Personal          |                                    |
|  > Learning          |                                    |
|                      |                                    |
|  [+ Quick Create]    |                                    |
+----------------------+------------------------------------+
```

### Sidebar Details

- **Logo area:** "XP" wordmark in accent purple, top-left
- **Search trigger:** Input-styled button showing "Search... Cmd+K", opens modal overlay
- **Domain tree:** Collapsible nodes with type-colored icons. Active node has accent purple left border (3px). Hover shows `Surface 1` background. Indent per level: 16px.
- **Quick Create button:** Fixed to sidebar bottom. "+" icon + "New Node" label. Accent purple background.
- **Collapsed state:** 48px width, only icons visible, tooltips on hover.

### Top Bar Details

- **Breadcrumb:** `Work / Dev / Project XP` — each segment clickable, navigates to that node. Subtext color, "/" separator.
- **View tabs:** Horizontal tab bar, right-aligned. Active tab: accent purple underline (2px). Inactive: subtext color.
- **Height:** 48px

---

## 5. View Specifications

### 5.1 Dashboard (`/`)

**Purpose:** "What should I work on today?" — answered in 5 seconds.

```
+-------------------------------------------------------+
| Good morning, CT                    Mon, 19 May 2026   |
+-------------------------------------------------------+
| [🔥 14 days]  [⭕ 8/15 weekly]  [⚡ 340 XP this week] |
+---------------------------+---------------------------+
|  OVERDUE (3)              |  RECENT COMPLETIONS       |
|  ┌─────────────────────┐  |  ✓ Fix auth bug    +25 XP |
|  │ Deploy hotfix       │  |  ✓ Write tests     +15 XP |
|  │ Work>Dev  ⚠ 2d late │  |  ✓ Review PR       +10 XP |
|  └─────────────────────┘  |                           |
|  ┌─────────────────────┐  |  SKILL SUMMARY            |
|  │ Reply to Alice      │  |  SWE        Lv.3 ████░ 68%|
|  │ Personal  ⚠ 1d late │  |  Data Eng   Lv.2 ██░░░ 40%|
|  └─────────────────────┘  |  DevOps     Lv.1 █░░░░ 20%|
|                           |                           |
|  IN PROGRESS (5)          |  UPCOMING CATCH-UPS       |
|  ┌─────────────────────┐  |  Alice — in 2 days        |
|  │ Build Kanban UI     │  |  Bob — in 5 days          |
|  │ Work>Dev  due Jun 1 │  |  Charlie — overdue 3d ⚠   |
|  └─────────────────────┘  |                           |
+---------------------------+---------------------------+
```

**Widget specs:**
- **Streak badge:** Flame icon, large number, "days" label. Orange if active, gray if broken today.
- **Weekly ring:** Circular progress, fraction label inside. Accent purple fill.
- **XP counter:** Lightning bolt icon + total XP earned since Monday.
- **Task lists:** Each item is a condensed NodeCard (title + breadcrumb + urgency indicator). Max 5 visible, "Show all" link if more.
- **Skill summary:** Horizontal mini progress bars (120px wide), level badge left, percentage right.
- **Catch-up list:** Person name + relative date. Red text if overdue.

---

### 5.2 Node Detail (`/node/:id`)

**Purpose:** View and edit any single node.

```
+-------------------------------------------------------+
| [TASK badge]  Deploy production hotfix                 |
|               Created 15 May · Updated 19 May          |
+----------------------------------+--------------------+
|  DESCRIPTION                     |  PROPERTIES        |
|  ┌────────────────────────────┐  |                    |
|  │ Roll out the auth fix to   │  |  Status: [IN_PROG▾]|
|  │ production after QA signs  │  |  Progress: ███░ 60%|
|  │ off. Coordinate with ops.  │  |  Due: [Jun 01 📅]  |
|  └────────────────────────────┘  |  Priority: [High▾] |
|                                  |                    |
|  CONNECTIONS                     |  TAGS              |
|  Main: Work > Dev > Project XP   |  [urgent] [deploy] |
|                                  |  [+ add tag]       |
|  Parents:                        |                    |
|  [Project XP] [Alice 👤]         |                    |
|                                  |                    |
|  Children:                       |                    |
|  ☐ Run smoke tests     TODO      |                    |
|  ☑ Write rollback plan  DONE     |                    |
|                                  |                    |
+----------------------------------+--------------------+
|                    [ Save ]  [ 🗑 Delete ]             |
+-------------------------------------------------------+
```

**Variant details by type:**

| Type | Right panel shows |
|------|-------------------|
| TASK | Status dropdown, progress slider, due date picker, priority (High/Medium/Low) |
| PROJECT | Status, computed progress bar (read-only), start date, end date |
| SKILL | Level badge (gold, "Lv.3"), XP bar (340/500), "Next level in 160 XP" label — all read-only |
| PERSON | Email input, phone input, next catch-up date picker, "Schedule Catch-Up" button |
| DOMAIN | Minimal — description only, no extra properties |
| TAG | Color hex input with live swatch preview, used-by count |

---

### 5.3 Kanban Board (`/kanban/:projectId?`)

**Purpose:** Visual task pipeline with drag-and-drop.

```
+-------------------------------------------------------+
| Filter: [All Projects ▾] [Tags ▾] [Priority ▾] [Date] |
+------------------+------------------+-----------------+
|  TODO (4)        |  IN PROGRESS (3) |  DONE (2)       |
|  ┌──────────┐    |  ┌──────────┐    |  ┌──────────┐   |
|  │🔴 Deploy │    |  │🟡 Kanban │    |  │✅ Auth   │   |
|  │  hotfix  │    |  │  UI      │    |  │  bug fix │   |
|  │ XP · Jun1│    |  │ XP · Jun5│    |  │ XP · done│   |
|  │ [urgent] │    |  │ [ui]     │    |  │ +25 XP   │   |
|  └──────────┘    |  └──────────┘    |  └──────────┘   |
|  ┌──────────┐    |  ┌──────────┐    |  ┌──────────┐   |
|  │🟢 Write  │    |  │🔴 Fix    │    |  │✅ Setup  │   |
|  │  docs    │    |  │  CI      │    |  │  linter  │   |
|  │ XP · Jun8│    |  │ Aura·Jun2│    |  │ Aura     │   |
|  │ [docs]   │    |  │ [devops] │    |  │ +10 XP   │   |
|  └──────────┘    |  └──────────┘    |  └──────────┘   |
|                  |                  |                 |
|  [+ Add Task]    |  [+ Add Task]   |  All caught up! |
+------------------+------------------+-----------------+
```

**Card anatomy (NodeCard in Kanban context):**
```
┌──────────────────────────┐
│ 🔴  Deploy hotfix        │  ← priority dot + title
│ Work > Dev > Project XP  │  ← breadcrumb (subtext)
│ Due: Jun 1               │  ← due date (red if overdue)
│ [urgent] [deploy]        │  ← tag chips
└──────────────────────────┘
```

- Priority dot: left of title. Red = high, yellow = medium, green = low.
- Card background: Surface 0. Hover: Surface 1.
- Drag handle: subtle grip dots on left edge, visible on hover.
- Drop zone: blue dashed border on target column during drag.
- DONE column cards: reduced opacity (70%), green checkmark replaces priority dot, "+XP" badge.

---

### 5.4 Graph View (`/graph`)

**Purpose:** Bird's-eye view of the entire life system.

```
+-------------------------------------------------------+
| [≡DOMAIN] [⚡SKILL] [📁PROJECT] [☐TASK] [👤PERSON] [🏷TAG] |
| Layout: [Hierarchical ▾]             [−] [+] [Fit]    |
+-------------------------------------------------------+
|                                                       |
|              ┌─────────┐                              |
|              │  Work   │ ← DOMAIN (blue, large)       |
|              │ ■■■■■■  │                              |
|              └────┬────┘                              |
|           ┌───────┼───────┐                           |
|     ┌─────┴──┐  ┌─┴──────┐                           |
|     │  Dev   │  │Finance │ ← sub-DOMAINs              |
|     │ ■■■■■  │  │ ■■■■   │                           |
|     └───┬────┘  └────────┘                           |
|    ┌────┼────┐                                        |
| ┌──┴───┐ ┌──┴───┐                                    |
| │ SWE  │ │Proj  │ ← SKILL (green) + PROJECT (orange)  |
| │Lv.3  │ │ XP   │                                    |
| └──────┘ └──┬───┘                                    |
|          ┌──┼──┐                                      |
|        ┌─┴┐┌┴─┐                                      |
|        │T1││T2│ ← TASKs (gray, small)                 |
|        └──┘└──┘                                      |
|                            ┌──────┐                   |
|               - - - - - - -│Alice │ ← PERSON (pink,    |
|              (dashed edge) │  👤  │    secondary link)  |
|                            └──────┘                   |
|                                        ┌────┐         |
|                                   [Mini-map]         |
+-------------------------------------------------------+
```

**Node rendering:**
- Shape: Rounded rectangle, colored border (2px) matching type color.
- Size: DOMAIN 120×60px, SKILL/PROJECT 100×50px, TASK 80×40px, PERSON 80×50px, TAG 60×30px.
- Content: Title text centered. SKILL shows "Lv.N" below. TASK shows status dot.
- Selected node: Glow effect (type color, 8px blur). Ancestor chain highlighted with thicker edges.

**Edge rendering:**
- mainParent edge: Solid line, 2px, `#6c7086` (overlay color).
- Additional parent edge: Dashed line, 1px, `#6c7086`.
- Arrow: Small arrowhead on child end.

**Side panel (on node click):**
- Slides in from right (320px wide).
- Shows: title, type badge, status, progress, description preview, "Open full detail →" link.
- Closes on click outside or Escape.

---

### 5.5 Skills View (`/skills`)

**Purpose:** Gamified progression tracking.

```
+-------------------------------------------------------+
| SKILLS                                                 |
| [12 skills]  [Avg Lv. 2.1]  [Most improved: SWE ↑]   |
+-------------------------------------------------------+
|                                                       |
| ── Work ── (total: 1,240 XP)                          |
|                                                       |
| ┌─────────────────────────────────────────────────┐   |
| │ ⚡ SWE                                          │   |
| │ [Lv.3]  ████████████░░░░░  340/500 XP  (68%)    │   |
| │ 3 projects · 12 tasks completed · ↑45 XP/week   │   |
| │                                                 │   |
| │ ▼ Expand                                        │   |
| │  ├ Project XP         ████░░ 60%  IN_PROGRESS   │   |
| │  ├ Project Aura       ██░░░░ 30%  IN_PROGRESS   │   |
| │  └ Skooldio Gateway   ██████ 100% DONE          │   |
| │                                                 │   |
| │  Recent: ✓ Fix auth bug (+25 XP) · 2h ago       │   |
| └─────────────────────────────────────────────────┘   |
|                                                       |
| ┌─────────────────────────────────────────────────┐   |
| │ ⚡ Data Engineering                              │   |
| │ [Lv.2]  █████░░░░░░░░░░░  200/500 XP  (40%)    │   |
| │ 2 projects · 8 tasks completed · ↑20 XP/week    │   |
| └─────────────────────────────────────────────────┘   |
|                                                       |
| ── Personal ── (total: 380 XP)                        |
| ...                                                   |
|                                                       |
| ┌─ FUTURE: World's Greatest ─────────────────────┐   |
| │ You ▓░░░░░░░░░░░░░░░░░░░░░░░░░  200h           │   |
| │ Junior Dev milestone ─────────── 1,000h          │   |
| │ Senior Dev milestone ──────────────── 5,000h     │   |
| │ Mastery (Gladwell) ──────────────────── 10,000h  │   |
| └─────────────────────────────────────────────────┘   |
+-------------------------------------------------------+
```

**Skill card specs:**
- Background: Surface 0. Expanded: slightly taller with slide-down animation.
- Level badge: Gold background (`#f9e2af`), dark text, rounded pill. "Lv.3"
- XP bar: Green (`#a6e3a1`) fill, 8px height, rounded.
- Activity sparkline: Tiny 7-dot chart (last 7 days of XP gain), placed right of "XP/week" stat.
- Expand trigger: "▼ Expand" text or click anywhere on card.

---

### 5.6 People View (`/people`)

**Purpose:** Relationship maintenance and catch-up tracking.

```
+-------------------------------------------------------+
| PEOPLE                                                 |
| [24 contacts]  [3 overdue ⚠]  [2 this week]           |
| Sort: [Next catch-up ▾]  Filter: [All groups ▾]       |
+-------------------------------------------------------+
|                                                       |
| ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ |
| │    [CT]      │  │    [AS]      │  │    [BK]      │ |
| │              │  │              │  │              │ |
| │  Charlie T   │  │  Alice S     │  │  Bob K       │ |
| │  Work        │  │  Personal    │  │  Work > Dev  │ |
| │              │  │              │  │              │ |
| │  📧 ct@...   │  │  📧 as@...   │  │  📧 bk@...   │ |
| │  📱 081-...  │  │  📱 089-...  │  │  📱 082-...  │ |
| │              │  │              │  │              │ |
| │  ⚠ Overdue  │  │  🟢 In 2d   │  │  ⬜ Not set  │ |
| │   3 days     │  │   May 21     │  │              │ |
| │              │  │              │  │              │ |
| │ [Schedule]   │  │ [Schedule]   │  │ [Schedule]   │ |
| └──────────────┘  └──────────────┘  └──────────────┘ |
+-------------------------------------------------------+
```

**Person card specs:**
- **Avatar:** 48px circle, initials in white on type color (pink) background.
- **Name:** Bold, 16px.
- **Domain label:** Subtext, from mainParent chain.
- **Contact info:** Small text, email and phone with icons.
- **Catch-up badge:** Green pill = upcoming (shows date), Red pill = overdue (shows "N days"), Gray = not scheduled.
- **Schedule button:** Secondary style, full card width at bottom.
- **Card dimensions:** ~200px wide, auto height. Grid: 3 columns on desktop, 2 tablet, 1 mobile.

---

## 6. Interaction Patterns

### Global Search (Cmd+K)

```
┌──────────────────────────────────┐
│ 🔍 Search nodes...               │
├──────────────────────────────────┤
│ [TASK]   Deploy hotfix           │
│          Work > Dev > Project XP │
│ [SKILL]  SWE                     │
│          Work > Dev              │
│ [PERSON] Alice                   │
│          Personal                │
│ [PROJECT] Project Aura           │
│          Work > Dev              │
└──────────────────────────────────┘
```

- Modal overlay, centered, 480px wide.
- Type-ahead with 200ms debounce.
- Each result: TypeBadge + title + breadcrumb (subtext).
- Enter or click → navigate to `/node/:id`.
- Escape → close.

### Quick Create Modal

```
┌─────────────────────────────────────┐
│  Create New Node                     │
│                                     │
│  Title:    [___________________]    │
│  Type:     [TASK ▾]                 │
│  Parent:   [🔍 Search parent...]    │
│  Tags:     [urgent] [+ add]        │
│                                     │
│  ── TASK Properties ──              │
│  Status:   [TODO ▾]                │
│  Priority: [Medium ▾]              │
│  Due date: [📅 Pick date]          │
│                                     │
│            [Cancel]  [Create]       │
└─────────────────────────────────────┘
```

- Type selector changes which properties section appears below.
- Parent search filters by allowed parent types for the selected type.
- Create button: accent purple, disabled until title is filled.

### Drag & Drop (Kanban)

- **Grab:** Cursor changes to grab on card hover. Card lifts with subtle shadow (4px Y offset).
- **Drag:** Card follows cursor, origin position shows dashed outline placeholder.
- **Over column:** Target column header highlights with accent purple border.
- **Drop:** Card animates to new position. Status updated immediately (optimistic UI), mutation fires in background.
- **Cancel:** Drop back to origin on Escape or drop outside columns.

---

## 7. Responsive Breakpoints

| Breakpoint | Sidebar | Grid columns | Notes |
|------------|---------|-------------|-------|
| Desktop (>1280px) | Full 240px | 3 (People, Skills) | All views at full fidelity |
| Tablet (768–1280px) | Collapsed to 48px icon rail | 2 | Kanban columns stack horizontally with scroll |
| Mobile (<768px) | Hidden, hamburger toggle | 1 | Kanban: swipe between columns. Graph: pinch-to-zoom |

---

## 8. Empty States

| View | Empty state message | Action |
|------|-------------------|--------|
| Dashboard (no tasks) | "No tasks yet. Create your first domain to get started." | [Create Domain] button |
| Kanban (no project) | "Select a project to see its tasks, or view all tasks." | Project selector dropdown |
| Kanban (no tasks in column) | TODO: "Add a task to get started." / DONE: "Nothing completed yet — you've got this!" | [+ Add Task] |
| Graph (no nodes) | "Your life graph is empty. Start by creating a Domain." | [Create Domain] |
| Skills (no skills) | "No skills tracked yet. Create a Skill node under a Domain." | [Create Skill] |
| People (no persons) | "No contacts added. Add people to track catch-ups." | [Add Person] |

---

## 9. Key User Flows

### Flow 1: Morning Routine
1. Open XP → Dashboard loads
2. Scan overdue tasks and streak counter
3. Click top overdue task → NodeDetail opens
4. Update status to IN_PROGRESS → Save
5. Back to Dashboard → task moved to in-progress list

### Flow 2: Complete a Task (XP Propagation)
1. On Kanban → drag "Fix auth bug" from IN_PROGRESS to DONE
2. Status updates, +25 XP badge appears on card
3. Parent PROJECT progress recalculates (60% → 70%)
4. Parent SKILL XP increments (315 → 340)
5. Dashboard streak counter updates (14 → 15 days)
6. Obsidian file updated in background

### Flow 3: Weekly Planning
1. Dashboard → check weekly progress ring (8/15)
2. Navigate to Kanban → filter by "This Week" due dates
3. Review TODO column → drag priorities to IN_PROGRESS
4. Quick-create new tasks inline in TODO column
5. Switch to Graph view → verify new tasks connect to the right projects

### Flow 4: Skill Review
1. Navigate to Skills view
2. Scan which skills gained most XP this month
3. Expand "SWE" → see contributing projects and tasks
4. Note that "Data Engineering" is stalling → click through to its project
5. Create new tasks under that project to re-engage

### Flow 5: Catch-Up Scheduling
1. Navigate to People view → sort by "overdue first"
2. See Charlie is 3 days overdue → click "Schedule"
3. Pick date → nextCatchupDate set
4. Charlie's card badge changes from red to green
