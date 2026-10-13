import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

const FACE = 176;
const CENTER = FACE / 2;
const NUMBER_RADIUS = 56;
const HOUR_LABELS = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const MINUTE_MARKS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type Period = 'AM' | 'PM';

function padTime(value: number) {
  return String(value).padStart(2, '0');
}

function to24(hour12: number, period: Period) {
  const base = hour12 % 12;
  return period === 'PM' ? base + 12 : base;
}

function point(angle: number, length: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: CENTER + Math.sin(rad) * length,
    y: CENTER - Math.cos(rad) * length,
  };
}

function angleFromEvent(event: ReactPointerEvent, face: HTMLElement) {
  const rect = face.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

export function SeasonTimeDial({
  label,
  hour,
  minute,
  placement,
  onCommit,
}: {
  label: string;
  hour: number;
  minute: number;
  placement: 'top' | 'bottom';
  onCommit: (hour: number, minute: number, close: boolean) => void;
}) {
  const { t } = useTranslation('seasonCanvas');
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const dialRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const period: Period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  const hourAngle = hour12 * 30;
  const minuteAngle = minute * 6;
  const hourHand = point(hourAngle, 46);
  const minuteHand = point(minuteAngle, 58);
  const marks =
    mode === 'hour'
      ? HOUR_LABELS.map((text, index) => ({
          key: text,
          text,
          selected: text === String(hour12),
          select: () => {
            onCommit(to24(index === 0 ? 12 : index, period), minute, false);
            setMode('minute');
          },
        }))
      : MINUTE_MARKS.map(value => ({
          key: padTime(value),
          text: padTime(value),
          selected: value === minute,
          select: () => onCommit(hour, value, true),
        }));

  useEffect(() => {
    const root = dialRef.current;
    if (!root) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && root.contains(active)) return;
    root
      .querySelector<HTMLElement>('.season-time-dial__mark[aria-selected="true"]')
      ?.focus({ preventScroll: true });
  }, [mode, period]);

  function applyAngle(event: ReactPointerEvent) {
    const face = faceRef.current;
    if (!face) return;
    const angle = (angleFromEvent(event, face) + 360) % 360;
    if (mode === 'hour') {
      const index = Math.round(angle / 30) % 12;
      onCommit(to24(index === 0 ? 12 : index, period), minute, false);
      return;
    }
    onCommit(hour, Math.round(angle / 6) % 60, false);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as Element).closest('button')) return;
    dragging.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 이미 끝난 포인터에는 캡처가 거절되어도 시계판 안쪽 드래그는 계속된다.
    }
    applyAngle(event);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    applyAngle(event);
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    const face = faceRef.current;
    if (!face) return;
    const angle = (angleFromEvent(event, face) + 360) % 360;
    if (mode === 'hour') {
      const index = Math.round(angle / 30) % 12;
      onCommit(to24(index === 0 ? 12 : index, period), minute, false);
      setMode('minute');
      return;
    }
    onCommit(hour, Math.round(angle / 6) % 60, true);
  }

  function onKeyDown(event: ReactKeyboardEvent) {
    const delta =
      event.key === 'ArrowUp' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    if (mode === 'hour') {
      const next = ((hour12 - 1 + delta + 12) % 12) + 1;
      onCommit(to24(next, period), minute, false);
      return;
    }
    onCommit(hour, (minute + delta + 60) % 60, false);
  }

  function selectPeriod(next: Period) {
    onCommit(to24(hour12, next), minute, false);
  }

  return (
    <div
      ref={dialRef}
      className="season-form__time-dial"
      data-placement={placement}
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      <div className="season-time-dial__readout">
        <button
          type="button"
          aria-pressed={mode === 'hour'}
          aria-label={t('form.hourValue', { value: hour12 })}
          onClick={() => setMode('hour')}
        >
          {hour12}
        </button>
        <span aria-hidden="true">:</span>
        <button
          type="button"
          aria-pressed={mode === 'minute'}
          aria-label={t('form.minuteValue', { value: padTime(minute) })}
          onClick={() => setMode('minute')}
        >
          {padTime(minute)}
        </button>
      </div>
      <div
        ref={faceRef}
        className="season-time-dial__face"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <svg viewBox={`0 0 ${FACE} ${FACE}`} aria-hidden="true">
          <circle cx={CENTER} cy={CENTER} r="86" fill="#F5F5F5" stroke="#D6D6D6" />
          {Array.from({ length: 60 }, (_, index) => {
            const major = index % 5 === 0;
            const outer = point(index * 6, 80);
            const inner = point(index * 6, major ? 72 : 76);
            return (
              <line
                key={index}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={major ? '#171717' : '#D6D6D6'}
                strokeWidth={major ? 1.5 : 1}
                strokeLinecap="round"
              />
            );
          })}
          <line
            x1={CENTER}
            y1={CENTER}
            x2={minuteHand.x}
            y2={minuteHand.y}
            stroke={mode === 'minute' ? '#171717' : '#B8B8B8'}
            strokeWidth={mode === 'minute' ? 2 : 1.5}
            strokeLinecap="round"
          />
          <line
            x1={CENTER}
            y1={CENTER}
            x2={hourHand.x}
            y2={hourHand.y}
            stroke={mode === 'hour' ? '#171717' : '#B8B8B8'}
            strokeWidth={mode === 'hour' ? 3 : 2}
            strokeLinecap="round"
          />
          <circle cx={CENTER} cy={CENTER} r="4" fill="#171717" />
          <circle cx={CENTER} cy={CENTER} r="1.5" fill="#FFFFFF" />
        </svg>
        {marks.map((mark, index) => {
          const angle = index * 30 * (Math.PI / 180);
          const radius = (NUMBER_RADIUS / FACE) * 100;
          return (
            <button
              key={mark.key}
              type="button"
              className="season-time-dial__mark"
              aria-selected={mark.selected}
              style={{
                left: `${50 + Math.sin(angle) * radius}%`,
                top: `${50 - Math.cos(angle) * radius}%`,
              }}
              onClick={mark.select}
            >
              {mark.text}
            </button>
          );
        })}
      </div>
      <div className="season-time-dial__period">
        <button type="button" aria-pressed={period === 'AM'} onClick={() => selectPeriod('AM')}>
          AM
        </button>
        <button type="button" aria-pressed={period === 'PM'} onClick={() => selectPeriod('PM')}>
          PM
        </button>
      </div>
    </div>
  );
}
