<script setup lang="ts">
import { DatabaseZap } from 'lucide-vue-next';

const particles = Array.from({ length: 72 }, (_, index) => ({
  id: index,
  startX: `${((index * 37) % 120) - 10}vw`,
  startY: `${((index * 53) % 120) - 10}vh`,
  endX: `${36 + (index % 7) * 5}%`,
  endY: `${64 - (index % 5) * 8}%`,
  delay: `${(index % 18) * 28}ms`,
  hue: `${175 + (index % 8) * 18}`,
}));
const bars = Array.from({ length: 7 }, (_, index) => ({
  id: index,
  height: `${42 + ((index * 19) % 78)}px`,
  delay: `${900 + index * 90}ms`,
}));
</script>

<template>
  <div class="data-storm-effect">
    <span
      v-for="particle in particles"
      :key="particle.id"
      class="data-particle"
      :style="{
        '--start-x': particle.startX,
        '--start-y': particle.startY,
        '--end-x': particle.endX,
        '--end-y': particle.endY,
        '--particle-hue': particle.hue,
        animationDelay: particle.delay,
      }"
    />
    <div class="data-chart">
      <span
        v-for="bar in bars"
        :key="bar.id"
        class="data-bar"
        :style="{ height: bar.height, animationDelay: bar.delay }"
      />
      <DatabaseZap :size="44" />
      <strong>数据风暴</strong>
    </div>
  </div>
</template>

<style scoped>
.data-storm-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.data-particle {
  position: absolute;
  left: 0;
  top: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--particle-hue), 92%, 66%);
  box-shadow: 0 0 16px hsl(var(--particle-hue), 92%, 60%);
  opacity: 0;
  transform: translate(var(--start-x), var(--start-y));
  animation: data-particle 3.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.data-chart {
  position: absolute;
  left: 50%;
  top: 55%;
  width: min(460px, 78vw);
  height: 250px;
  border: 1px solid rgba(45, 212, 191, 0.34);
  border-radius: 14px;
  background:
    linear-gradient(rgba(45, 212, 191, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 212, 191, 0.12) 1px, transparent 1px),
    rgba(2, 6, 23, 0.3);
  background-size: 34px 34px;
  color: #ccfbf1;
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 14px;
  padding: 28px 32px 54px;
  transform: translate(-50%, -50%);
  animation: data-chart 5s ease both;
}

.data-chart svg {
  position: absolute;
  left: 24px;
  top: 20px;
}

.data-chart strong {
  position: absolute;
  left: 76px;
  top: 32px;
  font-size: 16px;
}

.data-bar {
  width: 28px;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #99f6e4, rgba(20, 184, 166, 0.42));
  box-shadow: 0 0 24px rgba(45, 212, 191, 0.4);
  opacity: 0;
  transform: scaleY(0.1);
  transform-origin: center bottom;
  animation: data-bar 3.2s ease both;
}

@keyframes data-particle {
  0% { opacity: 0; transform: translate(var(--start-x), var(--start-y)) scale(0.5); }
  18%, 60% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--end-x), var(--end-y)) scale(0.26); }
}

@keyframes data-chart {
  0%, 100% { opacity: 0; transform: translate(-50%, -44%) scale(0.88); }
  18%, 84% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes data-bar {
  0% { opacity: 0; transform: scaleY(0.1); }
  34%, 82% { opacity: 1; transform: scaleY(1); }
  100% { opacity: 0; transform: scaleY(0.86); }
}
</style>
