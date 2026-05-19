import { useState, useMemo } from 'react';
import { useNodes } from '../lib/hooks';
import { Icons, ProgressBar, LevelBadge, Sparkline } from '../components/ui';

interface SkillsProps {
  onOpen: (id: string) => void;
}

export default function Skills({ onOpen }: SkillsProps) {
  const { byType, breadcrumb } = useNodes();
  const skills = byType('SKILL');

  const grouped = useMemo(() => {
    const map: Record<string, typeof skills> = {};
    for (const s of skills) {
      const crumb = breadcrumb(s._id);
      const root = crumb[0];
      const key = root?.title ?? 'Other';
      (map[key] ??= []).push(s);
    }
    return map;
  }, [skills, breadcrumb]);

  const totalXp = skills.reduce((s, k) => s + ((k.metadata as any)?.xp ?? 0), 0);
  const avgLv = skills.length ? (skills.reduce((s, k) => s + ((k.metadata as any)?.level ?? 0), 0) / skills.length).toFixed(1) : '0';

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <div className="mb-6">
        <h1 className="text-[28px] font-bold m-0" style={{ letterSpacing: -0.4 }}>Skills</h1>
        <div className="flex gap-4 mt-3">
          <Stat label="Skills" value={String(skills.length)} />
          <Stat label="Avg level" value={`Lv. ${avgLv}`} />
          <Stat label="Total XP" value={String(totalXp)} mono />
        </div>
      </div>

      {Object.entries(grouped).map(([group, gskills]) => {
        const groupTotal = gskills.reduce((s, k) => s + ((k.metadata as any)?.xp ?? 0), 0);
        return (
          <div key={group} className="mb-8">
            <div className="flex items-baseline gap-3 mb-3.5">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: 'var(--c-domain)' }} />
                <h2 className="m-0 font-semibold uppercase text-ctp-subtext0" style={{ fontSize: 14, letterSpacing: 0.8 }}>{group}</h2>
              </div>
              <span className="mono text-ctp-overlay1" style={{ fontSize: 11 }}>total: {groupTotal.toLocaleString()} XP</span>
            </div>
            <div className="flex flex-col gap-3">
              {gskills.map((s) => (
                <SkillCard
                  key={s._id}
                  skill={s}
                  expanded={!!expanded[s._id]}
                  onToggle={() => setExpanded((cur) => ({ ...cur, [s._id]: !cur[s._id] }))}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[110px] rounded-lg" style={{
      padding: '10px 14px', background: 'var(--surface0)', border: '1px solid var(--surface1)',
    }}>
      <span className="uppercase text-ctp-subtext1" style={{ fontSize: 10, letterSpacing: 0.6 }}>{label}</span>
      <span className={`text-base font-bold text-ctp-text ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}

function SkillCard({ skill, expanded, onToggle }: {
  skill: any; expanded: boolean; onToggle: () => void; onOpen: (id: string) => void;
}) {
  const m = skill.metadata as any ?? {};
  const pct = ((m.xp ?? 0) / (m.xpToNext ?? 500)) * 100;

  return (
    <div
      onClick={onToggle}
      className="rounded-[10px] cursor-pointer transition-all duration-200"
      style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 18 }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--surface2)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--surface1)'}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="grid place-items-center shrink-0" style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'color-mix(in srgb, var(--c-skill) 18%, transparent)',
        }}>
          <Icons.Zap size={18} color="var(--c-skill)" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold">{skill.title}</span>
            <LevelBadge level={m.level ?? 0} />
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <Sparkline data={m.sparkline ?? []} color="var(--green)" width={70} height={20} />
          <span className="text-ctp-green font-semibold" style={{ fontSize: 11 }}>↑{m.weekGain ?? 0} XP/wk</span>
          <Icons.ChevronDown size={16} color="var(--overlay1)" className="transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
        </div>
      </div>

      <div className="flex items-center gap-3.5 mb-1.5">
        <ProgressBar value={pct} color="var(--c-skill)" height={8} />
        <span className="mono text-ctp-subtext0 min-w-[120px] text-right" style={{ fontSize: 12 }}>
          {m.xp ?? 0}/{m.xpToNext ?? 500} XP · {Math.round(pct)}%
        </span>
      </div>

      {expanded && (
        <div onClick={(e) => e.stopPropagation()} className="fade-in mt-4 pt-4 flex flex-col gap-2.5"
          style={{ borderTop: '1px solid var(--surface1)' }}>
          <div className="uppercase text-ctp-subtext1 mb-1" style={{ fontSize: 11, letterSpacing: 0.6 }}>
            Skill details
          </div>
          <div className="rounded-md flex items-center gap-2 p-2.5" style={{ background: 'var(--mantle)' }}>
            <Icons.Target size={12} color="var(--accent)" />
            <span className="text-ctp-subtext0" style={{ fontSize: 12 }}>
              {(m.xpToNext ?? 500) - (m.xp ?? 0)} XP to level {(m.level ?? 0) + 1}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
