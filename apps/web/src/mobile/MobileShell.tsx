import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { Icons } from '../components/ui';
import {
  COMPLETE_TASK, CHECK_IN_ROUTINE, START_TIMER, STOP_TIMER, GET_NODES,
  UPDATE_NODE, REOPEN_TASK,
} from '../lib/graphql';
import type { XPNode } from '../lib/types';
import CreateNodeModal from '../components/CreateNodeModal';

// ── Date helpers (mirrors Routines.tsx)
function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const TODAY = localDateStr();
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}

type CheckIn = { date: string; hours: number };
function checkInsOf(meta: any): CheckIn[] {
  if (Array.isArray(meta?.checkIns)) return meta.checkIns;
  if (Array.isArray(meta?.checkInDates)) return (meta.checkInDates as string[]).map(d => ({ date: d, hours: 0 }));
  return [];
}
function isCheckedToday(meta: any) { return checkInsOf(meta).some(c => c.date === TODAY); }
function isOverdue(node: XPNode) {
  const m = node.metadata as any;
  return m?.due && new Date(m.due) < new Date();
}

// ── Timer helpers
const pad = (n: number) => String(n).padStart(2, '0');
const fmtElapsed = (s: number) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

// ── Time-of-day config
const TOD_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2, night: 3 };
const TOD_GLYPH: Record<string, string> = { morning: '☀', afternoon: '◐', evening: '◑', night: '☾' };
const TOD_LABEL: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };

// ── Card gradient by type
const ROUTINE_BG = 'linear-gradient(160deg, #2bb3a0 0%, #4f86d6 100%)';
const TASK_BG    = 'linear-gradient(160deg, #f59f5d 0%, #e87a52 100%)';
const ROUTINE_SHADOW = 'rgba(43,179,160,0.35)';
const TASK_SHADOW    = 'rgba(245,159,93,0.35)';

const PRIORITY_COLOR: Record<string, string> = {
  high: '#f38ba8', medium: '#f9e2af', low: '#a6e3a1',
};

// ── A task counts for "today" when it has a due date that is today or earlier.
//    Date-string compare avoids the UTC drift of `new Date(due) < new Date()`.
function isDueToday(node: XPNode): boolean {
  const due = (node.metadata as any)?.due as string | undefined;
  if (!due) return false;
  // due may be 'YYYY-MM-DD' or an ISO timestamp; compare on the date portion.
  return due.slice(0, 10) <= TODAY;
}

// ── Pure queue builder: which cards show today and in what order.
//    Exported for isolated reasoning/inspection.
export function buildQueue(nodes: XPNode[], snoozedToBack: string[] = []): XPNode[] {
  const routines = nodes
    .filter(n => n.type === 'ROUTINE' && !isCheckedToday(n.metadata))
    .sort((a, b) => {
      const todA = (a.metadata as any)?.timeOfDay ?? 'anytime';
      const todB = (b.metadata as any)?.timeOfDay ?? 'anytime';
      const da = (TOD_ORDER[todA] ?? 99) - (TOD_ORDER[todB] ?? 99);
      return da !== 0 ? da : ((b.metadata as any)?.streak ?? 0) - ((a.metadata as any)?.streak ?? 0);
    });

  // Membership is due-date driven; priority only affects order.
  const tasks = nodes.filter(n => n.type === 'TASK' && n.status !== 'DONE' && isDueToday(n));
  const prio: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const byPriority = (a: XPNode, b: XPNode) =>
    (prio[(a.metadata as any)?.priority] ?? 9) - (prio[(b.metadata as any)?.priority] ?? 9);

  const morningR   = routines.filter(r => (r.metadata as any)?.timeOfDay === 'morning');
  const afternoonR = routines.filter(r => (r.metadata as any)?.timeOfDay === 'afternoon');
  const eveningR   = routines.filter(r => (r.metadata as any)?.timeOfDay === 'evening');
  const nightR     = routines.filter(r => (r.metadata as any)?.timeOfDay === 'night');
  const anytimeR   = routines.filter(r => !TOD_ORDER[(r.metadata as any)?.timeOfDay]);

  const overdueTasks = tasks.filter(t => isOverdue(t)).sort(byPriority);
  const todayTasks   = tasks.filter(t => !isOverdue(t)).sort(byPriority);
  const highToday    = todayTasks.filter(t => (t.metadata as any)?.priority === 'high');
  const medToday     = todayTasks.filter(t => (t.metadata as any)?.priority === 'medium');
  const lowToday     = todayTasks.filter(t =>
    (t.metadata as any)?.priority !== 'high' && (t.metadata as any)?.priority !== 'medium');

  const ordered = [
    ...morningR, ...anytimeR,
    ...overdueTasks,
    ...highToday,
    ...afternoonR,
    ...medToday,
    ...eveningR,
    ...lowToday,
    ...nightR,
  ];

  // Snoozed-this-session cards are moved to the back, preserving relative order.
  if (snoozedToBack.length === 0) return ordered;
  const back = new Set(snoozedToBack);
  const front = ordered.filter(n => !back.has(n._id));
  const tail = ordered.filter(n => back.has(n._id));
  return [...front, ...tail];
}

