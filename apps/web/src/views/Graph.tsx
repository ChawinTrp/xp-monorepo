import { useState, useMemo } from 'react';
import { useNodes } from '../lib/hooks';
import { TypeIcon, TypeBadge, StatusDot, ProgressBar, LevelBadge, Button, Dropdown, Icons } from '../components/ui';
import { TYPE_COLORS } from '../lib/types';

interface GraphProps {
  onOpen: (id: string) => void;
}

const W = 1100;
const H = 640;

function nodeDim(type: string) {
  switch (type) {
    case 'DOMAIN': return { w: 140, h: 60 };
    case 'SKILL': return { w: 110, h: 54 };
    case 'PROJECT': return { w: 120, h: 54 };
    case 'TASK': return { w: 96, h: 44 };
    case 'PERSON': return { w: 96, h: 54 };
    case 'TAG': return { w: 70, h: 30 };
    default: return { w: 100, h: 50 };
  }
}

export default function Graph({ onOpen }: GraphProps) {
  const { nodes, byId } = useNodes();
  const [selected, setSelected] = useState<string | null>(null);
  const [layout, setLayout] = useState('hierarchical');
  const [filters, setFilters] = useState<Record<string, boolean>>({
    DOMAIN: true, SKILL: true, PROJECT: true, TASK: true, PERSON: true, TAG: false,
  });
  const [zoom, setZoom] = useState(1);

  const { positions, edges } = useMemo(() => {
    const visibleNodes = nodes.filter((n) => filters[n.type]);
    const positions: Record<string, { x: number; y: number }> = {};
    const edges: { from: string; to: string; dashed: boolean }[] = [];

    const tiers: Record<string, typeof visibleNodes> = {
      DOMAIN_ROOT: [], DOMAIN_SUB: [], SKILL_PROJECT: [], TASK: [], PERSON: [],
    };

    for (const n of visibleNodes) {
      if (n.type === 'DOMAIN' && !n.mainParent) tiers.DOMAIN_ROOT.push(n);
      else if (n.type === 'DOMAIN') tiers.DOMAIN_SUB.push(n);
      else if (n.type === 'SKILL' || n.type === 'PROJECT') tiers.SKILL_PROJECT.push(n);
      else if (n.type === 'TASK') tiers.TASK.push(n);
      else if (n.type === 'PERSON') tiers.PERSON.push(n);
    }

    const place = (arr: typeof visibleNodes, y: number) => {
      const step = W / (arr.length + 1);
      arr.forEach((n, i) => { positions[n._id] = { x: step * (i + 1), y }; });
    };

    place(tiers.DOMAIN_ROOT, 80);
    place(tiers.DOMAIN_SUB, 200);
    place(tiers.SKILL_PROJECT, 340);
    place(tiers.TASK, 470);
    place(tiers.PERSON, 580);

    for (const n of visibleNodes) {
      if (n.mainParent && positions[n.mainParent]) {
        edges.push({ from: n.mainParent, to: n._id, dashed: false });
      }
      // Show extra parents when a node is selected
      if (selected && (selected === n._id || n.parents?.includes(selected))) {
        for (const pid of (n.parents ?? [])) {
          if (pid !== n.mainParent && positions[pid]) {
            edges.push({ from: pid, to: n._id, dashed: true });
          }
        }
      }
    }

    return { positions, edges };
  }, [nodes, filters, selected]);

  const selectedNode = selected ? byId[selected] : null;

  return (
    <div className="fade-in flex flex-col h-full" style={{ padding: '20px 24px' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3.5 mb-3.5 pb-3.5" style={{ borderBottom: '1px solid var(--surface1)' }}>
        <div className="flex gap-1.5">
          {Object.entries(filters).map(([type, on]) => (
            <button
              key={type}
              onClick={() => setFilters((f) => ({ ...f, [type]: !f[type] }))}
              className="inline-flex items-center gap-1.5 rounded font-semibold uppercase cursor-pointer transition-all duration-200"
              style={{
                padding: '5px 10px', fontSize: 11, letterSpacing: 0.4, fontFamily: 'inherit',
                background: on ? `color-mix(in srgb, ${TYPE_COLORS[type]} 18%, transparent)` : 'var(--surface0)',
                color: on ? TYPE_COLORS[type] : 'var(--overlay1)',
                border: `1px solid ${on ? TYPE_COLORS[type] : 'var(--surface1)'}`,
              }}
            >
              <TypeIcon type={type} size={11} />
              {type}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Dropdown value={layout} onChange={setLayout} options={[
          { value: 'hierarchical', label: 'Hierarchical' },
          { value: 'radial', label: 'Radial (preview)' },
        ]} />
        <div className="flex gap-1 rounded-md" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)' }}>
          <ZoomBtn onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>−</ZoomBtn>
          <span className="mono min-w-[44px] text-center text-ctp-subtext1 py-1" style={{ fontSize: 11 }}>
            {Math.round(zoom * 100)}%
          </span>
          <ZoomBtn onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>+</ZoomBtn>
          <ZoomBtn onClick={() => setZoom(1)}>Fit</ZoomBtn>
        </div>
      </div>

      {/* Canvas + side panel */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 relative overflow-hidden rounded-xl" style={{
          background: 'var(--mantle)',
          border: '1px solid var(--surface1)',
          backgroundImage: 'radial-gradient(circle, var(--surface1) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundPosition: '12px 12px',
        }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--overlay0)" />
              </marker>
            </defs>
            <g transform={`translate(${(W * (1 - zoom)) / 2}, ${(H * (1 - zoom)) / 2}) scale(${zoom})`}>
              {edges.map((e, i) => {
                const a = positions[e.from];
                const b = positions[e.to];
                if (!a || !b) return null;
                const isSel = selected && (selected === e.from || selected === e.to);
                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={isSel ? 'var(--accent)' : 'var(--overlay0)'}
                    strokeWidth={isSel ? 2.2 : (e.dashed ? 1 : 1.6)}
                    strokeDasharray={e.dashed ? '4 4' : '0'}
                    opacity={selected && !isSel ? 0.25 : 0.7}
                    markerEnd="url(#arrow)"
                  />
                );
              })}
              {Object.entries(positions).map(([id, pos]) => {
                const n = byId[id];
                if (!n) return null;
                const isSel = selected === id;
                const dim = nodeDim(n.type);
                const color = TYPE_COLORS[n.type];
                return (
                  <g key={id}
                    transform={`translate(${pos.x - dim.w / 2}, ${pos.y - dim.h / 2})`}
                    onClick={() => setSelected(id)}
                    style={{ cursor: 'pointer' }}
                    opacity={selected && !isSel ? 0.5 : 1}
                  >
                    {isSel && (
                      <rect x={-4} y={-4} width={dim.w + 8} height={dim.h + 8} rx={10}
                        fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
                    )}
                    <rect x={0} y={0} width={dim.w} height={dim.h} rx={8}
                      fill="var(--surface0)" stroke={color} strokeWidth={2} />
                    <foreignObject x={0} y={0} width={dim.w} height={dim.h}>
                      <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 2, padding: 4, color: 'var(--text)',
                      }}>
                        <div className="flex items-center gap-1">
                          <TypeIcon type={n.type} size={10} color={color} />
                          <span className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap"
                            style={{ fontSize: n.type === 'TAG' ? 9 : 11, maxWidth: dim.w - 16 }}>{n.title}</span>
                        </div>
                        {n.type === 'SKILL' && <span className="mono text-[9px] font-bold" style={{ color: 'var(--c-tag)' }}>Lv.{(n.metadata as any)?.level}</span>}
                        {n.type === 'TASK' && <StatusDot status={n.status ?? undefined} size={6} />}
                        {n.type === 'PROJECT' && (
                          <div className="overflow-hidden rounded-sm" style={{ width: '70%', height: 3, background: 'var(--surface1)' }}>
                            <div style={{ width: `${n.progress ?? 0}%`, height: '100%', background: color }} />
                          </div>
                        )}
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Minimap */}
          <div className="absolute bottom-3 right-3 rounded-md" style={{
            width: 140, height: 90,
            background: 'var(--base)', border: '1px solid var(--surface1)', padding: 4,
          }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
              {Object.entries(positions).map(([id, pos]) => {
                const n = byId[id];
                return n ? <circle key={id} cx={pos.x} cy={pos.y} r={14} fill={TYPE_COLORS[n.type]} opacity={0.7} /> : null;
              })}
            </svg>
          </div>
        </div>

        {selectedNode && (
          <GraphSidePanel node={selectedNode} onClose={() => setSelected(null)} onOpen={onOpen} />
        )}
      </div>
    </div>
  );
}

function ZoomBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-transparent border-none text-ctp-subtext1 cursor-pointer"
      style={{ padding: '4px 10px', fontSize: 13, fontFamily: 'inherit' }}>{children}</button>
  );
}

function GraphSidePanel({ node, onClose, onOpen }: { node: any; onClose: () => void; onOpen: (id: string) => void }) {
  const { breadcrumb } = useNodes();
  const m = node.metadata as any ?? {};
  const bc = breadcrumb(node._id).map((c: any) => c.title).join(' / ');

  return (
    <div className="slide-right flex flex-col gap-3.5 rounded-xl" style={{
      width: 320, background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 20,
    }}>
      <div className="flex justify-between items-start">
        <TypeBadge type={node.type} />
        <button onClick={onClose} className="bg-transparent border-none text-ctp-overlay1 cursor-pointer p-1">
          <Icons.X size={14} />
        </button>
      </div>
      <h2 className="m-0 text-lg font-bold">{node.title}</h2>
      <div className="mono text-ctp-subtext1" style={{ fontSize: 11 }}>{bc || '—'}</div>
      {node.type === 'TASK' && (
        <>
          <Row label="Status"><StatusDot status={node.status} /> <span>{node.status}</span></Row>
          {m.priority && <Row label="Priority">{m.priority}</Row>}
        </>
      )}
      {node.type === 'PROJECT' && (
        <>
          <Row label="Status">{node.status}</Row>
          <div>
            <div className="uppercase text-ctp-subtext1 mb-1" style={{ fontSize: 10 }}>Progress</div>
            <ProgressBar value={node.progress ?? 0} color="var(--c-project)" showLabel />
          </div>
        </>
      )}
      {node.type === 'SKILL' && (
        <>
          <Row label="Level"><LevelBadge level={m.level ?? 0} /></Row>
          <div>
            <div className="uppercase text-ctp-subtext1 mb-1" style={{ fontSize: 10 }}>XP</div>
            <ProgressBar value={((m.xp ?? 0) / (m.xpToNext ?? 500)) * 100} color="var(--c-skill)" />
            <div className="mono text-ctp-subtext0 mt-1" style={{ fontSize: 11 }}>{m.xp ?? 0}/{m.xpToNext ?? 500} XP</div>
          </div>
        </>
      )}
      {node.description && (
        <div className="rounded-md" style={{ fontSize: 12, color: 'var(--subtext0)', padding: 10, background: 'var(--mantle)' }}>
          {node.description}
        </div>
      )}
      <Button variant="secondary" icon={<Icons.ArrowRight size={12} />} onClick={() => onOpen(node._id)}>
        Open full detail
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="uppercase min-w-[70px] text-ctp-subtext1" style={{ fontSize: 10, letterSpacing: 0.6 }}>{label}</span>
      <div className="inline-flex items-center gap-1.5" style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}
