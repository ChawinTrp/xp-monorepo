import { useEffect, useState } from 'react';

// Cold-start splash. The API runs on Render's free tier, which spins the
// instance down when idle; the first request after that takes ~15s to wake.
// Rather than a bare "Loading…", show a progress bar that estimates the wake-up
// so the wait reads as expected, not broken.
const EST_MS = 15000;

export default function BootSplash() {
  const [pct, setPct] = useState(4);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const frac = Math.min((Date.now() - start) / EST_MS, 1);
      // Decelerating fill that approaches — but never reaches — 100% until the
      // data actually arrives (which unmounts this splash). Caps at 92%.
      setPct(Math.max(4, Math.round((1 - Math.pow(1 - frac, 1.7)) * 92)));
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ background: 'var(--base)' }}
    >
      <div className="flex flex-col items-center" style={{ gap: 18, width: 240, maxWidth: '80vw' }}>
        <div
          className="grid place-items-center"
          style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--accent), var(--blue))',
            boxShadow: '0 8px 16px rgba(237,123,70,0.30)',
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 20, color: '#FFF' }}>XP</span>
        </div>

        {/* progress track + fill */}
        <div
          style={{
            width: '100%', height: 6, borderRadius: 999,
            background: 'var(--surface1)', overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`, height: '100%', borderRadius: 999,
              background: 'linear-gradient(90deg, var(--accent-soft), var(--accent))',
              transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </div>

        <div className="flex flex-col items-center" style={{ gap: 4 }}>
          <span style={{ color: 'var(--subtext0)', fontSize: 13, fontWeight: 500 }}>
            Waking the server…
          </span>
          <span
            className="mono"
            style={{ color: 'var(--subtext1)', fontSize: 11, letterSpacing: 0.4 }}
          >
            first load after idle takes up to ~15s
          </span>
        </div>
      </div>
    </div>
  );
}
