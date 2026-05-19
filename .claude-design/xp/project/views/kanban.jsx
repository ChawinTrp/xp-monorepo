function Kanban({ onOpen }) {
  const D = window.XP_DATA;
  const allTasks = Object.values(D.nodes).filter((n) => n.type === "TASK" && !n.mainParent.startsWith("t.")); // hide subtasks

  const [tasks, setTasks] = React.useState(allTasks);
  const [dragId, setDragId] = React.useState(null);
  const [overCol, setOverCol] = React.useState(null);
  const [filter, setFilter] = React.useState("all");

  const projects = Object.values(D.nodes).filter((n) => n.type === "PROJECT");

  const filtered = filter === "all" ? tasks : tasks.filter((t) => {
    const crumb = D.breadcrumb(t.id);
    return [t.mainParent, ...crumb.map(c => c.id)].includes(filter);
  });

  const columns = [
    { key: "TODO", label: "To Do", color: "var(--overlay2)" },
    { key: "IN_PROGRESS", label: "In Progress", color: "var(--blue)" },
    { key: "DONE", label: "Done", color: "var(--green)" },
  ];

  const handleDrop = (status) => {
    if (!dragId) return;
    setTasks((cur) => cur.map((t) => t.id === dragId ? { ...t, status, overdue: status === "DONE" ? false : t.overdue, xpAwarded: status === "DONE" && t.xpAwarded == null ? 15 : t.xpAwarded } : t));
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="fade-in" style={{ padding: "24px 32px", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Filter bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
        paddingBottom: 16, borderBottom: "1px solid var(--surface1)",
      }}>
        <Icons.Filter size={14} stroke="var(--subtext1)" />
        <Dropdown
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All projects" },
            ...projects.map((p) => ({ value: p.id, label: p.title })),
          ]}
        />
        <Dropdown value="all" onChange={() => {}} options={[{ value: "all", label: "All tags" }]} />
        <Dropdown value="all" onChange={() => {}} options={[{ value: "all", label: "Any priority" }]} />
        <Dropdown value="all" onChange={() => {}} options={[{ value: "all", label: "Any date" }]} />
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 11, color: "var(--overlay1)" }}>
          {filtered.length} tasks
        </span>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
        flex: 1, overflow: "hidden",
      }}>
        {columns.map((col) => {
          const colTasks = filtered.filter((t) => t.status === col.key);
          const isOver = overCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={() => setOverCol((c) => c === col.key ? null : c)}
              onDrop={() => handleDrop(col.key)}
              style={{
                background: "var(--mantle)",
                borderRadius: 10,
                border: `1px ${isOver ? "dashed" : "solid"} ${isOver ? "var(--accent)" : "var(--surface1)"}`,
                display: "flex", flexDirection: "column",
                overflow: "hidden",
                transition: "all 200ms ease",
              }}
            >
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "14px 16px",
                borderBottom: "1px solid var(--surface1)",
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                <span style={{ fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 }}>{col.label}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--overlay1)" }}>{colTasks.length}</span>
                <div style={{ flex: 1 }} />
                <button style={{
                  background: "transparent", border: "none", color: "var(--overlay1)", cursor: "pointer",
                  padding: 4, borderRadius: 4, display: "grid", placeItems: "center",
                }}>
                  <Icons.Plus size={14} />
                </button>
              </div>
              <div style={{
                flex: 1, overflowY: "auto",
                padding: 12, display: "flex", flexDirection: "column", gap: 10,
              }}>
                {colTasks.map((t) => (
                  <NodeCard
                    key={t.id} node={t}
                    onOpen={onOpen}
                    draggable
                    dragging={dragId === t.id}
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div style={{
                    padding: "32px 12px", textAlign: "center", color: "var(--overlay0)",
                    fontSize: 12, border: "1px dashed var(--surface1)", borderRadius: 8,
                  }}>
                    {col.key === "DONE" ? "Nothing completed yet — you've got this!" : "Drop a task here"}
                  </div>
                )}
                <button style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
                  background: "transparent", border: "1px dashed var(--surface1)",
                  borderRadius: 8, color: "var(--overlay1)", fontSize: 12, cursor: "pointer",
                  marginTop: 4, fontFamily: "inherit",
                }}>
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

function Dropdown({ value, onChange, options }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 10px",
        background: "var(--surface0)", color: "var(--text)",
        border: "1px solid var(--surface1)", borderRadius: 6,
        fontSize: 12, fontFamily: "inherit", cursor: "pointer",
      }}>
        {current.label}
        <Icons.ChevronDown size={12} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: 180, zIndex: 50,
          background: "var(--surface0)", border: "1px solid var(--surface1)", borderRadius: 6,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden",
        }}>
          {options.map((o) => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{
              width: "100%", textAlign: "left", padding: "8px 12px",
              background: o.value === value ? "var(--surface1)" : "transparent",
              color: "var(--text)", border: "none", fontSize: 12, fontFamily: "inherit",
              cursor: "pointer",
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = o.value === value ? "var(--surface1)" : "transparent"}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

window.Kanban = Kanban;
window.Dropdown = Dropdown;
