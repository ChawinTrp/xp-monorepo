function RoutinesView({ onOpen }) {
  const D = window.XP_DATA;
  const routines = Object.values(D.nodes).filter((n) => n.type === "ROUTINE");
  const [selectedGroup, setSelectedGroup] = React.useState("all");
  const [selectedCadence, setSelectedCadence] = React.useState("all");

  const groups = Array.from(new Set(routines.map((r) => r.group)));
  const filtered = routines.filter((r) =>
    (selectedGroup === "all" || r.group === selectedGroup) &&
    (selectedCadence === "all" || r.cadence === selectedCadence)
  );

  // Overall consistency = average of (done / scheduled) over 30 days
  const overallPct = Math.round(
    routines.reduce((s, r) => s + (r.history.reduce((a, b) => a + b, 0) / r.history.length), 0) / routines.length * 100
  );
  const longestStreak = routines.reduce((m, r) => Math.max(m, r.streak), 0);
  const topRoutine = routines.reduce((best, r) => r.streak > (best?.streak || 0) ? r : best, null);

  // Per-day totals (last 30 days)
  const dayTotals = Array.from({ length: 30 }).map((_, i) =>
    routines.reduce((s, r) => s + (r.history[i] || 0), 0)
  );
  const maxDay = Math.max(...dayTotals);

  // Today is index 29
  const today = new Date("2026-05-19T08:00:00");

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.4 }}>Routines</h1>
          <div className="mono" style={{ fontSize: 12, color: "var(--subtext1)", marginTop: 6 }}>
            Last 30 days · consistency tracking
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Dropdown value={selectedCadence} onChange={setSelectedCadence} options={[
            { value: "all", label: "All cadences" },
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]} />
          <Dropdown value={selectedGroup} onChange={setSelectedGroup} options={[
            { value: "all", label: "All groups" },
            ...groups.map((g) => ({ value: g, label: g })),
          ]} />
          <Button icon={<Icons.Plus size={14} />}>New routine</Button>
        </div>
      </div>

      {/* Top stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
        <ConsistencyCard pct={overallPct} dayTotals={dayTotals} routineCount={routines.length} />
        <BigStat
          label="Longest streak"
          value={longestStreak} suffix=" days"
          sub={topRoutine?.title}
          color="var(--orange)"
          icon={<Icons.Flame size={20} stroke="var(--orange)" />}
        />
        <BigStat
          label="Routines tracked"
          value={routines.length}
          sub={`${routines.filter(r => r.cadence === "daily").length} daily · ${routines.filter(r => r.cadence === "weekly").length} weekly`}
          color="var(--c-routine)"
          icon={<Icons.Repeat size={20} stroke="var(--c-routine)" />}
        />
        <BigStat
          label="This week"
          value={routines.filter(r => r.cadence === "daily" && r.history[29]).length}
          suffix={` / ${routines.filter(r => r.cadence === "daily").length}`}
          sub="daily routines done today"
          color="var(--accent)"
          icon={<Icons.CheckCircle size={20} stroke="var(--accent)" />}
        />
      </div>

      {/* Main consistency grid */}
      <div style={{
        background: "var(--surface0)",
        border: "1px solid var(--surface1)",
        borderRadius: 12, padding: 20, marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--subtext0)" }}>
              30-day consistency
            </h2>
            <div style={{ fontSize: 12, color: "var(--subtext1)", marginTop: 4 }}>
              Each cell is a day. Green = done · gray = missed.
            </div>
          </div>
          <Legend />
        </div>

        <HeatmapGrid routines={filtered} today={today} onOpen={onOpen} />
      </div>

      {/* Analysis row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
        <AnalysisCard
          tone="green"
          icon={<Icons.Award size={16} stroke="var(--green)" />}
          title="Top performer"
          routine={topRoutine}
          metric={`${pctDone(topRoutine.history)}% consistent`}
          insight="Habit feels automatic — anchor new routines to this one."
        />
        <AnalysisCard
          tone="red"
          icon={<Icons.TrendingDown size={16} stroke="var(--red)" />}
          title="Slipping"
          routine={routines.reduce((w, r) => pctDone(r.history) < pctDone(w.history) ? r : w, routines[0])}
          metric={`${pctDone(routines.reduce((w, r) => pctDone(r.history) < pctDone(w.history) ? r : w, routines[0]).history)}% consistent`}
          insight="Try shrinking the routine or pairing it with an existing habit."
        />
        <AnalysisCard
          tone="blue"
          icon={<Icons.TrendingUp size={16} stroke="var(--blue)" />}
          title="Momentum"
          routine={routines.find((r) => r.id === "r.read")}
          metric={`+${routines.find((r) => r.id === "r.read").streak}d streak`}
          insight="On pace for a new personal best — keep going."
        />
      </div>

      {/* Per-cadence breakdowns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <CadenceBreakdown
          title="Daily" icon={<Icons.Sun size={14} stroke="var(--yellow)" />}
          routines={routines.filter((r) => r.cadence === "daily")}
          renderRow={(r) => (
            <>
              <span style={{ flex: 1, fontSize: 13 }}>{r.title}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--subtext1)", minWidth: 56, textAlign: "right" }}>
                {r.thisWeek}/{r.weekTarget} this wk
              </span>
              <FlameStreak n={r.streak} />
            </>
          )}
        />
        <CadenceBreakdown
          title="Weekly" icon={<Icons.CalendarRange size={14} stroke="var(--blue)" />}
          routines={routines.filter((r) => r.cadence === "weekly")}
          renderRow={(r) => (
            <>
              <span style={{ flex: 1, fontSize: 13 }}>{r.title}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--subtext1)" }}>
                {r.thisWeek}/{r.weekTarget}
              </span>
              <WeeklyBars data={r.weekly || []} target={r.weekTarget} />
              <FlameStreak n={r.streak} />
            </>
          )}
        />
        <CadenceBreakdown
          title="Monthly" icon={<Icons.CalendarDays size={14} stroke="var(--accent)" />}
          routines={routines.filter((r) => r.cadence === "monthly")}
          renderRow={(r) => (
            <>
              <span style={{ flex: 1, fontSize: 13 }}>{r.title}</span>
              <MonthlyDots data={r.monthly || []} />
              {r.dueThisMonth ? (
                <span style={{ fontSize: 10, color: "var(--yellow)", fontWeight: 600 }}>DUE</span>
              ) : (
                <Icons.CheckCircle size={14} stroke="var(--green)" />
              )}
            </>
          )}
        />
      </div>
    </div>
  );
}

function pctDone(history) {
  return Math.round(history.reduce((a, b) => a + b, 0) / history.length * 100);
}

function Legend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 10, color: "var(--overlay1)", textTransform: "uppercase", letterSpacing: 0.6 }}>Less</span>
      {[0.15, 0.4, 0.65, 0.85, 1].map((a, i) => (
        <span key={i} style={{
          width: 12, height: 12, borderRadius: 2,
          background: `color-mix(in srgb, var(--c-routine) ${a * 100}%, var(--surface1))`,
        }} />
      ))}
      <span style={{ fontSize: 10, color: "var(--overlay1)", textTransform: "uppercase", letterSpacing: 0.6 }}>More</span>
    </div>
  );
}

function HeatmapGrid({ routines, today, onOpen }) {
  const days = 30;
  const cellSize = 18;
  const gap = 3;

  // Day labels — show every ~5 days
  const dayLabels = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return d;
  });

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
      {/* Routine name column */}
      <div style={{ display: "flex", flexDirection: "column", gap, justifyContent: "flex-end" }}>
        <div style={{ height: 16 }} /> {/* spacer for top date row */}
        {routines.map((r) => (
          <div key={r.id} onClick={() => onOpen(r.id)} style={{
            height: cellSize,
            display: "flex", alignItems: "center", gap: 8,
            paddingRight: 8, cursor: "pointer",
          }}>
            <CadenceDot cadence={r.cadence} />
            <span style={{ fontSize: 12, color: "var(--subtext0)", whiteSpace: "nowrap" }}>{r.title}</span>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div style={{ flex: 1, overflowX: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap }}>
          {/* Top: date row */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${days}, ${cellSize}px)`, gap, height: 16 }}>
            {dayLabels.map((d, i) => {
              const show = i % 5 === 0 || i === days - 1;
              return (
                <div key={i} className="mono" style={{
                  fontSize: 9, color: "var(--overlay1)",
                  textAlign: "center", lineHeight: 1,
                  paddingTop: 2,
                }}>
                  {show ? d.getDate() : ""}
                </div>
              );
            })}
          </div>

          {/* Each routine row */}
          {routines.map((r) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: `repeat(${days}, ${cellSize}px)`, gap }}>
              {r.history.map((v, i) => {
                const isToday = i === days - 1;
                const intensity = v ? 1 : 0;
                return (
                  <div key={i} title={`${dayLabels[i].toLocaleDateString()} — ${v ? "done" : "missed"}`}
                    style={{
                      width: cellSize, height: cellSize, borderRadius: 3,
                      background: intensity
                        ? "color-mix(in srgb, var(--c-routine) 75%, var(--mantle))"
                        : "var(--surface1)",
                      border: isToday ? "1.5px solid var(--accent)" : "none",
                      boxShadow: intensity && isToday ? "0 0 8px var(--c-routine)" : "none",
                      cursor: "pointer",
                      transition: "transform 120ms",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.15)"}
                    onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
                  />
                );
              })}
            </div>
          ))}

          {/* Bottom: totals bar */}
          <DayTotalsBar routines={routines} days={days} cellSize={cellSize} gap={gap} />
        </div>
      </div>

      {/* Right: per-routine stats */}
      <div style={{ display: "flex", flexDirection: "column", gap, paddingLeft: 6, borderLeft: "1px solid var(--surface1)" }}>
        <div style={{ height: 16 }} />
        {routines.map((r) => {
          const pct = pctDone(r.history);
          return (
            <div key={r.id} style={{
              height: 18, display: "flex", alignItems: "center", gap: 8, paddingLeft: 10,
            }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--subtext0)", minWidth: 30, textAlign: "right" }}>{pct}%</span>
              <FlameStreak n={r.streak} small />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayTotalsBar({ routines, days, cellSize, gap }) {
  const totals = Array.from({ length: days }).map((_, i) =>
    routines.reduce((s, r) => s + (r.history[i] || 0), 0)
  );
  const max = Math.max(1, ...totals);
  return (
    <>
      <div style={{ height: 4 }} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${days}, ${cellSize}px)`, gap, height: 28, alignItems: "end" }}>
        {totals.map((t, i) => (
          <div key={i} style={{
            width: cellSize, height: `${(t / max) * 26 + 2}px`,
            background: "color-mix(in srgb, var(--c-routine) 40%, var(--surface1))",
            borderRadius: 2,
          }} title={`${t} routines on day ${i + 1}`} />
        ))}
      </div>
    </>
  );
}