function useQueue(nodes: XPNode[], snoozedToBack: string[]) {
  return useMemo(() => buildQueue(nodes, snoozedToBack), [nodes, snoozedToBack]);
}

// ── Detect existing open timer on mount
function detectOpenTimer(nodes: XPNode[]): { runningId: string | null; elapsed: number } {
  for (const n of nodes) {
    const entries = (n.metadata as any)?.timeEntries as { start: string; end?: string }[] | undefined;
    if (!entries) continue;
    const open = entries.find(e => !e.end);
    if (open) {
      const elapsed = Math.floor((Date.now() - new Date(open.start).getTime()) / 1000);
      return { runningId: n._id, elapsed: Math.max(0, elapsed) };
    }
  }
  return { runningId: null, elapsed: 0 };
}

// ══════════════════════════════════════════════════════
// FocusCard
// ══════════════════════════════════════════════════════
interface FocusCardProps {
  node: XPNode;
  runningId: string | null;
  elapsed: number;
  dragDx: number;
  dragging: boolean;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  breadcrumbStr: string;
}

function FocusCard({ node, runningId, elapsed, dragDx, dragging, onStartTimer, onPauseTimer, breadcrumbStr }: FocusCardProps) {
  const isRoutine = node.type === 'ROUTINE';
  const running   = runningId === node._id;
  const m = (node.metadata as any) ?? {};

  const bg     = isRoutine ? ROUTINE_BG : TASK_BG;
  const shadow = isRoutine ? ROUTINE_SHADOW : TASK_SHADOW;
  const ink    = isRoutine ? 'rgba(13,46,42,0.82)' : 'rgba(58,29,14,0.88)';
  const cardFg = isRoutine ? '#0d2e2a' : '#3a1d0e';
  const chipBg = isRoutine ? 'rgba(13,46,42,0.18)' : 'rgba(58,29,14,0.18)';

  const tod = m.timeOfDay as string | undefined;
  const overReveal  = dragDx > 80;
  const snoozeReveal = dragDx < -80;

  return (
    <div
      style={{
        ...S.card,
        background: bg,
        transform: `translateX(${dragDx}px) rotate(${dragDx / 40}deg)`,
        transition: dragging ? 'none' : 'transform 360ms cubic-bezier(.2,.85,.3,1.1)',
        boxShadow: `0 24px 60px ${shadow}, 0 8px 24px rgba(0,0,0,0.5)`,
      }}
    >
      {/* snooze stamp */}
      <div style={{
        position: 'absolute', top: 22, left: 22,
        opacity: snoozeReveal ? 1 : 0, transition: 'opacity 140ms',
        transform: `rotate(-12deg) scale(${snoozeReveal ? 1 : 0.85})`,
        pointerEvents: 'none',
      }}>
        <Stamp fg={cardFg}>↓ SNOOZE</Stamp>
      </div>
      {/* done stamp */}
      <div style={{
        position: 'absolute', top: 22, right: 22,
        opacity: overReveal ? 1 : 0, transition: 'opacity 140ms',
        transform: `rotate(12deg) scale(${overReveal ? 1 : 0.85})`,
        pointerEvents: 'none',
      }}>
        <Stamp fg={cardFg}>{isRoutine ? 'CHECK IN ✓' : 'DONE ✓'}</Stamp>
      </div>

      {/* top meta row */}
      <div style={S.topMeta}>
        <span style={{ ...S.kindChip, background: chipBg, color: cardFg }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: cardFg }} />
          {isRoutine ? 'ROUTINE' : 'TASK'}
        </span>
        {isRoutine ? (
          <span style={{ ...S.metaRight, color: ink }}>
            {tod ? `${TOD_GLYPH[tod]} ${TOD_LABEL[tod]}` : ''}
          </span>
        ) : (
          <span style={{ ...S.metaRight, color: ink, gap: 6 }}>
            {m.priority && (
              <span style={{
                width: 8, height: 8, borderRadius: 999,
                background: PRIORITY_COLOR[m.priority] ?? ink,
              }} />
            )}
            {isOverdue(node) ? 'OVERDUE' : (m.due ? `Due ${m.due}` : '—')}
          </span>
        )}
      </div>

      {/* title + subtitle */}
      <div style={{ marginTop: 36 }}>
        <h2 style={{ ...S.cardTitle, color: cardFg }}>{node.title}</h2>
        <div style={{ ...S.cardSub, color: ink }}>
          {isRoutine
            ? [m.target, m.cadence].filter(Boolean).join(' · ')
            : (breadcrumbStr || node.description || '—')}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* timer panel */}
      <div style={{ ...S.timerPanel, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: ink }}>
            {running ? 'TIMER' : isRoutine ? 'READY' : 'ESTIMATE'}
          </span>
          {isRoutine ? (
            <span style={{ fontSize: 12, fontWeight: 600, color: ink }}>🔥 {m.streak ?? 0}d</span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: ink }}>
              {m.estimatedHours ? `~${m.estimatedHours}h` : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 30, fontWeight: 500, color: cardFg, letterSpacing: -0.5 }}>
            {running ? fmtElapsed(elapsed) : '00:00:00'}
          </span>
          {running ? (
            <button
              onClick={e => { e.stopPropagation(); onPauseTimer(); }}
              style={{ ...S.timerBtn, background: cardFg, color: 'rgba(255,255,255,0.92)' }}
            >⏸ Pause</button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onStartTimer(); }}
              style={{ ...S.timerBtn, background: cardFg, color: 'rgba(255,255,255,0.92)' }}
            >▶ Start</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stamp({ children, fg }: { children: React.ReactNode; fg: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '8px 14px',
      border: '3px solid rgba(255,255,255,0.92)', borderRadius: 8,
      color: fg, fontWeight: 800, fontSize: 14, letterSpacing: 1.2,
      background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(2px)',
    }}>{children}</span>
  );
}

