import { useState, useEffect, useRef, useMemo } from 'react';
import { Icons, TypeBadge, Kbd } from './ui';
import { useNodes } from '../lib/hooks';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
}

export default function SearchModal({ open, onClose, onOpen }: SearchModalProps) {
  const { nodes, breadcrumb } = useNodes();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    const ql = q.toLowerCase();
    if (!ql) return nodes.filter((n) => n.type !== 'TAG').slice(0, 8);
    return nodes.filter((n) => n.title.toLowerCase().includes(ql)).slice(0, 12);
  }, [q, nodes]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      if (e.key === 'Enter' && results[active]) { e.preventDefault(); onOpen(results[active]._id); onClose(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, results, active, onClose, onOpen]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-start justify-center fade-in"
      style={{ background: 'rgba(17, 17, 27, 0.7)', backdropFilter: 'blur(4px)', paddingTop: '12vh' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="overflow-hidden"
        style={{
          width: 520, maxWidth: '92vw',
          background: 'var(--mantle)', border: '1px solid var(--surface1)',
          borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-center gap-2.5" style={{ padding: '14px 16px', borderBottom: '1px solid var(--surface1)' }}>
          <Icons.Search size={16} color="var(--subtext1)" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Search nodes…"
            className="flex-1 bg-transparent border-none text-ctp-text outline-none"
            style={{ fontSize: 15, fontFamily: 'inherit' }}
          />
          <Kbd>ESC</Kbd>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 380, padding: 6 }}>
          {results.length === 0 && (
            <div className="text-center text-ctp-overlay1" style={{ padding: 32, fontSize: 13 }}>
              No matches.
            </div>
          )}
          {results.map((n, i) => {
            const isActive = i === active;
            const bc = breadcrumb(n._id).map((c) => c.title).join(' / ');
            return (
              <button
                key={n._id}
                onMouseEnter={() => setActive(i)}
                onClick={() => { onOpen(n._id); onClose(); }}
                className="flex items-center gap-2.5 w-full text-left border-none cursor-pointer rounded-lg"
                style={{
                  padding: '10px 12px', fontFamily: 'inherit',
                  background: isActive ? 'var(--surface0)' : 'transparent',
                  color: 'var(--text)',
                }}
              >
                <TypeBadge type={n.type} size="sm" />
                <span className="flex-1 font-medium" style={{ fontSize: 14 }}>{n.title}</span>
                <span className="mono text-ctp-subtext1" style={{ fontSize: 11 }}>{bc}</span>
                {isActive && <Icons.ArrowRight size={12} color="var(--accent)" />}
              </button>
            );
          })}
        </div>
        <div
          className="flex items-center gap-3.5 text-ctp-overlay1"
          style={{ padding: '8px 16px', borderTop: '1px solid var(--surface1)', fontSize: 11 }}
        >
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> open</span>
          <div className="flex-1" />
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
}
