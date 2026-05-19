import { useNodes } from '../lib/hooks';
import { Icons, ProgressBar, LevelBadge, Avatar, RingGauge, Button } from '../components/ui';
import NodeCard from '../components/NodeCard';

interface DashboardProps {
  onOpen: (id: string) => void;
  onNavigate: (v: string) => void;
}

export default function Dashboard({ onOpen, onNavigate }: DashboardProps) {
  const { byType, breadcrumb } = useNodes();
  const tasks = byType('TASK');

  const overdue = tasks.filter((t) => (t.metadata as any)?.overdue);
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS');
  const done = tasks.filter((t) => t.status === 'DONE');
  const skills = byType('SKILL').slice(0, 3);
  const people = byType('PERSON');

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1320, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold m-0" style={{ letterSpacing: -0.4 }}>Good morning, CT</h1>
          <div className="mono text-ctp-subtext1 mt-1.5" style={{ fontSize: 12 }}>{dateLabel}</div>
        </div>
        <Button icon={<Icons.Plus size={14} />} onClick={() => onNavigate('kanban')}>Quick capture</Button>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        <StatCard icon={<Icons.Flame size={20} color="var(--mantle)" strokeWidth={2.4} />}
          iconBg="linear-gradient(135deg, var(--orange), var(--red))"
          label="Streak" value="14" suffix="days" />
        <StatCard icon={<RingGauge pct={80} color="var(--c-routine)" size={44} stroke={5} />}
          label="Routines today" value="4" suffix="/ 5" />
        <StatCard icon={<RingGauge pct={53} color="var(--accent)" size={44} stroke={5} />}
          label="Tasks this week" value="8" suffix="/ 15" />
        <StatCard icon={<Icons.Zap size={20} color="var(--c-skill)" strokeWidth={2.2} />}
          iconBg="color-mix(in srgb, var(--c-skill) 20%, transparent)"
          iconBorder="1px solid color-mix(in srgb, var(--c-skill) 30%, transparent)"
          label="XP this week" value="340" extra="+50 today" />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-5 mb-6">
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
            return (
              <div key={s._id} onClick={() => onOpen(s._id)} className="cursor-pointer">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <Icons.Zap size={12} color="var(--c-skill)" />
                  <span className="flex-1 font-semibold" style={{ fontSize: 13 }}>{s.title}</span>
                  <LevelBadge level={m?.level ?? 0} />
                  <span className="mono text-ctp-subtext1 min-w-[64px] text-right" style={{ fontSize: 11 }}>
                    {m?.xp ?? 0}/{m?.xpToNext ?? 500}
                  </span>
                </div>
                <ProgressBar value={((m?.xp ?? 0) / (m?.xpToNext ?? 500)) * 100} color="var(--c-skill)" height={6} />
              </div>
            );
          })}
        </Panel>
      </div>

      {/* Catch-ups */}
      <div className="grid grid-cols-2 gap-5">
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
      {m?.xpAwarded != null && (
        <span className="text-ctp-green font-semibold rounded" style={{
          fontSize: 10, background: 'color-mix(in srgb, var(--c-skill) 14%, transparent)', padding: '1px 5px',
        }}>+{m.xpAwarded} XP</span>
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