// ══════════════════════════════════════════════════════
// FocusView — card stack
// ══════════════════════════════════════════════════════
interface FocusViewProps {
  runningId: string | null;
  elapsed: number;
  onStartTimer: (id: string) => void;
  onPauseTimer: () => void;
  onFinish: (node: XPNode) => void;
  onDismiss: (node: XPNode) => void;
}

function FocusView({ runningId, elapsed, onStartTimer, onPauseTimer, onFinish, onDismiss }: FocusViewProps) {
  const { nodes, breadcrumb } = useNodes();

  // Cards snoozed THIS SESSION are pushed to the back of the queue (session-only).
  const [snoozedToBack, setSnoozedToBack] = useState<string[]>([]);
  // Ids finished or dismissed this session — drives the stable counter denominator.
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  // ID-based tracking avoids index drift when the queue shrinks after a refetch.
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);

  const queue = useQueue(nodes, snoozedToBack);

  const idx = queue.findIndex(n => n._id === currentId);
  const node = idx >= 0 ? queue[idx] : undefined;

  // Distinct cards seen this session. A finished/dismissed card lingers in `queue`
  // until the refetch resolves; the union dedupes it so the denominator never flickers.
  const total = new Set([...queue.map(n => n._id), ...clearedIds]).size;
  const cleared = clearedIds.size;

  // Initialize currentId once the queue is ready; showDone prevents re-init after completion.
  useEffect(() => {
    if (!showDone && currentId === null && queue.length > 0) {
      setCurrentId(queue[0]._id);
    }
  }, [showDone, currentId, queue.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback((action: 'finish' | 'snooze' | 'dismiss') => {
    if (!node || idx < 0) return;
    // The next card to show, computed before state changes reshuffle the queue.
    const nextId = queue.find((n, i) => i > idx && n._id !== node._id)?._id ?? null;

    if (action === 'finish') {
      onFinish(node);
      setClearedIds(s => new Set([...s, node._id]));
      setDragDx(600);
    } else if (action === 'dismiss') {
      onDismiss(node);
      setClearedIds(s => new Set([...s, node._id]));
      setDragDx(-600);
    } else {
      // Snooze: push to back of the remaining queue, do NOT count as cleared.
      setSnoozedToBack(s => (s.includes(node._id) ? s : [...s, node._id]));
      setDragDx(-600);
    }

    setTimeout(() => {
      if (action === 'snooze') {
        // A snoozed card stays in the queue (moved to the back), so snooze must
        // never end the session: go to the next card, wrapping to the front if
        // this was the last one (a lone card simply re-presents).
        setCurrentId(nextId ?? queue.find(n => n._id !== node._id)?._id ?? node._id);
        setDragDx(0);
        return;
      }
      setCurrentId(nextId);
      if (!nextId) setShowDone(true);
      setDragDx(0);
    }, 240);
  }, [node, idx, queue, onFinish, onDismiss]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!node) return;
    startX.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    setDragDx(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    setDragging(false);
    startX.current = null;
    if      (dragDx >  120) advance('finish');
    else if (dragDx < -120) advance('snooze');
    else setDragDx(0);
  };

  if (!node) {
    return (
      <div style={S.empty}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✦</div>
        <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
          You're all caught up
        </h2>
        <p style={{ color: 'var(--subtext1)', marginTop: 10, fontSize: 14 }}>
          {cleared} card{cleared === 1 ? '' : 's'} cleared today.
        </p>
        <button
          onClick={() => {
            setShowDone(false);
            setSnoozedToBack([]);
            setClearedIds(new Set());
            setCurrentId(null);
          }}
          style={{
            marginTop: 28, padding: '10px 18px',
            borderRadius: 999, background: 'var(--surface0)',
            color: 'var(--subtext0)', fontSize: 13, fontWeight: 500,
          }}
        >Replay queue</button>
      </div>
    );
  }

  const crumbStr = breadcrumb(node._id).map(n => n.title).join(' › ');
  const nextNode = queue[idx + 1];

  return (
    <div style={S.viewport}>
      {/* header */}
      <div style={S.header}>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: 'var(--subtext1)', letterSpacing: 0.8 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '2px 0 0', letterSpacing: -0.5 }}>Focus</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 22, fontWeight: 600, letterSpacing: -0.5 }}>
            {cleared + 1}<span style={{ color: 'var(--overlay0)' }}>/{total}</span>
          </div>
          <div style={{ fontSize: 10.5, letterSpacing: 1, color: 'var(--subtext1)', textTransform: 'uppercase' }}>
            {total - cleared} left
          </div>
        </div>
      </div>

      {/* swipe stage */}
      <div
        style={S.stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* next card peek */}
        {nextNode && (
          <div style={{
            ...S.peek,
            background: nextNode.type === 'ROUTINE'
              ? 'linear-gradient(160deg, rgba(43,179,160,0.4), rgba(79,134,214,0.4))'
              : 'linear-gradient(160deg, rgba(245,159,93,0.4), rgba(232,122,82,0.4))',
            transform: `scale(${0.94 + Math.abs(dragDx) / 4000}) translateY(${10 - Math.abs(dragDx) / 60}px)`,
            opacity: 0.65 + Math.abs(dragDx) / 600,
          }} />
        )}
        <FocusCard
          node={node}
          runningId={runningId}
          elapsed={elapsed}
          dragDx={dragDx}
          dragging={dragging}
          onStartTimer={() => onStartTimer(node._id)}
          onPauseTimer={onPauseTimer}
          breadcrumbStr={crumbStr}
        />
      </div>

      {/* action buttons + progress dots */}
      <div style={S.actions}>
        <ActionBtn
          tone="snooze"
          label="Snooze"
          hint="swipe ←"
          onClick={() => advance('snooze')}
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v6l3 3"/><circle cx="12" cy="12" r="9"/>
            </svg>
          }
        />
        <ProgressDots total={total} index={cleared} />
        <ActionBtn
          tone="finish"
          label={node.type === 'ROUTINE' ? 'Check in' : 'Finish'}
          hint="swipe →"
          onClick={() => advance('finish')}
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
        />
      </div>
    </div>
  );
}

