function SearchModal({ open, onClose, onOpen }) {
  const D = window.XP_DATA;
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = React.useMemo(() => {
    const all = Object.values(D.nodes);
    const ql = q.toLowerCase();
    if (!ql) {
      return all.filter((n) => n.type !== "TAG").slice(0, 8);
    }
    return all.filter((n) => n.title.toLowerCase().includes(ql)).slice(0, 12);
  }, [q]);

  React.useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      if (e.key === "Enter" && results[active]) { e.preventDefault(); onOpen(results[active].id); onClose(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, results, active]);

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(17, 17, 27, 0.7)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "12vh",
      animation: "fadeIn 150ms ease both",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 520, maxWidth: "92vw",
        background: "var(--mantle)",
        border: "1px solid var(--surface1)",
        borderRadius: 12,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px",
          borderBottom: "1px solid var(--surface1)",
        }}>
          <Icons.Search size={16} stroke="var(--subtext1)" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Search nodes…"
            style={{
              flex: 1, background: "transparent", border: "none",
              color: "var(--text)", fontFamily: "inherit", fontSize: 15,
              outline: "none",
            }}
          />
          <Kbd>ESC</Kbd>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto", padding: 6 }}>
          {results.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--overlay1)", fontSize: 13 }}>
              No matches.
            </div>
          )}
          {results.map((n, i) => {
            const isActive = i === active;
            return (
              <button
                key={n.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => { onOpen(n.id); onClose(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "10px 12px", textAlign: "left",
                  background: isActive ? "var(--surface0)" : "transparent",
                  color: "var(--text)", border: "none", borderRadius: 8,
                  fontFamily: "inherit", cursor: "pointer",
                }}>
                <TypeBadge type={n.type} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{n.title}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--subtext1)" }}>
                  {nodeBreadcrumb(n.id)}
                </span>
                {isActive && <Icons.ArrowRight size={12} stroke="var(--accent)" />}
              </button>
            );
          })}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "8px 16px", borderTop: "1px solid var(--surface1)",
          fontSize: 11, color: "var(--overlay1)",
        }}>
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> open</span>
          <div style={{ flex: 1 }} />
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }) {
  return (
    <span className="mono" style={{
      display: "inline-block", padding: "1px 6px",
      background: "var(--surface0)", border: "1px solid var(--surface1)", borderRadius: 4,
      fontSize: 10, color: "var(--subtext1)", lineHeight: 1.5,
    }}>{children}</span>
  );
}

window.SearchModal = SearchModal;
window.Kbd = Kbd;
