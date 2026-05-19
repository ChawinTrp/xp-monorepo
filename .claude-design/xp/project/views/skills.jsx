function Skills({ onOpen }) {
  const D = window.XP_DATA;
  const skills = Object.values(D.nodes).filter((n) => n.type === "SKILL");
  const grouped = {};
  for (const s of skills) {
    const root = D.breadcrumb(s.id)[0] || D.nodes[s.mainParent];
    const key = root?.title || "Other";
    (grouped[key] = grouped[key] || []).push(s);
  }
  const totalXp = skills.reduce((s, k) => s + k.xp, 0);
  const avgLv = (skills.reduce((s, k) => s + k.level, 0) / skills.length).toFixed(1);

  const [expanded, setExpanded] = React.useState({ "s.swe": true });

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.4 }}>Skills</h1>
        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <Stat label="Skills" value={skills.length} />
          <Stat label="Avg level" value={`Lv. ${avgLv}`} />
          <Stat label="Total XP" value={totalXp} mono />
          <Stat label="Most improved" value="SWE ↑45" highlight="var(--green)" />
        </div>
      </div>

      {Object.entries(grouped).map(([group, gskills]) => {
        const groupTotal = gskills.reduce((s, k) => s + k.xp, 0);
        return (
          <div key={group} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  display: "inline-block", width: 8, height: 8, borderRadius: 2,
                  background: "var(--c-domain)",
                }} />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--subtext0)" }}>
                  {group}
                </h2>
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--overlay1)" }}>
                total: {groupTotal.toLocaleString()} XP
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {gskills.map((s) => (
                <SkillCard key={s.id} skill={s}
                  expanded={!!expanded[s.id]}
                  onToggle={() => setExpanded((cur) => ({ ...cur, [s.id]: !cur[s.id] }))}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        );
      })}

      <FutureCard />
    </div>
  );
}

function Stat({ label, value, mono, highlight }) {
  return (
    <div style={{
      padding: "10px 14px",
      background: "var(--surface0)", borderRadius: 8,
      border: "1px solid var(--surface1)",
      display: "flex", flexDirection: "column", gap: 2, minWidth: 110,
    }}>
      <span style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{ fontSize: 16, fontWeight: 700, color: highlight || "var(--text)" }}>{value}</span>
    </div>
  );
}

