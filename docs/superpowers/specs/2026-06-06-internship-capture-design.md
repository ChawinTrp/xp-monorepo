# Spec: Fast Internship Capture

> **Status:** Approved design (2026-06-06) · ready for implementation plan
> **Author:** CT · Opus · 2026-06-06
> **Approach:** A + "save & add another" (evolve the single `CreateNodeModal`)

## Problem

The Accenture internship (active 1 Jun – 31 Jul 2026) runs a daily loop: **meet
people + get tasks**, captured on a phone in the hallway (longform notes stay in
a physical book → Obsidian later). Four frictions make the current capture path
slow and lossy — all four were confirmed as real pains:

1. **Person capture is buried** — the mobile FAB opens `CreateNodeModal` with no
   `defaultType`, landing on TASK. Adding a person you just met needs an extra
   tap onto the PERSON chip.
2. **No contact fields at capture** — `email` / `phone` are canonical PERSON
   metadata (`NODE.md:51`) but the modal never exposes them, so a captured
   contact saves with no way to reach them.
3. **Tasks land unfiled** — a handed-to-you task has no fast default
   project/domain, so internship tasks scatter across the graph.
4. **Capture is too slow overall** — every capture re-picks the same context
   (project, circle), and back-to-back captures (a room of people) each require
   a full open → fill → close cycle.

## Goal

Make hallway capture **fast, complete, and self-filing** without adding a second
capture surface to maintain. Title is the only required field; everything else
is optional or pre-filled.

## Non-Goals (YAGNI)

- No Settings UI for an "active context" — *remember-last-used* covers it (you
  pick the Accenture project/circle once and it sticks).
- No LinkedIn field — it has no schema slot; put it in `description`.
- No GraphQL / resolver / Mongoose schema changes. `email` / `phone` are
  existing `metadata` keys.
- No separate mobile "capture sheet" — reuse `CreateNodeModal`.

## Key Insight

**"Remember last-used" *is* the internship-project anchor.** The user's filing
answer was "a single Internship project **and** remember last-used"; these are
the same mechanism. Pick the Accenture project (TASK) / circle (PERSON) once at
capture; persist it in `localStorage`; pre-fill it next time. No fixed-anchor
setting required.

---

## Design

### Component 1 — `CreateNodeModal` (`apps/web/src/components/CreateNodeModal.tsx`)

**1a. Remembered defaults (localStorage)**

| Key | Written when | Read when | Pre-fills |
|---|---|---|---|
| `xp.capture.lastProjectId` | a TASK is created with a `mainParent` | modal opens as TASK and no `defaultParentId` prop | TASK `parentId` (project) |
| `xp.capture.lastCircle` | a PERSON is created | modal opens as PERSON and no `defaultCircle` prop | PERSON `circle` |

- **Precedence:** explicit prop (`defaultParentId` / `defaultCircle`) > remembered
  value > current hardcoded default (`''` project, `'Network'` circle).
- **Guard:** a remembered `lastProjectId` not present in `byId` (node deleted) is
  ignored, falling through to the next precedence level.
- **Resilience:** all `localStorage` access wrapped so a throwing/absent store
  (private mode, SSR) degrades to today's defaults — capture never breaks.
- A tiny module-local helper pair (`readCapturePref` / `writeCapturePref`) keeps
  the try/catch in one place.

**1b. Contact fields on PERSON**

- Add optional `email` and `phone` single-line `<input>`s to the existing
  PERSON field grid (alongside Role / Circle).
- On submit, write non-empty values to `metadata.email` / `metadata.phone`
  (omit empty — consistent with how `role` is handled today).
- `email` uses `type="email"`, `phone` uses `type="tel"` (mobile keyboards).
- No validation beyond "non-empty" — a hallway capture should never reject a
  messy value.

**1c. "Save & add another"**

