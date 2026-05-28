import { useState, useMemo, useEffect, useRef } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { Icons, RingGauge, Dropdown, Button, useToast } from '../components/ui';
import { CHECK_IN_ROUTINE, UNDO_CHECK_IN_ROUTINE, START_TIMER, STOP_TIMER, GET_NODES } from '../lib/graphql';

interface RoutinesProps {
  onOpen: (id: string) => void;
  onCreate?: () => void;
}

// ── Date helpers ──
function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const TODAY_STR = localDateStr();
function last30Dates(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(localDateStr(d));
  }
  return out;
}
function consistency30(checkInDates?: string[]): number {
  if (!checkInDates?.length) return 0;
  const set = new Set(checkInDates);
  const window = last30Dates();
  const hit = window.filter(d => set.has(d)).length;
  return hit / window.length;
}
function isCheckedToday(checkInDates?: string[]): boolean {
  return !!checkInDates?.includes(TODAY_STR);
}
function isTimerRunning(meta: any): boolean {
  const entries = meta?.timeEntries as { start: string; end?: string }[] | undefined;
  return !!entries?.some(e => !e.end);
}

export default function Routines({ onOpen, onCreate }: RoutinesProps) {
  const { byType, byId } = useNodes();
  const { toast } = useToast();
  const [checkInRoutine] = useMutation(CHECK_IN_ROUTINE, { refetchQueries: [{ query: GET_NODES }] });
  const [undoCheckIn] = useMutation(UNDO_CHECK_IN_ROUTINE, { refetchQueries: [{ query: GET_NODES }] });
  const [startTimerMut] = useMutation(START_TIMER, { refetchQueries: [{ query: GET_NODES }] });
  const [stopTimerMut] = useMutation(STOP_TIMER, { refetchQueries: [{ query: GET_NODES }] });
  const routines = byType('ROUTINE');

  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedCadence, setSelectedCadence] = useState('all');

  const groups = useMemo(() => Array.from(new Set(routines.map((r) => (r.metadata as any)?.group).filter(Boolean))), [routines]);

  const filtered = routines.filter((r) => {
    const m = r.metadata as any;
    return (selectedGroup === 'all' || m?.group === selectedGroup) &&
           (selectedCadence === 'all' || m?.cadence === selectedCadence);
  });

  const overallPct = routines.length ? Math.round(
    routines.reduce((s, r) => s + consistency30((r.metadata as any)?.checkInDates), 0) / routines.length * 100
  ) : 0;

  const longestStreak = routines.reduce((m, r) => Math.max(m, (r.metadata as any)?.streak ?? 0), 0);

  const handleCheckIn = async (routineId: string) => {
    // If already checked in today, undo instead
    const routineNode = byId[routineId];
    if (routineNode && isCheckedToday((routineNode.metadata as any)?.checkInDates)) {
      return handleUndo(routineId);
    }
    try {
      const { data } = await checkInRoutine({ variables: { id: routineId } });
      const affectedNodes = data?.checkInRoutine ?? [];
      const routine = affectedNodes.find((n: any) => n._id === routineId);
      const streak = routine?.metadata?.streak ?? 0;
      const skills = affectedNodes.filter((n: any) => n.type === 'SKILL');

      toast({
        message: `Day ${streak}! Keep going`,
        variant: 'success',
        details: skills.length > 0
          ? skills.map((s: any) => `+${routine?.metadata?.creditedHours ?? 0}h ${s.title}`).join(', ')
          : undefined,
      });
    } catch (err: any) {
      toast({ message: 'Check-in failed', variant: 'error', details: err.message });
    }
  };

  const handleUndo = async (routineId: string) => {
    try {
      const { data } = await undoCheckIn({ variables: { id: routineId } });
      const affectedNodes = data?.undoCheckInRoutine ?? [];
      const routine = affectedNodes.find((n: any) => n._id === routineId);
      toast({
        message: 'Check-in undone',
        variant: 'info',
        details: `Streak is now ${routine?.metadata?.streak ?? 0}`,
      });
    } catch (err: any) {
      toast({ message: 'Undo failed', variant: 'error', details: err.message });
    }
  };

  const handleStartTimer = async (routineId: string) => {
    try {
      await startTimerMut({ variables: { id: routineId } });
      toast({ message: 'Timer started', variant: 'info' });
    } catch (err: any) {
      toast({ message: 'Failed to start timer', variant: 'error', details: err.message });
    }
  };

  const handleStopTimer = async (routineId: string) => {
    try {
      const { data } = await stopTimerMut({ variables: { id: routineId } });
      const meta = data?.stopTaskTimer?.metadata as any;
      const credited = meta?.creditedHours;
      const doneToday = isCheckedToday(meta?.checkInDates);
      toast({
        message: doneToday ? 'Checked in for today' : 'Timer stopped',
        variant: 'success',
        details: credited != null && credited > 0 ? `${credited}h tracked` : undefined,
      });
    } catch (err: any) {
      toast({ message: 'Failed to stop timer', variant: 'error', details: err.message });
    }
  };

  return (
    <div className="fade-in" style={{ padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1280, margin: '0 auto' }}>
      <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="font-bold m-0" style={{ fontSize: 'clamp(20px, 4vw, 28px)', letterSpacing: -0.4 }}>Routines</h1>
          <div className="mono text-ctp-subtext1 mt-1.5" style={{ fontSize: 12 }}>Last 30 days · consistency tracking</div>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <Dropdown value={selectedCadence} onChange={setSelectedCadence} options={[
            { value: 'all', label: 'All cadences' },
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
          ]} />
          <Dropdown value={selectedGroup} onChange={setSelectedGroup} options={[
            { value: 'all', label: 'All groups' },
            ...groups.map((g) => ({ value: g, label: g })),
          ]} />
          <Button icon={<Icons.Plus size={14} />} onClick={onCreate}>New routine</Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-7" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <ConsistencyCard pct={overallPct} routineCount={routines.length} />
        <BigStat label="Longest streak" value={longestStreak} suffix=" days" color="var(--orange)"
          icon={<Icons.Flame size={20} color="var(--orange)" />} />
        <BigStat label="Routines tracked" value={routines.length} color="var(--c-routine)"
          icon={<Icons.Repeat size={20} color="var(--c-routine)" />}
          sub={`${routines.filter(r => (r.metadata as any)?.cadence === 'daily').length} daily · ${routines.filter(r => (r.metadata as any)?.cadence === 'weekly').length} weekly`} />
        <BigStat label="Today" value={routines.filter(r => (r.metadata as any)?.cadence === 'daily' && isCheckedToday((r.metadata as any)?.checkInDates)).length}
          suffix={` / ${routines.filter(r => (r.metadata as any)?.cadence === 'daily').length}`}
          color="var(--accent)" icon={<Icons.CheckCircle size={20} color="var(--accent)" />}
          sub="daily routines done today" />
      </div>

      {/* Heatmap */}
      <div className="rounded-xl mb-5" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="m-0 font-semibold uppercase text-ctp-subtext0" style={{ fontSize: 14, letterSpacing: 0.8 }}>30-day consistency</h2>
            <div className="text-ctp-subtext1 mt-1" style={{ fontSize: 12 }}>Each cell is a day. Green = done · gray = missed.</div>
          </div>
        </div>
        <HeatmapGrid
          routines={filtered}
          onOpen={onOpen}
          onCheckIn={handleCheckIn}
          onStartTimer={handleStartTimer}
          onStopTimer={handleStopTimer}
        />
      </div>

      {/* Cadence breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {['daily', 'weekly', 'monthly'].map((cadence) => {
          const cadenceRoutines = routines.filter(r => (r.metadata as any)?.cadence === cadence);
          const icons: Record<string, React.ReactNode> = {
            daily: <Icons.Sun size={14} color="var(--yellow)" />,
            weekly: <Icons.CalendarRange size={14} color="var(--blue)" />,
            monthly: <Icons.CalendarDays size={14} color="var(--accent)" />,
          };
          return (
            <div key={cadence} className="rounded-xl" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 16 }}>
              <div className="flex items-center gap-2 mb-3">
                {icons[cadence]}
                <span className="font-semibold uppercase text-ctp-subtext0" style={{ fontSize: 11, letterSpacing: 0.8 }}>
                  {cadence}
                </span>
                <span className="mono text-ctp-overlay1" style={{ fontSize: 11 }}>({cadenceRoutines.length})</span>
              </div>
              <div className="flex flex-col gap-2">
                {cadenceRoutines.map((r) => {
                  const m = r.metadata as any ?? {};
                  return (
                    <div key={r._id} className="flex items-center gap-2.5 rounded-md" style={{ padding: '8px 10px', background: 'var(--mantle)' }}>
                      <span className="flex-1" style={{ fontSize: 13 }}>{r.title}</span>
                      {cadence === 'daily' && (
                        <span className="mono text-ctp-subtext1 min-w-[56px] text-right" style={{ fontSize: 11 }}>
                          {m.thisWeek ?? 0}/{m.weekTarget ?? 7} this wk
                        </span>
                      )}
                      <FlameStreak n={m.streak} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeatmapGrid({ routines, onOpen, onCheckIn, onStartTimer, onStopTimer }: {
  routines: any[];
  onOpen: (id: string) => void;
  onCheckIn: (id: string) => void;
  onStartTimer: (id: string) => void;
  onStopTimer: (id: string) => void;
}) {
  // Build 30 days of dates ending today
  const days = useMemo(() => {
    const result: Date[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      result.push(d);
    }
    return result;
  }, []);

  // Group days into weeks (Sun=0 start, split on Monday boundaries)
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    let current: Date[] = [];
    for (const d of days) {
      if (current.length > 0 && d.getDay() === 1) {
        // Monday starts a new week
        result.push(current);
        current = [];
      }
      current.push(d);
    }
    if (current.length) result.push(current);
    return result;
  }, [days]);

  const dayAbbr = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const todayStr = TODAY_STR;

  if (routines.length === 0) {
    return <div className="italic text-ctp-overlay1" style={{ fontSize: 12, padding: '12px 0' }}>No routines match the current filters.</div>;
  }

  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <div style={{ display: 'inline-flex', minWidth: '100%' }}>
        {/* Routine name column — sticky LEFT */}
        <div className="flex flex-col shrink-0" style={{
          width: 160,
          position: 'sticky',
          left: 0,
          zIndex: 3,
          background: 'var(--surface0)',
          boxShadow: '4px 0 6px -4px rgba(0,0,0,0.25)',
        }}>
          {/* Header spacer — two rows: day abbr + date number */}
          <div style={{ height: 38 }} />
          {routines.map((r) => (
            <div key={r._id} className="flex items-center gap-1.5 truncate" style={{ height: 36, paddingRight: 8 }}>
              <CadenceDot cadence={(r.metadata as any)?.cadence} />
              <span className="truncate cursor-pointer hover:underline" style={{ fontSize: 12 }} onClick={() => onOpen(r._id)}>{r.title}</span>
            </div>
          ))}
        </div>

        {/* Week groups */}
        <div className="flex gap-3 flex-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col">
              {/* Day abbreviations row */}
              <div className="flex">
                {week.map((d, di) => (
                  <div key={di} className="text-center text-ctp-overlay1" style={{ width: 28, fontSize: 9, fontWeight: 600 }}>
                    {dayAbbr[d.getDay()]}
                  </div>
                ))}
              </div>
              {/* Date numbers row */}
              <div className="flex mb-1.5">
                {week.map((d, di) => (
                  <div key={di} className="text-center text-ctp-subtext1 mono" style={{ width: 28, fontSize: 9 }}>
                    {d.getDate()}
                  </div>
                ))}
              </div>
              {/* Routine rows */}
              {routines.map((r) => {
                const m = r.metadata as any ?? {};
                const checkInSet = new Set<string>(m.checkInDates ?? []);
                return (
                  <div key={r._id} className="flex" style={{ height: 36 }}>
                    {week.map((d, di) => {
                      const dateStr = localDateStr(d);
                      const val = checkInSet.has(dateStr);
                      const isToday = dateStr === todayStr;
                      return (
                        <div key={di} className="grid place-items-center" style={{ width: 28, height: 28 }}>
                          <div
                            style={{
                              width: 20, height: 20, borderRadius: 4,
                              background: val ? 'var(--green)' : 'var(--surface1)',
                              opacity: val ? 1 : 0.5,
                              border: isToday ? '2px solid var(--accent)' : 'none',
                              cursor: isToday ? 'pointer' : 'default',
                            }}
                            title={isToday
                              ? (val ? 'Click to undo today’s check-in' : 'Click to check in')
                              : `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${val ? ' ✓' : ''}`}
                            onClick={() => { if (isToday) onCheckIn(r._id); }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right column: actions + stats — sticky RIGHT */}
        <div className="flex flex-col shrink-0" style={{
          width: 160,
          paddingLeft: 12,
          position: 'sticky',
          right: 0,
          zIndex: 3,
          background: 'var(--surface0)',
          boxShadow: '-4px 0 6px -4px rgba(0,0,0,0.25)',
        }}>
          {/* Header spacer */}
          <div style={{ height: 38 }} />
          {routines.map((r) => {
            const m = r.metadata as any ?? {};
            const pct = Math.round(consistency30(m.checkInDates) * 100);
            const doneToday = isCheckedToday(m.checkInDates);
            const timerRunning = isTimerRunning(m);
            return (
              <div key={r._id} className="flex items-center gap-1.5 justify-end" style={{ height: 36 }}>
                {/* Timer button */}
                <button
                  onClick={() => timerRunning ? onStopTimer(r._id) : onStartTimer(r._id)}
                  className={`bg-transparent border-none cursor-pointer grid place-items-center rounded${timerRunning ? ' timer-pulse' : ''}`}
                  style={{
                    width: 22, height: 22,
                    background: timerRunning ? 'var(--red)' : 'var(--surface1)',
                    boxShadow: timerRunning ? '0 0 0 2px color-mix(in srgb, var(--red) 30%, transparent)' : 'none',
                  }}
                  title={timerRunning ? 'Stop timer' : 'Start timer'}
                >
                  {timerRunning
                    ? <Icons.Square size={10} color="var(--mantle)" fill="var(--mantle)" />
                    : <Icons.Play size={10} color="var(--subtext0)" />}
                </button>
                {/* Check-in button (click again to undo today's check-in) */}
                <button
                  onClick={() => onCheckIn(r._id)}
                  className="bg-transparent border-none cursor-pointer grid place-items-center rounded"
                  style={{ width: 22, height: 22, background: doneToday ? 'color-mix(in srgb, var(--green) 25%, transparent)' : 'var(--surface1)' }}
                  title={doneToday ? 'Undo today’s check-in' : 'Check in'}
                >
                  <Icons.CheckCircle size={12} color={doneToday ? 'var(--green)' : 'var(--overlay1)'} />
                </button>
                {/* Percentage */}
                <span className="mono min-w-[32px] text-right" style={{ fontSize: 10, color: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--overlay1)' }}>
                  {pct}%
                </span>
                {/* Streak */}
                <FlameStreak n={m.streak} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CadenceDot({ cadence }: { cadence?: string }) {
  const map: Record<string, string> = { daily: 'var(--yellow)', weekly: 'var(--blue)', monthly: 'var(--accent)' };
  return <span className="rounded-full" style={{ width: 6, height: 6, background: map[cadence ?? ''] ?? 'var(--overlay0)' }} />;
}

function FlameStreak({ n }: { n?: number }) {
  if (!n) return <span className="text-ctp-overlay1 min-w-[36px] text-right" style={{ fontSize: 11 }}>—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-semibold min-w-[36px] justify-end" style={{
      color: n >= 10 ? 'var(--orange)' : 'var(--subtext0)', fontSize: 11,
    }}>
      <Icons.Flame size={11} color={n >= 10 ? 'var(--orange)' : 'var(--overlay1)'} />
      {n}d
    </span>
  );
}

function ConsistencyCard({ pct, routineCount }: { pct: number; routineCount: number }) {
  return (
    <div className="rounded-xl" style={{
      padding: 18,
      background: 'linear-gradient(135deg, color-mix(in srgb, var(--c-routine) 10%, var(--surface0)), var(--surface0))',
      border: '1px solid color-mix(in srgb, var(--c-routine) 25%, var(--surface1))',
    }}>
      <div className="flex items-center gap-3.5">
        <RingGauge pct={pct} color="var(--c-routine)" size={64} stroke={6} />
        <div>
          <div className="uppercase text-ctp-subtext1 mb-0.5" style={{ fontSize: 11, letterSpacing: 0.6 }}>Overall consistency</div>
          <div className="flex items-baseline gap-1">
            <span className="text-[30px] font-bold" style={{ color: 'var(--c-routine)' }}>{pct}</span>
            <span className="text-sm text-ctp-subtext1">%</span>
          </div>
          <div className="text-ctp-subtext1 mt-0.5" style={{ fontSize: 11 }}>across {routineCount} routines · 30d</div>
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, suffix, sub, color, icon }: {
  label: string; value: number; suffix?: string; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-2.5 rounded-xl min-h-[130px]" style={{
      padding: 18, background: 'var(--surface0)', border: '1px solid var(--surface1)',
    }}>
      <div className="flex justify-between items-start">
        <span className="uppercase text-ctp-subtext1" style={{ fontSize: 11, letterSpacing: 0.6 }}>{label}</span>
        {icon}
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-[30px] font-bold" style={{ color }}>{value}</span>
          {suffix && <span className="text-sm text-ctp-subtext1">{suffix}</span>}
        </div>
        {sub && <div className="text-ctp-subtext1 mt-0.5" style={{ fontSize: 11 }}>{sub}</div>}
      </div>
    </div>
  );
}
