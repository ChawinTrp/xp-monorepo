function Dashboard({ onOpen, onNavigate }) {
  const D = window.XP_DATA;
  const nodes = D.nodes;
  const tasks = Object.values(nodes).filter((n) => n.type === "TASK");
  const routines = Object.values(nodes).filter((n) => n.type === "ROUTINE");

  const overdue = tasks.filter((t) => t.overdue);
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");
  const done = tasks.filter((t) => t.status === "DONE");

  const dailies = routines.filter((r) => r.cadence === "daily");
  const weeklies = routines.filter((r) => r.cadence === "weekly");
  const monthlies = routines.filter((r) => r.cadence === "monthly");

  const skills = Object.values(nodes).filter((n) => n.type === "SKILL").slice(0, 3);

  const today = new Date("2026-05-19T08:00:00");
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Routine state — toggleable
  const [doneRoutines, setDoneRoutines] = React.useState(() => {
    const s = new Set();
    dailies.forEach((r) => { if (r.history[29]) s.add(r.id); });
    return s;
  });
  const toggleRoutine = (id) => {
    setDoneRoutines((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const dailyDone = dailies.filter((r) => doneRoutines.has(r.id)).length;
  const dailyPct = dailies.length ? Math.round((dailyDone / dailies.length) * 100) : 0;

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1320, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.4 }}>Good morning, CT</h1>
          <div className="mono" style={{ fontSize: 12, color: "var(--subtext1)", marginTop: 6 }}>{dateLabel}</div>
        </div>
        <Button icon={<Icons.Plus size={14} />} onClick={() => onNavigate("kanban")}>Quick capture</Button>
      </div>

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <StatStreak />
        <StatToday dailyDone={dailyDone} dailyTotal={dailies.length} />
        <StatWeekly value={8} target={15} />
        <StatXP total={340} delta="+50 today" />
      </div>

      {/* Two columns: Tasks | Routines */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* TASKS COLUMN */}
        <Panel
          icon={<Icons.CheckSquare size={14} stroke="var(--c-task)" />}
          title="Tasks"
          accentColor="var(--c-task)"
          rightLabel={`${overdue.length + inProgress.length} active`}
          onMore={() => onNavigate("kanban")}
        >
          <SubSection title="Overdue" count={overdue.length} accent="var(--red)">
            <Stack>
              {overdue.length === 0 && <EmptyHint>No overdue tasks. Nice.</EmptyHint>}
              {overdue.map((t) => <NodeCard key={t.id} node={t} onOpen={onOpen} />)}
            </Stack>
          </SubSection>

          <SubSection title="In progress" count={inProgress.length} accent="var(--blue)">
            <Stack>
              {inProgress.map((t) => <NodeCard key={t.id} node={t} onOpen={onOpen} />)}
            </Stack>
          </SubSection>

          <SubSection title="Recent completions" count={done.length} accent="var(--green)">
            <Stack tight>
              {done.slice(0, 3).map((t) => (
                <CompletionRow key={t.id} task={t} onClick={() => onOpen(t.id)} />
              ))}
            </Stack>
          </SubSection>
        </Panel>

        {/* ROUTINES COLUMN */}
        <Panel
          icon={<Icons.Repeat size={14} stroke="var(--c-routine)" />}
          title="Routines"
          accentColor="var(--c-routine)"
          rightLabel={`${dailyDone}/${dailies.length} today · ${dailyPct}%`}
          onMore={() => onNavigate("routines")}
        >
          <SubSection
            title="Today" icon={<Icons.Sun size={11} stroke="var(--yellow)" />}
            count={dailies.length}
            right={<MiniProgress value={dailyPct} color="var(--c-routine)" />}
          >
            <Stack tight>
              {dailies.map((r) => (
                <RoutineRow
                  key={r.id} routine={r}
                  done={doneRoutines.has(r.id)}
                  onToggle={() => toggleRoutine(r.id)}
                  onOpen={() => onOpen(r.id)}
                />
              ))}
            </Stack>
          </SubSection>

          <SubSection title="This week" icon={<Icons.CalendarRange size={11} stroke="var(--blue)" />} count={weeklies.length}>
            <Stack tight>
              {weeklies.map((r) => (
                <WeeklyRoutineRow key={r.id} routine={r} onOpen={() => onOpen(r.id)} />
              ))}
            </Stack>
          </SubSection>

          <SubSection title="This month" icon={<Icons.CalendarDays size={11} stroke="var(--accent)" />} count={monthlies.length}>
            <Stack tight>
              {monthlies.map((r) => (
                <MonthlyRoutineRow key={r.id} routine={r} onOpen={() => onOpen(r.id)} />
              ))}
            </Stack>
          </SubSection>
        </Panel>
      </div>

      {/* Bottom row: skills + catch-ups */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Panel
          icon={<Icons.Zap size={14} stroke="var(--c-skill)" />}
          title="Skill summary"
          accentColor="var(--c-skill)"
          onMore={() => onNavigate("skills")}
        >
          <Stack>
            {skills.map((s) => (
              <div key={s.id} onClick={() => onOpen(s.id)} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <Icons.Zap size={12} stroke="var(--c-skill)" />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{s.title}</span>
                  <LevelBadge level={s.level} />
                  <span className="mono" style={{ fontSize: 11, color: "var(--subtext1)", minWidth: 64, textAlign: "right" }}>
                    {s.xp}/{s.xpToNext}
                  </span>
                </div>
                <ProgressBar value={(s.xp / s.xpToNext) * 100} color="var(--c-skill)" height={6} />
              </div>
            ))}
          </Stack>
        </Panel>

        <Panel
          icon={<Icons.Users size={14} stroke="var(--c-person)" />}
          title="Upcoming catch-ups"
          accentColor="var(--c-person)"
          onMore={() => onNavigate("people")}
        >
          <Stack tight>
            {Object.values(nodes)
              .filter((n) => n.type === "PERSON" && n.nextCatchup)
              .sort((a, b) => new Date(a.nextCatchup) - new Date(b.nextCatchup))
              .slice(0, 5)
              .map((p) => (
                <div key={p.id} onClick={() => onOpen(p.id)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 4px", borderRadius: 6, cursor: "pointer",
                }}>
                  <Avatar initials={p.initials} size={28} />
                  <span style={{ flex: 1, fontSize: 13 }}>{p.title}</span>
                  <span style={{ fontSize: 11, color: "var(--subtext1)" }}>{p.role}</span>
                  <span style={{
                    fontSize: 11,
                    color: p.catchupState === "overdue" ? "var(--red)" : "var(--green)",
                    fontWeight: p.catchupState === "overdue" ? 600 : 500,
                    minWidth: 90, textAlign: "right",
                  }}>
                    {p.relativeDate}
                  </span>
                </div>
              ))}
          </Stack>
        </Panel>
      </div>
    </div>
  );
}

