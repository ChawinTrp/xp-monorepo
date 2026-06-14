> ⚠️ **Superseded by [DESIGN.md](./DESIGN.md).** This document predates the warm-glassmorphism redesign and is retained only for view-flow / interaction reference (user flows, card anatomy, swipe gestures). For colors, theme, and components, follow DESIGN.md.

# XP — Mobile Design Handoff

> Use this document to create high-fidelity mobile UI mockups for Project XP.
> Read the full desktop spec in `DESIGN_HANDOFF.md` and `XP.md` for context.
> This document is **mobile-only**. Desktop views are unchanged.

---

## 1. What Is XP (Mobile Context)

A **personal life operating system** used daily by a single user (CT). On mobile, the scope is intentionally narrow:

- **ROUTINE** — daily habits with streaks, timers, and check-ins
- **TASK** — actionable items with status, due dates, and timers

Everything else (Graph, Skills, Gantt, People) lives on desktop only.

**Core mobile need:** Open the app, see what to do next, check it off, close the app. Maximum 3 taps for any primary action.

---

## 2. Architecture — Approach A (Dual Layout)

At `≤768px` the entire desktop layout (sidebar + topbar + views) is replaced by the mobile shell. Same GraphQL API. Same data. No new backend.

```
DESKTOP (>768px)          MOBILE (≤768px)
┌──────┬──────────────┐   ┌─────────────────┐
│Sidebar│  View        │   │  Card Stack     │
│      │             │   │                 │
│      │             │   │  [Timer Bar]    │
│      │             │   ├─────────────────┤
└──────┴──────────────┘   │  Today │ Stats │
                           └─────────────────┘
```

---

## 3. Design Language

Same as desktop — **Catppuccin Mocha dark theme**. See `DESIGN_HANDOFF.md` §3 for full token list.

**Mobile-specific overrides:**

| Token | Value | Usage |
|-------|-------|-------|
| Card border-radius | 16px | Larger than desktop (8px) — thumb-friendly |
| Card shadow | `0 8px 32px rgba(0,0,0,0.4)` | Stack depth illusion |
| Bottom nav height | 60px + safe-area-inset | iOS home bar clearance |
| FAB size | 56px diameter | Standard touch target |
| FAB color | Accent `#cba6f7` | Same accent purple |
| FAB shadow | `0 4px 16px rgba(203,166,247,0.35)` | Glow effect |
| Timer bar bg | Mantle `#181825` | Recessed below cards |
| Touch target min | 44×44px | All interactive elements |
| Font: UI | Inter | Same as desktop |
| Font: Timers/IDs | JetBrains Mono | Monospaced for elapsed time |

---

## 4. App Shell

```
┌──────────────────────────┐
│                          │  ← status bar (system)
│                          │
│   [Card Stack Area]      │  ← scrollable, card-based
│                          │
│   [FAB  +]               │  ← floating, bottom-right
├──────────────────────────┤
│  [Timer Bar] (if active) │  ← persistent, 48px
├──────────────────────────┤
│   Today  │   Stats       │  ← bottom navigation, 60px
└──────────────────────────┘
   ⬛⬛⬛⬛⬛⬛⬛⬛⬛  ← home indicator (safe area)
```

### Bottom Navigation

```
┌──────────────────────────┐
│  [○]Today  │  [◻]Stats  │
│  (accent)  │  (subtext) │
└──────────────────────────┘
```

- Active tab: icon + label in accent purple, 2px underline
- Inactive tab: icon + label in Subtext 1
- Icons: `CalendarCheck` (Today), `BarChart2` (Stats) — Lucide

---

## 5. Today View — Card Stack

### Time-of-Day Layout

Cards are grouped under section headers. The stack shows one card at a time with the next card peeking 24px from the bottom.

```
┌──────────────────────────┐
│  ──── MORNING ────        │  ← section header (non-card, dismissible)
│                          │
│  ┌────────────────────┐  │
│  │  [Active Card]     │  │  ← full card visible
│  └────────────────────┘  │
│     ┌──────────────┐     │  ← next card peeking (24px)
│     └──────────────┘     │
└──────────────────────────┘
```

**Card order within a time block:**
1. Routines assigned to that time (sorted by streak desc — highest streak shown first)
2. Tasks that are overdue or due today, in priority order (🔴 High → 🟡 Medium → 🟢 Low)

