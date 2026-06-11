import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { Icons, Avatar, Button, useToast } from '../components/ui';
import CreateNodeModal from '../components/CreateNodeModal';
import { getPersonCatchup } from '../lib/queue';
import { CREATE_NODE, GET_NODES } from '../lib/graphql';
import { circleTagsOf, circleOfPerson, circleColorOf } from '../lib/circles';
import type { XPNode } from '../lib/types';

interface PeopleProps {
  onOpen: (id: string) => void;
}

// Icons for the 6 default circles; any other circle tag falls back to Icons.Network.
const CIRCLE_ICONS: Record<string, typeof Icons.User> = {
  'Family': Icons.User,
  'Close Friends': Icons.Sparkles,
  'Core Team': Icons.Users,
  'Aura Team': Icons.Users,
  'Mentors': Icons.Award,
  'Network': Icons.Network,
};

function iconFor(name: string) {
  return CIRCLE_ICONS[name] ?? Icons.Network;
}

const UNSORTED_KEY = '__unsorted__';

export default function People({ onOpen }: PeopleProps) {
  const { byType } = useNodes();
  const { toast } = useToast();
  const people = byType('PERSON');
  const circleTags = circleTagsOf(byType('TAG'));

  const [createOpen, setCreateOpen] = useState(false);
  const [createCircle, setCreateCircle] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'circle' | 'nextCatchup' | 'lastCatchup'>('circle');

  const [createCircleTag] = useMutation(CREATE_NODE, { refetchQueries: [{ query: GET_NODES }] });

  // One-time cleanup of the stale localStorage key from the pre-TAG empty-circles feature.
  useEffect(() => {
    try { localStorage.removeItem('xp-empty-circles'); } catch { /* ignore */ }
  }, []);

  const addPerson = () => { setCreateCircle(undefined); setCreateOpen(true); };
  const newCircle = async () => {
    const name = window.prompt('Name the new circle')?.trim();
    if (!name) return;
    if (circleTags.some((c) => c.title.toLowerCase() === name.toLowerCase())) {
      toast({ message: 'Circle already exists', variant: 'error', details: name });
      return;
    }
    try {
      await createCircleTag({
        variables: {
          input: {
            title: name,
            type: 'TAG',
            metadata: { kind: 'circle' },
          },
        },
      });
      toast({ message: 'Circle created', variant: 'success', details: name });
    } catch (err: any) {
      toast({ message: 'Failed to create circle', variant: 'error', details: err.message });
    }
  };

  const peopleWithCatchup = people.map(p => {
    const catchup = getPersonCatchup(p);
    return {
      ...p,
      metadata: {
        ...(p.metadata as any),
        ...catchup
      }
    };
  });

  const networkTag = circleTags.find((t) => t.title === 'Network');

  const byGroup: Record<string, typeof peopleWithCatchup> = {};
  for (const tag of circleTags) byGroup[tag._id] = [];
  byGroup[UNSORTED_KEY] = [];
  for (const p of peopleWithCatchup) {
    const circle = circleOfPerson(p as unknown as XPNode, circleTags);
    if (circle) {
      byGroup[circle._id].push(p);
    } else if (networkTag) {
      byGroup[networkTag._id].push(p);
    } else {
      byGroup[UNSORTED_KEY].push(p);
    }
  }

  const overdue = peopleWithCatchup.filter((p) => p.metadata.catchupState === 'overdue');

  const sortedPeople = [...peopleWithCatchup].sort((a, b) => {
    if (sortBy === 'nextCatchup') {
      const da = (a.metadata as any).nextCatchup ?? '9999-12-31';
      const db = (b.metadata as any).nextCatchup ?? '9999-12-31';
      return da.localeCompare(db);
    } else {
      const da = (a.metadata as any).lastCatchup ?? '1970-01-01';
      const db = (b.metadata as any).lastCatchup ?? '1970-01-01';
      return da.localeCompare(db);
    }
  });

  return (
    <div className="fade-in" style={{ padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1280, margin: '0 auto' }}>
      <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="font-bold m-0" style={{ fontSize: 'clamp(20px, 4vw, 28px)', letterSpacing: -0.4 }}>People</h1>
          <div className="flex gap-3.5 mt-2.5 flex-wrap" style={{ fontSize: 12 }}>
            <span className="text-ctp-subtext1">{people.length} contacts</span>
            <span className="text-ctp-subtext1">·</span>
            <span className="text-ctp-subtext1">{circleTags.length} circles</span>
            {overdue.length > 0 && <>
              <span className="text-ctp-subtext1">·</span>
              <span className="text-ctp-red">⚠ {overdue.length} overdue catch-up{overdue.length === 1 ? '' : 's'}</span>
            </>}
          </div>
        </div>
        <div className="flex gap-2.5 items-center flex-wrap">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-md"
            style={{
              padding: '6px 12px', fontSize: 12, fontFamily: 'inherit',
              background: 'var(--surface0)', border: '1px solid var(--surface1)',
              color: 'var(--text)', outline: 'none', cursor: 'pointer',
              height: 32,
            }}
          >
            <option value="circle">Circle grouping</option>
            <option value="nextCatchup">Next catch-up (soonest first)</option>
            <option value="lastCatchup">Last contact (oldest first)</option>
          </select>
          <Button variant="secondary" icon={<Icons.Plus size={14} />} onClick={newCircle}>New circle</Button>
          <Button icon={<Icons.Plus size={14} />} onClick={addPerson}>Add person</Button>
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

      {sortBy === 'circle' ? (
        <div className="flex flex-col gap-7">
          {circleTags.map((tag) => {
            const Icon = iconFor(tag.title);
            const color = circleColorOf(tag);
            const members = byGroup[tag._id] ?? [];
            return (
              <section key={tag._id}>
                <header className="flex items-center gap-3 mb-3.5">
                  <div className="grid place-items-center" style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `color-mix(in srgb, ${color} 18%, var(--surface0))`,
                    border: `1px solid color-mix(in srgb, ${color} 30%, var(--surface1))`,
                  }}>
                    <Icon size={14} color={color} />
                  </div>
                  <div className="flex-1">
                    <h2 className="m-0 text-[17px] font-bold text-ctp-text">{tag.title}</h2>
                    <div className="flex items-center gap-2 mt-0.5 text-ctp-subtext1" style={{ fontSize: 11 }}>
                      <span>{members.length} {members.length === 1 ? 'person' : 'people'}</span>
                    </div>
                  </div>
                </header>
                <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', paddingLeft: 'clamp(0px, 5vw, 48px)' }}>
                  {members.map((p) => <PersonChip key={p._id} person={p} circleColor={color} onOpen={onOpen} />)}
                  {members.length === 0 && (
                    <button
                      onClick={() => {
                        setCreateCircle(tag.title);
                        setCreateOpen(true);
                      }}
                      className="flex items-center justify-center gap-2 border-dashed rounded-[10px] cursor-pointer text-ctp-overlay1 hover:text-ctp-text hover:border-ctp-text transition-colors duration-200"
                      style={{
                        padding: '12px 14px',
                        background: 'transparent',
                        border: '1px dashed var(--surface2)',
                        fontSize: 13,
                        fontFamily: 'inherit',
                      }}
                    >
                      <Icons.Plus size={14} /> Add contact
                    </button>
                  )}
                </div>
              </section>
            );
          })}
          {byGroup[UNSORTED_KEY]?.length > 0 && (
            <section key={UNSORTED_KEY}>
              <header className="flex items-center gap-3 mb-3.5">
                <div className="grid place-items-center" style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'color-mix(in srgb, var(--c-routine) 18%, var(--surface0))',
                  border: '1px solid color-mix(in srgb, var(--c-routine) 30%, var(--surface1))',
                }}>
                  <Icons.Network size={14} color="var(--c-routine)" />
                </div>
                <div className="flex-1">
                  <h2 className="m-0 text-[17px] font-bold text-ctp-text">Unsorted</h2>
                  <div className="flex items-center gap-2 mt-0.5 text-ctp-subtext1" style={{ fontSize: 11 }}>
                    <span>{byGroup[UNSORTED_KEY].length} {byGroup[UNSORTED_KEY].length === 1 ? 'person' : 'people'}</span>
                  </div>
                </div>
              </header>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', paddingLeft: 'clamp(0px, 5vw, 48px)' }}>
                {byGroup[UNSORTED_KEY].map((p) => <PersonChip key={p._id} person={p} circleColor="var(--c-routine)" onOpen={onOpen} />)}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {sortedPeople.map((p) => {
            const circle = circleOfPerson(p as unknown as XPNode, circleTags);
            const circleColor = circle ? circleColorOf(circle) : 'var(--c-routine)';
            return <PersonChip key={p._id} person={p} circleColor={circleColor} onOpen={onOpen} />;
          })}
        </div>
      )}

      <CreateNodeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => onOpen(id)}
        defaultType="PERSON"
        defaultCircle={createCircle}
      />
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
