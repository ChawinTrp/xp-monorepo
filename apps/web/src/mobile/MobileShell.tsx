import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { Icons, StatCard } from '../components/ui';
import { getTheme, toggleTheme } from '../lib/theme';
import {
  COMPLETE_TASK, CHECK_IN_ROUTINE, START_TIMER, STOP_TIMER, GET_NODES,
  UPDATE_NODE, REOPEN_TASK, UNDO_CHECK_IN_ROUTINE, DAY_PLAN, WEEK_PROGRESS,
} from '../lib/graphql';
import type { XPNode } from '../lib/types';
import CreateNodeModal from '../components/CreateNodeModal';
import {
  buildQueue, isOverdue, isCheckedOn, logicalDateStr, addDays,
  type QueueEntry,
} from '../lib/queue';
import { getWeekStart, parseLocalDate } from '@xp/shared';

// ── Today / tomorrow (5am logical-day boundary; helpers live in ../lib/queue)
const TODAY = logicalDateStr();
function tomorrowStr(): string {
  return addDays(logicalDateStr(), 1);
}

// ── Timer helpers
const pad = (n: number) => String(n).padStart(2, '0');
const fmtElapsed = (s: number) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

// ── Reduced-motion check (non-essential decorative animation only)
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ── Time-of-day config
const TOD_GLYPH: Record<string, string> = { morning: '☀', afternoon: '◐', evening: '◑', night: '☾' };
const TOD_LABEL: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };

// ── Card gradient by type
const ROUTINE_BG = 'var(--grad-routine)';
const TASK_BG    = 'var(--grad-task)';
const ROUTINE_SHADOW = 'var(--shadow-routine)';
const TASK_SHADOW    = 'var(--shadow-task)';
const ROUTINE_FG = 'var(--c-routine)';
const TASK_FG    = 'var(--c-task)';

const PRIORITY_COLOR: Record<string, string> = {
  high: 'var(--red)', medium: 'var(--yellow)', low: 'var(--green)',
};

function useQueue(nodes: XPNode[], snoozedToBack: string[], dayPlan: { orderedIds: string[] } | null): QueueEntry[] {
  return useMemo(
    () => buildQueue(nodes, { today: TODAY, snoozedToBack, dayPlan }),
    [nodes, snoozedToBack, dayPlan],
  );
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
  unplanned: boolean;
}

function FocusCard({ node, runningId, elapsed, dragDx, dragging, onStartTimer, onPauseTimer, breadcrumbStr, unplanned }: FocusCardProps) {
  const isRoutine = node.type === 'ROUTINE';
  const running   = runningId === node._id;
  const m = (node.metadata as any) ?? {};

  const bg      = isRoutine ? ROUTINE_BG : TASK_BG;
  const shadow  = isRoutine ? ROUTINE_SHADOW : TASK_SHADOW;
  const typeFg  = isRoutine ? ROUTINE_FG : TASK_FG;
  const cardFg  = '#FFFFFF';
  const ink     = 'rgba(255,255,255,0.88)';
  const chipBg  = 'rgba(255,255,255,0.22)';

  const tod = m.timeOfDay as string | undefined;
  const overReveal  = dragDx > 80;
  const snoozeReveal = dragDx < -80;

  return (
    <div
      style={{
        ...S.card,
        background: bg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transform: `translateX(${dragDx}px) rotate(${dragDx / 40}deg)`,
        transition: dragging ? 'none' : 'transform 360ms cubic-bezier(.2,.85,.3,1.1)',
        boxShadow: `0 24px 60px ${shadow}, 0 30px 60px rgba(31,36,48,0.12)`,
      }}
    >
      {/* snooze stamp */}
      <div style={{
        position: 'absolute', top: 22, left: 22,
        opacity: snoozeReveal ? 1 : 0, transition: 'opacity 140ms',
        transform: `rotate(-12deg) scale(${snoozeReveal ? 1 : 0.85})`,
        pointerEvents: 'none',
      }}>
        <Stamp fg={typeFg}>↓ SNOOZE</Stamp>
      </div>
      {/* done stamp */}
      <div style={{
        position: 'absolute', top: 22, right: 22,
        opacity: overReveal ? 1 : 0, transition: 'opacity 140ms',
        transform: `rotate(12deg) scale(${overReveal ? 1 : 0.85})`,
        pointerEvents: 'none',
      }}>
        <Stamp fg={typeFg}>{isRoutine ? 'CHECK IN ✓' : 'DONE ✓'}</Stamp>
      </div>

      {/* top meta row */}
      <div style={S.topMeta}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...S.kindChip, background: chipBg, color: cardFg }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: typeFg }} />
            {isRoutine ? 'ROUTINE' : 'TASK'}
          </span>
          {unplanned && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
              padding: '3px 7px', borderRadius: 999,
              background: 'rgba(255,255,255,0.28)', color: ink,
              textTransform: 'uppercase',
            }}>+ Unplanned</span>
          )}
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
            {isOverdue(node, TODAY) ? 'OVERDUE' : (m.due ? `Due ${m.due}` : '—')}
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
              style={{ ...S.timerBtn, background: '#FFFFFF', color: typeFg }}
            >⏸ Pause</button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onStartTimer(); }}
              style={{ ...S.timerBtn, background: '#FFFFFF', color: typeFg }}
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
  onUndoFinish: (node: XPNode) => void;
  onUndoDismiss: (node: XPNode, prevDue?: string) => void;
  dayPlan: { orderedIds: string[] } | null;
}

