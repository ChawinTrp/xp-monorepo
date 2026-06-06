# Fast Internship Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mobile hallway capture during the internship fast, complete, and self-filing by evolving the single `CreateNodeModal` (remembered defaults, email/phone, repeat-capture) and making the mobile FAB type-aware.

**Architecture:** Pure client-side. No GraphQL/Mongoose/`@xp/shared` changes — `email`/`phone` are existing PERSON `metadata` keys. New persistence is `localStorage` for pre-fill only. The mobile FAB gains a 2-action launcher that opens the existing modal pre-typed.

**Tech Stack:** React 19 + TypeScript (Vite), Apollo Client, existing `CreateNodeModal` / `MobileShell` components, Catppuccin CSS vars.

**Testing note:** This app has no unit-test runner. Verification gates are `npx tsc -p apps/web/tsconfig.json --noEmit`, `npm run build -w web`, and the manual smoke tests below — these are the project's established checks (see the win-the-week work and the c0f459f capture commit, both verified the same way).

**Spec:** `docs/superpowers/specs/2026-06-06-internship-capture-design.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `apps/web/src/components/CreateNodeModal.tsx` | The single create/capture form | Add email/phone (PERSON), localStorage remembered defaults, "Save & add another" |
| `apps/web/src/mobile/MobileShell.tsx` | Mobile shell + FAB | Type-aware FAB launcher (Task/Person) → opens modal pre-typed |
| `apps/web/src/views/People.tsx` | Desktop People grid | Verify only — no change expected |

All four tasks land on the `feat/internship-capture` branch (already created; spec already committed there).

---

## Task 1: Email + phone fields on PERSON capture

Smallest, isolated change. `email`/`phone` are canonical PERSON metadata (`NODE.md:51`).

**Files:**
- Modify: `apps/web/src/components/CreateNodeModal.tsx`

- [ ] **Step 1: Add `email` / `phone` state**

In the state block (after `const [circle, setCircle] = useState<string>('Network');`, around line 55), add:

```tsx
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
```

- [ ] **Step 2: Reset the new fields on open**

In the `useEffect(() => { if (open) { ... } }, [...])` reset block, after `setRole('');` add:

```tsx
      setEmail('');
      setPhone('');
```

- [ ] **Step 3: Write the values into PERSON metadata on submit**

In `handleSubmit`, inside the `if (type === 'PERSON') { ... }` block, after `if (role.trim()) metadata.role = role.trim();` add:

```tsx
      if (email.trim()) metadata.email = email.trim();
      if (phone.trim()) metadata.phone = phone.trim();
