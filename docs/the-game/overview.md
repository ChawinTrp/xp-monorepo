# The Game - Overview

## What It Is
Hours-based mastery progression. Complete tasks and routines to accumulate hours toward skill mastery.

## Mastery Tiers

| Tier | Hours | Meaning |
|------|-------|---------|
| Unfamiliar | 0 - 19 | Haven't meaningfully engaged |
| Familiar | 20 - 299 | Competency threshold |
| Skilled | 300 - 999 | Solid practitioner |
| Master | 1,000 - 9,999 | Professional-grade expertise |
| World Class | 10,000+ | Elite mastery |

## How Hours Flow

```
TASK completes
  -> creditedHours = actualHours ?? estimatedHours ?? 0
  -> mainParent walk: PROJECT progress recalc -> DOMAIN progress recalc
  -> parents[] scan: each SKILL gets +creditedHours -> tier recalc -> domain recalc

ROUTINE checks in
  -> creditedHours = actualHours (timer) ?? parseTarget(metadata.target) ?? 0
  -> parents[] scan: each SKILL gets +creditedHours
```

## Key Design Decisions
- Skills live in `parents[]`, NOT `mainParent` (a task can credit multiple skills)
- `mainParent` is for hierarchy (TASK -> PROJECT -> DOMAIN)
- `parents[]` is for cross-links (skills, tags, persons)
- Timer works on both TASKs and ROUTINEs
- Routines can link to skills just like tasks
