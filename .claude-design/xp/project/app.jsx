// Main app: shell + routing.
const { useState, useEffect, useMemo } = React;

function App() {
  const D = window.XP_DATA;
  const [view, setView] = useState("dashboard"); // dashboard | kanban | skills | people | graph
  const [openId, setOpenId] = useState(null);     // node detail
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const onOpen = (id) => {
    if (!D.nodes[id]) return;
    setOpenId(id);
  };
  const onNavigate = (v) => {
    setOpenId(null);
    setView(v);
  };
  const closeDetail = () => setOpenId(null);

  // Breadcrumb context
  const breadcrumb = useMemo(() => {
    if (openId) {
      const n = D.nodes[openId];
      return [...D.breadcrumb(openId), n].map((c) => c.title);
    }
    return [labelForView(view)];
  }, [view, openId]);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--base)" }}>
      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        view={view} onNavigate={onNavigate}
        onOpen={onOpen} openId={openId}
        onSearch={() => setSearchOpen(true)}
      />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--base)" }}>
        <TopBar
          breadcrumb={breadcrumb}
          view={view}
          onNavigate={onNavigate}
          inDetail={!!openId}
        />
        <div style={{ flex: 1, overflowY: "auto" }}>
          {openId ? (
            <NodeDetail id={openId} onOpen={onOpen} onClose={closeDetail} />
          ) : (
            <ViewRenderer view={view} onOpen={onOpen} onNavigate={onNavigate} />
          )}
        </div>
      </main>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onOpen={onOpen} />
    </div>
  );
}

function labelForView(v) {
  return { dashboard: "Dashboard", kanban: "Kanban", skills: "Skills", people: "People", graph: "Graph", routines: "Routines" }[v];
}

function ViewRenderer({ view, onOpen, onNavigate }) {
  switch (view) {
    case "dashboard": return <Dashboard onOpen={onOpen} onNavigate={onNavigate} />;
    case "kanban": return <Kanban onOpen={onOpen} />;
    case "routines": return <RoutinesView onOpen={onOpen} />;
    case "skills": return <Skills onOpen={onOpen} />;
    case "people": return <People onOpen={onOpen} />;
    case "graph": return <GraphView onOpen={onOpen} />;
    default: return null;
  }
}

// ---------- Sidebar ----------
function Sidebar({ collapsed, setCollapsed, view, onNavigate, onOpen, openId, onSearch }) {
  const D = window.XP_DATA;
  const [expanded, setExpanded] = useState({ "d.work": true, "d.dev": true, "p.xp": true, "d.personal": true, "d.learning": false });

  const w = collapsed ? 56 : 248;

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: Icons.LayoutDashboard },
    { id: "kanban", label: "Kanban", icon: Icons.FolderKanban },
    { id: "routines", label: "Routines", icon: Icons.Repeat },
    { id: "skills", label: "Skills", icon: Icons.Zap },
    { id: "people", label: "People", icon: Icons.Users },
    { id: "graph", label: "Graph", icon: Icons.Network },
  ];

  return (
    <aside style={{
      width: w, flexShrink: 0,
      background: "var(--mantle)",
      borderRight: "1px solid var(--surface0)",
      display: "flex", flexDirection: "column",
      transition: "width 200ms ease",
      overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? "16px 12px" : "18px 18px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--surface0)",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "linear-gradient(135deg, var(--accent), var(--blue))",
          display: "grid", placeItems: "center",
          boxShadow: "0 4px 12px color-mix(in srgb, var(--accent) 35%, transparent)",
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--mantle)" }}>XP</span>
        </div>
        {!collapsed && (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Life OS</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--overlay1)" }}>v0.4 · CT</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} style={{
            background: "transparent", border: "none", color: "var(--overlay1)",
            padding: 4, cursor: "pointer", borderRadius: 4,
          }}><Icons.ChevronLeft size={14} /></button>
        )}
      </div>

      {/* Search trigger */}
      <div style={{ padding: collapsed ? "10px 8px" : "12px 14px" }}>
        <button onClick={onSearch} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: collapsed ? 8 : "8px 10px",
          background: "var(--surface0)", border: "1px solid var(--surface1)", borderRadius: 6,
          color: "var(--subtext1)", fontSize: 12, fontFamily: "inherit",
          cursor: "pointer", justifyContent: collapsed ? "center" : "space-between",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icons.Search size={13} />
            {!collapsed && "Search..."}
          </span>
          {!collapsed && (
            <span style={{ display: "inline-flex", gap: 3 }}>
              <Kbd>⌘</Kbd><Kbd>K</Kbd>
            </span>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ padding: collapsed ? "4px 8px" : "4px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {nav.map((n) => {
          const Active = view === n.id && !openId;
          return (
            <button key={n.id} onClick={() => onNavigate(n.id)}
              title={n.label}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: collapsed ? 8 : "8px 10px",
                background: Active ? hexToRgba("var(--accent)", 0.15) : "transparent",
                border: "none", borderRadius: 6,
                color: Active ? "var(--accent)" : "var(--subtext0)",
                fontFamily: "inherit", fontSize: 13, fontWeight: Active ? 600 : 500,
                cursor: "pointer", textAlign: "left",
                position: "relative",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
              onMouseEnter={(e) => { if (!Active) e.currentTarget.style.background = "var(--surface0)"; }}
              onMouseLeave={(e) => { if (!Active) e.currentTarget.style.background = "transparent"; }}
            >
              {Active && !collapsed && (
                <span style={{
                  position: "absolute", left: -12, top: 8, bottom: 8, width: 3,
                  background: "var(--accent)", borderRadius: 2,
                }} />
              )}
              <n.icon size={14} stroke={Active ? "var(--accent)" : "var(--subtext1)"} />
              {!collapsed && n.label}
            </button>
          );
        })}
      </nav>

      {/* Domain tree */}
      {!collapsed && (
        <>
          <div style={{
            margin: "16px 18px 8px",
            fontSize: 10, color: "var(--overlay1)",
            textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600,
          }}>
            Domain tree
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
            {Object.values(D.nodes).filter((n) => n.type === "DOMAIN" && !n.mainParent).map((root) => (
              <TreeNode key={root.id} node={root} depth={0}
                expanded={expanded} setExpanded={setExpanded}
                openId={openId} onOpen={onOpen}
              />
            ))}
          </div>
        </>
      )}
      {collapsed && <div style={{ flex: 1 }} />}

      {/* Quick create */}
      <div style={{ padding: collapsed ? 10 : 14, borderTop: "1px solid var(--surface0)" }}>
        {collapsed ? (
          <button onClick={() => setCollapsed(false)} style={{
            width: 36, height: 36, borderRadius: 8,
            background: "var(--accent)", border: "none", color: "var(--mantle)",
            cursor: "pointer", display: "grid", placeItems: "center",
            margin: "0 auto",
          }}>
            <Icons.Plus size={16} strokeWidth={2.4} />
          </button>
        ) : (
          <Button icon={<Icons.Plus size={14} />} style={{ width: "100%", justifyContent: "center" }}>
            New node
          </Button>
        )}
      </div>
    </aside>
  );
}

