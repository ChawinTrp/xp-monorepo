import { useEffect, useState, type ReactNode } from 'react';
import { Button, GlassPanel } from './ui';

// The API refuses requests without the right XP_API_KEY (api-key.guard.ts).
// gatedFetch spots that refusal and raises this screen on any device — the
// phone shell has no Settings page, so this is where a key gets entered.
const NEED_KEY = 'xp:need-key';
const REFUSED = 'Invalid or missing API key';

// ponytail: clones + scans every GraphQL response body for the guard message; fine at one user's payload sizes
export const gatedFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === 401 || (await res.clone().text()).includes(REFUSED)) {
    window.dispatchEvent(new Event(NEED_KEY));
  }
  return res;
};

export default function KeyGate({ children }: { children: ReactNode }) {
  const [needKey, setNeedKey] = useState(false);
  const [key, setKey] = useState('');
  const hadKey = localStorage.getItem('xp_api_key') != null;

  useEffect(() => {
    const h = () => setNeedKey(true);
    window.addEventListener(NEED_KEY, h);
    return () => window.removeEventListener(NEED_KEY, h);
  }, []);

  const save = () => {
    if (!key.trim()) return;
    localStorage.setItem('xp_api_key', key.trim());
    window.location.reload(); // Apollo reads the key at startup
  };

  return (
    <>
      {children}
      {needKey && (
        <div className="fixed inset-0 grid place-items-center" style={{ zIndex: 1000, background: 'var(--base)', padding: 16 }}>
          <GlassPanel solid style={{ width: '100%', maxWidth: 380, padding: 24 }}>
            <h1 className="font-bold m-0" style={{ fontSize: 22 }}>Enter XP key</h1>
            <p className="text-ctp-subtext1" style={{ fontSize: 13, margin: '8px 0 16px' }}>
              {hadKey ? 'The saved key was refused. Paste the current one.' : 'This XP needs its API key. It is stored in this browser only.'}
            </p>
            <input
              type="password" autoFocus autoComplete="current-password" value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="XP API key"
              className="w-full rounded-lg mono"
              style={{ padding: '12px', fontSize: 14, background: 'var(--surface0)', border: '1px solid var(--border)', color: 'var(--text)', marginBottom: 16, minHeight: 44 }}
            />
            <Button onClick={save} disabled={!key.trim()} style={{ width: '100%', justifyContent: 'center', minHeight: 44 }}>
              Save and reload
            </Button>
          </GlassPanel>
        </div>
      )}
    </>
  );
}
