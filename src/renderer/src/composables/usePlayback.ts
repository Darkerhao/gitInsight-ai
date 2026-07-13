import { onBeforeUnmount, ref } from 'vue';
import type { Ref } from 'vue';
import type { TimelineDayGroup } from '@shared/types';

export function usePlayback(days: Ref<TimelineDayGroup[]>, selectedDayIndex: Ref<number>, selectDay: (day: TimelineDayGroup) => void) {
  const isPlaying = ref(false);
  let playbackTimer: number | undefined;

  function togglePlayback() {
    isPlaying.value = !isPlaying.value;
    window.clearInterval(playbackTimer);
    if (!isPlaying.value || !days.value.length) return;
    playbackTimer = window.setInterval(() => {
      const index = selectedDayIndex.value;
      selectDay(days.value[(index + 1) % days.value.length]);
    }, 1800);
  }

  onBeforeUnmount(() => window.clearInterval(playbackTimer));

  return { isPlaying, togglePlayback };
}
