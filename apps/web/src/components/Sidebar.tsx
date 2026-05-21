import { useState } from 'react';
import { TypeIcon, Icons, Kbd, Button } from './ui';
import { TYPE_COLORS } from '../lib/types';
import type { XPNode } from '../lib/types';
import { useNodes } from '../lib/hooks';

type ViewId = 'dashboard' | 'kanban' | 'routines' | 'skills' | 'people' | 'graph';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  onOpen: (id: string) => void;
  openId: string | null;
  onSearch: () => void;
  onCreate: () => void;
}

const NAV_ITEMS: { id: ViewId; label: string; icon: typeof Icons.LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Icons.LayoutDashboard },
  { id: 'kanban', label: 'Kanban', icon: Icons.FolderKanban },
  { id: 'routines', label: 'Routines', icon: Icons.Repeat },
  { id: 'skills', label: 'Skills', icon: Icons.Zap },
  { id: 'people', label: 'People', icon: Icons.Users },
  { id: 'graph', label: 'Graph', icon: Icons.Network },
];

export default function Sidebar({ collapsed, setCollapsed, view, onNavigate, onOpen, openId, onSearch, onCreate }: SidebarProps) {
  const { byId, childrenOf } = useNodes();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const w = collapsed ? 56 : 248;

  const rootDomains = Object.values(byId).filter((n) => n.type === 'DOMAIN' && !n.mainParent);

  return (
    <aside
      className="shrink-0 flex flex-col overflow-hidden transition-[width] duration-200 ease-out"
      style={{ width: w, background: 'var(--mantle)', borderRight: '1px solid var(--surface0)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5" style={{ padding: collapsed ? '16px 12px' : '18px 18px', borderBottom: '1px solid var(--surface0)' }}>
        <div
          className="grid place-items-center shrink-0"
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), var(--blue))',
            boxShadow: '0 4px 12px color-mix(in srgb, var(--accent) 35%, transparent)',
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--mantle)' }}>XP</span>
        </div>
        {!collapsed && (
          <>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-ctp-text" style={{ fontSize: 15 }}>Life OS</span>
              <span className="mono text-ctp-overlay1" style={{ fontSize: 10 }}>v0.4 · CT</span>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setCollapsed(true)}
              className="bg-transparent border-none text-ctp-overlay1 p-1 cursor-pointer rounded"
            >
              <Icons.ChevronLeft size={14} />
            </button>
          </>
        )}
      </div>

      {/* Search */}
      <div style={{ padding: collapsed ? '10px 8px' : '12px 14px' }}>
        <button
          onClick={onSearch}
          className="w-full flex items-center gap-2.5 rounded-md cursor-pointer"
          style={{
            padding: collapsed ? 8 : '8px 10px',
            background: 'var(--surface0)', border: '1px solid var(--surface1)',
            color: 'var(--subtext1)', fontSize: 12, fontFamily: 'inherit',
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Icons.Search size={13} />
            {!collapsed && 'Search...'}
          </span>
          {!collapsed && (
            <span className="inline-flex gap-1">
              <Kbd>⌘</Kbd><Kbd>K</Kbd>
            </span>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5" style={{ padding: collapsed ? '4px 8px' : '4px 12px' }}>
        {NAV_ITEMS.map((n) => {
          const active = view === n.id && !openId;
          const NavIcon = n.icon;
          return (
            <button
              key={n.id}
              onClick={() => onNavigate(n.id)}
              title={n.label}
              className="flex items-center gap-2.5 border-none rounded-md text-left relative"
              style={{
                padding: collapsed ? 8 : '8px 10px',
                background: active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--subtext0)',
                fontSize: 13, fontWeight: active ? 600 : 500,
                fontFamily: 'inherit', cursor: 'pointer',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface0)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              {active && !collapsed && (
                <span className="absolute rounded" style={{ left: -12, top: 8, bottom: 8, width: 3, background: 'var(--accent)' }} />
              )}
              <NavIcon size={14} color={active ? 'var(--accent)' : 'var(--subtext1)'} />
              {!collapsed && n.label}
            </button>
          );
        })}
      </nav>

      {/* Domain tree */}
      {!collapsed && (
        <>
          <div
            className="font-semibold uppercase"
            style={{ margin: '16px 18px 8px', fontSize: 10, color: 'var(--overlay1)', letterSpacing: 0.8 }}
          >
            Domain tree
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding: '0 8px 8px' }}>
            {rootDomains.map((root) => (
              <TreeNode
                key={root._id}
                node={root}
                depth={0}
                expanded={expanded}
                setExpanded={setExpanded}
                openId={openId}
                onOpen={onOpen}
                childrenOf={childrenOf}
                byId={byId}
              />
            ))}
          </div>
        </>
      )}
      {collapsed && <div className="flex-1" />}

      {/* Footer */}
      <div style={{ padding: collapsed ? 10 : 14, borderTop: '1px solid var(--surface0)' }}>
        {collapsed ? (
          <button
            onClick={onCreate}
            className="grid place-items-center rounded-lg border-none cursor-pointer mx-auto"
            style={{ width: 36, height: 36, background: 'var(--accent)', color: 'var(--mantle)' }}
          >
            <Icons.Plus size={16} strokeWidth={2.4} />
          </button>
        ) : (
          <Button icon={<Icons.Plus size={14} />} onClick={onCreate} style={{ width: '100%', justifyContent: 'center' }}>
            New node
          </Button>
        )}
      </div>
    </aside>
  );
}

