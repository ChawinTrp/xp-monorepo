import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import NodeCard from '../components/NodeCard';
import { Icons } from '../components/ui';
import { DAY_PLAN, UPSERT_DAY_PLAN } from '../lib/graphql';
import { buildQueue, isCheckedOn, addDaysStr } from '../lib/queue';
import type { XPNode } from '../lib/types';

interface DayPlanData {
  dayPlan: { _id: string; date: string; orderedIds: string[] } | null;
}

type DragFrom = 'TODO' | 'IN_PROGRESS' | 'plan' | 'tray';

const TOD_GLYPH: Record<string, string> = {
  morning: '☀', afternoon: '◐', evening: '◑', night: '☾',
};

export default function PlanMode({ onOpen }: { onOpen: (id: string) => void }) {
  const { nodes, byId, byType, breadcrumb } = useNodes();
  const tomorrow = useMemo(() => addDaysStr(new Date(), 1), []);

  const { data, loading } = useQuery<DayPlanData>(DAY_PLAN, { variables: { date: tomorrow } });
  const [upsertDayPlan] = useMutation(UPSERT_DAY_PLAN, {
    refetchQueries: [{ query: DAY_PLAN, variables: { date: tomorrow } }],
  });

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [drag, setDrag] = useState<{ id: string; from: DragFrom } | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<'TODO' | 'IN_PROGRESS' | 'TOMORROW' | null>(null);
  const seeded = useRef(false);

  // Seed once on entry: load existing plan, else generate from buildQueue + persist.
  useEffect(() => {
    if (loading || seeded.current) return;
    seeded.current = true;
    const existing = data?.dayPlan?.orderedIds;
    if (existing && existing.length > 0) {
      setOrderedIds(existing);
    } else {
      const seed = buildQueue(nodes, { today: tomorrow }).map((e) => e.node._id);
      setOrderedIds(seed);
      upsertDayPlan({ variables: { input: { date: tomorrow, orderedIds: seed } } });
    }
  }, [loading, data, nodes, tomorrow, upsertDayPlan]);

  const persist = (ids: string[]) => {
    upsertDayPlan({ variables: { input: { date: tomorrow, orderedIds: ids } } });
  };

  const placeInPlan = (id: string, at: number) => {
    setOrderedIds((prev) => {
      const without = prev.filter((x) => x !== id);
      const clamped = Math.max(0, Math.min(at, without.length));
      const next = [...without.slice(0, clamped), id, ...without.slice(clamped)];
      persist(next);
      return next;
    });
  };
  const removeFromPlan = (id: string) => {
    setOrderedIds((prev) => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter((x) => x !== id);
      persist(next);
      return next;
    });
  };

  // Live, ordered plan items (drop completed tasks / deleted ids).
  const planItems = useMemo(
    () =>
      orderedIds
        .map((id) => byId[id])
        .filter((n): n is XPNode => !!n && (n.type !== 'TASK' || n.status !== 'DONE')),
    [orderedIds, byId],
  );
  const planSet = useMemo(() => new Set(planItems.map((n) => n._id)), [planItems]);

  const todoTasks = byType('TASK').filter(
    (t) => (t.status ?? 'TODO') === 'TODO' && !planSet.has(t._id),
  );
  const inProgTasks = byType('TASK').filter(
    (t) => t.status === 'IN_PROGRESS' && !planSet.has(t._id),
  );
  // Routines not yet planned → tray (none are checked-in on a future date).
  const trayRoutines = byType('ROUTINE').filter(
    (r) => !isCheckedOn(r.metadata, tomorrow) && !planSet.has(r._id),
  );

  const onItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientY - r.top > r.height / 2;
    setOverIdx(after ? index + 1 : index);
    setOverCol('TOMORROW');
  };
  const dropOnTomorrow = () => {
    if (drag) placeInPlan(drag.id, overIdx ?? planItems.length);
    setDrag(null); setOverIdx(null); setOverCol(null);
  };
  const dropOnStatusCol = (col: 'TODO' | 'IN_PROGRESS') => {
    // Per spec: dragging a plan item back to a status column removes it from the
    // plan and does NOT change the node's status.
    if (drag && drag.from === 'plan') removeFromPlan(drag.id);
    setDrag(null); setOverIdx(null); setOverCol(null);
    void col;
  };

  const colShell = (isOver: boolean): React.CSSProperties => ({
    background: 'var(--mantle)',
    border: `1px ${isOver ? 'dashed' : 'solid'} ${isOver ? 'var(--accent)' : 'var(--surface1)'}`,
  });

  const renderStatusCol = (
    key: 'TODO' | 'IN_PROGRESS',
    label: string,
    color: string,
    tasks: XPNode[],
  ) => (
    <div
      onDragOver={(e) => { e.preventDefault(); setOverCol(key); }}
      onDragLeave={() => setOverCol((c) => (c === key ? null : c))}
      onDrop={() => dropOnStatusCol(key)}
      className="flex flex-col overflow-hidden rounded-[10px] transition-all duration-200"
      style={colShell(overCol === key)}
    >
      <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: '1px solid var(--surface1)' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="font-semibold uppercase" style={{ fontSize: 13, letterSpacing: 0.5 }}>{label}</span>
        <span className="mono text-ctp-overlay1" style={{ fontSize: 11 }}>{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {tasks.map((t) => (
          <NodeCard
            key={t._id}
            node={t}
            onOpen={onOpen}
            breadcrumb={breadcrumb(t._id).map((c) => c.title).join(' / ')}
            draggable
            dragging={drag?.id === t._id}
            onDragStart={() => setDrag({ id: t._id, from: key })}
            onDragEnd={() => { setDrag(null); setOverIdx(null); setOverCol(null); }}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center text-ctp-overlay0 rounded-lg" style={{
            padding: '32px 12px', fontSize: 12, border: '1px dashed var(--surface1)',
          }}>
            Drag here to remove from tomorrow
          </div>
        )}
      </div>
    </div>
  );

  const RoutineChip = ({ r, from }: { r: XPNode; from: DragFrom }) => {
    const tod = (r.metadata as any)?.timeOfDay as string | undefined;
    return (
      <div
        draggable
        onDragStart={() => setDrag({ id: r._id, from })}
        onDragEnd={() => { setDrag(null); setOverIdx(null); setOverCol(null); }}
        onClick={() => onOpen(r._id)}
        className="flex items-center gap-2 rounded-lg cursor-pointer"
        style={{
          background: 'color-mix(in srgb, var(--teal) 14%, var(--surface0))',
          border: '1px solid color-mix(in srgb, var(--teal) 30%, transparent)',
          padding: '8px 10px', opacity: drag?.id === r._id ? 0.35 : 1,
        }}
      >
        <span style={{ fontSize: 13 }}>{tod ? TOD_GLYPH[tod] ?? '•' : '•'}</span>
        <span className="font-semibold text-sm flex-1 min-w-0 overflow-hidden text-ellipsis" style={{ color: 'var(--text)' }}>
          {r.title}
        </span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--teal)' }}>🔥 {(r.metadata as any)?.streak ?? 0}d</span>
        <Icons.GripVertical size={14} color="var(--overlay0)" />
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(260px, 1fr))', gap: 16 }}>
      {renderStatusCol('TODO', 'To Do', 'var(--overlay2)', todoTasks)}
      {renderStatusCol('IN_PROGRESS', 'In Progress', 'var(--blue)', inProgTasks)}

      {/* Tomorrow column */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (overCol !== 'TOMORROW') setOverCol('TOMORROW'); }}
        onDragLeave={() => setOverCol((c) => (c === 'TOMORROW' ? null : c))}
        onDrop={dropOnTomorrow}
        className="flex flex-col overflow-hidden rounded-[10px] transition-all duration-200"
        style={colShell(overCol === 'TOMORROW')}
      >
        <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: '1px solid var(--surface1)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="font-semibold uppercase" style={{ fontSize: 13, letterSpacing: 0.5 }}>Tomorrow</span>
          <span className="mono text-ctp-overlay1" style={{ fontSize: 11 }}>{planItems.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
          {planItems.map((n, i) => (
            <div key={n._id} onDragOver={(e) => onItemDragOver(e, i)}>
              {overCol === 'TOMORROW' && overIdx === i && (
                <div style={{ height: 2, background: 'var(--accent)', borderRadius: 2, marginBottom: 6 }} />
              )}
              {n.type === 'ROUTINE' ? (
                <RoutineChip r={n} from="plan" />
              ) : (
                <NodeCard
                  node={n}
                  onOpen={onOpen}
                  breadcrumb={breadcrumb(n._id).map((c) => c.title).join(' / ')}
                  draggable
                  dragging={drag?.id === n._id}
                  onDragStart={() => setDrag({ id: n._id, from: 'plan' })}
                  onDragEnd={() => { setDrag(null); setOverIdx(null); setOverCol(null); }}
                />
              )}
            </div>
          ))}
          {overCol === 'TOMORROW' && overIdx === planItems.length && (
            <div style={{ height: 2, background: 'var(--accent)', borderRadius: 2 }} />
          )}
          {planItems.length === 0 && (
            <div className="text-center text-ctp-overlay0 rounded-lg" style={{
              padding: '32px 12px', fontSize: 12, border: '1px dashed var(--surface1)',
            }}>
              Drag tasks &amp; routines here to plan tomorrow
            </div>
          )}
        </div>

        {/* Not-planned routine tray */}
        {trayRoutines.length > 0 && (
          <div style={{ borderTop: '1px solid var(--surface1)', padding: 12 }}>
            <div className="uppercase font-semibold" style={{ fontSize: 10, letterSpacing: 1, color: 'var(--subtext1)', marginBottom: 8 }}>
              Not planned
            </div>
            <div className="flex flex-col gap-2">
              {trayRoutines.map((r) => <RoutineChip key={r._id} r={r} from="tray" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
