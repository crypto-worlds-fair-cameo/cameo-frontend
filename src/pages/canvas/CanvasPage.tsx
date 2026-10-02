import { useEffect, useState } from 'react';
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/montserrat-alternates/600-italic.css';
import { MAX_SPAN, MIN_SPAN } from './model/camera';
import { useCanvasStudio } from './model/useCanvasStudio';
import { AxisGizmo } from './ui/AxisGizmo';
import { MiniMap } from './ui/CanvasBoard';
import { PalettePanel } from './ui/PalettePanel';
import { SpaceCanvas } from './ui/SpaceCanvas';
import './ui/canvas.css';

const views = [
  { id: 'Main Canvas', className: 'nav-main' },
  { id: 'Season Canvas', className: 'nav-season' },
  { id: 'History', className: 'nav-history' },
] as const;

export default function CanvasPage() {
  const studio = useCanvasStudio();
  const [view, setView] = useState<(typeof views)[number]['id']>('Main Canvas');
  const [scale, setScale] = useState(1);
  const [statsOpen, setStatsOpen] = useState(true);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const main = view === 'Main Canvas';

  return (
    <div className="frame-viewport">
      <title>Cameo — Main Canvas</title>
      <SpaceCanvas studio={studio} />
      <header className="site-header">
        <img className="frame-logo" src="/images/cameo-logo.png" alt="cameo" />
        <nav className="frame-nav" aria-label="Canvas sections">
          {views.map(item => (
            <button
              key={item.id}
              type="button"
              className={item.className}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
            >
              {item.id}
            </button>
          ))}
        </nav>
        <div className="user-chip">
          <i aria-hidden="true" />
          <div>
            <strong>jisun</strong>
            <span>Phantom 0x12…ab</span>
          </div>
        </div>
      </header>
      <div className="frame-rule" />
      <div className="frame" style={{ ['--frame-scale' as string]: String(scale) }}>
        {main ? (
          <>
            <PalettePanel studio={studio} />
            <div className="once-pill">
              <span>You can draw only once here</span>
              <b>1 stroke · forever</b>
            </div>
            <aside className={statsOpen ? 'stats-card' : 'stats-card is-collapsed'}>
              <p className="stats-heading">Stats</p>
              <button
                type="button"
                className="panel-toggle"
                aria-expanded={statsOpen}
                aria-label={statsOpen ? 'Collapse stats' : 'Expand stats'}
                onClick={() => setStatsOpen(open => !open)}
              >
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path
                    d="M2 4.5 6 8.5 10 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="panel-body">
                <i className="live-dot" aria-hidden="true" />
                <p className="stats-users">Active Users</p>
                <strong className="stats-users-value">42</strong>
                <p className="stats-strokes">Total Strokes</p>
                <strong className="stats-strokes-value">128,940</strong>
              </div>
            </aside>
            <div className="view-dock">
              <MiniMap studio={studio} />
              <div className="zoom-pair">
                <button
                  type="button"
                  className="zoom-button"
                  aria-label="Zoom in"
                  onClick={() => studio.zoomBy(1.25)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="zoom-button"
                  aria-label="Zoom out"
                  onClick={() => studio.zoomBy(0.8)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="front-button"
                  aria-label="Reset to front view"
                  onClick={() => studio.lookFrom('home')}
                >
                  Front
                </button>
              </div>
              <p className="minimap-label">10000 x 10000 px</p>
            </div>
            <div className="camera-dock">
              <p className="space-range">
                {studio.camera.span.toLocaleString('en-US')} px
                <span>
                  {MIN_SPAN.toLocaleString('en-US')}–{MAX_SPAN.toLocaleString('en-US')} px
                </span>
              </p>
              <AxisGizmo studio={studio} />
            </div>
          </>
        ) : (
          <section className="frame-placeholder">
            <p>{view} is not in this frame yet.</p>
          </section>
        )}
      </div>
    </div>
  );
}
