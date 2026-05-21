import { useState, useMemo, useRef, useCallback } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNodes } from '../lib/hooks';
import { Icons, Dropdown, useToast } from '../components/ui';
import { UPDATE_NODE, GET_NODES } from '../lib/graphql';
import {
  startOfDay, addDays, differenceInDays, format, isToday,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  isSameMonth, isWeekend,
} from 'date-fns';

interface GanttProps {
  onOpen: (id: string) => void;
}

type Zoom = 'week' | 'month' | 'quarter';
const ZOOM_DAYS: Record<Zoom, number> = { week: 14, month: 42, quarter: 90 };
const COL_WIDTH: Record<Zoom, number> = { week: 40, month: 20, quarter: 10 };

export default function Gantt({ onOpen }: GanttProps) {
  const { byType, byId, breadcrumb } = useNodes();
  const { toast } = useToast();
  const [updateNode] = useMutation(UPDATE_NODE, { refetchQueries: [{ query: GET_NODES }] });

  const allTasks = byType('TASK');
  const projects = byType('PROJECT');

  const [filter, setFilter] = useState('all');
  const [zoom, setZoom] = useState<Zoom>('month');
  const [offset, setOffset] = useState(0); // days offset from "centered on today"

  const today = startOfDay(new Date());
  const viewStart = addDays(today, offset - Math.floor(ZOOM_DAYS[zoom] / 3));
  const viewEnd = addDays(viewStart, ZOOM_DAYS[zoom]);
  const colW = COL_WIDTH[zoom];
  const totalWidth = ZOOM_DAYS[zoom] * colW;

  const filtered = filter === 'all'
    ? allTasks
    : allTasks.filter((t) => {
        const crumb = breadcrumb(t._id);
        return [t.mainParent, ...crumb.map(c => c._id)].includes(filter);
      });

  // Group tasks by project
  const grouped = useMemo(() => {
    const map = new Map<string, { project: any; tasks: any[] }>();
    // "No project" bucket
    map.set('__none', { project: null, tasks: [] });
    for (const p of projects) map.set(p._id, { project: p, tasks: [] });
    for (const t of filtered) {
      const projectId = t.mainParent ?? '__none';
      const bucket = map.get(projectId) ?? map.get('__none')!;
      bucket.tasks.push(t);
    }
    return Array.from(map.values()).filter(g => g.tasks.length > 0);
  }, [filtered, projects]);

  // Date helpers
  const dayX = (date: Date) => differenceInDays(startOfDay(date), viewStart) * colW;
  const todayX = dayX(today);

  // Header dates
  const headerDays = eachDayOfInterval({ start: viewStart, end: addDays(viewEnd, -1) });
  const headerMonths = useMemo(() => {
    const months: { label: string; startX: number; width: number }[] = [];
    let currentMonth = '';
    let startX = 0;
    for (let i = 0; i < headerDays.length; i++) {
      const label = format(headerDays[i], 'MMM yyyy');
      if (label !== currentMonth) {
        if (currentMonth) {
          months[months.length - 1].width = i * colW - startX;
        }
        currentMonth = label;
        startX = i * colW;
        months.push({ label, startX, width: 0 });
      }
    }
    if (months.length) months[months.length - 1].width = totalWidth - months[months.length - 1].startX;
    return months;
  }, [headerDays, colW, totalWidth]);

  // Drag state for resizing bars
  const [drag, setDrag] = useState<{
    taskId: string; edge: 'left' | 'right'; startMouseX: number; origDate: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.startMouseX;
    const daysDelta = Math.round(dx / colW);
    if (daysDelta === 0) return;
    // Visual feedback only — we commit on mouseup
  }, [drag, colW]);

  const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.startMouseX;
    const daysDelta = Math.round(dx / colW);
    if (daysDelta === 0) { setDrag(null); return; }

    const node = byId[drag.taskId];
    if (!node) { setDrag(null); return; }
    const m = node.metadata as any ?? {};
    const origDate = new Date(drag.origDate);
    const newDate = addDays(origDate, daysDelta);
    const newDateStr = format(newDate, 'yyyy-MM-dd');

    const metaUpdate: any = { ...m };
    if (drag.edge === 'left') {
      metaUpdate.startDate = newDateStr;
    } else {
      metaUpdate.due = newDateStr;
    }

    try {
      await updateNode({
        variables: { input: { _id: drag.taskId, metadata: JSON.stringify(metaUpdate) } },
      });
      toast({ message: `Date updated to ${newDateStr}`, variant: 'info' });
    } catch (err: any) {
      toast({ message: 'Failed to update date', variant: 'error', details: err.message });
    }
    setDrag(null);
  }, [drag, colW, byId, updateNode, toast]);

  const ROW_H = 36;
  const HEADER_H = 52;

  return (
    <div className="fade-in flex flex-col h-full" style={{ padding: '24px 32px' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid var(--surface1)' }}>
        <Icons.Filter size={14} color="var(--subtext1)" />
        <Dropdown value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All projects' },
          ...projects.map(p => ({ value: p._id, label: p.title })),
        ]} />
        <div className="flex-1" />
        <div className="flex gap-1">
          {(['week', 'month', 'quarter'] as Zoom[]).map(z => (
            <button key={z} onClick={() => setZoom(z)}
              className="border-none cursor-pointer rounded px-2.5 py-1 font-semibold capitalize"
              style={{
                fontSize: 11,
                background: zoom === z ? 'var(--accent)' : 'var(--surface0)',
                color: zoom === z ? 'var(--mantle)' : 'var(--subtext1)',
              }}>{z}</button>
          ))}
        </div>
        <div className="flex gap-1 ml-2">
          <NavBtn onClick={() => setOffset(o => o - ZOOM_DAYS[zoom])}>
            <Icons.ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} />
          </NavBtn>
          <NavBtn onClick={() => setOffset(0)}>Today</NavBtn>
          <NavBtn onClick={() => setOffset(o => o + ZOOM_DAYS[zoom])}>
            <Icons.ArrowRight size={12} />
          </NavBtn>
        </div>
        <span className="mono text-ctp-overlay1 ml-2" style={{ fontSize: 11 }}>
          {format(viewStart, 'MMM d')} — {format(addDays(viewEnd, -1), 'MMM d, yyyy')}
        </span>
      </div>

      {/* Chart area */}
      <div className="flex flex-1 overflow-hidden rounded-xl" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)' }}>
        {/* Left panel — names */}
        <div className="shrink-0 overflow-y-auto" style={{ width: 220, borderRight: '1px solid var(--surface1)' }}>
          <div style={{ height: HEADER_H, borderBottom: '1px solid var(--surface1)' }} />
          {grouped.map(g => (
            <div key={g.project?._id ?? '__none'}>
              {g.project && (
                <div className="flex items-center gap-2 px-3 font-semibold text-ctp-subtext0 cursor-pointer"
                  style={{ height: ROW_H, fontSize: 11, background: 'var(--mantle)', borderBottom: '1px solid var(--surface1)', letterSpacing: 0.4 }}
                  onClick={() => onOpen(g.project._id)}>
                  <Icons.FolderKanban size={11} color="var(--c-project)" />
                  <span className="truncate uppercase">{g.project.title}</span>
                </div>
              )}
              {g.tasks.map(t => (
                <div key={t._id} className="flex items-center gap-2 px-3 cursor-pointer hover:bg-ctp-mantle truncate"
                  style={{ height: ROW_H, fontSize: 12, borderBottom: '1px solid var(--surface1)' }}
                  onClick={() => onOpen(t._id)}>
                  <StatusDot status={t.status} />
                  <span className="truncate">{t.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right panel — timeline */}
        <div className="flex-1 overflow-x-auto overflow-y-auto" ref={containerRef}
          onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={() => setDrag(null)}>
          <div style={{ width: totalWidth, minHeight: '100%', position: 'relative' }}>
            {/* Month headers */}
            <div className="flex" style={{ height: 26, borderBottom: '1px solid var(--surface1)' }}>
              {headerMonths.map((m, i) => (
                <div key={i} className="text-center font-semibold text-ctp-subtext0 uppercase"
                  style={{ position: 'absolute', left: m.startX, width: m.width, fontSize: 10, lineHeight: '26px', letterSpacing: 0.6 }}>
                  {m.label}
                </div>
              ))}
            </div>
            {/* Day headers */}
            <div className="flex" style={{ height: 26, borderBottom: '1px solid var(--surface1)' }}>
              {headerDays.map((d, i) => {
                const isTod = isToday(d);
                const isWe = isWeekend(d);
                return (
                  <div key={i} className="text-center mono" style={{
                    position: 'absolute', left: i * colW, width: colW,
                    fontSize: 9, lineHeight: '26px',
                    color: isTod ? 'var(--accent)' : isWe ? 'var(--overlay0)' : 'var(--subtext1)',
                    fontWeight: isTod ? 700 : 400,
                  }}>
                    {zoom === 'quarter' ? (d.getDate() === 1 ? format(d, 'd') : '') : format(d, 'd')}
                  </div>
                );
              })}
            </div>

            {/* Grid lines + weekend shading */}
            <div style={{ position: 'absolute', top: HEADER_H, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
              {headerDays.map((d, i) => isWeekend(d) ? (
                <div key={i} style={{
                  position: 'absolute', left: i * colW, width: colW, top: 0, bottom: 0,
                  background: 'color-mix(in srgb, var(--surface1) 40%, transparent)',
                }} />
              ) : null)}
            </div>

            {/* Today line */}
            {todayX >= 0 && todayX <= totalWidth && (
              <div style={{
                position: 'absolute', left: todayX + colW / 2, top: 0, bottom: 0, width: 2,
                background: 'var(--red)', opacity: 0.6, zIndex: 10, pointerEvents: 'none',
              }} />
            )}

            {/* Task bars */}
            <div style={{ position: 'relative', top: HEADER_H }}>
              {grouped.map(g => {
                const rows: React.ReactNode[] = [];
                if (g.project) {
                  // Project bar
                  const pm = g.project.metadata as any ?? {};
                  const pStart = pm.startDate ? new Date(pm.startDate) : null;
                  const pEnd = pm.dueDate ? new Date(pm.dueDate) : null;
                  rows.push(
                    <div key={`p-${g.project._id}`} style={{ height: ROW_H, position: 'relative', borderBottom: '1px solid var(--surface1)' }}>
                      {pStart && pEnd && (
                        <div style={{
                          position: 'absolute', top: 12, height: 12, borderRadius: 2,
                          left: dayX(pStart), width: Math.max(dayX(pEnd) - dayX(pStart), colW),
                          background: 'color-mix(in srgb, var(--c-project) 30%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--c-project) 50%, transparent)',
                        }} />
                      )}
                    </div>
                  );
                }
                for (const t of g.tasks) {
                  const m = t.metadata as any ?? {};
                  const tStart = m.startDate ? new Date(m.startDate) : m.due ? addDays(new Date(m.due), -(m.estimatedHours ? Math.ceil(m.estimatedHours / 8) : 3)) : null;
                  const tEnd = m.due ? new Date(m.due) : null;
                  const barColor = t.status === 'DONE' ? 'var(--green)'
                    : (tEnd && tEnd < today) ? 'var(--red)'
                    : t.status === 'IN_PROGRESS' ? 'var(--blue)'
                    : 'var(--overlay1)';
                  rows.push(
                    <div key={t._id} style={{ height: ROW_H, position: 'relative', borderBottom: '1px solid var(--surface1)' }}>
                      {tStart && tEnd ? (
                        <GanttBar
                          left={dayX(tStart)}
                          width={Math.max(dayX(tEnd) - dayX(tStart) + colW, colW)}
                          color={barColor}
                          label={t.title}
                          onClick={() => onOpen(t._id)}
                          onDragEdge={(edge, startX) => {
                            setDrag({
                              taskId: t._id,
                              edge,
                              startMouseX: startX,
                              origDate: edge === 'left'
                                ? (m.startDate ?? format(tStart, 'yyyy-MM-dd'))
                                : (m.due ?? format(tEnd, 'yyyy-MM-dd')),
                            });
                          }}
                        />
                      ) : tEnd ? (
                        // Due date only — diamond marker
                        <div
                          className="cursor-pointer"
                          onClick={() => onOpen(t._id)}
                          title={`Due: ${format(tEnd, 'MMM d')}`}
                          style={{
                            position: 'absolute', top: 10, left: dayX(tEnd) + colW / 2 - 7,
                            width: 14, height: 14, borderRadius: 2,
                            background: barColor, transform: 'rotate(45deg)',
                          }}
                        />
                      ) : null}
                    </div>
                  );
                }
                return rows;
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {grouped.length === 0 && (
        <div className="text-center text-ctp-overlay1 mt-12" style={{ fontSize: 13 }}>
          No tasks with dates found. Add due dates to your tasks to see them here.
        </div>
      )}
    </div>
  );
}

function GanttBar({ left, width, color, label, onClick, onDragEdge }: {
  left: number; width: number; color: string; label: string;
  onClick: () => void;
  onDragEdge: (edge: 'left' | 'right', startX: number) => void;
}) {
  return (
    <div
      className="group cursor-pointer"
      style={{
        position: 'absolute', top: 8, height: 20, borderRadius: 4,
        left, width: Math.max(width, 20),
        background: color, opacity: 0.85,
      }}
      onClick={onClick}
      title={label}
    >
      {/* Left drag handle */}
      <div
        className="absolute top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100"
        style={{ left: 0, background: 'rgba(255,255,255,0.4)', borderRadius: '4px 0 0 4px' }}
        onMouseDown={(e) => { e.stopPropagation(); onDragEdge('left', e.clientX); }}
      />
      {/* Label */}
      <span className="absolute truncate px-1.5 text-white font-medium pointer-events-none"
        style={{ fontSize: 10, lineHeight: '20px', left: 6, right: 6 }}>
        {width > 60 ? label : ''}
      </span>
      {/* Right drag handle */}
      <div
        className="absolute top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100"
        style={{ right: 0, background: 'rgba(255,255,255,0.4)', borderRadius: '0 4px 4px 0' }}
        onMouseDown={(e) => { e.stopPropagation(); onDragEdge('right', e.clientX); }}
      />
    </div>
  );
}

function StatusDot({ status }: { status?: string }) {
  const color = status === 'DONE' ? 'var(--green)' : status === 'IN_PROGRESS' ? 'var(--blue)' : 'var(--overlay1)';
  return <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: color }} />;
}

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="border-none cursor-pointer rounded px-2 py-1 bg-transparent text-ctp-subtext1 hover:bg-ctp-surface1 inline-flex items-center gap-1"
      style={{ fontSize: 11, fontFamily: 'inherit' }}>
      {children}
    </button>
  );
}