function SkillCard({ skill, expanded, onToggle, onOpen }) {
  const D = window.XP_DATA;
  const pct = (skill.xp / skill.xpToNext) * 100;
  const projects = Object.values(D.nodes).filter((n) => n.type === "PROJECT" && (D.breadcrumb(n.id).some(b => b.id === skill.mainParent) || n.mainParent === skill.mainParent));

  return (
    <div
      onClick={onToggle}
      style={{
        background: "var(--surface0)",
        border: "1px solid var(--surface1)",
        borderRadius: 10,
        padding: 18,
        cursor: "pointer",
        transition: "all 200ms ease",
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--surface2)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--surface1)"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: hexToRgba("var(--c-skill)", 0.18),
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          <Icons.Zap size={18} stroke="var(--c-skill)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{skill.title}</span>
            <LevelBadge level={skill.level} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Sparkline data={skill.sparkline} color="var(--green)" width={70} height={20} />
          <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>↑{skill.weekGain} XP/wk</span>
          <Icons.ChevronDown size={16} stroke="var(--overlay1)" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
        <ProgressBar value={pct} color="var(--c-skill)" height={8} />
        <span className="mono" style={{ fontSize: 12, color: "var(--subtext0)", minWidth: 120, textAlign: "right" }}>
          {skill.xp}/{skill.xpToNext} XP · {Math.round(pct)}%
        </span>
      </div>

      {expanded && (
        <div onClick={(e) => e.stopPropagation()} className="fade-in" style={{
          marginTop: 16, paddingTop: 16,
          borderTop: "1px solid var(--surface1)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--subtext1)", marginBottom: 4 }}>
            Contributing projects
          </div>
          {projects.slice(0, 4).map((p) => (
            <div key={p.id} onClick={() => onOpen(p.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer",
            }}>
              <Icons.FolderKanban size={14} stroke="var(--c-project)" />
              <span style={{ fontSize: 13, minWidth: 160 }}>{p.title}</span>
              <div style={{ flex: 1, maxWidth: 240 }}>
                <ProgressBar value={p.progress || 0} color="var(--c-project)" height={5} />
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--subtext1)", minWidth: 40, textAlign: "right" }}>{p.progress}%</span>
              <span style={{
                fontSize: 10, fontWeight: 600,
                padding: "2px 6px", borderRadius: 4,
                background: p.status === "DONE" ? hexToRgba("var(--c-skill)", 0.16) : hexToRgba("var(--blue)", 0.16),
                color: p.status === "DONE" ? "var(--green)" : "var(--blue)",
                textTransform: "uppercase", letterSpacing: 0.4,
                minWidth: 92, textAlign: "center",
              }}>
                {p.status === "DONE" ? "Done" : "In progress"}
              </span>
            </div>
          ))}
          <div style={{
            marginTop: 8, padding: "8px 12px",
            background: "var(--mantle)", borderRadius: 6,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icons.CheckCircle size={12} stroke="var(--green)" />
            <span style={{ fontSize: 12, color: "var(--subtext0)" }}>Recent: Fix auth bug</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--green)" }}>+25 XP</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--overlay1)", marginLeft: "auto" }}>2h ago</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FutureCard() {
  const milestones = [
    { label: "You", hours: 200, color: "var(--accent)" },
    { label: "Junior", hours: 1000, color: "var(--blue)" },
    { label: "Senior", hours: 5000, color: "var(--orange)" },
    { label: "Mastery", hours: 10000, color: "var(--yellow)" },
  ];
  const max = 10000;
  return (
    <div style={{
      padding: 24,
      background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--surface0)), var(--surface0))",
      border: "1px solid color-mix(in srgb, var(--accent) 20%, var(--surface1))",
      borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Icons.Target size={16} stroke="var(--accent)" />
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--accent)", fontWeight: 700 }}>
          Future: World's greatest
        </span>
      </div>
      <h3 style={{ margin: "4px 0 16px", fontSize: 18, fontWeight: 600 }}>10,000 hour horizon — SWE</h3>

      <div style={{ position: "relative", height: 56, marginBottom: 8 }}>
        <div style={{
          position: "absolute", top: 24, left: 0, right: 0, height: 8,
          background: "var(--surface1)", borderRadius: 4,
        }} />
        <div style={{
          position: "absolute", top: 24, left: 0, width: `${(200 / max) * 100}%`, height: 8,
          background: "linear-gradient(90deg, var(--accent), var(--blue))",
          borderRadius: 4,
          boxShadow: "0 0 12px color-mix(in srgb, var(--accent) 50%, transparent)",
        }} />
        {milestones.map((m, i) => {
          const pct = (m.hours / max) * 100;
          return (
            <div key={i} style={{
              position: "absolute", top: 0, left: `${pct}%`, transform: "translateX(-50%)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <div style={{
                width: 2, height: 22, background: m.color, borderRadius: 1,
              }} />
              <div style={{ position: "absolute", top: 22, width: 12, height: 12, borderRadius: "50%", background: m.color, border: "3px solid var(--base)" }} />
              <div style={{ position: "absolute", top: 38, fontSize: 10, color: m.color, fontWeight: 600, whiteSpace: "nowrap" }} className="mono">
                {m.hours.toLocaleString()}h
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, fontSize: 11, color: "var(--subtext1)" }}>
        <span>You · 200h logged</span>
        <span>Mastery · 9,800h to go</span>
      </div>
    </div>
  );
}

window.Skills = Skills;
