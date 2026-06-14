# DESIGN.md — XP Design System

> **Canonical visual reference for Project XP.** Read this before generating or modifying **any** UI component. Match the tokens, typography, spacing, elevation, and motion defined here exactly. For component patterns, follow §6 (Core Components) and the §6.4 Do's & Don'ts.
>
> - **Architecture / data model:** `XP.md`
> - **Node type rules & metadata:** `NODE.md`
> - **Superseded:** `DESIGN_HANDOFF.md` and `DESIGN_HANDOFF_MOBILE.md` are **historical**. They describe the old Catppuccin Mocha system and the pre-redesign node-color mapping. Where they conflict with this file, **this file wins.** Keep them only for view-flow / interaction reference (user flows, swipe gestures, card anatomy), not for color or theme.

---

## 1. Purpose & How to Use

XP is a **personal life operating system** — *The Game* (goals, skills, tasks, XP progression) + *The Orchestra* (projects, Kanban, Gantt, sprints, people). It is **not** a note app; notes/ideas live in Obsidian. XP handles structured, actionable data only.

**Single user (CT):** power user, keyboard-heavy on desktop, thumb-driven on mobile. The app is used daily and fast — the design must reward speed and clarity, not decoration for its own sake.

**How to use this doc:**
1. Before building UI, find the relevant surface in §7 and check its **tier** (full redesign vs. token-swap).
2. Pull colors/spacing/type from the tokens in §3–§5 — never hardcode hex in components; use the CSS variables.
3. Re-skin existing primitives in `apps/web/src/components/ui/index.tsx`; don't invent parallel components.
4. Honor §6.4 Do's & Don'ts and §8 motion/reduced-motion rules.

---

## 2. Design Direction & Principles

The visual language is **warm glassmorphism**, derived from the ecosystem-visualization reference (`html example/`): warm peach/orange accents, soft neutral backgrounds, frosted-glass surfaces with layered shadows, restrained depth and motion.

This **replaces** the previous Catppuccin Mocha aesthetic. The migration is **prioritized, not big-bang** (see §7).

**Principles**

1. **Light-first, warm.** The light theme is the primary design target. A warm-dark variant exists (§3.2) so dark users aren't abandoned, but design and review in light first.
2. **Depth through glass, not chrome.** Hierarchy comes from frosted surfaces, soft shadows, and gradient accents — not heavy borders or hard dividers.
3. **Restraint.** Warmth and motion are seasoning. Dense operational views (Kanban, lists, detail panels) stay calm and legible. Save the "wow" (3D, ambient WebGL) for showcase surfaces only.
4. **Speed on the hot paths.** Mobile Today-stack, Dashboard, and Kanban are touched daily — these get the deepest treatment *and* the strictest performance budget.
5. **Semantic color is sacred.** The 7 node-type hues carry meaning. They stay distinct even inside a warm palette; chrome harmonizes around them.
6. **One component, two themes.** Everything is built on CSS variables so a single component renders correctly in light and dark without forks.

---

## 3. Theme Tokens

All tokens are CSS variables on `:root` (light, default) and `[data-theme="dark"]` (warm-dark), consumed via the `ctp.*` Tailwind aliases already wired in `tailwind.config.js`. **Do not rename the variables** — keep `--base`, `--surface0`, `--accent`, etc. so existing components keep working; only their *values* change.

### 3.1 Light (default) — "Warm Paper"

