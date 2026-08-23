export const PAGE_ZOOM_DEFAULT = 1;
export const PAGE_ZOOM_MIN = 0.8;
export const PAGE_ZOOM_MAX = 1.5;
export const PAGE_ZOOM_STEP = 0.1;

export function clampPageZoom(value: number): number {
  if (!Number.isFinite(value)) return PAGE_ZOOM_DEFAULT;
  return Math.min(PAGE_ZOOM_MAX, Math.max(PAGE_ZOOM_MIN, Number(value.toFixed(2))));
}

export function changePageZoom(current: number, delta: number): number {
  return clampPageZoom(current + delta * PAGE_ZOOM_STEP);
}
