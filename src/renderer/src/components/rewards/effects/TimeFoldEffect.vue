<script setup lang="ts">
import { Clock3 } from 'lucide-vue-next';

const folds = Array.from({ length: 9 }, (_, index) => ({
  id: index,
  delay: `${index * 90}ms`,
  shade: `${0.16 + (index % 3) * 0.08}`,
}));
const ticks = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  angle: `${index * 20}deg`,
}));
</script>

<template>
  <div class="time-fold-effect">
    <div class="time-fold-stage">
      <span
        v-for="fold in folds"
        :key="fold.id"
        class="time-fold-panel"
        :style="{ animationDelay: fold.delay, '--fold-shade': fold.shade }"
      />
    </div>
    <div class="time-fold-clock">
      <span v-for="tick in ticks" :key="tick.id" :style="{ '--tick-angle': tick.angle }" />
      <Clock3 :size="54" />
      <strong>时间折叠过渡</strong>
    </div>
  </div>
</template>

<style scoped>
.time-fold-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  perspective: 900px;
}

.time-fold-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(680px, 88vw);
  height: min(410px, 68vh);
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  transform: translate(-50%, -50%);
}

.time-fold-panel {
  border: 1px solid rgba(147, 197, 253, 0.22);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, var(--fold-shade)), rgba(96, 165, 250, 0.08)),
    rgba(15, 23, 42, 0.28);
  box-shadow: inset 0 0 36px rgba(96, 165, 250, 0.12);
  opacity: 0;
  transform-origin: center top;
  animation: time-fold-panel 4.9s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.time-fold-panel:nth-child(odd) {
  transform-origin: center bottom;
}

.time-fold-clock {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 210px;
  height: 210px;
  border: 1px solid rgba(191, 219, 254, 0.46);
  border-radius: 50%;
  color: #dbeafe;
  display: grid;
  gap: 8px;
  place-items: center;
  align-content: center;
  transform: translate(-50%, -50%);
  animation: time-fold-clock 4.9s ease both;
}

.time-fold-clock::before {
  content: '';
  position: absolute;
  inset: 18px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, rgba(96, 165, 250, 0.34), transparent 40%);
  animation: time-fold-spin 1.5s linear infinite;
}

.time-fold-clock span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 14px;
  border-radius: 999px;
  background: rgba(191, 219, 254, 0.72);
  transform: rotate(var(--tick-angle)) translateY(-96px);
  transform-origin: center 96px;
}

.time-fold-clock svg,
.time-fold-clock strong {
  position: relative;
  z-index: 1;
}

.time-fold-clock strong {
  font-size: 15px;
}

@keyframes time-fold-panel {
  0% { opacity: 0; transform: rotateX(82deg) scaleY(0.08); filter: blur(10px); }
  30% { opacity: 1; transform: rotateX(0deg) scaleY(1); filter: blur(0); }
  64% { opacity: 1; transform: rotateX(0deg) scaleY(1); }
  100% { opacity: 0; transform: rotateX(-74deg) scaleY(0.1); filter: blur(8px); }
}

@keyframes time-fold-clock {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.62) rotate(-20deg); }
  20%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
}

@keyframes time-fold-spin {
  to { transform: rotate(360deg); }
}
</style>
