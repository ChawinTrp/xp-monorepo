import { Icons } from './ui';

const VIEWS = ['dashboard', 'kanban', 'gantt', 'calendar', 'routines', 'graph', 'skills', 'people'] as const;
const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', kanban: 'Kanban', gantt: 'Gantt', calendar: 'Calendar',
  routines: 'Routines', graph: 'Graph', skills: 'Skills', people: 'People',
};

interface TopBarProps {
  breadcrumb: string[];
  view: string;
  onNavigate: (v: string) => void;
  inDetail: boolean;
  isMobile?: boolean;
  onMenuToggle?: () => void;
}

export default function TopBar({ breadcrumb, view, onNavigate, inDetail, isMobile, onMenuToggle }: TopBarProps) {
  return (
    <header
      className="flex items-center shrink-0"
      style={{ height: isMobile ? 48 : 56, padding: isMobile ? '0 12px' : '0 24px', borderBottom: '1px solid var(--surface0)', background: 'var(--base)' }}
    >
      {/* Mobile hamburger */}
      {isMobile && (
        <button
          onClick={onMenuToggle}
          className="border-none bg-transparent cursor-pointer p-1.5 mr-2 rounded"
          style={{ color: 'var(--subtext1)' }}
        >
          <Icons.GripVertical size={18} />
        </button>
      )}

      <div className="mono flex items-center gap-1.5 shrink-0" style={{ fontSize: 12, color: 'var(--subtext1)', maxWidth: isMobile ? 140 : undefined }}>
        {isMobile ? (
          <span className="truncate" style={{ color: 'var(--text)' }}>{breadcrumb[breadcrumb.length - 1]}</span>
        ) : (
          breadcrumb.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <Icons.ChevronRight size={10} color="var(--overlay0)" />}
              <span style={{ color: i === breadcrumb.length - 1 ? 'var(--text)' : 'var(--subtext1)' }}>{c}</span>
            </span>
          ))
        )}
      </div>

      <div className="flex-1" />

      {!inDetail && (
        <div
          className="flex gap-1 p-0.5 rounded-lg overflow-x-auto"
          style={{
            background: 'var(--mantle)',
            border: '1px solid var(--surface0)',
            maxWidth: isMobile ? 'calc(100vw - 160px)' : undefined,
            scrollbarWidth: 'none',
          }}
        >
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => onNavigate(v)}
              className="border-none rounded-md capitalize cursor-pointer transition-all duration-200 font-semibold shrink-0"
              style={{
                padding: isMobile ? '4px 8px' : '5px 12px',
                background: view === v ? 'var(--surface0)' : 'transparent',
                color: view === v ? 'var(--accent)' : 'var(--subtext1)',
                fontSize: isMobile ? 10 : 12, fontFamily: 'inherit',
              }}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
