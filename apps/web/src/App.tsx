import { useState, useEffect, useMemo } from 'react';
import { useNodes } from './lib/hooks';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import SearchModal from './components/SearchModal';
import Dashboard from './views/Dashboard';
import Kanban from './views/Kanban';
import Routines from './views/Routines';
import Skills from './views/Skills';
import People from './views/People';
import Graph from './views/Graph';
import NodeDetail from './views/NodeDetail';

type ViewId = 'dashboard' | 'kanban' | 'routines' | 'skills' | 'people' | 'graph';

const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', kanban: 'Kanban', routines: 'Routines',
  skills: 'Skills', people: 'People', graph: 'Graph',
};

export default function App() {
  const { byId, breadcrumb, loading } = useNodes();
  const [view, setView] = useState<ViewId>('dashboard');
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const onOpen = (id: string) => {
    if (!byId[id]) return;
    setOpenId(id);
  };

  const onNavigate = (v: string) => {
    setOpenId(null);
    setView(v as ViewId);
  };

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
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--base)' }}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        view={view}
        onNavigate={onNavigate as any}
        onOpen={onOpen}
        openId={openId}
        onSearch={() => setSearchOpen(true)}
      />

      <main className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--base)' }}>
        <TopBar
          breadcrumb={breadcrumbLabels}
          view={view}
          onNavigate={onNavigate}
          inDetail={!!openId}
        />
        <div className="flex-1 overflow-y-auto">
          {openId ? (
            <NodeDetail id={openId} onOpen={onOpen} onClose={closeDetail} />
          ) : (
            <ViewRenderer view={view} onOpen={onOpen} onNavigate={onNavigate} />
          )}
        </div>
      </main>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onOpen={onOpen} />
    </div>
  );
}

function ViewRenderer({ view, onOpen, onNavigate }: { view: ViewId; onOpen: (id: string) => void; onNavigate: (v: string) => void }) {
  switch (view) {
    case 'dashboard': return <Dashboard onOpen={onOpen} onNavigate={onNavigate} />;
    case 'kanban': return <Kanban onOpen={onOpen} />;
    case 'routines': return <Routines onOpen={onOpen} />;
    case 'skills': return <Skills onOpen={onOpen} />;
    case 'people': return <People onOpen={onOpen} />;
    case 'graph': return <Graph onOpen={onOpen} />;
    default: return null;
  }
}
