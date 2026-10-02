import { useEffect, useRef, useState } from 'react';
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/montserrat-alternates/600-italic.css';
import { MAX_SPAN, MIN_SPAN } from './model/camera';
import { useLiveStats } from './model/useLiveStats';
import { strokeCap, strokeWidth, type Stroke, useCanvasStudio } from './model/useCanvasStudio';
import { AxisGizmo } from './ui/AxisGizmo';
import { MiniMap } from './ui/CanvasBoard';
import { PalettePanel } from './ui/PalettePanel';
import { SpaceCanvas } from './ui/SpaceCanvas';
import './ui/canvas.css';

function ForeverPreview({ stroke }: { stroke: Stroke }) {
  const box = { w: 496, h: 176 };
  const pad = 28;
  const xs = stroke.points.map(point => point.x);
  const ys = stroke.points.map(point => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((box.w - pad * 2) / spanX, (box.h - pad * 2) / spanY);
  const ox = (box.w - spanX * scale) / 2;
  const oy = (box.h - spanY * scale) / 2;
  const d = stroke.points
    .map((point, index) => {
      const x = ox + (point.x - minX) * scale;
      const y = oy + (point.y - minY) * scale;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  return (
    <div className="forever-preview" aria-hidden="true">
      <svg viewBox={`0 0 ${box.w} ${box.h}`} preserveAspectRatio="xMidYMid meet">
        <path
          d={d}
          fill="none"
          stroke={stroke.color}
          strokeWidth={Math.max(2.4, strokeWidth(stroke.brush, stroke.width) * 0.08)}
          strokeOpacity={stroke.opacity}
          strokeLinecap={strokeCap(stroke.brush)}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

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
  const [walletConnected, setWalletConnected] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [keepOpen, setKeepOpen] = useState(false);
  const [foreverOpen, setForeverOpen] = useState(false);
  const [hereOpen, setHereOpen] = useState(false);
  const [strokeCommitted, setStrokeCommitted] = useState(false);
  const [keepLeft, setKeepLeft] = useState(30);
  const discardRef = useRef(studio.discardStroke);
  const live = useLiveStats(strokeCommitted);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    discardRef.current = studio.discardStroke;
  }, [studio.discardStroke]);

  // 새 메인 획이 생기면 "Keep this stroke?" 창을 띄우고, 획이 지워지면 확정 상태를 되돌린다.
  const strokeId = studio.stroke?.id ?? null;
  const [seenStrokeId, setSeenStrokeId] = useState<string | null>(null);
  if (strokeId !== seenStrokeId) {
    setSeenStrokeId(strokeId);
    if (!strokeId) {
      setStrokeCommitted(false);
    } else if (!studio.practice && walletConnected) {
      setKeepLeft(30);
      setKeepOpen(true);
    }
  }

  useEffect(() => {
    if (!keepOpen) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, 30 - (Date.now() - started) / 1000);
      setKeepLeft(left);
      if (left > 0) return;
      window.clearInterval(id);
      discardRef.current();
      setKeepOpen(false);
    }, 100);
    return () => window.clearInterval(id);
  }, [keepOpen]);

  const main = view === 'Main Canvas';

  return (
    <div className="frame-viewport" style={{ ['--frame-scale' as string]: String(scale) }}>
      <title>Cameo — Main Canvas</title>
      <SpaceCanvas
        studio={studio}
        canPaint={studio.practice || walletConnected}
        onBlockedPaint={() => setLeaveOpen(true)}
      />
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
        {walletConnected ? (
          <div className="user-chip">
            <i aria-hidden="true" />
            <div>
              <strong>jisun</strong>
              <span>Phantom 0x12…ab</span>
            </div>
          </div>
        ) : (
          <button type="button" className="wallet-button" onClick={() => setWalletConnected(true)}>
            + Connect Wallet
          </button>
        )}
      </header>
      {keepOpen && !studio.practice ? (
        <div className="stroke-modal-scrim is-pass">
          <div
            className="stroke-modal is-keep"
            role="dialog"
            aria-modal="false"
            aria-labelledby="keep-stroke-title"
          >
            <div className="keep-head">
              <h2 id="keep-stroke-title">Keep this stroke?</h2>
              <time>{Math.ceil(keepLeft)}s</time>
            </div>
            <div className="keep-bar" aria-hidden="true">
              <i style={{ width: `${(keepLeft / 30) * 100}%` }} />
            </div>
            <div className="stroke-modal-actions">
              <button
                type="button"
                onClick={() => {
                  studio.discardStroke();
                  setKeepOpen(false);
                }}
              >
                NO
              </button>
              <button
                type="button"
                className="is-confirm"
                onClick={() => {
                  setKeepOpen(false);
                  setForeverOpen(true);
                }}
              >
                YES
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {foreverOpen && studio.stroke && !studio.practice ? (
        <div className="stroke-modal-scrim is-center">
          <div
            className="stroke-modal is-forever"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forever-stroke-title"
            aria-describedby="forever-stroke-copy"
          >
            <ForeverPreview stroke={studio.stroke} />
            <h2 id="forever-stroke-title">Leave your one stroke forever?</h2>
            <p id="forever-stroke-copy">You only get one stroke — ever.</p>
            <div className="stroke-modal-actions">
              <button
                type="button"
                onClick={() => {
                  studio.discardStroke();
                  setForeverOpen(false);
                }}
              >
                Redraw
              </button>
              <button
                type="button"
                className="is-confirm"
                onClick={() => {
                  setForeverOpen(false);
                  setHereOpen(true);
                  setStrokeCommitted(true);
                }}
              >
                Leave forever
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {hereOpen && studio.stroke && !studio.practice ? (
        <div className="stroke-modal-scrim is-center">
          <div
            className="stroke-modal is-here"
            role="dialog"
            aria-modal="true"
            aria-labelledby="here-stroke-title"
            aria-describedby="here-stroke-copy"
          >
            <h2 id="here-stroke-title">Your stroke is here — forever.</h2>
            <p id="here-stroke-copy">Your one and only stroke is now on the main canvas.</p>
            <ForeverPreview stroke={studio.stroke} />
            <div className="stroke-modal-actions">
              <button type="button" onClick={() => setHereOpen(false)}>
                View main canvas
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {leaveOpen && !studio.practice ? (
        <div className="stroke-modal-scrim is-center">
          <div
            className="stroke-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-stroke-title"
            aria-describedby="leave-stroke-copy"
          >
            <h2 id="leave-stroke-title">Leave this stroke?</h2>
            <p id="leave-stroke-copy">
              You need to connect a
              <br />
              wallet to leave a stroke.
            </p>
            <div className="stroke-modal-actions">
              <button
                type="button"
                className="is-confirm"
                onClick={() => {
                  setWalletConnected(true);
                  setLeaveOpen(false);
                }}
              >
                Confirm
              </button>
              <button type="button" onClick={() => setLeaveOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="frame-rule" />
      <div className="frame" style={{ ['--frame-scale' as string]: String(scale) }}>
        {main ? (
          <>
            <PalettePanel studio={studio} />
            <div
              className={
                studio.practice
                  ? 'once-pill is-kept is-practice'
                  : strokeCommitted
                    ? 'once-pill is-kept'
                    : 'once-pill'
              }
            >
              <span>
                {studio.practice ? (
                  <>
                    Practice on this paper
                    <i className="practice-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </i>
                  </>
                ) : strokeCommitted ? (
                  'Your stroke remains forever'
                ) : (
                  'You can draw only once here'
                )}
              </span>
              {studio.practice || strokeCommitted ? null : <b>1 stroke · forever</b>}
            </div>
            <div className="stats-dock">
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
                  <p className="stats-users">
                    <i className="live-dot" aria-hidden="true" />
                    Active Users
                  </p>
                  <strong className="stats-users-value" aria-live="polite">
                    {live.users.toLocaleString('en-US')}
                  </strong>
                  <p className="stats-strokes">Total Strokes</p>
                  <strong className="stats-strokes-value" aria-live="polite">
                    {live.strokes.toLocaleString('en-US')}
                  </strong>
                </div>
              </aside>
              <button
                type="button"
                className={studio.practice ? 'practice-button is-on' : 'practice-button'}
                aria-pressed={studio.practice}
                onClick={() => {
                  const next = !studio.practice;
                  studio.setPracticeMode(next);
                  if (!next) return;
                  setKeepOpen(false);
                  setForeverOpen(false);
                  setLeaveOpen(false);
                  setHereOpen(false);
                }}
              >
                {studio.practice ? 'Exit Practice' : 'Practice Mode'}
              </button>
            </div>
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
