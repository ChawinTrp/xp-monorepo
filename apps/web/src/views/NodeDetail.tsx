import { useState, useEffect, useRef, useMemo } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { TypeBadge, TypeIcon, ProgressBar, TagChip, Button, Icons, LevelBadge, useToast } from '../components/ui';
import { TYPE_COLORS } from '../lib/types';
import { UPDATE_NODE, DELETE_NODE, GET_NODES, COMPLETE_TASK, START_TIMER, STOP_TIMER } from '../lib/graphql';

interface NodeDetailProps {
  id: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}

export default function NodeDetail({ id, onOpen, onClose }: NodeDetailProps) {
  const { byId, breadcrumb, childrenOf, byType, refetch } = useNodes();
  const { toast } = useToast();
  const n = byId[id];
  const [updateNode] = useMutation(UPDATE_NODE, { refetchQueries: [{ query: GET_NODES }] });
  const [deleteNode] = useMutation(DELETE_NODE, { refetchQueries: [{ query: GET_NODES }] });
  const [completeTask, { loading: completing }] = useMutation(COMPLETE_TASK, { refetchQueries: [{ query: GET_NODES }] });
  const [startTimer] = useMutation(START_TIMER, { refetchQueries: [{ query: GET_NODES }] });
  const [stopTimer] = useMutation(STOP_TIMER, { refetchQueries: [{ query: GET_NODES }] });

  const [status, setStatus] = useState<string>(n?.status ?? 'TODO');
  const [description, setDescription] = useState(n?.description ?? '');
  const [progress, setProgress] = useState(n?.progress ?? 0);
  const [linkedSkillIds, setLinkedSkillIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Sync local state when node changes
  useEffect(() => {
    if (n) {
      setStatus(n.status ?? 'TODO');
      setDescription(n.description ?? '');
      setProgress(n.progress ?? 0);
      // Extract skill IDs from parents (excluding mainParent)
      const skillIds = (n.parents ?? []).filter(pid => {
        const p = byId[pid];
        return p && p.type === 'SKILL';
      });
      setLinkedSkillIds(skillIds);
    }
  }, [n, byId]);

  if (!n) return null;

  const crumb = breadcrumb(id);
  const children = childrenOf[id] ?? [];
  const m = (n.metadata as any) ?? {};

  const isTask = n.type === 'TASK';
  const isRoutine = n.type === 'ROUTINE';
  const isDone = n.status === 'DONE';
  const isOverdue = isTask && !isDone && m.due && new Date(m.due) < new Date();

  // Timer state (works for both TASK and ROUTINE)
  const timerEntries = (m.timeEntries ?? []) as { start: string; end?: string }[];
  const hasOpenTimer = timerEntries.some((e: any) => !e.end);

  const handleComplete = async () => {
    try {
      const { data } = await completeTask({ variables: { id } });
      const affectedNodes = data?.completeTask ?? [];
      const skills = affectedNodes.filter((node: any) => node.type === 'SKILL');

      if (skills.length > 0) {
        const creditedHours = m.actualHours ?? m.estimatedHours ?? 0;
        skills.forEach((skill: any) => {
          const sm = skill.metadata ?? {};
          toast({
            message: `+${creditedHours}h ${skill.title}`,
            variant: 'success',
            details: `${(sm.level ?? 'unfamiliar').replace('_', ' ')} · ${sm.hoursToNext != null ? Math.round(sm.hoursToNext) + 'h to next tier' : 'Max tier!'}`,
          });
        });
      } else {
        toast({ message: 'Task completed!', variant: 'success' });
      }
    } catch (err: any) {
      toast({ message: 'Failed to complete task', variant: 'error', details: err.message });
    }
  };

  const handleStartTimer = async () => {
    try {
      await startTimer({ variables: { id } });
      toast({ message: 'Timer started', variant: 'info' });
    } catch (err: any) {
      toast({ message: 'Failed to start timer', variant: 'error', details: err.message });
    }
  };

  const handleStopTimer = async () => {
    try {
      const { data } = await stopTimer({ variables: { id } });
      const actualHours = data?.stopTaskTimer?.metadata?.actualHours;
      toast({
        message: `Timer stopped`,
        variant: 'success',
        details: actualHours != null ? `${actualHours}h tracked` : undefined,
      });
    } catch (err: any) {
      toast({ message: 'Failed to stop timer', variant: 'error', details: err.message });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Rebuild parents array: keep non-SKILL parents + linked skills
      const nonSkillParents = (n.parents ?? []).filter(pid => {
        const p = byId[pid];
        return !p || p.type !== 'SKILL';
      });
      const newParents = [...nonSkillParents, ...linkedSkillIds];

      await updateNode({
        variables: {
          input: {
            _id: id,
            title: n.title,
            type: n.type,
            description,
            status: ['TASK', 'PROJECT'].includes(n.type) ? status : undefined,
            progress,
            parents: newParents,
          },
        },
      });
      toast({ message: 'Changes saved', variant: 'success' });
    } catch (err: any) {
      toast({ message: 'Failed to save', variant: 'error', details: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete "${n.title}"? This cannot be undone.`)) {
      try {
        await deleteNode({ variables: { id } });
        toast({ message: `Deleted "${n.title}"`, variant: 'info' });
        onClose();
      } catch (err: any) {
        toast({ message: 'Failed to delete', variant: 'error', details: err.message });
      }
    }
  };

  return (
    <div className="fade-in" style={{ padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3" style={{ overflow: 'hidden' }}>
          <button onClick={onClose} className="bg-transparent border-none text-ctp-subtext1 p-1 cursor-pointer inline-flex items-center gap-1 shrink-0"
            style={{ fontSize: 12, fontFamily: 'inherit' }}>
            <Icons.ChevronLeft size={14} /> Back
          </button>
          <span className="text-ctp-overlay0 shrink-0">·</span>
          <div className="mono flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--subtext1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {crumb.map((c) => (
              <span key={c._id} className="flex items-center gap-1.5 shrink-0">
                <span onClick={() => onOpen(c._id)} className="cursor-pointer">{c.title}</span>
                <Icons.ChevronRight size={10} color="var(--overlay0)" />
              </span>
            ))}
            <span className="text-ctp-text">{n.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <TypeBadge type={n.type} />
          <h1 className="m-0 font-bold" style={{ fontSize: 'clamp(20px, 4vw, 28px)', letterSpacing: -0.4 }}>{n.title}</h1>
          {isOverdue && (
            <span className="inline-flex items-center gap-1 font-semibold text-ctp-red rounded"
              style={{ fontSize: 11, padding: '3px 8px', background: 'color-mix(in srgb, var(--red) 14%, transparent)' }}>
              <Icons.AlertTriangle size={11} /> Overdue
            </span>
          )}
        </div>
        <div className="mono text-ctp-overlay1 mt-2" style={{ fontSize: 11 }}>
          id: {n._id}
        </div>
      </div>

      {/* Two column — stacks on mobile */}
      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="flex flex-col gap-5">
          {/* Task/Routine action bar */}
          {(isTask || isRoutine) && !isDone && (
            <div className="rounded-xl flex items-center gap-3 flex-wrap" style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${TYPE_COLORS[n.type]} 8%, var(--surface0)), var(--surface0))`,
              border: `1px solid color-mix(in srgb, ${TYPE_COLORS[n.type]} 20%, var(--surface1))`,
              padding: 'clamp(10px, 2vw, 16px)',
            }}>
              {isTask && (
                <Button
                  onClick={handleComplete}
                  disabled={completing}
                  icon={<Icons.CheckCircle size={14} />}
                >
                  {completing ? 'Completing...' : 'Complete task'}
                </Button>
              )}

              {(isTask || isRoutine) && (
                <>
                  {isTask && <div className="h-6" style={{ width: 1, background: 'var(--surface2)' }} />}
                  {hasOpenTimer ? (
                    <Button variant="danger" onClick={handleStopTimer} icon={<Icons.Square size={12} />}>
                      Stop timer
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={handleStartTimer} icon={<Icons.Play size={12} />}>
                      Start timer
                    </Button>
                  )}
                  {hasOpenTimer && <LiveTimer entries={timerEntries} />}
                </>
              )}
            </div>
          )}

          {isTask && isDone && (
            <div className="rounded-xl flex items-center gap-3" style={{
              background: 'color-mix(in srgb, var(--green) 6%, var(--surface0))',
              border: '1px solid color-mix(in srgb, var(--green) 25%, var(--surface1))',
              padding: 16,
            }}>
              <Icons.CheckCircle size={20} color="var(--green)" />
              <div>
                <div className="font-semibold text-ctp-green" style={{ fontSize: 14 }}>Task completed</div>
                <div className="text-ctp-subtext1" style={{ fontSize: 12 }}>
                  {m.completedAt && `Completed ${new Date(m.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                  {m.creditedHours != null && ` · ${m.creditedHours}h credited`}
                </div>
              </div>
            </div>
          )}

          <SectionCard title="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg text-ctp-text resize-y"
              placeholder="Add a description for this node..."
              style={{
                minHeight: 110, background: 'var(--base)',
                border: '1px solid var(--surface1)', padding: 12,
                fontFamily: 'inherit', fontSize: 13, lineHeight: 1.55, color: 'var(--text)',
              }}
            />
          </SectionCard>

          {/* Skill linking for TASK and ROUTINE */}
          {(isTask || isRoutine) && (
            <SectionCard title="Linked Skills">
              <div className="flex flex-wrap gap-2 mb-3">
                {linkedSkillIds.map(sid => {
                  const skill = byId[sid];
                  if (!skill) return null;
                  const sm = (skill.metadata as any) ?? {};
                  return (
                    <div key={sid} className="inline-flex items-center gap-2 rounded-lg" style={{
                      padding: '5px 10px',
                      background: 'color-mix(in srgb, var(--c-skill) 14%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--c-skill) 25%, transparent)',
                    }}>
                      <Icons.Zap size={12} color="var(--c-skill)" />
                      <span
                        onClick={() => onOpen(sid)}
                        className="cursor-pointer font-medium"
                        style={{ fontSize: 12, color: 'var(--c-skill)' }}
                      >
                        {skill.title}
                      </span>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--subtext0)' }}>
                        {(sm.level ?? 'unfamiliar').replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => setLinkedSkillIds(prev => prev.filter(x => x !== sid))}
                        className="bg-transparent border-none cursor-pointer p-0 inline-flex"
                        style={{ color: 'var(--overlay1)' }}
                      >
                        <Icons.X size={11} />
                      </button>
                    </div>
                  );
                })}
                {linkedSkillIds.length === 0 && (
                  <span className="text-ctp-overlay1" style={{ fontSize: 12 }}>No skills linked yet.</span>
                )}
              </div>
              <SkillPicker
                linkedIds={linkedSkillIds}
                onAdd={(sid) => setLinkedSkillIds(prev => [...prev, sid])}
                byId={byId}
                byType={byType}
                breadcrumb={breadcrumb}
              />
            </SectionCard>
          )}

          <SectionCard title="Connections">
            <div className="flex flex-col gap-3.5">
              <div>
                <div className="uppercase text-ctp-subtext1 mb-1.5" style={{ fontSize: 10, letterSpacing: 0.6 }}>Main parent</div>
                <div className="mono text-ctp-subtext0" style={{ fontSize: 12 }}>
                  {crumb.map((c) => c.title).join(' / ') || '—'}
                </div>
              </div>
              {(n.parents?.length ?? 0) > 0 && n.parents?.some(pid => pid !== n.mainParent) && (
                <div>
                  <div className="uppercase text-ctp-subtext1 mb-1.5" style={{ fontSize: 10, letterSpacing: 0.6 }}>Additional parents</div>
                  <div className="flex gap-2 flex-wrap">
                    {n.parents?.filter(pid => pid !== n.mainParent).map((pid) => {
                      const p = byId[pid];
                      if (!p) return null;
                      return (
                        <button key={pid} onClick={() => onOpen(pid)}
                          className="inline-flex items-center gap-1.5 border-none rounded-md cursor-pointer"
                          style={{
                            padding: '5px 10px', fontFamily: 'inherit', fontSize: 12,
                            background: `color-mix(in srgb, ${TYPE_COLORS[p.type]} 14%, transparent)`,
                            color: TYPE_COLORS[p.type],
                          }}>
                          <TypeIcon type={p.type} size={12} />
                          {p.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <div className="uppercase text-ctp-subtext1 mb-1.5" style={{ fontSize: 10, letterSpacing: 0.6 }}>
                  Children ({children.length})
                </div>
                <div className="flex flex-col gap-1">
                  {children.length === 0 && <div className="text-ctp-overlay1" style={{ fontSize: 12 }}>No child nodes.</div>}
                  {children.map((c) => (
                    <button key={c._id} onClick={() => onOpen(c._id)}
                      className="flex items-center gap-2.5 text-left border-none bg-transparent rounded-md cursor-pointer text-ctp-text transition-colors duration-200 hover:bg-ctp-surface0"
                      style={{ padding: '8px 10px', fontFamily: 'inherit', fontSize: 13, border: '1px solid var(--surface1)' }}>
                      {c.type === 'TASK' ? (
                        <span className="grid place-items-center shrink-0" style={{
                          width: 14, height: 14, borderRadius: 3,
                          border: `1.5px solid ${c.status === 'DONE' ? 'var(--green)' : 'var(--overlay1)'}`,
                          background: c.status === 'DONE' ? 'var(--green)' : 'transparent',
                        }}>
                          {c.status === 'DONE' && <Icons.CheckCircle size={9} color="var(--mantle)" strokeWidth={3} />}
                        </span>
                      ) : <TypeIcon type={c.type} size={12} color={TYPE_COLORS[c.type]} />}
                      <span className="flex-1" style={{
                        textDecoration: c.status === 'DONE' ? 'line-through' : 'none',
                        color: c.status === 'DONE' ? 'var(--subtext1)' : 'var(--text)',
                      }}>{c.title}</span>
                      {c.status && <span className="text-ctp-overlay1" style={{ fontSize: 10, letterSpacing: 0.4 }}>{c.status}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-5">
          <SectionCard title="Properties">
            <div className="flex flex-col gap-3.5">
              {n.type === 'TASK' && (
                <>
                  <Field label="Status">
                    <SegmentedStatus value={status} onChange={setStatus} />
                  </Field>
                  {m.estimatedHours != null && (
                    <Field label="Estimated">
                      <span className="mono inline-flex items-center gap-1.5">
                        <Icons.Clock size={12} color="var(--subtext1)" /> {m.estimatedHours}h
                      </span>
                    </Field>
                  )}
                  {m.actualHours != null && (
                    <Field label="Tracked time">
                      <span className="mono inline-flex items-center gap-1.5 font-bold">
                        <Icons.Timer size={12} color="var(--accent)" /> {m.actualHours}h
                      </span>
                    </Field>
                  )}
                  {m.creditedHours != null && (
                    <Field label="Credited">
                      <span className="mono font-bold text-ctp-green">{m.creditedHours}h</span>
                    </Field>
                  )}
                  {timerEntries.length > 0 && (
                    <Field label="Time entries">
                      <div className="flex flex-col gap-1">
                        {timerEntries.map((e: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 mono text-ctp-subtext0" style={{ fontSize: 11 }}>
                            <Icons.Play size={9} color="var(--green)" />
                            {new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {e.end ? (
                              <>
                                <span className="text-ctp-overlay0">→</span>
                                <Icons.Square size={9} color="var(--red)" />
                                {new Date(e.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                <span className="text-ctp-overlay1">
                                  ({formatDuration(new Date(e.end).getTime() - new Date(e.start).getTime())})
                                </span>
                              </>
                            ) : (
                              <span className="text-ctp-green font-semibold">running...</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </Field>
                  )}
                  <Field label="Progress">
                    <input type="range" min={0} max={100} value={progress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="w-full" style={{ accentColor: 'var(--accent)' }} />
                    <div className="mono text-ctp-subtext0 text-right" style={{ fontSize: 11 }}>{progress}%</div>
                  </Field>
                  {m.due && <Field label="Due date"><span className="mono">{m.due}</span></Field>}
                  {m.startDate && <Field label="Start date"><span className="mono">{m.startDate}</span></Field>}
                  {m.priority && <Field label="Priority"><span className="capitalize">{m.priority}</span></Field>}
                  {m.sprint && <Field label="Sprint"><span className="font-semibold" style={{ color: 'var(--accent)' }}>{m.sprint}</span></Field>}
                </>
              )}
              {n.type === 'PROJECT' && (
                <>
                  <Field label="Status">{n.status}</Field>
                  <Field label="Progress">
                    <ProgressBar value={n.progress ?? 0} color="var(--c-project)" showLabel />
                  </Field>
                </>
              )}
              {n.type === 'SKILL' && (
                <>
                  <Field label="Tier">
                    <span className="capitalize font-bold" style={{ color: 'var(--c-skill)' }}>
                      {(m.level ?? 'unfamiliar').replace('_', ' ')}
                    </span>
                  </Field>
                  <Field label="Hours">
                    <span className="mono font-bold">{m.totalHours ?? 0}h</span>
                    {m.hoursToNext != null && (
                      <span className="mono text-ctp-subtext0 ml-2" style={{ fontSize: 11 }}>
                        ({Math.round(m.hoursToNext)}h to next tier)
                      </span>
                    )}
                  </Field>
                </>
              )}
              {n.type === 'ROUTINE' && (
                <>
                  <Field label="Cadence"><span className="capitalize">{m.cadence}</span></Field>
                  <Field label="Target"><span>{m.target}</span></Field>
                  <Field label="Streak">
                    <span className="inline-flex items-center gap-1 font-bold" style={{
                      color: (m.streak ?? 0) >= 10 ? 'var(--orange)' : 'var(--green)',
                    }}>
                      <Icons.Flame size={13} color={(m.streak ?? 0) >= 10 ? 'var(--orange)' : 'var(--green)'} />
                      {m.streak ?? 0} days
                    </span>
                  </Field>
                  <Field label="Best streak">
                    <span className="mono">{m.bestStreak ?? 0} days</span>
                  </Field>
                  <Field label="This week">
                    <span className="mono">{m.thisWeek ?? 0} / {m.weekTarget ?? 0}</span>
                  </Field>
                  {m.group && <Field label="Group"><span>{m.group}</span></Field>}
                </>
              )}
              {n.type === 'PERSON' && (
                <>
                  {m.email && <Field label="Email"><span>{m.email}</span></Field>}
                  {m.phone && <Field label="Phone"><span>{m.phone}</span></Field>}
                  {m.circle && <Field label="Circle"><span>{m.circle}</span></Field>}
                  {m.role && <Field label="Role"><span>{m.role}</span></Field>}
                </>
              )}
              {n.type === 'DOMAIN' && (
                <DomainProgress nodeId={id} childrenOf={childrenOf} byId={byId} />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Tags">
            <div className="flex gap-1.5 flex-wrap">
              {(m.tags ?? []).map((t: string) => <TagChip key={t} label={t} />)}
              <button className="inline-flex items-center gap-1 bg-transparent text-ctp-overlay1 cursor-pointer rounded"
                style={{ padding: '2px 8px', border: '1px dashed var(--surface2)', fontSize: 11, fontFamily: 'inherit' }}>
                <Icons.Plus size={10} /> Add tag
              </button>
            </div>
          </SectionCard>

          {/* Timestamps */}
          <SectionCard title="Activity">
            <div className="flex flex-col gap-1.5">
              {n.createdAt && (
                <div className="mono text-ctp-subtext1" style={{ fontSize: 11 }}>
                  Created {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
              {n.updatedAt && (
                <div className="mono text-ctp-subtext1" style={{ fontSize: 11 }}>
                  Updated {new Date(n.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 mt-7 pt-5 flex-wrap" style={{ borderTop: '1px solid var(--surface1)' }}>
        <Button variant="danger" icon={<Icons.Trash2 size={12} />} onClick={handleDelete}>Delete</Button>
        <Button icon={<Icons.Save size={12} />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

/* ── SkillPicker ── */

function SkillPicker({ linkedIds, onAdd, byId, byType, breadcrumb }: {
  linkedIds: string[];
  onAdd: (id: string) => void;
  byId: Record<string, any>;
  byType: (type: string) => any[];
  breadcrumb: (id: string) => any[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const allSkills = byType('SKILL');
  const filtered = useMemo(() => {
    if (!search.trim()) return []; // Only show results when searching
    const lower = search.toLowerCase();
    return allSkills.filter(s => {
      if (linkedIds.includes(s._id)) return false;
      // Match by skill name
      if (s.title.toLowerCase().includes(lower)) return true;
      // Match by domain name (parent breadcrumb)
      const crumb = breadcrumb(s._id);
      return crumb.some((c: any) => c.title.toLowerCase().includes(lower));
    });
  }, [allSkills, search, linkedIds, breadcrumb]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md cursor-pointer"
        style={{
          padding: '6px 12px', fontSize: 12, fontFamily: 'inherit',
          background: 'transparent', color: 'var(--c-skill)',
          border: '1px dashed color-mix(in srgb, var(--c-skill) 40%, transparent)',
        }}
      >
        <Icons.Plus size={12} /> Link skill
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg overflow-hidden"
          style={{
            width: 'min(300px, calc(100vw - 48px))', maxHeight: 300,
            background: 'var(--surface0)', border: '1px solid var(--surface1)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--surface1)' }}>
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search skills or domains..."
              className="w-full bg-transparent border-none outline-none text-ctp-text"
              style={{ fontSize: 13, fontFamily: 'inherit', padding: 0 }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div className="text-ctp-overlay1" style={{ padding: '12px 14px', fontSize: 12 }}>No skills found.</div>
            )}
            {filtered.map(skill => {
              const sm = (skill.metadata as any) ?? {};
              const crumb = breadcrumb(skill._id);
              const domainName = crumb.length > 0 ? crumb[0].title : '';
              return (
                <button
                  key={skill._id}
                  onClick={() => { onAdd(skill._id); setSearch(''); }}
                  className="w-full text-left border-none cursor-pointer flex items-center gap-3 hover:bg-ctp-surface1"
                  style={{ padding: '8px 14px', background: 'transparent', fontFamily: 'inherit' }}
                >
                  <Icons.Zap size={14} color="var(--c-skill)" />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{skill.title}</div>
                    {domainName && (
                      <div className="mono" style={{ fontSize: 10, color: 'var(--subtext0)' }}>{domainName}</div>
                    )}
                  </div>
                  <span className="mono shrink-0" style={{ fontSize: 10, color: 'var(--subtext0)' }}>
                    {(sm.level ?? 'unfamiliar').replace('_', ' ')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Domain Progress (Stage 7) ── */

function DomainProgress({ nodeId, childrenOf, byId }: {
  nodeId: string;
  childrenOf: Record<string, any[]>;
  byId: Record<string, any>;
}) {
  const children = childrenOf[nodeId] ?? [];
  const skills = children.filter(c => c.type === 'SKILL');
  const projects = children.filter(c => c.type === 'PROJECT');

  const totalHours = skills.reduce((sum, s) => sum + ((s.metadata as any)?.totalHours ?? 0), 0);
  const avgProgress = projects.length > 0
    ? Math.round(projects.reduce((sum, p) => sum + (p.progress ?? 0), 0) / projects.length)
    : 0;

  return (
    <>
      <Field label="Total hours">
        <span className="mono font-bold" style={{ fontSize: 18, color: 'var(--accent)' }}>
          {Math.round(totalHours)}h
        </span>
      </Field>

      {projects.length > 0 && (
        <Field label={`Projects (${projects.length})`}>
          <div className="flex flex-col gap-2 mt-1">
            {projects.map(p => (
              <div key={p._id} className="flex items-center gap-2">
                <TypeIcon type="PROJECT" size={12} />
                <span className="flex-1 truncate" style={{ fontSize: 12, color: 'var(--text)' }}>{p.title}</span>
                <span className="mono shrink-0" style={{ fontSize: 11, color: 'var(--subtext0)' }}>{p.progress ?? 0}%</span>
              </div>
            ))}
            <ProgressBar value={avgProgress} color="var(--c-project)" showLabel height={6} />
          </div>
        </Field>
      )}

      {skills.length > 0 && (
        <Field label={`Skills (${skills.length})`}>
          <div className="flex flex-col gap-2 mt-1">
            {skills.map(skill => {
              const sm = (skill.metadata as any) ?? {};
              return (
                <div key={skill._id} className="flex items-center gap-2">
                  <Icons.Zap size={12} color="var(--c-skill)" />
                  <span className="flex-1 truncate" style={{ fontSize: 12, color: 'var(--text)' }}>{skill.title}</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--subtext0)' }}>
                    {(sm.level ?? 'unfamiliar').replace('_', ' ')}
                  </span>
                  <span className="mono shrink-0" style={{ fontSize: 11, color: 'var(--c-skill)' }}>{sm.totalHours ?? 0}h</span>
                </div>
              );
            })}
          </div>
        </Field>
      )}

      {skills.length === 0 && projects.length === 0 && (
        <div className="text-ctp-subtext1" style={{ fontSize: 12 }}>
          No child skills or projects yet.
        </div>
      )}
    </>
  );
}

/* ── Helper components ── */

function LiveTimer({ entries }: { entries: { start: string; end?: string }[] }) {
  const [elapsed, setElapsed] = useState('');
  const intervalRef = useRef<number>();

  useEffect(() => {
    const openEntry = entries.find(e => !e.end);
    if (!openEntry) {
      setElapsed('');
      return;
    }

    const startMs = new Date(openEntry.start).getTime();

    const tick = () => {
      const diff = Date.now() - startMs;
      setElapsed(formatDuration(diff));
    };

    tick();
    intervalRef.current = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalRef.current);
  }, [entries]);

  if (!elapsed) return null;

  return (
    <div className="inline-flex items-center gap-2 ml-2">
      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--red)' }} />
      <span className="mono font-bold text-ctp-text" style={{ fontSize: 16 }}>{elapsed}</span>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 'clamp(12px, 2vw, 18px)' }}>
      <div className="font-semibold uppercase mb-3 text-ctp-subtext0" style={{ fontSize: 11, letterSpacing: 0.8 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="uppercase text-ctp-subtext1 mb-1.5" style={{ fontSize: 10, letterSpacing: 0.6 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function SegmentedStatus({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = [
    { v: 'TODO', label: 'To do', color: 'var(--overlay2)' },
    { v: 'IN_PROGRESS', label: 'In progress', color: 'var(--blue)' },
    { v: 'DONE', label: 'Done', color: 'var(--green)' },
  ];
  return (
    <div className="flex gap-0.5 rounded-md p-0.5" style={{ background: 'var(--mantle)' }}>
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className="flex-1 border-none rounded inline-flex items-center justify-center gap-1 cursor-pointer uppercase font-semibold"
          style={{
            padding: '6px 8px', fontSize: 11, letterSpacing: 0.4, fontFamily: 'inherit',
            background: value === o.v ? 'var(--surface1)' : 'transparent',
            color: value === o.v ? o.color : 'var(--subtext1)',
          }}>
          <span className="rounded-full" style={{ width: 6, height: 6, background: o.color }} />
          {o.label}
        </button>
      ))}
    </div>
  );
}
