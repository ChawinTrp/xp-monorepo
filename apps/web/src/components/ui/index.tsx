import { useState, useEffect, useRef, useCallback, useContext, createContext, type ReactNode, type CSSProperties } from 'react';
import {
  Layers, Zap, FolderKanban, CheckSquare, User, Tag, Circle, Repeat,
  ChevronRight, ChevronDown, ChevronLeft, Plus, Search, Flame, AlertTriangle,
  CheckCircle, CalendarDays, GripVertical, X, Filter, Network, LayoutDashboard,
  Users, ArrowRight, ArrowUp, Trash2, Save, Target, Sun, CalendarRange,
  TrendingUp, TrendingDown, Award, Sparkles, Play, Square, Clock, Timer,
  type LucideProps,
} from 'lucide-react';
import { TYPE_COLORS } from '../../lib/types';

export const Icons = {
  Layers, Zap, FolderKanban, CheckSquare, User, Tag, Circle, Repeat,
  ChevronRight, ChevronDown, ChevronLeft, Plus, Search, Flame, AlertTriangle,
  CheckCircle, CalendarDays, GripVertical, X, Filter, Network, LayoutDashboard,
  Users, ArrowRight, ArrowUp, Trash2, Save, Target, Sun, CalendarRange,
  TrendingUp, TrendingDown, Award, Sparkles, Play, Square, Clock, Timer,
};

const TYPE_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  DOMAIN: Layers, SKILL: Zap, PROJECT: FolderKanban, TASK: CheckSquare,
  PERSON: User, TAG: Tag, ROUTINE: Repeat,
};

export function TypeIcon({ type, size = 14, color }: { type: string; size?: number; color?: string }) {
  const C = TYPE_ICON_MAP[type] || Circle;
  return <C size={size} color={color ?? TYPE_COLORS[type]} />;
}

export function TypeBadge({ type, label, size = 'md' }: { type: string; label?: string; size?: 'sm' | 'md' }) {
  const color = TYPE_COLORS[type];
  const text = label || type;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded font-semibold uppercase whitespace-nowrap"
      style={{
        padding: size === 'sm' ? '2px 6px' : '3px 8px',
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        fontSize: size === 'sm' ? 10 : 11,
        letterSpacing: 0.4,
      }}
    >
      <TypeIcon type={type} size={size === 'sm' ? 10 : 12} />
      {text}
    </span>
  );
}

export function ProgressBar({ value, color = 'var(--accent)', height = 8, showLabel = false }: {
  value: number; color?: string; height?: number; showLabel?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2.5 w-full">
      <div className="flex-1 overflow-hidden relative" style={{ height, background: 'var(--surface1)', borderRadius: height / 2 }}>
        <div className="h-full transition-[width] duration-300 ease-out" style={{ width: `${pct}%`, background: color, borderRadius: height / 2 }} />
      </div>
      {showLabel && <span className="mono text-ctp-subtext1 min-w-[32px] text-right" style={{ fontSize: 11 }}>{Math.round(pct)}%</span>}
    </div>
  );
}

export function StatusDot({ status, size = 8 }: { status?: string; size?: number }) {
  const map: Record<string, string> = { TODO: 'var(--overlay2)', IN_PROGRESS: 'var(--blue)', DONE: 'var(--green)' };
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: size, height: size,
        background: map[status ?? ''] ?? 'var(--overlay0)',
        boxShadow: status === 'IN_PROGRESS' ? '0 0 6px var(--blue)' : 'none',
      }}
    />
  );
}

export function TagChip({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center h-5 border-none rounded cursor-pointer font-medium"
      style={{
        padding: '0 8px',
        background: 'color-mix(in srgb, var(--c-tag) 14%, transparent)',
        color: 'var(--c-tag)',
        fontSize: 11,
        fontFamily: 'inherit',
      }}
    >
      #{label}
    </button>
  );
}

export function PriorityDot({ priority }: { priority?: string }) {
  const map: Record<string, string> = { high: 'var(--red)', medium: 'var(--yellow)', low: 'var(--green)' };
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: map[priority ?? ''] ?? 'var(--overlay0)' }} />;
}

