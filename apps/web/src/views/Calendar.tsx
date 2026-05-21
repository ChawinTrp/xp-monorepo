import { useState, useMemo } from 'react';
import { useNodes } from '../lib/hooks';
import { Icons } from '../components/ui';
import {
  startOfMonth, startOfWeek,
  format, isSameMonth, isToday, addMonths, subMonths,
} from 'date-fns';

interface CalendarProps {
  onOpen: (id: string) => void;
}

export default function Calendar({ onOpen }: CalendarProps) {
  const { byType } = useNodes();
  const tasks = byType('TASK');
  const routines = byType('ROUTINE');

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showTasks, setShowTasks] = useState(true);
  const [showRoutines, setShowRoutines] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);

  // Build 6-week grid (42 days)
  const gridDays = useMemo(() => {
    const start = startOfWeek(monthStart);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [monthStart]);

  // Map tasks to due dates
  const tasksByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of tasks) {
      const due = (t.metadata as any)?.due;
      if (!due) continue;
      const key = due.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks]);

  // Map routine check-ins to dates
  const routinesByDate = useMemo(() => {
    const map = new Map<string, { routine: any; done: boolean }[]>();
    const today = new Date();
    for (const r of routines) {
      const history = (r.metadata as any)?.history ?? [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - (29 - i));
        const key = format(d, 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ routine: r, done: !!history[i] });
      }
    }
    return map;
  }, [routines]);

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="bg-transparent border-none cursor-pointer text-ctp-subtext1 hover:text-ctp-text p-1">
            <Icons.ChevronLeft size={20} />
          </button>
          <h1 className="text-[28px] font-bold m-0" style={{ letterSpacing: -0.4, minWidth: 260, textAlign: 'center' }}>
            {format(currentMonth, 'MMMM yyyy')}
          </h1>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="bg-transparent border-none cursor-pointer text-ctp-subtext1 hover:text-ctp-text p-1">
            <Icons.ChevronRight size={20} />
          </button>
          <button onClick={() => setCurrentMonth(new Date())}
            className="border-none cursor-pointer rounded px-3 py-1 font-semibold ml-2"
            style={{ fontSize: 11, background: 'var(--surface0)', color: 'var(--subtext1)' }}>
            Today
          </button>
        </div>
        <div className="flex gap-2">
          <ToggleBtn active={showTasks} onClick={() => setShowTasks(v => !v)} color="var(--c-task)">
            <Icons.CheckSquare size={12} /> Tasks
          </ToggleBtn>
          <ToggleBtn active={showRoutines} onClick={() => setShowRoutines(v => !v)} color="var(--c-routine)">
            <Icons.Repeat size={12} /> Routines
          </ToggleBtn>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)' }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--surface1)' }}>
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center font-semibold uppercase text-ctp-subtext0 py-2.5"
              style={{ fontSize: 10, letterSpacing: 0.8 }}>{d}</div>
          ))}
        </div>

        {/* Day cells — 6 rows */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {gridDays.map((day, i) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const inMonth = isSameMonth(day, currentMonth);
            const isTod = isToday(day);
            const dayTasks = (showTasks ? tasksByDate.get(dateKey) : null) ?? [];
            const dayRoutines = (showRoutines ? routinesByDate.get(dateKey) : null) ?? [];
            const isExpanded = expandedDay === dateKey;
            const hasItems = dayTasks.length > 0 || dayRoutines.length > 0;

            return (
              <div
                key={i}
                className="relative cursor-pointer hover:bg-ctp-mantle transition-colors"
                style={{
                  minHeight: 90,
                  padding: 6,
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--surface1)' : 'none',
                  borderBottom: i < 35 ? '1px solid var(--surface1)' : 'none',
                  opacity: inMonth ? 1 : 0.35,
                  background: isTod ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : undefined,
                }}
                onClick={() => hasItems && setExpandedDay(isExpanded ? null : dateKey)}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="inline-flex items-center justify-center rounded-full"
                    style={{
                      width: 22, height: 22,
                      fontSize: 11, fontWeight: isTod ? 700 : 500,
                      background: isTod ? 'var(--accent)' : 'transparent',
                      color: isTod ? 'var(--mantle)' : inMonth ? 'var(--text)' : 'var(--overlay0)',
                    }}
                  >
                    {day.getDate()}
                  </span>
                </div>

                {/* Task chips */}
                {dayTasks.slice(0, isExpanded ? 10 : 2).map((t: any) => (
                  <div
                    key={t._id}
                    className="truncate rounded px-1 mb-0.5 cursor-pointer"
                    style={{
                      fontSize: 10,
                      background: t.status === 'DONE' ? 'color-mix(in srgb, var(--green) 20%, transparent)'
                        : t.status === 'IN_PROGRESS' ? 'color-mix(in srgb, var(--blue) 20%, transparent)'
                        : 'color-mix(in srgb, var(--c-task) 15%, transparent)',
                      color: t.status === 'DONE' ? 'var(--green)' : 'var(--text)',
                      lineHeight: '18px',
                    }}
                    onClick={(e) => { e.stopPropagation(); onOpen(t._id); }}
                  >
                    {t.title}
                  </div>
                ))}
                {!isExpanded && dayTasks.length > 2 && (
                  <div className="text-ctp-overlay1" style={{ fontSize: 9 }}>+{dayTasks.length - 2} more</div>
                )}

                {/* Routine dots */}
                {dayRoutines.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayRoutines.slice(0, isExpanded ? 20 : 6).map((r, ri) => (
                      <div
                        key={ri}
                        className="rounded-full"
                        style={{
                          width: 6, height: 6,
                          background: r.done ? 'var(--green)' : 'var(--overlay0)',
                        }}
                        title={`${r.routine.title}${r.done ? ' ✓' : ''}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ToggleBtn({ active, onClick, color, children }: {
  active: boolean; onClick: () => void; color: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 border-none cursor-pointer rounded-md px-2.5 py-1.5 font-semibold transition-all"
      style={{
        fontSize: 11,
        background: active ? `color-mix(in srgb, ${color} 18%, var(--surface0))` : 'var(--surface0)',
        color: active ? color : 'var(--overlay1)',
        border: `1px solid ${active ? `color-mix(in srgb, ${color} 30%, var(--surface1))` : 'var(--surface1)'}`,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

