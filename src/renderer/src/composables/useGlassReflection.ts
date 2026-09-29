import { onBeforeUnmount, onMounted, type Ref } from 'vue';

const PANEL_SELECTOR = '.surface-card, .config-block';
const EDITOR_SELECTOR = 'input, textarea, select, [contenteditable]';
const STABLE_SELECTOR = `${EDITOR_SELECTOR}, button, a, label, [role="button"], .el-input, .el-select, .el-textarea, table, .el-table, .report-preview`;

/** One pointer tracker for the outer card; CSS owns tilt, light and the return motion. */
export function useGlassReflection(root: Ref<HTMLElement | null>) {
  let activePanel: HTMLElement | null = null;
  let bounds: DOMRect | null = null;
  let frame = 0;
  let x = 0;
  let y = 0;
  const events = new AbortController();

  function stopReflection() {
    cancelAnimationFrame(frame);
    frame = 0;
    activePanel?.classList.remove('is-glass-hovered');
    activePanel = null;
    bounds = null;
  }

  onMounted(() => {
    const container = root.value;
    if (!container) return;
    const motion = window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
    const options = { passive: true, signal: events.signal };

    container.addEventListener('pointermove', (event) => {
      if (!motion.matches || event.pointerType !== 'mouse' || event.buttons !== 0) {
        stopReflection();
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      let panel = target.closest<HTMLElement>(PANEL_SELECTOR);
      // Nested cards share one transform instead of accumulating perspective.
      for (let parent = panel?.parentElement?.closest<HTMLElement>(PANEL_SELECTOR); parent; parent = parent.parentElement?.closest<HTMLElement>(PANEL_SELECTOR)) {
        panel = parent;
      }
      const focusedEditor = document.activeElement?.matches(EDITOR_SELECTOR) && panel?.contains(document.activeElement);
      if (!panel || !container.contains(panel) || target.closest('[data-glass-disabled="true"]') || target.closest(STABLE_SELECTOR) || focusedEditor) {
        stopReflection();
        return;
      }
      if (activePanel !== panel) {
        stopReflection();
        activePanel = panel;
        // Keep the reference rectangle fixed while tilting to avoid pointer feedback jitter.
        bounds = panel.getBoundingClientRect();
      }
      x = event.clientX;
      y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!activePanel || !bounds || !bounds.width || !bounds.height) return;
        const px = Math.max(0, Math.min(1, (x - bounds.left) / bounds.width));
        const py = Math.max(0, Math.min(1, (y - bounds.top) / bounds.height));
        const nx = px * 2 - 1;
        const ny = py * 2 - 1;
        activePanel.style.setProperty('--glass-x', `${px * bounds.width}px`);
        activePanel.style.setProperty('--glass-y', `${py * bounds.height}px`);
        // Limit edge displacement on tall editors and wide desktop panels.
        activePanel.style.setProperty('--glass-rotate-x', `${-ny * Math.min(5, 2400 / bounds.height)}deg`);
        activePanel.style.setProperty('--glass-rotate-y', `${nx * Math.min(6, 2800 / bounds.width)}deg`);
        activePanel.style.setProperty('--glass-shadow-x', `${-nx * 14}px`);
        activePanel.style.setProperty('--glass-shadow-y', `${20 - ny * 8}px`);
        activePanel.style.setProperty('--glass-angle', `${125 + nx * 25 - ny * 15}deg`);
        activePanel.classList.add('is-glass-hovered');
      });
    }, options);
    container.addEventListener('pointerout', (event) => {
      if (!(event.relatedTarget instanceof Node) || !activePanel?.contains(event.relatedTarget)) stopReflection();
    }, options);
    container.addEventListener('scroll', stopReflection, { ...options, capture: true });
    container.addEventListener('pointerdown', stopReflection, options);
    container.addEventListener('pointercancel', stopReflection, options);
    container.addEventListener('focusin', stopReflection, options);
    window.addEventListener('resize', stopReflection, options);
    window.addEventListener('blur', stopReflection, options);
    document.addEventListener('visibilitychange', stopReflection, options);
    motion.addEventListener('change', stopReflection, options);
  });

  onBeforeUnmount(() => {
    events.abort();
    stopReflection();
  });

  return stopReflection;
}
