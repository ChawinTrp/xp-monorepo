import { useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { useDayQueue, type DayQueueItem } from '../lib/dayQueue';
import { TypeIcon, RingGauge, Icons, useToast } from '../components/ui';
import { logicalDateStr } from '../lib/queue';
import {
  COMPLETE_TASK, CHECK_IN_ROUTINE, REOPEN_TASK, UNDO_CHECK_IN_ROUTINE,
  UPDATE_NODE, GET_NODES,
} from '../lib/graphql';
import type { XPNode } from '../lib/types';
import { parseLocalDate } from '@xp/shared';

interface TodayProps {
  onOpen: (id: string) => void;
}

export default function Today({ onOpen }: TodayProps) {
  const { breadcrumb } = useNodes();
  const { items, summary, ready } = useDayQueue();
  const { toast } = useToast();

  const refetch = { refetchQueries: [{ query: GET_NODES }] };
  const [completeTask] = useMutation(COMPLETE_TASK, refetch);
  const [checkInRoutine] = useMutation(CHECK_IN_ROUTINE, refetch);
  const [reopenTask] = useMutation(REOPEN_TASK, refetch);
  const [undoCheckIn] = useMutation(UNDO_CHECK_IN_ROUTINE, refetch);
  const [updateNode] = useMutation(UPDATE_NODE, refetch);

  const today = logicalDateStr();

  const markDone = async (node: XPNode) => {
    try {
      if (node.type === 'ROUTINE') await checkInRoutine({ variables: { id: node._id } });
      else await completeTask({ variables: { id: node._id, completedDate: today } });
    } catch (err: any) {
      toast({ message: 'Could not complete', variant: 'error', details: err.message });
    }
  };

  const skip = async (node: XPNode) => {
    const prev: string[] = Array.isArray((node.metadata as any)?.skips) ? (node.metadata as any).skips : [];
    if (prev.some((d) => d.slice(0, 10) === today)) return;
    try {
      await updateNode({ variables: { input: { _id: node._id, metadata: { ...(node.metadata as any), skips: [...prev, today] } } } });
    } catch (err: any) {
      toast({ message: 'Could not skip', variant: 'error', details: err.message });
    }
  };

  const undo = async (item: DayQueueItem) => {
    const { node, status } = item;
    try {
      if (status === 'done') {
        if (node.type === 'ROUTINE') await undoCheckIn({ variables: { id: node._id } });
        else await reopenTask({ variables: { id: node._id } });
      } else if (status === 'skipped') {
        const prev: string[] = Array.isArray((node.metadata as any)?.skips) ? (node.metadata as any).skips : [];
        await updateNode({ variables: { input: { _id: node._id, metadata: { ...(node.metadata as any), skips: prev.filter((d) => d.slice(0, 10) !== today) } } } });
      }
    } catch (err: any) {
      toast({ message: 'Could not undo', variant: 'error', details: err.message });
    }
  };

  const dateLabel = parseLocalDate(today).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const pct = summary.total ? Math.round((summary.resolved / summary.total) * 100) : 0;

  return (
    <div className="fade-in" style={{ padding: 'clamp(16px, 3vw, 32px)', maxWidth: 880, margin: '0 auto' }}>
      {/* header */}
      <div className="flex items-center justify-between mb-7 gap-4 flex-wrap">
        <div>
          <h1 className="font-bold m-0" style={{ fontSize: 'clamp(20px, 4vw, 28px)', letterSpacing: -0.4 }}>Today</h1>
          <div className="mono text-ctp-subtext1 mt-1.5" style={{ fontSize: 12 }}>{dateLabel}</div>
        </div>
        <div className="flex items-center gap-3.5 rounded-xl" style={{ padding: '12px 18px', background: 'var(--surface0)', border: '1px solid var(--surface1)' }}>
          <RingGauge pct={pct} color="var(--accent)" size={56} stroke={5} />
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-bold" style={{ fontSize: 28, letterSpacing: -0.5 }}>{summary.resolved}</span>
              <span className="text-ctp-overlay1 font-semibold" style={{ fontSize: 18 }}>/ {summary.total}</span>
            </div>
            <div className="text-ctp-subtext1" style={{ fontSize: 11 }}>
              {summary.done} done · {summary.skipped} skipped · {summary.pending} left
            </div>
          </div>
        </div>
      </div>

      {/* list */}
      {!ready ? (
        <EmptyState glyph="✦" text="Loading your plan…" />
      ) : items.length === 0 ? (
        <EmptyState glyph="✦" text="Nothing planned today." sub="Add a task or routine, or plan ahead in Plan mode." />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <TodayRow
              key={item.node._id}
              item={item}
              crumb={breadcrumb(item.node._id).map((n) => n.title).join(' › ')}
              onOpen={onOpen}
              onDone={() => markDone(item.node)}
              onSkip={() => skip(item.node)}
              onUndo={() => undo(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TodayRow({ item, crumb, onOpen, onDone, onSkip, onUndo }: {
  item: DayQueueItem;
  crumb: string;
  onOpen: (id: string) => void;
  onDone: () => void;
  onSkip: () => void;
  onUndo: () => void;
}) {
  const { node, status } = item;
  const resolved = status !== 'pending';
  const color = node.type === 'ROUTINE' ? 'var(--c-routine)' : 'var(--c-task)';

  return (
    <div
      className="flex items-center gap-3 rounded-xl"
      style={{
        padding: '12px 14px',
        background: 'var(--surface0)',
        border: '1px solid var(--surface1)',
        opacity: resolved ? 0.6 : 1,
      }}
    >
      <span
        className="grid place-items-center rounded-lg shrink-0"
        style={{ width: 30, height: 30, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        <TypeIcon type={node.type} size={15} color={color} />
      </span>

      <div className="min-w-0 flex-1">
        <button
          onClick={() => onOpen(node._id)}
          className="bg-transparent border-none cursor-pointer p-0 text-left truncate block w-full hover:underline"
          style={{
            fontSize: 14, fontWeight: 500, color: 'var(--text)',
            textDecoration: status === 'done' ? 'line-through' : undefined,
          }}
        >
          {node.title}
        </button>
        {crumb && <div className="truncate text-ctp-subtext1" style={{ fontSize: 11 }}>{crumb}</div>}
      </div>

      <StatusPill status={status} />

      <div className="flex items-center gap-1.5 shrink-0">
        {status === 'pending' ? (
          <>
            <RowBtn label="Done" tone="done" onClick={onDone}
              icon={<Icons.CheckCircle size={14} />} />
            <RowBtn label="Skip" tone="muted" onClick={onSkip}
              icon={<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>} />
          </>
        ) : (
          <RowBtn label="Undo" tone="muted" onClick={onUndo}
            icon={<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>} />
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: DayQueueItem['status'] }) {
  const cfg = {
    done: { label: 'Done', color: 'var(--green)' },
    skipped: { label: 'Skipped', color: 'var(--overlay1)' },
    pending: { label: 'To do', color: 'var(--accent)' },
  }[status];
  return (
    <span
      className="rounded font-semibold uppercase shrink-0"
      style={{
        padding: '3px 8px', fontSize: 10, letterSpacing: 0.6,
        background: `color-mix(in srgb, ${cfg.color} 14%, transparent)`,
        color: cfg.color,
      }}
    >
      {cfg.label}
    </span>
  );
}

function RowBtn({ label, tone, onClick, icon }: {
  label: string; tone: 'done' | 'muted'; onClick: () => void; icon: React.ReactNode;
}) {
  const color = tone === 'done' ? 'var(--green)' : 'var(--subtext0)';
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg cursor-pointer"
      style={{
        padding: '6px 11px', fontSize: 12, fontWeight: 600,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color, border: 'none',
      }}
    >
      {icon}{label}
    </button>
  );
}

function EmptyState({ glyph, text, sub }: { glyph: string; text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: '64px 16px' }}>
      <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.7 }}>{glyph}</div>
      <p style={{ color: 'var(--subtext1)', fontSize: 15, margin: 0 }}>{text}</p>
      {sub && <p className="text-ctp-overlay1" style={{ fontSize: 12, marginTop: 6 }}>{sub}</p>}
    </div>
  );
}