**Time blocks:**
- **Morning** (🌅) — routines with `metadata.timeOfDay = 'morning'`
- **Afternoon** (☀️) — routines with `metadata.timeOfDay = 'afternoon'`
- **Evening** (🌇) — routines with `metadata.timeOfDay = 'evening'`
- **Night** (🌙) — routines with `metadata.timeOfDay = 'night'`
- **Tasks** without a time match appear under the nearest appropriate block by priority

---

## 6. Card Anatomy

### 6.1 Routine Card

```
┌──────────────────────────────────────┐
│  [● ROUTINE]                    🌅   │  ← type badge + time-of-day icon
│                                      │
│  Meditation                          │  ← title 24px bold
│  30 min · Daily                      │  ← target + cadence 12px Subtext1
│                                      │
│  ──────────────────────────────      │  ← timer bar (green fill, animated)
│  ▶▌ 00:12:34                         │  ← elapsed (JetBrains Mono, 20px)
│  [      ▶  Start timer       ]       │  ← OR this when timer not running
│                                      │
│  🔥 14d streak    ████░░  80%        │  ← streak + 30-day consistency bar
│                                      │
│  [      Skip      ]  [  Check in ✓ ]│  ← action row (equal width)
└──────────────────────────────────────┘
```

**States:**

| State | Visual change |
|-------|--------------|
| Timer not running | "▶ Start timer" button, no progress bar |
| Timer running | Progress bar fills, elapsed ticks, button becomes "⏸ Pause" |
| Checked in today | Card shows green checkmark overlay at top-right, "Check in" becomes "Undo ↩" |
| Streak at risk (yesterday missed) | Streak badge pulses orange |

**Colors:**
- Card bg: `Surface 0` #313244
- Timer bar fill: `Green` #a6e3a1
- Check-in button: `Green` at 15% opacity bg, `Green` text
- Skip button: `Mantle` bg, `Subtext 1` text
- Streak flame: `Orange` #fab387 when active, `Overlay 0` when broken

---

### 6.2 Task Card

```
┌──────────────────────────────────────┐
│  🔴 [● TASK]              ⚠ OVERDUE │  ← priority dot + badge + overdue tag
│                                      │
│  Fix auth bug                        │  ← title 24px bold
│  Work › Dev › Project XP             │  ← breadcrumb 11px Subtext1
│  Due: Today                          │  ← due date (Red if overdue)
│                                      │
│  ──────────────────────────────      │  ← timer bar (blue fill)
│  ▶▌ 00:45:12                         │  ← elapsed
│  [  ▶ Start timer  ]    [~ 2h est]   │  ← OR timer button + hours badge
│                                      │
│  [      Skip      ]  [    Done ✓   ]│  ← action row
└──────────────────────────────────────┘
```

**Priority dot colors:**
- 🔴 High — Red `#f38ba8`
- 🟡 Medium — Yellow `#f9e2af`
- 🟢 Low — Green `#a6e3a1`
- No priority — Overlay 0 `#6c7086`

**Done button behavior:**
- If timer is running: Done button shows ⚠ icon, tapping it stops timer first then completes
- If timer not running: completes immediately via `completeTask` mutation
- After completion: card slides out upward with XP toast (e.g., "+2h SWE")

---

### 6.3 Swipe Gesture (Both Card Types)

```
  ←────── swipe left ──────
  ┌────────────────────────────────────────────┐
  │  [  ✗ Skip  ]    [  Card Content  ]        │
  └────────────────────────────────────────────┘

  ──────── swipe right ────→
  ┌────────────────────────────────────────────┐
  │    [  Card Content  ]    [  ✓ Done/Check ]  │
  └────────────────────────────────────────────┘
```

- Swipe reveals a full-height action panel (does NOT auto-complete)
- User must **tap the revealed button** to confirm
- Threshold: 40% card width before action panel fully reveals
- Release before threshold: card snaps back
- Revealed panels: Skip = `Red` at 20% opacity | Done/Check = `Green` at 20% opacity

---

## 7. Persistent Timer Bar

Shows above bottom navigation whenever a timer is running on any node.

```
┌──────────────────────────────────────┐
│  ⏸  Meditation          01:23:45  ■ │
│     (tap anywhere to focus card)     │
└──────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Background | Mantle `#181825`, 1px top border `Surface 1` |
| Height | 48px |
| Left icon | Pause/Play (16px), Orange if ROUTINE, Blue if TASK |
| Title | Node title, truncated, 13px |
| Elapsed | `JetBrains Mono` 14px, Subtext 0 |
| Stop button | ■ icon, 28px tap target, Red on tap |
| Pulse animation | Left icon pulses at 2s interval when running |

---

## 8. FAB — Quick Capture

