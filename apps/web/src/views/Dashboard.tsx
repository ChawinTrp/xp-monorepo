import { useNodes } from '../lib/hooks';
import { Icons, ProgressBar, Avatar, RingGauge, Button } from '../components/ui';
import NodeCard from '../components/NodeCard';

interface DashboardProps {
  onOpen: (id: string) => void;
  onNavigate: (v: string) => void;
  onCreate?: () => void;
}

export default function Dashboard({ onOpen, onNavigate, onCreate }: DashboardProps) {
  const { byType, breadcrumb } = useNodes();
  const tasks = byType('TASK');
  const routines = byType('ROUTINE');
  const allSkills = byType('SKILL');

  const overdue = tasks.filter((t) => {
    const m = t.metadata as any;
    if (!m?.due || t.status === 'DONE') return false;
    return new Date(m.due) < new Date();
  });
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS');
  const done = tasks.filter((t) => t.status === 'DONE');
  const skills = allSkills.slice(0, 3);
  const people = byType('PERSON');

  // Computed stats
  const longestStreak = routines.reduce((max, r) => Math.max(max, (r.metadata as any)?.streak ?? 0), 0);

  const dailyRoutines = routines.filter(r => (r.metadata as any)?.cadence === 'daily');
  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyDoneToday = dailyRoutines.filter(r => (r.metadata as any)?.lastCheckInDate === todayStr).length;

  const totalSkillHours = allSkills.reduce((sum, s) => sum + ((s.metadata as any)?.totalHours ?? 0), 0);

  const weekTasks = tasks.filter(t => t.status !== 'DONE');
  const weekDone = done.length;

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="fade-in" style={{ padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1320, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="font-bold m-0" style={{ fontSize: 'clamp(20px, 4vw, 28px)', letterSpacing: -0.4 }}>Good morning, CT</h1>
          <div className="mono text-ctp-subtext1 mt-1.5" style={{ fontSize: 12 }}>{dateLabel}</div>
        </div>
        <Button icon={<Icons.Plus size={14} />} onClick={onCreate}>Quick capture</Button>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }} className="mb-6">
        <StatCard icon={<Icons.Flame size={20} color="var(--mantle)" strokeWidth={2.4} />}
          iconBg="linear-gradient(135deg, var(--orange), var(--red))"
          label="Streak" value={String(longestStreak)} suffix="days" />
        <StatCard icon={<RingGauge pct={dailyRoutines.length ? Math.round(dailyDoneToday / dailyRoutines.length * 100) : 0} color="var(--c-routine)" size={44} stroke={5} />}
          label="Routines today" value={String(dailyDoneToday)} suffix={`/ ${dailyRoutines.length}`} />
        <StatCard icon={<RingGauge pct={tasks.length ? Math.round(weekDone / tasks.length * 100) : 0} color="var(--accent)" size={44} stroke={5} />}
          label="Tasks done" value={String(weekDone)} suffix={`/ ${tasks.length}`} />
        <StatCard icon={<Icons.Zap size={20} color="var(--c-skill)" strokeWidth={2.2} />}
          iconBg="color-mix(in srgb, var(--c-skill) 20%, transparent)"
          iconBorder="1px solid color-mix(in srgb, var(--c-skill) 30%, transparent)"
          label="Total hours" value={String(Math.round(totalSkillHours))} suffix="h" />
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }} className="mb-6">
        <Panel icon={<Icons.CheckSquare size={14} color="var(--c-task)" />} title="Tasks"
          accentColor="var(--c-task)" rightLabel={`${overdue.length + inProgress.length} active`}
          onMore={() => onNavigate('kanban')}>
          <SubSection title="Overdue" count={overdue.length} accent="var(--red)">
            {overdue.length === 0 && <EmptyHint>No overdue tasks. Nice.</EmptyHint>}
            {overdue.map((t) => (
              <NodeCard key={t._id} node={t} onOpen={onOpen} breadcrumb={breadcrumb(t._id).map(c => c.title).join(' / ')} />
            ))}
          </SubSection>
          <SubSection title="In progress" count={inProgress.length} accent="var(--blue)">
            {inProgress.map((t) => (
              <NodeCard key={t._id} node={t} onOpen={onOpen} breadcrumb={breadcrumb(t._id).map(c => c.title).join(' / ')} />
            ))}
          </SubSection>
          <SubSection title="Recent completions" count={done.length} accent="var(--green)">
            {done.slice(0, 3).map((t) => (
              <CompletionRow key={t._id} task={t} onClick={() => onOpen(t._id)} />
            ))}
          </SubSection>
        </Panel>

        <Panel icon={<Icons.Zap size={14} color="var(--c-skill)" />} title="Skill summary"
          accentColor="var(--c-skill)" onMore={() => onNavigate('skills')}>
          {skills.map((s) => {
            const m = s.metadata as any;
            const tier = (m?.level ?? 'unfamiliar') as string;
            const totalH = (m?.totalHours ?? 0) as number;
            return (
              <div key={s._id} onClick={() => onOpen(s._id)} className="cursor-pointer">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <Icons.Zap size={12} color="var(--c-skill)" />
                  <span className="flex-1 font-semibold" style={{ fontSize: 13 }}>{s.title}</span>
                  <span className="capitalize font-bold text-ctp-green" style={{ fontSize: 11 }}>
                    {tier.replace('_', ' ')}
                  </span>
                  <span className="mono text-ctp-subtext1 min-w-[48px] text-right" style={{ fontSize: 11 }}>
                    {totalH}h
                  </span>
                </div>
                <ProgressBar value={dashboardMasteryPct(totalH)} color="var(--c-skill)" height={6} />
              </div>
            );
          })}
        </Panel>
      </div>

      {/* Catch-ups */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <Panel icon={<Icons.Users size={14} color="var(--c-person)" />} title="Upcoming catch-ups"
          accentColor="var(--c-person)" onMore={() => onNavigate('people')}>
          {people
            .filter((p) => (p.metadata as any)?.nextCatchup)
            .sort((a, b) => new Date((a.metadata as any).nextCatchup).getTime() - new Date((b.metadata as any).nextCatchup).getTime())
            .slice(0, 5)
            .map((p) => {
              const m = p.metadata as any;
              return (
                <div key={p._id} onClick={() => onOpen(p._id)} className="flex items-center gap-2.5 p-2 rounded-md cursor-pointer">
                  <Avatar initials={m?.initials ?? '??'} size={28} />
                  <span className="flex-1" style={{ fontSize: 13 }}>{p.title}</span>
                  <span className="text-ctp-subtext1" style={{ fontSize: 11 }}>{m?.role}</span>
                  <span
                    className="min-w-[90px] text-right"
                    style={{
                      fontSize: 11,
                      color: m?.catchupState === 'overdue' ? 'var(--red)' : 'var(--green)',
                      fontWeight: m?.catchupState === 'overdue' ? 600 : 500,
                    }}
                  >
                    {m?.relativeDate}
                  </span>
                </div>
              );
            })}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ icon, title, accentColor, rightLabel, onMore, children }: {
  icon: React.ReactNode; title: string; accentColor: string; rightLabel?: string;
  onMore?: () => void; children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl" style={{
      background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 18,
    }}>
      <header className="flex items-center gap-2.5 pb-3" style={{ borderBottom: '1px solid var(--surface1)' }}>
        <div className="w-6 h-6 rounded-md grid place-items-center"
          style={{ background: `color-mix(in srgb, ${accentColor} 16%, var(--mantle))` }}>{icon}</div>
        <h2 className="m-0 font-bold text-ctp-text" style={{ fontSize: 14 }}>{title}</h2>
        <span className="mono text-ctp-subtext1 ml-auto" style={{ fontSize: 11 }}>{rightLabel}</span>
        {onMore && (
          <button onClick={onMore} className="bg-transparent border-none text-ctp-accent font-semibold cursor-pointer inline-flex items-center gap-1"
            style={{ fontSize: 11, fontFamily: 'inherit' }}>
            View all <Icons.ArrowRight size={11} />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

function SubSection({ title, count, accent, children }: {
  title: string; count: number; accent: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded" style={{ width: 3, height: 11, background: accent }} />
        <span className="font-bold uppercase text-ctp-subtext0" style={{ fontSize: 10, letterSpacing: 0.8 }}>{title}</span>
        <span className="mono text-ctp-overlay1" style={{ fontSize: 10 }}>{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md italic" style={{
      padding: '12px 14px', fontSize: 12, color: 'var(--overlay1)', background: 'var(--mantle)',
    }}>
      {children}
    </div>
  );
}

function CompletionRow({ task, onClick }: { task: any; onClick: () => void }) {
  const m = task.metadata as any;
  return (
    <div onClick={onClick} className="flex items-center gap-2.5 p-1.5 rounded-md cursor-pointer hover:bg-ctp-mantle">
      <Icons.CheckCircle size={13} color="var(--green)" />
      <span className="flex-1 text-ctp-subtext0 line-through" style={{ fontSize: 12 }}>{task.title}</span>
      {m?.creditedHours != null && (
        <span className="text-ctp-green font-semibold rounded" style={{
          fontSize: 10, background: 'color-mix(in srgb, var(--c-skill) 14%, transparent)', padding: '1px 5px',
        }}>+{m.creditedHours}h</span>
      )}
      {m?.completedAt && <span className="mono text-ctp-overlay1 min-w-[60px] text-right" style={{ fontSize: 10 }}>{m.completedAt}</span>}
    </div>
  );
}

function StatCard({ icon, iconBg, iconBorder, label, value, suffix, extra }: {
  icon: React.ReactNode; iconBg?: string; iconBorder?: string;
  label: string; value: string; suffix?: string; extra?: string;
}) {
  const isRing = !iconBg;
  return (
    <div className="flex items-center gap-3 p-4 rounded-[10px]" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)' }}>
      {isRing ? icon : (
        <div className="grid place-items-center" style={{
          width: 44, height: 44, borderRadius: 10,
          background: iconBg, border: iconBorder,
          boxShadow: iconBg?.includes('gradient') ? '0 4px 14px color-mix(in srgb, var(--orange) 40%, transparent)' : 'none',
        }}>
          {icon}
        </div>
      )}
      <div>
        <div className="uppercase text-ctp-subtext1 mb-0.5" style={{ fontSize: 10, letterSpacing: 0.6 }}>{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-ctp-text">{value}</span>
          {suffix && <span className="text-sm text-ctp-overlay1">{suffix}</span>}
        </div>
        {extra && (
          <div className="inline-flex items-center gap-1 mt-0.5" style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>
            <Icons.ArrowUp size={9} color="var(--green)" /> {extra}
          </div>
        )}
      </div>
    </div>
  );
}

const MASTERY_BREAKS = [0, 20, 300, 1000, 10000];
function dashboardMasteryPct(totalHours: number): number {
  let low = 0, high = MASTERY_BREAKS[MASTERY_BREAKS.length - 1];
  for (let i = 0; i < MASTERY_BREAKS.length - 1; i++) {
    if (totalHours >= MASTERY_BREAKS[i] && totalHours < MASTERY_BREAKS[i + 1]) {
      low = MASTERY_BREAKS[i];
      high = MASTERY_BREAKS[i + 1];
      break;
    }
  }
  if (totalHours >= high) return 100;
  return Math.round(((totalHours - low) / (high - low)) * 100);
}
