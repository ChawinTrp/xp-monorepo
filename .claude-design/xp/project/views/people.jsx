function People({ onOpen }) {
  const D = window.XP_DATA;
  const people = Object.values(D.nodes).filter((n) => n.type === "PERSON");

  // Group definitions in display order with palette
  const GROUP_META = [
    { name: "Family",        color: "var(--c-person)", icon: <Icons.User size={14} stroke="var(--c-person)" /> },
    { name: "Close Friends", color: "var(--accent)",   icon: <Icons.Sparkles size={14} stroke="var(--accent)" /> },
    { name: "Core Team",     color: "var(--orange)",   icon: <Icons.Users size={14} stroke="var(--orange)" /> },
    { name: "Aura Team",     color: "var(--blue)",     icon: <Icons.Users size={14} stroke="var(--blue)" /> },
    { name: "Mentors",       color: "var(--yellow)",   icon: <Icons.Award size={14} stroke="var(--yellow)" /> },
    { name: "Network",       color: "var(--c-routine)", icon: <Icons.Network size={14} stroke="var(--c-routine)" /> },
  ];

  const byGroup = {};
  for (const meta of GROUP_META) byGroup[meta.name] = [];
  for (const p of people) {
    if (!byGroup[p.circle]) byGroup[p.circle] = [];
    byGroup[p.circle].push(p);
  }

  const overdue = people.filter((p) => p.catchupState === "overdue");
  const upcoming = people.filter((p) => p.catchupState === "upcoming");

  const [focused, setFocused] = React.useState(null);

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.4 }}>People</h1>
          <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12 }}>
            <span style={{ color: "var(--subtext1)" }}>{people.length} contacts</span>
            <span style={{ color: "var(--subtext1)" }}>·</span>
            <span style={{ color: "var(--subtext1)" }}>{GROUP_META.filter(g => byGroup[g.name].length).length} circles</span>
            <span style={{ color: "var(--subtext1)" }}>·</span>
            <span style={{ color: "var(--red)" }}>⚠ {overdue.length} overdue catch-up{overdue.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" icon={<Icons.Plus size={14} />}>New circle</Button>
          <Button icon={<Icons.Plus size={14} />}>Add person</Button>
        </div>
      </div>

      {/* Attention strip: overdue catch-ups */}
      {overdue.length > 0 && (
        <div style={{
          padding: 14,
          background: "color-mix(in srgb, var(--red) 8%, var(--surface0))",
          border: "1px solid color-mix(in srgb, var(--red) 25%, var(--surface1))",
          borderRadius: 10, marginBottom: 24,
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--red)" }}>
            <Icons.AlertTriangle size={14} stroke="var(--red)" />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Overdue catch-ups
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {overdue.map((p) => (
              <button key={p.id} onClick={() => onOpen(p.id)} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "5px 10px 5px 5px",
                background: "var(--surface0)",
                border: "1px solid color-mix(in srgb, var(--red) 30%, var(--surface1))",
                borderRadius: 999, color: "var(--text)",
                fontFamily: "inherit", fontSize: 12, cursor: "pointer",
              }}>
                <Avatar initials={p.initials} size={22} color="var(--c-person)" />
                <span style={{ fontWeight: 600 }}>{p.title}</span>
                <span style={{ color: "var(--red)", fontSize: 11 }}>{p.relativeDate}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Circle sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {GROUP_META.map((meta) => {
          const members = byGroup[meta.name] || [];
          if (members.length === 0) return null;
          const groupOverdue = members.filter((m) => m.catchupState === "overdue").length;
          const groupUpcoming = members.filter((m) => m.catchupState === "upcoming").length;
          return (
            <CircleSection
              key={meta.name}
              meta={meta}
              members={members}
              overdue={groupOverdue}
              upcoming={groupUpcoming}
              onOpen={onOpen}
              focused={focused}
              setFocused={setFocused}
            />
          );
        })}
      </div>
    </div>
  );
}

function CircleSection({ meta, members, overdue, upcoming, onOpen, focused, setFocused }) {
  return (
    <section>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `color-mix(in srgb, ${meta.color} 18%, var(--surface0))`,
          border: `1px solid color-mix(in srgb, ${meta.color} 30%, var(--surface1))`,
          display: "grid", placeItems: "center",
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
            {meta.name}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 11, color: "var(--subtext1)" }}>
            <span>{members.length} {members.length === 1 ? "person" : "people"}</span>
            {overdue > 0 && <><span>·</span><span style={{ color: "var(--red)" }}>{overdue} overdue</span></>}
            {upcoming > 0 && <><span>·</span><span style={{ color: "var(--green)" }}>{upcoming} upcoming</span></>}
          </div>
        </div>
        <button style={{
          background: "transparent", border: "1px solid var(--surface1)",
          borderRadius: 6, padding: "5px 10px",
          color: "var(--subtext1)", fontFamily: "inherit", fontSize: 11,
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          <Icons.Plus size={11} /> Add
        </button>
      </header>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
        paddingLeft: 48, position: "relative",
      }}>
        {/* Subtle left tether */}
        <div style={{
          position: "absolute", left: 18, top: -6, bottom: 6,
          width: 1, background: `linear-gradient(to bottom, ${meta.color}, transparent)`,
          opacity: 0.25,
        }} />
        {members.map((p) => (
          <PersonChip key={p.id} person={p} circleColor={meta.color} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function PersonChip({ person, circleColor, onOpen }) {
  const stateStyle = {
    overdue: { color: "var(--red)", bg: "color-mix(in srgb, var(--red) 12%, transparent)" },
    upcoming: { color: "var(--green)", bg: "color-mix(in srgb, var(--green) 10%, transparent)" },
    none: { color: "var(--overlay1)", bg: "transparent" },
  }[person.catchupState];

  return (
    <button
      onClick={() => onOpen(person.id)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px",
        background: "var(--surface0)",
        border: "1px solid var(--surface1)",
        borderRadius: 10, cursor: "pointer",
        fontFamily: "inherit", textAlign: "left",
        transition: "all 200ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `color-mix(in srgb, ${circleColor} 50%, var(--surface1))`;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--surface1)";
        e.currentTarget.style.transform = "none";
      }}
    >
      <Avatar initials={person.initials} size={36} color={circleColor} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {person.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--subtext1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {person.role}
        </div>
      </div>
      <div style={{
        display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2,
        padding: "3px 7px", borderRadius: 4,
        background: stateStyle.bg,
      }}>
        {person.catchupState !== "none" ? (
          <>
            <span style={{ fontSize: 9, color: stateStyle.color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {person.catchupState === "overdue" ? "Overdue" : "Catch-up"}
            </span>
            <span className="mono" style={{ fontSize: 10, color: stateStyle.color }}>{person.relativeDate}</span>
          </>
        ) : (
          <Icons.CalendarDays size={12} stroke="var(--overlay1)" />
        )}
      </div>
    </button>
  );
}

window.People = People;
