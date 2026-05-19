// Shared atoms for XP UI.
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const TYPE_COLOR = {
  DOMAIN: "var(--c-domain)",
  SKILL: "var(--c-skill)",
  PROJECT: "var(--c-project)",
  TASK: "var(--c-task)",
  PERSON: "var(--c-person)",
  TAG: "var(--c-tag)",
  ROUTINE: "var(--c-routine)",
};

function hexToRgba(varName, alpha) {
  // For inline rgba from CSS variable, use color-mix
  return `color-mix(in srgb, ${varName} ${alpha * 100}%, transparent)`;
}

// ---------- TypeBadge ----------
function TypeBadge({ type, label, size = "md" }) {
  const color = TYPE_COLOR[type];
  const text = label || type;
  const pad = size === "sm" ? "2px 6px" : "3px 8px";
  const fontSize = size === "sm" ? 10 : 11;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: pad,
      background: hexToRgba(color, 0.15),
      color, borderRadius: 4,
      fontSize, fontWeight: 600, letterSpacing: 0.4,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      lineHeight: 1.2,
    }}>
      <TypeIcon type={type} size={size === "sm" ? 10 : 12} />
      {text}
    </span>
  );
}

// ---------- ProgressBar ----------
function ProgressBar({ value, color = "var(--accent)", height = 8, showLabel = false }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
      <div style={{
        flex: 1,
        height,
        background: "var(--surface1)",
        borderRadius: height / 2,
        overflow: "hidden",
        position: "relative",
      }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: height / 2,
          transition: "width 300ms ease",
        }} />
      </div>
      {showLabel && (
        <span className="mono" style={{ fontSize: 11, color: "var(--subtext1)", minWidth: 32, textAlign: "right" }}>{pct}%</span>
      )}
    </div>
  );
}

// ---------- StatusDot ----------
function StatusDot({ status, size = 8 }) {
  const map = {
    TODO: "var(--overlay2)",
    IN_PROGRESS: "var(--blue)",
    DONE: "var(--green)",
  };
  return (
    <span style={{
      display: "inline-block",
      width: size, height: size, borderRadius: "50%",
      background: map[status] || "var(--overlay0)",
      boxShadow: status === "IN_PROGRESS" ? "0 0 6px var(--blue)" : "none",
      flexShrink: 0,
    }} />
  );
}

// ---------- TagChip ----------
function TagChip({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", height: 20,
        padding: "0 8px",
        background: hexToRgba("var(--c-tag)", 0.14),
        color: "var(--c-tag)",
        border: "none",
        borderRadius: 4,
        fontSize: 11, fontWeight: 500,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      #{label}
    </button>
  );
}

// ---------- StreakBadge ----------
function StreakBadge({ days, active = true }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "12px 16px",
      background: active ? "linear-gradient(135deg, color-mix(in srgb, var(--orange) 25%, transparent), color-mix(in srgb, var(--red) 20%, transparent))" : "var(--surface0)",
      border: `1px solid ${active ? "color-mix(in srgb, var(--orange) 40%, transparent)" : "var(--surface1)"}`,
      borderRadius: 8,
    }}>
      <Icons.Flame size={22} stroke={active ? "var(--orange)" : "var(--overlay0)"} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: active ? "var(--orange)" : "var(--overlay1)" }}>{days}</span>
        <span style={{ fontSize: 11, color: "var(--subtext1)", textTransform: "uppercase", letterSpacing: 0.5 }}>days</span>
      </div>
    </div>
  );
}

// ---------- Priority dot ----------
function PriorityDot({ priority }) {
  const map = { high: "var(--red)", medium: "var(--yellow)", low: "var(--green)" };
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: map[priority] || "var(--overlay0)",
      flexShrink: 0,
    }} />
  );
}

// ---------- Breadcrumb (string from node) ----------
function nodeBreadcrumb(id) {
  return window.XP_DATA.breadcrumb(id).map((n) => n.title).join(" / ");
}