export function Avatar({ initials, size = 40, color = 'var(--c-person)' }: { initials: string; size?: number; color?: string }) {
  return (
    <div
      className="rounded-full inline-flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, background: color, color: 'var(--mantle)', fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

export function LevelBadge({ level }: { level: number }) {
  return (
    <span
      className="inline-flex items-center rounded-full font-bold"
      style={{
        padding: '3px 10px', fontSize: 12, letterSpacing: 0.3,
        background: 'color-mix(in srgb, var(--c-tag) 18%, transparent)',
        color: 'var(--c-tag)',
      }}
    >
      Lv.{level}
    </span>
  );
}

export function Sparkline({ data = [], color = 'var(--green)', width = 56, height = 18 }: {
  data?: number[]; color?: string; width?: number; height?: number;
}) {
  const max = Math.max(1, ...data);
  const step = width / Math.max(1, data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - (v / max) * height}`).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={height - (v / max) * height} r={1.4} fill={color} />
      ))}
    </svg>
  );
}

export function RingGauge({ pct, color, size = 48, stroke = 4 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface1)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

export function Button({ children, variant = 'primary', size = 'md', onClick, icon, style, disabled }: {
  children?: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md';
  onClick?: () => void; icon?: ReactNode; style?: CSSProperties; disabled?: boolean;
}) {
  const variants: Record<string, CSSProperties> = {
    primary: { background: 'var(--accent)', color: 'var(--mantle)' },
    secondary: { background: 'var(--surface1)', color: 'var(--text)' },
    ghost: { background: 'transparent', color: 'var(--subtext1)' },
    danger: { background: 'transparent', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)' },
  };
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-2xl border-none font-semibold transition-all duration-200"
      style={{
        padding: size === 'sm' ? '6px 12px' : '8px 16px',
        fontSize: size === 'sm' ? 12 : 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        ...variants[variant],
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span
      className="mono inline-block rounded"
      style={{
        padding: '1px 6px',
        background: 'var(--surface0)',
        border: '1px solid var(--surface1)',
        fontSize: 10,
        color: 'var(--subtext1)',
        lineHeight: 1.5,
      }}
    >
      {children}
    </span>
  );
}

export function Dropdown({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const current = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md cursor-pointer"
        style={{
          padding: '6px 10px', background: 'var(--surface0)', color: 'var(--text)',
          border: '1px solid var(--surface1)', fontSize: 12, fontFamily: 'inherit',
        }}
      >
        {current.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 min-w-[180px] z-50 rounded-md overflow-hidden"
          style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full text-left border-none cursor-pointer hover:bg-ctp-surface1"
              style={{
                padding: '8px 12px', fontSize: 12, fontFamily: 'inherit',
                background: o.value === value ? 'var(--surface1)' : 'transparent',
                color: 'var(--text)',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Toast System ── */

type ToastVariant = 'success' | 'info' | 'error';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  details?: string;
  exiting?: boolean;
}

interface ToastContextType {
  toast: (opts: { message: string; variant?: ToastVariant; details?: string; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback(
    ({ message, variant = 'success', details, duration = 3000 }: {
      message: string; variant?: ToastVariant; details?: string; duration?: number;
    }) => {
      const id = ++toastIdCounter;
      setToasts(prev => [...prev.slice(-2), { id, message, variant, details }]);

      // Start exit animation before removal
      setTimeout(() => {
        setToasts(prev => prev.map(t => (t.id === id ? { ...t, exiting: true } : t)));
      }, duration - 300);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => (
          <Toast key={t.id} item={t} onDismiss={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TOAST_COLORS: Record<ToastVariant, { bg: string; border: string; icon: string }> = {
  success: { bg: 'color-mix(in srgb, var(--green) 12%, var(--surface0))', border: 'color-mix(in srgb, var(--green) 30%, transparent)', icon: 'var(--green)' },
  info: { bg: 'color-mix(in srgb, var(--blue) 12%, var(--surface0))', border: 'color-mix(in srgb, var(--blue) 30%, transparent)', icon: 'var(--blue)' },
  error: { bg: 'color-mix(in srgb, var(--red) 12%, var(--surface0))', border: 'color-mix(in srgb, var(--red) 30%, transparent)', icon: 'var(--red)' },
};

const TOAST_ICONS: Record<ToastVariant, React.ComponentType<LucideProps>> = {
  success: CheckCircle,
  info: Zap,
  error: AlertTriangle,
};

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const colors = TOAST_COLORS[item.variant];
  const Icon = TOAST_ICONS[item.variant];
  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        minWidth: 240,
        maxWidth: 360,
        pointerEvents: 'auto',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        animation: item.exiting ? 'toast-out 0.3s ease-in forwards' : 'toast-in 0.3s ease-out',
      }}
    >
      <Icon size={16} color={colors.icon} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{item.message}</div>
        {item.details && (
          <div style={{ fontSize: 11, color: 'var(--subtext0)', marginTop: 2, lineHeight: 1.3 }}>{item.details}</div>
        )}
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          color: 'var(--overlay1)', flexShrink: 0, marginTop: 1,
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
