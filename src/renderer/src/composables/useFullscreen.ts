import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Ref } from 'vue';
import { ElMessage } from 'element-plus';

export function useFullscreen(rootRef: Ref<HTMLElement | null>) {
  const isFullscreen = ref(false);

  function syncFullscreenState() {
    isFullscreen.value = document.fullscreenElement === rootRef.value;
  }

  async function toggleFullscreen() {
    if (!rootRef.value) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.value.requestFullscreen();
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '无法切换全屏模式');
    }
  }

  onMounted(() => document.addEventListener('fullscreenchange', syncFullscreenState));
  onBeforeUnmount(() => document.removeEventListener('fullscreenchange', syncFullscreenState));

  return { isFullscreen, toggleFullscreen };
}
