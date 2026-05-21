# UC: Skill Linking

## User Story
As a user, I link skills to tasks and routines so that completing work credits hours toward mastery.

## Interaction Flow

### 1. Link Skills in Node Detail
- **UI**: Open task/routine detail -> "Skills" section -> "Link skill" button
- **SkillPicker**: Search popover, searchable by skill name OR parent domain name
- **API**: `updateNode(id, { parents: [...existingParents, ...newSkillIds] })`
- **Result**: Skill chips shown with tier badge, removable

### 2. Link Skills in Create Task Modal
- **UI**: Create task form -> Skills field -> same SkillPicker component
- **API**: `createNode` with `parents: [projectId, ...skillIds]`
- **Result**: Task created with skills pre-linked

### 3. View Linked Skills
- **UI**: NodeDetail Properties section shows skill chips (filtered from parents[] by type=SKILL)
- **Each chip**: Skill name + tier badge (LevelBadge component)

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `apps/web/src/views/NodeDetail.tsx` | SkillPicker UI, parents in handleSave | Done |
| `apps/web/src/components/CreateTaskModal.tsx` | SkillPicker in create form | TODO |

## Acceptance Criteria
- [ ] Can search skills by name
- [ ] Can search skills by domain name (parent)
- [ ] Multi-select skills
- [ ] Linked skills show as chips with tier badge
- [ ] Can remove linked skills
- [ ] handleSave includes parents[] in updateNode mutation
- [ ] SkillPicker reusable in both NodeDetail and CreateTaskModal
