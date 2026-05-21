import { useNodes } from '../lib/hooks';
import { Icons, Avatar, Button } from '../components/ui';

interface PeopleProps {
  onOpen: (id: string) => void;
}

const GROUP_META = [
  { name: 'Family', color: 'var(--c-person)', Icon: Icons.User },
  { name: 'Close Friends', color: 'var(--accent)', Icon: Icons.Sparkles },
  { name: 'Core Team', color: 'var(--orange)', Icon: Icons.Users },
  { name: 'Aura Team', color: 'var(--blue)', Icon: Icons.Users },
  { name: 'Mentors', color: 'var(--yellow)', Icon: Icons.Award },
  { name: 'Network', color: 'var(--c-routine)', Icon: Icons.Network },
];

export default function People({ onOpen }: PeopleProps) {
  const { byType } = useNodes();
  const people = byType('PERSON');

  const byGroup: Record<string, typeof people> = {};
  for (const meta of GROUP_META) byGroup[meta.name] = [];
  for (const p of people) {
    const circle = (p.metadata as any)?.circle ?? 'Network';
    (byGroup[circle] ??= []).push(p);
  }

  const overdue = people.filter((p) => (p.metadata as any)?.catchupState === 'overdue');

  return (
    <div className="fade-in" style={{ padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1280, margin: '0 auto' }}>
      <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="font-bold m-0" style={{ fontSize: 'clamp(20px, 4vw, 28px)', letterSpacing: -0.4 }}>People</h1>
          <div className="flex gap-3.5 mt-2.5 flex-wrap" style={{ fontSize: 12 }}>
            <span className="text-ctp-subtext1">{people.length} contacts</span>
            <span className="text-ctp-subtext1">·</span>
            <span className="text-ctp-subtext1">{GROUP_META.filter(g => byGroup[g.name]?.length).length} circles</span>
            {overdue.length > 0 && <>
              <span className="text-ctp-subtext1">·</span>
              <span className="text-ctp-red">⚠ {overdue.length} overdue catch-up{overdue.length === 1 ? '' : 's'}</span>
            </>}
          </div>
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" icon={<Icons.Plus size={14} />}>New circle</Button>
          <Button icon={<Icons.Plus size={14} />}>Add person</Button>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="flex items-center gap-3.5 flex-wrap mb-6 rounded-[10px]" style={{
          padding: 14,
          background: 'color-mix(in srgb, var(--red) 8%, var(--surface0))',
          border: '1px solid color-mix(in srgb, var(--red) 25%, var(--surface1))',
        }}>
          <div className="flex items-center gap-2 text-ctp-red">
            <Icons.AlertTriangle size={14} color="var(--red)" />
            <span className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: 0.6 }}>Overdue catch-ups</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {overdue.map((p) => {
              const m = p.metadata as any;
              return (
                <button key={p._id} onClick={() => onOpen(p._id)}
                  className="inline-flex items-center gap-2 rounded-full cursor-pointer"
                  style={{
                    padding: '5px 10px 5px 5px',
                    background: 'var(--surface0)',
                    border: '1px solid color-mix(in srgb, var(--red) 30%, var(--surface1))',
                    color: 'var(--text)', fontFamily: 'inherit', fontSize: 12,
                  }}>
                  <Avatar initials={m?.initials ?? '??'} size={22} color="var(--c-person)" />
                  <span className="font-semibold">{p.title}</span>
                  <span className="text-ctp-red" style={{ fontSize: 11 }}>{m?.relativeDate}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-7">
        {GROUP_META.map((meta) => {
          const members = byGroup[meta.name] ?? [];
          if (members.length === 0) return null;
          return (
            <section key={meta.name}>
              <header className="flex items-center gap-3 mb-3.5">
                <div className="grid place-items-center" style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `color-mix(in srgb, ${meta.color} 18%, var(--surface0))`,
                  border: `1px solid color-mix(in srgb, ${meta.color} 30%, var(--surface1))`,
                }}>
                  <meta.Icon size={14} color={meta.color} />
                </div>
                <div className="flex-1">
                  <h2 className="m-0 text-[17px] font-bold text-ctp-text">{meta.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5 text-ctp-subtext1" style={{ fontSize: 11 }}>
                    <span>{members.length} {members.length === 1 ? 'person' : 'people'}</span>
                  </div>
                </div>
              </header>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', paddingLeft: 'clamp(0px, 5vw, 48px)' }}>
                {members.map((p) => <PersonChip key={p._id} person={p} circleColor={meta.color} onOpen={onOpen} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PersonChip({ person, circleColor, onOpen }: { person: any; circleColor: string; onOpen: (id: string) => void }) {
  const m = person.metadata as any ?? {};
  const stateStyle: Record<string, { color: string; bg: string }> = {
    overdue: { color: 'var(--red)', bg: 'color-mix(in srgb, var(--red) 12%, transparent)' },
    upcoming: { color: 'var(--green)', bg: 'color-mix(in srgb, var(--green) 10%, transparent)' },
    none: { color: 'var(--overlay1)', bg: 'transparent' },
  };
  const st = stateStyle[m.catchupState ?? 'none'] ?? stateStyle.none;

  return (
    <button
      onClick={() => onOpen(person._id)}
      className="flex items-center gap-2.5 text-left transition-all duration-200 rounded-[10px] cursor-pointer"
      style={{
        padding: '10px 12px', fontFamily: 'inherit',
        background: 'var(--surface0)', border: '1px solid var(--surface1)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `color-mix(in srgb, ${circleColor} 50%, var(--surface1))`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--surface1)'; e.currentTarget.style.transform = 'none'; }}
    >
      <Avatar initials={m.initials ?? '??'} size={36} color={circleColor} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-ctp-text whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 13 }}>{person.title}</div>
        <div className="text-ctp-subtext1 whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 11 }}>{m.role}</div>
      </div>
      <div className="inline-flex flex-col items-end gap-0.5 rounded" style={{ padding: '3px 7px', background: st.bg }}>
        {m.catchupState !== 'none' ? (
          <>
            <span className="font-semibold uppercase" style={{ fontSize: 9, color: st.color, letterSpacing: 0.4 }}>
              {m.catchupState === 'overdue' ? 'Overdue' : 'Catch-up'}
            </span>
            <span className="mono" style={{ fontSize: 10, color: st.color }}>{m.relativeDate}</span>
          </>
        ) : (
          <Icons.CalendarDays size={12} color="var(--overlay1)" />
        )}
      </div>
    </button>
  );
}