function TreeNode({ node, depth, expanded, setExpanded, openId, onOpen }) {
  const D = window.XP_DATA;
  const kids = D.children(node.id).filter((c) => c.type !== "PERSON" && c.type !== "TAG");
  const hasKids = kids.length > 0;
  const isOpen = expanded[node.id];
  const isActive = openId === node.id;

  return (
    <div>
      <div
        onClick={() => onOpen(node.id)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 6px",
          paddingLeft: 8 + depth * 14,
          borderRadius: 4,
          cursor: "pointer", position: "relative",
          background: isActive ? hexToRgba("var(--accent)", 0.13) : "transparent",
          color: isActive ? "var(--text)" : "var(--subtext0)",
          transition: "background 200ms",
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--surface0)"; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
      >
        {isActive && (
          <span style={{
            position: "absolute", left: 0, top: 4, bottom: 4, width: 3,
            background: "var(--accent)", borderRadius: 2,
          }} />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); if (hasKids) setExpanded((cur) => ({ ...cur, [node.id]: !cur[node.id] })); }}
          style={{
            background: "transparent", border: "none",
            color: "var(--overlay1)", padding: 0, cursor: "pointer",
            width: 14, height: 14, display: "grid", placeItems: "center", flexShrink: 0,
            visibility: hasKids ? "visible" : "hidden",
          }}
        >
          <Icons.ChevronRight size={11} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 200ms" }} />
        </button>
        <TypeIcon type={node.type} size={12} stroke={TYPE_COLOR[node.type]} />
        <span style={{
          flex: 1, fontSize: 12,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontWeight: node.type === "DOMAIN" ? 600 : 400,
        }}>
          {node.title}
        </span>
        {node.type === "SKILL" && node.level && (
          <span className="mono" style={{ fontSize: 9, color: "var(--c-tag)" }}>Lv.{node.level}</span>
        )}
        {node.type === "PROJECT" && node.progress != null && (
          <span className="mono" style={{ fontSize: 9, color: "var(--overlay1)" }}>{node.progress}%</span>
        )}
      </div>
      {isOpen && kids.map((k) => (
        <TreeNode key={k.id} node={k} depth={depth + 1}
          expanded={expanded} setExpanded={setExpanded}
          openId={openId} onOpen={onOpen}
        />
      ))}
    </div>
  );
}

// ---------- TopBar ----------
function TopBar({ breadcrumb, view, onNavigate, inDetail }) {
  return (
    <header style={{
      height: 56,
      display: "flex", alignItems: "center",
      padding: "0 24px",
      borderBottom: "1px solid var(--surface0)",
      background: "var(--base)",
      flexShrink: 0,
    }}>
      <div className="mono" style={{ fontSize: 12, color: "var(--subtext1)", display: "flex", alignItems: "center", gap: 6 }}>
        {breadcrumb.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Icons.ChevronRight size={10} stroke="var(--overlay0)" />}
            <span style={{ color: i === breadcrumb.length - 1 ? "var(--text)" : "var(--subtext1)" }}>{c}</span>
          </React.Fragment>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {!inDetail && (
        <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--mantle)", borderRadius: 8, border: "1px solid var(--surface0)" }}>
          {["dashboard", "kanban", "routines", "graph", "skills", "people"].map((v) => (
            <button key={v} onClick={() => onNavigate(v)} style={{
              padding: "5px 12px",
              background: view === v ? "var(--surface0)" : "transparent",
              color: view === v ? "var(--accent)" : "var(--subtext1)",
              border: "none", borderRadius: 6,
              fontFamily: "inherit", fontSize: 12, fontWeight: 600,
              textTransform: "capitalize", cursor: "pointer",
              transition: "all 200ms",
            }}>
              {labelForView(v)}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
