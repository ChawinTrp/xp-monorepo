import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ForceGraph from 'force-graph';
import { useNodes } from '../lib/hooks';
import { TypeBadge, StatusDot, ProgressBar, Button, Icons } from '../components/ui';
import { TypeIcon } from '../components/ui';
import { TYPE_COLORS } from '../lib/types';
import { getTheme } from '../lib/theme';
import { circleTagsOf, circleOfPerson } from '../lib/circles';

interface GraphProps {
  onOpen: (id: string) => void;
}

const NODE_RADIUS: Record<string, number> = {
  DOMAIN: 12, SKILL: 8, PROJECT: 8, TASK: 5, PERSON: 7, TAG: 4, ROUTINE: 6,
};

const getCssVar = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
};

// Canvas can't resolve CSS variables — map to CSS variable names resolved dynamically
const CANVAS_COLORS: Record<string, string> = {
  DOMAIN:  '--c-domain',
  SKILL:   '--c-skill',
  PROJECT: '--c-project',
  TASK:    '--c-task',
  PERSON:  '--c-person',
  TAG:     '--c-tag',
  ROUTINE: '--c-routine',
};

const FILTER_DEFAULTS: Record<string, boolean> = {
  DOMAIN: true, SKILL: true, PROJECT: true, TASK: true,
  PERSON: true, ROUTINE: true, TAG: false,
};

