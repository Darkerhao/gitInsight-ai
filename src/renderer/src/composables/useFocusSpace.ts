import { computed, reactive, readonly, ref } from 'vue';
import { ElNotification } from 'element-plus';
import { FocusTimer, type FocusPhase } from '@shared/focusTimer';

const timer = reactive(new FocusTimer());
const sceneId = ref('scene-desk');
const soundEnabled = ref(true);
let interval: ReturnType<typeof setInterval> | undefined;
let audio: AudioContext | undefined;

function prepareSound() {
  if (!soundEnabled.value) return;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
  } catch { /* Visual notification remains available when audio is unavailable. */ }
}
function completed() {
  ElNotification({ title: timer.phase === 'focus' ? '专注完成' : '休息结束',
    message: timer.phase === 'focus' ? '辛苦了，回到专注空间开启 5 分钟休息。' : '准备好后，再开始一轮专注吧。',
    type: 'success', duration: 0 });
  if (!soundEnabled.value || !audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.connect(gain); gain.connect(audio.destination);
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.12, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.5);
  oscillator.start(); oscillator.stop(audio.currentTime + 0.5);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function tick() { if (timer.tick(Date.now())) completed(); }

export function useFocusSpace() {
  return {
    timer: readonly(timer), sceneId: readonly(sceneId), soundEnabled: readonly(soundEnabled),
    time: computed(() => {
      const seconds = Math.ceil(timer.remainingMs / 1000);
      return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }),
    selectScene(id: string) { sceneId.value = id; },
    setSound(enabled: boolean) { soundEnabled.value = enabled; if (enabled) prepareSound(); },
    start(phase: FocusPhase) { prepareSound(); timer.start(phase, Date.now()); },
    pause() { if (timer.pause(Date.now())) completed(); },
    resume() { prepareSound(); timer.resume(Date.now()); },
    end() { timer.end(); },
    initialize() {
      if (interval) return;
      interval = setInterval(tick, 250);
      document.addEventListener('visibilitychange', tick);
      window.addEventListener('focus', tick);
    },
    dispose() {
      clearInterval(interval); interval = undefined;
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
      void audio?.close(); audio = undefined;
    },
  };
}
