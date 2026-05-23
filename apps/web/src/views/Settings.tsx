import { useState, useEffect } from 'react';
import { Icons } from '../components/ui';

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

interface GCalStatus {
  configured: boolean;
  connected: boolean;
  calendarId: string | null;
}

export default function Settings() {
  const [gcalStatus, setGcalStatus] = useState<GCalStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/gcal/status`)
      .then(r => r.json())
      .then(setGcalStatus)
      .catch(() => setGcalStatus({ configured: false, connected: false, calendarId: null }))
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch(`${API_BASE}/gcal/auth`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // handled
    }
  };

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
      <h1 className="text-[28px] font-bold m-0 mb-6" style={{ letterSpacing: -0.4 }}>Settings</h1>

      {/* Google Calendar */}
      <section className="rounded-xl mb-5" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 20 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg grid place-items-center" style={{
            background: 'linear-gradient(135deg, #4285F4, #34A853, #FBBC05, #EA4335)',
          }}>
            <Icons.Calendar size={20} color="white" />
          </div>
          <div>
            <h2 className="m-0 font-bold" style={{ fontSize: 15 }}>Google Calendar</h2>
            <div className="text-ctp-subtext1" style={{ fontSize: 12 }}>Sync tasks and routines to Google Calendar</div>
          </div>
        </div>

        {loading ? (
          <div className="text-ctp-overlay1" style={{ fontSize: 12 }}>Checking connection...</div>
        ) : !gcalStatus?.configured ? (
          <div className="rounded-lg p-4" style={{ background: 'var(--mantle)', border: '1px solid var(--surface1)' }}>
            <div className="flex items-start gap-3">
              <Icons.AlertTriangle size={16} color="var(--yellow)" className="shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1" style={{ fontSize: 12 }}>Not configured</div>
                <div className="text-ctp-subtext1" style={{ fontSize: 11, lineHeight: 1.5 }}>
                  Set <code style={{ background: 'var(--surface1)', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>GOOGLE_CLIENT_ID</code> and{' '}
                  <code style={{ background: 'var(--surface1)', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>GOOGLE_CLIENT_SECRET</code> environment
                  variables on the API server to enable Google Calendar sync.
                </div>
              </div>
            </div>
          </div>
        ) : gcalStatus.connected ? (
          <div className="rounded-lg p-4" style={{ background: 'color-mix(in srgb, var(--green) 8%, var(--mantle))', border: '1px solid color-mix(in srgb, var(--green) 20%, var(--surface1))' }}>
            <div className="flex items-center gap-3">
              <Icons.CheckCircle size={16} color="var(--green)" />
              <div>
                <div className="font-semibold" style={{ fontSize: 12, color: 'var(--green)' }}>Connected</div>
                <div className="text-ctp-subtext1 mt-0.5" style={{ fontSize: 11 }}>
                  Syncing to calendar: {gcalStatus.calendarId ?? 'XP Tasks'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="inline-flex items-center gap-2 border-none cursor-pointer rounded-lg px-4 py-2.5 font-semibold transition-all"
            style={{
              fontSize: 13, fontFamily: 'inherit',
              background: '#4285F4', color: 'white',
            }}
          >
            <Icons.Calendar size={16} />
            Connect Google Calendar
          </button>
        )}

        <div className="mt-4 text-ctp-subtext1" style={{ fontSize: 11, lineHeight: 1.6 }}>
          <strong>How it works:</strong> When connected, XP automatically creates and updates
          Google Calendar events for tasks with due dates and daily routines. Events appear in
          a dedicated "XP Tasks" calendar.
        </div>
      </section>

      {/* About */}
      <section className="rounded-xl" style={{ background: 'var(--surface0)', border: '1px solid var(--surface1)', padding: 20 }}>
        <h2 className="m-0 font-bold mb-3" style={{ fontSize: 15 }}>About</h2>
        <div className="flex flex-col gap-1.5 text-ctp-subtext1" style={{ fontSize: 12 }}>
          <div>XP Life OS v0.4</div>
          <div>Phase 8: The Orchestra</div>
          <div>Built by CT</div>
        </div>
      </section>
    </div>
  );
}
