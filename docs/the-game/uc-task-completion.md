# UC: Task Completion Flow

## User Story
As a user, I create a task, track time with a timer, complete it, and see hours credited to linked skills with tier progression feedback.

## Interaction Flow

### 1. Create Task
- **UI**: Tap "+" -> CreateTaskModal
- **Fields**: title, project, estimatedHours, priority, due, skills, description
- **API**: `createNode` mutation with `mainParent: projectId`, `parents: [projectId, ...skillIds]`
- **Feedback**: Toast "Task created"

### 2. Work - Timer
- **UI**: Open task detail -> "Start timer" button
- **API**: `startTaskTimer(id)` -> pushes `{ start: ISO }` to `metadata.timeEntries`
- **UI**: Live counter ticks every second
- **API**: `stopTaskTimer(id)` -> closes entry, recalculates `metadata.actualHours`
- **Feedback**: Toast "Timer started" / "Stopped - 2h 15m tracked"

### 3. Complete - The Payoff
- **UI**: "Complete task" button OR drag to DONE column in Kanban
- **API**: `completeTask(id)` mutation
- **Backend**:
  1. Set status=DONE, progress=100, creditedHours = actualHours ?? estimatedHours
  2. Walk mainParent: recalc PROJECT progress -> DOMAIN progress
  3. Scan parents[]: find SKILLs, call addHoursToSkill() for each
  4. Walk each skill's ancestors to recalc domain progress
  5. Return all affected nodes
- **Feedback**: Toast per skill "+4h Backend Dev - 180h to Master"

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `apps/api/src/nodes/propagation.service.ts` | Add parents[] skill scan | Done |
| `apps/web/src/components/ui/index.tsx` | Toast system | Done |
| `apps/web/src/App.tsx` | ToastProvider wrapper | Done |
| `apps/web/src/views/NodeDetail.tsx` | Complete button + timer + toasts + skill-linking | Done |
| `apps/web/src/views/Kanban.tsx` | Drag-to-complete + toasts | Done |
| `apps/web/src/components/CreateTaskModal.tsx` | NEW - create form | TODO |
| `apps/web/src/lib/graphql.ts` | COMPLETE_TASK, START/STOP_TIMER | Done |

## Acceptance Criteria
- [ ] Completing a task credits hours to all linked skills
- [ ] Skill tier recalculates after hours added
- [ ] Project progress recalculates (done/total children)
- [ ] Domain progress recalculates
- [ ] Toast shows hours credited per skill
- [ ] Timer tracks actual hours with start/stop
- [ ] Create-task form works with skill picker
