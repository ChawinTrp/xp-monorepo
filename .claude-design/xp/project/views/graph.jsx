function GraphView({ onOpen }) {
  const D = window.XP_DATA;
  const [selected, setSelected] = React.useState(null);
  const [layout, setLayout] = React.useState("hierarchical");
  const [filters, setFilters] = React.useState({
    DOMAIN: true, SKILL: true, PROJECT: true, TASK: true, PERSON: true, TAG: false,
  });
  const [zoom, setZoom] = React.useState(1);

  // Pick a subset of nodes for the view, then position them hierarchically.
  const layoutSpec = React.useMemo(() => buildLayout(D, filters), [filters]);

  const W = 1100;
  const H = 640;

  return (
    <div className="fade-in" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14, marginBottom: 14,
        paddingBottom: 14, borderBottom: "1px solid var(--surface1)",
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(filters).map(([type, on]) => (
            <button key={type}
              onClick={() => setFilters((f) => ({ ...f, [type]: !f[type] }))}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 10px",
                background: on ? hexToRgba(TYPE_COLOR[type], 0.18) : "var(--surface0)",
                color: on ? TYPE_COLOR[type] : "var(--overlay1)",
                border: `1px solid ${on ? TYPE_COLOR[type] : "var(--surface1)"}`,
                borderRadius: 4, fontFamily: "inherit",
                fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
                textTransform: "uppercase", cursor: "pointer", transition: "all 200ms",
              }}>
              <TypeIcon type={type} size={11} />
              {type}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Dropdown value={layout} onChange={setLayout} options={[
          { value: "hierarchical", label: "Hierarchical" },
          { value: "radial", label: "Radial (preview)" },
        ]} />
        <div style={{ display: "flex", gap: 4, background: "var(--surface0)", border: "1px solid var(--surface1)", borderRadius: 6 }}>
          <ZoomBtn onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>−</ZoomBtn>
          <span className="mono" style={{ minWidth: 44, textAlign: "center", padding: "4px 0", fontSize: 11, color: "var(--subtext1)" }}>
            {Math.round(zoom * 100)}%
          </span>
          <ZoomBtn onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>+</ZoomBtn>
          <ZoomBtn onClick={() => setZoom(1)}>Fit</ZoomBtn>
        </div>
      </div>

      {/* Canvas + side panel */}
      <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
        <div style={{
          flex: 1, position: "relative", overflow: "hidden",
          background: "var(--mantle)", borderRadius: 12,
          border: "1px solid var(--surface1)",
          backgroundImage:
            "radial-gradient(circle, var(--surface1) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "12px 12px",
        }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: "block" }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--overlay0)" />
              </marker>
              <marker id="arrow-dash" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--overlay0)" opacity="0.6" />
              </marker>
            </defs>
            <g transform={`translate(${(W * (1 - zoom)) / 2}, ${(H * (1 - zoom)) / 2}) scale(${zoom})`}>
              {/* edges */}
              {layoutSpec.edges.map((e, i) => {
                const a = layoutSpec.positions[e.from];
                const b = layoutSpec.positions[e.to];
                if (!a || !b) return null;
                const isSel = selected && (selected === e.from || selected === e.to);
                return (
                  <line key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={isSel ? "var(--accent)" : "var(--overlay0)"}
                    strokeWidth={isSel ? 2.2 : (e.dashed ? 1 : 1.6)}
                    strokeDasharray={e.dashed ? "4 4" : "0"}
                    opacity={selected && !isSel ? 0.25 : 0.7}
                    markerEnd={e.dashed ? "url(#arrow-dash)" : "url(#arrow)"}
                  />
                );
              })}

              {/* nodes */}
              {Object.entries(layoutSpec.positions).map(([id, pos]) => {
                const n = D.nodes[id];
                if (!n) return null;
                const isSel = selected === id;
                const dim = nodeDim(n.type);
                const color = TYPE_COLOR[n.type];
                return (
                  <g key={id}
                    transform={`translate(${pos.x - dim.w / 2}, ${pos.y - dim.h / 2})`}
                    onClick={() => setSelected(id)}
                    style={{ cursor: "pointer" }}
                    opacity={selected && !isSel ? 0.5 : 1}
                  >
                    {isSel && (
                      <rect x={-4} y={-4} width={dim.w + 8} height={dim.h + 8} rx={10}
                        fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
                    )}
                    <rect x={0} y={0} width={dim.w} height={dim.h} rx={8}
                      fill="var(--surface0)" stroke={color} strokeWidth={2}
                      style={{ filter: isSel ? `drop-shadow(0 0 8px ${color})` : "none" }} />
                    <foreignObject x={0} y={0} width={dim.w} height={dim.h}>
                      <div style={{
                        width: "100%", height: "100%",
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        gap: 2, padding: 4,
                        color: "var(--text)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <TypeIcon type={n.type} size={10} stroke={color} />
                          <span style={{
                            fontSize: n.type === "TAG" ? 9 : 11,
                            fontWeight: 600,
                            maxWidth: dim.w - 16,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>{n.title}</span>
                        </div>
                        {n.type === "SKILL" && (
                          <span className="mono" style={{ fontSize: 9, color: "var(--c-tag)", fontWeight: 700 }}>Lv.{n.level}</span>
                        )}
                        {n.type === "TASK" && (
                          <StatusDot status={n.status} size={6} />
                        )}
                        {n.type === "PROJECT" && (
                          <div style={{ width: "70%", height: 3, background: "var(--surface1)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${n.progress || 0}%`, height: "100%", background: color }} />
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
          <div style={{
            position: "absolute", bottom: 12, right: 12,
            width: 140, height: 90,
            background: "var(--base)", border: "1px solid var(--surface1)", borderRadius: 6,
            padding: 4,
          }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
              {Object.entries(layoutSpec.positions).map(([id, pos]) => {
                const n = D.nodes[id];
                return <circle key={id} cx={pos.x} cy={pos.y} r={14} fill={TYPE_COLOR[n.type]} opacity={0.7} />;
              })}
              <rect x={W*0.05} y={H*0.05} width={W*0.9} height={H*0.9} fill="none" stroke="var(--accent)" strokeWidth={6} />
            </svg>
          </div>
        </div>

        {selected && <GraphSidePanel id={selected} onClose={() => setSelected(null)} onOpen={onOpen} />}
      </div>
    </div>
  );
}

function ZoomBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "none", color: "var(--subtext1)",
      padding: "4px 10px", fontFamily: "inherit", fontSize: 13, cursor: "pointer",
    }}>{children}</button>
  );
}

function nodeDim(type) {
  switch (type) {
    case "DOMAIN": return { w: 140, h: 60 };
    case "SKILL": return { w: 110, h: 54 };
    case "PROJECT": return { w: 120, h: 54 };
    case "TASK": return { w: 96, h: 44 };
    case "PERSON": return { w: 96, h: 54 };
    case "TAG": return { w: 70, h: 30 };
    default: return { w: 100, h: 50 };
  }
}

function buildLayout(D, filters) {
  const visibleNodes = Object.values(D.nodes).filter((n) => filters[n.type]);
  const positions = {};
  const edges = [];

  // Specifically lay out a tree based on the data graph for the canvas
  // Tier layout:
  const tiers = {
    DOMAIN_ROOT: [],
    DOMAIN_SUB: [],
    SKILL_PROJECT: [],
    TASK: [],
    PERSON: [],
  };
  for (const n of visibleNodes) {
    if (n.type === "DOMAIN" && !n.mainParent) tiers.DOMAIN_ROOT.push(n);
    else if (n.type === "DOMAIN") tiers.DOMAIN_SUB.push(n);
    else if (n.type === "SKILL" || n.type === "PROJECT") tiers.SKILL_PROJECT.push(n);
    else if (n.type === "TASK") tiers.TASK.push(n);
    else if (n.type === "PERSON") tiers.PERSON.push(n);
  }

  const W = 1100, H = 640;
  const place = (arr, y) => {
    const step = W / (arr.length + 1);
    arr.forEach((n, i) => { positions[n.id] = { x: step * (i + 1), y }; });
  };
  place(tiers.DOMAIN_ROOT, 80);
  place(tiers.DOMAIN_SUB, 200);
  place(tiers.SKILL_PROJECT, 340);
  place(tiers.TASK, 470);
  place(tiers.PERSON, 580);

  // Edges from mainParent + extraParents
  for (const n of visibleNodes) {
    if (n.mainParent && positions[n.mainParent]) {
      edges.push({ from: n.mainParent, to: n.id, dashed: false });
    }
    for (const ep of (n.extraParents || [])) {
      if (positions[ep]) edges.push({ from: ep, to: n.id, dashed: true });
    }
  }

  return { positions, edges };
}

function GraphSidePanel({ id, onClose, onOpen }) {
  const D = window.XP_DATA;
  const n = D.nodes[id];
  if (!n) return null;
  return (
    <div className="fade-in" style={{
      width: 320, background: "var(--surface0)", borderRadius: 12,
      border: "1px solid var(--surface1)", padding: 20,
      display: "flex", flexDirection: "column", gap: 14,
      animation: "slideRight 200ms ease both",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <TypeBadge type={n.type} />
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: "var(--overlay1)", cursor: "pointer", padding: 4,
        }}><Icons.X size={14} /></button>
      </div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{n.title}</h2>
      <div className="mono" style={{ fontSize: 11, color: "var(--subtext1)" }}>
        {nodeBreadcrumb(id) || "—"}
      </div>
      {n.type === "TASK" && (
        <>
          <Row label="Status"><StatusDot status={n.status} /> <span>{n.status}</span></Row>
          {n.priority && <Row label="Priority">{n.priority}</Row>}
          {n.due && <Row label="Due">{formatShort(n.due)}</Row>}
        </>
      )}
      {n.type === "PROJECT" && (
        <>
          <Row label="Status">{n.status}</Row>
          <div>
            <div style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", marginBottom: 4 }}>Progress</div>
            <ProgressBar value={n.progress || 0} color="var(--c-project)" showLabel />
          </div>
        </>
      )}
      {n.type === "SKILL" && (
        <>
          <Row label="Level"><LevelBadge level={n.level} /></Row>
          <div>
            <div style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", marginBottom: 4 }}>XP</div>
            <ProgressBar value={(n.xp / n.xpToNext) * 100} color="var(--c-skill)" />
            <div className="mono" style={{ fontSize: 11, color: "var(--subtext0)", marginTop: 4 }}>
              {n.xp}/{n.xpToNext} XP
            </div>
          </div>
        </>
      )}
      {n.description && (
        <div style={{ fontSize: 12, color: "var(--subtext0)", padding: 10, background: "var(--mantle)", borderRadius: 6 }}>
          {n.description}
        </div>
      )}
      <Button variant="secondary" icon={<Icons.ArrowRight size={12} />} onClick={() => onOpen(id)}>
        Open full detail
      </Button>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6, minWidth: 70 }}>{label}</span>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>{children}</div>
    </div>
  );
}

window.GraphView = GraphView;
