import { useState, useMemo } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { Icons, Dropdown, useToast } from '../components/ui';
import NodeCard from '../components/NodeCard';
import { UPDATE_NODE, COMPLETE_TASK, GET_NODES } from '../lib/graphql';
import { differenceInDays, format } from 'date-fns';

interface KanbanProps {
  onOpen: (id: string) => void;
  onCreate?: () => void;
}

const COLUMNS = [
  { key: 'TODO', label: 'To Do', color: 'var(--overlay2)' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: 'var(--blue)' },
  { key: 'DONE', label: 'Done', color: 'var(--green)' },
] as const;

export default function Kanban({ onOpen, onCreate }: KanbanProps) {
  const { byType, byId, breadcrumb } = useNodes();
  const allTasks = byType('TASK');
  const projects = byType('PROJECT');

  const [filter, setFilter] = useState('all');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [mode, setMode] = useState<'board' | 'sprint'>('board');
  const [selectedSprint, setSelectedSprint] = useState('all');
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [newSprint, setNewSprint] = useState({ name: '', startDate: '', endDate: '' });

  const { toast } = useToast();
  const [updateNode] = useMutation(UPDATE_NODE, { refetchQueries: [{ query: GET_NODES }] });
  const [completeTask] = useMutation(COMPLETE_TASK, { refetchQueries: [{ query: GET_NODES }] });

  // Gather sprints from project metadata
  const sprints = useMemo(() => {
    const all: { name: string; startDate: string; endDate: string; projectId: string }[] = [];
    for (const p of projects) {
      const ps = (p.metadata as any)?.sprints ?? [];
      for (const s of ps) all.push({ ...s, projectId: p._id });
    }
    return all;
  }, [projects]);

  const filtered = useMemo(() => {
    let tasks = filter === 'all'
      ? allTasks
      : allTasks.filter((t) => {
          const crumb = breadcrumb(t._id);
          return [t.mainParent, ...crumb.map(c => c._id)].includes(filter);
        });

    if (mode === 'sprint' && selectedSprint !== 'all') {
      tasks = tasks.filter(t => (t.metadata as any)?.sprint === selectedSprint);
    }
    return tasks;
  }, [allTasks, filter, mode, selectedSprint, breadcrumb]);

  // Sprint stats
  const activeSprint = sprints.find(s => s.name === selectedSprint);
  const sprintStats = useMemo(() => {
    if (!activeSprint) return null;
    const sprintTasks = filtered;
    const done = sprintTasks.filter(t => t.status === 'DONE').length;
    const total = sprintTasks.length;
    const daysLeft = activeSprint.endDate
      ? Math.max(0, differenceInDays(new Date(activeSprint.endDate), new Date()))
      : null;
    return { done, total, daysLeft };
  }, [activeSprint, filtered]);

  const handleDrop = async (newStatus: string) => {
    if (!dragId) return;
    const node = byId[dragId];
    if (!node || node.status === newStatus) {
      setDragId(null);
      setOverCol(null);
      return;
    }

    setDragId(null);
    setOverCol(null);

    if (newStatus === 'DONE') {
      try {
        const { data } = await completeTask({ variables: { id: dragId } });
        const skills = (data?.completeTask ?? []).filter((n: any) => n.type === 'SKILL');
        const taskNode = byId[dragId];
        const creditedHours = (taskNode?.metadata as any)?.actualHours ?? (taskNode?.metadata as any)?.estimatedHours ?? 0;
        if (skills.length > 0) {
          skills.forEach((s: any) => {
            toast({ message: `+${creditedHours}h ${s.title}`, variant: 'success' });
          });
        } else {
          toast({ message: 'Task completed!', variant: 'success' });
        }
      } catch (err: any) {
        toast({ message: 'Failed to complete', variant: 'error', details: err.message });
      }
    } else {
      await updateNode({
        variables: {
          input: {
            _id: dragId,
            status: newStatus,
          },
        },
      });
    }
  };

  const handleQuickComplete = async (id: string) => {
    try {
      const { data } = await completeTask({ variables: { id } });
      const skills = (data?.completeTask ?? []).filter((n: any) => n.type === 'SKILL');
      const taskNode = byId[id];
      const creditedHours = (taskNode?.metadata as any)?.actualHours ?? (taskNode?.metadata as any)?.estimatedHours ?? 0;
      if (skills.length > 0) {
        skills.forEach((s: any) => {
          toast({ message: `+${creditedHours}h ${s.title}`, variant: 'success' });
        });
      } else {
        toast({ message: 'Task completed!', variant: 'success' });
      }
    } catch (err: any) {
      toast({ message: 'Failed to complete', variant: 'error', details: err.message });
    }
  };

  const handleCreateSprint = async () => {
    if (!newSprint.name.trim()) return;
    // Find the target project (use filter if set, else first project)
    const projectId = filter !== 'all' ? filter : projects[0]?._id;
    if (!projectId) { toast({ message: 'Select a project first', variant: 'error' }); return; }
    const project = byId[projectId];
    if (!project) return;
    const m = (project.metadata as any) ?? {};
    const existingSprints = m.sprints ?? [];
    const updatedMeta = { ...m, sprints: [...existingSprints, { name: newSprint.name, startDate: newSprint.startDate, endDate: newSprint.endDate }] };
    try {
      await updateNode({ variables: { input: { _id: projectId, metadata: JSON.stringify(updatedMeta) } } });
      toast({ message: `Sprint "${newSprint.name}" created`, variant: 'success' });
      setSelectedSprint(newSprint.name);
      setShowCreateSprint(false);
      setNewSprint({ name: '', startDate: '', endDate: '' });
    } catch (err: any) {
      toast({ message: 'Failed to create sprint', variant: 'error', details: err.message });
    }
  };

  const handleAssignSprint = async (taskId: string, sprintName: string) => {
    const node = byId[taskId];
    if (!node) return;
    const m = (node.metadata as any) ?? {};
    const updatedMeta = { ...m, sprint: sprintName || undefined };
    try {
      await updateNode({ variables: { input: { _id: taskId, metadata: JSON.stringify(updatedMeta) } } });
      toast({ message: sprintName ? `Assigned to ${sprintName}` : 'Removed from sprint', variant: 'info' });
    } catch (err: any) {
      toast({ message: 'Failed to assign sprint', variant: 'error', details: err.message });
    }
  };

  return (
    <div className="fade-in flex flex-col h-full" style={{ padding: 'clamp(12px, 2vw, 24px) clamp(16px, 3vw, 32px)' }}>
      <div className="flex items-center gap-3 mb-5 pb-4 flex-wrap" style={{ borderBottom: '1px solid var(--surface1)' }}>
        {/* Mode toggle */}
        <div className="flex gap-0.5 p-0.5 rounded-md" style={{ background: 'var(--mantle)', border: '1px solid var(--surface1)' }}>
          {(['board', 'sprint'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="border-none cursor-pointer rounded px-2.5 py-1 capitalize font-semibold"
              style={{
                fontSize: 11, fontFamily: 'inherit',
                background: mode === m ? 'var(--surface0)' : 'transparent',
                color: mode === m ? 'var(--accent)' : 'var(--subtext1)',
              }}>{m}</button>
          ))}
        </div>

        <Icons.Filter size={14} color="var(--subtext1)" />
        <Dropdown
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All projects' },
            ...projects.map((p) => ({ value: p._id, label: p.title })),
          ]}
        />

        {/* Sprint selector (sprint mode only) */}
        {mode === 'sprint' && (
          <>
            <Dropdown
              value={selectedSprint}
              onChange={setSelectedSprint}
              options={[
                { value: 'all', label: 'All sprints' },
                ...sprints.map(s => ({ value: s.name, label: s.name })),
              ]}
            />
            <button onClick={() => setShowCreateSprint(true)}
              className="inline-flex items-center gap-1 border-none cursor-pointer rounded px-2.5 py-1.5 font-semibold"
              style={{ fontSize: 11, background: 'var(--surface0)', color: 'var(--accent)', fontFamily: 'inherit', border: '1px solid var(--surface1)' }}>
              <Icons.Plus size={12} /> Sprint
            </button>
          </>
        )}

        <div className="flex-1" />
        <span className="mono text-ctp-overlay1" style={{ fontSize: 11 }}>{filtered.length} tasks</span>
      </div>

      {/* Sprint header */}
      {mode === 'sprint' && sprintStats && activeSprint && (
        <div className="flex items-center gap-4 mb-4 p-3 rounded-lg" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)' }}>
          <div className="flex items-center gap-2">
            <Icons.Target size={14} color="var(--accent)" />
            <span className="font-bold" style={{ fontSize: 13 }}>{activeSprint.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="mono text-ctp-subtext1" style={{ fontSize: 11 }}>
              {activeSprint.startDate && format(new Date(activeSprint.startDate), 'MMM d')} — {activeSprint.endDate && format(new Date(activeSprint.endDate), 'MMM d')}
            </span>
          </div>
          <div className="flex-1 mx-4">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface1)' }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${sprintStats.total ? (sprintStats.done / sprintStats.total * 100) : 0}%`,
                background: 'var(--green)',
              }} />
            </div>
          </div>
          <span className="font-bold" style={{ fontSize: 13, color: 'var(--green)' }}>
            {sprintStats.done}/{sprintStats.total}
          </span>
          {sprintStats.daysLeft != null && (
            <span className="mono text-ctp-subtext1" style={{ fontSize: 11 }}>
              {sprintStats.daysLeft}d left
            </span>
          )}
        </div>
      )}

      {/* Create sprint modal */}
      {showCreateSprint && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowCreateSprint(false)}>
          <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', width: 360 }}
            onClick={e => e.stopPropagation()}>
            <h3 className="m-0 font-bold" style={{ fontSize: 14 }}>New Sprint</h3>
            <input placeholder="Sprint name" value={newSprint.name} onChange={e => setNewSprint(s => ({ ...s, name: e.target.value }))}
              className="rounded-md px-3 py-2 border-none outline-none"
              style={{ background: 'var(--mantle)', color: 'var(--text)', fontSize: 13 }} />
            <div className="flex gap-2">
              <input type="date" value={newSprint.startDate} onChange={e => setNewSprint(s => ({ ...s, startDate: e.target.value }))}
                className="flex-1 rounded-md px-3 py-2 border-none outline-none"
                style={{ background: 'var(--mantle)', color: 'var(--text)', fontSize: 12 }} />
              <input type="date" value={newSprint.endDate} onChange={e => setNewSprint(s => ({ ...s, endDate: e.target.value }))}
                className="flex-1 rounded-md px-3 py-2 border-none outline-none"
                style={{ background: 'var(--mantle)', color: 'var(--text)', fontSize: 12 }} />
            </div>
            <div className="flex gap-2 justify-end mt-1">
              <button onClick={() => setShowCreateSprint(false)}
                className="border-none cursor-pointer rounded px-3 py-1.5 font-semibold"
                style={{ fontSize: 12, background: 'var(--mantle)', color: 'var(--subtext1)', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleCreateSprint}
                className="border-none cursor-pointer rounded px-3 py-1.5 font-semibold"
                style={{ fontSize: 12, background: 'var(--accent)', color: 'var(--mantle)', fontFamily: 'inherit' }}>Create</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-x-auto overflow-y-hidden" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(260px, 1fr))', gap: 16 }}>
        {COLUMNS.map((col) => {
          const colTasks = filtered.filter((t) => (t.status ?? 'TODO') === col.key);
          const isOver = overCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={() => setOverCol((c) => c === col.key ? null : c)}
              onDrop={() => handleDrop(col.key)}
              className="flex flex-col overflow-hidden rounded-[10px] transition-all duration-200"
              style={{
                background: 'var(--mantle)',
                border: `1px ${isOver ? 'dashed' : 'solid'} ${isOver ? 'var(--accent)' : 'var(--surface1)'}`,
              }}
            >
              <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: '1px solid var(--surface1)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                <span className="font-semibold uppercase" style={{ fontSize: 13, letterSpacing: 0.5 }}>{col.label}</span>
                <span className="mono text-ctp-overlay1" style={{ fontSize: 11 }}>{colTasks.length}</span>
                <div className="flex-1" />
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
                {colTasks.map((t) => (
                  <div key={t._id} className="relative group">
                    <NodeCard
                      node={t}
                      onOpen={onOpen}
                      onComplete={col.key !== 'DONE' ? handleQuickComplete : undefined}
                      breadcrumb={breadcrumb(t._id).map(c => c.title).join(' / ')}
                      draggable
                      dragging={dragId === t._id}
                      onDragStart={() => setDragId(t._id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    />
                    {/* Sprint badge + assign */}
                    {mode === 'sprint' && (
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(t.metadata as any)?.sprint ? (
                          <span className="rounded px-1.5 py-0.5 font-semibold"
                            style={{ fontSize: 9, background: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}>
                            {(t.metadata as any).sprint}
                          </span>
                        ) : sprints.length > 0 ? (
                          <select
                            className="rounded px-1 py-0.5 border-none cursor-pointer"
                            style={{ fontSize: 9, background: 'var(--surface1)', color: 'var(--subtext1)' }}
                            value=""
                            onChange={e => e.target.value && handleAssignSprint(t._id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                          >
                            <option value="">+ Sprint</option>
                            {sprints.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                          </select>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div className="text-center text-ctp-overlay0 rounded-lg" style={{
                    padding: '32px 12px', fontSize: 12, border: '1px dashed var(--surface1)',
                  }}>
                    {col.key === 'DONE' ? "Nothing completed yet" : 'Drop a task here'}
                  </div>
                )}
              </div>
              {col.key === 'TODO' && (
                <button
                  onClick={onCreate}
                  className="w-full flex items-center gap-2 border-none cursor-pointer transition-colors"
                  style={{
                    padding: '10px 14px', fontSize: 12, fontFamily: 'inherit',
                    background: 'transparent', color: 'var(--overlay1)',
                    borderTop: '1px solid var(--surface1)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--overlay1)')}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add task
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