/* ---------- Layout helpers ---------- */

function Panel({ icon, title, accentColor, rightLabel, onMore, children }) {
  return (
    <section style={{
      background: "var(--surface0)",
      border: "1px solid var(--surface1)",
      borderRadius: 12,
      padding: 18,
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid var(--surface1)" }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: `color-mix(in srgb, ${accentColor} 16%, var(--mantle))`,
          display: "grid", placeItems: "center",
        }}>{icon}</div>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</h2>
        <span className="mono" style={{ fontSize: 11, color: "var(--subtext1)", marginLeft: "auto" }}>{rightLabel}</span>
        {onMore && (
          <button onClick={onMore} style={{
            background: "transparent", border: "none", color: "var(--accent)",
            fontFamily: "inherit", fontSize: 11, fontWeight: 600,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3,
          }}>View all <Icons.ArrowRight size={11} /></button>
        )}
      </header>
      {children}
    </section>
  );
}

function SubSection({ title, count, icon, accent, right, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {accent && <span style={{ width: 3, height: 11, background: accent, borderRadius: 2 }} />}
        {icon}
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--subtext0)", textTransform: "uppercase", letterSpacing: 0.8 }}>
          {title}
        </span>
        {count != null && <span className="mono" style={{ fontSize: 10, color: "var(--overlay1)" }}>{count}</span>}
        <div style={{ flex: 1 }} />
        {right}
      </div>
      {children}
    </div>
  );
}