// Short, punchy encouragements shown on finish — must read in ~1s.
const FINISH_QUOTES = [
  'One down.',
  'Momentum.',
  'Win banked.',
  'Ship beats scroll.',
  'Future you says thanks.',
  'Show up. Repeat.',
  'Progress, not perfect.',
  '4/7 wins the week.',
  'Done is the engine.',
  'Keep the streak warm.',
  'That moved the needle.',
  'Earned it.',
];

// FireBurst — one-shot celebration overlay shown when a card is finished.
// Pure CSS particles (see .fire-* in index.css); reduced-motion handled there.
// Mount it with a changing `key` so each finish replays the animation.
function FireBurst() {
  const quote = useMemo(() => FINISH_QUOTES[Math.floor(Math.random() * FINISH_QUOTES.length)], []);
  const particles = useMemo(() => {
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: rand(-72, 72),
      dist: rand(110, 200),
      rot: rand(-28, 28),
      dur: rand(650, 1000),
      delay: rand(0, 150),
      size: rand(16, 34),
      glyph: Math.random() < 0.82 ? '🔥' : '✨',
    }));
  }, []);
  return (
    <div className="fire-overlay" aria-hidden>
      <div className="fire-flash" />
      <div className="fire-quote">{quote}</div>
      {particles.map(p => (
        <span
          key={p.id}
          className="fire-particle"
          style={{
            ['--x' as any]: `${p.x}px`,
            ['--dist' as any]: `${p.dist}px`,
            ['--rot' as any]: `${p.rot}deg`,
            ['--dur' as any]: `${p.dur}ms`,
            ['--delay' as any]: `${p.delay}ms`,
            fontSize: p.size,
          }}
        >{p.glyph}</span>
      ))}
    </div>
  );
}