- Add a secondary button in the footer next to "Create".
- Extract the create logic so both buttons share it; add a `keepOpen` parameter:
  - `keepOpen = false` (Create): current behavior — create, toast, `onClose()`,
    `onCreated(id)`.
  - `keepOpen = true` (Save & add another): create, toast, persist remembered
    defaults, then reset **only** `title` / `description` / `role` / `email` /
    `phone`; **keep** `type`, `parentId`, `circle`, `linkedSkillIds`; refocus the
    title input. Does **not** call `onClose` / `onCreated`.
- Empty-title validation already blocks submit and keeps the modal open — no new
  handling needed.

### Component 2 — Mobile FAB (`apps/web/src/mobile/MobileShell.tsx`)

- Replace the single-action FAB (which opens the modal with no type) with a
  small two-action launcher.
- Tap FAB → a compact popover with **＋ Task** and **＋ Person**. Selecting one
  sets a `captureType` state and opens `CreateNodeModal` with that `defaultType`
  (prop already supported).
- Popover dismisses on outside tap / selection. Keep the existing FAB position,
  size, and safe-area offsets.
- The modal's MobileShell instance currently passes no props; it will now pass
  `defaultType={captureType}`.

### Component 3 — People view (`apps/web/src/views/People.tsx`)

- No new work. The existing WIP "Add person" / "New circle" buttons already pass
  `defaultType="PERSON"` + `defaultCircle`; they inherit the remembered-circle
  behavior automatically. Confirm `defaultCircle` precedence still beats the
  remembered value (it should, per 1a).

---

## Data Flow

```
User taps FAB ──▶ choose Task/Person ──▶ CreateNodeModal (defaultType)
                                              │
              localStorage pre-fill ──────────┤  (lastProjectId / lastCircle)
                                              ▼
                       fill title (+ optional fields)
                                              │
                   ┌──────────────────────────┴───────────────────────┐
                   ▼                                                    ▼
            "Create"                                        "Save & add another"
       createNode → toast                                createNode → toast
       persist defaults → close                          persist defaults → reset
                                                          title/desc/contact, keep
                                                          type/project/circle, refocus
```

- The **only** new persistence is `localStorage` (client-side pre-fill).
- `createNode` mutation, `metadata` shape, and refetch behavior are unchanged.

## Edge Cases

| Case | Behavior |
|---|---|
| First run / no `localStorage` value | Today's defaults (`''` project, `'Network'` circle) |
| `localStorage` throws (private mode) | Caught → treated as "no value" → defaults |
| Remembered project since deleted | Not in `byId` → ignored → falls through |
| Explicit `defaultParentId`/`defaultCircle` prop | Wins over remembered value |
| Empty title on either save button | Existing validation blocks; modal stays open |
| "Save & add another" as PERSON | Keeps circle (great for a room); clears name/role/email/phone |

## Testing

**Static:** `npx tsc -p apps/api/tsconfig.json --noEmit` (sanity) and
`apps/web/tsconfig.json --noEmit`; `npm run build -w web`.

**Manual smoke (dev server, mobile viewport ≤768px):**
1. FAB → **Person** → enter name + email + phone + circle → "Save & add another"
   → modal stays open, name/email/phone cleared, **circle retained**; add a
   second person → both appear under the right circle in People.
2. FAB → **Task** → pick a project → Create; reopen FAB → Task → project is
   **pre-filled** from last use.
3. Reload the page → last project/circle still pre-fill (localStorage persisted).
4. Desktop People → "New circle" → name it → modal opens pre-set to that circle;
   created person lands in it.
5. Regression: TASK capture from Kanban (`defaultParentId`) still pre-fills the
   passed project, not the remembered one.

## Files Touched

- `apps/web/src/components/CreateNodeModal.tsx` — remembered defaults, email/phone, save-&-add-another.
- `apps/web/src/mobile/MobileShell.tsx` — type-aware FAB launcher.
- `apps/web/src/views/People.tsx` — verify only (no change expected).

No API, schema, or `@xp/shared` changes.
