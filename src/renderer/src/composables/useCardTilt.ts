import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

/** Pointer-driven presentation only; the hit area remains fixed while its contents tilt. */
export function useCardTilt(maxRotation = 5, enabled: () => boolean = () => true) {
  const tiltTarget = ref<HTMLElement | null>(null);
  let media: MediaQueryList;
  let frame: number | null = null;
  let pointerX = 0;
  let pointerY = 0;

  function resetTilt() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    tiltTarget.value?.removeAttribute('data-tilting');
    for (const property of ['--card-tilt-x', '--card-tilt-y', '--card-shine-x', '--card-shine-y']) {
      tiltTarget.value?.style.removeProperty(property);
    }
  }

  function tilt(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || !media?.matches || document.hidden || !enabled()) {
      resetTilt();
      return;
    }
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      const target = tiltTarget.value;
      if (!target || !media.matches || document.hidden || !enabled()) return;
      const bounds = target.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (pointerX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (pointerY - bounds.top) / bounds.height));
      target.style.setProperty('--card-tilt-x', `${(0.5 - y) * maxRotation * 2}deg`);
      target.style.setProperty('--card-tilt-y', `${(x - 0.5) * maxRotation * 2}deg`);
      target.style.setProperty('--card-shine-x', `${x * 100}%`);
      target.style.setProperty('--card-shine-y', `${y * 100}%`);
      target.setAttribute('data-tilting', '');
    });
  }

  watch(enabled, resetTilt);
  watch(tiltTarget, resetTilt, { flush: 'sync' });
  onMounted(() => {
    media = window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
    media.addEventListener('change', resetTilt);
    document.addEventListener('visibilitychange', resetTilt);
    window.addEventListener('blur', resetTilt);
  });
  onBeforeUnmount(() => {
    resetTilt();
    media.removeEventListener('change', resetTilt);
    document.removeEventListener('visibilitychange', resetTilt);
    window.removeEventListener('blur', resetTilt);
  });

  return { tiltTarget, tilt, resetTilt };
}
