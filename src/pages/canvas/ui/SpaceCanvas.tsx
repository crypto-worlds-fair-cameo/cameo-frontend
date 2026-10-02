import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { hitGround, insideWorld } from '../model/camera';
import type { useCanvasStudio } from '../model/useCanvasStudio';
import { paintSpace } from './paintSpace';

type Studio = ReturnType<typeof useCanvasStudio>;

export function SpaceCanvas({
  studio,
  canPaint,
  onBlockedPaint,
}: {
  studio: Studio;
  canPaint: boolean;
  onBlockedPaint?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const studioRef = useRef(studio);
  const canPaintRef = useRef(canPaint);
  const blockedRef = useRef(onBlockedPaint);
  const mode = useRef<'draw' | 'orbit' | null>(null);
  const orbit = useRef({ x: 0, y: 0 });

  useEffect(() => {
    studioRef.current = studio;
    canPaintRef.current = canPaint;
    blockedRef.current = onBlockedPaint;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const draw = () => {
      paintSpace(canvas, studioRef.current);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      studioRef.current.zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  const groundFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return hitGround(
      event.clientX - rect.left,
      event.clientY - rect.top,
      studioRef.current.camera,
      rect.width,
      rect.height
    );
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="space-canvas"
        aria-label="3D canvas space"
        onContextMenu={event => event.preventDefault()}
        onPointerDown={event => {
          const orbiting = event.button === 2 || event.shiftKey;
          if (orbiting) {
            mode.current = 'orbit';
            orbit.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.classList.add('orbiting');
            event.currentTarget.setPointerCapture(event.pointerId);
            return;
          }
          const hit = groundFromEvent(event);
          const studioNow = studioRef.current;
          if (hit && studioNow.canDraw && insideWorld(hit.x, hit.z)) {
            if (!canPaintRef.current) {
              blockedRef.current?.();
              return;
            }
            mode.current = 'draw';
            studioNow.beginStroke({ x: hit.x, y: hit.z });
          } else {
            mode.current = 'orbit';
            orbit.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.classList.add('orbiting');
          }
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (mode.current === 'draw') {
            const hit = groundFromEvent(event);
            if (!hit || !insideWorld(hit.x, hit.z)) return;
            studioRef.current.extendStroke({ x: hit.x, y: hit.z });
            return;
          }
          if (mode.current !== 'orbit') return;
          const dx = event.clientX - orbit.current.x;
          const dy = event.clientY - orbit.current.y;
          orbit.current = { x: event.clientX, y: event.clientY };
          studioRef.current.orbitBy(dx * 0.28, dy * 0.22);
        }}
        onPointerUp={event => {
          if (mode.current === 'draw') studioRef.current.endStroke();
          mode.current = null;
          event.currentTarget.classList.remove('orbiting');
        }}
        onPointerCancel={event => {
          if (mode.current === 'draw') studioRef.current.endStroke();
          mode.current = null;
          event.currentTarget.classList.remove('orbiting');
        }}
      />
    </>
  );
}
