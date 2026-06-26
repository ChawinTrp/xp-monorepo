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
import Today from './views/Today';
import MobileShell from './mobile/MobileShell';
import BootSplash from './components/BootSplash';

type ViewId = 'today' | 'dashboard' | 'kanban' | 'routines' | 'skills' | 'people' | 'graph' | 'gantt' | 'calendar' | 'settings';

const VIEW_LABELS: Record<string, string> = {
  today: 'Today', dashboard: 'Dashboard', kanban: 'Kanban', gantt: 'Gantt', calendar: 'Calendar',
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
  const { byId, breadcrumb, loading, nodes } = useNodes();
  const isMobile = useIsMobile();
  const [view, setView] = useState<ViewId>('dashboard');
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<string | undefined>(undefined);

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

  // Block the UI only on the very first load with an empty cache (the ~15s Render
  // cold start). cache-and-network keeps `loading` true during later background
  // refetches, so gating on data presence avoids re-showing the splash each time.
  if (loading && nodes.length === 0) {
    return <BootSplash />;
  }

  if (isMobile) {
    return (
      <ToastProvider>
        <MobileShell />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--base)' }}>
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
            onCreateDomain={() => { setCreateType('DOMAIN'); setCreateOpen(true); setMobileMenuOpen(false); }}
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
          onCreateDomain={() => { setCreateType('DOMAIN'); setCreateOpen(true); }}
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
        onClose={() => { setCreateOpen(false); setCreateType(undefined); }}
        onCreated={(id) => onOpen(id)}
        defaultType={createType}
      />
    </div>
    </ToastProvider>
  );
}

function ViewRenderer({ view, onOpen, onNavigate, onCreate }: {
  view: ViewId; onOpen: (id: string) => void; onNavigate: (v: string) => void; onCreate: () => void;
}) {
  switch (view) {
    case 'today': return <Today onOpen={onOpen} />;
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
