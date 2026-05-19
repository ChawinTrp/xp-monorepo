import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { TypeBadge, TypeIcon, ProgressBar, LevelBadge, TagChip, Button, Icons } from '../components/ui';
import { TYPE_COLORS } from '../lib/types';
import { UPDATE_NODE, DELETE_NODE, GET_NODES } from '../lib/graphql';

interface NodeDetailProps {
  id: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}

export default function NodeDetail({ id, onOpen, onClose }: NodeDetailProps) {
  const { byId, breadcrumb, childrenOf } = useNodes();
  const n = byId[id];
  const [updateNode] = useMutation(UPDATE_NODE, { refetchQueries: [{ query: GET_NODES }] });
  const [deleteNode] = useMutation(DELETE_NODE, { refetchQueries: [{ query: GET_NODES }] });

  const [status, setStatus] = useState<string>(n?.status ?? 'TODO');
  const [description, setDescription] = useState(n?.description ?? '');
  const [progress, setProgress] = useState(n?.progress ?? 0);

  if (!n) return null;

  const crumb = breadcrumb(id);
  const children = childrenOf[id] ?? [];
  const m = n.metadata as any ?? {};

  const handleSave = async () => {
    await updateNode({
      variables: {
        input: {
          _id: id,
          title: n.title,
          type: n.type,
          description,
          status: ['TASK', 'PROJECT'].includes(n.type) ? status : undefined,
          progress,
        },
      },
    });
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete "${n.title}"? This cannot be undone.`)) {
      await deleteNode({ variables: { id } });
      onClose();
    }
  };

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onClose} className="bg-transparent border-none text-ctp-subtext1 p-1 cursor-pointer inline-flex items-center gap-1"
            style={{ fontSize: 12, fontFamily: 'inherit' }}>
            <Icons.ChevronLeft size={14} /> Back
          </button>
          <span className="text-ctp-overlay0">·</span>
          <div className="mono flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--subtext1)' }}>
            {crumb.map((c) => (
              <span key={c._id} className="flex items-center gap-1.5">
                <span onClick={() => onOpen(c._id)} className="cursor-pointer">{c.title}</span>
                <Icons.ChevronRight size={10} color="var(--overlay0)" />
              </span>
            ))}
            <span className="text-ctp-text">{n.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <TypeBadge type={n.type} />
          <h1 className="m-0 text-[28px] font-bold" style={{ letterSpacing: -0.4 }}>{n.title}</h1>
          {m.overdue && (
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

      {/* Two column */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div className="flex flex-col gap-5">
          <SectionCard title="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg text-ctp-text resize-y"
              placeholder="Add a description for this node…"
              style={{
                minHeight: 110, background: 'var(--base)',
                border: '1px solid var(--surface1)', padding: 12,
                fontFamily: 'inherit', fontSize: 13, lineHeight: 1.55, color: 'var(--text)',
              }}
            />
          </SectionCard>

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
                  <Field label="Progress">
                    <input type="range" min={0} max={100} value={progress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="w-full" style={{ accentColor: 'var(--accent)' }} />
                    <div className="mono text-ctp-subtext0 text-right" style={{ fontSize: 11 }}>{progress}%</div>
                  </Field>
                  {m.due && <Field label="Due date"><span className="mono">{m.due}</span></Field>}
                  {m.priority && <Field label="Priority"><span className="capitalize">{m.priority}</span></Field>}
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
                  <Field label="Level"><LevelBadge level={m.level ?? 0} /></Field>
                  <Field label="XP">
                    <ProgressBar value={((m.xp ?? 0) / (m.xpToNext ?? 500)) * 100} color="var(--c-skill)" />
                    <div className="mono text-ctp-subtext0 mt-1.5" style={{ fontSize: 11 }}>
                      {m.xp ?? 0} / {m.xpToNext ?? 500} XP
                    </div>
                  </Field>
                </>
              )}
              {n.type === 'PERSON' && (
                <>
                  {m.email && <Field label="Email"><span>{m.email}</span></Field>}
                  {m.phone && <Field label="Phone"><span>{m.phone}</span></Field>}
                  {m.circle && <Field label="Circle"><span>{m.circle}</span></Field>}
                </>
              )}
              {n.type === 'DOMAIN' && (
                <div className="text-ctp-subtext1" style={{ fontSize: 12 }}>
                  Domains are containers — no additional properties.
                </div>
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
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 mt-7 pt-5" style={{ borderTop: '1px solid var(--surface1)' }}>
        <Button variant="danger" icon={<Icons.Trash2 size={12} />} onClick={handleDelete}>Delete</Button>
        <Button icon={<Icons.Save size={12} />} onClick={handleSave}>Save changes</Button>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 18 }}>
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
