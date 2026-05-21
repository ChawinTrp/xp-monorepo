import { useState, useMemo } from 'react';
import { useNodes } from '../lib/hooks';
import { Icons, ProgressBar } from '../components/ui';

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

  const totalHours = skills.reduce((s, k) => s + ((k.metadata as any)?.totalHours ?? 0), 0);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="fade-in" style={{ padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1100, margin: '0 auto' }}>
      <div className="mb-6">
        <h1 className="font-bold m-0" style={{ fontSize: 'clamp(20px, 4vw, 28px)', letterSpacing: -0.4 }}>Skills</h1>
        <div className="flex gap-4 mt-3 flex-wrap">
          <Stat label="Skills" value={String(skills.length)} />
          <Stat label="Total hours" value={`${totalHours.toLocaleString()}h`} mono />
        </div>
      </div>

      {Object.entries(grouped).map(([group, gskills]) => {
        const groupHours = gskills.reduce((s, k) => s + ((k.metadata as any)?.totalHours ?? 0), 0);
        return (
          <div key={group} className="mb-8">
            <div className="flex items-baseline gap-3 mb-3.5">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: 'var(--c-domain)' }} />
                <h2 className="m-0 font-semibold uppercase text-ctp-subtext0" style={{ fontSize: 14, letterSpacing: 0.8 }}>{group}</h2>
              </div>
              <span className="mono text-ctp-overlay1" style={{ fontSize: 11 }}>total: {groupHours.toLocaleString()}h</span>
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

const TIER_LABELS: Record<string, string> = {
  unfamiliar: 'Unfamiliar', familiar: 'Familiar', skilled: 'Skilled',
  master: 'Master', world_class: 'World Class',
};
const TIER_COLORS: Record<string, string> = {
  unfamiliar: 'var(--overlay0)', familiar: 'var(--blue)', skilled: 'var(--green)',
  master: 'var(--accent)', world_class: 'var(--yellow)',
};
const BREAKS = [0, 20, 300, 1000, 10000];

function skillMasteryPct(totalHours: number): number {
  let low = 0, high = BREAKS[BREAKS.length - 1];
  for (let i = 0; i < BREAKS.length - 1; i++) {
    if (totalHours >= BREAKS[i] && totalHours < BREAKS[i + 1]) {
      low = BREAKS[i]; high = BREAKS[i + 1]; break;
    }
  }
  if (totalHours >= high) return 100;
  return Math.round(((totalHours - low) / (high - low)) * 100);
}

function SkillCard({ skill, expanded, onToggle }: {
  skill: any; expanded: boolean; onToggle: () => void; onOpen: (id: string) => void;
}) {
  const m = skill.metadata as any ?? {};
  const tier = (m.level ?? 'unfamiliar') as string;
  const totalH = (m.totalHours ?? 0) as number;
  const pct = skillMasteryPct(totalH);
  const tierColor = TIER_COLORS[tier] ?? 'var(--overlay0)';

  return (
    <div
      onClick={onToggle}
      className="rounded-[10px] cursor-pointer transition-all duration-200"
      style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 'clamp(12px, 2vw, 18px)' }}
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
            <span className="font-bold uppercase rounded" style={{
              fontSize: 10, letterSpacing: 0.5, padding: '2px 7px', color: tierColor,
              background: `color-mix(in srgb, ${tierColor} 16%, transparent)`,
              border: `1px solid color-mix(in srgb, ${tierColor} 35%, transparent)`,
            }}>{TIER_LABELS[tier] ?? tier}</span>
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="mono font-bold text-ctp-text" style={{ fontSize: 13 }}>{totalH}h</span>
          <Icons.ChevronDown size={16} color="var(--overlay1)" className="transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-1.5" style={{ flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 120px', minWidth: 0 }}>
          <ProgressBar value={pct} color="var(--c-skill)" height={8} />
        </div>
        <span className="mono text-ctp-subtext0" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {pct}% to next tier
        </span>
      </div>

      {expanded && (
        <div onClick={(e) => e.stopPropagation()} className="fade-in mt-4 pt-4 flex flex-col gap-2.5"
          style={{ borderTop: '1px solid var(--surface1)' }}>
          <div className="uppercase text-ctp-subtext1 mb-1" style={{ fontSize: 11, letterSpacing: 0.6 }}>
            Mastery details
          </div>
          <div className="rounded-md flex items-center gap-2 p-2.5" style={{ background: 'var(--mantle)' }}>
            <Icons.Target size={12} color="var(--accent)" />
            <span className="text-ctp-subtext0" style={{ fontSize: 12 }}>
              {m.hoursToNext != null ? `${Math.round(m.hoursToNext)}h to ${TIER_LABELS[nextTier(tier)] ?? 'next tier'}` : 'Max tier reached'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function nextTier(current: string): string {
  const order = ['unfamiliar', 'familiar', 'skilled', 'master', 'world_class'];
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : current;
}
