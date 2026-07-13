import { onBeforeUnmount, ref } from 'vue';
import type { Ref } from 'vue';
import type { TimelineDayGroup } from '@shared/types';

export function usePlayback(days: Ref<TimelineDayGroup[]>, selectedDayIndex: Ref<number>, selectDay: (day: TimelineDayGroup) => void) {
  const isPlaying = ref(false);
  let playbackTimer: number | undefined;

  function stopPlayback() {
    isPlaying.value = false;
    window.clearInterval(playbackTimer);
    playbackTimer = undefined;
  }

  function togglePlayback() {
    if (isPlaying.value) { stopPlayback(); return; }
    if (!days.value.length) return;
    isPlaying.value = true;
    playbackTimer = window.setInterval(() => {
      const index = selectedDayIndex.value;
      if (index >= days.value.length - 1) {
        stopPlayback();
        return;
      }
      selectDay(days.value[index + 1]);
    }, 1800);
  }

  onBeforeUnmount(() => window.clearInterval(playbackTimer));

  return { isPlaying, togglePlayback };
}
