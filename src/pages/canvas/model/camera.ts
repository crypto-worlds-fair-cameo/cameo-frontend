export const WORLD = 10000;
export const MIN_SPAN = 1000;
export const MAX_SPAN = 10000;
export const HALF = WORLD / 2;

export type CameraPose = { yaw: number; pitch: number; span: number };
export type CameraView = 'x' | 'y' | 'z' | 'home';
export type ScreenPoint = { x: number; y: number; scale: number };

/** On-screen size of the whole canvas when zoomed out to 10000px. */
export const VIEW_FRAME = 820;
/** Space reserved so the paper sits below the site header. */
export const STAGE_TOP = 120;
const PERSPECTIVE_FIT = 1.08;

export const CAMERA_HOME: CameraPose = { yaw: 0, pitch: 89, span: MAX_SPAN };

const DEG = Math.PI / 180;

export const clampPitch = (pitch: number) => Math.min(89, Math.max(-80, pitch));

export const wrapYaw = (yaw: number) => ((((yaw + 180) % 360) + 360) % 360) - 180;

export const clampSpan = (span: number) => Math.min(MAX_SPAN, Math.max(MIN_SPAN, span));

export const insideWorld = (x: number, z: number) =>
  x >= -HALF && x <= HALF && z >= -HALF && z <= HALF;

export const cameraFor = (view: CameraView): CameraPose => {
  if (view === 'x') return { yaw: -90, pitch: 28, span: CAMERA_HOME.span };
  if (view === 'y') return { yaw: -32, pitch: 78, span: CAMERA_HOME.span };
  if (view === 'z') return { yaw: 0, pitch: 28, span: CAMERA_HOME.span };
  return { ...CAMERA_HOME };
};

export const focalOf = (viewW: number, viewH: number) => Math.min(viewW, viewH) * 0.62;

export const stageCenter = (viewW: number, viewH: number) => ({
  x: viewW / 2,
  y: (viewH + STAGE_TOP) / 2,
});

/** Screen size of the canvas, capped so a short window still shows the whole square. */
export const displayFrame = (viewW: number, viewH: number) =>
  Math.min(VIEW_FRAME, Math.max(280, Math.min(viewW - 400, viewH - STAGE_TOP - 180)));

/** Distance that fits `span` world pixels into the 1000px frame, not the whole window. */
export const cameraDistance = (span: number, viewW: number, viewH: number) =>
  (focalOf(viewW, viewH) * span * PERSPECTIVE_FIT) / displayFrame(viewW, viewH);

export const project = (
  x: number,
  y: number,
  z: number,
  pose: CameraPose,
  viewW: number,
  viewH: number
): ScreenPoint | null => {
  const yaw = pose.yaw * DEG;
  const pitch = pose.pitch * DEG;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const rx = x * cosYaw - z * sinYaw;
  const rz = x * sinYaw + z * cosYaw;
  const ry = y * cosPitch - rz * sinPitch;
  const depth = rz * cosPitch + y * sinPitch + cameraDistance(pose.span, viewW, viewH);
  if (depth < 0.5) return null;
  const scale = focalOf(viewW, viewH) / depth;
  const origin = stageCenter(viewW, viewH);
  return { x: origin.x + rx * scale, y: origin.y - ry * scale, scale };
};

export const hitGround = (
  sx: number,
  sy: number,
  pose: CameraPose,
  viewW: number,
  viewH: number
) => {
  const yaw = pose.yaw * DEG;
  const pitch = pose.pitch * DEG;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const focal = focalOf(viewW, viewH);
  const distance = cameraDistance(pose.span, viewW, viewH);
  const origin = stageCenter(viewW, viewH);
  const dx = sx - origin.x;
  const dy = sy - origin.y;
  let rx: number;
  let rz: number;

  if (Math.abs(sinPitch) < 0.04) {
    rx = (dx / focal) * distance;
    rz = (dy / focal) * distance;
  } else {
    const depth = distance / (1 - (dy * cosPitch) / (focal * sinPitch));
    if (depth <= 0.4) return null;
    rx = (dx * depth) / focal;
    rz = (dy * depth) / (focal * sinPitch);
  }

  return {
    x: rx * cosYaw + rz * sinYaw,
    z: -rx * sinYaw + rz * cosYaw,
  };
};

/** Unit axis as seen by the camera. Screen Y points down. */
export const viewDirection = (x: number, y: number, z: number, pose: CameraPose) => {
  const yaw = pose.yaw * DEG;
  const pitch = pose.pitch * DEG;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const rx = x * cosYaw - z * sinYaw;
  const rz = x * sinYaw + z * cosYaw;
  const ry = y * cosPitch - rz * sinPitch;
  return { x: rx, y: -ry, depth: rz * cosPitch + y * sinPitch };
};