export default function Graph({ onOpen }: GraphProps) {
  const { nodes, byId } = useNodes();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, boolean>>(FILTER_DEFAULTS);
  const [focusMode, setFocusMode] = useState(false);
  const [theme, setThemeState] = useState(getTheme());

  useEffect(() => {
    const handler = (e: Event) => {
      setThemeState((e as CustomEvent).detail);
    };
    window.addEventListener('xp-theme-change', handler);
    return () => window.removeEventListener('xp-theme-change', handler);
  }, []);

  // Build graph data
  const graphData = useMemo(() => {
    const visibleIds = new Set(nodes.filter((n) => filters[n.type]).map((n) => n._id));

    const graphNodes = nodes.filter((n) => visibleIds.has(n._id)).map((n) => ({
      id: n._id,
      name: n.title,
      type: n.type,
      nodeRef: n,
    }));

    const graphLinks: { source: string; target: string; dashed: boolean }[] = [];
    for (const n of nodes) {
      if (!visibleIds.has(n._id)) continue;
      if (n.mainParent && visibleIds.has(n.mainParent)) {
        graphLinks.push({ source: n.mainParent, target: n._id, dashed: false });
      }
      for (const pid of n.parents ?? []) {
        if (pid !== n.mainParent && visibleIds.has(pid)) {
          graphLinks.push({ source: pid, target: n._id, dashed: true });
        }
      }
    }

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, filters]);

  // Neighbours for focus mode
  const neighbours = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set<string>([selected]);
    for (const l of graphData.links) {
      const src = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target;
      if (src === selected) s.add(tgt);
      if (tgt === selected) s.add(src);
    }
    return s;
  }, [selected, graphData.links]);

  // Mount force-graph instance — use callback ref pattern via a stable effect
  useEffect(() => {
    // Poll until the container is in the DOM and has dimensions
    const el = containerRef.current;
    if (!el) return;

    const mantleColor = getCssVar('--mantle', '#F1EEEA');
    const fg = new ForceGraph(el)
      .backgroundColor(mantleColor)
      .nodeRelSize(1)
      .nodeVal((n: any) => (NODE_RADIUS[n.type] ?? 6) ** 2)
      .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const r = NODE_RADIUS[node.type] ?? 6;
        const colorVar = CANVAS_COLORS[node.type];
        const color = colorVar ? getCssVar(colorVar, '#1F2430') : '#1F2430';
        const isSel = node.id === node.__selected;
        const isDimmed = node.__focusMode && node.__selected && !node.__neighbours?.has(node.id);

        ctx.globalAlpha = isDimmed ? 0.12 : 1;

        // Selection ring
        if (isSel) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = isDimmed ? 0 : 0.5;
          ctx.stroke();
          ctx.globalAlpha = isDimmed ? 0.12 : 1;
        }

        // Node circle — small, vivid stroke, very low fill
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = isSel ? color + '55' : color + '18'; // 33% sel / 9% normal
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = isSel ? 2 : 1.5;
        ctx.stroke();

        // Label with dark pill background for readability
        if (globalScale > 0.45 || isSel) {
          const fontSize = Math.max(3, Math.min(12, 10 / globalScale));
          ctx.font = `${isSel ? '600 ' : '500 '}${fontSize}px Inter, sans-serif`;
          const label = node.name?.length > 20 ? node.name.slice(0, 18) + '…' : node.name;
          const textW = ctx.measureText(label).width;
          const padX = 3, padY = 1.5;
          const tx = node.x;
          const ty = node.y + r + 4;

          // Pill background
          ctx.fillStyle = getTheme() === 'light' ? 'rgba(241,238,234,0.85)' : 'rgba(12,9,8,0.82)';
          ctx.beginPath();
          ctx.roundRect(tx - textW / 2 - padX, ty - padY, textW + padX * 2, fontSize + padY * 2, 3);
          ctx.fill();

          // Text
          ctx.fillStyle = isSel ? color : getCssVar('--subtext0', '#454B57');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(label, tx, ty);
        }

        ctx.globalAlpha = 1;
      })
      .nodeCanvasObjectMode(() => 'replace')
      .linkCanvasObject((link: any, ctx: CanvasRenderingContext2D) => {
        const src = link.source;
        const tgt = link.target;
        if (!src?.x || !tgt?.x) return;
        const selId = link.__selected;
        const isSel = selId && (src.id === selId || tgt.id === selId);
        const isDimmed = link.__focusMode && selId && !isSel;

        ctx.globalAlpha = isDimmed ? 0.04 : isSel ? 0.85 : 0.3;
        ctx.strokeStyle = isSel ? getCssVar('--accent', '#ED7B46') : getCssVar('--surface2', '#E9E5E0');
        ctx.lineWidth = isSel ? 2 : link.dashed ? 0.8 : 1.2;
        ctx.setLineDash(link.dashed ? [4, 4] : []);
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      })
      .linkCanvasObjectMode(() => 'replace')
      .linkDirectionalArrowLength(4)
      .linkDirectionalArrowRelPos(1)
      .linkDirectionalArrowColor(() => getCssVar('--overlay0', '#C7C1B9'))
      .onNodeClick((node: any) => {
        setSelected((prev) => {
          const next = prev === node.id ? null : node.id;
          fg.centerAt(node.x, node.y, 400);
          if (next) fg.zoom(2.5, 400);
          return next;
        });
      })
      .onBackgroundClick(() => setSelected(null))
      .d3AlphaDecay(0.02)
      .d3VelocityDecay(0.3)
      .warmupTicks(60)
      .cooldownTicks(150);

    graphRef.current = fg;

    // Load initial data
    fg.graphData(graphData);

    // Fit after simulation settles
    setTimeout(() => fg.zoomToFit(400, 60), 1200);

    return () => {
      // force-graph cleans up its canvas on _destructor or by clearing innerHTML
      try { fg.pauseAnimation(); } catch (_) {}
      el.innerHTML = '';
      graphRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once — data updates handled below

  // Update graph data and background color when nodes/filters or theme changes
  useEffect(() => {
    if (!graphRef.current) return;
    const mantleColor = getCssVar('--mantle', '#F1EEEA');
    graphRef.current.backgroundColor(mantleColor);
    graphRef.current.graphData({ ...graphData });
  }, [graphData, theme]);

  // Inject selection + focus state into node/link objects for canvas painter
  useEffect(() => {
    if (!graphRef.current) return;
    const data = graphRef.current.graphData();
    for (const n of data.nodes) {
      n.__selected = selected;
      n.__focusMode = focusMode;
      n.__neighbours = neighbours;
    }
    for (const l of data.links) {
      l.__selected = selected;
      l.__focusMode = focusMode;
    }
    // No explicit refresh needed — force-graph repaints every rAF tick
  }, [selected, focusMode, neighbours]);

  // Resize observer — watches the canvas div (inset:0, matches parent size)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Use the parent for size since containerRef is position:absolute inset:0
    const target = el.parentElement ?? el;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0 && graphRef.current) {
        graphRef.current.width(Math.floor(width)).height(Math.floor(height));
      }
    });
    ro.observe(target);
    return () => ro.disconnect();
  }, []);

  const handleFitView = useCallback(() => {
    graphRef.current?.zoomToFit(400, 60);
    setSelected(null);
  }, []);

  const selectedNode = selected ? byId[selected] : null;

  return (
    <div className="fade-in flex flex-col h-full" style={{ padding: '20px 24px' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3.5 pb-3.5 flex-wrap"
        style={{ borderBottom: '1px solid var(--surface1)' }}>
        <div className="flex gap-1.5 flex-wrap">
          {Object.keys(FILTER_DEFAULTS).map((type) => {
            const on = filters[type];
            return (
              <button key={type}
                onClick={() => setFilters((f) => ({ ...f, [type]: !f[type] }))}
                className="inline-flex items-center gap-1.5 rounded font-semibold uppercase cursor-pointer transition-all duration-200"
                style={{
                  padding: '5px 10px', fontSize: 11, letterSpacing: 0.4, fontFamily: 'inherit',
                  background: on ? `color-mix(in srgb, ${TYPE_COLORS[type]} 18%, transparent)` : 'var(--surface0)',
                  color: on ? TYPE_COLORS[type] : 'var(--overlay1)',
                  border: `1px solid ${on ? TYPE_COLORS[type] : 'var(--surface1)'}`,
                }}>
                <TypeIcon type={type} size={11} />
                {type}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <button onClick={() => setFocusMode((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded font-semibold uppercase cursor-pointer transition-all duration-200"
          style={{
            padding: '5px 10px', fontSize: 11, letterSpacing: 0.4, fontFamily: 'inherit',
            background: focusMode ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--surface0)',
            color: focusMode ? 'var(--accent)' : 'var(--overlay1)',
            border: `1px solid ${focusMode ? 'var(--accent)' : 'var(--surface1)'}`,
          }}>
          <Icons.Target size={11} /> Focus
        </button>

        <button onClick={handleFitView}
          className="inline-flex items-center gap-1.5 rounded cursor-pointer"
          style={{
            padding: '5px 10px', fontSize: 11, fontFamily: 'inherit',
            background: 'var(--surface0)', color: 'var(--subtext1)',
            border: '1px solid var(--surface1)',
          }}>
          <Icons.Layers size={11} /> Fit view
        </button>

        <span className="mono text-ctp-overlay1" style={{ fontSize: 11 }}>
          {graphData.nodes.length} nodes · {graphData.links.length} links
        </span>
      </div>

      {/* Canvas + side panel */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/*
          Outer wrapper: React owns this div (legend + hint live here as siblings).
          Inner canvasRef: force-graph owns this div exclusively — React never
          adds/removes children from it, so no removeChild conflict.
        */}
        <div className="flex-1 relative overflow-hidden rounded-xl"
          style={{ background: 'var(--mantle)', border: '1px solid var(--surface1)' }}>

          {/* force-graph mounts its canvas here — React must never touch children */}
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

          {/* Legend — sibling of canvas div, safe for React to reconcile */}
          <div className="absolute top-3 left-3 z-10 rounded-md flex flex-col gap-1.5 pointer-events-none"
            style={{ background: 'rgba(24,24,37,0.85)', border: '1px solid var(--surface1)', padding: '10px 12px', backdropFilter: 'blur(4px)' }}>
            {Object.entries(TYPE_COLORS)
              .filter(([type]) => filters[type])
              .map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: color }} />
                  <span className="uppercase font-semibold" style={{ fontSize: 10, letterSpacing: 0.5, color: 'var(--subtext1)' }}>{type}</span>
                </div>
              ))}
          </div>

          {!selected && (
            <div className="absolute bottom-3 left-3 z-10 pointer-events-none text-ctp-overlay0"
              style={{ fontSize: 11 }}>
              Click node to inspect · Drag to move · Scroll to zoom
            </div>
          )}
        </div>

        {selectedNode && (
          <GraphSidePanel node={selectedNode} onClose={() => setSelected(null)} onOpen={onOpen} />
        )}
      </div>
    </div>
  );
}

function GraphSidePanel({ node, onClose, onOpen }: { node: any; onClose: () => void; onOpen: (id: string) => void }) {
  const { breadcrumb, childrenOf, byType } = useNodes();
  const m = node.metadata as any ?? {};
  const circleTitle = node.type === 'PERSON'
    ? circleOfPerson(node, circleTagsOf(byType('TAG')))?.title
    : undefined;
  const bc = breadcrumb(node._id).map((c: any) => c.title).join(' / ');
  const children = childrenOf[node._id] ?? [];

  return (
    <div className="slide-right flex flex-col gap-3.5 rounded-xl overflow-y-auto"
      style={{ width: 300, background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 20 }}>
      <div className="flex justify-between items-start">
        <TypeBadge type={node.type} />
        <button onClick={onClose} className="bg-transparent border-none text-ctp-overlay1 cursor-pointer p-1">
          <Icons.X size={14} />
        </button>
      </div>

      <h2 className="m-0 font-bold" style={{ fontSize: 17 }}>{node.title}</h2>
      {bc && <div className="mono text-ctp-subtext1" style={{ fontSize: 11 }}>{bc}</div>}

      {node.type === 'TASK' && (
        <>
          <Row label="Status"><StatusDot status={node.status} /><span>{node.status}</span></Row>
          {m.priority && <Row label="Priority"><span className="capitalize">{m.priority}</span></Row>}
          {m.due && <Row label="Due"><span className="mono">{m.due}</span></Row>}
          {m.estimatedHours != null && <Row label="Est."><span className="mono">{m.estimatedHours}h</span></Row>}
          {m.actualHours != null && <Row label="Tracked"><span className="mono">{m.actualHours}h</span></Row>}
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
          <Row label="Tier"><MasteryBadge tier={m.level ?? 'unfamiliar'} /></Row>
          <Row label="Hours"><span className="mono font-bold">{m.totalHours ?? 0}h</span></Row>
          {m.hoursToNext != null && (
            <div>
              <div className="uppercase text-ctp-subtext1 mb-1" style={{ fontSize: 10 }}>Progress to next tier</div>
              <ProgressBar value={masteryProgress(m.totalHours ?? 0)} color="var(--c-skill)" showLabel />
              <div className="mono text-ctp-subtext0 mt-1" style={{ fontSize: 11 }}>
                {Math.round(m.hoursToNext)}h to next tier
              </div>
            </div>
          )}
        </>
      )}
      {node.type === 'ROUTINE' && (
        <>
          <Row label="Cadence"><span className="capitalize">{m.cadence}</span></Row>
          <Row label="Streak"><span className="font-bold text-ctp-green">🔥 {m.streak ?? 0} days</span></Row>
        </>
      )}
      {node.type === 'PERSON' && (
        <>
          {circleTitle && <Row label="Circle">{circleTitle}</Row>}
          {m.role && <Row label="Role">{m.role}</Row>}
        </>
      )}

      {node.description && (
        <div className="rounded-md" style={{ fontSize: 12, color: 'var(--subtext0)', padding: 10, background: 'var(--mantle)', lineHeight: 1.5 }}>
          {node.description}
        </div>
      )}

      {children.length > 0 && (
        <div>
          <div className="uppercase text-ctp-subtext1 mb-2" style={{ fontSize: 10, letterSpacing: 0.6 }}>
            Children ({children.length})
          </div>
          <div className="flex flex-col gap-1">
            {children.slice(0, 6).map((c: any) => (
              <div key={c._id} className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer"
                style={{ background: 'var(--mantle)', fontSize: 12 }}
                onClick={() => onOpen(c._id)}>
                <TypeIcon type={c.type} size={10} />
                <span className="flex-1 truncate">{c.title}</span>
              </div>
            ))}
            {children.length > 6 && (
              <span className="text-ctp-overlay1" style={{ fontSize: 11 }}>+{children.length - 6} more</span>
            )}
          </div>
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
      <span className="uppercase min-w-[64px] text-ctp-subtext1" style={{ fontSize: 10, letterSpacing: 0.6 }}>{label}</span>
      <div className="inline-flex items-center gap-1.5" style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}

const TIER_COLORS: Record<string, string> = {
  unfamiliar: 'var(--overlay0)',
  familiar: 'var(--blue)',
  skilled: 'var(--green)',
  master: 'var(--accent)',
  world_class: 'var(--yellow)',
};

const TIER_LABELS: Record<string, string> = {
  unfamiliar: 'Unfamiliar',
  familiar: 'Familiar',
  skilled: 'Skilled',
  master: 'Master',
  world_class: 'World Class',
};

function MasteryBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] ?? 'var(--overlay0)';
  return (
    <span className="inline-flex items-center rounded font-bold uppercase"
      style={{
        fontSize: 10, letterSpacing: 0.5, padding: '3px 8px',
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      }}>
      {TIER_LABELS[tier] ?? tier}
    </span>
  );
}

const THRESHOLDS = [0, 20, 300, 1000, 10000];
function masteryProgress(totalHours: number): number {
  let low = 0, high = THRESHOLDS[THRESHOLDS.length - 1];
  for (let i = 0; i < THRESHOLDS.length - 1; i++) {
    if (totalHours >= THRESHOLDS[i] && totalHours < THRESHOLDS[i + 1]) {
      low = THRESHOLDS[i];
      high = THRESHOLDS[i + 1];
      break;
    }
  }
  if (totalHours >= high) return 100;
  return Math.round(((totalHours - low) / (high - low)) * 100);
}