function CadenceDot({ cadence }) {
  const map = { daily: "var(--yellow)", weekly: "var(--blue)", monthly: "var(--accent)" };
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: map[cadence] }} />;
}

function FlameStreak({ n, small }) {
  if (!n) return <span style={{ fontSize: small ? 10 : 11, color: "var(--overlay1)", minWidth: 36, textAlign: "right" }}>—</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      color: n >= 10 ? "var(--orange)" : "var(--subtext0)",
      fontSize: small ? 10 : 11, fontWeight: 600,
      minWidth: 36, justifyContent: "flex-end",
    }}>
      <Icons.Flame size={small ? 10 : 11} stroke={n >= 10 ? "var(--orange)" : "var(--overlay1)"} />
      {n}d
    </span>
  );
}

function ConsistencyCard({ pct, dayTotals, routineCount }) {
  const max = Math.max(1, ...dayTotals);
  return (
    <div style={{
      padding: 18,
      background: "linear-gradient(135deg, color-mix(in srgb, var(--c-routine) 10%, var(--surface0)), var(--surface0))",
      border: "1px solid color-mix(in srgb, var(--c-routine) 25%, var(--surface1))",
      borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <RingGauge pct={pct} color="var(--c-routine)" size={64} stroke={6} />
        <div>
          <div style={{ fontSize: 11, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>
            Overall consistency
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: "var(--c-routine)" }}>{pct}</span>
            <span style={{ fontSize: 14, color: "var(--subtext1)" }}>%</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--subtext1)", marginTop: 2 }}>
            across {routineCount} routines · 30d
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 2, alignItems: "end", height: 32, marginTop: 14 }}>
        {dayTotals.map((t, i) => (
          <div key={i} style={{
            flex: 1, height: `${(t / max) * 30 + 2}px`,
            background: "color-mix(in srgb, var(--c-routine) 65%, transparent)",
            borderRadius: 1,
          }} />
        ))}
      </div>
    </div>
  );
}

