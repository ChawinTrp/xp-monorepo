# UC: Routine Check-In

## User Story
As a user, I check in my daily routine, optionally using a timer for actual time tracking. Hours are credited to linked skills.

## Interaction Flow

### 1. Timer (Optional)
- **UI**: Routines page -> start/stop timer button per routine
- **API**: Reuses `startTaskTimer` / `stopTaskTimer` (extended to accept ROUTINE type)
- **Result**: `metadata.actualHours` computed from timeEntries

### 2. Check In
- **UI**: Tap check-in button (today's cell in heatmap OR dedicated button in right panel)
- **API**: `checkInRoutine(id)` mutation
- **Backend**:
  1. Idempotent — skip if `checkIns[]` already has today's date
  2. Append `{date: YYYY-MM-DD, hours}` to `checkIns[]`
  3. Update: streak (backward date traversal), bestStreak, thisWeek (from Monday), lastCheckInDate
  4. Compute hours: actualHours (from timer) ?? parseTarget(metadata.target) ?? 0
     - "30 min" → 0.5h, "2h" / "2 hours" → 2h, other strings → 0h
  5. If hours > 0 and routine has SKILLs in parents[], credit hours to each
  6. Clear timeEntries for next session
- **Undo**: `undoCheckInRoutine(id)` mutation — removes today's entry, debits skill hours, recomputes streak
- **Feedback**: Toast "Day 15! Keep going" + hours credited per skill

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `apps/api/src/nodes/propagation.service.ts` | checkInRoutine, undoCheckInRoutine, extend timer to ROUTINE | Done |
| `apps/api/src/nodes/nodes.resolver.ts` | checkInRoutine + undoCheckInRoutine mutations | Done |
| `apps/web/src/lib/graphql.ts` | CHECK_IN_ROUTINE, UNDO_CHECK_IN_ROUTINE mutations | Done |
| `apps/web/src/views/Routines.tsx` | Check-in button (toggle with undo) + timer per routine | Done |
| `apps/web/src/components/CreateNodeModal.tsx` | cadence, target, timeOfDay, group fields for ROUTINE | Done |

## Acceptance Criteria
- [x] Check-in appends to `checkIns: [{date, hours}]`, updates streak, bestStreak, thisWeek, lastCheckInDate
- [x] Timer works on routines (start/stop via startTaskTimer / stopTaskTimer)
- [x] Hours credited to linked skills on check-in
- [x] Toast shows streak count
- [x] Idempotent: checking in twice same day doesn't double-count
- [x] Undo reverses hours from skills and recomputes streak
