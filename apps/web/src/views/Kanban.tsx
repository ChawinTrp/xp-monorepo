import { useState } from 'react';
import { useNodes } from '../lib/hooks';
import { Icons, Dropdown } from '../components/ui';
import NodeCard from '../components/NodeCard';

interface KanbanProps {
  onOpen: (id: string) => void;
}

const COLUMNS = [
  { key: 'TODO', label: 'To Do', color: 'var(--overlay2)' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: 'var(--blue)' },
  { key: 'DONE', label: 'Done', color: 'var(--green)' },
] as const;

export default function Kanban({ onOpen }: KanbanProps) {
  const { byType, breadcrumb } = useNodes();
  const allTasks = byType('TASK');
  const projects = byType('PROJECT');

  const [filter, setFilter] = useState('all');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  const getStatus = (id: string, original?: string) => localStatus[id] ?? original;

  const filtered = filter === 'all'
    ? allTasks
    : allTasks.filter((t) => {
        const crumb = breadcrumb(t._id);
        return [t.mainParent, ...crumb.map(c => c._id)].includes(filter);
      });

  const handleDrop = (status: string) => {
    if (!dragId) return;
    setLocalStatus((cur) => ({ ...cur, [dragId]: status }));
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="fade-in flex flex-col h-full" style={{ padding: '24px 32px' }}>
      <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: '1px solid var(--surface1)' }}>
        <Icons.Filter size={14} color="var(--subtext1)" />
        <Dropdown
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All projects' },
            ...projects.map((p) => ({ value: p._id, label: p.title })),
          ]}
        />
        <div className="flex-1" />
        <span className="mono text-ctp-overlay1" style={{ fontSize: 11 }}>{filtered.length} tasks</span>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-1 overflow-hidden">
        {COLUMNS.map((col) => {
          const colTasks = filtered.filter((t) => getStatus(t._id, t.status ?? 'TODO') === col.key);
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
                <button className="bg-transparent border-none text-ctp-overlay1 cursor-pointer p-1 rounded grid place-items-center">
                  <Icons.Plus size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
                {colTasks.map((t) => (
                  <NodeCard
                    key={t._id}
                    node={t}
                    onOpen={onOpen}
                    breadcrumb={breadcrumb(t._id).map(c => c.title).join(' / ')}
                    draggable
                    dragging={dragId === t._id}
                    onDragStart={() => setDragId(t._id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="text-center text-ctp-overlay0 rounded-lg" style={{
                    padding: '32px 12px', fontSize: 12, border: '1px dashed var(--surface1)',
                  }}>
                    {col.key === 'DONE' ? "Nothing completed yet — you've got this!" : 'Drop a task here'}
                  </div>
                )}
                <button className="flex items-center gap-1.5 mt-1 bg-transparent text-ctp-overlay1 cursor-pointer rounded-lg"
                  style={{ padding: '8px 10px', border: '1px dashed var(--surface1)', fontSize: 12, fontFamily: 'inherit' }}>
                  <Icons.Plus size={12} /> Add task
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
