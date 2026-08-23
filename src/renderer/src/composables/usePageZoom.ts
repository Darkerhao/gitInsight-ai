import { ref } from 'vue';
import { changePageZoom, clampPageZoom, PAGE_ZOOM_DEFAULT, PAGE_ZOOM_MAX, PAGE_ZOOM_MIN } from '@shared/pageZoom';

const zoomFactor = ref(PAGE_ZOOM_DEFAULT);
const PAGE_ZOOM_STORAGE_KEY = 'gitinsight:page-zoom-factor';
let initialized = false;

function readStoredZoomFactor() {
  try {
    const value = Number(window.localStorage.getItem(PAGE_ZOOM_STORAGE_KEY));
    return value > 0 ? clampPageZoom(value) : null;
  } catch {
    return null;
  }
}

function rememberZoomFactor(factor: number) {
  try {
    window.localStorage.setItem(PAGE_ZOOM_STORAGE_KEY, String(factor));
  } catch {
    // The current session still works when localStorage is unavailable.
  }
}

async function initializePageZoom() {
  if (initialized) return;
  initialized = true;
  try {
    const stored = readStoredZoomFactor();
    zoomFactor.value = stored === null
      ? clampPageZoom(await window.api.getZoomFactor())
      : clampPageZoom(await window.api.setZoomFactor(stored));
    rememberZoomFactor(zoomFactor.value);
  } catch {
    zoomFactor.value = PAGE_ZOOM_DEFAULT;
  }
}

async function setPageZoom(factor: number) {
  const next = clampPageZoom(factor);
  try {
    zoomFactor.value = clampPageZoom(await window.api.setZoomFactor(next));
    rememberZoomFactor(zoomFactor.value);
  } catch {
    // Keep the last confirmed zoom level when the main process is unavailable.
  }
}

async function changePageZoomBy(delta: number) {
  try {
    zoomFactor.value = clampPageZoom(await window.api.changeZoomFactor(delta));
    rememberZoomFactor(zoomFactor.value);
  } catch {
    await setPageZoom(changePageZoom(zoomFactor.value, delta));
  }
}

function resetPageZoom() {
  return setPageZoom(PAGE_ZOOM_DEFAULT);
}

export function usePageZoom() {
  return {
    zoomFactor,
    canZoomOut: () => zoomFactor.value > PAGE_ZOOM_MIN,
    canZoomIn: () => zoomFactor.value < PAGE_ZOOM_MAX,
    initializePageZoom,
    zoomIn: () => changePageZoomBy(1),
    zoomOut: () => changePageZoomBy(-1),
    resetPageZoom,
  };
}
