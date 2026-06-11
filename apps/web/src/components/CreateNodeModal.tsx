import { useState, useEffect, useRef, useMemo } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { Icons, TypeBadge, Button, useToast } from './ui';
import { CREATE_NODE, GET_NODES } from '../lib/graphql';
import { TYPE_COLORS } from '../lib/types';
import { circleTagsOf } from '../lib/circles';

const CREATABLE_TYPES = ['TASK', 'ROUTINE', 'PROJECT', 'SKILL', 'PERSON', 'DOMAIN', 'TAG'] as const;

/** "Alice Chen" -> "AC"; single word -> first two letters. */
function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Remembered capture defaults — pick the internship project/circle once and it
// sticks. localStorage access is guarded so private mode / SSR degrades to the
// hardcoded defaults rather than breaking capture.
const CAPTURE_KEYS = {
  project: 'xp.capture.lastProjectId',
  circle: 'xp.capture.lastCircle',
} as const;

function readCapturePref(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeCapturePref(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

interface CreateNodeModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
  /** Pre-fill type, e.g. when creating from Kanban */
  defaultType?: string;
  /** Pre-fill status */
  defaultStatus?: string;
  /** Pre-fill mainParent */
  defaultParentId?: string;
  /** Pre-fill the circle for a PERSON (may be a brand-new circle name) */
  defaultCircle?: string;
}

export default function CreateNodeModal({
  open, onClose, onCreated, defaultType, defaultStatus, defaultParentId, defaultCircle,
}: CreateNodeModalProps) {
  const { byType, byId, breadcrumb } = useNodes();
  const { toast } = useToast();
  const [createNode, { loading }] = useMutation(CREATE_NODE, { refetchQueries: [{ query: GET_NODES }] });

  const [type, setType] = useState(defaultType ?? 'TASK');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState(defaultParentId ?? '');
  const [status, setStatus] = useState(defaultStatus ?? 'TODO');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [priority, setPriority] = useState('medium');
  const [due, setDue] = useState('');
  const [cadence, setCadence] = useState('daily');
  const [target, setTarget] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('morning');
  const [group, setGroup] = useState('');
  const [role, setRole] = useState('');
  const [circle, setCircle] = useState<string>('Network');
  const [pendingCircle, setPendingCircle] = useState<{ title: string; _id: string } | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedSkillIds, setLinkedSkillIds] = useState<string[]>([]);

  const titleRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setType(defaultType ?? 'TASK');
      setTitle('');
      setDescription('');
      const initialType = defaultType ?? 'TASK';
      const rememberedProject = readCapturePref(CAPTURE_KEYS.project);
      // Remembered project only applies to TASK capture, and only if it still exists.
      setParentId(
        defaultParentId
        ?? (initialType === 'TASK' && rememberedProject && byId[rememberedProject]
              ? rememberedProject
              : ''),
      );
      setStatus(defaultStatus ?? 'TODO');
      setEstimatedHours('');
      setPriority('medium');
      setDue('');
      setCadence('daily');
      setTarget('');
      setTimeOfDay('morning');
      setGroup('');
      setRole('');
      {
        const candidate = defaultCircle ?? readCapturePref(CAPTURE_KEYS.circle) ?? 'Network';
        const circleTagTitles = circleTagsOf(byType('TAG')).map((t) => t.title);
        const isKnown = circleTagTitles.includes(candidate) || candidate === defaultCircle;
        setCircle(isKnown ? candidate : 'Network');
      }
      setPendingCircle(null);
      setEmail('');
      setPhone('');
      setLinkedSkillIds([]);
      setTimeout(() => titleRef.current?.focus(), 100);
    }
    // byId/byType intentionally omitted: only read on open; including them would reset the form on cache updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultType, defaultStatus, defaultParentId, defaultCircle]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  const projects = byType('PROJECT');
  const domains = byType('DOMAIN');

  // Circle options = circle TAG titles (defaults-first order) + any new one passed in (de-duped, ordered)
  const circleTags = circleTagsOf(byType('TAG'));
  const circleOptions = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (c?: string) => {
      const v = c?.trim();
      if (v && !seen.has(v)) { seen.add(v); out.push(v); }
    };
    circleTags.forEach((t) => add(t.title));
    add(defaultCircle);
    return out;
  })();

  // Choose parent options based on type
  const parentOptions = type === 'TASK'
    ? projects
    : type === 'PROJECT' || type === 'SKILL' || type === 'ROUTINE' || type === 'PERSON' || type === 'DOMAIN'
      ? domains
      : [];

  const handleSubmit = async (keepOpen = false) => {
    if (!title.trim()) {
      toast({ message: 'Title is required', variant: 'error' });
      return;
    }

    const metadata: Record<string, unknown> = {};
    if (type === 'TASK') {
      if (estimatedHours) metadata.estimatedHours = parseFloat(estimatedHours);
      if (priority) metadata.priority = priority;
      if (due) metadata.due = due;
    }
    if (type === 'ROUTINE') {
      metadata.cadence = cadence;
      if (target) metadata.target = target;
      metadata.timeOfDay = timeOfDay;
      if (group.trim()) metadata.group = group.trim();
      metadata.checkIns = [];
      metadata.streak = 0;
      metadata.bestStreak = 0;
      metadata.thisWeek = 0;
      metadata.weekTarget = cadence === 'daily' ? 7 : cadence === 'weekly' ? 1 : 1;
    }
    if (type === 'PERSON') {
      metadata.initials = deriveInitials(title);
      if (role.trim()) metadata.role = role.trim();
      if (email.trim()) metadata.email = email.trim();
      if (phone.trim()) metadata.phone = phone.trim();
    }

    // Resolve the selected circle name to its TAG _id (if it still exists).
    // Fall back to a just-created circle's id if the cache hasn't refreshed yet.
    const circleTagId = type === 'PERSON'
      ? circleTags.find((t) => t.title === circle)?._id
        ?? (pendingCircle?.title === circle ? pendingCircle._id : undefined)
      : undefined;

    const parents = [
      ...(parentId ? [parentId] : []),
      ...linkedSkillIds,
      ...(circleTagId ? [circleTagId] : []),
    ];

    try {
      const { data } = await createNode({
        variables: {
          input: {
            title: title.trim(),
            type,
            description: description || undefined,
            mainParent: parentId || undefined,
            parents: parents.length > 0 ? parents : undefined,
            status: ['TASK', 'PROJECT'].includes(type) ? status : undefined,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          },
        },
      });

      toast({ message: `${type} created`, variant: 'success', details: title.trim() });
      if (type === 'TASK' && parentId) writeCapturePref(CAPTURE_KEYS.project, parentId);
      if (type === 'PERSON') writeCapturePref(CAPTURE_KEYS.circle, circle);

      if (keepOpen) {
        // Keep type / project / circle / linked skills; clear only the per-item fields.
        setTitle('');
        setDescription('');
        setRole('');
        setEmail('');
        setPhone('');
        setTimeout(() => titleRef.current?.focus(), 50);
      } else {
        onClose();
        if (onCreated && data?.createNode?._id) {
          onCreated(data.createNode._id);
        }
      }
    } catch (err: any) {
      toast({ message: 'Failed to create', variant: 'error', details: err.message });
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        style={{
          background: 'var(--surface0)', borderRadius: 14,
          border: '1px solid var(--surface1)',
          width: 'min(520px, calc(100vw - 24px))', maxHeight: '85vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface1)' }}>
          <h2 className="m-0 font-bold" style={{ fontSize: 18 }}>Create node</h2>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer p-1" style={{ color: 'var(--overlay1)' }}>
            <Icons.X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4" style={{ padding: 20 }}>
          {/* Type selector */}
          <div>
            <Label>Type</Label>
            <div className="flex gap-1.5 flex-wrap">
              {CREATABLE_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="border-none rounded-lg cursor-pointer transition-all duration-150"
                  style={{
                    padding: '6px 12px', fontFamily: 'inherit',
                    background: type === t
                      ? `color-mix(in srgb, ${TYPE_COLORS[t]} 20%, var(--surface1))`
                      : 'var(--mantle)',
                    color: type === t ? TYPE_COLORS[t] : 'var(--subtext1)',
                    border: type === t ? `1.5px solid ${TYPE_COLORS[t]}` : '1.5px solid transparent',
                    fontSize: 12, fontWeight: 600,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label>Title</Label>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Enter ${type.toLowerCase()} title...`}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(); }}
              className="w-full rounded-lg text-ctp-text"
              style={{
                padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
                background: 'var(--base)', border: '1px solid var(--surface1)',
                color: 'var(--text)', outline: 'none',
              }}
            />
          </div>

          {/* Parent */}
          {parentOptions.length > 0 && (
            <div>
              <Label>{type === 'TASK' ? 'Project' : type === 'DOMAIN' ? 'Parent domain' : 'Domain'}</Label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full rounded-lg"
                style={{
                  padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                  background: 'var(--base)', border: '1px solid var(--surface1)',
                  color: 'var(--text)',
                }}
              >
                <option value="">None</option>
                {parentOptions.map(p => (
                  <option key={p._id} value={p._id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Task-specific */}
          {type === 'TASK' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Estimated hours</Label>
                <input
                  type="number" step="0.5" min="0"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="e.g. 4"
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <div className="flex gap-1">
                  {['low', 'medium', 'high'].map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className="flex-1 border-none rounded cursor-pointer capitalize font-semibold"
                      style={{
                        padding: '7px 0', fontSize: 12, fontFamily: 'inherit',
                        background: priority === p ? 'var(--surface1)' : 'var(--mantle)',
                        color: priority === p
                          ? p === 'high' ? 'var(--red)' : p === 'medium' ? 'var(--yellow)' : 'var(--green)'
                          : 'var(--subtext1)',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Due date</Label>
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                </select>
              </div>
            </div>
          )}

          {/* Routine-specific */}
          {type === 'ROUTINE' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cadence</Label>
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value)}
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <Label>Target</Label>
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="e.g. 30 min, 2 hours"
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              <div>
                <Label>Time of day</Label>
                <select
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                >
                  <option value="morning">☀ Morning</option>
                  <option value="afternoon">◐ Afternoon</option>
                  <option value="evening">◑ Evening</option>
                  <option value="night">☾ Night</option>
                </select>
              </div>
              <div>
                <Label>Group (optional)</Label>
                <input
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder="e.g. Health, Work"
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Person-specific */}
          {type === 'PERSON' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Backend Dev, Mentor"
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              <div>
                <Label>Circle</Label>
                <select
                  value={circle}
                  onChange={async (e) => {
                    const val = e.target.value;
                    if (val === '__new_circle__') {
                      const name = window.prompt('Name the new circle')?.trim();
                      if (!name) return;
                      const existing = circleTags.find((t) => t.title.toLowerCase() === name.toLowerCase());
                      if (!existing) {
                        try {
                          const { data } = await createNode({
                            variables: {
                              input: {
                                title: name,
                                type: 'TAG',
                                metadata: { kind: 'circle' },
                              },
                            },
                          });
                          const createdId = (data as any)?.createNode?._id as string | undefined;
                          if (createdId) {
                            setPendingCircle({ title: name, _id: createdId });
                          }
                          toast({ message: 'Circle created', variant: 'success', details: name });
                        } catch (err: any) {
                          toast({ message: 'Failed to create circle', variant: 'error', details: err.message });
                          return;
                        }
                      }
                      setCircle(existing?.title ?? name);
                    } else {
                      setCircle(val);
                    }
                  }}
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)', cursor: 'pointer',
                  }}
                >
                  {circleOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__new_circle__">+ New circle...</option>
                </select>
              </div>
              <div>
                <Label>Email</Label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="optional"
                  className="w-full rounded-lg"
                  style={{
                    padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                    background: 'var(--base)', border: '1px solid var(--surface1)',
                    color: 'var(--text)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Skill picker for TASK and ROUTINE */}
          {(type === 'TASK' || type === 'ROUTINE') && (
            <div>
              <Label>Link skills</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {linkedSkillIds.map(sid => {
                  const skill = byId[sid];
                  if (!skill) return null;
                  return (
                    <span key={sid} className="inline-flex items-center gap-1.5 rounded-md" style={{
                      padding: '4px 8px', fontSize: 12,
                      background: 'color-mix(in srgb, var(--c-skill) 14%, transparent)',
                      color: 'var(--c-skill)',
                    }}>
                      <Icons.Zap size={11} />
                      {skill.title}
                      <button
                        onClick={() => setLinkedSkillIds(prev => prev.filter(x => x !== sid))}
                        className="bg-transparent border-none cursor-pointer p-0"
                        style={{ color: 'var(--overlay1)' }}
                      >
                        <Icons.X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
              <ModalSkillPicker
                linkedIds={linkedSkillIds}
                onAdd={(sid) => setLinkedSkillIds(prev => [...prev, sid])}
                byId={byId}
                byType={byType}
                breadcrumb={breadcrumb}
              />
            </div>
          )}

          {/* Description */}
          <div>
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="w-full rounded-lg resize-y"
              style={{
                minHeight: 70, padding: '10px 12px',
                fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
                background: 'var(--base)', border: '1px solid var(--surface1)',
                color: 'var(--text)',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5" style={{ padding: '14px 20px', borderTop: '1px solid var(--surface1)' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={() => handleSubmit(true)} disabled={loading || !title.trim()}>
            Save &amp; add another
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={loading || !title.trim()}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="uppercase text-ctp-subtext1 mb-1.5 font-semibold" style={{ fontSize: 10, letterSpacing: 0.6 }}>
      {children}
    </div>
  );
}

/* Inline skill picker for the modal */
function ModalSkillPicker({ linkedIds, onAdd, byId, byType, breadcrumb }: {
  linkedIds: string[];
  onAdd: (id: string) => void;
  byId: Record<string, any>;
  byType: (type: string) => any[];
  breadcrumb: (id: string) => any[];
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const allSkills = byType('SKILL');
  const filtered = useMemo(() => {
    const available = allSkills.filter(s => !linkedIds.includes(s._id));
    if (!search.trim()) return []; // Don't show all — only show when searching
    const lower = search.toLowerCase();
    return available.filter(s => {
      if (s.title.toLowerCase().includes(lower)) return true;
      const crumb = breadcrumb(s._id);
      return crumb.some((c: any) => c.title.toLowerCase().includes(lower));
    });
  }, [allSkills, search, linkedIds, breadcrumb]);

  return (
    <div ref={ref} className="relative">
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search skills or domains..."
        className="w-full rounded-lg"
        style={{
          padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
          background: 'var(--base)', border: '1px solid var(--surface1)',
          color: 'var(--text)', outline: 'none',
        }}
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg overflow-hidden w-full"
          style={{
            maxHeight: 180, overflowY: 'auto',
            background: 'var(--surface0)', border: '1px solid var(--surface1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {filtered.slice(0, 10).map(skill => {
            const sm = (skill.metadata as any) ?? {};
            const crumb = breadcrumb(skill._id);
            const domainName = crumb.length > 0 ? crumb[0].title : '';
            return (
              <button
                key={skill._id}
                onClick={() => { onAdd(skill._id); setSearch(''); setOpen(false); }}
                className="w-full text-left border-none cursor-pointer flex items-center gap-3 hover:bg-ctp-surface1"
                style={{ padding: '7px 12px', background: 'transparent', fontFamily: 'inherit' }}
              >
                <Icons.Zap size={13} color="var(--c-skill)" />
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{skill.title}</div>
                  {domainName && <div className="mono" style={{ fontSize: 10, color: 'var(--subtext0)' }}>{domainName}</div>}
                </div>
                <span className="mono shrink-0" style={{ fontSize: 10, color: 'var(--subtext0)' }}>
                  {(sm.level ?? 'unfamiliar').replace('_', ' ')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
