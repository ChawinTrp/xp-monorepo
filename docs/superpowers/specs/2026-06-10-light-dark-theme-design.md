# Light/Dark Theme + Type-Color Mental Cues — Design

Goal: brighter UI for positive mental feedback. Light theme (default) + dark theme
with a persisted toggle, and a consistent node-type color language across the app:
**task = orange, routine = teal, project = blue, domain = purple** (skill green,
person pink, tag yellow unchanged).

Decisions (user-approved): direction = light/dark toggle; type mapping = B
(task orange, project blue, domain purple); toggle = TopBar sun/moon, default
**light**, persisted in localStorage. Implementation = CSS-variable override
block + `data-theme` attribute (approach 1).

## 1. Theme architecture

- `apps/web/src/index.css`: keep `:root` exactly as today (Catppuccin Mocha =
  dark theme), add a `[data-theme="light"]` block overriding every variable
  with Catppuccin Latte values (palette below).
- `apps/web/index.html`: inline script in `<head>` (before the bundle) sets
  `document.documentElement.dataset.theme = localStorage.getItem('xp-theme') ?? 'light'`
  so there is no flash of the wrong theme.
- New tiny helper `apps/web/src/lib/theme.ts`: `getTheme()`, `setTheme(t)`
  (sets `dataset.theme` + localStorage `xp-theme`), `toggleTheme()`.
- Toggle UI: sun/moon icon button in `TopBar.tsx` (desktop) and in the mobile
  header area of `MobileShell.tsx`. No Settings-page work.

## 2. Light palette ([data-theme="light"], Catppuccin Latte)

```
--base #eff1f5  --mantle #e6e9ef  --crust #dce0e8
--surface0 #ccd0da  --surface1 #bcc0cc  --surface2 #acb0be
--overlay0 #9ca0b0  --overlay1 #8c8fa1  --overlay2 #7c7f93
--text #4c4f69  --subtext0 #5c5f77  --subtext1 #6c6f85
--accent #8839ef  --red #d20f39  --green #40a02b  --yellow #df8e1d
--orange #fe640b  --blue #1e66f5  --pink #ea76cb  --teal #179299
```

## 3. Type colors (mapping B) — dark / light

```
--c-domain  : #cba6f7 / #8839ef   (purple — was blue)
--c-skill   : #a6e3a1 / #40a02b   (green, unchanged)
--c-project : #89b4fa / #1e66f5   (blue — was peach)
--c-task    : #fab387 / #fe640b   (orange — was gray)
--c-person  : #f5c2e7 / #ea76cb
--c-tag     : #f9e2af / #df8e1d
--c-routine : #94e2d5 / #179299
```

## 4. Mental-cue treatment (type color carried across the app)

- `NodeCard.tsx`: TASK and ROUTINE cards get a soft type-tinted surface,
  `background: color-mix(in srgb, var(--c-task|--c-routine) 10%, var(--surface0))`
  plus the existing type dot/accents; other types keep plain surface. Must look
  right in both themes (color-mix handles it).
- Kanban plan-mode `RoutineChip` already teal-tinted via vars — verify only.
- Sidebar tree, Calendar dots, Graph legend already read `--c-*` — they inherit
  the new mapping automatically; verify, don't redesign.
- Mobile Focus card gradients are the origin of the cue and stay gradients.
  Move `ROUTINE_BG/TASK_BG/ROUTINE_SHADOW/TASK_SHADOW` from constants in
  `MobileShell.tsx` into CSS vars (`--grad-routine`, `--grad-task`,
  `--shadow-routine`, `--shadow-task`) defined per theme in index.css; light
  variants slightly softer (lower-saturation endpoints) so white text still
  passes contrast, or switch card text to a dark ink var in light mode.

## 5. Hardcoded-hex cleanup (audit scope)

Grep `apps/web/src` for `#[0-9a-fA-F]{3,8}` and `rgba(`; convert anything that
breaks in light mode to vars or color-mix. Known offenders:
- `MobileShell.tsx`: gradient constants, `PRIORITY_COLOR` map, `#1e1e2e` ink on
  avatar/pills, hardcoded card text whites.
- `index.css` streak-fire keyframes (orange glows — fine in both themes, keep).
- `tailwind.config.js` ctp-* color definitions: if hex-based, point them at the
  CSS variables so `text-ctp-*` classes follow the theme.
- `Graph.tsx` canvas/SVG colors if hex-based.
Rule of thumb: semantic colors → var; black/white inks on colored fills →
keep only where the fill is theme-invariant (gradients), otherwise var.

## 6. Out of scope

Auto-by-time switching, Settings-page theme picker, redesigning component
layouts, API changes, new Tailwind color system.

## 7. Verification

- `npm run build -w web` green.
- Preview (vite :5173): default loads light; toggle flips instantly and
  persists across reload; check Dashboard, Kanban (board + plan), Routines,
  mobile Focus + Stats in both themes; no unreadable text (spot-check overlay
  text, badges, empty states); type cue visible: orange task cards / teal
  routine chips in Kanban, queue, dashboard lists.
