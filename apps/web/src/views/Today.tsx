import { useEffect, useState, type ReactNode } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { useDayQueue, type DayQueueItem } from '../lib/dayQueue';
import { TypeIcon, Icons, useToast } from '../components/ui';
import { logicalDateStr, addDays, getPersonCatchup } from '../lib/queue';
import { API_BASE, authHeaders } from '../lib/api';
import {
  COMPLETE_TASK, CHECK_IN_ROUTINE, REOPEN_TASK, UNDO_CHECK_IN_ROUTINE,
  UPDATE_NODE, GET_NODES,
} from '../lib/graphql';
import type { XPNode } from '../lib/types';
import { parseLocalDate } from '@xp/shared';

// PC Today: the whole day on one screen, opened first thing (CT, 2026-11-22).
// Order: Now → Today's 3 → Routines | Calendar → Reminders.
// Not here yet: yesterday's numbers + "from last night" — they need the daily-numbers table.

interface Block {
  label: string;
  start: number; // minutes after midnight
  end: number;
  tod: string[]; // routine timeOfDay values that belong to this block
  tasks: boolean; // tasks are worked in this block
}

const hm = (h: number, m = 0) => h * 60 + m;
// The day's blocks (approved sketch). Edit here to change the day's shape.
const BLOCKS: Block[] = [
  { label: 'Morning', start: hm(7), end: hm(9), tod: ['morning'], tasks: false },
  { label: 'Deep work', start: hm(9, 30), end: hm(12, 30), tod: [], tasks: true },
  { label: 'Lunch + reset', start: hm(12, 30), end: hm(14), tod: ['afternoon'], tasks: false },
  { label: 'Afternoon', start: hm(14), end: hm(18), tod: ['afternoon'], tasks: true },
  { label: 'Evening', start: hm(19), end: hm(22), tod: ['evening'], tasks: true },
  { label: 'Shutdown', start: hm(22, 45), end: hm(24), tod: ['night'], tasks: false },
];

const fmt = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const range = (b: Block) => (b === BLOCKS[BLOCKS.length - 1] ? fmt(b.start) : `${fmt(b.start)}–${fmt(b.end)}`);

/** Block in progress, or the next one if between blocks. Before 05:00 still counts as Shutdown (logical day). */
export function blockAt(min: number): { index: number; upcoming: boolean } {
  if (min < hm(5)) return { index: BLOCKS.length - 1, upcoming: false };
  const i = BLOCKS.findIndex((b) => min >= b.start && min < b.end);
  if (i >= 0) return { index: i, upcoming: false };
  const next = BLOCKS.findIndex((b) => b.start > min);
  return next >= 0 ? { index: next, upcoming: true } : { index: BLOCKS.length - 1, upcoming: false };
}

function useNowMinutes() {
  const read = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const [min, setMin] = useState(read);
  useEffect(() => {
    const t = setInterval(() => setMin(read()), 60_000);
    return () => clearInterval(t);
  }, []);
  return min;
}

interface CalEvent { title: string; start: string | null; end: string | null; allDay: boolean }

function useDayEvents(date: string) {
  const [state, setState] = useState<{ connected: boolean; events: CalEvent[]; error?: boolean } | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/gcal/events?date=${date}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setState)
      .catch(() => setState({ connected: false, events: [], error: true }));
  }, [date]);
  return state;
}

interface TodayProps {
  onOpen: (id: string) => void;
}

