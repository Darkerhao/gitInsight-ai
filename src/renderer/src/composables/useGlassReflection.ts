import { onBeforeUnmount, onMounted, type Ref } from 'vue';

/** One delegated listener for outer panels; CSS provides the soft trailing motion. */
export function useGlassReflection(root: Ref<HTMLElement | null>) {
  let activePanel: HTMLElement | null = null;
  let frame = 0;
  let x = 0;
  let y = 0;
  const events = new AbortController();

  function stopReflection() {
    cancelAnimationFrame(frame);
    frame = 0;
    activePanel?.classList.remove('is-glass-hovered');
    activePanel = null;
  }

  onMounted(() => {
    const container = root.value;
    if (!container) return;
    const motion = window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
    const options = { passive: true, signal: events.signal };

    container.addEventListener('pointermove', (event) => {
      if (!motion.matches || event.pointerType !== 'mouse') return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      let panel = target.closest<HTMLElement>('.surface-card, .config-block');
      // Nested cards share the outer surface; controls and report text stay still.
      for (let parent = panel?.parentElement?.closest<HTMLElement>('.surface-card, .config-block'); parent; parent = parent.parentElement?.closest<HTMLElement>('.surface-card, .config-block')) {
        panel = parent;
      }
      if (!panel || !container.contains(panel) || panel.dataset.glassDisabled === 'true' || target.closest('input, textarea, [contenteditable], .el-input, .el-select, .el-textarea, table, .el-table, .report-preview')) {
        stopReflection();
        return;
      }
      if (activePanel !== panel) {
        stopReflection();
        activePanel = panel;
      }
      x = event.clientX;
      y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!activePanel) return;
        const bounds = activePanel.getBoundingClientRect();
        activePanel.style.setProperty('--glass-x', `${x - bounds.left}px`);
        activePanel.style.setProperty('--glass-y', `${y - bounds.top}px`);
        activePanel.classList.add('is-glass-hovered');
      });
    }, options);
    container.addEventListener('pointerout', (event) => {
      if (!(event.relatedTarget instanceof Node) || !activePanel?.contains(event.relatedTarget)) stopReflection();
    }, options);
    container.addEventListener('scroll', stopReflection, { ...options, capture: true });
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