| Token | Hex / value | Role |
|---|---|---|
| `--base` | `#F8F6F4` | Page background (warm paper) |
| `--mantle` | `#F1EEEA` | Recessed areas (sidebar, timer bar, sheets) |
| `--crust` | `#E8E4DF` | Deepest recess, app frame edges |
| `--surface0` | `#FFFFFF` | Card / panel solid base |
| `--surface1` | `#F3F0EC` | Hover, subtle fills, track backgrounds |
| `--surface2` | `#E9E5E0` | Pressed, active fills, borders-as-fill |
| `--surface-slate` | `#53617A` | **Cool contrast surface** — dark info cards on light bg (from reference) |
| `--overlay0` | `#C7C1B9` | Dividers, disabled |
| `--overlay1` | `#A39C92` | Muted icons |
| `--overlay2` | `#8A8278` | Placeholder, faint text |
| `--text` | `#1F2430` | Primary text |
| `--subtext0` | `#454B57` | Secondary text |
| `--subtext1` | `#5C6270` | Breadcrumbs, metadata, captions |
| `--border` | `#E5E2DD` | Default border (cards, inputs) |
| `--accent` | `#ED7B46` | **Primary** — actions, links, active states |
| `--accent-soft` | `#E48B59` | Peach — secondary accent, soft fills, gradients |
| `--accent-strong` | `#DF6431` | Pressed / gradient end for primary buttons |
| `--red` | `#E5484D` | Overdue, errors, destructive |
| `--green` | `#2FA866` | Success, completed |
| `--yellow` | `#E0A23C` | Warnings |
| `--orange` | `#ED7B46` | Alias of accent (legacy uses) |
| `--blue` | `#4F86D6` | Info, in-progress |
| `--pink` | `#E58FC4` | — |
| `--teal` | `#3DBFAE` | — |