function ActionBtn({ tone, label, hint, onClick, icon }: {
  tone: 'snooze' | 'finish';
  label: string;
  hint: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  const fg = tone === 'finish' ? 'var(--green)' : 'var(--subtext1)';
  const bg = tone === 'finish' ? 'rgba(166,227,161,0.10)' : 'rgba(166,173,200,0.08)';
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '10px 14px', borderRadius: 14,
      background: bg, color: fg, minWidth: 90,
      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--overlay0)', letterSpacing: 0.4 }}>{hint}</span>
    </button>
  );
}

function ProgressDots({ total, index }: { total: number; index: number }) {
  const cap = Math.min(total, 9);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '0 8px' }}>
      {Array.from({ length: cap }, (_, i) => {
        const ratio = i / Math.max(1, cap - 1);
        const myIdx = Math.round(ratio * (total - 1));
        const done = myIdx < index;
        const current = myIdx === index;
        return (
          <span key={i} style={{
            width: current ? 16 : 5, height: 5, borderRadius: 999,
            background: done ? 'var(--subtext1)' : current ? 'var(--text)' : 'var(--surface1)',
            transition: 'all 200ms',
          }} />
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// TimerBar
// ══════════════════════════════════════════════════════
function TimerBar({ runningId, elapsed, onPause, onStop }: {
  runningId: string | null;
  elapsed: number;
  onPause: () => void;
  onStop: () => void;
}) {
  const { byId } = useNodes();
  if (!runningId) return null;
  const node = byId[runningId];
  if (!node) return null;
  const tint = node.type === 'ROUTINE' ? 'var(--teal)' : 'var(--orange)';
  return (
    <div style={S.timerBar}>
      <button onClick={onPause} style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', color: tint, border: 'none', background: 'none', cursor: 'pointer', animation: 'mob-pulse 2s ease-in-out infinite' }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill={tint}>
          <rect x="6" y="5" width="4" height="14" rx="1"/>
          <rect x="14" y="5" width="4" height="14" rx="1"/>
        </svg>
      </button>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
        {node.title}
      </span>
      <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 13, color: 'var(--subtext0)' }}>
        {fmtElapsed(elapsed)}
      </span>
      <button onClick={onStop} style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', color: 'var(--red)', border: 'none', background: 'none', cursor: 'pointer' }}>
        <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor">
          <rect x="5" y="5" width="14" height="14" rx="2"/>
        </svg>
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// BottomNav
// ══════════════════════════════════════════════════════
function BottomNav({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const tabs = [
    { id: 'today', label: 'Focus', Icon: Icons.Target },
    { id: 'stats', label: 'Stats',  Icon: Icons.TrendingUp },
  ] as const;
  return (
    <div style={S.bottomNav}>
      {tabs.map(({ id, label, Icon }) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            color: active ? 'var(--accent)' : 'var(--subtext1)',
            border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            position: 'relative',
          }}>
            {active && <div style={{ position: 'absolute', top: 8, width: 28, height: 2, borderRadius: 2, background: 'var(--accent)' }} />}
            <Icon size={20} color={active ? 'var(--accent)' : 'var(--subtext1)'} />
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// StatsView
// ══════════════════════════════════════════════════════
function StatsView() {
  const { byType } = useNodes();
  const tasks    = byType('TASK');
  const routines = byType('ROUTINE');
  const skills   = byType('SKILL');
  const people   = byType('PERSON');

  const longestStreak   = routines.reduce((m, r) => Math.max(m, (r.metadata as any)?.streak ?? 0), 0);
  const dailyRoutines   = routines.filter(r => (r.metadata as any)?.cadence === 'daily');
  const doneToday       = dailyRoutines.filter(r => isCheckedToday(r.metadata)).length;
  const totalHours      = Math.round(skills.reduce((s, k) => s + ((k.metadata as any)?.totalHours ?? 0), 0));

  const monday = (() => {
    const d = new Date();
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() - (dow - 1));
    return localDateStr(d);
  })();
  const doneThisWeek = tasks.filter(t => {
    if (t.status !== 'DONE') return false;
    const completedAt = (t.metadata as any)?.completedAt as string | undefined;
    return completedAt && completedAt >= monday;
  }).length;

  const recent = tasks
    .filter(t => t.status === 'DONE' && (t.metadata as any)?.completedAt)
    .sort((a, b) => {
      const ca = (a.metadata as any)?.completedAt ?? '';
      const cb = (b.metadata as any)?.completedAt ?? '';
      return cb.localeCompare(ca);
    })
    .slice(0, 3);

  const upcoming = people
    .filter(p => (p.metadata as any)?.nextCatchup)
    .sort((a, b) => {
      const da = (a.metadata as any)?.nextCatchup ?? '';
      const db = (b.metadata as any)?.nextCatchup ?? '';
      return da.localeCompare(db);
    })
    .slice(0, 3);

  const Stat = ({ value, label, accent, sub }: { value: string | number; label: string; accent: string; sub?: string }) => (
    <div style={S.statCard}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: accent, letterSpacing: -0.5 }}>{value}</span>
        {sub && <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: 'var(--subtext1)' }}>{sub}</span>}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.8, color: 'var(--subtext1)', textTransform: 'uppercase', marginTop: 6 }}>
        {label}
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '8px 16px 120px', scrollbarWidth: 'none' }}>
      <div style={{ paddingTop: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Stats</h1>
        <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, color: 'var(--subtext1)', marginTop: 2 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
        <Stat value={`🔥 ${longestStreak}`} label="Day streak"      accent="var(--orange)" />
        <Stat value={doneToday}              label="Routines today" accent="var(--teal)"   sub={`/ ${dailyRoutines.length}`} />
        <Stat value={doneThisWeek}           label="Tasks done"     accent="var(--accent)" sub="this wk" />
        <Stat value={totalHours}             label="Skill hours"    accent="var(--green)"  sub="h" />
      </div>

      <SectionHeader>Recent completions</SectionHeader>
      <div style={{ display: 'grid', gap: 1, background: 'var(--surface0)', borderRadius: 12, overflow: 'hidden' }}>
        {recent.length === 0 && (
          <div style={{ padding: '14px', fontSize: 13, color: 'var(--overlay1)', fontStyle: 'italic' }}>No completions yet.</div>
        )}
        {recent.map(t => {
          const m = t.metadata as any;
          return (
            <div key={t._id} style={S.statRow}>
              <span style={{ color: 'var(--green)' }}>✓</span>
              <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{t.title}</span>
              {m?.creditedHours != null && (
                <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: 'var(--green)' }}>+{m.creditedHours}h</span>
              )}
            </div>
          );
        })}
      </div>

      <SectionHeader>Upcoming catch-ups</SectionHeader>
      <div style={{ display: 'grid', gap: 8 }}>
        {upcoming.map(p => {
          const m = p.metadata as any;
          const initials = m?.initials ?? p.title.slice(0, 2).toUpperCase();
          return (
            <div key={p._id} style={S.catchupRow}>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--pink)', color: '#1e1e2e', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{p.title}</div>
                {m?.role && <div style={{ fontSize: 11, color: 'var(--subtext1)' }}>{m.role}</div>}
              </div>
              <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: 'var(--subtext0)' }}>
                {m?.relativeDate ?? m?.nextCatchup ?? ''}
              </span>
            </div>
          );
        })}
        {upcoming.length === 0 && (
          <div style={{ padding: '14px', fontSize: 13, color: 'var(--overlay1)', fontStyle: 'italic' }}>No upcoming catch-ups.</div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: 'var(--subtext1)', textTransform: 'uppercase', margin: '26px 0 10px' }}>
      ── {children} ──
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MobileShell — top-level
// ══════════════════════════════════════════════════════
export default function MobileShell() {
  const { nodes } = useNodes();
  const [tab, setTab] = useState('today');
  const [createOpen, setCreateOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [captureType, setCaptureType] = useState<string>('TASK');

  const openCapture = (t: string) => {
    setCaptureType(t);
    setCreateOpen(true);
    setFabOpen(false);
  };

  // ── Timer state (shared between FocusView and TimerBar)
  const [runningId, setRunningId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect existing open timer on mount
  useEffect(() => {
    if (nodes.length === 0) return;
    const { runningId: rid, elapsed: el } = detectOpenTimer(nodes);
    if (rid) { setRunningId(rid); setElapsed(el); }
  }, [nodes.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Interval tick
  useEffect(() => {
    if (runningId) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [runningId]);

  // ── Mutations
  const refetchOpts = { refetchQueries: [{ query: GET_NODES }] };
  const [startTimerMut]   = useMutation(START_TIMER,        refetchOpts);
  const [stopTimerMut]    = useMutation(STOP_TIMER,         refetchOpts);
  const [completeTaskMut] = useMutation(COMPLETE_TASK,      refetchOpts);
  const [checkInMut]      = useMutation(CHECK_IN_ROUTINE,   refetchOpts);
  const [updateNodeMut]   = useMutation(UPDATE_NODE,         refetchOpts);
  const [reopenTaskMut]    = useMutation(REOPEN_TASK,         refetchOpts);

  const handleStartTimer = useCallback(async (id: string) => {
    try {
      await startTimerMut({ variables: { id } });
      setRunningId(id);
      setElapsed(0);
    } catch { /* ignore */ }
  }, [startTimerMut]);

  const handlePauseTimer = useCallback(async () => {
    if (!runningId) return;
    try {
      await stopTimerMut({ variables: { id: runningId } });
    } catch { /* ignore */ }
    setRunningId(null);
  }, [runningId, stopTimerMut]);

  const handleStopTimer = useCallback(async () => {
    if (!runningId) return;
    try {
      await stopTimerMut({ variables: { id: runningId } });
    } catch { /* ignore */ }
    setRunningId(null);
    setElapsed(0);
  }, [runningId, stopTimerMut]);

  const handleFinish = useCallback(async (node: XPNode) => {
    // Stop timer if it's running on this node
    if (runningId === node._id) {
      try { await stopTimerMut({ variables: { id: node._id } }); } catch { /* ignore */ }
      setRunningId(null); setElapsed(0);
    }
    try {
      if (node.type === 'ROUTINE') {
        await checkInMut({ variables: { id: node._id } });
      } else {
        await completeTaskMut({ variables: { id: node._id, completedDate: localDateStr() } });
      }
    } catch { /* ignore */ }
  }, [runningId, stopTimerMut, checkInMut, completeTaskMut]);

  const handleDismiss = useCallback(async (node: XPNode) => {
    if (node.type !== 'TASK') return; // routines have no due date
    const meta = { ...(node.metadata as any), due: tomorrowStr() };
    try {
      await updateNodeMut({ variables: { input: { _id: node._id, metadata: meta } } });
    } catch { /* ignore */ }
  }, [updateNodeMut]);

  return (
    <div style={S.shell}>
      {/* safe area top spacer */}
      <div style={{ height: 'env(safe-area-inset-top, 44px)', flexShrink: 0 }} />

      {/* main content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tab === 'today' && (
          <FocusView
            runningId={runningId}
            elapsed={elapsed}
            onStartTimer={handleStartTimer}
            onPauseTimer={handlePauseTimer}
            onFinish={handleFinish}
            onDismiss={handleDismiss}
          />
        )}
        {tab === 'stats' && <StatsView />}
      </div>

      <TimerBar
        runningId={runningId}
        elapsed={elapsed}
        onPause={handlePauseTimer}
        onStop={handleStopTimer}
      />
      <BottomNav tab={tab} setTab={setTab} />

      {/* safe area bottom spacer */}
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)', flexShrink: 0 }} />

      {/* FAB launcher backdrop */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
        />
      )}

      {/* FAB launcher actions */}
      {fabOpen && (
        <div style={{
          position: 'fixed', right: 16,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 140px)',
          zIndex: 101, display: 'flex', flexDirection: 'column', gap: 10,
          animation: 'fadeIn 0.12s ease-out',
        }}>
          <FabAction label="Person" icon={<Icons.Users size={16} color="var(--mantle)" />} onClick={() => openCapture('PERSON')} />
          <FabAction label="Task" icon={<Icons.CheckSquare size={16} color="var(--mantle)" />} onClick={() => openCapture('TASK')} />
        </div>
      )}

      {/* FAB — quick capture */}
      <button
        onClick={() => setFabOpen((v) => !v)}
        style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)', right: 16,
          width: 56, height: 56, borderRadius: 999,
          background: 'var(--accent)',
          boxShadow: '0 4px 16px rgba(203,166,247,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', zIndex: 100,
          transition: 'transform 0.15s ease',
          transform: fabOpen ? 'rotate(45deg)' : 'none',
        }}
      >
        <Icons.Plus size={24} color="var(--mantle)" strokeWidth={2.5} />
      </button>

      <CreateNodeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultType={captureType}
      />
    </div>
  );
}

function FabAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: 'var(--accent)', color: 'var(--mantle)',
        fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
        boxShadow: '0 4px 14px rgba(203,166,247,0.3)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Styles (mirrors design)
const S = {
  shell: {
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'var(--base)',
    color: 'var(--text)',
    overflow: 'hidden',
    fontFamily: '"Inter",-apple-system,system-ui,sans-serif',
  },
  viewport: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '10px 20px 4px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  stage: {
    flex: 1,
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'stretch',
    touchAction: 'pan-y',
    userSelect: 'none' as const,
    minHeight: 0,
  },
  peek: {
    position: 'absolute' as const,
    inset: '14px 18px 0 18px',
    borderRadius: 28,
    pointerEvents: 'none' as const,
    transition: 'transform 220ms, opacity 220ms',
  },
  card: {
    flex: 1,
    position: 'relative' as const,
    borderRadius: 28,
    padding: '26px 24px 22px',
    display: 'flex',
    flexDirection: 'column' as const,
    cursor: 'grab',
    minHeight: 0,
    overflow: 'hidden',
  },
  topMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kindChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 1.2,
    padding: '5px 10px',
    borderRadius: 999,
  },
  metaRight: {
    fontSize: 11.5,
    fontWeight: 600,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 38,
    fontWeight: 700,
    letterSpacing: -1.2,
    lineHeight: 1.05,
    margin: 0,
  },
  cardSub: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: 0.1,
    lineHeight: 1.4,
  },
  timerPanel: {
    borderRadius: 18,
    padding: '12px 14px',
  },
  timerBtn: {
    padding: '8px 16px',
    borderRadius: 999,
    fontWeight: 600,
    fontSize: 12.5,
    letterSpacing: 0.4,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 4px 4px',
  },
  empty: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px 40px',
    textAlign: 'center' as const,
  },
  timerBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 48,
    padding: '0 12px',
    background: 'var(--mantle)',
    borderTop: '1px solid var(--surface0)',
    flexShrink: 0,
  },
  bottomNav: {
    display: 'flex',
    height: 60,
    background: 'var(--mantle)',
    borderTop: '1px solid var(--surface0)',
    flexShrink: 0,
  },
  statCard: {
    background: 'var(--surface0)',
    borderRadius: 12,
    padding: '14px 14px 12px',
    minHeight: 80,
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--base)',
    padding: '12px 14px',
  },
  catchupRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--surface0)',
    padding: '10px 12px',
    borderRadius: 12,
  },
};