function Stack({ children, tight }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: tight ? 4 : 8 }}>{children}</div>;
}

function EmptyHint({ children }) {
  return (
    <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--overlay1)",
      background: "var(--mantle)", borderRadius: 6, fontStyle: "italic" }}>
      {children}
    </div>
  );
}

function MiniProgress({ value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 4, background: "var(--surface1)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, transition: "width 300ms" }} />
      </div>
      <span className="mono" style={{ fontSize: 10, color: "var(--subtext1)", minWidth: 26, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

function CompletionRow({ task, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 6, cursor: "pointer",
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--mantle)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <Icons.CheckCircle size={13} stroke="var(--green)" />
      <span style={{ flex: 1, fontSize: 12, color: "var(--subtext0)", textDecoration: "line-through" }}>{task.title}</span>
      <span style={{
        fontSize: 10, fontWeight: 600, color: "var(--green)",
        background: hexToRgba("var(--c-skill)", 0.14),
        padding: "1px 5px", borderRadius: 3,
      }}>+{task.xpAwarded} XP</span>
      <span className="mono" style={{ fontSize: 10, color: "var(--overlay1)", minWidth: 60, textAlign: "right" }}>{task.completedAt}</span>
    </div>
  );
}

/* ---------- Routine rows ---------- */

function RoutineRow({ routine, done, onToggle, onOpen }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 6,
      background: done ? "color-mix(in srgb, var(--c-routine) 8%, transparent)" : "transparent",
      transition: "background 200ms",
    }}>
      <button
        onClick={onToggle}
        style={{
          width: 18, height: 18, borderRadius: 5,
          border: `1.5px solid ${done ? "var(--c-routine)" : "var(--overlay0)"}`,
          background: done ? "var(--c-routine)" : "transparent",
          cursor: "pointer", padding: 0,
          display: "grid", placeItems: "center", flexShrink: 0,
          transition: "all 200ms",
        }}>
        {done && <Icons.CheckCircle size={12} stroke="var(--mantle)" strokeWidth={3} />}
      </button>
      <span onClick={onOpen} style={{
        flex: 1, fontSize: 13, cursor: "pointer",
        color: done ? "var(--subtext1)" : "var(--text)",
        textDecoration: done ? "line-through" : "none",
      }}>{routine.title}</span>
      <RoutineMiniHistory history={routine.history.slice(-7)} />
      <FlameStreak n={routine.streak} small />
    </div>
  );
}

function WeeklyRoutineRow({ routine, onOpen }) {
  const pct = (routine.thisWeek / routine.weekTarget) * 100;
  const complete = routine.thisWeek >= routine.weekTarget;
  return (
    <div onClick={onOpen} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 6, cursor: "pointer",
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--mantle)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <span style={{
        width: 18, height: 18, borderRadius: 5,
        border: `1.5px solid ${complete ? "var(--c-routine)" : "var(--overlay0)"}`,
        background: complete ? "var(--c-routine)" : "transparent",
        display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        {complete && <Icons.CheckCircle size={11} stroke="var(--mantle)" strokeWidth={3} />}
      </span>
      <span style={{ flex: 1, fontSize: 13 }}>{routine.title}</span>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: routine.weekTarget }).map((_, i) => (
          <span key={i} style={{
            width: 12, height: 6, borderRadius: 1,
            background: i < routine.thisWeek ? "var(--c-routine)" : "var(--surface1)",
          }} />
        ))}
      </div>
      <span className="mono" style={{ fontSize: 11, color: "var(--subtext1)", minWidth: 30, textAlign: "right" }}>
        {routine.thisWeek}/{routine.weekTarget}
      </span>
      <FlameStreak n={routine.streak} small />
    </div>
  );
}

