import { useState, useMemo } from 'react';
import { useNodes } from '../lib/hooks';
import { Icons, RingGauge, Dropdown, Button } from '../components/ui';

interface RoutinesProps {
  onOpen: (id: string) => void;
}

export default function Routines({ onOpen }: RoutinesProps) {
  const { byType } = useNodes();
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
    routines.reduce((s, r) => {
      const h = (r.metadata as any)?.history ?? [];
      return s + (h.length ? h.reduce((a: number, b: number) => a + b, 0) / h.length : 0);
    }, 0) / routines.length * 100
  ) : 0;

  const longestStreak = routines.reduce((m, r) => Math.max(m, (r.metadata as any)?.streak ?? 0), 0);

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold m-0" style={{ letterSpacing: -0.4 }}>Routines</h1>
          <div className="mono text-ctp-subtext1 mt-1.5" style={{ fontSize: 12 }}>Last 30 days · consistency tracking</div>
        </div>
        <div className="flex gap-2.5">
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
          <Button icon={<Icons.Plus size={14} />}>New routine</Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3.5 mb-7" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
        <ConsistencyCard pct={overallPct} routineCount={routines.length} />
        <BigStat label="Longest streak" value={longestStreak} suffix=" days" color="var(--orange)"
          icon={<Icons.Flame size={20} color="var(--orange)" />} />
        <BigStat label="Routines tracked" value={routines.length} color="var(--c-routine)"
          icon={<Icons.Repeat size={20} color="var(--c-routine)" />}
          sub={`${routines.filter(r => (r.metadata as any)?.cadence === 'daily').length} daily · ${routines.filter(r => (r.metadata as any)?.cadence === 'weekly').length} weekly`} />
        <BigStat label="Today" value={routines.filter(r => (r.metadata as any)?.cadence === 'daily' && (r.metadata as any)?.history?.[29]).length}
          suffix={` / ${routines.filter(r => (r.metadata as any)?.cadence === 'daily').length}`}
          color="var(--accent)" icon={<Icons.CheckCircle size={20} color="var(--accent)" />}
          sub="daily routines done today" />
      </div>

      {/* Heatmap placeholder */}
      <div className="rounded-xl mb-5" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="m-0 font-semibold uppercase text-ctp-subtext0" style={{ fontSize: 14, letterSpacing: 0.8 }}>30-day consistency</h2>
            <div className="text-ctp-subtext1 mt-1" style={{ fontSize: 12 }}>Each cell is a day. Green = done · gray = missed.</div>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {filtered.map((r) => {
            const m = r.metadata as any ?? {};
            const history = m.history ?? [];
            const pct = history.length ? Math.round(history.reduce((a: number, b: number) => a + b, 0) / history.length * 100) : 0;
            return (
              <div key={r._id} className="flex items-center gap-3">
                <CadenceDot cadence={m.cadence} />
                <span onClick={() => onOpen(r._id)} className="cursor-pointer min-w-[140px] whitespace-nowrap text-ctp-subtext0" style={{ fontSize: 12 }}>
                  {r.title}
                </span>
                <div className="flex gap-[3px] flex-1">
                  {history.map((v: number, i: number) => (
                    <div key={i} className="rounded-sm cursor-pointer transition-transform duration-100 hover:scale-110" style={{
                      width: 18, height: 18,
                      background: v ? 'color-mix(in srgb, var(--c-routine) 75%, var(--mantle))' : 'var(--surface1)',
                      border: i === history.length - 1 ? '1.5px solid var(--accent)' : 'none',
                    }} />
                  ))}
                </div>
                <span className="mono text-ctp-subtext0 min-w-[30px] text-right" style={{ fontSize: 11 }}>{pct}%</span>
                <FlameStreak n={m.streak} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Cadence breakdowns */}
      <div className="grid grid-cols-3 gap-3.5">
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
