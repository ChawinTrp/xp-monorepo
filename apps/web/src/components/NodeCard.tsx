import type { XPNode } from '../lib/types';
import { PriorityDot, TagChip, Icons } from './ui';

function formatShort(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface NodeCardProps {
  node: XPNode;
  breadcrumb?: string;
  onOpen?: (id: string) => void;
  onComplete?: (id: string) => void;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function NodeCard({ node, breadcrumb, onOpen, onComplete, draggable, dragging, onDragStart, onDragEnd }: NodeCardProps) {
  const m = node.metadata as Record<string, unknown> | undefined;
  const due = m?.due as string | undefined;
  const priority = m?.priority as string | undefined;
  const creditedHours = m?.creditedHours as number | undefined;
  const estimatedHours = m?.estimatedHours as number | undefined;
  const tags = (m?.tags as string[]) ?? [];
  const done = node.status === 'DONE';

  const overdue = !done && due ? new Date(due) < new Date() : false;

  const isTask = node.type === 'TASK';
  const isRoutine = node.type === 'ROUTINE';
  const baseBg = isTask
    ? 'color-mix(in srgb, var(--c-task) 10%, var(--surface0))'
    : isRoutine
    ? 'color-mix(in srgb, var(--c-routine) 10%, var(--surface0))'
    : 'var(--surface0)';

  const hoverBg = isTask
    ? 'color-mix(in srgb, var(--c-task) 10%, var(--surface1))'
    : isRoutine
    ? 'color-mix(in srgb, var(--c-routine) 10%, var(--surface1))'
    : 'var(--surface1)';

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen?.(node._id)}
      className="rounded-lg cursor-pointer transition-all duration-200 relative group"
      style={{
        background: baseBg,
        border: '1px solid var(--border)',
        padding: 12,
        opacity: done ? 0.78 : dragging ? 0.35 : 1,
        boxShadow: dragging ? '0 12px 28px rgba(31,36,48,0.10)' : '0 1px 2px rgba(31,36,48,0.05)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg;
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(31,36,48,0.06)';
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 35%, var(--border))';
        e.currentTarget.style.borderLeft = '2px solid var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = baseBg;
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(31,36,48,0.05)';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.borderLeft = '1px solid var(--border)';
      }}
    >
      <div className="flex items-start gap-2">
        {done ? (
          <Icons.CheckCircle size={14} color="var(--green)" className="mt-0.5" />
        ) : onComplete ? (
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(node._id); }}
            className="grid place-items-center shrink-0 mt-0.5 bg-transparent border-none cursor-pointer p-0 rounded transition-colors duration-150"
            style={{
              width: 16, height: 16, borderRadius: 4,
              border: '1.5px solid var(--overlay1)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--green) 15%, transparent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--overlay1)'; e.currentTarget.style.background = 'transparent'; }}
            title="Complete task"
          />
        ) : (
          <PriorityDot priority={priority ?? 'low'} />
        )}
        <div className="flex-1 min-w-0">
          <div
            className="font-semibold text-sm mb-1 overflow-hidden text-ellipsis"
            style={{
              color: 'var(--text)',
              textDecoration: done ? 'line-through' : 'none',
              textDecorationColor: 'var(--overlay0)',
            }}
          >
            {node.title}
          </div>
          {breadcrumb && (
            <div className="mono text-ctp-subtext1 mb-1.5 opacity-85" style={{ fontSize: 11 }}>
              {breadcrumb}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {done && creditedHours != null && (
              <span className="text-ctp-green font-semibold rounded" style={{
                fontSize: 11, background: 'color-mix(in srgb, var(--c-skill) 16%, transparent)', padding: '2px 6px',
              }}>+{creditedHours}h</span>
            )}
            {!done && estimatedHours != null && (
              <span className="inline-flex items-center gap-1 text-ctp-subtext1" style={{ fontSize: 11 }}>
                <Icons.Clock size={10} /> {estimatedHours}h
              </span>
            )}
            {!done && due && (
              <span className="inline-flex items-center gap-1" style={{
                fontSize: 11, color: overdue ? 'var(--red)' : 'var(--subtext1)', fontWeight: overdue ? 600 : 400,
              }}>
                {overdue && <Icons.AlertTriangle size={11} color="var(--red)" />}
                Due {formatShort(due)}{overdue ? ' · overdue' : ''}
              </span>
            )}
            {tags.map((t) => <TagChip key={t} label={t} />)}
          </div>
        </div>
        {draggable && (
          <div style={{ color: 'var(--overlay0)', marginTop: 2, opacity: 0.5 }}>
            <Icons.GripVertical size={14} />
          </div>
        )}
      </div>
    </div>
  );
}