Floating action button, fixed bottom-right, 16px from edge, 76px from bottom nav.

**Tapping FAB opens a bottom sheet (slides up):**

```
┌──────────────────────────────────────┐
│            ▬▬▬▬▬                     │  ← drag handle
│                                      │
│   [  Task  ]    [  Routine  ]        │  ← type toggle (pill style)
│                                      │
│   What needs doing?                  │  ← placeholder, 16px
│   ┌──────────────────────────────┐   │
│   │                              │   │  ← title input (autofocus)
│   └──────────────────────────────┘   │
│                                      │
│   ── Task fields (if Task) ─────     │
│   Project  [Search...          ▾]    │
│   Due date [Pick date          📅]   │
│   Est hours [  __ h  ]               │
│                                      │
│   ── Routine fields (if Routine) ─── │
│   Cadence  [  Daily  ▾]              │
│   Target   [  30 min  ]              │
│   Time     [  Morning ▾]             │  ← timeOfDay field
│                                      │
│   [          Create          ]       │  ← accent purple, full-width, 48px
└──────────────────────────────────────┘
```

- Keyboard opens: sheet slides up with keyboard
- `Return` key submits if title is filled
- After create: sheet closes, new card slides into stack with a subtle spring animation
- Error: shake animation on Create button if title empty

---

## 9. Stats Tab

Minimal. No charts or graphs — just numbers and lists.

```
┌──────────────────────────────────────┐
│  Stats                               │  ← 28px bold title
│  Wednesday, 28 May 2026              │  ← 12px mono subtext
│                                      │
│  ┌────────┐  ┌────────┐             │
│  │ 🔥 14 │  │ ○ 4/5  │             │  ← stat cards (2 col)
│  │ days   │  │ today  │             │
│  └────────┘  └────────┘             │
│  ┌────────┐  ┌────────┐             │
│  │ ✓ 8   │  │ ⚡342h │             │
│  │ /15 wk │  │ skills │             │
│  └────────┘  └────────┘             │
│                                      │
│  ── Recent completions ──            │  ← section header
│  ✓ Fix auth bug          +2h  2h ago│
│  ✓ Meditation          +0.5h  3h ago│
│  ✓ Write tests           +1h  1d ago│
│                                      │
│  ── Upcoming catch-ups ──            │
│  [CT] Alice S     Work    in 2 days  │
│  [BK] Bob K       Dev     in 5 days  │
└──────────────────────────────────────┘
```

**Stat card specs:**
- 2-column grid, equal width, 12px gap
- Height: 80px, border-radius 12px, `Surface 0` bg
- Value: 28px bold, type color (Streak = Orange, Routines = Routine color, Tasks = accent, Skills = Skill green)
- Label: 11px uppercase Subtext 1

---

## 10. Key User Flows

### Flow 1: Morning Routine
1. Open app → Today view, "Morning" section
2. Meditation card is first
3. Tap "▶ Start timer" → timer bar appears, card shows elapsed
4. After meditating: tap "⏸" in timer bar → auto check-in + toast "Day 15! Keep going"
5. Card slides out, next card (next routine or task) slides up

### Flow 2: Quick Task Add
1. Tap "+" FAB
2. Bottom sheet opens, title input focused
3. Type "Review PR" → select Project → set Due = Today
4. Tap Create → card appears in stack
5. Later: swipe right → tap "Done ✓" → task completes, "+0h SWE" toast (no hours = 0)

### Flow 3: Check Stats Before Bed
1. Tap "Stats" tab
2. Scan: 14d streak, 5/5 routines, 8 tasks done this week
3. See Alice S catch-up is in 2 days
4. Tap catch-up → contact info sheet (name, email, phone, schedule button)

---

## 11. Screens to Mockup

Claude Design should produce **5 screens** minimum, iPhone 14 Pro frame (390×844pt), Catppuccin Mocha dark theme:

| Screen | Description |
|--------|-------------|
| 1 | **Today — Routine card** with timer running (Morning section, timer bar active, elapsed showing) |
| 2 | **Today — Task card** (overdue, no timer running, showing breadcrumb + due date) |
| 3 | **Today — Swipe reveal** (card half-swiped right, green "Done ✓" panel revealed) |
| 4 | **FAB bottom sheet** (Task type selected, title filled, project + due + hours showing) |
| 5 | **Stats tab** (all 4 stat cards + recent completions + catch-ups) |

**Optional bonus screens:**
- Timer bar detail (zoomed in on the persistent bar)
- Empty state ("You're all caught up 🎉")
- Routine card in "checked in" state (green overlay, Undo option)
