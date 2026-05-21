import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNodes } from './lib/hooks';
import { ToastProvider } from './components/ui';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import SearchModal from './components/SearchModal';
import CreateNodeModal from './components/CreateNodeModal';
import Dashboard from './views/Dashboard';
import Kanban from './views/Kanban';
import Routines from './views/Routines';
import Skills from './views/Skills';
import People from './views/People';
import Graph from './views/Graph';
import Gantt from './views/Gantt';
import Calendar from './views/Calendar';
import Settings from './views/Settings';
import NodeDetail from './views/NodeDetail';

type ViewId = 'dashboard' | 'kanban' | 'routines' | 'skills' | 'people' | 'graph' | 'gantt' | 'calendar' | 'settings';

const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', kanban: 'Kanban', gantt: 'Gantt', calendar: 'Calendar',
  routines: 'Routines', skills: 'Skills', people: 'People', graph: 'Graph', settings: 'Settings',
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
}

export default function App() {
  const { byId, breadcrumb, loading } = useNodes();
  const isMobile = useIsMobile();
  const [view, setView] = useState<ViewId>('dashboard');
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const onOpen = useCallback((id: string) => {
    if (!byId[id]) return;
    setOpenId(id);
    setMobileMenuOpen(false);
  }, [byId]);

  const onNavigate = useCallback((v: string) => {
    setOpenId(null);
    setView(v as ViewId);
    setMobileMenuOpen(false);
  }, []);

  const closeDetail = () => setOpenId(null);

  const breadcrumbLabels = useMemo(() => {
    if (openId) {
      const n = byId[openId];
      return [...breadcrumb(openId), n].filter(Boolean).map((c) => c!.title);
    }
    return [VIEW_LABELS[view]];
  }, [view, openId, byId, breadcrumb]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--base)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="grid place-items-center" style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--accent), var(--blue))',
          }}>
            <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--mantle)' }}>XP</span>
          </div>
          <span className="text-ctp-subtext1" style={{ fontSize: 13 }}>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--base)' }}>
      {/* Mobile sidebar overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      {isMobile ? (
        <div
          className="fixed inset-y-0 left-0 z-50 transition-transform duration-200"
          style={{ transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          <Sidebar
            collapsed={false}
            setCollapsed={setCollapsed}
            view={view}
            onNavigate={onNavigate as any}
            onOpen={onOpen}
            openId={openId}
            onSearch={() => { setSearchOpen(true); setMobileMenuOpen(false); }}
            onCreate={() => { setCreateOpen(true); setMobileMenuOpen(false); }}
          />
        </div>
      ) : (
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          view={view}
          onNavigate={onNavigate as any}
          onOpen={onOpen}
          openId={openId}
          onSearch={() => setSearchOpen(true)}
          onCreate={() => setCreateOpen(true)}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--base)' }}>
        <TopBar
          breadcrumb={breadcrumbLabels}
          view={view}
          onNavigate={onNavigate}
          inDetail={!!openId}
          isMobile={isMobile}
          onMenuToggle={() => setMobileMenuOpen(v => !v)}
        />
        <div className="flex-1 overflow-y-auto">
          {openId ? (
            <NodeDetail id={openId} onOpen={onOpen} onClose={closeDetail} />
          ) : (
            <ViewRenderer
              view={view}
              onOpen={onOpen}
              onNavigate={onNavigate}
              onCreate={() => setCreateOpen(true)}
            />
          )}
        </div>
      </main>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onOpen={onOpen} />
      <CreateNodeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => onOpen(id)}
      />
    </div>
    </ToastProvider>
  );
}

function ViewRenderer({ view, onOpen, onNavigate, onCreate }: {
  view: ViewId; onOpen: (id: string) => void; onNavigate: (v: string) => void; onCreate: () => void;
}) {
  switch (view) {
    case 'dashboard': return <Dashboard onOpen={onOpen} onNavigate={onNavigate} onCreate={onCreate} />;
    case 'kanban': return <Kanban onOpen={onOpen} onCreate={onCreate} />;
    case 'gantt': return <Gantt onOpen={onOpen} />;
    case 'calendar': return <Calendar onOpen={onOpen} />;
    case 'routines': return <Routines onOpen={onOpen} onCreate={onCreate} />;
    case 'skills': return <Skills onOpen={onOpen} />;
    case 'people': return <People onOpen={onOpen} />;
    case 'graph': return <Graph onOpen={onOpen} />;
    case 'settings': return <Settings />;
    default: return null;
  }
}