// ---------- NodeCard ----------
function NodeCard({ node, compact = false, onOpen, dragging, draggable, onDragStart, onDragEnd, hidePriority }) {
  const D = window.XP_DATA;
  const crumb = nodeBreadcrumb(node.id);
  const overdue = node.overdue;
  const done = node.status === "DONE";

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen && onOpen(node.id)}
      style={{
        background: "var(--surface0)",
        border: "1px solid transparent",
        borderRadius: 8,
        padding: 12,
        cursor: onOpen ? "pointer" : "default",
        transition: "all 200ms ease",
        opacity: done ? 0.78 : (dragging ? 0.35 : 1),
        boxShadow: dragging ? "0 8px 24px rgba(0,0,0,0.35)" : "none",
        position: "relative",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface1)"; e.currentTarget.style.borderColor = "var(--surface2)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface0)"; e.currentTarget.style.borderColor = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {!hidePriority && (
          done
            ? <Icons.CheckCircle size={14} stroke="var(--green)" style={{ marginTop: 2 }} />
            : <PriorityDot priority={node.priority || "low"} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: 14, color: "var(--text)",
            textDecoration: done ? "line-through" : "none",
            textDecorationColor: "var(--overlay0)",
            marginBottom: 4,
            overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {node.title}
          </div>
          {crumb && (
            <div className="mono" style={{ fontSize: 11, color: "var(--subtext1)", marginBottom: 6, opacity: 0.85 }}>
              {crumb}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {done && node.xpAwarded != null && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: "var(--green)",
                background: hexToRgba("var(--c-skill)", 0.16),
                padding: "2px 6px", borderRadius: 4,
              }}>+{node.xpAwarded} XP</span>
            )}
            {!done && node.due && (
              <span style={{
                fontSize: 11,
                color: overdue ? "var(--red)" : "var(--subtext1)",
                display: "inline-flex", alignItems: "center", gap: 4,
                fontWeight: overdue ? 600 : 400,
              }}>
                {overdue && <Icons.AlertTriangle size={11} stroke="var(--red)" />}
                Due {formatShort(node.due)}{overdue ? " · overdue" : ""}
              </span>
            )}
            {(node.tags || []).map((t) => <TagChip key={t} label={t} />)}
          </div>
        </div>
        {draggable && (
          <div style={{ color: "var(--overlay0)", marginTop: 2, opacity: 0.5 }}>
            <Icons.GripVertical size={14} />
          </div>
        )}
      </div>
    </div>
  );
}

function formatShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------- Avatar ----------
function Avatar({ initials, size = 40, color = "var(--c-person)" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color,
      color: "var(--mantle)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.38,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ---------- LevelBadge ----------
function LevelBadge({ level }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px",
      background: hexToRgba("var(--c-tag)", 0.18),
      color: "var(--c-tag)",
      borderRadius: 16,
      fontSize: 12, fontWeight: 700,
      letterSpacing: 0.3,
    }}>
      Lv.{level}
    </span>
  );
}

// ---------- Sparkline ----------
function Sparkline({ data = [], color = "var(--green)", width = 56, height = 18 }) {
  const max = Math.max(1, ...data);
  const step = width / Math.max(1, data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - (v / max) * height}`).join(" ");
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={height - (v / max) * height} r={1.4} fill={color} />
      ))}
    </svg>
  );
}

// ---------- Button ----------
function Button({ children, variant = "primary", size = "md", onClick, icon, style, disabled }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: size === "sm" ? "6px 12px" : "8px 16px",
    borderRadius: 16,
    border: "none",
    fontFamily: "inherit",
    fontSize: size === "sm" ? 12 : 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 200ms ease",
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background: "var(--accent)", color: "var(--mantle)" },
    secondary: { background: "var(--surface1)", color: "var(--text)" },
    ghost: { background: "transparent", color: "var(--subtext1)" },
    danger: { background: "transparent", color: "var(--red)", border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = "brightness(1.1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------- RingGauge ----------
function RingGauge({ pct, color, size = 48, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface1)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

Object.assign(window, {
  TypeBadge, ProgressBar, StatusDot, TagChip, StreakBadge, PriorityDot, NodeCard, Avatar, LevelBadge, Sparkline, Button, RingGauge,
  nodeBreadcrumb, formatShort, hexToRgba, TYPE_COLOR,
});
