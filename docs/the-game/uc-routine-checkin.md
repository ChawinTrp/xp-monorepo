# UC: Routine Check-In

## User Story
As a user, I check in my daily routine, optionally using a timer for actual time tracking. Hours are credited to linked skills.

## Interaction Flow

### 1. Timer (Optional)
- **UI**: Routines page -> start/stop timer button per routine
- **API**: Reuses `startTaskTimer` / `stopTaskTimer` (extended to accept ROUTINE type)
- **Result**: `metadata.actualHours` computed from timeEntries

### 2. Check In
- **UI**: Tap check-in button (today's cell in heatmap OR dedicated button)
- **API**: `checkInRoutine(id)` mutation
- **Backend**:
  1. Set `history[last] = true`, streak++, bestStreak = max, thisWeek++
  2. Compute hours: actualHours (timer) ?? parseTarget(metadata.target) ?? 0
     - "30 min" -> 0.5h, "2 hours" -> 2h, "10 min" -> ~0.17h, "1x/week" -> 0h
  3. If hours > 0 and routine has SKILLs in parents[], credit hours to each
  4. Clear actualHours/timeEntries for next session
- **Feedback**: Toast "Day 15! Keep going" + hours credited per skill

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `apps/api/src/nodes/propagation.service.ts` | checkInRoutine method, extend timer to ROUTINE | Done |
| `apps/api/src/nodes/nodes.resolver.ts` | checkInRoutine mutation | Done |
| `apps/web/src/lib/graphql.ts` | CHECK_IN_ROUTINE mutation | Done |
| `apps/web/src/views/Routines.tsx` | Check-in button + timer per routine | Done |

## Acceptance Criteria
- [ ] Check-in updates streak, bestStreak, thisWeek, history
- [ ] Timer works on routines (start/stop)
- [ ] Hours credited to linked skills on check-in
- [ ] Toast shows streak count
- [ ] Idempotent: checking in twice same day doesn't double-count