function BigStat({ label, value, suffix, sub, color, icon }) {
  return (
    <div style={{
      padding: 18, background: "var(--surface0)",
      border: "1px solid var(--surface1)", borderRadius: 12,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      gap: 10, minHeight: 130,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 11, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</span>
        {icon}
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 30, fontWeight: 700, color }}>{value}</span>
          {suffix && <span style={{ fontSize: 14, color: "var(--subtext1)" }}>{suffix}</span>}
        </div>
        {sub && <div style={{ fontSize: 11, color: "var(--subtext1)", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function RingGauge({ pct, color, size = 48, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface1)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

function AnalysisCard({ tone, icon, title, routine, metric, insight }) {
  const toneColor = { green: "var(--green)", red: "var(--red)", blue: "var(--blue)" }[tone];
  if (!routine) return null;
  return (
    <div style={{
      padding: 16,
      background: "var(--surface0)",
      border: `1px solid color-mix(in srgb, ${toneColor} 22%, var(--surface1))`,
      borderRadius: 12,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <span style={{ fontSize: 11, color: toneColor, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>
          {title}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{routine.title}</div>
        <div className="mono" style={{ fontSize: 11, color: toneColor, marginTop: 2 }}>{metric}</div>
      </div>
      <div style={{ fontSize: 12, color: "var(--subtext1)", lineHeight: 1.5 }}>{insight}</div>
    </div>
  );
}

function CadenceBreakdown({ title, icon, routines, renderRow }) {
  return (
    <div style={{
      background: "var(--surface0)", border: "1px solid var(--surface1)",
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {icon}
        <span style={{ fontSize: 11, color: "var(--subtext0)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
          {title}
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--overlay1)" }}>({routines.length})</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {routines.map((r) => (
          <div key={r.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px",
            background: "var(--mantle)", borderRadius: 6,
          }}>
            {renderRow(r)}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyBars({ data, target }) {
  // Last 12 weeks as small bars
  const max = Math.max(target, ...data);
  return (
    <div style={{ display: "flex", alignItems: "end", gap: 2, height: 18 }}>
      {data.slice(-12).map((v, i) => (
        <div key={i} style={{
          width: 4,
          height: `${(v / max) * 16 + 2}px`,
          background: v >= target ? "var(--c-routine)" : "var(--surface2)",
          borderRadius: 1,
        }} />
      ))}
    </div>
  );
}

function MonthlyDots({ data }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {data.slice(-6).map((v, i) => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: v ? "var(--c-routine)" : "var(--surface2)",
        }} />
      ))}
    </div>
  );
}

window.RoutinesView = RoutinesView;