**Glass recipe (light):** `background: rgba(255,255,255,0.55); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.6); border-bottom-color: rgba(255,255,255,0.25);` with elevation shadow (§5.4). Provide a **solid `#FFFFFF` fallback** for `backdrop-filter`-unsupported contexts and for dense lists (glass is expensive — don't stack dozens).

### 3.2 Dark (variant) — "Warm Charcoal"

Warm near-black, **not** Catppuccin blue-black. Same accent orange.

| Token | Hex / value | Role |
|---|---|---|
| `--base` | `#17120F` | Page background (warm charcoal) |
| `--mantle` | `#120E0C` | Recessed areas |
| `--crust` | `#0C0908` | Deepest recess |
| `--surface0` | `#241D18` | Card / panel base |
| `--surface1` | `#2E2620` | Hover, tracks |
| `--surface2` | `#3A302A` | Pressed, borders-as-fill |
| `--surface-slate` | `#3A4255` | Cool contrast surface (dark) |
| `--overlay0` | `#5A5048` | Dividers, disabled |
| `--overlay1` | `#7A6E63` | Muted icons |
| `--overlay2` | `#9A8D80` | Placeholder |
| `--text` | `#F3ECE5` | Primary text |
| `--subtext0` | `#D8CEC3` | Secondary text |
| `--subtext1` | `#B6AC9F` | Metadata |
| `--border` | `#332A24` | Default border |
| `--accent` | `#ED7B46` | Primary |
| `--accent-soft` | `#E48B59` | Peach |
| `--accent-strong` | `#F08A50` | Lightened for dark (pressed/gradient) |
| `--red` | `#F2787C` | |
| `--green` | `#5FCB8E` | |
| `--yellow` | `#E8B65E` | |
| `--blue` | `#6FA0E6` | |
| `--pink` | `#ECA4D2` | |
| `--teal` | `#54CFBE` | |

**Glass recipe (dark):** `background: rgba(40,32,28,0.5); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08);` + dark elevation shadow.

---

## 4. Node Type Colors

Seven semantic hues, retuned to sit on warm surfaces while staying mutually distinguishable. Defined as `--c-*` and exposed via Tailwind `node.*`. Always pair color with the **icon** (Lucide) — never rely on color alone (accessibility + the TASK/accent adjacency in §4.1).

| Type | Token | Light | Dark | Icon (Lucide) | Meaning |
|---|---|---|---|---|---|
| DOMAIN | `--c-domain` | `#8B7BD8` | `#A99BE8` | `Layers` | Life areas |
| SKILL | `--c-skill` | `#5FB07F` | `#73C796` | `Zap` | Trackable skills (XP/levels) |
| PROJECT | `--c-project` | `#4F86D6` | `#6FA0E6` | `FolderKanban` | Scoped work, dates |
| TASK | `--c-task` | `#F2935C` | `#F4A878` | `CheckSquare` | Actionable items |
| PERSON | `--c-person` | `#E58FC4` | `#ECA4D2` | `User` | Contacts / catch-ups |
| TAG | `--c-tag` | `#E0A23C` | `#E8B65E` | `Tag` | Cross-cutting labels |
| ROUTINE | `--c-routine` | `#3DBFAE` | `#54CFBE` | `Repeat` | Daily habits, streaks |

### 4.1 The TASK ↔ accent adjacency (intentional tradeoff)

The brand accent (`#ED7B46`, deeper orange) and TASK (`#F2935C`, softer peach) are in the same hue family — the unavoidable cost of keeping 7 distinct node hues inside a warm palette. Disambiguate by:
- **Chrome accent appears as gradients** (`--accent` → `--accent-strong`) on buttons/links; **TASK appears as flat tints** (`color-mix(... 10%, surface)`) on cards. The eye reads gradient-vs-flat.
- **TypeBadge + icon** always accompany node color. A peach card with a `CheckSquare` badge is unmistakably a TASK regardless of nearby orange buttons.
- Never place a flat-peach primary button; primary actions always use the accent gradient.

---

## 5. Typography, Spacing, Radius, Elevation, Motion

### 5.1 Typography

Fonts already loaded in `index.css`: **Inter** (UI), **JetBrains Mono** (`.mono` — IDs, timers, metadata, percentages).

| Role | Font | Weight | Size / line |
|---|---|---|---|
| Display (hero, showcase) | Inter | 600 | 40–64px / 1.05, tracking −0.02em |
| Page title | Inter | 700 | 24px / 1.2 |
| Section header | Inter | 600 | 18px / 1.3 |
| Card title (desktop) | Inter | 600 | 14px |
| Card title (mobile) | Inter | 700 | 24px |
| Body | Inter | 400 | 14px / 1.45 |
| Caption / breadcrumb | Inter | 400 | 11–12px |
| Metadata / timer / ID | JetBrains Mono | 400–500 | 11–14px |
| Label (technical) | JetBrains Mono | 600 | 10–12px, uppercase, tracking 0.4 |

### 5.2 Spacing

4px base grid. Card padding 12px (desktop dense) / 16–20px (mobile, glass). Section gap 24px. Touch target min 44×44px on mobile.

### 5.3 Radius

| Element | Radius |
|---|---|
| Badges / chips / status pills | 4–6px |
| Cards / inputs / dropdowns (desktop) | 8–10px |
| Cards (mobile, glass) | 16px |
| Buttons | 14–16px (`rounded-2xl`) |
| Showcase glass panels | 24–32px |
| Pills / avatars | 9999px |

### 5.4 Elevation (shadows)

Soft, warm-tinted, layered — never hard black.

| Level | Light | Use |
|---|---|---|
| `e1` rest | `0 1px 2px rgba(31,36,48,0.05)` | Inputs, chips |
| `e2` card | `0 4px 12px rgba(31,36,48,0.06)` | NodeCard, panels |
| `e3` raised | `0 12px 28px rgba(31,36,48,0.10)` | Dropdowns, popovers, dragging card |
| `e4` glass | `0 30px 60px rgba(31,36,48,0.12)` | Showcase glass panels, mobile card stack |
| `accent` | `0 8px 16px rgba(237,123,70,0.30)` | Primary buttons, FAB glow |

Dark: same offsets, swap base to `rgba(0,0,0,0.4–0.55)`.

### 5.5 Motion

CSS/Framer-Motion driven (no GSAP dependency in app code). Easing `cubic-bezier(0.4,0,0.2,1)`; durations 150–250ms for UI, 300–600ms for entrances. Patterns: **staggered entrance** (cards fade+rise, ~40ms stagger), **hover lift** (`translateY(-2px)` + shadow step), **masked reveal** for showcase, **optimistic** state changes. Existing keyframes in `index.css` (`fadeIn`, `slideRight`, `toast-in/out`, `timerPulse`, `streak-fire`) are retained. Always wrap non-essential motion in `@media (prefers-reduced-motion: reduce)`.

---

## 6. Core Components

Re-skin the existing primitives in `apps/web/src/components/ui/index.tsx` and `apps/web/src/components/NodeCard.tsx` — do not fork them.

### 6.1 Inventory (current → keep)

`TypeBadge`, `TypeIcon`, `ProgressBar`, `StatusDot`, `TagChip`, `PriorityDot`, `Avatar`, `LevelBadge`, `Sparkline`, `RingGauge`, `Button`, `Kbd`, `Dropdown`, `Toast`/`ToastProvider`/`useToast`, and `NodeCard`.

### 6.2 Component skinning notes

- **Button** — `primary`: accent **gradient** `linear-gradient(180deg, var(--accent), var(--accent-strong))`, text `#FFF`, shadow `accent`, radius 14px. `secondary`: glass surface, `--text`. `ghost`: transparent, `--subtext1`. `danger`: transparent + `--red` border. Hover = lift (`translateY(-1px)`) + shadow step.
- **NodeCard** — glass-lite: `--surface0` with 1px `--border`; TASK/ROUTINE keep their tinted base (`color-mix(... 10%, --surface0)`). Hover raises to `e2`→`e3` and reveals a faint accent left-edge. Keep current done/priority/timer/tag layout. **Don't** apply heavy blur in long lists — use solid surfaces there.
- **TypeBadge** — unchanged structure; background `color-mix(node 15%, transparent)`, text = node color, icon mandatory.
- **ProgressBar / RingGauge** — fill = relevant node/accent color; track `--surface1`. SKILL bars green, PROJECT blue, weekly ring accent.
- **Toast** — keep variant-tinted glass; switch shadow to warm `e3`.
- **Inputs / Dropdown** — `--surface0` fill, `--border`, focus ring `2px var(--accent)` (already global in `index.css`).

### 6.3 New shared pieces (add as needed, in `ui/index.tsx`)

- **GlassPanel** — wrapper applying the §3 glass recipe + `e4`, with a `solid` prop fallback.
- **StatCard** — mobile/dashboard metric tile: 80px, value in type color, mono uppercase label (spec from mobile handoff §9).
- **AmbientBackdrop** — optional WebGL/gradient layer for showcase surfaces (§8), reduced-motion → static gradient.

### 6.4 Do's & Don'ts

**Do**
- Use CSS variables for every color; let theme switching work for free.
- Pair node color with its Lucide icon, always.
- Reserve glass + blur for cards/panels/sheets; give dense lists solid surfaces.
- Use the accent **gradient** for primary actions; flat tints for node identity.
- Keep entrances subtle and staggered; respect `prefers-reduced-motion`.
- Keep operational views calm — whitespace and soft elevation over borders.

**Don't**
- Don't hardcode hex in components or reintroduce Catppuccin Mocha values.
- Don't use flat peach as a primary button (collides with TASK).
- Don't stack many blurred glass layers (perf, especially mobile).
- Don't ship literal 3D card stacks / WebGL in Tier-1 operational views (Kanban, lists).
- Don't rely on color alone to convey type or status.
- Don't fork primitives — extend the ones in `ui/index.tsx`.

---

## 7. Surface Tiers

The redesign is prioritized. Each surface is **Tier 1** (full warm-glass redesign now) or **Tier 2** (token-swap only — adopt §3–§6 tokens/components, no structural change yet).

| Surface | File | Tier |
|---|---|---|
| Mobile shell (Today stack, FAB sheet, timer bar, Stats) | `mobile/MobileShell.tsx` | **1** |
| Dashboard | `views/Dashboard.tsx` | **1** |
| Kanban | `views/Kanban.tsx` | **1** |
| NodeDetail | `views/NodeDetail.tsx` | 2 |
| Graph | `views/Graph.tsx` | 2 (+ optional ambient backdrop, §8) |
| Skills | `views/Skills.tsx` | 2 |
| People | `views/People.tsx` | 2 |
| Gantt / Calendar / Routines / PlanMode / Settings | respective files | 2 |
| Sidebar / TopBar / Search / CreateNode modals | `components/*` | 2 (token-swap; modals adopt GlassPanel) |

### 7.1 Tier-1 specs

**Mobile shell** — warm-glass card stack. Cards: 16px radius, glass surface, `e4` shadow for stack depth, next card peeking 24px. Routine/Task card anatomy, swipe-to-reveal, persistent timer bar, FAB → bottom sheet, Stats grid: **keep the structure and flows from `DESIGN_HANDOFF_MOBILE.md` §5–§10**, re-skinned to warm-glass + new node colors. FAB uses accent gradient + `accent` glow. Timer bar = `--mantle` glass with mono elapsed; left icon tinted by node type (ROUTINE teal / TASK peach). StatCard values in type color.

**Dashboard** — "what do I work on today," answered in 5s. Warm hero header (display type) over an **optional AmbientBackdrop** (§8). Below: glass widget tiles — streak badge (`streak-fire` retained), weekly RingGauge (accent), XP-this-week counter, Overdue / In-Progress NodeCard lists, Skill summary mini-bars (green), upcoming catch-ups (red if overdue). Tiles use `e2`, hover-lift, staggered entrance.

**Kanban** — calm, fast, glass-lite. Columns on `--mantle`; column headers with count + soft accent underline on the active/filtered column. NodeCards as §6.2 (solid-surface in long columns, not heavy glass). DnD: dragging card → `e3` + slight scale; drop target column → accent dashed/inner-glow border; DONE cards at ~0.78 opacity with green check + `+Xh` badge. Keep the existing native HTML5 DnD + touch-polyfill behavior — this is a re-skin, not a DnD rewrite.

---

## 8. Showcase & WebGL / Motion

Reserved high-impact surfaces may use an **ambient backdrop** layer behind content:
- **Where:** Dashboard hero, empty states, optionally Graph backdrop. **Never** behind dense operational content.
- **What:** soft moving gradient noise (peach/neutral), as in the reference shader — implemented behind the UI, low contrast, secondary to content. A lightweight CSS animated-gradient is the default; WebGL (Three.js) is opt-in for the hero only and must be lazy-loaded.
- **Performance:** cap pixel ratio at 2, pause when tab hidden, single instance app-wide.
- **3D card stacks:** allowed only as a *showcase* (e.g., a "system overview" moment), never as the interactive Kanban/list surface.
- **Reduced motion:** every ambient/3D effect collapses to a static warm gradient under `prefers-reduced-motion: reduce`. Internal data motion (graph draws, pulsing dots) stops or freezes at rest.

---

## 9. Migration Notes

1. **Tokens first.** Replace the value blocks in `apps/web/src/index.css` `:root` and `[data-theme="dark"]` with §3. Keep variable **names** identical. Add new vars: `--surface-slate`, `--accent-soft`, `--accent-strong`, `--border`. This alone delivers the Tier-2 "color-swap" across the whole app.
2. **Default theme.** Flip default to **light** (warm paper). `lib/theme.ts` already defaults to `'light'`; ensure the boot path doesn't force dark.
3. **Primitives.** Update `Button` (gradient), add `GlassPanel`/`StatCard`/`AmbientBackdrop` to `ui/index.tsx`; re-skin `NodeCard` hover/elevation.
4. **Tier-1 surfaces.** Apply §7.1 specs to `MobileShell.tsx`, `Dashboard.tsx`, `Kanban.tsx`.
5. **Verify both themes.** Every change must read correctly in light *and* warm-dark.
6. **Docs.** Once tokens land, mark the two handoff files as superseded at their tops (point here).

> Implementation of this migration should go through the normal plan → execute flow; this document is the spec, not the plan.
