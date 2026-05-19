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
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function NodeCard({ node, breadcrumb, onOpen, draggable, dragging, onDragStart, onDragEnd }: NodeCardProps) {
  const m = node.metadata as Record<string, unknown> | undefined;
  const overdue = m?.overdue as boolean | undefined;
  const due = m?.due as string | undefined;
  const priority = m?.priority as string | undefined;
  const xpAwarded = m?.xpAwarded as number | undefined;
  const tags = (m?.tags as string[]) ?? [];
  const done = node.status === 'DONE';

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen?.(node._id)}
      className="rounded-lg cursor-pointer transition-all duration-200 relative group"
      style={{
        background: 'var(--surface0)',
        border: '1px solid transparent',
        padding: 12,
        opacity: done ? 0.78 : dragging ? 0.35 : 1,
        boxShadow: dragging ? '0 8px 24px rgba(0,0,0,0.35)' : 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface1)'; e.currentTarget.style.borderColor = 'var(--surface2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface0)'; e.currentTarget.style.borderColor = 'transparent'; }}
    >
      <div className="flex items-start gap-2">
        {done
          ? <Icons.CheckCircle size={14} color="var(--green)" className="mt-0.5" />
          : <PriorityDot priority={priority ?? 'low'} />
        }
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
            {done && xpAwarded != null && (
              <span className="text-ctp-green font-semibold rounded" style={{
                fontSize: 11, background: 'color-mix(in srgb, var(--c-skill) 16%, transparent)', padding: '2px 6px',
              }}>+{xpAwarded} XP</span>
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
