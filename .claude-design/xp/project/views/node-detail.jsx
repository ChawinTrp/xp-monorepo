function NodeDetail({ id, onOpen, onClose }) {
  const D = window.XP_DATA;
  const n = D.nodes[id];
  if (!n) return null;
  const crumb = D.breadcrumb(id);
  const children = D.children(id);

  const [status, setStatus] = React.useState(n.status || "TODO");
  const [priority, setPriority] = React.useState(n.priority || "medium");
  const [progress, setProgress] = React.useState(n.progress || 60);

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: "var(--subtext1)",
            padding: 4, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
            fontFamily: "inherit", fontSize: 12,
          }}>
            <Icons.ChevronLeft size={14} /> Back
          </button>
          <span style={{ color: "var(--overlay0)" }}>·</span>
          <div className="mono" style={{ fontSize: 11, color: "var(--subtext1)", display: "flex", alignItems: "center", gap: 6 }}>
            {crumb.map((c, i) => (
              <React.Fragment key={c.id}>
                <span onClick={() => onOpen(c.id)} style={{ cursor: "pointer" }}>{c.title}</span>
                <Icons.ChevronRight size={10} stroke="var(--overlay0)" />
              </React.Fragment>
            ))}
            <span style={{ color: "var(--text)" }}>{n.title}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <TypeBadge type={n.type} />
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.4 }}>{n.title}</h1>
          {n.overdue && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 600, color: "var(--red)",
              padding: "3px 8px", background: hexToRgba("var(--red)", 0.14), borderRadius: 4,
            }}>
              <Icons.AlertTriangle size={11} /> Overdue
            </span>
          )}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--overlay1)", marginTop: 8 }}>
          Created 15 May · Updated 19 May · id: {n.id}
        </div>
      </div>

      {/* Two column */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionCard title="Description">
            <textarea
              defaultValue={n.description || "Add a description for this node…"}
              style={{
                width: "100%", minHeight: 110, resize: "vertical",
                background: "var(--base)", color: "var(--text)",
                border: "1px solid var(--surface1)", borderRadius: 8, padding: 12,
                fontFamily: "inherit", fontSize: 13, lineHeight: 1.55,
              }}
            />
          </SectionCard>

          <SectionCard title="Connections">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
                  Main parent
                </div>
                <div className="mono" style={{ fontSize: 12, color: "var(--subtext0)" }}>
                  {crumb.map((c) => c.title).join(" / ")}
                </div>
              </div>
              {n.extraParents && (
                <div>
                  <div style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
                    Additional parents
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {n.extraParents.map((pid) => {
                      const p = D.nodes[pid];
                      if (!p) return null;
                      return (
                        <button key={pid} onClick={() => onOpen(pid)} style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "5px 10px",
                          background: hexToRgba(TYPE_COLOR[p.type], 0.14),
                          color: TYPE_COLOR[p.type], border: "none", borderRadius: 6,
                          fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                        }}>
                          <TypeIcon type={p.type} size={12} />
                          {p.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
                  Children ({children.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {children.length === 0 && <div style={{ fontSize: 12, color: "var(--overlay1)" }}>No child nodes.</div>}
                  {children.map((c) => (
                    <button key={c.id} onClick={() => onOpen(c.id)} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", textAlign: "left",
                      background: "transparent",
                      border: "1px solid var(--surface1)", borderRadius: 6,
                      color: "var(--text)", fontFamily: "inherit", fontSize: 13, cursor: "pointer",
                      transition: "background 200ms",
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface0)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {c.type === "TASK" ? (
                        <span style={{
                          width: 14, height: 14, borderRadius: 3,
                          border: `1.5px solid ${c.status === "DONE" ? "var(--green)" : "var(--overlay1)"}`,
                          background: c.status === "DONE" ? "var(--green)" : "transparent",
                          display: "inline-grid", placeItems: "center",
                        }}>
                          {c.status === "DONE" && <Icons.CheckCircle size={9} stroke="var(--mantle)" strokeWidth={3} />}
                        </span>
                      ) : <TypeIcon type={c.type} size={12} stroke={TYPE_COLOR[c.type]} />}
                      <span style={{
                        flex: 1, textDecoration: c.status === "DONE" ? "line-through" : "none",
                        color: c.status === "DONE" ? "var(--subtext1)" : "var(--text)",
                      }}>{c.title}</span>
                      {c.status && <span style={{ fontSize: 10, color: "var(--overlay1)", letterSpacing: 0.4 }}>{c.status}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionCard title="Properties">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {n.type === "TASK" && (
                <>
                  <Field label="Status">
                    <SegmentedStatus value={status} onChange={setStatus} />
                  </Field>
                  <Field label="Progress">
                    <SliderField value={progress} onChange={setProgress} />
                  </Field>
                  <Field label="Due date">
                    <FakeDate value={n.due || "Pick date"} />
                  </Field>
                  <Field label="Priority">
                    <SegmentedPriority value={priority} onChange={setPriority} />
                  </Field>
                </>
              )}
              {n.type === "PROJECT" && (
                <>
                  <Field label="Status">{n.status}</Field>
                  <Field label="Progress">
                    <ProgressBar value={n.progress || 0} color="var(--c-project)" showLabel />
                  </Field>
                  <Field label="Start">{n.start}</Field>
                  <Field label="End">{n.end}</Field>
                </>
              )}
              {n.type === "SKILL" && (
                <>
                  <Field label="Level"><LevelBadge level={n.level} /></Field>
                  <Field label="XP">
                    <ProgressBar value={(n.xp / n.xpToNext) * 100} color="var(--c-skill)" />
                    <div className="mono" style={{ fontSize: 11, color: "var(--subtext0)", marginTop: 6 }}>
                      {n.xp} / {n.xpToNext} XP · {n.xpToNext - n.xp} to next level
                    </div>
                  </Field>
                </>
              )}
              {n.type === "PERSON" && (
                <>
                  <Field label="Email"><FakeInput value={n.email} /></Field>
                  <Field label="Phone"><FakeInput value={n.phone} /></Field>
                  <Field label="Next catch-up"><FakeDate value={n.nextCatchup || "Schedule"} /></Field>
                  <Button icon={<Icons.CalendarDays size={12} />}>Schedule catch-up</Button>
                </>
              )}
              {n.type === "DOMAIN" && (
                <div style={{ fontSize: 12, color: "var(--subtext1)" }}>
                  Domains are containers — no additional properties.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Tags">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(n.tags || ["urgent", "deploy"]).map((t) => <TagChip key={t} label={t} />)}
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 8px", background: "transparent",
                border: "1px dashed var(--surface2)", borderRadius: 4,
                color: "var(--overlay1)", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              }}>
                <Icons.Plus size={10} /> Add tag
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{
        display: "flex", justifyContent: "flex-end", gap: 12,
        marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--surface1)",
      }}>
        <Button variant="danger" icon={<Icons.Trash size={12} />}>Delete</Button>
        <Button icon={<Icons.Save size={12} />}>Save changes</Button>
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{
      background: "var(--surface0)",
      border: "1px solid var(--surface1)",
      borderRadius: 12,
      padding: 18,
    }}>
      <div style={{
        fontSize: 11, color: "var(--subtext0)", textTransform: "uppercase",
        letterSpacing: 0.8, fontWeight: 600, marginBottom: 12,
      }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function SegmentedStatus({ value, onChange }) {
  const opts = [
    { v: "TODO", label: "To do", color: "var(--overlay2)" },
    { v: "IN_PROGRESS", label: "In progress", color: "var(--blue)" },
    { v: "DONE", label: "Done", color: "var(--green)" },
  ];
  return (
    <div style={{ display: "flex", background: "var(--mantle)", borderRadius: 6, padding: 3, gap: 2 }}>
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          flex: 1, padding: "6px 8px",
          background: value === o.v ? "var(--surface1)" : "transparent",
          color: value === o.v ? o.color : "var(--subtext1)",
          border: "none", borderRadius: 4,
          fontFamily: "inherit", fontSize: 11, fontWeight: 600,
          cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.4,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: o.color }} />
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SegmentedPriority({ value, onChange }) {
  const opts = [
    { v: "low", label: "Low", color: "var(--green)" },
    { v: "medium", label: "Medium", color: "var(--yellow)" },
    { v: "high", label: "High", color: "var(--red)" },
  ];
  return (
    <div style={{ display: "flex", background: "var(--mantle)", borderRadius: 6, padding: 3, gap: 2 }}>
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          flex: 1, padding: "6px 8px",
          background: value === o.v ? "var(--surface1)" : "transparent",
          color: value === o.v ? o.color : "var(--subtext1)",
          border: "none", borderRadius: 4,
          fontFamily: "inherit", fontSize: 11, fontWeight: 600,
          cursor: "pointer",
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SliderField({ value, onChange }) {
  return (
    <div>
      <input type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)" }}
      />
      <div className="mono" style={{ fontSize: 11, color: "var(--subtext0)", textAlign: "right" }}>{value}%</div>
    </div>
  );
}

function FakeDate({ value }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "8px 12px",
      background: "var(--mantle)", border: "1px solid var(--surface1)", borderRadius: 6,
      fontSize: 12, color: "var(--text)",
    }}>
      <Icons.CalendarDays size={12} stroke="var(--subtext1)" />
      <span className="mono">{value}</span>
    </div>
  );
}

function FakeInput({ value }) {
  return (
    <input defaultValue={value} style={{
      width: "100%", padding: "8px 12px",
      background: "var(--mantle)", border: "1px solid var(--surface1)", borderRadius: 6,
      color: "var(--text)", fontFamily: "inherit", fontSize: 12,
    }} />
  );
}

window.NodeDetail = NodeDetail;
