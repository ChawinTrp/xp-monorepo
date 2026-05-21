# UC: Domain Progress

## User Story
As a user, I view aggregate progress for a domain, seeing child projects' completion and child skills' mastery hours.

## Interaction Flow

### 1. Domain Detail View
- **UI**: Open domain node detail -> shows aggregate stats
- **Display**:
  - Total hours across all child skills
  - Child skills list with tier badge + hours + progress bar
  - Child projects list with completion percentage
  - Aggregate progress bar

### 2. Dashboard Stats
- **UI**: Dashboard stat cards show real computed values (not hardcoded)
- **Data**: Computed from nodes data in Apollo cache
  - Active streak (from routines)
  - Total hours this week
  - Skills in progress

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `apps/web/src/views/NodeDetail.tsx` | Domain progress display for type=DOMAIN | Done |
| `apps/web/src/views/Dashboard.tsx` | Real computed stats from nodes data | Done |

## Acceptance Criteria
- [ ] Domain detail shows aggregate progress bar
- [ ] Child skills listed with tier, hours, progress
- [ ] Child projects listed with completion %
- [ ] Total hours computed across child skills
- [ ] Dashboard shows real streak count (from routines)
- [ ] Dashboard shows real total hours (from skills)
- [ ] All data computed from existing Apollo cache (no backend change)
