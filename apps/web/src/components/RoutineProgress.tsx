import { useMutation } from '@apollo/client/react';
import { routineGoal, progressOn, progressLabel, logicalDateStr } from '@xp/shared';
import { GET_NODES, SET_ROUTINE_PROGRESS } from '../lib/graphql';
import { useToast } from './ui';
import type { XPNode } from '../lib/types';

// Partial credit on a scored routine: tick steps, or add hours toward the goal.
// Renders nothing for plain done / not-done routines.
// `onCard` = the coloured phone card (white ink) instead of a normal surface.
export function RoutineProgress({ node, onCard = false, onGoalMet }: {
  node: XPNode;
  onCard?: boolean;
  onGoalMet?: () => void;
}) {
  const { toast } = useToast();
  const [save, { loading }] = useMutation(SET_ROUTINE_PROGRESS, { refetchQueries: [{ query: GET_NODES }] });
  const today = logicalDateStr();
  const goal = routineGoal(node.metadata);
  if (!goal) return null;

  const entry = progressOn(node.metadata, today);

  const put = async (vars: { steps?: string[]; hours?: number }, meetsGoal: boolean) => {
    try {
      await save({ variables: { id: node._id, ...vars } });
      if (meetsGoal && (entry?.score ?? 0) < 1) onGoalMet?.();
    } catch (err: any) {
      toast({ message: 'Could not save progress', variant: 'error', details: err.message });
    }
  };

  const ink = onCard ? '#FFFFFF' : 'var(--text)';
  const chip = (on: boolean): React.CSSProperties => ({
    padding: onCard ? '8px 12px' : '5px 10px',
    minHeight: onCard ? 36 : 28,
    fontSize: onCard ? 13 : 12,
    fontWeight: 600,
    fontFamily: 'inherit',
    borderRadius: 999,
    cursor: loading ? 'wait' : 'pointer',
    opacity: loading ? 0.6 : 1,
    color: onCard ? (on ? 'var(--c-routine)' : '#FFFFFF') : on ? 'var(--green)' : 'var(--subtext0)',
    background: onCard
      ? on ? '#FFFFFF' : 'rgba(255,255,255,0.18)'
      : on ? 'color-mix(in srgb, var(--green) 14%, transparent)' : 'var(--surface1)',
    border: onCard ? '1px solid rgba(255,255,255,0.4)' : '1px solid var(--border)',
  });

  let controls;
  if (goal.kind === 'steps') {
    const ticked = entry?.steps ?? [];
    const notes = ((node.metadata as any)?.stepNotes ?? {}) as Record<string, string>;
    // With descriptions the steps become full-width rows; without, compact chips.
    const asRows = goal.steps.some((n) => notes[n]);
    controls = goal.steps.map((step) => {
      const on = ticked.includes(step);
      const next = on ? ticked.filter((t) => t !== step) : [...ticked, step];
      return (
        // One save at a time: each sends the full list, so a second tap must see the first.
        <button key={step} type="button" aria-pressed={on} disabled={loading}
          className={asRows ? 'w-full text-left' : undefined}
          style={asRows ? { ...chip(on), borderRadius: 10, padding: '6px 12px' } : chip(on)}
          onClick={() => put({ steps: next }, next.length >= goal.goal)}>
          {on ? '✓ ' : ''}{step}
          {notes[step] && (
            <span style={{ display: 'block', fontSize: 11, fontWeight: 400, lineHeight: 1.3, opacity: 0.85 }}>{notes[step]}</span>
          )}
        </button>
      );
    });
  } else {
    const hours = entry?.hours ?? 0;
    const by = goal.goal > 1 ? 0.5 : 0.25;
    const set = (h: number) => put({ hours: h }, h >= goal.goal);
    const label = by === 0.5 ? '30 min' : '15 min';
    controls = (
      <>
        <button type="button" disabled={loading || hours <= 0} style={chip(false)} aria-label={`Remove ${label}`}
          onClick={() => set(Math.max(0, hours - by))}>−</button>
        <button type="button" disabled={loading || hours + by > 24} style={chip(false)} aria-label={`Add ${label}`}
          onClick={() => set(Math.min(24, hours + by))}>+ {label}</button>
      </>
    );
  }

  return (
    // Stop pointer events here so the phone card doesn't start a swipe (it captures the pointer).
    <div className="flex items-center gap-1.5 flex-wrap" onPointerDown={(e) => e.stopPropagation()}
      style={onCard ? { marginTop: 12, maxHeight: '34vh', overflowY: 'auto', touchAction: 'pan-y' } : undefined}>
      <span className="mono font-semibold" style={{ fontSize: onCard ? 15 : 12, color: ink, marginRight: 4 }}>
        {progressLabel(node.metadata, today)}
      </span>
      {controls}
    </div>
  );
}