```

- [ ] **Step 4: Render the inputs in the PERSON grid**

The PERSON block is a `grid grid-cols-2 gap-3` containing Role + Circle. Replace the **whole** PERSON block (the `{type === 'PERSON' && ( ... )}` region, ~lines 414-448) with this — it keeps Role + Circle and adds Email + Phone as two more cells (a 2×2 grid):

```tsx
          {/* Person-specific */}
          {type === 'PERSON' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Backend Dev, Mentor"
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              <div>
                <Label>Circle</Label>
                <select
                  value={circle}
                  onChange={(e) => setCircle(e.target.value)}
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                >
                  {circleOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Email</Label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="optional"
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                />
              </div>
            </div>
          )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/CreateNodeModal.tsx
git commit -m "feat(capture): email + phone on PERSON capture"
```

---

## Task 2: Remembered capture defaults (localStorage)

Pre-fill last-used project (TASK) and circle (PERSON); persist on create. This is the "internship anchor" mechanism.

**Files:**
- Modify: `apps/web/src/components/CreateNodeModal.tsx`

- [ ] **Step 1: Add the localStorage helpers**

After the `deriveInitials` function (around line 19, before `interface CreateNodeModalProps`), add:

```tsx
// Remembered capture defaults — pick the internship project/circle once and it
// sticks. localStorage access is guarded so private mode / SSR degrades to the
// hardcoded defaults rather than breaking capture.
const CAPTURE_KEYS = {
  project: 'xp.capture.lastProjectId',
  circle: 'xp.capture.lastCircle',
} as const;

function readCapturePref(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeCapturePref(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
```

- [ ] **Step 2: Pre-fill parentId and circle from remembered values on open**

In the reset `useEffect`, replace these two lines:

```tsx
      setParentId(defaultParentId ?? '');
```
...and...
```tsx
      setCircle(defaultCircle ?? 'Network');
```

with (note: `setParentId` stays where it is in the ordering; only the value changes — and `setCircle` likewise):

```tsx
      const initialType = defaultType ?? 'TASK';
      const rememberedProject = readCapturePref(CAPTURE_KEYS.project);
      // Remembered project only applies to TASK capture, and only if it still exists.
      setParentId(
        defaultParentId
        ?? (initialType === 'TASK' && rememberedProject && byId[rememberedProject]
              ? rememberedProject
              : ''),
      );
```
```tsx
      setCircle(defaultCircle ?? readCapturePref(CAPTURE_KEYS.circle) ?? 'Network');
```

- [ ] **Step 3: Prevent the effect from re-running mid-typing**

The effect now reads `byId`. Do NOT add `byId` to the dependency array (it changes identity on cache updates and would reset the form while typing). Add a disable comment directly above the existing dependency array line so lint stays clean. Change:

```tsx
  }, [open, defaultType, defaultStatus, defaultParentId, defaultCircle]);
```
to:
```tsx
    // byId intentionally omitted: only read on open; including it would reset the form on cache updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultType, defaultStatus, defaultParentId, defaultCircle]);
```

- [ ] **Step 4: Persist the chosen defaults after a successful create**

In `handleSubmit`, immediately after the `toast({ message: \`${type} created\`, ... })` line and before `onClose();`, add:

```tsx
      if (type === 'TASK' && parentId) writeCapturePref(CAPTURE_KEYS.project, parentId);
      if (type === 'PERSON') writeCapturePref(CAPTURE_KEYS.circle, circle);
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0, no output.

- [ ] **Step 6: Manual check (dev server running on :5173)**

Open the create modal, pick a project for a TASK, create it. Open a new TASK capture → the project is pre-selected. Reload the page → still pre-selected. (If no dev server is running, defer to the Task 5 smoke run.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/CreateNodeModal.tsx
git commit -m "feat(capture): remember last project/circle as capture defaults"
```

---

## Task 3: "Save & add another"

Keep the modal open for back-to-back captures (a room of people).

**Files:**
- Modify: `apps/web/src/components/CreateNodeModal.tsx`

- [ ] **Step 1: Convert `handleSubmit` to take a `keepOpen` flag**

Change the signature line:

```tsx
  const handleSubmit = async () => {
```
to:
```tsx
  const handleSubmit = async (keepOpen = false) => {
```

- [ ] **Step 2: Branch the post-create behavior on `keepOpen`**

In the `try { ... }` block, replace this tail:

```tsx
      toast({ message: `${type} created`, variant: 'success', details: title.trim() });
      if (type === 'TASK' && parentId) writeCapturePref(CAPTURE_KEYS.project, parentId);
      if (type === 'PERSON') writeCapturePref(CAPTURE_KEYS.circle, circle);
      onClose();
      if (onCreated && data?.createNode?._id) {
        onCreated(data.createNode._id);
      }
```

with:

```tsx
      toast({ message: `${type} created`, variant: 'success', details: title.trim() });
      if (type === 'TASK' && parentId) writeCapturePref(CAPTURE_KEYS.project, parentId);
      if (type === 'PERSON') writeCapturePref(CAPTURE_KEYS.circle, circle);

      if (keepOpen) {
        // Keep type / project / circle / linked skills; clear only the per-item fields.
        setTitle('');
        setDescription('');
        setRole('');
        setEmail('');
        setPhone('');
        setTimeout(() => titleRef.current?.focus(), 50);
      } else {
        onClose();
        if (onCreated && data?.createNode?._id) {
          onCreated(data.createNode._id);
        }
      }
```

> Note: the `writeCapturePref` lines were added in Task 2 Step 4. If executing Task 3 before that exists, add them here as shown.

- [ ] **Step 3: Fix the Enter-key call site**

The title input's `onKeyDown` calls `handleSubmit()`. With the new default param `keepOpen = false`, `handleSubmit()` still works unchanged — confirm the line reads:

```tsx
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(); }}
```
(No edit needed; this step is a verification that the default arg preserves Enter = create-and-close.)

- [ ] **Step 4: Add the footer button**

Replace the footer block:

```tsx
        {/* Footer */}
        <div className="flex justify-end gap-2.5" style={{ padding: '14px 20px', borderTop: '1px solid var(--surface1)' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !title.trim()}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </div>
```

with:

```tsx
        {/* Footer */}
        <div className="flex justify-end gap-2.5" style={{ padding: '14px 20px', borderTop: '1px solid var(--surface1)' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={() => handleSubmit(true)} disabled={loading || !title.trim()}>
            Save &amp; add another
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={loading || !title.trim()}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </div>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/CreateNodeModal.tsx
git commit -m "feat(capture): 'save & add another' for back-to-back capture"
```

---

## Task 4: Type-aware mobile FAB

Tap FAB → choose Task or Person → modal opens pre-typed. Kills the "person is buried" friction.

**Files:**
- Modify: `apps/web/src/mobile/MobileShell.tsx`

- [ ] **Step 1: Add FAB-launcher state**

In `MobileShell`, next to `const [createOpen, setCreateOpen] = useState(false);` (line 694), add:

```tsx
  const [fabOpen, setFabOpen] = useState(false);
  const [captureType, setCaptureType] = useState<string>('TASK');

  const openCapture = (t: string) => {
    setCaptureType(t);
    setCreateOpen(true);
    setFabOpen(false);
  };
```

- [ ] **Step 2: Replace the FAB + modal block**

Replace the existing FAB button and `<CreateNodeModal .../>` (lines ~795-813):

```tsx
      {/* FAB — quick capture */}
      <button
        onClick={() => setCreateOpen(true)}
        style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)', right: 16,
          width: 56, height: 56, borderRadius: 999,
          background: 'var(--accent)',
          boxShadow: '0 4px 16px rgba(203,166,247,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', zIndex: 100,
        }}
      >
        <Icons.Plus size={24} color="var(--mantle)" strokeWidth={2.5} />
      </button>

      <CreateNodeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
```

with:

```tsx
      {/* FAB launcher backdrop */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
        />
      )}

      {/* FAB launcher actions */}
      {fabOpen && (
        <div style={{
          position: 'fixed', right: 16,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 140px)',
          zIndex: 101, display: 'flex', flexDirection: 'column', gap: 10,
          animation: 'fadeIn 0.12s ease-out',
        }}>
          <FabAction label="Person" icon={<Icons.Users size={16} color="var(--mantle)" />} onClick={() => openCapture('PERSON')} />
          <FabAction label="Task" icon={<Icons.CheckSquare size={16} color="var(--mantle)" />} onClick={() => openCapture('TASK')} />
        </div>
      )}

      {/* FAB — quick capture */}
      <button
        onClick={() => setFabOpen((v) => !v)}
        style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)', right: 16,
          width: 56, height: 56, borderRadius: 999,
          background: 'var(--accent)',
          boxShadow: '0 4px 16px rgba(203,166,247,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', zIndex: 100,
          transition: 'transform 0.15s ease',
          transform: fabOpen ? 'rotate(45deg)' : 'none',
        }}
      >
        <Icons.Plus size={24} color="var(--mantle)" strokeWidth={2.5} />
      </button>

      <CreateNodeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultType={captureType}
      />
```

- [ ] **Step 3: Add the `FabAction` helper component**

At the bottom of the file (after the `MobileShell` component, before or after the `S` styles object — top-level, not nested), add:

```tsx
function FabAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: 'var(--accent)', color: 'var(--mantle)',
        fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
        boxShadow: '0 4px 14px rgba(203,166,247,0.3)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
```

> `Icons.Users` and `Icons.CheckSquare` are already used elsewhere (Dashboard); confirm they exist in `apps/web/src/components/ui`. If `CheckSquare` is missing, use `Icons.Check`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/mobile/MobileShell.tsx
git commit -m "feat(capture): type-aware mobile FAB (Task / Person)"
```

---

## Task 5: Verify, build, and smoke-test

**Files:**
- Verify only: `apps/web/src/views/People.tsx`

- [ ] **Step 1: Confirm People view needs no change**

Open `apps/web/src/views/People.tsx`. Confirm its `<CreateNodeModal>` passes `defaultType="PERSON"` and `defaultCircle={createCircle}`. Because explicit `defaultCircle` wins over the remembered value (Task 2 precedence), "New circle" still opens to the typed circle. No edit expected.

- [ ] **Step 2: Full web build**

Run: `npm run build -w web`
Expected: `✓ built` with exit 0 (the ~500kB chunk-size warning is pre-existing and fine).

- [ ] **Step 3: Start the dev servers**

Run (two terminals, or background):
`npm run start:dev -w api` and `npm run dev -w web`

- [ ] **Step 4: Manual smoke — mobile capture (viewport ≤768px, e.g. devtools 375px)**

Verify each:
1. Tap FAB → launcher shows **Person** / **Task**.
2. **Person** → modal opens typed PERSON; enter name + email + phone + pick a circle → **Save & add another** → modal stays open, name/email/phone cleared, **circle retained**, title focused. Add a second person → both appear under that circle in `/people`.
3. **Task** → modal opens typed TASK; pick a project → Create. Reopen FAB → Task → project **pre-filled**.
4. Reload page → last project/circle still pre-fill.

- [ ] **Step 5: Manual smoke — desktop regression**

1. `/people` → **New circle** → name it → modal opens to that circle → create → person lands in it.
2. Kanban "+ Add Task" (passes `defaultParentId`) → confirm it pre-fills the **passed** project, not the remembered one.

- [ ] **Step 6: Final commit (if any verify-only tweaks were needed)**

```bash
git add -A
git commit -m "chore(capture): verify People view + smoke fixes"
```
(Skip if nothing changed.)

---

## Definition of Done

- [ ] `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0
- [ ] `npm run build -w web` → built, exit 0
- [ ] Mobile FAB offers Task/Person and opens the modal pre-typed
- [ ] PERSON capture stores `email`/`phone` in metadata
- [ ] Last project (TASK) and circle (PERSON) pre-fill and survive reload
- [ ] "Save & add another" keeps type/project/circle, clears per-item fields, refocuses title
- [ ] Explicit `defaultParentId`/`defaultCircle` (Kanban, People) still win over remembered values
- [ ] No API / GraphQL / `@xp/shared` / Mongoose changes