export default function Today({ onOpen }: TodayProps) {
  const { breadcrumb, nodes } = useNodes();
  const { items, summary, ready } = useDayQueue();
  const { toast } = useToast();
  const now = useNowMinutes();
  const today = logicalDateStr();
  const events = useDayEvents(today);

  const refetch = { refetchQueries: [{ query: GET_NODES }] };
  const [completeTask] = useMutation(COMPLETE_TASK, refetch);
  const [checkInRoutine] = useMutation(CHECK_IN_ROUTINE, refetch);
  const [reopenTask] = useMutation(REOPEN_TASK, refetch);
  const [undoCheckIn] = useMutation(UNDO_CHECK_IN_ROUTINE, refetch);
  const [updateNode] = useMutation(UPDATE_NODE, refetch);

  const skipsOf = (node: XPNode): string[] =>
    Array.isArray((node.metadata as any)?.skips) ? (node.metadata as any).skips : [];

  const markDone = async (node: XPNode) => {
    try {
      if (node.type === 'ROUTINE') await checkInRoutine({ variables: { id: node._id } });
      else await completeTask({ variables: { id: node._id, completedDate: today } });
    } catch (err: any) {
      toast({ message: 'Could not complete', variant: 'error', details: err.message });
    }
  };

  const skip = async (node: XPNode) => {
    const prev = skipsOf(node);
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
        await updateNode({ variables: { input: { _id: node._id, metadata: { ...(node.metadata as any), skips: skipsOf(node).filter((d) => d.slice(0, 10) !== today) } } } });
      }
    } catch (err: any) {
      toast({ message: 'Could not undo', variant: 'error', details: err.message });
    }
  };

  const row = (item: DayQueueItem) => (
    <TodayRow
      key={item.node._id}
      item={item}
      crumb={breadcrumb(item.node._id).map((n) => n.title).join(' › ')}
      onOpen={onOpen}
      onDone={() => markDone(item.node)}
      onSkip={() => skip(item.node)}
      onUndo={() => undo(item)}
    />
  );

  const tasks = items.filter((i) => i.node.type === 'TASK');
  const routines = items.filter((i) => i.node.type === 'ROUTINE');
  const top3 = tasks.filter((i) => i.status === 'pending').slice(0, 3);
  const top3Ids = new Set(top3.map((i) => i.node._id));
  const otherTasks = tasks.filter((i) => !top3Ids.has(i.node._id));

  // Now: the current block's menu — pending items that belong to it, plan order, first = default.
  const { index: nowIdx, upcoming } = blockAt(now);
  const block = BLOCKS[nowIdx];
  const pending = items.filter((i) => i.status === 'pending');
  const fits = (i: DayQueueItem) =>
    i.node.type === 'ROUTINE'
      ? block.tod.includes((i.node.metadata as any)?.timeOfDay)
      : block.tasks;
  const menu = (pending.filter(fits).length ? pending.filter(fits) : pending).slice(0, 3);

  // Reminders: catch-ups due or overdue, tasks due in the next 3 days.
  const soon = addDays(today, 3);
  const catchups = nodes
    .filter((n) => n.type === 'PERSON')
    .map((p) => ({ p, c: getPersonCatchup(p, today) }))
    .filter(({ c }) => c.catchupState === 'overdue' || c.relativeDate === 'today');
  const dueSoon = nodes
    .filter((n) => n.type === 'TASK' && n.status !== 'DONE')
    .map((n) => ({ n, due: String((n.metadata as any)?.due ?? '').slice(0, 10) }))
    .filter(({ due }) => due > today && due <= soon)
    .sort((a, b) => a.due.localeCompare(b.due));

  const dateLabel = parseLocalDate(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="fade-in" style={{ padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1180, margin: '0 auto' }}>
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-bold m-0" style={{ fontSize: 'clamp(20px, 4vw, 28px)', letterSpacing: -0.4 }}>{dateLabel}</h1>
          <div className="mono text-ctp-subtext1 mt-1.5" style={{ fontSize: 12 }}>
            {fmt(now)} · {summary.done} done · {summary.skipped} skipped · {summary.pending} left
          </div>
        </div>
      </div>

      {!ready ? (
        <EmptyState glyph="✦" text="Loading your day…" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-6 min-w-0">
            <Section title={upcoming ? `Next · ${block.label} at ${fmt(block.start)}` : `Now · ${block.label}`}>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {BLOCKS.map((b, i) => (
                  <span key={b.label} className="rounded-md"
                    style={{
                      padding: '5px 9px', fontSize: 11,
                      background: i === nowIdx ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'var(--surface1)',
                      color: i === nowIdx ? 'var(--accent)' : 'var(--subtext1)',
                      fontWeight: i === nowIdx ? 700 : 500,
                      opacity: i < nowIdx ? 0.55 : 1,
                    }}>
                    {b.label} <span className="mono">{range(b)}</span>
                  </span>
                ))}
              </div>
              {block.label === 'Shutdown' && !upcoming && (
                <p style={{ fontSize: 13, margin: '0 0 10px', color: 'var(--text)' }}>
                  Work is over for today. What's left moves to tomorrow.
                </p>
              )}
              {menu.length ? (
                <div className="flex flex-col gap-2">{menu.map(row)}</div>
              ) : (
                <Muted>Nothing left on today's plan.</Muted>
              )}
            </Section>

            <Section title="Today's 3">
              {top3.length ? <div className="flex flex-col gap-2">{top3.map(row)}</div> : <Muted>No open tasks today.</Muted>}
              {otherTasks.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-ctp-subtext1" style={{ fontSize: 12 }}>
                    {otherTasks.length} more task{otherTasks.length === 1 ? '' : 's'} (done, skipped or after the 3)
                  </summary>
                  <div className="flex flex-col gap-2 mt-2">{otherTasks.map(row)}</div>
                </details>
              )}
            </Section>

            <Section title="Routines today">
              {routines.length ? <div className="flex flex-col gap-2">{routines.map(row)}</div> : <Muted>No routines planned.</Muted>}
            </Section>
          </div>

          <div className="flex flex-col gap-6 min-w-0">
            <Section title="Calendar">
              {!events ? (
                <Muted>Loading…</Muted>
              ) : events.error ? (
                <Muted>Couldn't read the calendar.</Muted>
              ) : !events.connected ? (
                <Muted>Google Calendar isn't connected. Settings → Connect.</Muted>
              ) : events.events.length === 0 ? (
                <Muted>No events today.</Muted>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {events.events.map((e, i) => (
                    <div key={i} className="flex gap-3 items-baseline rounded-lg" style={{ padding: '8px 12px', background: 'var(--surface0)', border: '1px solid var(--border)' }}>
                      <span className="mono text-ctp-subtext1 shrink-0" style={{ fontSize: 12, width: 44 }}>
                        {e.allDay || !e.start ? 'all day' : new Date(e.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="truncate" style={{ fontSize: 13 }}>{e.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Reminders">
              {catchups.length + dueSoon.length === 0 ? (
                <Muted>Nothing coming up in the next 3 days.</Muted>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {catchups.map(({ p, c }) => (
                    <Reminder key={p._id} type="PERSON" onClick={() => onOpen(p._id)}
                      text={`Catch up: ${p.title}`} meta={c.catchupState === 'overdue' ? `due ${c.relativeDate}` : 'today'}
                      urgent={c.catchupState === 'overdue'} />
                  ))}
                  {dueSoon.map(({ n, due }) => (
                    <Reminder key={n._id} type="TASK" onClick={() => onOpen(n._id)} text={n.title}
                      meta={`due ${parseLocalDate(due).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}`} />
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl" style={{ padding: 16, background: 'var(--surface0)', border: '1px solid var(--border)' }}>
      <h2 className="m-0 mb-3 font-semibold" style={{ fontSize: 15 }}>{title}</h2>
      {children}
    </section>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-ctp-subtext1 m-0" style={{ fontSize: 13 }}>{children}</p>;
}

function Reminder({ type, text, meta, urgent, onClick }: { type: string; text: string; meta: string; urgent?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg text-left cursor-pointer w-full"
      style={{ padding: '8px 12px', background: 'var(--surface0)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}>
      <TypeIcon type={type} size={14} />
      <span className="truncate flex-1" style={{ fontSize: 13 }}>{text}</span>
      <span className="mono shrink-0" style={{ fontSize: 11, color: urgent ? 'var(--red)' : 'var(--subtext1)' }}>{meta}</span>
    </button>
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