function MonthlyRoutineRow({ routine, onOpen }) {
  return (
    <div onClick={onOpen} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 6, cursor: "pointer",
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--mantle)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <span style={{
        width: 18, height: 18, borderRadius: 5,
        border: `1.5px solid ${routine.thisMonthDone ? "var(--c-routine)" : "var(--overlay0)"}`,
        background: routine.thisMonthDone ? "var(--c-routine)" : "transparent",
        display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        {routine.thisMonthDone && <Icons.CheckCircle size={11} stroke="var(--mantle)" strokeWidth={3} />}
      </span>
      <span style={{ flex: 1, fontSize: 13 }}>{routine.title}</span>
      {routine.dueThisMonth && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: "var(--yellow)",
          padding: "2px 6px", borderRadius: 3,
          background: hexToRgba("var(--yellow)", 0.14),
          letterSpacing: 0.5,
        }}>DUE</span>
      )}
      <div style={{ display: "flex", gap: 3 }}>
        {(routine.monthly || []).slice(-6).map((v, i) => (
          <span key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: v ? "var(--c-routine)" : "var(--surface2)",
          }} />
        ))}
      </div>
    </div>
  );
}

function RoutineMiniHistory({ history }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {history.map((v, i) => (
        <span key={i} style={{
          width: 6, height: 14, borderRadius: 1,
          background: v ? "var(--c-routine)" : "var(--surface1)",
        }} />
      ))}
    </div>
  );
}

function StatStreak() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: 16,
      background: "var(--surface0)", borderRadius: 10,
      border: "1px solid var(--surface1)",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: "linear-gradient(135deg, var(--orange), var(--red))",
        display: "grid", placeItems: "center",
        boxShadow: "0 4px 14px color-mix(in srgb, var(--orange) 40%, transparent)",
      }}>
        <Icons.Flame size={20} stroke="var(--mantle)" strokeWidth={2.4} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>Streak</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>14</span>
          <span style={{ fontSize: 12, color: "var(--subtext1)" }}>days</span>
        </div>
      </div>
    </div>
  );
}

function StatToday({ dailyDone, dailyTotal }) {
  const pct = dailyTotal ? (dailyDone / dailyTotal) * 100 : 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: 16,
      background: "var(--surface0)", borderRadius: 10,
      border: "1px solid var(--surface1)",
    }}>
      <RingGauge pct={pct} color="var(--c-routine)" size={44} stroke={5} />
      <div>
        <div style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>Routines today</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{dailyDone}</span>
          <span style={{ fontSize: 14, color: "var(--overlay1)" }}>/ {dailyTotal}</span>
        </div>
      </div>
    </div>
  );
}

function StatWeekly({ value, target }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: 16,
      background: "var(--surface0)", borderRadius: 10,
      border: "1px solid var(--surface1)",
    }}>
      <RingGauge pct={(value / target) * 100} color="var(--accent)" size={44} stroke={5} />
      <div>
        <div style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>Tasks this week</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{value}</span>
          <span style={{ fontSize: 14, color: "var(--overlay1)" }}>/ {target}</span>
        </div>
      </div>
    </div>
  );
}

function StatXP({ total, delta }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: 16,
      background: "var(--surface0)", borderRadius: 10,
      border: "1px solid var(--surface1)",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: "color-mix(in srgb, var(--c-skill) 20%, transparent)",
        display: "grid", placeItems: "center",
        border: "1px solid color-mix(in srgb, var(--c-skill) 30%, transparent)",
      }}>
        <Icons.Zap size={20} stroke="var(--c-skill)" strokeWidth={2.2} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>XP this week</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{total}</span>
        </div>
        <div style={{ fontSize: 10, color: "var(--green)", fontWeight: 600, marginTop: 1, display: "inline-flex", alignItems: "center", gap: 3 }}>
          <Icons.ArrowUp size={9} stroke="var(--green)" /> {delta}
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
