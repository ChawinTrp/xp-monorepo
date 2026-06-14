# Warm-Glassmorphism Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the XP web app from Catppuccin Mocha to the warm-glassmorphism design system defined in `DESIGN.md`, light-first, with full redesign of the Mobile shell, Dashboard, and Kanban and a token-swap for every other surface.

**Architecture:** Foundation-first. Phase 1 lands the shared foundation (CSS-variable token swap + primitive re-skins) so the whole app inherits the new look for free (Tier-2 "color-swap"). Phase 2 then redesigns the three Tier-1 surfaces in parallel on top of the stable foundation. Phase 3 cleans up residual hardcoded colors and supersedes the old handoff docs. Motion is CSS-keyframe based (no new runtime dependency); the optional WebGL ambient backdrop is isolated in Phase 4 and is the only task that may add a dependency.

**Tech Stack:** React 19 + Vite 7 + Tailwind CSS 3 (CSS variables, `ctp.*`/`node.*` aliases), inline `style={{}}` with `var(--token)`, Lucide icons, existing CSS keyframes in `index.css`.

**Canonical spec:** `DESIGN.md` (repo root). Every visual decision traces to a section there; cite it, don't reinvent.

---

## Conventions for every task

- **Colors come from CSS variables**, never hardcoded hex in components. The variable *names* do not change in this migration — only their values (Task 1). This is what makes Tier-2 surfaces update for free.
- **Both themes must pass.** Every surface is verified in light (default) **and** warm-dark (`data-theme="dark"`).
- **Verification commands** (run from repo root unless noted):
  - Build: `npm run build -w web` → must exit 0.
  - Typecheck: `cd apps/web && npx tsc --noEmit` → must report no errors.
  - Lint (optional, advisory): `npm run lint -w web`.
  - Dev server for preview proof: `npm run dev -w web` → http://localhost:5173.
- **Preview proof** uses the `preview_*` tools: start/reload the server, take a `preview_snapshot` + `preview_screenshot` of the target surface in both themes, and confirm `preview_console_logs` is clean. Toggle theme by evaluating `document.documentElement.dataset.theme = 'dark'` (and `'light'`) via `preview_eval`, or use the in-app theme toggle.
- **Commit** after each task with the message shown. Co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

| File | Responsibility | Phase |
|---|---|---|
| `apps/web/src/index.css` | All theme tokens (light `:root` default + `[data-theme="dark"]`), glass/elevation/motion keyframes | 1 |
| `apps/web/tailwind.config.js` | Expose new tokens as Tailwind aliases (`surface-slate`, `accent-soft/strong`, `border`) | 1 |
| `apps/web/src/components/ui/index.tsx` | Re-skin `Button` (gradient); add `GlassPanel`, `StatCard` primitives | 1 |
| `apps/web/src/components/NodeCard.tsx` | Glass-lite surface, warm hover/elevation | 1 |
| `apps/web/src/main.tsx` / `App.tsx` | Confirm boot applies light as default theme | 1 |
| `apps/web/src/mobile/MobileShell.tsx` | Tier-1 redesign: warm-glass card stack, FAB, timer bar, Stats | 2 |
| `apps/web/src/views/Dashboard.tsx` | Tier-1 redesign: glass widget tiles, warm hero | 2 |
| `apps/web/src/views/Kanban.tsx` | Tier-1 redesign: calm glass-lite columns, warm DnD affordances | 2 |
| `apps/web/src/views/Graph.tsx`, `NodeDetail.tsx`, others | Token-swap sweep — replace residual hardcoded Catppuccin hex with `var(--*)` | 3 |
| `DESIGN_HANDOFF.md`, `DESIGN_HANDOFF_MOBILE.md` | Add "superseded" banner pointing to `DESIGN.md` | 3 |
| `apps/web/src/components/ui/AmbientBackdrop.tsx` (new) | Optional WebGL/CSS ambient showcase layer | 4 (optional) |

---

# PHASE 1 — Foundation (single agent, sequential)

## Task 1: Token swap — warm light default + warm-dark variant

