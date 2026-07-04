<script setup lang="ts">
import { CircleDashed } from 'lucide-vue-next';

const sparks = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  angle: `${index * 12.86}deg`,
  delay: `${(index % 8) * 42}ms`,
}));
</script>

<template>
  <div class="energy-ring-effect">
    <svg class="energy-rings" viewBox="0 0 240 240" aria-hidden="true">
      <circle class="energy-ring outer" cx="120" cy="120" r="92" />
      <circle class="energy-ring middle" cx="120" cy="120" r="68" />
      <circle class="energy-ring inner" cx="120" cy="120" r="42" />
    </svg>
    <span
      v-for="spark in sparks"
      :key="spark.id"
      class="energy-spark"
      :style="{ '--spark-angle': spark.angle, animationDelay: spark.delay }"
    />
    <div class="energy-core">
      <CircleDashed :size="54" />
      <strong>能量加载环</strong>
    </div>
  </div>
</template>

<style scoped>
.energy-ring-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.energy-ring-effect::before,
.energy-ring-effect::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.energy-ring-effect::before {
  width: min(520px, 78vw);
  aspect-ratio: 1;
  background: radial-gradient(circle, rgba(96, 165, 250, 0.3), rgba(45, 212, 191, 0.18) 38%, transparent 68%);
  filter: blur(12px);
  opacity: 0;
  animation: energy-aura 4.8s ease both;
}

.energy-ring-effect::after {
  width: 120px;
  aspect-ratio: 1;
  border: 1px solid rgba(255, 255, 255, 0.62);
  box-shadow: 0 0 42px rgba(96, 165, 250, 0.5);
  opacity: 0;
  animation: energy-complete-wave 1.35s cubic-bezier(0.16, 1, 0.3, 1) 3.2s both;
}

.energy-rings {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(420px, 72vw);
  transform: translate(-50%, -50%) rotate(-90deg);
  filter:
    drop-shadow(0 0 26px rgba(96, 165, 250, 0.52))
    drop-shadow(0 0 48px rgba(45, 212, 191, 0.22));
  animation: energy-stage 4.8s ease both;
}

.energy-ring {
  fill: none;
  stroke: rgba(147, 197, 253, 0.86);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 90 620;
  animation: energy-ring 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.energy-ring.middle {
  stroke: rgba(45, 212, 191, 0.86);
  animation-delay: 120ms;
  animation-direction: reverse;
}

.energy-ring.inner {
  stroke: rgba(244, 114, 182, 0.86);
  animation-delay: 220ms;
}

.energy-spark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 5px;
  height: 32px;
  border-radius: 999px;
  background: #dbeafe;
  box-shadow: 0 0 18px rgba(96, 165, 250, 0.9);
  opacity: 0;
  transform: rotate(var(--spark-angle)) translateY(-42px) scaleY(0.3);
  transform-origin: center 42px;
  animation: energy-burst 1.4s cubic-bezier(0.16, 1, 0.3, 1) 2.7s both;
}

.energy-core {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #eff6ff;
  transform: translate(-50%, -50%);
  animation: energy-core 4.8s ease both;
}

.energy-core::before {
  content: '';
  position: absolute;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22), rgba(96, 165, 250, 0.2) 36%, transparent 68%);
  animation: energy-core-breath 1.3s ease-in-out infinite;
}

.energy-core svg,
.energy-core strong {
  position: relative;
  z-index: 1;
}

.energy-core strong {
  font-size: 16px;
}

@keyframes energy-aura {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.56); }
  16%, 82% { opacity: 1; }
  70% { transform: translate(-50%, -50%) scale(0.78); }
  84% { transform: translate(-50%, -50%) scale(1.18); }
}

@keyframes energy-complete-wave {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  18% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(5.2); }
}

@keyframes energy-stage {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) rotate(-90deg) scale(0.64); }
  14%, 84% { opacity: 1; transform: translate(-50%, -50%) rotate(-90deg) scale(1); }
  70% { transform: translate(-50%, -50%) rotate(-90deg) scale(0.78); }
}

@keyframes energy-ring {
  0% { stroke-dasharray: 60 620; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 220 620; }
  100% { stroke-dasharray: 60 620; stroke-dashoffset: -680; }
}

@keyframes energy-burst {
  0% { opacity: 0; transform: rotate(var(--spark-angle)) translateY(-42px) scaleY(0.3); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--spark-angle)) translateY(-210px) scaleY(1); }
}

@keyframes energy-core {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.74); }
  16%, 84% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  72% { transform: translate(-50%, -50%) scale(0.9); }
  82% { transform: translate(-50%, -50%) scale(1.18); }
}

@keyframes energy-core-breath {
  0%, 100% { opacity: 0.48; transform: scale(0.9); }
  50% { opacity: 0.9; transform: scale(1.12); }
}
</style>
