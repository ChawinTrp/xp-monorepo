import { useQuery } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { Icons, ProgressBar, Avatar, RingGauge, Button, GlassPanel } from '../components/ui';
import NodeCard from '../components/NodeCard';
import { WEEK_PROGRESS } from '../lib/graphql';
import { isOverdue, isCheckedOn, getPersonCatchup } from '../lib/queue';
import { logicalDateStr, parseLocalDate, getWeekStart } from '@xp/shared';

function WinTheWeekWidget() {
  const { data, loading } = useQuery(WEEK_PROGRESS);
  const today = logicalDateStr();

  if (loading || !data?.weekProgress) return null;

  const { days, wonDays, weekTarget, weekWon, weekWinStreak } = data.weekProgress;
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <GlassPanel className="fade-in" elevation="e2" style={{ padding: 16, animationDelay: '180ms' }}>
      <div className="flex items-center gap-3">
        <div style={{ flex: 1 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide opacity-60">Win the Week</span>
              {weekWinStreak > 1 && (
                <span className="inline-flex items-center gap-0.5 rounded-full font-bold streak-fire" style={{
                  fontSize: 10, padding: '1px 7px', color: 'var(--orange)',
                  background: 'color-mix(in srgb, var(--orange) 16%, transparent)',
                }} title={`${weekWinStreak} weeks won in a row`}>🔥 {weekWinStreak}w</span>
              )}
            </span>
            <span className="text-sm font-bold">
              {wonDays} / {weekTarget}
              {weekWon && <span className="ml-2">🎉</span>}
            </span>
          </div>
          <div className="flex gap-1 justify-between mb-2">
            {days.map((day: any, i: number) => {
              const isFuture = day.date > today;
              const pip = isFuture ? '·' : day.won ? '●' : '○';
              const pipColor = isFuture ? 'var(--overlay1)' : day.won ? 'var(--green)' : 'var(--red)';
              return (
                <div key={day.date} className="flex flex-col items-center gap-1" title={`${DAY_LABELS[i]} — ${day.routinesCheckedIn}/${day.routineTarget} routines, ${day.tasksCompleted} task${day.tasksCompleted !== 1 ? 's' : ''}`}>
                  <span className="text-lg leading-none" style={{ color: pipColor, opacity: isFuture ? 0.3 : 1 }}>{pip}</span>
                  <span className="text-xs opacity-50">{DAY_LABELS[i]}</span>
                </div>
              );
            })}
          </div>
          {!weekWon && (
            <p className="text-xs opacity-50 mt-1">
              Need {weekTarget - wonDays} more · {days.filter((d: any) => d.date >= today).length} days left
            </p>
          )}
          {weekWon && (
            <p className="text-xs mt-1" style={{ color: 'var(--green)' }}>Week won — bank the rest!</p>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

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

  const todayStr = logicalDateStr();
  // Date-string compare (lib/queue.isOverdue): `new Date(due) < new Date()`
  // would mis-flag a due-today task as overdue for most of the day in UTC+7.
  const overdue = tasks.filter((t) => t.status !== 'DONE' && isOverdue(t, todayStr));
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS');
  const done = tasks.filter((t) => t.status === 'DONE');
  const skills = allSkills.slice(0, 3);
  const people = byType('PERSON');

  // Computed stats
  const longestStreak = routines.reduce((max, r) => Math.max(max, (r.metadata as any)?.streak ?? 0), 0);

  const dailyRoutines = routines.filter(r => (r.metadata as any)?.cadence === 'daily');
  // checkIns array, not lastCheckInDate — the latter goes stale after undo-check-in.
  const dailyDoneToday = dailyRoutines.filter(r => isCheckedOn(r.metadata, todayStr)).length;

  const totalSkillHours = allSkills.reduce((sum, s) => sum + ((s.metadata as any)?.totalHours ?? 0), 0);

  const weekStart = getWeekStart(todayStr);
  const weekDone = done.filter(t => {
    const m = t.metadata as any;
    // Prefer the local completedDate; fall back to legacy UTC completedAt.
    const completedDate = m?.completedDate ?? (m?.completedAt ? m.completedAt.slice(0, 10) : null);
    return completedDate && completedDate >= weekStart;
  }).length;

  // Header date follows the logical day so it agrees with the streak/win pips
  // (before 5am it still reads as the previous day).
  const today = parseLocalDate(todayStr);
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1320, margin: '0 auto' }}>
      {/* Hero header — slot left for an optional future ambient backdrop */}
      <div className="relative fade-in mb-6" style={{ animationDelay: '0ms' }}>
        {/* ambient-backdrop-slot: reserved for a future low-contrast gradient/WebGL layer behind the hero */}
        <div className="relative flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-semibold m-0" style={{ fontSize: 'clamp(28px, 5vw, 40px)', letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--text)' }}>
              Good morning, CT
            </h1>
            <div className="mono mt-2" style={{ fontSize: 12, color: 'var(--subtext1)' }}>{dateLabel}</div>
          </div>
          <Button icon={<Icons.Plus size={14} />} onClick={onCreate}>Quick capture</Button>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }} className="mb-6">
        <StatCard icon={<Icons.Flame size={20} color="var(--mantle)" strokeWidth={2.4} className="streak-fire" />}
          iconBg="linear-gradient(135deg, var(--orange), var(--red))"
          label="Streak" value={String(longestStreak)} suffix="days" delay={0} />
        <StatCard icon={<RingGauge pct={dailyRoutines.length ? Math.round(dailyDoneToday / dailyRoutines.length * 100) : 0} color="var(--c-routine)" size={44} stroke={5} />}
          label="Routines today" value={String(dailyDoneToday)} suffix={`/ ${dailyRoutines.length}`} delay={60} />
        <StatCard icon={<RingGauge pct={done.length ? Math.round(weekDone / done.length * 100) : 0} color="var(--accent)" size={44} stroke={5} />}
          label="Done this week" value={String(weekDone)} suffix={`/ ${done.length}`} delay={120} />
        <StatCard icon={<Icons.Zap size={20} color="var(--c-skill)" strokeWidth={2.2} />}
          iconBg="color-mix(in srgb, var(--c-skill) 20%, transparent)"
          iconBorder="1px solid color-mix(in srgb, var(--c-skill) 30%, transparent)"
          label="Total hours" value={String(Math.round(totalSkillHours))} suffix="h" delay={180} />
      </div>

      {/* Win the Week */}
      <div className="mb-6">
        <WinTheWeekWidget />
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }} className="mb-6">
        <Panel icon={<Icons.CheckSquare size={14} color="var(--c-task)" />} title="Tasks"
          accentColor="var(--c-task)" rightLabel={`${overdue.length + inProgress.length} active`}
          onMore={() => onNavigate('kanban')} delay={240}>
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
          accentColor="var(--c-skill)" onMore={() => onNavigate('skills')} delay={300}>
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
          accentColor="var(--c-person)" onMore={() => onNavigate('people')} delay={360}>
          {people
            .map(p => {
              const catchup = getPersonCatchup(p);
              return { ...p, metadata: { ...(p.metadata as any), ...catchup } };
            })
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

function Panel({ icon, title, accentColor, rightLabel, onMore, children, delay = 0 }: {
  icon: React.ReactNode; title: string; accentColor: string; rightLabel?: string;
  onMore?: () => void; children: React.ReactNode; delay?: number;
}) {
  return (
    <GlassPanel
      className="fade-in transition-transform duration-200 hover:-translate-y-0.5"
      elevation="e2"
      style={{ padding: 18, animationDelay: `${delay}ms` }}
    >
      <section className="flex flex-col gap-4">
        <header className="flex items-center gap-2.5 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-6 h-6 rounded-md grid place-items-center"
            style={{ background: `color-mix(in srgb, ${accentColor} 16%, var(--mantle))` }}>{icon}</div>
          <h2 className="m-0 font-bold" style={{ fontSize: 14, color: 'var(--text)' }}>{title}</h2>
          <span className="mono ml-auto" style={{ fontSize: 11, color: 'var(--subtext1)' }}>{rightLabel}</span>
          {onMore && (
            <button onClick={onMore} className="bg-transparent border-none font-semibold cursor-pointer inline-flex items-center gap-1"
              style={{ fontSize: 11, fontFamily: 'inherit', color: 'var(--accent)' }}>
              View all <Icons.ArrowRight size={11} />
            </button>
          )}
        </header>
        {children}
      </section>
    </GlassPanel>
  );
}

function SubSection({ title, count, accent, children }: {
  title: string; count: number; accent: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded" style={{ width: 3, height: 11, background: accent }} />
        <span className="font-bold uppercase" style={{ fontSize: 10, letterSpacing: 0.8, color: 'var(--subtext0)' }}>{title}</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--overlay1)' }}>{count}</span>
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
    <div onClick={onClick} className="flex items-center gap-2.5 p-1.5 rounded-md cursor-pointer transition-colors duration-150 hover:bg-[var(--surface1)]">
      <Icons.CheckCircle size={13} color="var(--green)" />
      <span className="flex-1 line-through" style={{ fontSize: 12, color: 'var(--subtext0)' }}>{task.title}</span>
      {m?.creditedHours != null && (
        <span className="font-semibold rounded" style={{
          fontSize: 10, color: 'var(--green)', background: 'color-mix(in srgb, var(--c-skill) 14%, transparent)', padding: '1px 5px',
        }}>+{m.creditedHours}h</span>
      )}
      {m?.completedAt && <span className="mono min-w-[60px] text-right" style={{ fontSize: 10, color: 'var(--overlay1)' }}>{m.completedAt}</span>}
    </div>
  );
}

function StatCard({ icon, iconBg, iconBorder, label, value, suffix, extra, delay = 0 }: {
  icon: React.ReactNode; iconBg?: string; iconBorder?: string;
  label: string; value: string; suffix?: string; extra?: string; delay?: number;
}) {
  const isRing = !iconBg;
  return (
    <GlassPanel
      solid
      className="fade-in flex items-center gap-3 transition-transform duration-200 hover:-translate-y-0.5"
      elevation="e2"
      style={{ padding: 16, animationDelay: `${delay}ms` }}
    >
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
        <div className="uppercase mb-0.5" style={{ fontSize: 10, letterSpacing: 0.6, color: 'var(--subtext1)' }}>{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</span>
          {suffix && <span className="text-sm" style={{ color: 'var(--overlay1)' }}>{suffix}</span>}
        </div>
        {extra && (
          <div className="inline-flex items-center gap-1 mt-0.5" style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>
            <Icons.ArrowUp size={9} color="var(--green)" /> {extra}
          </div>
        )}
      </div>
    </GlassPanel>
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