**Files:**
- Modify: `apps/web/src/index.css` (the `:root` block ~lines 7–45 and `[data-theme="light"]` block ~lines 47–85)
- Modify: `apps/web/tailwind.config.js` (colors.ctp map ~lines 6–28)
- Inspect: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/lib/theme.ts`

- [ ] **Step 1: Replace the `:root` (default) block with the warm LIGHT theme.** This inverts the current setup (today `:root` is dark mocha). Replace the existing `:root { ... }` color declarations with:

```css
:root {
  /* Chrome — Warm Paper (light, default) */
  --base: #F8F6F4;
  --mantle: #F1EEEA;
  --crust: #E8E4DF;
  --surface0: #FFFFFF;
  --surface1: #F3F0EC;
  --surface2: #E9E5E0;
  --surface-slate: #53617A;
  --overlay0: #C7C1B9;
  --overlay1: #A39C92;
  --overlay2: #8A8278;
  --text: #1F2430;
  --subtext0: #454B57;
  --subtext1: #5C6270;
  --border: #E5E2DD;
  --accent: #ED7B46;
  --accent-soft: #E48B59;
  --accent-strong: #DF6431;
  --red: #E5484D;
  --green: #2FA866;
  --yellow: #E0A23C;
  --orange: #ED7B46;
  --blue: #4F86D6;
  --pink: #E58FC4;
  --teal: #3DBFAE;

  /* Node type colors — harmonized (light) */
  --c-domain: #8B7BD8;
  --c-skill: #5FB07F;
  --c-project: #4F86D6;
  --c-task: #F2935C;
  --c-person: #E58FC4;
  --c-tag: #E0A23C;
  --c-routine: #3DBFAE;

  /* Mobile focus-card gradients/shadows (warm) */
  --grad-routine: linear-gradient(160deg, #3DBFAE 0%, #4F86D6 100%);
  --grad-task: linear-gradient(160deg, #F2935C 0%, #ED7B46 100%);
  --shadow-routine: rgba(61,191,174,0.30);
  --shadow-task: rgba(237,123,70,0.30);
  --grad-routine-peek: linear-gradient(160deg, rgba(61,191,174,0.30), rgba(79,134,214,0.30));
  --grad-task-peek: linear-gradient(160deg, rgba(242,147,92,0.30), rgba(237,123,70,0.30));
}
```

- [ ] **Step 2: Replace the `[data-theme="light"]` block with `[data-theme="dark"]` holding the warm-CHARCOAL values.** (Rename the selector from `light` to `dark` and swap contents.)

```css
[data-theme="dark"] {
  /* Chrome — Warm Charcoal (dark variant) */
  --base: #17120F;
  --mantle: #120E0C;
  --crust: #0C0908;
  --surface0: #241D18;
  --surface1: #2E2620;
  --surface2: #3A302A;
  --surface-slate: #3A4255;
  --overlay0: #5A5048;
  --overlay1: #7A6E63;
  --overlay2: #9A8D80;
  --text: #F3ECE5;
  --subtext0: #D8CEC3;
  --subtext1: #B6AC9F;
  --border: #332A24;
  --accent: #ED7B46;
  --accent-soft: #E48B59;
  --accent-strong: #F08A50;
  --red: #F2787C;
  --green: #5FCB8E;
  --yellow: #E8B65E;
  --orange: #ED7B46;
  --blue: #6FA0E6;
  --pink: #ECA4D2;
  --teal: #54CFBE;

  /* Node type colors — harmonized (dark) */
  --c-domain: #A99BE8;
  --c-skill: #73C796;
  --c-project: #6FA0E6;
  --c-task: #F4A878;
  --c-person: #ECA4D2;
  --c-tag: #E8B65E;
  --c-routine: #54CFBE;

  /* Mobile focus-card gradients/shadows (warm dark) */
  --grad-routine: linear-gradient(160deg, #2BB3A0 0%, #4F86D6 100%);
  --grad-task: linear-gradient(160deg, #E0824E 0%, #C85A36 100%);
  --shadow-routine: rgba(43,179,160,0.35);
  --shadow-task: rgba(224,130,78,0.35);
  --grad-routine-peek: linear-gradient(160deg, rgba(43,179,160,0.40), rgba(79,134,214,0.40));
  --grad-task-peek: linear-gradient(160deg, rgba(224,130,78,0.40), rgba(200,90,54,0.40));
}
```

- [ ] **Step 3: Add reusable glass + elevation helpers** to `index.css` (after the keyframes section). These back §3 and §5.4 of DESIGN.md:

```css
/* Glass surfaces (DESIGN.md §3) */
.glass {
  background: color-mix(in srgb, var(--surface0) 55%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid color-mix(in srgb, var(--surface0) 60%, transparent);
}
@supports not (backdrop-filter: blur(1px)) {
  .glass { background: var(--surface0); }
}
/* Elevation (DESIGN.md §5.4) */
.e1 { box-shadow: 0 1px 2px rgba(31,36,48,0.05); }
.e2 { box-shadow: 0 4px 12px rgba(31,36,48,0.06); }
.e3 { box-shadow: 0 12px 28px rgba(31,36,48,0.10); }
.e4 { box-shadow: 0 30px 60px rgba(31,36,48,0.12); }
.e-accent { box-shadow: 0 8px 16px rgba(237,123,70,0.30); }
[data-theme="dark"] .e1 { box-shadow: 0 1px 2px rgba(0,0,0,0.40); }
[data-theme="dark"] .e2 { box-shadow: 0 4px 12px rgba(0,0,0,0.45); }
[data-theme="dark"] .e3 { box-shadow: 0 12px 28px rgba(0,0,0,0.50); }
[data-theme="dark"] .e4 { box-shadow: 0 30px 60px rgba(0,0,0,0.55); }
```

- [ ] **Step 4: Update `tailwind.config.js`** — add the new tokens to the `ctp` color map so utility classes work:

```js
// inside colors.ctp, add:
"surface-slate": "var(--surface-slate)",
"accent-soft": "var(--accent-soft)",
"accent-strong": "var(--accent-strong)",
border: "var(--border)",
```

- [ ] **Step 5: Confirm light is the boot default.** Read `apps/web/src/main.tsx` and `App.tsx`. `lib/theme.ts#getTheme` returns `'light'` when `data-theme` is unset. Ensure nothing forces `'dark'` on boot and that any startup code reading `localStorage('xp-theme')` falls back to `'light'`. If a boot line sets dark unconditionally, change it to respect stored value or default light. (No code change if already correct — note the finding.)

- [ ] **Step 6: Verify build + typecheck.**
  - Run: `npm run build -w web` → Expected: exit 0, no errors.
  - Run: `cd apps/web && npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 7: Preview proof, both themes.** Start dev server (`npm run dev -w web`), open http://localhost:5173. Screenshot the Dashboard (or any view) in light, then `preview_eval` `document.documentElement.dataset.theme='dark'` and screenshot again. Confirm: warm paper bg in light, warm charcoal in dark, orange accents, no console errors.

- [ ] **Step 8: Commit.**

```bash
git add apps/web/src/index.css apps/web/tailwind.config.js apps/web/src/main.tsx apps/web/src/App.tsx
git commit -m "feat(web): warm-glassmorphism token swap (light default + warm-dark)"
```

---

## Task 2: Re-skin Button + add GlassPanel & StatCard primitives

**Files:**
- Modify: `apps/web/src/components/ui/index.tsx` (the `Button` component ~lines 159–187; add new exports)

- [ ] **Step 1: Update `Button` variants** so `primary` uses the accent gradient with glow, and `secondary` is glass. Replace the `variants` map and the className/style in `Button`:

```tsx
const variants: Record<string, CSSProperties> = {
  primary: {
    background: 'linear-gradient(180deg, var(--accent), var(--accent-strong))',
    color: '#FFFFFF',
    boxShadow: '0 8px 16px rgba(237,123,70,0.30)',
  },
  secondary: { background: 'var(--surface1)', color: 'var(--text)', border: '1px solid var(--border)' },
  ghost: { background: 'transparent', color: 'var(--subtext1)' },
  danger: { background: 'transparent', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)' },
};
```

Keep the existing `rounded-2xl`, padding, font sizing, and disabled handling. Add a hover lift: on `onMouseEnter` set `transform: translateY(-1px)`, on `onMouseLeave` reset — or add a `hover:-translate-y-px` utility class. Keep it minimal and respect existing inline-style pattern.

- [ ] **Step 2: Add `GlassPanel`** (export) implementing DESIGN.md §3 glass + `e4`:

```tsx
export function GlassPanel({ children, solid = false, className = '', style }: {
  children: ReactNode; solid?: boolean; className?: string; style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-3xl ${className}`}
      style={{
        background: solid ? 'var(--surface0)' : 'color-mix(in srgb, var(--surface0) 55%, transparent)',
        backdropFilter: solid ? undefined : 'blur(20px)',
        WebkitBackdropFilter: solid ? undefined : 'blur(20px)',
        border: '1px solid var(--border)',
        boxShadow: '0 30px 60px rgba(31,36,48,0.12)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Add `StatCard`** (export) per mobile handoff §9 / DESIGN.md §6.3:

```tsx
export function StatCard({ icon, value, label, color = 'var(--accent)' }: {
  icon?: ReactNode; value: ReactNode; label: string; color?: string;
}) {
  return (
    <div
      className="rounded-2xl flex flex-col justify-center gap-1"
      style={{ background: 'var(--surface0)', border: '1px solid var(--border)', padding: 16, minHeight: 80, boxShadow: '0 4px 12px rgba(31,36,48,0.06)' }}
    >
      <div className="flex items-center gap-1.5" style={{ color, fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
        {icon}{value}
      </div>
      <div className="mono uppercase" style={{ fontSize: 11, color: 'var(--subtext1)', letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build + typecheck** (same commands as Task 1 Step 6).

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/components/ui/index.tsx
git commit -m "feat(web): gradient Button + GlassPanel/StatCard primitives"
```

---

## Task 3: Re-skin NodeCard (glass-lite, warm elevation)

**Files:**
- Modify: `apps/web/src/components/NodeCard.tsx`

- [ ] **Step 1: Update card surface + hover** to use `--border` and warm elevation while preserving the TASK/ROUTINE tinted bases already present (`color-mix(--c-task 10%, --surface0)` etc.). Change the root `style` and hover handlers:
  - Rest: `border: '1px solid var(--border)'`, `boxShadow: dragging ? '0 12px 28px rgba(31,36,48,0.10)' : '0 1px 2px rgba(31,36,48,0.05)'`.
  - Hover (`onMouseEnter`): raise to `boxShadow: '0 4px 12px rgba(31,36,48,0.06)'`, `borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))'`, and reveal a faint accent left edge via `borderLeft: '2px solid var(--accent)'` (or `boxShadow inset`). `onMouseLeave` resets to rest values.
  - Keep `done` opacity `0.78` and existing tint logic unchanged.

- [ ] **Step 2: Verify build + typecheck.**

- [ ] **Step 3: Preview proof.** Render Kanban or Dashboard, confirm NodeCards show warm paper/tint surfaces, soft shadow, accent hover edge, in both themes; console clean.

- [ ] **Step 4: Commit.**

```bash
git add apps/web/src/components/NodeCard.tsx
git commit -m "feat(web): warm glass-lite NodeCard with accent hover"
```

### ✅ Phase 1 gate
Before Phase 2, confirm: build + typecheck pass, app boots light by default, dark toggle works, and Dashboard/Kanban already look warm (Tier-2 inheritance). **Phase 2 agents must branch from this committed foundation.**

---

# PHASE 2 — Tier-1 surfaces (parallel agents, after Phase 1)

> Each task is independent (different file) and may run as its own Sonnet agent. All consume the Phase 1 foundation; none modify `index.css`, `tailwind.config.js`, or `ui/index.tsx` except to *use* the new primitives. If a surface needs a new shared primitive, stop and add it to `ui/index.tsx` in a coordinated commit first.

## Task 4: Mobile shell redesign

**Files:**
- Modify: `apps/web/src/mobile/MobileShell.tsx`
- Reference: `DESIGN_HANDOFF_MOBILE.md` §5–§10 (structure/flows — keep), `DESIGN.md` §7.1 (Mobile), §6.3 (StatCard)

- [ ] **Step 1:** Replace the two hardcoded gradient hex (`#0d2e2a`, `#3a1d0e`, line ~87) and any other literal hex with token-driven gradients (`var(--grad-routine)`, `var(--grad-task)`) and `var(--*)` colors.
- [ ] **Step 2:** Apply warm-glass to the card stack: cards use 16px radius, `.glass` (or `GlassPanel`) surface, `.e4` stack shadow, next card peeking 24px. Preserve routine/task card anatomy, swipe-to-reveal, and the persistent timer bar from the handoff.
- [ ] **Step 3:** FAB uses accent gradient + `.e-accent` glow; timer bar = `var(--mantle)` glass with mono elapsed, left icon tinted by node type (ROUTINE `var(--c-routine)`, TASK `var(--c-task)`).
- [ ] **Step 4:** Stats tab uses the new `StatCard` primitive; values in type colors (streak=accent/orange, routines=routine, tasks=accent, skills=skill green).
- [ ] **Step 5:** Verify build + typecheck.
- [ ] **Step 6:** Preview proof at mobile width — `preview_resize` to 390×844, screenshot Today (routine card + timer), Today (task card), FAB sheet, Stats; both themes; console clean.
- [ ] **Step 7:** Commit: `feat(web): warm-glass mobile shell redesign`.

## Task 5: Dashboard redesign

**Files:**
- Modify: `apps/web/src/views/Dashboard.tsx`
- Reference: `DESIGN.md` §7.1 (Dashboard), `DESIGN_HANDOFF.md` §5.1 (widget content — keep), §8 (empty states)

- [ ] **Step 1:** Warm hero header (display type, §5.1) with greeting + date; leave a slot/prop for an optional ambient backdrop (Phase 4) but **do not** add WebGL here.
- [ ] **Step 2:** Convert widget tiles to glass (`GlassPanel`/`.glass` + `.e2`), with hover-lift and staggered `fade-in` entrance (reuse existing `.fade-in` keyframe, add per-tile `animation-delay`).
- [ ] **Step 3:** Streak badge keeps `streak-fire`; weekly ring uses `RingGauge` with `var(--accent)`; XP counter; Overdue/In-Progress lists render `NodeCard`; skill mini-bars use `ProgressBar` green; catch-ups red when overdue.
- [ ] **Step 4:** Verify build + typecheck.
- [ ] **Step 5:** Preview proof — screenshot Dashboard in both themes; confirm glass tiles, warm hero, accents; console clean.
- [ ] **Step 6:** Commit: `feat(web): warm-glass Dashboard redesign`.

## Task 6: Kanban redesign

**Files:**
- Modify: `apps/web/src/views/Kanban.tsx`
- Reference: `DESIGN.md` §7.1 (Kanban — "calm, fast, glass-lite"), §6.2 (NodeCard)

- [ ] **Step 1:** Columns sit on `var(--mantle)`; column header shows count + a soft `var(--accent)` underline on the active/filtered column. Replace the one literal hex with a token.
- [ ] **Step 2:** Cards use the re-skinned `NodeCard` (solid surfaces in long columns — do **not** wrap each card in heavy glass). DONE cards keep ~0.78 opacity + green check + `+Xh` badge.
- [ ] **Step 3:** DnD affordances: dragging card → `.e3` + slight scale; drop-target column → accent dashed border / inner glow. **Keep** existing native HTML5 DnD + `drag-drop-touch` behavior — re-skin only, no DnD rewrite.
- [ ] **Step 4:** Verify build + typecheck.
- [ ] **Step 5:** Preview proof — screenshot Kanban in both themes; perform a `preview_*` drag if feasible or at least confirm hover/drag styles via snapshot; console clean.
- [ ] **Step 6:** Commit: `feat(web): warm-glass Kanban redesign`.

---

# PHASE 3 — Tier-2 sweep + docs (single agent, after Phase 2)

## Task 7: Residual hardcoded-color sweep + supersede handoffs

**Files:**
- Modify: `apps/web/src/views/Graph.tsx` (8 literal hex: `#181825`, `#cdd6f4`, `#bac2de`, `#cba6f7`, `#585b70`, `#6c7086`, etc.), `apps/web/src/views/NodeDetail.tsx` (`#cba6f7` ×2), and any others surfaced by the grep below.
- Modify: `DESIGN_HANDOFF.md`, `DESIGN_HANDOFF_MOBILE.md` (banners)

- [ ] **Step 1:** Find remaining hardcoded Catppuccin hex: `grep -rnoE "#(181825|11111b|313244|45475a|585b70|6c7086|cdd6f4|bac2de|a6adc8|cba6f7|89b4fa|fab387|9399b2|f5c2e7|f9e2af|a6e3a1|f38ba8|94e2d5)" apps/web/src`. Replace each with the matching `var(--*)` token (e.g. `#cba6f7` → `var(--c-domain)` or `var(--accent)` per context; `#181825` → `var(--mantle)`; `#6c7086` → `var(--overlay0)`). Leave intentional brand colors (e.g. Google logo hexes in `Settings.tsx`, fire colors in `index.css`) as-is.
- [ ] **Step 2:** Add a banner to the top of both handoff docs:
  `> ⚠️ **Superseded by [DESIGN.md](./DESIGN.md).** This document predates the warm-glassmorphism redesign and is retained only for view-flow / interaction reference (user flows, card anatomy, swipe gestures). For colors, theme, and components, follow DESIGN.md.`
- [ ] **Step 3:** Verify build + typecheck.
- [ ] **Step 4:** Preview proof — load Graph and NodeDetail in both themes; confirm no stray dark-mocha colors remain; console clean.
- [ ] **Step 5:** Commit: `refactor(web): tokenize residual hex; mark handoffs superseded`.

---

# PHASE 4 — Optional showcase (deferred; only if requested)

## Task 8 (optional): AmbientBackdrop for Dashboard hero / empty states

**Files:**
- Create: `apps/web/src/components/ui/AmbientBackdrop.tsx`
- Modify: `apps/web/src/views/Dashboard.tsx` (mount behind hero)

- [ ] **Step 1:** Implement a CSS animated warm-gradient backdrop first (no dependency): a low-contrast moving `radial/linear-gradient` peach/neutral layer, `position:absolute; inset:0; z-index:0; pointer-events:none`. Under `@media (prefers-reduced-motion: reduce)` it renders static.
- [ ] **Step 2 (only if higher fidelity is explicitly wanted):** Add `three` (`npm i three -w web`, `npm i -D @types/three -w web`) and port the reference shader from `html example/ex.html` as a lazy-loaded layer: cap `setPixelRatio` at 2, pause on `document.hidden`, single instance, cleanup on unmount. Guard behind reduced-motion (fall back to the CSS layer).
- [ ] **Step 3:** Verify build + typecheck; confirm no perf regression (server logs / console clean).
- [ ] **Step 4:** Preview proof — Dashboard with backdrop, both themes, reduced-motion emulation static.
- [ ] **Step 5:** Commit: `feat(web): ambient showcase backdrop for Dashboard hero`.

---

## Self-review notes (author)

- **Spec coverage:** DESIGN.md §3 (tokens)→T1; §4 node hues→T1; §5 elevation/motion→T1/T3; §6 components + Do/Don't→T2/T3; §7 tiers→T4–T7; §8 WebGL→T8; §9 migration steps 1–6→T1,T4–T7. All covered.
- **No new dependency on the critical path:** framer-motion/three are absent; Tier-1 uses CSS keyframes only. `three` is introduced (optionally) solely in Task 8.
- **Naming consistency:** `GlassPanel`, `StatCard`, `.glass`, `.e1–.e4`, `.e-accent`, `--surface-slate`, `--accent-soft`, `--accent-strong`, `--border` are used identically across tasks.
- **Parallel safety:** only Phase 2 tasks run in parallel and they touch disjoint files (`MobileShell.tsx`, `Dashboard.tsx`, `Kanban.tsx`); shared foundation is frozen after Phase 1.