function TreeNode({ node, depth, expanded, setExpanded, openId, onOpen, childrenOf, byId }: {
  node: XPNode; depth: number;
  expanded: Record<string, boolean>; setExpanded: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  openId: string | null; onOpen: (id: string) => void;
  childrenOf: Record<string, XPNode[]>; byId: Record<string, XPNode>;
}) {
  const kids = (childrenOf[node._id] ?? []).filter((c) => c.type !== 'PERSON' && c.type !== 'TAG');
  const hasKids = kids.length > 0;
  const isOpen = expanded[node._id];
  const isActive = openId === node._id;

  return (
    <div>
      <div
        onClick={() => onOpen(node._id)}
        className="flex items-center gap-1.5 rounded cursor-pointer relative transition-colors duration-200"
        style={{
          padding: '5px 6px',
          paddingLeft: 8 + depth * 14,
          background: isActive ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'transparent',
          color: isActive ? 'var(--text)' : 'var(--subtext0)',
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--surface0)'; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        {isActive && <span className="absolute left-0 rounded" style={{ top: 4, bottom: 4, width: 3, background: 'var(--accent)' }} />}
        <button
          onClick={(e) => { e.stopPropagation(); if (hasKids) setExpanded((cur) => ({ ...cur, [node._id]: !cur[node._id] })); }}
          className="bg-transparent border-none p-0 cursor-pointer grid place-items-center shrink-0"
          style={{ width: 14, height: 14, color: 'var(--overlay1)', visibility: hasKids ? 'visible' : 'hidden' }}
        >
          <Icons.ChevronRight size={11} className="transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }} />
        </button>
        <TypeIcon type={node.type} size={12} color={TYPE_COLORS[node.type]} />
        <span
          className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ fontSize: 12, fontWeight: node.type === 'DOMAIN' ? 600 : 400 }}
        >
          {node.title}
        </span>
        {node.type === 'SKILL' && (node.metadata as any)?.level && (
          <span className="mono" style={{ fontSize: 9, color: 'var(--c-tag)' }}>Lv.{(node.metadata as any).level}</span>
        )}
        {node.type === 'PROJECT' && node.progress != null && (
          <span className="mono" style={{ fontSize: 9, color: 'var(--overlay1)' }}>{node.progress}%</span>
        )}
      </div>
      {isOpen && kids.map((k) => (
        <TreeNode
          key={k._id}
          node={k}
          depth={depth + 1}
          expanded={expanded}
          setExpanded={setExpanded}
          openId={openId}
          onOpen={onOpen}
          childrenOf={childrenOf}
          byId={byId}
        />
      ))}
    </div>
  );
}