function FocusView({ runningId, elapsed, onStartTimer, onPauseTimer, onFinish, onDismiss, onUndoFinish, onUndoDismiss, dayPlan }: FocusViewProps) {
  const { nodes, breadcrumb } = useNodes();
  const [theme, setThemeState] = useState(getTheme());
  useEffect(() => {
    const handler = (e: Event) => {
      setThemeState((e as CustomEvent).detail);
    };
    window.addEventListener('xp-theme-change', handler);
    return () => window.removeEventListener('xp-theme-change', handler);
  }, []);

  // Cards snoozed THIS SESSION are pushed to the back of the queue (session-only).
  const [snoozedToBack, setSnoozedToBack] = useState<string[]>([]);
  // Ids finished or dismissed this session — drives the stable counter denominator.
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  // ID-based tracking avoids index drift when the queue shrinks after a refetch.
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Single-level undo of the most recent action this session.
  const [lastAction, setLastAction] = useState<
    | { kind: 'finish' | 'snooze' | 'dismiss'; node: XPNode; prevDue?: string }
    | null
  >(null);
  // True while an undo of a finish/dismiss is waiting for the un-done card to
  // reappear in the queue (after the refetch). Prevents the terminal "all caught
  // up" screen — and its destructive Replay button — from flashing mid-undo.
  const [undoing, setUndoing] = useState(false);
  const startX = useRef<number | null>(null);
  // One-shot fire celebration on finish. `burstKey` remounts FireBurst so it replays.
  const [bursting, setBursting] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (burstTimer.current) clearTimeout(burstTimer.current); }, []);

  const entries = useQueue(nodes, snoozedToBack, dayPlan);
  const queue = useMemo(() => entries.map((e) => e.node), [entries]);
  const unplannedIds = useMemo(
    () => new Set(entries.filter((e) => !e.planned).map((e) => e.node._id)),
    [entries],
  );

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

  // Clear the undo placeholder once the un-done card reappears as the current node.
  useEffect(() => {
    if (node && undoing) setUndoing(false);
  }, [node, undoing]);

  // Safety net: never stay stuck on the placeholder if the refetch/mutation fails.
  useEffect(() => {
    if (!undoing) return;
    const t = setTimeout(() => setUndoing(false), 5000);
    return () => clearTimeout(t);
  }, [undoing]);

  const advance = useCallback((action: 'finish' | 'snooze' | 'dismiss') => {
    if (!node || idx < 0) return;
    // The next card to show, computed before state changes reshuffle the queue.
    const nextId = queue.find((n, i) => i > idx && n._id !== node._id)?._id ?? null;

    setLastAction({
      kind: action,
      node,
      prevDue: (node.metadata as any)?.due,
    });

    if (action === 'finish') {
      onFinish(node);
      setClearedIds(s => new Set([...s, node._id]));
      setDragDx(600);
      // Celebrate: remount FireBurst, then auto-clear after the animation.
      setBurstKey(k => k + 1);
      setBursting(true);
      if (burstTimer.current) clearTimeout(burstTimer.current);
      burstTimer.current = setTimeout(() => setBursting(false), 1700);
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

  const handleUndo = useCallback(() => {
    if (!lastAction) return;
    const { kind, node: an, prevDue } = lastAction;

    if (kind === 'snooze') {
      // Pull the card back out of the snoozed-to-back list and make it current.
      setSnoozedToBack(s => s.filter(id => id !== an._id));
      setCurrentId(an._id);
    } else if (kind === 'finish') {
      setUndoing(true);
      onUndoFinish(an);
      setClearedIds(s => { const n = new Set(s); n.delete(an._id); return n; });
      setShowDone(false);
      setCurrentId(an._id);
    } else {
      setUndoing(true);
      onUndoDismiss(an, prevDue);
      setClearedIds(s => { const n = new Set(s); n.delete(an._id); return n; });
      setShowDone(false);
      setCurrentId(an._id);
    }
    setLastAction(null);
  }, [lastAction, onUndoFinish, onUndoDismiss]);

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
    if (undoing) {
      return (
        <div style={S.empty}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.7 }}>↺</div>
          <p style={{ color: 'var(--subtext1)', fontSize: 14 }}>Restoring…</p>
        </div>
      );
    }
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
            {parseLocalDate(logicalDateStr()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '2px 0 0', letterSpacing: -0.5 }}>Focus</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 999,
              background: 'var(--surface0)', color: 'var(--subtext0)',
              border: 'none', cursor: 'pointer',
              padding: 0,
            }}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? <Icons.Moon size={16} /> : <Icons.Sun size={16} />}
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 22, fontWeight: 600, letterSpacing: -0.5 }}>
              {cleared + 1}<span style={{ color: 'var(--overlay0)' }}>/{total}</span>
            </div>
            <div style={{ fontSize: 10.5, letterSpacing: 1, color: 'var(--subtext1)', textTransform: 'uppercase' }}>
              {total - cleared} left
            </div>
          </div>
          <button
            onClick={handleUndo}
            disabled={!lastAction}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 11px', borderRadius: 999,
              background: lastAction ? 'var(--surface0)' : 'transparent',
              color: lastAction ? 'var(--subtext0)' : 'var(--overlay0)',
              border: 'none', cursor: lastAction ? 'pointer' : 'default',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              opacity: lastAction ? 1 : 0.4,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
            </svg>
            Undo
          </button>
        </div>
      </div>

      {/* progress dots — top */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 10 }}>
        <ProgressDots total={total} index={cleared} />
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
            background: nextNode.type === 'ROUTINE' ? 'var(--grad-routine-peek)' : 'var(--grad-task-peek)',
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
          unplanned={unplannedIds.has(node._id)}
        />
        {bursting && <FireBurst key={burstKey} />}
      </div>

      {/* action buttons — single row of three */}
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
        {(node.type === 'TASK' || node.type === 'ROUTINE') && (
          <ActionBtn
            tone="dismiss"
            label={node.type === 'ROUTINE' ? 'Skip' : 'Tomorrow'}
            hint={node.type === 'ROUTINE' ? 'not today' : 'dismiss'}
            onClick={() => advance('dismiss')}
            icon={
              node.type === 'ROUTINE' ? (
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
                </svg>
              ) : (
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                </svg>
              )
            }
          />
        )}
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
  tone: 'snooze' | 'finish' | 'dismiss';
  label: string;
  hint: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  const fg = tone === 'finish' ? 'var(--green)' : tone === 'dismiss' ? 'var(--blue)' : 'var(--subtext1)';
  const bg = tone === 'finish'
    ? 'color-mix(in srgb, var(--green) 10%, transparent)'
    : tone === 'dismiss'
    ? 'color-mix(in srgb, var(--blue) 10%, transparent)'
    : 'color-mix(in srgb, var(--subtext1) 8%, transparent)';
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
  const tint = node.type === 'ROUTINE' ? 'var(--c-routine)' : 'var(--c-task)';
  return (
    <div className="glass" style={S.timerBar}>
      <button onClick={onPause} style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', color: tint, border: 'none', background: 'none', cursor: 'pointer', animation: prefersReducedMotion() ? 'none' : 'mob-pulse 2s ease-in-out infinite' }}>
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
  const { data: weekData } = useQuery<{ weekProgress: any }>(WEEK_PROGRESS);

  const longestStreak   = routines.reduce((m, r) => Math.max(m, (r.metadata as any)?.streak ?? 0), 0);
  const dailyRoutines   = routines.filter(r => (r.metadata as any)?.cadence === 'daily');
  const doneToday       = dailyRoutines.filter(r => isCheckedOn(r.metadata, TODAY)).length;
  const totalHours      = Math.round(skills.reduce((s, k) => s + ((k.metadata as any)?.totalHours ?? 0), 0));

  // Sunday-start week (canonical @xp/shared) + local completedDate
  // with legacy UTC completedAt fallback — same convention as Dashboard.
  const weekStart = getWeekStart();
  const doneThisWeek = tasks.filter(t => {
    if (t.status !== 'DONE') return false;
    const m = t.metadata as any;
    const completed = m?.completedDate ?? (m?.completedAt ? String(m.completedAt).slice(0, 10) : null);
    return completed != null && completed >= weekStart;
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

  const statValue = (value: string | number, sub?: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      {value}
      {sub && (
        <span className="mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--subtext1)' }}>{sub}</span>
      )}
    </span>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '8px 16px 120px', scrollbarWidth: 'none' }}>
      <div style={{ paddingTop: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Stats</h1>
        <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, color: 'var(--subtext1)', marginTop: 2 }}>
          {parseLocalDate(logicalDateStr()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
        <StatCard value={statValue(`🔥 ${longestStreak}`)}     label="Day streak"      color="var(--accent)" />
        <StatCard value={statValue(doneToday, `/ ${dailyRoutines.length}`)} label="Routines today" color="var(--c-routine)" />
        <StatCard value={statValue(doneThisWeek, 'this wk')}   label="Tasks done"      color="var(--accent)" />
        <StatCard value={statValue(totalHours, 'h')}           label="Skill hours"     color="var(--c-skill)" />
      </div>

      {weekData?.weekProgress && (() => {
        const { days, wonDays, weekTarget, weekWon, weekWinStreak } = weekData.weekProgress;
        const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        return (
          <>
            <SectionHeader>Win the week</SectionHeader>
            <div style={{ background: 'var(--surface0)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {wonDays} / {weekTarget} days {weekWon && '🎉'}
                </span>
                {weekWinStreak > 1 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)' }}>🔥 {weekWinStreak}w</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {days.map((day: any, i: number) => {
                  const isFuture = day.date > TODAY;
                  const pip = isFuture ? '·' : day.won ? '●' : '○';
                  const color = isFuture ? 'var(--overlay0)' : day.won ? 'var(--green)' : 'var(--red)';
                  return (
                    <div key={day.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 16, lineHeight: 1, color }}>{pip}</span>
                      <span style={{ fontSize: 10, color: 'var(--subtext1)' }}>{DAY_LABELS[i]}</span>
                    </div>
                  );
                })}
              </div>
              {!weekWon && (
                <div style={{ fontSize: 11, color: 'var(--subtext1)', marginTop: 8 }}>
                  Need {weekTarget - wonDays} more · {days.filter((d: any) => d.date >= TODAY).length} days left
                </div>
              )}
            </div>
          </>
        );
      })()}

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
              <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--pink)', color: 'var(--base)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>
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
  const { data: dayPlanData } = useQuery<{ dayPlan: { orderedIds: string[] } | null }>(
    DAY_PLAN,
    { variables: { date: TODAY } },
  );
  const dayPlan = dayPlanData?.dayPlan ?? null;
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
  const [undoCheckInMut]  = useMutation(UNDO_CHECK_IN_ROUTINE, refetchOpts);

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
        await completeTaskMut({ variables: { id: node._id, completedDate: logicalDateStr() } });
      }
    } catch { /* ignore */ }
  }, [runningId, stopTimerMut, checkInMut, completeTaskMut]);

  const handleDismiss = useCallback(async (node: XPNode) => {
    let meta: any;
    if (node.type === 'TASK') {
      // Tasks: push the due date out a day so it drops off today's queue.
      meta = { ...(node.metadata as any), due: tomorrowStr() };
    } else if (node.type === 'ROUTINE') {
      // Routines have no due date — record a per-day skip ("not today") so the
      // queue hides it for today only (see isRoutineSkippedOn).
      const today = logicalDateStr();
      const prev: string[] = Array.isArray((node.metadata as any)?.skips)
        ? (node.metadata as any).skips
        : [];
      if (prev.some((d) => d.slice(0, 10) === today)) return; // already skipped today
      meta = { ...(node.metadata as any), skips: [...prev, today] };
    } else {
      return;
    }
    try {
      await updateNodeMut({ variables: { input: { _id: node._id, metadata: meta } } });
    } catch { /* ignore */ }
  }, [updateNodeMut]);

  const handleUndoFinish = useCallback(async (node: XPNode) => {
    try {
      if (node.type === 'ROUTINE') {
        await undoCheckInMut({ variables: { id: node._id } });
      } else {
        await reopenTaskMut({ variables: { id: node._id } });
      }
    } catch { /* ignore */ }
  }, [reopenTaskMut, undoCheckInMut]);

  const handleUndoDismiss = useCallback(async (node: XPNode, prevDue?: string) => {
    const meta = { ...(node.metadata as any) };
    if (node.type === 'ROUTINE') {
      // Undo a routine skip: drop today's skip entry so it returns to the queue.
      const today = logicalDateStr();
      const prev: string[] = Array.isArray(meta.skips) ? meta.skips : [];
      meta.skips = prev.filter((d) => d.slice(0, 10) !== today);
    } else if (prevDue == null) {
      delete meta.due;
    } else {
      meta.due = prevDue;
    }
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
            onUndoFinish={handleUndoFinish}
            onUndoDismiss={handleUndoDismiss}
            dayPlan={dayPlan}
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
          animation: prefersReducedMotion() ? 'none' : 'fadeIn 0.12s ease-out',
        }}>
          <FabAction label="Person" icon={<Icons.Users size={16} color="#FFFFFF" />} onClick={() => openCapture('PERSON')} />
          <FabAction label="Task" icon={<Icons.CheckSquare size={16} color="#FFFFFF" />} onClick={() => openCapture('TASK')} />
        </div>
      )}

      {/* FAB — quick capture */}
      <button
        className="e-accent"
        onClick={() => setFabOpen((v) => !v)}
        style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)', right: 16,
          width: 56, height: 56, borderRadius: 999,
          background: 'linear-gradient(180deg, var(--accent), var(--accent-strong))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', zIndex: 100,
          transition: 'transform 0.15s ease',
          transform: fabOpen ? 'rotate(45deg)' : 'none',
        }}
      >
        <Icons.Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
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
      className="e-accent"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(180deg, var(--accent), var(--accent-strong))', color: '#FFFFFF',
        fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
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
    borderRadius: 16,
    pointerEvents: 'none' as const,
    transition: 'transform 220ms, opacity 220ms',
  },
  card: {
    flex: 1,
    position: 'relative' as const,
    borderRadius: 16,
    padding: '26px 24px 22px',
    display: 'flex',
    flexDirection: 'column' as const,
    cursor: 'grab',
    minHeight: 0,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.22)',
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
    justifyContent: 'space-around',
    gap: 8,
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
    background: 'color-mix(in srgb, var(--mantle) 70%, transparent)',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  bottomNav: {
    display: 'flex',
    height: 60,
    background: 'var(--mantle)',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
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
